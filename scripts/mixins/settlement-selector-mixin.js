/**
 * Settlement Selector Mixin
 * Handles settlement selection, region changes, and settlement initialization
 */

const SettlementSelectorMixin = {
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
    },

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
    },

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
    },

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
            this.renderer._populateSellingResources();

            // Show notification
            if (ui.notifications) {
                ui.notifications.info(`Selected ${settlement.name} in ${settlement.region}`);
            }
        } else {
            this._logError('Settlement Selector', 'Settlement not found', { settlementName });
        }
    }
};

// Export the mixin
window.SettlementSelectorMixin = SettlementSelectorMixin;