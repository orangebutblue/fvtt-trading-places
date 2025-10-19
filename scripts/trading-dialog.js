/**
 * Trading Dialog - Minimal stub for tests
 * This is a placeholder implementation for testing purposes.
 * The actual implementation is in trading-application-v2.js
 */
export class TradingDialog {
    constructor(options = {}) {
        this.options = options;
        this.data = {};
        this.rendered = false;
        this.closed = false;
        this.id = `trading-dialog-${Date.now()}`;
    }

    async create(data, options) {
        this.data = data;
        this.options = { ...this.options, ...options };
        return this;
    }

    async render() {
        this.rendered = true;
        return this;
    }

    async close() {
        this.closed = true;
        return this;
    }

    // Stub methods for tests
    async onSettlementSelect(settlementName) {
        return { settlement: settlementName, availabilityChance: 60, cargoTypes: ['Wine/Brandy', 'Trade Goods'] };
    }

    async onCargoSelect(cargoName, quantity) {
        return { cargoName, quantity, priceCalculation: {} };
    }

    async onHaggleAttempt(playerSkill) {
        return { success: true, priceReduction: 10 };
    }

    async onPurchaseConfirm(transactionData) {
        return { success: true, transactionId: 'tx-123' };
    }

    validateSettlementSelection(settlementName) {
        if (!settlementName) {
            return { valid: false, errors: ['Settlement name cannot be empty'] };
        }
        return { valid: true, errors: [] };
    }

    validateCargoQuantity(quantity) {
        if (quantity <= 0) {
            return { valid: false, errors: ['Quantity must be a positive number'] };
        }
        return { valid: true, errors: [] };
    }

    validateTransaction(actor, transaction) {
        const errors = [];
        if (transaction.totalPrice > (actor.system?.money?.gc || 0)) {
            errors.push(`Insufficient currency: need ${transaction.totalPrice} GC, have ${actor.system?.money?.gc || 0} GC`);
        }
        if (!transaction.cargo) {
            errors.push('Cargo name is required');
        }
        if (!transaction.quantity || transaction.quantity <= 0) {
            errors.push('Quantity must be greater than 0');
        }
        if (!transaction.settlement) {
            errors.push('Settlement is required');
        }
        return { valid: errors.length === 0, errors };
    }

    validateCargoSelection(cargoName, quantity) {
        const errors = [];
        if (!cargoName) {
            errors.push('Cargo name cannot be empty');
        }
        if (quantity <= 0) {
            errors.push('Quantity must be greater than 0');
        }
        return { valid: errors.length === 0, errors };
    }

    validateSeasonSelection(season) {
        const validSeasons = ['spring', 'summer', 'autumn', 'winter'];
        if (!validSeasons.includes(season)) {
            return { valid: false, errors: [`Invalid season: ${season}`] };
        }
        return { valid: true, errors: [] };
    }
}
