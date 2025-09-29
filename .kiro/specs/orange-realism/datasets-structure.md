# Datasets Structure

## Overview
This document describes the file structures for datasets that are not settlement-related. These include matrices, profiles, and other data used in the trading system. Note: Some items (like merchant generation rules or amount scaling) may be better handled as code rather than separate files, depending on configurability needs.

## Cargo Types Data
Comprehensive resource definitions, including metadata, base prices, and seasonal availability modifiers.

- **File**: `datasets/cargo-types.json`
- **Structure**: Array of cargo type objects.
  - Example:
    ```json
    {
      "cargoTypes": [
        {
          "name": "Grain",
          "categories": ["Bulk Goods"],
          "description": "A collective term for all kinds of agricultural products...",
          "base_price": 10,
          "seasonal_availability": {
            "spring": 1.2,
            "summer": 0.8,
            "autumn": 0.5,
            "winter": 1.0
          }
        }
      ]
    }
    ```
- **Purpose**: Single source of truth for all cargo type data. Prices calculated as `base_price × seasonal_availability × other modifiers`.

## Complementary Goods Mappings
Settlement type → demanded goods mappings. Defines what goods settlements need, with bonuses for supplying them.

- **File**: `datasets/complementary-goods.json`
- **Structure**: Object with settlement types (e.g., "farming") as keys, each mapping to goods and demand bonuses.
  - Example: As shown – farming demands tools/fertilizer with bonuses.
- **Purpose**: Adds demand-side economics (e.g., mining settlements pay more for food).

## Source Flags Modifiers
Modifiers for special settlement behaviors (e.g., smuggling increases contraband chance).

- **File**: `datasets/source-flags.json`
- **Structure**: Object with flag names as keys, each with behavior mods (e.g., {"smuggling": {"contraband_chance": 0.8, "price_reduction": 0.1}}).
- **Purpose**: Defines how flags alter trading (see settlement-flags.md for meanings).

## Trading Config
A centralized configuration file for tuning trading system parameters and decisions, separate from dataset files.

- **File**: `config/trading-config.json`
- **Structure**: Object with keys for various settings, e.g., {"availability_price_impact": 0.1, "merchant_skill_formula": {"distribution": "exponential", "min": 21, "max": 120, "center": 71}}.
- **Purpose**: Allows quick changes to mechanics like price calculations and merchant skill generation.