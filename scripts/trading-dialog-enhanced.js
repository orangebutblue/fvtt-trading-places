/**
 * Trading Places Module - Enhanced Trading Dialog
 * Integrates orange-realism features with improved UI
 */

console.log('Trading Places | Loading trading-dialog-enhanced.js');

const DESPERATION_DEFAULTS = {
    priceModifier: 1.15,
    quantityReduction: 0.25,
    skillPenalty: 0.2,
    priceIncrease: 15
};

/**
 * Enhanced Trading Dialog Application
 */
class EnhancedTradingDialog extends Application {
    constructor(actor, settlement, options = {}) {
        super(options);
        this.actor = actor;
        this.settlement = settlement;
        this.merchants = [];
        this.transactionLog = [];
        this.cargoEquilibrium = {};
        this.availableCargoTypes = [];
        this.desperationConfig = {};
        this.dataManager = null;
        this.merchantGenerator = null;
        this.equilibriumCalculator = null;
    }

    static get defaultOptions() {
        return mergeObject(super.defaultOptions, {
            id: 'enhanced-trading-dialog',
            title: 'Trading - {settlement}',
            template: 'modules/trading-places/templates/trading-dialog-enhanced.hbs',
            classes: ['trading-places', 'enhanced-trading'],
            width: 1400,
            height: 900,
            resizable: true
        });
    }

    async getData() {
        const data = await super.getData();
        
        // Initialize managers if not already done
        await this._initializeManagers();
        
        // If no settlement is selected, prepare settlement selection data
        if (!this.settlement) {
            return {
                ...data,
                actor: this.actor,
                showSettlementSelector: true,
                availableSettlements: this._getAvailableSettlements(),
                merchants: [],
                cargoEquilibrium: {},
                availableCargoTypes: [],
                transactionLog: [],
                desperationConfig: {}
            };
        }
        
        // Calculate equilibrium for all cargo types
        await this._calculateEquilibrium();
        
        // Generate merchants if needed
        if (this.merchants.length === 0) {
            await this._generateMerchants();
        }
        
        // Prepare template data
        return {
            ...data,
            actor: this.actor,
            settlement: this.settlement,
            merchants: this.merchants,
            cargoEquilibrium: this.cargoEquilibrium,
            availableCargoTypes: this.availableCargoTypes,
            transactionLog: this.transactionLog,
            desperationConfig: this.desperationConfig
        };
    }

    get title() {
        return this.settlement ? `Trading - ${this.settlement.name}` : 'Trading - Select Settlement';
    }

    async _initializeManagers() {
        if (this.dataManager) {
            return;
        }

        try {
            const moduleApi = window.WFRPRiverTrading;
            const moduleRegistry = (typeof game !== 'undefined' && game.modules)
                ? game.modules.get('trading-places')
                : null;
            const managerFromApi = moduleApi?.getDataManager?.();
            const managerFromModule = moduleRegistry?.dataManager;

            this.dataManager = managerFromApi || managerFromModule || null;

            if (!this.dataManager) {
                throw new Error('DataManager not available');
            }

            if (!Array.isArray(this.dataManager.settlements) || this.dataManager.settlements.length === 0) {
                await this.dataManager.loadActiveDataset();
            }

            if (!Array.isArray(this.dataManager.cargoTypes) || this.dataManager.cargoTypes.length === 0) {
                await this.dataManager.loadCargoTypes();
            }

            if (!this.dataManager.config || Object.keys(this.dataManager.config).length === 0) {
                await this.dataManager.loadTradingConfig();
            }

            if (!this.dataManager.sourceFlags || Object.keys(this.dataManager.sourceFlags).length === 0) {
                try {
                    await this.dataManager.loadSourceFlags();
                } catch (error) {
                    console.warn('Trading Places | Source flags unavailable:', error);
                }
            }

            if (!this.dataManager.merchantGenerator || !this.dataManager.equilibriumCalculator) {
                this.dataManager.initializeMerchantSystem();
            }

            this.merchantGenerator = this.dataManager.merchantGenerator || null;
            this.equilibriumCalculator = this.dataManager.equilibriumCalculator || null;

            const cargoTypes = this.dataManager.getCargoTypes();
            this.availableCargoTypes = Array.from(
                new Set(
                    cargoTypes
                        .filter(cargo => cargo && cargo.name)
                        .map(cargo => cargo.name)
                )
            ).sort();

            const configuredDesperation = this.dataManager.config?.desperation || {};
            this.desperationConfig = { ...DESPERATION_DEFAULTS, ...configuredDesperation };

            if (!this.availableCargoTypes.length) {
                this.availableCargoTypes = ['Grain', 'Metal', 'Timber', 'Luxuries', 'Wool', 'Wine/Brandy', 'Armaments'];
            }

            if (!this.desperationConfig || Object.keys(this.desperationConfig).length === 0) {
                this.desperationConfig = { ...DESPERATION_DEFAULTS };
            }
        } catch (error) {
            console.warn('Trading Places | Failed to initialize enhanced trading managers:', error);
            this._initializeFallbackData();
        }
    }

