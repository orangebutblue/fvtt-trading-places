# Project Structure

## Root Level
- **module.json**: FoundryVTT module manifest with metadata and dependencies
- **package.json**: npm configuration for testing and development
- **README.md**: User-facing documentation and installation instructions
- **LICENSE**: MIT license file
- **validate-dataset.js**: Standalone dataset validation utility

## Core Directories

### `/scripts/`
Core module logic organized by responsibility:
- **main.js**: Module initialization, hooks, and global state management
- **data-manager.js**: Settlement and cargo data loading/validation
- **trading-engine.js**: Pure business logic for trading algorithms
- **system-adapter.js**: FoundryVTT system integration layer
- **config-validator.js**: Configuration validation and error handling
- **error-handler.js**: Centralized error handling and user feedback
- **debug-logger.js**: Debug logging system for development
- **debug-ui.js**: Debug UI components and controls
- **trading-application-v2.js**: Main trading dialog application
- **simple-trading-v2.js**: Simplified trading interface
- **fallback-dialogs-v2.js**: Fallback UI when main system fails

### `/datasets/`
Data-driven configuration system:
- **active/**: Currently active dataset (symlinked or copied)
  - **config.json**: System-specific field mappings and settings
  - **cargo-types.json**: Cargo definitions with prices and categories
  - **random-cargo-tables.json**: Random generation tables
  - **settlements/**: Individual settlement files by region
- **wfrp4e-default/**: Default WFRP 4E dataset

### `/templates/`
Handlebars templates for UI components:
- **trading-dialog.hbs**: Main trading interface
- **simple-trading.hbs**: Simplified trading interface
- **fallback-dialog.hbs**: Error fallback dialogs
- **season-selection-dialog.hbs**: Season management UI

### `/tests/`
Jest test suites organized by component:
- **trading-engine.test.js**: Core algorithm testing
- **data-manager.test.js**: Data loading and validation tests
- **system-adapter.test.js**: FoundryVTT integration tests
- **integration-workflows.test.js**: End-to-end workflow tests

### `/styles/`
- **trading.css**: All module styling and UI components

### `/lang/`
- **en.json**: English localization strings

## File Naming Conventions
- **kebab-case**: For directories and template files
- **camelCase**: For JavaScript files and variables
- **PascalCase**: For class names and constructors
- **UPPER_CASE**: For constants and configuration keys

## Module Loading Order
Scripts are loaded in dependency order as defined in module.json esmodules array:
1. Core utilities (debug-logger, error-handler, config-validator)
2. Data layer (data-manager, system-adapter)
3. Business logic (trading-engine)
4. UI components (fallback-dialogs, simple-trading, trading-application)
5. Main initialization (main.js)