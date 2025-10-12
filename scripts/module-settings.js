/**
 * Trading Places Module Settings
 * Handles registration and management of module settings
 */

export class TradingPlacesSettings {
    static MODULE_ID = 'trading-places';
    
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

        // Advanced Settings (hidden from normal config)
        game.settings.register(this.MODULE_ID, 'customDatasetPath', {
            name: 'Custom Dataset Path',
            hint: 'Path to custom trading dataset (for advanced users).',
            scope: 'world',
            config: false, // Hidden from normal settings
            type: String,
            default: ''
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
        const registeredSettings = game.settings.settings.get(this.MODULE_ID);
        
        for (const [key] of registeredSettings) {
            settings[key] = this.getSetting(key);
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