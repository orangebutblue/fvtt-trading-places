console.log('Trading Places | Loading selling-algorithm.js');

/**
 * Trading Places Module - WFRP Selling Algorithm Implementation
 * Implements the complete WFRP selling algorithm from official-algorithm.md
 */

/**
 * WFRP Selling Algorithm class implementing the official Death on the Reik Companion rules
 * Follows the German algorithm specification from official-algorithm.md
 */
class WFRPSellingAlgorithm {
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

    /**
     * Step 1: Check selling eligibility (location/time restrictions)
     * @param {Object} settlement - Current settlement object
     * @param {string} cargoType - Type of cargo being sold
     * @param {Object} cargoHistory - Cargo purchase history
     * @returns {Object} - Eligibility check result
     */
    checkSellingEligibility(settlement, cargoType, cargoHistory = {}) {
        const logger = this.getLogger();
        
        logger.logAlgorithmStep(
            'WFRP Selling Algorithm',
            'Step 1',
            'Selling Eligibility Check',
            { 
                settlementName: settlement.name,
                cargoType: cargoType,
                purchaseLocation: cargoHistory.purchaseLocation,
                purchaseDate: cargoHistory.purchaseDate
            },
            'Death on the Reik Companion - Selling Algorithm Step 1'
        );

        const eligibilityChecks = [];
        let canSell = true;
        let restrictions = [];

        // Check 1: Cannot sell where purchased
        if (cargoHistory.purchaseLocation && cargoHistory.purchaseLocation === settlement.name) {
            canSell = false;
            restrictions.push({
                type: 'same_location',
                description: 'Cannot sell cargo at the same location where it was purchased',
                purchaseLocation: cargoHistory.purchaseLocation,
                currentLocation: settlement.name
            });
            
            eligibilityChecks.push({
                check: 'Location Restriction',
                passed: false,
                reason: `Cargo purchased at ${cargoHistory.purchaseLocation}, cannot sell at same location`
            });
        } else {
            eligibilityChecks.push({
                check: 'Location Restriction',
                passed: true,
                reason: cargoHistory.purchaseLocation 
                    ? `Different location: purchased at ${cargoHistory.purchaseLocation}, selling at ${settlement.name}`
                    : 'No purchase location restriction'
            });
        }

        // Check 2: One week waiting period (only applies if same location)
        if (cargoHistory.purchaseDate && cargoHistory.purchaseLocation === settlement.name) {
            const purchaseDate = new Date(cargoHistory.purchaseDate);
            const currentDate = new Date();
            const daysDifference = Math.floor((currentDate - purchaseDate) / (1000 * 60 * 60 * 24));
            
            if (daysDifference < 7) {
                canSell = false;
                restrictions.push({
                    type: 'waiting_period',
                    description: 'Must wait one week before selling at same location',
                    purchaseDate: cargoHistory.purchaseDate,
                    daysSincePurchase: daysDifference,
                    daysRemaining: 7 - daysDifference
                });
                
                eligibilityChecks.push({
                    check: 'Waiting Period',
                    passed: false,
                    reason: `Only ${daysDifference} days since purchase, need 7 days`
                });
            } else {
                eligibilityChecks.push({
                    check: 'Waiting Period',
                    passed: true,
                    reason: `${daysDifference} days since purchase, waiting period satisfied`
                });
            }
        } else {
            eligibilityChecks.push({
                check: 'Waiting Period',
                passed: true,
                reason: 'No waiting period restriction (different location or no purchase date)'
            });
        }

        logger.logDecision(
            'Selling Eligibility',
            canSell ? 'Eligible to Sell' : 'Not Eligible to Sell',
            {
                settlement: settlement.name,
                cargoType: cargoType,
                restrictions: restrictions,
                eligibilityChecks: eligibilityChecks
            },
            ['Eligible to Sell', 'Not Eligible to Sell'],
            canSell ? 'All eligibility checks passed' : `Restrictions: ${restrictions.map(r => r.type).join(', ')}`
        );

        return {
            canSell: canSell,
            restrictions: restrictions,
            eligibilityChecks: eligibilityChecks,
            settlement: settlement.name,
            cargoType: cargoType
        };
    }

