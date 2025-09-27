/**
 * Trading Places Module - Error Handling Tests
 * Tests for configuration validation and runtime error handling
 */

// Mock FoundryVTT environment
global.game = {
    version: "11.0.0",
    system: { id: "wfrp4e", title: "WFRP4e", version: "7.1.0" },
    settings: {
        get: jest.fn(),
        set: jest.fn()
    }
};

global.ui = {
    notifications: {
        error: jest.fn(),
        warn: jest.fn(),
        info: jest.fn()
    }
};

// Mock browser window with addEventListener
global.window = {
    addEventListener: jest.fn(),
    Dialog: function() {},
    ChatMessage: function() {}
};

global.Dialog = global.window.Dialog;
global.ChatMessage = global.window.ChatMessage;
global.fetch = jest.fn();

// Import classes
const ConfigValidator = require('../scripts/config-validator.js');
const RuntimeErrorHandler = require('../scripts/error-handler.js');

describe('Configuration Validation', () => {
    let configValidator;

    beforeEach(() => {
        configValidator = new ConfigValidator();
        jest.clearAllMocks();
    });

    describe('FoundryVTT Environment Validation', () => {
        test('should validate FoundryVTT environment successfully', () => {
            const result = configValidator.validateFoundryEnvironment();
            
            expect(result.valid).toBe(true);
            expect(result.environment).toBe('foundry');
            expect(result.version).toBe("11.0.0");
            expect(result.errors).toHaveLength(0);
        });

        test('should fail validation with insufficient FoundryVTT version', () => {
            // Mock older version
            game.version = "9.0.0";
            
            const result = configValidator.validateFoundryEnvironment();
            
            expect(result.valid).toBe(false);
            expect(result.errors.some(error => error.includes('FoundryVTT version 10.0.0 or higher required'))).toBe(true);
        });
    });

    describe('System Compatibility Validation', () => {
        test('should validate WFRP4e system compatibility', () => {
            const result = configValidator.validateSystemCompatibility();
            
            expect(result.valid).toBe(true);
            expect(result.systemInfo.id).toBe('wfrp4e');
            expect(result.compatibility.fullSupport).toBe(true);
        });

        test('should warn about unsupported system', () => {
            game.system.id = 'unknown-system';
            
            const result = configValidator.validateSystemCompatibility();
            
            expect(result.warnings.some(warning => warning.includes('not officially supported'))).toBe(true);
        });
    });

    describe('Configuration File Validation', () => {
        test('should validate accessible configuration file', async () => {
            // Mock successful fetch
            global.fetch.mockResolvedValueOnce({
                ok: true,
                headers: { get: () => '1024' },
                text: () => Promise.resolve('{"currency": {"field": "system.money.gc"}, "inventory": {"field": "items"}}')
            });

            const result = await configValidator.validateConfigFile('test-config.json', 'Test Config');
            
            expect(result.accessible).toBe(true);
            expect(result.validJSON).toBe(true);
            expect(result.content).toHaveProperty('currency');
        });

        test('should handle inaccessible configuration file', async () => {
            // Mock failed fetch
            global.fetch.mockResolvedValueOnce({
                ok: false,
                status: 404,
                statusText: 'Not Found'
            });

            const result = await configValidator.validateConfigFile('missing-config.json', 'Missing Config');
            
            expect(result.accessible).toBe(false);
            expect(result.parseError).toContain('HTTP 404');
        });

        test('should handle invalid JSON', async () => {
            // Mock fetch with invalid JSON
            global.fetch.mockResolvedValueOnce({
                ok: true,
                headers: { get: () => '100' },
                text: () => Promise.resolve('{ invalid json }')
            });

            const result = await configValidator.validateConfigFile('invalid-config.json', 'Invalid Config');
            
            expect(result.accessible).toBe(true);
            expect(result.validJSON).toBe(false);
            expect(result.parseError).toBeDefined();
        });
    });

    describe('Dataset Structure Validation', () => {
        test('should validate correct config structure', () => {
            const config = {
                currency: { field: 'system.money.gc' },
                inventory: { field: 'items' }
            };

            const result = configValidator.validateConfigStructure(config);
            
            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        test('should fail validation for missing config sections', () => {
            const config = {
                currency: { field: 'system.money.gc' }
                // Missing inventory section
            };

            const result = configValidator.validateConfigStructure(config);
            
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Missing required config section: inventory');
        });

        test('should validate settlements structure', () => {
            const settlements = {
                settlements: [
                    {
                        region: 'Empire',
                        name: 'Altdorf',
                        size: 'C',
                        ruler: 'Emperor Karl Franz',
                        population: 105000,
                        wealth: 5,
                        source: ['Trade', 'Government'],
                        garrison: ['100a', '200b'],
                        notes: 'Capital city'
                    }
                ]
            };

            const result = configValidator.validateSettlementsStructure(settlements);
            
            expect(result.valid).toBe(true);
            expect(result.count).toBe(1);
            expect(result.regions).toBe(1);
        });

        test('should fail validation for settlements with missing fields', () => {
            const settlements = {
                settlements: [
                    {
                        region: 'Empire',
                        name: 'Incomplete Settlement'
                        // Missing required fields
                    }
                ]
            };

            const result = configValidator.validateSettlementsStructure(settlements);
            
            expect(result.valid).toBe(false);
            expect(result.errors[0]).toContain('Missing fields');
        });
    });

    describe('Diagnostic Report Generation', () => {
        test('should generate comprehensive diagnostic report', () => {
            const validationResult = {
                valid: false,
                errors: ['Configuration file not found', 'Invalid JSON syntax'],
                warnings: ['System not fully supported'],
                timestamp: '2024-01-01T00:00:00.000Z',
                validationResults: {
                    foundry: { valid: true, errors: [], warnings: [] },
                    config: { valid: false, errors: ['File not found'], warnings: [] }
                }
            };

            const report = configValidator.generateDiagnosticReport(validationResult);
            
            expect(report).toContain('Configuration Validation Report');
            expect(report).toContain('Overall Status: FAILED');
            expect(report).toContain('Errors: 2');
            expect(report).toContain('Warnings: 1');
            expect(report).toContain('Configuration file not found');
            expect(report).toContain('RESOLUTION STEPS');
        });
    });

    describe('Error Recovery Procedures', () => {
        test('should generate specific recovery procedures', () => {
            const errors = [
                'Configuration file not accessible',
                'Invalid JSON syntax'
            ];

            const procedures = configValidator.generateErrorRecoveryProcedures(errors);
            
            expect(procedures.general).toContain('Restart FoundryVTT to reload all modules');
            expect(procedures.specific).toHaveProperty('Configuration file not accessible');
            expect(Object.keys(procedures.specific).some(key => key.includes('Invalid JSON'))).toBe(true);
            expect(procedures.priority).toBe('critical');
        });
    });
});

describe('Runtime Error Handling', () => {
    let errorHandler;

    beforeEach(() => {
        errorHandler = new RuntimeErrorHandler('test-module');
        jest.clearAllMocks();
    });

    describe('Error Logging', () => {
        test('should log error with structured information', () => {
            const errorInfo = {
                type: 'test',
                severity: 'error',
                message: 'Test error message',
                context: 'Test Context',
                timestamp: new Date().toISOString()
            };

            errorHandler.logError(errorInfo);
            
            expect(errorHandler.errorLog).toHaveLength(1);
            expect(errorHandler.errorLog[0]).toMatchObject(errorInfo);
        });

        test('should maintain log size limit', () => {
            errorHandler.maxLogEntries = 3;
            
            // Add more entries than the limit
            for (let i = 0; i < 5; i++) {
                errorHandler.logError({
                    type: 'test',
                    severity: 'info',
                    message: `Test message ${i}`,
                    context: 'Test',
                    timestamp: new Date().toISOString()
                });
            }
            
            expect(errorHandler.errorLog).toHaveLength(3);
            expect(errorHandler.errorLog[0].message).toBe('Test message 2');
        });
    });

    describe('Transaction Validation Error Handling', () => {
        test('should handle transaction validation errors', () => {
            const validationResult = {
                valid: false,
                errors: ['Insufficient currency. Has 10, needs 50'],
                warnings: []
            };

            const result = errorHandler.handleTransactionValidationError(
                validationResult, 
                'purchase', 
                { cargo: 'Grain', quantity: 50 }
            );
            
            expect(result.handled).toBe(true);
            expect(result.userMessage).toContain('don\'t have enough money');
            expect(result.canRetry).toBe(true);
            expect(result.suggestedActions).toContain('Acquire more money before attempting the purchase');
        });

        test('should identify non-retryable errors', () => {
            const validationResult = {
                valid: false,
                errors: ['Invalid settlement selected'],
                warnings: []
            };

            const result = errorHandler.handleTransactionValidationError(
                validationResult, 
                'sale', 
                { cargo: 'Wine', quantity: 10 }
            );
            
            expect(result.canRetry).toBe(false);
            expect(result.suggestedActions).toContain('Select a different settlement or check settlement requirements');
        });
    });

    describe('Trading Engine Error Handling', () => {
        test('should handle recoverable trading engine errors', () => {
            const error = new Error('Network timeout during price calculation');
            
            const result = errorHandler.handleTradingEngineError(error, 'calculatePrice', { cargo: 'Grain' });
            
            expect(result.handled).toBe(true);
            expect(result.recoverable).toBe(true);
            expect(result.canRetry).toBe(true);
            expect(ui.notifications.error).toHaveBeenCalled();
        });

        test('should handle non-recoverable trading engine errors', () => {
            const error = new Error('Critical system configuration missing');
            error.name = 'ConfigurationError';
            
            const result = errorHandler.handleTradingEngineError(error, 'initializeSystem');
            
            expect(result.handled).toBe(true);
            expect(result.recoverable).toBe(false);
            expect(result.canRetry).toBe(false);
        });
    });

    describe('Data Loading Error Handling', () => {
        test('should handle data loading errors', () => {
            const error = new Error('Failed to fetch settlements.json');
            
            const result = errorHandler.handleDataLoadingError(error, 'Settlement Data', 'file system');
            
            expect(result.handled).toBe(true);
            expect(result.recoverable).toBe(false);
            expect(result.suggestedActions).toContain('Check if the data files exist and are accessible');
            expect(ui.notifications.error).toHaveBeenCalledWith(
                expect.stringContaining('Failed to load Settlement Data'),
                { permanent: true }
            );
        });
    });

    describe('UI Error Handling', () => {
        test('should handle UI component errors', () => {
            const error = new Error('Dialog rendering failed');
            
            const result = errorHandler.handleUIError(error, 'TradingDialog', { options: {} });
            
            expect(result.handled).toBe(true);
            expect(result.recoverable).toBe(true);
            expect(result.suggestedActions).toContain('Try refreshing the dialog or interface');
            expect(ui.notifications.warn).toHaveBeenCalled();
        });
    });

    describe('Graceful Degradation', () => {
        test('should execute fallback function on error', () => {
            const error = new Error('Feature unavailable');
            const fallbackFunction = jest.fn(() => 'fallback result');
            
            const result = errorHandler.gracefulDegradation(error, 'TestFeature', fallbackFunction);
            
            expect(fallbackFunction).toHaveBeenCalled();
            expect(result).toBe('fallback result');
            expect(ui.notifications.info).toHaveBeenCalledWith(
                expect.stringContaining('TestFeature is using reduced functionality')
            );
        });

        test('should handle fallback function failure', () => {
            const error = new Error('Feature unavailable');
            const fallbackFunction = jest.fn(() => { throw new Error('Fallback failed'); });
            
            const result = errorHandler.gracefulDegradation(error, 'TestFeature', fallbackFunction);
            
            expect(result).toBeNull();
            expect(ui.notifications.error).toHaveBeenCalledWith(
                expect.stringContaining('TestFeature is temporarily unavailable')
            );
        });
    });

    describe('Error Summary Generation', () => {
        test('should generate error summary', () => {
            // Add some test errors
            errorHandler.logError({
                type: 'test',
                severity: 'error',
                message: 'Test error 1',
                context: 'Test Context',
                timestamp: new Date().toISOString()
            });
            
            errorHandler.logError({
                type: 'validation',
                severity: 'warning',
                message: 'Test warning 1',
                context: 'Validation Context',
                timestamp: new Date().toISOString()
            });

            const summary = errorHandler.generateErrorSummary();
            
            expect(summary.totalErrors).toBe(2);
            expect(summary.bySeverity.error).toBe(1);
            expect(summary.bySeverity.warning).toBe(1);
            expect(summary.byType.test).toBe(1);
            expect(summary.byType.validation).toBe(1);
            expect(summary.recentErrors).toHaveLength(2);
        });
    });

    describe('User-Friendly Message Generation', () => {
        test('should generate user-friendly messages for common errors', () => {
            const errors = ['Insufficient currency. Has 10, needs 50'];
            const message = errorHandler.generateUserFriendlyMessage(errors, 'purchase');
            
            expect(message).toBe('You don\'t have enough money for this transaction');
        });

        test('should handle unknown errors gracefully', () => {
            const errors = ['Some unknown technical error occurred'];
            const message = errorHandler.generateUserFriendlyMessage(errors, 'operation');
            
            expect(message).toBe('Some unknown technical error occurred');
        });
    });
});

describe('Error Handler Integration', () => {
    test('should integrate with global error handlers', () => {
        const errorHandler = new RuntimeErrorHandler('test-module');
        
        // Verify global error handlers are set up
        expect(typeof errorHandler.setupGlobalErrorHandlers).toBe('function');
        expect(errorHandler.originalConsole).toBeDefined();
        expect(errorHandler.originalConsole.error).toBe(console.error);
    });

    test('should handle debug mode settings', () => {
        game.settings.get.mockReturnValue(true);
        
        const errorHandler = new RuntimeErrorHandler('test-module');
        errorHandler.initializeDebugMode();
        
        expect(errorHandler.debugMode).toBe(true);
    });
});