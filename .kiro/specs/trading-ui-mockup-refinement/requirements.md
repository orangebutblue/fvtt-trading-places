# Requirements Document

## Introduction

This specification defines the refinement of the trading UI HTML mockup (`tmp_rovodev_new_unified_trading_ui.html`) to improve the user interface design and workflow before implementing it in the actual FoundryVTT module. The focus is on restructuring tabs, improving responsive design, and refining the trading workflow for both buying and selling operations using the official WFRP algorithms as defined in `official-algorithm.md` and `SELLING_ALGORITHM_IMPLEMENTATION.md`.

## Requirements

### Requirement 1: Tab Structure Redesign

**User Story:** As a user, I want a clear separation between buying and selling operations, so that I can easily understand which mode I'm in and what actions are available.

#### Acceptance Criteria

1. WHEN viewing the trading interface THEN the "Market" tab SHALL be renamed to "Buying"
2. WHEN viewing the trading interface THEN the "Inventory" tab SHALL be replaced with a "Selling" tab
3. WHEN the interface loads THEN the tab structure SHALL be: Buying, Selling, History
4. WHEN switching between tabs THEN the content SHALL change appropriately to show buying or selling specific controls
5. WHEN on the Selling tab THEN only selling-related functionality SHALL be visible

### Requirement 2: Responsive Tab Layout

**User Story:** As a user on different screen sizes, I want the tabs to be positioned appropriately for my viewport, so that the interface remains usable on both large and small screens.

#### Acceptance Criteria

1. WHEN the window width is small THEN the tabs SHALL be positioned at the top of the interface
2. WHEN the window width is large THEN the tabs MAY be positioned in their current location or at the top
3. WHEN the tabs are repositioned THEN they SHALL always be above the main content area
4. WHEN the tabs are repositioned THEN they SHALL NOT overlap with other interface elements
5. WHEN the viewport size changes THEN the tab positioning SHALL adapt responsively

### Requirement 3: Quick Actions Removal and Integration

**User Story:** As a user, I want trading actions to be contextually placed within their relevant tabs, so that I don't have a confusing separate "quick actions" section.

#### Acceptance Criteria

1. WHEN viewing the interface THEN the "Quick Actions" section SHALL be completely removed
2. WHEN on the Buying tab THEN a "Negotiate" button SHALL be available in the appropriate context
3. WHEN on the Selling tab THEN a "Negotiate" button SHALL be available in the appropriate context
4. WHEN on the Selling tab THEN a "Desperate Sale" button SHALL be available in the appropriate context
5. WHEN on the Buying tab THEN "Quick Sell" functionality SHALL NOT be available

### Requirement 4: Buying Tab Functionality

**User Story:** As a GM, I want to manually trigger availability checks with detailed feedback, so that I can control when checks happen and understand the results.

#### Acceptance Criteria

1. WHEN on the Buying tab THEN a "Check Availability" button SHALL be positioned below the settlement selector and above the settlement info
2. WHEN a settlement is selected THEN availability SHALL NOT be automatically rolled
3. WHEN the "Check Availability" button is pressed THEN the buying algorithm from `official-algorithm.md` SHALL be executed
4. WHEN availability is checked THEN detailed console logs SHALL explain what was rolled, why it was rolled, what the outcome was, and how it affected the result
5. WHEN availability results are displayed THEN they SHALL show the complete calculation process including Step 1 (Availability Check) and Step 2B (Cargo Quantity) as defined in `official-algorithm.md`

### Requirement 5: Selling Tab Resource Selection

**User Story:** As a GM, I want to select specific resources for selling based on settlement data, so that I can only attempt to sell goods that make sense for the current location.

#### Acceptance Criteria

1. WHEN on the Selling tab THEN a row of buttons SHALL display only resources available in the selected settlement
2. WHEN no settlement is selected THEN the resource buttons SHALL be disabled or hidden
3. WHEN a settlement is selected THEN only actual sellable resources from the settlement's "source" data SHALL be displayed as buttons
4. WHEN a settlement produces "Trade" THEN this SHALL NOT be displayed as a sellable resource but SHALL be treated as a selling bonus modifier
5. WHEN a resource button is clicked THEN it SHALL become selected/highlighted
6. WHEN a resource is selected THEN the interface SHALL show quantity input and seller search options

### Requirement 6: Selling Tab Workflow

**User Story:** As a GM, I want to specify quantities and search for sellers using the proper algorithm, so that selling follows the correct game mechanics.

#### Acceptance Criteria

1. WHEN a resource is selected THEN a quantity input field SHALL be displayed
2. WHEN a quantity is entered THEN a "Look for Sellers" button SHALL be displayed
3. WHEN the "Look for Sellers" button is pressed THEN the selling algorithm from `SELLING_ALGORITHM_IMPLEMENTATION.md` SHALL be executed
4. WHEN the selling algorithm is executed THEN every step SHALL be properly logged for debugging purposes
5. WHEN seller search results are available THEN they SHALL be displayed with detailed information including all calculation steps

### Requirement 7: History Tab Persistence

**User Story:** As a user, I want my trading history to be saved permanently in the FoundryVTT world, so that I can review past transactions even after closing the browser or switching devices.

#### Acceptance Criteria

1. WHEN trading actions are performed THEN they SHALL be saved to the history in the FoundryVTT world data
2. WHEN the browser is closed and reopened THEN the history SHALL be loaded from the FoundryVTT world
3. WHEN switching to a different browser THEN the history SHALL still be accessible from the same FoundryVTT world
4. WHEN viewing the History tab THEN all past transactions SHALL be displayed in chronological order
5. WHEN history data is saved THEN it SHALL NOT use browser storage but SHALL be stored in the FoundryVTT world itself
6. WHEN the module starts THEN the history SHALL be automatically loaded from the world data

### Requirement 8: Settlement Integration with Official Algorithms

**User Story:** As a GM, I want settlement selection to properly integrate with both buying and selling workflows using the official WFRP algorithms, so that the available actions match the selected settlement's characteristics.

#### Acceptance Criteria

1. WHEN a settlement is selected THEN both Buying and Selling tabs SHALL update to reflect settlement-specific options based on `official-algorithm.md`
2. WHEN on the Buying tab THEN settlement info SHALL be displayed showing Size Rating and Wealth Rating which directly affect availability calculations
3. WHEN on the Selling tab THEN available resources SHALL be populated from the settlement's source data, with "Trade" settlements providing selling bonuses
4. WHEN no settlement is selected THEN trading actions SHALL be disabled with appropriate messaging
5. WHEN settlement data changes THEN all tabs SHALL update their available options and algorithm parameters accordingly
6. WHEN displaying settlement info THEN Size Rating and Wealth Rating SHALL be prominently shown as they are key factors in both buying and selling algorithms

### Requirement 9: Console Logging for Development

**User Story:** As a developer, I want comprehensive console logging for all trading operations, so that I can debug and understand the system behavior during development.

#### Acceptance Criteria

1. WHEN any trading operation is performed THEN detailed console logs SHALL be generated
2. WHEN dice rolls occur THEN the logs SHALL show the roll values, modifiers, and calculation steps
3. WHEN algorithms are executed THEN the logs SHALL explain each step of the process
4. WHEN errors occur THEN the logs SHALL provide diagnostic information
5. WHEN user actions are taken THEN the logs SHALL record the action and its context