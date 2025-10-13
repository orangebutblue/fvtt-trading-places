/**
 * Quality System for Trading Places
 * Handles quality determination for all cargo types, with special handling for Wine/Brandy
 */

export class QualitySystem {
    constructor(dataManager, options = {}) {
        this.dataManager = dataManager;
        this.random = options.random || Math.random;
        this.logger = options.logger || null;
    }

    /**
     * Maps a quality score to a tier
     * @param {number} score - Quality score
     * @param {Array} thresholds - Custom thresholds (optional)
     * @returns {string} Quality tier name
     */
    mapQualityTier(score, thresholds = []) {
        if (!Array.isArray(thresholds) || thresholds.length === 0) {
            if (score >= 9) return 'Exceptional';
            if (score >= 7) return 'High';
            if (score >= 5) return 'Average';
            if (score >= 3) return 'Common';
            return 'Poor';
        }

        for (const entry of thresholds) {
            const min = entry.min ?? -Infinity;
            const max = entry.max ?? Infinity;
            if (score >= min && score <= max) {
                return entry.tier || 'Average';
            }
        }

        return thresholds[thresholds.length - 1].tier || 'Average';
    }

    /**
     * Determines if cargo uses the extended wine/brandy quality system
     * @param {Object} cargoData - Cargo data object
     * @returns {boolean}
     */
    isWineBrandyCargo(cargoData) {
        return cargoData && cargoData.category === 'Brews' && 
               (cargoData.name === 'Wine' || cargoData.name === 'Brandy');
    }

    /**
     * Rolls quality for Wine/Brandy using d10 system
     * @param {Array} settlementFlags - Settlement flags
     * @param {string} cargoName - Name of cargo (Wine or Brandy)
     * @returns {Object} Quality result with tier and price
     */
    rollWineBrandyQuality(settlementFlags = [], cargoName = '') {
        // Roll d10 (1-10)
        const d10Roll = Math.floor(this.random() * 10) + 1;
        
        // Apply settlement bonuses (e.g., wine_quality flag gives +2)
        let modifiedRoll = d10Roll;
        const qualityBonuses = this._getQualityBonuses(settlementFlags, cargoName);
        modifiedRoll += qualityBonuses.total;
        
        // Clamp to valid range (1-10, but bonuses can push beyond)
        const finalRoll = Math.max(1, Math.min(12, modifiedRoll)); // Allow up to 12 for bonuses
        
        // Map to quality and price
        const qualityData = this._mapWineBrandyQuality(finalRoll);
        
        return {
            d10Roll,
            bonuses: qualityBonuses,
            modifiedRoll,
            finalRoll,
            quality: qualityData.quality,
            priceInBP: qualityData.priceInBP,
            rollDetails: {
                baseRoll: d10Roll,
                bonusTotal: qualityBonuses.total,
                bonusDetails: qualityBonuses.details,
                finalValue: finalRoll
            }
        };
    }

    /**
     * Determines dishonest merchant behavior
     * @param {number} dishonestyChance - Chance of dishonesty (0-1)
     * @returns {Object} Dishonesty result
     */
    rollMerchantHonesty(dishonestyChance = 0.5) {
        const roll = this.random();
        const isDishonest = roll < dishonestyChance;
        
        let qualityInflation = 0;
        if (isDishonest) {
            // Roll 2-4 quality inflation for dishonest merchants
            qualityInflation = Math.floor(this.random() * 3) + 2; // 2-4
        }
        
        return {
            roll,
            isDishonest,
            qualityInflation,
            chance: dishonestyChance
        };
    }

    /**
     * Applies dishonest merchant inflation to quality
     * @param {Object} actualQuality - The actual quality result
     * @param {number} inflation - Quality inflation amount
     * @param {boolean} isWineBrandy - Whether this is wine/brandy cargo
     * @returns {Object} Inflated quality result
     */
    applyQualityInflation(actualQuality, inflation, isWineBrandy = false) {
        if (inflation === 0) {
            return actualQuality;
        }

        if (isWineBrandy) {
            // For wine/brandy, inflate the final roll
            const inflatedRoll = Math.min(12, actualQuality.finalRoll + inflation);
            const inflatedQualityData = this._mapWineBrandyQuality(inflatedRoll);
            
            return {
                ...actualQuality,
                inflatedRoll,
                merchantQuality: inflatedQualityData.quality,
                merchantPriceInBP: inflatedQualityData.priceInBP,
                inflation
            };
        } else {
            // For regular cargo, inflate the tier
            const inflatedTier = this._inflateTier(actualQuality.tier, inflation);
            
            return {
                ...actualQuality,
                merchantTier: inflatedTier,
                inflation
            };
        }
    }

