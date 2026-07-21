/**
 * Window Management Tests
 * Tests for proper window sizing, positioning, and persistence
 */

describe('Window Management', () => {
    let mockGame;
    let mockSettings;
    let application;

    beforeEach(() => {
        // Mock FoundryVTT game object
        mockSettings = {
            get: jest.fn(),
            set: jest.fn()
        };

        mockGame = {
            settings: mockSettings,
            user: { id: 'test-user' }
        };

        global.game = mockGame;
        global.foundry = {
            applications: {
                api: {
                    HandlebarsApplicationMixin: (app) => app,
                    ApplicationV2: class MockApplicationV2 {
                        constructor(options = {}) {
                            this.options = {
                                position: {
                                    width: 1200,
                                    height: 800,
                                    top: 100,
                                    left: 100
                                },
                                ...options
                            };
                            this.element = null;
                            this._windowStatePersistenceEnabled = false;
                        }

                        async render(force = false) {
                            // Mock render method
                            return this;
                        }

                        async close(options = {}) {
                            // Mock close method
                            return true;
                        }

                        async _prepareContext(options) {
                            return {};
                        }

                        _onRender(context, options) {
                            // Mock render callback
                        }

                        _attachPartListeners(partId, htmlElement, options) {
                            // Mock listener attachment
                        }
                    }
                }
            },
            utils: {
                randomID: () => 'test-id-' + Math.random().toString(36).substr(2, 9)
            }
        };

        Object.defineProperty(global.window, 'innerWidth', { value: 1920, writable: true, configurable: true });
        Object.defineProperty(global.window, 'innerHeight', { value: 1080, writable: true, configurable: true });
        
        global.window.ResizeObserver = class MockResizeObserver {
            constructor(callback) {
                this.callback = callback;
            }
            observe() {}
            disconnect() {}
        };
        
        global.window.MutationObserver = class MockMutationObserver {
            constructor(callback) {
                this.callback = callback;
            }
            observe() {}
            disconnect() {}
        };

        global.ResizeObserver = global.window.ResizeObserver;
        global.MutationObserver = global.window.MutationObserver;

        global.ui = {
            notifications: {
                info: jest.fn(),
                warn: jest.fn(),
                error: jest.fn()
            }
        };

        global.console = {
            log: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn()
        };

        // Mock debug logger
        global.wfrpLogger = {
            logInfo: jest.fn(),
            logError: jest.fn(),
            logDebug: jest.fn()
        };

        global.window.TPMLogger = {
            log: jest.fn((level, category, message, data) => {
                if (level === 'DEBUG') {
                    global.wfrpLogger.logDebug(category, message, data);
                } else if (level === 'INFO') {
                    global.wfrpLogger.logInfo(category, message, data);
                } else if (level === 'ERROR') {
                    global.wfrpLogger.logError(category, message, data);
                }
            })
        };

        // Mock module components
        global.WFRPRiverTrading = {
            getDataManager: () => ({
                getAllSettlements: () => [],
                getSettlement: () => null
            }),
            getTradingEngine: () => ({
                getCurrentSeason: () => 'spring',
                setCurrentSeason: jest.fn()
            })
        };

        global.window.TradingPlaces = {
            getDataManager: () => ({
                getAllSettlements: () => [],
                getSettlement: () => null
            }),
            getTradingEngine: () => ({
                getCurrentSeason: () => 'spring',
                setCurrentSeason: jest.fn()
            }),
            getSystemAdapter: () => ({
                // Mock system adapter functions
            })
        };

        // Ensure TradingPlacesApplication is not overwritten if already loaded

        // Load mixins first
        require('../scripts/mixins/logging-mixin.js');
        require('../scripts/mixins/validation-mixin.js');
        require('../scripts/mixins/season-management-mixin.js');
        require('../scripts/mixins/settlement-selector-mixin.js');
        require('../scripts/mixins/ui-state-mixin.js');
        require('../scripts/mixins/resource-management-mixin.js');
        require('../scripts/mixins/window-management-mixin.js');

        // Load the application class
        require('../scripts/trading-application-v2.js');
        
        // Get the class from global window
        const TradingPlacesApplication = global.window.TradingPlacesApplication;
        application = new TradingPlacesApplication();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('Default Window Configuration', () => {
        test('should have landscape orientation by default', () => {
            const { width, height } = application.options.position;
            expect(width).toBeGreaterThan(height);
            expect(width / height).toBeGreaterThanOrEqual(1.2); // Minimum landscape ratio
        });

        test('should have reasonable default dimensions', () => {
            const { width, height } = application.options.position;
            expect(width).toBe(1200);
            expect(height).toBe(800);
        });

        test('should be resizable', () => {
            expect(TradingPlacesApplication.DEFAULT_OPTIONS.window.resizable).toBe(true);
        });

        test('should be minimizable', () => {
            expect(TradingPlacesApplication.DEFAULT_OPTIONS.window.minimizable).toBe(true);
        });
    });

    describe('Window State Persistence', () => {
        test('should load saved window state on initialization', () => {
            const savedState = {
                width: 1400,
                height: 900,
                left: 200,
                top: 150,
                timestamp: Date.now()
            };

            mockSettings.get.mockReturnValue(savedState);

            application._loadWindowState();

            expect(mockSettings.get).toHaveBeenCalledWith("fvtt-trading-places", "windowState");
            expect(application.options.position.width).toBe(1400);
            expect(application.options.position.height).toBe(900);
        });

        test('should apply saved size to runtime this.position (ApplicationV2)', () => {
            // ApplicationV2 reads active coordinates from this.position during render,
            // not from this.options.position. Simulate a constructed app that already
            // has a live position object.
            application.position = { width: 1200, height: 800, left: 100, top: 100 };

            const savedState = {
                width: 1400,
                height: 900,
                left: 200,
                top: 150,
                timestamp: Date.now()
            };

            mockSettings.get.mockReturnValue(savedState);

            application._loadWindowState();

            expect(application.position.width).toBe(1400);
            expect(application.position.height).toBe(900);
        });

        test('should apply saved position (left/top) to runtime this.position (ApplicationV2)', () => {
            application.position = { width: 1200, height: 800, left: 100, top: 100 };

            const savedState = {
                width: 1400,
                height: 900,
                left: 200,
                top: 150,
                timestamp: Date.now()
            };

            mockSettings.get.mockReturnValue(savedState);

            application._loadWindowState();

            expect(application.position.left).toBe(200);
            expect(application.position.top).toBe(150);
        });

        test('should enforce landscape orientation when loading saved state', () => {
            const savedState = {
                width: 600,  // Portrait orientation
                height: 800,
                left: 200,
                top: 150
            };

            mockSettings.get.mockReturnValue(savedState);

            application._loadWindowState();

            const { width, height } = application.options.position;
            expect(width).toBeGreaterThan(height);
            expect(width / height).toBeGreaterThanOrEqual(1.2);
        });

        test('should ensure window stays on screen when loading saved position', () => {
            const savedState = {
                width: 1200,
                height: 800,
                left: 2000,  // Off screen
                top: -100     // Off screen
            };

            mockSettings.get.mockReturnValue(savedState);

            application._loadWindowState();

            const { left, top } = application.options.position;
            expect(left).toBeGreaterThanOrEqual(0);
            expect(top).toBeGreaterThanOrEqual(0);
            expect(left).toBeLessThanOrEqual(window.innerWidth - 400);
            expect(top).toBeLessThanOrEqual(window.innerHeight - 200);
        });

        test('should save window state when requested', async () => {
            // Mock DOM element
            const mockRect = {
                width: 1300,
                height: 850,
                left: 250,
                top: 200
            };

            const mockWindowElement = {
                getBoundingClientRect: () => mockRect
            };

            application.element = {
                closest: () => mockWindowElement
            };

            application._windowStatePersistenceEnabled = true;

            await application._saveWindowState();

            expect(mockSettings.set).toHaveBeenCalledWith(
                "fvtt-trading-places", 
                "windowState", 
                expect.objectContaining({
                    width: 1300,
                    height: 850,
                    left: 250,
                    top: 200,
                    timestamp: expect.any(Number)
                })
            );
        });
    });

    describe('Landscape Orientation Validation', () => {
        test('should validate and enforce landscape orientation', () => {
            const result = application._validateLandscapeOrientation(600, 800);
            
            expect(result.width).toBeGreaterThan(result.height);
            expect(result.width / result.height).toBeGreaterThanOrEqual(1.2);
        });

        test('should maintain minimum dimensions', () => {
            const result = application._validateLandscapeOrientation(400, 300);
            
            expect(result.width).toBeGreaterThanOrEqual(800);
            expect(result.height).toBeGreaterThanOrEqual(600);
        });

        test('should respect maximum screen dimensions', () => {
            const result = application._validateLandscapeOrientation(3000, 2000);
            
            expect(result.width).toBeLessThanOrEqual(window.innerWidth * 0.9);
            expect(result.height).toBeLessThanOrEqual(window.innerHeight * 0.9);
        });
    });

    describe('Window Event Management', () => {
        test('should set up window event listeners after render', () => {
            const mockWindowElement = document.createElement('div');
            mockWindowElement.getBoundingClientRect = () => ({ width: 1200, height: 800 });

            const mockElement = {
                closest: () => mockWindowElement,
                addEventListener: jest.fn()
            };

            application.element = mockElement;

            application._setupWindowEventListeners();

            expect(application._resizeObserver).toBeDefined();
            expect(application._positionObserver).toBeDefined();
        });

        test('should clean up event listeners on close', () => {
            // Set up observers
            application._resizeObserver = {
                disconnect: jest.fn()
            };
            application._positionObserver = {
                disconnect: jest.fn()
            };
            application._resizeTimeout = setTimeout(() => {}, 100);
            application._moveTimeout = setTimeout(() => {}, 100);

            const mockResizeObserver = application._resizeObserver;
            const mockPositionObserver = application._positionObserver;

            application._cleanupWindowEventListeners();

            expect(mockResizeObserver.disconnect).toHaveBeenCalled();
            expect(mockPositionObserver.disconnect).toHaveBeenCalled();
            expect(application._resizeObserver).toBeNull();
            expect(application._positionObserver).toBeNull();
        });

        test('should debounce window state saving', (done) => {
            application._windowStatePersistenceEnabled = true;
            application.element = {
                closest: () => ({
                    getBoundingClientRect: () => ({ width: 1200, height: 800, left: 100, top: 100 })
                })
            };

            // Call resize multiple times quickly
            application._onWindowResize();
            application._onWindowResize();
            application._onWindowResize();

            // Should only save once after debounce period
            setTimeout(() => {
                expect(mockSettings.set).toHaveBeenCalledTimes(1);
                done();
            }, 600);
        });
    });

    describe('Debug Logging', () => {
        test('should log window management operations', () => {
            application._initializeWindowManagement();

            expect(global.wfrpLogger.logDebug).toHaveBeenCalledWith(
                'Window Management', 
                'Initializing window management features',
                expect.any(Object)
            );
            expect(global.wfrpLogger.logInfo).toHaveBeenCalledWith(
                'Window Management', 
                'Window management initialized successfully',
                expect.any(Object)
            );
        });

        test('should log window state loading', () => {
            mockSettings.get.mockReturnValue({});

            application._loadWindowState();

            expect(global.wfrpLogger.logDebug).toHaveBeenCalledWith(
                'Window Management', 
                'No saved window state found, using defaults',
                expect.any(Object)
            );
        });

        test('should log validation operations', () => {
            application._validateLandscapeOrientation(600, 800);

            expect(global.wfrpLogger.logDebug).toHaveBeenCalledWith(
                'Window Management', 
                'Validated landscape orientation',
                expect.objectContaining({
                    originalWidth: 600,
                    originalHeight: 800,
                    validatedWidth: expect.any(Number),
                    validatedHeight: expect.any(Number),
                    ratio: expect.any(String)
                })
            );
        });
    });

    describe('Error Handling', () => {
        test('should handle missing window element gracefully', () => {
            application.element = null;

            expect(() => {
                application._setupWindowEventListeners();
            }).not.toThrow();

            expect(global.wfrpLogger.logError).toHaveBeenCalledWith(
                'Window Management', 
                'Cannot set up window listeners - element not found',
                expect.any(Object)
            );
        });

        test('should handle settings errors gracefully', () => {
            mockSettings.get.mockImplementation(() => {
                throw new Error('Settings error');
            });

            application._loadWindowState();

            expect(global.wfrpLogger.logError).toHaveBeenCalledWith(
                'Window Management', 
                'Failed to load window state',
                expect.objectContaining({
                    error: 'Settings error'
                })
            );
        });

        test('should handle save errors gracefully', async () => {
            mockSettings.set.mockRejectedValue(new Error('Save error'));
            
            application.element = {
                closest: () => ({
                    getBoundingClientRect: () => ({ width: 1200, height: 800, left: 100, top: 100 })
                })
            };
            application._windowStatePersistenceEnabled = true;

            await application._saveWindowState();

            expect(global.wfrpLogger.logError).toHaveBeenCalledWith(
                'Window Management', 
                'Failed to save window state',
                expect.objectContaining({
                    error: 'Save error'
                })
            );
        });
    });
});