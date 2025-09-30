# Orange Realism Completion Tasks

## Buyer Tab Pipeline (Spec Alignment)

- [ ] Load orange-realism trading config (`trading-config.json`) through `scripts/data-manager.js` with cached accessors.
- [x] Implement Step 0 defaults loader that pulls availability/quality/contraband baselines from config and exposes them to the Buyer tab.
- [x] Implement Step 1 merchant-slot calculation using population thresholds and flag modifiers per `.kiro/specs/orange-realism/cargo-availability-procedure.md`.
- [x] Implement Step 2 settlement-flag modifier queue with structured records for availability, supply, demand, quality, contraband, and desperation adjustments.
- [x] Implement Step 3 seasonal modifier application using the season x goods matrix from the config.
- [x] Implement Step 4 supply/demand equilibrium processor that applies queued modifiers in sequence and clamps per config.
- [x] Implement Step 5 cargo-type generator that weights produces/demands, flag pools, and garrison-aware categories.
- [x] Implement Step 6 cargo-amount generator that respects size, supply bias, seasonal modifiers, and flag-driven bulk adjustments.
- [x] Implement Step 7 quality roller driven by wealth tiers, flags, and configured dice expressions.
- [x] Implement Step 8 contraband roller with size, flag, and baseline contributions.
- [x] Implement Step 9 merchant availability roller that consumes slot counts, skill distributions, and queue of modifiers.
- [x] Implement Step 10 desperation reroll flow with penalties applied immediately to merchant records.
- [x] Implement Step 11 price calculator that composes base prices, quality, desperation, wealth, supply/demand, and contraband risk modifiers.
- [ ] Surface each step’s results in the Buyer tab UI (`trading-application-v2.js` + templates) with expandable diagnostics for GMs.

## Buyer Tab UI Redesign (Availability Breakdown)

- [x] Replace the availability header with a single status banner (emoji + concise text) and drop redundant phrasing about merchants.
- [x] Render settlement size/wealth using their descriptive names (e.g., "Town", "Comfortable") with numeric values available via hover tooltip.
- [x] Rewrite the availability chance line to show labeled components (base contributions, final percent) with an explanatory tooltip instead of raw formulas.
- [x] Combine roll/result messaging into one line and decorate dice rolls with a 🎲 icon for quick scanning.
- [x] Stop rendering slot diagnostics when the availability check fails; show a short failure notice and exit early.
- [x] For successful checks, present a compact allocation summary (cargo name/category, EP, merchant) first, then limit detailed math to a single collapsible per cargo.
- [x] Introduce reusable tooltip helpers in `trading-application-v2.js`/`trading.css` so hover text can explain modifiers without cluttering the layout.
- [x] Add a lightweight emoji/icon map (🎲 rolls, 💰 value, 🧮 calculations, ⚠️ risk) and apply consistently across the panel.
- [x] Refactor the pipeline diagnostics renderer to output only critical highlights by default and group optional details under clearly labeled toggles.
- [x] Update `templates/trading-unified.hbs` and `styles/trading.css` to support the new banner, summary layout, and tooltip styling.

## Data Authoring Toolkit

- [ ] Build settlement CRUD UI in `data-management.hbs`/`data-management-ui.js` with validation and preview.
- [ ] Build cargo-type CRUD UI covering seasonal prices, encumbrance, quality tiers, and flags.
- [ ] Implement change tracking, undo, and apply workflows for dataset edits.
- [ ] Persist edits safely via `DataManager` with schema validation and cache invalidation hooks.
- [ ] Provide import/export/backup operations tied to the active dataset directory.

## Integration & QA

- [ ] Wire scene controls/menus to launch the new data management and trading UIs.
- [ ] Update automated tests to cover the new pipeline and data tooling, ensuring `npm test` passes cleanly.
