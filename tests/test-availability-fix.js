#!/usr/bin/env node

/**
 * Test the availability UI fix to see if debugging works
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🧪 Testing Fixed Availability UI...');

try {
    // Read the updated trading application file
    const appPath = path.join(__dirname, 'scripts', 'trading-application-v2.js');
    const appContent = fs.readFileSync(appPath, 'utf8');
    
    // Check for our debugging fixes
    const hasDebugStart = appContent.includes('DEBUG: _showAvailabilityResults called with');
    const hasResourceTypesDisplay = appContent.includes('Available Resource Types:');
    const hasDetailedCargoInfo = appContent.includes('Detailed Cargo Information:');
    const hasDebugHTML = appContent.includes('DEBUG: Setting innerHTML to:');
    
    console.log('✅ File loaded successfully');
    console.log(`✅ Debug logging added: ${hasDebugStart}`);
    console.log(`✅ Resource types display: ${hasResourceTypesDisplay}`);
    console.log(`✅ Detailed cargo info: ${hasDetailedCargoInfo}`);
    console.log(`✅ HTML debug output: ${hasDebugHTML}`);
    
    // Check template fix
    const templatePath = path.join(__dirname, 'templates', 'trading-unified.hbs');
    const templateContent = fs.readFileSync(templatePath, 'utf8');
    const hasCleanTemplate = !templateContent.includes('Cargo Available!') && 
                             templateContent.includes('Content will be populated by JavaScript');
    
    console.log(`✅ Template cleaned up: ${hasCleanTemplate}`);
    
    if (hasDebugStart && hasResourceTypesDisplay && hasDetailedCargoInfo && hasDebugHTML && hasCleanTemplate) {
        console.log('🎉 All availability UI fixes applied!');
        console.log('📋 Now both success and failure cases should show detailed information.');
        console.log('📋 Resource names should be displayed for successful availability checks.');
    } else {
        console.log('❌ Some fixes may not have been applied correctly.');
    }
    
} catch (error) {
    console.error('❌ Error testing availability UI fixes:', error.message);
    process.exit(1);
}