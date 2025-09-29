# Phase 3 – Merchant System Overhaul

## Intent
Modernize the trading engine so merchant availability, skills, pricing, and desperation behaviors align with the new data model and configuration-driven tuning. This phase delivers the algorithmic backbone that the redesigned UI and editor rely on.

## Outcomes
- Merchant slot counts derived from population and config formulas.
- Skill distributions, desperation penalties, and availability modifiers sourced exclusively from `trading-config.json`.
- Supply/demand equilibrium integrated into merchant generation (both Producers and Seekers).
- Extensible personality and special-behavior hooks (smuggling, piracy, etc.) prepared for later features.

## Task Breakdown

### 1. Config Enhancements
- Expand `trading-config.json` with sections:
  - `merchantCount`: formula parameters (min slots per size, population multiplier, hard cap).
  - `skillDistribution`: type + parameters (e.g., piecewise lookup, percentile table).
  - `desperation`: reroll odds, price modifiers, quantity reductions, quality penalties.
  - `equilibrium`: thresholds dictating when supply/demand extremes block trades or trigger desperation automatically.
- Update config validation logic to ensure numeric ranges and presence of required keys.

### 2. Merchant Slot Calculation
- Update `scripts/trading-engine.js` (or relevant module) to compute producer/seeker slot counts using population + config values.
- Apply flag-based multipliers after the base count (using data from `source-flags.json`).
- Ensure results are integers and respect min/max bounds.

### 3. Supply/Demand Integration
- Introduce a helper (e.g., `calculateEquilibrium(settlement, cargoType, context)`) that:
  1. Initializes 100/100 supply/demand values.
  2. Applies `produces`, `demands`, flag transfers, seasonal effects, wealth modifiers, and config-defined adjustments sequentially.
  3. Returns final supply/demand plus metadata (transfer history for debugging).
- Use the equilibrium output to weight merchant success probabilities, lot sizes, and seeker interest.
- Clamp and cache results to avoid recomputation within a single availability check.

### 4. Skill & Personality Assignment
- Replace ad-hoc skill rolls with config-driven distribution logic (e.g., inverse CDF sampling).
- Add a placeholder `personalityProfile` field to each merchant (structure defined in config or separate dataset) for future RP hooks. Populate with defaults for now.

### 5. Desperation Reroll Mechanics
- Implement the reroll option: when an availability roll fails, reference `config.desperation` to determine penalties applied if the player chooses to reroll.
- Store enough metadata on the merchant to flag desperation-induced results (for UI highlighting).
- Ensure penalties persist through subsequent interactions (pricing, quantity limits, quality adjustments).

### 6. Special Source Behaviors
- Adjust flag processing pipeline so behaviors like `smuggling`, `piracy`, `subsistence`, etc. feed into the new equilibrium and merchant generation logic.
- Provide hook functions (e.g., `applyFlagBehavior(flagConfig, context)`) for future specialized rules to plug in cleanly.

### 7. Logging & Diagnostics
- Enhance debug logging (respecting existing logger) to record:
  - Slot calculation inputs/outputs.
  - Equilibrium transfers applied.
  - Skill roll results and selected percentiles.
  - Desperation reroll usage and penalties.
- Make logs toggleable via config or debug UI.

## Dependencies & Coordination
- Requires Phase 2 data migration so settlements/cargo supply the necessary fields.
- Coordinate with Phase 4 to ensure the UI expects the new merchant objects (fields for equilibrium, desperation, etc.).
- Provide sample merchant objects to UI and editor teams for contract alignment.

## Acceptance Checklist
- Harness scenario (buying flow) reflects new merchant counts and equilibrium behavior.
- Unit tests cover equilibrium calculations, slot formulas, and desperation penalties.
- Desperation reroll path applies penalties correctly, and merchants remember their reroll status.
- Flag behaviors affect merchants as defined in `source-flags.json`.
- Debug logs provide actionable information for balancing.
