/**
 * Unit tests for haggling and skill test mechanics
 */

const TradingEngine = require('../scripts/trading-engine');
const DataManager = require('../scripts/data-manager');

// Mock FoundryVTT globals for testing
global.Roll = class MockRoll {
    constructor(formula) {
        this.formula = formula;
        this.total = Math.floor(Math.random() * 100) + 1;
        this.result = this.total.toString();
        this.terms = [{ results: [{ result: this.total }] }];
    }
    
    async evaluate() {
        return this;
    }
    
    async toMessage() {
        return { content: `Roll: ${this.total}` };
    }
};

global.ChatMessage = {
    create: async (data) => ({ content: data.content })
};

global.game = {
    settings: {
        get: (module, setting) => {
            if (setting === 'chatVisibility') return 'gm';
            return null;
        }
    },
    user: { id: 'test-user' }
};

global.CONST = {
    CHAT_MESSAGE_TYPES: {
        OTHER: 0
    }
};

describe('TradingEngine - Haggling and Skill Tests', () => {
    let dataManager;
    let tradingEngine;
    let mockSettlement;

    beforeEach(() => {
        // Create mock data manager
        dataManager = new DataManager();
        dataManager.settlements = [
            {
                region: 'Empire',
                name: 'Averheim',
                size: 'T',
                ruler: 'Grand Count Marius Leitdorf',
                population: 9400,
                wealth: 4,
                source: ['Trade', 'Government', 'Cattle', 'Agriculture'],
                garrison: ['35a', '80b', '350c'],
                notes: 'Provincial Capital'
            }
        ];
        
        dataManager.cargoTypes = [
            {
                name: 'Grain',
                category: 'Agriculture',
                basePrices: { spring: 2, summer: 3, autumn: 1, winter: 4 },
                encumbrancePerUnit: 1
            },
            {
                name: 'Wine',
                category: 'Luxury',
                basePrices: { spring: 5, summer: 4, autumn: 6, winter: 7 },
                encumbrancePerUnit: 1
            }
        ];

        // Mock required methods
        dataManager.getSettlementProperties = jest.fn().mockReturnValue({
            name: 'Averheim',
            region: 'Empire',
            sizeNumeric: 3,
            sizeEnum: 'T',
            sizeDescription: 'Town',
            wealthRating: 4,
            wealthModifier: 1.05,
            wealthDescription: 'Bustling',
            population: 9400,
            productionCategories: ['Trade', 'Government', 'Cattle', 'Agriculture'],
            garrison: ['35a', '80b', '350c'],
            ruler: 'Grand Count Marius Leitdorf',
            notes: 'Provincial Capital'
        });

        dataManager.isTradeSettlement = jest.fn().mockReturnValue(true);
        dataManager.validateSettlement = jest.fn().mockReturnValue({ valid: true, errors: [] });
        dataManager.getSeasonalPrice = jest.fn().mockReturnValue(2);

        tradingEngine = new TradingEngine(dataManager);
        tradingEngine.setCurrentSeason('spring');

        mockSettlement = dataManager.settlements[0];
    });

    describe('performHaggleTest', () => {
        test('should validate input parameters', async () => {
            await expect(tradingEngine.performHaggleTest(-5, 40)).rejects.toThrow('Player skill must be a number between 0 and 100');
            await expect(tradingEngine.performHaggleTest(105, 40)).rejects.toThrow('Player skill must be a number between 0 and 100');
            await expect(tradingEngine.performHaggleTest(50, -5)).rejects.toThrow('Merchant skill must be a number between 0 and 100');
            await expect(tradingEngine.performHaggleTest(50, 105)).rejects.toThrow('Merchant skill must be a number between 0 and 100');
        });

        test('should handle player success vs merchant failure', async () => {
            const mockRoll = jest.fn()
                .mockReturnValueOnce(30) // Player roll (success at skill 50)
                .mockReturnValueOnce(80); // Merchant roll (failure at skill 40)
            
            const result = await tradingEngine.performHaggleTest(50, 40, false, {}, mockRoll);
            
            expect(result.success).toBe(true);
            expect(result.player.success).toBe(true);
            expect(result.merchant.success).toBe(false);
            expect(result.resultDescription).toContain('Player wins - merchant failed');
        });

        test('should handle player failure vs merchant success', async () => {
            const mockRoll = jest.fn()
                .mockReturnValueOnce(80) // Player roll (failure at skill 50)
                .mockReturnValueOnce(30); // Merchant roll (success at skill 40)
            
            const result = await tradingEngine.performHaggleTest(50, 40, false, {}, mockRoll);
            
            expect(result.success).toBe(false);
            expect(result.player.success).toBe(false);
            expect(result.merchant.success).toBe(true);
            expect(result.resultDescription).toContain('Merchant wins - player failed');
        });

        test('should handle both success - compare degrees', async () => {
            const mockRoll = jest.fn()
                .mockReturnValueOnce(20) // Player roll (success at skill 50, 3 degrees)
                .mockReturnValueOnce(35); // Merchant roll (success at skill 40, 1 degree)
            
            const result = await tradingEngine.performHaggleTest(50, 40, false, {}, mockRoll);
            
            expect(result.success).toBe(true);
            expect(result.player.success).toBe(true);
            expect(result.merchant.success).toBe(true);
            expect(result.player.degrees).toBe(4); // (50 - 20) / 10 + 1 = 4
            expect(result.merchant.degrees).toBe(1); // (40 - 35) / 10 + 1 = 1
            expect(result.resultDescription).toContain('Player wins - 4 vs 1 degrees');
        });

        test('should handle both failure - compare degrees', async () => {
            const mockRoll = jest.fn()
                .mockReturnValueOnce(60) // Player roll (failure at skill 50, 1 degree)
                .mockReturnValueOnce(70); // Merchant roll (failure at skill 40, 3 degrees)
            
            const result = await tradingEngine.performHaggleTest(50, 40, false, {}, mockRoll);
            
            expect(result.success).toBe(true);
            expect(result.player.success).toBe(false);
            expect(result.merchant.success).toBe(false);
            expect(result.player.degrees).toBe(1); // (60 - 50 - 1) / 10 + 1 = 1
            expect(result.merchant.degrees).toBe(3); // (70 - 40 - 1) / 10 + 1 = 3
            expect(result.resultDescription).toContain('Player wins - 1 vs 3 degrees');
        });

        test('should handle ties', async () => {
            const mockRoll = jest.fn()
                .mockReturnValueOnce(40) // Player roll (success at skill 50, 1 degree)
                .mockReturnValueOnce(30); // Merchant roll (success at skill 40, 1 degree)
            
            const result = await tradingEngine.performHaggleTest(50, 40, false, {}, mockRoll);
            
            expect(result.success).toBe(false);
            expect(result.player.degrees).toBe(2); // (50 - 40) / 10 + 1 = 2
            expect(result.merchant.degrees).toBe(2); // (40 - 30) / 10 + 1 = 2
            expect(result.resultDescription).toContain('Tie - no price change');
        });

        test('should track Dealmaker talent', async () => {
            const mockRoll = jest.fn()
                .mockReturnValueOnce(30)
                .mockReturnValueOnce(80);
            
            const result = await tradingEngine.performHaggleTest(50, 40, true, {}, mockRoll);
            
            expect(result.hasDealmakertTalent).toBe(true);
            expect(result.success).toBe(true);
        });
    });

    describe('getMerchantSkillLevel', () => {
        test('should calculate merchant skill based on settlement properties', () => {
            const skill = tradingEngine.getMerchantSkillLevel(mockSettlement);
            
            // Base 32 + wealth bonus (4-1=3) + size bonus (3-1=2) + trade bonus (10) = 47
            expect(skill).toBe(47);
        });

        test('should handle non-trade settlements', () => {
            dataManager.isTradeSettlement.mockReturnValue(false);
            
            const skill = tradingEngine.getMerchantSkillLevel(mockSettlement);
            
            // Base 32 + wealth bonus (3) + size bonus (2) = 37
            expect(skill).toBe(37);
        });

        test('should cap at maximum skill level', () => {
            // Mock very wealthy, large trade settlement
            dataManager.getSettlementProperties.mockReturnValue({
                sizeNumeric: 4,
                wealthRating: 5
            });
            
            const skill = tradingEngine.getMerchantSkillLevel(mockSettlement);
            
            // Base 32 + wealth (4) + size (3) + trade (10) = 49, under cap
            expect(skill).toBe(49);
        });

        test('should require settlement object', () => {
            expect(() => tradingEngine.getMerchantSkillLevel(null)).toThrow('Settlement object is required');
        });
    });

    describe('performGossipTest', () => {
        test('should validate input parameters', async () => {
            await expect(tradingEngine.performGossipTest(-5)).rejects.toThrow('Player skill must be a number between 0 and 100');
            await expect(tradingEngine.performGossipTest(105)).rejects.toThrow('Player skill must be a number between 0 and 100');
        });

        test('should apply default difficulty modifier', async () => {
            const mockRoll = jest.fn().mockReturnValue(35);
            
            const result = await tradingEngine.performGossipTest(50, {}, mockRoll);
            
            expect(result.difficulty).toBe(-10);
            expect(result.modifiedSkill).toBe(40); // 50 - 10
            expect(result.success).toBe(true); // 35 <= 40
        });

        test('should apply custom difficulty modifier', async () => {
            const mockRoll = jest.fn().mockReturnValue(35);
            
            const result = await tradingEngine.performGossipTest(50, { difficulty: -20 }, mockRoll);
            
            expect(result.difficulty).toBe(-20);
            expect(result.modifiedSkill).toBe(30); // 50 - 20
            expect(result.success).toBe(false); // 35 > 30
        });

        test('should calculate degrees of success/failure', async () => {
            const mockRoll = jest.fn().mockReturnValue(20);
            
            const result = await tradingEngine.performGossipTest(50, {}, mockRoll);
            
            expect(result.success).toBe(true);
            expect(result.degrees).toBe(3); // (40 - 20) / 10 + 1 = 3
            expect(result.resultDescription).toContain('Success with 3 degrees');
        });

        test('should handle skill floor at 0', async () => {
            const mockRoll = jest.fn().mockReturnValue(50);
            
            const result = await tradingEngine.performGossipTest(5, { difficulty: -10 }, mockRoll);
            
            expect(result.modifiedSkill).toBe(0); // Max(0, 5 - 10)
            expect(result.success).toBe(false);
        });
    });

    describe('generateRumorFromGossip', () => {
        test('should return null for failed gossip test', async () => {
            const failedGossip = { success: false };
            
            const result = await tradingEngine.generateRumorFromGossip(failedGossip);
            
            expect(result).toBeNull();
        });

        test('should generate rumor for successful gossip test', async () => {
            const successfulGossip = { success: true, degrees: 2 };
            
            const result = await tradingEngine.generateRumorFromGossip(successfulGossip, 'Grain', mockSettlement);
            
            expect(result).toBeDefined();
            expect(result.cargoName).toBe('Grain');
            expect(result.settlement).toBe('Averheim');
            expect(result.multiplier).toBeGreaterThan(1);
            expect(result.multiplier).toBeLessThanOrEqual(2);
            expect(result.gossipDegrees).toBe(2);
            expect(result.discoveredBy).toBe('gossip_test');
        });

        test('should generate better rumors for higher degrees', async () => {
            const highDegreeGossip = { success: true, degrees: 4 };
            
            const result = await tradingEngine.generateRumorFromGossip(highDegreeGossip, 'Wine');
            
            expect(result.multiplier).toBeGreaterThan(1.3); // Higher multiplier for better gossip
            expect(result.reliability).toBe('reliable');
        });

        test('should generate random cargo if none specified', async () => {
            const successfulGossip = { success: true, degrees: 1 };
            
            const result = await tradingEngine.generateRumorFromGossip(successfulGossip);
            
            expect(result).toBeDefined();
            expect(result.cargoName).toBeDefined();
            expect(typeof result.cargoName).toBe('string');
        });
    });

    describe('calculateDealmakertBonus', () => {
        test('should return no bonus when talent not present', () => {
            const result = tradingEngine.calculateDealmakertBonus(false, 'purchase');
            
            expect(result.hasBonus).toBe(false);
            expect(result.bonusPercentage).toBe(0);
            expect(result.description).toBe('No Dealmaker talent');
        });

        test('should return purchase bonus when talent present', () => {
            const result = tradingEngine.calculateDealmakertBonus(true, 'purchase');
            
            expect(result.hasBonus).toBe(true);
            expect(result.bonusPercentage).toBe(20);
            expect(result.description).toContain('Dealmaker talent: -20% purchase price');
            expect(result.transactionType).toBe('purchase');
        });

        test('should return sale bonus when talent present', () => {
            const result = tradingEngine.calculateDealmakertBonus(true, 'sale');
            
            expect(result.hasBonus).toBe(true);
            expect(result.bonusPercentage).toBe(20);
            expect(result.description).toContain('Dealmaker talent: +20% sale price');
            expect(result.transactionType).toBe('sale');
        });
    });

    describe('processSkillTest', () => {
        test('should validate base skill parameter', async () => {
            await expect(tradingEngine.processSkillTest(-5)).rejects.toThrow('Base skill must be a number between 0 and 100');
            await expect(tradingEngine.processSkillTest(105)).rejects.toThrow('Base skill must be a number between 0 and 100');
        });

        test('should apply modifiers correctly', async () => {
            const modifiers = [
                { name: 'Talent Bonus', value: 10, description: 'Skilled talent' },
                { name: 'Difficulty', value: -20, description: 'Hard test' }
            ];
            const mockRoll = jest.fn().mockReturnValue(35);
            
            const result = await tradingEngine.processSkillTest(50, modifiers, 'Custom Test', mockRoll);
            
            expect(result.baseSkill).toBe(50);
            expect(result.modifiedSkill).toBe(40); // 50 + 10 - 20
            expect(result.success).toBe(true); // 35 <= 40
            expect(result.modifiers).toHaveLength(2);
            expect(result.testName).toBe('Custom Test');
        });

        test('should enforce skill bounds', async () => {
            const modifiers = [{ name: 'Huge Penalty', value: -60, description: 'Very hard' }];
            const mockRoll = jest.fn().mockReturnValue(50);
            
            const result = await tradingEngine.processSkillTest(50, modifiers, 'Bounded Test', mockRoll);
            
            expect(result.modifiedSkill).toBe(0); // Max(0, 50 - 60)
            expect(result.success).toBe(false);
        });

        test('should calculate degrees correctly', async () => {
            const mockRoll = jest.fn().mockReturnValue(25);
            
            const result = await tradingEngine.processSkillTest(60, [], 'Degree Test', mockRoll);
            
            expect(result.success).toBe(true);
            expect(result.degrees).toBe(4); // (60 - 25) / 10 + 1 = 4
            expect(result.resultDescription).toContain('Success (4 degrees)');
        });
    });

    describe('generateSkillTestMessage', () => {
        test('should format skill test result with modifiers', () => {
            const testResult = {
                testName: 'Haggle Test',
                success: true,
                baseSkill: 50,
                modifiedSkill: 45,
                roll: 30,
                degrees: 2,
                modifiers: [
                    { name: 'Difficulty', value: -5, description: 'Moderate' }
                ],
                resultDescription: 'Haggle Test Success (2 degrees)'
            };
            
            const result = tradingEngine.generateSkillTestMessage(testResult);
            
            expect(result).toContain('Haggle Test');
            expect(result).toContain('Base Skill:</strong> 50');
            expect(result).toContain('Modified Skill:</strong> 45');
            expect(result).toContain('Difficulty: -5');
            expect(result).toContain('Roll:</strong> 30');
            expect(result).toContain('Success (2 degrees)');
            expect(result).toContain('Degrees:</strong> 2');
            expect(result).toContain('class="skill-test-result success"');
        });

        test('should format failed test result', () => {
            const testResult = {
                testName: 'Gossip Test',
                success: false,
                baseSkill: 40,
                modifiedSkill: 30,
                roll: 75,
                degrees: 5,
                modifiers: [],
                resultDescription: 'Gossip Test Failure (5 degrees)'
            };
            
            const result = tradingEngine.generateSkillTestMessage(testResult);
            
            expect(result).toContain('class="skill-test-result failure"');
            expect(result).toContain('No modifiers');
            expect(result).toContain('Failure (5 degrees)');
        });
    });

    describe('generateHaggleTestMessage', () => {
        test('should format haggle test result', () => {
            const haggleResult = {
                success: true,
                hasDealmakertTalent: true,
                player: {
                    skill: 50,
                    roll: 25,
                    success: true,
                    degrees: 3
                },
                merchant: {
                    skill: 40,
                    roll: 35,
                    success: true,
                    degrees: 1
                },
                resultDescription: 'Player wins - 3 vs 1 degrees of success'
            };
            
            const result = tradingEngine.generateHaggleTestMessage(haggleResult);
            
            expect(result).toContain('Haggle Test (with Dealmaker talent)');
            expect(result).toContain('Player');
            expect(result).toContain('Skill:</strong> 50');
            expect(result).toContain('Roll:</strong> 25');
            expect(result).toContain('Success:</strong> Yes');
            expect(result).toContain('Degrees:</strong> 3');
            expect(result).toContain('Merchant');
            expect(result).toContain('Skill:</strong> 40');
            expect(result).toContain('Roll:</strong> 35');
            expect(result).toContain('Player wins - 3 vs 1 degrees');
            expect(result).toContain('Price Effect:</strong> ±20%');
            expect(result).toContain('class="haggle-test-result success"');
        });

        test('should format failed haggle test', () => {
            const haggleResult = {
                success: false,
                hasDealmakertTalent: false,
                player: {
                    skill: 40,
                    roll: 80,
                    success: false,
                    degrees: 4
                },
                merchant: {
                    skill: 45,
                    roll: 30,
                    success: true,
                    degrees: 2
                },
                resultDescription: 'Merchant wins - player failed their test'
            };
            
            const result = tradingEngine.generateHaggleTestMessage(haggleResult);
            
            expect(result).toContain('Haggle Test');
            expect(result).not.toContain('with Dealmaker talent');
            expect(result).toContain('Success:</strong> No');
            expect(result).toContain('Merchant wins');
            expect(result).toContain('Price Effect:</strong> No change');
            expect(result).toContain('class="haggle-test-result failure"');
        });
    });
});