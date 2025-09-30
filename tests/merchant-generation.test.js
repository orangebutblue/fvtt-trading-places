import MerchantGenerator from '../scripts/merchant-generator.js';
import DataManager from '../scripts/data-manager.js';

describe('Merchant Generation', () => {
    let merchantGenerator;
    let mockSettlement;
    let mockDataManager;
    let mockTradingConfig;

    beforeEach(() => {
        // Mock DataManager
        mockDataManager = new DataManager();
        mockDataManager.getCargoType = jest.fn(cargoType => ({
            basePrice: 10, // Mock base price
        }));

        // Mock TradingConfig
        mockTradingConfig = {
            merchantCount: {
                minSlotsPerSize: [1, 2, 4, 8, 16],
                populationMultiplier: 0.001,
                sizeMultiplier: 1,
                flagMultipliers: { Trade: 1.5 },
                hardCap: 50,
            },
            skillDistribution: {
                baseSkill: 30,
                wealthModifier: 5,
                variance: 10,
                minSkill: 10,
                maxSkill: 120,
                percentileTable: {
                    "99": 40,
                    "95": 30,
                    "90": 20,
                    "75": 10,
                    "50": 0,
                    "25": -10,
                    "10": -20
                }
            },
            merchantPersonalities: {
                distributionWeights: {
                    amiable: 20,
                    shrewd: 20,
                    reserved: 20,
                    desperate: 10,
                    defaultProfile: 30
                },
                profiles: {
                    amiable: { priceVariance: 0.1, haggleModifier: 5 },
                    shrewd: { priceVariance: 0.15, haggleModifier: 10 },
                    reserved: { priceVariance: 0.05, haggleModifier: -5 },
                    desperate: { priceVariance: 0.2, haggleModifier: -10 }
                },
                defaultProfile: { priceVariance: 0.1, haggleModifier: 0 }
            },
            specialSourceBehaviors: {},
            desperation: {}
        };

        // Create MerchantGenerator instance
        merchantGenerator = new MerchantGenerator(mockDataManager, mockTradingConfig);

        // Mock settlement
        mockSettlement = {
            name: 'Altdorf',
            region: 'Reikland',
            size: 4, // City
            wealth: 5,
            population: 50000,
            flags: ['Trade']
        };
    });

    describe('generateMerchant', () => {
        test('should generate a valid merchant object', () => {
            const merchant = merchantGenerator.generateMerchant(mockSettlement, 'Grain', 'producer', { supply: 100, demand: 80 });

            expect(merchant).toHaveProperty('id');
            expect(merchant).toHaveProperty('type', 'producer');
            expect(merchant).toHaveProperty('cargoType', 'Grain');
            expect(merchant).toHaveProperty('skill');
            expect(merchant).toHaveProperty('quantity');
            expect(merchant).toHaveProperty('finalPrice');
            expect(merchant).toHaveProperty('personality');
            expect(merchant.settlement.name).toBe('Altdorf');
        });

        test('skill should be within the configured range', () => {
            for (let i = 0; i < 50; i++) { // Run multiple times for randomness
                const merchant = merchantGenerator.generateMerchant(mockSettlement, 'Grain', 'producer', { supply: 100, demand: 80 });
                expect(merchant.skill).toBeGreaterThanOrEqual(mockTradingConfig.skillDistribution.minSkill);
                expect(merchant.skill).toBeLessThanOrEqual(mockTradingConfig.skillDistribution.maxSkill);
            }
        });

        test('should use a specific percentile for skill generation', () => {
            // Test high-end skill
            const highSkillMerchant = merchantGenerator.generateMerchantSkill(mockSettlement, 99);
            expect(highSkillMerchant).toBeGreaterThan(50); // Base(30) + Wealth(20) + Percentile(40) +/- variance

            // Test low-end skill
            const lowSkillMerchant = merchantGenerator.generateMerchantSkill(mockSettlement, 5);
            expect(lowSkillMerchant).toBeLessThan(50); // Base(30) + Wealth(20) + Percentile(-20) +/- variance
        });
    });

    describe('getMerchantSkillDescription', () => {
        test('should return correct descriptions for skill ranges', () => {
            expect(merchantGenerator.getMerchantSkillDescription(21)).toBe('Novice (easily out-haggled)');
            expect(merchantGenerator.getMerchantSkillDescription(35)).toBe('Novice (easily out-haggled)');
            expect(merchantGenerator.getMerchantSkillDescription(36)).toBe('Apprentice (basic bargaining skills)');
            expect(merchantGenerator.getMerchantSkillDescription(50)).toBe('Apprentice (basic bargaining skills)');
            expect(merchantGenerator.getMerchantSkillDescription(51)).toBe('Competent (solid trading experience)');
            expect(merchantGenerator.getMerchantSkillDescription(65)).toBe('Competent (solid trading experience)');
            expect(merchantGenerator.getMerchantSkillDescription(66)).toBe('Skilled (experienced negotiator)');
            expect(merchantGenerator.getMerchantSkillDescription(80)).toBe('Skilled (experienced negotiator)');
            expect(merchantGenerator.getMerchantSkillDescription(81)).toBe('Expert (master of the trade)');
            expect(merchantGenerator.getMerchantSkillDescription(95)).toBe('Expert (master of the trade)');
            expect(merchantGenerator.getMerchantSkillDescription(96)).toBe('Master (legendary trader)');
            expect(merchantGenerator.getMerchantSkillDescription(110)).toBe('Master (legendary trader)');
            expect(merchantGenerator.getMerchantSkillDescription(111)).toBe('Legendary (unmatched in the marketplace)');
            expect(merchantGenerator.getMerchantSkillDescription(120)).toBe('Legendary (unmatched in the marketplace)');
        });
    });
});
