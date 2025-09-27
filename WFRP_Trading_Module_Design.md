# WFRP River Trading - FoundryVTT Module Design Document

## Project Overview

A system-agnostic FoundryVTT module implementing the complete WFRP 4E river trading algorithm with full rule compliance. The module will provide realistic trading simulation with proper market dynamics, uncertainty, and economic restrictions.

---

## Technical Implementation

### Architecture Decision
**FoundryVTT Module** (not external webhook service)
- Native integration with Foundry's UI system
- Direct access to game data and character sheets
- Better performance and user experience
- No external dependencies

### System Agnostic Design
**Philosophy**: No defensive programming, no fallbacks, no detection logic
- Clean, direct implementation with explicit configuration
- Support for multiple game systems through dataset swapping
- Community extensible through custom datasets
- Fail fast with clear error messages when misconfigured

### Module Structure
```
wfrp-river-trading/
├── module.json              # Foundry manifest
├── scripts/
│   ├── main.js             # Module initialization
│   ├── trading-engine.js   # Core algorithm implementation (pure logic)
│   ├── data-manager.js     # Data access layer
│   ├── trading-dialog.js   # UI controller
│   └── system-adapter.js   # Single integration point
├── datasets/
│   ├── active/             # Current active dataset
│   │   ├── settlements.json
│   │   ├── cargo-types.json
│   │   └── config.json
│   └── wfrp4e-default/     # Example/default dataset
├── templates/
│   └── trading-dialog.hbs  # Main UI template
└── styles/
    └── trading.css         # Module styling
```

---

## Algorithm Implementation

### Rule Compliance Target
**Full WFRP 4E Official Algorithm** (no simplified versions)
- Complete implementation of *Death on the Reik Companion* pages 71-78
- All probability mechanics, restrictions, and market dynamics
- No "arcade mode" or simplified alternatives

### Core Functional Domains
1. **Cargo Availability Checking**
   - Probabilistic availability: `(Size + Wealth) × 10%` chance on 1d100
   - Dynamic cargo size: `(Size + Wealth) × (1d100 rounded to nearest 10)` EP
   - Settlement-specific production lists
   - Special "Trade" settlement mechanics

2. **Purchase Price Calculation**
   - Seasonal base price variations
   - +10% penalty for partial cargo purchases
   - Haggle test mechanics (±10%/20% price adjustments)
   - Wine/brandy quality tier pricing

