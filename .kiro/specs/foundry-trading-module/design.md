# Design Document

## Overview

The Trading Places FoundryVTT module implements a complete, rule-compliant trading system based on the official WFRP 4E algorithm from Death on the Reik Companion. The module follows a system-agnostic architecture with clean separation of concerns, allowing for community extensibility through dataset swapping while maintaining full integration with FoundryVTT's native systems.

## Architecture

### High-Level Architecture

The module follows a layered architecture with clear separation between the trading engine logic, data management, UI presentation, and system integration:

```
┌─────────────────────────────────────────┐
│              UI Layer                   │
│  (trading-dialog.js, templates, CSS)   │
├─────────────────────────────────────────┤
│           Controller Layer              │
│         (main.js, dialog logic)        │
├─────────────────────────────────────────┤
│            Business Logic               │
│        (trading-engine.js)              │
├─────────────────────────────────────────┤
│            Data Layer                   │
│         (data-manager.js)               │
├─────────────────────────────────────────┤
│         System Integration              │
│        (system-adapter.js)              │
└─────────────────────────────────────────┘
```

### Module Structure

```
wfrp-river-trading/
├── module.json              # FoundryVTT manifest
├── scripts/
│   ├── main.js             # Module initialization and registration
│   ├── trading-engine.js   # Pure algorithm implementation
│   ├── data-manager.js     # Data access and management
│   ├── trading-dialog.js   # UI controller and dialog management
│   └── system-adapter.js   # System integration abstraction
├── datasets/
│   ├── active/             # Current active dataset
│   │   ├── settlements.json
│   │   ├── cargo-types.json
│   │   └── config.json
│   └── wfrp4e-default/     # Default WFRP dataset
├── templates/
│   └── trading-dialog.hbs  # Main UI template
└── styles/
    └── trading.css         # Module styling
```

## Components and Interfaces

### Trading Engine (trading-engine.js)

**Purpose**: Pure business logic implementation of WFRP trading algorithms with complete rule compliance

**Core Functional Domains**:
1. **Cargo Availability Checking** - Probabilistic availability with settlement-specific production
2. **Purchase Price Calculation** - Seasonal variations, haggling, quality tiers
3. **Sale Price Calculation** - Location/time restrictions, buyer availability, wealth modifiers
4. **Market Demand Determination** - Dynamic demand based on settlement characteristics
5. **Haggling Mechanics** - Opposing skill tests with talent bonuses
6. **Settlement Lookup/Filtering** - Region, size, wealth, and production filtering

**Detailed Algorithm Implementation**:

**Season Management**:
```javascript
class TradingEngine {
    // Season tracking and pricing
    getCurrentSeason()
    setCurrentSeason(season)
    applySeasonalModifiers(basePrice, cargo, season)
    validateSeasonSet() {
        // Ensure season is set before any trading operations
        // Prompt for season selection if not set
    }
    
    // Season management with persistence
    async setCurrentSeason(season) {
        await game.settings.set("wfrp-trading", "currentSeason", season);
        this.currentSeason = season;
        this.notifySeasonChange(season);
    }
    
    async getCurrentSeason() {
        if (!this.currentSeason) {
            this.currentSeason = await game.settings.get("wfrp-trading", "currentSeason") || null;
        }
        return this.currentSeason;
    }
    
    notifySeasonChange(season) {
        ui.notifications.info(`Trading season changed to ${season}. All prices updated.`);
    }
}
```

