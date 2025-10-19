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
            
            const settingValue = await global.game.settings.get('trading-places', 'currentSeason');
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
            const springPrices = dataManager.getSeasonalPrices('spring');
            
            expect(springPrices).toHaveProperty('Grain');
            expect(springPrices).toHaveProperty('Wine');
            expect(springPrices).toHaveProperty('Cattle');
            
            expect(springPrices.Grain.basePrice).toBe(2);
            expect(springPrices.Wine.basePrice).toBe(15);
            expect(springPrices.Cattle.basePrice).toBe(25);
        });

        test('should include quality tiers when available', () => {
            const springPrices = dataManager.getSeasonalPrices('spring');
            
            expect(springPrices.Wine.qualityTiers).toHaveProperty('poor');
            expect(springPrices.Wine.qualityTiers).toHaveProperty('average');
            expect(springPrices.Wine.qualityTiers).toHaveProperty('good');
            expect(springPrices.Wine.qualityTiers).toHaveProperty('excellent');
        });
    });

    describe('compareSeasonalPrices', () => {
        test('should compare prices across all seasons for a cargo type', () => {
            const comparison = dataManager.compareSeasonalPrices('Grain');
            
            expect(comparison).toHaveProperty('cargoName', 'Grain');
            expect(comparison).toHaveProperty('prices');
            expect(comparison).toHaveProperty('bestSeason');
            expect(comparison).toHaveProperty('worstSeason');
            expect(comparison).toHaveProperty('priceRange');
            
            // Grain prices: spring=2, summer=3, autumn=1, winter=4
            expect(comparison.bestSeason).toBe('autumn'); // Lowest price (1)
            expect(comparison.worstSeason).toBe('winter'); // Highest price (4)
            expect(comparison.priceRange).toBe(3); // 4 - 1 = 3
        });

        test('should return null for non-existent cargo', () => {
            const comparison = dataManager.compareSeasonalPrices('NonExistent');
            expect(comparison).toBeNull();
        });
    });

    describe('getTradingRecommendations', () => {
        test('should provide buy/sell recommendations for all cargo types', () => {
            const recommendations = dataManager.getTradingRecommendations();
            
            expect(recommendations).toHaveProperty('Grain');
            expect(recommendations).toHaveProperty('Wine');
            expect(recommendations).toHaveProperty('Cattle');
            
            const grainRec = recommendations.Grain;
            expect(grainRec).toHaveProperty('bestBuySeason', 'autumn'); // Lowest price
            expect(grainRec).toHaveProperty('bestSellSeason', 'winter'); // Highest price
            expect(grainRec).toHaveProperty('priceVariation', 3);
            expect(grainRec).toHaveProperty('profitPotential', '300.0%'); // (4-1)/1 * 100
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
            
            expect(consoleSpy).toHaveBeenCalledWith('Season change notification: unset → spring');
            expect(consoleSpy).toHaveBeenCalledWith('Pricing updated for season: spring');
            
            consoleSpy.mockRestore();
        });
    });

    describe('seasonal price calculations', () => {
        test('should calculate correct seasonal prices with quality tiers', () => {
            const wine = dataManager.getCargoType('Wine');
            expect(wine).not.toBeNull();
            
            // Test spring wine prices with different quality tiers
            const poorWinePrice = dataManager.getSeasonalPrice(wine, 'spring', 'poor');
            const averageWinePrice = dataManager.getSeasonalPrice(wine, 'spring', 'average');
            const goodWinePrice = dataManager.getSeasonalPrice(wine, 'spring', 'good');
            const excellentWinePrice = dataManager.getSeasonalPrice(wine, 'spring', 'excellent');
            
            expect(poorWinePrice).toBe(7.5); // 15 * 0.5
            expect(averageWinePrice).toBe(15); // 15 * 1.0
            expect(goodWinePrice).toBe(22.5); // 15 * 1.5
            expect(excellentWinePrice).toBe(30); // 15 * 2.0
        });

        test('should handle cargo without quality tiers', () => {
            const grain = dataManager.getCargoType('Grain');
            expect(grain).not.toBeNull();
            
            const grainPrice = dataManager.getSeasonalPrice(grain, 'autumn');
            expect(grainPrice).toBe(1); // Base price for autumn
        });
    });
});

// Export for manual testing
module.exports = { DataManager };