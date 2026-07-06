/**
 * Unit tests for SystemAdapter - Currency and Inventory Management
 */

// Mock FoundryVTT environment
class MockActor {
    constructor(data = {}) {
        this.id = data.id || 'test-actor-id';
        this.name = data.name || 'Test Actor';
        this.type = data.type || 'character';
        this.system = data.system || {
            money: { gc: 0, ss: 0, bp: 0 }
        };
        this.items = new MockCollection(data.items || []);
        this.updateData = null;
    }

    async update(data) {
        this.updateData = data;
        // Simulate updating nested properties
        for (const [key, value] of Object.entries(data)) {
            this.setNestedProperty(this, key, value);
        }
        return this;
    }

    setNestedProperty(obj, path, value) {
        const keys = path.split('.');
        const lastKey = keys.pop();
        const target = keys.reduce((current, key) => {
            if (!current[key]) current[key] = {};
            return current[key];
        }, obj);
        target[lastKey] = value;
    }

    async createEmbeddedDocuments(type, data) {
        const items = data.map((itemData, index) => ({
            id: `item-${Date.now()}-${index}`,
            ...itemData
        }));

        items.forEach(item => this.items.set(item.id, item));
        return items;
    }

    async deleteEmbeddedDocuments(type, ids) {
        ids.forEach(id => this.items.delete(id));
        return ids;
    }
}

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
}

class MockItem {
    constructor(data) {
        this.id = data.id;
        this.name = data.name;
        this.type = data.type;
        this.system = data.system;
        this.updateData = null;
    }

    async update(data) {
        this.updateData = data;
        // Simulate updating nested properties
        for (const [key, value] of Object.entries(data)) {
            this.setNestedProperty(this, key, value);
        }
        return this;
    }

    setNestedProperty(obj, path, value) {
        const keys = path.split('.');
        const lastKey = keys.pop();
        const target = keys.reduce((current, key) => {
            if (!current[key]) current[key] = {};
            return current[key];
        }, obj);
        target[lastKey] = value;
    }
}

const SystemAdapter = require('../scripts/system-adapter.js');

describe('SystemAdapter Configuration', () => {
    test('default configuration', () => {
        const adapter = new SystemAdapter();
        const config = adapter.getDefaultConfig();

        expect(config.currency.field).toBe('system.money.gc');
        expect(config.currency.fields.GC).toBe('system.money.gc');
        expect(config.currency.fields.SS).toBe('system.money.ss');
        expect(config.currency.fields.BP).toBe('system.money.bp');
        expect(config.inventory.field).toBe('items');
        expect(config.inventory.method).toBe('createEmbeddedDocuments');
    });

    test('custom configuration', () => {
        const customConfig = {
            currency: {
                field: 'system.currency.gold',
                fields: {
                    GC: 'system.currency.gold',
                    SS: 'system.currency.silver',
                    BP: 'system.currency.copper'
                },
                type: 'number',
                label: 'Gold Pieces'
            },
            inventory: {
                field: 'inventory',
                method: 'addItem',
                type: 'equipment'
            }
        };

        const customAdapter = new SystemAdapter(customConfig);

        expect(customAdapter.config.currency.field).toBe('system.currency.gold');
        expect(customAdapter.config.currency.fields.SS).toBe('system.currency.silver');
        expect(customAdapter.config.currency.fields.BP).toBe('system.currency.copper');
        expect(customAdapter.config.inventory.method).toBe('addItem');
    });

    test('system compatibility validation', () => {
        global.game = {
            system: { id: 'wfrp4e' }
        };

        const wfrpAdapter = new SystemAdapter();
        const compatibility = wfrpAdapter.validateSystemCompatibility();

        expect(compatibility.compatible).toBe(true);
        expect(compatibility.systemId).toBe('wfrp4e');
        expect(compatibility.errors.length).toBe(0);
    });
});

