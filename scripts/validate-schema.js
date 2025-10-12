#!/usr/bin/env node

/**
 * Schema Validation Script
 * Validates settlement and cargo data against orange-realism schema
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths
const SETTLEMENT_DIR = path.resolve(__dirname, '../datasets/active/settlements');
const CARGO_TYPES_PATH = path.resolve(__dirname, '../datasets/active/cargo-types.json');
const SOURCE_FLAGS_PATH = path.resolve(__dirname, '../datasets/active/source-flags.json');
const TRADING_CONFIG_PATH = path.resolve(__dirname, '../datasets/active/trading-config.json');

class SchemaValidator {
    constructor(options = {}) {
        this.options = {
            verbose: options.verbose || false,
            strict: options.strict || false
        };
        
        this.errors = [];
        this.warnings = [];
        this.stats = {
            settlements: 0,
            cargoTypes: 0,
            flags: 0
        };
        
        this.cargoTypes = new Set();
        this.flags = new Set();
        this.tradingConfig = null;
    }

    async validate() {
        console.log('Orange Realism Schema Validator');
        console.log('===============================');
        console.log();

        try {
            // Load reference data
            await this.loadReferenceData();
            
            // Validate cargo types
            await this.validateCargoTypes();
            
            // Validate source flags
            await this.validateSourceFlags();
            
            // Validate settlements
            await this.validateSettlements();
            
            // Print results
            this.printResults();
            
            // Exit with appropriate code
            const hasErrors = this.errors.length > 0;
            if (hasErrors) {
                console.log('\n❌ Validation failed with errors');
                process.exit(1);
            } else {
                console.log('\n✅ All validations passed');
                process.exit(0);
            }
            
        } catch (error) {
            console.error('Validation failed:', error.message);
            if (this.options.verbose) {
                console.error(error.stack);
            }
            process.exit(1);
        }
    }

    async loadReferenceData() {
        console.log('Loading reference data...');
        
        // Load trading config
        try {
            const configData = await fs.promises.readFile(TRADING_CONFIG_PATH, 'utf8');
            this.tradingConfig = JSON.parse(configData);
            console.log('✓ Trading configuration loaded');
        } catch (error) {
            this.addError('trading-config', 'Failed to load trading configuration', error.message);
            return;
        }

        // Load cargo types for reference
        try {
            const cargoData = await fs.promises.readFile(CARGO_TYPES_PATH, 'utf8');
            const cargoJson = JSON.parse(cargoData);
            if (cargoJson.cargoTypes && Array.isArray(cargoJson.cargoTypes)) {
                cargoJson.cargoTypes.forEach(cargo => {
                    if (cargo.name) {
                        this.cargoTypes.add(cargo.name);
                    }
                });
            }
            console.log(`✓ Loaded ${this.cargoTypes.size} cargo types`);
        } catch (error) {
            this.addWarning('cargo-types', 'Failed to load cargo types for reference', error.message);
        }

        // Load source flags for reference
        try {
            const flagsData = await fs.promises.readFile(SOURCE_FLAGS_PATH, 'utf8');
            const flagsJson = JSON.parse(flagsData);
            Object.keys(flagsJson).forEach(flag => {
                this.flags.add(flag);
            });
            console.log(`✓ Loaded ${this.flags.size} source flags`);
        } catch (error) {
            this.addWarning('source-flags', 'Failed to load source flags for reference', error.message);
        }
        
        console.log();
    }

    async validateCargoTypes() {
        console.log('Validating cargo types...');
        
        try {
            const cargoData = await fs.promises.readFile(CARGO_TYPES_PATH, 'utf8');
            const cargoJson = JSON.parse(cargoData);
            
            // Validate structure
            if (!cargoJson.cargoTypes || !Array.isArray(cargoJson.cargoTypes)) {
                this.addError('cargo-types', 'Root object must contain "cargoTypes" array');
                return;
            }

            cargoJson.cargoTypes.forEach((cargo, index) => {
                this.validateCargoType(cargo, index);
            });

            this.stats.cargoTypes = cargoJson.cargoTypes.length;
            console.log(`✓ Validated ${this.stats.cargoTypes} cargo types\n`);

        } catch (error) {
            this.addError('cargo-types', 'Failed to parse cargo types file', error.message);
        }
    }

    validateCargoType(cargo, index) {
        const prefix = `cargo-types[${index}]`;
        
        // Required fields
        if (!cargo.name || typeof cargo.name !== 'string') {
            this.addError(prefix, 'Missing or invalid "name" field');
        }
        
        if (!cargo.basePrice || typeof cargo.basePrice !== 'number') {
            this.addError(prefix, 'Missing or invalid "basePrice" field');
        }
        
        // Optional but structured fields
        if (cargo.seasonalModifiers) {
            if (typeof cargo.seasonalModifiers !== 'object') {
                this.addError(prefix, '"seasonalModifiers" must be an object');
            } else {
                const seasons = ['spring', 'summer', 'autumn', 'winter'];
                seasons.forEach(season => {
                    if (cargo.seasonalModifiers[season] !== undefined && 
                        typeof cargo.seasonalModifiers[season] !== 'number') {
                        this.addError(prefix, `seasonalModifiers.${season} must be a number`);
                    }
                });
            }
        }
        
        if (cargo.category && typeof cargo.category !== 'string') {
            this.addError(prefix, '"category" must be a string');
        }
    }

    async validateSourceFlags() {
        console.log('Validating source flags...');
        
        try {
            const flagsData = await fs.promises.readFile(SOURCE_FLAGS_PATH, 'utf8');
            const flagsJson = JSON.parse(flagsData);
            
            Object.entries(flagsJson).forEach(([flagName, flagData]) => {
                this.validateSourceFlag(flagName, flagData);
            });

            this.stats.flags = Object.keys(flagsJson).length;
            console.log(`✓ Validated ${this.stats.flags} source flags\n`);

        } catch (error) {
            this.addError('source-flags', 'Failed to parse source flags file', error.message);
        }
    }

    validateSourceFlag(flagName, flagData) {
        const prefix = `source-flags.${flagName}`;
        
        if (typeof flagData !== 'object') {
            this.addError(prefix, 'Flag data must be an object');
            return;
        }
        
        // Validate numeric fields
        const numericFields = ['supplyTransfer', 'demandTransfer', 'contrabandChance', 'quality'];
        numericFields.forEach(field => {
            if (flagData[field] !== undefined && typeof flagData[field] !== 'number') {
                this.addError(prefix, `"${field}" must be a number`);
            }
        });
        
        // Validate nested objects
        if (flagData.availabilityBonus && typeof flagData.availabilityBonus !== 'object') {
            this.addError(prefix, '"availabilityBonus" must be an object');
        }
        
        if (flagData.categorySupplyTransfer && typeof flagData.categorySupplyTransfer !== 'object') {
            this.addError(prefix, '"categorySupplyTransfer" must be an object');
        }
        
        if (flagData.categoryDemandTransfer && typeof flagData.categoryDemandTransfer !== 'object') {
            this.addError(prefix, '"categoryDemandTransfer" must be an object');
        }
    }

    async validateSettlements() {
        console.log('Validating settlements...');
        
        try {
            const files = await fs.promises.readdir(SETTLEMENT_DIR);
            const jsonFiles = files.filter(file => file.endsWith('.json'));
            
            for (const file of jsonFiles) {
                await this.validateSettlementFile(file);
            }
            
            console.log(`✓ Validated settlements from ${jsonFiles.length} files\n`);

        } catch (error) {
            this.addError('settlements', 'Failed to read settlements directory', error.message);
        }
    }

    async validateSettlementFile(fileName) {
        const filePath = path.join(SETTLEMENT_DIR, fileName);
        
        try {
            const fileData = await fs.promises.readFile(filePath, 'utf8');
            const settlements = JSON.parse(fileData);
            
            if (!Array.isArray(settlements)) {
                this.addError(fileName, 'File must contain an array of settlements');
                return;
            }

            settlements.forEach((settlement, index) => {
                this.validateSettlement(settlement, `${fileName}[${index}]`);
                this.stats.settlements++;
            });

        } catch (error) {
            this.addError(fileName, 'Failed to parse settlement file', error.message);
        }
    }

    validateSettlement(settlement, prefix) {
        // Required fields
        const requiredFields = {
            'region': 'string',
            'name': 'string',
            'population': 'number',
            'size': 'number',
            'wealth': 'number'
        };

        Object.entries(requiredFields).forEach(([field, type]) => {
            if (settlement[field] === undefined) {
                this.addError(prefix, `Missing required field "${field}"`);
            } else if (typeof settlement[field] !== type) {
                this.addError(prefix, `Field "${field}" must be a ${type}`);
            }
        });

        // Validate ranges
        if (settlement.size !== undefined) {
            if (settlement.size < 1 || settlement.size > 5) {
                this.addError(prefix, 'Size must be between 1 and 5');
            }
        }

        if (settlement.wealth !== undefined) {
            if (settlement.wealth < 1 || settlement.wealth > 5) {
                this.addError(prefix, 'Wealth must be between 1 and 5');
            }
        }

        if (settlement.population !== undefined) {
            if (settlement.population < 0) {
                this.addError(prefix, 'Population cannot be negative');
            }
            
            // Validate population matches size
            if (settlement.size !== undefined && this.tradingConfig) {
                const expectedSize = this.calculateSizeFromPopulation(settlement.population);
                if (expectedSize !== settlement.size) {
                    this.addWarning(prefix, 
                        `Population ${settlement.population} suggests size ${expectedSize}, but size is ${settlement.size}`);
                }
            }
        }

        // Validate array fields
        const arrayFields = ['flags', 'produces', 'demands'];
        arrayFields.forEach(field => {
            if (settlement[field] !== undefined) {
                if (!Array.isArray(settlement[field])) {
                    this.addError(prefix, `"${field}" must be an array`);
                } else {
                    settlement[field].forEach((item, index) => {
                        if (typeof item !== 'string') {
                            this.addError(prefix, `${field}[${index}] must be a string`);
                        }
                    });
                }
            }
        });

        // Validate flag references
        if (settlement.flags && Array.isArray(settlement.flags)) {
            settlement.flags.forEach(flag => {
                if (!this.flags.has(flag)) {
                    this.addWarning(prefix, `Unknown flag "${flag}"`);
                }
            });
        }

        // Validate cargo references
        ['produces', 'demands'].forEach(field => {
            if (settlement[field] && Array.isArray(settlement[field])) {
                settlement[field].forEach(cargo => {
                    if (!this.cargoTypes.has(cargo)) {
                        this.addWarning(prefix, `Unknown cargo type "${cargo}" in ${field}`);
                    }
                });
            }
        });

        // Validate garrison object
        if (settlement.garrison !== undefined) {
            if (typeof settlement.garrison !== 'object' || Array.isArray(settlement.garrison)) {
                this.addError(prefix, '"garrison" must be an object');
            } else {
                Object.entries(settlement.garrison).forEach(([key, value]) => {
                    if (!['a', 'b', 'c'].includes(key)) {
                        this.addWarning(prefix, `Unknown garrison type "${key}"`);
                    }
                    if (typeof value !== 'number' || value < 0) {
                        this.addError(prefix, `garrison.${key} must be a non-negative number`);
                    }
                });
            }
        }
    }

    calculateSizeFromPopulation(population) {
        if (!this.tradingConfig || !this.tradingConfig.populationThresholds) {
            return null;
        }

        const thresholds = this.tradingConfig.populationThresholds;
        for (let size = 1; size <= 5; size++) {
            const threshold = thresholds[size.toString()];
            if (threshold && population >= threshold.min && population <= threshold.max) {
                return size;
            }
        }
        return null;
    }

    addError(location, message, details = null) {
        this.errors.push({ location, message, details });
        if (this.options.verbose) {
            console.error(`❌ ERROR [${location}]: ${message}${details ? ` (${details})` : ''}`);
        }
    }

    addWarning(location, message, details = null) {
        this.warnings.push({ location, message, details });
        if (this.options.verbose) {
            console.warn(`⚠️  WARNING [${location}]: ${message}${details ? ` (${details})` : ''}`);
        }
    }

    printResults() {
        console.log('Validation Results');
        console.log('==================');
        console.log(`Settlements validated: ${this.stats.settlements}`);
        console.log(`Cargo types validated: ${this.stats.cargoTypes}`);
        console.log(`Source flags validated: ${this.stats.flags}`);
        console.log();
        
        if (this.errors.length > 0) {
            console.log(`❌ Errors: ${this.errors.length}`);
            this.errors.forEach(error => {
                console.log(`  [${error.location}] ${error.message}`);
                if (error.details) {
                    console.log(`    Details: ${error.details}`);
                }
            });
            console.log();
        }
        
        if (this.warnings.length > 0) {
            console.log(`⚠️  Warnings: ${this.warnings.length}`);
            if (!this.options.verbose) {
                console.log('  (Run with --verbose to see warnings)');
            } else {
                this.warnings.forEach(warning => {
                    console.log(`  [${warning.location}] ${warning.message}`);
                    if (warning.details) {
                        console.log(`    Details: ${warning.details}`);
                    }
                });
            }
            console.log();
        }
    }
}

// CLI handling
function parseArgs() {
    const args = process.argv.slice(2);
    const options = {
        verbose: false,
        strict: false
    };

    for (const arg of args) {
        switch (arg) {
            case '--verbose':
            case '-v':
                options.verbose = true;
                break;
            case '--strict':
                options.strict = true;
                break;
            case '--help':
            case '-h':
                showHelp();
                process.exit(0);
                break;
        }
    }

    return options;
}

function showHelp() {
    console.log(`
Orange Realism Schema Validator

Usage: node validate-schema.js [options]

Options:
  --verbose, -v    Show detailed error and warning messages
  --strict         Treat warnings as errors
  --help, -h       Show this help message

Examples:
  node validate-schema.js           # Basic validation
  node validate-schema.js --verbose # Show all errors and warnings
`);
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const options = parseArgs();
    const validator = new SchemaValidator(options);
    validator.validate().catch(error => {
        console.error('Validation failed:', error.message);
        process.exit(1);
    });
}

export { SchemaValidator };