# Trading Places – AI Coding Instructions
- When asked a question, answer immediately.
- Do not modify files while only answering a question.
- Always get explicit approval before changing any file.

## Repo essentials
- FoundryVTT module implementing full WFRP4e Trading Places rules; entry point is `scripts/main.js`.
- Core trading logic is platform-agnostic (`scripts/trading-engine.js` plus helpers); Foundry-specific glue lives in `scripts/system-adapter.js` and `scripts/main.js`.

## Architecture map
- `scripts/trading-engine.js`: pure algorithms (buy/sell, haggling, settlement filters); keep it free of UI or Foundry globals.
- `scripts/data-manager.js`: loads `datasets/active/**`, validates schema, caches seasonal pricing; use its APIs instead of touching JSON directly.
- `scripts/system-adapter.js`: only path to currency, inventory, and actor operations; relies on Foundry's `game` object, so mock it in tests using fixtures under `tests/`.
- UI stack = `scripts/trading-application-v2.js` + Handlebars in `templates/` + `styles/trading.css`; logic flows from UI → managers → engine (never the reverse).
- Diagnostic layer combines `debug-logger.js`, `debug-ui.js`, and `fallback-dialogs-v2.js` for safe failure modes.

## Data & configuration
- Active dataset resides in `datasets/active/`; swap entire directories when testing alternates.
- Run `node validate-dataset.js` after changing cargo tables or settlement JSON to enforce schema rules and seasonal pricing ranges.
- When adding algorithms or managers, register the script in `module.json` `esmodules` and import it through `scripts/main.js`.

## Coding conventions
- Favor async/await; wrap every Foundry call through `SystemAdapter` and surface errors via `scripts/error-handler.js`.
- Inject configuration objects (see `config-validator.js`) instead of reaching for globals.
- Extend trading logic by composing pure helpers inside `trading-engine.js`, `buying-algorithm.js`, `selling-algorithm.js`, or `price-calculator.js`; never push UI state into those files.

## Testing & verification
- `npm test` runs the full Jest suite (jsdom environment, 20+ files covering engine, adapter, UI workflows).
- `npm run test:watch` supports iterative work; for a single suite use `npx jest tests/<file>.test.js`.
- Dataset edits or new UI flows require updating the relevant fixtures/mocks in `tests/` to keep deterministic rolls and chat output coverage.

## Common workflows
- Module hooks, settings, and hot-module wiring live in `scripts/main.js`; follow its structure when introducing new Foundry hooks.
- Scene-control entry points mirror `scripts/proper-scene-controls.js`; reuse that pattern for additional UI launchers.
- Player inventory flows are centralized in `scripts/player-cargo-manager.js`; coordinate with `system-adapter.js` for currency and item mutations.

## Gotchas
- Target platform is Foundry v13+; avoid deprecated API paths and always access actors/items through adapter helpers.
- Keep manifests correct: list new assets in `module.json` with absolute URLs.
- DataManager caches datasets—use its invalidation helpers if you change load order or need fresh reads in tests.
- Maintain separation of concerns: engine/managers stay pure, UI files call downward, and no template reaches back into Foundry APIs directly.