/**
 * WFRP Trading Places - Native UI Integration
 * Provides native FoundryVTT UI integration points for the trading system
 */

/**
 * Native UI Integration Manager
 * Handles all native FoundryVTT UI integration points
 */
class WFRPNativeUIIntegration {
    
    /**
     * Constructor for WFRPNativeUIIntegration
     * @param {Object} logger - Debug logger instance
     */
    constructor(logger = null) {
        this.logger = logger;
        this.isInitialized = false;
        
        this.log('Native UI Integration initialized');
    }

    /**
     * Initialize all native UI integration points
     */
    async initialize() {
        if (this.isInitialized) {
            this.log('Native UI Integration already initialized, skipping');
            return;
        }

        try {
            this.log('=== Initializing Native UI Integration ===');
            
            // Initialize scene controls integration
            this.initializeSceneControls();
            
            // Initialize sidebar integration
            this.initializeSidebarIntegration();
            
            // Initialize hotbar macro support
            this.initializeHotbarMacroSupport();
            
            // Initialize global API
            this.initializeGlobalAPI();
            
            this.isInitialized = true;
            this.log('Native UI Integration initialization complete');
            
        } catch (error) {
            console.error('WFRP Trading | Native UI Integration failed:', error);
            throw error;
        }
    }

    /**
     * Initialize scene controls integration
     * Adds trading tool to scene controls toolbar
     */
    initializeSceneControls() {
        this.log('Initializing scene controls integration');
        
        Hooks.on('getSceneControlButtons', (controls) => {
            this.log('Adding trading controls to scene controls');
            
            const tradingControls = {
                name: 'wfrp-trading',
                title: 'WFRP Trading',
                icon: 'fas fa-coins',
                layer: 'WFRPTradingLayer',
                tools: [
                    {
                        name: 'open-trading',
                        title: 'Open Trading Interface',
                        icon: 'fas fa-store',
                        button: true,
                        onClick: () => {
                            this.log('Scene controls trading button clicked');
                            this.openTradingInterface();
                        }
                    },
                    {
                        name: 'quick-trade',
                        title: 'Quick Trade',
                        icon: 'fas fa-handshake',
                        button: true,
                        onClick: () => {
                            this.log('Scene controls quick trade button clicked');
                            this.openQuickTrade();
                        }
                    }
                ]
            };
            
            controls.push(tradingControls);
            this.log('Trading controls added to scene controls');
        });
    }

