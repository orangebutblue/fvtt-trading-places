console.log('Trading Places | Loading TradingUIEventHandlers.js');

import { BuyingFlow } from '../flow/BuyingFlow.js';
import { SellingFlow } from '../flow/SellingFlow.js';
import {
    resolveCurrencyContext,
    formatDenominationValue,
    formatCanonicalValue,
    augmentTransaction,
    convertDenominationToCanonical,
    getCurrencyLabel
} from '../currency-display.js';

const MODULE_ID = "fvtt-trading-places";

export class TradingUIEventHandlers {
    constructor(app) {
        this.app = app;
        this.buyingFlow = new BuyingFlow(app);
        this.sellingFlow = new SellingFlow(app);
    }

    _getCurrencyContext() {
        return resolveCurrencyContext(this.app?.dataManager);
    }

    _formatCurrencyFromDenomination(value, defaultText = '--') {
        const context = this._getCurrencyContext();
        return formatDenominationValue(value, context, { defaultText });
    }

    _formatCurrencyFromCanonical(value, defaultText = '--') {
        const context = this._getCurrencyContext();
        return formatCanonicalValue(value, context, { defaultText });
    }

    _convertDenominationToCanonical(value) {
        const context = this._getCurrencyContext();
        return convertDenominationToCanonical(value, context);
    }

    _augmentTransaction(transaction) {
        if (!transaction) {
            return transaction;
        }
        augmentTransaction(transaction, this._getCurrencyContext());
        return transaction;
    }

    _getCurrencyLabel() {
        return getCurrencyLabel(this._getCurrencyContext());
    }

    _logDebug(category, message, data) {
        if (this.app.debugLogger && this.app.debugLogger.log) {
            this.app.debugLogger.log('DEBUG', category, message, data, 'DEBUG');
        } else {
            console.debug(`Trading Places | ${category}: ${message}`, data);
        }
    }

    _logInfo(category, message, data) {
        if (this.app.debugLogger && this.app.debugLogger.log) {
            this.app.debugLogger.log('INFO', category, message, data, 'INFO');
        } else {
            console.log(`Trading Places | ${category}: ${message}`, data);
        }
    }

    _logError(category, message, data) {
        if (this.app.debugLogger && this.app.debugLogger.log) {
            this.app.debugLogger.log('ERROR', category, message, data, 'ERROR');
        } else {
            console.error(`Trading Places | ${category}: ${message}`, data);
        }
    }

