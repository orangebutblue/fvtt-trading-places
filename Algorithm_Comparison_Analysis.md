# WFRP 4E River Trading: Official vs. Script Algorithm Comparison

## Executive Summary

The river trading scripts **partially implement** the official WFRP 4E trading rules but with significant simplifications and deviations. The scripts focus on user convenience over strict rule adherence.

---

## Detailed Comparison

### **1. Cargo Availability (Buying Algorithm)**

#### Official Algorithm:
- **Step 0**: Settlement stats (Size 1-4, Wealth 1-4, Produces list)
- **Step 1**: Availability check via (Size + Wealth) × 10% chance on 1d100
- **Step 2A**: Cargo type based on "Produces" field or random Cargo Table
- **Step 2B**: Cargo size = (Size + Wealth) × (1d100 rounded to nearest 10)
- **Step 3**: Base price + modifiers + haggling

#### Script Implementation:
- **✅ Implements**: Settlement-specific production lists
- **✅ Implements**: Size/wealth ratings (implied in settlement descriptions)
- **❌ Missing**: Probabilistic availability checks - **scripts assume cargo is always available**
- **❌ Missing**: Dynamic cargo size calculation - **scripts use fixed supply tables**
- **❌ Missing**: Proper "Trade" settlement handling for multiple cargo types
- **✅ Implements**: Haggle skill generation (`[dice("2d10+30")]`)

**Key Deviation**: Scripts use deterministic "Demand" tables instead of probability-based availability.

### **2. Purchase Price Calculation**

#### Official Algorithm:
- Base price from official tables
- +10% if buying partial cargo
- Haggle test for -10% (or -20% with Dealmaker talent)

#### Script Implementation:
- **✅ Implements**: Seasonal base prices that roughly match official tables
- **✅ Implements**: Haggle modifiers (-10% success, -20% with Dealmaker)
- **✅ Implements**: Partial cargo penalty (+10%)
- **✅ Implements**: Wine/brandy quality tiers

**Assessment**: **Well-aligned** with official rules.

### **3. Sale Price Calculation**

#### Official Algorithm:
- **Step 1**: Cannot sell where bought (or wait 1 week)
- **Step 2**: Buyer availability = Size × 10 (+30 if "Trade" settlement)
- **Step 3**: Price = Base Price × Wealth modifier:
  - Squalid: 50% of base
  - Poor: 80% of base
  - Average: 100% of base
  - Bustling: 105% of base
  - Prosperous: 110% of base
- **Step 4**: Haggle for +10% (or +20% with Dealmaker)

#### Script Implementation:
- **❌ Missing**: Location/time restrictions
- **❌ Missing**: Buyer availability checks
- **✅ Implements**: Wealth-based price modifiers (exactly matches official percentages)
- **✅ Implements**: Haggle bonuses (+10%/+20%)
- **❌ Missing**: Village size restrictions for non-grain cargo
- **❌ Missing**: Desperate sale options (50% base price)
- **❌ Missing**: Rumor system for double-price sales

**Assessment**: **Core pricing correct** but missing market dynamics.

---

## Settlement Data Analysis

### **Script Settlement Database**
The Cargo Availability Generator contains ~69 settlements with:
- Size ratings: Hamlet/Village/Town (implied)
- Wealth ratings: Squalid/Poor/Average/Bustling/Prosperous
- Production lists: Specific goods per settlement
- Demand mechanics: Uses "Demand2" through "Demand8" tables
- Supply amounts: Uses "Supply2" through "Supply8" tables

### **Compliance Assessment**
- **✅ Good**: Settlement wealth modifiers match official rules exactly
- **✅ Good**: Production specialization per settlement
- **❌ Deviation**: Uses fixed probability tables instead of dynamic (Size+Wealth)×10% calculations
- **❌ Missing**: Proper "Trade" settlement mechanics for random cargo

---

## Major Rule Deviations

### **1. Availability Mechanics**
- **Official**: Probabilistic with (Size+Wealth)×10% chance
- **Script**: Deterministic using fixed "Demand" tables

### **2. Cargo Size Calculation**
- **Official**: Dynamic (Size+Wealth) × (1d100 rounded up to nearest 10)
- **Script**: Fixed "Supply" tables based on settlement rating

### **3. Market Dynamics**
- **Official**: No buyer guarantee, size restrictions, location/time limits
- **Script**: Simplified - buyers always available, no restrictions

### **4. Trade Settlements**
- **Official**: Special rules for settlements producing "Trade" (random cargo, higher availability)
- **Script**: Partially implemented - some settlements show "Trade" but mechanics unclear

---

## Strengths of Script Implementation

1. **User-Friendly**: No manual calculations or dice rolling required
2. **Comprehensive**: Covers 69+ settlements with detailed data
3. **Accurate Pricing**: Core price calculations match official rules
4. **Complete Cargo Types**: Includes all official cargo plus quality tiers
5. **Seasonal Variation**: Proper seasonal price adjustments

## Weaknesses of Script Implementation

1. **Missing Uncertainty**: No risk of unavailable cargo or buyers
2. **Simplified Market**: No supply/demand dynamics
3. **Missing Restrictions**: Can theoretically sell anywhere anytime
4. **Fixed Supply**: No variation in cargo amounts available
5. **Incomplete Rules**: Missing rumor system, desperate sales, village restrictions

---

## Recommendations for Unified System

### **High Priority Fixes**
1. Implement probabilistic availability checks
2. Add dynamic cargo size calculations
3. Include buyer availability mechanics
4. Add location/time sale restrictions

### **Medium Priority Additions**
1. Proper "Trade" settlement mechanics
2. Village cargo restrictions (Grain only except Spring)
3. Desperate sale options
4. Rumor system for premium prices

### **Low Priority Enhancements**
1. Random market events
2. Multi-session campaign tracking
3. Historical price trends
4. Advanced haggling mechanics

The scripts provide an excellent foundation but need rule compliance improvements to match the official algorithm fully.