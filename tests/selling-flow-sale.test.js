/**
 * Regression tests for SellingFlow._executeSale currency crediting.
 *
 * Guards the "buyers offer 0 money / seller receives 1-2 BP" bug: offerPricePerEP
 * (and therefore finalPrice) is expressed in the PRIMARY denomination (GC), which is
 * exactly the unit SystemAdapter.addCurrency() expects (it multiplies by 240 internally
 * to reach canonical BP). A previous version divided finalPrice by 240 before crediting,
 * underpaying the seller by a factor of 240. These tests assert addCurrency is called
 * with the full GC finalPrice, not finalPrice/240.
 */

import { SellingFlow } from '../scripts/flow/SellingFlow.js';

describe('SellingFlow._executeSale currency crediting', () => {
    let flow;
    let addCurrency;
    let actor;

    beforeEach(() => {
        actor = { id: 'actor-1', name: 'Seller' };

        // Foundry globals used by _executeSale
        global.game = {
            user: { character: actor },
            settings: {
                get: jest.fn().mockResolvedValue({}),
                set: jest.fn().mockResolvedValue(undefined),
            },
        };
        global.canvas = { tokens: { controlled: [] } };
        global.ui = { notifications: { success: jest.fn(), error: jest.fn() } };

        addCurrency = jest.fn().mockResolvedValue({ success: true });

        const app = {
            selectedSettlement: { name: 'Ubersreik', wealth: 'average' },
            currentSeason: 'spring',
            transactionHistory: [],
            currentCargo: [],
            sellerOffers: null,
            refreshUI: jest.fn().mockResolvedValue(undefined),
            dataManager: {
                activeDatasetName: 'default',
                history: [],
                cargo: [],
                saveCurrentDataset: jest.fn().mockResolvedValue(undefined),
            },
            systemAdapter: {
                findCargoInInventory: jest.fn().mockReturnValue([{ id: 'item-1' }]),
                removeCargoFromInventory: jest.fn().mockResolvedValue(undefined),
                addCurrency,
            },
        };

        flow = new SellingFlow(app);

        // Stub display/formatting helpers so the test isolates the crediting math.
        flow._formatCurrencyFromDenomination = jest.fn(() => 'formatted');
        flow._convertDenominationToCanonical = jest.fn(() => null);
        flow._updateSellerCard = jest.fn();
        flow._displaySellerResults = jest.fn().mockResolvedValue(undefined);
        flow._logInfo = jest.fn();
        flow._logError = jest.fn();
    });

    function makeOffer(overrides = {}) {
        return {
            slotNumber: 1,
            offerPricePerEP: 5, // GC per EP
            maxEP: 50,
            cargo: { cargo: 'Wine', category: 'brews', quality: 'average', id: 'cargo-1', quantity: 100 },
            buyerName: 'Merchant',
            ...overrides,
        };
    }

    it('credits the seller the full GC finalPrice (not finalPrice/240)', async () => {
        const offer = makeOffer();
        // basePrice = 10 EP * 5 GC = 50 GC, no discount => finalPrice = 50 GC
        await flow._executeSale('1', [offer], 10, 0);

        expect(addCurrency).toHaveBeenCalledTimes(1);
        const [creditedActor, amount] = addCurrency.mock.calls[0];
        expect(creditedActor).toBe(actor);
        expect(amount).toBe(50);
        // The old bug would have credited 50/240 ≈ 0.208 GC.
        expect(amount).not.toBeCloseTo(50 / 240);
    });

    it('applies the discount adjustment before crediting, still in GC', async () => {
        const offer = makeOffer();
        // basePrice = 20 EP * 5 GC = 100 GC; discountPercent 10 => +10 GC => 110 GC
        await flow._executeSale('1', [offer], 20, 10);

        expect(addCurrency).toHaveBeenCalledTimes(1);
        expect(addCurrency.mock.calls[0][1]).toBe(110);
    });
});
