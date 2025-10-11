/**
 * Test script for SystemAdapter integration with DataManager
 */

// Import required modules
const DataManager = require('./data-manager.js');
const SystemAdapter = require('./system-adapter.js');
const CurrencyUtils = require('./currency-utils.js');

// Mock FoundryVTT environment
global.game = {
    system: { id: 'wfrp4e' }
};

// Mock Actor for testing
class MockActor {
    constructor() {
        this.id = 'test-actor';
        this.name = 'Test Character';
        this.type = 'character';
        this.system = {
            money: { gc: 500, ss: 0, bp: 0 }
        };
        this.items = new MockCollection();
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

    get(id) {
        return super.get(id);
    }

    set(id, item) {
        return super.set(id, item);
    }
}

async function testSystemAdapterIntegration() {
    console.log('Testing SystemAdapter Integration with DataManager...\n');

    try {
        // Initialize DataManager
        const dataManager = new DataManager();
        
        // Load sample data (using the existing sample dataset)
        const sampleData = {
            settlements: [
                {
                    region: "Empire",
                    name: "Ubersreik",
                    size: "T",
                    ruler: "Lord Rickard Aschaffenberg",
                    population: 6000,
                    wealth: 3,
                    source: ["Trade", "Wine"],
                    garrison: ["20a", "40b", "120c"],
                    notes: "Trading town"
                }
            ],
            config: {
                currency: {
                    canonicalUnit: {
                        name: 'Brass Penny',
                        abbreviation: 'BP',
                        value: 1
                    },
                    denominations: [
                        { name: 'Gold Crown', abbreviation: 'GC', value: 240 },
                        { name: 'Silver Shilling', abbreviation: 'SS', value: 12 },
                        { name: 'Brass Penny', abbreviation: 'BP', value: 1 }
                    ],
                    display: {
                        order: ['GC', 'SS', 'BP'],
                        includeZeroDenominations: false,
                        separator: ' '
                    }
                },
                inventory: {
                    field: 'items',
                    method: 'createEmbeddedDocuments',
                    type: 'loot'
                }
            }
        };

        dataManager.settlements = sampleData.settlements;
        dataManager.config = sampleData.config;
        dataManager.cargoTypes = [
            {
                name: "Wine",
                category: "Wine",
                basePrices: { spring: 15, summer: 12, autumn: 18, winter: 20 },
                qualityTiers: { poor: 0.5, average: 1.0, good: 1.5, excellent: 2.0 },
                encumbrancePerUnit: 1
            }
        ];

        console.log('✓ DataManager initialized with sample data');

        // Initialize SystemAdapter with DataManager config
        const systemAdapter = new SystemAdapter();
        systemAdapter.loadConfiguration(dataManager);

        console.log('✓ SystemAdapter initialized with DataManager configuration');

        // Validate system compatibility
        const compatibility = systemAdapter.validateSystemCompatibility();
        console.log(`System compatibility: ${compatibility.compatible}`);
        console.log(`System ID: ${compatibility.systemId}`);
        
        if (compatibility.warnings.length > 0) {
            console.log(`Warnings: ${compatibility.warnings.join(', ')}`);
        }

        // Create test actor
        const actor = new MockActor();
    const initialCanonical = systemAdapter.getCurrencyValue(actor);
    const initialFormatted = CurrencyUtils.formatCurrency(initialCanonical, systemAdapter.getCurrencySchema());
    console.log(`✓ Created test actor with ${initialCanonical} BP (canonical) -> ${initialFormatted}`);

        // Validate actor
        const actorValidation = systemAdapter.validateActor(actor);
        console.log(`Actor validation: ${actorValidation.valid}`);
        
        if (!actorValidation.valid) {
            console.log(`Actor errors: ${actorValidation.errors.join(', ')}`);
            return;
        }

        // Test purchase workflow
        console.log('\n--- Testing Purchase Workflow ---');
        
        const purchaseData = {
            cargoName: 'Wine',
            quantity: 20,
            totalPrice: 300,
            pricePerUnit: 15,
            quality: 'good',
            season: 'spring',
            settlement: 'Ubersreik'
        };

        // Validate purchase transaction
        const purchaseValidation = systemAdapter.validateTransaction(actor, 'purchase', purchaseData);
        console.log(`Purchase validation: ${purchaseValidation.valid}`);

        if (purchaseValidation.valid) {
            // Deduct currency
            const currencyResult = await systemAdapter.deductCurrency(actor, purchaseData.totalPrice, 'Wine purchase');
            console.log(`Currency deduction: ${currencyResult.success}`);
            const formattedBalance = CurrencyUtils.formatCurrency(currencyResult.newAmount, systemAdapter.getCurrencySchema());
            console.log(`New balance: ${currencyResult.newAmount} BP -> ${formattedBalance}`);

            // Add cargo to inventory
            const cargoData = dataManager.cargoTypes.find(c => c.name === purchaseData.cargoName);
            const inventoryResult = await systemAdapter.addCargoToInventory(
                actor, 
                purchaseData.cargoName, 
                purchaseData.quantity, 
                cargoData, 
                purchaseData
            );
            console.log(`Inventory addition: ${inventoryResult.success}`);
            console.log(`Item created: ${inventoryResult.itemName}`);
        }

        // Test sale workflow
        console.log('\n--- Testing Sale Workflow ---');
        
        const saleData = {
            cargoName: 'Wine',
            quantity: 10,
            quality: 'good'
        };

        // Validate sale transaction
        const saleValidation = systemAdapter.validateTransaction(actor, 'sale', saleData);
        console.log(`Sale validation: ${saleValidation.valid}`);

        if (saleValidation.valid) {
            // Find cargo in inventory
            const cargoItems = systemAdapter.findCargoInInventory(actor, saleData.cargoName, {
                quality: saleData.quality
            });
            console.log(`Found ${cargoItems.length} matching cargo items`);

            if (cargoItems.length > 0) {
                // Remove cargo from inventory
                const removalResult = await systemAdapter.removeCargoFromInventory(
                    actor, 
                    cargoItems[0].id, 
                    saleData.quantity
                );
                console.log(`Inventory removal: ${removalResult.success}`);
                console.log(`Removed quantity: ${removalResult.removedQuantity}`);

                // Add currency from sale
                const salePrice = 180; // 10 × 18 GC (example sale price)
                const currencyResult = await systemAdapter.addCurrency(actor, salePrice, 'Wine sale');
                console.log(`Currency addition: ${currencyResult.success}`);
                const formattedBalance = CurrencyUtils.formatCurrency(currencyResult.newAmount, systemAdapter.getCurrencySchema());
                console.log(`New balance: ${currencyResult.newAmount} BP -> ${formattedBalance}`);
            }
        }

        // Get final inventory summary
        console.log('\n--- Final Inventory Summary ---');
        const summary = systemAdapter.getInventorySummary(actor);
        console.log(`Total cargo items: ${summary.totalItems}`);
        console.log(`Final currency: ${summary.currency} GC`);
        console.log(`Total cargo value: ${summary.totalCargoValue} GC`);

        summary.cargoItems.forEach(item => {
            console.log(`- ${item.name}: ${item.quantity} EP`);
        });

        console.log('\n🎉 SystemAdapter integration test completed successfully!');

    } catch (error) {
        console.error('❌ Integration test failed:', error.message);
        console.error(error.stack);
    }
}

// Run the integration test
if (require.main === module) {
    testSystemAdapterIntegration();
}

module.exports = { testSystemAdapterIntegration };