/**
 * WFRP River Trading Module
 * Main module initialization and hook registration
 */

// Module constants
const MODULE_ID = "trading-places";
const MODULE_VERSION = "1.0.0";

// Global module state
let dataManager = null;
let systemAdapter = null;
let tradingEngine = null;
let configValidator = null;
let errorHandler = null;
let debugLogger = null;

// Module initialization
Hooks.once('init', () => {
    console.log('WFRP River Trading | Initializing module');

    // Register module settings
    registerModuleSettings();

    // Register settings change handlers
    registerSettingsChangeHandlers();

    console.log('WFRP River Trading | Module initialized');
});

// Ready hook - module fully loaded
Hooks.once('ready', async () => {
    console.log('WFRP River Trading | Module ready');

    try {
        // Initialize debug logger first
        debugLogger = new WFRPDebugLogger();
        window.wfrpLogger = debugLogger;
        
        // Initialize error handler
        errorHandler = new RuntimeErrorHandler(MODULE_ID);

        // Initialize configuration validator
        configValidator = new ConfigValidator();

        // Wait a moment for all classes to be registered on window object
        await new Promise(resolve => setTimeout(resolve, 100));

        // Perform comprehensive startup validation
        const validationResult = await configValidator.performStartupValidation();

        if (!validationResult.valid) {
            // Generate diagnostic report
            const diagnosticReport = configValidator.generateDiagnosticReport(validationResult);
            console.error('WFRP River Trading | Startup validation failed:\n', diagnosticReport);

            // Generate recovery procedures
            const recoveryProcedures = configValidator.generateErrorRecoveryProcedures(validationResult.errors);

            // Show user-friendly error message
            const errorMessage = `WFRP River Trading startup validation failed with ${validationResult.errors.length} error(s). Check console for detailed diagnostic report.`;
            ui.notifications.error(errorMessage, { permanent: true });

            // Optionally show recovery dialog
            await showValidationErrorDialog(validationResult, recoveryProcedures);

            return; // Stop initialization if validation fails
        }

        // Show warnings if any
        if (validationResult.warnings.length > 0) {
            const warningMessage = `WFRP River Trading loaded with ${validationResult.warnings.length} warning(s). Check console for details.`;
            ui.notifications.warn(warningMessage);
            console.warn('WFRP River Trading | Startup warnings:', validationResult.warnings);
        }

        // Perform settings migration if needed
        await performSettingsMigration();

        // Initialize core components (validation already passed)
        await initializeCoreComponents();

        // Load active dataset (validation already passed)
        await loadActiveDataset();
        
        // Initialize logger integration with core components
        WFRPLoggerIntegration.initializeIntegration(tradingEngine, dataManager);
        
        // Set logger on trading engine and data manager
        if (tradingEngine && debugLogger) {
            tradingEngine.setLogger(debugLogger);
        }
        if (dataManager && debugLogger) {
            dataManager.setLogger(debugLogger);
        }

        // Register UI elements
        registerUIElements();

        // Add the trading button directly here to ensure it appears
        setTimeout(() => {
            const tradingButton = $(`
                <div class="trading-module-button" style="
                    position: fixed;
                    top: 10px;
                    right: 10px;
                    z-index: 1000;
                    background: #ff6400;
                    color: white;
                    padding: 10px 15px;
                    border-radius: 5px;
                    cursor: pointer;
                    font-weight: bold;
                    box-shadow: 0 2px 5px rgba(0,0,0,0.3);
                    font-size: 14px;
                " title="Click to Open Trading Dialog">
                    <i class="fas fa-coins"></i> TRADING
                </div>
            `);

            tradingButton.click(() => {
                console.log('Trading button clicked!');
                console.log('Checking if openSimpleTrading exists:', typeof openSimpleTrading);

                if (typeof openSimpleTrading === 'function') {
                    openSimpleTrading();
                } else {
                    console.error('openSimpleTrading function not found!');
                    // Fallback to inline dialog
                    new Dialog({
                        title: "WFRP Trading (Fallback)",
                        content: `<div style="padding: 20px;"><h2>Trading Interface</h2><p>This is a fallback dialog. The main trading interface is not loading properly.</p><p>Settlements available: ${dataManager?.getAllSettlements()?.length || 0}</p></div>`,
                        buttons: { close: { label: "Close", callback: () => { } } }
                    }).render(true);
                }
            });

            $('body').append(tradingButton);
            console.log('WFRP River Trading | Orange button added to top-right corner');
        }, 2000);

        console.log('WFRP River Trading | Setup complete');
        ui.notifications.info('WFRP River Trading loaded successfully');

    } catch (error) {
        console.error('WFRP River Trading | Setup failed:', error);

        // Use error handler if available
        if (errorHandler) {
            errorHandler.handleDataLoadingError(error, 'Module Initialization', 'startup');
        } else {
            // Fallback error handling
            ui.notifications.error(`WFRP River Trading setup failed: ${error.message}`, { permanent: true });
        }

        // Generate error recovery procedures
        if (configValidator) {
            const recoveryProcedures = configValidator.generateErrorRecoveryProcedures([error.message]);
            console.log('WFRP River Trading | Recovery procedures:', recoveryProcedures);
        }
    }
});

/**
 * Register module settings with FoundryVTT
 */