    /**
     * Initialize sidebar integration
     * Adds trading tab to the sidebar using FoundryVTT v13 approach
     */
    initializeSidebarIntegration() {
        this.log('Initializing sidebar integration');
        
        // Wait for the ready hook to ensure UI is fully loaded
        Hooks.once('ready', () => {
            this.log('Creating WFRP Trading sidebar tab');
            
            // Define a new Sidebar Tab Application
            class WFRPTradingSidebarTab extends Application {
                static get defaultOptions() {
                    return foundry.utils.mergeObject(super.defaultOptions, {
                        id: "wfrp-trading-sidebar",
                        title: "WFRP Trading",
                        template: "modules/trading-places/templates/sidebar-trading.hbs",
                        classes: ["sidebar-tab", "wfrp-trading-sidebar"],
                        width: 300,
                        height: "auto",
                        resizable: true,
                        minimizable: true,
                        scrollY: [".content"]
                    });
                }
                
                getData() {
                    return {
                        currentSeason: game.settings.get("trading-places", "currentSeason") || "spring",
                        isGM: game.user.isGM
                    };
                }
                
                activateListeners(html) {
                    super.activateListeners(html);
                    
                    // Add click handlers for trading actions
                    html.find('.open-trading').on('click', (event) => {
                        event.preventDefault();
                        this.log('Sidebar: Open Trading clicked');
                        this.openTradingInterface();
                    }.bind(this));
                    
                    html.find('.quick-trade').on('click', (event) => {
                        event.preventDefault();
                        this.log('Sidebar: Quick Trade clicked');
                        this.openQuickTrade();
                    }.bind(this));
                    
                    // Add season selector handler (GM only)
                    html.find('.season-selector').on('change', async (event) => {
                        const newSeason = event.target.value;
                        this.log(`Sidebar: Season changed to ${newSeason}`);
                        
                        try {
                            await game.settings.set("trading-places", "currentSeason", newSeason);
                            ui.notifications.info(`Trading season changed to ${newSeason}`);
                            
                            // Re-render the sidebar to update the display
                            this.render(true);
                            
                        } catch (error) {
                            console.error('Failed to change season:', error);
                            ui.notifications.error(`Failed to change season: ${error.message}`);
                        }
                    }.bind(this));
                }
                
                log(message, data = null) {
                    if (window.wfrpLogger && window.wfrpLogger.log) {
                        window.wfrpLogger.log('Sidebar Tab', message, data);
                    } else {
                        console.log(`WFRP Trading | Sidebar Tab: ${message}`, data || '');
                    }
                }
                
                async openTradingInterface() {
                    try {
                        if (typeof WFRPTradingApplication !== 'undefined') {
                            const app = new WFRPTradingApplication();
                            await app.render(true);
                        } else if (typeof WFRPSimpleTradingApplication !== 'undefined') {
                            await WFRPSimpleTradingApplication.create();
                        } else {
                            ui.notifications.error('Trading interface not available.');
                        }
                    } catch (error) {
                        console.error('Failed to open trading interface:', error);
                        ui.notifications.error(`Failed to open trading interface: ${error.message}`);
                    }
                }
                
                async openQuickTrade() {
                    await this.openTradingInterface();
                }
            }
            
            // Create the tab instance
            const tradingTab = new WFRPTradingSidebarTab();
            
            // Register the tab with the sidebar
            ui.sidebar.tabs.push(tradingTab);
            
            // Add the button to the Sidebar UI
            const button = $(`
                <a class="item" title="WFRP Trading" data-tab="wfrp-trading-sidebar">
                    <i class="fas fa-coins"></i>
                </a>
            `);
            
            // Add click handler to activate the tab
            button.on("click", () => {
                this.log('Sidebar button clicked, activating trading tab');
                ui.sidebar.activateTab("wfrp-trading-sidebar");
            });
            
            // Insert the button into the sidebar tabs
            ui.sidebar.element.find(".directory-tabs").append(button);
            
            this.log('WFRP Trading sidebar tab and button added successfully');
        });
    }

    /**
     * Initialize hotbar macro support
     * Creates macro commands for easy hotbar access
     */
    initializeHotbarMacroSupport() {
        this.log('Initializing hotbar macro support');
        
        // Add trading button to hotbar on render
        Hooks.on('renderHotbar', (app, html, data) => {
            this.log('Adding trading button to hotbar');
            
            // Remove any existing trading buttons first
            html.find('.wfrp-trading-macro').remove();
            
            const tradingButton = $(`
                <div class="macro wfrp-trading-macro" 
                     data-slot="trading" 
                     title="WFRP Trading Interface"
                     style="
                         background: linear-gradient(135deg, #ff6400, #ff8533);
                         border: 2px solid #333;
                         border-radius: 4px;
                         cursor: pointer;
                         display: flex;
                         align-items: center;
                         justify-content: center;
                         color: white;
                         font-weight: bold;
                         margin: 2px;
                         width: 50px;
                         height: 50px;
                         position: relative;
                         box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                         transition: all 0.2s ease;
                     ">
                    <i class="fas fa-coins" style="font-size: 18px;"></i>
                </div>
            `);
            
            // Add hover effects
            tradingButton.on('mouseenter', function() {
                $(this).css('transform', 'scale(1.05)');
            }).on('mouseleave', function() {
                $(this).css('transform', 'scale(1)');
            });
            
            // Add click handler
            tradingButton.on('click', (event) => {
                event.preventDefault();
                this.log('Hotbar trading button clicked');
                this.openTradingInterface();
            });
            
            // Insert at the beginning of the hotbar
            html.find('#macro-list').prepend(tradingButton);
            this.log('Trading button added to hotbar');
        });
    }

