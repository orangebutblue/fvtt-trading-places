/**
 * Tests for Native UI Integration
 */

describe('WFRPNativeUIIntegration', () => {
    let mockLogger;
    let nativeUI;

    beforeEach(() => {
        // Mock logger
        mockLogger = {
            log: jest.fn()
        };

        // Mock browser globals
        global.window = {
            WFRPNativeUIIntegration: undefined
        };

        // Clear any existing trading applications
        global.TradingPlacesApplication = undefined;
        global.WFRPSimpleTradingApplication = undefined;

        global.console = {
            log: jest.fn()
        };

        // Mock FoundryVTT globals
        global.Hooks = {
            on: jest.fn()
        };

        global.game = {
            tradingPlaces: {},
            settings: {
                get: jest.fn(),
                set: jest.fn()
            }
        };

        global.$ = jest.fn(() => ({
            remove: jest.fn(),
            on: jest.fn(),
            after: jest.fn(),
            append: jest.fn(),
            prepend: jest.fn(),
            find: jest.fn(() => ({
                length: 1,
                after: jest.fn(),
                append: jest.fn()
            })),
            css: jest.fn(() => global.$())
        }));

        global.ui = {
            notifications: {
                error: jest.fn(),
                info: jest.fn()
            }
        };

        // Load the class
        require('../scripts/native-ui-integration.js');
        nativeUI = new global.window.WFRPNativeUIIntegration(mockLogger);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('Constructor', () => {
        test('should initialize with logger', () => {
            expect(nativeUI.logger).toBe(mockLogger);
            expect(nativeUI.isInitialized).toBe(false);
            expect(mockLogger.log).toHaveBeenCalledWith('UI Integration', 'Native UI Integration initialized', null);
        });

        test('should work without logger', () => {
            const nativeUINoLogger = new global.window.WFRPNativeUIIntegration();
            expect(nativeUINoLogger.logger).toBe(null);
            expect(nativeUINoLogger.isInitialized).toBe(false);
        });
    });

    describe('initialize', () => {
        test('should initialize all UI integration points', async () => {
            await nativeUI.initialize();

            expect(nativeUI.isInitialized).toBe(true);
            expect(mockLogger.log).toHaveBeenCalledWith('UI Integration', '=== Initializing Native UI Integration ===', null);
            expect(mockLogger.log).toHaveBeenCalledWith('UI Integration', 'Native UI Integration initialization complete', null);
        });

        test('should not initialize twice', async () => {
            await nativeUI.initialize();
            mockLogger.log.mockClear();

            await nativeUI.initialize();

            expect(mockLogger.log).toHaveBeenCalledWith('UI Integration', 'Native UI Integration already initialized, skipping', null);
        });
    });

    describe('Scene Controls Integration', () => {
        test('should register scene controls hook', () => {
            nativeUI.initializeSceneControls();

            expect(global.Hooks.on).toHaveBeenCalledWith('getSceneControlButtons', expect.any(Function));
            expect(mockLogger.log).toHaveBeenCalledWith('UI Integration', 'Initializing scene controls integration', null);
        });

        test('should add trading controls to scene controls', () => {
            nativeUI.initializeSceneControls();

            // Get the hook callback
            const hookCallback = global.Hooks.on.mock.calls.find(call => call[0] === 'getSceneControlButtons')[1];
            const controls = [];

            hookCallback(controls);

            expect(controls).toHaveLength(1);
            expect(controls[0]).toMatchObject({
                name: 'trading-places',
                title: 'Trading Places',
                icon: 'fas fa-coins',
                layer: 'TradingPlacesLayer'
            });
            expect(controls[0].tools).toHaveLength(2);
            expect(controls[0].tools[0].name).toBe('open-trading');
            expect(controls[0].tools[1].name).toBe('quick-trade');
        });
    });

    describe('Sidebar Integration', () => {
        test('should register sidebar hook', () => {
            nativeUI.initializeSidebarIntegration();

            expect(global.Hooks.on).toHaveBeenCalledWith('renderSidebar', expect.any(Function));
            expect(mockLogger.log).toHaveBeenCalledWith('UI Integration', 'Initializing sidebar integration', null);
        });
    });

    describe('Hotbar Macro Support', () => {
        test('should register hotbar hook', () => {
            nativeUI.initializeHotbarMacroSupport();

            expect(global.Hooks.on).toHaveBeenCalledWith('renderHotbar', expect.any(Function));
            expect(mockLogger.log).toHaveBeenCalledWith('UI Integration', 'Initializing hotbar macro support', null);
        });
    });

    describe('Global API', () => {
        test('should initialize global API methods', () => {
            nativeUI.initializeGlobalAPI();

            expect(global.game.tradingPlaces.openTrading).toBeDefined();
            expect(global.game.tradingPlaces.openQuickTrade).toBeDefined();
            expect(global.game.tradingPlaces.openSimpleTrading).toBeDefined();
            expect(global.game.tradingPlaces.getCurrentSeason).toBeDefined();
            expect(global.game.tradingPlaces.setSeason).toBeDefined();
            expect(global.game.tradingPlaces.enableDebugLogging).toBeDefined();
            expect(global.game.tradingPlaces.disableDebugLogging).toBeDefined();
        });

        test('getCurrentSeason should return current season', () => {
            global.game.settings = {
                get: jest.fn().mockReturnValue('summer')
            };

            nativeUI.initializeGlobalAPI();
            const season = global.game.tradingPlaces.getCurrentSeason();

            expect(season).toBe('summer');
            expect(global.game.settings.get).toHaveBeenCalledWith('trading-places', 'currentSeason');
        });

        test('setSeason should validate and set season', async () => {
            global.game.settings = {
                set: jest.fn().mockResolvedValue(true)
            };

            nativeUI.initializeGlobalAPI();
            await global.game.tradingPlaces.setSeason('winter');

            expect(global.game.settings.set).toHaveBeenCalledWith('trading-places', 'currentSeason', 'winter');
            expect(global.ui.notifications.info).toHaveBeenCalledWith('Trading season changed to winter');
        });

        test('setSeason should reject invalid seasons', async () => {
            nativeUI.initializeGlobalAPI();

            await expect(global.game.tradingPlaces.setSeason('invalid')).rejects.toThrow('Invalid season: invalid');
        });
    });

    describe('openTradingInterface', () => {
        test('should open TradingPlacesApplication if available', async () => {
            const mockApp = {
                render: jest.fn().mockResolvedValue(true)
            };
            global.TradingPlacesApplication = jest.fn(() => mockApp);

            await nativeUI.openTradingInterface();

            expect(global.TradingPlacesApplication).toHaveBeenCalled();
            expect(mockApp.render).toHaveBeenCalledWith(true);
            expect(mockLogger.log).toHaveBeenCalledWith('UI Integration', 'Using TradingPlacesApplication (V2)', null);
        });

        test('should fallback to WFRPSimpleTradingApplication', async () => {
            global.WFRPSimpleTradingApplication = {
                create: jest.fn().mockResolvedValue(true)
            };

            await nativeUI.openTradingInterface();

            expect(global.WFRPSimpleTradingApplication.create).toHaveBeenCalled();
            expect(mockLogger.log).toHaveBeenCalledWith('UI Integration', 'Fallback to WFRPSimpleTradingApplication', null);
        });

        test('should show error if no trading application available', async () => {
            await nativeUI.openTradingInterface();

            expect(global.ui.notifications.error).toHaveBeenCalledWith('Trading interface not available. Please reload the module.');
            expect(mockLogger.log).toHaveBeenCalledWith('UI Integration', 'No trading application available, showing error', null);
        });
    });

    describe('removeFloatingButtonOverlays', () => {
        test('should remove floating button overlays', () => {
            const mockRemove = jest.fn();
            global.$ = jest.fn((selector) => {
                if (selector === '.trading-module-button' || selector === '.trading-button') {
                    return { remove: mockRemove };
                }
                return { remove: jest.fn() };
            });

            nativeUI.removeFloatingButtonOverlays();

            expect(mockRemove).toHaveBeenCalledTimes(2);
            expect(mockLogger.log).toHaveBeenCalledWith('UI Integration', 'Removing floating button overlays', null);
            expect(mockLogger.log).toHaveBeenCalledWith('UI Integration', 'Floating button overlays removed', null);
        });
    });

    describe('log method', () => {
        test('should log with logger if available', () => {
            nativeUI.log('test message', { data: 'test' });

            expect(mockLogger.log).toHaveBeenCalledWith('UI Integration', 'test message', { data: 'test' });
        });

        test('should fallback to console.log if no logger', () => {
            const consoleSpy = jest.spyOn(global.console, 'log').mockImplementation();
            const nativeUINoLogger = new global.window.WFRPNativeUIIntegration();

            nativeUINoLogger.log('test message', { data: 'test' });

            expect(consoleSpy).toHaveBeenCalledWith('Trading Places | UI Integration: test message', { data: 'test' });

            consoleSpy.mockRestore();
        });
    });
});