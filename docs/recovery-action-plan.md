# Trading Places – Rapid Recovery Action Plan

_Last updated: 2025-10-19_

## Primary Goal
Restore a **stable Foundry VTT startup (no validator errors) and functional trading flows** by delivering a tested, storage-first dataset pipeline and enforcing it with CI.

---

## Phase 1 – Immediate Stabilization (Target: 24 hours)

1. **Reinstate Storage-First Dataset Load**
   - [x] Revert `_loadDatasetFromPath` to read from `game.settings` when running inside Foundry.
   - [x] Implement `initBuiltinDatasetsToStorage()` to populate storage via `fetch()` when hashes are missing.
   - [ ] Acceptance: Startup validator passes on a clean Foundry world (`game.settings` empty) using actual module files.

2. **Hotfix Validator & Bootstrap**
   - [ ] Allow the validator to fall back to module files if storage is empty, then immediately seed storage and re-run validation.
   - [ ] Add diagnostic logging showing dataset source (storage vs module) and hashes.
   - [ ] Acceptance: Console log clearly shows seed events; validation passes without user intervention.

3. **Smoke Test in Foundry**
   - [ ] Launch module in Foundry v13+ with WFRP4e; run through buying/selling flow.
   - [ ] Confirm no red errors in console; trading application opens and lists settlements/cargo.
   - [ ] Acceptance: Manual test script signed off (attach screenshots or transcript).

---

## Phase 2 – Automated Safeguards (Target: 48 hours)

1. **Foundry Bootstrap Harness**
   - [ ] Add a headless harness (Node + jsdom/Foundry mocks) that executes `initBuiltinDatasetsToStorage → performStartupValidation → loadActiveDataset`.
   - [ ] Integrate into Jest as `startup-validation.test.js`.
   - [ ] Acceptance: Fails if storage seeding or validation breaks; currently skipped suites remain skipped but harness passes.

2. **Re-enable Critical Integration Suites**
   - [ ] Update `integration-workflows.test.js`, `comprehensive-integration.test.js`, `foundry-integration.test.js` to assume storage-first datasets.
   - [ ] Replace legacy `source`/enum expectations with new schema (`flags`, numeric `size`).
   - [ ] Acceptance: All three suites run (no `.skip`) and pass locally.

3. **CI Gate**
   - [ ] Extend CI pipeline to run the new harness + full Jest suite on every PR.
   - [ ] Add badge/reporting in README summarizing latest test status.
   - [ ] Acceptance: CI blocks merges when startup harness or integration suites fail.

---

## Phase 3 – Structural Hardening (Target: 1 week)

1. **Dataset Registry Module**
   - [ ] Create `scripts/dataset-registry.js` to track built-in datasets (name, version, hash, storage keys).
   - [ ] DataManager depends on registry for locating datasets instead of hard-coded paths.
   - [ ] Acceptance: Registry unit tests cover hash mismatches, upgrades, user datasets.

2. **Unified Dataset API**
   - [ ] Introduce `DataManager.getActiveDataset()` returning `{ settlements, cargoTypes, config, metadata }` from storage only.
   - [ ] Deprecate direct `fetch()`/disk reads outside bootstrap.
   - [ ] Acceptance: Trading engine, UI flows, and CLI utilities all consume the new API.

3. **Observability & Docs**
   - [ ] Add debug panel (`debug-ui.js`) summarizing dataset source, hash, and last refresh time.
   - [ ] Document dataset lifecycle (source files → storage → runtime) in `/docs/dataset-lifecycle.md`.
   - [ ] Acceptance: QA can verify dataset provenance without inspecting console.

---

## Phase 4 – Release Readiness (Target: 10 days)

1. **Regression Run**
   - [ ] Execute full Jest suite, harness, and manual smoke tests on clean Foundry world + existing world with user datasets.
   - [ ] Record results in `/docs/regression-report-YYYYMMDD.md`.

2. **Stakeholder Sign-off**
   - [ ] Review recovery outcomes with maintainers; confirm no outstanding blocker bugs.
   - [ ] Prepare release notes highlighting storage-first changes and new safeguards.

3. **Post-Mortem & Process Update**
   - [ ] Capture what failed (test gap, storage assumptions) and prevention steps in `/docs/post-mortem-2025-10-dataset.md`.
   - [ ] Update contribution guidelines to require startup harness coverage for data-layer changes.

---

## Ownership & Reporting
- **Primary driver:** Recovery task force (current AI assistant acting on maintainer direction).
- **Status updates:** Daily brief in issue tracker with checklist progress.
- **Completion definition:** All checklist items checked, CI green, manual Foundry run verified, and recovery documentation committed.

---

> **Reminder:** Do not cut corners—storage-first behavior must be verified both automatically and manually before declaring recovery complete.
