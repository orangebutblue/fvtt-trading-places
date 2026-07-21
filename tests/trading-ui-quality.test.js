/**
 * Regression tests for the bug:
 *   "purchased or created wine does not display quality"
 *
 * BuyingFlow places quality data directly on the cargo ROOT:
 *   cargo.quality     -> shown/claimed tier (string)
 *   cargo.actualTier  -> real tier (string)
 *   cargo.dishonest   -> boolean
 *   cargo.system      -> 'standard' | 'wine_brandy'
 * (the full quality object lives at cargo.slotInfo.quality)
 *
 * These tests lock in two behaviours:
 *  (1) TradingUIEventHandlers._onCargoPurchase reads quality from the cargo ROOT
 *      into the transaction, instead of reading cargo.quality?.tier and defaulting
 *      to 'Average' / 'standard'.
 *  (2) The purchase button wired up by TradingUIRenderer routes clicks through
 *      eventHandlers._onCargoPurchase (which routes to systemAdapter.performPurchase,
 *      the code path that applies the quality suffix to the item name).
 */

import { TradingUIEventHandlers } from '../scripts/ui/TradingUIEventHandlers.js';
import TradingUIRenderer from '../scripts/ui/TradingUIRenderer.js';

function makeApp() {
    return {
        dataManager: {
            activeDatasetName: 'test-dataset',
            getCargoTypes: () => [],
            isTradeSettlement: () => false
        },
        selectedSettlement: { name: 'Bogenhafen' },
        currentSeason: 'Spring',
        successfulCargo: [],
        availableCargo: [],
        transactionHistory: [],
        currentCargo: [],
        refreshUI: jest.fn().mockResolvedValue(undefined)
    };
}

// A dishonest wine merchant: shows "Good" but the wine is really "Average".
function makeWineCargo() {
    return {
        name: 'Wine',
        category: 'Fine Goods',
        quality: 'Good',        // shown/claimed tier
        actualTier: 'Average',  // real tier
        dishonest: true,
        system: 'wine_brandy',
        contraband: false,
        totalEP: 20,
        currentPrice: 40,
        slotInfo: {
            quality: { tier: 'Good', actualTier: 'Average', dishonest: true, system: 'wine_brandy' }
        }
    };
}

beforeEach(() => {
    global.ui = { notifications: { success: jest.fn(), error: jest.fn(), info: jest.fn() } };
    global.game = { settings: { get: jest.fn().mockResolvedValue({}), set: jest.fn().mockResolvedValue(undefined) } };
});

describe('_onCargoPurchase quality extraction (sub-issue 1)', () => {
    test('reads quality/actualTier/dishonest/system from the cargo root, not defaults', async () => {
        const app = makeApp();
        const handlers = new TradingUIEventHandlers(app);

        // System adapter approves and performs the purchase (name suffix path).
        app.systemAdapter = {
            validatePurchase: jest.fn().mockResolvedValue({ valid: true }),
            performPurchase: jest.fn().mockResolvedValue({ success: true })
        };

        // Stub currency + peripheral UI helpers so we isolate quality extraction.
        handlers._augmentTransaction = (t) => t;
        handlers._formatCurrencyFromDenomination = () => '1GC';
        handlers._getCurrencyLabel = () => 'BP';
        handlers._updateBuyingCargoCard = jest.fn();
        handlers._addCargoToInventory = jest.fn().mockResolvedValue(undefined);

        await handlers._onCargoPurchase(makeWineCargo(), 5, 200, 0);

        // The purchase must route through performPurchase (applies the name suffix).
        expect(app.systemAdapter.performPurchase).toHaveBeenCalledTimes(1);

        expect(app.transactionHistory).toHaveLength(1);
        const tx = app.transactionHistory[0];

        // Quality is preserved from the root, NOT defaulted to 'Average'.
        expect(tx.quality).toBe('Good');
        expect(tx.actualTier).toBe('Average');
        expect(tx.dishonest).toBe(true);
        // System is preserved from the root, NOT defaulted to 'standard'.
        expect(tx.system).toBe('wine_brandy');

        // The inventory item is built from this same (correct) transaction.
        expect(handlers._addCargoToInventory).toHaveBeenCalledWith(tx);
    });

    test('honest non-wine cargo still carries its tier through', async () => {
        const app = makeApp();
        const handlers = new TradingUIEventHandlers(app);
        app.systemAdapter = {
            validatePurchase: jest.fn().mockResolvedValue({ valid: true }),
            performPurchase: jest.fn().mockResolvedValue({ success: true })
        };
        handlers._augmentTransaction = (t) => t;
        handlers._formatCurrencyFromDenomination = () => '1GC';
        handlers._getCurrencyLabel = () => 'BP';
        handlers._updateBuyingCargoCard = jest.fn();
        handlers._addCargoToInventory = jest.fn().mockResolvedValue(undefined);

        const cargo = {
            name: 'Cloth',
            category: 'Textiles',
            quality: 'High',
            actualTier: 'High',
            dishonest: false,
            system: 'standard',
            totalEP: 10,
            currentPrice: 12
        };

        await handlers._onCargoPurchase(cargo, 3, 36, 0);

        const tx = app.transactionHistory[0];
        expect(tx.quality).toBe('High');
        expect(tx.actualTier).toBe('High');
        expect(tx.dishonest).toBe(false);
        expect(tx.system).toBe('standard');
    });
});

describe('purchase button routing (sub-issue 2)', () => {
    test('clicking Purchase routes through eventHandlers._onCargoPurchase', async () => {
        const app = makeApp();
        app.eventHandlers = { _onCargoPurchase: jest.fn().mockResolvedValue(undefined) };

        const renderer = new TradingUIRenderer(app);
        // Isolate from the currency subsystem.
        renderer._formatCurrencyFromDenomination = () => '0';
        renderer._convertDenominationToCanonical = () => null;

        const cargo = makeWineCargo();

        // Minimal card DOM with the elements _attachBuyingInterfaceListeners needs.
        const card = document.createElement('div');
        card.innerHTML = `
            <input class="quantity-input" type="number" value="0">
            <input class="quantity-slider" type="range" value="0">
            <input class="discount-slider" type="range" value="0">
            <span class="discount-display"></span>
            <button class="purchase-btn" disabled></button>
            <span class="total-price-value"></span>
        `;

        renderer._attachBuyingInterfaceListeners(card, cargo);

        const quantityInput = card.querySelector('.quantity-input');
        const purchaseBtn = card.querySelector('.purchase-btn');

        // Enter a quantity so the button becomes enabled.
        quantityInput.value = '5';
        quantityInput.dispatchEvent(new Event('input'));
        expect(purchaseBtn.disabled).toBe(false);

        purchaseBtn.click();
        await Promise.resolve();

        expect(app.eventHandlers._onCargoPurchase).toHaveBeenCalledTimes(1);
        const callArgs = app.eventHandlers._onCargoPurchase.mock.calls[0];
        expect(callArgs[0]).toBe(cargo);   // cargo (with root quality fields)
        expect(callArgs[1]).toBe(5);        // quantity
        expect(typeof callArgs[2]).toBe('number'); // total cost
    });
});
