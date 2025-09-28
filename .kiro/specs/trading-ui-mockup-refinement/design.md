# Design Document

## Overview

This design document outlines the refinement of the trading UI HTML mockup (`tmp_rovodev_new_unified_trading_ui.html`) to improve the user interface design and workflow. The new design will restructure the tab system, improve responsive behavior, integrate official WFRP algorithms, and provide better separation between buying and selling operations.

## Architecture

### Current State Analysis

The existing mockup has the following structure:
- **Header**: Season control and app title
- **Sidebar**: Location selection, settlement info, and quick actions
- **Main Panel**: Tabbed interface with Market, Inventory, and History tabs
- **Responsive Design**: Grid layout that adapts to screen size

### Proposed Changes

#### 1. Tab Structure Redesign

**Current Issues:**
- "Market" tab name is unclear about its buying focus
- "Inventory" tab mixes player inventory with selling functionality
- Quick Actions section creates confusion about where actions belong

**Solution:**
```html
<!-- New Tab Structure -->
<div class="tabs">
    <button class="tab active" data-tab="buying">
        <i class="fas fa-shopping-cart"></i>
        Buying
    </button>
    <button class="tab" data-tab="selling">
        <i class="fas fa-hand-holding-usd"></i>
        Selling
    </button>
    <button class="tab" data-tab="history">
        <i class="fas fa-history"></i>
        History
    </button>
</div>
```

#### 2. Responsive Tab Positioning

**Current Issue:** Tabs are positioned in the middle of the interface on smaller screens.

**Solution:** Implement responsive CSS that moves tabs to the top on smaller viewports:

```css
@media (max-width: 768px) {
    .app-content {
        grid-template-columns: 1fr;
        grid-template-rows: auto 1fr;
    }
    
    .sidebar {
        order: 1;
        border-right: none;
        border-bottom: 1px solid var(--border-light);
    }
    
    .main-panel {
        order: 2;
    }
    
    .tabs {
        position: sticky;
        top: 0;
        z-index: 10;
        background: var(--bg-secondary);
        border-bottom: 1px solid var(--border-light);
        margin-bottom: 0;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        transition: box-shadow 0.2s ease;
    }
    
    .tabs.sticky {
        box-shadow: var(--shadow-md);
    }
}
```

#### 3. Quick Actions Integration

**Current Structure:**
```html
<!-- Remove this entire section -->
<div class="section">
    <h2 class="section-title">Quick Actions</h2>
    <div class="action-buttons">
        <button id="check-availability">Check Availability</button>
        <button id="quick-sell">Quick Sell</button>
        <button id="haggle">Negotiate</button>
        <button id="desperate-sale">Desperate Sale</button>
    </div>
</div>
```

**New Integration:**
- Move "Check Availability" to Buying tab
- Remove "Quick Sell" entirely
- Move "Negotiate" to both Buying and Selling tabs contextually
- Move "Desperate Sale" to Selling tab only

## Components and Interfaces

### Buying Tab Design

#### Layout Structure
```html
<div class="tab-content active" id="buying-tab">
    <!-- Check Availability Section -->
    <div class="availability-section">
        <button class="btn btn-primary" id="check-availability">
            <i class="fas fa-search"></i>
            Check Availability
        </button>
        <div class="availability-results" id="availability-results" style="display: none;">
            <!-- Results populated by algorithm -->
        </div>
    </div>
    
    <!-- Settlement Info Display -->
    <div class="settlement-display">
        <!-- Settlement details with Size Rating and Wealth Rating highlighted -->
    </div>
    
    <!-- Available Cargo Grid -->
    <div class="cargo-grid" id="buying-cargo-grid">
        <!-- Cargo cards populated after availability check -->
    </div>
</div>
```

#### Algorithm Integration
Based on `official-algorithm.md`, the buying process follows these steps:

1. **Step 0: Settlement Information**
   - Display Size Rating and Wealth Rating prominently
   - Show settlement production data

2. **Step 1: Availability Check**
   - Calculate: `(Size Rating + Wealth Rating) × 10%`
   - Roll 1d100 and compare
   - Log all calculations to console

3. **Step 2: Cargo Determination**
   - **Type**: Based on settlement's "Produces" field
   - **Quantity**: `(Size Rating + Wealth Rating) × (1d100 rounded up to nearest 10)`

