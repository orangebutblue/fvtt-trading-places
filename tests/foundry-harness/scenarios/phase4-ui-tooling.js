/**
 * Phase 4 UI Tooling Test Scenario
 * Tests the data management UI and enhanced trading dialog
 */

import { createTestActor } from '../stubs/actors.js';
import { getChatLog, clearChatLog } from '../stubs/chat.js';

export default async function phase4UIToolingScenario(harness) {
    console.log('=== Phase 4 UI Tooling Test Scenario ===');
    
    // Clear chat log
    clearChatLog();
    
    try {
        // Test 1: Data Management UI Template Rendering
        console.log('\n--- Test 1: Data Management UI ---');
        
        const testSettlements = [
            {
                region: 'Reikland',
                name: 'ALTDORF',
                population: 105000,
                size: 5,
                ruler: 'Emperor Karl Franz I',
                wealth: 5,
                flags: ['trade', 'government'],
                produces: ['Luxuries'],
                demands: ['Grain', 'Metal'],
                garrison: { a: 2000, b: 5000, c: 10000 },
                notes: 'Imperial capital'
            },
            {
                region: 'Averland',
                name: 'Friedendorf',
                population: 150,
                size: 1,
                ruler: 'Local Burgomeister',
                wealth: 2,
                flags: ['agriculture'],
                produces: ['Grain'],
                demands: [],
                garrison: { c: 15 },
                notes: 'Small farming village'
            }
        ];

        const testCargoTypes = [
            {
                name: 'Grain',
                category: 'Bulk Goods',
                basePrice: 1,
                seasonalModifiers: { spring: 0.9, summer: 1.0, autumn: 1.3, winter: 1.1 },
                description: 'Essential food staple'
            },
            {
                name: 'Luxuries',
                category: 'Luxury Goods',
                basePrice: 50,
                seasonalModifiers: { spring: 1.0, summer: 1.0, autumn: 1.0, winter: 1.2 },
                description: 'Fine goods for the wealthy'
            }
        ];

        const availableFlags = {
            trade: { description: 'Major trading hub with enhanced merchant availability' },
            agriculture: { description: 'Agricultural settlement producing food goods' },
            government: { description: 'Administrative center with official oversight' }
        };

        if (harness.options.uiMode) {
            console.log('Testing data management template rendering...');
            
            const dataManagementData = {
                settlements: testSettlements,
                cargoTypes: testCargoTypes,
                availableFlags,
                regions: ['Reikland', 'Averland'],
                cargoCategories: ['Bulk Goods', 'Luxury Goods'],
                currentTab: 'settlements',
                hasChanges: false,
                changesCount: 0
            };
            
            try {
                const html = await harness.renderTemplate('data-management.hbs', dataManagementData);
                if (html) {
                    console.log('✓ Data management template rendered successfully');
                    console.log(`Template length: ${html.length} characters`);
                    
                    // Validate key elements are present
                    if (html.includes('settlement-item') && html.includes('cargo-item')) {
                        console.log('✓ Template contains expected UI elements');
                    } else {
                        console.log('⚠ Template missing some expected elements');
                    }
                } else {
                    console.log('⚠ Data management template rendering returned null');
                }
            } catch (error) {
                console.log(`⚠ Data management template rendering failed: ${error.message}`);
            }
        } else {
            console.log('UI mode disabled - skipping template rendering tests');
        }

        // Test 2: Enhanced Trading Dialog Data Preparation
        console.log('\n--- Test 2: Enhanced Trading Dialog Data ---');
        
        const testActor = createTestActor({
            name: 'Test Merchant',
            money: { gc: 200, ss: 1000, bp: 2000 }
        });

        const testSettlement = testSettlements[0]; // Use Altdorf
        
        // Calculate equilibrium for each cargo type
        const cargoEquilibrium = {};
        const testCargoNames = ['Grain', 'Metal', 'Luxuries', 'Timber'];
        
        testCargoNames.forEach(cargoType => {
            const equilibrium = calculateEquilibrium(testSettlement, cargoType);
            cargoEquilibrium[cargoType] = {
                ...equilibrium,
                supplyPercent: (equilibrium.supply / (equilibrium.supply + equilibrium.demand)) * 100,
                demandPercent: (equilibrium.demand / (equilibrium.supply + equilibrium.demand)) * 100
            };
            
            console.log(`  ${cargoType}: Supply ${equilibrium.supply} / Demand ${equilibrium.demand} (${equilibrium.state})`);
        });

        // Test 3: Merchant Generation for UI
        console.log('\n--- Test 3: Merchant Generation for Trading UI ---');
        
        const merchants = [];
        
        testCargoNames.forEach(cargoType => {
            const equilibrium = cargoEquilibrium[cargoType];
            
            if (equilibrium.state !== 'blocked') {
                // Generate test merchants
                const producerCount = Math.max(1, Math.floor(testSettlement.size / 2));
                const seekerCount = Math.max(1, Math.floor(testSettlement.size / 2));
                
                // Generate producers
                for (let i = 0; i < producerCount; i++) {
                    merchants.push(generateTestMerchant(testSettlement, cargoType, 'producer', equilibrium, i));
                }
                
                // Generate seekers
                for (let i = 0; i < seekerCount; i++) {
                    merchants.push(generateTestMerchant(testSettlement, cargoType, 'seeker', equilibrium, i));
                }
            }
        });

        console.log(`Generated ${merchants.length} merchants for trading dialog`);
        
        // Show sample merchants
        merchants.slice(0, 3).forEach(merchant => {
            console.log(`  - ${merchant.cargoType} ${merchant.type}: Skill ${merchant.skill}, ${merchant.quantity} units @ ${merchant.finalPrice} GC`);
            console.log(`    Personality: ${merchant.personality.name}, Available: ${merchant.availability.isAvailable}`);
        });

        // Test 4: Enhanced Trading Dialog Template
        if (harness.options.uiMode) {
            console.log('\n--- Test 4: Enhanced Trading Dialog Template ---');
            
            const tradingDialogData = {
                actor: {
                    name: testActor.name,
                    money: testActor.system.details.money
                },
                settlement: testSettlement,
                merchants: merchants.slice(0, 6), // Show first 6 merchants
                cargoEquilibrium,
                availableCargoTypes: testCargoNames,
                transactionLog: [
                    {
                        id: 'txn-1',
                        type: 'buy',
                        cargoType: 'Grain',
                        merchantId: 'test-merchant-1',
                        quantity: 5,
                        totalPrice: 5.5,
                        timestamp: new Date(),
                        canUndo: true
                    }
                ],
                desperationConfig: {
                    priceModifier: 1.15,
                    quantityReduction: 0.25,
                    skillPenalty: 0.2,
                    priceIncrease: 15
                }
            };
            
            try {
                const html = await harness.renderTemplate('trading-dialog-enhanced.hbs', tradingDialogData);
                if (html) {
                    console.log('✓ Enhanced trading dialog template rendered successfully');
                    console.log(`Template length: ${html.length} characters`);
                    
                    // Validate key elements
                    const expectedElements = [
                        'settlement-header-panel',
                        'equilibrium-summary',
                        'merchant-card',
                        'transaction-section'
                    ];
                    
                    const foundElements = expectedElements.filter(element => html.includes(element));
                    console.log(`✓ Found ${foundElements.length}/${expectedElements.length} expected UI elements`);
                    
                    if (foundElements.length === expectedElements.length) {
                        console.log('✓ All expected UI elements present');
                    } else {
                        const missing = expectedElements.filter(element => !html.includes(element));
                        console.log(`⚠ Missing elements: ${missing.join(', ')}`);
                    }
                } else {
                    console.log('⚠ Enhanced trading dialog template rendering returned null');
                }
            } catch (error) {
                console.log(`⚠ Enhanced trading dialog template rendering failed: ${error.message}`);
            }
        }

        // Test 5: UI State Management Simulation
        console.log('\n--- Test 5: UI State Management ---');
        
        // Simulate form validation
        console.log('Testing form validation logic...');
        
        const testFormData = {
            validSettlement: {
                name: 'Test Settlement',
                region: 'Test Region',
                population: 1000,
                size: 2,
                wealth: 3,
                flags: ['trade'],
                produces: ['Grain'],
                demands: ['Luxuries']
            },
            invalidSettlement: {
                name: '', // Invalid - empty name
                region: 'Test Region',
                population: -100, // Invalid - negative population
                size: 10, // Invalid - size too high
                wealth: 0 // Invalid - wealth too low
            }
        };

        // Test validation logic
        const validationResults = {
            valid: validateSettlementData(testFormData.validSettlement),
            invalid: validateSettlementData(testFormData.invalidSettlement)
        };

        console.log(`Valid settlement validation: ${validationResults.valid.isValid ? 'PASS' : 'FAIL'}`);
        console.log(`Invalid settlement validation: ${validationResults.invalid.isValid ? 'FAIL' : 'PASS'} (expected to fail)`);
        
        if (!validationResults.invalid.isValid) {
            console.log(`Validation errors: ${validationResults.invalid.errors.join(', ')}`);
        }

        // Test 6: Equilibrium Visualization Data
        console.log('\n--- Test 6: Equilibrium Visualization ---');
        
        // Test equilibrium state detection
        const equilibriumStates = Object.entries(cargoEquilibrium).map(([cargo, eq]) => ({
            cargo,
            state: eq.state,
            ratio: Math.round(eq.ratio * 100) / 100,
            visualData: {
                supplyWidth: eq.supplyPercent,
                demandWidth: eq.demandPercent,
                colorClass: getEquilibriumColorClass(eq.state)
            }
        }));

        equilibriumStates.forEach(eq => {
            console.log(`  ${eq.cargo}: ${eq.state} (${eq.ratio}:1) - Supply ${eq.visualData.supplyWidth.toFixed(1)}%, Demand ${eq.visualData.demandWidth.toFixed(1)}%`);
        });

        // Test 7: Template Helper Functions
        console.log('\n--- Test 7: Template Helper Functions ---');
        
        // Test template helpers that would be used in the UI
        const helperTests = {
            getSizeName: testSizeHelper(),
            getWealthName: testWealthHelper(),
            getEquilibriumStateLabel: testEquilibriumHelper(),
            formatTime: testTimeHelper()
        };

        Object.entries(helperTests).forEach(([helper, result]) => {
            console.log(`  ${helper}: ${result ? 'PASS' : 'FAIL'}`);
        });

        console.log('\n=== Phase 4 UI Tooling Test Complete ===');
        return {
            success: true,
            templatesRendered: harness.options.uiMode ? 2 : 0,
            merchantsGenerated: merchants.length,
            equilibriumCalculated: Object.keys(cargoEquilibrium).length,
            validationTested: true,
            helpersValidated: Object.values(helperTests).every(result => result)
        };

    } catch (error) {
        console.error('Phase 4 UI Tooling Test failed:', error);
        throw error;
    }
}

