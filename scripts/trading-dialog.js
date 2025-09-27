/**
 * WFRP River Trading Module - Trading Dialog
 * UI controller managing the trading interface and user interactions
 */

/**
 * Trading Dialog class extending FoundryVTT Dialog
 * Manages the complete trading interface and user interactions
 */
class TradingDialog extends Dialog {
    constructor(options = {}) {
        // Merge with default dialog options
        const dialogOptions = foundry.utils.mergeObject({
            title: "Trading Places",
            template: "modules/trading-places/templates/trading-dialog.hbs",
            classes: ["wfrp-trading", "dialog"],
            width: 800,
            height: 600,
            resizable: true,
            buttons: {
                close: {
                    icon: '<i class="fas fa-times"></i>',
                    label: "Close",
                    callback: () => this.close()
                }
            },
            default: "close"
        }, options);

        super(dialogOptions);

        // Initialize dialog state
        this.currentSeason = null;
        this.selectedSettlement = null;
        this.selectedCargo = null;
        this.availableCargo = [];
        this.transactionHistory = [];
        
        // Get module components
        this.dataManager = window.WFRPRiverTrading?.getDataManager();
        this.tradingEngine = window.WFRPRiverTrading?.getTradingEngine();
        this.systemAdapter = window.WFRPRiverTrading?.getSystemAdapter();

        // Validate components are available
        if (!this.dataManager || !this.tradingEngine) {
            throw new Error('Trading components not initialized. Please ensure the module is properly loaded.');
        }
    }

    /**
     * Static factory method to create and show trading dialog
     * @param {Object} options - Dialog options
     * @returns {TradingDialog} - Created dialog instance
     */
    static async create(options = {}) {
        const dialog = new TradingDialog(options);
        await dialog.render(true);
        return dialog;
    }

    /**
     * Get dialog data for template rendering
     * @returns {Object} - Template data
     */
    getData() {
        const data = super.getData();
        
        // Add trading-specific data
        data.currentSeason = this.getCurrentSeason();
        data.selectedSettlement = this.selectedSettlement;
        data.availableCargo = this.availableCargo;
        data.transactionHistory = this.transactionHistory;
        data.settlements = this.dataManager?.getAllSettlements() || [];
        
        return data;
    }

    /**
     * Activate event listeners for the dialog
     * @param {jQuery} html - Dialog HTML element
     */
    activateListeners(html) {
        super.activateListeners(html);

        // Season management
        html.find('#current-season').change(this._onSeasonChange.bind(this));
        
        // Settlement selection
        html.find('.settlement-selector').change(this._onSettlementSelect.bind(this));
        html.find('.settlement-search').on('input', this._onSettlementSearch.bind(this));
        
        // Cargo selection and interaction
        html.find('.cargo-item').click(this._onCargoSelect.bind(this));
        html.find('.check-availability').click(this._onCheckAvailability.bind(this));
        
        // Transaction controls
        html.find('.purchase-button').click(this._onPurchaseAttempt.bind(this));
        html.find('.sale-button').click(this._onSaleAttempt.bind(this));
        html.find('.haggle-button').click(this._onHaggleAttempt.bind(this));
        
        // Quantity controls
        html.find('.quantity-input').on('input', this._onQuantityChange.bind(this));
        html.find('.quality-selector').change(this._onQualityChange.bind(this));
        
        // Special sale buttons
        html.find('.desperate-sale-button').click(this._onDesperateSaleAttempt.bind(this));
        html.find('.rumor-sale-button').click(this._onRumorSaleAttempt.bind(this));

        // Initialize dialog state
        this._initializeDialogState(html);
    }

    /**
     * Initialize dialog state on first render
     * @param {jQuery} html - Dialog HTML element
     */
    async _initializeDialogState(html) {
        try {
            // Load current season
            await this._loadCurrentSeason();
            
            // Update season display
            this._updateSeasonDisplay(html);
            
            // Load settlement list
            await this._loadSettlementList(html);
            
            // Check if season is set, prompt if not
            if (!this.currentSeason) {
                await this._promptForSeasonSelection();
            }
            
        } catch (error) {
            console.error('WFRP Trading | Dialog initialization failed:', error);
            ui.notifications.error(`Dialog initialization failed: ${error.message}`);
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

        this.currentSeason = season;
        
        // Update trading engine
        if (this.tradingEngine) {
            this.tradingEngine.setCurrentSeason(season);
        }

        // Update FoundryVTT setting
        await game.settings.set("trading-places", "currentSeason", season);
        
        // Update pricing for any selected cargo
        if (this.selectedCargo) {
            await this._updateCargopricing();
        }

        // Update button states
        this._updateTransactionButtons();

        // Notify season change
        this._notifySeasonChange(season);
    }

    /**
     * Load current season from settings
     */
    async _loadCurrentSeason() {
        try {
            this.currentSeason = await game.settings.get("trading-places", "currentSeason");
            
            if (this.tradingEngine && this.currentSeason) {
                this.tradingEngine.setCurrentSeason(this.currentSeason);
            }
        } catch (error) {
            console.warn('WFRP Trading | Failed to load current season:', error);
            this.currentSeason = null;
        }
    }

    /**
     * Update seasonal pricing for all displayed cargo
     */
    async _updateCargopricing() {
        if (!this.currentSeason || !this.availableCargo.length) {
            return;
        }

        try {
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
                    console.warn(`Failed to update price for ${cargo.name}:`, error);
                    return cargo;
                }
            });

