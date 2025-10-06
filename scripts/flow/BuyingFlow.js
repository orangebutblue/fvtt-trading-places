console.log('Trading Places | Loading BuyingFlow.js');

export class BuyingFlow {
    constructor(app) {
        this.app = app;
        this.dataManager = app.dataManager;
        this.tradingEngine = app.tradingEngine;
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
            
            const rollPercentile = async ({ flavor, logPrefix, postToChat = true }) => {
                const roll = new Roll("1d100");
                await roll.evaluate();

                const chatVisibility = game.settings.get("trading-places", "chatVisibility");
                if (postToChat && chatVisibility !== "disabled") {
                    await roll.toMessage({
                        speaker: ChatMessage.getSpeaker(),
                        flavor: flavor || `Cargo availability roll in ${this.app.selectedSettlement.name}`
                    });
                }

                console.log(`${logPrefix || '🎲 Roll'} ${roll.total}`);
                return roll.total;
            };

            const rollSlotAvailability = async (slotNumber) => {
                return rollPercentile({
                    flavor: `Cargo slot ${slotNumber} availability check in ${this.app.selectedSettlement.name}`,
                    logPrefix: `🎲 Slot ${slotNumber} availability roll:`,
                    postToChat: true
                });
            };

            const merchantRollFunction = async () => {
                return rollPercentile({
                    flavor: `Merchant generation roll (${this.app.selectedSettlement.name})`,
                    logPrefix: '🎲 Merchant generation roll:',
                    postToChat: false
                });
            };

            let pipelineResult = null;
            if (this.app.cargoAvailabilityPipeline) {
                try {
                    pipelineResult = await this.app.cargoAvailabilityPipeline.run({
                        settlement: this.app.selectedSettlement,
                        season: this.app.currentSeason
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

                for (const slot of pipelineResult.slots) {
                    const slotRoll = await rollSlotAvailability(slot.slotNumber);
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
                        console.log(`❌ Slot ${slot.slotNumber} failed availability (${slotRoll} > ${finalChance}). Displaying as unavailable.`);
                        slotDisplayEntries.push({
                            slotNumber: slot.slotNumber,
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

                        merchant = await this.tradingEngine.generateRandomMerchant(this.app.selectedSettlement, merchantRollFunction);
                        console.log('🔍 MERCHANT OBJECT DEBUG:', {
                            name: merchant.name,
                            skillDescription: merchant.skillDescription,
                            hagglingSkill: merchant.hagglingSkill,
                            baseSkill: merchant.baseSkill,
                            allKeys: Object.keys(merchant)
                        });
                    } catch (error) {
                        console.error('❌ MERCHANT GENERATION FAILED:', error);
                        merchant = {
                            name: 'Unknown Merchant',
                            skillDescription: 'Unknown',
                            hagglingSkill: 'N/A',
                            baseSkill: 'N/A'
                        };
                    }

                    const successfulEntry = {
                        ...baseEntry,
                        name: slot.cargo.name,
                        category: slot.cargo.category,
                        basePrice: slot.pricing.basePricePerEP,
                        currentPrice: slot.pricing.finalPricePerEP,
                        quantity: slot.pricing.quantity,
                        totalEP: slot.amount.totalEP,
                        quality: slot.quality.tier,
                        encumbrancePerUnit: cargoType?.encumbrancePerUnit || 1,
                        merchant: merchant,
                        slotInfo: {
                            slotNumber: slot.slotNumber,
                            balance: slot.balance,
                            amount: slot.amount,
                            quality: slot.quality,
                            pricing: slot.pricing,
                            contraband: slot.contraband?.contraband,
                            merchant: slot.merchant,
                            desperationUsed: false
                        }
                    };

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
                
                // Debug: Log what we're storing
                console.log('📦 STORING AVAILABLE CARGO:', availableCargo.map(c => ({
                    name: c.name,
                    merchant: {
                        name: c.merchant?.name,
                        hagglingSkill: c.merchant?.hagglingSkill,
                        baseSkill: c.merchant?.baseSkill
                    }
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
}