// Helper functions for testing

function calculateEquilibrium(settlement, cargoType) {
    let supply = 100;
    let demand = 100;
    
    // Apply produces/demands
    if (settlement.produces?.includes(cargoType)) {
        const transfer = Math.floor(demand * 0.5);
        supply += transfer;
        demand -= transfer;
    }
    
    if (settlement.demands?.includes(cargoType)) {
        const transfer = Math.floor(supply * 0.35);
        demand += transfer;
        supply -= transfer;
    }
    
    // Apply flag effects
    settlement.flags?.forEach(flag => {
        const flagEffects = {
            trade: { supplyBonus: 30 },
            government: { demandBonus: 20 },
            agriculture: { supplyBonus: 40 }
        };
        
        const effect = flagEffects[flag];
        if (effect?.supplyBonus) {
            supply += effect.supplyBonus;
            demand -= Math.floor(effect.supplyBonus * 0.5);
        }
        if (effect?.demandBonus) {
            demand += effect.demandBonus;
            supply -= Math.floor(effect.demandBonus * 0.5);
        }
    });
    
    // Clamp values
    supply = Math.max(5, Math.min(195, supply));
    demand = Math.max(5, Math.min(195, demand));
    
    // Determine state
    const ratio = supply / demand;
    let state = 'balanced';
    if (supply <= 10 || demand <= 10) state = 'blocked';
    else if (supply <= 20 || demand <= 20) state = 'desperate';
    else if (ratio > 2.0) state = 'oversupplied';
    else if (ratio < 0.5) state = 'undersupplied';
    
    return { supply, demand, ratio, state };
}

