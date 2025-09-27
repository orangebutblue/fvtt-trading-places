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
    
class WFRPTradingApplication extends foundry.applications.api.ApplicationV2 {

    /** @override */
    static DEFAULT_OPTIONS = {
        id: "wfrp-trading",
        tag: "div",
        window: {
            title: "Trading Places",
            icon: "fas fa-coins",
            resizable: true,
            minimizable: true,
            maximizable: false
        },
        position: {
            width: 1600,
            height: 800,
            top: 100,
            left: 100
        },
        classes: ["wfrp-trading", "application-v2"]
    };

    /** @override */
    static PARTS = {
        header: {
            template: "modules/trading-places/templates/trading-header.hbs",
            scrollable: []
        },
        content: {
            template: "modules/trading-places/templates/trading-content.hbs",
            scrollable: [".settlement-section", ".cargo-section"]
        },
        footer: {
            template: "modules/trading-places/templates/trading-footer.hbs",
            scrollable: [".debug-log-display"]
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
        this.selectedSettlement = null;
        this.selectedCargo = null;
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
        if (this.debugLogger) {
            this.debugLogger.logInfo(category, message, data);
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
        if (this.debugLogger) {
            this.debugLogger.logError(category, message, data);
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
        if (this.debugLogger) {
            this.debugLogger.logDebug(category, message, data);
        } else {
            console.debug(`Trading Places | ${category}: ${message}`, data);
        }
    }

    /** @override */
    async _prepareContext(options) {
        const context = await super._prepareContext(options);

        this._logDebug('Template Context', 'Preparing template context data');

        // Add trading-specific data for templates
        context.currentSeason = this.getCurrentSeason();
        context.selectedSettlement = this.selectedSettlement;
        context.availableCargo = this.availableCargo;
        context.transactionHistory = this.transactionHistory;
        context.playerCargo = this.playerCargo;
        context.settlements = this.dataManager?.getAllSettlements() || [];

        // Add UI state data
        context.hasSettlement = !!this.selectedSettlement;
        context.hasCargo = this.availableCargo.length > 0;
        context.hasSeason = !!this.currentSeason;
        context.hasPlayerCargo = this.playerCargo.length > 0;

        // Add configuration data
        context.debugLoggingEnabled = game.settings.get("trading-places", "debugLogging");
        context.chatVisibility = game.settings.get("trading-places", "chatVisibility");

        this._logDebug('Template Context', 'Context prepared successfully', {
            settlements: context.settlements.length,
            availableCargo: context.availableCargo.length,
            transactionHistory: context.transactionHistory.length,
            currentSeason: context.currentSeason
        });

        return context;
    }

    /** @override */
    _onRender(context, options) {
        super._onRender(context, options);

        this._logInfo('Application Lifecycle', 'Application rendered successfully');

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
    async _onCheckAvailability(event) {
        if (!this.selectedSettlement) {
            ui.notifications.warn('Please select a settlement first.');
            return;
        }

        if (!this.currentSeason) {
            ui.notifications.warn('Please set the current season first.');
            return;
        }

        try {
            this._logInfo('Cargo Availability', 'Starting availability check', {
                settlement: this.selectedSettlement.name,
                season: this.currentSeason
            });

            // Show loading state
            const button = event.target;
            const originalText = button.textContent;
            button.textContent = 'Checking...';
            button.disabled = true;

            // Perform availability check
            const result = await this.tradingEngine.performCompleteAvailabilityCheck(
                this.selectedSettlement,
                this.currentSeason
            );

            this._logInfo('Cargo Availability', 'Availability check completed', result);

            if (result.available) {
                // Update available cargo
                this.availableCargo = result.cargoTypes.map(cargoName => ({
                    name: cargoName,
                    category: this.tradingEngine.getCargoByName(cargoName).category,
                    currentPrice: this.tradingEngine.calculateBasePrice(cargoName, this.currentSeason),
                    availableQuantity: result.cargoSize.totalSize
                }));

                await this.render(false);
                ui.notifications.info(`Cargo available! Found ${result.cargoTypes.length} type(s).`);
            } else {
                this.availableCargo = [];
                await this.render(false);
                ui.notifications.info('No cargo available at this settlement.');
            }

            // Restore button
            button.textContent = originalText;
            button.disabled = false;

        } catch (error) {
            this._logError('Event Handler', 'Availability check failed', { error: error.message });
            ui.notifications.error(`Availability check failed: ${error.message}`);

            // Restore button on error
            const button = event.target;
            button.textContent = 'Check Cargo Availability';
            button.disabled = false;
        }
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
}

// Export for global access
window.WFRPTradingApplication = WFRPTradingApplication;
console.log('Trading Places | WFRPTradingApplication class registered globally');

} // End of ApplicationV2 availability check