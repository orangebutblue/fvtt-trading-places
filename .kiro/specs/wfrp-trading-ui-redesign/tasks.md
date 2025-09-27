# Implementation Plan

- [x] 1. Create Comprehensive Debug Logging System
  - Implement structured logging with consistent format
  - Add dice roll logging with formula, modifiers, and results
  - Add calculation step logging with input values and formulas
  - Add decision point logging with reasoning and data
  - Add user action logging with context and consequences
  - Add algorithm step logging with official rule references
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [ ] 2. Create V2 Application Framework Foundation
  - Create new WFRPTradingApplication class extending ApplicationV2
  - Define proper DEFAULT_OPTIONS with window configuration
  - Set up PARTS structure for modular templates
  - Remove all references to deprecated Dialog class
  - Integrate debug logging into application lifecycle
  - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [ ] 3. Implement Native UI Integration
  - Remove floating button overlay from current implementation
  - Add scene controls integration with trading tool
  - Add sidebar integration option
  - Create hotbar macro support with game.wfrpTrading API
  - Add debug logging for all UI interactions
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [ ] 4. Create Proper Window Management
  - Configure ApplicationV2 for landscape orientation (wider than tall)
  - Implement proper resizable window behavior
  - Set reasonable default dimensions (1200x800)
  - Add window position and size persistence
  - Add debug logging for window operations
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [ ] 5. Build Settlement Selection Component
  - Create SettlementSelector class with progressive disclosure
  - Implement region dropdown with all available regions
  - Implement dependent settlement dropdown
  - Add comprehensive debug logging for selection process
  - Display detailed settlement information on selection
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [ ] 6. Implement WFRP Buying Algorithm
  - Create BuyingAlgorithm class following official-algorithm.md
  - Implement Step 0: Settlement information extraction
  - Implement Step 1: Availability check with (Size + Wealth) × 10%
  - Implement Step 2A: Cargo type determination from settlement production
  - Implement Step 2B: Cargo size calculation with d100 method
  - Implement Step 3: Price negotiation and haggling mechanics
  - Add comprehensive logging for every calculation step
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 5.1, 5.2, 5.3, 5.4, 5.5_

- [ ] 7. Implement WFRP Selling Algorithm
  - Create SellingAlgorithm class following official-algorithm.md
  - Implement Step 1: Selling eligibility checks (location/time restrictions)
  - Implement Step 2: Buyer availability with (Size × 10) + Trade bonus
  - Implement Step 3: Offer price calculation with wealth modifiers
  - Implement Step 4: Haggling and final price determination
  - Add support for desperate sales and rumor sales
  - Add comprehensive logging for every calculation step
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 5.1, 5.2, 5.3, 5.4, 5.5_

- [ ] 8. Create Player Cargo Management System
  - Create PlayerCargoManager class with CRUD operations
  - Implement add cargo interface with type, quantity, quality selection
  - Implement cargo inventory display with current holdings
  - Implement remove/modify cargo functionality
  - Add session persistence for cargo data
  - Add comprehensive logging for all cargo operations
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 5.1, 5.2, 5.3, 5.4, 5.5_

- [ ] 9. Build Price Calculation Display System
  - Create PriceCalculator component for transparent pricing
  - Display base prices with seasonal modifiers
  - Show haggling potential outcomes and success ranges
  - List all price modifiers with explanations
  - Display final calculated prices prominently
  - Add comprehensive logging for all price calculations
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 5.1, 5.2, 5.3, 5.4, 5.5_

- [ ] 10. Integrate All Components into Main Application
  - Wire SettlementSelector into main application
  - Integrate BuyingAlgorithm with UI controls
  - Integrate SellingAlgorithm with cargo management
  - Connect PlayerCargoManager to buying/selling workflows
  - Integrate PriceCalculator with all trading operations
  - Ensure all components use consistent debug logging
  - _Requirements: All requirements integration_

- [ ] 11. Create Template System for V2 Application
  - Create trading-header.hbs template for season/settlement display
  - Create trading-content.hbs template for main interface
  - Create trading-footer.hbs template for debug logs and history
  - Implement proper Handlebars helpers for data formatting
  - Ensure templates are responsive and properly styled
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3_

- [ ] 12. Add Error Handling and Recovery
  - Implement graceful degradation for component failures
  - Add retry mechanisms for data loading failures
  - Create user-friendly error messages with recovery options
  - Add comprehensive error logging with stack traces
  - Implement fallback interfaces for critical failures
  - _Requirements: Error handling and user experience_

- [ ] 13. Testing and Validation
  - Test V2 Application framework integration (no deprecation warnings)
  - Test native UI integration across all access points
  - Test window management and resizing behavior
  - Test complete buying workflow with official algorithm
  - Test complete selling workflow with official algorithm
  - Test player cargo management operations
  - Validate comprehensive debug logging output
  - _Requirements: All requirements validation_