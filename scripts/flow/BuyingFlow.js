import { resolveCurrencyContext, enrichPricing } from '../currency-display.js';

console.log('Trading Places | Loading BuyingFlow.js');

export class BuyingFlow {
    constructor(app) {
        this.app = app;
        this.dataManager = app.dataManager;
        this.tradingEngine = app.tradingEngine;
    }

    _getCurrencyContext() {
        return resolveCurrencyContext(this.dataManager);
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

    async onCheckAvailability(event) {
        event.preventDefault();
        
        this._logInfo('Availability Check', 'Check availability button clicked');
        
        try {
            // Validate settlement is selected and valid
            if (!this.app.selectedSettlement) {
                this.app.showValidationError({ 
                    valid: false, 
                    errorType: 'missing_settlement',
                    error: 'No settlement selected'
                }, 'buying');
                return;
            }
            
            // Validate settlement data
            const validation = this.app.validateSettlementWithFeedback(this.app.selectedSettlement, 'buying');
            if (!validation.valid) {
                this._logError('Availability Check', 'Settlement validation failed - aborting availability check', {
                    errors: validation.errors
                });
                return;
            }
            
            // Validate season is set
            if (!this.app.currentSeason) {
                ui.notifications.warn('Please set the current season first');
                return;
            }
            
            this._logInfo('Cargo Availability', 'Starting availability check', {
                settlement: this.app.selectedSettlement.name,
                season: this.app.currentSeason
            });
            
            // Hide any previous error messages
            this.app.clearValidationErrors('buying');
            
            // Show loading state
            const button = event.target;
            const originalText = button.textContent;
            button.textContent = 'Checking...';
            button.disabled = true;
            
            // Perform complete availability check using trading engine
            console.log('=== CARGO AVAILABILITY CHECK ===');
            console.log('Settlement:', this.app.selectedSettlement.name);
            console.log('Season:', this.app.currentSeason);

            // Create a simple roll function that uses Foundry's dice system
            const foundryRollFunction = async ({ description, postToChat = true }) => {
                const roll = new Roll("1d100");
                await roll.evaluate();

                if (postToChat && typeof game !== 'undefined' && game.settings) {
                    const chatVisibility = game.settings.get("trading-places", "chatVisibility");
                    if (chatVisibility !== "disabled") {
                        await roll.toMessage({
                            speaker: ChatMessage.getSpeaker(),
                            flavor: `${description} in ${this.app.selectedSettlement.name}`
                        });
                    }
                }

                console.log(`🎲 ${description}: ${roll.total}`);
                return roll.total;
            };

            let pipelineResult = null;
            if (this.app.cargoAvailabilityPipeline) {
                try {
                    pipelineResult = await this.app.cargoAvailabilityPipeline.run({
                        settlement: this.app.selectedSettlement,
                        season: this.app.currentSeason,
                        rollPercentile: foundryRollFunction
                    });
                    console.log('Orange realism pipeline output:', pipelineResult);
                } catch (pipelineError) {
                    this._logError('Availability Pipeline', 'Pipeline execution failed', { error: pipelineError.message });
                    throw new Error(`Pipeline execution failed: ${pipelineError.message}`);
                }
            } else {
                throw new Error('Cargo availability pipeline is not available');
            }

            // Use pipeline results - pipeline must produce cargo
            let availabilityResult = null;
            let availableCargo = [];
            let successfulCargo = [];

            if (pipelineResult && pipelineResult.slots && pipelineResult.slots.length > 0) {

                const sizeRating = this.dataManager.convertSizeToNumeric(this.app.selectedSettlement.size);
                const wealthRating = this.app.selectedSettlement.wealth;
                const finalChance = Math.min((sizeRating + wealthRating) * 10, 100);

                const slotOutcomes = [];
                const slotDisplayEntries = [];
                const currencyContext = this._getCurrencyContext();

                for (const slot of pipelineResult.slots) {
                    // Use the same roll function as the pipeline for consistency
                    const slotRoll = await foundryRollFunction({ 
                        description: `Cargo slot ${slot.slotNumber} availability check`, 
                        postToChat: true 
                    });
                    const slotSuccessful = slotRoll <= finalChance;
                    slotOutcomes.push({
                        slotNumber: slot.slotNumber,
                        roll: slotRoll,
                        chance: finalChance,
                        success: slotSuccessful
                    });

                    const baseEntry = {
                        slotNumber: slot.slotNumber,
                        potentialCargo: {
                            name: slot.cargo?.name,
                            category: slot.cargo?.category
                        },
                        isSlotAvailable: slotSuccessful,
                        availability: {
                            roll: slotRoll,
                            chance: finalChance,
                            success: slotSuccessful
                        }
                    };

                    if (!slotSuccessful) {
                        slotDisplayEntries.push({
                            ...baseEntry,
                            isSlotAvailable: false,
                            availability: {
                                roll: slotRoll,
                                chance: finalChance,
                                success: false
                            },
                            failure: {
                                roll: slotRoll,
                                target: finalChance,
                                message: `Availability roll ${slotRoll} exceeded the required ${finalChance}.`
                            }
                        });
                        continue;
                    }

                    const cargoType = this.dataManager.getCargoType(slot.cargo.name);
                    let merchant;
                    try {
                        const systemConfig = this.tradingEngine.dataManager.getSystemConfig();
                        console.log('🔍 SYSTEM CONFIG DEBUG:', {
                            hasConfig: !!systemConfig,
                            configKeys: Object.keys(systemConfig),
                            hasSkillDistribution: !!systemConfig?.skillDistribution,
                            hasMerchantPersonalities: !!systemConfig?.merchantPersonalities
                        });

                        // Use the skill calculated by the pipeline instead of generating a new random one
                        const merchantData = slot.merchant;
                        const merchantSkill = merchantData.skill;
                        const merchantName = await this.tradingEngine._generateMerchantName();
                        const skillDescription = this.tradingEngine._getSkillDescription(Math.max(5, Math.min(95, merchantSkill)));

                        merchant = {
                            name: merchantName,
                            skillDescription: `${merchantSkill}`,
                            hagglingSkill: Math.max(5, Math.min(95, merchantSkill)),
                            baseSkill: merchantSkill,
                            calculation: merchantData.calculation
                        };
                    } catch (error) {
                        console.error('❌ MERCHANT GENERATION FAILED:', error);
                        merchant = {
                            name: 'Unknown Merchant',
                            skillDescription: 'Unknown',
                            hagglingSkill: 'N/A',
                            baseSkill: 'N/A'
                        };
                    }

                    const enrichedPricing = enrichPricing(slot.pricing, slot.amount.totalEP, currencyContext);
                    const successfulEntry = {
                        ...baseEntry,
                        name: slot.cargo.name,
                        category: slot.cargo.category,
                        basePrice: enrichedPricing.basePricePerEP,
                        currentPrice: enrichedPricing.finalPricePerEP,
                        quantity: slot.amount.totalEP,
                        totalEP: slot.amount.totalEP,
                        quality: slot.quality.tier,
                        encumbrancePerUnit: cargoType?.encumbrancePerUnit || 1,
                        merchant: merchant,
                        slotInfo: {
                            slotNumber: slot.slotNumber,
                            balance: slot.balance,
                            amount: slot.amount,
                            quality: slot.quality,
                            pricing: enrichedPricing,
                            contraband: slot.contraband,
                            merchant: slot.merchant,
                            desperationUsed: false
                        }
                    };

                    if (typeof enrichedPricing.basePricePerEPCanonical === 'number') {
                        successfulEntry.basePriceCanonical = enrichedPricing.basePricePerEPCanonical;
                    }
                    if (typeof enrichedPricing.finalPricePerEPCanonical === 'number') {
                        successfulEntry.currentPriceCanonical = enrichedPricing.finalPricePerEPCanonical;
                    }
                    if (typeof enrichedPricing.totalValueCanonical === 'number') {
                        successfulEntry.totalValueCanonical = enrichedPricing.totalValueCanonical;
                    }
                    if (enrichedPricing.formattedFinalPricePerEP) {
                        successfulEntry.formattedPricePerEP = enrichedPricing.formattedFinalPricePerEP;
                    }
                    if (enrichedPricing.formattedTotalValue) {
                        successfulEntry.formattedTotalValue = enrichedPricing.formattedTotalValue;
                    }

                    slotDisplayEntries.push(successfulEntry);
                    successfulCargo.push(successfulEntry);
                }

                availabilityResult = {
                    available: successfulCargo.length > 0,
                    isAvailable: successfulCargo.length > 0,
                    availabilityCheck: {
                        chance: finalChance,
                        rolls: slotOutcomes,
                        successfulSlots: successfulCargo.length,
                        attemptedSlots: pipelineResult.slots.length
                    }
                };

                availableCargo = slotDisplayEntries;
            } else {
                throw new Error('Pipeline did not generate any cargo slots');
            }
            
            // Update UI based on result
            if (availabilityResult.available) {
                // SUCCESS: Cargo is available
                console.log('✅ CARGO IS AVAILABLE!');
                console.log('📊 STEP 0: Settlement Information');
                console.log(`  ├─ Settlement: ${this.app.selectedSettlement.name}`);
                console.log(`  ├─ Size Rating: ${this.app.selectedSettlement.size} (numeric: ${this.dataManager.convertSizeToNumeric(this.app.selectedSettlement.size)})`);
                console.log(`  ├─ Wealth Rating: ${this.app.selectedSettlement.wealth}`);
                console.log(`  └─ Produces: [${(this.app.selectedSettlement.flags || this.app.selectedSettlement.source || []).join(', ')}]`);
                
                if (pipelineResult) {
                    console.log('🎯 ORANGE REALISM PIPELINE RESULTS');
                    console.log(`  ├─ Total Slots Evaluated: ${pipelineResult.slotPlan.producerSlots}`);
                    console.log(`  ├─ Successful Slots: ${availabilityResult.availabilityCheck.successfulSlots}`);
                    console.log(`  └─ Successful cargo types: ${successfulCargo.length}`);

                    const slotRollMap = new Map(
                        availabilityResult.availabilityCheck.rolls.map(outcome => [outcome.slotNumber, outcome])
                    );

                    successfulCargo.forEach((cargo) => {
                        const slot = pipelineResult.slots.find(s => s.cargo.name === cargo.name);
                        if (slot) {
                            const rollInfo = slotRollMap.get(slot.slotNumber);
                            console.log(`💰 SLOT ${slot.slotNumber}: ${cargo.name}`);
                            if (rollInfo) {
                                console.log(`  ├─ Availability Roll: ${rollInfo.roll} ≤ ${availabilityResult.availabilityCheck.chance} (success)`);
                            }
                            console.log(`  ├─ Quantity: ${cargo.quantity} units (${cargo.totalEP} EP)`);
                            console.log(`  ├─ Quality: ${cargo.quality}`);
                            console.log(`  ├─ Price: ${cargo.currentPrice} GC per EP`);
                            console.log(`  ├─ Merchant: ${cargo.merchant.name} (${cargo.merchant.skillDescription})`);
                            console.log(`  ├─ Market Balance: ${slot.balance.state} (${slot.balance.supply}/${slot.balance.demand})`);
                            if (cargo.slotInfo?.contraband) {
                                console.log(`  ├─ ⚠️  Contraband cargo`);
                            }
                            console.log(`  └─ ✅ Merchant automatically generated`);
                        }
                    });

                    availabilityResult.availabilityCheck.rolls
                        .filter(outcome => !outcome.success)
                        .forEach(outcome => {
                            console.log(`🚫 SLOT ${outcome.slotNumber}: Availability roll ${outcome.roll} > ${availabilityResult.availabilityCheck.chance} (no cargo generated)`);
                        });
                } else {
                    // Legacy trading engine results
                    console.log('🎯 STEP 1: Availability Check Results');
                    console.log(`  ├─ Base Chance: (${this.dataManager.convertSizeToNumeric(this.app.selectedSettlement.size)} + ${this.app.selectedSettlement.wealth}) × 10 = ${availabilityResult.availabilityCheck?.chance || 'N/A'}%`);
                    const firstSuccess = availabilityResult.availabilityCheck?.rolls?.find?.(outcome => outcome.success);
                    if (firstSuccess) {
                        console.log(`  ├─ Successful Slot Roll: ${firstSuccess.roll}`);
                    }
                    console.log('  └─ Result: Success via pipeline slots');
                    
                    console.log('📦 CARGO TYPES');
                    console.log(`  ├─ Available Types: [${availabilityResult.cargoTypes?.join(', ') || 'N/A'}]`);
                    console.log(`  └─ Count: ${availabilityResult.cargoTypes?.length || 0} type(s)`);
                    
                    availableCargo.forEach(cargo => {
                        console.log(`💰 ${cargo.name}: ${cargo.quantity} units @ ${cargo.currentPrice} GC/10EP (Merchant: ${cargo.merchant.name} - ${cargo.merchant.skillDescription})`);
                    });
                }
                
                console.log('📋 FINAL RESULT: Cargo Available for Purchase');
                
                // Store available cargo
                this.app.availableCargo = availableCargo;
                this.app.successfulCargo = successfulCargo;

                this.app.lastPipelineResult = pipelineResult;
                this.app.lastAvailabilityResult = availabilityResult;
                
                // Save cargo availability data for persistence
                await this.app._saveCargoAvailability(availableCargo, successfulCargo, pipelineResult, availabilityResult);
                
                // Debug: Log what we're storing
                console.log('📦 STORING AVAILABLE CARGO:', availableCargo.map(c => ({
                    name: c.name,
                    isSlotAvailable: c.isSlotAvailable,
                    hasFailure: !!c.failure,
                    failureMessage: c.failure?.message,
                    quantity: c.quantity,
                    currentPrice: c.currentPrice
                })));
                
                // Show detailed success message
                this.app.renderer._showAvailabilityResults({
                    availabilityResult,
                    availableCargo,
                    pipelineResult
                });
                
                // Update cargo display
                this.app.renderer._updateCargoDisplay(availableCargo);
                
                // Update button states
                this.app.renderer._updateTransactionButtons();
                
                // Show success notification
                const cargoSummary = successfulCargo.map(c => `${c.name} (${c.quantity})`).join(', ');
                ui.notifications.info(`Cargo available in ${this.app.selectedSettlement.name}: ${cargoSummary}`);
                
                // Create comprehensive roll summary message
                await this._createRollSummaryMessage(pipelineResult, availabilityResult, successfulCargo);
                
            } else {
                // FAILURE: No cargo available
                console.log('❌ NO CARGO AVAILABLE');
                
                if (pipelineResult) {
                    console.log('📊 PIPELINE RESULTS');
                    console.log(`  ├─ Total Slots Evaluated: ${pipelineResult.slotPlan.producerSlots}`);
                    console.log('  ├─ Availability rolls by slot:');
                    (availabilityResult.availabilityCheck?.rolls || []).forEach(outcome => {
                        console.log(`    • Slot ${outcome.slotNumber}: roll ${outcome.roll} > ${availabilityResult.availabilityCheck?.chance || 'N/A'} → no cargo`);
                    });
                    console.log('  └─ Outcome: No slots passed the availability check.');
                } else {
                    console.log('Availability check details:', availabilityResult.availabilityCheck);
                }
                
                // Store slot outcomes (even though none succeeded) so UI can show failed slots
                this.app.availableCargo = availableCargo;
                this.app.successfulCargo = successfulCargo;
                
                // Show failure message with detailed breakdown
                this.app.renderer._showAvailabilityResults({
                    availabilityResult,
                    availableCargo,
                    pipelineResult
                });
                
                // Show cargo display with failure cards
                this.app.renderer._updateCargoDisplay(availableCargo);
                
                // Update button states
                this.app.renderer._updateTransactionButtons();
                
                // Show info notification
                if (pipelineResult) {
                    ui.notifications.info(`No cargo available in ${this.app.selectedSettlement.name}: all slots failed their availability rolls.`);
                } else {
                    const rollDetails = availabilityResult.availabilityCheck;
                    ui.notifications.info(`No cargo available in ${this.app.selectedSettlement.name} (chance ${rollDetails?.chance || 'N/A'}%)`);
                }
            }

            this.app.lastPipelineResult = pipelineResult;
            this.app.lastAvailabilityResult = availabilityResult;
            
            // Restore button
            button.textContent = originalText;
            button.disabled = false;
            
        } catch (error) {
            this._logError('Availability Check', 'Availability check failed with error', { 
                error: error.message,
                stack: error.stack
            });
            
            ui.notifications.error(`Availability check failed: ${error.message}`);
            
            // Clear cargo on error
            this.app.availableCargo = [];
            this.app.successfulCargo = [];
            this.app.renderer._hideCargoDisplay();
            this.app.renderer._updateTransactionButtons();
            
            // Restore button on error
            const button = event.target;
            button.textContent = 'Check Availability';
            button.disabled = false;
        }
    }

    /**
     * Create a comprehensive roll summary message for the chat
     * @param {Object} pipelineResult - Results from the cargo availability pipeline
     * @param {Object} availabilityResult - Overall availability check results
     * @param {Array} successfulCargo - Array of successfully generated cargo
     * @private
     */
    async _createRollSummaryMessage(pipelineResult, availabilityResult, successfulCargo) {
        try {
            let summaryContent = `
                <div class="trading-roll-summary">
                    <h3>🎲 Cargo Availability Check: ${this.app.selectedSettlement.name}</h3>
                    <div class="summary-section">
                        <h4>Settlement Details</h4>
                        <p><strong>Settlement:</strong> ${this.app.selectedSettlement.name}</p>
                        <p><strong>Size:</strong> ${this.app.selectedSettlement.size} (Rating: ${this.dataManager.convertSizeToNumeric(this.app.selectedSettlement.size)})</p>
                        <p><strong>Wealth:</strong> ${this.app.selectedSettlement.wealth}</p>
                        <p><strong>Season:</strong> ${this.app.currentSeason}</p>
                        <p><strong>Availability Chance:</strong> ${availabilityResult.availabilityCheck.chance}%</p>
                    </div>
                    
                    <div class="summary-section">
                        <h4>Slot Results (${availabilityResult.availabilityCheck.successfulSlots}/${availabilityResult.availabilityCheck.attemptedSlots} successful)</h4>
                        <div class="slot-results">
            `;

            // Add slot-by-slot results
            availabilityResult.availabilityCheck.rolls.forEach(outcome => {
                const slot = pipelineResult.slots.find(s => s.slotNumber === outcome.slotNumber);
                const status = outcome.success ? '✅ Success' : '❌ Failed';
                const cargoInfo = outcome.success && slot ? ` - ${slot.cargo.name}` : '';
                
                summaryContent += `
                    <div class="slot-result ${outcome.success ? 'success' : 'failure'}">
                        <strong>Slot ${outcome.slotNumber}:</strong> ${outcome.roll} ≤ ${outcome.chance} ${status}${cargoInfo}
                    </div>
                `;
            });

            summaryContent += `
                        </div>
                    </div>
            `;

            if (successfulCargo.length > 0) {
                summaryContent += `
                    <div class="summary-section">
                        <h4>Generated Cargo</h4>
                        <div class="cargo-results">
                `;

                successfulCargo.forEach((cargo, index) => {
                    const slot = pipelineResult.slots.find(s => s.cargo.name === cargo.name);
                    if (slot) {
                        summaryContent += `
                            <div class="cargo-result">
                                <h5>${cargo.name} (Slot ${slot.slotNumber})</h5>
                                <p><strong>Quantity:</strong> ${cargo.quantity} EP</p>
                                <p><strong>Quality:</strong> ${cargo.quality}</p>
                                <p><strong>Price:</strong> ${cargo.currentPrice} GC/EP</p>
                                <p><strong>Merchant:</strong> ${cargo.merchant.name} (${cargo.merchant.skillDescription})</p>
                                <p><strong>Market Balance:</strong> ${slot.balance.state} (${slot.balance.supply}/${slot.balance.demand})</p>
                                ${cargo.slotInfo?.contraband?.contraband ? '<p><strong>⚠️ Contraband</strong></p>' : ''}
                                
                                <div class="roll-details">
                                    <small>
                                        <strong>Rolls:</strong><br>
                                        • Amount: ${slot.amount.roll} → ${slot.amount.totalEP} EP<br>
                                        • Quality: ${slot.quality.rollDetails.percentileRoll} (+${slot.quality.rollDetails.percentileModifier}) → ${slot.quality.tier}<br>
                                        • Merchant: ${slot.merchant.calculation.percentileRoll} (+${slot.merchant.calculation.percentileModifier}) → ${slot.merchant.skill}<br>
                                        ${slot.contraband.roll ? `• Contraband: ${slot.contraband.roll} ≤ ${slot.contraband.chance.toFixed(1)}% → ${slot.contraband.contraband ? 'Yes' : 'No'}` : ''}
                                    </small>
                                </div>
                            </div>
                        `;
                    }
                });

                summaryContent += `
                        </div>
                    </div>
                `;
            }

            summaryContent += `
                </div>
            `;

            // Post the summary to chat
            const chatVisibility = game.settings.get("trading-places", "chatVisibility");
            if (chatVisibility !== "disabled") {
                await ChatMessage.create({
                    content: summaryContent,
                    speaker: ChatMessage.getSpeaker(),
                    type: CONST.CHAT_MESSAGE_STYLES.OTHER
                });
            }

        } catch (error) {
            console.error('Failed to create roll summary message:', error);
        }
    }
}

