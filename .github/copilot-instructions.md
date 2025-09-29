# Trading Places - AI Coding Instructions
- When you are asked a question, ANSWER IMMEDIATELY
- Do NOT make any code changes when asked a question!
- DO NOT change any files without my direct approval

## Project Overview
This is a FoundryVTT module for the Warhammer Fantasy Roleplay 4th Edition (WFRP4e) system, implementing comprehensive trading mechanics including buying, selling, price calculation, settlement selection, and player cargo management.

## Architecture & Patterns

### Module Structure
- **Entry Point**: `scripts/main.js` - Module initialization, settings registration, component loading
- **Core Engine**: `scripts/trading-engine.js` - Pure business logic for trading algorithms (2179 lines)
- **Data Layer**: `scripts/data-manager.js` - Settlement/cargo data management with validation (1803 lines)
- **System Integration**: `scripts/system-adapter.js` - Configuration-driven FoundryVTT integration (726 lines)
- **UI Components**: `scripts/trading-application-v2.js` - ApplicationV2-based dialogs
- **Algorithms**: Separate buying/selling/price calculation modules in `scripts/`

### Key Design Patterns
- **Modular Architecture**: Each major feature has its own module with clear separation of concerns
- **Configuration-Driven**: SystemAdapter uses config objects for FoundryVTT integration
- **Error Handling**: Comprehensive error handling with custom ErrorHandler class
- **Testing**: Extensive Jest test suite (480 tests) with mocks and integration tests
- **ES6 Modules**: Modern JavaScript with Babel transpilation for Node compatibility

### Development Workflow

#### Testing
```bash
npm test              # Run all tests
npm run test:watch    # Watch mode for development
```

#### File Organization
- `scripts/` - Core business logic and FoundryVTT integration
- `templates/` - Handlebars templates for UI dialogs
- `styles/` - CSS styling
- `datasets/` - JSON data files for settlements and cargo
- `tests/` - Jest test files with comprehensive coverage
- `lang/` - Localization files

#### Code Style & Conventions
- **Async/Await**: Preferred over Promises for asynchronous operations
- **Error Handling**: Use try/catch with custom error types from ErrorHandler
- **Configuration**: Pass config objects to constructors for flexibility
- **Validation**: Validate inputs using dedicated validator modules
- **Logging**: Use DebugLogger for consistent logging across the module

### Common Tasks & Patterns

#### Adding New Trading Features
1. Create new algorithm module in `scripts/` (e.g., `new-feature.js`)
2. Add to `module.json` esmodules array
3. Import and initialize in `main.js`
4. Create comprehensive tests in `tests/`
5. Update UI templates if needed

#### Data Management
- Use DataManager for all data access
- Validate data with config-validator.js
- Handle seasonal pricing through data structures
- Cache frequently accessed data

#### UI Development
- Use ApplicationV2 for dialogs
- Handlebars templates in `templates/`
- CSS in `styles/trading.css`
- Hot reload enabled for CSS and HBS files

#### System Integration
- Use SystemAdapter for FoundryVTT interactions
- Configure through config objects
- Handle currency, inventory, and chat integration
- Support multiple WFRP systems if needed

### Testing Patterns
- **Unit Tests**: Test individual functions/classes
- **Integration Tests**: Test component interactions
- **Mock Usage**: Mock FoundryVTT globals and system functions
- **Test Data**: Use datasets for realistic test scenarios
- **Coverage**: Aim for high coverage on business logic

### Error Handling
- Use ErrorHandler class for consistent error management
- Custom error types for different failure modes
- Graceful degradation with fallback dialogs
- Comprehensive logging for debugging

### Performance Considerations
- Cache settlement and cargo data
- Lazy load UI components
- Optimize algorithm calculations
- Use efficient data structures for lookups

### Deployment
- Module distributed via GitHub releases
- Manifest and download URLs in module.json
- Compatibility specified for FoundryVTT v13
- Hot reload for development

### Key Dependencies
- **Jest**: Testing framework with jsdom environment
- **Babel**: ES6 transpilation for compatibility
- **FoundryVTT**: Target platform with WFRP4e system
- **Handlebars**: Template engine for UI

### Gotchas & Best Practices
- Always use absolute paths in module.json
- Test in jsdom environment (not Node)
- Handle async operations properly in FoundryVTT hooks
- Validate all user inputs
- Use configuration objects for flexibility
- Keep business logic separate from UI code
- Comprehensive error handling prevents crashes
- Mock all external dependencies in tests