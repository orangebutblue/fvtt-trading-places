/**
 * Trading Places Module - Price Calculator Integration Example
 * Demonstrates how to integrate the PriceCalculator component with the existing trading system
 */

/**
 * Example integration of PriceCalculator with the main trading application
 * This shows how to use the component in a real trading workflow
 */
class PriceCalculatorIntegrationExample {
    constructor() {
        this.dataManager = null;
        this.tradingEngine = null;
        this.priceCalculator = null;
        this.logger = null;
    }

    /**
     * Initialize the integration with required dependencies
     * @param {DataManager} dataManager - Data manager instance
     * @param {TradingEngine} tradingEngine - Trading engine instance
     * @param {DebugLogger} logger - Debug logger instance
     */
    async initialize(dataManager, tradingEngine, logger) {
        this.dataManager = dataManager;
        this.tradingEngine = tradingEngine;
        this.logger = logger;

        // Create price calculator instance
        this.priceCalculator = new PriceCalculator(dataManager, tradingEngine);
        this.priceCalculator.setLogger(logger);

        this.logger.logSystem('Price Calculator Integration', 'Price calculator initialized successfully', {
            component: 'PriceCalculator',
            status: 'ready'
        });
    }

    /**
     * Example: Calculate buying price with full breakdown
     * @param {string} cargoType - Type of cargo to buy
     * @param {number} quantity - Quantity in EP
     * @param {Object} options - Buying options
     * @returns {Object} - Complete price breakdown with display data
     */
    async calculateBuyingPrice(cargoType, quantity, options = {}) {
        this.logger.logSystem('Price Calculation', 'Starting buying price calculation', {
            cargoType,
            quantity,
            options
        });

        try {
            // Get current season from trading engine
            const season = this.tradingEngine.getCurrentSeason();
            if (!season) {
                throw new Error('Season must be set before calculating prices');
            }

            // Calculate comprehensive price breakdown
            const priceBreakdown = this.priceCalculator.calculateBuyingPriceBreakdown(
                cargoType,
                quantity,
                season,
                options
            );

            // Generate display-ready data
            const displayData = this.priceCalculator.generatePriceDisplayData(priceBreakdown);

            this.logger.logSystem('Price Calculation', 'Buying price calculation completed', {
                cargoType,
                totalPrice: priceBreakdown.totalPrice,
                modifiers: priceBreakdown.modifiers.length
            });

            return {
                success: true,
                priceBreakdown,
                displayData,
                summary: {
                    cargoType,
                    quantity,
                    season,
                    totalPrice: priceBreakdown.totalPrice,
                    pricePerUnit: priceBreakdown.finalPricePerUnit,
                    modifiersApplied: priceBreakdown.modifiers.length
                }
            };

        } catch (error) {
            this.logger.logSystem('Price Calculation', 'Buying price calculation failed', {
                error: error.message,
                cargoType,
                quantity
            }, 'ERROR');

            return {
                success: false,
                error: error.message,
                cargoType,
                quantity
            };
        }
    }

    /**
     * Example: Calculate selling price with settlement context
     * @param {string} cargoType - Type of cargo to sell
     * @param {number} quantity - Quantity in EP
     * @param {Object} settlement - Settlement object
     * @param {Object} options - Selling options
     * @returns {Object} - Complete price breakdown with display data
     */
    async calculateSellingPrice(cargoType, quantity, settlement, options = {}) {
        this.logger.logSystem('Price Calculation', 'Starting selling price calculation', {
            cargoType,
            quantity,
            settlementName: settlement.name,
            options
        });

        try {
            // Get current season from trading engine
            const season = this.tradingEngine.getCurrentSeason();
            if (!season) {
                throw new Error('Season must be set before calculating prices');
            }

            // Validate settlement for trading
            const settlementValidation = this.tradingEngine.validateSettlementForTrading(settlement);
            if (!settlementValidation.valid) {
                throw new Error(`Invalid settlement: ${settlementValidation.errors.join(', ')}`);
            }

            // Calculate comprehensive price breakdown
            const priceBreakdown = this.priceCalculator.calculateSellingPriceBreakdown(
                cargoType,
                quantity,
                season,
                settlement,
                options
            );

            // Generate display-ready data
            const displayData = this.priceCalculator.generatePriceDisplayData(priceBreakdown);

            this.logger.logSystem('Price Calculation', 'Selling price calculation completed', {
                cargoType,
                settlement: settlement.name,
                totalPrice: priceBreakdown.totalPrice,
                wealthModifier: priceBreakdown.settlementInfo.wealthModifier
            });

            return {
                success: true,
                priceBreakdown,
                displayData,
                summary: {
                    cargoType,
                    quantity,
                    season,
                    settlement: settlement.name,
                    totalPrice: priceBreakdown.totalPrice,
                    pricePerUnit: priceBreakdown.finalPricePerUnit,
                    wealthAdjustment: priceBreakdown.wealthAdjustedPrice - priceBreakdown.basePricePerUnit
                }
            };

        } catch (error) {
            this.logger.logSystem('Price Calculation', 'Selling price calculation failed', {
                error: error.message,
                cargoType,
                quantity,
                settlementName: settlement.name
            }, 'ERROR');

            return {
                success: false,
                error: error.message,
                cargoType,
                quantity,
                settlement: settlement.name
            };
        }
    }

