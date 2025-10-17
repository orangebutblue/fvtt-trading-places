/**
 * Trading Places Module Settings
 * Handles registration and management of module settings
 */

export class TradingPlacesSettings {
    static MODULE_ID = 'fvtt-trading-places';
    
    /**
     * Register all module settings
     */
    static registerSettings() {
        // UI Settings
        game.settings.register(this.MODULE_ID, 'compactMode', {
            name: 'Compact UI Mode',
            hint: 'Use a more compact layout for smaller screens.',
            scope: 'client',
            config: true,
            type: Boolean,
            default: false
        });

        // Trading Settings
        game.settings.register(this.MODULE_ID, 'merchantDishonestyChance', {
            name: 'Merchant Dishonesty Chance',
            hint: 'Percentage chance that merchants will misrepresent cargo quality (0-100).',
            scope: 'world',
            config: true,
            type: Number,
            default: 50,
            range: {
                min: 0,
                max: 100,
                step: 5
            }
        });

        // Advanced Settings (hidden from normal config)
        game.settings.register(this.MODULE_ID, 'customDatasetPath', {
            name: 'Custom Dataset Path',
            hint: 'Path to custom trading dataset (for advanced users).',
            scope: 'world',
            config: false, // Hidden from normal settings
            type: String,
            default: ''
        });

        // Custom settlements
        game.settings.register(this.MODULE_ID, 'customSettlements', {
            name: 'Custom Settlements',
            hint: 'User-created settlements from data management',
            type: Array,
            default: [],
            scope: 'world',
            config: false
        });

        // Custom cargo types
        game.settings.register(this.MODULE_ID, 'customCargoTypes', {
            name: 'Custom Cargo Types',
            hint: 'User-created cargo types from data management',
            type: Array,
            default: [],
            scope: 'world',
            config: false
        });

        // User datasets
        game.settings.register(this.MODULE_ID, 'userDatasets', {
            name: 'User Datasets',
            hint: 'List of user-created dataset names',
            type: Array,
            default: [],
            scope: 'world',
            config: false
        });

        // User dataset data
        game.settings.register(this.MODULE_ID, 'userDatasetsData', {
            name: 'User Datasets Data',
            hint: 'Data for all user-created datasets',
            type: Object,
            default: {},
            scope: 'world',
            config: false
        });

        console.log('Trading Places | Settings registered');
    }

    /**
     * Get a setting value
     * @param {string} key - Setting key
     * @returns {*} Setting value
     */
    static getSetting(key) {
        return game.settings.get(this.MODULE_ID, key);
    }

    /**
     * Set a setting value
     * @param {string} key - Setting key
     * @param {*} value - Setting value
     */
    static async setSetting(key, value) {
        return await game.settings.set(this.MODULE_ID, key, value);
    }

    /**
     * Get all settings as an object
     * @returns {Object} All settings
     */
    static getAllSettings() {
        const settings = {};
        
        // Get all registered settings and filter by our module
        for (const [key, setting] of game.settings.settings.entries()) {
            if (key.startsWith(`${this.MODULE_ID}.`)) {
                const settingKey = key.replace(`${this.MODULE_ID}.`, '');
                settings[settingKey] = this.getSetting(settingKey);
            }
        }
        
        return settings;
    }

    /**
     * Export settings to JSON
     * @returns {string} JSON string of settings
     */
    static exportSettings() {
        const settings = this.getAllSettings();
        return JSON.stringify(settings, null, 2);
    }

    /**
     * Import settings from JSON
     * @param {string} jsonString - JSON string of settings
     */
    static async importSettings(jsonString) {
        try {
            const settings = JSON.parse(jsonString);
            const promises = [];
            
            for (const [key, value] of Object.entries(settings)) {
                promises.push(this.setSetting(key, value));
            }
            
            await Promise.all(promises);
            ui.notifications.info('Trading Places settings imported successfully');
        } catch (error) {
            ui.notifications.error('Failed to import settings: ' + error.message);
            console.error('Trading Places | Settings import error:', error);
        }
    }

    /**
     * Reset all settings to defaults
     */
    static async resetToDefaults() {
        const registeredSettings = game.settings.settings.get(this.MODULE_ID);
        const promises = [];
        
        for (const [key, setting] of registeredSettings) {
            promises.push(this.setSetting(key, setting.default));
        }
        
        await Promise.all(promises);
        ui.notifications.info('Trading Places settings reset to defaults');
    }
}

// Export for global access
if (typeof window !== 'undefined') {
    window.TradingPlacesSettings = TradingPlacesSettings;
}