    _initializeFallbackData() {
        this.availableCargoTypes = ['Grain', 'Metal', 'Timber', 'Luxuries', 'Wool', 'Wine/Brandy', 'Armaments'];
        this.desperationConfig = { ...DESPERATION_DEFAULTS };
    }

    _getAvailableSettlements() {
        if (this.dataManager && this.dataManager.settlements) {
            return this.dataManager.settlements.map(settlement => ({
                name: settlement.name,
                region: settlement.region,
                size: settlement.size,
                wealth: settlement.wealth,
                population: settlement.population
            }));
        }
        return [];
    }

    async _calculateEquilibrium() {
        this.cargoEquilibrium = {};
        
        for (const cargoType of this.availableCargoTypes) {
            if (!cargoType) {
                continue;
            }

            if (this.equilibriumCalculator) {
                const equilibrium = this.equilibriumCalculator.calculateEquilibrium(
                    this.settlement, 
                    cargoType,
                    { season: 'spring' }
                );

                const supply = equilibrium?.supply ?? 0;
                const demand = equilibrium?.demand ?? 0;
                const total = supply + demand;
                const supplyPercent = total > 0 ? (supply / total) * 100 : 50;
                const demandPercent = total > 0 ? (demand / total) * 100 : 50;

                this.cargoEquilibrium[cargoType] = {
                    ...equilibrium,
                    supply,
                    demand,
                    supplyPercent,
                    demandPercent,
                    state: equilibrium?.state || 'balanced'
                };
            } else {
                // Fallback calculation
                this.cargoEquilibrium[cargoType] = this._calculateFallbackEquilibrium(cargoType);
            }
        }
    }

    _calculateFallbackEquilibrium(cargoType) {
        let supply = 100;
        let demand = 100;
        
        // Apply produces/demands effects
        if (this.settlement.produces?.includes(cargoType)) {
            const transfer = Math.floor(demand * 0.5);
            supply += transfer;
            demand -= transfer;
        }
        
        if (this.settlement.demands?.includes(cargoType)) {
            const transfer = Math.floor(supply * 0.35);
            demand += transfer;
            supply -= transfer;
        }
        
        // Determine state
        const ratio = supply / demand;
        let state = 'balanced';
        if (supply <= 10 || demand <= 10) state = 'blocked';
        else if (supply <= 20 || demand <= 20) state = 'desperate';
        else if (ratio > 2.0) state = 'oversupplied';
        else if (ratio < 0.5) state = 'undersupplied';
        
        const total = supply + demand;
        const supplyPercent = total > 0 ? (supply / total) * 100 : 50;
        const demandPercent = total > 0 ? (demand / total) * 100 : 50;

        return {
            supply,
            demand,
            ratio,
            state,
            supplyPercent,
            demandPercent
        };
    }

    async _generateMerchants() {
        this.merchants = [];
        
        for (const cargoType of this.availableCargoTypes) {
            const equilibrium = this.cargoEquilibrium[cargoType];
            
            // Skip if trade is blocked
            if (equilibrium.state === 'blocked') continue;
            
            try {
                if (this.dataManager && this.merchantGenerator) {
                    // Use real merchant generation
                    const producers = this.dataManager.generateMerchants(
                        this.settlement, 
                        cargoType, 
                        'producer',
                        'spring'
                    );
                    const seekers = this.dataManager.generateMerchants(
                        this.settlement, 
                        cargoType, 
                        'seeker',
                        'spring'
                    );
                    
                    this.merchants.push(...producers, ...seekers);
                } else {
                    // Fallback merchant generation
                    this.merchants.push(...this._generateFallbackMerchants(cargoType, equilibrium));
                }
            } catch (error) {
                console.warn(`Failed to generate merchants for ${cargoType}:`, error);
                // Use fallback on error
                this.merchants.push(...this._generateFallbackMerchants(cargoType, equilibrium));
            }
        }
        
        // Apply availability rolls
        this._rollMerchantAvailability();
    }

