# Trading Procedure Master Document

This document combines the cargo availability generation procedure with comprehensive pricing mechanics, encumbrance calculations, and trading formulas. All steps follow the config-driven approach where formulas and values must be sourced from `datasets/active/trading-config.json`, `cargo-types.json`, and related configuration files.

## Encumbrance Points (EP) Foundation

Encumbrance Points (EP) are the fundamental unit for measuring cargo bulk and weight, directly impacting trade and vessel management. All cargo is measured in EP, with standard trading occurring in multiples of 10 EP. Vehicle modifications increase vehicle encumbrance, which reduces carries capacity on a 1:1 basis.

## Step 1: Initialize Pipeline
- Load the trading configuration from `datasets/active/trading-config.json`
- Validate settlement data from `datasets/active/settlements/` and load cargo types from `datasets/active/cargo-types.json`
- Build settlement context (name, size, wealth, production categories, source flags from `datasets/source-flags.json`, etc.)
- Initialize seasonal pricing data based on current season

## Step 2: Calculate Merchant Slots
- Determine base merchant slots based on settlement size:
  - Hamlet = 1 slot
  - Village = 2 slots
  - Town = 3 slots
  - City = 4 slots
  - Metropolis = 5 slots
- Apply population multiplier (0.0001 × population)
- Apply size multiplier (1.5 × settlement size rating)
- Apply flag multipliers from `datasets/source-flags.json` (e.g., Trade settlements get ×1.5)
- Cap at hard limit (10 merchants max)
- Round to get final producer slots
- **All multipliers and caps must be in `datasets/active/trading-config.json`**

## Step 3: Build Cargo Candidate Table
- For each cargo type from `datasets/active/cargo-types.json`, calculate selection weight based on merchant type:
  - **For Producers** (selling to players): +12 if settlement produces this cargo
  - **For Seekers** (buying from players): +10 if settlement demands this cargo
  - **Flag influences**: Sum transfer values from `datasets/source-flags.json` and multiply by 10
    - Add supplyTransfer + categorySupplyTransfer for producers
    - Add demandTransfer + categoryDemandTransfer for seekers
  - Seasonal adjustments from `datasets/active/cargo-types.json`
- Convert weights to probabilities
- **All weights and adjustments must be in `datasets/active/trading-config.json`**

## Step 4: Process Each Merchant Slot
For each available merchant slot:

### 4a: Select Cargo Type
- Weighted random selection from candidate table
- Returns cargo name, category, selection probability, reason it was selected and all other possible candidates and their probabilities
- **Cargo types taken from `datasets/active/cargo-types.json`**

### 4b: Calculate Supply/Demand Balance
- Start with baseline supply/demand (100 each)
- Apply production shift (+50% supply if settlement produces this cargo)
- Apply demand shift (+35% demand if settlement demands this cargo)
- Apply flag transfers (supply/demand shifts from settlement flags in `datasets/source-flags.json`)
- Apply seasonal shifts (e.g., agriculture +20% in spring from `datasets/active/cargo-types.json`)
- Apply wealth modifiers (-10% to +10% based on settlement wealth)
- Classify balance state: blocked, desperate, glut, scarce, or balanced
- **All percentages and formulas must be in `datasets/active/trading-config.json`**

### 4c: Roll Cargo Amount (EP)
- Roll percentile die (1-100)
- Calculate base EP: ceil(roll/10) × 10 × settlement size
- Apply supply modifier: max(0.5, supply/demand ratio)
- **All formulas must be in `datasets/active/trading-config.json`**
- **Note**: Merchants typically will not sell quantities less than 10 EP

### 4d: Evaluate Quality
- Base score = settlement wealth rating
- Add flag quality bonuses
- Add market pressure bonus/penalty
- Convert score to tier: Poor/Common/Average/High/Exceptional
- **Quality tier mappings and bonuses must be in `datasets/active/trading-config.json`**

### 4e: Check Contraband
- Base chance 5% + flag bonuses + size bonuses
- Roll percentile vs chance
- **All chances and bonuses must be in `datasets/active/trading-config.json`**

### 4f: Generate Merchant
- Calculate haggling skill using piecewise distribution from `datasets/active/trading-config.json`
- Merchant is represented by this skill number (higher = better negotiator)
- **All skill generation parameters must be in `datasets/active/trading-config.json`**

### 4g: Calculate Pricing
- Get seasonal base price for cargo from pricing tables
- Apply quality multiplier (0.85-1.25 based on tier)
- Apply contraband discount (×0.85 if contraband)
- Apply desperation penalties if applicable
- Calculate total value
- **All multipliers and formulas must be in `datasets/active/trading-config.json`**

## Step 5: Return Results
- Settlement context and slot plan
- Candidate table with probabilities
- Array of slot results (one per merchant)
- Each slot includes: cargo, balance, amount (EP), quality, contraband status, merchant details, and pricing

## Cargo Categories and Base Pricing Structure

All prices are quoted in Gold Crowns (GC) per **10 Encumbrance Points (EP)** unless otherwise noted:

