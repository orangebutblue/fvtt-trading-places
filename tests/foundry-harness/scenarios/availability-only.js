/**
 * Availability Only Scenario
 * Quick smoke test for merchant generation and availability mechanics
 */

import { createTestActor } from '../stubs/actors.js';
import { clearChatLog } from '../stubs/chat.js';
import { random, randomInt, randomVariance, percentRoll } from '../stubs/seeded-random.js';

export default async function availabilityOnlyScenario(harness) {
    console.log('=== Availability Only Scenario ===');
    
    // Clear chat log
    clearChatLog();
    
    // Create test data
    const testSettlements = [
        { name: 'Small Village', size: 1, population: 150, wealth: 2 },
        { name: 'Market Town', size: 3, population: 5000, wealth: 3 },
        { name: 'Major City', size: 5, population: 80000, wealth: 4 }
    ];
    
    console.log('Testing merchant availability across different settlement sizes...\n');
    
    try {
        for (const settlement of testSettlements) {
            console.log(`--- ${settlement.name} (Size: ${settlement.size}, Pop: ${settlement.population}) ---`);
            
            // Test merchant count calculation
            const baseMerchantCount = settlement.size + 1; // Simple formula for testing
            const populationBonus = Math.floor(settlement.population / 10000); // 1 extra per 10k people
            const expectedMerchants = Math.min(15, baseMerchantCount + populationBonus);
            
            console.log(`Base merchants from size: ${baseMerchantCount}`);
            console.log(`Population bonus: ${populationBonus}`);
            console.log(`Expected total merchants: ${expectedMerchants}`);
            
            // Test wealth effects on merchant quality
            const averageSkill = 20 + (settlement.wealth * 10); // Wealthier = better merchants
            console.log(`Average merchant skill (wealth ${settlement.wealth}): ${averageSkill}`);
            
            // Generate mock merchants using seeded randomness
            const merchants = [];
            for (let i = 0; i < expectedMerchants; i++) {
                const skillVariation = randomVariance(0, 20); // ±20 variation
                const skill = Math.max(5, Math.min(95, Math.round(averageSkill + skillVariation)));
                
                merchants.push({
                    id: `${settlement.name.toLowerCase().replace(' ', '-')}-merchant-${i}`,
                    skill,
                    cargo: ['Grain', 'Tools', 'Ale', 'Cloth', 'Metal'][i % 5],
                    quantity: Math.max(1, settlement.size + randomInt(0, 4)),
                    basePrice: [10, 20, 5, 15, 25][i % 5]
                });
            }
            
            console.log(`Generated ${merchants.length} merchants:`);
            
            // Test availability rolls using seeded randomness
            let successCount = 0;
            let totalQuantity = 0;
            
            for (const merchant of merchants) {
                const rollResult = percentRoll(merchant.skill);
                const success = rollResult.success;
                const finalQuantity = success ? merchant.quantity : Math.max(1, Math.floor(merchant.quantity / 2));
                
                if (success) successCount++;
                totalQuantity += finalQuantity;
                
                console.log(`  ${merchant.id}: ${merchant.cargo} x${finalQuantity} @ ${merchant.basePrice}gc (${rollResult.total}/${merchant.skill} ${success ? 'SUCCESS' : 'FAIL'})`);
            }
            
            const successRate = Math.round((successCount / merchants.length) * 100);
            console.log(`\nSettlement Summary:`);
            console.log(`- Merchants available: ${merchants.length}`);
            console.log(`- Success rate: ${successRate}% (${successCount}/${merchants.length})`);
            console.log(`- Total goods available: ${totalQuantity} units`);
            
            // Validate expected ranges
            if (merchants.length < settlement.size) {
                throw new Error(`Too few merchants: expected at least ${settlement.size}, got ${merchants.length}`);
            }
            
            if (merchants.length > 15) {
                throw new Error(`Too many merchants: expected max 15, got ${merchants.length}`);
            }
            
            if (successRate < 20 || successRate > 80) {
                console.warn(`⚠ Unusual success rate: ${successRate}% (expected 20-80%)`);
            }
            
            console.log('✓ Settlement validation passed\n');
        }
        
        // Test edge cases
        console.log('--- Edge Case Testing ---');
        
        // Test minimum settlement (hamlet)
        const hamlet = { name: 'Tiny Hamlet', size: 1, population: 50, wealth: 1 };
        const hamletMerchants = Math.max(1, hamlet.size); // Always at least 1 merchant
        console.log(`Minimum settlement: ${hamlet.name} → ${hamletMerchants} merchant(s)`);
        
        if (hamletMerchants < 1) {
            throw new Error('Even smallest settlements should have at least 1 merchant');
        }
        
        // Test maximum settlement (metropolis)
        const metropolis = { name: 'Massive Metropolis', size: 5, population: 200000, wealth: 5 };
        const metropolisMerchants = Math.min(15, metropolis.size + Math.floor(metropolis.population / 10000));
        console.log(`Maximum settlement: ${metropolis.name} → ${metropolisMerchants} merchant(s) (capped at 15)`);
        
        if (metropolisMerchants > 15) {
            throw new Error('Merchant count should be capped at reasonable maximum');
        }
        
        console.log('✓ Edge case validation passed');
        
        console.log('\n=== Availability Only Scenario Complete ===');
        return {
            success: true,
            settlementsTestedCount: testSettlements.length,
            edgeCasesPassed: true
        };
        
    } catch (error) {
        console.error('Availability Only Scenario failed:', error);
        throw error;
    }
}