console.log('Trading Places | Loading trading-engine.js');


class TradingEngine {
    constructor(dataManager) {
        this.dataManager = dataManager;
        this.currentSeason = null;
        this.logger = null; // Will be set by integration
    }

    /**
     * Set the debug logger instance
