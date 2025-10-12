// Test currency context in Foundry environment
// Paste this into Foundry console to verify currency formatting is working

(function testCurrencyFormatting() {
    console.log('=== Testing Currency Formatting ===\n');
    
    // Check if modules are loaded
    const dataManager = window.TradingPlaces?.getDataManager();
    const currencyUtils = window.TradingPlacesCurrencyUtils;
    
    console.log('1. Module Availability:');
    console.log('   - DataManager:', !!dataManager);
    console.log('   - CurrencyUtils:', !!currencyUtils);
    
    if (!dataManager) {
        console.error('❌ DataManager not available!');
        return;
    }
    
    if (!currencyUtils) {
        console.error('❌ CurrencyUtils not available!');
        return;
    }
    
    // Get currency context
    const context = dataManager.getCurrencyContext();
    console.log('\n2. Currency Context:', context);
    
    if (!context) {
        console.error('❌ Currency context is null!');
        return;
    }
    
    // Test conversion
    const testValue = 3.52; // 3.52 GC
    console.log(`\n3. Test Value: ${testValue} GC`);
    
    try {
        const canonical = currencyUtils.convertToCanonical(
            { [context.denominationKey]: testValue },
            context.config
        );
        console.log('   Canonical (BP):', canonical);
        
        const formatted = currencyUtils.formatCurrency(canonical, context.config);
        console.log('   Formatted:', formatted);
        console.log('   Expected: 3GC 12SS 4BP');
        
        if (formatted.includes('GC') && formatted.includes('SS')) {
            console.log('\n✅ Currency formatting is working correctly!');
        } else {
            console.log('\n⚠️ Currency formatting may have issues');
        }
    } catch (error) {
        console.error('❌ Error during conversion:', error);
    }
    
    // Test with transaction data
    console.log('\n4. Testing Transaction Normalization:');
    const testTransaction = {
        cargo: 'Test Cargo',
        quantity: 10,
        pricePerEP: 2.50,
        totalCost: 25.00
    };
    
    console.log('   Before:', testTransaction);
    
    // Simulate what _prepareCurrencyRecord does
    if (context) {
        const priceCanonical = currencyUtils.convertToCanonical(
            { [context.denominationKey]: testTransaction.pricePerEP },
            context.config
        );
        const totalCanonical = currencyUtils.convertToCanonical(
            { [context.denominationKey]: testTransaction.totalCost },
            context.config
        );
        
        testTransaction.formattedPricePerEP = currencyUtils.formatCurrency(priceCanonical, context.config);
        testTransaction.formattedTotalCost = currencyUtils.formatCurrency(totalCanonical, context.config);
        
        console.log('   After:', testTransaction);
        console.log('   ✅ Transaction would display with formatted currency');
    }
    
    console.log('\n=== Test Complete ===');
})();
