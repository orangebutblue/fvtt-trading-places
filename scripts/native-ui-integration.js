/**
 * Trading Places Module - Native UI Integration
 * Provides integration points with FoundryVTT's native UI
 */

console.log('Trading Places | Loading native-ui-integration.js');

/**
 * Native UI Integration class for FoundryVTT integration
 */
class WFRPNativeUIIntegration {
    constructor(logger = null) {
        this.logger = logger;
        this.isInitialized = false;
        this.log('Native UI Integration initialized', null);
    }

    /**
     * Initialize all UI integration points
     */
    async initialize() {
        if (this.isInitialized) {
            this.log('Native UI Integration already initialized, skipping', null);
            return;
        }

        this.log('=== Initializing Native UI Integration ===', null);

        // Initialize all integration points
        this.initializeSceneControls();
        this.initializeSidebarIntegration();
        this.initializeHotbarMacroSupport();
        this.initializeGlobalAPI();

        this.isInitialized = true;
        this.log('Native UI Integration initialization complete', null);
    }

    /**
     * Initialize scene controls integration
     */
    initializeSceneControls() {
        this.log('Initializing scene controls integration', null);

        Hooks.on('getSceneControlButtons', (controls) => {
            controls.push({
                name: 'trading-places',
                title: 'Trading Places',
                icon: 'fas fa-coins',
                layer: 'TradingPlacesLayer',
                tools: [
                    {
                        name: 'open-trading',
                        title: 'Open Trading Interface',
                        icon: 'fas fa-store',
                        onClick: () => this.openTradingInterface(),
                        button: true
                    },
                    {
                        name: 'quick-trade',
                        title: 'Quick Trade',
                        icon: 'fas fa-bolt',
                        onClick: () => this.openQuickTrade(),
                        button: true
                    }
                ]
            });
        });
    }

    /**
     * Initialize sidebar integration
     */
    initializeSidebarIntegration() {
        this.log('Initializing sidebar integration', null);

        Hooks.on('renderSidebar', (app, html, data) => {
            // Add trading sidebar integration if needed
            this.log('Sidebar rendered, checking for trading integration points', null);
        });
    }

    /**
     * Initialize hotbar macro support
     */
    initializeHotbarMacroSupport() {
        this.log('Initializing hotbar macro support', null);

        Hooks.on('renderHotbar', (app, html, data) => {
            // Add hotbar macro support if needed
            this.log('Hotbar rendered, checking for trading macros', null);
        });
    }

    /**
     * Initialize global API methods
     */
    initializeGlobalAPI() {
        if (!game.tradingPlaces) {
            game.tradingPlaces = {};
        }

        game.tradingPlaces.openTrading = () => this.openTradingInterface();
        game.tradingPlaces.openQuickTrade = () => this.openQuickTrade();
        game.tradingPlaces.openSimpleTrading = () => this.openSimpleTrading();
        game.tradingPlaces.getCurrentSeason = () => this.getCurrentSeason();
        game.tradingPlaces.setSeason = (season) => this.setSeason(season);
        game.tradingPlaces.enableDebugLogging = () => this.enableDebugLogging();
        game.tradingPlaces.disableDebugLogging = () => this.disableDebugLogging();

        this.log('Global API methods initialized', null);
    }

    /**
     * Get current trading season
     */
    getCurrentSeason() {
        return game.settings.get('trading-places', 'currentSeason');
    }

    /**
     * Set trading season
     */
    async setSeason(season) {
        const validSeasons = ['spring', 'summer', 'autumn', 'winter'];
        if (!validSeasons.includes(season)) {
            throw new Error(`Invalid season: ${season}`);
        }

        await game.settings.set('trading-places', 'currentSeason', season);
        ui.notifications.info(`Trading season changed to ${season}`);
        this.log(`Season changed to ${season}`, null);
    }

    /**
     * Open trading interface
     */
    async openTradingInterface() {
        if (global.TradingPlacesApplication) {
            const app = new TradingPlacesApplication();
            await app.render(true);
            this.log('Using TradingPlacesApplication (V2)', null);
        } else if (global.WFRPSimpleTradingApplication) {
            await WFRPSimpleTradingApplication.create();
            this.log('Fallback to WFRPSimpleTradingApplication', null);
        } else {
            ui.notifications.error('Trading interface not available. Please reload the module.');
            this.log('No trading application available, showing error', null);
        }
    }

    /**
     * Open quick trade interface
     */
    async openQuickTrade() {
        // Implementation for quick trade
        this.log('Opening quick trade interface', null);
        await this.openTradingInterface();
    }

    /**
     * Open simple trading interface
     */
    async openSimpleTrading() {
        // Implementation for simple trading
        this.log('Opening simple trading interface', null);
        await this.openTradingInterface();
    }

    /**
     * Enable debug logging
     */
    enableDebugLogging() {
        // Implementation for enabling debug logging
        this.log('Debug logging enabled', null);
    }

    /**
     * Disable debug logging
     */
    disableDebugLogging() {
        // Implementation for disabling debug logging
        this.log('Debug logging disabled', null);
    }

    /**
     * Remove floating button overlays
     */
    removeFloatingButtonOverlays() {
        this.log('Removing floating button overlays', null);

        // Remove any floating trading buttons
        $('.trading-module-button').remove();
        $('.trading-button').remove();

        this.log('Floating button overlays removed', null);
    }

    /**
     * Log method with fallback to console
     */
    log(message, data = null) {
        if (this.logger) {
            this.logger.log('UI Integration', message, data);
        } else {
            console.log(`Trading Places | UI Integration: ${message}`, data);
        }
    }
}

// Export for global access
window.WFRPNativeUIIntegration = WFRPNativeUIIntegration;
console.log('Trading Places | WFRPNativeUIIntegration class registered globally');