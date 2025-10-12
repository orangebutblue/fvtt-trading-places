console.log('Trading Places | Loading trading-engine.js');


class TradingEngine {
    constructor(dataManager) {
        this.dataManager = dataManager;
        this.currentSeason = null;
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
     * Set the current trading season
     * @param {string} season - Season name (spring, summer, autumn, winter)
     */
    async setCurrentSeason(season) {
        const validSeasons = ['spring', 'summer', 'autumn', 'winter'];
        if (!validSeasons.includes(season)) {
            throw new Error(`Invalid season: ${season}. Must be one of: ${validSeasons.join(', ')}`);
        }
        
        const logger = this.getLogger();
        logger.logSystem('Season Change', `Trading season changed from ${this.currentSeason || 'none'} to ${season}`, {
            previousSeason: this.currentSeason,
            newSeason: season
        });
        
        this.currentSeason = season;

        // Persist to settings if available (FoundryVTT or mock)
        if (typeof global !== 'undefined' && global.foundryMock && global.foundryMock.setSetting) {
            await global.foundryMock.setSetting('trading-places', 'currentSeason', season);
        } else if (typeof game !== 'undefined' && game.settings && game.settings.set) {
            await game.settings.set('trading-places', 'currentSeason', season);
        }
    }

    /**
     * Get the current trading season
     * @returns {string|null} - Current season or null if not set
     */
    getCurrentSeason() {
        return this.currentSeason;
    }

    /**
     * Validate that season is set before trading operations
     * @throws {Error} - If season is not set
     */
    validateSeasonSet() {
        if (!this.currentSeason) {
            throw new Error('Season must be set before trading operations. Call setCurrentSeason() first.');
        }
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
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TradingEngine;
}
