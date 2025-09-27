/**
 * Tests for Player Cargo Manager
 * Comprehensive test suite for cargo management operations
 */

// Mock FoundryVTT environment
global.foundry = {
    utils: {
        randomID: () => 'test-id-' + Math.random().toString(36).substr(2, 9)
    }
};

// Mock sessionStorage
const mockSessionStorage = {
    data: {},
    getItem: jest.fn((key) => mockSessionStorage.data[key] || null),
    setItem: jest.fn((key, value) => { mockSessionStorage.data[key] = value; }),
    removeItem: jest.fn((key) => { delete mockSessionStorage.data[key]; }),
    clear: jest.fn(() => { mockSessionStorage.data = {}; })
};
global.sessionStorage = mockSessionStorage;

// Mock window for event dispatching
global.window = {
    dispatchEvent: jest.fn()
};

// Import the class to test
const { PlayerCargoManager } = require('../scripts/player-cargo-manager.js');

describe('PlayerCargoManager', () => {
    let cargoManager;
    let mockDebugLogger;
    let mockDataManager;

    beforeEach(() => {
        // Reset mocks
        jest.clearAllMocks();
        mockSessionStorage.clear();
        
        // Reset window mock
        global.window.dispatchEvent = jest.fn();

        // Create mock debug logger
        mockDebugLogger = {
            log: jest.fn()
        };

        // Create mock data manager
        mockDataManager = {
            getCargoType: jest.fn((type) => {
                const cargoTypes = {
                    'Grain': { name: 'Grain', category: 'Bulk Goods' },
                    'Metal': { name: 'Metal', category: 'Raw Materials' },
                    'Luxuries': { name: 'Luxuries', category: 'Luxury Goods' }
                };
                return cargoTypes[type] || null;
            }),
            getAllCargoTypes: jest.fn(() => [
                { name: 'Grain', category: 'Bulk Goods' },
                { name: 'Metal', category: 'Raw Materials' },
                { name: 'Luxuries', category: 'Luxury Goods' }
            ])
        };

        // Create cargo manager instance
        cargoManager = new PlayerCargoManager(mockDebugLogger, mockDataManager, mockSessionStorage);
    });

    describe('Initialization', () => {
        test('should initialize with empty cargo list', () => {
            expect(cargoManager.playerCargo).toEqual([]);
            expect(cargoManager.debugLogger).toBe(mockDebugLogger);
            expect(cargoManager.dataManager).toBe(mockDataManager);
        });

        test('should initialize quality options', () => {
            const qualityOptions = cargoManager.getQualityOptions();
            expect(qualityOptions).toHaveLength(4);
            expect(qualityOptions.map(q => q.value)).toEqual(['poor', 'average', 'good', 'excellent']);
        });

        test('should log initialization', () => {
            expect(mockDebugLogger.log).toHaveBeenCalledWith(
                'SYSTEM', 'Initialization', 'Player Cargo Manager initialized', null, 'INFO'
            );
        });
    });

    describe('Session Persistence', () => {
        test('should save session data to sessionStorage', () => {
            // Clear any existing calls
            mockSessionStorage.setItem.mockClear();
            
            // Manually call saveSessionData to test it directly
            cargoManager.saveSessionData();
            
            expect(mockSessionStorage.setItem).toHaveBeenCalledWith(
                'wfrp-trading-cargo-session',
                expect.stringContaining('playerCargo')
            );
        });

        test('should load existing session data', () => {
            // Set up existing session data
            const existingData = {
                playerCargo: [
                    { id: 'test-1', type: 'Grain', quantity: 50, quality: 'average' }
                ],
                sessionData: { sessionId: 'test-session' }
            };
            mockSessionStorage.setItem('wfrp-trading-cargo-session', JSON.stringify(existingData));

            // Create new manager instance
            const newManager = new PlayerCargoManager(mockDebugLogger, mockDataManager, mockSessionStorage);
            
            expect(newManager.playerCargo).toHaveLength(1);
            expect(newManager.playerCargo[0].type).toBe('Grain');
        });

        test('should handle corrupted session data gracefully', () => {
            // Clear existing session first
            mockSessionStorage.clear();
            mockSessionStorage.setItem('wfrp-trading-cargo-session', 'invalid-json');
            
            const newManager = new PlayerCargoManager(mockDebugLogger, mockDataManager, mockSessionStorage);
            
            expect(newManager.playerCargo).toEqual([]);
            expect(mockDebugLogger.log).toHaveBeenCalledWith(
                'SYSTEM', 'Session Load', 'Error loading session data', 
                expect.objectContaining({ error: expect.any(String) }), 'ERROR'
            );
        });
    });

    describe('Add Cargo Operations', () => {
        test('should add new cargo successfully', () => {
            const result = cargoManager.addCargo('Grain', 100, 'average');
            
            expect(result.success).toBe(true);
            expect(result.totalItems).toBe(1);
            expect(result.totalQuantity).toBe(100);
            expect(cargoManager.playerCargo).toHaveLength(1);
            expect(cargoManager.playerCargo[0].type).toBe('Grain');
            expect(cargoManager.playerCargo[0].quantity).toBe(100);
            expect(cargoManager.playerCargo[0].quality).toBe('average');
        });

        test('should merge cargo of same type and quality', () => {
            cargoManager.addCargo('Grain', 100, 'average');
            const result = cargoManager.addCargo('Grain', 50, 'average');
            
            expect(result.success).toBe(true);
            expect(result.totalItems).toBe(1);
            expect(result.totalQuantity).toBe(150);
            expect(cargoManager.playerCargo).toHaveLength(1);
            expect(cargoManager.playerCargo[0].quantity).toBe(150);
        });

        test('should keep separate entries for different qualities', () => {
            cargoManager.addCargo('Grain', 100, 'average');
            cargoManager.addCargo('Grain', 50, 'good');
            
            expect(cargoManager.playerCargo).toHaveLength(2);
            expect(cargoManager.getTotalCargoQuantity()).toBe(150);
        });

        test('should validate cargo input', () => {
            const result = cargoManager.addCargo('', 100, 'average');
            
            expect(result.success).toBe(false);
            expect(result.error).toContain('Cargo type is required');
        });

        test('should validate quantity is positive integer', () => {
            const result = cargoManager.addCargo('Grain', -10, 'average');
            
            expect(result.success).toBe(false);
            expect(result.error).toContain('Quantity must be a positive integer');
        });

        test('should validate quality options', () => {
            const result = cargoManager.addCargo('Grain', 100, 'invalid');
            
            expect(result.success).toBe(false);
            expect(result.error).toContain('Quality must be one of');
        });

        test('should log cargo addition', () => {
            cargoManager.addCargo('Grain', 100, 'average');
            
            expect(mockDebugLogger.log).toHaveBeenCalledWith(
                'USER_ACTION', 'Add Cargo', 
                'Adding cargo: 100 EP of Grain (average)',
                expect.objectContaining({
                    cargoType: 'Grain',
                    quantity: 100,
                    quality: 'average'
                }),
                'INFO'
            );
        });

        test('should trigger cargo update event', () => {
            cargoManager.addCargo('Grain', 100, 'average');
            
            expect(window.dispatchEvent).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'wfrp-cargo-updated',
                    detail: expect.objectContaining({
                        totalItems: 1,
                        totalQuantity: 100
                    })
                })
            );
        });
    });

    describe('Remove Cargo Operations', () => {
        beforeEach(() => {
            cargoManager.addCargo('Grain', 100, 'average');
            cargoManager.addCargo('Metal', 50, 'good');
        });

        test('should remove partial quantity', () => {
            const cargoId = cargoManager.playerCargo[0].id;
            const result = cargoManager.removeCargo(cargoId, 30);
            
            expect(result.success).toBe(true);
            expect(cargoManager.playerCargo[0].quantity).toBe(70);
            expect(cargoManager.getTotalCargoQuantity()).toBe(120);
        });

        test('should remove entire cargo when quantity equals total', () => {
            const cargoId = cargoManager.playerCargo[0].id;
            const result = cargoManager.removeCargo(cargoId, 100);
            
            expect(result.success).toBe(true);
            expect(cargoManager.playerCargo).toHaveLength(1);
            expect(cargoManager.getTotalCargoQuantity()).toBe(50);
        });

        test('should remove entire cargo when no quantity specified', () => {
            const cargoId = cargoManager.playerCargo[0].id;
            const result = cargoManager.removeCargo(cargoId);
            
            expect(result.success).toBe(true);
            expect(cargoManager.playerCargo).toHaveLength(1);
        });

        test('should handle non-existent cargo ID', () => {
            const result = cargoManager.removeCargo('non-existent-id', 10);
            
            expect(result.success).toBe(false);
            expect(result.error).toBe('Cargo not found');
        });

        test('should log cargo removal', () => {
            const cargoId = cargoManager.playerCargo[0].id;
            cargoManager.removeCargo(cargoId, 30);
            
            expect(mockDebugLogger.log).toHaveBeenCalledWith(
                'USER_ACTION', 'Remove Cargo',
                'Removing 30 EP of Grain',
                expect.objectContaining({
                    cargoId,
                    cargoType: 'Grain',
                    removeQuantity: 30
                }),
                'INFO'
            );
        });
    });

    describe('Modify Cargo Operations', () => {
        beforeEach(() => {
            cargoManager.addCargo('Grain', 100, 'average');
        });

        test('should modify cargo properties', () => {
            const cargoId = cargoManager.playerCargo[0].id;
            const result = cargoManager.modifyCargo(cargoId, {
                quantity: 150,
                quality: 'good',
                notes: 'High quality grain'
            });
            
            expect(result.success).toBe(true);
            expect(cargoManager.playerCargo[0].quantity).toBe(150);
            expect(cargoManager.playerCargo[0].quality).toBe('good');
            expect(cargoManager.playerCargo[0].notes).toBe('High quality grain');
        });

        test('should not modify protected fields', () => {
            const cargoId = cargoManager.playerCargo[0].id;
            const originalId = cargoManager.playerCargo[0].id;
            const originalCreated = cargoManager.playerCargo[0].created;
            
            cargoManager.modifyCargo(cargoId, {
                id: 'new-id',
                created: 'new-date'
            });
            
            expect(cargoManager.playerCargo[0].id).toBe(originalId);
            expect(cargoManager.playerCargo[0].created).toBe(originalCreated);
        });

        test('should handle non-existent cargo ID', () => {
            const result = cargoManager.modifyCargo('non-existent-id', { quantity: 200 });
            
            expect(result.success).toBe(false);
            expect(result.error).toBe('Cargo not found');
        });
    });

    describe('Cargo Retrieval Operations', () => {
        beforeEach(() => {
            cargoManager.addCargo('Grain', 100, 'average');
            cargoManager.addCargo('Grain', 50, 'good');
            cargoManager.addCargo('Metal', 75, 'average');
        });

        test('should get all cargo', () => {
            const allCargo = cargoManager.getAllCargo();
            
            expect(allCargo).toHaveLength(3);
            expect(allCargo[0].type).toBe('Grain');
            expect(allCargo[2].type).toBe('Metal');
        });

        test('should get cargo by ID', () => {
            const cargoId = cargoManager.playerCargo[0].id;
            const cargo = cargoManager.getCargoById(cargoId);
            
            expect(cargo).toBeTruthy();
            expect(cargo.type).toBe('Grain');
            expect(cargo.quantity).toBe(100);
        });

        test('should return null for non-existent ID', () => {
            const cargo = cargoManager.getCargoById('non-existent-id');
            
            expect(cargo).toBeNull();
        });

        test('should get cargo by type', () => {
            const grainCargo = cargoManager.getCargoByType('Grain');
            
            expect(grainCargo).toHaveLength(2);
            expect(grainCargo[0].type).toBe('Grain');
            expect(grainCargo[1].type).toBe('Grain');
        });

        test('should get cargo by type and quality', () => {
            const grainAverage = cargoManager.getCargoByType('Grain', 'average');
            
            expect(grainAverage).toHaveLength(1);
            expect(grainAverage[0].quality).toBe('average');
        });

        test('should get total cargo quantity', () => {
            const totalQuantity = cargoManager.getTotalCargoQuantity();
            
            expect(totalQuantity).toBe(225); // 100 + 50 + 75
        });

        test('should get cargo summary', () => {
            const summary = cargoManager.getCargoSummary();
            
            expect(Object.keys(summary)).toHaveLength(3);
            expect(summary['Grain_average'].quantity).toBe(100);
            expect(summary['Grain_good'].quantity).toBe(50);
            expect(summary['Metal_average'].quantity).toBe(75);
        });
    });

    describe('Clear Operations', () => {
        beforeEach(() => {
            cargoManager.addCargo('Grain', 100, 'average');
            cargoManager.addCargo('Metal', 50, 'good');
        });

        test('should clear all cargo', () => {
            const result = cargoManager.clearAllCargo();
            
            expect(result.success).toBe(true);
            expect(result.itemsCleared).toBe(2);
            expect(result.quantityCleared).toBe(150);
            expect(cargoManager.playerCargo).toHaveLength(0);
        });

        test('should log clear operation', () => {
            cargoManager.clearAllCargo();
            
            expect(mockDebugLogger.log).toHaveBeenCalledWith(
                'USER_ACTION', 'Clear All Cargo', 'Clearing all player cargo',
                expect.objectContaining({
                    itemsCleared: 2,
                    quantityCleared: 150
                }),
                'INFO'
            );
        });
    });

    describe('Data Manager Integration', () => {
        test('should get available cargo types from data manager', () => {
            const cargoTypes = cargoManager.getAvailableCargoTypes();
            
            expect(cargoTypes).toHaveLength(3);
            expect(mockDataManager.getAllCargoTypes).toHaveBeenCalled();
        });

        test('should handle missing data manager gracefully', () => {
            const managerWithoutData = new PlayerCargoManager(mockDebugLogger, null, mockSessionStorage);
            const cargoTypes = managerWithoutData.getAvailableCargoTypes();
            
            expect(cargoTypes).toEqual([]);
        });

        test('should get cargo type data', () => {
            const grainData = cargoManager.getCargoTypeData('Grain');
            
            expect(grainData).toBeTruthy();
            expect(grainData.name).toBe('Grain');
            expect(mockDataManager.getCargoType).toHaveBeenCalledWith('Grain');
        });
    });

    describe('Logging Integration', () => {
        test('should use debug logger when available', () => {
            cargoManager.log('TEST', 'Test Operation', 'Test message', { test: true });
            
            expect(mockDebugLogger.log).toHaveBeenCalledWith(
                'TEST', 'Test Operation', 'Test message', { test: true }, 'INFO'
            );
        });

        test('should fallback to console when no debug logger', () => {
            const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
            const managerWithoutLogger = new PlayerCargoManager(null, mockDataManager, mockSessionStorage);
            
            managerWithoutLogger.log('TEST', 'Test Operation', 'Test message');
            
            expect(consoleSpy).toHaveBeenCalled();
            consoleSpy.mockRestore();
        });
    });

    describe('Input Validation', () => {
        test('should validate cargo type is string', () => {
            const validation = cargoManager.validateCargoInput(123, 100, 'average');
            
            expect(validation.valid).toBe(false);
            expect(validation.errors).toContain('Cargo type is required and must be a non-empty string');
        });

        test('should validate quantity is positive', () => {
            const validation = cargoManager.validateCargoInput('Grain', 0, 'average');
            
            expect(validation.valid).toBe(false);
            expect(validation.errors).toContain('Quantity must be a positive integer');
        });

        test('should validate quality is valid option', () => {
            const validation = cargoManager.validateCargoInput('Grain', 100, 'invalid');
            
            expect(validation.valid).toBe(false);
            expect(validation.errors).toContain('Quality must be one of: poor, average, good, excellent');
        });

        test('should pass valid input', () => {
            const validation = cargoManager.validateCargoInput('Grain', 100, 'average');
            
            expect(validation.valid).toBe(true);
            expect(validation.error).toBeNull();
        });
    });

    describe('Event System', () => {
        test('should dispatch cargo update events', () => {
            cargoManager.triggerCargoUpdate();
            
            expect(window.dispatchEvent).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'wfrp-cargo-updated'
                })
            );
        });

        test('should include cargo data in events', () => {
            cargoManager.addCargo('Grain', 100, 'average');
            
            const lastCall = window.dispatchEvent.mock.calls[window.dispatchEvent.mock.calls.length - 1];
            const event = lastCall[0];
            
            expect(event.detail.totalItems).toBe(1);
            expect(event.detail.totalQuantity).toBe(100);
            expect(event.detail.cargo).toHaveLength(1);
        });
    });
});