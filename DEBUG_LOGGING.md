# Trading Places - Debug Logging System

## Overview

The Trading Places module includes a comprehensive debug logging system that provides detailed insights into all trading operations, calculations, and decisions. This system is designed to help developers and GMs understand exactly what's happening during trading operations and troubleshoot any issues.

## Features

### 1. Structured Logging with Consistent Format
- **Timestamped entries** with session tracking
- **Categorized logs** (DICE, CALCULATION, DECISION, ALGORITHM, USER_ACTION, SYSTEM)
- **Hierarchical log levels** (DEBUG, INFO, WARN, ERROR)
- **Formatted console output** with color coding and structured data

### 2. Dice Roll Logging with Formula, Modifiers, and Results
- Complete dice roll information including formula used
- Detailed modifier breakdown with names, values, and reasons
- Success/failure determination with clear explanations
- Target numbers and degree of success/failure

### 3. Calculation Step Logging with Input Values and Formulas
- Mathematical formulas used in calculations
- Input values and their sources
- Step-by-step calculation breakdown
- Final results with explanations

### 4. Decision Point Logging with Reasoning and Data
- Decision criteria and available options
- Reasoning behind each decision
- Context data that influenced the decision
- Alternative options that were considered

### 5. User Action Logging with Context and Consequences
- User interactions with the trading system
- Context when actions were performed
- Consequences and changes resulting from actions
- User identification and timestamps

### 6. Algorithm Step Logging with Official Rule References
- WFRP algorithm implementation steps
- References to official Death on the Reik Companion rules
- Step-by-step algorithm execution
- Data used at each algorithm step

## Usage

### Enabling Debug Logging

Debug logging can be enabled in the module settings:

1. Go to **Game Settings** → **Module Settings**
2. Find **Trading Places** settings
3. Enable **Debug Logging**
4. Logs will appear in the browser console during trading operations

### Accessing Logs Programmatically

```javascript
// Get the global logger instance
const logger = game.modules.get("trading-places").api.getLogger();

// Get log history (all categories, last 100 entries)
const allLogs = logger.getLogHistory();

// Get specific category logs
const diceLogs = logger.getLogHistory('DICE', 50);
const calculationLogs = logger.getLogHistory('CALCULATION', 50);

// Get formatted history as string
const formattedLogs = logger.getFormattedHistory('DICE', 20);
console.log(formattedLogs);

// Generate diagnostic report
const report = logger.generateDiagnosticReport();
console.log('Diagnostic Report:', report);
```

### Testing the Logging System

```javascript
// Test the logging system
game.modules.get("trading-places").api.testLogging();
```

## Log Categories

### DICE
Logs all dice rolls with complete information:
- Formula used (d100, 2d10+5, etc.)
- Modifiers applied with explanations
- Target numbers and success/failure
- Degrees of success/failure

**Example:**
```
[12:34:56] WFRP-DICE | Availability Check | Rolling d100 for Availability Check (Target: 60) = 45 - SUCCESS (45 ≤ 60)
Data: {
  "formula": "d100",
  "modifiers": [{"name": "Settlement Bonus", "value": 10, "reason": "Large settlement"}],
  "result": 45,
  "target": 60,
  "success": true,
  "reason": "45 ≤ 60"
}
```

### CALCULATION
Logs mathematical calculations with formulas and inputs:
- Formula used in the calculation
- Input values and their sources
- Step-by-step breakdown
- Final results

**Example:**
```
[12:34:56] WFRP-CALCULATION | Price Calculation | Base × Season × Wealth = 13.2 (Final price after modifiers)
Data: {
  "formula": "Base × Season × Wealth",
  "inputs": {"basePrice": 10, "seasonMultiplier": 1.2, "wealthMultiplier": 1.1},
  "result": 13.2,
  "explanation": "Final price after modifiers"
}
```

### DECISION
Logs decision points with reasoning:
- Decision made
- Criteria used for decision
- Available options
- Reasoning explanation

**Example:**
```
[12:34:56] WFRP-DECISION | Cargo Selection | Decided on 'Grain' - Settlement specializes in grain production
Data: {
  "decision": "Grain",
  "criteria": {"settlement": "Altdorf", "season": "spring"},
  "options": ["Grain", "Livestock", "Trade Goods"],
  "reasoning": "Settlement specializes in grain production"
}
```

### ALGORITHM
Logs WFRP algorithm steps with rule references:
- Algorithm name and step
- Step description
- Data used in the step
- Official rule references

**Example:**
```
[12:34:56] WFRP-ALGORITHM | WFRP Buying Algorithm-Step 1 | Cargo Availability Check [Death on the Reik Companion - Buying Algorithm]
Data: {
  "algorithm": "WFRP Buying Algorithm",
  "step": "Step 1",
  "description": "Cargo Availability Check",
  "data": {"settlement": "Altdorf", "chance": 60},
  "ruleReference": "Death on the Reik Companion - Buying Algorithm"
}
```