function registerModuleSettings() {
    // Active dataset setting
    game.settings.register(MODULE_ID, "activeDataset", {
        name: "TRADING-PLACES.Settings.ActiveDataset.Name",
        hint: "TRADING-PLACES.Settings.ActiveDataset.Hint",
        scope: "world",
        config: true,
        type: String,
        default: "wfrp4e-default",
        onChange: onActiveDatasetChange
    });

    // Current season setting
    game.settings.register(MODULE_ID, "currentSeason", {
        name: "TRADING-PLACES.Settings.CurrentSeason.Name",
        hint: "TRADING-PLACES.Settings.CurrentSeason.Hint",
        scope: "world",
        config: true,
        type: String,
        choices: {
            "spring": "WFRP-TRADING.Seasons.Spring",
            "summer": "WFRP-TRADING.Seasons.Summer",
            "autumn": "WFRP-TRADING.Seasons.Autumn",
            "winter": "WFRP-TRADING.Seasons.Winter"
        },
        default: "spring",
        onChange: onCurrentSeasonChange
    });

    // Chat visibility setting
    game.settings.register(MODULE_ID, "chatVisibility", {
        name: "TRADING-PLACES.Settings.ChatVisibility.Name",
        hint: "TRADING-PLACES.Settings.ChatVisibility.Hint",
        scope: "world",
        config: true,
        type: String,
        choices: {
            "gm": "WFRP-TRADING.Settings.ChatVisibility.GM",
            "all": "WFRP-TRADING.Settings.ChatVisibility.All"
        },
        default: "gm",
        onChange: onChatVisibilityChange
    });

    // Module version setting (for migration tracking)
    game.settings.register(MODULE_ID, "moduleVersion", {
        name: "Module Version",
        hint: "Internal setting for tracking module version",
        scope: "world",
        config: false,
        type: String,
        default: "0.0.0"
    });

    // Last dataset validation setting
    game.settings.register(MODULE_ID, "lastDatasetValidation", {
        name: "Last Dataset Validation",
        hint: "Internal setting for tracking dataset validation",
        scope: "world",
        config: false,
        type: String,
        default: ""
    });

    // Trading dialog position setting
    game.settings.register(MODULE_ID, "dialogPosition", {
        name: "TRADING-PLACES.Settings.DialogPosition.Name",
        hint: "TRADING-PLACES.Settings.DialogPosition.Hint",
        scope: "client",
        config: true,
        type: Object,
        default: { top: 100, left: 100, width: 600, height: 400 }
    });

    // Enable debug logging setting
    game.settings.register(MODULE_ID, "debugLogging", {
        name: "TRADING-PLACES.Settings.DebugLogging.Name",
        hint: "TRADING-PLACES.Settings.DebugLogging.Hint",
        scope: "world",
        config: true,
        type: Boolean,
        default: false,
        onChange: onDebugLoggingChange
    });
}

/**
 * Register settings change handlers
 */
function registerSettingsChangeHandlers() {
    // Additional setup for change handlers if needed
    console.log('WFRP River Trading | Settings change handlers registered');
}

/**
 * Handle active dataset setting change
 * @param {string} newValue - New dataset name
 */
async function onActiveDatasetChange(newValue) {
    console.log(`WFRP River Trading | Active dataset changed to: ${newValue}`);

    try {
        // Validate new dataset exists
        const validation = await validateDatasetExists(newValue);
        if (!validation.valid) {
            ui.notifications.error(`Dataset validation failed: ${validation.errors.join(', ')}`);
            return;
        }

        // Reload dataset
        if (dataManager) {
            await dataManager.switchDataset(newValue);
            ui.notifications.info(`Switched to dataset: ${newValue}`);
        }

        // Update last validation timestamp
        await game.settings.set(MODULE_ID, "lastDatasetValidation", new Date().toISOString());

    } catch (error) {
        console.error('WFRP River Trading | Dataset change failed:', error);
        ui.notifications.error(`Failed to switch dataset: ${error.message}`);
    }
}

/**
 * Handle current season setting change
 * @param {string} newValue - New season name
 */
async function onCurrentSeasonChange(newValue) {
    console.log(`WFRP River Trading | Current season changed to: ${newValue}`);

    try {
        // Validate season value
        const validSeasons = ['spring', 'summer', 'autumn', 'winter'];
        if (!validSeasons.includes(newValue)) {
            ui.notifications.error(`Invalid season: ${newValue}`);
            return;
        }

        // Update trading engine if initialized
        if (tradingEngine) {
            tradingEngine.setCurrentSeason(newValue);
        }

        // Notify users of season change
        ui.notifications.info(`Trading season changed to ${newValue}. All prices updated.`);

        // Post chat message about season change
        if (typeof ChatMessage !== 'undefined') {
            await ChatMessage.create({
                content: `<div class="season-change"><h3>Season Changed</h3><p>Trading season is now <strong>${newValue}</strong>. All cargo prices have been updated accordingly.</p></div>`,
                whisper: game.settings.get(MODULE_ID, "chatVisibility") === "gm" ? [game.user.id] : null
            });
        }

    } catch (error) {
        console.error('WFRP River Trading | Season change failed:', error);
        ui.notifications.error(`Failed to change season: ${error.message}`);
    }
}

/**
 * Handle chat visibility setting change
 * @param {string} newValue - New visibility setting
 */
async function onChatVisibilityChange(newValue) {
    console.log(`WFRP River Trading | Chat visibility changed to: ${newValue}`);

    const validValues = ['gm', 'all'];
    if (!validValues.includes(newValue)) {
        ui.notifications.error(`Invalid chat visibility setting: ${newValue}`);
        return;
    }

    ui.notifications.info(`Chat visibility set to: ${newValue === 'gm' ? 'GM Only' : 'All Players'}`);
}

/**
 * Handle debug logging setting change
 * @param {boolean} newValue - New debug logging setting
 */
async function onDebugLoggingChange(newValue) {
    console.log(`WFRP River Trading | Debug logging ${newValue ? 'enabled' : 'disabled'}`);

    // Update logger if it exists
    if (debugLogger) {
        debugLogger.setEnabled(newValue);
    }
    
    // Update global logger if it exists
    if (window.wfrpLogger) {
        window.wfrpLogger.setEnabled(newValue);
    }

    if (newValue) {
        ui.notifications.info('Debug logging enabled for WFRP River Trading');
    }
}

