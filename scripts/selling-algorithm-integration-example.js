/**
 * Trading Places Module - WFRP Selling Algorithm Integration Example
 * Demonstrates how to integrate the selling algorithm with the existing trading system
 */

/**
 * Example integration of the WFRP Selling Algorithm with the trading system
 * This shows how to use the selling algorithm in practice
 */
class SellingAlgorithmIntegrationExample {
    constructor() {
        this.dataManager = null;
        this.tradingEngine = null;
        this.sellingAlgorithm = null;
        this.logger = null;
    }

    /**
     * Initialize the integration with required components
     * @param {DataManager} dataManager - Data manager instance
     * @param {TradingEngine} tradingEngine - Trading engine instance
     * @param {DebugLogger} logger - Debug logger instance
     */
    async initialize(dataManager, tradingEngine, logger) {
        this.dataManager = dataManager;
        this.tradingEngine = tradingEngine;
        this.logger = logger;

        // Create and configure selling algorithm
        this.sellingAlgorithm = new WFRPSellingAlgorithm(dataManager, tradingEngine);
        this.sellingAlgorithm.setLogger(logger);

        console.log('Selling Algorithm Integration initialized successfully');
    }

    /**
     * Example 1: Basic cargo selling workflow
     * Demonstrates the standard selling process
     */
    async demonstrateBasicSelling() {
        console.log('\n=== EXAMPLE 1: Basic Cargo Selling ===');

        // Example settlement (Altdorf - major trade center)
        const settlement = {
            name: 'ALTDORF',
            region: 'Reikland',
            size: 'CS',
            wealth: 5,
            population: 105000,
            source: ['Trade', 'Government'],
            garrison: ['500a/8000c'],
            ruler: 'Emperor Karl-Franz I',
            notes: 'Imperial Capital'
        };

        // Example cargo to sell
        const cargoType = 'Wine';
        const quantity = 80; // 80 EP of wine
        const season = 'Summer';

        // Cargo history (where and when it was purchased)
        const cargoHistory = {
            purchaseLocation: 'Marienburg',
            purchaseDate: '2025-01-15'
        };

        try {
            // Execute the complete selling algorithm
            const result = await this.sellingAlgorithm.executeSellingAlgorithm(
                settlement,
                cargoType,
                quantity,
                season,
                { cargoHistory: cargoHistory }
            );

            console.log('Selling Result:', {
                success: result.success,
                settlement: result.settlement,
                cargoType: result.cargoType,
                quantity: result.quantity,
                finalOffer: result.finalOffer?.totalOffer,
                saleType: result.saleType
            });

            if (result.success) {
                console.log(`✅ Successfully sold ${quantity} EP of ${cargoType} for ${result.finalOffer.totalOffer} GC`);
            } else {
                console.log(`❌ Could not sell cargo: ${result.reason}`);
            }

        } catch (error) {
            console.error('Selling failed:', error.message);
        }
    }

    /**
     * Example 2: Selling with haggling
     * Shows how to apply haggling results to the selling process
     */
    async demonstrateSellingWithHaggling() {
        console.log('\n=== EXAMPLE 2: Selling with Haggling ===');

        const settlement = {
            name: 'Marienburg',
            region: 'Wasteland',
            size: 'C',
            wealth: 4,
            population: 50000,
            source: ['Trade'],
            garrison: ['1000a/5000c'],
            ruler: 'Merchant Council',
            notes: 'Major trade hub'
        };

        const cargoType = 'Cloth';
        const quantity = 60;
        const season = 'Winter';

        // Simulate successful haggle test with Dealmaker talent
        const haggleResult = {
            success: true,
            hasDealmakertTalent: true // +20% price increase
        };

        try {
            const result = await this.sellingAlgorithm.executeSellingAlgorithm(
                settlement,
                cargoType,
                quantity,
                season,
                {
                    cargoHistory: { purchaseLocation: 'ALTDORF', purchaseDate: '2025-01-10' },
                    haggleResult: haggleResult
                }
            );

            if (result.success) {
                const baseOffer = result.offerCalculation.totalOffer;
                const finalOffer = result.finalOffer.totalOffer;
                const haggleBonus = finalOffer - baseOffer;

                console.log(`Base offer: ${baseOffer} GC`);
                console.log(`Haggle bonus: +${haggleBonus} GC (${result.finalOffer.haggleDescription})`);
                console.log(`Final offer: ${finalOffer} GC`);
            }

        } catch (error) {
            console.error('Haggling example failed:', error.message);
        }
    }

