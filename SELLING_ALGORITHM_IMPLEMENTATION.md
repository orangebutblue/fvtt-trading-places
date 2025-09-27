# WFRP Selling Algorithm Implementation

## Overview

This document describes the complete implementation of the WFRP 4E Selling Algorithm as specified in the Death on the Reik Companion. The implementation follows the German algorithm specification from `official-algorithm.md` and provides comprehensive logging for all calculations and decisions.

## Algorithm Steps

### Step 1: Selling Eligibility Checks

The algorithm first verifies that the cargo can be legally sold at the current location:

#### Location Restriction
- **Rule**: Characters cannot sell cargo at the same location where they purchased it
- **Implementation**: Compares `cargoHistory.purchaseLocation` with current settlement name
- **Result**: Immediate rejection if locations match

#### Time Restriction  
- **Rule**: If selling at the same location, must wait at least one week
- **Implementation**: Calculates days between `cargoHistory.purchaseDate` and current date
- **Result**: Rejection if less than 7 days have passed

### Step 2: Buyer Availability

The algorithm determines if a buyer can be found using the official formula:

#### Base Calculation
- **Formula**: `(Size Rating × 10) + Trade Bonus`
- **Trade Bonus**: +30% if settlement has "Trade" in production categories
- **Cap**: Maximum 100% chance

#### Village Special Case
- **Rule**: Villages (Size 1) have special limitations
- **Spring Grain Exception**: Normal rules apply for grain sales in Spring
- **Limited Demand**: Roll 1d10 for maximum EP that can be sold
- **Implementation**: Separate `handleVillageSelling()` method

### Step 3: Offer Price Calculation

The algorithm calculates the buyer's offer based on settlement wealth:

#### Base Price
- **Source**: Seasonal cargo prices from dataset
- **Quality**: Supports poor, average, good, excellent quality levels

#### Wealth Modifiers
- **Squalid (1)**: 50% of base price
- **Poor (2)**: 80% of base price  
- **Average (3)**: 100% of base price
- **Bustling (4)**: 105% of base price
- **Prosperous (5)**: 110% of base price

### Step 4: Haggling and Final Price

The algorithm applies haggling results to modify the final offer:

#### Successful Haggling
- **Standard**: +10% price increase
- **With Dealmaker Talent**: +20% price increase
- **Failed Haggling**: No penalty (GM discretion)

## Special Sale Types

### Desperate Sales
- **Availability**: Only at Trade settlements
- **Price**: 50% of base price
- **Restrictions**: None (emergency sale)
- **Use Case**: Quick cargo disposal when needed

### Rumor Sales
- **Availability**: At rumored locations only
- **Price**: 200% of base price (double)
- **Requirements**: Valid rumor information from Gossip test
- **Validation**: Settlement and cargo type must match rumor

## Implementation Features

### Comprehensive Logging

The implementation provides detailed logging for every step:

```javascript
// Algorithm step logging
logger.logAlgorithmStep('WFRP Selling Algorithm', 'Step 2', 'Buyer Availability Check', context, reference);

// Calculation logging  
logger.logCalculation('Buyer Availability Chance', 'Size × 10 + Trade Bonus', inputs, result, description);

// Decision logging
logger.logDecision('Buyer Search', 'Buyer Found', context, options, reasoning);

// Dice roll logging
logger.logDiceRoll('Buyer Availability Check', '1d100', modifiers, roll, target, success, reason);
```

### Error Handling

- **Validation**: Settlement and cargo type validation
- **Graceful Degradation**: Continues with available data when possible
- **Clear Error Messages**: Descriptive error messages for debugging

### Testing Coverage

The implementation includes comprehensive tests covering:

- All algorithm steps and edge cases
- Special sale types (desperate, rumor)
- Village limitations and exceptions
- Error conditions and validation
- Logging verification

## Usage Examples

### Basic Selling

```javascript
const result = await sellingAlgorithm.executeSellingAlgorithm(
    settlement,
    'Wine',
    50,
    'Summer',
    {
        cargoHistory: { 
            purchaseLocation: 'Marienburg', 
            purchaseDate: '2025-01-15' 
        }
    }
);
```

### Selling with Haggling

```javascript
const haggleResult = { success: true, hasDealmakertTalent: false };

const result = await sellingAlgorithm.executeSellingAlgorithm(
    settlement,
    'Cloth',
    60,
    'Winter',
    {
        cargoHistory: { purchaseLocation: 'ALTDORF', purchaseDate: '2025-01-10' },
        haggleResult: haggleResult
    }
);
```

### Desperate Sale

```javascript
const result = await sellingAlgorithm.executeSellingAlgorithm(
    tradeSettlement,
    'Grain',
    120,
    'Autumn',
    {
        saleType: 'desperate',
        cargoHistory: { purchaseLocation: 'ALTDORF', purchaseDate: '2025-01-10' }
    }
);
```

### Rumor Sale

```javascript
const rumorInfo = {
    isValid: true,
    settlementName: 'Grunburg',
    cargoType: 'Wine',
    source: 'Tavern gossip'
};

const result = await sellingAlgorithm.executeSellingAlgorithm(
    settlement,
    'Wine',
    40,
    'Winter',
    {
        saleType: 'rumor',
        rumorInfo: rumorInfo,
        cargoHistory: { purchaseLocation: 'ALTDORF', purchaseDate: '2025-01-10' }
    }
);
```

## Integration Points

### Data Manager Integration
- Uses `getSettlementProperties()` for settlement analysis
- Uses `getSeasonalPrice()` for base price calculation
- Uses `validateSettlement()` for data validation

### Trading Engine Integration
- Integrates with existing season management
- Compatible with current cargo type definitions
- Uses established logging patterns

### Debug Logger Integration
- Follows existing logging categories and formats
- Provides detailed step-by-step execution logs
- Supports different log levels (INFO, ERROR, etc.)

## File Structure

```
scripts/
├── selling-algorithm.js                    # Main selling algorithm implementation
├── selling-algorithm-integration-example.js # Integration examples and utilities
tests/
├── selling-algorithm.test.js              # Comprehensive test suite
```

## Requirements Compliance

The implementation satisfies all requirements from the specification:

- ✅ **7.1**: Complete selling algorithm following official-algorithm.md
- ✅ **7.2**: Selling eligibility checks (location/time restrictions)  
- ✅ **7.3**: Buyer availability with (Size × 10) + Trade bonus
- ✅ **7.4**: Offer price calculation with wealth modifiers
- ✅ **7.5**: Haggling and final price determination
- ✅ **Special Features**: Desperate sales and rumor sales support
- ✅ **5.1-5.5**: Comprehensive logging for every calculation step

## Performance Considerations

- **Async Operations**: Proper async/await handling for dice rolls
- **Memory Efficiency**: No persistent state, stateless operations
- **Error Recovery**: Graceful handling of invalid data
- **Logging Overhead**: Optional logging that can be disabled

## Future Enhancements

Potential areas for future development:

1. **Bulk Selling**: Support for selling multiple cargo types at once
2. **Market Conditions**: Dynamic market conditions affecting prices
3. **Reputation System**: Trader reputation affecting buyer availability
4. **Contract Sales**: Pre-arranged sales with guaranteed buyers
5. **Seasonal Events**: Special events affecting demand and prices

## Conclusion

The WFRP Selling Algorithm implementation provides a complete, tested, and well-documented solution for handling cargo sales in the Trading Places module. It follows the official rules precisely while providing the flexibility and logging needed for a great user experience.