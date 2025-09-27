console.log('Trading Places | Loading buying-algorithm.js');

/**
 * Trading Places Module - WFRP Buying Algorithm Implementation
 * Implements the complete WFRP buying algorithm from official-algorithm.md
 */

/**
 * WFRP Buying Algorithm class implementing the official Death on the Reik Companion rules
 * Follows the German algorithm specification from official-algorithm.md
 */
class WFRPBuyingAlgorithm {
    constructor(dataManager, tradingEngine) {
        this.dataManager = dataManager;
        this.tradingEngine = tradingEngine;
        this.logger = null; // Will be set by integration
        this.randomCargoTables = null; // Will be loaded from datasets
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
     * Load random cargo tables from dataset
     * @returns {Promise<void>}
     */
    async loadRandomCargoTables() {
        try {
            if (typeof fetch !== 'undefined') {
                const response = await fetch('modules/trading-places/datasets/active/random-cargo-tables.json');
                this.randomCargoTables = await response.json();
                
                const logger = this.getLogger();
                logger.logSystem('Data Loading', 'Random cargo tables loaded successfully', {
                    seasons: Object.keys(this.randomCargoTables),
                    totalEntries: Object.values(this.randomCargoTables).reduce((sum, table) => sum + table.length, 0)
                });
            } else {
                throw new Error('loadRandomCargoTables requires FoundryVTT environment');
            }
        } catch (error) {
            const logger = this.getLogger();
            logger.logSystem('Data Loading', 'Failed to load random cargo tables', { error: error.message }, 'ERROR');
            throw error;
        }
    }

    /**
     * Step 0: Extract settlement information for buying algorithm
     * @param {Object} settlement - Settlement object
     * @returns {Object} - Extracted settlement information
     */
    extractSettlementInformation(settlement) {
        const logger = this.getLogger();
        
        if (!settlement) {
            throw new Error('Settlement object is required');
        }

        logger.logAlgorithmStep(
            'WFRP Buying Algorithm',
            'Step 0',
            'Settlement Information Extraction',
            { settlementName: settlement.name, settlementRegion: settlement.region },
            'Death on the Reik Companion - Buying Algorithm Step 0'
        );

        // Validate settlement has required fields
        const validation = this.dataManager.validateSettlement(settlement);
        if (!validation.valid) {
            throw new Error(`Invalid settlement: ${validation.errors.join(', ')}`);
        }

        // Extract and calculate settlement properties
        const properties = this.dataManager.getSettlementProperties(settlement);
        
        const settlementInfo = {
            name: properties.name,
            region: properties.region,
            sizeEnum: properties.sizeEnum,
            sizeRating: properties.sizeNumeric,
            sizeDescription: properties.sizeDescription,
            wealthRating: properties.wealthRating,
            wealthDescription: properties.wealthDescription,
            wealthModifier: properties.wealthModifier,
            population: properties.population,
            productionCategories: properties.productionCategories,
            garrison: properties.garrison,
            ruler: properties.ruler,
            notes: properties.notes,
            isTradeCenter: this.dataManager.isTradeSettlement(settlement)
        };

        logger.logSystem('Settlement Analysis', 'Settlement information extracted', {
            settlement: settlementInfo.name,
            sizeRating: settlementInfo.sizeRating,
            wealthRating: settlementInfo.wealthRating,
            productionCategories: settlementInfo.productionCategories,
            isTradeCenter: settlementInfo.isTradeCenter
        });

        return settlementInfo;
    }

    /**
     * Step 1: Check cargo availability using (Size + Wealth) × 10% formula
     * @param {Object} settlement - Settlement object
     * @param {Function} rollFunction - Optional roll function for testing (returns 1d100 result)
     * @returns {Promise<Object>} - Availability check result
     */
    async checkCargoAvailability(settlement, rollFunction = null) {
        const logger = this.getLogger();
        
        logger.logAlgorithmStep(
            'WFRP Buying Algorithm',
            'Step 1',
            'Cargo Availability Check',
            { settlementName: settlement.name },
            'Death on the Reik Companion - Buying Algorithm Step 1'
        );

        const settlementInfo = this.extractSettlementInformation(settlement);
        
        // Calculate base chance: (Size + Wealth) × 10%
        const baseChance = (settlementInfo.sizeRating + settlementInfo.wealthRating) * 10;
        const cappedChance = Math.min(baseChance, 100); // Cap at 100%
        
        logger.logCalculation(
            'Availability Chance',
            '(Size + Wealth) × 10',
            {
                settlementName: settlementInfo.name,
                sizeRating: settlementInfo.sizeRating,
                wealthRating: settlementInfo.wealthRating,
                calculation: `(${settlementInfo.sizeRating} + ${settlementInfo.wealthRating}) × 10`,
                rawChance: baseChance,
                cappedChance: cappedChance
            },
            cappedChance,
            `${settlementInfo.name} has ${cappedChance}% cargo availability chance`
        );

        // Perform availability roll
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
        
        const available = roll <= cappedChance;
        
        logger.logDiceRoll(
            'Cargo Availability Check',
            '1d100',
            [],
            roll,
            cappedChance,
            available,
            available ? `${roll} ≤ ${cappedChance}` : `${roll} > ${cappedChance}`
        );

        const result = {
            available: available,
            chance: cappedChance,
            roll: roll,
            rollResult: rollResult,
            settlement: settlementInfo.name,
            settlementInfo: settlementInfo
        };
        
        logger.logDecision(
            'Cargo Availability',
            available ? 'Cargo Available' : 'No Cargo Available',
            { 
                roll: roll, 
                chance: cappedChance, 
                settlement: settlementInfo.name,
                formula: '(Size + Wealth) × 10%'
            },
            ['Cargo Available', 'No Cargo Available'],
            `Roll of ${roll} ${available ? 'succeeded against' : 'failed against'} target of ${cappedChance}`
        );

        return result;
    }

    /**
     * Step 2A: Determine cargo type based on settlement production
     * @param {Object} settlement - Settlement object
     * @param {string} season - Current season
     * @returns {Promise<Object>} - Cargo type determination result
     */
    async determineCargoType(settlement, season) {
        const logger = this.getLogger();
        
        logger.logAlgorithmStep(
            'WFRP Buying Algorithm',
            'Step 2A',
            'Cargo Type Determination',
            { settlementName: settlement.name, season: season },
            'Death on the Reik Companion - Buying Algorithm Step 2A'
        );

        const settlementInfo = this.extractSettlementInformation(settlement);
        
        if (!season) {
            throw new Error('Season is required for cargo type determination');
        }

        // Ensure random cargo tables are loaded
        if (!this.randomCargoTables) {
            await this.loadRandomCargoTables();
        }

        let selectedCargo = null;
        let selectionMethod = null;
        let availableOptions = [];

        // Check production categories
        const productionCategories = settlementInfo.productionCategories;
        const specificGoods = productionCategories.filter(category => category !== 'Trade');
        const hasTrade = productionCategories.includes('Trade');

        logger.logSystem('Production Analysis', 'Analyzing settlement production', {
            settlement: settlementInfo.name,
            productionCategories: productionCategories,
            specificGoods: specificGoods,
            hasTrade: hasTrade
        });

        if (specificGoods.length > 0 && !hasTrade) {
            // Case 1: Settlement produces specific goods only (no Trade)
            selectionMethod = 'specific_goods_only';
            selectedCargo = specificGoods[0]; // Take first specific good
            availableOptions = specificGoods;
            
            logger.logDecision(
                'Cargo Type Selection',
                selectedCargo,
                {
                    method: selectionMethod,
                    productionCategories: productionCategories,
                    specificGoods: specificGoods
                },
                availableOptions,
                `Settlement produces specific goods only: ${specificGoods.join(', ')}`
            );
            
        } else if (hasTrade && specificGoods.length === 0) {
            // Case 2: Pure trade center (Trade only)
            selectionMethod = 'pure_trade_center';
            selectedCargo = await this.selectRandomTradeGood(season);
            availableOptions = this.getSeasonalCargoOptions(season);
            
            logger.logDecision(
                'Cargo Type Selection',
                selectedCargo,
                {
                    method: selectionMethod,
                    season: season,
                    productionCategories: productionCategories
                },
                availableOptions,
                `Pure trade center - selected random cargo for ${season} season`
            );
            
        } else if (hasTrade && specificGoods.length > 0) {
            // Case 3: Trade center with specific goods (special case)
            // According to algorithm: chance for TWO available cargos (local + random)
            selectionMethod = 'trade_center_with_goods';
            
            // For trade centers with specific goods, select random trade good instead of local good
            // This ensures we have a valid cargo type from our cargo tables
            selectedCargo = await this.selectRandomTradeGood(season);
            availableOptions = [...specificGoods, 'Random Trade Good'];
            
            logger.logDecision(
                'Cargo Type Selection',
                selectedCargo,
                {
                    method: selectionMethod,
                    season: season,
                    productionCategories: productionCategories,
                    specificGoods: specificGoods,
                    note: 'Trade center with specific goods - could offer multiple cargo types'
                },
                availableOptions,
                `Trade center with specific goods - selected local good: ${selectedCargo}`
            );
            
        } else {
            // Fallback case
            selectionMethod = 'fallback';
            selectedCargo = 'Grain'; // Default fallback
            availableOptions = ['Grain'];
            
            logger.logDecision(
                'Cargo Type Selection',
                selectedCargo,
                {
                    method: selectionMethod,
                    productionCategories: productionCategories,
                    warning: 'No valid production categories found'
                },
                availableOptions,
                'Fallback to default cargo type due to invalid production data'
            );
        }

        return {
            cargoType: selectedCargo,
            selectionMethod: selectionMethod,
            availableOptions: availableOptions,
            season: season,
            settlement: settlementInfo.name,
            productionCategories: productionCategories
        };
    }

    /**
     * Select random trade good for the given season
     * @param {string} season - Current season
     * @returns {Promise<string>} - Selected cargo type
     */
    async selectRandomTradeGood(season) {
        const logger = this.getLogger();
        
        if (!this.randomCargoTables || !this.randomCargoTables[season]) {
            throw new Error(`No random cargo table available for season: ${season}`);
        }

        // Roll 1d100 for random selection
        let roll;
        if (typeof game !== 'undefined' && game.dice) {
            const rollResult = await new Roll("1d100").evaluate();
            roll = rollResult.total;
        } else {
            // Fallback for testing environment
            roll = Math.floor(Math.random() * 100) + 1;
        }

        // Find cargo based on roll
        const seasonTable = this.randomCargoTables[season];
        let selectedCargo = null;

        for (const entry of seasonTable) {
            if (roll >= entry.range[0] && roll <= entry.range[1]) {
                selectedCargo = entry.cargo;
                break;
            }
        }

        if (!selectedCargo) {
            selectedCargo = seasonTable[0].cargo; // Fallback to first entry
        }

        logger.logDiceRoll(
            'Random Trade Cargo Selection',
            '1d100',
            [],
            roll,
            null,
            true,
            `Selected ${selectedCargo} from ${season} cargo table`
        );

        return selectedCargo;
    }

    /**
     * Get all possible cargo options for a season
     * @param {string} season - Season name
     * @returns {Array} - Array of cargo type names
     */
    getSeasonalCargoOptions(season) {
        if (!this.randomCargoTables || !this.randomCargoTables[season]) {
            return [];
        }

        return this.randomCargoTables[season].map(entry => entry.cargo);
    }

    /**
     * Step 2B: Calculate cargo size using (Size + Wealth) × d100 method
     * @param {Object} settlement - Settlement object
     * @param {Function} rollFunction - Optional roll function for testing
     * @returns {Promise<Object>} - Cargo size calculation result
     */
    async calculateCargoSize(settlement, rollFunction = null) {
        const logger = this.getLogger();
        
        logger.logAlgorithmStep(
            'WFRP Buying Algorithm',
            'Step 2B',
            'Cargo Size Calculation',
            { settlementName: settlement.name },
            'Death on the Reik Companion - Buying Algorithm Step 2B'
        );

        const settlementInfo = this.extractSettlementInformation(settlement);
        
        // Calculate base multiplier: Size + Wealth
        const baseMultiplier = settlementInfo.sizeRating + settlementInfo.wealthRating;
        
        logger.logCalculation(
            'Base Multiplier',
            'Size + Wealth',
            {
                settlementName: settlementInfo.name,
                sizeRating: settlementInfo.sizeRating,
                wealthRating: settlementInfo.wealthRating
            },
            baseMultiplier,
            `Base value for cargo size calculation`
        );

        // Roll 1d100 for size multiplier
        let roll1, roll1Result, roll2 = null, roll2Result = null;
        
        if (rollFunction) {
            // Use provided roll function for testing
            roll1 = rollFunction();
            roll1Result = { total: roll1, formula: "1d100", result: roll1.toString() };
        } else {
            // Use FoundryVTT dice roller if available
            if (typeof game !== 'undefined' && game.dice) {
                roll1Result = await new Roll("1d100").evaluate();
                roll1 = roll1Result.total;
            } else {
                // Fallback for testing environment
                roll1 = Math.floor(Math.random() * 100) + 1;
                roll1Result = { total: roll1, formula: "1d100", result: roll1.toString() };
            }
        }

        // Round up to nearest 10
        let sizeMultiplier = Math.ceil(roll1 / 10) * 10;
        let tradeBonus = false;

        logger.logDiceRoll(
            'Cargo Size Roll',
            '1d100',
            [],
            roll1,
            null,
            true,
            `Rolled ${roll1}, rounded up to ${sizeMultiplier}`
        );

        // Trade center bonus: roll twice, use higher multiplier
        if (settlementInfo.isTradeCenter) {
            tradeBonus = true;
            
            if (rollFunction) {
                roll2 = rollFunction();
                roll2Result = { total: roll2, formula: "1d100", result: roll2.toString() };
            } else {
                if (typeof game !== 'undefined' && game.dice) {
                    roll2Result = await new Roll("1d100").evaluate();
                    roll2 = roll2Result.total;
                } else {
                    roll2 = Math.floor(Math.random() * 100) + 1;
                    roll2Result = { total: roll2, formula: "1d100", result: roll2.toString() };
                }
            }
            
            const sizeMultiplier2 = Math.ceil(roll2 / 10) * 10;
            
            logger.logDiceRoll(
                'Trade Center Bonus Roll',
                '1d100',
                [],
                roll2,
                null,
                true,
                `Trade center bonus: rolled ${roll2}, rounded up to ${sizeMultiplier2}`
            );
            
            // Use higher multiplier
            if (sizeMultiplier2 > sizeMultiplier) {
                sizeMultiplier = sizeMultiplier2;
                
                logger.logDecision(
                    'Trade Center Multiplier Selection',
                    `Use second roll (${sizeMultiplier})`,
                    {
                        firstRoll: roll1,
                        firstMultiplier: Math.ceil(roll1 / 10) * 10,
                        secondRoll: roll2,
                        secondMultiplier: sizeMultiplier2
                    },
                    [`Use first roll (${Math.ceil(roll1 / 10) * 10})`, `Use second roll (${sizeMultiplier2})`],
                    `Second roll produced higher multiplier`
                );
            } else {
                logger.logDecision(
                    'Trade Center Multiplier Selection',
                    `Use first roll (${sizeMultiplier})`,
                    {
                        firstRoll: roll1,
                        firstMultiplier: sizeMultiplier,
                        secondRoll: roll2,
                        secondMultiplier: sizeMultiplier2
                    },
                    [`Use first roll (${sizeMultiplier})`, `Use second roll (${sizeMultiplier2})`],
                    `First roll produced higher multiplier`
                );
            }
        }

        // Calculate total cargo size
        const totalSize = baseMultiplier * sizeMultiplier;
        
        logger.logCalculation(
            'Total Cargo Size',
            'Base × Multiplier',
            {
                settlementName: settlementInfo.name,
                baseMultiplier: baseMultiplier,
                sizeMultiplier: sizeMultiplier,
                tradeBonus: tradeBonus,
                roll1: roll1,
                roll2: roll2
            },
            totalSize,
            `${baseMultiplier} × ${sizeMultiplier} = ${totalSize} EP`
        );

        return {
            totalSize: totalSize,
            baseMultiplier: baseMultiplier,
            sizeMultiplier: sizeMultiplier,
            roll1: roll1,
            roll1Result: roll1Result,
            roll2: roll2,
            roll2Result: roll2Result,
            tradeBonus: tradeBonus,
            settlement: settlementInfo.name,
            settlementInfo: settlementInfo
        };
    }

    /**
     * Step 3: Calculate base price and handle price negotiation
     * @param {string} cargoType - Type of cargo
     * @param {string} season - Current season
     * @param {number} quantity - Quantity in EP
     * @param {Object} options - Price calculation options
     * @returns {Object} - Price calculation result
     */
    calculateBasePrice(cargoType, season, quantity, options = {}) {
        const logger = this.getLogger();
        
        logger.logAlgorithmStep(
            'WFRP Buying Algorithm',
            'Step 3',
            'Price Calculation and Negotiation',
            { cargoType: cargoType, season: season, quantity: quantity },
            'Death on the Reik Companion - Buying Algorithm Step 3'
        );

        if (!cargoType || !season) {
            throw new Error('Cargo type and season are required for price calculation');
        }

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

        // Calculate price per 10 EP (standard WFRP unit)
        const pricePerTenEP = basePrice;
        let finalPricePerTenEP = pricePerTenEP;
        const modifiers = [];

        // Apply partial purchase penalty if not buying full available quantity
        if (options.isPartialPurchase) {
            const partialPenalty = pricePerTenEP * 0.1; // +10%
            finalPricePerTenEP += partialPenalty;
            modifiers.push({
                type: 'partial_purchase',
                description: 'Partial purchase penalty (+10%)',
                amount: partialPenalty,
                percentage: 10
            });
            
            logger.logCalculation(
                'Partial Purchase Penalty',
                'Base Price × 1.1',
                {
                    basePrice: pricePerTenEP,
                    penalty: partialPenalty,
                    reason: 'Not purchasing full available quantity'
                },
                finalPricePerTenEP,
                'Applied 10% penalty for partial purchase'
            );
        }

        // Calculate total price based on quantity
        const totalUnits = Math.ceil(quantity / 10); // Convert EP to 10-EP units
        const totalPrice = finalPricePerTenEP * totalUnits;

        logger.logCalculation(
            'Total Purchase Price',
            'Price per 10 EP × Units',
            {
                cargoType: cargoType,
                quantity: quantity,
                totalUnits: totalUnits,
                pricePerTenEP: finalPricePerTenEP,
                modifiers: modifiers
            },
            totalPrice,
            `${totalUnits} units × ${finalPricePerTenEP} GC = ${totalPrice} GC`
        );

        return {
            cargoType: cargoType,
            season: season,
            quality: quality,
            quantity: quantity,
            totalUnits: totalUnits,
            basePricePerTenEP: pricePerTenEP,
            finalPricePerTenEP: finalPricePerTenEP,
            totalPrice: totalPrice,
            modifiers: modifiers,
            encumbrancePerUnit: cargo.encumbrancePerUnit || 1
        };
    }

    /**
     * Apply haggling result to price calculation
     * @param {Object} priceCalculation - Base price calculation result
     * @param {Object} haggleResult - Haggle test result
     * @returns {Object} - Updated price calculation with haggling applied
     */
    applyHaggling(priceCalculation, haggleResult) {
        const logger = this.getLogger();
        
        if (!haggleResult || typeof haggleResult.success !== 'boolean') {
            throw new Error('Invalid haggle result object');
        }

        logger.logAlgorithmStep(
            'WFRP Buying Algorithm',
            'Step 3 - Haggling',
            'Price Negotiation',
            { 
                originalPrice: priceCalculation.totalPrice,
                haggleSuccess: haggleResult.success,
                hasDealmakertTalent: haggleResult.hasDealmakertTalent
            },
            'Death on the Reik Companion - Haggling Rules'
        );

        let haggleModifier = 0;
        let haggleDescription = '';

        if (haggleResult.success) {
            // Successful haggle reduces price by 10% (or 20% with Dealmaker talent)
            const percentage = haggleResult.hasDealmakertTalent ? -20 : -10;
            haggleModifier = priceCalculation.finalPricePerTenEP * (percentage / 100);
            haggleDescription = haggleResult.hasDealmakertTalent 
                ? 'Successful haggle with Dealmaker (-20%)'
                : 'Successful haggle (-10%)';
                
            logger.logDecision(
                'Haggling Outcome',
                'Price Reduced',
                {
                    success: true,
                    hasDealmakertTalent: haggleResult.hasDealmakertTalent,
                    percentage: percentage,
                    reduction: Math.abs(haggleModifier)
                },
                ['Price Reduced', 'No Change', 'Price Increased'],
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
                ['Price Reduced', 'No Change', 'Price Increased'],
                'Failed haggle with no penalty applied'
            );
        }

        // Apply haggle modifier
        const newPricePerTenEP = Math.round((priceCalculation.finalPricePerTenEP + haggleModifier) * 100) / 100;
        const newTotalPrice = Math.round((newPricePerTenEP * priceCalculation.totalUnits) * 100) / 100;
        
        // Add haggle modifier to modifiers list
        const updatedModifiers = [...priceCalculation.modifiers, {
            type: 'haggle',
            description: haggleDescription,
            amount: haggleModifier,
            percentage: haggleResult.success ? (haggleResult.hasDealmakertTalent ? -20 : -10) : 0
        }];

        logger.logCalculation(
            'Final Haggled Price',
            'Base Price + Haggle Modifier',
            {
                originalPricePerTenEP: priceCalculation.finalPricePerTenEP,
                haggleModifier: haggleModifier,
                newPricePerTenEP: newPricePerTenEP,
                totalUnits: priceCalculation.totalUnits,
                originalTotal: priceCalculation.totalPrice,
                newTotal: newTotalPrice
            },
            newTotalPrice,
            `Final price after haggling: ${newTotalPrice} GC`
        );

        return {
            ...priceCalculation,
            finalPricePerTenEP: newPricePerTenEP,
            totalPrice: newTotalPrice,
            modifiers: updatedModifiers,
            haggleResult: haggleResult
        };
    }

    /**
     * Complete buying algorithm workflow
     * Executes all steps of the WFRP buying algorithm in sequence
     * @param {Object} settlement - Settlement object
     * @param {string} season - Current season
     * @param {Object} options - Algorithm options
     * @returns {Promise<Object>} - Complete buying algorithm result
     */
    async executeBuyingAlgorithm(settlement, season, options = {}) {
        const logger = this.getLogger();
        
        logger.logAlgorithmStep(
            'WFRP Buying Algorithm',
            'Complete Workflow',
            'Execute Full Buying Algorithm',
            { 
                settlementName: settlement.name,
                season: season,
                options: options
            },
            'Death on the Reik Companion - Complete Buying Algorithm'
        );

        try {
            // Step 0: Extract settlement information
            const settlementInfo = this.extractSettlementInformation(settlement);
            
            // Step 1: Check cargo availability
            const availabilityResult = await this.checkCargoAvailability(settlement, options.rollFunction);
            
            if (!availabilityResult.available) {
                logger.logSystem('Algorithm Completion', 'No cargo available at settlement', {
                    settlement: settlement.name,
                    availabilityChance: availabilityResult.chance,
                    roll: availabilityResult.roll
                });
                
                return {
                    success: false,
                    reason: 'no_cargo_available',
                    availabilityResult: availabilityResult,
                    settlementInfo: settlementInfo
                };
            }

            // Step 2A: Determine cargo type
            const cargoTypeResult = await this.determineCargoType(settlement, season);
            
            // Step 2B: Calculate cargo size
            const cargoSizeResult = await this.calculateCargoSize(settlement, options.rollFunction);
            
            // Step 3: Calculate base price
            const priceOptions = {
                quality: options.quality || 'average',
                isPartialPurchase: options.isPartialPurchase || false
            };
            
            const priceResult = this.calculateBasePrice(
                cargoTypeResult.cargoType,
                season,
                cargoSizeResult.totalSize,
                priceOptions
            );

            // Apply haggling if provided
            let finalPriceResult = priceResult;
            if (options.haggleResult) {
                finalPriceResult = this.applyHaggling(priceResult, options.haggleResult);
            }

            const completeResult = {
                success: true,
                settlementInfo: settlementInfo,
                availabilityResult: availabilityResult,
                cargoTypeResult: cargoTypeResult,
                cargoSizeResult: cargoSizeResult,
                priceResult: finalPriceResult,
                summary: {
                    settlement: settlement.name,
                    season: season,
                    cargoType: cargoTypeResult.cargoType,
                    quantity: cargoSizeResult.totalSize,
                    totalPrice: finalPriceResult.totalPrice,
                    pricePerTenEP: finalPriceResult.finalPricePerTenEP
                }
            };

            logger.logSystem('Algorithm Completion', 'Buying algorithm completed successfully', {
                settlement: settlement.name,
                cargoType: cargoTypeResult.cargoType,
                quantity: cargoSizeResult.totalSize,
                totalPrice: finalPriceResult.totalPrice
            });

            return completeResult;

        } catch (error) {
            logger.logSystem('Algorithm Error', 'Buying algorithm failed', {
                settlement: settlement.name,
                season: season,
                error: error.message,
                stack: error.stack
            }, 'ERROR');
            
            throw error;
        }
    }

    /**
     * Validate inputs for buying algorithm
     * @param {Object} settlement - Settlement object
     * @param {string} season - Season name
     * @param {Object} options - Algorithm options
     * @returns {Object} - Validation result
     */
    validateBuyingInputs(settlement, season, options = {}) {
        const errors = [];

        // Validate settlement
        if (!settlement) {
            errors.push('Settlement object is required');
        } else {
            const settlementValidation = this.dataManager.validateSettlement(settlement);
            if (!settlementValidation.valid) {
                errors.push(`Invalid settlement: ${settlementValidation.errors.join(', ')}`);
            }
        }

        // Validate season
        const validSeasons = ['spring', 'summer', 'autumn', 'winter'];
        if (!season || !validSeasons.includes(season)) {
            errors.push(`Invalid season: ${season}. Must be one of: ${validSeasons.join(', ')}`);
        }

        // Validate quality if provided
        if (options.quality) {
            // This would need to be validated against specific cargo types
            // For now, just check it's a string
            if (typeof options.quality !== 'string') {
                errors.push('Quality must be a string');
            }
        }

        // Validate haggle result if provided
        if (options.haggleResult) {
            if (typeof options.haggleResult.success !== 'boolean') {
                errors.push('Haggle result must have a boolean success property');
            }
        }

        return {
            valid: errors.length === 0,
            errors: errors
        };
    }
}

// Make the class available globally
if (typeof window !== 'undefined') {
    window.WFRPBuyingAlgorithm = WFRPBuyingAlgorithm;
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = WFRPBuyingAlgorithm;
}