    /**
     * Example 3: Village selling limitations
     * Demonstrates the special rules for selling in villages
     */
    async demonstrateVillageSelling() {
        console.log('\n=== EXAMPLE 3: Village Selling Limitations ===');

        const village = {
            name: 'Kleinburg',
            region: 'Reikland',
            size: 'V',
            wealth: 2,
            population: 150,
            source: ['Agriculture'],
            garrison: ['None'],
            ruler: 'Village Elder',
            notes: 'Small farming village'
        };

        // Try to sell wine in a village (should be limited)
        const cargoType = 'Wine';
        const quantity = 100; // Want to sell 100 EP
        const season = 'Summer';

        try {
            const result = await this.sellingAlgorithm.executeSellingAlgorithm(
                village,
                cargoType,
                quantity,
                season,
                { cargoHistory: { purchaseLocation: 'ALTDORF', purchaseDate: '2025-01-10' } }
            );

            if (result.villageSpecialCase) {
                console.log(`Village limitation: Can only sell ${result.villageSpecialCase.maxSellableEP} EP of ${quantity} EP requested`);
                
                if (result.success) {
                    console.log(`Sold limited quantity for ${result.finalOffer.totalOffer} GC`);
                }
            }

        } catch (error) {
            console.error('Village selling example failed:', error.message);
        }
    }

    /**
     * Example 4: Desperate sales
     * Shows how to handle emergency cargo sales at reduced prices
     */
    async demonstrateDesperateSales() {
        console.log('\n=== EXAMPLE 4: Desperate Sales ===');

        const tradeCenter = {
            name: 'Marienburg',
            region: 'Wasteland',
            size: 'C',
            wealth: 4,
            population: 50000,
            source: ['Trade'],
            garrison: ['1000a/5000c'],
            ruler: 'Merchant Council',
            notes: 'Major trade hub'
        };

        const cargoType = 'Grain';
        const quantity = 120;
        const season = 'Autumn';

        try {
            // Normal sale for comparison
            const normalResult = await this.sellingAlgorithm.executeSellingAlgorithm(
                tradeCenter,
                cargoType,
                quantity,
                season,
                { cargoHistory: { purchaseLocation: 'ALTDORF', purchaseDate: '2025-01-10' } }
            );

            // Desperate sale
            const desperateResult = await this.sellingAlgorithm.executeSellingAlgorithm(
                tradeCenter,
                cargoType,
                quantity,
                season,
                {
                    saleType: 'desperate',
                    cargoHistory: { purchaseLocation: 'ALTDORF', purchaseDate: '2025-01-10' }
                }
            );

            if (normalResult.success && desperateResult.success) {
                console.log(`Normal sale value: ${normalResult.finalOffer.totalOffer} GC`);
                console.log(`Desperate sale value: ${desperateResult.desperateSale.totalValue} GC`);
                console.log(`Loss from desperate sale: ${normalResult.finalOffer.totalOffer - desperateResult.desperateSale.totalValue} GC`);
            }

        } catch (error) {
            console.error('Desperate sales example failed:', error.message);
        }
    }

    /**
     * Example 5: Rumor sales
     * Demonstrates high-value sales based on market rumors
     */
    async demonstrateRumorSales() {
        console.log('\n=== EXAMPLE 5: Rumor Sales ===');

        const settlement = {
            name: 'Grunburg',
            region: 'Stirland',
            size: 'T',
            wealth: 3,
            population: 2500,
            source: ['Agriculture', 'Livestock'],
            garrison: ['50a/200c'],
            ruler: 'Baron von Grunburg',
            notes: 'Agricultural town'
        };

        const cargoType = 'Wine';
        const quantity = 40;
        const season = 'Winter';

        // Rumor information (obtained through Gossip test)
        const rumorInfo = {
            isValid: true,
            settlementName: 'Grunburg',
            cargoType: 'Wine',
            source: 'Tavern gossip about upcoming festival'
        };

        try {
            // Normal sale for comparison
            const normalResult = await this.sellingAlgorithm.executeSellingAlgorithm(
                settlement,
                cargoType,
                quantity,
                season,
                { cargoHistory: { purchaseLocation: 'ALTDORF', purchaseDate: '2025-01-10' } }
            );

            // Rumor sale
            const rumorResult = await this.sellingAlgorithm.executeSellingAlgorithm(
                settlement,
                cargoType,
                quantity,
                season,
                {
                    saleType: 'rumor',
                    rumorInfo: rumorInfo,
                    cargoHistory: { purchaseLocation: 'ALTDORF', purchaseDate: '2025-01-10' }
                }
            );

            if (normalResult.success && rumorResult.success) {
                console.log(`Normal sale value: ${normalResult.finalOffer.totalOffer} GC`);
                console.log(`Rumor sale value: ${rumorResult.rumorSale.totalValue} GC`);
                console.log(`Bonus from rumor: +${rumorResult.rumorSale.totalValue - normalResult.finalOffer.totalOffer} GC`);
            }

        } catch (error) {
            console.error('Rumor sales example failed:', error.message);
        }
    }

