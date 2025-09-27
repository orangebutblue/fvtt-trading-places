/**
 * Trading Places Module - WFRP Buying Algorithm Tests
 * Comprehensive tests for the buying algorithm implementation
 */

// Import required modules
const WFRPBuyingAlgorithm = require('../scripts/buying-algorithm.js');
const DataManager = require('../scripts/data-manager.js');
const WFRPDebugLogger = require('../scripts/debug-logger.js');

describe('WFRPBuyingAlgorithm', () => {
    let buyingAlgorithm;
    let dataManager;
    let logger;
    let mockSettlement;
    let mockCargoTypes;
    let mockRandomCargoTables;

    beforeEach(() => {
        // Create mock data manager
        dataManager = new DataManager();
        
        // Create logger
        logger = new WFRPDebugLogger();
        logger.setEnabled(true);
        
        // Create buying algorithm instance
        buyingAlgorithm = new WFRPBuyingAlgorithm(dataManager, null);
        buyingAlgorithm.setLogger(logger);
        
        // Mock settlement data
        mockSettlement = {
            region: "Reikland",
            name: "ALTDORF",
            size: "CS",
            ruler: "Emperor Karl-Franz I",
            population: 105000,
            wealth: 4,
            source: ["Trade", "Government"],
            garrison: ["500a/8000c"],
            notes: "Imperial Capital"
        };

        // Mock cargo types
        mockCargoTypes = [
            {
                name: "Grain",
                category: "Agriculture",
                basePrices: {
                    spring: 2,
                    summer: 3,
                    autumn: 1,
                    winter: 4
                },
                encumbrancePerUnit: 1
            },
            {
                name: "Wine/Brandy",
                category: "Luxury",
                basePrices: {
                    spring: 15,
                    summer: 12,
                    autumn: 18,
                    winter: 20
                },
                encumbrancePerUnit: 1,
                qualityTiers: {
                    poor: 0.5,
                    average: 1.0,
                    good: 1.5,
                    excellent: 2.0
                }
            },
            {
                name: "Metal",
                category: "Raw Materials",
                basePrices: {
                    spring: 8,
                    summer: 8,
                    autumn: 9,
                    winter: 10
                },
                encumbrancePerUnit: 2
            }
        ];

        // Mock random cargo tables
        mockRandomCargoTables = {
            spring: [
                { cargo: "Grain", range: [1, 20] },
                { cargo: "Metal", range: [21, 60] },
                { cargo: "Wine/Brandy", range: [61, 100] }
            ],
            summer: [
                { cargo: "Grain", range: [1, 30] },
                { cargo: "Metal", range: [31, 70] },
                { cargo: "Wine/Brandy", range: [71, 100] }
            ],
            autumn: [
                { cargo: "Grain", range: [1, 50] },
                { cargo: "Metal", range: [51, 80] },
                { cargo: "Wine/Brandy", range: [81, 100] }
            ],
            winter: [
                { cargo: "Grain", range: [1, 25] },
                { cargo: "Metal", range: [26, 75] },
                { cargo: "Wine/Brandy", range: [76, 100] }
            ]
        };

        // Set up data manager with mock data
        dataManager.cargoTypes = mockCargoTypes;
        buyingAlgorithm.randomCargoTables = mockRandomCargoTables;
    });

    describe('Constructor and Setup', () => {
        test('should create instance with required dependencies', () => {
            expect(buyingAlgorithm).toBeInstanceOf(WFRPBuyingAlgorithm);
            expect(buyingAlgorithm.dataManager).toBe(dataManager);
            expect(buyingAlgorithm.logger).toBe(logger);
        });

        test('should provide no-op logger when none set', () => {
            const algorithm = new WFRPBuyingAlgorithm(dataManager, null);
            const noOpLogger = algorithm.getLogger();
            
            expect(typeof noOpLogger.logDiceRoll).toBe('function');
            expect(typeof noOpLogger.logCalculation).toBe('function');
            expect(typeof noOpLogger.logDecision).toBe('function');
        });
    });

    describe('Step 0: Settlement Information Extraction', () => {
        test('should extract settlement information correctly', () => {
            const result = buyingAlgorithm.extractSettlementInformation(mockSettlement);
            
            expect(result.name).toBe('ALTDORF');
            expect(result.region).toBe('Reikland');
            expect(result.sizeRating).toBe(4); // CS = 4
            expect(result.wealthRating).toBe(4);
            expect(result.isTradeCenter).toBe(true);
            expect(result.productionCategories).toEqual(["Trade", "Government"]);
        });

        test('should throw error for invalid settlement', () => {
            expect(() => {
                buyingAlgorithm.extractSettlementInformation(null);
            }).toThrow('Settlement object is required');
        });

        test('should validate settlement structure', () => {
            const invalidSettlement = { name: 'Test' }; // Missing required fields
            
            expect(() => {
                buyingAlgorithm.extractSettlementInformation(invalidSettlement);
            }).toThrow('Invalid settlement');
        });
    });

    describe('Step 1: Cargo Availability Check', () => {
        test('should calculate availability chance correctly', async () => {
            // Mock roll function that always returns 50
            const mockRoll = () => 50;
            
            const result = await buyingAlgorithm.checkCargoAvailability(mockSettlement, mockRoll);
            
            // (Size 4 + Wealth 4) × 10 = 80%
            expect(result.chance).toBe(80);
            expect(result.roll).toBe(50);
            expect(result.available).toBe(true); // 50 ≤ 80
            expect(result.settlement).toBe('ALTDORF');
        });

        test('should handle failed availability check', async () => {
            // Mock roll function that always returns 90
            const mockRoll = () => 90;
            
            const result = await buyingAlgorithm.checkCargoAvailability(mockSettlement, mockRoll);
            
            expect(result.chance).toBe(80);
            expect(result.roll).toBe(90);
            expect(result.available).toBe(false); // 90 > 80
        });

        test('should cap availability chance at 100%', async () => {
            // Create settlement with very high size and wealth
            const highValueSettlement = {
                ...mockSettlement,
                size: "CS", // 4
                wealth: 5    // 5
            };
            // (4 + 5) × 10 = 90%, which is under 100%
            
            const mockRoll = () => 50;
            const result = await buyingAlgorithm.checkCargoAvailability(highValueSettlement, mockRoll);
            
            expect(result.chance).toBe(90);
        });

        test('should handle minimum size settlement', async () => {
            const villageSettlement = {
                ...mockSettlement,
                size: "V",  // 1
                wealth: 1   // 1
            };
            // (1 + 1) × 10 = 20%
            
            const mockRoll = () => 15;
            const result = await buyingAlgorithm.checkCargoAvailability(villageSettlement, mockRoll);
            
            expect(result.chance).toBe(20);
            expect(result.available).toBe(true); // 15 ≤ 20
        });
    });

    describe('Step 2A: Cargo Type Determination', () => {
        test('should select specific goods for non-trade settlement', async () => {
            const specificGoodsSettlement = {
                ...mockSettlement,
                source: ["Agriculture"] // No Trade
            };
            
            const result = await buyingAlgorithm.determineCargoType(specificGoodsSettlement, 'spring');
            
            expect(result.cargoType).toBe('Agriculture');
            expect(result.selectionMethod).toBe('specific_goods_only');
            expect(result.availableOptions).toEqual(['Agriculture']);
        });

        test('should select random cargo for pure trade center', async () => {
            const tradeOnlySettlement = {
                ...mockSettlement,
                source: ["Trade"] // Trade only
            };
            
            // Mock the random selection to return a specific cargo
            const originalSelectRandom = buyingAlgorithm.selectRandomTradeGood;
            buyingAlgorithm.selectRandomTradeGood = jest.fn().mockResolvedValue('Grain');
            
            const result = await buyingAlgorithm.determineCargoType(tradeOnlySettlement, 'spring');
            
            expect(result.cargoType).toBe('Grain');
            expect(result.selectionMethod).toBe('pure_trade_center');
            expect(buyingAlgorithm.selectRandomTradeGood).toHaveBeenCalledWith('spring');
            
            // Restore original method
            buyingAlgorithm.selectRandomTradeGood = originalSelectRandom;
        });

        test('should handle trade center with specific goods', async () => {
            // Mock the random selection to return a specific cargo
            const originalSelectRandom = buyingAlgorithm.selectRandomTradeGood;
            buyingAlgorithm.selectRandomTradeGood = jest.fn().mockResolvedValue('Metal');
            
            // This is the default mockSettlement with ["Trade", "Government"]
            const result = await buyingAlgorithm.determineCargoType(mockSettlement, 'spring');
            
            expect(result.cargoType).toBe('Metal'); // Random trade good
            expect(result.selectionMethod).toBe('trade_center_with_goods');
            expect(result.availableOptions).toContain('Government');
            expect(result.availableOptions).toContain('Random Trade Good');
            
            // Restore original method
            buyingAlgorithm.selectRandomTradeGood = originalSelectRandom;
        });

        test('should fallback for invalid production data', async () => {
            // Create a settlement that passes validation but has no valid production
            const invalidSettlement = {
                ...mockSettlement,
                source: ["InvalidCategory"] // Category that doesn't exist in cargo types
            };
            
            const result = await buyingAlgorithm.determineCargoType(invalidSettlement, 'spring');
            
            expect(result.cargoType).toBe('InvalidCategory');
            expect(result.selectionMethod).toBe('specific_goods_only');
        });

        test('should require season parameter', async () => {
            await expect(
                buyingAlgorithm.determineCargoType(mockSettlement, null)
            ).rejects.toThrow('Season is required for cargo type determination');
        });
    });

    describe('Step 2A: Random Trade Cargo Selection', () => {
        test('should select cargo based on dice roll', async () => {
            // Mock roll that should select "Grain" (range 1-20)
            const mockRoll = () => 15;
            
            // Mock FoundryVTT dice roller
            global.game = {
                dice: true
            };
            global.Roll = class {
                constructor(formula) {
                    this.formula = formula;
                }
                async evaluate() {
                    return { total: mockRoll() };
                }
            };
            
            const result = await buyingAlgorithm.selectRandomTradeGood('spring');
            expect(result).toBe('Grain');
            
            // Clean up
            delete global.game;
            delete global.Roll;
        });

        test('should select different cargo for different rolls', async () => {
            // Test multiple ranges
            const testCases = [
                { roll: 15, expected: 'Grain' },    // Range 1-20
                { roll: 40, expected: 'Metal' },    // Range 21-60
                { roll: 80, expected: 'Wine/Brandy' } // Range 61-100
            ];
            
            for (const testCase of testCases) {
                // Mock FoundryVTT dice roller
                global.game = {
                    dice: true
                };
                global.Roll = class {
                    constructor(formula) {
                        this.formula = formula;
                    }
                    async evaluate() {
                        return { total: testCase.roll };
                    }
                };
                
                const result = await buyingAlgorithm.selectRandomTradeGood('spring');
                expect(result).toBe(testCase.expected);
                
                // Clean up
                delete global.game;
                delete global.Roll;
            }
        });

        test('should handle edge cases in cargo selection', async () => {
            // Test exact boundary values
            const boundaryTests = [
                { roll: 1, expected: 'Grain' },     // Lower bound
                { roll: 20, expected: 'Grain' },    // Upper bound
                { roll: 21, expected: 'Metal' },    // Next range start
                { roll: 100, expected: 'Wine/Brandy' } // Maximum roll
            ];
            
            for (const test of boundaryTests) {
                global.game = {
                    dice: true
                };
                global.Roll = class {
                    constructor(formula) {
                        this.formula = formula;
                    }
                    async evaluate() {
                        return { total: test.roll };
                    }
                };
                
                const result = await buyingAlgorithm.selectRandomTradeGood('spring');
                expect(result).toBe(test.expected);
                
                delete global.game;
                delete global.Roll;
            }
        });
    });

    describe('Step 2B: Cargo Size Calculation', () => {
        test('should calculate cargo size correctly', async () => {
            // Mock roll function that returns 55
            const mockRoll = () => 55;
            
            const result = await buyingAlgorithm.calculateCargoSize(mockSettlement, mockRoll);
            
            // Base: Size 4 + Wealth 4 = 8
            // Roll: 55 → rounded up to 60
            // Total: 8 × 60 = 480 EP
            expect(result.baseMultiplier).toBe(8);
            expect(result.sizeMultiplier).toBe(60); // 55 rounded up to nearest 10
            expect(result.totalSize).toBe(480);
            expect(result.roll1).toBe(55);
            expect(result.tradeBonus).toBe(true); // Settlement has Trade
        });

        test('should apply trade center bonus correctly', async () => {
            let rollCount = 0;
            const mockRoll = () => {
                rollCount++;
                return rollCount === 1 ? 35 : 75; // First roll 35, second roll 75
            };
            
            const result = await buyingAlgorithm.calculateCargoSize(mockSettlement, mockRoll);
            
            // Base: 8
            // First roll: 35 → 40
            // Second roll: 75 → 80 (higher, so use this)
            // Total: 8 × 80 = 640 EP
            expect(result.baseMultiplier).toBe(8);
            expect(result.sizeMultiplier).toBe(80); // Use higher of 40 and 80
            expect(result.totalSize).toBe(640);
            expect(result.roll1).toBe(35);
            expect(result.roll2).toBe(75);
            expect(result.tradeBonus).toBe(true);
        });

        test('should use first roll when higher for trade center', async () => {
            let rollCount = 0;
            const mockRoll = () => {
                rollCount++;
                return rollCount === 1 ? 85 : 25; // First roll 85, second roll 25
            };
            
            const result = await buyingAlgorithm.calculateCargoSize(mockSettlement, mockRoll);
            
            // First roll: 85 → 90
            // Second roll: 25 → 30 (lower, so use first)
            // Total: 8 × 90 = 720 EP
            expect(result.sizeMultiplier).toBe(90); // Use higher of 90 and 30
            expect(result.totalSize).toBe(720);
        });

        test('should not apply trade bonus for non-trade settlements', async () => {
            const nonTradeSettlement = {
                ...mockSettlement,
                source: ["Agriculture"] // No Trade
            };
            
            const mockRoll = () => 45;
            
            const result = await buyingAlgorithm.calculateCargoSize(nonTradeSettlement, mockRoll);
            
            expect(result.tradeBonus).toBe(false);
            expect(result.roll2).toBe(null);
            expect(result.sizeMultiplier).toBe(50); // 45 → 50
        });

        test('should round up to nearest 10 correctly', async () => {
            const testCases = [
                { roll: 1, expected: 10 },
                { roll: 9, expected: 10 },
                { roll: 10, expected: 10 },
                { roll: 11, expected: 20 },
                { roll: 55, expected: 60 },
                { roll: 99, expected: 100 },
                { roll: 100, expected: 100 }
            ];
            
            const nonTradeSettlement = {
                ...mockSettlement,
                source: ["Agriculture"] // No Trade to avoid second roll
            };
            
            for (const testCase of testCases) {
                const mockRoll = () => testCase.roll;
                const result = await buyingAlgorithm.calculateCargoSize(nonTradeSettlement, mockRoll);
                
                expect(result.sizeMultiplier).toBe(testCase.expected);
            }
        });
    });

    describe('Step 3: Price Calculation', () => {
        test('should calculate base price correctly', () => {
            const result = buyingAlgorithm.calculateBasePrice('Grain', 'spring', 100);
            
            // Grain in spring: 2 GC per 10 EP
            // 100 EP = 10 units of 10 EP
            // Total: 10 × 2 = 20 GC
            expect(result.cargoType).toBe('Grain');
            expect(result.season).toBe('spring');
            expect(result.quantity).toBe(100);
            expect(result.totalUnits).toBe(10);
            expect(result.basePricePerTenEP).toBe(2);
            expect(result.finalPricePerTenEP).toBe(2);
            expect(result.totalPrice).toBe(20);
        });

        test('should apply partial purchase penalty', () => {
            const result = buyingAlgorithm.calculateBasePrice('Grain', 'spring', 100, {
                isPartialPurchase: true
            });
            
            // Base price: 2 GC
            // Partial penalty: +10% = 2.2 GC per 10 EP
            // Total: 10 × 2.2 = 22 GC
            expect(result.basePricePerTenEP).toBe(2);
            expect(result.finalPricePerTenEP).toBe(2.2);
            expect(result.totalPrice).toBe(22);
            expect(result.modifiers).toHaveLength(1);
            expect(result.modifiers[0].type).toBe('partial_purchase');
            expect(result.modifiers[0].percentage).toBe(10);
        });

        test('should handle quality tiers for wine/brandy', () => {
            const result = buyingAlgorithm.calculateBasePrice('Wine/Brandy', 'spring', 100, {
                quality: 'excellent'
            });
            
            // Wine/Brandy in spring: 15 GC base
            // Excellent quality: ×2.0 = 30 GC per 10 EP
            // Total: 10 × 30 = 300 GC
            expect(result.basePricePerTenEP).toBe(30); // 15 × 2.0
            expect(result.totalPrice).toBe(300);
            expect(result.quality).toBe('excellent');
        });

        test('should throw error for invalid cargo type', () => {
            expect(() => {
                buyingAlgorithm.calculateBasePrice('InvalidCargo', 'spring', 100);
            }).toThrow('Cargo type not found: InvalidCargo');
        });

        test('should require cargo type and season', () => {
            expect(() => {
                buyingAlgorithm.calculateBasePrice(null, 'spring', 100);
            }).toThrow('Cargo type and season are required');
            
            expect(() => {
                buyingAlgorithm.calculateBasePrice('Grain', null, 100);
            }).toThrow('Cargo type and season are required');
        });
    });

    describe('Step 3: Haggling Application', () => {
        test('should apply successful haggle without Dealmaker', () => {
            const basePrice = buyingAlgorithm.calculateBasePrice('Grain', 'spring', 100);
            const haggleResult = {
                success: true,
                hasDealmakertTalent: false
            };
            
            const result = buyingAlgorithm.applyHaggling(basePrice, haggleResult);
            
            // Base: 2 GC per 10 EP
            // Haggle success: -10% = 1.8 GC per 10 EP
            // Total: 10 × 1.8 = 18 GC
            expect(result.finalPricePerTenEP).toBe(1.8);
            expect(result.totalPrice).toBe(18);
            expect(result.modifiers).toHaveLength(1);
            expect(result.modifiers[0].type).toBe('haggle');
            expect(result.modifiers[0].percentage).toBe(-10);
        });

        test('should apply successful haggle with Dealmaker talent', () => {
            const basePrice = buyingAlgorithm.calculateBasePrice('Grain', 'spring', 100);
            const haggleResult = {
                success: true,
                hasDealmakertTalent: true
            };
            
            const result = buyingAlgorithm.applyHaggling(basePrice, haggleResult);
            
            // Base: 2 GC per 10 EP
            // Haggle success with Dealmaker: -20% = 1.6 GC per 10 EP
            // Total: 10 × 1.6 = 16 GC
            expect(result.finalPricePerTenEP).toBe(1.6);
            expect(result.totalPrice).toBe(16);
            expect(result.modifiers[0].percentage).toBe(-20);
        });

        test('should handle failed haggle', () => {
            const basePrice = buyingAlgorithm.calculateBasePrice('Grain', 'spring', 100);
            const haggleResult = {
                success: false,
                hasDealmakertTalent: false
            };
            
            const result = buyingAlgorithm.applyHaggling(basePrice, haggleResult);
            
            // Failed haggle: no change
            expect(result.finalPricePerTenEP).toBe(2);
            expect(result.totalPrice).toBe(20);
            expect(result.modifiers[0].percentage).toBe(0);
        });

        test('should combine partial purchase penalty with haggling', () => {
            const basePrice = buyingAlgorithm.calculateBasePrice('Grain', 'spring', 100, {
                isPartialPurchase: true
            });
            const haggleResult = {
                success: true,
                hasDealmakertTalent: false
            };
            
            const result = buyingAlgorithm.applyHaggling(basePrice, haggleResult);
            
            // Base: 2 GC
            // Partial penalty: +10% = 2.2 GC
            // Haggle: -10% of 2.2 = -0.22, so 2.2 - 0.22 = 1.98 GC per 10 EP
            // Total: 10 × 1.98 = 19.8 GC
            expect(result.finalPricePerTenEP).toBeCloseTo(1.98, 2);
            expect(result.totalPrice).toBeCloseTo(19.8, 2);
            expect(result.modifiers).toHaveLength(2);
        });

        test('should throw error for invalid haggle result', () => {
            const basePrice = buyingAlgorithm.calculateBasePrice('Grain', 'spring', 100);
            
            expect(() => {
                buyingAlgorithm.applyHaggling(basePrice, null);
            }).toThrow('Invalid haggle result object');
            
            expect(() => {
                buyingAlgorithm.applyHaggling(basePrice, { success: 'not_boolean' });
            }).toThrow('Invalid haggle result object');
        });
    });

    describe('Complete Buying Algorithm Workflow', () => {
        test('should execute complete successful workflow', async () => {
            // Mock successful rolls
            let rollCount = 0;
            const mockRoll = () => {
                rollCount++;
                switch (rollCount) {
                    case 1: return 50; // Availability check (success: 50 ≤ 80)
                    case 2: return 60; // Cargo size roll 1
                    case 3: return 40; // Cargo size roll 2 (trade bonus)
                    default: return 50;
                }
            };
            
            const result = await buyingAlgorithm.executeBuyingAlgorithm(mockSettlement, 'spring', {
                rollFunction: mockRoll
            });
            
            expect(result.success).toBe(true);
            expect(result.settlementInfo.name).toBe('ALTDORF');
            expect(result.availabilityResult.available).toBe(true);
            expect(result.cargoTypeResult.cargoType).toMatch(/Grain|Metal|Wine\/Brandy/); // Should be a valid cargo type
            expect(result.cargoSizeResult.totalSize).toBe(480); // 8 × 60
            expect(result.priceResult.totalPrice).toBeGreaterThan(0);
            expect(result.summary).toBeDefined();
        });

        test('should handle no cargo available scenario', async () => {
            // Mock failed availability roll
            const mockRoll = () => 95; // Fail: 95 > 80
            
            const result = await buyingAlgorithm.executeBuyingAlgorithm(mockSettlement, 'spring', {
                rollFunction: mockRoll
            });
            
            expect(result.success).toBe(false);
            expect(result.reason).toBe('no_cargo_available');
            expect(result.availabilityResult.available).toBe(false);
        });

        test('should handle complete workflow with haggling', async () => {
            const mockRoll = () => 50; // Always successful
            const haggleResult = {
                success: true,
                hasDealmakertTalent: true
            };
            
            const result = await buyingAlgorithm.executeBuyingAlgorithm(mockSettlement, 'spring', {
                rollFunction: mockRoll,
                haggleResult: haggleResult
            });
            
            expect(result.success).toBe(true);
            expect(result.priceResult.haggleResult).toBe(haggleResult);
            expect(result.priceResult.modifiers.some(m => m.type === 'haggle')).toBe(true);
        });

        test('should handle errors gracefully', async () => {
            const invalidSettlement = null;
            
            await expect(
                buyingAlgorithm.executeBuyingAlgorithm(invalidSettlement, 'spring')
            ).rejects.toThrow();
        });
    });

    describe('Input Validation', () => {
        test('should validate buying inputs correctly', () => {
            const validResult = buyingAlgorithm.validateBuyingInputs(mockSettlement, 'spring');
            expect(validResult.valid).toBe(true);
            expect(validResult.errors).toHaveLength(0);
        });

        test('should catch invalid settlement', () => {
            const result = buyingAlgorithm.validateBuyingInputs(null, 'spring');
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Settlement object is required');
        });

        test('should catch invalid season', () => {
            const result = buyingAlgorithm.validateBuyingInputs(mockSettlement, 'invalid_season');
            expect(result.valid).toBe(false);
            expect(result.errors[0]).toContain('Invalid season');
        });

        test('should validate quality parameter', () => {
            const result = buyingAlgorithm.validateBuyingInputs(mockSettlement, 'spring', {
                quality: 123 // Should be string
            });
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Quality must be a string');
        });

        test('should validate haggle result parameter', () => {
            const result = buyingAlgorithm.validateBuyingInputs(mockSettlement, 'spring', {
                haggleResult: { success: 'not_boolean' }
            });
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Haggle result must have a boolean success property');
        });
    });

    describe('Logging Integration', () => {
        test('should log algorithm steps', async () => {
            const mockRoll = () => 50;
            
            await buyingAlgorithm.executeBuyingAlgorithm(mockSettlement, 'spring', {
                rollFunction: mockRoll
            });
            
            const logHistory = logger.getLogHistory();
            
            // Check that various log categories were used
            const categories = logHistory.map(entry => entry.category);
            expect(categories).toContain('ALGORITHM');
            expect(categories).toContain('CALCULATION');
            expect(categories).toContain('DECISION');
            expect(categories).toContain('DICE');
        });

        test('should log dice rolls with proper format', async () => {
            const mockRoll = () => 75;
            
            await buyingAlgorithm.checkCargoAvailability(mockSettlement, mockRoll);
            
            const diceRolls = logger.getLogHistory('DICE');
            expect(diceRolls.length).toBeGreaterThan(0);
            
            const rollEntry = diceRolls[0];
            expect(rollEntry.data.result).toBe(75);
            expect(rollEntry.data.target).toBe(80);
            expect(rollEntry.data.success).toBe(true);
        });

        test('should log calculations with input data', async () => {
            const mockRoll = () => 50;
            
            await buyingAlgorithm.calculateCargoSize(mockSettlement, mockRoll);
            
            const calculations = logger.getLogHistory('CALCULATION');
            expect(calculations.length).toBeGreaterThan(0);
            
            const calcEntry = calculations.find(entry => 
                entry.operation === 'Base Multiplier'
            );
            expect(calcEntry).toBeDefined();
            expect(calcEntry.data.inputs).toBeDefined();
        });
    });
});