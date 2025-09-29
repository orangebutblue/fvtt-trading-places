# Implementation Plan

## Phase 1: Data Restructuring (Foundation)
1. Create master resource registry with specific goods
2. Update settlement data structure (size letters → numbers, isTradeHub flags)
3. Implement complementary goods mappings
4. Add merchant desperation values to settlements
5. Create non-trading source flag system

## Phase 2: Merchant System Overhaul
1. Implement population-based merchant counts
2. Replace random skills with exponential distribution
3. Add merchant desperation price modifiers
4. Create merchant personality profiles
5. Implement special source behaviors (smuggling, piracy, etc.)

## Phase 3: Advanced Trading Features
1. Implement rumor mode cross-settlement trading
2. Add complementary goods demand system
3. Create government/ruins special behaviors
4. Implement desperation-based merchant matching
5. Add premium pricing for rumor trades
6. Add quality system for goods
7. Implement random/custom settlement creation
8. Add desperate sell mode
9. Add mission mode with contract generation
10. Implement fractional trade penalties

## Phase 4: Testing & Balance
1. Validate all settlement types work correctly
2. Balance price modifiers and desperation effects
3. Test rumor system merchant matching
4. Performance testing with 183 settlements
5. UI updates for new features

## Implementation Priority
1. **High Priority**: Settlement wealth/size affecting merchant counts and quality
2. **Medium Priority**: Competition system with multiple merchants per settlement
3. **Low Priority**: Complex dynamic events (wars, festivals, etc.)