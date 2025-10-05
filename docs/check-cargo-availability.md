# Check for Cargo Availability — End-to-end flow

This document describes, step-by-step, what happens when the "Check for cargo availability" button is pressed in the UI and how the trading engine fulfils the request.

Overview

- High-level entry point:
   - Trading UI: [`scripts/ui/TradingUIEventHandlers.js`](scripts/ui/TradingUIEventHandlers.js:360) (handler: _onCheckAvailability)

Preconditions

- The module is initialized and datasets are loaded (see [`scripts/main.js`](scripts/main.js:753) and [`scripts/data-manager.js`](scripts/data-manager.js:789)).
- A settlement is selected in the UI and a season is set (or defaults to spring).

Step-by-step execution

1) UI event — user clicks the "Check for cargo availability" button
   - The click is handled by `_onCheckAvailability()` inside [`scripts/ui/TradingUIEventHandlers.js`](scripts/ui/TradingUIEventHandlers.js:360).
   - The UI handler collects current inputs: selected settlement name, selected season, optional cargo filters, actor context, and any test roll options.

2) UI input validation & preparation
   - The handler validates the selection using local validators (e.g., `validateSelection` or `validateSettlementWithFeedback` in [`scripts/ui/TradingUIEventHandlers.js`](scripts/ui/TradingUIEventHandlers.js:278)).
    - If invalid, the UI shows validation errors and aborts.

3) Resolve settlement object
    - The UI calls into `TradingEngine`. Typical call paths:
       - `tradingEngine.performCompleteAvailabilityCheck(settlement, season, rollFunction)` — see [`scripts/trading-engine.js`](scripts/trading-engine.js:937)
       - Or `tradingEngine.checkCargoAvailability(settlement, rollFunction, options)` — see [`scripts/trading-engine.js`](scripts/trading-engine.js:268)
    - `_resolveSettlement(settlement)` maps a settlement name to the full object via [`scripts/data-manager.js`](scripts/data-manager.js:946) `getSettlement(name)`. Missing settlements throw errors.

4) Pipeline decision / feature flag
    - The constructor derives `pipelineEnabled`: `disablePipeline === true` forces it off; otherwise the flag is true when `enablePipeline` is explicitly true or an explicit `pipeline`/`pipelineFactory` is supplied (see [`scripts/trading-engine.js`](scripts/trading-engine.js:29)).
    - The initial `pipelineStatus` is `'pending'`. When the flag resolves to false, `pipelineStatus` becomes `'disabled'` and `_legacyCheckCargoAvailability()` runs immediately (`scripts/trading-engine.js`:282).

5) When pipeline is used: generateAvailabilityPlan
    - `TradingEngine.generateAvailabilityPlan({ settlement, season, forceRefresh })` is invoked (see [`scripts/trading-engine.js`](scripts/trading-engine.js:440)).
    - `_getPipeline()` discovers or constructs the pipeline in this order: reuse `this.pipeline` → call `pipelineFactory` → call `dataManager.getCargoAvailabilityPipeline()` → `safeRequire('./cargo-availability-pipeline.js')` → `window.CargoAvailabilityPipeline` (see [`scripts/trading-engine.js`](scripts/trading-engine.js:525)). Failure to discover a pipeline sets `pipelineStatus = 'unavailable'` and the engine falls back to the legacy path.

6) Cargo availability pipeline run
    - The pipeline (`CargoAvailabilityPipeline`) executes its `generatePlan` flow (see [`scripts/cargo-availability-pipeline.js`](scripts/cargo-availability-pipeline.js:1)):
       - `_ensureDataLoaded()` reads datasets and config.
       - `_buildSettlementContext(props, season)` normalizes flags and computes numeric size/wealth.
       - `_calculateMerchantSlots(props, flags, season)` returns slot multipliers with explanatory metadata.
       - `_buildCandidateTable(props, flags, season)` prepares weighted cargo candidates.
       - `_processSlot({ slotNumber, settlementProps, settlementFlags, candidateTable, season })` selects cargo, evaluates balance, quality, contraband, and price.
    - The pipeline returns a raw plan object containing `slots[]`, `slotPlan`, optional `candidateTable`, and metadata.

7) Plan standardization & caching
    - `TradingEngine._standardiseAvailabilityPlan(rawPlan, settlement, season)` normalizes plan shape and slot entries (see [`scripts/trading-engine.js`](scripts/trading-engine.js:487)).
    - Plans are cached in `planCache` using `_buildPlanCacheKey()` which concatenates the normalized season with an identifier resolved from `id → _id → uuid → key → name` (see [`scripts/trading-engine.js`](scripts/trading-engine.js:517)). Missing identifiers throw. Cache entries persist until `forceRefresh` is requested or `setCurrentSeason()` clears the cache.