/**
 * Perform settings migration if needed
 */
async function performSettingsMigration() {
    const currentVersion = game.settings.get(MODULE_ID, "moduleVersion");

    if (currentVersion === MODULE_VERSION) {
        return; // No migration needed
    }

    console.log(`WFRP River Trading | Migrating from version ${currentVersion} to ${MODULE_VERSION}`);

    try {
        // Migration logic based on version
        if (currentVersion === "0.0.0") {
            // First time setup
            await performFirstTimeSetup();
        } else {
            // Version-specific migrations
            await performVersionMigration(currentVersion, MODULE_VERSION);
        }

        // Update version setting
        await game.settings.set(MODULE_ID, "moduleVersion", MODULE_VERSION);

        console.log('WFRP River Trading | Migration completed successfully');

    } catch (error) {
        console.error('WFRP River Trading | Migration failed:', error);
        ui.notifications.error(`Migration failed: ${error.message}`);
        throw error;
    }
}

/**
 * Perform first time setup
 */
async function performFirstTimeSetup() {
    console.log('WFRP River Trading | Performing first time setup');

    // Set default values if not already set
    const currentSeason = game.settings.get(MODULE_ID, "currentSeason");
    if (!currentSeason) {
        await game.settings.set(MODULE_ID, "currentSeason", "spring");
    }

    const activeDataset = game.settings.get(MODULE_ID, "activeDataset");
    if (!activeDataset) {
        await game.settings.set(MODULE_ID, "activeDataset", "wfrp4e-default");
    }

    // Welcome message
    ui.notifications.info('Welcome to WFRP River Trading! Check the module settings to configure your trading system.');
}

/**
 * Perform version-specific migration
 * @param {string} fromVersion - Previous version
 * @param {string} toVersion - Target version
 */
async function performVersionMigration(fromVersion, toVersion) {
    console.log(`WFRP River Trading | Migrating from ${fromVersion} to ${toVersion}`);

    // Add version-specific migration logic here
    // For example:
    // if (fromVersion < "1.0.0") {
    //     await migrateToV1();
    // }
}

/**
 * Validate that a dataset exists
 * @param {string} datasetName - Name of dataset to validate
 * @returns {Object} - Validation result
 */
async function validateDatasetExists(datasetName) {
    try {
        // Check if dataset directory exists
        const datasetPath = `modules/${MODULE_ID}/datasets/${datasetName}`;

        // For now, assume dataset is valid if name is provided
        // In a real implementation, you would check file system
        const validDatasets = ['wfrp4e-default', 'custom'];

        if (!validDatasets.includes(datasetName)) {
            return {
                valid: false,
                errors: [`Dataset '${datasetName}' not found. Available datasets: ${validDatasets.join(', ')}`]
            };
        }

        return {
            valid: true,
            errors: []
        };

    } catch (error) {
        return {
            valid: false,
            errors: [error.message]
        };
    }
}

/**
 * Show validation error dialog with recovery options
 * @param {Object} validationResult - Validation result object
 * @param {Object} recoveryProcedures - Recovery procedures object
 */
async function showValidationErrorDialog(validationResult, recoveryProcedures) {
    const content = `
        <div class="validation-error-dialog">
            <h3>Configuration Validation Failed</h3>
            <p><strong>${validationResult.errors.length} error(s) found:</strong></p>
            <ul>
                ${validationResult.errors.slice(0, 5).map(error => `<li>${error}</li>`).join('')}
                ${validationResult.errors.length > 5 ? `<li><em>... and ${validationResult.errors.length - 5} more errors</em></li>` : ''}
            </ul>
            
            ${validationResult.warnings.length > 0 ? `
                <p><strong>${validationResult.warnings.length} warning(s):</strong></p>
                <ul>
                    ${validationResult.warnings.slice(0, 3).map(warning => `<li>${warning}</li>`).join('')}
                    ${validationResult.warnings.length > 3 ? `<li><em>... and ${validationResult.warnings.length - 3} more warnings</em></li>` : ''}
                </ul>
            ` : ''}
            
            <h4>Recommended Actions:</h4>
            <ol>
                ${recoveryProcedures.general.slice(0, 3).map(step => `<li>${step}</li>`).join('')}
            </ol>
            
            <p><em>Check the browser console for a detailed diagnostic report.</em></p>
        </div>
    `;

    return new Promise((resolve) => {
        new Dialog({
            title: "WFRP River Trading - Configuration Error",
            content: content,
            buttons: {
                console: {
                    label: "View Console Report",
                    callback: () => {
                        const report = configValidator.generateDiagnosticReport(validationResult);
                        console.log(report);
                        ui.notifications.info("Diagnostic report printed to console");
                        resolve();
                    }
                },
                close: {
                    label: "Close",
                    callback: () => resolve()
                }
            },
            default: "console",
            close: () => resolve()
        }).render(true);
    });
}

/**
 * Initialize core components with error handling
 */
