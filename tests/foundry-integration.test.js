/**
 * Integration tests for FoundryVTT integration components
 * Tests Requirements: 6.1-6.10, 8.7-8.8
 */

// Enhanced FoundryVTT Mock Environment
class MockFoundryVTTEnvironment {
    constructor() {
        this.settings = new Map();
        this.chatMessages = [];
        this.rolls = [];
        this.dialogs = [];
        this.notifications = [];
        this.hooks = new Map();
        this.actors = new Map();
        this.users = new Map();
        this.currentUser = null;
        this.system = { id: 'wfrp4e', version: '7.0.0' };
    }

    // Settings API
    registerSetting(module, key, options) {
        const settingKey = `${module}.${key}`;
        this.settings.set(settingKey, {
            ...options,
            value: options.default,
            module,
            key
        });
        return true;
    }

    getSetting(module, key) {
        const setting = this.settings.get(`${module}.${key}`);
        return setting ? setting.value : null;
    }

    async setSetting(module, key, value) {
        const settingKey = `${module}.${key}`;
        const setting = this.settings.get(settingKey);
        if (setting) {
            const oldValue = setting.value;
            setting.value = value;
            
            // Trigger setting change hook
            this.callHook('updateSetting', settingKey, value, oldValue);
            return true;
        }
        return false;
    }

    // Chat API
    async createChatMessage(data) {
        const message = {
            id: `msg-${Date.now()}-${Math.random()}`,
            content: data.content,
            whisper: data.whisper || [],
            type: data.type || 'other',
            timestamp: Date.now(),
            user: this.currentUser?.id || 'system',
            speaker: data.speaker || {},
            flavor: data.flavor || '',
            sound: data.sound || null
        };
        
        this.chatMessages.push(message);
        this.callHook('createChatMessage', message);
        return message;
    }

    // Dice API
    createRoll(formula, data = {}) {
        const mockResult = this.generateMockRoll(formula);
        const roll = {
            formula,
            data,
            total: mockResult.total,
            result: mockResult.result,
            dice: mockResult.dice,
            terms: mockResult.terms,
            evaluated: false,
            
            async evaluate(options = {}) {
                this.evaluated = true;
                return this;
            },
            
            async toMessage(messageData = {}) {
                const message = await global.foundryMock.createChatMessage({
                    content: this.getTooltip(),
                    type: 'roll',
                    roll: this,
                    ...messageData
                });
                return message;
            },
            
            getTooltip() {
                return `<div class="dice-roll">
                    <div class="dice-result">
                        <div class="dice-formula">${this.formula}</div>
                        <div class="dice-total">${this.total}</div>
                    </div>
                </div>`;
            }
        };
        
        this.rolls.push(roll);
        return roll;
    }

    generateMockRoll(formula) {
        // Simple mock roll generation
        if (formula.includes('d100')) {
            const total = Math.floor(Math.random() * 100) + 1;
            return {
                total,
                result: total.toString(),
                dice: [{ results: [{ result: total }] }],
                terms: [{ results: [{ result: total }] }]
            };
        } else if (formula.includes('d10')) {
            const total = Math.floor(Math.random() * 10) + 1;
            return {
                total,
                result: total.toString(),
                dice: [{ results: [{ result: total }] }],
                terms: [{ results: [{ result: total }] }]
            };
        }
        
        // Default to d100
        const total = Math.floor(Math.random() * 100) + 1;
        return {
            total,
            result: total.toString(),
            dice: [{ results: [{ result: total }] }],
            terms: [{ results: [{ result: total }] }]
        };
    }

    // Dialog API
    createDialog(data, options = {}) {
        const dialog = {
            id: `dialog-${Date.now()}`,
            data,
            options,
            rendered: false,
            closed: false,
            
            async render(force = false) {
                this.rendered = true;
                global.foundryMock.dialogs.push(this);
                return this;
            },
            
            async close() {
                this.closed = true;
                const index = global.foundryMock.dialogs.indexOf(this);
                if (index > -1) {
                    global.foundryMock.dialogs.splice(index, 1);
                }
                return this;
            }
        };
        
        return dialog;
    }

    // Notification API
    notify(message, type = 'info', options = {}) {
        const notification = {
            id: `notif-${Date.now()}`,
            message,
            type,
            timestamp: Date.now(),
            permanent: options.permanent || false,
            console: options.console !== false
        };
        
        this.notifications.push(notification);
        
        if (notification.console) {
            console.log(`${type.toUpperCase()}: ${message}`);
        }
        
        return notification;
    }

    // Hook system
    registerHook(event, callback) {
        if (!this.hooks.has(event)) {
            this.hooks.set(event, []);
        }
        this.hooks.get(event).push(callback);
    }

    callHook(event, ...args) {
        const callbacks = this.hooks.get(event) || [];
        const results = [];
        
        for (const callback of callbacks) {
            try {
                const result = callback(...args);
                results.push(result);
            } catch (error) {
                console.error(`Hook ${event} callback error:`, error);
            }
        }
        
        return results;
    }

    // Actor management
    createActor(data) {
        const actor = new MockActor(data);
        this.actors.set(actor.id, actor);
        return actor;
    }

    getActor(id) {
        return this.actors.get(id);
    }

    // User management
    createUser(data) {
        const user = {
            id: data.id || `user-${Date.now()}`,
            name: data.name || 'Test User',
            role: data.role || 'player',
            isGM: data.role === 'gamemaster'
        };
        this.users.set(user.id, user);
        return user;
    }

    setCurrentUser(userId) {
        this.currentUser = this.users.get(userId);
        return this.currentUser;
    }