describe('SystemAdapter Currency Operations', () => {
    beforeEach(() => {
        global.game = {
            system: { id: 'wfrp4e' }
        };
    });

    test('get currency value', () => {
        const adapter = new SystemAdapter();
        const actor = new MockActor({
            system: { money: { gc: 0, ss: 12, bp: 6 } }
        });

        const currencyValue = adapter.getCurrencyValue(actor);
        expect(currencyValue).toBe(150);

        const actorNoCurrency = new MockActor({
            system: { other: 'data' }
        });
        const noCurrencyValue = adapter.getCurrencyValue(actorNoCurrency);
        expect(noCurrencyValue).toBeNull();
    });

    test('check sufficient currency', () => {
        const adapter = new SystemAdapter();
        const actor = new MockActor({
            system: { money: { gc: 0, ss: 12, bp: 6 } }
        });

        expect(adapter.hasSufficientCurrency(actor, 100)).toBe(true);
        expect(adapter.hasSufficientCurrency(actor, 200)).toBe(false);
    });

    test('deduct currency', async () => {
        const adapter = new SystemAdapter();
        const actor = new MockActor({
            system: { money: { gc: 5, ss: 0, bp: 0 } }
        });

        // deductCurrency's `amount` is denominated in GC (primary denomination),
        // converted internally to canonical BP (1 GC = 240 BP)
        const result = await adapter.deductCurrency(actor, 2, 'Test purchase');
        expect(result.success).toBe(true);
        expect(result.currentAmount).toBe(1200);
        expect(result.newAmount).toBe(720);
        expect(result.amountDeducted).toBe(2);
    });

    test('deduct currency with insufficient funds', async () => {
        const adapter = new SystemAdapter();
        const actor = new MockActor({
            system: { money: { gc: 0, ss: 12, bp: 6 } }
        });

        const result = await adapter.deductCurrency(actor, 200, 'Test overspend');
        expect(result.success).toBe(false);
        expect(result.error).toEqual(expect.stringContaining('Insufficient'));
    });

    test('add currency', async () => {
        const adapter = new SystemAdapter();
        const actor = new MockActor({
            system: { money: { gc: 0, ss: 12, bp: 6 } }
        });

        // addCurrency's `amount` is denominated in GC, converted internally to BP
        const result = await adapter.addCurrency(actor, 1, 'Test sale');
        expect(result.success).toBe(true);
        expect(result.currentAmount).toBe(150);
        expect(result.newAmount).toBe(390);
        expect(result.amountAdded).toBe(1);
    });
});

