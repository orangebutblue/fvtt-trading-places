console.log('Trading Places | Loading proper-scene-controls.js');

/**
 * Trading Places Places - Proper Scene Controls Integration
 * Simple, clean integration with FoundryVTT scene controls (left sidebar)
 */

/**
 * Proper Scene Controls Integration
 * Adds a single trading button to the scene controls toolbar - the FoundryVTT way
 */
class WFRPProperSceneControls {
    
    /**
     * Constructor
     * @param {Object} logger - Debug logger instance
     */
    constructor(logger = null) {
        this.logger = logger;
        this.isInitialized = false;
        
        this.log('Proper Scene Controls initialized');
    }

    /**
     * Initialize scene controls integration
     * This is the ONLY UI integration we should have
     */
    async initialize() {
        if (this.isInitialized) {
            this.log('Scene controls already initialized, skipping');
            return;
        }

        try {
            this.log('=== Initializing Proper Scene Controls ===');
            
            // Check if Hooks is available
            if (typeof Hooks === 'undefined') {
                throw new Error('Hooks object not available - FoundryVTT not ready');
            }
            
            // Hook into FoundryVTT's scene controls system
            console.log('Trading Places | Registering getSceneControlButtons hook...');
            Hooks.on('getSceneControlButtons', (controls) => {
                console.log('Trading Places | *** getSceneControlButtons hook FIRED! ***');
                console.log('Trading Places | Controls array received:', controls.length, 'controls');
                try {
                    this.addTradingControls(controls);
                } catch (hookError) {
                    this.log('Error in getSceneControlButtons hook', hookError);
                    console.error('Trading Places | Hook error:', hookError);
                }
            });
            console.log('Trading Places | getSceneControlButtons hook registered successfully');
            
            // Force scene controls to refresh and trigger the hook
            console.log('Trading Places | Attempting to force scene controls refresh...');
            setTimeout(() => {
                if (ui.controls) {
                    console.log('Trading Places | ui.controls available, forcing render...');
                    ui.controls.render();
                } else {
                    console.log('Trading Places | ui.controls not available yet');
                }
            }, 100);
            
            this.isInitialized = true;
            this.log('Scene controls integration initialized successfully');
            
        } catch (error) {
            this.log('Error initializing scene controls', error);
            console.error('Trading Places | Scene controls initialization error:', error);
            throw error;
        }
    }

    /**
     * Add trading controls to scene controls toolbar
     * @param {Array} controls - Scene controls array
     */
    addTradingControls(controls) {
        this.log('Adding trading button to scene controls');
        
        const tradingControls = {
            name: "wfrp-trading",
            title: "Trading Places Places",
            icon: "fas fa-coins",
            visible: true,
            layer: "TokenLayer", // Default layer when this tool is active
            tools: [
                {
                    name: "open-trading",
                    title: "Open Trading Interface",
                    icon: "fas fa-store",
                    button: true,
                    onClick: () => this.openTradingInterface()
                }
            ]
        };
        
        controls.push(tradingControls);
        this.log('Trading controls added to scene controls successfully');
    }

    /**
     * Open the trading interface
     * Called when the scene controls button is clicked
     */
    openTradingInterface() {
        this.log('Scene controls trading button clicked - opening interface');
        
        try {
            // Try to open the trading interface using the proper application
            if (window.WFRPTradingApplication) {
                const app = new window.WFRPTradingApplication();
                app.render(true);
                this.log('Trading interface opened successfully');
            } else {
                // Fallback to simple trading if main app not available
                this.log('Main trading app not available, trying fallback');
                if (window.WFRPSimpleTradingV2) {
                    window.WFRPSimpleTradingV2.openDialog();
                } else {
                    ui.notifications.error("Trading interface not available.");
                    this.log('No trading interface available');
                }
            }
        } catch (error) {
            this.log('Error opening trading interface', error);
            ui.notifications.error("Error opening trading interface. Check console for details.");
        }
    }

    /**
     * Log debug messages if logger is available
     * @param {string} message - Message to log
     * @param {*} data - Optional data to log
     */
    log(message, data = null) {
        if (this.logger && this.logger.log) {
            this.logger.log('Scene Controls', message, data);
        } else {
            console.log(`Trading Places | Scene Controls: ${message}`, data || '');
        }
    }
}

// Add immediate test to see if script is loading
console.log('Trading Places | WFRPProperSceneControls class defined successfully');

// Export for global access - defensive check for window object
try {
    if (typeof window !== 'undefined') {
        window.WFRPProperSceneControls = WFRPProperSceneControls;
        console.log('Trading Places | WFRPProperSceneControls class registered globally');
    } else if (typeof globalThis !== 'undefined') {
        globalThis.WFRPProperSceneControls = WFRPProperSceneControls;
        console.log('Trading Places | WFRPProperSceneControls class registered on globalThis');
    } else {
        // Fallback - try to make it available anyway
        global.WFRPProperSceneControls = WFRPProperSceneControls;
        console.log('Trading Places | WFRPProperSceneControls class registered on global');
    }
} catch (error) {
    console.error('Trading Places | Failed to register WFRPProperSceneControls globally:', error);
}