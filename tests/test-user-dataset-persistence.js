// Test script to verify user dataset persistence
import { DataManager } from '../scripts/data-manager.js';

// Mock FoundryVTT game object
global.game = {
    settings: {
        get: jest.fn(),
        set: jest.fn()
    }
};

// Mock MODULE_ID
global.MODULE_ID = 'trading-places';

describe('User Dataset Persistence', () => {
    let dataManager;

    beforeEach(() => {
        dataManager = new DataManager();
        dataManager.activeDatasetName = 'test-user-dataset';

        // Mock user datasets array containing our test dataset
        game.settings.get.mockImplementation((module, key) => {
            if (key === 'userDatasets') {
                return ['test-user-dataset'];
            }
            if (key === 'userDataset_test-user-dataset') {
                return {
                    name: 'test-user-dataset',
                    settlements: [
                        { name: 'Test Settlement', region: 'Test Region', size: 3 }
                    ],
                    cargoTypes: [
                        { name: 'Test Cargo', category: 'Test' }
                    ],
                    config: { test: true }
                };
            }
            return null;
        });

        game.settings.set.mockClear();
    });

    test('should persist user dataset changes after updating settlement', async () => {
        // Load user dataset
        await dataManager.loadUserDataset('test-user-dataset');

        // Update a settlement
        const updatedSettlement = {
            name: 'Test Settlement',
            region: 'Updated Region',
            size: 4
        };

        await dataManager.updateSettlement(updatedSettlement);

        // Verify that settings.set was called to persist the changes
        expect(game.settings.set).toHaveBeenCalledWith(
            'trading-places',
            'userDataset_test-user-dataset',
            expect.objectContaining({
                name: 'test-user-dataset',
                settlements: expect.arrayContaining([
                    expect.objectContaining({
                        name: 'Test Settlement',
                        region: 'Updated Region',
                        size: 4
                    })
                ]),
                cargoTypes: expect.any(Array),
                config: expect.any(Object)
            })
        );
    });

    test('should persist user dataset changes after updating cargo type', async () => {
        // Load user dataset
        await dataManager.loadUserDataset('test-user-dataset');

        // Update a cargo type
        const updatedCargo = {
            name: 'Test Cargo',
            category: 'Updated Category'
        };

        await dataManager.updateCargoType(updatedCargo);

        // Verify that settings.set was called to persist the changes
        expect(game.settings.set).toHaveBeenCalledWith(
            'trading-places',
            'userDataset_test-user-dataset',
            expect.objectContaining({
                name: 'test-user-dataset',
                settlements: expect.any(Array),
                cargoTypes: expect.arrayContaining([
                    expect.objectContaining({
                        name: 'Test Cargo',
                        category: 'Updated Category'
                    })
                ]),
                config: expect.any(Object)
            })
        );
    });

    test('should persist user dataset changes after deleting settlement', async () => {
        // Load user dataset
        await dataManager.loadUserDataset('test-user-dataset');

        // Delete the settlement
        await dataManager.deleteSettlement('Test Settlement');

        // Verify that settings.set was called to persist the changes
        expect(game.settings.set).toHaveBeenCalledWith(
            'trading-places',
            'userDataset_test-user-dataset',
            expect.objectContaining({
                name: 'test-user-dataset',
                settlements: [], // Should be empty after deletion
                cargoTypes: expect.any(Array),
                config: expect.any(Object)
            })
        );
    });

    test('should persist user dataset changes after deleting cargo type', async () => {
        // Load user dataset
        await dataManager.loadUserDataset('test-user-dataset');

        // Delete the cargo type
        await dataManager.deleteCargoType('Test Cargo');

        // Verify that settings.set was called to persist the changes
        expect(game.settings.set).toHaveBeenCalledWith(
            'trading-places',
            'userDataset_test-user-dataset',
            expect.objectContaining({
                name: 'test-user-dataset',
                settlements: expect.any(Array),
                cargoTypes: [], // Should be empty after deletion
                config: expect.any(Object)
            })
        );
    });

    test('should not persist changes for built-in datasets', async () => {
        // Switch to a built-in dataset
        dataManager.activeDatasetName = 'wfrp4e';

        // Mock as built-in dataset (not in userDatasets array)
        game.settings.get.mockImplementation((module, key) => {
            if (key === 'userDatasets') {
                return ['other-dataset']; // Doesn't include wfrp4e
            }
            return null;
        });

        // Try to update a settlement (this would normally work but shouldn't persist)
        const updatedSettlement = {
            name: 'Test Settlement',
            region: 'Updated Region',
            size: 4
        };

        // Mock the settlements array for built-in dataset
        dataManager.settlements = [updatedSettlement];

        await dataManager.updateSettlement(updatedSettlement);

        // Verify that settings.set was NOT called for persistence
        expect(game.settings.set).not.toHaveBeenCalledWith(
            'trading-places',
            'userDataset_wfrp4e',
            expect.any(Object)
        );
    });
});