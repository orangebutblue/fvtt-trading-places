console.log('Trading Places | Loading trading-engine.js');

import { PurchasePriceCalculator } from './purchase-price-calculator.js';
import { SaleMechanics } from './sale-mechanics.js';

function safeRequire(path) {
    try {
        if (typeof require !== 'undefined') {
            return require(path);
        }
    } catch (error) {
        // Module unavailable in this runtime; caller will handle fallback
    }
    return null;
}

let CachedHagglingMechanicsClass = null;

function resolveHagglingMechanicsClass() {
    if (typeof window !== 'undefined' && window.HagglingMechanics) {
        return window.HagglingMechanics;
    }

    if (!CachedHagglingMechanicsClass) {
        const module = safeRequire('./haggling-mechanics.js');
        if (module) {
            CachedHagglingMechanicsClass = module.HagglingMechanics || module.default || module;
        }
    }

    return CachedHagglingMechanicsClass;
}


class TradingEngine {
    constructor(dataManager, options = {}) {
        if (!dataManager) {
            throw new Error('TradingEngine requires a DataManager instance');
        }

        this.dataManager = dataManager;
        this.currentSeason = options.currentSeason || null;
        this.logger = options.logger || null; // Will be set by integration

        this.pipeline = options.pipeline || null;
        this.pipelineFactory = options.pipelineFactory || null;
        this.pipelineOptions = options.pipelineOptions || {};
        this.pipelineEnabled = options.disablePipeline === true
            ? false
            : (options.enablePipeline === true || !!this.pipeline || !!this.pipelineFactory);
        this.pipelineStatus = this.pipelineEnabled ? 'pending' : 'disabled';
        this.planCache = new Map();
        this.lastPipelineError = null;

        this.hagglingMechanics = null;
        this.purchasePriceCalculator = new PurchasePriceCalculator(dataManager, this);
        this.saleMechanics = new SaleMechanics(dataManager, this);
    }