3. **Sale Price Calculation**
   - Location/time restrictions (can't sell where bought OR wait 1 week)
   - Buyer availability: `Size × 10 (+30 if Trade)%` chance on 1d100
   - Wealth-based price modifiers (exact official percentages)
   - Village restrictions (Hamlets: Grain only, except Spring = 1d10 EP other goods)
   - Desperate sale options (50% base price at Trade settlements)
   - Rumor system (Gossip tests for 2× base price locations)

4. **Market Demand Determination**
   - Dynamic demand based on settlement characteristics
   - Seasonal demand variations
   - Supply/demand interaction effects

5. **Haggling Mechanics**
   - Opposing skill test system
   - Dealmaker talent bonuses
   - Settlement-specific merchant skill levels

6. **Settlement Lookup/Filtering**
   - Region-based organization
   - Size/wealth filtering capabilities
   - Production category searches

---

## Algorithm Specifications

### I. Buying Algorithm (Cargo Availability)

This process determines if cargo is available in a settlement, what type, what quantity, and at what price.

#### Step 0: Settlement Information Lookup
For the selected settlement, retrieve from dataset:
1. **Size Rating** (CS/C/T/ST/V/F/M) - converts to numeric 1-4 for calculations
2. **Wealth Rating** (1-5) 
3. **Produces List** (array of cargo categories)

#### Step 1: Availability Check
1. **Calculate Base Chance**: Add Size Rating + Wealth Rating, multiply by 10 to get percentage
2. **Roll Check**: Roll 1d100
   - If result ≤ calculated chance: cargo is available
   - If result > calculated chance: no cargo available

#### Step 2A: Cargo Type Determination
1. **Specific Goods**: If settlement produces specific cargo types, these are available
2. **Trade Settlements**: If settlement produces "Trade", roll on random cargo table (seasonal)
3. **Multiple Productions**: If settlement produces both specific goods AND "Trade", both types may be available
4. **Special Case - Trade Centers**: Settlements with "Trade" + other goods can have TWO available cargoes

#### Step 2B: Cargo Size Calculation (Encumbrance Points)
1. **Base Value**: Add Size Rating + Wealth Rating
2. **Multiplier**: Roll 1d100, round UP to nearest 10 (e.g., 36 becomes 40)
3. **Total Size**: Base Value × Multiplier = Available Encumbrance Points
4. **Trade Center Bonus**: If wealth comes from "Trade", roll 1d100 twice, use the higher multiplier

#### Step 3: Price Negotiation
1. **Base Price**: Look up cargo price from Base Price Table (factor in season, wine quality if applicable)
2. **Partial Purchase Penalty**: If not buying full available cargo, increase price by 10%
3. **Haggle Test**: Player can attempt comparative Haggle test vs merchant (typically 32-52 skill)
4. **Final Price**: 
   - Haggle success: -10% price (or -20% with Dealmaker talent)
   - Haggle failure: base price (or +10% at GM discretion)

### II. Selling Algorithm

This process determines if buyers exist, what they'll pay, and finalizes the transaction.

#### Step 1: Sale Eligibility Check
1. **Location Restriction**: Cannot sell cargo in the same settlement where it was purchased
2. **Time Alternative**: OR must wait minimum 1 week before attempting sale in same location
3. **Validation**: Check that current location ≠ purchase location OR sufficient time has passed

#### Step 2: Buyer Availability Check
1. **Calculate Chance**:
   - Base: Settlement Size Rating × 10
   - Bonus: +30 if settlement produces "Trade"
2. **Roll Check**: Roll 1d100
   - If result ≤ calculated chance: buyer found
   - If result > calculated chance: no buyer available
3. **Partial Sale Option**: If no buyer, can attempt to sell only HALF the cargo and re-roll
4. **Village Restrictions**: 
   - Size 1 settlements (Villages): normally no demand except Grain in Spring
   - Maximum 1d10 Encumbrance Points of non-Grain goods can be sold

#### Step 3: Offer Price Determination
1. **Base Price**: Use Base Price Table for the cargo type and current season
2. **Wealth Adjustment**: Multiply base price by settlement wealth modifier:
   - Squalid (1): 50% of base price
   - Poor (2): 80% of base price  
   - Average (3): 100% of base price (no change)
   - Bustling (4): 105% of base price
   - Prosperous (5): 110% of base price

#### Step 4: Haggling and Transaction
1. **Haggle Test**: Player can attempt comparative Haggle test against buyer
2. **Price Adjustment**: 
   - Success: +10% to offer price (or +20% with Dealmaker talent)
   - Failure: offer price stands
3. **Transaction Completion**: If price accepted, sale is finalized

### Optional Sale Methods

#### Desperate Sale
- **Availability**: Any settlement that produces "Trade"
- **Price**: 50% of base price (no wealth modifiers)
- **No Haggling**: Price is fixed
- **Use Case**: Quick disposal of unwanted cargo

#### Rumor-Based Premium Sales
1. **Information Gathering**: Difficult (-10) Gossip Test
2. **Rumor Discovery**: Learn of settlement with high demand for specific cargo
3. **Premium Price**: Can sell for 200% of base price at rumored location
4. **Risk**: Rumors may be false or outdated

---

## Data Layer Design

### Settlement Data Structure
**9 Core Fields:**
```json
{
  "region": "Empire",                    // Category/province
  "name": "Averheim",                   // Settlement name (string)
  "size": "T",                          // Settlement size (enum)
  "ruler": "Grand Count Marius Leitdorf", // Leadership (string)
  "population": 9400,                   // Population count (number)
  "wealth": 4,                          // Wealth rating (1-5 scale)
  "source": ["Trade", "Government", "Cattle", "Agriculture"], // Production categories (list)
  "garrison": ["35a", "80b", "350c"],   // Military strength (list with quality ratings)
  "notes": "Provincial Capital. Known for the stockyards outside the city." // Additional info (string)
}
```

### Settlement Size Enumeration
- **CS** = City State (any size)
- **C** = City (10,000+)
- **T** = Town (1,000 - 10,000)
- **ST** = Small Town (100 - 1,000)
- **V** = Village (1-100)
- **F** = Fort (any size)
- **M** = Mine (any size)

### Wealth Scale Mapping
- **1** = Squalid (50% base price)
- **2** = Poor (80% base price)
- **3** = Average (100% base price)
- **4** = Bustling (105% base price)
- **5** = Prosperous (110% base price)

### Dynamic Category System
- **No hardcoded category lists**
- System automatically scans settlement data to build available categories
- New datasets can introduce novel production categories without code modification
- Categories discovered from `source` field across all settlements

### Data Format
**JSON** format for all data files
- Native JavaScript object compatibility
- Easy parsing in FoundryVTT environment
- Human-readable for manual editing
- Supports complex nested structures

---

## System Integration

### Currency/Item Integration
**Configuration-Driven Approach:**
```javascript
// In config.json
{
  "currency": {
    "field": "data.money.gc",           // Actor property path
    "name": "Gold Crowns",
    "abbreviation": "GC"
  },
  "inventory": {
    "field": "data.items",              // Actor items collection
    "addMethod": "createEmbeddedDocuments"
  }
}
```

### Single Integration Point
```javascript
// system-adapter.js
class SystemAdapter {
    constructor(config) {
        this.currencyField = config.currency.field;
        this.inventoryField = config.inventory.field;
    }
    
    getCurrency(actor) {
        return getProperty(actor, this.currencyField);
    }
    
    addItem(actor, item) {
        // Direct implementation based on config
    }
}
```

---

## Future Features (Not First Release)

### Garrison Arms Trading
- Extended trading system for military equipment
- Quality-based equipment needs assessment
- Garrison size determines quantity requirements
- Arms quality ratings: Excellent (a), Average (b), Poor (c)

### Additional Enhancements
- Multi-session campaign tracking
- Historical price trend analysis
- Random market events
- Advanced haggling mechanics with character trait integration

---

## Development Principles

### Code Quality
- **No defensive programming** - explicit requirements and fast failure
- **Single responsibility** - clear separation of concerns
- **Configuration over convention** - explicit setup, no magic detection
- **System agnostic core** - trading engine independent of game system

### User Experience
- **Clear error messages** when configuration is invalid
- **Direct UI integration** with FoundryVTT dialog system
- **Chat integration** for trade result reporting
- **Macro support** for player automation

### Extensibility
- **Community dataset creation** through documented schema
- **Custom rule variants** through configuration files
- **Multiple game system support** without core code changes

---

## Next Steps

1. **Data Extraction**: Convert Perchance script data to new JSON format
2. **Core Algorithm**: Implement pure trading engine logic
3. **Data Layer**: Build settlement and cargo data management
4. **UI Development**: Create FoundryVTT dialog interface
5. **System Integration**: Build adapter for currency/inventory management
6. **Testing**: Validate algorithm compliance with official rules

---

*This design document reflects all architectural decisions made and serves as the blueprint for implementation.*