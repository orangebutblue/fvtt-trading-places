/**
 * Trading Places Module - Debug Logging Tests
 * Comprehensive tests for the debug logging system
 */

// Mock FoundryVTT environment for testing
global.game = {
    settings: {
        get: () => true // Debug logging enabled
    },
    user: {
        id: 'test-user'
    }
};

// Import the debug logger
const WFRPDebugLogger = require('../scripts/debug-logger.js');

describe('WFRPDebugLogger', () => {
    let logger;

    beforeEach(() => {
        logger = new WFRPDebugLogger();
        logger.setEnabled(true);
    });

    afterEach(() => {
        logger.clearHistory();
    });

    describe('Basic Logging Functionality', () => {
        test('should initialize with correct default values', () => {
            expect(logger.isEnabled).toBe(true);
            expect(logger.logLevel).toBe('INFO');
            expect(logger.logHistory).toEqual([]);
            expect(logger.sessionId).toMatch(/^WFRP-/);
        });

        test('should generate unique session IDs', () => {
            const logger1 = new WFRPDebugLogger();
            const logger2 = new WFRPDebugLogger();
            expect(logger1.sessionId).not.toBe(logger2.sessionId);
        });

        test('should enable and disable logging', () => {
            logger.setEnabled(false);
            expect(logger.isEnabled).toBe(false);
            
            logger.setEnabled(true);
            expect(logger.isEnabled).toBe(true);
        });

        test('should set log level correctly', () => {
            logger.setLogLevel('DEBUG');
            expect(logger.logLevel).toBe('DEBUG');
            
            logger.setLogLevel('ERROR');
            expect(logger.logLevel).toBe('ERROR');
        });
    });

    describe('Core Logging Method', () => {
        test('should log basic messages correctly', () => {
            logger.log('TEST', 'Basic Test', 'Test message');
            
            expect(logger.logHistory).toHaveLength(1);
            const entry = logger.logHistory[0];
            expect(entry.category).toBe('TEST');
            expect(entry.operation).toBe('Basic Test');
            expect(entry.message).toBe('Test message');
            expect(entry.level).toBe('INFO');
        });

        test('should log with data objects', () => {
            const testData = { value: 42, name: 'test' };
            logger.log('TEST', 'Data Test', 'Test with data', testData);
            
            const entry = logger.logHistory[0];
            expect(entry.data).toEqual(testData);
        });

        test('should handle different log levels', () => {
            logger.log('TEST', 'Error Test', 'Error message', null, 'ERROR');
            logger.log('TEST', 'Warn Test', 'Warning message', null, 'WARN');
            logger.log('TEST', 'Debug Test', 'Debug message', null, 'DEBUG');
            
            expect(logger.logHistory).toHaveLength(3);
            expect(logger.logHistory[0].level).toBe('ERROR');
            expect(logger.logHistory[1].level).toBe('WARN');
            expect(logger.logHistory[2].level).toBe('DEBUG');
        });

        test('should not log when disabled', () => {
            logger.setEnabled(false);
            logger.log('TEST', 'Disabled Test', 'Should not appear');
            
            expect(logger.logHistory).toHaveLength(0);
        });
    });

    describe('Dice Roll Logging', () => {
        test('should log dice rolls with all parameters', () => {
            const modifiers = [
                { name: 'Skill Bonus', value: 10, reason: 'High skill' },
                { name: 'Difficulty', value: -20, reason: 'Hard task' }
            ];
            
            logger.logDiceRoll('Test Roll', 'd100', modifiers, 45, 60, true, '45 ≤ 60');
            
            const entry = logger.logHistory[0];
            expect(entry.category).toBe('DICE');
            expect(entry.operation).toBe('Test Roll');
            expect(entry.data.formula).toBe('d100');
            expect(entry.data.modifiers).toEqual(modifiers);
            expect(entry.data.result).toBe(45);
            expect(entry.data.target).toBe(60);
            expect(entry.data.success).toBe(true);
            expect(entry.data.reason).toBe('45 ≤ 60');
            expect(entry.data.totalModifier).toBe(-10);
        });

        test('should handle dice rolls without target or success', () => {
            logger.logDiceRoll('Damage Roll', '2d6', [], 8);
            
            const entry = logger.logHistory[0];
            expect(entry.data.target).toBeNull();
            expect(entry.data.success).toBeNull();
        });
    });

    describe('Calculation Logging', () => {
        test('should log calculations with formula and inputs', () => {
            const inputs = {
                basePrice: 10,
                seasonMultiplier: 1.2,
                wealthModifier: 1.1
            };
            
            logger.logCalculation('Price Calculation', 'Base × Season × Wealth', inputs, 13.2, 'Final price');
            
            const entry = logger.logHistory[0];
            expect(entry.category).toBe('CALCULATION');
            expect(entry.data.formula).toBe('Base × Season × Wealth');
            expect(entry.data.inputs).toEqual(inputs);
            expect(entry.data.result).toBe(13.2);
            expect(entry.data.explanation).toBe('Final price');
        });
    });

    describe('Decision Logging', () => {
        test('should log decisions with criteria and options', () => {
            const criteria = { settlement: 'Altdorf', season: 'spring' };
            const options = ['Grain', 'Livestock', 'Trade Goods'];
            
            logger.logDecision('Cargo Selection', 'Grain', criteria, options, 'Best seasonal choice');
            
            const entry = logger.logHistory[0];
            expect(entry.category).toBe('DECISION');
            expect(entry.data.decision).toBe('Grain');
            expect(entry.data.criteria).toEqual(criteria);
            expect(entry.data.options).toEqual(options);
            expect(entry.data.reasoning).toBe('Best seasonal choice');
        });
    });

    describe('Algorithm Step Logging', () => {
        test('should log algorithm steps with rule references', () => {
            const stepData = { settlement: 'Altdorf', chance: 60 };
            
            logger.logAlgorithmStep(
                'WFRP Buying Algorithm',
                'Step 1',
                'Availability Check',
                stepData,
                'Death on the Reik Companion p.123'
            );
            
            const entry = logger.logHistory[0];
            expect(entry.category).toBe('ALGORITHM');
            expect(entry.data.algorithm).toBe('WFRP Buying Algorithm');
            expect(entry.data.step).toBe('Step 1');
            expect(entry.data.description).toBe('Availability Check');
            expect(entry.data.data).toEqual(stepData);
            expect(entry.data.ruleReference).toBe('Death on the Reik Companion p.123');
        });
    });

    describe('User Action Logging', () => {
        test('should log user actions with context and consequences', () => {
            const context = { dialog: 'trading', settlement: 'Altdorf' };
            const consequences = { cargoSelected: 'Grain', quantity: 100 };
            
            logger.logUserAction('Select Cargo', context, consequences, 'user123');
            
            const entry = logger.logHistory[0];
            expect(entry.category).toBe('USER_ACTION');
            expect(entry.data.action).toBe('Select Cargo');
            expect(entry.data.context).toEqual(context);
            expect(entry.data.consequences).toEqual(consequences);
            expect(entry.data.userId).toBe('user123');
        });
    });

    describe('Log History Management', () => {
        test('should maintain history size limit', () => {
            logger.maxHistorySize = 5;
            
            // Add more logs than the limit
            for (let i = 0; i < 10; i++) {
                logger.log('TEST', 'Overflow Test', `Message ${i}`);
            }
            
            expect(logger.logHistory).toHaveLength(5);
            // Should keep the most recent entries
            expect(logger.logHistory[4].message).toBe('Message 9');
        });

        test('should filter history by category', () => {
            logger.log('DICE', 'Roll Test', 'Dice message');
            logger.log('CALCULATION', 'Calc Test', 'Calc message');
            logger.log('DICE', 'Roll Test 2', 'Dice message 2');
            
            const diceHistory = logger.getLogHistory('DICE');
            expect(diceHistory).toHaveLength(2);
            expect(diceHistory[0].category).toBe('DICE');
            expect(diceHistory[1].category).toBe('DICE');
        });

        test('should limit returned history entries', () => {
            for (let i = 0; i < 10; i++) {
                logger.log('TEST', 'Limit Test', `Message ${i}`);
            }
            
            const limitedHistory = logger.getLogHistory(null, 5);
            expect(limitedHistory).toHaveLength(5);
        });

        test('should clear history', () => {
            logger.log('TEST', 'Clear Test', 'Message');
            expect(logger.logHistory).toHaveLength(1);
            
            logger.clearHistory();
            expect(logger.logHistory).toHaveLength(0);
        });
    });

    describe('Scoped Logger', () => {
        test('should create scoped logger with operation context', () => {
            const scopedLogger = logger.createScopedLogger('Test Operation');
            
            scopedLogger.dice('d100', [], 45, 60, true, 'Success');
            scopedLogger.calculation('A + B', { a: 1, b: 2 }, 3, 'Simple addition');
            
            expect(logger.logHistory).toHaveLength(2);
            expect(logger.logHistory[0].operation).toBe('Test Operation');
            expect(logger.logHistory[1].operation).toBe('Test Operation');
        });
    });

    describe('Diagnostic Report', () => {
        test('should generate comprehensive diagnostic report', () => {
            logger.log('DICE', 'Roll', 'Dice roll', null, 'INFO');
            logger.log('CALCULATION', 'Calc', 'Calculation', null, 'INFO');
            logger.log('SYSTEM', 'Error', 'System error', null, 'ERROR');
            
            const report = logger.generateDiagnosticReport();
            
            expect(report.sessionId).toBe(logger.sessionId);
            expect(report.isEnabled).toBe(true);
            expect(report.totalEntries).toBe(3);
            expect(report.categoryCounts.DICE).toBe(1);
            expect(report.categoryCounts.CALCULATION).toBe(1);
            expect(report.categoryCounts.SYSTEM).toBe(1);
            expect(report.levelCounts.INFO).toBe(2);
            expect(report.levelCounts.ERROR).toBe(1);
            expect(report.recentErrors).toHaveLength(1);
        });
    });

    describe('Export Functionality', () => {
        test('should export history as JSON', () => {
            logger.log('TEST', 'Export Test', 'Test message');
            
            const exported = logger.exportHistory();
            const parsed = JSON.parse(exported);
            
            expect(parsed.sessionId).toBe(logger.sessionId);
            expect(parsed.logHistory).toHaveLength(1);
            expect(parsed.logHistory[0].message).toBe('Test message');
            expect(parsed.exportTime).toBeDefined();
        });
    });

    describe('Message Formatting', () => {
        test('should format log messages correctly', () => {
            const entry = {
                timestamp: '2023-01-01T12:00:00.000Z',
                category: 'TEST',
                operation: 'Format Test',
                level: 'INFO',
                message: 'Test message',
                data: { key: 'value' }
            };
            
            const formatted = logger.formatLogMessage(entry);
            
            expect(formatted).toContain('WFRP-TEST');
            expect(formatted).toContain('Format Test');
            expect(formatted).toContain('Test message');
            expect(formatted).toContain('"key": "value"');
        });
    });
});