**Buying Algorithm (Cargo Availability)**:
```javascript
    // Step 0: Settlement Information Lookup
    getSettlementInfo(settlement) {
        // Returns size rating (1-4), wealth rating (1-5), production list
    }
    
    // Step 1: Availability Check
    checkCargoAvailability(settlement, season) {
        // Calculate: (Size + Wealth) × 10% chance on 1d100
        // Use FoundryVTT dice roller for consistency
        // Return: { available: boolean, chance: number, roll: Roll }
    }
    
    // Step 2A: Cargo Type Determination
    determineCargoType(settlement, season) {
        // Handle specific goods vs "Trade" settlements
        // Special case: Trade centers can have TWO available cargoes
        // Return: array of available cargo types
    }
    
    // Step 2B: Cargo Size Calculation
    calculateCargoSize(settlement, rollResult) {
        // Base: Size + Wealth
        // Multiplier: 1d100 rounded UP to nearest 10
        // Trade bonus: roll twice, use higher multiplier
        // Return: total Encumbrance Points available
    }
    
    // Step 3: Price Negotiation
    calculatePurchasePrice(cargo, settlement, options) {
        // Base price from seasonal table
        // +10% penalty for partial purchases
        // Haggle test results (±10%/20%)
        // Wine/brandy quality tier pricing
    }
    
    processHaggleTest(playerSkill, merchantSkill, hasDealmakertTalent) {
        // Comparative skill test using FoundryVTT dice roller
        // Dealmaker talent bonuses
        // Settlement-specific merchant skill levels (32-52)
        // Return roll results for chat display
    }
    
    // Dice rolling integration with FoundryVTT
    async rollAvailability(chance) {
        const roll = new Roll("1d100");
        await roll.evaluate({async: true});
        roll.toMessage({
            flavor: "Cargo Availability Check",
            whisper: game.settings.get("wfrp-trading", "chatVisibility") === "gm" ? [game.user.id] : null
        });
        return roll.total <= chance;
    }
    
    async rollCargoSize() {
        const roll = new Roll("1d100");
        await roll.evaluate({async: true});
        roll.toMessage({
            flavor: "Cargo Size Determination",
            whisper: game.settings.get("wfrp-trading", "chatVisibility") === "gm" ? [game.user.id] : null
        });
        return Math.ceil(roll.total / 10) * 10; // Round up to nearest 10
    }
}
```

**Selling Algorithm**:
```javascript
    // Step 1: Sale Eligibility Check
    checkSaleEligibility(cargo, currentSettlement, purchaseData) {
        // Location restriction: can't sell where bought
        // Time alternative: wait 1 week minimum
        // Return: { eligible: boolean, reason: string }
    }
    
    // Step 2: Buyer Availability Check
    findBuyer(settlement, cargoType) {
        // Base: Size × 10 (+30 if Trade settlement)
        // Partial sale option: sell half and re-roll
        // Village restrictions: Grain only except Spring (1d10 EP others)
    }
    
    // Step 3: Offer Price Determination
    calculateSalePrice(cargo, settlement, season) {
        // Base price from seasonal table
        // Wealth modifiers: 50%-110% of base price
        // Exact official percentages
    }
    
    // Optional Sale Methods
    processDesperateSale(cargo, settlement) {
        // Only at "Trade" settlements
        // 50% base price, no haggling, no wealth modifiers
    }
    
    processRumorSale(cargo, rumoredSettlement) {
        // Requires Difficult (-10) Gossip test using FoundryVTT dice
        // 200% base price at rumored location
        // Risk: rumors may be false/outdated
        // Display roll results in chat
    }
    
    // FoundryVTT Integration Methods
    rollDice(formula, options) {
        // Use FoundryVTT's native Roll class
        // Return Roll object for chat display
    }
    
    validateTransaction(settlement, cargo, actor) {
        // Prevent invalid transactions
        // Check settlement validity, actor resources, etc.
        // Return validation result with specific error messages
    }
}
```

**Design Principles**:
- **No defensive programming** - explicit requirements and fast failure
- **Single responsibility** - clear separation of concerns  
- **Pure functions** with no side effects
- **System agnostic core** - trading engine independent of game system
- **Configuration over convention** - explicit setup, no magic detection

### Data Manager (data-manager.js)

**Purpose**: Centralized data access and management with dynamic category system

