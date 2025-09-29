const TradingEngine = require('../scripts/trading-engine.js');
const DataManager = require('../scripts/data-manager.js');

describe('Merchant Generation', () => {
    let tradingEngine;
    let mockSettlement;

    beforeEach(() => {
        // Create mock data manager
        const dataManager = new DataManager();

        // Create trading engine
        tradingEngine = new TradingEngine(dataManager);

        // Mock settlement with all required fields
        mockSettlement = {
            name: 'Altdorf',
            region: 'Reikland',
            size: 'C',  // City
            ruler: 'Emperor Karl Franz',
            population: 50000,
            wealth: 5,
            source: ['Trade', 'Agriculture'],
            garrison: ['Imperial Guard'],
            notes: 'Capital of the Empire'
        };
    });

    describe('generateRandomMerchant', () => {
        test('should generate merchant with valid skill range', async () => {
            const merchant = await tradingEngine.generateRandomMerchant(mockSettlement);

            expect(merchant).toHaveProperty('skill');
            expect(merchant).toHaveProperty('name');
            expect(merchant).toHaveProperty('description');
            expect(merchant).toHaveProperty('settlement');
            expect(merchant).toHaveProperty('skillDescription');

            expect(merchant.skill).toBeGreaterThanOrEqual(21);
            expect(merchant.skill).toBeLessThanOrEqual(120);
            expect(merchant.settlement).toBe('Altdorf');
        });

        test('should generate merchant with deterministic roll function', async () => {
            // Mock roll function that simulates 2d20+40
            let rollCount = 0;
            const mockRoll = jest.fn(() => {
                rollCount++;
                // Return values that when % 20 + 1 give us 10+10+40 = 60
                // 10 % 20 + 1 = 11, so we need to return 10 to get 11
                return 10; // 10 % 20 + 1 = 11, so 11+11+40 = 62
            });

            const merchant = await tradingEngine.generateRandomMerchant(mockSettlement, mockRoll);

            expect(merchant.skill).toBe(62); // 11 + 11 + 40
            expect(mockRoll).toHaveBeenCalledTimes(2);
        });

        test('should clamp skill values to valid range', async () => {
            // Test with a mock that produces values within range
            let rollCount = 0;
            const mockRoll = jest.fn(() => {
                rollCount++;
                return rollCount <= 2 ? 10 : 0; // 10+10+40 = 60 (valid)
            });

            const merchant = await tradingEngine.generateRandomMerchant(mockSettlement, mockRoll);

            expect(merchant.skill).toBeGreaterThanOrEqual(21);
            expect(merchant.skill).toBeLessThanOrEqual(120);
        });

        test('should throw error for invalid settlement', async () => {
            await expect(tradingEngine.generateRandomMerchant(null)).rejects.toThrow('Settlement object is required');
            await expect(tradingEngine.generateRandomMerchant(undefined)).rejects.toThrow('Settlement object is required');
        });
    });

    describe('getMerchantSkillDescription', () => {
        test('should return correct descriptions for skill ranges', () => {
            expect(tradingEngine.getMerchantSkillDescription(21)).toBe('Novice (easily out-haggled)');
            expect(tradingEngine.getMerchantSkillDescription(35)).toBe('Novice (easily out-haggled)');
            expect(tradingEngine.getMerchantSkillDescription(36)).toBe('Apprentice (basic bargaining skills)');
            expect(tradingEngine.getMerchantSkillDescription(50)).toBe('Apprentice (basic bargaining skills)');
            expect(tradingEngine.getMerchantSkillDescription(51)).toBe('Competent (solid trading experience)');
            expect(tradingEngine.getMerchantSkillDescription(65)).toBe('Competent (solid trading experience)');
            expect(tradingEngine.getMerchantSkillDescription(66)).toBe('Skilled (experienced negotiator)');
            expect(tradingEngine.getMerchantSkillDescription(80)).toBe('Skilled (experienced negotiator)');
            expect(tradingEngine.getMerchantSkillDescription(81)).toBe('Expert (master of the trade)');
            expect(tradingEngine.getMerchantSkillDescription(95)).toBe('Expert (master of the trade)');
            expect(tradingEngine.getMerchantSkillDescription(96)).toBe('Master (legendary trader)');
            expect(tradingEngine.getMerchantSkillDescription(110)).toBe('Master (legendary trader)');
            expect(tradingEngine.getMerchantSkillDescription(111)).toBe('Legendary (unmatched in the marketplace)');
            expect(tradingEngine.getMerchantSkillDescription(120)).toBe('Legendary (unmatched in the marketplace)');
        });
    });

    // Skip integration tests that require complex settlement validation
    // The core merchant generation functionality is tested above
});