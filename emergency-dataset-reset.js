// Trading Places Emergency Dataset Reset Script
// Run this in the browser console (F12) when Trading Places fails to load

(async function() {
    const MODULE_ID = 'fvtt-trading-places';

    console.log('🔧 Trading Places Emergency Dataset Reset');
    console.log('=====================================');

    try {
        // Step 1: Reset active dataset to wfrp4e
        console.log('1. Resetting active dataset to wfrp4e...');
        await game.settings.set(MODULE_ID, 'activeDataset', 'wfrp4e');
        console.log('✅ Active dataset reset to wfrp4e');

        // Step 2: Clear user datasets (they may be corrupted)
        console.log('2. Clearing user datasets...');
        await game.settings.set(MODULE_ID, 'userDatasets', []);
        await game.settings.set(MODULE_ID, 'userDatasetsData', {});
        console.log('✅ User datasets cleared');

        // Step 3: Reset current season to spring
        console.log('3. Resetting season to spring...');
        await game.settings.set(MODULE_ID, 'currentSeason', 'spring');
        console.log('✅ Season reset to spring');

        // Step 4: Clear any cached cargo data
        console.log('4. Clearing cached cargo data...');
        await game.settings.set(MODULE_ID, 'currentCargo', {});
        await game.settings.set(MODULE_ID, 'transactionHistory', {});
        await game.settings.set(MODULE_ID, 'cargoAvailabilityData', {});
        await game.settings.set(MODULE_ID, 'sellerOffersData', {});
        console.log('✅ Cached data cleared');

        console.log('');
        console.log('🎉 Emergency reset complete!');
        console.log('Please refresh the page (F5) to reload Trading Places with the default dataset.');

        // Show notification
        ui.notifications.info('Trading Places emergency reset complete. Please refresh the page.');

    } catch (error) {
        console.error('❌ Emergency reset failed:', error);
        ui.notifications.error('Emergency reset failed. Check console for details.');
    }
})();