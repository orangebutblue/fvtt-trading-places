/**
 * Trading Places Module - Runtime Error Handler
 * Comprehensive error handling and user feedback system
 */

/**
 * Runtime Error Handler class for managing errors and user feedback
 */
class RuntimeErrorHandler {
    constructor(moduleId = "trading-places") {
        this.moduleId = moduleId;
        this.errorLog = [];
        this.debugMode = false;
        this.maxLogEntries = 100;
        this.userNotificationSettings = {
            showCriticalErrors: true,
            showWarnings: true,
            showInfoMessages: true,
            persistentErrors: true
        };
        
        // Initialize debug mode from settings
        this.initializeDebugMode();
        
        // Set up global error handlers
        this.setupGlobalErrorHandlers();
    }

    /**
     * Initialize debug mode from FoundryVTT settings
     */
    initializeDebugMode() {
        if (typeof game !== 'undefined' && game.settings) {
            try {
                this.debugMode = game.settings.get(this.moduleId, "debugLogging") || false;
            } catch (error) {
                // Settings not available yet, use default
                this.debugMode = false;
            }
        }
    }

    /**
     * Set up global error handlers for the module
     */
    setupGlobalErrorHandlers() {
        // Store original console methods
        this.originalConsole = {
            error: console.error,
            warn: console.warn,
            log: console.log
        };

        // Set up window error handler for module-specific errors
        if (typeof window !== 'undefined') {
            window.addEventListener('error', (event) => {
                if (event.filename && event.filename.includes('trading-places')) {
                    this.handleGlobalError(event.error, 'Global Error', {
                        filename: event.filename,
                        lineno: event.lineno,
                        colno: event.colno
                    });
                }
            });

            window.addEventListener('unhandledrejection', (event) => {
                if (event.reason && event.reason.stack && event.reason.stack.includes('trading-places')) {
                    this.handleGlobalError(event.reason, 'Unhandled Promise Rejection');
                }
            });
        }
    }

    /**
     * Handle global errors
     * @param {Error} error - Error object
     * @param {string} context - Error context
     * @param {Object} details - Additional error details
     */
    handleGlobalError(error, context = 'Unknown', details = {}) {
        const errorInfo = {
            type: 'global',
            severity: 'critical',
            message: error.message,
            stack: error.stack,
            context: context,
            details: details,
            timestamp: new Date().toISOString()
        };

        this.logError(errorInfo);
        this.notifyUser('critical', `Global error in Trading Places: ${error.message}`, true);
    }

    /**
     * Log error with structured information
     * @param {Object} errorInfo - Structured error information
     */
    logError(errorInfo) {
        // Add to error log
        this.errorLog.push(errorInfo);
        
        // Maintain log size limit
        if (this.errorLog.length > this.maxLogEntries) {
            this.errorLog = this.errorLog.slice(-this.maxLogEntries);
        }

        // Console logging based on severity and debug mode
        const logMessage = `[${errorInfo.timestamp}] ${errorInfo.context}: ${errorInfo.message}`;
        
        switch (errorInfo.severity) {
            case 'critical':
                this.originalConsole.error(`Trading Places | CRITICAL: ${logMessage}`, errorInfo);
                break;
            case 'error':
                this.originalConsole.error(`Trading Places | ERROR: ${logMessage}`, errorInfo);
                break;
            case 'warning':
                this.originalConsole.warn(`Trading Places | WARNING: ${logMessage}`, errorInfo);
                break;
            case 'info':
                if (this.debugMode) {
                    this.originalConsole.log(`Trading Places | INFO: ${logMessage}`, errorInfo);
                }
                break;
        }
    }

