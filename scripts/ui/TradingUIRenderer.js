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
        console.log('🔍 DEBUG: _updateUIState called');
        // Update season display
        if (this.app.currentSeason) {
            const seasonSelect = this.app.element.querySelector('#current-season');
            if (seasonSelect) {
                seasonSelect.value = this.app.currentSeason;
            }
        }

        // Update button states
        this._updateTransactionButtons();

        // Attach tooltip handlers for settlement info
        this._attachSettlementInfoTooltips();
    }    /**
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
     * Attach click handlers for settlement info tooltips
     * @private
     */
    _attachSettlementInfoTooltips() {
        // Find all info indicators in the settlement info section
        const settlementInfoSection = this.app.element.querySelector('.settlement-info-section');
        if (!settlementInfoSection) {
            console.log('🔍 DEBUG: No settlement-info-section found, trying alternative selector');
            // Try alternative selector
            const settlementInfoDiv = this.app.element.querySelector('.settlement-info');
            if (settlementInfoDiv) {
                const section = settlementInfoDiv.querySelector('section');
                if (section) {
                    console.log('🔍 DEBUG: Found settlement info section via alternative path');
                }
            }
            return;
        }

        const infoIndicators = settlementInfoSection.querySelectorAll('.info-indicator');
        console.log('🔍 DEBUG: Found info indicators:', infoIndicators.length);

        infoIndicators.forEach((indicator, index) => {
            // Remove existing listeners to avoid duplicates
            indicator.removeEventListener('click', this._handleInfoIndicatorClick);
            // Add the click handler with proper binding
            indicator.addEventListener('click', (event) => {
                console.log('🔍 DEBUG: Info indicator clicked:', index, event.target.dataset.infoTooltip);
                event.stopPropagation();
                const tooltip = event.target.dataset.infoTooltip;
                if (tooltip) {
                    this._showInfoTooltip(tooltip, event.target);
                }
            });
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

        // Get slot information from pipeline result if available
        let slotExplanation = '';
        if (pipelineResult && pipelineResult.slots && pipelineResult.slots.length > 0) {
            // Filter to only successful slots
            const successfulSlotsData = pipelineResult.slots.filter(slot => slot.merchant?.available !== false);
            const slotDetails = successfulSlotsData.map((slot, index) => {
                const slotNum = index + 1;
                let details = `Slot ${slotNum}: ${slot.cargo?.name || 'Unknown'} (${slot.cargo?.category || 'Unknown'})`;

                // Add merchant availability roll
                if (slot.merchant?.roll !== undefined && slot.merchant?.target !== undefined) {
                    details += `\n• Merchant Roll: ${slot.merchant.roll} ≤ ${slot.merchant.target} (${slot.merchant.roll <= slot.merchant.target ? 'SUCCESS' : 'FAILED'})`;
                }

                // Add cargo selection details
                if (slot.cargo?.roll !== undefined && slot.cargo?.target !== undefined) {
                    details += `\n• Cargo Selection: ${slot.cargo.roll} ≤ ${slot.cargo.target} (${slot.cargo.name})`;
                }

                // Add amount calculation
                if (slot.amount) {
                    const amount = slot.amount;
                    details += `\n• Amount: ${amount.roll || 'N/A'} (base) × ${amount.sizeModifier?.toFixed(2) || 'N/A'} (size) × ${amount.wealthModifier?.toFixed(2) || 'N/A'} (wealth) × ${amount.supplyModifier?.toFixed(2) || 'N/A'} (supply) = ${amount.totalEP || 0} EP`;
                }

                // Add quality calculation
                if (slot.quality) {
                    const quality = slot.quality;
                    details += `\n• Quality: ${quality.tier || 'Unknown'} (score: ${quality.score?.toFixed(2) || 'N/A'})`;
                }

                // Add contraband check
                if (slot.contraband) {
                    const contraband = slot.contraband;
                    details += `\n• Contraband: ${contraband.roll || 'N/A'} ≤ ${contraband.chance?.toFixed(1) || 'N/A'}% (${contraband.contraband ? 'YES' : 'NO'})`;
                }

                // Add pricing
                if (slot.pricing) {
                    const pricing = slot.pricing;
                    details += `\n• Pricing: ${pricing.basePricePerEP?.toFixed(2) || 'N/A'} → ${pricing.finalPricePerEP?.toFixed(2) || 'N/A'} GC/EP`;
                }

                return details;
            }).join('\n\n');

            const tooltipContent = `Availability Check: ${totalSlots} slots rolled, ${successfulSlots} successful

Detailed Slot Results:
${slotDetails}
            `.trim();
            slotExplanation = `<div class="slot-info">
                <strong>Successful Slots:</strong>
                <span class="slot-value">${successfulSlots}/${totalSlots} ${this._createInfoIndicator(tooltipContent)}</span>
            </div>`;
        }

        const marketCheckHtml = `
            <section class="market-check-section">
                <h5>Market Check Results</h5>
                <div class="calculation-breakdown">
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

        // Add click handlers for info indicators in the market check section
        const infoIndicators = resultsContainer.querySelectorAll('.info-indicator');
        infoIndicators.forEach(indicator => {
            indicator.addEventListener('click', (event) => {
                event.stopPropagation();
                
                const tooltip = indicator.dataset.infoTooltip;
                if (tooltip) {
                    this._showInfoTooltip(tooltip, indicator);
                }
            });
        });
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
        console.log('🎨 UI RENDERER: _updateCargoDisplay called with', cargoList.length, 'items');
        const cargoGrid = this.app.element.querySelector('#buying-cargo-grid');
        if (!cargoGrid) {
            console.error('🎨 UI RENDERER: Cannot find #buying-cargo-grid element');
            return;
        }
        
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
     * Create a cargo card element
     * @param {Object} cargo - Cargo data
     * @returns {HTMLElement} - Cargo card element
     * @private
     */
    _createSuccessfulCargoCard(cargo) {
        const card = document.createElement('div');
        
        // Check if cargo is contraband
        const isContraband = cargo.slotInfo?.contraband?.contraband === true;
        const contrabandClass = isContraband ? 'contraband' : '';
        
        card.className = `cargo-card slot-success ${contrabandClass}`;

        // Basic info (always visible) - matches original layout
        let basicInfo = `
            <div class="cargo-header">
                <div class="cargo-name">${cargo.name}</div>
                <div class="cargo-category">${cargo.category || 'Goods'}</div>
            </div>
            <div class="cargo-details">`;

        basicInfo += `
                <div class="price-info">
                    <span class="price-label">Available:</span>
                    <span class="price-value">${cargo.totalEP ?? cargo.quantity} EP</span>
                </div>
                <div class="price-info">
                    <span class="price-label">Price per EP:</span>
                    <span class="price-value">${this._formatPricePerEP(cargo)} GC</span>
                </div>
                <div class="price-info">
                    <span class="price-label">Total Price:</span>
                    <span class="price-value">${this._formatTotalPrice(cargo)} GC</span>
                </div>
                <div class="price-info">
                    <span class="price-label">Quality:</span>
                    <span class="price-value">${cargo.quality || 'Average'}</span>
                </div>`;

        // Add contraband warning if applicable
        if (isContraband) {
            basicInfo += `
                <div class="contraband-warning">
                    <span class="contraband-icon">🏴‍☠️</span>
                    <span class="contraband-text">Contraband - Illegal to transport</span>
                </div>`;
        }

        basicInfo += `
                <div class="merchant-info">
                    <div class="merchant-header">
                        <span class="merchant-name">${cargo.merchant?.name || 'Unknown'} (Skill: ${cargo.merchant?.baseSkill || 'N/A'})</span>
                    </div>
                    <div class="merchant-description">${cargo.merchant?.description || ''}</div>
                </div>
            </div>

            <!-- Buying Interface -->
            <div class="cargo-buying-interface">
                <div class="purchase-controls">
                    <div class="control-block quantity-controls">
                        <span class="control-label">Purchase (EP)</span>
                        <div class="control-body">
                            <input type="number" 
                                   class="quantity-input" 
                                   min="0" 
                                   max="${cargo.totalEP ?? cargo.quantity ?? 0}" 
                                   value="0" 
                                   step="1"
                                   data-cargo-id="${cargo.id || cargo.name}">
                            <input type="range" 
                                   class="quantity-slider" 
                                   min="0" 
                                   max="${cargo.totalEP ?? cargo.quantity ?? 0}" 
                                   value="0" 
                                   step="1">
                        </div>
                    </div>
                    <div class="control-block discount-controls">
                        <span class="control-label">Adjust (%)</span>
                        <div class="control-body">
                            <span class="discount-display">+0%</span>
                            <input type="range" 
                                   class="discount-slider" 
                                   min="-20" 
                                   max="20" 
                                   value="0" 
                                   step="0.5">
                        </div>
                    </div>
                    <div class="control-block price-calculation">
                        <button class="purchase-btn btn btn-success" 
                                data-cargo-id="${cargo.id || cargo.name}" 
                                disabled>
                            <i class="fas fa-shopping-cart"></i> Purchase
                        </button>
                        <div class="total-price-display">
                            <span class="total-price-label">Total Cost:</span>
                            <span class="total-price-value">0.00 GC</span>
                        </div>
                    </div>
                </div>
            </div>
        `;

        card.innerHTML = basicInfo;

        // Add event listeners for the buying interface
        this._attachBuyingInterfaceListeners(card, cargo);

        return card;
    }

    /**
     * Attach event listeners for the buying interface on a cargo card
     * @param {HTMLElement} card - The cargo card element
     * @param {Object} cargo - The cargo data
     * @private
     */
    _attachBuyingInterfaceListeners(card, cargo) {
        const quantityInput = card.querySelector('.quantity-input');
        const quantitySlider = card.querySelector('.quantity-slider');
        /* discount-input removed */
        const discountSlider = card.querySelector('.discount-slider');
        const discountDisplay = card.querySelector('.discount-display');
        const purchaseBtn = card.querySelector('.purchase-btn');
        const totalPriceValue = card.querySelector('.total-price-value');

        if (!quantityInput || !quantitySlider || !discountSlider || !discountDisplay || !purchaseBtn || !totalPriceValue) {
            console.warn('Buying interface elements not found for cargo:', cargo.name);
            return;
        }

        const maxQuantity = cargo.totalEP ?? cargo.quantity ?? 0;
        const pricePerEP = this._getPricePerEP(cargo);

        // Function to update the total price display
        const updateTotalPrice = (quantity, discountPercent) => {
            const discountMultiplier = 1 + (discountPercent / 100);
            const adjustedPricePerEP = pricePerEP * discountMultiplier;
            const totalPrice = quantity * adjustedPricePerEP;
            totalPriceValue.textContent = totalPrice.toFixed(2) + ' GC';
            
            // Enable/disable purchase button based on quantity
            purchaseBtn.disabled = quantity <= 0;
        };

        // Function to update the discount display
        const updateDiscountDisplay = (discountPercent) => {
            discountDisplay.textContent = (discountPercent >= 0 ? '+' : '') + discountPercent + '%';
            discountDisplay.style.color = discountPercent < 0 ? '#4caf50' : discountPercent > 0 ? '#f44336' : 'var(--text-primary)';
        };

        // Sync quantity controls
        const syncQuantityValues = (source, target) => {
            let value = parseInt(source.value) || 0;
            
            // Ensure value is within bounds
            value = Math.max(0, Math.min(maxQuantity, value));
            
            // Update both controls
            quantityInput.value = value;
            quantitySlider.value = value;
            
            // Update price display
            const discountPercent = parseFloat(discountSlider.value) || 0;
            updateTotalPrice(value, discountPercent);
        };

        // Discount control: slider drives the value
        const onDiscountChange = (source) => {
            let value = parseFloat(source.value) || 0;
            value = Math.max(-20, Math.min(20, value));
            discountSlider.value = value;
            updateDiscountDisplay(value);
            const quantity = parseInt(quantityInput.value) || 0;
            updateTotalPrice(quantity, value);
        };

        // Quantity event listeners
        quantityInput.addEventListener('input', (e) => {
            syncQuantityValues(e.target, quantitySlider);
        });

        quantityInput.addEventListener('change', (e) => {
            syncQuantityValues(e.target, quantitySlider);
        });

        quantitySlider.addEventListener('input', (e) => {
            syncQuantityValues(e.target, quantityInput);
        });

        // Discount event listeners (slider only)
        discountSlider.addEventListener('input', (e) => {
            onDiscountChange(e.target);
        });
        discountSlider.addEventListener('change', (e) => {
            onDiscountChange(e.target);
        });

        // Purchase button click handler
        purchaseBtn.addEventListener('click', (e) => {
            const quantity = parseInt(quantityInput.value) || 0;
            const discountPercent = parseFloat(discountSlider.value) || 0;
            if (quantity > 0) {
                this._handlePurchase(cargo, quantity, discountPercent);
            }
        });

        // Initialize with 0 values
        updateTotalPrice(0, 0);
        updateDiscountDisplay(0);
    }

    /**
     * Get the price per EP for a cargo item
     * @param {Object} cargo - The cargo data
     * @returns {number} - Price per EP
     * @private
     */
    _getPricePerEP(cargo) {
        return cargo.currentPrice ?? cargo.basePrice ?? cargo.slotInfo?.pricing?.finalPricePerEP ?? 0;
    }

    /**
     * Handle purchase of cargo
     * @param {Object} cargo - The cargo data
     * @param {number} quantity - Quantity to purchase
     * @param {number} discountPercent - Discount percentage (-20 to +20)
     * @private
     */
    _handlePurchase(cargo, quantity, discountPercent = 0) {
        console.log(`🛒 PURCHASING: ${quantity} EP of ${cargo.name} with ${discountPercent >= 0 ? '+' : ''}${discountPercent}% adjustment`);
        
        // Calculate adjusted price
        const pricePerEP = this._getPricePerEP(cargo);
        const discountMultiplier = 1 + (discountPercent / 100);
        const adjustedPricePerEP = pricePerEP * discountMultiplier;
        const totalCost = quantity * adjustedPricePerEP;
        
        // Add transaction to history
        const transaction = {
            cargo: cargo.name,
            category: cargo.category || 'Goods',
            quantity: quantity,
            pricePerEP: parseFloat(adjustedPricePerEP.toFixed(2)),
            totalCost: parseFloat(totalCost.toFixed(2)),
            settlement: this.app.selectedSettlement?.name || 'Unknown',
            season: this.app.currentSeason || 'Unknown',
            date: new Date().toISOString(),
            discountPercent: discountPercent,
            isSale: false,
            contraband: cargo.slotInfo?.contraband?.contraband || false,
            isManualEntry: false
        };
        
        // Add to transaction history
        if (!this.app.transactionHistory) {
            this.app.transactionHistory = [];
        }
        this.app.transactionHistory.unshift(transaction); // Add to beginning for newest first
        
        // Update cargo inventory - call the event handler method
        if (this.app.eventHandlers && this.app.eventHandlers._addCargoToInventory) {
            this.app.eventHandlers._addCargoToInventory(transaction).catch(error => {
                console.error('Failed to update cargo inventory:', error);
            });
        }
        
        console.log('💰 Transaction created:', transaction);
        console.log('💰 Transaction history now has:', this.app.transactionHistory.length, 'items');
        console.log('💰 First transaction:', this.app.transactionHistory[0]);
        
        // Save transaction history to Foundry settings for persistence
        game.settings.set("trading-places", "transactionHistory", this.app.transactionHistory)
            .then(() => {
                console.log('💰 Transaction history saved successfully');
            })
            .catch(error => {
                console.error('💰 Failed to save transaction history:', error);
            });
        
        // Show success notification
        if (ui && ui.notifications) {
            ui.notifications.success(`Purchased ${quantity} EP of ${cargo.name} for ${totalCost.toFixed(2)} GC${discountPercent !== 0 ? ` (${discountPercent >= 0 ? '+' : ''}${discountPercent}% adjustment)` : ''}`);
        } else {
            console.log(`✅ Purchase successful: ${quantity} EP of ${cargo.name} for ${totalCost.toFixed(2)} GC`);
        }
        
        // Re-render to update all tabs with the new transaction
        this.app.render(false).then(() => {
            // After successful purchase and re-render, switch to cargo tab to show the purchased item
            setTimeout(() => {
                this._switchToCargoTab();
                console.log('🛒 Automatically switched to cargo tab after purchase');
            }, 100); // Small delay to ensure render is complete
        });
    }

    /**
     * Switch to the History tab
     * @private
     */
    _switchToHistoryTab() {
        console.log('🔄 Attempting to switch to History tab...');
        
        // Wait a small moment for DOM to be ready
        setTimeout(() => {
            const tabs = this.app.element.querySelectorAll('.tab');
            const tabContents = this.app.element.querySelectorAll('.tab-content');
            
            console.log('🔄 Found elements:', {
                tabs: tabs.length,
                tabContents: tabContents.length
            });
            
            // Remove active class from all tabs and content
            tabs.forEach(tab => {
                tab.classList.remove('active');
                console.log('🔄 Removed active from tab:', tab.getAttribute('data-tab'));
            });
            tabContents.forEach(content => {
                content.classList.remove('active');
                console.log('🔄 Removed active from content:', content.id);
            });
            
            // Find and activate the History tab
            const historyTab = this.app.element.querySelector('.tab[data-tab="history"]');
            const historyContent = this.app.element.querySelector('#history-tab');
            
            console.log('🔄 History elements:', {
                historyTab: !!historyTab,
                historyContent: !!historyContent,
                historyTabDataTab: historyTab?.getAttribute('data-tab'),
                historyContentId: historyContent?.id
            });
            
            if (historyTab && historyContent) {
                historyTab.classList.add('active');
                historyContent.classList.add('active');
                console.log('✅ Successfully switched to History tab');
                
                // Scroll to top of history content
                historyContent.scrollTop = 0;
            } else {
                console.warn('⚠️ Could not find History tab elements');
                console.log('Available tabs:', Array.from(tabs).map(t => t.getAttribute('data-tab')));
                console.log('Available tab contents:', Array.from(tabContents).map(t => t.id));
            }
        }, 100);
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

    _switchToCargoTab() {
        console.log('🔄 Switching to cargo tab');
        
        // Remove active class from all tabs and content
        this.app.element.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        this.app.element.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
            content.style.display = 'none';
        });
        
        // Add active class to cargo tab
        const cargoTab = this.app.element.querySelector('.tab[data-tab="cargo"]');
        const cargoContent = this.app.element.querySelector('#cargo-tab');
        
        if (cargoTab && cargoContent) {
            cargoTab.classList.add('active');
            cargoContent.classList.add('active');
            cargoContent.style.display = 'block';
            console.log('🔄 Cargo tab activated successfully');
        } else {
            console.error('🔄 Failed to find cargo tab elements');
        }
    }
}
