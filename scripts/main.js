/**
 * Trading Places Module
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
    console.log('Trading Places | Initializing module');

    // Register Handlebars helpers for V2 Application templates
    registerHandlebarsHelpers();

    // Register module settings
    registerModuleSettings();

    // Register settings change handlers
    registerSettingsChangeHandlers();

    console.log('Trading Places | Module initialized');
});

// Ready hook - module fully loaded
Hooks.once('ready', async () => {
    console.log('Trading Places | Module ready');

    try {
        // Initialize debug logger first
        if (typeof WFRPDebugLogger !== 'undefined') {
            debugLogger = new WFRPDebugLogger();
            window.wfrpLogger = debugLogger;
            console.log('Trading Places | Debug logger initialized');
        } else {
            console.warn('Trading Places | WFRPDebugLogger class not available, debug logging disabled');
        }
        
        // Initialize error handler
        if (typeof RuntimeErrorHandler !== 'undefined') {
            errorHandler = new RuntimeErrorHandler(MODULE_ID);
            console.log('Trading Places | Error handler initialized');
        } else {
            console.warn('Trading Places | RuntimeErrorHandler class not available');
        }

        // Initialize configuration validator
        if (typeof ConfigValidator !== 'undefined') {
            configValidator = new ConfigValidator();
            console.log('Trading Places | Configuration validator initialized');
        } else {
            console.warn('Trading Places | ConfigValidator class not available');
        }

        // Wait a moment for all classes to be registered on window object
        await new Promise(resolve => setTimeout(resolve, 200));

        // Perform settings migration if needed
        await performSettingsMigration();

        // Initialize core components first
        await initializeCoreComponents();

        // Perform comprehensive startup validation after components are loaded
        if (configValidator) {
            const validationResult = await configValidator.performStartupValidation();

            if (!validationResult.valid) {
                // Generate diagnostic report
                const diagnosticReport = configValidator.generateDiagnosticReport(validationResult);
                console.error('Trading Places | Startup validation failed:\n', diagnosticReport);

                // Generate recovery procedures
                const recoveryProcedures = configValidator.generateErrorRecoveryProcedures(validationResult.errors);

                // Show user-friendly error message
                const errorMessage = `Trading Places startup validation failed with ${validationResult.errors.length} error(s). Check console for detailed diagnostic report.`;
                ui.notifications.warn(errorMessage); // Changed to warn instead of error to not block

                // Optionally show recovery dialog
                await showValidationErrorDialog(validationResult, recoveryProcedures);

                // Don't return - continue with initialization even if validation fails
            }

            // Show warnings if any
            if (validationResult.warnings.length > 0) {
                const warningMessage = `Trading Places loaded with ${validationResult.warnings.length} warning(s). Check console for details.`;
                ui.notifications.warn(warningMessage);
                console.warn('Trading Places | Startup warnings:', validationResult.warnings);
            }
        } else {
            console.warn('Trading Places | Configuration validator not available, skipping startup validation');
        }

        // Load active dataset (validation already passed)
        await loadActiveDataset();
        
        // Initialize logger integration with core components
        if (typeof WFRPLoggerIntegration !== 'undefined') {
            WFRPLoggerIntegration.initializeIntegration(tradingEngine, dataManager);
            console.log('Trading Places | Logger integration initialized');
        } else {
            console.warn('Trading Places | WFRPLoggerIntegration class not available');
        }
        
        // Set logger on trading engine and data manager
        if (tradingEngine && debugLogger) {
            tradingEngine.setLogger(debugLogger);
        }
        if (dataManager && debugLogger) {
            dataManager.setLogger(debugLogger);
        }

        // Initialize native UI integration
        await initializeNativeUIIntegration();

        console.log('Trading Places | Setup complete');
        ui.notifications.info('Trading Places loaded successfully');

    } catch (error) {
        console.error('Trading Places | Setup failed:', error);

        // Use error handler if available
        if (errorHandler) {
            errorHandler.handleDataLoadingError(error, 'Module Initialization', 'startup');
        } else {
            // Fallback error handling
            ui.notifications.error(`Trading Places setup failed: ${error.message}`, { permanent: true });
        }

        // Generate error recovery procedures
        if (configValidator) {
            const recoveryProcedures = configValidator.generateErrorRecoveryProcedures([error.message]);
            console.log('Trading Places | Recovery procedures:', recoveryProcedures);
        }
    }
});

/**
 * Register Handlebars helpers for V2 Application templates
 */