    /**
     * Step 2: Find buyer using (Size × 10) + Trade bonus formula
     * @param {Object} settlement - Settlement object
     * @param {string} cargoType - Type of cargo being sold
     * @param {number} quantity - Quantity in EP
     * @param {Function} rollFunction - Optional roll function for testing
     * @returns {Promise<Object>} - Buyer availability result
     */
    async findBuyer(settlement, cargoType, quantity, rollFunction = null) {
        const logger = this.getLogger();
        
        logger.logAlgorithmStep(
            'WFRP Selling Algorithm',
            'Step 2',
            'Buyer Availability Check',
            { 
                settlementName: settlement.name,
                cargoType: cargoType,
                quantity: quantity
            },
            'Death on the Reik Companion - Selling Algorithm Step 2'
        );

        const settlementInfo = this.dataManager.getSettlementProperties(settlement);
        
        // Calculate buyer availability chance: Size × 10
        let buyerChance = settlementInfo.sizeNumeric * 10;
        const modifiers = [];

        // Add Trade bonus: +30 if settlement has "Trade" in source
        if (settlementInfo.productionCategories.includes('Trade')) {
            buyerChance += 30;
            modifiers.push({
                type: 'trade_bonus',
                description: 'Trade settlement bonus',
                amount: 30
            });
        }

        // Cap at 100%
        const cappedChance = Math.min(buyerChance, 100);

        logger.logCalculation(
            'Buyer Availability Chance',
            'Size × 10 + Trade Bonus',
            {
                settlementName: settlementInfo.name,
                sizeRating: settlementInfo.sizeNumeric,
                baseChance: settlementInfo.sizeNumeric * 10,
                tradeBonus: settlementInfo.productionCategories.includes('Trade') ? 30 : 0,
                totalChance: buyerChance,
                cappedChance: cappedChance,
                modifiers: modifiers
            },
            cappedChance,
            `${settlementInfo.name} has ${cappedChance}% buyer availability chance`
        );

        // Perform buyer availability roll
        let roll, rollResult;
        
        if (rollFunction) {
            // Use provided roll function for testing
            roll = rollFunction();
            rollResult = { total: roll, formula: "1d100", result: roll.toString() };
        } else {
            // Use FoundryVTT dice roller if available
            if (typeof game !== 'undefined' && game.dice) {
                rollResult = await new Roll("1d100").evaluate();
                roll = rollResult.total;
            } else {
                // Fallback for testing environment
                roll = Math.floor(Math.random() * 100) + 1;
                rollResult = { total: roll, formula: "1d100", result: roll.toString() };
            }
        }
        
        const buyerFound = roll <= cappedChance;
        
        logger.logDiceRoll(
            'Buyer Availability Check',
            '1d100',
            modifiers,
            roll,
            cappedChance,
            buyerFound,
            buyerFound ? `${roll} ≤ ${cappedChance}` : `${roll} > ${cappedChance}`
        );

        logger.logDecision(
            'Buyer Search',
            buyerFound ? 'Buyer Found' : 'No Buyer Found',
            {
                roll: roll,
                chance: cappedChance,
                settlement: settlementInfo.name,
                cargoType: cargoType,
                formula: 'Size × 10 + Trade Bonus'
            },
            ['Buyer Found', 'No Buyer Found'],
            `Roll of ${roll} ${buyerFound ? 'succeeded against' : 'failed against'} target of ${cappedChance}`
        );

        return {
            buyerFound: buyerFound,
            chance: cappedChance,
            roll: roll,
            rollResult: rollResult,
            modifiers: modifiers,
            settlement: settlementInfo.name,
            settlementInfo: settlementInfo,
            cargoType: cargoType,
            quantity: quantity
        };
    }

