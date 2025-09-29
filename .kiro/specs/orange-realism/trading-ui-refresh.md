# Trading UI Refresh Specification

## Overview
Redesign the trading application to fully expose the new orange-realism mechanics (population-derived sizing, supply/demand equilibrium, desperation rerolls). The first milestone focuses on the Buyer flow, ensuring the GM can select a settlement, generate availability, review merchant offers, trigger rerolls, and complete purchases without touching datasets manually.

## Key Goals
- Surface settlement context (population, wealth, flags, produces/demands, garrison snapshot) directly in the dialog.
- Display equilibrium-driven availability so players understand why goods are abundant or scarce.
- Provide clear controls for desperation rerolls and reflect the penalties applied.
- Support full and partial purchases (with future partial-penalty logic behind a feature flag).
- Keep the layout compatible with Foundry VTT’s application frame and responsive within common screen sizes.

## Layout Sketch
1. **Header Panel**
   - Settlement name, region, population-derived size, wealth, flags (with tooltips), produces/demands preview.
   - Button to open the data authoring UI (GM only).

2. **Equilibrium Summary Strip**
   - Horizontal list of cargo types showing supply/demand bars (e.g., surplus vs shortage percentages).
   - Clicking a cargo filters merchants to that type.

3. **Merchant List**
   - Cards for each generated Producer: cargo icon/name, quantity, base price, applied modifiers (flag, season, desperation), merchant skill hint.
   - Badge if availability came from a desperation reroll.
   - Actions: “Buy All”, “Buy Custom Amount”, “Skip”.

4. **Desperation Control**
   - If an availability roll fails, show a call-to-action explaining the reroll trade-off with the configured penalties.
   - Allow one reroll per failed slot (respect config limits).

5. **Transaction Log**
   - Inline history of purchases made during the current visit (cargo, amount, price, merchant id).
   - Links to undo (if allowed) or open chat output.

## Interaction Flow
1. **Arrival**
   - Player picks settlement → UI loads context from DataManager/SystemAdapter.
   - Equilibrium summary pre-populated using `produces`/`demands` plus flag/season effects.

2. **Availability Generation**
   - On “Check Availability”, run the cargo availability procedure.
   - Log rolls in the transaction log (optional detail toggle).
   - Populate merchant list with results.

3. **Desperation Reroll**
   - For each failed slot, present a button with penalty summary (e.g., “Reroll at +20% price / −30% quantity”).
   - On confirm, re-run availability for that slot, apply penalties, update merchant card with desperation badge.

4. **Purchasing**
   - “Buy All” immediately processes the trade via SystemAdapter, closes the card (moves to log).
   - “Buy Custom Amount” opens a numeric input (validate against available quantity).
   - After purchase: update cargo availability, player inventory, and equilibrium snapshot.

5. **Exit**
   - Closing the dialog preserves state for the session unless the GM triggers a refresh.

## Technical Notes
- Reuse existing Handlebars templates where possible; build new partials for equilibrium bars and merchant modifiers.
- Data flow: UI requests availability from the trading engine, receives structured merchant objects, renders via template.
- Ensure accessibility basics: tooltip descriptions, keyboard navigation, ARIA labels for new controls.

## Testing Checklist
- Settlement context renders correctly for small/large populations and multiple flags.
- Availability generation displays correct number of merchants per config and settlement data.
- Desperation reroll button appears only when appropriate and applies penalties.
- Purchases update player inventory, merchant list, and transaction log in sync.
- Partial purchase flow respects quantity validation.
- UI behaves within Foundry’s window constraints (no overflow, scrollbars as needed).

## Out of Scope / Future Enhancements
- Seller flow refresh (mirror UI for unloading cargo).
- Rumor mode integration.
- Mission/contract surfacing.
- Visual theming overhaul beyond layout adjustments.
