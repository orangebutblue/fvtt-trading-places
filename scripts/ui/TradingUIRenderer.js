
console.log('Trading Places | Loading TradingUIRenderer.js');

export class TradingUIRenderer {
    constructor(app) {
        this.app = app;
        this.dataManager = app.dataManager;
        
        // Icon map for consistent emoji usage
        this.ICONS = {
            roll: '🎲',
            value: '💰',
            calculation: '🧮',
            risk: '⚠️',
            success: '✅',
            failure: '❌',
            cargo: '📦',
            merchant: '🧑‍💼',
            quality: '⭐',
            quantity: '📊'
        };
    }

    _logDebug(category, message, data) {
        if (this.app.debugLogger && this.app.debugLogger.log) {
            this.app.debugLogger.log('DEBUG', category, message, data, 'DEBUG');
        } else {
            console.debug(`Trading Places | ${category}: ${message}`, data);
        }
    }

    _logError(category, message, data) {
        if (this.app.debugLogger && this.app.debugLogger.log) {
            this.app.debugLogger.log('ERROR', category, message, data, 'ERROR');
        } else {
            console.error(`Trading Places | ${category}: ${message}`, data);
        }
    }

    /**
     * Update UI state based on current application state
     * @private
     */
    _updateUIState() {
        // Update season display
        if (this.app.currentSeason) {
            const seasonSelect = this.app.element.querySelector('#current-season');
            if (seasonSelect) {
                seasonSelect.value = this.app.currentSeason;
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
        const hasSettlement = !!this.app.selectedSettlement;
        const hasCargo = this.app.availableCargo.length > 0;
        const hasSeason = !!this.app.currentSeason;

        // Get button elements
        const haggleBtn = this.app.element.querySelector('.haggle-button');
        const saleBtn = this.app.element.querySelector('.sale-button');
        const desperateSaleBtn = this.app.element.querySelector('.desperate-sale-button');
        const rumorSaleBtn = this.app.element.querySelector('.rumor-sale-button');

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
            const isTradeSettlement = this.dataManager?.isTradeSettlement(this.app.selectedSettlement);
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

    /**
     * Create a tooltip-enabled element
     * @param {string} text - The display text
     * @param {string} tooltip - The tooltip text
     * @param {string} tag - The HTML tag to use (default: 'span')
     * @param {string} className - Additional CSS classes
     * @returns {string} - HTML string for the tooltip element
     */
    createTooltipElement(text, tooltip, tag = 'span', className = '') {
        const classes = `tooltip ${className}`.trim();
        return `<${tag} class="${classes}" data-tooltip="${tooltip}">${text}</${tag}>`;
    }

    /**
     * Show detailed availability check results with slot-based organization
     * @param {Object} completeResult - Complete availability check result
     * @param {Array} availableCargo - Available cargo for display (empty on failure)
     * @private
     */
    _showAvailabilityResults({ availabilityResult, availableCargo = [], pipelineResult = null } = {}) {
        if (!availabilityResult) {
            this._logError('Availability Display', 'No availability result provided');
            return;
        }

        const completeResult = availabilityResult;
        const isSuccess = Boolean(completeResult.available);

        let resultsContainer = this.app.element.querySelector('#availability-results');
        if (!resultsContainer) {
            const buyingTab = this.app.element.querySelector('#buying-tab');
            if (!buyingTab) {
                this._logError('Availability Display', 'Buying tab not found for results injection');
                return;
            }
            resultsContainer = document.createElement('div');
            resultsContainer.id = 'availability-results';
            resultsContainer.className = 'availability-results';
            buyingTab.appendChild(resultsContainer);
        }

        // Create status banner
        const statusEmoji = isSuccess ? this.ICONS.cargo : this.ICONS.failure;
        const statusText = isSuccess ? 'Merchants are offering cargo' : 'No merchants available';
        const statusBanner = `<div class="availability-status-banner ${isSuccess ? '' : 'no-goods'}">${statusEmoji} ${statusText}</div>`;

        // Market check section (settlement info and overall roll)
        const rollDetails = completeResult.availabilityCheck || { roll: '-', chance: '-' };
        const sizeRating = this.dataManager.convertSizeToNumeric(this.app.selectedSettlement.size);
        const wealthRating = this.app.selectedSettlement.wealth;
        const baseChance = (sizeRating + wealthRating) * 10;
        const finalChance = Math.min(baseChance, 100);

        const marketCheckHtml = `
            <section class="market-check-section">
                <h5>Market Check</h5>
                <div class="calculation-breakdown">
                    <p><strong>Settlement:</strong> ${this.app.selectedSettlement.name}</p>
                    <p><strong>Size:</strong> ${this.dataManager.getSizeDescription(this.app.selectedSettlement.size)} (${sizeRating})</p>
                    <p><strong>Wealth:</strong> ${this.dataManager.getWealthDescription(wealthRating)} (${wealthRating})</p>
                    <p><strong>Base Chance:</strong> <span title="Size contribution: ${sizeRating} × 10 = ${sizeRating * 10}%, Wealth contribution: ${wealthRating} × 10 = ${wealthRating * 10}%, Total: ${(sizeRating + wealthRating) * 10}%">${(sizeRating + wealthRating) * 10}%</span></p>
                    <p><strong>Final Chance:</strong> ${finalChance}% <span title="Capped at 100% maximum">(cannot exceed 100%)</span></p>
                    <p><strong>Roll & Result:</strong> ${this.ICONS.roll} ${rollDetails.roll} ${isSuccess ? '≤' : '>'} ${finalChance} = <span class="${isSuccess ? 'success-text' : 'failure-text'}">${isSuccess ? '✅ SUCCESS' : '❌ FAILURE'}</span></p>
                </div>
            </section>
        `;

        // Slot-based cargo display - DISABLED since cargo cards are now collapsible
        let cargoSlotsHtml = '';
        // The detailed slot information is now shown in the collapsible cargo cards
        // instead of a separate slot breakdown section

        resultsContainer.innerHTML = `
            ${statusBanner}
            ${marketCheckHtml}
        `;

        resultsContainer.style.display = 'block';
    }

    /**
     * Render a detailed slot card with complete pipeline information
     * @param {Object} slot - Slot data from pipeline
     * @param {number} slotNumber - Slot number for display
     * @returns {string} - HTML for the slot card
     * @private
     */
    _renderSlotCard(slot, slotNumber) {
        const merchant = slot.merchant || {};
        const cargo = slot.cargo || {};
        const balance = slot.balance || {};
        const amount = slot.amount || {};
        const quality = slot.quality || {};
        const contraband = slot.contraband || {};
        const pricing = slot.pricing || {};

        const isSuccessful = merchant.available !== false; // Since merchants are always available now
        const statusIcon = isSuccessful ? this.ICONS.success : this.ICONS.failure;
        const statusClass = isSuccessful ? 'slot-success' : 'slot-failure';
        const statusText = isSuccessful ? 'Active Merchant' : 'No Merchant';

        let slotContent = '';

        if (isSuccessful) {
            // Successful slot - show complete pipeline
            const cargoTypeInfo = this._renderCargoTypeSelection(slot);
            const balanceInfo = this._renderSupplyDemandBalance(slot);
            const amountInfo = this._renderAmountCalculation(slot);
            const qualityInfo = this._renderQualityDetermination(slot);
            const contrabandInfo = this._renderContrabandCheck(slot);
            const pricingInfo = this._renderFinalPricing(slot);

            slotContent = `
                <div class="slot-pipeline">
                    <div class="pipeline-step">
                        <h6>${this.ICONS.cargo} Cargo Type Selection</h6>
                        ${cargoTypeInfo}
                    </div>
                    <div class="pipeline-step">
                        <h6>${this.ICONS.calculation} Supply/Demand Balance</h6>
                        ${balanceInfo}
                    </div>
                    <div class="pipeline-step">
                        <h6>${this.ICONS.quantity} Amount Calculation</h6>
                        ${amountInfo}
                    </div>
                    <div class="pipeline-step">
                        <h6>${this.ICONS.quality} Quality Determination</h6>
                        ${qualityInfo}
                    </div>
                    <div class="pipeline-step">
                        <h6>${this.ICONS.risk} Contraband Check</h6>
                        ${contrabandInfo}
                    </div>
                    <div class="pipeline-step">
                        <h6>${this.ICONS.value} Final Pricing</h6>
                        ${pricingInfo}
                    </div>
                </div>
                <div class="slot-result">
                    <div class="result-header">
                        <span class="result-label">Result:</span>
                        <span class="result-value">${cargo.name} (${cargo.category}) - ${amount.totalEP} EP @ ${pricing.finalPricePerEP?.toFixed(2)} GC/EP</span>
                    </div>
                    <div class="merchant-info">
                        <span class="merchant-label">Merchant:</span>
                        <span class="merchant-value">Available (skill level determined by settlement)</span>
                    </div>
                </div>
            `;
        } else {
            // Failed slot - show why it failed
            slotContent = `
                <div class="slot-failure-reason">
                    <p><strong>Merchant Availability:</strong> ${merchant.roll || 'N/A'} > ${merchant.target || 'N/A'} target</p>
                    <p><em>This slot could not attract a merchant. The market conditions or settlement characteristics made trading unattractive.</em></p>
                    ${merchant.notes ? `<ul>${merchant.notes.map(note => `<li>${note}</li>`).join('')}</ul>` : ''}
                </div>
            `;
        }

        return `
            <div class="slot-card ${statusClass}">
                <div class="slot-header">
                    <div class="slot-title">
                        <span class="slot-number">Slot ${slotNumber}</span>
                        <span class="slot-status">${statusIcon} ${statusText}</span>
                    </div>
                </div>
                <div class="slot-content">
                    ${slotContent}
                </div>
            </div>
        `;
    }

    /**
     * Render cargo type selection details
     * @param {Object} slot - Slot data
     * @returns {string} - HTML for cargo type selection
     * @private
     */
    _renderCargoTypeSelection(slot) {
        const cargo = slot.cargo || {};
        const candidateTable = slot.candidateTable || {};

        return `
            <div class="pipeline-detail">
                <p><strong>Selected Cargo:</strong> ${cargo.name} (${cargo.category})</p>
                <p><strong>Selection Probability:</strong> ${cargo.probability?.toFixed(1) || 'N/A'}%</p>
                ${cargo.reasons && cargo.reasons.length > 0 ? `
                    <p><strong>Selection Reasons:</strong></p>
                    <ul>
                        ${cargo.reasons.map(reason => `<li>${reason}</li>`).join('')}
                    </ul>
                ` : ''}
                ${candidateTable.totalWeight ? `
                    <p><strong>Candidate Pool:</strong> ${candidateTable.entries?.length || 0} types, total weight: ${candidateTable.totalWeight}</p>
                ` : ''}
            </div>
        `;
    }

    /**
     * Render supply/demand balance details
     * @param {Object} slot - Slot data
     * @returns {string} - HTML for balance information
     * @private
     */
    _renderSupplyDemandBalance(slot) {
        const balance = slot.balance || {};

        return `
            <div class="pipeline-detail">
                <p><strong>Final Balance:</strong> ${balance.supply || 0} supply / ${balance.demand || 0} demand</p>
                <p><strong>Market State:</strong> ${balance.state || 'unknown'}</p>
                ${balance.history && balance.history.length > 0 ? `
                    <p><strong>Balance Adjustments:</strong></p>
                    <ul>
                        ${balance.history.map(change => `
                            <li>${change.label}: ${change.percentage > 0 ? '+' : ''}${change.percentage} 
                                (${change.before.supply}/${change.before.demand} → ${change.after.supply}/${change.after.demand})</li>
                        `).join('')}
                    </ul>
                ` : ''}
            </div>
        `;
    }

    /**
     * Render amount calculation details
     * @param {Object} slot - Slot data
     * @returns {string} - HTML for amount calculation
     * @private
     */
    _renderAmountCalculation(slot) {
        const amount = slot.amount || {};

        return `
            <div class="pipeline-detail">
                <p><strong>Base Roll:</strong> ${amount.roll || 'N/A'} (1d100)</p>
                <p><strong>Size Modifier:</strong> ×${amount.sizeModifier?.toFixed(2) || 'N/A'}</p>
                <p><strong>Wealth Modifier:</strong> ×${amount.wealthModifier?.toFixed(2) || 'N/A'}</p>
                <p><strong>Supply Modifier:</strong> ×${amount.supplyModifier?.toFixed(2) || 'N/A'}</p>
                <p><strong>Final Amount:</strong> ${amount.totalEP || 0} EP</p>
                ${amount.notes && amount.notes.length > 0 ? `
                    <ul>
                        ${amount.notes.map(note => `<li>${note}</li>`).join('')}
                    </ul>
                ` : ''}
            </div>
        `;
    }

    /**
     * Render quality determination details
     * @param {Object} slot - Slot data
     * @returns {string} - HTML for quality information
     * @private
     */
    _renderQualityDetermination(slot) {
        const quality = slot.quality || {};

        return `
            <div class="pipeline-detail">
                <p><strong>Quality Tier:</strong> ${quality.tier || 'Average'}</p>
                <p><strong>Quality Score:</strong> ${quality.score?.toFixed(2) || 'N/A'}</p>
                ${quality.notes && quality.notes.length > 0 ? `
                    <ul>
                        ${quality.notes.map(note => `<li>${note}</li>`).join('')}
                    </ul>
                ` : ''}
            </div>
        `;
    }

    /**
     * Render contraband check details
     * @param {Object} slot - Slot data
     * @returns {string} - HTML for contraband information
     * @private
     */
    _renderContrabandCheck(slot) {
        const contraband = slot.contraband || {};

        return `
            <div class="pipeline-detail">
                <p><strong>Contraband Chance:</strong> ${contraband.chance?.toFixed(1) || 'N/A'}%</p>
                <p><strong>Roll Result:</strong> ${contraband.roll || 'N/A'}</p>
                <p><strong>Is Contraband:</strong> ${contraband.contraband ? `${this.ICONS.risk} Yes` : 'No'}</p>
                ${contraband.notes && contraband.notes.length > 0 ? `
                    <ul>
                        ${contraband.notes.map(note => `<li>${note}</li>`).join('')}
                    </ul>
                ` : ''}
            </div>
        `;
    }

    /**
     * Render final pricing details
     * @param {Object} slot - Slot data
     * @returns {string} - HTML for pricing information
     * @private
     */
    _renderFinalPricing(slot) {
        const pricing = slot.pricing || {};

        return `
            <div class="pipeline-detail">
                <p><strong>Base Price per EP:</strong> ${pricing.basePricePerEP?.toFixed(2) || 'N/A'} GC</p>
                <p><strong>Final Price per EP:</strong> ${pricing.finalPricePerEP?.toFixed(2) || 'N/A'} GC</p>
                <p><strong>Available Quantity:</strong> ${pricing.quantity || 0} EP</p>
                <p><strong>Total Value:</strong> ${pricing.totalValue?.toFixed(2) || 'N/A'} GC</p>
                ${pricing.steps && pricing.steps.length > 0 ? `
                    <p><strong>Price Adjustments:</strong></p>
                    <ul>
                        ${pricing.steps.map(step => `<li>${step.label}</li>`).join('')}
                    </ul>
                ` : ''}
            </div>
        `;
    }

    /**
     * Render legacy cargo card for fallback when pipeline data isn't available
     * @param {Object} cargo - Cargo data
     * @param {number} slotNumber - Slot number
     * @returns {string} - HTML for legacy cargo card
     * @private
     */
    _renderLegacyCargoCard(cargo, slotNumber) {
        const totalEp = cargo.totalEP ?? cargo.quantity ?? 0;
        const merchantName = cargo.merchant?.name || 'Unknown Merchant';
        const merchantSkill = cargo.merchant?.skillDescription || 'Unknown';

        return `
            <div class="slot-card slot-success">
                <div class="slot-header">
                    <div class="slot-title">
                        <span class="slot-number">Slot ${slotNumber}</span>
                        <span class="slot-status">${this.ICONS.success} Active Merchant</span>
                    </div>
                </div>
                <div class="slot-content">
                    <div class="slot-result">
                        <div class="result-header">
                            <span class="result-label">Result:</span>
                            <span class="result-value">${cargo.name} (${cargo.category}) - ${totalEp} EP @ ${cargo.currentPrice || cargo.basePrice} GC/10EP</span>
                        </div>
                        <div class="merchant-info">
                            <span class="merchant-label">Merchant:</span>
                            <span class="merchant-value">${merchantName} (${merchantSkill})</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
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
        const cargoGrid = this.app.element.querySelector('#buying-cargo-grid');
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
        const cargoGrid = this.app.element.querySelector('#buying-cargo-grid');
        if (cargoGrid) {
            cargoGrid.style.display = 'none';
        }
        
        const resultsDiv = this.app.element.querySelector('#availability-results');
        if (resultsDiv) {
            resultsDiv.style.display = 'none';
        }
    }

    /**
     * Create a cargo card element that can be expanded to show detailed pipeline information
     * @param {Object} cargo - Cargo data with slotInfo for pipeline details
     * @returns {HTMLElement} - Cargo card element
     * @private
     */
    _createCargoCard(cargo) {
        const card = document.createElement('div');
        card.className = 'cargo-card collapsible';

        // Basic info (always visible) - matches original layout
        const basicInfo = `
            <div class="cargo-header">
                <div class="cargo-name">${cargo.name}</div>
                <div class="cargo-category">${cargo.category || 'Goods'}</div>
            </div>
            <div class="cargo-details">
                <div class="price-info">
                    <span class="price-label">Base Price:</span>
                    <span class="price-value">${cargo.currentPrice?.toFixed(2) || cargo.basePrice} GC</span>
                </div>
                <div class="price-info">
                    <span class="price-label">Available:</span>
                    <span class="price-value">${cargo.totalEP ?? cargo.quantity} EP${typeof cargo.quantity === 'number' ? ` (${cargo.quantity} units)` : ''}</span>
                </div>
                <div class="price-info">
                    <span class="price-label">Quality:</span>
                    <span class="price-value">${cargo.quality || 'Average'}</span>
                </div>
                <div class="merchant-info">
                    <div class="merchant-header">
                        <span class="merchant-name">${cargo.merchant?.name || 'Unknown'}</span>
                        <div class="merchant-skill">${cargo.merchant?.skillDescription || 'Unknown'}</div>
                    </div>
                    <div class="merchant-description">${cargo.merchant?.description || ''}</div>
                </div>
            </div>
        `;

        // Detailed pipeline information (hidden by default)
        let detailedInfo = '';
        if (cargo.slotInfo) {
            // This cargo came from the pipeline - show detailed breakdown
            const slot = cargo.slotInfo;
            detailedInfo = `
                <div class="cargo-details expanded-content">
                    <div class="pipeline-breakdown">
                        <h6>${this.ICONS.calculation} Pipeline Details</h6>

                        <div class="pipeline-section">
                            <h7>${this.ICONS.cargo} Cargo Selection</h7>
                            <p><strong>Type:</strong> ${cargo.name} (${cargo.category})</p>
                            <p><strong>Market Balance:</strong> ${slot.balance?.state || 'unknown'} (${slot.balance?.supply || 0}/${slot.balance?.demand || 0})</p>
                        </div>

                        <div class="pipeline-section">
                            <h7>${this.ICONS.quantity} Quantity & Quality</h7>
                            <p><strong>Amount:</strong> ${cargo.totalEP} EP</p>
                            <p><strong>Quality:</strong> ${cargo.quality}</p>
                            ${slot.contraband ? `<p><strong>⚠️ Contraband:</strong> Yes</p>` : ''}
                        </div>

                        <div class="pipeline-section">
                            <h7>${this.ICONS.value} Pricing</h7>
                            <p><strong>Base Price:</strong> ${cargo.basePrice?.toFixed(2)} GC/EP</p>
                            <p><strong>Final Price:</strong> ${cargo.currentPrice?.toFixed(2)} GC/EP</p>
                            <p><strong>Total Value:</strong> ${(cargo.currentPrice * cargo.totalEP)?.toFixed(2)} GC</p>
                        </div>

                        <div class="pipeline-section">
                            <h7>${this.ICONS.merchant} Merchant Details</h7>
                            <p><strong>Name:</strong> ${cargo.merchant?.name || 'Unknown'}</p>
                            <p><strong>Skill:</strong> ${cargo.merchant?.skillDescription || 'Unknown'}</p>
                            ${cargo.merchant?.description ? `<p><strong>Description:</strong> ${cargo.merchant.description}</p>` : ''}
                        </div>
                    </div>
                </div>
            `;
        } else {
            // Fallback for legacy cargo without pipeline data
            detailedInfo = `
                <div class="cargo-details expanded-content">
                    <div class="merchant-details">
                        <h6>${this.ICONS.merchant} Merchant Details</h6>
                        <p><strong>Name:</strong> ${cargo.merchant?.name || 'Unknown'}</p>
                        <p><strong>Skill:</strong> ${cargo.merchant?.skillDescription || 'Unknown'}</p>
                        ${cargo.merchant?.description ? `<p><strong>Description:</strong> ${cargo.merchant.description}</p>` : ''}
                        ${cargo.merchant?.skill ? `<p><strong>Skill Level:</strong> ${cargo.merchant.skill}</p>` : ''}
                    </div>
                </div>
            `;
        }

        card.innerHTML = basicInfo + detailedInfo;

        // Add click handler to the header only
        const header = card.querySelector('.cargo-header');
        const expandedContent = card.querySelector('.expanded-content');
        
        if (header) {
            header.addEventListener('click', (event) => {
                // Don't toggle if clicking on a button or other interactive element
                if (event.target.tagName === 'BUTTON' || event.target.closest('button')) {
                    return;
                }

                card.classList.toggle('expanded');
                if (expandedContent) {
                    if (card.classList.contains('expanded')) {
                        expandedContent.style.display = 'block';
                    } else {
                        expandedContent.style.display = 'none';
                    }
                }
            });
        }
        
        // Prevent clicks on expanded content from collapsing the card
        if (expandedContent) {
            expandedContent.addEventListener('click', (event) => {
                event.stopPropagation();
            });
        }

        return card;
    }

    /**
     * Populate selling tab with ALL available cargo types from all settlements
     * @private
     */
    _populateSellingResources() {
        console.log('🛒 POPULATING ALL SELLABLE RESOURCES');
        
        const resourceButtonsContainer = this.app.element.querySelector('#resource-buttons');
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
                this.app.eventHandlers._onSellingResourceSelect(goodName);
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
            const productionCategories = settlement.flags || settlement.source || [];
            if (productionCategories && Array.isArray(productionCategories)) {
                productionCategories.forEach(good => {
                    // Skip "Trade" as it's not a sellable good but a settlement modifier
                    if (good !== 'Trade') {
                        allGoods.add(good);
                    }
                });
            }
        });
        
        // Also add cargo types from data manager if they exist
        const cargoTypes = this.dataManager ? this.dataManager.getCargoTypes() : [];
        if (Array.isArray(cargoTypes)) {
            cargoTypes.forEach(cargoType => {
                if (cargoType.name !== 'Trade') {
                    allGoods.add(cargoType.name);
                }
            });
        }
        
        // Convert to sorted array
        return Array.from(allGoods).sort();
    }

    _updateSellingTab() {
        this._logDebug('UI State', 'Updating selling tab');
    }
}
