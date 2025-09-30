
console.log('Trading Places | Loading TradingUIRenderer.js');

export class TradingUIRenderer {
    constructor(app) {
        this.app = app;
        this.dataManager = app.dataManager;
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
            ? `<ul class="cargo-details-list">${availableCargo.map(cargo => {
                const totalEp = cargo.totalEP ?? cargo.quantity ?? 0;
                return `<li><strong>${cargo.name}</strong> (${cargo.category}) — ${totalEp} EP available @ ${cargo.basePrice} GC / 10 EP</li>`;
            }).join('')}</ul>`
            : '<p><em>No cargo allocations succeeded.</em></p>';

        const marketHtml = `
            <div class="calculation-breakdown">
                <p><strong>Settlement:</strong> ${this.app.selectedSettlement.name}</p>
                <p><strong>Size Rating:</strong> ${this.app.selectedSettlement.size} (${sizeRating})</p>
                <p><strong>Wealth Rating:</strong> ${wealthRating}</p>
                <p><strong>Chance:</strong> (${sizeRating} + ${wealthRating}) × 10 = ${finalChance}%</p>
                <p><strong>Roll:</strong> ${rollDetails.roll}</p>
                <p><strong>Result:</strong> ${rollDetails.roll} ${isSuccess ? '≤' : '>'} ${finalChance} = <span class="${statusClass}">${isSuccess ? 'SUCCESS' : 'FAILURE'}</span></p>
            </div>
        `;

        const cargoTotals = isSuccess ? `
            <div class="calculation-breakdown">
                <p><strong>Total EP:</strong> ${completeResult.cargoSize?.totalSize || 0}</p>
                <p><strong>Base Multiplier:</strong> ${sizeRating} + ${wealthRating} = ${completeResult.cargoSize?.baseMultiplier || 0}</p>
                <p><strong>Size Roll:</strong> ${completeResult.cargoSize?.roll1 || '-'} → ${completeResult.cargoSize?.sizeMultiplier || '-'}</p>
                ${completeResult.cargoSize?.tradeBonus ? `<p><strong>Trade Bonus:</strong> Second roll ${completeResult.cargoSize.roll2} applied</p>` : ''}
            </div>
        ` : '';

        const pipelineHtml = this._renderPipelineDiagnostics(pipelineResult);

        resultsContainer.innerHTML = `
            <section class="availability-results-card ${isSuccess ? 'success' : 'failure'}">
                <header class="availability-header">
                    <h4 class="${statusClass}"><i class="${statusIcon}"></i> ${statusTitle}</h4>
                    <p>${isSuccess ? 'Merchants are offering cargo this visit.' : 'No producers opened stalls this visit.'}</p>
                </header>
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
            </section>
        `;

        resultsContainer.style.display = 'block';
    }