    /**
     * Set the debug logger instance
     * @param {Object} logger - Debug logger instance
     */
    setLogger(logger) {
        this.logger = logger;

        if (this.pipeline && typeof this.pipeline.setLogger === 'function') {
            this.pipeline.setLogger(logger);
        }

        if (this.hagglingMechanics && typeof this.hagglingMechanics.setLogger === 'function') {
            this.hagglingMechanics.setLogger(logger);
        }

        if (this.purchasePriceCalculator && typeof this.purchasePriceCalculator.setLogger === 'function') {
            this.purchasePriceCalculator.setLogger(logger);
        }

        if (this.saleMechanics && typeof this.saleMechanics.setLogger === 'function') {
            this.saleMechanics.setLogger(logger);
        }
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

    getHagglingMechanics(options = {}) {
        if (this.hagglingMechanics) {
            return this.hagglingMechanics;
        }

        const HagglingMechanicsClass = resolveHagglingMechanicsClass();
        if (!HagglingMechanicsClass) {
            throw new Error('Haggling mechanics module not available');
        }

        const tradingConfig = options.tradingConfig || this.dataManager?.tradingConfig || this.dataManager?.config || {};
        this.hagglingMechanics = new HagglingMechanicsClass(this.dataManager, tradingConfig);

        if (this.logger && typeof this.hagglingMechanics.setLogger === 'function') {
            this.hagglingMechanics.setLogger(this.logger);
        }

        return this.hagglingMechanics;
    }

    async performHaggleTest(playerSkill, merchantSkill, hasDealmakerTalent = false, options = {}, rollFunction = null) {
        const mechanics = this.getHagglingMechanics(options);
        return mechanics.performHaggleTest(playerSkill, merchantSkill, hasDealmakerTalent, options, rollFunction);
    }

    async performGossipTest(playerSkill, options = {}, rollFunction = null) {
        const mechanics = this.getHagglingMechanics(options);
        return mechanics.performGossipTest(playerSkill, options, rollFunction);
    }

    generateHaggleTestMessage(haggleResult, options = {}) {
        const mechanics = this.getHagglingMechanics(options);
        return mechanics.generateHaggleTestMessage(haggleResult);
    }

    generateSkillTestMessage(testResult, options = {}) {
        const mechanics = this.getHagglingMechanics(options);
        return mechanics.generateSkillTestMessage(testResult);
    }

    _normalizeSeason(season) {
        if (!season || typeof season !== 'string') {
            throw new Error('Season must be a non-empty string');
        }

        const normalized = season.toLowerCase();
        const validSeasons = ['spring', 'summer', 'autumn', 'winter'];

        if (!validSeasons.includes(normalized)) {
            throw new Error(`Invalid season: ${season}. Must be one of: ${validSeasons.join(', ')}`);
        }

        return normalized;
    }

    _resolveSettlement(settlement) {
        if (!settlement) {
            throw new Error('Settlement is required');
        }

        if (typeof settlement === 'string') {
            const resolved = this.dataManager.getSettlement(settlement);
            if (!resolved) {
                throw new Error(`Settlement not found: ${settlement}`);
            }
            return resolved;
        }

        return settlement;
    }

    _estimateAvailabilityChance(slotPlan, settlement) {
        if (slotPlan && typeof slotPlan.calculatedChance === 'number') {
            return slotPlan.calculatedChance;
        }

        if (slotPlan && typeof slotPlan.chance === 'number') {
            return slotPlan.chance;
        }

        return this.calculateAvailabilityChance(settlement);
    }

    /**
     * Set the current trading season
     * @param {string} season - Season name (spring, summer, autumn, winter)
     */
    setCurrentSeason(season, { persist = true } = {}) {
        const normalizedSeason = this._normalizeSeason(season);
        const previousSeason = this.currentSeason;

        const logger = this.getLogger();
        logger.logSystem('Season Change', `Trading season changed from ${previousSeason || 'none'} to ${normalizedSeason}`, {
            previousSeason,
            newSeason: normalizedSeason
        });
        
        this.currentSeason = normalizedSeason;

        if (previousSeason !== normalizedSeason) {
            this.planCache.clear();
        }

        if (!persist) {
            return this.currentSeason;
        }

        const persistSeason = async () => {
            let persisted = false;

            if (typeof this.dataManager?.setCurrentSeason === 'function') {
                try {
                    const result = await this.dataManager.setCurrentSeason(normalizedSeason);
                    persisted = result === true;
                } catch (error) {
                    logger.logSystem('Season Change', 'DataManager.setCurrentSeason failed', { error: error.message });
                }
            }

            if (!persisted) {
                if (typeof globalThis !== 'undefined' && globalThis.foundryMock?.setSetting) {
                    await globalThis.foundryMock.setSetting('trading-places', 'currentSeason', normalizedSeason);
                    persisted = true;
                } else if (typeof game !== 'undefined' && game.settings && game.settings.set) {
                    await game.settings.set('trading-places', 'currentSeason', normalizedSeason);
                    persisted = true;
                }
            }

            return this.currentSeason;
        };

        return persistSeason();
    }

    /**
     * Get the current trading season
     * @returns {string|null} - Current season or null if not set
     */
    getCurrentSeason() {
        return this.currentSeason || this.dataManager?.currentSeason || null;
    }

    /**
     * Validate that season is set before trading operations
     * @throws {Error} - If season is not set
     */
    validateSeasonSet() {
        if (!this.getCurrentSeason()) {
            throw new Error('Season must be set before trading operations. Call setCurrentSeason() first.');
        }
    }

    /**
     * Validate that a season string is valid
     * @param {string} season - Season to validate
     * @throws {Error} - If season is invalid
     */
    validateSeason(season) {
        this._normalizeSeason(season);
    }

    /**
     * Normalize season string to lowercase
     * @param {string} season - Season to normalize
     * @returns {string} - Normalized season
     */
    normalizeSeason(season) {
        return this._normalizeSeason(season);
    }

    // ===== CARGO AVAILABILITY CHECKING ALGORITHM =====

    /**
     * Step 1: Calculate base cargo availability chance
     * Formula: (Size + Wealth) × 10%
     * @param {Object} settlement - Settlement object
     * @returns {number} - Availability percentage (0-100)
     */
    calculateAvailabilityChance(settlement) {
        if (!settlement) {
            throw new Error('Settlement object is required');
        }

        const logger = this.getLogger();
        const properties = this.dataManager.getSettlementProperties(settlement);
        const chance = (properties.sizeNumeric + properties.wealthRating) * 10;
        const cappedChance = Math.min(chance, 100);
        
        // Log the calculation step
        logger.logCalculation(
            'Availability Chance',
            '(Size + Wealth) × 10',
            {
                settlementName: settlement.name,
                settlementSize: settlement.size,
                sizeNumeric: properties.sizeNumeric,
                wealthRating: properties.wealthRating,
                rawChance: chance,
                cappedAt100: cappedChance !== chance
            },
            cappedChance,
            `${settlement.name} has ${cappedChance}% cargo availability chance`
        );
        
        return cappedChance;
    }

    /**
     * Step 1: Check cargo availability using dice roll
     * @param {Object} settlement - Settlement object
     * @param {Function} rollFunction - Function that returns 1d100 result (for testing)
     * @returns {Object} - Availability check result
     */
    checkCargoAvailability(settlement, rollFunction = null, options = {}) {
        const resolvedSettlement = this._resolveSettlement(settlement);

        if (!this.pipelineEnabled && options.plan === undefined) {
            return this._legacyCheckCargoAvailability(resolvedSettlement, rollFunction);
        }

        if (options.plan !== undefined) {
            return this._processAvailabilityPlan(resolvedSettlement, options.plan, rollFunction, options);
        }

        return this._checkCargoAvailabilityWithPipeline(resolvedSettlement, rollFunction, options);
    }

    _legacyCheckCargoAvailability(settlement, rollFunction = null) {
        const logger = this.getLogger();

        const logAndBuildResult = (roll, chance, rollResult) => {
            const available = roll <= chance;

            logger.logDiceRoll(
                'Cargo Availability Check',
                'd100',
                [],
                roll,
                chance,
                available,
                available ? `${roll} ≤ ${chance}` : `${roll} > ${chance}`
            );

            const result = {
                available,
                chance,
                roll,
                rollResult,
                settlement: settlement.name
            };

            logger.logDecision(
                'Cargo Availability',
                available ? 'Cargo Available' : 'No Cargo Available',
                { roll, chance, settlement: settlement.name },
                ['Cargo Available', 'No Cargo Available'],
                `Roll of ${roll} ${available ? 'succeeded against' : 'failed against'} target of ${chance}`
            );

            return result;
        };

        logger.logAlgorithmStep(
            'Buying Algorithm',
            'Step 1',
            'Cargo Availability Check',
            { settlementName: settlement.name, settlementRegion: settlement.region },
            'Death on the Reik Companion - Buying Algorithm Step 1'
        );

        const chance = this.calculateAvailabilityChance(settlement);

        if (rollFunction) {
            const rollValue = rollFunction();

            if (rollValue && typeof rollValue.then === 'function') {
                return rollValue.then(resolvedRoll => {
                    const rollResult = {
                        total: resolvedRoll,
                        formula: '1d100',
                        result: resolvedRoll.toString()
                    };
                    return logAndBuildResult(resolvedRoll, chance, rollResult);
                });
            }

            const rollResult = {
                total: rollValue,
                formula: '1d100',
                result: rollValue.toString()
            };
            return logAndBuildResult(rollValue, chance, rollResult);
        }

        try {
            const rollResult = rollFunction ? { total: rollFunction(), formula: '1d100', result: rollFunction().toString() } : this.rollDice('1d100');
            return logAndBuildResult(rollResult.total, chance, rollResult);
        } catch (error) {
            this.getLogger().logSystem('Dice Roller', 'rollDice failed, treating as unavailable', { error: error.message });
            return logAndBuildResult(101, chance, { total: 101, formula: '1d100', result: '101', error: error.message });
        }
    }

    async _checkCargoAvailabilityWithPipeline(settlement, rollFunction = null, options = {}) {
        try {
            const plan = await this.generateAvailabilityPlan({
                settlement,
                season: options.season || this.getCurrentSeason() || 'spring',
                forceRefresh: !!rollFunction
            });

            if (!plan || !Array.isArray(plan.slots)) {
                return this._legacyCheckCargoAvailability(settlement, rollFunction);
            }

            return this._processAvailabilityPlan(settlement, plan, rollFunction, options);
        } catch (error) {
            this.getLogger().logSystem('Pipeline Error', 'Falling back to legacy availability check', { error: error.message });
            return this._legacyCheckCargoAvailability(settlement, rollFunction);
        }
    }

    async _processAvailabilityPlan(settlement, planOrPromise, rollFunction = null) {
        const plan = await Promise.resolve(planOrPromise);

        if (!plan || !Array.isArray(plan.slots)) {
            return this._legacyCheckCargoAvailability(settlement, rollFunction);
        }

        const logger = this.getLogger();

        logger.logAlgorithmStep(
            'Buying Algorithm',
            'Step 1',
            'Cargo Availability Check',
            { settlementName: settlement.name, settlementRegion: settlement.region },
            'Death on the Reik Companion - Buying Algorithm Step 1'
        );

        const chance = this._estimateAvailabilityChance(plan.slotPlan, settlement);

        let roll;
        let rollResult;

        if (rollFunction) {
            roll = await rollFunction();
            rollResult = { total: roll, formula: '1d100', result: roll.toString() };
        } else {
            rollResult = await this.rollAvailability(chance);
            roll = rollResult.total;
        }

        const availableByPlan = plan.slots.length > 0;
        const available = availableByPlan && (roll <= chance);

        logger.logDiceRoll(
            'Cargo Availability Check',
            'd100',
            [],
            roll,
            chance,
            available,
            available ? `${roll} ≤ ${chance}` : `${roll} > ${chance}`
        );

        logger.logDecision(
            'Cargo Availability',
            available ? 'Cargo Available' : 'No Cargo Available',
            { roll, chance, settlement: settlement.name },
            ['Cargo Available', 'No Cargo Available'],
            `Roll of ${roll} ${available ? 'succeeded against' : 'failed against'} target of ${chance}`
        );

        return {
            available,
            chance,
            roll,
            rollResult,
            settlement: settlement.name,
            slotPlan: plan.slotPlan || null,
            candidateTable: plan.candidateTable || null,
            plan
        };
    }

    async generateAvailabilityPlan({ settlement, season, forceRefresh = false } = {}) {
        if (!this.pipelineEnabled) {
            this.pipelineStatus = 'disabled';
            return null;
        }

        const pipeline = this._getPipeline();
        if (!pipeline) {
            return null;
        }

        const resolvedSettlement = this._resolveSettlement(settlement);
        const resolvedSeason = this._normalizeSeason(season || this.getCurrentSeason() || 'spring');
        const cacheKey = this._buildPlanCacheKey(resolvedSettlement, resolvedSeason);

        if (!forceRefresh && this.planCache.has(cacheKey)) {
            return this.planCache.get(cacheKey);
        }

        let rawPlan;

        try {
            if (typeof pipeline.generatePlan === 'function') {
                rawPlan = await pipeline.generatePlan({ settlement: resolvedSettlement, season: resolvedSeason });
            } else if (typeof pipeline.createPlan === 'function') {
                rawPlan = await pipeline.createPlan(resolvedSettlement, resolvedSeason);
            } else {
                throw new Error('Pipeline must expose generatePlan() or createPlan()');
            }
        } catch (error) {
            this.pipelineStatus = 'error';
            this.getLogger().logSystem('Pipeline Error', 'Failed to generate availability plan', { error: error.message });
            return null;
        }

        try {
            const plan = this._standardiseAvailabilityPlan(rawPlan, resolvedSettlement, resolvedSeason);
            this.planCache.set(cacheKey, plan);
            this.pipelineStatus = 'ready';
            return plan;
        } catch (error) {
            this.pipelineStatus = 'error';
            this.getLogger().logSystem('Pipeline Error', 'Invalid availability plan returned', { error: error.message });
            return null;
        }
    }

    _standardiseAvailabilityPlan(plan, settlement, season) {
        if (!plan || typeof plan !== 'object') {
            throw new Error('Availability plan must be an object');
        }

        const slots = Array.isArray(plan.slots) ? plan.slots.map(slot => this._standardisePlanSlot(slot)) : [];

        return {
            settlement: plan.settlement || settlement,
            season,
            slotPlan: plan.slotPlan || null,
            candidateTable: plan.candidateTable || null,
            slots
        };
    }

    _standardisePlanSlot(slot) {
        if (!slot || typeof slot !== 'object') {
            return { cargoType: null, tier: null, probability: 0, data: null };
        }

        return {
            cargoType: slot.cargoType || slot.type || null,
            label: slot.label || slot.cargoName || null,
            tier: slot.tier ?? null,
            probability: typeof slot.probability === 'number' ? slot.probability : null,
            data: slot
        };
    }

    _buildPlanCacheKey(settlement, season) {
        const identifier = settlement.id || settlement._id || settlement.uuid || settlement.key || settlement.name;
        if (!identifier) {
            throw new Error('Settlement must provide an identifier for plan caching');
        }
        return `${season}::${identifier}`;
    }

    _getPipeline() {
        if (!this.pipelineEnabled) {
            this.pipelineStatus = 'disabled';
            return null;
        }

        if (this.pipeline) {
            return this.pipeline;
        }

        let pipelineInstance = null;

        if (typeof this.pipelineFactory === 'function') {
            pipelineInstance = this.pipelineFactory(this.dataManager, this.pipelineOptions);
        } else if (typeof this.dataManager?.getCargoAvailabilityPipeline === 'function') {
            pipelineInstance = this.dataManager.getCargoAvailabilityPipeline(this.pipelineOptions);
        } else {
            const PipelineClass = safeRequire('./cargo-availability-pipeline.js')
                || (typeof window !== 'undefined' ? window.CargoAvailabilityPipeline : null);

            if (PipelineClass) {
                pipelineInstance = new PipelineClass(this.dataManager, this.pipelineOptions);
            }
        }

        if (!pipelineInstance) {
            this.pipelineStatus = 'unavailable';
            return null;
        }

        if (typeof pipelineInstance.setLogger === 'function') {
            pipelineInstance.setLogger(this.getLogger());
        }

        this.pipeline = pipelineInstance;
        this.pipelineStatus = 'ready';
        return this.pipeline;
    }

    /**
     * Step 2A: Determine available cargo types based on settlement production
     * @param {Object} settlement - Settlement object
     * @param {string} season - Current season
     * @returns {Array} - Array of available cargo type names
     */
    determineCargoTypes(settlement, season, options = {}) {
        this.validateSeasonSet();

        const resolvedSettlement = this._resolveSettlement(settlement);
        const resolvedSeason = season
            ? this._normalizeSeason(season)
            : (this.getCurrentSeason() ? this._normalizeSeason(this.getCurrentSeason()) : 'spring');

        let plan = options.plan || null;
        if (!plan && this.pipelineEnabled) {
            try {
                const cacheKey = this._buildPlanCacheKey(resolvedSettlement, resolvedSeason);
                plan = this.planCache.get(cacheKey) || null;
            } catch (error) {
                this.getLogger().logSystem('Plan Cache', 'Failed to read cached availability plan', { error: error.message });
            }
        }

        if (!plan || !Array.isArray(plan.slots) || plan.slots.length === 0) {
            return this._legacyDetermineCargoTypes(resolvedSettlement, resolvedSeason);
        }

        const cargoTypes = [];

        for (const slot of plan.slots) {
            const name = slot.cargoType || slot.label;
            if (name && !cargoTypes.includes(name)) {
                cargoTypes.push(name);
            }
        }

        if (cargoTypes.length === 0) {
            return this._legacyDetermineCargoTypes(resolvedSettlement, resolvedSeason);
        }

        return cargoTypes;
    }

    _legacyDetermineCargoTypes(settlement, season) {
        const sourceCategories = Array.isArray(settlement?.flags)
            ? settlement.flags
            : Array.isArray(settlement?.source)
                ? settlement.source
                : Array.isArray(settlement?.productionCategories)
                    ? settlement.productionCategories
                    : null;

        if (!settlement || !sourceCategories) {
            throw new Error('Invalid source array');
        }

        this.validateSeasonSet();
        
        const availableCargo = [];
        const productionCategories = sourceCategories;

        // Mapping from settlement production categories to cargo types
        const productionToCargoMapping = {
            'Agriculture': 'Grain',
            'Subsistence': 'Grain',
            'Cattle': 'Grain',
            'Goats': 'Grain',
            'Fishing': 'Grain',
            'Sheep': 'Wool',
            'Metal': 'Metal',
            'Fur': 'Luxuries',
            'Government': 'Armaments',
            'Wine': 'Wine/Brandy'
        };

        // Handle specific goods (non-Trade categories)
        const specificGoods = productionCategories.filter(category => category !== 'Trade');
        specificGoods.forEach(category => {
            // Check if we have a direct mapping for this production category
            if (productionToCargoMapping[category]) {
                const cargoName = productionToCargoMapping[category];
                if (!availableCargo.includes(cargoName)) {
                    availableCargo.push(cargoName);
                }
            } else {
                // Fallback: try to find cargo types that match this production category
                const matchingCargo = this.dataManager.cargoTypes.filter(cargo => 
                    cargo.category === category
                );
                
                matchingCargo.forEach(cargo => {
                    if (!availableCargo.includes(cargo.name)) {
                        availableCargo.push(cargo.name);
                    }
                });
            }
        });

        // Handle Trade settlements - they get random seasonal cargo
        if (productionCategories.includes('Trade')) {
            const tradeCargo = this.getRandomTradeCargoForSeason(season);
            if (tradeCargo && !availableCargo.includes(tradeCargo)) {
                availableCargo.push(tradeCargo);
            }
        }

        return availableCargo;
    }

    /**
     * Get random trade cargo for the current season
     * @param {string} season - Current season
     * @returns {string|null} - Random cargo type name or null if no trade cargo available
     */
    getRandomTradeCargoForSeason(season) {
        // For trade settlements, return Trade Goods
        const tradeGoods = this.dataManager.cargoTypes.filter(cargo => 
            cargo.category === 'Trade'
        );
        
        if (tradeGoods.length > 0) {
            // Return the first (and likely only) trade goods entry
            return tradeGoods[0].name;
        }
        
        return null;
    }

    /**
     * Step 2B: Calculate cargo size in Encumbrance Points
     * Formula: (Size + Wealth) × (1d100 rounded up to nearest 10) EP
     * Trade bonus: roll twice, use higher multiplier
     * @param {Object} settlement - Settlement object
     * @param {Function} rollFunction - Function that returns 1d100 result (for testing)
     * @returns {Object} - Cargo size calculation result
     */
    calculateCargoSize(settlement, rollFunction = null, options = {}) {
        const resolvedSettlement = this._resolveSettlement(settlement);

        if (!this.pipelineEnabled && options.plan === undefined) {
            return this._legacyCalculateCargoSize(resolvedSettlement, rollFunction);
        }

        if (options.plan !== undefined) {
            return this._processCargoSizePlan(resolvedSettlement, options.plan, rollFunction, options);
        }

        return this._calculateCargoSizeWithPipeline(resolvedSettlement, rollFunction, options);
    }

    _legacyCalculateCargoSize(settlement, rollFunction = null) {
        const properties = this.dataManager.getSettlementProperties(settlement);
        const baseMultiplier = properties.sizeNumeric + properties.wealthRating;
        const tradeEligible = this.dataManager.isTradeSettlement(settlement);

        const finalize = rollData => {
            const totalSize = baseMultiplier * rollData.multiplier;

            return {
                totalSize,
                baseMultiplier,
                sizeMultiplier: rollData.multiplier,
                roll1: rollData.roll1,
                roll1Result: rollData.roll1Result,
                roll2: rollData.roll2,
                roll2Result: rollData.roll2Result,
                tradeBonus: rollData.tradeBonus,
                settlement: settlement.name
            };
        };

        const rollDataMaybePromise = this._rollCargoMultiplier({ rollFunction, isTrade: tradeEligible });

        if (rollDataMaybePromise && typeof rollDataMaybePromise.then === 'function') {
            return rollDataMaybePromise.then(finalize);
        }

        return finalize(rollDataMaybePromise);
    }

    async _calculateCargoSizeWithPipeline(settlement, rollFunction = null, options = {}) {
        try {
            const plan = await this.generateAvailabilityPlan({
                settlement,
                season: options.season || this.getCurrentSeason() || 'spring',
                forceRefresh: !!rollFunction
            });

            if (!plan || !plan.slotPlan) {
                return this._legacyCalculateCargoSize(settlement, rollFunction);
            }

            return this._processCargoSizePlan(settlement, plan, rollFunction, options);
        } catch (error) {
            this.getLogger().logSystem('Pipeline Error', 'Falling back to legacy cargo size calculation', { error: error.message });
            return this._legacyCalculateCargoSize(settlement, rollFunction);
        }
    }

    _processCargoSizePlan(settlement, planOrPromise, rollFunction = null, options = {}) {
        const planPromise = planOrPromise && typeof planOrPromise.then === 'function'
            ? planOrPromise
            : Promise.resolve(planOrPromise);

        const handlePlan = plan => {
            if (!plan || !plan.slotPlan) {
                return this._legacyCalculateCargoSize(settlement, rollFunction);
            }

            const properties = this.dataManager.getSettlementProperties(settlement);
            const defaultBaseMultiplier = properties.sizeNumeric + properties.wealthRating;
            const slotPlan = plan.slotPlan || {};

            const baseMultiplier = typeof slotPlan.baseMultiplier === 'number'
                ? slotPlan.baseMultiplier
                : defaultBaseMultiplier;

            const forcedMultiplier = typeof slotPlan.sizeMultiplier === 'number'
                ? slotPlan.sizeMultiplier
                : (typeof slotPlan.multiplier === 'number' ? slotPlan.multiplier : null);

            const totalSizeOverride = typeof slotPlan.totalSize === 'number'
                ? slotPlan.totalSize
                : null;

            const tradeBonusPreference = slotPlan.tradeBonus;
            const tradeEligible = typeof tradeBonusPreference === 'boolean'
                ? tradeBonusPreference
                : this.dataManager.isTradeSettlement(settlement);

            const finalize = rollData => {
                const totalSize = totalSizeOverride !== null
                    ? totalSizeOverride
                    : baseMultiplier * rollData.multiplier;

                return {
                    totalSize,
                    baseMultiplier,
                    sizeMultiplier: rollData.multiplier,
                    roll1: rollData.roll1,
                    roll1Result: rollData.roll1Result,
                    roll2: rollData.roll2,
                    roll2Result: rollData.roll2Result,
                    tradeBonus: rollData.tradeBonus,
                    settlement: settlement.name
                };
            };

            if (forcedMultiplier !== null) {
                return finalize({
                    multiplier: forcedMultiplier,
                    roll1: null,
                    roll1Result: null,
                    roll2: null,
                    roll2Result: null,
                    tradeBonus: Boolean(tradeBonusPreference && tradeEligible)
                });
            }

            const rollDataMaybePromise = this._rollCargoMultiplier({ rollFunction, isTrade: tradeEligible });

            if (rollDataMaybePromise && typeof rollDataMaybePromise.then === 'function') {
                return rollDataMaybePromise.then(finalize);
            }

            return finalize(rollDataMaybePromise);
        };

        return planPromise.then(handlePlan);
    }

    _rollCargoMultiplier({ rollFunction = null, isTrade = false } = {}) {
        const resolveRoll = () => {
            if (rollFunction) {
                const rollValue = rollFunction();
                if (rollValue && typeof rollValue.then === 'function') {
                    return Promise.resolve(rollValue).then(resolved => ({
                        total: resolved,
                        result: {
                            total: resolved,
                            formula: '1d100',
                            result: resolved.toString()
                        }
                    }));
                }

                return {
                    total: rollValue,
                    result: {
                        total: rollValue,
                        formula: '1d100',
                        result: rollValue != null ? rollValue.toString() : '0'
                    }
                };
            }

            const rollResultMaybePromise = this.rollDice('1d100');

            if (rollResultMaybePromise && typeof rollResultMaybePromise.then === 'function') {
                return rollResultMaybePromise.then(rollResult => ({ total: rollResult.total, result: rollResult }));
            }

            return {
                total: rollResultMaybePromise.total,
                result: rollResultMaybePromise
            };
        };

        const buildResult = (firstRoll, secondRoll = null) => {
            const roll1 = firstRoll.total;
            let multiplier = Math.ceil(roll1 / 10) * 10;
            let roll2 = null;
            let roll2Result = null;
            let tradeBonus = false;

            if (secondRoll) {
                roll2 = secondRoll.total;
                roll2Result = secondRoll.result;
                const multiplier2 = Math.ceil(roll2 / 10) * 10;
                if (multiplier2 > multiplier) {
                    multiplier = multiplier2;
                }
                tradeBonus = true;
            }

            return {
                multiplier,
                roll1,
                roll1Result: firstRoll.result,
                roll2,
                roll2Result,
                tradeBonus
            };
        };

        const firstRoll = resolveRoll();

        if (firstRoll && typeof firstRoll.then === 'function') {
            return firstRoll.then(resolvedFirst => {
                if (!isTrade) {
                    return buildResult(resolvedFirst);
                }

                const secondRoll = resolveRoll();
                if (secondRoll && typeof secondRoll.then === 'function') {
                    return secondRoll.then(resolvedSecond => buildResult(resolvedFirst, resolvedSecond));
                }

                return buildResult(resolvedFirst, secondRoll);
            });
        }

        if (!isTrade) {
            return buildResult(firstRoll);
        }

        const secondRoll = resolveRoll();
        if (secondRoll && typeof secondRoll.then === 'function') {
            return secondRoll.then(resolvedSecond => buildResult(firstRoll, resolvedSecond));
        }

        return buildResult(firstRoll, secondRoll);
    }

    /**
     * Complete cargo availability check workflow
     * Combines Steps 1, 2A, and 2B into a single operation
     * @param {Object} settlement - Settlement object
     * @param {string} season - Current season
     * @param {Function} rollFunction - Function that returns 1d100 result (for testing)
     * @returns {Object} - Complete availability check result
     */
    async performCompleteAvailabilityCheck(settlement, season, rollFunction = null) {
        // Step 1: Check if cargo is available
        const availabilityResult = await this.checkCargoAvailability(settlement, rollFunction);
        
        if (!availabilityResult.available) {
            return {
                available: false,
                availabilityCheck: availabilityResult,
                cargoTypes: [],
                cargoSize: null
            };
        }

        // Step 2A: Determine cargo types
    const plan = availabilityResult.plan || null;

    // Step 2A: Determine cargo types
    const cargoTypes = this.determineCargoTypes(settlement, season, { plan });
        
    // Step 2B: Calculate cargo size
    const cargoSize = await this.calculateCargoSize(settlement, rollFunction, { plan, season });

        return {
            available: true,
            availabilityCheck: availabilityResult,
            cargoTypes: cargoTypes,
            cargoSize: cargoSize
        };
    }

    /**
     * Get detailed settlement information for availability calculations
     * @param {Object} settlement - Settlement object
     * @returns {Object} - Detailed settlement information
     */
    getSettlementInfo(settlement) {
        if (!settlement) {
            throw new Error('Settlement object is required');
        }

        const properties = this.dataManager.getSettlementProperties(settlement);
        const availabilityChance = this.calculateAvailabilityChance(settlement);
        const cargoSizeBase = properties.sizeNumeric + properties.wealthRating;
        const isTradeCenter = this.dataManager.isTradeSettlement(settlement);

        return {
            name: properties.name,
            region: properties.region,
            size: {
                enum: properties.sizeEnum,
                numeric: properties.sizeNumeric,
                description: properties.sizeDescription
            },
            wealth: {
                rating: properties.wealthRating,
                modifier: properties.wealthModifier,
                description: properties.wealthDescription
            },
            population: properties.population,
            productionCategories: properties.productionCategories,
            availabilityChance: availabilityChance,
            cargoSizeBase: cargoSizeBase,
            isTradeCenter: isTradeCenter,
            garrison: properties.garrison,
            ruler: properties.ruler,
            notes: properties.notes
        };
    }

    /**
     * Validate settlement for trading operations
     * @param {Object} settlement - Settlement object to validate
     * @returns {Object} - Validation result
     */
    validateSettlementForTrading(settlement) {
        if (!settlement) {
            return {
                valid: false,
                errors: ['Settlement object is required']
            };
        }

        const validation = this.dataManager.validateSettlement(settlement);
        if (!validation.valid) {
            return {
                valid: false,
                errors: validation.errors
            };
        }

        // Additional trading-specific validation
        const errors = [];
        
        if (!settlement.flags || settlement.flags.length === 0) {
            errors.push('Settlement must have at least one production category');
        }

        if (errors.length > 0) {
            return {
                valid: false,
                errors: errors
            };
        }

        return {
            valid: true,
            errors: []
        };
    }

    // ===== PURCHASE PRICE CALCULATION SYSTEM =====

    /**
     * Get cargo object by name
     * @param {string} cargoName - Name of the cargo type
     * @returns {Object} - Cargo object
     */
    getCargoByName(cargoName) {
        return this.purchasePriceCalculator.getCargoByName(cargoName);
    }

    /**
     * Calculate base price for cargo in current season
     * @param {string} cargoName - Name of the cargo type
     * @param {string} season - Season name (optional, uses current season if not provided)
     * @param {string} quality - Quality tier (optional, defaults to 'average')
     * @returns {number} - Base price per unit
     */
    calculateBasePrice(cargoName, season = null, quality = 'average') {
        return this.purchasePriceCalculator.calculateBasePrice(cargoName, season, quality);
    }

    /**
     * Calculate purchase price with all modifiers
     * @param {string} cargoName - Name of the cargo type
     * @param {number} quantity - Quantity in Encumbrance Points
     * @param {Object} options - Purchase options
     * @param {boolean} options.isPartialPurchase - Whether this is a partial purchase (+10% penalty)
     * @param {Object} options.haggleResult - Result of haggle test (optional)
     * @param {string} options.quality - Quality tier for wine/brandy (optional)
     * @param {string} options.season - Season override (optional)
     * @returns {Object} - Detailed price calculation
     */
    calculatePurchasePrice(cargoName, quantity, options = {}) {
        return this.purchasePriceCalculator.calculatePurchasePrice(cargoName, quantity, options);
    }

    /**
     * Apply haggle test result to price calculation
     * @param {number} basePrice - Base price per unit
     * @param {Object} haggleResult - Haggle test result
     * @param {boolean} haggleResult.success - Whether haggle was successful
     * @param {boolean} haggleResult.hasDealmakertTalent - Whether player has Dealmaker talent
     * @param {boolean} haggleResult.criticalSuccess - Whether it was a critical success (optional)
     * @returns {Object} - Price modifier object
     */
    applyHaggleResult(basePrice, haggleResult) {
        return this.purchasePriceCalculator.applyHaggleResult(basePrice, haggleResult);
    }

    /**
     * Calculate wine/brandy quality tier pricing
     * @param {string} cargoName - Name of wine/brandy cargo
     * @param {string} quality - Quality tier (poor, average, good, excellent)
     * @param {string} season - Season for base pricing
     * @returns {Object} - Quality pricing information
     */
    calculateQualityTierPricing(cargoName, quality, season = null) {
        return this.purchasePriceCalculator.calculateQualityTierPricing(cargoName, quality, season);
    }

    /**
     * Get all available quality tiers for a cargo type
     * @param {string} cargoName - Name of the cargo type
     * @returns {Array} - Array of available quality tier names
     */
    getAvailableQualityTiers(cargoName) {
        return this.purchasePriceCalculator.getAvailableQualityTiers(cargoName);
    }

    /**
     * Check if cargo type supports quality tiers (wine/brandy)
     * @param {string} cargoName - Name of the cargo type
     * @returns {boolean} - True if cargo supports quality tiers
     */
    hasQualityTiers(cargoName) {
        return this.purchasePriceCalculator.hasQualityTiers(cargoName);
    }

    /**
     * Calculate price comparison across all seasons
     * @param {string} cargoName - Name of the cargo type
     * @param {string} quality - Quality tier (optional)
     * @returns {Object} - Price comparison across seasons
     */
    calculateSeasonalPriceComparison(cargoName, quality = 'average') {
        return this.purchasePriceCalculator.calculateSeasonalPriceComparison(cargoName, quality);
    }

    /**
     * Validate purchase transaction
     * @param {string} cargoName - Name of the cargo type
     * @param {number} quantity - Quantity to purchase
     * @param {number} availableQuantity - Available quantity at settlement
     * @param {Object} options - Purchase options
     * @returns {Object} - Validation result
     */
    validatePurchaseTransaction(cargoName, quantity, availableQuantity, options = {}) {
        return this.purchasePriceCalculator.validatePurchaseTransaction(cargoName, quantity, availableQuantity, options);
    }

    // ===== SALE MECHANICS AND RESTRICTIONS =====

    /**
     * Step 1: Check sale eligibility (location and time restrictions)
     * @param {Object} cargo - Cargo object with purchase information
     * @param {Object} currentSettlement - Settlement where attempting to sell
     * @param {Object} purchaseData - Original purchase data
     * @param {number} currentTime - Current game time (optional, for time restrictions)
     * @returns {Object} - Sale eligibility result
     */
    checkSaleEligibility(cargo, currentSettlement, purchaseData, currentTime = null) {
        return this.saleMechanics.checkSaleEligibility(cargo, currentSettlement, purchaseData, currentTime);
    }

    /**
     * Step 2: Calculate buyer availability chance
     * Formula: Size × 10 (+30 if Trade settlement)
     * @param {Object} settlement - Settlement object
     * @param {string} cargoName - Name of cargo being sold
     * @returns {number} - Buyer availability percentage
     */
    calculateBuyerAvailabilityChance(settlement, cargoName) {
        return this.saleMechanics.calculateBuyerAvailabilityChance(settlement, cargoName);
    }

    /**
     * Step 2: Find buyer using dice roll
     * @param {Object} settlement - Settlement object
     * @param {string} cargoName - Name of cargo being sold
     * @param {Function} rollFunction - Function that returns 1d100 result (for testing)
     * @returns {Object} - Buyer availability result
     */
    async findBuyer(settlement, cargoName, rollFunction = null) {
        return this.saleMechanics.findBuyer(settlement, cargoName, rollFunction);
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
        return this.saleMechanics.calculateSalePrice(cargoName, quantity, settlement, options);
    }

    /**
     * Apply haggle test result to sale price calculation
     * @param {number} basePrice - Base price per unit
     * @param {Object} haggleResult - Haggle test result
     * @returns {Object} - Price modifier object
     */
    applySaleHaggleResult(basePrice, haggleResult) {
        return this.saleMechanics.applySaleHaggleResult(basePrice, haggleResult);
    }

    /**
     * Check village restrictions for cargo sales
     * @param {Object} settlement - Settlement object
     * @param {string} cargoName - Name of cargo being sold
     * @param {string} season - Current season
     * @returns {Object} - Village restriction check result
     */
    checkVillageRestrictions(settlement, cargoName, season = null) {
        return this.saleMechanics.checkVillageRestrictions(settlement, cargoName, season);
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
        return this.saleMechanics.processEnhancedPartialSale(cargoName, originalQuantity, settlement, purchaseData, options, rollFunction);
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
        return this.saleMechanics.performCompleteSaleCheck(cargoName, quantity, settlement, purchaseData, options, rollFunction);
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
        return this.saleMechanics.validateSaleTransaction(cargoName, quantity, settlement, purchaseData, options);
    }

    // ===== SPECIAL SALE METHODS =====

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
        return this.saleMechanics.processDesperateSale(cargoName, quantity, settlement, options);
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
        return this.saleMechanics.processRumorSale(cargoName, quantity, settlement, rumorData, options);
    }