    /**
     * Handle transaction validation errors
     * @param {Object} validationResult - Validation result from SystemAdapter
     * @param {string} transactionType - Type of transaction (purchase/sale)
     * @param {Object} transactionData - Transaction data
     * @returns {Object} - Handled error result
     */
    handleTransactionValidationError(validationResult, transactionType, transactionData) {
        const errorInfo = {
            type: 'transaction_validation',
            severity: 'error',
            message: `Transaction validation failed: ${validationResult.errors.join(', ')}`,
            context: `${transactionType} transaction`,
            details: {
                transactionType: transactionType,
                transactionData: transactionData,
                validationErrors: validationResult.errors,
                validationWarnings: validationResult.warnings
            },
            timestamp: new Date().toISOString()
        };

        this.logError(errorInfo);

        // Generate user-friendly error message
        const userMessage = this.generateUserFriendlyMessage(validationResult.errors, transactionType);
        this.notifyUser('error', userMessage);

        return {
            handled: true,
            userMessage: userMessage,
            canRetry: this.canRetryTransaction(validationResult.errors),
            suggestedActions: this.getSuggestedActions(validationResult.errors, transactionType)
        };
    }

    /**
     * Handle trading engine errors
     * @param {Error} error - Error from trading engine
     * @param {string} operation - Trading operation that failed
     * @param {Object} operationData - Data related to the operation
     * @returns {Object} - Handled error result
     */
    handleTradingEngineError(error, operation, operationData = {}) {
        const errorInfo = {
            type: 'trading_engine',
            severity: this.determineSeverity(error, operation),
            message: error.message,
            stack: error.stack,
            context: `Trading Engine - ${operation}`,
            details: {
                operation: operation,
                operationData: operationData,
                errorName: error.name
            },
            timestamp: new Date().toISOString()
        };

        this.logError(errorInfo);

        // Check if this is a recoverable error
        const isRecoverable = this.isRecoverableError(error, operation);
        const userMessage = this.generateTradingErrorMessage(error, operation, isRecoverable);
        
        this.notifyUser(errorInfo.severity, userMessage, !isRecoverable);

        return {
            handled: true,
            recoverable: isRecoverable,
            userMessage: userMessage,
            suggestedActions: this.getTradingErrorActions(error, operation),
            canRetry: isRecoverable
        };
    }

    /**
     * Handle data loading errors
     * @param {Error} error - Data loading error
     * @param {string} dataType - Type of data being loaded
     * @param {string} source - Data source (file, API, etc.)
     * @returns {Object} - Handled error result
     */
    handleDataLoadingError(error, dataType, source) {
        const errorInfo = {
            type: 'data_loading',
            severity: 'critical',
            message: error.message,
            stack: error.stack,
            context: `Data Loading - ${dataType}`,
            details: {
                dataType: dataType,
                source: source,
                errorName: error.name
            },
            timestamp: new Date().toISOString()
        };

        this.logError(errorInfo);

        const userMessage = `Failed to load ${dataType} data from ${source}. The trading system may not function properly.`;
        this.notifyUser('critical', userMessage, true);

        return {
            handled: true,
            recoverable: false,
            userMessage: userMessage,
            suggestedActions: [
                'Check if the data files exist and are accessible',
                'Verify JSON syntax in data files',
                'Try switching to the default dataset',
                'Restart FoundryVTT',
                'Contact the module developer if the issue persists'
            ]
        };
    }

    /**
     * Handle UI errors
     * @param {Error} error - UI error
     * @param {string} component - UI component that failed
     * @param {Object} componentData - Data related to the component
     * @returns {Object} - Handled error result
     */
    handleUIError(error, component, componentData = {}) {
        const errorInfo = {
            type: 'ui_error',
            severity: 'warning',
            message: error.message,
            stack: error.stack,
            context: `UI Component - ${component}`,
            details: {
                component: component,
                componentData: componentData,
                errorName: error.name
            },
            timestamp: new Date().toISOString()
        };

        this.logError(errorInfo);

        const userMessage = `UI component '${component}' encountered an error. Some features may not work correctly.`;
        this.notifyUser('warning', userMessage);

        return {
            handled: true,
            recoverable: true,
            userMessage: userMessage,
            suggestedActions: [
                'Try refreshing the dialog or interface',
                'Close and reopen the trading dialog',
                'Check browser console for more details',
                'Report the issue if it persists'
            ]
        };
    }

