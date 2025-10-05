# Check for Cargo Availability — End-to-end flow

This document describes, step-by-step, what happens when the "Check for cargo availability" button is pressed in the UI.

Overview

- High-level entry points:
  - Simple trading UI: [`scripts/simple-trading-v2.js`](scripts/simple-trading-v2.js:235) (handler: _onCheckAvailability)
  - Enhanced trading dialog: [`scripts/trading-dialog-enhanced.js`](scripts/trading-dialog-enhanced.js:417) (handler: _onGenerateAvailability)

Preconditions

- The module is initialized and datasets are loaded (see [`scripts/main.js`](scripts/main.js:753) and [`scripts/data-manager.js`](scripts/data-manager.js:789).
- A settlement is selected in the UI and a season is set (or defaults to spring).

Step-by-step execution

1) UI event — user clicks the "Check for cargo availability" button
   - The click is handled by a UI listener in either:
     - [`scripts/simple-trading-v2.js`](scripts/simple-trading-v2.js:235) -> method _onCheckAvailability()
     - OR [`scripts/trading-dialog-enhanced.js`](scripts/trading-dialog-enhanced.js:417) -> method _onGenerateAvailability()
   - The UI handler collects current inputs: selected settlement name, selected season, optional cargo filters, actor context, and any test roll options.

2) UI input validation & preparation
   - The handler validates selection using local validators (e.g., validateSelection or validateSettlementWithFeedback in [`scripts/trading-dialog-enhanced.js`](scripts/trading-dialog-enhanced.js:278) or [`scripts/simple-trading-v2.js`](scripts/simple-trading-v2.js:242)).
   - If invalid, the UI shows validation errors and aborts.

3) Resolve settlement object
   - The UI calls into the business logic layer: an instance of `TradingEngine` is invoked. Typical call paths:
     - `tradingEngine.performCompleteAvailabilityCheck(settlement, season, rollFunction)` — see [`scripts/trading-engine.js`](scripts/trading-engine.js:937)
     - Or `tradingEngine.checkCargoAvailability(settlement, rollFunction, options)` — see [`scripts/trading-engine.js`](scripts/trading-engine.js:268)
   - Inside `TradingEngine`, `_resolveSettlement(settlement)` maps a settlement name to the full settlement object via [`scripts/data-manager.js`](scripts/data-manager.js:946) `getSettlement(name)`. Errors are thrown if settlement cannot be found.

4) Pipeline decision / feature flag
   - `TradingEngine` checks whether the cargo-availability pipeline is enabled:
     - `this.pipelineEnabled` is set during construction or via options (see [`scripts/trading-engine.js`](scripts/trading-engine.js:36)).
   - If pipeline is disabled or unavailable, execution falls back to legacy logic (`_legacyCheckCargoAvailability`) in [`scripts/trading-engine.js`](scripts/trading-engine.js:282).

5) When pipeline is used: generateAvailabilityPlan
   - `TradingEngine.generateAvailabilityPlan({ settlement, season, forceRefresh })` is called (see [`scripts/trading-engine.js`](scripts/trading-engine.js:440)).
   - `_getPipeline()` resolves or constructs the pipeline instance:
     - It prefers an explicit `this.pipeline` or `this.pipelineFactory`.
     - Falls back to `dataManager.getCargoAvailabilityPipeline()` or requiring `./cargo-availability-pipeline.js` (see [`scripts/trading-engine.js`](scripts/trading-engine.js:535)).

6) Cargo availability pipeline run
   - The pipeline implementation (`CargoAvailabilityPipeline`) executes its run/ generatePlan flow (see [`scripts/cargo-availability-pipeline.js`](scripts/cargo-availability-pipeline.js:1)):
     - Ensure config/data loaded: `_ensureDataLoaded()` reads datasets and configs.
     - Build settlement context: `_buildSettlementContext(props, season)` normalizes flags and computes numeric size/wealth.
     - Calculate merchant/slot model: `_calculateMerchantSlots(props, flags, season)` returns slot multipliers and why (traceable logs).
     - Build candidate table: `_buildCandidateTable(props, flags, season)` — weighted cargo candidates and selection heuristics.
     - Process slots: `_processSlot({ slotNumber, settlementProps, settlementFlags, candidateTable, season })` to select cargo, evaluate balance, quality, contraband, and price.
   - The pipeline returns a raw plan object: slots[], slotPlan, candidateTable, and metadata.

