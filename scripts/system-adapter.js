/**
 * Trading Places Module - System Adapter
 * Configuration-driven adapter for currency and inventory management across different game systems
 */

let CurrencyUtils = null;
try {
    CurrencyUtils = require('./currency-utils');
} catch (error) {
    // Ignore require failures for browser context; fallback provided below.
}

if (typeof window !== 'undefined' && window.TradingPlacesCurrencyUtils) {
    CurrencyUtils = window.TradingPlacesCurrencyUtils;
}

/**
 * SystemAdapter class for handling currency and inventory operations
 * Uses configuration-driven field paths to work with different game systems
 */
class SystemAdapter {
    constructor(config = null) {
        this.config = this.mergeSystemConfig(config);
        this.systemId = (typeof game !== 'undefined' && game?.system?.id) || 'unknown';
        this.isFoundryEnvironment = typeof game !== 'undefined';
        this.debugMode = false;
        this.errorHandler = null;
        this.currencySchema = null;
        this.normalizedCurrencySchema = null;
    this.currencyFieldMap = null;
        
        // Try to get error handler from global scope
        if (typeof window !== 'undefined' && window.WFRPRiverTrading?.getErrorHandler) {
            this.errorHandler = window.WFRPRiverTrading.getErrorHandler();
        }
    }

    mergeSystemConfig(overrides = null) {
        const defaultConfig = this.getDefaultConfig();

        if (!overrides || typeof overrides !== 'object') {
            return defaultConfig;
        }

        const mergedCurrency = {
            ...defaultConfig.currency,
            ...(overrides.currency || {})
        };

        if (overrides.currency && overrides.currency.field === undefined && defaultConfig.currency.field) {
            mergedCurrency.field = defaultConfig.currency.field;
        }

        if (overrides.currency && overrides.currency.fields === undefined && defaultConfig.currency.fields) {
            mergedCurrency.fields = { ...defaultConfig.currency.fields };
        }

        return {
            ...defaultConfig,
            ...overrides,
            currency: mergedCurrency
        };
    }

    /**
     * Get default configuration for supported systems
     * @returns {Object} - Default system configuration
     */
    getDefaultConfig() {
        return {
            currency: {
                field: 'system.money.gc', // Legacy single-value path
                fields: {
                    GC: 'system.money.gc',
                    SS: 'system.money.ss',
                    BP: 'system.money.bp'
                },
                type: 'denomination',
                label: 'Gold Crowns'
            },
            inventory: {
                field: 'items',
                method: 'createEmbeddedDocuments',
                deleteMethod: 'deleteEmbeddedDocuments',
                type: 'loot'
            },
            validation: {
                requiredActorType: 'character',
                requiredFields: ['system.money', 'items']
            }
        };
    }

    getFallbackCurrencySchema() {
        return {
            canonicalUnit: {
                name: 'Brass Penny',
                pluralName: 'Brass Pennies',
                abbreviation: 'BP',
                value: 1
            },
            denominations: [
                {
                    name: 'Gold Crown',
                    pluralName: 'Gold Crowns',
                    abbreviation: 'GC',
                    value: 240
                },
                {
                    name: 'Silver Shilling',
                    pluralName: 'Silver Shillings',
                    abbreviation: 'SS',
                    value: 12
                },
                {
                    name: 'Brass Penny',
                    pluralName: 'Brass Pennies',
                    abbreviation: 'BP',
                    value: 1
                }
            ],
            display: {
                order: ['GC', 'SS', 'BP'],
                includeZeroDenominations: false,
                separator: ' '
            }
        };
    }