    reset() {
        this.settings.clear();
        this.chatMessages = [];
        this.rolls = [];
        this.dialogs = [];
        this.notifications = [];
        this.hooks.clear();
        this.actors.clear();
        this.users.clear();
        this.currentUser = null;
    }
}

// Enhanced Mock Actor
class MockActor {
    constructor(data = {}) {
        this.id = data.id || `actor-${Date.now()}`;
        this.name = data.name || 'Test Actor';
        this.type = data.type || 'character';
        this.system = data.system || {
            money: { gc: 500, ss: 0, bp: 0 },
            skills: {
                haggle: { total: 40 },
                gossip: { total: 30 }
            }
        };
        this.items = new MockCollection();
        this.updateHistory = [];
        this.flags = data.flags || {};
        this.ownership = data.ownership || { default: 0 };
        this.prototypeToken = data.prototypeToken || {};
    }

    async update(data, options = {}) {
        this.updateHistory.push({
            data: { ...data },
            options: { ...options },
            timestamp: Date.now()
        });

        // Apply updates
        for (const [key, value] of Object.entries(data)) {
            this.setProperty(key, value);
        }

        // Trigger update hook
        global.foundryMock.callHook('updateActor', this, data, options);
        return this;
    }

    setProperty(path, value) {
        const keys = path.split('.');
        let current = this;
        for (let i = 0; i < keys.length - 1; i++) {
            if (!current[keys[i]]) current[keys[i]] = {};
            current = current[keys[i]];
        }
        current[keys[keys.length - 1]] = value;
    }

    getProperty(path) {
        const keys = path.split('.');
        let current = this;
        for (const key of keys) {
            if (current === null || current === undefined) return undefined;
            current = current[key];
        }
        return current;
    }

    async createEmbeddedDocuments(type, data, options = {}) {
        const timestamp = Date.now();
        const items = data.map((itemData, index) => new MockItem({
            id: `item-${timestamp}-${index}-${Math.random().toString(36).slice(2, 8)}`,
            ...itemData
        }));

        items.forEach(item => {
            item.parent = this;
            this.items.set(item.id, item);
        });

        global.foundryMock.callHook('createItem', items, options);
        return items;
    }

    async updateEmbeddedDocuments(type, updates, options = {}) {
        const updatedItems = [];
        
        for (const update of updates) {
            const item = this.items.get(update._id);
            if (item) {
                await item.update(update, options);
                updatedItems.push(item);
            }
        }

        global.foundryMock.callHook('updateItem', updatedItems, options);
        return updatedItems;
    }

    async deleteEmbeddedDocuments(type, ids, options = {}) {
        const deletedItems = [];
        
        for (const id of ids) {
            const item = this.items.get(id);
            if (item) {
                this.items.delete(id);
                deletedItems.push(item);
            }
        }

        global.foundryMock.callHook('deleteItem', deletedItems, options);
        return deletedItems;
    }

    testUserPermission(user, permission) {
        // Simple permission check
        if (user.isGM) return true;
        if (this.ownership[user.id] >= permission) return true;
        return this.ownership.default >= permission;
    }
}

// Enhanced Mock Item
class MockItem {
    constructor(data) {
        this.id = data.id || `item-${Date.now()}`;
        this.name = data.name || 'Test Item';
        this.type = data.type || 'equipment';
        this.system = data.system || {};
        this.flags = data.flags || {};
        this.parent = null;
        this.updateHistory = [];
    }

    async update(data, options = {}) {
        this.updateHistory.push({
            data: { ...data },
            options: { ...options },
            timestamp: Date.now()
        });

        // Apply updates
        for (const [key, value] of Object.entries(data)) {
            this.setProperty(key, value);
        }

        return this;
    }

    setProperty(path, value) {
        const keys = path.split('.');
        let current = this;
        for (let i = 0; i < keys.length - 1; i++) {
            if (!current[keys[i]]) current[keys[i]] = {};
            current = current[keys[i]];
        }
        current[keys[keys.length - 1]] = value;
    }

    getProperty(path) {
        const keys = path.split('.');
        let current = this;
        for (const key of keys) {
            if (current === null || current === undefined) return undefined;
            current = current[key];
        }
        return current;
    }

    async delete(options = {}) {
        if (this.parent) {
            this.parent.items.delete(this.id);
        }
        return this;
    }
}

// Mock Collection
class MockCollection extends Map {
    filter(callback) {
        const results = [];
        for (const [key, value] of this.entries()) {
            if (callback(value)) {
                results.push(value);
            }
        }
        return results;
    }

    find(callback) {
        for (const [key, value] of this.entries()) {
            if (callback(value)) {
                return value;
            }
        }
        return undefined;
    }

    map(callback) {
        const results = [];
        for (const [key, value] of this.entries()) {
            results.push(callback(value));
        }
        return results;
    }

    getName(name) {
        return this.find(item => item.name === name);
    }

    contents() {
        return Array.from(this.values());
    }
}

// Setup global environment
global.foundryMock = new MockFoundryVTTEnvironment();

global.game = {
    system: global.foundryMock.system,
    settings: {
        register: (module, key, options) => global.foundryMock.registerSetting(module, key, options),
        get: (module, key) => global.foundryMock.getSetting(module, key),
        set: (module, key, value) => global.foundryMock.setSetting(module, key, value)
    },
    user: null,
    users: global.foundryMock.users,
    actors: global.foundryMock.actors
};

global.ChatMessage = {
    create: (data) => global.foundryMock.createChatMessage(data)
};

global.Roll = class {
    constructor(formula, data = {}) {
        return global.foundryMock.createRoll(formula, data);
    }
};

global.Dialog = class {
    constructor(data, options = {}) {
        return global.foundryMock.createDialog(data, options);
    }
};