    /** @override */
    _attachPartListeners(partId, htmlElement, options) {
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
        // Note: Season management moved to unified UI listeners to avoid duplicates
        // The #current-season element in header is now handled by #season-select in content

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
        const cargoItems = html.querySelectorAll('.trading-places-cargo-item');
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
        this.app.renderer._updateSellingTab();

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

        // Delete transaction buttons - attach if they exist in the history tab
        try {
            const deleteTransactionBtns = html.querySelectorAll('#history-tab .delete-transaction-btn');
            if (deleteTransactionBtns && deleteTransactionBtns.length > 0) {
                deleteTransactionBtns.forEach(btn => {
                    btn.addEventListener('click', this._onDeleteTransaction.bind(this));
                });
                this._logDebug('Event Listeners', `Attached ${deleteTransactionBtns.length} delete transaction listeners`);
            }
        } catch (error) {
            this._logError('Event Listeners', 'Error attaching delete transaction listeners', { error: error.message });
        }

        // Manual entry collapsible toggle
        const manualEntryToggle = html.querySelector('.manual-entry-toggle');
        if (manualEntryToggle) {
            manualEntryToggle.addEventListener('click', this._onToggleManualEntry.bind(this));
            this._logDebug('Event Listeners', 'Attached manual entry toggle listener');
        }

        // Manual transaction entry button
        const addManualTransactionBtn = html.querySelector('.add-manual-transaction-btn');
        if (addManualTransactionBtn) {
            addManualTransactionBtn.addEventListener('click', this._onAddManualTransaction.bind(this));
            this._logDebug('Event Listeners', 'Attached manual transaction entry listener');
        }

        // Real-time price calculation for manual entry
        const quantityInput = html.querySelector('#manual-quantity');
        const costInput = html.querySelector('#manual-total-cost');
        if (quantityInput && costInput) {
            quantityInput.addEventListener('input', this._updatePricePreview.bind(this));
            costInput.addEventListener('input', this._updatePricePreview.bind(this));
        }

        // Auto-select category when cargo is chosen from autocomplete
        const cargoInput = html.querySelector('#manual-cargo');
        if (cargoInput) {
            cargoInput.addEventListener('input', this._onCargoInputChange.bind(this));
            cargoInput.addEventListener('change', this._onCargoInputChange.bind(this));
        }

        // Populate cargo types for autocomplete
        this._populateCargoAutocomplete();

        // Cargo tab event listeners
        const cargoCapacityInput = html.querySelector('#cargo-capacity');
        if (cargoCapacityInput) {
            cargoCapacityInput.addEventListener('input', this._onCargoCapacityChange.bind(this));
        }

        // Cargo action buttons - use event delegation for dynamically added buttons
        const sellCargoButtons = html.querySelectorAll('.sell-cargo-btn');
        console.log('Found sell cargo buttons:', sellCargoButtons.length);
        sellCargoButtons.forEach(btn => {
            console.log('Attaching click listener to sell button:', btn);
            btn.addEventListener('click', this._onSellCargo.bind(this));
        });
        
        // Also add event delegation to catch dynamically added buttons
        html.addEventListener('click', (e) => {
            if (e.target.classList.contains('sell-cargo-btn') || e.target.closest('.sell-cargo-btn')) {
                console.log('Sell button clicked via delegation!');
                const button = e.target.classList.contains('sell-cargo-btn') ? e.target : e.target.closest('.sell-cargo-btn');
                this._onSellCargo({ currentTarget: button, preventDefault: () => {} });
            }
        });

        // Edit functionality removed

        const deleteCargoButtons = html.querySelectorAll('.delete-cargo-btn');
        deleteCargoButtons.forEach(btn => {
            btn.addEventListener('click', this._onDeleteCargo.bind(this));
        });

        // Add cargo section event listeners
        const addCargoToggle = html.querySelector('.add-cargo-toggle');
        if (addCargoToggle) {
            addCargoToggle.addEventListener('click', this._onToggleAddCargo.bind(this));
            this._logDebug('Event Listeners', 'Attached add cargo toggle listener');
        }

        const addCargoBtn = html.querySelector('.add-cargo-btn');
        if (addCargoBtn) {
            addCargoBtn.addEventListener('click', this._onAddCargo.bind(this));
            this._logDebug('Event Listeners', 'Attached add cargo button listener');
        }

        // Real-time cost calculation for add cargo
        const addCargoQuantityInput = html.querySelector('#add-cargo-quantity');
        const addCargoPriceInput = html.querySelector('#add-cargo-price');
        if (addCargoQuantityInput && addCargoPriceInput) {
            addCargoQuantityInput.addEventListener('input', this._updateAddCargoCostPreview.bind(this));
            addCargoPriceInput.addEventListener('input', this._updateAddCargoCostPreview.bind(this));
        }

        // Auto-select category when cargo is chosen from autocomplete
        const addCargoNameInput = html.querySelector('#add-cargo-name');
        if (addCargoNameInput) {
            addCargoNameInput.addEventListener('input', this._onAddCargoInputChange.bind(this));
            addCargoNameInput.addEventListener('change', this._onAddCargoInputChange.bind(this));
        }

        // Populate cargo types for add cargo autocomplete
        this._populateAddCargoAutocomplete();

        // GM Tools - Data Management Button
        const dataManagementBtn = html.querySelector('#open-data-management');
        if (dataManagementBtn) {
            dataManagementBtn.addEventListener('click', this._onOpenDataManagement.bind(this));
            this._logDebug('Event Listeners', 'Attached data management button listener');
        }

        // Post Cargo to Chat Button
        const postCargoToChatBtn = html.querySelector('#post-cargo-to-chat');
        if (postCargoToChatBtn) {
            postCargoToChatBtn.addEventListener('click', this._onPostCargoToChat.bind(this));
            this._logDebug('Event Listeners', 'Attached post cargo to chat button listener');
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
        const tabs = html.querySelectorAll('.trading-places-tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                // Remove active class from all tabs and content
                html.querySelectorAll('.trading-places-tab').forEach(t => t.classList.remove('active'));
                html.querySelectorAll('.trading-places-tab-content').forEach(content => {
                    content.classList.remove('active');
                    content.style.display = 'none'; // Explicitly hide
                });
                
                // Add active class to clicked tab
                tab.classList.add('active');
                
                // Show corresponding content
                const targetTab = tab.getAttribute('data-tab');
                const targetContent = html.querySelector(`#${targetTab}-tab`);
                if (targetContent) {
                    targetContent.classList.add('active');
                    targetContent.style.display = 'block'; // Explicitly show
                    
                    // Re-attach tooltip handlers for the newly visible tab content
                    this._attachTooltipHandlersForTab(targetContent);
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
     * Attach tooltip handlers for info indicators within a specific tab content
     * @param {HTMLElement} tabContent - The tab content element
     * @private
     */
    _attachTooltipHandlersForTab(tabContent) {
        if (!tabContent || !this.app.renderer) {
            return;
        }

        // Find all info indicators within this tab content
        const infoIndicators = tabContent.querySelectorAll('.info-indicator');
        
        this._logDebug('Tooltip Handlers', `Found ${infoIndicators.length} info indicators in tab`, {
            tabId: tabContent.id,
            indicators: infoIndicators.length
        });

        infoIndicators.forEach((indicator, index) => {
            // Remove any existing listeners to avoid duplicates
            const existingHandler = indicator._tooltipHandler;
            if (existingHandler) {
                indicator.removeEventListener('click', existingHandler);
            }

            // Create new handler
            const handler = (event) => {
                event.stopPropagation();
                const tooltip = event.target.dataset.infoTooltip;
                if (tooltip && this.app.renderer._showInfoTooltip) {
                    this.app.renderer._showInfoTooltip(tooltip, event.target);
                }
            };

            // Store handler reference and attach
            indicator._tooltipHandler = handler;
            indicator.addEventListener('click', handler);
            
            this._logDebug('Tooltip Handlers', `Attached tooltip handler ${index + 1}`, {
                hasTooltip: !!indicator.dataset.infoTooltip,
                tooltipLength: indicator.dataset.infoTooltip?.length || 0
            });
        });
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
            await this.app.setCurrentSeason(newSeason);
            await this.app.render(false); // Re-render application
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
        this.app.clearValidationErrors('buying');
        this.app.clearValidationErrors('selling');

        if (!settlementName) {
            this.app.selectedSettlement = null;
            this.app.availableCargo = [];
            await this.app.render(false);
            return;
        }

        try {
            const settlement = this.app.dataManager.getSettlement(settlementName);
            if (!settlement) {
                throw new Error(`Settlement not found: ${settlementName}`);
            }

            this.app.selectedSettlement = settlement;

            // Clear previous cargo and saved data
            this.app.availableCargo = [];
            this.app.successfulCargo = [];
            await this.app._clearCargoAvailability();
            
            // Also clear seller offers when settlement changes
            this.app.sellerOffers = null;
            await this.sellingFlow._clearSellerOffers();

            // Save to Foundry settings for persistence
            game.settings.set(MODULE_ID, "selectedSettlement", settlement.name);

            // Try to load cargo availability for this settlement/season
            await this.app._loadAndRestoreCargoAvailability();

            // Update UI
            await this.app.render(false);
            
            // Update selling tab with new settlement
            this.app.renderer._updateSellingTab();

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
        const selector = this.app.element.querySelector('.settlement-selector');

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
        const cargoItems = this.app.element.querySelectorAll('.trading-places-cargo-item');
        cargoItems.forEach(item => item.classList.remove('selected'));

        // Add selection to clicked item
        event.currentTarget.classList.add('selected');

        this.app.selectedCargo = cargoName;

        this._logDebug('Event Handler', 'Cargo selected', { cargoName });
    }

    /**
     * Handle check availability button - FIXED VERSION
     * @param {Event} event - Click event
     * @private
     */
    async _onCheckAvailability(event) {
        await this.buyingFlow.onCheckAvailability(event);
    }

    /**
     * Handle region change from settlement selector
     * @param {string} regionName - Selected region name
     * @private
     */
    _onSettlementSelectorRegionChange(regionName) {
        this._logDebug('Settlement Selector', 'Region changed via selector', { region: regionName });

        // Clear current settlement selection
        this.app.selectedSettlement = null;
        this.app.availableCargo = [];

        // Update UI state
        this.app._updateUIState();
    }

    /**
     * Handle settlement change from settlement selector
     * @param {string} settlementName - Selected settlement name
     * @private
     */
    async _onSettlementSelectorSettlementChange(settlementName) {
        this._logDebug('Settlement Selector', 'Settlement changed via selector', { settlement: settlementName });

        // Clear any previous validation errors when settlement changes
        this.app.clearValidationErrors('buying');
        this.app.clearValidationErrors('selling');

        if (!settlementName) {
            this.app.selectedSettlement = null;
            this.app.availableCargo = [];
            this.app._updateUIState();
            return;
        }

        // Get settlement data
        const settlement = this.app.dataManager.getSettlement(settlementName);
        if (settlement) {
            this.app.selectedSettlement = settlement;
            this.app.availableCargo = []; // Clear cargo until availability is checked

            this._logInfo('Settlement Selector', 'Settlement selected via selector', {
                name: settlement.name,
                region: settlement.region,
                size: settlement.size,
                wealth: settlement.wealth
            });

            // Update UI state
            this.app.renderer._updateUIState();

            // Update selling resources (show all cargo types)
            this.app.renderer._populateSellingResources();

            // Show notification
            if (ui.notifications) {
                ui.notifications.info(`Selected ${settlement.name} in ${settlement.region}`);
            }
        } else {
            this._logError('Settlement Selector', 'Settlement not found', { settlementName });
        }
    }

    /**
     * Handle "Look for Sellers" button click - implements WFRP Selling Algorithm Step 3
     * @param {Event} event - Click event
     * @private
     */
    async _onLookForSellers(event) {
        await this.sellingFlow.onLookForSellers(event);
    }

    _onSellQuantityChange(event) {
        this._logDebug('Event Handler', 'Sell quantity change', { value: event.target.value });
    }

    _onNegotiateSell(event) {
        this._logDebug('Event Handler', 'Negotiate sell');
    }

    _onDesperateSale(event) {
        this._logDebug('Event Handler', 'Desperate sale');
    }

    _onNegotiateBuy(event) {
        this._logDebug('Event Handler', 'Negotiate buy');
    }

    _onDebugToggle(event) {
        this._logDebug('Event Handler', 'Debug toggle', { value: event.target.checked });
    }

    _onClearDebugLog(event) {
        this._logDebug('Event Handler', 'Clear debug log');
    }

    _onPurchaseAttempt(event) {
        this._logDebug('Event Handler', 'Purchase attempt');
    }

    _onSaleAttempt(event) {
        this._logDebug('Event Handler', 'Sale attempt');
    }

    _onHaggleAttempt(event) {
        this._logDebug('Event Handler', 'Haggle attempt');
    }

    _onQuantityChange(event) {
        this._logDebug('Event Handler', 'Quantity change', { value: event.target.value });
    }

    _onQualityChange(event) {
        this._logDebug('Event Handler', 'Quality change', { value: event.target.value });
    }

    _onDesperateSaleAttempt(event) {
        this._logDebug('Event Handler', 'Desperate sale attempt');
    }

    _onRumorSaleAttempt(event) {
        this._logDebug('Event Handler', 'Rumor sale attempt');
    }

    /**
     * Handle cargo purchase from the buying interface
     * @param {Object} cargo - The cargo data
     * @param {number} quantity - Quantity to purchase
     * @param {number} totalCost - Total cost of the purchase
     * @param {number} discountPercent - Discount percentage applied (-10 to +10)
     * @private
     */
    async _onCargoPurchase(cargo, quantity, totalCost, discountPercent = 0) {
        this._logDebug('Event Handler', 'Cargo purchase attempt', {
            cargo: cargo.name,
            quantity,
            totalCost,
            discountPercent,
            pricePerEP: totalCost / quantity
        });

        try {
            // Validate purchase
            const validation = await this.app.systemAdapter.validatePurchase(
                this.app.selectedSettlement,
                cargo,
                quantity,
                totalCost
            );

            if (!validation.valid) {
                ui.notifications.error(`Purchase failed: ${validation.error}`);
                return;
            }

            // Perform the purchase
            const result = await this.app.systemAdapter.performPurchase(
                this.app.selectedSettlement,
                cargo,
                quantity,
                totalCost
            );

            if (result.success) {
                // Update cargo availability (reduce available quantity)
                await this._updateCargoAvailabilityAfterPurchase(cargo, quantity);

                // Show success message
                const formattedTotalCost = this._formatCurrencyFromDenomination(totalCost, `${totalCost} ${this._getCurrencyLabel()}`);
                const discountText = discountPercent !== 0 ? ` (${discountPercent >= 0 ? '+' : ''}${discountPercent}% adjustment)` : '';
                ui.notifications.success(`Successfully purchased ${quantity} EP of ${cargo.name} for ${formattedTotalCost}${discountText}`);

                // Update the cargo card to reflect reduced availability
                this._updateBuyingCargoCard(cargo, quantity);
                
                // Just update the app's cargo data and let it re-render naturally
                const datasetId = this.app.dataManager.activeDatasetName;
                const allCargoData = await game.settings.get(MODULE_ID, "currentCargo") || {};
                const updatedCargo = allCargoData[datasetId] || [];
                this.app.currentCargo = updatedCargo;

                await this.app.refreshUI({ focusTab: 'buying' });

                this._logInfo('Purchase Success', 'Cargo purchased successfully', {
                    cargo: cargo.name,
                    quantity,
                    totalCost,
                    discountPercent,
                    remainingEP: (cargo.totalEP ?? cargo.quantity ?? 0) - quantity
                });
            } else {
                ui.notifications.error(`Purchase failed: ${result.error}`);
            }

        } catch (error) {
            this._logError('Purchase Error', 'Failed to complete purchase', { error: error.message });
            ui.notifications.error(`Purchase failed: ${error.message}`);
        }
    }

    /**
     * Update cargo availability after a successful purchase
     * @param {Object} purchasedCargo - The cargo that was purchased
     * @param {number} purchasedQuantity - How much was purchased
     * @private
     */
    async _updateCargoAvailabilityAfterPurchase(purchasedCargo, purchasedQuantity) {
        // Find the cargo in available cargo and reduce its quantity
        const cargoIndex = this.app.successfulCargo.findIndex(cargo =>
            cargo.name === purchasedCargo.name &&
            cargo.category === purchasedCargo.category
        );

        if (cargoIndex !== -1) {
            const cargo = this.app.successfulCargo[cargoIndex];
            const newQuantity = Math.max(0, (cargo.totalEP ?? cargo.quantity ?? 0) - purchasedQuantity);

            // Update the cargo quantity
            if (cargo.totalEP !== undefined) {
                cargo.totalEP = newQuantity;
            } else if (cargo.quantity !== undefined) {
                cargo.quantity = newQuantity;
            }

            // If quantity is 0, remove the cargo from the list
            if (newQuantity === 0) {
                this.app.successfulCargo.splice(cargoIndex, 1);
            }

            // Save the updated cargo availability
            await this.app._saveCargoAvailability();

            this._logDebug('Cargo Update', 'Cargo availability updated after purchase', {
                cargo: purchasedCargo.name,
                purchased: purchasedQuantity,
                remaining: newQuantity
            });
        }
    }

    _onRegionChange(event) {
        const selectedRegion = event.target.value;
        this._logDebug('Event Handler', 'Region change', { value: selectedRegion });
        
        // Clear validation errors when region changes
        this.app.clearValidationErrors('buying');
        this.app.clearValidationErrors('selling');
        
        // Update application state
        this.app.selectedRegion = selectedRegion;
        this.app.selectedSettlement = null;
        this.app.availableCargo = [];
        
        // Save to Foundry settings for persistence
        game.settings.set(MODULE_ID, "selectedRegion", selectedRegion);
        game.settings.set(MODULE_ID, "selectedSettlement", null);
        
        // Re-render to update the settlement dropdown with filtered settlements
        this.app.render(false);
        
        this._logDebug('Region Selection', `Region set to ${selectedRegion}, settlements will be filtered`);
    }

    /**
     * Toggle the manual entry form collapse/expand
     * @param {Event} event - Click event
     * @private
     */
    _onToggleManualEntry(event) {
        event.preventDefault();
        
        const toggle = event.currentTarget;
        const form = this.app.element.querySelector('.manual-entry-form');
        
        if (!form) return;
        
        const isCollapsed = form.classList.contains('collapsed');
        
        if (isCollapsed) {
            // Expand
            form.classList.remove('collapsed');
            toggle.classList.add('expanded');
            
            // Ensure cargo autocomplete is populated when form is expanded
            this._populateCargoAutocomplete();
            
            // Focus on the first input after animation
            setTimeout(() => {
                const firstInput = form.querySelector('#manual-cargo');
                if (firstInput) firstInput.focus();
            }, 300);
            
        } else {
            // Collapse
            form.classList.add('collapsed');
            toggle.classList.remove('expanded');
        }
        
        this._logDebug('Manual Entry', `Form ${isCollapsed ? 'expanded' : 'collapsed'}`);
    }

    /**
     * Update the price preview in real-time
     * @private
     */
    _updatePricePreview() {
        const quantityInput = this.app.element.querySelector('#manual-quantity');
        const costInput = this.app.element.querySelector('#manual-total-cost');
        const pricePreview = this.app.element.querySelector('.price-preview strong');
        
        if (!quantityInput || !costInput || !pricePreview) return;
        
        const quantity = parseFloat(quantityInput.value);
        const totalCost = parseFloat(costInput.value);

        if (Number.isFinite(quantity) && quantity > 0 && Number.isFinite(totalCost) && totalCost >= 0) {
            const pricePerEP = totalCost / quantity;
            pricePreview.textContent = this._formatCurrencyFromDenomination(pricePerEP, '--');
        } else {
            pricePreview.textContent = '--';
        }
    }

    /**
     * Handle adding a manual transaction
     * @param {Event} event - Click event
     * @private
     */
    async _onAddManualTransaction(event) {
        event.preventDefault();
        
        try {
            // Get form values
            const cargoName = this.app.element.querySelector('#manual-cargo')?.value?.trim();
            const category = this.app.element.querySelector('#manual-category')?.value;
            const quantity = parseFloat(this.app.element.querySelector('#manual-quantity')?.value);
            const totalCost = parseFloat(this.app.element.querySelector('#manual-total-cost')?.value);
            const settlement = this.app.element.querySelector('#manual-settlement')?.value?.trim();
            const season = this.app.element.querySelector('#manual-season')?.value;
            const transactionType = this.app.element.querySelector('#manual-transaction-type')?.value;
            const isContraband = this.app.element.querySelector('#manual-contraband')?.checked || false;
            
            // Validate inputs
            const validation = this._validateManualTransactionInputs({
                cargoName, category, quantity, totalCost, settlement, season, transactionType
            });
            
            if (!validation.valid) {
                ui.notifications.error(validation.error);
                return;
            }
            
            // Calculate price per EP and canonical totals
            const pricePerEP = totalCost / quantity;
            const pricePerEPCanonical = this._convertDenominationToCanonical(pricePerEP);
            const totalCostCanonical = this._convertDenominationToCanonical(totalCost);

            // Create transaction object
            const transaction = this._augmentTransaction({
                cargo: cargoName,
                category: category,
                quantity: quantity,
                pricePerEP: Number.isFinite(pricePerEP) ? pricePerEP : 0,
                pricePerEPCanonical: typeof pricePerEPCanonical === 'number' ? pricePerEPCanonical : null,
                totalCost: Number.isFinite(totalCost) ? totalCost : 0,
                totalCostCanonical: typeof totalCostCanonical === 'number' ? totalCostCanonical : null,
                settlement: settlement,
                season: season,
                date: new Date().toISOString(),
                discountPercent: 0,
                isSale: transactionType === 'sale',
                contraband: isContraband,
                isManualEntry: true
            });
            
            // Add to transaction history (at the beginning so newest appears on top)
            if (!this.app.transactionHistory) {
                this.app.transactionHistory = [];
            }
            this.app.transactionHistory.unshift(transaction);
            
            // Update cargo inventory based on transaction type
            if (transactionType === 'purchase') {
                await this._addCargoToInventory(transaction);
            } else if (transactionType === 'sale') {
                await this._removeCargoFromInventory(transaction);
            }
            
            console.log('🚛 CARGO_PERSIST: Adding transaction to history', {
                type: transactionType,
                cargo: transaction.cargo,
                historyLength: this.app.transactionHistory.length
            });
            
            // Save to DataManager
            this.app.dataManager.history = this.app.transactionHistory;
            await this.app.dataManager.saveCurrentDataset();
            
            console.log('🚛 CARGO_PERSIST: Transaction history saved to dataset');
            
            // Clear and collapse the form
            this._clearManualTransactionForm();
            this._collapseManualEntry();
            
            // Refresh UI to show the new transaction while keeping the history tab active
            await this.app.refreshUI({ focusTab: 'history' });
            
            // Show success message
            const formattedTotalCost = transaction.formattedTotalCost
                || this._formatCurrencyFromDenomination(totalCost, `${totalCost} ${this._getCurrencyLabel()}`);
            ui.notifications.success(`Added: ${quantity} EP of ${cargoName} for ${formattedTotalCost}`);
            
            this._logInfo('Manual Transaction', 'Manual transaction added', {
                cargo: cargoName, quantity, totalCost, settlement, season
            });
            
        } catch (error) {
            this._logError('Manual Transaction', 'Failed to add manual transaction', { error: error.message });
            ui.notifications.error(`Failed to add transaction: ${error.message}`);
        }
    }
    
    /**
     * Validate manual transaction inputs
     * @param {Object} inputs - Input values to validate
     * @returns {Object} Validation result
     * @private
     */
    _validateManualTransactionInputs(inputs) {
        const { cargoName, category, quantity, totalCost, settlement, season, transactionType } = inputs;
        
        if (!cargoName) return { valid: false, error: 'Cargo name is required' };
        if (!category) return { valid: false, error: 'Category is required' };
        if (!quantity || isNaN(quantity) || quantity <= 0) return { valid: false, error: 'Valid quantity (EP) is required' };
        if (isNaN(totalCost) || totalCost < 0) return { valid: false, error: 'Valid total cost is required' };
        if (!settlement) return { valid: false, error: 'Settlement name is required' };
        if (!season) return { valid: false, error: 'Season is required' };
        if (!transactionType || (transactionType !== 'purchase' && transactionType !== 'sale')) {
            return { valid: false, error: 'Transaction type must be either purchase or sale' };
        }
        
        return { valid: true };
    }
    
    /**
     * Clear the manual transaction form
     * @private
     */
    _clearManualTransactionForm() {
        const form = this.app.element.querySelector('.manual-entry-form');
        if (!form) return;
        
        form.querySelector('#manual-cargo').value = '';
        form.querySelector('#manual-category').value = '';
        form.querySelector('#manual-quantity').value = '';
        form.querySelector('#manual-total-cost').value = '';
        form.querySelector('#manual-transaction-type').value = 'purchase'; // Reset to default
        form.querySelector('#manual-contraband').checked = false; // Reset contraband checkbox
        
        // Reset price preview
        const pricePreview = form.querySelector('.price-preview strong');
        if (pricePreview) pricePreview.textContent = '--';
    }
    
    /**
     * Collapse the manual entry form
     * @private
     */
    _collapseManualEntry() {
        const toggle = this.app.element.querySelector('.manual-entry-toggle');
        const form = this.app.element.querySelector('.manual-entry-form');
        
        if (toggle && form) {
            form.classList.add('collapsed');
            toggle.classList.remove('expanded');
        }
    }
    
    /**
     * Handle cargo input change to auto-select category
     * @param {Event} event - Input/change event
     * @private
     */
    async _onCargoInputChange(event) {
        const cargoName = event.target.value.trim();
        
        if (!cargoName || !this.cargoTypesData) {
            return;
        }
        
        // Find matching cargo type
        const matchingCargo = this.cargoTypesData.cargoTypes.find(cargo => 
            cargo.name.toLowerCase() === cargoName.toLowerCase()
        );
        
        if (matchingCargo) {
            const categorySelect = this.app.element.querySelector('#manual-category');
            if (categorySelect) {
                categorySelect.value = matchingCargo.category;
                
                this._logDebug('Cargo Auto-Select', 'Category auto-selected for cargo', {
                    cargo: cargoName,
                    category: matchingCargo.category
                });
            }
        }
    }

    /**
     * Populate cargo types for autocomplete and categories from datasets/active/cargo-types.json
     * @private
     */
    async _populateCargoAutocomplete() {
        try {
            // Get cargo types from DataManager instead of fetching file
            const dataManager = window.TradingPlaces?.getDataManager();
            if (!dataManager) {
                throw new Error('DataManager not available');
            }
            
            const cargoData = dataManager.getCargoTypes();
            const datalist = this.app.element.querySelector('#cargo-datalist');
            const categorySelect = this.app.element.querySelector('#manual-category');
            
            if (!cargoData || cargoData.length === 0) {
                return;
            }
            
            // Populate cargo autocomplete datalist
            if (datalist) {
                // Clear existing options
                datalist.innerHTML = '';
                
                // Add cargo types as options
                cargoData.forEach(cargo => {
                    const option = document.createElement('option');
                    option.value = cargo.name;
                    option.textContent = `${cargo.name} (${cargo.category})`;
                    datalist.appendChild(option);
                });
            }
            
            // Populate category dropdown
            if (categorySelect) {
                // Get unique categories from cargo types
                const categories = [...new Set(cargoData.map(cargo => cargo.category))].sort();
                
                // Clear existing options (keep the default empty option)
                const defaultOption = categorySelect.querySelector('option[value=""]');
                categorySelect.innerHTML = '';
                if (defaultOption) {
                    categorySelect.appendChild(defaultOption);
                } else {
                    const emptyOption = document.createElement('option');
                    emptyOption.value = '';
                    emptyOption.textContent = 'Category';
                    categorySelect.appendChild(emptyOption);
                }
                
                // Add category options
                categories.forEach(category => {
                    const option = document.createElement('option');
                    option.value = category;
                    option.textContent = category;
                    categorySelect.appendChild(option);
                });
            }
            
            this._logDebug('Cargo Autocomplete', 'Populated cargo types and categories', {
                cargoCount: cargoData.length,
                categoryCount: categorySelect ? categorySelect.options.length - 1 : 0 // -1 for default option
            });
            
        } catch (error) {
            this._logError('Cargo Autocomplete', 'Failed to load cargo types and categories', {
                error: error.message
            });
        }
    }

    /**
     * Handle delete transaction button click
     * @param {Event} event - Click event
     * @private
     */
    async _onDeleteTransaction(event) {
        event.preventDefault();
        event.stopPropagation();
        
        const button = event.currentTarget;
        const transactionIndex = parseInt(button.dataset.transactionIndex);
        
        if (isNaN(transactionIndex)) {
            this._logError('Delete Transaction', 'Invalid transaction index', { transactionIndex });
            return;
        }

        // Confirm deletion using modern ApplicationV2 approach
        const confirmed = await foundry.applications.api.DialogV2.confirm({
            window: { title: "Delete Transaction" },
            content: "<p>Are you sure you want to delete this transaction from the history?</p>",
            rejectClose: false,
            modal: true
        });

        if (!confirmed) {
            return;
        }

        try {
            this._logDebug('Delete Transaction', 'Deleting transaction', { index: transactionIndex });
            
            // Remove the transaction from the history
            if (this.app.transactionHistory && this.app.transactionHistory.length > transactionIndex) {
                this.app.transactionHistory.splice(transactionIndex, 1);
                
                console.log('🚛 CARGO_PERSIST: Deleting transaction from history', {
                    transactionIndex,
                    remainingTransactions: this.app.transactionHistory.length
                });
                
                // Save updated history to DataManager
                this.app.dataManager.history = this.app.transactionHistory;
                await this.app.dataManager.saveCurrentDataset();
                
                console.log('🚛 CARGO_PERSIST: Updated history saved to dataset');
                
                await this.app.refreshUI({ focusTab: 'history' });
                
                this._logDebug('Delete Transaction', 'Transaction deleted successfully', { 
                    remainingTransactions: this.app.transactionHistory.length 
                });
                
                ui.notifications.info("Transaction deleted from history");
            } else {
                this._logError('Delete Transaction', 'Transaction index out of bounds', { 
                    index: transactionIndex, 
                    historyLength: this.app.transactionHistory?.length || 0 
                });
                ui.notifications.error("Could not delete transaction: invalid index");
            }
        } catch (error) {
            this._logError('Delete Transaction', 'Failed to delete transaction', { 
                error: error.message, 
                index: transactionIndex 
            });
            ui.notifications.error(`Failed to delete transaction: ${error.message}`);
        }
    }

    // ===== CARGO MANAGEMENT METHODS =====

    /**
     * Handle cargo capacity change
     * @param {Event} event - Input event
     * @private
     */
    async _onCargoCapacityChange(event) {
        const newCapacity = parseInt(event.target.value) || 0;
        
        // Save cargo capacity to game settings
        await game.settings.set(MODULE_ID, "cargoCapacity", newCapacity);
        
        // Update the capacity display immediately
        await this._updateCapacityDisplayReal();
        
        this._logDebug('Cargo Management', 'Cargo capacity updated', { newCapacity });
    }

    /**
     * Handle selling cargo from inventory
     * @param {Event} event - Click event
     * @private
     */
    async _onSellCargo(event) {
        console.log('Sell cargo button clicked!');
        event.preventDefault();
        const cargoId = event.currentTarget.dataset.cargoId;
        
        console.log('Cargo ID:', cargoId);
        
        if (!cargoId) {
            console.error('No cargo ID found');
            return;
        }
        
        try {
            // Find the cargo in current inventory
            const currentCargo = await this._getCurrentCargo();
            console.log('Current cargo:', currentCargo);
            console.log('Looking for cargo ID:', cargoId);
            console.log('First cargo object keys:', currentCargo.length > 0 ? Object.keys(currentCargo[0]) : 'No cargo');
            
            const cargoIndex = currentCargo.findIndex(cargo => cargo.id === cargoId);
            
            if (cargoIndex === -1) {
                console.error('Cargo not found in inventory');
                ui.notifications.error("Cargo not found in inventory");
                return;
            }
            
            const cargo = currentCargo[cargoIndex];
            console.log('Found cargo:', cargo);
            
            // Switch to selling tab and pre-populate with this cargo
            console.log('About to call _switchToSellingTab with cargo:', cargo);
            this._switchToSellingTab(cargo);
            console.log('Called _switchToSellingTab');
            
            this._logDebug('Cargo Management', 'Switched to selling tab for cargo', { cargo: cargo.cargo });
        } catch (error) {
            console.error('Error in _onSellCargo:', error);
        }
    }

    /**
     * Switch to selling tab - using EXACT same code as working tab switching
     * @param {Object} cargo - Optional cargo to pre-populate for selling
     * @private
     */
    _switchToSellingTab(cargo = null) {
        console.log('🔄 Switching to selling tab');
        
        // Remove active class from all tabs and content
        this.app.element.querySelectorAll('.trading-places-tab').forEach(t => t.classList.remove('active'));
        this.app.element.querySelectorAll('.trading-places-tab-content').forEach(content => {
            content.classList.remove('active');
            content.style.display = 'none';
        });
        
        // Add active class to selling tab
        const sellingTab = this.app.element.querySelector('.trading-places-tab[data-tab="selling"]');
        const sellingContent = this.app.element.querySelector('#selling-tab');
        
        if (sellingTab && sellingContent) {
            sellingTab.classList.add('active');
            sellingContent.classList.add('active');
            sellingContent.style.display = 'block';
            console.log('🔄 Selling tab activated successfully');
        } else {
            console.error('🔄 Failed to find selling tab elements');
        }
        
        // If cargo provided, show notification
        if (cargo) {
            ui.notifications.info(`Ready to sell ${cargo.cargo} (${cargo.quantity} EP)`);
        }
    }

    /**
     * Handle deleting cargo from inventory
     * @param {Event} event - Click event  
     * @private
     */
    async _onDeleteCargo(event) {
        event.preventDefault();
        const cargoId = event.currentTarget.dataset.cargoId;
        
        if (!cargoId) return;
        
        // Find the cargo in current inventory
        const currentCargo = await this._getCurrentCargo();
        const cargoIndex = currentCargo.findIndex(cargo => cargo.id === cargoId);
        
        if (cargoIndex === -1) {
            ui.notifications.error("Cargo not found in inventory");
            return;
        }
        
        const cargo = currentCargo[cargoIndex];
        
        // Confirm deletion
        const confirmed = await foundry.applications.api.DialogV2.confirm({
            window: { title: "Remove Cargo" },
            content: `<p>Are you sure you want to remove <strong>${cargo.quantity} EP of ${cargo.cargo}</strong> from your cargo?</p>`,
            rejectClose: false,
            modal: true
        });
        
        if (!confirmed) return;
        
        // Remove from inventory
        currentCargo.splice(cargoIndex, 1);
        
        console.log('🚛 CARGO_PERSIST: Deleting cargo', {
            cargoId,
            remainingCargo: currentCargo.length
        });
        
        // Update DataManager and save to dataset
        this.app.dataManager.cargo = currentCargo;
        await this.app.dataManager.saveCurrentDataset();
        
        console.log('🚛 CARGO_PERSIST: Cargo deleted and dataset saved');
        
        this.app.currentCargo = currentCargo;

        await this.app.refreshUI({ focusTab: 'cargo' });
        
        ui.notifications.info(`Removed ${cargo.quantity} EP of ${cargo.cargo} from cargo`);
        
        this._logDebug('Cargo Management', 'Cargo removed from inventory', {
            cargo: cargo.cargo,
            quantity: cargo.quantity
        });
    }

    /**
     * Add cargo to inventory after purchase
     * @param {Object} transaction - Transaction object
     * @private
     */
    async _addCargoToInventory(transaction) {
        const currentCargo = await this._getCurrentCargo();
        
        // Check if we already have this cargo type - if so, combine quantities
        const existingCargoIndex = currentCargo.findIndex(cargo => 
            cargo.cargo === transaction.cargo && 
            cargo.category === transaction.category &&
            cargo.settlement === transaction.settlement &&
            cargo.season === transaction.season &&
            cargo.contraband === transaction.contraband
        );
        
        if (existingCargoIndex !== -1) {
            // Combine with existing cargo
            const existingCargo = currentCargo[existingCargoIndex];
            const totalQuantity = existingCargo.quantity + transaction.quantity;
            const totalCost = existingCargo.totalCost + transaction.totalCost;
            
            existingCargo.quantity = totalQuantity;
            existingCargo.totalCost = totalCost;
            existingCargo.pricePerEP = totalCost / totalQuantity;
            existingCargo.date = transaction.date; // Update to latest purchase date
            
            // Add formatted currency fields
            existingCargo.formattedPricePerEP = this._formatCurrencyFromDenomination(existingCargo.pricePerEP);
            existingCargo.formattedTotalCost = this._formatCurrencyFromDenomination(existingCargo.totalCost);
            const priceCanonical = this._convertDenominationToCanonical(existingCargo.pricePerEP);
            const totalCanonical = this._convertDenominationToCanonical(existingCargo.totalCost);
            if (priceCanonical !== null) existingCargo.pricePerEPCanonical = priceCanonical;
            if (totalCanonical !== null) existingCargo.totalCostCanonical = totalCanonical;
        } else {
            // Add as new cargo
            const newCargo = {
                id: foundry.utils.randomID(),
                cargo: transaction.cargo,
                category: transaction.category,
                quantity: transaction.quantity,
                pricePerEP: transaction.pricePerEP,
                totalCost: transaction.totalCost,
                settlement: transaction.settlement,
                season: transaction.season,
                date: transaction.date,
                contraband: transaction.contraband || false,
                // Copy formatted fields from transaction
                formattedPricePerEP: transaction.formattedPricePerEP || this._formatCurrencyFromDenomination(transaction.pricePerEP),
                formattedTotalCost: transaction.formattedTotalCost || this._formatCurrencyFromDenomination(transaction.totalCost),
                pricePerEPCanonical: transaction.pricePerEPCanonical,
                totalCostCanonical: transaction.totalCostCanonical
            };
            
            currentCargo.push(newCargo);
        }
        
        console.log('🚛 CARGO_PERSIST: Adding cargo to inventory', {
            cargo: transaction.cargo,
            quantity: transaction.quantity,
            totalCargoItems: currentCargo.length,
            currentHistoryLength: this.app.transactionHistory?.length || 0
        });
        
        // Update DataManager with both cargo AND history (in case history was already updated)
        this.app.dataManager.cargo = currentCargo;
        this.app.dataManager.history = this.app.transactionHistory || [];
        await this.app.dataManager.saveCurrentDataset();
        
        console.log('🚛 CARGO_PERSIST: Cargo and history saved to dataset', {
            cargoCount: currentCargo.length,
            historyCount: this.app.transactionHistory?.length || 0
        });
        
        this._logDebug('Cargo Management', 'Cargo added to inventory', {
            cargo: transaction.cargo,
            quantity: transaction.quantity,
            totalCargoItems: currentCargo.length
        });
    }

    /**
     * Remove cargo from inventory after sale
     * @param {Object} transaction - Transaction object
     * @private
     */
    async _removeCargoFromInventory(transaction) {
        const currentCargo = await this._getCurrentCargo();
        
        // Find matching cargo to remove
        const cargoIndex = currentCargo.findIndex(cargo => 
            cargo.cargo === transaction.cargo && 
            cargo.category === transaction.category
        );
        
        if (cargoIndex !== -1) {
            const cargo = currentCargo[cargoIndex];
            
            if (cargo.quantity <= transaction.quantity) {
                // Remove entire cargo if selling all or more
                currentCargo.splice(cargoIndex, 1);
            } else {
                // Reduce quantity
                cargo.quantity -= transaction.quantity;
                cargo.totalCost = cargo.quantity * cargo.pricePerEP; // Recalculate total cost
            }
            
            console.log('🚛 CARGO_PERSIST: Removing cargo after sale', {
                cargo: transaction.cargo,
                quantitySold: transaction.quantity,
                remainingCargo: currentCargo.length,
                currentHistoryLength: this.app.transactionHistory?.length || 0
            });
            
            // Update DataManager with both cargo AND history (in case history was already updated)
            this.app.dataManager.cargo = currentCargo;
            this.app.dataManager.history = this.app.transactionHistory || [];
            await this.app.dataManager.saveCurrentDataset();
            
            console.log('🚛 CARGO_PERSIST: Cargo and history saved to dataset', {
                cargoCount: currentCargo.length,
                historyCount: this.app.transactionHistory?.length || 0
            });
            
            this.app.currentCargo = currentCargo;
            
            this._logDebug('Cargo Management', 'Cargo removed from inventory', {
                cargo: transaction.cargo,
                quantitySold: transaction.quantity,
                remainingQuantity: cargoIndex !== -1 && currentCargo[cargoIndex] ? currentCargo[cargoIndex].quantity : 0
            });
        }
    }

    /**
     * Get current cargo from DataManager
     * @returns {Array} Current cargo array
     * @private
     */
    async _getCurrentCargo() {
        console.log('🚛 CARGO_PERSIST: Loading cargo from DataManager');
        const rawCargo = this.app.dataManager.cargo || [];
        console.log('🚛 _getCurrentCargo: Loading cargo', { count: rawCargo.length, firstItem: rawCargo[0] });
        // Normalize cargo with formatted currency fields
        return rawCargo.map(cargo => {
            if (!cargo.formattedPricePerEP && typeof cargo.pricePerEP === 'number') {
                cargo.formattedPricePerEP = this._formatCurrencyFromDenomination(cargo.pricePerEP);
            }
            if (!cargo.formattedTotalCost && typeof cargo.totalCost === 'number') {
                cargo.formattedTotalCost = this._formatCurrencyFromDenomination(cargo.totalCost);
            }
            if (!cargo.pricePerEPCanonical && typeof cargo.pricePerEP === 'number') {
                const canonical = this._convertDenominationToCanonical(cargo.pricePerEP);
                if (canonical !== null) cargo.pricePerEPCanonical = canonical;
            }
            if (!cargo.totalCostCanonical && typeof cargo.totalCost === 'number') {
                const canonical = this._convertDenominationToCanonical(cargo.totalCost);
                if (canonical !== null) cargo.totalCostCanonical = canonical;
            }
            console.log('🚛 _getCurrentCargo: Normalized cargo item', {
                cargo: cargo.cargo,
                hasFormatted: {
                    price: !!cargo.formattedPricePerEP,
                    total: !!cargo.formattedTotalCost
                },
                values: {
                    formattedPrice: cargo.formattedPricePerEP,
                    formattedTotal: cargo.formattedTotalCost
                }
            });
            return cargo;
        });
    }

    /**
     * Update capacity display in real-time
     * @private
     */
    async _updateCapacityDisplayReal() {
        const currentCargo = await this._getCurrentCargo();
        const cargoCapacity = parseInt(this.app.element.querySelector('#cargo-capacity')?.value) || 400;
        const currentLoad = currentCargo.reduce((total, cargo) => total + (cargo.quantity || 0), 0);
        const capacityPercentage = Math.min((currentLoad / cargoCapacity) * 100, 100);
        const isOverCapacity = currentLoad > cargoCapacity;
        
        const capacityBar = this.app.element.querySelector('.capacity-used');
        const currentLoadSpan = this.app.element.querySelector('.current-load');
        const maxCapacitySpan = this.app.element.querySelector('.max-capacity');
        const capacityWarning = this.app.element.querySelector('.over-capacity-warning');
        
        if (capacityBar) {
            capacityBar.style.width = `${capacityPercentage}%`;
            capacityBar.classList.toggle('over-capacity', isOverCapacity);
        }
        
        if (currentLoadSpan) {
            currentLoadSpan.textContent = currentLoad;
            currentLoadSpan.classList.toggle('over-capacity', isOverCapacity);
        }
        
        if (maxCapacitySpan) {
            maxCapacitySpan.textContent = cargoCapacity;
        }
        
        if (capacityWarning) {
            capacityWarning.style.display = isOverCapacity ? 'inline' : 'none';
        }
        
        this._logDebug('Cargo Management', 'Capacity display updated', {
            currentLoad, cargoCapacity, capacityPercentage, isOverCapacity
        });
    }


    /**
     * Switch to cargo tab
     * @private
     */
    _switchToCargoTab() {
        // Remove active class from all tabs and content
        this.app.element.querySelectorAll('.trading-places-tab').forEach(t => t.classList.remove('active'));
        this.app.element.querySelectorAll('.trading-places-tab-content').forEach(content => {
            content.classList.remove('active');
            content.style.display = 'none';
        });
        
        // Activate cargo tab
        const cargoTab = this.app.element.querySelector('.trading-places-tab[data-tab="cargo"]');
        const cargoContent = this.app.element.querySelector('#cargo-tab');
        
        if (cargoTab && cargoContent) {
            cargoTab.classList.add('active');
            cargoContent.classList.add('active');
            cargoContent.style.display = 'block';
        }
        
        this._logDebug('Cargo Management', 'Switched to cargo tab');
    }

    /**
     * Add test cargo to inventory (for debugging/testing purposes)
     * @private
     */
    async _addTestCargo() {
        const testCargo = {
            id: foundry.utils.randomID(),
            cargo: "Grain",
            category: "Bulk Goods",
            quantity: 50,
            pricePerEP: 1.2,
            totalCost: 60,
            settlement: "Altdorf",
            season: "spring",
            date: new Date().toISOString(),
            contraband: false
        };

        const currentCargo = await this._getCurrentCargo();
        currentCargo.push(testCargo);
        const datasetId = this.app.dataManager.activeDatasetName;
        const allCargoData = await game.settings.get(MODULE_ID, "currentCargo") || {};
        if (!allCargoData[datasetId]) {
            allCargoData[datasetId] = [];
        }
        allCargoData[datasetId] = currentCargo;
        await game.settings.set(MODULE_ID, "currentCargo", allCargoData);
        
        ui.notifications.info("Added test cargo: 50 EP of Grain");
        await this.app.refreshUI({ focusTab: 'cargo' });
        
        this._logDebug('Test', 'Test cargo added to inventory');
    }

    /**
     * Clear all cargo from inventory (for debugging/testing purposes)
     * @private
     */
    async _clearAllCargo() {
        const datasetId = this.app.dataManager.activeDatasetName;
        const allCargoData = await game.settings.get(MODULE_ID, "currentCargo") || {};
        allCargoData[datasetId] = [];
        await game.settings.set(MODULE_ID, "currentCargo", allCargoData);
        ui.notifications.info("Cleared all cargo from inventory");
        await this.app.refreshUI({ focusTab: 'cargo' });
        
        this._logDebug('Test', 'All cargo cleared from inventory');
    }

    /**
     * Show dialog for cargo deletion reason
     * @param {Object} cargoItem - The cargo item being deleted
     * @returns {Promise<string|null>} The reason or null if cancelled
     * @private
     */
    async _showDeleteCargoDialog(cargoItem) {
        return new Promise((resolve) => {
            const dialog = new Dialog({
                title: "Remove Cargo",
                content: `
                    <p>Why are you removing <strong>${cargoItem.quantity} EP of ${cargoItem.cargo}</strong>?</p>
                    <div class="form-group">
                        <label>Reason (optional):</label>
                        <input type="text" id="removal-reason" placeholder="e.g., sold privately, lost, mistake..." style="width: 100%; margin-top: 5px;" />
                    </div>
                `,
                buttons: {
                    remove: {
                        icon: '<i class="fas fa-trash"></i>',
                        label: "Remove Cargo",
                        callback: (html) => {
                            const reason = html.find('#removal-reason').val().trim();
                            resolve(reason);
                        }
                    },
                    cancel: {
                        icon: '<i class="fas fa-times"></i>',
                        label: "Cancel",
                        callback: () => resolve(null)
                    }
                },
                default: "remove",
                close: () => resolve(null)
            });

            dialog.render(true);
        });
    }

    /**
     * Toggle the add cargo form collapse/expand
     * @param {Event} event - Click event
     * @private
     */
    _onToggleAddCargo(event) {
        event.preventDefault();
        
        const toggle = event.currentTarget;
        const form = this.app.element.querySelector('.add-cargo-form');
        
        if (!form) return;
        
        const isCollapsed = form.classList.contains('collapsed');
        
        if (isCollapsed) {
            // Expand
            form.classList.remove('collapsed');
            toggle.classList.add('expanded');
            
            // Ensure cargo autocomplete is populated when form is expanded
            this._populateAddCargoAutocomplete();
            
            // Focus on the first input after animation
            setTimeout(() => {
                const firstInput = form.querySelector('#add-cargo-name');
                if (firstInput) firstInput.focus();
            }, 300);
            
        } else {
            // Collapse
            form.classList.add('collapsed');
            toggle.classList.remove('expanded');
        }
        
        this._logDebug('Add Cargo', `Form ${isCollapsed ? 'expanded' : 'collapsed'}`);
    }

    /**
     * Update the cost preview for add cargo in real-time
     * @private
     */
    _updateAddCargoCostPreview() {
        const quantityInput = this.app.element.querySelector('#add-cargo-quantity');
        const totalPriceInput = this.app.element.querySelector('#add-cargo-price');
        const pricePreview = this.app.element.querySelector('.price-preview strong');
        
        if (!quantityInput || !totalPriceInput || !pricePreview) return;
        
        const quantity = parseFloat(quantityInput.value);
        const totalPrice = parseFloat(totalPriceInput.value);
        
        if (Number.isFinite(quantity) && quantity > 0 && Number.isFinite(totalPrice) && totalPrice > 0) {
            const pricePerEP = totalPrice / quantity;
            pricePreview.textContent = this._formatCurrencyFromDenomination(pricePerEP, '--');
        } else if (quantity > 0 && (isNaN(totalPrice) || totalPrice === 0)) {
            pricePreview.textContent = '?';
        } else {
            pricePreview.textContent = '--';
        }
    }

    /**
     * Handle cargo input change to auto-select category for add cargo
     * @param {Event} event - Input/change event
     * @private
     */
    async _onAddCargoInputChange(event) {
        const cargoName = event.target.value.trim();
        
        if (!cargoName || !this.addCargoTypesData) {
            return;
        }
        
        // Find matching cargo type
        const matchingCargo = this.addCargoTypesData.cargoTypes.find(cargo => 
            cargo.name.toLowerCase() === cargoName.toLowerCase()
        );
        
        if (matchingCargo) {
            const categorySelect = this.app.element.querySelector('#add-cargo-category');
            if (categorySelect) {
                categorySelect.value = matchingCargo.category;
                
                this._logDebug('Add Cargo Auto-Select', 'Category auto-selected for cargo', {
                    cargo: cargoName,
                    category: matchingCargo.category
                });
            }
        }
    }

    /**
     * Populate cargo types for add cargo autocomplete
     * @private
     */
    async _populateAddCargoAutocomplete() {
        try {
            // Get cargo types from DataManager instead of fetching file
            const dataManager = window.TradingPlaces?.getDataManager();
            if (!dataManager) {
                throw new Error('DataManager not available');
            }
            
            const cargoData = dataManager.getCargoTypes();
            const datalist = this.app.element.querySelector('#add-cargo-datalist');
            const categorySelect = this.app.element.querySelector('#add-cargo-category');
            
            if (!cargoData || cargoData.length === 0) {
                return;
            }
            
            // Store cargo data for auto-select functionality
            this.addCargoTypesData = { cargoTypes: cargoData };
            
            // Populate cargo autocomplete datalist
            if (datalist) {
                // Clear existing options
                datalist.innerHTML = '';
                
                // Add cargo types as options
                cargoData.forEach(cargo => {
                    const option = document.createElement('option');
                    option.value = cargo.name;
                    option.textContent = `${cargo.name} (${cargo.category})`;
                    datalist.appendChild(option);
                });
            }
            
            // Populate category dropdown
            if (categorySelect) {
                // Get unique categories from cargo types
                const categories = [...new Set(cargoData.map(cargo => cargo.category))].sort();
                
                // Clear existing options (keep the default empty option)
                const defaultOption = categorySelect.querySelector('option[value=""]');
                categorySelect.innerHTML = '';
                if (defaultOption) {
                    categorySelect.appendChild(defaultOption);
                } else {
                    const emptyOption = document.createElement('option');
                    emptyOption.value = '';
                    emptyOption.textContent = 'Category';
                    categorySelect.appendChild(emptyOption);
                }
                
                // Add category options
                categories.forEach(category => {
                    const option = document.createElement('option');
                    option.value = category;
                    option.textContent = category;
                    categorySelect.appendChild(option);
                });
            }
            
            this._logDebug('Add Cargo Autocomplete', 'Populated cargo types and categories', {
                cargoCount: cargoData.length,
                categoryCount: categorySelect ? categorySelect.options.length - 1 : 0 // -1 for default option
            });
            
        } catch (error) {
            this._logError('Add Cargo Autocomplete', 'Failed to load cargo types and categories', {
                error: error.message
            });
        }
    }

    /**
     * Handle adding cargo to inventory
     * @param {Event} event - Click event
     * @private
     */
    async _onAddCargo(event) {
        event.preventDefault();
        
        try {
            // Ensure currentCargo is loaded from settings first
            if (!this.app.currentCargo || !Array.isArray(this.app.currentCargo)) {
                const datasetId = this.app.dataManager.activeDatasetName;
                const allCargoData = await game.settings.get(MODULE_ID, "currentCargo") || {};
                const savedCargo = allCargoData[datasetId] || [];
                this.app.currentCargo = savedCargo;
                this._logDebug('Add Cargo', 'Loaded currentCargo from settings', {
                    cargoCount: savedCargo.length
                });
            }

            // Get form values
            const cargoName = this.app.element.querySelector('#add-cargo-name')?.value?.trim();
            const category = this.app.element.querySelector('#add-cargo-category')?.value;
            const quantity = parseFloat(this.app.element.querySelector('#add-cargo-quantity')?.value);
            const totalPrice = parseFloat(this.app.element.querySelector('#add-cargo-price')?.value);
            const settlement = this.app.element.querySelector('#add-cargo-settlement')?.value?.trim() || 'Unknown';
            const season = this.app.element.querySelector('#add-cargo-season')?.value;
            
            // Validate inputs
            const validation = this._validateAddCargoInputs({
                cargoName, category, quantity
            });
            
            if (!validation.valid) {
                ui.notifications.error(validation.error);
                return;
            }
            
            // Calculate pricePerEP and totalCost based on total price input
            let pricePerEP = 0;
            let totalCost = 0;

            if (Number.isFinite(totalPrice) && totalPrice > 0) {
                totalCost = totalPrice;
                pricePerEP = totalPrice / quantity;
            }
            // If totalPrice is NaN or 0, both totalCost and pricePerEP remain 0

            const pricePerEPCanonical = this._convertDenominationToCanonical(pricePerEP);
            const totalCostCanonical = this._convertDenominationToCanonical(totalCost);

            // Create cargo object
            const cargoItem = this._augmentTransaction({
                id: foundry.utils.randomID(),
                cargo: cargoName,
                category: category,
                quantity: quantity,
                pricePerEP: Number.isFinite(pricePerEP) ? pricePerEP : 0,
                pricePerEPCanonical: typeof pricePerEPCanonical === 'number' ? pricePerEPCanonical : null,
                totalCost: Number.isFinite(totalCost) ? totalCost : 0,
                totalCostCanonical: typeof totalCostCanonical === 'number' ? totalCostCanonical : null,
                settlement: settlement,
                season: season,
                date: new Date().toISOString(),
                contraband: false // TODO: Add contraband detection
            });
            
            // Add to current cargo - ensure it's properly initialized
            if (!this.app.currentCargo || !Array.isArray(this.app.currentCargo)) {
                this.app.currentCargo = [];
            }
            this.app.currentCargo.push(cargoItem);
            
            // Create corresponding transaction for history
            const transaction = this._augmentTransaction({
                cargo: cargoName,
                category: category,
                quantity: quantity,
                pricePerEP: Number.isFinite(pricePerEP) ? pricePerEP : 0,
                pricePerEPCanonical: typeof pricePerEPCanonical === 'number' ? pricePerEPCanonical : null,
                totalCost: Number.isFinite(totalCost) ? totalCost : 0,
                totalCostCanonical: typeof totalCostCanonical === 'number' ? totalCostCanonical : null,
                settlement: settlement,
                season: season,
                date: new Date().toISOString(),
                discountPercent: 0,
                isSale: false,
                contraband: false,
                isManualAddition: true
            });
            
            // Add to transaction history
            if (!this.app.transactionHistory) {
                this.app.transactionHistory = [];
            }
            this.app.transactionHistory.unshift(transaction);
            
            console.log('🚛 CARGO_PERSIST: Manual cargo addition', {
                cargo: cargoType,
                quantity: quantity,
                totalCargo: this.app.currentCargo.length
            });
            
            // Save both cargo and history to DataManager
            this.app.dataManager.cargo = this.app.currentCargo;
            this.app.dataManager.history = this.app.transactionHistory;
            await this.app.dataManager.saveCurrentDataset();
            
            console.log('🚛 CARGO_PERSIST: Manual addition saved to dataset');
            
            this._logDebug('Add Cargo', 'Saved cargo data', {
                currentCargoLength: this.app.currentCargo.length,
                savedCargo: this.app.currentCargo
            });
            
            // Clear and collapse the form
            this._clearAddCargoForm();
            this._collapseAddCargo();
            
            await this.app.refreshUI({ focusTab: 'cargo' });
            
            // Show success message
            const formattedPricePerEP = transaction.formattedPricePerEP
                || (Number.isFinite(pricePerEP) ? this._formatCurrencyFromDenomination(pricePerEP) : null);
            const formattedTotalCost = transaction.formattedTotalCost
                || (Number.isFinite(totalCost) ? this._formatCurrencyFromDenomination(totalCost) : null);
            const priceText = formattedPricePerEP ? ` at ${formattedPricePerEP}/EP` : '';
            const totalText = formattedTotalCost ? ` (total ${formattedTotalCost})` : '';
            ui.notifications.success(`Added ${quantity} EP of ${cargoName}${priceText}${totalText}`);
            
            this._logInfo('Add Cargo', 'Cargo added successfully', {
                cargo: cargoName, quantity, totalCost, settlement, season
            });
            
        } catch (error) {
            this._logError('Add Cargo', 'Failed to add cargo', { error: error.message });
            ui.notifications.error(`Failed to add cargo: ${error.message}`);
        }
    }

    /**
     * Validate add cargo inputs
     * @param {Object} inputs - Input values to validate
     * @returns {Object} Validation result
     * @private
     */
    _validateAddCargoInputs(inputs) {
        const { cargoName, category, quantity } = inputs;
        
        if (!cargoName) return { valid: false, error: 'Cargo name is required' };
        if (!category) return { valid: false, error: 'Category is required' };
        if (!quantity || isNaN(quantity) || quantity <= 0) return { valid: false, error: 'Valid quantity (EP) is required' };
        
        return { valid: true };
    }

    /**
     * Clear the add cargo form
     * @private
     */
    _clearAddCargoForm() {
        const form = this.app.element.querySelector('.add-cargo-form');
        if (!form) return;
        
        form.querySelector('#add-cargo-name').value = '';
        form.querySelector('#add-cargo-category').value = '';
        form.querySelector('#add-cargo-quantity').value = '';
        form.querySelector('#add-cargo-price').value = '';
        
        // Reset cost preview
        const costPreview = form.querySelector('.total-cost-preview strong');
        if (costPreview) costPreview.textContent = '--';
    }
    
    /**
     * Collapse the add cargo form
     * @private
     */
    _collapseAddCargo() {
        const toggle = this.app.element.querySelector('.add-cargo-toggle');
        const form = this.app.element.querySelector('.add-cargo-form');
        
        if (toggle && form) {
            form.classList.add('collapsed');
            toggle.classList.remove('expanded');
        }
    }

    /**
     * Handle editing cargo
     * @param {Event} event - Click event
     * @private
     */

    /**
     * Update buying cargo card after a purchase
     * @param {Object} cargo - Cargo data with updated availability
     * @param {number} purchasedQuantity - Amount that was purchased
     * @private
     */
    _updateBuyingCargoCard(cargo, purchasedQuantity) {
        const card = this.app.element.querySelector(`#buying-tab .cargo-card[data-slot="${cargo.slotNumber}"]`);
        if (!card) return;

        // Update "Available" amount
        const availableElement = card.querySelector('.price-info .price-value');
        if (availableElement) {
            availableElement.textContent = `${cargo.quantity} EP`;
        }

        // Update total price (quantity * price per EP)
        const totalPriceElements = card.querySelectorAll('.price-info .price-value');
        if (totalPriceElements.length >= 3) {
            const totalPriceElement = totalPriceElements[2]; // Third price-info is total price
            const aggregatePrice = (Number.isFinite(cargo.quantity) ? cargo.quantity : 0) * (Number.isFinite(cargo.pricePerEP) ? cargo.pricePerEP : 0);
            totalPriceElement.textContent = this._formatCurrencyFromDenomination(aggregatePrice, '--');
        }

        // If quantity is 0, deactivate the card (make it look like a failed slot)
        if (cargo.quantity <= 0) {
            card.classList.remove('slot-success');
            card.classList.add('slot-failure');
            
            // Disable all controls
            const quantityInput = card.querySelector('.quantity-input');
            const quantitySlider = card.querySelector('.quantity-slider');
            const discountSlider = card.querySelector('.discount-slider');
            const buyBtn = card.querySelector('.buy-btn');
            
            if (quantityInput) quantityInput.disabled = true;
            if (quantitySlider) quantitySlider.disabled = true;
            if (discountSlider) discountSlider.disabled = true;
            if (buyBtn) {
                buyBtn.disabled = true;
                buyBtn.innerHTML = '<i class="fas fa-times"></i> Sold Out';
                buyBtn.classList.remove('btn-success');
                buyBtn.classList.add('btn-secondary');
            }
            
            // Update the total price display
            const totalPriceValue = card.querySelector('.total-price-value');
            if (totalPriceValue) {
                totalPriceValue.textContent = this._formatCurrencyFromDenomination(0, '0');
            }
        } else {
            // Update quantity controls max values
            const quantityInput = card.querySelector('.quantity-input');
            const quantitySlider = card.querySelector('.quantity-slider');
            
            if (quantityInput) {
                quantityInput.max = cargo.quantity;
                if (parseInt(quantityInput.value) > cargo.quantity) {
                    quantityInput.value = cargo.quantity;
                }
            }
            if (quantitySlider) {
                quantitySlider.max = cargo.quantity;
                if (parseInt(quantitySlider.value) > cargo.quantity) {
                    quantitySlider.value = cargo.quantity;
                }
            }
            
            // Recalculate total price with new quantity
            const quantity = Math.min(parseInt(quantityInput?.value) || 1, cargo.quantity);
            const discountPercent = parseFloat(card.querySelector('.discount-slider')?.value) || 0;
            const discountMultiplier = 1 + (discountPercent / 100);
            const adjustedPricePerEP = cargo.pricePerEP * discountMultiplier;
            const totalPrice = quantity * adjustedPricePerEP;
            
            const totalPriceValue = card.querySelector('.total-price-value');
            if (totalPriceValue) {
                totalPriceValue.textContent = this._formatCurrencyFromDenomination(totalPrice, '--');
            }
        }
    }

    /**
     * Handle opening data management UI (GM only)
     * @param {Event} event - Click event
     * @private
     */
    async _onOpenDataManagement(event) {
        event.preventDefault();

        try {
            // Use the new ApplicationV2 data management
            if (window.DataManagementV2) {
                // Get dataManager from the global TradingPlaces object instead of this.app.dataManager
                // to ensure it's available even if the app was initialized before the ready hook
                const dataManager = window.TradingPlaces?.getDataManager();
                if (!dataManager) {
                    throw new Error('DataManager not available - module may not be fully initialized');
                }
                
                const app = new window.DataManagementV2(dataManager);
                await app.render(true);
                this._logDebug('Data Management', 'Opened ApplicationV2 data management UI');
            } else {
                throw new Error('DataManagementV2 not loaded');
            }
        } catch (error) {
            console.error('Failed to open data management UI:', error);
            this._logError('Data Management', 'Failed to open data management UI', error);
            ui.notifications.error('Failed to open data management interface');
        }
    }

    /**
     * Handle posting cargo contents to chat
     * @param {Event} event - Click event
     * @private
     */
    async _onPostCargoToChat(event) {
        event.preventDefault();

        try {
            // Get current cargo data
            const currentCargo = await this._getCurrentCargo();

            if (!currentCargo || currentCargo.length === 0) {
                ui.notifications.warn('No cargo to post to chat');
                return;
            }

            // Check if contraband status should be hidden
            const hideContrabandCheckbox = this.app.element.querySelector('#hide-contraband-status');
            const hideContraband = hideContrabandCheckbox?.checked || false;

            // Calculate total load and capacity
            const cargoCapacity = await game.settings.get(MODULE_ID, "cargoCapacity") || 400;
            const currentLoad = currentCargo.reduce((total, cargo) => total + (cargo.quantity || 0), 0);
            const capacityPercentage = Math.min((currentLoad / cargoCapacity) * 100, 100);

            // Build structured chat message content
            let content = `<div class="trading-places-cargo-chat">
                <div class="cargo-header">
                    📦 <strong>Cargo Manifest</strong> (${currentLoad}/${cargoCapacity} EP - ${capacityPercentage.toFixed(1)}% capacity)
                </div>
                <table class="cargo-table">`;

            // Add each cargo item as a table row
            currentCargo.forEach(cargo => {
                const formattedPrice = cargo.formattedPricePerEP || this._formatCurrencyFromDenomination(cargo.pricePerEP, '--');
                const formattedTotal = cargo.formattedTotalCost || this._formatCurrencyFromDenomination(cargo.totalCost, '--');
                const contrabandStatus = (!hideContraband && cargo.contraband) ? '⚠️ Contraband' : '';

                content += `<tr class="cargo-item-row">
                    <td class="cargo-item-cell">
                        <div class="cargo-title"><strong>${cargo.cargo}</strong> (${cargo.category}): <strong>${cargo.quantity} EP</strong></div>
                        <div class="cargo-cost">Cost: ${formattedTotal} (${formattedPrice} per EP)</div>
                        <div class="cargo-origin">${cargo.settlement}</div>
                        ${contrabandStatus ? `<div class="cargo-contraband">${contrabandStatus}</div>` : ''}
                    </td>
                </tr>`;
            });

            content += `</table></div>`;

            // Get chat visibility setting
            const chatVisibility = game.settings.get(MODULE_ID, "chatVisibility");
            const whisperTargets = chatVisibility === "gm" ? [game.user.id] : null;

            // Post to chat
            await ChatMessage.create({
                content: content,
                whisper: whisperTargets,
                speaker: {
                    alias: game.user.name,
                    actor: game.user.character?.id || null
                }
            });

            ui.notifications.info('Cargo manifest posted to chat');
            this._logInfo('Chat Integration', 'Cargo contents posted to chat', {
                cargoCount: currentCargo.length,
                totalLoad: currentLoad,
                visibility: chatVisibility,
                hideContraband: hideContraband
            });

        } catch (error) {
            this._logError('Chat Integration', 'Failed to post cargo to chat', { error: error.message });
            ui.notifications.error(`Failed to post cargo to chat: ${error.message}`);
        }
    }

}