    /**
     * Determine error severity based on error type and operation
     * @param {Error} error - Error object
     * @param {string} operation - Operation context
     * @returns {string} - Severity level
     */
    determineSeverity(error, operation) {
        // Critical operations that should never fail
        const criticalOperations = ['loadActiveDataset', 'initializeSystem', 'validateConfiguration'];
        if (criticalOperations.includes(operation)) {
            return 'critical';
        }

        // Check error type
        if (error.name === 'ValidationError' || error.name === 'ConfigurationError') {
            return 'error';
        }

        if (error.name === 'NetworkError' || error.name === 'TimeoutError') {
            return 'warning';
        }

        // Default based on message content
        if (error.message.toLowerCase().includes('critical') || error.message.toLowerCase().includes('fatal')) {
            return 'critical';
        }

        if (error.message.toLowerCase().includes('warning') || error.message.toLowerCase().includes('deprecated')) {
            return 'warning';
        }

        return 'error';
    }

    /**
     * Check if an error is recoverable
     * @param {Error} error - Error object
     * @param {string} operation - Operation context
     * @returns {boolean} - True if recoverable
     */
    isRecoverableError(error, operation) {
        // Non-recoverable error types
        const nonRecoverableErrors = ['ConfigurationError', 'ValidationError', 'SystemError'];
        if (nonRecoverableErrors.includes(error.name)) {
            return false;
        }

        // Non-recoverable operations
        const nonRecoverableOperations = ['initializeSystem', 'loadConfiguration'];
        if (nonRecoverableOperations.includes(operation)) {
            return false;
        }

        // Check error message for non-recoverable indicators
        const nonRecoverableKeywords = ['fatal', 'critical', 'corrupted', 'missing required'];
        const errorMessage = error.message.toLowerCase();
        
        for (const keyword of nonRecoverableKeywords) {
            if (errorMessage.includes(keyword)) {
                return false;
            }
        }

        return true;
    }

    /**
     * Generate user-friendly error message
     * @param {Array} errors - Array of error messages
     * @param {string} context - Error context
     * @returns {string} - User-friendly message
     */
    generateUserFriendlyMessage(errors, context) {
        if (!errors || errors.length === 0) {
            return `An unknown error occurred during ${context}`;
        }

        const primaryError = errors[0];
        
        // Common error patterns and their user-friendly messages
        const errorPatterns = {
            'insufficient currency': 'You don\'t have enough money for this transaction',
            'insufficient cargo': 'You don\'t have enough cargo to sell',
            'invalid settlement': 'The selected settlement is not valid for this transaction',
            'missing required field': 'Some required information is missing',
            'network error': 'Unable to connect to the server. Please try again',
            'permission denied': 'You don\'t have permission to perform this action',
            'file not found': 'Required data files are missing',
            'invalid json': 'Configuration files are corrupted'
        };

        for (const [pattern, message] of Object.entries(errorPatterns)) {
            if (primaryError.toLowerCase().includes(pattern)) {
                return message;
            }
        }

        // Fallback to simplified error message
        return primaryError.replace(/^[A-Z][a-z]+Error:\s*/, '');
    }

    /**
     * Generate trading-specific error message
     * @param {Error} error - Error object
     * @param {string} operation - Trading operation
     * @param {boolean} isRecoverable - Whether the error is recoverable
     * @returns {string} - User-friendly message
     */
    generateTradingErrorMessage(error, operation, isRecoverable) {
        const baseMessage = this.generateUserFriendlyMessage([error.message], operation);
        
        if (isRecoverable) {
            return `${baseMessage}. You can try again.`;
        } else {
            return `${baseMessage}. Please check your configuration and restart if necessary.`;
        }
    }

    /**
     * Check if transaction can be retried
     * @param {Array} errors - Validation errors
     * @returns {boolean} - True if can retry
     */
    canRetryTransaction(errors) {
        const nonRetryableErrors = [
            'invalid settlement',
            'missing required field',
            'configuration error',
            'system incompatibility'
        ];

        return !errors.some(error => 
            nonRetryableErrors.some(pattern => 
                error.toLowerCase().includes(pattern)
            )
        );
    }