    /**
     * Check for available rumors at settlement
     * @param {string} cargoName - Name of the cargo type
     * @param {Object} settlement - Settlement object
     * @param {Function} rollFunction - Function that returns 1d100 result (for testing)
     * @returns {Object} - Rumor check result
     */
    checkForRumors(cargoName, settlement, rollFunction = null) {
        return this.saleMechanics.checkForRumors(cargoName, settlement, rollFunction);
    }

    /**
     * Generate random rumor for cargo type and settlement
     * @param {string} cargoName - Name of the cargo type
     * @param {Object} settlement - Settlement object
     * @param {Function} rollFunction - Function that returns 1d100 result (for testing)
     * @returns {Object|null} - Generated rumor or null if no rumor
     */
    generateRandomRumor(cargoName, settlement, rollFunction = null) {
        return this.saleMechanics.generateRandomRumor(cargoName, settlement, rollFunction);
    }

    /**
     * Generate rumor from successful gossip test
     * @param {Object} gossipResult - Result from performGossipTest
     * @param {string} cargoName - Name of cargo to generate rumor about
     * @param {Object} settlement - Settlement object
     * @returns {Object|null} - Generated rumor or null if gossip failed
     */
    async generateRumorFromGossip(gossipResult, cargoName, settlement) {
        return this.saleMechanics.generateRumorFromGossip(gossipResult, cargoName, settlement);
    }

