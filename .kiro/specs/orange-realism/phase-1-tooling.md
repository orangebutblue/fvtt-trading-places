# Phase 1 – Tooling & Developer Experience

## Intent
Stand up a repeatable local execution environment that loads the real module code, simulates key Foundry services, and exposes both headless and optional browser-rendered modes. This harness becomes the foundation for automated smoke tests, scenario-driven validation, and rapid feedback while developing later phases.

## Outcomes
- Headless harness capable of running scripted scenarios against the actual module entry points.
- Optional UI mode serving Handlebars templates and static assets for visual inspection.
- Seed scenario(s) covering the availability → desperation reroll → purchase happy path.
- Developer documentation and CI integration for the harness workflow.

## High-Level Tasks
1. **Bootstrap Environment**
   - Create `tests/foundry-harness/environment.js` to seed global Foundry namespaces (`game`, `CONFIG`, `ui`, `Hooks`, etc.).
   - Provide minimal lifecycle helpers (`await harness.ready()`, teardown hooks) to ensure module initialization completes before scenarios run.

2. **Foundation Stubs**
   - Dice subsystem returning pseudo-random rolls; support deterministic seeding via env var (e.g., `HARNESS_SEED`).
   - Actor/Item mocks supporting the adapter calls we make today (inventory and currency mutations at minimum).
   - Chat/logging stubs capturing emitted messages for assertion.

3. **Scenario Runner**
   - Build `tests/foundry-harness/run.js` that loads the harness, imports scenario modules, and executes them sequentially.
   - Accept CLI flags / env vars:
     - `HARNESS_UI` or `--ui` toggles rendered mode.
     - `--scenario` or positional arguments select scenario files.
     - `--seed` seeds dice rolls.

4. **Rendered Mode Server**
   - Serve `/templates`, `/styles`, `/assets` through a lightweight HTTP server (Express or Node’s `http`).
   - Add helper to render the trading dialog template with the data returned by a scenario.
   - Optionally open the rendered page automatically (respect a `HARNESS_NO_OPEN` flag).

5. **Initial Scenarios**
   - `scenarios/buying-flow.js`: load a settlement fixture, run availability, execute optional desperation reroll, perform purchase, assert inventory changes.
   - `scenarios/availability-only.js`: quick smoke test verifying merchant slot counts obey config and settlement data.

6. **CI & Docs**
   - Add npm scripts (`harness`, `harness:ui`, `harness:ci`).
   - Wire the headless smoke test into the CI pipeline.
   - Update README / CONTRIBUTING with usage instructions and tips for adding new scenarios.

## Dependencies & Notes
- Keep stubs intentionally shallow; add new APIs only when later phases require them.
- Prefer pure JS for accessibility, but it is acceptable to use TypeScript if build tooling is already in place.
- Coordinate with the migration scripts (Phase 2) to ensure scenarios load data from post-migration fixtures once available.

## Acceptance Checklist
- Running `npm run harness tests/foundry-harness/scenarios/buying-flow.js` succeeds headlessly.
- Setting `HARNESS_UI=1` renders the trading dialog in a browser with populated data.
- CI job executes the headless smoke test and fails on assertion errors.
- Documentation clearly describes how to run, extend, and debug the harness.
