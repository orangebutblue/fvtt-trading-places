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
    async setCurrentSeason(season) {
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

        // Persist to settings if available (FoundryVTT or mock)
        if (global.foundryMock && global.foundryMock.setSetting) {
            await global.foundryMock.setSetting('wfrp-trading', 'currentSeason', season);
        } else if (global.game && global.game.settings && global.game.settings.set) {
            await global.game.settings.set('trading-places', 'currentSeason', season);
        }
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
            'Government': 'Armaments',
            'Wine': 'Wine/Brandy'
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
        // For trade settlements, return Trade Goods
        const tradeGoods = this.dataManager.cargoTypes.filter(cargo => 
            cargo.category === 'Trade'
        );
        
        if (tradeGoods.length > 0) {
            // Return the first (and likely only) trade goods entry
            return tradeGoods[0].name;
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
     * Process enhanced partial sale option (sell half cargo and re-roll)
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
     * Generate rumor from successful gossip test
     * @param {Object} gossipResult - Result from performGossipTest
     * @param {string} cargoName - Name of cargo to generate rumor about
     * @param {Object} settlement - Settlement object
     * @returns {Object|null} - Generated rumor or null if gossip failed
     */
    async generateRumorFromGossip(gossipResult, cargoName, settlement) {
        if (!gossipResult.success) {
            return null;
        }

        // Higher degrees of success = better rumors
        const rumorQuality = gossipResult.degrees;

        const rumors = [
            // Basic rumors (degrees 1-2)
            {
                type: 'minor_demand',
                description: `Slight increase in demand for ${cargoName}`,
                multiplier: 1.1,
                minDegrees: 1
            },
            {
                type: 'local_shortage',
                description: `Local merchants are running low on ${cargoName}`,
                multiplier: 1.2,
                minDegrees: 1
            },
            // Good rumors (degrees 2-3)
            {
                type: 'increased_demand',
                description: `Growing demand for ${cargoName} in the region`,
                multiplier: 1.3,
                minDegrees: 2
            },
            {
                type: 'merchant_shortage',
                description: `Several merchants are seeking ${cargoName}`,
                multiplier: 1.4,
                minDegrees: 2
            },
            // Excellent rumors (degrees 3+)
            {
                type: 'major_shortage',
                description: `Critical shortage of ${cargoName} due to recent events`,
                multiplier: 1.5,
                minDegrees: 3
            },
            {
                type: 'noble_requirement',
                description: `Local nobility requires large quantities of ${cargoName}`,
                multiplier: 1.6,
                minDegrees: 3
            }
        ];

        // Filter rumors by minimum degrees
        const availableRumors = rumors.filter(rumor => rumorQuality >= rumor.minDegrees);

        if (availableRumors.length === 0) {
            return null;
        }

        // Select random rumor from available options
        const selectedRumor = availableRumors[Math.floor(Math.random() * availableRumors.length)];

        return {
            type: selectedRumor.type,
            description: selectedRumor.description,
            multiplier: selectedRumor.multiplier,
            cargoName: cargoName,
            settlement: settlement.name,
            gossipDegrees: gossipResult.degrees,
            discoveredBy: 'gossip_test',
            reliability: rumorQuality >= 3 ? 'reliable' : 'unreliable'
        };
    }

    /**
     * Calculate Dealmaker talent bonus
     * @param {boolean} hasTalent - Whether player has Dealmaker talent
     * @param {string} transactionType - 'purchase' or 'sale'
     * @returns {Object} - Talent bonus information
     */
    calculateDealmakertBonus(hasTalent, transactionType) {
        if (!hasTalent) {
            return {
                hasBonus: false,
                bonusPercentage: 0,
                description: 'No Dealmaker talent'
            };
        }

        const bonusPercentage = 20; // 20% bonus

        return {
            hasBonus: true,
            bonusPercentage: bonusPercentage,
            description: `Dealmaker talent: ${transactionType === 'purchase' ? '-' : '+'}${bonusPercentage}% ${transactionType} price`,
            transactionType: transactionType
        };
    }

    /**
     * Get available sale options for a cargo type at a settlement
     * @param {string} cargoType - Type of cargo to sell
     * @param {number} quantity - Quantity to sell
     * @param {Object} settlement - Settlement object
     * @param {Object} purchaseData - Purchase data for eligibility checking
     * @returns {Object} - Available sale options
     */
    getAvailableSaleOptions(cargoType, quantity, settlement, purchaseData) {
        const options = {
            normal: false,
            desperate: false,
            partial: false,
            rumor: false
        };

        // Check if normal sale is possible
        const eligibility = this.checkSaleEligibility({ name: cargoType, quantity }, settlement, purchaseData);
        options.normal = eligibility.eligible;

        // Check if desperate sale is possible (only at trade settlements)
        const isTradeSettlement = this.dataManager.isTradeSettlement(settlement);
        options.desperate = isTradeSettlement;

        // Check if partial sale is possible (when normal sale fails)
        options.partial = !eligibility.eligible;

        // Check if rumor sale is possible (always available if rumors exist)
        const rumors = this.checkForRumors(cargoType, settlement);
        options.rumor = rumors.length > 0;

        return { options };
    }

    /**
     * Execute a special sale type (desperate, partial, or rumor)
     * @param {string} saleType - Type of special sale ('desperate', 'partial', 'rumor')
     * @param {string} cargoType - Type of cargo to sell
     * @param {number} quantity - Quantity to sell
     * @param {Object} settlement - Settlement object
     * @param {Object} purchaseData - Purchase data for eligibility checking
     * @param {Object} rumorData - Rumor data if using rumor sale
     * @param {Object} rollOptions - Options for dice rolls
     * @param {Function} rollFunction - Custom roll function for testing
     * @returns {Object} - Sale execution result
     */
    executeSpecialSale(saleType, cargoType, quantity, settlement, purchaseData, rumorData, rollOptions, rollFunction) {
        const result = {
            success: false,
            saleType: saleType,
            message: '',
            price: 0,
            quantitySold: 0
        };

        switch (saleType) {
            case 'desperate':
                // Desperate sale: roll 1d100 vs buyer availability, sell at 50% price
                const desperateRoll = rollFunction ? rollFunction() : this.rollDice('1d100').total;
                const buyerChance = this.calculateBuyerAvailabilityChance(settlement, cargoType);
                result.success = desperateRoll <= buyerChance;
                result.price = result.success ? this.calculateSalePrice(cargoType, quantity, settlement, rollOptions).totalPrice * 0.5 : 0;
                result.quantitySold = result.success ? quantity : 0;
                result.message = result.success ? 'Desperate sale successful' : 'No buyers found for desperate sale';
                break;

            case 'partial':
                // Partial sale: roll for available quantity, sell at normal price
                const partialResult = this.processEnhancedPartialSale(cargoType, quantity, settlement, purchaseData, rollFunction);
                result.success = partialResult.success;
                result.price = partialResult.price || 0;
                result.quantitySold = partialResult.quantitySold || 0;
                result.message = partialResult.message || 'Partial sale processed';
                break;

            case 'rumor':
                // Rumor sale: use rumor multiplier for premium pricing
                if (rumorData && rumorData.multiplier) {
                    const basePrice = this.calculateSalePrice(cargoType, quantity, settlement, rollOptions).totalPrice;
                    result.success = true;
                    result.price = basePrice * rumorData.multiplier;
                    result.quantitySold = quantity;
                    result.message = `Rumor sale successful: ${rumorData.description}`;
                } else {
                    result.message = 'No valid rumor data provided';
                }
                break;

            default:
                result.message = `Unknown sale type: ${saleType}`;
        }

        return result;
    }

    /**
     * Analyze profitability of different sale options
     * @param {string} cargoType - Type of cargo
     * @param {number} quantity - Quantity to sell
     * @param {Object} settlement - Settlement object
     * @param {Object} purchaseData - Purchase data with original cost
     * @param {Object} rollOptions - Options for dice rolls
     * @returns {Object} - Profit analysis for all sale options
     */
    analyzeSaleProfitability(cargoType, quantity, settlement, purchaseData, rollOptions) {
        const originalCost = purchaseData.totalCost || 0;
        const analysis = {
            originalCost: originalCost,
            saleOptions: {}
        };

        // Normal sale
        const normalPrice = this.calculateSalePrice(cargoType, quantity, settlement, rollOptions).totalPrice;
        analysis.saleOptions.normal = {
            price: normalPrice,
            profit: normalPrice - originalCost,
            profitMargin: originalCost > 0 ? ((normalPrice - originalCost) / originalCost) * 100 : 0
        };

        // Desperate sale (if available)
        const isTradeSettlement = this.dataManager.isTradeSettlement(settlement);
        if (isTradeSettlement) {
            const desperatePrice = normalPrice * 0.5;
            analysis.saleOptions.desperate = {
                price: desperatePrice,
                profit: desperatePrice - originalCost,
                profitMargin: originalCost > 0 ? ((desperatePrice - originalCost) / originalCost) * 100 : 0
            };
        }

        // Partial sale (if normal not available)
        const eligibility = this.checkSaleEligibility({ name: cargoType, quantity }, settlement, purchaseData);
        if (!eligibility.eligible) {
            // Estimate partial sale (assume 50% success rate)
            const partialPrice = normalPrice * 0.75; // Rough estimate
            analysis.saleOptions.partial = {
                price: partialPrice,
                profit: partialPrice - originalCost,
                profitMargin: originalCost > 0 ? ((partialPrice - originalCost) / originalCost) * 100 : 0,
                estimated: true
            };
        }

        // Rumor sale (if rumors available)
        const rumors = this.checkForRumors(cargoType, settlement);
        if (rumors.length > 0) {
            const bestRumor = rumors.reduce((best, current) => current.multiplier > best.multiplier ? current : best);
            const rumorPrice = normalPrice * bestRumor.multiplier;
            analysis.saleOptions.rumor = {
                price: rumorPrice,
                profit: rumorPrice - originalCost,
                profitMargin: originalCost > 0 ? ((rumorPrice - originalCost) / originalCost) * 100 : 0,
                rumorMultiplier: bestRumor.multiplier,
                rumorDescription: bestRumor.description
            };
        }

        return analysis;
    }

    /**
     * Roll dice using FoundryVTT Roll class or fallback
     * @param {string} formula - Dice formula (e.g., '1d100', '2d10+5')
     * @param {Object} options - Roll options
     * @returns {Object} - Roll result with total and details
     */
    rollDice(formula, options = {}) {
        try {
            // Try to use FoundryVTT Roll class if available
            if (typeof Roll !== 'undefined') {
                const roll = new Roll(formula, options);
                roll.evaluate({ async: false });
                return {
                    total: roll.total,
                    dice: roll.dice,
                    formula: formula,
                    result: roll.result,
                    terms: roll.terms
                };
            }
        } catch (error) {
            console.warn('FoundryVTT Roll class not available, using fallback:', error.message);
        }

        // Fallback: simple dice rolling for testing
        return this.rollDiceFallback(formula, options);
    }

    /**
     * Fallback dice rolling implementation for testing
     * @param {string} formula - Dice formula
     * @param {Object} options - Roll options
     * @returns {Object} - Roll result
     */
    rollDiceFallback(formula, options = {}) {
        // Parse simple formulas like '1d100', '2d10+5', etc.
        const match = formula.match(/^(\d+)d(\d+)([+-]\d+)?$/);
        if (!match) {
            throw new Error(`Unsupported dice formula: ${formula}`);
        }

        const numDice = parseInt(match[1]);
        const dieSize = parseInt(match[2]);
        const modifier = match[3] ? parseInt(match[3]) : 0;

        let total = modifier;
        const dice = [];

        for (let i = 0; i < numDice; i++) {
            const roll = Math.floor(Math.random() * dieSize) + 1;
            dice.push(roll);
            total += roll;
        }

        return {
            total: total,
            dice: dice,
            formula: formula,
            result: dice.join(' + ') + (modifier !== 0 ? ` ${modifier < 0 ? '' : '+'}${modifier}` : ''),
            terms: dice
        };
    }

    /**
     * Roll for cargo availability
     * @param {Object} settlement - Settlement object
     * @param {string} cargoType - Type of cargo
     * @param {Function} rollFunction - Custom roll function for testing
     * @returns {boolean} - Whether cargo is available
     */
    rollAvailability(settlement, cargoType, rollFunction = null) {
        const chance = this.calculateAvailabilityChance(settlement);
        const roll = rollFunction ? rollFunction() : this.rollDice('1d100').total;
        return roll <= chance;
    }

    /**
     * Roll for cargo size
     * @param {Object} settlement - Settlement object
     * @param {Function} rollFunction - Custom roll function for testing
     * @returns {Object} - Cargo size result
     */
    async rollCargoSize(settlement, rollFunction = null) {
        const properties = this.dataManager.getSettlementProperties(settlement);
        const roll = rollFunction ? rollFunction() : this.rollDice('1d100').total;
        
        const sizeModifier = properties.sizeNumeric;
        const wealthModifier = settlement.wealth;
        const totalSize = (sizeModifier + wealthModifier) * roll;

        return {
            totalSize: totalSize,
            roll: roll,
            sizeModifier: sizeModifier,
            wealthModifier: wealthModifier,
            settlement: settlement.name
        };
    }

    /**
     * Roll for buyer availability
     * @param {Object} settlement - Settlement object
     * @param {string} cargoType - Type of cargo
     * @param {Function} rollFunction - Custom roll function for testing
     * @returns {boolean} - Whether buyers are available
     */
    rollBuyerAvailability(settlement, cargoType, rollFunction = null) {
        const chance = this.calculateBuyerAvailabilityChance(settlement, cargoType);
        const roll = rollFunction ? rollFunction() : this.rollDice('1d100').total;
        return roll <= chance;
    }

    /**
     * Post a chat message in FoundryVTT
     * @param {string} message - Message content
     * @param {Object} options - Chat message options
     * @returns {Object} - Chat message result
     */
    postChatMessage(message, options = {}) {
        try {
            if (typeof ChatMessage !== 'undefined') {
                return ChatMessage.create({
                    content: message,
                    speaker: options.speaker || { alias: 'Trading Places' },
                    type: options.type || CONST.CHAT_MESSAGE_TYPES.OTHER,
                    ...options
                });
            }
        } catch (error) {
            console.warn('FoundryVTT ChatMessage not available:', error.message);
        }

        // Fallback for testing
        return {
            content: message,
            speaker: options.speaker || { alias: 'Trading Places' },
            type: options.type || 'other',
            posted: true,
            fallback: true
        };
    }

    /**
     * Generate roll result message
     * @param {Object} rollResult - Result from rollDice
     * @param {string} description - Description of the roll
     * @returns {string} - Formatted message
     */
    generateRollResultMessage(rollResult, description) {
        return `${description}: ${rollResult.result} = ${rollResult.total}`;
    }

    /**
     * Generate transaction result message
     * @param {string} transactionType - 'purchase' or 'sale'
     * @param {string} cargoType - Type of cargo
     * @param {number} quantity - Quantity involved
     * @param {number} price - Total price
     * @param {Object} settlement - Settlement object
     * @param {Object} options - Additional options
     * @returns {string} - Formatted transaction message
     */
    generateTransactionResultMessage(transactionType, cargoType, quantity, price, settlement, options = {}) {
        const action = transactionType === 'purchase' ? 'purchased' : 'sold';
        const preposition = transactionType === 'purchase' ? 'from' : 'to';
        const currency = options.currency || 'GC';
        
        let message = `${action} ${quantity} EP of ${cargoType} ${preposition} ${settlement.name} for ${price} ${currency}`;
        
        if (options.modifiers && options.modifiers.length > 0) {
            const modifierDescriptions = options.modifiers.map(m => m.description).join(', ');
            message += ` (${modifierDescriptions})`;
        }
        
        if (options.specialType) {
            message += ` (${options.specialType} sale)`;
        }
        
        return message;
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