    /**
     * Load configuration from DataManager or use defaults
     * @param {Object} dataManager - DataManager instance with config
     */
    loadConfiguration(dataManager) {
        const defaultConfig = this.getDefaultConfig();
        const datasetConfig = dataManager?.config || {};

        const overrides = { ...datasetConfig };
        if (datasetConfig.currency) {
            overrides.currency = {
                ...defaultConfig.currency,
                ...datasetConfig.currency
            };
        }

        this.config = this.mergeSystemConfig(overrides);
        this.currencyFieldMap = null;

        if (dataManager && typeof dataManager.getCurrencyConfig === 'function') {
            this.currencySchema = dataManager.getCurrencyConfig();
        } else if (datasetConfig.currency) {
            this.currencySchema = datasetConfig.currency;
        } else {
            this.currencySchema = this.getFallbackCurrencySchema();
        }

        if (dataManager && typeof dataManager.getNormalizedCurrencyConfig === 'function') {
            try {
                this.normalizedCurrencySchema = dataManager.getNormalizedCurrencyConfig();
            } catch (error) {
                this.normalizedCurrencySchema = null;
            }
        } else {
            this.normalizedCurrencySchema = null;
        }

        if (!this.normalizedCurrencySchema && CurrencyUtils && this.currencySchema) {
            try {
                this.normalizedCurrencySchema = CurrencyUtils.normalizeConfig(this.currencySchema);
            } catch (error) {
                this.normalizedCurrencySchema = null;
            }
        }
    }

    /**
     * Validate system compatibility and configuration
     * @returns {Object} - Validation result with success flag and errors
     */
    validateSystemCompatibility() {
        const result = {
            compatible: true,
            errors: [],
            warnings: [],
            systemId: this.systemId
        };

        // Check if we're in FoundryVTT environment
        if (!this.isFoundryEnvironment) {
            result.compatible = false;
            result.errors.push('SystemAdapter requires FoundryVTT environment');
            return result;
        }

        // Check if configuration is valid
        if (!this.config) {
            result.compatible = false;
            result.errors.push('No system configuration loaded');
            return result;
        }

        // Validate currency configuration
        const fieldMap = this.getCurrencyFieldMap();
        if (!this.config.currency || Object.keys(fieldMap).length === 0) {
            result.compatible = false;
            result.errors.push('Currency field configuration missing');
        }

        // Validate inventory configuration
        if (!this.config.inventory || !this.config.inventory.field) {
            result.compatible = false;
            result.errors.push('Inventory field configuration missing');
        }

        // System-specific validation
        if (this.systemId !== 'wfrp4e') {
            result.warnings.push(`System '${this.systemId}' may not be fully supported. Configuration may need adjustment.`);
        }

        return result;
    }

    /**
     * Validate actor for trading operations
     * @param {Object} actor - FoundryVTT Actor object
     * @returns {Object} - Validation result
     */
    validateActor(actor) {
        const result = {
            valid: true,
            errors: [],
            warnings: []
        };

        if (!actor) {
            result.valid = false;
            result.errors.push('Actor object is required');
            return result;
        }

        // Check actor type if specified in config
        if (this.config.validation?.requiredActorType) {
            if (actor.type !== this.config.validation.requiredActorType) {
                result.warnings.push(`Actor type '${actor.type}' may not be compatible. Expected '${this.config.validation.requiredActorType}'`);
            }
        }

        // Check required fields exist
        if (this.config.validation?.requiredFields) {
            for (const fieldPath of this.config.validation.requiredFields) {
                if (!this.getNestedProperty(actor, fieldPath)) {
                    result.valid = false;
                    result.errors.push(`Required field '${fieldPath}' not found on actor`);
                }
            }
        }

        // Check currency field specifically
        const fieldMap = this.getCurrencyFieldMap();
        const missingPaths = [];
        Object.values(fieldMap).forEach((path) => {
            if (this.getNestedProperty(actor, path) === undefined) {
                missingPaths.push(path);
            }
        });

        if (missingPaths.length > 0) {
            result.valid = false;
            result.errors.push(`Currency field paths not accessible on actor: ${missingPaths.join(', ')}`);
        }

        const currencyValue = this.getCurrencyValue(actor);
        if (currencyValue === null || currencyValue === undefined) {
            result.valid = false;
            result.errors.push('Currency value could not be determined for actor');
        }

        return result;
    }

    /**
     * Get nested property from object using dot notation
     * @param {Object} obj - Object to traverse
     * @param {string} path - Dot-separated path (e.g., 'system.money.gc')
     * @returns {*} - Property value or undefined
     */
    getNestedProperty(obj, path) {
        return path.split('.').reduce((current, key) => {
            return current && current[key] !== undefined ? current[key] : undefined;
        }, obj);
    }

