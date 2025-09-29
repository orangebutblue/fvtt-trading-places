/**
 * Phase 3 Merchant System Test Scenario
 * Tests the new population-based merchant generation, skill distribution, and equilibrium integration
 */

import { createTestActor } from '../stubs/actors.js';
import { getChatLog, clearChatLog } from '../stubs/chat.js';
import { randomInt, percentRoll } from '../stubs/seeded-random.js';

export default async function phase3MerchantSystemScenario(harness) {
    console.log('=== Phase 3 Merchant System Test Scenario ===');
    
    // Clear chat log
    clearChatLog();
    
    try {
        // Test settlements with different characteristics
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
            },
            {
                region: 'Wasteland',
                name: 'Marienburg',
                population: 135000,
                size: 5,
                ruler: 'Merchant Council',
                wealth: 4,
                flags: ['trade', 'smuggling'],
                produces: [],
                demands: ['Luxuries'],
                garrison: { a: 500, b: 2000, c: 5000 },
                notes: 'Major trading port'
            }
        ];

        const testCargoTypes = ['Grain', 'Metal', 'Luxuries', 'Timber'];

        // Test 1: Merchant Count Calculation
        console.log('\n--- Test 1: Population-Based Merchant Counts ---');
        
        testSettlements.forEach(settlement => {
            console.log(`\n  ${settlement.name} (Pop: ${settlement.population}, Size: ${settlement.size})`);
            console.log(`    Flags: [${settlement.flags.join(', ')}]`);
            
            // Calculate merchant slots using Phase 3 algorithm
            const merchantSlots = calculateMerchantSlots(settlement);
            console.log(`    Merchant Slots: ${merchantSlots.totalSlots}`);
            console.log(`      Base: ${merchantSlots.baseSlots}`);
            console.log(`      Population Bonus: ${merchantSlots.populationBonus}`);
            console.log(`      Size Bonus: ${merchantSlots.sizeBonus}`);
            console.log(`      Flag Multiplier: ${merchantSlots.flagMultiplier}x`);
            
            // Validate merchant counts are reasonable
            if (merchantSlots.totalSlots < 1) {
                throw new Error(`${settlement.name}: Merchant slots should be at least 1, got ${merchantSlots.totalSlots}`);
            }
            
            if (merchantSlots.totalSlots > 15) {
                throw new Error(`${settlement.name}: Merchant slots should not exceed 15, got ${merchantSlots.totalSlots}`);
            }
        });

        // Test 2: Skill Distribution System
        console.log('\n--- Test 2: Merchant Skill Distribution ---');
        
        const skillTests = [];
        testSettlements.forEach(settlement => {
            console.log(`\n  ${settlement.name} (Wealth: ${settlement.wealth})`);
            
            const skills = [];
            for (let i = 0; i < 10; i++) {
                const percentile = (i + 1) * 10; // 10%, 20%, etc.
                const skill = generateMerchantSkill(settlement, percentile);
                skills.push(skill);
            }
            
            const avgSkill = Math.round(skills.reduce((sum, s) => sum + s, 0) / skills.length);
            const minSkill = Math.min(...skills);
            const maxSkill = Math.max(...skills);
            
            console.log(`    Skills: [${skills.join(', ')}]`);
            console.log(`    Average: ${avgSkill}, Range: ${minSkill}-${maxSkill}`);
            
            skillTests.push({
                settlement: settlement.name,
                wealth: settlement.wealth,
                avgSkill,
                minSkill,
                maxSkill,
                skills
            });
            
            // Validate skill distribution
            if (minSkill < 5 || maxSkill > 95) {
                throw new Error(`${settlement.name}: Skills outside valid range (5-95), got ${minSkill}-${maxSkill}`);
            }
        });

        // Test 3: Supply/Demand Equilibrium Integration
        console.log('\n--- Test 3: Supply/Demand Equilibrium ---');
        
        testCargoTypes.forEach(cargoType => {
            console.log(`\n  Cargo Type: ${cargoType}`);
            
            testSettlements.forEach(settlement => {
                const equilibrium = calculateEquilibrium(settlement, cargoType);
                const state = getEquilibriumState(equilibrium);
                
                console.log(`    ${settlement.name}: Supply ${equilibrium.supply} / Demand ${equilibrium.demand} (${state})`);
                
                // Show key factors affecting equilibrium
                const factors = [];
                if (settlement.produces?.includes(cargoType)) factors.push('PRODUCES');
                if (settlement.demands?.includes(cargoType)) factors.push('DEMANDS');
                settlement.flags?.forEach(flag => {
                    if (['trade', 'agriculture', 'mine', 'smuggling'].includes(flag)) factors.push(flag.toUpperCase());
                });
                
                if (factors.length > 0) {
                    console.log(`      Factors: ${factors.join(', ')}`);
                }
                
                // Validate equilibrium calculations
                if (equilibrium.supply < 5 || equilibrium.demand < 5) {
                    console.log(`      ⚠ Extreme equilibrium may block trade`);
                }
                
                if (equilibrium.supply + equilibrium.demand !== 200) {
                    throw new Error(`Equilibrium should total 200 points, got ${equilibrium.supply + equilibrium.demand}`);
                }
            });
        });

        // Test 4: Merchant Generation Integration
        console.log('\n--- Test 4: Complete Merchant Generation ---');
        
        const generatedMerchants = [];
        
        testSettlements.slice(0, 2).forEach(settlement => { // Test first 2 settlements
            console.log(`\n  ${settlement.name}:`);
            
            testCargoTypes.slice(0, 2).forEach(cargoType => { // Test first 2 cargo types
                const equilibrium = calculateEquilibrium(settlement, cargoType);
                
                if (equilibrium.supply <= 10 || equilibrium.demand <= 10) {
                    console.log(`    ${cargoType}: Trade blocked (extreme equilibrium)`);
                    return;
                }
                
                // Generate producers
                const producerCount = Math.max(1, Math.floor(calculateMerchantSlots(settlement).totalSlots / 4));
                console.log(`    ${cargoType} Producers (${producerCount}):`);
                
                for (let i = 0; i < producerCount; i++) {
                    const merchant = generateMerchant(settlement, cargoType, 'producer', equilibrium);
                    generatedMerchants.push(merchant);
                    
                    console.log(`      - ${merchant.id.split('-')[0]} (Skill: ${merchant.skill}, Qty: ${merchant.quantity}, Price: ${merchant.finalPrice})`);
                    console.log(`        Personality: ${merchant.personality.name}`);
                    
                    if (merchant.specialBehaviors.length > 0) {
                        console.log(`        Special: ${merchant.specialBehaviors.join(', ')}`);
                    }
                }
                
                // Generate seekers  
                const seekerCount = Math.max(1, Math.floor(calculateMerchantSlots(settlement).totalSlots / 4));
                console.log(`    ${cargoType} Seekers (${seekerCount}):`);
                
                for (let i = 0; i < seekerCount; i++) {
                    const merchant = generateMerchant(settlement, cargoType, 'seeker', equilibrium);
                    generatedMerchants.push(merchant);
                    
                    console.log(`      - ${merchant.id.split('-')[0]} (Skill: ${merchant.skill}, Qty: ${merchant.quantity}, Price: ${merchant.finalPrice})`);
                }
            });
        });

        // Test 5: Desperation Mechanics
        console.log('\n--- Test 5: Desperation Reroll System ---');
        
        const desperationTest = generatedMerchants[0]; // Take first merchant
        console.log(`\n  Testing desperation on: ${desperationTest.id}`);
        console.log(`    Original: Skill ${desperationTest.skill}, Price ${desperationTest.finalPrice}, Qty ${desperationTest.quantity}`);
        
        // Apply desperation penalties
        const desperateMerchant = applyDesperationPenalties(JSON.parse(JSON.stringify(desperationTest)));
        
        console.log(`    Desperate: Skill ${desperateMerchant.skill}, Price ${desperateMerchant.finalPrice}, Qty ${desperateMerchant.quantity}`);
        console.log(`    Penalties Applied: ${desperateMerchant.availability.desperation.penaltiesApplied}`);
        
        // Validate desperation effects
        if (desperateMerchant.skill >= desperationTest.skill) {
            throw new Error('Desperation should reduce skill');
        }
        
        if (desperateMerchant.finalPrice <= desperationTest.finalPrice) {
            throw new Error('Desperation should increase price');
        }
        
        if (desperateMerchant.quantity >= desperationTest.quantity) {
            throw new Error('Desperation should reduce quantity');
        }

        // Test 6: Special Source Behaviors
        console.log('\n--- Test 6: Special Source Behaviors ---');
        
        const specialSettlement = testSettlements.find(s => s.flags.includes('smuggling'));
        if (specialSettlement) {
            console.log(`\n  ${specialSettlement.name} (Smuggling):`);
            
            const smugglingMerchant = generateMerchant(specialSettlement, 'Luxuries', 'producer', 
                calculateEquilibrium(specialSettlement, 'Luxuries'));
            
            console.log(`    Special Behaviors: ${smugglingMerchant.specialBehaviors.join(', ')}`);
            console.log(`    Price with smuggling discount: ${smugglingMerchant.finalPrice}`);
            
            if (!smugglingMerchant.specialBehaviors.includes('smuggling')) {
                throw new Error('Smuggling settlement should have smuggling behavior');
            }
        }

        console.log('\n=== Phase 3 Merchant System Test Complete ===');
        return {
            success: true,
            merchantsGenerated: generatedMerchants.length,
            settlementsProcessed: testSettlements.length,
            cargoTypesProcessed: testCargoTypes.length,
            skillTests: skillTests.length,
            desperationTested: true,
            specialBehaviorsTested: true
        };

    } catch (error) {
        console.error('Phase 3 Merchant System Test failed:', error);
        throw error;
    }
}