    /**
     * Get suggested actions for errors
     * @param {Array} errors - Array of errors
     * @param {string} context - Error context
     * @returns {Array} - Array of suggested actions
     */
    getSuggestedActions(errors, context) {
        const actions = [];
        
        errors.forEach(error => {
            const errorLower = error.toLowerCase();
            
            if (errorLower.includes('insufficient currency')) {
                actions.push('Acquire more money before attempting the purchase');
            } else if (errorLower.includes('insufficient cargo')) {
                actions.push('Check your inventory for the correct cargo type and quantity');
            } else if (errorLower.includes('invalid settlement')) {
                actions.push('Select a different settlement or check settlement requirements');
            } else if (errorLower.includes('network') || errorLower.includes('connection')) {
                actions.push('Check your internet connection and try again');
            } else if (errorLower.includes('permission')) {
                actions.push('Contact your GM for the necessary permissions');
            } else if (errorLower.includes('configuration')) {
                actions.push('Check module configuration and restart FoundryVTT');
            }
        });

        // Add general actions if no specific ones found
        if (actions.length === 0) {
            actions.push('Try the operation again');
            actions.push('Check the browser console for more details');
            actions.push('Contact your GM if the problem persists');
        }

        return [...new Set(actions)]; // Remove duplicates
    }

    /**
     * Get suggested actions for trading errors
     * @param {Error} error - Error object
     * @param {string} operation - Trading operation
     * @returns {Array} - Array of suggested actions
     */
    getTradingErrorActions(error, operation) {
        const actions = [];
        const errorMessage = error.message.toLowerCase();

        if (operation.includes('availability')) {
            actions.push('Try a different settlement');
            actions.push('Check if the current season affects availability');
        } else if (operation.includes('price')) {
            actions.push('Verify seasonal pricing data');
            actions.push('Check cargo quality settings');
        } else if (operation.includes('haggle')) {
            actions.push('Check character skill levels');
            actions.push('Verify merchant skill configuration');
        } else if (operation.includes('inventory')) {
            actions.push('Check actor inventory permissions');
            actions.push('Verify system adapter configuration');
        }

        // Add error-specific actions
        if (errorMessage.includes('season')) {
            actions.push('Set the current season in module settings');
        }

        if (errorMessage.includes('dataset')) {
            actions.push('Switch to the default dataset');
            actions.push('Validate dataset structure');
        }

        return [...new Set(actions)];
    }

    /**
     * Notify user with appropriate UI feedback
     * @param {string} severity - Error severity (critical, error, warning, info)
     * @param {string} message - Message to display
     * @param {boolean} persistent - Whether notification should be persistent
     */
    notifyUser(severity, message, persistent = false) {
        if (!this.userNotificationSettings.showCriticalErrors && severity === 'critical') return;
        if (!this.userNotificationSettings.showWarnings && severity === 'warning') return;
        if (!this.userNotificationSettings.showInfoMessages && severity === 'info') return;

        const options = {
            permanent: persistent || (severity === 'critical' && this.userNotificationSettings.persistentErrors)
        };

        if (typeof ui !== 'undefined' && ui.notifications) {
            switch (severity) {
                case 'critical':
                    ui.notifications.error(message, options);
                    break;
                case 'error':
                    ui.notifications.error(message, options);
                    break;
                case 'warning':
                    ui.notifications.warn(message, options);
                    break;
                case 'info':
                    ui.notifications.info(message, options);
                    break;
                default:
                    ui.notifications.info(message, options);
            }
        } else {
            // Fallback to console if UI notifications not available
            console.log(`Trading Places | ${severity.toUpperCase()}: ${message}`);
        }
    }

