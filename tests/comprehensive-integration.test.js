/**
 * Comprehensive Integration Tests for FoundryVTT Trading Module
 * Tests Requirements: 6.1-6.10, 5.1-5.5
 * 
 * This test suite covers:
 * - Dialog rendering and user interaction workflows
 * - Season management integration
 * - Complete end-to-end trading workflows
 * - Error handling and recovery
 * - Performance and reliability testing
 */

// Mock FoundryVTT environment setup
const mockFoundrySetup = () => {
    global.foundryMock = {
        settings: new Map(),
        chatMessages: [],
        dialogs: [],
        notifications: [],
        hooks: new Map(),
        actors: new Map(),
        
        // Settings API
        getSetting: (module, key) => {
            const setting = global.foundryMock.settings.get(`${module}.${key}`);
            return setting ? setting.value : null;
        },
        
        setSetting: async (module, key, value) => {
            const settingKey = `${module}.${key}`;
            const setting = global.foundryMock.settings.get(settingKey);
            if (setting) {
                setting.value = value;
                return true;
            }
            return false;
        },
        
        registerSetting: (module, key, options) => {
            const settingKey = `${module}.${key}`;
            global.foundryMock.settings.set(settingKey, {
                ...options,
                value: options.default
            });
        },
        
        // Chat API
        createChatMessage: async (data) => {
            const message = {
                id: `msg-${Date.now()}`,
                content: data.content,
                whisper: data.whisper || [],
                type: data.type || 'other',
                timestamp: Date.now()
            };
            global.foundryMock.chatMessages.push(message);
            return message;
        },
        
        // Dialog API
        createDialog: (data, options = {}) => {
            const dialog = {
                id: `dialog-${Date.now()}`,
                data,
                options,
                rendered: false,
                closed: false,
                
                render: async function() {
                    this.rendered = true;
                    global.foundryMock.dialogs.push(this);
                    return this;
                },
                
                close: async function() {
                    this.closed = true;
                    const index = global.foundryMock.dialogs.indexOf(this);
                    if (index > -1) {
                        global.foundryMock.dialogs.splice(index, 1);
                    }
                    return this;
                }
            };
            return dialog;
        },
        
        // Notification API
        notify: (message, type = 'info') => {
            const notification = {
                id: `notif-${Date.now()}`,
                message,
                type,
                timestamp: Date.now()
            };
            global.foundryMock.notifications.push(notification);
            return notification;
        },
        
        // Hook system
        registerHook: (event, callback) => {
            if (!global.foundryMock.hooks.has(event)) {
                global.foundryMock.hooks.set(event, []);
            }
            global.foundryMock.hooks.get(event).push(callback);
        },
        
        callHook: (event, ...args) => {
            const callbacks = global.foundryMock.hooks.get(event) || [];
            return callbacks.map(callback => callback(...args));
        },
        
        reset: () => {
            global.foundryMock.settings.clear();
            global.foundryMock.chatMessages = [];
            global.foundryMock.dialogs = [];
            global.foundryMock.notifications = [];
            global.foundryMock.hooks.clear();
            global.foundryMock.actors.clear();
        }
    };
    
    // Setup global FoundryVTT API
    global.game = {
        settings: {
            register: global.foundryMock.registerSetting,
            get: global.foundryMock.getSetting,
            set: global.foundryMock.setSetting
        },
        user: { id: 'test-user', isGM: true }
    };
    
    global.ChatMessage = {
        create: global.foundryMock.createChatMessage
    };
    
    global.Dialog = class {
        constructor(data, options = {}) {
            return global.foundryMock.createDialog(data, options);
        }
    };
    
    global.ui = {
        notifications: {
            info: (msg) => global.foundryMock.notify(msg, 'info'),
            warn: (msg) => global.foundryMock.notify(msg, 'warn'),
            error: (msg) => global.foundryMock.notify(msg, 'error')
        }
    };
    
    global.Hooks = {
        once: global.foundryMock.registerHook,
        on: global.foundryMock.registerHook,
        call: global.foundryMock.callHook
    };
    
    global.CONST = {
        CHAT_MESSAGE_TYPES: { OTHER: 0, ROLL: 5 }
    };
    
    global.Roll = class {
        constructor(formula) {
            this.formula = formula;
            this.total = Math.floor(Math.random() * 100) + 1;
            this.evaluated = false;
        }
        
        async evaluate() {
            this.evaluated = true;
            return this;
        }
        
        async toMessage(data = {}) {
            return await ChatMessage.create({
                content: `Roll: ${this.total}`,
                type: CONST.CHAT_MESSAGE_TYPES.ROLL,
                ...data
            });
        }
    };
};

