/**
 * Trading Places Module - Debug UI Components
 * UI components for displaying debug logs in the trading interface
 */

/**
 * Debug Log Display Component
 */
class WFRPDebugUI {
    constructor(logger) {
        this.logger = logger;
        this.isVisible = false;
        this.autoScroll = true;
        this.filterCategory = null;
    }

    /**
     * Create debug log panel HTML
     * @returns {string} - HTML string for debug panel
     */
    createDebugPanel() {
        return `
            <div id="wfrp-debug-panel" class="wfrp-debug-panel" style="
                background: #f5f5f5;
                border: 1px solid #ccc;
                border-radius: 5px;
                margin: 10px 0;
                max-height: 300px;
                overflow-y: auto;
                font-family: 'Courier New', monospace;
                font-size: 12px;
                display: ${this.isVisible ? 'block' : 'none'};
            ">
                <div class="debug-panel-header" style="
                    background: #333;
                    color: white;
                    padding: 8px 12px;
                    font-weight: bold;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                ">
                    <span>Debug Log</span>
                    <div class="debug-controls">
                        <select id="debug-category-filter" style="margin-right: 10px; padding: 2px;">
                            <option value="">All Categories</option>
                            <option value="DICE">Dice Rolls</option>
                            <option value="CALCULATION">Calculations</option>
                            <option value="DECISION">Decisions</option>
                            <option value="ALGORITHM">Algorithm Steps</option>
                            <option value="USER_ACTION">User Actions</option>
                            <option value="SYSTEM">System Events</option>
                        </select>
                        <button id="debug-clear-btn" style="padding: 2px 8px; margin-right: 5px;">Clear</button>
                        <button id="debug-export-btn" style="padding: 2px 8px; margin-right: 5px;">Export</button>
                        <button id="debug-toggle-btn" style="padding: 2px 8px;">Hide</button>
                    </div>
                </div>
                <div id="debug-log-content" class="debug-log-content" style="
                    padding: 10px;
                    background: white;
                    min-height: 200px;
                    max-height: 250px;
                    overflow-y: auto;
                ">
                    <div class="debug-log-empty" style="color: #666; font-style: italic;">
                        Debug logging is ${this.logger?.isEnabled ? 'enabled' : 'disabled'}. 
                        ${this.logger?.isEnabled ? 'Logs will appear here as operations are performed.' : 'Enable in module settings to see logs.'}
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Create debug toggle button
     * @returns {string} - HTML string for toggle button
     */
    createDebugToggle() {
        return `
            <button id="wfrp-debug-toggle" class="wfrp-debug-toggle" style="
                background: #666;
                color: white;
                border: none;
                padding: 5px 10px;
                border-radius: 3px;
                cursor: pointer;
                font-size: 11px;
                margin: 5px 0;
            " title="Toggle debug log display">
                <i class="fas fa-bug"></i> Debug Log
            </button>
        `;
    }

    /**
     * Initialize debug UI in a container
     * @param {jQuery} container - jQuery container element
     */
    initializeUI(container) {
        // Add toggle button
        container.find('.debug-toggle-container').html(this.createDebugToggle());
        
        // Add debug panel
        container.find('.debug-panel-container').html(this.createDebugPanel());
        
        // Bind event handlers
        this.bindEventHandlers(container);
        
        // Start log monitoring
        this.startLogMonitoring();
    }

    /**
     * Bind event handlers for debug UI
     * @param {jQuery} container - jQuery container element
     */
    bindEventHandlers(container) {
        const self = this;
        
        // Toggle debug panel visibility
        container.on('click', '#wfrp-debug-toggle, #debug-toggle-btn', function() {
            self.toggleDebugPanel();
        });
        
        // Clear log history
        container.on('click', '#debug-clear-btn', function() {
            self.clearLogs();
        });
        
        // Export log history
        container.on('click', '#debug-export-btn', function() {
            self.exportLogs();
        });
        
        // Filter by category
        container.on('change', '#debug-category-filter', function() {
            self.filterCategory = $(this).val() || null;
            self.refreshLogDisplay();
        });
    }

    /**
     * Toggle debug panel visibility
     */
    toggleDebugPanel() {
        this.isVisible = !this.isVisible;
        const panel = $('#wfrp-debug-panel');
        const toggleBtn = $('#debug-toggle-btn');
        
        if (this.isVisible) {
            panel.show();
            toggleBtn.text('Hide');
            this.refreshLogDisplay();
        } else {
            panel.hide();
            toggleBtn.text('Show');
        }
    }

    /**
     * Clear log history
     */
    clearLogs() {
        if (this.logger) {
            this.logger.clearHistory();
            this.refreshLogDisplay();
        }
    }

    /**
     * Export log history
     */
    exportLogs() {
        if (this.logger) {
            const exportData = this.logger.exportHistory();
            const blob = new Blob([exportData], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = `wfrp-debug-log-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
    }

