# Technology Stack

## Platform
- **FoundryVTT Module**: ES6 modules for FoundryVTT v10+
- **JavaScript**: Pure ES6+ with no external runtime dependencies
- **Handlebars**: Template engine for UI components
- **CSS**: Standard CSS for styling

## Build System
- **Package Manager**: npm
- **Testing**: Jest test framework
- **No Build Process**: Direct ES6 modules, no compilation required

## Common Commands
```bash
# Run tests
npm test

# Run tests in watch mode
npm test:watch

# Validate dataset integrity
node validate-dataset.js
```

## Architecture Patterns
- **Modular Design**: Separate classes for each major component
- **Dependency Injection**: Logger and system adapter injection
- **Pure Business Logic**: Core trading engine has no FoundryVTT dependencies
- **System Agnostic**: Dataset-driven configuration for different game systems
- **Error Handling**: Centralized error handling with fallback mechanisms

## Key Libraries & APIs
- **FoundryVTT API**: Hooks, settings, dice rolling, chat messages
- **Handlebars**: Template rendering for dialogs and UI
- **Jest**: Unit testing framework
- **No external dependencies**: Self-contained module

## Code Style
- **ES6 Classes**: Object-oriented architecture
- **JSDoc Comments**: Comprehensive documentation for all methods
- **Async/Await**: Modern promise handling
- **Modular Exports**: Each script exports specific classes/functions
- **Consistent Naming**: camelCase for variables/methods, PascalCase for classes