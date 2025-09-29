# Phase 4 – Data Authoring & UI Tooling

## Intent
Deliver end-user tooling so GMs can manage trading datasets inside Foundry and expose the new merchant mechanics through an updated trading dialog. This phase combines the data authoring UI with the Buyer flow refresh.

## Outcomes
- In-app editor covering settlements, cargo types, flags, and related metadata with validation and diff previews.
- Trading dialog that visualizes settlement context, supply/demand equilibrium, merchant details, and desperation rerolls.
- End-to-end Buyer pipeline (arrival → availability generation → optional reroll → purchase) functional via the UI.

## Task Breakdown

### 1. Data Authoring UI (refer to `data-authoring-ui.md` for detailed requirements)
- Implement the “Data Management” application:
  - Tabs for Settlements and Cargo Types with searchable lists.
  - Detail forms generated from DataManager schema metadata.
  - Multi-select controls for flags and produces/demands fed by live datasets.
  - Support for arbitrary object/array editing, including drag-to-reorder where appropriate.
- Draft management:
  - Edits mutate a local clone; stage changes until “Save” is pressed.
  - JSON diff preview before persisting.
  - Inline validation using DataManager validators; block save on errors.
- Persistence:
  - Use DataManager save helpers to write files atomically.
  - Refresh caches and broadcast change events after successful save.
  - Provide undo-to-last-saved action.
- Access control: restrict to GM users; show read-only warning otherwise.

### 2. DataManager Enhancements
- Expose schema metadata describing field types, constraints, and relationships for settlements, cargo, flags.
- Provide CRUD helpers consumed by the editor (create, update, delete entries).
- Ensure changes immediately visible to running module (e.g., through cache invalidation or live reload hooks).

### 3. Trading Dialog Refresh (refer to `trading-ui-refresh.md`)
- Update Handlebars templates and styling:
  - Settlement header with region, population size, wealth, flags, produces/demands summary, and garrison snapshot.
  - Equilibrium summary bar to visualize supply vs demand per cargo.
  - Merchant cards showing cargo, quantity, base price, modifiers, skill hint, and desperation badge.
  - Desperation reroll prompt for failed slots with penalty summary.
  - Transaction log tracking purchases during the session.
- Wire UI to the new trading engine outputs:
  - Fetch availability data through trading engine APIs established in Phase 3.
  - React to purchases by updating merchant cards and equilibrium display.
  - Support “Buy All” and “Buy Custom Amount” interactions (partial trade penalties toggled off until future phase).
- Ensure responsive behavior within Foundry window constraints; add scroll regions where necessary.

### 4. Integration Glue
- Add entry points/buttons to launch the data editor (from module toolbar or dialog header).
- Trigger availability generation automatically when arriving at a settlement (or via explicit button, per UX decision).
- Connect the transaction log to chat output or system adapter hooks as needed.

### 5. UX & Accessibility
- Provide tooltips for flags, produces/demands, and modifiers (pull descriptions from dataset/config).
- Ensure keyboard navigation is possible across form fields and merchant cards.
- Maintain consistent visual hierarchy with existing module theming; defer full theming overhaul to later work.

## Dependencies & Coordination
- Requires Phase 2 data structures and Phase 3 engine changes to be complete and stable.
- Coordinate with harness team (Phase 1) to add UI-mode scenario validating the new dialog.
- Share UI component contracts with testing/balance team to prepare automated coverage.

## Acceptance Checklist
- GM can create/edit/delete settlements and cargo entries entirely within Foundry; changes persist and pass validation.
- Trading dialog displays equilibrium information and new merchant fields; desperation reroll prompt functions correctly.
- End-to-end purchase flow updates player inventory/system state via SystemAdapter.
- Harness scenarios run in UI mode showing updated dialog populated with sample data.
- Documentation (inline help, README snippets) explains how to use the editor and new buyer flow.
