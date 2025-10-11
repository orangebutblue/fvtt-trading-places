/**
 * Unit tests for Currency Utilities
 */

const CurrencyUtils = require('../scripts/currency-utils.js');

const sampleConfig = {
    canonicalUnit: {
        name: 'Brass Penny',
        pluralName: 'Brass Pennies',
        abbreviation: 'BP',
        value: 1,
    },
    denominations: [
        {
            name: 'Gold Crown',
            pluralName: 'Gold Crowns',
            abbreviation: 'GC',
            value: 240,
        },
        {
            name: 'Silver Shilling',
            pluralName: 'Silver Shillings',
            abbreviation: 'SS',
            value: 12,
        },
        {
            name: 'Brass Penny',
            pluralName: 'Brass Pennies',
            abbreviation: 'BP',
            value: 1,
        },
    ],
    display: {
        order: ['GC', 'SS', 'BP'],
        includeZeroDenominations: false,
        separator: ' ',
    },
};

describe('CurrencyUtils.normalizeConfig', () => {
    test('creates lookup maps for denominations', () => {
        const normalized = CurrencyUtils.normalizeConfig(sampleConfig);
        expect(normalized.denominations.length).toBe(3);
        expect(normalized.lookupByAbbreviation.get('gc').value).toBe(240);
        expect(normalized.lookupByName.get('gold crown').value).toBe(240);
    });

    test('throws when canonical unit missing', () => {
    expect(() => CurrencyUtils.normalizeConfig({})).toThrow('Currency configuration must declare a canonicalUnit with positive value');
    });
});

describe('CurrencyUtils.convertToCanonical', () => {
    test('converts denomination object to canonical value', () => {
        const canonical = CurrencyUtils.convertToCanonical({ GC: 1, SS: 2, BP: 3 }, sampleConfig);
        expect(canonical).toBe(267);
    });

    test('passes through numeric canonical input', () => {
        const canonical = CurrencyUtils.convertToCanonical(120, sampleConfig);
        expect(canonical).toBe(120);
    });

    test('rejects unknown denomination', () => {
        expect(() => CurrencyUtils.convertToCanonical({ ZZ: 1 }, sampleConfig)).toThrow('Unknown currency denomination');
    });
});

describe('CurrencyUtils.convertFromCanonical', () => {
    test('breaks down canonical value following display order', () => {
        const breakdown = CurrencyUtils.convertFromCanonical(267, sampleConfig);
        expect(breakdown).toHaveLength(3);
        expect(breakdown[0].quantity).toBe(1);
        expect(breakdown[1].quantity).toBe(2);
        expect(breakdown[2].quantity).toBe(3);
    });

    test('includes zero denominations when requested', () => {
        const breakdown = CurrencyUtils.convertFromCanonical(12, sampleConfig, { includeZero: true });
        expect(breakdown).toHaveLength(3);
        expect(breakdown[0].quantity).toBe(0);
        expect(breakdown[1].quantity).toBe(1);
        expect(breakdown[2].quantity).toBe(0);
    });
});

describe('CurrencyUtils.formatCurrency', () => {
    test('formats canonical value into human-readable string', () => {
    const formatted = CurrencyUtils.formatCurrency(267, sampleConfig);
    expect(formatted).toBe('1GC 2SS 3BP');
    });

    test('handles zero value gracefully', () => {
    const formatted = CurrencyUtils.formatCurrency(0, sampleConfig);
    expect(formatted).toBe('0BP');
    });
});

describe('CurrencyUtils.sumValues', () => {
    test('sums canonical values safely', () => {
        const total = CurrencyUtils.sumValues([10, 20, 30]);
        expect(total).toBe(60);
    });

    test('throws when input is not an array', () => {
        expect(() => CurrencyUtils.sumValues(10)).toThrow('Currency sums require an array of values');
    });
});