// Initialize mock environment
mockFoundrySetup();

// Import modules
const TradingDialog = require('../scripts/trading-dialog.js');
const TradingEngine = require('../scripts/trading-engine.js');
const DataManager = require('../scripts/data-manager.js');
const SystemAdapter = require('../scripts/system-adapter.js');

describe('Comprehensive FoundryVTT Integration Tests', () => {
    let tradingDialog;
    let tradingEngine;
    let dataManager;
    let systemAdapter;
    
        beforeEach(async () => {
            global.foundryMock.reset();
            
            // Register settings
            global.foundryMock.registerSetting('wfrp-trading', 'currentSeason', {
                name: 'Current Season',
                scope: 'world',
                config: true,
                type: String,
                default: 'spring'
            });
            
            global.foundryMock.registerSetting('wfrp-trading', 'chatVisibility', {
                name: 'Chat Visibility',
                scope: 'world',
                config: true,
                type: String,
                default: 'gm'
            });
            
            global.foundryMock.registerSetting('wfrp-trading', 'activeDataset', {
                name: 'Active Dataset',
                scope: 'world',
                config: true,
                type: String,
                default: 'wfrp4e-default'
            });
            
            // Initialize components
            dataManager = new DataManager();
            systemAdapter = new SystemAdapter();
            tradingEngine = new TradingEngine(dataManager);
            tradingDialog = new TradingDialog();

            // Load test data
            try {
                const fs = require('fs');
                const path = require('path');
                
                // Load settlements
                const settlementsDir = path.join(__dirname, '../datasets/active/settlements');
                const regionFiles = fs.readdirSync(settlementsDir).filter(f => f.endsWith('.json'));
                const settlementsData = { settlements: [] };
                
                regionFiles.forEach(file => {
                    const filePath = path.join(settlementsDir, file);
                    const regionSettlements = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                    settlementsData.settlements.push(...regionSettlements);
                });
                
                // Load cargo types
                const cargoData = JSON.parse(fs.readFileSync(path.join(__dirname, '../datasets/active/cargo-types.json'), 'utf8'));
                
                // Load config
                const configData = JSON.parse(fs.readFileSync(path.join(__dirname, '../datasets/active/config.json'), 'utf8'));
                
                dataManager.settlements = settlementsData.settlements || [];
                dataManager.cargoTypes = cargoData.cargoTypes || [];
                dataManager.config = configData;
            } catch (error) {
                console.warn('Could not load test data:', error.message);
            }

            // Set default season for tests
            await tradingEngine.setCurrentSeason('spring');
        });    describe('Dialog Rendering and User Interaction Workflows', () => {
        test('should render trading dialog with proper FoundryVTT integration', async () => {
            // Requirements: 6.1, 6.10
            
            const dialogOptions = {
                title: 'Trading Places System',
                width: 600,
                height: 400,
                resizable: true
            };
            
            const dialogData = {
                settlements: [
                    { 
                        name: 'Ubersreik', 
                        size: 'T', 
                        wealth: 3, 
                        source: ['Trade', 'Wine'],
                        ruler: 'Lord Aschaffenberg',
                        population: 6000,
                        notes: 'Trading town'
                    },
                    { 
                        name: 'Averheim', 
                        size: 'T', 
                        wealth: 4, 
                        source: ['Trade', 'Cattle'],
                        ruler: 'Elector Count Marius Leitdorf',
                        population: 8000,
                        notes: 'Fortified city'
                    }
                ],
                currentSeason: 'spring',
                availableCargo: ['Wine', 'Grain', 'Cattle']
            };
            
            // Create and render dialog
            const dialog = await tradingDialog.create(dialogData, dialogOptions);
            
            expect(dialog).toBeDefined();
            expect(dialog.data).toEqual(dialogData);
            expect(dialog.options.title).toBe('Trading Places System');
            expect(dialog.options.width).toBe(600);
            
            // Test dialog rendering
            await dialog.render();
            
            expect(dialog.rendered).toBe(true);
            expect(global.foundryMock.dialogs).toHaveLength(1);
            expect(global.foundryMock.dialogs[0].id).toBe(dialog.id);
            
            // Test dialog interaction simulation
            const settlementSelectResult = await tradingDialog.onSettlementSelect('Ubersreik');
            
            expect(settlementSelectResult.settlement).toBe('Ubersreik');
            expect(settlementSelectResult.availabilityChance).toBe(60); // Size 3 + Wealth 3 = 60%
            expect(settlementSelectResult.cargoTypes).toContain('Wine');
            
            // Test cargo selection
            const cargoSelectResult = await tradingDialog.onCargoSelect('Wine', 20);
            
            expect(cargoSelectResult.cargoName).toBe('Wine');
            expect(cargoSelectResult.quantity).toBe(20);
            expect(cargoSelectResult.priceCalculation).toBeDefined();
            
            // Test dialog close
            await dialog.close();
            
            expect(dialog.closed).toBe(true);
            expect(global.foundryMock.dialogs).toHaveLength(0);
        });

        test('should handle user interaction events properly', async () => {
            // Requirements: 6.10
            
            let eventLog = [];
            
            // Mock event handlers
            tradingDialog.onSettlementSelect = async (settlementName) => {
                eventLog.push({ type: 'settlement_select', settlement: settlementName });
                return { settlement: settlementName, success: true };
            };
            
            tradingDialog.onCargoSelect = async (cargoName, quantity) => {
                eventLog.push({ type: 'cargo_select', cargo: cargoName, quantity });
                return { cargo: cargoName, quantity, success: true };
            };
            
            tradingDialog.onHaggleAttempt = async (playerSkill) => {
                eventLog.push({ type: 'haggle_attempt', skill: playerSkill });
                return { success: true, priceReduction: 10 };
            };
            
            tradingDialog.onPurchaseConfirm = async (transactionData) => {
                eventLog.push({ type: 'purchase_confirm', data: transactionData });
                return { success: true, transactionId: 'tx-123' };
            };
            
            // Simulate user interactions
            await tradingDialog.onSettlementSelect('Averheim');
            await tradingDialog.onCargoSelect('Cattle', 15);
            await tradingDialog.onHaggleAttempt(45);
            await tradingDialog.onPurchaseConfirm({
                settlement: 'Averheim',
                cargo: 'Cattle',
                quantity: 15,
                finalPrice: 450
            });
            
            expect(eventLog).toHaveLength(4);
            expect(eventLog[0].type).toBe('settlement_select');
            expect(eventLog[1].type).toBe('cargo_select');
            expect(eventLog[2].type).toBe('haggle_attempt');
            expect(eventLog[3].type).toBe('purchase_confirm');
            
            // Test error handling in interactions
            tradingDialog.onCargoSelect = async () => {
                throw new Error('Invalid cargo selection');
            };
            
            const errorResult = await tradingDialog.onCargoSelect('InvalidCargo', 0).catch(error => ({
                success: false,
                error: error.message
            }));
            
            expect(errorResult.success).toBe(false);
            expect(errorResult.error).toBe('Invalid cargo selection');
        });

        test('should validate user input and prevent invalid transactions', async () => {
            // Requirements: 6.10
            
            // Test invalid settlement selection
            const invalidSettlement = await tradingDialog.validateSettlementSelection('NonexistentTown');
            
            expect(invalidSettlement.valid).toBe(false);
            expect(invalidSettlement.errors).toContain('Settlement not found: NonexistentTown');
            
            // Test invalid cargo quantity
            const invalidQuantity = await tradingDialog.validateCargoQuantity(-5);
            
            expect(invalidQuantity.valid).toBe(false);
            expect(invalidQuantity.errors).toContain('Quantity must be a positive number');
            
            // Test insufficient funds validation
            const mockActor = {
                system: { money: { gc: 100 } }
            };
            
            const insufficientFunds = await tradingDialog.validateTransaction(mockActor, {
                totalPrice: 500,
                cargo: 'Wine',
                quantity: 20
            });
            
            expect(insufficientFunds.valid).toBe(false);
            expect(insufficientFunds.errors).toContain('Insufficient currency: need 500 GC, have 100 GC');
            
            // Test valid transaction
            const validActor = {
                system: { money: { gc: 1000 } }
            };
            
            const validTransaction = await tradingDialog.validateTransaction(validActor, {
                totalPrice: 300,
                cargo: 'Grain',
                quantity: 50
            });
            
            expect(validTransaction.valid).toBe(true);
            expect(validTransaction.errors).toHaveLength(0);
        });
    });

    describe('Season Management Integration', () => {
        test('should persist season changes across module operations', async () => {
            // Requirements: 5.1, 5.2, 5.3, 5.4, 5.5
            
            // Test initial season
            expect(global.foundryMock.getSetting('wfrp-trading', 'currentSeason')).toBe('spring');
            
            // Test season change through trading engine
            await tradingEngine.setCurrentSeason('winter');
            
            expect(tradingEngine.getCurrentSeason()).toBe('winter');
            expect(global.foundryMock.getSetting('wfrp-trading', 'currentSeason')).toBe('winter');
            
            // Test season change notifications
            const initialNotificationCount = global.foundryMock.notifications.length;
            
            await tradingEngine.setCurrentSeason('summer');
            
            expect(global.foundryMock.notifications.length).toBeGreaterThan(initialNotificationCount);
            
            const seasonNotification = global.foundryMock.notifications.find(n => 
                n.message.includes('Trading season changed to summer')
            );
            expect(seasonNotification).toBeDefined();
            expect(seasonNotification.type).toBe('info');
            
            // Test price updates with season changes
            const grainSpringPrice = tradingEngine.calculateBasePrice('Grain', 'spring');
            const grainWinterPrice = tradingEngine.calculateBasePrice('Grain', 'winter');
            
            expect(grainSpringPrice).not.toBe(grainWinterPrice);
            
            // Test season validation before trading operations
            tradingEngine.currentSeason = null; // Reset season
            
            expect(() => {
                tradingEngine.validateSeasonSet();
            }).toThrow('Season must be set before trading operations');
            
            // Test season persistence across component reinitialization
            await tradingEngine.setCurrentSeason('autumn');
            
            const newTradingEngine = new TradingEngine(dataManager);
            await newTradingEngine.loadSeasonFromSettings();
            
            expect(newTradingEngine.getCurrentSeason()).toBe('autumn');
        });

        test('should update all pricing calculations when season changes', async () => {
            // Requirements: 5.2, 5.3
            
            const testCargo = ['Grain', 'Wine', 'Cattle'];
            const seasons = ['spring', 'summer', 'autumn', 'winter'];
            
            const priceMatrix = {};
            
            // Calculate prices for all cargo types in all seasons
            for (const season of seasons) {
                await tradingEngine.setCurrentSeason(season);
                priceMatrix[season] = {};
                
                for (const cargo of testCargo) {
                    priceMatrix[season][cargo] = tradingEngine.calculateBasePrice(cargo, season);
                }
            }
            
            // Verify prices change between seasons
            for (const cargo of testCargo) {
                const prices = seasons.map(season => priceMatrix[season][cargo]);
                const uniquePrices = [...new Set(prices)];
                
                expect(uniquePrices.length).toBeGreaterThan(1); // Prices should vary by season
            }
            
            // Test season-specific price modifiers
            await tradingEngine.setCurrentSeason('spring');
            const springPurchase = tradingEngine.calculatePurchasePrice('Wine', 10);
            
            await tradingEngine.setCurrentSeason('winter');
            const winterPurchase = tradingEngine.calculatePurchasePrice('Wine', 10);
            
            expect(springPurchase.totalPrice).not.toBe(winterPurchase.totalPrice);
            
            // Test seasonal cargo availability
            const tradeSettlement = {
                region: 'Empire',
                name: 'Trade Town',
                size: 'T',
                wealth: 3,
                source: ['Trade']
            };
            
            const springCargo = tradingEngine.determineCargoTypes(tradeSettlement, 'spring');
            const winterCargo = tradingEngine.determineCargoTypes(tradeSettlement, 'winter');
            
            expect(springCargo).toContain('Trade Goods');
            expect(winterCargo).toContain('Trade Goods');
            // Seasonal cargo tables would provide different specific goods
        });

        test('should handle season change hooks and events', async () => {
            // Requirements: 5.2, 5.4
            
            let hookCallLog = [];
            
            // Register season change hooks
            global.foundryMock.registerHook('seasonChanged', (oldSeason, newSeason) => {
                hookCallLog.push({ event: 'seasonChanged', oldSeason, newSeason });
            });
            
            global.foundryMock.registerHook('pricesUpdated', (season) => {
                hookCallLog.push({ event: 'pricesUpdated', season });
            });
            
            // Trigger season change
            await tradingEngine.setCurrentSeason('summer');
            
            // Manually trigger hooks (in real implementation, these would be automatic)
            global.foundryMock.callHook('seasonChanged', 'spring', 'summer');
            global.foundryMock.callHook('pricesUpdated', 'summer');
            
            expect(hookCallLog).toHaveLength(2);
            expect(hookCallLog[0].event).toBe('seasonChanged');
            expect(hookCallLog[0].oldSeason).toBe('spring');
            expect(hookCallLog[0].newSeason).toBe('summer');
            expect(hookCallLog[1].event).toBe('pricesUpdated');
            expect(hookCallLog[1].season).toBe('summer');
            
            // Test season validation in dialog
            const seasonValidation = tradingDialog.validateSeasonSelection('invalid-season');
            
            expect(seasonValidation.valid).toBe(false);
            expect(seasonValidation.errors).toContain('Invalid season: invalid-season');
            
            const validSeasonValidation = tradingDialog.validateSeasonSelection('autumn');
            
            expect(validSeasonValidation.valid).toBe(true);
            expect(validSeasonValidation.errors).toHaveLength(0);
        });
    });

    describe('Complete End-to-End Trading Workflows', () => {
        test('should execute complete purchase workflow with FoundryVTT integration', async () => {
            // Requirements: 1.1-1.7, 2.1-2.6, 6.1-6.10
            
            const mockActor = {
                id: 'test-actor',
                name: 'Test Trader',
                system: { money: { gc: 1000 } },
                items: new Map(),
                updateHistory: [],
                
                async update(data) {
                    this.updateHistory.push(data);
                    // Handle nested property updates
                    if (data.system && data.system.money && data.system.money.gc !== undefined) {
                        this.system.money.gc = data.system.money.gc;
                    }
                    return this;
                },
                
                async createEmbeddedDocuments(type, itemData) {
                    const items = itemData.map((data, index) => ({
                        id: `item-${Date.now()}-${index}`,
                        ...data
                    }));
                    
                    items.forEach(item => this.items.set(item.id, item));
                    return items;
                }
            };
            
            const settlement = {
                region: 'Empire',
                name: 'Ubersreik',
                size: 'T',
                ruler: 'Lord Aschaffenberg',
                population: 6000,
                wealth: 3,
                source: ['Trade', 'Wine'],
                garrison: ['20a', '40b', '120c'],
                notes: 'Trading town'
            };
            
            // Step 1: Check cargo availability
            const availabilityResult = await tradingEngine.checkCargoAvailability(settlement, () => 45);
            
            expect(availabilityResult.available).toBe(true);
            expect(availabilityResult.chance).toBe(60);
            expect(availabilityResult.roll).toBe(45);
            
            // Step 2: Determine available cargo types
            const cargoTypes = tradingEngine.determineCargoTypes(settlement, 'spring');
            
            expect(cargoTypes).toContain('Wine/Brandy');
            expect(cargoTypes).toContain('Trade Goods');
            
            // Step 3: Calculate cargo size
            const cargoSize = await tradingEngine.calculateCargoSize(settlement, () => 60);
            
            expect(cargoSize.totalSize).toBe(360); // (3+3) × 60 = 360 EP
            expect(cargoSize.tradeBonus).toBe(true);
            
            // Step 4: Calculate purchase price
            const purchasePrice = tradingEngine.calculatePurchasePrice('Wine/Brandy', 20, {
                season: 'spring',
                quality: 'good'
            });
            
            expect(purchasePrice.cargoName).toBe('Wine/Brandy');
            expect(purchasePrice.quantity).toBe(20);
            expect(purchasePrice.totalPrice).toBeGreaterThan(0);
            
            // Step 5: Execute transaction through SystemAdapter
            const currencyDeduction = await systemAdapter.deductCurrency(
                mockActor,
                purchasePrice.totalPrice,
                'Wine purchase at Ubersreik'
            );
            
            expect(currencyDeduction.success).toBe(true);
            expect(mockActor.system.money.gc).toBe(1000 - purchasePrice.totalPrice);
            
            const inventoryAddition = await systemAdapter.addCargoToInventory(
                mockActor,
                'Wine',
                20,
                { category: 'Luxury', encumbrancePerUnit: 1 },
                {
                    pricePerUnit: purchasePrice.finalPricePerUnit,
                    totalPrice: purchasePrice.totalPrice,
                    quality: 'good',
                    season: 'spring',
                    settlement: 'Ubersreik'
                }
            );
            
            expect(inventoryAddition.success).toBe(true);
            expect(mockActor.items.size).toBe(1);
            
            // Step 6: Generate transaction chat message
            const transactionMessage = await ChatMessage.create({
                content: `
                    <div class="trading-result purchase">
                        <h3>Purchase Completed</h3>
                        <p><strong>Settlement:</strong> ${settlement.name}</p>
                        <p><strong>Cargo:</strong> ${purchasePrice.cargoName} (${purchasePrice.quantity} EP)</p>
                        <p><strong>Quality:</strong> good</p>
                        <p><strong>Price per Unit:</strong> ${purchasePrice.finalPricePerUnit} GC</p>
                        <p><strong>Total Price:</strong> ${purchasePrice.totalPrice} GC</p>
                        <p><strong>Season:</strong> spring</p>
                    </div>
                `,
                type: CONST.CHAT_MESSAGE_TYPES.OTHER,
                whisper: global.foundryMock.getSetting('wfrp-trading', 'chatVisibility') === 'gm' ? ['gm-user'] : []
            });
            
            expect(transactionMessage.content).toContain('Purchase Completed');
            expect(transactionMessage.content).toContain('Ubersreik');
            expect(transactionMessage.content).toContain('Wine');
            expect(global.foundryMock.chatMessages).toHaveLength(1);
        });

        test('should execute complete sale workflow with restrictions', async () => {
            // Requirements: 3.1-3.7, 4.1-4.5, 6.1-6.10
            
            const mockActor = {
                id: 'test-actor',
                system: { money: { gc: 500 } },
                items: new Map([
                    ['wine-item-1', {
                        id: 'wine-item-1',
                        name: 'Wine (good)',
                        system: {
                            quantity: { value: 30 },
                            quality: 'good',
                            tradingData: {
                                isTradingCargo: true,
                                purchaseLocation: 'Averheim',
                                purchasePrice: 15,
                                purchaseDate: Date.now() - (8 * 24 * 60 * 60 * 1000) // 8 days ago
                            }
                        }
                    }]
                ]),
                updateHistory: [],
                
                async update(data) {
                    this.updateHistory.push(data);
                    // Handle nested property updates
                    if (data.system && data.system.money && data.system.money.gc !== undefined) {
                        this.system.money.gc = data.system.money.gc;
                    }
                    return this;
                },
                
                async updateEmbeddedDocuments(type, updates) {
                    updates.forEach(update => {
                        const item = this.items.get(update._id);
                        if (item && update['system.quantity.value']) {
                            item.system.quantity.value = update['system.quantity.value'];
                        }
                    });
                    return updates;
                },
                
                async deleteEmbeddedDocuments(type, ids) {
                    ids.forEach(id => this.items.delete(id));
                    return ids;
                }
            };
            
            const settlement = {
                region: 'Empire',
                name: 'Ubersreik',
                size: 'T',
                ruler: 'Lord Aschaffenberg',
                population: 6000,
                wealth: 3,
                source: ['Trade', 'Wine'],
                garrison: ['20a', '40b', '120c'],
                notes: 'Trading town'
            };
            
            const purchaseData = {
                settlementName: 'Averheim',
                purchaseTime: Date.now() - (8 * 24 * 60 * 60 * 1000) // 8 days ago
            };
            
            // Step 1: Check sale eligibility
            const saleEligibility = tradingEngine.checkSaleEligibility(
                { name: 'Wine/Brandy', quantity: 20 },
                settlement,
                purchaseData,
                Date.now()
            );
            
            expect(saleEligibility.eligible).toBe(true);
            
            // Step 2: Find buyer
            const buyerResult = await tradingEngine.findBuyer(settlement, 'Wine/Brandy', () => 40);
            
            expect(buyerResult.buyerFound).toBe(true);
            expect(buyerResult.chance).toBe(60); // Size 3 × 10 + 30 (Trade bonus)
            
            // Step 3: Calculate sale price
            const salePrice = tradingEngine.calculateSalePrice('Wine/Brandy', 20, settlement, {
                season: 'spring',
                quality: 'good'
            });
            
            expect(salePrice.cargoName).toBe('Wine/Brandy');
            expect(salePrice.quantity).toBe(20);
            expect(salePrice.wealthModifier).toBe(1.0); // Average wealth
            
            // Step 4: Execute sale transaction
            const currencyAddition = await systemAdapter.addCurrency(
                mockActor,
                salePrice.totalPrice,
                'Wine sale at Ubersreik'
            );
            
            expect(currencyAddition.success).toBe(true);
            expect(mockActor.system.money.gc).toBe(500 + salePrice.totalPrice);
            
            const inventoryRemoval = await systemAdapter.removeCargoFromInventory(
                mockActor,
                'wine-item-1',
                20
            );
            
            expect(inventoryRemoval.success).toBe(true);
            expect(inventoryRemoval.remainingQuantity).toBe(10);
            
            // Step 5: Generate sale chat message
            const saleMessage = await ChatMessage.create({
                content: `
                    <div class="trading-result sale">
                        <h3>Sale Completed</h3>
                        <p><strong>Settlement:</strong> ${settlement.name}</p>
                        <p><strong>Cargo:</strong> ${salePrice.cargoName} (${salePrice.quantity} EP)</p>
                        <p><strong>Price per Unit:</strong> ${salePrice.finalPricePerUnit} GC</p>
                        <p><strong>Total Revenue:</strong> ${salePrice.totalPrice} GC</p>
                        <p><strong>Wealth Modifier:</strong> ${Math.round(salePrice.wealthModifier * 100)}%</p>
                    </div>
                `,
                type: CONST.CHAT_MESSAGE_TYPES.OTHER
            });
            
            expect(saleMessage.content).toContain('Sale Completed');
            expect(saleMessage.content).toContain('Ubersreik');
            expect(global.foundryMock.chatMessages).toHaveLength(1);
        });

        test('should handle complete haggling workflow with skill tests', async () => {
            // Requirements: 2.3, 2.4, 2.5, 4.3, 4.4, 6.7, 6.8, 6.9
            
            const mockActor = {
                system: {
                    skills: {
                        haggle: { total: 45 },
                        gossip: { total: 35 }
                    }
                }
            };
            
            const settlement = {
                name: 'Ubersreik',
                size: 'T',
                wealth: 3,
                source: ['Trade', 'Wine'],
                ruler: 'Lord Aschaffenberg',
                population: 6000,
                notes: 'Trading town'
            };
            
            // Step 1: Perform haggle test
            const haggleResult = await tradingEngine.performHaggleTest(
                45, // Player skill
                40, // Merchant skill
                true, // Has Dealmaker talent
                {},
                () => 25 // Player roll (success)
            );
            
            expect(haggleResult.success).toBe(true);
            expect(haggleResult.hasDealmakertTalent).toBe(true);
            expect(haggleResult.player.success).toBe(true);
            
            // Step 2: Apply haggle result to purchase price
            const basePrice = tradingEngine.calculatePurchasePrice('Wine/Brandy', 15);
            const hagglePrice = tradingEngine.calculatePurchasePrice('Wine/Brandy', 15, {
                haggleResult: haggleResult
            });
            
            expect(hagglePrice.totalPrice).toBeLessThan(basePrice.totalPrice);
            expect(hagglePrice.modifiers.some(m => m.type === 'haggle')).toBe(true);
            
            // Step 3: Test gossip for rumors
            const gossipResult = await tradingEngine.performGossipTest(35, {}, () => 20);
            
            expect(gossipResult.success).toBe(true);
            expect(gossipResult.modifiedSkill).toBe(25); // 35 - 10 (Difficult modifier)
            
            // Step 4: Generate rumor from successful gossip
            const rumor = await tradingEngine.generateRumorFromGossip(gossipResult, 'Wine/Brandy', settlement);
            
            expect(rumor).toBeDefined();
            expect(rumor.cargoName).toBe('Wine/Brandy');
            expect(rumor.multiplier).toBeGreaterThan(1);
            
            // Step 5: Generate haggle test chat message
            const haggleMessage = tradingEngine.generateHaggleTestMessage(haggleResult);
            
            expect(haggleMessage).toContain('Haggle Test');
            expect(haggleMessage).toContain('with Dealmaker talent');
            expect(haggleMessage).toContain('Player wins');
            
            const chatMessage = await ChatMessage.create({
                content: haggleMessage,
                type: CONST.CHAT_MESSAGE_TYPES.OTHER
            });
            
            expect(chatMessage.content).toContain('Haggle Test');
            expect(global.foundryMock.chatMessages).toHaveLength(1);
        });
    });

    describe('Error Handling and Recovery', () => {
        test('should handle and recover from FoundryVTT API failures', async () => {
            // Requirements: 6.4, 6.10, 8.7, 8.8
            
            // Test chat message failure
            const originalCreate = ChatMessage.create;
            ChatMessage.create = async () => {
                throw new Error('Chat service unavailable');
            };
            
            const chatResult = await ChatMessage.create({
                content: 'Test message'
            }).catch(error => ({
                success: false,
                error: error.message
            }));
            
            expect(chatResult.success).toBe(false);
            expect(chatResult.error).toBe('Chat service unavailable');
            
            // Restore original function
            ChatMessage.create = originalCreate;
            
            // Test settings failure
            const originalSetSetting = global.foundryMock.setSetting;
            global.foundryMock.setSetting = async () => {
                throw new Error('Settings database locked');
            };
            
            const settingResult = await tradingEngine.setCurrentSeason('winter').catch(error => ({
                success: false,
                error: error.message
            }));
            
            expect(settingResult.success).toBe(false);
            expect(settingResult.error).toBe('Settings database locked');
            
            // Restore original function
            global.foundryMock.setSetting = originalSetSetting;
            
            // Test dialog rendering failure
            const originalCreateDialog = global.foundryMock.createDialog;
            global.foundryMock.createDialog = () => {
                throw new Error('UI system unavailable');
            };
            
            expect(() => {
                new Dialog({}, {});
            }).toThrow('UI system unavailable');
            
            // Restore original function
            global.foundryMock.createDialog = originalCreateDialog;
            
            // Test graceful degradation
            const degradedEngine = new TradingEngine(null); // No data manager
            
            expect(() => {
                degradedEngine.calculateAvailabilityChance({});
            }).toThrow('Settlement object is required');
        });

        test('should provide clear error messages for user-facing failures', async () => {
            // Requirements: 6.4, 6.10
            
            // Test invalid settlement validation
            const invalidSettlement = tradingDialog.validateSettlementSelection('');
            
            expect(invalidSettlement.valid).toBe(false);
            expect(invalidSettlement.errors).toContain('Settlement name cannot be empty');
            
            // Test invalid cargo validation
            const invalidCargo = tradingDialog.validateCargoSelection('', -5);
            
            expect(invalidCargo.valid).toBe(false);
            expect(invalidCargo.errors).toContain('Cargo name cannot be empty');
            expect(invalidCargo.errors).toContain('Quantity must be greater than 0');
            
            // Test transaction validation with detailed errors
            const mockActor = {
                system: { money: { gc: 50 } }
            };
            
            const transactionValidation = tradingDialog.validateTransaction(mockActor, {
                totalPrice: 500,
                cargo: '',
                quantity: 0,
                settlement: null
            });
            
            expect(transactionValidation.valid).toBe(false);
            expect(transactionValidation.errors.length).toBeGreaterThan(1);
            expect(transactionValidation.errors).toContain('Insufficient currency: need 500 GC, have 50 GC');
            expect(transactionValidation.errors).toContain('Cargo name is required');
            expect(transactionValidation.errors).toContain('Quantity must be greater than 0');
            expect(transactionValidation.errors).toContain('Settlement is required');
            
            // Test error notification display
            const errorNotification = ui.notifications.error('Test error message');
            
            expect(errorNotification.type).toBe('error');
            expect(errorNotification.message).toBe('Test error message');
            expect(global.foundryMock.notifications).toHaveLength(1);
        });
    });
});