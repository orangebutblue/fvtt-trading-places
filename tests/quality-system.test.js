/**
 * Trading Places Module - Quality System Tests
 * Focused on wine/brandy cargo recognition (regression for the "0BP" bug).
 */

const QualitySystem = require('../scripts/quality-system.js');

// Minimal DataManager stub — isWineBrandyCargo does not touch it.
const dataManagerStub = { sourceFlags: {} };

describe('QualitySystem.isWineBrandyCargo', () => {
    let quality;

    beforeEach(() => {
        quality = new QualitySystem(dataManagerStub);
    });

    test('recognizes Wine', () => {
        expect(quality.isWineBrandyCargo({ name: 'Wine', category: 'Brews' })).toBe(true);
    });

    test('recognizes Brandy', () => {
        expect(quality.isWineBrandyCargo({ name: 'Brandy', category: 'Brews' })).toBe(true);
    });

    test('recognizes Wine/Brandy (the combined name that regressed to 0BP)', () => {
        expect(quality.isWineBrandyCargo({ name: 'Wine/Brandy', category: 'Brews' })).toBe(true);
    });

    test('recognizes cargo via explicit qualitySystem field regardless of name', () => {
        expect(quality.isWineBrandyCargo({
            name: 'Wine/Brandy',
            category: 'Brews',
            qualitySystem: 'wine_brandy'
        })).toBe(true);

        // qualitySystem should win even without the Brews category.
        expect(quality.isWineBrandyCargo({
            name: 'Fortified Wine',
            category: 'Luxuries',
            qualitySystem: 'wine_brandy'
        })).toBe(true);
    });

    test('is robust to case and surrounding whitespace', () => {
        expect(quality.isWineBrandyCargo({ name: '  wine/brandy  ', category: 'Brews' })).toBe(true);
        expect(quality.isWineBrandyCargo({ name: 'BRANDY', category: 'Brews' })).toBe(true);
        expect(quality.isWineBrandyCargo({ name: 'Wine', category: 'Brews', qualitySystem: ' WINE_BRANDY ' })).toBe(true);
    });

    test('rejects unrelated brews', () => {
        expect(quality.isWineBrandyCargo({ name: 'Ale', category: 'Brews' })).toBe(false);
        expect(quality.isWineBrandyCargo({ name: 'Beer', category: 'Brews' })).toBe(false);
    });

    test('rejects non-brews cargo without the qualitySystem flag', () => {
        expect(quality.isWineBrandyCargo({ name: 'Wine', category: 'Luxuries' })).toBe(false);
    });

    test('handles null / malformed input safely', () => {
        expect(quality.isWineBrandyCargo(null)).toBe(false);
        expect(quality.isWineBrandyCargo(undefined)).toBe(false);
        expect(quality.isWineBrandyCargo({})).toBe(false);
        expect(quality.isWineBrandyCargo({ category: 'Brews' })).toBe(false);
    });
});

describe('QualitySystem wine/brandy pricing path (never 0BP)', () => {
    let quality;

    beforeEach(() => {
        // Deterministic roll so we can assert a concrete non-zero price.
        quality = new QualitySystem(dataManagerStub, { random: () => 0 });
    });

    test('rollWineBrandyQuality yields a non-zero BP price', () => {
        const result = quality.rollWineBrandyQuality([], 'Wine/Brandy');
        expect(result.priceInBP).toBeGreaterThan(0);
    });
});
