/**
 * Trading Places Module - Cargo Availability Pipeline
 * Implements the orange-realism availability procedure in sequential steps.
 */

class CargoAvailabilityPipeline {
    constructor(dataManager, options = {}) {
        if (!dataManager) {
            throw new Error('CargoAvailabilityPipeline requires a DataManager instance');
        }

        this.dataManager = dataManager;
        this.options = options;
        this._refreshConfig();
    }

    _refreshConfig() {
        this.config = this.dataManager.getSystemConfig() || {};
        this.sourceFlags = this.dataManager.sourceFlags || {};
    }

    async run({ settlement, season = 'spring', maxCandidates = 6 } = {}) {
        if (!settlement) {
            throw new Error('Settlement is required to run the cargo availability pipeline');
        }

        this._refreshConfig();

        if (!Array.isArray(this.dataManager.cargoTypes) || this.dataManager.cargoTypes.length === 0) {
            await this.dataManager.loadCargoTypes();
        }

        const settlementProps = this.dataManager.getSettlementProperties(settlement);

        const step0 = this._prepareDefaults(settlementProps, season);
        const step1 = this._determineMerchantSlots(settlementProps, season, step0);
        const step2 = this._collectSettlementModifiers(settlementProps);
        const step3 = this._collectSeasonalModifiers(season);
        const step4 = this._calculateSupplyDemand(settlementProps, step2, step3, step0);
        const step5 = this._generateCargoCandidates(settlementProps, step2, step3, step4, maxCandidates);

        return {
            step0,
            step1,
            step2,
            step3,
            step4,
            step5,
            summary: {
                totalSlots: step1.totalSlots,
                producerSlots: step1.producerSlots,
                seekerSlots: step1.seekerSlots,
                supply: step4.finalBalance.supply,
                demand: step4.finalBalance.demand,
                availabilityState: step4.finalBalance.state,
                suggestedCargo: step5.candidates.slice(0, maxCandidates)
            }
        };
    }

    _prepareDefaults(settlementProps, season) {
        const equilibriumConfig = this.config.equilibrium || {};
        const desperation = this.config.desperation || {};
        const defaults = {
            baselineSupply: equilibriumConfig.baseline?.supply ?? 100,
            baselineDemand: equilibriumConfig.baseline?.demand ?? 100,
            contrabandChance: this._getBaseContrabandChance(),
            qualityTier: this._getDefaultQualityTier(settlementProps),
            desperation,
            season
        };

        return {
            settlement: {
                name: settlementProps.name,
                region: settlementProps.region,
                population: settlementProps.population,
                sizeNumeric: settlementProps.sizeNumeric,
                sizeDescription: settlementProps.sizeDescription,
                wealth: settlementProps.wealthRating,
                wealthDescription: settlementProps.wealthDescription,
                flags: settlementProps.productionCategories || [],
                produces: settlementProps.produces || [],
                demands: settlementProps.demands || []
            },
            defaults
        };
    }

    _determineMerchantSlots(settlementProps, season, step0) {
        const merchantConfig = this.config.merchantCount || {};
        const minSlotsPerSize = merchantConfig.minSlotsPerSize || [1, 2, 3, 4, 6];
        const sizeIndex = Math.max(1, Math.min(step0.settlement.sizeNumeric || 1, minSlotsPerSize.length));
        const minSlots = minSlotsPerSize[sizeIndex - 1] || 1;

        const populationMultiplier = merchantConfig.populationMultiplier ?? 0;
        const sizeMultiplier = merchantConfig.sizeMultiplier ?? 0;
        const baseSlots = minSlots + (settlementProps.population || 0) * populationMultiplier + (step0.settlement.sizeNumeric || 0) * sizeMultiplier;

        const modifiers = [];
        let adjustedSlots = baseSlots;

        if (merchantConfig.flagMultipliers && Array.isArray(step0.settlement.flags)) {
            step0.settlement.flags.forEach(flag => {
                const normalizedFlag = flag.toLowerCase();
                const multiplier = merchantConfig.flagMultipliers[normalizedFlag];
                if (multiplier) {
                    const before = adjustedSlots;
                    adjustedSlots *= multiplier;
                    modifiers.push({
                        source: `flag:${normalizedFlag}`,
                        type: 'multiplier',
                        value: multiplier,
                        before,
                        after: adjustedSlots
                    });
                }
            });
        }

        const hardCap = merchantConfig.hardCap ?? null;
        let cappedSlots = adjustedSlots;
        let capApplied = false;
        if (hardCap && adjustedSlots > hardCap) {
            cappedSlots = hardCap;
            capApplied = true;
        }

        const totalSlots = Math.max(1, Math.round(cappedSlots));
        const producerSlots = Math.ceil(totalSlots / 2);
        const seekerSlots = Math.floor(totalSlots / 2);

        return {
            minSlots,
            baseSlots,
            adjustedSlots,
            capApplied,
            hardCap,
            totalSlots,
            producerSlots,
            seekerSlots,
            modifiers,
            season
        };
    }

