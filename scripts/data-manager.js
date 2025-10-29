/**
 * Trading Places Module - Data Manager
 * Centralized data access and management with validation
 */

console.log('🔧 Loading data-manager.js...');

// Import DatasetPersistence class
import { DatasetPersistence } from './dataset-persistence.js';

const MODULE_ID = "fvtt-trading-places";

let CurrencyUtils = null;
try {
    CurrencyUtils = require('./currency-utils');
} catch (error) {
    // Ignore require failures in browser context; window fallback below.
}

// Safely check for a browser `window` before accessing properties (Node tests don't have `window`)
let _window = (typeof window !== 'undefined') ? window : null;
console.log('🔍 Checking for window.TradingPlacesCurrencyUtils...', !!(_window && _window.TradingPlacesCurrencyUtils));
if (_window && _window.TradingPlacesCurrencyUtils) {
    CurrencyUtils = _window.TradingPlacesCurrencyUtils;
    console.log('✅ CurrencyUtils loaded from window');
} else if (_window) {
    // Running in a browser but the global helper isn't present yet
    console.error('❌ window.TradingPlacesCurrencyUtils not found at data-manager load time');
}

// DatasetPersistence is now imported at the top via ES6 import
// Also expose via window for backward compatibility
console.log('🔍 DatasetPersistence imported:', typeof DatasetPersistence);

// Function to get DatasetPersistence (checks both import and window)
function getDatasetPersistenceClass() {
    // First try the ES6 import
    if (typeof DatasetPersistence !== 'undefined') {
        return DatasetPersistence;
    }
    // Fall back to window object
    if (_window && _window.TradingPlacesDatasetPersistence) {
        return _window.TradingPlacesDatasetPersistence;
    }
    return null;
}

/**
 * Data Manager class for handling settlement and cargo data
 * Now uses DatasetPersistence for loading and storing datasets
 */
class DataManager {
    constructor() {
        this.settlements = [];
        this.cargoTypes = [];
        this.masterResources = {};
        this.config = {};
        this.currentSeason = null;
        this.logger = null; // Will be set by integration
        this.moduleId = MODULE_ID;
        this.activeDatasetName = null;
        this.sourceFlags = {};
        this.tradingConfig = {};
        this.normalizedCurrencyConfig = null;
        this.currencyContextCache = null;
        this.datasetPersistence = null; // Will be initialized when needed
        this.currentDataset = null; // The active dataset object
        this.cargo = []; // Cargo inventory for active dataset
        this.history = []; // Transaction history for active dataset
    }

    /**
     * Get or create the dataset persistence manager
     * @returns {DatasetPersistence} - Dataset persistence instance
     */
    getDatasetPersistence() {
        if (!this.datasetPersistence) {
            const DatasetPersistenceClass = getDatasetPersistenceClass();
            if (DatasetPersistenceClass) {
                this.datasetPersistence = new DatasetPersistenceClass();
                console.log('✅ DatasetPersistence instance created');
            } else {
                console.error('❌ DatasetPersistence class not found on window object');
            }
        }
        return this.datasetPersistence;
    }

    setModuleId(moduleId) {
        if (!moduleId) {
            return;
        }
        this.moduleId = moduleId;
        if (this.datasetPersistence) {
            this.datasetPersistence.moduleId = moduleId;
        }
    }

    /**
     * Initialize data manager and load datasets
     * This replaces the old file-based loading system
     * @returns {Promise<void>}
     */
    async initialize() {
        console.log('🔧 DataManager: Initializing...');
        
        // Check if DatasetPersistence is available
        const DatasetPersistenceClass = getDatasetPersistenceClass();
        if (!DatasetPersistenceClass) {
            console.error('❌ DatasetPersistence not available');
            console.error('Available on window:', Object.keys(window).filter(k => k.includes('Trading')));
            throw new Error('DatasetPersistence module not loaded. Check module.json loading order.');
        }
        
        const persistence = this.getDatasetPersistence();
        if (!persistence) {
            console.error('❌ Failed to create DatasetPersistence instance');
            throw new Error('DatasetPersistence instantiation failed');
        }

        // Initialize datasets (loads from files on first launch, or from flags)
        await persistence.initialize();

        // Load the active dataset
        await this.loadActiveDataset();

        console.log('✅ DataManager initialized');
    }

    /**
     * Load the active dataset based on settings or default
     * @returns {Promise<void>}
     */
    async loadActiveDataset() {
        const persistence = this.getDatasetPersistence();
        
        // Determine which dataset to load
        let datasetId = 'wfrp4e'; // Default
        
        try {
            if (typeof game !== 'undefined' && game.settings) {
                datasetId = game.settings.get(this.moduleId, 'activeDataset') || 'wfrp4e';
            }
        } catch (error) {
            console.warn('Could not read activeDataset setting, using default:', datasetId);
        }

        console.log('📦 Loading dataset:', datasetId);
        
        // Load the dataset
        const dataset = await persistence.getDataset(datasetId);
        
        console.log('📦 Dataset retrieved from persistence:', {
            found: !!dataset,
            datasetId,
            type: dataset?.type
        });
        
        if (!dataset) {
            console.error(`📦 Dataset ${datasetId} not found, falling back to wfrp4e`);
            
            // List available datasets for debugging
            const available = await persistence.listDatasets();
            console.error('📦 Available datasets:', available.map(d => d.id));
            
            this.currentDataset = await persistence.getDataset('wfrp4e');
            this.activeDatasetName = 'wfrp4e';
        } else {
            this.currentDataset = dataset;
            this.activeDatasetName = datasetId;
        }

        // Load dataset components into memory
        this.settlements = this.currentDataset?.settlements || [];
        this.cargoTypes = this.currentDataset?.cargoTypes || [];
        this.config = this.currentDataset?.config || {};
        this.tradingConfig = this.currentDataset?.tradingConfig || {};
        this.sourceFlags = this.currentDataset?.sourceFlags || {};
        this.cargo = this.currentDataset?.cargo || [];
        this.history = this.currentDataset?.history || [];

        console.log(`📦 Loaded dataset: ${this.activeDatasetName}`, {
            settlements: this.settlements.length,
            cargoTypes: this.cargoTypes.length,
            cargo: this.cargo.length
        });
    }

    /**
     * Switch to a different dataset
     * @param {string} datasetId - Dataset identifier
     * @param {boolean} skipSave - Skip saving current dataset (use when current was deleted)
     * @returns {Promise<void>}
     */
    async switchDataset(datasetId, skipSave = false) {
        console.log(`🔄 Switching to dataset: ${datasetId}`, { skipSave });
        
        // Save current dataset before switching (unless it was just deleted)
        if (!skipSave) {
            await this.saveCurrentDataset();
        }

        // Update settings
        if (typeof game !== 'undefined' && game.settings) {
            await game.settings.set(this.moduleId, 'activeDataset', datasetId);
        }

        // Load new dataset
        this.activeDatasetName = datasetId;
        await this.loadActiveDataset();
    }

    /**
     * Save the current dataset back to world flags
     * @returns {Promise<void>}
     */
    async saveCurrentDataset() {
        console.log('🚛 CARGO_PERSIST: saveCurrentDataset called', {
            hasCurrentDataset: !!this.currentDataset,
            activeDatasetName: this.activeDatasetName,
            cargoCount: this.cargo?.length || 0,
            historyCount: this.history?.length || 0
        });
        
        if (!this.currentDataset || !this.activeDatasetName) {
            console.warn('🚛 CARGO_PERSIST: ⚠️ No active dataset to save');
            return;
        }

        // Update dataset object with current state
        this.currentDataset.settlements = this.settlements;
        this.currentDataset.cargoTypes = this.cargoTypes;
        this.currentDataset.config = this.config;
        this.currentDataset.tradingConfig = this.tradingConfig;
        this.currentDataset.sourceFlags = this.sourceFlags;
        this.currentDataset.cargo = this.cargo;
        this.currentDataset.history = this.history;

        console.log('🚛 CARGO_PERSIST: Updated currentDataset object', {
            cargoCount: this.currentDataset.cargo?.length || 0,
            historyCount: this.currentDataset.history?.length || 0
        });

        // Persist to world flags
        const persistence = this.getDatasetPersistence();
        await persistence.updateDataset(this.activeDatasetName, this.currentDataset);
        
        console.log(`🚛 CARGO_PERSIST: ✅ Dataset ${this.activeDatasetName} saved to settings`);
    }

    /**
     * Set the debug logger instance
     * @param {Object} logger - Debug logger instance
     */
    setLogger(logger) {
        this.logger = logger;
    }

    /**
     * Get logger or create a no-op logger if none set
     * @returns {Object} - Logger instance
     */
    getLogger() {
        if (this.logger) {
            return this.logger;
        }
        
        // Return no-op logger if none set
        return {
            logSystem: () => {},
            logCalculation: () => {},
            logDecision: () => {}
        };
    }