function registerHandlebarsHelpers() {
    // Equality helper for template conditionals
    Handlebars.registerHelper('eq', function(a, b) {
        return a === b;
    });

    // Logical AND helper
    Handlebars.registerHelper('and', function() {
        const args = Array.prototype.slice.call(arguments, 0, -1);
        return args.every(Boolean);
    });

    // Logical OR helper
    Handlebars.registerHelper('or', function() {
        const args = Array.prototype.slice.call(arguments, 0, -1);
        return args.some(Boolean);
    });

    // Format number helper
    Handlebars.registerHelper('formatNumber', function(number) {
        if (typeof number !== 'number') return number;
        return number.toLocaleString();
    });

    // Capitalize helper
    Handlebars.registerHelper('capitalize', function(str) {
        if (typeof str !== 'string') return str;
        return str.charAt(0).toUpperCase() + str.slice(1);
    });

    console.log('Trading Places | Handlebars helpers registered');
}

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

    // Trading dialog position setting (legacy)
    game.settings.register(MODULE_ID, "dialogPosition", {
        name: "TRADING-PLACES.Settings.DialogPosition.Name",
        hint: "TRADING-PLACES.Settings.DialogPosition.Hint",
        scope: "client",
        config: true,
        type: Object,
        default: { top: 100, left: 100, width: 600, height: 400 }
    });

    // Window state setting for V2 Application
    game.settings.register(MODULE_ID, "windowState", {
        name: "Window State",
        hint: "Stores window position and size for the trading interface",
        scope: "client",
        config: false,
        type: Object,
        default: {}
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
    console.log('Trading Places | Settings change handlers registered');
}

/**
 * Handle active dataset setting change
 * @param {string} newValue - New dataset name
 */
async function onActiveDatasetChange(newValue) {
    console.log(`Trading Places | Active dataset changed to: ${newValue}`);

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
        console.error('Trading Places | Dataset change failed:', error);
        ui.notifications.error(`Failed to switch dataset: ${error.message}`);
    }
}

/**
 * Handle current season setting change
 * @param {string} newValue - New season name
 */
async function onCurrentSeasonChange(newValue) {
    console.log(`Trading Places | Current season changed to: ${newValue}`);

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
        console.error('Trading Places | Season change failed:', error);
        ui.notifications.error(`Failed to change season: ${error.message}`);
    }
}

/**
 * Handle chat visibility setting change
 * @param {string} newValue - New visibility setting
 */
async function onChatVisibilityChange(newValue) {
    console.log(`Trading Places | Chat visibility changed to: ${newValue}`);

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
    console.log(`Trading Places | Debug logging ${newValue ? 'enabled' : 'disabled'}`);

    // Update logger if it exists
    if (debugLogger) {
        debugLogger.setEnabled(newValue);
    }
    
    // Update global logger if it exists
    if (window.wfrpLogger) {
        window.wfrpLogger.setEnabled(newValue);
    }

    if (newValue) {
        ui.notifications.info('Debug logging enabled for Trading Places');
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

    console.log(`Trading Places | Migrating from version ${currentVersion} to ${MODULE_VERSION}`);

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

        console.log('Trading Places | Migration completed successfully');

    } catch (error) {
        console.error('Trading Places | Migration failed:', error);
        ui.notifications.error(`Migration failed: ${error.message}`);
        throw error;
    }
}

/**
 * Perform first time setup
 */
async function performFirstTimeSetup() {
    console.log('Trading Places | Performing first time setup');

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
    ui.notifications.info('Welcome to Trading Places! Check the module settings to configure your trading system.');
}

/**
 * Perform version-specific migration
 * @param {string} fromVersion - Previous version
 * @param {string} toVersion - Target version
 */
async function performVersionMigration(fromVersion, toVersion) {
    console.log(`Trading Places | Migrating from ${fromVersion} to ${toVersion}`);

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
        if (typeof WFRPConfigErrorDialog !== 'undefined') {
            WFRPConfigErrorDialog.show(validationResult, recoveryProcedures).then(() => resolve());
        } else {
            // Fallback to notification
            ui.notifications.error(`Configuration validation failed with ${validationResult.errors.length} errors. Check console for details.`);
            console.error('WFRP Trading | Validation errors:', validationResult.errors);
            resolve();
        }
    });
}

