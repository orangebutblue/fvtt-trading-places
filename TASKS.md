# Orange Realism Completion Tasks

## Buyer Tab Pipeline (Spec Alignment)

- [ ] Load orange-realism trading config (`trading-config.json`) through `scripts/data-manager.js` with cached accessors.
- [ ] Implement Step 0 defaults loader that pulls availability/quality/contraband baselines from config and exposes them to the Buyer tab.
- [ ] Implement Step 1 merchant-slot calculation using population thresholds and flag modifiers per `.kiro/specs/orange-realism/cargo-availability-procedure.md`.
- [ ] Implement Step 2 settlement-flag modifier queue with structured records for availability, supply, demand, quality, contraband, and desperation adjustments.
- [ ] Implement Step 3 seasonal modifier application using the season x goods matrix from the config.
- [ ] Implement Step 4 supply/demand equilibrium processor that applies queued modifiers in sequence and clamps per config.
- [ ] Implement Step 5 cargo-type generator that weights produces/demands, flag pools, and garrison-aware categories.
- [ ] Implement Step 6 cargo-amount generator that respects size, supply bias, seasonal modifiers, and flag-driven bulk adjustments.
- [ ] Implement Step 7 quality roller driven by wealth tiers, flags, and configured dice expressions.
- [ ] Implement Step 8 contraband roller with size, flag, and baseline contributions.
- [ ] Implement Step 9 merchant availability roller that consumes slot counts, skill distributions, and queue of modifiers.
- [ ] Implement Step 10 desperation reroll flow with penalties applied immediately to merchant records.
- [ ] Implement Step 11 price calculator that composes base prices, quality, desperation, wealth, supply/demand, and contraband risk modifiers.
- [ ] Surface each step’s results in the Buyer tab UI (`trading-application-v2.js` + templates) with expandable diagnostics for GMs.

## Data Authoring Toolkit

- [ ] Build settlement CRUD UI in `data-management.hbs`/`data-management-ui.js` with validation and preview.
- [ ] Build cargo-type CRUD UI covering seasonal prices, encumbrance, quality tiers, and flags.
- [ ] Implement change tracking, undo, and apply workflows for dataset edits.
- [ ] Persist edits safely via `DataManager` with schema validation and cache invalidation hooks.
- [ ] Provide import/export/backup operations tied to the active dataset directory.

## Integration & QA

- [ ] Wire scene controls/menus to launch the new data management and trading UIs.
- [ ] Update automated tests to cover the new pipeline and data tooling, ensuring `npm test` passes cleanly.
