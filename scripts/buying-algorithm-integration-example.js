/**
 * Trading Places Module - Buying Algorithm Integration Example
 * Shows how to integrate the WFRPBuyingAlgorithm with the existing system
 */

/**
 * Example integration of the WFRP Buying Algorithm with the main trading system
 * This demonstrates how the buying algorithm would be used in the V2 Application
 */
class BuyingAlgorithmIntegrationExample {
    constructor() {
        this.dataManager = null;
        this.buyingAlgorithm = null;
        this.logger = null;
    }

    /**
     * Initialize the buying algorithm integration
     * @returns {Promise<void>}
     */
    async initialize() {
        // Initialize data manager
        this.dataManager = new DataManager();
        await this.dataManager.loadActiveDataset();

        // Initialize debug logger
        this.logger = new WFRPDebugLogger();
        this.logger.setEnabled(true);

        // Initialize buying algorithm
        this.buyingAlgorithm = new WFRPBuyingAlgorithm(this.dataManager, null);
        this.buyingAlgorithm.setLogger(this.logger);
        
        // Load random cargo tables
        await this.buyingAlgorithm.loadRandomCargoTables();

        console.log('Buying Algorithm Integration initialized successfully');
    }

    /**
     * Execute buying workflow for a settlement
     * @param {string} settlementName - Name of the settlement
     * @param {string} season - Current season
     * @param {Object} options - Additional options
     * @returns {Promise<Object>} - Buying result
     */
    async executeBuyingWorkflow(settlementName, season, options = {}) {
        try {
            // Get settlement data
            const settlement = this.dataManager.getSettlement(settlementName);
            if (!settlement) {
                throw new Error(`Settlement not found: ${settlementName}`);
            }

            console.log(`\n=== WFRP Buying Workflow: ${settlementName} (${season}) ===`);

            // Execute the complete buying algorithm
            const result = await this.buyingAlgorithm.executeBuyingAlgorithm(settlement, season, options);

            if (result.success) {
                console.log('\n✅ Cargo Available!');
                console.log(`Settlement: ${result.summary.settlement}`);
                console.log(`Season: ${result.summary.season}`);
                console.log(`Cargo Type: ${result.summary.cargoType}`);
                console.log(`Quantity: ${result.summary.quantity} EP`);
                console.log(`Price per 10 EP: ${result.summary.pricePerTenEP} GC`);
                console.log(`Total Price: ${result.summary.totalPrice} GC`);

                // Show modifiers if any
                if (result.priceResult.modifiers.length > 0) {
                    console.log('\nPrice Modifiers:');
                    result.priceResult.modifiers.forEach(modifier => {
                        console.log(`  - ${modifier.description}: ${modifier.percentage > 0 ? '+' : ''}${modifier.percentage}%`);
                    });
                }
            } else {
                console.log('\n❌ No Cargo Available');
                console.log(`Reason: ${result.reason}`);
                console.log(`Availability Chance: ${result.availabilityResult.chance}%`);
                console.log(`Roll: ${result.availabilityResult.roll}`);
            }

            return result;

        } catch (error) {
            console.error('Buying workflow failed:', error.message);
            throw error;
        }
    }

    /**
     * Demonstrate haggling mechanics
     * @param {string} settlementName - Settlement name
     * @param {string} season - Season
     * @param {Object} haggleResult - Haggle test result
     * @returns {Promise<Object>} - Result with haggling
     */
    async demonstrateHaggling(settlementName, season, haggleResult) {
        console.log(`\n=== Haggling Demo: ${settlementName} ===`);
        
        const options = {
            haggleResult: haggleResult
        };

        return await this.executeBuyingWorkflow(settlementName, season, options);
    }

    /**
     * Compare prices across seasons for a settlement
     * @param {string} settlementName - Settlement name
     * @returns {Promise<void>}
     */
    async compareSeasonalPrices(settlementName) {
        console.log(`\n=== Seasonal Price Comparison: ${settlementName} ===`);
        
        const seasons = ['spring', 'summer', 'autumn', 'winter'];
        const results = {};

        for (const season of seasons) {
            try {
                const result = await this.executeBuyingWorkflow(settlementName, season);
                if (result.success) {
                    results[season] = {
                        cargoType: result.summary.cargoType,
                        quantity: result.summary.quantity,
                        totalPrice: result.summary.totalPrice,
                        pricePerTenEP: result.summary.pricePerTenEP
                    };
                }
            } catch (error) {
                console.log(`${season}: Error - ${error.message}`);
            }
        }

        // Display comparison
        console.log('\nSeasonal Comparison:');
        Object.entries(results).forEach(([season, data]) => {
            console.log(`${season.padEnd(8)}: ${data.cargoType.padEnd(12)} - ${data.pricePerTenEP} GC/10EP (Total: ${data.totalPrice} GC for ${data.quantity} EP)`);
        });
    }

    /**
     * Test different settlement types
     * @param {string} season - Season to test
     * @returns {Promise<void>}
     */
    async testDifferentSettlements(season) {
        console.log(`\n=== Settlement Type Comparison (${season}) ===`);
        
        // Test different settlement types
        const testSettlements = [
            'ALTDORF',      // Large trade center
            'Bögenhafen',   // Town
            'Weissbruck'    // Village
        ];

        for (const settlementName of testSettlements) {
            try {
                const settlement = this.dataManager.getSettlement(settlementName);
                if (settlement) {
                    console.log(`\n--- ${settlementName} (${settlement.size}, Wealth: ${settlement.wealth}) ---`);
                    await this.executeBuyingWorkflow(settlementName, season);
                }
            } catch (error) {
                console.log(`${settlementName}: ${error.message}`);
            }
        }
    }

    /**
     * Get debug log summary
     * @returns {Object} - Debug log summary
     */
    getDebugSummary() {
        if (!this.logger) return null;

        const diagnostics = this.logger.generateDiagnosticReport();
        console.log('\n=== Debug Log Summary ===');
        console.log(`Total Log Entries: ${diagnostics.totalEntries}`);
        console.log('Category Breakdown:');
        Object.entries(diagnostics.categoryCounts).forEach(([category, count]) => {
            console.log(`  ${category}: ${count}`);
        });

        return diagnostics;
    }
}

/**
 * Example usage and demonstration
 */
async function demonstrateBuyingAlgorithm() {
    try {
        // Initialize the integration
        const integration = new BuyingAlgorithmIntegrationExample();
        await integration.initialize();

        // Example 1: Basic buying workflow
        console.log('='.repeat(60));
        console.log('WFRP BUYING ALGORITHM DEMONSTRATION');
        console.log('='.repeat(60));

        await integration.executeBuyingWorkflow('ALTDORF', 'spring');

        // Example 2: Haggling demonstration
        const successfulHaggle = {
            success: true,
            hasDealmakertTalent: true
        };
        await integration.demonstrateHaggling('ALTDORF', 'spring', successfulHaggle);

        // Example 3: Seasonal price comparison
        await integration.compareSeasonalPrices('ALTDORF');

        // Example 4: Different settlement types
        await integration.testDifferentSettlements('autumn');

        // Show debug summary
        integration.getDebugSummary();

    } catch (error) {
        console.error('Demonstration failed:', error);
    }
}

// Make classes available globally for FoundryVTT
if (typeof window !== 'undefined') {
    window.BuyingAlgorithmIntegrationExample = BuyingAlgorithmIntegrationExample;
    window.demonstrateBuyingAlgorithm = demonstrateBuyingAlgorithm;
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        BuyingAlgorithmIntegrationExample,
        demonstrateBuyingAlgorithm
    };
}