/**
 * Unit tests for season management functionality
 */

const DataManager = require('../scripts/data-manager.js');
const fs = require('fs');
const path = require('path');

// Mock FoundryVTT globals for testing
global.game = {
    settings: {
        data: {},
        get: function(module, setting) {
            return Promise.resolve(this.data[`${module}.${setting}`] || null);
        },
        set: function(module, setting, value) {
            this.data[`${module}.${setting}`] = value;
            return Promise.resolve();
        }
    }
};

global.ui = {
    notifications: {
        info: function(message) {
            console.log(`INFO: ${message}`);
        },
        warn: function(message) {
            console.log(`WARN: ${message}`);
        }
    }
};

global.Hooks = {
    callAll: function(hook, data) {
        console.log(`HOOK: ${hook}`, data);
    }
};

describe('Season Management', () => {
    let dataManager;

    beforeEach(async () => {
        dataManager = new DataManager();
        
        // Load test data from regional structure
        const settlementsDir = path.join(__dirname, '../datasets/wfrp4e/settlements');
        const regionFiles = fs.readdirSync(settlementsDir).filter(f => f.endsWith('.json'));
        const settlementsData = { settlements: [] };
        
        // Load all regional settlement files
        regionFiles.forEach(file => {
            const filePath = path.join(settlementsDir, file);
            const regionSettlements = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            settlementsData.settlements.push(...regionSettlements);
        });
        
        const cargoData = JSON.parse(fs.readFileSync(path.join(__dirname, '../datasets/wfrp4e/cargo-types.json'), 'utf8'));
        const configData = JSON.parse(fs.readFileSync(path.join(__dirname, '../datasets/wfrp4e/config.json'), 'utf8'));

        dataManager.settlements = settlementsData.settlements || [];
        dataManager.cargoTypes = cargoData.cargoTypes || [];
        dataManager.config = configData;

        // Reset season for each test
        await dataManager.resetSeason();
    });

    describe('getCurrentSeason', () => {
        test('should return null when no season is set', async () => {
            const season = await dataManager.getCurrentSeason();
            expect(season).toBeNull();
        });

        test('should return the current season when set', async () => {
            await dataManager.setCurrentSeason('spring');
            const season = await dataManager.getCurrentSeason();
            expect(season).toBe('spring');
        });
    });

    describe('setCurrentSeason', () => {
        test('should set valid season successfully', async () => {
            const result = await dataManager.setCurrentSeason('summer');
            expect(result).toBe(true);
            
            const season = await dataManager.getCurrentSeason();
            expect(season).toBe('summer');
        });

        test('should reject invalid season', async () => {
            const result = await dataManager.setCurrentSeason('invalid');
            expect(result).toBe(false);
            
            const season = await dataManager.getCurrentSeason();
            expect(season).toBeNull();
        });

        test('should persist season to settings', async () => {
            await dataManager.setCurrentSeason('autumn');
            
            const settingValue = await global.game.settings.get('fvtt-trading-places', 'currentSeason');
            expect(settingValue).toBe('autumn');
        });

        test('should handle all valid seasons', async () => {
            const validSeasons = ['spring', 'summer', 'autumn', 'winter'];
            
            for (const season of validSeasons) {
                const result = await dataManager.setCurrentSeason(season);
                expect(result).toBe(true);
                
                const currentSeason = await dataManager.getCurrentSeason();
                expect(currentSeason).toBe(season);
            }
        });
    });

    describe('validateSeasonSet', () => {
        test('should return false when no season is set', async () => {
            const isValid = await dataManager.validateSeasonSet();
            expect(isValid).toBe(false);
        });

        test('should return true when valid season is set', async () => {
            await dataManager.setCurrentSeason('winter');
            const isValid = await dataManager.validateSeasonSet();
            expect(isValid).toBe(true);
        });
    });

    describe('getValidSeasons', () => {
        test('should return all four seasons', () => {
            const seasons = dataManager.getValidSeasons();
            expect(seasons).toEqual(['spring', 'summer', 'autumn', 'winter']);
        });
    });

    describe('getSeasonDisplayName', () => {
        test('should capitalize season names', () => {
            expect(dataManager.getSeasonDisplayName('spring')).toBe('Spring');
            expect(dataManager.getSeasonDisplayName('summer')).toBe('Summer');
            expect(dataManager.getSeasonDisplayName('autumn')).toBe('Autumn');
            expect(dataManager.getSeasonDisplayName('winter')).toBe('Winter');
        });

        test('should handle invalid input', () => {
            expect(dataManager.getSeasonDisplayName(null)).toBe('Unknown');
            expect(dataManager.getSeasonDisplayName('')).toBe('Unknown');
            expect(dataManager.getSeasonDisplayName(123)).toBe('Unknown');
        });
    });

    describe('getSeasonalPrices', () => {
        test('should return prices for all cargo types in given season', () => {
            // Cargo names/schema changed: Grain -> Sustenance, Wine -> Wine/Brandy,
            // Cargo names/schema changed: Grain -> Sustenance, Wine -> Wine,
            // and prices are now basePrice * seasonalModifiers rather than a flat
            // per-season value. Sustenance basePrice=24, spring modifier=1 -> 24.
            // Cattle basePrice=2160, spring modifier=1 -> 2160.
            const springPrices = dataManager.getSeasonalPrices('spring');

            expect(springPrices).toHaveProperty('Sustenance');
            expect(springPrices).toHaveProperty('Wine');
            expect(springPrices).toHaveProperty('Cattle');

            expect(springPrices.Sustenance.basePrice).toBe(24);
            expect(springPrices.Cattle.basePrice).toBe(2160);
        });

        test('should include quality tiers when available', () => {
            // Wine's quality tiers are swill/passable/average/good/
            // excellent/top_shelf, not the old poor/average/good/excellent
            const springPrices = dataManager.getSeasonalPrices('spring');

            expect(springPrices['Wine'].qualityTiers).toHaveProperty('swill');
            expect(springPrices['Wine'].qualityTiers).toHaveProperty('average');
            expect(springPrices['Wine'].qualityTiers).toHaveProperty('good');
            expect(springPrices['Wine'].qualityTiers).toHaveProperty('excellent');
            expect(springPrices['Wine'].qualityTiers).toHaveProperty('top_shelf');
        });
    });

    describe('compareSeasonalPrices', () => {
        test('should compare prices across all seasons for a cargo type', () => {
            const comparison = dataManager.compareSeasonalPrices('Sustenance');
            expect(comparison).toBeDefined();
            expect(comparison.cargoName).toBe('Sustenance');
            expect(comparison.prices.spring).toBe(24);
            expect(comparison.prices.summer).toBe(12);
            expect(comparison.prices.autumn).toBe(6);
            expect(comparison.prices.winter).toBe(12);
        });

        test('should return null for invalid cargo type', () => {
            const comparison = dataManager.compareSeasonalPrices('NonExistent');
            expect(comparison).toBeNull();
        });
    });

    describe('getTradingRecommendations', () => {
        test('should provide buy/sell recommendations for all cargo types', () => {
            const recommendations = dataManager.getTradingRecommendations();

            expect(recommendations).toHaveProperty('Sustenance');
            expect(recommendations).toHaveProperty('Wine');
            expect(recommendations).toHaveProperty('Cattle');

            const sustenanceRec = recommendations.Sustenance;
            expect(sustenanceRec).toHaveProperty('bestBuySeason', 'autumn'); // Lowest price
            expect(sustenanceRec).toHaveProperty('bestSellSeason', 'spring'); // Highest price
            expect(sustenanceRec).toHaveProperty('priceVariation', 18);
            expect(sustenanceRec).toHaveProperty('profitPotential', '300.0%'); // (24-6)/6 * 100
        });
    });

    describe('initializeSeasonManagement', () => {
        test('should initialize successfully with no season set', async () => {
            const result = await dataManager.initializeSeasonManagement();
            expect(result).toBe(true);
        });

        test('should initialize successfully with season already set', async () => {
            await dataManager.setCurrentSeason('spring');
            const result = await dataManager.initializeSeasonManagement();
            expect(result).toBe(true);
        });
    });

    describe('resetSeason', () => {
        test('should reset season to null', async () => {
            await dataManager.setCurrentSeason('spring');
            expect(await dataManager.getCurrentSeason()).toBe('spring');
            
            const result = await dataManager.resetSeason();
            expect(result).toBe(true);
            
            const season = await dataManager.getCurrentSeason();
            expect(season).toBeNull();
        });
    });

    describe('season change notifications', () => {
        test('should call notifySeasonChange when season is set', async () => {
            // Mock console.log to capture notifications
            const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

            await dataManager.setCurrentSeason('spring');

            // The "Season change notification: ..." log was intentionally
            // removed (see notifySeasonChange's comment) to fix a duplicate-
            // notification bug - the application layer handles user-facing
            // notifications now, not DataManager itself.
            expect(consoleSpy).toHaveBeenCalledWith('Pricing updated for season: spring');

            consoleSpy.mockRestore();
        });
    });

    describe('seasonal price calculations', () => {
        test('should calculate correct seasonal prices with quality tiers', () => {
            // The real Wine/Brandy dataset entry has basePrice: 0 (its actual
            // sale price comes from a different mechanism), which would make
            // this test degenerate (0 * any tier = 0). Use a synthetic cargo
            // object with the current basePrice+seasonalModifiers schema to
            // actually exercise quality tier multiplication, same pattern as
            // data-manager.test.js's equivalent test.
            const wineCargo = {
                name: 'Wine',
                basePrice: 15,
                seasonalModifiers: { spring: 1, summer: 1, autumn: 1, winter: 1 },
                qualityTiers: {
                    poor: 0.5,
                    average: 1.0,
                    good: 1.5,
                    excellent: 2.0
                }
            };

            const poorWinePrice = dataManager.getSeasonalPrice(wineCargo, 'spring', 'poor');
            const averageWinePrice = dataManager.getSeasonalPrice(wineCargo, 'spring', 'average');
            const goodWinePrice = dataManager.getSeasonalPrice(wineCargo, 'spring', 'good');
            const excellentWinePrice = dataManager.getSeasonalPrice(wineCargo, 'spring', 'excellent');

            expect(poorWinePrice).toBe(7.5); // 15 * 0.5
            expect(averageWinePrice).toBe(15); // 15 * 1.0
            expect(goodWinePrice).toBe(22.5); // 15 * 1.5
            expect(excellentWinePrice).toBe(30); // 15 * 2.0
        });

        test('should handle cargo without quality tiers', () => {
            const sustenance = dataManager.getCargoType('Sustenance');
            expect(sustenance).not.toBeNull();

            // basePrice=24, autumn modifier=0.25 -> 6
            const sustenancePrice = dataManager.getSeasonalPrice(sustenance, 'autumn');
            expect(sustenancePrice).toBe(6);
        });
    });
});

// Export for manual testing
module.exports = { DataManager };