/**
 * Unit tests for ConfigValidator
 */

// Mock FoundryVTT environment for testing
global.window = global.window || {};

// Import the ConfigValidator
require('../scripts/config-validator.js');
const ConfigValidator = window.ConfigValidator || require('../scripts/config-validator.js');

describe('ConfigValidator User Dataset Support', () => {
    let validator;

    beforeEach(() => {
        // Mock Foundry environment
        global.game = {
            settings: {
                get: jest.fn((moduleId, key) => {
                    if (key === 'userDatasets') {
                        return ['test-user-dataset'];
                    }
                    if (key === 'userDatasetsData') {
                        return {
                            'test-user-dataset': {
                                config: {
                                    system: 'wfrp4e',
                                    currency: {
                                        canonicalUnit: { name: 'Brass Penny', value: 1 },
                                        denominations: [
                                            { name: 'Gold Crown', abbreviation: 'GC', value: 240 }
                                        ]
                                    },
                                    inventory: {
                                        field: 'items'
                                    }
                                },
                                settlements: [
                                    {
                                        name: 'Test Settlement',
                                        region: 'Test Region',
                                        size: 'T',
                                        ruler: 'Test Ruler',
                                        population: 1000,
                                        wealth: 3,
                                        garrison: [],
                                        notes: 'Test settlement',
                                        produces: ['Grain']
                                    }
                                ],
                                cargoTypes: [
                                    {
                                        name: 'Grain',
                                        category: 'Bulk Goods',
                                        basePrice: 10,
                                        seasonalModifiers: {
                                            spring: 1.0,
                                            summer: 0.5,
                                            autumn: 0.25,
                                            winter: 0.5
                                        }
                                    }
                                ]
                            }
                        };
                    }
                    return null;
                })
            }
        };

        validator = new ConfigValidator('trading-places');
        validator.isFoundryEnvironment = true;
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('isUserDataset', () => {
        test('should return true for user datasets', () => {
            expect(validator.isUserDataset('test-user-dataset')).toBe(true);
        });

        test('should return false for built-in datasets', () => {
            expect(validator.isUserDataset('wfrp4e')).toBe(false);
        });

        test('should return false when not in Foundry environment', () => {
            validator.isFoundryEnvironment = false;
            expect(validator.isUserDataset('test-user-dataset')).toBe(false);
        });
    });

    describe('validateUserDataset', () => {
        test('should validate a complete user dataset', async () => {
            const result = await validator.validateUserDataset('test-user-dataset');

            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
            expect(result.files.config.accessible).toBe(true);
            expect(result.files.settlements.accessible).toBe(true);
            expect(result.files.cargoTypes.accessible).toBe(true);
            expect(result.statistics.settlements).toBe(1);
            expect(result.statistics.cargoTypes).toBe(1);
        });

        test('should fail validation for missing user dataset', async () => {
            const result = await validator.validateUserDataset('non-existent-dataset');

            expect(result.valid).toBe(false);
            expect(result.errors).toContain("User dataset 'non-existent-dataset' not found in settings");
        });

        test('should fail validation for incomplete user dataset', async () => {
            // Mock incomplete dataset
            global.game.settings.get.mockImplementation((moduleId, key) => {
                if (key === 'userDatasetsData') {
                    return {
                        'incomplete-dataset': {
                            config: {},
                            // missing settlements and cargoTypes
                        }
                    };
                }
                return null;
            });

            const result = await validator.validateUserDataset('incomplete-dataset');

            expect(result.valid).toBe(false);
            expect(result.errors).toContain("User dataset 'incomplete-dataset' missing required data: settlements");
            expect(result.errors).toContain("User dataset 'incomplete-dataset' missing required data: cargoTypes");
        });
    });
});