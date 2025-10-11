
console.log('Trading Places | Loading SellingFlow.js');

import {
    formatDenominationValue,
    formatCanonicalValue,
    convertDenominationToCanonical,
    resolveCurrencyContext
} from '../currency-display.js';

export class SellingFlow {
    constructor(app) {
        this.app = app;
        this.dataManager = app.dataManager;
    }

    _getCurrencyContext() {
        return resolveCurrencyContext(this.dataManager);
    }

    _formatCurrencyFromDenomination(value, defaultText = 'N/A') {
        const context = this._getCurrencyContext();
        return formatDenominationValue(value, context, { defaultText });
    }

    _formatCurrencyFromCanonical(value, defaultText = 'N/A') {
        const context = this._getCurrencyContext();
        return formatCanonicalValue(value, context, { defaultText });
    }

    _convertDenominationToCanonical(value) {
        const context = this._getCurrencyContext();
        return convertDenominationToCanonical(value, context);
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

        if (!this.app.selectedSettlement) {
            ui.notifications.warn('Please select a settlement first');
            return;
        }

        // Get current cargo
        const currentCargo = await game.settings.get("trading-places", "currentCargo") || [];
        if (!currentCargo.length) {
            ui.notifications.warn('You have no cargo to sell');
            return;
        }

        console.log('🔍 === LOOKING FOR SELLERS (WFRP SELLING ALGORITHM) ===');
        console.log(`Settlement: ${this.app.selectedSettlement.name}`);
        console.log(`Available Cargo: ${currentCargo.length} items`);

        try {
            // Show loading state
            const button = event.target;
            const originalText = button.textContent;
            button.textContent = 'Looking...';
            button.disabled = true;

            // Step 1: Calculate available slots (same as buying tab)
            const availableSlots = this.dataManager.calculateCargoSlots(this.app.selectedSettlement, this.app.currentSeason);
            console.log(`📊 STEP 1: Available Slots: ${availableSlots}`);

            // Step 2: For each slot, determine if buyer is present (80% chance for now)
            const sellerOffers = [];
            this.app.sellerOffers = sellerOffers;
            let slotNumber = 1;

            for (let slot = 0; slot < availableSlots; slot++) {
                // Roll for buyer presence (80% chance)
                const buyerRoll = Math.floor(Math.random() * 100) + 1;
                const buyerPresent = buyerRoll <= 80;

                console.log(`🎲 SLOT ${slotNumber}: Buyer Roll: ${buyerRoll} ${buyerPresent ? '≤ 80 = SUCCESS' : '> 80 = FAILURE'}`);

                if (buyerPresent) {
                    // Step 3: Randomly select cargo from player's inventory
                    const randomCargoIndex = Math.floor(Math.random() * currentCargo.length);
                    const selectedCargo = currentCargo[randomCargoIndex];

                    console.log(`  ├─ Selected Cargo: ${selectedCargo.cargo} (${selectedCargo.quantity} EP available)`);

                    // Step 4: Generate offer price (placeholder algorithm)
                    const basePrice = this._calculateOfferPrice(selectedCargo, this.app.selectedSettlement, this.app.currentSeason);
                    const offerPricePerEP = basePrice;

                    // Step 5: Generate maximum EP buyer will purchase (0 to available quantity)
                    const maxEP = Math.floor(Math.random() * (selectedCargo.quantity + 1)); // 0 to quantity inclusive

                    // Step 6: Assign skill rating (same as buying algorithm)
                    const skillRating = this._generateSkillRating();

                    const offer = {
                        slotNumber,
                        cargo: selectedCargo,
                        offerPricePerEP,
                        maxEP,
                        skillRating,
                        buyerName: this._generateBuyerName()
                    };

                    sellerOffers.push(offer);
                    console.log(`  └─ Offer: ${offer.buyerName} wants ${selectedCargo.cargo}, offers ${offerPricePerEP} GC/EP, max ${maxEP} EP, skill ${skillRating}`);
                } else {
                    console.log(`  └─ No buyer in this slot`);
                }

                slotNumber++;
            }

            // Step 7: Display results
            await this._displaySellerResults(sellerOffers);

            // Restore button
            button.textContent = originalText;
            button.disabled = false;

        } catch (error) {
            console.error('❌ Error in seller search:', error);
            ui.notifications.error(`Seller search failed: ${error.message}`);

            this.app.sellerOffers = null;

            // Restore button on error
            const button = event.target;
            button.textContent = 'Look for Sellers';
            button.disabled = false;
        }
    }

