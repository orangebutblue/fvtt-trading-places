# Selling Tab Redesign - Complete Workflow

## Overview
The selling tab provides a streamlined interface for players to sell cargo from their current inventory. Unlike the buying tab which searches for available cargo, the selling tab focuses on finding buyers for the player's existing cargo through a slot-based system.

## UI Structure

### 1. Settlement Information Section
- **Purpose**: Displays current settlement context for selling operations
- **Content**: Same information as buying tab settlement info box
- **Requirements**: Settlement must be selected to enable selling functionality
- **Data Source**: Currently selected settlement from sidebar

### 2. Current Cargo Display
- **Purpose**: Shows all cargo currently held by the player
- **Display Format**: Read-only cargo cards (Simple list, only consisting of cargo type and EP)
- **Information Shown**:
  - Cargo name
  - Quantity (EP)
  - Contraband status (if applicable)
- **Empty State**: If no cargo exists, the tab shows no sellable items (obvious case)

### 3. Look for Sellers Button
- **Purpose**: Initiates the slot-based seller search algorithm
- **Styling**: Identical to "Check Cargo Availability" button in buying tab
- **Requirements**: Settlement must be selected, player must have cargo
- **Position**: Centered below cargo display, full-width button

### 4. Seller Results Section
- **Purpose**: Displays results of seller search
- **Display Format**: Slot-based grid similar to buying tab's cargo availability
- **Content**: One card per settlement slot that has a buyer

## Workflow Steps

### Step 1: Settlement Selection
1. User selects settlement in sidebar (same as for buying)
2. Settlement information box populates with settlement details
3. If no settlement selected, selling functionality remains disabled

### Step 2: Cargo Display
1. All cargo from cargo tab is displayed in read-only format
2. No selection mechanism - all cargo is considered for selling
3. If no cargo exists, "Look for Sellers" button remains disabled

### Step 3: Initiate Seller Search
1. User clicks "Look for Sellers" button
2. System calculates number of available slots for current settlement (same as in buyer tab) 
3. For each slot, algorithm determines if a buyer is present (for now: simple random roll, 80% chance of success)
4. For each slot with a buyer:
   - Randomly selects one cargo item from player's inventory
   - Generates offer price per EP (placeholder algorithm)
   - Generates maximum EP the buyer will purchase (number between 0 and number of EP player has)
   - Assigns skill rating (same algorithm as buying tab)

### Step 4: Seller Offers Display
1. Results section becomes visible
2. Each slot shows a seller card with:
   - Selected cargo name and details
   - Buyer's offered price per EP
   - Maximum EP they'll buy
   - Buyer's skill rating
   - Two sliders: EP quantity (1 to max they'll buy), discount (-20% to +20%) - use same code as buying tab!

### Step 5: Negotiation and Sale
1. User selects desired seller offer
2. Adjusts EP quantity slider (1 to seller's max)
3. Adjusts discount slider (-20% to +20%)
4. Clicks sell button
5. Transaction completes:
   - Cargo removed from inventory (partial or full)
   - Cargo tab updates automatically
   - Transaction added to history
   - Chat message is generated, displaying the contents of the deal (most importantly selling price)

## Integration Points

### With Cargo Tab
- Sell buttons in cargo tab switch to selling tab
- Selling tab shows same cargo data
- Successful sales update cargo inventory in real-time

### With History Tab
- All sales create transaction records
- Transaction details include seller information and negotiated terms

### With Buying Tab
- Shared settlement context
- Consistent slot-based UI patterns
- Similar negotiation mechanics (sliders, skill ratings)

## Technical Implementation Notes

### Algorithms (To Be Implemented)
- **Seller Presence**: Determines if each slot has a buyer
- **Cargo Selection**: Which cargo item each buyer wants
- **Price Generation**: Buyer's base offer price per EP
- **Quantity Limits**: Maximum EP each buyer will purchase
- **Skill Rating**: Buyer's negotiation skill (same as buying algorithm)

### UI Components
- Reuse settlement info template from buying tab
- Reuse cargo card display from cargo tab (read-only)
- Create new seller offer cards with sliders
- Button styling matches buying tab patterns

### Data Flow
- Settlement selection → enables selling UI
- Cargo data → populates display and seller selection
- Seller search → generates offers based on settlement slots
- Negotiation → updates transaction data and inventory

## Edge Cases

### No Settlement Selected
- Same as buying tab

### No Cargo Available
- Cargo display shows empty state
- Look for Sellers button disabled
- Obvious case: can't sell what you don't have

### Settlement Has No Slots
- Look for Sellers finds no buyers
- Results section shows "No buyers found" message

### Single Cargo Item
- All sellers might select the same cargo
- User can choose which seller to use or sell partial quantities

## Future Enhancements
- Advanced seller AI (different buyer personalities)
- Market trends affecting prices
- Relationship system with regular buyers
- Bulk selling options
- Seller reputation system