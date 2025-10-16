/**
 * Trading Places Settings Dialog
 * Custom settings interface with improved UX
 */

const MODULE_ID = "fvtt-trading-places";

import { TradingPlacesSettings } from './module-settings.js';

export class TradingPlacesSettingsDialog extends foundry.applications.api.ApplicationV2 {
    constructor(options = {}) {
        super(options);
        this.settings = {};
        this.originalSettings = {};
    }

    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            id: 'trading-places-settings',
            title: 'Trading Places Settings',
            window: {
                title: 'Trading Places Settings',
                icon: 'fas fa-cog',
                resizable: true
            },
            position: {
                width: 600,
                height: 700
            },
            classes: ['trading-places-settings-dialog']
        });
    }

    async _prepareContext(options) {
        // Load current settings
        this.settings = TradingPlacesSettings.getAllSettings();
        this.originalSettings = foundry.utils.duplicate(this.settings);

        // Get system information
        const systemInfo = {
            foundryVersion: game.version,
            moduleVersion: game.modules.get(MODULE_ID)?.version || 'Unknown',
            activeSystem: game.system.id,
            isGM: game.user.isGM
        };

        // Organize settings by category
        const settingsData = {
            general: {
                activeDataset: game.settings.get(MODULE_ID, 'activeDataset'),
                availableDatasets: this.getAvailableDatasets(),
                availableDatasetsCount: Object.keys(this.getAvailableDatasets()).length
            },
            trading: {
                // No trading settings for now
            },
            ui: {
                compactMode: this.settings.compactMode
            },
            performance: {
                // No settings for now, just import/export functionality
            }
        };

        return {
            settings: settingsData,
            systemInfo,
            hasChanges: false,
            isGM: game.user.isGM
        };
    }

    /**
     * Get available datasets for dropdown
     */
    getAvailableDatasets() {
        const datasets = {};
        
        // Built-in datasets
        datasets['wfrp4e'] = 'WFRP4e (Built-in)';
        
        // User-created datasets
        const userDatasets = game.settings.get(MODULE_ID, 'userDatasets') || [];
        userDatasets.forEach(datasetName => {
            datasets[datasetName] = `${datasetName} (User)`;
        });
        
        return datasets;
    }

    static PARTS = {
        content: {
            template: `modules/${MODULE_ID}/templates/settings-dialog.hbs`,
            classes: ['trading-places-settings']
        }
    }

    _attachPartListeners(html, selector, partId, options) {
        super._attachPartListeners(html, selector, partId, options);

        // Setting change handlers
        html.find('input, select').on('change', this._onSettingChange.bind(this));
        html.find('input[type="range"]').on('input', this._onRangeInput.bind(this));

        // Button handlers
        html.find('.save-settings').on('click', this._onSave.bind(this));
        html.find('.cancel-settings').on('click', this._onCancel.bind(this));
        html.find('.reset-settings').on('click', this._onReset.bind(this));
        html.find('.export-settings').on('click', this._onExport.bind(this));
        html.find('.import-settings').on('click', this._onImport.bind(this));
        html.find('.import-file').on('change', this._onImportFile.bind(this));
        html.find('.create-dataset-btn').on('click', this._onCreateDataset.bind(this));
        html.find('.delete-dataset-btn').on('click', this._onDeleteDataset.bind(this));
    }

    _onSettingChange(event) {
        const settingName = event.target.name;
        let value = event.target.value;

        // Handle different input types
        if (event.target.type === 'checkbox') {
            value = event.target.checked;
        } else if (event.target.type === 'number' || event.target.type === 'range') {
            value = parseFloat(value);
        }

        // Special handling for activeDataset - save immediately and trigger change handler
        if (settingName === 'activeDataset') {
            this._onActiveDatasetChange(value);
            return; // Don't add to pending changes
        }

        // Update settings object
        this.settings[settingName] = value;

        // Update UI to show changes
        this._updateChangeIndicators();

        // Update range display values
        if (event.target.type === 'range') {
            this._updateRangeDisplay(settingName, value);
        }
    }

    _onRangeInput(event) {
        const settingName = event.target.name;
        const value = parseFloat(event.target.value);
        this._updateRangeDisplay(settingName, value);
    }

    _updateRangeDisplay(settingName, value) {
        const display = this.element.find(`[data-range-display="${settingName}"]`);
        if (display.length) {
            let displayValue = value;
            
            // Format specific settings
            if (settingName === 'priceVolatility' || settingName === 'seasonalEffects') {
                displayValue = `${Math.round(value * 100)}%`;
            } else if (settingName === 'cacheTimeout') {
                displayValue = `${value} min${value !== 1 ? 's' : ''}`;
            }
            
            display.text(displayValue);
        }
    }

    _updateChangeIndicators() {
        const hasChanges = !foundry.utils.objectsEqual(this.settings, this.originalSettings);
        
        // Enable/disable save button
        this.element.find('.save-settings').prop('disabled', !hasChanges);
        
        // Show change indicator
        if (hasChanges) {
            this.element.find('.settings-header').addClass('has-changes');
        } else {
            this.element.find('.settings-header').removeClass('has-changes');
        }
    }

    async _onSave(event) {
        event.preventDefault();
        
        try {
            // Save all changed settings
            const promises = [];
            for (const [key, value] of Object.entries(this.settings)) {
                if (this.originalSettings[key] !== value) {
                    promises.push(TradingPlacesSettings.setSetting(key, value));
                }
            }
            
            await Promise.all(promises);
            
            ui.notifications.info('Trading Places settings saved successfully');
            this.originalSettings = foundry.utils.duplicate(this.settings);
            this._updateChangeIndicators();
            
        } catch (error) {
            ui.notifications.error('Failed to save settings: ' + error.message);
            console.error('Trading Places | Settings save error:', error);
        }
    }

    _onCancel(event) {
        event.preventDefault();
        
        if (!foundry.utils.objectsEqual(this.settings, this.originalSettings)) {
            Dialog.confirm({
                title: 'Unsaved Changes',
                content: 'You have unsaved changes. Are you sure you want to cancel?',
                yes: () => this.close(),
                no: () => {}
            });
        } else {
            this.close();
        }
    }

    async _onReset(event) {
        event.preventDefault();
        
        Dialog.confirm({
            title: 'Reset Settings',
            content: 'Are you sure you want to reset all settings to their defaults? This cannot be undone.',
            yes: async () => {
                try {
                    await TradingPlacesSettings.resetToDefaults();
                    this.render(true); // Re-render with new values
                } catch (error) {
                    ui.notifications.error('Failed to reset settings: ' + error.message);
                }
            },
            no: () => {}
        });
    }

    _onExport(event) {
        event.preventDefault();
        
        const settingsJson = TradingPlacesSettings.exportSettings();
        const blob = new Blob([settingsJson], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = 'trading-places-settings.json';
        a.click();
        
        URL.revokeObjectURL(url);
        ui.notifications.info('Settings exported successfully');
    }

    _onImport(event) {
        event.preventDefault();
        this.element.find('.import-file').click();
    }

    _onImportFile(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                await TradingPlacesSettings.importSettings(e.target.result);
                this.render(true); // Re-render with imported values
            } catch (error) {
                ui.notifications.error('Failed to import settings: ' + error.message);
            }
        };
        reader.readAsText(file);
    }

    async _onActiveDatasetChange(newValue) {
        try {
            // Save the setting immediately
            await game.settings.set(MODULE_ID, 'activeDataset', newValue);
            
            // Trigger the change handler (same as in main.js)
            const validation = await this.validateDatasetExists(newValue);
            if (!validation.valid) {
                ui.notifications.error(`Dataset validation failed: ${validation.errors.join(', ')}`);
                return;
            }

            // Reload dataset
            if (window.TradingPlaces?.getDataManager?.()) {
                const dataManager = window.TradingPlaces.getDataManager();
                await dataManager.switchDataset(newValue);
                ui.notifications.info(`Switched to dataset: ${newValue}`);
            }

            // Update last validation timestamp
            await game.settings.set(MODULE_ID, "lastDatasetValidation", new Date().toISOString());

        } catch (error) {
            console.error('Trading Places | Dataset change failed:', error);
            ui.notifications.error(`Failed to switch dataset: ${error.message}`);
        }
    }

    /**
     * Validate that a dataset exists
     */
    async validateDatasetExists(datasetName) {
        try {
            // Check if dataset directory exists
            const fs = require('fs').promises;
            const path = require('path');
                        const datasetPath = path.join(`modules/${MODULE_ID}/datasets`, datasetName);
            
            try {
                await fs.access(datasetPath);
                return { valid: true, errors: [] };
            } catch {
                return {
                    valid: false,
                    errors: [`Dataset '${datasetName}' not found`]
                };
            }
        } catch (error) {
            return {
                valid: false,
                errors: [error.message]
            };
        }
    }

    _previewDialogPosition(event) {
        const position = event.target.value;
        // Could implement live preview of dialog positioning
        console.log('Dialog position preview:', position);
    }

    _previewCompactMode(event) {
        const compactMode = event.target.checked;
        // Could implement live preview of compact mode
        console.log('Compact mode preview:', compactMode);
    }

    async _onCreateDataset(event) {
        event.preventDefault();
        
        const content = `
            <div class="dataset-create-dialog">
                <p>Enter a name for the new dataset:</p>
                <input type="text" id="new-dataset-name" placeholder="e.g., my-custom-dataset" style="width: 100%; padding: 8px; margin: 10px 0;">
                <p><small>The dataset will be created with empty JSON files that you can populate through the Data Management interface.</small></p>
            </div>
        `;

        Dialog.confirm({
            title: 'Create New Dataset',
            content: content,
            yes: async (html) => {
                const datasetName = html.find('#new-dataset-name').val().trim();
                
                if (!datasetName) {
                    ui.notifications.error('Dataset name cannot be empty');
                    return;
                }
                
                if (!/^[a-zA-Z0-9_-]+$/.test(datasetName)) {
                    ui.notifications.error('Dataset name can only contain letters, numbers, hyphens, and underscores');
                    return;
                }
                
                // Check if dataset already exists
                const existingDatasets = game.settings.get(MODULE_ID, 'userDatasets') || [];
                if (existingDatasets.includes(datasetName)) {
                    ui.notifications.error('A dataset with this name already exists');
                    return;
                }
                
                try {
                    // Create the dataset directory and files
                    await this.createDataset(datasetName);
                    
                    // Add to user datasets list
                    existingDatasets.push(datasetName);
                    await game.settings.set(MODULE_ID, 'userDatasets', existingDatasets);
                    
                    ui.notifications.info(`Dataset "${datasetName}" created successfully`);
                    
                    // Refresh dataset choices in Foundry settings
                    if (window.refreshTradingPlacesDatasetChoices) {
                        window.refreshTradingPlacesDatasetChoices();
                    }
                    
                    // Re-render the dialog to show the new dataset
                    this.render(true);
                    
                } catch (error) {
                    ui.notifications.error(`Failed to create dataset: ${error.message}`);
                    console.error('Dataset creation error:', error);
                }
            },
            no: () => {}
        });
    }

    async _onDeleteDataset(event) {
        event.preventDefault();
        
        const currentDataset = game.settings.get(MODULE_ID, 'activeDataset');
        const availableDatasets = this.getAvailableDatasets();
        
        // Filter to only user datasets (exclude built-in)
        const userDatasets = Object.keys(availableDatasets).filter(key => 
            availableDatasets[key].includes('(User)')
        );
        
        if (userDatasets.length === 0) {
            ui.notifications.warn('No user-created datasets to delete');
            return;
        }
        
        let datasetToDelete = null;
        
        if (userDatasets.length === 1) {
            datasetToDelete = userDatasets[0];
        } else {
            // Create a select dropdown for multiple datasets
            const options = userDatasets.map(name => 
                `<option value="${name}" ${name === currentDataset ? 'selected' : ''}>${name}</option>`
            ).join('');
            
            const content = `
                <div class="dataset-delete-dialog">
                    <p>Select the dataset to delete:</p>
                    <select id="dataset-to-delete" style="width: 100%; padding: 8px; margin: 10px 0;">
                        ${options}
                    </select>
                    <p style="color: #ff6b6b;"><strong>Warning:</strong> This action cannot be undone. The dataset files will be permanently deleted.</p>
                </div>
            `;
            
            await new Promise((resolve) => {
                Dialog.confirm({
                    title: 'Delete Dataset',
                    content: content,
                    yes: (html) => {
                        datasetToDelete = html.find('#dataset-to-delete').val();
                        resolve();
                    },
                    no: () => resolve(null)
                });
            });
        }
        
        if (!datasetToDelete) return;
        
        // Confirm deletion
        const confirmContent = `
            <p>Are you sure you want to delete the dataset "${datasetToDelete}"?</p>
            <p style="color: #ff6b6b;"><strong>This action cannot be undone.</strong></p>
            ${datasetToDelete === currentDataset ? '<p style="color: #ffa500;">Note: This is your currently active dataset. It will be deleted but remain selected until you choose another dataset.</p>' : ''}
        `;
        
        Dialog.confirm({
            title: 'Confirm Dataset Deletion',
            content: confirmContent,
            yes: async () => {
                try {
                    // Delete the dataset files
                    await this.deleteDataset(datasetToDelete);
                    
                    // Remove from user datasets list
                    const userDatasets = game.settings.get(MODULE_ID, 'userDatasets') || [];
                    const updatedList = userDatasets.filter(name => name !== datasetToDelete);
                    await game.settings.set(MODULE_ID, 'userDatasets', updatedList);
                    
                    ui.notifications.info(`Dataset "${datasetToDelete}" deleted successfully`);
                    
                    // Refresh dataset choices in Foundry settings
                    if (window.refreshTradingPlacesDatasetChoices) {
                        window.refreshTradingPlacesDatasetChoices();
                    }
                    
                    // Re-render the dialog
                    this.render(true);
                    
                } catch (error) {
                    ui.notifications.error(`Failed to delete dataset: ${error.message}`);
                    console.error('Dataset deletion error:', error);
                }
            },
            no: () => {}
        });
    }

    /**
     * Create a new dataset with empty JSON files
     */
    async createDataset(datasetName) {
        // Since we can't create files in the browser environment,
        // we'll create placeholder data and instruct the user to use Data Management
        
        const placeholderData = {
            settlements: [{
                name: "Example Settlement",
                region: "Example Region",
                size: 3,
                wealth: 3,
                population: 1000,
                ruler: "Local Authority",
                notes: "This is a placeholder settlement. Edit it using the Data Management interface.",
                produces: [],
                demands: [],
                flags: []
            }],
            cargoTypes: [{
                name: "Example Cargo",
                category: "Trade Goods",
                basePrice: 100,
                description: "This is a placeholder cargo type. Edit it using the Data Management interface.",
                seasonalModifiers: {
                    spring: 1.0,
                    summer: 1.0,
                    autumn: 1.0,
                    winter: 1.0
                }
            }],
            config: {
                "system": "wfrp4e",
                "version": "1.0",
                "currency": {
                    "primary": "Gold Crown",
                    "secondary": "Silver Shilling", 
                    "tertiary": "Brass Penny",
                    "rates": {
                        "Gold Crown": 240,
                        "Silver Shilling": 12,
                        "Brass Penny": 1
                    }
                }
            },
            tradingConfig: {
                "cargoSlots": {
                    "basePerSize": {
                        "1": 1,
                        "2": 2,
                        "3": 3,
                        "4": 4,
                        "5": 5
                    },
                    "populationMultiplier": 0.001,
                    "sizeMultiplier": 0.5,
                    "hardCap": 20,
                    "flagMultipliers": {}
                }
            }
        };

        // Get current user datasets list and add the new one
        const userDatasets = game.settings.get(MODULE_ID, 'userDatasets') || [];
        if (!userDatasets.includes(datasetName)) {
            userDatasets.push(datasetName);
            await game.settings.set(MODULE_ID, 'userDatasets', userDatasets);
        }

        // Store the placeholder data in game settings for now
        // In a real implementation, this would create actual files
        await game.settings.set(MODULE_ID, `userDataset_${datasetName}`, placeholderData);
        
        ui.notifications.info(`Dataset "${datasetName}" created with placeholder data. Use the Data Management interface to edit settlements and cargo types.`);
        
        console.log(`Trading Places | Created user dataset: ${datasetName} with placeholder data`);
        
        return true;
    }

    /**
     * Delete a dataset and its files
     */
    async deleteDataset(datasetName) {
        // Check if it's a built-in dataset (shouldn't happen, but safety check)
        if (datasetName === 'wfrp4e') {
            ui.notifications.error('Cannot delete built-in datasets');
            return false;
        }

        try {
            // Get current user datasets list
            const userDatasets = game.settings.get(MODULE_ID, 'userDatasets') || [];

            // Remove the dataset from the list
            const updatedDatasets = userDatasets.filter(name => name !== datasetName);

            // Update the user datasets list
            await game.settings.set(MODULE_ID, 'userDatasets', updatedDatasets);

            // Remove the dataset data
            await game.settings.set(MODULE_ID, `userDataset_${datasetName}`, null);

            ui.notifications.info(`Dataset "${datasetName}" deleted successfully`);
            console.log(`Trading Places | Deleted user dataset: ${datasetName}`);

            return true;
        } catch (error) {
            console.error('Trading Places | Dataset deletion error:', error);
            ui.notifications.error(`Failed to delete dataset: ${error.message}`);
            return false;
        }
    }

    async close(options = {}) {
        if (!foundry.utils.objectsEqual(this.settings, this.originalSettings) && !options.force) {
            Dialog.confirm({
                title: 'Unsaved Changes',
                content: 'You have unsaved changes. Are you sure you want to close?',
                yes: () => super.close({ force: true }),
                no: () => {}
            });
        } else {
            return super.close(options);
        }
    }
}