    /**
     * Calculate Dealmaker talent bonus
     * @param {boolean} hasTalent - Whether player has Dealmaker talent
     * @param {string} transactionType - 'purchase' or 'sale'
     * @returns {Object} - Talent bonus information
     */
    calculateDealmakertBonus(hasTalent, transactionType) {
        return this.saleMechanics.calculateDealmakertBonus(hasTalent, transactionType);
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
        return this.saleMechanics.getAvailableSaleOptions(cargoType, quantity, settlement, purchaseData);
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
        return this.saleMechanics.executeSpecialSale(saleType, cargoType, quantity, settlement, purchaseData, rumorData, rollOptions, rollFunction);
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
        return this.saleMechanics.analyzeSaleProfitability(cargoType, quantity, settlement, purchaseData, rollOptions);
    }

    /**
     * Roll dice using FoundryVTT Roll class or fallback
     * @param {string} formula - Dice formula (e.g., '1d100', '2d10+5')
     * @param {Object} options - Roll options
     * @returns {Object} - Roll result with total and details
     */
    rollDice(formula, options = {}) {
        try {
            // Try to use FoundryVTT Roll class if available
            if (typeof Roll !== 'undefined') {
                const roll = new Roll(formula, options);
                roll.evaluate({ async: false });
                return {
                    total: roll.total,
                    dice: roll.dice,
                    formula: formula,
                    result: roll.result,
                    terms: roll.terms
                };
            }
        } catch (error) {
            console.warn('FoundryVTT Roll class not available, using fallback:', error.message);
        }

        // Fallback: simple dice rolling for testing
        return this.rollDiceFallback(formula, options);
    }

