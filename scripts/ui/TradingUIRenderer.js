console.log('Trading Places | Loading TradingUIRenderer.js');

export default class TradingUIRenderer {
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

    // Tooltip management
    this._currentTooltip = null;
    this._currentTrigger = null;
    this._handleGlobalPointerDown = this._handleGlobalPointerDown.bind(this);
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
    const hasSeason = !!this.app.currentSeason;
    const hasTradableCargo = Array.isArray(this.app.successfulCargo) && this.app.successfulCargo.length > 0;
    const hasAnySlots = this.app.availableCargo.length > 0;

        // Get button elements
        const haggleBtn = this.app.element.querySelector('.haggle-button');
        const saleBtn = this.app.element.querySelector('.sale-button');
        const desperateSaleBtn = this.app.element.querySelector('.desperate-sale-button');
        const rumorSaleBtn = this.app.element.querySelector('.rumor-sale-button');

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
            const isTradeSettlement = this.dataManager?.isTradeSettlement(this.app.selectedSettlement);
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
            hasAnySlots,
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
    }

    /**
     * Create an info indicator HTML element
     * @param {string} tooltip - The tooltip text to display
     * @param {string} extraClass - Additional CSS classes (optional)
     * @returns {string} - HTML string for the info indicator
     * @private
     */
        _createInfoIndicator(tooltip, classes = 'info-indicator') {
        return `<span class="${classes}" data-info-tooltip="${tooltip.replace(/"/g, '&quot;')}">?</span>`;
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
        const statusEmoji = this.ICONS.cargo;
        const statusText = 'Merchants are offering cargo';
        const statusBanner = `<div class="availability-status-banner">${statusEmoji} ${statusText}</div>`;

        // Market check section (settlement info and overall roll)
        const availabilityCheck = completeResult.availabilityCheck || {};
        const slotOutcomes = Array.isArray(availabilityCheck.rolls) ? availabilityCheck.rolls : [];
        const successfulSlots = slotOutcomes.filter(outcome => outcome.success).length;
        const totalSlots = slotOutcomes.length;
        const sizeRating = this.dataManager.convertSizeToNumeric(this.app.selectedSettlement.size);
        const wealthRating = this.app.selectedSettlement.wealth;
        const baseChance = (sizeRating + wealthRating) * 10;
        const finalChance = Math.min(baseChance, 100);

        // Get slot information from pipeline result if available
        let slotExplanation = '';
        if (pipelineResult && pipelineResult.slotPlan) {
            const slotPlan = pipelineResult.slotPlan;
            const tooltipContent = `
Availability Check: ${totalSlots} slots rolled, ${successfulSlots} successful

Slot Calculation:
${slotPlan.reasons.map(reason => `${reason.label}: ${reason.value}`).join('\n')}
${slotPlan.formula.multipliers.map(multiplier => `${multiplier.label}: ${multiplier.detail}`).join('\n')}
            `.trim();
            slotExplanation = this.createTooltipElement(
                `<strong>Available Slots:</strong> ${successfulSlots}/${slotPlan.totalSlots}`,
                tooltipContent,
                'p'
            );
        }

        const marketCheckHtml = `
            <section class="market-check-section">
                <h5>Market Check</h5>
                <div class="calculation-breakdown">
                    <p><strong>Settlement:</strong> ${this.app.selectedSettlement.name}</p>
                    <p><strong>Size:</strong> ${this.dataManager.getSizeDescription(this.app.selectedSettlement.size)} (${sizeRating})</p>
                    <p><strong>Wealth:</strong> ${this.dataManager.getWealthDescription(wealthRating)} (${wealthRating})</p>
                    ${slotExplanation}
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

        let otherCandidatesHtml = '';
        if (candidateTable.entries && candidateTable.entries.length > 1) {
            // Sort by probability descending, take top 5 including the selected one
            const topCandidates = candidateTable.entries
                .sort((a, b) => b.probability - a.probability)
                .slice(0, 5);
            
            otherCandidatesHtml = `
                <p><strong>Alternative Options:</strong></p>
                <ul>
                    ${topCandidates.map(candidate => 
                        candidate.name === cargo.name 
                            ? `<li><strong>${candidate.name}</strong> (${candidate.probability.toFixed(1)}%) - SELECTED</li>`
                            : `<li>${candidate.name} (${candidate.probability.toFixed(1)}%)</li>`
                    ).join('')}
                </ul>
            `;
        }

        return `
            <div class="pipeline-detail">
                <p><strong>Selected Cargo:</strong> ${cargo.name} (${cargo.category})</p>
                <p><strong>Selection Probability:</strong> ${cargo.probability?.toFixed(1) || 'N/A'}%</p>
                ${cargo.reasons && cargo.reasons.length > 0 ? `
                    <p><strong>Why This Cargo:</strong></p>
                    <ul>
                        ${cargo.reasons.map(reason => `<li>${reason}</li>`).join('')}
                    </ul>
                ` : ''}
                ${otherCandidatesHtml}
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

        let balanceExplanation = '';
        switch (balance.state) {
            case 'blocked':
                balanceExplanation = 'Market is completely blocked - no trading possible. This cargo should not exist!';
                break;
            case 'desperate':
                balanceExplanation = 'Market is desperate - merchants are willing to accept lower prices and offer larger quantities.';
                break;
            case 'scarce':
                balanceExplanation = 'Supply is scarce - higher prices, smaller quantities available.';
                break;
            case 'glut':
                balanceExplanation = 'Supply glut - lower prices, larger quantities available.';
                break;
            case 'balanced':
                balanceExplanation = 'Market is balanced - normal prices and quantities.';
                break;
            default:
                balanceExplanation = 'Market state unknown.';
        }

        return `
            <div class="pipeline-detail">
                <p><strong>Final Balance:</strong> ${balance.supply || 0} supply / ${balance.demand || 0} demand</p>
                <p><strong>Market State:</strong> ${balance.state || 'unknown'}</p>
                <p><strong>What This Means:</strong> ${balanceExplanation}</p>
                <p><strong>How It Affects Trading:</strong></p>
                <ul>
                    <li><strong>Supply/Demand Ratio:</strong> Higher supply = lower prices, larger quantities</li>
                    <li><strong>Market States:</strong> Blocked (no trade) → Desperate (best deals) → Scarce (high prices) → Glut (low prices) → Balanced (normal)</li>
                    <li><strong>Price Impact:</strong> ${balance.supply > balance.demand ? 'Lower prices due to oversupply' : balance.supply < balance.demand ? 'Higher prices due to scarcity' : 'Normal prices'}</li>
                </ul>
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
        
        // Debug: Log what cargo we're displaying
        console.log('🎨 UI RENDERER RECEIVING CARGO:', cargoList.map(c => ({
            slot: c.slotNumber,
            available: c.isSlotAvailable,
            name: c.name || null
        })));
        
        // Show the cargo grid
        cargoGrid.style.display = 'block';
        
        // Clear existing cargo cards
        cargoGrid.innerHTML = '';
        
        // Create cargo cards for each available cargo
        cargoList.forEach(cargo => {
            const cargoCard = cargo.isSlotAvailable
                ? this._createSuccessfulCargoCard(cargo)
                : this._createFailedSlotCard(cargo);
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
    _createSuccessfulCargoCard(cargo) {
        const card = document.createElement('div');
        card.className = 'cargo-card collapsible slot-success';

        // Basic info (always visible) - matches original layout
        let basicInfo = `
            <div class="cargo-header">
                <div class="cargo-name">${cargo.name}</div>
                <div class="cargo-category">${cargo.category || 'Goods'}</div>
            </div>
            <div class="cargo-details">`;

        // Add info indicators for detailed information (all cargo now has slotInfo)
        const slot = cargo.slotInfo;
        
        // Price per EP with info indicator
        let priceTooltip = `Base Price: ${((slot.pricing?.basePricePerEP || 0) * 1).toFixed(2)} GC/EP\nFinal Price: ${((slot.pricing?.finalPricePerEP || 0) * 1).toFixed(2)} GC/EP`;
        
        if (slot.pricing?.steps && slot.pricing.steps.length > 0) {
            priceTooltip += '\n\nPrice Calculation Steps:';
            priceTooltip += `\n• Base: ${((slot.pricing.basePricePerEP || 0) * 1).toFixed(2)} GC/EP`;
            slot.pricing.steps.forEach(step => {
                priceTooltip += `\n• ${step?.label || 'Unknown'}: ${((step?.perEP || 0) * 1).toFixed(2)} GC/EP`;
            });
        }
        
        // Total price with info indicator (shows total amounts, not per EP)
        const quantity = cargo.totalEP ?? cargo.quantity ?? 0;
        let totalPriceTooltip = `Base Total: ${((slot.pricing?.basePricePerEP || 0) * quantity).toFixed(2)} GC\nFinal Total: ${((slot.pricing?.finalPricePerEP || 0) * quantity).toFixed(2)} GC`;
        
        if (slot.pricing?.steps && slot.pricing.steps.length > 0) {
            totalPriceTooltip += '\n\nTotal Price Calculation Steps:';
            totalPriceTooltip += `\n• Base: ${((slot.pricing.basePricePerEP || 0) * quantity).toFixed(2)} GC`;
            slot.pricing.steps.forEach(step => {
                totalPriceTooltip += `\n• ${step?.label || 'Unknown'}: ${((step?.perEP || 0) * quantity).toFixed(2)} GC`;
            });
        }
        
        // Available quantity with info indicator
        const quantityTooltip = `Amount: ${cargo.totalEP} EP\n\nCalculated from:\n• Base Roll: ${slot.amount?.roll || 'N/A'} (1d100)\n• Size Modifier: ×${((slot.amount?.sizeModifier || 0) * 1).toFixed(2)}\n• Wealth Modifier: ×${((slot.amount?.wealthModifier || 0) * 1).toFixed(2)}\n• Supply Modifier: ×${((slot.amount?.supplyModifier || 0) * 1).toFixed(2)}`;
        
        // Quality with info indicator
        const qualityTooltip = `Quality Tier: ${cargo.quality}\nQuality Score: ${((slot.quality?.score || 0) * 1).toFixed(2)}\n\nDetermined by settlement wealth rating plus production flags and market pressure.`;
        
        // Merchant with info indicator
        const merchantTooltip = `Name: ${cargo.merchant?.name || 'Unknown'}\nSkill: ${cargo.merchant?.skillDescription || 'Unknown'}\nHaggling Skill: ${cargo.merchant?.hagglingSkill || 'N/A'}\n\nMerchant generated using percentile-based skill system. Base skill (${cargo.merchant?.baseSkill || 'N/A'}) calculated from settlement wealth rating and percentile roll. Higher skills make haggling harder for players.${cargo.merchant?.specialBehaviors?.length > 0 ? `\n\nSpecial Behaviors: ${cargo.merchant.specialBehaviors.join(', ')}` : ''}`;
        
        basicInfo += `
                <div class="price-info">
                    <span class="price-label">Price per EP:</span>
                    <span class="price-value">${this._formatPricePerEP(cargo)} GC</span>
                    ${this._createInfoIndicator(priceTooltip)}
                </div>
                <div class="price-info">
                    <span class="price-label">Available:</span>
                    <span class="price-value">${cargo.totalEP ?? cargo.quantity} EP</span>
                    ${this._createInfoIndicator(quantityTooltip)}
                </div>
                <div class="price-info">
                    <span class="price-label">Total Price:</span>
                    <span class="price-value">${this._formatTotalPrice(cargo)} GC</span>
                    ${this._createInfoIndicator(totalPriceTooltip)}
                </div>
                <div class="price-info">
                    <span class="price-label">Quality:</span>
                    <span class="price-value">${cargo.quality || 'Average'}</span>
                    ${this._createInfoIndicator(qualityTooltip)}
                </div>
                <div class="merchant-info">
                    <div class="merchant-header">
                        <span class="merchant-name">${cargo.merchant?.name || 'Unknown'}</span> &nbsp;
                        <div class="merchant-skill">${cargo.merchant?.skillDescription || 'Unknown'}</div>
                        ${this._createInfoIndicator(merchantTooltip, 'merchant-info-indicator')}
                    </div>
                    <div class="merchant-description">${cargo.merchant?.description || ''}</div>
                </div>`;
        
        basicInfo += `
            </div>
        `;

        // Detailed pipeline information (hidden by default) - all cargo now has slotInfo
        const detailedInfo = `
                <div class="cargo-details expanded-content">
                    <div class="pipeline-breakdown">
                        <h6>${this.ICONS.calculation} Pipeline Details</h6>

                        <div class="pipeline-section">
                            <h7>${this.ICONS.cargo} Cargo Selection</h7>
                            <p><strong>Type:</strong> ${cargo.name} (${cargo.category})</p>
                            <p><strong>Market Balance:</strong> ${slot.balance?.state || 'unknown'} (${slot.balance?.supply || 0}/${slot.balance?.demand || 0})</p>
                            <p class="explanation">Market balance represents supply (${slot.balance?.supply || 0}) vs demand (${slot.balance?.demand || 0}) levels that affect cargo quantity and pricing. ${slot.balance?.state === 'desperate' ? 'Low supply creates desperate conditions affecting merchant behavior and pricing.' : slot.balance?.state === 'glut' ? 'Excess supply makes goods plentiful and potentially cheaper.' : slot.balance?.state === 'scarce' ? 'High demand with low supply increases prices and reduces availability.' : slot.balance?.state === 'balanced' ? 'Supply and demand are roughly equal, creating stable market conditions.' : 'Market conditions affect pricing and availability.'} Balance is calculated from settlement production, consumption, seasonal effects, and wealth factors.</p>
                        </div>

                        <div class="pipeline-section">
                            <h7>${this.ICONS.quantity} Quantity & Quality</h7>
                            <p><strong>Amount:</strong> ${cargo.totalEP} EP</p>
                            <p><strong>Quality:</strong> ${cargo.quality}</p>
                            <p class="explanation">Amount calculated from percentile roll (${slot.amount?.roll || 'ERROR: Missing roll data'}) adjusted by settlement size (${((slot.amount?.wealthModifier || 0) * 1).toFixed(2)}× wealth) and supply/demand ratio (${((slot.amount?.supplyModifier || 0) * 1).toFixed(2)}×). Quality determined by settlement wealth rating (${((slot.quality?.score || 0) * 1).toFixed(2)} total score) plus production flags and market pressure.</p>
                            ${slot.contraband ? `<p><strong>⚠️ Contraband:</strong> Yes</p>` : ''}
                        </div>

                        <div class="pipeline-section">
                            <h7>${this.ICONS.value} Pricing</h7>
                            <p><strong>Base Price:</strong> ${((slot.pricing?.basePricePerEP || 0) * 1).toFixed(2)} GC/EP</p>
                            <p><strong>Final Price:</strong> ${((slot.pricing?.finalPricePerEP || 0) * 1).toFixed(2)} GC/EP</p>
                            <p><strong>Total Value:</strong> ${((slot.pricing?.totalValue || 0) * 1).toFixed(2)} GC</p>
                            ${slot.pricing?.steps ? `<div class="pricing-breakdown">
                                <p><strong>Pricing Breakdown:</strong></p>
                                <ul>
                                    <li>Base: ${((slot.pricing?.basePricePerEP || 0) * 1).toFixed(2)} GC/EP</li>
                                    ${slot.pricing.steps.map(step => `<li>${step?.label || 'Unknown'}: ${((step?.perEP || 0) * 1).toFixed(2)} GC/EP</li>`).join('')}
                                    <li><strong>Final Price: ${((slot.pricing?.finalPricePerEP || 0) * 1).toFixed(2)} GC/EP</strong></li>
                                </ul>
                            </div>` : '<p class="error">ERROR: Missing pricing calculation data</p>'}
                        </div>

                        <div class="pipeline-section">
                            <h7>${this.ICONS.merchant} Merchant Details</h7>
                            <p><strong>Name:</strong> ${cargo.merchant?.name || 'Unknown'}</p>
                            <p><strong>Skill:</strong> ${cargo.merchant?.skillDescription || 'Unknown'}</p>
                            <p><strong>Haggling Skill:</strong> ${cargo.merchant?.hagglingSkill || 'N/A'}</p>
                            <p class="explanation">Merchant generated using percentile-based skill system from config. Base skill (${cargo.merchant?.baseSkill || 'N/A'}) calculated from settlement wealth rating and percentile roll. Higher skills make haggling harder for players. Every cargo slot gets a unique merchant.</p>
                            ${cargo.merchant?.specialBehaviors?.length > 0 ? `<p><strong>Special Behaviors:</strong> ${cargo.merchant.specialBehaviors.join(', ')}</p>` : ''}
                        </div>
                    </div>
                </div>
            `;

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

        // Add click handlers for info indicators
        const infoIndicators = card.querySelectorAll('.info-indicator');
        infoIndicators.forEach(indicator => {
            indicator.addEventListener('click', (event) => {
                event.stopPropagation(); // Prevent card expansion
                
                const tooltip = indicator.dataset.infoTooltip;
                if (tooltip) {
                    this._showInfoTooltip(tooltip, indicator);
                }
            });
        });

        return card;
    }

    _createFailedSlotCard(slotResult) {
        const card = document.createElement('div');
        card.className = 'cargo-card slot-failure';

    const roll = slotResult?.availability?.roll;
    const target = slotResult?.availability?.chance;
        const failureMessage = slotResult?.failure?.message || 'No cargo generated for this slot.';

        const header = document.createElement('div');
        header.className = 'failed-slot-header';
        header.innerHTML = `
            <div class="failed-slot-icon">${this.ICONS.failure}</div>
            <div class="failed-slot-title">Slot ${slotResult.slotNumber || '?'} unavailable</div>
        `;

        const details = document.createElement('div');
        details.className = 'failed-slot-details';
        details.innerHTML = `
            <div class="failed-slot-roll">Roll ${roll ?? 'N/A'} > Target ${target ?? 'N/A'}</div>
            <div class="failed-slot-message">${failureMessage}</div>
        `;

        card.appendChild(header);
        card.appendChild(details);

        return card;
    }

    _formatPricePerEP(cargo) {
        const price = cargo.currentPrice ?? cargo.basePrice ?? cargo.slotInfo?.pricing?.finalPricePerEP;
        if (typeof price === 'number') {
            return price.toFixed(2);
        }
        return 'N/A';
    }

    _formatTotalPrice(cargo) {
        const totalValue = cargo.slotInfo?.pricing?.totalValue ?? cargo.totalValue;
        if (typeof totalValue === 'number') {
            return totalValue.toFixed(2);
        }

        const pricePerEp = cargo.currentPrice ?? cargo.basePrice ?? cargo.slotInfo?.pricing?.finalPricePerEP;
        const availableEp = cargo.totalEP ?? cargo.quantity ?? cargo.slotInfo?.amount?.totalEP;
        if (typeof pricePerEp === 'number' && typeof availableEp === 'number') {
            return (pricePerEp * availableEp).toFixed(2);
        }

        return 'N/A';
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

    /**
     * Show an info tooltip with detailed information
     * @param {string} content - The content to display in the tooltip
     * @param {HTMLElement} triggerElement - The element that triggered the tooltip
     * @private
     */
    _showInfoTooltip(content, triggerElement) {
        // Toggle off if the same indicator is clicked while tooltip is visible
        if (this._currentTooltip && this._currentTrigger === triggerElement) {
            this._hideInfoTooltip();
            return;
        }

        // Hide any existing tooltip first
        this._hideInfoTooltip();

        // Create tooltip element
        const tooltip = document.createElement('div');
        tooltip.className = 'info-tooltip';
        tooltip.innerHTML = `<p>${content.replace(/\n/g, '<br>')}</p>`;

        // Position the tooltip near the trigger element
        const rect = triggerElement.getBoundingClientRect();
        const appRect = this.app.element.getBoundingClientRect();

        // Try to position below the trigger element first
        let left = rect.left - appRect.left;
        let top = rect.bottom - appRect.top + 5;

        // If it would go off the right edge, position it to the left
        if (left + 300 > appRect.width) {
            left = appRect.width - 300 - 5;
        }

        // If it would go off the bottom, position it above
        if (top + 200 > appRect.height) {
            top = rect.top - appRect.top - 200 - 5;
        }

        // Ensure it doesn't go off the edges
        left = Math.max(5, Math.min(left, appRect.width - 300 - 5));
        top = Math.max(5, top);

        tooltip.style.left = `${left}px`;
        tooltip.style.top = `${top}px`;
        tooltip.style.position = 'absolute';

        // Add to the app element instead of document.body
        this.app.element.appendChild(tooltip);

        // Show with animation
        requestAnimationFrame(() => tooltip.classList.add('show'));

        // Store reference for cleanup and attach global listener
        this._currentTooltip = tooltip;
        this._currentTrigger = triggerElement;

        document.addEventListener('pointerdown', this._handleGlobalPointerDown, true);
    }

    _handleGlobalPointerDown(event) {
        if (!this._currentTooltip) {
            return;
        }

        const target = event.target;

        if (this._currentTooltip.contains(target)) {
            return;
        }

        if (this._currentTrigger && (target === this._currentTrigger || this._currentTrigger.contains(target))) {
            return;
        }

        if (target.closest('.info-indicator')) {
            return;
        }

        this._hideInfoTooltip();
    }

    /**
     * Hide the current info tooltip
     * @private
     */
    _hideInfoTooltip() {
        if (this._currentTooltip) {
            const tooltip = this._currentTooltip;
            tooltip.classList.remove('show');
            setTimeout(() => {
                if (tooltip && tooltip.parentNode) {
                    tooltip.parentNode.removeChild(tooltip);
                }
            }, 200); // Wait for animation
        }
        this._currentTooltip = null;
        this._currentTrigger = null;
        document.removeEventListener('pointerdown', this._handleGlobalPointerDown, true);
    }

    /**
     * Update selling tab state
     * @private
     */
    _updateSellingTab() {
        this._logDebug('UI State', 'Updating selling tab');
    }
}