    /**
     * Set nested property on object using dot notation
     * @param {Object} obj - Object to modify
     * @param {string} path - Dot-separated path
     * @param {*} value - Value to set
     */
    setNestedProperty(obj, path, value) {
        const keys = path.split('.');
        const lastKey = keys.pop();
        const target = keys.reduce((current, key) => {
            if (!current[key]) current[key] = {};
            return current[key];
        }, obj);
        target[lastKey] = value;
    }

    getCurrencySchema() {
        if (!this.currencySchema) {
            this.currencySchema = this.getFallbackCurrencySchema();
        }
        return this.currencySchema;
    }

    getNormalizedCurrencySchema() {
        if (!CurrencyUtils) {
            throw new Error('Currency utilities are not available');
        }

        if (!this.normalizedCurrencySchema) {
            this.normalizedCurrencySchema = CurrencyUtils.normalizeConfig(this.getCurrencySchema());
        }

        return this.normalizedCurrencySchema;
    }

    getCurrencyFieldMap() {
        if (this.currencyFieldMap) {
            return this.currencyFieldMap;
        }

        const map = {};
        const fieldConfig = this.config?.currency || {};
        const normalized = (() => {
            try {
                return this.getNormalizedCurrencySchema();
            } catch (error) {
                return null;
            }
        })();

        if (fieldConfig.fields) {
            Object.entries(fieldConfig.fields).forEach(([key, path]) => {
                if (typeof path === 'string') {
                    map[key.toLowerCase()] = path;
                }
            });
        }

        const canonicalKey = normalized
            ? (normalized.canonicalUnit.abbreviation || normalized.canonicalUnit.name || 'canonical').toLowerCase()
            : 'canonical';

        if (!map[canonicalKey] && typeof fieldConfig.field === 'string') {
            map[canonicalKey] = fieldConfig.field;
        }

        this.currencyFieldMap = map;
        return this.currencyFieldMap;
    }

    buildCurrencyUpdate(targetCanonicalValue) {
        if (!CurrencyUtils) {
            const updateData = {};
            const field = this.config?.currency?.field;
            if (typeof field === 'string') {
                this.setNestedProperty(updateData, field, targetCanonicalValue);
            }
            return updateData;
        }

        const normalized = this.getNormalizedCurrencySchema();
        const schema = this.getCurrencySchema();
        const fieldMap = this.getCurrencyFieldMap();
        const canonicalKey = (normalized.canonicalUnit.abbreviation || normalized.canonicalUnit.name || 'canonical').toLowerCase();
        const mapKeys = Object.keys(fieldMap);

        // If only canonical path is available, update it directly
        if (mapKeys.length === 1 && fieldMap[canonicalKey]) {
            const updateData = {};
            this.setNestedProperty(updateData, fieldMap[canonicalKey], Math.round(targetCanonicalValue));
            return updateData;
        }

        const breakdown = CurrencyUtils.convertFromCanonical(Math.round(targetCanonicalValue), schema, { includeZero: true });
        const updateData = {};
        let unmatchedCanonical = 0;

        breakdown.forEach(({ denomination, quantity }) => {
            const key = (denomination.abbreviation || denomination.name || '').toLowerCase();
            const path = fieldMap[key];

            if (path) {
                this.setNestedProperty(updateData, path, quantity);
            } else {
                unmatchedCanonical += quantity * denomination.value;
            }
        });

        if (unmatchedCanonical !== 0 && fieldMap[canonicalKey]) {
            const existing = this.getNestedProperty(updateData, fieldMap[canonicalKey]) || 0;
            this.setNestedProperty(updateData, fieldMap[canonicalKey], existing + unmatchedCanonical);
        }

        return updateData;
    }

    // ===== CURRENCY OPERATIONS =====

