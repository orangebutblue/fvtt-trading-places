# Phase 5 – Testing & Balance

## Intent
Consolidate automated coverage, balance tuning, and polish after the core systems and UI are in place. This phase ensures the module is stable, performant, and ready for release.

## Outcomes
- Comprehensive automated test suite spanning engine logic, data validation, UI interactions, and harness scenarios.
- Balanced default configuration with documented guidelines for tuning.
- Performance verified across the full dataset (183 settlements) with acceptable load times.
- UI/UX refinements applied based on playtesting feedback.

## Task Breakdown

### 1. Automated Test Coverage
- **Unit Tests**
  - Equilibrium calculations (edge cases: multiple produces/demands, extreme flag modifiers).
  - Merchant slot formulas and desperation penalty application.
  - DataManager schema metadata and CRUD helpers.
- **Integration Tests**
  - Harness scenarios expanded to cover seller flow (if available), desperation reroll, and editor save/load cycles.
  - UI automation (e.g., Playwright, Jest + DOM testing) for:
    - Settlement/cargo editor (form validation, diff preview, save).
    - Trading dialog (availability generation, reroll, purchase).
- **Regression Tests**
  - Ensure legacy workflows (if any remain) continue to function or are intentionally deprecated.

### 2. Balance Pass
- Use harness scenarios and manual play to evaluate default config parameters:
  - Adjust supply/demand transfer percentages for flags and produces/demands.
  - Tune desperation penalties so rerolls feel meaningful but costly.
  - Review merchant skill distribution to achieve desired spread of challenges.
- Document recommended tuning ranges and rationale in `trading-config.md` (or similar).

### 3. Performance & Load Testing
- Measure availability generation time across all settlements (batch run via harness or script).
- Profile UI rendering with different dataset sizes; ensure no excessive re-renders or memory leaks.
- Optimize caching or memoization if bottlenecks encountered.

### 4. UI Polish & QA
- Address usability issues discovered during testing (layout tweaks, improved messaging, loading indicators).
- Verify accessibility basics (contrast, keyboard focus, ARIA labels) in both editor and trading dialog.
- Update localization strings if necessary (ensure new labels appear in `lang/en.json`).

### 5. Release Preparation
- Update CHANGELOG/README with new features and migration notes.
- Provide upgrade guidance (running migration scripts, new config options).
- Tag post-release backlog items (e.g., rumor mode, contracts, fractional penalties) in `post-orange-realism-roadmap.md` for follow-up.

## Dependencies & Coordination
- Requires prior phases to be feature-complete and merged.
- Work closely with design/UX stakeholders to prioritize polish fixes.
- Coordinate with QA/automation engineers for coverage goals and tooling choices.

## Acceptance Checklist
- All automated tests run clean locally and in CI; coverage thresholds met or exceeded.
- Performance benchmarks documented with before/after metrics (where applicable).
- Default configuration produces believable trading behavior (sign-off from design/GM stakeholders).
- Documentation and release notes finalized.
- Backlog for deferred features confirmed and communicated to the team.