    /**
     * Handle special case for villages (Size 1 settlements)
     * @param {Object} settlement - Settlement object
     * @param {string} cargoType - Type of cargo being sold
     * @param {string} season - Current season
     * @param {number} quantity - Quantity in EP
     * @param {Function} rollFunction - Optional roll function for testing
     * @returns {Promise<Object>} - Village selling result
     */
    async handleVillageSelling(settlement, cargoType, season, quantity, rollFunction = null) {
        const logger = this.getLogger();
        
        logger.logAlgorithmStep(
            'WFRP Selling Algorithm',
            'Step 2 - Village Special Case',
            'Village Selling Restrictions',
            { 
                settlementName: settlement.name,
                cargoType: cargoType,
                season: season,
                quantity: quantity
            },
            'Death on the Reik Companion - Village Selling Rules'
        );

        const settlementInfo = this.dataManager.getSettlementProperties(settlement);
        
        // Check if this is a village (Size 1)
        if (settlementInfo.sizeNumeric !== 1) {
            return null; // Not a village, use normal rules
        }

        // Special case: Spring grain sales in villages
        if (season === 'Spring' && cargoType === 'Grain') {
            logger.logDecision(
                'Village Grain Sales',
                'Normal Demand Available',
                {
                    settlement: settlementInfo.name,
                    season: season,
                    cargoType: cargoType,
                    reason: 'Spring grain sales allowed in villages'
                },
                ['Normal Demand Available', 'Limited Demand Only', 'No Demand'],
                'Villages have normal demand for grain in Spring'
            );
            
            return null; // Use normal buyer finding rules
        }

        // For all other cases in villages: limited demand only
        // Roll 1d10 for maximum EP that can be sold
        let maxSellableEP;
        let rollResult;
        
        if (rollFunction) {
            maxSellableEP = rollFunction() % 10 + 1; // Convert d100 to d10
            rollResult = { total: maxSellableEP, formula: "1d10", result: maxSellableEP.toString() };
        } else {
            if (typeof game !== 'undefined' && game.dice) {
                rollResult = await new Roll("1d10").evaluate();
                maxSellableEP = rollResult.total;
            } else {
                maxSellableEP = Math.floor(Math.random() * 10) + 1;
                rollResult = { total: maxSellableEP, formula: "1d10", result: maxSellableEP.toString() };
            }
        }

        logger.logDiceRoll(
            'Village Demand Limit',
            '1d10',
            [],
            maxSellableEP,
            null,
            true,
            `Village can purchase maximum ${maxSellableEP} EP of ${cargoType}`
        );

        const canSellQuantity = Math.min(quantity, maxSellableEP);
        const hasLimitedDemand = maxSellableEP > 0;

        logger.logDecision(
            'Village Limited Demand',
            hasLimitedDemand ? 'Limited Buyer Found' : 'No Buyer Found',
            {
                settlement: settlementInfo.name,
                cargoType: cargoType,
                requestedQuantity: quantity,
                maxSellableEP: maxSellableEP,
                canSellQuantity: canSellQuantity,
                season: season
            },
            ['Limited Buyer Found', 'No Buyer Found'],
            `Village has limited demand: can sell ${canSellQuantity} EP of ${quantity} EP requested`
        );

        return {
            buyerFound: hasLimitedDemand,
            isVillageSpecialCase: true,
            maxSellableEP: maxSellableEP,
            canSellQuantity: canSellQuantity,
            rollResult: rollResult,
            settlement: settlementInfo.name,
            settlementInfo: settlementInfo,
            cargoType: cargoType,
            quantity: quantity,
            season: season
        };
    }