    /**
     * Get current currency amount for actor
     * @param {Object} actor - FoundryVTT Actor object
     * @returns {number|null} - Currency amount or null if not accessible
     */
    getCurrencyValue(actor) {
        if (!actor) return null;
        
        try {
            if (!CurrencyUtils) {
                const legacyField = this.config?.currency?.field;
                const legacyValue = legacyField ? this.getNestedProperty(actor, legacyField) : null;
                return typeof legacyValue === 'number' ? Math.round(legacyValue) : null;
            }

            const schema = this.getCurrencySchema();
            const normalized = this.getNormalizedCurrencySchema();
            const fieldMap = this.getCurrencyFieldMap();
            const canonicalKey = (normalized.canonicalUnit.abbreviation || normalized.canonicalUnit.name || 'canonical').toLowerCase();
            const mapKeys = Object.keys(fieldMap);

            if (mapKeys.length === 1 && fieldMap[canonicalKey]) {
                const value = this.getNestedProperty(actor, fieldMap[canonicalKey]);
                return typeof value === 'number' ? Math.round(value) : null;
            }

            const breakdown = {};
            normalized.denominations.forEach((denomination) => {
                const key = (denomination.abbreviation || denomination.name || '').toLowerCase();
                const path = fieldMap[key];
                if (!path) {
                    return;
                }
                const value = this.getNestedProperty(actor, path);
                if (typeof value === 'number' && Number.isFinite(value)) {
                    breakdown[denomination.abbreviation || denomination.name || key] = value;
                }
            });

            if (Object.keys(breakdown).length === 0) {
                const fallbackField = fieldMap[canonicalKey] || this.config?.currency?.field;
                const fallbackValue = fallbackField ? this.getNestedProperty(actor, fallbackField) : null;
                return typeof fallbackValue === 'number' ? Math.round(fallbackValue) : null;
            }

            return CurrencyUtils.convertToCanonical(breakdown, schema);
        } catch (error) {
            console.error('SystemAdapter: Error getting currency value:', error);
            return null;
        }
    }

    /**
     * Check if actor has sufficient currency
     * @param {Object} actor - FoundryVTT Actor object
     * @param {number} amount - Amount to check
     * @returns {boolean} - True if actor has sufficient currency
     */
    hasSufficientCurrency(actor, amount) {
        const currentAmount = this.getCurrencyValue(actor);
        return currentAmount !== null && currentAmount >= amount;
    }

    /**
     * Deduct currency from actor
     * @param {Object} actor - FoundryVTT Actor object
     * @param {number} amount - Amount to deduct
     * @param {string} reason - Reason for deduction (for logging)
     * @returns {Promise<Object>} - Operation result
     */
    async deductCurrency(actor, amount, reason = 'Trading transaction') {
        if (!this.isFoundryEnvironment) {
            const error = new Error('Currency operations require FoundryVTT environment');
            this.handleError(error, 'deductCurrency');
            throw error;
        }

        const validation = this.validateActor(actor);
        if (!validation.valid) {
            const result = {
                success: false,
                error: `Actor validation failed: ${validation.errors.join(', ')}`,
                currentAmount: null,
                newAmount: null
            };
            
            // Log validation error for debugging
            this.logError('Actor validation failed during currency deduction', {
                actorId: actor?.id,
                actorName: actor?.name,
                validationErrors: validation.errors,
                amount: amount,
                reason: reason
            });
            
            return result;
        }

        const currentAmount = this.getCurrencyValue(actor);
        
        if (currentAmount === null) {
            const result = {
                success: false,
                error: 'Cannot access actor currency values',
                currentAmount: null,
                newAmount: null
            };
            
            this.logError('Currency field access failed', {
                actorId: actor.id,
                currencyFields: this.getCurrencyFieldMap(),
                amount: amount
            });
            
            return result;
        }

        if (currentAmount < amount) {
            const result = {
                success: false,
                error: `Insufficient currency. Has ${currentAmount}, needs ${amount}`,
                currentAmount: currentAmount,
                newAmount: null
            };
            
            // This is expected behavior, not an error - just log for debugging
            if (this.debugMode) {
                console.log(`SystemAdapter | Insufficient currency: ${actor.name} has ${currentAmount}, needs ${amount}`);
            }
            
            return result;
        }

        try {
            const newAmount = currentAmount - amount;
            const updateData = this.buildCurrencyUpdate(newAmount);
            
            await actor.update(updateData);

            return {
                success: true,
                currentAmount: currentAmount,
                newAmount: newAmount,
                amountDeducted: amount,
                reason: reason
            };
        } catch (error) {
            this.handleError(error, 'deductCurrency', {
                actorId: actor.id,
                amount: amount,
                currentAmount: currentAmount
            });
            
            return {
                success: false,
                error: `Failed to update actor currency: ${error.message}`,
                currentAmount: currentAmount,
                newAmount: null
            };
        }
    }

