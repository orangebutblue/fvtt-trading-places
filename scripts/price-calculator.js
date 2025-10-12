console.log('Trading Places | Loading price-calculator.js');

let CurrencyUtils = null;
try {
    CurrencyUtils = require('./currency-utils');
} catch (error) {
    // Ignore require failures; browser global fallback below.
}

if (typeof window !== 'undefined' && window.TradingPlacesCurrencyUtils) {
    CurrencyUtils = window.TradingPlacesCurrencyUtils;
}

/**
 * Trading Places Module - Price Calculator Component
 * Provides transparent pricing display with seasonal modifiers, haggling outcomes, and comprehensive logging
 */

/**
 * Price Calculator class for transparent pricing display
 * Handles both buying and selling price calculations with detailed breakdowns
 */
class PriceCalculator {
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
     * Calculate comprehensive buying price breakdown
     * @param {string} cargoType - Type of cargo
     * @param {number} quantity - Quantity in EP
     * @param {string} season - Current season
     * @param {Object} options - Calculation options
     * @returns {Object} - Detailed price breakdown
     */
    calculateBuyingPriceBreakdown(cargoType, quantity, season, options = {}) {
        const logger = this.getLogger();
        
        logger.logAlgorithmStep(
            'Price Calculator',
            'Buying Price Breakdown',
            'Calculate Comprehensive Buying Price',
            { cargoType, quantity, season, options },
            'Trading Places - Price Calculator Component'
        );

        if (!cargoType || !season) {
            throw new Error('Cargo type and season are required');
        }

        // Get cargo object
        const cargo = this.dataManager.cargoTypes.find(c => c.name === cargoType);
        if (!cargo) {
            throw new Error(`Cargo type not found: ${cargoType}`);
        }

        const quality = options.quality || 'average';
        
        // Calculate base seasonal price
        const basePrice = this.dataManager.getSeasonalPrice(cargo, season, quality);
        
        logger.logCalculation(
            'Base Seasonal Price',
            'Cargo Base Price for Season',
            {
                cargoType,
                season,
                quality,
                basePrice: cargo.basePrice,
                seasonalModifiers: cargo.seasonalModifiers,
                qualityTiers: cargo.qualityTiers
            },
            basePrice,
            `Base price for ${cargoType} in ${season} (${quality} quality): ${basePrice} GC per 10 EP`
        );

        // Calculate all seasonal prices for comparison
        const seasonalComparison = this.calculateSeasonalComparison(cargoType, quality);
        
        // Calculate price modifiers
        const modifiers = [];
        let finalPricePerUnit = basePrice;

        // Partial purchase penalty (+10%)
        if (options.isPartialPurchase) {
            const partialPenalty = basePrice * 0.1;
            finalPricePerUnit += partialPenalty;
            modifiers.push({
                type: 'partial_purchase',
                description: 'Partial purchase penalty (+10%)',
                amount: partialPenalty,
                percentage: 10,
                explanation: 'Applied when not purchasing the full available quantity'
            });
            
            logger.logCalculation(
                'Partial Purchase Penalty',
                'Base Price × 0.1',
                {
                    basePrice,
                    penalty: partialPenalty,
                    reason: 'Not purchasing full available quantity'
                },
                partialPenalty,
                `Partial purchase penalty: +${partialPenalty} GC per 10 EP`
            );
        }

        // Calculate haggling potential outcomes
        const haggleOutcomes = this.calculateHaggleOutcomes(finalPricePerUnit, 'buying');
        
        // Apply actual haggle result if provided
        if (options.haggleResult) {
            const haggleModifier = this.applyHaggleResult(finalPricePerUnit, options.haggleResult, 'buying');
            finalPricePerUnit += haggleModifier.amount;
            modifiers.push(haggleModifier);
            
            logger.logCalculation(
                'Haggling Applied',
                'Price + Haggle Modifier',
                {
                    originalPrice: finalPricePerUnit - haggleModifier.amount,
                    haggleModifier: haggleModifier.amount,
                    haggleResult: options.haggleResult
                },
                finalPricePerUnit,
                `Haggling result: ${haggleModifier.description}`
            );
        }

        // Calculate total price
        const totalUnits = Math.ceil(quantity / 10);
        const totalPrice = Math.round((finalPricePerUnit * totalUnits) * 100) / 100;

        logger.logCalculation(
            'Total Buying Price',
            'Final Price per Unit × Total Units',
            {
                cargoType,
                quantity,
                totalUnits,
                finalPricePerUnit,
                modifiers: modifiers.map(m => m.description)
            },
            totalPrice,
            `${totalUnits} units × ${finalPricePerUnit} GC = ${totalPrice} GC`
        );

        const result = {
            cargoType,
            season,
            quality,
            quantity,
            totalUnits,
            basePricePerUnit: basePrice,
            finalPricePerUnit,
            totalPrice,
            modifiers,
            seasonalComparison,
            haggleOutcomes,
            calculationType: 'buying'
        };

        const currencyContext = this.getCurrencyContext();
        if (currencyContext && currencyContext.denominationKey && CurrencyUtils) {
            const { denominationKey, config, primaryDenomination } = currencyContext;

            try {
                result.basePricePerUnitCanonical = CurrencyUtils.convertToCanonical({ [denominationKey]: basePrice }, config);
                result.finalPricePerUnitCanonical = CurrencyUtils.convertToCanonical({ [denominationKey]: finalPricePerUnit }, config);
                result.totalPriceCanonical = Math.round(result.finalPricePerUnitCanonical * totalUnits);
                result.formattedBasePricePerUnit = CurrencyUtils.formatCurrency(result.basePricePerUnitCanonical, config);
                result.formattedFinalPricePerUnit = CurrencyUtils.formatCurrency(result.finalPricePerUnitCanonical, config);
                result.formattedTotalPrice = CurrencyUtils.formatCurrency(result.totalPriceCanonical, config);
                result.currencyDenomination = primaryDenomination || null;
                result.currencyDenominationKey = currencyContext.denominationKey || null;
            } catch (error) {
                console.error('PriceCalculator: Buying price currency conversion failed', error);
            }
        }

        return result;
    }

