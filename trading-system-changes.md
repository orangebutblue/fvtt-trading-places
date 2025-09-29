# Trading System Changes - Core Ideas

## Settlement-Based Economic Factors
- **Economic Health**: Settlement wealth rating affects merchant quality, availability amounts, and willingness to trade
- **Trade Hub Status**: Major trade settlements attract better merchants and have higher trading volumes
- **Settlement Size**: Determines number of competing merchants (1-5 merchants based on settlement size)

## Competition System
- **Buying Tab**: Roll settlement_size times, each success creates a merchant offering random cargo for sale
- **Selling Tab**: Roll settlement_size times, each success creates a buyer with different (hidden) skill levels
- **Merchant Variety**: Multiple merchants per settlement with different haggling abilities

## Availability Mechanics
- **No "No Cargo Available"**: Lower rolls reduce merchant willingness/amounts, never eliminate options entirely
- **Amount Scaling**: Failed rolls = smaller trade amounts, successful rolls = larger amounts
- **Merchant Willingness**: Affects both buy and sell limits for each individual merchant

## Resource Availability Factors (Beyond Season)
### Static Factors (Matrix-friendly):
- **Settlement Wealth**: Rich settlements have better access to rare goods
- **Settlement Size**: Larger settlements have more diverse/available goods
- **Trade Routes**: Predefined trade connections between settlements
- **Resource Categories**: Bulk goods vs luxury goods availability patterns

### Dynamic Factors (Complex to implement):
- **Wars/Famines**: Too complex for matrix - would need event system
- **Economic Events**: Festivals, disasters - event-driven
- **Trade Route Disruptions**: Complex node system
- **Merchant Caravans**: Dynamic merchant movement

## Implementation Priority
1. **High Priority**: Settlement wealth/size affecting merchant counts and quality
2. **Medium Priority**: Competition system with multiple merchants per settlement
3. **Low Priority**: Complex dynamic events (wars, festivals, etc.)

## Data Structure Needs
- **Settlement Data**: Wealth, size, trade status
- **Resource Matrix**: Seasons × Resources × Availability modifiers
- **Merchant Generation**: Rules for creating multiple merchants per settlement
- **Amount Scaling**: How roll results affect trade volumes