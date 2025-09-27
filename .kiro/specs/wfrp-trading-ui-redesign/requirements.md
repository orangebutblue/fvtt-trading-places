# Requirements Document

## Introduction

This specification defines a complete redesign of the Trading Places FoundryVTT module interface. The current implementation has fundamental design flaws and needs to be rebuilt from scratch using modern FoundryVTT V2 Application framework with proper native integration and user experience.

## Requirements

### Requirement 1: Native FoundryVTT Integration

**User Story:** As a GM, I want the trading interface to integrate seamlessly with FoundryVTT's native UI patterns, so that it feels like a natural part of the system rather than a foreign overlay.

#### Acceptance Criteria

1. WHEN the module is loaded THEN the trading interface SHALL be accessible through FoundryVTT's native UI elements (scene controls, sidebar, or hotbar)
2. WHEN accessing the trading interface THEN it SHALL NOT use floating buttons or non-native UI elements
3. WHEN the trading dialog opens THEN it SHALL use FoundryVTT's V2 Application framework without deprecation warnings
4. WHEN the trading interface is displayed THEN it SHALL follow FoundryVTT's standard styling and theming conventions

### Requirement 2: Modern Application Framework

**User Story:** As a developer, I want the trading interface to use FoundryVTT's V2 Application framework, so that it remains compatible with future versions and follows current best practices.

#### Acceptance Criteria

1. WHEN the trading dialog is created THEN it SHALL use ApplicationV2 instead of the deprecated Dialog class
2. WHEN the application opens THEN there SHALL be no deprecation warnings in the console
3. WHEN the application is rendered THEN it SHALL be fully compatible with FoundryVTT v13+ without backwards compatibility issues
4. WHEN the application framework is updated THEN it SHALL follow FoundryVTT's official V2 Application documentation

### Requirement 3: Proper Window Management

**User Story:** As a user, I want the trading window to be properly sized and resizable, so that I can adjust it to fit my screen and workflow needs.

#### Acceptance Criteria

1. WHEN the trading window opens THEN it SHALL be wider than it is tall (landscape orientation)
2. WHEN the trading window is displayed THEN it SHALL be fully resizable by dragging window edges
3. WHEN resizing the window THEN the content SHALL adapt responsively to the new dimensions
4. WHEN the window is resized THEN it SHALL remember the size for future sessions
5. WHEN the window opens THEN it SHALL have a reasonable default size that fits most screens

### Requirement 4: Clean Settlement Selection Interface

**User Story:** As a GM, I want to select settlements through a clean two-step process, so that I can quickly find the specific settlement I need without scrolling through long lists.

#### Acceptance Criteria

1. WHEN the trading interface opens THEN it SHALL display a region dropdown as the first selection step
2. WHEN a region is selected THEN a settlement dropdown SHALL be populated with only settlements from that region
3. WHEN no region is selected THEN the settlement dropdown SHALL be disabled
4. WHEN a settlement is selected THEN detailed settlement information SHALL be displayed
5. WHEN settlement data is loaded THEN comprehensive debug logging SHALL explain the selection process

### Requirement 5: Comprehensive Debug Logging

**User Story:** As a developer and GM, I want detailed debug logging for all trading operations, so that I can understand exactly what calculations are being performed and why.

#### Acceptance Criteria

1. WHEN any trading operation occurs THEN detailed logs SHALL explain what is happening and why
2. WHEN dice rolls are made THEN the logs SHALL show the roll values, modifiers, and success/failure reasons
3. WHEN prices are calculated THEN the logs SHALL show the base price, all modifiers, and final result
4. WHEN settlement data is accessed THEN the logs SHALL show what data is being used and how it affects calculations
5. WHEN errors occur THEN the logs SHALL provide clear diagnostic information

### Requirement 6: Buying Algorithm Implementation

**User Story:** As a GM, I want a complete buying algorithm that follows WFRP rules as defined in `official-algorithm.md`, so that cargo availability and pricing are calculated correctly according to the official Death on the Reik Companion system.

#### Acceptance Criteria

1. WHEN checking cargo availability THEN the system SHALL implement "Algorithmus: Waren kaufen (Buying)" from `official-algorithm.md`
2. WHEN calculating availability chance THEN it SHALL use (Size Rating + Wealth Rating) × 10% as specified
3. WHEN determining cargo type THEN it SHALL follow the settlement production rules from the official algorithm
4. WHEN calculating cargo size THEN it SHALL use the base value × d100 (rounded to nearest 10) method
5. WHEN determining prices THEN it SHALL apply seasonal modifiers and haggling rules as documented

### Requirement 7: Selling Algorithm Implementation

**User Story:** As a GM, I want a complete selling algorithm that follows WFRP rules as defined in `official-algorithm.md`, so that I can determine buyer availability and pricing for player cargo.

#### Acceptance Criteria

1. WHEN selling cargo THEN the system SHALL implement "Algorithmus: Waren verkaufen (Selling)" from `official-algorithm.md`
2. WHEN checking buyer availability THEN it SHALL use (Size Rating × 10) + 30 for Trade settlements
3. WHEN calculating offer prices THEN it SHALL apply wealth-based modifiers as specified in the algorithm
4. WHEN selling restrictions apply THEN they SHALL be enforced (cannot sell where purchased, one week waiting period)
5. WHEN alternative selling methods are used THEN desperate sales and rumor sales SHALL be implemented per the official rules

### Requirement 8: Player Cargo Management Interface

**User Story:** As a GM, I want to manually specify what cargo the players have, so that I can accurately represent their inventory for selling purposes.

#### Acceptance Criteria

1. WHEN accessing the selling interface THEN I SHALL be able to add cargo types manually
2. WHEN adding cargo THEN I SHALL be able to specify the type, quantity, and quality
3. WHEN cargo is added THEN it SHALL be stored for the current trading session
4. WHEN viewing player cargo THEN I SHALL see a clear list of all items with quantities
5. WHEN selling cargo THEN I SHALL be able to select specific items and quantities to sell

### Requirement 9: Price Calculation Display

**User Story:** As a GM, I want to see clear price calculations with haggling outcomes, so that I can understand the final prices without needing to perform manual calculations.

#### Acceptance Criteria

1. WHEN viewing cargo prices THEN the base price SHALL be clearly displayed
2. WHEN haggling is possible THEN potential price ranges SHALL be shown based on success levels
3. WHEN price modifiers apply THEN each modifier SHALL be listed with its effect
4. WHEN final prices are calculated THEN the total cost/revenue SHALL be prominently displayed
5. WHEN haggling outcomes are determined THEN the price changes SHALL be automatically applied and explained