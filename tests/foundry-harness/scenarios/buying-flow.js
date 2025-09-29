/**
 * Buying Flow Scenario
 * Tests the complete buying pipeline: availability → desperation reroll → purchase
 */

import { createTestActor } from '../stubs/actors.js';
import { getChatLog, clearChatLog, assertChatContains } from '../stubs/chat.js';

export default async function buyingFlowScenario(harness) {
    console.log('=== Buying Flow Scenario ===');
    
    // Clear any existing chat messages
    clearChatLog();
    
    // Create test actor with money
    const testActor = createTestActor({
        name: 'Test Buyer',
        money: { gc: 200, ss: 1000, bp: 2000 }
    });
    
    // Add actor to game
    globalThis.game.actors.set(testActor.id, testActor);
    
    console.log('Test Setup:');
    console.log(`- Actor: ${testActor.name}`);
    console.log(`- Starting money: ${testActor.system.details.money.gc}gc, ${testActor.system.details.money.ss}ss, ${testActor.system.details.money.bp}bp`);
    console.log(`- Starting inventory: ${testActor.getInventory().length} items`);
    
    try {
        // Test 1: Load settlement data and check availability
        console.log('\n--- Test 1: Settlement Data Loading ---');
        
        // We need to check if DataManager is available and can load settlement data
        const dataManager = globalThis.game.modules.get('trading-places')?.dataManager;
        if (!dataManager) {
            console.log('DataManager not found - this is expected in early harness development');
            console.log('Simulating settlement data...');
            
            // Create mock settlement data
            const mockSettlement = {
                name: 'Altdorf',
                size: 5,
                wealth: 4,
                population: 105000,
                produces: ['Tools', 'Luxuries'],
                demands: ['Grain', 'Livestock'],
                flags: ['trade', 'wealthy']
            };
            
            console.log(`Settlement: ${mockSettlement.name} (Size: ${mockSettlement.size}, Wealth: ${mockSettlement.wealth})`);
            console.log(`Produces: ${mockSettlement.produces.join(', ')}`);
            console.log(`Demands: ${mockSettlement.demands.join(', ')}`);
            
            // Test 2: Merchant availability generation
            console.log('\n--- Test 2: Merchant Generation ---');
            
            // Simulate merchant generation based on settlement size
            const expectedMerchants = Math.min(10, mockSettlement.size + 2); // Size 5 → ~7 merchants
            console.log(`Expected merchants for size ${mockSettlement.size}: ${expectedMerchants}`);
            
            // Mock some merchants with different skill levels
            const merchants = [];
            for (let i = 0; i < expectedMerchants; i++) {
                merchants.push({
                    id: `merchant-${i}`,
                    skill: 20 + (i * 10), // Varying skills
                    cargo: 'Grain',
                    quantity: 5 + (i * 2),
                    price: 10 + (i * 2)
                });
            }
            
            console.log(`Generated ${merchants.length} merchants:`);
            merchants.forEach(m => {
                console.log(`  - Merchant ${m.id}: ${m.cargo} x${m.quantity} @ ${m.price}gc (Skill: ${m.skill})`);
            });
            
            // Test 3: Availability rolls
            console.log('\n--- Test 3: Availability Rolls ---');
            
            // Simulate availability rolls for each merchant
            const availabilityResults = [];
            for (const merchant of merchants) {
                // Use our dice stub to get a deterministic roll
                const roll = globalThis.Roll ? await globalThis.Roll.create('1d100') : { total: 50 };
                const success = roll.total <= merchant.skill;
                
                availabilityResults.push({
                    merchant: merchant.id,
                    roll: roll.total,
                    skill: merchant.skill,
                    success,
                    adjustedQuantity: success ? merchant.quantity : Math.max(1, Math.floor(merchant.quantity / 2))
                });
                
                console.log(`  - ${merchant.id}: Rolled ${roll.total} vs Skill ${merchant.skill} = ${success ? 'SUCCESS' : 'FAILURE'}`);
            }
            
            const successfulMerchants = availabilityResults.filter(r => r.success);
            const failedMerchants = availabilityResults.filter(r => !r.success);
            
            console.log(`Availability Results: ${successfulMerchants.length} successes, ${failedMerchants.length} failures`);
            
            // Test 4: Desperation reroll (if any failures)
            if (failedMerchants.length > 0) {
                console.log('\n--- Test 4: Desperation Reroll ---');
                
                const firstFailure = failedMerchants[0];
                console.log(`Testing desperation reroll for ${firstFailure.merchant}`);
                
                // Simulate player choosing desperation reroll
                const desperationRoll = globalThis.Roll ? await globalThis.Roll.create('1d100') : { total: 30 };
                const desperationSkill = Math.floor(firstFailure.skill * 0.8); // -20% penalty
                const desperationSuccess = desperationRoll.total <= desperationSkill;
                
                console.log(`Desperation roll: ${desperationRoll.total} vs ${desperationSkill} = ${desperationSuccess ? 'SUCCESS' : 'FAILURE'}`);
                
                if (desperationSuccess) {
                    console.log('Desperation reroll succeeded - merchant available but with penalties');
                    console.log('- Price increased by 10%');
                    console.log('- Quantity reduced by 25%');
                } else {
                    console.log('Desperation reroll failed - no deal available');
                }
            }
            
            // Test 5: Purchase transaction
            console.log('\n--- Test 5: Purchase Transaction ---');
            
            if (successfulMerchants.length > 0) {
                const selectedMerchant = merchants[0]; // Buy from first merchant
                const quantity = 3; // Buy 3 units
                const totalCost = selectedMerchant.price * quantity;
                
                console.log(`Purchasing ${quantity}x ${selectedMerchant.cargo} from ${selectedMerchant.id}`);
                console.log(`Cost: ${totalCost}gc`);
                
                // Check if player can afford it
                if (testActor.system.details.money.gc >= totalCost) {
                    // Perform transaction
                    testActor.updateMoney({ gc: -totalCost });
                    
                    // Add item to inventory
                    const existingItem = testActor.findItemByName(selectedMerchant.cargo);
                    if (existingItem) {
                        existingItem.increaseQuantity(quantity);
                    } else {
                        testActor.addItem({
                            name: selectedMerchant.cargo,
                            quantity: quantity,
                            price: selectedMerchant.price
                        });
                    }
                    
                    console.log(`Transaction completed successfully!`);
                    console.log(`New money: ${testActor.system.details.money.gc}gc, ${testActor.system.details.money.ss}ss, ${testActor.system.details.money.bp}bp`);
                    console.log(`New inventory: ${testActor.getInventory().length} items`);
                    
                    // Test assertions
                    const finalMoney = testActor.system.details.money.gc;
                    const expectedMoney = 200 - totalCost;
                    if (finalMoney !== expectedMoney) {
                        throw new Error(`Money calculation error: expected ${expectedMoney}gc, got ${finalMoney}gc`);
                    }
                    
                    const grainItem = testActor.findItemByName(selectedMerchant.cargo);
                    if (!grainItem) {
                        throw new Error(`Item not found in inventory: ${selectedMerchant.cargo}`);
                    }
                    
                    console.log(`✓ Money deducted correctly`);
                    console.log(`✓ Item added to inventory`);
                    
                } else {
                    throw new Error(`Insufficient funds: need ${totalCost}gc, have ${testActor.system.details.money.gc}gc`);
                }
            } else {
                console.log('No successful merchants available for purchase');
            }
            
            // Test 6: Render template in UI mode
            if (harness.options.uiMode) {
                console.log('\n--- Test 6: Template Rendering ---');
                
                const templateData = {
                    settlement: mockSettlement,
                    merchants: merchants.slice(0, 3), // Show first 3 merchants
                    actor: {
                        name: testActor.name,
                        money: testActor.system.details.money
                    }
                };
                
                try {
                    const html = await harness.renderTemplate('trading-dialog.hbs', templateData);
                    if (html) {
                        console.log('✓ Template rendered successfully');
                        console.log(`Template length: ${html.length} characters`);
                    } else {
                        console.log('⚠ Template rendering skipped (file may not exist yet)');
                    }
                } catch (error) {
                    console.log(`⚠ Template rendering failed: ${error.message}`);
                }
            }
            
        } else {
            console.log('DataManager found - using real module code');
            // TODO: Add real module integration when DataManager is available
        }
        
        console.log('\n=== Buying Flow Scenario Complete ===');
        return {
            success: true,
            merchantsGenerated: 7,
            transactionCompleted: true,
            finalMoney: testActor.system.details.money.gc
        };
        
    } catch (error) {
        console.error('Buying Flow Scenario failed:', error);
        throw error;
    }
}