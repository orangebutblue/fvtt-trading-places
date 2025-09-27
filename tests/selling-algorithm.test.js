/**
 * Trading Places Module - WFRP Selling Algorithm Tests
 * Comprehensive test suite for the selling algorithm implementation
 */

const { WFRPSellingAlgorithm } = require('../scripts/selling-algorithm.js');

// Mock DataManager for testing
class MockDataManager {
    constructor() {
        this.cargoTypes = [
            {
                name: 'Grain',
                basePrices: { Spring: 2, Summer: 3, Autumn: 2, Winter: 4 },
                encumbrancePerUnit: 1
            },
            {
                name: 'Wine',
                basePrices: { Spring: 8, Summer: 10, Autumn: 12, Winter: 8 },
                encumbrancePerUnit: 1
            },
            {
                name: 'Cloth',
                basePrices: { Spring: 6, Summer: 6, Autumn: 7, Winter: 8 },
                encumbrancePerUnit: 1
            }
        ];
    }

    validateSettlement(settlement) {
        return { valid: true, errors: [] };
    }

    getSettlementProperties(settlement) {
        const sizeMap = { 'CS': 4, 'C': 3, 'T': 2, 'ST': 1, 'V': 1, 'F': 1, 'M': 1 };
        const wealthModifiers = { 1: 0.50, 2: 0.80, 3: 1.00, 4: 1.05, 5: 1.10 };
        
        return {
            name: settlement.name,
            region: settlement.region,
            sizeEnum: settlement.size,
            sizeNumeric: sizeMap[settlement.size] || 1,
            sizeDescription: settlement.size,
            wealthRating: settlement.wealth,
            wealthModifier: wealthModifiers[settlement.wealth] || 1.0,
            wealthDescription: `Wealth ${settlement.wealth}`,
            population: settlement.population,
            productionCategories: settlement.source,
            garrison: settlement.garrison,
            ruler: settlement.ruler,
            notes: settlement.notes
        };
    }

    getSeasonalPrice(cargo, season, quality = 'average') {
        return cargo.basePrices[season] || 2;
    }
}

// Mock TradingEngine for testing
class MockTradingEngine {
    constructor() {
        this.currentSeason = 'Spring';
    }
}

// Mock Logger for testing
class MockLogger {
    constructor() {
        this.logs = [];
    }

    logDiceRoll(title, formula, modifiers, result, target, success, reason) {
        this.logs.push({ type: 'dice', title, formula, modifiers, result, target, success, reason });
    }

    logCalculation(title, formula, inputs, result, description) {
        this.logs.push({ type: 'calculation', title, formula, inputs, result, description });
    }

    logDecision(title, decision, context, options, reasoning) {
        this.logs.push({ type: 'decision', title, decision, context, options, reasoning });
    }

    logAlgorithmStep(algorithm, step, title, context, reference) {
        this.logs.push({ type: 'algorithm', algorithm, step, title, context, reference });
    }

    logSystem(category, message, data, level = 'INFO') {
        this.logs.push({ type: 'system', category, message, data, level });
    }

    clear() {
        this.logs = [];
    }
}