    /**
    }

    /**
     * Enhanced settlement validation with detailed error reporting and user feedback support
     * @param {Object} settlement - Settlement object to validate
     * @returns {Object} - Enhanced validation result with detailed error information
     */
    validateSettlement(settlement) {
        const result = {
            valid: true,
            errors: [],
            errorType: null,
            settlement: settlement
        };

        // Check if settlement object exists
        if (!settlement) {
            result.valid = false;
            result.errorType = 'missing_settlement';
            result.errors.push('No settlement selected');
            return result;
        }

        // Check for required fields (orange-realism schema)
        const requiredFields = [
            'region', 'name', 'size', 'ruler',
            'population', 'wealth', 'notes'
        ];
        
        // Optional fields that should be arrays if present
        const optionalArrayFields = ['flags', 'produces', 'demands'];
        
        // Garrison can be object or legacy array
        const specialFields = ['garrison'];

        // Check for missing fields (maintain backward compatibility)
        const missingFields = requiredFields.filter(field =>
            !settlement.hasOwnProperty(field) || settlement[field] === null || settlement[field] === undefined
        );

        if (missingFields.length > 0) {
            result.valid = false;
            result.errorType = 'missing_fields';
            result.errors.push(`Missing required fields: ${missingFields.join(', ')}`);
        }

        // Validate numeric fields
        const numericFields = [
            { field: 'wealth', min: 1, max: 5 },
            { field: 'population', min: 0, max: 999999999 }
        ];
        
        numericFields.forEach(({ field, min, max }) => {
            if (settlement.hasOwnProperty(field)) {
                const value = settlement[field];
                if (typeof value !== 'number' || isNaN(value) || value < min || value > max) {
                    result.valid = false;
                    result.errorType = result.errorType || 'invalid_values';
                    result.errors.push(`${field} must be a number between ${min} and ${max}`);
                }
            }
        });

        // Validate array fields
        optionalArrayFields.forEach(field => {
            if (settlement.hasOwnProperty(field) && settlement[field] !== null && settlement[field] !== undefined) {
                if (!Array.isArray(settlement[field])) {
                    result.valid = false;
                    result.errorType = result.errorType || 'invalid_types';
                    result.errors.push(`${field} must be an array`);
                } else {
                    // Check array contents are strings
                    const invalidItems = settlement[field].filter(item => typeof item !== 'string');
                    if (invalidItems.length > 0) {
                        result.valid = false;
                        result.errorType = result.errorType || 'invalid_array_contents';
                        result.errors.push(`${field} array must contain only strings`);
                    }
                }
            }
        });

        // Validate garrison field (can be object or legacy array)
        if (settlement.hasOwnProperty('garrison') && settlement.garrison !== null && settlement.garrison !== undefined) {
            if (typeof settlement.garrison === 'object' && !Array.isArray(settlement.garrison)) {
                // New object format - validate keys and values
                const validKeys = ['a', 'b', 'c'];
                const invalidKeys = Object.keys(settlement.garrison).filter(key => !validKeys.includes(key));
                if (invalidKeys.length > 0) {
                    result.valid = false;
                    result.errorType = result.errorType || 'invalid_garrison';
                    result.errors.push(`garrison contains invalid keys: ${invalidKeys.join(', ')}`);
                }
                
                Object.values(settlement.garrison).forEach(value => {
                    if (typeof value !== 'number' || value < 0) {
                        result.valid = false;
                        result.errorType = result.errorType || 'invalid_garrison';
                        result.errors.push('garrison values must be non-negative numbers');
                    }
                });
            } else if (!Array.isArray(settlement.garrison)) {
                result.valid = false;
                result.errorType = result.errorType || 'invalid_garrison';
                result.errors.push('garrison must be an object or array');
            }
        }

        // Additional enhanced validation for empty string fields
        const emptyStringFields = [];
        const criticalStringFields = ['region', 'name', 'ruler']; // Notes is optional
        criticalStringFields.forEach(field => {
            if (settlement.hasOwnProperty(field) && settlement[field] !== null && settlement[field] !== undefined) {
                if (typeof settlement[field] === 'string' && settlement[field].trim() === '') {
                    emptyStringFields.push(field + ' (empty)');
                }
            }
        });

        if (emptyStringFields.length > 0) {
            result.valid = false;
            result.errorType = result.errorType || 'empty_fields';
            result.errors.push(`Settlement has empty critical fields: ${emptyStringFields.join(', ')}`);
        }

        // Enhanced type validation for specific fields
        if (settlement.hasOwnProperty('population')) {
            if (typeof settlement.population !== 'number' || settlement.population < 0) {
                result.valid = false;
                result.errors.push('Population must be a positive number');
            }
        }

        // Enhanced wealth validation (maintain backward compatibility)
        if (settlement.hasOwnProperty('wealth')) {
            if (typeof settlement.wealth !== 'number' || settlement.wealth < 1 || settlement.wealth > 5) {
                result.valid = false;
                result.errors.push('Wealth must be a number between 1-5');
            }
        }

        // Enhanced source array validation (maintain backward compatibility)
        if (settlement.hasOwnProperty('source')) {
            if (!Array.isArray(settlement.source)) {
                result.valid = false;
                result.errors.push('Source must be an array');
            } else if (settlement.source.length === 0) {
                result.valid = false;
                result.errors.push('Source array cannot be empty');
            } else {
                // Enhanced validation: check each source item is a non-empty string
                const invalidSources = settlement.source.filter(source => 
                    typeof source !== 'string' || source.trim() === ''
                );
                if (invalidSources.length > 0) {
                    result.valid = false;
                    result.errors.push(`Source array contains ${invalidSources.length} invalid entries`);
                }
            }
        }

        // Enhanced size validation (accept both string enum and numeric values)
        if (settlement.hasOwnProperty('size')) {
            const validSizes = ['CS', 'C', 'T', 'ST', 'V', 'F', 'M'];
            const validNumericSizes = [1, 2, 3, 4, 5];

            if (typeof settlement.size === 'string' && !validSizes.includes(settlement.size)) {
                result.valid = false;
                result.errors.push(`Size must be one of: ${validSizes.join(', ')} or a number 1-5`);
            } else if (typeof settlement.size === 'number' && !validNumericSizes.includes(settlement.size)) {
                result.valid = false;
                result.errors.push(`Size must be one of: ${validSizes.join(', ')} or a number 1-5`);
            }
        }

        // Enhanced string field validation (maintain backward compatibility)
        // Notes field is optional and doesn't need to be validated for emptiness
        const requiredStringFields = ['region', 'name', 'ruler'];
        requiredStringFields.forEach(field => {
            if (settlement.hasOwnProperty(field)) {
                if (typeof settlement[field] !== 'string' || settlement[field].trim() === '') {
                    result.valid = false;
                    result.errors.push(`${field} must be a non-empty string`);
                }
            }
        });

        // Validate notes field if it exists - it must be a string but can be empty or whitespace
        if (settlement.hasOwnProperty('notes')) {
            if (settlement.notes !== null && settlement.notes !== undefined && typeof settlement.notes !== 'string') {
                result.valid = false;
                result.errors.push('notes must be a string (can be empty)');
            }
        }

        // Enhanced garrison validation (accept both array and object formats)
        if (settlement.hasOwnProperty('garrison')) {
            if (!Array.isArray(settlement.garrison) && typeof settlement.garrison !== 'object') {
                result.valid = false;
                result.errors.push('Garrison must be an array or object');
            }
        }

        // Set error type for validation failures
        if (!result.valid && !result.errorType) {
            result.errorType = 'validation_failed';
        }

        return result;

        return result;
    }

    /**
     * Validate complete dataset structure
     * @param {Object} dataset - Dataset object to validate
     * @returns {Object} - Validation result with success flag and errors
     */
    validateDatasetStructure(dataset) {
        const result = {
            valid: true,
            errors: []
        };

        // Check for required top-level properties
        if (!dataset.hasOwnProperty('settlements') || !Array.isArray(dataset.settlements)) {
            result.valid = false;
            result.errors.push('Dataset must contain a settlements array');
        }

        if (!dataset.hasOwnProperty('config') || typeof dataset.config !== 'object') {
            result.valid = false;
            result.errors.push('Dataset must contain a config object');
        }

        // Validate each settlement if settlements array exists
        if (dataset.settlements && Array.isArray(dataset.settlements)) {
            dataset.settlements.forEach((settlement, index) => {
                const settlementValidation = this.validateSettlement(settlement);
                if (!settlementValidation.valid) {
                    result.valid = false;
                    result.errors.push(`Settlement ${index} (${settlement.name || 'unnamed'}): ${settlementValidation.errors.join(', ')}`);
                }
            });
        }

        // Validate config structure
        if (dataset.config && typeof dataset.config === 'object') {
            console.log('🔍 DEBUG: Validating config structure');
            console.log('🔍 DEBUG: Config keys:', Object.keys(dataset.config));
            console.log('🔍 DEBUG: Config object:', dataset.config);

            // Check for required config sections
            const requiredConfigSections = ['currency', 'inventory'];
            requiredConfigSections.forEach(section => {
                console.log(`🔍 DEBUG: Checking for section '${section}':`, dataset.config.hasOwnProperty(section));
                if (!dataset.config.hasOwnProperty(section)) {
                    result.valid = false;
                    result.errors.push(`Config missing required section: ${section}`);
                }
            });

            // Validate currency config
            if (dataset.config.currency) {
                console.log('🔍 DEBUG: Validating currency config:', dataset.config.currency);
                const currencyConfig = dataset.config.currency;
                if (!currencyConfig.canonicalUnit || typeof currencyConfig.canonicalUnit.value !== 'number') {
                    result.valid = false;
                    result.errors.push('Config currency.canonicalUnit must define a numeric value');
                }

                if (!Array.isArray(currencyConfig.denominations) || currencyConfig.denominations.length === 0) {
                    result.valid = false;
                    result.errors.push('Config currency.denominations must be a non-empty array');
                }
            }

            // Validate inventory config
            if (dataset.config.inventory) {
                console.log('🔍 DEBUG: Validating inventory config:', dataset.config.inventory);
                if (!dataset.config.inventory.field || typeof dataset.config.inventory.field !== 'string') {
                    result.valid = false;
                    result.errors.push('Config inventory.field must be a non-empty string');
                }
            }
        }

        return result;
    }

    /**
     * Generate detailed diagnostic report for validation errors
     * @param {Array} errors - Array of error messages
     * @returns {string} - Formatted diagnostic report
     */
    generateDiagnosticReport(errors) {
        if (!errors || errors.length === 0) {
            return 'No validation errors found.';
        }

        let report = 'Dataset Validation Failed:\n';
        report += '='.repeat(50) + '\n\n';

        errors.forEach((error, index) => {
            report += `${index + 1}. ${error}\n`;
        });

        report += '\n' + '='.repeat(50) + '\n';
        report += 'Please fix these issues before loading the dataset.';

        return report;
    }

    /**
     * Validate dataset completeness and provide specific missing field information
     * @param {Object} dataset - Dataset to validate
     * @returns {Object} - Detailed validation result
     */
    validateDatasetCompleteness(dataset, options = {}) {
        // options.lenient: when true, attempt to auto-fill missing config sections
        // with safe defaults and report them as warnings instead of hard errors.
        const opts = Object.assign({ lenient: false }, options);

        // If lenient mode and config is present, auto-fill missing sections
        if (opts.lenient && dataset && dataset.config && typeof dataset.config === 'object') {
            const requiredConfigSections = ['currency', 'inventory'];
            requiredConfigSections.forEach(section => {
                if (!dataset.config.hasOwnProperty(section)) {
                    try {
                        if (section === 'currency') dataset.config.currency = this.getCurrencyConfig();
                        if (section === 'inventory') dataset.config.inventory = this.getInventoryConfig();
                    } catch (err) {
                        // ignore - let strict validation catch this
                    }
                }
            });
        }

        const result = this.validateDatasetStructure(dataset);

        if (!result.valid) {
            result.diagnosticReport = this.generateDiagnosticReport(result.errors);
        } else if (opts.lenient && Array.isArray(result.warnings) && result.warnings.length > 0) {
            // If lenient mode produced warnings (e.g., we filled defaults earlier), attach a diagnostic
            result.diagnosticReport = this.generateDiagnosticReport(result.warnings);
        }

        return result;
    }

