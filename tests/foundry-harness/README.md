# Foundry Harness

The Foundry Harness provides a lightweight execution environment for running the Trading Places module outside of Foundry VTT. This enables automated testing, scenario-driven validation, and rapid development feedback.

## Features

- **Headless Mode**: Run scenarios with mocked Foundry globals for automated testing
- **Rendered Mode**: Serve templates in a browser for visual inspection
- **Deterministic Testing**: Seeded random number generation for consistent results
- **Real Module Code**: Loads and executes the actual module scripts
- **Scenario-Based**: Extensible scenario system for testing different workflows

## Quick Start

### Install Dependencies

```bash
npm install
```

### Run Default Scenarios (Headless)

```bash
npm run harness
```

### Run with Visual UI

```bash
npm run harness:ui
```

### Run Specific Scenarios

```bash
npm run harness scenarios/buying-flow.js
npm run harness scenarios/availability-only.js
```

### Run with Custom Seed

```bash
npm run harness -- --seed 12345
```

## Available Scripts

- `npm run harness` - Run default scenarios in headless mode
- `npm run harness:ui` - Run scenarios with browser UI for template inspection
- `npm run harness:ci` - Run with fixed seed for CI (deterministic results)

## Command Line Options

```bash
node tests/foundry-harness/run.js [options] [scenario-files...]

Options:
  --ui, -u              Enable rendered mode (serve templates in browser)
  --seed, -s <number>   Set random seed for deterministic results
  --scenario, -c <file> Specify scenario file to run
  --help, -h            Show help message
```

## Environment Variables

- `HARNESS_UI=1` - Enable rendered mode
- `HARNESS_SEED=<number>` - Set random seed
- `HARNESS_NO_OPEN=1` - Don't auto-open browser in UI mode

## Built-in Scenarios

### buying-flow.js
Tests the complete buying pipeline:
1. Settlement data loading
2. Merchant generation based on settlement size/wealth
3. Availability rolls with skill checks
4. Desperation reroll mechanics
5. Purchase transactions and inventory updates
6. Template rendering (in UI mode)

### availability-only.js
Quick smoke test for merchant generation:
1. Tests different settlement sizes and populations
2. Validates merchant count calculations
3. Tests wealth effects on merchant quality
4. Validates availability roll mechanics
5. Tests edge cases (minimum/maximum settlements)

## Creating Custom Scenarios

Create a new file in `tests/foundry-harness/scenarios/` that exports a default function:

```javascript
// my-scenario.js
export default async function myScenario(harness) {
    console.log('=== My Custom Scenario ===');
    
    // Access Foundry globals
    const testActor = new globalThis.Actor({
        name: 'Test Actor',
        type: 'character'
    });
    
    // Use dice rolls
    const roll = await globalThis.Roll.create('1d100');
    console.log(`Rolled: ${roll.total}`);
    
    // Test assertions
    if (roll.total < 1 || roll.total > 100) {
        throw new Error('Invalid dice roll');
    }
    
    // Render templates (UI mode only)
    if (harness.options.uiMode) {
        const html = await harness.renderTemplate('my-template.hbs', {
            actor: testActor,
            roll: roll.total
        });
    }
    
    return {
        success: true,
        rollResult: roll.total
    };
}
```

Run your scenario:

```bash
npm run harness scenarios/my-scenario.js
```

## Foundry Stubs

The harness provides minimal implementations of Foundry VTT APIs:

### Global Objects
- `game` - Basic game state with actors, settings, modules
- `CONFIG` - Configuration object
- `ui` - UI notifications and windows
- `Hooks` - Event system for module initialization

### Classes
- `Actor` - Character/NPC data with inventory and money
- `Item` - Equipment and cargo with quantities
- `Roll` - Dice rolling with seeded randomness
- `ChatMessage` - Message logging and capture

### Testing Utilities
- `createTestActor()` - Create actors with predefined inventory/money
- `getChatLog()` - Access all chat messages for assertions
- `assertChatContains()` - Verify specific messages were sent

## Architecture

### Environment Bootstrap (`environment.js`)
- Sets up Foundry globals with stubs
- Loads real module code via dynamic imports
- Manages harness lifecycle and cleanup
- Optionally starts HTTP server for UI mode

### Stubs (`stubs/`)
- **dice.js**: Seeded random number generation
- **actors.js**: Actor/Item data structures with inventory management
- **chat.js**: Message capture and testing utilities
- **ui.js**: Notifications and dialog handling
- **hooks.js**: Event system for module initialization

### Scenario Runner (`run.js`)
- CLI interface for running scenarios
- Loads and executes scenario files
- Provides result summary and exit codes
- Handles both headless and UI modes

## Development Workflow

1. **Write a scenario** that tests specific functionality
2. **Run headless** to verify logic works correctly
3. **Run with UI** to inspect visual output
4. **Add to CI** by including in default scenario list

## CI Integration

The harness is designed for continuous integration:

```yaml
# .github/workflows/test.yml
- name: Run Foundry Harness
  run: npm run harness:ci
```

The CI script uses a fixed seed for deterministic results and fails if any scenario throws an error.

## Troubleshooting

### Module Loading Errors
- Ensure `scripts/main.js` exists and exports are ES modules
- Check for missing dependencies in module code
- Verify Foundry globals are properly stubbed

### Template Rendering Issues
- Confirm template files exist in `templates/` directory
- Check Handlebars syntax in template files
- Ensure template data matches expected structure

### Dice Roll Problems
- Verify rolls use Foundry roll syntax (`1d100`, `2d6+3`, etc.)
- Check if seeded randomness is working consistently
- Use `--seed` option to reproduce specific roll sequences

### UI Mode Not Working
- Install missing dependencies: `npm install express handlebars open`
- Check if port 3000 is available
- Use `HARNESS_NO_OPEN=1` if browser doesn't open automatically

## Future Enhancements

- Visual regression testing for templates
- Multi-actor simulation support
- Recording/replay of dice roll sequences
- Integration with real Foundry datasets
- Performance benchmarking capabilities