    /**
     * Gets settlement quality bonuses for specific cargo
     * @param {Array} settlementFlags - Settlement flags
     * @param {string} cargoName - Name of cargo
     * @returns {Object} Quality bonuses
     */
    _getQualityBonuses(settlementFlags = [], cargoName = '') {
        const bonuses = {
            total: 0,
            details: []
        };

        // Check for wine_quality flag
        if (settlementFlags.includes('wine_quality')) {
            const sourceFlags = this.dataManager.sourceFlags || {};
            const wineQualityFlag = sourceFlags.wine_quality;
            
            if (wineQualityFlag?.qualityBonus?.[cargoName]) {
                const bonus = wineQualityFlag.qualityBonus[cargoName];
                bonuses.total += bonus;
                bonuses.details.push({
                    source: 'wine_quality flag',
                    amount: bonus,
                    cargo: cargoName
                });
            }
        }

        return bonuses;
    }

    /**
     * Maps Wine/Brandy d10 roll to quality and price
     * @param {number} roll - The d10 roll result
     * @returns {Object} Quality and price data
     */
    _mapWineBrandyQuality(roll) {
        // Wine/Brandy quality table (prices in GC, converted to BP by *240)
        const qualityTable = [
            { min: 1, max: 1, quality: 'Swill', priceGC: 0.5 },
            { min: 2, max: 3, quality: 'Passable', priceGC: 1 },
            { min: 4, max: 5, quality: 'Average', priceGC: 1.5 },
            { min: 6, max: 7, quality: 'Good', priceGC: 3 },
            { min: 8, max: 9, quality: 'Excellent', priceGC: 6 },
            { min: 10, max: 12, quality: 'Top Shelf', priceGC: 12 } // Allow 11-12 for bonuses
        ];

        const entry = qualityTable.find(q => roll >= q.min && roll <= q.max) || qualityTable[0];
        
        return {
            quality: entry.quality,
            priceInBP: Math.round(entry.priceGC * 240) // Convert GC to BP
        };
    }

    /**
     * Inflates a regular quality tier for dishonest merchants
     * @param {string} tier - Original tier
     * @param {number} inflation - Inflation amount
     * @returns {string} Inflated tier
     */
    _inflateTier(tier, inflation) {
        const tiers = ['Poor', 'Common', 'Average', 'High', 'Exceptional'];
        const currentIndex = tiers.indexOf(tier);
        
        if (currentIndex === -1) return tier;
        
        const newIndex = Math.min(tiers.length - 1, currentIndex + inflation);
        return tiers[newIndex];
    }

    /**
     * Generates tooltip text for quality evaluation
     * @param {Object} qualityResult - Quality result object
     * @param {boolean} isWineBrandy - Whether this is wine/brandy
     * @returns {string} Tooltip text
     */
    generateEvaluateTooltip(qualityResult, isWineBrandy = false) {
        if (!qualityResult.inflation || qualityResult.inflation === 0) {
            return null; // No tooltip needed for honest merchants
        }

        if (isWineBrandy) {
            return `Ask players to make an Evaluate Test (Challenging +0, or Average +20 if Consume Alcohol ≥50). ` +
                   `Success reveals true quality: ${qualityResult.quality}. ` +
                   `Failure gives false impression based on degrees of failure.`;
        } else {
            return `Ask players to make an Evaluate Test (Challenging +0) to detect merchant dishonesty. ` +
                   `True quality tier: ${qualityResult.tier}. ` +
                   `Merchant claims: ${qualityResult.merchantTier}.`;
        }
    }
}

if (typeof window !== 'undefined') {
    window.QualitySystem = QualitySystem;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = QualitySystem;
}