    /**
     * Calculate comprehensive selling price breakdown
     * @param {string} cargoType - Type of cargo
     * @param {number} quantity - Quantity in EP
     * @param {string} season - Current season
     * @param {Object} settlement - Settlement object
     * @param {Object} options - Calculation options
     * @returns {Object} - Detailed price breakdown
     */
    calculateSellingPriceBreakdown(cargoType, quantity, season, settlement, options = {}) {
        const logger = this.getLogger();
        
        if (!cargoType || !season || !settlement) {
            throw new Error('Cargo type, season, and settlement are required');
        }

        logger.logAlgorithmStep(
            'Price Calculator',
            'Selling Price Breakdown',
            'Calculate Comprehensive Selling Price',
            { cargoType, quantity, season, settlementName: settlement.name, options },
            'Trading Places - Price Calculator Component'
        );

        // Get cargo object
        const cargo = this.dataManager.cargoTypes.find(c => c.name === cargoType);
        if (!cargo) {
            throw new Error(`Cargo type not found: ${cargoType}`);
        }

        const quality = options.quality || 'average';
        const settlementInfo = this.dataManager.getSettlementProperties(settlement);
        
        // Calculate base seasonal price
        const basePrice = this.dataManager.getSeasonalPrice(cargo, season, quality);
        
        logger.logCalculation(
            'Base Seasonal Price',
            'Cargo Base Price for Season',
            {
                cargoType,
                season,
                quality,
                basePrice: cargo.basePrice,
                seasonalModifiers: cargo.seasonalModifiers
            },
            basePrice,
            `Base price for ${cargoType} in ${season} (${quality} quality): ${basePrice} GC per 10 EP`
        );

        // Calculate all seasonal prices for comparison
        const seasonalComparison = this.calculateSeasonalComparison(cargoType, quality);
        
        // Apply wealth modifier
        const wealthModifier = settlementInfo.wealthModifier;
        const wealthAdjustedPrice = Math.round((basePrice * wealthModifier) * 100) / 100;
        
        logger.logCalculation(
            'Wealth-Adjusted Price',
            'Base Price × Wealth Modifier',
            {
                settlementName: settlement.name,
                wealthRating: settlementInfo.wealthRating,
                wealthDescription: settlementInfo.wealthDescription,
                wealthModifier,
                basePrice,
                wealthAdjustedPrice
            },
            wealthAdjustedPrice,
            `Settlement wealth adjustment: ${basePrice} × ${wealthModifier} = ${wealthAdjustedPrice} GC per 10 EP`
        );

        // Track price modifiers
        const modifiers = [{
            type: 'wealth_adjustment',
            description: `Settlement wealth (${settlementInfo.wealthDescription})`,
            amount: wealthAdjustedPrice - basePrice,
            percentage: Math.round(((wealthModifier - 1) * 100) * 10) / 10,
            explanation: `Wealth rating ${settlementInfo.wealthRating} applies ${wealthModifier}x multiplier`
        }];

        let finalPricePerUnit = wealthAdjustedPrice;

        // Calculate haggling potential outcomes
        const haggleOutcomes = this.calculateHaggleOutcomes(finalPricePerUnit, 'selling');
        
        // Apply actual haggle result if provided
        if (options.haggleResult) {
            const haggleModifier = this.applyHaggleResult(finalPricePerUnit, options.haggleResult, 'selling');
            finalPricePerUnit += haggleModifier.amount;
            modifiers.push(haggleModifier);
            
            logger.logCalculation(
                'Haggling Applied',
                'Price + Haggle Modifier',
                {
                    originalPrice: finalPricePerUnit - haggleModifier.amount,
                    haggleModifier: haggleModifier.amount,
                    haggleResult: options.haggleResult
                },
                finalPricePerUnit,
                `Haggling result: ${haggleModifier.description}`
            );
        }

        // Calculate total price
        const totalUnits = Math.ceil(quantity / 10);
        const totalPrice = Math.round((finalPricePerUnit * totalUnits) * 100) / 100;

        logger.logCalculation(
            'Total Selling Price',
            'Final Price per Unit × Total Units',
            {
                cargoType,
                quantity,
                totalUnits,
                finalPricePerUnit,
                modifiers: modifiers.map(m => m.description)
            },
            totalPrice,
            `${totalUnits} units × ${finalPricePerUnit} GC = ${totalPrice} GC`
        );

        const result = {
            cargoType,
            season,
            quality,
            quantity,
            totalUnits,
            basePricePerUnit: basePrice,
            wealthAdjustedPrice,
            finalPricePerUnit,
            totalPrice,
            modifiers,
            seasonalComparison,
            haggleOutcomes,
            settlement: settlement.name,
            settlementInfo,
            calculationType: 'selling'
        };

        const currencyContext = this.getCurrencyContext();
        if (currencyContext && currencyContext.denominationKey && CurrencyUtils) {
            const { denominationKey, config, primaryDenomination } = currencyContext;

            try {
                result.basePricePerUnitCanonical = CurrencyUtils.convertToCanonical({ [denominationKey]: basePrice }, config);
                result.finalPricePerUnitCanonical = CurrencyUtils.convertToCanonical({ [denominationKey]: finalPricePerUnit }, config);
                result.totalPriceCanonical = Math.round(result.finalPricePerUnitCanonical * totalUnits);
                result.formattedBasePricePerUnit = CurrencyUtils.formatCurrency(result.basePricePerUnitCanonical, config);
                result.formattedFinalPricePerUnit = CurrencyUtils.formatCurrency(result.finalPricePerUnitCanonical, config);
                result.formattedTotalPrice = CurrencyUtils.formatCurrency(result.totalPriceCanonical, config);
                result.currencyDenomination = primaryDenomination || null;
                result.currencyDenominationKey = currencyContext.denominationKey || null;
            } catch (error) {
                console.error('PriceCalculator: Selling price currency conversion failed', error);
            }
        }

        return result;
    }

