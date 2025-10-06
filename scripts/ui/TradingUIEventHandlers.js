
console.log('Trading Places | Loading TradingUIEventHandlers.js');

import { BuyingFlow } from '../flow/BuyingFlow.js';
import { SellingFlow } from '../flow/SellingFlow.js';

export class TradingUIEventHandlers {
    constructor(app) {
        this.app = app;
        this.buyingFlow = new BuyingFlow(app);
        this.sellingFlow = new SellingFlow(app);
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

            // Save to Foundry settings for persistence
            game.settings.set("trading-places", "selectedSettlement", settlement.name);

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
        const cargoItems = this.app.element.querySelectorAll('.cargo-item');
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
     * Handle selling resource selection
     * @param {string} resourceName - Name of selected resource
     * @private
     */
    _onSellingResourceSelect(resourceName) {
        console.log(`🎯 SELECTED RESOURCE FOR SELLING: ${resourceName}`);
        
        // Remove selection from other buttons
        this.app.element.querySelectorAll('.resource-btn').forEach(btn => {
            btn.classList.remove('selected');
        });
        
        // Add selection to clicked button
        const selectedButton = this.app.element.querySelector(`[data-resource="${resourceName}"]`);
        if (selectedButton) {
            selectedButton.classList.add('selected');
        }
        
        // Store selected resource
        this.app.selectedResource = resourceName;
        
        // Show selling interface
        const sellingInterface = this.app.element.querySelector('#selling-interface');
        if (sellingInterface) {
            sellingInterface.style.display = 'block';
        }
        
        // Enable selling buttons
        const lookForSellersBtn = this.app.element.querySelector('#look-for-sellers');
        const negotiateBtn = this.app.element.querySelector('#negotiate-sell');
        const desperateSaleBtn = this.app.element.querySelector('#desperate-sale');
        
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
        game.settings.set("trading-places", "selectedRegion", selectedRegion);
        game.settings.set("trading-places", "selectedSettlement", null);
        
        // Re-render to update the settlement dropdown with filtered settlements
        this.app.render(false);
        
        this._logDebug('Region Selection', `Region set to ${selectedRegion}, settlements will be filtered`);
    }
}
