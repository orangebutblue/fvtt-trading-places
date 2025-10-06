console.log('Trading Places | Loading trading-application-v2.js');

import { TradingUIEventHandlers } from './ui/TradingUIEventHandlers.js';
import TradingUIRenderer from './ui/TradingUIRenderer.js';

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
        this.successfulCargo = [];
        this.transactionHistory = [];
        this.playerCargo = [];

        // Get module components with validation
        this.dataManager = window.WFRPRiverTrading?.getDataManager();
        this.tradingEngine = window.WFRPRiverTrading?.getTradingEngine();
        this.systemAdapter = window.WFRPRiverTrading?.getSystemAdapter();
        this.debugLogger = window.wfrpLogger;

        this.cargoAvailabilityPipeline = null;
        if (this.dataManager && typeof this.dataManager.getCargoAvailabilityPipeline === 'function') {
            try {
                this.cargoAvailabilityPipeline = this.dataManager.getCargoAvailabilityPipeline();
                this._logDebug('Pipeline', 'Cargo availability pipeline ready');
            } catch (error) {
                this._logError('Pipeline', 'Failed to initialize cargo availability pipeline', { error: error.message });
            }
        }

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
        this.eventHandlers = new TradingUIEventHandlers(this);
        this.renderer = new TradingUIRenderer(this);
    }

    // Apply mixins
    static {
        if (typeof window.WindowManagementMixin !== 'undefined') {
            Object.assign(WFRPTradingApplication.prototype, window.WindowManagementMixin);
        }
        if (typeof window.LoggingMixin !== 'undefined') {
            Object.assign(WFRPTradingApplication.prototype, window.LoggingMixin);
        }
        if (typeof window.ValidationMixin !== 'undefined') {
            Object.assign(WFRPTradingApplication.prototype, window.ValidationMixin);
        }
        if (typeof window.SeasonManagementMixin !== 'undefined') {
            Object.assign(WFRPTradingApplication.prototype, window.SeasonManagementMixin);
        }
        if (typeof window.SettlementSelectorMixin !== 'undefined') {
            Object.assign(WFRPTradingApplication.prototype, window.SettlementSelectorMixin);
        }
        if (typeof window.UIStateMixin !== 'undefined') {
            Object.assign(WFRPTradingApplication.prototype, window.UIStateMixin);
        }
        if (typeof window.ResourceManagementMixin !== 'undefined') {
            Object.assign(WFRPTradingApplication.prototype, window.ResourceManagementMixin);
        }
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

        // Load saved selections first
        await this._loadSavedSelections();

        // Add trading-specific data for templates
        context.currentSeason = this.getCurrentSeason();
        context.selectedSettlement = this.selectedSettlement;
        context.selectedRegion = this.selectedRegion || '';
    const successfulCargo = Array.isArray(this.successfulCargo) ? this.successfulCargo : [];
    context.availableCargo = successfulCargo;
    context.successfulCargo = successfulCargo;
    context.slotAvailabilityResults = this.availableCargo;
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
    context.hasCargo = successfulCargo.length > 0;
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
    const allCargoTypes = this.dataManager ? this.dataManager.getCargoTypes() : [];
    context.allCargoTypes = allCargoTypes;
    // Filter out "Trade" as it's not a sellable resource
    context.sellableCargoTypes = allCargoTypes.filter(cargo => cargo.name !== 'Trade');

        this._logDebug('Template Context', 'Context prepared successfully', {
            settlements: context.settlements.length,
            availableCargo: successfulCargo.length,
            slotResults: context.slotAvailabilityResults?.length || 0,
            successfulCargo: successfulCargo.length,
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

        // Initialize application state after render
        this._initializeApplicationState();
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
     * Load saved region and settlement selections from settings
     * @private
     */
    async _loadSavedSelections() {
        try {
            // Load saved region
            const savedRegion = await game.settings.get("trading-places", "selectedRegion");
            if (savedRegion) {
                this.selectedRegion = savedRegion;
                this._logDebug('Saved Selections', 'Loaded saved region', { region: savedRegion });
            }

            // Load saved settlement
            const savedSettlementName = await game.settings.get("trading-places", "selectedSettlement");
            if (savedSettlementName && this.dataManager) {
                const settlement = this.dataManager.getSettlement(savedSettlementName);
                if (settlement) {
                    this.selectedSettlement = settlement;
                    this._logDebug('Saved Selections', 'Loaded saved settlement', { settlement: savedSettlementName });
                } else {
                    this._logError('Saved Selections', 'Saved settlement not found in data', { settlementName: savedSettlementName });
                    // Clear invalid saved settlement
                    await game.settings.set("trading-places", "selectedSettlement", null);
                }
            }

        } catch (error) {
            this._logError('Saved Selections', 'Failed to load saved selections', { error: error.message });
        }
    }

    /**
     * Update seasonal pricing for all displayed cargo
     * @private
     */
    async _updateCargoPricing() {
        const tradableCargo = this.availableCargo.filter(cargo => cargo?.isSlotAvailable);
        if (!this.currentSeason || tradableCargo.length === 0) {
            return;
        }

        try {
            this._logDebug('Pricing Update', 'Updating cargo pricing for season change');

            // Recalculate prices for all available cargo
            this.availableCargo = this.availableCargo.map(cargo => {
                if (!cargo?.isSlotAvailable) {
                    return cargo;
                }
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

            this.successfulCargo = this.availableCargo.filter(cargo => cargo?.isSlotAvailable);

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





    /** @override */
    _attachPartListeners(partId, htmlElement, options) {
        super._attachPartListeners(partId, htmlElement, options);
        this.eventHandlers._attachPartListeners(partId, htmlElement, options);
    }



    // =============================================================================
    // CARGO DISPLAY HELPER METHODS - FIX FOR PROBLEM 2
    // =============================================================================








}

// Export for global access
window.WFRPTradingApplication = WFRPTradingApplication;
console.log('Trading Places | WFRPTradingApplication class registered globally');

} // End of ApplicationV2 availability check