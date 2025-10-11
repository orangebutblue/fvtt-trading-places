console.log('Trading Places | Loading currency-display.js');

let CurrencyUtils = null;
if (typeof window !== 'undefined' && window.TradingPlacesCurrencyUtils) {
    CurrencyUtils = window.TradingPlacesCurrencyUtils;
} else if (typeof globalThis !== 'undefined' && globalThis.TradingPlacesCurrencyUtils) {
    CurrencyUtils = globalThis.TradingPlacesCurrencyUtils;
} else if (typeof require === 'function') {
    try {
        // eslint-disable-next-line global-require, import/no-dynamic-require
        CurrencyUtils = require('./currency-utils');
    } catch (error) {
        // Ignore environments without require support.
    }
}

const FALLBACK_LABEL = 'GC';

function getCurrencyUtils() {
    return CurrencyUtils;
}

function resolveCurrencyContext(dataManager) {
    if (!CurrencyUtils || !dataManager || typeof dataManager.getCurrencyContext !== 'function') {
        return null;
    }

    try {
        return dataManager.getCurrencyContext();
    } catch (error) {
        console.error('CurrencyDisplay: Failed to resolve currency context', error);
        return null;
    }
}

function getCurrencyLabel(context, fallback = FALLBACK_LABEL) {
    if (!context) {
        return fallback;
    }

    const denomination = context.primaryDenomination || {};
    return denomination.abbreviation || denomination.name || context.denominationKey || fallback;
}

function convertDenominationToCanonical(value, context, options = {}) {
    if (typeof value !== 'number' || Number.isNaN(value)) {
        return null;
    }

    // Prices are already in canonical unit (BP), no conversion needed
    console.log(`💱 Price already in BP: ${value} BP (no conversion)`);
    return value;
}

function formatCanonicalValue(canonicalValue, context, options = {}) {
    if (typeof canonicalValue !== 'number' || Number.isNaN(canonicalValue)) {
        return options.defaultText ?? 'N/A';
    }

    if (!CurrencyUtils || !context) {
        const label = options.label || getCurrencyLabel(context);
        const decimals = Number.isInteger(canonicalValue) ? 0 : (options.decimals ?? 2);
        const formattedNumber = decimals === 0 ? String(Math.round(canonicalValue)) : canonicalValue.toFixed(decimals);
        return `${formattedNumber} ${label}`.trim();
    }

    try {
        return CurrencyUtils.formatCurrency(canonicalValue, context.config);
    } catch (error) {
        console.error('CurrencyDisplay: Failed to format canonical value', { canonicalValue, error });
        const label = options.label || getCurrencyLabel(context);
        return `${canonicalValue} ${label}`.trim();
    }
}

function formatDenominationValue(value, context, options = {}) {
    if (typeof value !== 'number' || Number.isNaN(value)) {
        return options.defaultText ?? 'N/A';
    }

    if (!context) {
        throw new Error('CURRENCY CONTEXT IS NULL! Cannot format denomination value: ' + value);
    }

    // Value is already in BP (canonical), just format it
    return formatCanonicalValue(value, context, options);

    const label = options.label || getCurrencyLabel(context);
    const decimals = options.decimals ?? 2;
    return `${value.toFixed(decimals)} ${label}`.trim();
}

