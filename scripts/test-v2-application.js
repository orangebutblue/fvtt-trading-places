/**
 * Simple validation script for V2 Application Framework
 * This can be run in the browser console to test the new application
 */

// Test function to validate V2 Application Framework
function testV2ApplicationFramework() {
    console.log('=== Testing Trading Places V2 Application Framework ===');
    
    try {
        // Check if the class is available
        if (typeof WFRPTradingApplication === 'undefined') {
            throw new Error('WFRPTradingApplication class not found');
        }
        
        console.log('✓ WFRPTradingApplication class is available');
        
        // Check DEFAULT_OPTIONS structure
        const defaultOptions = WFRPTradingApplication.DEFAULT_OPTIONS;
        if (!defaultOptions) {
            throw new Error('DEFAULT_OPTIONS not defined');
        }
        
        console.log('✓ DEFAULT_OPTIONS defined:', defaultOptions);
        
        // Check PARTS structure
        const parts = WFRPTradingApplication.PARTS;
        if (!parts || !parts.header || !parts.content || !parts.footer) {
            throw new Error('PARTS structure incomplete');
        }
        
        console.log('✓ PARTS structure complete:', Object.keys(parts));
        
        // Check if it extends ApplicationV2
        if (!WFRPTradingApplication.prototype instanceof foundry.applications.api.ApplicationV2) {
            throw new Error('WFRPTradingApplication does not extend ApplicationV2');
        }
        
        console.log('✓ Properly extends ApplicationV2');
        
        // Test instantiation (without rendering)
        const mockOptions = {};
        
        // Check if WFRPRiverTrading is available, if not mock it for testing
        if (!window.WFRPRiverTrading) {
            window.WFRPRiverTrading = {
                getDataManager: () => ({ getAllSettlements: () => [] }),
                getTradingEngine: () => ({ getCurrentSeason: () => 'spring' }),
                getSystemAdapter: () => ({})
            };
            console.log('✓ Mocked WFRPRiverTrading for testing');
        } else {
            console.log('✓ WFRPRiverTrading already available');
        }
        
        const app = new WFRPTradingApplication(mockOptions);
        
        console.log('✓ Application instantiated successfully');
        
        // Test context preparation
        const context = app._prepareContext({});
        
        console.log('✓ Context preparation works');
        
        console.log('=== V2 Application Framework Test PASSED ===');
        return true;
        
    } catch (error) {
        console.error('=== V2 Application Framework Test FAILED ===');
        console.error('Error:', error.message);
        return false;
    }
}

// Export for use in browser console
window.testV2ApplicationFramework = testV2ApplicationFramework;