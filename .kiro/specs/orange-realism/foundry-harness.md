# Foundry Harness Specification

## Goal
Provide a lightweight execution environment that can run the module’s real code outside of Foundry VTT, enabling automated tests, scripted scenarios, and optional HTML rendering for manual inspection.

## Modes
- **Headless (default):** Executes scenarios with mocked Foundry globals, logging outcomes to stdout. Suitable for CI and automated testing.
- **Rendered (opt-in):** In addition to the headless setup, serves module templates/assets through a small HTTP server and opens a browser window so developers can inspect the UI.

## Core Components
1. **Environment Bootstrap (`tests/foundry-harness/environment.js`)**
   - Defines `globalThis.game`, `CONFIG`, `ui`, `Hooks`, etc., with minimal behavior.
   - Loads module entry points (`scripts/main.js`, supporting modules) using dynamic imports.
   - Provides utility hooks for scenarios (e.g., `await harness.ready()` after initialization).

2. **Subsystem Stubs**
   - **Dice (`dice.js`):** Implements Foundry-like roll API with pseudo-random results; supports optional seeding for deterministic tests.
   - **Actors/Items (`actors.js`):** Supplies minimal data structures and methods touched by the module (inventory, currency adjustments).
   - **Chat (`chat.js`):** Captures messages emitted by the module for assertion/logging.
   - Additional stubs can be added as module features expand.

3. **Scenario Runner (`tests/foundry-harness/run.js`)**
   - CLI entry point invoked via `node` or an npm script.
   - Loads environment, then imports and executes one or more scenario files.
   - Handles `HARNESS_UI=1` (or `--ui`) to toggle rendered mode.

4. **Rendered Mode Server**
   - Tiny Express/HTTP server serving `templates/`, `styles/`, and other static assets.
   - Provides helper to render a Handlebars template with data from the module (e.g., trading dialog context).
   - Automatically opens the page in the default browser when UI mode is enabled (optional).

## Example Scenario Flow
1. `npm run harness tests/foundry-harness/scenarios/buying-flow.js`
2. Environment loads, mocks dice rolls.
3. Scenario creates a settlement context, triggers availability generation, runs desperation reroll, completes a purchase.
4. Assertions verify expected merchants, quantity adjustments, and chat output.
5. In UI mode, the same scenario additionally renders the trading dialog template after purchase so developers can inspect the result.

## Integration & Automation
- Add npm scripts: `harness`, `harness:ui`, and `harness:ci` (headless with seeded randomness).
- Wire at least one smoke-test scenario into CI (availability + purchase) to catch regressions.
- Documentation: add README section explaining how to run scenarios and extend stubs.

## Future Enhancements
- Record/replay dice rolls for deterministic debugging.
- Support multiplayer simulations by mocking multiple players/actors.
- Provide snapshot comparison for rendered UI (visual regression testing).
