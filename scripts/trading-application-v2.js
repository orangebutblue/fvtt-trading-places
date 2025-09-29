console.log('Trading Places | Loading trading-application-v2.js');

/**
 * Trading Places Module - V2 Application Framework
 * Modern FoundryVTT ApplicationV2 implementation replacing deprecated Dialog class
 */

// Settlement selector will be available via window.SettlementSelector

/**
 * Main Trading Application using FoundryVTT V2 Application framework
 * Replaces the deprecated Dialog-based implementation
 */

// Check if ApplicationV2 is available before defining the class
if (typeof foundry?.applications?.api?.ApplicationV2 === 'undefined') {
    console.warn('Trading Places | ApplicationV2 not available, WFRPTradingApplication will not be loaded');
    // Don't define the class if ApplicationV2 isn't available
} else {
    console.log('Trading Places | ApplicationV2 available, defining WFRPTradingApplication');
    
class WFRPTradingApplication extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2) {

    /** @override */
    static DEFAULT_OPTIONS = {
        id: "wfrp-trading",
        tag: "div",
        window: {
            title: "Trading Places",
            icon: "fas fa-coins",
            resizable: true,
            minimizable: true,
            maximizable: true
        },
        position: {
            width: 1200,
            height: 800,
            top: 50,
            left: 50
        },
        classes: ["wfrp-trading", "application-v2", "modern-trading"]
    };

    /** @override */
    static PARTS = {
        content: {
            template: "modules/trading-places/templates/trading-unified.hbs"
        }
    };

    /**
     * Constructor for WFRPTradingApplication
     * @param {Object} options - Application options
     */
    constructor(options = {}) {
        super(options);

        // Initialize application state
        this.currentSeason = null;
        this.selectedRegion = null;
        this.selectedSettlement = null;
        this.selectedCargo = null;
        this.selectedResource = null;
        this.availableCargo = [];
        this.transactionHistory = [];
        this.playerCargo = [];

        // Get module components with validation
        this.dataManager = window.WFRPRiverTrading?.getDataManager();
        this.tradingEngine = window.WFRPRiverTrading?.getTradingEngine();
        this.systemAdapter = window.WFRPRiverTrading?.getSystemAdapter();
        this.debugLogger = window.wfrpLogger;

        // Validate components are available
        if (!this.dataManager || !this.tradingEngine) {
            const error = 'Trading components not initialized. Please ensure the module is properly loaded.';
            this._logError('Component Validation', error);

            // Show user-friendly error message
            if (typeof ui !== 'undefined' && ui.notifications) {
                ui.notifications.error('Trading system not ready. Please wait for the module to finish loading.');
            }

            throw new Error(error);
        }

        // Initialize debug logging integration
        this._initializeDebugLogging();

        // Initialize settlement selector component if available
        if (typeof window.SettlementSelector !== 'undefined') {
            this.settlementSelector = new window.SettlementSelector(this.dataManager, this.debugLogger);
        } else {
            console.warn('Trading Places | SettlementSelector not available, some features may be limited');
            this.settlementSelector = null;
        }

        this._logInfo('Application Initialization', 'WFRPTradingApplication created successfully');

        // Initialize window management
        this._initializeWindowManagement();
    }

    /**
     * Initialize window management features
     * @private
     */
    _initializeWindowManagement() {
        this._logDebug('Window Management', 'Initializing window management features');

        // Load saved window position and size
        this._loadWindowState();

        // Set up window state persistence
        this._setupWindowStatePersistence();

        this._logInfo('Window Management', 'Window management initialized successfully');
    }

    /**
     * Load saved window position and size from settings
     * @private
     */
    async _loadWindowState() {
        try {
            const savedState = await game.settings.get("trading-places", "windowState");

            if (savedState && typeof savedState === 'object') {
                this._logDebug('Window Management', 'Loading saved window state', savedState);

                // Apply saved dimensions if valid
                if (savedState.width && savedState.height) {
                    // Ensure landscape orientation (width > height)
                    const width = Math.max(savedState.width, 800); // Minimum width
                    const height = Math.max(savedState.height, 600); // Minimum height

                    // Enforce landscape orientation
                    if (width <= height) {
                        this._logDebug('Window Management', 'Adjusting dimensions to maintain landscape orientation');
                        // Make width at least 1.5x height for landscape
                        const adjustedWidth = Math.max(width, Math.floor(height * 1.5));
                        this.options.position = {
                            ...this.options.position,
                            width: adjustedWidth,
                            height: height
                        };
                    } else {
                        this.options.position = {
                            ...this.options.position,
                            width: width,
                            height: height
                        };
                    }
                }

                // Apply saved position if valid (ensure it's on screen)
                if (savedState.top !== undefined && savedState.left !== undefined) {
                    const screenWidth = window.innerWidth;
                    const screenHeight = window.innerHeight;

                    // Ensure window is visible on screen
                    const left = Math.max(0, Math.min(savedState.left, screenWidth - 400));
                    const top = Math.max(0, Math.min(savedState.top, screenHeight - 200));

                    this.options.position = {
                        ...this.options.position,
                        left: left,
                        top: top
                    };
                }

                this._logInfo('Window Management', 'Window state loaded successfully', {
                    width: this.options.position.width,
                    height: this.options.position.height,
                    left: this.options.position.left,
                    top: this.options.position.top
                });
            } else {
                this._logDebug('Window Management', 'No saved window state found, using defaults');
            }
        } catch (error) {
            this._logError('Window Management', 'Failed to load window state', { error: error.message });
        }
    }

    /**
     * Set up window state persistence listeners
     * @private
     */
    _setupWindowStatePersistence() {
        // We'll set up the actual listeners after render when the window element exists
        this._windowStatePersistenceEnabled = true;
        this._logDebug('Window Management', 'Window state persistence enabled');
    }

    /**
     * Save current window state to settings
     * @private
     */
    async _saveWindowState() {
        if (!this._windowStatePersistenceEnabled || !this.element) {
            return;
        }

        try {
            const windowElement = this.element.closest('.app');
            if (!windowElement) {
                this._logDebug('Window Management', 'Window element not found, cannot save state');
                return;
            }

            const rect = windowElement.getBoundingClientRect();
            const windowState = {
                width: rect.width,
                height: rect.height,
                left: rect.left,
                top: rect.top,
                timestamp: Date.now()
            };

            await game.settings.set("trading-places", "windowState", windowState);

            this._logDebug('Window Management', 'Window state saved', windowState);

        } catch (error) {
            this._logError('Window Management', 'Failed to save window state', { error: error.message });
        }
    }

    /**
     * Handle window resize events
     * @param {Event} event - Resize event
     * @private
     */
    _onWindowResize(event) {
        this._logDebug('Window Management', 'Window resize detected');

        // Debounce the save operation
        if (this._resizeTimeout) {
            clearTimeout(this._resizeTimeout);
        }

        this._resizeTimeout = setTimeout(() => {
            this._saveWindowState();
        }, 500); // Save after 500ms of no resize activity
    }

    /**
     * Handle window move events
     * @param {Event} event - Move event
     * @private
     */
    _onWindowMove(event) {
        this._logDebug('Window Management', 'Window move detected');

        // Debounce the save operation
        if (this._moveTimeout) {
            clearTimeout(this._moveTimeout);
        }

        this._moveTimeout = setTimeout(() => {
            this._saveWindowState();
        }, 500); // Save after 500ms of no move activity
    }

    /**
     * Validate and enforce landscape orientation
     * @param {number} width - Proposed width
     * @param {number} height - Proposed height
     * @returns {Object} - Validated dimensions
     * @private
     */
    _validateLandscapeOrientation(width, height) {
        const minWidth = 800;
        const minHeight = 600;
        const maxWidth = window.innerWidth * 0.9;
        const maxHeight = window.innerHeight * 0.9;

        // Ensure minimum dimensions
        width = Math.max(width, minWidth);
        height = Math.max(height, minHeight);

        // Ensure maximum dimensions
        width = Math.min(width, maxWidth);
        height = Math.min(height, maxHeight);

        // Enforce landscape orientation (width should be at least 1.2x height)
        const minLandscapeRatio = 1.2;
        if (width / height < minLandscapeRatio) {
            // Adjust width to maintain landscape ratio
            width = Math.floor(height * minLandscapeRatio);

            // If adjusted width exceeds screen, adjust height instead
            if (width > maxWidth) {
                width = maxWidth;
                height = Math.floor(width / minLandscapeRatio);
            }
        }

        this._logDebug('Window Management', 'Validated landscape orientation', {
            originalWidth: arguments[0],
            originalHeight: arguments[1],
            validatedWidth: width,
            validatedHeight: height,
            ratio: (width / height).toFixed(2)
        });

        return { width, height };
    }

    /**
     * Static factory method to create and render trading application
     * @param {Object} options - Application options
     * @returns {WFRPTradingApplication} - Created application instance
     */
    static async create(options = {}) {
        const app = new WFRPTradingApplication(options);
        await app.render(true);
        return app;
    }

    /**
     * Initialize debug logging integration
     * @private
     */
    _initializeDebugLogging() {
        if (this.debugLogger) {
            this._logInfo('Debug Logging', 'Debug logging integration initialized');
        } else {
            console.warn('Trading Places | Debug logger not available');
        }
    }

    /**
     * Log info message with consistent format
     * @param {string} category - Log category
     * @param {string} message - Log message
     * @param {Object} data - Additional data
     * @private
     */
    _logInfo(category, message, data = {}) {
        if (this.debugLogger && this.debugLogger.log) {
            this.debugLogger.log('INFO', category, message, data, 'INFO');
        } else {
            console.log(`Trading Places | ${category}: ${message}`, data);
        }
    }

    /**
     * Log error message with consistent format
     * @param {string} category - Log category
     * @param {string} message - Log message
     * @param {Object} data - Additional data
     * @private
     */
    _logError(category, message, data = {}) {
        if (this.debugLogger && this.debugLogger.log) {
            this.debugLogger.log('ERROR', category, message, data, 'ERROR');
        } else {
            console.error(`Trading Places | ${category}: ${message}`, data);
        }
    }

    /**
     * Log debug message with consistent format
     * @param {string} category - Log category
     * @param {string} message - Log message
     * @param {Object} data - Additional data
     * @private
     */
    _logDebug(category, message, data = {}) {
        if (this.debugLogger && this.debugLogger.log) {
            this.debugLogger.log('DEBUG', category, message, data, 'DEBUG');
        } else {
            console.debug(`Trading Places | ${category}: ${message}`, data);
        }
    }

    // =============================================================================
    // ENHANCED VALIDATION AND USER FEEDBACK SYSTEM
    // =============================================================================