async function initializeCoreComponents() {
    console.log('WFRP River Trading | Initializing core components');

    try {
        // Initialize DataManager
        if (typeof DataManager !== 'undefined') {
            dataManager = new DataManager();
            console.log('WFRP River Trading | DataManager initialized');
        } else {
            throw new Error('DataManager class not available');
        }

        // Initialize SystemAdapter
        if (typeof SystemAdapter !== 'undefined') {
            systemAdapter = new SystemAdapter();

            // Connect error handler
            if (errorHandler) {
                systemAdapter.setErrorHandler(errorHandler);
            }

            // Validate system compatibility
            const systemValidation = systemAdapter.validateSystemCompatibility();
            if (!systemValidation.compatible) {
                const errorMessage = `System compatibility issues: ${systemValidation.errors.join(', ')}`;
                if (errorHandler) {
                    errorHandler.handleTradingEngineError(new Error(errorMessage), 'SystemAdapter initialization');
                }
                // Continue with warnings but don't fail completely
                console.warn('WFRP River Trading | System compatibility warnings:', systemValidation.warnings);
            }

            console.log('WFRP River Trading | SystemAdapter initialized');
        } else {
            throw new Error('SystemAdapter class not available');
        }

        // Initialize TradingEngine
        if (typeof TradingEngine !== 'undefined' && dataManager) {
            tradingEngine = new TradingEngine(dataManager);

            // Set current season with error handling
            try {
                const currentSeason = game.settings.get(MODULE_ID, "currentSeason");
                if (currentSeason) {
                    tradingEngine.setCurrentSeason(currentSeason);
                } else {
                    // Set default season
                    await game.settings.set(MODULE_ID, "currentSeason", "spring");
                    tradingEngine.setCurrentSeason("spring");
                    console.log('WFRP River Trading | Set default season to spring');
                }
            } catch (seasonError) {
                if (errorHandler) {
                    errorHandler.handleTradingEngineError(seasonError, 'Season initialization');
                }
                // Use fallback season
                tradingEngine.setCurrentSeason("spring");
            }

            console.log('WFRP River Trading | TradingEngine initialized');
        } else if (!dataManager) {
            throw new Error('DataManager required for TradingEngine initialization');
        } else {
            throw new Error('TradingEngine class not available');
        }

        console.log('WFRP River Trading | Core components initialized successfully');

    } catch (error) {
        console.error('WFRP River Trading | Component initialization failed:', error);

        if (errorHandler) {
            errorHandler.handleDataLoadingError(error, 'Core Components', 'initialization');
        }

        throw error;
    }
}

/**
 * Load active dataset with comprehensive error handling
 */
async function loadActiveDataset() {
    console.log('WFRP River Trading | Loading active dataset');

    try {
        if (!dataManager) {
            throw new Error('DataManager not initialized');
        }

        const activeDataset = game.settings.get(MODULE_ID, "activeDataset") || "wfrp4e-default";

        try {
            await dataManager.loadActiveDataset();
            console.log(`WFRP River Trading | Successfully loaded dataset: ${activeDataset}`);

            // Validate loaded data
            const validation = dataManager.validateDatasetCompleteness({
                settlements: dataManager.settlements,
                config: dataManager.config
            });

            if (!validation.valid) {
                const warningMessage = `Dataset validation warnings: ${validation.errors.join(', ')}`;
                if (errorHandler) {
                    errorHandler.notifyUser('warning', warningMessage);
                }
                console.warn('WFRP River Trading | Dataset validation warnings:', validation.errors);
            }

        } catch (datasetError) {
            // Try fallback to default dataset
            if (activeDataset !== "wfrp4e-default") {
                console.warn(`WFRP River Trading | Failed to load ${activeDataset}, trying default dataset`);

                try {
                    await dataManager.switchDataset("wfrp4e-default");
                    await game.settings.set(MODULE_ID, "activeDataset", "wfrp4e-default");

                    if (errorHandler) {
                        errorHandler.notifyUser('warning', `Failed to load dataset '${activeDataset}', switched to default dataset`);
                    }

                    console.log('WFRP River Trading | Successfully loaded default dataset as fallback');

                } catch (fallbackError) {
                    // Both datasets failed
                    if (errorHandler) {
                        errorHandler.handleDataLoadingError(fallbackError, 'Dataset', 'fallback loading');
                    }
                    throw new Error(`Failed to load both active dataset '${activeDataset}' and default dataset: ${fallbackError.message}`);
                }
            } else {
                // Default dataset failed
                if (errorHandler) {
                    errorHandler.handleDataLoadingError(datasetError, 'Default Dataset', 'loading');
                }
                throw datasetError;
            }
        }

    } catch (error) {
        console.error('WFRP River Trading | Dataset loading failed:', error);

        if (errorHandler) {
            errorHandler.handleDataLoadingError(error, 'Active Dataset', 'loading');
        } else {
            ui.notifications.error(`Failed to load dataset: ${error.message}`, { permanent: true });
        }

        throw error;
    }
}

/**
 * Register UI elements
 */
