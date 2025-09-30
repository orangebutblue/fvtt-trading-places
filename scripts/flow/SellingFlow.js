
console.log('Trading Places | Loading SellingFlow.js');

export class SellingFlow {
    constructor(app) {
        this.app = app;
        this.dataManager = app.dataManager;
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

    async onLookForSellers(event) {
        event.preventDefault();
        
        if (!this.app.selectedResource) {
            ui.notifications.warn('Please select a resource to sell first');
            return;
        }
        
        if (!this.app.selectedSettlement) {
            ui.notifications.warn('Please select a settlement first');
            return;
        }
        
        console.log('🔍 === LOOKING FOR SELLERS (WFRP SELLING ALGORITHM) ===');
        console.log(`Resource: ${this.app.selectedResource}`);
        console.log(`Settlement: ${this.app.selectedSettlement.name}`);
        
        try {
            // Show loading state
            const button = event.target;
            const originalText = button.textContent;
            button.textContent = 'Looking...';
            button.disabled = true;
            
            // Get quantity from input (for now, assume 10 EP)
            const quantityInput = this.app.element.querySelector('#selling-quantity');
            const quantity = quantityInput ? parseInt(quantityInput.value) || 10 : 10;
            
            console.log(`📊 STEP 2: Finding Buyer for ${quantity} EP of ${this.app.selectedResource}`);
            
            // Step 2: Calculate buyer chance according to algorithm
            const sizeRating = this.dataManager.convertSizeToNumeric(this.app.selectedSettlement.size);
            let buyerChance = sizeRating * 10;
            
            // Add +30 if settlement produces "Trade"
            const productionCategories = this.app.selectedSettlement.flags || this.app.selectedSettlement.source || [];
            const isTradeSettlement = productionCategories.includes('Trade');
            if (isTradeSettlement) {
                buyerChance += 30;
                console.log(`  ├─ Trade Settlement Bonus: +30`);
            }
            
            console.log(`  ├─ Base Chance: Size ${sizeRating} × 10 = ${sizeRating * 10}%`);
            console.log(`  ├─ Trade Bonus: ${isTradeSettlement ? '+30' : '0'}`);
            console.log(`  └─ Final Chance: ${buyerChance}%`);
            
            // Special village restrictions (Step 2 special case)
            if (sizeRating === 1) { // Village
                console.log(`🏘️ VILLAGE RESTRICTIONS CHECK`);
                if (this.app.selectedResource !== 'Grain') {
                    if (this.app.currentSeason === 'spring') {
                        const villageQuantity = Math.floor(Math.random() * 10) + 1; // 1d10
                        console.log(`  ├─ Village in Spring: Can buy max ${villageQuantity} EP of non-Grain goods`);
                        if (quantity > villageQuantity) {
                            ui.notifications.warn(`Village only wants ${villageQuantity} EP of ${this.app.selectedResource} (you have ${quantity} EP)`);
                            button.textContent = originalText;
                            button.disabled = false;
                            return;
                        }
                    } else {
                        console.log(`  └─ Village outside Spring: No demand for non-Grain goods`);
                        ui.notifications.info(`Villages don't buy ${this.app.selectedResource} in ${this.app.currentSeason}`);
                        button.textContent = originalText;
                        button.disabled = false;
                        return;
                    }
                }
            }
            
            // Roll for buyer using FoundryVTT dice
            const roll = new Roll("1d100");
            await roll.evaluate();
            
            // Show dice roll in chat if enabled
            const chatVisibility = game.settings.get("trading-places", "chatVisibility");
            if (chatVisibility !== "disabled") {
                await roll.toMessage({
                    speaker: ChatMessage.getSpeaker(),
                    flavor: `Looking for buyers of ${this.app.selectedResource} in ${this.app.selectedSettlement.name}`
                });
            }
            
            console.log(`🎲 Buyer Search Roll: ${roll.total} vs ${buyerChance}`);
            
            if (roll.total <= buyerChance) {
                // SUCCESS: Buyer found
                console.log('✅ BUYER FOUND!');
                
                // Step 3: Calculate offer price according to algorithm
                console.log(`💰 STEP 3: Calculating Offer Price`);
                
                // Get base price for the resource in current season
                const cargoType = this.dataManager.getCargoType(this.app.selectedResource);
                let basePrice = 50; // Default fallback
                
                if (cargoType && cargoType.basePrices && cargoType.basePrices[this.app.currentSeason]) {
                    basePrice = cargoType.basePrices[this.app.currentSeason];
                }
                
                console.log(`  ├─ Base Price (${this.app.currentSeason}): ${basePrice} GC per 10 EP`);
                
                // Apply wealth modifier according to algorithm
                const wealthModifier = this.dataManager.getWealthModifier(this.app.selectedSettlement.wealth);
                const offerPrice = Math.round(basePrice * wealthModifier);
                
                console.log(`  ├─ Wealth Rating: ${this.app.selectedSettlement.wealth} (${this.dataManager.getWealthDescription(this.app.selectedSettlement.wealth)})`);
                console.log(`  ├─ Wealth Modifier: ${Math.round(wealthModifier * 100)}%`);
                console.log(`  └─ Final Offer: ${basePrice} × ${wealthModifier} = ${offerPrice} GC per 10 EP`);
                
                const totalOffer = Math.round((offerPrice * quantity) / 10);
                
                console.log(`📋 FINAL RESULT: Buyer offers ${totalOffer} GC for ${quantity} EP of ${this.app.selectedResource}`);
                
                // Show success in UI
                const resultsDiv = this.app.element.querySelector('#selling-results');
                if (resultsDiv) {
                    const buyerName = this.app.renderer._generateTraderName();
                    resultsDiv.innerHTML = `
                        <h4>
                            <i class="fas fa-handshake success-icon"></i>
                            Buyer Found!
                        </h4>
                        <div class="buyer-details">
                            <p><strong>Buyer:</strong> ${buyerName}</p>
                            <p><strong>Offer:</strong> ${offerPrice} GC per 10 EP</p>
                            <p><strong>Total for ${quantity} EP:</strong> ${totalOffer} GC</p>
                            <p><strong>Settlement Wealth:</strong> ${this.dataManager.getWealthDescription(this.app.selectedSettlement.wealth)} (${Math.round(wealthModifier * 100)}% of base price)</p>
                        </div>
                    `;
                    resultsDiv.style.display = 'block';
                }
                
                ui.notifications.info(`Buyer found! ${buyerName} offers ${totalOffer} GC for your ${this.app.selectedResource}`);
                
            } else {
                // FAILURE: No buyer found
                console.log('❌ NO BUYER FOUND');
                console.log(`  └─ Rolled ${roll.total} > ${buyerChance} = FAILURE`);
                
                // Show failure in UI
                const resultsDiv = this.app.element.querySelector('#selling-results');
                if (resultsDiv) {
                    resultsDiv.innerHTML = `
                        <h4>
                            <i class="fas fa-times-circle failure-icon"></i>
                            No Buyer Found
                        </h4>
                        <p>No one is interested in ${this.app.selectedResource} right now (rolled ${roll.total}/${buyerChance}).</p>
                        <p>You can try selling half the quantity and re-rolling, or try a different settlement.</p>
                    `;
                    resultsDiv.style.display = 'block';
                }
                
                ui.notifications.info(`No buyers found for ${this.app.selectedResource} in ${this.app.selectedSettlement.name} (rolled ${roll.total}/${buyerChance})`);
            }
            
            // Restore button
            button.textContent = originalText;
            button.disabled = false;
            
        } catch (error) {
            console.error('❌ Error in seller search:', error);
            ui.notifications.error(`Seller search failed: ${error.message}`);
            
            // Restore button on error
            const button = event.target;
            button.textContent = 'Look for Sellers';
            button.disabled = false;
        }
    }
}
