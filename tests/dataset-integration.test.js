/**
 * Integration tests for the complete WFRP dataset
 * Tests the DataManager with the new regional settlement structure
 */

const fs = require('fs');
const path = require('path');

describe('Complete WFRP Dataset Integration', () => {
    let datasetPath;
    
    beforeAll(() => {
        datasetPath = path.join(__dirname, '..', 'datasets', 'wfrp4e');
    });

    describe('Regional Settlement Files', () => {
        test('should load all regional settlement files', () => {
            const settlementsDir = path.join(datasetPath, 'settlements');
            expect(fs.existsSync(settlementsDir)).toBe(true);
            
            const regionFiles = fs.readdirSync(settlementsDir).filter(f => f.endsWith('.json'));
            expect(regionFiles.length).toBeGreaterThan(10); // Should have multiple regions
            
            let totalSettlements = 0;
            regionFiles.forEach(file => {
                const filePath = path.join(settlementsDir, file);
                const settlements = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                
                expect(Array.isArray(settlements)).toBe(true);
                expect(settlements.length).toBeGreaterThan(0);
                totalSettlements += settlements.length;
            });
            
            expect(totalSettlements).toBeGreaterThan(100); // Should have substantial dataset
        });

        test('should have all required settlement fields', () => {
            const settlementsDir = path.join(datasetPath, 'settlements');
            const regionFiles = fs.readdirSync(settlementsDir).filter(f => f.endsWith('.json'));

            const requiredFields = ['region', 'name', 'size', 'ruler', 'population', 'wealth', 'flags', 'garrison', 'notes'];
            
            regionFiles.forEach(file => {
                const filePath = path.join(settlementsDir, file);
                const settlements = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                
                settlements.forEach(settlement => {
                    requiredFields.forEach(field => {
                        expect(settlement).toHaveProperty(field);
                    });
                });
            });
        });

        test('should have valid size enumerations', () => {
            // Size is now a numeric enum 1-5; 0 is only valid for destroyed
            // settlements (population 0) - see data-manager.js validation
            const settlementsDir = path.join(datasetPath, 'settlements');
            const regionFiles = fs.readdirSync(settlementsDir).filter(f => f.endsWith('.json'));

            regionFiles.forEach(file => {
                const filePath = path.join(settlementsDir, file);
                const settlements = JSON.parse(fs.readFileSync(filePath, 'utf8'));

                settlements.forEach(settlement => {
                    expect(typeof settlement.size).toBe('number');
                    if (settlement.size === 0) {
                        expect(settlement.population).toBe(0);
                    } else {
                        expect(settlement.size).toBeGreaterThanOrEqual(1);
                        expect(settlement.size).toBeLessThanOrEqual(5);
                    }
                });
            });
        });

        test('should have valid wealth ratings', () => {
            const settlementsDir = path.join(datasetPath, 'settlements');
            const regionFiles = fs.readdirSync(settlementsDir).filter(f => f.endsWith('.json'));
            
            regionFiles.forEach(file => {
                const filePath = path.join(settlementsDir, file);
                const settlements = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                
                settlements.forEach(settlement => {
                    // 0 is only valid for destroyed settlements (population 0)
                    if (settlement.wealth === 0) {
                        expect(settlement.population).toBe(0);
                    } else {
                        expect(settlement.wealth).toBeGreaterThanOrEqual(1);
                        expect(settlement.wealth).toBeLessThanOrEqual(5);
                    }
                });
            });
        });

        test('should have diverse production categories', () => {
            // Production categories moved from settlement.source (free text)
            // to settlement.flags (a fixed, lowercase set) plus produces/demands
            const settlementsDir = path.join(datasetPath, 'settlements');
            const regionFiles = fs.readdirSync(settlementsDir).filter(f => f.endsWith('.json'));

            const allFlags = new Set();

            regionFiles.forEach(file => {
                const filePath = path.join(settlementsDir, file);
                const settlements = JSON.parse(fs.readFileSync(filePath, 'utf8'));

                settlements.forEach(settlement => {
                    expect(Array.isArray(settlement.flags)).toBe(true);
                    settlement.flags.forEach(flag => {
                        allFlags.add(flag);
                    });
                });
            });

            // Should include key WFRP flags
            expect(allFlags.has('trade')).toBe(true);
            expect(allFlags.has('agriculture')).toBe(true);
            expect(allFlags.has('government')).toBe(true);
        });
    });

    describe('Cargo Types Data', () => {
        test('should have complete cargo types with seasonal pricing', () => {
            const cargoPath = path.join(datasetPath, 'cargo-types.json');
            expect(fs.existsSync(cargoPath)).toBe(true);
            
            const cargoData = JSON.parse(fs.readFileSync(cargoPath, 'utf8'));
            expect(cargoData).toHaveProperty('cargoTypes');
            expect(Array.isArray(cargoData.cargoTypes)).toBe(true);
            
            const requiredCargos = ['Sustenance', 'Armaments', 'Timber', 'Wine/Brandy', 'Wool'];
            const foundCargos = cargoData.cargoTypes.map(c => c.name);
            
            requiredCargos.forEach(cargo => {
                expect(foundCargos).toContain(cargo);
            });
        });

        test('should have quality tiers for Wine/Brandy', () => {
            const cargoPath = path.join(datasetPath, 'cargo-types.json');
            const cargoData = JSON.parse(fs.readFileSync(cargoPath, 'utf8'));
            
            const wineCargo = cargoData.cargoTypes.find(c => c.name === 'Wine/Brandy');
            expect(wineCargo).toBeDefined();
            expect(wineCargo).toHaveProperty('qualityTiers');
            expect(typeof wineCargo.qualityTiers).toBe('object');
            expect(Object.keys(wineCargo.qualityTiers).length).toBe(6); // Should have 6 quality tiers
        });

        test('should have seasonal pricing for all non-wine cargo', () => {
            // Seasonal pricing is now basePrice (flat number) + seasonalModifiers
            // (per-season multiplier), rather than an absolute price per season
            const cargoPath = path.join(datasetPath, 'cargo-types.json');
            const cargoData = JSON.parse(fs.readFileSync(cargoPath, 'utf8'));

            const seasons = ['spring', 'summer', 'autumn', 'winter'];

            cargoData.cargoTypes.forEach(cargo => {
                expect(typeof cargo.basePrice).toBe('number');
                expect(cargo).toHaveProperty('seasonalModifiers');
                seasons.forEach(season => {
                    expect(cargo.seasonalModifiers).toHaveProperty(season);
                    expect(typeof cargo.seasonalModifiers[season]).toBe('number');
                });
            });
        });
    });

    describe('System Configuration', () => {
        test('should have complete WFRP4e system configuration', () => {
            const configPath = path.join(datasetPath, 'config.json');
            expect(fs.existsSync(configPath)).toBe(true);

            const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

            // Required configuration sections
            expect(config).toHaveProperty('currency');
            expect(config).toHaveProperty('inventory');
            expect(config).toHaveProperty('skills');
            expect(config).toHaveProperty('talents');

            // Currency configuration - now a canonicalUnit/denominations schema
            // rather than a single field/name/abbreviation
            expect(config.currency).toHaveProperty('canonicalUnit');
            expect(config.currency.canonicalUnit).toHaveProperty('name');
            expect(config.currency.canonicalUnit).toHaveProperty('abbreviation');
            expect(Array.isArray(config.currency.denominations)).toBe(true);
            expect(config.currency.denominations.length).toBeGreaterThan(0);

            // Skills configuration
            expect(config.skills).toHaveProperty('haggle');
            expect(config.skills).toHaveProperty('gossip');

            // Talents configuration
            expect(config.talents).toHaveProperty('dealmaker');
        });
    });

    describe('Dataset Completeness Validation', () => {
        test('should have substantial settlement coverage', () => {
            const settlementsDir = path.join(datasetPath, 'settlements');
            const regionFiles = fs.readdirSync(settlementsDir).filter(f => f.endsWith('.json'));
            
            let totalSettlements = 0;
            let sizeDistribution = {};
            let wealthDistribution = {};
            
            regionFiles.forEach(file => {
                const filePath = path.join(settlementsDir, file);
                const settlements = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                
                settlements.forEach(settlement => {
                    totalSettlements++;
                    sizeDistribution[settlement.size] = (sizeDistribution[settlement.size] || 0) + 1;
                    wealthDistribution[settlement.wealth] = (wealthDistribution[settlement.wealth] || 0) + 1;
                });
            });
            
            // Should have substantial dataset
            expect(totalSettlements).toBeGreaterThan(100);
            
            // Should have variety in sizes
            expect(Object.keys(sizeDistribution).length).toBeGreaterThan(4);

            // Should have variety in wealth levels
            expect(Object.keys(wealthDistribution).length).toBeGreaterThan(3);

            // Should have major settlements (numeric size enum: 1=Village ... 5=largest)
            expect(sizeDistribution[4] || 0).toBeGreaterThan(0); // Cities/City States
            expect(sizeDistribution[3] || 0).toBeGreaterThan(0); // Towns
        });

        test('should have regional organization', () => {
            const settlementsDir = path.join(datasetPath, 'settlements');
            const regionFiles = fs.readdirSync(settlementsDir).filter(f => f.endsWith('.json'));
            
            // Should have multiple regions
            expect(regionFiles.length).toBeGreaterThan(10);
            
            // Check that each region file contains settlements from that region
            regionFiles.forEach(file => {
                const regionName = path.basename(file, '.json');
                const filePath = path.join(settlementsDir, file);
                const settlements = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                
                settlements.forEach(settlement => {
                    // Region name should match or be related to filename
                    expect(settlement.region).toBeDefined();
                    expect(typeof settlement.region).toBe('string');
                });
            });
        });

        test('should have garrison data for settlements', () => {
            const settlementsDir = path.join(datasetPath, 'settlements');
            const regionFiles = fs.readdirSync(settlementsDir).filter(f => f.endsWith('.json'));
            
            let settlementsWithGarrisons = 0;
            let totalSettlements = 0;
            
            regionFiles.forEach(file => {
                const filePath = path.join(settlementsDir, file);
                const settlements = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                
                settlements.forEach(settlement => {
                    totalSettlements++;
                    // garrison is now an object map (e.g. { a: 1800 }), not an array
                    expect(typeof settlement.garrison).toBe('object');
                    expect(Array.isArray(settlement.garrison)).toBe(false);

                    if (Object.keys(settlement.garrison).length > 0) {
                        settlementsWithGarrisons++;
                    }
                });
            });
            
            // Should have garrison data for a reasonable portion of settlements
            const garrisonPercentage = (settlementsWithGarrisons / totalSettlements) * 100;
            expect(garrisonPercentage).toBeGreaterThan(30); // At least 30% should have garrison data
        });
    });
});