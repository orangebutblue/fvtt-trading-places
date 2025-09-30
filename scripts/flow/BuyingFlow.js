
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
            if (this.app.cargoAvailabilityPipeline) {
                try {
                    pipelineResult = await this.app.cargoAvailabilityPipeline.run({
                        settlement: this.app.selectedSettlement,
                        season: this.app.currentSeason
                    });
                    console.log('Orange realism pipeline output:', pipelineResult);
                } catch (pipelineError) {
                    this._logError('Availability Pipeline', 'Pipeline execution failed', { error: pipelineError.message });
                }
            }

            const completeResult = await this.tradingEngine.performCompleteAvailabilityCheck(
                this.app.selectedSettlement,
                this.app.currentSeason,
                rollFunction
            );
            
            console.log('Complete availability result:', completeResult);
            
            // Update UI based on result
            if (completeResult.available) {
                // SUCCESS: Cargo is available
                console.log('✅ CARGO IS AVAILABLE!');
                console.log('📊 STEP 0: Settlement Information');
                console.log(`  ├─ Settlement: ${this.app.selectedSettlement.name}`);
                console.log(`  ├─ Size Rating: ${this.app.selectedSettlement.size} (numeric: ${this.dataManager.convertSizeToNumeric(this.app.selectedSettlement.size)})`);
                console.log(`  ├─ Wealth Rating: ${this.app.selectedSettlement.wealth}`);
                console.log(`  └─ Produces: [${(this.app.selectedSettlement.flags || this.app.selectedSettlement.source || []).join(', ')}]`);
                
                console.log('🎯 STEP 1: Availability Check Results');
                console.log(`  ├─ Base Chance: (${this.dataManager.convertSizeToNumeric(this.app.selectedSettlement.size)} + ${this.app.selectedSettlement.wealth}) × 10 = ${completeResult.availabilityCheck.chance}%`);
                console.log(`  ├─ Roll: ${completeResult.availabilityCheck.roll}`);
                console.log(`  └─ Result: ${completeResult.availabilityCheck.roll} ≤ ${completeResult.availabilityCheck.chance} = SUCCESS`);
                
                console.log('📦 STEP 2A: Cargo Type Determination');
                console.log(`  ├─ Available Types: [${completeResult.cargoTypes.join(', ')}]`);
                console.log(`  └─ Count: ${completeResult.cargoTypes.length} type(s)`);
                
                console.log('⚖️ STEP 2B: Cargo Size Calculation');
                console.log(`  ├─ Base Value: ${this.dataManager.convertSizeToNumeric(this.app.selectedSettlement.size)} + ${this.app.selectedSettlement.wealth} = ${completeResult.cargoSize.baseMultiplier}`);
                console.log(`  ├─ Multiplier Roll: ${completeResult.cargoSize.roll1} → rounded up to ${completeResult.cargoSize.sizeMultiplier}`);
                if (completeResult.cargoSize.tradeBonus) {
                    console.log(`  ├─ Trade Bonus: Second roll ${completeResult.cargoSize.roll2} → ${Math.ceil(completeResult.cargoSize.roll2 / 10) * 10}`);
                    console.log(`  ├─ Higher Multiplier Used: ${completeResult.cargoSize.sizeMultiplier}`);
                }
                console.log(`  └─ Total Size: ${completeResult.cargoSize.baseMultiplier} × ${completeResult.cargoSize.sizeMultiplier} = ${completeResult.cargoSize.totalSize} EP`);
                
                // Convert cargo types to detailed cargo objects for display
                const availableCargo = await Promise.all(completeResult.cargoTypes.map(async (cargoName) => {
                    const cargoType = this.dataManager.getCargoType(cargoName);
                    const basePrice = this.tradingEngine.calculateBasePrice(cargoName, this.app.currentSeason);
                    const totalCargoSize = completeResult.cargoSize.totalSize;
                    const encumbrance = cargoType?.encumbrancePerUnit || 1;
                    const quantity = Math.floor(totalCargoSize / encumbrance);
                    
                    // Generate a merchant for this cargo type
                    const merchant = await this.tradingEngine.generateRandomMerchant(this.app.selectedSettlement, rollFunction);
                    
                    console.log(`💰 STEP 3: Price Information for ${cargoName}`);
                    console.log(`  ├─ Base Price (${this.app.currentSeason}): ${basePrice} GC per 10 EP`);
                    console.log(`  ├─ Available Quantity: ${quantity} units (${totalCargoSize} EP total)`);
                    console.log(`  ├─ Encumbrance per Unit: ${encumbrance} EP`);
                    console.log(`  ├─ Merchant: ${merchant.name} (${merchant.skillDescription})`);
                    
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
                
                console.log('📋 FINAL RESULT: Cargo Available for Purchase');
                availableCargo.forEach(cargo => {
                    console.log(`  ├─ ${cargo.name}: ${cargo.quantity} units @ ${cargo.currentPrice} GC/10EP (Merchant: ${cargo.merchant.name} - ${cargo.merchant.skillDescription})`);
                });
                
                // Store available cargo
                this.app.availableCargo = availableCargo;
                
                // Show detailed success message
                this.app.renderer._showAvailabilityResults({
                    availabilityResult: completeResult,
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
                console.log('Availability check details:', completeResult.availabilityCheck);
                
                // Clear any existing cargo
                this.app.availableCargo = [];
                
                // Show failure message with detailed breakdown
                this.app.renderer._showAvailabilityResults({
                    availabilityResult: completeResult,
                    pipelineResult
                });
                
                // Hide cargo display
                this.app.renderer._hideCargoDisplay();
                
                // Update button states
                this.app.renderer._updateTransactionButtons();
                
                // Show info notification
                const rollDetails = completeResult.availabilityCheck;
                ui.notifications.info(`No cargo available in ${this.app.selectedSettlement.name} (rolled ${rollDetails.roll}/${rollDetails.chance})`);
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
