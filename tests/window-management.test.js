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

        global.window = {
            innerWidth: 1920,
            innerHeight: 1080,
            ResizeObserver: class MockResizeObserver {
                constructor(callback) {
                    this.callback = callback;
                }
                observe() {}
                disconnect() {}
            },
            MutationObserver: class MockMutationObserver {
                constructor(callback) {
                    this.callback = callback;
                }
                observe() {}
                disconnect() {}
            }
        };

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

        // Set up global window object for the class
        global.window = {
            ...global.window,
            TradingPlacesApplication: undefined
        };

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
        test('should load saved window state on initialization', async () => {
            const savedState = {
                width: 1400,
                height: 900,
                left: 200,
                top: 150,
                timestamp: Date.now()
            };

            mockSettings.get.mockResolvedValue(savedState);

            await application._loadWindowState();

            expect(mockSettings.get).toHaveBeenCalledWith("trading-places", "windowState");
            expect(application.options.position.width).toBe(1400);
            expect(application.options.position.height).toBe(900);
        });

        test('should enforce landscape orientation when loading saved state', async () => {
            const savedState = {
                width: 600,  // Portrait orientation
                height: 800,
                left: 200,
                top: 150
            };

            mockSettings.get.mockResolvedValue(savedState);

            await application._loadWindowState();

            const { width, height } = application.options.position;
            expect(width).toBeGreaterThan(height);
            expect(width / height).toBeGreaterThanOrEqual(1.2);
        });

        test('should ensure window stays on screen when loading saved position', async () => {
            const savedState = {
                width: 1200,
                height: 800,
                left: 2000,  // Off screen
                top: -100     // Off screen
            };

            mockSettings.get.mockResolvedValue(savedState);

            await application._loadWindowState();

            const { left, top } = application.options.position;
            expect(left).toBeGreaterThanOrEqual(0);
            expect(top).toBeGreaterThanOrEqual(0);
            expect(left).toBeLessThan(window.innerWidth - 400);
            expect(top).toBeLessThan(window.innerHeight - 200);
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
                "trading-places", 
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
            const mockElement = {
                closest: () => ({
                    getBoundingClientRect: () => ({ width: 1200, height: 800 })
                }),
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

            application._cleanupWindowEventListeners();

            expect(application._resizeObserver.disconnect).toHaveBeenCalled();
            expect(application._positionObserver.disconnect).toHaveBeenCalled();
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
                'Initializing window management features'
            );
            expect(global.wfrpLogger.logInfo).toHaveBeenCalledWith(
                'Window Management', 
                'Window management initialized successfully'
            );
        });

        test('should log window state loading', async () => {
            mockSettings.get.mockResolvedValue({});

            await application._loadWindowState();

            expect(global.wfrpLogger.logDebug).toHaveBeenCalledWith(
                'Window Management', 
                'No saved window state found, using defaults'
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
                'Cannot set up window listeners - element not found'
            );
        });

        test('should handle settings errors gracefully', async () => {
            mockSettings.get.mockRejectedValue(new Error('Settings error'));

            await application._loadWindowState();

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