# Trading System Changes - Comprehensive Analysis

## User's Proposed Changes

### 1. Resource Categorization Overhaul
**User's Point:** Settlements shouldn't have generic "Agriculture" - they should specialize in specific goods (wool from sheep farms, grain from farms, etc.)

**AGREED - This makes perfect sense:**
- Sheep farms → Wool only
- Grain farms → Grain only
- Mixed farms → Both wool and grain
- Mining settlements → Metal, Gems, Ore
- Fishing villages → Fish only

### 2. Size System Changes
**User's Suggestion:** Change letter codes (V, ST, T, C, CS) to numbers 1-5

**AGREED with modifications:**
- V (Village) → 1
- ST (Small Town) → 2
- T (Town) → 3
- C (City) → 4
- CS (City State) → 5
- F (Fort) → 2 (military, not economic)
- M (Mine) → 2 (specialized, not general population)

**Impact on Trading:** Higher numbers = more merchants, better availability, higher merchant skills

### 3. Population Effects
**User's Ideas:**
- Population affects merchant availability and skill
- 0.5% of population are traders (minimum = settlement size)
- Max 10 merchants per settlement
- Higher population = higher chance of skilled merchants

**AGREED with refinements:**
- Population multiplier: `merchant_count = max(settlement_size, min(10, population * 0.005))`
- Skill bonus: `skill_modifier = log10(population) * 2` (capped at +20)
- Example: Village (50 pop, size 1) → 1 merchant
- Town (2000 pop, size 3) → 6 merchants
- City (50000 pop, size 4) → 10 merchants + skill bonus

### 4. Merchant Skill Distribution
**User's Suggestion:** Skills 21-120 (99 levels), exponential distribution with 50th level (71 skill) being average

**AGREED with clarification:**
- Normal distribution centered on 71 (50th percentile)
- Standard deviation such that:
  - 68% of merchants: 56-86 skill (competent range)
  - 95% of merchants: 41-101 skill (apprentice to master)
  - 99.7% of merchants: 26-116 skill (novice to legendary)

### 5. Wealth Effects
**User's Point:** Wealth affects buyer/seller prices

**AGREED - Current system:**
- Squalid (1): 50% base price
- Poor (2): 80% base price
- Average (3): 100% base price
- Bustling (4): 105% base price
- Prosperous (5): 110% base price

### 6. "Trade" Source Removal
**User's Point:** "Trade" should be a separate flag, not a resource

**AGREED - Implementation:**
- Remove "Trade" from source arrays
- Add `isTradeHub: true/false` field
- Trade hubs get +10% availability bonus (as per official rules)

### 7. Gossip Tests
**User's Point:** Successful gossip can reveal good buyers/sellers

**AGREED - This fits WFRP mechanics perfectly:**
- Difficult (-10) Gossip test
- Success reveals premium buyers (+100% price) or desperate sellers (-50% price)
- Fits existing rumor system

### 8. Merchant Desperation System
**User's New Idea:** Each merchant has a "desperation" value affecting prices

**EXCELLENT IDEA - This adds great roleplaying depth:**
- **Desperation Scale**: 0-100 (0 = indifferent, 100 = desperate)
- **Price Effects**:
  - Buying: Desperate merchants pay +10% to +50% above normal
  - Selling: Desperate merchants sell for -10% to -50% below normal
- **Generation**: Random roll per merchant, influenced by:
  - Settlement wealth (poor settlements = more desperate)
  - Cargo availability (scarce goods = higher desperation)
  - Merchant personality (some are naturally more desperate)
- **Display**: Show subtle hints like "seems eager" or "appears desperate"

### 11. Rumor Mode Trading
**Problem**: Current system only allows trading within single settlements
**Solution**: Cross-settlement merchant matching based on desperation levels
- Merchants with high desperation (80-100) seek rumors of better prices elsewhere
- Premium pricing (10-25% markup) for rumor-sourced goods
- Settlement proximity affects rumor availability
- Risk/reward balance for long-distance rumor trading

### 12. Non-Trading Source Behaviors
**Problem**: All settlement sources treated identically
**Solution**: Special behaviors for non-economic sources
- **Smuggling**: High risk, high reward, variable availability
- **Piracy**: Coastal settlements only, seasonal raiding patterns
- **Government**: Stable but bureaucratic, official permits required
- **Ruins**: Dangerous exploration, artifact recovery mechanics

### 14. Quality System
**User's New Idea:** Different quality levels for goods affect pricing, with wealthier settlements having access to higher quality items

**EXCELLENT FOR IMMERSION:**
- **Quality Levels**: Poor, Standard, Good, Excellent, Masterwork
- **Price Multipliers**: 
  - Poor: 0.5x base price
  - Standard: 1.0x base price  
  - Good: 1.5x base price
  - Excellent: 2.0x base price
  - Masterwork: 3.0x base price
- **Settlement Wealth Influence**: Higher wealth settlements have higher chance of better quality goods
- **Merchant Skill Influence**: Better merchants more likely to have/appreciate quality differences
- **Display**: "Fine Dwarven Ale" vs "Swill" with quality indicators

### 15. Random/Custom Settlement Mode
**User's New Idea:** Support for settlements not in the database with dynamic creation

