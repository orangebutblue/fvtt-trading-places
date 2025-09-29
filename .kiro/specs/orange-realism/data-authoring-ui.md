# Data Authoring UI Specification

## Overview
Design and deliver an in-module UI that lets GMs inspect, create, edit, and delete trading data records without touching JSON by hand. The editor must work with any field defined in the settlement and cargo datasets, adapting automatically to schema changes exposed by `DataManager`.

## Core Goals
- Unified entry point inside Foundry for managing settlements and cargo types.
- Round-trip editing: load current data via `DataManager`, stage changes in memory, validate, then persist back to disk.
- Zero hard-coded knowledge of specific keys; the UI reads schema metadata and renders the correct controls (text, number, multi-select, etc.).
- Guard rails: inline validation, preview of mutations, optional rollback before saving.

## Functional Requirements

### Landing Experience
- Single "Data Management" dialog accessible from module controls.
- Tabs or navigation for **Settlements** and **Cargo Types**.
- Contextual actions (create new, duplicate, delete) scoped to the current tab.

### Settlement Editor
- List/search settlements (region + name + optional tags).
- Detail panel with editable controls for every field surfaced by `DataManager` (e.g., strings, numbers, arrays, flags).
- Dynamic multi-selects:
  - Flags: populated from `source-flags.json` keys, with tooltips pulling the description.
  - Produces/Demands: populated from `cargoTypes` list (live snapshot).
- Structured editors for arrays/objects (e.g., garrison entries, notes, custom metadata).
- Population-derived size is display-only, recomputed when population changes.
- Change log showing pending modifications before save.

### Cargo Type Editor
- Grid/list of cargo types with search and category filters.
- Detail form exposing every key (name, category, descriptions, base price, seasonal modifiers, and any extra properties surfaced by `DataManager`).
- Support for arbitrary nested structures (e.g., seasonal modifier maps, future optional arrays) using repeatable form components.
- Ability to add/remove dynamic entries for array/object fields with drag-to-reorder support when ordering matters.

### Draft & Persistence Flow
1. Load data via `DataManager` (respect caches & versioning).
2. Clone into UI state; edits mutate the clone only.
3. Validate on blur and before save (sync + async rules fed by `DataManager.validate*`).
4. Offer JSON diff preview prior to persisting.
5. On confirm, write via `DataManager` save helpers; refresh caches and broadcast change events.
6. Provide undo/rollback to the last persisted snapshot.

## Validation & Error Handling
- Highlight invalid fields inline with human-readable messages.
- Prevent save while blocking errors exist; warnings allowed with confirmation.
- Capture and display write failures (filesystem permissions, schema mismatches) with retry options.
- Offer export backup (download current JSON) before applying changes.

## Integration Points
- **DataManager**: extend to expose schema metadata (field types, allowable values) and CRUD helpers.
- **SystemAdapter**: ensure Foundry permissions gate access (e.g., GM only).
- **Trading Application**: optionally hook a "Edit Data" button for quick access.
- **Config File**: read flag metadata/labels from `source-flags.json`; refresh when file changes.

## UX Considerations
- Responsive layout sized for Foundry app window; scrollable sections for long forms.
- Autosave drafts (optional) stored in memory per session; discard on close unless saved.
- Keyboard shortcuts for save (`Ctrl/Cmd+S`), new entry (`Ctrl/Cmd+N`), duplicate (`Ctrl/Cmd+D`).
- Confirmations for destructive actions (delete entry, reset changes).

## Testing Strategy
- Unit tests for DataManager schema metadata and validation hooks.
- Integration tests simulating full CRUD cycle for settlements and cargo types.
- UI automation (where feasible) to cover form rendering and diff confirmation.
- Regression tests ensuring other trading flows (availability checks, UI dialogs) continue to read updated data correctly.

## Future Enhancements
- Version history with timeline of edits.
- Import/export wizards for batch updates.
- Role-based access to limit editing to specific users.
