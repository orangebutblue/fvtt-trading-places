/**
 * Availability Results Renderer Module
 * Handles rendering of cargo availability check results with improved UI
 */

class AvailabilityResultsRenderer {
    constructor(application) {
        this.app = application;
        this.dataManager = application.dataManager;
    }

    /**
     * Show detailed availability check results with new status banner design
     * @param {Object} params - Parameters object
     * @param {Object} params.availabilityResult - Availability check result
     * @param {Array} params.availableCargo - Available cargo list
     * @param {Object} params.pipelineResult - Pipeline diagnostics
     */
    showAvailabilityResults({ availabilityResult, availableCargo = [], pipelineResult = null } = {}) {
        this.app._logDebug('UI Update', 'Showing availability results', {
            hasAvailabilityResult: !!availabilityResult,
            cargoCount: availableCargo.length,
            hasPipelineResult: !!pipelineResult
        });

        const resultsContainer = this.app.element.querySelector('#availability-results');
        if (!resultsContainer) {
            this.app._logError('UI Update', 'Results container not found');
            return;
        }

        const settlement = this.app.selectedSettlement;
        const season = this.app.currentSeason;

        // Determine settlement size description for display
        const sizeDescription = this.dataManager.getSizeDescription(settlement.size);
        const wealthDescription = this.dataManager.getWealthDescription(settlement.wealth);

        // Generate status banner with emoji and concise text (replaces old header)
        const statusEmoji = availabilityResult.isAvailable ? '✅' : '❌';
        const statusText = availabilityResult.isAvailable ? 'Goods Available' : 'No Goods Found';
        
        let html = `
            <div class="availability-results">
                <div class="availability-status-banner">
                    ${statusEmoji} ${statusText} - ${settlement.name} (${sizeDescription}, ${wealthDescription}) - ${season}
                </div>`;

        // Continue with rest of the method content (simplified for now)
        if (availabilityResult.isAvailable && availableCargo.length > 0) {
            html += `
                <div class="cargo-summary">
                    <h4>Available Cargo (${availableCargo.length} types)</h4>
                    <div class="cargo-list">`;
            
            availableCargo.forEach(cargo => {
                html += `
                    <div class="cargo-item">
                        <span class="cargo-name">${cargo.name}</span>
                        <span class="cargo-quantity">${cargo.quantity || 1}</span>
                        <span class="cargo-price">${cargo.currentPrice || 'N/A'} GC</span>
                    </div>`;
            });
            
            html += `
                    </div>
                </div>`;
        }

        // Add pipeline diagnostics if available
        if (pipelineResult) {
            html += this._renderPipelineDiagnostics(pipelineResult);
        }

        html += `</div>`;

        resultsContainer.innerHTML = html;

        // Update cargo display
        this.app._updateCargoDisplay(availableCargo);

        this.app._logInfo('UI Update', 'Availability results displayed', {
            cargoCount: availableCargo.length,
            isAvailable: availabilityResult.isAvailable
        });
    }

    /**
     * Render pipeline diagnostics (simplified version)
     */
    _renderPipelineDiagnostics(pipelineResult) {
        if (!pipelineResult) return '';
        
        return `
            <div class="pipeline-diagnostics">
                <details>
                    <summary>🧮 Calculation Details</summary>
                    <div class="diagnostics-content">
                        <pre>${JSON.stringify(pipelineResult, null, 2)}</pre>
                    </div>
                </details>
            </div>`;
    }
}

// Export for use in main application
window.AvailabilityResultsRenderer = AvailabilityResultsRenderer;