describe('WFRPSellingAlgorithm', () => {
    let algorithm;
    let mockDataManager;
    let mockTradingEngine;
    let mockLogger;

    // Test settlements
    const testSettlements = {
        altdorf: {
            name: 'ALTDORF',
            region: 'Reikland',
            size: 'CS',
            wealth: 5,
            population: 105000,
            source: ['Trade', 'Government'],
            garrison: ['500a/8000c'],
            ruler: 'Emperor Karl-Franz I',
            notes: 'Imperial Capital'
        },
        village: {
            name: 'Kleinburg',
            region: 'Reikland',
            size: 'V',
            wealth: 2,
            population: 150,
            source: ['Agriculture'],
            garrison: ['None'],
            ruler: 'Village Elder',
            notes: 'Small farming village'
        },
        tradeCenter: {
            name: 'Marienburg',
            region: 'Wasteland',
            size: 'C',
            wealth: 4,
            population: 50000,
            source: ['Trade'],
            garrison: ['1000a/5000c'],
            ruler: 'Merchant Council',
            notes: 'Major trade hub'
        },
        normalTown: {
            name: 'Grunburg',
            region: 'Stirland',
            size: 'T',
            wealth: 3,
            population: 2500,
            source: ['Agriculture', 'Livestock'],
            garrison: ['50a/200c'],
            ruler: 'Baron von Grunburg',
            notes: 'Agricultural town'
        }
    };

    beforeEach(() => {
        mockDataManager = new MockDataManager();
        mockTradingEngine = new MockTradingEngine();
        mockLogger = new MockLogger();
        
        algorithm = new WFRPSellingAlgorithm(mockDataManager, mockTradingEngine);
        algorithm.setLogger(mockLogger);
    });

    describe('Constructor and Setup', () => {
        test('should initialize with required dependencies', () => {
            expect(algorithm.dataManager).toBe(mockDataManager);
            expect(algorithm.tradingEngine).toBe(mockTradingEngine);
            expect(algorithm.logger).toBe(mockLogger);
        });

        test('should provide no-op logger when none set', () => {
            const alg = new WFRPSellingAlgorithm(mockDataManager, mockTradingEngine);
            const logger = alg.getLogger();
            
            // Should not throw when calling logger methods
            expect(() => {
                logger.logDiceRoll('test', '1d100', [], 50, 60, true, 'test');
                logger.logCalculation('test', 'formula', {}, 10, 'test');
                logger.logDecision('test', 'decision', {}, [], 'test');
                logger.logAlgorithmStep('test', '1', 'title', {}, 'ref');
                logger.logSystem('test', 'message', {});
            }).not.toThrow();
        });
    });

    describe('Step 1: Selling Eligibility Checks', () => {
        test('should allow selling when no restrictions apply', () => {
            const result = algorithm.checkSellingEligibility(
                testSettlements.altdorf,
                'Grain',
                { purchaseLocation: 'Marienburg', purchaseDate: '2025-01-01' }
            );

            expect(result.canSell).toBe(true);
            expect(result.restrictions).toHaveLength(0);
            expect(result.eligibilityChecks).toHaveLength(2);
            expect(result.eligibilityChecks[0].passed).toBe(true); // Location check
            expect(result.eligibilityChecks[1].passed).toBe(true); // Time check
        });

        test('should prevent selling at same location where purchased', () => {
            const result = algorithm.checkSellingEligibility(
                testSettlements.altdorf,
                'Grain',
                { purchaseLocation: 'ALTDORF', purchaseDate: '2025-01-01' }
            );

            expect(result.canSell).toBe(false);
            expect(result.restrictions).toHaveLength(1);
            expect(result.restrictions[0].type).toBe('same_location');
            expect(result.eligibilityChecks[0].passed).toBe(false);
        });

        test('should enforce one week waiting period at same location', () => {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            
            const result = algorithm.checkSellingEligibility(
                testSettlements.altdorf,
                'Grain',
                { 
                    purchaseLocation: 'ALTDORF', 
                    purchaseDate: yesterday.toISOString().split('T')[0]
                }
            );

            expect(result.canSell).toBe(false);
            expect(result.restrictions.some(r => r.type === 'waiting_period')).toBe(true);
        });

        test('should allow selling after one week waiting period', () => {
            const eightDaysAgo = new Date();
            eightDaysAgo.setDate(eightDaysAgo.getDate() - 8);
            
            const result = algorithm.checkSellingEligibility(
                testSettlements.altdorf,
                'Grain',
                { 
                    purchaseLocation: 'Marienburg', // Different location, no restriction
                    purchaseDate: eightDaysAgo.toISOString().split('T')[0]
                }
            );

            expect(result.canSell).toBe(true);
            expect(result.restrictions).toHaveLength(0);
        });

        test('should log eligibility decision correctly', () => {
            algorithm.checkSellingEligibility(testSettlements.altdorf, 'Grain', {});
            
            const algorithmLogs = mockLogger.logs.filter(log => log.type === 'algorithm');
            const decisionLogs = mockLogger.logs.filter(log => log.type === 'decision');
            
            expect(algorithmLogs).toHaveLength(1);
            expect(algorithmLogs[0].step).toBe('Step 1');
            expect(decisionLogs).toHaveLength(1);
            expect(decisionLogs[0].title).toBe('Selling Eligibility');
        });
    });

    describe('Step 2: Buyer Availability', () => {
        test('should calculate buyer chance correctly for normal settlement', async () => {
            const mockRoll = () => 50;
            
            const result = await algorithm.findBuyer(
                testSettlements.normalTown,
                'Grain',
                100,
                mockRoll
            );

            // Normal town: Size 2 × 10 = 20%
            expect(result.chance).toBe(20);
            expect(result.roll).toBe(50);
            expect(result.buyerFound).toBe(false); // 50 > 20
        });

        test('should apply trade bonus correctly', async () => {
            const mockRoll = () => 40;
            
            const result = await algorithm.findBuyer(
                testSettlements.tradeCenter,
                'Grain',
                100,
                mockRoll
            );

            // Trade center: Size 3 × 10 + 30 = 60%
            expect(result.chance).toBe(60);
            expect(result.roll).toBe(40);
            expect(result.buyerFound).toBe(true); // 40 ≤ 60
            expect(result.modifiers).toHaveLength(1);
            expect(result.modifiers[0].type).toBe('trade_bonus');
        });

        test('should cap buyer chance at 100%', async () => {
            const mockRoll = () => 50;
            
            const result = await algorithm.findBuyer(
                testSettlements.altdorf,
                'Grain',
                100,
                mockRoll
            );

            // Altdorf: Size 4 × 10 + 30 = 70% (under cap)
            expect(result.chance).toBe(70);
        });

        test('should log buyer search correctly', async () => {
            const mockRoll = () => 30;
            
            await algorithm.findBuyer(testSettlements.tradeCenter, 'Grain', 100, mockRoll);
            
            const calculationLogs = mockLogger.logs.filter(log => log.type === 'calculation');
            const diceLogs = mockLogger.logs.filter(log => log.type === 'dice');
            const decisionLogs = mockLogger.logs.filter(log => log.type === 'decision');
            
            expect(calculationLogs.some(log => log.title === 'Buyer Availability Chance')).toBe(true);
            expect(diceLogs.some(log => log.title === 'Buyer Availability Check')).toBe(true);
            expect(decisionLogs.some(log => log.title === 'Buyer Search')).toBe(true);
        });
    });

    describe('Village Special Case Handling', () => {
        test('should return null for non-village settlements', async () => {
            const result = await algorithm.handleVillageSelling(
                testSettlements.normalTown,
                'Grain',
                'Spring',
                100
            );

            expect(result).toBeNull();
        });

        test('should allow normal grain sales in villages during Spring', async () => {
            const result = await algorithm.handleVillageSelling(
                testSettlements.village,
                'Grain',
                'Spring',
                100
            );

            expect(result).toBeNull(); // Use normal rules
        });

        test('should limit sales in villages for non-grain or non-Spring', async () => {
            const mockRoll = () => 55; // Should give 6 EP (55 % 10 + 1 = 6)
            
            const result = await algorithm.handleVillageSelling(
                testSettlements.village,
                'Wine',
                'Summer',
                100,
                mockRoll
            );

            expect(result).not.toBeNull();
            expect(result.isVillageSpecialCase).toBe(true);
            expect(result.maxSellableEP).toBe(6);
            expect(result.canSellQuantity).toBe(6); // Min of 100 and 6
            expect(result.buyerFound).toBe(true);
        });

        test('should handle zero demand in villages', async () => {
            const mockRoll = () => 10; // Should give 1 EP (10 % 10 + 1 = 1)
            
            const result = await algorithm.handleVillageSelling(
                testSettlements.village,
                'Wine',
                'Summer',
                100,
                mockRoll
            );

            expect(result.maxSellableEP).toBe(1);
            expect(result.buyerFound).toBe(true);
        });
    });

    describe('Step 3: Offer Price Calculation', () => {
        test('should calculate base offer price correctly', () => {
            const result = algorithm.calculateOfferPrice(
                'Grain',
                testSettlements.normalTown,
                'Spring',
                100
            );

            // Grain Spring price: 2 GC, Normal town wealth 3 (1.0 modifier)
            expect(result.basePricePerTenEP).toBe(2);
            expect(result.wealthModifier).toBe(1.0);
            expect(result.adjustedPricePerTenEP).toBe(2);
            expect(result.totalUnits).toBe(10); // 100 EP = 10 units of 10 EP
            expect(result.totalOffer).toBe(20); // 10 units × 2 GC
        });

        test('should apply wealth modifiers correctly', () => {
            // Test squalid settlement (wealth 1, 0.5 modifier)
            const squalidSettlement = { ...testSettlements.village, wealth: 1 };
            
            const result = algorithm.calculateOfferPrice(
                'Wine',
                squalidSettlement,
                'Summer',
                50
            );

            // Wine Summer price: 10 GC, Squalid wealth (0.5 modifier)
            expect(result.basePricePerTenEP).toBe(10);
            expect(result.wealthModifier).toBe(0.5);
            expect(result.adjustedPricePerTenEP).toBe(5); // 10 × 0.5
            expect(result.totalUnits).toBe(5); // 50 EP = 5 units
            expect(result.totalOffer).toBe(25); // 5 units × 5 GC
        });

        test('should handle prosperous settlements', () => {
            const result = algorithm.calculateOfferPrice(
                'Cloth',
                testSettlements.altdorf,
                'Winter',
                30
            );

            // Cloth Winter price: 8 GC, Prosperous wealth 5 (1.1 modifier)
            expect(result.basePricePerTenEP).toBe(8);
            expect(result.wealthModifier).toBe(1.1);
            expect(result.adjustedPricePerTenEP).toBe(8.8); // 8 × 1.1
            expect(result.totalUnits).toBe(3); // 30 EP = 3 units
            expect(result.totalOffer).toBe(26.4); // 3 units × 8.8 GC
        });

        test('should throw error for invalid cargo type', () => {
            expect(() => {
                algorithm.calculateOfferPrice(
                    'InvalidCargo',
                    testSettlements.normalTown,
                    'Spring',
                    100
                );
            }).toThrow('Cargo type not found: InvalidCargo');
        });

        test('should log price calculation steps', () => {
            algorithm.calculateOfferPrice('Grain', testSettlements.normalTown, 'Spring', 100);
            
            const calculationLogs = mockLogger.logs.filter(log => log.type === 'calculation');
            
            expect(calculationLogs.some(log => log.title === 'Base Seasonal Price')).toBe(true);
            expect(calculationLogs.some(log => log.title === 'Wealth-Adjusted Offer Price')).toBe(true);
            expect(calculationLogs.some(log => log.title === 'Total Offer Price')).toBe(true);
        });
    });

    describe('Step 4: Haggling Application', () => {
        let baseOffer;

        beforeEach(() => {
            baseOffer = algorithm.calculateOfferPrice(
                'Grain',
                testSettlements.normalTown,
                'Spring',
                100
            );
        });

        test('should increase price on successful haggle', () => {
            const haggleResult = { success: true, hasDealmakertTalent: false };
            
            const result = algorithm.applyHaggling(baseOffer, haggleResult);

            // Should increase by 10%
            expect(result.adjustedPricePerTenEP).toBe(2.2); // 2 × 1.1
            expect(result.totalOffer).toBe(22); // 10 units × 2.2
            expect(result.haggleModifier).toBe(0.2); // 10% of 2
            expect(result.haggleDescription).toBe('Successful haggle (+10%)');
        });

        test('should increase price more with Dealmaker talent', () => {
            const haggleResult = { success: true, hasDealmakertTalent: true };
            
            const result = algorithm.applyHaggling(baseOffer, haggleResult);

            // Should increase by 20%
            expect(result.adjustedPricePerTenEP).toBe(2.4); // 2 × 1.2
            expect(result.totalOffer).toBe(24); // 10 units × 2.4
            expect(result.haggleModifier).toBe(0.4); // 20% of 2
            expect(result.haggleDescription).toBe('Successful haggle with Dealmaker (+20%)');
        });

        test('should not change price on failed haggle', () => {
            const haggleResult = { success: false, hasDealmakertTalent: false };
            
            const result = algorithm.applyHaggling(baseOffer, haggleResult);

            // Should remain unchanged
            expect(result.adjustedPricePerTenEP).toBe(2);
            expect(result.totalOffer).toBe(20);
            expect(result.haggleModifier).toBe(0);
            expect(result.haggleDescription).toBe('Failed haggle (no penalty)');
        });

        test('should throw error for invalid haggle result', () => {
            expect(() => {
                algorithm.applyHaggling(baseOffer, { invalid: true });
            }).toThrow('Invalid haggle result object');
        });
    });

    describe('Desperate Sales', () => {
        test('should allow desperate sale at trade centers', () => {
            const result = algorithm.handleDesperateSale(
                testSettlements.tradeCenter,
                'Wine',
                'Summer',
                50
            );

            expect(result.available).toBe(true);
            expect(result.saleType).toBe('desperate');
            expect(result.basePricePerTenEP).toBe(10); // Wine Summer price
            expect(result.desperatePricePerTenEP).toBe(5); // 50% of base
            expect(result.totalUnits).toBe(5); // 50 EP = 5 units
            expect(result.totalValue).toBe(25); // 5 units × 5 GC
        });

        test('should reject desperate sale at non-trade settlements', () => {
            const result = algorithm.handleDesperateSale(
                testSettlements.normalTown,
                'Wine',
                'Summer',
                50
            );

            expect(result.available).toBe(false);
            expect(result.reason).toBe('Settlement is not a Trade center');
        });

        test('should log desperate sale decision', () => {
            algorithm.handleDesperateSale(testSettlements.tradeCenter, 'Wine', 'Summer', 50);
            
            const decisionLogs = mockLogger.logs.filter(log => log.type === 'decision');
            expect(decisionLogs.some(log => log.title === 'Desperate Sale')).toBe(true);
        });
    });

    describe('Rumor Sales', () => {
        const validRumor = {
            isValid: true,
            settlementName: 'ALTDORF',
            cargoType: 'Wine',
            source: 'Tavern gossip'
        };

        test('should allow rumor sale with valid rumor', () => {
            const result = algorithm.handleRumorSale(
                testSettlements.altdorf,
                'Wine',
                'Summer',
                30,
                validRumor
            );

            expect(result.available).toBe(true);
            expect(result.saleType).toBe('rumor');
            expect(result.basePricePerTenEP).toBe(10); // Wine Summer price
            expect(result.rumorPricePerTenEP).toBe(20); // Double base price
            expect(result.totalUnits).toBe(3); // 30 EP = 3 units
            expect(result.totalValue).toBe(60); // 3 units × 20 GC
        });

        test('should reject rumor sale with invalid rumor', () => {
            const invalidRumor = { isValid: false };
            
            const result = algorithm.handleRumorSale(
                testSettlements.altdorf,
                'Wine',
                'Summer',
                30,
                invalidRumor
            );

            expect(result.available).toBe(false);
            expect(result.reason).toBe('No valid rumor information provided');
        });

        test('should reject rumor sale for wrong settlement', () => {
            const wrongRumor = {
                isValid: true,
                settlementName: 'Marienburg',
                cargoType: 'Wine',
                source: 'Tavern gossip'
            };
            
            const result = algorithm.handleRumorSale(
                testSettlements.altdorf,
                'Wine',
                'Summer',
                30,
                wrongRumor
            );

            expect(result.available).toBe(false);
            expect(result.reason).toBe('Settlement or cargo type does not match rumor');
        });

        test('should reject rumor sale for wrong cargo type', () => {
            const wrongRumor = {
                isValid: true,
                settlementName: 'ALTDORF',
                cargoType: 'Grain',
                source: 'Tavern gossip'
            };
            
            const result = algorithm.handleRumorSale(
                testSettlements.altdorf,
                'Wine',
                'Summer',
                30,
                wrongRumor
            );

            expect(result.available).toBe(false);
            expect(result.reason).toBe('Settlement or cargo type does not match rumor');
        });
    });

    describe('Complete Selling Algorithm Workflow', () => {
        test('should execute complete normal selling workflow', async () => {
            const mockRoll = () => 30; // Will succeed for trade center (60% chance)
            
            const result = await algorithm.executeSellingAlgorithm(
                testSettlements.tradeCenter,
                'Wine',
                50,
                'Summer',
                {
                    cargoHistory: { purchaseLocation: 'ALTDORF', purchaseDate: '2025-01-01' },
                    rollFunction: mockRoll
                }
            );

            expect(result.success).toBe(true);
            expect(result.saleType).toBe('normal');
            expect(result.eligibility.canSell).toBe(true);
            expect(result.buyerSearch.buyerFound).toBe(true);
            expect(result.offerCalculation).toBeDefined();
            expect(result.finalOffer).toBeDefined();
        });

        test('should handle selling restrictions', async () => {
            const result = await algorithm.executeSellingAlgorithm(
                testSettlements.tradeCenter,
                'Wine',
                50,
                'Summer',
                {
                    cargoHistory: { purchaseLocation: 'Marienburg', purchaseDate: new Date().toISOString() }
                }
            );

            expect(result.success).toBe(false);
            expect(result.reason).toBe('Selling restrictions apply');
            expect(result.restrictions).toBeDefined();
        });

        test('should handle no buyer found', async () => {
            const mockRoll = () => 90; // Will fail for normal town (20% chance)
            
            const result = await algorithm.executeSellingAlgorithm(
                testSettlements.normalTown,
                'Wine',
                50,
                'Summer',
                {
                    cargoHistory: { purchaseLocation: 'ALTDORF', purchaseDate: '2025-01-01' },
                    rollFunction: mockRoll
                }
            );

            expect(result.success).toBe(false);
            expect(result.reason).toBe('No buyer found');
            expect(result.buyerSearch.buyerFound).toBe(false);
        });

        test('should handle desperate sale workflow', async () => {
            const result = await algorithm.executeSellingAlgorithm(
                testSettlements.tradeCenter,
                'Wine',
                50,
                'Summer',
                {
                    saleType: 'desperate',
                    cargoHistory: { purchaseLocation: 'ALTDORF', purchaseDate: '2025-01-01' }
                }
            );

            expect(result.success).toBe(true);
            expect(result.saleType).toBe('desperate');
            expect(result.desperateSale).toBeDefined();
            expect(result.desperateSale.totalValue).toBe(25); // 50% of normal price
        });

        test('should handle rumor sale workflow', async () => {
            const rumorInfo = {
                isValid: true,
                settlementName: 'Marienburg',
                cargoType: 'Wine',
                source: 'Tavern gossip'
            };
            
            const result = await algorithm.executeSellingAlgorithm(
                testSettlements.tradeCenter,
                'Wine',
                50,
                'Summer',
                {
                    saleType: 'rumor',
                    rumorInfo: rumorInfo,
                    cargoHistory: { purchaseLocation: 'ALTDORF', purchaseDate: '2025-01-01' }
                }
            );

            expect(result.success).toBe(true);
            expect(result.saleType).toBe('rumor');
            expect(result.rumorSale).toBeDefined();
            expect(result.rumorSale.totalValue).toBe(100); // Double normal price
        });

        test('should handle village special case', async () => {
            const mockRoll = () => 55; // Will give 6 EP limit for village
            
            const result = await algorithm.executeSellingAlgorithm(
                testSettlements.village,
                'Wine',
                50,
                'Summer',
                {
                    cargoHistory: { purchaseLocation: 'ALTDORF', purchaseDate: '2025-01-01' },
                    rollFunction: mockRoll
                }
            );

            expect(result.villageSpecialCase).toBeDefined();
            expect(result.villageSpecialCase.isVillageSpecialCase).toBe(true);
            expect(result.villageSpecialCase.maxSellableEP).toBe(6);
        });

        test('should apply haggling when provided', async () => {
            const mockRoll = () => 30;
            const haggleResult = { success: true, hasDealmakertTalent: false };
            
            const result = await algorithm.executeSellingAlgorithm(
                testSettlements.tradeCenter,
                'Wine',
                50,
                'Summer',
                {
                    cargoHistory: { purchaseLocation: 'ALTDORF', purchaseDate: '2025-01-01' },
                    rollFunction: mockRoll,
                    haggleResult: haggleResult
                }
            );

            expect(result.success).toBe(true);
            expect(result.finalOffer.haggleResult).toBeDefined();
            expect(result.finalOffer.haggleModifier).toBeGreaterThan(0);
        });

        test('should handle algorithm errors gracefully', async () => {
            // Test with invalid cargo type - force buyer to be found first
            const mockRoll = () => 10; // Will succeed for trade center
            
            await expect(
                algorithm.executeSellingAlgorithm(
                    testSettlements.tradeCenter,
                    'InvalidCargo',
                    50,
                    'Summer',
                    { 
                        cargoHistory: { purchaseLocation: 'ALTDORF', purchaseDate: '2025-01-01' },
                        rollFunction: mockRoll
                    }
                )
            ).rejects.toThrow('Cargo type not found: InvalidCargo');
        });

        test('should log complete workflow execution', async () => {
            const mockRoll = () => 30;
            
            await algorithm.executeSellingAlgorithm(
                testSettlements.tradeCenter,
                'Wine',
                50,
                'Summer',
                {
                    cargoHistory: { purchaseLocation: 'ALTDORF', purchaseDate: '2025-01-01' },
                    rollFunction: mockRoll
                }
            );

            const algorithmLogs = mockLogger.logs.filter(log => log.type === 'algorithm');
            const systemLogs = mockLogger.logs.filter(log => log.type === 'system');
            
            expect(algorithmLogs.some(log => log.title === 'Execute Full Selling Algorithm')).toBe(true);
            expect(systemLogs.some(log => log.message === 'Complete workflow executed successfully')).toBe(true);
        });
    });
});