    /**
     * Show validation error with detailed user feedback using FoundryVTT notifications
     * @param {Object} validationResult - Result from validateSettlement function
     * @param {string} context - Context where validation failed (e.g., 'buying', 'selling')
     */
    showValidationError(validationResult, context = 'trading') {
        this._logDebug('Validation Feedback', 'Showing validation error', { 
            context, 
            errorType: validationResult.errorType,
            errorCount: validationResult.errors?.length || 0
        });
        
        if (validationResult.valid) {
            this._logDebug('Validation Feedback', 'No validation errors to show');
            return;
        }
        
        // Create user-friendly error message with warning symbols
        let errorText = '';
        let notificationType = 'error';
        
        if (validationResult.errorType === 'missing_settlement') {
            errorText = '⚠️ No settlement selected. Please select a settlement first.';
            notificationType = 'warn';
        } else if (validationResult.errorType === 'validation_failed') {
            if (validationResult.errors.length === 1) {
                errorText = `⚠️ Settlement data invalid: ${validationResult.errors[0]}`;
            } else {
                errorText = `⚠️ Settlement data has ${validationResult.errors.length} validation errors. Check data validity.`;
            }
        } else {
            errorText = `⚠️ ${validationResult.error || 'Unknown validation error'}`;
        }
        
        // Show FoundryVTT notification
        if (ui.notifications) {
            ui.notifications[notificationType](errorText, { permanent: false });
        }
        
        // Log detailed errors for debugging
        if (validationResult.errors && validationResult.errors.length > 1) {
            this._logError('Validation Details', 'Multiple validation errors found', {
                errors: validationResult.errors,
                settlement: validationResult.settlement?.name || 'Unknown'
            });
        }
        
        this._logInfo('Validation Feedback', 'Validation error displayed to user', { 
            context, 
            message: errorText 
        });
    }

    /**
     * Validate settlement and show user feedback if validation fails
     * @param {Object} settlement - Settlement data to validate
     * @param {string} context - Context for error display (e.g., 'buying', 'selling')
     * @returns {Object} Validation result
     */
    validateSettlementWithFeedback(settlement, context = 'trading') {
        this._logDebug('Validation Feedback', 'Validating settlement with user feedback', { 
            context,
            settlementName: settlement?.name || 'None'
        });
        
        // Run comprehensive validation using enhanced data manager function
        const validation = this.dataManager.validateSettlement(settlement);
        
        // Show user feedback if validation failed
        if (!validation.valid) {
            this.showValidationError(validation, context);
            this._logError('Settlement Validation', 'Settlement validation failed', {
                context,
                settlement: settlement?.name || 'None',
                errors: validation.errors
            });
        } else {
            this._logDebug('Settlement Validation', 'Settlement validation passed', {
                context,
                settlement: settlement.name
            });
        }
        
        return validation;
    }

    /**
     * Clear any existing validation error notifications
     * @param {string} context - Context to clear errors for
     */
    clearValidationErrors(context = 'trading') {
        this._logDebug('Validation Feedback', 'Clearing validation errors', { context });
        // FoundryVTT notifications auto-dismiss, but we can log the clear action
        // In a future enhancement, we could track notification IDs to dismiss them manually
    }

    /** @override */
    async _prepareContext(options) {
        const context = await super._prepareContext(options);

        this._logDebug('Template Context', 'Preparing template context data');

        // Add trading-specific data for templates
        context.currentSeason = this.getCurrentSeason();
        context.selectedSettlement = this.selectedSettlement;
        context.selectedRegion = this.selectedRegion || '';
        context.availableCargo = this.availableCargo;
        context.transactionHistory = this.transactionHistory;
        context.playerCargo = this.playerCargo;
        
        // Get all settlements and filter by region if one is selected
        const allSettlements = this.dataManager?.getAllSettlements() || [];
        context.settlements = this.selectedRegion 
            ? allSettlements.filter(s => s.region === this.selectedRegion)
            : [];
        context.allSettlements = allSettlements;

        // Add UI state data
        context.hasSettlement = !!this.selectedSettlement;
        context.hasCargo = this.availableCargo.length > 0;
        context.hasSeason = !!this.currentSeason;
        context.hasPlayerCargo = this.playerCargo.length > 0;

        // Add helper functions for template
        context.getSizeDescription = (sizeCode) => {
            if (!this.dataManager) return sizeCode;
            try {
                return this.dataManager.getSizeDescription(sizeCode);
            } catch (error) {
                return sizeCode;
            }
        };

        context.getSizeRating = (sizeCode) => {
            if (!this.dataManager) return '?';
            try {
                return this.dataManager.convertSizeToNumeric(sizeCode);
            } catch (error) {
                return '?';
            }
        };

        context.getWealthDescription = (wealthRating) => {
            if (!this.dataManager) return wealthRating;
            try {
                return this.dataManager.getWealthDescription(wealthRating);
            } catch (error) {
                return wealthRating;
            }
        };

        context.isTradeSettlement = (settlement) => {
            if (!this.dataManager || !settlement) return false;
            try {
                return this.dataManager.isTradeSettlement(settlement);
            } catch (error) {
                return false;
            }
        };

        context.formatNumber = (number) => {
            if (typeof number !== 'number') return number;
            return number.toLocaleString();
        };

        // Add configuration data
        context.debugLoggingEnabled = game.settings.get("trading-places", "debugLogging");
        context.chatVisibility = game.settings.get("trading-places", "chatVisibility");

        // Add ALL cargo types for selling (not just settlement sources)
        context.allCargoTypes = this.dataManager?.cargoTypes || [];
        // Filter out "Trade" as it's not a sellable resource
        context.sellableCargoTypes = context.allCargoTypes.filter(cargo => cargo.name !== 'Trade');

        this._logDebug('Template Context', 'Context prepared successfully', {
            settlements: context.settlements.length,
            availableCargo: context.availableCargo.length,
            transactionHistory: context.transactionHistory.length,
            currentSeason: context.currentSeason,
            sellableCargoTypes: context.sellableCargoTypes.length
        });

        return context;
    }

    /** @override */
    _onRender(context, options) {
        super._onRender(context, options);

        this._logInfo('Application Lifecycle', 'Application rendered successfully');

        // Debug: Log the actual HTML structure
        console.log('WFRP Trading | Application element:', this.element);
        console.log('WFRP Trading | Application classes:', this.element?.className);
        console.log('WFRP Trading | Parent element:', this.element?.parentElement);
        console.log('WFRP Trading | Window element:', this.element?.closest('.app'));
        
        // Force background styles for debugging
        if (this.element) {
            this.element.style.backgroundColor = '#2c2c2c';
            this.element.style.border = '2px solid #333';
            console.log('WFRP Trading | Forced styles applied to element');
            
            const windowElement = this.element.closest('.app');
            if (windowElement) {
                windowElement.style.backgroundColor = '#2c2c2c';
                windowElement.style.border = '2px solid #333';
                console.log('WFRP Trading | Forced styles applied to window element');
            }
        }

        // Set up window management listeners
        this._setupWindowEventListeners();

        // Initialize settlement selector component
        this._initializeSettlementSelector();

        // Initialize application state after render
        this._initializeApplicationState();
    }