    /**
     * Calculate seasonal price comparison for a cargo type
     * @param {string} cargoType - Type of cargo
     * @param {string} quality - Quality tier
     * @returns {Object} - Seasonal price comparison
     */
    calculateSeasonalComparison(cargoType, quality = 'average') {
        const logger = this.getLogger();
        
        const cargo = this.dataManager.cargoTypes.find(c => c.name === cargoType);
        if (!cargo) {
            throw new Error(`Cargo type not found: ${cargoType}`);
        }

        const seasons = ['spring', 'summer', 'autumn', 'winter'];
        const prices = {};
        
        seasons.forEach(season => {
            prices[season] = this.dataManager.getSeasonalPrice(cargo, season, quality);
        });

        // Find best and worst seasons for buying/selling
        const sortedSeasons = seasons.sort((a, b) => prices[a] - prices[b]);
        const bestBuyingSeason = sortedSeasons[0]; // Lowest price
        const worstBuyingSeason = sortedSeasons[sortedSeasons.length - 1]; // Highest price
        const bestSellingSeason = worstBuyingSeason; // Highest price is best for selling
        const worstSellingSeason = bestBuyingSeason; // Lowest price is worst for selling

        const priceRange = {
            min: prices[bestBuyingSeason],
            max: prices[worstBuyingSeason],
            difference: prices[worstBuyingSeason] - prices[bestBuyingSeason],
            percentageVariation: Math.round(((prices[worstBuyingSeason] - prices[bestBuyingSeason]) / prices[bestBuyingSeason] * 100) * 10) / 10
        };

        logger.logCalculation(
            'Seasonal Price Analysis',
            'Price Variation Across Seasons',
            {
                cargoType,
                quality,
                prices,
                bestBuyingSeason,
                bestSellingSeason,
                priceRange
            },
            priceRange.percentageVariation,
            `${cargoType} price varies by ${priceRange.percentageVariation}% across seasons`
        );

        return {
            cargoType,
            quality,
            prices,
            bestBuyingSeason,
            worstBuyingSeason,
            bestSellingSeason,
            worstSellingSeason,
            priceRange
        };
    }

