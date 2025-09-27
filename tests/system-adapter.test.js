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
            money: { gc: 100 }
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

// Import SystemAdapter (in Node.js environment)
let SystemAdapter;
if (typeof require !== 'undefined') {
    try {
        SystemAdapter = require('../scripts/system-adapter.js');
        console.log('SystemAdapter loaded successfully');
    } catch (error) {
        console.error('Failed to load SystemAdapter:', error.message);
        process.exit(1);
    }
}

// Test suite for SystemAdapter configuration and validation
function runSystemAdapterConfigTests() {
    console.log('Running SystemAdapter Configuration Tests...\n');

    // Test 1: Default Configuration
    console.log('Test 1: Default Configuration');
    console.log('=============================');

    const adapter = new SystemAdapter();
    const config = adapter.getDefaultConfig();
    
    console.log(`Currency field: ${config.currency.field} (expected: system.money.gc)`);
    console.log(`Inventory field: ${config.inventory.field} (expected: items)`);
    console.log(`Inventory method: ${config.inventory.method} (expected: createEmbeddedDocuments)`);
    
    console.assert(config.currency.field === 'system.money.gc', 'Default currency field should be system.money.gc');
    console.assert(config.inventory.field === 'items', 'Default inventory field should be items');
    console.assert(config.inventory.method === 'createEmbeddedDocuments', 'Default inventory method should be createEmbeddedDocuments');

    console.log('✓ Default configuration correct\n');

    // Test 2: Custom Configuration
    console.log('Test 2: Custom Configuration');
    console.log('============================');

    const customConfig = {
        currency: {
            field: 'system.currency.gold',
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
    console.log(`Custom currency field: ${customAdapter.config.currency.field} (expected: system.currency.gold)`);
    console.log(`Custom inventory method: ${customAdapter.config.inventory.method} (expected: addItem)`);
    
    console.assert(customAdapter.config.currency.field === 'system.currency.gold', 'Should use custom currency field');
    console.assert(customAdapter.config.inventory.method === 'addItem', 'Should use custom inventory method');

    console.log('✓ Custom configuration working correctly\n');

    // Test 3: System Compatibility Validation
    console.log('Test 3: System Compatibility Validation');
    console.log('=======================================');

    // Mock FoundryVTT environment
    global.game = {
        system: { id: 'wfrp4e' }
    };

    const wfrpAdapter = new SystemAdapter();
    const compatibility = wfrpAdapter.validateSystemCompatibility();
    
    console.log(`System compatible: ${compatibility.compatible} (expected: true)`);
    console.log(`System ID: ${compatibility.systemId} (expected: wfrp4e)`);
    console.log(`Errors: ${compatibility.errors.length} (expected: 0)`);
    console.log(`Warnings: ${compatibility.warnings.length}`);
    
    console.assert(compatibility.compatible === true, 'WFRP4e system should be compatible');
    console.assert(compatibility.systemId === 'wfrp4e', 'Should detect WFRP4e system');
    console.assert(compatibility.errors.length === 0, 'Should have no errors for valid config');

    console.log('✓ System compatibility validation working correctly\n');

    console.log('🎉 All SystemAdapter Configuration Tests Passed!\n');
}

// Test suite for currency operations
function runCurrencyOperationTests() {
    console.log('Running Currency Operation Tests...\n');

    // Mock FoundryVTT environment
    global.game = {
        system: { id: 'wfrp4e' }
    };

    const adapter = new SystemAdapter();

    // Test 1: Get Currency Value
    console.log('Test 1: Get Currency Value');
    console.log('==========================');

    const actor = new MockActor({
        system: { money: { gc: 150 } }
    });

    const currencyValue = adapter.getCurrencyValue(actor);
    console.log(`Currency value: ${currencyValue} GC (expected: 150 GC)`);
    console.assert(currencyValue === 150, 'Should get correct currency value');

    // Test with missing currency field
    const actorNoCurrency = new MockActor({
        system: { other: 'data' }
    });

    const noCurrencyValue = adapter.getCurrencyValue(actorNoCurrency);
    console.log(`No currency value: ${noCurrencyValue} (expected: null)`);
    console.assert(noCurrencyValue === null, 'Should return null for missing currency field');

    console.log('✓ Currency value retrieval working correctly\n');

    // Test 2: Check Sufficient Currency
    console.log('Test 2: Check Sufficient Currency');
    console.log('=================================');

    const hasSufficient = adapter.hasSufficientCurrency(actor, 100);
    console.log(`Has sufficient (100): ${hasSufficient} (expected: true)`);
    console.assert(hasSufficient === true, 'Should have sufficient currency');

    const hasInsufficient = adapter.hasSufficientCurrency(actor, 200);
    console.log(`Has sufficient (200): ${hasInsufficient} (expected: false)`);
    console.assert(hasInsufficient === false, 'Should not have sufficient currency');

    console.log('✓ Currency sufficiency checks working correctly\n');

    // Test 3: Deduct Currency
    console.log('Test 3: Deduct Currency');
    console.log('=======================');

    // Successful deduction
    adapter.deductCurrency(actor, 50, 'Test purchase').then(result => {
        console.log(`Deduction success: ${result.success} (expected: true)`);
        console.log(`Previous amount: ${result.currentAmount} (expected: 150)`);
        console.log(`New amount: ${result.newAmount} (expected: 100)`);
        console.log(`Amount deducted: ${result.amountDeducted} (expected: 50)`);
        
        console.assert(result.success === true, 'Deduction should succeed');
        console.assert(result.currentAmount === 150, 'Should track previous amount');
        console.assert(result.newAmount === 100, 'Should calculate new amount correctly');
        console.assert(result.amountDeducted === 50, 'Should track deducted amount');
    });

    // Insufficient funds deduction
    adapter.deductCurrency(actor, 200, 'Test overspend').then(result => {
        console.log(`Overspend success: ${result.success} (expected: false)`);
        console.log(`Error message contains 'Insufficient': ${result.error.includes('Insufficient')} (expected: true)`);
        
        console.assert(result.success === false, 'Overspend should fail');
        console.assert(result.error.includes('Insufficient'), 'Should have insufficient funds error');
    });

    console.log('✓ Currency deduction working correctly\n');

    // Test 4: Add Currency
    console.log('Test 4: Add Currency');
    console.log('====================');

    adapter.addCurrency(actor, 75, 'Test sale').then(result => {
        console.log(`Addition success: ${result.success} (expected: true)`);
        console.log(`Amount added: ${result.amountAdded} (expected: 75)`);
        
        console.assert(result.success === true, 'Addition should succeed');
        console.assert(result.amountAdded === 75, 'Should track added amount');
    });

    console.log('✓ Currency addition working correctly\n');

    console.log('🎉 All Currency Operation Tests Passed!\n');
}

// Test suite for inventory operations
function runInventoryOperationTests() {
    console.log('Running Inventory Operation Tests...\n');

    // Mock FoundryVTT environment
    global.game = {
        system: { id: 'wfrp4e' }
    };

    const adapter = new SystemAdapter();

    // Test 1: Create Cargo Item Data
    console.log('Test 1: Create Cargo Item Data');
    console.log('==============================');

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

    const itemData = adapter.createCargoItemData('Wine', 20, cargoData, purchaseInfo);
    
    console.log(`Item name: ${itemData.name} (expected: Wine (good))`);
    console.log(`Item quantity: ${itemData.system.quantity.value} (expected: 20)`);
    console.log(`Item price: ${itemData.system.price.gc} (expected: 15)`);
    console.log(`Is trading cargo: ${itemData.system.tradingData.isTradingCargo} (expected: true)`);
    console.log(`Purchase location: ${itemData.system.purchaseLocation} (expected: Ubersreik)`);
    
    console.assert(itemData.name === 'Wine (good)', 'Should include quality in name');
    console.assert(itemData.system.quantity.value === 20, 'Should set correct quantity');
    console.assert(itemData.system.price.gc === 15, 'Should set correct price');
    console.assert(itemData.system.tradingData.isTradingCargo === true, 'Should mark as trading cargo');
    console.assert(itemData.system.purchaseLocation === 'Ubersreik', 'Should set purchase location');

    console.log('✓ Cargo item data creation working correctly\n');

    // Test 2: Add Cargo to Inventory
    console.log('Test 2: Add Cargo to Inventory');
    console.log('==============================');

    const actor = new MockActor({
        system: { money: { gc: 500 } }
    });

    adapter.addCargoToInventory(actor, 'Grain', 50, cargoData, purchaseInfo).then(result => {
        console.log(`Add cargo success: ${result.success} (expected: true)`);
        console.log(`Item ID created: ${result.itemId !== null} (expected: true)`);
        console.log(`Cargo name: ${result.cargoName} (expected: Grain)`);
        console.log(`Quantity: ${result.quantity} (expected: 50)`);
        
        console.assert(result.success === true, 'Should successfully add cargo');
        console.assert(result.itemId !== null, 'Should return item ID');
        console.assert(result.cargoName === 'Grain', 'Should track cargo name');
        console.assert(result.quantity === 50, 'Should track quantity');
    });

    console.log('✓ Add cargo to inventory working correctly\n');

    // Test 3: Find Cargo in Inventory
    console.log('Test 3: Find Cargo in Inventory');
    console.log('===============================');

    // Add some test items to actor
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
    console.log(`Wine items found: ${wineItems.length} (expected: 1)`);
    console.assert(wineItems.length === 1, 'Should find wine items');

    const wineGoodItems = adapter.findCargoInInventory(actor, 'Wine', { quality: 'good' });
    console.log(`Good wine items found: ${wineGoodItems.length} (expected: 1)`);
    console.assert(wineGoodItems.length === 1, 'Should find good quality wine');

    const wineExcellentItems = adapter.findCargoInInventory(actor, 'Wine', { quality: 'excellent' });
    console.log(`Excellent wine items found: ${wineExcellentItems.length} (expected: 0)`);
    console.assert(wineExcellentItems.length === 0, 'Should not find excellent quality wine');

    console.log('✓ Find cargo in inventory working correctly\n');

    // Test 4: Get Total Cargo Quantity
    console.log('Test 4: Get Total Cargo Quantity');
    console.log('================================');

    const totalWine = adapter.getTotalCargoQuantity(actor, 'Wine');
    console.log(`Total wine quantity: ${totalWine} (expected: 20)`);
    console.assert(totalWine === 20, 'Should calculate total wine quantity');

    const totalGrain = adapter.getTotalCargoQuantity(actor, 'Grain');
    console.log(`Total grain quantity: ${totalGrain} (expected: 100)`);
    console.assert(totalGrain === 100, 'Should calculate total grain quantity (50 original + 50 added)');

    const totalNonexistent = adapter.getTotalCargoQuantity(actor, 'Cattle');
    console.log(`Total cattle quantity: ${totalNonexistent} (expected: 0)`);
    console.assert(totalNonexistent === 0, 'Should return 0 for nonexistent cargo');

    console.log('✓ Total cargo quantity calculation working correctly\n');

    // Test 5: Remove Cargo from Inventory
    console.log('Test 5: Remove Cargo from Inventory');
    console.log('===================================');

    // Partial removal
    adapter.removeCargoFromInventory(actor, 'item2', 20).then(result => {
        console.log(`Partial removal success: ${result.success} (expected: true)`);
        console.log(`Removed quantity: ${result.removedQuantity} (expected: 20)`);
        console.log(`Item removed: ${result.itemRemoved} (expected: false)`);
        console.log(`Remaining quantity: ${result.remainingQuantity} (expected: 30)`);
        
        console.assert(result.success === true, 'Partial removal should succeed');
        console.assert(result.removedQuantity === 20, 'Should remove correct quantity');
        console.assert(result.itemRemoved === false, 'Should not remove entire item');
        console.assert(result.remainingQuantity === 30, 'Should calculate remaining quantity');
    });

    // Complete removal
    adapter.removeCargoFromInventory(actor, 'item1').then(result => {
        console.log(`Complete removal success: ${result.success} (expected: true)`);
        console.log(`Item removed: ${result.itemRemoved} (expected: true)`);
        
        console.assert(result.success === true, 'Complete removal should succeed');
        console.assert(result.itemRemoved === true, 'Should remove entire item');
    });

    console.log('✓ Remove cargo from inventory working correctly\n');

    // Test 6: Inventory Summary
    console.log('Test 6: Inventory Summary');
    console.log('=========================');

    const summary = adapter.getInventorySummary(actor);
    console.log(`Total cargo items: ${summary.totalItems}`);
    console.log(`Currency: ${summary.currency} (expected: 500)`);
    console.log(`Cargo items array length: ${summary.cargoItems.length}`);
    
    console.assert(summary.currency === 500, 'Should include currency in summary');
    console.assert(Array.isArray(summary.cargoItems), 'Should return cargo items array');
    console.assert(typeof summary.totalCargoValue === 'number', 'Should calculate total cargo value');

    console.log('✓ Inventory summary working correctly\n');

    console.log('🎉 All Inventory Operation Tests Passed!\n');
}

// Test suite for transaction validation
function runTransactionValidationTests() {
    console.log('Running Transaction Validation Tests...\n');

    // Mock FoundryVTT environment
    global.game = {
        system: { id: 'wfrp4e' }
    };

    const adapter = new SystemAdapter();

    // Test 1: Actor Validation
    console.log('Test 1: Actor Validation');
    console.log('========================');

    const validActor = new MockActor({
        system: { money: { gc: 200 } }
    });

    const actorValidation = adapter.validateActor(validActor);
    console.log(`Valid actor: ${actorValidation.valid} (expected: true)`);
    console.log(`Errors: ${actorValidation.errors.length} (expected: 0)`);
    
    console.assert(actorValidation.valid === true, 'Valid actor should pass validation');
    console.assert(actorValidation.errors.length === 0, 'Should have no errors');

    // Invalid actor (missing currency)
    const invalidActor = new MockActor({
        system: { other: 'data' }
    });

    const invalidValidation = adapter.validateActor(invalidActor);
    console.log(`Invalid actor: ${invalidValidation.valid} (expected: false)`);
    console.log(`Errors: ${invalidValidation.errors.length} (expected: > 0)`);
    
    console.assert(invalidValidation.valid === false, 'Invalid actor should fail validation');
    console.assert(invalidValidation.errors.length > 0, 'Should have validation errors');

    console.log('✓ Actor validation working correctly\n');

    // Test 2: Purchase Transaction Validation
    console.log('Test 2: Purchase Transaction Validation');
    console.log('=======================================');

    const purchaseData = {
        cargoName: 'Wine',
        quantity: 20,
        totalPrice: 150
    };

    const purchaseValidation = adapter.validateTransaction(validActor, 'purchase', purchaseData);
    console.log(`Purchase validation: ${purchaseValidation.valid} (expected: true)`);
    console.assert(purchaseValidation.valid === true, 'Valid purchase should pass validation');

    // Insufficient funds
    const expensivePurchase = {
        cargoName: 'Wine',
        quantity: 50,
        totalPrice: 500
    };

    const expensiveValidation = adapter.validateTransaction(validActor, 'purchase', expensivePurchase);
    console.log(`Expensive purchase validation: ${expensiveValidation.valid} (expected: false)`);
    console.log(`Error contains 'Insufficient': ${expensiveValidation.errors[0].includes('Insufficient')} (expected: true)`);
    
    console.assert(expensiveValidation.valid === false, 'Expensive purchase should fail validation');
    console.assert(expensiveValidation.errors[0].includes('Insufficient'), 'Should have insufficient currency error');

    console.log('✓ Purchase transaction validation working correctly\n');

    // Test 3: Sale Transaction Validation
    console.log('Test 3: Sale Transaction Validation');
    console.log('===================================');

    // Add some cargo to actor for sale validation
    const cargoItem = new MockItem({
        id: 'cargo1',
        name: 'Wine',
        system: {
            quantity: { value: 30 },
            tradingData: { isTradingCargo: true }
        }
    });
    validActor.items.set('cargo1', cargoItem);

    const saleData = {
        cargoName: 'Wine',
        quantity: 20
    };

    const saleValidation = adapter.validateTransaction(validActor, 'sale', saleData);
    console.log(`Sale validation: ${saleValidation.valid} (expected: true)`);
    console.assert(saleValidation.valid === true, 'Valid sale should pass validation');

    // Insufficient cargo
    const oversale = {
        cargoName: 'Wine',
        quantity: 50
    };

    const oversaleValidation = adapter.validateTransaction(validActor, 'sale', oversale);
    console.log(`Oversale validation: ${oversaleValidation.valid} (expected: false)`);
    console.log(`Error contains 'Insufficient cargo': ${oversaleValidation.errors[0].includes('Insufficient cargo')} (expected: true)`);
    
    console.assert(oversaleValidation.valid === false, 'Oversale should fail validation');
    console.assert(oversaleValidation.errors[0].includes('Insufficient cargo'), 'Should have insufficient cargo error');

    console.log('✓ Sale transaction validation working correctly\n');

    console.log('🎉 All Transaction Validation Tests Passed!\n');
}

// Test error conditions
function runSystemAdapterErrorTests() {
    console.log('Running SystemAdapter Error Tests...\n');

    // Test 1: Non-FoundryVTT Environment
    console.log('Test 1: Non-FoundryVTT Environment');
    console.log('==================================');

    // Remove mock game object
    delete global.game;

    const adapter = new SystemAdapter();
    const compatibility = adapter.validateSystemCompatibility();
    
    console.log(`Compatible without FoundryVTT: ${compatibility.compatible} (expected: false)`);
    console.log(`Error mentions FoundryVTT: ${compatibility.errors[0].includes('FoundryVTT')} (expected: true)`);
    
    console.assert(compatibility.compatible === false, 'Should not be compatible without FoundryVTT');
    console.assert(compatibility.errors[0].includes('FoundryVTT'), 'Should mention FoundryVTT requirement');

    // Test 2: Invalid Configuration
    console.log('\nTest 2: Invalid Configuration');
    console.log('=============================');

    const invalidConfig = {
        currency: {}, // Missing field
        inventory: {} // Missing field
    };

    const invalidAdapter = new SystemAdapter(invalidConfig);
    
    // Restore mock environment for validation
    global.game = { system: { id: 'test' } };
    
    const invalidCompatibility = invalidAdapter.validateSystemCompatibility();
    console.log(`Invalid config compatible: ${invalidCompatibility.compatible} (expected: false)`);
    console.log(`Has currency field error: ${invalidCompatibility.errors.some(e => e.includes('Currency field'))} (expected: true)`);
    console.log(`Has inventory field error: ${invalidCompatibility.errors.some(e => e.includes('Inventory field'))} (expected: true)`);
    
    console.assert(invalidCompatibility.compatible === false, 'Invalid config should not be compatible');
    console.assert(invalidCompatibility.errors.length >= 2, 'Should have multiple configuration errors');

    console.log('\n🎉 All SystemAdapter Error Tests Passed!\n');
}

// Run tests if in Node.js environment
if (typeof require !== 'undefined') {
    runSystemAdapterConfigTests();
    runCurrencyOperationTests();
    runInventoryOperationTests();
    runTransactionValidationTests();
    runSystemAdapterErrorTests();
}

// Export for browser testing
if (typeof window !== 'undefined') {
    window.runSystemAdapterConfigTests = runSystemAdapterConfigTests;
    window.runCurrencyOperationTests = runCurrencyOperationTests;
    window.runInventoryOperationTests = runInventoryOperationTests;
    window.runTransactionValidationTests = runTransactionValidationTests;
    window.runSystemAdapterErrorTests = runSystemAdapterErrorTests;
}