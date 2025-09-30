/**
 * Trading Places Module
 * Main module initialization and hook registration
 */

// ES Module imports
import { TradingEngine } from './trading-engine.js';
import { DataManager } from './data-manager.js';
import { SystemAdapter } from './system-adapter.js';

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

    // Register scene controls hook EARLY during init
    console.log('Trading Places | Registering scene controls hook during init...');
    Hooks.on('getSceneControlButtons', (controls) => {
        console.log('Trading Places | *** EARLY getSceneControlButtons hook FIRED! ***');
        console.log('Trading Places | Controls parameter type:', typeof controls);
        console.log('Trading Places | Controls parameter:', controls);
        
        // The controls parameter should be an array for us to modify
        if (!controls || !Array.isArray(controls)) {
            console.log('Trading Places | Controls is not an array, cannot add trading controls');
            console.log('Trading Places | Expected array, got:', typeof controls, controls);
            return;
        }
        
        // Check if our control already exists
        const existingControl = controls.find(c => c.name === 'wfrp-trading');
        if (existingControl) {
            console.log('Trading Places | Trading control already exists, skipping');
            return;
        }
        
        const tradingControls = {
            name: 'wfrp-trading',
            title: 'Trading Places Places',
            icon: 'fas fa-coins',
            visible: true,
            layer: 'TokenLayer',
            tools: [{
                name: 'open-trading',
                title: 'Open Trading Interface',
                icon: 'fas fa-store',
                button: true,
                onClick: () => {
                    console.log('Trading Places | Scene controls button clicked!');
                    
                    // Try to open the enhanced trading interface
                    try {
                        // Check if EnhancedTradingDialog is available
                        if (window.WFRPTradingEnhancedDialog) {
                            // Get the current controlled actor
                            const controlledTokens = canvas.tokens.controlled;
                            let selectedActor = null;
                            
                            if (controlledTokens.length > 0) {
                                // Use the first controlled token's actor
                                selectedActor = controlledTokens[0].actor;
                            } else if (game.user.character) {
                                // Fallback to user's character
                                selectedActor = game.user.character;
                            }
                            
                            if (selectedActor) {
                                // Open enhanced trading dialog for the selected actor
                                const dialog = new window.WFRPTradingEnhancedDialog(selectedActor, null);
                                dialog.render(true);
                                console.log('Trading Places | Opened EnhancedTradingDialog');
                            } else {
                                ui.notifications.warn('Please select a token or assign a character to use the trading interface.');
                                console.log('Trading Places | No actor selected for trading');
                            }
                        } else if (window.WFRPTradingApplication) {
                            // Fallback to old application
                            const app = new window.WFRPTradingApplication();
                            app.render(true);
                            console.log('Trading Places | Opened WFRPTradingApplication (fallback)');
                        } else {
                            ui.notifications.info('Trading interface not yet available. Please wait for the module to finish loading.');
                            console.log('Trading Places | Trading applications not yet available');
                        }
                    } catch (error) {
                        console.error('Trading Places | Error opening trading interface:', error);
                        ui.notifications.error('Error opening trading interface. Check console for details.');
                    }
                }
            }]
        };
        
        controls.push(tradingControls);
        console.log('Trading Places | Trading controls added successfully');
        console.log('Trading Places | Controls array now has', controls.length, 'controls');
        console.log('Trading Places | All control names:', controls.map(c => c.name));
    });
    console.log('Trading Places | Scene controls hook registered during init');

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

        // Load trading configuration and source flags for Phase 3 features
        try {
            console.log('Trading Places | Loading trading configuration...');
            await dataManager.loadTradingConfig();
            console.log('Trading Places | Trading configuration loaded');
            
            console.log('Trading Places | Loading source flags...');
            await dataManager.loadSourceFlags();
            console.log('Trading Places | Source flags loaded');
            
            console.log('Trading Places | Initializing merchant system...');
            dataManager.initializeMerchantSystem();
            console.log('Trading Places | Merchant system initialized');
            
        } catch (error) {
            console.warn('Trading Places | Phase 3 initialization failed (continuing with basic functionality):', error);
            // Don't fail completely - allow basic functionality to work
        }
        
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

        // Scene controls will be initialized by the proper class-based approach below

        // Initialize native UI integration
        await initializeProperSceneControls();

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

    // Inequality helper
    Handlebars.registerHelper('ne', function(a, b) {
        return a !== b;
    });

    // Greater-than-or-equal helper
    Handlebars.registerHelper('gte', function(a, b) {
        if (typeof a === 'string') a = Number(a);
        if (typeof b === 'string') b = Number(b);
        return a >= b;
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

    // Join array helper
    Handlebars.registerHelper('join', function(array, separator) {
        if (!Array.isArray(array)) return '';
        return array.join(separator || ', ');
    });

    // Get size name helper
    Handlebars.registerHelper('getSizeName', function(size) {
        const sizeNames = {
            1: 'Hamlet',
            2: 'Village', 
            3: 'Town',
            4: 'City',
            5: 'Metropolis'
        };
        return sizeNames[size] || `Size ${size}`;
    });

    // Get wealth name helper
    Handlebars.registerHelper('getWealthName', function(wealth) {
        const wealthNames = {
            1: 'Squalid',
            2: 'Poor',
            3: 'Average',
            4: 'Prosperous',
            5: 'Wealthy'
        };
        return wealthNames[wealth] || `Wealth ${wealth}`;
    });

    // Get flag description helper
    Handlebars.registerHelper('getFlagDescription', function(flag) {
        const flagDescriptions = {
            'agriculture': 'Agricultural settlement with farming focus',
            'trade': 'Major trading hub with increased merchant activity',
            'government': 'Government center with official trade policies',
            'subsistence': 'Subsistence farming with limited trade',
            'smuggling': 'Smuggling operations with contraband goods',
            'fort': 'Fortified settlement with military presence',
            'boatbuilding': 'Shipbuilding and maritime trade focus'
        };
        return flagDescriptions[flag] || `${flag} settlement`;
    });

    // Get equilibrium state label helper
    Handlebars.registerHelper('getEquilibriumStateLabel', function(state) {
        const stateLabels = {
            'balanced': 'Balanced',
            'oversupplied': 'Oversupplied',
            'undersupplied': 'Undersupplied',
            'desperate': 'Desperate',
            'blocked': 'Blocked'
        };
        return stateLabels[state] || state;
    });

    // Format time helper
    Handlebars.registerHelper('formatTime', function(date) {
        if (!date) return '';
        const d = new Date(date);
        return d.toLocaleTimeString();
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

    // Selected region setting (for persistence)
    game.settings.register(MODULE_ID, "selectedRegion", {
        name: "Selected Region",
        hint: "Stores the last selected region in the trading interface",
        scope: "client",
        config: false,
        type: String,
        default: ""
    });

    // Selected settlement setting (for persistence)
    game.settings.register(MODULE_ID, "selectedSettlement", {
        name: "Selected Settlement",
        hint: "Stores the last selected settlement in the trading interface",
        scope: "client",
        config: false,
        type: String,
        default: ""
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
            console.error('Trading Places | Validation errors:', validationResult.errors);
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
        dataManager = new DataManager();
        dataManager.setModuleId(MODULE_ID);
        console.log('Trading Places | DataManager initialized');

        // Initialize SystemAdapter
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

        // Initialize TradingEngine
        if (dataManager) {
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
        } else {
            throw new Error('DataManager required for TradingEngine initialization');
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
 * Initialize proper scene controls integration ONLY
 */
async function initializeProperSceneControls() {
    console.log('Trading Places | Initializing proper scene controls integration');

    try {
        // Initialize proper scene controls integration if available
        if (typeof WFRPProperSceneControls !== 'undefined') {
            const sceneControls = new WFRPProperSceneControls(debugLogger);
            await sceneControls.initialize();
            console.log('Trading Places | Proper scene controls initialized successfully');
        } else {
            console.warn('Trading Places | WFRPProperSceneControls class not available, using basic fallback');
            await initializeBasicSceneControls();
        }
    } catch (error) {
        console.error('Trading Places | Scene controls integration failed:', error);
        ui.notifications.warn('Trading scene controls integration failed.');
    }
}

/**
 * Basic scene controls fallback when WFRPProperSceneControls class is not available
 */
async function initializeBasicSceneControls() {
    console.log('Trading Places | Initializing basic scene controls fallback');
    
    try {
        // Register the scene controls hook directly since the class approach isn't working
        console.log('Trading Places | Registering scene controls hook directly as fallback');
        
        Hooks.on('getSceneControlButtons', (controls) => {
            console.log('Trading Places | getSceneControlButtons hook fired - adding trading controls');
            
            // Check if our control already exists to prevent duplicates
            const existingControl = controls.find(c => c.name === 'wfrp-trading');
            if (existingControl) {
                console.log('Trading Places | Trading control already exists, skipping duplicate');
                return;
            }
            
            const tradingControls = {
                name: 'wfrp-trading',
                title: 'Trading Places Places',
                icon: 'fas fa-coins',
                visible: true,
                layer: 'TokenLayer',
                tools: [{
                    name: 'open-trading',
                    title: 'Open Trading Interface',
                    icon: 'fas fa-store',
                    button: true,
                    onClick: () => {
                        console.log('Trading Places | Trading button clicked!');
                        
                        // Try to open the trading interface
                        try {
                            if (window.WFRPTradingEnhancedDialog) {
                                // Get the current controlled actor
                                const controlledTokens = canvas.tokens.controlled;
                                let selectedActor = null;
                                
                                if (controlledTokens.length > 0) {
                                    selectedActor = controlledTokens[0].actor;
                                } else if (game.user.character) {
                                    selectedActor = game.user.character;
                                }
                                
                                if (selectedActor) {
                                    const dialog = new window.WFRPTradingEnhancedDialog(selectedActor, null);
                                    dialog.render(true);
                                    console.log('Trading Places | Opened EnhancedTradingDialog');
                                } else {
                                    ui.notifications.warn('Please select a token or assign a character to use the trading interface.');
                                    console.log('Trading Places | No actor selected for trading');
                                }
                            } else if (window.WFRPTradingApplication) {
                                const app = new window.WFRPTradingApplication();
                                app.render(true);
                                console.log('Trading Places | Opened WFRPTradingApplication (fallback)');
                            } else if (window.WFRPSimpleTradingV2) {
                                window.WFRPSimpleTradingV2.openDialog();
                                console.log('Trading Places | Opened WFRPSimpleTradingV2');
                            } else {
                                ui.notifications.info('Trading interface clicked! (Interface classes not yet available)');
                            }
                        } catch (error) {
                            console.error('Trading Places | Error opening trading interface:', error);
                            ui.notifications.error('Error opening trading interface. Check console for details.');
                        }
                    }
                }]
            };
            
            controls.push(tradingControls);
            console.log('Trading Places | Trading controls added successfully to scene controls');
        });
        
        console.log('Trading Places | Basic scene controls fallback complete - hook registered');
        
    } catch (error) {
        console.error('Trading Places | Basic scene controls integration failed:', error);
        ui.notifications.warn('Trading scene controls integration failed.');
    }
}

/**
 * Open the trading interface
 */
function openTradingInterface() {
    try {
        if (typeof window.WFRPTradingEnhancedDialog !== 'undefined') {
            // Get the current controlled actor
            const controlledTokens = canvas.tokens.controlled;
            let selectedActor = null;
            
            if (controlledTokens.length > 0) {
                selectedActor = controlledTokens[0].actor;
            } else if (game.user.character) {
                selectedActor = game.user.character;
            }
            
            if (selectedActor) {
                const dialog = new window.WFRPTradingEnhancedDialog(selectedActor, null);
                dialog.render(true);
            } else {
                ui.notifications.warn('Please select a token or assign a character to use the trading interface.');
            }
        } else if (typeof WFRPTradingApplication !== 'undefined') {
            const app = new WFRPTradingApplication();
            app.render(true);
        } else if (typeof WFRPSimpleTradingApplication !== 'undefined') {
            WFRPSimpleTradingApplication.create();
        } else {
            ui.notifications.error('Trading interface not available.');
        }
    } catch (error) {
        console.error('Trading Places | Error opening trading interface:', error);
        ui.notifications.error('Error opening trading interface. Check console for details.');
    }
}

/**
 * Export clean module API
 */
window.WFRPRiverTrading = {
    getDataManager: () => dataManager,
    getTradingEngine: () => tradingEngine,
    getSystemAdapter: () => systemAdapter,
    getDebugLogger: () => debugLogger,
    
    // Simple utility function
    openTradingDialog: () => openTradingInterface()
};

// Also assign to the module object for direct access
if (typeof game !== 'undefined' && game.modules) {
    const module = game.modules.get('trading-places');
    if (module) {
        module.dataManager = dataManager;
        module.tradingEngine = tradingEngine;
        module.systemAdapter = systemAdapter;
        module.debugLogger = debugLogger;
    }
}