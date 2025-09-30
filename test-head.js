console.log('Trading Places | Loading trading-engine.js');

/**
 * Trading Places Module - Trading Engine
 * Pure business logic implementation of WFRP trading algorithms
 */

/**
 * Trading Engine class implementing the complete WFRP trading algorithm
 * This class contains pure business logic with no FoundryVTT dependencies
 */
class TradingEngine {
    constructor(dataManager) {
        this.dataManager = dataManager;
        this.currentSeason = null;
        this.logger = null; // Will be set by integration
    }

    /**
     * Set the debug logger instance
