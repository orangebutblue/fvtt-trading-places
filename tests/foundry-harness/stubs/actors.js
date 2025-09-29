/**
 * Actor and Item stubs for Foundry harness
 * Provides minimal data structures for inventory and currency operations
 */

class HarnessActor {
    constructor(data = {}) {
        this.id = data.id || 'harness-actor';
        this.name = data.name || 'Test Actor';
        this.type = data.type || 'character';
        this.system = {
            status: {
                fortune: { value: 100 },
                wealth: { value: 'average' }
            },
            details: {
                money: {
                    gc: data.money?.gc || 50,
                    ss: data.money?.ss || 100,
                    bp: data.money?.bp || 200
                }
            },
            ...data.system
        };
        
        this.items = new Map();
        this._inventory = [];
        
        // Initialize with some basic items if none provided
        if (data.items) {
            data.items.forEach(item => this.addItem(item));
        }
    }

    // Item management
    addItem(itemData) {
        const item = new HarnessItem(itemData);
        this.items.set(item.id, item);
        this._inventory.push(item);
        console.log(`Foundry Harness | Added item to ${this.name}: ${item.name} (${item.system.quantity})`);
        return item;
    }

    removeItem(itemId) {
        const item = this.items.get(itemId);
        if (item) {
            this.items.delete(itemId);
            const index = this._inventory.findIndex(i => i.id === itemId);
            if (index >= 0) {
                this._inventory.splice(index, 1);
            }
            console.log(`Foundry Harness | Removed item from ${this.name}: ${item.name}`);
        }
        return item;
    }

    getItem(itemId) {
        return this.items.get(itemId);
    }

    // Money operations
    updateMoney(changes) {
        Object.keys(changes).forEach(currency => {
            if (this.system.details.money[currency] !== undefined) {
                this.system.details.money[currency] += changes[currency];
                console.log(`Foundry Harness | ${this.name} ${currency}: ${changes[currency]} (total: ${this.system.details.money[currency]})`);
            }
        });
    }

    // Inventory helpers
    findItemByName(name) {
        return this._inventory.find(item => item.name === name);
    }

    findItemsByType(type) {
        return this._inventory.filter(item => item.type === type);
    }

    getInventory() {
        return [...this._inventory];
    }

    // Update methods (for compatibility)
    async update(data) {
        Object.assign(this.system, data.system || {});
        console.log(`Foundry Harness | Updated actor ${this.name}:`, data);
        return this;
    }
}

class HarnessItem {
    constructor(data = {}) {
        this.id = data.id || `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        this.name = data.name || 'Test Item';
        this.type = data.type || 'trapping';
        this.system = {
            quantity: { value: data.quantity || 1 },
            price: { gc: data.price || 1, ss: 0, bp: 0 },
            encumbrance: { value: data.encumbrance || 1 },
            availability: { value: data.availability || 'common' },
            ...data.system
        };
        
        // Normalize quantity access
        if (typeof this.system.quantity === 'number') {
            this.system.quantity = { value: this.system.quantity };
        }
    }

    // Update methods
    async update(data) {
        Object.assign(this.system, data.system || {});
        if (data.name) this.name = data.name;
        console.log(`Foundry Harness | Updated item ${this.name}:`, data);
        return this;
    }

    // Quantity helpers
    increaseQuantity(amount) {
        this.system.quantity.value += amount;
        console.log(`Foundry Harness | Increased ${this.name} quantity by ${amount} (total: ${this.system.quantity.value})`);
    }

    decreaseQuantity(amount) {
        this.system.quantity.value = Math.max(0, this.system.quantity.value - amount);
        console.log(`Foundry Harness | Decreased ${this.name} quantity by ${amount} (total: ${this.system.quantity.value})`);
    }
}

export function createActorStub() {
    // Return Actor constructor
    function Actor(data, options = {}) {
        return new HarnessActor(data);
    }

    // Static methods
    Actor.create = async function(data, options = {}) {
        return new HarnessActor(data);
    };

    Actor.get = function(id) {
        return globalThis.game.actors.get(id);
    };

    return Actor;
}

export function createItemStub() {
    // Return Item constructor
    function Item(data, options = {}) {
        return new HarnessItem(data);
    }

    // Static methods
    Item.create = async function(data, options = {}) {
        return new HarnessItem(data);
    };

    Item.get = function(id) {
        return globalThis.game.items.get(id);
    };

    return Item;
}

// Test data helpers
export function createTestActor(overrides = {}) {
    const defaultActor = {
        id: 'test-actor-1',
        name: 'Test Trader',
        type: 'character',
        money: { gc: 100, ss: 500, bp: 1000 },
        items: [
            { name: 'Grain', quantity: 5, type: 'trapping', price: 10 },
            { name: 'Tools', quantity: 2, type: 'trapping', price: 20 },
            { name: 'Ale', quantity: 10, type: 'trapping', price: 5 }
        ],
        ...overrides
    };
    
    return new HarnessActor(defaultActor);
}

export { HarnessActor, HarnessItem };