8) Availability chance estimation
    - `TradingEngine._estimateAvailabilityChance(slotPlan, settlement)` returns:
       - `slotPlan.calculatedChance` if present;
       - otherwise `slotPlan.chance` if present;
       - otherwise `TradingEngine.calculateAvailabilityChance(settlement)` which uses `(sizeNumeric + wealthRating) × 10` capped at 100 (see [`scripts/trading-engine.js`](scripts/trading-engine.js:233)).

9) Dice roll for availability
    - `TradingEngine` performs a d100 roll:
       - If the caller passed a `rollFunction`, the engine awaits it; both synchronous and Promise-returning implementations are supported in `_legacyCheckCargoAvailability`, `_processAvailabilityPlan`, and `_rollCargoMultiplier`.
       - Otherwise `_processAvailabilityPlan` currently calls `rollAvailability(chance)` which forwards to `rollDice('1d100')`. Because `rollAvailability` expects a settlement object, this path throws without a custom `rollFunction`; legacy paths still call `rollDice('1d100')`, using Foundry's `Roll` class when available and `rollDiceFallback()` otherwise (`scripts/trading-engine.js`:1383-1411).
    - Dice results and decisions are logged via `scripts/debug-logger.js`.

10) Availability decision
      - The engine evaluates `available = (plan.slots.length > 0) && (roll <= chance)`.
      - The result includes: `available`, `chance`, `roll`, `rollResult`, `settlement`, `slotPlan`, `candidateTable`, and the full `plan` (`scripts/trading-engine.js`:428).

11) Determine cargo types (Step 2A)
      - If a plan with `slots` exists, `determineCargoTypes(settlement, season, { plan })` extracts cargoType names and deduplicates them (`scripts/trading-engine.js`:570).
      - Otherwise `_legacyDetermineCargoTypes()` maps settlement production categories and handles seasonal trade cargo.

12) Calculate cargo size (Step 2B)
      - `calculateCargoSize(settlement, rollFunction, { plan, season })` is called:
         - If `plan.slotPlan` provides overrides (`sizeMultiplier`, `multiplier`, or `totalSize`) the engine applies them.
         - Otherwise `_rollCargoMultiplier({ rollFunction, isTrade })` executes:
            - Perform 1d100 (or two rolls if the trade bonus applies) and round up to the nearest 10 to obtain a multiplier (e.g., 73 -> 80).
            - `multiplier × (sizeNumeric + wealthRating)` yields total Encumbrance Points.
         - Returns detailed breakdown including roll results and the `tradeBonus` flag (`scripts/trading-engine.js`:836).

13) Final result assembly
      - `performCompleteAvailabilityCheck()` aggregates the availability result, cargo types, and cargo size into a single structure returned to the UI (`scripts/trading-engine.js`:937).

14) UI rendering & side-effects
      - UI receives the result and calls rendering code:
         - Trading application: rendering helpers in [`scripts/ui/TradingUIRenderer.js`](scripts/ui/TradingUIRenderer.js:1).
         - Availability results renderer: [`scripts/availability-results-renderer.js`](scripts/availability-results-renderer.js:6).
      - The UI shows:
         - Availability badge (available/unavailable)
         - Rolled result and target chance
         - Candidate cargo types and sample merchants (from `plan.candidateTable`)
         - Estimated cargo size in EP and summary breakdown
         - Action buttons for buying (partial/all), reroll/desperation, or open merchant cards
      - Chat posting respects the `chatVisibility` setting (`game.settings.get('trading-places', 'chatVisibility')`). A value of `gm` whispers to the GM; `all` broadcasts. `TradingEngine.postChatMessage()` attempts Foundry's `ChatMessage.create` and falls back to a simple object in non-Foundry tests (`scripts/trading-engine.js`:1495, [`scripts/trading-application-v2.js`](scripts/trading-application-v2.js:626)).

15) Logging, persistence & hooks
      - Every step logs decisions and calculations via `WFRPDebugLogger` (`scripts/debug-logger.js`:72).
      - Successful plan generation sets `pipelineStatus = 'ready'` and caches the plan; failures set `pipelineStatus = 'error'` and rely on the logger (integrations may also populate `lastPipelineError`).
      - Hooks/events are triggered where appropriate (e.g., season changes call `Hooks.callAll("trading-places.seasonChanged", ...)`) via [`scripts/data-manager.js`](scripts/data-manager.js:1411).

Error handling & fallback paths

- `generateAvailabilityPlan()` logs errors, sets `pipelineStatus = 'error'`, and returns `null`, causing the engine to fall back to `_legacyCheckCargoAvailability()` (`scripts/trading-engine.js`:461-483).
- If dice rolling via Foundry fails, `rollDiceFallback()` is used to ensure deterministic behaviour (`scripts/trading-engine.js`:1411).
- Validation errors bubble up to the UI where `fallback-dialogs-v2.js` may present recovery dialogs.