    /**
     * Calculate potential haggling outcomes
     * @param {number} basePrice - Base price per unit
     * @param {string} transactionType - 'buying' or 'selling'
     * @returns {Object} - Haggling outcome scenarios
     */
    calculateHaggleOutcomes(basePrice, transactionType) {
        const logger = this.getLogger();
        
        logger.logCalculation(
            'Haggle Outcomes Calculation',
            'Potential Price Ranges',
            {
                basePrice,
                transactionType
            },
            null,
            `Calculating haggle outcomes for ${transactionType} at ${basePrice} GC per 10 EP`
        );

        const outcomes = {
            noHaggle: {
                description: 'No haggling attempted',
                pricePerUnit: basePrice,
                change: 0,
                percentage: 0
            },
            failedHaggle: {
                description: 'Failed haggle (no penalty)',
                pricePerUnit: basePrice,
                change: 0,
                percentage: 0
            },
            successfulHaggle: {
                description: 'Successful haggle',
                pricePerUnit: 0,
                change: 0,
                percentage: 0
            },
            successfulHaggleWithDealmaker: {
                description: 'Successful haggle with Dealmaker talent',
                pricePerUnit: 0,
                change: 0,
                percentage: 0
            }
        };

        if (transactionType === 'buying') {
            // For buying: successful haggle reduces price
            outcomes.successfulHaggle.percentage = -10;
            outcomes.successfulHaggle.change = basePrice * -0.1;
            outcomes.successfulHaggle.pricePerUnit = Math.round((basePrice * 0.9) * 100) / 100;
            
            outcomes.successfulHaggleWithDealmaker.percentage = -20;
            outcomes.successfulHaggleWithDealmaker.change = basePrice * -0.2;
            outcomes.successfulHaggleWithDealmaker.pricePerUnit = Math.round((basePrice * 0.8) * 100) / 100;
        } else {
            // For selling: successful haggle increases price
            outcomes.successfulHaggle.percentage = 10;
            outcomes.successfulHaggle.change = basePrice * 0.1;
            outcomes.successfulHaggle.pricePerUnit = Math.round((basePrice * 1.1) * 100) / 100;
            
            outcomes.successfulHaggleWithDealmaker.percentage = 20;
            outcomes.successfulHaggleWithDealmaker.change = basePrice * 0.2;
            outcomes.successfulHaggleWithDealmaker.pricePerUnit = Math.round((basePrice * 1.2) * 100) / 100;
        }

        logger.logSystem('Haggle Outcomes', 'Calculated potential haggling scenarios', {
            transactionType,
            basePrice,
            outcomes: Object.keys(outcomes).map(key => ({
                scenario: key,
                price: outcomes[key].pricePerUnit,
                change: outcomes[key].change
            }))
        });

        return outcomes;
    }

