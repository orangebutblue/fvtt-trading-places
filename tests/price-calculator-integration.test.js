/**
 * Trading Places Module - Price Calculator Integration Tests
 * Tests integration between PriceCalculator and existing components
 */

const { PriceCalculator } = require('../scripts/price-calculator.js');

// Mock the existing components for integration testing
class MockDataManager {
    constructor() {
        this.cargoTypes = [
            {
                name: 'Grain',
                category: 'Bulk Goods',
                basePrices: { spring: 1, summer: 0.5, autumn: 0.25, winter: 0.5 },
                encumbrancePerUnit: 10
            }
        ];
    }

    getSeasonalPrice(cargo, season, quality = 'average') {
        return cargo.basePrices[season] || 1;
    }

    getSettlementProperties(settlement) {
        const sizeMap = { 'CS': 4, 'C': 3, 'T': 2, 'ST': 1, 'V': 1 };
        const wealthModifiers = { 1: 0.5, 2: 0.8, 3: 1.0, 4: 1.05, 5: 1.1 };
        const wealthDescriptions = { 1: 'Squalid', 2: 'Poor', 3: 'Average', 4: 'Bustling', 5: 'Prosperous' };

        return {
            name: settlement.name,
            region: settlement.region,
            sizeNumeric: sizeMap[settlement.size] || 1,
            wealthRating: settlement.wealth,
            wealthModifier: wealthModifiers[settlement.wealth] || 1.0,
            wealthDescription: wealthDescriptions[settlement.wealth] || 'Average',
            productionCategories: settlement.source || []
        };
    }
}

class MockTradingEngine {
    constructor() {
        this.currentSeason = 'spring';
    }

    getCurrentSeason() {
        return this.currentSeason;
    }

    validateSettlementForTrading(settlement) {
        return { valid: true, errors: [] };
    }
}

class MockLogger {
    constructor() {
        this.logs = [];
    }

    logDiceRoll() { this.logs.push({ type: 'diceRoll' }); }
    logCalculation() { this.logs.push({ type: 'calculation' }); }
    logDecision() { this.logs.push({ type: 'decision' }); }
    logAlgorithmStep() { this.logs.push({ type: 'algorithmStep' }); }
    logSystem() { this.logs.push({ type: 'system' }); }
}