    /**
     * Calculate offer price for cargo (placeholder algorithm)
     * @param {Object} cargo - Cargo item
     * @param {Object} settlement - Settlement data
     * @param {string} season - Current season
     * @returns {number} Price per EP
     * @private
     */
    _calculateOfferPrice(cargo, settlement, season) {
        // Placeholder: Get base price from cargo type or use fallback
        let basePrice = 1.0; // Default fallback

        try {
            const cargoType = this.dataManager.getCargoType(cargo.cargo);
            if (cargoType && cargoType.basePrices && cargoType.basePrices[season]) {
                basePrice = cargoType.basePrices[season] / 10; // Convert from per-10-EP to per-EP
            }
        } catch (error) {
            console.warn('Could not get cargo type price, using fallback:', error.message);
        }

        // Apply settlement wealth modifier
        const wealthModifier = this.dataManager.getWealthModifier(settlement.wealth);
        const finalPrice = basePrice * wealthModifier;

        return Math.max(0.1, finalPrice); // Minimum 0.1 GC/EP
    }

    /**
     * Generate skill rating for buyer (same as buying algorithm)
     * @returns {number} Skill rating (1-100)
     * @private
     */
    _generateSkillRating() {
        // Simple distribution: 40% low skill (1-30), 40% medium skill (31-70), 20% high skill (71-100)
        const roll = Math.floor(Math.random() * 100) + 1;

        if (roll <= 40) return Math.floor(Math.random() * 30) + 1;      // 1-30
        if (roll <= 80) return Math.floor(Math.random() * 40) + 31;     // 31-70
        return Math.floor(Math.random() * 30) + 71;                     // 71-100
    }

    /**
     * Generate a random buyer name
     * @returns {string} Buyer name
     * @private
     */
    _generateBuyerName() {
        const firstNames = ['Hans', 'Fritz', 'Otto', 'Karl', 'Heinz', 'Wolfgang', 'Dieter', 'Günther', 'Werner', 'Klaus'];
        const lastNames = ['Schmidt', 'Müller', 'Schneider', 'Fischer', 'Weber', 'Meyer', 'Wagner', 'Becker', 'Hoffmann', 'Schulz'];
        const titles = ['', 'Merchant', 'Trader', 'Dealer', 'Broker', 'Vendor'];

        const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
        const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
        const title = titles[Math.floor(Math.random() * titles.length)];

        return title ? `${firstName} ${lastName} the ${title}` : `${firstName} ${lastName}`;
    }

    /**
     * Display seller results in slot-based grid
     * @param {Array} sellerOffers - Array of seller offers
     * @private
     */
    async _displaySellerResults(sellerOffers, { notify = true } = {}) {
        this.app.sellerOffers = sellerOffers;

        const resultsContainer = this.app.element.querySelector('#seller-results');

        if (!resultsContainer) {
            console.error('Seller results container not found');
            return;
        }

        if (sellerOffers.length === 0) {
            resultsContainer.innerHTML = `
                <div class="no-sellers-message">
                    <i class="fas fa-times-circle"></i>
                    <h4>No Buyers Found</h4>
                    <p>No merchants are interested in your cargo right now.</p>
                    <p>Try a different settlement or wait for market conditions to change.</p>
                </div>
            `;
            resultsContainer.style.display = 'block';
            if (notify) {
                ui.notifications.info('No buyers found for your cargo');
            }
            return;
        }

        // Clear and directly append cargo cards (no wrapper div needed)
        resultsContainer.innerHTML = '';
        resultsContainer.style.display = 'block';

        sellerOffers.forEach(offer => {
            const cargoCard = this._createSellerCargoCard(offer);
            
            // If maxEP is 0 from the start, make it look like a failed slot
            if (offer.maxEP <= 0) {
                cargoCard.classList.remove('slot-success');
                cargoCard.classList.add('slot-failure');
                
                // Disable all controls immediately
                const quantityInput = cargoCard.querySelector('.quantity-input');
                const quantitySlider = cargoCard.querySelector('.quantity-slider');
                const discountSlider = cargoCard.querySelector('.discount-slider');
                const sellBtn = cargoCard.querySelector('.sell-btn');
                
                if (quantityInput) quantityInput.disabled = true;
                if (quantitySlider) quantitySlider.disabled = true;
                if (discountSlider) discountSlider.disabled = true;
                if (sellBtn) {
                    sellBtn.disabled = true;
                    sellBtn.innerHTML = '<i class="fas fa-times"></i> No Demand';
                    sellBtn.classList.remove('btn-success');
                    sellBtn.classList.add('btn-secondary');
                }
            }
            
            resultsContainer.appendChild(cargoCard);
        });
        resultsContainer.style.display = 'block';

        // Add event listeners for sliders and sell buttons
        this._attachSellerControls(sellerOffers);

        if (notify) {
            ui.notifications.success(`Found ${sellerOffers.length} buyer${sellerOffers.length > 1 ? 's' : ''} for your cargo!`);
        }
    }