// Mock implementation functions for testing (would be replaced by real system)

function calculateMerchantSlots(settlement) {
    const config = {
        minSlotsPerSize: [1, 2, 3, 4, 6],
        populationMultiplier: 0.0001,
        sizeMultiplier: 1.5,
        hardCap: 15,
        flagMultipliers: {
            trade: 1.5,
            government: 1.2,
            subsistence: 0.5,
            smuggling: 1.3
        }
    };
    
    const sizeIndex = Math.max(0, Math.min(4, settlement.size - 1));
    const baseSlots = config.minSlotsPerSize[sizeIndex];
    const populationBonus = Math.floor(settlement.population * config.populationMultiplier);
    const sizeBonus = Math.floor(settlement.size * config.sizeMultiplier);
    
    let totalSlots = baseSlots + populationBonus + sizeBonus;
    
    let flagMultiplier = 1.0;
    settlement.flags?.forEach(flag => {
        if (config.flagMultipliers[flag]) {
            flagMultiplier *= config.flagMultipliers[flag];
        }
    });
    
    totalSlots = Math.floor(totalSlots * flagMultiplier);
    totalSlots = Math.min(totalSlots, config.hardCap);
    
    return {
        baseSlots,
        populationBonus,
        sizeBonus,
        flagMultiplier,
        totalSlots
    };
}