global.ui = {
    notifications: {
        info: (message, options) => global.foundryMock.notify(message, 'info', options),
        warn: (message, options) => global.foundryMock.notify(message, 'warn', options),
        error: (message, options) => global.foundryMock.notify(message, 'error', options)
    }
};

global.Hooks = {
    once: (event, callback) => global.foundryMock.registerHook(event, callback),
    on: (event, callback) => global.foundryMock.registerHook(event, callback),
    call: (event, ...args) => global.foundryMock.callHook(event, ...args),
    callAll: (event, ...args) => global.foundryMock.callHook(event, ...args)
};

global.CONST = {
    CHAT_MESSAGE_TYPES: {
        OTHER: 0,
        OOC: 1,
        IC: 2,
        EMOTE: 3,
        WHISPER: 4,
        ROLL: 5
    },
    CHAT_MESSAGE_STYLES: {
        OTHER: 0,
        ROLL: 5
    },
    DOCUMENT_OWNERSHIP_LEVELS: {
        NONE: 0,
        LIMITED: 1,
        OBSERVER: 2,
        OWNER: 3
    },
    USER_ROLES: {
        PLAYER: 1,
        TRUSTED: 2,
        ASSISTANT: 3,
        GAMEMASTER: 4
    }
};

const GC_TO_BP = (gc) => gc * 240;

// Import modules
const SystemAdapter = require('../scripts/system-adapter.js');
const DataManager = require('../scripts/data-manager.js');
const { TradingEngine } = require('../scripts/trading-engine.js');