    /**
     * Validate cargo data structure
     * @param {Object} cargo - Cargo object to validate
     * @returns {Object} - Validation result with success flag and errors
     */
    validateCargo(cargo) {
        const result = {
            valid: true,
            errors: []
        };

        // Required fields for cargo (support both old and new formats)
        const requiredFields = ['name', 'category'];
        
        // Check for missing fields
        const missingFields = requiredFields.filter(field =>
            !cargo.hasOwnProperty(field) || cargo[field] === null || cargo[field] === undefined
        );

        // Check for pricing data (either new format or old format)
        const hasNewFormat = cargo.hasOwnProperty('basePrice') && cargo.hasOwnProperty('seasonalModifiers');
        const hasOldFormat = cargo.hasOwnProperty('basePrices');
        
        if (!hasNewFormat && !hasOldFormat) {
            missingFields.push('basePrice + seasonalModifiers (or basePrices)');
        }

        if (missingFields.length > 0) {
            result.valid = false;
            result.errors.push(`Missing required fields: ${missingFields.join(', ')}`);
        }

        // Validate name is a non-empty string
        if (cargo.hasOwnProperty('name')) {
            if (typeof cargo.name !== 'string' || cargo.name.trim() === '') {
                result.valid = false;
                result.errors.push('Name must be a non-empty string');
            }
        }

        // Validate category is a non-empty string
        if (cargo.hasOwnProperty('category')) {
            if (typeof cargo.category !== 'string' || cargo.category.trim() === '') {
                result.valid = false;
                result.errors.push('Category must be a non-empty string');
            }
        }

        // Validate basePrice (new format)
        if (cargo.hasOwnProperty('basePrice')) {
            if (typeof cargo.basePrice !== 'number') {
                result.valid = false;
                result.errors.push('BasePrice must be a number');
            } else if (cargo.basePrice <= 0 && !cargo.qualitySystem) {
                // Allow zero basePrice for cargo with quality systems (e.g., wines, brandies)
                result.valid = false;
                result.errors.push('BasePrice must be a positive number (or use a quality system)');
            }
        }

        // Validate seasonalModifiers (new format)
        if (cargo.hasOwnProperty('seasonalModifiers')) {
            if (typeof cargo.seasonalModifiers !== 'object' || cargo.seasonalModifiers === null) {
                result.valid = false;
                result.errors.push('SeasonalModifiers must be an object');
            } else {
                const requiredSeasons = ['spring', 'summer', 'autumn', 'winter'];
                const missingSeasons = requiredSeasons.filter(season =>
                    !cargo.seasonalModifiers.hasOwnProperty(season) || typeof cargo.seasonalModifiers[season] !== 'number'
                );

                if (missingSeasons.length > 0) {
                    result.valid = false;
                    result.errors.push(`SeasonalModifiers missing or invalid for seasons: ${missingSeasons.join(', ')}`);
                }

                // Validate all modifiers are positive numbers
                Object.entries(cargo.seasonalModifiers).forEach(([season, modifier]) => {
                    if (typeof modifier !== 'number' || modifier < 0) {
                        result.valid = false;
                        result.errors.push(`SeasonalModifiers.${season} must be a non-negative number`);
                    }
                });
            }
        }

        // Validate basePrices (old format, for backward compatibility)
        if (cargo.hasOwnProperty('basePrices')) {
            if (typeof cargo.basePrices !== 'object' || cargo.basePrices === null) {
                result.valid = false;
                result.errors.push('BasePrices must be an object');
            } else {
                const requiredSeasons = ['spring', 'summer', 'autumn', 'winter'];
                const missingSeasons = requiredSeasons.filter(season =>
                    !cargo.basePrices.hasOwnProperty(season) || typeof cargo.basePrices[season] !== 'number'
                );

                if (missingSeasons.length > 0) {
                    result.valid = false;
                    result.errors.push(`BasePrices missing or invalid for seasons: ${missingSeasons.join(', ')}`);
                }

                // Validate all prices are positive numbers
                Object.entries(cargo.basePrices).forEach(([season, price]) => {
                    if (typeof price !== 'number' || price < 0) {
                        result.valid = false;
                        result.errors.push(`BasePrices.${season} must be a non-negative number`);
                    }
                });
            }
        }

        // Validate qualityTiers if present (optional for wine/brandy)
        if (cargo.hasOwnProperty('qualityTiers')) {
            if (typeof cargo.qualityTiers !== 'object' || cargo.qualityTiers === null) {
                result.valid = false;
                result.errors.push('QualityTiers must be an object');
            } else {
                Object.entries(cargo.qualityTiers).forEach(([tier, multiplier]) => {
                    if (typeof multiplier !== 'number' || multiplier <= 0) {
                        result.valid = false;
                        result.errors.push(`QualityTiers.${tier} must be a positive number`);
                    }
                });
            }
        }

        // Validate deteriorationRate if present (optional)
        if (cargo.hasOwnProperty('deteriorationRate')) {
            if (typeof cargo.deteriorationRate !== 'number' || cargo.deteriorationRate < 0 || cargo.deteriorationRate > 1) {
                result.valid = false;
                result.errors.push('DeteriorationRate must be a number between 0 and 1');
            }
        }

        return result;
    }

    /**
     * Get seasonal price for a cargo type
     * @param {Object} cargo - Cargo object with basePrices
     * @param {string} season - Season name (spring, summer, autumn, winter)
     * @param {string} quality - Quality tier (optional, for wine/brandy)
     * @returns {number} - Calculated price
     */
    getSeasonalPrice(cargo, season, quality = 'average') {
        if (!cargo) {
            throw new Error('Invalid cargo object');
        }

        const validSeasons = ['spring', 'summer', 'autumn', 'winter'];
        if (!validSeasons.includes(season)) {
            throw new Error(`Invalid season: ${season}. Must be one of: ${validSeasons.join(', ')}`);
        }

        let basePrice;

        // Calculate seasonal price from basePrice * seasonalModifiers
        if (cargo.basePrice && cargo.seasonalModifiers && cargo.seasonalModifiers.hasOwnProperty(season)) {
            basePrice = cargo.basePrice * cargo.seasonalModifiers[season];
        } else if (cargo.basePrices && cargo.basePrices.hasOwnProperty(season)) {
            // Backwards compatibility: direct seasonal prices (deprecated)
            basePrice = cargo.basePrices[season];
        } else {
            throw new Error(`No price data for season: ${season}. Cargo must have basePrice and seasonalModifiers`);
        }

        // Apply quality tier multiplier if cargo has quality tiers (wine/brandy)
        if (cargo.qualityTiers && cargo.qualityTiers.hasOwnProperty(quality)) {
            basePrice *= cargo.qualityTiers[quality];
        }

        return basePrice;
    }

    /**
     * Get all seasonal prices for a cargo type
     * @param {Object} cargo - Cargo object with basePrices
     * @param {string} quality - Quality tier (optional, for wine/brandy)
     * @returns {Object} - Object with seasonal prices
     */
    getAllSeasonalPrices(cargo, quality = 'average') {
        const seasons = ['spring', 'summer', 'autumn', 'winter'];
        const prices = {};

        seasons.forEach(season => {
            try {
                prices[season] = this.getSeasonalPrice(cargo, season, quality);
            } catch (error) {
                prices[season] = null;
            }
        });

        return prices;
    }

    /**
     * Calculate price with quality tier modifier
     * @param {number} basePrice - Base price for the season
     * @param {Object} cargo - Cargo object
     * @param {string} quality - Quality tier
     * @returns {number} - Price with quality modifier applied
     */
    calculateQualityPrice(basePrice, cargo, quality = 'average') {
        if (!cargo.qualityTiers) {
            return basePrice;
        }

        const qualityMultiplier = cargo.qualityTiers[quality];
        if (qualityMultiplier === undefined) {
            throw new Error(`Invalid quality tier: ${quality}. Available tiers: ${Object.keys(cargo.qualityTiers).join(', ')}`);
        }

        return basePrice * qualityMultiplier;
    }

    /**
     * Get available quality tiers for a cargo type
     * @param {Object} cargo - Cargo object
     * @returns {Array} - Array of available quality tier names
     */
    getAvailableQualityTiers(cargo) {
        if (!cargo.qualityTiers) {
            return ['average']; // Default quality tier
        }

        return Object.keys(cargo.qualityTiers);
    }

    /**
     * Create a standard cargo data structure
     * @param {string} name - Cargo name
     * @param {string} category - Cargo category
     * @param {Object} seasonalPrices - Object with spring, summer, autumn, winter prices
     * @param {Object} options - Optional parameters (qualityTiers, deteriorationRate, specialRules)
     * @returns {Object} - Standardized cargo object
     */
    createCargoData(name, category, seasonalPrices, options = {}) {
        const cargo = {
            name: name,
            category: category,
            basePrices: seasonalPrices
        };

        // Add optional properties
        if (options.qualityTiers) {
            cargo.qualityTiers = options.qualityTiers;
        }

        if (options.deteriorationRate !== undefined) {
            cargo.deteriorationRate = options.deteriorationRate;
        }

        if (options.specialRules) {
            cargo.specialRules = options.specialRules;
        }

        return cargo;
    }

    /**
     * Convert settlement size enumeration to numeric value
     * @param {string|number} sizeEnum - Size enumeration (CS/C/T/ST/V/F/M) or numeric value (1-5)
     * @returns {number} - Numeric size value (1-5)
     */
    convertSizeToNumeric(sizeEnum) {
        // If it's already a number, return it (handles numeric size format)
        if (typeof sizeEnum === 'number' && sizeEnum >= 1 && sizeEnum <= 5) {
            return sizeEnum;
        }

        // Handle string enumeration format
        const sizeMapping = {
            'CS': 4, // City State (any size)
            'C': 4,  // City (10,000+)
            'T': 3,  // Town (1,000 - 10,000)
            'ST': 2, // Small Town (100 - 1,000)
            'V': 1,  // Village (1-100)
            'F': 2,  // Fort (any size)
            'M': 2   // Mine (any size)
        };

        if (typeof sizeEnum === 'string' && sizeMapping.hasOwnProperty(sizeEnum)) {
            return sizeMapping[sizeEnum];
        }

        throw new Error(`Invalid size enumeration: ${sizeEnum}. Valid values: ${Object.keys(sizeMapping).join(', ')} or numbers 1-5`);
    }

    /**
     * Get wealth scale effect as percentage modifier
     * @param {number} wealthRating - Wealth rating (1-5)
     * @returns {number} - Percentage modifier (0.5 to 1.1)
     */
    getWealthModifier(wealthRating) {
        const wealthModifiers = {
            1: 0.50, // Squalid - 50% base price
            2: 0.80, // Poor - 80% base price
            3: 1.00, // Average - 100% base price
            4: 1.05, // Bustling - 105% base price
            5: 1.10  // Prosperous - 110% base price
        };

        if (!wealthModifiers.hasOwnProperty(wealthRating)) {
            throw new Error(`Invalid wealth rating: ${wealthRating}. Must be between 1-5`);
        }

        return wealthModifiers[wealthRating];
    }

    /**
     * Get wealth description from rating
     * @param {number} wealthRating - Wealth rating (1-5)
     * @returns {string} - Wealth description
     */
    getWealthDescription(wealthRating) {
        const wealthDescriptions = {
            1: 'Squalid',
            2: 'Poor',
            3: 'Average',
            4: 'Bustling',
            5: 'Prosperous'
        };

        if (!wealthDescriptions.hasOwnProperty(wealthRating)) {
            throw new Error(`Invalid wealth rating: ${wealthRating}. Must be between 1-5`);
        }

        return wealthDescriptions[wealthRating];
    }

    /**
     * Get size description from enumeration or numeric value
     * @param {string|number} sizeEnum - Size enumeration (CS/C/T/ST/V/F/M) or numeric value (1-5)
     * @returns {string} - Size description
     */
    getSizeDescription(sizeEnum) {
        // Handle numeric sizes (1-5)
        if (typeof sizeEnum === 'number') {
            const numericDescriptions = {
                1: 'Village',
                2: 'Small Town',
                3: 'Town',
                4: 'City',
                5: 'City State'
            };

            if (numericDescriptions.hasOwnProperty(sizeEnum)) {
                return numericDescriptions[sizeEnum];
            }
        }

        // Handle string enumerations (legacy support)
        const stringDescriptions = {
            'CS': 'City State',
            'C': 'City',
            'T': 'Town',
            'ST': 'Small Town',
            'V': 'Village',
            'F': 'Fort',
            'M': 'Mine'
        };

        if (stringDescriptions.hasOwnProperty(sizeEnum)) {
            return stringDescriptions[sizeEnum];
        }

        throw new Error(`Invalid size enumeration: ${sizeEnum}. Valid values: 1-5 or CS, C, T, ST, V, F, M`);
    }

    /**
     * Get settlement property lookup helpers
     * @param {Object} settlement - Settlement object
     * @returns {Object} - Object with calculated properties
     */
    getSettlementProperties(settlement) {
        if (!settlement) {
            throw new Error('Settlement object is required');
        }

        const validation = this.validateSettlement(settlement);
        if (!validation.valid) {
            throw new Error(`Invalid settlement: ${validation.errors.join(', ')}`);
        }

        return {
            name: settlement.name,
            region: settlement.region,
            sizeEnum: settlement.size,
            sizeNumeric: this.convertSizeToNumeric(settlement.size),
            sizeDescription: this.getSizeDescription(settlement.size),
            wealthRating: settlement.wealth,
            wealthModifier: this.getWealthModifier(settlement.wealth),
            wealthDescription: this.getWealthDescription(settlement.wealth),
            population: settlement.population,
            productionCategories: settlement.flags || settlement.source || [],
            produces: Array.isArray(settlement.produces) ? [...settlement.produces] : [],
            demands: Array.isArray(settlement.demands) ? [...settlement.demands] : [],
            garrison: settlement.garrison,
            ruler: settlement.ruler,
            notes: settlement.notes
        };
    }