function registerUIElements() {
    console.log('WFRP River Trading | Registering UI elements');

    // Register macro commands
    if (typeof Macro !== 'undefined') {
        // Register macro for opening trading dialog
        game.wfrpTrading = game.wfrpTrading || {};
        game.wfrpTrading.openTradingDialog = openTradingDialog;
        game.wfrpTrading.testDialog = testSimpleDialog;
        game.wfrpTrading.openSimpleTrading = openSimpleTrading;
    }

    // Add trading button to scene controls
    Hooks.on('getSceneControlButtons', (controls) => {
        // Add as a new control group
        controls.push({
            name: 'trading',
            title: 'Trading',
            icon: 'fas fa-coins',
            layer: 'trading',
            tools: [{
                name: 'open-trading',
                title: 'Open Trading Dialog',
                icon: 'fas fa-coins',
                button: true,
                onClick: () => openTradingDialog()
            }]
        });
    });

    // Add prominent trading button to the main UI immediately
    setTimeout(() => {
        // Add button to the top of the screen
        const tradingButton = $(`
            <div class="trading-module-button" style="
                position: fixed;
                top: 10px;
                right: 10px;
                z-index: 1000;
                background: #ff6400;
                color: white;
                padding: 10px 15px;
                border-radius: 5px;
                cursor: pointer;
                font-weight: bold;
                box-shadow: 0 2px 5px rgba(0,0,0,0.3);
                font-size: 14px;
            " title="Open Trading Dialog">
                <i class="fas fa-coins"></i> TRADING
            </div>
        `);

        tradingButton.click(() => openTradingDialog());
        $('body').append(tradingButton);
        console.log('WFRP River Trading | Fixed button added to screen');
    }, 1000);

    // Add trading button to hotbar (more reliable)
    Hooks.on('renderHotbar', (app, html, data) => {
        // Remove any existing trading buttons first
        html.find('.trading-macro').remove();

        const tradingButton = $(`
            <div class="macro-icon trading-macro" style="
                background: #ff6400 !important;
                border: 2px solid #333;
                border-radius: 3px;
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
            " title="Click to Open Trading Dialog">
                <i class="fas fa-coins" style="font-size: 20px;"></i>
            </div>
        `);

        tradingButton.click(() => {
            console.log('Hotbar trading button clicked!');
            openTradingDialog();
        });

        html.find('#macro-list').prepend(tradingButton);
        console.log('WFRP River Trading | Trading button added to hotbar');
    });

    // Add trading button to player list (alternative location)
    Hooks.on('renderPlayerList', (app, html, data) => {
        const tradingButton = $(`
            <button class="trading-button" title="Open Trading Dialog" style="
                margin: 5px;
                padding: 8px 12px;
                background: #ff6400;
                color: white;
                border: none;
                border-radius: 3px;
                cursor: pointer;
                font-weight: bold;
                width: 100%;
            ">
                <i class="fas fa-coins"></i> Open Trading
            </button>
        `);

        tradingButton.click(() => openTradingDialog());
        html.append(tradingButton);
    });

    console.log('WFRP River Trading | UI elements registered');
}

/**
 * Simple trading dialog that works without complex templates
 */