describe('FoundryVTT Integration Components Tests', () => {
    let systemAdapter;
    let dataManager;
    let tradingEngine;
    let testActor;
    let gmUser;
    let playerUser;

    beforeEach(() => {
        // Reset mock environment
        global.foundryMock.reset();
        
        // Create test users
        gmUser = global.foundryMock.createUser({
            id: 'gm-user',
            name: 'Game Master',
            role: 'gamemaster'
        });
        
        playerUser = global.foundryMock.createUser({
            id: 'player-user',
            name: 'Player',
            role: 'player'
        });
        
        global.foundryMock.setCurrentUser(gmUser.id);
        global.game.user = gmUser;
        
        // Initialize components
        systemAdapter = new SystemAdapter();
        dataManager = new DataManager();
        tradingEngine = new TradingEngine(dataManager);
        
        // Create test actor
        testActor = global.foundryMock.createActor({
            id: 'test-actor',
            name: 'Test Trader',
            system: {
                money: { gc: 1000, ss: 0, bp: 0 },
                skills: {
                    haggle: { total: 45 },
                    gossip: { total: 35 }
                }
            }
        });
        
        // Register module settings
        global.foundryMock.registerSetting('trading-places', 'activeDataset', {
            name: 'Active Dataset',
            scope: 'world',
            config: true,
            type: String,
            default: 'wfrp4e-default'
        });
        
        global.foundryMock.registerSetting('trading-places', 'currentSeason', {
            name: 'Current Season',
            scope: 'world',
            config: true,
            type: String,
            default: 'spring'
        });
        
        global.foundryMock.registerSetting('trading-places', 'chatVisibility', {
            name: 'Chat Visibility',
            scope: 'world',
            config: true,
            type: String,
            default: 'gm'
        });
        
            global.foundryMock.registerSetting('trading-places', 'currentSeason', {
                name: 'Current Season (Internal)',
                scope: 'world',
                config: false,
                type: String,
                default: 'spring'
            });
        
            global.foundryMock.registerSetting('trading-places', 'activeDataset', {
                name: 'Active Dataset (Internal)',
                scope: 'world',
                config: false,
                type: String,
                default: 'wfrp4e'
            });

            global.foundryMock.registerSetting('trading-places', 'datasetInfo', {
                name: 'Dataset Info',
                scope: 'world',
                config: false,
                type: Object,
                default: null
            });
    });

    describe('SystemAdapter Currency and Inventory Manipulation', () => {
        test('should properly manipulate actor currency through FoundryVTT API', async () => {
            // Requirements: 6.2, 6.3
            
            // Test getting currency value
            const initialCurrency = systemAdapter.getCurrencyValue(testActor);
            expect(initialCurrency).toBe(GC_TO_BP(1000));
            
            // Test currency deduction
            const deductResult = await systemAdapter.deductCurrency(testActor, GC_TO_BP(250), 'Test purchase');
            
            expect(deductResult.success).toBe(true);
            expect(deductResult.currentAmount).toBe(GC_TO_BP(1000));
            expect(deductResult.newAmount).toBe(GC_TO_BP(750));
            expect(deductResult.amountDeducted).toBe(GC_TO_BP(250));
            
            // Verify actor was actually updated
            expect(testActor.system.money.gc).toBe(750);
            expect(testActor.system.money.ss || 0).toBe(0);
            expect(testActor.system.money.bp || 0).toBe(0);
            expect(testActor.updateHistory).toHaveLength(1);
            expect(testActor.updateHistory[0].data).toMatchObject({
                system: {
                    money: {
                        gc: 750,
                        ss: 0,
                        bp: 0
                    }
                }
            });
            
            // Test currency addition
            const addResult = await systemAdapter.addCurrency(testActor, GC_TO_BP(150), 'Test sale');
            
            expect(addResult.success).toBe(true);
            expect(addResult.amountAdded).toBe(GC_TO_BP(150));
            expect(testActor.system.money.gc).toBe(900);
            expect(testActor.system.money.ss || 0).toBe(0);
            expect(testActor.system.money.bp || 0).toBe(0);
            
            // Test insufficient funds
            const insufficientResult = await systemAdapter.deductCurrency(testActor, GC_TO_BP(1500), 'Expensive item');
            
            expect(insufficientResult.success).toBe(false);
            expect(insufficientResult.error).toContain('Insufficient currency');
            expect(testActor.system.money.gc).toBe(900); // Should remain unchanged
        });

        test('should properly manipulate actor inventory through FoundryVTT API', async () => {
            // Requirements: 6.2, 6.3
            
            const cargoData = {
                category: 'Agriculture',
                encumbrancePerUnit: 1
            };
            
            const purchaseInfo = {
                pricePerUnit: 15,
                totalPrice: 300,
                quality: 'good',
                season: 'spring',
                settlement: 'Ubersreik'
            };
            
            // Test adding cargo to inventory
            const addResult = await systemAdapter.addCargoToInventory(
                testActor,
                'Wine',
                20,
                cargoData,
                purchaseInfo
            );
            
            expect(addResult.success).toBe(true);
            expect(addResult.itemId).toBeDefined();
            expect(addResult.cargoName).toBe('Wine');
            expect(addResult.quantity).toBe(20);
            
            // Verify item was actually added
            expect(testActor.items.size).toBe(1);
            const addedItem = testActor.items.get(addResult.itemId);
            expect(addedItem).toBeDefined();
            expect(addedItem.name).toBe('Wine (good)');
            expect(addedItem.system.quantity.value).toBe(20);
            expect(addedItem.system.tradingData.isTradingCargo).toBe(true);
            expect(addedItem.system.purchaseLocation).toBe('Ubersreik');
            
            // Test finding cargo in inventory
            const foundCargo = systemAdapter.findCargoInInventory(testActor, 'Wine');
            expect(foundCargo).toHaveLength(1);
            expect(foundCargo[0].id).toBe(addResult.itemId);
            
            // Test getting total cargo quantity
            const totalQuantity = systemAdapter.getTotalCargoQuantity(testActor, 'Wine');
            expect(totalQuantity).toBe(20);
            
            // Test removing cargo from inventory (partial)
            const removeResult = await systemAdapter.removeCargoFromInventory(testActor, addResult.itemId, 8);
            
            expect(removeResult.success).toBe(true);
            expect(removeResult.removedQuantity).toBe(8);
            expect(removeResult.remainingQuantity).toBe(12);
            expect(removeResult.itemRemoved).toBe(false);
            
            // Verify quantity was updated
            const updatedItem = testActor.items.get(addResult.itemId);
            expect(updatedItem.system.quantity.value).toBe(12);
            
            // Test complete removal
            const completeRemoveResult = await systemAdapter.removeCargoFromInventory(testActor, addResult.itemId);
            
            expect(completeRemoveResult.success).toBe(true);
            expect(completeRemoveResult.itemRemoved).toBe(true);
            expect(testActor.items.size).toBe(0);
        });

        test('should handle inventory operations with multiple cargo types', async () => {
            // Requirements: 6.2, 6.3
            
            // Add multiple different cargo types
            const cargoTypes = [
                { name: 'Wine', quantity: 30, quality: 'good' },
                { name: 'Grain', quantity: 50, quality: 'average' },
                { name: 'Wine', quantity: 20, quality: 'excellent' }
            ];
            
            const addedItems = [];
            
            for (const cargo of cargoTypes) {
                const result = await systemAdapter.addCargoToInventory(
                    testActor,
                    cargo.name,
                    cargo.quantity,
                    { category: 'Test', encumbrancePerUnit: 1 },
                    { quality: cargo.quality, pricePerUnit: 10 }
                );
                addedItems.push(result);
            }

            addedItems.forEach(result => expect(result.success).toBe(true));
            
            expect(testActor.items.size).toBe(3);
            
            // Test finding specific quality wine
            const goodWine = systemAdapter.findCargoInInventory(testActor, 'Wine', { quality: 'good' });
            expect(goodWine).toHaveLength(1);
            expect(goodWine[0].system.quality).toBe('good');
            
            const excellentWine = systemAdapter.findCargoInInventory(testActor, 'Wine', { quality: 'excellent' });
            expect(excellentWine).toHaveLength(1);
            expect(excellentWine[0].system.quality).toBe('excellent');
            
            // Test total wine quantity (both qualities)
            const totalWine = systemAdapter.getTotalCargoQuantity(testActor, 'Wine');
            expect(totalWine).toBe(50); // 30 + 20
            
            // Test total grain quantity
            const totalGrain = systemAdapter.getTotalCargoQuantity(testActor, 'Grain');
            expect(totalGrain).toBe(50);
            
            // Test inventory summary
            const summary = systemAdapter.getInventorySummary(testActor);
            expect(summary.totalItems).toBe(3);
            expect(summary.cargoItems).toHaveLength(3);
            expect(summary.currency).toBe(GC_TO_BP(1000));
            expect(typeof summary.totalCargoValue).toBe('number');
        });
    });

    describe('Dice Rolling Integration and Chat Messages', () => {
        test('should produce correct chat messages for dice rolls', async () => {
            // Requirements: 6.7, 6.8, 6.9
            
            // Test basic dice roll
            const roll = new Roll('1d100');
            await roll.evaluate();
            
            expect(roll.evaluated).toBe(true);
            expect(roll.total).toBeGreaterThanOrEqual(1);
            expect(roll.total).toBeLessThanOrEqual(100);
            
            // Test roll to chat
            const chatMessage = await roll.toMessage({
                flavor: 'Cargo Availability Check',
                whisper: [gmUser.id]
            });
            
            expect(chatMessage).toBeDefined();
            expect(chatMessage.content).toContain(roll.total.toString());
            expect(chatMessage.whisper).toContain(gmUser.id);
            expect(chatMessage.type).toBe('roll');
            
            // Verify message was added to chat
            expect(global.foundryMock.chatMessages).toHaveLength(1);
            expect(global.foundryMock.chatMessages[0].id).toBe(chatMessage.id);
            
            // Test trading engine dice integration
            const settlement = {
                region: 'Empire',
                name: 'Ubersreik',
                size: 'T',
                wealth: 3,
                source: ['Trade', 'Wine'],
                ruler: 'Count Marius Leitdorf',
                population: 5000,
                notes: 'A prosperous town known for its trade.'
            };
            
            // Mock dice roll for availability check
            const availabilityResult = tradingEngine.checkCargoAvailability(settlement, () => 45);
            
            expect(availabilityResult.available).toBe(true);
            expect(availabilityResult.roll).toBe(45);
            expect(availabilityResult.chance).toBe(60);
            
            // Verify chat messages were created for rolls
            expect(global.foundryMock.chatMessages.length).toBeGreaterThan(0);
        });

        test('should handle chat visibility settings correctly', async () => {
            // Requirements: 6.5, 6.8, 6.9
            
            // Test GM-only visibility
            await global.foundryMock.setSetting('trading-places', 'chatVisibility', 'gm');
            
            const gmOnlyRoll = new Roll('1d100');
            await gmOnlyRoll.evaluate();
            
            const gmMessage = await gmOnlyRoll.toMessage({
                flavor: 'GM Only Roll',
                whisper: global.foundryMock.getSetting('trading-places', 'chatVisibility') === 'gm' ? [gmUser.id] : null
            });
            
            expect(gmMessage.whisper).toContain(gmUser.id);
            expect(gmMessage.whisper).toHaveLength(1);
            
            // Test public visibility
            await global.foundryMock.setSetting('trading-places', 'chatVisibility', 'all');
            
            const publicRoll = new Roll('1d100');
            await publicRoll.evaluate();
            
            const publicMessage = await publicRoll.toMessage({
                flavor: 'Public Roll',
                whisper: global.foundryMock.getSetting('trading-places', 'chatVisibility') === 'gm' ? [gmUser.id] : null
            });
            
            expect(publicMessage.whisper).toHaveLength(0);
            
            // Test transaction result messages
            const transactionMessage = await ChatMessage.create({
                content: `
                    <div class="trading-result">
                        <h3>Trade Completed</h3>
                        <p><strong>Settlement:</strong> Ubersreik</p>
                        <p><strong>Cargo:</strong> Wine (20 EP)</p>
                        <p><strong>Final Price:</strong> 300 GC</p>
                    </div>
                `,
                type: CONST.CHAT_MESSAGE_STYLES.OTHER,
                whisper: global.foundryMock.getSetting('trading-places', 'chatVisibility') === 'gm' ? [gmUser.id] : []
            });
            
            expect(transactionMessage.content).toContain('Trade Completed');
            expect(transactionMessage.content).toContain('Ubersreik');
            expect(transactionMessage.content).toContain('Wine');
        });

        test('should display dice roll results with proper formatting', async () => {
            // Requirements: 6.8, 6.9
            
            // Test availability roll formatting
            const availabilityRoll = new Roll('1d100');
            await availabilityRoll.evaluate();
            
            const availabilityMessage = await availabilityRoll.toMessage({
                flavor: `Cargo Availability Check (need ≤ 60)`,
                speaker: { alias: testActor.name }
            });
            
            expect(availabilityMessage.content).toContain('1d100');
            expect(availabilityMessage.content).toContain(availabilityRoll.total.toString());
            expect(availabilityMessage.flavor).toContain('Cargo Availability Check');
            
            // Test cargo size roll formatting
            const sizeRoll = new Roll('1d100');
            await sizeRoll.evaluate();
            
            const sizeMessage = await sizeRoll.toMessage({
                flavor: `Cargo Size Determination (Trade Settlement Bonus)`,
                speaker: { alias: 'Trading System' }
            });
            
            expect(sizeMessage.content).toContain('1d100');
            expect(sizeMessage.flavor).toContain('Cargo Size Determination');
            
            // Test haggle roll formatting
            const haggleRoll = new Roll('1d100');
            await haggleRoll.evaluate();
            
            const haggleMessage = await haggleRoll.toMessage({
                flavor: `Haggle Test: Player (45) vs Merchant (40)`,
                speaker: { alias: testActor.name }
            });
            
            expect(haggleMessage.flavor).toContain('Haggle Test');
            expect(haggleMessage.flavor).toContain('Player (45)');
            expect(haggleMessage.flavor).toContain('Merchant (40)');
            
            // Test failure message formatting
            const failureMessage = await ChatMessage.create({
                content: `
                    <div class="trading-error">
                        <h3>Trading Error</h3>
                        <p><strong>Error:</strong> Insufficient currency for purchase</p>
                        <p><strong>Required:</strong> 500 GC</p>
                        <p><strong>Available:</strong> 250 GC</p>
                    </div>
                `,
                type: CONST.CHAT_MESSAGE_STYLES.OTHER
            });
            
            expect(failureMessage.content).toContain('Trading Error');
            expect(failureMessage.content).toContain('Insufficient currency');
        });
    });

    describe('Settings Persistence and Retrieval', () => {
        test('should persist and retrieve settings across module reloads', async () => {
            // Requirements: 6.1, 5.1, 5.2
            
            // Test initial default values
            expect(global.foundryMock.getSetting('trading-places', 'activeDataset')).toBe('wfrp4e-default');
            expect(global.foundryMock.getSetting('trading-places', 'currentSeason')).toBe('spring');
            expect(global.foundryMock.getSetting('trading-places', 'chatVisibility')).toBe('gm');
            
            // Test setting updates
            await global.foundryMock.setSetting('trading-places', 'currentSeason', 'winter');
            expect(global.foundryMock.getSetting('trading-places', 'currentSeason')).toBe('winter');
            
            await global.foundryMock.setSetting('trading-places', 'chatVisibility', 'all');
            expect(global.foundryMock.getSetting('trading-places', 'chatVisibility')).toBe('all');
            
            await global.foundryMock.setSetting('trading-places', 'activeDataset', 'custom-dataset');
            expect(global.foundryMock.getSetting('trading-places', 'activeDataset')).toBe('custom-dataset');
            
            // Test season persistence in trading engine
            await tradingEngine.setCurrentSeason('autumn');
            expect(tradingEngine.getCurrentSeason()).toBe('autumn');
            expect(global.foundryMock.getSetting('trading-places', 'currentSeason')).toBe('autumn');
            expect(global.foundryMock.getSetting('trading-places', 'currentSeason')).toBe('winter');
            
            // Simulate module reload by creating new trading engine
            const newTradingEngine = new TradingEngine(dataManager);
            expect(newTradingEngine.getCurrentSeason()).toBe('autumn'); // Should load from settings
            
            // Test setting validation
            const validSeasons = ['spring', 'summer', 'autumn', 'winter'];
            for (const season of validSeasons) {
                await tradingEngine.setCurrentSeason(season);
                expect(tradingEngine.getCurrentSeason()).toBe(season);
            }
            
            // Test invalid season handling
            expect(() => {
                tradingEngine.validateSeason('invalid-season');
            }).toThrow('Invalid season: invalid-season');
        });

        test('should handle setting change notifications', async () => {
            // Requirements: 5.2, 5.3
            
            let changeNotifications = [];
            
            // Register hook for setting changes
            global.foundryMock.registerHook('updateSetting', (settingKey, newValue, oldValue) => {
                changeNotifications.push({ settingKey, newValue, oldValue });
            });
            
            // Change season setting
            await global.foundryMock.setSetting('trading-places', 'currentSeason', 'summer');
            
            expect(changeNotifications).toHaveLength(1);
            expect(changeNotifications[0].settingKey).toBe('trading-places.currentSeason');
            expect(changeNotifications[0].newValue).toBe('summer');
            expect(changeNotifications[0].oldValue).toBe('spring');
            
            // Change chat visibility
            await global.foundryMock.setSetting('trading-places', 'chatVisibility', 'all');
            
            expect(changeNotifications).toHaveLength(2);
            expect(changeNotifications[1].settingKey).toBe('trading-places.chatVisibility');
            expect(changeNotifications[1].newValue).toBe('all');
            expect(changeNotifications[1].oldValue).toBe('gm');
            
            // Test season change notifications in UI
            const initialNotificationCount = global.foundryMock.notifications.length;
            
            await tradingEngine.setCurrentSeason('winter');
            
            // Should have triggered a notification
            expect(global.foundryMock.notifications.length).toBeGreaterThan(initialNotificationCount);
            
            const seasonNotification = global.foundryMock.notifications.find(n => 
                n.message.includes('Trading season changed to winter')
            );
            expect(seasonNotification).toBeDefined();
            expect(seasonNotification.type).toBe('info');
        });

        test('should handle setting migration and validation', async () => {
            // Requirements: 6.1, 8.7, 8.8
            
            // Test setting with invalid value
            const invalidSetting = await global.foundryMock.setSetting('trading-places', 'currentSeason', 'invalid');
            expect(invalidSetting).toBe(true); // Setting was stored
            
            // But validation should catch it
            expect(() => {
                tradingEngine.validateSeason('invalid');
            }).toThrow('Invalid season: invalid');
            
            // Test setting migration (simulate old format)
            await global.foundryMock.setSetting('trading-places', 'currentSeason', 'Spring'); // Capitalized
            
            // Migration should normalize it
            const normalizedSeason = tradingEngine.normalizeSeason('Spring');
            expect(normalizedSeason).toBe('spring');
            
            // Test missing setting handling
            const missingSetting = global.foundryMock.getSetting('trading-places', 'nonexistent');
            expect(missingSetting).toBeNull();
            
            // Test setting with complex object value
            const complexSetting = {
                dataset: 'custom',
                version: '1.0.0',
                lastModified: Date.now()
            };
            
            await global.foundryMock.setSetting('trading-places', 'datasetInfo', complexSetting);
            const retrievedSetting = global.foundryMock.getSetting('trading-places', 'datasetInfo');
            
            expect(retrievedSetting).toEqual(complexSetting);
            expect(retrievedSetting.dataset).toBe('custom');
            expect(retrievedSetting.version).toBe('1.0.0');
        });
    });

    describe('Error Handling Integration', () => {
        test('should handle FoundryVTT API errors gracefully', async () => {
            // Requirements: 6.10, 8.7, 8.8
            
            // Test actor update failure
            const failingActor = new MockActor();
            failingActor.update = async () => {
                throw new Error('Database connection failed');
            };
            
            const updateResult = await systemAdapter.deductCurrency(failingActor, 100, 'Test').catch(error => ({
                success: false,
                error: error.message
            }));
            
            expect(updateResult.success).toBe(false);
            expect(updateResult.error).toContain('Database connection failed');
            
            // Test item creation failure
            const failingItemActor = new MockActor();
            failingItemActor.createEmbeddedDocuments = async () => {
                throw new Error('Item creation failed');
            };
            
            const itemResult = await systemAdapter.addCargoToInventory(
                failingItemActor,
                'Wine',
                10,
                { category: 'Test' },
                { pricePerUnit: 15 }
            ).catch(error => ({
                success: false,
                error: error.message
            }));
            
            expect(itemResult.success).toBe(false);
            expect(itemResult.error).toContain('Item creation failed');
            
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
            expect(chatResult.error).toContain('Chat service unavailable');
            
            // Restore original function
            ChatMessage.create = originalCreate;
            
            // Test roll failure
            const originalRoll = Roll;
            global.Roll = class {
                constructor() {
                    throw new Error('Dice system unavailable');
                }
            };
            
            expect(() => {
                new Roll('1d100');
            }).toThrow('Dice system unavailable');
            
            // Restore original Roll
            global.Roll = originalRoll;
        });

        test('should provide clear error messages for common failures', async () => {
            // Requirements: 6.4, 6.10
            
            // Test missing actor properties
            const incompleteActor = new MockActor({
                system: {} // Missing money property
            });
            
            const currencyValue = systemAdapter.getCurrencyValue(incompleteActor);
            expect(currencyValue).toBeNull();
            
            const validation = systemAdapter.validateActor(incompleteActor);
            expect(validation.valid).toBe(false);
            expect(validation.errors).toContain(`Required field 'system.money' not found on actor`);
            
            // Test invalid transaction data
            const invalidTransaction = systemAdapter.validateTransaction(testActor, 'purchase', {
                // Missing required fields
            });
            
            expect(invalidTransaction.valid).toBe(false);
            expect(invalidTransaction.errors.length).toBeGreaterThan(0);
            
            // Test system compatibility errors
            const originalGame = global.game;
            global.game = undefined;
            
            const compatibility = new SystemAdapter().validateSystemCompatibility();
            expect(compatibility.compatible).toBe(false);
            expect(compatibility.errors).toContain('SystemAdapter requires FoundryVTT environment');
            
            // Restore system
            global.game = originalGame;
            
            // Test permission errors
            global.foundryMock.setCurrentUser(playerUser.id);
            global.game.user = playerUser;
            
            // Player trying to access GM-only functionality
            const restrictedOperation = systemAdapter.validateUserPermissions(playerUser, 'gm-only-operation');
            expect(restrictedOperation.allowed).toBe(false);
            expect(restrictedOperation.reason).toContain('Insufficient permissions');
        });

        test('should handle component integration failures', async () => {
            // Requirements: 8.7, 8.8
            
            // Test DataManager failure
            const failingDataManager = new DataManager();
            failingDataManager.getSettlement = () => {
                throw new Error('Data corruption detected');
            };
            
            const failingEngine = new TradingEngine(failingDataManager);
            
            expect(() => {
                failingEngine.checkCargoAvailability({ name: 'Test' });
            }).toThrow('Invalid settlement');
            
            // Test SystemAdapter configuration failure
            const invalidAdapter = new SystemAdapter();
            invalidAdapter.config.currency = null;
            invalidAdapter.currencyFieldMap = null;
            invalidAdapter.config.inventory = null;
            
            const adapterCompatibility = invalidAdapter.validateSystemCompatibility();
            expect(adapterCompatibility.compatible).toBe(false);
            expect(adapterCompatibility.errors).toContain('Currency field configuration missing');
            expect(adapterCompatibility.errors).toContain('Inventory field configuration missing');
            
            // Test hook registration failure
            const originalRegisterHook = global.foundryMock.registerHook;
            global.foundryMock.registerHook = () => {
                throw new Error('Hook system unavailable');
            };
            
            expect(() => {
                global.foundryMock.registerHook('test', () => {});
            }).toThrow('Hook system unavailable');
            
            // Restore original function
            global.foundryMock.registerHook = originalRegisterHook;
            
            // Test notification system failure
            const originalNotify = global.foundryMock.notify;
            global.foundryMock.notify = () => {
                throw new Error('Notification system failed');
            };
            
            expect(() => {
                ui.notifications.info('Test message');
            }).toThrow('Notification system failed');
            
            // Restore original function
            global.foundryMock.notify = originalNotify;
        });
    });

    describe('User Permission and Access Control', () => {
        test('should respect user permissions for trading operations', async () => {
            // Requirements: 6.1, 6.10
            
            // Test GM permissions
            global.foundryMock.setCurrentUser(gmUser.id);
            global.game.user = gmUser;
            
            const gmPermissions = systemAdapter.validateUserPermissions(gmUser, 'modify-settings');
            expect(gmPermissions.allowed).toBe(true);
            
            const gmTradePermissions = systemAdapter.validateUserPermissions(gmUser, 'execute-trade');
            expect(gmTradePermissions.allowed).toBe(true);
            
            // Test player permissions
            global.foundryMock.setCurrentUser(playerUser.id);
            global.game.user = playerUser;
            
            const playerSettingsPermissions = systemAdapter.validateUserPermissions(playerUser, 'modify-settings');
            expect(playerSettingsPermissions.allowed).toBe(false);
            expect(playerSettingsPermissions.reason).toContain('Only GM can modify settings');
            
            const playerTradePermissions = systemAdapter.validateUserPermissions(playerUser, 'execute-trade');
            expect(playerTradePermissions.allowed).toBe(true); // Players can trade
            
            // Test actor ownership
            const playerOwnedActor = new MockActor({
                ownership: {
                    [playerUser.id]: CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER,
                    default: CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE
                }
            });
            
            const ownershipCheck = playerOwnedActor.testUserPermission(playerUser, CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER);
            expect(ownershipCheck).toBe(true);
            
            const otherPlayerCheck = playerOwnedActor.testUserPermission(gmUser, CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER);
            expect(otherPlayerCheck).toBe(true); // GM has all permissions
            
            // Test limited permissions
            const limitedActor = new MockActor({
                ownership: {
                    [playerUser.id]: CONST.DOCUMENT_OWNERSHIP_LEVELS.LIMITED,
                    default: CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE
                }
            });
            
            const limitedCheck = limitedActor.testUserPermission(playerUser, CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER);
            expect(limitedCheck).toBe(false);
            
            const limitedObserverCheck = limitedActor.testUserPermission(playerUser, CONST.DOCUMENT_OWNERSHIP_LEVELS.LIMITED);
            expect(limitedObserverCheck).toBe(true);
        });

        test('should handle chat message visibility based on user permissions', async () => {
            // Requirements: 6.5, 6.8
            
            // Test GM-only messages
            await global.foundryMock.setSetting('trading-places', 'chatVisibility', 'gm');
            
            const gmOnlyMessage = await ChatMessage.create({
                content: 'GM Only Trading Information',
                whisper: [gmUser.id]
            });
            
            expect(gmOnlyMessage.whisper).toContain(gmUser.id);
            expect(gmOnlyMessage.whisper).not.toContain(playerUser.id);
            
            // Test public messages
            await global.foundryMock.setSetting('trading-places', 'chatVisibility', 'all');
            
            const publicMessage = await ChatMessage.create({
                content: 'Public Trading Information',
                whisper: []
            });
            
            expect(publicMessage.whisper).toHaveLength(0);
            
            // Test selective whispers
            const selectiveMessage = await ChatMessage.create({
                content: 'Selective Trading Information',
                whisper: [gmUser.id, playerUser.id]
            });
            
            expect(selectiveMessage.whisper).toContain(gmUser.id);
            expect(selectiveMessage.whisper).toContain(playerUser.id);
            expect(selectiveMessage.whisper).toHaveLength(2);
        });
    });

    describe('Module Lifecycle and Hooks', () => {
        test('should properly initialize and register with FoundryVTT hooks', async () => {
            // Requirements: 6.1
            
            let initHookCalled = false;
            let readyHookCalled = false;
            
            // Register lifecycle hooks
            global.foundryMock.registerHook('init', () => {
                initHookCalled = true;
                
                // Register settings during init
                global.foundryMock.registerSetting('trading-places', 'testSetting', {
                    name: 'Test Setting',
                    scope: 'world',
                    config: true,
                    type: String,
                    default: 'test'
                });
            });
            
            global.foundryMock.registerHook('ready', () => {
                readyHookCalled = true;
                
                // Initialize components during ready
                const adapter = new SystemAdapter();
                const compatibility = adapter.validateSystemCompatibility();
                expect(compatibility.compatible).toBe(true);
            });
            
            // Simulate FoundryVTT initialization
            global.foundryMock.callHook('init');
            expect(initHookCalled).toBe(true);
            expect(global.foundryMock.getSetting('trading-places', 'testSetting')).toBe('test');
            
            global.foundryMock.callHook('ready');
            expect(readyHookCalled).toBe(true);
            
            // Test hook registration for trading events
            let tradeHookCalled = false;
            let tradeData = null;
            
            global.foundryMock.registerHook('trading-places.tradeCompleted', (data) => {
                tradeHookCalled = true;
                tradeData = data;
            });
            
            // Simulate trade completion
            global.foundryMock.callHook('trading-places.tradeCompleted', {
                actor: testActor.id,
                cargo: 'Wine',
                quantity: 20,
                settlement: 'Ubersreik',
                type: 'purchase'
            });
            
            expect(tradeHookCalled).toBe(true);
            expect(tradeData.cargo).toBe('Wine');
            expect(tradeData.type).toBe('purchase');
        });

        test('should handle module updates and migrations', async () => {
            // Requirements: 6.1, 8.7
            
            global.foundryMock.registerSetting('trading-places', 'version', {
                name: 'Module Version',
                scope: 'world',
                config: false,
                type: String,
                default: '1.0.0'
            });

            global.foundryMock.registerSetting('trading-places', 'oldFormatSetting', {
                name: 'Old Format Setting',
                scope: 'world',
                config: false,
                type: String,
                default: null
            });

            // Simulate old version settings
            await global.foundryMock.setSetting('trading-places', 'version', '0.9.0');
            await global.foundryMock.setSetting('trading-places', 'oldFormatSetting', 'old-value');
            
            // Register migration hook
            let migrationRan = false;
            global.foundryMock.registerHook('trading-places.migrate', (fromVersion, toVersion) => {
                migrationRan = true;
                
                if (fromVersion === '0.9.0' && toVersion === '1.0.0') {
                    // Migrate old format setting
                    const oldValue = global.foundryMock.getSetting('trading-places', 'oldFormatSetting');
                    global.foundryMock.registerSetting('trading-places', 'newFormatSetting', {
                        name: 'Migrated Setting',
                        scope: 'world',
                        config: false,
                        type: String,
                        default: null
                    });
                    global.foundryMock.setSetting('trading-places', 'newFormatSetting', `migrated-${oldValue}`);
                }
            });
            
            // Simulate module update
            global.foundryMock.callHook('trading-places.migrate', '0.9.0', '1.0.0');
            
            expect(migrationRan).toBe(true);
            expect(global.foundryMock.getSetting('trading-places', 'newFormatSetting')).toBe('migrated-old-value');
            
            // Update version
            await global.foundryMock.setSetting('trading-places', 'version', '1.0.0');
            expect(global.foundryMock.getSetting('trading-places', 'version')).toBe('1.0.0');
        });
    });
});