    _renderPipelineDiagnostics(pipelineResult) {
        if (!pipelineResult) {
            return '';
        }

        const settlement = pipelineResult.settlement || {};
        const slotPlan = pipelineResult.slotPlan || {};
        const candidateTable = pipelineResult.candidateTable || {};
        const slots = Array.isArray(pipelineResult.slots) ? pipelineResult.slots : [];

        const multiplierList = (slotPlan.formula?.multipliers || []).map(item => `
            <li>${item.label}${item.detail ? ` — ${item.detail}` : ''}</li>
        `).join('');

        const candidateList = (candidateTable.entries || []).slice(0, 8).map(entry => {
            const reasons = Array.isArray(entry.reasons) && entry.reasons.length
                ? `<ul>${entry.reasons.map(reason => `<li>${reason}</li>`).join('')}</ul>`
                : '';
            return `<li><strong>${entry.name}</strong> (${entry.category}) — ${(entry.probability || 0).toFixed(1)}%${reasons}</li>`;
        }).join('');

        const slotCards = slots.map(slot => {
            const balance = slot.balance || {};
            const amount = slot.amount || {};
            const quality = slot.quality || {};
            const contraband = slot.contraband || {};
            const merchant = slot.merchant || {};
            const desperation = slot.desperation || {};
            const pricing = slot.pricing || {};

            const balanceHistory = (balance.history || []).map(entry => `
                <li>${entry.label}: ${entry.before?.supply ?? '-'}→${entry.after?.supply ?? '-'} supply / ${entry.before?.demand ?? '-'}→${entry.after?.demand ?? '-'} demand</li>
            `).join('');

            const amountNotes = Array.isArray(amount.notes) ? amount.notes.map(note => `<li>${note}</li>`).join('') : '';
            const qualityNotes = Array.isArray(quality.notes) ? quality.notes.map(note => `<li>${note}</li>`).join('') : '';
            const contrabandNotes = Array.isArray(contraband.notes) ? contraband.notes.map(note => `<li>${note}</li>`).join('') : '';
            const desperationNotes = Array.isArray(desperation.notes) ? desperation.notes.map(note => `<li>${note}</li>`).join('') : '';
            const pricingSteps = Array.isArray(pricing.steps) ? pricing.steps.map(step => `<li>${step.label}: ${step.value?.toFixed ? step.value.toFixed(2) : step.value}</li>`).join('') : '';

            const qualityScore = typeof quality.score === 'number' ? quality.score.toFixed(2) : '—';
            const amountRoll = amount.roll ?? '—';
            const amountEp = amount.totalEP ?? 0;
            const contrabandChance = typeof contraband.chance === 'number' ? contraband.chance.toFixed(0) : '—';
            const merchantStatus = merchant.available ? 'Merchant present' : 'No merchant';
            const pricePerEp = typeof pricing.finalPricePerEP === 'number' ? pricing.finalPricePerEP.toFixed(2) : '—';
            const totalValue = typeof pricing.totalValue === 'number' ? pricing.totalValue.toFixed(2) : '—';
            const quantityEp = typeof pricing.quantity === 'number' ? pricing.quantity : amountEp;

            return `
                <article class="pipeline-slot-card">
                    <h6>Slot ${slot.slotNumber}${slot.cargo?.name ? ` — ${slot.cargo.name}` : ''}</h6>
                    <ul class="pipeline-slot-summary">
                        <li><strong>Balance:</strong> ${balance.state || 'unknown'} (${balance.supply || 0}/${balance.demand || 0})</li>
                        <li><strong>Amount:</strong> ${amountEp} EP (roll ${amountRoll})</li>
                        <li><strong>Quality:</strong> ${quality.tier || 'Average'} (score ${qualityScore})</li>
                        <li><strong>Contraband:</strong> ${contraband.contraband ? 'Yes' : 'No'} (${contrabandChance}% chance)</li>
                        <li><strong>Merchant:</strong> ${merchantStatus} (${merchant.roll ?? '—'}/${merchant.target ?? '—'})</li>
                        ${desperation.attempted ? `<li><strong>Desperation:</strong> ${desperation.success ? 'Success' : 'Failed'} (roll ${desperation.roll?.toFixed?.(2) ?? desperation.roll ?? '—'})</li>` : ''}
                        <li><strong>Pricing:</strong> ${pricePerEp} gc per EP → ${quantityEp} EP (${totalValue} gc)</li>
                    </ul>
                    ${balanceHistory ? `<details><summary>Balance Adjustments</summary><ul>${balanceHistory}</ul></details>` : ''}
                    ${amountNotes ? `<details><summary>Amount Notes</summary><ul>${amountNotes}</ul></details>` : ''}
                    ${qualityNotes ? `<details><summary>Quality Notes</summary><ul>${qualityNotes}</ul></details>` : ''}
                    ${contrabandNotes ? `<details><summary>Contraband Notes</summary><ul>${contrabandNotes}</ul></details>` : ''}
                    ${desperationNotes ? `<details><summary>Desperation Notes</summary><ul>${desperationNotes}</ul></details>` : ''}
                    ${pricingSteps ? `<details><summary>Pricing Steps</summary><ul>${pricingSteps}</ul></details>` : ''}
                </article>
            `;
        }).join('');

        return `
            <section class="pipeline-diagnostics">
                <h5>Orange Realism Pipeline</h5>
                <p><strong>Season:</strong> ${slotPlan.season || settlement.season || '–'}</p>
                <p><strong>Producer Slots:</strong> ${slotPlan.producerSlots || slotPlan.totalSlots || 0}</p>
                ${slotPlan.formula ? `
                    <details class="pipeline-formula">
                        <summary>Slot Formula</summary>
                        <ul>
                            <li>Base slots: ${slotPlan.formula.baseSlots ?? '—'}</li>
                            <li>Population contribution: ${slotPlan.formula.populationContribution ?? 0}</li>
                            <li>Size contribution: ${slotPlan.formula.sizeContribution ?? 0}</li>
                            ${multiplierList ? `<li>Multipliers<ul>${multiplierList}</ul></li>` : ''}
                        </ul>
                    </details>
                ` : ''}
                ${candidateList ? `<details class="pipeline-candidates"><summary>Top Cargo Candidates</summary><ul>${candidateList}</ul></details>` : ''}
                ${slotCards ? `<div class="pipeline-slots">${slotCards}</div>` : '<p>No producer slots resolved.</p>'}
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
