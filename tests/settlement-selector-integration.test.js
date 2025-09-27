/**
 * Settlement Selector Integration Tests
 * Tests integration with the main trading application
 */

import { SettlementSelector } from '../scripts/settlement-selector.js';

// Mock FoundryVTT globals for testing
global.foundry = {
    utils: {
        randomID: () => 'test-id-' + Math.random().toString(36).substr(2, 9)
    }
};

// Mock data manager with real-like data structure
class IntegrationDataManager {
    constructor() {
        this.settlements = [
            {
                region: "Reikland",
                name: "ALTDORF",
                size: "CS",
                ruler: "Emperor Karl-Franz I Holswig-Schliestein",
                population: 105000,
                wealth: 5,
                source: ["Trade", "Government"],
                garrison: ["500a/8000c"],
                notes: "Imperial Capital, Great Cathedral of Sigmar"
            },
            {
                region: "Reikland",
                name: "Walfen",
                size: "ST",
                ruler: "Emperor",
                population: 152,
                wealth: 2,
                source: ["Brick-making", "Agriculture", "Fishing"],
                garrison: [],
                notes: "Ferry across River Reik"
            },
            {
                region: "Middenland",
                name: "MIDDENHEIM",
                size: "CS",
                ruler: "Graf Boris Todbringer",
                population: 75000,
                wealth: 4,
                source: ["Trade", "Government"],
                garrison: ["1000a/5000c"],
                notes: "City of the White Wolf"
            },
            {
                region: "Middenland",
                name: "Carroburg",
                size: "C",
                ruler: "Graf Boris Todbringer",
                population: 12000,
                wealth: 3,
                source: ["Trade", "River Transport"],
                garrison: ["200a/1000c"],
                notes: "Major river port"
            }
        ];
    }

    getSettlementsByRegion(region) {
        return this.settlements.filter(s => s.region === region);
    }

    getSettlement(name) {
        return this.settlements.find(s => s.name === name) || null;
    }

    getSettlementProperties(settlement) {
        const sizeMapping = {
            'CS': { numeric: 4, description: 'City State' },
            'C': { numeric: 4, description: 'City' },
            'T': { numeric: 3, description: 'Town' },
            'ST': { numeric: 2, description: 'Small Town' },
            'V': { numeric: 1, description: 'Village' },
            'F': { numeric: 2, description: 'Fort' },
            'M': { numeric: 2, description: 'Mine' }
        };

        const wealthDescriptions = {
            1: 'Squalid',
            2: 'Poor',
            3: 'Average',
            4: 'Bustling',
            5: 'Prosperous'
        };

        const wealthModifiers = {
            1: 0.50,
            2: 0.80,
            3: 1.00,
            4: 1.05,
            5: 1.10
        };

        const sizeInfo = sizeMapping[settlement.size];
        
        return {
            name: settlement.name,
            region: settlement.region,
            sizeEnum: settlement.size,
            sizeNumeric: sizeInfo.numeric,
            sizeDescription: sizeInfo.description,
            wealthRating: settlement.wealth,
            wealthModifier: wealthModifiers[settlement.wealth],
            wealthDescription: wealthDescriptions[settlement.wealth],
            population: settlement.population,
            productionCategories: settlement.source,
            garrison: settlement.garrison,
            ruler: settlement.ruler,
            notes: settlement.notes
        };
    }
}

// Mock logger
class IntegrationLogger {
    constructor() {
        this.logs = [];
    }

    logSystem(category, message, data) {
        this.logs.push({ type: 'system', category, message, data, timestamp: Date.now() });
    }

    logDecision(category, message, data) {
        this.logs.push({ type: 'decision', category, message, data, timestamp: Date.now() });
    }

    getLogsByCategory(category) {
        return this.logs.filter(log => log.category === category);
    }

    getLogsByMessage(message) {
        return this.logs.filter(log => log.message.includes(message));
    }

    clearLogs() {
        this.logs = [];
    }
}