7) Plan standardization & caching
   - `TradingEngine._standardiseAvailabilityPlan(rawPlan, settlement, season)` normalizes plan shape and slot entries (see [`scripts/trading-engine.js`](scripts/trading-engine.js:487)).
   - The plan is cached in `this.planCache` keyed by season::settlement identifier (`_buildPlanCacheKey`) for fast subsequent checks (`scripts/trading-engine.js` 517).

8) Availability chance estimation
   - When processing a plan, `TradingEngine._estimateAvailabilityChance(slotPlan, settlement)` returns:
     - `slotPlan.calculatedChance` if present;
     - otherwise falls back to `TradingEngine.calculateAvailabilityChance(settlement)` which uses the legacy formula: `(sizeNumeric + wealthRating) × 10` capped at 100 (see [`scripts/trading-engine.js`](scripts/trading-engine.js:233)).

9) Dice roll for availability
   - `TradingEngine` performs a d100 roll:
     - If the caller passed a `rollFunction`, it is used (useful for deterministic tests).
     - Otherwise `TradingEngine.rollAvailability()` or `TradingEngine.rollDice('1d100')` is used. If Foundry's `Roll` class exists it will be invoked; otherwise `rollDiceFallback()` is used (`scripts/trading-engine.js` 1411).
   - The roll is logged via the logging subsystem (`scripts/debug-logger.js`).

10) Availability decision
   - The engine evaluates `available = (plan.slots.length > 0) && (roll <= chance)`.
   - The result includes: available(Boolean), chance(number), roll(number), rollResult(object), settlement(name), slotPlan, candidateTable, and the full plan object (`scripts/trading-engine.js` 428).

11) Determine cargo types (Step 2A)
   - If a plan with `slots` exists, `determineCargoTypes(settlement, season, { plan })` extracts cargoType names from `plan.slots` (`scripts/trading-engine.js` 570).
   - If no plan or empty slots, `TradingEngine._legacyDetermineCargoTypes()` maps settlement production categories to cargo names via a mapping table and random trade cargo for 'Trade' flags.

12) Calculate cargo size (Step 2B)
   - `calculateCargoSize(settlement, rollFunction, { plan, season })` is called:
     - If `plan.slotPlan` provides overrides (`sizeMultiplier` or `totalSize`) the engine applies them.
     - Otherwise `_rollCargoMultiplier({ rollFunction, isTrade })` executes:
       - Perform 1d100 (or two rolls if trade bonus applies) and round up to nearest 10 to produce a multiplier (e.g., 73 -> 80).
       - `multiplier` × `baseMultiplier` (`sizeNumeric + wealthRating`) gives totalEncumbrancePoints.
     - Returns detailed breakdown including roll results and tradeBonus flag (`scripts/trading-engine.js` 836).

13) Final result assembly
   - `performCompleteAvailabilityCheck()` aggregates availability result, cargoTypes (Step 2A), and cargoSize (Step 2B) into a single result structure returned to the UI (`scripts/trading-engine.js` 937).

14) UI rendering & side-effects
   - UI receives the result and calls rendering code:
     - Enhanced dialog: `EnhancedTradingDialog._processBuyTransaction` and rendering helpers in [`scripts/trading-dialog-enhanced.js`](scripts/trading-dialog-enhanced.js:494).
     - Availability results renderer: [`scripts/availability-results-renderer.js`](scripts/availability-results-renderer.js:6).
   - The UI shows:
     - Availability badge (available/unavailable)
     - Rolled result and target chance
     - Candidate cargo types and sample merchants (from plan.candidateTable)
     - Estimated cargo size in EP and summary breakdown
     - Action buttons for buying (partial/all), reroll/desperation, or open merchant cards

