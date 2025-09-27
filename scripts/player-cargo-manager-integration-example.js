/**
 * Trading Places Module - Player Cargo Manager Integration Example
 * Demonstrates how to integrate PlayerCargoManager with other trading components
 */

/**
 * Example integration showing PlayerCargoManager usage in a trading workflow
 */
class PlayerCargoManagerIntegrationExample {
    constructor() {
        this.debugLogger = null;
        this.dataManager = null;
        this.cargoManager = null;
        
        this.initializeComponents();
    }

    /**
     * Initialize all required components
     */
    async initializeComponents() {
        console.log('=== Player Cargo Manager Integration Example ===');
        
        // Initialize debug logger (would normally be injected)
        this.debugLogger = {
            log: (category, operation, message, data, level) => {
                console.log(`[${category}] ${operation}: ${message}`, data || '');
            }
        };

        // Initialize data manager (would normally be injected)
        this.dataManager = {
            getCargoType: (type) => {
                const cargoTypes = {
                    'Grain': { name: 'Grain', category: 'Bulk Goods', basePrice: 2 },
                    'Metal': { name: 'Metal', category: 'Raw Materials', basePrice: 8 },
                    'Luxuries': { name: 'Luxuries', category: 'Luxury Goods', basePrice: 50 }
                };
                return cargoTypes[type] || null;
            },
            getAllCargoTypes: () => [
                { name: 'Grain', category: 'Bulk Goods' },
                { name: 'Metal', category: 'Raw Materials' },
                { name: 'Luxuries', category: 'Luxury Goods' }
            ]
        };

        // Initialize cargo manager
        this.cargoManager = new PlayerCargoManager(this.debugLogger, this.dataManager);
        
        console.log('Components initialized successfully');
    }

    /**
     * Demonstrate basic cargo management operations
     */
    async demonstrateBasicOperations() {
        console.log('\n=== Basic Cargo Operations Demo ===');
        
        // Add various cargo types
        console.log('\n1. Adding cargo to player inventory:');
        this.cargoManager.addCargo('Grain', 150, 'average', {
            purchaseLocation: 'Altdorf',
            purchasePrice: 300
        });
        
        this.cargoManager.addCargo('Metal', 75, 'good', {
            purchaseLocation: 'Nuln',
            purchasePrice: 900
        });
        
        this.cargoManager.addCargo('Grain', 50, 'poor', {
            purchaseLocation: 'Village Market',
            purchasePrice: 75
        });

        // Display current inventory
        console.log('\n2. Current player inventory:');
        const allCargo = this.cargoManager.getAllCargo();
        allCargo.forEach(cargo => {
            console.log(`- ${cargo.quantity} EP of ${cargo.type} (${cargo.quality}) from ${cargo.purchaseLocation || 'Unknown'}`);
        });

        // Show inventory summary
        console.log('\n3. Inventory summary:');
        const summary = this.cargoManager.getCargoSummary();
        Object.values(summary).forEach(item => {
            console.log(`- ${item.type} (${item.quality}): ${item.quantity} EP total`);
        });

        console.log(`\nTotal cargo: ${this.cargoManager.getTotalCargoQuantity()} EP`);
    }

    /**
     * Demonstrate selling workflow integration
     */
    async demonstrateSellingWorkflow() {
        console.log('\n=== Selling Workflow Demo ===');
        
        // Get cargo available for sale
        const grainCargo = this.cargoManager.getCargoByType('Grain', 'average');
        if (grainCargo.length > 0) {
            const cargo = grainCargo[0];
            console.log(`\nSelling ${cargo.quantity} EP of ${cargo.type} (${cargo.quality})`);
            
            // Simulate selling 100 EP
            const sellQuantity = 100;
            const salePrice = 250; // Calculated by selling algorithm
            
            console.log(`Sale price: ${salePrice} GC for ${sellQuantity} EP`);
            
            // Remove sold cargo
            const result = this.cargoManager.removeCargo(cargo.id, sellQuantity);
            if (result.success) {
                console.log(`Successfully sold cargo. Remaining items: ${result.totalItems}`);
            }
        }
    }