async function openSimpleTrading() {
    try {
        console.log('Opening simple trading dialog...');

        const settlements = dataManager?.getAllSettlements() || [];
        console.log(`Found ${settlements.length} settlements`);

        const content = `
            <div style="padding: 15px; font-family: Arial, sans-serif;">
                <h2 style="margin-top: 0; color: #333; border-bottom: 2px solid #ff6400; padding-bottom: 10px;">WFRP River Trading</h2>
                
                <div style="margin: 15px 0;">
                    <label style="font-weight: bold;">Current Season:</label>
                    <select id="current-season" style="margin-left: 10px; padding: 5px;">
                        <option value="spring">Spring</option>
                        <option value="summer">Summer</option>
                        <option value="autumn">Autumn</option>
                        <option value="winter">Winter</option>
                    </select>
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 20px 0;">
                    <div style="border: 1px solid #ccc; padding: 15px; border-radius: 5px; background: #f9f9f9;">
                        <h3 style="margin-top: 0; color: #333;">Settlement Selection</h3>
                        <label style="font-weight: bold;">Select Region:</label>
                        <select id="region-selector" style="width: 100%; margin: 10px 0; padding: 5px;">
                            <option value="">-- Select Region --</option>
                            ${[...new Set(settlements.map(s => s.region))].sort().map(region => `<option value="${region}">${region}</option>`).join('')}
                        </select>
                        <label style="font-weight: bold;">Select Settlement:</label>
                        <select id="settlement-selector" style="width: 100%; margin: 10px 0; padding: 5px;" disabled>
                            <option value="">-- Select Region First --</option>
                        </select>
                        <div id="settlement-details" style="margin-top: 15px; padding: 10px; background: white; border-radius: 3px; min-height: 100px;">
                            <p style="color: #666; font-style: italic;">Select a settlement to view details</p>
                        </div>
                    </div>
                    
                    <div style="border: 1px solid #ccc; padding: 15px; border-radius: 5px; background: #f9f9f9;">
                        <h3 style="margin-top: 0; color: #333;">Available Cargo</h3>
                        <div id="cargo-list" style="background: white; padding: 10px; border-radius: 3px; min-height: 150px;">
                            <p style="color: #666; font-style: italic;">Check cargo availability to see goods</p>
                        </div>
                    </div>
                </div>
                
                <div style="border: 1px solid #ccc; padding: 15px; border-radius: 5px; background: #f9f9f9; margin: 20px 0;">
                    <h3 style="margin-top: 0; color: #333;">Actions</h3>
                    <button id="check-availability" style="padding: 10px 20px; margin: 5px; background: #4CAF50; color: white; border: none; border-radius: 3px; cursor: pointer; font-weight: bold;" disabled>Check Cargo Availability</button>
                    <button id="haggle-btn" style="padding: 10px 20px; margin: 5px; background: #FF9800; color: white; border: none; border-radius: 3px; cursor: pointer; font-weight: bold;" disabled>Attempt Haggle</button>
                    <button id="sell-btn" style="padding: 10px 20px; margin: 5px; background: #2196F3; color: white; border: none; border-radius: 3px; cursor: pointer; font-weight: bold;" disabled>Sell Cargo</button>
                </div>
            </div>
        `;

        const dialog = new Dialog({
            title: "WFRP River Trading",
            content: content,
            width: 1400,
            height: 900,
            resizable: true,
            buttons: {
                close: {
                    icon: '<i class="fas fa-times"></i>',
                    label: "Close",
                    callback: () => { }
                }
            },
            default: "close",
            render: (html) => {
                console.log('=== WFRP Trading Dialog Rendered ===');
                console.log('Available settlements:', settlements.length);
                console.log('Available regions:', [...new Set(settlements.map(s => s.region))]);
                
                // Region selection handler
                html.find('#region-selector').change((event) => {
                    const selectedRegion = event.target.value;
                    console.log('=== Region Selected ===');
                    console.log('Selected region:', selectedRegion);
                    
                    const settlementSelector = html.find('#settlement-selector');
                    
                    if (selectedRegion) {
                        const regionSettlements = settlements.filter(s => s.region === selectedRegion);
                        console.log('Settlements in region:', regionSettlements.length);
                        console.log('Settlement names:', regionSettlements.map(s => s.name));
                        
                        settlementSelector.prop('disabled', false);
                        settlementSelector.html(`
                            <option value="">-- Select Settlement --</option>
                            ${regionSettlements.map(s => `<option value="${s.name}">${s.name}</option>`).join('')}
                        `);
                    } else {
                        settlementSelector.prop('disabled', true);
                        settlementSelector.html('<option value="">-- Select Region First --</option>');
                    }
                    
                    // Clear settlement details
                    html.find('#settlement-details').html('<p style="color: #666; font-style: italic;">Select a settlement to view details</p>');
                    html.find('#check-availability').prop('disabled', true);
                });

                // Settlement selection handler
                html.find('#settlement-selector').change((event) => {
                    const settlementName = event.target.value;
                    console.log('=== Settlement Selected ===');
                    console.log('Selected settlement:', settlementName);
                    
                    const settlement = settlements.find(s => s.name === settlementName);
                    console.log('Settlement data:', settlement);

                    if (settlement) {
                        const detailsHtml = `
                            <h4 style="margin-top: 0; color: #ff6400;">${settlement.name}</h4>
                            <p><strong>Region:</strong> ${settlement.region}</p>
                            <p><strong>Size:</strong> ${settlement.size}</p>
                            <p><strong>Population:</strong> ${settlement.population?.toLocaleString() || 'Unknown'}</p>
                            <p><strong>Wealth Rating:</strong> ${settlement.wealth}/5</p>
                            <p><strong>Production:</strong> ${Array.isArray(settlement.source) ? settlement.source.join(', ') : settlement.source}</p>
                            <p><strong>Ruler:</strong> ${settlement.ruler || 'Unknown'}</p>
                        `;
                        html.find('#settlement-details').html(detailsHtml);
                        html.find('#check-availability').prop('disabled', false);
                    } else {
                        html.find('#settlement-details').html('<p style="color: #666; font-style: italic;">Select a settlement to view details</p>');
                        html.find('#check-availability').prop('disabled', true);
                    }
                });

                // Cargo availability check
                html.find('#check-availability').click(() => {
                    const selectedSettlement = html.find('#settlement-selector').val();
                    console.log('=== Cargo Availability Check ===');
                    console.log('Settlement:', selectedSettlement);
                    
                    if (selectedSettlement) {
                        const settlement = settlements.find(s => s.name === selectedSettlement);
                        console.log('Settlement data:', settlement);
                        
                        // WFRP Algorithm: Step 1 - Check Availability
                        const sizeRating = settlement.size === 'CS' ? 4 : settlement.size === 'C' ? 3 : settlement.size === 'T' ? 2 : 1;
                        const wealthRating = settlement.wealth || 2;
                        const baseChance = (sizeRating + wealthRating) * 10;
                        
                        console.log('Size rating:', sizeRating, '(', settlement.size, ')');
                        console.log('Wealth rating:', wealthRating);
                        console.log('Base availability chance:', baseChance, '%');
                        
                        const availabilityRoll = Math.floor(Math.random() * 100) + 1;
                        const available = availabilityRoll <= baseChance;
                        
                        console.log('Availability roll:', availabilityRoll, '/', baseChance);
                        console.log('Cargo available:', available ? 'YES' : 'NO');
                        
                        let cargoHtml;
                        
                        if (available) {
                            // WFRP Algorithm: Step 2 - Determine Cargo Type and Size
                            let cargoType;
                            if (Array.isArray(settlement.source) && settlement.source.length > 0) {
                                if (settlement.source.includes('Trade') && settlement.source.length > 1) {
                                    // Trade center with specific goods
                                    cargoType = settlement.source[Math.floor(Math.random() * settlement.source.length)];
                                    console.log('Trade center cargo type:', cargoType);
                                } else if (settlement.source.includes('Trade')) {
                                    // Pure trade center - random cargo
                                    const randomCargo = ['Grain', 'Timber', 'Textiles', 'Pottery', 'Wine', 'Cattle', 'Fish', 'Furs'];
                                    cargoType = randomCargo[Math.floor(Math.random() * randomCargo.length)];
                                    console.log('Random trade cargo:', cargoType);
                                } else {
                                    // Specific production
                                    cargoType = settlement.source[0];
                                    console.log('Local production cargo:', cargoType);
                                }
                            } else {
                                cargoType = 'Grain'; // Fallback
                            }
                            
                            // WFRP Algorithm: Cargo Size Calculation
                            const baseValue = sizeRating + wealthRating;
                            const sizeRoll = Math.floor(Math.random() * 100) + 1;
                            const roundedRoll = Math.ceil(sizeRoll / 10) * 10; // Round up to nearest 10
                            const cargoSize = baseValue * roundedRoll;
                            
                            console.log('Cargo size calculation:');
                            console.log('- Base value (size + wealth):', baseValue);
                            console.log('- Size roll:', sizeRoll, '-> rounded:', roundedRoll);
                            console.log('- Total cargo size:', cargoSize, 'EP');
                            
                            // WFRP Algorithm: Base Price (simplified for demo)
                            const basePrices = {
                                'Grain': 2, 'Timber': 3, 'Textiles': 8, 'Pottery': 4,
                                'Wine': 15, 'Cattle': 10, 'Fish': 3, 'Furs': 12,
                                'Trade': 5, 'Agriculture': 2, 'Government': 0
                            };
                            const basePrice = basePrices[cargoType] || 5;
                            
                            console.log('Base price for', cargoType, ':', basePrice, 'GC per 10 EP');

                            cargoHtml = `
                                <h4 style="color: #4CAF50; margin-top: 0;">Cargo Available at ${selectedSettlement}!</h4>
                                <div style="background: #e8f5e8; padding: 10px; border-radius: 3px; margin: 10px 0;">
                                    <strong>Availability Roll: ${availabilityRoll} ≤ ${baseChance} = SUCCESS!</strong>
                                </div>
                                <div style="border: 1px solid #ddd; padding: 15px; margin: 10px 0; border-radius: 3px; background: white;">
                                    <h4 style="margin-top: 0; color: #ff6400;">${cargoType}</h4>
                                    <p><strong>Available Quantity:</strong> ${cargoSize} EP</p>
                                    <p><strong>Base Price:</strong> ${basePrice} GC per 10 EP</p>
                                    <p><strong>Total Value:</strong> ${Math.floor(cargoSize / 10) * basePrice} GC</p>
                                    <div style="margin-top: 15px;">
                                        <label>Purchase Quantity (EP): </label>
                                        <input type="number" id="purchase-quantity" min="10" max="${cargoSize}" step="10" value="10" style="width: 80px; margin: 0 10px;">
                                        <button id="purchase-cargo" style="padding: 8px 16px; background: #ff6400; color: white; border: none; border-radius: 3px; cursor: pointer;">Purchase Cargo</button>
                                    </div>
                                    <div style="margin-top: 10px;">
                                        <button id="haggle-cargo" style="padding: 8px 16px; background: #FF9800; color: white; border: none; border-radius: 3px; cursor: pointer;">Attempt Haggle (-10% price)</button>
                                    </div>
                                </div>
                            `;
                        } else {
                            cargoHtml = `
                                <h4 style="color: #f44336; margin-top: 0;">No Cargo Available</h4>
                                <div style="background: #ffebee; padding: 10px; border-radius: 3px; margin: 10px 0;">
                                    <strong>Availability Roll: ${availabilityRoll} > ${baseChance} = FAILURE</strong>
                                </div>
                                <p>No merchants are currently selling cargo in ${selectedSettlement}. Try again later or visit another settlement.</p>
                            `;
                        }

                        html.find('#cargo-list').html(cargoHtml);
                        html.find('#haggle-btn, #sell-btn').prop('disabled', false);

                        // Add purchase handlers
                        html.find('#cargo-list button').click(function () {
                            $(this).text('Purchased!').prop('disabled', true).css('background', '#4CAF50');
                        });
                    }
                });

                // Haggle button
                // Dynamic event handlers for cargo interactions
                html.on('click', '#purchase-cargo', () => {
                    const quantity = parseInt(html.find('#purchase-quantity').val()) || 10;
                    console.log('=== Purchase Cargo ===');
                    console.log('Purchasing', quantity, 'EP of cargo');
                    ui.notifications.info(`Purchased ${quantity} EP of cargo!`);
                });
                
                html.on('click', '#haggle-cargo', () => {
                    console.log('=== WFRP Haggle Test ===');
                    const playerRoll = Math.floor(Math.random() * 100) + 1;
                    const merchantRoll = Math.floor(Math.random() * 100) + 1;
                    const playerSkill = 40; // Assume average haggle skill
                    const merchantSkill = 45; // Merchant skill
                    
                    console.log('Player haggle roll:', playerRoll, '/ skill:', playerSkill);
                    console.log('Merchant haggle roll:', merchantRoll, '/ skill:', merchantSkill);
                    
                    const playerSuccess = playerRoll <= playerSkill;
                    const merchantSuccess = merchantRoll <= merchantSkill;
                    
                    if (playerSuccess && !merchantSuccess) {
                        ui.notifications.info(`Haggle Success! Player: ${playerRoll}/${playerSkill}, Merchant: ${merchantRoll}/${merchantSkill} - 10% price reduction!`);
                    } else if (!playerSuccess && merchantSuccess) {
                        ui.notifications.warn(`Haggle Failed! Player: ${playerRoll}/${playerSkill}, Merchant: ${merchantRoll}/${merchantSkill} - No discount`);
                    } else {
                        ui.notifications.info(`Haggle Tie! Both rolled similar - no change in price`);
                    }
                });

                html.find('#haggle-btn').click(() => {
                    ui.notifications.info('Use the "Attempt Haggle" button on available cargo to negotiate prices.');
                });

                html.find('#sell-btn').click(() => {
                    ui.notifications.info('Selling cargo requires the WFRP selling algorithm - find buyers, check demand, negotiate prices. This is not yet implemented.');
                });
            }
        });

        dialog.render(true);
        console.log('Simple trading dialog opened successfully!');
        return dialog;

    } catch (error) {
        console.error('Failed to open simple trading dialog:', error);
        ui.notifications.error(`Failed to open trading dialog: ${error.message}`);
    }
}

