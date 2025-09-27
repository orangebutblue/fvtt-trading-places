/**
 * Simple test to check if WFRPNativeUIIntegration class is loading properly
 * Run this in FoundryVTT console after module loads
 */

console.log('=== Class Loading Test ===');

// Check if class is defined
console.log('typeof WFRPNativeUIIntegration:', typeof WFRPNativeUIIntegration);
console.log('window.WFRPNativeUIIntegration:', typeof window.WFRPNativeUIIntegration);

// Try to create an instance
try {
    const testInstance = new WFRPNativeUIIntegration();
    console.log('✓ Successfully created WFRPNativeUIIntegration instance');
} catch (error) {
    console.error('✗ Failed to create WFRPNativeUIIntegration instance:', error);
}

// Check if the script was loaded
const scripts = document.querySelectorAll('script[src*="native-ui-integration"]');
console.log('Native UI Integration script tags found:', scripts.length);

if (scripts.length > 0) {
    console.log('Script src:', scripts[0].src);
} else {
    console.warn('No native-ui-integration script tag found');
}