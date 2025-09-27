/**
 * Manual test script for Native UI Integration
 * Run this in a FoundryVTT console to test the implementation
 */

console.log('=== WFRP Trading Native UI Integration Test ===');

// Test 1: Check if the class is available
if (typeof WFRPNativeUIIntegration !== 'undefined') {
    console.log('✓ WFRPNativeUIIntegration class is available');
} else {
    console.error('✗ WFRPNativeUIIntegration class not found');
}

// Test 2: Check if global API is available
if (game.wfrpTrading) {
    console.log('✓ game.wfrpTrading API is available');
    console.log('Available methods:', Object.keys(game.wfrpTrading));
} else {
    console.error('✗ game.wfrpTrading API not found');
}

// Test 3: Test API methods
if (game.wfrpTrading) {
    try {
        const currentSeason = game.wfrpTrading.getCurrentSeason();
        console.log('✓ getCurrentSeason() works, current season:', currentSeason);
    } catch (error) {
        console.error('✗ getCurrentSeason() failed:', error.message);
    }
    
    if (typeof game.wfrpTrading.openTrading === 'function') {
        console.log('✓ openTrading() method is available');
    } else {
        console.error('✗ openTrading() method not found');
    }
    
    if (typeof game.wfrpTrading.setSeason === 'function') {
        console.log('✓ setSeason() method is available');
    } else {
        console.error('✗ setSeason() method not found');
    }
}

// Test 4: Check if floating buttons are removed
const floatingButtons = document.querySelectorAll('.trading-module-button, .trading-button');
if (floatingButtons.length === 0) {
    console.log('✓ Floating button overlays have been removed');
} else {
    console.warn('⚠ Found', floatingButtons.length, 'floating buttons still present');
}

// Test 5: Check if hotbar integration is working
const hotbarTradingButton = document.querySelector('.wfrp-trading-macro');
if (hotbarTradingButton) {
    console.log('✓ Hotbar trading button is present');
} else {
    console.warn('⚠ Hotbar trading button not found (may not be rendered yet)');
}

// Test 6: Check if sidebar integration is working
const sidebarTradingButton = document.querySelector('a[data-tab="wfrp-trading-sidebar"]');
if (sidebarTradingButton) {
    console.log('✓ Sidebar trading button is present');
} else {
    console.warn('⚠ Sidebar trading button not found (may not be rendered yet)');
}

// Test 7: Check if scene controls integration is working
const sceneControls = document.querySelector('.scene-control[data-control="wfrp-trading"]');
if (sceneControls) {
    console.log('✓ Scene controls trading button is present');
} else {
    console.warn('⚠ Scene controls trading button not found (may not be rendered yet)');
}

console.log('=== Test Complete ===');
console.log('To test the UI integration:');
console.log('1. Look for trading controls in the scene controls toolbar (left side)');
console.log('2. Look for trading tab button in the sidebar (should have a coins icon)');
console.log('3. Look for trading button in the hotbar (orange button with coins icon)');
console.log('4. Try running: game.wfrpTrading.openTrading()');
console.log('5. Click the sidebar trading button to open the trading sidebar tab');
console.log('6. If you are GM, try changing the season in the sidebar tab');