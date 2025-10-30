console.log('Trading Places | Loading trading-application-v2.js');

const MODULE_ID = "fvtt-trading-places";

import { TradingUIEventHandlers } from './ui/TradingUIEventHandlers.js';
import TradingUIRenderer from './ui/TradingUIRenderer.js';
import { CargoDistributionCharts } from './cargo-distribution-charts.js';
import { TradingPlacesSettings } from './module-settings.js';
import {
    resolveCurrencyContext,
    augmentTransaction,
    formatDenominationValue,
    formatCanonicalValue,
    convertDenominationToCanonical
} from './currency-display.js';

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
    console.warn('Trading Places | ApplicationV2 not available, TradingPlacesApplication will not be loaded');
    // Don't define the class if ApplicationV2 isn't available
} else {
    console.log('Trading Places | ApplicationV2 available, defining TradingPlacesApplication');
    
class TradingPlacesApplication extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2) {

    /** @override */
    static get DEFAULT_OPTIONS() {
        const baseClasses = ["trading-places", "application-v2", "modern-trading"];
        let compactMode = false;
        
        // Add compact mode class if enabled
        try {
            compactMode = TradingPlacesSettings.getSetting('compactMode');
            if (compactMode) {
                baseClasses.push("compact-mode");
            }
        } catch (error) {
            // Settings not available yet, skip compact mode
        }
        
        return {
            id: "trading-places",
            tag: "div",
            window: {
                title: "Trading Places",
                icon: "fas fa-coins",
                resizable: true,
                minimizable: true,
                maximizable: true
            },
            position: {
                width: compactMode ? 1000 : 1200,
                height: compactMode ? 600 : 800,
                top: 50,
                left: 50
            },
            classes: baseClasses
        };
    }

    /** @override */
    static PARTS = {
        content: {
            template: `modules/${MODULE_ID}/templates/trading-unified.hbs`
        }
    };

