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
            
            // Use FoundryVTT dice roller instead of fallback
            const rollFunction = async () => {
                const roll = new Roll("1d100");
                await roll.evaluate();
                
                // Show dice roll in chat if enabled
                const chatVisibility = game.settings.get("trading-places", "chatVisibility");
                if (chatVisibility !== "disabled") {
                    await roll.toMessage({
                        speaker: ChatMessage.getSpeaker(),
                        flavor: `Cargo Availability Check in ${this.app.selectedSettlement.name}`
                    });
                }
                
                console.log(`🎲 Rolled 1d100: ${roll.total}`);
                return roll.total;
            };
            
            let pipelineResult = null;
            let marketRoll = null;
            if (this.app.cargoAvailabilityPipeline) {
                try {
                    // Perform the market availability roll first
                    const roll = new Roll("1d100");
                    await roll.evaluate();
                    marketRoll = roll.total;
                    
                    // Show dice roll in chat if enabled
                    const chatVisibility = game.settings.get("trading-places", "chatVisibility");
                    if (chatVisibility !== "disabled") {
                        await roll.toMessage({
                            speaker: ChatMessage.getSpeaker(),
                            flavor: `Cargo Availability Check in ${this.app.selectedSettlement.name}`
                        });
                    }
                    
                    console.log(`🎲 Market availability roll: ${marketRoll}`);
                    
                    pipelineResult = await this.app.cargoAvailabilityPipeline.run({
                        settlement: this.app.selectedSettlement,
                        season: this.app.currentSeason
                    });
                    console.log('Orange realism pipeline output:', pipelineResult);
                } catch (pipelineError) {
                    this._logError('Availability Pipeline', 'Pipeline execution failed', { error: pipelineError.message });
                }
            }

            // Use pipeline results if available, otherwise fall back to trading engine
            let availabilityResult = null;
            let availableCargo = [];

            if (pipelineResult && pipelineResult.slots && pipelineResult.slots.length > 0) {
                // Use orange-realism pipeline results - all slots produce cargo with merchants
                const sizeRating = this.dataManager.convertSizeToNumeric(this.app.selectedSettlement.size);
                const wealthRating = this.app.selectedSettlement.wealth;
                const finalChance = Math.min((sizeRating + wealthRating) * 10, 100);
                
                availabilityResult = { 
                    available: true,
                    availabilityCheck: {
                        roll: marketRoll,
                        chance: finalChance
                    }
                };
                
                // Convert all pipeline slots to cargo objects for display
                availableCargo = await Promise.all(pipelineResult.slots.map(async (slot) => {
                    const cargoType = this.dataManager.getCargoType(slot.cargo.name);
                    let merchant;
                    try {
                        // Debug: Check if config is loaded
                        const systemConfig = this.tradingEngine.dataManager.getSystemConfig();
                        console.log('🔍 SYSTEM CONFIG DEBUG:', {
                            hasConfig: !!systemConfig,
                            configKeys: Object.keys(systemConfig),
                            hasSkillDistribution: !!systemConfig.skillDistribution,
                            hasMerchantPersonalities: !!systemConfig.merchantPersonalities
                        });
                        
                        merchant = await this.tradingEngine.generateRandomMerchant(this.app.selectedSettlement, rollFunction);
                        console.log('🔍 MERCHANT OBJECT DEBUG:', {
                            name: merchant.name,
                            skillDescription: merchant.skillDescription,
                            hagglingSkill: merchant.hagglingSkill,
                            baseSkill: merchant.baseSkill,
                            personalityModifier: merchant.personalityModifier,
                            personality: merchant.personality,
                            allKeys: Object.keys(merchant)
                        });
                    } catch (error) {
                        console.error('❌ MERCHANT GENERATION FAILED:', error);
                        merchant = {
                            name: 'Unknown Merchant',
                            skillDescription: 'Unknown',
                            hagglingSkill: 'N/A',
                            baseSkill: 'N/A',
                            personalityModifier: 0,
                            personality: 'Unknown'
                        };
                    }
                    
                    return {
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
                            contraband: slot.contraband.contraband,
                            merchant: slot.merchant,
                            desperationUsed: false // No desperation since merchants always available
                        }
                    };
                }));
            } else {
                // Fallback to old trading engine method
                const completeResult = await this.tradingEngine.performCompleteAvailabilityCheck(
                    this.app.selectedSettlement,
                    this.app.currentSeason,
                    rollFunction
                );
                
                availabilityResult = completeResult;
                
                if (completeResult.available) {
                    // Convert cargo types to detailed cargo objects for display
                    availableCargo = await Promise.all(completeResult.cargoTypes.map(async (cargoName) => {
                        const cargoType = this.dataManager.getCargoType(cargoName);
                        const basePrice = this.tradingEngine.calculateBasePrice(cargoName, this.app.currentSeason);
                        const totalCargoSize = completeResult.cargoSize.totalSize;
                        const encumbrance = cargoType?.encumbrancePerUnit || 1;
                        const quantity = Math.floor(totalCargoSize / encumbrance);
                        
                        // Generate a merchant for this cargo type
                        const merchant = await this.tradingEngine.generateRandomMerchant(this.app.selectedSettlement, rollFunction);
                        
                        return {
                            name: cargoName,
                            category: cargoType?.category || 'Unknown',
                            basePrice: basePrice,
                            currentPrice: basePrice,
                            quantity: quantity,
                            totalEP: totalCargoSize,
                            quality: 'Average',
                            encumbrancePerUnit: encumbrance,
                            merchant: merchant
                        };
                    }));
                }
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
                    console.log(`  ├─ Total Slots: ${pipelineResult.slotPlan.producerSlots}`);
                    console.log(`  ├─ All slots produced cargo with merchants`);
                    console.log(`  └─ Total cargo types: ${availableCargo.length}`);
                    
                    availableCargo.forEach((cargo) => {
                        const slot = pipelineResult.slots.find(s => s.cargo.name === cargo.name);
                        if (slot) {
                            console.log(`💰 SLOT ${slot.slotNumber}: ${cargo.name}`);
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
                } else {
                    // Legacy trading engine results
                    console.log('🎯 STEP 1: Availability Check Results');
                    console.log(`  ├─ Base Chance: (${this.dataManager.convertSizeToNumeric(this.app.selectedSettlement.size)} + ${this.app.selectedSettlement.wealth}) × 10 = ${availabilityResult.availabilityCheck?.chance || 'N/A'}%`);
                    console.log(`  ├─ Roll: ${availabilityResult.availabilityCheck?.roll || 'N/A'}`);
                    console.log(`  └─ Result: ${availabilityResult.availabilityCheck?.roll || 'N/A'} ≤ ${availabilityResult.availabilityCheck?.chance || 'N/A'} = SUCCESS`);
                    
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
                
                // Debug: Log what we're storing
                console.log('📦 STORING AVAILABLE CARGO:', availableCargo.map(c => ({
                    name: c.name,
                    merchant: {
                        name: c.merchant?.name,
                        hagglingSkill: c.merchant?.hagglingSkill,
                        baseSkill: c.merchant?.baseSkill,
                        personalityModifier: c.merchant?.personalityModifier
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
                const cargoSummary = availableCargo.map(c => `${c.name} (${c.quantity})`).join(', ');
                ui.notifications.info(`Cargo available in ${this.app.selectedSettlement.name}: ${cargoSummary}`);
                
            } else {
                // FAILURE: No cargo available
                console.log('❌ NO CARGO AVAILABLE');
                
                if (pipelineResult) {
                    // This shouldn't happen with the new logic - pipeline should always produce cargo
                    console.log('📊 PIPELINE ERROR: Pipeline ran but produced no slots');
                    console.log(`  ├─ This indicates a bug in the pipeline logic`);
                } else {
                    console.log('Availability check details:', availabilityResult.availabilityCheck);
                }
                
                // Clear any existing cargo
                this.app.availableCargo = [];
                
                // Show failure message with detailed breakdown
                this.app.renderer._showAvailabilityResults({
                    availabilityResult,
                    pipelineResult
                });
                
                // Hide cargo display
                this.app.renderer._hideCargoDisplay();
                
                // Update button states
                this.app.renderer._updateTransactionButtons();
                
                // Show info notification
                if (pipelineResult) {
                    ui.notifications.info(`Pipeline error: no cargo generated (this is unexpected)`);
                } else {
                    const rollDetails = availabilityResult.availabilityCheck;
                    ui.notifications.info(`No cargo available in ${this.app.selectedSettlement.name} (rolled ${rollDetails?.roll || 'N/A'}/${rollDetails?.chance || 'N/A'})`);
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
            this.app.renderer._hideCargoDisplay();
            this.app.renderer._updateTransactionButtons();
            
            // Restore button on error
            const button = event.target;
            button.textContent = 'Check Availability';
            button.disabled = false;
        }
    }
}
