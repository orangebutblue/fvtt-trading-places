/**
 * Trading Places Module - Debug Logger
 * Comprehensive logging system for development and troubleshooting
 */

const MODULE_ID = "fvtt-trading-places";

/**
 * Trading Places Module - Comprehensive Debug Logging System
 * Provides structured logging for all trading operations with consistent format
 */

/**
 * Debug Logger class for comprehensive trading operation logging
 */
class WFRPDebugLogger {
    constructor() {
        this.logHistory = [];
        this.sessionId = this.generateSessionId();
        this.isEnabled = false;
        this.logLevel = 'INFO';
        this.maxHistorySize = 1000;
        
        // Initialize logging system
        this.initializeLogger();
    }

    /**
     * Initialize the logging system
     */
    initializeLogger() {
        // Check if debug logging is enabled in settings
        if (typeof game !== 'undefined' && game.settings) {
            this.isEnabled = game.settings.get(MODULE_ID, "debugLogging") || false;
        }
        
        console.log(`WFRP Debug Logger initialized - Session: ${this.sessionId} - Enabled: ${this.isEnabled}`);
    }

    /**
     * Generate unique session ID for this logging session
     * @returns {string} - Unique session identifier
     */
    generateSessionId() {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const random = Math.random().toString(36).substr(2, 6);
        return `WFRP-${timestamp}-${random}`;
    }

    /**
     * Enable or disable debug logging
     * @param {boolean} enabled - Whether to enable logging
     */
    setEnabled(enabled) {
        this.isEnabled = enabled;
        this.log('SYSTEM', 'Logger', `Debug logging ${enabled ? 'enabled' : 'disabled'}`);
    }

    /**
     * Set logging level
     * @param {string} level - Log level (DEBUG, INFO, WARN, ERROR)
     */
    setLogLevel(level) {
        const validLevels = ['DEBUG', 'INFO', 'WARN', 'ERROR'];
        if (validLevels.includes(level)) {
            this.logLevel = level;
            this.log('SYSTEM', 'Logger', `Log level set to ${level}`);
        }
    }

    /**
     * Core logging method with structured format
     * @param {string} category - Log category (DICE, CALCULATION, DECISION, USER_ACTION, ALGORITHM, SYSTEM)
     * @param {string} operation - Specific operation being logged
     * @param {string} message - Log message
     * @param {Object} data - Additional data object (optional)
     * @param {string} level - Log level (optional, defaults to INFO)
     */
    log(category, operation, message, data = null, level = 'INFO') {
        if (!this.isEnabled) return;

        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            sessionId: this.sessionId,
            category,
            operation,
            level,
            message,
            data: data ? JSON.parse(JSON.stringify(data)) : null // Deep copy to prevent mutations
        };

        // Add to history
        this.logHistory.push(logEntry);
        
        // Maintain history size limit
        if (this.logHistory.length > this.maxHistorySize) {
            this.logHistory.shift();
        }

        // Format and output to console
        const formattedMessage = this.formatLogMessage(logEntry);
        
