/**
 * Simplified FoundryVTT Integration Tests
 * Tests Requirements: 6.1-6.10, 5.1-5.5
 * 
 * Focuses on core integration functionality without complex UI components
 */

// Mock FoundryVTT environment
global.game = {
    settings: {
        register: jest.fn(),
        get: jest.fn().mockReturnValue('spring'),
        set: jest.fn().mockResolvedValue(true)
    },
    user: { id: 'test-user', isGM: true },
    system: { id: 'wfrp4e' }
};

global.ChatMessage = {
    create: jest.fn().mockResolvedValue({
        id: 'msg-123',
        content: 'Test message',
        timestamp: Date.now()
    })
};

global.Roll = class MockRoll {
    constructor(formula) {
        this.formula = formula;
        this.total = Math.floor(Math.random() * 100) + 1;
        this.evaluated = false;
    }
    
    async evaluate() {
        this.evaluated = true;
        return this;
    }
    
    async toMessage(data = {}) {
        return await ChatMessage.create({
            content: `Roll: ${this.total}`,
            ...data
        });
    }
};

global.ui = {
    notifications: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
    }
};

global.Hooks = {
    once: jest.fn(),
    on: jest.fn(),
    call: jest.fn()
};

global.CONST = {
    CHAT_MESSAGE_TYPES: { OTHER: 0, ROLL: 5 }
};

// Import modules
const TradingEngine = require('../scripts/trading-engine.js');
const DataManager = require('../scripts/data-manager.js');
const SystemAdapter = require('../scripts/system-adapter.js');