    /**
     * Calculate base availability chance for cargo at settlement
     * @param {Object} settlement - Settlement object
     * @returns {number} - Availability percentage (0-100)
     */
    calculateAvailabilityChance(settlement) {
        const properties = this.getSettlementProperties(settlement);
        return (properties.sizeNumeric + properties.wealthRating) * 10;
    }

    /**
     * Calculate base cargo size multiplier for settlement
     * @param {Object} settlement - Settlement object
     * @returns {number} - Base multiplier for cargo size calculation
     */
    calculateCargoSizeBase(settlement) {
        const properties = this.getSettlementProperties(settlement);
        return properties.sizeNumeric + properties.wealthRating;
    }

    /**
     * Check if settlement produces Trade goods
     * @param {Object} settlement - Settlement object
     * @returns {boolean} - True if settlement produces Trade goods
     */
    isTradeSettlement(settlement) {
        const productionCategories = settlement.flags || settlement.source || [];
        return !!(settlement && productionCategories && Array.isArray(productionCategories) && productionCategories.includes('Trade'));
    }

    /**
     * Get all valid size enumerations
     * @returns {Array} - Array of valid size enumerations
     */
    getValidSizeEnumerations() {
        return ['CS', 'C', 'T', 'ST', 'V', 'F', 'M'];
    }

    /**
     * Get all valid wealth ratings
     * @returns {Array} - Array of valid wealth ratings
     */
    getValidWealthRatings() {
        return [1, 2, 3, 4, 5];
    }

    /**
     * Validate cargo type data structure
     * @param {Object} cargoType - Cargo type object to validate
     * @returns {Object} - Validation result with success flag and errors
     */
    validateCargoType(cargoType) {
        return this.validateCargo(cargoType);
    }

    /**
     * Update settlement data - now persists to world flags
     * @param {Object} settlement - Settlement object to update
     * @returns {Promise<boolean>} - Success flag
     */
    async updateSettlement(settlement) {
        try {
            const validation = this.validateSettlement(settlement);
            if (!validation.valid) {
                throw new Error(`Settlement validation failed: ${validation.errors.join(', ')}`);
            }

            // Find and update in memory
            const index = this.settlements.findIndex(s => s.name === settlement.name);
            if (index >= 0) {
                this.settlements[index] = foundry.utils.deepClone(settlement);
            } else {
                // Add new settlement
                this.settlements.push(foundry.utils.deepClone(settlement));
            }

            console.log(`Settlement '${settlement.name}' updated successfully`);
            
            // Auto-refresh region dropdown if trading interface is open
            setTimeout(() => {
                const regionSelect = document.querySelector('#region-select');
                if (regionSelect) {
                    console.log('REGION DROPDOWN - Auto-refreshing after settlement update');
                    const settlements = this.getAllSettlements();
                    const regions = [...new Set(settlements.map(s => s.region))].sort();
                    regionSelect.innerHTML = '<option value="">Select a region...</option>';
                    regions.forEach(region => {
                        const option = document.createElement('option');
                        option.value = region;
                        option.textContent = region;
                        regionSelect.appendChild(option);
                    });
                    console.log('REGION DROPDOWN - Auto-refreshed with regions:', regions);
                }
            }, 100);

            // Persist to world flags
            await this.saveCurrentDataset();
            
            return true;
        } catch (error) {
            console.error('Failed to update settlement:', error);
            throw error;
        }
    }

    /**
     * Update cargo type data - now persists to world flags
     * @param {Object} cargoType - Cargo type object to update
     * @returns {Promise<boolean>} - Success flag
     */
    async updateCargoType(cargoType) {
        try {
            const validation = this.validateCargoType(cargoType);
            if (!validation.valid) {
                throw new Error(`Cargo type validation failed: ${validation.errors.join(', ')}`);
            }

            // Find and update in memory
            const index = this.cargoTypes.findIndex(c => c.name === cargoType.name);
            if (index >= 0) {
                this.cargoTypes[index] = foundry.utils.deepClone(cargoType);
            } else {
                // Add new cargo type
                this.cargoTypes.push(foundry.utils.deepClone(cargoType));
            }

            console.log(`Cargo type '${cargoType.name}' updated successfully`);
            
            // Persist to world flags
            await this.saveCurrentDataset();
            
            return true;
        } catch (error) {
            console.error('Failed to update cargo type:', error);
            throw error;
        }
    }

    /**
     * Create a new user dataset - now uses DatasetPersistence
     * @param {string} datasetId - Dataset identifier
     * @param {string} label - Dataset display label
     * @returns {Promise<Object>} - Newly created dataset
     */
    async createUserDataset(datasetId, label) {
        const persistence = this.getDatasetPersistence();
        const dataset = await persistence.createUserDataset(datasetId, label);
        console.log(`✅ User dataset ${datasetId} created`);
        return dataset;
    }

    /**
     * Delete a dataset - now uses DatasetPersistence
     * @param {string} datasetId - Dataset identifier
     * @returns {Promise<boolean>} - Success flag
     */
    async deleteDataset(datasetId) {
        const persistence = this.getDatasetPersistence();
        const result = await persistence.deleteDataset(datasetId);
        
        // If we deleted the active dataset, switch to wfrp4e WITHOUT saving
        if (result && datasetId === this.activeDatasetName) {
            await this.switchDataset('wfrp4e', true); // skipSave = true
        }
        
        return result;
    }

    /**
     * Get list of all available datasets
     * @returns {Promise<Array>} - Array of dataset info objects
     */
    async listDatasets() {
        const persistence = this.getDatasetPersistence();
        return await persistence.listDatasets();
    }

    /**
     * Delete a settlement from the active dataset
     * @param {string} settlementName - Name of the settlement to delete
     * @returns {Promise<boolean>} - Success flag
     */
    async deleteSettlement(settlementName) {
        const index = this.settlements.findIndex(s => s.name === settlementName);
        if (index >= 0) {
            this.settlements.splice(index, 1);
            await this.saveCurrentDataset();
            console.log(`Settlement '${settlementName}' deleted`);
            return true;
        }
        return false;
    }

    /**
     * Delete a cargo type from the active dataset
     * @param {string} cargoName - Name of the cargo type to delete
     * @returns {Promise<boolean>} - Success flag
     */
    async deleteCargoType(cargoName) {
        const index = this.cargoTypes.findIndex(c => c.name === cargoName);
        if (index >= 0) {
            this.cargoTypes.splice(index, 1);
            await this.saveCurrentDataset();
            console.log(`Cargo type '${cargoName}' deleted`);
            return true;
        }
        return false;
    }


    /**
     * Delete settlement by name (placeholder - would typically remove from file system)
     * @param {string} settlementName - Name of settlement to delete
     * @returns {Promise<boolean>} - Success flag
     */
    async deleteSettlement(settlementName) {
        try {
            const index = this.settlements.findIndex(s => s.name === settlementName);
            if (index >= 0) {
                // Prevent deletion if it would leave no settlements
                if (this.settlements.length <= 1) {
                    throw new Error('Cannot delete the last settlement. Datasets must have at least one settlement.');
                }

                this.settlements.splice(index, 1);
                console.log(`Settlement '${settlementName}' deleted successfully`);
                
                // Auto-refresh region dropdown if trading interface is open
                setTimeout(() => {
                    const regionSelect = document.querySelector('#region-select');
                    if (regionSelect) {
                        const settlements = this.getAllSettlements();
                        const regions = [...new Set(settlements.map(s => s.region))].sort();
                        regionSelect.innerHTML = '<option value="">Select a region...</option>';
                        regions.forEach(region => {
                            const option = document.createElement('option');
                            option.value = region;
                            option.textContent = region;
                            regionSelect.appendChild(option);
                        });
                    }
                }, 100);
                
                await this._persistUserDatasetChanges();
                return true;
            } else {
                throw new Error(`Settlement '${settlementName}' not found`);
            }
        } catch (error) {
            console.error('Failed to delete settlement:', error);
            throw error;
        }
    }

    /**
     * Delete cargo type by name (placeholder - would typically remove from file system)
     * @param {string} cargoTypeName - Name of cargo type to delete
     * @returns {Promise<boolean>} - Success flag
     */
    async deleteCargoType(cargoTypeName) {
        try {
            const index = this.cargoTypes.findIndex(c => c.name === cargoTypeName);
            if (index >= 0) {
                // Prevent deletion if it would leave no cargo types
                if (this.cargoTypes.length <= 1) {
                    throw new Error('Cannot delete the last cargo type. Datasets must have at least one cargo type.');
                }

                this.cargoTypes.splice(index, 1);
                console.log(`Cargo type '${cargoTypeName}' deleted successfully`);
                await this._persistUserDatasetChanges();
                return true;
            } else {
                throw new Error(`Cargo type '${cargoTypeName}' not found`);
            }
        } catch (error) {
            console.error('Failed to delete cargo type:', error);
            throw error;
        }
    }

    /**
     * Delete a user dataset
     * @param {string} datasetName - Name of the dataset to delete
     * @returns {Promise<boolean>} - Success flag

    /**
     * Persist user dataset changes back to Foundry settings
     * @returns {Promise<boolean>} - Success flag
     */
    async _persistUserDatasetChanges() {
        try {
            if (typeof game === 'undefined' || !game.settings) {
                console.error('PERSIST: FoundryVTT environment required for user datasets');
                throw new Error('FoundryVTT environment required for user datasets');
            }

            const userDatasetsData = game.settings.get(MODULE_ID, 'userDatasetsData') || {};
            const currentDatasetName = this.activeDatasetName;

            if (!currentDatasetName) {
                console.error('PERSIST: No current dataset name set');
                throw new Error('No current dataset name set');
            }

            // Update the current dataset data
            userDatasetsData[currentDatasetName] = {
                settlements: this.settlements,
                cargoTypes: this.cargoTypes,
                config: this.config,
                tradingConfig: this.tradingConfig,
                sourceFlags: this.sourceFlags,
                lastModified: new Date().toISOString()
            };

            await game.settings.set(MODULE_ID, 'userDatasetsData', userDatasetsData);
            console.log(`User dataset '${currentDatasetName}' changes persisted`);
            return true;
        } catch (error) {
            console.error('Failed to persist user dataset changes:', error);
            throw error;
        }
    }


    /**
     * Load custom settlements and cargo types from Foundry settings
     */
    async loadCustomData() {
        try {
            // Load custom settlements
            const customSettlements = game.settings.get(MODULE_ID, 'customSettlements') || [];
            if (customSettlements.length > 0) {
                // Add custom settlements to the existing ones (avoid duplicates)
                customSettlements.forEach(settlement => {
                    const existingIndex = this.settlements.findIndex(s => s.name === settlement.name);
                    if (existingIndex >= 0) {
                        // Replace existing
                        this.settlements[existingIndex] = settlement;
                    } else {
                        // Add new
                        this.settlements.push(settlement);
                    }
                });
                console.log(`Trading Places | Loaded ${customSettlements.length} custom settlements`);
            }

            // Load custom cargo types
            const customCargoTypes = game.settings.get(MODULE_ID, 'customCargoTypes') || [];
            if (customCargoTypes.length > 0) {
                // Add custom cargo types to the existing ones (avoid duplicates)
                customCargoTypes.forEach(cargo => {
                    const existingIndex = this.cargoTypes.findIndex(c => c.name === cargo.name);
                    if (existingIndex >= 0) {
                        // Replace existing
                        this.cargoTypes[existingIndex] = cargo;
                    } else {
                        // Add new
                        this.cargoTypes.push(cargo);
                    }
                });
                console.log(`Trading Places | Loaded ${customCargoTypes.length} custom cargo types`);
            }
        } catch (error) {
            console.error('Trading Places | Failed to load custom data:', error);
        }
    }