    /**
     * Step 3: Calculate offer price with wealth modifiers
     * @param {string} cargoType - Type of cargo
     * @param {Object} settlement - Settlement object
     * @param {string} season - Current season
     * @param {number} quantity - Quantity in EP
     * @param {Object} options - Price calculation options
     * @returns {Object} - Offer price calculation result
     */
    calculateOfferPrice(cargoType, settlement, season, quantity, options = {}) {
        const logger = this.getLogger();
        
        logger.logAlgorithmStep(
            'WFRP Selling Algorithm',
            'Step 3',
            'Offer Price Calculation',
            { 
                cargoType: cargoType,
                settlementName: settlement.name,
                season: season,
                quantity: quantity
            },
            'Death on the Reik Companion - Selling Algorithm Step 3'
        );

        if (!cargoType || !season) {
            throw new Error('Cargo type and season are required for price calculation');
        }

        const settlementInfo = this.dataManager.getSettlementProperties(settlement);

        // Get cargo object
        const cargo = this.dataManager.cargoTypes.find(c => c.name === cargoType);
        if (!cargo) {
            throw new Error(`Cargo type not found: ${cargoType}`);
        }

        // Calculate base seasonal price
        const quality = options.quality || 'average';
        const basePrice = this.dataManager.getSeasonalPrice(cargo, season, quality);
        
        logger.logCalculation(
            'Base Seasonal Price',
            'Cargo Base Price for Season',
            {
                cargoType: cargoType,
                season: season,
                quality: quality,
                basePrices: cargo.basePrices
            },
            basePrice,
            `Base price for ${cargoType} in ${season} (${quality} quality)`
        );

        // Apply wealth modifier to base price
        const wealthModifier = settlementInfo.wealthModifier;
        const adjustedPrice = Math.round((basePrice * wealthModifier) * 100) / 100;

        logger.logCalculation(
            'Wealth-Adjusted Offer Price',
            'Base Price × Wealth Modifier',
            {
                settlementName: settlementInfo.name,
                wealthRating: settlementInfo.wealthRating,
                wealthDescription: settlementInfo.wealthDescription,
                wealthModifier: wealthModifier,
                basePrice: basePrice,
                adjustedPrice: adjustedPrice
            },
            adjustedPrice,
            `${basePrice} GC × ${wealthModifier} = ${adjustedPrice} GC per 10 EP`
        );

        // Calculate total offer based on quantity
        const totalUnits = Math.ceil(quantity / 10); // Convert EP to 10-EP units
        const totalOffer = Math.round((adjustedPrice * totalUnits) * 100) / 100;

        logger.logCalculation(
            'Total Offer Price',
            'Price per 10 EP × Units',
            {
                cargoType: cargoType,
                quantity: quantity,
                totalUnits: totalUnits,
                pricePerTenEP: adjustedPrice,
                wealthModifier: wealthModifier
            },
            totalOffer,
            `${totalUnits} units × ${adjustedPrice} GC = ${totalOffer} GC`
        );

        return {
            cargoType: cargoType,
            season: season,
            quality: quality,
            quantity: quantity,
            totalUnits: totalUnits,
            basePricePerTenEP: basePrice,
            wealthModifier: wealthModifier,
            adjustedPricePerTenEP: adjustedPrice,
            totalOffer: totalOffer,
            settlement: settlementInfo.name,
            settlementInfo: settlementInfo,
            encumbrancePerUnit: cargo.encumbrancePerUnit || 1
        };
    }

    /**
     * Step 4: Apply haggling result to offer price
     * @param {Object} offerCalculation - Base offer calculation result
     * @param {Object} haggleResult - Haggle test result
     * @returns {Object} - Updated offer calculation with haggling applied
     */
    applyHaggling(offerCalculation, haggleResult) {
        const logger = this.getLogger();
        
        if (!haggleResult || typeof haggleResult.success !== 'boolean') {
            throw new Error('Invalid haggle result object');
        }

        logger.logAlgorithmStep(
            'WFRP Selling Algorithm',
            'Step 4',
            'Price Negotiation (Haggling)',
            { 
                originalOffer: offerCalculation.totalOffer,
                haggleSuccess: haggleResult.success,
                hasDealmakertTalent: haggleResult.hasDealmakertTalent
            },
            'Death on the Reik Companion - Haggling Rules'
        );

        let haggleModifier = 0;
        let haggleDescription = '';

        if (haggleResult.success) {
            // Successful haggle increases offer price by 10% (or 20% with Dealmaker talent)
            const percentage = haggleResult.hasDealmakertTalent ? 20 : 10;
            haggleModifier = offerCalculation.adjustedPricePerTenEP * (percentage / 100);
            haggleDescription = haggleResult.hasDealmakertTalent 
                ? 'Successful haggle with Dealmaker (+20%)'
                : 'Successful haggle (+10%)';
                
            logger.logDecision(
                'Haggling Outcome',
                'Price Increased',
                {
                    success: true,
                    hasDealmakertTalent: haggleResult.hasDealmakertTalent,
                    percentage: percentage,
                    increase: haggleModifier
                },
                ['Price Increased', 'No Change', 'Price Decreased'],
                haggleDescription
            );
        } else {
            // Failed haggle - no penalty by default (GM discretion)
            haggleModifier = 0;
            haggleDescription = 'Failed haggle (no penalty)';
            
            logger.logDecision(
                'Haggling Outcome',
                'No Price Change',
                {
                    success: false,
                    penalty: false
                },
                ['Price Increased', 'No Change', 'Price Decreased'],
                'Failed haggle with no penalty applied'
            );
        }

        // Apply haggle modifier
        const newPricePerTenEP = Math.round((offerCalculation.adjustedPricePerTenEP + haggleModifier) * 100) / 100;
        const newTotalOffer = Math.round((newPricePerTenEP * offerCalculation.totalUnits) * 100) / 100;

        logger.logCalculation(
            'Final Haggled Offer',
            'Adjusted Price + Haggle Modifier',
            {
                originalPricePerTenEP: offerCalculation.adjustedPricePerTenEP,
                haggleModifier: haggleModifier,
                newPricePerTenEP: newPricePerTenEP,
                totalUnits: offerCalculation.totalUnits,
                originalTotal: offerCalculation.totalOffer,
                newTotal: newTotalOffer
            },
            newTotalOffer,
            `Final offer after haggling: ${newTotalOffer} GC`
        );

        return {
            ...offerCalculation,
            adjustedPricePerTenEP: newPricePerTenEP,
            totalOffer: newTotalOffer,
            haggleModifier: haggleModifier,
            haggleDescription: haggleDescription,
            haggleResult: haggleResult
        };
    }