    /**
     * Add currency to actor
     * @param {Object} actor - FoundryVTT Actor object
     * @param {number} amount - Amount to add
     * @param {string} reason - Reason for addition (for logging)
     * @returns {Promise<Object>} - Operation result
     */
    async addCurrency(actor, amount, reason = 'Trading transaction') {
        if (!this.isFoundryEnvironment) {
            throw new Error('Currency operations require FoundryVTT environment');
        }

        const validation = this.validateActor(actor);
        if (!validation.valid) {
            return {
                success: false,
                error: `Actor validation failed: ${validation.errors.join(', ')}`,
                currentAmount: null,
                newAmount: null
            };
        }

        const currentAmount = this.getCurrencyValue(actor);
        
        if (currentAmount === null) {
            return {
                success: false,
                error: 'Cannot access actor currency values',
                currentAmount: null,
                newAmount: null
            };
        }

        try {
            const newAmount = currentAmount + amount;
            const updateData = this.buildCurrencyUpdate(newAmount);
            
            await actor.update(updateData);

            return {
                success: true,
                currentAmount: currentAmount,
                newAmount: newAmount,
                amountAdded: amount,
                reason: reason
            };
        } catch (error) {
            return {
                success: false,
                error: `Failed to update actor currency: ${error.message}`,
                currentAmount: currentAmount,
                newAmount: null
            };
        }
    }

    // ===== INVENTORY OPERATIONS =====

    /**
     * Create cargo item data structure
     * @param {string} cargoName - Name of the cargo
     * @param {number} quantity - Quantity in Encumbrance Points
     * @param {Object} cargoData - Additional cargo information
     * @param {Object} purchaseInfo - Purchase transaction information
     * @returns {Object} - Item data structure
     */
    createCargoItemData(cargoName, quantity, cargoData = {}, purchaseInfo = {}) {
        const itemData = {
            name: cargoName,
            type: this.config.inventory.type || 'loot',
            system: {
                quantity: {
                    value: quantity
                },
                encumbrance: {
                    value: cargoData.encumbrancePerUnit || 1
                },
                price: {
                    gc: purchaseInfo.pricePerUnit || 0
                },
                description: {
                    value: `Trading cargo: ${cargoName}. Purchased for ${purchaseInfo.pricePerUnit || 0} GC per unit.`
                }
            }
        };

        // Add cargo-specific data
        if (cargoData.category) {
            itemData.system.cargoCategory = cargoData.category;
        }

        if (purchaseInfo.quality && purchaseInfo.quality !== 'average') {
            itemData.system.quality = purchaseInfo.quality;
            itemData.name += ` (${purchaseInfo.quality})`;
        }

        if (purchaseInfo.season) {
            itemData.system.purchaseSeason = purchaseInfo.season;
        }

        if (purchaseInfo.settlement) {
            itemData.system.purchaseLocation = purchaseInfo.settlement;
        }

        // Add trading metadata
        itemData.system.tradingData = {
            originalQuantity: quantity,
            purchasePrice: purchaseInfo.totalPrice || 0,
            purchaseDate: new Date().toISOString(),
            isTradingCargo: true
        };

        return itemData;
    }

    /**
     * Add cargo to actor inventory
     * @param {Object} actor - FoundryVTT Actor object
     * @param {string} cargoName - Name of the cargo
     * @param {number} quantity - Quantity to add
     * @param {Object} cargoData - Cargo type information
     * @param {Object} purchaseInfo - Purchase transaction information
     * @returns {Promise<Object>} - Operation result
     */
    async addCargoToInventory(actor, cargoName, quantity, cargoData = {}, purchaseInfo = {}) {
        if (!this.isFoundryEnvironment) {
            throw new Error('Inventory operations require FoundryVTT environment');
        }

        const validation = this.validateActor(actor);
        if (!validation.valid) {
            return {
                success: false,
                error: `Actor validation failed: ${validation.errors.join(', ')}`,
                itemId: null
            };
        }

        try {
            const itemData = this.createCargoItemData(cargoName, quantity, cargoData, purchaseInfo);
            
            // Use configured method for creating items
            const method = this.config.inventory.method || 'createEmbeddedDocuments';
            const createdItems = await actor[method]('Item', [itemData]);
            
            const createdItem = Array.isArray(createdItems) ? createdItems[0] : createdItems;

            return {
                success: true,
                itemId: createdItem.id,
                itemName: createdItem.name,
                quantity: quantity,
                cargoName: cargoName
            };
        } catch (error) {
            return {
                success: false,
                error: `Failed to add cargo to inventory: ${error.message}`,
                itemId: null
            };
        }
    }