15) Logging, persistence & hooks
   - Every step logs decisions and calculations via `WFRPDebugLogger` (`scripts/debug-logger.js` 72).
   - The plan is cached for the session in `TradingEngine.planCache`.
   - Hooks/events are triggered where appropriate (e.g., season changes call `Hooks.callAll("trading-places.seasonChanged", ...)`) via [`scripts/data-manager.js`](scripts/data-manager.js:1411).
   - If the UI chooses to post to chat, `TradingEngine.postChatMessage()` will call Foundry Chat APIs or return a fallback message object (`scripts/trading-engine.js` 1495).

Error handling & fallback paths

- Pipeline errors are caught: `generateAvailabilityPlan()` will log and return `null`, causing the engine to fall back to legacy logic (`_legacyCheckCargoAvailability`) (`scripts/trading-engine.js` 461).
- If dice rolling via Foundry fails, `rollDiceFallback()` is used to ensure deterministic behavior in tests and offline usage (`scripts/trading-engine.js` 1411).
- Validation errors bubble up to the UI where `fallback-dialogs-v2.js` may present helpful recovery dialogs.

Key files and functions (quick reference)

- UI handlers:
  - [`scripts/simple-trading-v2.js`](scripts/simple-trading-v2.js:235) — _onCheckAvailability
  - [`scripts/trading-dialog-enhanced.js`](scripts/trading-dialog-enhanced.js:417) — _onGenerateAvailability
- Engine:
  - [`scripts/trading-engine.js`](scripts/trading-engine.js:268) — checkCargoAvailability / performCompleteAvailabilityCheck
  - [`scripts/trading-engine.js`](scripts/trading-engine.js:440) — generateAvailabilityPlan
- Pipeline:
  - [`scripts/cargo-availability-pipeline.js`](scripts/cargo-availability-pipeline.js:1) — run / _processSlot / _buildCandidateTable
- Data layer:
  - [`scripts/data-manager.js`](scripts/data-manager.js:789) — getSettlement / getSettlementProperties / getCargoAvailabilityPipeline
- Logging & errors:
  - [`scripts/debug-logger.js`](scripts/debug-logger.js:72)
  - [`scripts/error-handler.js`](scripts/error-handler.js:15)

Notes for maintainers

