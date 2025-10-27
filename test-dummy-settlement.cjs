const DataManager = require('./scripts/data-manager.js');
const dm = new DataManager();

// Test the dummy settlement data
const dummySettlement = {
    name: 'Example Settlement',
    region: 'Example Region',
    size: 'T',
    wealth: 3,
    population: 5000,
    ruler: 'Example Ruler',
    notes: 'This is a placeholder settlement. Edit or delete this settlement and add your own settlements using the Data Management interface.',
    source: ['trade', 'agriculture']
};

const validation = dm.validateSettlement(dummySettlement);
console.log('Validation result:', validation.valid);
if (!validation.valid) {
    console.log('Errors:', validation.errors);
} else {
    console.log('Dummy settlement passes validation!');
}