describe('SystemAdapter Inventory Operations', () => {
    beforeEach(() => {
        global.game = {
            system: { id: 'wfrp4e' }
        };
    });

    test('create cargo item data', () => {
        const adapter = new SystemAdapter();

        const cargoData = {
            category: 'Agriculture'
        };

        const purchaseInfo = {
            pricePerUnit: 15,
            totalPrice: 300,
            quality: 'good',
            season: 'spring',
            settlement: 'Ubersreik'
        };

        const itemData = adapter.createCargoItemData('Wine', 20, cargoData, purchaseInfo);

        expect(itemData.name).toBe('Wine (good)');
        expect(itemData.system.quantity.value).toBe(20);
        expect(itemData.system.price.gc).toBe(15);
        expect(itemData.system.tradingData.isTradingCargo).toBe(true);
        expect(itemData.system.purchaseLocation).toBe('Ubersreik');
    });

    test('add cargo to inventory', async () => {
        const adapter = new SystemAdapter();
        const actor = new MockActor({
            system: { money: { gc: 0, ss: 0, bp: 500 } }
        });

        const cargoData = { category: 'Agriculture' };
        const purchaseInfo = {
            pricePerUnit: 15,
            totalPrice: 300,
            quality: 'good',
            season: 'spring',
            settlement: 'Ubersreik'
        };

        const result = await adapter.addCargoToInventory(actor, 'Grain', 50, cargoData, purchaseInfo);
        expect(result.success).toBe(true);
        expect(result.itemId).not.toBeNull();
        expect(result.cargoName).toBe('Grain');
        expect(result.quantity).toBe(50);
    });

    test('find cargo in inventory', () => {
        const adapter = new SystemAdapter();
        const actor = new MockActor({
            system: { money: { gc: 0, ss: 0, bp: 500 } }
        });

        const testItems = [
            new MockItem({
                id: 'item1',
                name: 'Wine (good)',
                system: {
                    quantity: { value: 20 },
                    encumbrance: { value: 1 },
                    quality: 'good',
                    tradingData: { isTradingCargo: true }
                }
            }),
            new MockItem({
                id: 'item2',
                name: 'Grain',
                system: {
                    quantity: { value: 50 },
                    encumbrance: { value: 1 },
                    tradingData: { isTradingCargo: true }
                }
            }),
            new MockItem({
                id: 'item3',
                name: 'Sword',
                system: {
                    quantity: { value: 1 }
                }
            })
        ];

        testItems.forEach(item => actor.items.set(item.id, item));

        const wineItems = adapter.findCargoInInventory(actor, 'Wine');
        expect(wineItems.length).toBe(1);

        const wineGoodItems = adapter.findCargoInInventory(actor, 'Wine', { quality: 'good' });
        expect(wineGoodItems.length).toBe(1);

        const wineExcellentItems = adapter.findCargoInInventory(actor, 'Wine', { quality: 'excellent' });
        expect(wineExcellentItems.length).toBe(0);
    });

    test('get total cargo quantity', () => {
        const adapter = new SystemAdapter();
        const actor = new MockActor({
            system: { money: { gc: 0, ss: 0, bp: 500 } }
        });

        const testItems = [
            new MockItem({
                id: 'item1',
                name: 'Wine (good)',
                system: {
                    quantity: { value: 20 },
                    quality: 'good',
                    tradingData: { isTradingCargo: true }
                }
            }),
            new MockItem({
                id: 'item2',
                name: 'Grain',
                system: {
                    quantity: { value: 100 },
                    tradingData: { isTradingCargo: true }
                }
            })
        ];
        testItems.forEach(item => actor.items.set(item.id, item));

        expect(adapter.getTotalCargoQuantity(actor, 'Wine')).toBe(20);
        expect(adapter.getTotalCargoQuantity(actor, 'Grain')).toBe(100);
        expect(adapter.getTotalCargoQuantity(actor, 'Cattle')).toBe(0);
    });

    test('remove cargo from inventory (partial)', async () => {
        const adapter = new SystemAdapter();
        const actor = new MockActor({
            system: { money: { gc: 0, ss: 0, bp: 500 } }
        });

        actor.items.set('item2', new MockItem({
            id: 'item2',
            name: 'Grain',
            system: {
                quantity: { value: 50 },
                tradingData: { isTradingCargo: true }
            }
        }));

        const result = await adapter.removeCargoFromInventory(actor, 'item2', 20);
        expect(result.success).toBe(true);
        expect(result.removedQuantity).toBe(20);
        expect(result.itemRemoved).toBe(false);
        expect(result.remainingQuantity).toBe(30);
    });

    test('remove cargo from inventory (complete)', async () => {
        const adapter = new SystemAdapter();
        const actor = new MockActor({
            system: { money: { gc: 0, ss: 0, bp: 500 } }
        });

        actor.items.set('item1', new MockItem({
            id: 'item1',
            name: 'Wine (good)',
            system: {
                quantity: { value: 20 },
                quality: 'good',
                tradingData: { isTradingCargo: true }
            }
        }));

        const result = await adapter.removeCargoFromInventory(actor, 'item1');
        expect(result.success).toBe(true);
        expect(result.itemRemoved).toBe(true);
    });

    test('inventory summary', () => {
        const adapter = new SystemAdapter();
        const actor = new MockActor({
            system: { money: { gc: 0, ss: 0, bp: 500 } }
        });

        const summary = adapter.getInventorySummary(actor);
        expect(summary.currency).toBe(500);
        expect(Array.isArray(summary.cargoItems)).toBe(true);
        expect(typeof summary.totalCargoValue).toBe('number');
    });
});

