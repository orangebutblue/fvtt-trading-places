console.log('Trading Places | Loading sale-mechanics.js');

/**
 * Trading Places Module - Sale Mechanics
 * Handles all sale-related calculations and validations
 */
let CurrencyUtils = null;
try {
    CurrencyUtils = require('./currency-utils');
} catch (error) {
    // Ignore require failures; browser global fallback below.
}

if (typeof window !== 'undefined' && window.TradingPlacesCurrencyUtils) {
    CurrencyUtils = window.TradingPlacesCurrencyUtils;
}

class SaleMechanics {
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
            const cargo = this.tradingEngine.getCargoByName(cargoName);
            if (cargo.category !== 'Bulk Goods' || cargoName !== 'Grain') {
                // Villages only buy Grain, except in Spring (1d10 EP of other goods)
                const currentSeason = this.tradingEngine.getCurrentSeason();
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
            rollResult = await this.tradingEngine.rollDice('1d100');
            roll = rollResult.total;
        }

        const buyerFound = roll <= chance;

        if (buyerFound) {
            // Generate a random merchant for successful buyer encounters
            const merchant = await this.tradingEngine.generateRandomMerchant(settlement, rollFunction);

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

        const cargo = this.tradingEngine.getCargoByName(cargoName);
        const season = options.season || this.tradingEngine.getCurrentSeason();
        const quality = options.quality || 'average';

        // Calculate base price per unit
        const basePricePerUnit = this.tradingEngine.calculateBasePrice(cargoName, season, quality);

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

        const currencyContext = this.getCurrencyContext();
        let basePricePerUnitCanonical = null;
        let wealthAdjustedPriceCanonical = null;
        let finalPricePerUnitCanonical = null;
        let totalPriceCanonical = null;
        let formattedBasePricePerUnit = null;
        let formattedFinalPricePerUnit = null;
        let formattedTotalPrice = null;

        if (currencyContext && currencyContext.denominationKey && CurrencyUtils) {
            const { denominationKey, config } = currencyContext;
            try {
                basePricePerUnitCanonical = CurrencyUtils.convertToCanonical({ [denominationKey]: basePricePerUnit }, config);
                wealthAdjustedPriceCanonical = CurrencyUtils.convertToCanonical({ [denominationKey]: wealthAdjustedPrice }, config);
                finalPricePerUnitCanonical = CurrencyUtils.convertToCanonical({ [denominationKey]: finalPricePerUnit }, config);
                totalPriceCanonical = Math.round(finalPricePerUnitCanonical * quantity);
                formattedBasePricePerUnit = CurrencyUtils.formatCurrency(basePricePerUnitCanonical, config);
                formattedFinalPricePerUnit = CurrencyUtils.formatCurrency(finalPricePerUnitCanonical, config);
                formattedTotalPrice = CurrencyUtils.formatCurrency(totalPriceCanonical, config);
            } catch (error) {
                console.error('SaleMechanics: Currency conversion failed', error);
            }
        }

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
            wealthModifier: wealthModifier,
            wealthAdjustedPrice,
            basePricePerUnitCanonical,
            wealthAdjustedPriceCanonical,
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
            description,
            amount,
            percentage
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
        const currentSeason = season || this.tradingEngine.getCurrentSeason();

        if (properties.sizeNumeric !== 1) {
            // Not a village, no restrictions
            return {
                restricted: false,
                reason: null,
                allowedQuantity: null
            };
        }

        const cargo = this.tradingEngine.getCargoByName(cargoName);

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
            this.tradingEngine.getCargoByName(cargoName);
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

        const cargo = this.tradingEngine.getCargoByName(cargoName);
        const season = options.season || this.tradingEngine.getCurrentSeason();
        const quality = options.quality || 'average';

        // Calculate base price per unit
        const basePricePerUnit = this.tradingEngine.calculateBasePrice(cargoName, season, quality);

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

        const cargo = this.tradingEngine.getCargoByName(cargoName);
        const season = options.season || this.tradingEngine.getCurrentSeason();
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

        const cargo = this.tradingEngine.getCargoByName(cargoName);
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
                const desperateRoll = rollFunction ? rollFunction() : this.tradingEngine.rollDice('1d100').total;
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
}

// Export for use in other modules
export { SaleMechanics };

// Global registration for FoundryVTT
if (typeof window !== 'undefined') {
    window.SaleMechanics = SaleMechanics;
}