- Fixes and clarifications to apply to this document (implementation source: [`scripts/trading-engine.js`](scripts/trading-engine.js:1)):
  1. Pipeline activation & discovery
     - Make explicit that `pipelineEnabled` is determined from constructor options and the presence of an explicit pipeline/pipelineFactory (see constructor behavior in [`scripts/trading-engine.js`](scripts/trading-engine.js:36)).
     - Document `_getPipeline()` discovery order and fallbacks: explicit `this.pipeline` → `pipelineFactory` → `dataManager.getCargoAvailabilityPipeline()` → safe-require of `./cargo-availability-pipeline.js` → `window.CargoAvailabilityPipeline` (see [`scripts/trading-engine.js`](scripts/trading-engine.js:525)). Note that `_getPipeline()` may set `pipelineStatus` to 'disabled', 'unavailable', or 'ready' depending on outcome.
  2. Async rollFunction support
     - Call out that any `rollFunction` passed by callers may be synchronous or return a Promise. The engine checks for Promise-like results and awaits them (see `_legacyCheckCargoAvailability` and `_rollCargoMultiplier` for examples around [`scripts/trading-engine.js`](scripts/trading-engine.js:327) and [`scripts/trading-engine.js`](scripts/trading-engine.js:836)). Tests and examples should show both synchronous and async rollFunctions.
  3. Returned object shapes and examples
     - Add a short "Returned object shapes" section describing the concrete keys returned by availability checks and the complete check:
       - availabilityResult: { available, chance, roll, rollResult, settlement, slotPlan?, candidateTable?, plan? }
       - performCompleteAvailabilityCheck result: { available, availabilityCheck, cargoTypes, cargoSize }
     - Provide a brief single-line example for each (no code block) so maintainers can write deterministic tests more easily.
  4. Plan nullability & fields
     - State that `generateAvailabilityPlan()` may return `null` (pipeline disabled/unavailable or pipeline.generatePlan failed). Document that callers must handle `plan === null`, and that `slotPlan` and `candidateTable` may be absent even when a plan object exists (see `generateAvailabilityPlan` error handling and `_standardiseAvailabilityPlan` in [`scripts/trading-engine.js`](scripts/trading-engine.js:440) and [`scripts/trading-engine.js`](scripts/trading-engine.js:487)).
  5. Plan cache key semantics
     - Explain exactly how `_buildPlanCacheKey()` constructs the key using settlement.id || settlement._id || settlement.uuid || settlement.key || settlement.name and the normalized season (see [`scripts/trading-engine.js`](scripts/trading-engine.js:517)). Warn that settlements without stable IDs will cause caching errors.
  6. Pipeline error behavior & diagnostics
     - Note that `generateAvailabilityPlan()` sets `pipelineStatus = 'error'` on failures and logs via the logger; it returns `null` so the engine falls back to legacy logic (see [`scripts/trading-engine.js`](scripts/trading-engine.js:469)–[`scripts/trading-engine.js`](scripts/trading-engine.js:483)). Add a short troubleshooting checklist: check `pipelineStatus`, `planCache`, `lastPipelineError` (if available via integration), and logger outputs.
  7. Force-refresh semantics
     - Clarify that `forceRefresh` bypasses the plan cache and is set `true` when a caller supplies a `rollFunction` for deterministic rerolls (see usage in `_checkCargoAvailabilityWithPipeline` and `generateAvailabilityPlan` [`scripts/trading-engine.js`](scripts/trading-engine.js:358) and [`scripts/trading-engine.js`](scripts/trading-engine.js:453)).
  8. Pipeline vs legacy decision points
     - Make explicit that `checkCargoAvailability()` will:
       - use `_legacyCheckCargoAvailability()` when `pipelineEnabled` is false and no explicit `options.plan` is supplied,
       - use `_processAvailabilityPlan()` when `options.plan` is supplied (short-circuit),
       - otherwise call the pipeline path which may fall back to legacy on pipeline failure (see [`scripts/trading-engine.js`](scripts/trading-engine.js:268)–[`scripts/trading-engine.js`](scripts/trading-engine.js:280) and [`scripts/trading-engine.js`](scripts/trading-engine.js:358)).
  9. Deterministic testing guidance
     - Add a short example (plain text) describing how to mock a pipeline for tests (provide pipeline object with `generatePlan()` that returns a deterministic plan with a `slots` array and `slotPlan`) and how to pass an async `rollFunction` to make checks deterministic.
 10. Chat posting and UI flags
     - Mention that `postChatMessage()` attempts to call Foundry Chat APIs and falls back to a simple object for non-Foundry testing (see [`scripts/trading-engine.js`](scripts/trading-engine.js:1495)). If the module or UI exposes a chat-visibility setting, document how the UI toggles use of chat posting.
 11. Minor wording fixes
     - Replace any binary phrasing "pipeline is enabled" with conditional wording that reflects discovery logic (enabled + available).
     - Add a short "Example unit test checklist" listing the three essential test cases: pipeline-success, pipeline-error→legacy, trade double-roll cargo size.

- Recommended next action
  - Update this document in-place to include the items above and one deterministic example plan + an async rollFunction snippet in plain text so maintainers can copy them into tests.
  - After updating, add two integration tests:
    - Mock pipeline (generatePlan returns deterministic plan) + sync rollFunction → assert availabilityResult and cargoSize structure.
    - Mock pipeline that throws → assert engine falls back to legacy path and returns expected shape.

- References
  - Core implementation: [`scripts/trading-engine.js`](scripts/trading-engine.js:1)
  - Pipeline implementation: [`scripts/cargo-availability-pipeline.js`](scripts/cargo-availability-pipeline.js:1)
  - UI entry points: [`scripts/simple-trading-v2.js`](scripts/simple-trading-v2.js:235), [`scripts/trading-dialog-enhanced.js`](scripts/trading-dialog-enhanced.js:417)

End of document.