console.log('Trading Places | Loading trading-engine.js');

/**
 * Trading Places Module - Trading Engine
 * Pure business logic implementation of WFRP trading algorithms
 */

/**
 * Trading Engine class implementing the complete WFRP trading algorithm
 * This class contains pure business logic with no FoundryVTT dependencies
 */
class TradingEngine {
    constructor(dataManager) {
        this.dataManager = dataManager;
        this.currentSeason = null;
        this.logger = null; // Will be set by integration
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
            logDiceRoll: () => {},
            logCalculation: () => {},
            logDecision: () => {},
            logAlgorithmStep: () => {},
            logSystem: () => {}
        };
    }

    /**
     * Set the current trading season
     * @param {string} season - Season name (spring, summer, autumn, winter)
     */
    setCurrentSeason(season) {
        const validSeasons = ['spring', 'summer', 'autumn', 'winter'];
        if (!validSeasons.includes(season)) {
            throw new Error(`Invalid season: ${season}. Must be one of: ${validSeasons.join(', ')}`);
        }
        
        const logger = this.getLogger();
        logger.logSystem('Season Change', `Trading season changed from ${this.currentSeason || 'none'} to ${season}`, {
            previousSeason: this.currentSeason,
            newSeason: season
        });
        
        this.currentSeason = season;
    }

    /**
     * Get the current trading season
     * @returns {string|null} - Current season or null if not set
     */
    getCurrentSeason() {
        return this.currentSeason;
    }

    /**
     * Validate that season is set before trading operations
     * @throws {Error} - If season is not set
     */
    validateSeasonSet() {
        if (!this.currentSeason) {
            throw new Error('Season must be set before trading operations. Call setCurrentSeason() first.');
        }
    }

    // ===== CARGO AVAILABILITY CHECKING ALGORITHM =====

    /**
     * Step 1: Calculate base cargo availability chance
     * Formula: (Size + Wealth) × 10%
     * @param {Object} settlement - Settlement object
     * @returns {number} - Availability percentage (0-100)
     */
    calculateAvailabilityChance(settlement) {
        if (!settlement) {
            throw new Error('Settlement object is required');
        }

        const logger = this.getLogger();
        const properties = this.dataManager.getSettlementProperties(settlement);
        const chance = (properties.sizeNumeric + properties.wealthRating) * 10;
        const cappedChance = Math.min(chance, 100);
        
        // Log the calculation step
        logger.logCalculation(
            'Availability Chance',
            '(Size + Wealth) × 10',
            {
                settlementName: settlement.name,
                settlementSize: settlement.size,
                sizeNumeric: properties.sizeNumeric,
                wealthRating: properties.wealthRating,
                rawChance: chance,
                cappedAt100: cappedChance !== chance
            },
            cappedChance,
            `${settlement.name} has ${cappedChance}% cargo availability chance`
        );
        
        return cappedChance;
    }

    /**
     * Step 1: Check cargo availability using dice roll
     * @param {Object} settlement - Settlement object
     * @param {Function} rollFunction - Function that returns 1d100 result (for testing)
     * @returns {Object} - Availability check result
     */
    async checkCargoAvailability(settlement, rollFunction = null) {
        const logger = this.getLogger();
        
        // Log algorithm step start
        logger.logAlgorithmStep(
            'WFRP Buying Algorithm',
            'Step 1',
            'Cargo Availability Check',
            { settlementName: settlement.name, settlementRegion: settlement.region },
            'Death on the Reik Companion - Buying Algorithm Step 1'
        );
        
        const chance = this.calculateAvailabilityChance(settlement);
        
        let roll, rollResult;
        
        if (rollFunction) {
            // Use provided roll function for testing
            roll = await rollFunction();
            rollResult = { total: roll, formula: "1d100", result: roll.toString() };
        } else {
            // Use FoundryVTT dice roller
            rollResult = await this.rollAvailability(chance);
            roll = rollResult.total;
        }
        
        const available = roll <= chance;
        
        // Log the dice roll
        logger.logDiceRoll(
            'Cargo Availability Check',
            'd100',
            [],
            roll,
            chance,
            available,
            available ? `${roll} ≤ ${chance}` : `${roll} > ${chance}`
        );

        const result = {
            available: available,
            chance: chance,
            roll: roll,
            rollResult: rollResult,
            settlement: settlement.name
        };
        
        // Log the decision outcome
        logger.logDecision(
            'Cargo Availability',
            available ? 'Cargo Available' : 'No Cargo Available',
            { roll, chance, settlement: settlement.name },
            ['Cargo Available', 'No Cargo Available'],
            `Roll of ${roll} ${available ? 'succeeded against' : 'failed against'} target of ${chance}`
        );

        return result;
    }

    /**
     * Step 2A: Determine available cargo types based on settlement production
     * @param {Object} settlement - Settlement object
     * @param {string} season - Current season
     * @returns {Array} - Array of available cargo type names
     */
    determineCargoTypes(settlement, season) {
        if (!settlement || !settlement.source || !Array.isArray(settlement.source)) {
            throw new Error('Settlement must have a valid source array');
        }

        this.validateSeasonSet();
        
        const availableCargo = [];
        const productionCategories = settlement.source;

        // Mapping from settlement production categories to cargo types
        const productionToCargoMapping = {
            'Agriculture': 'Grain',
            'Subsistence': 'Grain',
            'Cattle': 'Grain',
            'Goats': 'Grain',
            'Fishing': 'Grain',
            'Sheep': 'Wool',
            'Metal': 'Metal',
            'Fur': 'Luxuries',
            'Government': 'Armaments'
        };

        // Handle specific goods (non-Trade categories)
        const specificGoods = productionCategories.filter(category => category !== 'Trade');
        specificGoods.forEach(category => {
            // Check if we have a direct mapping for this production category
            if (productionToCargoMapping[category]) {
                const cargoName = productionToCargoMapping[category];
                if (!availableCargo.includes(cargoName)) {
                    availableCargo.push(cargoName);
                }
            } else {
                // Fallback: try to find cargo types that match this production category
                const matchingCargo = this.dataManager.cargoTypes.filter(cargo => 
                    cargo.category === category
                );
                
                matchingCargo.forEach(cargo => {
                    if (!availableCargo.includes(cargo.name)) {
                        availableCargo.push(cargo.name);
                    }
                });
            }
        });

        // Handle Trade settlements - they get random seasonal cargo
        if (productionCategories.includes('Trade')) {
            const tradeCargo = this.getRandomTradeCargoForSeason(season);
            if (tradeCargo && !availableCargo.includes(tradeCargo)) {
                availableCargo.push(tradeCargo);
            }
        }

        return availableCargo;
    }

    /**
     * Get random trade cargo for the current season
     * @param {string} season - Current season
     * @returns {string|null} - Random cargo type name or null if no trade cargo available
     */
    getRandomTradeCargoForSeason(season) {
        // For now, return null - trade cargo types need to be added to the dataset
        const tradeGoods = this.dataManager.cargoTypes.filter(cargo => 
            cargo.category === 'Trade'
        );
        
        if (tradeGoods.length > 0) {
            const randomIndex = Math.floor(Math.random() * tradeGoods.length);
            return tradeGoods[randomIndex].name;
        }
        
        return null;
    }

    /**
     * Step 2B: Calculate cargo size in Encumbrance Points
     * Formula: (Size + Wealth) × (1d100 rounded up to nearest 10) EP
     * Trade bonus: roll twice, use higher multiplier
     * @param {Object} settlement - Settlement object
     * @param {Function} rollFunction - Function that returns 1d100 result (for testing)
     * @returns {Object} - Cargo size calculation result
     */
    async calculateCargoSize(settlement, rollFunction = null) {
        if (!settlement) {
            throw new Error('Settlement object is required');
        }

        const properties = this.dataManager.getSettlementProperties(settlement);
        const baseMultiplier = properties.sizeNumeric + properties.wealthRating;
        
        let roll1, roll1Result, roll2, roll2Result;
        
        if (rollFunction) {
            // Use provided roll function for testing
            roll1 = await rollFunction();
            roll1Result = { total: roll1, formula: "1d100", result: roll1.toString() };
        } else {
            // Use FoundryVTT dice roller
            roll1Result = await this.rollCargoSize();
            roll1 = roll1Result.total;
        }
        
        let multiplier = Math.ceil(roll1 / 10) * 10; // Round up to nearest 10
        let tradeBonus = false;

        // Trade settlement bonus: roll twice, use higher
        if (this.dataManager.isTradeSettlement(settlement)) {
            if (rollFunction) {
                roll2 = await rollFunction();
                roll2Result = { total: roll2, formula: "1d100", result: roll2.toString() };
            } else {
                roll2Result = await this.rollCargoSize();
                roll2 = roll2Result.total;
            }
            
            const multiplier2 = Math.ceil(roll2 / 10) * 10;
            
            if (multiplier2 > multiplier) {
                multiplier = multiplier2;
            }
            tradeBonus = true;
        }

        const totalSize = baseMultiplier * multiplier;

        return {
            totalSize: totalSize,
            baseMultiplier: baseMultiplier,
            sizeMultiplier: multiplier,
            roll1: roll1,
            roll1Result: roll1Result,
            roll2: roll2 || null,
            roll2Result: roll2Result || null,
            tradeBonus: tradeBonus,
            settlement: settlement.name
        };
    }

    /**
     * Complete cargo availability check workflow
     * Combines Steps 1, 2A, and 2B into a single operation
     * @param {Object} settlement - Settlement object
     * @param {string} season - Current season
     * @param {Function} rollFunction - Function that returns 1d100 result (for testing)
     * @returns {Object} - Complete availability check result
     */
    async performCompleteAvailabilityCheck(settlement, season, rollFunction = null) {
        // Step 1: Check if cargo is available
        const availabilityResult = await this.checkCargoAvailability(settlement, rollFunction);
        
        if (!availabilityResult.available) {
            return {
                available: false,
                availabilityCheck: availabilityResult,
                cargoTypes: [],
                cargoSize: null
            };
        }

        // Step 2A: Determine cargo types
        const cargoTypes = this.determineCargoTypes(settlement, season);
        
        // Step 2B: Calculate cargo size
        const cargoSize = await this.calculateCargoSize(settlement, rollFunction);

        return {
            available: true,
            availabilityCheck: availabilityResult,
            cargoTypes: cargoTypes,
            cargoSize: cargoSize
        };
    }

    /**
     * Get detailed settlement information for availability calculations
     * @param {Object} settlement - Settlement object
     * @returns {Object} - Detailed settlement information
     */
    getSettlementInfo(settlement) {
        if (!settlement) {
            throw new Error('Settlement object is required');
        }

        const properties = this.dataManager.getSettlementProperties(settlement);
        const availabilityChance = this.calculateAvailabilityChance(settlement);
        const cargoSizeBase = properties.sizeNumeric + properties.wealthRating;
        const isTradeCenter = this.dataManager.isTradeSettlement(settlement);

        return {
            name: properties.name,
            region: properties.region,
            size: {
                enum: properties.sizeEnum,
                numeric: properties.sizeNumeric,
                description: properties.sizeDescription
            },
            wealth: {
                rating: properties.wealthRating,
                modifier: properties.wealthModifier,
                description: properties.wealthDescription
            },
            population: properties.population,
            productionCategories: properties.productionCategories,
            availabilityChance: availabilityChance,
            cargoSizeBase: cargoSizeBase,
            isTradeCenter: isTradeCenter,
            garrison: properties.garrison,
            ruler: properties.ruler,
            notes: properties.notes
        };
    }

    /**
     * Validate settlement for trading operations
     * @param {Object} settlement - Settlement object to validate
     * @returns {Object} - Validation result
     */
    validateSettlementForTrading(settlement) {
        if (!settlement) {
            return {
                valid: false,
                errors: ['Settlement object is required']
            };
        }

        const validation = this.dataManager.validateSettlement(settlement);
        if (!validation.valid) {
            return {
                valid: false,
                errors: validation.errors
            };
        }

        // Additional trading-specific validation
        const errors = [];
        
        if (!settlement.source || settlement.source.length === 0) {
            errors.push('Settlement must have at least one production category');
        }

        if (errors.length > 0) {
            return {
                valid: false,
                errors: errors
            };
        }

        return {
            valid: true,
            errors: []
        };
    }

    // ===== PURCHASE PRICE CALCULATION SYSTEM =====

    /**
     * Get cargo object by name
     * @param {string} cargoName - Name of the cargo type
     * @returns {Object} - Cargo object
     */
    getCargoByName(cargoName) {
        const cargo = this.dataManager.cargoTypes.find(c => c.name === cargoName);
        if (!cargo) {
            throw new Error(`Cargo type not found: ${cargoName}`);
        }
        return cargo;
    }

    /**
     * Calculate base price for cargo in current season
     * @param {string} cargoName - Name of the cargo type
     * @param {string} season - Season name (optional, uses current season if not provided)
     * @param {string} quality - Quality tier (optional, defaults to 'average')
     * @returns {number} - Base price per unit
     */
    calculateBasePrice(cargoName, season = null, quality = 'average') {
        const cargo = this.getCargoByName(cargoName);
        const currentSeason = season || this.getCurrentSeason();
        
        if (!currentSeason) {
            throw new Error('Season must be set or provided to calculate prices');
        }

        return this.dataManager.getSeasonalPrice(cargo, currentSeason, quality);
    }

    /**
     * Calculate purchase price with all modifiers
     * @param {string} cargoName - Name of the cargo type
     * @param {number} quantity - Quantity in Encumbrance Points
     * @param {Object} options - Purchase options
     * @param {boolean} options.isPartialPurchase - Whether this is a partial purchase (+10% penalty)
     * @param {Object} options.haggleResult - Result of haggle test (optional)
     * @param {string} options.quality - Quality tier for wine/brandy (optional)
     * @param {string} options.season - Season override (optional)
     * @returns {Object} - Detailed price calculation
     */
    calculatePurchasePrice(cargoName, quantity, options = {}) {
        if (!cargoName || typeof cargoName !== 'string') {
            throw new Error('Cargo name is required and must be a string');
        }

        if (!quantity || typeof quantity !== 'number' || quantity <= 0) {
            throw new Error('Quantity must be a positive number');
        }

        const cargo = this.getCargoByName(cargoName);
        const season = options.season || this.getCurrentSeason();
        const quality = options.quality || 'average';

        // Calculate base price per unit
        const basePricePerUnit = this.calculateBasePrice(cargoName, season, quality);
        let finalPricePerUnit = basePricePerUnit;

        // Track all price modifiers
        const modifiers = [];

        // Apply partial purchase penalty (+10%)
        if (options.isPartialPurchase) {
            const partialPenalty = basePricePerUnit * 0.1;
            finalPricePerUnit += partialPenalty;
            modifiers.push({
                type: 'partial_purchase',
                description: 'Partial purchase penalty (+10%)',
                amount: partialPenalty,
                percentage: 10
            });
        }

        // Apply haggle test results
        if (options.haggleResult) {
            const haggleModifier = this.applyHaggleResult(basePricePerUnit, options.haggleResult);
            finalPricePerUnit += haggleModifier.amount;
            modifiers.push(haggleModifier);
        }

        // Calculate total price
        const totalPrice = finalPricePerUnit * quantity;

        return {
            cargoName: cargoName,
            quantity: quantity,
            season: season,
            quality: quality,
            basePricePerUnit: basePricePerUnit,
            finalPricePerUnit: finalPricePerUnit,
            totalPrice: totalPrice,
            modifiers: modifiers,
            encumbrancePerUnit: cargo.encumbrancePerUnit
        };
    }

    /**
     * Apply haggle test result to price calculation
     * @param {number} basePrice - Base price per unit
     * @param {Object} haggleResult - Haggle test result
     * @param {boolean} haggleResult.success - Whether haggle was successful
     * @param {boolean} haggleResult.hasDealmakertTalent - Whether player has Dealmaker talent
     * @param {boolean} haggleResult.criticalSuccess - Whether it was a critical success (optional)
     * @returns {Object} - Price modifier object
     */
    applyHaggleResult(basePrice, haggleResult) {
        if (!haggleResult || typeof haggleResult.success !== 'boolean') {
            throw new Error('Invalid haggle result object');
        }

        let percentage = 0;
        let description = '';

        if (haggleResult.success) {
            // Successful haggle reduces price
            percentage = haggleResult.hasDealmakertTalent ? -20 : -10;
            description = haggleResult.hasDealmakertTalent 
                ? 'Successful haggle with Dealmaker (-20%)'
                : 'Successful haggle (-10%)';
        } else {
            // Failed haggle can optionally increase price (GM discretion)
            if (haggleResult.penalty) {
                percentage = 10;
                description = 'Failed haggle penalty (+10%)';
            } else {
                percentage = 0;
                description = 'Failed haggle (no penalty)';
            }
        }

        const amount = basePrice * (percentage / 100);

        return {
            type: 'haggle',
            description: description,
            amount: amount,
            percentage: percentage
        };
    }

    /**
     * Calculate wine/brandy quality tier pricing
     * @param {string} cargoName - Name of wine/brandy cargo
     * @param {string} quality - Quality tier (poor, average, good, excellent)
     * @param {string} season - Season for base pricing
     * @returns {Object} - Quality pricing information
     */
    calculateQualityTierPricing(cargoName, quality, season = null) {
        const cargo = this.getCargoByName(cargoName);
        const currentSeason = season || this.getCurrentSeason();

        if (!cargo.qualityTiers) {
            throw new Error(`Cargo ${cargoName} does not have quality tiers`);
        }

        if (!cargo.qualityTiers.hasOwnProperty(quality)) {
            const availableTiers = Object.keys(cargo.qualityTiers);
            throw new Error(`Invalid quality tier: ${quality}. Available tiers: ${availableTiers.join(', ')}`);
        }

        const baseSeasonalPrice = cargo.basePrices[currentSeason];
        const qualityMultiplier = cargo.qualityTiers[quality];
        const finalPrice = baseSeasonalPrice * qualityMultiplier;

        return {
            cargoName: cargoName,
            season: currentSeason,
            quality: quality,
            baseSeasonalPrice: baseSeasonalPrice,
            qualityMultiplier: qualityMultiplier,
            finalPrice: finalPrice,
            availableQualities: Object.keys(cargo.qualityTiers)
        };
    }

    /**
     * Get all available quality tiers for a cargo type
     * @param {string} cargoName - Name of the cargo type
     * @returns {Array} - Array of available quality tier names
     */
    getAvailableQualityTiers(cargoName) {
        const cargo = this.getCargoByName(cargoName);
        return cargo.qualityTiers ? Object.keys(cargo.qualityTiers) : ['average'];
    }

    /**
     * Check if cargo type supports quality tiers (wine/brandy)
     * @param {string} cargoName - Name of the cargo type
     * @returns {boolean} - True if cargo supports quality tiers
     */
    hasQualityTiers(cargoName) {
        const cargo = this.getCargoByName(cargoName);
        return !!(cargo.qualityTiers && Object.keys(cargo.qualityTiers).length > 0);
    }

    /**
     * Calculate price comparison across all seasons
     * @param {string} cargoName - Name of the cargo type
     * @param {string} quality - Quality tier (optional)
     * @returns {Object} - Price comparison across seasons
     */
    calculateSeasonalPriceComparison(cargoName, quality = 'average') {
        const cargo = this.getCargoByName(cargoName);
        const seasons = ['spring', 'summer', 'autumn', 'winter'];
        const prices = {};
        
        seasons.forEach(season => {
            prices[season] = this.dataManager.getSeasonalPrice(cargo, season, quality);
        });

        // Find best and worst seasons
        const sortedSeasons = seasons.sort((a, b) => prices[a] - prices[b]);
        const bestSeason = sortedSeasons[0]; // Lowest price (best for buying)
        const worstSeason = sortedSeasons[sortedSeasons.length - 1]; // Highest price

        return {
            cargoName: cargoName,
            quality: quality,
            prices: prices,
            bestBuyingSeason: bestSeason,
            worstBuyingSeason: worstSeason,
            priceRange: {
                min: prices[bestSeason],
                max: prices[worstSeason],
                difference: prices[worstSeason] - prices[bestSeason]
            }
        };
    }

    /**
     * Validate purchase transaction
     * @param {string} cargoName - Name of the cargo type
     * @param {number} quantity - Quantity to purchase
     * @param {number} availableQuantity - Available quantity at settlement
     * @param {Object} options - Purchase options
     * @returns {Object} - Validation result
     */
    validatePurchaseTransaction(cargoName, quantity, availableQuantity, options = {}) {
        const errors = [];

        // Validate cargo exists
        try {
            this.getCargoByName(cargoName);
        } catch (error) {
            errors.push(error.message);
        }

        // Validate quantity
        if (!quantity || typeof quantity !== 'number' || quantity <= 0) {
            errors.push('Quantity must be a positive number');
        }

        if (quantity > availableQuantity) {
            errors.push(`Requested quantity (${quantity}) exceeds available quantity (${availableQuantity})`);
        }

        // Validate quality tier if specified
        if (options.quality) {
            try {
                const availableQualities = this.getAvailableQualityTiers(cargoName);
                if (!availableQualities.includes(options.quality)) {
                    errors.push(`Invalid quality tier: ${options.quality}. Available: ${availableQualities.join(', ')}`);
                }
            } catch (error) {
                // Cargo validation already failed above
            }
        }

        // Validate season
        if (options.season) {
            const validSeasons = ['spring', 'summer', 'autumn', 'winter'];
            if (!validSeasons.includes(options.season)) {
                errors.push(`Invalid season: ${options.season}. Must be one of: ${validSeasons.join(', ')}`);
            }
        }

        return {
            valid: errors.length === 0,
            errors: errors
        };
    }

    // ===== SALE MECHANICS AND RESTRICTIONS =====

    /**
     * Step 1: Check sale eligibility (location and time restrictions)
     * @param {Object} cargo - Cargo object with purchase information
     * @param {Object} currentSettlement - Settlement where attempting to sell
     * @param {Object} purchaseData - Original purchase data
     * @param {number} currentTime - Current game time (optional, for time restrictions)
     * @returns {Object} - Sale eligibility result
     */
    checkSaleEligibility(cargo, currentSettlement, purchaseData, currentTime = null) {
        if (!cargo || !currentSettlement || !purchaseData) {
            throw new Error('Cargo, current settlement, and purchase data are required');
        }

        const errors = [];
        const warnings = [];

        // Location restriction: cannot sell where purchased
        if (purchaseData.settlementName === currentSettlement.name) {
            // Check if minimum time has passed (1 week)
            if (currentTime && purchaseData.purchaseTime) {
                const timeElapsed = currentTime - purchaseData.purchaseTime;
                const oneWeekInDays = 7; // Assuming time is in days
                
                if (timeElapsed < oneWeekInDays) {
                    errors.push(`Cannot sell in same settlement (${currentSettlement.name}) until 1 week has passed. Time remaining: ${oneWeekInDays - timeElapsed} days`);
                } else {
                    warnings.push(`Selling in same settlement after waiting period`);
                }
            } else {
                errors.push(`Cannot sell in same settlement where purchased (${currentSettlement.name})`);
            }
        }

        return {
            eligible: errors.length === 0,
            errors: errors,
            warnings: warnings
        };
    }

    /**
     * Step 2: Calculate buyer availability chance
     * Formula: Size × 10 (+30 if Trade settlement)
     * @param {Object} settlement - Settlement object
     * @param {string} cargoName - Name of cargo being sold
     * @returns {number} - Buyer availability percentage
     */
    calculateBuyerAvailabilityChance(settlement, cargoName) {
        if (!settlement) {
            throw new Error('Settlement object is required');
        }

        const properties = this.dataManager.getSettlementProperties(settlement);
        let chance = properties.sizeNumeric * 10;

        // Trade settlement bonus
        if (this.dataManager.isTradeSettlement(settlement)) {
            chance += 30;
        }

        // Village restrictions for non-Grain goods
        if (properties.sizeNumeric === 1) { // Village
            const cargo = this.getCargoByName(cargoName);
            if (cargo.category !== 'Bulk Goods' || cargoName !== 'Grain') {
                // Villages only buy Grain, except in Spring (1d10 EP of other goods)
                const currentSeason = this.getCurrentSeason();
                if (currentSeason !== 'spring') {
                    chance = 0; // No buyers for non-Grain in villages outside Spring
                } else {
                    chance = Math.min(chance, 10); // Limited to 1d10 EP in Spring
                }
            }
        }

        return Math.min(chance, 100); // Cap at 100%
    }

    /**
     * Step 2: Find buyer using dice roll
     * @param {Object} settlement - Settlement object
     * @param {string} cargoName - Name of cargo being sold
     * @param {Function} rollFunction - Function that returns 1d100 result (for testing)
     * @returns {Object} - Buyer availability result
     */
    async findBuyer(settlement, cargoName, rollFunction = null) {
        const chance = this.calculateBuyerAvailabilityChance(settlement, cargoName);
        
        if (chance === 0) {
            return {
                buyerFound: false,
                chance: 0,
                roll: null,
                rollResult: null,
                reason: 'No buyers available for this cargo type at this settlement',
                partialSaleOption: false
            };
        }

        let roll, rollResult;
        
        if (rollFunction) {
            // Use provided roll function for testing
            roll = rollFunction();
            rollResult = { total: roll, formula: "1d100", result: roll.toString() };
        } else {
            // Use FoundryVTT dice roller
            rollResult = await this.rollBuyerAvailability(chance);
            roll = rollResult.total;
        }
        
        const buyerFound = roll <= chance;

        if (buyerFound) {
            // Generate a random merchant for successful buyer encounters
            const merchant = await this.generateRandomMerchant(settlement, rollFunction);
            
            return {
                buyerFound: true,
                chance: chance,
                roll: roll,
                rollResult: rollResult,
                settlement: settlement.name,
                partialSaleOption: false, // Normal sale succeeded
                merchant: merchant
            };
        } else {
            return {
                buyerFound: false,
                chance: chance,
                roll: roll,
                rollResult: rollResult,
                settlement: settlement.name,
                partialSaleOption: true, // Can try to sell half and re-roll
                merchant: null
            };
        }
    }

    /**
     * Step 3: Calculate sale price with wealth-based modifiers
     * @param {string} cargoName - Name of the cargo type
     * @param {number} quantity - Quantity being sold
     * @param {Object} settlement - Settlement where selling
     * @param {Object} options - Sale options
     * @param {string} options.quality - Quality tier (optional)
     * @param {string} options.season - Season override (optional)
     * @param {Object} options.haggleResult - Haggle test result (optional)
     * @returns {Object} - Sale price calculation
     */
    calculateSalePrice(cargoName, quantity, settlement, options = {}) {
        if (!cargoName || !settlement) {
            throw new Error('Cargo name and settlement are required');
        }

        if (!quantity || typeof quantity !== 'number' || quantity <= 0) {
            throw new Error('Quantity must be a positive number');
        }

        const cargo = this.getCargoByName(cargoName);
        const season = options.season || this.getCurrentSeason();
        const quality = options.quality || 'average';

        // Calculate base price per unit
        const basePricePerUnit = this.calculateBasePrice(cargoName, season, quality);
        
        // Apply wealth-based price modifier
        const properties = this.dataManager.getSettlementProperties(settlement);
        const wealthModifier = properties.wealthModifier;
        let finalPricePerUnit = basePricePerUnit * wealthModifier;

        // Track all price modifiers
        const modifiers = [{
            type: 'wealth',
            description: `${properties.wealthDescription} settlement (${Math.round(wealthModifier * 100)}%)`,
            amount: basePricePerUnit * (wealthModifier - 1),
            percentage: Math.round((wealthModifier - 1) * 100)
        }];

        // Apply haggle test results (increases sale price if successful)
        if (options.haggleResult) {
            const haggleModifier = this.applySaleHaggleResult(basePricePerUnit, options.haggleResult);
            finalPricePerUnit += haggleModifier.amount;
            modifiers.push(haggleModifier);
        }

        // Calculate total price
        const totalPrice = finalPricePerUnit * quantity;

        return {
            cargoName: cargoName,
            quantity: quantity,
            season: season,
            quality: quality,
            settlement: settlement.name,
            basePricePerUnit: basePricePerUnit,
            finalPricePerUnit: finalPricePerUnit,
            totalPrice: totalPrice,
            modifiers: modifiers,
            wealthModifier: wealthModifier
        };
    }

    /**
     * Apply haggle test result to sale price calculation
     * @param {number} basePrice - Base price per unit
     * @param {Object} haggleResult - Haggle test result
     * @returns {Object} - Price modifier object
     */
    applySaleHaggleResult(basePrice, haggleResult) {
        if (!haggleResult || typeof haggleResult.success !== 'boolean') {
            throw new Error('Invalid haggle result object');
        }

        let percentage = 0;
        let description = '';

        if (haggleResult.success) {
            // Successful haggle increases sale price
            percentage = haggleResult.hasDealmakertTalent ? 20 : 10;
            description = haggleResult.hasDealmakertTalent 
                ? 'Successful haggle with Dealmaker (+20%)'
                : 'Successful haggle (+10%)';
        } else {
            // Failed haggle has no effect on sale price
            percentage = 0;
            description = 'Failed haggle (no effect)';
        }

        const amount = basePrice * (percentage / 100);

        return {
            type: 'haggle',
            description: description,
            amount: amount,
            percentage: percentage
        };
    }

    /**
     * Check village restrictions for cargo sales
     * @param {Object} settlement - Settlement object
     * @param {string} cargoName - Name of cargo being sold
     * @param {string} season - Current season
     * @returns {Object} - Village restriction check result
     */
    checkVillageRestrictions(settlement, cargoName, season = null) {
        const properties = this.dataManager.getSettlementProperties(settlement);
        const currentSeason = season || this.getCurrentSeason();
        
        if (properties.sizeNumeric !== 1) {
            // Not a village, no restrictions
            return {
                restricted: false,
                reason: null,
                allowedQuantity: null
            };
        }

        const cargo = this.getCargoByName(cargoName);
        
        // Villages only buy Grain normally
        if (cargo.category === 'Bulk Goods' && cargoName === 'Grain') {
            return {
                restricted: false,
                reason: null,
                allowedQuantity: null
            };
        }

        // Non-Grain goods in villages
        if (currentSeason === 'spring') {
            // In Spring, villages buy up to 1d10 EP of other goods
            return {
                restricted: true,
                reason: 'Village only buys limited non-Grain goods in Spring',
                allowedQuantity: Math.floor(Math.random() * 10) + 1, // 1d10
                season: 'spring'
            };
        } else {
            // Outside Spring, villages don't buy non-Grain goods
            return {
                restricted: true,
                reason: `Villages don't buy ${cargoName} in ${currentSeason}`,
                allowedQuantity: 0
            };
        }
    }

    /**
     * Process partial sale option (sell half cargo and re-roll)
     * @param {string} cargoName - Name of the cargo type
     * @param {number} originalQuantity - Original quantity attempting to sell
     * @param {Object} settlement - Settlement object
     * @param {Object} options - Sale options
     * @param {Function} rollFunction - Function that returns 1d100 result (for testing)
     * @returns {Object} - Partial sale result
     */
    async processPartialSale(cargoName, originalQuantity, settlement, options = {}, rollFunction = null) {
        const halfQuantity = Math.floor(originalQuantity / 2);
        
        if (halfQuantity <= 0) {
            return {
                success: false,
                reason: 'Cannot sell partial quantity (less than 1 EP remaining)',
                quantitySold: 0,
                quantityRemaining: originalQuantity
            };
        }

        // Re-roll for buyer with half quantity
        const buyerResult = await this.findBuyer(settlement, cargoName, rollFunction);
        
        if (buyerResult.buyerFound) {
            const salePrice = this.calculateSalePrice(cargoName, halfQuantity, settlement, options);
            
            return {
                success: true,
                quantitySold: halfQuantity,
                quantityRemaining: originalQuantity - halfQuantity,
                salePrice: salePrice,
                buyerResult: buyerResult
            };
        } else {
            return {
                success: false,
                reason: 'No buyer found even for partial sale',
                quantitySold: 0,
                quantityRemaining: originalQuantity,
                buyerResult: buyerResult
            };
        }
    }

    /**
     * Complete sale workflow
     * @param {string} cargoName - Name of the cargo type
     * @param {number} quantity - Quantity to sell
     * @param {Object} settlement - Settlement where selling
     * @param {Object} purchaseData - Original purchase information
     * @param {Object} options - Sale options
     * @param {Function} rollFunction - Function that returns 1d100 result (for testing)
     * @returns {Object} - Complete sale result
     */
    async performCompleteSaleCheck(cargoName, quantity, settlement, purchaseData, options = {}, rollFunction = null) {
        // Step 1: Check sale eligibility
        const eligibilityCheck = this.checkSaleEligibility(
            { name: cargoName, quantity: quantity },
            settlement,
            purchaseData,
            options.currentTime
        );

        if (!eligibilityCheck.eligible) {
            return {
                success: false,
                step: 'eligibility',
                eligibilityCheck: eligibilityCheck,
                buyerResult: null,
                salePrice: null
            };
        }

        // Step 2: Check village restrictions
        const villageRestrictions = this.checkVillageRestrictions(settlement, cargoName, options.season);
        
        if (villageRestrictions.restricted && villageRestrictions.allowedQuantity === 0) {
            return {
                success: false,
                step: 'village_restrictions',
                eligibilityCheck: eligibilityCheck,
                villageRestrictions: villageRestrictions,
                buyerResult: null,
                salePrice: null
            };
        }

        // Adjust quantity for village restrictions
        const effectiveQuantity = villageRestrictions.restricted 
            ? Math.min(quantity, villageRestrictions.allowedQuantity)
            : quantity;

        // Step 3: Find buyer
        const buyerResult = await this.findBuyer(settlement, cargoName, rollFunction);
        
        if (!buyerResult.buyerFound) {
            return {
                success: false,
                step: 'buyer_availability',
                eligibilityCheck: eligibilityCheck,
                villageRestrictions: villageRestrictions,
                buyerResult: buyerResult,
                salePrice: null,
                partialSaleOption: buyerResult.partialSaleOption
            };
        }

        // Step 4: Calculate sale price
        const salePrice = this.calculateSalePrice(cargoName, effectiveQuantity, settlement, options);

        return {
            success: true,
            step: 'completed',
            eligibilityCheck: eligibilityCheck,
            villageRestrictions: villageRestrictions,
            buyerResult: buyerResult,
            salePrice: salePrice,
            quantitySold: effectiveQuantity,
            quantityRemaining: quantity - effectiveQuantity
        };
    }

    /**
     * Validate sale transaction
     * @param {string} cargoName - Name of the cargo type
     * @param {number} quantity - Quantity to sell
     * @param {Object} settlement - Settlement where selling
     * @param {Object} purchaseData - Original purchase data
     * @param {Object} options - Sale options
     * @returns {Object} - Validation result
     */
    validateSaleTransaction(cargoName, quantity, settlement, purchaseData, options = {}) {
        const errors = [];

        // Validate cargo exists
        try {
            this.getCargoByName(cargoName);
        } catch (error) {
            errors.push(error.message);
        }

        // Validate quantity
        if (!quantity || typeof quantity !== 'number' || quantity <= 0) {
            errors.push('Quantity must be a positive number');
        }

        // Validate settlement
        if (!settlement) {
            errors.push('Settlement object is required');
        } else {
            const settlementValidation = this.dataManager.validateSettlement(settlement);
            if (!settlementValidation.valid) {
                errors.push(`Invalid settlement: ${settlementValidation.errors.join(', ')}`);
            }
        }

        // Validate purchase data
        if (!purchaseData) {
            errors.push('Purchase data is required for sale validation');
        } else {
            if (!purchaseData.settlementName) {
                errors.push('Purchase data must include settlement name');
            }
        }

        // Validate season
        if (options.season) {
            const validSeasons = ['spring', 'summer', 'autumn', 'winter'];
            if (!validSeasons.includes(options.season)) {
                errors.push(`Invalid season: ${options.season}. Must be one of: ${validSeasons.join(', ')}`);
            }
        }

        return {
            valid: errors.length === 0,
            errors: errors
        };
    }

    // ===== SPECIAL SALE METHODS =====

    /**
     * Process desperate sale (50% base price at Trade settlements)
     * @param {string} cargoName - Name of the cargo type
     * @param {number} quantity - Quantity to sell
     * @param {Object} settlement - Settlement where selling (must be Trade settlement)
     * @param {Object} options - Sale options
     * @param {string} options.quality - Quality tier (optional)
     * @param {string} options.season - Season override (optional)
     * @returns {Object} - Desperate sale result
     */
    processDesperateSale(cargoName, quantity, settlement, options = {}) {
        if (!settlement) {
            throw new Error('Settlement object is required');
        }

        // Check if settlement is a Trade settlement
        if (!this.dataManager.isTradeSettlement(settlement)) {
            return {
                success: false,
                reason: 'Desperate sales are only available at Trade settlements',
                settlement: settlement.name,
                isTradeSettlement: false
            };
        }

        const cargo = this.getCargoByName(cargoName);
        const season = options.season || this.getCurrentSeason();
        const quality = options.quality || 'average';

        // Calculate base price per unit
        const basePricePerUnit = this.calculateBasePrice(cargoName, season, quality);
        
        // Desperate sale is 50% of base price (no wealth modifiers)
        const desperatePricePerUnit = basePricePerUnit * 0.5;
        const totalPrice = desperatePricePerUnit * quantity;

        return {
            success: true,
            cargoName: cargoName,
            quantity: quantity,
            season: season,
            quality: quality,
            settlement: settlement.name,
            basePricePerUnit: basePricePerUnit,
            desperatePricePerUnit: desperatePricePerUnit,
            totalPrice: totalPrice,
            saleType: 'desperate',
            modifier: {
                type: 'desperate_sale',
                description: 'Desperate sale at Trade settlement (50% base price)',
                percentage: -50
            }
        };
    }

    /**
     * Process rumor-based premium sale
     * @param {string} cargoName - Name of the cargo type
     * @param {number} quantity - Quantity to sell
     * @param {Object} settlement - Settlement where selling
     * @param {Object} rumorData - Rumor information
     * @param {string} rumorData.type - Type of rumor (shortage, demand, etc.)
     * @param {number} rumorData.multiplier - Price multiplier (e.g., 1.5 for 50% premium)
     * @param {string} rumorData.description - Description of the rumor
     * @param {Object} options - Sale options
     * @returns {Object} - Rumor sale result
     */
    processRumorSale(cargoName, quantity, settlement, rumorData, options = {}) {
        if (!rumorData || typeof rumorData.multiplier !== 'number') {
            throw new Error('Valid rumor data with multiplier is required');
        }

        if (rumorData.multiplier <= 0) {
            throw new Error('Rumor multiplier must be positive');
        }

        const cargo = this.getCargoByName(cargoName);
        const season = options.season || this.getCurrentSeason();
        const quality = options.quality || 'average';

        // Calculate base price with normal wealth modifiers
        const normalSalePrice = this.calculateSalePrice(cargoName, quantity, settlement, options);
        
        // Apply rumor multiplier to the final price (after wealth modifiers)
        const rumorPricePerUnit = normalSalePrice.finalPricePerUnit * rumorData.multiplier;
        const totalPrice = rumorPricePerUnit * quantity;

        // Calculate the premium amount
        const premiumAmount = rumorPricePerUnit - normalSalePrice.finalPricePerUnit;
        const premiumPercentage = Math.round((rumorData.multiplier - 1) * 100);

        return {
            success: true,
            cargoName: cargoName,
            quantity: quantity,
            season: season,
            quality: quality,
            settlement: settlement.name,
            normalPrice: normalSalePrice.finalPricePerUnit,
            rumorPricePerUnit: rumorPricePerUnit,
            totalPrice: totalPrice,
            saleType: 'rumor',
            rumor: {
                type: rumorData.type,
                description: rumorData.description,
                multiplier: rumorData.multiplier,
                premiumAmount: premiumAmount,
                premiumPercentage: premiumPercentage
            },
            baseModifiers: normalSalePrice.modifiers
        };
    }

    /**
     * Generate random rumor for cargo type and settlement
     * @param {string} cargoName - Name of the cargo type
     * @param {Object} settlement - Settlement object
     * @param {Function} rollFunction - Function that returns 1d100 result (for testing)
     * @returns {Object|null} - Generated rumor or null if no rumor
     */
    generateRandomRumor(cargoName, settlement, rollFunction = null) {
        // Use provided roll function or default to random
        const roll = rollFunction ? rollFunction() : Math.floor(Math.random() * 100) + 1;
        
        // 20% chance of rumor (roll 1-20)
        if (roll > 20) {
            return null;
        }

        const cargo = this.getCargoByName(cargoName);
        const rumorTypes = [
            {
                type: 'shortage',
                description: `Local shortage of ${cargoName} due to poor harvest`,
                multiplier: 1.5,
                weight: 30
            },
            {
                type: 'demand',
                description: `Increased demand for ${cargoName} from nearby settlements`,
                multiplier: 1.3,
                weight: 25
            },
            {
                type: 'festival',
                description: `Upcoming festival requires large quantities of ${cargoName}`,
                multiplier: 1.4,
                weight: 20
            },
            {
                type: 'trade_route',
                description: `New trade route opened, increasing ${cargoName} prices`,
                multiplier: 1.2,
                weight: 15
            },
            {
                type: 'noble_demand',
                description: `Local noble requires ${cargoName} for special occasion`,
                multiplier: 1.6,
                weight: 10
            }
        ];

        // Select rumor based on weighted probability
        const totalWeight = rumorTypes.reduce((sum, rumor) => sum + rumor.weight, 0);
        const rumorRoll = Math.floor(Math.random() * totalWeight) + 1;
        
        let currentWeight = 0;
        for (const rumor of rumorTypes) {
            currentWeight += rumor.weight;
            if (rumorRoll <= currentWeight) {
                return {
                    type: rumor.type,
                    description: rumor.description,
                    multiplier: rumor.multiplier,
                    settlement: settlement.name,
                    cargoName: cargoName
                };
            }
        }

        // Fallback (should not reach here)
        return rumorTypes[0];
    }

    /**
     * Check for available rumors at settlement
     * @param {string} cargoName - Name of the cargo type
     * @param {Object} settlement - Settlement object
     * @param {Function} rollFunction - Function that returns 1d100 result (for testing)
     * @returns {Object} - Rumor check result
     */
    checkForRumors(cargoName, settlement, rollFunction = null) {
        const rumor = this.generateRandomRumor(cargoName, settlement, rollFunction);
        
        return {
            hasRumor: rumor !== null,
            rumor: rumor,
            settlement: settlement.name,
            cargoName: cargoName
        };
    }

    /**
     * Process partial sale with re-roll option
     * Enhanced version with better error handling and options
     * @param {string} cargoName - Name of the cargo type
     * @param {number} originalQuantity - Original quantity attempting to sell
     * @param {Object} settlement - Settlement object
     * @param {Object} purchaseData - Original purchase data
     * @param {Object} options - Sale options
     * @param {Function} rollFunction - Function that returns 1d100 result (for testing)
     * @returns {Object} - Enhanced partial sale result
     */
    async processEnhancedPartialSale(cargoName, originalQuantity, settlement, purchaseData, options = {}, rollFunction = null) {
        const halfQuantity = Math.floor(originalQuantity / 2);
        
        if (halfQuantity <= 0) {
            return {
                success: false,
                reason: 'Cannot sell partial quantity (less than 1 EP remaining)',
                quantitySold: 0,
                quantityRemaining: originalQuantity,
                saleType: 'partial_failed'
            };
        }

        // Check eligibility for partial sale
        const eligibilityCheck = this.checkSaleEligibility(
            { name: cargoName, quantity: halfQuantity },
            settlement,
            purchaseData,
            options.currentTime
        );

        if (!eligibilityCheck.eligible) {
            return {
                success: false,
                reason: 'Partial sale not eligible due to restrictions',
                eligibilityCheck: eligibilityCheck,
                quantitySold: 0,
                quantityRemaining: originalQuantity,
                saleType: 'partial_failed'
            };
        }

        // Re-roll for buyer with half quantity
        const buyerResult = await this.findBuyer(settlement, cargoName, rollFunction);
        
        if (buyerResult.buyerFound) {
            const salePrice = this.calculateSalePrice(cargoName, halfQuantity, settlement, options);
            
            return {
                success: true,
                quantitySold: halfQuantity,
                quantityRemaining: originalQuantity - halfQuantity,
                salePrice: salePrice,
                buyerResult: buyerResult,
                eligibilityCheck: eligibilityCheck,
                saleType: 'partial_success'
            };
        } else {
            return {
                success: false,
                reason: 'No buyer found even for partial sale',
                quantitySold: 0,
                quantityRemaining: originalQuantity,
                buyerResult: buyerResult,
                saleType: 'partial_failed'
            };
        }
    }

    /**
     * Get all available sale options for cargo at settlement
     * @param {string} cargoName - Name of the cargo type
     * @param {number} quantity - Quantity to sell
     * @param {Object} settlement - Settlement where selling
     * @param {Object} purchaseData - Original purchase data
     * @param {Object} options - Additional options
     * @returns {Object} - Available sale options
     */
    getAvailableSaleOptions(cargoName, quantity, settlement, purchaseData, options = {}) {
        const saleOptions = {
            normal: false,
            desperate: false,
            partial: false,
            rumor: false,
            restrictions: []
        };

        // Check normal sale eligibility
        const normalEligibility = this.checkSaleEligibility(
            { name: cargoName, quantity: quantity },
            settlement,
            purchaseData,
            options.currentTime
        );

        if (normalEligibility.eligible) {
            saleOptions.normal = true;
        } else {
            saleOptions.restrictions = normalEligibility.errors;
        }

        // Check desperate sale option (Trade settlements only)
        if (this.dataManager.isTradeSettlement(settlement)) {
            saleOptions.desperate = true;
        }

        // Check partial sale option (if normal sale fails)
        if (!saleOptions.normal && quantity > 1) {
            saleOptions.partial = true;
        }

        // Check for rumors
        const rumorCheck = this.checkForRumors(cargoName, settlement);
        if (rumorCheck.hasRumor) {
            saleOptions.rumor = rumorCheck.rumor;
        }

        return {
            cargoName: cargoName,
            quantity: quantity,
            settlement: settlement.name,
            options: saleOptions,
            eligibilityCheck: normalEligibility
        };
    }

    /**
     * Execute special sale based on type
     * @param {string} saleType - Type of sale (desperate, rumor, partial)
     * @param {string} cargoName - Name of the cargo type
     * @param {number} quantity - Quantity to sell
     * @param {Object} settlement - Settlement object
     * @param {Object} purchaseData - Original purchase data
     * @param {Object} specialData - Special sale data (rumor info, etc.)
     * @param {Object} options - Sale options
     * @param {Function} rollFunction - Function for dice rolls (testing)
     * @returns {Object} - Special sale result
     */
    async executeSpecialSale(saleType, cargoName, quantity, settlement, purchaseData, specialData = {}, options = {}, rollFunction = null) {
        switch (saleType) {
            case 'desperate':
                return this.processDesperateSale(cargoName, quantity, settlement, options);
                
            case 'rumor':
                if (!specialData.rumor) {
                    throw new Error('Rumor data is required for rumor sales');
                }
                return this.processRumorSale(cargoName, quantity, settlement, specialData.rumor, options);
                
            case 'partial':
                return await this.processEnhancedPartialSale(cargoName, quantity, settlement, purchaseData, options, rollFunction);
                
            default:
                throw new Error(`Unknown sale type: ${saleType}`);
        }
    }

    /**
     * Calculate potential profit/loss for different sale options
     * @param {string} cargoName - Name of the cargo type
     * @param {number} quantity - Quantity to sell
     * @param {Object} settlement - Settlement where selling
     * @param {Object} purchaseData - Original purchase data with cost
     * @param {Object} options - Sale options
     * @returns {Object} - Profit analysis for different sale types
     */
    analyzeSaleProfitability(cargoName, quantity, settlement, purchaseData, options = {}) {
        if (!purchaseData.totalCost || typeof purchaseData.totalCost !== 'number') {
            throw new Error('Purchase data must include total cost for profit analysis');
        }

        const analysis = {
            cargoName: cargoName,
            quantity: quantity,
            originalCost: purchaseData.totalCost,
            costPerUnit: purchaseData.totalCost / quantity,
            saleOptions: {}
        };

        // Normal sale analysis
        try {
            const normalSale = this.calculateSalePrice(cargoName, quantity, settlement, options);
            analysis.saleOptions.normal = {
                totalRevenue: normalSale.totalPrice,
                profit: normalSale.totalPrice - purchaseData.totalCost,
                profitMargin: ((normalSale.totalPrice - purchaseData.totalCost) / purchaseData.totalCost) * 100,
                pricePerUnit: normalSale.finalPricePerUnit
            };
        } catch (error) {
            analysis.saleOptions.normal = { error: error.message };
        }

        // Desperate sale analysis
        if (this.dataManager.isTradeSettlement(settlement)) {
            try {
                const desperateSale = this.processDesperateSale(cargoName, quantity, settlement, options);
                if (desperateSale.success) {
                    analysis.saleOptions.desperate = {
                        totalRevenue: desperateSale.totalPrice,
                        profit: desperateSale.totalPrice - purchaseData.totalCost,
                        profitMargin: ((desperateSale.totalPrice - purchaseData.totalCost) / purchaseData.totalCost) * 100,
                        pricePerUnit: desperateSale.desperatePricePerUnit
                    };
                }
            } catch (error) {
                analysis.saleOptions.desperate = { error: error.message };
            }
        }

        // Rumor sale analysis (if rumor exists)
        const rumorCheck = this.checkForRumors(cargoName, settlement);
        if (rumorCheck.hasRumor) {
            try {
                const rumorSale = this.processRumorSale(cargoName, quantity, settlement, rumorCheck.rumor, options);
                if (rumorSale.success) {
                    analysis.saleOptions.rumor = {
                        totalRevenue: rumorSale.totalPrice,
                        profit: rumorSale.totalPrice - purchaseData.totalCost,
                        profitMargin: ((rumorSale.totalPrice - purchaseData.totalCost) / purchaseData.totalCost) * 100,
                        pricePerUnit: rumorSale.rumorPricePerUnit,
                        rumorType: rumorCheck.rumor.type,
                        premium: rumorSale.rumor.premiumPercentage
                    };
                }
            } catch (error) {
                analysis.saleOptions.rumor = { error: error.message };
            }
        }

        return analysis;
    }

    // ===== FOUNDRY VTT DICE INTEGRATION =====

    /**
     * Roll dice using FoundryVTT's Roll class
     * @param {string} formula - Dice formula (e.g., "1d100", "2d6+3")
     * @param {Object} options - Roll options
     * @param {string} options.flavor - Flavor text for the roll
     * @param {boolean} options.whisper - Whether to whisper the roll to GM only
     * @returns {Object} - Roll result object
     */
    async rollDice(formula, options = {}) {
        if (typeof Roll === 'undefined') {
            // Fallback for testing environment
            const result = Math.floor(Math.random() * 100) + 1;
            return {
                total: result,
                formula: formula,
                result: result.toString(),
                terms: [{ results: [{ result: result }] }]
            };
        }

        const roll = new Roll(formula);
        await roll.evaluate();

        // Post to chat if not in testing mode
        if (options.flavor) {
            const chatVisibility = game?.settings?.get("trading-places", "chatVisibility") || "gm";
            const shouldWhisper = options.whisper !== false && chatVisibility === "gm";
            
            await roll.toMessage({
                flavor: options.flavor,
                whisper: shouldWhisper && game?.user ? [game.user.id] : null
            });
        }

        return roll;
    }

    /**
     * Roll cargo availability check (1d100)
     * @param {number} chance - Target chance percentage
     * @returns {Object} - Roll result
     */
    async rollAvailability(chance) {
        return await this.rollDice("1d100", {
            flavor: `Cargo Availability Check (Target: ${chance}%)`,
            whisper: true
        });
    }

    /**
     * Roll cargo size determination (1d100)
     * @returns {Object} - Roll result
     */
    async rollCargoSize() {
        return await this.rollDice("1d100", {
            flavor: "Cargo Size Determination",
            whisper: true
        });
    }

    /**
     * Roll buyer availability check (1d100)
     * @param {number} chance - Target chance percentage
     * @returns {Object} - Roll result
     */
    async rollBuyerAvailability(chance) {
        return await this.rollDice("1d100", {
            flavor: `Buyer Availability Check (Target: ${chance}%)`,
            whisper: true
        });
    }

    /**
     * Post chat message with visibility controls
     * @param {string} content - Message content
     * @param {Object} options - Message options
     * @param {boolean} options.whisper - Whether to whisper to GM only
     * @param {string} options.type - Message type
     * @returns {Object} - Chat message object
     */
    async postChatMessage(content, options = {}) {
        if (typeof ChatMessage === 'undefined') {
            // Fallback for testing environment
            console.log('Chat Message:', content);
            return { content: content };
        }

        const chatVisibility = game?.settings?.get("wfrp-trading", "chatVisibility") || "gm";
        const shouldWhisper = options.whisper !== false && chatVisibility === "gm";

        return await ChatMessage.create({
            content: content,
            whisper: shouldWhisper && game?.user ? [game.user.id] : null,
            type: options.type || CONST.CHAT_MESSAGE_TYPES.OTHER
        });
    }

    /**
     * Generate formatted chat message for dice roll results
     * @param {Object} roll - Roll result object
     * @param {string} context - Context description
     * @param {Object} options - Formatting options
     * @returns {string} - Formatted HTML content
     */
    generateRollResultMessage(roll, context, options = {}) {
        const success = options.target ? (roll.total <= options.target) : null;
        const successText = success !== null ? (success ? "Success" : "Failure") : "";
        
        return `
        <div class="trading-roll">
            <h4>${context}</h4>
            <p><strong>Roll:</strong> ${roll.total} (${roll.formula})</p>
            ${options.target ? `<p><strong>Target:</strong> ${options.target}</p>` : ''}
            ${successText ? `<p><strong>Result:</strong> ${successText}</p>` : ''}
            ${options.details ? `<p><strong>Details:</strong> ${options.details}</p>` : ''}
        </div>`;
    }

    /**
     * Generate formatted chat message for transaction results
     * @param {Object} transaction - Transaction data
     * @returns {string} - Formatted HTML content
     */
    generateTransactionResultMessage(transaction) {
        const modifiersText = transaction.modifiers && transaction.modifiers.length > 0
            ? transaction.modifiers.map(mod => `${mod.description}: ${mod.percentage > 0 ? '+' : ''}${mod.percentage}%`).join('<br>')
            : 'No modifiers applied';

        return `
        <div class="trading-result">
            <h3>Trade ${transaction.type === 'purchase' ? 'Purchase' : 'Sale'} Completed</h3>
            <p><strong>Settlement:</strong> ${transaction.settlement}</p>
            <p><strong>Cargo:</strong> ${transaction.cargoName} (${transaction.quantity} EP)</p>
            <p><strong>Season:</strong> ${transaction.season}</p>
            ${transaction.quality && transaction.quality !== 'average' ? `<p><strong>Quality:</strong> ${transaction.quality}</p>` : ''}
            <p><strong>Base Price:</strong> ${transaction.basePricePerUnit} GC per EP</p>
            <p><strong>Final Price:</strong> ${transaction.finalPricePerUnit} GC per EP</p>
            <p><strong>Total Cost:</strong> ${transaction.totalPrice} GC</p>
            <p><strong>Price Modifiers:</strong><br>${modifiersText}</p>
        </div>`;
    }

    // ===== HAGGLING AND SKILL TEST MECHANICS =====

    /**
     * Perform comparative haggle test between player and merchant
     * @param {number} playerSkill - Player's haggle skill value
     * @param {number} merchantSkill - Merchant's haggle skill value (32-52 based on settlement)
     * @param {boolean} hasDealmakertTalent - Whether player has Dealmaker talent
     * @param {Object} options - Test options
     * @param {Function} rollFunction - Function for dice rolls (testing)
     * @returns {Object} - Haggle test result
     */
    async performHaggleTest(playerSkill, merchantSkill, hasDealmakertTalent = false, options = {}, rollFunction = null) {
        if (typeof playerSkill !== 'number' || playerSkill < 0 || playerSkill > 100) {
            throw new Error('Player skill must be a number between 0 and 100');
        }

        if (typeof merchantSkill !== 'number' || merchantSkill < 0 || merchantSkill > 100) {
            throw new Error('Merchant skill must be a number between 0 and 100');
        }

        let playerRoll, merchantRoll, playerRollResult, merchantRollResult;

        if (rollFunction) {
            // Use provided roll function for testing
            playerRoll = rollFunction();
            merchantRoll = rollFunction();
            playerRollResult = { total: playerRoll, formula: "1d100", result: playerRoll.toString() };
            merchantRollResult = { total: merchantRoll, formula: "1d100", result: merchantRoll.toString() };
        } else {
            // Use FoundryVTT dice roller
            playerRollResult = await this.rollDice("1d100", {
                flavor: `Player Haggle Test (Skill: ${playerSkill})`,
                whisper: true
            });
            merchantRollResult = await this.rollDice("1d100", {
                flavor: `Merchant Haggle Test (Skill: ${merchantSkill})`,
                whisper: true
            });
            playerRoll = playerRollResult.total;
            merchantRoll = merchantRollResult.total;
        }

        // Calculate success levels
        const playerSuccess = playerRoll <= playerSkill;
        const merchantSuccess = merchantRoll <= merchantSkill;

        // Calculate degrees of success/failure
        const playerDegrees = playerSuccess 
            ? Math.floor((playerSkill - playerRoll) / 10) + 1
            : Math.floor((playerRoll - playerSkill - 1) / 10) + 1;

        const merchantDegrees = merchantSuccess 
            ? Math.floor((merchantSkill - merchantRoll) / 10) + 1
            : Math.floor((merchantRoll - merchantSkill - 1) / 10) + 1;

        // Determine overall result
        let overallSuccess = false;
        let resultDescription = '';

        if (playerSuccess && !merchantSuccess) {
            // Player succeeds, merchant fails
            overallSuccess = true;
            resultDescription = 'Player wins - merchant failed their test';
        } else if (!playerSuccess && merchantSuccess) {
            // Player fails, merchant succeeds
            overallSuccess = false;
            resultDescription = 'Merchant wins - player failed their test';
        } else if (playerSuccess && merchantSuccess) {
            // Both succeed - compare degrees of success
            if (playerDegrees > merchantDegrees) {
                overallSuccess = true;
                resultDescription = `Player wins - ${playerDegrees} vs ${merchantDegrees} degrees of success`;
            } else if (merchantDegrees > playerDegrees) {
                overallSuccess = false;
                resultDescription = `Merchant wins - ${merchantDegrees} vs ${playerDegrees} degrees of success`;
            } else {
                // Tie - no change in price
                overallSuccess = false;
                resultDescription = 'Tie - no price change';
            }
        } else {
            // Both fail - compare degrees of failure (lower is better)
            if (playerDegrees < merchantDegrees) {
                overallSuccess = true;
                resultDescription = `Player wins - ${playerDegrees} vs ${merchantDegrees} degrees of failure`;
            } else if (merchantDegrees < playerDegrees) {
                overallSuccess = false;
                resultDescription = `Merchant wins - ${merchantDegrees} vs ${playerDegrees} degrees of failure`;
            } else {
                // Tie - no change in price
                overallSuccess = false;
                resultDescription = 'Tie - no price change';
            }
        }

        return {
            success: overallSuccess,
            hasDealmakertTalent: hasDealmakertTalent,
            player: {
                skill: playerSkill,
                roll: playerRoll,
                rollResult: playerRollResult,
                success: playerSuccess,
                degrees: playerDegrees
            },
            merchant: {
                skill: merchantSkill,
                roll: merchantRoll,
                rollResult: merchantRollResult,
                success: merchantSuccess,
                degrees: merchantDegrees
            },
            resultDescription: resultDescription,
            penalty: options.applyPenaltyOnFailure || false
        };
    }

    /**
     * Generate a random merchant for successful cargo availability
     * Uses a dice-based distribution to avoid extreme outliers
     * @param {Object} settlement - Settlement object
     * @param {Function} rollFunction - Function for dice rolls (testing)
     * @returns {Object} - Random merchant information
     */
    async generateRandomMerchant(settlement, rollFunction = null) {
        if (!settlement) {
            throw new Error('Settlement object is required');
        }

        let merchantSkill;

        if (rollFunction) {
            // Use provided roll function for testing
            // Simulate 2d20 + 40 distribution
            const roll1 = rollFunction() % 20 + 1;
            const roll2 = rollFunction() % 20 + 1;
            merchantSkill = roll1 + roll2 + 40;
        } else {
            // Use FoundryVTT dice roller: 2d20 + 40
            const rollResult = await this.rollDice("2d20+40", {
                flavor: "Random Merchant Generation",
                whisper: true
            });
            merchantSkill = rollResult.total;
        }

        // Ensure skill stays within bounds (21-120)
        merchantSkill = Math.max(21, Math.min(120, merchantSkill));

        // Generate merchant personality/description
        const personalities = [
            { name: "Shrewd Trader", description: "A sharp-eyed merchant who knows the value of every coin" },
            { name: "Jovial Merchant", description: "A friendly trader always ready with a story and a bargain" },
            { name: "Cautious Dealer", description: "A careful merchant who prefers safe, reliable transactions" },
            { name: "Ambitious Entrepreneur", description: "A driven trader always looking for the next big deal" },
            { name: "Seasoned Veteran", description: "An experienced merchant with years of trading wisdom" },
            { name: "Local Specialist", description: "A merchant with deep knowledge of local market conditions" },
            { name: "Foreign Trader", description: "A merchant from distant lands with exotic goods and stories" },
            { name: "Guild Representative", description: "A professional merchant backed by a powerful trading guild" }
        ];

        const personality = personalities[Math.floor(Math.random() * personalities.length)];

        return {
            skill: merchantSkill,
            name: personality.name,
            description: personality.description,
            settlement: settlement.name,
            skillDescription: this.getMerchantSkillDescription(merchantSkill)
        };
    }

    /**
     * Get descriptive text for merchant skill level
     * @param {number} skill - Merchant skill value (21-120)
     * @returns {string} - Skill level description
     */
    getMerchantSkillDescription(skill) {
        if (skill <= 35) return "Novice (easily out-haggled)";
        if (skill <= 50) return "Apprentice (basic bargaining skills)";
        if (skill <= 65) return "Competent (solid trading experience)";
        if (skill <= 80) return "Skilled (experienced negotiator)";
        if (skill <= 95) return "Expert (master of the trade)";
        if (skill <= 110) return "Master (legendary trader)";
        return "Legendary (unmatched in the marketplace)";
    }

    /**
     * Perform Gossip test for rumor discovery
     * @param {number} playerSkill - Player's Gossip skill value
     * @param {Object} options - Test options
     * @param {number} options.difficulty - Difficulty modifier (default: -10 for Difficult)
     * @param {Function} rollFunction - Function for dice rolls (testing)
     * @returns {Object} - Gossip test result
     */
    async performGossipTest(playerSkill, options = {}, rollFunction = null) {
        if (typeof playerSkill !== 'number' || playerSkill < 0 || playerSkill > 100) {
            throw new Error('Player skill must be a number between 0 and 100');
        }

        const difficulty = options.difficulty || -10; // Default: Difficult (-10)
        const modifiedSkill = Math.max(0, playerSkill + difficulty);

        let roll, rollResult;

        if (rollFunction) {
            // Use provided roll function for testing
            roll = rollFunction();
            rollResult = { total: roll, formula: "1d100", result: roll.toString() };
        } else {
            // Use FoundryVTT dice roller
            rollResult = await this.rollDice("1d100", {
                flavor: `Gossip Test (Modified Skill: ${modifiedSkill}, Difficulty: ${difficulty})`,
                whisper: true
            });
            roll = rollResult.total;
        }

        const success = roll <= modifiedSkill;
        const degrees = success 
            ? Math.floor((modifiedSkill - roll) / 10) + 1
            : Math.floor((roll - modifiedSkill) / 10) + 1;

        return {
            success: success,
            skill: playerSkill,
            modifiedSkill: modifiedSkill,
            difficulty: difficulty,
            roll: roll,
            rollResult: rollResult,
            degrees: degrees,
            resultDescription: success 
                ? `Success with ${degrees} degree${degrees > 1 ? 's' : ''}`
                : `Failure by ${degrees} degree${degrees > 1 ? 's' : ''}`
        };
    }

    /**
     * Generate rumor based on successful Gossip test
     * @param {Object} gossipResult - Result of Gossip test
     * @param {string} cargoName - Name of cargo type (optional)
     * @param {Object} settlement - Settlement object (optional)
     * @param {Function} rollFunction - Function for dice rolls (testing)
     * @returns {Object|null} - Generated rumor or null if test failed
     */
    async generateRumorFromGossip(gossipResult, cargoName = null, settlement = null, rollFunction = null) {
        if (!gossipResult.success) {
            return null;
        }

        // Better success = better rumors
        const rumorQuality = gossipResult.degrees;
        
        // If no specific cargo provided, generate random cargo
        if (!cargoName) {
            const availableCargo = this.dataManager.cargoTypes;
            const randomIndex = Math.floor(Math.random() * availableCargo.length);
            cargoName = availableCargo[randomIndex].name;
        }

        // Generate rumor based on quality
        const rumorTypes = [
            {
                type: 'shortage',
                description: `Heard rumors of ${cargoName} shortage in nearby settlements`,
                multiplier: 1.3 + (rumorQuality * 0.1),
                reliability: rumorQuality >= 2 ? 'reliable' : 'uncertain'
            },
            {
                type: 'demand',
                description: `Local merchant mentioned increased demand for ${cargoName}`,
                multiplier: 1.2 + (rumorQuality * 0.1),
                reliability: rumorQuality >= 2 ? 'reliable' : 'uncertain'
            },
            {
                type: 'festival',
                description: `Upcoming festival will require large quantities of ${cargoName}`,
                multiplier: 1.4 + (rumorQuality * 0.1),
                reliability: rumorQuality >= 3 ? 'reliable' : 'uncertain'
            },
            {
                type: 'noble_demand',
                description: `Noble house seeking premium ${cargoName} for special occasion`,
                multiplier: 1.5 + (rumorQuality * 0.15),
                reliability: rumorQuality >= 3 ? 'reliable' : 'uncertain'
            }
        ];

        // Select rumor type based on quality
        const availableRumors = rumorTypes.filter(rumor => {
            if (rumorQuality >= 3) return true; // All rumors available
            if (rumorQuality >= 2) return rumor.type !== 'noble_demand'; // No noble rumors
            return rumor.type === 'shortage' || rumor.type === 'demand'; // Only basic rumors
        });

        const selectedRumor = availableRumors[Math.floor(Math.random() * availableRumors.length)];

        return {
            type: selectedRumor.type,
            description: selectedRumor.description,
            multiplier: Math.min(selectedRumor.multiplier, 2.0), // Cap at 200%
            reliability: selectedRumor.reliability,
            cargoName: cargoName,
            settlement: settlement ? settlement.name : 'unknown location',
            gossipDegrees: rumorQuality,
            discoveredBy: 'gossip_test'
        };
    }

    /**
     * Calculate Dealmaker talent bonuses
     * @param {boolean} hasDealmakertTalent - Whether player has Dealmaker talent
     * @param {string} transactionType - Type of transaction ('purchase' or 'sale')
     * @returns {Object} - Dealmaker bonus information
     */
    calculateDealmakertBonus(hasDealmakertTalent, transactionType) {
        if (!hasDealmakertTalent) {
            return {
                hasBonus: false,
                bonusPercentage: 0,
                description: 'No Dealmaker talent'
            };
        }

        const bonusPercentage = 20; // Double the normal haggle bonus
        const description = transactionType === 'purchase' 
            ? 'Dealmaker talent: -20% purchase price'
            : 'Dealmaker talent: +20% sale price';

        return {
            hasBonus: true,
            bonusPercentage: bonusPercentage,
            description: description,
            transactionType: transactionType
        };
    }

    /**
     * Process skill test with modifiers and difficulty
     * @param {number} baseSkill - Base skill value
     * @param {Array} modifiers - Array of modifier objects
     * @param {string} testName - Name of the test for display
     * @param {Function} rollFunction - Function for dice rolls (testing)
     * @returns {Object} - Skill test result
     */
    async processSkillTest(baseSkill, modifiers = [], testName = 'Skill Test', rollFunction = null) {
        if (typeof baseSkill !== 'number' || baseSkill < 0 || baseSkill > 100) {
            throw new Error('Base skill must be a number between 0 and 100');
        }

        // Calculate modified skill
        let modifiedSkill = baseSkill;
        const appliedModifiers = [];

        modifiers.forEach(modifier => {
            modifiedSkill += modifier.value;
            appliedModifiers.push({
                name: modifier.name,
                value: modifier.value,
                description: modifier.description
            });
        });

        // Ensure skill stays within bounds
        modifiedSkill = Math.max(0, Math.min(100, modifiedSkill));

        let roll, rollResult;

        if (rollFunction) {
            // Use provided roll function for testing
            roll = rollFunction();
            rollResult = { total: roll, formula: "1d100", result: roll.toString() };
        } else {
            // Use FoundryVTT dice roller
            const modifierText = appliedModifiers.length > 0 
                ? ` (${appliedModifiers.map(m => `${m.name}: ${m.value > 0 ? '+' : ''}${m.value}`).join(', ')})`
                : '';
            
            rollResult = await this.rollDice("1d100", {
                flavor: `${testName} (Modified Skill: ${modifiedSkill})${modifierText}`,
                whisper: true
            });
            roll = rollResult.total;
        }

        const success = roll <= modifiedSkill;
        const degrees = success 
            ? Math.floor((modifiedSkill - roll) / 10) + 1
            : Math.floor((roll - modifiedSkill) / 10) + 1;

        return {
            testName: testName,
            success: success,
            baseSkill: baseSkill,
            modifiedSkill: modifiedSkill,
            roll: roll,
            rollResult: rollResult,
            degrees: degrees,
            modifiers: appliedModifiers,
            resultDescription: success 
                ? `${testName} Success (${degrees} degree${degrees > 1 ? 's' : ''})`
                : `${testName} Failure (${degrees} degree${degrees > 1 ? 's' : ''})`
        };
    }

    /**
     * Generate formatted chat message for skill test results
     * @param {Object} testResult - Skill test result
     * @returns {string} - Formatted HTML content
     */
    generateSkillTestMessage(testResult) {
        const modifiersText = testResult.modifiers && testResult.modifiers.length > 0
            ? testResult.modifiers.map(mod => `${mod.name}: ${mod.value > 0 ? '+' : ''}${mod.value}`).join('<br>')
            : 'No modifiers';

        const successClass = testResult.success ? 'success' : 'failure';

        return `
        <div class="skill-test-result ${successClass}">
            <h4>${testResult.testName}</h4>
            <p><strong>Base Skill:</strong> ${testResult.baseSkill}</p>
            <p><strong>Modified Skill:</strong> ${testResult.modifiedSkill}</p>
            <p><strong>Modifiers:</strong><br>${modifiersText}</p>
            <p><strong>Roll:</strong> ${testResult.roll}</p>
            <p><strong>Result:</strong> ${testResult.resultDescription}</p>
            <p><strong>Degrees:</strong> ${testResult.degrees}</p>
        </div>`;
    }

    /**
     * Generate formatted chat message for haggle test results
     * @param {Object} haggleResult - Haggle test result
     * @returns {string} - Formatted HTML content
     */
    generateHaggleTestMessage(haggleResult) {
        const dealmakerText = haggleResult.hasDealmakertTalent ? ' (with Dealmaker talent)' : '';
        const successClass = haggleResult.success ? 'success' : 'failure';

        return `
        <div class="haggle-test-result ${successClass}">
            <h4>Haggle Test${dealmakerText}</h4>
            <div class="haggle-comparison">
                <div class="player-result">
                    <h5>Player</h5>
                    <p><strong>Skill:</strong> ${haggleResult.player.skill}</p>
                    <p><strong>Roll:</strong> ${haggleResult.player.roll}</p>
                    <p><strong>Success:</strong> ${haggleResult.player.success ? 'Yes' : 'No'}</p>
                    <p><strong>Degrees:</strong> ${haggleResult.player.degrees}</p>
                </div>
                <div class="merchant-result">
                    <h5>Merchant</h5>
                    <p><strong>Skill:</strong> ${haggleResult.merchant.skill}</p>
                    <p><strong>Roll:</strong> ${haggleResult.merchant.roll}</p>
                    <p><strong>Success:</strong> ${haggleResult.merchant.success ? 'Yes' : 'No'}</p>
                    <p><strong>Degrees:</strong> ${haggleResult.merchant.degrees}</p>
                </div>
            </div>
            <p><strong>Overall Result:</strong> ${haggleResult.resultDescription}</p>
            <p><strong>Price Effect:</strong> ${haggleResult.success 
                ? (haggleResult.hasDealmakertTalent ? '±20%' : '±10%') 
                : 'No change'}</p>
        </div>`;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TradingEngine;
}

// Global registration for FoundryVTT
if (typeof window !== 'undefined') {
    window.TradingEngine = TradingEngine;
}