# Design Document

## Overview

This design document outlines the complete redesign of the Trading Places FoundryVTT module interface. The new implementation will use FoundryVTT's V2 Application framework, provide native UI integration, and implement the official WFRP trading algorithms from `official-algorithm.md`.

## Architecture

### Application Framework Migration

**Current Problem:** The existing implementation uses the deprecated Dialog class, causing deprecation warnings and future compatibility issues.

**Solution:** Migrate to FoundryVTT's ApplicationV2 framework with proper class structure:

```javascript
class WFRPTradingApplication extends foundry.applications.api.ApplicationV2 {
    static DEFAULT_OPTIONS = {
        id: "wfrp-trading",
        tag: "div",
        window: {
            title: "Trading Places",
            icon: "fas fa-coins",
            resizable: true,
            minimizable: true
        },
        position: {
            width: 1200,
            height: 800
        }
    };
    
    static PARTS = {
        header: { template: "modules/trading-places/templates/trading-header.hbs" },
        content: { template: "modules/trading-places/templates/trading-content.hbs" },
        footer: { template: "modules/trading-places/templates/trading-footer.hbs" }
    };
}
```

### Native UI Integration

**Current Problem:** Floating button overlay that doesn't follow FoundryVTT conventions.

**Solution:** Integrate through multiple native access points:

1. **Scene Controls Integration:**
   ```javascript
   Hooks.on('getSceneControlButtons', (controls) => {
       controls.push({
           name: 'trading',
           title: 'WFRP Trading',
           icon: 'fas fa-coins',
           layer: 'TradingLayer',
           tools: [{
               name: 'open-trading',
               title: 'Open Trading Interface',
               icon: 'fas fa-store',
               onClick: () => new WFRPTradingApplication().render(true)
           }]
       });
   });
   ```

2. **Sidebar Integration:**
   ```javascript
   Hooks.on('renderSidebar', (app, html) => {
       // Add trading tab to sidebar
   });
   ```

3. **Hotbar Macro Support:**
   ```javascript
   // Provide macro command for easy hotbar access
   game.wfrpTrading = {
       openTrading: () => new WFRPTradingApplication().render(true)
   };
   ```

## Components and Interfaces

### Main Application Structure

```
WFRPTradingApplication
├── Header Section
│   ├── Season Selector
│   └── Current Settlement Display
├── Content Section
│   ├── Settlement Selection Panel
│   │   ├── Region Dropdown
│   │   ├── Settlement Dropdown
│   │   └── Settlement Details Display
│   ├── Trading Operations Panel
│   │   ├── Buying Interface
│   │   ├── Selling Interface
│   │   └── Price Calculator
│   └── Player Cargo Management Panel
│       ├── Cargo Inventory List
│       ├── Add Cargo Form
│       └── Cargo Actions
└── Footer Section
    ├── Debug Log Display
    ├── Transaction History
    └── Action Buttons
```

### Settlement Selection Component

**Design Pattern:** Progressive disclosure with dependent dropdowns

```javascript
class SettlementSelector {
    constructor(dataManager) {
        this.dataManager = dataManager;
        this.selectedRegion = null;
        this.selectedSettlement = null;
    }
    
    async renderRegionSelector() {
        const regions = this.dataManager.getAllRegions();
        console.log('Available regions:', regions);
        // Render region dropdown
    }
    
    async onRegionChange(regionName) {
        console.log('Region selected:', regionName);
        this.selectedRegion = regionName;
        const settlements = this.dataManager.getSettlementsByRegion(regionName);
        console.log('Settlements in region:', settlements.length);
        await this.renderSettlementSelector(settlements);
    }
    
    async onSettlementChange(settlementName) {
        console.log('Settlement selected:', settlementName);
        this.selectedSettlement = this.dataManager.getSettlement(settlementName);
        console.log('Settlement data:', this.selectedSettlement);
        await this.displaySettlementDetails();
    }
}
```

### Trading Algorithm Implementation

**Buying Algorithm (from official-algorithm.md):**