describe('Settlement Selector Integration', () => {
    let dataManager;
    let logger;
    let selector;
    let container;

    beforeEach(() => {
        dataManager = new IntegrationDataManager();
        logger = new IntegrationLogger();
        selector = new SettlementSelector(dataManager, logger);
        
        // Create a realistic DOM container
        container = document.createElement('div');
        container.className = 'settlement-section';
        document.body.appendChild(container);
    });

    afterEach(() => {
        if (container && container.parentNode) {
            container.parentNode.removeChild(container);
        }
        logger.clearLogs();
    });

    describe('Real-world Usage Scenarios', () => {
        test('should handle complete settlement selection workflow', () => {
            // Initialize the selector
            selector.initialize(container);

            // Verify initial state
            expect(selector.getSelectedRegion()).toBeNull();
            expect(selector.getSelectedSettlement()).toBeNull();

            // Select a region
            selector.setSelectedRegion('Reikland');
            expect(selector.getSelectedRegion()).toBe('Reikland');

            // Verify settlements are available for the region
            const reiklandSettlements = dataManager.getSettlementsByRegion('Reikland');
            expect(reiklandSettlements.length).toBe(2);
            expect(reiklandSettlements.map(s => s.name)).toContain('ALTDORF');
            expect(reiklandSettlements.map(s => s.name)).toContain('Walfen');

            // Select a settlement
            selector.setSelectedSettlement('ALTDORF');
            expect(selector.getSelectedSettlement().name).toBe('ALTDORF');

            // Verify selection summary
            const summary = selector.getSelectionSummary();
            expect(summary.isComplete).toBe(true);
            expect(summary.region).toBe('Reikland');
            expect(summary.settlement.name).toBe('ALTDORF');
            expect(summary.settlement.size).toBe('CS');
            expect(summary.settlement.wealth).toBe(5);
        });

        test('should handle region switching correctly', () => {
            selector.initialize(container);

            // Start with Reikland
            selector.setSelectedRegion('Reikland');
            selector.setSelectedSettlement('ALTDORF');

            expect(selector.getSelectedSettlement().name).toBe('ALTDORF');

            // Switch to Middenland
            selector.setSelectedRegion('Middenland');

            // Settlement should be cleared when region changes
            expect(selector.getSelectedRegion()).toBe('Middenland');
            
            // Select a Middenland settlement
            selector.setSelectedSettlement('MIDDENHEIM');
            expect(selector.getSelectedSettlement().name).toBe('MIDDENHEIM');
            expect(selector.getSelectedSettlement().region).toBe('Middenland');
        });

        test('should validate selection states correctly', () => {
            selector.initialize(container);

            // No selection
            let validation = selector.validateSelection();
            expect(validation.valid).toBe(false);
            expect(validation.errors).toContain('No region selected');
            expect(validation.errors).toContain('No settlement selected');

            // Region only
            selector.setSelectedRegion('Reikland');
            validation = selector.validateSelection();
            expect(validation.valid).toBe(false);
            expect(validation.hasRegion).toBe(true);
            expect(validation.hasSettlement).toBe(false);
            expect(validation.errors).toContain('No settlement selected');

            // Complete selection
            selector.setSelectedSettlement('ALTDORF');
            validation = selector.validateSelection();
            expect(validation.valid).toBe(true);
            expect(validation.hasRegion).toBe(true);
            expect(validation.hasSettlement).toBe(true);
            expect(validation.errors).toHaveLength(0);
        });

        test('should clear selections properly', () => {
            selector.initialize(container);

            // Set up complete selection
            selector.setSelectedRegion('Reikland');
            selector.setSelectedSettlement('ALTDORF');

            expect(selector.validateSelection().valid).toBe(true);

            // Clear selections
            selector.clearSelections();

            expect(selector.getSelectedRegion()).toBeNull();
            expect(selector.getSelectedSettlement()).toBeNull();
            expect(selector.validateSelection().valid).toBe(false);
        });
    });

    describe('Data Integration', () => {
        test('should work with realistic settlement data', () => {
            selector.initialize(container);

            // Test with all available regions
            const regions = selector.getAllRegions();
            expect(regions).toEqual(['Middenland', 'Reikland']);

            // Test settlement properties for different settlement types
            selector.setSelectedSettlement('ALTDORF');
            const altdorfProps = dataManager.getSettlementProperties(selector.getSelectedSettlement());
            
            expect(altdorfProps.name).toBe('ALTDORF');
            expect(altdorfProps.sizeDescription).toBe('City State');
            expect(altdorfProps.wealthDescription).toBe('Prosperous');
            expect(altdorfProps.productionCategories).toContain('Trade');
            expect(altdorfProps.productionCategories).toContain('Government');

            // Test smaller settlement
            selector.setSelectedSettlement('Walfen');
            const walfenProps = dataManager.getSettlementProperties(selector.getSelectedSettlement());
            
            expect(walfenProps.name).toBe('Walfen');
            expect(walfenProps.sizeDescription).toBe('Small Town');
            expect(walfenProps.wealthDescription).toBe('Poor');
            expect(walfenProps.productionCategories).toContain('Brick-making');
        });

        test('should handle cross-region settlement selection', () => {
            selector.initialize(container);

            // Select settlement from different region should auto-select region
            selector.setSelectedSettlement('MIDDENHEIM');
            
            expect(selector.getSelectedRegion()).toBe('Middenland');
            expect(selector.getSelectedSettlement().name).toBe('MIDDENHEIM');
            expect(selector.getSelectedSettlement().region).toBe('Middenland');
        });
    });

    describe('Logging Integration', () => {
        test('should provide comprehensive logging for debugging', () => {
            selector.initialize(container);

            // Clear initial logs
            logger.clearLogs();

            // Perform operations and check logging
            selector.setSelectedRegion('Reikland');
            selector.setSelectedSettlement('ALTDORF');

            const systemLogs = logger.getLogsByCategory('Settlement Selector');
            expect(systemLogs.length).toBeGreaterThan(0);

            // Check for specific log types
            const regionLogs = logger.getLogsByMessage('Region selection changed');
            expect(regionLogs.length).toBeGreaterThan(0);

            const settlementLogs = logger.getLogsByMessage('Settlement data loaded');
            expect(settlementLogs.length).toBeGreaterThan(0);

            // Validate selection and check decision logging
            selector.validateSelection();
            const decisionLogs = logger.logs.filter(log => log.type === 'decision');
            expect(decisionLogs.length).toBeGreaterThan(0);
        });

        test('should log errors appropriately', () => {
            selector.initialize(container);
            logger.clearLogs();

            // Try to select non-existent settlement
            selector.onSettlementChange('NONEXISTENT_SETTLEMENT');

            const errorLogs = logger.getLogsByMessage('Settlement not found');
            expect(errorLogs.length).toBeGreaterThan(0);

            const errorLog = errorLogs[0];
            expect(errorLog.data.searchName).toBe('NONEXISTENT_SETTLEMENT');
        });
    });

    describe('UI Integration', () => {
        test('should create proper DOM structure', () => {
            selector.initialize(container);

            // Check that all required elements are created
            expect(container.querySelector('.settlement-selector')).toBeTruthy();
            expect(container.querySelector('.region-dropdown')).toBeTruthy();
            expect(container.querySelector('.settlement-dropdown')).toBeTruthy();
            expect(container.querySelector('.settlement-details')).toBeTruthy();

            // Check dropdown population
            const regionDropdown = container.querySelector('.region-dropdown');
            const regionOptions = regionDropdown.querySelectorAll('option');
            expect(regionOptions.length).toBe(3); // Default + 2 regions

            // Check settlement dropdown is initially disabled
            const settlementDropdown = container.querySelector('.settlement-dropdown');
            expect(settlementDropdown.disabled).toBe(true);
        });

        test('should update UI state correctly during selection', () => {
            selector.initialize(container);

            const regionDropdown = container.querySelector('.region-dropdown');
            const settlementDropdown = container.querySelector('.settlement-dropdown');
            const settlementDetails = container.querySelector('.settlement-details');

            // Initial state
            expect(settlementDropdown.disabled).toBe(true);
            expect(settlementDetails.style.display).toBe('none');

            // Select region
            selector.setSelectedRegion('Reikland');
            expect(regionDropdown.value).toBe('Reikland');
            expect(settlementDropdown.disabled).toBe(false);

            // Check settlement options are populated
            const settlementOptions = settlementDropdown.querySelectorAll('option');
            expect(settlementOptions.length).toBe(3); // Default + 2 settlements

            // Select settlement
            selector.setSelectedSettlement('ALTDORF');
            expect(settlementDropdown.value).toBe('ALTDORF');
            expect(settlementDetails.style.display).toBe('block');

            // Check settlement details are populated
            const settlementName = settlementDetails.querySelector('.settlement-name');
            expect(settlementName.textContent).toBe('ALTDORF');
        });
    });
});