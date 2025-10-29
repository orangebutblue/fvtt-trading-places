# Seller Offers Persistence Fix

## Problem
When users clicked "Look for Sellers" in the selling tab and then closed and reopened the Trading Places UI, the seller results would disappear. This was inconsistent with the buying tab, which persists its cargo availability results.

## Root Cause
The selling tab had no persistence mechanism for seller offers. While the buying tab uses `_saveCargoAvailability()` and `_loadAndRestoreCargoAvailability()` to persist results across UI sessions, the selling tab was missing equivalent functionality.

## Solution Implemented
Added comprehensive persistence functionality for seller offers that mirrors the buying tab's cargo persistence system.

### 1. Added Seller Persistence Methods to SellingFlow.js

#### `_saveSellerOffers(sellerOffers)`
- Saves seller offers to Foundry game settings
- Uses settlement + season as storage key
- Includes timestamp for data expiration
- Storage location: `"trading-places"."sellerOffersData"`

#### `_loadSellerOffers()`
- Loads seller offers from Foundry game settings
- Validates data relevance (correct settlement/season)
- Implements 24-hour expiration for stale data
- Returns null if no valid data found

#### `_clearSellerOffers()`
- Removes saved seller offers for current settlement/season
- Called when settlement or season changes

#### `restoreSellerOffers()`
- Public method to restore seller offers if they exist
- Displays offers without triggering new search
- Shows user notification about restoration
- Returns boolean indicating if restoration was successful

### 2. Integrated Persistence into Application Flow

#### Application Initialization (`trading-application-v2.js`)
- Added seller offer restoration to `_prepareContext()`
- Restoration happens alongside cargo availability restoration
- Only attempts restoration if settlement and season are selected

#### Settlement/Season Changes
- Added seller offer clearing to season change handler
- Added seller offer clearing to settlement change handler
- Ensures clean state when context changes

#### Seller Search Flow
- Modified `onLookForSellers()` to save offers after generation
- Seller offers are now automatically persisted when created

## Technical Implementation

### Data Structure
```javascript
{
  settlement: "Altdorf",
  season: "spring", 
  timestamp: 1234567890123,
  sellerOffers: [
    {
      slotNumber: 1,
      cargo: { cargo: "Grain", category: "Food", quantity: 50 },
      offerPricePerEP: 2.5,
      maxEP: 25,
      skillRating: 45,
      buyerName: "Hans Schmidt the Merchant"
    }
    // ... more offers
  ]
}
```

### Storage Key Format
- Pattern: `${settlementName}_${season}`
- Example: `"Altdorf_spring"`
- Allows independent storage per settlement/season combination

### Data Expiration
- 24-hour maximum age for saved data
- Prevents stale offers from being restored
- Configurable via `maxAge` constant

## Benefits

### 1. Consistency with Buying Tab
- Selling tab now behaves identically to buying tab
- Both tabs persist their results across UI sessions
- Unified user experience

### 2. Improved User Experience
- No need to re-run seller searches after UI reopening
- Faster access to previously found offers
- Maintains workflow continuity

### 3. Performance Benefits
- Avoids unnecessary re-computation of seller offers
- Reduces random number generation calls
- Faster UI initialization when data exists

### 4. Data Integrity
- Automatic cleanup when context changes
- Expiration prevents outdated information
- Validation ensures data relevance

## User-Facing Changes

### Before Fix
1. User clicks "Look for Sellers"
2. Seller offers are displayed
3. User closes Trading Places dialog
4. User reopens Trading Places dialog
5. **Seller offers are gone** ❌

### After Fix
1. User clicks "Look for Sellers"
2. Seller offers are displayed and **automatically saved**
3. User closes Trading Places dialog
4. User reopens Trading Places dialog
5. **Seller offers are automatically restored** ✅
6. User sees notification: "Restored X seller offers for [Settlement]"

## Edge Cases Handled

### Settlement/Season Changes
- Seller offers are cleared when settlement changes
- Seller offers are cleared when season changes
- Prevents display of irrelevant offers

### Data Validation
- Checks settlement and season match current selection
- Ignores data older than 24 hours
- Handles missing or corrupted data gracefully

### UI State Management
- Restores offers without user notification spam
- Maintains proper UI state during restoration
- Handles restoration failures silently

## Code Quality Improvements

### Logging
- Comprehensive debug logging for troubleshooting
- Consistent log format with cargo persistence
- Error handling with user-friendly messages

### Error Handling
- Try-catch blocks around all persistence operations
- Graceful degradation when persistence fails
- No impact on core selling functionality

### Consistency
- Mirrors buying tab patterns exactly
- Uses same naming conventions and structure
- Maintains architectural consistency

## Files Modified

### `scripts/flow/SellingFlow.js`
- Added `_saveSellerOffers()` method
- Added `_loadSellerOffers()` method  
- Added `_clearSellerOffers()` method
- Added `restoreSellerOffers()` method
- Modified `onLookForSellers()` to save offers

### `scripts/trading-application-v2.js`
- Added seller offer restoration to `_prepareContext()`
- Added seller offer clearing to season change handler

### `scripts/ui/TradingUIEventHandlers.js`
- Added seller offer clearing to settlement change handler

## Testing Recommendations

### Manual Testing
1. Select settlement and season
2. Click "Look for Sellers"
3. Verify offers are displayed
4. Close and reopen Trading Places dialog
5. Verify offers are restored with notification
6. Change settlement - verify offers are cleared
7. Change season - verify offers are cleared

### Automated Testing
- Unit tests for persistence methods
- Integration tests for restoration flow
- Edge case tests for data validation

## Future Enhancements

### Possible Improvements
1. **Configurable Expiration**: Allow users to set data expiration time
2. **Cross-Session Sharing**: Share seller data between different characters
3. **Offer Updates**: Update offers based on completed sales
4. **Backup/Export**: Allow export of seller data for backup

### Performance Optimizations
1. **Lazy Loading**: Only load seller data when selling tab is accessed
2. **Compression**: Compress seller data for storage efficiency
3. **Cleanup**: Periodic cleanup of expired data

## Conclusion

This fix brings the selling tab's persistence behavior in line with the buying tab, providing a consistent and improved user experience. Users can now confidently close and reopen the Trading Places dialog without losing their seller search results, making the trading workflow much more efficient and user-friendly.