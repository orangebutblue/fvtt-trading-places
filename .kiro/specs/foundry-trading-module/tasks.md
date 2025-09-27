# Implementation Plan

- [x] 1. Set up FoundryVTT module structure and configuration
  - Create module.json manifest with proper FoundryVTT metadata and dependencies
  - Set up directory structure with scripts, templates, styles, and datasets folders
  - Create basic module initialization in main.js with hooks registration
  - _Requirements: 6.1, 6.2_

- [x] 2. Implement core data structures and validation
- [x] 2.1 Create settlement data validation system
  - Write validateSettlement() function with 9 required field checks
  - Implement type validation for population, wealth, and source fields
  - Create validateDatasetStructure() function for complete dataset validation
  - Write unit tests for all validation functions
  - _Requirements: 8.1, 8.7, 8.8_

- [x] 2.2 Create cargo data models and seasonal pricing
  - Define cargo data structure with seasonal price variations
  - Implement quality tier pricing system for wine/brandy
  - Create seasonal price lookup functions
  - Write unit tests for cargo pricing calculations
  - _Requirements: 8.2, 2.1, 2.6_

- [x] 2.3 Implement settlement size and wealth enumeration mapping
  - Create size enumeration converter (CS/C/T/ST/V/F/M to numeric 1-4)
  - Implement wealth scale effects (1-5 to percentage modifiers)
  - Write helper functions for settlement property lookups
  - Create unit tests for enumeration conversions
  - _Requirements: 1.1, 3.6_

- [x] 3. Create sample dataset and validate data extraction
- [x] 3.1 Create minimal sample dataset for development
  - Create 5-10 sample settlements with all required fields for testing
  - Define basic cargo types (Grain, Wine, Cattle) with seasonal pricing
  - Create minimal config.json for WFRP4e integration
  - Validate sample dataset structure and completeness
  - _Requirements: 8.1, 8.2, 7.1_

- [x] 3.2 Build DataManager class with sample data loading
  - Implement loadActiveDataset() and switchDataset() methods
  - Create settlement lookup functions (by name, region, size, production)
  - Implement dynamic category discovery from settlement source fields
  - Test with sample dataset and write error handling for missing data
  - _Requirements: 7.1, 7.2, 7.4, 7.5_

- [x] 3.3 Implement season management with persistence
  - Create getCurrentSeason() and setCurrentSeason() methods using FoundryVTT settings
  - Implement season change notifications and price updates
  - Add season validation before trading operations
  - Write unit tests for season persistence and validation
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 4. Create core trading algorithm classes (pure logic)
- [x] 4.1 Implement cargo availability checking algorithm
  - Create Step 1: (Size + Wealth) × 10% availability calculation
  - Implement Step 2A: cargo type determination for specific goods vs Trade settlements
  - Implement Step 2B: cargo size calculation with Trade center bonus logic
  - Write unit tests for availability checking with mock dice rolls
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7_

- [x] 4.2 Create purchase price calculation system
  - Implement base price lookup with seasonal variations
  - Add +10% partial purchase penalty logic
  - Create wine/brandy quality tier pricing calculations
  - Write unit tests for all price calculation scenarios
  - _Requirements: 2.1, 2.2, 2.6_

- [x] 4.3 Implement sale mechanics and restrictions
  - Create sale eligibility checking (location and time restrictions)
  - Implement buyer availability calculation (Size × 10 + Trade bonus)
  - Add village restrictions for non-Grain goods
  - Implement wealth-based price modifiers for sales
  - Write unit tests for all sale restriction scenarios
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [x] 4.4 Create special sale methods
  - Implement desperate sale logic (50% base price at Trade settlements)
  - Add partial sale options (sell half cargo and re-roll)
  - Create rumor-based premium sales price calculations
  - Write unit tests for special sale scenarios
  - _Requirements: 4.1, 4.2, 4.5_

- [x] 5. Implement dice integration and skill tests
- [x] 5.1 Create FoundryVTT dice rolling integration
  - Implement rollDice() method using FoundryVTT's Roll class
  - Create rollAvailability() and rollCargoSize() with proper formulas
  - Add chat message posting for dice results with visibility controls
  - Write unit tests for dice integration
  - _Requirements: 6.7, 6.8, 6.9_

- [x] 5.2 Implement haggling and skill test mechanics
  - Create comparative haggle test system with player vs merchant skills
  - Add Dealmaker talent bonus calculations
  - Implement Gossip test for rumor discovery with Difficult (-10) modifier
  - Create skill test result processing and price adjustments
  - Write unit tests for all skill test scenarios
  - _Requirements: 2.3, 2.4, 2.5, 4.3, 4.4_

- [x] 6. Build FoundryVTT integration layer
- [x] 6.1 Create SystemAdapter for currency and inventory management
  - Implement configuration-driven actor property access
  - Create currency operations (get, deduct, add) using configured field paths
  - Implement inventory operations for adding/removing cargo items
  - Write validation for system compatibility and actor properties
  - _Requirements: 6.2, 6.3, 7.6_

- [x] 6.2 Implement FoundryVTT dice integration
  - Create rollDice() method using FoundryVTT's Roll class
  - Implement rollAvailability() and rollCargoSize() with chat output
  - Add haggle test rolling with comparative skill mechanics
  - Create chat message formatting for roll results
  - Write unit tests for dice integration
  - _Requirements: 6.7, 6.8, 6.9_

