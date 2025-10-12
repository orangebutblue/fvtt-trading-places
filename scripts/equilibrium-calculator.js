/**
 * Trading Places Module - Equilibrium Calculator
 * Implements supply/demand equilibrium calculations with flag and seasonal effects
 */

console.log('Trading Places | Loading equilibrium-calculator.js');

/**
 * Equilibrium Calculator class for supply/demand balance
 */
class EquilibriumCalculator {
    constructor(tradingConfig, sourceFlags) {
        this.config = tradingConfig?.equilibrium;
        this.sourceFlags = sourceFlags;
        this.logger = null;
        this.currentSeason = 'spring';
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
            logDecision: () => {}
        };
    }

    /**
     * Set current season for seasonal calculations
     * @param {string} season - Current season
     */
    setCurrentSeason(season) {
        this.currentSeason = season;
    }

    /**
     * Calculate complete equilibrium for settlement and cargo type
     * @param {Object} settlement - Settlement object
     * @param {string} cargoType - Cargo type name
     * @param {Object} context - Additional context (season, etc.)
     * @returns {Object} - Equilibrium result with metadata
     */
    calculateEquilibrium(settlement, cargoType, context = {}) {
        const logger = this.getLogger();
        const season = context.season || this.currentSeason;
        
        logger.logCalculation('Equilibrium', 'Starting calculation', {
            settlement: settlement.name,
            cargoType,
            season,
            flags: settlement.flags,
            produces: settlement.produces,
            demands: settlement.demands
        });

        // Initialize baseline
        let supply = this.config.baseline.supply;
        let demand = this.config.baseline.demand;
        const transfers = [];

        // Apply produces effects
        if (settlement.produces && settlement.produces.includes(cargoType)) {
            const shift = this.config.producesShift;
            const transfer = Math.floor(demand * shift);
            supply += transfer;
            demand -= transfer;
            
            transfers.push({
                source: 'produces',
                type: 'supply',
                amount: transfer,
                description: `Settlement produces ${cargoType}`
            });
        }

        // Apply demands effects
        if (settlement.demands && settlement.demands.includes(cargoType)) {
            const shift = this.config.demandsShift;
            const transfer = Math.floor(supply * shift);
            demand += transfer;
            supply -= transfer;
            
            transfers.push({
                source: 'demands',
                type: 'demand',
                amount: transfer,
                description: `Settlement demands ${cargoType}`
            });
        }

        // Apply flag effects
        if (settlement.flags && Array.isArray(settlement.flags)) {
            settlement.flags.forEach(flag => {
                const flagData = this.sourceFlags[flag];
                if (flagData) {
                    // Apply general supply/demand transfers
                    if (flagData.supplyTransfer) {
                        const transfer = Math.floor(demand * flagData.supplyTransfer);
                        supply += transfer;
                        demand -= transfer;
                        
                        transfers.push({
                            source: 'flag',
                            flag,
                            type: 'supply',
                            amount: transfer,
                            description: `${flag} flag supply bonus`
                        });
                    }

                    if (flagData.demandTransfer) {
                        const transfer = Math.floor(supply * flagData.demandTransfer);
                        demand += transfer;
                        supply -= transfer;
                        
                        transfers.push({
                            source: 'flag',
                            flag,
                            type: 'demand',
                            amount: transfer,
                            description: `${flag} flag demand bonus`
                        });
                    }

                    // Apply category-specific transfers
                    const cargoData = context.cargoData;
                    if (cargoData && cargoData.category) {
                        const category = cargoData.category;
                        
                        if (flagData.categorySupplyTransfer && flagData.categorySupplyTransfer[category]) {
                            const transfer = Math.floor(demand * flagData.categorySupplyTransfer[category]);
                            supply += transfer;
                            demand -= transfer;
                            
                            transfers.push({
                                source: 'flag-category',
                                flag,
                                category,
                                type: 'supply',
                                amount: transfer,
                                description: `${flag} flag ${category} supply bonus`
                            });
                        }

                        if (flagData.categoryDemandTransfer && flagData.categoryDemandTransfer[category]) {
                            const transfer = Math.floor(supply * flagData.categoryDemandTransfer[category]);
                            demand += transfer;
                            supply -= transfer;
                            
                            transfers.push({
                                source: 'flag-category',
                                flag,
                                category,
                                type: 'demand',
                                amount: transfer,
                                description: `${flag} flag ${category} demand bonus`
                            });
                        }
                    }
                }
            });
        }

        // Apply seasonal effects
        const seasonalShifts = this.config.seasonalShifts[season];
        if (seasonalShifts && settlement.flags) {
            settlement.flags.forEach(flag => {
                if (seasonalShifts[flag]) {
                    const shift = seasonalShifts[flag];
                    const transfer = Math.floor(demand * shift);
                    supply += transfer;
                    demand -= transfer;
                    
                    transfers.push({
                        source: 'seasonal',
                        season,
                        flag,
                        type: 'supply',
                        amount: transfer,
                        description: `${season} seasonal effect for ${flag}`
                    });
                }
            });
        }

        // Apply wealth modifiers
        const wealthModifier = this.config.wealthModifiers[settlement.wealth.toString()];
        if (wealthModifier) {
            const transfer = Math.floor(supply * Math.abs(wealthModifier));
            if (wealthModifier > 0) {
                // Wealthy settlements have more demand
                demand += transfer;
                supply -= transfer;
            } else {
                // Poor settlements have less demand
                supply += transfer;
                demand -= transfer;
            }
            
            transfers.push({
                source: 'wealth',
                wealth: settlement.wealth,
                type: wealthModifier > 0 ? 'demand' : 'supply',
                amount: transfer,
                description: `Wealth ${settlement.wealth} modifier`
            });
        }

        // Apply clamps
        const originalSupply = supply;
        const originalDemand = demand;
        
        supply = Math.max(this.config.clamp.min, Math.min(this.config.clamp.max, supply));
        demand = Math.max(this.config.clamp.min, Math.min(this.config.clamp.max, demand));

        if (supply !== originalSupply || demand !== originalDemand) {
            transfers.push({
                source: 'clamp',
                type: 'adjustment',
                amount: 0,
                description: `Clamped to valid range (${this.config.clamp.min}-${this.config.clamp.max})`
            });
        }

        // Calculate derived values
        const ratio = supply / demand;
        const totalPoints = supply + demand;
        const supplyPercent = (supply / totalPoints) * 100;
        const demandPercent = (demand / totalPoints) * 100;

        // Determine equilibrium state
        let state = 'balanced';
        if (supply <= this.config.blockTradeThreshold.supply || demand <= this.config.blockTradeThreshold.demand) {
            state = 'blocked';
        } else if (supply <= this.config.desperationThreshold.supply || demand <= this.config.desperationThreshold.demand) {
            state = 'desperate';
        } else if (ratio > 2.0) {
            state = 'oversupplied';
        } else if (ratio < 0.5) {
            state = 'undersupplied';
        }

        const result = {
            supply,
            demand,
            ratio,
            totalPoints,
            supplyPercent,
            demandPercent,
            state,
            transfers,
            metadata: {
                settlement: settlement.name,
                cargoType,
                season,
                calculatedAt: new Date().toISOString(),
                transferCount: transfers.length
            }
        };

        logger.logCalculation('Equilibrium', 'Calculation complete', {
            result: {
                supply,
                demand,
                ratio: Math.round(ratio * 100) / 100,
                state,
                transferCount: transfers.length
            }
        });

        return result;
    }

    /**
     * Check if trade should be blocked based on equilibrium
     * @param {Object} equilibrium - Equilibrium calculation result
     * @returns {boolean} - True if trade should be blocked
     */
    shouldBlockTrade(equilibrium) {
        return equilibrium.state === 'blocked';
    }

    /**
     * Check if desperation reroll should be automatically triggered
     * @param {Object} equilibrium - Equilibrium calculation result
     * @returns {boolean} - True if desperation should trigger
     */
    shouldTriggerDesperation(equilibrium) {
        return equilibrium.state === 'desperate';
    }

    /**
     * Calculate availability modifiers based on equilibrium
     * @param {Object} equilibrium - Equilibrium calculation result
     * @param {string} merchantType - 'producer' or 'seeker'
     * @returns {Object} - Availability modifiers
     */
    calculateAvailabilityModifiers(equilibrium, merchantType) {
        const modifiers = {
            skillBonus: 0,
            quantityMultiplier: 1.0,
            priceMultiplier: 1.0,
            description: 'Standard availability'
        };

        if (merchantType === 'producer') {
            // High supply makes producers more available
            if (equilibrium.ratio > 1.5) {
                modifiers.skillBonus = 10;
                modifiers.quantityMultiplier = 1.2;
                modifiers.description = 'High supply - producers readily available';
            } else if (equilibrium.ratio < 0.8) {
                modifiers.skillBonus = -10;
                modifiers.quantityMultiplier = 0.8;
                modifiers.priceMultiplier = 1.1;
                modifiers.description = 'Low supply - producers scarce and expensive';
            }
        } else {
            // High demand makes seekers more available
            if (equilibrium.ratio < 0.67) {
                modifiers.skillBonus = 10;
                modifiers.quantityMultiplier = 1.3;
                modifiers.priceMultiplier = 1.1;
                modifiers.description = 'High demand - seekers eager to buy';
            } else if (equilibrium.ratio > 1.2) {
                modifiers.skillBonus = -5;
                modifiers.quantityMultiplier = 0.9;
                modifiers.description = 'Low demand - seekers less interested';
            }
        }

        return modifiers;
    }

    /**
     * Get equilibrium summary for debugging
     * @param {Object} equilibrium - Equilibrium calculation result
     * @returns {string} - Human-readable summary
     */
    getEquilibriumSummary(equilibrium) {
        const { supply, demand, ratio, state } = equilibrium;
        const ratioStr = Math.round(ratio * 100) / 100;
        
        let summary = `Supply: ${supply}, Demand: ${demand} (${ratioStr}:1) - ${state.toUpperCase()}`;
        
        if (equilibrium.transfers.length > 0) {
            summary += `\nTransfers applied: ${equilibrium.transfers.length}`;
            equilibrium.transfers.forEach(transfer => {
                summary += `\n  - ${transfer.description}: ${transfer.amount > 0 ? '+' : ''}${transfer.amount}`;
            });
        }
        
        return summary;
    }
}

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.EquilibriumCalculator = EquilibriumCalculator;
    window.TradingPlacesEquilibriumCalculator = EquilibriumCalculator; // Keep legacy name for compatibility
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = EquilibriumCalculator;
}

console.log('Trading Places | EquilibriumCalculator class loaded');