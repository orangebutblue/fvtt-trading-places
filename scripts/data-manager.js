/**
 * Trading Places Module - Data Manager
 * Centralized data access and management with validation
 */

/**
 * Data Manager class for handling settlement and cargo data
 */
class DataManager {
    constructor() {
        this.settlements = [];
        this.cargoTypes = [];
        this.masterResources = {};
        this.config = {};
        this.currentSeason = null;
        this.logger = null; // Will be set by integration
        this.moduleId = 'trading-places';
        this.activeDatasetName = 'active';
        this.dataPath = `modules/${this.moduleId}/datasets/${this.activeDatasetName}`;
        this.sourceFlags = {};
    }

    setModuleId(moduleId) {
        if (!moduleId) {
            return;
        }

        this.moduleId = moduleId;
        this.dataPath = `modules/${this.moduleId}/datasets/${this.activeDatasetName}`;
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
            // Check for required config sections
            const requiredConfigSections = ['currency', 'inventory'];
            requiredConfigSections.forEach(section => {
                if (!dataset.config.hasOwnProperty(section)) {
                    result.valid = false;
                    result.errors.push(`Config missing required section: ${section}`);
                }
            });

            // Validate currency config
            if (dataset.config.currency) {
                if (!dataset.config.currency.field || typeof dataset.config.currency.field !== 'string') {
                    result.valid = false;
                    result.errors.push('Config currency.field must be a non-empty string');
                }
            }

            // Validate inventory config
            if (dataset.config.inventory) {
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
    validateDatasetCompleteness(dataset) {
        const result = this.validateDatasetStructure(dataset);

        if (!result.valid) {
            result.diagnosticReport = this.generateDiagnosticReport(result.errors);
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

        // Required fields for cargo
        const requiredFields = ['name', 'category', 'basePrices', 'encumbrancePerUnit'];

        // Check for missing fields
        const missingFields = requiredFields.filter(field =>
            !cargo.hasOwnProperty(field) || cargo[field] === null || cargo[field] === undefined
        );

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

        // Validate basePrices structure
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
                        result.errors.push(`BasePrices.${season} must be a positive number`);
                    }
                });
            }
        }

        // Validate encumbrancePerUnit
        if (cargo.hasOwnProperty('encumbrancePerUnit')) {
            if (typeof cargo.encumbrancePerUnit !== 'number' || cargo.encumbrancePerUnit <= 0) {
                result.valid = false;
                result.errors.push('EncumbrancePerUnit must be a positive number');
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

        // Handle different data formats
        if (cargo.basePrices && cargo.basePrices.hasOwnProperty(season)) {
            // New format: direct seasonal prices
            basePrice = cargo.basePrices[season];
        } else if (cargo.basePrice && cargo.seasonalModifiers && cargo.seasonalModifiers.hasOwnProperty(season)) {
            // Legacy format: base price with seasonal modifiers
            basePrice = cargo.basePrice * cargo.seasonalModifiers[season];
        } else {
            throw new Error(`No price data for season: ${season}. Cargo must have either basePrices or basePrice+seasonalModifiers`);
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
     * @param {number} encumbrance - Encumbrance per unit
     * @param {Object} options - Optional parameters (qualityTiers, deteriorationRate, specialRules)
     * @returns {Object} - Standardized cargo object
     */
    createCargoData(name, category, seasonalPrices, encumbrance, options = {}) {
        const cargo = {
            name: name,
            category: category,
            basePrices: seasonalPrices,
            encumbrancePerUnit: encumbrance
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
     * Load active dataset from the datasets/active directory
     * @returns {Promise<Object>} - Loaded dataset object
     */
    async loadActiveDataset() {
        try {
            if (typeof fetch === 'undefined') {
                throw new Error('loadActiveDataset requires FoundryVTT environment');
            }

            this.activeDatasetName = 'active';
            this.dataPath = `modules/${this.moduleId}/datasets/${this.activeDatasetName}`;

            const [cargoResponse, configResponse] = await Promise.all([
                fetch(`${this.dataPath}/cargo-types.json`),
                fetch(`${this.dataPath}/config.json`)
            ]);

            const cargoData = await cargoResponse.json();
            const configData = await configResponse.json();

            const settlementFiles = [
                'Averland.json', 'Hochland.json', 'Middenland.json', 'Moot.json',
                'Nordland.json', 'Ostermark.json', 'Ostland.json', 'Reikland.json',
                'Stirland.json', 'Sudenland.json', 'Sylvania.json', 'Talabecland.json',
                'Wasteland.json', 'Wissenland.json'
            ];

            const settlementPromises = settlementFiles.map(file =>
                fetch(`${this.dataPath}/settlements/${file}`)
                    .then(response => response.json())
                    .catch(error => {
                        console.warn(`Failed to load settlement file ${file}:`, error);
                        return [];
                    })
            );

            const settlementDataArray = await Promise.all(settlementPromises);

            this.settlements = [];
            settlementDataArray.forEach(data => {
                if (Array.isArray(data)) {
                    this.settlements.push(...data);
                }
            });

            this.cargoTypes = cargoData.cargoTypes || [];
            this.config = configData;

            const dataset = {
                settlements: this.settlements,
                config: this.config
            };

            const validation = this.validateDatasetCompleteness(dataset);
            if (!validation.valid) {
                throw new Error(`Dataset validation failed: ${validation.errors.join(', ')}`);
            }

            console.log(`Loaded ${this.settlements.length} settlements and ${this.cargoTypes.length} cargo types`);
            return dataset;
        } catch (error) {
            console.error('Failed to load active dataset:', error);
            throw error;
        }
    }

    /**
     * Switch to a different dataset
     * @param {string} datasetName - Name of the dataset directory
     * @returns {Promise<Object>} - Loaded dataset object
     */
    async switchDataset(datasetName) {
        try {
            if (typeof fetch === 'undefined') {
                throw new Error('switchDataset requires FoundryVTT environment');
            }

            this.activeDatasetName = datasetName;
            this.dataPath = `modules/${this.moduleId}/datasets/${datasetName}`;

            const [cargoResponse, configResponse] = await Promise.all([
                fetch(`${this.dataPath}/cargo-types.json`),
                fetch(`${this.dataPath}/config.json`)
            ]);

            const cargoData = await cargoResponse.json();
            const configData = await configResponse.json();

            const settlementFiles = [
                'Averland.json', 'Hochland.json', 'Middenland.json', 'Moot.json',
                'Nordland.json', 'Ostermark.json', 'Ostland.json', 'Reikland.json',
                'Stirland.json', 'Sudenland.json', 'Sylvania.json', 'Talabecland.json',
                'Wasteland.json', 'Wissenland.json'
            ];

            const settlementPromises = settlementFiles.map(file =>
                fetch(`${this.dataPath}/settlements/${file}`)
                    .then(response => response.json())
                    .catch(error => {
                        console.warn(`Failed to load settlement file ${file}:`, error);
                        return [];
                    })
            );

            const settlementDataArray = await Promise.all(settlementPromises);

            this.settlements = [];
            settlementDataArray.forEach(data => {
                if (Array.isArray(data)) {
                    this.settlements.push(...data);
                }
            });

            this.cargoTypes = cargoData.cargoTypes || [];
            this.config = configData;

            const dataset = {
                settlements: this.settlements,
                config: this.config
            };

            const validation = this.validateDatasetCompleteness(dataset);
            if (!validation.valid) {
                throw new Error(`Dataset validation failed: ${validation.errors.join(', ')}`);
            }

            if (typeof game !== 'undefined' && game.settings) {
                await game.settings.set(this.moduleId, "activeDataset", datasetName);
            }

            console.log(`Switched to dataset '${datasetName}': ${this.settlements.length} settlements and ${this.cargoTypes.length} cargo types`);
            return dataset;
        } catch (error) {
            console.error(`Failed to switch to dataset '${datasetName}':`, error);
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
        return this.config?.currency || {};
    }

    /**
     * Get inventory configuration
     * @returns {Object} - Inventory configuration object
     */
    getInventoryConfig() {
        return this.config?.inventory || {};
    }

    /**
     * Get skills configuration
     * @returns {Object} - Skills configuration object
     */
    getSkillsConfig() {
        return this.config?.skills || {};
    }

    /**
     * Get talents configuration
     * @returns {Object} - Talents configuration object
     */
    getTalentsConfig() {
        return this.config?.talents || {};
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
                const season = await game.settings.get("trading-places", "currentSeason");
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
                await game.settings.set("trading-places", "currentSeason", season);
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
     * Notify about season change and update prices
     * @param {string} newSeason - New season
     * @param {string|null} oldSeason - Previous season
     */
    notifySeasonChange(newSeason, oldSeason) {
        try {
            // FoundryVTT notification
            if (typeof ui !== 'undefined' && ui.notifications) {
                ui.notifications.info(`Trading season changed to ${newSeason}. All prices updated.`);
            }

            // Console notification for testing
            console.log(`Season change notification: ${oldSeason || 'unset'} → ${newSeason}`);

            // Trigger price updates (this would be used by UI components)
            this.updatePricingForSeason(newSeason);

            // Emit custom event for other modules to listen to
            if (typeof Hooks !== 'undefined') {
                Hooks.callAll("trading-places.seasonChanged", {
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
     * Reset season (for testing purposes)
     * @returns {Promise<boolean>} - Success status
     */
    async resetSeason() {
        try {
            this.currentSeason = null;

            if (typeof game !== 'undefined' && game.settings) {
                await game.settings.set("trading-places", "currentSeason", null);
            }

            console.log('Season reset to unset state');
            return true;
        } catch (error) {
            console.error('Failed to reset season:', error);
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
     * Advanced search functionality
     */
    searchSettlements(criteria) {
        if (!this.settlements || this.settlements.length === 0) {
            return [];
        }

        return this.settlements.filter(settlement => {
            // Name search (partial match)
            if (criteria.name) {
                const nameMatch = settlement.name &&
                    settlement.name.toLowerCase().includes(criteria.name.toLowerCase());
                if (!nameMatch) return false;
            }

            // Region exact match
            if (criteria.region) {
                const regionMatch = settlement.region &&
                    settlement.region.toLowerCase() === criteria.region.toLowerCase();
                if (!regionMatch) return false;
            }

            // Size exact match
            if (criteria.size) {
                if (settlement.size !== criteria.size) return false;
            }

            // Wealth exact match
            if (criteria.wealth !== undefined) {
                if (settlement.wealth !== criteria.wealth) return false;
            }

            // Production category match
            if (criteria.production) {
                const productionMatch = settlement.source &&
                    Array.isArray(settlement.source) &&
                    settlement.source.includes(criteria.production);
                if (!productionMatch) return false;
            }

            // Population range
            if (criteria.minPopulation !== undefined) {
                if (!settlement.population || settlement.population < criteria.minPopulation) return false;
            }

            if (criteria.maxPopulation !== undefined) {
                if (!settlement.population || settlement.population > criteria.maxPopulation) return false;
            }

            return true;
        });
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
        return this.config?.currency || {
            field: 'system.money.gc',
            name: 'Gold Crowns',
            abbreviation: 'GC'
        };
    }

    getInventoryConfig() {
        return this.config?.inventory || {
            field: 'items',
            addMethod: 'createEmbeddedDocuments'
        };
    }

    getSkillsConfig() {
        return this.config?.skills || {
            haggle: 'system.skills.haggle.total',
            gossip: 'system.skills.gossip.total'
        };
    }

    getTalentsConfig() {
        return this.config?.talents || {
            dealmaker: 'system.talents.dealmaker'
        };
    }

    /**
     * Data loading and testing methods
     */
    testDataLoading() {
        const results = {
            success: true,
            errors: [],
            warnings: [],
            stats: {
                settlements: this.settlements ? this.settlements.length : 0,
                cargoTypes: this.cargoTypes ? this.cargoTypes.length : 0,
                regions: this.getAvailableRegions().length,
                categories: this.buildAvailableCategories().length
            }
        };

        // Test settlement data
        if (!this.settlements || this.settlements.length === 0) {
            results.errors.push('No settlement data loaded');
            results.success = false;
        }

        // Test cargo data
        if (!this.cargoTypes || this.cargoTypes.length === 0) {
            results.errors.push('No cargo type data loaded');
            results.success = false;
        }

        // Test configuration
        if (!this.config || Object.keys(this.config).length === 0) {
            results.warnings.push('No configuration data loaded');
        }

        // Validate a few sample settlements
        if (this.settlements && this.settlements.length > 0) {
            const sampleSize = Math.min(3, this.settlements.length);
            for (let i = 0; i < sampleSize; i++) {
                const validation = this.validateSettlement(this.settlements[i]);
                if (!validation.valid) {
                    results.errors.push(`Settlement ${i}: ${validation.errors.join(', ')}`);
                    results.success = false;
                }
            }
        }

        // Validate a few sample cargo types
        if (this.cargoTypes && this.cargoTypes.length > 0) {
            const sampleSize = Math.min(3, this.cargoTypes.length);
            for (let i = 0; i < sampleSize; i++) {
                const validation = this.validateCargo(this.cargoTypes[i]);
                if (!validation.valid) {
                    results.errors.push(`Cargo ${i}: ${validation.errors.join(', ')}`);
                    results.success = false;
                }
            }
        }

        return results;
    }

    /**
     * Dataset loading methods (for FoundryVTT integration)
     */

    /**
     * Orange-realism schema methods
     */

    /**
     * Get settlements by flags (orange-realism schema)
     * @param {string|Array} flags - Flag or array of flags to filter by
     * @returns {Array} - Settlements matching the flags
     */
    getSettlementsByFlags(flags) {
        const flagArray = Array.isArray(flags) ? flags : [flags];
        
        return this.settlements.filter(settlement => {
            if (!settlement.flags || !Array.isArray(settlement.flags)) {
                return false;
            }
            
            // Check if settlement has any of the specified flags
            return flagArray.some(flag => settlement.flags.includes(flag));
        });
    }

    /**
     * Get settlements that produce specific cargo types
     * @param {string|Array} cargoTypes - Cargo type or array of cargo types
     * @returns {Array} - Settlements that produce the specified cargo
     */
    getSettlementsByProduces(cargoTypes) {
        const cargoArray = Array.isArray(cargoTypes) ? cargoTypes : [cargoTypes];
        
        return this.settlements.filter(settlement => {
            if (!settlement.produces || !Array.isArray(settlement.produces)) {
                return false;
            }
            
            // Check if settlement produces any of the specified cargo types
            return cargoArray.some(cargo => settlement.produces.includes(cargo));
        });
    }

    /**
     * Get settlements that demand specific cargo types
     * @param {string|Array} cargoTypes - Cargo type or array of cargo types
     * @returns {Array} - Settlements that demand the specified cargo
     */
    getSettlementsByDemands(cargoTypes) {
        const cargoArray = Array.isArray(cargoTypes) ? cargoTypes : [cargoTypes];
        
        return this.settlements.filter(settlement => {
            if (!settlement.demands || !Array.isArray(settlement.demands)) {
                return false;
            }
            
            // Check if settlement demands any of the specified cargo types
            return cargoArray.some(cargo => settlement.demands.includes(cargo));
        });
    }

    /**
     * Get population-derived size for a settlement
     * @param {Object} settlement - Settlement object
     * @returns {number} - Size category (1-5) based on population
     */
    getPopulationDerivedSize(settlement) {
        if (!settlement.population || !this.config.populationThresholds) {
            return settlement.size || 1;
        }

        const population = settlement.population;
        const thresholds = this.config.populationThresholds;
        
        for (let size = 1; size <= 5; size++) {
            const threshold = thresholds[size.toString()];
            if (threshold && population >= threshold.min && population <= threshold.max) {
                return size;
            }
        }
        
        return settlement.size || 1;
    }

    /**
     * Get garrison information in normalized format
     * @param {Object} settlement - Settlement object
     * @returns {Object} - Normalized garrison data
     */
    getGarrisonData(settlement) {
        const garrison = { a: 0, b: 0, c: 0 };
        
        if (!settlement.garrison) {
            return garrison;
        }
        
        // Handle new object format
        if (typeof settlement.garrison === 'object' && !Array.isArray(settlement.garrison)) {
            return { ...garrison, ...settlement.garrison };
        }
        
        // Handle legacy array format
        if (Array.isArray(settlement.garrison)) {
            settlement.garrison.forEach(entry => {
                if (!entry || entry === '') return;
                
                // Parse formats like "50a/150c", "10a&40b/350c", "-/9c", "-17c"
                const cleanEntry = entry.replace(/\s+/g, '');
                const matches = cleanEntry.match(/(\d+)([abc])/g);
                
                if (matches) {
                    matches.forEach(match => {
                        const [, count, type] = match.match(/(\d+)([abc])/);
                        if (count && type && ['a', 'b', 'c'].includes(type)) {
                            garrison[type] = parseInt(count);
                        }
                    });
                }
            });
        }
        
        return garrison;
    }

    /**
     * Load trading configuration
     * @param {string} configPath - Path to trading config file
     */
    async loadTradingConfig(configPath = null) {
        try {
            const path = configPath || `${this.dataPath}/trading-config.json`;
            const logger = this.getLogger();
            
            logger.logSystem('DataManager', `Loading trading configuration from ${path}`);
            
            const configData = await this.loadFile(path);
            this.config = { ...this.config, ...configData };
            
            logger.logSystem('DataManager', `Trading configuration loaded: ${Object.keys(configData).length} sections`);
            
            return configData;
        } catch (error) {
            const logger = this.getLogger();
            logger.logSystem('DataManager', `Failed to load trading configuration: ${error.message}`);
            throw new Error(`Failed to load trading configuration: ${error.message}`);
        }
    }

    /**
     * Load source flags configuration
     * @param {string} flagsPath - Path to source flags file
     */
    async loadSourceFlags(flagsPath = null) {
        try {
            const path = flagsPath || `${this.dataPath}/../source-flags.json`;
            const logger = this.getLogger();
            
            logger.logSystem('DataManager', `Loading source flags from ${path}`);
            
            const flagsData = await this.loadFile(path);
            this.sourceFlags = flagsData;
            
            logger.logSystem('DataManager', `Source flags loaded: ${Object.keys(flagsData).length} flags`);
            
            return flagsData;
        } catch (error) {
            const logger = this.getLogger();
            logger.logSystem('DataManager', `Failed to load source flags: ${error.message}`);
            throw new Error(`Failed to load source flags: ${error.message}`);
        }
    }

    /**
     * Initialize merchant generator and equilibrium calculator
     */
    initializeMerchantSystem() {
        if (!this.config || !this.sourceFlags) {
            throw new Error('Trading config and source flags must be loaded before initializing merchant system');
        }

        const logger = this.getLogger();
        logger.logSystem('DataManager', 'Initializing merchant generation system');

        // Check for global classes (set by the imported modules)
        const EquilibriumCalculatorClass = window.EquilibriumCalculator || window.WFRPTradingEquilibriumCalculator;
        const MerchantGeneratorClass = window.MerchantGenerator || window.WFRPTradingMerchantGenerator;

        // Initialize equilibrium calculator
        if (EquilibriumCalculatorClass) {
            this.equilibriumCalculator = new EquilibriumCalculatorClass(this.config, this.sourceFlags);
            this.equilibriumCalculator.setLogger(logger);
            logger.logSystem('DataManager', 'EquilibriumCalculator initialized');
        } else {
            logger.logSystem('DataManager', 'WARNING: EquilibriumCalculator not available');
        }

        // Initialize merchant generator
        if (MerchantGeneratorClass) {
            this.merchantGenerator = new MerchantGeneratorClass(this, this.config);
            this.merchantGenerator.setLogger(logger);
            logger.logSystem('DataManager', 'MerchantGenerator initialized');
        } else {
            logger.logSystem('DataManager', 'WARNING: MerchantGenerator not available');
        }

        const hasCalculator = !!this.equilibriumCalculator;
        const hasGenerator = !!this.merchantGenerator;
        
        if (hasCalculator && hasGenerator) {
            logger.logSystem('DataManager', 'Merchant system fully initialized');
        } else {
            logger.logSystem('DataManager', `Merchant system partially initialized (Calculator: ${hasCalculator}, Generator: ${hasGenerator})`);
        }
    }

    /**
     * Generate merchants for a settlement and cargo type
     * @param {Object} settlement - Settlement object
     * @param {string} cargoType - Cargo type
     * @param {string} merchantType - 'producer' or 'seeker'
     * @param {string} season - Current season
     * @returns {Array} - Array of generated merchants
     */
    generateMerchants(settlement, cargoType, merchantType, season = 'spring') {
        if (!this.merchantGenerator || !this.equilibriumCalculator) {
            throw new Error('Merchant system not initialized. Call initializeMerchantSystem() first.');
        }

        const logger = this.getLogger();
        
        // Calculate equilibrium
        const cargoData = this.getCargoType(cargoType);
        const equilibrium = this.equilibriumCalculator.calculateEquilibrium(settlement, cargoType, {
            season,
            cargoData
        });

        // Check if trade should be blocked
        if (this.equilibriumCalculator.shouldBlockTrade(equilibrium)) {
            logger.logDecision('Merchant Generation', 'Trade blocked by equilibrium', {
                settlement: settlement.name,
                cargoType,
                equilibrium: equilibrium.state
            });
            return [];
        }

        // Calculate merchant slots
        const slotInfo = this.merchantGenerator.calculateMerchantSlots(settlement);
        const merchantCount = Math.max(1, Math.floor(slotInfo.totalSlots / 2)); // Distribute between producers/seekers

        // Generate merchants
        const merchants = [];
        for (let i = 0; i < merchantCount; i++) {
            const merchant = this.merchantGenerator.generateMerchant(settlement, cargoType, merchantType, equilibrium);
            merchants.push(merchant);
        }

        logger.logSystem('DataManager', `Generated ${merchants.length} ${merchantType}s for ${settlement.name}`, {
            cargoType,
            equilibrium: equilibrium.state,
            merchantCount
        });

        return merchants;
    }

    /**
     * Get supply/demand equilibrium for a settlement and cargo type
     * @param {Object} settlement - Settlement object
     * @param {string} cargoType - Cargo type name
     * @returns {Object} - Supply and demand values
     */
    calculateSupplyDemandEquilibrium(settlement, cargoType) {
        // Use new equilibrium calculator if available
        if (this.equilibriumCalculator) {
            const cargoData = this.getCargoType(cargoType);
            return this.equilibriumCalculator.calculateEquilibrium(settlement, cargoType, {
                season: 'spring', // TODO: Get current season from game state
                cargoData
            });
        }

        // Fallback to legacy calculation
        const equilibriumConfig = this.config.equilibrium || this.config.supplyDemand;
        if (!equilibriumConfig) {
            return { supply: 100, demand: 100 };
        }

        const baseline = equilibriumConfig.baseline;
        let supply = baseline.supply;
        let demand = baseline.demand;

        // Apply produces effects
        if (settlement.produces && settlement.produces.includes(cargoType)) {
            const shift = equilibriumConfig.producesShift || 0.5;
            const transfer = Math.floor(demand * shift);
            supply += transfer;
            demand -= transfer;
        }

        // Apply demands effects
        if (settlement.demands && settlement.demands.includes(cargoType)) {
            const shift = equilibriumConfig.demandsShift || 0.35;
            const transfer = Math.floor(supply * shift);
            demand += transfer;
            supply -= transfer;
        }

        // Apply flag effects if source flags are loaded
        if (this.sourceFlags && settlement.flags) {
            settlement.flags.forEach(flag => {
                const flagData = this.sourceFlags[flag];
                if (flagData) {
                    if (flagData.supplyTransfer) {
                        const transfer = Math.floor(demand * flagData.supplyTransfer);
                        supply += transfer;
                        demand -= transfer;
                    }
                    if (flagData.demandTransfer) {
                        const transfer = Math.floor(supply * flagData.demandTransfer);
                        demand += transfer;
                        supply -= transfer;
                    }
                }
            });
        }

        // Clamp values
        const clamp = equilibriumConfig.clamp;
        if (clamp) {
            supply = Math.max(clamp.min, Math.min(clamp.max, supply));
            demand = Math.max(clamp.min, Math.min(clamp.max, demand));
        }

        return { supply, demand };
    }

    /**
     * CRUD Operations for Data Management UI
     */
    
    /**
     * Load settlements data (alias for internal use)
     * @returns {Promise<Array>} - Array of settlements
     */
    async loadSettlements() {
        // Settlements are already loaded during initialization
        return this.settlements || [];
    }
    
    /**
     * Update a settlement in the dataset
     * @param {Object} settlement - Updated settlement object
     * @returns {Promise<boolean>} - Success status
     */
    async updateSettlement(settlement) {
        if (!settlement || !settlement.name) {
            throw new Error('Settlement must have a name');
        }
        
        const index = this.settlements.findIndex(s => s.name === settlement.name);
        if (index === -1) {
            throw new Error(`Settlement '${settlement.name}' not found`);
        }
        
        // Validate the settlement
        const validation = this.validateSettlement(settlement);
        if (!validation.valid) {
            throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
        }
        
        // Update the settlement
        this.settlements[index] = { ...settlement };
        
        // In a real implementation, this would save to files
        // For now, just log the change
        console.log(`Trading Places | Updated settlement: ${settlement.name}`);
        
        return true;
    }
    
    /**
     * Delete a settlement from the dataset
     * @param {string} settlementName - Name of settlement to delete
     * @returns {Promise<boolean>} - Success status
     */
    async deleteSettlement(settlementName) {
        if (!settlementName) {
            throw new Error('Settlement name is required');
        }
        
        const index = this.settlements.findIndex(s => s.name === settlementName);
        if (index === -1) {
            throw new Error(`Settlement '${settlementName}' not found`);
        }
        
        // Remove the settlement
        this.settlements.splice(index, 1);
        
        // In a real implementation, this would update files
        console.log(`Trading Places | Deleted settlement: ${settlementName}`);
        
        return true;
    }
    
    /**
     * Load cargo types data (alias for internal use)
     * @returns {Promise<Array>} - Array of cargo types
     */
    async loadCargoTypes() {
        if (Array.isArray(this.cargoTypes) && this.cargoTypes.length > 0) {
            return this.cargoTypes;
        }

        try {
            const path = `${this.dataPath}/cargo-types.json`;
            const cargoData = await this.loadFile(path);
            this.cargoTypes = cargoData.cargoTypes || [];
            return this.cargoTypes;
        } catch (error) {
            console.error('Trading Places | Failed to load cargo types:', error);
            throw error;
        }
    }
    
    /**
     * Update a cargo type in the dataset
     * @param {Object} cargoType - Updated cargo type object
     * @returns {Promise<boolean>} - Success status
     */
    async updateCargoType(cargoType) {
        if (!cargoType || !cargoType.name) {
            throw new Error('Cargo type must have a name');
        }
        
        const index = this.cargoTypes.findIndex(c => c.name === cargoType.name);
        if (index === -1) {
            throw new Error(`Cargo type '${cargoType.name}' not found`);
        }
        
        // Basic validation
        if (!cargoType.category || !cargoType.basePrice) {
            throw new Error('Cargo type must have category and basePrice');
        }
        
        // Update the cargo type
        this.cargoTypes[index] = { ...cargoType };
        
        // In a real implementation, this would save to files
        console.log(`Trading Places | Updated cargo type: ${cargoType.name}`);
        
        return true;
    }
    
    /**
     * Delete a cargo type from the dataset
     * @param {string} cargoName - Name of cargo type to delete
     * @returns {Promise<boolean>} - Success status
     */
    async deleteCargoType(cargoName) {
        if (!cargoName) {
            throw new Error('Cargo name is required');
        }
        
        const index = this.cargoTypes.findIndex(c => c.name === cargoName);
        if (index === -1) {
            throw new Error(`Cargo type '${cargoName}' not found`);
        }
        
        // Remove the cargo type
        this.cargoTypes.splice(index, 1);
        
        // In a real implementation, this would update files
        console.log(`Trading Places | Deleted cargo type: ${cargoName}`);
        
        return true;
    }
}

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.WFRPTradingDataManager = DataManager;
    window.DataManager = DataManager;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = DataManager;
}