    /**
     * Load user dataset from Foundry settings
     * @param {string} datasetName - Name of the user dataset
     * @returns {Promise<Object>} - Loaded dataset object
     */
    async loadUserDataset(datasetName) {
        try {
            if (!datasetName) {
                throw new Error('Dataset name is required');
            }

            const userDatasets = game.settings.get(MODULE_ID, 'userDatasets') || [];
            if (!userDatasets.includes(datasetName)) {
                throw new Error(`User dataset '${datasetName}' not found`);
            }

            const userDatasetsData = game.settings.get(MODULE_ID, 'userDatasetsData') || {};
            const datasetData = userDatasetsData[datasetName];

            if (!datasetData) {
                throw new Error(`User dataset '${datasetName}' data not found`);
            }

            // Validate the dataset structure
            const validation = this.validateDatasetCompleteness(datasetData);
            if (!validation.valid) {
                throw new Error(`User dataset validation failed: ${validation.errors.join(', ')}`);
            }

            // Load the data into memory
            this.settlements = datasetData.settlements || [];
            this.cargoTypes = datasetData.cargoTypes || [];
            this.config = datasetData.config || {};
            this.tradingConfig = datasetData.tradingConfig || {};
            this.sourceFlags = datasetData.sourceFlags || {};
            this.normalizedCurrencyConfig = null;
            this.currencyContextCache = null;

            // Ensure trading config has cargoSlots - load from built-in if missing
            if (!this.tradingConfig || !this.tradingConfig.cargoSlots) {
                console.log(`User dataset '${datasetName}' missing cargoSlots config, loading from built-in dataset`);
                try {
                    const builtInTradingConfig = await this.loadBuiltInTradingConfig();
                    this.tradingConfig = foundry.utils.deepClone(builtInTradingConfig);
                    // Update the stored dataset with the complete config
                    datasetData.tradingConfig = this.tradingConfig;
                    userDatasetsData[datasetName] = datasetData;
                    await game.settings.set(MODULE_ID, 'userDatasetsData', userDatasetsData);
                    console.log(`Updated user dataset '${datasetName}' with complete trading config`);
                } catch (error) {
                    console.warn('Failed to load built-in trading config for user dataset, using fallback:', error);
                    // Fallback trading config with essential cargoSlots
                    this.tradingConfig = {
                        cargoSlots: {
                            basePerSize: { "1": 1, "2": 2, "3": 3, "4": 4, "5": 5 },
                            populationMultiplier: 0.0001,
                            sizeMultiplier: 1.5,
                            flagMultipliers: { "trade": 1.5 },
                            hardCap: 10
                        }
                    };
                }
            }

            console.log(`Loaded user dataset '${datasetName}' with ${this.settlements.length} settlements and ${this.cargoTypes.length} cargo types`);
            return datasetData;
        } catch (error) {
            console.error(`Failed to load user dataset '${datasetName}':`, error);
            throw error;
        }
    }

    async loadFile(path) {
        if (typeof fetch === 'undefined') {
            throw new Error('loadFile requires a browser environment with fetch support');
        }

        const response = await fetch(path, { cache: 'no-store' });
        if (!response.ok) {
            throw new Error(`Failed to load file: ${path} (${response.status} ${response.statusText})`);
        }

        return await response.json();
    }

    getCargoTypes() {
        return Array.isArray(this.cargoTypes) ? [...this.cargoTypes] : [];
    }

    /**
     * Get settlement by name
     * @param {string} name - Settlement name
     * @returns {Object|null} - Settlement object or null if not found
     */
    getSettlement(name) {
        if (!name || typeof name !== 'string') {
            return null;
        }

        const logger = this.getLogger();
        const settlement = this.settlements.find(settlement =>
            settlement.name.toLowerCase() === name.toLowerCase()
        ) || null;
        
        logger.logSystem('Data Access', `Settlement lookup: ${name}`, {
            searchName: name,
            found: !!settlement,
            settlementName: settlement?.name,
            settlementRegion: settlement?.region
        });

        return settlement;
    }

    /**
     * Get settlements by region
     * @param {string} region - Region name
     * @returns {Array} - Array of settlement objects
     */
    getSettlementsByRegion(region) {
        if (!region || typeof region !== 'string') {
            return [];
        }

        return this.settlements.filter(settlement =>
            settlement.region.toLowerCase() === region.toLowerCase()
        );
    }

    /**
     * Get settlements by size
     * @param {string} size - Size enumeration (CS/C/T/ST/V/F/M)
     * @returns {Array} - Array of settlement objects
     */
    getSettlementsBySize(size) {
        if (!size || typeof size !== 'string') {
            return [];
        }

        return this.settlements.filter(settlement =>
            settlement.size === size.toUpperCase()
        );
    }

    /**
     * Get settlements by production category
     * @param {string} category - Production category
     * @returns {Array} - Array of settlement objects
     */
    getSettlementsByProduction(category) {
        if (!category || typeof category !== 'string') {
            return [];
        }

        return this.settlements.filter(settlement =>
            settlement.source && Array.isArray(settlement.source) &&
            settlement.source.some(source =>
                source.toLowerCase() === category.toLowerCase()
            )
        );
    }

    /**
     * Get settlements by wealth rating
     * @param {number} wealthRating - Wealth rating (1-5)
     * @returns {Array} - Array of settlement objects
     */
    getSettlementsByWealth(wealthRating) {
        if (typeof wealthRating !== 'number' || wealthRating < 1 || wealthRating > 5) {
            return [];
        }

        return this.settlements.filter(settlement =>
            settlement.wealth === wealthRating
        );
    }

    /**
     * Search settlements by multiple criteria
     * @param {Object} criteria - Search criteria object
     * @param {string} criteria.region - Region filter (optional)
     * @param {string} criteria.size - Size filter (optional)
     * @param {number} criteria.wealth - Wealth filter (optional)
     * @param {string} criteria.production - Production category filter (optional)
     * @param {string} criteria.name - Name search (partial match, optional)
     * @returns {Array} - Array of matching settlement objects
     */
    searchSettlements(criteria = {}) {
        let results = [...this.settlements];

        // Filter by region
        if (criteria.region) {
            results = results.filter(settlement =>
                settlement.region.toLowerCase() === criteria.region.toLowerCase()
            );
        }

        // Filter by size
        if (criteria.size) {
            results = results.filter(settlement =>
                settlement.size === criteria.size.toUpperCase()
            );
        }

        // Filter by wealth
        if (criteria.wealth) {
            results = results.filter(settlement =>
                settlement.wealth === criteria.wealth
            );
        }

        // Filter by production category
        if (criteria.production) {
            results = results.filter(settlement =>
                settlement.source && Array.isArray(settlement.source) &&
                settlement.source.some(source =>
                    source.toLowerCase() === criteria.production.toLowerCase()
                )
            );
        }

        // Filter by name (partial match)
        if (criteria.name) {
            results = results.filter(settlement =>
                settlement.name.toLowerCase().includes(criteria.name.toLowerCase())
            );
        }

        return results;
    }

    /**
     * Implement dynamic category discovery from settlement source fields
     * @returns {Array} - Array of unique production categories
     */
    buildAvailableCategories() {
        const categories = new Set();

        this.settlements.forEach(settlement => {
            if (settlement.source && Array.isArray(settlement.source)) {
                settlement.source.forEach(source => {
                    categories.add(source);
                });
            }
        });

        return Array.from(categories).sort();
    }

    /**
     * Get all unique regions from settlements
     * @returns {Array} - Array of unique region names
     */
    getAvailableRegions() {
        const regions = new Set();

        this.settlements.forEach(settlement => {
            if (settlement.region) {
                regions.add(settlement.region);
            }
        });

        return Array.from(regions).sort();
    }

    /**
     * Get all unique sizes from settlements
     * @returns {Array} - Array of unique size enumerations
     */
    getAvailableSizes() {
        const sizes = new Set();

        this.settlements.forEach(settlement => {
            if (settlement.size) {
                sizes.add(settlement.size);
            }
        });

        return Array.from(sizes).sort();
    }

    /**
     * Get cargo type by name
     * @param {string} name - Cargo type name
     * @returns {Object|null} - Cargo type object or null if not found
     */
    getCargoType(name) {
        if (!name || typeof name !== 'string') {
            return null;
        }

        return this.cargoTypes.find(cargo =>
            cargo.name.toLowerCase() === name.toLowerCase()
        ) || null;
    }

    /**
     * Get cargo types by category
     * @param {string} category - Cargo category
     * @returns {Array} - Array of cargo type objects
     */
    getCargoTypesByCategory(category) {
        if (!category || typeof category !== 'string') {
            return [];
        }

        return this.cargoTypes.filter(cargo =>
            cargo.category.toLowerCase() === category.toLowerCase()
        );
    }

    /**
     * Get all available cargo categories
     * @returns {Array} - Array of unique cargo categories
     */
    getAvailableCargoCategories() {
        const categories = new Set();

        this.cargoTypes.forEach(cargo => {
            if (cargo.category) {
                categories.add(cargo.category);
            }
        });

        return Array.from(categories).sort();
    }

    /**
     * Get random cargo for season (for Trade settlements)
     * @param {string} season - Season name
     * @returns {Object|null} - Random cargo type object
     */
    getRandomCargoForSeason(season) {
        if (!season || !this.cargoTypes || this.cargoTypes.length === 0) {
            return null;
        }

        // Filter cargo types that have pricing for the season
        const availableCargo = this.cargoTypes.filter(cargo =>
            cargo.basePrices && cargo.basePrices.hasOwnProperty(season)
        );

        if (availableCargo.length === 0) {
            return null;
        }

        // Return random cargo type
        const randomIndex = Math.floor(Math.random() * availableCargo.length);
        return availableCargo[randomIndex];
    }

    /**
     * Get system configuration
     * @returns {Object} - System configuration object
     */
    getSystemConfig() {
        return this.config || {};
    }

    /**
     * Get currency configuration
     * @returns {Object} - Currency configuration object
     */
    getCurrencyConfig() {
        if (this.config?.currency) {
            return this.config.currency;
        }

        return {
            canonicalUnit: {
                name: 'Brass Penny',
                pluralName: 'Brass Pennies',
                abbreviation: 'BP',
                value: 1
            },
            denominations: [
                {
                    name: 'Gold Crown',
                    pluralName: 'Gold Crowns',
                    abbreviation: 'GC',
                    value: 240
                },
                {
                    name: 'Silver Shilling',
                    pluralName: 'Silver Shillings',
                    abbreviation: 'SS',
                    value: 12
                },
                {
                    name: 'Brass Penny',
                    pluralName: 'Brass Pennies',
                    abbreviation: 'BP',
                    value: 1
                }
            ],
            display: {
                order: ['GC', 'SS', 'BP'],
                includeZeroDenominations: false,
                separator: ' '
            }
        };
    }


    /**
     * Get inventory configuration
     * @returns {Object} - Inventory configuration object
     */
    getInventoryConfig() {
        return this.config?.inventory || {
            field: 'items',
            addMethod: 'createEmbeddedDocuments'
        };
    }

    /**
     * Get skills configuration
     * @returns {Object} - Skills configuration object
     */
    getSkillsConfig() {
        return this.config?.skills || {
            haggle: 'system.skills.haggle.total',
            gossip: 'system.skills.gossip.total'
        };
    }

    /**
     * Get talents configuration
     * @returns {Object} - Talents configuration object
     */
    getTalentsConfig() {
        return this.config?.talents || {};
    }

    /**
     * Get dataset config
     * @returns {Object} - Config object
     */
    getConfig() {
        return this.config || {};
    }