        switch (level) {
            case 'ERROR':
                console.error(formattedMessage);
                break;
            case 'WARN':
                console.warn(formattedMessage);
                break;
            case 'DEBUG':
                console.debug(formattedMessage);
                break;
            default:
                console.log(formattedMessage);
        }
    }

    /**
     * Format log message for console output
     * @param {Object} logEntry - Log entry object
     * @returns {string} - Formatted log message
     */
    formatLogMessage(logEntry) {
        const { timestamp, category, operation, level, message, data } = logEntry;
        const timeStr = new Date(timestamp).toLocaleTimeString();
        
        let formatted = `[${timeStr}] WFRP-${category} | ${operation} | ${message}`;
        
        if (data) {
            formatted += `\n  Data: ${JSON.stringify(data, null, 2)}`;
        }
        
        return formatted;
    }

    /**
     * Log dice roll with formula, modifiers, and results
     * @param {string} operation - Operation context (e.g., "Availability Check", "Haggling Roll")
     * @param {string} formula - Dice formula (e.g., "d100", "2d10+5")
     * @param {Array} modifiers - Array of modifier objects {name, value, reason}
     * @param {number} result - Final roll result
     * @param {number} target - Target number (if applicable)
     * @param {boolean} success - Whether the roll succeeded
     * @param {string} reason - Explanation of success/failure
     */
    logDiceRoll(operation, formula, modifiers, result, target = null, success = null, reason = '') {
        const rollData = {
            formula,
            modifiers: modifiers || [],
            result,
            target,
            success,
            reason,
            totalModifier: modifiers ? modifiers.reduce((sum, mod) => sum + mod.value, 0) : 0
        };

        let message = `Rolling ${formula} for ${operation}`;
        if (target !== null) {
            message += ` (Target: ${target})`;
        }
        message += ` = ${result}`;
        if (success !== null) {
            message += ` - ${success ? 'SUCCESS' : 'FAILURE'}`;
        }
        if (reason) {
            message += ` (${reason})`;
        }

        this.log('DICE', operation, message, rollData);
    }

    /**
     * Log calculation step with input values and formulas
     * @param {string} operation - Calculation context
     * @param {string} formula - Mathematical formula used
     * @param {Object} inputs - Input values used in calculation
     * @param {number} result - Calculation result
     * @param {string} explanation - Step-by-step explanation
     */
    logCalculation(operation, formula, inputs, result, explanation = '') {
        const calcData = {
            formula,
            inputs,
            result,
            explanation
        };

        const message = `${operation}: ${formula} = ${result}${explanation ? ` (${explanation})` : ''}`;
        this.log('CALCULATION', operation, message, calcData);
    }

    /**
     * Log decision point with reasoning and data
     * @param {string} operation - Decision context
     * @param {string} decision - Decision made
     * @param {Object} criteria - Decision criteria used
     * @param {Array} options - Available options considered
     * @param {string} reasoning - Explanation of why this decision was made
     */
    logDecision(operation, decision, criteria, options = [], reasoning = '') {
        const decisionData = {
            decision,
            criteria,
            options,
            reasoning
        };

        const message = `${operation}: Decided on '${decision}'${reasoning ? ` - ${reasoning}` : ''}`;
        this.log('DECISION', operation, message, decisionData);
    }

    /**
     * Log user action with context and consequences
     * @param {string} action - Action performed by user
     * @param {Object} context - Context when action was performed
     * @param {Object} consequences - Results/changes from the action
     * @param {string} userId - User ID (if available)
     */
    logUserAction(action, context, consequences = {}, userId = null) {
        const actionData = {
            action,
            context,
            consequences,
            userId: userId || (typeof game !== 'undefined' ? game.user?.id : null),
            timestamp: new Date().toISOString()
        };

        const message = `User performed: ${action}`;
        this.log('USER_ACTION', action, message, actionData);
    }

    /**
     * Log algorithm step with official rule references
     * @param {string} algorithm - Algorithm name (e.g., "Buying Algorithm")
     * @param {string} step - Step identifier (e.g., "Step 1", "Step 2A")
     * @param {string} description - Step description
     * @param {Object} data - Step data and calculations
     * @param {string} ruleReference - Reference to official rules
     */
    logAlgorithmStep(algorithm, step, description, data, ruleReference = '') {
        const stepData = {
            algorithm,
            step,
            description,
            data,
            ruleReference
        };

        const message = `${algorithm} - ${step}: ${description}${ruleReference ? ` [${ruleReference}]` : ''}`;
        this.log('ALGORITHM', `${algorithm}-${step}`, message, stepData);
    }

    /**
     * Log system events and errors
     * @param {string} operation - System operation
     * @param {string} message - System message
     * @param {Object} data - Additional system data
     * @param {string} level - Log level (INFO, WARN, ERROR)
     */
    logSystem(operation, message, data = null, level = 'INFO') {
        this.log('SYSTEM', operation, message, data, level);
    }

    /**
     * Get log history for a specific category
     * @param {string} category - Log category to filter by
     * @param {number} limit - Maximum number of entries to return
     * @returns {Array} - Array of log entries
     */
    getLogHistory(category = null, limit = 100) {
        let filtered = this.logHistory;
        
        if (category) {
            filtered = this.logHistory.filter(entry => entry.category === category);
        }
        
        return filtered.slice(-limit);
    }

    /**
     * Get formatted log history as string
     * @param {string} category - Log category to filter by
     * @param {number} limit - Maximum number of entries to return
     * @returns {string} - Formatted log history
     */
    getFormattedHistory(category = null, limit = 100) {
        const history = this.getLogHistory(category, limit);
        return history.map(entry => this.formatLogMessage(entry)).join('\n');
    }

    /**
     * Clear log history
     */
    clearHistory() {
        this.logHistory = [];
    }

    /**
     * Export log history as JSON
     * @returns {string} - JSON string of log history
     */
    exportHistory() {
        return JSON.stringify({
            sessionId: this.sessionId,
            exportTime: new Date().toISOString(),
            logHistory: this.logHistory
        }, null, 2);
    }

    /**
     * Create a scoped logger for a specific operation
     * @param {string} operation - Operation name
     * @returns {Object} - Scoped logger object
     */
    createScopedLogger(operation) {
        return {
            dice: (formula, modifiers, result, target, success, reason) => 
                this.logDiceRoll(operation, formula, modifiers, result, target, success, reason),
            
            calculation: (formula, inputs, result, explanation) => 
                this.logCalculation(operation, formula, inputs, result, explanation),
            
            decision: (decision, criteria, options, reasoning) => 
                this.logDecision(operation, decision, criteria, options, reasoning),
            
            algorithm: (algorithm, step, description, data, ruleReference) => 
                this.logAlgorithmStep(algorithm, step, description, data, ruleReference),
            
            info: (message, data) => this.log('INFO', operation, message, data, 'INFO'),
            warn: (message, data) => this.log('WARN', operation, message, data, 'WARN'),
            error: (message, data) => this.log('ERROR', operation, message, data, 'ERROR')
        };
    }

    /**
     * Log a complete trading operation sequence
     * @param {string} operationType - Type of operation (buying, selling, etc.)
     * @param {Object} operationData - Complete operation data
     */
    logTradingOperation(operationType, operationData) {
        const message = `Trading operation completed: ${operationType}`;
        this.log('TRADING_OPERATION', operationType, message, operationData);
    }

    /**
     * Generate diagnostic report for troubleshooting
     * @returns {Object} - Diagnostic report
     */
    generateDiagnosticReport() {
        const categoryCounts = {};
        const levelCounts = {};
        const recentErrors = [];

        this.logHistory.forEach(entry => {
            // Count by category
            categoryCounts[entry.category] = (categoryCounts[entry.category] || 0) + 1;
            
            // Count by level
            levelCounts[entry.level] = (levelCounts[entry.level] || 0) + 1;
            
            // Collect recent errors
            if (entry.level === 'ERROR') {
                recentErrors.push(entry);
            }
        });

        return {
            sessionId: this.sessionId,
            isEnabled: this.isEnabled,
            logLevel: this.logLevel,
            totalEntries: this.logHistory.length,
            categoryCounts,
            levelCounts,
            recentErrors: recentErrors.slice(-10), // Last 10 errors
            oldestEntry: this.logHistory[0]?.timestamp,
            newestEntry: this.logHistory[this.logHistory.length - 1]?.timestamp
        };
    }
}