describe('SystemAdapter Transaction Validation', () => {
    beforeEach(() => {
        global.game = {
            system: { id: 'wfrp4e' }
        };
    });

    test('actor validation', () => {
        const adapter = new SystemAdapter();

        const validActor = new MockActor({
            system: { money: { gc: 0, ss: 0, bp: 200 } }
        });
        const actorValidation = adapter.validateActor(validActor);
        expect(actorValidation.valid).toBe(true);
        expect(actorValidation.errors.length).toBe(0);

        const invalidActor = new MockActor({
            system: { other: 'data' }
        });
        const invalidValidation = adapter.validateActor(invalidActor);
        expect(invalidValidation.valid).toBe(false);
        expect(invalidValidation.errors.length).toBeGreaterThan(0);
    });

    test('purchase transaction validation', () => {
        const adapter = new SystemAdapter();
        const validActor = new MockActor({
            system: { money: { gc: 0, ss: 0, bp: 200 } }
        });

        const purchaseValidation = adapter.validateTransaction(validActor, 'purchase', {
            cargoName: 'Wine',
            quantity: 20,
            totalPrice: 150
        });
        expect(purchaseValidation.valid).toBe(true);

        const expensiveValidation = adapter.validateTransaction(validActor, 'purchase', {
            cargoName: 'Wine',
            quantity: 50,
            totalPrice: 500
        });
        expect(expensiveValidation.valid).toBe(false);
        expect(expensiveValidation.errors[0]).toEqual(expect.stringContaining('Insufficient'));
    });

    test('sale transaction validation', () => {
        const adapter = new SystemAdapter();
        const validActor = new MockActor({
            system: { money: { gc: 0, ss: 0, bp: 200 } }
        });

        validActor.items.set('cargo1', new MockItem({
            id: 'cargo1',
            name: 'Wine',
            system: {
                quantity: { value: 30 },
                tradingData: { isTradingCargo: true }
            }
        }));

        const saleValidation = adapter.validateTransaction(validActor, 'sale', {
            cargoName: 'Wine',
            quantity: 20
        });
        expect(saleValidation.valid).toBe(true);

        const oversaleValidation = adapter.validateTransaction(validActor, 'sale', {
            cargoName: 'Wine',
            quantity: 50
        });
        expect(oversaleValidation.valid).toBe(false);
        expect(oversaleValidation.errors[0]).toEqual(expect.stringContaining('Insufficient cargo'));
    });
});

describe('SystemAdapter Error Conditions', () => {
    test('non-FoundryVTT environment', () => {
        delete global.game;

        const adapter = new SystemAdapter();
        const compatibility = adapter.validateSystemCompatibility();

        expect(compatibility.compatible).toBe(false);
        expect(compatibility.errors[0]).toEqual(expect.stringContaining('FoundryVTT'));
    });

    test('invalid configuration', () => {
        // isFoundryEnvironment is captured at construction time, so `game`
        // must be restored (previous test deleted it) before constructing
        global.game = { system: { id: 'test' } };

        // mergeSystemConfig() backfills missing currency.field/fields from
        // defaults, so an empty `currency: {}` override no longer produces
        // an invalid config; only `inventory: {}` (not defaulted) does.
        const invalidConfig = {
            inventory: {} // Missing field
        };

        const invalidAdapter = new SystemAdapter(invalidConfig);

        const invalidCompatibility = invalidAdapter.validateSystemCompatibility();
        expect(invalidCompatibility.compatible).toBe(false);
        expect(invalidCompatibility.errors.some(e => e.includes('Inventory field'))).toBe(true);
    });
});
