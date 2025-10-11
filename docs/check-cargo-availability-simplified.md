# Check for Cargo Availability — End-to-end Flow (Simplified)

This document explains, step by step, what happens when you click the "Check for cargo availability" button in the trading interface and how the system decides what cargo is available.

## Overview

- Main entry point: The trading interface handles the button click and starts the availability check process.

## Prerequisites

- The trading module must be loaded and ready.
- You need to have selected a settlement and set the current season (defaults to spring if not set).

## Step-by-Step Process

1) **User clicks the button**
   - The interface detects the click and starts checking for available cargo.
   - It gathers the selected settlement, season, and any other settings.

   **Technical details:**
   - Handled by `_onCheckAvailability()` in `scripts/ui/TradingUIEventHandlers.js`, which delegates to `BuyingFlow.onCheckAvailability()`.

2) **Validate inputs**
   - The system checks if a settlement is selected and valid.
   - If something is wrong, it shows an error and stops.

   **Technical details:**
   - Uses `validateSettlementWithFeedback` from `scripts/trading-application-v2.js` or mixins.

3) **Choose how to check availability**
   - The system requires the cargo availability pipeline and will use it to determine availability.
   - If the pipeline is missing or fails, the availability check stops with an error; there is no automatic fallback to the legacy trading engine.

   **Technical details:**
   - `BuyingFlow.onCheckAvailability()` checks `this.cargoAvailabilityPipeline` (provided by `DataManager.getCargoAvailabilityPipeline()` during app startup) and invokes it. If the pipeline is not present or throws, the method now throws an error to signal the missing pipeline rather than calling `tradingEngine.performCompleteAvailabilityCheck()`.

4) **Run the cargo pipeline (main method)**
   The pipeline run produces a short, ordered set of results. Below is what is generated and in what order, described in plain language for a non-technical reader.

   1. A market roll for logging and chat
      - A single dice roll is made to record the market's availability test; this is shown in chat for flavor and logs.

   2. The pipeline's main response
      - The pipeline returns a single result that contains a list of "slots" — each slot represents one available batch or lot of cargo.

   3. Individual slot records
      - For each slot the pipeline decides and records:
        - Which item/cargo it is (name and category)
        - How much is present (total quantity expressed as encumbrance points)
        - Price information for that slot (base and final prices)
        - The quality/tier of the goods (for example "good", "average", "poor")
        - Whether the lot is contraband or has special flags

   4. Pricing and quality finalized per slot
      - The pipeline finalizes prices and quality for the slot before returning it.

   5. Enrichment for display
      - The returned slots are supplemented with display-friendly details such as per-unit encumbrance and a merchant to present to the player. (Merchants may be provided by the pipeline or created as part of display enrichment.)

   6. Final, display-ready cargo entries
      - Each slot is converted into a final display item that includes name, category, price, quantity, quality, encumbrance, and an associated merchant. These are what the UI shows as available cargo options.

   7. Availability summary for the UI
      - A short availability summary is produced (was the market available, what was the roll and the computed chance) along with the list of display-ready cargo entries.

   Note: The pipeline is the authoritative source for which cargo exists and its quantities/prices; the UI only converts those results into a format suitable for presentation to the player.

5) **Fallback to trading engine (alternative method)**
   - If pipeline fails, uses the standard engine to check availability.
   - The engine may try its own pipeline or use legacy methods.
   - Discovers and runs the pipeline internally if possible.

   **Technical details:**
   - The pipeline prepares a settlement context, works out how many cargo slots should exist, builds a weighted table of candidate goods, and constructs slot records that include pricing, quantity, quality, balance state, and any contraband notes.

5) **Roll availability for each slot**
   - The interface rolls a d100 for every slot to see whether that candidate actually turns into cargo for sale.
   - Rolls that are equal to or below the settlement's availability chance succeed; failed rolls simply leave the slot empty and the system moves on to the next slot.
   - If every slot fails its availability roll, the outcome is "no cargo available" for that settlement.

   **Technical details:**
   - The availability chance comes from settlement size and wealth (converted to a percentage and capped at 100%). Each roll is posted to chat if visibility allows and stored with the slot outcome for later display/logging.