```javascript
class BuyingAlgorithm {
    constructor(tradingEngine) {
        this.tradingEngine = tradingEngine;
    }
    
    async checkCargoAvailability(settlement) {
        console.log('=== WFRP Buying Algorithm - Step 1: Availability Check ===');
        
        // Step 0: Settlement Information
        const sizeRating = this.calculateSizeRating(settlement.size);
        const wealthRating = settlement.wealth;
        console.log(`Settlement: ${settlement.name}`);
        console.log(`Size: ${settlement.size} (Rating: ${sizeRating})`);
        console.log(`Wealth: ${wealthRating}`);
        
        // Step 1: Availability Check
        const baseChance = (sizeRating + wealthRating) * 10;
        const roll = Math.floor(Math.random() * 100) + 1;
        const available = roll <= baseChance;
        
        console.log(`Availability Calculation: (${sizeRating} + ${wealthRating}) × 10 = ${baseChance}%`);
        console.log(`Availability Roll: ${roll} ${available ? '≤' : '>'} ${baseChance} = ${available ? 'SUCCESS' : 'FAILURE'}`);
        
        if (!available) {
            return { available: false, roll, baseChance };
        }
        
        // Step 2: Determine Cargo Type and Size
        const cargoType = this.determineCargoType(settlement);
        const cargoSize = this.calculateCargoSize(settlement);
        const basePrice = this.calculateBasePrice(cargoType, this.tradingEngine.getCurrentSeason());
        
        console.log('=== WFRP Buying Algorithm - Step 2: Cargo Determination ===');
        console.log(`Cargo Type: ${cargoType}`);
        console.log(`Cargo Size: ${cargoSize} EP`);
        console.log(`Base Price: ${basePrice} GC per 10 EP`);
        
        return {
            available: true,
            roll,
            baseChance,
            cargoType,
            cargoSize,
            basePrice
        };
    }
    
    determineCargoType(settlement) {
        console.log('Determining cargo type from settlement production:', settlement.source);
        
        if (Array.isArray(settlement.source)) {
            if (settlement.source.includes('Trade') && settlement.source.length > 1) {
                // Trade center with specific goods
                const nonTradeGoods = settlement.source.filter(s => s !== 'Trade');
                const selectedGood = nonTradeGoods[Math.floor(Math.random() * nonTradeGoods.length)];
                console.log('Trade center with specific goods, selected:', selectedGood);
                return selectedGood;
            } else if (settlement.source.includes('Trade')) {
                // Pure trade center - random cargo from table
                const randomCargo = this.tradingEngine.getRandomCargoFromTable();
                console.log('Pure trade center, random cargo:', randomCargo);
                return randomCargo;
            } else {
                // Specific production
                const localGood = settlement.source[0];
                console.log('Local production:', localGood);
                return localGood;
            }
        }
        
        console.log('Fallback to default cargo');
        return 'Grain';
    }
    
    calculateCargoSize(settlement) {
        const sizeRating = this.calculateSizeRating(settlement.size);
        const wealthRating = settlement.wealth;
        const baseValue = sizeRating + wealthRating;
        
        const sizeRoll = Math.floor(Math.random() * 100) + 1;
        const roundedRoll = Math.ceil(sizeRoll / 10) * 10; // Round up to nearest 10
        const totalSize = baseValue * roundedRoll;
        
        console.log(`Cargo Size Calculation:`);
        console.log(`- Base Value: ${sizeRating} + ${wealthRating} = ${baseValue}`);
        console.log(`- Size Roll: ${sizeRoll} → Rounded: ${roundedRoll}`);
        console.log(`- Total Size: ${baseValue} × ${roundedRoll} = ${totalSize} EP`);
        
        return totalSize;
    }
}
```

**Selling Algorithm (from official-algorithm.md):**

```javascript
class SellingAlgorithm {
    constructor(tradingEngine) {
        this.tradingEngine = tradingEngine;
    }
    
    async findBuyer(settlement, cargoType, quantity) {
        console.log('=== WFRP Selling Algorithm - Buyer Search ===');
        
        // Step 1: Check selling eligibility
        if (!this.canSellAtSettlement(settlement, cargoType)) {
            console.log('Cannot sell at this settlement (restriction rules)');
            return { canSell: false, reason: 'restriction' };
        }
        
        // Step 2: Calculate buyer availability
        const sizeRating = this.calculateSizeRating(settlement.size);
        let buyerChance = sizeRating * 10;
        
        if (settlement.source && settlement.source.includes('Trade')) {
            buyerChance += 30;
            console.log('Trade settlement bonus: +30%');
        }
        
        const buyerRoll = Math.floor(Math.random() * 100) + 1;
        const buyerFound = buyerRoll <= buyerChance;
        
        console.log(`Buyer Availability: ${sizeRating} × 10 ${settlement.source?.includes('Trade') ? '+ 30' : ''} = ${buyerChance}%`);
        console.log(`Buyer Roll: ${buyerRoll} ${buyerFound ? '≤' : '>'} ${buyerChance} = ${buyerFound ? 'BUYER FOUND' : 'NO BUYER'}`);
        
        if (!buyerFound) {
            return { canSell: false, reason: 'no_buyer', roll: buyerRoll, chance: buyerChance };
        }
        
        // Step 3: Calculate offer price
        const offerPrice = this.calculateOfferPrice(cargoType, settlement);
        
        return {
            canSell: true,
            buyerFound: true,
            roll: buyerRoll,
            chance: buyerChance,
            offerPrice
        };
    }
    
    calculateOfferPrice(cargoType, settlement) {
        const basePrice = this.tradingEngine.getBasePrice(cargoType);
        const wealthModifier = this.getWealthModifier(settlement.wealth);
        const finalPrice = Math.floor(basePrice * wealthModifier);
        
        console.log('=== Offer Price Calculation ===');
        console.log(`Base Price: ${basePrice} GC`);
        console.log(`Wealth Rating: ${settlement.wealth} (Modifier: ${wealthModifier}x)`);
        console.log(`Final Offer: ${basePrice} × ${wealthModifier} = ${finalPrice} GC`);
        
        return finalPrice;
    }
    
    getWealthModifier(wealthRating) {
        const modifiers = {
            0: 0.5,  // Squalid: 50%
            1: 0.8,  // Poor: -20%
            2: 1.0,  // Average: Base price
            3: 1.05, // Bustling: +5%
            4: 1.1   // Prosperous: +10%
        };
        return modifiers[wealthRating] || 1.0;
    }
}
```

