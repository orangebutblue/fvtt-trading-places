/**
 * Trading Places Module - Merchant Generator
 * Implements population-based merchant generation with skill distribution and personality profiles
 */

console.log('Trading Places | Loading merchant-generator.js');

/**
 * Merchant Generator class for orange-realism merchant system
 */
class MerchantGenerator {
    constructor(dataManager, tradingConfig) {
        this.dataManager = dataManager;
        this.config = tradingConfig;
        this.logger = null;
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
        
        return {
            logSystem: () => {},
            logCalculation: () => {},
            logDecision: () => {},
            logAlgorithmStep: () => {}
        };
    }

    /**
     * Calculate merchant slot count for a settlement
     * @param {Object} settlement - Settlement object
     * @returns {Object} - Merchant count breakdown
     */
    calculateMerchantSlots(settlement) {
        const logger = this.getLogger();
        const config = this.config.merchantCount;
        
        logger.logCalculation('Merchant Slots', 'Starting calculation', {
            settlement: settlement.name,
            population: settlement.population,
            size: settlement.size,
            flags: settlement.flags
        });

        // Base slots from size
        const sizeIndex = Math.max(0, Math.min(4, settlement.size - 1));
        const baseSlots = config.minSlotsPerSize[sizeIndex];
        
        // Population bonus
        const populationBonus = Math.floor(settlement.population * config.populationMultiplier);
        
        // Size multiplier
        const sizeBonus = Math.floor(settlement.size * config.sizeMultiplier);
        
        // Calculate base total
        let totalSlots = baseSlots + populationBonus + sizeBonus;
        
        // Apply flag multipliers
        let flagMultiplier = 1.0;
        if (settlement.flags && Array.isArray(settlement.flags)) {
            settlement.flags.forEach(flag => {
                if (config.flagMultipliers[flag]) {
                    flagMultiplier *= config.flagMultipliers[flag];
                    logger.logCalculation('Flag Multiplier', `Applied ${flag}`, {
                        flag,
                        multiplier: config.flagMultipliers[flag],
                        totalMultiplier: flagMultiplier
                    });
                }
            });
        }
        
        totalSlots = Math.floor(totalSlots * flagMultiplier);
        
        // Apply hard cap
        totalSlots = Math.min(totalSlots, config.hardCap);
        
        const result = {
            baseSlots,
            populationBonus,
            sizeBonus,
            flagMultiplier,
            totalSlots,
            breakdown: {
                base: baseSlots,
                population: populationBonus,
                size: sizeBonus,
                flagMultiplier: flagMultiplier,
                capped: totalSlots
            }
        };

        logger.logCalculation('Merchant Slots', 'Calculation complete', result);
        return result;
    }

    /**
     * Generate skill level for a merchant
     * @param {Object} settlement - Settlement object
     * @param {number} percentile - Random percentile (0-100)
     * @returns {number} - Skill level
     */
    generateMerchantSkill(settlement, percentile = null) {
        const config = this.config.skillDistribution;
        const logger = this.getLogger();
        
        // Use provided percentile or generate random one
        if (percentile === null) {
            percentile = Math.random() * 100;
        }
        
        // Base skill from wealth
        const wealthBonus = (settlement.wealth - 1) * config.wealthModifier;
        let skill = config.baseSkill + wealthBonus;
        
        // Apply percentile-based variance
        let percentileModifier = 0;
        const table = config.percentileTable;
        
        // Find the appropriate percentile bracket
        if (percentile >= 99) {
            percentileModifier = table["99"];
        } else if (percentile >= 95) {
            percentileModifier = table["95"];
        } else if (percentile >= 90) {
            percentileModifier = table["90"];
        } else if (percentile >= 75) {
            percentileModifier = table["75"];
        } else if (percentile >= 50) {
            percentileModifier = table["50"];
        } else if (percentile >= 25) {
            percentileModifier = table["25"];
        } else {
            percentileModifier = table["10"];
        }
        
        skill += percentileModifier;
        
        // Apply random variance
        const variance = (Math.random() - 0.5) * config.variance;
        skill += variance;
        
        // Clamp to valid range
        skill = Math.max(config.minSkill, Math.min(config.maxSkill, Math.round(skill)));
        
        logger.logCalculation('Merchant Skill', 'Generated skill', {
            settlement: settlement.name,
            wealth: settlement.wealth,
            percentile,
            baseSkill: config.baseSkill,
            wealthBonus,
            percentileModifier,
            variance,
            finalSkill: skill
        });
        
        return skill;
    }