    /**
     * Initialize global API for macro support
     * Creates game.wfrpTrading API for macro commands
     */
    initializeGlobalAPI() {
        this.log('Initializing global API for macro support');
        
        // Create global API namespace
        game.wfrpTrading = game.wfrpTrading || {};
        
        // Add API methods
        game.wfrpTrading.openTrading = () => {
            this.log('API: openTrading called');
            this.openTradingInterface();
        };
        
        game.wfrpTrading.openQuickTrade = () => {
            this.log('API: openQuickTrade called');
            this.openQuickTrade();
        };
        
        game.wfrpTrading.openSimpleTrading = () => {
            this.log('API: openSimpleTrading called');
            this.openSimpleTradingInterface();
        };
        
        // Add utility methods
        game.wfrpTrading.getCurrentSeason = () => {
            return game.settings.get("trading-places", "currentSeason") || "spring";
        };
        
        game.wfrpTrading.setSeason = async (season) => {
            this.log(`API: setSeason called with ${season}`);
            const validSeasons = ['spring', 'summer', 'autumn', 'winter'];
            if (!validSeasons.includes(season)) {
                throw new Error(`Invalid season: ${season}. Valid seasons: ${validSeasons.join(', ')}`);
            }
            await game.settings.set("trading-places", "currentSeason", season);
            ui.notifications.info(`Trading season changed to ${season}`);
        };
        
        // Add debug methods
        game.wfrpTrading.enableDebugLogging = async () => {
            await game.settings.set("trading-places", "debugLogging", true);
            ui.notifications.info('WFRP Trading debug logging enabled');
        };
        
        game.wfrpTrading.disableDebugLogging = async () => {
            await game.settings.set("trading-places", "debugLogging", false);
            ui.notifications.info('WFRP Trading debug logging disabled');
        };
        
        this.log('Global API initialized with methods:', Object.keys(game.wfrpTrading));
    }

    /**
     * Open the main trading interface
     */
    async openTradingInterface() {
        this.log('Opening main trading interface');
        
        try {
            // Check if V2 application is available
            if (typeof WFRPTradingApplication !== 'undefined') {
                this.log('Using WFRPTradingApplication (V2)');
                const app = new WFRPTradingApplication();
                await app.render(true);
            } else if (typeof WFRPSimpleTradingApplication !== 'undefined') {
                this.log('Fallback to WFRPSimpleTradingApplication');
                await WFRPSimpleTradingApplication.create();
            } else {
                this.log('No trading application available, showing error');
                ui.notifications.error('Trading interface not available. Please reload the module.');
            }
        } catch (error) {
            console.error('WFRP Trading | Failed to open trading interface:', error);
            ui.notifications.error(`Failed to open trading interface: ${error.message}`);
        }
    }

    /**
     * Open the simple trading interface
     */
    async openSimpleTradingInterface() {
        this.log('Opening simple trading interface');
        
        try {
            if (typeof WFRPSimpleTradingApplication !== 'undefined') {
                await WFRPSimpleTradingApplication.create();
            } else {
                ui.notifications.error('Simple trading interface not available.');
            }
        } catch (error) {
            console.error('WFRP Trading | Failed to open simple trading interface:', error);
            ui.notifications.error(`Failed to open simple trading interface: ${error.message}`);
        }
    }

    /**
     * Open quick trade dialog
     */
    async openQuickTrade() {
        this.log('Opening quick trade dialog');
        
        try {
            // For now, open the main interface
            // In the future, this could be a simplified quick-trade dialog
            await this.openTradingInterface();
        } catch (error) {
            console.error('WFRP Trading | Failed to open quick trade:', error);
            ui.notifications.error(`Failed to open quick trade: ${error.message}`);
        }
    }

    /**
     * Remove any floating button overlays
     * Called during initialization to clean up old UI elements
     */
    removeFloatingButtonOverlays() {
        this.log('Removing floating button overlays');
        
        // Remove any existing floating buttons
        $('.trading-module-button').remove();
        $('.trading-button').remove();
        
        this.log('Floating button overlays removed');
    }

    /**
     * Log debug messages if logger is available
     * @param {string} message - Message to log
     * @param {*} data - Optional data to log
     */
    log(message, data = null) {
        if (this.logger && this.logger.log) {
            this.logger.log('UI Integration', message, data);
        } else {
            console.log(`WFRP Trading | UI Integration: ${message}`, data || '');
        }
    }
}

// Export for global access
window.WFRPNativeUIIntegration = WFRPNativeUIIntegration;
console.log('WFRP Trading | WFRPNativeUIIntegration class registered globally');