/**
 * Trading Places Module - Player Cargo Management System
 * Provides CRUD operations for managing player cargo inventory
 */

/**
 * Player Cargo Manager class for handling player inventory operations
 */
class PlayerCargoManager {
    constructor(debugLogger = null, dataManager = null, storage = null) {
        this.debugLogger = debugLogger;
        this.dataManager = dataManager;
        this.storage = storage || (typeof sessionStorage !== 'undefined' ? sessionStorage : null);
        this.playerCargo = [];
        this.sessionData = {};
        
        // Initialize cargo management system
        this.initializeCargoManager();
    }

    /**
     * Initialize the cargo management system
     */
    initializeCargoManager() {
        this.log('SYSTEM', 'Initialization', 'Player Cargo Manager initialized');
        
        // Load any existing session data
        this.loadSessionData();
        
        // Set up quality options
        this.qualityOptions = [
            { value: 'poor', label: 'Poor', modifier: 0.5 },
            { value: 'average', label: 'Average', modifier: 1.0 },
            { value: 'good', label: 'Good', modifier: 1.5 },
            { value: 'excellent', label: 'Excellent', modifier: 2.0 }
        ];
        
        this.log('SYSTEM', 'Initialization', 'Cargo manager ready for operations', {
            existingCargo: this.playerCargo.length,
            qualityOptions: this.qualityOptions.length
        });
    }

    /**
     * Load session data from browser storage
     */
    loadSessionData() {
        if (!this.storage) {
            this.log('SYSTEM', 'Session Load', 'No storage available, starting fresh');
            return;
        }
        
        try {
            const sessionKey = 'wfrp-trading-cargo-session';
            const storedData = this.storage.getItem(sessionKey);
            
            if (storedData) {
                const parsedData = JSON.parse(storedData);
                this.playerCargo = parsedData.playerCargo || [];
                this.sessionData = parsedData.sessionData || {};
                
                this.log('SYSTEM', 'Session Load', 'Loaded existing cargo session', {
                    cargoItems: this.playerCargo.length,
                    sessionId: this.sessionData.sessionId
                });
            } else {
                this.log('SYSTEM', 'Session Load', 'No existing session found, starting fresh');
            }
        } catch (error) {
            this.log('SYSTEM', 'Session Load', 'Error loading session data', { error: error.message }, 'ERROR');
            this.playerCargo = [];
            this.sessionData = {};
        }
    }

    /**
     * Save session data to browser storage
     */
    saveSessionData() {
        if (!this.storage) {
            this.log('SYSTEM', 'Session Save', 'No storage available, skipping save');
            return;
        }
        
        try {
            const sessionKey = 'wfrp-trading-cargo-session';
            const dataToSave = {
                playerCargo: this.playerCargo,
                sessionData: {
                    ...this.sessionData,
                    lastUpdated: new Date().toISOString(),
                    sessionId: this.sessionData.sessionId || this.generateSessionId()
                }
            };
            
            this.storage.setItem(sessionKey, JSON.stringify(dataToSave));
            
            this.log('SYSTEM', 'Session Save', 'Cargo session data saved', {
                cargoItems: this.playerCargo.length,
                sessionId: dataToSave.sessionData.sessionId
            });
        } catch (error) {
            this.log('SYSTEM', 'Session Save', 'Error saving session data', { error: error.message }, 'ERROR');
        }
    }

    /**
     * Generate unique session ID
     * @returns {string} - Unique session identifier
     */
    generateSessionId() {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substr(2, 6);
        return `cargo-${timestamp}-${random}`;
    }