    _generateFallbackMerchants(cargoType, equilibrium) {
        const merchants = [];
        const merchantCount = Math.max(1, Math.floor(this.settlement.size / 2));
        
        // Generate producers
        for (let i = 0; i < merchantCount; i++) {
            merchants.push({
                id: `${this.settlement.name.toLowerCase()}-${cargoType.toLowerCase()}-producer-${i}`,
                type: 'producer',
                cargoType,
                skill: 25 + (this.settlement.wealth * 8) + Math.floor(Math.random() * 30),
                quantity: this.settlement.size + Math.floor(Math.random() * this.settlement.size),
                basePrice: this._getBasePrice(cargoType),
                finalPrice: this._calculateFinalPrice(cargoType, equilibrium),
                personality: { name: 'Standard Merchant' },
                equilibrium: { supply: equilibrium.supply, demand: equilibrium.demand },
                availability: { isAvailable: false, rollRequired: true, desperation: { available: false, penaltiesApplied: false }},
                specialBehaviors: this.settlement.flags?.filter(f => ['smuggling', 'piracy', 'government'].includes(f)) || []
            });
        }
        
        // Generate seekers
        for (let i = 0; i < merchantCount; i++) {
            merchants.push({
                id: `${this.settlement.name.toLowerCase()}-${cargoType.toLowerCase()}-seeker-${i}`,
                type: 'seeker',
                cargoType,
                skill: 25 + (this.settlement.wealth * 8) + Math.floor(Math.random() * 30),
                quantity: this.settlement.size + Math.floor(Math.random() * this.settlement.size),
                basePrice: this._getBasePrice(cargoType),
                finalPrice: this._calculateFinalPrice(cargoType, equilibrium),
                personality: { name: 'Standard Merchant' },
                equilibrium: { supply: equilibrium.supply, demand: equilibrium.demand },
                availability: { isAvailable: false, rollRequired: true, desperation: { available: false, penaltiesApplied: false }},
                specialBehaviors: this.settlement.flags?.filter(f => ['smuggling', 'piracy', 'government'].includes(f)) || []
            });
        }
        
        return merchants;
    }

    _getBasePrice(cargoType) {
        const prices = {
            'Grain': 1, 'Metal': 8, 'Timber': 3, 'Luxuries': 50,
            'Wool': 1, 'Wine/Brandy': 3, 'Armaments': 12
        };
        return prices[cargoType] || 5;
    }

    _calculateFinalPrice(cargoType, equilibrium) {
        let price = this._getBasePrice(cargoType);
        
        // Apply equilibrium effects
        const ratio = equilibrium.supply / equilibrium.demand;
        if (ratio > 1.5) price *= 0.8;
        else if (ratio < 0.67) price *= 1.2;
        
        // Apply wealth modifier
        price *= (1 + ((this.settlement.wealth - 3) * 0.05));
        
        return Math.round(price * 100) / 100;
    }

    _rollMerchantAvailability() {
        this.merchants.forEach(merchant => {
            const roll = Math.floor(Math.random() * 100) + 1;
            merchant.availability.isAvailable = roll <= merchant.skill;
            merchant.availability.rollMade = roll;
        });
    }

    activateListeners(html) {
        super.activateListeners(html);

        // Settlement selection (when no settlement is initially selected)
        html.find('.region-filter').change(this._onRegionFilter.bind(this));
        html.find('.select-settlement-btn').click(this._onSettlementSelect.bind(this));

        // Only add trading listeners if we have a settlement
        if (this.settlement) {
            // Settlement actions
            html.find('.data-editor-btn').click(this._onOpenDataEditor.bind(this));
            html.find('.generate-availability-btn').click(this._onGenerateAvailability.bind(this));

            // Equilibrium interactions
            html.find('.equilibrium-item').click(this._onEquilibriumClick.bind(this));

            // Merchant filters
            html.find('.cargo-filter, .merchant-type-filter').change(this._onFilterMerchants.bind(this));

            // Merchant actions
            html.find('.buy-partial-btn').click(this._onBuyPartial.bind(this));
            html.find('.buy-all-btn').click(this._onBuyAll.bind(this));
            html.find('.sell-partial-btn').click(this._onSellPartial.bind(this));
            html.find('.sell-all-btn').click(this._onSellAll.bind(this));

            // Desperation reroll
            html.find('.desperation-reroll-btn').click(this._onDesperationReroll.bind(this));

            // Transaction log
            html.find('.clear-log-btn').click(this._onClearLog.bind(this));
            html.find('.export-log-btn').click(this._onExportLog.bind(this));
            html.find('.undo-btn').click(this._onUndoTransaction.bind(this));

            // Modal controls
            html.find('.modal-close, .cancel-btn').click(this._onCloseModal.bind(this));
            html.find('.confirm-reroll-btn').click(this._onConfirmReroll.bind(this));
        }
    }