    _collectSettlementModifiers(settlementProps) {
        const modifiers = [];
        const totals = {
            supplyTransfer: 0,
            demandTransfer: 0,
            contraband: 0,
            quality: 0,
            availabilityProducers: 0,
            availabilitySeekers: 0
        };

        const categorySupply = {};
        const categoryDemand = {};

        if (Array.isArray(settlementProps.productionCategories)) {
            settlementProps.productionCategories.forEach(flag => {
                const normalizedFlag = flag.toLowerCase();
                const flagData = this.sourceFlags[normalizedFlag];
                if (!flagData) {
                    return;
                }

                const entry = {
                    flag: normalizedFlag,
                    description: flagData.description || '',
                    supplyTransfer: flagData.supplyTransfer || 0,
                    demandTransfer: flagData.demandTransfer || 0,
                    contrabandChance: flagData.contrabandChance || 0,
                    qualityBonus: flagData.quality || 0,
                    availabilityBonus: flagData.availabilityBonus || {},
                    categorySupplyTransfer: flagData.categorySupplyTransfer || {},
                    categoryDemandTransfer: flagData.categoryDemandTransfer || {}
                };

                modifiers.push(entry);

                totals.supplyTransfer += entry.supplyTransfer;
                totals.demandTransfer += entry.demandTransfer;
                totals.contraband += entry.contrabandChance;
                totals.quality += entry.qualityBonus;
                totals.availabilityProducers += entry.availabilityBonus?.producers || 0;
                totals.availabilitySeekers += entry.availabilityBonus?.seekers || 0;

                Object.entries(entry.categorySupplyTransfer).forEach(([category, value]) => {
                    categorySupply[category] = (categorySupply[category] || 0) + value;
                });

                Object.entries(entry.categoryDemandTransfer).forEach(([category, value]) => {
                    categoryDemand[category] = (categoryDemand[category] || 0) + value;
                });
            });
        }

        return {
            modifiers,
            totals,
            categorySupply,
            categoryDemand
        };
    }

    _collectSeasonalModifiers(season) {
        const equilibriumConfig = this.config.equilibrium || {};
        const seasonalShifts = equilibriumConfig.seasonalShifts?.[season] || {};

        const cargoSeasonalModifiers = {};
        if (Array.isArray(this.dataManager.cargoTypes)) {
            this.dataManager.cargoTypes.forEach(cargo => {
                if (!cargo || !cargo.category) {
                    return;
                }

                const category = cargo.category;
                const seasonalModifier = cargo.seasonalModifiers?.[season];
                if (seasonalModifier !== undefined) {
                    cargoSeasonalModifiers[category] = Math.max(
                        cargoSeasonalModifiers[category] || 0,
                        seasonalModifier
                    );
                }
            });
        }

        return {
            season,
            equilibriumShifts: seasonalShifts,
            cargoSeasonalModifiers
        };
    }

    _calculateSupplyDemand(settlementProps, step2, step3, step0) {
        const equilibriumConfig = this.config.equilibrium || {};
        const clamp = equilibriumConfig.clamp || { min: 1, max: 199 };

        let supply = step0.defaults.baselineSupply;
        let demand = step0.defaults.baselineDemand;

        const history = [];
        const applyTransfer = (direction, amount, source, description) => {
            if (!amount) {
                return;
            }

            const before = { supply, demand };
            const absoluteAmount = Math.abs(amount);

            if (direction === 'supply') {
                if (amount > 0) {
                    const transfer = Math.round(demand * absoluteAmount);
                    supply += transfer;
                    demand -= transfer;
                } else {
                    const transfer = Math.round(supply * absoluteAmount);
                    supply -= transfer;
                    demand += transfer;
                }
            } else if (direction === 'demand') {
                if (amount > 0) {
                    const transfer = Math.round(supply * absoluteAmount);
                    demand += transfer;
                    supply -= transfer;
                } else {
                    const transfer = Math.round(demand * absoluteAmount);
                    demand -= transfer;
                    supply += transfer;
                }
            }

            supply = Math.max(clamp.min, Math.min(clamp.max, supply));
            demand = Math.max(clamp.min, Math.min(clamp.max, demand));

            history.push({
                source,
                description,
                direction,
                amount,
                before,
                after: { supply, demand }
            });
        };

        // Produces list increases supply
        const producesShift = equilibriumConfig.producesShift ?? 0.5;
        if (Array.isArray(settlementProps.produces) && settlementProps.produces.length > 0) {
            applyTransfer('supply', producesShift, 'produces', `Produces (${settlementProps.produces.join(', ')})`);
        }

        // Demands list increases demand
        const demandsShift = equilibriumConfig.demandsShift ?? 0.35;
        if (Array.isArray(settlementProps.demands) && settlementProps.demands.length > 0) {
            applyTransfer('demand', demandsShift, 'demands', `Demands (${settlementProps.demands.join(', ')})`);
        }

        // Flag modifiers
        step2.modifiers.forEach(mod => {
            if (mod.supplyTransfer) {
                applyTransfer('supply', mod.supplyTransfer, `flag:${mod.flag}`, mod.description || 'Flag supply modifier');
            }
            if (mod.demandTransfer) {
                applyTransfer('demand', mod.demandTransfer, `flag:${mod.flag}`, mod.description || 'Flag demand modifier');
            }
        });

        // Seasonal shifts
        Object.entries(step3.equilibriumShifts).forEach(([key, value]) => {
            applyTransfer(value >= 0 ? 'supply' : 'demand', value, `season:${step3.season}:${key}`, 'Seasonal equilibrium shift');
        });

        // Wealth modifiers act on demand by default
        const wealthModifier = equilibriumConfig.wealthModifiers?.[String(settlementProps.wealthRating)] ?? 0;
        if (wealthModifier) {
            applyTransfer(wealthModifier >= 0 ? 'demand' : 'supply', wealthModifier, 'wealth', `Wealth rating ${settlementProps.wealthRating}`);
        }

        const blockThreshold = equilibriumConfig.blockTradeThreshold || { supply: 10, demand: 10 };
        const desperationThreshold = equilibriumConfig.desperationThreshold || { supply: 20, demand: 20 };

        const finalState = {
            supply,
            demand,
            state: this._classifyEquilibriumState(supply, demand, blockThreshold, desperationThreshold)
        };

        return {
            history,
            finalBalance: finalState,
            clamp
        };
    }