    /**
     * Add cargo to player inventory
     * @param {string} cargoType - Type of cargo to add
     * @param {number} quantity - Quantity in Encumbrance Points
     * @param {string} quality - Quality level (poor, average, good, excellent)
     * @param {Object} additionalData - Additional cargo data (purchaseLocation, etc.)
     * @returns {Object} - Result of add operation
     */
    addCargo(cargoType, quantity, quality = 'average', additionalData = {}) {
        this.log('USER_ACTION', 'Add Cargo', `Adding cargo: ${quantity} EP of ${cargoType} (${quality})`, {
            cargoType,
            quantity,
            quality,
            additionalData
        });

        // Validate inputs
        const validation = this.validateCargoInput(cargoType, quantity, quality);
        if (!validation.valid) {
            this.log('USER_ACTION', 'Add Cargo', 'Validation failed', validation, 'ERROR');
            return { success: false, error: validation.error };
        }

        // Check if cargo type exists in data
        const cargoTypeData = this.getCargoTypeData(cargoType);
        if (!cargoTypeData) {
            this.log('USER_ACTION', 'Add Cargo', `Unknown cargo type: ${cargoType}`, null, 'WARN');
        }

        // Check for existing cargo of same type and quality
        const existingCargo = this.playerCargo.find(c => 
            c.type === cargoType && c.quality === quality
        );

        if (existingCargo) {
            // Update existing cargo quantity
            const oldQuantity = existingCargo.quantity;
            existingCargo.quantity += quantity;
            existingCargo.lastModified = new Date().toISOString();
            
            this.log('CARGO_OPERATION', 'Update Existing', `Updated existing cargo quantity`, {
                cargoId: existingCargo.id,
                cargoType,
                quality,
                oldQuantity,
                newQuantity: existingCargo.quantity,
                addedQuantity: quantity
            });
        } else {
            // Create new cargo entry
            const newCargo = {
                id: this.generateCargoId(),
                type: cargoType,
                quantity,
                quality,
                created: new Date().toISOString(),
                lastModified: new Date().toISOString(),
                ...additionalData
            };

            this.playerCargo.push(newCargo);
            
            this.log('CARGO_OPERATION', 'Add New', 'Added new cargo entry', {
                cargoId: newCargo.id,
                cargoType,
                quantity,
                quality,
                totalCargoItems: this.playerCargo.length
            });
        }

        // Save session and trigger UI update
        this.saveSessionData();
        this.triggerCargoUpdate();

        return { 
            success: true, 
            totalItems: this.playerCargo.length,
            totalQuantity: this.getTotalCargoQuantity()
        };
    }

    /**
     * Remove cargo from player inventory
     * @param {string} cargoId - ID of cargo to remove
     * @param {number} quantity - Quantity to remove (optional, removes all if not specified)
     * @returns {Object} - Result of remove operation
     */
    removeCargo(cargoId, quantity = null) {
        const cargo = this.playerCargo.find(c => c.id === cargoId);
        
        if (!cargo) {
            this.log('CARGO_OPERATION', 'Remove Cargo', `Cargo not found: ${cargoId}`, null, 'ERROR');
            return { success: false, error: 'Cargo not found' };
        }

        const removeQuantity = quantity !== null ? quantity : cargo.quantity;
        
        this.log('USER_ACTION', 'Remove Cargo', `Removing ${removeQuantity} EP of ${cargo.type}`, {
            cargoId,
            cargoType: cargo.type,
            quality: cargo.quality,
            currentQuantity: cargo.quantity,
            removeQuantity
        });

        if (removeQuantity >= cargo.quantity) {
            // Remove entire cargo entry
            this.playerCargo = this.playerCargo.filter(c => c.id !== cargoId);
            
            this.log('CARGO_OPERATION', 'Remove Complete', 'Cargo completely removed', {
                cargoId,
                cargoType: cargo.type,
                removedQuantity: cargo.quantity,
                remainingItems: this.playerCargo.length
            });
        } else {
            // Reduce quantity
            const oldQuantity = cargo.quantity;
            cargo.quantity -= removeQuantity;
            cargo.lastModified = new Date().toISOString();
            
            this.log('CARGO_OPERATION', 'Reduce Quantity', 'Cargo quantity reduced', {
                cargoId,
                cargoType: cargo.type,
                oldQuantity,
                newQuantity: cargo.quantity,
                removedQuantity: removeQuantity
            });
        }

        // Save session and trigger UI update
        this.saveSessionData();
        this.triggerCargoUpdate();

        return { 
            success: true, 
            totalItems: this.playerCargo.length,
            totalQuantity: this.getTotalCargoQuantity()
        };
    }

