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
        // Initialize error handler first
        errorHandler = new RuntimeErrorHandler(MODULE_ID);
        
        // Initialize configuration validator
        configValidator = new ConfigValidator();
        
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
        
        // Register UI elements
        registerUIElements();
        
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
    }

    // Add button to character sheet or token controls (if applicable)
    // This could be expanded based on system integration needs
    
    console.log('WFRP River Trading | UI elements registered');
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