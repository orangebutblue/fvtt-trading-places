# Trading Procedure Refactor Plan

## Objectives
- Align the trading implementation with the authoritative master procedure.
- Eliminate legacy availability, merchant, and pricing logic in favor of the cargo availability pipeline.
- Ensure datasets, configuration, and tests reflect the orange-realism schema and trading rules.

## Deliverables
- Updated trading engine façade that orchestrates pipeline execution and season management.
- Enhanced cargo availability pipeline emitting full slot metadata per the master procedure.
- Cleaned configuration file containing only pipeline-driven parameters.
- Normalized datasets for settlements, cargo types, and ancillary tables.
- Revised automated tests verified against the new workflow.
- Summary documentation covering changes, validation steps, and follow-up items.

## Workstreams and Tasks

### Phase 1 – Preparation and Validation
- Confirm acceptance criteria derived from [`update3/trading-procedure-master.md`](update3/trading-procedure-master.md).
- Map all consumers of [`scripts/trading-engine.js`](scripts/trading-engine.js) to scope integration changes.

### Phase 2 – Trading Engine Realignment
- Redesign the trading engine as a pipeline-oriented coordinator exposing season management and standardized merchant skill output.
- Remove legacy availability, pricing, haggling, and rumor logic once downstream consumers are migrated.

### Phase 3 – Pipeline Adjustments
- Extend [`scripts/cargo-availability-pipeline.js`](scripts/cargo-availability-pipeline.js) to emit complete slot data (slot plan, candidate weights, balance history, amount modifiers, quality breakdown, contraband rolls, pricing steps).
- Delete deprecated helpers (e.g., `_describeSkill`, personality selection) and ensure all modifiers are read from [`datasets/active/trading-config.json`](datasets/active/trading-config.json) and [`datasets/source-flags.json`](datasets/source-flags.json).

### Phase 4 – Configuration and Dataset Cleanup
- Prune unused sections (e.g., `merchantPersonalities`, legacy `merchantCount`) from [`datasets/active/trading-config.json`](datasets/active/trading-config.json) and add any missing master-defined parameters.
- Update cargo definitions in [`datasets/active/cargo-types.json`](datasets/active/cargo-types.json) with `basePrices`, seasonal data, and quality tiers; verify or create seasonal random cargo tables if required.
- Normalize settlement files under [`datasets/active/settlements/`](datasets/active/settlements/) to the orange-realism schema (add `source`, ensure consistent `size` encoding, validate garrison format).

### Phase 5 – Flow and UI Integration
- Refactor [`scripts/flow/BuyingFlow.js`](scripts/flow/BuyingFlow.js) to consume pipeline slot payloads exclusively and treat merchants as numeric skills.
- Update [`scripts/ui/TradingUIRenderer.js`](scripts/ui/TradingUIRenderer.js) to render the new slot metadata and remove personality references.
- Adjust application/dialog layers (e.g., [`scripts/trading-application-v2.js`](scripts/trading-application-v2.js), [`scripts/trading-dialog.js`](scripts/trading-dialog.js)) to route through the updated engine interfaces.

### Phase 6 – Automated Tests
- Update availability, pricing, and dataset integration tests to assert against pipeline-driven outputs.
- Run `npm test` and resolve failures iteratively.

### Phase 7 – Documentation and Handoff
- Document configuration changes, dataset migrations, and verification steps.
- Produce a validation checklist and note any deferred follow-up tasks.

## Risks and Mitigations
- **Risk:** Configuration drift during cleanup. **Mitigation:** Introduce temporary schema validation scripts before data edits.
- **Risk:** UI dependencies on legacy merchant fields. **Mitigation:** Audit renderer usage prior to removing personality data and provide fallback mapping during transition.

## Success Criteria
- Availability pipeline output matches master procedure for sample settlements.
- UI presents pipeline-derived cargo slots without legacy fallbacks.
- All automated tests pass with updated datasets and configuration.