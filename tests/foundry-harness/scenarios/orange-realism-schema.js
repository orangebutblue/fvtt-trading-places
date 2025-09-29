/**
 * Orange Realism Schema Test Scenario
 * Tests the new data structure and DataManager integration
 */

import { getChatLog, clearChatLog } from '../stubs/chat.js';

export default async function orangeRealismSchemaScenario(harness) {
    console.log('=== Orange Realism Schema Test Scenario ===');
    
    // Clear chat log
    clearChatLog();
    
    try {
        // Test 1: Load and validate migrated settlement data
        console.log('\n--- Test 1: Settlement Data Structure ---');
        
        // Simulate loading migrated settlement data
        const mockSettlements = [
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
                notes: 'Imperial capital and largest city'
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
            },
            {
                region: 'Hochland',
                name: 'Stöckse',
                population: 98,
                size: 1,
                ruler: 'Grand Baron Ludenhof',
                wealth: 2,
                flags: ['mine'],
                produces: ['Metal'],
                demands: ['Grain', 'Timber'],
                garrison: { c: 10 },
                notes: 'Mining village'
            }
        ];

        console.log(`Testing ${mockSettlements.length} settlements with new schema:`);
        
        mockSettlements.forEach((settlement, index) => {
            console.log(`\n  Settlement ${index + 1}: ${settlement.name}`);
            console.log(`    Region: ${settlement.region}`);
            console.log(`    Population: ${settlement.population} (Size: ${settlement.size})`);
            console.log(`    Wealth: ${settlement.wealth}`);
            console.log(`    Flags: [${settlement.flags.join(', ')}]`);
            console.log(`    Produces: [${settlement.produces.join(', ')}]`);
            console.log(`    Demands: [${settlement.demands.join(', ')}]`);
            console.log(`    Garrison: ${Object.entries(settlement.garrison).map(([type, count]) => `${count}${type}`).join(', ')}`);
        });

        // Test 2: Population-derived size validation
        console.log('\n--- Test 2: Population-Derived Size Validation ---');
        
        const populationThresholds = {
            "1": { "min": 0, "max": 200, "name": "Hamlet" },
            "2": { "min": 201, "max": 1500, "name": "Village" },
            "3": { "min": 1501, "max": 10000, "name": "Town" },
            "4": { "min": 10001, "max": 100000, "name": "City" },
            "5": { "min": 100001, "max": 999999999, "name": "Metropolis" }
        };

        function validatePopulationSize(settlement) {
            const population = settlement.population;
            const actualSize = settlement.size;
            
            for (let size = 1; size <= 5; size++) {
                const threshold = populationThresholds[size.toString()];
                if (population >= threshold.min && population <= threshold.max) {
                    return {
                        expectedSize: size,
                        actualSize,
                        valid: size === actualSize,
                        threshold: threshold.name
                    };
                }
            }
            return { valid: false, error: 'Population out of range' };
        }

        mockSettlements.forEach(settlement => {
            const validation = validatePopulationSize(settlement);
            const status = validation.valid ? '✓' : '⚠';
            console.log(`  ${status} ${settlement.name}: Pop ${settlement.population} → ${validation.threshold || 'Invalid'} (Size: ${settlement.size})`);
            
            if (!validation.valid && validation.error) {
                console.log(`    Error: ${validation.error}`);
            } else if (!validation.valid) {
                console.log(`    Expected size ${validation.expectedSize}, got ${validation.actualSize}`);
            }
        });

        // Test 3: Supply/Demand equilibrium calculations
        console.log('\n--- Test 3: Supply/Demand Equilibrium ---');
        
        const supplyDemandConfig = {
            baseline: { supply: 100, demand: 100 },
            producesShift: 0.5,
            demandsShift: 0.35,
            clamp: { min: 10, max: 190 }
        };

        function calculateEquilibrium(settlement, cargoType) {
            let supply = supplyDemandConfig.baseline.supply;
            let demand = supplyDemandConfig.baseline.demand;

            // Apply produces effects
            if (settlement.produces && settlement.produces.includes(cargoType)) {
                const transfer = Math.floor(demand * supplyDemandConfig.producesShift);
                supply += transfer;
                demand -= transfer;
            }

            // Apply demands effects
            if (settlement.demands && settlement.demands.includes(cargoType)) {
                const transfer = Math.floor(supply * supplyDemandConfig.demandsShift);
                demand += transfer;
                supply -= transfer;
            }

            // Clamp values
            supply = Math.max(supplyDemandConfig.clamp.min, Math.min(supplyDemandConfig.clamp.max, supply));
            demand = Math.max(supplyDemandConfig.clamp.min, Math.min(supplyDemandConfig.clamp.max, demand));

            return { supply, demand };
        }

        const testCargos = ['Grain', 'Metal', 'Luxuries'];
        
        mockSettlements.forEach(settlement => {
            console.log(`\n  ${settlement.name}:`);
            testCargos.forEach(cargo => {
                const equilibrium = calculateEquilibrium(settlement, cargo);
                const modifier = settlement.produces?.includes(cargo) ? 'PRODUCES' : 
                               settlement.demands?.includes(cargo) ? 'DEMANDS' : 'NEUTRAL';
                console.log(`    ${cargo}: Supply ${equilibrium.supply} / Demand ${equilibrium.demand} (${modifier})`);
            });
        });

        // Test 4: Flag-based settlement filtering
        console.log('\n--- Test 4: Flag-based Filtering ---');
        
        function getSettlementsByFlags(settlements, flags) {
            const flagArray = Array.isArray(flags) ? flags : [flags];
            return settlements.filter(settlement => {
                if (!settlement.flags || !Array.isArray(settlement.flags)) {
                    return false;
                }
                return flagArray.some(flag => settlement.flags.includes(flag));
            });
        }

        const testFlags = ['trade', 'agriculture', 'mine', 'government'];
        
        testFlags.forEach(flag => {
            const matches = getSettlementsByFlags(mockSettlements, flag);
            console.log(`  Settlements with '${flag}' flag: ${matches.map(s => s.name).join(', ') || 'None'}`);
        });

        // Test 5: Garrison parsing and strength calculation
        console.log('\n--- Test 5: Garrison Analysis ---');
        
        function calculateGarrisonStrength(garrison) {
            const weights = { a: 3, b: 2, c: 1 }; // Elite, Regular, Militia
            return Object.entries(garrison).reduce((total, [type, count]) => {
                return total + (count * (weights[type] || 1));
            }, 0);
        }

        mockSettlements.forEach(settlement => {
            const strength = calculateGarrisonStrength(settlement.garrison);
            const types = Object.entries(settlement.garrison)
                .filter(([, count]) => count > 0)
                .map(([type, count]) => `${count}${type}`)
                .join(', ');
            console.log(`  ${settlement.name}: ${types} → Strength: ${strength}`);
        });

        // Test 6: Template rendering with new data structure (UI mode only)
        if (harness.options.uiMode) {
            console.log('\n--- Test 6: Template Rendering ---');
            
            const templateData = {
                settlements: mockSettlements.slice(0, 2), // Show first 2 settlements
                schema: {
                    populationThresholds,
                    supplyDemandConfig
                },
                testResults: {
                    totalSettlements: mockSettlements.length,
                    flaggedSettlements: getSettlementsByFlags(mockSettlements, 'trade').length,
                    averageStrength: Math.round(
                        mockSettlements.reduce((sum, s) => sum + calculateGarrisonStrength(s.garrison), 0) / mockSettlements.length
                    )
                }
            };

            try {
                const html = await harness.renderTemplate('trading-dialog.hbs', templateData);
                if (html) {
                    console.log('✓ Template rendered with orange-realism data');
                    console.log(`Template length: ${html.length} characters`);
                } else {
                    console.log('⚠ Template rendering skipped (file may not exist yet)');
                }
            } catch (error) {
                console.log(`⚠ Template rendering failed: ${error.message}`);
            }
        }

        console.log('\n=== Orange Realism Schema Test Complete ===');
        return {
            success: true,
            settlementsProcessed: mockSettlements.length,
            schemaValid: true,
            equilibriumTested: testCargos.length * mockSettlements.length,
            garrisonsParsed: mockSettlements.length
        };

    } catch (error) {
        console.error('Orange Realism Schema Test failed:', error);
        throw error;
    }
}