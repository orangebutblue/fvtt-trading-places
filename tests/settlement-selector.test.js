/**
 * Settlement Selector Component Tests
 */

import { SettlementSelector } from '../scripts/settlement-selector.js';

// Mock data manager for testing
class MockDataManager {
    constructor() {
        this.settlements = [
            {
                region: "Reikland",
                name: "ALTDORF",
                size: "CS",
                ruler: "Emperor Karl-Franz I",
                population: 105000,
                wealth: 5,
                source: ["Trade", "Government"],
                garrison: ["500a/8000c"],
                notes: "Imperial Capital"
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

        const sizeInfo = sizeMapping[settlement.size];
        
        return {
            name: settlement.name,
            region: settlement.region,
            sizeEnum: settlement.size,
            sizeNumeric: sizeInfo.numeric,
            sizeDescription: sizeInfo.description,
            wealthRating: settlement.wealth,
            wealthDescription: wealthDescriptions[settlement.wealth],
            population: settlement.population,
            productionCategories: settlement.source,
            garrison: settlement.garrison,
            ruler: settlement.ruler,
            notes: settlement.notes
        };
    }
}

// Mock logger for testing
class MockLogger {
    constructor() {
        this.logs = [];
    }

    logSystem(category, message, data) {
        this.logs.push({ type: 'system', category, message, data });
    }

    logDecision(category, message, data) {
        this.logs.push({ type: 'decision', category, message, data });
    }

    getLastLog() {
        return this.logs[this.logs.length - 1];
    }

    clearLogs() {
        this.logs = [];
    }
}

describe('SettlementSelector', () => {
    let dataManager;
    let logger;
    let selector;
    let container;

    beforeEach(() => {
        dataManager = new MockDataManager();
        logger = new MockLogger();
        selector = new SettlementSelector(dataManager, logger);
        
        // Create a mock DOM container
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    afterEach(() => {
        if (container && container.parentNode) {
            container.parentNode.removeChild(container);
        }
        logger.clearLogs();
    });

    describe('Initialization', () => {
        test('should initialize with correct dependencies', () => {
            expect(selector.dataManager).toBe(dataManager);
            expect(selector.logger).toBe(logger);
            expect(selector.selectedRegion).toBeNull();
            expect(selector.selectedSettlement).toBeNull();
        });

        test('should log initialization', () => {
            selector.initialize(container);
            
            // Check that initialization was logged (may not be the last log due to other operations)
            const initLogs = logger.logs.filter(log => 
                log.category === 'Settlement Selector' && 
                log.message === 'Initializing settlement selector component'
            );
            expect(initLogs.length).toBeGreaterThan(0);
            
            const log = initLogs[0];
            expect(log.type).toBe('system');
            expect(log.data.totalSettlements).toBe(3);
        });

        test('should render HTML structure', () => {
            selector.initialize(container);
            
            expect(container.querySelector('.settlement-selector')).toBeTruthy();
            expect(container.querySelector('.region-dropdown')).toBeTruthy();
            expect(container.querySelector('.settlement-dropdown')).toBeTruthy();
            expect(container.querySelector('.settlement-details')).toBeTruthy();
        });
    });

    describe('Region Management', () => {
        beforeEach(() => {
            selector.initialize(container);
        });

        test('should extract unique regions from settlement data', () => {
            const regions = selector.getAllRegions();
            
            expect(regions).toEqual(['Middenland', 'Reikland']);
            expect(regions.length).toBe(2);
        });

        test('should populate region dropdown', () => {
            const regionDropdown = container.querySelector('.region-dropdown');
            const options = regionDropdown.querySelectorAll('option');
            
            expect(options.length).toBe(3); // Default option + 2 regions
            expect(options[0].value).toBe('');
            expect(options[1].value).toBe('Middenland');
            expect(options[2].value).toBe('Reikland');
        });

        test('should log region extraction', () => {
            selector.getAllRegions();
            
            const log = logger.getLastLog();
            expect(log.type).toBe('system');
            expect(log.category).toBe('Settlement Selector');
            expect(log.message).toBe('Extracted regions from settlement data');
            expect(log.data.uniqueRegions).toBe(2);
            expect(log.data.regions).toEqual(['Middenland', 'Reikland']);
        });
    });

    describe('Region Selection', () => {
        beforeEach(() => {
            selector.initialize(container);
        });

        test('should handle region selection', () => {
            selector.onRegionChange('Reikland');
            
            expect(selector.selectedRegion).toBe('Reikland');
            expect(selector.selectedSettlement).toBeNull();
        });

        test('should populate settlement dropdown when region selected', () => {
            selector.onRegionChange('Reikland');
            
            const settlementDropdown = container.querySelector('.settlement-dropdown');
            const options = settlementDropdown.querySelectorAll('option');
            
            expect(options.length).toBe(3); // Default option + 2 settlements
            expect(options[1].value).toBe('ALTDORF');
            expect(options[2].value).toBe('Walfen');
            expect(settlementDropdown.disabled).toBe(false);
        });

        test('should disable settlement dropdown when no region selected', () => {
            selector.onRegionChange('');
            
            const settlementDropdown = container.querySelector('.settlement-dropdown');
            expect(settlementDropdown.disabled).toBe(true);
            expect(settlementDropdown.innerHTML).toContain('Select a region first');
        });

        test('should log region selection', () => {
            selector.onRegionChange('Reikland');
            
            const logs = logger.logs.filter(log => 
                log.category === 'Settlement Selector' && 
                log.message === 'Region selection changed'
            );
            expect(logs.length).toBeGreaterThan(0);
            
            const log = logs[logs.length - 1];
            expect(log.data.newRegion).toBe('Reikland');
            expect(log.data.hasValue).toBe(true);
        });
    });

    describe('Settlement Selection', () => {
        beforeEach(() => {
            selector.initialize(container);
            selector.onRegionChange('Reikland');
        });

        test('should handle settlement selection', () => {
            selector.onSettlementChange('ALTDORF');
            
            expect(selector.selectedSettlement).toBeTruthy();
            expect(selector.selectedSettlement.name).toBe('ALTDORF');
        });

        test('should display settlement details', () => {
            selector.onSettlementChange('ALTDORF');
            
            const details = container.querySelector('.settlement-details');
            expect(details.style.display).toBe('block');
            
            const name = container.querySelector('.settlement-name');
            expect(name.textContent).toBe('ALTDORF');
            
            const regionValue = container.querySelector('.region-value');
            expect(regionValue.textContent).toBe('Reikland');
        });

        test('should handle invalid settlement selection', () => {
            selector.onSettlementChange('NONEXISTENT');
            
            expect(selector.selectedSettlement).toBeNull();
            
            const log = logger.getLastLog();
            expect(log.message).toBe('Settlement not found in data');
            expect(log.data.searchName).toBe('NONEXISTENT');
        });

        test('should log settlement selection', () => {
            selector.onSettlementChange('ALTDORF');
            
            const logs = logger.logs.filter(log => 
                log.category === 'Settlement Selector' && 
                log.message === 'Settlement data loaded'
            );
            expect(logs.length).toBeGreaterThan(0);
            
            const log = logs[logs.length - 1];
            expect(log.data.settlementName).toBe('ALTDORF');
            expect(log.data.region).toBe('Reikland');
        });
    });

    describe('Programmatic Selection', () => {
        beforeEach(() => {
            selector.initialize(container);
        });

        test('should set region programmatically', () => {
            selector.setSelectedRegion('Reikland');
            
            expect(selector.selectedRegion).toBe('Reikland');
            
            const regionDropdown = container.querySelector('.region-dropdown');
            expect(regionDropdown.value).toBe('Reikland');
        });

        test('should set settlement programmatically', () => {
            selector.setSelectedSettlement('ALTDORF');
            
            expect(selector.selectedRegion).toBe('Reikland');
            expect(selector.selectedSettlement.name).toBe('ALTDORF');
            
            const settlementDropdown = container.querySelector('.settlement-dropdown');
            expect(settlementDropdown.value).toBe('ALTDORF');
        });
    });

    describe('Selection Validation', () => {
        beforeEach(() => {
            selector.initialize(container);
        });

        test('should validate incomplete selection', () => {
            const result = selector.validateSelection();
            
            expect(result.valid).toBe(false);
            expect(result.hasRegion).toBe(false);
            expect(result.hasSettlement).toBe(false);
            expect(result.errors).toContain('No region selected');
            expect(result.errors).toContain('No settlement selected');
        });

        test('should validate partial selection', () => {
            selector.onRegionChange('Reikland');
            const result = selector.validateSelection();
            
            expect(result.valid).toBe(false);
            expect(result.hasRegion).toBe(true);
            expect(result.hasSettlement).toBe(false);
            expect(result.errors).toContain('No settlement selected');
        });

        test('should validate complete selection', () => {
            selector.onRegionChange('Reikland');
            selector.onSettlementChange('ALTDORF');
            const result = selector.validateSelection();
            
            expect(result.valid).toBe(true);
            expect(result.hasRegion).toBe(true);
            expect(result.hasSettlement).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        test('should log validation results', () => {
            selector.validateSelection();
            
            const log = logger.getLastLog();
            expect(log.type).toBe('decision');
            expect(log.category).toBe('Settlement Selector');
            expect(log.message).toBe('Selection validation');
        });
    });

    describe('Selection Summary', () => {
        beforeEach(() => {
            selector.initialize(container);
        });

        test('should provide empty selection summary', () => {
            const summary = selector.getSelectionSummary();
            
            expect(summary.region).toBeNull();
            expect(summary.settlement).toBeNull();
            expect(summary.isComplete).toBe(false);
        });

        test('should provide complete selection summary', () => {
            selector.onRegionChange('Reikland');
            selector.onSettlementChange('ALTDORF');
            
            const summary = selector.getSelectionSummary();
            
            expect(summary.region).toBe('Reikland');
            expect(summary.settlement.name).toBe('ALTDORF');
            expect(summary.settlement.size).toBe('CS');
            expect(summary.settlement.wealth).toBe(5);
            expect(summary.isComplete).toBe(true);
        });
    });

    describe('Clear Selections', () => {
        beforeEach(() => {
            selector.initialize(container);
            selector.onRegionChange('Reikland');
            selector.onSettlementChange('ALTDORF');
        });

        test('should clear all selections', () => {
            selector.clearSelections();
            
            expect(selector.selectedRegion).toBeNull();
            expect(selector.selectedSettlement).toBeNull();
            
            const regionDropdown = container.querySelector('.region-dropdown');
            expect(regionDropdown.value).toBe('');
            
            const settlementDropdown = container.querySelector('.settlement-dropdown');
            expect(settlementDropdown.disabled).toBe(true);
            
            const details = container.querySelector('.settlement-details');
            expect(details.style.display).toBe('none');
        });

        test('should log clearing selections', () => {
            selector.clearSelections();
            
            // Check that clearing was logged (may not be the last log due to other operations)
            const clearLogs = logger.logs.filter(log => 
                log.category === 'Settlement Selector' && 
                log.message === 'Clearing all selections'
            );
            expect(clearLogs.length).toBeGreaterThan(0);
            
            const log = clearLogs[0];
            expect(log.data.previousRegion).toBe('Reikland');
            expect(log.data.previousSettlement).toBe('ALTDORF');
        });
    });

    describe('Error Handling', () => {
        test('should handle missing container gracefully', () => {
            const selector2 = new SettlementSelector(dataManager, logger);
            
            expect(() => {
                selector2.render();
            }).not.toThrow();
            
            const log = logger.getLastLog();
            expect(log.message).toBe('Cannot render - no container provided');
        });

        test('should handle empty settlement data', () => {
            const emptyDataManager = new MockDataManager();
            emptyDataManager.settlements = [];
            
            const selector2 = new SettlementSelector(emptyDataManager, logger);
            const regions = selector2.getAllRegions();
            
            expect(regions).toEqual([]);
            
            // Check that empty data was logged
            const emptyDataLogs = logger.logs.filter(log => 
                log.category === 'Settlement Selector' && 
                log.message === 'No settlement data available'
            );
            expect(emptyDataLogs.length).toBeGreaterThan(0);
        });
    });
});