    /**
     * Fallback dice rolling implementation for testing
     * @param {string} formula - Dice formula
     * @param {Object} options - Roll options
     * @returns {Object} - Roll result
     */
    rollDiceFallback(formula, options = {}) {
        // Parse simple formulas like '1d100', '2d10+5', etc.
        const match = formula.match(/^(\d+)d(\d+)([+-]\d+)?$/);
        if (!match) {
            throw new Error(`Unsupported dice formula: ${formula}`);
        }

        const numDice = parseInt(match[1]);
        const dieSize = parseInt(match[2]);
        const modifier = match[3] ? parseInt(match[3]) : 0;

        let total = modifier;
        const dice = [];

        for (let i = 0; i < numDice; i++) {
            const roll = Math.floor(Math.random() * dieSize) + 1;
            dice.push(roll);
            total += roll;
        }

        return {
            total: total,
            dice: dice,
            formula: formula,
            result: dice.join(' + ') + (modifier !== 0 ? ` ${modifier < 0 ? '' : '+'}${modifier}` : ''),
            terms: dice
        };
    }

    /**
     * Roll for cargo availability
     * @param {Object} settlement - Settlement object
     * @param {string} cargoType - Type of cargo
     * @param {Function} rollFunction - Custom roll function for testing
     * @returns {boolean} - Whether cargo is available
     */
    rollAvailability(settlement, cargoType, rollFunction = null) {
        const chance = this.calculateAvailabilityChance(settlement);
        const roll = rollFunction ? rollFunction() : this.rollDice('1d100').total;
        return roll <= chance;
    }