function generateMerchantSkill(settlement, percentile) {
    const config = {
        baseSkill: 25,
        wealthModifier: 8,
        variance: 20,
        percentileTable: {
            10: -15, 25: -8, 50: 0, 75: 8, 90: 15, 95: 25, 99: 35
        },
        minSkill: 5,
        maxSkill: 95
    };
    
    const wealthBonus = (settlement.wealth - 1) * config.wealthModifier;
    let skill = config.baseSkill + wealthBonus;
    
    // Apply percentile modifier
    let percentileModifier = 0;
    if (percentile >= 99) percentileModifier = config.percentileTable[99];
    else if (percentile >= 95) percentileModifier = config.percentileTable[95];
    else if (percentile >= 90) percentileModifier = config.percentileTable[90];
    else if (percentile >= 75) percentileModifier = config.percentileTable[75];
    else if (percentile >= 50) percentileModifier = config.percentileTable[50];
    else if (percentile >= 25) percentileModifier = config.percentileTable[25];
    else percentileModifier = config.percentileTable[10];
    
    skill += percentileModifier;
    
    // Add variance
    const variance = (Math.random() - 0.5) * config.variance;
    skill += variance;
    
    return Math.max(config.minSkill, Math.min(config.maxSkill, Math.round(skill)));
}

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
            trade: { supplyTransfer: 0.3 },
            agriculture: { supplyTransfer: 0.3 },
            mine: { supplyTransfer: 0.4 },
            smuggling: { supplyTransfer: 0.2 },
            government: { demandTransfer: 0.2 }
        };
        
        const effect = flagEffects[flag];
        if (effect?.supplyTransfer) {
            const transfer = Math.floor(demand * effect.supplyTransfer);
            supply += transfer;
            demand -= transfer;
        }
        
        if (effect?.demandTransfer) {
            const transfer = Math.floor(supply * effect.demandTransfer);
            demand += transfer;
            supply -= transfer;
        }
    });
    
    // Clamp values
    supply = Math.max(5, Math.min(195, supply));
    demand = Math.max(5, Math.min(195, demand));
    
    return { supply, demand };
}

