import {
    resolveCurrencyContext,
    formatDenominationValue,
    formatCanonicalValue,
    enrichPricing,
    augmentTransaction,
    convertDenominationToCanonical,
    getCurrencyLabel
} from '../currency-display.js';

console.log('Trading Places | Loading TradingUIRenderer.js');

const MODULE_ID = "fvtt-trading-places";

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

        // Tooltip management - simple state
        this._currentTooltip = null;
        this._tooltipSystemInitialized = false;
    }

    /**
     * Initialize the unified tooltip system using event delegation
     * This runs once and handles ALL tooltips in the application
     * @private
     */
    _initializeTooltipSystem() {
        // Only initialize once
        if (this._tooltipSystemInitialized) return;
        if (!this.app.element) return; // Element must exist
        
        this._tooltipSystemInitialized = true;
        
        // Use event delegation on the app element to catch all info-indicator clicks
        this.app.element.addEventListener('click', (event) => {
            const indicator = event.target.closest('.info-indicator');
            if (!indicator) return;
            
            event.preventDefault();
            event.stopPropagation();
            
            const tooltip = indicator.dataset.infoTooltip;
            if (!tooltip) return;
            
            // Toggle: if clicking the same indicator, hide tooltip
            if (this._currentTooltip && this._currentTooltip.trigger === indicator) {
                this._hideTooltip();
            } else {
                this._showTooltip(tooltip, indicator);
            }
        });
        
        // Hide tooltip when clicking anywhere else
        document.addEventListener('click', (event) => {
            if (!this._currentTooltip) return;
            
            // Don't hide if clicking the tooltip itself or the trigger
            if (this._currentTooltip.element.contains(event.target)) return;
            if (this._currentTooltip.trigger === event.target || this._currentTooltip.trigger.contains(event.target)) return;
            
            this._hideTooltip();
        }, true);
    }

    _getCurrencyContext() {
        return resolveCurrencyContext(this.dataManager);
    }

    _convertDenominationToCanonical(value) {
        const context = this._getCurrencyContext();
        return convertDenominationToCanonical(value, context);
    }

    _formatCurrencyFromDenomination(value, defaultText = 'N/A') {
        const context = this._getCurrencyContext();
        if (!context) {
            throw new Error('CURRENCY CONTEXT IS NULL in TradingUIRenderer! Cannot format: ' + value);
        }
        return formatDenominationValue(value, context, { defaultText });
    }

    _formatCurrencyFromCanonical(value, defaultText = 'N/A') {
        const context = this._getCurrencyContext();
        return formatCanonicalValue(value, context, { defaultText });
    }

    _ensurePricingCurrency(pricing, quantity) {
        if (!pricing) {
            return null;
        }
        const context = this._getCurrencyContext();
        return enrichPricing(pricing, quantity, context);
    }

    _ensureCargoCurrency(cargo) {
        if (!cargo) {
            return;
        }

        const quantity = cargo.slotInfo?.amount?.totalEP ?? cargo.totalEP ?? cargo.quantity ?? 0;
        if (cargo.slotInfo?.pricing) {
            const enriched = this._ensurePricingCurrency(cargo.slotInfo.pricing, quantity);
            if (enriched) {
                cargo.slotInfo.pricing = enriched;
                if (enriched.formattedFinalPricePerEP) {
                    cargo.formattedPricePerEP = enriched.formattedFinalPricePerEP;
                }
                if (enriched.formattedTotalValue) {
                    cargo.formattedTotalValue = enriched.formattedTotalValue;
                }
                if (typeof enriched.finalPricePerEPCanonical === 'number') {
                    cargo.currentPriceCanonical = enriched.finalPricePerEPCanonical;
                }
                if (typeof enriched.totalValueCanonical === 'number') {
                    cargo.totalValueCanonical = enriched.totalValueCanonical;
                }
            }
        }
    }

    _augmentTransaction(transaction) {
        if (!transaction) {
            return transaction;
        }

        augmentTransaction(transaction, this._getCurrencyContext());
        return transaction;
    }

    _getCurrencyLabel() {
        return getCurrencyLabel(this._getCurrencyContext());
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
        // Tooltips handled by unified system in constructor
    }

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

        const statusEmoji = this.ICONS.cargo;

        const availabilityCheck = completeResult.availabilityCheck || {};
        const slotOutcomes = Array.isArray(availabilityCheck.rolls) ? availabilityCheck.rolls : [];
        const successfulSlots = slotOutcomes.filter(outcome => outcome.success).length;
        const totalSlots = slotOutcomes.length;

        let slotExplanation = '';
        if (pipelineResult && Array.isArray(pipelineResult.slots) && pipelineResult.slots.length > 0) {
            const successfulSlotsData = pipelineResult.slots.filter(slot => slot.merchant?.available !== false);
            const slotDetails = successfulSlotsData.map((slot, index) => {
                const slotNum = slot.slotNumber ?? index + 1;
                let details = `Slot ${slotNum}: ${slot.cargo?.name || 'Unknown'} (${slot.cargo?.category || 'Unknown'})`;

                if (slot.merchant?.roll !== undefined && slot.merchant?.target !== undefined) {
                    details += `\n• Merchant Roll: ${slot.merchant.roll} ≤ ${slot.merchant.target} (${slot.merchant.roll <= slot.merchant.target ? 'SUCCESS' : 'FAILED'})`;
                }

                if (slot.cargo?.roll !== undefined && slot.cargo?.target !== undefined) {
                    details += `\n• Cargo Selection: ${slot.cargo.roll} ≤ ${slot.cargo.target} (${slot.cargo.name})`;
                }

                if (slot.amount) {
                    const amount = slot.amount;
                    details += `\n• Amount: ${amount.roll || 'N/A'} (base) × ${amount.sizeModifier?.toFixed(2) || 'N/A'} (size) × ${amount.wealthModifier?.toFixed(2) || 'N/A'} (wealth) × ${amount.supplyModifier?.toFixed(2) || 'N/A'} (supply) = ${amount.totalEP || 0} EP`;
                }

                if (slot.quality) {
                    const quality = slot.quality;
                    details += `\n• Quality: ${quality.tier || 'Unknown'} (score: ${quality.score?.toFixed(2) || 'N/A'})`;
                }

                if (slot.contraband) {
                    const contraband = slot.contraband;
                    details += `\n• Contraband: ${contraband.roll || 'N/A'} ≤ ${contraband.chance?.toFixed(1) || 'N/A'}% (${contraband.contraband ? 'YES' : 'NO'})`;
                }

                if (slot.pricing) {
                    const quantityForPricing = slot.amount?.totalEP ?? slot.pricing?.quantity;
                    const resolvedPricing = this._ensurePricingCurrency(slot.pricing, quantityForPricing) || slot.pricing;
                    const baseFormatted = resolvedPricing?.formattedBasePricePerEP
                        || (typeof resolvedPricing?.basePricePerEP === 'number'
                            ? this._formatCurrencyFromDenomination(resolvedPricing.basePricePerEP)
                            : null);
                    const finalFormatted = resolvedPricing?.formattedFinalPricePerEP
                        || (typeof resolvedPricing?.finalPricePerEP === 'number'
                            ? this._formatCurrencyFromDenomination(resolvedPricing.finalPricePerEP)
                            : null);
                    const totalFormatted = resolvedPricing?.formattedTotalValue
                        || (typeof resolvedPricing?.totalValue === 'number'
                            ? this._formatCurrencyFromDenomination(resolvedPricing.totalValue)
                            : null);

                    const baseText = baseFormatted && baseFormatted !== 'N/A'
                        ? `${baseFormatted} per EP`
                        : 'N/A';
                    const finalText = finalFormatted && finalFormatted !== 'N/A'
                        ? `${finalFormatted} per EP`
                        : 'N/A';
                    const totalText = totalFormatted && totalFormatted !== 'N/A'
                        ? totalFormatted
                        : 'N/A';

                    details += `\n• Pricing: base ${baseText} → final ${finalText} (total ${totalText})`;
                }

                return details;
            }).join('\n\n');

            const tooltipContent = `Availability Check: ${totalSlots} slots rolled, ${successfulSlots} successful\n\nDetailed Slot Results:\n${slotDetails}`.trim();
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

        resultsContainer.innerHTML = `
            ${marketCheckHtml}
        `;

        resultsContainer.style.display = 'block';
        // Tooltips handled by unified system in constructor
    }

    _createInfoIndicator(tooltip, classes = 'info-indicator') {
        if (!tooltip) {
            return '';
        }

        const safeTooltip = tooltip.replace(/"/g, '&quot;');
        return `<span class="${classes}" data-info-tooltip="${safeTooltip}">?</span>`;
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
        const resolvedPricing = this._ensurePricingCurrency(pricing, slot.amount?.totalEP ?? pricing.quantity) || pricing;
        const baseFormatted = resolvedPricing?.formattedBasePricePerEP
            || (typeof resolvedPricing?.basePricePerEP === 'number'
                ? this._formatCurrencyFromDenomination(resolvedPricing.basePricePerEP)
                : 'N/A');
        const finalFormatted = resolvedPricing?.formattedFinalPricePerEP
            || (typeof resolvedPricing?.finalPricePerEP === 'number'
                ? this._formatCurrencyFromDenomination(resolvedPricing.finalPricePerEP)
                : 'N/A');
        const totalFormatted = resolvedPricing?.formattedTotalValue
            || (typeof resolvedPricing?.totalValue === 'number'
                ? this._formatCurrencyFromDenomination(resolvedPricing.totalValue)
                : 'N/A');

        return `
            <div class="pipeline-detail">
                <p><strong>Base Price per EP:</strong> ${baseFormatted !== 'N/A' ? `${baseFormatted} per EP` : 'N/A'}</p>
                <p><strong>Final Price per EP:</strong> ${finalFormatted !== 'N/A' ? `${finalFormatted} per EP` : 'N/A'}</p>
                <p><strong>Available Quantity:</strong> ${resolvedPricing.quantity ?? pricing.quantity ?? 0} EP</p>
                <p><strong>Total Value:</strong> ${totalFormatted}</p>
                ${resolvedPricing.steps && resolvedPricing.steps.length > 0 ? `
                    <p><strong>Price Adjustments:</strong></p>
                    <ul>
                        ${resolvedPricing.steps.map(step => `<li>${step.label}</li>`).join('')}
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

        const pricePerTenEp = cargo.currentPrice ?? cargo.basePrice;
        const formattedPerTenEp = typeof pricePerTenEp === 'number'
            ? this._formatCurrencyFromDenomination(pricePerTenEp)
            : null;
        const priceDescriptor = formattedPerTenEp && formattedPerTenEp !== 'N/A'
            ? ` @ ${formattedPerTenEp} / 10 EP`
            : '';

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
                                <span class="result-value">${cargo.name} (${cargo.category}) - ${totalEp} EP${priceDescriptor}</span>
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
    this._ensureCargoCurrency(cargo);
    const card = document.createElement('div');

    const availableEp = Math.max(0, cargo.totalEP ?? cargo.quantity ?? 0);
    const isSoldOut = availableEp <= 0;
    const defaultTotalPriceDisplay = this._formatCurrencyFromDenomination(0, '0');

    // Check if cargo is contraband
    const isContraband = cargo.slotInfo?.contraband?.contraband === true;
    const contrabandClass = isContraband ? 'contraband' : '';

    const statusClass = isSoldOut ? 'slot-failure sold-out' : 'slot-success';
    card.className = `cargo-card ${statusClass} ${contrabandClass}`.trim();

        // Basic info (always visible) - matches original layout
        let basicInfo = `
            <div class="cargo-header">
                <div class="trading-places-cargo-name">${cargo.name}</div>
                <div class="cargo-category">${cargo.category || 'Goods'}</div>
            </div>
            <div class="trading-places-cargo-details">`;

        basicInfo += `
                <div class="price-info">
                    <span class="price-label">Available:</span>
                    <span class="price-value">${availableEp} EP</span>
                </div>
                <div class="price-info">
                    <span class="price-label">Price per EP:</span>
                    <span class="price-value">${this._formatPricePerEP(cargo)}</span>
                </div>
                <div class="price-info">
                    <span class="price-label">Total Price:</span>
                    <span class="price-value">${this._formatTotalPrice(cargo)}</span>
                </div>
                <div class="price-info">
                    <span class="price-label">Quality:</span>
                    <span class="price-value">${this._formatQualityDisplay(cargo)}</span>
                </div>`;

        if (isContraband) {
            basicInfo += `
                <div class="contraband-warning">
                    <span class="contraband-icon">🏴‍☠️</span>
                    <span class="contraband-text">Contraband - Illegal to transport</span>
                </div>`;
        }

        if (isSoldOut) {
            const soldOutMessage = cargo.soldOutMessage || 'Merchant sold out';
            basicInfo += `
                <div class="sold-out-message">
                    <span class="sold-out-icon">${this.ICONS.failure}</span>
                    <span class="sold-out-text">${soldOutMessage}</span>
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
                    max="${availableEp}" 
                                   value="0" 
                                   step="1"
                                   data-cargo-id="${cargo.id || cargo.name}">
                            <input type="range" 
                                   class="quantity-slider" 
                                   min="0" 
                    max="${availableEp}" 
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
                            <span class="total-price-value">${defaultTotalPriceDisplay}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;

        card.innerHTML = basicInfo;

        // Add event listeners for the buying interface
        this._attachBuyingInterfaceListeners(card, cargo);
        // Tooltips handled by unified system in constructor

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
            const formattedTotal = this._formatCurrencyFromDenomination(totalPrice, this._formatCurrencyFromDenomination(0, '0'));
            totalPriceValue.textContent = formattedTotal;
            const canonicalTotal = this._convertDenominationToCanonical(totalPrice);
            if (canonicalTotal !== null && totalPriceValue.dataset) {
                totalPriceValue.dataset.canonicalValue = String(canonicalTotal);
            } else if (totalPriceValue.dataset && totalPriceValue.dataset.canonicalValue) {
                delete totalPriceValue.dataset.canonicalValue;
            }
            
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

        if (maxQuantity <= 0) {
            updateTotalPrice(0, 0);
            quantityInput.value = 0;
            quantityInput.disabled = true;
            quantitySlider.value = 0;
            quantitySlider.disabled = true;
            discountSlider.value = 0;
            discountSlider.disabled = true;
            updateDiscountDisplay(0);
            purchaseBtn.disabled = true;
            purchaseBtn.innerHTML = '<i class="fas fa-times"></i> Sold Out';
            purchaseBtn.classList.remove('btn-success');
            purchaseBtn.classList.add('btn-secondary');
            totalPriceValue.textContent = this._formatCurrencyFromDenomination(0, '0');
            return;
        }

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
        purchaseBtn.addEventListener('click', async (e) => {
            const quantity = parseInt(quantityInput.value) || 0;
            const discountPercent = parseFloat(discountSlider.value) || 0;
            if (quantity > 0) {
                try {
                    await this._handlePurchase(cargo, quantity, discountPercent);
                } catch (error) {
                    console.error('Failed to complete purchase:', error);
                    if (ui?.notifications) {
                        ui.notifications.error(`Purchase failed: ${error.message}`);
                    }
                }
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
    async _handlePurchase(cargo, quantity, discountPercent = 0) {
        const availableEp = Math.max(0, cargo.totalEP ?? cargo.quantity ?? 0);
        const purchaseQuantity = Math.min(quantity, availableEp);

        if (purchaseQuantity <= 0) {
            console.warn('Attempted to purchase zero or negative quantity; ignoring.');
            return;
        }

        console.log(`🛒 PURCHASING: ${purchaseQuantity} EP of ${cargo.name} with ${discountPercent >= 0 ? '+' : ''}${discountPercent}% adjustment`);

        const pricePerEP = this._getPricePerEP(cargo);
        const discountMultiplier = 1 + (discountPercent / 100);
        const adjustedPricePerEP = pricePerEP * discountMultiplier;
        const totalCost = purchaseQuantity * adjustedPricePerEP;
        const roundedPricePerEP = parseFloat(adjustedPricePerEP.toFixed(2));
        const roundedTotalCost = parseFloat(totalCost.toFixed(2));
        
        // Add transaction to history
        const transaction = this._augmentTransaction({
            cargo: cargo.name,
            category: cargo.category || 'Goods',
            quantity: purchaseQuantity,
            pricePerEP: roundedPricePerEP,
            totalCost: roundedTotalCost,
            settlement: this.app.selectedSettlement?.name || 'Unknown',
            season: this.app.currentSeason || 'Unknown',
            date: new Date().toISOString(),
            discountPercent: discountPercent,
            isSale: false,
            contraband: cargo.slotInfo?.contraband?.contraband || false,
            merchant: cargo.merchant?.name || cargo.merchant || 'Unknown Merchant',
            isManualEntry: false
        });
        
        // Add to transaction history
        if (!this.app.transactionHistory) {
            this.app.transactionHistory = [];
        }
        this.app.transactionHistory.unshift(transaction); // Add to beginning for newest first
        
        // Update cargo inventory - call the event handler method
        if (this.app.eventHandlers && this.app.eventHandlers._addCargoToInventory) {
            try {
                await this.app.eventHandlers._addCargoToInventory(transaction);
            } catch (error) {
                console.error('Failed to update cargo inventory:', error);
            }
        }
        
        console.log('💰 Transaction created:', transaction);
        console.log('💰 Transaction history now has:', this.app.transactionHistory.length, 'items');
        console.log('💰 First transaction:', this.app.transactionHistory[0]);
        
        // Save transaction history to Foundry settings for persistence
        try {
            const datasetId = this.app.dataManager?.activeDatasetName || 'default';
            const allTransactionData = await game.settings.get(MODULE_ID, "transactionHistory") || {};
            allTransactionData[datasetId] = this.app.transactionHistory;
            await game.settings.set(MODULE_ID, "transactionHistory", allTransactionData);
            console.log('💰 Transaction history saved successfully');
        } catch (error) {
            console.error('💰 Failed to save transaction history:', error);
        }
        
        // Show success notification
        const formattedTotalCost = transaction.formattedTotalCost || `${roundedTotalCost.toFixed(2)} ${this._getCurrencyLabel()}`;
        if (ui && ui.notifications) {
            ui.notifications.success(`Purchased ${purchaseQuantity} EP of ${cargo.name} for ${formattedTotalCost}${discountPercent !== 0 ? ` (${discountPercent >= 0 ? '+' : ''}${discountPercent}% adjustment)` : ''}`);
        } else {
            console.log(`✅ Purchase successful: ${purchaseQuantity} EP of ${cargo.name} for ${formattedTotalCost}`);
        }
        
        this._applyPurchaseToAvailability(cargo, purchaseQuantity, pricePerEP);

        const availableList = Array.isArray(this.app.availableCargo) ? this.app.availableCargo : [];
        this._updateCargoDisplay(availableList);
        this._updateTransactionButtons();

        if (typeof this.app._saveCargoAvailability === 'function') {
            try {
                await this.app._saveCargoAvailability(
                    availableList,
                    Array.isArray(this.app.successfulCargo) ? this.app.successfulCargo : [],
                    this.app.lastPipelineResult || null,
                    this.app.lastAvailabilityResult || null
                );
            } catch (error) {
                console.error('Failed to persist cargo availability after purchase:', error);
            }
        }

        if (this.app.lastAvailabilityResult) {
            const remainingSuccessful = Array.isArray(this.app.successfulCargo) ? this.app.successfulCargo.length : 0;
            const availabilityCheck = this.app.lastAvailabilityResult.availabilityCheck || {};
            availabilityCheck.successfulSlots = remainingSuccessful;
            this.app.lastAvailabilityResult.availabilityCheck = availabilityCheck;
            const hasCargo = remainingSuccessful > 0;
            this.app.lastAvailabilityResult.available = hasCargo;
            this.app.lastAvailabilityResult.isAvailable = hasCargo;
        }

        // Re-render to update all tabs with the new transaction
        this.app.render(false).then(() => {
            setTimeout(() => {
                this._switchToCargoTab();
                console.log('🛒 Automatically switched to cargo tab after purchase');
            }, 100);
        });
    }

    _applyPurchaseToAvailability(cargo, purchaseQuantity, pricePerEP) {
        const currentEp = Math.max(0, cargo.totalEP ?? cargo.quantity ?? 0);
        const remainingEp = Math.max(0, currentEp - purchaseQuantity);

        const updateEntry = (entry) => {
            if (!entry) {
                return;
            }

            entry.totalEP = remainingEp;
            entry.quantity = remainingEp;

            const slotInfo = entry.slotInfo || {};
            if (slotInfo.amount) {
                slotInfo.amount.totalEP = remainingEp;
                slotInfo.amount.remainingEP = remainingEp;
            }
            if (slotInfo.pricing) {
                slotInfo.pricing.quantity = remainingEp;
                slotInfo.pricing.totalValue = parseFloat((remainingEp * pricePerEP).toFixed(2));
            }

            entry.totalValue = parseFloat((remainingEp * pricePerEP).toFixed(2));

            entry.isSoldOut = remainingEp <= 0;
            if (entry.isSoldOut) {
                entry.soldOutMessage = entry.soldOutMessage || 'Merchant sold out';
            }

            this._ensureCargoCurrency(entry);
        };

        const slotNumber = cargo.slotInfo?.slotNumber ?? cargo.slotNumber ?? null;
        const matchEntry = (entry) => {
            if (!entry) return false;
            if (entry === cargo) return true;
            if (entry.slotInfo?.slotNumber && slotNumber) {
                return entry.slotInfo.slotNumber === slotNumber;
            }
            if (slotNumber === null) {
                return entry.name === cargo.name;
            }
            return false;
        };

        const lists = [this.app.availableCargo, this.app.successfulCargo];
        lists.forEach(list => {
            if (!Array.isArray(list)) {
                return;
            }
            list.forEach(entry => {
                if (matchEntry(entry)) {
                    updateEntry(entry);
                }
            });
        });

        if (Array.isArray(this.app.successfulCargo)) {
            this.app.successfulCargo = this.app.successfulCargo.filter(entry => (entry.totalEP ?? entry.quantity ?? 0) > 0);
        }

        if (this.app.lastPipelineResult?.slots && slotNumber !== null) {
            const pipelineSlot = this.app.lastPipelineResult.slots.find(slot => slot.slotNumber === slotNumber);
            if (pipelineSlot) {
                if (pipelineSlot.amount) {
                    pipelineSlot.amount.totalEP = remainingEp;
                    pipelineSlot.amount.remainingEP = remainingEp;
                }
                if (pipelineSlot.pricing) {
                    pipelineSlot.pricing.quantity = remainingEp;
                    pipelineSlot.pricing.totalValue = parseFloat((remainingEp * pricePerEP).toFixed(2));
                    pipelineSlot.pricing = this._ensurePricingCurrency(pipelineSlot.pricing, remainingEp) || pipelineSlot.pricing;
                }
                pipelineSlot.merchant = pipelineSlot.merchant || {};
                pipelineSlot.merchant.available = remainingEp > 0;
            }
        }

        cargo.totalEP = remainingEp;
        cargo.quantity = remainingEp;
        if (cargo.slotInfo?.amount) {
            cargo.slotInfo.amount.totalEP = remainingEp;
            cargo.slotInfo.amount.remainingEP = remainingEp;
        }
        if (cargo.slotInfo?.pricing) {
            cargo.slotInfo.pricing.quantity = remainingEp;
            cargo.slotInfo.pricing.totalValue = parseFloat((remainingEp * pricePerEP).toFixed(2));
        }
        cargo.isSoldOut = remainingEp <= 0;
        if (cargo.isSoldOut) {
            cargo.soldOutMessage = cargo.soldOutMessage || 'Merchant sold out';
        }
        cargo.totalValue = parseFloat((remainingEp * pricePerEP).toFixed(2));

        this._ensureCargoCurrency(cargo);
    }

    /**
     * Switch to the History tab
     * @private
     */
    _switchToHistoryTab() {
        console.log('🔄 Attempting to switch to History tab...');
        
        // Wait a small moment for DOM to be ready
        setTimeout(() => {
            const tabs = this.app.element.querySelectorAll('.trading-places-tab');
            const tabContents = this.app.element.querySelectorAll('.trading-places-tab-content');
            
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
            const historyTab = this.app.element.querySelector('.trading-places-tab[data-tab="history"]');
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
        if (!cargo) {
            return 'N/A';
        }

        this._ensureCargoCurrency(cargo);

        if (typeof cargo.formattedPricePerEP === 'string') {
            return cargo.formattedPricePerEP;
        }

        const pricing = cargo.slotInfo?.pricing;
        if (pricing?.formattedFinalPricePerEP) {
            return pricing.formattedFinalPricePerEP;
        }

        if (typeof cargo.currentPriceCanonical === 'number') {
            return this._formatCurrencyFromCanonical(cargo.currentPriceCanonical);
        }

        if (pricing && typeof pricing.finalPricePerEPCanonical === 'number') {
            return this._formatCurrencyFromCanonical(pricing.finalPricePerEPCanonical);
        }

        const price = pricing?.finalPricePerEP ?? cargo.currentPrice ?? cargo.basePrice;
        if (typeof price === 'number') {
            return this._formatCurrencyFromDenomination(price);
        }

        return 'N/A';
    }

    _formatTotalPrice(cargo) {
        if (!cargo) {
            return 'N/A';
        }

        this._ensureCargoCurrency(cargo);

        if (typeof cargo.formattedTotalValue === 'string') {
            return cargo.formattedTotalValue;
        }

        const pricing = cargo.slotInfo?.pricing;
        if (pricing?.formattedTotalValue) {
            return pricing.formattedTotalValue;
        }

        if (typeof cargo.totalValueCanonical === 'number') {
            return this._formatCurrencyFromCanonical(cargo.totalValueCanonical);
        }

        if (pricing && typeof pricing.totalValueCanonical === 'number') {
            return this._formatCurrencyFromCanonical(pricing.totalValueCanonical);
        }

        const totalValue = pricing?.totalValue ?? cargo.totalValue;
        if (typeof totalValue === 'number') {
            return this._formatCurrencyFromDenomination(totalValue);
        }

        const pricePerEp = pricing?.finalPricePerEP ?? cargo.currentPrice ?? cargo.basePrice;
        const availableEp = cargo.totalEP ?? cargo.quantity ?? pricing?.quantity ?? cargo.slotInfo?.amount?.totalEP;
        if (typeof pricePerEp === 'number' && typeof availableEp === 'number') {
            return this._formatCurrencyFromDenomination(pricePerEp * availableEp);
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
    /**
     * Show a tooltip near the trigger element
     * @param {string} content - Tooltip content
     * @param {HTMLElement} triggerElement - Element that triggered the tooltip
     * @private
     */
    _showTooltip(content, triggerElement) {
        this._hideTooltip();

        const tooltip = document.createElement('div');
        tooltip.className = 'info-tooltip';
        tooltip.innerHTML = `<p>${content.replace(/\n/g, '<br>')}</p>`;

        const rect = triggerElement.getBoundingClientRect();
        const appRect = this.app.element.getBoundingClientRect();

        let left = rect.left - appRect.left;
        let top = rect.bottom - appRect.top + 5;

        if (left + 300 > appRect.width) {
            left = appRect.width - 300 - 5;
        }
        if (top + 200 > appRect.height) {
            top = rect.top - appRect.top - 200 - 5;
        }

        left = Math.max(5, Math.min(left, appRect.width - 300 - 5));
        top = Math.max(5, top);

        tooltip.style.cssText = `left: ${left}px; top: ${top}px; position: absolute; z-index: 10000;`;
        this.app.element.appendChild(tooltip);
        requestAnimationFrame(() => tooltip.classList.add('show'));

        this._currentTooltip = { element: tooltip, trigger: triggerElement };
    }

    /**
     * Hide the current tooltip
     * @private
     */
    _hideTooltip() {
        if (!this._currentTooltip) return;
        
        const tooltip = this._currentTooltip.element;
        tooltip.classList.remove('show');
        setTimeout(() => {
            if (tooltip && tooltip.parentNode) {
                tooltip.parentNode.removeChild(tooltip);
            }
        }, 200);
        
        this._currentTooltip = null;
    }

    /**
     * Update selling tab state
     * @private
     */
    _updateSellingTab() {
        this._logDebug('UI State', 'Updating selling tab');

        const sellingTab = this.app.element.querySelector('#selling-tab');
        if (!sellingTab) return;

        // Show/hide empty state based on settlement selection
        const emptyState = sellingTab.querySelector('#selling-empty-state');
        const resourceSelection = sellingTab.querySelector('.resource-selection');

        if (this.app.selectedSettlement) {
            // Settlement selected - show resource selection
            if (emptyState) emptyState.style.display = 'none';
            if (resourceSelection) {
                resourceSelection.style.display = 'block';
                this._populateSellingResources();
            }
        } else {
            // No settlement selected - show empty state
            if (emptyState) emptyState.style.display = 'block';
            if (resourceSelection) resourceSelection.style.display = 'none';
        }
    }

    _switchToCargoTab() {
        console.log('🔄 Switching to cargo tab');
        this.setActiveTab('cargo');
    }

    /**
     * Update current cargo display in selling tab
     * @private
     */

    /**
     * Refresh cargo tab display
     * @private
     */
    getActiveTabName() {
        const activeTab = this.app.element?.querySelector('.trading-places-tab.active');
        return activeTab?.dataset.tab || null;
    }

    setActiveTab(tabName) {
        if (!tabName || !this.app.element) {
            return;
        }

        const tabs = this.app.element.querySelectorAll('.trading-places-tab');
        const tabContents = this.app.element.querySelectorAll('.trading-places-tab-content');

        tabs.forEach(tab => tab.classList.remove('active'));
        tabContents.forEach(content => {
            content.classList.remove('active');
            content.style.display = 'none';
        });

        const targetTab = this.app.element.querySelector(`.trading-places-tab[data-tab="${tabName}"]`);
        const targetContent = this.app.element.querySelector(`#${tabName}-tab`);

        if (targetTab && targetContent) {
            targetTab.classList.add('active');
            targetContent.classList.add('active');
            targetContent.style.display = 'block';
        }
    }

    /**
     * Formats quality display with dishonesty indication and tooltip
     */
    _formatQualityDisplay(cargo) {
        const quality = cargo.quality || 'Average';
        const actualQuality = cargo.actualTier || cargo.actualQuality;
        const isDishonest = cargo.dishonest || false;
        const system = cargo.system || 'standard';
        
        let displayText = quality;
        let tooltipContent = '';
        
        // Show actual quality in parentheses if merchant is dishonest
        if (isDishonest && actualQuality && actualQuality !== quality) {
            displayText = `<span class="quality-dishonest">${quality} (${actualQuality})</span>`;
        } else {
            displayText = `<span class="quality-honest">${displayText}</span>`;
        }
        
        // Generate tooltip content based on system type
        if (system === 'wine_brandy') {
            tooltipContent = 'Wine/Brandy Quality: 1=Swill (0.5GC), 2-3=Passable (1GC), 4-5=Average (1.5GC), 6-7=Good (3GC), 8-9=Excellent (6GC), 10+=Top Shelf (12GC)';
        } else {
            tooltipContent = 'Quality Tiers: Poor < Common < Average < High < Exceptional';
        }
        
        // Add evaluate instructions if merchant is dishonest
        if (isDishonest) {
            if (system === 'wine_brandy') {
                tooltipContent += '. GM: Ask players to make Evaluate Test (Challenging +0, or Average +20 if Consume Alcohol ≥50) to detect true quality.';
            } else {
                tooltipContent += '. GM: Ask players to make Evaluate Test (Challenging +0) to detect merchant dishonesty.';
            }
        }
        
        // Use existing tooltip system
        return `${displayText} <span class="info-indicator" data-info-tooltip="${tooltipContent}">?</span>`;
    }
}
