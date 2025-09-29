# Trading Places Module

## Phase 1: Foundry Harness - COMPLETE ✅ (Fixed & Improved)

The Foundry Harness provides a lightweight testing environment that runs the module outside of Foundry VTT for automated testing and development.

**🔧 Critical fixes applied based on review:**
- Fixed settings storage infinite recursion bug
- Added proper module load failure detection  
- Implemented deterministic seeded randomness
- Added scenario transition planning for real module integration
- Made scenario load failures fatal (no more silent skips)

### Quick Start

```bash
# Install dependencies
npm install

# Run default scenarios (headless)
npm run harness

# Run with visual UI
npm run harness:ui

# Run specific scenarios
npm run harness:buying
npm run harness:availability

# Run with deterministic results (CI)
npm run harness:ci
```

### Features

- **Headless Mode**: Automated testing with mocked Foundry globals
- **Rendered Mode**: Browser-based template inspection
- **Deterministic Testing**: Seeded random generation for consistent results
- **Real Module Integration**: Loads actual module code when available
- **Scenario-Based Testing**: Extensible scenario system

See [Foundry Harness Documentation](tests/foundry-harness/README.md) for detailed usage.

## Phase 2: Data Restructuring - COMPLETE ✅

The orange-realism data migration has been successfully completed, establishing a robust foundation for advanced trading mechanics.

### Key Achievements

- **184 settlements migrated** to new schema with population-based sizing
- **Automated migration scripts** with backup and validation
- **Supply/demand equilibrium** foundation implemented
- **Flag-based settlement mechanics** with configurable modifiers
- **Enhanced DataManager** with new query methods

### New Data Structure

```json
{
  "region": "Reikland",
  "name": "ALTDORF",
  "population": 105000,
  "size": 5,
  "wealth": 5,
  "flags": ["trade", "government"],
  "produces": ["Luxuries"],
  "demands": ["Grain", "Metal"],
  "garrison": {"a": 2000, "b": 5000, "c": 10000}
}
```

### Migration & Validation Tools

```bash
# Validate current data schema
npm run validate:schema

# Preview migration changes
npm run migrate:settlements

# Apply migration (with backup)
npm run migrate:settlements:live

# Test new schema functionality
npm run harness scenarios/orange-realism-schema.js
```

See [Phase 2 Summary](PHASE2_SUMMARY.md) for complete implementation details.

## Phase 3: Merchant System Overhaul - COMPLETE ✅

The merchant generation system has been completely rebuilt with population-based scaling, sophisticated skill distribution, and supply/demand equilibrium integration.

### Key Achievements

- **Population-based merchant counts** with configurable scaling formulas
- **Piecewise skill distribution** using percentile tables and wealth modifiers
- **Supply/demand equilibrium** driving merchant availability and pricing
- **Merchant personality profiles** with behavioral traits and special abilities
- **Desperation reroll mechanics** with configurable penalties
- **Special source behaviors** for smuggling, piracy, and government trade

### Merchant Generation Features

```javascript
// Population-scaled merchant counts
Hamlet (150 pop): 2 merchants
City (50,000 pop): 10 merchants  
Metropolis (105,000 pop): 15 merchants (capped)

// Flag-based multipliers
Trade settlements: +50% merchants
Government: +20% merchants  
Subsistence: -50% merchants

// Equilibrium-driven availability
Oversupplied (3:1 ratio): Easy availability, lower prices
Undersupplied (1:3 ratio): Scarce goods, higher prices
Desperate (supply < 20): Auto-triggers desperation rerolls
```

### Testing & Validation

```bash
# Test new merchant system
npm run harness:phase3

# Test data schema compliance  
npm run validate:schema

# Test all systems together
npm run harness
```

See [Phase 3 Summary](PHASE3_SUMMARY.md) for complete implementation details.

## Trading System Features

- Complete implementation of the official WFRP 4E trading algorithm (pages 71-78)
- System-agnostic design with dataset swapping capability
- Full FoundryVTT integration with native dice rolling and chat messages
- Seasonal price variations and market dynamics
- Haggling mechanics with skill tests
- Settlement-based cargo availability and buyer mechanics
- GM-configurable settings for chat visibility and season management

## Installation

1. In FoundryVTT, go to the Add-on Modules tab
2. Click "Install Module"
3. Paste the manifest URL: `https://github.com/foundry-modules/trading-places/releases/latest/download/module.json`
4. Click "Install"

## Usage

1. Enable the module in your world
2. Set the current season in module settings
3. Use the trading dialog to conduct Trading Places transactions
4. All dice rolls and results are posted to chat with configurable visibility

## Configuration

The module supports system-agnostic configuration through dataset files:
- `datasets/active/` - Currently active trading dataset
- `datasets/wfrp4e-default/` - Default WFRP 4E dataset

## Requirements

- FoundryVTT v10 or higher
- Compatible with WFRP4e system (optional)

## License

This module is licensed under the MIT License.