function getEquilibriumState(equilibrium) {
    const ratio = equilibrium.supply / equilibrium.demand;
    
    if (equilibrium.supply <= 10 || equilibrium.demand <= 10) return 'BLOCKED';
    if (equilibrium.supply <= 20 || equilibrium.demand <= 20) return 'DESPERATE';
    if (ratio > 2.0) return 'OVERSUPPLIED';
    if (ratio < 0.5) return 'UNDERSUPPLIED';
    return 'BALANCED';
}

function generateMerchant(settlement, cargoType, merchantType, equilibrium) {
    const personalities = {
        profiles: ['Standard Merchant', 'Shrewd Dealer', 'Generous Trader', 'Suspicious Dealer'],
        weights: [70, 15, 10, 5]
    };
    
    const roll = randomInt(1, 100);
    let cumulative = 0;
    let personality = personalities.profiles[0];
    
    for (let i = 0; i < personalities.weights.length; i++) {
        cumulative += personalities.weights[i];
        if (roll <= cumulative) {
            personality = personalities.profiles[i];
            break;
        }
    }
    
    const skill = generateMerchantSkill(settlement);
    const quantity = Math.max(1, settlement.size + randomInt(0, settlement.size));
    const basePrice = getBasePrice(cargoType);
    
    // Apply equilibrium price modifiers
    const ratio = equilibrium.supply / equilibrium.demand;
    let price = basePrice;
    if (ratio > 1.5) price *= 0.8;
    else if (ratio < 0.67) price *= 1.2;
    
    // Apply special behavior discounts
    if (settlement.flags?.includes('smuggling')) {
        price *= 0.85; // 15% discount for smuggling
    }
    
    return {
        id: `${settlement.name.toLowerCase()}-${cargoType.toLowerCase()}-${merchantType}-${Date.now()}`,
        type: merchantType,
        settlement: { name: settlement.name, region: settlement.region },
        cargoType,
        skill,
        quantity,
        basePrice,
        finalPrice: Math.round(price * 100) / 100,
        personality: { name: personality },
        equilibrium: { supply: equilibrium.supply, demand: equilibrium.demand },
        availability: { isAvailable: false, rollRequired: true, desperation: { available: false, penaltiesApplied: false }},
        specialBehaviors: settlement.flags?.filter(f => ['smuggling', 'piracy', 'government'].includes(f)) || []
    };
}

function applyDesperationPenalties(merchant) {
    const config = {
        skillPenalty: 0.2,
        priceModifier: 1.15,
        quantityReduction: 0.25
    };
    
    merchant.skill = Math.floor(merchant.skill * (1 - config.skillPenalty));
    merchant.finalPrice = Math.round(merchant.finalPrice * config.priceModifier * 100) / 100;
    merchant.quantity = Math.max(1, Math.floor(merchant.quantity * (1 - config.quantityReduction)));
    merchant.availability.desperation.available = true;
    merchant.availability.desperation.penaltiesApplied = true;
    
    return merchant;
}

function getBasePrice(cargoType) {
    const prices = {
        'Grain': 1,
        'Metal': 8, 
        'Timber': 3,
        'Luxuries': 50,
        'Wool': 1,
        'Wine/Brandy': 3,
        'Armaments': 12
    };
    return prices[cargoType] || 5;
}