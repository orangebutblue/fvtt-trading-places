
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
                const discountText = discountPercent !== 0 ? ` (${discountPercent >= 0 ? '+' : ''}${discountPercent}% adjustment)` : '';
                ui.notifications.success(`Successfully purchased ${quantity} EP of ${cargo.name} for ${totalCost.toFixed(2)} GC${discountText}`);

                // Re-render to update the UI
                await this.app.render(false);

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
        game.settings.set("trading-places", "selectedRegion", selectedRegion);
        game.settings.set("trading-places", "selectedSettlement", null);
        
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
        
        if (quantity > 0 && totalCost >= 0) {
            const pricePerEP = (totalCost / quantity).toFixed(2);
            pricePreview.textContent = `${pricePerEP} GC`;
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
            
            // Validate inputs
            const validation = this._validateManualTransactionInputs({
                cargoName, category, quantity, totalCost, settlement, season
            });
            
            if (!validation.valid) {
                ui.notifications.error(validation.error);
                return;
            }
            
            // Calculate price per EP
            const pricePerEP = totalCost / quantity;
            
            // Create transaction object
            const transaction = {
                cargo: cargoName,
                category: category,
                quantity: quantity,
                pricePerEP: parseFloat(pricePerEP.toFixed(2)),
                totalCost: parseFloat(totalCost.toFixed(2)),
                settlement: settlement,
                season: season,
                date: new Date().toISOString(),
                discountPercent: 0,
                isManualEntry: true
            };
            
            // Add to transaction history (at the beginning so newest appears on top)
            if (!this.app.transactionHistory) {
                this.app.transactionHistory = [];
            }
            this.app.transactionHistory.unshift(transaction);
            
            // Save to game settings
            await game.settings.set("trading-places", "transactionHistory", this.app.transactionHistory);
            
            // Clear and collapse the form
            this._clearManualTransactionForm();
            this._collapseManualEntry();
            
            // Re-render to show the new transaction (keeping history tab active)
            await this._rerenderWithHistoryTabActive();
            
            // Show success message
            ui.notifications.success(`Added: ${quantity} EP of ${cargoName} for ${totalCost} GC`);
            
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
        const { cargoName, category, quantity, totalCost, settlement, season } = inputs;
        
        if (!cargoName) return { valid: false, error: 'Cargo name is required' };
        if (!category) return { valid: false, error: 'Category is required' };
        if (!quantity || isNaN(quantity) || quantity <= 0) return { valid: false, error: 'Valid quantity (EP) is required' };
        if (isNaN(totalCost) || totalCost < 0) return { valid: false, error: 'Valid total cost is required' };
        if (!settlement) return { valid: false, error: 'Settlement name is required' };
        if (!season) return { valid: false, error: 'Season is required' };
        
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
     * Re-render while keeping history tab active
     * @private
     */
    async _rerenderWithHistoryTabActive() {
        await this.app.render(false);
        
        setTimeout(() => {
            const tabs = this.app.element.querySelectorAll('.tab');
            const tabContents = this.app.element.querySelectorAll('.tab-content');
            
            tabs.forEach(t => t.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));
            
            const historyTab = this.app.element.querySelector('.tab[data-tab="history"]');
            const historyContent = this.app.element.querySelector('#history-tab');
            
            if (historyTab && historyContent) {
                historyTab.classList.add('active');
                historyContent.classList.add('active');
            }
        }, 50);
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
                
                // Save updated transaction history
                await game.settings.set("trading-places", "transactionHistory", this.app.transactionHistory);
                
                // Store the current active tab before re-rendering
                const currentActiveTab = this.app.element.querySelector('.tab.active');
                const activeTabId = currentActiveTab ? currentActiveTab.getAttribute('data-tab') : 'history';
                
                // Re-render the application to update the history tab
                await this.app.render(false);
                
                // Restore the active tab after re-rendering
                setTimeout(() => {
                    const tabs = this.app.element.querySelectorAll('.tab');
                    const tabContents = this.app.element.querySelectorAll('.tab-content');
                    
                    // Remove active class from all tabs and content
                    tabs.forEach(t => t.classList.remove('active'));
                    tabContents.forEach(content => content.classList.remove('active'));
                    
                    // Activate the history tab
                    const historyTab = this.app.element.querySelector('.tab[data-tab="history"]');
                    const historyContent = this.app.element.querySelector('#history-tab');
                    
                    if (historyTab && historyContent) {
                        historyTab.classList.add('active');
                        historyContent.classList.add('active');
                    }
                }, 50);
                
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

}