- [x] 6.3 Create FoundryVTT settings registration
  - Register activeDataset, currentSeason, and chatVisibility settings
  - Implement settings validation and change handlers
  - Create settings UI integration with FoundryVTT config menu
  - Add migration handling for settings updates
  - _Requirements: 5.1, 5.2, 6.1_

- [x] 7. Build user interface and dialog system
- [x] 7.1 Create TradingDialog class structure
  - Extend FoundryVTT Dialog class with trading-specific functionality
  - Implement dialog lifecycle methods (create, activateListeners)
  - Create settlement selection and cargo display UI components
  - Add season management UI controls
  - _Requirements: 6.1, 5.1, 5.3_

- [x] 7.2 Implement trading workflow UI interactions
  - Create settlement selection handlers with validation
  - Implement cargo selection and quantity input controls
  - Add haggling attempt UI with skill test integration
  - Create purchase and sale confirmation workflows
  - _Requirements: 6.10, 2.3, 3.7_

- [x] 7.3 Add chat integration and result display
  - Implement chat message posting with GM-only visibility options
  - Create formatted transaction result messages
  - Add dice roll result display in chat
  - Implement error message display for failed transactions
  - _Requirements: 6.5, 6.8, 6.9_

- [x] 8. Create integration tests for core system
- [x] 8.1 Test complete trading workflows end-to-end
  - Create integration tests for full purchase workflow (availability → pricing → transaction)
  - Test complete sale workflow with all restrictions and buyer mechanics
  - Verify season changes properly update all pricing calculations
  - Test dataset switching and validation with multiple datasets
  - _Requirements: 1.1-1.7, 2.1-2.6, 3.1-3.7, 5.1-5.5_

- [x] 8.2 Test FoundryVTT integration components
  - Verify SystemAdapter properly manipulates actor currency and inventory
  - Test dice rolling integration produces correct chat messages
  - Validate settings persistence and retrieval across module reloads
  - Test error handling integration between all components
  - _Requirements: 6.1-6.10, 8.7-8.8_

- [x] 9. Create Handlebars templates and styling
- [x] 9.1 Design main trading dialog template
  - Create trading-dialog.hbs with settlement selection interface
  - Add cargo display sections with pricing information
  - Implement season selector and current season display
  - Create transaction history display area
  - _Requirements: 6.1, 5.3_

- [x] 9.2 Implement CSS styling for trading interface
  - Create trading.css with FoundryVTT-compatible styling
  - Style settlement and cargo selection components
  - Add responsive design for different screen sizes
  - Implement visual feedback for transaction states
  - _Requirements: 6.1_

- [x] 10. Build complete WFRP dataset
- [x] 10.1 Create full settlement data in JSON format
  - Convert all settlement data from original source to required 9-field structure
  - Implement complete settlement sizes, wealth levels, and production categories
  - Add garrison data and regional organization for all settlements
  - Validate complete dataset structure and test with existing DataManager
  - _Requirements: 8.1, 7.1, 7.3_

- [x] 10.2 Create complete cargo types and pricing data
  - Define all WFRP cargo types with seasonal pricing variations
  - Implement quality tiers for wine and brandy with proper pricing
  - Add encumbrance and deterioration data for all cargo types
  - Create complete seasonal random cargo tables
  - _Requirements: 8.2, 2.1, 2.6_

- [x] 10.3 Finalize system configuration for WFRP integration
  - Complete currency field paths for WFRP4e system integration
  - Configure inventory integration methods for all cargo types
  - Set up complete haggling skill levels and merchant stats
  - Create comprehensive system-specific error messages and validation
  - _Requirements: 7.6, 6.2, 6.4_

- [x] 11. Implement comprehensive error handling
- [x] 11.1 Create configuration validation system
  - Implement startup validation for required configuration files
  - Add system compatibility checking with clear error messages
  - Create dataset validation with detailed diagnostic reporting
  - Write error recovery procedures for common issues
  - _Requirements: 6.4, 8.7, 8.8_

- [x] 11.2 Add runtime error handling and user feedback
  - Implement transaction validation to prevent invalid operations
  - Create user-friendly error notifications for common failures
  - Add logging system for debugging and troubleshooting
  - Implement graceful degradation for non-critical errors
  - _Requirements: 6.10, 6.9_

- [x] 12. Create comprehensive test suite
- [x] 12.1 Write unit tests for trading algorithms
  - Test cargo availability calculations with all settlement types
  - Verify price calculations including all modifiers and bonuses
  - Test haggling mechanics with various skill levels and talents
  - Validate sale restrictions and buyer availability logic
  - _Requirements: 1.1-1.7, 2.1-2.6, 3.1-3.7, 4.1-4.5_

- [x] 12.2 Create integration tests for FoundryVTT features
  - Test dice rolling integration and chat message posting
  - Verify actor property manipulation and inventory updates
  - Test settings persistence and season management
  - Validate dialog rendering and user interaction workflows
  - _Requirements: 6.1-6.10, 5.1-5.5_

- [ ] 13. Finalize module packaging and documentation
- [ ] 13.1 Complete module.json manifest
  - Add proper module metadata, version, and compatibility information
  - Define module dependencies and system requirements
  - Create installation and setup instructions
  - Add changelog and version history
  - _Requirements: 6.1, 7.1_

- [ ] 13.2 Create user documentation and examples
  - Write GM guide for using the trading system
  - Create player instructions for trading workflows
  - Document dataset creation for community extensions
  - Add troubleshooting guide for common issues
  - _Requirements: 8.1-8.8, 7.1-7.6_