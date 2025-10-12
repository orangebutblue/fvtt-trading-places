// Test script to verify cargo persistence fix
describe('Cargo Persistence Fix', () => {
    let mockGameSettings;
    let mockUINotifications;
    let mockChatMessage;

    beforeEach(() => {
        // Mock FoundryVTT game object
        mockGameSettings = {
            get: jest.fn(),
            set: jest.fn()
        };

        global.game = {
            settings: mockGameSettings
        };

        // Mock ui.notifications
        mockUINotifications = {
            info: jest.fn(),
            error: jest.fn(),
            warn: jest.fn()
        };

        global.ui = {
            notifications: mockUINotifications
        };

        // Mock ChatMessage
        mockChatMessage = {
            getSpeaker: jest.fn(() => ({ actor: null })),
            create: jest.fn()
        };

        global.ChatMessage = mockChatMessage;

        // Mock CONST
        global.CONST = {
            CHAT_MESSAGE_STYLES: {
                OTHER: 'other'
            }
        };
    });

    test('should save and load cargo availability data correctly', async () => {
        // Import the trading application
        const { TradingPlacesApplication } = require('../scripts/trading-application-v2.js');

        // Create a mock data manager
        const mockDataManager = {
            getSettlement: jest.fn((name) => {
                if (name === 'ALTDORF') {
                    return {
                        name: 'ALTDORF',
                        region: 'Reikland',
                        size: 'CS',
                        wealth: 5,
                        flags: ['Trade']
                    };
                }
                return null;
            }),
            getCargoAvailabilityPipeline: jest.fn(() => ({
                run: jest.fn(() => Promise.resolve({
                    settlement: { name: 'ALTDORF' },
                    slotPlan: { producerSlots: 3 },
                    slots: [
                        {
                            slotNumber: 1,
                            cargo: { name: 'Wine', category: 'Luxury' },
                            amount: { totalEP: 50 },
                            quality: { tier: 'Average' },
                            pricing: { finalPricePerEP: 2.5 },
                            merchant: { skill: 35, calculation: {} }
                        }
                    ]
                }))
            }))
        };

        // Create a mock trading engine
        const mockTradingEngine = {
            setCurrentSeason: jest.fn(),
            getCurrentSeason: jest.fn(() => 'spring')
        };

        // Create application instance
        const app = new TradingPlacesApplication({
            dataManager: mockDataManager,
            tradingEngine: mockTradingEngine
        });

        console.log('1. Setting up initial state...');

        // Set initial state
        app.selectedSettlement = mockDataManager.getSettlement('ALTDORF');
        app.currentSeason = 'spring';
        app.availableCargo = [
            {
                name: 'Wine',
                category: 'Luxury',
                quantity: 50,
                currentPrice: 2.5,
                quality: 'Average',
                merchant: { name: 'Test Merchant', hagglingSkill: 35 }
            }
        ];
        app.successfulCargo = app.availableCargo;

        console.log('2. Simulating save operation...');

        // Mock game.settings.get to return empty object initially
        mockGameSettings.get.mockReturnValue({});

        // Save cargo data
        await app._saveCargoAvailability(
            app.availableCargo,
            app.successfulCargo,
            { settlement: { name: 'ALTDORF' } },
            { available: true }
        );

        console.log('3. Verifying save operation...');
        expect(mockGameSettings.set).toHaveBeenCalledWith('trading-places', 'cargoAvailabilityData', {
            'ALTDORF_spring': {
                settlement: 'ALTDORF',
                season: 'spring',
                timestamp: expect.any(Number),
                availableCargo: app.availableCargo,
                successfulCargo: app.successfulCargo,
                pipelineResult: { settlement: { name: 'ALTDORF' } },
                availabilityResult: { available: true }
            }
        });

        console.log('4. Simulating load operation...');

        // Mock game.settings.get to return the saved data
        const savedData = {
            'ALTDORF_spring': {
                settlement: 'ALTDORF',
                season: 'spring',
                timestamp: Date.now(),
                availableCargo: app.availableCargo,
                successfulCargo: app.successfulCargo,
                pipelineResult: { settlement: { name: 'ALTDORF' } },
                availabilityResult: { available: true }
            }
        };
        mockGameSettings.get.mockReturnValue(savedData);

        // Clear current state
        app.availableCargo = [];
        app.successfulCargo = [];

        // Load cargo data
        await app._loadAndRestoreCargoAvailability();

        console.log('5. Verifying load operation...');
        expect(app.availableCargo).toHaveLength(1);
        expect(app.successfulCargo).toHaveLength(1);
        expect(app.successfulCargo[0].name).toBe('Wine');
        expect(mockUINotifications.info).toHaveBeenCalledWith(
            expect.stringContaining('Restored 1 cargo item(s) for ALTDORF')
        );

        console.log('✅ Cargo persistence test passed!');
    });
});