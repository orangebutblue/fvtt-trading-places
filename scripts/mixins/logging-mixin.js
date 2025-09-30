/**
 * Logging Mixin
 * Provides consistent logging functionality across trading application components
 */

const LoggingMixin = {
    /**
     * Initialize debug logging integration
     * @private
     */
    _initializeDebugLogging() {
        if (this.debugLogger) {
            this._logInfo('Debug Logging', 'Debug logging integration initialized');
        } else {
            console.warn('Trading Places | Debug logger not available');
        }
    },

    /**
     * Log info message with consistent format
     * @param {string} category - Log category
     * @param {string} message - Log message
     * @param {Object} data - Additional data
     * @private
     */
    _logInfo(category, message, data = {}) {
        if (this.debugLogger && this.debugLogger.log) {
            this.debugLogger.log('INFO', category, message, data, 'INFO');
        } else {
            console.log(`Trading Places | ${category}: ${message}`, data);
        }
    },

    /**
     * Log error message with consistent format
     * @param {string} category - Log category
     * @param {string} message - Log message
     * @param {Object} data - Additional data
     * @private
     */
    _logError(category, message, data = {}) {
        if (this.debugLogger && this.debugLogger.log) {
            this.debugLogger.log('ERROR', category, message, data, 'ERROR');
        } else {
            console.error(`Trading Places | ${category}: ${message}`, data);
        }
    },

    /**
     * Log debug message with consistent format
     * @param {string} category - Log category
     * @param {string} message - Log message
     * @param {Object} data - Additional data
     * @private
     */
    _logDebug(category, message, data = {}) {
        if (this.debugLogger && this.debugLogger.log) {
            this.debugLogger.log('DEBUG', category, message, data, 'DEBUG');
        } else {
            console.debug(`Trading Places | ${category}: ${message}`, data);
        }
    }
};

// Export the mixin
window.LoggingMixin = LoggingMixin;