**Key Methods**:
```javascript
class DataManager {
    // Dataset management
    loadActiveDataset()
    switchDataset(datasetName)
    validateDatasetStructure(dataset)
    
    // Season management
    getCurrentSeason()
    setCurrentSeason(season)
    persistSeasonState()
    loadSeasonState()
    
    // Settlement operations
    getSettlement(name)
    getSettlementsByRegion(region)
    getSettlementsBySize(size)
    getSettlementsByProduction(category)
    validateSettlement(settlement)
    
    // Data validation schema
    validateSettlement(settlement) {
        const required = ['region', 'name', 'size', 'ruler', 'population', 'wealth', 'source', 'garrison', 'notes'];
        const missing = required.filter(field => !settlement.hasOwnProperty(field));
        
        if (missing.length > 0) {
            throw new Error(`Settlement validation failed. Missing required fields: ${missing.join(', ')}`);
        }
        
        // Type validation
        if (typeof settlement.population !== 'number') {
            throw new Error(`Settlement ${settlement.name}: population must be a number`);
        }
        
        if (!Array.isArray(settlement.source)) {
            throw new Error(`Settlement ${settlement.name}: source must be an array`);
        }
        
        if (settlement.wealth < 1 || settlement.wealth > 5) {
            throw new Error(`Settlement ${settlement.name}: wealth must be between 1-5`);
        }
        
        return true;
    }
    
    validateDatasetStructure(dataset) {
        if (!dataset.settlements || !Array.isArray(dataset.settlements)) {
            throw new Error('Dataset must contain a settlements array');
        }
        
        if (!dataset.config || typeof dataset.config !== 'object') {
            throw new Error('Dataset must contain a config object');
        }
        
        // Validate each settlement
        dataset.settlements.forEach((settlement, index) => {
            try {
                this.validateSettlement(settlement);
            } catch (error) {
                throw new Error(`Settlement ${index}: ${error.message}`);
            }
        });
        
        return true;
    }
    
    // Dynamic category discovery
    buildAvailableCategories() {
        // Automatically scan settlement data to build categories
        // No hardcoded category lists
        // Categories discovered from 'source' field across all settlements
    }
    
    // Cargo operations
    getCargoType(name)
    getSeasonalPrices(season)
    getRandomCargoForSeason(season)
    updatePricingForSeason(season)
    
    // Configuration
    getSystemConfig()
    getCurrencyConfig()
    getInventoryConfig()
    
    // Enhanced error handling
    validateDatasetCompleteness(dataset)
    generateDiagnosticReport(errors)
    specifyMissingFields(validation)
}
```

**Data Format Requirements**:
- **JSON format** for all data files
- Native JavaScript object compatibility
- Human-readable for manual editing
- Supports complex nested structures

**Enhanced Data Validation**:
- JSON schema validation for all datasets
- Required field checking for settlements (9 core fields)
- Enum validation for sizes and wealth ratings
- Price table completeness verification
- **Fail fast** with clear error messages when misconfigured
- **Detailed diagnostics** - Specify which fields are missing/invalid
- **Corruption handling** - Fail fast with diagnostic information for corrupted data
- **Season validation** - Ensure seasonal pricing data is complete

### System Adapter (system-adapter.js)

**Purpose**: Single integration point with FoundryVTT and game systems

**Configuration-Driven Integration**:
```javascript
// Example config.json structure
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

**Key Methods**:
```javascript
class SystemAdapter {
    constructor(config) {
        this.currencyField = config.currency.field;
        this.inventoryField = config.inventory.field;
    }
    
    // Currency operations
    getCurrency(actor) {
        return getProperty(actor, this.currencyField);
    }
    deductCurrency(actor, amount)
    addCurrency(actor, amount)
    
    // Inventory operations  
    addCargoToInventory(actor, cargo)
    removeCargoFromInventory(actor, cargo)
    updateCargoCondition(actor, cargoId, condition)
    
    // System integration
    validateSystemCompatibility()
    getActorProperty(actor, propertyPath)
    setActorProperty(actor, propertyPath, value)
    
    // Direct implementation based on config
    addItem(actor, item) {
        // Uses configured method and field paths
    }
}
```

**Design Philosophy**:
- **Configuration over convention** - explicit setup, no magic detection
- **Support for multiple game systems** through dataset swapping
- **Community extensible** through custom datasets
- **No defensive programming** - fail fast with clear error messages

### Trading Dialog (trading-dialog.js)

**Purpose**: UI controller managing the trading interface and user interactions

**Key Methods**:
```javascript
class TradingDialog extends Dialog {
    // Dialog lifecycle
    static create(options)
    activateListeners(html)
    
    // Season management
    getCurrentSeason()
    setCurrentSeason(season)
    updateSeasonalPricing()
    promptForSeasonSelection()
    
    // UI state management
    updateSettlementInfo(settlement)
    displayAvailableCargo(cargoList)
    updatePriceCalculation(price, modifiers)
    displaySeasonalModifiers(season)
    
    // User interactions
    onSettlementSelect(event)
    onCargoSelect(event)
    onHaggleAttempt(event)
    onPurchaseConfirm(event)
    onSaleAttempt(event)
    onSeasonChange(event)
    
    // FoundryVTT Integration
    rollDice(formula, options)
    displayRollResults(roll, context)
    validateSettlementSelection(settlement)
    preventInvalidTransactions()
    
    // Results display
    displayTransactionResult(result)
    postChatMessage(message)
    showDiceOutcomes(roll)
    displayFailureMessages(error)
    