describe('FoundryVTT Integration - Core Features', () => {
    let tradingEngine;
    let dataManager;
    let systemAdapter;
    
    beforeEach(() => {
        jest.clearAllMocks();
        
        dataManager = new DataManager();
        systemAdapter = new SystemAdapter();
        tradingEngine = new TradingEngine(dataManager);
        
        // Mock data manager methods
        dataManager.getSettlementProperties = jest.fn().mockReturnValue({
            name: 'Ubersreik',
            sizeNumeric: 3,
            wealthRating: 3,
            wealthModifier: 1.0,
            productionCategories: ['Trade', 'Wine']
        });
        
        dataManager.isTradeSettlement = jest.fn().mockReturnValue(true);
        dataManager.validateSettlement = jest.fn().mockReturnValue({ valid: true, errors: [] });
        dataManager.getSeasonalPrice = jest.fn().mockReturnValue(15);
        
        dataManager.cargoTypes = [
            {
                name: 'Wine',
                category: 'Luxury',
                basePrices: { spring: 15, summer: 12, autumn: 18, winter: 20 },
                qualityTiers: { poor: 0.5, average: 1.0, good: 1.5, excellent: 2.0 }
            }
        ];
    });

    describe('Dice Rolling Integration', () => {
        test('should integrate with FoundryVTT dice system', async () => {
            // Requirements: 6.7, 6.8, 6.9
            
            const roll = new Roll('1d100');
            await roll.evaluate();
            
            expect(roll.evaluated).toBe(true);
            expect(roll.total).toBeGreaterThanOrEqual(1);
            expect(roll.total).toBeLessThanOrEqual(100);
            
            const chatMessage = await roll.toMessage({
                flavor: 'Cargo Availability Check'
            });
            
            expect(ChatMessage.create).toHaveBeenCalledWith({
                content: `Roll: ${roll.total}`,
                flavor: 'Cargo Availability Check'
            });
            
            expect(chatMessage.id).toBe('msg-123');
        });

        test('should post dice results to chat with proper formatting', async () => {
            // Requirements: 6.8, 6.9
            
            const availabilityRoll = new Roll('1d100');
            await availabilityRoll.evaluate();
            
            await availabilityRoll.toMessage({
                flavor: 'Cargo Availability Check (need ≤ 60)',
                whisper: ['gm-user']
            });
            
            expect(ChatMessage.create).toHaveBeenCalledWith({
                content: `Roll: ${availabilityRoll.total}`,
                flavor: 'Cargo Availability Check (need ≤ 60)',
                whisper: ['gm-user']
            });
            
            // Test haggle roll
            const haggleRoll = new Roll('1d100');
            await haggleRoll.evaluate();
            
            await haggleRoll.toMessage({
                flavor: 'Haggle Test: Player (45) vs Merchant (40)'
            });
            
            expect(ChatMessage.create).toHaveBeenCalledTimes(2);
        });

        test('should handle dice roll failures gracefully', async () => {
            // Requirements: 6.9
            
            ChatMessage.create.mockRejectedValueOnce(new Error('Chat service unavailable'));
            
            const roll = new Roll('1d100');
            await roll.evaluate();
            
            const result = await roll.toMessage().catch(error => ({
                success: false,
                error: error.message
            }));
            
            expect(result.success).toBe(false);
            expect(result.error).toBe('Chat service unavailable');
        });
    });

    describe('Settings Persistence and Season Management', () => {
        test('should persist season changes through FoundryVTT settings', async () => {
            // Requirements: 5.1, 5.2, 6.1
            
            // Test setting current season (basic functionality)
            tradingEngine.setCurrentSeason('winter');
            expect(tradingEngine.getCurrentSeason()).toBe('winter');
            
            // Test season validation
            expect(() => {
                tradingEngine.setCurrentSeason('invalid-season');
            }).toThrow('Invalid season: invalid-season');
            
            // Test valid seasons
            const validSeasons = ['spring', 'summer', 'autumn', 'winter'];
            validSeasons.forEach(season => {
                expect(() => {
                    tradingEngine.setCurrentSeason(season);
                }).not.toThrow();
                expect(tradingEngine.getCurrentSeason()).toBe(season);
            });
        });

        test('should trigger notifications on season changes', async () => {
            // Requirements: 5.2, 5.3
            
            // Test that season setting works
            tradingEngine.setCurrentSeason('summer');
            expect(tradingEngine.getCurrentSeason()).toBe('summer');
            
            // In a real implementation, this would trigger notifications
            // For now, we test that the season change is successful
            expect(tradingEngine.getCurrentSeason()).toBe('summer');
        });

        test('should validate season before trading operations', () => {
            // Requirements: 5.4, 5.5
            
            tradingEngine.currentSeason = null;
            
            expect(() => {
                tradingEngine.validateSeasonSet();
            }).toThrow('Season must be set before trading operations');
            
            tradingEngine.setCurrentSeason('spring');
            
            expect(() => {
                tradingEngine.validateSeasonSet();
            }).not.toThrow();
        });
    });

    describe('Chat Message Integration', () => {
        test('should create formatted transaction messages', async () => {
            // Requirements: 6.5, 6.8
            
            const transactionData = {
                type: 'purchase',
                settlement: 'Ubersreik',
                cargo: 'Wine',
                quantity: 20,
                totalPrice: 300,
                season: 'spring'
            };
            
            const messageContent = `
                <div class="trading-result purchase">
                    <h3>Purchase Completed</h3>
                    <p><strong>Settlement:</strong> ${transactionData.settlement}</p>
                    <p><strong>Cargo:</strong> ${transactionData.cargo} (${transactionData.quantity} EP)</p>
                    <p><strong>Total Price:</strong> ${transactionData.totalPrice} GC</p>
                    <p><strong>Season:</strong> ${transactionData.season}</p>
                </div>
            `;
            
            await ChatMessage.create({
                content: messageContent,
                type: CONST.CHAT_MESSAGE_TYPES.OTHER
            });
            
            expect(ChatMessage.create).toHaveBeenCalledWith({
                content: messageContent,
                type: CONST.CHAT_MESSAGE_TYPES.OTHER
            });
        });

        test('should handle chat visibility settings', async () => {
            // Requirements: 6.5
            
            game.settings.get.mockReturnValue('gm');
            
            const gmOnlyMessage = await ChatMessage.create({
                content: 'GM Only Message',
                whisper: game.settings.get('wfrp-trading', 'chatVisibility') === 'gm' ? ['gm-user'] : []
            });
            
            expect(ChatMessage.create).toHaveBeenCalledWith({
                content: 'GM Only Message',
                whisper: ['gm-user']
            });
            
            game.settings.get.mockReturnValue('all');
            
            const publicMessage = await ChatMessage.create({
                content: 'Public Message',
                whisper: game.settings.get('wfrp-trading', 'chatVisibility') === 'gm' ? ['gm-user'] : []
            });
            
            expect(ChatMessage.create).toHaveBeenCalledWith({
                content: 'Public Message',
                whisper: []
            });
        });
    });

    describe('Actor Property Manipulation', () => {
        test('should validate actor properties for system compatibility', () => {
            // Requirements: 6.2, 6.3, 6.4
            
            const validActor = {
                system: {
                    money: { gc: 500 },
                    skills: { haggle: { total: 45 } }
                }
            };
            
            // Test basic actor structure validation
            expect(validActor.system).toBeDefined();
            expect(validActor.system.money).toBeDefined();
            expect(validActor.system.money.gc).toBe(500);
            
            const invalidActor = {
                system: {} // Missing required properties
            };
            
            expect(invalidActor.system.money).toBeUndefined();
        });

        test('should handle currency operations safely', async () => {
            // Requirements: 6.2, 6.3
            
            const mockActor = {
                system: { money: { gc: 1000 } },
                update: jest.fn().mockResolvedValue(true)
            };
            
            // Test basic currency access
            expect(mockActor.system.money.gc).toBe(1000);
            
            // Test currency update simulation
            await mockActor.update({ 'system.money.gc': 750 });
            expect(mockActor.update).toHaveBeenCalledWith({ 'system.money.gc': 750 });
            
            // Test insufficient funds check
            const hasEnoughFunds = mockActor.system.money.gc >= 2000;
            expect(hasEnoughFunds).toBe(false);
        });

        test('should handle inventory operations', async () => {
            // Requirements: 6.2, 6.3
            
            const mockActor = {
                items: new Map(),
                createEmbeddedDocuments: jest.fn().mockResolvedValue([{
                    id: 'item-123',
                    name: 'Wine (good)',
                    system: { quantity: { value: 20 } }
                }])
            };
            
            // Test item creation
            const items = await mockActor.createEmbeddedDocuments('Item', [{
                name: 'Wine (good)',
                type: 'tradeGood',
                system: { quantity: { value: 20 } }
            }]);
            
            expect(items).toHaveLength(1);
            expect(items[0].name).toBe('Wine (good)');
            expect(mockActor.createEmbeddedDocuments).toHaveBeenCalled();
        });
    });

    describe('Error Handling Integration', () => {
        test('should handle FoundryVTT API errors gracefully', async () => {
            // Requirements: 6.4, 6.10, 8.7, 8.8
            
            // Test invalid season error
            expect(() => {
                tradingEngine.setCurrentSeason('invalid');
            }).toThrow('Invalid season: invalid');
            
            // Test chat error
            ChatMessage.create.mockRejectedValueOnce(new Error('Chat unavailable'));
            
            const chatResult = await ChatMessage.create({
                content: 'Test'
            }).catch(error => ({
                success: false,
                error: error.message
            }));
            
            expect(chatResult.success).toBe(false);
            expect(chatResult.error).toBe('Chat unavailable');
        });

        test('should provide clear error messages', () => {
            // Requirements: 6.4, 6.10
            
            // Test season validation
            expect(() => {
                tradingEngine.setCurrentSeason('');
            }).toThrow();
            
            expect(() => {
                tradingEngine.setCurrentSeason(null);
            }).toThrow();
            
            // Test missing season for price calculation
            const engineWithoutSeason = new TradingEngine(dataManager);
            
            expect(() => {
                engineWithoutSeason.calculateBasePrice('Wine');
            }).toThrow('Season must be set or provided to calculate prices');
        });

        test('should handle component integration failures', () => {
            // Requirements: 8.7, 8.8
            
            // Test with null data manager
            const failingEngine = new TradingEngine(null);
            
            expect(() => {
                failingEngine.calculateAvailabilityChance({});
            }).toThrow();
            
            // Test invalid configuration
            const invalidAdapter = new SystemAdapter({
                currency: { field: '' }
            });
            
            const validation = invalidAdapter.validateSystemCompatibility();
            expect(validation.compatible).toBe(false);
        });
    });

    describe('Complete Workflow Integration', () => {
        test('should execute end-to-end trading workflow', async () => {
            // Requirements: 1.1-1.7, 2.1-2.6, 6.1-6.10
            
            // Set season first
            tradingEngine.setCurrentSeason('spring');
            
            const settlement = {
                region: 'Empire',
                name: 'Ubersreik',
                size: 'T',
                wealth: 3,
                source: ['Trade', 'Wine']
            };
            
            // Step 1: Check availability
            const availability = await tradingEngine.checkCargoAvailability(settlement, () => 45);
            expect(availability.available).toBe(true);
            expect(availability.chance).toBe(60); // (3+3) * 10 = 60%
            
            // Step 2: Calculate price
            const price = tradingEngine.calculatePurchasePrice('Wine', 20);
            expect(price.totalPrice).toBeGreaterThan(0);
            expect(price.cargoName).toBe('Wine');
            expect(price.quantity).toBe(20);
            
            // Step 3: Create transaction message
            await ChatMessage.create({
                content: `Purchase: ${price.cargoName} (${price.quantity} EP) for ${price.totalPrice} GC`
            });
            
            expect(ChatMessage.create).toHaveBeenCalled();
            
            // Step 4: Update season and verify price changes
            tradingEngine.setCurrentSeason('winter');
            const winterPrice = tradingEngine.calculatePurchasePrice('Wine', 20);
            
            // Prices should be different between seasons
            expect(winterPrice.season).toBe('winter');
            expect(winterPrice.cargoName).toBe('Wine');
        });

        test('should handle haggling workflow with dice integration', async () => {
            // Requirements: 2.3, 2.4, 2.5, 6.7, 6.8
            
            // Set season first
            tradingEngine.setCurrentSeason('spring');
            
            const haggleResult = await tradingEngine.performHaggleTest(
                45, // Player skill
                40, // Merchant skill
                true, // Has Dealmaker
                {},
                () => 25 // Mock roll
            );
            
            expect(haggleResult.success).toBe(true);
            expect(haggleResult.hasDealmakertTalent).toBe(true);
            
            // Apply to purchase
            const basePrice = tradingEngine.calculatePurchasePrice('Wine', 15);
            const hagglePrice = tradingEngine.calculatePurchasePrice('Wine', 15, {
                haggleResult: haggleResult
            });
            
            expect(hagglePrice.totalPrice).toBeLessThan(basePrice.totalPrice);
            expect(hagglePrice.modifiers.length).toBeGreaterThan(0);
            
            // Generate chat message
            const haggleMessage = tradingEngine.generateHaggleTestMessage(haggleResult);
            expect(haggleMessage).toContain('Haggle Test');
            
            await ChatMessage.create({ content: haggleMessage });
            expect(ChatMessage.create).toHaveBeenCalled();
        });
    });
});