    /**
     * Handle desperate sales (half base price at any Trade settlement)
     * @param {Object} settlement - Settlement object
     * @param {string} cargoType - Type of cargo
     * @param {string} season - Current season
     * @param {number} quantity - Quantity in EP
     * @param {Object} options - Sale options
     * @returns {Object} - Desperate sale result
     */
    handleDesperateSale(settlement, cargoType, season, quantity, options = {}) {
        const logger = this.getLogger();
        
        logger.logAlgorithmStep(
            'WFRP Selling Algorithm',
            'Desperate Sale',
            'Emergency Cargo Sale',
            { 
                settlementName: settlement.name,
                cargoType: cargoType,
                season: season,
                quantity: quantity
            },
            'Death on the Reik Companion - Desperate Sale Rules'
        );

        const settlementInfo = this.dataManager.getSettlementProperties(settlement);

        // Check if settlement is a trade center
        if (!settlementInfo.productionCategories.includes('Trade')) {
            logger.logDecision(
                'Desperate Sale Eligibility',
                'Not Available',
                {
                    settlement: settlementInfo.name,
                    productionCategories: settlementInfo.productionCategories,
                    reason: 'Settlement is not a Trade center'
                },
                ['Available', 'Not Available'],
                'Desperate sales only available at Trade settlements'
            );
            
            return {
                available: false,
                reason: 'Settlement is not a Trade center',
                settlement: settlementInfo.name
            };
        }

        // Get cargo object
        const cargo = this.dataManager.cargoTypes.find(c => c.name === cargoType);
        if (!cargo) {
            throw new Error(`Cargo type not found: ${cargoType}`);
        }

        // Calculate desperate sale price (50% of base price)
        const quality = options.quality || 'average';
        const basePrice = this.dataManager.getSeasonalPrice(cargo, season, quality);
        const desperatePrice = Math.round((basePrice * 0.5) * 100) / 100;

        logger.logCalculation(
            'Desperate Sale Price',
            'Base Price × 0.5',
            {
                cargoType: cargoType,
                season: season,
                quality: quality,
                basePrice: basePrice,
                desperatePrice: desperatePrice
            },
            desperatePrice,
            `Desperate sale: ${basePrice} GC × 0.5 = ${desperatePrice} GC per 10 EP`
        );

        // Calculate total desperate sale value
        const totalUnits = Math.ceil(quantity / 10);
        const totalValue = Math.round((desperatePrice * totalUnits) * 100) / 100;

        logger.logCalculation(
            'Total Desperate Sale Value',
            'Desperate Price × Units',
            {
                cargoType: cargoType,
                quantity: quantity,
                totalUnits: totalUnits,
                desperatePrice: desperatePrice
            },
            totalValue,
            `${totalUnits} units × ${desperatePrice} GC = ${totalValue} GC`
        );

        logger.logDecision(
            'Desperate Sale',
            'Sale Completed',
            {
                settlement: settlementInfo.name,
                cargoType: cargoType,
                quantity: quantity,
                totalValue: totalValue,
                priceReduction: '50% of base price'
            },
            ['Sale Completed', 'Sale Refused'],
            `Desperate sale completed at ${settlementInfo.name} for ${totalValue} GC`
        );

        return {
            available: true,
            cargoType: cargoType,
            season: season,
            quality: quality,
            quantity: quantity,
            totalUnits: totalUnits,
            basePricePerTenEP: basePrice,
            desperatePricePerTenEP: desperatePrice,
            totalValue: totalValue,
            settlement: settlementInfo.name,
            settlementInfo: settlementInfo,
            saleType: 'desperate'
        };
    }