    // Chat message formatting with GM-only visibility
    generateTradeResult(transaction) {
        return `
        <div class="trading-result">
            <h3>Trade Completed</h3>
            <p><strong>Settlement:</strong> ${transaction.settlement}</p>
            <p><strong>Cargo:</strong> ${transaction.cargo} (${transaction.quantity} EP)</p>
            <p><strong>Final Price:</strong> ${transaction.finalPrice} GC</p>
            <p><strong>Season:</strong> ${transaction.season}</p>
            ${transaction.haggleResult ? `<p><strong>Haggle:</strong> ${transaction.haggleResult}</p>` : ''}
        </div>`;
    }
    
    async postToChat(content, isPrivate = null) {
        const chatVisibility = game.settings.get("wfrp-trading", "chatVisibility");
        const shouldWhisper = isPrivate !== null ? isPrivate : (chatVisibility === "gm");
        
        await ChatMessage.create({
            content: content,
            whisper: shouldWhisper ? [game.user.id] : null,
            type: CONST.CHAT_MESSAGE_TYPES.OTHER
        });
    }
    
    generateRollResult(roll, context) {
        return `
        <div class="trading-roll">
            <h4>${context}</h4>
            <p><strong>Roll:</strong> ${roll.total} (${roll.formula})</p>
            <p><strong>Result:</strong> ${roll.result}</p>
        </div>`;
    }
}
```

**Enhanced FoundryVTT Integration**:
- **Native dice roller integration** - Use FoundryVTT's dice system for all rolls
- **Chat integration** - Display roll results and transaction outcomes in chat
- **Macro support** - Enable player automation of common trading actions
- **Error prevention** - Validate settlements and prevent invalid transactions
- **Season persistence** - Save and restore current season with game state

## Data Models

### Settlement Data Structure

```javascript
{
  "region": "Empire",                    // Geographic/political region
  "name": "Averheim",                   // Settlement identifier
  "size": "T",                          // Size enum (CS/C/T/ST/V/F/M)
  "ruler": "Grand Count Marius Leitdorf", // Leadership information
  "population": 9400,                   // Population count
  "wealth": 4,                          // Wealth rating (1-5)
  "source": ["Trade", "Government", "Cattle", "Agriculture"], // Production categories
  "garrison": ["35a", "80b", "350c"],   // Military strength with quality
  "notes": "Provincial Capital. Known for the stockyards outside the city."
}
```

**Size Enumeration Mapping**:
- **CS** = City State (any size) → 4
- **C** = City (10,000+) → 4  
- **T** = Town (1,000 - 10,000) → 3
- **ST** = Small Town (100 - 1,000) → 2
- **V** = Village (1-100) → 1
- **F** = Fort (any size) → 2
- **M** = Mine (any size) → 2

**Wealth Scale Effects**:
- 1 (Squalid) → 50% base price
- 2 (Poor) → 80% base price
- 3 (Average) → 100% base price
- 4 (Bustling) → 105% base price
- 5 (Prosperous) → 110% base price

### Cargo Data Structure

```javascript
{
  "name": "Grain",
  "category": "Agriculture",
  "basePrices": {
    "spring": 2,
    "summer": 3,
    "autumn": 1,
    "winter": 4
  },
  "qualityTiers": {
    "poor": 0.5,
    "average": 1.0,
    "good": 1.5,
    "excellent": 2.0
  },
  "encumbrancePerUnit": 1,
  "deteriorationRate": 0.1,
  "specialRules": []
}
```

### Transaction Data Structure

```javascript
{
  "id": "unique-transaction-id",
  "type": "purchase" | "sale",
  "cargo": {
    "name": "Grain",
    "quantity": 50,
    "quality": "average",
    "condition": 100
  },
  "settlement": "Averheim",
  "price": {
    "base": 100,
    "modifiers": [
      { "type": "haggle", "amount": -10, "description": "Successful haggle" },
      { "type": "partial", "amount": 10, "description": "Partial purchase penalty" }
    ],
    "final": 100
  },
  "timestamp": "2024-03-15T10:30:00Z",
  "actor": "character-id"
}
```

## Error Handling

### Configuration Errors

**Strategy**: Fail fast with clear error messages

```javascript
// Example error handling
if (!config.currency?.field) {
    throw new Error("Currency field not configured. Please check config.json");
}