describe('PriceCalculator Integration', () => {
    let priceCalculator;
    let dataManager;
    let tradingEngine;
    let logger;

    beforeEach(() => {
        dataManager = new MockDataManager();
        tradingEngine = new MockTradingEngine();
        logger = new MockLogger();
        
        priceCalculator = new PriceCalculator(dataManager, tradingEngine);
        priceCalculator.setLogger(logger);
    });

    describe('Integration with DataManager', () => {
        test('should use DataManager for cargo type lookup', () => {
            const result = priceCalculator.calculateBuyingPriceBreakdown('Grain', 100, 'spring');
            
            expect(result.cargoType).toBe('Grain');
            expect(result.basePricePerUnit).toBe(1); // Spring grain price from DataManager
        });

        test('should use DataManager for seasonal price calculation', () => {
            const comparison = priceCalculator.calculateSeasonalComparison('Grain');
            
            expect(comparison.prices.spring).toBe(1);
            expect(comparison.prices.summer).toBe(0.5);
            expect(comparison.prices.autumn).toBe(0.25);
            expect(comparison.prices.winter).toBe(0.5);
        });

        test('should use DataManager for settlement properties', () => {
            const settlement = {
                name: 'Altdorf',
                region: 'Reikland',
                size: 'CS',
                wealth: 5,
                source: ['Trade']
            };

            const result = priceCalculator.calculateSellingPriceBreakdown('Grain', 100, 'spring', settlement);
            
            expect(result.settlement).toBe('Altdorf');
            expect(result.settlementInfo.wealthRating).toBe(5);
            expect(result.settlementInfo.wealthModifier).toBe(1.1);
        });
    });

    describe('Integration with TradingEngine', () => {
        test('should use TradingEngine for current season', () => {
            tradingEngine.currentSeason = 'autumn';
            
            const result = priceCalculator.calculateBuyingPriceBreakdown('Grain', 100, tradingEngine.getCurrentSeason());
            
            expect(result.season).toBe('autumn');
            expect(result.basePricePerUnit).toBe(0.25); // Autumn grain price
        });
    });

    describe('Integration with Logger', () => {
        test('should log algorithm steps', () => {
            priceCalculator.calculateBuyingPriceBreakdown('Grain', 100, 'spring');
            
            const algorithmLogs = logger.logs.filter(log => log.type === 'algorithmStep');
            expect(algorithmLogs.length).toBeGreaterThan(0);
        });

        test('should log calculations', () => {
            priceCalculator.calculateBuyingPriceBreakdown('Grain', 100, 'spring');
            
            const calculationLogs = logger.logs.filter(log => log.type === 'calculation');
            expect(calculationLogs.length).toBeGreaterThan(0);
        });
    });

    describe('Template Integration', () => {
        test('should generate display data compatible with Handlebars template', () => {
            const priceBreakdown = priceCalculator.calculateBuyingPriceBreakdown('Grain', 100, 'spring');
            const displayData = priceCalculator.generatePriceDisplayData(priceBreakdown);
            
            // Check that all required template fields are present
            expect(displayData.cargoType).toBeDefined();
            expect(displayData.season).toBeDefined();
            expect(displayData.quantity).toBeDefined();
            expect(displayData.formattedPrices).toBeDefined();
            expect(displayData.formattedPrices.basePrice).toBeDefined();
            expect(displayData.formattedPrices.finalPrice).toBeDefined();
            expect(displayData.formattedPrices.totalPrice).toBeDefined();
            expect(displayData.formattedPrices.quantityDescription).toBeDefined();
            expect(displayData.seasonalComparison).toBeDefined();
            expect(displayData.haggleOutcomes).toBeDefined();
        });

        test('should format prices correctly for display', () => {
            const priceBreakdown = priceCalculator.calculateBuyingPriceBreakdown('Grain', 100, 'spring');
            const displayData = priceCalculator.generatePriceDisplayData(priceBreakdown);
            
            expect(displayData.formattedPrices.basePrice).toBe('1 GC per 10 EP');
            expect(displayData.formattedPrices.finalPrice).toBe('1 GC per 10 EP');
            expect(displayData.formattedPrices.totalPrice).toBe('10 GC total');
            expect(displayData.formattedPrices.quantityDescription).toBe('100 EP (10 units)');
        });
    });

    describe('Error Handling Integration', () => {
        test('should handle invalid cargo types gracefully', () => {
            expect(() => {
                priceCalculator.calculateBuyingPriceBreakdown('InvalidCargo', 100, 'spring');
            }).toThrow('Cargo type not found: InvalidCargo');
        });

        test('should handle missing season gracefully', () => {
            expect(() => {
                priceCalculator.calculateBuyingPriceBreakdown('Grain', 100, '');
            }).toThrow('Cargo type and season are required');
        });

        test('should handle invalid settlement gracefully', () => {
            expect(() => {
                priceCalculator.calculateSellingPriceBreakdown('Grain', 100, 'spring', null);
            }).toThrow('Cargo type, season, and settlement are required');
        });
    });

    describe('Performance Integration', () => {
        test('should handle large quantities efficiently', () => {
            const startTime = Date.now();
            
            const result = priceCalculator.calculateBuyingPriceBreakdown('Grain', 10000, 'spring');
            
            const endTime = Date.now();
            const executionTime = endTime - startTime;
            
            expect(executionTime).toBeLessThan(100); // Should complete in under 100ms
            expect(result.quantity).toBe(10000);
            expect(result.totalUnits).toBe(1000);
        });

        test('should handle multiple calculations efficiently', () => {
            const startTime = Date.now();
            
            for (let i = 0; i < 100; i++) {
                priceCalculator.calculateBuyingPriceBreakdown('Grain', 100, 'spring');
            }
            
            const endTime = Date.now();
            const executionTime = endTime - startTime;
            
            expect(executionTime).toBeLessThan(1000); // Should complete 100 calculations in under 1 second
        });
    });
});