6) **Build the available cargo list**
   - Successful slots are enriched with display-friendly details and merchants.
   - Pricing, quantity, and quality from the pipeline slot are kept; encumbrance information comes from the data manager; merchants are generated (or pipeline-supplied) so the UI can show who is selling the goods.

   **Technical details:**
   - For each successful slot, the interface converts the slot data into a final cargo entry that contains item name, category, pricing, total encumbrance, quality tier, contraband flag, and a merchant profile. Failed slots are skipped entirely.

7) **Show results and notify players**
   - The application stores the final list, updates the availability banner, and shows the detailed cargo table.
   - Notifications and optional chat messages summarize the result. If every slot failed, the UI clearly marks that no goods are available.

   **Technical details:**
   - The renderer receives both the slot outcomes and the successful cargo entries so it can display counts, quantities, and any contraband notes, as well as highlight the rolls that succeeded or failed.

## Error Handling

- Pipeline failures are surfaced directly to the user with an error notification; no legacy path runs afterward.
- Validation issues (missing settlement, invalid data, season not configured) still show friendly dialogs and stop the process early.
- Dice rolls use Foundry's safe evaluation so errors in rolling are reported without crashing the application.

**Technical details:**
- The availability flow wraps the pipeline call in a try/catch. On error it clears any stored cargo, restores the UI state, and shows a notification. No secondary engine-based fallback is invoked.

## Key Files and Functions

- UI: `scripts/ui/TradingUIEventHandlers.js` (button wiring), `scripts/flow/BuyingFlow.js` (main logic).
- Engine: `scripts/trading-engine.js` (core checks).
- Pipeline: `scripts/cargo-availability-pipeline.js`.
- Data: `scripts/data-manager.js`.
- Logging: `scripts/debug-logger.js`, `scripts/error-handler.js`.

## Pipeline Details

- Shared pipeline instance from DataManager.
- Plans cached unless refreshed.
- Roll functions support sync/async.

**Technical details:**
- `DataManager.getCargoAvailabilityPipeline()` caches instance. `generateAvailabilityPlan()` returns null on failure. Cache bypass with `rollFunction`. Routing: legacy if flag false, process plan if provided, else pipeline with fallback (`scripts/trading-engine.js:268-358`).

## Roll Function Details

- Can be sync or async; awaited in multiple places.
- Trade settlements may roll twice.
- Fallback for missing Foundry.

**Technical details:**
- Awaited in `_legacyCheckCargoAvailability`, `_processAvailabilityPlan`, `_processCargoSizePlan`, `_rollCargoMultiplier`. Trade triggers second roll. `_processAvailabilityPlan` forwards chance to `rollAvailability()` (expects settlement). Fallback: `rollDiceFallback()`.

## Result Formats

- Availability check: `{ available, chance, roll, ... }`.
- Complete check: `{ available, availabilityCheck, cargoTypes, cargoSize }`.

**Technical details:**
- `checkCargoAvailability()`: `{ available, chance, roll, rollResult, settlement, slotPlan?, candidateTable?, plan? }`. `performCompleteAvailabilityCheck()`: `{ available, availabilityCheck, cargoTypes, cargoSize }`.

## Testing Helpers

- Mock pipelines for deterministic results.
- Async roll examples.

**Technical details:**
- Mock: `pipeline.generatePlan = () => ({ slots: [{ cargoType: 'Grain' }], slotPlan: { calculatedChance: 55, sizeMultiplier: 80 } })`. Async: `rollFunction = async () => 42`. Failure: throw error to trigger legacy.

## Chat Behavior

- Posts messages based on visibility setting.
- Falls back if Foundry unavailable.

**Technical details:**
- `TradingEngine.postChatMessage()` tries `ChatMessage.create()`, else `{ content, speaker, type, posted: true, fallback: true }` (`scripts/trading-engine.js:1495`). Visibility: `gm` whispers GM, `all` broadcasts (`scripts/trading-application-v2.js:626`).

## Test Checklist

- Pipeline success/failure.
- Trade settlement handling.

**Technical details:**
- Success with plan/rollFunction. Error forces legacy. Double-roll for trade.

## References

- Core: `scripts/trading-engine.js`.
- Pipeline: `scripts/cargo-availability-pipeline.js`.
- UI: `scripts/ui/TradingUIEventHandlers.js`, `scripts/flow/BuyingFlow.js`.