    /**
     * Apply haggle result to price calculation
     * @param {number} basePrice - Base price per unit
     * @param {Object} haggleResult - Haggle test result
     * @param {string} transactionType - 'buying' or 'selling'
     * @returns {Object} - Price modifier object
     */
    applyHaggleResult(basePrice, haggleResult, transactionType) {
        const logger = this.getLogger();
        
        if (!haggleResult || typeof haggleResult.success !== 'boolean') {
            throw new Error('Invalid haggle result object');
        }

        logger.logDecision(
            'Haggle Result Application',
            haggleResult.success ? 'Successful Haggle' : 'Failed Haggle',
            {
                transactionType,
                basePrice,
                haggleSuccess: haggleResult.success,
                hasDealmakertTalent: haggleResult.hasDealmakertTalent
            },
            ['Successful Haggle', 'Failed Haggle'],
            `Applying haggle result to ${transactionType} price`
        );

        let percentage = 0;
        let description = '';

        if (haggleResult.success) {
            // Successful haggle
            if (transactionType === 'buying') {
                // Reduces buying price
                percentage = haggleResult.hasDealmakertTalent ? -20 : -10;
                description = haggleResult.hasDealmakertTalent 
                    ? 'Successful haggle with Dealmaker (-20%)'
                    : 'Successful haggle (-10%)';
            } else {
                // Increases selling price
                percentage = haggleResult.hasDealmakertTalent ? 20 : 10;
                description = haggleResult.hasDealmakertTalent 
                    ? 'Successful haggle with Dealmaker (+20%)'
                    : 'Successful haggle (+10%)';
            }
        } else {
            // Failed haggle - no penalty by default
            percentage = 0;
            description = 'Failed haggle (no penalty)';
        }

        const amount = Math.round((basePrice * (percentage / 100)) * 100) / 100;

        logger.logCalculation(
            'Haggle Modifier',
            'Base Price × Percentage',
            {
                basePrice,
                percentage,
                amount,
                transactionType,
                haggleResult
            },
            amount,
            `Haggle modifier: ${percentage}% = ${amount} GC per 10 EP`
        );

        return {
            type: 'haggle',
            description,
            amount,
            percentage,
            explanation: `${haggleResult.success ? 'Successful' : 'Failed'} haggle test ${haggleResult.hasDealmakertTalent ? 'with Dealmaker talent' : ''}`
        };
    }