    /**
     * Example: Calculate price comparison across multiple settlements
     * @param {string} cargoType - Type of cargo
     * @param {number} quantity - Quantity in EP
     * @param {Array} settlements - Array of settlement objects
     * @returns {Object} - Price comparison results
     */
    async compareSellingPrices(cargoType, quantity, settlements) {
        this.logger.logSystem('Price Comparison', 'Starting multi-settlement price comparison', {
            cargoType,
            quantity,
            settlementCount: settlements.length
        });

        const results = [];
        const season = this.tradingEngine.getCurrentSeason();

        for (const settlement of settlements) {
            try {
                const priceResult = await this.calculateSellingPrice(cargoType, quantity, settlement);
                if (priceResult.success) {
                    results.push({
                        settlement: settlement.name,
                        region: settlement.region,
                        totalPrice: priceResult.priceBreakdown.totalPrice,
                        pricePerUnit: priceResult.priceBreakdown.finalPricePerUnit,
                        wealthRating: priceResult.priceBreakdown.settlementInfo.wealthRating,
                        wealthModifier: priceResult.priceBreakdown.settlementInfo.wealthModifier
                    });
                }
            } catch (error) {
                this.logger.logSystem('Price Comparison', 'Settlement price calculation failed', {
                    settlement: settlement.name,
                    error: error.message
                }, 'WARNING');
            }
        }

        // Sort by total price (highest first for selling)
        results.sort((a, b) => b.totalPrice - a.totalPrice);

        const bestSettlement = results[0];
        const worstSettlement = results[results.length - 1];
        const priceRange = bestSettlement ? bestSettlement.totalPrice - worstSettlement.totalPrice : 0;

        this.logger.logSystem('Price Comparison', 'Multi-settlement comparison completed', {
            cargoType,
            settlementsAnalyzed: results.length,
            bestSettlement: bestSettlement?.settlement,
            bestPrice: bestSettlement?.totalPrice,
            priceRange
        });

        return {
            cargoType,
            quantity,
            season,
            results,
            bestSettlement,
            worstSettlement,
            priceRange,
            averagePrice: results.length > 0 ? results.reduce((sum, r) => sum + r.totalPrice, 0) / results.length : 0
        };
    }

    /**
     * Example: Calculate haggling scenarios for a transaction
     * @param {string} cargoType - Type of cargo
     * @param {number} quantity - Quantity in EP
     * @param {string} transactionType - 'buying' or 'selling'
     * @param {Object} context - Transaction context (settlement for selling)
     * @returns {Object} - Haggling scenario analysis
     */
    async analyzeHagglingScenarios(cargoType, quantity, transactionType, context = {}) {
        this.logger.logSystem('Haggling Analysis', 'Starting haggling scenario analysis', {
            cargoType,
            quantity,
            transactionType,
            context
        });

        try {
            let basePrice;
            
            if (transactionType === 'buying') {
                const buyingResult = await this.calculateBuyingPrice(cargoType, quantity, context);
                if (!buyingResult.success) {
                    throw new Error(buyingResult.error);
                }
                basePrice = buyingResult.priceBreakdown.finalPricePerUnit;
            } else {
                if (!context.settlement) {
                    throw new Error('Settlement required for selling price analysis');
                }
                const sellingResult = await this.calculateSellingPrice(cargoType, quantity, context.settlement, context);
                if (!sellingResult.success) {
                    throw new Error(sellingResult.error);
                }
                basePrice = sellingResult.priceBreakdown.finalPricePerUnit;
            }

            // Calculate haggling outcomes
            const haggleOutcomes = this.priceCalculator.calculateHaggleOutcomes(basePrice, transactionType);
            
            // Calculate potential savings/gains
            const totalUnits = Math.ceil(quantity / 10);
            const scenarios = {};
            
            Object.keys(haggleOutcomes).forEach(scenarioKey => {
                const outcome = haggleOutcomes[scenarioKey];
                const totalPrice = outcome.pricePerUnit * totalUnits;
                const difference = totalPrice - (basePrice * totalUnits);
                
                scenarios[scenarioKey] = {
                    ...outcome,
                    totalPrice: Math.round(totalPrice * 100) / 100,
                    difference: Math.round(difference * 100) / 100,
                    percentageDifference: basePrice > 0 ? Math.round((difference / (basePrice * totalUnits)) * 100 * 10) / 10 : 0
                };
            });

            this.logger.logSystem('Haggling Analysis', 'Haggling scenario analysis completed', {
                cargoType,
                transactionType,
                basePrice,
                scenarioCount: Object.keys(scenarios).length
            });

            return {
                cargoType,
                quantity,
                transactionType,
                basePrice,
                totalUnits,
                scenarios,
                recommendations: {
                    worthHaggling: scenarios.successfulHaggle.difference !== 0,
                    dealmakerAdvantage: Math.abs(scenarios.successfulHaggleWithDealmaker.difference - scenarios.successfulHaggle.difference),
                    riskAssessment: transactionType === 'buying' ? 'Low risk - can only save money' : 'Low risk - can only gain money'
                }
            };

        } catch (error) {
            this.logger.logSystem('Haggling Analysis', 'Haggling analysis failed', {
                error: error.message,
                cargoType,
                transactionType
            }, 'ERROR');

            return {
                success: false,
                error: error.message,
                cargoType,
                transactionType
            };
        }
    }