    /**
     * Handle rumor sales (double base price at rumored locations)
     * @param {Object} settlement - Settlement object
     * @param {string} cargoType - Type of cargo
     * @param {string} season - Current season
     * @param {number} quantity - Quantity in EP
     * @param {Object} rumorInfo - Rumor information
     * @param {Object} options - Sale options
     * @returns {Object} - Rumor sale result
     */
    handleRumorSale(settlement, cargoType, season, quantity, rumorInfo, options = {}) {
        const logger = this.getLogger();
        
        logger.logAlgorithmStep(
            'WFRP Selling Algorithm',
            'Rumor Sale',
            'High-Demand Cargo Sale',
            { 
                settlementName: settlement.name,
                cargoType: cargoType,
                season: season,
                quantity: quantity,
                rumorInfo: rumorInfo
            },
            'Death on the Reik Companion - Rumor Sale Rules'
        );

        const settlementInfo = this.dataManager.getSettlementProperties(settlement);

        // Validate rumor information
        if (!rumorInfo || !rumorInfo.isValid) {
            logger.logDecision(
                'Rumor Sale Eligibility',
                'Not Available',
                {
                    settlement: settlementInfo.name,
                    cargoType: cargoType,
                    reason: 'No valid rumor information provided'
                },
                ['Available', 'Not Available'],
                'Rumor sales require valid rumor information'
            );
            
            return {
                available: false,
                reason: 'No valid rumor information provided',
                settlement: settlementInfo.name
            };
        }

        // Check if this settlement matches the rumor
        if (rumorInfo.settlementName !== settlement.name || rumorInfo.cargoType !== cargoType) {
            logger.logDecision(
                'Rumor Sale Eligibility',
                'Not Available',
                {
                    settlement: settlementInfo.name,
                    cargoType: cargoType,
                    rumorSettlement: rumorInfo.settlementName,
                    rumorCargoType: rumorInfo.cargoType,
                    reason: 'Settlement or cargo type does not match rumor'
                },
                ['Available', 'Not Available'],
                'Rumor does not apply to this settlement/cargo combination'
            );
            
            return {
                available: false,
                reason: 'Settlement or cargo type does not match rumor',
                settlement: settlementInfo.name,
                rumorInfo: rumorInfo
            };
        }

        // Get cargo object
        const cargo = this.dataManager.cargoTypes.find(c => c.name === cargoType);
        if (!cargo) {
            throw new Error(`Cargo type not found: ${cargoType}`);
        }

        // Calculate rumor sale price (double base price)
        const quality = options.quality || 'average';
        const basePrice = this.dataManager.getSeasonalPrice(cargo, season, quality);
        const rumorPrice = Math.round((basePrice * 2.0) * 100) / 100;

        logger.logCalculation(
            'Rumor Sale Price',
            'Base Price × 2.0',
            {
                cargoType: cargoType,
                season: season,
                quality: quality,
                basePrice: basePrice,
                rumorPrice: rumorPrice,
                rumorSource: rumorInfo.source
            },
            rumorPrice,
            `Rumor sale: ${basePrice} GC × 2.0 = ${rumorPrice} GC per 10 EP`
        );

        // Calculate total rumor sale value
        const totalUnits = Math.ceil(quantity / 10);
        const totalValue = Math.round((rumorPrice * totalUnits) * 100) / 100;

        logger.logCalculation(
            'Total Rumor Sale Value',
            'Rumor Price × Units',
            {
                cargoType: cargoType,
                quantity: quantity,
                totalUnits: totalUnits,
                rumorPrice: rumorPrice
            },
            totalValue,
            `${totalUnits} units × ${rumorPrice} GC = ${totalValue} GC`
        );

        logger.logDecision(
            'Rumor Sale',
            'Sale Completed',
            {
                settlement: settlementInfo.name,
                cargoType: cargoType,
                quantity: quantity,
                totalValue: totalValue,
                priceBonus: 'Double base price',
                rumorSource: rumorInfo.source
            },
            ['Sale Completed', 'Sale Refused'],
            `Rumor sale completed at ${settlementInfo.name} for ${totalValue} GC (double price)`
        );

        return {
            available: true,
            cargoType: cargoType,
            season: season,
            quality: quality,
            quantity: quantity,
            totalUnits: totalUnits,
            basePricePerTenEP: basePrice,
            rumorPricePerTenEP: rumorPrice,
            totalValue: totalValue,
            settlement: settlementInfo.name,
            settlementInfo: settlementInfo,
            rumorInfo: rumorInfo,
            saleType: 'rumor'
        };
    }

