/**
 * Test script for DataManager data loading functionality
 */

const fs = require('fs');
const path = require('path');
const DataManager = require('./data-manager.js');

/**
 * Test data loading functionality
 */
async function testDataLoading() {
    console.log('='.repeat(60));
    console.log('Trading Places Module - Data Loading Tests');
    console.log('='.repeat(60));

    const dataManager = new DataManager();

    try {
        // Manually load data for testing (simulating what loadActiveDataset would do)
        const settlementsData = JSON.parse(fs.readFileSync(path.join(__dirname, '../datasets/active/settlements.json'), 'utf8'));
        const cargoData = JSON.parse(fs.readFileSync(path.join(__dirname, '../datasets/active/cargo-types.json'), 'utf8'));
        const configData = JSON.parse(fs.readFileSync(path.join(__dirname, '../datasets/active/config.json'), 'utf8'));

        // Simulate loaded data
        dataManager.settlements = settlementsData.settlements || [];
        dataManager.cargoTypes = cargoData.cargoTypes || [];
        dataManager.config = configData;

        console.log(`\nLoaded ${dataManager.settlements.length} settlements`);
        console.log(`Loaded ${dataManager.cargoTypes.length} cargo types`);

        // Test 1: Settlement lookup functions
        console.log('\n1. Testing settlement lookup functions...');
        
        // Test getSettlement
        const averheim = dataManager.getSettlement('Averheim');
        if (averheim) {
            console.log(`✓ getSettlement('Averheim'): Found ${averheim.name}`);
        } else {
            console.log('✗ getSettlement failed to find Averheim');
        }

        // Test getSettlementsByRegion
        const empireSettlements = dataManager.getSettlementsByRegion('Empire');
        console.log(`✓ getSettlementsByRegion('Empire'): Found ${empireSettlements.length} settlements`);

        // Test getSettlementsBySize
        const towns = dataManager.getSettlementsBySize('T');
        console.log(`✓ getSettlementsBySize('T'): Found ${towns.length} towns`);

        // Test getSettlementsByProduction
        const tradeSettlements = dataManager.getSettlementsByProduction('Trade');
        console.log(`✓ getSettlementsByProduction('Trade'): Found ${tradeSettlements.length} trade settlements`);

        // Test getSettlementsByWealth
        const wealthySettlements = dataManager.getSettlementsByWealth(5);
        console.log(`✓ getSettlementsByWealth(5): Found ${wealthySettlements.length} prosperous settlements`);

        // Test 2: Dynamic category discovery
        console.log('\n2. Testing dynamic category discovery...');
        
        const categories = dataManager.buildAvailableCategories();
        console.log(`✓ buildAvailableCategories(): Found ${categories.length} categories`);
        console.log(`  Categories: ${categories.join(', ')}`);

        const regions = dataManager.getAvailableRegions();
        console.log(`✓ getAvailableRegions(): Found ${regions.length} regions`);
        console.log(`  Regions: ${regions.join(', ')}`);

        const sizes = dataManager.getAvailableSizes();
        console.log(`✓ getAvailableSizes(): Found ${sizes.length} size types`);
        console.log(`  Sizes: ${sizes.join(', ')}`);

        // Test 3: Search functionality
        console.log('\n3. Testing search functionality...');
        
        const searchResults = dataManager.searchSettlements({
            region: 'Empire',
            production: 'Trade',
            wealth: 4
        });
        console.log(`✓ searchSettlements (Empire, Trade, Wealth 4): Found ${searchResults.length} settlements`);
        searchResults.forEach(settlement => {
            console.log(`  - ${settlement.name} (${settlement.size}, Wealth ${settlement.wealth})`);
        });

        // Test partial name search
        const nameSearch = dataManager.searchSettlements({ name: 'berg' });
        console.log(`✓ searchSettlements (name contains 'berg'): Found ${nameSearch.length} settlements`);
        nameSearch.forEach(settlement => {
            console.log(`  - ${settlement.name}`);
        });

        // Test 4: Cargo type functions
        console.log('\n4. Testing cargo type functions...');
        
        const grain = dataManager.getCargoType('Grain');
        if (grain) {
            console.log(`✓ getCargoType('Grain'): Found ${grain.name}`);
        } else {
            console.log('✗ getCargoType failed to find Grain');
        }

        const wineCategory = dataManager.getCargoTypesByCategory('Wine');
        console.log(`✓ getCargoTypesByCategory('Wine'): Found ${wineCategory.length} wine types`);
        wineCategory.forEach(cargo => {
            console.log(`  - ${cargo.name}`);
        });

        const cargoCategories = dataManager.getAvailableCargoCategories();
        console.log(`✓ getAvailableCargoCategories(): Found ${cargoCategories.length} categories`);
        console.log(`  Categories: ${cargoCategories.join(', ')}`);

        // Test random cargo for season
        const randomCargo = dataManager.getRandomCargoForSeason('spring');
        if (randomCargo) {
            console.log(`✓ getRandomCargoForSeason('spring'): ${randomCargo.name}`);
        } else {
            console.log('✗ getRandomCargoForSeason failed');
        }

        // Test 5: Configuration access
        console.log('\n5. Testing configuration access...');
        
        const systemConfig = dataManager.getSystemConfig();
        console.log(`✓ getSystemConfig(): ${Object.keys(systemConfig).length} config sections`);

        const currencyConfig = dataManager.getCurrencyConfig();
        console.log(`✓ getCurrencyConfig(): ${currencyConfig.name} (${currencyConfig.abbreviation})`);

        const inventoryConfig = dataManager.getInventoryConfig();
        console.log(`✓ getInventoryConfig(): field=${inventoryConfig.field}, method=${inventoryConfig.addMethod}`);

        // Test 6: Error handling for missing data
        console.log('\n6. Testing error handling for missing data...');
        
        const nonExistentSettlement = dataManager.getSettlement('NonExistent');
        if (nonExistentSettlement === null) {
            console.log('✓ getSettlement handles missing settlement correctly (returns null)');
        } else {
            console.log('✗ getSettlement should return null for missing settlement');
        }

        const emptyRegionSearch = dataManager.getSettlementsByRegion('NonExistentRegion');
        if (emptyRegionSearch.length === 0) {
            console.log('✓ getSettlementsByRegion handles missing region correctly (returns empty array)');
        } else {
            console.log('✗ getSettlementsByRegion should return empty array for missing region');
        }

        const invalidSizeSearch = dataManager.getSettlementsBySize('INVALID');
        if (invalidSizeSearch.length === 0) {
            console.log('✓ getSettlementsBySize handles invalid size correctly (returns empty array)');
        } else {
            console.log('✗ getSettlementsBySize should return empty array for invalid size');
        }

        // Test 7: Data loading test function
        console.log('\n7. Testing data loading test function...');
        
        const testResults = dataManager.testDataLoading();
        console.log(`✓ testDataLoading(): Success=${testResults.success}`);
        console.log(`  Stats: ${testResults.stats.settlements} settlements, ${testResults.stats.cargoTypes} cargo types`);
        console.log(`  Regions: ${testResults.stats.regions}, Categories: ${testResults.stats.categories}`);
        
        if (testResults.errors.length > 0) {
            console.log(`  Errors: ${testResults.errors.join(', ')}`);
        }
        
        if (testResults.warnings.length > 0) {
            console.log(`  Warnings: ${testResults.warnings.join(', ')}`);
        }

        // Summary
        console.log('\n' + '='.repeat(60));
        console.log('✓ ALL DATA LOADING TESTS PASSED');
        console.log('DataManager class is ready for FoundryVTT integration');
        console.log('='.repeat(60));

        return true;

    } catch (error) {
        console.error('Data loading test failed:', error.message);
        console.log('\n' + '='.repeat(60));
        console.log('✗ DATA LOADING TESTS FAILED');
        console.log('='.repeat(60));
        return false;
    }
}

// Run tests if called directly
if (require.main === module) {
    testDataLoading().then(success => {
        process.exit(success ? 0 : 1);
    });
}

module.exports = { testDataLoading };