    _onOpenDataEditor(event) {
        event.preventDefault();
        
        if (this.dataManager && window.WFRPTradingDataManagementApp) {
            const dataApp = new window.WFRPTradingDataManagementApp(this.dataManager);
            dataApp.render(true);
        } else {
            ui.notifications.warn('Data management interface not available');
        }
    }

    async _onGenerateAvailability(event) {
        event.preventDefault();
        
        ui.notifications.info('Checking merchant availability...');
        
        // Re-roll availability for all merchants
        this._rollMerchantAvailability();
        
        // Re-render to show updates
        this.render();
    }

    _onEquilibriumClick(event) {
        const cargoType = $(event.currentTarget).data('cargo');
        const equilibrium = this.cargoEquilibrium[cargoType];
        
        if (equilibrium) {
            const message = `
                <h3>${cargoType} - Supply & Demand</h3>
                <p><strong>Supply:</strong> ${equilibrium.supply}</p>
                <p><strong>Demand:</strong> ${equilibrium.demand}</p>
                <p><strong>Ratio:</strong> ${Math.round(equilibrium.ratio * 100) / 100}:1</p>
                <p><strong>State:</strong> ${equilibrium.state}</p>
                ${equilibrium.transfers ? `<p><strong>Transfers:</strong> ${equilibrium.transfers.length}</p>` : ''}
            `;
            
            new Dialog({
                title: 'Equilibrium Details',
                content: message,
                buttons: {
                    ok: { label: 'Close' }
                }
            }).render(true);
        }
    }

    _onFilterMerchants(event) {
        const cargoFilter = this.element.find('.cargo-filter').val();
        const typeFilter = this.element.find('.merchant-type-filter').val();
        
        this.element.find('.merchant-card').each((i, card) => {
            const $card = $(card);
            const cargo = $card.data('cargo');
            const type = $card.hasClass('producer') ? 'producer' : 'seeker';
            
            let show = true;
            if (cargoFilter && cargo !== cargoFilter) show = false;
            if (typeFilter && type !== typeFilter) show = false;
            
            $card.toggle(show);
        });
    }

    async _onBuyPartial(event) {
        const merchantCard = $(event.currentTarget).closest('.merchant-card');
        const merchantId = merchantCard.data('merchant-id');
        const quantityInput = merchantCard.find('.quantity-input');
        const quantity = parseInt(quantityInput.val());
        
        if (!quantity || quantity <= 0) {
            ui.notifications.warn('Please enter a valid quantity');
            return;
        }
        
        await this._processBuyTransaction(merchantId, quantity);
    }

    async _onBuyAll(event) {
        const merchantCard = $(event.currentTarget).closest('.merchant-card');
        const merchantId = merchantCard.data('merchant-id');
        const merchant = this.merchants.find(m => m.id === merchantId);
        
        if (merchant) {
            await this._processBuyTransaction(merchantId, merchant.quantity);
        }
    }

    async _processBuyTransaction(merchantId, quantity) {
        const merchant = this.merchants.find(m => m.id === merchantId);
        if (!merchant) return;
        
        // Check availability
        if (!merchant.availability.isAvailable && !merchant.availability.desperation.available) {
            ui.notifications.warn('This merchant is not available');
            return;
        }
        
        // Validate quantity
        if (quantity > merchant.quantity) {
            ui.notifications.warn(`Only ${merchant.quantity} available`);
            return;
        }
        
        // Calculate cost
        const totalCost = quantity * merchant.finalPrice;
        
        // Check if actor can afford it
        const actorMoney = this.actor.system.details.money.gc || 0;
        if (actorMoney < totalCost) {
            ui.notifications.warn(`Insufficient funds. Need ${totalCost} GC, have ${actorMoney} GC`);
            return;
        }
        
        try {
            // Update actor money
            await this.actor.update({
                'system.details.money.gc': actorMoney - totalCost
            });
            
            // Add item to actor inventory
            await this._addItemToActor(merchant.cargoType, quantity);
            
            // Update merchant quantity
            merchant.quantity -= quantity;
            if (merchant.quantity <= 0) {
                merchant.availability.isAvailable = false;
            }
            
            // Log transaction
            this._logTransaction('buy', merchant, quantity, totalCost);
            
            ui.notifications.info(`Purchased ${quantity} ${merchant.cargoType} for ${totalCost} GC`);
            this.render();
            
        } catch (error) {
            console.error('Transaction failed:', error);
            ui.notifications.error(`Transaction failed: ${error.message}`);
        }
    }

