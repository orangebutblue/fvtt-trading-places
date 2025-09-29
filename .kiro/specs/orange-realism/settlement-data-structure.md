# Settlement Data Structure

## Overview
This document describes the new data structure for settlements in the trading system. The structure has been updated to separate settlement size from type, and to use flags for various attributes instead of embedding them in sources.

## New Format
Each settlement object will have the following keys:

- `region`: String, the province or area (e.g., "Reikland")
- `name`: String, the settlement name (e.g., "ALTDORF")
- `size`: Number (1-5), representing the actual size of the settlement based on population and economic scale
  - 1: Village (smallest)
  - 2: Small Town
  - 3: Town
  - 4: City
  - 5: City State (largest)
- `ruler`: String, the governing entity
- `population`: Number, population count
- `wealth`: Number (1-5), wealth level
- `flags`: Array of strings, list of flags (e.g., ["trade", "mine", "government"])
- `garrison`: Array or string, military presence
- `notes`: String, additional information

## Migration from Old Format
- Size: Convert letters (V, ST, T, C, CS, F, M) to numbers (1-5). F and M map to 2, as they are specialized but not general population centers.
- Add `flags` key: Extract settlement types (e.g., "fort", "mine") and other attributes (e.g., "trade", "government") from sources or notes.
- Remove non-trade sources from the old `source` array and convert to flags.
- The old `source` array will be replaced or restructured for actual trade goods.

## Flag Processing
Each flag has its own function that modifies trading parameters. Settlements with multiple flags process them sequentially, allowing cumulative effects.