/**
 * Test simple dialog to debug template loading
 */
async function testSimpleDialog() {
    try {
        const dialog = new Dialog({
            title: "Trading Test",
            template: "modules/trading-places/templates/trading-test.hbs",
            width: 400,
            height: 300,
            buttons: {
                close: {
                    label: "Close",
                    callback: () => { }
                }
            }
        }, {
            currentSeason: "spring",
            settlementsCount: dataManager?.getAllSettlements()?.length || 0
        });

        await dialog.render(true);
        console.log('Test dialog rendered successfully');
    } catch (error) {
        console.error('Test dialog failed:', error);
    }
}

/**
 * Open the trading dialog with comprehensive error handling
 * @param {Object} options - Dialog options
 * @returns {Promise<TradingDialog>} - Created dialog instance
 */
async function openTradingDialog(options = {}) {
    try {
        // Validate system state
        if (!dataManager || !tradingEngine) {
            const error = new Error('Trading system not initialized. Please wait for module to load completely.');
            if (errorHandler) {
                errorHandler.handleUIError(error, 'TradingDialog', { options });
            }
            throw error;
        }

        // Validate current season is set
        const currentSeason = tradingEngine.getCurrentSeason();
        if (!currentSeason) {
            const error = new Error('Current season not set. Please configure the season in module settings.');
            if (errorHandler) {
                errorHandler.handleTradingEngineError(error, 'Season validation');
            }
            throw error;
        }

        // Validate dataset is loaded
        if (!dataManager.settlements || dataManager.settlements.length === 0) {
            const error = new Error('No settlement data loaded. Please check dataset configuration.');
            if (errorHandler) {
                errorHandler.handleDataLoadingError(error, 'Settlement Data', 'dialog opening');
            }
            throw error;
        }

        // Create and show dialog with error handling
        try {
            const dialog = await TradingDialog.create(options);
            console.log('WFRP River Trading | Trading dialog opened successfully');
            return dialog;
        } catch (dialogError) {
            if (errorHandler) {
                const handledError = errorHandler.handleUIError(dialogError, 'TradingDialog', { options });

                // Try graceful degradation
                if (handledError.recoverable) {
                    // Attempt to create dialog with minimal options
                    try {
                        const fallbackDialog = await TradingDialog.create({});
                        errorHandler.notifyUser('info', 'Trading dialog opened with reduced functionality');
                        return fallbackDialog;
                    } catch (fallbackError) {
                        throw dialogError; // Original error if fallback fails
                    }
                }
            }
            throw dialogError;
        }

    } catch (error) {
        console.error('WFRP River Trading | Failed to open trading dialog:', error);

        if (!errorHandler) {
            ui.notifications.error(`Failed to open trading dialog: ${error.message}`);
        }

        throw error;
    }
}

