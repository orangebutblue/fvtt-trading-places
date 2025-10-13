/**
 * Basic test for DataManagementApp V2 framework migration
 */

const { JSDOM } = require('jsdom');

// Set up JSDOM environment
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
  url: 'http://localhost'
});

global.window = dom.window;
global.document = dom.window.document;
global.navigator = dom.window.navigator;

// Mock FoundryVTT globals
global.game = {
  settings: {
    get: jest.fn(),
    set: jest.fn()
  },
  user: { isGM: true },
  users: [{ isGM: true }]
};

global.ui = {
  notifications: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
  }
};

global.Dialog = class {
  constructor(options) {
    this.options = options;
  }
  render() {
    return Promise.resolve();
  }
  static confirm(options) {
    return Promise.resolve(true);
  }
};

global.foundry = {
  utils: {
    mergeObject: jest.fn((target, source) => Object.assign(target, source)),
    deepClone: jest.fn(obj => JSON.parse(JSON.stringify(obj)))
  },
  applications: {
    api: {
      ApplicationV2: class {
        constructor(options = {}) {
          this.options = options;
          this.element = null;
          this.changes = new Map();
          this.originalData = new Map();
          this.selectedItem = null;
          this.currentTab = 'settlements';
        }

        async render() {
          // Mock render
          this.element = document.createElement('div');
          this.element.className = 'data-management-app';
          return this;
        }

        async close() {
          return this;
        }
      }
    }
  }
};

// Load the DataManagementApp
require('../scripts/data-management-ui.js');

describe('DataManagementApp V2 Framework Migration', () => {
  let dataManager;
  let app;

  beforeEach(() => {
    // Mock data manager
    dataManager = {
      getAllSettlements: jest.fn().mockReturnValue([]),
      getCargoTypes: jest.fn().mockReturnValue([]),
      config: {
        populationThresholds: {
          1: { min: 0, max: 100 },
          2: { min: 101, max: 500 }
        }
      }
    };

    // Reset mocks
    jest.clearAllMocks();
  });

  test('should be available on window object', () => {
    expect(window.TradingPlacesDataManagementApp).toBeDefined();
    expect(typeof window.TradingPlacesDataManagementApp).toBe('function');
  });

  test('should instantiate with dataManager', () => {
    expect(() => {
      app = new window.TradingPlacesDataManagementApp(dataManager);
    }).not.toThrow();

    expect(app).toBeDefined();
    expect(app.dataManager).toBe(dataManager);
  });

  test('should have V2 Application framework methods', () => {
    app = new window.TradingPlacesDataManagementApp(dataManager);

    // Check for V2 methods
    expect(typeof app._prepareContext).toBe('function');
    expect(typeof app._attachPartListeners).toBe('function');
  });

  test('should render without errors', async () => {
    app = new window.TradingPlacesDataManagementApp(dataManager);

    await expect(app.render()).resolves.toBeDefined();
    expect(app.element).toBeDefined();
  });

  test('should handle tab switching', () => {
    app = new window.TradingPlacesDataManagementApp(dataManager);

    // Mock the _switchTab method
    app._switchTab = jest.fn();

    const mockEvent = {
      preventDefault: jest.fn(),
      currentTarget: { dataset: { tab: 'cargo-types' } }
    };

    app._onTabClick(mockEvent);

    expect(mockEvent.preventDefault).toHaveBeenCalled();
    expect(app._switchTab).toHaveBeenCalledWith('cargo-types');
  });

  test('should handle settlement selection', () => {
    app = new window.TradingPlacesDataManagementApp(dataManager);

    const mockSettlement = { name: 'Test Settlement', region: 'Test Region' };
    dataManager.getSettlements = jest.fn().mockReturnValue([mockSettlement]);

    app._selectSettlement = jest.fn();
    app._updateUIState = jest.fn();

    const mockEvent = {
      currentTarget: { dataset: { id: 'Test Settlement' } }
    };

    app._onSettlementSelect(mockEvent);

    expect(app._selectSettlement).toHaveBeenCalledWith('Test Settlement');
  });

  test('should handle cargo selection', () => {
    app = new window.TradingPlacesDataManagementApp(dataManager);

    const mockCargo = { name: 'Test Cargo', category: 'Test Category' };
    dataManager.getCargoTypes = jest.fn().mockReturnValue([mockCargo]);

    app._selectCargo = jest.fn();
    app._updateUIState = jest.fn();

    const mockEvent = {
      currentTarget: { dataset: { id: 'Test Cargo' } }
    };

    app._onCargoSelect(mockEvent);

    expect(app._selectCargo).toHaveBeenCalledWith('Test Cargo');
  });
});