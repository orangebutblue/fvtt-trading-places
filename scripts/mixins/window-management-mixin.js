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
     * Apply loaded window position and size directly to DOM element and ApplicationV2 position
     * @param {HTMLElement} windowElement - The target DOM element
     * @private
     */
    _applyWindowStateToElement(windowElement) {
        if (!windowElement) return;
        try {
            const pos = this.position || this.options?.position;
            if (!pos) return;

            if (pos.width) windowElement.style.width = `${pos.width}px`;
            if (pos.height) windowElement.style.height = `${pos.height}px`;
            if (pos.left !== undefined && pos.left !== null) windowElement.style.left = `${pos.left}px`;
            if (pos.top !== undefined && pos.top !== null) windowElement.style.top = `${pos.top}px`;

            console.log('Trading Places | Window Management | Applied saved position/size to DOM element style:', {
                width: windowElement.style.width,
                height: windowElement.style.height,
                left: windowElement.style.left,
                top: windowElement.style.top
            });

            if (typeof this.setPosition === 'function') {
                this.setPosition(pos);
            }
        } catch (error) {
            console.error('Trading Places | Window Management | Failed applying window state to element:', error);
        }
    },

    /**
     * Load saved window position and size from settings
     * @private
     */
    _loadWindowState() {
        try {
            const savedState = game.settings.get(MODULE_ID, "windowState");
            console.log('Trading Places | Window Management | Loading saved window state from settings:', savedState);

            if (!this.position) {
                this.position = {};
            }

            if (savedState && typeof savedState === 'object' && Object.keys(savedState).length > 0) {
                this._logDebug?.('Window Management', 'Loading saved window state', savedState);

                // Apply saved dimensions if valid
                if (savedState.width && savedState.height) {
                    const width = Math.max(savedState.width, 800); // Minimum width
                    const height = Math.max(savedState.height, 600); // Minimum height

                    let finalWidth = width;
                    let finalHeight = height;

                    // Enforce landscape orientation
                    if (width <= height) {
                        this._logDebug?.('Window Management', 'Adjusting dimensions to maintain landscape orientation');
                        finalWidth = Math.max(width, Math.floor(height * 1.5));
                    }

                    this.position.width = finalWidth;
                    this.position.height = finalHeight;
                }

                // Apply saved position if valid (ensure it's on screen)
                if (savedState.top !== undefined && savedState.left !== undefined) {
                    const screenWidth = window.innerWidth || 1920;
                    const screenHeight = window.innerHeight || 1080;

                    // Ensure window is visible on screen
                    const left = Math.max(0, Math.min(savedState.left, screenWidth - 400));
                    const top = Math.max(0, Math.min(savedState.top, screenHeight - 200));

                    this.position.left = left;
                    this.position.top = top;
                }

                this._logInfo?.('Window Management', 'Window state loaded successfully', {
                    width: this.position.width,
                    height: this.position.height,
                    left: this.position.left,
                    top: this.position.top
                });

                console.log('Trading Places | Window Management | Window state loaded successfully onto this.position:', {
                    width: this.position.width,
                    height: this.position.height,
                    left: this.position.left,
                    top: this.position.top
                });
            } else {
                this._logDebug?.('Window Management', 'No saved window state found, using defaults', {});
                console.log('Trading Places | Window Management | No saved window state found in settings, using defaults');
            }
        } catch (error) {
            this._logError?.('Window Management', 'Failed to load window state', { error: error.message });
            console.error('Trading Places | Window Management | Failed to load window state:', error);
        }
    },

    /**
     * Set up window state persistence listeners
     * @private
     */
    _setupWindowStatePersistence() {
        // We'll set up the actual listeners after render when the window element exists
        this._windowStatePersistenceEnabled = true;
        this._logDebug?.('Window Management', 'Window state persistence enabled', {});
    },

    /**
     * Save current window state to settings
     * @private
     */
    async _saveWindowState() {
        if (!this._windowStatePersistenceEnabled || !this.element) {
            console.log('Trading Places | Window Management | Cannot save state: persistence disabled or element unmounted', {
                enabled: this._windowStatePersistenceEnabled,
                hasElement: !!this.element
            });
            return;
        }

        try {
            const windowElement = this.element.closest('.application') || this.element.closest('.window-app') || this.element.closest('.app') || this.element;
            const rect = windowElement ? windowElement.getBoundingClientRect() : null;

            // BUG FIX: Prioritize real DOM bounding rect (where user dragged/resized window)
            // over static/stale this.position properties!
            const width = rect?.width || this.position?.width;
            const height = rect?.height || this.position?.height;
            const left = (rect?.left !== undefined && rect?.left !== null) ? rect.left : this.position?.left;
            const top = (rect?.top !== undefined && rect?.top !== null) ? rect.top : this.position?.top;

            console.log('Trading Places | Window Management | Saving window state...', {
                domRect: rect ? { left: rect.left, top: rect.top, width: rect.width, height: rect.height } : null,
                fallbackPosition: this.position,
                chosen: { left, top, width, height }
            });

            if (!width || !height) {
                this._logDebug?.('Window Management', 'Invalid dimensions, cannot save state', {});
                console.warn('Trading Places | Window Management | Invalid dimensions, cannot save state');
                return;
            }

            const windowState = {
                width: Math.max(width, 800),
                height: Math.max(height, 600),
                left: left ?? 50,
                top: top ?? 50,
                timestamp: Date.now()
            };

            // Synchronize internal position properties
            if (!this.position) {
                this.position = {};
            }
            try {
                this.position.width = windowState.width;
                this.position.height = windowState.height;
                this.position.left = windowState.left;
                this.position.top = windowState.top;
            } catch (e) {
                // Ignore proxy assignment errors in V12+ ApplicationV2
            }

            await game.settings.set(MODULE_ID, "windowState", windowState);
            this._logDebug?.('Window Management', 'Window state saved', windowState);
            console.log('Trading Places | Window Management | ✅ Window state saved to game.settings:', windowState);

        } catch (error) {
            this._logError?.('Window Management', 'Failed to save window state', { error: error.message });
            console.error('Trading Places | Window Management | Failed to save window state:', error);
        }
    },

    /**
     * Handle window resize events
     * @param {Event} event - Resize event
     * @private
     */
    _onWindowResize(event) {
        this._logDebug?.('Window Management', 'Window resize detected', {});
        console.log('Trading Places | Window Management | Window resize detected');

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
        this._logDebug?.('Window Management', 'Window move detected', {});
        console.log('Trading Places | Window Management | Window move detected');

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
            width = Math.ceil(height * minLandscapeRatio);

            // If adjusted width exceeds screen, adjust height instead
            if (width > maxWidth) {
                width = maxWidth;
                height = Math.floor(width / minLandscapeRatio);
            }
        }

        this._logDebug?.('Window Management', 'Validated landscape orientation', {
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
            this._logError?.('Window Management', 'Cannot set up window listeners - element not found', {});
            console.warn('Trading Places | Window Management | Cannot set up window listeners - element not found');
            return;
        }

        const windowElement = this.element.closest('.application') || this.element.closest('.window-app') || this.element.closest('.app') || this.element;
        if (!windowElement) {
            this._logError?.('Window Management', 'Cannot find window element for event listeners', {});
            console.warn('Trading Places | Window Management | Cannot find window element for event listeners');
            return;
        }

        this._logDebug?.('Window Management', 'Setting up window event listeners', {});
        console.log('Trading Places | Window Management | Setting up window event listeners & applying loaded state');
        this._applyWindowStateToElement(windowElement);

        // Set up resize observer for size changes
        if (window.ResizeObserver) {
            this._resizeObserver = new ResizeObserver((entries) => {
                for (const entry of entries) {
                    const { width, height } = entry.contentRect;
                    this._logDebug?.('Window Management', 'Resize observed', { width, height });
                    console.log('Trading Places | Window Management | Resize observed:', { width, height });
                    this._onWindowResize();
                }
            });

            this._resizeObserver.observe(windowElement);
            this._logDebug?.('Window Management', 'ResizeObserver attached', {});
            console.log('Trading Places | Window Management | ResizeObserver attached');
        }

        // Set up mutation observer for position changes
        if (window.MutationObserver) {
            this._positionObserver = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    if (mutation.type === 'attributes' &&
                        (mutation.attributeName === 'style')) {
                        this._logDebug?.('Window Management', 'Position change observed', {});
                        console.log('Trading Places | Window Management | Position change observed via style mutation');
                        this._onWindowMove();
                    }
                });
            });

            this._positionObserver.observe(windowElement, {
                attributes: true,
                attributeFilter: ['style']
            });
            this._logDebug?.('Window Management', 'MutationObserver attached', {});
            console.log('Trading Places | Window Management | MutationObserver attached');
        }

        // Also listen for window close to save final state
        this.element.addEventListener('close', () => {
            this._logDebug?.('Window Management', 'Window closing, saving final state', {});
            console.log('Trading Places | Window Management | Window closing, saving final state');
            this._saveWindowState();
        });

        this._logInfo?.('Window Management', 'Window event listeners set up successfully', {});
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