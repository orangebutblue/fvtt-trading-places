/**
 * WFRP River Trading Module - Data Manager
 * Centralized data access and management with validation
 */

/**
 * Data Manager class for handling settlement and cargo data
 */
class DataManager {
    constructor() {
        this.settlements = [];
        this.cargoTypes = [];
        this.config = {};
        this.currentSeason = null;
    }

    /**
     * Validate a single settlement object
     * @param {Object} settlement - Settlement object to validate
     * @returns {Object} - Validation result with success flag and errors
     */
    validateSettlement(settlement) {
        const result = {
            valid: true,
            errors: []
        };

        // Check for required fields (9 core fields as per requirements)
        const requiredFields = [
            'region', 'name', 'size', 'ruler', 
            'population', 'wealth', 'source', 'garrison', 'notes'
        ];

        // Check for missing fields
        const missingFields = requiredFields.filter(field => 
            !settlement.hasOwnProperty(field) || settlement[field] === null || settlement[field] === undefined
        );

        if (missingFields.length > 0) {
            result.valid = false;
            result.errors.push(`Missing required fields: ${missingFields.join(', ')}`);
        }

        // Type validation for specific fields
        if (settlement.hasOwnProperty('population')) {
            if (typeof settlement.population !== 'number' || settlement.population < 0) {
                result.valid = false;
                result.errors.push('Population must be a positive number');
            }
        }

        if (settlement.hasOwnProperty('wealth')) {
            if (typeof settlement.wealth !== 'number' || settlement.wealth < 1 || settlement.wealth > 5) {
                result.valid = false;
                result.errors.push('Wealth must be a number between 1-5');
            }
        }

        if (settlement.hasOwnProperty('source')) {
            if (!Array.isArray(settlement.source)) {
                result.valid = false;
                result.errors.push('Source must be an array');
            } else if (settlement.source.length === 0) {
                result.valid = false;
                result.errors.push('Source array cannot be empty');
            }
        }

        // Validate size enumeration
        if (settlement.hasOwnProperty('size')) {
            const validSizes = ['CS', 'C', 'T', 'ST', 'V', 'F', 'M'];
            if (!validSizes.includes(settlement.size)) {
                result.valid = false;
                result.errors.push(`Size must be one of: ${validSizes.join(', ')}`);
            }
        }

        // Validate string fields are not empty
        const stringFields = ['region', 'name', 'ruler'];
        stringFields.forEach(field => {
            if (settlement.hasOwnProperty(field)) {
                if (typeof settlement[field] !== 'string' || settlement[field].trim() === '') {
                    result.valid = false;
                    result.errors.push(`${field} must be a non-empty string`);
                }
            }
        });

        // Validate garrison is an array
        if (settlement.hasOwnProperty('garrison')) {
            if (!Array.isArray(settlement.garrison)) {
                result.valid = false;
                result.errors.push('Garrison must be an array');
            }
        }

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
        report += '=' .repeat(50) + '\n\n';
        
        errors.forEach((error, index) => {
            report += `${index + 1}. ${error}\n`;
        });

        report += '\n' + '=' .repeat(50) + '\n';
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
        if (!cargo || !cargo.basePrices) {
            throw new Error('Invalid cargo object or missing basePrices');
        }

        const validSeasons = ['spring', 'summer', 'autumn', 'winter'];
        if (!validSeasons.includes(season)) {
            throw new Error(`Invalid season: ${season}. Must be one of: ${validSeasons.join(', ')}`);
        }

        if (!cargo.basePrices.hasOwnProperty(season)) {
            throw new Error(`No price data for season: ${season}`);
        }

        let basePrice = cargo.basePrices[season];

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
     * @param {string} sizeEnum - Size enumeration (CS/C/T/ST/V/F/M)
     * @returns {number} - Numeric size value (1-4)
     */
    convertSizeToNumeric(sizeEnum) {
        const sizeMapping = {
            'CS': 4, // City State (any size)
            'C': 4,  // City (10,000+)
            'T': 3,  // Town (1,000 - 10,000)
            'ST': 2, // Small Town (100 - 1,000)
            'V': 1,  // Village (1-100)
            'F': 2,  // Fort (any size)
            'M': 2   // Mine (any size)
        };

        if (!sizeMapping.hasOwnProperty(sizeEnum)) {
            throw new Error(`Invalid size enumeration: ${sizeEnum}. Valid values: ${Object.keys(sizeMapping).join(', ')}`);
        }

        return sizeMapping[sizeEnum];
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
     * Get size description from enumeration
     * @param {string} sizeEnum - Size enumeration
     * @returns {string} - Size description
     */
    getSizeDescription(sizeEnum) {
        const sizeDescriptions = {
            'CS': 'City State',
            'C': 'City',
            'T': 'Town',
            'ST': 'Small Town',
            'V': 'Village',
            'F': 'Fort',
            'M': 'Mine'
        };

        if (!sizeDescriptions.hasOwnProperty(sizeEnum)) {
            throw new Error(`Invalid size enumeration: ${sizeEnum}`);
        }

        return sizeDescriptions[sizeEnum];
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
            productionCategories: settlement.source,
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
        return !!(settlement && settlement.source && Array.isArray(settlement.source) && settlement.source.includes('Trade'));
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
            // In FoundryVTT environment, use fetch to load JSON files
            if (typeof fetch !== 'undefined') {
                const [settlementsResponse, cargoResponse, configResponse] = await Promise.all([
                    fetch('modules/trading-places/datasets/active/settlements.json'),
                    fetch('modules/trading-places/datasets/active/cargo-types.json'),
                    fetch('modules/trading-places/datasets/active/config.json')
                ]);

                const settlementsData = await settlementsResponse.json();
                const cargoData = await cargoResponse.json();
                const configData = await configResponse.json();

                // Store loaded data
                this.settlements = settlementsData.settlements || [];
                this.cargoTypes = cargoData.cargoTypes || [];
                this.config = configData;

                // Validate loaded dataset
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
            } else {
                throw new Error('loadActiveDataset requires FoundryVTT environment');
            }
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
            if (typeof fetch !== 'undefined') {
                const [settlementsResponse, cargoResponse, configResponse] = await Promise.all([
                    fetch(`modules/trading-places/datasets/${datasetName}/settlements.json`),
                    fetch(`modules/trading-places/datasets/${datasetName}/cargo-types.json`),
                    fetch(`modules/trading-places/datasets/${datasetName}/config.json`)
                ]);

                const settlementsData = await settlementsResponse.json();
                const cargoData = await cargoResponse.json();
                const configData = await configResponse.json();

                // Store loaded data
                this.settlements = settlementsData.settlements || [];
                this.cargoTypes = cargoData.cargoTypes || [];
                this.config = configData;

                // Validate loaded dataset
                const dataset = {
                    settlements: this.settlements,
                    config: this.config
                };

                const validation = this.validateDatasetCompleteness(dataset);
                if (!validation.valid) {
                    throw new Error(`Dataset validation failed: ${validation.errors.join(', ')}`);
                }

                // Update active dataset setting if in FoundryVTT
                if (typeof game !== 'undefined' && game.settings) {
                    await game.settings.set("wfrp-trading", "activeDataset", datasetName);
                }

                console.log(`Switched to dataset '${datasetName}': ${this.settlements.length} settlements and ${this.cargoTypes.length} cargo types`);
                return dataset;
            } else {
                throw new Error('switchDataset requires FoundryVTT environment');
            }
        } catch (error) {
            console.error(`Failed to switch to dataset '${datasetName}':`, error);
            throw error;
        }
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

        return this.settlements.find(settlement => 
            settlement.name.toLowerCase() === name.toLowerCase()
        ) || null;
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
                const season = await game.settings.get("wfrp-trading", "currentSeason");
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
                await game.settings.set("wfrp-trading", "currentSeason", season);
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
                Hooks.callAll("wfrp-trading.seasonChanged", {
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
                await game.settings.set("wfrp-trading", "currentSeason", null);
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
    async loadActiveDataset() {
        // This would be implemented to load from FoundryVTT's file system
        // For now, it's a placeholder that would be filled in during UI integration
        throw new Error('loadActiveDataset() not yet implemented - requires FoundryVTT integration');
    }

    async switchDataset(datasetName) {
        // This would be implemented to switch between different datasets
        throw new Error('switchDataset() not yet implemented - requires FoundryVTT integration');
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