    /**
     * Create a seller cargo card element (reusing buying tab structure)
     * @param {Object} offer - Seller offer data
     * @returns {HTMLElement} - Cargo card element
     * @private
     */
    _createSellerCargoCard(offer) {
        const card = document.createElement('div');
        
        // Check if cargo is contraband
        const isContraband = offer.cargo.contraband || false;
        const contrabandClass = isContraband ? 'contraband' : '';
        
        card.className = `cargo-card slot-success ${contrabandClass}`;
        card.dataset.offerId = offer.slotNumber;

        // Use exact same structure as buying tab
        let basicInfo = `
            <div class="cargo-header">
                <div class="cargo-name">${offer.cargo.cargo}</div>
                <div class="cargo-category">${offer.cargo.category || 'Goods'}</div>
            </div>
            <div class="cargo-details">`;

        basicInfo += `
                <div class="price-info">
                    <span class="price-label">Wants to Buy:</span>
                    <span class="price-value">${offer.maxEP} EP</span>
                </div>
                <div class="price-info">
                    <span class="price-label">Price per EP:</span>
                    <span class="price-value">${this._formatCurrencyFromDenomination(offer.offerPricePerEP)}</span>
                </div>
                <div class="price-info">
                    <span class="price-label">Total Price:</span>
                    <span class="price-value">${this._formatCurrencyFromDenomination(offer.maxEP * offer.offerPricePerEP)}</span>
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
                        <span class="merchant-name">${offer.buyerName} (Skill: ${offer.skillRating})</span>
                    </div>
                    <div class="merchant-description"></div>
                </div>
            </div>

            <!-- Selling Interface (same structure as buying) -->
            <div class="cargo-buying-interface">
                <div class="purchase-controls">
                    <div class="control-block quantity-controls">
                        <span class="control-label">Sell (EP)</span>
                        <div class="control-body">
                            <input type="number" 
                                   class="quantity-input" 
                                   min="1" 
                                   max="${offer.maxEP}" 
                                   value="${Math.min(offer.maxEP, offer.cargo.quantity)}" 
                                   step="1">
                            <input type="range" 
                                   class="quantity-slider" 
                                   min="1" 
                                   max="${offer.maxEP}" 
                                   value="${Math.min(offer.maxEP, offer.cargo.quantity)}" 
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
                        <button class="sell-btn btn btn-success">
                            <i class="fas fa-coins"></i> Sell
                        </button>
                        <div class="total-price-display">
                            <span class="total-price-label">Total Revenue:</span>
                            <span class="total-price-value">${this._formatCurrencyFromDenomination(Math.min(offer.maxEP, offer.cargo.quantity) * offer.offerPricePerEP)}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;

        card.innerHTML = basicInfo;

        return card;
    }

    /**
     * Attach event listeners to seller controls (reusing buying tab logic)
     * @param {Array} sellerOffers - Array of seller offers
     * @private
     */
    _attachSellerControls(sellerOffers) {
        // Find all cargo cards in the seller results
        const cargoCards = this.app.element.querySelectorAll('#seller-results .cargo-card');
        
        cargoCards.forEach(card => {
            const offerId = card.dataset.offerId;
            const offer = sellerOffers.find(o => o.slotNumber.toString() === offerId);
            if (!offer) return;

            // Use the exact same event handling as buying tab
            this._attachSellingInterfaceListeners(card, offer);
        });
    }

    /**
     * Attach event listeners for the selling interface on a cargo card (mirrors buying interface)
     * @param {HTMLElement} card - The cargo card element
     * @param {Object} offer - The offer data
     * @private
     */
    _attachSellingInterfaceListeners(card, offer) {
        const quantityInput = card.querySelector('.quantity-input');
        const quantitySlider = card.querySelector('.quantity-slider');
        const discountSlider = card.querySelector('.discount-slider');
        const discountDisplay = card.querySelector('.discount-display');
        const sellBtn = card.querySelector('.sell-btn');
        const totalPriceValue = card.querySelector('.total-price-value');

        if (!quantityInput || !quantitySlider || !discountSlider || !discountDisplay || !sellBtn || !totalPriceValue) {
            console.warn('Selling interface elements not found for offer:', offer.buyerName);
            return;
        }

        const maxQuantity = offer.maxEP;
        const pricePerEP = offer.offerPricePerEP;

        // Function to update the total price display
        const updateTotalPrice = (quantity, discountPercent) => {
            const discountMultiplier = 1 + (discountPercent / 100);
            const adjustedPricePerEP = pricePerEP * discountMultiplier;
            const totalPrice = quantity * adjustedPricePerEP;
            totalPriceValue.textContent = this._formatCurrencyFromDenomination(totalPrice);
        };

        // Function to update the discount display
        const updateDiscountDisplay = (discountPercent) => {
            discountDisplay.textContent = (discountPercent >= 0 ? '+' : '') + discountPercent + '%';
            discountDisplay.style.color = discountPercent < 0 ? '#4caf50' : discountPercent > 0 ? '#f44336' : 'var(--text-primary)';
        };

        // Sync quantity controls
        const syncQuantityValues = (source, target) => {
            let value = parseInt(source.value) || 1;
            
            // Ensure value is within bounds
            value = Math.max(1, Math.min(maxQuantity, value));
            
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
            const quantity = parseInt(quantityInput.value) || 1;
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

        // Discount event listeners
        discountSlider.addEventListener('input', (e) => {
            onDiscountChange(e.target);
        });
        discountSlider.addEventListener('change', (e) => {
            onDiscountChange(e.target);
        });

        // Sell button click handler
        sellBtn.addEventListener('click', (e) => {
            const quantity = parseInt(quantityInput.value) || 1;
            const discountPercent = parseFloat(discountSlider.value) || 0;
            this._executeSale(offer.slotNumber.toString(), [offer], quantity, discountPercent);
        });

        // Initialize with default values
        const initialQuantity = Math.min(offer.maxEP, offer.cargo.quantity);
        updateTotalPrice(initialQuantity, 0);
        updateDiscountDisplay(0);
    }


    /**
     * Execute a sale transaction
     * @param {string} offerId - Offer ID
     * @param {Array} sellerOffers - Array of seller offers
     * @param {number} quantity - Quantity to sell
     * @param {number} discountPercent - Discount percentage
     * @private
     */
    async _executeSale(offerId, sellerOffers, quantity, discountPercent) {
        const offer = sellerOffers.find(o => o.slotNumber.toString() === offerId);
        if (!offer) return;

        const basePrice = quantity * offer.offerPricePerEP;
        const discountAmount = basePrice * (discountPercent / 100);
        const finalPrice = basePrice + discountAmount;

        try {
            // Add transaction to history
            const transaction = {
                cargo: offer.cargo.cargo,
                category: offer.cargo.category,
                quantity: quantity,
                pricePerEP: finalPrice / quantity,
                totalCost: finalPrice,
                settlement: this.app.selectedSettlement.name,
                season: this.app.currentSeason,
                date: new Date().toISOString(),
                discountPercent: discountPercent,
                isSale: true,
                contraband: offer.cargo.contraband || false
            };
            
            // Add formatted currency fields
            transaction.formattedPricePerEP = this._formatCurrencyFromDenomination(transaction.pricePerEP);
            transaction.formattedTotalCost = this._formatCurrencyFromDenomination(transaction.totalCost);
            const priceCanonical = this._convertDenominationToCanonical(transaction.pricePerEP);
            const totalCanonical = this._convertDenominationToCanonical(transaction.totalCost);
            if (priceCanonical !== null) transaction.pricePerEPCanonical = priceCanonical;
            if (totalCanonical !== null) transaction.totalCostCanonical = totalCanonical;

            const transactionHistory = await game.settings.get("trading-places", "transactionHistory") || [];
            transactionHistory.unshift(transaction);
            await game.settings.set("trading-places", "transactionHistory", transactionHistory);
            
            // Update app's transaction history to keep UI in sync
            this.app.transactionHistory = transactionHistory;

            // Update cargo in settings
            const currentCargo = await game.settings.get("trading-places", "currentCargo") || [];
            const cargoIndex = currentCargo.findIndex(c => c.cargo === offer.cargo.cargo);
            if (cargoIndex !== -1) {
                if (currentCargo[cargoIndex].quantity <= quantity) {
                    currentCargo.splice(cargoIndex, 1);
                } else {
                    currentCargo[cargoIndex].quantity -= quantity;
                }
                await game.settings.set("trading-places", "currentCargo", currentCargo);
                this.app.currentCargo = currentCargo;
            }

            // Show success message
            ui.notifications.success(`Sold ${quantity} EP of ${offer.cargo.cargo} for ${this._formatCurrencyFromDenomination(finalPrice)}`);

            // Update the buyer's "wants to buy" amount
            offer.maxEP -= quantity;
            
            // Update the card to reflect new amount
            this._updateSellerCard(offerId, offer);

            await this.app.refreshUI({ focusTab: 'selling' });

            if (Array.isArray(this.app.sellerOffers)) {
                await this._displaySellerResults(this.app.sellerOffers, { notify: false });
            }

            this._logInfo('Sale Completed', 'Cargo sold successfully', {
                cargo: offer.cargo.cargo,
                quantity,
                finalPrice,
                discountPercent,
                buyer: offer.buyerName
            });

        } catch (error) {
            this._logError('Sale Failed', 'Failed to complete sale', { error: error.message });
            ui.notifications.error(`Sale failed: ${error.message}`);
        }
    }

    /**
     * Update seller card after a sale
     * @param {string} offerId - Offer ID
     * @param {Object} offer - Updated offer data
     * @private
     */
    _updateSellerCard(offerId, offer) {
        const card = this.app.element.querySelector(`#seller-results .cargo-card[data-offer-id="${offerId}"]`);
        if (!card) return;

        // Update "Wants to Buy" amount
        const wantsToBuyElement = card.querySelector('.price-info .price-value');
        if (wantsToBuyElement) {
            wantsToBuyElement.textContent = `${offer.maxEP} EP`;
        }

        // Update total price
        const totalPriceElement = card.querySelectorAll('.price-info .price-value')[2]; // Third price-info is total price
        if (totalPriceElement) {
            totalPriceElement.textContent = this._formatCurrencyFromDenomination(offer.maxEP * offer.offerPricePerEP);
        }

        // If maxEP is 0, deactivate the card (make it look like a failed slot)
        if (offer.maxEP <= 0) {
            card.classList.remove('slot-success');
            card.classList.add('slot-failure');
            
            // Disable all controls
            const quantityInput = card.querySelector('.quantity-input');
            const quantitySlider = card.querySelector('.quantity-slider');
            const discountSlider = card.querySelector('.discount-slider');
            const sellBtn = card.querySelector('.sell-btn');
            
            if (quantityInput) quantityInput.disabled = true;
            if (quantitySlider) quantitySlider.disabled = true;
            if (discountSlider) discountSlider.disabled = true;
            if (sellBtn) {
                sellBtn.disabled = true;
                sellBtn.textContent = 'Sold Out';
                sellBtn.classList.remove('btn-success');
                sellBtn.classList.add('btn-secondary');
            }
            
            // Update the total price display
            const totalPriceValue = card.querySelector('.total-price-value');
            if (totalPriceValue) {
                totalPriceValue.textContent = this._formatCurrencyFromDenomination(0);
            }
        } else {
            // Update quantity controls max values
            const quantityInput = card.querySelector('.quantity-input');
            const quantitySlider = card.querySelector('.quantity-slider');
            
            if (quantityInput) {
                quantityInput.max = offer.maxEP;
                if (parseInt(quantityInput.value) > offer.maxEP) {
                    quantityInput.value = offer.maxEP;
                }
            }
            if (quantitySlider) {
                quantitySlider.max = offer.maxEP;
                if (parseInt(quantitySlider.value) > offer.maxEP) {
                    quantitySlider.value = offer.maxEP;
                }
            }
            
            // Recalculate total price with new quantity
            const quantity = Math.min(parseInt(quantityInput?.value) || 1, offer.maxEP);
            const discountPercent = parseFloat(card.querySelector('.discount-slider')?.value) || 0;
            const discountMultiplier = 1 + (discountPercent / 100);
            const adjustedPricePerEP = offer.offerPricePerEP * discountMultiplier;
            const totalPrice = quantity * adjustedPricePerEP;
            
            const totalPriceValue = card.querySelector('.total-price-value');
            if (totalPriceValue) {
                totalPriceValue.textContent = this._formatCurrencyFromDenomination(totalPrice);
            }
        }
    }
}