    _classifyEquilibriumState(supply, demand, blockThreshold, desperationThreshold) {
        if (supply <= blockThreshold.supply || demand <= blockThreshold.demand) {
            return 'blocked';
        }

        if (supply <= desperationThreshold.supply || demand <= desperationThreshold.demand) {
            return 'desperate';
        }

        if (supply > demand * 1.5) {
            return 'glut';
        }

        if (demand > supply * 1.5) {
            return 'scarce';
        }

        return 'balanced';
    }

    _generateCargoCandidates(settlementProps, step2, step3, step4, maxCandidates) {
        const producedSet = new Set((settlementProps.produces || []).map(name => name.toLowerCase()));
        const demandedSet = new Set((settlementProps.demands || []).map(name => name.toLowerCase()));

        const supply = step4.finalBalance.supply;
        const demand = step4.finalBalance.demand;
        const total = Math.max(1, supply + demand);
        const supplyBias = supply / total;
        const demandBias = demand / total;

        const candidates = [];

        this.dataManager.cargoTypes.forEach(cargo => {
            if (!cargo || !cargo.name) {
                return;
            }

            const name = cargo.name;
            const normalizedName = name.toLowerCase();
            const category = cargo.category || 'Unknown';
            const reasons = [];
            let weight = 0;

            if (producedSet.has(normalizedName)) {
                weight += 8;
                reasons.push('Settlement produces this cargo');
            }

            if (demandedSet.has(normalizedName)) {
                weight += 5;
                reasons.push('Settlement demands this cargo');
            }

            const categorySupply = step2.categorySupply?.[category] || 0;
            if (categorySupply !== 0) {
                weight += Math.round(categorySupply * 10);
                reasons.push(`Flag supply focus on ${category}`);
            }

            const categoryDemand = step2.categoryDemand?.[category] || 0;
            if (categoryDemand !== 0) {
                weight += Math.round(categoryDemand * 8);
                reasons.push(`Flag demand focus on ${category}`);
            }

            const seasonalCategoryModifier = step3.cargoSeasonalModifiers?.[category];
            if (seasonalCategoryModifier !== undefined) {
                const seasonalWeight = seasonalCategoryModifier > 1 ? 4 : seasonalCategoryModifier < 1 ? -2 : 0;
                weight += seasonalWeight;
                if (seasonalWeight !== 0) {
                    reasons.push(`Seasonal modifier (${seasonalCategoryModifier}x)`);
                }
            }

            if (supplyBias > demandBias && producedSet.has(normalizedName)) {
                weight += 3;
                reasons.push('High supply bias rewards local production');
            }

            if (demandBias >= supplyBias && demandedSet.has(normalizedName)) {
                weight += 2;
                reasons.push('High demand bias rewards local demand');
            }

            if (weight <= 0 && reasons.length === 0) {
                weight = 1;
                reasons.push('Fallback inclusion');
            }

            candidates.push({
                name,
                category,
                weight,
                reasons,
                seasonalModifier: seasonalCategoryModifier || 1,
                produced: producedSet.has(normalizedName),
                demanded: demandedSet.has(normalizedName)
            });
        });

        candidates.sort((a, b) => b.weight - a.weight);

        return {
            candidates: candidates.slice(0, maxCandidates)
        };
    }

    _getBaseContrabandChance() {
        const base = this.config.desperation?.contrabandChance;
        if (typeof base === 'number') {
            return base;
        }
        return 0.05;
    }

    _getDefaultQualityTier(settlementProps) {
        const wealth = settlementProps.wealthRating || 3;
        if (wealth >= 5) {
            return 'Exceptional';
        }
        if (wealth === 4) {
            return 'High';
        }
        if (wealth <= 2) {
            return 'Common';
        }
        return 'Average';
    }
}

if (typeof window !== 'undefined') {
    window.CargoAvailabilityPipeline = CargoAvailabilityPipeline;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = CargoAvailabilityPipeline;
}
