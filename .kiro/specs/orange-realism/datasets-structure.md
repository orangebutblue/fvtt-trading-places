# Datasets Structure

## Overview
This document describes the file structures for datasets that are not settlement-related. These include matrices, profiles, and other data used in the trading system. Note: Some items (like merchant generation rules or amount scaling) may be better handled as code rather than separate files, depending on configurability needs.

## Cargo Types Data
Comprehensive resource definitions, including metadata, base prices, seasonal availability modifiers, and settlement relationships.

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
          },
          "require": [],
          "create": []
        },
        {
          "name": "Tools",
          "categories": ["Manufactured"],
          "description": "Basic gear needed for logging, mining, and farming operations.",
          "base_price": 20,
          "seasonal_availability": {
            "spring": 1.0,
            "summer": 1.0,
            "autumn": 1.0,
            "winter": 1.1
          },
          "require": ["Metal"],
          "create": []
        }
      ]
    }
    ```
- **Purpose**: Single source of truth for all cargo type data. `require` and `create` refer to other cargo type keys when production chains matter (e.g., Tools require Metal). Real values will be defined per cargo type during the data pass for this update.

**Upcoming change**: Remove the "Agriculture" cargo type entry and add a new `agriculture` flag (see settlement-flags.md).

## Source Flags Modifiers
Modifiers for special settlement behaviors (e.g., smuggling increases contraband chance).

- **File**: `datasets/source-flags.json`
- **Structure**: Object with flag names as keys, each with behavior mods (e.g., {"smuggling": {"contraband_chance": 0.8, "price_reduction": 0.1}}).
- **Purpose**: Defines how flags alter trading (see settlement-flags.md for meanings). At runtime a shared adapter reads this file and applies every modifier listed for the active flags—no flag-specific hard-coding should be required.

## Trading Config
A centralized configuration file for tuning trading system parameters and decisions, separate from dataset files.

- **File**: `config/trading-config.json`
- **Structure**: Object with keys for various settings, e.g., {
  "merchantSkillDistribution": {"type": "lookup", "params": {...}},
  "supplyDemand": {
    "producesShift": 0.5,
    "demandsShift": 0.35,
    "flagShifts": {"mine": 0.2},
    "clamp": {"min": 10, "max": 190}
  }
}.
- **Purpose**: Allows quick changes to mechanics like merchant skill generation, supply/demand transfer percentages, desperation reroll penalties, and other balancing levers without editing data files.