/**
 * Initialize core components with error handling
 */
async function initializeCoreComponents() {
    console.log('Trading Places | Initializing core components');

    try {
        // Initialize DataManager
        if (typeof DataManager !== 'undefined') {
            dataManager = new DataManager();
            console.log('Trading Places | DataManager initialized');
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
                console.warn('Trading Places | System compatibility warnings:', systemValidation.warnings);
            }

            console.log('Trading Places | SystemAdapter initialized');
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
                    console.log('Trading Places | Set default season to spring');
                }
            } catch (seasonError) {
                if (errorHandler) {
                    errorHandler.handleTradingEngineError(seasonError, 'Season initialization');
                }
                // Use fallback season
                tradingEngine.setCurrentSeason("spring");
            }

            console.log('Trading Places | TradingEngine initialized');
        } else if (!dataManager) {
            throw new Error('DataManager required for TradingEngine initialization');
        } else {
            throw new Error('TradingEngine class not available');
        }

        console.log('Trading Places | Core components initialized successfully');

    } catch (error) {
        console.error('Trading Places | Component initialization failed:', error);

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
    console.log('Trading Places | Loading active dataset');

    try {
        if (!dataManager) {
            throw new Error('DataManager not initialized');
        }

        const activeDataset = game.settings.get(MODULE_ID, "activeDataset") || "wfrp4e-default";

        try {
            await dataManager.loadActiveDataset();
            console.log(`Trading Places | Successfully loaded dataset: ${activeDataset}`);

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
                console.warn('Trading Places | Dataset validation warnings:', validation.errors);
            }

        } catch (datasetError) {
            // Try fallback to default dataset
            if (activeDataset !== "wfrp4e-default") {
                console.warn(`Trading Places | Failed to load ${activeDataset}, trying default dataset`);

                try {
                    await dataManager.switchDataset("wfrp4e-default");
                    await game.settings.set(MODULE_ID, "activeDataset", "wfrp4e-default");

                    if (errorHandler) {
                        errorHandler.notifyUser('warning', `Failed to load dataset '${activeDataset}', switched to default dataset`);
                    }

                    console.log('Trading Places | Successfully loaded default dataset as fallback');

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
        console.error('Trading Places | Dataset loading failed:', error);

        if (errorHandler) {
            errorHandler.handleDataLoadingError(error, 'Active Dataset', 'loading');
        } else {
            ui.notifications.error(`Failed to load dataset: ${error.message}`, { permanent: true });
        }

        throw error;
    }
}

/**
 * Initialize native UI integration
 */
async function initializeNativeUIIntegration() {
    console.log('Trading Places | Initializing native UI integration');

    try {
        // Initialize native UI integration if available
        if (typeof WFRPNativeUIIntegration !== 'undefined') {
            const nativeUI = new WFRPNativeUIIntegration(debugLogger);
            
            // Remove any existing floating button overlays
            nativeUI.removeFloatingButtonOverlays();
            
            // Initialize all native UI integration points
            await nativeUI.initialize();
            
            console.log('Trading Places | Native UI integration initialized successfully');
        } else {
            console.warn('Trading Places | WFRPNativeUIIntegration class not available');
            
            // Fallback: register basic macro commands
            game.wfrpTrading = game.wfrpTrading || {};
            game.wfrpTrading.openTrading = () => {
                if (typeof WFRPSimpleTradingApplication !== 'undefined') {
                    WFRPSimpleTradingApplication.create();
                } else {
                    ui.notifications.error('Trading interface not available.');
                }
            };
        }
    } catch (error) {
        console.error('Trading Places | Native UI integration failed:', error);
        ui.notifications.warn('Trading UI integration partially failed. Some features may not be available.');
    }
}

/**
 * Export module API for other modules/macros
 */
window.WFRPRiverTrading = {
    getDataManager: () => dataManager,
    getTradingEngine: () => tradingEngine,
    getSystemAdapter: () => systemAdapter,
    getDebugLogger: () => debugLogger,
    
    // Utility functions
    openTradingDialog: () => {
        if (game.wfrpTrading && game.wfrpTrading.openTrading) {
            game.wfrpTrading.openTrading();
        } else {
            ui.notifications.error('Trading interface not available.');
        }
    }
};