    /**
     * Get trading config
     * @returns {Object} - Trading config object
     */
    getTradingConfig() {
        return this.tradingConfig || {};
    }

    /**
     * Test data loading with error handling for missing data
     * @returns {Object} - Test results object
     */
    testDataLoading() {
        const results = {
            success: true,
            errors: [],
            warnings: [],
            stats: {
                settlements: this.settlements.length,
                cargoTypes: this.cargoTypes.length,
                regions: 0,
                categories: 0
            }
        };

        try {
            // Test settlements data
            if (!this.settlements || this.settlements.length === 0) {
                results.errors.push('No settlements data loaded');
                results.success = false;
            } else {
                results.stats.regions = this.getAvailableRegions().length;
                results.stats.categories = this.buildAvailableCategories().length;
            }

            // Test cargo types data
            if (!this.cargoTypes || this.cargoTypes.length === 0) {
                results.errors.push('No cargo types data loaded');
                results.success = false;
            }

            // Test configuration
            if (!this.config || Object.keys(this.config).length === 0) {
                results.errors.push('No configuration data loaded');
                results.success = false;
            }

            // Test specific lookups
            const testSettlement = this.getSettlement('Averheim');
            if (!testSettlement) {
                results.warnings.push('Test settlement "Averheim" not found');
            }

            const testCargo = this.getCargoType('Grain');
            if (!testCargo) {
                results.warnings.push('Test cargo type "Grain" not found');
            }

            // Test search functionality
            const tradeSettlements = this.getSettlementsByProduction('Trade');
            if (tradeSettlements.length === 0) {
                results.warnings.push('No Trade settlements found');
            }

        } catch (error) {
            results.errors.push(`Data loading test failed: ${error.message}`);
            results.success = false;
        }

        return results;
    }

    /**
     * Get current season from FoundryVTT settings
     * @returns {Promise<string|null>} - Current season or null if not set
     */
    async getCurrentSeason() {
        try {
            if (typeof game !== 'undefined' && game.settings) {
                const season = await game.settings.get(MODULE_ID, "currentSeason");
                this.currentSeason = season || null;
                return this.currentSeason;
            } else {
                // For testing outside FoundryVTT
                return this.currentSeason || null;
            }
        } catch (error) {
            console.error('Failed to get current season:', error);
            return null;
        }
    }

    /**
     * Set current season and persist to FoundryVTT settings
     * @param {string} season - Season name (spring, summer, autumn, winter)
     * @returns {Promise<boolean>} - Success status
     */
    async setCurrentSeason(season) {
        try {
            // Validate season
            const validSeasons = ['spring', 'summer', 'autumn', 'winter'];
            if (!validSeasons.includes(season)) {
                throw new Error(`Invalid season: ${season}. Must be one of: ${validSeasons.join(', ')}`);
            }

            const oldSeason = this.currentSeason;
            this.currentSeason = season;

            // Persist to FoundryVTT settings
            if (typeof game !== 'undefined' && game.settings) {
                await game.settings.set(MODULE_ID, "currentSeason", season);
            }

            // Notify season change
            this.notifySeasonChange(season, oldSeason);

            console.log(`Season changed from ${oldSeason || 'unset'} to ${season}`);
            return true;
        } catch (error) {
            console.error('Failed to set current season:', error);
            return false;
        }
    }

    /**
     * Reset current season to null
     * @returns {Promise<boolean>} - Success status
     */
    async resetSeason() {
        try {
            const oldSeason = this.currentSeason;
            this.currentSeason = null;

            // Clear from FoundryVTT settings
            if (typeof game !== 'undefined' && game.settings) {
                await game.settings.set(MODULE_ID, "currentSeason", null);
            }

            // Notify season change
            this.notifySeasonChange(null, oldSeason);

            console.log(`Season reset from ${oldSeason || 'unset'} to unset`);
            return true;
        } catch (error) {
            console.error('Failed to reset season:', error);
            return false;
        }
    }

    /**
     * Notify about season change and update prices
     * @param {string} newSeason - New season
     * @param {string|null} oldSeason - Previous season
     */
    notifySeasonChange(newSeason, oldSeason) {
        try {
            // Note: Season change notification handled by application, not here to avoid duplicates

            // Console notification for testing
            console.log(`Season change notification: ${oldSeason || 'unset'} → ${newSeason}`);

            // Trigger price updates (this would be used by UI components)
            this.updatePricingForSeason(newSeason);

            // Emit custom event for other modules to listen to
            if (typeof Hooks !== 'undefined') {
                Hooks.callAll(`${MODULE_ID}.seasonChanged`, {
                    newSeason: newSeason,
                    oldSeason: oldSeason,
                    timestamp: new Date().toISOString()
                });
            }
        } catch (error) {
            console.error('Failed to notify season change:', error);
        }
    }

    /**
     * Update pricing for current season
     * @param {string} season - Season to update pricing for
     */
    updatePricingForSeason(season) {
        try {
            if (!season) {
                console.warn('Cannot update pricing: no season specified');
                return;
            }

            // This method would trigger UI updates in a real FoundryVTT environment
            // For now, we just log the update
            console.log(`Pricing updated for season: ${season}`);

            // In a full implementation, this would:
            // 1. Update any cached price calculations
            // 2. Refresh open trading dialogs
            // 3. Update any displayed price information
        } catch (error) {
            console.error('Failed to update pricing for season:', error);
        }
    }

    /**
     * Validate season before trading operations
     * @returns {Promise<boolean>} - True if season is set and valid
     */
    async validateSeasonSet() {
        try {
            const currentSeason = await this.getCurrentSeason();

            if (!currentSeason) {
                // Prompt for season selection in FoundryVTT
                if (typeof ui !== 'undefined' && ui.notifications) {
                    ui.notifications.warn('Please set the current season before trading.');
                }

                console.warn('Season validation failed: no season set');
                return false;
            }

            const validSeasons = ['spring', 'summer', 'autumn', 'winter'];
            if (!validSeasons.includes(currentSeason)) {
                console.error(`Season validation failed: invalid season '${currentSeason}'`);
                return false;
            }

            return true;
        } catch (error) {
            console.error('Season validation error:', error);
            return false;
        }
    }

    /**
     * Get all valid seasons
     * @returns {Array} - Array of valid season names
     */
    getValidSeasons() {
        return ['spring', 'summer', 'autumn', 'winter'];
    }

    /**
     * Get season display name
     * @param {string} season - Season name
     * @returns {string} - Capitalized season name
     */
    getSeasonDisplayName(season) {
        if (!season || typeof season !== 'string') {
            return 'Unknown';
        }

        return season.charAt(0).toUpperCase() + season.slice(1);
    }

    /**
     * Get seasonal price modifiers for all cargo types
     * @param {string} season - Season name
     * @returns {Object} - Object mapping cargo names to seasonal prices
     */
    getSeasonalPrices(season) {
        const seasonalPrices = {};

        try {
            this.cargoTypes.forEach(cargo => {
                if (cargo.basePrices && cargo.basePrices.hasOwnProperty(season)) {
                    seasonalPrices[cargo.name] = {
                        basePrice: cargo.basePrices[season],
                        qualityTiers: cargo.qualityTiers || { average: 1.0 }
                    };
                }
            });
        } catch (error) {
            console.error('Failed to get seasonal prices:', error);
        }

        return seasonalPrices;
    }

    /**
     * Compare prices between seasons for a cargo type
     * @param {string} cargoName - Name of cargo type
     * @returns {Object} - Object with price comparison data
     */
    compareSeasonalPrices(cargoName) {
        const cargo = this.getCargoType(cargoName);
        if (!cargo || !cargo.basePrices) {
            return null;
        }

        const comparison = {
            cargoName: cargoName,
            prices: {},
            bestSeason: null,
            worstSeason: null,
            priceRange: 0
        };

        const seasons = this.getValidSeasons();
        let minPrice = Infinity;
        let maxPrice = -Infinity;

        seasons.forEach(season => {
            if (cargo.basePrices.hasOwnProperty(season)) {
                const price = cargo.basePrices[season];
                comparison.prices[season] = price;

                if (price < minPrice) {
                    minPrice = price;
                    comparison.bestSeason = season; // Best for buying (lowest price)
                }

                if (price > maxPrice) {
                    maxPrice = price;
                    comparison.worstSeason = season; // Worst for buying (highest price)
                }
            }
        });

        comparison.priceRange = maxPrice - minPrice;
        return comparison;
    }

    /**
     * Get recommended trading seasons for all cargo types
     * @returns {Object} - Object with buy/sell recommendations per cargo
     */
    getTradingRecommendations() {
        const recommendations = {};

        this.cargoTypes.forEach(cargo => {
            const comparison = this.compareSeasonalPrices(cargo.name);
            if (comparison) {
                recommendations[cargo.name] = {
                    bestBuySeason: comparison.bestSeason,
                    bestSellSeason: comparison.worstSeason,
                    priceVariation: comparison.priceRange,
                    profitPotential: ((comparison.prices[comparison.worstSeason] - comparison.prices[comparison.bestSeason]) / comparison.prices[comparison.bestSeason] * 100).toFixed(1) + '%'
                };
            }
        });

        return recommendations;
    }

    /**
     * Initialize season management system
     * @returns {Promise<boolean>} - Success status
     */
    async initializeSeasonManagement() {
        try {
            // Load current season from settings
            const currentSeason = await this.getCurrentSeason();

            if (!currentSeason) {
                console.log('No season set - trading operations will require season selection');
            } else {
                console.log(`Season management initialized: current season is ${currentSeason}`);
            }

            return true;
        } catch (error) {
            console.error('Failed to initialize season management:', error);
            return false;
        }
    }

    /**
     * Initialize merchant system data and configuration
     * @returns {Promise<boolean>} - Success status
     */
    async initializeMerchantSystem() {
        try {
            // Load merchant-related configuration if needed
            // This method is called during module initialization to ensure
            // merchant system components are properly set up
            
            console.log('Initializing merchant system...');
            
            // Ensure trading config is loaded (merchant config is part of trading config)
            if (!this.tradingConfig || Object.keys(this.tradingConfig).length === 0) {
                await this.loadTradingConfig();
            }
            
            // Validate that merchant-related config exists
            const merchantConfig = this.tradingConfig?.skillDistribution || this.tradingConfig?.merchantConfig;
            if (!merchantConfig) {
                console.warn('Merchant system configuration not found in trading config');
                // This is not necessarily an error - merchant system can work with defaults
            } else {
                console.log('Merchant system configuration loaded successfully');
            }
            
            return true;
        } catch (error) {
            console.error('Failed to initialize merchant system:', error);
            return false;
        }
    }

    /**
     * Settlement lookup and search methods
     */
    getAllSettlements() {
        return this.settlements || [];
    }

    getSettlement(name) {
        if (!this.settlements || this.settlements.length === 0) {
            return null;
        }

        return this.settlements.find(settlement =>
            settlement.name && settlement.name.toLowerCase() === name.toLowerCase()
        ) || null;
    }

    getSettlementsByRegion(region) {
        if (!this.settlements || this.settlements.length === 0) {
            return [];
        }

        return this.settlements.filter(settlement =>
            settlement.region && settlement.region.toLowerCase() === region.toLowerCase()
        );
    }

    getSettlementsBySize(size) {
        if (!this.settlements || this.settlements.length === 0) {
            return [];
        }

        return this.settlements.filter(settlement =>
            settlement.size && settlement.size === size
        );
    }

    getSettlementsByWealth(wealthRating) {
        if (!this.settlements || this.settlements.length === 0) {
            return [];
        }

        return this.settlements.filter(settlement =>
            settlement.wealth && settlement.wealth === wealthRating
        );
    }