#### Console Logging Pattern with Debug Mode
```javascript
// Debug mode toggle
let debugMode = true; // Can be controlled by UI toggle

function debugLog(...args) {
    if (debugMode) {
        console.log(...args);
    }
}

function checkAvailability(settlement) {
    debugLog('=== WFRP Buying Algorithm - Availability Check ===');
    debugLog('Settlement:', settlement.name, '(', settlement.region, ')');
    
    const sizeRating = calculateSizeRating(settlement.size);
    const wealthRating = settlement.wealth;
    
    debugLog('Size:', settlement.size, '→ Rating:', sizeRating);
    debugLog('Wealth Rating:', wealthRating);
    
    const baseChance = (sizeRating + wealthRating) * 10;
    debugLog('Availability Formula: (Size + Wealth) × 10 = (', sizeRating, '+', wealthRating, ') × 10 =', baseChance, '%');
    
    const roll = Math.floor(Math.random() * 100) + 1;
    const available = roll <= baseChance;
    
    debugLog('Rolling d100 for availability...');
    debugLog('Roll Result:', roll, '/', baseChance, '=', available ? 'SUCCESS' : 'FAILURE');
    debugLog('Reason:', available ? 'Roll ≤ target' : 'Roll > target');
    
    if (available) {
        debugLog('=== Cargo Available - Determining Type and Quantity ===');
        // Continue with Step 2...
    }
}

// Debug mode toggle UI
function addDebugToggle() {
    const debugToggle = document.createElement('div');
    debugToggle.className = 'debug-toggle';
    debugToggle.innerHTML = `
        <label>
            <input type="checkbox" id="debug-mode" ${debugMode ? 'checked' : ''}>
            Debug Logging
        </label>
    `;
    
    document.querySelector('.app-header').appendChild(debugToggle);
    
    document.getElementById('debug-mode').addEventListener('change', function() {
        debugMode = this.checked;
        debugLog('Debug mode', debugMode ? 'enabled' : 'disabled');
    });
}
```

### Selling Tab Design

#### Layout Structure
```html
<div class="tab-content" id="selling-tab">
    <!-- Resource Selection -->
    <div class="resource-selection">
        <h3>Select Resource to Sell</h3>
        <div class="resource-buttons" id="resource-buttons">
            <!-- Buttons populated from settlement source data -->
        </div>
    </div>
    
    <!-- Selling Interface -->
    <div class="selling-interface" id="selling-interface" style="display: none;">
        <div class="quantity-section">
            <label>Quantity (EP):</label>
            <input type="number" id="sell-quantity" min="1" class="form-input">
        </div>
        
        <button class="btn btn-primary" id="look-for-sellers">
            <i class="fas fa-search"></i>
            Look for Sellers
        </button>
        
        <button class="btn" id="negotiate-sell" style="display: none;">
            <i class="fas fa-handshake"></i>
            Negotiate
        </button>
        
        <button class="btn btn-warning" id="desperate-sale" style="display: none;">
            <i class="fas fa-exclamation-triangle"></i>
            Desperate Sale
        </button>
    </div>
    
    <!-- Selling Results -->
    <div class="selling-results" id="selling-results" style="display: none;">
        <!-- Results populated by selling algorithm -->
    </div>
</div>
```

#### Resource Button Generation
```javascript
function populateResourceButtons(settlement) {
    const resourceButtons = document.getElementById('resource-buttons');
    resourceButtons.innerHTML = '';
    
    if (!settlement || !settlement.source) {
        console.log('No settlement selected or no source data available');
        return;
    }
    
    console.log('Settlement source data:', settlement.source);
    
    // Filter out "Trade" as it's a modifier, not a sellable resource
    const sellableResources = settlement.source.filter(resource => resource !== 'Trade');
    
    console.log('Sellable resources in', settlement.name + ':', sellableResources);
    
    sellableResources.forEach(resource => {
        const button = document.createElement('button');
        button.className = 'btn resource-btn';
        button.textContent = resource;
        button.onclick = () => selectResource(resource);
        resourceButtons.appendChild(button);
    });
    
    // Check if settlement has Trade bonus
    const hasTradeBonus = settlement.source.includes('Trade');
    if (hasTradeBonus) {
        console.log('Settlement has Trade bonus: +30% to buyer availability');
    }
}
```

#### Selling Algorithm Integration
Based on `SELLING_ALGORITHM_IMPLEMENTATION.md`:

