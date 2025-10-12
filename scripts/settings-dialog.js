/**
 * Trading Places Settings Dialog
 * Custom settings interface with improved UX
 */

import { TradingPlacesSettings } from './module-settings.js';

export class TradingPlacesSettingsDialog extends Application {
    constructor(options = {}) {
        super(options);
        this.settings = {};
        this.originalSettings = {};
    }

    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            id: 'trading-places-settings',
            title: 'Trading Places Settings',
            template: 'modules/trading-places/templates/settings-dialog.hbs',
            width: 600,
            height: 700,
            resizable: true,
            tabs: [
                {
                    navSelector: '.tabs',
                    contentSelector: '.tab-content',
                    initial: 'general'
                }
            ]
        });
    }

    async getData() {
        // Load current settings
        this.settings = TradingPlacesSettings.getAllSettings();
        this.originalSettings = foundry.utils.duplicate(this.settings);

        // Get system information
        const systemInfo = {
            foundryVersion: game.version,
            moduleVersion: game.modules.get('trading-places')?.version || 'Unknown',
            activeSystem: game.system.id,
            isGM: game.user.isGM
        };

        // Organize settings by category
        const settingsData = {
            general: {
                // No general settings for now
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

    activateListeners(html) {
        super.activateListeners(html);

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

        // Live preview for certain settings
        html.find('select[name="dialogPosition"]').on('change', this._previewDialogPosition.bind(this));
        html.find('input[name="compactMode"]').on('change', this._previewCompactMode.bind(this));
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