    getSettlementsByProduction(category) {
        if (!this.settlements || this.settlements.length === 0) {
            return [];
        }

        return this.settlements.filter(settlement =>
            settlement.source && Array.isArray(settlement.source) &&
            settlement.source.includes(category)
        );
    }

    /**
     * Dynamic category discovery methods
     */
    buildAvailableCategories() {
        if (!this.settlements || this.settlements.length === 0) {
            return [];
        }

        const categories = new Set();

        this.settlements.forEach(settlement => {
            if (settlement.source && Array.isArray(settlement.source)) {
                settlement.source.forEach(category => {
                    categories.add(category);
                });
            }
        });

        return Array.from(categories).sort();
    }

    getAvailableRegions() {
        if (!this.settlements || this.settlements.length === 0) {
            return [];
        }

        const regions = new Set();

        this.settlements.forEach(settlement => {
            if (settlement.region) {
                regions.add(settlement.region);
            }
        });

        return Array.from(regions).sort();
    }

    getAvailableSizes() {
        if (!this.settlements || this.settlements.length === 0) {
            return [];
        }

        const sizes = new Set();

        this.settlements.forEach(settlement => {
            if (settlement.size) {
                sizes.add(settlement.size);
            }
        });

        return Array.from(sizes).sort();
    }

    /**
     * Cargo type management methods
     */
    getCargoType(name) {
        if (!this.cargoTypes || this.cargoTypes.length === 0) {
            return null;
        }

        return this.cargoTypes.find(cargo =>
            cargo.name && cargo.name.toLowerCase() === name.toLowerCase()
        ) || null;
    }

    getCargoTypesByCategory(category) {
        if (!this.cargoTypes || this.cargoTypes.length === 0) {
            return [];
        }

        return this.cargoTypes.filter(cargo =>
            cargo.category && cargo.category.toLowerCase() === category.toLowerCase()
        );
    }

    getAvailableCargoCategories() {
        if (!this.cargoTypes || this.cargoTypes.length === 0) {
            return [];
        }

        const categories = new Set();

        this.cargoTypes.forEach(cargo => {
            if (cargo.category) {
                categories.add(cargo.category);
            }
        });

        return Array.from(categories).sort();
    }

    getRandomCargoForSeason(season) {
        if (!this.cargoTypes || this.cargoTypes.length === 0) {
            return null;
        }

        // Filter cargo types that have pricing for the specified season
        const availableCargo = this.cargoTypes.filter(cargo => {
            // Check for new format (basePrices object)
            if (cargo.basePrices && cargo.basePrices.hasOwnProperty(season)) {
                return true;
            }
            // Check for legacy format (basePrice + seasonalModifiers)
            if (cargo.basePrice && cargo.seasonalModifiers && cargo.seasonalModifiers.hasOwnProperty(season)) {
                return true;
            }
            return false;
        });

        if (availableCargo.length === 0) {
            return null;
        }

        // Return random cargo type
        const randomIndex = Math.floor(Math.random() * availableCargo.length);
        return availableCargo[randomIndex];
    }

    /**
     * Configuration access methods
     */
    getSystemConfig() {
        return this.config || {};
    }

    getCurrencyConfig() {
        if (this.config?.currency) {
            return this.config.currency;
        }

        return {
            canonicalUnit: {
                name: 'Brass Penny',
                pluralName: 'Brass Pennies',
                abbreviation: 'BP',
                value: 1
            },
            denominations: [
                {
                    name: 'Gold Crown',
                    pluralName: 'Gold Crowns',
                    abbreviation: 'GC',
                    value: 240
                },
                {
                    name: 'Silver Shilling',
                    pluralName: 'Silver Shillings',
                    abbreviation: 'SS',
                    value: 12
                },
                {
                    name: 'Brass Penny',
                    pluralName: 'Brass Pennies',
                    abbreviation: 'BP',
                    value: 1
                }
            ],
            display: {
                order: ['GC', 'SS', 'BP'],
                includeZeroDenominations: false,
                separator: ' '
            }
        };
    }

    getNormalizedCurrencyConfig() {
        if (!CurrencyUtils) {
            throw new Error('Currency utilities are not available');
        }

        if (!this.normalizedCurrencyConfig) {
            const rawConfig = this.getCurrencyConfig();
            this.normalizedCurrencyConfig = CurrencyUtils.normalizeConfig(rawConfig);
            this.currencyContextCache = null;
        }

        return this.normalizedCurrencyConfig;
    }

    getCurrencyContext() {
        if (!CurrencyUtils) {
            throw new Error('CURRENCY UTILS NOT LOADED! window.TradingPlacesCurrencyUtils is undefined');
        }

        if (!this.currencyContextCache) {
            const config = this.getCurrencyConfig();
            console.log('🔧 Building currency context from config:', config);
            
            const normalized = this.getNormalizedCurrencyConfig();
            console.log('🔧 Normalized config:', normalized);
            
            const primaryDenomination = CurrencyUtils.getPrimaryDenomination(normalized);
            console.log('🔧 Primary denomination:', primaryDenomination);
            
            if (!primaryDenomination) {
                throw new Error('PRIMARY DENOMINATION IS NULL! Normalized config: ' + JSON.stringify(normalized));
            }
            
            const denominationKey = primaryDenomination?.abbreviation ||
                primaryDenomination?.name ||
                normalized.canonicalUnit.abbreviation ||
                normalized.canonicalUnit.name;
            
            console.log('🔧 Denomination key:', denominationKey);

            this.currencyContextCache = {
                config,
                normalized,
                primaryDenomination,
                denominationKey,
            };
            
            console.log('✅ Currency context built successfully:', this.currencyContextCache);
        }

        return this.currencyContextCache;
    }

    /**
     * Get inventory configuration
     * @returns {Object} - Inventory configuration object
     */
    getInventoryConfig() {
        return this.config?.inventory || {
            field: 'items',
            addMethod: 'createEmbeddedDocuments'
        };
    }

    /**
     * Get skills configuration
     * @returns {Object} - Skills configuration object
     */
    getSkillsConfig() {
        return this.config?.skills || {
            haggle: 'system.skills.haggle.total',
            gossip: 'system.skills.gossip.total'
        };
    }

    /**
     * Get talents configuration
     * @returns {Object} - Talents configuration object
     */
    getTalentsConfig() {
        return this.config?.talents || {};
    }

    /**
     * Get dataset config
     * @returns {Object} - Config object
     */
    getConfig() {
        return this.config || {};
    }

    /**
     * Get trading config
     * @returns {Object} - Trading config object
     */
    getTradingConfig() {
        return this.tradingConfig || {};
    }

    /**
     * Test data loading with error handling for missing data
     * @returns {Object} - Test results object
     */
    testDataLoading() {
        const results = {
            success: true,
            errors: [],
            warnings: [],
            stats: {
                settlements: this.settlements.length,
                cargoTypes: this.cargoTypes.length,
                regions: 0,
                categories: 0
            }
        };

        try {
            // Test settlements data
            if (!this.settlements || this.settlements.length === 0) {
                results.errors.push('No settlements data loaded');
                results.success = false;
            } else {
                results.stats.regions = this.getAvailableRegions().length;
                results.stats.categories = this.buildAvailableCategories().length;
            }

            // Test cargo types data
            if (!this.cargoTypes || this.cargoTypes.length === 0) {
                results.errors.push('No cargo types data loaded');
                results.success = false;
            }

            // Test configuration
            if (!this.config || Object.keys(this.config).length === 0) {
                results.errors.push('No configuration data loaded');
                results.success = false;
            }

            // Test specific lookups
            const testSettlement = this.getSettlement('Averheim');
            if (!testSettlement) {
                results.warnings.push('Test settlement "Averheim" not found');
            }

            const testCargo = this.getCargoType('Grain');
            if (!testCargo) {
                results.warnings.push('Test cargo type "Grain" not found');
            }

            // Test search functionality
            const tradeSettlements = this.getSettlementsByProduction('Trade');
            if (tradeSettlements.length === 0) {
                results.warnings.push('No Trade settlements found');
            }

        } catch (error) {
            results.errors.push(`Data loading test failed: ${error.message}`);
            results.success = false;
        }

        return results;
    }

    /**
     * Get current season from FoundryVTT settings
     * @returns {Promise<string|null>} - Current season or null if not set
     */
    async getCurrentSeason() {
        try {
            if (typeof game !== 'undefined' && game.settings) {
                const season = await game.settings.get(MODULE_ID, "currentSeason");
                this.currentSeason = season || null;
                return this.currentSeason;
            } else {
                // For testing outside FoundryVTT
                return this.currentSeason || null;
            }
        } catch (error) {
            console.error('Failed to get current season:', error);
            return null;
        }
    }

    /**
     * Set current season and persist to FoundryVTT settings
     * @param {string} season - Season name (spring, summer, autumn, winter)
     * @returns {Promise<boolean>} - Success status
     */
    async setCurrentSeason(season) {
        try {
            // Validate season
            const validSeasons = ['spring', 'summer', 'autumn', 'winter'];
            if (!validSeasons.includes(season)) {
                throw new Error(`Invalid season: ${season}. Must be one of: ${validSeasons.join(', ')}`);
            }

            const oldSeason = this.currentSeason;
            this.currentSeason = season;

            // Persist to FoundryVTT settings
            if (typeof game !== 'undefined' && game.settings) {
                await game.settings.set(MODULE_ID, "currentSeason", season);
            }

            // Notify season change
            this.notifySeasonChange(season, oldSeason);

            console.log(`Season changed from ${oldSeason || 'unset'} to ${season}`);
            return true;
        } catch (error) {
            console.error('Failed to set current season:', error);
            return false;
        }
    }

    /**
     * Reset current season to null
     * @returns {Promise<boolean>} - Success status
     */
    async resetSeason() {
        try {
            const oldSeason = this.currentSeason;
            this.currentSeason = null;

            // Clear from FoundryVTT settings
            if (typeof game !== 'undefined' && game.settings) {
                await game.settings.set(MODULE_ID, "currentSeason", null);
            }

            // Notify season change
            this.notifySeasonChange(null, oldSeason);

            console.log(`Season reset from ${oldSeason || 'unset'} to unset`);
            return true;
        } catch (error) {
            console.error('Failed to reset season:', error);
            return false;
        }
    }

    /**
     * Notify about season change and update prices
     * @param {string} newSeason - New season
     * @param {string|null} oldSeason - Previous season
     */
    notifySeasonChange(newSeason, oldSeason) {
        try {
            // Note: Season change notification handled by application, not here to avoid duplicates

            // Console notification for testing
            console.log(`Season change notification: ${oldSeason || 'unset'} → ${newSeason}`);

            // Trigger price updates (this would be used by UI components)
            this.updatePricingForSeason(newSeason);

            // Emit custom event for other modules to listen to
            if (typeof Hooks !== 'undefined') {
                Hooks.callAll(`${MODULE_ID}.seasonChanged`, {
                    newSeason: newSeason,
                    oldSeason: oldSeason,
                    timestamp: new Date().toISOString()
                });
            }
        } catch (error) {
            console.error('Failed to notify season change:', error);
        }
    }

    /**
     * Update pricing for current season
     * @param {string} season - Season to update pricing for
     */
    updatePricingForSeason(season) {
        try {
            if (!season) {
                console.warn('Cannot update pricing: no season specified');
                return;
            }

            // This method would trigger UI updates in a real FoundryVTT environment
            // For now, we just log the update
            console.log(`Pricing updated for season: ${season}`);

            // In a full implementation, this would:
            // 1. Update any cached price calculations
            // 2. Refresh open trading dialogs
            // 3. Update any displayed price information
        } catch (error) {
            console.error('Failed to update pricing for season:', error);
        }
    }