    /**
     * Roll for cargo size
     * @param {Object} settlement - Settlement object
     * @param {Function} rollFunction - Custom roll function for testing
     * @returns {Object} - Cargo size result
     */
    async rollCargoSize(settlement, rollFunction = null) {
        const properties = this.dataManager.getSettlementProperties(settlement);
        const roll = rollFunction ? rollFunction() : this.rollDice('1d100').total;
        
        const sizeModifier = properties.sizeNumeric;
        const wealthModifier = properties.wealthRating;
        const totalSize = (sizeModifier + wealthModifier) * roll;

        return {
            totalSize: totalSize,
            roll: roll,
            sizeModifier: sizeModifier,
            wealthModifier: wealthModifier,
            settlement: settlement.name
        };
    }

    /**
     * Roll for buyer availability
     * @param {Object} settlement - Settlement object
     * @param {string} cargoType - Type of cargo
     * @param {Function} rollFunction - Custom roll function for testing
     * @returns {boolean} - Whether buyers are available
     */
    rollBuyerAvailability(settlement, cargoType, rollFunction = null) {
        const chance = this.calculateBuyerAvailabilityChance(settlement, cargoType);
        const roll = rollFunction ? rollFunction() : this.rollDice('1d100').total;
        return roll <= chance;
    }

