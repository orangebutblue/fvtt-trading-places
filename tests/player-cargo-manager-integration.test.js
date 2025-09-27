/**
 * Integration Tests for Player Cargo Manager
 * Tests integration with other trading system components
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

// Mock window for event dispatching
global.window = {
    dispatchEvent: jest.fn()
};

// Import required classes
const { PlayerCargoManager } = require('../scripts/player-cargo-manager.js');
const WFRPDebugLogger = require('../scripts/debug-logger.js');

describe('PlayerCargoManager Integration', () => {
    let cargoManager;
    let debugLogger;
    let mockDataManager;

    beforeEach(() => {
        // Reset mocks
        jest.clearAllMocks();
        mockSessionStorage.clear();
        global.window.dispatchEvent = jest.fn();

        // Create real debug logger
        debugLogger = new WFRPDebugLogger();
        debugLogger.setEnabled(true);

        // Create mock data manager with realistic data
        mockDataManager = {
            getCargoType: jest.fn((type) => {
                const cargoTypes = {
                    'Grain': {
                        name: 'Grain',
                        category: 'Bulk Goods',
                        basePrices: { spring: 1, summer: 0.5, autumn: 0.25, winter: 0.5 },
                        encumbrancePerUnit: 10
                    },
                    'Metal': {
                        name: 'Metal',
                        category: 'Raw Materials',
                        basePrices: { spring: 8, summer: 8, autumn: 8, winter: 8 },
                        encumbrancePerUnit: 10
                    },
                    'Luxuries': {
                        name: 'Luxuries',
                        category: 'Luxury Goods',
                        basePrices: { spring: 50, summer: 50, autumn: 50, winter: 50 },
                        encumbrancePerUnit: 10
                    }
                };
                return cargoTypes[type] || null;
            }),
            getAllCargoTypes: jest.fn(() => [
                { name: 'Grain', category: 'Bulk Goods' },
                { name: 'Metal', category: 'Raw Materials' },
                { name: 'Luxuries', category: 'Luxury Goods' },
                { name: 'Timber', category: 'Raw Materials' },
                { name: 'Wool', category: 'Textiles' }
            ])
        };

        // Create cargo manager with real components
        cargoManager = new PlayerCargoManager(debugLogger, mockDataManager, mockSessionStorage);
    });

    describe('Integration with Debug Logger', () => {
        test('should log all operations through debug logger', () => {
            const logSpy = jest.spyOn(debugLogger, 'log');
            
            // Perform various operations
            cargoManager.addCargo('Grain', 100, 'average');
            cargoManager.addCargo('Metal', 50, 'good');
            
            const grainCargo = cargoManager.getCargoByType('Grain')[0];
            cargoManager.removeCargo(grainCargo.id, 25);
            
            cargoManager.clearAllCargo();
            
            // Verify logging occurred
            expect(logSpy.mock.calls.length).toBeGreaterThan(0);
            
            // Check for specific log categories
            const logCalls = logSpy.mock.calls;
            const categories = logCalls.map(call => call[0]);
            
            expect(categories).toContain('USER_ACTION');
            expect(categories).toContain('CARGO_OPERATION');
            expect(categories).toContain('SYSTEM');
        });

        test('should handle debug logger being disabled', () => {
            debugLogger.setEnabled(false);
            const logSpy = jest.spyOn(debugLogger, 'log');
            
            cargoManager.addCargo('Grain', 100, 'average');
            
            // Logger should still be called but not output to console
            expect(logSpy).toHaveBeenCalled();
        });
    });

    describe('Integration with Data Manager', () => {
        test('should retrieve cargo type information from data manager', () => {
            cargoManager.addCargo('Grain', 100, 'average');
            
            expect(mockDataManager.getCargoType).toHaveBeenCalledWith('Grain');
        });

        test('should get available cargo types for UI', () => {
            const availableTypes = cargoManager.getAvailableCargoTypes();
            
            expect(mockDataManager.getAllCargoTypes).toHaveBeenCalled();
            expect(availableTypes).toHaveLength(5);
            expect(availableTypes[0]).toHaveProperty('name');
            expect(availableTypes[0]).toHaveProperty('category');
        });

        test('should handle unknown cargo types gracefully', () => {
            const result = cargoManager.addCargo('UnknownCargo', 100, 'average');
            
            expect(result.success).toBe(true); // Should still add cargo
            expect(mockDataManager.getCargoType).toHaveBeenCalledWith('UnknownCargo');
        });
    });

    describe('Session Persistence Integration', () => {
        test('should persist cargo across manager instances', () => {
            // Add cargo to first instance
            cargoManager.addCargo('Grain', 100, 'average');
            cargoManager.addCargo('Metal', 50, 'good');
            
            // Create new instance (simulating page reload)
            const newManager = new PlayerCargoManager(debugLogger, mockDataManager, mockSessionStorage);
            
            // Verify cargo was loaded
            expect(newManager.getAllCargo()).toHaveLength(2);
            expect(newManager.getTotalCargoQuantity()).toBe(150);
        });

        test('should save cargo modifications to session', () => {
            cargoManager.addCargo('Grain', 100, 'average');
            
            // Verify session storage was called
            expect(mockSessionStorage.setItem).toHaveBeenCalledWith(
                'wfrp-trading-cargo-session',
                expect.stringContaining('playerCargo')
            );
        });
    });

    describe('Event System Integration', () => {
        test('should dispatch events for UI updates', () => {
            cargoManager.addCargo('Grain', 100, 'average');
            
            expect(global.window.dispatchEvent).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'wfrp-cargo-updated',
                    detail: expect.objectContaining({
                        totalItems: 1,
                        totalQuantity: 100
                    })
                })
            );
        });

        test('should include complete cargo data in events', () => {
            cargoManager.addCargo('Grain', 100, 'average');
            cargoManager.addCargo('Metal', 50, 'good');
            
            const lastCall = global.window.dispatchEvent.mock.calls[global.window.dispatchEvent.mock.calls.length - 1];
            const event = lastCall[0];
            
            expect(event.detail.cargo).toHaveLength(2);
            expect(event.detail.cargo[0]).toHaveProperty('type');
            expect(event.detail.cargo[0]).toHaveProperty('quantity');
            expect(event.detail.cargo[0]).toHaveProperty('quality');
        });
    });

    describe('Trading Workflow Integration', () => {
        test('should support buying workflow integration', () => {
            // Simulate buying cargo (would come from buying algorithm)
            const purchaseData = {
                type: 'Grain',
                quantity: 150,
                quality: 'average',
                purchaseLocation: 'Altdorf',
                purchasePrice: 300,
                purchaseDate: new Date().toISOString()
            };
            
            const result = cargoManager.addCargo(
                purchaseData.type,
                purchaseData.quantity,
                purchaseData.quality,
                {
                    purchaseLocation: purchaseData.purchaseLocation,
                    purchasePrice: purchaseData.purchasePrice,
                    purchaseDate: purchaseData.purchaseDate
                }
            );
            
            expect(result.success).toBe(true);
            
            const addedCargo = cargoManager.getAllCargo()[0];
            expect(addedCargo.purchaseLocation).toBe('Altdorf');
            expect(addedCargo.purchasePrice).toBe(300);
        });

        test('should support selling workflow integration', () => {
            // Add cargo first
            cargoManager.addCargo('Grain', 200, 'average');
            cargoManager.addCargo('Metal', 100, 'good');
            
            // Get cargo for selling
            const grainCargo = cargoManager.getCargoByType('Grain', 'average');
            expect(grainCargo).toHaveLength(1);
            
            // Simulate selling part of the cargo
            const sellQuantity = 75;
            const result = cargoManager.removeCargo(grainCargo[0].id, sellQuantity);
            
            expect(result.success).toBe(true);
            expect(cargoManager.getTotalCargoQuantity()).toBe(225); // 125 + 100
        });

        test('should handle quality modifications during transport', () => {
            cargoManager.addCargo('Grain', 100, 'average');
            
            const cargo = cargoManager.getAllCargo()[0];
            
            // Simulate quality improvement/degradation
            const result = cargoManager.modifyCargo(cargo.id, {
                quality: 'good',
                notes: 'Quality improved during careful transport'
            });
            
            expect(result.success).toBe(true);
            expect(result.updatedCargo.quality).toBe('good');
            expect(result.updatedCargo.notes).toContain('improved');
        });
    });

    describe('Error Handling Integration', () => {
        test('should handle data manager errors gracefully', () => {
            // Mock data manager to throw error
            mockDataManager.getCargoType.mockImplementation(() => {
                throw new Error('Data manager error');
            });
            
            const result = cargoManager.addCargo('Grain', 100, 'average');
            
            // Should still succeed despite data manager error
            expect(result.success).toBe(true);
        });

        test('should handle session storage errors gracefully', () => {
            // Mock session storage to throw error
            mockSessionStorage.setItem.mockImplementation(() => {
                throw new Error('Storage quota exceeded');
            });
            
            const result = cargoManager.addCargo('Grain', 100, 'average');
            
            // Should still succeed despite storage error
            expect(result.success).toBe(true);
        });

        test('should validate input across all operations', () => {
            // Test various invalid inputs
            expect(cargoManager.addCargo('', 100, 'average').success).toBe(false);
            expect(cargoManager.addCargo('Grain', -10, 'average').success).toBe(false);
            expect(cargoManager.addCargo('Grain', 100, 'invalid').success).toBe(false);
            
            expect(cargoManager.removeCargo('invalid-id', 10).success).toBe(false);
            expect(cargoManager.modifyCargo('invalid-id', {}).success).toBe(false);
        });
    });

    describe('Performance and Scalability', () => {
        test('should handle large cargo inventories efficiently', () => {
            const startTime = Date.now();
            
            // Add many cargo items
            for (let i = 0; i < 100; i++) {
                cargoManager.addCargo('Grain', 10, 'average');
                cargoManager.addCargo('Metal', 5, 'good');
            }
            
            const endTime = Date.now();
            const duration = endTime - startTime;
            
            // Should complete within reasonable time (less than 1 second)
            expect(duration).toBeLessThan(1000);
            
            // Verify all cargo was added correctly
            expect(cargoManager.getAllCargo()).toHaveLength(2); // Should merge same type/quality
            expect(cargoManager.getTotalCargoQuantity()).toBe(1500); // 100*10 + 100*5
        });

        test('should maintain performance with frequent operations', () => {
            // Add initial cargo
            cargoManager.addCargo('Grain', 1000, 'average');
            const cargo = cargoManager.getAllCargo()[0];
            
            const startTime = Date.now();
            
            // Perform many operations
            for (let i = 0; i < 50; i++) {
                cargoManager.removeCargo(cargo.id, 1);
                cargoManager.addCargo('Grain', 1, 'average');
            }
            
            const endTime = Date.now();
            const duration = endTime - startTime;
            
            // Should maintain reasonable performance
            expect(duration).toBeLessThan(500);
            expect(cargoManager.getTotalCargoQuantity()).toBe(1000);
        });
    });

    describe('Data Consistency', () => {
        test('should maintain data consistency across operations', () => {
            // Add various cargo types
            cargoManager.addCargo('Grain', 100, 'average');
            cargoManager.addCargo('Metal', 50, 'good');
            cargoManager.addCargo('Grain', 25, 'poor');
            
            // Verify totals are consistent
            const allCargo = cargoManager.getAllCargo();
            const totalFromItems = allCargo.reduce((sum, cargo) => sum + cargo.quantity, 0);
            const totalFromMethod = cargoManager.getTotalCargoQuantity();
            
            expect(totalFromItems).toBe(totalFromMethod);
            expect(totalFromMethod).toBe(175);
            
            // Verify summary is consistent
            const summary = cargoManager.getCargoSummary();
            const totalFromSummary = Object.values(summary).reduce((sum, item) => sum + item.quantity, 0);
            
            expect(totalFromSummary).toBe(totalFromMethod);
        });

        test('should maintain consistency after modifications', () => {
            cargoManager.addCargo('Grain', 100, 'average');
            cargoManager.addCargo('Metal', 50, 'good');
            
            const initialTotal = cargoManager.getTotalCargoQuantity();
            const grainCargo = cargoManager.getCargoByType('Grain')[0];
            
            // Modify quantity
            cargoManager.modifyCargo(grainCargo.id, { quantity: 150 });
            
            const newTotal = cargoManager.getTotalCargoQuantity();
            expect(newTotal).toBe(initialTotal + 50); // 100 -> 150, so +50
            
            // Remove some cargo
            cargoManager.removeCargo(grainCargo.id, 25);
            
            const finalTotal = cargoManager.getTotalCargoQuantity();
            expect(finalTotal).toBe(newTotal - 25);
        });
    });
});