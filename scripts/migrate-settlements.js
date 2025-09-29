#!/usr/bin/env node

/**
 * Settlement Migration Script
 * Migrates settlement data from legacy format to orange-realism schema
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const SETTLEMENT_DIR = path.resolve(__dirname, '../datasets/active/settlements');
const TRADING_CONFIG_PATH = path.resolve(__dirname, '../datasets/active/trading-config.json');
const BACKUP_DIR = path.resolve(__dirname, '../migration-backups');

// Legacy size letter mapping to numeric values
const LEGACY_SIZE_MAPPING = {
    'V': 1,    // Village
    'ST': 2,   // Small Town
    'T': 3,    // Town
    'C': 4,    // City
    'CS': 5,   // City State
    'F': 2,    // Fort (treat as small settlement)
    'M': 1     // Mine (treat as hamlet)
};

// Resource categorization - convert old source entries to new structure
const RESOURCE_CATEGORIES = {
    // Flags (non-trade attributes)
    flags: [
        'Trade', 'Government', 'Fort', 'Mine', 'Agriculture', 'Subsistence',
        'Smuggling', 'Piracy', 'Metalworking', 'Boatbuilding'
    ],
    
    // Produces mappings
    produces: {
        'Timber': ['Timber'],
        'Woodcraft': ['Timber'], // Specialized timber working
        'Copper': ['Metal'],
        'Lead': ['Metal'],
        'Iron': ['Metal'],
        'Steel': ['Metal'],
        'Gold': ['Metal'],
        'Silver': ['Metal'],
        'Agriculture': ['Grain'],
        'Fishing': ['Grain'], // Fish counts as bulk food
        'Wine': ['Wine/Brandy'],
        'Brandy': ['Wine/Brandy'],
        'Luxuries': ['Luxuries'],
        'Wool': ['Wool'],
        'Cloth': ['Wool'], // Wool processing
        'Armaments': ['Armaments']
    },
    
    // Demands mappings (settlements that need certain goods)
    demands: {
        'Fort': ['Armaments', 'Grain'],
        'Mine': ['Grain', 'Timber'], // Miners need food and materials
        'Boatbuilding': ['Timber', 'Metal'],
        'Metalworking': ['Metal'],
        'Subsistence': ['Grain'] // Always need food
    }
};

class SettlementMigrator {
    constructor(options = {}) {
        this.options = {
            dryRun: options.dryRun || false,
            backup: options.backup !== false,
            backupDir: options.backupDir || BACKUP_DIR,
            verbose: options.verbose || false
        };
        
        this.stats = {
            processed: 0,
            migrated: 0,
            errors: 0,
            skipped: 0
        };
        
        this.tradingConfig = null;
    }

    async run() {
        try {
            console.log('Settlement Migration Script');
            console.log('===========================');
            console.log(`Mode: ${this.options.dryRun ? 'DRY RUN' : 'LIVE'}`);
            console.log(`Backup: ${this.options.backup ? 'enabled' : 'disabled'}`);
            console.log();

            // Load trading config
            await this.loadTradingConfig();
            
            // Create backup directory if needed
            if (this.options.backup && !this.options.dryRun) {
                await this.createBackupDir();
            }

            // Get all settlement files
            const settlementFiles = await this.getSettlementFiles();
            console.log(`Found ${settlementFiles.length} settlement files to process\n`);

            // Process each file
            for (const file of settlementFiles) {
                await this.processFile(file);
            }

            // Print summary
            this.printSummary();

        } catch (error) {
            console.error('Migration failed:', error.message);
            if (this.options.verbose) {
                console.error(error.stack);
            }
            process.exit(1);
        }
    }

    async loadTradingConfig() {
        try {
            const configData = await fs.promises.readFile(TRADING_CONFIG_PATH, 'utf8');
            this.tradingConfig = JSON.parse(configData);
            console.log('✓ Loaded trading configuration');
        } catch (error) {
            throw new Error(`Failed to load trading config: ${error.message}`);
        }
    }

    async createBackupDir() {
        try {
            await fs.promises.mkdir(this.options.backupDir, { recursive: true });
            console.log(`✓ Created backup directory: ${this.options.backupDir}`);
        } catch (error) {
            throw new Error(`Failed to create backup directory: ${error.message}`);
        }
    }

    async getSettlementFiles() {
        try {
            const files = await fs.promises.readdir(SETTLEMENT_DIR);
            return files.filter(file => file.endsWith('.json')).map(file => path.join(SETTLEMENT_DIR, file));
        } catch (error) {
            throw new Error(`Failed to read settlement directory: ${error.message}`);
        }
    }

    async processFile(filePath) {
        const fileName = path.basename(filePath);
        console.log(`Processing ${fileName}...`);

        try {
            this.stats.processed++;

            // Read and parse file
            const fileData = await fs.promises.readFile(filePath, 'utf8');
            const settlements = JSON.parse(fileData);

            if (!Array.isArray(settlements)) {
                throw new Error('Settlement file must contain an array of settlements');
            }

            // Backup original file
            if (this.options.backup && !this.options.dryRun) {
                const backupPath = path.join(this.options.backupDir, `${fileName}.backup`);
                await fs.promises.writeFile(backupPath, fileData);
                if (this.options.verbose) {
                    console.log(`  ✓ Backed up to ${backupPath}`);
                }
            }

            // Migrate settlements
            const migratedSettlements = settlements.map(settlement => this.migrateSettlement(settlement));
            
            // Write migrated data
            if (!this.options.dryRun) {
                const migratedData = JSON.stringify(migratedSettlements, null, 2);
                await fs.promises.writeFile(filePath, migratedData);
                console.log(`  ✓ Migrated ${migratedSettlements.length} settlements`);
            } else {
                console.log(`  → Would migrate ${migratedSettlements.length} settlements`);
            }

            this.stats.migrated++;

        } catch (error) {
            console.error(`  ✗ Error processing ${fileName}: ${error.message}`);
            this.stats.errors++;
            
            if (this.options.verbose) {
                console.error(error.stack);
            }
        }
    }

    migrateSettlement(settlement) {
        if (this.options.verbose) {
            console.log(`    Migrating: ${settlement.name}`);
        }

        const migrated = {
            region: settlement.region,
            name: settlement.name,
            population: settlement.population || 0,
            size: this.calculateSize(settlement),
            ruler: settlement.ruler || '',
            wealth: settlement.wealth || 1,
            flags: this.extractFlags(settlement),
            produces: this.extractProduces(settlement),
            demands: this.extractDemands(settlement),
            garrison: this.parseGarrison(settlement.garrison),
            notes: settlement.notes || ''
        };

        if (this.options.verbose) {
            console.log(`      Size: ${settlement.size || 'unknown'} → ${migrated.size}`);
            console.log(`      Flags: ${migrated.flags.join(', ')}`);
            console.log(`      Produces: ${migrated.produces.join(', ')}`);
            console.log(`      Demands: ${migrated.demands.join(', ')}`);
        }

        return migrated;
    }

    calculateSize(settlement) {
        // If already numeric, validate it
        if (typeof settlement.size === 'number') {
            return Math.max(1, Math.min(5, settlement.size));
        }

        // Convert legacy letter codes
        if (typeof settlement.size === 'string' && LEGACY_SIZE_MAPPING[settlement.size]) {
            return LEGACY_SIZE_MAPPING[settlement.size];
        }

        // Calculate from population if available
        if (settlement.population && this.tradingConfig) {
            const population = settlement.population;
            const thresholds = this.tradingConfig.populationThresholds;
            
            for (let size = 1; size <= 5; size++) {
                const threshold = thresholds[size.toString()];
                if (population >= threshold.min && population <= threshold.max) {
                    return size;
                }
            }
        }

        // Default to hamlet
        return 1;
    }

    extractFlags(settlement) {
        const flags = [];
        
        if (settlement.source && Array.isArray(settlement.source)) {
            for (const source of settlement.source) {
                const lowerSource = source.toLowerCase();
                
                // Check if this is a flag
                for (const flag of RESOURCE_CATEGORIES.flags) {
                    if (lowerSource === flag.toLowerCase()) {
                        flags.push(flag.toLowerCase());
                        break;
                    }
                }
            }
        }

        // Add implicit flags based on other data
        if (settlement.notes && settlement.notes.toLowerCase().includes('fort')) {
            flags.push('fort');
        }
        
        if (settlement.notes && settlement.notes.toLowerCase().includes('mine')) {
            flags.push('mine');
        }

        // Remove duplicates and return
        return [...new Set(flags)];
    }

    extractProduces(settlement) {
        const produces = [];
        
        if (settlement.source && Array.isArray(settlement.source)) {
            for (const source of settlement.source) {
                // Check if this maps to a cargo type
                if (RESOURCE_CATEGORIES.produces[source]) {
                    produces.push(...RESOURCE_CATEGORIES.produces[source]);
                }
            }
        }

        // Remove duplicates
        return [...new Set(produces)];
    }

    extractDemands(settlement) {
        const demands = [];
        
        // Extract demands based on flags/sources
        if (settlement.source && Array.isArray(settlement.source)) {
            for (const source of settlement.source) {
                if (RESOURCE_CATEGORIES.demands[source]) {
                    demands.push(...RESOURCE_CATEGORIES.demands[source]);
                }
            }
        }

        // Add implicit demands based on wealth
        if (settlement.wealth >= 4) {
            demands.push('Luxuries');
        }

        // Remove duplicates
        return [...new Set(demands)];
    }

    parseGarrison(garrison) {
        const result = {};
        
        if (!garrison || !Array.isArray(garrison) || garrison.length === 0) {
            return result;
        }

        for (const entry of garrison) {
            if (!entry || entry === '') continue;
            
            // Parse formats like "50a/150c", "10a&40b/350c", "-/9c", "-17c"
            const cleanEntry = entry.replace(/\s+/g, '');
            
            // Match patterns like "50a", "150c", "10a&40b"
            const matches = cleanEntry.match(/(\d+)([abc])/g);
            
            if (matches) {
                for (const match of matches) {
                    const [, count, type] = match.match(/(\d+)([abc])/);
                    if (count && type) {
                        result[type] = parseInt(count);
                    }
                }
            }
        }

        return result;
    }

    printSummary() {
        console.log('\nMigration Summary');
        console.log('=================');
        console.log(`Files processed: ${this.stats.processed}`);
        console.log(`Files migrated: ${this.stats.migrated}`);
        console.log(`Errors: ${this.stats.errors}`);
        console.log(`Skipped: ${this.stats.skipped}`);
        
        if (this.options.dryRun) {
            console.log('\n⚠ DRY RUN MODE - No files were actually modified');
            console.log('Run with --live to apply changes');
        } else if (this.stats.migrated > 0) {
            console.log('\n✓ Migration completed successfully');
            if (this.options.backup) {
                console.log(`Backups saved to: ${this.options.backupDir}`);
            }
        }
    }
}

// CLI handling
function parseArgs() {
    const args = process.argv.slice(2);
    const options = {
        dryRun: true, // Default to dry run for safety
        backup: true,
        verbose: false
    };

    for (let i = 0; i < args.length; i++) {
        switch (args[i]) {
            case '--live':
                options.dryRun = false;
                break;
            case '--dry-run':
                options.dryRun = true;
                break;
            case '--no-backup':
                options.backup = false;
                break;
            case '--backup-dir':
                i++;
                if (i < args.length) {
                    options.backupDir = args[i];
                }
                break;
            case '--verbose':
            case '-v':
                options.verbose = true;
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
Settlement Migration Script

Usage: node migrate-settlements.js [options]

Options:
  --live              Apply changes (default is dry-run)
  --dry-run           Preview changes without modifying files (default)
  --no-backup         Skip creating backup files
  --backup-dir <dir>  Custom backup directory (default: ../migration-backups)
  --verbose, -v       Show detailed output
  --help, -h          Show this help message

Examples:
  node migrate-settlements.js                    # Preview migration
  node migrate-settlements.js --live             # Apply migration
  node migrate-settlements.js --live --verbose   # Apply with detailed output
`);
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const options = parseArgs();
    const migrator = new SettlementMigrator(options);
    migrator.run().catch(error => {
        console.error('Migration failed:', error.message);
        process.exit(1);
    });
}

export { SettlementMigrator };