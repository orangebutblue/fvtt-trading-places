/**
 * Dataset validation script for Trading Places Module
 * Validates the complete dataset structure against task 10 requirements
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class DatasetValidator {
    constructor(datasetPath) {
        this.datasetPath = datasetPath;
        this.errors = [];
        this.warnings = [];
        this.stats = {
            totalSettlements: 0,
            regionCount: 0,
            sizeDistribution: {},
            wealthDistribution: {},
            productionCategories: new Set()
        };
    }

    validateDataset() {
        console.log('🔍 Validating Trading Places Dataset...\n');
        
        // Validate settlements data
        this.validateSettlements();
        
        // Validate cargo types
        this.validateCargoTypes();
        
        // Validate random cargo tables
        this.validateRandomCargoTables();
        
        // Validate system configuration
        this.validateSystemConfig();
        
        // Generate report
        this.generateReport();
        
        return this.errors.length === 0;
    }

    validateSettlements() {
        console.log('📍 Validating settlement data...');
        
        const settlementsDir = path.join(this.datasetPath, 'settlements');
        const aggregatedPath = path.join(this.datasetPath, 'settlements.json');
        
        // Check for aggregated settlements.json file first
        if (fs.existsSync(aggregatedPath)) {
            try {
                const settlements = JSON.parse(fs.readFileSync(aggregatedPath, 'utf8'));
                
                if (!Array.isArray(settlements)) {
                    this.errors.push('settlements.json: Must contain an array of settlements');
                    return;
                }

                settlements.forEach((settlement, index) => {
                    this.validateSettlement(settlement, `settlements.json[${index}]`);
                    this.updateStats(settlement);
                });

                this.stats.totalSettlements = settlements.length;
                this.stats.regionCount = 1; // Aggregated file counts as 1 "regional file"
                console.log(`  ✓ settlements.json: ${settlements.length} settlements`);
                return;
                
            } catch (error) {
                this.errors.push(`settlements.json: JSON parsing error - ${error.message}`);
                return;
            }
        }
        
        // Fall back to regional directory structure
        if (!fs.existsSync(settlementsDir)) {
            this.errors.push('Settlements directory not found and no settlements.json file present');
            return;
        }

        const regionFiles = fs.readdirSync(settlementsDir).filter(f => f.endsWith('.json'));
        this.stats.regionCount = regionFiles.length;
        
        console.log(`  Found ${regionFiles.length} regional files`);

        regionFiles.forEach(file => {
            const filePath = path.join(settlementsDir, file);
            const regionName = path.basename(file, '.json');
            
            try {
                const settlements = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                
                if (!Array.isArray(settlements)) {
                    this.errors.push(`${file}: Must contain an array of settlements`);
                    return;
                }

                settlements.forEach((settlement, index) => {
                    this.validateSettlement(settlement, `${file}[${index}]`);
                    this.updateStats(settlement);
                });

                this.stats.totalSettlements += settlements.length;
                console.log(`  ✓ ${file}: ${settlements.length} settlements`);
                
            } catch (error) {
                this.errors.push(`${file}: JSON parsing error - ${error.message}`);
            }
        });
    }

    validateSettlement(settlement, context) {
        const requiredFields = ['region', 'name', 'size', 'ruler', 'population', 'wealth', 'flags', 'garrison', 'notes'];
        
        // Check required fields
        requiredFields.forEach(field => {
            if (!settlement.hasOwnProperty(field)) {
                this.errors.push(`${context}: Missing required field '${field}'`);
            }
        });

        // Validate field types and values
        if (settlement.population !== undefined && typeof settlement.population !== 'number') {
            this.errors.push(`${context}: Population must be a number`);
        }

        if (settlement.wealth !== undefined) {
            if (typeof settlement.wealth !== 'number' || settlement.wealth < 1 || settlement.wealth > 5) {
                this.errors.push(`${context}: Wealth must be a number between 1-5`);
            }
        }

        if (settlement.flags !== undefined && !Array.isArray(settlement.flags)) {
            this.errors.push(`${context}: Flags must be an array`);
        }

        // Validate garrison (can be array or object)
        if (settlement.garrison !== undefined && !Array.isArray(settlement.garrison) && typeof settlement.garrison !== 'object') {
            this.errors.push(`${context}: Garrison must be an array or object`);
        }

        // Validate size (can be string enum or number)
        const validSizes = ['CS', 'C', 'T', 'ST', 'V', 'F', 'M'];
        const validNumericSizes = [1, 2, 3, 4, 5];
        if (settlement.size !== undefined) {
            const isValidString = typeof settlement.size === 'string' && validSizes.includes(settlement.size);
            const isValidNumber = typeof settlement.size === 'number' && validNumericSizes.includes(settlement.size);
            if (!isValidString && !isValidNumber) {
                this.errors.push(`${context}: Invalid size '${settlement.size}'. Must be one of: ${validSizes.join(', ')} or a number 1-5`);
            }
        }
    }

    updateStats(settlement) {
        // Size distribution
        if (settlement.size) {
            this.stats.sizeDistribution[settlement.size] = (this.stats.sizeDistribution[settlement.size] || 0) + 1;
        }

        // Wealth distribution
        if (settlement.wealth) {
            this.stats.wealthDistribution[settlement.wealth] = (this.stats.wealthDistribution[settlement.wealth] || 0) + 1;
        }

        // Production categories
        if (settlement.flags && Array.isArray(settlement.flags)) {
            settlement.flags.forEach(category => {
                this.stats.productionCategories.add(category);
            });
        }
    }

    validateCargoTypes() {
        console.log('📦 Validating cargo types...');
        
        const cargoPath = path.join(this.datasetPath, 'cargo-types.json');
        
        if (!fs.existsSync(cargoPath)) {
            this.errors.push('cargo-types.json not found');
            return;
        }

        try {
            const cargoData = JSON.parse(fs.readFileSync(cargoPath, 'utf8'));
            
            if (!cargoData.cargoTypes || !Array.isArray(cargoData.cargoTypes)) {
                this.errors.push('cargo-types.json must contain a cargoTypes array');
                return;
            }

            const requiredCargos = ['Grain', 'Armaments', 'Luxuries', 'Metal', 'Timber', 'Wine/Brandy', 'Trade Goods'];
            const foundCargos = cargoData.cargoTypes.map(c => c.name);
            
            requiredCargos.forEach(cargo => {
                if (!foundCargos.includes(cargo)) {
                    this.errors.push(`Missing required cargo type: ${cargo}`);
                }
            });

            cargoData.cargoTypes.forEach((cargo, index) => {
                this.validateCargoType(cargo, `cargoTypes[${index}]`);
            });

            console.log(`  ✓ Found ${cargoData.cargoTypes.length} cargo types`);
            
        } catch (error) {
            this.errors.push(`cargo-types.json: JSON parsing error - ${error.message}`);
        }
    }

    validateCargoType(cargo, context) {
        const requiredFields = ['name', 'category', 'description', 'basePrice', 'seasonalModifiers'];
        
        requiredFields.forEach(field => {
            if (!cargo.hasOwnProperty(field)) {
                this.errors.push(`${context}: Missing required field '${field}'`);
            }
        });

        // All cargo types must have seasonal modifiers
        if (!cargo.seasonalModifiers || typeof cargo.seasonalModifiers !== 'object') {
            this.errors.push(`${context}: Must have seasonalModifiers object`);
        } else {
            const seasons = ['spring', 'summer', 'autumn', 'winter'];
            seasons.forEach(season => {
                if (cargo.seasonalModifiers[season] === undefined) {
                    this.errors.push(`${context}: Missing seasonal modifier for season '${season}'`);
                }
            });
        }
    }

    validateRandomCargoTables() {
        console.log('🎲 Validating random cargo tables...');
        
        const tablesPath = path.join(this.datasetPath, 'random-cargo-tables.json');
        
        if (!fs.existsSync(tablesPath)) {
            this.errors.push('random-cargo-tables.json not found');
            return;
        }

        try {
            const tables = JSON.parse(fs.readFileSync(tablesPath, 'utf8'));
            
            const seasons = ['spring', 'summer', 'autumn', 'winter'];
            seasons.forEach(season => {
                if (!tables[season] || !Array.isArray(tables[season])) {
                    this.errors.push(`Missing or invalid ${season} cargo table`);
                    return;
                }

                // Validate ranges cover 1-100
                const ranges = tables[season].map(entry => entry.range).flat().sort((a, b) => a - b);
                if (ranges[0] !== 1 || ranges[ranges.length - 1] !== 100) {
                    this.errors.push(`${season} table doesn't cover full 1-100 range`);
                }
            });

            console.log('  ✓ All seasonal cargo tables validated');
            
        } catch (error) {
            this.errors.push(`random-cargo-tables.json: JSON parsing error - ${error.message}`);
        }
    }

    validateSystemConfig() {
        console.log('⚙️  Validating system configuration...');
        
        const configPath = path.join(this.datasetPath, 'config.json');
        
        if (!fs.existsSync(configPath)) {
            this.errors.push('config.json not found');
            return;
        }

        try {
            const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            
            const requiredSections = ['currency', 'inventory', 'skills', 'talents'];
            requiredSections.forEach(section => {
                if (!config[section]) {
                    this.errors.push(`config.json: Missing ${section} configuration`);
                }
            });

            // Validate currency configuration
            if (config.currency) {
                const currency = config.currency;
                if (!currency.canonicalUnit || typeof currency.canonicalUnit.value !== 'number') {
                    this.errors.push('config.json: currency.canonicalUnit.value must be numeric');
                }

                if (!Array.isArray(currency.denominations) || currency.denominations.length === 0) {
                    this.errors.push('config.json: currency.denominations must be a non-empty array');
                }
            }

            console.log('  ✓ System configuration validated');
            
        } catch (error) {
            this.errors.push(`config.json: JSON parsing error - ${error.message}`);
        }
    }

    generateReport() {
        console.log('\n📊 Dataset Validation Report');
        console.log('=' .repeat(50));
        
        // Statistics
        console.log('\n📈 Statistics:');
        console.log(`  Total Settlements: ${this.stats.totalSettlements}`);
        console.log(`  Regional Files: ${this.stats.regionCount}`);
        console.log(`  Production Categories: ${this.stats.productionCategories.size}`);
        
        console.log('\n🏘️  Size Distribution:');
        Object.entries(this.stats.sizeDistribution).forEach(([size, count]) => {
            console.log(`  ${size}: ${count}`);
        });
        
        console.log('\n💰 Wealth Distribution:');
        Object.entries(this.stats.wealthDistribution).forEach(([wealth, count]) => {
            console.log(`  Level ${wealth}: ${count}`);
        });
        
        console.log('\n🏭 Production Categories:');
        Array.from(this.stats.productionCategories).sort().forEach(category => {
            console.log(`  - ${category}`);
        });

        // Errors and warnings
        if (this.errors.length > 0) {
            console.log('\n❌ Errors:');
            this.errors.forEach(error => console.log(`  - ${error}`));
        }

        if (this.warnings.length > 0) {
            console.log('\n⚠️  Warnings:');
            this.warnings.forEach(warning => console.log(`  - ${warning}`));
        }

        // Final result
        console.log('\n' + '='.repeat(50));
        if (this.errors.length === 0) {
            console.log('✅ Dataset validation PASSED');
            console.log('   All requirements for task 10 are satisfied!');
        } else {
            console.log('❌ Dataset validation FAILED');
            console.log(`   Found ${this.errors.length} error(s) that need to be fixed`);
        }
    }
}

// Run validation
const datasetPath = process.argv[2] || 'datasets/active';
const validator = new DatasetValidator(datasetPath);
const isValid = validator.validateDataset();

process.exit(isValid ? 0 : 1);