    /**
     * Constructor for TradingPlacesApplication
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
    this.sellerOffers = null;

        // Get module components with validation
        this.dataManager = window.TradingPlaces?.getDataManager();
        this.tradingEngine = window.TradingPlaces?.getTradingEngine();
        this.systemAdapter = window.TradingPlaces?.getSystemAdapter();
        this.debugLogger = window.TPMLogger;

        this.cargoAvailabilityPipeline = null;
        // Initialize pipeline asynchronously
        this._initializeCargoAvailabilityPipeline();

        // Initialize cargo distribution charts (will be initialized after pipeline is ready)
        this.cargoDistributionCharts = null;

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
            
            // NOTE: Region dropdown is already populated by the template via _prepareContext
            // which includes all regions (built-in and custom). No need to repopulate here.
            // The delayed repopulation was causing the selected region to be reset after render.
        } else {
            console.warn('Trading Places | SettlementSelector not available, some features may be limited');
            this.settlementSelector = null;
        }

        this._logInfo('Application Initialization', 'TradingPlacesApplication created successfully');

        // Initialize window management
        this._initializeWindowManagement();
        this.eventHandlers = new TradingUIEventHandlers(this);
        this.renderer = new TradingUIRenderer(this);
    }

    // Apply mixins
    static {
        if (typeof window.WindowManagementMixin !== 'undefined') {
            Object.assign(TradingPlacesApplication.prototype, window.WindowManagementMixin);
        }
        if (typeof window.LoggingMixin !== 'undefined') {
            Object.assign(TradingPlacesApplication.prototype, window.LoggingMixin);
        }
        if (typeof window.ValidationMixin !== 'undefined') {
            Object.assign(TradingPlacesApplication.prototype, window.ValidationMixin);
        }
        if (typeof window.SeasonManagementMixin !== 'undefined') {
            Object.assign(TradingPlacesApplication.prototype, window.SeasonManagementMixin);
        }
        if (typeof window.SettlementSelectorMixin !== 'undefined') {
            Object.assign(TradingPlacesApplication.prototype, window.SettlementSelectorMixin);
        }
        if (typeof window.UIStateMixin !== 'undefined') {
            Object.assign(TradingPlacesApplication.prototype, window.UIStateMixin);
        }
        if (typeof window.ResourceManagementMixin !== 'undefined') {
            Object.assign(TradingPlacesApplication.prototype, window.ResourceManagementMixin);
        }
    }




    /**
     * Static factory method to create and render trading application
     * @param {Object} options - Application options
     * @returns {TradingPlacesApplication} - Created application instance
     */
    static async create(options = {}) {
        const app = new TradingPlacesApplication(options);
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

    _getCurrencyContext() {
        if (!this.dataManager) {
            console.warn('💰 _getCurrencyContext: dataManager not available');
            return null;
        }
        const context = resolveCurrencyContext(this.dataManager);
        if (!context) {
            console.warn('💰 _getCurrencyContext: Failed to resolve currency context');
        }
        return context;
    }

    _formatCurrencyFromDenomination(value, defaultText = 'N/A') {
        const context = this._getCurrencyContext();
        return formatDenominationValue(value, context, { defaultText });
    }

    _formatCurrencyFromCanonical(value, defaultText = 'N/A') {
        const context = this._getCurrencyContext();
        return formatCanonicalValue(value, context, { defaultText });
    }

    _convertDenominationToCanonical(value) {
        const context = this._getCurrencyContext();
        return convertDenominationToCanonical(value, context);
    }

    _coerceNumber(value) {
        if (typeof value === 'number') {
            return Number.isFinite(value) ? value : null;
        }
        if (typeof value === 'string') {
            const parsed = Number(value);
            return Number.isFinite(parsed) ? parsed : null;
        }
        return null;
    }

    _prepareCurrencyRecord(record, { deriveTotalFromQuantity = false } = {}) {
        if (!record || typeof record !== 'object') {
            return record;
        }

        const context = this._getCurrencyContext();
        console.log('💱 _prepareCurrencyRecord called', {
            hasCargo: !!record.cargo,
            hasContext: !!context,
            pricePerEP: record.pricePerEP,
            totalCost: record.totalCost,
            alreadyFormatted: {
                price: !!record.formattedPricePerEP,
                total: !!record.formattedTotalCost
            }
        });
        const normalized = { ...record };

        const quantity = this._coerceNumber(normalized.quantity);
        if (quantity !== null) {
            normalized.quantity = quantity;
        }

        const pricePerEP = this._coerceNumber(normalized.pricePerEP);
        if (pricePerEP !== null) {
            normalized.pricePerEP = pricePerEP;
        }

        const totalCost = this._coerceNumber(normalized.totalCost);
        if (totalCost !== null) {
            normalized.totalCost = totalCost;
        } else if (deriveTotalFromQuantity && pricePerEP !== null && quantity !== null) {
            normalized.totalCost = pricePerEP * quantity;
        }

        if (context) {
            if (typeof normalized.pricePerEPCanonical !== 'number' && pricePerEP !== null) {
                const canonicalPrice = this._convertDenominationToCanonical(pricePerEP);
                if (typeof canonicalPrice === 'number') {
                    normalized.pricePerEPCanonical = canonicalPrice;
                }
            }

            if (typeof normalized.totalCostCanonical !== 'number' && typeof normalized.totalCost === 'number') {
                const canonicalTotal = this._convertDenominationToCanonical(normalized.totalCost);
                if (typeof canonicalTotal === 'number') {
                    normalized.totalCostCanonical = canonicalTotal;
                }
            }

            augmentTransaction(normalized, context);

            if (typeof normalized.formattedPricePerEP !== 'string') {
                if (typeof normalized.pricePerEPCanonical === 'number') {
                    normalized.formattedPricePerEP = this._formatCurrencyFromCanonical(normalized.pricePerEPCanonical);
                } else if (typeof normalized.pricePerEP === 'number') {
                    normalized.formattedPricePerEP = this._formatCurrencyFromDenomination(normalized.pricePerEP);
                }
            }

            if (typeof normalized.formattedTotalCost !== 'string' && typeof normalized.totalCost === 'number') {
                if (typeof normalized.totalCostCanonical === 'number') {
                    normalized.formattedTotalCost = this._formatCurrencyFromCanonical(normalized.totalCostCanonical);
                } else {
                    normalized.formattedTotalCost = this._formatCurrencyFromDenomination(normalized.totalCost);
                }
            }
        }

        console.log('💱 _prepareCurrencyRecord result', {
            cargo: normalized.cargo,
            formattedPricePerEP: normalized.formattedPricePerEP,
            formattedTotalCost: normalized.formattedTotalCost,
            pricePerEP: normalized.pricePerEP,
            totalCost: normalized.totalCost
        });

        return normalized;
    }

    _prepareTransactionHistory(history = []) {
        if (!Array.isArray(history)) {
            return [];
        }

        return history.map(entry => this._prepareCurrencyRecord(entry, { deriveTotalFromQuantity: true }));
    }

    _prepareCurrentCargoList(cargoList = []) {
        if (!Array.isArray(cargoList)) {
            return [];
        }

        return cargoList.map(cargo => this._prepareCurrencyRecord(cargo, { deriveTotalFromQuantity: true }));
    }

    /**
     * Initialize cargo availability pipeline asynchronously
     * @private
     */
    async _initializeCargoAvailabilityPipeline() {
        if (!this.dataManager) {
            return;
        }

        try {
            // Import and create the pipeline instance
            const { CargoAvailabilityPipeline } = await import('./cargo-availability-pipeline.js');
            this.cargoAvailabilityPipeline = new CargoAvailabilityPipeline(this.dataManager);
            this._logDebug('Pipeline', 'Cargo availability pipeline ready');

            // Now that pipeline is ready, initialize cargo distribution charts
            if (this.dataManager && !this.cargoDistributionCharts) {
                try {
                    this.cargoDistributionCharts = new CargoDistributionCharts(this.dataManager, this.cargoAvailabilityPipeline);
                    this._logDebug('Charts', 'Cargo distribution charts ready');
                    
                    // Update charts now that they're initialized (if UI is already rendered)
                    if (this.selectedSettlement && this.currentSeason) {
                        this._updateCargoDistributionCharts();
                    }
                } catch (error) {
                    this._logError('Charts', 'Failed to initialize cargo distribution charts', { error: error.message });
                }
            }
        } catch (error) {
            this._logError('Pipeline', 'Failed to initialize cargo availability pipeline', { error: error.message });
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

        // Load saved selections first (including cargo data)
        await this._loadSavedSelections();

        // Load season before trying to load cargo
        await this._loadCurrentSeason();

        console.log('🔄 CARGO PERSISTENCE: In _prepareContext, settlement and season loaded', {
            hasSettlement: !!this.selectedSettlement,
            settlementName: this.selectedSettlement?.name,
            hasSeason: !!this.currentSeason,
            season: this.currentSeason
        });

        // Load cargo availability data if settlement and season are selected
        if (this.selectedSettlement && this.currentSeason) {
            console.log('🔄 CARGO PERSISTENCE: Loading cargo data in _prepareContext');
            await this._loadAndRestoreCargoAvailability();
            
            // Note: Seller offers restoration moved to _onRender to ensure DOM is ready
        } else {
            console.log('🔄 CARGO PERSISTENCE: Not loading cargo data - missing settlement or season');
        }

        // Add trading-specific data for templates
        context.currentSeason = this.getCurrentSeason();
        context.selectedSettlement = this.selectedSettlement;
        context.selectedRegion = this.selectedRegion || '';
    const successfulCargo = Array.isArray(this.successfulCargo) ? this.successfulCargo : [];
    const availableCargo = Array.isArray(this.availableCargo) ? this.availableCargo : [];
    context.availableCargo = availableCargo;
    context.successfulCargo = successfulCargo;
    context.slotAvailabilityResults = availableCargo;
        this.transactionHistory = this._prepareTransactionHistory(this.transactionHistory || []);
        context.transactionHistory = this.transactionHistory;
        console.log('🎨 Template context - transactionHistory:', {
            length: this.transactionHistory?.length || 0,
            firstTransaction: this.transactionHistory?.[0] || null,
            allTransactions: this.transactionHistory || []
        });
        context.playerCargo = this.playerCargo;

        // Cargo data for the cargo tab - ALWAYS reload from DataManager to ensure fresh data
        context.currentCargo = await this._getCurrentCargoData();
        // Also update the app instance with the loaded data
        this.currentCargo = context.currentCargo;
        console.log('🚛 CARGO DEBUG: Loaded currentCargo from DataManager', {
            length: context.currentCargo.length,
            firstItem: context.currentCargo[0]
        });
        context.cargoCapacity = await game.settings.get(MODULE_ID, "cargoCapacity") || 400;
        context.currentLoad = this._calculateCurrentLoad(context.currentCargo);
        context.capacityPercentage = Math.min((context.currentLoad / context.cargoCapacity) * 100, 100);
        context.isOverCapacity = context.currentLoad > context.cargoCapacity;
        
        // Debug logging for cargo data
        console.log('🚛 CARGO DEBUG: Cargo data prepared for template', {
            currentCargoLength: context.currentCargo?.length || 0,
            cargoCapacity: context.cargoCapacity,
            currentLoad: context.currentLoad,
            capacityPercentage: context.capacityPercentage,
            isOverCapacity: context.isOverCapacity,
            currentCargo: context.currentCargo
        });

        console.log('🔄 CARGO PERSISTENCE: Context prepared with cargo data', {
            successfulCargoCount: successfulCargo.length,
            availableCargoCount: availableCargo.length,
            firstSuccessfulCargo: successfulCargo[0] ? {
                name: successfulCargo[0].name,
                quantity: successfulCargo[0].quantity,
                hasFailed: successfulCargo[0].hasFailed
            } : null,
            firstAvailableCargo: availableCargo[0] ? {
                name: availableCargo[0].name,
                quantity: availableCargo[0].quantity,
                hasFailed: availableCargo[0].hasFailed
            } : null
        });
        
        // Get all settlements and filter by region if one is selected
        const allSettlements = this.dataManager?.getAllSettlements() || [];
        context.settlements = this.selectedRegion 
            ? allSettlements.filter(s => s.region === this.selectedRegion)
            : [];
        context.allSettlements = allSettlements;

        // Get all unique regions for the region dropdown
        const allRegions = [...new Set(allSettlements.map(s => s.region))].sort();
        context.allRegions = allRegions;

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
        context.debugLoggingEnabled = game.settings.get(MODULE_ID, "debugLogging");
        context.chatVisibility = game.settings.get(MODULE_ID, "chatVisibility");
        context.isGM = game.user.isGM;

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

        console.log('🔄 CARGO PERSISTENCE: Final context for template', {
            availableCargoLength: context.availableCargo.length,
            successfulCargoLength: context.successfulCargo.length,
            hasCargoData: context.availableCargo.length > 0,
            firstAvailableCargo: context.availableCargo[0] ? {
                name: context.availableCargo[0].name,
                isSlotAvailable: context.availableCargo[0].isSlotAvailable,
                quantity: context.availableCargo[0].quantity,
                currentPrice: context.availableCargo[0].currentPrice,
                category: context.availableCargo[0].category,
                hasFailure: !!context.availableCargo[0].failure
            } : null
        });

        return context;
    }

    // ===== CARGO MANAGEMENT METHODS =====

    /**
     * Get current cargo data for the cargo tab
     * @returns {Array} Current cargo array with formatted data
     * @private
     */
    async _getCurrentCargoData() {
        try {
            console.log('🚛 CARGO_PERSIST: Loading cargo from DataManager for display');
            const currentCargo = this.dataManager?.cargo || [];
            
            console.log('🚛 CARGO_PERSIST: Raw cargo data from DataManager', {
                length: currentCargo.length,
                data: currentCargo
            });
            
            const processedCargo = this._prepareCurrentCargoList(currentCargo);
            
            console.log('🚛 CARGO_PERSIST: Processed cargo data', {
                length: processedCargo.length,
                data: processedCargo
            });
            
            return processedCargo;
        } catch (error) {
            this._logError('Cargo Management', 'Failed to load current cargo data', { error: error.message });
            return [];
        }
    }

    /**
     * Calculate current load from cargo data
     * @param {Array} cargoData - Current cargo array
     * @returns {number} Total EP currently loaded
     * @private
     */
    _calculateCurrentLoad(cargoData) {
        if (!Array.isArray(cargoData)) return 0;
        
        return cargoData.reduce((total, cargo) => {
            return total + (cargo.quantity || 0);
        }, 0);
    }

    /** @override */
    _onRender(context, options) {
        super._onRender(context, options);

        this._logInfo('Application Lifecycle', 'Application rendered successfully');

        // Debug: Log the actual HTML structure
        console.log('Trading Places | Application element:', this.element);
        console.log('Trading Places | Application classes:', this.element?.className);
        console.log('Trading Places | Parent element:', this.element?.parentElement);
        console.log('Trading Places | Window element:', this.element?.closest('.app'));
        
        // Force background styles for debugging
        if (this.element) {
            this.element.style.backgroundColor = '#2c2c2c';
            this.element.style.border = '2px solid #333';
            console.log('Trading Places | Forced styles applied to element');
            
            const windowElement = this.element.closest('.app');
            if (windowElement) {
                windowElement.style.backgroundColor = '#2c2c2c';
                windowElement.style.border = '2px solid #333';
                console.log('Trading Places | Forced styles applied to window element');
            }
        }

        // Set up window management listeners
        this._setupWindowEventListeners();

        // Initialize application state after render
        this._initializeApplicationState();
        
        // Update cargo distribution charts after render
        this._updateCargoDistributionCharts();
        
        // Restore seller offers if they exist (after DOM is ready)
        this._restoreSellerOffersAfterRender();
    }

    /**
     * Update cargo distribution charts when settlement or season changes
     */
    _updateCargoDistributionCharts() {
        if (!this.cargoDistributionCharts || !this.cargoAvailabilityPipeline) {
            // Pipeline not ready yet, charts will be updated when pipeline initializes
            return;
        }

        // Only update charts if the containers exist in the DOM
        if (document.getElementById('buying-cargo-distribution-chart') && 
            document.getElementById('selling-cargo-distribution-chart')) {
            try {
                this.cargoDistributionCharts.updateCharts(this.selectedSettlement, this.currentSeason);
                this._logDebug('Charts', 'Cargo distribution charts updated', { 
                    settlement: this.selectedSettlement?.name,
                    season: this.currentSeason 
                });
            } catch (error) {
                this._logError('Charts', 'Failed to update cargo distribution charts', { error: error.message });
            }
        } else {
            // Retry after a longer delay if containers don't exist yet
            setTimeout(() => {
                if (document.getElementById('buying-cargo-distribution-chart') && 
                    document.getElementById('selling-cargo-distribution-chart')) {
                    try {
                        this.cargoDistributionCharts.updateCharts(this.selectedSettlement, this.currentSeason);
                        this._logDebug('Charts', 'Cargo distribution charts updated (delayed)', { 
                            settlement: this.selectedSettlement?.name,
                            season: this.currentSeason 
                        });
                    } catch (error) {
                        this._logError('Charts', 'Failed to update cargo distribution charts (delayed)', { error: error.message });
                    }
                }
            }, 200);
        }
    }

    /**
     * Restore seller offers after DOM is fully rendered
     * @private
     */
    async _restoreSellerOffersAfterRender() {
        try {
            // Only restore if we have settlement and season selected
            if (!this.selectedSettlement || !this.currentSeason) {
                return;
            }

            // Ensure eventHandlers and sellingFlow are available
            if (!this.eventHandlers || !this.eventHandlers.sellingFlow) {
                console.log('🔄 SELLER PERSISTENCE: SellingFlow not available for restoration');
                return;
            }

            console.log('🔄 SELLER PERSISTENCE: Attempting to restore seller offers after render');
            await this.eventHandlers.sellingFlow.restoreSellerOffers();
            
        } catch (error) {
            console.error('🔄 SELLER PERSISTENCE: Failed to restore seller offers after render', error);
            this._logError('Seller Persistence', 'Failed to restore seller offers after render', { error: error.message });
        }
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
        await game.settings.set(MODULE_ID, "currentSeason", season);

        // Clear cargo availability data when season changes (prices/availability may change)
        await this._clearCargoAvailability();
        this.availableCargo = [];
        this.successfulCargo = [];
        
        // Also clear seller offers when season changes
        this.sellerOffers = null;
        if (this.eventHandlers && this.eventHandlers.sellingFlow) {
            await this.eventHandlers.sellingFlow._clearSellerOffers();
        }

        // Update pricing for any selected cargo
        if (this.selectedCargo) {
            await this._updateCargoPricing();
        }

        // Update button states
        this._updateTransactionButtons();

        // Note: Season change notification handled by SeasonManagementMixin, not here to avoid duplicates

        this._logInfo('Season Management', `Season successfully changed to: ${season}`);
    }

    /**
     * Load current season from settings
     * @private
     */
    async _loadCurrentSeason() {
        try {
            this.currentSeason = await game.settings.get(MODULE_ID, "currentSeason");

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
            const savedRegion = await game.settings.get(MODULE_ID, "selectedRegion");
            if (savedRegion) {
                this.selectedRegion = savedRegion;
                this._logDebug('Saved Selections', 'Loaded saved region', { region: savedRegion });
            }

            // Load saved settlement
            const savedSettlementName = await game.settings.get(MODULE_ID, "selectedSettlement");
            if (savedSettlementName && this.dataManager) {
                const settlement = this.dataManager.getSettlement(savedSettlementName);
                if (settlement) {
                    this.selectedSettlement = settlement;
                    this._logDebug('Saved Selections', 'Loaded saved settlement', { settlement: savedSettlementName });
                } else {
                    this._logError('Saved Selections', 'Saved settlement not found in data', { settlementName: savedSettlementName });
                    // Clear invalid saved settlement
                    await game.settings.set(MODULE_ID, "selectedSettlement", null);
                }
            }

            // Load saved transaction history from DataManager
            console.log('🚛 CARGO_PERSIST: Loading transaction history from DataManager');
            const savedTransactionHistory = this.dataManager?.history || [];
            if (savedTransactionHistory && Array.isArray(savedTransactionHistory)) {
                this.transactionHistory = this._prepareTransactionHistory(savedTransactionHistory);
                console.log('🚛 CARGO_PERSIST: Loaded transaction history', { 
                    transactionCount: this.transactionHistory.length 
                });
                this._logDebug('Saved Selections', 'Loaded saved transaction history', { 
                    transactionCount: this.transactionHistory.length 
                });
            } else {
                this.transactionHistory = [];
                console.log('🚛 CARGO_PERSIST: No transaction history found, initialized empty array');
                this._logDebug('Saved Selections', 'No saved transaction history found, initialized empty array');
            }

        } catch (error) {
            this._logError('Saved Selections', 'Failed to load saved selections', { error: error.message });
        }
    }

    /**
     * Load and restore cargo availability data for current settlement/season
     * @private
     */
    async _loadAndRestoreCargoAvailability() {
        try {
            console.log('🔄 CARGO PERSISTENCE: Starting cargo restoration');
            const cargoData = await this._loadCargoAvailability();

            if (cargoData) {
                console.log('🔄 CARGO PERSISTENCE: Loaded cargo data:', {
                    settlement: cargoData.settlement,
                    season: cargoData.season,
                    availableCargoCount: cargoData.availableCargo?.length || 0,
                    successfulCargoCount: cargoData.successfulCargo?.length || 0,
                    firstAvailableCargo: cargoData.availableCargo?.[0] ? {
                        name: cargoData.availableCargo[0].name,
                        isSlotAvailable: cargoData.availableCargo[0].isSlotAvailable,
                        hasFailure: !!cargoData.availableCargo[0].failure,
                        failureMessage: cargoData.availableCargo[0].failure?.message,
                        quantity: cargoData.availableCargo[0].quantity,
                        currentPrice: cargoData.availableCargo[0].currentPrice,
                        category: cargoData.availableCargo[0].category
                    } : null
                });
                this.availableCargo = cargoData.availableCargo || [];
                this.successfulCargo = cargoData.successfulCargo || [];

                this.lastPipelineResult = cargoData.pipelineResult || null;
                this.lastAvailabilityResult = cargoData.availabilityResult || null;

                this._logInfo('Cargo Persistence', 'Restored cargo availability data', {
                    settlement: cargoData.settlement,
                    season: cargoData.season,
                    cargoCount: this.successfulCargo.length
                });


                // Note: UI renderer will be updated in _initializeApplicationState after DOM is ready
            } else {
                console.log('🔄 CARGO PERSISTENCE: No cargo data to restore');
                // Clear any existing cargo data if no valid saved data
                this.availableCargo = [];
                this.successfulCargo = [];
                this.lastPipelineResult = null;
                this.lastAvailabilityResult = null;
            }

        } catch (error) {
            console.error('🔄 CARGO PERSISTENCE: Failed to load and restore cargo availability', error);
            this._logError('Cargo Persistence', 'Failed to load and restore cargo availability', { error: error.message });
            this.availableCargo = [];
            this.successfulCargo = [];
            this.lastPipelineResult = null;
            this.lastAvailabilityResult = null;
        }
    }

    /**
     * Save cargo availability data to game settings
     * @param {Array} availableCargo - Available cargo array
     * @param {Array} successfulCargo - Successful cargo array
     * @param {Object} pipelineResult - Pipeline result data
     * @param {Object} availabilityResult - Availability check result
     * @private
     */
    async _saveCargoAvailability(availableCargo, successfulCargo, pipelineResult, availabilityResult) {
        try {
            if (!this.selectedSettlement || !this.currentSeason) {
                console.log('🔄 CARGO PERSISTENCE: Cannot save - missing settlement or season');
                this._logDebug('Cargo Persistence', 'Cannot save cargo availability - missing settlement or season');
                return;
            }

            const datasetId = this.dataManager?.activeDatasetName || 'default';
            const cargoData = {
                settlement: this.selectedSettlement.name,
                season: this.currentSeason,
                timestamp: Date.now(),
                availableCargo: availableCargo,
                successfulCargo: successfulCargo,
                pipelineResult: pipelineResult,
                availabilityResult: availabilityResult
            };

            console.log('🔄 CARGO PERSISTENCE: Saving cargo data', {
                dataset: datasetId,
                settlement: this.selectedSettlement.name,
                season: this.currentSeason,
                availableCargoCount: availableCargo?.length || 0,
                successfulCargoCount: successfulCargo?.length || 0
            });

            // Get existing cargo availability data and add/update this entry
            const allCargoData = await game.settings.get(MODULE_ID, "cargoAvailabilityData") || {};
            if (!allCargoData[datasetId]) {
                allCargoData[datasetId] = {};
            }
            const storageKey = `${this.selectedSettlement.name}_${this.currentSeason}`;

            allCargoData[datasetId][storageKey] = cargoData;

            await game.settings.set(MODULE_ID, "cargoAvailabilityData", allCargoData);

            console.log('🔄 CARGO PERSISTENCE: Cargo data saved successfully');

            this._logDebug('Cargo Persistence', 'Cargo availability data saved', {
                dataset: datasetId,
                settlement: this.selectedSettlement.name,
                season: this.currentSeason,
                cargoCount: successfulCargo.length
            });

        } catch (error) {
            console.error('🔄 CARGO PERSISTENCE: Failed to save cargo availability data', error);
            this._logError('Cargo Persistence', 'Failed to save cargo availability data', { error: error.message });
        }
    }

    /**
     * Load cargo availability data from game settings
     * @returns {Object|null} - Cargo availability data or null if not found/valid
     * @private
     */
    async _loadCargoAvailability() {
        try {
            if (!this.selectedSettlement || !this.currentSeason) {
                console.log('🔄 CARGO PERSISTENCE: Cannot load - missing settlement or season', {
                    hasSettlement: !!this.selectedSettlement,
                    hasSeason: !!this.currentSeason
                });
                this._logDebug('Cargo Persistence', 'Cannot load cargo availability - missing settlement or season');
                return null;
            }

            const datasetId = this.dataManager?.activeDatasetName || 'default';
            const allCargoData = await game.settings.get(MODULE_ID, "cargoAvailabilityData") || {};
            const datasetCargoData = allCargoData[datasetId] || {};
            console.log('🔄 CARGO PERSISTENCE: Retrieved all cargo data from settings:', Object.keys(datasetCargoData));
            const storageKey = `${this.selectedSettlement.name}_${this.currentSeason}`;
            console.log('🔄 CARGO PERSISTENCE: Looking for storage key:', storageKey);

            const cargoData = datasetCargoData[storageKey];

            if (!cargoData) {
                console.log('🔄 CARGO PERSISTENCE: No saved cargo data found for key:', storageKey);
                this._logDebug('Cargo Persistence', 'No saved cargo availability data found');
                return null;
            }

            // Validate that the data is still relevant
            if (cargoData.settlement !== this.selectedSettlement.name ||
                cargoData.season !== this.currentSeason) {
                console.log('🔄 CARGO PERSISTENCE: Cargo data mismatch', {
                    saved: { settlement: cargoData.settlement, season: cargoData.season },
                    current: { settlement: this.selectedSettlement.name, season: this.currentSeason }
                });
                this._logDebug('Cargo Persistence', 'Saved cargo data is for different settlement/season, ignoring');
                return null;
            }

            // Check if data is not too old (optional - could be configurable)
            const maxAge = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
            if (Date.now() - cargoData.timestamp > maxAge) {
                console.log('🔄 CARGO PERSISTENCE: Cargo data is too old, ignoring');
                this._logDebug('Cargo Persistence', 'Saved cargo data is too old, ignoring');
                // Don't delete old data, just ignore it
                return null;
            }

            console.log('🔄 CARGO PERSISTENCE: Successfully loaded cargo data', {
                dataset: datasetId,
                settlement: cargoData.settlement,
                season: cargoData.season,
                availableCargoCount: cargoData.availableCargo?.length || 0,
                successfulCargoCount: cargoData.successfulCargo?.length || 0
            });

            this._logDebug('Cargo Persistence', 'Cargo availability data loaded', {
                dataset: datasetId,
                settlement: cargoData.settlement,
                season: cargoData.season,
                cargoCount: cargoData.successfulCargo?.length || 0,
                age: Math.round((Date.now() - cargoData.timestamp) / 1000 / 60) + ' minutes'
            });

            return cargoData;

        } catch (error) {
            console.error('🔄 CARGO PERSISTENCE: Failed to load cargo availability data', error);
            this._logError('Cargo Persistence', 'Failed to load cargo availability data', { error: error.message });
            return null;
        }
    }

    /**
     * Clear saved cargo availability data for current settlement/season
     * @private
     */
    async _clearCargoAvailability() {
        try {
            if (!this.selectedSettlement || !this.currentSeason) {
                return;
            }

            const datasetId = this.dataManager?.activeDatasetName || 'default';
            const allCargoData = await game.settings.get(MODULE_ID, "cargoAvailabilityData") || {};
            if (allCargoData[datasetId]) {
                const storageKey = `${this.selectedSettlement.name}_${this.currentSeason}`;
                delete allCargoData[datasetId][storageKey];
                await game.settings.set(MODULE_ID, "cargoAvailabilityData", allCargoData);
            }

            this._logDebug('Cargo Persistence', 'Cargo availability data cleared', {
                dataset: datasetId,
                settlement: this.selectedSettlement.name,
                season: this.currentSeason
            });

        } catch (error) {
            this._logError('Cargo Persistence', 'Failed to clear cargo availability data', { error: error.message });
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

            const chatVisibility = game.settings.get(MODULE_ID, "chatVisibility");
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

    /**
     * Comprehensive UI refresh - reloads all data and re-renders
     * @param {Object} options - Refresh options
     * @param {string} options.focusTab - Tab to focus after refresh
     * @param {boolean} options.force - Force a complete re-render (default: true)
     */
    async refreshUI({ focusTab = null, force = true } = {}) {
        try {
            console.log('🔄 UI_REFRESH: ========== STARTING REFRESH ==========');
            console.log('🔄 UI_REFRESH: Options:', { focusTab, force });
            
            const desiredTab = focusTab || this.renderer.getActiveTabName();
            console.log('🔄 UI_REFRESH: Desired tab:', desiredTab);

            // Reload cargo data from DataManager
            console.log('🔄 UI_REFRESH: DataManager cargo before reload:', this.dataManager?.cargo?.length || 0);
            this.currentCargo = await this._getCurrentCargoData();
            this.playerCargo = Array.isArray(this.currentCargo) ? [...this.currentCargo] : [];
            console.log('🔄 UI_REFRESH: Cargo reloaded:', {
                currentCargoCount: this.currentCargo.length,
                playerCargoCount: this.playerCargo.length
            });
            
            // Reload transaction history from DataManager
            console.log('🔄 UI_REFRESH: DataManager history before reload:', this.dataManager?.history?.length || 0);
            this.transactionHistory = this._prepareTransactionHistory(this.dataManager?.history || []);
            console.log('🔄 UI_REFRESH: History reloaded:', this.transactionHistory.length);

            // Force a complete re-render
            console.log('🔄 UI_REFRESH: Calling render() with force =', force);
            await this.render(force);
            console.log('🔄 UI_REFRESH: Render complete');

            // Switch to the desired tab after render completes
            const tabToActivate = desiredTab || 'buying';
            console.log('🔄 UI_REFRESH: Switching to tab:', tabToActivate);
            
            // Use a small delay to ensure render is complete
            setTimeout(() => {
                this.renderer.setActiveTab(tabToActivate);
                console.log('🔄 UI_REFRESH: ========== REFRESH COMPLETE ==========');
            }, 50);
            
        } catch (error) {
            console.error('🔄 UI_REFRESH: ========== REFRESH FAILED ==========');
            console.error('🔄 UI_REFRESH: Error:', error);
            console.error('🔄 UI_REFRESH: Stack:', error.stack);
            this._logError('UI Refresh', 'Failed to refresh UI', { error: error.message });
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
window.TradingPlacesApplication = TradingPlacesApplication;

// Store the current instance globally when created
TradingPlacesApplication.currentInstance = null;

// Override render to store instance
const originalRender = TradingPlacesApplication.prototype.render;
TradingPlacesApplication.prototype.render = function(...args) {
    TradingPlacesApplication.currentInstance = this;
    return originalRender.apply(this, args);
};

// Override close to clear instance
const originalClose = TradingPlacesApplication.prototype.close;
TradingPlacesApplication.prototype.close = function(...args) {
    if (TradingPlacesApplication.currentInstance === this) {
        TradingPlacesApplication.currentInstance = null;
    }
    return originalClose.apply(this, args);
};

console.log('Trading Places | TradingPlacesApplication class registered globally');

} // End of ApplicationV2 availability check