    /**
     * Find cargo items in actor inventory
     * @param {Object} actor - FoundryVTT Actor object
     * @param {string} cargoName - Name of cargo to find
     * @param {Object} filters - Additional filters (quality, etc.)
     * @returns {Array} - Array of matching items
     */
    findCargoInInventory(actor, cargoName, filters = {}) {
        if (!actor || !actor.items) {
            return [];
        }

        return actor.items.filter(item => {
            // Check if it's trading cargo
            if (!item.system?.tradingData?.isTradingCargo) {
                return false;
            }

            // Check cargo name (handle quality suffixes)
            const itemBaseName = item.name.replace(/\s*\([^)]+\)$/, ''); // Remove quality suffix
            if (itemBaseName !== cargoName) {
                return false;
            }

            // Apply additional filters
            if (filters.quality && item.system.quality !== filters.quality) {
                return false;
            }

            if (filters.minQuantity && item.system.quantity.value < filters.minQuantity) {
                return false;
            }

            return true;
        });
    }

    /**
     * Remove cargo from actor inventory
     * @param {Object} actor - FoundryVTT Actor object
     * @param {string} itemId - ID of item to remove
     * @param {number} quantity - Quantity to remove (optional, removes entire item if not specified)
     * @returns {Promise<Object>} - Operation result
     */
    async removeCargoFromInventory(actor, itemId, quantity = null) {
        if (!this.isFoundryEnvironment) {
            throw new Error('Inventory operations require FoundryVTT environment');
        }

        const validation = this.validateActor(actor);
        if (!validation.valid) {
            return {
                success: false,
                error: `Actor validation failed: ${validation.errors.join(', ')}`,
                removedQuantity: 0
            };
        }

        const item = actor.items.get(itemId);
        if (!item) {
            return {
                success: false,
                error: `Item with ID '${itemId}' not found in actor inventory`,
                removedQuantity: 0
            };
        }

        try {
            const currentQuantity = item.system.quantity.value;
            
            if (quantity === null || quantity >= currentQuantity) {
                // Remove entire item
                const deleteMethod = this.config.inventory.deleteMethod || 'deleteEmbeddedDocuments';
                await actor[deleteMethod]('Item', [itemId]);
                
                return {
                    success: true,
                    removedQuantity: currentQuantity,
                    itemRemoved: true,
                    itemName: item.name
                };
            } else {
                // Reduce quantity
                const newQuantity = currentQuantity - quantity;
                await item.update({
                    'system.quantity.value': newQuantity
                });
                
                return {
                    success: true,
                    removedQuantity: quantity,
                    itemRemoved: false,
                    remainingQuantity: newQuantity,
                    itemName: item.name
                };
            }
        } catch (error) {
            return {
                success: false,
                error: `Failed to remove cargo from inventory: ${error.message}`,
                removedQuantity: 0
            };
        }
    }

    /**
     * Get total cargo quantity for a specific cargo type
     * @param {Object} actor - FoundryVTT Actor object
     * @param {string} cargoName - Name of cargo to count
     * @param {Object} filters - Additional filters
     * @returns {number} - Total quantity
     */
    getTotalCargoQuantity(actor, cargoName, filters = {}) {
        const items = this.findCargoInInventory(actor, cargoName, filters);
        return items.reduce((total, item) => {
            return total + (item.system.quantity.value || 0);
        }, 0);
    }

    /**
     * Get inventory summary for trading
     * @param {Object} actor - FoundryVTT Actor object
     * @returns {Object} - Inventory summary with cargo items
     */
    getInventorySummary(actor) {
        if (!actor || !actor.items) {
            return {
                totalItems: 0,
                cargoItems: [],
                totalCargoValue: 0
            };
        }

        const cargoItems = actor.items.filter(item => 
            item.system?.tradingData?.isTradingCargo
        ).map(item => ({
            id: item.id,
            name: item.name,
            quantity: item.system?.quantity?.value || 0,
            encumbrance: item.system?.encumbrance?.value || 1,
            purchasePrice: item.system?.tradingData?.purchasePrice || 0,
            purchaseLocation: item.system?.purchaseLocation || 'Unknown',
            quality: item.system?.quality || 'average'
        }));

        const totalCargoValue = cargoItems.reduce((total, item) => {
            return total + (item.purchasePrice || 0);
        }, 0);

        return {
            totalItems: cargoItems.length,
            cargoItems: cargoItems,
            totalCargoValue: totalCargoValue,
            currency: this.getCurrencyValue(actor)
        };
    }

    /**
     * Set error handler reference
     * @param {RuntimeErrorHandler} errorHandler - Error handler instance
     */
    setErrorHandler(errorHandler) {
        this.errorHandler = errorHandler;
    }

    /**
     * Handle errors with error handler if available
     * @param {Error} error - Error object
     * @param {string} operation - Operation that failed
     * @param {Object} context - Additional context
     */
    handleError(error, operation, context = {}) {
        if (this.errorHandler) {
            this.errorHandler.handleTradingEngineError(error, `SystemAdapter.${operation}`, context);
        } else {
            console.error(`SystemAdapter | ${operation} failed:`, error, context);
        }
    }

    /**
     * Log error for debugging
     * @param {string} message - Error message
     * @param {Object} context - Error context
     */
    logError(message, context = {}) {
        if (this.debugMode || (this.errorHandler && this.errorHandler.debugMode)) {
            console.warn(`SystemAdapter | ${message}`, context);
        }
    }

    /**
     * Validate transaction before execution
     * @param {Object} actor - FoundryVTT Actor object
     * @param {string} transactionType - 'purchase' or 'sale'
     * @param {Object} transactionData - Transaction details
     * @returns {Object} - Validation result
     */
    validateTransaction(actor, transactionType, transactionData) {
        const result = {
            valid: true,
            errors: [],
            warnings: []
        };

        // Validate actor
        const actorValidation = this.validateActor(actor);
        if (!actorValidation.valid) {
            result.valid = false;
            result.errors.push(...actorValidation.errors);
            return result;
        }

        if (transactionType === 'purchase') {
            // Check currency for purchase
            if (!this.hasSufficientCurrency(actor, transactionData.totalPrice)) {
                result.valid = false;
                result.errors.push(`Insufficient currency. Has ${this.getCurrencyValue(actor)}, needs ${transactionData.totalPrice}`);
            }
        } else if (transactionType === 'sale') {
            // Check inventory for sale
            const availableQuantity = this.getTotalCargoQuantity(actor, transactionData.cargoName, {
                quality: transactionData.quality
            });
            
            if (availableQuantity < transactionData.quantity) {
                result.valid = false;
                result.errors.push(`Insufficient cargo. Has ${availableQuantity}, trying to sell ${transactionData.quantity}`);
            }
        }

        return result;
    }

    /**
     * Validate user permissions for trading operations
     * @param {Object} user - FoundryVTT User object
     * @param {string} operation - Operation to check ('modify-settings', 'execute-trade', etc.)
     * @returns {Object} - Permission result with allowed flag and reason
     */
    validateUserPermissions(user, operation) {
        const result = {
            allowed: false,
            reason: 'Unknown operation'
        };

        if (!user) {
            result.reason = 'User object is required';
            return result;
        }

        // Check if user is GM
        const isGM = user.role === CONST.USER_ROLES.GAMEMASTER || user.isGM;

        switch (operation) {
            case 'modify-settings':
                result.allowed = isGM;
                result.reason = isGM ? 'GM can modify settings' : 'Only GM can modify settings';
                break;

            case 'execute-trade':
                result.allowed = true; // Players can trade
                result.reason = 'Players can execute trades';
                break;

            case 'gm-only-operation':
                result.allowed = isGM;
                result.reason = isGM ? 'GM operation allowed' : 'Insufficient permissions';
                break;

            default:
                result.reason = `Unknown operation: ${operation}`;
                break;
        }

        return result;
    }
}

// Global registration for FoundryVTT
if (typeof window !== 'undefined') {
    window.SystemAdapter = SystemAdapter;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = SystemAdapter;
}

// ES module export
export { SystemAdapter };