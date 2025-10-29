/**
 * Trading Places Module - Dataset Persistence Manager
 * Handles loading datasets from files on first launch and persisting to world flags
 */

console.log('🔧 Loading dataset-persistence.js...');
console.log('🔍 Window object available:', typeof window !== 'undefined');

const MODULE_ID = "fvtt-trading-places";
const FLAG_KEY = "datasets";
const INITIALIZED_FLAG_KEY = "datasetsInitialized";

/**
 * Dataset Persistence Manager
 * Manages dataset loading from files and persistence to Foundry world flags
 */
export class DatasetPersistence {
    constructor() {
        this.moduleId = MODULE_ID;
    }

    /**
     * Initialize datasets - load from files on first launch, or restore from settings
     * @returns {Promise<Object>} - Object containing all datasets
     */
    async initialize() {
        console.log('💾 Dataset Persistence: Initializing...');
        
        // Check if datasets have been initialized before (using game.settings)
        let isInitialized = false;
        try {
            isInitialized = game.settings.get(this.moduleId, INITIALIZED_FLAG_KEY);
        } catch (error) {
            // Setting doesn't exist yet, will be created
            isInitialized = false;
        }
        
        if (!isInitialized) {
            console.log('💾 First launch detected - loading datasets from files...');
            await this.loadFromFilesAndPersist();
        } else {
            console.log('💾 Loading datasets from world database...');
        }
        
        // Always return datasets from settings (which are now populated)
        const datasets = await this.loadFromSettings();
        console.log('💾 Dataset Persistence: Loaded', Object.keys(datasets).length, 'datasets');
        return datasets;
    }

    /**
     * Load file-based datasets and persist them to settings (first launch only)
     * @returns {Promise<void>}
     */
    async loadFromFilesAndPersist() {
        console.log('💾 Loading file-based datasets from modules directory...');
        
        // Discover available file-based datasets
        const fileBasedDatasets = await this.discoverFileBasedDatasets();
        
        // Load each dataset from files
        const datasets = {};
        for (const datasetInfo of fileBasedDatasets) {
            try {
                console.log(`💾 Loading dataset: ${datasetInfo.id}...`);
                const dataset = await this.loadDatasetFromFiles(datasetInfo);
                datasets[datasetInfo.id] = dataset;
                console.log(`✅ Loaded dataset: ${datasetInfo.id}`);
            } catch (error) {
                console.error(`❌ Failed to load dataset ${datasetInfo.id}:`, error);
            }
        }
        
        // Persist all datasets to settings
        await this.persistDatasetsToSettings(datasets);
        
        // Mark as initialized
        await game.settings.set(this.moduleId, INITIALIZED_FLAG_KEY, true);
        
        console.log('💾 File-based datasets loaded and persisted to world database');
    }

    /**
     * Discover available file-based datasets in the module
     * @returns {Promise<Array>} - Array of dataset info objects
     */
    async discoverFileBasedDatasets() {
        // For now, we only have wfrp4e as a file-based dataset
        // In the future, this could scan the datasets directory
        return [
            {
                id: 'wfrp4e',
                path: 'wfrp4e',
                label: 'Warhammer Fantasy Roleplay 4th Edition',
                type: 'file-based'
            }
        ];
    }

