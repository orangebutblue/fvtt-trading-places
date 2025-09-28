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
                    
                    // Try to directly add our control to the live controls object
                    console.log('Trading Places | Trying to directly add trading control...');
                    try {
                        // Check what controls exist
                        const currentControls = ui.controls.controls;
                        console.log('Trading Places | Current control names:', Object.keys(currentControls));
                        
                        // Let's examine the structure of existing controls
                        const firstControlName = Object.keys(currentControls)[0];
                        if (firstControlName) {
                            const firstControl = currentControls[firstControlName];
                            console.log('Trading Places | Sample control structure:', firstControlName, firstControl);
                            console.log('Trading Places | Sample control keys:', Object.keys(firstControl));
                        }
                        
                        // Check if our control already exists
                        if (currentControls['wfrp-trading']) {
                            console.log('Trading Places | Trading control already exists in live controls');
                            return;
                        }
                        
                        // Directly add our control to the live controls object
                        // Use FoundryVTT's expected structure with tools array
                        const tradingControl = {
                            name: 'wfrp-trading',
                            title: 'WFRP Trading Places',
                            icon: 'fas fa-coins',
                            layer: 'TokenLayer',
                            visible: true,
                            order: 100, // Put it at the end
                            tools: [{
                                name: 'open-trading',
                                title: 'Open Trading Interface',
                                icon: 'fas fa-store',
                                button: true,
                                onClick: () => {
                                    console.log('WFRP Trading | Trading tool clicked!');
                                    try {
                                        if (window.WFRPTradingApplication) {
                                            console.log('WFRP Trading | Opening WFRPTradingApplication...');
                                            const app = new window.WFRPTradingApplication();
                                            app.render(true);
                                            console.log('WFRP Trading | WFRPTradingApplication opened successfully');
                                        } else if (window.WFRPSimpleTradingV2) {
                                            console.log('WFRP Trading | Opening WFRPSimpleTradingV2...');
                                            window.WFRPSimpleTradingV2.openDialog();
                                            console.log('WFRP Trading | WFRPSimpleTradingV2 opened successfully');
                                        } else {
                                            console.log('WFRP Trading | No trading applications available');
                                            ui.notifications.info('Trading interface clicked! Applications are available.');
                                        }
                                    } catch (error) {
                                        console.error('WFRP Trading | Error opening trading interface:', error);
                                        ui.notifications.error('Error opening trading interface. Check console for details.');
                                    }
                                }
                            }],
                            activeTool: 'open-trading'
                        };
                        
                        // Add to the live controls object
                        currentControls['wfrp-trading'] = tradingControl;
                        console.log('Trading Places | Added trading control to live controls object');
                        console.log('Trading Places | Controls now include:', Object.keys(currentControls));
                        console.log('Trading Places | Our control structure:', tradingControl);
                        
                        // Hook into multiple possible events to see what fires
                        console.log('Trading Places | Setting up multiple activation hooks...');
                        
                        Hooks.on('controlTool', (control, tool) => {
                            console.log('Trading Places | controlTool hook:', control, tool);
                            if (control === 'wfrp-trading' && tool === 'open-trading') {
                                this.openTradingInterface();
                            }
                        });
                        
                        Hooks.on('renderSceneControls', (app, html, data) => {
                            console.log('Trading Places | Scene controls rendered, setting up click handlers...');
                            
                            // Ensure html is a jQuery object
                            const $html = html instanceof jQuery ? html : $(html);
                            
                            // Try multiple selectors to find our button
                            const selectors = [
                                '[data-tool="open-trading"]',
                                '[data-control="wfrp-trading"]',
                                '.control-tool[data-tool="open-trading"]',
                                '.scene-control[data-control="wfrp-trading"] .control-tool',
                                'li[data-tool="open-trading"]'
                            ];
                            
                            let tradingButton = $();
                            selectors.forEach(selector => {
                                const found = $html.find(selector);
                                console.log(`Trading Places | Selector "${selector}" found:`, found.length);
                                if (found.length > 0 && tradingButton.length === 0) {
                                    tradingButton = found;
                                }
                            });
                            
                            // Also log what buttons actually exist
                            const allButtons = $html.find('[data-tool]');
                            console.log('Trading Places | All tool buttons found:', allButtons.length);
                            allButtons.each((i, el) => {
                                console.log(`Trading Places | Button ${i}:`, el.getAttribute('data-tool'), el);
                            });
                            
                            if (tradingButton.length > 0) {
                                tradingButton.off('click').on('click', (event) => {
                                    console.log('WFRP Trading | Button clicked via direct handler!');
                                    event.preventDefault();
                                    event.stopPropagation();
                                    this.openTradingInterface();
                                });
                                console.log('Trading Places | Click handler attached to trading button');
                            } else {
                                console.log('Trading Places | No trading button found with any selector');
                            }
                        });
                        
                        Hooks.on('activateSceneControl', (control) => {
                            console.log('Trading Places | Scene control activated:', control);
                        });
                        
                        // Set up persistent click handler using event delegation
                        console.log('Trading Places | Setting up persistent click handler...');
                        $(document).off('click.wfrp-trading').on('click.wfrp-trading', '[data-tool="open-trading"]', (event) => {
                            console.log('WFRP Trading | Button clicked via document delegation!');
                            event.preventDefault();
                            event.stopPropagation();
                            this.openTradingInterface();
                        });
                        console.log('Trading Places | Document click handler registered');
                        
                        // Force render
                        ui.controls.render(true);
                        console.log('Trading Places | Forced render complete');
                        
                    } catch (error) {
                        console.error('Trading Places | Error directly adding control:', error);
                    }
                } else {
                    console.log('Trading Places | ui.controls not available yet');
                }
            }, 500);
            
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
        
        // Safety check - make sure controls is a valid array
        if (!controls || !Array.isArray(controls)) {
            console.log('WFRP Trading | Controls is not a valid array in addTradingControls:', typeof controls);
            return;
        }
        
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
        console.log('WFRP Trading | openTradingInterface called');
        this.log('Scene controls trading button clicked - opening interface');
        
        try {
            console.log('WFRP Trading | Checking for WFRPTradingApplication...');
            console.log('WFRP Trading | window.WFRPTradingApplication:', typeof window.WFRPTradingApplication);
            
            // Try to open the trading interface using the proper application
            if (window.WFRPTradingApplication) {
                console.log('WFRP Trading | Creating WFRPTradingApplication instance...');
                const app = new window.WFRPTradingApplication();
                console.log('WFRP Trading | App created:', app);
                console.log('WFRP Trading | Calling app.render(true)...');
                app.render(true);
                console.log('WFRP Trading | app.render(true) completed');
                this.log('Trading interface opened successfully');
            } else {
                // Fallback to simple trading if main app not available
                console.log('WFRP Trading | WFRPTradingApplication not available, trying fallback');
                this.log('Main trading app not available, trying fallback');
                console.log('WFRP Trading | window.WFRPSimpleTradingV2:', typeof window.WFRPSimpleTradingV2);
                
                if (window.WFRPSimpleTradingV2) {
                    console.log('WFRP Trading | Calling WFRPSimpleTradingV2.openDialog()...');
                    window.WFRPSimpleTradingV2.openDialog();
                    console.log('WFRP Trading | WFRPSimpleTradingV2.openDialog() completed');
                } else {
                    console.log('WFRP Trading | No trading applications available');
                    ui.notifications.error("Trading interface not available.");
                    this.log('No trading interface available');
                }
            }
            console.log('WFRP Trading | openTradingInterface completed successfully');
        } catch (error) {
            console.error('WFRP Trading | Error in openTradingInterface:', error);
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