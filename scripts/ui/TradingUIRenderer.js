
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
     * Show detailed availability check results (always shows formula breakdown)
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

        const rollDetails = completeResult.availabilityCheck || { roll: '-', chance: '-' };
        const sizeRating = this.dataManager.convertSizeToNumeric(this.app.selectedSettlement.size);
        const wealthRating = this.app.selectedSettlement.wealth;
        const baseChance = (sizeRating + wealthRating) * 10;
        const finalChance = Math.min(baseChance, 100);

        const statusTitle = isSuccess ? 'Cargo Available' : 'No Cargo Available';
        const statusIcon = isSuccess ? 'fas fa-check-circle' : 'fas fa-times-circle';
        const statusClass = isSuccess ? 'success-text' : 'failure-text';

        const cargoSummaryHtml = isSuccess && Array.isArray(availableCargo) && availableCargo.length > 0
            ? `<div class="cargo-summary">
                ${availableCargo.map(cargo => {
                    const totalEp = cargo.totalEP ?? cargo.quantity ?? 0;
                    const merchantName = cargo.merchant?.name || 'Unknown Merchant';
                    const merchantSkill = cargo.merchant?.skillDescription || 'Unknown';
                    return `
                        <div class="cargo-item">
                            <div class="cargo-name">${cargo.name} (${cargo.category})</div>
                            <div class="cargo-quantity">${totalEp} EP</div>
                            <div class="cargo-merchant">${merchantName} (${merchantSkill})</div>
                            <details class="cargo-details">
                                <summary>${this.ICONS.value} ${cargo.basePrice} GC / 10 EP</summary>
                                <div class="cargo-detail-content">
                                    <p><strong>Quality:</strong> ${cargo.quality || 'Average'}</p>
                                    <p><strong>Description:</strong> ${cargo.merchant?.description || 'No description available'}</p>
                                </div>
                            </details>
                        </div>
                    `;
                }).join('')}
            </div>`
            : '<p><em>No merchants were able to allocate cargo for sale.</em></p>';

        const marketHtml = `
            <div class="calculation-breakdown">
                <p><strong>Settlement:</strong> ${this.app.selectedSettlement.name}</p>
                <p><strong>Size:</strong> ${this.dataManager.getSizeDescription(this.app.selectedSettlement.size)} (${sizeRating})</p>
                <p><strong>Wealth:</strong> ${this.dataManager.getWealthDescription(wealthRating)} (${wealthRating})</p>
                <p><strong>Base Chance:</strong> <span title="Size contribution: ${sizeRating} × 10 = ${sizeRating * 10}%, Wealth contribution: ${wealthRating} × 10 = ${wealthRating * 10}%, Total: ${(sizeRating + wealthRating) * 10}%">${(sizeRating + wealthRating) * 10}%</span></p>
                <p><strong>Final Chance:</strong> ${finalChance}% <span title="Capped at 100% maximum">(cannot exceed 100%)</span></p>
                <p><strong>Roll & Result:</strong> ${this.ICONS.roll} ${rollDetails.roll} ${isSuccess ? '≤' : '>'} ${finalChance} = <span class="${statusClass}">${isSuccess ? '✅' : 'FAILURE'}</span></p>
            </div>
        `;

        const cargoTotals = isSuccess ? `
            <div class="calculation-breakdown">
                <p><strong>Total EP:</strong> ${completeResult.cargoSize?.totalSize || 0}</p>
                <p><strong>Base Multiplier:</strong> <span title="Size rating (${sizeRating}) + Wealth rating (${wealthRating}) = base for cargo amount calculations">${sizeRating} + ${wealthRating} = ${completeResult.cargoSize?.baseMultiplier || 0}</span></p>
                <p><strong>Size Roll:</strong> ${completeResult.cargoSize?.roll1 || '-'} → ${completeResult.cargoSize?.sizeMultiplier || '-'}</p>
                ${completeResult.cargoSize?.tradeBonus ? `<p><strong>Trade Bonus:</strong> Second roll ${completeResult.cargoSize.roll2} applied</p>` : ''}
            </div>
        ` : '';

        const pipelineHtml = isSuccess ? this._renderPipelineDiagnostics(pipelineResult) : '';

        // Create status banner instead of header
        const statusEmoji = isSuccess ? this.ICONS.cargo : this.ICONS.failure;
        const statusText = isSuccess ? 'Merchants are offering cargo' : 'No merchants available';
        const statusBanner = `<div class="availability-status-banner ${isSuccess ? '' : 'no-goods'}">${statusEmoji} ${statusText}</div>`;

        resultsContainer.innerHTML = `
            ${statusBanner}
            <div class="availability-sections">
                <section>
                    <h5>Market Check</h5>
                    ${marketHtml}
                </section>
                <section>
                    <h5>${isSuccess ? 'Allocated Cargo' : 'Availability Notes'}</h5>
                    ${isSuccess ? cargoSummaryHtml : '<p><em>This settlement is trading cautiously. Try again later or seek rumors.</em></p>'}
                    ${cargoTotals}
                </section>
            </div>
            ${pipelineHtml}
        `;

        resultsContainer.style.display = 'block';
    }

    _renderPipelineDiagnostics(pipelineResult) {
        if (!pipelineResult) {
            return '';
        }

        const settlement = pipelineResult.settlement || {};
        const slotPlan = pipelineResult.slotPlan || {};
        const slots = Array.isArray(pipelineResult.slots) ? pipelineResult.slots : [];

        // Critical highlights - show by default
        const totalSlots = slotPlan.producerSlots || slotPlan.totalSlots || 0;
        const successfulSlots = slots.filter(slot => slot.merchant?.available).length;
        const totalEP = slots.reduce((sum, slot) => sum + (slot.amount?.totalEP || 0), 0);
        const contrabandCount = slots.filter(slot => slot.contraband?.contraband).length;
        const desperationAttempts = slots.filter(slot => slot.desperation?.attempted).length;

        const highlightsHtml = `
            <div class="pipeline-highlights">
                <div class="highlight-item">
                    <span class="highlight-label">Producer Slots:</span>
                    <span class="highlight-value">${successfulSlots}/${totalSlots} active</span>
                </div>
                <div class="highlight-item">
                    <span class="highlight-label">Total Cargo:</span>
                    <span class="highlight-value">${totalEP} EP</span>
                </div>
                ${contrabandCount > 0 ? `
                    <div class="highlight-item">
                        <span class="highlight-label">Contraband:</span>
                        <span class="highlight-value ${this.ICONS.risk}">${contrabandCount} items</span>
                    </div>
                ` : ''}
                ${desperationAttempts > 0 ? `
                    <div class="highlight-item">
                        <span class="highlight-label">Desperation:</span>
                        <span class="highlight-value ${this.ICONS.risk}">${desperationAttempts} attempts</span>
                    </div>
                ` : ''}
            </div>
        `;

        // Detailed breakdowns - hidden by default
        const slotPlanDetails = slotPlan.formula ? `
            <details class="pipeline-details">
                <summary>${this.ICONS.calculation} Slot Planning Details</summary>
                <div class="detail-content">
                    <ul>
                        <li><strong>Base slots:</strong> ${slotPlan.formula.baseSlots ?? '—'}</li>
                        <li><strong>Population contribution:</strong> ${slotPlan.formula.populationContribution ?? 0}</li>
                        <li><strong>Size contribution:</strong> ${slotPlan.formula.sizeContribution ?? 0}</li>
                        ${(slotPlan.formula.multipliers || []).map(item => 
                            `<li><strong>${item.label}:</strong> ${item.detail || ''}</li>`
                        ).join('')}
                    </ul>
                </div>
            </details>
        ` : '';

        const slotBreakdown = slots.length > 0 ? `
            <details class="pipeline-details">
                <summary>${this.ICONS.quantity} Slot-by-Slot Breakdown</summary>
                <div class="detail-content">
                    ${slots.map(slot => {
                        const balance = slot.balance || {};
                        const amount = slot.amount || {};
                        const quality = slot.quality || {};
                        const contraband = slot.contraband || {};
                        const merchant = slot.merchant || {};
                        const pricing = slot.pricing || {};

                        return `
                            <div class="slot-summary">
                                <h6>Slot ${slot.slotNumber}: ${slot.cargo?.name || 'Empty'}</h6>
                                <ul>
                                    <li><strong>Balance:</strong> ${balance.state || 'unknown'} (${balance.supply || 0}/${balance.demand || 0})</li>
                                    <li><strong>Amount:</strong> ${amount.totalEP || 0} EP</li>
                                    <li><strong>Quality:</strong> ${quality.tier || 'Average'}</li>
                                    <li><strong>Contraband:</strong> ${contraband.contraband ? `${this.ICONS.risk} Yes` : 'No'}</li>
                                    <li><strong>Merchant:</strong> ${merchant.available ? `${this.ICONS.merchant} Present` : 'None'}</li>
                                    <li><strong>Price:</strong> ${pricing.finalPricePerEP?.toFixed(2) || '—'} GC/EP</li>
                                </ul>
                            </div>
                        `;
                    }).join('')}
                </div>
            </details>
        ` : '';

        return `
            <section class="pipeline-diagnostics">
                <h5>Orange Realism Pipeline</h5>
                ${highlightsHtml}
                ${slotPlanDetails}
                ${slotBreakdown}
            </section>
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
     * Create a cargo card element
     * @param {Object} cargo - Cargo data
     * @returns {HTMLElement} - Cargo card element
     * @private
     */
    _createCargoCard(cargo) {
        const card = document.createElement('div');
        card.className = 'cargo-card';
        
        card.innerHTML = `
            <div class="cargo-header">
                <div class="cargo-name">${cargo.name}</div>
                <div class="cargo-category">${cargo.category || 'Goods'}</div>
            </div>
            <div class="cargo-details">
                <div class="price-info">
                    <span class="price-label">Base Price:</span>
                    <span class="price-value">${cargo.currentPrice || cargo.basePrice} GC</span>
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
                    <span class="merchant-label">Merchant:</span>
                    <span class="merchant-value">${cargo.merchant.name}</span>
                    <div class="merchant-description">${cargo.merchant.description}</div>
                    <div class="merchant-skill">Skill: ${cargo.merchant.skillDescription} (${cargo.merchant.skill})</div>
                </div>
            </div>
        `;
        
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