**GREAT FOR FLEXIBILITY:**
- **Dynamic Settlement Creation**: UI to add settlements on-the-fly
- **Customization Options**:
  - Settlement name
  - Size (1-5 scale)
  - Wealth level (1-5)
  - Population
  - Trade goods/sources
  - Trade hub status
- **Random Generation**: Based on settlement size:
  - Size 1 (Hamlet): Pop 20-100, Wealth 1-2, 1-2 basic goods
  - Size 2 (Village): Pop 100-500, Wealth 1-3, 2-3 goods
  - Size 3 (Town): Pop 500-2000, Wealth 2-4, 3-4 goods
  - Size 4 (City): Pop 2000-10000, Wealth 3-5, 4-6 goods
  - Size 5 (City-State): Pop 10000+, Wealth 4-5, 5+ goods
- **GM Integration**: Allows GMs to create custom settlements during play

### 17. Mission Mode
**User's New Idea:** Merchants offer procurement contracts with time pressure and risk/reward

**EXCELLENT FOR EMERGENT STORYTELLING:**
- **Contract Generation**: "Travel to [Settlement A], acquire [B] units of [Resource C], return within [D] days"
- **Payment Terms**:
  - **High Risk/High Reward**: No advance payment → 150-200% of normal profit
  - **Medium Risk**: 50% advance payment → 110-130% profit  
  - **Low Risk**: Full advance payment → 80-100% profit (transport fee only)
- **Fail Conditions**:
  - Missing units: -10% payment per 10% missing
  - Late days: -5% payment per day late
  - Total failure: 0 payment + merchant hostility
- **Smart Generation**: Uses rumor system for realistic target settlements/resources
- **Perishable Goods**: Time-sensitive missions for food/livestock with shorter deadlines

### 18. Fractional Trade Penalties
**User's New Idea:** Partial trades get worse prices than complete transactions

**ADDS TRADING STRATEGY:**
- **Full Trade Bonus**: Buy/sell 100% of merchant's offer → 5-10% better price
- **Partial Trade Penalty**: Buy/sell 50% → 2-5% worse price, 25% → 5-10% worse
- **Implementation**: Price multiplier based on (amount_traded / amount_offered)
- **Merchant Logic**: "If you're not taking everything, why give you the best deal?"
- **Strategic Depth**: Forces decisions between optimal pricing vs exact needs

### 13. Complementary Goods System
**Problem**: No demand-side economics
**Solution**: Settlement types demand complementary goods
- **Farming settlements** demand tools, fertilizer, weather protection
- **Mining settlements** demand food, equipment, safety gear
- **Trade hubs** demand luxury goods, information, security
- Price bonuses for supplying demanded complementary goods

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
- **Settlement Size**: Larger settlements have more diverse goods
- **Trade Routes**: Predefined trade connections between settlements
- **Resource Categories**: Bulk goods vs luxury goods availability patterns

### Dynamic Factors (Complex to implement):
- **Wars/Famines**: Too complex for matrix - would need event system
- **Economic Events**: Festivals, disasters - event-driven
- **Trade Route Disruptions**: Complex node system
- **Merchant Caravans**: Dynamic merchant movement

## Implementation Plan

### Phase 1: Data Restructuring (Foundation)
1. Create master resource registry with specific goods
2. Update settlement data structure (size letters → numbers, isTradeHub flags)
3. Implement complementary goods mappings
4. Add merchant desperation values to settlements
5. Create non-trading source flag system

### Phase 2: Merchant System Overhaul
1. Implement population-based merchant counts
2. Replace random skills with exponential distribution
3. Add merchant desperation price modifiers
4. Create merchant personality profiles
5. Implement special source behaviors (smuggling, piracy, etc.)

### Phase 3: Advanced Trading Features
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

### Phase 4: Testing & Balance
1. Validate all settlement types work correctly
2. Balance price modifiers and desperation effects
3. Test rumor system merchant matching
4. Performance testing with 183 settlements
5. UI updates for new features## Implementation Priority
1. **High Priority**: Settlement wealth/size affecting merchant counts and quality
2. **Medium Priority**: Competition system with multiple merchants per settlement
3. **Low Priority**: Complex dynamic events (wars, festivals, etc.)

## Data Structure Needs
- **Settlement Data**: Wealth, size, trade status, population, complementary goods
- **Resource Matrix**: Seasons × Resources × Availability modifiers
- **Merchant Generation**: Rules for creating multiple merchants per settlement
- **Amount Scaling**: How roll results affect trade volumes
- **NEW: Merchant Profiles**: Desperation levels, personality traits, special flags
- **NEW: Complementary Goods**: Settlement type → demanded goods mappings
- **NEW: Rumor System**: Cross-settlement merchant matching by desperation
- **NEW: Source Flags**: Smuggling, piracy, government, ruins behavior modifiers
- **NEW: Quality System**: Quality levels and price multipliers for goods
- **NEW: Custom Settlements**: Dynamic settlement creation and storage
- **NEW: Emergency Selling**: Forced buyer mechanics with discount calculations
- **NEW: Mission Contracts**: Contract generation, payment terms, fail conditions
- **NEW: Trade Completion**: Fractional trade penalty calculations