    /**
     * Post a chat message in FoundryVTT
     * @param {string} message - Message content
     * @param {Object} options - Chat message options
     * @returns {Object} - Chat message result
     */
    postChatMessage(message, options = {}) {
        try {
            if (typeof ChatMessage !== 'undefined') {
                return ChatMessage.create({
                    content: message,
                    speaker: options.speaker || { alias: 'Trading Places' },
                    type: options.type || CONST.CHAT_MESSAGE_STYLES.OTHER,
                    ...options
                });
            }
        } catch (error) {
            console.warn('FoundryVTT ChatMessage not available:', error.message);
        }

        // Fallback for testing
        return {
            content: message,
            speaker: options.speaker || { alias: 'Trading Places' },
            type: options.type || 'other',
            posted: true,
            fallback: true
        };
    }

    /**
     * Generate a random merchant for a settlement using the config system
     * @param {Object} settlement - Settlement object
     * @param {Function} rollFunction - Function that returns 1d100 result (for testing)
     * @returns {Object} - Merchant object with name and skills
     */
    async generateRandomMerchant(settlement, rollFunction = null) {
        // Get config data
        const config = this.dataManager.getSystemConfig();
        const skillConfig = config.skillDistribution;

        if (!skillConfig) {
            throw new Error('Merchant generation config missing from trading-config.json');
        }

        // Generate base skill using percentile system
        const skill = this._calculateMerchantSkill(settlement, skillConfig, rollFunction);

        // Generate name
        const name = this._generateMerchantName();

        // Calculate final haggling skill
        const finalHagglingSkill = Math.max(5, Math.min(95, skill));

        // Generate skill description based on final skill
        const skillDescription = this._getSkillDescription(finalHagglingSkill);

        return {
            name: name,
            skillDescription: skillDescription,
            hagglingSkill: finalHagglingSkill,
            baseSkill: skill
        };
    }