### USER_ACTION
Logs user interactions:
- Action performed
- Context when action occurred
- Consequences of the action
- User identification

**Example:**
```
[12:34:56] WFRP-USER_ACTION | Open Trading Dialog | User performed: Open Trading Dialog
Data: {
  "action": "Open Trading Dialog",
  "context": {"settlement": "Altdorf", "season": "spring"},
  "consequences": {"dialogOpened": true},
  "userId": "user123"
}
```

### SYSTEM
Logs system events and errors:
- Module initialization
- Data loading
- Configuration changes
- Error conditions

## API Reference

### WFRPDebugLogger Class

#### Core Methods

- `log(category, operation, message, data, level)` - Core logging method
- `setEnabled(enabled)` - Enable/disable logging
- `setLogLevel(level)` - Set minimum log level
- `clearHistory()` - Clear log history
- `getLogHistory(category, limit)` - Get filtered log history
- `exportHistory()` - Export logs as JSON

#### Specialized Logging Methods

- `logDiceRoll(operation, formula, modifiers, result, target, success, reason)`
- `logCalculation(operation, formula, inputs, result, explanation)`
- `logDecision(operation, decision, criteria, options, reasoning)`
- `logAlgorithmStep(algorithm, step, description, data, ruleReference)`
- `logUserAction(action, context, consequences, userId)`
- `logSystem(operation, message, data, level)`

#### Utility Methods

- `createScopedLogger(operation)` - Create operation-scoped logger
- `generateDiagnosticReport()` - Generate system diagnostic report
- `formatLogMessage(entry)` - Format log entry for display

### WFRPLoggingUtils Class

Utility functions for common logging patterns:

- `logWFRPRoll(logger, operation, roll, target, modifiers, formula)`
- `logAvailabilityCalculation(logger, settlement, sizeRating, wealthRating, baseChance)`
- `logPriceCalculation(logger, cargoType, basePrice, season, seasonalPrice, finalPrice, modifiers)`
- `logCargoTypeDecision(logger, settlement, selectedCargo, method)`
- `logHagglingAttempt(logger, hagglingRoll, difficulty, successLevel, priceChange, originalPrice, finalPrice)`

## Integration with Trading System

The debug logging system is automatically integrated with:

- **Trading Engine** - All algorithm steps and calculations
- **Data Manager** - Data access and validation
- **Settlement Selection** - Settlement lookup and filtering
- **Price Calculations** - All price-related calculations
- **Dice Rolling** - All random number generation
- **User Interface** - All user interactions

## Performance Considerations

- Logging is disabled by default to avoid performance impact
- Log history is limited to 1000 entries by default
- Logs are stored in memory only (not persisted)
- Console output can be filtered by category
- Export functionality available for detailed analysis

## Troubleshooting

### Common Issues

1. **No logs appearing**: Check that debug logging is enabled in module settings
2. **Too many logs**: Use category filtering to focus on specific areas
3. **Performance issues**: Disable logging when not needed for debugging
4. **Missing data**: Ensure all components are properly integrated with the logger

### Diagnostic Commands

```javascript
// Check logger status
const logger = game.modules.get("trading-places").api.getLogger();
console.log('Logger enabled:', logger.isEnabled);
console.log('Log count:', logger.logHistory.length);

// Generate diagnostic report
const report = logger.generateDiagnosticReport();
console.log(report);

// Test logging functionality
game.modules.get("trading-places").api.testLogging();
```

## Examples

### Complete Trading Operation Log Sequence

```
[12:30:00] WFRP-USER_ACTION | Open Trading Dialog | User opened trading interface
[12:30:01] WFRP-SYSTEM | Settlement Selection | Loading settlement data for Altdorf
[12:30:01] WFRP-ALGORITHM | WFRP Buying Algorithm-Step 1 | Cargo Availability Check
[12:30:01] WFRP-CALCULATION | Availability Chance | (Size + Wealth) × 10 = 60%
[12:30:01] WFRP-DICE | Availability Check | Rolling d100 = 45 - SUCCESS (45 ≤ 60)
[12:30:02] WFRP-ALGORITHM | WFRP Buying Algorithm-Step 2A | Cargo Type Determination
[12:30:02] WFRP-DECISION | Cargo Selection | Decided on 'Grain' - Settlement production match
[12:30:02] WFRP-ALGORITHM | WFRP Buying Algorithm-Step 2B | Cargo Size Calculation
[12:30:02] WFRP-DICE | Cargo Size Roll | Rolling d100 = 73 → 80 (rounded up)
[12:30:02] WFRP-CALCULATION | Cargo Size | Base × Multiplier = 7 × 80 = 560 EP
[12:30:03] WFRP-CALCULATION | Price Calculation | Base × Season = 2 × 1.2 = 2.4 GC per 10 EP
```

This comprehensive logging system ensures complete transparency in all trading operations and provides the detailed information needed for debugging and understanding the WFRP trading algorithms.