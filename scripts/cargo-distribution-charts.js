/**
 * Cargo Distribution Charts - Pie charts showing cargo spawn probabilities
 */

class CargoDistributionCharts {
    constructor(dataManager, cargoAvailabilityPipeline) {
        this.dataManager = dataManager;
        this.pipeline = cargoAvailabilityPipeline;
        this.charts = new Map(); // Store chart instances
    }

    /**
     * Calculate cargo spawn distribution for a settlement
     * @param {Object} settlement - Settlement data
     * @param {string} season - Current season
     * @returns {Object} Distribution data with weights and percentages
     */
    calculateCargoDistribution(settlement, season = 'spring') {
        if (!settlement || !this.pipeline) {
            return { entries: [], totalWeight: 0 };
        }

        try {
            // Use the same logic as the pipeline to build candidate table
            const candidateTable = this.pipeline._buildCandidateTable(
                settlement, 
                settlement.flags || [], 
                season
            );

            if (!candidateTable || !candidateTable.entries) {
                return { entries: [], totalWeight: 0 };
            }

            // Calculate percentages
            const totalWeight = candidateTable.totalWeight || candidateTable.entries.reduce((sum, entry) => sum + (entry.weight || 0), 0);
            const distributionData = candidateTable.entries.map(entry => ({
                name: entry.name,
                category: entry.category,
                weight: entry.weight || 0,
                percentage: totalWeight > 0 ? ((entry.weight || 0) / totalWeight * 100) : 0,
                reasons: entry.reasons || []
            }));

            // Sort by percentage (highest first)
            distributionData.sort((a, b) => b.percentage - a.percentage);

            return {
                entries: distributionData,
                totalWeight: totalWeight,
                season: season
            };
        } catch (error) {
            console.error('Trading Places | Error calculating cargo distribution:', error);
            return { entries: [], totalWeight: 0 };
        }
    }

    /**
     * Consolidate identical probabilities by grouping into categories
     * @param {Array} entries - Distribution entries
     * @returns {Array} Consolidated chart data
     */
    _consolidateIdenticalProbabilities(entries) {
        if (!entries || entries.length === 0) {
            return [];
        }

        // Group entries by rounded percentage (to handle floating point precision)
        const percentageGroups = new Map();
        entries.forEach(entry => {
            const roundedPercentage = Math.round(entry.percentage * 1000) / 1000; // Round to 3 decimal places
            if (!percentageGroups.has(roundedPercentage)) {
                percentageGroups.set(roundedPercentage, []);
            }
            percentageGroups.get(roundedPercentage).push(entry);
        });

        // Find the largest group with identical percentages (>1 member)
        let largestIdenticalGroup = null;
        let largestGroupSize = 1;

        for (const [percentage, group] of percentageGroups) {
            if (group.length > largestGroupSize) {
                largestIdenticalGroup = { percentage, group };
                largestGroupSize = group.length;
            }
        }

        const chartData = [];

        // Process each percentage group
        for (const [percentage, group] of percentageGroups) {
            if (group === largestIdenticalGroup?.group && largestGroupSize > 1) {
                // This is the largest identical group - consolidate by category
                const categoryGroups = new Map();
                
                group.forEach(entry => {
                    const category = entry.category || 'Uncategorized';
                    if (!categoryGroups.has(category)) {
                        categoryGroups.set(category, {
                            entries: [],
                            totalPercentage: 0,
                            totalWeight: 0
                        });
                    }
                    const catGroup = categoryGroups.get(category);
                    catGroup.entries.push(entry);
                    catGroup.totalPercentage += entry.percentage;
                    catGroup.totalWeight += entry.weight;
                });

                // Add category groups to chart data
                for (const [categoryName, catGroup] of categoryGroups) {
                    chartData.push({
                        name: `${categoryName} (${catGroup.entries.length} types)`,
                        category: categoryName,
                        percentage: catGroup.totalPercentage,
                        weight: catGroup.totalWeight,
                        reasons: [
                            `Combined ${catGroup.entries.length} cargo types:`,
                            ...catGroup.entries.map(e => `• ${e.name} (${e.percentage.toFixed(1)}%)`)
                        ]
                    });
                }
            } else {
                // Keep individual entries for non-consolidated groups
                group.forEach(entry => {
                    chartData.push({
                        name: entry.name,
                        category: entry.category,
                        percentage: entry.percentage,
                        weight: entry.weight,
                        reasons: entry.reasons || []
                    });
                });
            }
        }

        // Sort by percentage (highest first)
        chartData.sort((a, b) => b.percentage - a.percentage);

        // Filter out very small percentages for cleaner display
        const significantEntries = chartData.filter(entry => entry.percentage >= 1);
        const smallEntries = chartData.filter(entry => entry.percentage < 1);
        const smallTotal = smallEntries.reduce((sum, entry) => sum + entry.percentage, 0);

        let finalData = [...significantEntries];
        if (smallTotal > 0) {
            finalData.push({
                name: 'Other (small %)',
                category: 'Various',
                percentage: smallTotal,
                weight: smallEntries.reduce((sum, entry) => sum + entry.weight, 0),
                reasons: [`${smallEntries.length} items with <1% chance each`]
            });
        }

        return finalData;
    }

    /**
     * Generate colors for pie chart segments
     * @param {number} count - Number of colors needed
     * @returns {Array} Array of color strings
     */
    generateColors(count) {
        const colors = [];
        
        // Use golden angle to generate well-distributed hues
        const goldenAngle = 137.508; // Golden angle in degrees
        
        for (let i = 0; i < count; i++) {
            const hue = (i * goldenAngle) % 360;
            
            // Vary saturation and lightness for better distinction
            const saturation = 65 + (i % 3) * 10; // 65%, 75%, 85%
            const lightness = 50 + (i % 4) * 8;   // 50%, 58%, 66%, 74%
            
            colors.push(`hsl(${hue}, ${saturation}%, ${lightness}%)`);
        }
        
        return colors;
    }