/**
 * Get module setting with validation
 * @param {string} key - Setting key
 * @param {*} fallback - Fallback value if setting is invalid
 * @returns {*} - Setting value or fallback
 */
function getModuleSetting(key, fallback = null) {
    try {
        return game.settings.get(MODULE_ID, key);
    } catch (error) {
        console.warn(`WFRP River Trading | Failed to get setting '${key}':`, error);
        return fallback;
    }
}

/**
 * Set module setting with validation
 * @param {string} key - Setting key
 * @param {*} value - Setting value
 * @returns {Promise<boolean>} - Success status
 */
async function setModuleSetting(key, value) {
    try {
        await game.settings.set(MODULE_ID, key, value);
        return true;
    } catch (error) {
        console.error(`WFRP River Trading | Failed to set setting '${key}':`, error);
        return false;
    }
}

/**
 * Export module API for other modules/macros
 */
window.WFRPRiverTrading = {
    MODULE_ID,
    getDataManager: () => dataManager,
    getSystemAdapter: () => systemAdapter,
    getTradingEngine: () => tradingEngine,
    getConfigValidator: () => configValidator,
    getErrorHandler: () => errorHandler,
    getSetting: getModuleSetting,
    setSetting: setModuleSetting,
    openTradingDialog: openTradingDialog,
    TradingDialog: () => window.TradingDialog,
    validateConfiguration: () => configValidator?.performStartupValidation(),
    getErrorLog: (filters) => errorHandler?.getErrorLog(filters),
    getErrorSummary: (options) => errorHandler?.generateErrorSummary(options)
};

/**
 * Test function to verify debug logging system
 * Can be called from console: game.modules.get("trading-places").api.testLogging()
 */
function testDebugLogging() {
    if (!debugLogger) {
        console.error('Debug logger not initialized');
        return;
    }
    
    console.log('Testing WFRP Debug Logging System...');
    
    // Test basic logging
    debugLogger.logSystem('Test', 'Debug logging system test started');
    
    // Test dice roll logging
    debugLogger.logDiceRoll(
        'Test Availability Check',
        'd100',
        [{ name: 'Settlement Bonus', value: 10, reason: 'Large settlement' }],
        45,
        60,
        true,
        '45 ≤ 60'
    );
    
    // Test calculation logging
    debugLogger.logCalculation(
        'Test Price Calculation',
        'Base × Season × Wealth',
        {
            basePrice: 10,
            seasonMultiplier: 1.2,
            wealthMultiplier: 1.1
        },
        13.2,
        'Final price after all modifiers'
    );
    
    // Test decision logging
    debugLogger.logDecision(
        'Test Cargo Selection',
        'Grain',
        { settlementType: 'Agricultural', season: 'autumn' },
        ['Grain', 'Livestock', 'Trade Goods'],
        'Settlement specializes in grain production'
    );
    
    // Test algorithm step logging
    debugLogger.logAlgorithmStep(
        'WFRP Buying Algorithm',
        'Test Step',
        'Testing algorithm step logging',
        { testData: 'example' },
        'Death on the Reik Companion - Test Reference'
    );
    
    // Test user action logging
    debugLogger.logUserAction(
        'Open Trading Dialog',
        { settlement: 'Altdorf', season: 'spring' },
        { dialogOpened: true }
    );
    
    console.log('Debug logging test completed. Check console for formatted output.');
    
    // Generate diagnostic report
    const report = debugLogger.generateDiagnosticReport();
    console.log('Diagnostic Report:', report);
    
    return {
        success: true,
        loggerEnabled: debugLogger.isEnabled,
        historyCount: debugLogger.logHistory.length,
        report
    };
}

// Make test function available globally
if (typeof game !== 'undefined') {
    // Add to module API
    Hooks.once('ready', () => {
        const module = game.modules.get("trading-places");
        if (module) {
            module.api = module.api || {};
            module.api.testLogging = testDebugLogging;
            module.api.getLogger = () => debugLogger;
            module.api.getLogHistory = (category, limit) => debugLogger?.getLogHistory(category, limit);
        }
    });
}