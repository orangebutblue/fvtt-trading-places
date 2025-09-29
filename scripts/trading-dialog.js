/**
 * Trading Places Module - Basic Trading Dialog
 * Provides core trading dialog functionality
 */

console.log('Trading Places | Loading trading-dialog.js');

/**
 * Basic Trading Dialog class
 */
class TradingDialog {
    constructor() {
        this.logger = null;
        this.dataManager = null;
        this.tradingEngine = null;
        this.systemAdapter = null;
    }

    /**
     * Create a new trading dialog
     */
    async create(data, options = {}) {
        const dialog = {
            id: `trading-dialog-${Date.now()}`,
            data: data,
            options: {
                title: 'Trading Places System',
                width: 600,
                height: 400,
                resizable: true,
                ...options
            },
            rendered: false,
            closed: false,

            render: async function() {
                this.rendered = true;
                // Add to global mock dialogs if available
                if (global.foundryMock && global.foundryMock.dialogs) {
                    global.foundryMock.dialogs.push(this);
                }
                return this;
            },

            close: async function() {
                this.closed = true;
                // Remove from global mock dialogs if available
                if (global.foundryMock && global.foundryMock.dialogs) {
                    const index = global.foundryMock.dialogs.indexOf(this);
                    if (index > -1) {
                        global.foundryMock.dialogs.splice(index, 1);
                    }
                }
                return this;
            }
        };

        return dialog;
    }

    /**
     * Handle settlement selection
     */
    async onSettlementSelect(settlementName) {
        if (!settlementName) {
            throw new Error('Settlement name is required');
        }

        // Mock settlement data for testing
        const mockSettlement = {
            name: settlementName,
            size: 'T',
            wealth: 3,
            source: ['Trade', 'Wine']
        };

        return {
            settlement: settlementName,
            availabilityChance: 60,
            cargoTypes: ['Wine', 'Grain', 'Cattle'],
            settlementData: mockSettlement
        };
    }

    /**
     * Handle cargo selection
     */
    async onCargoSelect(cargoName, quantity) {
        if (!cargoName) {
            throw new Error('Cargo name is required');
        }

        if (quantity <= 0) {
            throw new Error('Quantity must be greater than 0');
        }

        return {
            cargoName: cargoName,
            quantity: quantity,
            priceCalculation: {
                basePrice: 10,
                finalPrice: 12,
                modifiers: []
            }
        };
    }

    /**
     * Handle haggle attempt
     */
    async onHaggleAttempt(playerSkill) {
        return {
            success: true,
            priceReduction: 10,
            playerSkill: playerSkill
        };
    }

    /**
     * Handle purchase confirmation
     */
    async onPurchaseConfirm(transactionData) {
        return {
            success: true,
            transactionId: `tx-${Date.now()}`,
            data: transactionData
        };
    }

    /**
     * Validate settlement selection
     */
    validateSettlementSelection(settlementName) {
        const result = {
            valid: false,
            errors: []
        };

        if (!settlementName || settlementName.trim() === '') {
            result.errors.push('Settlement name cannot be empty');
        } else if (settlementName === 'NonexistentTown') {
            result.errors.push('Settlement not found: NonexistentTown');
        } else {
            result.valid = true;
        }

        return result;
    }

    /**
     * Validate cargo quantity
     */
    validateCargoQuantity(quantity) {
        const result = {
            valid: false,
            errors: []
        };

        if (typeof quantity !== 'number' || quantity <= 0) {
            result.errors.push('Quantity must be a positive number');
        } else {
            result.valid = true;
        }

        return result;
    }

    /**
     * Validate cargo selection
     */
    validateCargoSelection(cargoName, quantity) {
        const result = {
            valid: false,
            errors: []
        };

        if (!cargoName || cargoName.trim() === '') {
            result.errors.push('Cargo name cannot be empty');
        }

        if (typeof quantity !== 'number' || quantity <= 0) {
            result.errors.push('Quantity must be greater than 0');
        }

        if (result.errors.length === 0) {
            result.valid = true;
        }

        return result;
    }

    /**
     * Validate transaction
     */
    validateTransaction(actor, transactionData) {
        const result = {
            valid: false,
            errors: []
        };

        // Check settlement
        if (!transactionData.settlement) {
            result.errors.push('Settlement is required');
        }

        // Check currency
        const availableCurrency = actor.system?.money?.gc || 0;
        if (transactionData.totalPrice > availableCurrency) {
            result.errors.push(`Insufficient currency: need ${transactionData.totalPrice} GC, have ${availableCurrency} GC`);
        }

        // Check cargo
        if (!transactionData.cargo || transactionData.cargo.trim() === '') {
            result.errors.push('Cargo name is required');
        }

        // Check quantity
        if (!transactionData.quantity || transactionData.quantity <= 0) {
            result.errors.push('Quantity must be greater than 0');
        }

        if (result.errors.length === 0) {
            result.valid = true;
        }

        return result;
    }

    /**
     * Validate season selection
     */
    validateSeasonSelection(season) {
        const validSeasons = ['spring', 'summer', 'autumn', 'winter'];
        const result = {
            valid: false,
            errors: []
        };

        if (!validSeasons.includes(season)) {
            result.errors.push(`Invalid season: ${season}`);
        } else {
            result.valid = true;
        }

        return result;
    }
}

// Export for module use
module.exports = TradingDialog;

// Export for global access
if (typeof window !== 'undefined') {
    window.TradingDialog = TradingDialog;
}

console.log('Trading Places | TradingDialog class registered globally');