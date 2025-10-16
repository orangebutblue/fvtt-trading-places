/**
 * Simple test script to verify dataset management functionality
 */

// Mock Foundry Application class
global.Application = class {
    constructor() {}
};

// Mock Foundry ui object
global.ui = {
    notifications: {
        info: jest.fn(),
        error: jest.fn()
    }
};

// Mock Foundry game object for testing
global.game = {
    settings: {
        get: jest.fn(),
        set: jest.fn()
    }
};

// Mock fetch for browser environment
global.fetch = jest.fn();

// Import the settings dialog
const { TradingPlacesSettingsDialog } = require('../scripts/settings-dialog.js');

describe('Dataset Management', () => {
    let settingsDialog;

    beforeEach(() => {
        // Reset mocks
        game.settings.get.mockReset();
        game.settings.set.mockReset();

        // Mock initial settings
        game.settings.get.mockImplementation((module, key) => {
            if (key === 'userDatasets') return ['test-dataset'];
            if (key === 'userDataset_test-dataset') return {
                settlements: [],
                cargoTypes: [],
                config: {}
            };
            return null;
        });

        settingsDialog = new TradingPlacesSettingsDialog();
    });

    test('should get available datasets including user datasets', () => {
        const datasets = settingsDialog.getAvailableDatasets();
        expect(datasets).toHaveProperty('wfrp4e');
        expect(datasets).toHaveProperty('test-dataset');
        expect(datasets['wfrp4e']).toBe('WFRP4e (Built-in)');
        expect(datasets['test-dataset']).toBe('test-dataset (User)');
    });

    test('should create new dataset', async () => {
        const result = await settingsDialog.createDataset('new-test-dataset');

        expect(result).toBe(true);
        expect(game.settings.set).toHaveBeenCalledWith(
            'trading-places',
            'userDatasets',
            expect.arrayContaining(['test-dataset', 'new-test-dataset'])
        );
        expect(game.settings.set).toHaveBeenCalledWith(
            'trading-places',
            'userDataset_new-test-dataset',
            expect.objectContaining({
                settlements: expect.any(Array),
                cargoTypes: expect.any(Array),
                config: expect.any(Object)
            })
        );
    });

    test('should delete user dataset', async () => {
        const result = await settingsDialog.deleteDataset('test-dataset');

        expect(result).toBe(true);
        expect(game.settings.set).toHaveBeenCalledWith(
            'trading-places',
            'userDatasets',
            []
        );
    });

    test('should not delete built-in dataset', async () => {
        const result = await settingsDialog.deleteDataset('wfrp4e');

        expect(result).toBe(false);
        expect(game.settings.set).not.toHaveBeenCalled();
    });
});