    /**
     * Assign personality profile to a merchant
     * @param {number} roll - Random roll (0-100)
     * @returns {Object} - Personality profile
     */
    assignPersonalityProfile(roll = null) {
        const config = this.config.merchantPersonalities;
        const weights = config.distributionWeights;
        
        if (roll === null) {
            roll = Math.random() * 100;
        }
        
        // Convert weights to cumulative percentages
        const total = Object.values(weights).reduce((sum, weight) => sum + weight, 0);
        let cumulative = 0;
        
        for (const [profileName, weight] of Object.entries(weights)) {
            cumulative += (weight / total) * 100;
            if (roll <= cumulative) {
                const profile = profileName === 'defaultProfile' ? 
                    config.defaultProfile : 
                    config.profiles[profileName];
                
                return {
                    profileName,
                    ...profile
                };
            }
        }
        
        // Fallback to default
        return {
            profileName: 'defaultProfile',
            ...config.defaultProfile
        };
    }

    /**
     * Generate a complete merchant object
     * @param {Object} settlement - Settlement object
     * @param {string} cargoType - Type of cargo merchant deals in
     * @param {string} merchantType - 'producer' or 'seeker'
     * @param {Object} equilibrium - Supply/demand equilibrium data
     * @returns {Object} - Complete merchant object
     */
    generateMerchant(settlement, cargoType, merchantType, equilibrium) {
        const logger = this.getLogger();
        const merchantId = this.generateMerchantId(settlement, cargoType, merchantType);
        
        logger.logAlgorithmStep('Merchant Generation', `Generating ${merchantType}`, {
            settlement: settlement.name,
            cargoType,
            merchantType,
            equilibrium
        });

        // Generate core attributes
        const skill = this.generateMerchantSkill(settlement);
        const personality = this.assignPersonalityProfile();
        
        // Calculate quantities and prices based on equilibrium
        const quantity = this.calculateMerchantQuantity(settlement, cargoType, merchantType, equilibrium);
        const basePrice = this.calculateBasePrice(cargoType, settlement);
        const price = this.applyPriceModifiers(basePrice, settlement, equilibrium, personality);
        
        // Create merchant object
        const merchant = {
            id: merchantId,
            type: merchantType,
            settlement: {
                name: settlement.name,
                region: settlement.region,
                size: settlement.size,
                wealth: settlement.wealth
            },
            cargoType,
            skill,
            quantity,
            basePrice,
            finalPrice: price,
            personality,
            equilibrium: {
                supply: equilibrium.supply,
                demand: equilibrium.demand,
                ratio: equilibrium.supply / equilibrium.demand
            },
            availability: {
                isAvailable: false,
                rollRequired: true,
                desperation: {
                    available: false,
                    penaltiesApplied: false
                }
            },
            specialBehaviors: this.getSpecialBehaviors(settlement),
            metadata: {
                generated: new Date().toISOString(),
                generatorVersion: '3.0.0'
            }
        };

        logger.logAlgorithmStep('Merchant Generation', 'Merchant generated', {
            merchantId,
            skill,
            quantity,
            price,
            personality: personality.profileName
        });

        return merchant;
    }

    /**
     * Generate unique merchant ID
     * @param {Object} settlement - Settlement object
     * @param {string} cargoType - Cargo type
     * @param {string} merchantType - Merchant type
     * @returns {string} - Unique merchant ID
     */
    generateMerchantId(settlement, cargoType, merchantType) {
        const timestamp = Date.now();
        const random = Math.floor(Math.random() * 1000);
        return `${settlement.name.toLowerCase().replace(/[^a-z0-9]/g, '')}-${cargoType.toLowerCase()}-${merchantType}-${timestamp}-${random}`;
    }

    /**
     * Calculate merchant quantity based on equilibrium
     * @param {Object} settlement - Settlement object
     * @param {string} cargoType - Cargo type
     * @param {string} merchantType - Merchant type
     * @param {Object} equilibrium - Supply/demand equilibrium
     * @returns {number} - Quantity available/wanted
     */
    calculateMerchantQuantity(settlement, cargoType, merchantType, equilibrium) {
        // Base quantity from settlement size
        let baseQuantity = settlement.size + Math.floor(Math.random() * settlement.size);
        
        // Adjust based on equilibrium
        if (merchantType === 'producer') {
            // High supply = more quantity available
            const supplyFactor = equilibrium.supply / 100;
            baseQuantity = Math.floor(baseQuantity * supplyFactor);
        } else {
            // High demand = more quantity wanted
            const demandFactor = equilibrium.demand / 100;
            baseQuantity = Math.floor(baseQuantity * demandFactor);
        }
        
        return Math.max(1, baseQuantity);
    }

