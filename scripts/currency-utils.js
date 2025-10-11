/**
 * Trading Places Module - Currency Utilities
 * Helper functions for converting and formatting currency values using dataset configuration.
 */

console.log('🔧 Loading currency-utils.js...');

const CurrencyUtils = (() => {
    function roundValue(value, mode = 'nearest') {
        if (!Number.isFinite(value)) {
            throw new Error('Currency value must be numeric');
        }

        switch ((mode || 'nearest').toLowerCase()) {
            case 'down':
            case 'floor':
                return Math.floor(value);
            case 'up':
            case 'ceil':
                return Math.ceil(value);
            default:
                return Math.round(value);
        }
    }

    /**
     * Validate and normalize currency configuration.
     * @param {Object} config - Raw currency configuration from dataset.
     * @returns {Object} Normalized configuration with lookup maps.
     */
    function normalizeConfig(config) {
        if (!config) {
            throw new Error('Currency configuration is required');
        }

        const canonical = config.canonicalUnit;
        if (!canonical || typeof canonical.value !== 'number' || canonical.value <= 0) {
            throw new Error('Currency configuration must declare a canonicalUnit with positive value');
        }

        const denominations = Array.isArray(config.denominations) ? [...config.denominations] : [];
        if (denominations.length === 0) {
            throw new Error('Currency configuration must provide at least one denomination');
        }

        const lookupByAbbreviation = new Map();
        const lookupByName = new Map();
        const sortedDenominations = denominations
            .map((denomination) => ({ ...denomination }))
            .sort((a, b) => b.value - a.value);

        for (const denom of sortedDenominations) {
            if (typeof denom.value !== 'number' || denom.value <= 0) {
                throw new Error(`Denomination '${denom.name || denom.abbreviation}' must declare a positive numeric value`);
            }

            const abbr = denom.abbreviation || denom.name;
            if (!abbr) {
                throw new Error('Denomination must declare an abbreviation or name');
            }

            lookupByAbbreviation.set(abbr.toLowerCase(), denom);
            if (denom.name) {
                lookupByName.set(denom.name.toLowerCase(), denom);
            }
            if (denom.pluralName) {
                lookupByName.set(denom.pluralName.toLowerCase(), denom);
            }
        }

        const displayConfig = {
            order: Array.isArray(config.display?.order) ? [...config.display.order] : null,
            includeZeroDenominations: Boolean(config.display?.includeZeroDenominations),
            separator: typeof config.display?.separator === 'string' ? config.display.separator : ' ',
        };

        return {
            canonicalUnit: { ...canonical },
            denominations: sortedDenominations,
            lookupByAbbreviation,
            lookupByName,
            display: displayConfig,
            roundingMode: typeof config.rounding === 'string' ? config.rounding : 'nearest',
        };
    }

    /**
     * Resolve denomination by abbreviation or name.
     * @param {Object} normalizedConfig - Normalized configuration.
     * @param {string} key - Abbreviation or name.
     * @returns {Object|null} Denomination descriptor.
     */
    function resolveDenomination(normalizedConfig, key) {
        if (!key || typeof key !== 'string') {
            return null;
        }

        const lowerKey = key.toLowerCase();
        return (
            normalizedConfig.lookupByAbbreviation.get(lowerKey) ||
            normalizedConfig.lookupByName.get(lowerKey) ||
            null
        );
    }

    /**
     * Determine the primary display denomination.
     * @param {Object} normalizedConfig - Normalized configuration.
     * @returns {Object|null} Denomination descriptor.
     */
    function getPrimaryDenomination(normalizedConfig) {
        if (!normalizedConfig) {
            return null;
        }

        const order = Array.isArray(normalizedConfig.display?.order) ? normalizedConfig.display.order : [];

        for (const key of order) {
            const denom = resolveDenomination(normalizedConfig, key);
            if (denom) {
                return denom;
            }
        }

        if (normalizedConfig.denominations.length > 0) {
            return normalizedConfig.denominations[0];
        }

        return {
            name: normalizedConfig.canonicalUnit.name,
            pluralName: normalizedConfig.canonicalUnit.pluralName,
            abbreviation: normalizedConfig.canonicalUnit.abbreviation,
            value: normalizedConfig.canonicalUnit.value,
        };
    }

    /**
     * Convert currency breakdown into canonical integer value.
     * @param {number|Object} amount - Canonical integer or object mapping denomination -> quantity.
     * @param {Object} config - Raw currency configuration.
     * @param {Object} [options] - Conversion options.
     * @returns {number} Canonical unit count (integer).
     */
    function convertToCanonical(amount, config, options = {}) {
        const normalized = normalizeConfig(config);
        const roundingMode = options.rounding || normalized.roundingMode;

        if (typeof amount === 'number') {
            if (!Number.isFinite(amount)) {
                throw new Error('Currency amount must be a finite number');
            }
            return roundValue(amount, roundingMode);
        }

        if (!amount || typeof amount !== 'object') {
            throw new Error('Currency amount must be a number or object mapping denominations to values');
        }

        let total = 0;
        for (const [key, value] of Object.entries(amount)) {
            if (value === null || value === undefined) {
                continue;
            }

            const numericValue = Number(value);
            if (!Number.isFinite(numericValue)) {
                throw new Error(`Currency value for '${key}' must be numeric`);
            }

            const denomination = resolveDenomination(normalized, key);
            if (!denomination) {
                throw new Error(`Unknown currency denomination '${key}'`);
            }

            total += numericValue * denomination.value;
        }

        return roundValue(total, roundingMode);
    }

    /**
     * Convert canonical integer into denomination breakdown.
     * @param {number} canonicalValue - Canonical BP value.
     * @param {Object} config - Raw currency configuration.
     * @param {Object} [options] - Conversion options.
     * @param {boolean} [options.includeZero] - Include denominations with zero quantity.
     * @returns {Array} Array of { denomination, quantity } respecting display order.
     */
    function convertFromCanonical(canonicalValue, config, options = {}) {
        if (!Number.isFinite(canonicalValue)) {
            throw new Error('Canonical currency value must be a finite number');
        }

        const normalized = normalizeConfig(config);
        let remaining = roundValue(canonicalValue, normalized.roundingMode);

        const includeZero = options.includeZero ?? normalized.display.includeZeroDenominations;
        const order = Array.isArray(normalized.display.order) && normalized.display.order.length > 0
            ? normalized.display.order
                .map((abbr) => resolveDenomination(normalized, abbr))
                .filter(Boolean)
            : normalized.denominations;

        const handledIds = new Set(order.map((denom) => denom.abbreviation || denom.name));
        const additionalDenoms = normalized.denominations.filter((denom) => {
            const key = denom.abbreviation || denom.name;
            return key && !handledIds.has(key);
        });

        const finalOrder = [...order, ...additionalDenoms];
        const breakdown = [];

        finalOrder.forEach((denomination) => {
            const value = denomination.value;
            const quantity = Math.trunc(remaining / value);
            remaining -= quantity * value;

            if (quantity !== 0 || includeZero) {
                breakdown.push({ denomination, quantity });
            }
        });

        if (remaining !== 0) {
            breakdown.push({
                denomination: {
                    name: normalized.canonicalUnit.name,
                    abbreviation: normalized.canonicalUnit.abbreviation,
                    value: normalized.canonicalUnit.value,
                    pluralName: normalized.canonicalUnit.pluralName,
                },
                quantity: remaining,
            });
        }

        return breakdown;
    }

    /**
     * Format canonical currency value into human-readable string.
     * @param {number} canonicalValue - Canonical BP value.
     * @param {Object} config - Raw currency configuration.
     * @param {Object} [options] - Formatting options.
     * @returns {string} Formatted string (e.g., "1 Gold Crown 2 Silver Shillings").
     */
    function formatCurrency(canonicalValue, config, options = {}) {
        const normalized = normalizeConfig(config);
        const separator = options.separator || normalized.display.separator || ' ';
        const includeZero = options.includeZero ?? normalized.display.includeZeroDenominations;
        const roundedCanonical = roundValue(canonicalValue, normalized.roundingMode);

        if (roundedCanonical === 0 && !includeZero) {
            const canonicalLabel = normalized.canonicalUnit.abbreviation || normalized.canonicalUnit.name || 'Units';
            return `0${canonicalLabel}`;
        }

        const breakdown = convertFromCanonical(roundedCanonical, config, { includeZero });

        if (breakdown.length === 0) {
            return `0 ${normalized.canonicalUnit.pluralName || normalized.canonicalUnit.name || 'Units'}`;
        }

        const parts = breakdown
            .filter((entry) => includeZero || entry.quantity !== 0)
            .map((entry) => {
                const denom = entry.denomination;
                const quantity = entry.quantity;
                const abbreviation = denom.abbreviation || denom.name;
                return `${quantity}${abbreviation}`.trim();
            })
            .filter((part) => part.length > 0);

        return parts.length > 0
            ? parts.join(separator).trim()
            : (() => {
                const canonicalLabel = normalized.canonicalUnit.abbreviation || normalized.canonicalUnit.name || 'Units';
                return `0${canonicalLabel}`;
            })();
    }

    /**
     * Sum canonical currency values.
     * @param {Array<number>} values - Array of canonical integers or numeric-like values.
     * @param {Object} [options] - Summation options.
     * @returns {number} Sum in canonical units.
     */
    function sumValues(values, options = {}) {
        if (!Array.isArray(values)) {
            throw new Error('Currency sums require an array of values');
        }

        const roundingMode = options.rounding;
        return values.reduce((total, value) => {
            if (!Number.isFinite(value)) {
                throw new Error('Currency value must be numeric');
            }
            return total + roundValue(value, roundingMode);
        }, 0);
    }

    return {
        normalizeConfig,
        convertToCanonical,
        convertFromCanonical,
        formatCurrency,
        sumValues,
        getPrimaryDenomination,
        roundValue,
        resolveDenomination,
    };
})();

// Expose globally for Foundry runtime
if (typeof window !== 'undefined') {
    window.TradingPlacesCurrencyUtils = CurrencyUtils;
    console.log('✅ window.TradingPlacesCurrencyUtils registered:', !!window.TradingPlacesCurrencyUtils);
} else {
    console.error('❌ window is undefined, cannot register TradingPlacesCurrencyUtils');
}

// Export for Node testing / bundlers
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CurrencyUtils;
}

