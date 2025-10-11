# Currency Formatting Fixes - Complete Summary

## Problem
The Trading Places UI was displaying currency in decimal format (e.g., "3.52 GC") instead of the canonical format (e.g., "3GC 12SS 4BP"). Additionally, some displays showed just raw numbers without units.

## Root Causes

1. **Missing Module Registration**: `currency-display.js` was not listed in `module.json` esmodules
2. **Incomplete Data Normalization**: Cargo and transaction objects were being saved without formatted currency fields
3. **Template Fallbacks**: Templates fell back to showing raw numbers without units when formatted fields were missing
4. **Missing Normalization on Load**: Old data loaded from settings wasn't being normalized with formatted fields

## Files Modified

### 1. `module.json`
**Change**: Added `scripts/currency-display.js` to esmodules array
**Reason**: Ensures currency-display.js is loaded and available to other modules

### 2. `scripts/ui/TradingUIEventHandlers.js`
**Changes**:
- `_addCargoToInventory()`: Now copies formatted currency fields from transactions to cargo inventory items
- `_addCargoToInventory()`: Recalculates and formats currency when combining existing cargo
- `_getCurrentCargo()`: Normalizes loaded cargo data by adding formatted fields if missing
**Reason**: Ensures all cargo in inventory has proper formatted currency display

### 3. `scripts/flow/SellingFlow.js`
**Changes**:
- Added formatted currency fields to transactions before saving
- All sale notifications use `_formatCurrencyFromDenomination()`
- All card displays use formatted currency
**Reason**: Ensures selling transactions display with proper currency format

### 4. `scripts/trading-application-v2.js`
**Changes**:
- Added debug logging to `_prepareCurrencyRecord()` to track formatting
- Added safety check in `_getCurrencyContext()` with warning logs
**Reason**: Better diagnostics and error handling for currency context issues

### 5. `templates/trading-unified.hbs`
**Changes**:
- Updated all fallback displays to show "GC" unit: `{{else if totalCost}}{{totalCost}} GC{{else}}?{{/if}}`
- Applied to both cargo tab and history tab price displays
**Reason**: Provides better fallback display when formatted values are temporarily missing

### 6. `templates/trading-footer.hbs`
**Changes**:
- Uses `{{formattedTotalCost}}` instead of `{{price}} GC`
- Fixed field names to match transaction object structure
**Reason**: Displays formatted currency in transaction history panel

## How It Works Now

### New Transactions (Buying)
1. User purchases cargo in buying tab
2. `TradingUIRenderer._handlePurchase()` creates transaction with basic fields
3. `_augmentTransaction()` adds formatted fields: `formattedPricePerEP`, `formattedTotalCost`
4. Transaction added to history with formatted fields
5. `_addCargoToInventory()` copies formatted fields to cargo inventory

### New Transactions (Selling)
1. User sells cargo in selling tab
2. `SellingFlow._handleSale()` creates transaction
3. Formatted fields added directly before saving
4. Transaction saved to history with formatted fields

### Loading Old Data
1. App loads cargo from settings via `_getCurrentCargo()`
2. Normalization adds missing formatted fields
3. App loads transaction history via `_prepareTransactionHistory()`
4. Each transaction normalized via `_prepareCurrencyRecord()`
5. Missing formatted fields generated on-the-fly

### Display Hierarchy
Templates use this display priority:
1. `formattedTotalCost` / `formattedPricePerEP` (preferred - canonical format)
2. `totalCost GC` / `pricePerEP GC` (fallback - decimal with unit)
3. `?` (if neither available)

## Expected Behavior

After these changes and reloading Foundry:

- **Buying Tab**: Prices shown as "3GC 12SS 4BP" format
- **Selling Tab**: Offers shown as "3GC 12SS 4BP" format
- **Cargo Tab**: All cargo displays with "3GC 12SS 4BP" format
- **History Tab**: All transactions (buy and sell) display with "3GC 12SS 4BP" format

## Troubleshooting

If currency still shows as "x.xx GC":

1. **Check Console**: Look for currency context warnings: `🔰 _getCurrencyContext: Failed to resolve currency context`
2. **Verify DataManager**: Ensure `window.WFRPRiverTrading.getDataManager()` returns valid instance
3. **Check Currency Utils**: Verify `window.TradingPlacesCurrencyUtils` is available
4. **Clear Old Data**: If necessary, clear Foundry settings for "trading-places.currentCargo" and "trading-places.transactionHistory"

## Debug Logging

The following console logs help diagnose issues:

- `💱 _prepareCurrencyRecord called` - Shows normalization input
- `💱 _prepareCurrencyRecord result` - Shows normalization output  
- `🚛 _getCurrentCargo: Loading cargo` - Shows cargo load from settings
- `🚛 _getCurrentCargo: Normalized cargo item` - Shows per-item normalization
- `🔰 _getCurrencyContext: Failed to resolve` - Warning if context unavailable

## Testing

To verify fixes work:

1. Open Trading Places UI
2. Select a settlement and season
3. Check availability - prices should show as "3GC 12SS 4BP"
4. Purchase cargo - notification and cargo tab should show "3GC 12SS 4BP"
5. Sell cargo - offers and notifications should show "3GC 12SS 4BP"
6. Check history tab - all transactions should show "3GC 12SS 4BP"

## Migration Notes

Old data saved before these changes will be automatically normalized when loaded. No manual migration required. The formatted fields are generated on-the-fly from the numeric values.
