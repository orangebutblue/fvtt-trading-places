/**
 * Trading Places Module - Cargo Availability Pipeline
 * Orange-realism workflow executed per producer slot.
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

    async run({ settlement, season = 'spring' } = {}) {
        if (!settlement) {
            throw new Error('Settlement is required to run the cargo availability pipeline');
        }

        this._refreshConfig();

        if (!Array.isArray(this.dataManager.cargoTypes) || this.dataManager.cargoTypes.length === 0) {
            await this.dataManager.loadCargoTypes();
        }

        const settlementProps = this.dataManager.getSettlementProperties(settlement);
        const settlementContext = this._buildSettlementContext(settlementProps, season);
        const flagModifiers = this._collectFlagModifiers(settlementProps);
        const slotPlan = this._buildSlotPlan(settlementProps, flagModifiers, season);
        const candidateTable = this._buildCandidateTable(settlementProps, flagModifiers, season);

        const slots = [];
        for (let index = 0; index < slotPlan.producerSlots; index += 1) {
            const slotNumber = index + 1;
            const slotResult = this._processSlot({
                slotNumber,
                settlementProps,
                flagModifiers,
                candidateTable,
                season,
                slotPlan
            });
            slots.push(slotResult);
        }

        return {
            settlement: settlementContext,
            slotPlan,
            candidateTable,
            slots
        };
    }

    _buildSettlementContext(settlementProps, season) {
        return {
            name: settlementProps.name,
            region: settlementProps.region,
            size: {
                enum: settlementProps.sizeEnum,
                numeric: settlementProps.sizeNumeric,
                description: settlementProps.sizeDescription
            },
            wealth: {
                rating: settlementProps.wealthRating,
                description: settlementProps.wealthDescription
            },
            population: settlementProps.population,
            flags: settlementProps.productionCategories || [],
            produces: settlementProps.produces || [],
            demands: settlementProps.demands || [],
            season
        };
    }

    _collectFlagModifiers(settlementProps) {
        const entries = [];
        const totals = {
            supplyTransfer: 0,
            demandTransfer: 0,
            availabilityBonus: 0,
            quality: 0,
            contraband: 0,
            producerMultiplier: 1
        };

        (settlementProps.productionCategories || []).forEach(rawFlag => {
            const flag = rawFlag.toLowerCase();
            const data = this.sourceFlags[flag];
            if (!data) {
                return;
            }

            const entry = {
                flag,
                description: data.description || '',
                supplyTransfer: data.supplyTransfer || 0,
                demandTransfer: data.demandTransfer || 0,
                availabilityBonus: data.availabilityBonus?.producers || 0,
                quality: data.quality || 0,
                contraband: data.contrabandChance || 0,
                multiplier: this.config?.merchantCount?.flagMultipliers?.[flag] || 1
            };

            entries.push(entry);
            totals.supplyTransfer += entry.supplyTransfer;
            totals.demandTransfer += entry.demandTransfer;
            totals.availabilityBonus += entry.availabilityBonus;
            totals.quality += entry.quality;
            totals.contraband += entry.contraband;
            totals.producerMultiplier *= entry.multiplier;
        });

        return { entries, totals };
    }

    _buildSlotPlan(settlementProps, flagModifiers, season) {
        const merchantConfig = this.config.merchantCount || {};
        const minSlotsPerSize = merchantConfig.minSlotsPerSize || [1, 2, 3, 4, 6];
        const sizeIdx = Math.max(1, Math.min(settlementProps.sizeNumeric || 1, minSlotsPerSize.length)) - 1;
        const baseSlots = minSlotsPerSize[sizeIdx] || 1;

        const populationMultiplier = merchantConfig.populationMultiplier ?? 0;
        const sizeMultiplier = merchantConfig.sizeMultiplier ?? 0;
        const populationContribution = Math.round((settlementProps.population || 0) * populationMultiplier);
        const sizeContribution = Math.round((settlementProps.sizeNumeric || 0) * sizeMultiplier);

        const reasons = [];
        reasons.push({ label: 'Base slots for settlement size', value: baseSlots });
        if (populationContribution) {
            reasons.push({ label: 'Population contribution', value: populationContribution });
        }
        if (sizeContribution) {
            reasons.push({ label: 'Size multiplier contribution', value: sizeContribution });
        }

        let slotTotal = baseSlots + populationContribution + sizeContribution;
        const multiplierReasons = [];
        (flagModifiers.entries || []).forEach(entry => {
            if (entry.multiplier && entry.multiplier !== 1) {
                const before = slotTotal;
                slotTotal *= entry.multiplier;
                multiplierReasons.push({
                    label: `Flag: ${entry.flag}`,
                    detail: `×${entry.multiplier.toFixed(2)} (from ${before.toFixed(2)} to ${slotTotal.toFixed(2)})`
                });
            }
        });

        const hardCap = merchantConfig.hardCap ?? null;
        if (hardCap && slotTotal > hardCap) {
            multiplierReasons.push({
                label: 'Hard cap',
                detail: `${slotTotal.toFixed(2)} → ${hardCap}`
            });
            slotTotal = hardCap;
        }

        const roundedSlots = Math.max(1, Math.round(slotTotal));

        return {
            season,
            totalSlots: roundedSlots,
            producerSlots: roundedSlots,
            formula: {
                baseSlots,
                populationContribution,
                sizeContribution,
                multipliers: multiplierReasons
            },
            reasons
        };
    }

    _buildCandidateTable(settlementProps, flagModifiers, season) {
        const candidates = [];
        const total = { weight: 0 };

        this.dataManager.cargoTypes.forEach(cargo => {
            if (!cargo || !cargo.name) {
                return;
            }

            const reasons = [];
            let weight = 0;
            const produced = (settlementProps.produces || []).includes(cargo.name);
            const demanded = (settlementProps.demands || []).includes(cargo.name);

            if (produced) {
                weight += 8;
                reasons.push('Settlement produces this cargo');
            }
            if (demanded) {
                weight += 5;
                reasons.push('Settlement demands this cargo');
            }

            const flagSupply = flagModifiers.entries
                .filter(entry => entry.supplyTransfer > 0)
                .map(entry => entry.flag);
            if (flagSupply.length > 0) {
                weight += flagSupply.length * 2;
                reasons.push(`Flags favor supply: ${flagSupply.join(', ')}`);
            }

            const flagDemand = flagModifiers.entries
                .filter(entry => entry.demandTransfer > 0)
                .map(entry => entry.flag);
            if (flagDemand.length > 0 && demanded) {
                weight += flagDemand.length;
                reasons.push(`Flags increase demand: ${flagDemand.join(', ')}`);
            }

            const seasonalShift = this.config.equilibrium?.seasonalShifts?.[season] || {};
            Object.entries(seasonalShift).forEach(([category, value]) => {
                if (cargo.category && cargo.category.toLowerCase().includes(category.toLowerCase())) {
                    const modifier = value >= 0 ? 2 : -2;
                    weight += modifier;
                    reasons.push(`Seasonal effect (${category} ${value >= 0 ? '+' : ''}${(value * 100).toFixed(0)}%)`);
                }
            });

            if (weight <= 0) {
                weight = 1;
                reasons.push('Baseline chance');
            }

            candidates.push({
                name: cargo.name,
                category: cargo.category || 'Unknown',
                weight,
                reasons,
                cargo
            });
            total.weight += weight;
        });

        candidates.forEach(candidate => {
            candidate.probability = (candidate.weight / total.weight) * 100;
        });

        return {
            totalWeight: total.weight,
            entries: candidates.sort((a, b) => b.weight - a.weight)
        };
    }

    _processSlot({ slotNumber, settlementProps, flagModifiers, candidateTable, season, slotPlan }) {
        const selection = this._selectCargo(candidateTable);
        const balance = this._calculateCargoBalance(selection, settlementProps, flagModifiers, season);
        const amount = this._rollAmount(selection, settlementProps, balance, slotPlan, season);
        const quality = this._evaluateQuality(selection, settlementProps, flagModifiers, balance);
        const contraband = this._evaluateContraband(selection, settlementProps, flagModifiers, season);
        const merchant = this._rollMerchant(selection, settlementProps, flagModifiers, balance, slotPlan);
        const desperation = this._applyDesperation(selection, balance, merchant, amount, quality);
        const pricing = this._evaluatePricing(selection, amount, quality, contraband, desperation, season);

        return {
            slotNumber,
            cargo: selection,
            balance,
            amount,
            quality,
            contraband,
            merchant,
            desperation,
            pricing
        };
    }

    _selectCargo(candidateTable) {
        const threshold = Math.random() * candidateTable.totalWeight;
        let running = 0;
        for (const entry of candidateTable.entries) {
            running += entry.weight;
            if (threshold <= running) {
                return {
                    name: entry.name,
                    category: entry.category,
                    probability: entry.probability,
                    reasons: entry.reasons,
                    cargoData: entry.cargo
                };
            }
        }
        const fallback = candidateTable.entries[candidateTable.entries.length - 1];
        return {
            name: fallback.name,
            category: fallback.category,
            probability: fallback.probability,
            reasons: fallback.reasons,
            cargoData: fallback.cargo
        };
    }

    _calculateCargoBalance(selection, settlementProps, flagModifiers, season) {
        const equilibriumConfig = this.config.equilibrium || {};
        const clamp = equilibriumConfig.clamp || { min: 5, max: 195 };

        let supply = equilibriumConfig.baseline?.supply ?? 100;
        let demand = equilibriumConfig.baseline?.demand ?? 100;

        const history = [];
        const applyTransfer = (direction, percentage, label) => {
            if (!percentage) {
                return;
            }
            const before = { supply, demand };
            const transferAmount = Math.round((direction === 'supply' ? demand : supply) * Math.abs(percentage));
            if (direction === 'supply') {
                if (percentage > 0) {
                    supply += transferAmount;
                    demand -= transferAmount;
                } else {
                    supply -= transferAmount;
                    demand += transferAmount;
                }
            } else {
                if (percentage > 0) {
                    demand += transferAmount;
                    supply -= transferAmount;
                } else {
                    demand -= transferAmount;
                    supply += transferAmount;
                }
            }

            supply = Math.max(clamp.min, Math.min(clamp.max, supply));
            demand = Math.max(clamp.min, Math.min(clamp.max, demand));

            history.push({ label, percentage, before, after: { supply, demand } });
        };

        if ((settlementProps.produces || []).includes(selection.name)) {
            applyTransfer('supply', equilibriumConfig.producesShift || 0.5, 'Produces list');
        }
        if ((settlementProps.demands || []).includes(selection.name)) {
            applyTransfer('demand', equilibriumConfig.demandsShift || 0.35, 'Demands list');
        }

        flagModifiers.entries.forEach(entry => {
            if (entry.supplyTransfer) {
                applyTransfer('supply', entry.supplyTransfer, `Flag: ${entry.flag}`);
            }
            if (entry.demandTransfer) {
                applyTransfer('demand', entry.demandTransfer, `Flag: ${entry.flag}`);
            }
        });

        const seasonalShift = equilibriumConfig.seasonalShifts?.[season] || {};
        Object.entries(seasonalShift).forEach(([category, value]) => {
            if (selection.category && selection.category.toLowerCase().includes(category.toLowerCase())) {
                applyTransfer(value >= 0 ? 'supply' : 'demand', value, `Seasonal (${category})`);
            }
        });

        const wealthModifier = equilibriumConfig.wealthModifiers?.[String(settlementProps.wealthRating)] || 0;
        if (wealthModifier) {
            applyTransfer(wealthModifier >= 0 ? 'demand' : 'supply', wealthModifier, 'Wealth tier');
        }

        const state = this._classifyBalance(
            supply,
            demand,
            equilibriumConfig.blockTradeThreshold || { supply: 10, demand: 10 },
            equilibriumConfig.desperationThreshold || { supply: 20, demand: 20 }
        );

        return { supply, demand, state, history };
    }

    _classifyBalance(supply, demand, blockThreshold, desperationThreshold) {
        if (supply <= blockThreshold.supply || demand <= blockThreshold.demand) {
            return 'blocked';
        }
        if (supply <= desperationThreshold.supply || demand >= desperationThreshold.demand) {
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

    _rollAmount(selection, settlementProps, balance, slotPlan, season) {
        const roll = this._percentile();
        const sizeBase = Math.max(1, settlementProps.sizeNumeric || 1);
        const wealthModifier = settlementProps.wealthModifier || this.dataManager.getWealthModifier(settlementProps.wealthRating);
        const supplyModifier = Math.max(0.5, balance.supply / (balance.demand || 1));

        const baseEP = Math.ceil(roll / 10) * 10 * sizeBase;
        const adjusted = baseEP * supplyModifier * wealthModifier;
        const totalEP = Math.max(10, Math.round(adjusted / 5) * 5);

        return {
            roll,
            baseEP,
            supplyModifier,
            wealthModifier,
            totalEP,
            notes: [
                `Base from roll ${roll} → ${baseEP} EP`,
                `Supply modifier ×${supplyModifier.toFixed(2)}`,
                `Wealth modifier ×${wealthModifier.toFixed(2)}`
            ]
        };
    }

    _evaluateQuality(selection, settlementProps, flagModifiers, balance) {
        const baseScore = settlementProps.wealthRating || 3;
        const flagBonus = flagModifiers.totals.quality || 0;
        const supplyPressure = balance.supply - balance.demand;
        const pressureBonus = supplyPressure >= 0 ? 0.5 : -0.5;
        const score = baseScore + flagBonus + pressureBonus;
        const tier = this._qualityFromScore(score);

        return {
            tier,
            score,
            notes: [
                `Wealth rating ${baseScore}`,
                flagBonus ? `Flag bonus ${flagBonus.toFixed(2)}` : null,
                `Market pressure ${pressureBonus >= 0 ? '+' : ''}${pressureBonus.toFixed(2)}`
            ].filter(Boolean)
        };
    }

    _qualityFromScore(score) {
        if (score >= 7) return 'Exceptional';
        if (score >= 5) return 'High';
        if (score >= 3) return 'Average';
        if (score >= 1) return 'Common';
        return 'Poor';
    }

    _evaluateContraband(selection, settlementProps, flagModifiers, season) {
        const baseChance = this.options.baseContrabandChance ?? 0.05;
        const flagBonus = flagModifiers.totals.contraband || 0;
        const sizeBonus = ((settlementProps.sizeNumeric || 1) - 1) * 0.02;
        const seasonalMultiplier = this.config.specialSourceBehaviors?.smuggling?.seasonalActivity?.[season] || 1;
        const chance = Math.min(0.95, (baseChance + flagBonus + sizeBonus) * seasonalMultiplier);
        const roll = this._percentile();

        return {
            chance: chance * 100,
            roll,
            contraband: roll <= chance * 100,
            notes: [
                `Base ${(baseChance * 100).toFixed(0)}%`,
                flagBonus ? `Flags ${(flagBonus * 100).toFixed(0)}%` : null,
                sizeBonus ? `Size ${(sizeBonus * 100).toFixed(0)}%` : null,
                seasonalMultiplier !== 1 ? `Season ×${seasonalMultiplier.toFixed(2)}` : null
            ].filter(Boolean)
        };
    }

    _rollMerchant(selection, settlementProps, flagModifiers, balance, slotPlan) {
        const baseTarget = 45 + (settlementProps.wealthRating || 3) * 5;
        const balanceBonus = (balance.supply - balance.demand) * 0.1;
        const flagBonus = (flagModifiers.totals.availabilityBonus || 0) * 100;
        const target = Math.max(10, Math.min(95, baseTarget + balanceBonus + flagBonus));
        const roll = this._percentile();
        const available = roll <= target;

        return {
            roll,
            target,
            available,
            notes: [
                `Base target ${baseTarget.toFixed(0)}%`,
                balanceBonus ? `Supply/Demand ${(balanceBonus >= 0 ? '+' : '')}${balanceBonus.toFixed(0)}%` : null,
                flagBonus ? `Flag bonus ${(flagBonus >= 0 ? '+' : '')}${flagBonus.toFixed(0)}%` : null
            ].filter(Boolean)
        };
    }

    _applyDesperation(selection, balance, merchant, amount, quality) {
        const desperationConfig = this.config.desperation || {};
        const thresholds = this.config.equilibrium?.desperationThreshold || { supply: 20, demand: 20 };
        const shouldAttempt = !merchant.available && (balance.supply <= thresholds.supply || balance.demand >= thresholds.demand);

        if (!shouldAttempt) {
            return {
                attempted: false,
                success: false,
                roll: null,
                notes: []
            };
        }

        const roll = Math.random();
        const success = roll <= (desperationConfig.rerollChance || 0);
        const quantityPenalty = success ? (1 - (desperationConfig.quantityReduction || 0.25)) : 1;
        const pricePenalty = success ? (1 + (desperationConfig.priceModifier || 0.15)) : 1;
        const qualityPenalty = success ? this._downgradeQuality(quality.tier, desperationConfig.qualityPenalty || -1) : quality.tier;

        return {
            attempted: true,
            success,
            roll,
            quantityMultiplier: quantityPenalty,
            priceMultiplier: pricePenalty,
            adjustedQuality: qualityPenalty,
            notes: [
                `Chance ${(desperationConfig.rerollChance || 0) * 100}%`,
                success ? `Quantity ×${quantityPenalty.toFixed(2)}` : 'No merchant found',
                success ? `Price ×${pricePenalty.toFixed(2)}` : null,
                success ? `Quality downgrades to ${qualityPenalty}` : null
            ].filter(Boolean)
        };
    }

    _downgradeQuality(tier, penalty) {
        const order = ['Poor', 'Common', 'Average', 'High', 'Exceptional'];
        const idx = Math.max(0, order.indexOf(tier));
        const adjusted = Math.max(0, idx + penalty);
        return order[adjusted] || order[0];
    }

    _evaluatePricing(selection, amount, quality, contraband, desperation, season) {
        const cargo = selection.cargoData;
        const basePricePerUnit = this.dataManager.getSeasonalPrice(cargo, season);
        const perEP = basePricePerUnit / (cargo.encumbrancePerUnit || 10);

        const steps = [];
        let runningPrice = perEP;

        steps.push({ label: 'Seasonal price', value: runningPrice });

        const qualityMultiplier = this._qualityMultiplier(desperation.success ? desperation.adjustedQuality : quality.tier);
        runningPrice *= qualityMultiplier;
        steps.push({ label: `Quality (${desperation.success ? desperation.adjustedQuality : quality.tier}) ×${qualityMultiplier.toFixed(2)}`, value: runningPrice });

        if (contraband.contraband) {
            runningPrice *= 0.85;
            steps.push({ label: 'Contraband discount ×0.85', value: runningPrice });
        }

        if (desperation.success) {
            runningPrice *= desperation.priceMultiplier;
            steps.push({ label: `Desperation penalty ×${desperation.priceMultiplier.toFixed(2)}`, value: runningPrice });
        }

        const quantity = Math.round(amount.totalEP * (desperation.success ? desperation.quantityMultiplier : 1));
        const totalValue = runningPrice * quantity;

        return {
            basePricePerEP: perEP,
            steps,
            finalPricePerEP: runningPrice,
            quantity,
            totalValue
        };
    }

    _qualityMultiplier(tier) {
        const map = {
            Poor: 0.85,
            Common: 0.95,
            Average: 1.0,
            High: 1.1,
            Exceptional: 1.25
        };
        return map[tier] || 1;
    }

    _percentile() {
        return Math.floor(Math.random() * 100) + 1;
    }
}

if (typeof window !== 'undefined') {
    window.CargoAvailabilityPipeline = CargoAvailabilityPipeline;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = CargoAvailabilityPipeline;
}
