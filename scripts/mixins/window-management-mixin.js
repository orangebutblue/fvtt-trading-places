/**
 * Window Management Mixin
 * Handles window positioning, resizing, and state persistence
 */

const MODULE_ID = "fvtt-trading-places";

const WindowManagementMixin = {
    /**
     * Initialize window management features
     * @private
     */
    _initializeWindowManagement() {
        this._logDebug('Window Management', 'Initializing window management features');

        // Load saved window position and size
        this._loadWindowState();

        // Set up window state persistence
        this._setupWindowStatePersistence();

        this._logInfo('Window Management', 'Window management initialized successfully');
    },

    /**
     * Load saved window position and size from settings
     * @private
     */
    async _loadWindowState() {
        try {
            const savedState = await game.settings.get(MODULE_ID, "windowState");

            if (savedState && typeof savedState === 'object') {
                this._logDebug('Window Management', 'Loading saved window state', savedState);

                // Apply saved dimensions if valid
                if (savedState.width && savedState.height) {
                    // Ensure landscape orientation (width > height)
                    const width = Math.max(savedState.width, 800); // Minimum width
                    const height = Math.max(savedState.height, 600); // Minimum height

                    // Enforce landscape orientation
                    if (width <= height) {
                        this._logDebug('Window Management', 'Adjusting dimensions to maintain landscape orientation');
                        // Make width at least 1.5x height for landscape
                        const adjustedWidth = Math.max(width, Math.floor(height * 1.5));
                        this.options.position = {
                            ...this.options.position,
                            width: adjustedWidth,
                            height: height
                        };
                    } else {
                        this.options.position = {
                            ...this.options.position,
                            width: width,
                            height: height
                        };
                    }
                }

                // Apply saved position if valid (ensure it's on screen)
                if (savedState.top !== undefined && savedState.left !== undefined) {
                    const screenWidth = window.innerWidth;
                    const screenHeight = window.innerHeight;

                    // Ensure window is visible on screen
                    const left = Math.max(0, Math.min(savedState.left, screenWidth - 400));
                    const top = Math.max(0, Math.min(savedState.top, screenHeight - 200));

                    this.options.position = {
                        ...this.options.position,
                        left: left,
                        top: top
                    };
                }

                this._logInfo('Window Management', 'Window state loaded successfully', {
                    width: this.options.position.width,
                    height: this.options.position.height,
                    left: this.options.position.left,
                    top: this.options.position.top
                });
            } else {
                this._logDebug('Window Management', 'No saved window state found, using defaults');
            }
        } catch (error) {
            this._logError('Window Management', 'Failed to load window state', { error: error.message });
        }
    },

    /**
     * Set up window state persistence listeners
     * @private
     */
    _setupWindowStatePersistence() {
        // We'll set up the actual listeners after render when the window element exists
        this._windowStatePersistenceEnabled = true;
        this._logDebug('Window Management', 'Window state persistence enabled');
    },

    /**
     * Save current window state to settings
     * @private
     */
    async _saveWindowState() {
        if (!this._windowStatePersistenceEnabled || !this.element) {
            return;
        }

        try {
            const windowElement = this.element.closest('.app');
            if (!windowElement) {
                this._logDebug('Window Management', 'Window element not found, cannot save state');
                return;
            }

            const rect = windowElement.getBoundingClientRect();
            const windowState = {
                width: rect.width,
                height: rect.height,
                left: rect.left,
                top: rect.top,
                timestamp: Date.now()
            };

            await game.settings.set(MODULE_ID, "windowState", windowState);

            this._logDebug('Window Management', 'Window state saved', windowState);

        } catch (error) {
            this._logError('Window Management', 'Failed to save window state', { error: error.message });
        }
    },

    /**
     * Handle window resize events
     * @param {Event} event - Resize event
     * @private
     */
    _onWindowResize(event) {
        this._logDebug('Window Management', 'Window resize detected');

        // Debounce the save operation
        if (this._resizeTimeout) {
            clearTimeout(this._resizeTimeout);
        }

        this._resizeTimeout = setTimeout(() => {
            this._saveWindowState();
        }, 500); // Save after 500ms of no resize activity
    },

    /**
     * Handle window move events
     * @param {Event} event - Move event
     * @private
     */
    _onWindowMove(event) {
        this._logDebug('Window Management', 'Window move detected');

        // Debounce the save operation
        if (this._moveTimeout) {
            clearTimeout(this._moveTimeout);
        }

        this._moveTimeout = setTimeout(() => {
            this._saveWindowState();
        }, 500); // Save after 500ms of no move activity
    },

    /**
     * Validate and enforce landscape orientation
     * @param {number} width - Proposed width
     * @param {number} height - Proposed height
     * @returns {Object} - Validated dimensions
     * @private
     */
    _validateLandscapeOrientation(width, height) {
        const minWidth = 800;
        const minHeight = 600;
        const maxWidth = window.innerWidth * 0.9;
        const maxHeight = window.innerHeight * 0.9;

        // Ensure minimum dimensions
        width = Math.max(width, minWidth);
        height = Math.max(height, minHeight);

        // Ensure maximum dimensions
        width = Math.min(width, maxWidth);
        height = Math.min(height, maxHeight);

        // Enforce landscape orientation (width should be at least 1.2x height)
        const minLandscapeRatio = 1.2;
        if (width / height < minLandscapeRatio) {
            // Adjust width to maintain landscape ratio
            width = Math.floor(height * minLandscapeRatio);

            // If adjusted width exceeds screen, adjust height instead
            if (width > maxWidth) {
                width = maxWidth;
                height = Math.floor(width / minLandscapeRatio);
            }
        }

        this._logDebug('Window Management', 'Validated landscape orientation', {
            originalWidth: arguments[0],
            originalHeight: arguments[1],
            validatedWidth: width,
            validatedHeight: height,
            ratio: (width / height).toFixed(2)
        });

        return { width, height };
    },

    /**
     * Set up window event listeners for position and size tracking
     * @private
     */
    _setupWindowEventListeners() {
        if (!this.element) {
            this._logError('Window Management', 'Cannot set up window listeners - element not found');
            return;
        }

        const windowElement = this.element.closest('.app');
        if (!windowElement) {
            this._logError('Window Management', 'Cannot find window element for event listeners');
            return;
        }

        this._logDebug('Window Management', 'Setting up window event listeners');

        // Set up resize observer for size changes
        if (window.ResizeObserver) {
            this._resizeObserver = new ResizeObserver((entries) => {
                for (const entry of entries) {
                    const { width, height } = entry.contentRect;
                    this._logDebug('Window Management', 'Resize observed', { width, height });
                    this._onWindowResize();
                }
            });

            this._resizeObserver.observe(windowElement);
            this._logDebug('Window Management', 'ResizeObserver attached');
        }

        // Set up mutation observer for position changes
        if (window.MutationObserver) {
            this._positionObserver = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    if (mutation.type === 'attributes' &&
                        (mutation.attributeName === 'style')) {
                        this._logDebug('Window Management', 'Position change observed');
                        this._onWindowMove();
                    }
                });
            });

            this._positionObserver.observe(windowElement, {
                attributes: true,
                attributeFilter: ['style']
            });
            this._logDebug('Window Management', 'MutationObserver attached');
        }

        // Also listen for window close to save final state
        this.element.addEventListener('close', () => {
            this._logDebug('Window Management', 'Window closing, saving final state');
            this._saveWindowState();
        });

        this._logInfo('Window Management', 'Window event listeners set up successfully');
    },

    /**
     * Clean up window event listeners and observers
     * @private
     */
    _cleanupWindowEventListeners() {
        this._logDebug('Window Management', 'Cleaning up window event listeners');

        // Clean up resize observer
        if (this._resizeObserver) {
            this._resizeObserver.disconnect();
            this._resizeObserver = null;
            this._logDebug('Window Management', 'ResizeObserver disconnected');
        }

        // Clean up position observer
        if (this._positionObserver) {
            this._positionObserver.disconnect();
            this._positionObserver = null;
            this._logDebug('Window Management', 'MutationObserver disconnected');
        }

        // Clear any pending timeouts
        if (this._resizeTimeout) {
            clearTimeout(this._resizeTimeout);
            this._resizeTimeout = null;
        }

        if (this._moveTimeout) {
            clearTimeout(this._moveTimeout);
            this._moveTimeout = null;
        }

        this._logInfo('Window Management', 'Window event listeners cleaned up');
    }
};

// Export the mixin
window.WindowManagementMixin = WindowManagementMixin;