    /**
     * Calculate merchant skill using percentile distribution
     * @param {Object} settlement - Settlement object
     * @param {Object} skillConfig - Skill distribution config
     * @param {Function} rollFunction - Roll function for testing
     * @returns {number} - Base skill value (5-95)
     */
    _calculateMerchantSkill(settlement, skillConfig, rollFunction = null) {
        const properties = this.dataManager.getSettlementProperties(settlement);

        // Start with base skill
        let skill = skillConfig.baseSkill;

        // Add wealth modifier
        skill += skillConfig.wealthModifier * properties.wealthRating;

        // Roll percentile and apply table modifier
        const percentileRoll = rollFunction ? rollFunction() : Math.floor(Math.random() * 100) + 1;
        const tableModifier = this._getPercentileModifier(percentileRoll, skillConfig.percentileTable);

        skill += tableModifier;

        // Add variance
        const varianceRoll = rollFunction ? rollFunction() : Math.floor(Math.random() * (skillConfig.variance * 2 + 1)) - skillConfig.variance;
        skill += varianceRoll;

        // Clamp to min/max
        return Math.max(skillConfig.minSkill, Math.min(skillConfig.maxSkill, Math.round(skill)));
    }

    /**
     * Get modifier from percentile table
     * @param {number} roll - Percentile roll (1-100)
     * @param {Object} table - Percentile modifier table
     * @returns {number} - Modifier value
     */
    _getPercentileModifier(roll, table) {
        const percentiles = Object.keys(table).map(p => parseInt(p)).sort((a, b) => a - b);

        for (const percentile of percentiles) {
            if (roll <= percentile) {
                return table[percentile.toString()];
            }
        }

        // Fallback for rolls above highest percentile
        return table[percentiles[percentiles.length - 1].toString()];
    }

    /**
     * Generate merchant name
     * @returns {string} - Generated merchant name
     */
    _generateMerchantName() {
        const firstNames = ['Aldric', 'Beatrix', 'Casper', 'Dalia', 'Eldric', 'Fiona', 'Gareth', 'Helena', 'Ian', 'Jasmine', 'Karl', 'Lena', 'Marcus', 'Nina', 'Otto', 'Paula', 'Quentin', 'Rosa', 'Stefan', 'Tina'];
        const lastNames = ['Voss', 'Hale', 'Thorne', 'Wren', 'Kane', 'Black', 'Stone', 'Cross', 'Rook', 'Vale', 'Wolf', 'Hart', 'Bear', 'Eagle', 'Fox'];

        const first = firstNames[Math.floor(Math.random() * firstNames.length)];
        const last = lastNames[Math.floor(Math.random() * lastNames.length)];

        return `${first} ${last}`;
    }

    /**
     * Get skill description based on haggling skill value
     * @param {number} skill - Haggling skill value (5-95)
     * @returns {string} - Descriptive skill level
     */
    _getSkillDescription(skill) {
        if (skill >= 85) return 'Legendary (unmatched in the marketplace)';
        if (skill >= 75) return 'Master (legendary trader)';
        if (skill >= 65) return 'Expert (master of the trade)';
        if (skill >= 55) return 'Skilled (experienced negotiator)';
        if (skill >= 45) return 'Competent (solid trading experience)';
        if (skill >= 35) return 'Apprentice (basic bargaining skills)';
        return 'Novice (easily out-haggled)';
    }

    /**
     * Generate transaction result message
     * @param {string} transactionType - 'purchase' or 'sale'
     * @param {string} cargoType - Type of cargo
     * @param {number} quantity - Quantity involved
     * @param {number} price - Total price
     * @param {Object} settlement - Settlement object
     * @param {Object} options - Additional options
     * @returns {string} - Formatted transaction message
     */
    generateTransactionResultMessage(transactionType, cargoType, quantity, price, settlement, options = {}) {
        const action = transactionType === 'purchase' ? 'purchased' : 'sold';
        const preposition = transactionType === 'purchase' ? 'from' : 'to';
        const currency = options.currency || 'GC';
        
        let message = `${action} ${quantity} EP of ${cargoType} ${preposition} ${settlement.name} for ${price} ${currency}`;
        
        if (options.modifiers && options.modifiers.length > 0) {
            const modifierDescriptions = options.modifiers.map(m => m.description).join(', ');
            message += ` (${modifierDescriptions})`;
        }
        
        if (options.specialType) {
            message += ` (${options.specialType} sale)`;
        }
        
        return message;
    }

    /**
     * Generate roll result message
     * @param {Object} rollResult - Roll result object with total and formula
     * @param {string} rollType - Type of roll (e.g., 'Availability Check')
     * @param {Object} options - Additional options (target, details)
     * @returns {string} - Formatted roll message
     */
    generateRollResultMessage(rollResult, rollType, options = {}) {
        let message = `<strong>${rollType}:</strong><br>`;
        message += `Roll:</strong> ${rollResult.total}`;
        
        if (options.target) {
            const success = rollResult.total <= options.target;
            const successText = success ? 'Success' : 'Failure';
            message += ` vs Target:</strong> ${options.target} - <strong>${successText}</strong>`;
        }
        
        if (options.details) {
            message += `<br><em>${options.details}</em>`;
        }
        
        return message;
    }
}

// Export for use in other modules
console.log('DEBUG: About to export TradingEngine, type:', typeof TradingEngine);
export { TradingEngine };

if (typeof module !== 'undefined' && module.exports) {
    module.exports = TradingEngine;
    module.exports.TradingEngine = TradingEngine;
}

// Global registration for FoundryVTT
if (typeof window !== 'undefined') {
    window.TradingEngine = TradingEngine;
 }