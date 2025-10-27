/**
 * Unit tests for dice integration and skill test mechanics
 */

const { TradingEngine } = require('../scripts/trading-engine');
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
            if (setting === 'currentSeason') return 'spring';
            return null;
        },
        set: jest.fn().mockResolvedValue(true)
    },
    user: { id: 'test-user' }
};

global.CONST = {
    CHAT_MESSAGE_TYPES: {
        OTHER: 0
    }
};

describe('TradingEngine - Dice Integration', () => {
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
                basePrices: { spring: 2, summer: 3, autumn: 1, winter: 4 }
            },
            {
                name: 'Wine',
                category: 'Luxury',
                basePrices: { spring: 5, summer: 4, autumn: 6, winter: 7 }
            }
        ];

        // Set up trading config for merchant generation
        dataManager.tradingConfig = {
            skillDistribution: {
                type: 'piecewise',
                baseSkill: 25,
                wealthModifier: 8,
                variance: 20,
                percentileTable: {
                    "10": -15,
                    "25": -8,
                    "50": 0,
                    "75": 8,
                    "90": 15,
                    "95": 25,
                    "99": 35
                },
                minSkill: 5,
                maxSkill: 95
            }
        };

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

    describe('rollDice', () => {
        test('should roll dice using FoundryVTT Roll class', async () => {
            const result = await tradingEngine.rollDice('1d100', { flavor: 'Test Roll' });
            
            expect(result).toBeDefined();
            expect(result.total).toBeGreaterThanOrEqual(1);
            expect(result.total).toBeLessThanOrEqual(100);
            expect(result.formula).toBe('1d100');
        });

        test('should handle dice rolls without flavor text', async () => {
            const result = await tradingEngine.rollDice('1d100');
            
            expect(result).toBeDefined();
            expect(result.total).toBeGreaterThanOrEqual(1);
            expect(result.total).toBeLessThanOrEqual(100);
        });
    });

    describe('rollAvailability', () => {
        test('should roll availability check with proper flavor', async () => {
            const result = await tradingEngine.rollAvailability(mockSettlement, 'Grain');
            
            expect(result).toBeDefined();
            expect(typeof result).toBe('boolean');
        });
    });

    describe('rollCargoSize', () => {
        test('should roll cargo size determination', async () => {
            const result = await tradingEngine.rollCargoSize(mockSettlement);
            
            expect(result).toBeDefined();
            expect(result.totalSize).toBeGreaterThan(0);
            expect(result.roll).toBeGreaterThanOrEqual(1);
            expect(result.roll).toBeLessThanOrEqual(100);
        });
    });

    describe('rollBuyerAvailability', () => {
        test('should roll buyer availability check', async () => {
            const result = await tradingEngine.rollBuyerAvailability(mockSettlement, 'Grain');
            
            expect(result).toBeDefined();
            expect(typeof result).toBe('boolean');
        });
    });

    describe('checkCargoAvailability with dice integration', () => {
        test('should use FoundryVTT dice roller when no roll function provided', async () => {
            const result = await tradingEngine.checkCargoAvailability(mockSettlement);
            
            expect(result).toBeDefined();
            expect(result.available).toBeDefined();
            expect(result.chance).toBe(70); // (3 + 4) * 10
            expect(result.roll).toBeGreaterThanOrEqual(1);
            expect(result.roll).toBeLessThanOrEqual(100);
            expect(result.rollResult).toBeDefined();
            expect(result.rollResult.total).toBe(result.roll);
        });

        test('should use provided roll function for testing', async () => {
            const mockRoll = jest.fn().mockReturnValue(50);
            const result = await tradingEngine.checkCargoAvailability(mockSettlement, mockRoll);
            
            expect(result.roll).toBe(50);
            expect(result.available).toBe(true); // 50 <= 70
            expect(mockRoll).toHaveBeenCalledTimes(1);
        });
    });

    describe('calculateCargoSize with dice integration', () => {
        test('should use FoundryVTT dice roller for non-trade settlement', async () => {
            dataManager.isTradeSettlement.mockReturnValue(false);
            
            const result = await tradingEngine.calculateCargoSize(mockSettlement);
            
            expect(result).toBeDefined();
            expect(result.totalSize).toBeGreaterThan(0);
            expect(result.baseMultiplier).toBe(7); // 3 + 4
            expect(result.roll1).toBeGreaterThanOrEqual(1);
            expect(result.roll1).toBeLessThanOrEqual(100);
            expect(result.roll1Result).toBeDefined();
            expect(result.roll2).toBeNull();
            expect(result.tradeBonus).toBe(false);
        });

        test('should roll twice for trade settlements', async () => {
            dataManager.isTradeSettlement.mockReturnValue(true);
            
            const result = await tradingEngine.calculateCargoSize(mockSettlement);
            
            expect(result).toBeDefined();
            expect(result.totalSize).toBeGreaterThan(0);
            expect(result.baseMultiplier).toBe(7); // 3 + 4
            expect(result.roll1).toBeGreaterThanOrEqual(1);
            expect(result.roll1).toBeLessThanOrEqual(100);
            expect(result.roll2).toBeGreaterThanOrEqual(1);
            expect(result.roll2).toBeLessThanOrEqual(100);
            expect(result.tradeBonus).toBe(true);
        });

        test('should use provided roll function for testing', async () => {
            const mockRoll = jest.fn()
                .mockReturnValueOnce(30)
                .mockReturnValueOnce(80);
            
            const result = await tradingEngine.calculateCargoSize(mockSettlement, mockRoll);
            
            expect(result.roll1).toBe(30);
            expect(result.roll2).toBe(80);
            expect(result.sizeMultiplier).toBe(80); // Higher of 30 and 80, rounded up to nearest 10
            expect(mockRoll).toHaveBeenCalledTimes(2); // Trade settlement rolls twice
        });
    });

    describe('findBuyer with dice integration', () => {
        test('should use FoundryVTT dice roller when no roll function provided', async () => {
            const result = await tradingEngine.findBuyer(mockSettlement, 'Grain');
            
            expect(result).toBeDefined();
            expect(result.buyerFound).toBeDefined();
            expect(result.chance).toBe(60); // (3 * 10) + 30 for Trade settlement
            expect(result.roll).toBeGreaterThanOrEqual(1);
            expect(result.roll).toBeLessThanOrEqual(100);
            expect(result.rollResult).toBeDefined();
        });

        test('should handle zero chance scenarios', async () => {
            // Mock village (size 1) trying to sell non-Grain in winter
            dataManager.getSettlementProperties.mockReturnValue({
                sizeNumeric: 1,
                wealthRating: 2
            });
            dataManager.isTradeSettlement.mockReturnValue(false);
            tradingEngine.setCurrentSeason('winter');
            
            const result = await tradingEngine.findBuyer(mockSettlement, 'Wine');
            
            expect(result.buyerFound).toBe(false);
            expect(result.chance).toBe(0);
            expect(result.roll).toBeNull();
            expect(result.rollResult).toBeNull();
            expect(result.partialSaleOption).toBe(false);
        });
    });

    describe('postChatMessage', () => {
        test('should create chat message with proper visibility', async () => {
            const result = await tradingEngine.postChatMessage('Test message');
            
            expect(result).toBeDefined();
            expect(result.content).toBe('Test message');
        });

        test('should handle whisper option', async () => {
            const result = await tradingEngine.postChatMessage('Secret message', { whisper: true });
            
            expect(result).toBeDefined();
            expect(result.content).toBe('Secret message');
        });
    });

    describe('generateRollResultMessage', () => {
        test('should format roll result with target', () => {
            const mockRoll = { total: 45, formula: '1d100' };
            const result = tradingEngine.generateRollResultMessage(
                mockRoll, 
                'Availability Check', 
                { target: 60, details: 'Settlement: Averheim' }
            );
            
            expect(result).toContain('Availability Check');
            expect(result).toContain('Roll:</strong> 45');
            expect(result).toContain('Target:</strong> 60');
            expect(result).toContain('Success');
            expect(result).toContain('Settlement: Averheim');
        });

        test('should format roll result without target', () => {
            const mockRoll = { total: 75, formula: '1d100' };
            const result = tradingEngine.generateRollResultMessage(mockRoll, 'Cargo Size');
            
            expect(result).toContain('Cargo Size');
            expect(result).toContain('Roll:</strong> 75');
            expect(result).not.toContain('Target:');
            expect(result).not.toContain('Success');
        });
    });

    describe('generateTransactionResultMessage', () => {
        test('should format transaction result with modifiers', () => {
            const result = tradingEngine.generateTransactionResultMessage(
                'purchase',
                'Grain',
                50,
                90,
                { name: 'Averheim' },
                {
                    modifiers: [{ description: 'Successful haggle' }]
                }
            );
            
            expect(result).toContain('purchased 50 EP of Grain from Averheim for 90 GC');
            expect(result).toContain('Successful haggle');
        });

        test('should format transaction result without modifiers', () => {
            const result = tradingEngine.generateTransactionResultMessage(
                'sale',
                'Wine',
                20,
                100,
                { name: 'Nuln' },
                {}
            );
            
            expect(result).toContain('sold 20 EP of Wine to Nuln for 100 GC');
        });
    });
});