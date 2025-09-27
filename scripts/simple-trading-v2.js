console.log('Trading Places | Loading simple-trading-v2.js');

/**
 * Trading Places Places Module - Simple Trading V2 Application
 * Simplified trading interface using ApplicationV2 framework
 */

/**
 * Simple Trading Application using FoundryVTT V2 Application framework
 * Provides a basic trading interface for development and fallback purposes
 */
// Check if ApplicationV2 is available before defining the class
if (typeof foundry?.applications?.api?.ApplicationV2 === 'undefined') {
    console.warn('Trading Places | ApplicationV2 not available, WFRPSimpleTradingApplication will not be loaded');
} else {
    console.log('Trading Places | ApplicationV2 available, defining WFRPSimpleTradingApplication');

class WFRPSimpleTradingApplication extends foundry.applications.api.ApplicationV2 {
    
    /** @override */
    static DEFAULT_OPTIONS = {
        id: "wfrp-simple-trading",
        tag: "div",
        window: {
            title: "Trading Places",
            icon: "fas fa-coins",
            resizable: true,
            minimizable: true,
            maximizable: false
        },
        position: {
            width: 1400,
            height: 900,
            top: 50,
            left: 50
        },
        classes: ["wfrp-simple-trading", "application-v2"]
    };

    /** @override */
    static PARTS = {
        content: { 
            template: "modules/trading-places/templates/simple-trading.hbs",
            scrollable: [".trading-content"]
        }
    };

    /**
     * Constructor for WFRPSimpleTradingApplication
     * @param {Object} options - Application options
     */
    constructor(options = {}) {
        super(options);

        // Get module components
        this.dataManager = window.WFRPRiverTrading?.getDataManager();
        this.settlements = this.dataManager?.getAllSettlements() || [];
        this.regions = [...new Set(this.settlements.map(s => s.region))];
        
        // Get logger for debug logging
        this.logger = window.wfrpLogger;
        
        // Initialize state
        this.selectedRegion = null;
        this.selectedSettlement = null;
        this.currentSeason = 'spring';
        
        this.log('Simple Trading Application initialized', {
            settlements: this.settlements.length,
            regions: this.regions.length
        });
    }

    /**
     * Static factory method to create and render simple trading application
     * @param {Object} options - Application options
     * @returns {WFRPSimpleTradingApplication} - Created application instance
     */
    static async create(options = {}) {
        const app = new WFRPSimpleTradingApplication(options);
        
        // Log creation through the instance
        app.log('Simple Trading Application created and rendering', { options });
        
        await app.render(true);
        return app;
    }

    /** @override */
    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        
        // Add trading-specific data for templates
        context.settlements = this.settlements;
        context.regions = this.regions;
        context.selectedRegion = this.selectedRegion;
        context.selectedSettlement = this.selectedSettlement;
        context.currentSeason = this.currentSeason;
        
        // Filter settlements by selected region
        context.regionSettlements = this.selectedRegion ? 
            this.settlements.filter(s => s.region === this.selectedRegion) : [];

        return context;
    }

    /** @override */
    _attachPartListeners(partId, htmlElement, options) {
        super._attachPartListeners(partId, htmlElement, options);
        
        // Region selection
        const regionSelector = htmlElement.querySelector('#region-selector');
        if (regionSelector) {
            regionSelector.addEventListener('change', this._onRegionChange.bind(this));
        }

        // Settlement selection
        const settlementSelector = htmlElement.querySelector('#settlement-selector');
        if (settlementSelector) {
            settlementSelector.addEventListener('change', this._onSettlementChange.bind(this));
        }

        // Season selection
        const seasonSelector = htmlElement.querySelector('#season-selector');
        if (seasonSelector) {
            seasonSelector.addEventListener('change', this._onSeasonChange.bind(this));
        }

        // Check availability button
        const checkBtn = htmlElement.querySelector('#check-availability');
        if (checkBtn) {
            checkBtn.addEventListener('click', this._onCheckAvailability.bind(this));
        }

        this.log('Simple Trading V2 rendered', {
            settlements: this.settlements.length,
            regions: this.regions.length,
            selectedRegion: this.selectedRegion,
            selectedSettlement: this.selectedSettlement?.name
        });
    }

    /**
     * Log debug messages if logger is available
     * @param {string} message - Message to log
     * @param {*} data - Optional data to log
     */
    log(message, data = null) {
        if (this.logger && this.logger.log) {
            this.logger.log('Simple Trading', message, data);
        } else {
            console.log(`Trading Places | Simple Trading: ${message}`, data || '');
        }
    }

    /**
     * Handle region selection change
     * @param {Event} event - Change event
     * @private
     */
    async _onRegionChange(event) {
        const selectedRegion = event.target.value;
        
        this.log('Region selection changed', {
            previousRegion: this.selectedRegion,
            newRegion: selectedRegion,
            availableSettlements: this.settlements.filter(s => s.region === selectedRegion).length
        });
        
        this.selectedRegion = selectedRegion;
        this.selectedSettlement = null;
        
        // Re-render to update settlement options
        await this.render(false);
    }

    /**
     * Handle settlement selection change
     * @param {Event} event - Change event
     * @private
     */
    async _onSettlementChange(event) {
        const settlementName = event.target.value;
        
        if (settlementName) {
            this.selectedSettlement = this.settlements.find(s => s.name === settlementName);
            
            this.log('Settlement selection changed', {
                settlementName: settlementName,
                settlementData: {
                    region: this.selectedSettlement?.region,
                    size: this.selectedSettlement?.size,
                    wealth: this.selectedSettlement?.wealth,
                    source: this.selectedSettlement?.source
                }
            });
        } else {
            this.selectedSettlement = null;
            this.log('Settlement selection cleared');
        }
        
        // Re-render to update settlement info
        await this.render(false);
    }

    /**
     * Handle season selection change
     * @param {Event} event - Change event
     * @private
     */
    async _onSeasonChange(event) {
        const selectedSeason = event.target.value;
        
        this.log('Season selection changed', {
            previousSeason: this.currentSeason,
            newSeason: selectedSeason
        });
        
        this.currentSeason = selectedSeason;
        
        // Update game setting if possible
        try {
            await game.settings.set("trading-places", "currentSeason", selectedSeason);
            this.log('Season setting saved successfully');
        } catch (error) {
            this.log('Failed to save season setting', { error: error.message });
        }
    }

    /**
     * Handle check availability button click
     * @param {Event} event - Click event
     * @private
     */
    async _onCheckAvailability(event) {
        if (!this.selectedSettlement) {
            this.log('Availability check attempted without settlement selection');
            ui.notifications.warn('Please select a settlement first.');
            return;
        }

        this.log('Cargo availability check initiated', {
            settlement: this.selectedSettlement.name,
            region: this.selectedSettlement.region,
            season: this.currentSeason,
            settlementData: {
                size: this.selectedSettlement.size,
                wealth: this.selectedSettlement.wealth,
                source: this.selectedSettlement.source
            }
        });

        try {
            // Get trading engine if available
            const tradingEngine = window.WFRPRiverTrading?.getTradingEngine();
            
            if (tradingEngine) {
                this.log('Using trading engine for availability check');
                
                // Perform actual availability check
                const result = await tradingEngine.performCompleteAvailabilityCheck(
                    this.selectedSettlement, 
                    this.currentSeason
                );
                
                this.log('Availability check completed', {
                    result: result,
                    available: result.available,
                    cargoTypes: result.cargoTypes || []
                });
                
                if (result.available) {
                    ui.notifications.info(`Cargo available! Found ${result.cargoTypes.length} type(s): ${result.cargoTypes.join(', ')}`);
                } else {
                    ui.notifications.info('No cargo available at this settlement.');
                }
            } else {
                this.log('Trading engine not available, using fallback');
                // Fallback for testing
                ui.notifications.info('Trading engine not available. This is a test interface.');
            }
        } catch (error) {
            this.log('Availability check failed', { error: error.message, stack: error.stack });
            ui.notifications.error(`Availability check failed: ${error.message}`);
        }
    }
}

// Export for global access
window.WFRPSimpleTradingApplication = WFRPSimpleTradingApplication;
console.log('Trading Places | WFRPSimpleTradingApplication class registered globally');

} // End of ApplicationV2 availability check