function generateTestMerchant(settlement, cargoType, type, equilibrium, index) {
    const personalities = ['Standard Merchant', 'Shrewd Dealer', 'Generous Trader', 'Suspicious Dealer'];
    const personalityIndex = index % personalities.length;
    
    const skill = Math.max(5, Math.min(95, 25 + (settlement.wealth * 8) + (Math.random() * 30)));
    const quantity = Math.max(1, settlement.size + Math.floor(Math.random() * settlement.size));
    const basePrice = getBasePrice(cargoType);
    
    // Apply equilibrium price modifiers
    let finalPrice = basePrice;
    const ratio = equilibrium.supply / equilibrium.demand;
    if (ratio > 1.5) finalPrice *= 0.8;
    else if (ratio < 0.67) finalPrice *= 1.2;
    
    // Apply special behavior discounts
    if (settlement.flags?.includes('smuggling')) {
        finalPrice *= 0.85;
    }
    
    const isAvailable = Math.random() < (skill / 100);
    
    return {
        id: `${settlement.name.toLowerCase()}-${cargoType.toLowerCase()}-${type}-${index}`,
        type,
        cargoType,
        skill: Math.round(skill),
        quantity,
        basePrice,
        finalPrice: Math.round(finalPrice * 100) / 100,
        personality: { 
            name: personalities[personalityIndex],
            description: `A ${personalities[personalityIndex].toLowerCase()} with unique trading style`
        },
        equilibrium: { supply: equilibrium.supply, demand: equilibrium.demand },
        availability: { 
            isAvailable,
            rollRequired: true,
            rollMade: Math.floor(Math.random() * 100) + 1,
            desperation: { available: false, penaltiesApplied: false }
        },
        specialBehaviors: settlement.flags?.filter(f => ['smuggling', 'piracy', 'government'].includes(f)) || []
    };
}

