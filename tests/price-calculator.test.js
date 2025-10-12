/**
 * Trading Places Module - Price Calculator Tests
 * Comprehensive tests for the PriceCalculator component
 */

const { PriceCalculator } = require('../scripts/price-calculator.js');

// Mock DataManager for testing
class MockDataManager {
    constructor() {
        this.cargoTypes = [
            {
                name: 'Grain',
                category: 'Bulk Goods',
                basePrices: {
                    spring: 1,
                    summer: 0.5,
                    autumn: 0.25,
                    winter: 0.5
                }
            },
            {
                name: 'Wine',
                category: 'Luxury Goods',
                basePrices: {
                    spring: 15,
                    summer: 15,
                    autumn: 15,
                    winter: 15
                },
                qualityTiers: {
                    poor: 0.5,
                    average: 1.0,
                    good: 2.0,
                    excellent: 4.0
                }
            },
            {
                name: 'Luxuries',
                category: 'Luxury Goods',
                basePrices: {
                    spring: 50,
                    summer: 50,
                    autumn: 50,
                    winter: 50
                }
            }
        ];
    }

    getSeasonalPrice(cargo, season, quality = 'average') {
        if (!cargo.basePrices[season]) {
            throw new Error(`No price data for season: ${season}`);
        }

        let basePrice = cargo.basePrices[season];

        if (cargo.qualityTiers && cargo.qualityTiers[quality]) {
            basePrice *= cargo.qualityTiers[quality];
        }

        return basePrice;
    }