    /**
     * Set up window event listeners for position and size tracking
     * @private
     */
    _setupWindowEventListeners() {
        if (!this.element) {
            this._logError('Window Management', 'Cannot set up window listeners - element not found');
            return;
        }

        const windowElement = this.element.closest('.app');
        if (!windowElement) {
            this._logError('Window Management', 'Cannot find window element for event listeners');
            return;
        }

        this._logDebug('Window Management', 'Setting up window event listeners');

        // Set up resize observer for size changes
        if (window.ResizeObserver) {
            this._resizeObserver = new ResizeObserver((entries) => {
                for (const entry of entries) {
                    const { width, height } = entry.contentRect;
                    this._logDebug('Window Management', 'Resize observed', { width, height });
                    this._onWindowResize();
                }
            });

            this._resizeObserver.observe(windowElement);
            this._logDebug('Window Management', 'ResizeObserver attached');
        }

        // Set up mutation observer for position changes
        if (window.MutationObserver) {
            this._positionObserver = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    if (mutation.type === 'attributes' &&
                        (mutation.attributeName === 'style')) {
                        this._logDebug('Window Management', 'Position change observed');
                        this._onWindowMove();
                    }
                });
            });

            this._positionObserver.observe(windowElement, {
                attributes: true,
                attributeFilter: ['style']
            });
            this._logDebug('Window Management', 'MutationObserver attached');
        }

        // Also listen for window close to save final state
        this.element.addEventListener('close', () => {
            this._logDebug('Window Management', 'Window closing, saving final state');
            this._saveWindowState();
        });

        this._logInfo('Window Management', 'Window event listeners set up successfully');
    }

    /** @override */
    async close(options = {}) {
        this._logInfo('Application Lifecycle', 'Application closing');

        // Clean up window management observers
        this._cleanupWindowEventListeners();

        // Save final window state
        await this._saveWindowState();

        // Call parent close
        return super.close(options);
    }

    /**
     * Clean up window event listeners and observers
     * @private
     */
    _cleanupWindowEventListeners() {
        this._logDebug('Window Management', 'Cleaning up window event listeners');

        // Clean up resize observer
        if (this._resizeObserver) {
            this._resizeObserver.disconnect();
            this._resizeObserver = null;
            this._logDebug('Window Management', 'ResizeObserver disconnected');
        }

        // Clean up position observer
        if (this._positionObserver) {
            this._positionObserver.disconnect();
            this._positionObserver = null;
            this._logDebug('Window Management', 'MutationObserver disconnected');
        }

        // Clear any pending timeouts
        if (this._resizeTimeout) {
            clearTimeout(this._resizeTimeout);
            this._resizeTimeout = null;
        }

        if (this._moveTimeout) {
            clearTimeout(this._moveTimeout);
            this._moveTimeout = null;
        }

        this._logInfo('Window Management', 'Window event listeners cleaned up');
    }

    /**
     * Initialize settlement selector component after render
     * @private
     */
    _initializeSettlementSelector() {
        try {
            this._logDebug('Settlement Selector', 'Initializing settlement selector component');

            // Find the settlement section container
            const settlementSection = this.element.querySelector('.settlement-section');
            if (!settlementSection) {
                this._logError('Settlement Selector', 'Settlement section not found in DOM');
                return;
            }

            // Find or create settlement selector container
            let selectorContainer = settlementSection.querySelector('.settlement-selector-container');
            if (!selectorContainer) {
                // Replace the existing settlement info with our new selector
                const settlementInfo = settlementSection.querySelector('.settlement-info');
                if (settlementInfo) {
                    selectorContainer = document.createElement('div');
                    selectorContainer.className = 'settlement-selector-container';
                    settlementInfo.parentNode.replaceChild(selectorContainer, settlementInfo);
                } else {
                    // Create new container if settlement-info doesn't exist
                    selectorContainer = document.createElement('div');
                    selectorContainer.className = 'settlement-selector-container';
                    settlementSection.appendChild(selectorContainer);
                }
            }

            // Initialize the settlement selector if available
            if (this.settlementSelector) {
                this.settlementSelector.initialize(selectorContainer);
            } else {
                this._logWarn('Settlement Selector', 'Settlement selector not available, using fallback');
                // Create a simple fallback selector
                this._createFallbackSettlementSelector(selectorContainer);
            }

            // Set up event listeners for settlement selection
            this._setupSettlementSelectorEvents();

            this._logInfo('Settlement Selector', 'Settlement selector initialized successfully');

        } catch (error) {
            this._logError('Settlement Selector', 'Failed to initialize settlement selector', { error: error.message });
        }
    }

    /**
     * Set up event listeners for settlement selector
     * @private
     */
    _setupSettlementSelectorEvents() {
        // Listen for settlement selection changes
        const regionDropdown = this.element.querySelector('.region-dropdown');
        const settlementDropdown = this.element.querySelector('.settlement-dropdown');

        if (regionDropdown) {
            regionDropdown.addEventListener('change', (event) => {
                this._onSettlementSelectorRegionChange(event.target.value);
            });
        }

        if (settlementDropdown) {
            settlementDropdown.addEventListener('change', (event) => {
                this._onSettlementSelectorSettlementChange(event.target.value);
            });
        }

        this._logDebug('Settlement Selector', 'Event listeners attached to settlement selector');
    }

    /**
     * Handle region change from settlement selector
     * @param {string} regionName - Selected region name
     * @private
     */
    _onSettlementSelectorRegionChange(regionName) {
        this._logDebug('Settlement Selector', 'Region changed via selector', { region: regionName });

        // Clear current settlement selection
        this.selectedSettlement = null;
        this.availableCargo = [];

        // Update UI state
        this._updateUIState();
    }

    /**
     * Handle settlement change from settlement selector
     * @param {string} settlementName - Selected settlement name
     * @private
     */
    async _onSettlementSelectorSettlementChange(settlementName) {
        this._logDebug('Settlement Selector', 'Settlement changed via selector', { settlement: settlementName });

        // Clear any previous validation errors when settlement changes
        this.clearValidationErrors('buying');
        this.clearValidationErrors('selling');

        if (!settlementName) {
            this.selectedSettlement = null;
            this.availableCargo = [];
            this._updateUIState();
            return;
        }

        // Get settlement data
        const settlement = this.dataManager.getSettlement(settlementName);
        if (settlement) {
            this.selectedSettlement = settlement;
            this.availableCargo = []; // Clear cargo until availability is checked

            this._logInfo('Settlement Selector', 'Settlement selected via selector', {
                name: settlement.name,
                region: settlement.region,
                size: settlement.size,
                wealth: settlement.wealth
            });

            // Update UI state
            this._updateUIState();

            // Update selling resources (show all cargo types)
            this._populateSellingResources();

            // Show notification
            if (ui.notifications) {
                ui.notifications.info(`Selected ${settlement.name} in ${settlement.region}`);
            }
        } else {
            this._logError('Settlement Selector', 'Settlement not found', { settlementName });
        }
    }

    /**
     * Initialize application state on render
     * @private
     */
    async _initializeApplicationState() {
        try {
            this._logDebug('Application State', 'Initializing application state');

            // Load current season
            await this._loadCurrentSeason();

            // Check if season is set, prompt if not
            if (!this.currentSeason) {
                await this._promptForSeasonSelection();
            }

            // Update UI state
            this._updateUIState();

            this._logInfo('Application State', 'Application state initialized successfully');

        } catch (error) {
            this._logError('Application State', 'Failed to initialize application state', { error: error.message });
            ui.notifications.error(`Application initialization failed: ${error.message}`);
        }
    }

    /**
     * Update UI state based on current application state
     * @private
     */
    _updateUIState() {
        // Update season display
        if (this.currentSeason) {
            const seasonSelect = this.element.querySelector('#current-season');
            if (seasonSelect) {
                seasonSelect.value = this.currentSeason;
            }
        }

        // Update button states
        this._updateTransactionButtons();
    }

    /**
     * Update transaction button states based on current context
     * @private
     */
    _updateTransactionButtons() {
        const hasSettlement = !!this.selectedSettlement;
        const hasCargo = this.availableCargo.length > 0;
        const hasSeason = !!this.currentSeason;

        // Get button elements
        const haggleBtn = this.element.querySelector('.haggle-button');
        const saleBtn = this.element.querySelector('.sale-button');
        const desperateSaleBtn = this.element.querySelector('.desperate-sale-button');
        const rumorSaleBtn = this.element.querySelector('.rumor-sale-button');

        // Enable/disable buttons based on context
        if (haggleBtn) {
            haggleBtn.disabled = !hasSettlement || !hasCargo || !hasSeason;
            haggleBtn.title = this._getButtonTooltip('haggle', hasSettlement, hasCargo, hasSeason);
        }

        if (saleBtn) {
            saleBtn.disabled = !hasSettlement || !hasSeason;
            saleBtn.title = this._getButtonTooltip('sale', hasSettlement, hasCargo, hasSeason);
        }

        if (desperateSaleBtn) {
            const isTradeSettlement = this.dataManager?.isTradeSettlement(this.selectedSettlement);
            desperateSaleBtn.disabled = !hasSettlement || !hasSeason || !isTradeSettlement;
            desperateSaleBtn.title = this._getButtonTooltip('desperate_sale', hasSettlement, hasCargo, hasSeason, isTradeSettlement);
        }

        if (rumorSaleBtn) {
            rumorSaleBtn.disabled = !hasSettlement || !hasSeason;
            rumorSaleBtn.title = this._getButtonTooltip('rumor_sale', hasSettlement, hasCargo, hasSeason);
        }

        this._logDebug('UI State', 'Transaction buttons updated', {
            hasSettlement,
            hasCargo,
            hasSeason,
            buttonsFound: {
                haggle: !!haggleBtn,
                sale: !!saleBtn,
                desperateSale: !!desperateSaleBtn,
                rumorSale: !!rumorSaleBtn
            }
        });
    }

    /**
     * Get tooltip text for transaction buttons
     * @param {string} buttonType - Type of button
     * @param {boolean} hasSettlement - Whether settlement is selected
     * @param {boolean} hasCargo - Whether cargo is available
     * @param {boolean} hasSeason - Whether season is set
     * @param {boolean} isTradeSettlement - Whether settlement is a trade center
     * @returns {string} - Tooltip text
     * @private
     */
    _getButtonTooltip(buttonType, hasSettlement, hasCargo, hasSeason, isTradeSettlement = false) {
        if (!hasSeason) {
            return 'Please set the current season first';
        }
        if (!hasSettlement) {
            return 'Please select a settlement first';
        }

        switch (buttonType) {
            case 'haggle':
                return hasCargo ? 'Attempt to negotiate better prices' : 'Check cargo availability first';
            case 'sale':
                return 'Sell cargo from inventory';
            case 'desperate_sale':
                return isTradeSettlement
                    ? 'Sell at 50% price (Trade settlements only)'
                    : 'Only available at Trade settlements';
            case 'rumor_sale':
                return 'Attempt to find premium buyers (requires Gossip test)';
            default:
                return '';
        }
    }

    // ===== SEASON MANAGEMENT =====

    /**
     * Get current trading season
     * @returns {string|null} - Current season or null if not set
     */
    getCurrentSeason() {
        return this.currentSeason || this.tradingEngine?.getCurrentSeason();
    }

    /**
     * Set current trading season
     * @param {string} season - Season name
     */
    async setCurrentSeason(season) {
        const validSeasons = ['spring', 'summer', 'autumn', 'winter'];
        if (!validSeasons.includes(season)) {
            throw new Error(`Invalid season: ${season}`);
        }

        this._logInfo('Season Management', `Setting current season to: ${season}`);

        this.currentSeason = season;

        // Update trading engine
        if (this.tradingEngine) {
            this.tradingEngine.setCurrentSeason(season);
        }

        // Update FoundryVTT setting
        await game.settings.set("trading-places", "currentSeason", season);

        // Update pricing for any selected cargo
        if (this.selectedCargo) {
            await this._updateCargoPricing();
        }

        // Update button states
        this._updateTransactionButtons();

        // Notify season change
        this._notifySeasonChange(season);

        this._logInfo('Season Management', `Season successfully changed to: ${season}`);
    }

    /**
     * Load current season from settings
     * @private
     */
    async _loadCurrentSeason() {
        try {
            this.currentSeason = await game.settings.get("trading-places", "currentSeason");

            if (this.tradingEngine && this.currentSeason) {
                this.tradingEngine.setCurrentSeason(this.currentSeason);
            }

            this._logDebug('Season Management', 'Current season loaded from settings', { season: this.currentSeason });
        } catch (error) {
            this._logError('Season Management', 'Failed to load current season from settings', { error: error.message });
            this.currentSeason = null;
        }
    }

    /**
     * Update seasonal pricing for all displayed cargo
     * @private
     */
    async _updateCargoPricing() {
        if (!this.currentSeason || !this.availableCargo.length) {
            return;
        }

        try {
            this._logDebug('Pricing Update', 'Updating cargo pricing for season change');

            // Recalculate prices for all available cargo
            this.availableCargo = this.availableCargo.map(cargo => {
                try {
                    const basePrice = this.tradingEngine.calculateBasePrice(
                        cargo.name,
                        this.currentSeason,
                        cargo.quality || 'average'
                    );

                    return {
                        ...cargo,
                        currentPrice: basePrice,
                        season: this.currentSeason
                    };
                } catch (error) {
                    this._logError('Pricing Update', `Failed to update price for ${cargo.name}`, { error: error.message });
                    return cargo;
                }
            });

            // Re-render content to show updated prices
            await this.render(false);

            this._logInfo('Pricing Update', 'Cargo pricing updated successfully');

        } catch (error) {
            this._logError('Pricing Update', 'Failed to update cargo pricing', { error: error.message });
        }
    }

    /**
     * Prompt user to select season if not set
     * @private
     */
    async _promptForSeasonSelection() {
        this._logDebug('Season Management', 'Prompting user for season selection');

        if (typeof WFRPSeasonSelectionDialog !== 'undefined') {
            await WFRPSeasonSelectionDialog.show(async (selectedSeason) => {
                await this.setCurrentSeason(selectedSeason);
                await this.render(false); // Re-render main application
            });
        } else {
            // Fallback to notification
            ui.notifications.warn('Please set the season in module settings.');
        }
    }

    /**
     * Notify users of season change
     * @param {string} season - New season
     * @private
     */
    _notifySeasonChange(season) {
        ui.notifications.info(`Trading season changed to ${season}. All prices updated.`);

        // Post to chat if enabled
        this._postSeasonChangeToChat(season);

        this._logInfo('Season Management', 'Season change notification sent', { season });
    }

    /**
     * Post season change notification to chat
     * @param {string} season - New season
     * @private
     */
    async _postSeasonChangeToChat(season) {
        try {
            const content = `
                <div class="season-change">
                    <h3>Season Changed</h3>
                    <p>Trading season is now <strong>${season}</strong>. All cargo prices have been updated accordingly.</p>
                </div>
            `;

            const chatVisibility = game.settings.get("trading-places", "chatVisibility");
            const whisperTargets = chatVisibility === "gm" ? [game.user.id] : null;

            await ChatMessage.create({
                content: content,
                whisper: whisperTargets
            });

            this._logDebug('Chat Integration', 'Season change posted to chat', { season, visibility: chatVisibility });

        } catch (error) {
            this._logError('Chat Integration', 'Failed to post season change to chat', { error: error.message });
        }
    }

    // =============================================================================
    // SELLING RESOURCE MANAGEMENT - FIX FOR PROBLEM 1
    // =============================================================================

    /**
     * Populate selling tab with ALL available cargo types from all settlements
     * @private
     */
    _populateSellingResources() {
        console.log('🛒 POPULATING ALL SELLABLE RESOURCES');
        
        const resourceButtonsContainer = this.element.querySelector('#resource-buttons');
        if (!resourceButtonsContainer) {
            console.error('❌ Resource buttons container not found');
            return;
        }
        
        // Clear existing buttons
        resourceButtonsContainer.innerHTML = '';
        
        // Get ALL unique trading goods from settlement source lists
        const allTradingGoods = this._getAllTradingGoods();
        console.log(`📦 Found ${allTradingGoods.length} unique trading goods:`, allTradingGoods);
        
        allTradingGoods.forEach(goodName => {
            const button = document.createElement('button');
            button.className = 'resource-btn';
            button.textContent = goodName;
            button.dataset.resource = goodName;
            
            // Add click handler for resource selection
            button.addEventListener('click', () => {
                this._onSellingResourceSelect(goodName);
            });
            
            resourceButtonsContainer.appendChild(button);
        });
        
        console.log(`✅ Added ${allTradingGoods.length} sellable resources to selling tab`);
    }

    /**
     * Get all unique trading goods from all settlements' source lists
     * @returns {Array} - Array of unique trading good names
     * @private
     */
    _getAllTradingGoods() {
        const allGoods = new Set();
        
        // Parse all settlement source lists
        this.dataManager.settlements.forEach(settlement => {
            if (settlement.source && Array.isArray(settlement.source)) {
                settlement.source.forEach(good => {
                    // Skip "Trade" as it's not a sellable good but a settlement modifier
                    if (good !== 'Trade') {
                        allGoods.add(good);
                    }
                });
            }
        });
        
        // Also add cargo types from data manager if they exist
        if (this.dataManager.cargoTypes && Array.isArray(this.dataManager.cargoTypes)) {
            this.dataManager.cargoTypes.forEach(cargoType => {
                if (cargoType.name !== 'Trade') {
                    allGoods.add(cargoType.name);
                }
            });
        }
        
        // Convert to sorted array
        return Array.from(allGoods).sort();
    }

    /**
     * Handle selling resource selection
     * @param {string} resourceName - Name of selected resource
     * @private
     */
    _onSellingResourceSelect(resourceName) {
        console.log(`🎯 SELECTED RESOURCE FOR SELLING: ${resourceName}`);
        
        // Remove selection from other buttons
        this.element.querySelectorAll('.resource-btn').forEach(btn => {
            btn.classList.remove('selected');
        });
        
        // Add selection to clicked button
        const selectedButton = this.element.querySelector(`[data-resource="${resourceName}"]`);
        if (selectedButton) {
            selectedButton.classList.add('selected');
        }
        
        // Store selected resource
        this.selectedResource = resourceName;
        
        // Show selling interface
        const sellingInterface = this.element.querySelector('#selling-interface');
        if (sellingInterface) {
            sellingInterface.style.display = 'block';
        }
        
        // Enable selling buttons
        const lookForSellersBtn = this.element.querySelector('#look-for-sellers');
        const negotiateBtn = this.element.querySelector('#negotiate-sell');
        const desperateSaleBtn = this.element.querySelector('#desperate-sale');
        
        if (lookForSellersBtn) {
            lookForSellersBtn.style.display = 'flex';
            // Add event listener for look for sellers
            lookForSellersBtn.onclick = (event) => this._onLookForSellers(event);
        }
        if (negotiateBtn) negotiateBtn.style.display = 'flex';
        if (desperateSaleBtn) desperateSaleBtn.style.display = 'flex';
        
        console.log(`✅ Selling interface enabled for ${resourceName}`);
    }

    /**
     * Handle "Look for Sellers" button click - implements WFRP Selling Algorithm Step 2
     * @param {Event} event - Click event
     * @private
     */
    async _onLookForSellers(event) {
        event.preventDefault();
        
        if (!this.selectedResource) {
            ui.notifications.warn('Please select a resource to sell first');
            return;
        }
        
        if (!this.selectedSettlement) {
            ui.notifications.warn('Please select a settlement first');
            return;
        }
        
        console.log('🔍 === LOOKING FOR SELLERS (WFRP SELLING ALGORITHM) ===');
        console.log(`Resource: ${this.selectedResource}`);
        console.log(`Settlement: ${this.selectedSettlement.name}`);
        
        try {
            // Show loading state
            const button = event.target;
            const originalText = button.textContent;
            button.textContent = 'Looking...';
            button.disabled = true;
            
            // Get quantity from input (for now, assume 10 EP)
            const quantityInput = this.element.querySelector('#selling-quantity');
            const quantity = quantityInput ? parseInt(quantityInput.value) || 10 : 10;
            
            console.log(`📊 STEP 2: Finding Buyer for ${quantity} EP of ${this.selectedResource}`);
            
            // Step 2: Calculate buyer chance according to algorithm
            const sizeRating = this.dataManager.convertSizeToNumeric(this.selectedSettlement.size);
            let buyerChance = sizeRating * 10;
            
            // Add +30 if settlement produces "Trade"
            const isTradeSettlement = this.selectedSettlement.source.includes('Trade');
            if (isTradeSettlement) {
                buyerChance += 30;
                console.log(`  ├─ Trade Settlement Bonus: +30`);
            }
            
            console.log(`  ├─ Base Chance: Size ${sizeRating} × 10 = ${sizeRating * 10}%`);
            console.log(`  ├─ Trade Bonus: ${isTradeSettlement ? '+30' : '0'}`);
            console.log(`  └─ Final Chance: ${buyerChance}%`);
            
            // Special village restrictions (Step 2 special case)
            if (sizeRating === 1) { // Village
                console.log(`🏘️ VILLAGE RESTRICTIONS CHECK`);
                if (this.selectedResource !== 'Grain') {
                    if (this.currentSeason === 'spring') {
                        const villageQuantity = Math.floor(Math.random() * 10) + 1; // 1d10
                        console.log(`  ├─ Village in Spring: Can buy max ${villageQuantity} EP of non-Grain goods`);
                        if (quantity > villageQuantity) {
                            ui.notifications.warn(`Village only wants ${villageQuantity} EP of ${this.selectedResource} (you have ${quantity} EP)`);
                            button.textContent = originalText;
                            button.disabled = false;
                            return;
                        }
                    } else {
                        console.log(`  └─ Village outside Spring: No demand for non-Grain goods`);
                        ui.notifications.info(`Villages don't buy ${this.selectedResource} in ${this.currentSeason}`);
                        button.textContent = originalText;
                        button.disabled = false;
                        return;
                    }
                }
            }
            
            // Roll for buyer using FoundryVTT dice
            const roll = new Roll("1d100");
            await roll.evaluate();
            
            // Show dice roll in chat if enabled
            const chatVisibility = game.settings.get("trading-places", "chatVisibility");
            if (chatVisibility !== "disabled") {
                await roll.toMessage({
                    speaker: ChatMessage.getSpeaker(),
                    flavor: `Looking for buyers of ${this.selectedResource} in ${this.selectedSettlement.name}`
                });
            }
            
            console.log(`🎲 Buyer Search Roll: ${roll.total} vs ${buyerChance}`);
            
            if (roll.total <= buyerChance) {
                // SUCCESS: Buyer found
                console.log('✅ BUYER FOUND!');
                
                // Step 3: Calculate offer price according to algorithm
                console.log(`💰 STEP 3: Calculating Offer Price`);
                
                // Get base price for the resource in current season
                const cargoType = this.dataManager.cargoTypes.find(c => c.name === this.selectedResource);
                let basePrice = 50; // Default fallback
                
                if (cargoType && cargoType.basePrices && cargoType.basePrices[this.currentSeason]) {
                    basePrice = cargoType.basePrices[this.currentSeason];
                }
                
                console.log(`  ├─ Base Price (${this.currentSeason}): ${basePrice} GC per 10 EP`);
                
                // Apply wealth modifier according to algorithm
                const wealthModifier = this.dataManager.getWealthModifier(this.selectedSettlement.wealth);
                const offerPrice = Math.round(basePrice * wealthModifier);
                
                console.log(`  ├─ Wealth Rating: ${this.selectedSettlement.wealth} (${this.dataManager.getWealthDescription(this.selectedSettlement.wealth)})`);
                console.log(`  ├─ Wealth Modifier: ${Math.round(wealthModifier * 100)}%`);
                console.log(`  └─ Final Offer: ${basePrice} × ${wealthModifier} = ${offerPrice} GC per 10 EP`);
                
                const totalOffer = Math.round((offerPrice * quantity) / 10);
                
                console.log(`📋 FINAL RESULT: Buyer offers ${totalOffer} GC for ${quantity} EP of ${this.selectedResource}`);
                
                // Show success in UI
                const resultsDiv = this.element.querySelector('#selling-results');
                if (resultsDiv) {
                    const buyerName = this._generateTraderName();
                    resultsDiv.innerHTML = `
                        <h4>
                            <i class="fas fa-handshake success-icon"></i>
                            Buyer Found!
                        </h4>
                        <div class="buyer-details">
                            <p><strong>Buyer:</strong> ${buyerName}</p>
                            <p><strong>Offer:</strong> ${offerPrice} GC per 10 EP</p>
                            <p><strong>Total for ${quantity} EP:</strong> ${totalOffer} GC</p>
                            <p><strong>Settlement Wealth:</strong> ${this.dataManager.getWealthDescription(this.selectedSettlement.wealth)} (${Math.round(wealthModifier * 100)}% of base price)</p>
                        </div>
                    `;
                    resultsDiv.style.display = 'block';
                }
                
                ui.notifications.info(`Buyer found! ${buyerName} offers ${totalOffer} GC for your ${this.selectedResource}`);
                
            } else {
                // FAILURE: No buyer found
                console.log('❌ NO BUYER FOUND');
                console.log(`  └─ Rolled ${roll.total} > ${buyerChance} = FAILURE`);
                
                // Show failure in UI
                const resultsDiv = this.element.querySelector('#selling-results');
                if (resultsDiv) {
                    resultsDiv.innerHTML = `
                        <h4>
                            <i class="fas fa-times-circle failure-icon"></i>
                            No Buyer Found
                        </h4>
                        <p>No one is interested in ${this.selectedResource} right now (rolled ${roll.total}/${buyerChance}).</p>
                        <p>You can try selling half the quantity and re-rolling, or try a different settlement.</p>
                    `;
                    resultsDiv.style.display = 'block';
                }
                
                ui.notifications.info(`No buyers found for ${this.selectedResource} in ${this.selectedSettlement.name} (rolled ${roll.total}/${buyerChance})`);
            }
            
            // Restore button
            button.textContent = originalText;
            button.disabled = false;
            
        } catch (error) {
            console.error('❌ Error in seller search:', error);
            ui.notifications.error(`Seller search failed: ${error.message}`);
            
            // Restore button on error
            const button = event.target;
            button.textContent = 'Look for Sellers';
            button.disabled = false;
        }
    }

    /** @override */
    _attachPartListeners(partId, htmlElement, options) {
        super._attachPartListeners(partId, htmlElement, options);

        this._logDebug('Event Listeners', `Attaching listeners for part: ${partId}`);

        // Attach listeners based on part
        switch (partId) {
            case 'header':
                this._attachHeaderListeners(htmlElement);
                break;
            case 'content':
                this._attachContentListeners(htmlElement);
                break;
            case 'footer':
                this._attachFooterListeners(htmlElement);
                break;
        }
    }

    /**
     * Attach event listeners for header part
     * @param {HTMLElement} html - Header HTML element
     * @private
     */
    _attachHeaderListeners(html) {
        // Season management
        const seasonSelect = html.querySelector('#current-season');
        if (seasonSelect) {
            seasonSelect.addEventListener('change', this._onSeasonChange.bind(this));
        }

        this._logDebug('Event Listeners', 'Header listeners attached');
    }

    /**
     * Attach event listeners for content part
     * @param {HTMLElement} html - Content HTML element
     * @private
     */
    _attachContentListeners(html) {
        // Settlement selection
        const settlementSelector = html.querySelector('.settlement-selector');
        if (settlementSelector) {
            settlementSelector.addEventListener('change', this._onSettlementSelect.bind(this));
        }

        const settlementSearch = html.querySelector('.settlement-search');
        if (settlementSearch) {
            settlementSearch.addEventListener('input', this._onSettlementSearch.bind(this));
        }

        // Cargo selection and interaction
        const cargoItems = html.querySelectorAll('.cargo-item');
        cargoItems.forEach(item => {
            item.addEventListener('click', this._onCargoSelect.bind(this));
        });

        const checkAvailabilityBtn = html.querySelector('.check-availability');
        if (checkAvailabilityBtn) {
            checkAvailabilityBtn.addEventListener('click', this._onCheckAvailability.bind(this));
        }

        // New unified UI event listeners
        this._attachUnifiedUIListeners(html);
        
        // Initialize selling tab state
        this._updateSellingTab();

        // Transaction controls
        const purchaseButtons = html.querySelectorAll('.purchase-button');
        purchaseButtons.forEach(btn => {
            btn.addEventListener('click', this._onPurchaseAttempt.bind(this));
        });

        const saleBtn = html.querySelector('.sale-button');
        if (saleBtn) {
            saleBtn.addEventListener('click', this._onSaleAttempt.bind(this));
        }

        const haggleBtn = html.querySelector('.haggle-button');
        if (haggleBtn) {
            haggleBtn.addEventListener('click', this._onHaggleAttempt.bind(this));
        }

        // Quantity controls
        const quantityInputs = html.querySelectorAll('.quantity-input');
        quantityInputs.forEach(input => {
            input.addEventListener('input', this._onQuantityChange.bind(this));
        });

        const qualitySelectors = html.querySelectorAll('.quality-selector');
        qualitySelectors.forEach(selector => {
            selector.addEventListener('change', this._onQualityChange.bind(this));
        });

        // Special sale buttons
        const desperateSaleBtn = html.querySelector('.desperate-sale-button');
        if (desperateSaleBtn) {
            desperateSaleBtn.addEventListener('click', this._onDesperateSaleAttempt.bind(this));
        }

        const rumorSaleBtn = html.querySelector('.rumor-sale-button');
        if (rumorSaleBtn) {
            rumorSaleBtn.addEventListener('click', this._onRumorSaleAttempt.bind(this));
        }

        this._logDebug('Event Listeners', 'Content listeners attached');
    }

    /**
     * Attach event listeners for the new unified UI
     * @param {HTMLElement} html - HTML element
     * @private
     */
    _attachUnifiedUIListeners(html) {
        // Tab switching functionality
        const tabs = html.querySelectorAll('.tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                // Remove active class from all tabs and content
                html.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                html.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
                
                // Add active class to clicked tab
                tab.classList.add('active');
                
                // Show corresponding content
                const targetTab = tab.getAttribute('data-tab');
                const targetContent = html.querySelector(`#${targetTab}-tab`);
                if (targetContent) {
                    targetContent.classList.add('active');
                }
                
                this._logDebug('UI Interaction', 'Switched to tab:', targetTab);
            });
        });

        // Region and settlement selection for unified UI
        const regionSelect = html.querySelector('#region-select');
        if (regionSelect) {
            regionSelect.addEventListener('change', this._onRegionChange.bind(this));
        }

        const settlementSelect = html.querySelector('#settlement-select');
        if (settlementSelect) {
            settlementSelect.addEventListener('change', this._onSettlementSelect.bind(this));
        }

        // Season selection
        const seasonSelect = html.querySelector('#season-select');
        if (seasonSelect) {
            seasonSelect.addEventListener('change', this._onSeasonChange.bind(this));
        }

        // Selling tab functionality
        const sellQuantityInput = html.querySelector('#sell-quantity');
        if (sellQuantityInput) {
            sellQuantityInput.addEventListener('input', this._onSellQuantityChange.bind(this));
        }

        const lookForSellersBtn = html.querySelector('#look-for-sellers');
        if (lookForSellersBtn) {
            lookForSellersBtn.addEventListener('click', this._onLookForSellers.bind(this));
        }

        const negotiateSellBtn = html.querySelector('#negotiate-sell');
        if (negotiateSellBtn) {
            negotiateSellBtn.addEventListener('click', this._onNegotiateSell.bind(this));
        }

        const desperateSaleBtn = html.querySelector('#desperate-sale');
        if (desperateSaleBtn) {
            desperateSaleBtn.addEventListener('click', this._onDesperateSale.bind(this));
        }

        const negotiateBuyBtn = html.querySelector('#negotiate-buy');
        if (negotiateBuyBtn) {
            negotiateBuyBtn.addEventListener('click', this._onNegotiateBuy.bind(this));
        }

        // Debug mode toggle
        const debugToggle = html.querySelector('#debug-mode');
        if (debugToggle) {
            debugToggle.addEventListener('change', this._onDebugToggle.bind(this));
        }

        this._logDebug('Event Listeners', 'Unified UI listeners attached');
    }

    /**
     * Attach event listeners for footer part
     * @param {HTMLElement} html - Footer HTML element
     * @private
     */
    _attachFooterListeners(html) {
        // Debug log controls if any
        const clearLogBtn = html.querySelector('.clear-debug-log');
        if (clearLogBtn) {
            clearLogBtn.addEventListener('click', this._onClearDebugLog.bind(this));
        }

        this._logDebug('Event Listeners', 'Footer listeners attached');
    }

    // ===== EVENT HANDLERS =====

    /**
     * Handle season change
     * @param {Event} event - Change event
     * @private
     */
    async _onSeasonChange(event) {
        const newSeason = event.target.value;

        try {
            this._logDebug('Event Handler', 'Season change requested', { newSeason });
            await this.setCurrentSeason(newSeason);
            await this.render(false); // Re-render application
        } catch (error) {
            this._logError('Event Handler', 'Season change failed', { error: error.message });
            ui.notifications.error(`Failed to change season: ${error.message}`);
        }
    }

    /**
     * Handle settlement selection
     * @param {Event} event - Change event
     * @private
     */
    async _onSettlementSelect(event) {
        const settlementName = event.target.value;

        this._logDebug('Event Handler', 'Settlement selection requested', { settlementName });

        // Clear any previous validation errors when settlement changes
        this.clearValidationErrors('buying');
        this.clearValidationErrors('selling');

        if (!settlementName) {
            this.selectedSettlement = null;
            this.availableCargo = [];
            await this.render(false);
            return;
        }

        try {
            const settlement = this.dataManager.getSettlement(settlementName);
            if (!settlement) {
                throw new Error(`Settlement not found: ${settlementName}`);
            }

            this.selectedSettlement = settlement;

            // Clear previous cargo
            this.availableCargo = [];

            // Update UI
            await this.render(false);
            
            // Update selling tab with new settlement
            this._updateSellingTab();

            this._logInfo('Settlement Selection', 'Settlement selected successfully', {
                settlement: settlement.name,
                region: settlement.region
            });

        } catch (error) {
            this._logError('Event Handler', 'Settlement selection failed', { error: error.message });
            ui.notifications.error(`Failed to select settlement: ${error.message}`);
        }
    }

    /**
     * Handle settlement search
     * @param {Event} event - Input event
     * @private
     */
    _onSettlementSearch(event) {
        const searchTerm = event.target.value.toLowerCase();
        const selector = this.element.querySelector('.settlement-selector');

        if (!selector) return;

        const options = selector.querySelectorAll('option');

        options.forEach(option => {
            const optionText = option.textContent.toLowerCase();
            const shouldShow = searchTerm === '' || optionText.includes(searchTerm);
            option.style.display = shouldShow ? '' : 'none';
        });

        this._logDebug('Event Handler', 'Settlement search performed', { searchTerm, optionsFiltered: options.length });
    }

    /**
     * Handle cargo selection
     * @param {Event} event - Click event
     * @private
     */
    _onCargoSelect(event) {
        const cargoName = event.currentTarget.dataset.cargo;

        // Remove previous selection
        const cargoItems = this.element.querySelectorAll('.cargo-item');
        cargoItems.forEach(item => item.classList.remove('selected'));

        // Add selection to clicked item
        event.currentTarget.classList.add('selected');

        this.selectedCargo = cargoName;

        this._logDebug('Event Handler', 'Cargo selected', { cargoName });
    }

    /**
     * Handle check availability button
     * @param {Event} event - Click event
     * @private
     */
    /**
     * Handle check availability button - FIXED VERSION
     * @param {Event} event - Click event
     * @private
     */
    async _onCheckAvailability(event) {
        event.preventDefault();
        
        this._logInfo('Availability Check', 'Check availability button clicked');
        
        try {
            // Validate settlement is selected and valid
            if (!this.selectedSettlement) {
                this.showValidationError({ 
                    valid: false, 
                    errorType: 'missing_settlement',
                    error: 'No settlement selected'
                }, 'buying');
                return;
            }
            
            // Validate settlement data
            const validation = this.validateSettlementWithFeedback(this.selectedSettlement, 'buying');
            if (!validation.valid) {
                this._logError('Availability Check', 'Settlement validation failed - aborting availability check', {
                    errors: validation.errors
                });
                return;
            }
            
            // Validate season is set
            if (!this.currentSeason) {
                ui.notifications.warn('Please set the current season first');
                return;
            }
            
            this._logInfo('Cargo Availability', 'Starting availability check', {
                settlement: this.selectedSettlement.name,
                season: this.currentSeason
            });
            
            // Hide any previous error messages
            this.clearValidationErrors('buying');
            
            // Show loading state
            const button = event.target;
            const originalText = button.textContent;
            button.textContent = 'Checking...';
            button.disabled = true;
            
            // Perform complete availability check using trading engine
            console.log('=== CARGO AVAILABILITY CHECK ===');
            console.log('Settlement:', this.selectedSettlement.name);
            console.log('Season:', this.currentSeason);
            
            // Use FoundryVTT dice roller instead of fallback
            const rollFunction = async () => {
                const roll = new Roll("1d100");
                await roll.evaluate();
                
                // Show dice roll in chat if enabled
                const chatVisibility = game.settings.get("trading-places", "chatVisibility");
                if (chatVisibility !== "disabled") {
                    await roll.toMessage({
                        speaker: ChatMessage.getSpeaker(),
                        flavor: `Cargo Availability Check in ${this.selectedSettlement.name}`
                    });
                }
                
                console.log(`🎲 Rolled 1d100: ${roll.total}`);
                return roll.total;
            };
            
            const completeResult = await this.tradingEngine.performCompleteAvailabilityCheck(
                this.selectedSettlement,
                this.currentSeason,
                rollFunction
            );
            
            console.log('Complete availability result:', completeResult);
            
            // Update UI based on result
            if (completeResult.available) {
                // SUCCESS: Cargo is available
                console.log('✅ CARGO IS AVAILABLE!');
                console.log('📊 STEP 0: Settlement Information');
                console.log(`  ├─ Settlement: ${this.selectedSettlement.name}`);
                console.log(`  ├─ Size Rating: ${this.selectedSettlement.size} (numeric: ${this.dataManager.convertSizeToNumeric(this.selectedSettlement.size)})`);
                console.log(`  ├─ Wealth Rating: ${this.selectedSettlement.wealth}`);
                console.log(`  └─ Produces: [${this.selectedSettlement.source.join(', ')}]`);
                
                console.log('🎯 STEP 1: Availability Check Results');
                console.log(`  ├─ Base Chance: (${this.dataManager.convertSizeToNumeric(this.selectedSettlement.size)} + ${this.selectedSettlement.wealth}) × 10 = ${completeResult.availabilityCheck.chance}%`);
                console.log(`  ├─ Roll: ${completeResult.availabilityCheck.roll}`);
                console.log(`  └─ Result: ${completeResult.availabilityCheck.roll} ≤ ${completeResult.availabilityCheck.chance} = SUCCESS`);
                
                console.log('📦 STEP 2A: Cargo Type Determination');
                console.log(`  ├─ Available Types: [${completeResult.cargoTypes.join(', ')}]`);
                console.log(`  └─ Count: ${completeResult.cargoTypes.length} type(s)`);
                
                console.log('⚖️ STEP 2B: Cargo Size Calculation');
                console.log(`  ├─ Base Value: ${this.dataManager.convertSizeToNumeric(this.selectedSettlement.size)} + ${this.selectedSettlement.wealth} = ${completeResult.cargoSize.baseMultiplier}`);
                console.log(`  ├─ Multiplier Roll: ${completeResult.cargoSize.roll1} → rounded up to ${completeResult.cargoSize.sizeMultiplier}`);
                if (completeResult.cargoSize.tradeBonus) {
                    console.log(`  ├─ Trade Bonus: Second roll ${completeResult.cargoSize.roll2} → ${Math.ceil(completeResult.cargoSize.roll2 / 10) * 10}`);
                    console.log(`  ├─ Higher Multiplier Used: ${completeResult.cargoSize.sizeMultiplier}`);
                }
                console.log(`  └─ Total Size: ${completeResult.cargoSize.baseMultiplier} × ${completeResult.cargoSize.sizeMultiplier} = ${completeResult.cargoSize.totalSize} EP`);
                
                // Convert cargo types to detailed cargo objects for display
                const availableCargo = await Promise.all(completeResult.cargoTypes.map(async (cargoName) => {
                    const cargoType = this.dataManager.cargoTypes.find(c => c.name === cargoName);
                    const basePrice = this.tradingEngine.calculateBasePrice(cargoName, this.currentSeason);
                    const totalCargoSize = completeResult.cargoSize.totalSize;
                    const encumbrance = cargoType?.encumbrancePerUnit || 1;
                    const quantity = Math.floor(totalCargoSize / encumbrance);
                    
                    // Generate a merchant for this cargo type
                    const merchant = await this.tradingEngine.generateRandomMerchant(this.selectedSettlement, rollFunction);
                    
                    console.log(`💰 STEP 3: Price Information for ${cargoName}`);
                    console.log(`  ├─ Base Price (${this.currentSeason}): ${basePrice} GC per 10 EP`);
                    console.log(`  ├─ Available Quantity: ${quantity} units (${totalCargoSize} EP total)`);
                    console.log(`  ├─ Encumbrance per Unit: ${encumbrance} EP`);
                    console.log(`  ├─ Merchant: ${merchant.name} (${merchant.skillDescription})`);
                    
                    return {
                        name: cargoName,
                        category: cargoType?.category || 'Unknown',
                        basePrice: basePrice,
                        currentPrice: basePrice,
                        quantity: quantity,
                        totalEP: totalCargoSize,
                        quality: 'Average',
                        encumbrancePerUnit: encumbrance,
                        merchant: merchant
                    };
                }));
                
                console.log('📋 FINAL RESULT: Cargo Available for Purchase');
                availableCargo.forEach(cargo => {
                    console.log(`  ├─ ${cargo.name}: ${cargo.quantity} units @ ${cargo.currentPrice} GC/10EP (Merchant: ${cargo.merchant.name} - ${cargo.merchant.skillDescription})`);
                });
                
                // Store available cargo
                this.availableCargo = availableCargo;
                
                // Show detailed success message
                this._showAvailabilityResults(completeResult, availableCargo);
                
                // Update cargo display
                this._updateCargoDisplay(availableCargo);
                
                // Update button states
                this._updateTransactionButtons();
                
                // Show success notification
                const cargoSummary = availableCargo.map(c => `${c.name} (${c.quantity})`).join(', ');
                ui.notifications.info(`Cargo available in ${this.selectedSettlement.name}: ${cargoSummary}`);
                
            } else {
                // FAILURE: No cargo available
                console.log('❌ NO CARGO AVAILABLE');
                console.log('Availability check details:', completeResult.availabilityCheck);
                
                // Clear any existing cargo
                this.availableCargo = [];
                
                // Show failure message with detailed breakdown
                this._showAvailabilityResults(completeResult);
                
                // Hide cargo display
                this._hideCargoDisplay();
                
                // Update button states
                this._updateTransactionButtons();
                
                // Show info notification
                const rollDetails = completeResult.availabilityCheck;
                ui.notifications.info(`No cargo available in ${this.selectedSettlement.name} (rolled ${rollDetails.roll}/${rollDetails.chance})`);
            }
            
            // Restore button
            button.textContent = originalText;
            button.disabled = false;
            
        } catch (error) {
            this._logError('Availability Check', 'Availability check failed with error', { 
                error: error.message,
                stack: error.stack
            });
            
            ui.notifications.error(`Availability check failed: ${error.message}`);
            
            // Clear cargo on error
            this.availableCargo = [];
            this._hideCargoDisplay();
            this._updateTransactionButtons();
            
            // Restore button on error
            const button = event.target;
            button.textContent = 'Check Availability';
            button.disabled = false;
        }
    }

    // =============================================================================
    // CARGO DISPLAY HELPER METHODS - FIX FOR PROBLEM 2
    // =============================================================================

    /**
     * Show detailed availability check results (always shows formula breakdown)
     * @param {Object} completeResult - Complete availability check result
     * @param {Array} availableCargo - Available cargo for display (empty on failure)
     * @private
     */
    _showAvailabilityResults(completeResult, availableCargo = []) {
        console.log('✅ Showing availability results:', completeResult.available ? 'SUCCESS' : 'FAILURE');
        
        let resultsDiv = this.element.querySelector('#availability-results');
        if (!resultsDiv) {
            // Create the results div if it doesn't exist (fallback)
            const buyingTab = this.element.querySelector('#buying-tab');
            if (buyingTab) {
                resultsDiv = document.createElement('div');
                resultsDiv.id = 'availability-results';
                resultsDiv.className = 'availability-results';
                resultsDiv.style.display = 'none';
                buyingTab.appendChild(resultsDiv);
            } else {
                console.error('❌ Could not find buying tab to create results div!');
                return;
            }
        }

        const rollDetails = completeResult.availabilityCheck;
        const sizeRating = this.dataManager.convertSizeToNumeric(this.selectedSettlement.size);
        const wealthRating = this.selectedSettlement.wealth;
        const baseChance = (sizeRating + wealthRating) * 10;
        const finalChance = Math.min(baseChance, 100);

        let statusHtml = '';
        let cargoHtml = '';

        if (completeResult.available) {
            // SUCCESS: Show cargo types and details
            statusHtml = `
                <h4>
                    <i class="fas fa-check-circle success-icon"></i>
                    Cargo Available!
                </h4>
            `;

            // Show available cargo types from completeResult first
            let cargoTypesDisplay = '';
            if (completeResult.cargoTypes && completeResult.cargoTypes.length > 0) {
                const cargoTypesList = completeResult.cargoTypes.map(type => `<li><strong>${type}</strong></li>`).join('');
                cargoTypesDisplay = `
                    <h5>Available Resource Types:</h5>
                    <ul class="cargo-types-list">
                        ${cargoTypesList}
                    </ul>
                `;
            }
            
            // Create detailed cargo summary if availableCargo is provided
            let detailedCargoSummary = '';
            if (availableCargo && availableCargo.length > 0) {
                const cargoSummary = availableCargo.map(cargo =>
                    `<li><strong>${cargo.name}</strong> (${cargo.category}) - ${cargo.quantity} units available @ ${cargo.basePrice} GC</li>`
                ).join('');
                detailedCargoSummary = `
                    <h5>Detailed Cargo Information:</h5>
                    <ul class="cargo-details-list">
                        ${cargoSummary}
                    </ul>
                `;
            }

            cargoHtml = `
                ${cargoTypesDisplay}
                ${detailedCargoSummary}
                <p><strong>Total Cargo Value:</strong> ${completeResult.cargoSize.totalSize} Encumbrance Points</p>

                <h5>Cargo Size Calculation:</h5>
                <div class="calculation-breakdown">
                    <p><strong>Base Multiplier:</strong> ${sizeRating} + ${wealthRating} = ${completeResult.cargoSize.baseMultiplier}</p>
                    <p><strong>Size Roll:</strong> ${completeResult.cargoSize.roll1} (1d100) → rounded up to ${completeResult.cargoSize.sizeMultiplier}</p>
                    ${completeResult.cargoSize.tradeBonus ? `<p><strong>Trade Bonus:</strong> Additional roll ${completeResult.cargoSize.roll2} → used higher multiplier</p>` : ''}
                    <p><strong>Total Size:</strong> ${completeResult.cargoSize.baseMultiplier} × ${completeResult.cargoSize.sizeMultiplier} = ${completeResult.cargoSize.totalSize} EP</p>
                </div>
            `;
        } else {
            // FAILURE: Show detailed failure information
            statusHtml = `
                <h4>
                    <i class="fas fa-times-circle failure-icon"></i>
                    No Cargo Available
                </h4>
            `;

            cargoHtml = `
                <div class="explanation">
                    <p><em>This settlement has limited trade activity. Try checking availability again, or visit a larger settlement with more merchants.</em></p>
                </div>
            `;
        }

        // Always show the calculation breakdown
        const calculationHtml = `
            <h5>Market Check Results:</h5>
            <div class="calculation-breakdown">
                <p><strong>Settlement:</strong> ${this.selectedSettlement.name}</p>
                <p><strong>Size Rating:</strong> ${this.selectedSettlement.size} (${sizeRating})</p>
                <p><strong>Wealth Rating:</strong> ${this.selectedSettlement.wealth}</p>
                <p><strong>Base Chance:</strong> (${sizeRating} + ${wealthRating}) × 10 = ${baseChance}%</p>
                <p><strong>Final Chance:</strong> ${finalChance}% ${finalChance < baseChance ? '(capped at 100%)' : ''}</p>
                <p><strong>Dice Roll:</strong> ${rollDetails.roll} (1d100)</p>
                <p><strong>Result:</strong> ${rollDetails.roll} ${completeResult.available ? '≤' : '>'} ${finalChance} = <span class="${completeResult.available ? 'success-text' : 'failure-text'}">${completeResult.available ? 'SUCCESS' : 'FAILURE'}</span></p>
            </div>
        `;

        const finalHtml = `
            ${statusHtml}
            <div class="availability-details">
                ${calculationHtml}
                ${cargoHtml}
            </div>
        `;
        
        console.log('🔍 DEBUG: Setting innerHTML to:', finalHtml.substring(0, 200) + '...');
        resultsDiv.innerHTML = finalHtml;
        resultsDiv.style.display = 'block';
        
        // Keep the original div hidden since we're using the new approach
        resultsDiv.style.display = 'none';
        
        console.log('✅ Availability results displayed:', completeResult.available ? 'SUCCESS' : 'FAILURE');
        console.log('🔍 DEBUG: Results div is now visible:', resultsDiv.style.display);
        console.log('🔍 DEBUG: Results div computed styles:', window.getComputedStyle(resultsDiv).display);
        
        // Check actual dimensions
        const rect = resultsDiv.getBoundingClientRect();
        console.log('🔍 DEBUG: Results div dimensions:', {
            width: rect.width,
            height: rect.height,
            top: rect.top,
            left: rect.left,
            visible: rect.width > 0 && rect.height > 0
        });
        
        // Force scroll to the element
        resultsDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
        

        
        // Remove any existing availability results to avoid duplicates
        const existingResults = this.element.querySelectorAll('.availability-results-display');
        existingResults.forEach(el => el.remove());
        
        // Create a properly styled results div that stays visible
        const alertDiv = document.createElement('div');
        alertDiv.className = 'availability-results-display';
        
        const successColor = '#4CAF50';
        const failureColor = '#f44336';
        const bgColor = completeResult.available ? '#1a2e1a' : '#2e1a1a';
        const borderColor = completeResult.available ? successColor : failureColor;
        
        alertDiv.innerHTML = `
            <div style="
                background: ${bgColor}; 
                color: white; 
                padding: 20px; 
                border: 2px solid ${borderColor}; 
                border-radius: 8px; 
                margin: 16px 0;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            ">
                <h3 style="margin: 0 0 15px 0; color: ${completeResult.available ? successColor : failureColor}; font-size: 18px;">
                    ${completeResult.available ? '✅ Cargo Available!' : '❌ No Cargo Available'}
                </h3>
                
                <div style="margin-bottom: 15px;">
                    <h4 style="margin: 0 0 8px 0; color: #ccc; font-size: 14px;">Market Check Results:</h4>
                    <p style="margin: 3px 0; font-size: 13px;"><strong>Settlement:</strong> ${this.selectedSettlement.name}</p>
                    <p style="margin: 3px 0; font-size: 13px;"><strong>Size Rating:</strong> ${this.selectedSettlement.size} (${sizeRating})</p>
                    <p style="margin: 3px 0; font-size: 13px;"><strong>Wealth Rating:</strong> ${this.selectedSettlement.wealth}</p>
                    <p style="margin: 3px 0; font-size: 13px;"><strong>Base Chance:</strong> (${sizeRating} + ${this.selectedSettlement.wealth}) × 10 = ${finalChance}%</p>
                    <p style="margin: 3px 0; font-size: 13px;"><strong>Dice Roll:</strong> ${rollDetails.roll} (1d100)</p>
                    <p style="margin: 3px 0; font-size: 13px;"><strong>Result:</strong> ${rollDetails.roll} ${completeResult.available ? '≤' : '>'} ${finalChance} = <span style="color: ${completeResult.available ? successColor : failureColor}; font-weight: bold;">${completeResult.available ? 'SUCCESS' : 'FAILURE'}</span></p>
                </div>
                
                ${completeResult.available ? `
                    <div>
                        <h4 style="margin: 0 0 8px 0; color: #ccc; font-size: 14px;">Available Resources:</h4>
                        <p style="margin: 3px 0; font-size: 13px;"><strong>Types:</strong> ${completeResult.cargoTypes?.join(', ') || 'None'}</p>
                        <p style="margin: 3px 0; font-size: 13px;"><strong>Total Size:</strong> ${completeResult.cargoSize?.totalSize || 0} EP</p>
                    </div>
                ` : `
                    <p style="margin: 8px 0 0 0; font-style: italic; color: #bbb; font-size: 13px;">
                        This settlement has limited trade activity. Try checking availability again, or visit a larger settlement with more merchants.
                    </p>
                `}
            </div>
        `;
        
        // Insert right after the check availability button
        const checkButton = this.element.querySelector('#check-availability');
        if (checkButton && checkButton.parentElement) {
            checkButton.parentElement.insertAdjacentElement('afterend', alertDiv);
        }
    }

    /**
     * Generate a random trader name
     * @returns {string} - Random trader name
     * @private
     */
    _generateTraderName() {
        const names = [
            "Hans Müller", "Greta Schmidt", "Johann Weber", "Anna Bauer", "Friedrich Klein",
            "Maria Wagner", "Wilhelm Fischer", "Elisabeth Schneider", "Georg Hoffman", "Katharina Richter",
            "Heinrich Neumann", "Barbara Schwarz", "Karl Zimmermann", "Margarete Krüger", "Ludwig Hartmann"
        ];
        return names[Math.floor(Math.random() * names.length)];
    }



    /**
     * Update cargo display with available cargo
     * @param {Array} cargoList - List of available cargo
     * @private
     */
    _updateCargoDisplay(cargoList) {
        const cargoGrid = this.element.querySelector('#buying-cargo-grid');
        if (!cargoGrid) return;
        
        // Show the cargo grid
        cargoGrid.style.display = 'block';
        
        // Clear existing cargo cards
        cargoGrid.innerHTML = '';
        
        // Create cargo cards for each available cargo
        cargoList.forEach(cargo => {
            const cargoCard = this._createCargoCard(cargo);
            cargoGrid.appendChild(cargoCard);
        });
        
        this._logDebug('Cargo Display', `Updated cargo display with ${cargoList.length} items`);
    }

    /**
     * Hide cargo display
     * @private
     */
    _hideCargoDisplay() {
        const cargoGrid = this.element.querySelector('#buying-cargo-grid');
        if (cargoGrid) {
            cargoGrid.style.display = 'none';
        }
        
        const resultsDiv = this.element.querySelector('#availability-results');
        if (resultsDiv) {
            resultsDiv.style.display = 'none';
        }
    }

    /**
     * Create a cargo card element
     * @param {Object} cargo - Cargo data
     * @returns {HTMLElement} - Cargo card element
     * @private
     */
    _createCargoCard(cargo) {
        const card = document.createElement('div');
        card.className = 'cargo-card';
        
        card.innerHTML = `
            <div class="cargo-header">
                <div class="cargo-name">${cargo.name}</div>
                <div class="cargo-category">${cargo.category || 'Goods'}</div>
            </div>
            <div class="cargo-details">
                <div class="price-info">
                    <span class="price-label">Base Price:</span>
                    <span class="price-value">${cargo.currentPrice || cargo.basePrice} GC</span>
                </div>
                <div class="price-info">
                    <span class="price-label">Available:</span>
                    <span class="price-value">${cargo.quantity} EP</span>
                </div>
                <div class="price-info">
                    <span class="price-label">Quality:</span>
                    <span class="price-value">${cargo.quality || 'Average'}</span>
                </div>
                <div class="merchant-info">
                    <span class="merchant-label">Merchant:</span>
                    <span class="merchant-value">${cargo.merchant.name}</span>
                    <div class="merchant-description">${cargo.merchant.description}</div>
                    <div class="merchant-skill">Skill: ${cargo.merchant.skillDescription} (${cargo.merchant.skill})</div>
                </div>
            </div>
            <div class="cargo-actions">
                <input type="number" class="quantity-input" placeholder="Quantity (EP)" min="1" max="${cargo.quantity}">
                <button class="btn btn-primary" data-cargo="${cargo.name}">Buy</button>
            </div>
        `;
        
        // Add buy button event listener
        const buyButton = card.querySelector('.btn-primary');
        buyButton.addEventListener('click', () => {
            this._onBuyCargo(cargo);
        });
        
        return card;
    }

    /**
     * Handle buy cargo button click
     * @param {Object} cargo - Cargo data
     * @private
     */
    _onBuyCargo(cargo) {
        this._logDebug('Cargo Purchase', 'Buy button clicked', { cargo: cargo.name });
        ui.notifications.info(`Purchase functionality for ${cargo.name} will be implemented in future tasks.`);
    }

    // Placeholder event handlers for other functionality
    async _onPurchaseAttempt(event) {
        this._logDebug('Event Handler', 'Purchase attempt (placeholder)');
        ui.notifications.info('Purchase functionality will be implemented in future tasks.');
    }

    async _onSaleAttempt(event) {
        this._logDebug('Event Handler', 'Sale attempt (placeholder)');
        ui.notifications.info('Sale functionality will be implemented in future tasks.');
    }

    async _onHaggleAttempt(event) {
        this._logDebug('Event Handler', 'Haggle attempt (placeholder)');
        ui.notifications.info('Haggle functionality will be implemented in future tasks.');
    }

    _onQuantityChange(event) {
        this._logDebug('Event Handler', 'Quantity change (placeholder)');
    }

    async _onQualityChange(event) {
        this._logDebug('Event Handler', 'Quality change (placeholder)');
    }

    async _onDesperateSaleAttempt(event) {
        this._logDebug('Event Handler', 'Desperate sale attempt (placeholder)');
        ui.notifications.info('Desperate sale functionality will be implemented in future tasks.');
    }

    async _onRumorSaleAttempt(event) {
        this._logDebug('Event Handler', 'Rumor sale attempt (placeholder)');
        ui.notifications.info('Rumor sale functionality will be implemented in future tasks.');
    }

    _onClearDebugLog(event) {
        this._logDebug('Event Handler', 'Clear debug log (placeholder)');
        if (this.debugLogger) {
            this.debugLogger.clearLogs();
            this.render(false);
        }
    }

    // =============================================================================
    // NEW UNIFIED UI EVENT HANDLERS
    // =============================================================================

    /**
     * Handle region selection change
     * @param {Event} event - Change event
     * @private
     */
    _onRegionChange(event) {
        const selectedRegion = event.target.value;
        this._logDebug('Event Handler', 'Region changed to:', selectedRegion);
        
        // Clear validation errors when region changes
        this.clearValidationErrors('buying');
        this.clearValidationErrors('selling');
        
        // Update application state
        this.selectedRegion = selectedRegion;
        this.selectedSettlement = null;
        this.availableCargo = [];
        
        // Re-render to update the settlement dropdown with filtered settlements
        this.render(false);
        
        this._logDebug('Region Selection', `Region set to ${selectedRegion}, settlements will be filtered`);
    }

    /**
     * Handle sell quantity input change
     * @param {Event} event - Input event
     * @private
     */
    _onSellQuantityChange(event) {
        const quantity = parseInt(event.target.value);
        this._logDebug('Event Handler', 'Sell quantity changed to:', quantity);
        
        // Clear any previous errors
        this.clearValidationErrors('selling');
        
        // Show/hide selling buttons based on quantity
        const lookForSellersBtn = this.element.querySelector('#look-for-sellers');
        if (lookForSellersBtn) {
            if (quantity && quantity > 0) {
                lookForSellersBtn.style.display = 'flex';
                lookForSellersBtn.disabled = false;
            } else {
                lookForSellersBtn.style.display = 'none';
                lookForSellersBtn.disabled = true;
            }
        }
        
        // Hide other selling buttons until seller search is performed
        const negotiateSellBtn = this.element.querySelector('#negotiate-sell');
        const desperateSaleBtn = this.element.querySelector('#desperate-sale');
        if (negotiateSellBtn) negotiateSellBtn.style.display = 'none';
        if (desperateSaleBtn) desperateSaleBtn.style.display = 'none';
        
        // Hide selling results
        const sellingResults = this.element.querySelector('#selling-results');
        if (sellingResults) sellingResults.style.display = 'none';
    }

    /**
     * Handle look for sellers button click
     * @param {Event} event - Click event
     * @private
     */
    async _onLookForSellers(event) {
        this._logDebug('Event Handler', 'Look for sellers clicked');
        
        const quantity = parseInt(this.element.querySelector('#sell-quantity').value);
        
        if (!this.selectedSettlement) {
            this.showValidationError({ 
                valid: false, 
                error: 'Please select a settlement first',
                errorType: 'missing_settlement'
            }, 'selling');
            return;
        }
        
        if (!quantity || quantity <= 0) {
            ui.notifications.warn('Please enter a valid quantity');
            return;
        }
        
        // Validate settlement before proceeding
        const validation = this.validateSettlementWithFeedback(this.selectedSettlement, 'selling');
        if (!validation.valid) {
            return;
        }
        
        // Show loading state
        const button = event.target;
        const originalText = button.textContent;
        button.disabled = true;
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Searching...';
        
        try {
            // Use FoundryVTT dice roller for buyer search
            const rollFunction = async () => {
                const roll = new Roll("1d100");
                await roll.evaluate();
                
                // Show dice roll in chat if enabled
                const chatVisibility = game.settings.get("trading-places", "chatVisibility");
                if (chatVisibility !== "disabled") {
                    await roll.toMessage({
                        speaker: ChatMessage.getSpeaker(),
                        flavor: `Buyer Search for ${this.selectedResource} in ${this.selectedSettlement.name}`
                    });
                }
                
                console.log(`🎲 Buyer Search Roll: ${roll.total}`);
                return roll.total;
            };
            
            // Create mock purchase data (since we don't have actual purchase tracking yet)
            const purchaseData = {
                settlementName: 'Unknown', // Would be set from actual purchase
                purchaseTime: Date.now() - (24 * 60 * 60 * 1000), // Assume purchased 1 day ago
                totalCost: 0 // Would be set from actual purchase
            };
            
            // Perform complete sale check using trading engine
            const saleResult = await this.tradingEngine.performCompleteSaleCheck(
                this.selectedResource,
                quantity,
                this.selectedSettlement,
                purchaseData,
                {
                    season: this.currentSeason,
                    currentTime: Date.now()
                },
                rollFunction
            );
            
            // Display results based on sale check outcome
            this._showSaleResults(saleResult, quantity);
            
            // Show additional selling buttons if buyer was found
            if (saleResult.success) {
                const negotiateSellBtn = this.element.querySelector('#negotiate-sell');
                const desperateSaleBtn = this.element.querySelector('#desperate-sale');
                if (negotiateSellBtn) negotiateSellBtn.style.display = 'flex';
                if (desperateSaleBtn) desperateSaleBtn.style.display = 'flex';
            }
            
        } catch (error) {
            this._logError('Event Handler', 'Look for sellers failed', { error: error.message });
            ui.notifications.error(`Seller search failed: ${error.message}`);
        } finally {
            // Restore button
            button.disabled = false;
            button.innerHTML = '<i class="fas fa-search"></i> Look for Sellers';
        }
    }

    /**
     * Show sale results in the UI
     * @param {Object} saleResult - Result from performCompleteSaleCheck
     * @param {number} requestedQuantity - Original quantity requested for sale
     * @private
     */
    _showSaleResults(saleResult, requestedQuantity) {
        const sellingResults = this.element.querySelector('#selling-results');
        if (!sellingResults) return;
        
        let resultHtml = '';
        
        if (saleResult.success) {
            // SUCCESS: Buyer found
            const merchant = saleResult.buyerResult.merchant;
            const price = saleResult.salePrice;
            
            resultHtml = `
                <h4><i class="fas fa-handshake success-icon"></i> Buyer Found!</h4>
                <div class="buyer-details">
                    <div class="merchant-info">
                        <h5>Merchant Details</h5>
                        <p><strong>Name:</strong> ${merchant.name}</p>
                        <p><strong>Description:</strong> ${merchant.description}</p>
                        <p><strong>Skill Level:</strong> ${merchant.skillDescription} (${merchant.skill})</p>
                    </div>
                    <div class="sale-offer">
                        <h5>Sale Offer</h5>
                        <p><strong>Resource:</strong> ${saleResult.salePrice.cargoName}</p>
                        <p><strong>Quantity:</strong> ${saleResult.quantitySold} EP</p>
                        <p><strong>Base Price:</strong> ${price.basePricePerUnit} GC per 10 EP</p>
                        <p><strong>Final Price:</strong> ${price.finalPricePerUnit} GC per 10 EP</p>
                        <p><strong>Total Offer:</strong> ${price.totalPrice} GC</p>
                        ${price.modifiers && price.modifiers.length > 0 ? `
                            <div class="price-modifiers">
                                <strong>Price Modifiers:</strong>
                                <ul>
                                    ${price.modifiers.map(mod => `<li>${mod.description}</li>`).join('')}
                                </ul>
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;
            
            ui.notifications.info(`Buyer found! ${merchant.name} offers ${price.totalPrice} GC for your ${saleResult.salePrice.cargoName}`);
            
        } else {
            // FAILURE: No buyer found or other issues
            let failureReason = '';
            
            if (saleResult.step === 'eligibility') {
                failureReason = 'Sale not eligible: ' + saleResult.eligibilityCheck.errors.join(', ');
            } else if (saleResult.step === 'village_restrictions') {
                failureReason = saleResult.villageRestrictions.reason;
            } else if (saleResult.step === 'buyer_availability') {
                const buyerResult = saleResult.buyerResult;
                failureReason = buyerResult.reason || `No buyers available (rolled ${buyerResult.roll}/${buyerResult.chance})`;
                
                if (buyerResult.partialSaleOption) {
                    failureReason += '. You can try selling half the quantity and re-rolling.';
                }
            }
            
            resultHtml = `
                <h4><i class="fas fa-times-circle failure-icon"></i> No Buyer Found</h4>
                <p>${failureReason}</p>
                <p>You can try a different settlement, different quantity, or use special sale options.</p>
            `;
            
            ui.notifications.info(`No buyers found for ${this.selectedResource} in ${this.selectedSettlement.name}`);
        }
        
        sellingResults.innerHTML = resultHtml;
        sellingResults.style.display = 'block';
        
        this._logInfo('Sale Results', 'Displayed sale results', {
            success: saleResult.success,
            step: saleResult.step,
            quantityRequested: requestedQuantity,
            quantitySold: saleResult.quantitySold || 0
        });
    }

    /**
     * Handle negotiate sell button click
     * @param {Event} event - Click event
     * @private
     */
    async _onNegotiateSell(event) {
        this._logDebug('Event Handler', 'Negotiate sell clicked (placeholder)');
        ui.notifications.info('Negotiate sell functionality will be implemented in future tasks.');
    }

    /**
     * Handle desperate sale button click
     * @param {Event} event - Click event
     * @private
     * 
     */
    async _onDesperateSale(event) {
        this._logDebug('Event Handler', 'Desperate sale clicked (placeholder)');
        ui.notifications.info('Desperate sale functionality will be implemented in future tasks.');
    }

    /**
     * Handle negotiate buy button click
     * @param {Event} event - Click event
     * @private
     */
    async _onNegotiateBuy(event) {
        this._logDebug('Event Handler', 'Negotiate buy clicked (placeholder)');
        ui.notifications.info('Negotiate buy functionality will be implemented in future tasks.');
    }

    /**
     * Handle debug mode toggle
     * @param {Event} event - Change event
     * @private
     */
    _onDebugToggle(event) {
        const debugMode = event.target.checked;
        this._logDebug('Event Handler', 'Debug mode toggled:', debugMode);
        
        // Update debug logging setting
        if (game.settings) {
            game.settings.set("trading-places", "debugLogging", debugMode);
        }
        
        // Update debug logger if available
        if (this.debugLogger) {
            this.debugLogger.setEnabled(debugMode);
        }
    }

    /**
     * Update the selling tab based on current settlement selection
     * @private
     */
    _updateSellingTab() {
        if (!this.element) return;

        const resourceButtons = this.element.querySelector('#resource-buttons');
        const sellingEmptyState = this.element.querySelector('#selling-empty-state');
        const sellingInterface = this.element.querySelector('#selling-interface');

        if (!resourceButtons || !sellingEmptyState) return;

        // Always populate with ALL available trading resources from all settlements
        // This allows players to sell any cargo type they have, regardless of current settlement
        this._populateSellingResources();

        // Hide empty state since we always show resources
        sellingEmptyState.style.display = 'none';

        this._logDebug('Selling Tab', 'Updated selling options with all available resources');
    }

    /**
     * Show sale results in the UI
     * @param {Object} saleResult - Result from performCompleteSaleCheck
     * @param {number} requestedQuantity - Original quantity requested for sale
     * @private
     */
    _showSaleResults(saleResult, requestedQuantity) {
        const sellingResults = this.element.querySelector('#selling-results');
        if (!sellingResults) return;
        
        let resultHtml = '';
        
        if (saleResult.success) {
            // SUCCESS: Buyer found
            const merchant = saleResult.buyerResult.merchant;
            const price = saleResult.salePrice;
            
            resultHtml = `
                <h4><i class="fas fa-handshake success-icon"></i> Buyer Found!</h4>
                <div class="buyer-details">
                    <div class="merchant-info">
                        <h5>Merchant Details</h5>
                        <p><strong>Name:</strong> ${merchant.name}</p>
                        <p><strong>Description:</strong> ${merchant.description}</p>
                        <p><strong>Skill Level:</strong> ${merchant.skillDescription} (${merchant.skill})</p>
                    </div>
                    <div class="sale-offer">
                        <h5>Sale Offer</h5>
                        <p><strong>Resource:</strong> ${saleResult.salePrice.cargoName}</p>
                        <p><strong>Quantity:</strong> ${saleResult.quantitySold} EP</p>
                        <p><strong>Base Price:</strong> ${price.basePricePerUnit} GC per 10 EP</p>
                        <p><strong>Final Price:</strong> ${price.finalPricePerUnit} GC per 10 EP</p>
                        <p><strong>Total Offer:</strong> ${price.totalPrice} GC</p>
                        ${price.modifiers && price.modifiers.length > 0 ? `
                            <div class="price-modifiers">
                                <strong>Price Modifiers:</strong>
                                <ul>
                                    ${price.modifiers.map(mod => `<li>${mod.description}</li>`).join('')}
                                </ul>
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;
            
            ui.notifications.info(`Buyer found! ${merchant.name} offers ${price.totalPrice} GC for your ${saleResult.salePrice.cargoName}`);
            
        } else {
            // FAILURE: No buyer found or other issues
            let failureReason = '';
            
            if (saleResult.step === 'eligibility') {
                failureReason = 'Sale not eligible: ' + saleResult.eligibilityCheck.errors.join(', ');
            } else if (saleResult.step === 'village_restrictions') {
                failureReason = saleResult.villageRestrictions.reason;
            } else if (saleResult.step === 'buyer_availability') {
                const buyerResult = saleResult.buyerResult;
                failureReason = buyerResult.reason || `No buyers available (rolled ${buyerResult.roll}/${buyerResult.chance})`;
                
                if (buyerResult.partialSaleOption) {
                    failureReason += '. You can try selling half the quantity and re-rolling.';
                }
            }
            
            resultHtml = `
                <h4><i class="fas fa-times-circle failure-icon"></i> No Buyer Found</h4>
                <p>${failureReason}</p>
                <p>You can try a different settlement, different quantity, or use special sale options.</p>
            `;
            
            ui.notifications.info(`No buyers found for ${this.selectedResource} in ${this.selectedSettlement.name}`);
        }
        
        sellingResults.innerHTML = resultHtml;
        sellingResults.style.display = 'block';
        
        this._logInfo('Sale Results', 'Displayed sale results', {
            success: saleResult.success,
            step: saleResult.step,
            quantityRequested: requestedQuantity,
            quantitySold: saleResult.quantitySold || 0
        });
    }
}

// Export for global access
window.WFRPTradingApplication = WFRPTradingApplication;
console.log('Trading Places | WFRPTradingApplication class registered globally');

} // End of ApplicationV2 availability check