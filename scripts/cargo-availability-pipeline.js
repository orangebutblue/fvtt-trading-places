class CargoAvailabilityPipeline {
    constructor(dataManager, options = {}) {
        if (!dataManager) {
            throw new Error('CargoAvailabilityPipeline requires a DataManager instance');
        }

        this.dataManager = dataManager;
        this.random = typeof options.random === 'function' ? options.random : Math.random;
        this.rollPercentile = options.rollPercentile || null;
        this.logger = options.logger || null;

        this.MODULE_ID = "fvtt-trading-places";

        this._refreshConfig();
    }

    _refreshConfig() {
        this.tradingConfig = this.dataManager.tradingConfig || {};
        this.sourceFlags = this.dataManager.sourceFlags || {};
    }

    async _ensureDataLoaded() {
        if (!this.tradingConfig || Object.keys(this.tradingConfig).length === 0) {
            if (typeof this.dataManager.loadTradingConfig === 'function') {
                try {
                    await this.dataManager.loadTradingConfig();
                } catch (error) {
                    // Ignore load failures here; downstream calls will surface issues if config is still missing
                }
            }
            this._refreshConfig();
        }

        if (!Array.isArray(this.dataManager.cargoTypes) || this.dataManager.cargoTypes.length === 0) {
            await this.dataManager.loadCargoTypes();
        }

        if (!this.sourceFlags || Object.keys(this.sourceFlags).length === 0) {
            if (typeof this.dataManager.loadSourceFlags === 'function') {
                await this.dataManager.loadSourceFlags();
                this._refreshConfig();
            }
        }
    }

    async run({ settlement, season = 'spring', rollPercentile = null } = {}) {
        if (!settlement) {
            throw new Error('Settlement is required to run the cargo availability pipeline');
        }

        // Update roll function if provided
        if (rollPercentile) {
            this.rollPercentile = rollPercentile;
        }

        await this._ensureDataLoaded();
        this._refreshConfig();

        const normalizedSeason = (season || 'spring').toLowerCase();
        const settlementProps = this.dataManager.getSettlementProperties(settlement);
        const settlementFlags = this._normaliseFlags(settlementProps.productionCategories);

        const settlementContext = this._buildSettlementContext(settlementProps, normalizedSeason);
        const cargoSlotPlan = this._calculateCargoSlots(settlementProps, settlementFlags, normalizedSeason);
        const candidateTable = this._buildCandidateTable(settlementProps, settlementFlags, normalizedSeason);

        // Create roll function that uses Foundry's dice system
        const createFoundryRollFunction = (slotNumber) => {
            return async ({ description, postToChat = true }) => {
                // Always create unique rolls per slot for proper randomization
                // The rollPercentile parameter is for testing/deterministic behavior only
                const roll = new Roll("1d100");
                await roll.evaluate();

                if (postToChat && typeof game !== 'undefined' && game.settings) {
                    const chatVisibility = game.settings.get(this.MODULE_ID, "chatVisibility");
                    if (chatVisibility !== "disabled") {
                        await roll.toMessage({
                            speaker: ChatMessage.getSpeaker(),
                            flavor: `${description} (Slot ${slotNumber} - ${settlement.name})`
                        });
                    }
                }

                console.log(`🎲 Slot ${slotNumber} ${description}: ${roll.total}`);
                return roll.total;
            };
        };

        const slots = [];
        for (let index = 0; index < cargoSlotPlan.producerSlots; index += 1) {
            const slotRollFunction = createFoundryRollFunction(index + 1);
            slots.push(
                await this._processSlot({
                    slotNumber: index + 1,
                    settlementProps,
                    settlementFlags,
                    candidateTable,
                    season: normalizedSeason,
                    rollFunction: slotRollFunction
                })
            );
        }

        return {
            settlement: settlementContext,
            slotPlan: cargoSlotPlan,
            candidateTable,
            slots
        };
    }

    _normaliseFlags(flags) {
        if (!Array.isArray(flags)) {
            return [];
        }
        return flags
            .map(flag => String(flag || '').toLowerCase().trim())
            .filter(Boolean);
    }

    _buildSettlementContext(props, season) {
        return {
            name: props.name,
            region: props.region,
            size: {
                enum: props.sizeEnum,
                numeric: props.sizeNumeric,
                description: props.sizeDescription
            },
            wealth: {
                rating: props.wealthRating,
                description: props.wealthDescription
            },
            population: props.population,
            flags: props.productionCategories || [],
            produces: props.produces || [],
            demands: props.demands || [],
            season
        };
    }

    _calculateCargoSlots(props, flags, season) {
        const config = this.tradingConfig.cargoSlots || this.tradingConfig.merchantCount || {
            basePerSize: { "1": 1, "2": 2, "3": 3, "4": 4, "5": 5 },
            populationMultiplier: 0.0001,
            sizeMultiplier: 1.5,
            hardCap: 10
        };
        let baseSlots = null;

        if (config.basePerSize) {
            baseSlots = config.basePerSize[String(props.sizeNumeric)] ?? config.basePerSize[props.sizeNumeric];
        }

        if (baseSlots === null && Array.isArray(config.minSlotsPerSize) && config.minSlotsPerSize.length > 0) {
            const index = Math.max(0, Math.min(config.minSlotsPerSize.length - 1, (props.sizeNumeric || 1) - 1));
            baseSlots = config.minSlotsPerSize[index];
        }

        if (baseSlots === null) {
            baseSlots = Math.max(1, props.sizeNumeric || 1);
        }

        const contributions = [];
        contributions.push({ label: 'Base slots by size', value: baseSlots });

        const populationMultiplier = config.populationMultiplier ?? 0;
        const populationContribution = (props.population || 0) * populationMultiplier;
        if (populationContribution) {
            contributions.push({ label: 'Population multiplier', value: populationContribution });
        }

        const sizeMultiplier = config.sizeMultiplier ?? 0;
        const sizeContribution = (props.sizeNumeric || 0) * sizeMultiplier;
        if (sizeContribution) {
            contributions.push({ label: 'Size multiplier', value: sizeContribution });
        }

        let total = baseSlots + populationContribution + sizeContribution;

        const multiplierLog = [];
        (flags || []).forEach(flag => {
            const multiplier = config.flagMultipliers?.[flag];
            if (multiplier && multiplier !== 1) {
                const before = total;
                total *= multiplier;
                multiplierLog.push({
                    flag,
                    multiplier,
                    before,
                    after: total
                });
            }
        });

        const totalBeforeCap = total;
        const hardCap = config.hardCap;
        if (typeof hardCap === 'number' && total > hardCap) {
            multiplierLog.push({ flag: 'cap', multiplier: null, before: total, after: hardCap });
            total = hardCap;
        }

        const rounded = Math.max(1, Math.round(total));

        const reasons = contributions.map(entry => ({
            label: entry.label,
            value: Number(entry.value.toFixed(2))
        }));

        const formulaMultipliers = multiplierLog.map(entry => ({
            label: entry.flag === 'cap' ? 'Hard Cap' : `Flag: ${entry.flag}`,
            detail: entry.flag === 'cap'
                ? `Applied cap ${entry.after}/${entry.before}`
                : `×${entry.multiplier}`,
            before: entry.before,
            after: entry.after
        }));

        return {
            season,
            totalSlots: rounded,
            producerSlots: rounded,
            reasons,
            formula: {
                baseSlots,
                populationContribution,
                sizeContribution,
                multipliers: formulaMultipliers,
                rawTotal: totalBeforeCap,
                hardCap: hardCap ?? null
            },
            breakdown: {
                base: baseSlots,
                contributions,
                multipliers: multiplierLog,
                hardCap: hardCap ?? null,
                rawTotal: totalBeforeCap,
                finalTotal: total
            }
        };
    }

    _buildCandidateTable(props, flags, season) {
        const weightsConfig = this.tradingConfig.candidateWeights || {};
        const baseline = weightsConfig.baseline ?? 1;
        const producesBonus = weightsConfig.producesBonus ?? weightsConfig.producesWeight ?? 0;
        const demandsBonus = weightsConfig.demandsBonus ?? weightsConfig.demandsWeight ?? 0;
        const flagTransferMultiplier = weightsConfig.flagTransferMultiplier ?? 10;
        const seasonalScale = weightsConfig.seasonalWeightScale ?? 5;
        const minimumWeight = weightsConfig.minimumWeight ?? 1;

        const producesSet = new Set((props.produces || []).map(name => String(name)));
        const demandsSet = new Set((props.demands || []).map(name => String(name)));
        const seasonalShifts = this.tradingConfig.equilibrium?.seasonalShifts?.[season] || {};

        const entries = [];
        let totalWeight = 0;


        (this.dataManager.cargoTypes || []).forEach(cargo => {
            if (!cargo || !cargo.name) {
                return;
            }

            const reasons = [];
            let weight = baseline;

            if (producesSet.has(cargo.name)) {
                weight += producesBonus;
                reasons.push(`Produces ${cargo.name} (+${producesBonus})`);
            }

            if (demandsSet.has(cargo.name)) {
                weight += demandsBonus;
                reasons.push(`Demands ${cargo.name} (+${demandsBonus})`);
            }

            const category = cargo.category || 'Unknown';
            const flagTransfer = this._calculateFlagTransferWeight(flags, category, true);
            if (flagTransfer !== 0) {
                const delta = flagTransfer * flagTransferMultiplier;
                weight += delta;
                reasons.push(`Flag supply transfer (${flagTransfer.toFixed(2)}) × ${flagTransferMultiplier} = ${delta.toFixed(2)}`);
            }

            const seasonalTags = this._getCategoryTags(category);
            let seasonalDeltaAggregate = 0;
            seasonalTags.forEach(tag => {
                const shift = seasonalShifts[tag];
                if (shift) {
                    seasonalDeltaAggregate += shift;
                }
            });

            if (seasonalDeltaAggregate !== 0) {
                const seasonalDelta = seasonalDeltaAggregate * seasonalScale;
                weight += seasonalDelta;
                reasons.push(`Seasonal shift ${season}: ${seasonalDeltaAggregate.toFixed(2)} × ${seasonalScale} = ${seasonalDelta.toFixed(2)}`);
            }

            if (weight < minimumWeight) {
                reasons.push(`Minimum weight applied (${minimumWeight})`);
                weight = minimumWeight;
            }

            entries.push({
                name: cargo.name,
                category,
                weight,
                reasons,
                cargo
            });
            totalWeight += weight;
        });

        entries.sort((a, b) => b.weight - a.weight);
        entries.forEach(entry => {
            entry.probability = totalWeight > 0 ? (entry.weight / totalWeight) * 100 : 0;
        });

        return {
            season,
            totalWeight,
            entries
        };
    }

    async _processSlot({ slotNumber, settlementProps, settlementFlags, candidateTable, season, rollFunction = null }) {
        if (!candidateTable.entries || candidateTable.entries.length === 0) {
            throw new Error('No cargo candidates available to process cargo slots');
        }

        // Get the roll function for this slot
        const slotRollFunction = typeof rollFunction === 'function' ? rollFunction : this._percentile;

        const selection = await this._selectCargo(candidateTable, slotRollFunction);
        const balance = this._calculateBalance(selection, settlementProps, settlementFlags, season);
        const amount = await this._rollCargoAmount(balance, settlementProps, season, slotRollFunction, slotNumber);
        const quality = await this._evaluateQuality(balance, settlementProps, settlementFlags, slotRollFunction, slotNumber, selection.cargoData);
        const contraband = await this._evaluateContraband(settlementProps, settlementFlags, season, slotRollFunction, slotNumber);
        const merchantSkill = await this._generateMerchant(settlementProps, slotRollFunction, slotNumber);
        const desperation = this._buildDesperation(balance);
        const pricing = this._calculatePricing(selection, amount, quality, contraband, balance, season);

        return {
            slotNumber,
            season,
            cargo: {
                name: selection.name,
                category: selection.category,
                probability: selection.probability,
                reasons: selection.reasons,
                roll: selection.roll,
                alternatives: selection.alternatives
            },
            balance,
            amount,
            quality,
            contraband,
            merchant: merchantSkill,
            desperation,
            pricing
        };
    }

    async _selectCargo(candidateTable, rollFunction = null) {
        const entries = Array.isArray(candidateTable?.entries) ? candidateTable.entries : [];

        if (entries.length === 0) {
            return {
                name: 'Unavailable',
                category: 'Unavailable',
                probability: 0,
                reasons: ['No cargo candidates available'],
                cargoData: null,
                roll: null,
                alternatives: []
            };
        }

        const computedTotal = entries.reduce((sum, entry) => sum + ((entry && typeof entry.weight === 'number') ? entry.weight : 0), 0);
        const totalWeight = (candidateTable?.totalWeight && candidateTable.totalWeight > 0)
            ? candidateTable.totalWeight
            : computedTotal;
        const safeTotal = totalWeight > 0 ? totalWeight : entries.length;

        // For Foundry rolls, we need to simulate the weighted selection
        // We'll use a percentile roll and map it to the weighted selection
        const rollResult = rollFunction ? await rollFunction({ description: 'Cargo selection', postToChat: false }) : null;
        
        // Handle roll results properly
        const rollValue = rollResult?.total ?? rollResult ?? 0;
        
        const threshold = rollFunction 
            ? (rollValue / 100) * safeTotal
            : this.random() * safeTotal;
        let running = 0;
        let chosen = entries[entries.length - 1];

        for (const entry of entries) {
            const weight = typeof entry.weight === 'number' ? entry.weight : 0;
            running += weight;
            
            if (threshold <= running) {
                chosen = entry;
                break;
            }
        }

        const alternatives = entries.map(entry => {
            const weight = typeof entry.weight === 'number' ? entry.weight : 0;
            return {
                name: entry.name,
                probability: entry.probability ?? (safeTotal > 0 ? (weight / safeTotal) * 100 : 0),
                weight
            };
        });

        const chosenWeight = typeof chosen.weight === 'number' ? chosen.weight : 0;
        const chosenProbability = chosen.probability ?? (safeTotal > 0 ? (chosenWeight / safeTotal) * 100 : 0);

        return {
            name: chosen.name,
            category: chosen.category,
            probability: chosenProbability,
            reasons: chosen.reasons,
            cargoData: chosen.cargo,
            weight: chosenWeight,
            roll: threshold,
            alternatives
        };
    }

    _calculateBalance(selection, settlementProps, settlementFlags, season) {
        const equilibriumConfig = this.tradingConfig.equilibrium || {};
        let supply = equilibriumConfig.baseline?.supply ?? 100;
        let demand = equilibriumConfig.baseline?.demand ?? 100;
        const history = [];

        const applyMultiplier = (target, percentage, label) => {
            if (!percentage) {
                return;
            }

            const before = { supply, demand };
            if (target === 'supply') {
                supply = Math.max(0, supply * (1 + percentage));
            } else {
                demand = Math.max(0, demand * (1 + percentage));
            }

            history.push({
                label,
                target,
                percentage,
                before,
                after: { supply, demand }
            });
        };

        if ((settlementProps.produces || []).includes(selection.name)) {
            applyMultiplier('supply', equilibriumConfig.producesShift ?? 0, 'Settlement produces cargo');
        }

        if ((settlementProps.demands || []).includes(selection.name)) {
            applyMultiplier('demand', equilibriumConfig.demandsShift ?? 0, 'Settlement demands cargo');
        }

        (settlementFlags || []).forEach(flag => {
            const data = this._getFlagData(flag);
            if (!data) {
                return;
            }

            const supplyShift = (data.supplyTransfer ?? 0) + (data.categorySupplyTransfer?.[selection.category] ?? 0);
            if (supplyShift) {
                applyMultiplier('supply', supplyShift, `Flag ${flag} supply`);
            }

            const demandShift = (data.demandTransfer ?? 0) + (data.categoryDemandTransfer?.[selection.category] ?? 0);
            if (demandShift) {
                applyMultiplier('demand', demandShift, `Flag ${flag} demand`);
            }
        });

        const seasonalShifts = equilibriumConfig.seasonalShifts?.[season] || {};
        const seasonalTags = this._getCategoryTags(selection.category);
        seasonalTags.forEach(tag => {
            const shift = seasonalShifts[tag];
            if (!shift) {
                return;
            }

            if (shift >= 0) {
                applyMultiplier('supply', shift, `Seasonal ${tag}`);
            } else {
                applyMultiplier('demand', Math.abs(shift), `Seasonal ${tag}`);
            }
        });

        const wealthKey = String(settlementProps.wealthRating ?? '');
        const wealthShift = equilibriumConfig.wealthModifiers?.[wealthKey];
        if (wealthShift) {
            if (wealthShift >= 0) {
                applyMultiplier('demand', wealthShift, 'Wealth modifier (increased demand)');
            } else {
                applyMultiplier('supply', Math.abs(wealthShift), 'Wealth modifier (reduced supply)');
            }
        }

        const clamp = equilibriumConfig.clamp || {};
        if (typeof clamp.min === 'number') {
            supply = Math.max(clamp.min, supply);
            demand = Math.max(clamp.min, demand);
        }
        if (typeof clamp.max === 'number') {
            supply = Math.min(clamp.max, supply);
            demand = Math.min(clamp.max, demand);
        }

        const ratio = demand > 0 ? supply / demand : (equilibriumConfig.ratioThresholds?.glut ?? 1.5);
        const reverseRatio = supply > 0 ? demand / supply : (equilibriumConfig.ratioThresholds?.scarce ?? 1.5);

        const blockThreshold = equilibriumConfig.blockTradeThreshold || { supply: 10, demand: 10 };
        const desperationThreshold = equilibriumConfig.desperationThreshold || { supply: 20, demand: 20 };
        const ratioThresholds = equilibriumConfig.ratioThresholds || { glut: 1.5, scarce: 1.5 };

        let state = 'balanced';
        if (supply <= blockThreshold.supply || demand <= blockThreshold.demand) {
            state = 'blocked';
        } else if (supply <= desperationThreshold.supply || demand <= desperationThreshold.demand) {
            state = 'desperate';
        } else if (ratio >= (ratioThresholds.glut ?? 1.5)) {
            state = 'glut';
        } else if (reverseRatio >= (ratioThresholds.scarce ?? 1.5)) {
            state = 'scarce';
        }

        return {
            supply: Math.round(supply),
            demand: Math.round(demand),
            ratio,
            state,
            history
        };
    }

    async _rollCargoAmount(balance, settlementProps, season, rollFunction = null, slotNumber = null) {
        const amountConfig = this.tradingConfig.cargoAmount || {};
        const roundTo = amountConfig.roundTo ?? 10;
        const minimumEP = amountConfig.minimumEP ?? 10;
        const floor = amountConfig.supplyFloor ?? 0.5;
        const ceiling = amountConfig.supplyCeiling ?? 2.5;

        const roll = rollFunction 
            ? await rollFunction({ description: 'Cargo amount calculation', postToChat: true })
            : this._percentile();
        const sizeRating = Math.max(1, settlementProps.sizeNumeric || 1);
        const baseRoll = Math.ceil(roll / 10) * roundTo;
        const baseEP = baseRoll * sizeRating;

        const wealthRating = settlementProps.wealthRating ?? 3;
        const wealthScale = amountConfig.wealthModifierScale ?? 0;
        const wealthModifier = Math.max(0.1, 1 + (wealthRating - 3) * wealthScale);
        const preSupplyEP = baseEP * wealthModifier;

        const ratio = balance.demand > 0 ? balance.supply / balance.demand : ceiling;
        const supplyModifier = Math.min(ceiling, Math.max(floor, ratio));
        const adjustedEP = preSupplyEP * supplyModifier;

        let totalEP = Math.max(minimumEP, Math.round(adjustedEP / roundTo) * roundTo);
        if (totalEP < minimumEP) {
            totalEP = minimumEP;
        }

        const units = totalEP / roundTo;
        const notes = [
            `1d100 roll ${roll} ⇒ rounded chunk ${baseRoll} EP`,
            `Size rating ×${sizeRating.toFixed(2)} ⇒ ${Math.round(baseEP)} EP`,
            `Wealth modifier ×${wealthModifier.toFixed(2)} ⇒ ${Math.round(preSupplyEP)} EP`,
            `Supply/Demand ratio ${ratio.toFixed(2)} ⇒ ×${supplyModifier.toFixed(2)}`
        ];

        if (totalEP === minimumEP) {
            notes.push(`Minimum availability applied (${minimumEP} EP)`);
        }

        return {
            roll,
            season,
            roundTo,
            baseRoll,
            baseEP: Math.round(baseEP),
            sizeModifier: sizeRating,
            wealthModifier: Number(wealthModifier.toFixed(2)),
            supplyModifier: Number(supplyModifier.toFixed(2)),
            supplyRatio: Number(ratio.toFixed(2)),
            adjustedEP: Math.round(adjustedEP),
            totalEP,
            units,
            notes
        };
    }

    async _evaluateQuality(balance, settlementProps, settlementFlags, rollFunction = null, slotNumber = null, cargoData = null) {
        // Import QualitySystem if not already available
        if (!this.qualitySystem) {
            const { QualitySystem } = await import('./quality-system.js');
            this.qualitySystem = new QualitySystem(this.dataManager, {
                random: this.random,
                logger: this.logger
            });
        }

        // Check if this is Wine/Brandy cargo that uses the special system
        const isWineBrandy = cargoData && this.qualitySystem.isWineBrandyCargo(cargoData);
        
        if (isWineBrandy) {
            return await this._evaluateWineBrandyQuality(cargoData, settlementFlags, rollFunction);
        } else {
            return await this._evaluateStandardQuality(balance, settlementProps, settlementFlags, rollFunction, slotNumber);
        }
    }

    async _evaluateWineBrandyQuality(cargoData, settlementFlags, rollFunction = null) {
        // Roll actual quality
        const actualQuality = this.qualitySystem.rollWineBrandyQuality(settlementFlags, cargoData.name);
        
        // Get dishonesty setting
        const dishonestyChance = typeof game !== 'undefined' && game.settings 
            ? game.settings.get(this.MODULE_ID, 'merchantDishonestyChance') / 100 
            : 0.5;
        
        // Roll for merchant honesty
        const honestyResult = this.qualitySystem.rollMerchantHonesty(dishonestyChance);
        
        // Apply dishonesty if applicable
        const finalQuality = this.qualitySystem.applyQualityInflation(
            actualQuality, 
            honestyResult.qualityInflation, 
            true
        );

        // Generate tooltip for evaluate test if needed
        const evaluateTooltip = this.qualitySystem.generateEvaluateTooltip(finalQuality, true);

        return {
            tier: finalQuality.merchantQuality || finalQuality.quality,
            actualTier: finalQuality.quality,
            score: finalQuality.finalRoll,
            actualScore: finalQuality.finalRoll,
            priceInBP: finalQuality.merchantPriceInBP || finalQuality.priceInBP,
            actualPriceInBP: finalQuality.priceInBP,
            system: 'wine_brandy',
            dishonest: honestyResult.isDishonest,
            evaluateTooltip,
            components: [
                { label: `d10 roll`, value: finalQuality.d10Roll },
                { label: 'Settlement bonuses', value: finalQuality.bonuses.total },
                ...(finalQuality.bonuses.details.map(bonus => ({
                    label: bonus.source,
                    value: `+${bonus.amount} (${bonus.cargo})`
                })))
            ],
            rollDetails: finalQuality.rollDetails
        };
    }

    async _evaluateStandardQuality(balance, settlementProps, settlementFlags, rollFunction = null, slotNumber = null) {
        const qualityConfig = this.tradingConfig.qualityEvaluation || {};
        const clamp = qualityConfig.clamp || {};

        let score = settlementProps.wealthRating || 3;
        const components = [{
            label: 'Wealth rating',
            value: settlementProps.wealthRating || 3
        }];

        const flagBonus = (settlementFlags || []).reduce((sum, flag) => {
            const data = this._getFlagData(flag);
            return sum + (data?.quality ?? 0);
        }, 0);

        if (flagBonus) {
            score += flagBonus;
            components.push({ label: 'Flag quality bonus', value: flagBonus });
        }

        const pressureModifier = qualityConfig.marketPressureModifiers?.[balance.state] ?? 0;
        if (pressureModifier) {
            score += pressureModifier;
            components.push({ label: `Market state (${balance.state})`, value: pressureModifier });
        }

        // Add random quality roll
        const qualityRoll = qualityConfig.qualityRoll || {};
        const percentileRoll = rollFunction 
            ? await rollFunction({ description: 'Cargo quality determination', postToChat: true })
            : this._percentile();
        const percentileModifier = this._resolvePercentileModifier(percentileRoll, qualityRoll.percentileTable || {});
        score += percentileModifier;
        components.push({ 
            label: `Quality roll (${percentileRoll})`, 
            value: percentileModifier 
        });

        const varianceRange = qualityRoll.variance ?? 0;
        let varianceRoll = 0;
        if (varianceRange > 0) {
            // Variance is a random modifier, not a percentile roll - use the fallback calculation
            varianceRoll = Math.floor(this.random() * (varianceRange * 2 + 1)) - varianceRange;
            score += varianceRoll;
            components.push({ 
                label: `Variance roll (±${varianceRange})`, 
                value: varianceRoll 
            });
        }

        if (typeof clamp.min === 'number') {
            score = Math.max(clamp.min, score);
        }
        if (typeof clamp.max === 'number') {
            score = Math.min(clamp.max, score);
        }

        const actualTier = this.qualitySystem.mapQualityTier(score, qualityConfig.tierThresholds);
        
        // Apply dishonesty for regular cargo
        const dishonestyChance = typeof game !== 'undefined' && game.settings 
            ? game.settings.get(this.MODULE_ID, 'merchantDishonestyChance') / 100 
            : 0.5;
        
        const honestyResult = this.qualitySystem.rollMerchantHonesty(dishonestyChance);
        const finalQuality = this.qualitySystem.applyQualityInflation(
            { tier: actualTier }, 
            honestyResult.qualityInflation, 
            false
        );

        const evaluateTooltip = this.qualitySystem.generateEvaluateTooltip(finalQuality, false);

        return {
            tier: finalQuality.merchantTier || actualTier,
            actualTier,
            score,
            actualScore: score,
            system: 'standard',
            dishonest: honestyResult.isDishonest,
            evaluateTooltip,
            components,
            rollDetails: {
                percentileRoll,
                percentileModifier,
                varianceRoll,
                varianceRange
            }
        };
    }

    async _evaluateContraband(settlementProps, settlementFlags, season, rollFunction = null, slotNumber = null) {
        const contrabandConfig = this.tradingConfig.contraband || {};
        let chance = contrabandConfig.baseChance ?? 0.05;
        const steps = [
            {
                label: 'Base chance',
                value: chance,
                current: chance
            }
        ];

        // Add flag bonuses
        (settlementFlags || []).forEach(flag => {
            const data = this._getFlagData(flag);
            if (data?.contrabandChance) {
                chance += data.contrabandChance;
                steps.push({
                    label: `Flag: ${flag}`,
                    value: data.contrabandChance,
                    current: chance
                });
            }
        });

        // Add size bonus
        const sizeBonus = contrabandConfig.sizeBonuses?.[String(settlementProps.sizeNumeric)] ?? 0;
        if (sizeBonus > 0) {
            chance += sizeBonus;
            steps.push({
                label: `Settlement size ${settlementProps.sizeNumeric}`,
                value: sizeBonus,
                current: chance
            });
        }

        // Apply seasonal multiplier
        const seasonalMultiplier = contrabandConfig.seasonalMultipliers?.[season] ?? 1;
        if (seasonalMultiplier !== 1) {
            chance = Math.max(0, chance) * seasonalMultiplier;
            steps.push({
                label: `Seasonal multiplier (${season})`,
                value: seasonalMultiplier,
                current: chance
            });
        }

        // Clamp the chance
        chance = Math.max(0, chance);
        chance = Math.min(0.95, chance);

        const roll = rollFunction 
            ? await rollFunction({ description: 'Contraband check', postToChat: true })
            : this._percentile();
        const triggered = roll <= chance * 100;

        return {
            chance: chance * 100,
            roll,
            contraband: triggered,
            steps
        };
    }

    async _generateMerchant(settlementProps, rollFunction = null, slotNumber = null) {
        const skillConfig = this.tradingConfig.skillDistribution || {};

        const baseSkill = skillConfig.baseSkill ?? 25;
        const wealthContribution = (skillConfig.wealthModifier ?? 0) * (settlementProps.wealthRating ?? 0);
        let computedSkill = baseSkill + wealthContribution;

        const percentileRoll = rollFunction 
            ? await rollFunction({ description: 'Merchant skill determination', postToChat: true })
            : this._percentile();
        const percentileModifier = this._resolvePercentileModifier(percentileRoll, skillConfig.percentileTable || {});
        computedSkill += percentileModifier;

        const varianceRange = skillConfig.variance ?? 0;
        let varianceRoll = 0;
        if (varianceRange > 0) {
            // Variance is a random modifier, not a percentile roll - use the fallback calculation
            varianceRoll = Math.floor(this.random() * (varianceRange * 2 + 1)) - varianceRange;
            computedSkill += varianceRoll;
        }

        const minSkill = skillConfig.minSkill ?? 5;
        const maxSkill = skillConfig.maxSkill ?? 95;
        const finalSkill = Math.max(minSkill, Math.min(maxSkill, Math.round(computedSkill)));

        return {
            skill: finalSkill,
            calculation: {
                baseSkill,
                wealthRating: settlementProps.wealthRating ?? 0,
                wealthModifier: skillConfig.wealthModifier ?? 0,
                wealthContribution,
                percentileRoll,
                percentileModifier,
                varianceRange,
                varianceRoll,
                computedSkill: Math.round(computedSkill),
                minSkill,
                maxSkill,
                clamped: finalSkill !== Math.round(computedSkill)
            }
        };
    }

    _calculatePricing(selection, amount, quality, contraband, balance, season) {
        const pricingConfig = this.tradingConfig.pricing || {};
        const qualityMultipliers = pricingConfig.qualityMultipliers || {};

        // Handle Wine/Brandy pricing differently
        let basePricePer10;
        if (quality.system === 'wine_brandy' && quality.priceInBP) {
            // Wine/Brandy uses fixed prices from quality table (per 10 EP)
            basePricePer10 = quality.priceInBP;
        } else {
            // Regular cargo uses seasonal pricing
            basePricePer10 = this.dataManager.getSeasonalPrice(selection.cargoData, season);
            if (typeof basePricePer10 !== 'number' || Number.isNaN(basePricePer10)) {
                throw new Error(`Missing seasonal pricing for ${selection.name} in ${season}`);
            }
        }

        const basePricePerEP = basePricePer10 / 10;
        const steps = [
            {
                label: 'Seasonal base price',
                per10: Number(basePricePer10.toFixed(2)),
                perEP: Number(basePricePerEP.toFixed(2))
            }
        ];

        let pricePer10 = basePricePer10;

        // For Wine/Brandy, quality is already included in the base price
        if (quality.system !== 'wine_brandy') {
            const qualityMultiplier = qualityMultipliers[quality.tier] ?? 1;
            if (qualityMultiplier !== 1) {
                pricePer10 *= qualityMultiplier;
                steps.push({
                    label: `Quality (${quality.tier}) ×${qualityMultiplier.toFixed(2)}`,
                    per10: Number(pricePer10.toFixed(2)),
                    perEP: Number((pricePer10 / 10).toFixed(2))
                });
            }
        }

        if (contraband.contraband) {
            const discount = pricingConfig.contrabandDiscount ?? 1;
            pricePer10 *= discount;
            steps.push({
                label: `Contraband adjustment ×${discount.toFixed(2)}`,
                per10: Number(pricePer10.toFixed(2)),
                perEP: Number((pricePer10 / 10).toFixed(2))
            });
        }

        const desperationMultiplier = pricingConfig.desperationPenalties?.[balance.state];
        if (desperationMultiplier) {
            pricePer10 *= desperationMultiplier;
            steps.push({
                label: `Market state (${balance.state}) ×${desperationMultiplier.toFixed(2)}`,
                per10: Number(pricePer10.toFixed(2)),
                perEP: Number((pricePer10 / 10).toFixed(2))
            });
        }

        const quantity = amount.totalEP || 0;
        const units = amount.units ?? (quantity / (amount.roundTo ?? 10));
        const finalPricePer10 = Number(pricePer10.toFixed(2));
        const finalPricePerEP = Number((pricePer10 / 10).toFixed(2));
        const totalValue = Number((finalPricePerEP * quantity).toFixed(2));

        return {
            season,
            basePricePer10: Number(basePricePer10.toFixed(2)),
            basePricePerEP: Number(basePricePerEP.toFixed(2)),
            finalPricePer10,
            finalPricePerEP,
            steps,
            quantity,
            units,
            totalValue
        };
    }
_buildDesperation(balance) {
    const desperationConfig = this.tradingConfig.desperation || {};
    const pricingConfig = this.tradingConfig.pricing || {};

    const applicable = balance.state === 'desperate' || balance.state === 'scarce';

    return {
        state: balance.state,
        applicable,
        modifiers: applicable ? {
            price: pricingConfig.desperationPenalties?.[balance.state] ?? 1,
            quantity: 1 - (desperationConfig.quantityReduction ?? 0),
            skill: 1 - (desperationConfig.skillPenalty ?? 0),
            qualityShift: desperationConfig.qualityPenalty ?? 0
        } : null
    };
}

    _buildCandidateSnapshot(candidateTable, selectedName) {
        if (!candidateTable || !Array.isArray(candidateTable.entries)) {
            return { season: candidateTable?.season, totalWeight: 0, entryCount: 0, entries: [] };
        }

        const sortedEntries = candidateTable.entries
            .map(entry => ({
                name: entry.name,
                category: entry.category,
                weight: Number((entry.weight ?? 0).toFixed(2)),
                probability: Number((entry.probability ?? 0).toFixed(2)),
                reasons: entry.reasons || [],
                selected: entry.name === selectedName
            }))
            .sort((a, b) => b.weight - a.weight);

        const topEntries = sortedEntries.slice(0, 10);

        return {
            season: candidateTable.season,
            totalWeight: Number((candidateTable.totalWeight ?? 0).toFixed(2)),
            entryCount: candidateTable.entries.length,
            entries: topEntries
        };
    }    _calculateFlagTransferWeight(flags, category, isProducer) {
        if (!Array.isArray(flags) || flags.length === 0) {
            return 0;
        }

        return flags.reduce((sum, flag) => {
            const data = this._getFlagData(flag);
            if (!data) {
                return sum;
            }

            if (isProducer) {
                const direct = data.supplyTransfer ?? 0;
                const categorySpecific = data.categorySupplyTransfer?.[category] ?? 0;
                return sum + direct + categorySpecific;
            }

            const direct = data.demandTransfer ?? 0;
            const categorySpecific = data.categoryDemandTransfer?.[category] ?? 0;
            return sum + direct + categorySpecific;
        }, 0);
    }

    _getFlagData(flag) {
        if (!flag) {
            return null;
        }
        return this.sourceFlags?.[flag] || null;
    }

    _getCategoryTags(category) {
        const tagsConfig = this.tradingConfig.seasonalCategoryTags || {};
        if (Array.isArray(tagsConfig[category])) {
            return tagsConfig[category];
        }
        if (category && Array.isArray(tagsConfig[category.toLowerCase?.()] ?? null)) {
            return tagsConfig[category.toLowerCase()];
        }
        if (Array.isArray(tagsConfig.Unknown)) {
            return tagsConfig.Unknown;
        }
        if (Array.isArray(tagsConfig.default)) {
            return tagsConfig.default;
        }
        return [];
    }

    _mapQualityTier(score, thresholds = []) {
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

    _resolvePercentileModifier(roll, table) {
        const entries = Object.entries(table || {}).map(([key, value]) => ({
            percentile: Number(key),
            value
        })).filter(entry => !Number.isNaN(entry.percentile));

        if (entries.length === 0) {
            return 0;
        }

        entries.sort((a, b) => a.percentile - b.percentile);

        for (const entry of entries) {
            if (roll <= entry.percentile) {
                return entry.value;
            }
        }

        return entries[entries.length - 1].value;
    }

    _describeSkill(skill) {
        if (skill >= 85) return 'Legendary negotiator';
        if (skill >= 70) return 'Master merchant';
        if (skill >= 55) return 'Seasoned trader';
        if (skill >= 40) return 'Competent haggler';
        if (skill >= 25) return 'Novice merchant';
        return 'Greenhorn dealer';
    }

    _percentile() {
        if (this.rollPercentile) {
            // Use Foundry's dice system if available
            return this.rollPercentile();
        }
        // Fallback to random number generator
        return Math.floor(this.random() * 100) + 1;
    }
}

if (typeof window !== 'undefined') {
    window.CargoAvailabilityPipeline = CargoAvailabilityPipeline;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = CargoAvailabilityPipeline;
}

export { CargoAvailabilityPipeline };
