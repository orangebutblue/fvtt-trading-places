# Currency Integration Implementation Plan

## Objectives
- Apply the new currency configuration (canonical BP unit and denominations) across buying, selling, and display flows.
- Preserve integer arithmetic for all currency calculations to avoid floating-point drift.
- Ensure UI reflects formatted currency strings that respect config display rules.
- Maintain compatibility with Foundry VTT v13+ and existing dataset validation.

## Scope & Constraints
- Touch only runtime logic tied to currency math (engine, flows, adapters, UI renderers) and necessary tests.
- Keep `trading-engine.js` pure; introduce helpers instead of inlining Foundry calls.
- Reuse `DataManager` to load currency config rather than reading JSON directly.
- Avoid regressions in existing buying/selling behaviour and sold-out handling.
- Add tests where behaviour changes or new helpers are introduced.

## Work Breakdown
1. **Currency Helpers**
   - Create `scripts/currency-utils.js` to encapsulate load, conversion, and formatting functions.
   - Functions: `convertToCanonical`, `convertFromCanonical`, `formatCurrency`, `sumValues` (all integer-based).
   - Write unit tests under `tests/` (e.g., `tests/currency-utils.test.js`) using existing fixture patterns.

2. **Data Access Integration**
   - Extend `DataManager` (or add wrapper method) to expose currency config in a cached, validated form.
   - Provide invalidation hook if config changes (align with existing dataset caching patterns).

3. **Trading Engine Updates**
   - Ensure buying/selling algorithms operate on canonical BP integers.
   - Replace any direct denomination math with helper calls.
   - Add targeted tests to confirm rounding/availability remain correct.

4. **System Adapter Adjustments**
   - Update currency-related Foundry interactions to use canonical BP when reading/writing actor funds.
   - Introduce conversion to display denominations when presenting to Foundry APIs or chat logs.
   - Mock Foundry behaviour in adapter tests to verify conversions.

5. **UI Rendering & Interaction**
   - Modify `TradingUIRenderer` (and related flow handlers) to display formatted strings from `formatCurrency`.
   - Update purchase/sale confirmations and tooltips to use new helper outputs.
   - Ensure sold-out and availability banners show converted values.

6. **Testing & Validation**
   - Expand Jest coverage to include new helper functions, adapter conversion behaviour, and UI formatting snapshots if needed.
   - Run `npm test` and relevant dataset validators to confirm compatibility.

## Verification Checklist
- Currency conversions remain accurate across multiple denominations (GC/SS/BP).
- Buying reduces funds correctly and displays updated totals in UI and logs.
- Selling rewards apply correct amounts and format text properly.
- Dataset validation succeeds without schema changes.
- No regressions in existing availability or sold-out logic (manual smoke test in Foundry recommended).

## Rollout Notes
- Documentation: Update `README.md` or dedicated docs to reference BP canonical model.
- Communicate the new currency helper usage to contributors to avoid bypassing the abstraction.
- Consider follow-up task to allow alternate currency configs via dataset swapping.