function enrichPricing(pricing, quantity, context) {
    if (!pricing || typeof pricing !== 'object') {
        return pricing;
    }

    const enriched = { ...pricing };
    const qty = typeof quantity === 'number' ? quantity : 0;
    const finalPerEp = typeof enriched.finalPricePerEP === 'number' ? enriched.finalPricePerEP : null;
    const basePerEp = typeof enriched.basePricePerEP === 'number' ? enriched.basePricePerEP : null;
    const totalValue = typeof enriched.totalValue === 'number'
        ? enriched.totalValue
        : (finalPerEp !== null && qty ? finalPerEp * qty : null);

    if (context && CurrencyUtils) {
        if (basePerEp !== null) {
            const canonical = convertDenominationToCanonical(basePerEp, context);
            if (canonical !== null) {
                enriched.basePricePerEPCanonical = canonical;
                enriched.formattedBasePricePerEP = formatCanonicalValue(canonical, context);
            }
        }

        if (finalPerEp !== null) {
            const canonical = convertDenominationToCanonical(finalPerEp, context);
            if (canonical !== null) {
                enriched.finalPricePerEPCanonical = canonical;
                enriched.formattedFinalPricePerEP = formatCanonicalValue(canonical, context);
            }
        }

        if (typeof totalValue === 'number' && !Number.isNaN(totalValue)) {
            const canonical = convertDenominationToCanonical(totalValue, context);
            if (canonical !== null) {
                enriched.totalValueCanonical = canonical;
                enriched.formattedTotalValue = formatCanonicalValue(canonical, context);
            }
        }
    } else {
        const label = getCurrencyLabel(context);
        const decimals = 2;
        if (basePerEp !== null) {
            enriched.formattedBasePricePerEP = `${basePerEp.toFixed(decimals)} ${label}`;
        }
        if (finalPerEp !== null) {
            enriched.formattedFinalPricePerEP = `${finalPerEp.toFixed(decimals)} ${label}`;
        }
        if (typeof totalValue === 'number' && !Number.isNaN(totalValue)) {
            enriched.formattedTotalValue = `${totalValue.toFixed(decimals)} ${label}`;
        }
    }

    if (context) {
        enriched.currencyDenominationKey = context.denominationKey || null;
        enriched.currencyDenomination = context.primaryDenomination || null;
    }

    return enriched;
}

function augmentTransaction(transaction, context) {
    if (!transaction || typeof transaction !== 'object') {
        return transaction;
    }

    if (!context || !CurrencyUtils) {
        throw new Error('CURRENCY CONTEXT MISSING! Cannot format transaction. Context: ' + JSON.stringify(context) + ', CurrencyUtils: ' + !!CurrencyUtils);
    }

    if (typeof transaction.pricePerEP === 'number' && !Number.isNaN(transaction.pricePerEP)) {
        const canonical = convertDenominationToCanonical(transaction.pricePerEP, context);
        if (canonical === null) {
            throw new Error('Failed to convert pricePerEP to canonical: ' + transaction.pricePerEP);
        }
        transaction.pricePerEPCanonical = canonical;
        transaction.formattedPricePerEP = formatCanonicalValue(canonical, context);
    } else if (typeof transaction.pricePerEPCanonical === 'number') {
        transaction.formattedPricePerEP = formatCanonicalValue(transaction.pricePerEPCanonical, context);
    }

    if (typeof transaction.totalCost === 'number' && !Number.isNaN(transaction.totalCost)) {
        const canonical = convertDenominationToCanonical(transaction.totalCost, context);
        if (canonical === null) {
            throw new Error('Failed to convert totalCost to canonical: ' + transaction.totalCost);
        }
        transaction.totalCostCanonical = canonical;
        transaction.formattedTotalCost = formatCanonicalValue(canonical, context);
    } else if (typeof transaction.totalCostCanonical === 'number') {
        transaction.formattedTotalCost = formatCanonicalValue(transaction.totalCostCanonical, context);
    }

    if (context) {
        transaction.currencyDenominationKey = context.denominationKey || null;
        transaction.currencyDenomination = context.primaryDenomination || null;
    }

    return transaction;
}

function augmentCargo(cargo, context) {
    if (!cargo || typeof cargo !== 'object') {
        return cargo;
    }

    augmentTransaction(cargo, context);
    return cargo;
}

export {
    getCurrencyUtils,
    resolveCurrencyContext,
    getCurrencyLabel,
    convertDenominationToCanonical,
    formatCanonicalValue,
    formatDenominationValue,
    enrichPricing,
    augmentTransaction,
    augmentCargo
};