### Player Cargo Management

**Design Pattern:** CRUD interface with session persistence

```javascript
class PlayerCargoManager {
    constructor() {
        this.playerCargo = [];
    }
    
    addCargo(cargoType, quantity, quality = 'average') {
        console.log(`Adding cargo: ${quantity} EP of ${cargoType} (${quality})`);
        
        const existingCargo = this.playerCargo.find(c => 
            c.type === cargoType && c.quality === quality
        );
        
        if (existingCargo) {
            existingCargo.quantity += quantity;
            console.log(`Updated existing cargo to ${existingCargo.quantity} EP`);
        } else {
            this.playerCargo.push({
                type: cargoType,
                quantity,
                quality,
                id: foundry.utils.randomID()
            });
            console.log('Added new cargo entry');
        }
        
        this.renderCargoList();
    }
    
    removeCargo(cargoId, quantity) {
        const cargo = this.playerCargo.find(c => c.id === cargoId);
        if (!cargo) return;
        
        console.log(`Removing ${quantity} EP of ${cargo.type}`);
        cargo.quantity -= quantity;
        
        if (cargo.quantity <= 0) {
            this.playerCargo = this.playerCargo.filter(c => c.id !== cargoId);
            console.log('Cargo completely removed');
        }
        
        this.renderCargoList();
    }
    
    renderCargoList() {
        console.log('Current player cargo:', this.playerCargo);
        // Update UI display
    }
}
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
    source: ["Trade", "Government"],
    garrison: ["500a/8000c"],
    notes: "Imperial Capital..."
}
```

### Cargo Data Structure
```javascript
{
    id: "randomID",
    type: "Grain",
    quantity: 150,        // In Encumbrance Points
    quality: "average",   // poor, average, good, excellent
    purchaseLocation: "Altdorf",
    purchaseDate: "2025-01-15",
    basePrice: 2          // GC per 10 EP
}
```

## Error Handling

### Graceful Degradation
- If settlement data fails to load, show error message with retry option
- If trading algorithms fail, log detailed error information
- If UI components fail to render, provide fallback interfaces

### Debug Logging Strategy

**Comprehensive Logging Requirements:**
- Every dice roll with formula, modifiers, and results
- Every calculation step with input values and formulas
- Every decision point with reasoning and data used
- Every user action with context and consequences
- Every data access with source and transformation
- Every algorithm step with official rule references

**Example Logging Pattern:**
```javascript
console.log('=== WFRP Cargo Availability Check ===');
console.log('Settlement:', settlement.name, '(', settlement.region, ')');
console.log('Size:', settlement.size, '→ Rating:', sizeRating);
console.log('Wealth:', settlement.wealth);
console.log('Formula: (Size + Wealth) × 10 = (', sizeRating, '+', wealthRating, ') × 10 =', baseChance, '%');
console.log('Rolling d100 for availability...');
console.log('Roll Result:', roll, '/', baseChance, '=', available ? 'SUCCESS' : 'FAILURE');
console.log('Reason:', available ? 'Roll ≤ target' : 'Roll > target');
```

## Testing Strategy

### Unit Testing
- Test all trading algorithm calculations
- Test settlement data access methods
- Test cargo management operations
- Test price calculation functions

### Integration Testing
- Test complete buying workflow
- Test complete selling workflow
- Test UI component interactions
- Test data persistence

### User Acceptance Testing
- Verify native FoundryVTT integration
- Verify no deprecation warnings
- Verify proper window resizing
- Verify accurate WFRP rule implementation