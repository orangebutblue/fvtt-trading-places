console.log('Trading Places | Loading purchase-price-calculator.js');

let CurrencyUtils = null;
try {
    CurrencyUtils = require('./currency-utils');
} catch (error) {
    // Ignore require failures outside Node contexts.
}

if (typeof window !== 'undefined' && window.TradingPlacesCurrencyUtils) {
    CurrencyUtils = window.TradingPlacesCurrencyUtils;
}

/**
 * Trading Places Module - Purchase Price Calculator
 * Handles all purchase price calculations and validations
 */

class PurchasePriceCalculator {
    constructor(dataManager, tradingEngine) {
        this.dataManager = dataManager;
        this.tradingEngine = tradingEngine;
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

    getCurrencyContext() {
        if (!CurrencyUtils || !this.dataManager || typeof this.dataManager.getCurrencyContext !== 'function') {
            return null;
        }

        return this.dataManager.getCurrencyContext();
    }

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
        const currentSeason = season || this.tradingEngine.getCurrentSeason();

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
        const season = options.season || this.tradingEngine.getCurrentSeason();
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

        const currencyContext = this.getCurrencyContext();
        let basePricePerUnitCanonical = null;
        let finalPricePerUnitCanonical = null;
        let totalPriceCanonical = null;
        let formattedBasePricePerUnit = null;
        let formattedFinalPricePerUnit = null;
        let formattedTotalPrice = null;

        if (currencyContext && currencyContext.denominationKey && CurrencyUtils) {
            const { denominationKey, config } = currencyContext;
            try {
                basePricePerUnitCanonical = CurrencyUtils.convertToCanonical({ [denominationKey]: basePricePerUnit }, config);
                finalPricePerUnitCanonical = CurrencyUtils.convertToCanonical({ [denominationKey]: finalPricePerUnit }, config);
                totalPriceCanonical = Math.round(finalPricePerUnitCanonical * quantity);
                formattedBasePricePerUnit = CurrencyUtils.formatCurrency(basePricePerUnitCanonical, config);
                formattedFinalPricePerUnit = CurrencyUtils.formatCurrency(finalPricePerUnitCanonical, config);
                formattedTotalPrice = CurrencyUtils.formatCurrency(totalPriceCanonical, config);
            } catch (error) {
                console.error('PurchasePriceCalculator: Currency conversion failed', error);
            }
        }

        return {
            cargoName: cargoName,
            quantity: quantity,
            season: season,
            quality: quality,
            basePricePerUnit: basePricePerUnit,
            finalPricePerUnit: finalPricePerUnit,
            totalPrice: totalPrice,
            modifiers: modifiers,
            basePricePerUnitCanonical,
            finalPricePerUnitCanonical,
            totalPriceCanonical,
            formattedBasePricePerUnit,
            formattedFinalPricePerUnit,
            formattedTotalPrice,
            currencyDenomination: currencyContext?.primaryDenomination || null,
            currencyDenominationKey: currencyContext?.denominationKey || null
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
        const currentSeason = season || this.tradingEngine.getCurrentSeason();

        if (!cargo.qualityTiers) {
            throw new Error(`Cargo ${cargoName} does not have quality tiers`);
        }

        if (!cargo.qualityTiers.hasOwnProperty(quality)) {
            const availableTiers = Object.keys(cargo.qualityTiers);
            throw new Error(`Invalid quality tier: ${quality}. Available tiers: ${availableTiers.join(', ')}`);
        }

        // Calculate seasonal price from basePrice * seasonalModifiers
        const seasonalModifier = cargo.seasonalModifiers[currentSeason];
        const baseSeasonalPrice = cargo.basePrice * seasonalModifier;
        const qualityMultiplier = cargo.qualityTiers[quality];
        const finalPrice = baseSeasonalPrice * qualityMultiplier;

        const currencyContext = this.getCurrencyContext();
        let baseSeasonalPriceCanonical = null;
        let finalPriceCanonical = null;
        let formattedFinalPrice = null;

        if (currencyContext && currencyContext.denominationKey && CurrencyUtils) {
            const { denominationKey, config } = currencyContext;
            try {
                baseSeasonalPriceCanonical = CurrencyUtils.convertToCanonical({ [denominationKey]: baseSeasonalPrice }, config);
                finalPriceCanonical = CurrencyUtils.convertToCanonical({ [denominationKey]: finalPrice }, config);
                formattedFinalPrice = CurrencyUtils.formatCurrency(finalPriceCanonical, config);
            } catch (error) {
                console.error('PurchasePriceCalculator: Quality pricing currency conversion failed', error);
            }
        }

        return {
            cargoName: cargoName,
            season: currentSeason,
            quality: quality,
            baseSeasonalPrice: baseSeasonalPrice,
            qualityMultiplier: qualityMultiplier,
            finalPrice: finalPrice,
            availableQualities: Object.keys(cargo.qualityTiers),
            baseSeasonalPriceCanonical,
            finalPriceCanonical,
            formattedFinalPrice,
            currencyDenomination: currencyContext?.primaryDenomination || null,
            currencyDenominationKey: currencyContext?.denominationKey || null
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
}

// Export for use in other modules
export { PurchasePriceCalculator };

// Global registration for FoundryVTT
if (typeof window !== 'undefined') {
    window.PurchasePriceCalculator = PurchasePriceCalculator;
}