```javascript
function lookForSellers(settlement, cargoType, quantity) {
    console.log('=== WFRP Selling Algorithm - Buyer Search ===');
    console.log('Settlement:', settlement.name);
    console.log('Cargo Type:', cargoType);
    console.log('Quantity:', quantity, 'EP');
    
    // Step 2: Calculate buyer availability
    const sizeRating = calculateSizeRating(settlement.size);
    let buyerChance = sizeRating * 10;
    
    console.log('Size Rating:', sizeRating);
    console.log('Base Buyer Chance: Size × 10 =', sizeRating, '× 10 =', buyerChance, '%');
    
    // Check for Trade bonus
    if (settlement.source && settlement.source.includes('Trade')) {
        buyerChance += 30;
        console.log('Trade Settlement Bonus: +30%');
        console.log('Total Buyer Chance:', buyerChance, '%');
    }
    
    const buyerRoll = Math.floor(Math.random() * 100) + 1;
    const buyerFound = buyerRoll <= buyerChance;
    
    console.log('Rolling d100 for buyer availability...');
    console.log('Roll Result:', buyerRoll, '/', buyerChance, '=', buyerFound ? 'BUYER FOUND' : 'NO BUYER');
    
    if (buyerFound) {
        console.log('=== Calculating Offer Price ===');
        calculateOfferPrice(settlement, cargoType, quantity);
    } else {
        console.log('No buyer found. Consider desperate sale or try elsewhere.');
    }
}
```

### History Tab Design

#### Data Persistence Strategy
**Requirement:** Store in FoundryVTT world, not browser storage.

```javascript
// Data structure for world storage
const TRADING_HISTORY_KEY = 'trading-places.history';

function saveTransaction(transaction) {
    console.log('Saving transaction to world data:', transaction);
    
    // Get existing history from world
    let history = game.settings.get('trading-places', 'transaction-history') || [];
    
    // Add new transaction
    const newTransaction = {
        id: foundry.utils.randomID(),
        timestamp: new Date().toISOString(),
        type: transaction.type, // 'buy' or 'sell'
        cargoType: transaction.cargoType,
        quantity: transaction.quantity,
        price: transaction.price,
        settlement: transaction.settlement,
        season: transaction.season,
        ...transaction
    };
    
    history.unshift(newTransaction); // Add to beginning
    
    // Limit history size (optional)
    if (history.length > 1000) {
        history = history.slice(0, 1000);
    }
    
    // Save to world
    game.settings.set('trading-places', 'transaction-history', history);
    
    console.log('Transaction saved. Total history entries:', history.length);
    
    // Update UI
    renderHistoryTab();
}

function loadTransactionHistory() {
    console.log('Loading transaction history from world data...');
    
    const history = game.settings.get('trading-places', 'transaction-history') || [];
    
    console.log('Loaded', history.length, 'transactions from world data');
    
    return history;
}
```

#### History Display
```html
<div class="tab-content" id="history-tab">
    <div class="history-controls">
        <button class="btn" id="export-history">
            <i class="fas fa-download"></i>
            Export History
        </button>
        <button class="btn btn-warning" id="clear-history">
            <i class="fas fa-trash"></i>
            Clear History
        </button>
    </div>
    
    <div class="transaction-list" id="transaction-list">
        <!-- Transactions populated from world data -->
    </div>
</div>
```

## Data Models

### Settlement Data Structure
```javascript
{
    region: "Reikland",
    name: "ALTDORF",
    size: "CS",           // CS=4, C=3, T=2, ST/V/F/M=1
    ruler: "Emperor Karl-Franz I",
    population: 105000,
    wealth: 5,            // 1-5 rating
    source: ["Trade", "Government"], // "Trade" provides selling bonus
    garrison: ["500a/8000c"],
    notes: "Imperial Capital..."
}
```

### Size Rating Calculation
```javascript
function calculateSizeRating(sizeCode) {
    const sizeRatings = {
        'CS': 4,  // City State / Metropolis
        'C': 3,   // City
        'T': 2,   // Town
        'ST': 1,  // Small Town
        'V': 1,   // Village
        'F': 1,   // Fort
        'M': 1    // Manor
    };
    
    return sizeRatings[sizeCode] || 1;
}
```