Key files and functions (quick reference)

- UI handlers:
   - [`scripts/ui/TradingUIEventHandlers.js`](scripts/ui/TradingUIEventHandlers.js:360) — _onCheckAvailability
- Engine:
   - [`scripts/trading-engine.js`](scripts/trading-engine.js:268) — `checkCargoAvailability` / `performCompleteAvailabilityCheck`
   - [`scripts/trading-engine.js`](scripts/trading-engine.js:440) — `generateAvailabilityPlan`
- Pipeline:
   - [`scripts/cargo-availability-pipeline.js`](scripts/cargo-availability-pipeline.js:1) — `generatePlan` and helpers
- Data layer:
   - [`scripts/data-manager.js`](scripts/data-manager.js:789) — settlement lookups and pipeline access
- Logging & errors:
   - [`scripts/debug-logger.js`](scripts/debug-logger.js:72)
   - [`scripts/error-handler.js`](scripts/error-handler.js:15)

Pipeline lifecycle details

- `generateAvailabilityPlan()` may return `null` when the pipeline flag is off, discovery fails, the pipeline throws, or the plan fails validation. In every case the legacy algorithm is used.
- Plan fragments (`slotPlan`, `candidateTable`, `slots`) are optional; callers must guard against `plan === null` or partial plans.
- Diagnostics should review `pipelineStatus`, cached plans in `planCache`, optional `lastPipelineError`, and logger output.
- When a `rollFunction` is supplied, `forceRefresh` is set to `true` so the plan cache is bypassed for deterministic rerolls.
- `checkCargoAvailability()` routes to `_legacyCheckCargoAvailability()` when the pipeline flag is false and `options.plan` is omitted, short-circuits to `_processAvailabilityPlan()` when `options.plan` is provided, and otherwise executes the pipeline path with legacy fallback (`scripts/trading-engine.js`:268-358).

Roll function contract

- `rollFunction` arguments can be synchronous or return Promises; the engine awaits promise-like results in `_legacyCheckCargoAvailability`, `_processAvailabilityPlan`, `_processCargoSizePlan`, and `_rollCargoMultiplier`.
- Trade settlements still trigger the second roll in `_rollCargoMultiplier`, regardless of whether the supplied roll function is sync or async.
- `_processAvailabilityPlan` currently forwards the numeric `chance` into `rollAvailability()`, which expects a settlement object. Provide a custom `rollFunction` when exercising the pipeline until that call signature is corrected.
- Dice rolls without Foundry fall back to `rollDiceFallback()`, yielding deterministic objects suitable for tests.

Returned object shapes

- `checkCargoAvailability()` returns `{ available, chance, roll, rollResult, settlement, slotPlan?, candidateTable?, plan? }`. Example: availabilityResult = { available: true, chance: 65, roll: 34, settlement: 'Altdorf', slotPlan: {...}, candidateTable: [...], plan: {...} }.
- `performCompleteAvailabilityCheck()` returns `{ available, availabilityCheck, cargoTypes, cargoSize }`. Example: completeResult = { available: true, availabilityCheck: availabilityResult, cargoTypes: ['Grain', 'Wool'], cargoSize: { totalSize: 640, sizeMultiplier: 80 } }.

Deterministic testing helpers

- Mock pipeline example: pipeline.generatePlan = () => ({ slots: [{ cargoType: 'Grain' }], slotPlan: { calculatedChance: 55, sizeMultiplier: 80 } }).
- Async roll function example: rollFunction = async () => 42.
- Pipeline failure fallback: pipeline.generatePlan = () => { throw new Error('boom'); } to assert the legacy path is used.

Chat posting behaviour

- `TradingEngine.postChatMessage()` attempts `ChatMessage.create()` and falls back to `{ content, speaker, type, posted: true, fallback: true }` when Foundry APIs are absent (`scripts/trading-engine.js`:1495).
- UI integrations read `chatVisibility` to decide whether messages whisper to GMs or broadcast to all players (see [`scripts/trading-application-v2.js`](scripts/trading-application-v2.js:626)).

Example unit test checklist

- Pipeline success with deterministic plan and synchronous rollFunction.
- Pipeline error that forces `_legacyCheckCargoAvailability()`.
- Trade settlement cargo size with double-roll multiplier handling.

References

- Core implementation: [`scripts/trading-engine.js`](scripts/trading-engine.js:1)
- Pipeline implementation: [`scripts/cargo-availability-pipeline.js`](scripts/cargo-availability-pipeline.js:1)
- UI entry points: [`scripts/simple-trading-v2.js`](scripts/simple-trading-v2.js:235), [`scripts/trading-dialog-enhanced.js`](scripts/trading-dialog-enhanced.js:417)