    /**
     * Render pie chart for cargo distribution
     * @param {string} canvasId - Canvas element ID
     * @param {string} legendId - Legend container ID
     * @param {Object} distributionData - Distribution data
     * @param {string} title - Chart title
     */
    renderPieChart(canvasId, legendId, distributionData, title = 'Cargo Distribution') {
        const canvas = document.getElementById(canvasId);
        const legendContainer = document.getElementById(legendId);
        
        if (!canvas || !legendContainer) {
            console.warn(`Trading Places | Chart containers not found: ${canvasId}, ${legendId}`);
            return;
        }

        // Clear existing chart
        if (this.charts.has(canvasId)) {
            this.charts.get(canvasId).destroy();
        }

        const ctx = canvas.getContext('2d');
        const entries = distributionData.entries || [];

        if (entries.length === 0) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#666';
            ctx.font = '14px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('No cargo data', canvas.width / 2, canvas.height / 2);
            legendContainer.innerHTML = '<div class="legend-item"><span class="legend-label">No settlement selected</span></div>';
            return;
        }

        // Group entries by percentage to consolidate identical probabilities
        const chartData = this._consolidateIdenticalProbabilities(entries);

        const colors = this.generateColors(chartData.length);
        
        // Draw pie chart
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const radius = Math.min(centerX, centerY) - 10;
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        let currentAngle = -Math.PI / 2; // Start at top
        
        chartData.forEach((entry, index) => {
            const sliceAngle = (entry.percentage / 100) * 2 * Math.PI;
            
            // Draw slice
            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle);
            ctx.closePath();
            ctx.fillStyle = colors[index];
            ctx.fill();
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.stroke();
            
            currentAngle += sliceAngle;
        });

        // Create legend
        legendContainer.innerHTML = chartData.map((entry, index) => `
            <div class="legend-item" title="${entry.reasons.join('; ')}">
                <div class="legend-color" style="background-color: ${colors[index]}"></div>
                <span class="legend-label">${entry.name}</span>
                <span class="legend-percentage">${entry.percentage.toFixed(1)}%</span>
            </div>
        `).join('');

        // Store chart reference (for cleanup)
        this.charts.set(canvasId, { destroy: () => ctx.clearRect(0, 0, canvas.width, canvas.height) });
    }

    /**
     * Calculate buyer demand distribution (inverse of merchant supply)
     * @param {Object} settlement - Settlement data
     * @param {string} season - Current season
     * @returns {Object} Distribution data for buyer demand
     */
    calculateBuyerDemandDistribution(settlement, season = 'spring') {
        const merchantDistribution = this.calculateCargoDistribution(settlement, season);
        
        if (!merchantDistribution.entries || merchantDistribution.entries.length === 0) {
            return { entries: [], totalWeight: 0 };
        }

        // Create inverse distribution
        // High merchant supply = Low buyer demand, High merchant demand = High buyer demand
        const invertedEntries = merchantDistribution.entries.map(entry => {
            // Invert the weight: higher merchant availability = lower buyer demand
            // Use a simple inversion formula: maxWeight - currentWeight + minWeight
            const maxWeight = Math.max(...merchantDistribution.entries.map(e => e.weight));
            const minWeight = Math.min(...merchantDistribution.entries.map(e => e.weight));
            const invertedWeight = maxWeight - entry.weight + minWeight;
            
            return {
                name: entry.name,
                category: entry.category,
                weight: invertedWeight,
                percentage: 0, // Will be recalculated
                reasons: [`Buyer demand (inverse of merchant supply)`]
            };
        });

        // Recalculate percentages
        const totalInvertedWeight = invertedEntries.reduce((sum, entry) => sum + entry.weight, 0);
        invertedEntries.forEach(entry => {
            entry.percentage = totalInvertedWeight > 0 ? (entry.weight / totalInvertedWeight * 100) : 0;
        });

        // Sort by percentage
        invertedEntries.sort((a, b) => b.percentage - a.percentage);

        return {
            entries: invertedEntries,
            totalWeight: totalInvertedWeight,
            season: season
        };
    }

    /**
     * Update both buying and selling charts
     * @param {Object} settlement - Settlement data
     * @param {string} season - Current season
     */
    updateCharts(settlement, season = 'spring') {
        if (!settlement) {
            // Clear charts if no settlement
            this.renderPieChart('buying-cargo-distribution-chart', 'buying-chart-legend', { entries: [] });
            this.renderPieChart('selling-cargo-distribution-chart', 'selling-chart-legend', { entries: [] });
            return;
        }

        // Calculate separate distributions
        const merchantDistribution = this.calculateCargoDistribution(settlement, season);
        const buyerDistribution = this.calculateBuyerDemandDistribution(settlement, season);
        
        // Update buying chart (what cargo merchants are selling)
        this.renderPieChart(
            'buying-cargo-distribution-chart', 
            'buying-chart-legend', 
            merchantDistribution,
            'Cargo Spawn Distribution'
        );
        
        // Update selling chart (what buyers want to purchase)
        this.renderPieChart(
            'selling-cargo-distribution-chart', 
            'selling-chart-legend', 
            buyerDistribution,
            'Buyer Demand Distribution'
        );
    }

    /**
     * Clean up chart instances
     */
    destroy() {
        this.charts.forEach(chart => chart.destroy());
        this.charts.clear();
    }
}

export { CargoDistributionCharts };