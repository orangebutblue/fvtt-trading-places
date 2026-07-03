# Trading Places - AI Agent Instructions

FoundryVTT module implementing the full WFRP4e Trading Places rules (WFRP4e core book pages 71-78: availability, merchant generation, haggling, equilibrium pricing). Entry/hook-registration file: `scripts/main.js` (loaded last in `module.json`'s `esmodules` — dependencies must precede it in that list).

## Hard rules

- Answer questions immediately; do not edit files just to answer a question.
- Get explicit approval before changing any file.
- Never modify anything under `datasets/` — these are shipped source files, read once on first launch and never written back to. Runtime code must never read/write `datasets/` directly or assume a `datasets/active` path exists on disk; see "Dataset model" below.
- No setup/filesystem changes (symlinks, folder copies, moving things around) outside of normal code edits.
- Never run the "Zip Module" VS Code task (`.vscode/tasks.json`) — Foundry loads the module directly from source; zipping isn't part of this project's workflow.

## Commands

```bash
npm test                      # full Jest suite (jsdom, tests/*.test.js)
npm run test:watch            # watch mode
npx jest tests/<file>.test.js # single suite
npm run validate:schema       # validate datasets/ structure (scripts/validate-schema.js)
npm run validate:dataset      # same validator, --verbose
npm run migrate:settlements         # dry run
npm run migrate:settlements:live    # writes changes
```

## Architecture invariants

Data flow is one-directional: **UI → managers → engine**, never the reverse. Two files are the sole gateways past that boundary — route everything through them rather than reaching around:

- `scripts/system-adapter.js` — the only path to Foundry's `game` object (currency, inventory, actor, dice operations). Mock it via `tests/foundry-harness/` in tests rather than touching `game` directly.
- `scripts/data-manager.js` — the only path to dataset data at runtime (`getCargoTypes()`, `getConfig()`, `getSettlements()`, etc.). Never read dataset JSON directly from UI/engine code.

`scripts/trading-engine.js` and its algorithm helpers (`buying-algorithm.js`, `selling-algorithm.js`, `price-calculator.js`) must stay pure — no UI state, no Foundry globals.

## Dataset model (runtime vs. disk)

- First launch: module reads `datasets/` files once, copies them into Foundry `game.settings`, marks that copy read-only.
- Every launch after that: runtime reads/writes only `game.settings`, never disk. The shipped `datasets/` files are not touched again.
- "Active dataset" is a `game.settings` pointer, not a folder — it may point at a read-only built-in dataset or an editable user-created one. Don't construct module-relative URLs assuming an `active/` directory exists.
- Dev-only exception: `scripts/validate-schema.js` and the `migrate:settlements` scripts read `datasets/` files directly for tooling purposes — that's expected, it's not runtime code.
- Full model, persistence format, and troubleshooting: `docs/DATASET_SYSTEM.md`.

## Critical UI navigation

The Data Management UI (add/edit/delete settlements, cargo types, source flags, config; import/export) is **not** in module settings or scene controls — it's a separate window opened via the main Trading Places UI's sidebar → **GM Tools** section → **Data Management** button.

## Testing gotchas

- Tests must either mock `game.settings` or run the module's dataset-initialization helper to populate storage from shipped files before asserting runtime behavior — a test that skips this will fail in confusing ways unrelated to the actual assertion.
- Foundry globals are mocked via `tests/foundry-harness/` — follow its existing patterns rather than hand-rolling new stubs.

## Other gotchas

- Currency: canonical unit is the integer Brass Penny (BP); display format is `"3GC 12SS 4BP"`. Keep calculations in integer BP and only format at display time (`currency-utils.js`, `currency-display.js`).
- CSS: every class must start with `trading-places-` — unprefixed classes can collide with and break core Foundry UI.
- Target Foundry v12 minimum, verified on v13 — avoid APIs deprecated as of v13.
- New JS/CSS/template assets must be added to `module.json`'s `esmodules`/`styles` lists (in correct dependency order for JS) or Foundry won't load them.
