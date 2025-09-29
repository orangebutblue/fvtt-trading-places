console.log('Trading Places | Loading settlement-selector.js');

/**
 * Trading Places Module - Settlement Selection Component
 * Provides progressive disclosure interface for region and settlement selection
 */

/**
 * Settlement Selector class for progressive disclosure of regions and settlements
 */
class SettlementSelector {
    constructor(dataManager, logger) {
        this.dataManager = dataManager;
        this.logger = logger;
        this.selectedRegion = null;
        this.selectedSettlement = null;
        this.regionDropdown = null;
        this.settlementDropdown = null;
        this.settlementDetails = null;
        this.container = null;
    }

    /**
     * Initialize the settlement selector component
     * @param {HTMLElement} container - Container element to render into
     */
    initialize(container) {
        this.container = container;
        this.logger.logSystem('Settlement Selector', 'Initializing settlement selector component', {
            containerElement: container?.tagName,
            totalSettlements: this.dataManager.settlements?.length || 0
        });

        this.render();
    }

    /**
     * Render the complete settlement selector interface
     */
    render() {
        if (!this.container) {
            this.logger.logSystem('Settlement Selector', 'Cannot render - no container provided', {});
            return;
        }

        this.container.innerHTML = `
            <div class="settlement-selector">
                <div class="selector-row">
                    <div class="region-selector">
                        <label for="region-dropdown">Region:</label>
                        <select id="region-dropdown" class="region-dropdown">
                            <option value="">Select a region...</option>
                        </select>
                    </div>
                    <div class="settlement-selector-dropdown">
                        <label for="settlement-dropdown">Settlement:</label>
                        <select id="settlement-dropdown" class="settlement-dropdown" disabled>
                            <option value="">Select a region first...</option>
                        </select>
                    </div>
                </div>
                <div class="settlement-details" style="display: none;">
                    <div class="settlement-info">
                        <h3 class="settlement-name"></h3>
                        <div class="settlement-properties">
                            <div class="property-grid">
                                <div class="property-item">
                                    <span class="property-label">Region:</span>
                                    <span class="property-value region-value"></span>
                                </div>
                                <div class="property-item">
                                    <span class="property-label">Size:</span>
                                    <span class="property-value size-value"></span>
                                </div>
                                <div class="property-item">
                                    <span class="property-label">Population:</span>
                                    <span class="property-value population-value"></span>
                                </div>
                                <div class="property-item">
                                    <span class="property-label">Wealth:</span>
                                    <span class="property-value wealth-value"></span>
                                </div>
                                <div class="property-item">
                                    <span class="property-label">Ruler:</span>
                                    <span class="property-value ruler-value"></span>
                                </div>
                                <div class="property-item">
                                    <span class="property-label">Production:</span>
                                    <span class="property-value production-value"></span>
                                </div>
                            </div>
                            <div class="settlement-notes">
                                <span class="property-label">Notes:</span>
                                <div class="notes-content"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Get references to DOM elements
        this.regionDropdown = this.container.querySelector('#region-dropdown');
        this.settlementDropdown = this.container.querySelector('#settlement-dropdown');
        this.settlementDetails = this.container.querySelector('.settlement-details');

        // Set up event listeners
        this.setupEventListeners();

        // Populate region dropdown
        this.populateRegionDropdown();
    }

    /**
     * Set up event listeners for dropdowns
     */
    setupEventListeners() {
        if (this.regionDropdown) {
            this.regionDropdown.addEventListener('change', (event) => {
                this.onRegionChange(event.target.value);
            });
        }

        if (this.settlementDropdown) {
            this.settlementDropdown.addEventListener('change', (event) => {
                this.onSettlementChange(event.target.value);
            });
        }
    }

    /**
     * Get all unique regions from settlement data
     * @returns {Array} - Array of unique region names
     */
    getAllRegions() {
        if (!this.dataManager.settlements || !Array.isArray(this.dataManager.settlements) || this.dataManager.settlements.length === 0) {
            this.logger.logSystem('Settlement Selector', 'No settlement data available', {
                settlementsType: typeof this.dataManager.settlements,
                settlementsLength: this.dataManager.settlements?.length
            });
            return [];
        }

        const regions = [...new Set(this.dataManager.settlements.map(settlement => settlement.region))];
        regions.sort();

        this.logger.logSystem('Settlement Selector', 'Extracted regions from settlement data', {
            totalSettlements: this.dataManager.settlements.length,
            uniqueRegions: regions.length,
            regions: regions
        });

        return regions;
    }

    /**
     * Populate the region dropdown with available regions
     */
    populateRegionDropdown() {
        if (!this.regionDropdown) {
            this.logger.logSystem('Settlement Selector', 'Cannot populate region dropdown - element not found', {});
            return;
        }

        const regions = this.getAllRegions();
        
        // Clear existing options except the first one
        this.regionDropdown.innerHTML = '<option value="">Select a region...</option>';

        // Add region options
        regions.forEach(region => {
            const option = document.createElement('option');
            option.value = region;
            option.textContent = region;
            this.regionDropdown.appendChild(option);
        });

        this.logger.logSystem('Settlement Selector', 'Populated region dropdown', {
            regionsAdded: regions.length,
            regions: regions
        });
    }

    /**
     * Handle region selection change
     * @param {string} regionName - Selected region name
     */
    onRegionChange(regionName) {
        this.logger.logSystem('Settlement Selector', 'Region selection changed', {
            previousRegion: this.selectedRegion,
            newRegion: regionName,
            hasValue: !!regionName
        });

        this.selectedRegion = regionName;
        this.selectedSettlement = null;

        // Hide settlement details
        if (this.settlementDetails) {
            this.settlementDetails.style.display = 'none';
        }

        if (!regionName) {
            // No region selected - disable settlement dropdown
            this.disableSettlementDropdown();
            return;
        }

        // Get settlements for the selected region
        const settlements = this.dataManager.getSettlementsByRegion(regionName);
        
        this.logger.logSystem('Settlement Selector', 'Loading settlements for region', {
            region: regionName,
            settlementCount: settlements.length,
            settlements: settlements.map(s => s.name)
        });

        this.populateSettlementDropdown(settlements);
    }

    /**
     * Disable the settlement dropdown
     */
    disableSettlementDropdown() {
        if (!this.settlementDropdown) return;

        this.settlementDropdown.disabled = true;
        this.settlementDropdown.innerHTML = '<option value="">Select a region first...</option>';

        this.logger.logSystem('Settlement Selector', 'Settlement dropdown disabled', {
            reason: 'No region selected'
        });
    }

    /**
     * Populate the settlement dropdown with settlements from selected region
     * @param {Array} settlements - Array of settlement objects
     */
    populateSettlementDropdown(settlements) {
        if (!this.settlementDropdown) {
            this.logger.logSystem('Settlement Selector', 'Cannot populate settlement dropdown - element not found', {});
            return;
        }

        // Clear existing options
        this.settlementDropdown.innerHTML = '<option value="">Select a settlement...</option>';

        // Sort settlements by name
        const sortedSettlements = [...settlements].sort((a, b) => a.name.localeCompare(b.name));

        // Add settlement options
        sortedSettlements.forEach(settlement => {
            const option = document.createElement('option');
            option.value = settlement.name;
            option.textContent = settlement.name;
            this.settlementDropdown.appendChild(option);
        });

        // Enable the dropdown
        this.settlementDropdown.disabled = false;

        this.logger.logSystem('Settlement Selector', 'Populated settlement dropdown', {
            region: this.selectedRegion,
            settlementsAdded: sortedSettlements.length,
            settlements: sortedSettlements.map(s => s.name)
        });
    }

    /**
     * Handle settlement selection change
     * @param {string} settlementName - Selected settlement name
     */
    onSettlementChange(settlementName) {
        this.logger.logSystem('Settlement Selector', 'Settlement selection changed', {
            previousSettlement: this.selectedSettlement?.name,
            newSettlement: settlementName,
            hasValue: !!settlementName
        });

        if (!settlementName) {
            this.selectedSettlement = null;
            if (this.settlementDetails) {
                this.settlementDetails.style.display = 'none';
            }
            return;
        }

        // Get settlement data
        const settlement = this.dataManager.getSettlement(settlementName);
        
        if (!settlement) {
            this.logger.logSystem('Settlement Selector', 'Settlement not found in data', {
                searchName: settlementName,
                region: this.selectedRegion
            });
            return;
        }

        this.selectedSettlement = settlement;

        this.logger.logSystem('Settlement Selector', 'Settlement data loaded', {
            settlementName: settlement.name,
            region: settlement.region,
            size: settlement.size,
            wealth: settlement.wealth,
            population: settlement.population,
            production: settlement.source
        });

        this.displaySettlementDetails(settlement);
    }

    /**
     * Display detailed settlement information
     * @param {Object} settlement - Settlement object
     */
    displaySettlementDetails(settlement) {
        if (!this.settlementDetails) {
            this.logger.logSystem('Settlement Selector', 'Cannot display settlement details - element not found', {});
            return;
        }

        try {
            // Get settlement properties using data manager helper
            const properties = this.dataManager.getSettlementProperties(settlement);

            // Update settlement name
            const nameElement = this.settlementDetails.querySelector('.settlement-name');
            if (nameElement) {
                nameElement.textContent = properties.name;
            }

            // Update property values
            const regionValue = this.settlementDetails.querySelector('.region-value');
            if (regionValue) {
                regionValue.textContent = properties.region;
            }

            const sizeValue = this.settlementDetails.querySelector('.size-value');
            if (sizeValue) {
                sizeValue.textContent = `${properties.sizeDescription} (${properties.sizeEnum})`;
            }

            const populationValue = this.settlementDetails.querySelector('.population-value');
            if (populationValue) {
                populationValue.textContent = properties.population.toLocaleString();
            }

            const wealthValue = this.settlementDetails.querySelector('.wealth-value');
            if (wealthValue) {
                wealthValue.textContent = `${properties.wealthDescription} (${properties.wealthRating})`;
            }

            const rulerValue = this.settlementDetails.querySelector('.ruler-value');
            if (rulerValue) {
                rulerValue.textContent = properties.ruler;
            }

            const productionValue = this.settlementDetails.querySelector('.production-value');
            if (productionValue) {
                productionValue.textContent = properties.productionCategories.join(', ');
            }

            const notesContent = this.settlementDetails.querySelector('.notes-content');
            if (notesContent) {
                notesContent.textContent = properties.notes || 'No additional notes';
            }

            // Show the details panel
            this.settlementDetails.style.display = 'block';

            this.logger.logSystem('Settlement Selector', 'Settlement details displayed', {
                settlementName: properties.name,
                displayedProperties: {
                    region: properties.region,
                    size: `${properties.sizeDescription} (${properties.sizeEnum})`,
                    population: properties.population,
                    wealth: `${properties.wealthDescription} (${properties.wealthRating})`,
                    ruler: properties.ruler,
                    production: properties.productionCategories.join(', '),
                    hasNotes: !!properties.notes
                }
            });

        } catch (error) {
            this.logger.logSystem('Settlement Selector', 'Error displaying settlement details', {
                error: error.message,
                settlementName: settlement.name
            });
            console.error('Error displaying settlement details:', error);
        }
    }

    /**
     * Get the currently selected settlement
     * @returns {Object|null} - Selected settlement object or null
     */
    getSelectedSettlement() {
        return this.selectedSettlement;
    }

    /**
     * Get the currently selected region
     * @returns {string|null} - Selected region name or null
     */
    getSelectedRegion() {
        return this.selectedRegion;
    }

    /**
     * Programmatically set the selected region
     * @param {string} regionName - Region name to select
     */
    setSelectedRegion(regionName) {
        if (!this.regionDropdown) return;

        this.regionDropdown.value = regionName;
        this.onRegionChange(regionName);
    }

    /**
     * Programmatically set the selected settlement
     * @param {string} settlementName - Settlement name to select
     */
    setSelectedSettlement(settlementName) {
        if (!this.settlementDropdown) return;

        // First ensure the correct region is selected
        const settlement = this.dataManager.getSettlement(settlementName);
        if (settlement && settlement.region !== this.selectedRegion) {
            this.setSelectedRegion(settlement.region);
        }

        this.settlementDropdown.value = settlementName;
        this.onSettlementChange(settlementName);
    }

    /**
     * Clear all selections
     */
    clearSelections() {
        this.logger.logSystem('Settlement Selector', 'Clearing all selections', {
            previousRegion: this.selectedRegion,
            previousSettlement: this.selectedSettlement?.name
        });

        if (this.regionDropdown) {
            this.regionDropdown.value = '';
        }

        this.selectedRegion = null;
        this.selectedSettlement = null;

        this.disableSettlementDropdown();

        if (this.settlementDetails) {
            this.settlementDetails.style.display = 'none';
        }
    }

    /**
     * Validate current selection state
     * @returns {Object} - Validation result with success flag and details
     */
    validateSelection() {
        const result = {
            valid: false,
            hasRegion: !!this.selectedRegion,
            hasSettlement: !!this.selectedSettlement,
            errors: []
        };

        if (!this.selectedRegion) {
            result.errors.push('No region selected');
        }

        if (!this.selectedSettlement) {
            result.errors.push('No settlement selected');
        }

        result.valid = result.hasRegion && result.hasSettlement;

        this.logger.logDecision('Settlement Selector', 'Selection validation', {
            valid: result.valid,
            hasRegion: result.hasRegion,
            hasSettlement: result.hasSettlement,
            errors: result.errors,
            selectedRegion: this.selectedRegion,
            selectedSettlement: this.selectedSettlement?.name
        });

        return result;
    }

    /**
     * Get selection summary for logging and display
     * @returns {Object} - Summary of current selection
     */
    getSelectionSummary() {
        return {
            region: this.selectedRegion,
            settlement: this.selectedSettlement ? {
                name: this.selectedSettlement.name,
                size: this.selectedSettlement.size,
                wealth: this.selectedSettlement.wealth,
                population: this.selectedSettlement.population,
                production: this.selectedSettlement.source
            } : null,
            isComplete: !!(this.selectedRegion && this.selectedSettlement)
        };
    }
}

// Export for ES6 modules
export { SettlementSelector };

// Export for global access
window.SettlementSelector = SettlementSelector;
console.log('Trading Places | SettlementSelector class registered globally');