    /**
     * Complete selling algorithm workflow
     * Executes all steps of the WFRP selling algorithm in sequence
     * @param {Object} settlement - Settlement object
     * @param {string} cargoType - Type of cargo being sold
     * @param {number} quantity - Quantity in EP
     * @param {string} season - Current season
     * @param {Object} options - Algorithm options
     * @returns {Promise<Object>} - Complete selling algorithm result
     */
    async executeSellingAlgorithm(settlement, cargoType, quantity, season, options = {}) {
        const logger = this.getLogger();
        
        logger.logAlgorithmStep(
            'WFRP Selling Algorithm',
            'Complete Workflow',
            'Execute Full Selling Algorithm',
            { 
                settlementName: settlement.name,
                cargoType: cargoType,
                quantity: quantity,
                season: season,
                options: options
            },
            'Death on the Reik Companion - Complete Selling Algorithm'
        );

        try {
            const result = {
                settlement: settlement.name,
                cargoType: cargoType,
                quantity: quantity,
                season: season,
                timestamp: new Date().toISOString()
            };

            // Step 1: Check selling eligibility
            const eligibilityResult = this.checkSellingEligibility(settlement, cargoType, options.cargoHistory);
            result.eligibility = eligibilityResult;

            if (!eligibilityResult.canSell) {
                result.success = false;
                result.reason = 'Selling restrictions apply';
                result.restrictions = eligibilityResult.restrictions;
                return result;
            }

            // Check for special sale types first
            if (options.saleType === 'desperate') {
                const desperateResult = this.handleDesperateSale(settlement, cargoType, season, quantity, options);
                result.success = desperateResult.available;
                result.saleType = 'desperate';
                result.desperateSale = desperateResult;
                return result;
            }

            if (options.saleType === 'rumor' && options.rumorInfo) {
                const rumorResult = this.handleRumorSale(settlement, cargoType, season, quantity, options.rumorInfo, options);
                result.success = rumorResult.available;
                result.saleType = 'rumor';
                result.rumorSale = rumorResult;
                return result;
            }

            // Step 2: Check for village special case
            const villageResult = await this.handleVillageSelling(settlement, cargoType, season, quantity, options.rollFunction);
            if (villageResult !== null) {
                result.villageSpecialCase = villageResult;
                if (!villageResult.buyerFound) {
                    result.success = false;
                    result.reason = 'No buyer found (village limited demand)';
                    return result;
                }
                // Continue with limited quantity for villages
                quantity = villageResult.canSellQuantity;
            }

            // Step 2: Find buyer (normal rules)
            const buyerResult = await this.findBuyer(settlement, cargoType, quantity, options.rollFunction);
            result.buyerSearch = buyerResult;

            if (!buyerResult.buyerFound) {
                result.success = false;
                result.reason = 'No buyer found';
                return result;
            }

            // Step 3: Calculate offer price
            const offerResult = this.calculateOfferPrice(cargoType, settlement, season, quantity, options);
            result.offerCalculation = offerResult;

            // Step 4: Apply haggling if provided
            if (options.haggleResult) {
                const finalOffer = this.applyHaggling(offerResult, options.haggleResult);
                result.finalOffer = finalOffer;
            } else {
                result.finalOffer = offerResult;
            }

            result.success = true;
            result.saleType = 'normal';
            
            logger.logSystem('Selling Algorithm', 'Complete workflow executed successfully', {
                settlement: settlement.name,
                cargoType: cargoType,
                quantity: quantity,
                finalValue: result.finalOffer.totalOffer,
                saleType: result.saleType
            });

            return result;

        } catch (error) {
            logger.logSystem('Selling Algorithm', 'Workflow execution failed', { 
                error: error.message,
                settlement: settlement.name,
                cargoType: cargoType
            }, 'ERROR');
            
            throw error;
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { WFRPSellingAlgorithm };
} else if (typeof window !== 'undefined') {
    window.WFRPSellingAlgorithm = WFRPSellingAlgorithm;
}