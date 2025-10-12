// Quick test to verify currency formatting works
// Run with: node test-currency-display.js

// Load currency utilities
import * as CurrencyUtils from '../scripts/currency-utils.js';
import * as currencyDisplay from '../scripts/currency-display.js';

// Make it available globally as the module expects
globalThis.TradingPlacesCurrencyUtils = CurrencyUtils;

// Test context
const testContext = {
    denominationKey: 'gc',
    primaryDenomination: {
        name: 'Gold Crown',
        abbreviation: 'GC',
        valueInBP: 240
    },
    denominations: {
        gc: { name: 'Gold Crown', abbreviation: 'GC', valueInBP: 240 },
        ss: { name: 'Silver Shilling', abbreviation: 'SS', valueInBP: 12 },
        bp: { name: 'Brass Penny', abbreviation: 'BP', valueInBP: 1 }
    }
};

console.log('Testing currency formatting...\n');

// Test 1: Convert and format a price
const testPrice = 3.52; // 3.52 GC
console.log(`Input: ${testPrice} GC`);

const canonical = currencyDisplay.convertDenominationToCanonical(testPrice, testContext);
console.log(`Canonical (BP): ${canonical}`);

const formatted = currencyDisplay.formatCanonicalValue(canonical, testContext);
console.log(`Formatted: ${formatted}`);
console.log('Expected: 3GC 12SS 4BP\n');

// Test 2: Format from denomination directly
const formatted2 = currencyDisplay.formatDenominationValue(testPrice, testContext);
console.log(`Direct format: ${formatted2}`);
console.log('Expected: 3GC 12SS 4BP\n');

// Test 3: Augment a transaction
const transaction = {
    cargo: 'Test Cargo',
    quantity: 10,
    pricePerEP: 2.50,
    totalCost: 25.00
};

console.log('Before augment:', transaction);
currencyDisplay.augmentTransaction(transaction, testContext);
console.log('After augment:', transaction);
console.log('Expected formattedPricePerEP: 2GC 12SS');
console.log('Expected formattedTotalCost: 25GC\n');
