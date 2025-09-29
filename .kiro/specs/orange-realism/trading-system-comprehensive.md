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

### 2. Population-Derived Size Categories
**Updated Direction:** Retire the legacy letter codes entirely and derive size from population thresholds.

**Baseline thresholds (stored in config for easy tuning):**
- Size 1 (Hamlet): up to 200 inhabitants
- Size 2 (Village): 201–1,500 inhabitants
- Size 3 (Town): 1,501–10,000 inhabitants
- Size 4 (City): 10,001–100,000 inhabitants
- Size 5 (Metropolis/City State): 100,001+ inhabitants

**Impact on Trading:** Size is now a population summary; any mechanic referencing settlement size should treat it as the population-derived value above. Forts, mines, and other specialty settlements inherit their size tier from their recorded population.

### 3. Population Effects
**Guiding principle:** More people means more traders. Population feeds directly into the merchant count, but does not automatically boost average quality.

- Final merchant-count formulas live in the config file; they must scale with population while respecting minimums implied by size tiers.
- Large settlements produce more merchants, widening the spread of offers (great deals and terrible ones alike).
- Skill and quality distributions remain independent; population does not bias them upward by itself.

### 4. Merchant Skill Distribution
**Implementation note:** The exact distribution (type and parameters) is defined in the trading config file. Mechanics should read those values at runtime rather than hard-coding a curve in the docs or engine.

### 5. Wealth Effects
**User's Point:** Wealth affects Seeker/Producer prices

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
- Use a dedicated `trade` flag (defined in the settlement-flags dataset)
- Trade-flag modifiers (availability, pricing, etc.) come from the flag definition rather than hard-coded rules

### 7. Gossip Tests
**User's Point:** Successful gossip can reveal good Producers/Seekers

**AGREED - This fits WFRP mechanics perfectly:**
- Difficult (-10) Gossip test
- Success reveals premium Producers (+100% price) or desperate Seekers (-50% price)
- Fits existing rumor system

### 8. Merchant Desperation System
**Revised mechanic:** Desperation is an optional reroll after a failed availability check.

- When an availability roll fails (buying or selling), the player can trigger a desperation reroll.
- The reroll odds and penalties (worse prices, reduced quantities, degraded quality) are defined in the config file.
- Desperation is not stored per settlement or per merchant; it's entirely driven by that reroll flow.
- UI should convey the trade-off clearly before the reroll is taken.

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
  - Population (size auto-derives from thresholds)
  - Wealth level (1-5)
  - Trade goods/sources
  - Flags (including `trade`)
- **Random Generation**: Use the population thresholds from section 2 as the core template. Example defaults:
  - Size 1 (Hamlet): Pop 20-200, Wealth 1-2, 1-2 basic goods
  - Size 2 (Village): Pop 201-1,500, Wealth 1-3, 2-3 goods
  - Size 3 (Town): Pop 1,501-10,000, Wealth 2-4, 3-4 goods
  - Size 4 (City): Pop 10,001-100,000, Wealth 3-5, 4-6 goods
  - Size 5 (Metropolis): Pop 100,001+, Wealth 4-5, 5+ goods
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
- **Settlement Specialization**: Each settlement can specify `produces` (consistent exports) and `demands` (consistent imports). These lists seed the supply/demand balance before seasonal or flag adjustments.
- **Trade hubs** demand luxury goods, information, security
- Price bonuses for supplying demanded complementary goods

### 14. Supply/Demand Equilibrium
**New economic backbone:** Maintain a 200-point equilibrium for every cargo type per settlement.

- Baseline is 100 supply / 100 demand. Every modifier transfers a percentage of the opposing pool to its own side (e.g., a +50% supply shift turns 100/100 into 150/50; stacking repeats multiplicatively so the next +50% becomes 175/25).
- The following sources contribute configurable transfer percentages:
  - Settlement `produces` (supply-side) and `demands` (demand-side)
  - Flag modifiers (e.g., `mine` pushes raw materials toward surplus, `subsistence` pushes shortages)
  - Seasonal matrices, wealth tiers, rumor events, etc.
- The final supply and demand values drive merchant availability, lot sizes, and seeker interest. Extreme values (e.g., demand ≤ 10) can automatically block trades ("we're flooded with gold") or trigger desperation logic.
- All transfer percentages, clamping rules, and output multipliers live in the trading config so balance tweaks never require data rewrites.

## Settlement-Based Economic Factors
- **Economic Health**: Settlement wealth rating affects merchant quality, availability amounts, and willingness to trade
- **Trade Flag**: The `trade` flag applies its modifiers (availability, pricing, etc.) via the shared flag system
- **Population-Derived Size**: Size is calculated from population, then used to seed merchant counts and other size-based mechanics
- **Supply/Demand Balance**: The 200-point equilibrium (fed by `produces`, `demands`, flags, and seasonal effects) is the primary driver for how many Producers/Seekers appear and how much they offer.

## Competition System
- **Buyer Tab**: Roll based on the population-derived size value; each success creates a Producer offering random cargo for sale
- **Seller Tab**: Roll the same size-driven count; each success creates a Seeker with independent skill rolls
- **Merchant Variety**: Multiple merchants per settlement with different haggling abilities

## Availability Mechanics
- **No "No Cargo Available"**: Lower rolls reduce merchant willingness/amounts, never eliminate options entirely
- **Amount Scaling**: Failed rolls = smaller trade amounts, successful rolls = larger amounts
- **Merchant Willingness**: Affects both buy and sell limits for each individual merchant

## Resource Availability Factors (Beyond Season)
### Static Factors (Matrix-friendly):
- **Settlement Wealth**: Rich settlements have better access to rare goods
- **Population-Derived Size**: Larger populations mean broader goods diversity
- **Trade Routes**: Predefined trade connections between settlements
- **Resource Categories**: Bulk goods vs luxury goods availability patterns

### Dynamic Factors (Complex to implement):
- **Wars/Famines**: Too complex for matrix - would need event system
- **Economic Events**: Festivals, disasters - event-driven
- **Trade Route Disruptions**: Complex node system
- **Merchant Caravans**: Dynamic merchant movement

## Terminology
To avoid confusion between player and merchant roles, we use distinct terms:

- **Player when buying from merchant**: "Buyer"
- **Player when selling to merchant**: "Seller"
- **Merchant when selling to player**: "Producer"
- **Merchant when buying from player**: "Seeker"