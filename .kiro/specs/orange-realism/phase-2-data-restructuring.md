# Phase 2 – Data Restructuring (Foundation)

## Intent
Normalize all trading datasets to match the orange-realism schema, maximize configurability, and ensure the codebase loads data exclusively through the updated structures. This phase eliminates legacy artifacts (legacy size letters, encumbrance notes, ad-hoc sources arrays) and prepares the system for equilibrium-based availability.

## Outcomes
- Settlement JSON files migrated to population-derived size, new `produces` / `demands` arrays, and structured `garrison` objects.
- Cargo dataset simplified to `basePrice` plus `seasonalModifiers`.
- `source-flags.json` synchronized with supply/demand transfer semantics.
- Automated migration script(s) committed to `/scripts/` with clear usage instructions.
- Documentation and validators updated to reflect the new schema.

## Task Breakdown

### 1. Schema Definition & Validation
- Finalize TypeScript/JSDoc interfaces representing settlement and cargo objects.
- Update `scripts/config-validator.js` (or introduce equivalent) to validate:
  - `population` (integer ≥ 0)
  - `size` derived from population thresholds
  - `flags` referencing known keys in `source-flags.json`
  - `produces` / `demands` referencing valid cargo names/ids
  - `garrison` shape `{ a?: number, b?: number, c?: number }`
- Extend `validate-dataset.js` so CI fails when files deviate from schema.

### 2. Migration Scripts
- Create `scripts/migrate-settlements.js` (or `.py`) performing:
  1. Load each JSON under `datasets/active/settlements/**`.
  2. Map legacy size letters → numeric thresholds (using config defaults).
  3. Parse `source` arrays into `flags`, `produces`, and `demands`:
     - Known resource keywords (e.g., "Agriculture", "Trade") become flags.
     - Commodity names become `produces` entries.
     - Special cases ("Subsistence") populate `demands` when appropriate.
  4. Convert `garrison` strings/arrays into the new keyed object (missing keys mean zero).
  5. Remove deprecated properties.
  6. Write transformed JSON back to disk with pretty formatting.
- Create `scripts/migrate-cargo.js` (if needed) to update `datasets/active/cargo-types.json` to the new `basePrice`/`seasonalModifiers` structure. (One-time use; optional if already converted.)
- Each script should offer dry-run and backup flags (`--dry-run`, `--backup-dir`).

### 3. Manual Review & Fixes
- Spot-check representative settlements (urban, rural, mines, mixed economies) to ensure `produces` / `demands` interpretation makes sense.
- Update notes if data clean-up is required (e.g., remove trailing spaces, standardize capitalization).
- Confirm contraband-related flags (smuggling, piracy) still align with new flag definitions.

### 4. DataManager Integration
- Adjust `scripts/data-manager.js` to cache and expose the new fields.
- Ensure helper methods (e.g., fetch by region, search) return `produces`, `demands`, and `garrison` data.
- Add invalidation hooks for when datasets change (needed later for the editor).

### 5. Documentation & Examples
- Update `.kiro/specs/orange-realism/settlement-data-structure.md`, `datasets-structure.md`, and README snippets with final schemas.
- Provide example snippets illustrating a fully migrated settlement and cargo entry.
- Record migration script usage in docs (inputs, outputs, expected log messages).

## Dependencies & Coordination
- Phase 1 harness should be available so migration scripts can be smoke-tested via scenarios after conversion.
- Coordinate with Phase 3 owners regarding any additional fields they plan to introduce (e.g., merchant personality baselines) to avoid rework.

## Acceptance Checklist
- `npm run validate-dataset` (or equivalent) passes on the converted data.
- Migration scripts committed with README usage instructions.
- Randomly sampled settlements show accurate `produces`/`demands` and garrison conversions.
- DataManager exposes new fields, and existing consumers continue to function (verified via harness scenario).