// Make the logger available globally
if (typeof window !== 'undefined') {
    window.WFRPDebugLogger = WFRPDebugLogger;
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = WFRPDebugLogger;
}
/**

 * Utility functions for common logging patterns
 */
class TPMLoggingUtils {
    /**
     * Log WFRP dice roll with automatic success/failure determination
     * @param {Object} logger - Logger instance
     * @param {string} operation - Operation context
     * @param {number} roll - Dice roll result
     * @param {number} target - Target number
     * @param {Array} modifiers - Array of modifiers
     * @param {string} formula - Dice formula used
     */
    static logWFRPRoll(logger, operation, roll, target, modifiers = [], formula = 'd100') {
        const success = roll <= target;
        const reason = success ? `${roll} ≤ ${target}` : `${roll} > ${target}`;
        
        logger.logDiceRoll(operation, formula, modifiers, roll, target, success, reason);
    }

    /**
     * Log settlement availability calculation
     * @param {Object} logger - Logger instance
     * @param {Object} settlement - Settlement object
     * @param {number} sizeRating - Calculated size rating
     * @param {number} wealthRating - Settlement wealth rating
     * @param {number} baseChance - Calculated base chance
     */
    static logAvailabilityCalculation(logger, settlement, sizeRating, wealthRating, baseChance) {
        const formula = `(Size + Wealth) × 10`;
        const inputs = {
            settlementName: settlement.name,
            settlementSize: settlement.size,
            sizeRating,
            wealthRating,
            calculation: `(${sizeRating} + ${wealthRating}) × 10`
        };
        
        logger.logCalculation('Cargo Availability', formula, inputs, baseChance, 
            `Settlement ${settlement.name} has ${baseChance}% chance for cargo availability`);
    }