    /**
     * Load a single dataset from module files
     * @param {Object} datasetInfo - Dataset information object
     * @returns {Promise<Object>} - Complete dataset object
     */
    async loadDatasetFromFiles(datasetInfo) {
        const basePath = `modules/${this.moduleId}/datasets/${datasetInfo.path}`;
        
        const dataset = {
            id: datasetInfo.id,
            label: datasetInfo.label,
            type: 'file-based',
            settlements: [],
            cargoTypes: [],
            config: {},
            tradingConfig: {},
            sourceFlags: {},
            cargo: [],
            history: []
        };
        
        // Load settlements from individual JSON files
        const settlementFiles = [
            'Averland.json', 'Hochland.json', 'Middenland.json', 'Moot.json',
            'Nordland.json', 'Ostermark.json', 'Ostland.json', 'Reikland.json',
            'Stirland.json', 'Sudenland.json', 'Sylvania.json', 'Talabecland.json',
            'Wasteland.json', 'Wissenland.json'
        ];
        
        for (const file of settlementFiles) {
            try {
                const response = await fetch(`${basePath}/settlements/${file}`);
                if (response.ok) {
                    const settlements = await response.json();
                    dataset.settlements.push(...settlements);
                }
            } catch (error) {
                console.warn(`Failed to load settlement file ${file}:`, error);
            }
        }
        
        // Load cargo types
        try {
            const response = await fetch(`${basePath}/cargo-types.json`);
            if (response.ok) {
                const cargoTypesData = await response.json();
                dataset.cargoTypes = cargoTypesData.cargoTypes || [];
            }
        } catch (error) {
            console.warn('Failed to load cargo-types.json:', error);
        }
        
        // Load config
        try {
            const response = await fetch(`${basePath}/config.json`);
            if (response.ok) {
                dataset.config = await response.json();
            }
        } catch (error) {
            console.warn('Failed to load config.json:', error);
        }
        
        // Load trading-config
        try {
            const response = await fetch(`${basePath}/trading-config.json`);
            if (response.ok) {
                dataset.tradingConfig = await response.json();
            }
        } catch (error) {
            console.warn('Failed to load trading-config.json:', error);
        }
        
        // Load source-flags
        try {
            const response = await fetch(`${basePath}/source-flags.json`);
            if (response.ok) {
                dataset.sourceFlags = await response.json();
            }
        } catch (error) {
            console.warn('Failed to load source-flags.json:', error);
        }
        
        console.log(`💾 Dataset ${datasetInfo.id} loaded:`, {
            settlements: dataset.settlements.length,
            cargoTypes: dataset.cargoTypes.length,
            hasConfig: !!dataset.config.currency,
            hasTradingConfig: !!dataset.tradingConfig.populationThresholds
        });
        
        return dataset;
    }

    /**
     * Persist datasets to settings
     * @param {Object} datasets - Object containing all datasets
     * @returns {Promise<void>}
     */
    async persistDatasetsToSettings(datasets) {
        console.log('💾 Persisting datasets to world settings...');
        await game.settings.set(this.moduleId, FLAG_KEY, datasets);
        console.log('✅ Datasets persisted to world settings');
    }

    /**
     * Load all datasets from settings
     * @returns {Promise<Object>} - Object containing all datasets
     */
    async loadFromSettings() {
        try {
            const datasets = game.settings.get(this.moduleId, FLAG_KEY) || {};
            return datasets;
        } catch (error) {
            console.warn('Failed to load datasets from settings:', error);
            return {};
        }
    }

    /**
     * Get a specific dataset by ID
     * @param {string} datasetId - Dataset identifier
     * @returns {Promise<Object>} - Dataset object
     */
    async getDataset(datasetId) {
        const datasets = await this.loadFromSettings();
        return datasets[datasetId] || null;
    }

    /**
     * Update a specific dataset
     * @param {string} datasetId - Dataset identifier
     * @param {Object} datasetData - Updated dataset data
     * @returns {Promise<void>}
     */
    async updateDataset(datasetId, datasetData) {
        const datasets = await this.loadFromSettings();
        datasets[datasetId] = datasetData;
        await this.persistDatasetsToSettings(datasets);
        console.log(`💾 Dataset ${datasetId} updated in world settings`);
    }

    /**
     * Create a new user dataset
     * @param {string} datasetId - Dataset identifier
     * @param {string} label - Dataset display label
     * @returns {Promise<Object>} - Newly created dataset
     */
    async createUserDataset(datasetId, label) {
        console.log(`💾 Creating new user dataset: ${datasetId}`);
        
        // Create default dataset structure
        const dataset = {
            id: datasetId,
            label: label || datasetId,
            type: 'user-created',
            settlements: [
                {
                    region: 'Custom',
                    name: 'Example Settlement',
                    size: 3,
                    ruler: 'Local Authority',
                    population: 5000,
                    wealth: 3,
                    notes: 'This is a dummy settlement. Edit or delete it to customize your dataset.',
                    flags: [],
                    produces: [],
                    demands: [],
                    garrison: {}
                }
            ],
            cargoTypes: [
                {
                    name: 'Example Cargo',
                    category: 'Trade',
                    basePrice: 100,
                    seasonalModifiers: {
                        spring: 1.0,
                        summer: 1.0,
                        autumn: 1.0,
                        winter: 1.0
                    }
                }
            ],
            config: {
                currency: {
                    canonicalUnit: {
                        name: 'Gold',
                        abbreviation: 'G',
                        value: 1
                    },
                    denominations: [],
                    rounding: 'nearest',
                    display: {
                        order: ['G'],
                        includeZeroDenominations: false,
                        separator: ' '
                    }
                },
                inventory: {
                    field: 'items',
                    addMethod: 'createEmbeddedDocuments'
                }
            },
            tradingConfig: this.getDefaultTradingConfig(),
            sourceFlags: {},
            cargo: [],
            history: []
        };
        
        // Persist the new dataset
        const datasets = await this.loadFromSettings();
        datasets[datasetId] = dataset;
        await this.persistDatasetsToSettings(datasets);
        
        console.log(`✅ User dataset ${datasetId} created`);
        return dataset;
    }