    getSettlementProperties(settlement) {
        const sizeMap = { 'CS': 4, 'C': 3, 'T': 2, 'ST': 1, 'V': 1, 'F': 1, 'M': 1 };
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

// Mock TradingEngine for testing
class MockTradingEngine {
    constructor() {
        this.currentSeason = 'spring';
    }

    getCurrentSeason() {
        return this.currentSeason;
    }
}

// Mock Logger for testing
class MockLogger {
    constructor() {
        this.logs = [];
    }

    logDiceRoll(title, formula, modifiers, result, target, success, explanation) {
        this.logs.push({ type: 'diceRoll', title, formula, modifiers, result, target, success, explanation });
    }

    logCalculation(title, formula, inputs, result, explanation) {
        this.logs.push({ type: 'calculation', title, formula, inputs, result, explanation });
    }

    logDecision(title, decision, context, options, reasoning) {
        this.logs.push({ type: 'decision', title, decision, context, options, reasoning });
    }

    logAlgorithmStep(algorithm, step, description, context, reference) {
        this.logs.push({ type: 'algorithmStep', algorithm, step, description, context, reference });
    }

    logSystem(title, message, data, level = 'INFO') {
        this.logs.push({ type: 'system', title, message, data, level });
    }

    getLastLog() {
        return this.logs[this.logs.length - 1];
    }

    getLogsByType(type) {
        return this.logs.filter(log => log.type === type);
    }

    clear() {
        this.logs = [];
    }
}

describe('PriceCalculator', () => {
    let priceCalculator;
    let mockDataManager;
    let mockTradingEngine;
    let mockLogger;

    beforeEach(() => {
        mockDataManager = new MockDataManager();
        mockTradingEngine = new MockTradingEngine();
        mockLogger = new MockLogger();
        
        priceCalculator = new PriceCalculator(mockDataManager, mockTradingEngine);
        priceCalculator.setLogger(mockLogger);
    });

    describe('calculateBuyingPriceBreakdown', () => {
        test('should calculate basic buying price correctly', () => {
            const result = priceCalculator.calculateBuyingPriceBreakdown('Grain', 100, 'spring');

            expect(result.cargoType).toBe('Grain');
            expect(result.season).toBe('spring');
            expect(result.quantity).toBe(100);
            expect(result.totalUnits).toBe(10); // 100 EP / 10 = 10 units
            expect(result.basePricePerUnit).toBe(1); // Spring grain price
            expect(result.finalPricePerUnit).toBe(1); // No modifiers
            expect(result.totalPrice).toBe(10); // 10 units × 1 GC = 10 GC
            expect(result.calculationType).toBe('buying');
        });

        test('should apply partial purchase penalty correctly', () => {
            const result = priceCalculator.calculateBuyingPriceBreakdown('Grain', 50, 'spring', {
                isPartialPurchase: true
            });

            expect(result.basePricePerUnit).toBe(1);
            expect(result.finalPricePerUnit).toBe(1.1); // 1 + (1 × 0.1) = 1.1
            expect(result.totalPrice).toBe(5.5); // 5 units × 1.1 GC = 5.5 GC
            expect(result.modifiers).toHaveLength(1);
            expect(result.modifiers[0].type).toBe('partial_purchase');
            expect(result.modifiers[0].percentage).toBe(10);
        });

        test('should apply successful haggle result correctly', () => {
            const haggleResult = {
                success: true,
                hasDealmakertTalent: false
            };

            const result = priceCalculator.calculateBuyingPriceBreakdown('Grain', 100, 'spring', {
                haggleResult
            });

            expect(result.finalPricePerUnit).toBe(0.9); // 1 - (1 × 0.1) = 0.9
            expect(result.totalPrice).toBe(9); // 10 units × 0.9 GC = 9 GC
            expect(result.modifiers).toHaveLength(1);
            expect(result.modifiers[0].type).toBe('haggle');
            expect(result.modifiers[0].percentage).toBe(-10);
        });

        test('should apply Dealmaker talent haggle correctly', () => {
            const haggleResult = {
                success: true,
                hasDealmakertTalent: true
            };

            const result = priceCalculator.calculateBuyingPriceBreakdown('Grain', 100, 'spring', {
                haggleResult
            });

            expect(result.finalPricePerUnit).toBe(0.8); // 1 - (1 × 0.2) = 0.8
            expect(result.totalPrice).toBe(8); // 10 units × 0.8 GC = 8 GC
            expect(result.modifiers[0].percentage).toBe(-20);
        });

        test('should handle quality tiers for wine', () => {
            const result = priceCalculator.calculateBuyingPriceBreakdown('Wine', 50, 'spring', {
                quality: 'excellent'
            });

            expect(result.basePricePerUnit).toBe(60); // 15 × 4.0 = 60
            expect(result.quality).toBe('excellent');
        });

        test('should include seasonal comparison', () => {
            const result = priceCalculator.calculateBuyingPriceBreakdown('Grain', 100, 'spring');

            expect(result.seasonalComparison).toBeDefined();
            expect(result.seasonalComparison.prices).toEqual({
                spring: 1,
                summer: 0.5,
                autumn: 0.25,
                winter: 0.5
            });
            expect(result.seasonalComparison.bestBuyingSeason).toBe('autumn'); // Lowest price
            expect(result.seasonalComparison.bestSellingSeason).toBe('spring'); // Highest price
        });

        test('should include haggle outcomes', () => {
            const result = priceCalculator.calculateBuyingPriceBreakdown('Grain', 100, 'spring');

            expect(result.haggleOutcomes).toBeDefined();
            expect(result.haggleOutcomes.noHaggle.pricePerUnit).toBe(1);
            expect(result.haggleOutcomes.successfulHaggle.pricePerUnit).toBe(0.9);
            expect(result.haggleOutcomes.successfulHaggleWithDealmaker.pricePerUnit).toBe(0.8);
        });
    });

    describe('calculateSellingPriceBreakdown', () => {
        const mockSettlement = {
            name: 'Altdorf',
            region: 'Reikland',
            size: 'CS',
            wealth: 5,
            source: ['Trade', 'Government']
        };

        test('should calculate basic selling price correctly', () => {
            const result = priceCalculator.calculateSellingPriceBreakdown('Grain', 100, 'spring', mockSettlement);

            expect(result.cargoType).toBe('Grain');
            expect(result.season).toBe('spring');
            expect(result.quantity).toBe(100);
            expect(result.basePricePerUnit).toBe(1); // Spring grain price
            expect(result.wealthAdjustedPrice).toBe(1.1); // 1 × 1.1 (Prosperous wealth modifier)
            expect(result.finalPricePerUnit).toBe(1.1);
            expect(result.totalPrice).toBe(11); // 10 units × 1.1 GC = 11 GC
            expect(result.calculationType).toBe('selling');
        });

        test('should apply wealth modifiers correctly', () => {
            const poorSettlement = { ...mockSettlement, wealth: 2 };
            const result = priceCalculator.calculateSellingPriceBreakdown('Grain', 100, 'spring', poorSettlement);

            expect(result.wealthAdjustedPrice).toBe(0.8); // 1 × 0.8 (Poor wealth modifier)
            expect(result.totalPrice).toBe(8); // 10 units × 0.8 GC = 8 GC
            expect(result.modifiers[0].type).toBe('wealth_adjustment');
        });

        test('should apply successful selling haggle correctly', () => {
            const haggleResult = {
                success: true,
                hasDealmakertTalent: false
            };

            const result = priceCalculator.calculateSellingPriceBreakdown('Grain', 100, 'spring', mockSettlement, {
                haggleResult
            });

            // Base: 1, Wealth adjusted: 1.1, Haggle: +10% = 1.21
            expect(result.finalPricePerUnit).toBeCloseTo(1.21, 2);
            expect(result.totalPrice).toBeCloseTo(12.1, 1);
            expect(result.modifiers).toHaveLength(2); // Wealth + Haggle
            expect(result.modifiers[1].type).toBe('haggle');
            expect(result.modifiers[1].percentage).toBe(10);
        });
    });

    describe('calculateSeasonalComparison', () => {
        test('should calculate seasonal comparison correctly', () => {
            const result = priceCalculator.calculateSeasonalComparison('Grain');

            expect(result.cargoType).toBe('Grain');
            expect(result.prices).toEqual({
                spring: 1,
                summer: 0.5,
                autumn: 0.25,
                winter: 0.5
            });
            expect(result.bestBuyingSeason).toBe('autumn');
            expect(result.bestSellingSeason).toBe('spring');
            expect(result.priceRange.min).toBe(0.25);
            expect(result.priceRange.max).toBe(1);
            expect(result.priceRange.difference).toBe(0.75);
            expect(result.priceRange.percentageVariation).toBe(300); // (1-0.25)/0.25 * 100
        });
    });

    describe('calculateHaggleOutcomes', () => {
        test('should calculate buying haggle outcomes correctly', () => {
            const result = priceCalculator.calculateHaggleOutcomes(10, 'buying');

            expect(result.noHaggle.pricePerUnit).toBe(10);
            expect(result.successfulHaggle.pricePerUnit).toBe(9); // -10%
            expect(result.successfulHaggle.percentage).toBe(-10);
            expect(result.successfulHaggleWithDealmaker.pricePerUnit).toBe(8); // -20%
            expect(result.successfulHaggleWithDealmaker.percentage).toBe(-20);
        });

        test('should calculate selling haggle outcomes correctly', () => {
            const result = priceCalculator.calculateHaggleOutcomes(10, 'selling');

            expect(result.noHaggle.pricePerUnit).toBe(10);
            expect(result.successfulHaggle.pricePerUnit).toBe(11); // +10%
            expect(result.successfulHaggle.percentage).toBe(10);
            expect(result.successfulHaggleWithDealmaker.pricePerUnit).toBe(12); // +20%
            expect(result.successfulHaggleWithDealmaker.percentage).toBe(20);
        });
    });

    describe('calculateSpecialSalePrice', () => {
        test('should calculate desperate sale price correctly', () => {
            const result = priceCalculator.calculateSpecialSalePrice('Grain', 100, 'spring', 'desperate');

            expect(result.basePricePerUnit).toBe(1);
            expect(result.specialPricePerUnit).toBe(0.5); // 50% of base price
            expect(result.totalPrice).toBe(5); // 10 units × 0.5 GC = 5 GC
            expect(result.saleType).toBe('desperate');
            expect(result.calculationType).toBe('special_sale');
            expect(result.modifiers[0].percentage).toBe(-50);
        });

        test('should calculate rumor sale price correctly', () => {
            const result = priceCalculator.calculateSpecialSalePrice('Grain', 100, 'spring', 'rumor');

            expect(result.basePricePerUnit).toBe(1);
            expect(result.specialPricePerUnit).toBe(2); // 200% of base price
            expect(result.totalPrice).toBe(20); // 10 units × 2 GC = 20 GC
            expect(result.saleType).toBe('rumor');
            expect(result.modifiers[0].percentage).toBe(100);
        });
    });

    describe('generatePriceDisplayData', () => {
        test('should format price display data correctly', () => {
            const priceBreakdown = priceCalculator.calculateBuyingPriceBreakdown('Grain', 100, 'spring');
            const displayData = priceCalculator.generatePriceDisplayData(priceBreakdown);

            expect(displayData.cargoType).toBe('Grain');
            expect(displayData.formattedPrices.basePrice).toBe('1 GC per 10 EP');
            expect(displayData.formattedPrices.finalPrice).toBe('1 GC per 10 EP');
            expect(displayData.formattedPrices.totalPrice).toBe('10 GC total');
            expect(displayData.formattedPrices.quantityDescription).toBe('100 EP (10 units)');
        });
    });

    describe('error handling', () => {
        test('should throw error for invalid cargo type', () => {
            expect(() => {
                priceCalculator.calculateBuyingPriceBreakdown('InvalidCargo', 100, 'spring');
            }).toThrow('Cargo type not found: InvalidCargo');
        });

        test('should throw error for missing parameters', () => {
            expect(() => {
                priceCalculator.calculateBuyingPriceBreakdown('', 100, 'spring');
            }).toThrow('Cargo type and season are required');
        });

        test('should throw error for invalid special sale type', () => {
            expect(() => {
                priceCalculator.calculateSpecialSalePrice('Grain', 100, 'spring', 'invalid');
            }).toThrow('Sale type must be "desperate" or "rumor"');
        });
    });

    describe('logging', () => {
        test('should log algorithm steps', () => {
            priceCalculator.calculateBuyingPriceBreakdown('Grain', 100, 'spring');

            const algorithmLogs = mockLogger.getLogsByType('algorithmStep');
            expect(algorithmLogs.length).toBeGreaterThan(0);
            expect(algorithmLogs[0].algorithm).toBe('Price Calculator');
        });

        test('should log calculations', () => {
            priceCalculator.calculateBuyingPriceBreakdown('Grain', 100, 'spring');

            const calculationLogs = mockLogger.getLogsByType('calculation');
            expect(calculationLogs.length).toBeGreaterThan(0);
            expect(calculationLogs.some(log => log.title === 'Base Seasonal Price')).toBe(true);
        });

        test('should log system messages', () => {
            const priceBreakdown = priceCalculator.calculateBuyingPriceBreakdown('Grain', 100, 'spring');
            priceCalculator.generatePriceDisplayData(priceBreakdown);

            const systemLogs = mockLogger.getLogsByType('system');
            expect(systemLogs.length).toBeGreaterThan(0);
        });
    });
});