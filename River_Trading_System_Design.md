# WFRP 4E Trading Places System - Design Document

## Overview
A unified script that combines cargo availability generation, purchase price calculation, and sale price calculation for WFRP 4E Trading Places campaigns. Based on rules from *Death on the Reik Companion* pages 71-78.

## Core Features

### 1. Settlement Management
- **Settlement Selection**: Interactive selection from river settlements (Altdorf, Brandenburg, etc.)
- **Settlement Data**: Store base economic data for each location
- **Regional Modifiers**: Apply location-specific trading bonuses/penalties

### 2. Cargo System
- **Cargo Types**: Grain, Armaments, Luxuries, Metal, Timber, Wine/Brandy (multiple qualities)
- **Availability Generation**: Determine what's available for purchase at each settlement
- **Demand Generation**: Calculate what local merchants want to buy
- **Encumbrance Tracking**: Use WFRP's encumbrance point system

### 3. Pricing Engine
- **Base Price Lookup**: Reference tables for each cargo type
- **Seasonal Modifiers**: Price adjustments for Spring/Summer/Autumn/Winter
- **Market Modifiers**: Supply/demand, settlement wealth, random events
- **Purchase Calculations**: Total cost for buying cargo
- **Sale Calculations**: Total revenue for selling cargo

### 4. Trading Interface
- **Unified Dashboard**: Single interface for all trading operations
- **Market Overview**: Current season, selected settlement, available cargo
- **Transaction Calculator**: Real-time price calculations
- **Trade History**: Track previous transactions (optional)

## Technical Architecture

### Data Layer
- **Settlement Database**: Economic data, base prices, regional modifiers
- **Cargo Database**: Item definitions, base values, seasonal modifiers
- **Rules Engine**: WFRP 4E trading rule implementations

### Logic Layer
- **Availability Calculator**: Determine cargo availability using dice mechanics
- **Price Calculator**: Apply all relevant modifiers to base prices
- **Market Generator**: Create dynamic market conditions

### Presentation Layer
- **Command Line Interface**: Text-based interaction (initial implementation)
- **Web Interface**: HTML/CSS/JS version (future consideration)
- **Export Functions**: Save results to file formats

## User Workflow

1. **Setup**: Select current season, target settlement
2. **Market Generation**: Generate available cargo and local demand
3. **Trading Actions**:
   - View available cargo and prices
   - Calculate purchase costs
   - Calculate sale revenues
   - Execute transactions
4. **Results**: Display transaction summary and updated market state

## Implementation Phases

### Phase 1: Core Functionality
- Basic settlement and cargo data structures
- Price calculation engine
- Simple CLI interface
- Cargo availability generation

### Phase 2: Enhanced Features
- Advanced modifiers system
- Market simulation
- Transaction tracking
- Export capabilities

### Phase 3: Polish & Extension
- Web interface
- Additional settlements
- Custom cargo types
- Campaign integration tools

## Configuration Options
- **Rule Variants**: Toggle different rule interpretations
- **Difficulty Settings**: Adjust market volatility
- **Custom Data**: Add homebrew settlements/cargo
- **Output Formats**: Text, JSON, CSV export options

## Future Considerations
- Integration with character sheets
- Multi-session campaign tracking
- Automated market events
- Network/multiplayer support for group campaigns

---

*Note: This design will evolve as requirements are refined and additional features are identified.*