    /**
     * Delete a dataset
     * @param {string} datasetId - Dataset identifier
     * @returns {Promise<boolean>} - Success flag
     */
    async deleteDataset(datasetId) {
        console.log(`💾 Deleting dataset: ${datasetId}`);
        
        const datasets = await this.loadFromSettings();
        
        // Don't allow deleting file-based datasets
        if (datasets[datasetId] && datasets[datasetId].type === 'file-based') {
            console.warn(`Cannot delete file-based dataset: ${datasetId}`);
            return false;
        }
        
        delete datasets[datasetId];
        await this.persistDatasetsToSettings(datasets);
        
        console.log(`✅ Dataset ${datasetId} deleted`);
        return true;
    }

    /**
     * Get list of all available datasets
     * @returns {Promise<Array>} - Array of dataset info objects
     */
    async listDatasets() {
        const datasets = await this.loadFromSettings();
        return Object.keys(datasets).map(id => ({
            id,
            label: datasets[id].label,
            type: datasets[id].type,
            settlementCount: datasets[id].settlements?.length || 0,
            cargoTypeCount: datasets[id].cargoTypes?.length || 0
        }));
    }

    /**
     * Update dataset component (settlements, cargoTypes, etc.)
     * @param {string} datasetId - Dataset identifier
     * @param {string} component - Component name (settlements, cargoTypes, config, etc.)
     * @param {*} value - New value for the component
     * @returns {Promise<void>}
     */
    async updateDatasetComponent(datasetId, component, value) {
        const dataset = await this.getDataset(datasetId);
        if (!dataset) {
            throw new Error(`Dataset ${datasetId} not found`);
        }
        
        dataset[component] = value;
        await this.updateDataset(datasetId, dataset);
        console.log(`💾 Dataset ${datasetId}.${component} updated`);
    }

    /**
     * Get default trading config for new datasets
     * @returns {Object} - Default trading configuration
     */
    getDefaultTradingConfig() {
        // Return a simplified version of the wfrp4e trading config
        // Users can customize this later
        return {
            populationThresholds: {
                "1": { "min": 0, "max": 200, "name": "Hamlet" },
                "2": { "min": 201, "max": 1500, "name": "Village" },
                "3": { "min": 1501, "max": 10000, "name": "Town" },
                "4": { "min": 10001, "max": 100000, "name": "City" },
                "5": { "min": 100001, "max": 999999999, "name": "Metropolis" }
            },
            cargoSlots: {
                basePerSize: {
                    "1": 1, "2": 2, "3": 3, "4": 4, "5": 5
                },
                populationMultiplier: 0.0001,
                sizeMultiplier: 1.5,
                flagMultipliers: { "trade": 1.5 },
                hardCap: 10
            },
            pricing: {
                cargoSizeFormula: "(settlementSizeRating + settlementWealthRating) * ceil(d100/10) * 10"
            }
        };
    }

    /**
     * Reset all datasets (force reload from files)
     * WARNING: This will delete all user-created datasets!
     * @returns {Promise<void>}
     */
    async resetAllDatasets() {
        console.warn('⚠️ Resetting all datasets - this will delete user-created datasets!');
        
        // Clear the initialized flag
        await game.settings.set(this.moduleId, INITIALIZED_FLAG_KEY, false);
        
        // Clear all datasets
        await game.settings.set(this.moduleId, FLAG_KEY, {});
        
        // Reload from files
        await this.initialize();
        
        console.log('✅ All datasets reset and reloaded from files');
    }
}

// Expose to window immediately when script loads
if (typeof window !== 'undefined') {
    window.TradingPlacesDatasetPersistence = DatasetPersistence;
    console.log('✅ DatasetPersistence class exposed to window');
    console.log('🔍 window.TradingPlacesDatasetPersistence:', typeof window.TradingPlacesDatasetPersistence);
} else {
    console.error('❌ Window object not available - cannot expose DatasetPersistence');
}

console.log('🔧 dataset-persistence.js loaded completely');