    /**
     * Log price calculation with seasonal modifiers
     * @param {Object} logger - Logger instance
     * @param {string} cargoType - Type of cargo
     * @param {number} basePrice - Base price before modifiers
     * @param {string} season - Current season
     * @param {number} seasonalPrice - Price after seasonal modifier
     * @param {number} finalPrice - Final price after all modifiers
     * @param {Array} modifiers - Array of price modifiers applied
     */
    static logPriceCalculation(logger, cargoType, basePrice, season, seasonalPrice, finalPrice, modifiers = []) {
        const inputs = {
            cargoType,
            basePrice,
            season,
            seasonalPrice,
            modifiers,
            modifierTotal: modifiers.reduce((sum, mod) => sum + mod.value, 0)
        };
        
        const formula = `Base Price → Seasonal → Final (with modifiers)`;
        logger.logCalculation('Price Calculation', formula, inputs, finalPrice,
            `${cargoType} price: ${basePrice} → ${seasonalPrice} (${season}) → ${finalPrice} GC`);
    }

    /**
     * Log cargo type determination decision
     * @param {Object} logger - Logger instance
     * @param {Object} settlement - Settlement object
     * @param {string} selectedCargo - Cargo type selected
     * @param {string} method - Method used for selection
     */
    static logCargoTypeDecision(logger, settlement, selectedCargo, method) {
        const criteria = {
            settlementName: settlement.name,
            productionSources: settlement.source,
            selectionMethod: method
        };
        
        const options = Array.isArray(settlement.source) ? settlement.source : [settlement.source];
        const reasoning = `Selected ${selectedCargo} using ${method} method from available sources`;
        
        logger.logDecision('Cargo Type Selection', selectedCargo, criteria, options, reasoning);
    }

    /**
     * Log haggling attempt with outcome
     * @param {Object} logger - Logger instance
     * @param {number} hagglingRoll - Haggling skill roll
     * @param {number} difficulty - Haggling difficulty
     * @param {number} successLevel - Degrees of success/failure
     * @param {number} priceChange - Price change amount
     * @param {number} originalPrice - Original price
     * @param {number} finalPrice - Final negotiated price
     */
    static logHagglingAttempt(logger, hagglingRoll, difficulty, successLevel, priceChange, originalPrice, finalPrice) {
        const success = hagglingRoll <= difficulty;
        const modifiers = [
            { name: 'Base Difficulty', value: difficulty, reason: 'Settlement haggling difficulty' }
        ];
        
        logger.logDiceRoll('Haggling Attempt', 'd100', modifiers, hagglingRoll, difficulty, success,
            `${successLevel} degrees of ${success ? 'success' : 'failure'}`);
        
        const inputs = {
            hagglingRoll,
            difficulty,
            successLevel,
            originalPrice,
            priceChange,
            priceChangePercent: Math.round((priceChange / originalPrice) * 100)
        };
        
        logger.logCalculation('Haggling Price Change', 'Original ± Change', inputs, finalPrice,
            `Price ${priceChange >= 0 ? 'increased' : 'decreased'} by ${Math.abs(priceChange)} GC`);
    }