    /**
     * Modify existing cargo (quantity, quality, or other properties)
     * @param {string} cargoId - ID of cargo to modify
     * @param {Object} modifications - Object containing properties to modify
     * @returns {Object} - Result of modify operation
     */
    modifyCargo(cargoId, modifications) {
        const cargo = this.playerCargo.find(c => c.id === cargoId);
        
        if (!cargo) {
            this.log('CARGO_OPERATION', 'Modify Cargo', `Cargo not found: ${cargoId}`, null, 'ERROR');
            return { success: false, error: 'Cargo not found' };
        }

        this.log('USER_ACTION', 'Modify Cargo', `Modifying cargo: ${cargo.type}`, {
            cargoId,
            currentData: { ...cargo },
            modifications
        });

        // Apply modifications
        const oldData = { ...cargo };
        Object.keys(modifications).forEach(key => {
            if (key !== 'id' && key !== 'created') { // Protect immutable fields
                cargo[key] = modifications[key];
            }
        });
        cargo.lastModified = new Date().toISOString();

        this.log('CARGO_OPERATION', 'Update Properties', 'Cargo properties updated', {
            cargoId,
            oldData,
            newData: { ...cargo },
            modifications
        });

        // Save session and trigger UI update
        this.saveSessionData();
        this.triggerCargoUpdate();

        return { success: true, updatedCargo: { ...cargo } };
    }

    /**
     * Get all player cargo
     * @returns {Array} - Array of cargo objects
     */
    getAllCargo() {
        this.log('CARGO_OPERATION', 'Get All Cargo', 'Retrieved all player cargo', {
            totalItems: this.playerCargo.length,
            totalQuantity: this.getTotalCargoQuantity()
        });

        return [...this.playerCargo]; // Return copy to prevent external mutations
    }

    /**
     * Get cargo by ID
     * @param {string} cargoId - ID of cargo to retrieve
     * @returns {Object|null} - Cargo object or null if not found
     */
    getCargoById(cargoId) {
        const cargo = this.playerCargo.find(c => c.id === cargoId);
        
        this.log('CARGO_OPERATION', 'Get Cargo By ID', `Retrieved cargo: ${cargoId}`, {
            cargoId,
            found: !!cargo,
            cargoType: cargo?.type
        });

        return cargo ? { ...cargo } : null; // Return copy to prevent mutations
    }

    /**
     * Get cargo by type and quality
     * @param {string} cargoType - Type of cargo
     * @param {string} quality - Quality level (optional)
     * @returns {Array} - Array of matching cargo objects
     */
    getCargoByType(cargoType, quality = null) {
        const matchingCargo = this.playerCargo.filter(c => {
            const typeMatch = c.type === cargoType;
            const qualityMatch = quality === null || c.quality === quality;
            return typeMatch && qualityMatch;
        });

        this.log('CARGO_OPERATION', 'Get Cargo By Type', `Retrieved cargo by type: ${cargoType}`, {
            cargoType,
            quality,
            matchingItems: matchingCargo.length,
            totalQuantity: matchingCargo.reduce((sum, c) => sum + c.quantity, 0)
        });

        return matchingCargo.map(c => ({ ...c })); // Return copies
    }

    /**
     * Clear all player cargo
     * @returns {Object} - Result of clear operation
     */
    clearAllCargo() {
        const itemCount = this.playerCargo.length;
        const totalQuantity = this.getTotalCargoQuantity();
        
        this.log('USER_ACTION', 'Clear All Cargo', 'Clearing all player cargo', {
            itemsCleared: itemCount,
            quantityCleared: totalQuantity
        });

        this.playerCargo = [];
        this.saveSessionData();
        this.triggerCargoUpdate();

        return { success: true, itemsCleared: itemCount, quantityCleared: totalQuantity };
    }

    /**
     * Get total cargo quantity across all items
     * @returns {number} - Total quantity in EP
     */
    getTotalCargoQuantity() {
        return this.playerCargo.reduce((total, cargo) => total + cargo.quantity, 0);
    }

    /**
     * Get cargo summary by type
     * @returns {Object} - Summary object with cargo types and quantities
     */
    getCargoSummary() {
        const summary = {};
        
        this.playerCargo.forEach(cargo => {
            const key = `${cargo.type}_${cargo.quality}`;
            if (!summary[key]) {
                summary[key] = {
                    type: cargo.type,
                    quality: cargo.quality,
                    quantity: 0,
                    items: 0
                };
            }
            summary[key].quantity += cargo.quantity;
            summary[key].items += 1;
        });

        this.log('CARGO_OPERATION', 'Get Summary', 'Generated cargo summary', {
            uniqueTypes: Object.keys(summary).length,
            totalQuantity: this.getTotalCargoQuantity(),
            summary
        });

        return summary;
    }