    /**
     * Demonstrate buying workflow integration
     */
    async demonstrateBuyingWorkflow() {
        console.log('\n=== Buying Workflow Demo ===');
        
        // Simulate buying new cargo (would come from buying algorithm)
        const newCargo = {
            type: 'Luxuries',
            quantity: 25,
            quality: 'excellent',
            purchaseLocation: 'Marienburg',
            purchasePrice: 1250,
            purchaseDate: new Date().toISOString()
        };
        
        console.log(`\nBuying ${newCargo.quantity} EP of ${newCargo.type} (${newCargo.quality})`);
        console.log(`Purchase price: ${newCargo.purchasePrice} GC`);
        
        const result = this.cargoManager.addCargo(
            newCargo.type,
            newCargo.quantity,
            newCargo.quality,
            {
                purchaseLocation: newCargo.purchaseLocation,
                purchasePrice: newCargo.purchasePrice,
                purchaseDate: newCargo.purchaseDate
            }
        );
        
        if (result.success) {
            console.log(`Successfully purchased cargo. Total items: ${result.totalItems}`);
        }
    }

    /**
     * Demonstrate cargo modification operations
     */
    async demonstrateCargoModification() {
        console.log('\n=== Cargo Modification Demo ===');
        
        // Get a cargo item to modify
        const allCargo = this.cargoManager.getAllCargo();
        if (allCargo.length > 0) {
            const cargo = allCargo[0];
            console.log(`\nModifying cargo: ${cargo.type} (${cargo.quality})`);
            
            // Add notes and update quality
            const result = this.cargoManager.modifyCargo(cargo.id, {
                quality: 'good',
                notes: 'Quality improved during transport',
                lastInspection: new Date().toISOString()
            });
            
            if (result.success) {
                console.log('Cargo modified successfully:');
                console.log(`- New quality: ${result.updatedCargo.quality}`);
                console.log(`- Notes: ${result.updatedCargo.notes}`);
            }
        }
    }

    /**
     * Demonstrate event system integration
     */
    async demonstrateEventSystem() {
        console.log('\n=== Event System Demo ===');
        
        // Set up event listener (would normally be in UI components)
        if (typeof window !== 'undefined') {
            window.addEventListener('wfrp-cargo-updated', (event) => {
                console.log('Cargo update event received:', {
                    totalItems: event.detail.totalItems,
                    totalQuantity: event.detail.totalQuantity
                });
            });
        }
        
        // Trigger an update
        console.log('\nTriggering cargo update event...');
        this.cargoManager.triggerCargoUpdate();
    }

    /**
     * Demonstrate validation and error handling
     */
    async demonstrateValidationAndErrors() {
        console.log('\n=== Validation and Error Handling Demo ===');
        
        // Test invalid inputs
        console.log('\n1. Testing invalid cargo type:');
        let result = this.cargoManager.addCargo('', 100, 'average');
        console.log(`Result: ${result.success ? 'Success' : 'Failed - ' + result.error}`);
        
        console.log('\n2. Testing invalid quantity:');
        result = this.cargoManager.addCargo('Grain', -50, 'average');
        console.log(`Result: ${result.success ? 'Success' : 'Failed - ' + result.error}`);
        
        console.log('\n3. Testing invalid quality:');
        result = this.cargoManager.addCargo('Grain', 100, 'legendary');
        console.log(`Result: ${result.success ? 'Success' : 'Failed - ' + result.error}`);
        
        console.log('\n4. Testing non-existent cargo removal:');
        result = this.cargoManager.removeCargo('non-existent-id', 10);
        console.log(`Result: ${result.success ? 'Success' : 'Failed - ' + result.error}`);
    }

    /**
     * Run complete demonstration
     */
    async runDemo() {
        await this.initializeComponents();
        await this.demonstrateBasicOperations();
        await this.demonstrateSellingWorkflow();
        await this.demonstrateBuyingWorkflow();
        await this.demonstrateCargoModification();
        await this.demonstrateEventSystem();
        await this.demonstrateValidationAndErrors();
        
        console.log('\n=== Demo Complete ===');
        console.log('Final inventory state:');
        const finalSummary = this.cargoManager.getCargoSummary();
        Object.values(finalSummary).forEach(item => {
            console.log(`- ${item.type} (${item.quality}): ${item.quantity} EP`);
        });
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { PlayerCargoManagerIntegrationExample };
} else if (typeof window !== 'undefined') {
    window.PlayerCargoManagerIntegrationExample = PlayerCargoManagerIntegrationExample;
}

// Auto-run demo if this file is executed directly
if (typeof require !== 'undefined' && require.main === module) {
    const demo = new PlayerCargoManagerIntegrationExample();
    demo.runDemo().catch(console.error);
}