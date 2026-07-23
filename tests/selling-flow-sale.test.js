/**
 * Regression tests for SellingFlow._executeSale currency crediting.
 *
 * Checks that offerPricePerEP (and finalPrice) in canonical Brass Pennies (BP)
 * is converted to GC (finalPrice / 240) when calling SystemAdapter.addCurrency(),
 * which expects GC and multiplies by 240 internally to reach canonical BP.
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
        flow._formatCurrencyFromCanonical = jest.fn(() => 'formatted');
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
            offerPricePerEP: 120, // 120 BP per EP (0.5 GC/EP)
            maxEP: 50,
            cargo: { cargo: 'Wine', category: 'brews', quality: 'average', id: 'cargo-1', quantity: 100 },
            buyerName: 'Merchant',
            ...overrides,
        };
    }

    it('converts BP finalPrice to GC when calling addCurrency', async () => {
        const offer = makeOffer();
        // basePrice = 10 EP * 120 BP = 1200 BP (5 GC), no discount => finalPrice = 1200 BP (5 GC)
        await flow._executeSale('1', [offer], 10, 0);

        expect(addCurrency).toHaveBeenCalledTimes(1);
        const [creditedActor, amount] = addCurrency.mock.calls[0];
        expect(creditedActor).toBe(actor);
        expect(amount).toBe(5); // 1200 BP / 240 = 5 GC
    });

    it('applies the discount adjustment before converting to GC', async () => {
        const offer = makeOffer();
        // basePrice = 20 EP * 120 BP = 2400 BP; discountPercent 10 => +240 BP => 2640 BP (11 GC)
        await flow._executeSale('1', [offer], 20, 10);

        expect(addCurrency).toHaveBeenCalledTimes(1);
        expect(addCurrency.mock.calls[0][1]).toBe(11); // 2640 BP / 240 = 11 GC
    });
});