    /**
     * Calculate base price for cargo type
     * @param {string} cargoType - Cargo type
     * @param {Object} settlement - Settlement object
     * @returns {number} - Base price
     */
    calculateBasePrice(cargoType, settlement) {
        // Get base price from cargo data
        const cargoData = this.dataManager?.getCargoType?.(cargoType);
        if (cargoData && cargoData.basePrice) {
            return cargoData.basePrice;
        }
        
        // Fallback pricing
        const fallbackPrices = {
            'Grain': 1,
            'Metal': 8,
            'Timber': 3,
            'Luxuries': 50,
            'Wool': 1,
            'Wine/Brandy': 3,
            'Armaments': 12
        };
        
        return fallbackPrices[cargoType] || 5;
    }

    /**
     * Apply price modifiers based on equilibrium and personality
     * @param {number} basePrice - Base price
     * @param {Object} settlement - Settlement object
     * @param {Object} equilibrium - Supply/demand equilibrium
     * @param {Object} personality - Merchant personality
     * @returns {number} - Modified price
     */
    applyPriceModifiers(basePrice, settlement, equilibrium, personality) {
        let price = basePrice;
        
        // Apply equilibrium modifiers
        const ratio = equilibrium.supply / equilibrium.demand;
        if (ratio > 1.5) {
            // High supply = lower prices
            price *= 0.8;
        } else if (ratio < 0.67) {
            // Low supply = higher prices
            price *= 1.2;
        }
        
        // Apply wealth modifier
        const wealthMultiplier = 1 + ((settlement.wealth - 3) * 0.05);
        price *= wealthMultiplier;
        
        // Apply personality variance
        const variance = (Math.random() - 0.5) * personality.priceVariance;
        price *= (1 + variance);
        
        return Math.max(0.1, Math.round(price * 100) / 100);
    }

    /**
     * Get special behaviors based on settlement flags
     * @param {Object} settlement - Settlement object
     * @returns {Array} - Array of special behavior names
     */
    getSpecialBehaviors(settlement) {
        const behaviors = [];
        
        if (settlement.flags && Array.isArray(settlement.flags)) {
            settlement.flags.forEach(flag => {
                if (this.config.specialSourceBehaviors[flag]) {
                    behaviors.push(flag);
                }
            });
        }
        
        return behaviors;
    }

    /**
     * Get a description for a given merchant skill level.
     * @param {number} skill - The merchant's skill level.
     * @returns {string} - A description of the skill level.
     */
    getMerchantSkillDescription(skill) {
        if (skill <= 35) return 'Novice (easily out-haggled)';
        if (skill <= 50) return 'Apprentice (basic bargaining skills)';
        if (skill <= 65) return 'Competent (solid trading experience)';
        if (skill <= 80) return 'Skilled (experienced negotiator)';
        if (skill <= 95) return 'Expert (master of the trade)';
        if (skill <= 110) return 'Master (legendary trader)';
        return 'Legendary (unmatched in the marketplace)';
    }

    /**
     * Apply desperation penalties to a merchant
     * @param {Object} merchant - Merchant object to modify
     * @returns {Object} - Modified merchant with desperation penalties
     */
    applyDesperationPenalties(merchant) {
        const config = this.config.desperation;
        const logger = this.getLogger();
        
        logger.logAlgorithmStep('Desperation', 'Applying penalties', {
            merchantId: merchant.id,
            originalPrice: merchant.finalPrice,
            originalQuantity: merchant.quantity,
            originalSkill: merchant.skill
        });

        // Apply penalties
        merchant.skill = Math.floor(merchant.skill * (1 - config.skillPenalty));
        merchant.finalPrice = Math.round(merchant.finalPrice * config.priceModifier * 100) / 100;
        merchant.quantity = Math.max(1, Math.floor(merchant.quantity * (1 - config.quantityReduction)));
        
        // Mark as desperate
        merchant.availability.desperation.available = true;
        merchant.availability.desperation.penaltiesApplied = true;
        merchant.availability.desperation.appliedAt = new Date().toISOString();
        
        logger.logAlgorithmStep('Desperation', 'Penalties applied', {
            merchantId: merchant.id,
            newPrice: merchant.finalPrice,
            newQuantity: merchant.quantity,
            newSkill: merchant.skill
        });

        return merchant;
    }
}

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.MerchantGenerator = MerchantGenerator;
    window.WFRPTradingMerchantGenerator = MerchantGenerator; // Keep legacy name for compatibility
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = MerchantGenerator;
}

console.log('Trading Places | MerchantGenerator class loaded');