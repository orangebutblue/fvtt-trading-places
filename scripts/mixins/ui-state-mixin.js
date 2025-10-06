/**
 * UI State Management Mixin
 * Handles UI state updates, button states, and transaction button management
 */

const UIStateMixin = {
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

        // Update renderer UI state (for tooltip attachments, etc.)
        if (this.renderer && typeof this.renderer._updateUIState === 'function') {
            this.renderer._updateUIState();
        }
    },

    /**
     * Update transaction button states based on current context
     * @private
     */
    _updateTransactionButtons() {
    const hasSettlement = !!this.selectedSettlement;
    const hasSeason = !!this.currentSeason;
    const hasTradableCargo = Array.isArray(this.successfulCargo) && this.successfulCargo.length > 0;

        // Get button elements
        const haggleBtn = this.element.querySelector('.haggle-button');
        const saleBtn = this.element.querySelector('.sale-button');
        const desperateSaleBtn = this.element.querySelector('.desperate-sale-button');
        const rumorSaleBtn = this.element.querySelector('.rumor-sale-button');

        // Enable/disable buttons based on context
        if (haggleBtn) {
            haggleBtn.disabled = !hasSettlement || !hasTradableCargo || !hasSeason;
            haggleBtn.title = this._getButtonTooltip('haggle', hasSettlement, hasTradableCargo, hasSeason);
        }

        if (saleBtn) {
            saleBtn.disabled = !hasSettlement || !hasSeason;
            saleBtn.title = this._getButtonTooltip('sale', hasSettlement, hasTradableCargo, hasSeason);
        }

        if (desperateSaleBtn) {
            const isTradeSettlement = this.dataManager?.isTradeSettlement(this.selectedSettlement);
            desperateSaleBtn.disabled = !hasSettlement || !hasSeason || !isTradeSettlement;
            desperateSaleBtn.title = this._getButtonTooltip('desperate_sale', hasSettlement, hasTradableCargo, hasSeason, isTradeSettlement);
        }

        if (rumorSaleBtn) {
            rumorSaleBtn.disabled = !hasSettlement || !hasSeason;
            rumorSaleBtn.title = this._getButtonTooltip('rumor_sale', hasSettlement, hasTradableCargo, hasSeason);
        }

        this._logDebug('UI State', 'Transaction buttons updated', {
            hasSettlement,
            hasTradableCargo,
            hasSeason,
            buttonsFound: {
                haggle: !!haggleBtn,
                sale: !!saleBtn,
                desperateSale: !!desperateSaleBtn,
                rumorSale: !!rumorSaleBtn
            }
        });
    },

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
    _getButtonTooltip(buttonType, hasSettlement, hasTradableCargo, hasSeason, isTradeSettlement = false) {
        if (!hasSeason) {
            return 'Please set the current season first';
        }
        if (!hasSettlement) {
            return 'Please select a settlement first';
        }

        switch (buttonType) {
            case 'haggle':
                return hasTradableCargo ? 'Attempt to negotiate better prices' : 'Check cargo availability first';
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
    },

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

            // Update UI with restored cargo data if available
            if (this.availableCargo && this.availableCargo.length > 0) {
                console.log('🔄 CARGO PERSISTENCE: Updating UI renderer with restored cargo data after render', {
                    availableCargoLength: this.availableCargo.length,
                    successfulCargoLength: this.successfulCargo.length,
                    hasRenderer: !!this.renderer,
                    hasUpdateMethod: !!(this.renderer && typeof this.renderer._updateCargoDisplay === 'function')
                });
                if (this.renderer && typeof this.renderer._updateCargoDisplay === 'function') {
                    this.renderer._updateCargoDisplay(this.availableCargo);
                    
                    // Also update transaction buttons since cargo availability affects them
                    if (typeof this.renderer._updateTransactionButtons === 'function') {
                        this.renderer._updateTransactionButtons();
                    }
                } else {
                    console.warn('🔄 CARGO PERSISTENCE: UI renderer not available or missing _updateCargoDisplay method');
                }
            } else {
                console.log('🔄 CARGO PERSISTENCE: No cargo data to update UI with', {
                    availableCargo: this.availableCargo,
                    availableCargoLength: this.availableCargo ? this.availableCargo.length : 'undefined',
                    successfulCargoLength: this.successfulCargo ? this.successfulCargo.length : 'undefined'
                });
            }

            // Update UI state
            this._updateUIState();

            this._logInfo('Application State', 'Application state initialized successfully');

        } catch (error) {
            this._logError('Application State', 'Failed to initialize application state', { error: error.message });
            ui.notifications.error(`Application initialization failed: ${error.message}`);
        }
    }
};

// Export the mixin
window.UIStateMixin = UIStateMixin;