    /**
     * Implement graceful degradation for non-critical errors
     * @param {Error} error - Error object
     * @param {string} feature - Feature that failed
     * @param {Function} fallbackFunction - Fallback function to execute
     * @returns {*} - Result of fallback function or null
     */
    gracefulDegradation(error, feature, fallbackFunction = null) {
        const errorInfo = {
            type: 'graceful_degradation',
            severity: 'warning',
            message: `Feature '${feature}' failed, using fallback: ${error.message}`,
            context: `Graceful Degradation - ${feature}`,
            details: {
                feature: feature,
                hasFallback: !!fallbackFunction,
                errorName: error.name
            },
            timestamp: new Date().toISOString()
        };

        this.logError(errorInfo);

        if (fallbackFunction && typeof fallbackFunction === 'function') {
            try {
                const result = fallbackFunction();
                this.notifyUser('info', `${feature} is using reduced functionality due to an error`);
                return result;
            } catch (fallbackError) {
                this.logError({
                    ...errorInfo,
                    message: `Fallback also failed for '${feature}': ${fallbackError.message}`,
                    severity: 'error'
                });
                this.notifyUser('error', `${feature} is temporarily unavailable`);
                return null;
            }
        } else {
            this.notifyUser('warning', `${feature} is temporarily unavailable due to an error`);
            return null;
        }
    }

    /**
     * Get error log for debugging
     * @param {Object} filters - Filters for error log
     * @returns {Array} - Filtered error log
     */
    getErrorLog(filters = {}) {
        let filteredLog = [...this.errorLog];

        if (filters.severity) {
            filteredLog = filteredLog.filter(entry => entry.severity === filters.severity);
        }

        if (filters.type) {
            filteredLog = filteredLog.filter(entry => entry.type === filters.type);
        }

        if (filters.since) {
            const sinceDate = new Date(filters.since);
            filteredLog = filteredLog.filter(entry => new Date(entry.timestamp) >= sinceDate);
        }

        if (filters.limit) {
            filteredLog = filteredLog.slice(-filters.limit);
        }

        return filteredLog;
    }

    /**
     * Clear error log
     */
    clearErrorLog() {
        this.errorLog = [];
    }

    /**
     * Generate error summary report
     * @param {Object} options - Report options
     * @returns {Object} - Error summary
     */
    generateErrorSummary(options = {}) {
        const timeframe = options.timeframe || 'all';
        const now = new Date();
        let filteredLog = this.errorLog;

        // Filter by timeframe
        if (timeframe !== 'all') {
            const cutoffTime = new Date();
            switch (timeframe) {
                case 'hour':
                    cutoffTime.setHours(now.getHours() - 1);
                    break;
                case 'day':
                    cutoffTime.setDate(now.getDate() - 1);
                    break;
                case 'week':
                    cutoffTime.setDate(now.getDate() - 7);
                    break;
            }
            filteredLog = filteredLog.filter(entry => new Date(entry.timestamp) >= cutoffTime);
        }

        // Generate summary
        const summary = {
            totalErrors: filteredLog.length,
            bySeverity: {},
            byType: {},
            byContext: {},
            recentErrors: filteredLog.slice(-5),
            timeframe: timeframe,
            generatedAt: now.toISOString()
        };

        // Count by severity
        filteredLog.forEach(entry => {
            summary.bySeverity[entry.severity] = (summary.bySeverity[entry.severity] || 0) + 1;
            summary.byType[entry.type] = (summary.byType[entry.type] || 0) + 1;
            summary.byContext[entry.context] = (summary.byContext[entry.context] || 0) + 1;
        });

        return summary;
    }

    /**
     * Set debug mode
     * @param {boolean} enabled - Whether to enable debug mode
     */
    setDebugMode(enabled) {
        this.debugMode = enabled;
        
        if (typeof game !== 'undefined' && game.settings) {
            try {
                game.settings.set(this.moduleId, "debugLogging", enabled);
            } catch (error) {
                console.warn('Failed to save debug mode setting:', error);
            }
        }
    }

    /**
     * Update user notification settings
     * @param {Object} settings - New notification settings
     */
    updateNotificationSettings(settings) {
        this.userNotificationSettings = {
            ...this.userNotificationSettings,
            ...settings
        };
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = RuntimeErrorHandler;
}

// Global registration for FoundryVTT
if (typeof window !== 'undefined') {
    window.RuntimeErrorHandler = RuntimeErrorHandler;
}