| Cargo Type | Category/Description | Base Price Range (GC/10 EP) | Seasonal Notes | Production Bonus |
|------------|---------------------|-----------------------------|---------------|------------------|
| **Grain** | Agricultural products (barley, wheat, legumes, dried meats, fish) | 0.25 to 1.0 | Lowest in Autumn (0.25 GC), highest in Spring (1.0 GC) | None |
| **Armaments** | Weapons and armour (hand weapons, leather armour, bolts) | 8 to 12 | Highest in Spring (12 GC) | +10% if Metalworking |
| **Luxuries** | Textiles, pottery, glass, spices, silks, Mithril, Bugman's ale | 50 | Stable year-round | None |
| **Metal** | Ore or ingots (copper, iron, steel) | 8 | Stable year-round | +10% if Metalworking |
| **Timber** | Building materials | 1.5 to 3.5 | Lowest in Summer (1.5 GC), highest in Winter (3.5 GC) | None |
| **Wool** | Component for clothing | 1.0 to 3.0 | Lowest in Spring (1.0 GC) | None |

### Special Case: Wine and Brandy Quality Pricing
Wine and brandy prices vary by quality (d10 roll) and are priced per "1 cargo" unit, not per 10 EP:

| Quality | Price per Cargo Unit | Notes |
|---------|---------------------|-------|
| Swill (1) | 0.5 GC | |
| Passable (2-3) | 1.0 GC | |
| Average (4-5) | 1.5 GC | |
| Good (6-7) | 3.0 GC | |
| Excellent (8-9) | 6.0 GC | |
| Top Shelf (10) | 12.0 GC | Always finds buyer for at least d10 EP |

## Specific Cargo Types and Containers

### Bulk Trade Categories with Examples
- **Grain**: Barley, wheat, legumes, root vegetables, dried meats, fish
- **Armaments**: Hand weapons, leather armour, bolts (exotic items like cannon require specialized barges)
- **Luxuries**: Textiles, pottery, glass, bricks, spices, silks, Mithril, Bugman's ale
- **Metal**: Valuable ore or purified ingots of copper, iron, steel
- **Timber**: Building materials from Empire forests
- **Wine/Brandy**: Various qualities with variable pricing
- **Wool**: Prime component of clothing (sacks = 3 EP each)

### Specialized and Contraband Cargo
- **Bretonnian brandy**: Illegal import, common contraband
- **Magical Supplies**: Often illegal, moved by smugglers
- **Sleeping Passengers**: Smuggler term for dead bodies
- **Warpstone dust**: Powdered warpstone in vials, highly illegal
- **Perfumes**: Carried in vials
- **Books/Grimoires**: Arcane or forbidden texts
- **Honey**: May cause corruption from warpstone
- **Assorted Herbs**: 20+ specific herbs (Agurk, Valerian, etc.), 0 EP when prepared

### Known Container EP Values
- **Sack of Wool**: 3 EP per sack
- **Prepared Herbs**: 0 EP
- **Heavy Objects (River Debris)**: 4d10 EP per object

## Detailed Price Calculation Formulas

### Buying Price Calculation
1. **Determine Cargo Size (EP)**: `(Settlement Size Rating + Settlement Wealth Rating) × (1d100 rounded up to the nearest 10)`
   - No special trading centre modifiers

2. **Find Base Price**: Consult seasonal base price table for cargo type (GC/10 EP)

3. **Calculate Total Base Price**: `(Total EP / 10) × Base Price`

4. **Apply Buying Modifiers**:
   - Metalworking bonus: +10% for Armaments/Metal if settlement produces metalworking
   - Wine/Brandy: Use quality table instead of base price
   - Partial purchase: +10% surcharge if buying less than full cargo

5. **Haggling**: Opposed Haggle test modifies price by 10% (20% with Dealmaker talent)

### Selling Price Calculation
1. **Find Buyer Chance**: `(Settlement Size Rating × 10) + 30 if Trade in Produces`
   - Villages: Usually no demand except Grain in Spring
   - Top Shelf wine/brandy: Always finds buyer for at least d10 EP

2. **Determine Offer Price**: Apply wealth modifier to base price:
   - Squalid: 50% of base price
   - Poor: Base price - 20%
   - Average: Base price
   - Bustling: Base price + 5%
   - Prosperous: Base price + 10%

3. **Haggling**: Opposed test increases offer by 10% (20% with Dealmaker)

### Special Selling Cases
- Trade rumors: Sell for 2× base price
- Quick sale at Trade settlements: 50% of base price

## Vessel Capacity and Modifications
- **Vehicle Encumbrance**: Weight added by modifications (e.g., Steam Engine = 200 EP, Ram = 30-120 EP)
- **Carries Capacity**: Available cargo space
- **Key Rule**: For every point of added vehicle encumbrance, lose 1 point of carries capacity
- Heavy modifications reduce profitable cargo space (e.g., steam engine consumes ~50% of a boat's capacity)