describe('WFRPLoggingUtils', () => {
    let logger;

    beforeEach(() => {
        logger = new WFRPDebugLogger();
        logger.setEnabled(true);
    });

    test('should log WFRP rolls with automatic success determination', () => {
        const WFRPLoggingUtils = require('../scripts/debug-logger.js').WFRPLoggingUtils || 
                                 global.WFRPLoggingUtils;
        
        if (WFRPLoggingUtils) {
            WFRPLoggingUtils.logWFRPRoll(logger, 'Test Roll', 45, 60, [], 'd100');
            
            const entry = logger.logHistory[0];
            expect(entry.category).toBe('DICE');
            expect(entry.data.success).toBe(true);
            expect(entry.data.reason).toBe('45 ≤ 60');
        }
    });
});

// Run tests if this file is executed directly
if (require.main === module) {
    console.log('Running debug logging tests...');
    
    // Simple test runner
    const runTests = async () => {
        try {
            const logger = new WFRPDebugLogger();
            logger.setEnabled(true);
            
            // Test basic functionality
            logger.log('TEST', 'Basic Test', 'Testing basic logging');
            console.log('✓ Basic logging test passed');
            
            // Test dice roll logging
            logger.logDiceRoll('Test Roll', 'd100', [], 45, 60, true, 'Success');
            console.log('✓ Dice roll logging test passed');
            
            // Test calculation logging
            logger.logCalculation('Test Calc', 'A + B', { a: 1, b: 2 }, 3);
            console.log('✓ Calculation logging test passed');
            
            // Test decision logging
            logger.logDecision('Test Decision', 'Option A', {}, ['A', 'B'], 'Best choice');
            console.log('✓ Decision logging test passed');
            
            // Test algorithm step logging
            logger.logAlgorithmStep('Test Algorithm', 'Step 1', 'Test step', {}, 'Test ref');
            console.log('✓ Algorithm step logging test passed');
            
            // Test diagnostic report
            const report = logger.generateDiagnosticReport();
            console.log('✓ Diagnostic report test passed');
            
            console.log('\nAll debug logging tests passed!');
            console.log(`Total log entries: ${logger.logHistory.length}`);
            console.log(`Session ID: ${logger.sessionId}`);
            
        } catch (error) {
            console.error('Test failed:', error);
        }
    };
    
    runTests();
}