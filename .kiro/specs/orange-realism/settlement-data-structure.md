# Settlement Data Structure

## Overview
This document describes the new data structure for settlements in the trading system. The structure has been updated to separate settlement size from type, and to use flags for various attributes instead of embedding them in sources.

## New Format
Each settlement object will have the following keys:

- `region`: String, the province or area (e.g., "Reikland")
- `name`: String, the settlement name (e.g., "ALTDORF")
- `population`: Number, population count
- `size`: Number (1-5), automatically derived from population thresholds defined in the trading config
  - 1: up to 200 inhabitants (Hamlet)
  - 2: 201–1,500 inhabitants (Village)
  - 3: 1,501–10,000 inhabitants (Town)
  - 4: 10,001–100,000 inhabitants (City)
  - 5: 100,001+ inhabitants (Metropolis/City State)
- `ruler`: String, the governing entity
- `wealth`: Number (1-5), wealth level
- `flags`: Array of strings, list of flags (e.g., ["trade", "mine", "government"])
- `produces`: Array of cargo keys the settlement reliably exports (e.g., ["Gold", "Tools"]). Optional; when omitted, the system falls back to flag/category pools.
- `demands`: Array of cargo keys the settlement consistently seeks to import (e.g., ["Tools", "Food"]). Optional; defaults are derived from flags and wealth if absent.
- `garrison`: Object capturing troop counts by class, e.g., {"a": 1400, "b": 3000, "c": 1000}. Any key may be omitted to indicate zero for that type.
- `notes`: String, additional information

## Migration from Old Format
- Size: Convert letters (V, ST, T, C, CS, F, M) to population values, then derive the numeric size (1-5) via the thresholds above. Specialty settlements (forts, mines, etc.) inherit whatever size their population produces.
- Add `flags` key: Extract settlement types (e.g., "fort", "mine") and other attributes (e.g., "trade", "government") from sources or notes.
- Remove non-trade sources from the old `source` array and convert to flags.
- The old `source` array will be replaced or restructured for actual trade goods.

## Flag Processing
Flag effects are read from the flags dataset and processed sequentially by a shared modifier pipeline. Settlements with multiple flags simply stack their listed adjustments in the order they are applied.

## Supply/Demand Equilibrium
The trading engine tracks supply and demand for each cargo type per settlement using a 200-point equilibrium:

- Baseline: 100 supply / 100 demand.
- Each modifier transfers a percentage of the current opposing pool (multiplicatively) toward its side. For example, a +50% supply modifier moves half of the current demand points to supply (100/100 → 150/50). Stacking modifiers applies sequentially (another +50% supply becomes 175/25, not 200/0).
- Settlement `produces` entries apply supply-side shifts defined in the trading config. `demands` entries apply demand-side shifts.
- Flags, seasonal effects, wealth tiers, and other systems contribute additional percentage transfers, all configurable.
- After every modifier has been applied, the final supply and demand values dictate producer/seekers counts, quantities, and any downstream mechanics (e.g., desperation rerolls).

All percentage values and clamping behavior live in the trading config so equilibrium tuning never requires editing settlement JSON.