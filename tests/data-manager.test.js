/**
 * Unit tests for DataManager validation functions
 */

// Mock FoundryVTT environment for testing
global.window = global.window || {};

// Import the DataManager
require('../scripts/data-manager.js');
const DataManager = window.TradingPlacesDataManager;
const fs = require('fs');
const path = require('path');

const datasetsRoot = path.join(__dirname, '../datasets');

// Since we now dynamically discover datasets, we'll use the wfrp4e dataset directly
const activeDatasetDir = path.join(datasetsRoot, 'wfrp4e');

describe('DataManager Settlement Validation', () => {
    let dataManager;

    beforeEach(() => {
        dataManager = new DataManager();
        
        // Load test data similar to season-management.test.js
        try {
            const settlementsDir = path.join(activeDatasetDir, 'settlements');
            const regionFiles = fs.readdirSync(settlementsDir).filter(f => f.endsWith('.json'));
            const settlementsData = { settlements: [] };
            
            // Load all regional settlement files
            regionFiles.forEach(file => {
                const filePath = path.join(settlementsDir, file);
                const regionSettlements = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                settlementsData.settlements.push(...regionSettlements);
            });
            
            const cargoData = JSON.parse(fs.readFileSync(path.join(activeDatasetDir, 'cargo-types.json'), 'utf8'));
            const configData = JSON.parse(fs.readFileSync(path.join(activeDatasetDir, 'config.json'), 'utf8'));

            dataManager.settlements = settlementsData.settlements || [];
            dataManager.cargoTypes = cargoData.cargoTypes || [];
            dataManager.config = configData;
        } catch (error) {
            console.warn('Could not load test data:', error.message);
            // Continue with empty data for basic validation tests
        }
    });

    describe('validateSettlement', () => {
        test('should validate a complete valid settlement', () => {
            const validSettlement = {
                region: 'Empire',
                name: 'Averheim',
                size: 'T',
                ruler: 'Grand Count Marius Leitdorf',
                population: 9400,
                wealth: 4,
                source: ['Trade', 'Government', 'Cattle', 'Agriculture'],
                garrison: ['35a', '80b', '350c'],
                notes: 'Provincial Capital. Known for the stockyards outside the city.'
            };

            const result = dataManager.validateSettlement(validSettlement);
            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        test('should fail validation for missing required fields', () => {
            const incompleteSettlement = {
                name: 'Test Settlement',
                size: 'V'
                // Missing: region, ruler, population, wealth, source, garrison, notes
            };

            const result = dataManager.validateSettlement(incompleteSettlement);
            expect(result.valid).toBe(false);
            expect(result.errors[0]).toContain('Missing required fields');
            expect(result.errors[0]).toContain('region');
            expect(result.errors[0]).toContain('ruler');
            expect(result.errors[0]).toContain('population');
            expect(result.errors[0]).toContain('wealth');
            expect(result.errors[0]).toContain('notes');
        });

        test('should fail validation for invalid population type', () => {
            const settlement = {
                region: 'Empire',
                name: 'Test',
                size: 'V',
                ruler: 'Test Ruler',
                population: 'not a number',
                wealth: 3,
                source: ['Agriculture'],
                garrison: [],
                notes: 'Test notes'
            };

            const result = dataManager.validateSettlement(settlement);
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Population must be a positive number');
        });

        test('should fail validation for negative population', () => {
            const settlement = {
                region: 'Empire',
                name: 'Test',
                size: 'V',
                ruler: 'Test Ruler',
                population: -100,
                wealth: 3,
                source: ['Agriculture'],
                garrison: [],
                notes: 'Test notes'
            };

            const result = dataManager.validateSettlement(settlement);
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Population must be a positive number');
        });

        test('should fail validation for invalid wealth range', () => {
            const settlement = {
                region: 'Empire',
                name: 'Test',
                size: 'V',
                ruler: 'Test Ruler',
                population: 100,
                wealth: 6, // Invalid: must be 1-5
                source: ['Agriculture'],
                garrison: [],
                notes: 'Test notes'
            };

            const result = dataManager.validateSettlement(settlement);
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Wealth must be a number between 1-5');
        });

        test('should fail validation for non-array source', () => {
            const settlement = {
                region: 'Empire',
                name: 'Test',
                size: 'V',
                ruler: 'Test Ruler',
                population: 100,
                wealth: 3,
                source: 'Agriculture', // Should be array
                garrison: [],
                notes: 'Test notes'
            };

            const result = dataManager.validateSettlement(settlement);
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Source must be an array');
        });

        test('should fail validation for empty source array', () => {
            const settlement = {
                region: 'Empire',
                name: 'Test',
                size: 'V',
                ruler: 'Test Ruler',
                population: 100,
                wealth: 3,
                source: [], // Empty array not allowed
                garrison: [],
                notes: 'Test notes'
            };

            const result = dataManager.validateSettlement(settlement);
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Source array cannot be empty');
        });

        test('should fail validation for invalid size enumeration', () => {
            const settlement = {
                region: 'Empire',
                name: 'Test',
                size: 'INVALID', // Invalid size
                ruler: 'Test Ruler',
                population: 100,
                wealth: 3,
                source: ['Agriculture'],
                garrison: [],
                notes: 'Test notes'
            };

            const result = dataManager.validateSettlement(settlement);
            expect(result.valid).toBe(false);
            expect(result.errors[0]).toContain('Size must be one of: CS, C, T, ST, V, F, M');
        });

        test('should fail validation for empty string fields', () => {
            const settlement = {
                region: '', // Empty string
                name: 'Test',
                size: 'V',
                ruler: '   ', // Whitespace only
                population: 100,
                wealth: 3,
                source: ['Agriculture'],
                garrison: [],
                notes: 'Test notes'
            };

            const result = dataManager.validateSettlement(settlement);
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('region must be a non-empty string');
            expect(result.errors).toContain('ruler must be a non-empty string');
        });

        test('should fail validation for non-array garrison', () => {
            const settlement = {
                region: 'Empire',
                name: 'Test',
                size: 'V',
                ruler: 'Test Ruler',
                population: 100,
                wealth: 3,
                source: ['Agriculture'],
                garrison: 'not an array',
                notes: 'Test notes'
            };

            const result = dataManager.validateSettlement(settlement);
            expect(result.valid).toBe(false);
            const errorText = Array.isArray(result.errors) ? result.errors.join(' ') : String(result.errors);
            expect(errorText).toContain('garrison');
            expect(errorText.toLowerCase()).toContain('array');
        });
    });

    describe('validateDatasetStructure', () => {
        test('should validate a complete valid dataset', () => {
            const validDataset = {
                settlements: [
                    {
                        region: 'Empire',
                        name: 'Averheim',
                        size: 'T',
                        ruler: 'Grand Count Marius Leitdorf',
                        population: 9400,
                        wealth: 4,
                        source: ['Trade', 'Government'],
                        garrison: ['35a', '80b'],
                        notes: 'Provincial Capital'
                    }
                ],
                config: {
                    currency: {
                        canonicalUnit: { name: 'Brass Penny', abbreviation: 'BP', value: 1 },
                        denominations: [
                            { name: 'Gold Crown', abbreviation: 'GC', value: 240 },
                            { name: 'Silver Shilling', abbreviation: 'SS', value: 12 },
                            { name: 'Brass Penny', abbreviation: 'BP', value: 1 }
                        ]
                    },
                    inventory: {
                        field: 'items'
                    }
                }
            };

            const result = dataManager.validateDatasetStructure(validDataset);
            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        test('should fail validation for missing settlements array', () => {
            const invalidDataset = {
                config: {
                    currency: { field: 'data.money.gc' },
                    inventory: { field: 'data.items' }
                }
            };

            const result = dataManager.validateDatasetStructure(invalidDataset);
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Dataset must contain a settlements array');
        });

        test('should fail validation for missing config object', () => {
            const invalidDataset = {
                settlements: []
            };

            const result = dataManager.validateDatasetStructure(invalidDataset);
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Dataset must contain a config object');
        });

        test('should fail validation for invalid settlement in array', () => {
            const invalidDataset = {
                settlements: [
                    {
                        name: 'Incomplete Settlement'
                        // Missing required fields
                    }
                ],
                config: {
                    currency: { field: 'data.money.gc' },
                    inventory: { field: 'data.items' }
                }
            };

            const result = dataManager.validateDatasetStructure(invalidDataset);
            expect(result.valid).toBe(false);
            expect(result.errors[0]).toContain('Settlement 0 (Incomplete Settlement)');
            expect(result.errors[0]).toContain('Missing required fields');
        });

        test('should fail validation for missing config sections', () => {
            const invalidDataset = {
                settlements: [],
                config: {
                    // Missing currency and inventory sections
                }
            };

            const result = dataManager.validateDatasetStructure(invalidDataset);
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Config missing required section: currency');
            expect(result.errors).toContain('Config missing required section: inventory');
        });

        test('should fail validation for invalid currency config', () => {
            const invalidDataset = {
                settlements: [],
                config: {
                    currency: {
                        // Missing canonicalUnit and denominations
                    },
                    inventory: {
                        field: 'data.items'
                    }
                }
            };

            const result = dataManager.validateDatasetStructure(invalidDataset);
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Config currency.canonicalUnit must define a numeric value');
            expect(result.errors).toContain('Config currency.denominations must be a non-empty array');
        });
    });

    describe('generateDiagnosticReport', () => {
        test('should generate formatted report for errors', () => {
            const errors = [
                'Missing required field: name',
                'Invalid wealth value: 6',
                'Source must be an array'
            ];

            const report = dataManager.generateDiagnosticReport(errors);
            expect(report).toContain('Dataset Validation Failed:');
            expect(report).toContain('1. Missing required field: name');
            expect(report).toContain('2. Invalid wealth value: 6');
            expect(report).toContain('3. Source must be an array');
            expect(report).toContain('Please fix these issues');
        });

        test('should return success message for no errors', () => {
            const report = dataManager.generateDiagnosticReport([]);
            expect(report).toBe('No validation errors found.');
        });
    });

    describe('validateDatasetCompleteness', () => {
        test('should include diagnostic report for invalid dataset', () => {
            const invalidDataset = {
                settlements: [],
                config: {}
            };

            const result = dataManager.validateDatasetCompleteness(invalidDataset);
            expect(result.valid).toBe(false);
            expect(result.diagnosticReport).toBeDefined();
            expect(result.diagnosticReport).toContain('Dataset Validation Failed:');
        });

        test('should not include diagnostic report for valid dataset', () => {
            const validDataset = {
                settlements: [],
                config: {
                    currency: {
                        canonicalUnit: { name: 'Brass Penny', abbreviation: 'BP', value: 1 },
                        denominations: [
                            { name: 'Gold Crown', abbreviation: 'GC', value: 240 },
                            { name: 'Silver Shilling', abbreviation: 'SS', value: 12 },
                            { name: 'Brass Penny', abbreviation: 'BP', value: 1 }
                        ]
                    },
                    inventory: { field: 'data.items' }
                }
            };

            const result = dataManager.validateDatasetCompleteness(validDataset);
            expect(result.valid).toBe(true);
            expect(result.diagnosticReport).toBeUndefined();
        });
    });

    describe('Cargo Data Models and Seasonal Pricing', () => {
        describe('validateCargo', () => {
            test('should validate a complete valid cargo object', () => {
                const validCargo = {
                    name: 'Grain',
                    category: 'Agriculture',
                    basePrices: {
                        spring: 2,
                        summer: 3,
                        autumn: 1,
                        winter: 4
                    },
                    deteriorationRate: 0.1,
                    specialRules: []
                };

                const result = dataManager.validateCargo(validCargo);
                expect(result.valid).toBe(true);
                expect(result.errors).toHaveLength(0);
            });

            test('should validate cargo with quality tiers (wine/brandy)', () => {
                const wineCargo = {
                    name: 'Wine',
                    category: 'Luxury',
                    basePrices: {
                        spring: 10,
                        summer: 12,
                        autumn: 8,
                        winter: 15
                    },
                    qualityTiers: {
                        poor: 0.5,
                        average: 1.0,
                        good: 1.5,
                        excellent: 2.0
                    }
                };

                const result = dataManager.validateCargo(wineCargo);
                expect(result.valid).toBe(true);
                expect(result.errors).toHaveLength(0);
            });

            test('should fail validation for missing required fields', () => {
                const incompleteCargo = {
                    name: 'Test Cargo'
                    // Missing: category, pricing data
                };

                const result = dataManager.validateCargo(incompleteCargo);
                expect(result.valid).toBe(false);
                expect(result.errors[0]).toContain('Missing required fields');
                expect(result.errors[0]).toContain('category');
                expect(result.errors[0]).toContain('basePrice + seasonalModifiers (or basePrices)');
            });

            test('should fail validation for invalid name', () => {
                const cargo = {
                    name: '',
                    category: 'Agriculture',
                    basePrices: { spring: 1, summer: 2, autumn: 1, winter: 3 }
                };

                const result = dataManager.validateCargo(cargo);
                expect(result.valid).toBe(false);
                expect(result.errors).toContain('Name must be a non-empty string');
            });

            test('should fail validation for missing seasonal prices', () => {
                const cargo = {
                    name: 'Test Cargo',
                    category: 'Agriculture',
                    basePrices: {
                        spring: 1,
                        summer: 2
                        // Missing: autumn, winter
                    }
                };

                const result = dataManager.validateCargo(cargo);
                expect(result.valid).toBe(false);
                expect(result.errors[0]).toContain('BasePrices missing or invalid for seasons: autumn, winter');
            });

            test('should fail validation for negative prices', () => {
                const cargo = {
                    name: 'Test Cargo',
                    category: 'Agriculture',
                    basePrices: {
                        spring: -1,
                        summer: 2,
                        autumn: 1,
                        winter: 3
                    }
                };

                const result = dataManager.validateCargo(cargo);
                expect(result.valid).toBe(false);
                expect(result.errors).toContain('BasePrices.spring must be a non-negative number');
            });

            test('should fail validation for invalid quality tiers', () => {
                const cargo = {
                    name: 'Wine',
                    category: 'Luxury',
                    basePrices: { spring: 10, summer: 12, autumn: 8, winter: 15 },
                    qualityTiers: {
                        poor: -0.5, // Invalid negative multiplier
                        average: 1.0
                    }
                };

                const result = dataManager.validateCargo(cargo);
                expect(result.valid).toBe(false);
                expect(result.errors).toContain('QualityTiers.poor must be a positive number');
            });

            test('should fail validation for invalid deterioration rate', () => {
                const cargo = {
                    name: 'Test Cargo',
                    category: 'Agriculture',
                    basePrices: { spring: 1, summer: 2, autumn: 1, winter: 3 },
                    deteriorationRate: 1.5 // Invalid: must be 0-1
                };

                const result = dataManager.validateCargo(cargo);
                expect(result.valid).toBe(false);
                expect(result.errors).toContain('DeteriorationRate must be a number between 0 and 1');
            });
        });

        describe('getSeasonalPrice', () => {
            const testCargo = {
                name: 'Grain',
                category: 'Agriculture',
                basePrices: {
                    spring: 2,
                    summer: 3,
                    autumn: 1,
                    winter: 4
                }
            };

            test('should return correct seasonal price', () => {
                expect(dataManager.getSeasonalPrice(testCargo, 'spring')).toBe(2);
                expect(dataManager.getSeasonalPrice(testCargo, 'summer')).toBe(3);
                expect(dataManager.getSeasonalPrice(testCargo, 'autumn')).toBe(1);
                expect(dataManager.getSeasonalPrice(testCargo, 'winter')).toBe(4);
            });

            test('should apply quality tier multipliers for wine/brandy', () => {
                const wineCargo = {
                    name: 'Wine',
                    basePrices: { spring: 10, summer: 12, autumn: 8, winter: 15 },
                    qualityTiers: {
                        poor: 0.5,
                        average: 1.0,
                        good: 1.5,
                        excellent: 2.0
                    }
                };

                expect(dataManager.getSeasonalPrice(wineCargo, 'spring', 'poor')).toBe(5);
                expect(dataManager.getSeasonalPrice(wineCargo, 'spring', 'average')).toBe(10);
                expect(dataManager.getSeasonalPrice(wineCargo, 'spring', 'good')).toBe(15);
                expect(dataManager.getSeasonalPrice(wineCargo, 'spring', 'excellent')).toBe(20);
            });

            test('should throw error for invalid season', () => {
                expect(() => {
                    dataManager.getSeasonalPrice(testCargo, 'invalid');
                }).toThrow('Invalid season: invalid');
            });

            test('should throw error for missing cargo data', () => {
                expect(() => {
                    dataManager.getSeasonalPrice(null, 'spring');
                }).toThrow('Invalid cargo object');
            });
        });

        describe('getAllSeasonalPrices', () => {
            test('should return all seasonal prices', () => {
                const testCargo = {
                    basePrices: {
                        spring: 2,
                        summer: 3,
                        autumn: 1,
                        winter: 4
                    }
                };

                const prices = dataManager.getAllSeasonalPrices(testCargo);
                expect(prices).toEqual({
                    spring: 2,
                    summer: 3,
                    autumn: 1,
                    winter: 4
                });
            });

            test('should apply quality tier to all seasons', () => {
                const wineCargo = {
                    basePrices: { spring: 10, summer: 12, autumn: 8, winter: 15 },
                    qualityTiers: { poor: 0.5, average: 1.0, good: 1.5 }
                };

                const prices = dataManager.getAllSeasonalPrices(wineCargo, 'good');
                expect(prices).toEqual({
                    spring: 15,
                    summer: 18,
                    autumn: 12,
                    winter: 22.5
                });
            });
        });

        describe('calculateQualityPrice', () => {
            test('should return base price for cargo without quality tiers', () => {
                const cargo = { name: 'Grain' };
                expect(dataManager.calculateQualityPrice(100, cargo)).toBe(100);
            });

            test('should apply quality multiplier', () => {
                const cargo = {
                    qualityTiers: {
                        poor: 0.5,
                        average: 1.0,
                        excellent: 2.0
                    }
                };

                expect(dataManager.calculateQualityPrice(100, cargo, 'poor')).toBe(50);
                expect(dataManager.calculateQualityPrice(100, cargo, 'average')).toBe(100);
                expect(dataManager.calculateQualityPrice(100, cargo, 'excellent')).toBe(200);
            });

            test('should throw error for invalid quality tier', () => {
                const cargo = {
                    qualityTiers: { average: 1.0 }
                };

                expect(() => {
                    dataManager.calculateQualityPrice(100, cargo, 'invalid');
                }).toThrow('Invalid quality tier: invalid');
            });
        });

        describe('getAvailableQualityTiers', () => {
            test('should return default quality for cargo without tiers', () => {
                const cargo = { name: 'Grain' };
                expect(dataManager.getAvailableQualityTiers(cargo)).toEqual(['average']);
            });

            test('should return all available quality tiers', () => {
                const cargo = {
                    qualityTiers: {
                        poor: 0.5,
                        average: 1.0,
                        good: 1.5,
                        excellent: 2.0
                    }
                };

                const tiers = dataManager.getAvailableQualityTiers(cargo);
                expect(tiers).toEqual(['poor', 'average', 'good', 'excellent']);
            });
        });

        describe('createCargoData', () => {
            test('should create basic cargo data structure', () => {
                const cargo = dataManager.createCargoData(
                    'Grain',
                    'Agriculture',
                    { spring: 2, summer: 3, autumn: 1, winter: 4 },
                    1
                );

                expect(cargo).toEqual({
                    name: 'Grain',
                    category: 'Agriculture',
                    basePrices: { spring: 2, summer: 3, autumn: 1, winter: 4 }
                });
            });

            test('should create cargo with optional properties', () => {
                const cargo = dataManager.createCargoData(
                    'Wine',
                    'Luxury',
                    { spring: 10, summer: 12, autumn: 8, winter: 15 },
                    {
                        qualityTiers: { poor: 0.5, average: 1.0, excellent: 2.0 },
                        deteriorationRate: 0.05,
                        specialRules: ['fragile']
                    }
                );

                expect(cargo.qualityTiers).toEqual({ poor: 0.5, average: 1.0, excellent: 2.0 });
                expect(cargo.deteriorationRate).toBe(0.05);
                expect(cargo.specialRules).toEqual(['fragile']);
            });
        });
    });

    describe('Settlement Size and Wealth Enumeration Mapping', () => {
        describe('convertSizeToNumeric', () => {
            test('should convert all valid size enumerations correctly', () => {
                expect(dataManager.convertSizeToNumeric('CS')).toBe(4);
                expect(dataManager.convertSizeToNumeric('C')).toBe(4);
                expect(dataManager.convertSizeToNumeric('T')).toBe(3);
                expect(dataManager.convertSizeToNumeric('ST')).toBe(2);
                expect(dataManager.convertSizeToNumeric('V')).toBe(1);
                expect(dataManager.convertSizeToNumeric('F')).toBe(2);
                expect(dataManager.convertSizeToNumeric('M')).toBe(2);
            });

            test('should throw error for invalid size enumeration', () => {
                expect(() => {
                    dataManager.convertSizeToNumeric('INVALID');
                }).toThrow('Invalid size enumeration: INVALID');
            });
        });

        describe('getWealthModifier', () => {
            test('should return correct wealth modifiers', () => {
                expect(dataManager.getWealthModifier(1)).toBe(0.50); // Squalid
                expect(dataManager.getWealthModifier(2)).toBe(0.80); // Poor
                expect(dataManager.getWealthModifier(3)).toBe(1.00); // Average
                expect(dataManager.getWealthModifier(4)).toBe(1.05); // Bustling
                expect(dataManager.getWealthModifier(5)).toBe(1.10); // Prosperous
            });

            test('should throw error for invalid wealth rating', () => {
                expect(() => {
                    dataManager.getWealthModifier(0);
                }).toThrow('Invalid wealth rating: 0. Must be between 1-5');

                expect(() => {
                    dataManager.getWealthModifier(6);
                }).toThrow('Invalid wealth rating: 6. Must be between 1-5');
            });
        });

        describe('getWealthDescription', () => {
            test('should return correct wealth descriptions', () => {
                expect(dataManager.getWealthDescription(1)).toBe('Squalid');
                expect(dataManager.getWealthDescription(2)).toBe('Poor');
                expect(dataManager.getWealthDescription(3)).toBe('Average');
                expect(dataManager.getWealthDescription(4)).toBe('Bustling');
                expect(dataManager.getWealthDescription(5)).toBe('Prosperous');
            });

            test('should throw error for invalid wealth rating', () => {
                expect(() => {
                    dataManager.getWealthDescription(0);
                }).toThrow('Invalid wealth rating: 0. Must be between 1-5');
            });
        });

        describe('getSizeDescription', () => {
            test('should return correct size descriptions', () => {
                expect(dataManager.getSizeDescription('CS')).toBe('City State');
                expect(dataManager.getSizeDescription('C')).toBe('City');
                expect(dataManager.getSizeDescription('T')).toBe('Town');
                expect(dataManager.getSizeDescription('ST')).toBe('Small Town');
                expect(dataManager.getSizeDescription('V')).toBe('Village');
                expect(dataManager.getSizeDescription('F')).toBe('Fort');
                expect(dataManager.getSizeDescription('M')).toBe('Mine');
            });

            test('should throw error for invalid size enumeration', () => {
                expect(() => {
                    dataManager.getSizeDescription('INVALID');
                }).toThrow('Invalid size enumeration: INVALID');
            });
        });

        describe('getSettlementProperties', () => {
            const validSettlement = {
                region: 'Empire',
                name: 'Averheim',
                size: 'T',
                ruler: 'Grand Count Marius Leitdorf',
                population: 9400,
                wealth: 4,
                source: ['Trade', 'Government', 'Cattle'],
                garrison: ['35a', '80b'],
                notes: 'Provincial Capital'
            };

            test('should return complete settlement properties', () => {
                const properties = dataManager.getSettlementProperties(validSettlement);

                expect(properties.name).toBe('Averheim');
                expect(properties.region).toBe('Empire');
                expect(properties.sizeEnum).toBe('T');
                expect(properties.sizeNumeric).toBe(3);
                expect(properties.sizeDescription).toBe('Town');
                expect(properties.wealthRating).toBe(4);
                expect(properties.wealthModifier).toBe(1.05);
                expect(properties.wealthDescription).toBe('Bustling');
                expect(properties.population).toBe(9400);
                expect(properties.productionCategories).toEqual(['Trade', 'Government', 'Cattle']);
                expect(properties.garrison).toEqual(['35a', '80b']);
                expect(properties.ruler).toBe('Grand Count Marius Leitdorf');
                expect(properties.notes).toBe('Provincial Capital');
            });

            test('should throw error for invalid settlement', () => {
                const invalidSettlement = {
                    name: 'Invalid Settlement'
                    // Missing required fields
                };

                expect(() => {
                    dataManager.getSettlementProperties(invalidSettlement);
                }).toThrow('Invalid settlement:');
            });

            test('should throw error for null settlement', () => {
                expect(() => {
                    dataManager.getSettlementProperties(null);
                }).toThrow('Settlement object is required');
            });
        });

        describe('calculateAvailabilityChance', () => {
            test('should calculate correct availability chance', () => {
                const settlement = {
                    region: 'Empire',
                    name: 'Test Town',
                    size: 'T', // Size 3
                    ruler: 'Test Ruler',
                    population: 5000,
                    wealth: 3, // Wealth 3
                    source: ['Agriculture'],
                    garrison: [],
                    notes: 'Test'
                };

                // (Size 3 + Wealth 3) × 10 = 60%
                expect(dataManager.calculateAvailabilityChance(settlement)).toBe(60);
            });

            test('should handle different size and wealth combinations', () => {
                const village = {
                    region: 'Empire', name: 'Village', size: 'V', ruler: 'Mayor',
                    population: 50, wealth: 1, source: ['Agriculture'], garrison: [], notes: 'Small'
                };
                // (Size 1 + Wealth 1) × 10 = 20%
                expect(dataManager.calculateAvailabilityChance(village)).toBe(20);

                const city = {
                    region: 'Empire', name: 'City', size: 'C', ruler: 'Lord',
                    population: 50000, wealth: 5, source: ['Trade'], garrison: [], notes: 'Large'
                };
                // (Size 4 + Wealth 5) × 10 = 90%
                expect(dataManager.calculateAvailabilityChance(city)).toBe(90);
            });
        });

        describe('calculateCargoSizeBase', () => {
            test('should calculate correct cargo size base', () => {
                const settlement = {
                    region: 'Empire', name: 'Test', size: 'T', ruler: 'Ruler',
                    population: 5000, wealth: 3, source: ['Trade'], garrison: [], notes: 'Test'
                };

                // Size 3 + Wealth 3 = 6
                expect(dataManager.calculateCargoSizeBase(settlement)).toBe(6);
            });
        });

        describe('isTradeSettlement', () => {
            test('should identify Trade settlements correctly', () => {
                const tradeSettlement = {
                    source: ['Trade', 'Agriculture']
                };
                expect(dataManager.isTradeSettlement(tradeSettlement)).toBe(true);

                const nonTradeSettlement = {
                    source: ['Agriculture', 'Mining']
                };
                expect(dataManager.isTradeSettlement(nonTradeSettlement)).toBe(false);

                const noSourceSettlement = {};
                expect(dataManager.isTradeSettlement(noSourceSettlement)).toBe(false);
            });
        });

        describe('getValidSizeEnumerations', () => {
            test('should return all valid size enumerations', () => {
                const validSizes = dataManager.getValidSizeEnumerations();
                expect(validSizes).toEqual(['CS', 'C', 'T', 'ST', 'V', 'F', 'M']);
            });
        });

        describe('getValidWealthRatings', () => {
            test('should return all valid wealth ratings', () => {
                const validWealth = dataManager.getValidWealthRatings();
                expect(validWealth).toEqual([1, 2, 3, 4, 5]);
            });
        });
    });
});