### Transaction Data Structure
```javascript
{
    id: "randomID",
    timestamp: "2025-01-15T10:30:00.000Z",
    type: "buy", // or "sell"
    cargoType: "Grain",
    quantity: 150,
    price: 240, // Total price in GC
    pricePerEP: 1.6, // GC per EP
    settlement: "Altdorf",
    region: "Reikland",
    season: "Summer",
    haggleResult: {
        attempted: true,
        successful: true,
        modifier: 10 // percentage
    },
    algorithm: {
        availabilityRoll: 45,
        availabilityTarget: 90,
        sizeRating: 4,
        wealthRating: 5
    }
}
```

## Error Handling

### Graceful Degradation
- If settlement data is missing, disable trading actions with clear messaging
- If algorithms fail, log detailed error information and provide fallback options
- If world data access fails, show error message and suggest refresh

### Enhanced Validation
```javascript
function validateSettlement(settlement) {
    if (!settlement) {
        console.error('No settlement selected');
        return { valid: false, error: 'No settlement selected' };
    }
    
    const requiredProperties = ['name', 'size', 'wealth', 'region'];
    const missingProperties = requiredProperties.filter(prop => !settlement[prop]);
    
    if (missingProperties.length > 0) {
        console.error('Settlement missing required properties:', missingProperties, settlement);
        return { 
            valid: false, 
            error: `Settlement missing required data: ${missingProperties.join(', ')}` 
        };
    }
    
    // Validate size rating
    const sizeRating = calculateSizeRating(settlement.size);
    if (sizeRating === undefined) {
        console.error('Invalid settlement size code:', settlement.size);
        return { 
            valid: false, 
            error: `Invalid settlement size: ${settlement.size}` 
        };
    }
    
    // Validate wealth rating
    if (settlement.wealth < 1 || settlement.wealth > 5) {
        console.error('Invalid wealth rating:', settlement.wealth);
        return { 
            valid: false, 
            error: `Invalid wealth rating: ${settlement.wealth} (must be 1-5)` 
        };
    }
    
    return { valid: true };
}

function validateTradeAction(cargoType, quantity) {
    if (!cargoType || cargoType.trim() === '') {
        console.error('No cargo type specified');
        return false;
    }
    
    if (!quantity || quantity <= 0) {
        console.error('Invalid quantity:', quantity);
        return false;
    }
    
    return true;
}
```

## Testing Strategy

### Manual Testing Checklist
1. **Tab Functionality**
   - [ ] Tabs switch correctly between Buying, Selling, History
   - [ ] Tab positioning adapts on smaller screens
   - [ ] Content shows/hides appropriately

2. **Buying Workflow**
   - [ ] Check Availability button triggers algorithm
   - [ ] Console logs show detailed calculations
   - [ ] Settlement info displays Size and Wealth ratings
   - [ ] Cargo appears after successful availability check

3. **Selling Workflow**
   - [ ] Resource buttons populate from settlement data
   - [ ] "Trade" is excluded from sellable resources
   - [ ] Quantity input and seller search work correctly
   - [ ] Algorithm logs all calculation steps

4. **History Persistence**
   - [ ] Transactions save to world data
   - [ ] History persists across browser sessions
   - [ ] History loads correctly on startup

5. **Responsive Design**
   - [ ] Layout adapts to different screen sizes
   - [ ] Tabs move to top on mobile
   - [ ] All functionality remains accessible

### Algorithm Validation
- Verify availability calculations match official formulas
- Test edge cases (villages, trade settlements)
- Confirm all dice rolls and modifiers are logged
- Validate price calculations with seasonal modifiers

## Implementation Notes

### CSS Modifications Required
1. Remove Quick Actions section styles
2. Add responsive tab positioning
3. Update tab content for new structure
4. Add resource button styling
5. Enhance settlement info display

### JavaScript Modifications Required
1. Remove Quick Actions event handlers
2. Implement buying algorithm with logging
3. Implement selling algorithm with logging
4. Add resource button generation
5. Implement world data persistence
6. Update tab switching logic

### File Structure
```
tmp_rovodev_new_unified_trading_ui.html
├── CSS Sections to Modify:
│   ├── Remove: .action-buttons, Quick Actions styles
│   ├── Add: .resource-buttons, .availability-section
│   ├── Update: @media queries for responsive tabs
│   └── Enhance: .settlement-info for algorithm data
└── JavaScript Sections to Modify:
    ├── Remove: Quick Actions handlers
    ├── Add: Algorithm implementations
    ├── Add: World data persistence
    └── Update: Tab switching and content management
```

This design provides a clear roadmap for refining the HTML mockup to meet all requirements while maintaining the existing visual design and improving the user experience.