if (!actor.data[config.currency.field]) {
    throw new Error(`Actor missing currency field: ${config.currency.field}`);
}
```

**Error Categories**:
- Missing configuration files
- Invalid dataset structure
- Incompatible system integration
- Missing actor properties
- Invalid settlement data

### Runtime Errors

**Strategy**: Graceful degradation with user notification

```javascript
try {
    const result = tradingEngine.processTransaction(transaction);
    return result;
} catch (error) {
    ui.notifications.error(`Trading error: ${error.message}`);
    console.error("Trading module error:", error);
    return null;
}
```

### Data Validation Errors

**Strategy**: Comprehensive validation with detailed feedback

```javascript
const validationResult = validateSettlement(settlement);
if (!validationResult.valid) {
    const errors = validationResult.errors.join(", ");
    throw new Error(`Invalid settlement data: ${errors}`);
}
```

## Testing Strategy

### Unit Testing

**Framework**: Jest or similar JavaScript testing framework

**Test Categories**:
- Algorithm correctness (trading-engine.js)
- Data validation (data-manager.js)
- Price calculations with all modifiers
- Probability mechanics verification
- Edge case handling

**Example Test Structure**:
```javascript
describe('TradingEngine', () => {
    describe('checkCargoAvailability', () => {
        test('calculates correct availability chance', () => {
            const settlement = { size: 'T', wealth: 3 }; // Size 3 + Wealth 3 = 60%
            const result = tradingEngine.checkCargoAvailability(settlement);
            expect(result.chance).toBe(60);
        });
        
        test('handles Trade settlement bonus', () => {
            const settlement = { size: 'T', wealth: 3, source: ['Trade'] };
            // Should roll twice for multiplier
        });
    });
});
```

### Integration Testing

**Focus Areas**:
- FoundryVTT API integration
- Actor property manipulation
- Dialog rendering and interaction
- Chat message posting
- Macro execution

### System Testing

**Test Scenarios**:
- Complete purchase workflow
- Complete sale workflow with restrictions
- Haggling mechanics
- Desperate sale process
- Rumor-based premium sales
- Dataset switching
- Error recovery

### Performance Testing

**Metrics**:
- Dialog load time
- Settlement search performance
- Large dataset handling
- Memory usage with extended play

## Implementation Notes

### FoundryVTT Integration Points

**Module Registration**:
```javascript
Hooks.once('init', () => {
    // Register module settings
    game.settings.register("wfrp-trading", "activeDataset", {
        name: "Active Dataset",
        hint: "Currently loaded trading dataset",
        scope: "world",
        config: true,
        type: String,
        default: "wfrp4e-default"
    });

    game.settings.register("wfrp-trading", "currentSeason", {
        name: "Current Season", 
        hint: "Current trading season for price calculations",
        scope: "world",
        config: true,
        type: String,
        choices: {
            "spring": "Spring",
            "summer": "Summer", 
            "autumn": "Autumn",
            "winter": "Winter"
        },
        default: "spring"
    });

    game.settings.register("wfrp-trading", "chatVisibility", {
        name: "Chat Message Visibility",
        hint: "Who can see trading dice rolls and transaction results",
        scope: "world",
        config: true,
        type: String,
        choices: {
            "gm": "GM Only (Recommended)",
            "all": "All Players"
        },
        default: "gm"
    });
    
    // Initialize data manager
    // Set up system adapter
});

Hooks.once('ready', () => {
    // Validate system compatibility
    // Load active dataset
    // Register UI elements
});
```

**Dialog Integration**:
```javascript
// Use FoundryVTT's native Dialog class
class TradingDialog extends Dialog {
    static get defaultOptions() {
        return mergeObject(super.defaultOptions, {
            template: "modules/wfrp-river-trading/templates/trading-dialog.hbs",
            classes: ["wfrp-trading"],
            width: 600,
            height: 400
        });
    }
}
```

### Performance Considerations

**Data Loading**:
- Lazy load settlement data
- Cache frequently accessed settlements
- Index settlements by common search criteria

**UI Responsiveness**:
- Debounce search inputs
- Paginate large settlement lists
- Async data operations

**Memory Management**:
- Clean up dialog instances
- Remove event listeners on close
- Garbage collect transaction history

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

## Implementation Roadmap

1. **Data Extraction**: Convert Perchance script data to new JSON format
2. **Core Algorithm**: Implement pure trading engine logic
3. **Data Layer**: Build settlement and cargo data management
4. **UI Development**: Create FoundryVTT dialog interface
5. **System Integration**: Build adapter for currency/inventory management
6. **Testing**: Validate algorithm compliance with official rules

This design provides a robust, extensible foundation for implementing the WFRP trading system with complete rule compliance while maintaining clean architecture and FoundryVTT integration best practices.