    /**
     * Log algorithm step with official rule reference
     * @param {Object} logger - Logger instance
     * @param {string} algorithm - Algorithm name
     * @param {string} step - Step identifier
     * @param {string} description - Step description
     * @param {Object} data - Step data
     * @param {string} pageReference - Page reference in official rules
     */
    static logOfficialAlgorithmStep(logger, algorithm, step, description, data, pageReference = '') {
        const ruleRef = pageReference ? `Death on the Reik Companion, ${pageReference}` : 'official-algorithm.md';
        logger.logAlgorithmStep(algorithm, step, description, data, ruleRef);
    }

    /**
     * Create a formatted summary of a trading session
     * @param {Object} logger - Logger instance
     * @param {Object} sessionData - Session summary data
     */
    static logTradingSessionSummary(logger, sessionData) {
        const summary = {
            sessionStart: sessionData.startTime,
            sessionEnd: new Date().toISOString(),
            settlement: sessionData.settlement,
            season: sessionData.season,
            operations: sessionData.operations || [],
            totalTransactions: sessionData.operations?.length || 0,
            totalValue: sessionData.operations?.reduce((sum, op) => sum + (op.value || 0), 0) || 0
        };
        
        logger.logTradingOperation('Session Summary', summary);
    }
}

/**
 * Integration helper for existing trading engine
 */
class TPMLoggerIntegration {
    /**
     * Initialize logger integration with existing systems
     * @param {Object} tradingEngine - Trading engine instance
     * @param {Object} dataManager - Data manager instance
     */
    static initializeIntegration(tradingEngine, dataManager) {
        // Create global logger instance
        if (!window.TPMLogger) {
            window.TPMLogger = new WFRPDebugLogger();
        }
        
        // Add logger to trading engine if it exists
        if (tradingEngine && typeof tradingEngine === 'object') {
            tradingEngine.logger = window.TPMLogger;
        }
        
        // Add logger to data manager if it exists
        if (dataManager && typeof dataManager === 'object') {
            dataManager.logger = window.TPMLogger;
        }
        
        // Log integration completion
        window.TPMLogger.logSystem('Integration', 'Logger integration completed', {
            tradingEngineIntegrated: !!tradingEngine,
            dataManagerIntegrated: !!dataManager
        });
        
        return window.TPMLogger;
    }

    /**
     * Add logging hooks to existing functions
     * @param {Object} targetObject - Object to add logging to
     * @param {string} functionName - Function name to wrap
     * @param {string} operationName - Name for logging purposes
     */
    static addLoggingHook(targetObject, functionName, operationName) {
        if (!targetObject || !targetObject[functionName]) {
            console.warn(`Cannot add logging hook: ${functionName} not found on target object`);
            return;
        }
        
        const originalFunction = targetObject[functionName];
        const logger = window.TPMLogger;
        
        targetObject[functionName] = function(...args) {
            logger.logSystem('Function Call', `${operationName} started`, {
                functionName,
                arguments: args.length
            });
            
            try {
                const result = originalFunction.apply(this, args);
                
                // Handle promises
                if (result && typeof result.then === 'function') {
                    return result.then(
                        (value) => {
                            logger.logSystem('Function Call', `${operationName} completed successfully`, {
                                functionName,
                                hasResult: !!value
                            });
                            return value;
                        },
                        (error) => {
                            logger.logSystem('Function Call', `${operationName} failed`, {
                                functionName,
                                error: error.message
                            }, 'ERROR');
                            throw error;
                        }
                    );
                } else {
                    logger.logSystem('Function Call', `${operationName} completed successfully`, {
                        functionName,
                        hasResult: !!result
                    });
                    return result;
                }
            } catch (error) {
                logger.logSystem('Function Call', `${operationName} failed`, {
                    functionName,
                    error: error.message
                }, 'ERROR');
                throw error;
            }
        };
    }
}

// Make utilities available globally
if (typeof window !== 'undefined') {
    window.TPMLoggingUtils = TPMLoggingUtils;
    window.TPMLoggerIntegration = TPMLoggerIntegration;
}