    /**
     * Example 6: Selling restrictions
     * Shows how the algorithm handles various selling restrictions
     */
    async demonstrateSellingRestrictions() {
        console.log('\n=== EXAMPLE 6: Selling Restrictions ===');

        const settlement = {
            name: 'ALTDORF',
            region: 'Reikland',
            size: 'CS',
            wealth: 5,
            population: 105000,
            source: ['Trade', 'Government'],
            garrison: ['500a/8000c'],
            ruler: 'Emperor Karl-Franz I',
            notes: 'Imperial Capital'
        };

        const cargoType = 'Wine';
        const quantity = 50;
        const season = 'Spring';

        // Try to sell at the same location where purchased
        const restrictedCargoHistory = {
            purchaseLocation: 'ALTDORF', // Same as current settlement
            purchaseDate: '2025-01-20'
        };

        try {
            const result = await this.sellingAlgorithm.executeSellingAlgorithm(
                settlement,
                cargoType,
                quantity,
                season,
                { cargoHistory: restrictedCargoHistory }
            );

            if (!result.success) {
                console.log(`❌ Sale blocked: ${result.reason}`);
                console.log('Restrictions:', result.restrictions.map(r => r.description));
            }

        } catch (error) {
            console.error('Restrictions example failed:', error.message);
        }
    }

    /**
     * Run all examples to demonstrate the selling algorithm capabilities
     */
    async runAllExamples() {
        console.log('🏪 WFRP Selling Algorithm Integration Examples');
        console.log('='.repeat(50));

        if (!this.sellingAlgorithm) {
            console.error('❌ Integration not initialized. Call initialize() first.');
            return;
        }

        try {
            await this.demonstrateBasicSelling();
            await this.demonstrateSellingWithHaggling();
            await this.demonstrateVillageSelling();
            await this.demonstrateDesperateSales();
            await this.demonstrateRumorSales();
            await this.demonstrateSellingRestrictions();

            console.log('\n✅ All selling algorithm examples completed successfully!');

        } catch (error) {
            console.error('❌ Example execution failed:', error.message);
        }
    }

    /**
     * Utility method to create a simple cargo object for selling
     * @param {string} cargoType - Type of cargo
     * @param {number} quantity - Quantity in EP
     * @param {string} purchaseLocation - Where the cargo was purchased
     * @param {string} purchaseDate - When the cargo was purchased (YYYY-MM-DD)
     * @param {string} quality - Cargo quality (poor, average, good, excellent)
     * @returns {Object} - Cargo object for selling
     */
    createCargoForSelling(cargoType, quantity, purchaseLocation, purchaseDate, quality = 'average') {
        return {
            type: cargoType,
            quantity: quantity,
            quality: quality,
            history: {
                purchaseLocation: purchaseLocation,
                purchaseDate: purchaseDate
            }
        };
    }

    /**
     * Utility method to simulate a haggle test result
     * @param {boolean} success - Whether the haggle was successful
     * @param {boolean} hasDealmakertTalent - Whether the character has Dealmaker talent
     * @returns {Object} - Haggle result object
     */
    createHaggleResult(success, hasDealmakertTalent = false) {
        return {
            success: success,
            hasDealmakertTalent: hasDealmakertTalent
        };
    }

    /**
     * Utility method to create rumor information
     * @param {string} settlementName - Name of the settlement where rumor applies
     * @param {string} cargoType - Type of cargo in high demand
     * @param {string} source - Source of the rumor information
     * @returns {Object} - Rumor information object
     */
    createRumorInfo(settlementName, cargoType, source) {
        return {
            isValid: true,
            settlementName: settlementName,
            cargoType: cargoType,
            source: source
        };
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SellingAlgorithmIntegrationExample };
} else if (typeof window !== 'undefined') {
    window.SellingAlgorithmIntegrationExample = SellingAlgorithmIntegrationExample;
}

// Example usage in FoundryVTT context
if (typeof game !== 'undefined') {
    // Register as global for easy access in console
    window.sellingExample = new SellingAlgorithmIntegrationExample();
    
    console.log('Selling Algorithm Integration Example loaded. Use window.sellingExample to access.');
}