    /**
     * Validate season before trading operations
     * @returns {Promise<boolean>} - True if season is set and valid
     */
    async validateSeasonSet() {
        try {
            const currentSeason = await this.getCurrentSeason();

            if (!currentSeason) {
                // Prompt for season selection in FoundryVTT
                if (typeof ui !== 'undefined' && ui.notifications) {
                    ui.notifications.warn('Please set the current season before trading.');
                }

                console.warn('Season validation failed: no season set');
                return false;
            }

            const validSeasons = ['spring', 'summer', 'autumn', 'winter'];
            if (!validSeasons.includes(currentSeason)) {
                console.error(`Season validation failed: invalid season '${currentSeason}'`);
                return false;
            }

            return true;
        } catch (error) {
            console.error('Season validation error:', error);
            return false;
        }
    }

    /**
     * Get all valid seasons
     * @returns {Array} - Array of valid season names
     */
    getValidSeasons() {
        return ['spring', 'summer', 'autumn', 'winter'];
    }

    /**
     * Get season display name
     * @param {string} season - Season name
     * @returns {string} - Capitalized season name
     */
    getSeasonDisplayName(season) {
        if (!season || typeof season !== 'string') {
            return 'Unknown';
        }

        return season.charAt(0).toUpperCase() + season.slice(1);
    }

    /**
     * Get seasonal price modifiers for all cargo types
     * @param {string} season - Season name
     * @returns {Object} - Object mapping cargo names to seasonal prices
     */
    getSeasonalPrices(season) {
        const seasonalPrices = {};

        try {
            this.cargoTypes.forEach(cargo => {
                if (cargo.basePrices && cargo.basePrices.hasOwnProperty(season)) {
                    seasonalPrices[cargo.name] = {
                        basePrice: cargo.basePrices[season],
                        qualityTiers: cargo.qualityTiers || { average: 1.0 }
                    };
                }
            });
        } catch (error) {
            console.error('Failed to get seasonal prices:', error);
        }

        return seasonalPrices;
    }

    /**
     * Compare prices between seasons for a cargo type
     * @param {string} cargoName - Name of cargo type
     * @returns {Object} - Object with price comparison data
     */
    compareSeasonalPrices(cargoName) {
        const cargo = this.getCargoType(cargoName);
        if (!cargo || !cargo.basePrices) {
            return null;
        }

        const comparison = {
            cargoName: cargoName,
            prices: {},
            bestSeason: null,
            worstSeason: null,
            priceRange: 0
        };

        const seasons = this.getValidSeasons();
        let minPrice = Infinity;
        let maxPrice = -Infinity;

        seasons.forEach(season => {
            if (cargo.basePrices.hasOwnProperty(season)) {
                const price = cargo.basePrices[season];
                comparison.prices[season] = price;

                if (price < minPrice) {
                    minPrice = price;
                    comparison.bestSeason = season; // Best for buying (lowest price)
                }

                if (price > maxPrice) {
                    maxPrice = price;
                    comparison.worstSeason = season; // Worst for buying (highest price)
                }
            }
        });

        comparison.priceRange = maxPrice - minPrice;
        return comparison;
    }

    /**
     * Get recommended trading seasons for all cargo types
     * @returns {Object} - Object with buy/sell recommendations per cargo
     */
    getTradingRecommendations() {
        const recommendations = {};

        this.cargoTypes.forEach(cargo => {
            const comparison = this.compareSeasonalPrices(cargo.name);
            if (comparison) {
                recommendations[cargo.name] = {
                    bestBuySeason: comparison.bestSeason,
                    bestSellSeason: comparison.worstSeason,
                    priceVariation: comparison.priceRange,
                    profitPotential: ((comparison.prices[comparison.worstSeason] - comparison.prices[comparison.bestSeason]) / comparison.prices[comparison.bestSeason] * 100).toFixed(1) + '%'
                };
            }
        });

        return recommendations;
    }

    /**
     * Initialize season management system
     * @returns {Promise<boolean>} - Success status
     */
    async initializeSeasonManagement() {
        try {
            // Load current season from settings
            const currentSeason = await this.getCurrentSeason();

            if (!currentSeason) {
                console.log('No season set - trading operations will require season selection');
            } else {
                console.log(`Season management initialized: current season is ${currentSeason}`);
            }

            return true;
        } catch (error) {
            console.error('Failed to initialize season management:', error);
            return false;
        }
    }

    /**
     * Initialize merchant system data and configuration
     * @returns {Promise<boolean>} - Success status
     */
    async initializeMerchantSystem() {
        try {
            // Load merchant-related configuration if needed
            // This method is called during module initialization to ensure
            // merchant system components are properly set up
            
            console.log('Initializing merchant system...');
            
            // Ensure trading config is loaded (merchant config is part of trading config)
            if (!this.tradingConfig || Object.keys(this.tradingConfig).length === 0) {
                await this.loadTradingConfig();
            }
            
            // Validate that merchant-related config exists
            const merchantConfig = this.tradingConfig?.skillDistribution || this.tradingConfig?.merchantConfig;
            if (!merchantConfig) {
                console.warn('Merchant system configuration not found in trading config');
                // This is not necessarily an error - merchant system can work with defaults
            } else {
                console.log('Merchant system configuration loaded successfully');
            }
            
            return true;
        } catch (error) {
            console.error('Failed to initialize merchant system:', error);
            return false;
        }
    }

    /**
     * Calculate cargo slots for a settlement
     * @param {Object} settlement - Settlement object
     * @param {string} season - Current season (optional, for future use)
     * @returns {number} - Number of cargo slots available
     */
    calculateCargoSlots(settlement, season = null) {
        try {
            if (!settlement) {
                console.warn('Cannot calculate cargo slots: no settlement provided');
                return 0;
            }

            const props = this.getSettlementProperties(settlement);
            const config = this.tradingConfig?.cargoSlots;

            if (!config) {
                console.warn('Cannot calculate cargo slots: no cargo slots configuration found');
                return 0;
            }

            const flags = props.productionCategories || [];

            // Base slots by size
            const baseSlots = config.basePerSize?.[String(props.sizeNumeric)] ??
                            config.basePerSize?.[props.sizeNumeric] ??
                            Math.max(1, props.sizeNumeric || 1);

            let currentTotal = baseSlots;

            // Population contribution
            const populationContribution = (props.population || 0) * (config.populationMultiplier ?? 0);
            if (populationContribution > 0) {
                currentTotal += populationContribution;
            }

            // Size multiplier bonus
            const sizeContribution = (props.sizeNumeric || 0) * (config.sizeMultiplier ?? 0);
            if (sizeContribution > 0) {
                currentTotal += sizeContribution;
            }

            // Flag multipliers
            flags.forEach(flag => {
                const multiplier = config.flagMultipliers?.[flag.toLowerCase()];
                if (multiplier && multiplier !== 1) {
                    currentTotal *= multiplier;
                }
            });

            // Apply hard cap
            const hardCap = config.hardCap;
            if (typeof hardCap === 'number' && currentTotal > hardCap) {
                currentTotal = hardCap;
            }

            // Return final result (minimum 1)
            return Math.max(1, Math.round(currentTotal));

        } catch (error) {
            console.error('Error calculating cargo slots:', error);
            return 0;
        }
    }

    /**
     * Get settlement properties for cargo slot calculations
     * @param {Object} settlement - Settlement object
     * @returns {Object} - Settlement properties
     */
    /**
     * Get size rating from settlement size string
     * @param {string} size - Settlement size string
     * @returns {number} - Size rating (1-5)
     */
    getSizeRating(size) {
        if (!size || typeof size !== 'string') {
            return 1;
        }

        const sizeMap = {
            'hamlet': 1,
            'village': 2,
            'town': 3,
            'city': 4,
            'metropolis': 5
        };

        return sizeMap[size.toLowerCase()] || 1;
    }

    /**
     * Update dataset config
     * @param {Object} newConfig - New configuration object
     * @returns {Promise<boolean>} - Success flag
     */
    async updateConfig(newConfig) {
        try {
            // Validate the config structure
            if (!newConfig || typeof newConfig !== 'object') {
                throw new Error('Config must be a valid object');
            }

            // Validate required sections
            const requiredSections = ['currency', 'inventory'];
            for (const section of requiredSections) {
                if (!newConfig.hasOwnProperty(section)) {
                    throw new Error(`Config missing required section: ${section}`);
                }
            }

            // Validate currency config
            if (newConfig.currency) {
                const currency = newConfig.currency;
                
                // Validate canonical unit
                if (!currency.canonicalUnit || typeof currency.canonicalUnit !== 'object') {
                    throw new Error('Currency config missing canonicalUnit');
                }
                
                if (!currency.canonicalUnit.name || !currency.canonicalUnit.abbreviation) {
                    throw new Error('Canonical unit must have name and abbreviation');
                }
                
                // Ensure canonical unit value is always 1
                currency.canonicalUnit.value = 1;
                
                // Validate denominations
                if (!Array.isArray(currency.denominations)) {
                    throw new Error('Currency denominations must be an array');
                }
                
                // Check for duplicate abbreviations
                const abbrevs = currency.denominations.map(d => d.abbreviation);
                if (new Set(abbrevs).size !== abbrevs.length) {
                    throw new Error('Currency denomination abbreviations must be unique');
                }
                
                // Validate each denomination
                currency.denominations.forEach((denom, index) => {
                    if (!denom.name || !denom.abbreviation || typeof denom.value !== 'number') {
                        throw new Error(`Denomination ${index} missing required fields (name, abbreviation, value)`);
                    }
                });
                
                // Set fixed values
                currency.rounding = "nearest";
                currency.display = currency.display || {};
                currency.display.includeZeroDenominations = false;
                currency.display.separator = " ";
            }

            // Update the config in memory
            this.config = this._deepClone(newConfig);
            this.normalizedCurrencyConfig = null; // Clear cache
            this.currencyContextCache = null; // Clear cache

            // Persist to settings if this is a user dataset
            if (typeof game !== 'undefined' && game.settings) {
                const userDatasets = game.settings.get(MODULE_ID, 'userDatasets') || [];
                if (userDatasets.includes(this.activeDatasetName)) {
                    // Update user dataset config in settings
                    const userDatasetsData = game.settings.get(MODULE_ID, 'userDatasetsData') || {};
                    if (userDatasetsData[this.activeDatasetName]) {
                        userDatasetsData[this.activeDatasetName].config = this.config;
                        await game.settings.set(MODULE_ID, 'userDatasetsData', userDatasetsData);
                        console.log(`User dataset '${this.activeDatasetName}' config updated in settings`);
                    }
                } else {
                    // For built-in datasets, we could potentially save custom config
                    // but for now we'll just log that it's not persisted
                    console.log('Config updated in memory (built-in dataset - not persisted to disk)');
                }
            }

            console.log('Dataset config updated successfully');
            return true;
        } catch (error) {
            console.error('Failed to update config:', error);
            throw error;
        }
    }

    /**
     * Deep clone utility that works in both FoundryVTT and Node.js environments
     * @param {any} obj - Object to clone
     * @returns {any} - Deep cloned object
     */
    _deepClone(obj) {
        if (obj === null || typeof obj !== 'object') {
            return obj;
        }

        // Use FoundryVTT's deepClone if available
        if (typeof foundry !== 'undefined' && foundry.utils && foundry.utils.deepClone) {
            return foundry.utils.deepClone(obj);
        }

        // Fallback to JSON-based deep clone
        try {
            return JSON.parse(JSON.stringify(obj));
        } catch (error) {
            // If JSON serialization fails, return a shallow copy
            console.warn('Deep clone failed, using shallow copy:', error);
            return { ...obj };
        }
    }
}

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.TradingPlacesDataManager = DataManager;
    window.DataManager = DataManager;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = DataManager;
}

// ES module export
export { DataManager };