            // Re-render cargo section
            await this._renderCargoSection();
            
        } catch (error) {
            console.error('WFRP Trading | Failed to update cargo pricing:', error);
        }
    }

    /**
     * Prompt user to select season if not set
     */
    async _promptForSeasonSelection() {
        const seasonDialog = new Dialog({
            title: "Select Trading Season",
            content: `
                <div class="season-selection">
                    <p>Please select the current trading season:</p>
                    <select id="season-choice">
                        <option value="spring">Spring</option>
                        <option value="summer">Summer</option>
                        <option value="autumn">Autumn</option>
                        <option value="winter">Winter</option>
                    </select>
                </div>
            `,
            buttons: {
                confirm: {
                    icon: '<i class="fas fa-check"></i>',
                    label: "Confirm",
                    callback: async (html) => {
                        const selectedSeason = html.find('#season-choice').val();
                        await this.setCurrentSeason(selectedSeason);
                        await this.render(false); // Re-render main dialog
                    }
                }
            },
            default: "confirm"
        });

        await seasonDialog.render(true);
    }

    /**
     * Update season display in dialog
     * @param {jQuery} html - Dialog HTML element
     */
    _updateSeasonDisplay(html) {
        if (this.currentSeason) {
            html.find('#current-season').val(this.currentSeason);
        }
    }

    /**
     * Notify users of season change
     * @param {string} season - New season
     */
    _notifySeasonChange(season) {
        ui.notifications.info(`Trading season changed to ${season}. All prices updated.`);
        
        // Post to chat if enabled
        this._postSeasonChangeToChat(season);
    }

    /**
     * Post season change notification to chat
     * @param {string} season - New season
     */
    async _postSeasonChangeToChat(season) {
        try {
            const content = `
                <div class="season-change">
                    <h3>Season Changed</h3>
                    <p>Trading season is now <strong>${season}</strong>. All cargo prices have been updated accordingly.</p>
                </div>
            `;

            await this._postToChat(content, true); // GM-only by default
            
        } catch (error) {
            console.warn('WFRP Trading | Failed to post season change to chat:', error);
        }
    }

    // ===== SETTLEMENT MANAGEMENT =====

    /**
     * Load settlement list for selection
     * @param {jQuery} html - Dialog HTML element
     */
    async _loadSettlementList(html) {
        try {
            if (!this.dataManager) {
                throw new Error('DataManager not available');
            }

            const settlements = this.dataManager.getAllSettlements();
            
            // Create settlement selector if it doesn't exist
            let settlementSection = html.find('.settlement-info');
            if (settlementSection.length === 0) {
                settlementSection = html.find('.settlement-section');
            }

            const settlementSelector = `
                <div class="settlement-selector-container">
                    <label for="settlement-selector">Select Settlement:</label>
                    <select id="settlement-selector" class="settlement-selector">
                        <option value="">-- Select Settlement --</option>
                        ${settlements.map(settlement => 
                            `<option value="${settlement.name}" data-region="${settlement.region}">
                                ${settlement.name} (${settlement.region})
                            </option>`
                        ).join('')}
                    </select>
                    <input type="text" class="settlement-search" placeholder="Search settlements..." />
                </div>
                <div class="settlement-details">
                    <!-- Settlement details will be populated here -->
                </div>
            `;

            settlementSection.html(settlementSelector);
            
        } catch (error) {
            console.error('WFRP Trading | Failed to load settlement list:', error);
            ui.notifications.error(`Failed to load settlements: ${error.message}`);
        }
    }

    /**
     * Update settlement information display
     * @param {Object} settlement - Selected settlement
     */
    async _updateSettlementInfo(settlement) {
        if (!settlement) {
            return;
        }

        try {
            const settlementInfo = this.tradingEngine.getSettlementInfo(settlement);
            
            const detailsHtml = `
                <div class="settlement-details-content">
                    <h4>${settlementInfo.name}</h4>
                    <div class="settlement-stats">
                        <div class="stat-row">
                            <span class="stat-label">Region:</span>
                            <span class="stat-value">${settlementInfo.region}</span>
                        </div>
                        <div class="stat-row">
                            <span class="stat-label">Size:</span>
                            <span class="stat-value">${settlementInfo.size.description} (${settlementInfo.size.numeric})</span>
                        </div>
                        <div class="stat-row">
                            <span class="stat-label">Wealth:</span>
                            <span class="stat-value">${settlementInfo.wealth.description} (${settlementInfo.wealth.rating})</span>
                        </div>
                        <div class="stat-row">
                            <span class="stat-label">Population:</span>
                            <span class="stat-value">${settlementInfo.population.toLocaleString()}</span>
                        </div>
                        <div class="stat-row">
                            <span class="stat-label">Cargo Availability:</span>
                            <span class="stat-value">${settlementInfo.availabilityChance}%</span>
                        </div>
                        <div class="stat-row">
                            <span class="stat-label">Production:</span>
                            <span class="stat-value">${settlementInfo.productionCategories.join(', ')}</span>
                        </div>
                        ${settlementInfo.isTradeCenter ? '<div class="trade-center-badge">Trade Center</div>' : ''}
                    </div>
                    <div class="settlement-actions">
                        <button class="check-availability" type="button">Check Cargo Availability</button>
                    </div>
                </div>
            `;

            const detailsContainer = this.element.find('.settlement-details');
            detailsContainer.html(detailsHtml);

            // Reactivate listeners for new buttons
            detailsContainer.find('.check-availability').click(this._onCheckAvailability.bind(this));
            
        } catch (error) {
            console.error('WFRP Trading | Failed to update settlement info:', error);
            ui.notifications.error(`Failed to load settlement information: ${error.message}`);
        }
    }

    // ===== CARGO MANAGEMENT =====

    /**
     * Display available cargo list
     * @param {Array} cargoList - List of available cargo
     */
    async _displayAvailableCargo(cargoList) {
        if (!cargoList || cargoList.length === 0) {
            const cargoSection = this.element.find('.cargo-list');
            cargoSection.html('<p class="no-cargo">No cargo available at this settlement.</p>');
            return;
        }

        try {
            const cargoHtml = cargoList.map(cargo => {
                const qualityOptions = this.tradingEngine.hasQualityTiers(cargo.name) 
                    ? this.tradingEngine.getAvailableQualityTiers(cargo.name)
                    : ['average'];

                return `
                    <div class="cargo-item" data-cargo="${cargo.name}">
                        <div class="cargo-header">
                            <h5>${cargo.name}</h5>
                            <span class="cargo-category">${cargo.category || 'Unknown'}</span>
                        </div>
                        <div class="cargo-details">
                            <div class="cargo-price">
                                <span class="price-label">Base Price:</span>
                                <span class="price-value">${cargo.currentPrice || 'N/A'} GC</span>
                            </div>
                            ${cargo.availableQuantity ? `
                                <div class="cargo-quantity">
                                    <span class="quantity-label">Available:</span>
                                    <span class="quantity-value">${cargo.availableQuantity} EP</span>
                                </div>
                            ` : ''}
                            ${qualityOptions.length > 1 ? `
                                <div class="cargo-quality">
                                    <label for="quality-${cargo.name}">Quality:</label>
                                    <select class="quality-selector" data-cargo="${cargo.name}">
                                        ${qualityOptions.map(quality => 
                                            `<option value="${quality}">${quality.charAt(0).toUpperCase() + quality.slice(1)}</option>`
                                        ).join('')}
                                    </select>
                                </div>
                            ` : ''}
                        </div>
                        <div class="cargo-actions">
                            <input type="number" class="quantity-input" data-cargo="${cargo.name}" 
                                   placeholder="Quantity (EP)" min="1" max="${cargo.availableQuantity || 999}" />
                            <button class="purchase-button" data-cargo="${cargo.name}" type="button">Purchase</button>
                        </div>
                    </div>
                `;
            }).join('');

            const cargoSection = this.element.find('.cargo-list');
            cargoSection.html(cargoHtml);

            // Reactivate listeners for new elements
            this._reactivateCargoListeners();
            
            // Enable/disable transaction buttons based on available cargo
            this._updateTransactionButtons();
            
        } catch (error) {
            console.error('WFRP Trading | Failed to display cargo:', error);
            ui.notifications.error(`Failed to display cargo: ${error.message}`);
        }
    }

    /**
     * Re-render cargo section with updated data
     */
    async _renderCargoSection() {
        await this._displayAvailableCargo(this.availableCargo);
    }

    /**
     * Reactivate event listeners for cargo elements
     */
    _reactivateCargoListeners() {
        const html = this.element;
        
        // Remove existing listeners to prevent duplicates
        html.find('.cargo-item').off('click');
        html.find('.purchase-button').off('click');
        html.find('.quantity-input').off('input');
        html.find('.quality-selector').off('change');
        
        // Reactivate listeners
        html.find('.cargo-item').click(this._onCargoSelect.bind(this));
        html.find('.purchase-button').click(this._onPurchaseAttempt.bind(this));
        html.find('.quantity-input').on('input', this._onQuantityChange.bind(this));
        html.find('.quality-selector').change(this._onQualityChange.bind(this));
    }

    /**
     * Update transaction button states based on current context
     */
    _updateTransactionButtons() {
        const html = this.element;
        const hasSettlement = !!this.selectedSettlement;
        const hasCargo = this.availableCargo.length > 0;
        const hasSeason = !!this.currentSeason;
        
        // Enable/disable buttons based on context
        html.find('.haggle-button').prop('disabled', !hasSettlement || !hasCargo || !hasSeason);
        html.find('.sale-button').prop('disabled', !hasSettlement || !hasSeason);
        html.find('.desperate-sale-button').prop('disabled', !hasSettlement || !hasSeason || !this.dataManager?.isTradeSettlement(this.selectedSettlement));
        html.find('.rumor-sale-button').prop('disabled', !hasSettlement || !hasSeason);
        
        // Update button tooltips
        if (!hasSeason) {
            html.find('.haggle-button, .sale-button, .desperate-sale-button, .rumor-sale-button')
                .attr('title', 'Please set the current season first');
        } else if (!hasSettlement) {
            html.find('.haggle-button, .sale-button, .desperate-sale-button, .rumor-sale-button')
                .attr('title', 'Please select a settlement first');
        } else {
            html.find('.haggle-button').attr('title', hasCargo ? 'Attempt to negotiate better prices' : 'Check cargo availability first');
            html.find('.sale-button').attr('title', 'Sell cargo from inventory');
            html.find('.desperate-sale-button').attr('title', 
                this.dataManager?.isTradeSettlement(this.selectedSettlement) 
                    ? 'Sell at 50% price (Trade settlements only)' 
                    : 'Only available at Trade settlements'
            );
            html.find('.rumor-sale-button').attr('title', 'Attempt to find premium buyers (requires Gossip test)');
        }
    }

    // ===== EVENT HANDLERS =====

    /**
     * Handle season change
     * @param {Event} event - Change event
     */
    async _onSeasonChange(event) {
        const newSeason = event.target.value;
        
        try {
            await this.setCurrentSeason(newSeason);
            await this.render(false); // Re-render dialog
        } catch (error) {
            console.error('WFRP Trading | Season change failed:', error);
            ui.notifications.error(`Failed to change season: ${error.message}`);
        }
    }

    /**
     * Handle settlement selection
     * @param {Event} event - Change event
     */
    async _onSettlementSelect(event) {
        const settlementName = event.target.value;
        
        if (!settlementName) {
            this.selectedSettlement = null;
            this.availableCargo = [];
            await this._displayAvailableCargo([]);
            return;
        }

        try {
            const settlement = this.dataManager.getSettlement(settlementName);
            if (!settlement) {
                throw new Error(`Settlement not found: ${settlementName}`);
            }

            this.selectedSettlement = settlement;
            await this._updateSettlementInfo(settlement);
            
            // Clear previous cargo
            this.availableCargo = [];
            await this._displayAvailableCargo([]);
            
            // Update button states
            this._updateTransactionButtons();
            
        } catch (error) {
            console.error('WFRP Trading | Settlement selection failed:', error);
            ui.notifications.error(`Failed to select settlement: ${error.message}`);
        }
    }

    /**
     * Handle settlement search
     * @param {Event} event - Input event
     */
    _onSettlementSearch(event) {
        const searchTerm = event.target.value.toLowerCase();
        const selector = this.element.find('.settlement-selector');
        const options = selector.find('option');

        options.each((index, option) => {
            const optionText = option.textContent.toLowerCase();
            const shouldShow = searchTerm === '' || optionText.includes(searchTerm);
            option.style.display = shouldShow ? '' : 'none';
        });
    }

    /**
     * Handle cargo selection
     * @param {Event} event - Click event
     */
    _onCargoSelect(event) {
        const cargoName = event.currentTarget.dataset.cargo;
        
        // Remove previous selection
        this.element.find('.cargo-item').removeClass('selected');
        
        // Add selection to clicked item
        event.currentTarget.classList.add('selected');
        
        this.selectedCargo = cargoName;
    }

    /**
     * Handle check availability button
     * @param {Event} event - Click event
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

            // Post roll results to chat
            await this._postAvailabilityResultToChat(result);

            if (result.available) {
                // Update available cargo
                this.availableCargo = result.cargoTypes.map(cargoName => ({
                    name: cargoName,
                    category: this.tradingEngine.getCargoByName(cargoName).category,
                    currentPrice: this.tradingEngine.calculateBasePrice(cargoName, this.currentSeason),
                    availableQuantity: result.cargoSize.totalSize
                }));

                await this._displayAvailableCargo(this.availableCargo);
                ui.notifications.info(`Cargo available! Found ${result.cargoTypes.length} type(s).`);
            } else {
                this.availableCargo = [];
                await this._displayAvailableCargo([]);
                ui.notifications.info('No cargo available at this settlement.');
            }

            // Restore button
            button.textContent = originalText;
            button.disabled = false;
            
        } catch (error) {
            console.error('WFRP Trading | Availability check failed:', error);
            await this._displayErrorMessage(error.message, 'Cargo Availability Check');
            
            // Restore button on error
            const button = event.target;
            button.textContent = 'Check Cargo Availability';
            button.disabled = false;
        }
    }

    /**
     * Handle purchase attempt
     * @param {Event} event - Click event
     */
    async _onPurchaseAttempt(event) {
        const cargoName = event.target.dataset.cargo;
        const quantityInput = this.element.find(`.quantity-input[data-cargo="${cargoName}"]`);
        const quantity = parseInt(quantityInput.val());

        if (!quantity || quantity <= 0) {
            ui.notifications.warn('Please enter a valid quantity.');
            return;
        }

        try {
            // Get cargo details
            const cargo = this.availableCargo.find(c => c.name === cargoName);
            if (!cargo) {
                throw new Error(`Cargo not found: ${cargoName}`);
            }

            // Calculate purchase price
            const priceCalculation = this.tradingEngine.calculatePurchasePrice(
                cargoName, 
                quantity, 
                {
                    season: this.currentSeason,
                    isPartialPurchase: quantity < cargo.availableQuantity
                }
            );

            // Show purchase confirmation dialog
            await this._showPurchaseConfirmation(cargo, quantity, priceCalculation);
            
        } catch (error) {
            console.error('WFRP Trading | Purchase attempt failed:', error);
            await this._displayErrorMessage(error.message, 'Purchase Attempt');
        }
    }

    /**
     * Handle sale attempt
     * @param {Event} event - Click event
     */
    async _onSaleAttempt(event) {
        if (!this._preventInvalidTransactions('sale')) {
            return;
        }

        // Show sale dialog to select cargo from inventory
        await this._showSaleDialog();
    }

    /**
     * Handle haggle attempt
     * @param {Event} event - Click event
     */
    async _onHaggleAttempt(event) {
        if (!this.selectedCargo) {
            ui.notifications.warn('Please select cargo first.');
            return;
        }

        if (!this._preventInvalidTransactions('haggle')) {
            return;
        }

        // Show haggle dialog
        await this._showHaggleDialog();
    }

    /**
     * Handle quantity input change
     * @param {Event} event - Input event
     */
    _onQuantityChange(event) {
        const cargoName = event.target.dataset.cargo;
        const quantity = parseInt(event.target.value);
        
        if (quantity && quantity > 0) {
            // Update price calculation display
            this._updatePriceDisplay(cargoName, quantity);
        }
    }

    /**
     * Handle desperate sale attempt
     * @param {Event} event - Click event
     */
    async _onDesperateSaleAttempt(event) {
        if (!this._preventInvalidTransactions('desperate_sale')) {
            return;
        }

        await this._processDesperateSale();
    }

    /**
     * Handle rumor sale attempt
     * @param {Event} event - Click event
     */
    async _onRumorSaleAttempt(event) {
        if (!this._preventInvalidTransactions('rumor_sale')) {
            return;
        }

        await this._processRumorSale();
    }

    /**
     * Handle quality selection change
     * @param {Event} event - Change event
     */
    async _onQualityChange(event) {
        const cargoName = event.target.dataset.cargo;
        const quality = event.target.value;
        
        try {
            // Update price for this cargo with new quality
            const cargo = this.availableCargo.find(c => c.name === cargoName);
            if (cargo) {
                cargo.quality = quality;
                cargo.currentPrice = this.tradingEngine.calculateBasePrice(
                    cargoName, 
                    this.currentSeason, 
                    quality
                );
                
                // Update display
                await this._renderCargoSection();
            }
        } catch (error) {
            console.error('WFRP Trading | Quality change failed:', error);
        }
    }

    /**
     * Update price display for a specific cargo and quantity
     * @param {string} cargoName - Name of the cargo
     * @param {number} quantity - Quantity being considered
     */
    _updatePriceDisplay(cargoName, quantity) {
        try {
            const cargo = this.availableCargo.find(c => c.name === cargoName);
            if (!cargo) return;

            // Calculate price with current settings
            const priceCalculation = this.tradingEngine.calculatePurchasePrice(
                cargoName,
                quantity,
                {
                    season: this.currentSeason,
                    isPartialPurchase: quantity < cargo.availableQuantity,
                    quality: cargo.quality || 'average',
                    haggleResult: this.lastHaggleResult
                }
            );

            // Update the display (could be expanded to show in UI)
            const cargoElement = this.element.find(`.cargo-item[data-cargo="${cargoName}"]`);
            const priceElement = cargoElement.find('.price-value');
            
            if (priceElement.length > 0) {
                priceElement.text(`${priceCalculation.finalPricePerUnit} GC (Total: ${priceCalculation.totalPrice} GC)`);
            }

        } catch (error) {
            console.warn('WFRP Trading | Failed to update price display:', error);
        }
    }

    // ===== HELPER METHODS =====

    /**
     * Show purchase confirmation dialog
     * @param {Object} cargo - Cargo object
     * @param {number} quantity - Quantity to purchase
     * @param {Object} priceCalculation - Price calculation result
     */
    async _showPurchaseConfirmation(cargo, quantity, priceCalculation) {
        const confirmDialog = new Dialog({
            title: "Confirm Purchase",
            content: `
                <div class="purchase-confirmation">
                    <h3>Purchase ${cargo.name}</h3>
                    <div class="purchase-details">
                        <div class="detail-row">
                            <span class="label">Quantity:</span>
                            <span class="value">${quantity} EP</span>
                        </div>
                        <div class="detail-row">
                            <span class="label">Base Price per Unit:</span>
                            <span class="value">${priceCalculation.basePricePerUnit} GC</span>
                        </div>
                        <div class="detail-row">
                            <span class="label">Final Price per Unit:</span>
                            <span class="value">${priceCalculation.finalPricePerUnit} GC</span>
                        </div>
                        <div class="detail-row total">
                            <span class="label">Total Cost:</span>
                            <span class="value">${priceCalculation.totalPrice} GC</span>
                        </div>
                        ${priceCalculation.modifiers.length > 0 ? `
                            <div class="modifiers">
                                <h4>Price Modifiers:</h4>
                                ${priceCalculation.modifiers.map(mod => 
                                    `<div class="modifier">${mod.description}: ${mod.amount > 0 ? '+' : ''}${mod.amount} GC</div>`
                                ).join('')}
                            </div>
                        ` : ''}
                    </div>
                </div>
            `,
            buttons: {
                purchase: {
                    icon: '<i class="fas fa-coins"></i>',
                    label: "Purchase",
                    callback: () => this._executePurchase(cargo, quantity, priceCalculation)
                },
                cancel: {
                    icon: '<i class="fas fa-times"></i>',
                    label: "Cancel"
                }
            },
            default: "purchase"
        });

        await confirmDialog.render(true);
    }

    /**
     * Execute the purchase transaction
     * @param {Object} cargo - Cargo object
     * @param {number} quantity - Quantity to purchase
     * @param {Object} priceCalculation - Price calculation result
     */
    async _executePurchase(cargo, quantity, priceCalculation) {
        try {
            // This would integrate with the system adapter to handle currency/inventory
            // For now, just show success message and post to chat
            
            const transaction = {
                type: 'purchase',
                cargo: cargo.name,
                quantity: quantity,
                settlement: this.selectedSettlement.name,
                season: this.currentSeason,
                totalPrice: priceCalculation.totalPrice,
                timestamp: new Date().toISOString()
            };

            // Add to transaction history
            this.transactionHistory.unshift(transaction);

            // Post to chat with enhanced formatting
            await this._postTransactionSummaryToChat(transaction, priceCalculation, 'purchase');

            // Show success notification
            ui.notifications.info(`Successfully purchased ${quantity} EP of ${cargo.name} for ${priceCalculation.totalPrice} GC`);

            // Update available quantity
            const availableCargo = this.availableCargo.find(c => c.name === cargo.name);
            if (availableCargo) {
                availableCargo.availableQuantity -= quantity;
                await this._renderCargoSection();
            }
            
        } catch (error) {
            console.error('WFRP Trading | Purchase execution failed:', error);
            await this._displayErrorMessage(error.message, 'Purchase Execution');
        }
    }

    /**
     * Post availability check result to chat
     * @param {Object} result - Availability check result
     */
    async _postAvailabilityResultToChat(result) {
        const content = `
            <div class="availability-check">
                <h3>Cargo Availability Check</h3>
                <div class="check-details">
                    <div class="settlement-info">
                        <strong>Settlement:</strong> ${result.availabilityCheck.settlement}
                    </div>
                    <div class="roll-info">
                        <strong>Availability Chance:</strong> ${result.availabilityCheck.chance}%<br>
                        <strong>Roll:</strong> ${result.availabilityCheck.roll} (${result.availabilityCheck.rollResult.formula})
                    </div>
                    <div class="result-info">
                        <strong>Result:</strong> ${result.available ? 'Cargo Available!' : 'No Cargo Available'}
                    </div>
                    ${result.available ? `
                        <div class="cargo-info">
                            <strong>Available Cargo:</strong> ${result.cargoTypes.join(', ')}<br>
                            <strong>Total Quantity:</strong> ${result.cargoSize.totalSize} EP
                            ${result.cargoSize.tradeBonus ? '<br><em>Trade Center Bonus Applied</em>' : ''}
                        </div>
                    ` : ''}
                </div>
            </div>
        `;

        await this._postToChat(content);
    }

    /**
     * Post transaction result to chat
     * @param {Object} transaction - Transaction object
     * @param {Object} priceCalculation - Price calculation details
     */
    async _postTransactionToChat(transaction, priceCalculation) {
        const content = `
            <div class="transaction-result">
                <h3>Trade Completed</h3>
                <div class="transaction-details">
                    <div><strong>Type:</strong> ${transaction.type.charAt(0).toUpperCase() + transaction.type.slice(1)}</div>
                    <div><strong>Settlement:</strong> ${transaction.settlement}</div>
                    <div><strong>Cargo:</strong> ${transaction.cargo} (${transaction.quantity} EP)</div>
                    <div><strong>Final Price:</strong> ${transaction.totalPrice} GC</div>
                    <div><strong>Season:</strong> ${transaction.season}</div>
                    ${priceCalculation.modifiers.length > 0 ? `
                        <div class="modifiers">
                            <strong>Price Modifiers:</strong>
                            ${priceCalculation.modifiers.map(mod => `<br>• ${mod.description}`).join('')}
                        </div>
                    ` : ''}
                </div>
            </div>
        `;

        await this._postToChat(content);
    }

    /**
     * Post message to chat with visibility settings
     * @param {string} content - HTML content to post
     * @param {boolean} gmOnly - Whether message should be GM-only (optional)
     */
    async _postToChat(content, gmOnly = null) {
        try {
            const chatVisibility = await game.settings.get("trading-places", "chatVisibility");
            const shouldWhisper = gmOnly !== null ? gmOnly : (chatVisibility === "gm");
            
            // Wrap content in trading-specific styling
            const wrappedContent = `
                <div class="wfrp-trading-chat">
                    <div class="trading-chat-header">
                        <i class="fas fa-ship"></i>
                        <span>WFRP River Trading</span>
                    </div>
                    <div class="trading-chat-content">
                        ${content}
                    </div>
                </div>
            `;
            
            await ChatMessage.create({
                content: wrappedContent,
                whisper: shouldWhisper ? [game.user.id] : null,
                type: CONST.CHAT_MESSAGE_TYPES.OTHER,
                speaker: {
                    alias: "Trading System"
                }
            });
        } catch (error) {
            console.warn('WFRP Trading | Failed to post to chat:', error);
            // Fallback to notification if chat fails
            ui.notifications.info('Chat message failed to post. Check console for details.');
        }
    }

    /**
     * Post dice roll result to chat with detailed formatting
     * @param {Roll} roll - FoundryVTT Roll object
     * @param {string} context - Context description for the roll
     * @param {Object} options - Additional options
     */
    async _postDiceRollToChat(roll, context, options = {}) {
        try {
            const rollContent = `
                <div class="dice-roll-result">
                    <h4>${context}</h4>
                    <div class="roll-details">
                        <div class="roll-formula">
                            <strong>Formula:</strong> ${roll.formula}
                        </div>
                        <div class="roll-result">
                            <strong>Result:</strong> ${roll.total}
                        </div>
                        ${options.target ? `
                            <div class="roll-target">
                                <strong>Target:</strong> ${options.target}
                            </div>
                        ` : ''}
                        ${options.success !== undefined ? `
                            <div class="roll-success ${options.success ? 'success' : 'failure'}">
                                <strong>Outcome:</strong> ${options.success ? 'Success!' : 'Failure'}
                            </div>
                        ` : ''}
                        ${options.description ? `
                            <div class="roll-description">
                                <em>${options.description}</em>
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;

            await this._postToChat(rollContent, options.gmOnly);
            
        } catch (error) {
            console.error('WFRP Trading | Failed to post dice roll to chat:', error);
        }
    }

    /**
     * Post error message to chat and notifications
     * @param {string} error - Error message
     * @param {string} context - Context where error occurred
     */
    async _displayErrorMessage(error, context = 'Trading Operation') {
        try {
            // Post to chat for record keeping
            const errorContent = `
                <div class="trading-error">
                    <h4>❌ ${context} Failed</h4>
                    <div class="error-details">
                        <strong>Error:</strong> ${error}
                    </div>
                    <div class="error-timestamp">
                        <em>Time: ${new Date().toLocaleTimeString()}</em>
                    </div>
                </div>
            `;

            await this._postToChat(errorContent, true); // GM-only for errors
            
            // Also show notification
            ui.notifications.error(`${context} failed: ${error}`);
            
        } catch (chatError) {
            console.error('WFRP Trading | Failed to display error message:', chatError);
            // Fallback to just notification
            ui.notifications.error(`${context} failed: ${error}`);
        }
    }

    /**
     * Post formatted transaction summary to chat
     * @param {Object} transaction - Transaction details
     * @param {Object} calculation - Price calculation details
     * @param {string} type - Transaction type (purchase/sale)
     */
    async _postTransactionSummaryToChat(transaction, calculation, type = 'transaction') {
        try {
            const isProfit = type === 'sale' && calculation.totalPrice > 0;
            const isLoss = type === 'purchase' && calculation.totalPrice > 0;
            
            const summaryContent = `
                <div class="transaction-summary ${type}">
                    <h3>📊 Transaction Summary</h3>
                    <div class="summary-grid">
                        <div class="summary-section">
                            <h4>Transaction Details</h4>
                            <div class="detail-grid">
                                <div class="detail-row">
                                    <span class="label">Type:</span>
                                    <span class="value">${type.charAt(0).toUpperCase() + type.slice(1)}</span>
                                </div>
                                <div class="detail-row">
                                    <span class="label">Settlement:</span>
                                    <span class="value">${transaction.settlement}</span>
                                </div>
                                <div class="detail-row">
                                    <span class="label">Season:</span>
                                    <span class="value">${transaction.season}</span>
                                </div>
                                <div class="detail-row">
                                    <span class="label">Date:</span>
                                    <span class="value">${new Date(transaction.timestamp).toLocaleDateString()}</span>
                                </div>
                            </div>
                        </div>
                        
                        <div class="summary-section">
                            <h4>Cargo Details</h4>
                            <div class="detail-grid">
                                <div class="detail-row">
                                    <span class="label">Cargo:</span>
                                    <span class="value">${transaction.cargo}</span>
                                </div>
                                <div class="detail-row">
                                    <span class="label">Quantity:</span>
                                    <span class="value">${transaction.quantity} EP</span>
                                </div>
                                ${calculation.quality && calculation.quality !== 'average' ? `
                                    <div class="detail-row">
                                        <span class="label">Quality:</span>
                                        <span class="value">${calculation.quality.charAt(0).toUpperCase() + calculation.quality.slice(1)}</span>
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                        
                        <div class="summary-section">
                            <h4>Financial Details</h4>
                            <div class="detail-grid">
                                <div class="detail-row">
                                    <span class="label">Base Price/Unit:</span>
                                    <span class="value">${calculation.basePricePerUnit} GC</span>
                                </div>
                                <div class="detail-row">
                                    <span class="label">Final Price/Unit:</span>
                                    <span class="value">${calculation.finalPricePerUnit} GC</span>
                                </div>
                                <div class="detail-row total">
                                    <span class="label">Total ${type === 'purchase' ? 'Cost' : 'Revenue'}:</span>
                                    <span class="value ${isProfit ? 'profit' : isLoss ? 'cost' : ''}">${calculation.totalPrice} GC</span>
                                </div>
                            </div>
                        </div>
                        
                        ${calculation.modifiers && calculation.modifiers.length > 0 ? `
                            <div class="summary-section">
                                <h4>Price Modifiers</h4>
                                <div class="modifier-list">
                                    ${calculation.modifiers.map(mod => `
                                        <div class="modifier-row ${mod.amount > 0 ? 'positive' : mod.amount < 0 ? 'negative' : 'neutral'}">
                                            <span class="modifier-desc">${mod.description}</span>
                                            <span class="modifier-amount">${mod.amount > 0 ? '+' : ''}${mod.amount} GC</span>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;

            await this._postToChat(summaryContent);
            
        } catch (error) {
            console.error('WFRP Trading | Failed to post transaction summary:', error);
            // Fallback to basic transaction post
            await this._postTransactionToChat(transaction, calculation);
        }
    }

    /**
     * Validate settlement selection
     * @param {Object} settlement - Settlement to validate
     * @returns {boolean} - Whether settlement is valid for trading
     */
    _validateSettlementSelection(settlement) {
        if (!settlement) {
            ui.notifications.warn('Please select a settlement first.');
            return false;
        }

        const validation = this.tradingEngine.validateSettlementForTrading(settlement);
        if (!validation.valid) {
            ui.notifications.error(`Invalid settlement: ${validation.errors.join(', ')}`);
            return false;
        }

        return true;
    }

    /**
     * Prevent invalid transactions
     * @param {string} operation - Operation being attempted
     * @returns {boolean} - Whether operation should proceed
     */
    _preventInvalidTransactions(operation) {
        if (!this.currentSeason) {
            ui.notifications.warn('Please set the current season before trading.');
            return false;
        }

        if (!this.selectedSettlement) {
            ui.notifications.warn('Please select a settlement first.');
            return false;
        }

        if (!this.tradingEngine || !this.dataManager) {
            ui.notifications.error('Trading system not properly initialized.');
            return false;
        }

        return true;
    }

    /**
     * Show sale dialog for selecting cargo from inventory
     */
    async _showSaleDialog() {
        // This would integrate with system adapter to get player inventory
        // For now, show a placeholder dialog
        
        const saleDialog = new Dialog({
            title: "Sell Cargo",
            content: `
                <div class="sale-dialog">
                    <h3>Select Cargo to Sell</h3>
                    <p><em>This feature requires integration with the game system's inventory system.</em></p>
                    <p>Available cargo would be loaded from the selected character's inventory.</p>
                    <div class="sale-options">
                        <div class="sale-option">
                            <input type="radio" id="sale-normal" name="sale-type" value="normal" checked>
                            <label for="sale-normal">Normal Sale</label>
                        </div>
                        <div class="sale-option">
                            <input type="radio" id="sale-desperate" name="sale-type" value="desperate">
                            <label for="sale-desperate">Desperate Sale (50% price, Trade settlements only)</label>
                        </div>
                        <div class="sale-option">
                            <input type="radio" id="sale-rumor" name="sale-type" value="rumor">
                            <label for="sale-rumor">Rumor Sale (200% price, requires Gossip test)</label>
                        </div>
                    </div>
                </div>
            `,
            buttons: {
                proceed: {
                    icon: '<i class="fas fa-handshake"></i>',
                    label: "Proceed with Sale",
                    callback: (html) => {
                        const saleType = html.find('input[name="sale-type"]:checked').val();
                        this._processSaleWorkflow(saleType);
                    }
                },
                cancel: {
                    icon: '<i class="fas fa-times"></i>',
                    label: "Cancel"
                }
            },
            default: "proceed"
        });

        await saleDialog.render(true);
    }

    /**
     * Process sale workflow based on selected type
     * @param {string} saleType - Type of sale (normal, desperate, rumor)
     */
    async _processSaleWorkflow(saleType) {
        try {
            switch (saleType) {
                case 'normal':
                    await this._processNormalSale();
                    break;
                case 'desperate':
                    await this._processDesperateSale();
                    break;
                case 'rumor':
                    await this._processRumorSale();
                    break;
                default:
                    throw new Error(`Unknown sale type: ${saleType}`);
            }
        } catch (error) {
            console.error('WFRP Trading | Sale workflow failed:', error);
            ui.notifications.error(`Sale failed: ${error.message}`);
        }
    }

    /**
     * Process normal sale workflow
     */
    async _processNormalSale() {
        if (!this.selectedSettlement) {
            ui.notifications.warn('Please select a settlement first.');
            return;
        }

        // Example cargo for demonstration (would come from inventory)
        const exampleCargo = {
            name: 'Grain',
            quantity: 50,
            quality: 'average',
            purchaseLocation: 'Altdorf', // Where it was originally bought
            purchaseTime: Date.now() - (8 * 24 * 60 * 60 * 1000) // 8 days ago
        };

        // Check sale eligibility
        const eligibility = this.tradingEngine.checkSaleEligibility(
            exampleCargo,
            this.selectedSettlement,
            { settlementName: exampleCargo.purchaseLocation, purchaseTime: exampleCargo.purchaseTime }
        );

        if (!eligibility.eligible) {
            ui.notifications.error(`Cannot sell: ${eligibility.errors.join(', ')}`);
            return;
        }

        // Check for buyers
        const buyerResult = await this.tradingEngine.findBuyer(
            this.selectedSettlement,
            exampleCargo.name
        );

        await this._postBuyerSearchToChat(buyerResult);

        if (!buyerResult.buyerFound) {
            if (buyerResult.partialSaleOption) {
                await this._showPartialSaleOption(exampleCargo);
            } else {
                ui.notifications.info('No buyers found for this cargo.');
            }
            return;
        }

        // Calculate sale price
        const salePrice = this.tradingEngine.calculateSalePrice(
            exampleCargo.name,
            exampleCargo.quantity,
            this.selectedSettlement,
            { quality: exampleCargo.quality, season: this.currentSeason }
        );

        // Show sale confirmation
        await this._showSaleConfirmation(exampleCargo, salePrice);
    }

    /**
     * Process desperate sale workflow
     */
    async _processDesperateSale() {
        if (!this.dataManager.isTradeSettlement(this.selectedSettlement)) {
            ui.notifications.error('Desperate sales can only be made at Trade settlements.');
            return;
        }

        ui.notifications.info('Desperate sale: 50% base price, no haggling allowed.');
        
        // Implementation would continue with desperate sale logic
        // For now, just show the concept
        const content = `
            <div class="desperate-sale-result">
                <h3>Desperate Sale Completed</h3>
                <p>Sold cargo at 50% base price with no haggling.</p>
                <p><em>Full implementation requires inventory integration.</em></p>
            </div>
        `;
        
        await this._postToChat(content);
    }

    /**
     * Process rumor sale workflow
     */
    async _processRumorSale() {
        // First, player must make a Gossip test
        const gossipDialog = new Dialog({
            title: "Gossip Test for Rumors",
            content: `
                <div class="gossip-test">
                    <h3>Attempt Gossip Test</h3>
                    <p>Make a <strong>Difficult (-10) Gossip test</strong> to discover rumors of high-demand settlements.</p>
                    <div class="skill-input">
                        <label for="gossip-skill">Your Gossip Skill:</label>
                        <input type="number" id="gossip-skill" value="30" min="0" max="100" />
                    </div>
                    <p><em>The test will be rolled automatically with the -10 difficulty modifier.</em></p>
                </div>
            `,
            buttons: {
                roll: {
                    icon: '<i class="fas fa-dice"></i>',
                    label: "Roll Gossip Test",
                    callback: async (html) => {
                        const skill = parseInt(html.find('#gossip-skill').val());
                        await this._performGossipTest(skill);
                    }
                },
                cancel: {
                    icon: '<i class="fas fa-times"></i>',
                    label: "Cancel"
                }
            },
            default: "roll"
        });

        await gossipDialog.render(true);
    }

    /**
     * Perform gossip test for rumor discovery
     * @param {number} skillValue - Player's Gossip skill value
     */
    async _performGossipTest(skillValue) {
        try {
            const difficulty = -10; // Difficult test
            const targetNumber = skillValue + difficulty;
            
            // Roll 1d100
            const roll = new Roll("1d100");
            await roll.evaluate({async: true});
            
            const success = roll.total <= targetNumber;
            
            // Post roll result to chat
            const rollContent = `
                <div class="gossip-test-result">
                    <h3>Gossip Test</h3>
                    <div class="test-details">
                        <div><strong>Skill:</strong> ${skillValue}</div>
                        <div><strong>Difficulty:</strong> ${difficulty} (Difficult)</div>
                        <div><strong>Target:</strong> ${targetNumber}</div>
                        <div><strong>Roll:</strong> ${roll.total}</div>
                        <div><strong>Result:</strong> ${success ? 'Success!' : 'Failure'}</div>
                    </div>
                    ${success ? `
                        <div class="rumor-result">
                            <p><strong>Rumor Discovered!</strong></p>
                            <p>You hear of a settlement willing to pay 200% base price for specific goods.</p>
                        </div>
                    ` : `
                        <div class="rumor-result">
                            <p>No useful rumors discovered.</p>
                        </div>
                    `}
                </div>
            `;
            
            await this._postToChat(rollContent);
            
            if (success) {
                ui.notifications.info('Rumor discovered! You can now sell at premium prices.');
                // Implementation would continue with rumor sale at 200% price
            } else {
                ui.notifications.info('No rumors discovered. Try again later.');
            }
            
        } catch (error) {
            console.error('WFRP Trading | Gossip test failed:', error);
            await this._displayErrorMessage(error.message, 'Gossip Test');
        }
    }

    /**
     * Show haggle dialog for purchase/sale negotiations
     */
    async _showHaggleDialog() {
        const haggleDialog = new Dialog({
            title: "Attempt Haggle",
            content: `
                <div class="haggle-dialog">
                    <h3>Haggle Test</h3>
                    <p>Attempt to negotiate a better price through a comparative Haggle test.</p>
                    <div class="haggle-inputs">
                        <div class="input-group">
                            <label for="player-haggle">Your Haggle Skill:</label>
                            <input type="number" id="player-haggle" value="30" min="0" max="100" />
                        </div>
                        <div class="input-group">
                            <label for="merchant-haggle">Merchant Haggle Skill:</label>
                            <input type="number" id="merchant-haggle" value="42" min="0" max="100" />
                            <small>Typical merchant skill: 32-52</small>
                        </div>
                        <div class="input-group">
                            <label>
                                <input type="checkbox" id="has-dealmaker" />
                                Has Dealmaker Talent (+10% bonus on success)
                            </label>
                        </div>
                    </div>
                    <div class="haggle-info">
                        <h4>Haggle Effects:</h4>
                        <ul>
                            <li><strong>Success:</strong> -10% price (or -20% with Dealmaker)</li>
                            <li><strong>Failure:</strong> No change (or +10% penalty at GM discretion)</li>
                        </ul>
                    </div>
                </div>
            `,
            buttons: {
                haggle: {
                    icon: '<i class="fas fa-handshake"></i>',
                    label: "Attempt Haggle",
                    callback: async (html) => {
                        const playerSkill = parseInt(html.find('#player-haggle').val());
                        const merchantSkill = parseInt(html.find('#merchant-haggle').val());
                        const hasDealmakertTalent = html.find('#has-dealmaker').is(':checked');
                        
                        await this._performHaggleTest(playerSkill, merchantSkill, hasDealmakertTalent);
                    }
                },
                cancel: {
                    icon: '<i class="fas fa-times"></i>',
                    label: "Cancel"
                }
            },
            default: "haggle"
        });

        await haggleDialog.render(true);
    }

    /**
     * Perform comparative haggle test
     * @param {number} playerSkill - Player's Haggle skill
     * @param {number} merchantSkill - Merchant's Haggle skill
     * @param {boolean} hasDealmakertTalent - Whether player has Dealmaker talent
     */
    async _performHaggleTest(playerSkill, merchantSkill, hasDealmakertTalent) {
        try {
            // Roll for both player and merchant
            const playerRoll = new Roll("1d100");
            const merchantRoll = new Roll("1d100");
            
            await playerRoll.evaluate({async: true});
            await merchantRoll.evaluate({async: true});
            
            // Determine success/failure for each
            const playerSuccess = playerRoll.total <= playerSkill;
            const merchantSuccess = merchantRoll.total <= merchantSkill;
            
            // Determine overall result
            let haggleResult;
            if (playerSuccess && !merchantSuccess) {
                haggleResult = 'player_wins';
            } else if (!playerSuccess && merchantSuccess) {
                haggleResult = 'merchant_wins';
            } else if (playerSuccess && merchantSuccess) {
                // Both succeed - compare degrees of success
                const playerDegrees = Math.floor((playerSkill - playerRoll.total) / 10);
                const merchantDegrees = Math.floor((merchantSkill - merchantRoll.total) / 10);
                haggleResult = playerDegrees > merchantDegrees ? 'player_wins' : 'merchant_wins';
            } else {
                // Both fail - no change
                haggleResult = 'no_change';
            }
            
            // Calculate price modifier
            let priceModifier = 0;
            let resultDescription = '';
            
            switch (haggleResult) {
                case 'player_wins':
                    priceModifier = hasDealmakertTalent ? -20 : -10;
                    resultDescription = hasDealmakertTalent 
                        ? 'Success with Dealmaker! Price reduced by 20%'
                        : 'Success! Price reduced by 10%';
                    break;
                case 'merchant_wins':
                    // Optional penalty at GM discretion
                    priceModifier = 0; // Could be +10 if GM chooses
                    resultDescription = 'Merchant wins. No price change.';
                    break;
                case 'no_change':
                    priceModifier = 0;
                    resultDescription = 'Both fail. No price change.';
                    break;
            }
            
            // Post result to chat
            const haggleContent = `
                <div class="haggle-test-result">
                    <h3>Haggle Test</h3>
                    <div class="test-comparison">
                        <div class="player-result">
                            <h4>Player</h4>
                            <div>Skill: ${playerSkill}</div>
                            <div>Roll: ${playerRoll.total}</div>
                            <div>Result: ${playerSuccess ? 'Success' : 'Failure'}</div>
                        </div>
                        <div class="merchant-result">
                            <h4>Merchant</h4>
                            <div>Skill: ${merchantSkill}</div>
                            <div>Roll: ${merchantRoll.total}</div>
                            <div>Result: ${merchantSuccess ? 'Success' : 'Failure'}</div>
                        </div>
                    </div>
                    <div class="haggle-outcome">
                        <h4>Outcome</h4>
                        <div><strong>${resultDescription}</strong></div>
                        ${priceModifier !== 0 ? `<div>Price modifier: ${priceModifier > 0 ? '+' : ''}${priceModifier}%</div>` : ''}
                        ${hasDealmakertTalent ? '<div><em>Dealmaker talent applied</em></div>' : ''}
                    </div>
                </div>
            `;
            
            await this._postToChat(haggleContent);
            
            // Show notification
            if (priceModifier < 0) {
                ui.notifications.info(`Haggle successful! Price reduced by ${Math.abs(priceModifier)}%`);
            } else if (priceModifier > 0) {
                ui.notifications.warn(`Haggle failed! Price increased by ${priceModifier}%`);
            } else {
                ui.notifications.info('Haggle had no effect on price.');
            }
            
            // Store haggle result for use in price calculations
            this.lastHaggleResult = {
                success: haggleResult === 'player_wins',
                hasDealmakertTalent: hasDealmakertTalent,
                priceModifier: priceModifier
            };
            
        } catch (error) {
            console.error('WFRP Trading | Haggle test failed:', error);
            await this._displayErrorMessage(error.message, 'Haggle Test');
        }
    }

    /**
     * Show partial sale option when no buyers found
     * @param {Object} cargo - Cargo object
     */
    async _showPartialSaleOption(cargo) {
        const partialDialog = new Dialog({
            title: "No Buyers Found",
            content: `
                <div class="partial-sale-option">
                    <h3>No Buyers Found</h3>
                    <p>No buyers were found for your full cargo load.</p>
                    <p><strong>Option:</strong> Sell half the cargo and re-roll for buyers.</p>
                    <div class="cargo-details">
                        <div>Current Quantity: ${cargo.quantity} EP</div>
                        <div>Partial Sale Quantity: ${Math.floor(cargo.quantity / 2)} EP</div>
                        <div>Remaining: ${Math.ceil(cargo.quantity / 2)} EP</div>
                    </div>
                </div>
            `,
            buttons: {
                partial: {
                    icon: '<i class="fas fa-cut"></i>',
                    label: "Sell Half & Re-roll",
                    callback: () => this._processPartialSale(cargo)
                },
                cancel: {
                    icon: '<i class="fas fa-times"></i>',
                    label: "Cancel Sale"
                }
            },
            default: "partial"
        });

        await partialDialog.render(true);
    }

    /**
     * Process partial sale and re-roll for buyers
     * @param {Object} cargo - Original cargo object
     */
    async _processPartialSale(cargo) {
        const partialQuantity = Math.floor(cargo.quantity / 2);
        
        // Create partial cargo object
        const partialCargo = {
            ...cargo,
            quantity: partialQuantity
        };
        
        // Re-roll for buyers with partial quantity
        const buyerResult = await this.tradingEngine.findBuyer(
            this.selectedSettlement,
            partialCargo.name
        );
        
        await this._postBuyerSearchToChat(buyerResult, true);
        
        if (buyerResult.buyerFound) {
            // Calculate sale price for partial quantity
            const salePrice = this.tradingEngine.calculateSalePrice(
                partialCargo.name,
                partialCargo.quantity,
                this.selectedSettlement,
                { quality: partialCargo.quality, season: this.currentSeason }
            );
            
            await this._showSaleConfirmation(partialCargo, salePrice);
        } else {
            ui.notifications.info('Still no buyers found, even for partial sale.');
        }
    }

    /**
     * Show sale confirmation dialog
     * @param {Object} cargo - Cargo to sell
     * @param {Object} salePrice - Sale price calculation
     */
    async _showSaleConfirmation(cargo, salePrice) {
        const confirmDialog = new Dialog({
            title: "Confirm Sale",
            content: `
                <div class="sale-confirmation">
                    <h3>Sell ${cargo.name}</h3>
                    <div class="sale-details">
                        <div class="detail-row">
                            <span class="label">Quantity:</span>
                            <span class="value">${cargo.quantity} EP</span>
                        </div>
                        <div class="detail-row">
                            <span class="label">Base Price per Unit:</span>
                            <span class="value">${salePrice.basePricePerUnit} GC</span>
                        </div>
                        <div class="detail-row">
                            <span class="label">Final Price per Unit:</span>
                            <span class="value">${salePrice.finalPricePerUnit} GC</span>
                        </div>
                        <div class="detail-row total">
                            <span class="label">Total Revenue:</span>
                            <span class="value">${salePrice.totalPrice} GC</span>
                        </div>
                        ${salePrice.modifiers.length > 0 ? `
                            <div class="modifiers">
                                <h4>Price Modifiers:</h4>
                                ${salePrice.modifiers.map(mod => 
                                    `<div class="modifier">${mod.description}: ${mod.amount > 0 ? '+' : ''}${mod.amount} GC</div>`
                                ).join('')}
                            </div>
                        ` : ''}
                    </div>
                </div>
            `,
            buttons: {
                sell: {
                    icon: '<i class="fas fa-coins"></i>',
                    label: "Sell",
                    callback: () => this._executeSale(cargo, salePrice)
                },
                cancel: {
                    icon: '<i class="fas fa-times"></i>',
                    label: "Cancel"
                }
            },
            default: "sell"
        });

        await confirmDialog.render(true);
    }

    /**
     * Execute the sale transaction
     * @param {Object} cargo - Cargo being sold
     * @param {Object} salePrice - Sale price calculation
     */
    async _executeSale(cargo, salePrice) {
        try {
            const transaction = {
                type: 'sale',
                cargo: cargo.name,
                quantity: cargo.quantity,
                settlement: this.selectedSettlement.name,
                season: this.currentSeason,
                totalPrice: salePrice.totalPrice,
                timestamp: new Date().toISOString()
            };

            // Add to transaction history
            this.transactionHistory.unshift(transaction);

            // Post to chat with enhanced formatting
            await this._postTransactionSummaryToChat(transaction, salePrice, 'sale');

            // Show success notification
            ui.notifications.info(`Successfully sold ${cargo.quantity} EP of ${cargo.name} for ${salePrice.totalPrice} GC`);
            
        } catch (error) {
            console.error('WFRP Trading | Sale execution failed:', error);
            await this._displayErrorMessage(error.message, 'Sale Execution');
        }
    }

    /**
     * Post buyer search result to chat
     * @param {Object} buyerResult - Buyer search result
     * @param {boolean} isPartialSale - Whether this was a partial sale attempt
     */
    async _postBuyerSearchToChat(buyerResult, isPartialSale = false) {
        const content = `
            <div class="buyer-search">
                <h3>${isPartialSale ? 'Partial Sale ' : ''}Buyer Search</h3>
                <div class="search-details">
                    <div class="settlement-info">
                        <strong>Settlement:</strong> ${buyerResult.settlement}
                    </div>
                    <div class="roll-info">
                        <strong>Buyer Chance:</strong> ${buyerResult.chance}%<br>
                        ${buyerResult.roll ? `<strong>Roll:</strong> ${buyerResult.roll}` : ''}
                    </div>
                    <div class="result-info">
                        <strong>Result:</strong> ${buyerResult.buyerFound ? 'Buyer Found!' : 'No Buyer Found'}
                    </div>
                    ${!buyerResult.buyerFound && buyerResult.partialSaleOption ? `
                        <div class="option-info">
                            <em>Option: Try selling half cargo and re-rolling</em>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;

        await this._postToChat(content);
    }

    /**
     * Roll dice using FoundryVTT's native dice system
     * @param {string} formula - Dice formula (e.g., "1d100")
     * @param {Object} options - Roll options
     * @returns {Roll} - FoundryVTT Roll object
     */
    async rollDice(formula, options = {}) {
        try {
            const roll = new Roll(formula);
            await roll.evaluate({async: true});
            
            // Post to chat if requested
            if (options.postToChat !== false) {
                await this._postDiceRollToChat(roll, options.context || 'Dice Roll', {
                    target: options.target,
                    success: options.success,
                    description: options.description,
                    gmOnly: options.gmOnly
                });
            }
            
            return roll;
            
        } catch (error) {
            console.error('WFRP Trading | Dice roll failed:', error);
            await this._displayErrorMessage(error.message, 'Dice Roll');
            throw error;
        }
    }

    /**
     * Display roll results in chat and UI
     * @param {Roll} roll - FoundryVTT Roll object
     * @param {string} context - Context description
     * @param {Object} options - Display options
     */
    async displayRollResults(roll, context, options = {}) {
        try {
            // Always post detailed results to chat
            await this._postDiceRollToChat(roll, context, options);
            
            // Show notification for immediate feedback
            const resultText = options.success !== undefined 
                ? (options.success ? 'Success!' : 'Failure')
                : `Rolled ${roll.total}`;
                
            ui.notifications.info(`${context}: ${resultText}`);
            
        } catch (error) {
            console.error('WFRP Trading | Failed to display roll results:', error);
        }
    }

    /**
     * Show dice outcomes with detailed breakdown
     * @param {Roll} roll - FoundryVTT Roll object
     * @param {Object} context - Context information
     */
    showDiceOutcomes(roll, context = {}) {
        try {
            // Create detailed breakdown dialog
            const breakdownDialog = new Dialog({
                title: `Dice Roll: ${context.title || 'Roll Result'}`,
                content: `
                    <div class="dice-breakdown">
                        <h3>Roll Details</h3>
                        <div class="breakdown-details">
                            <div class="detail-row">
                                <span class="label">Formula:</span>
                                <span class="value">${roll.formula}</span>
                            </div>
                            <div class="detail-row">
                                <span class="label">Result:</span>
                                <span class="value">${roll.total}</span>
                            </div>
                            ${context.target ? `
                                <div class="detail-row">
                                    <span class="label">Target:</span>
                                    <span class="value">${context.target}</span>
                                </div>
                            ` : ''}
                            ${context.success !== undefined ? `
                                <div class="detail-row">
                                    <span class="label">Outcome:</span>
                                    <span class="value ${context.success ? 'success' : 'failure'}">
                                        ${context.success ? 'Success!' : 'Failure'}
                                    </span>
                                </div>
                            ` : ''}
                        </div>
                        ${context.description ? `
                            <div class="breakdown-description">
                                <h4>Description</h4>
                                <p>${context.description}</p>
                            </div>
                        ` : ''}
                        <div class="breakdown-dice">
                            <h4>Dice Details</h4>
                            <div class="dice-terms">
                                ${roll.terms.map(term => {
                                    if (term.results) {
                                        return `<div class="dice-term">
                                            <span class="term-formula">${term.formula}:</span>
                                            <span class="term-results">[${term.results.map(r => r.result).join(', ')}]</span>
                                        </div>`;
                                    }
                                    return `<div class="dice-term">${term}</div>`;
                                }).join('')}
                            </div>
                        </div>
                    </div>
                `,
                buttons: {
                    close: {
                        icon: '<i class="fas fa-times"></i>',
                        label: "Close"
                    }
                },
                default: "close"
            });

            breakdownDialog.render(true);
            
        } catch (error) {
            console.error('WFRP Trading | Failed to show dice outcomes:', error);
            ui.notifications.warn('Failed to display detailed dice results.');
        }
    }

    /**
     * Close dialog and cleanup
     */
    async close() {
        // Cleanup any resources if needed
        return super.close();
    }
}

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.TradingDialog = TradingDialog;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = TradingDialog;
}