    async _addItemToActor(cargoType, quantity) {
        // Find existing item or create new one
        const existingItem = this.actor.items.find(item => item.name === cargoType);
        
        if (existingItem) {
            const currentQuantity = existingItem.system.quantity?.value || 0;
            await existingItem.update({
                'system.quantity.value': currentQuantity + quantity
            });
        } else {
            await this.actor.createEmbeddedDocuments('Item', [{
                name: cargoType,
                type: 'trapping',
                system: {
                    quantity: { value: quantity },
                    price: { gc: this._getBasePrice(cargoType) }
                }
            }]);
        }
    }

    _logTransaction(type, merchant, quantity, totalPrice) {
        this.transactionLog.unshift({
            id: `txn-${Date.now()}`,
            type,
            cargoType: merchant.cargoType,
            merchantId: merchant.id,
            quantity,
            totalPrice,
            timestamp: new Date(),
            canUndo: true
        });
        
        // Keep only last 10 transactions
        if (this.transactionLog.length > 10) {
            this.transactionLog = this.transactionLog.slice(0, 10);
        }
    }

    _onDesperationReroll(event) {
        const merchantId = $(event.currentTarget).data('merchant-id');
        this.pendingDesperationMerchant = merchantId;
        this.element.find('.desperation-modal').show();
    }

    _onCloseModal() {
        this.element.find('.desperation-modal').hide();
        this.pendingDesperationMerchant = null;
    }

    async _onConfirmReroll() {
        if (!this.pendingDesperationMerchant) return;
        
        const merchant = this.merchants.find(m => m.id === this.pendingDesperationMerchant);
        if (!merchant) return;
        
        // Apply desperation penalties
        if (this.merchantGenerator && this.merchantGenerator.applyDesperationPenalties) {
            this.merchantGenerator.applyDesperationPenalties(merchant);
        } else {
            // Fallback desperation application
            merchant.skill = Math.floor(merchant.skill * (1 - this.desperationConfig.skillPenalty));
            merchant.finalPrice = Math.round(merchant.finalPrice * this.desperationConfig.priceModifier * 100) / 100;
            merchant.quantity = Math.max(1, Math.floor(merchant.quantity * (1 - this.desperationConfig.quantityReduction)));
            merchant.availability.desperation.available = true;
            merchant.availability.desperation.penaltiesApplied = true;
        }
        
        // Make availability roll with penalty
        const roll = Math.floor(Math.random() * 100) + 1;
        merchant.availability.isAvailable = roll <= merchant.skill;
        merchant.availability.rollMade = roll;
        
        this._onCloseModal();
        
        if (merchant.availability.isAvailable) {
            ui.notifications.info('Desperation reroll succeeded! Merchant is now available with penalties.');
        } else {
            ui.notifications.warn('Desperation reroll failed. No deal available.');
        }
        
        this.render();
    }

    _onClearLog() {
        this.transactionLog = [];
        this.render();
    }

    _onExportLog() {
        if (this.transactionLog.length === 0) {
            ui.notifications.warn('No transactions to export');
            return;
        }
        
        const logText = this.transactionLog.map(tx => {
            const action = tx.type === 'buy' ? 'Bought' : 'Sold';
            return `${action} ${tx.quantity} ${tx.cargoType} for ${tx.totalPrice} GC`;
        }).join('\n');
        
        ChatMessage.create({
            content: `<h3>Trading Log - ${this.settlement.name}</h3><pre>${logText}</pre>`,
            speaker: ChatMessage.getSpeaker({ actor: this.actor })
        });
    }

    _onRegionFilter(event) {
        const region = event.target.value;
        const settlementCards = this.element.find('.settlement-card');
        
        if (!region) {
            settlementCards.show();
        } else {
            settlementCards.each((i, card) => {
                const cardRegion = $(card).find('.settlement-region').text();
                $(card).toggle(cardRegion === region);
            });
        }
    }

    async _onSettlementSelect(event) {
        const settlementName = $(event.currentTarget).data('settlement');
        
        if (!settlementName) return;
        
        // Get settlement data
        if (this.dataManager) {
            this.settlement = this.dataManager.getSettlement(settlementName);
        }
        
        if (this.settlement) {
            // Re-render with the selected settlement
            await this.render();
            ui.notifications.info(`Selected ${this.settlement.name} for trading`);
        } else {
            ui.notifications.error(`Settlement '${settlementName}' not found`);
        }
    }
}

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.WFRPTradingEnhancedDialog = EnhancedTradingDialog;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = EnhancedTradingDialog;
}

console.log('Trading Places | EnhancedTradingDialog class loaded');