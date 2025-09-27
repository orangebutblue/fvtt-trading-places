/**
 * Integration tests for the complete WFRP dataset
 * Tests the DataManager with the new regional settlement structure
 */

const fs = require('fs');
const path = require('path');

describe('Complete WFRP Dataset Integration', () => {
    let datasetPath;
    
    beforeAll(() => {
        datasetPath = path.join(__dirname, '..', 'datasets', 'active');
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
            
            const requiredFields = ['region', 'name', 'size', 'ruler', 'population', 'wealth', 'source', 'garrison', 'notes'];
            
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
            const settlementsDir = path.join(datasetPath, 'settlements');
            const regionFiles = fs.readdirSync(settlementsDir).filter(f => f.endsWith('.json'));
            
            const validSizes = ['CS', 'C', 'T', 'ST', 'V', 'F', 'M'];
            
            regionFiles.forEach(file => {
                const filePath = path.join(settlementsDir, file);
                const settlements = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                
                settlements.forEach(settlement => {
                    expect(validSizes).toContain(settlement.size);
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
                    expect(settlement.wealth).toBeGreaterThanOrEqual(1);
                    expect(settlement.wealth).toBeLessThanOrEqual(5);
                });
            });
        });

        test('should have diverse production categories', () => {
            const settlementsDir = path.join(datasetPath, 'settlements');
            const regionFiles = fs.readdirSync(settlementsDir).filter(f => f.endsWith('.json'));
            
            const allCategories = new Set();
            
            regionFiles.forEach(file => {
                const filePath = path.join(settlementsDir, file);
                const settlements = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                
                settlements.forEach(settlement => {
                    expect(Array.isArray(settlement.source)).toBe(true);
                    settlement.source.forEach(category => {
                        allCategories.add(category);
                    });
                });
            });
            
            // Should have substantial variety of production categories
            expect(allCategories.size).toBeGreaterThan(20);
            
            // Should include key WFRP categories
            expect(allCategories.has('Trade')).toBe(true);
            expect(allCategories.has('Agriculture')).toBe(true);
            expect(allCategories.has('Government')).toBe(true);
        });
    });

    describe('Cargo Types Data', () => {
        test('should have complete cargo types with seasonal pricing', () => {
            const cargoPath = path.join(datasetPath, 'cargo-types.json');
            expect(fs.existsSync(cargoPath)).toBe(true);
            
            const cargoData = JSON.parse(fs.readFileSync(cargoPath, 'utf8'));
            expect(cargoData).toHaveProperty('cargoTypes');
            expect(Array.isArray(cargoData.cargoTypes)).toBe(true);
            
            const requiredCargos = ['Grain', 'Armaments', 'Luxuries', 'Metal', 'Timber', 'Wine/Brandy', 'Wool'];
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
            expect(Array.isArray(wineCargo.qualityTiers)).toBe(true);
            expect(wineCargo.qualityTiers.length).toBe(6); // Should have 6 quality tiers
        });

        test('should have seasonal pricing for all non-wine cargo', () => {
            const cargoPath = path.join(datasetPath, 'cargo-types.json');
            const cargoData = JSON.parse(fs.readFileSync(cargoPath, 'utf8'));
            
            const seasons = ['spring', 'summer', 'autumn', 'winter'];
            
            cargoData.cargoTypes.forEach(cargo => {
                if (cargo.name !== 'Wine/Brandy') {
                    expect(cargo).toHaveProperty('basePrices');
                    seasons.forEach(season => {
                        expect(cargo.basePrices).toHaveProperty(season);
                        expect(typeof cargo.basePrices[season]).toBe('number');
                    });
                }
            });
        });
    });

    describe('Random Cargo Tables', () => {
        test('should have complete seasonal cargo tables', () => {
            const tablesPath = path.join(datasetPath, 'random-cargo-tables.json');
            expect(fs.existsSync(tablesPath)).toBe(true);
            
            const tables = JSON.parse(fs.readFileSync(tablesPath, 'utf8'));
            
            const seasons = ['spring', 'summer', 'autumn', 'winter'];
            seasons.forEach(season => {
                expect(tables).toHaveProperty(season);
                expect(Array.isArray(tables[season])).toBe(true);
                expect(tables[season].length).toBeGreaterThan(0);
            });
        });

        test('should have valid range coverage for each season', () => {
            const tablesPath = path.join(datasetPath, 'random-cargo-tables.json');
            const tables = JSON.parse(fs.readFileSync(tablesPath, 'utf8'));
            
            const seasons = ['spring', 'summer', 'autumn', 'winter'];
            seasons.forEach(season => {
                const entries = tables[season];
                
                // Check that ranges cover 1-100
                const allNumbers = [];
                entries.forEach(entry => {
                    expect(entry).toHaveProperty('cargo');
                    expect(entry).toHaveProperty('range');
                    expect(Array.isArray(entry.range)).toBe(true);
                    expect(entry.range.length).toBe(2);
                    
                    for (let i = entry.range[0]; i <= entry.range[1]; i++) {
                        allNumbers.push(i);
                    }
                });
                
                // Should cover exactly 1-100
                const uniqueNumbers = [...new Set(allNumbers)].sort((a, b) => a - b);
                expect(uniqueNumbers[0]).toBe(1);
                expect(uniqueNumbers[uniqueNumbers.length - 1]).toBe(100);
                expect(uniqueNumbers.length).toBe(100);
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
            
            // Currency configuration
            expect(config.currency).toHaveProperty('field');
            expect(config.currency).toHaveProperty('name');
            expect(config.currency).toHaveProperty('abbreviation');
            
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
            
            // Should have major settlements
            expect(sizeDistribution['CS'] || 0).toBeGreaterThan(0); // City States
            expect(sizeDistribution['C'] || 0).toBeGreaterThan(0);  // Cities
            expect(sizeDistribution['T'] || 0).toBeGreaterThan(0);  // Towns
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
                    expect(Array.isArray(settlement.garrison)).toBe(true);
                    
                    if (settlement.garrison.length > 0) {
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