    /**
     * Calculate special sale prices (desperate and rumor sales)
     * @param {string} cargoType - Type of cargo
     * @param {number} quantity - Quantity in EP
     * @param {string} season - Current season
     * @param {string} saleType - 'desperate' or 'rumor'
     * @param {Object} options - Calculation options
     * @returns {Object} - Special sale price breakdown
     */
    calculateSpecialSalePrice(cargoType, quantity, season, saleType, options = {}) {
        const logger = this.getLogger();
        
        logger.logAlgorithmStep(
            'Price Calculator',
            'Special Sale Price',
            `Calculate ${saleType} Sale Price`,
            { cargoType, quantity, season, saleType, options },
            'Trading Places - Special Sale Pricing'
        );

        if (!['desperate', 'rumor'].includes(saleType)) {
            throw new Error('Sale type must be "desperate" or "rumor"');
        }

        // Get cargo object
        const cargo = this.dataManager.cargoTypes.find(c => c.name === cargoType);
        if (!cargo) {
            throw new Error(`Cargo type not found: ${cargoType}`);
        }

        const quality = options.quality || 'average';
        
        // Calculate base seasonal price
        const basePrice = this.dataManager.getSeasonalPrice(cargo, season, quality);
        
        // Calculate special sale multiplier
        let multiplier, description;
        if (saleType === 'desperate') {
            multiplier = 0.5;
            description = 'Desperate sale (50% of base price)';
        } else {
            multiplier = 2.0;
            description = 'Rumor sale (200% of base price)';
        }

        const specialPrice = Math.round((basePrice * multiplier) * 100) / 100;
        
        logger.logCalculation(
            'Special Sale Price',
            `Base Price × ${multiplier}`,
            {
                cargoType,
                season,
                quality,
                saleType,
                basePrice,
                multiplier,
                specialPrice
            },
            specialPrice,
            `${description}: ${basePrice} × ${multiplier} = ${specialPrice} GC per 10 EP`
        );

        // Calculate total price
        const totalUnits = Math.ceil(quantity / 10);
        const totalPrice = Math.round((specialPrice * totalUnits) * 100) / 100;

        const modifiers = [{
            type: saleType,
            description,
            amount: specialPrice - basePrice,
            percentage: (multiplier - 1) * 100,
            explanation: saleType === 'desperate' 
                ? 'Emergency sale at Trade settlement for immediate cash'
                : 'High-demand sale based on reliable rumor information'
        }];

        logger.logCalculation(
            'Total Special Sale Price',
            'Special Price × Total Units',
            {
                cargoType,
                quantity,
                totalUnits,
                specialPrice,
                saleType
            },
            totalPrice,
            `${totalUnits} units × ${specialPrice} GC = ${totalPrice} GC`
        );

        return {
            cargoType,
            season,
            quality,
            quantity,
            totalUnits,
            basePricePerUnit: basePrice,
            specialPricePerUnit: specialPrice,
            totalPrice,
            modifiers,
            saleType,
            calculationType: 'special_sale'
        };
    }

    /**
     * Generate comprehensive price display data for UI
     * @param {Object} priceBreakdown - Price breakdown from calculation methods
     * @returns {Object} - Formatted display data
     */
    generatePriceDisplayData(priceBreakdown) {
        const logger = this.getLogger();
        
        logger.logSystem('Price Display Generation', 'Formatting price data for UI display', {
            cargoType: priceBreakdown.cargoType,
            calculationType: priceBreakdown.calculationType,
            totalPrice: priceBreakdown.totalPrice
        });

        const displayData = {
            // Basic information
            cargoType: priceBreakdown.cargoType,
            season: priceBreakdown.season,
            quality: priceBreakdown.quality,
            quantity: priceBreakdown.quantity,
            totalUnits: priceBreakdown.totalUnits,
            
            // Price information
            basePricePerUnit: priceBreakdown.basePricePerUnit,
            finalPricePerUnit: priceBreakdown.finalPricePerUnit,
            totalPrice: priceBreakdown.totalPrice,
            
            // Modifiers with explanations
            modifiers: priceBreakdown.modifiers || [],
            
            // Seasonal comparison
            seasonalComparison: priceBreakdown.seasonalComparison,
            
            // Haggling information
            haggleOutcomes: priceBreakdown.haggleOutcomes,
            
            // Settlement information (for selling)
            settlement: priceBreakdown.settlement,
            settlementInfo: priceBreakdown.settlementInfo,
            
            // Display formatting
            formattedPrices: {
                basePrice: `${priceBreakdown.basePricePerUnit} GC per 10 EP`,
                finalPrice: `${priceBreakdown.finalPricePerUnit} GC per 10 EP`,
                totalPrice: `${priceBreakdown.totalPrice} GC total`,
                quantityDescription: `${priceBreakdown.quantity} EP (${priceBreakdown.totalUnits} units)`
            },
            
            // Calculation metadata
            calculationType: priceBreakdown.calculationType
        };

        return displayData;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { PriceCalculator };
} else if (typeof window !== 'undefined') {
    window.PriceCalculator = PriceCalculator;
}