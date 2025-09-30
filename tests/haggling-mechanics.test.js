/**
 * Unit tests for haggling and skill test mechanics
 */

import HagglingMechanics from '../scripts/haggling-mechanics.js';
import DataManager from '../scripts/data-manager.js';

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

describe('HagglingMechanics', () => {
    let dataManager;
    let hagglingMechanics;
    let mockTradingConfig;

    beforeEach(() => {
        // Create mock data manager
        dataManager = new DataManager();

        // Mock TradingConfig
        mockTradingConfig = {
            skillTest: {
                difficultyModifiers: {
                    gossip: -10
                }
            }
        };

        hagglingMechanics = new HagglingMechanics(dataManager, mockTradingConfig);
    });

    describe('performHaggleTest', () => {
        test('should validate input parameters', async () => {
            await expect(hagglingMechanics.performHaggleTest(-5, 40)).rejects.toThrow('Player skill must be a number between 0 and 100');
            await expect(hagglingMechanics.performHaggleTest(105, 40)).rejects.toThrow('Player skill must be a number between 0 and 100');
            await expect(hagglingMechanics.performHaggleTest(50, -5)).rejects.toThrow('Merchant skill must be a number between 0 and 100');
            await expect(hagglingMechanics.performHaggleTest(50, 105)).rejects.toThrow('Merchant skill must be a number between 0 and 100');
        });

        test('should handle player success vs merchant failure', async () => {
            const mockRoll = jest.fn()
                .mockResolvedValueOnce(30) // Player roll (success at skill 50)
                .mockResolvedValueOnce(80); // Merchant roll (failure at skill 40)
            
            const result = await hagglingMechanics.performHaggleTest(50, 40, false, {}, mockRoll);
            
            expect(result.success).toBe(true);
            expect(result.player.success).toBe(true);
            expect(result.merchant.success).toBe(false);
            expect(result.resultDescription).toContain('Player wins - merchant failed their test');
        });

        test('should handle player failure vs merchant success', async () => {
            const mockRoll = jest.fn()
                .mockResolvedValueOnce(80) // Player roll (failure at skill 50)
                .mockResolvedValueOnce(30); // Merchant roll (success at skill 40)
            
            const result = await hagglingMechanics.performHaggleTest(50, 40, false, {}, mockRoll);
            
            expect(result.success).toBe(false);
            expect(result.player.success).toBe(false);
            expect(result.merchant.success).toBe(true);
            expect(result.resultDescription).toContain('Merchant wins - player failed their test');
        });

        test('should handle both success - compare degrees', async () => {
            const mockRoll = jest.fn()
                .mockResolvedValueOnce(20) // Player roll (success at skill 50, 3 degrees)
                .mockResolvedValueOnce(35); // Merchant roll (success at skill 40, 1 degree)
            
            const result = await hagglingMechanics.performHaggleTest(50, 40, false, {}, mockRoll);
            
            expect(result.success).toBe(true);
            expect(result.player.success).toBe(true);
            expect(result.merchant.success).toBe(true);
            expect(result.player.degrees).toBe(4);
            expect(result.merchant.degrees).toBe(1);
            expect(result.resultDescription).toContain('Player wins - 4 vs 1 degrees of success');
        });

        test('should handle both failure - compare degrees', async () => {
            const mockRoll = jest.fn()
                .mockResolvedValueOnce(60) // Player roll (failure at skill 50, 1 degree)
                .mockResolvedValueOnce(70); // Merchant roll (failure at skill 40, 3 degrees)
            
            const result = await hagglingMechanics.performHaggleTest(50, 40, false, {}, mockRoll);
            
            expect(result.success).toBe(true);
            expect(result.player.success).toBe(false);
            expect(result.merchant.success).toBe(false);
            expect(result.player.degrees).toBe(1);
            expect(result.merchant.degrees).toBe(3);
            expect(result.resultDescription).toContain('Player wins - 1 vs 3 degrees of failure');
        });

        test('should handle ties', async () => {
            const mockRoll = jest.fn()
                .mockResolvedValueOnce(40) // Player roll (success at skill 50, 1 degree)
                .mockResolvedValueOnce(30); // Merchant roll (success at skill 40, 1 degree)
            
            const result = await hagglingMechanics.performHaggleTest(50, 40, false, {}, mockRoll);
            
            expect(result.success).toBe(false);
            expect(result.resultDescription).toContain('Tie - no price change');
        });

        test('should track Dealmaker talent', async () => {
            const mockRoll = jest.fn()
                .mockResolvedValueOnce(30)
                .mockResolvedValueOnce(80);
            
            const result = await hagglingMechanics.performHaggleTest(50, 40, true, {}, mockRoll);
            
            expect(result.hasDealmakertTalent).toBe(true);
            expect(result.success).toBe(true);
        });
    });

    describe('performGossipTest', () => {
        test('should validate input parameters', async () => {
            await expect(hagglingMechanics.performGossipTest(-5)).rejects.toThrow('Player skill must be a number between 0 and 100');
            await expect(hagglingMechanics.performGossipTest(105)).rejects.toThrow('Player skill must be a number between 0 and 100');
        });

        test('should apply default difficulty modifier', async () => {
            const mockRoll = jest.fn().mockResolvedValue(35);
            const result = await hagglingMechanics.performGossipTest(50, {}, mockRoll);
            expect(result.totalModifier).toBe(-10);
            expect(result.modifiedSkill).toBe(40); // 50 - 10
            expect(result.success).toBe(true); // 35 <= 40
        });

        test('should apply custom difficulty modifier', async () => {
            const mockRoll = jest.fn().mockResolvedValue(35);
            const result = await hagglingMechanics.performGossipTest(50, { difficulty: -20 }, mockRoll);
            expect(result.totalModifier).toBe(-20);
            expect(result.modifiedSkill).toBe(30); // 50 - 20
            expect(result.success).toBe(false); // 35 > 30
        });

        test('should calculate degrees of success/failure', async () => {
            const mockRoll = jest.fn().mockResolvedValue(20);
            const result = await hagglingMechanics.performGossipTest(50, {}, mockRoll);
            expect(result.success).toBe(true);
            expect(result.degrees).toBe(3);
            expect(result.resultDescription).toContain('Success (3 degrees)');
        });
    });

    describe('performSkillTest', () => {
        test('should validate base skill parameter', async () => {
            await expect(hagglingMechanics.performSkillTest(-5)).rejects.toThrow('Base skill must be a number between 0 and 100');
            await expect(hagglingMechanics.performSkillTest(105)).rejects.toThrow('Base skill must be a number between 0 and 100');
        });

        test('should apply modifiers correctly', async () => {
            const modifiers = [
                { name: 'Talent Bonus', value: 10, description: 'Skilled talent' },
                { name: 'Difficulty', value: -20, description: 'Hard test' }
            ];
            const mockRoll = jest.fn().mockResolvedValue(35);
            
            const result = await hagglingMechanics.performSkillTest(50, modifiers, 'Custom Test', mockRoll);
            
            expect(result.baseSkill).toBe(50);
            expect(result.modifiedSkill).toBe(40); // 50 + 10 - 20
            expect(result.success).toBe(true); // 35 <= 40
            expect(result.modifiers).toHaveLength(2);
            expect(result.testName).toBe('Custom Test');
        });

        test('should enforce skill bounds', async () => {
            const modifiers = [{ name: 'Huge Penalty', value: -60, description: 'Very hard' }];
            const mockRoll = jest.fn().mockResolvedValue(50);
            
            const result = await hagglingMechanics.performSkillTest(50, modifiers, 'Bounded Test', mockRoll);
            
            expect(result.modifiedSkill).toBe(0); // Max(0, 50 - 60)
            expect(result.success).toBe(false);
        });

        test('should calculate degrees correctly', async () => {
            const mockRoll = jest.fn().mockResolvedValue(25);
            
            const result = await hagglingMechanics.performSkillTest(60, [], 'Degree Test', mockRoll);
            
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
            
            const result = hagglingMechanics.generateSkillTestMessage(testResult);
            
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
            
            const result = hagglingMechanics.generateSkillTestMessage(testResult);
            
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
            
            const result = hagglingMechanics.generateHaggleTestMessage(haggleResult);
            
            expect(result).toContain('Haggle Test (with Dealmaker talent)');
            expect(result).toContain('Player');
            expect(result).toContain('Skill:</strong> 50');
            expect(result).toContain('Roll:</strong> 25');
            expect(result).toContain('Success:</strong> Yes');
            expect(result).toContain('Degrees:</strong> 3');
            expect(result).toContain('Merchant');
            expect(result).toContain('Skill:</strong> 40');
            expect(result).toContain('Roll:</strong> 35');
            expect(result).toContain('Player wins - 3 vs 1 degrees of success');
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
            
            const result = hagglingMechanics.generateHaggleTestMessage(haggleResult);
            
            expect(result).toContain('Haggle Test');
            expect(result).not.toContain('with Dealmaker talent');
            expect(result).toContain('Success:</strong> No');
            expect(result).toContain('Merchant wins');
            expect(result).toContain('Price Effect:</strong> No change');
            expect(result).toContain('class="haggle-test-result failure"');
        });
    });
});
