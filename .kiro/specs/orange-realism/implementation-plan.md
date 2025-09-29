# Implementation Plan

## Phase 1: Tooling & Developer Experience
1. Build Foundry harness for headless scenario execution using real module files
2. Add optional browser-rendered mode for harness to inspect templates visually
3. Wire initial harness scenarios (availability + buying pipeline smoke test)
4. Document harness usage and ensure CI can run headless mode

## Phase 2: Data Restructuring (Foundation)
1. Create master resource registry with specific goods
2. Update settlement data structure (convert legacy size letters to population-derived numeric categories)
3. Implement settlement `produces` / `demands` fields and migrate existing data
4. Implement complementary goods mappings
5. Add desperation reroll handling to availability checks (configurable penalties)
6. Create non-trading source flag system
7. Introduce supply/demand equilibrium logic (200-point base, multiplicative transfers configurable in trading config)
8. Author automated migration scripts for settlements and cargo datasets

## Phase 3: Merchant System Overhaul
1. Implement population-based merchant counts
2. Wire merchant skill distribution to config-defined parameters
3. Add desperation price/quantity penalties after failed availability rerolls (config-driven)
4. Create merchant personality profiles
5. Implement special source behaviors (smuggling, piracy, etc.)

## Phase 4: Data Authoring & UI Tooling
1. Build settlement & cargo management UI (create, edit, delete entries)
2. Integrate editor with DataManager load/save workflows (including validation hooks)
3. Expose flag, produces/demands, and equilibrium configuration controls in the UI
4. Provide inline validation and preview flows for editor actions
5. Support draft/staging workflow so changes can be reviewed before writing to disk
6. Refresh trading dialog (buyer flow) to surface equilibrium, produces/demands, and desperation rerolls
7. Implement end-to-end buyer workflow (arrival → availability rolls → reroll option → purchase)
8. Ensure partial trade handling defers to future feature flags while supporting full purchases today

## Phase 5: Testing & Balance
1. Validate all settlement types work correctly
2. Balance price modifiers and desperation effects
3. Regression test settlement/cargo editor (CRUD, validation, persistence)
4. UI regression for trading dialog refresh (availability, reroll, purchase flows)
5. Performance testing with 183 settlements
6. UI polish for new workflows

## Implementation Priority
1. **High Priority**: Settlement wealth/size affecting merchant counts and quality
2. **Medium Priority**: Foundry harness and automated smoke tests
3. **Medium Priority**: Data editor UI covering settlements and cargo types
4. **Medium Priority**: Trading dialog refresh with updated buying pipeline
5. **Low Priority**: Complex dynamic events (wars, festivals, etc.)