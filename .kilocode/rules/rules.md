# Trading Places Project Rules and Guidelines

This document outlines the rules, guidelines, and standards for contributing to and maintaining the Trading Places project, a FoundryVTT module that implements the official WFRP4e trading system.

## Project Overview

Trading Places is a FoundryVTT module that implements the complete WFRP4e trading rules from the Death on the Reik Companion. The module focuses on:

- Real FoundryVTT integration with native dice rolling and chat messages
- Enriched datasets with 184 settlements and comprehensive cargo types
- Modern UI built for Game Masters and players
- Implementation of the orange-realism overhaul

## Code Structure and Architecture

### Core Components

1. **DataManager** - Centralized data access and management with validation
2. **TradingEngine** - Core trading logic coordinator
3. **BuyingAlgorithm** - Implements the official WFRP buying algorithm
4. **SellingAlgorithm** - Implements the official WFRP selling algorithm
5. **PriceCalculator** - Handles price calculations with seasonal variations
6. **MerchantGenerator** - Generates merchants with personality profiles
7. **EquilibriumCalculator** - Manages supply/demand equilibrium
8. **UI Components** - Data management and trading interfaces

### Data Structure Standards

#### Settlement Schema (orange-realism)
```json
{
  "region": "Reikland",
  "name": "ALTDORF",
  "population": 105000,
  "size": 5,
  "ruler": "Emperor Karl-Franz I",
  "wealth": 5,
  "flags": ["trade", "government"],
  "produces": ["Luxuries"],
  "demands": ["Grain", "Metal"],
  "garrison": {"a": 2000, "b": 5000, "c": 10000},
  "notes": "Imperial Capital"
}
```

#### Cargo Type Schema
```json
{
  "name": "Grain",
  "category": "Bulk Goods",
  "basePrices": {
    "spring": 1.0,
    "summer": 0.5,
    "autumn": 0.25,
    "winter": 0.5
  },
}
```

## Algorithm Implementation Standards

### Buying Algorithm (Death on the Reik Companion)

1. **Step 0**: Extract settlement information (Size, Wealth, Produces)
2. **Step 1**: Check cargo availability using (Size + Wealth) × 10% formula
3. **Step 2A**: Determine cargo type based on settlement production
4. **Step 2B**: Calculate cargo size using (Size + Wealth) × d100 method
5. **Step 3**: Calculate base price and handle price negotiation

### Selling Algorithm (Death on the Reik Companion)

1. **Step 1**: Check sale eligibility (location/time restrictions)
2. **Step 2**: Determine buyer availability using Size × 10 (+30 for Trade) formula
3. **Step 3**: Calculate offer price with wealth-based adjustments
4. **Step 4**: Handle haggling and finalization

## Data Management Standards

### Dataset Organization
- `datasets/active/` - Currently active trading dataset
- `datasets/wfrp4e-default/` - Default WFRP 4E dataset
- Settlement data organized by region in `settlements/` subdirectory
- Each region file contains an array of settlement objects

### Validation Requirements
- All data must pass schema validation before loading
- Settlements must have required fields: region, name, size, ruler, wealth, population
- Cargo types must have name, category, basePrice
- Use `npm run validate:schema` to validate data

### Migration Standards
- Population-based settlement sizing (150-105,000+)
- Automated migration scripts with backup and validation
- Flag-based settlement mechanics with configurable modifiers
- Use `npm run migrate:settlements` for migration preview

## UI/UX Guidelines

### Trading Dialog Features
- Settlement profile with economic overview
- Equilibrium visualization with color-coded state indicators
- Merchant personality display with behavioral traits
- Transaction management with undo functionality
- Chat export capabilities

### Data Management UI
- Real-time validation with inline error display
- Change tracking with visual indicators
- Batch save and preview functionality
- Export/import capabilities for data backup

## Testing Standards

### Unit Testing
- All algorithm functions must have comprehensive unit tests
- Test edge cases and boundary conditions
- Mock external dependencies appropriately
- Maintain test coverage above 80% for core modules

### Integration Testing
- Test complete trading workflows (buying and selling)
- Validate data flow between components
- Test error conditions and recovery
- Verify FoundryVTT integration points

### Test Commands
```bash
npm test              # Run all tests
npm run test:watch    # Run tests in watch mode
```

## Code Quality Standards

### JavaScript/ES6+ Standards
- Use ES6+ features where appropriate
- Prefer const over let, avoid var
- Use arrow functions for callbacks
- Implement proper error handling with try/catch
- Follow async/await patterns for asynchronous operations

### Class Structure
- Use class-based architecture with clear separation of concerns
- Implement proper constructor initialization
- Use getter/setter methods for controlled access
- Follow single responsibility principle

### Documentation
- All public methods must have JSDoc comments
- Complex algorithms should have inline comments explaining logic
- Update README.md when adding new features
- Document breaking changes in release notes

## Git Workflow

### Branching Strategy
- Use feature branches for all new development
- Branch names should follow pattern: `feature/description` or `bugfix/issue`
- Keep branches focused on a single task
- Delete branches after merging

### Commit Messages
- Use clear, concise commit messages in present tense
- Reference issue numbers when applicable
- Separate subject from body with a blank line
- Limit subject line to 50 characters

### Pull Requests
- All code changes must go through pull requests
- PRs should include a clear description of changes
- Request review from appropriate team members
- Ensure all tests pass before merging

## Module Integration Standards

### FoundryVTT Compatibility
- Target FoundryVTT v10+ compatibility
- Use system-agnostic design patterns where possible
- Implement proper module registration in `module.json`
- Follow FoundryVTT API best practices

### System Integration
- Support WFRP4e system integration
- Use system configuration for skills and talents
- Implement proper data binding to actor sheets
- Handle system-specific data structures

## Performance Guidelines

### Data Loading
- Implement lazy loading for large datasets
- Use caching strategies for frequently accessed data
- Optimize data structure access patterns
- Minimize memory footprint

### UI Performance
- Implement virtual scrolling for large data sets
- Use debouncing for search and filter operations
- Optimize rendering with proper state management
- Minimize DOM manipulation

## Security Practices

### Data Protection
- Never commit sensitive information to the repository
- Validate all user inputs
- Sanitize data before rendering
- Implement proper error handling without exposing internals

### Dependencies
- Regularly update dependencies
- Audit packages for known vulnerabilities
- Use trusted sources for external libraries
- Minimize the number of dependencies

## Release Process

### Versioning
- Follow semantic versioning (MAJOR.MINOR.PATCH)
- Increment version in `module.json` and `package.json`
- Document changes in release notes
- Tag releases in Git

### Deployment
- Test module in clean FoundryVTT instance
- Verify compatibility with latest WFRP4e system
- Update manifest URL in module distribution
- Announce releases in appropriate channels