    /**
     * Validate cargo input parameters
     * @param {string} cargoType - Type of cargo
     * @param {number} quantity - Quantity in EP
     * @param {string} quality - Quality level
     * @returns {Object} - Validation result
     */
    validateCargoInput(cargoType, quantity, quality) {
        const errors = [];

        // Validate cargo type
        if (!cargoType || typeof cargoType !== 'string' || cargoType.trim() === '') {
            errors.push('Cargo type is required and must be a non-empty string');
        }

        // Validate quantity
        if (!Number.isInteger(quantity) || quantity <= 0) {
            errors.push('Quantity must be a positive integer');
        }

        // Validate quality
        const validQualities = this.qualityOptions.map(q => q.value);
        if (!validQualities.includes(quality)) {
            errors.push(`Quality must be one of: ${validQualities.join(', ')}`);
        }

        const isValid = errors.length === 0;
        
        return {
            valid: isValid,
            error: isValid ? null : errors.join('; '),
            errors
        };
    }

    /**
     * Get cargo type data from data manager
     * @param {string} cargoType - Type of cargo
     * @returns {Object|null} - Cargo type data or null if not found
     */
    getCargoTypeData(cargoType) {
        if (!this.dataManager) {
            return null;
        }

        try {
            return this.dataManager.getCargoType(cargoType);
        } catch (error) {
            this.log('SYSTEM', 'Get Cargo Type Data', 'Error retrieving cargo type data', {
                cargoType,
                error: error.message
            }, 'ERROR');
            return null;
        }
    }

    /**
     * Generate unique cargo ID
     * @returns {string} - Unique cargo identifier
     */
    generateCargoId() {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substr(2, 9);
        return `cargo-${timestamp}-${random}`;
    }

    /**
     * Trigger cargo update event for UI components
     */
    triggerCargoUpdate() {
        // Dispatch custom event for UI components to listen to
        if (typeof window !== 'undefined') {
            const event = new CustomEvent('wfrp-cargo-updated', {
                detail: {
                    totalItems: this.playerCargo.length,
                    totalQuantity: this.getTotalCargoQuantity(),
                    cargo: this.getAllCargo()
                }
            });
            window.dispatchEvent(event);
        }

        this.log('SYSTEM', 'UI Update', 'Cargo update event triggered', {
            totalItems: this.playerCargo.length,
            totalQuantity: this.getTotalCargoQuantity()
        });
    }

    /**
     * Get available cargo types from data manager
     * @returns {Array} - Array of available cargo types
     */
    getAvailableCargoTypes() {
        if (!this.dataManager) {
            this.log('SYSTEM', 'Get Available Types', 'No data manager available', null, 'WARN');
            return [];
        }

        try {
            const cargoTypes = this.dataManager.getAllCargoTypes();
            this.log('CARGO_OPERATION', 'Get Available Types', 'Retrieved available cargo types', {
                typeCount: cargoTypes.length
            });
            return cargoTypes;
        } catch (error) {
            this.log('SYSTEM', 'Get Available Types', 'Error retrieving cargo types', {
                error: error.message
            }, 'ERROR');
            return [];
        }
    }

    /**
     * Get quality options for cargo
     * @returns {Array} - Array of quality option objects
     */
    getQualityOptions() {
        return [...this.qualityOptions]; // Return copy
    }

    /**
     * Log message using debug logger if available
     * @param {string} category - Log category
     * @param {string} operation - Operation name
     * @param {string} message - Log message
     * @param {Object} data - Additional data (optional)
     * @param {string} level - Log level (optional)
     */
    log(category, operation, message, data = null, level = 'INFO') {
        if (this.debugLogger && typeof this.debugLogger.log === 'function') {
            this.debugLogger.log(category, operation, message, data, level);
        } else {
            // Fallback to console logging
            const timestamp = new Date().toLocaleTimeString();
            const logMessage = `[${timestamp}] CARGO-${category} | ${operation} | ${message}`;
            console.log(logMessage, data || '');
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { PlayerCargoManager };
} else if (typeof window !== 'undefined') {
    window.PlayerCargoManager = PlayerCargoManager;
}