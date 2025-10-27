// Script to forcibly delete problematic user datasets
// Run this in the browser console in FoundryVTT

const MODULE_ID = "fvtt-trading-places";

async function deleteProblematicDatasets() {
    try {
        console.log('🔧 Starting cleanup of problematic datasets...');

        // Get current user datasets
        const userDatasets = game.settings.get(MODULE_ID, 'userDatasets') || [];
        const userDatasetsData = game.settings.get(MODULE_ID, 'userDatasetsData') || {};

        console.log('📋 Current user datasets:', userDatasets);
        console.log('📊 Current user datasets data keys:', Object.keys(userDatasetsData));

        // Datasets to delete
        const datasetsToDelete = ['kkk', 'aaa'];

        for (const datasetName of datasetsToDelete) {
            console.log(`🗑️ Deleting dataset '${datasetName}'...`);

            // Remove from user datasets list
            const updatedUserDatasets = userDatasets.filter(name => name !== datasetName);
            await game.settings.set(MODULE_ID, 'userDatasets', updatedUserDatasets);

            // Remove from user datasets data
            delete userDatasetsData[datasetName];
            await game.settings.set(MODULE_ID, 'userDatasetsData', userDatasetsData);

            console.log(`✅ Dataset '${datasetName}' deleted successfully`);
        }

        // Verify cleanup
        const finalUserDatasets = game.settings.get(MODULE_ID, 'userDatasets') || [];
        const finalUserDatasetsData = game.settings.get(MODULE_ID, 'userDatasetsData') || {};

        console.log('📋 Final user datasets:', finalUserDatasets);
        console.log('📊 Final user datasets data keys:', Object.keys(finalUserDatasetsData));

        console.log('🎉 Cleanup completed successfully!');

    } catch (error) {
        console.error('❌ Error during cleanup:', error);
    }
}

// Run the cleanup
deleteProblematicDatasets();