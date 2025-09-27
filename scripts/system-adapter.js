/**
 * WFRP River Trading Module - System Adapter
 * Configuration-driven adapter for currency and inventory management across different game systems
 */

/**
 * SystemAdapter class for handling currency and inventory operations
 * Uses configuration-driven field paths to work with different game systems
 */
class SystemAdapter {
    constructor(config = null) {
        this.config = config || this.getDefaultConfig();
        this.systemId = (typeof game !== 'undefined' && game?.system?.id) || 'unknown';
        this.isFoundryEnvironment = typeof game !== 'undefined';
        this.debugMode = false;
        this.errorHandler = null;
        
        // Try to get error handler from global scope
        if (typeof window !== 'undefined' && window.WFRPRiverTrading?.getErrorHandler) {
            this.errorHandler = window.WFRPRiverTrading.getErrorHandler();
        }
    }

    /**
     * Get default configuration for supported systems
     * @returns {Object} - Default system configuration
     */
    getDefaultConfig() {
        return {
            currency: {
                field: 'system.money.gc', // Default WFRP4e path
                type: 'number',
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

    /**
     * Load configuration from DataManager or use defaults
     * @param {Object} dataManager - DataManager instance with config
     */
    loadConfiguration(dataManager) {
        if (dataManager && dataManager.config) {
            // Merge with defaults, prioritizing loaded config
            this.config = {
                ...this.getDefaultConfig(),
                ...dataManager.config
            };
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
        if (!this.config.currency || !this.config.currency.field) {
            result.compatible = false;
            result.errors.push('Currency field configuration missing');
        }

        // Validate inventory configuration
        if (!this.config.inventory || !this.config.inventory.field) {
            result.compatible = false;
            result.errors.push('Inventory field configuration missing');
        }

        // System-specific validation
        if (this.systemId === 'wfrp4e') {
            // WFRP4e specific checks
            if (this.config.currency.field !== 'system.money.gc') {
                result.warnings.push('Currency field may not match WFRP4e standard (system.money.gc)');
            }
        } else {
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
        const currencyValue = this.getCurrencyValue(actor);
        if (currencyValue === null || currencyValue === undefined) {
            result.valid = false;
            result.errors.push(`Currency field '${this.config.currency.field}' not accessible on actor`);
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

    // ===== CURRENCY OPERATIONS =====

    /**
     * Get current currency amount for actor
     * @param {Object} actor - FoundryVTT Actor object
     * @returns {number|null} - Currency amount or null if not accessible
     */
    getCurrencyValue(actor) {
        if (!actor) return null;
        
        try {
            const value = this.getNestedProperty(actor, this.config.currency.field);
            return typeof value === 'number' ? value : null;
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
                error: `Cannot access currency field '${this.config.currency.field}'`,
                currentAmount: null,
                newAmount: null
            };
            
            this.logError('Currency field access failed', {
                actorId: actor.id,
                currencyField: this.config.currency.field,
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
            const updateData = {};
            this.setNestedProperty(updateData, this.config.currency.field, newAmount);
            
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
                error: `Cannot access currency field '${this.config.currency.field}'`,
                currentAmount: null,
                newAmount: null
            };
        }

        try {
            const newAmount = currentAmount + amount;
            const updateData = {};
            this.setNestedProperty(updateData, this.config.currency.field, newAmount);
            
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
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SystemAdapter;
}

// Global registration for FoundryVTT
if (typeof window !== 'undefined') {
    window.SystemAdapter = SystemAdapter;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = SystemAdapter;
}