    /**
     * Refresh log display
     */
    refreshLogDisplay() {
        if (!this.logger || !this.isVisible) return;
        
        const logContent = $('#debug-log-content');
        if (logContent.length === 0) return;
        
        const logs = this.logger.getLogHistory(this.filterCategory, 50);
        
        if (logs.length === 0) {
            logContent.html(`
                <div class="debug-log-empty" style="color: #666; font-style: italic;">
                    No debug logs available. 
                    ${this.logger.isEnabled ? 'Perform trading operations to generate logs.' : 'Enable debug logging in module settings.'}
                </div>
            `);
            return;
        }
        
        const logHtml = logs.map(entry => this.formatLogEntry(entry)).join('');
        logContent.html(logHtml);
        
        // Auto-scroll to bottom if enabled
        if (this.autoScroll) {
            logContent.scrollTop(logContent[0].scrollHeight);
        }
    }

    /**
     * Format a single log entry for display
     * @param {Object} entry - Log entry object
     * @returns {string} - Formatted HTML
     */
    formatLogEntry(entry) {
        const timestamp = new Date(entry.timestamp).toLocaleTimeString();
        const categoryColor = this.getCategoryColor(entry.category);
        const levelIcon = this.getLevelIcon(entry.level);
        
        return `
            <div class="debug-log-entry" style="
                margin-bottom: 8px;
                padding: 6px;
                border-left: 3px solid ${categoryColor};
                background: ${entry.level === 'ERROR' ? '#ffe6e6' : '#f9f9f9'};
                border-radius: 3px;
            ">
                <div class="log-header" style="
                    font-weight: bold;
                    color: #333;
                    margin-bottom: 3px;
                    font-size: 11px;
                ">
                    <span style="color: #666;">[${timestamp}]</span>
                    <span style="color: ${categoryColor};">${entry.category}</span>
                    <span style="color: #333;">| ${entry.operation}</span>
                    ${levelIcon}
                </div>
                <div class="log-message" style="
                    color: #444;
                    margin-bottom: 3px;
                    line-height: 1.3;
                ">
                    ${entry.message}
                </div>
                ${entry.data ? `
                    <details class="log-data" style="margin-top: 5px;">
                        <summary style="cursor: pointer; color: #666; font-size: 10px;">Show Data</summary>
                        <pre style="
                            background: #f0f0f0;
                            padding: 5px;
                            margin: 5px 0 0 0;
                            border-radius: 3px;
                            font-size: 10px;
                            overflow-x: auto;
                            white-space: pre-wrap;
                        ">${JSON.stringify(entry.data, null, 2)}</pre>
                    </details>
                ` : ''}
            </div>
        `;
    }

    /**
     * Get color for log category
     * @param {string} category - Log category
     * @returns {string} - CSS color
     */
    getCategoryColor(category) {
        const colors = {
            'DICE': '#e74c3c',
            'CALCULATION': '#3498db',
            'DECISION': '#f39c12',
            'ALGORITHM': '#9b59b6',
            'USER_ACTION': '#2ecc71',
            'SYSTEM': '#34495e',
            'TRADING_OPERATION': '#e67e22'
        };
        return colors[category] || '#7f8c8d';
    }

    /**
     * Get icon for log level
     * @param {string} level - Log level
     * @returns {string} - HTML icon
     */
    getLevelIcon(level) {
        const icons = {
            'ERROR': '<i class="fas fa-exclamation-triangle" style="color: #e74c3c; margin-left: 5px;"></i>',
            'WARN': '<i class="fas fa-exclamation-circle" style="color: #f39c12; margin-left: 5px;"></i>',
            'INFO': '<i class="fas fa-info-circle" style="color: #3498db; margin-left: 5px;"></i>',
            'DEBUG': '<i class="fas fa-bug" style="color: #7f8c8d; margin-left: 5px;"></i>'
        };
        return icons[level] || '';
    }

    /**
     * Start monitoring logs for real-time updates
     */
    startLogMonitoring() {
        if (!this.logger) return;
        
        // Store original log method to intercept new logs
        const originalLog = this.logger.log.bind(this.logger);
        const self = this;
        
        this.logger.log = function(...args) {
            // Call original log method
            const result = originalLog(...args);
            
            // Update UI if visible
            if (self.isVisible) {
                setTimeout(() => self.refreshLogDisplay(), 100);
            }
            
            return result;
        };
    }
}

// Make available globally
if (typeof window !== 'undefined') {
    window.WFRPDebugUI = WFRPDebugUI;
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = WFRPDebugUI;
}