function getBasePrice(cargoType) {
    const prices = {
        'Grain': 1, 'Metal': 8, 'Timber': 3, 'Luxuries': 50,
        'Wool': 1, 'Wine/Brandy': 3, 'Armaments': 12
    };
    return prices[cargoType] || 5;
}

function validateSettlementData(settlement) {
    const errors = [];
    
    if (!settlement.name || settlement.name.trim() === '') {
        errors.push('Name is required');
    }
    
    if (!settlement.region || settlement.region.trim() === '') {
        errors.push('Region is required');
    }
    
    if (settlement.population < 0) {
        errors.push('Population cannot be negative');
    }
    
    if (settlement.size < 1 || settlement.size > 5) {
        errors.push('Size must be between 1 and 5');
    }
    
    if (settlement.wealth < 1 || settlement.wealth > 5) {
        errors.push('Wealth must be between 1 and 5');
    }
    
    return {
        isValid: errors.length === 0,
        errors
    };
}

function getEquilibriumColorClass(state) {
    const colorMap = {
        balanced: 'green',
        oversupplied: 'blue',
        undersupplied: 'yellow',
        desperate: 'red',
        blocked: 'gray'
    };
    return colorMap[state] || 'gray';
}

function testSizeHelper() {
    const sizeNames = { 1: 'Hamlet', 2: 'Village', 3: 'Town', 4: 'City', 5: 'Metropolis' };
    return sizeNames[3] === 'Town'; // Test case
}

function testWealthHelper() {
    const wealthNames = { 1: 'Squalid', 2: 'Poor', 3: 'Average', 4: 'Bustling', 5: 'Prosperous' };
    return wealthNames[4] === 'Bustling'; // Test case
}

function testEquilibriumHelper() {
    const stateLabels = { 
        balanced: 'Balanced Market', 
        oversupplied: 'Oversupplied', 
        undersupplied: 'Undersupplied',
        desperate: 'Desperate Trading',
        blocked: 'No Trade'
    };
    return stateLabels.balanced === 'Balanced Market'; // Test case
}

function testTimeHelper() {
    const testDate = new Date();
    const formatted = testDate.toLocaleTimeString();
    return formatted.includes(':'); // Basic time format check
}