    /**
     * Example: Generate comprehensive trading report
     * @param {Object} tradingSession - Trading session data
     * @returns {Object} - Comprehensive trading report
     */
    async generateTradingReport(tradingSession) {
        this.logger.logSystem('Trading Report', 'Generating comprehensive trading report', {
            sessionId: tradingSession.id,
            transactionCount: tradingSession.transactions?.length || 0
        });

        const report = {
            sessionId: tradingSession.id,
            season: this.tradingEngine.getCurrentSeason(),
            timestamp: new Date().toISOString(),
            transactions: [],
            summary: {
                totalTransactions: 0,
                totalValue: 0,
                totalSavings: 0,
                mostProfitableCargo: null,
                bestSettlement: null
            }
        };

        if (tradingSession.transactions) {
            for (const transaction of tradingSession.transactions) {
                try {
                    let priceAnalysis;
                    
                    if (transaction.type === 'buying') {
                        priceAnalysis = await this.calculateBuyingPrice(
                            transaction.cargoType,
                            transaction.quantity,
                            transaction.options || {}
                        );
                    } else {
                        priceAnalysis = await this.calculateSellingPrice(
                            transaction.cargoType,
                            transaction.quantity,
                            transaction.settlement,
                            transaction.options || {}
                        );
                    }

                    if (priceAnalysis.success) {
                        report.transactions.push({
                            ...transaction,
                            priceAnalysis: priceAnalysis.summary,
                            displayData: priceAnalysis.displayData
                        });

                        report.summary.totalValue += priceAnalysis.priceBreakdown.totalPrice;
                    }

                } catch (error) {
                    this.logger.logSystem('Trading Report', 'Transaction analysis failed', {
                        transactionId: transaction.id,
                        error: error.message
                    }, 'WARNING');
                }
            }
        }

        report.summary.totalTransactions = report.transactions.length;

        this.logger.logSystem('Trading Report', 'Trading report generated successfully', {
            sessionId: tradingSession.id,
            transactionsAnalyzed: report.summary.totalTransactions,
            totalValue: report.summary.totalValue
        });

        return report;
    }

    /**
     * Example: Render price calculator display in UI
     * @param {Object} priceData - Price calculation result
     * @param {HTMLElement} container - Container element
     */
    renderPriceDisplay(priceData, container) {
        if (!priceData.success || !priceData.displayData) {
            container.innerHTML = '<div class="error">Price calculation failed</div>';
            return;
        }

        // In a real implementation, this would use the Handlebars template
        // For this example, we'll create a simple HTML structure
        const displayHtml = `
            <div class="price-calculator-display">
                <div class="price-header">
                    <h3 class="cargo-title">${priceData.displayData.cargoType} Price Calculation</h3>
                    <div class="calculation-meta">
                        <span class="season-badge season-${priceData.displayData.season}">${priceData.displayData.season}</span>
                        <span class="calculation-type">${priceData.displayData.calculationType}</span>
                    </div>
                </div>
                
                <div class="quantity-info">
                    <div class="quantity-display">
                        <strong>Quantity:</strong> ${priceData.displayData.formattedPrices.quantityDescription}
                    </div>
                </div>
                
                <div class="final-price-section">
                    <h4>Final Calculated Price</h4>
                    <div class="price-breakdown">
                        <div class="price-per-unit">
                            <span class="label">Price per 10 EP:</span>
                            <span class="value">${priceData.displayData.formattedPrices.finalPrice}</span>
                        </div>
                        <div class="total-price">
                            <span class="label">Total Price:</span>
                            <span class="value total-amount">${priceData.displayData.formattedPrices.totalPrice}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;

        container.innerHTML = displayHtml;

        this.logger.logSystem('UI Rendering', 'Price display rendered successfully', {
            cargoType: priceData.displayData.cargoType,
            totalPrice: priceData.priceBreakdown.totalPrice
        });
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { PriceCalculatorIntegrationExample };
} else if (typeof window !== 'undefined') {
    window.PriceCalculatorIntegrationExample = PriceCalculatorIntegrationExample;
}