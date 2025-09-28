# Implementation Plan

- [ ] 1. Update Tab Structure and Navigation
  - Rename "Market" tab to "Buying" in HTML and JavaScript
  - Replace "Inventory" tab with "Selling" tab
  - Update tab icons and labels to match new structure
  - Update tab switching JavaScript to handle new tab names
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [ ] 2. Implement Responsive Tab Positioning
  - Add CSS media queries to move tabs to top on smaller screens
  - Implement sticky positioning for tabs with shadow feedback
  - Add JavaScript to detect when tabs become sticky and apply shadow class
  - Test tab positioning across different viewport sizes
  - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [ ] 3. Remove Quick Actions Section
  - Remove Quick Actions HTML section from sidebar
  - Remove Quick Actions CSS styles
  - Remove Quick Actions JavaScript event handlers
  - Clean up any references to quick action buttons
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [ ] 4. Create Buying Tab Interface
  - Add "Check Availability" button below settlement selector
  - Create availability results display area
  - Move settlement info display to buying tab content area
  - Highlight Size Rating and Wealth Rating in settlement display
  - Add negotiate button in buying context
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [ ] 5. Implement Buying Algorithm with Logging
  - Create calculateSizeRating() function for settlement size codes with proper error handling
  - Handle unknown/invalid size codes gracefully with user-facing error messages
  - Implement Step 1: Availability Check with (Size + Wealth) × 10% formula
  - Implement Step 2: Cargo type determination from settlement source data
  - Implement Step 2: Cargo quantity calculation with d100 method
  - Add comprehensive console logging for every calculation step
  - Add debug mode toggle with enable/disable functionality
  - Show validation errors in UI before attempting algorithm calculations
  - _Requirements: 4.3, 4.4, 4.5, 8.6, 9.1, 9.2, 9.3, 9.4, 9.5_

- [ ] 6. Create Selling Tab Resource Selection
  - Create resource buttons container in selling tab
  - Implement populateResourceButtons() function to read settlement source data
  - Filter out "Trade" from sellable resources (treat as modifier only)
  - Add resource button selection highlighting
  - Show/hide quantity input and seller search based on resource selection
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

- [ ] 7. Implement Selling Tab Workflow
  - Add quantity input field for selected resources
  - Create "Look for Sellers" button with proper enabling/disabling
  - Add contextual negotiate button for selling
  - Add desperate sale button (only visible in selling tab)
  - Implement proper show/hide logic for selling interface elements
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [ ] 8. Implement Selling Algorithm with Logging
  - Create lookForSellers() function following SELLING_ALGORITHM_IMPLEMENTATION.md
  - Implement Step 2: Buyer availability with (Size × 10) + Trade bonus formula
  - Implement Step 3: Offer price calculation with wealth modifiers
  - Add comprehensive console logging for every calculation step
  - Handle special cases (villages, trade settlements)
  - _Requirements: 6.3, 6.4, 6.5, 8.1, 8.2, 8.3, 8.5, 9.1, 9.2, 9.3, 9.4, 9.5_

- [ ] 9. Implement Enhanced Settlement Validation with User Feedback
  - Create comprehensive validateSettlement() function
  - Validate all required settlement properties exist
  - Validate size codes against known values (CS, C, T, ST, V, F, M)
  - Validate wealth ratings are within valid ranges (1-5)
  - Return detailed error messages for validation failures
  - Add validation calls before running any algorithms
  - Create user-facing error display with warning symbols for invalid data
  - Show specific error messages in UI when settlement data is invalid
  - _Requirements: 8.4, 8.5, 8.6_

- [ ] 10. Create World Data Persistence System
  - Remove any browser localStorage usage
  - Implement saveTransaction() function using FoundryVTT world settings
  - Implement loadTransactionHistory() function from world data
  - Create transaction data structure with all required fields
  - Add automatic history loading on page initialization
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

- [ ] 11. Update History Tab Interface
  - Modify history tab to load from world data instead of mock data
  - Add export history functionality
  - Add clear history functionality with confirmation
  - Implement proper transaction display with all details
  - Add transaction filtering and sorting options
  - _Requirements: 7.4, 7.5, 7.6_

- [ ] 12. Integrate Settlement Data with Algorithm Parameters
  - Update settlement info display to show algorithm-relevant data
  - Highlight Size Rating and Wealth Rating prominently
  - Show Trade bonus indicator when settlement has "Trade" in source
  - Update both buying and selling tabs when settlement changes
  - Add settlement change validation and error handling
  - _Requirements: 8.1, 8.2, 8.3, 8.5, 8.6_

- [ ] 13. Add Debug Mode Toggle and Enhanced Logging
  - Create debug mode toggle in app header
  - Implement debugLog() function that respects debug mode setting
  - Replace all console.log calls with debugLog calls
  - Add debug mode persistence across sessions
  - Style debug toggle to match app design
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

- [ ] 14. Implement Error Handling and User Feedback
  - Add error display areas in both buying and selling tabs
  - Implement graceful error handling for algorithm failures
  - Add user-friendly error messages for validation failures
  - Create warning symbols and error indicators for invalid settlement data
  - Add specific error messages for unknown size codes and invalid wealth ratings
  - Implement retry mechanisms for failed operations
  - Add loading states for algorithm calculations
  - Show "Check data validity" messages when settlement validation fails
  - _Requirements: Error handling and user experience_

- [ ] 15. Style and Polish Interface Elements
  - Add CSS for new resource buttons with hover and selection states
  - Style availability results display area
  - Add CSS for debug toggle in header
  - Implement smooth transitions for show/hide elements
  - Add loading spinners for algorithm calculations
  - Ensure all new elements match existing design system
  - _Requirements: Visual consistency and user experience_

- [ ] 16. Test Complete Workflow Integration
  - Test complete buying workflow from settlement selection to purchase
  - Test complete selling workflow from resource selection to sale
  - Test history persistence across browser sessions
  - Test responsive design on different screen sizes
  - Test debug mode toggle functionality
  - Validate all console logging output matches requirements
  - Test error handling and validation scenarios
  - _Requirements: All requirements integration and validation_