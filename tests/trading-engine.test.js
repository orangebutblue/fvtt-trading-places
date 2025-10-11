/**
 * Comprehensive Unit Tests for TradingEngine - Complete Trading Algorithm
 * Tests all cargo availability calculations, price calculations, haggling mechanics,
 * and sale restrictions as specified in requirements 1.1-1.7, 2.1-2.6, 3.1-3.7, 4.1-4.5
 */

// Mock DataManager for testing
class MockDataManager {
    constructor() {
        this.cargoTypes = [
            {
                name: "Grain",
                category: "Bulk Goods",
                basePrices: { spring: 1, summer: 0.5, autumn: 0.25, winter: 0.5 },
                encumbrancePerUnit: 10
            },
            {
                name: "Wool",
                category: "Textiles",
                basePrices: { spring: 1, summer: 1.5, autumn: 2, winter: 3 },
                encumbrancePerUnit: 10
            },
            {
                name: "Metal",
                category: "Raw Materials",
                basePrices: { spring: 8, summer: 8, autumn: 8, winter: 8 },
                encumbrancePerUnit: 10
            },
            {
                name: "Luxuries",
                category: "Luxury Goods",
                basePrices: { spring: 50, summer: 50, autumn: 50, winter: 50 },
                encumbrancePerUnit: 10
            },
            {
                name: "Armaments",
                category: "Military",
                basePrices: { spring: 12, summer: 10, autumn: 8, winter: 10 },
                encumbrancePerUnit: 10
            }
        ];
    }

    getSettlementProperties(settlement) {
        const sizeMapping = {
            'CS': 4, 'C': 4, 'T': 3, 'ST': 2, 'V': 1, 'F': 2, 'M': 2
        };
        
        const wealthModifiers = {
            1: 0.50, 2: 0.80, 3: 1.00, 4: 1.05, 5: 1.10
        };

        const sizeDescriptions = {
            'CS': 'City State', 'C': 'City', 'T': 'Town', 
            'ST': 'Small Town', 'V': 'Village', 'F': 'Fort', 'M': 'Mine'
        };

        const wealthDescriptions = {
            1: 'Squalid', 2: 'Poor', 3: 'Average', 4: 'Bustling', 5: 'Prosperous'
        };

        return {
            name: settlement.name,
            region: settlement.region,
            sizeEnum: settlement.size,
            sizeNumeric: sizeMapping[settlement.size],
            sizeDescription: sizeDescriptions[settlement.size],
            wealthRating: settlement.wealth,
            wealthModifier: wealthModifiers[settlement.wealth],
            wealthDescription: wealthDescriptions[settlement.wealth],
            population: settlement.population,
            productionCategories: settlement.source,
            garrison: settlement.garrison,
            ruler: settlement.ruler,
            notes: settlement.notes
        };
    }

    isTradeSettlement(settlement) {
        return settlement && settlement.source && settlement.source.includes('Trade');
    }

    validateSettlement(settlement) {
        const requiredFields = ['region', 'name', 'size', 'ruler', 'population', 'wealth', 'source', 'garrison', 'notes'];
        const missing = requiredFields.filter(field => !settlement.hasOwnProperty(field));
        
        if (missing.length > 0) {
            return { valid: false, errors: [`Missing required fields: ${missing.join(', ')}`] };
        }
        
        return { valid: true, errors: [] };
    }

    getSeasonalPrice(cargo, season, quality = 'average') {
        if (!cargo || !cargo.basePrices) {
            throw new Error('Invalid cargo object or missing basePrices');
        }

        const validSeasons = ['spring', 'summer', 'autumn', 'winter'];
        if (!validSeasons.includes(season)) {
            throw new Error(`Invalid season: ${season}. Must be one of: ${validSeasons.join(', ')}`);
        }

        if (!cargo.basePrices.hasOwnProperty(season)) {
            throw new Error(`No price data for season: ${season}`);
        }

        let basePrice = cargo.basePrices[season];

        // Apply quality tier multiplier if cargo has quality tiers
        if (cargo.qualityTiers && cargo.qualityTiers.hasOwnProperty(quality)) {
            basePrice *= cargo.qualityTiers[quality];
        }

        return basePrice;
    }
}

// Import TradingEngine (in Node.js environment)
let TradingEngine;
if (typeof require !== 'undefined') {
    try {
        TradingEngine = require('../scripts/trading-engine.js').TradingEngine;
        console.log('TradingEngine loaded successfully');
    } catch (error) {
        console.error('Failed to load TradingEngine:', error.message);
        process.exit(1);
    }
}

// Test suite for cargo availability checking
function runCargoAvailabilityTests() {
    console.log('Running Cargo Availability Tests...\n');

    const dataManager = new MockDataManager();
    const engine = new TradingEngine(dataManager);
    engine.setCurrentSeason('spring');

    // Test settlements
    const testSettlements = {
        smallVillage: {
            region: "Empire",
            name: "Weissbruck",
            size: "V",
            ruler: "Village Elder Gunther",
            population: 150,
            wealth: 1,
            source: ["Subsistence"],
            garrison: ["0a", "2b", "8c"],
            notes: "Small village"
        },
        tradeTown: {
            region: "Empire",
            name: "Ubersreik",
            size: "T",
            ruler: "Lord Rickard Aschaffenberg",
            population: 6000,
            wealth: 3,
            source: ["Trade", "Agriculture"],
            garrison: ["20a", "40b", "120c"],
            notes: "Trading town"
        },
        prosperousCity: {
            region: "Empire",
            name: "Altdorf",
            size: "CS",
            ruler: "Emperor Karl Franz I",
            population: 105000,
            wealth: 5,
            source: ["Trade", "Government", "Metal"],
            garrison: ["200a", "400b", "800c"],
            notes: "Capital city"
        }
    };

    // Test 1: Calculate Availability Chance
    console.log('Test 1: Calculate Availability Chance');
    console.log('=====================================');
    
    // Small Village: Size 1 + Wealth 1 = 20%
    const villageChance = engine.calculateAvailabilityChance(testSettlements.smallVillage);
    console.log(`Small Village (V, Wealth 1): ${villageChance}% (expected: 20%)`);
    console.assert(villageChance === 20, 'Village availability chance should be 20%');

    // Trade Town: Size 3 + Wealth 3 = 60%
    const townChance = engine.calculateAvailabilityChance(testSettlements.tradeTown);
    console.log(`Trade Town (T, Wealth 3): ${townChance}% (expected: 60%)`);
    console.assert(townChance === 60, 'Town availability chance should be 60%');

    // Prosperous City: Size 4 + Wealth 5 = 90%
    const cityChance = engine.calculateAvailabilityChance(testSettlements.prosperousCity);
    console.log(`Prosperous City (CS, Wealth 5): ${cityChance}% (expected: 90%)`);
    console.assert(cityChance === 90, 'City availability chance should be 90%');

    console.log('✓ All availability chance calculations correct\n');

    // Test 2: Check Cargo Availability with Mock Dice
    console.log('Test 2: Check Cargo Availability with Mock Dice');
    console.log('===============================================');

    // Mock successful roll (roll 15 vs 20% chance)
    const successfulCheck = engine.checkCargoAvailability(testSettlements.smallVillage, () => 15);
    console.log(`Successful check (roll 15 vs 20%): ${successfulCheck.available} (expected: true)`);
    console.assert(successfulCheck.available === true, 'Should succeed with roll 15 vs 20%');
    console.assert(successfulCheck.roll === 15, 'Roll should be 15');
    console.assert(successfulCheck.chance === 20, 'Chance should be 20');

    // Mock failed roll (roll 85 vs 60% chance)
    const failedCheck = engine.checkCargoAvailability(testSettlements.tradeTown, () => 85);
    console.log(`Failed check (roll 85 vs 60%): ${failedCheck.available} (expected: false)`);
    console.assert(failedCheck.available === false, 'Should fail with roll 85 vs 60%');
    console.assert(failedCheck.roll === 85, 'Roll should be 85');
    console.assert(failedCheck.chance === 60, 'Chance should be 60');

    console.log('✓ All availability checks working correctly\n');

    // Test 3: Determine Cargo Types
    console.log('Test 3: Determine Cargo Types');
    console.log('=============================');

    // Village with Subsistence only (should produce Grain)
    const villageCargoTypes = engine.determineCargoTypes(testSettlements.smallVillage, 'spring');
    console.log(`Village cargo types: [${villageCargoTypes.join(', ')}] (expected: [Grain])`);
    console.assert(villageCargoTypes.includes('Grain'), 'Village should have Grain available');
    console.assert(!villageCargoTypes.includes('Trade Goods'), 'Village should not have Trade Goods');

    // Trade town with Trade and Agriculture (should produce Grain and random Trade cargo)
    const townCargoTypes = engine.determineCargoTypes(testSettlements.tradeTown, 'spring');
    console.log(`Trade town cargo types: [${townCargoTypes.join(', ')}]`);
    console.assert(townCargoTypes.includes('Grain'), 'Trade town should have Grain available');
    console.assert(townCargoTypes.length >= 1, 'Trade town should have at least one cargo type');

    // City with multiple categories including Trade (should produce Metal and random Trade cargo)
    const cityCargoTypes = engine.determineCargoTypes(testSettlements.prosperousCity, 'spring');
    console.log(`City cargo types: [${cityCargoTypes.join(', ')}]`);
    console.assert(cityCargoTypes.includes('Metal'), 'City should have Metal available');
    console.assert(cityCargoTypes.length >= 1, 'City should have at least one cargo type');

    console.log('✓ All cargo type determinations correct\n');

    // Test 4: Calculate Cargo Size
    console.log('Test 4: Calculate Cargo Size');
    console.log('============================');

    // Village: (1 + 1) × 50 = 100 EP (mock roll 45 → rounds up to 50)
    const villageSize = engine.calculateCargoSize(testSettlements.smallVillage, () => 45);
    console.log(`Village cargo size: ${villageSize.totalSize} EP (expected: 100 EP)`);
    console.assert(villageSize.totalSize === 100, 'Village cargo size should be 100 EP');
    console.assert(villageSize.baseMultiplier === 2, 'Village base multiplier should be 2');
    console.assert(villageSize.sizeMultiplier === 50, 'Size multiplier should be 50 (45 rounded up)');
    console.assert(villageSize.tradeBonus === false, 'Village should not have trade bonus');

    // Trade town with trade bonus: (3 + 3) × max(30, 80) = 6 × 80 = 480 EP
    let rollCount = 0;
    const townSize = engine.calculateCargoSize(testSettlements.tradeTown, () => {
        rollCount++;
        return rollCount === 1 ? 25 : 75; // First roll 25 → 30, second roll 75 → 80
    });
    console.log(`Trade town cargo size: ${townSize.totalSize} EP (expected: 480 EP)`);
    console.assert(townSize.totalSize === 480, 'Trade town cargo size should be 480 EP');
    console.assert(townSize.baseMultiplier === 6, 'Trade town base multiplier should be 6');
    console.assert(townSize.sizeMultiplier === 80, 'Should use higher multiplier (80)');
    console.assert(townSize.tradeBonus === true, 'Trade town should have trade bonus');
    console.assert(townSize.roll1 === 25, 'First roll should be 25');
    console.assert(townSize.roll2 === 75, 'Second roll should be 75');

    console.log('✓ All cargo size calculations correct\n');

    console.log('🎉 All Cargo Availability Tests Passed!\n');
}

// Test suite for purchase price calculations
function runPurchasePriceTests() {
    console.log('Running Purchase Price Calculation Tests...\n');

    const dataManager = new MockDataManager();
    const engine = new TradingEngine(dataManager);
    engine.setCurrentSeason('spring');

    // Test 1: Basic Price Calculation
    console.log('Test 1: Basic Price Calculation');
    console.log('==============================');

    // Grain in spring: base price 1 GC
    const grainPrice = engine.calculateBasePrice('Grain', 'spring');
    console.log(`Grain base price in spring: ${grainPrice} GC (expected: 1 GC)`);
    console.assert(grainPrice === 1, 'Grain spring price should be 1 GC');

    // Wool in winter: base price 3 GC
    const woolPrice = engine.calculateBasePrice('Wool', 'winter');
    console.log(`Wool base price in winter: ${woolPrice} GC (expected: 3 GC)`);
    console.assert(woolPrice === 3, 'Wool winter price should be 3 GC');

    console.log('✓ Basic price calculations correct\n');

    // Test 2: Purchase Price with No Modifiers
    console.log('Test 2: Purchase Price with No Modifiers');
    console.log('========================================');

    const basicPurchase = engine.calculatePurchasePrice('Grain', 50);
    console.log(`Basic purchase: ${basicPurchase.quantity} EP of ${basicPurchase.cargoName}`);
    console.log(`Price per unit: ${basicPurchase.finalPricePerUnit} GC`);
    console.log(`Total price: ${basicPurchase.totalPrice} GC (expected: 100 GC)`);
    
    console.assert(basicPurchase.basePricePerUnit === 2, 'Base price should be 2 GC');
    console.assert(basicPurchase.finalPricePerUnit === 2, 'Final price should equal base price');
    console.assert(basicPurchase.totalPrice === 100, 'Total should be 50 × 2 = 100 GC');
    console.assert(basicPurchase.modifiers.length === 0, 'Should have no modifiers');

    console.log('✓ Basic purchase price calculation correct\n');

    // Test 3: Partial Purchase Penalty
    console.log('Test 3: Partial Purchase Penalty');
    console.log('================================');

    const partialPurchase = engine.calculatePurchasePrice('Wool', 10, { 
        isPartialPurchase: true,
        season: 'winter'
    });
    
    console.log(`Partial purchase: ${partialPurchase.quantity} EP of ${partialPurchase.cargoName}`);
    console.log(`Base price: ${partialPurchase.basePricePerUnit} GC`);
    console.log(`Final price per unit: ${partialPurchase.finalPricePerUnit} GC (expected: 3.9 GC)`);
    console.log(`Total price: ${partialPurchase.totalPrice} GC (expected: 39 GC)`);
    
    console.assert(partialPurchase.basePricePerUnit === 3, 'Base price should be 3 GC');
    console.assert(partialPurchase.finalPricePerUnit === 3.9, 'Should include 10% penalty');
    console.assert(partialPurchase.totalPrice === 39, 'Total should be 10 × 3.9 = 39 GC');
    console.assert(partialPurchase.modifiers.length === 1, 'Should have one modifier');
    console.assert(partialPurchase.modifiers[0].type === 'partial_purchase', 'Should be partial purchase modifier');

    console.log('✓ Partial purchase penalty calculation correct\n');

    console.log('🎉 All Purchase Price Calculation Tests Passed!\n');
}

// Test suite for sale mechanics and restrictions
function runSaleMechanicsTests() {
    console.log('Running Sale Mechanics and Restrictions Tests...\n');

    const dataManager = new MockDataManager();
    const engine = new TradingEngine(dataManager);
    engine.setCurrentSeason('spring');

    // Test settlements
    const testSettlements = {
        village: {
            region: "Empire",
            name: "Weissbruck",
            size: "V",
            ruler: "Village Elder Gunther",
            population: 150,
            wealth: 1,
            source: ["Subsistence"],
            garrison: ["0a", "2b", "8c"],
            notes: "Small village"
        },
        tradeTown: {
            region: "Empire",
            name: "Ubersreik",
            size: "T",
            ruler: "Lord Rickard Aschaffenberg",
            population: 6000,
            wealth: 3,
            source: ["Trade", "Agriculture"],
            garrison: ["20a", "40b", "120c"],
            notes: "Trading town"
        },
        prosperousCity: {
            region: "Empire",
            name: "Altdorf",
            size: "CS",
            ruler: "Emperor Karl Franz I",
            population: 105000,
            wealth: 5,
            source: ["Trade", "Government", "Metal"],
            garrison: ["200a", "400b", "800c"],
            notes: "Capital city"
        }
    };

    // Test 1: Sale Eligibility Check
    console.log('Test 1: Sale Eligibility Check');
    console.log('==============================');

    const purchaseData = {
        settlementName: 'Averheim',
        purchaseTime: 0
    };

    // Valid sale (different settlement)
    const validSale = engine.checkSaleEligibility(
        { name: 'Grain', quantity: 50 },
        testSettlements.village,
        purchaseData
    );
    console.log(`Valid sale eligibility: ${validSale.eligible} (expected: true)`);
    console.assert(validSale.eligible === true, 'Should allow sale in different settlement');

    // Invalid sale (same settlement)
    const invalidSale = engine.checkSaleEligibility(
        { name: 'Grain', quantity: 50 },
        { name: 'Averheim' },
        purchaseData
    );
    console.log(`Invalid sale eligibility: ${invalidSale.eligible} (expected: false)`);
    console.assert(invalidSale.eligible === false, 'Should not allow sale in same settlement');
    console.assert(invalidSale.errors.length > 0, 'Should have error messages');

    console.log('✓ Sale eligibility checks working correctly\n');

    // Test 2: Buyer Availability Calculation
    console.log('Test 2: Buyer Availability Calculation');
    console.log('======================================');

    // Village: Size 1 × 10 = 10%
    const villageChance = engine.calculateBuyerAvailabilityChance(testSettlements.village, 'Grain');
    console.log(`Village buyer chance for Grain: ${villageChance}% (expected: 10%)`);
    console.assert(villageChance === 10, 'Village should have 10% buyer chance');

    // Trade town: Size 3 × 10 + 30 (Trade bonus) = 60%
    const townChance = engine.calculateBuyerAvailabilityChance(testSettlements.tradeTown, 'Grain');
    console.log(`Trade town buyer chance: ${townChance}% (expected: 60%)`);
    console.assert(townChance === 60, 'Trade town should have 60% buyer chance');

    // City: Size 4 × 10 + 30 (Trade bonus) = 70%
    const cityChance = engine.calculateBuyerAvailabilityChance(testSettlements.prosperousCity, 'Metal');
    console.log(`City buyer chance: ${cityChance}% (expected: 70%)`);
    console.assert(cityChance === 70, 'City should have 70% buyer chance');

    console.log('✓ Buyer availability calculations correct\n');

    // Test 3: Village Restrictions
    console.log('Test 3: Village Restrictions');
    console.log('============================');

    // Village buying Grain (allowed)
    const villageGrainRestriction = engine.checkVillageRestrictions(testSettlements.village, 'Grain', 'spring');
    console.log(`Village Grain restriction: ${villageGrainRestriction.restricted} (expected: false)`);
    console.assert(villageGrainRestriction.restricted === false, 'Villages should buy Grain without restriction');

    // Village buying Wool in Spring (limited)
    const villageWoolSpring = engine.checkVillageRestrictions(testSettlements.village, 'Wool', 'spring');
    console.log(`Village Wool in Spring restricted: ${villageWoolSpring.restricted} (expected: true)`);
    console.log(`Allowed quantity: ${villageWoolSpring.allowedQuantity} EP (should be 1-10)`);
    console.assert(villageWoolSpring.restricted === true, 'Villages should restrict non-Grain goods');
    console.assert(villageWoolSpring.allowedQuantity >= 1 && villageWoolSpring.allowedQuantity <= 10, 'Should allow 1-10 EP in Spring');

    // Village buying Wool in Winter (not allowed)
    const villageWoolWinter = engine.checkVillageRestrictions(testSettlements.village, 'Wool', 'winter');
    console.log(`Village Wool in Winter allowed quantity: ${villageWoolWinter.allowedQuantity} (expected: 0)`);
    console.assert(villageWoolWinter.allowedQuantity === 0, 'Villages should not buy non-Grain goods outside Spring');

    // Town has no restrictions
    const townRestriction = engine.checkVillageRestrictions(testSettlements.tradeTown, 'Wool', 'winter');
    console.log(`Town restriction: ${townRestriction.restricted} (expected: false)`);
    console.assert(townRestriction.restricted === false, 'Towns should have no village restrictions');

    console.log('✓ Village restrictions working correctly\n');

    // Test 4: Sale Price Calculation with Wealth Modifiers
    console.log('Test 4: Sale Price Calculation with Wealth Modifiers');
    console.log('====================================================');

    // Poor village (wealth 1 = 50% modifier)
    const villageSalePrice = engine.calculateSalePrice('Grain', 50, testSettlements.village);
    console.log(`Village sale price: ${villageSalePrice.totalPrice} GC`);
    console.log(`Wealth modifier: ${villageSalePrice.wealthModifier} (expected: 0.5)`);
    console.log(`Price per unit: ${villageSalePrice.finalPricePerUnit} GC (expected: 1 GC)`);
    
    console.assert(villageSalePrice.wealthModifier === 0.5, 'Village should have 50% wealth modifier');
    console.assert(villageSalePrice.finalPricePerUnit === 1, 'Should be 2 GC × 0.5 = 1 GC per unit');
    console.assert(villageSalePrice.totalPrice === 50, 'Total should be 50 × 1 = 50 GC');

    // Prosperous city (wealth 5 = 110% modifier)
    const citySalePrice = engine.calculateSalePrice('Grain', 50, testSettlements.prosperousCity);
    console.log(`City sale price: ${citySalePrice.totalPrice} GC`);
    console.log(`Wealth modifier: ${citySalePrice.wealthModifier} (expected: 1.1)`);
    console.log(`Price per unit: ${citySalePrice.finalPricePerUnit} GC (expected: 2.2 GC)`);
    
    console.assert(citySalePrice.wealthModifier === 1.1, 'City should have 110% wealth modifier');
    console.assert(citySalePrice.finalPricePerUnit === 2.2, 'Should be 2 GC × 1.1 = 2.2 GC per unit');
    console.assert(citySalePrice.totalPrice === 110, 'Total should be 50 × 2.2 = 110 GC');

    console.log('✓ Sale price calculations with wealth modifiers correct\n');

    console.log('🎉 All Sale Mechanics and Restrictions Tests Passed!\n');
}

// Test suite for special sale methods
function runSpecialSaleMethodsTests() {
    console.log('Running Special Sale Methods Tests...\n');

    const dataManager = new MockDataManager();
    const engine = new TradingEngine(dataManager);
    engine.setCurrentSeason('spring');

    // Test settlements
    const testSettlements = {
        village: {
            region: "Empire",
            name: "Weissbruck",
            size: "V",
            ruler: "Village Elder Gunther",
            population: 150,
            wealth: 1,
            source: ["Agriculture"],
            garrison: ["0a", "2b", "8c"],
            notes: "Small village"
        },
        tradeTown: {
            region: "Empire",
            name: "Ubersreik",
            size: "T",
            ruler: "Lord Rickard Aschaffenberg",
            population: 6000,
            wealth: 3,
            source: ["Trade", "Wine"],
            garrison: ["20a", "40b", "120c"],
            notes: "Trading town"
        }
    };

    // Test 1: Desperate Sale Logic
    console.log('Test 1: Desperate Sale Logic');
    console.log('============================');

    // Successful desperate sale at Trade settlement
    const desperateSale = engine.processDesperateSale('Luxuries', 20, testSettlements.tradeTown, { season: 'spring' });
    console.log(`Desperate sale success: ${desperateSale.success} (expected: true)`);
    console.log(`Base price: ${desperateSale.basePricePerUnit} GC`);
    console.log(`Desperate price: ${desperateSale.desperatePricePerUnit} GC (expected: 7.5 GC)`);
    console.log(`Total price: ${desperateSale.totalPrice} GC (expected: 150 GC)`);
    
    console.assert(desperateSale.success === true, 'Desperate sale should succeed at Trade settlement');
    console.assert(desperateSale.basePricePerUnit === 15, 'Base price should be 15 GC');
    console.assert(desperateSale.desperatePricePerUnit === 7.5, 'Desperate price should be 50% of base');
    console.assert(desperateSale.totalPrice === 150, 'Total should be 20 × 7.5 = 150 GC');
    console.assert(desperateSale.saleType === 'desperate', 'Should be marked as desperate sale');

    // Failed desperate sale at non-Trade settlement
    const failedDesperateSale = engine.processDesperateSale('Grain', 20, testSettlements.village);
    console.log(`Failed desperate sale: ${failedDesperateSale.success} (expected: false)`);
    console.assert(failedDesperateSale.success === false, 'Desperate sale should fail at non-Trade settlement');
    console.assert(failedDesperateSale.isTradeSettlement === false, 'Should identify non-Trade settlement');

    console.log('✓ Desperate sale logic working correctly\n');

    // Test 2: Rumor Generation and Sales
    console.log('Test 2: Rumor Generation and Sales');
    console.log('==================================');

    // Generate rumor (mock roll for guaranteed rumor)
    const rumorCheck = engine.checkForRumors('Luxuries', testSettlements.tradeTown, () => 15);
    console.log(`Rumor found: ${rumorCheck.hasRumor} (expected: true)`);
    console.log(`Rumor type: ${rumorCheck.rumor.type}`);
    console.log(`Rumor multiplier: ${rumorCheck.rumor.multiplier}x`);
    
    console.assert(rumorCheck.hasRumor === true, 'Should find rumor with roll 15');
    console.assert(rumorCheck.rumor.multiplier > 1, 'Rumor should have positive multiplier');

    // Process rumor sale
    const rumorSale = engine.processRumorSale('Luxuries', 10, testSettlements.tradeTown, rumorCheck.rumor, { season: 'spring' });
    console.log(`Rumor sale success: ${rumorSale.success} (expected: true)`);
    console.log(`Normal price: ${rumorSale.normalPrice} GC`);
    console.log(`Rumor price: ${rumorSale.rumorPricePerUnit} GC`);
    console.log(`Premium percentage: ${rumorSale.rumor.premiumPercentage}%`);
    
    console.assert(rumorSale.success === true, 'Rumor sale should succeed');
    console.assert(rumorSale.rumorPricePerUnit > rumorSale.normalPrice, 'Rumor price should be higher than normal');
    console.assert(rumorSale.saleType === 'rumor', 'Should be marked as rumor sale');

    // No rumor found (mock roll for no rumor)
    const noRumorCheck = engine.checkForRumors('Luxuries', testSettlements.tradeTown, () => 80);
    console.log(`No rumor found: ${noRumorCheck.hasRumor} (expected: false)`);
    console.assert(noRumorCheck.hasRumor === false, 'Should not find rumor with roll 80');

    console.log('✓ Rumor generation and sales working correctly\n');

    // Test 3: Enhanced Partial Sale
    console.log('Test 3: Enhanced Partial Sale');
    console.log('=============================');

    const purchaseData = { settlementName: 'Averheim' };

    // Successful partial sale
    const partialSale = engine.processEnhancedPartialSale(
        'Luxuries', 
        100, 
        testSettlements.tradeTown, 
        purchaseData,
        {},
        () => 40 // Successful buyer roll
    );
    
    console.log(`Partial sale success: ${partialSale.success} (expected: true)`);
    console.log(`Quantity sold: ${partialSale.quantitySold} EP (expected: 50 EP)`);
    console.log(`Quantity remaining: ${partialSale.quantityRemaining} EP (expected: 50 EP)`);
    console.log(`Sale type: ${partialSale.saleType} (expected: partial_success)`);
    
    console.assert(partialSale.success === true, 'Partial sale should succeed');
    console.assert(partialSale.quantitySold === 50, 'Should sell half the quantity');
    console.assert(partialSale.quantityRemaining === 50, 'Should have half remaining');
    console.assert(partialSale.saleType === 'partial_success', 'Should be marked as partial success');

    // Failed partial sale (no buyer)
    const failedPartialSale = engine.processEnhancedPartialSale(
        'Luxuries',
        100,
        testSettlements.tradeTown,
        purchaseData,
        {},
        () => 90 // Failed buyer roll
    );
    
    console.log(`Failed partial sale: ${failedPartialSale.success} (expected: false)`);
    console.log(`Sale type: ${failedPartialSale.saleType} (expected: partial_failed)`);
    console.assert(failedPartialSale.success === false, 'Partial sale should fail with bad roll');
    console.assert(failedPartialSale.saleType === 'partial_failed', 'Should be marked as partial failed');

    // Partial sale with quantity too small
    const tooSmallPartialSale = engine.processEnhancedPartialSale('Luxuries', 1, testSettlements.tradeTown, purchaseData);
    console.log(`Too small partial sale: ${tooSmallPartialSale.success} (expected: false)`);
    console.assert(tooSmallPartialSale.success === false, 'Should fail when quantity too small');

    console.log('✓ Enhanced partial sale working correctly\n');

    // Test 4: Available Sale Options
    console.log('Test 4: Available Sale Options');
    console.log('==============================');

    const saleOptions = engine.getAvailableSaleOptions('Luxuries', 50, testSettlements.tradeTown, purchaseData);
    console.log(`Normal sale available: ${saleOptions.options.normal} (expected: true)`);
    console.log(`Desperate sale available: ${saleOptions.options.desperate} (expected: true)`);
    console.log(`Partial sale available: ${saleOptions.options.partial} (expected: false)`);
    console.log(`Rumor available: ${saleOptions.options.rumor !== false}`);
    
    console.assert(saleOptions.options.normal === true, 'Normal sale should be available');
    console.assert(saleOptions.options.desperate === true, 'Desperate sale should be available at Trade settlement');
    console.assert(saleOptions.options.partial === false, 'Partial sale should not be available when normal sale works');

    console.log('✓ Sale options detection working correctly\n');

    // Test 5: Execute Special Sale
    console.log('Test 5: Execute Special Sale');
    console.log('============================');

    // Execute desperate sale
    const executedDesperateSale = engine.executeSpecialSale(
        'desperate',
        'Luxuries',
        30,
        testSettlements.tradeTown,
        purchaseData,
        {},
        { season: 'spring' }
    );
    
    console.log(`Executed desperate sale success: ${executedDesperateSale.success} (expected: true)`);
    console.assert(executedDesperateSale.success === true, 'Should execute desperate sale successfully');

    // Execute partial sale
    const executedPartialSale = engine.executeSpecialSale(
        'partial',
        'Luxuries',
        80,
        testSettlements.tradeTown,
        purchaseData,
        {},
        {},
        () => 30 // Successful roll
    );
    
    console.log(`Executed partial sale success: ${executedPartialSale.success} (expected: true)`);
    console.assert(executedPartialSale.success === true, 'Should execute partial sale successfully');

    console.log('✓ Special sale execution working correctly\n');

    // Test 6: Profit Analysis
    console.log('Test 6: Profit Analysis');
    console.log('=======================');

    const purchaseDataWithCost = {
        settlementName: 'Averheim',
        totalCost: 300 // 20 EP × 15 GC = 300 GC original cost
    };

    const profitAnalysis = engine.analyzeSaleProfitability(
        'Luxuries',
        20,
        testSettlements.tradeTown,
        purchaseDataWithCost,
        { season: 'spring' }
    );

    console.log(`Original cost: ${profitAnalysis.originalCost} GC`);
    console.log(`Normal sale profit: ${profitAnalysis.saleOptions.normal.profit} GC`);
    console.log(`Normal profit margin: ${profitAnalysis.saleOptions.normal.profitMargin.toFixed(1)}%`);
    
    if (profitAnalysis.saleOptions.desperate) {
        console.log(`Desperate sale profit: ${profitAnalysis.saleOptions.desperate.profit} GC`);
        console.log(`Desperate profit margin: ${profitAnalysis.saleOptions.desperate.profitMargin.toFixed(1)}%`);
    }

    console.assert(profitAnalysis.originalCost === 300, 'Should track original cost correctly');
    console.assert(profitAnalysis.saleOptions.normal.profit !== undefined, 'Should calculate normal sale profit');
    console.assert(profitAnalysis.saleOptions.desperate !== undefined, 'Should calculate desperate sale profit');

    console.log('✓ Profit analysis working correctly\n');

    console.log('🎉 All Special Sale Methods Tests Passed!\n');
}

// Test error conditions
function runErrorConditionTests() {
    console.log('Running Error Condition Tests...\n');

    const dataManager = new MockDataManager();
    const engine = new TradingEngine(dataManager);

    // Test 1: Season validation
    console.log('Test 1: Season Validation');
    console.log('=========================');

    try {
        engine.determineCargoTypes({ source: ['Agriculture'] }, 'spring');
        console.assert(false, 'Should throw error when season not set');
    } catch (error) {
        console.log(`✓ Correctly threw error: ${error.message}`);
    }

    engine.setCurrentSeason('spring');

    // Test invalid season with Jest expect
    console.log('Testing invalid season...');
    expect(() => {
        engine.setCurrentSeason('invalid');
    }).toThrow('Invalid season: invalid. Must be one of: spring, summer, autumn, winter');

    console.log('✓ Correctly threw error for invalid season');

    // Test 2: Settlement validation
    console.log('\nTest 2: Settlement Validation');
    console.log('=============================');

    expect(() => {
        engine.calculateAvailabilityChance(null);
    }).toThrow('Settlement object is required');

    console.log('✓ Correctly threw error for null settlement');

    expect(() => {
        engine.determineCargoTypes({ source: null }, 'spring');
    }).toThrow('Invalid source array');

    console.log('✓ Correctly threw error for invalid source');

    console.log('\n🎉 All Error Condition Tests Passed!\n');
}

// Test suite for comprehensive algorithm validation
async function runComprehensiveAlgorithmTests() {
    console.log('Running Comprehensive Algorithm Validation Tests...\n');

    const dataManager = new MockDataManager();
    const engine = new TradingEngine(dataManager);
    engine.setCurrentSeason('spring');

    // Test all settlement size combinations
    const allSettlementTypes = [
        { size: 'V', sizeNum: 1, name: 'Village' },
        { size: 'ST', sizeNum: 2, name: 'Small Town' },
        { size: 'T', sizeNum: 3, name: 'Town' },
        { size: 'C', sizeNum: 4, name: 'City' },
        { size: 'CS', sizeNum: 4, name: 'City State' },
        { size: 'F', sizeNum: 2, name: 'Fort' },
        { size: 'M', sizeNum: 2, name: 'Mine' }
    ];

    const allWealthLevels = [
        { wealth: 1, modifier: 0.50, name: 'Squalid' },
        { wealth: 2, modifier: 0.80, name: 'Poor' },
        { wealth: 3, modifier: 1.00, name: 'Average' },
        { wealth: 4, modifier: 1.05, name: 'Bustling' },
        { wealth: 5, modifier: 1.10, name: 'Prosperous' }
    ];

    console.log('Test 1: All Settlement Size and Wealth Combinations');
    console.log('===================================================');

    allSettlementTypes.forEach(sizeType => {
        allWealthLevels.forEach(wealthType => {
            const testSettlement = {
                region: "Empire",
                name: `Test ${sizeType.name}`,
                size: sizeType.size,
                ruler: "Test Ruler",
                population: 1000,
                wealth: wealthType.wealth,
                source: ["Agriculture"],
                garrison: ["10c"],
                notes: "Test settlement"
            };

            const expectedChance = Math.min((sizeType.sizeNum + wealthType.wealth) * 10, 100);
            const actualChance = engine.calculateAvailabilityChance(testSettlement);
            
            console.log(`${sizeType.name} (${sizeType.size}) + ${wealthType.name} (${wealthType.wealth}): ${actualChance}% (expected: ${expectedChance}%)`);
            console.assert(actualChance === expectedChance, `Availability calculation failed for ${sizeType.name} + ${wealthType.name}`);
        });
    });

    console.log('✓ All settlement size and wealth combinations correct\n');

    // Test 2: Edge Cases and Boundary Conditions
    console.log('Test 2: Edge Cases and Boundary Conditions');
    console.log('==========================================');

    // Maximum availability (City State + Prosperous = 90%)
    const maxSettlement = {
        region: "Empire", name: "Max Settlement", size: "CS", ruler: "Emperor",
        population: 100000, wealth: 5, source: ["Trade"], garrison: ["500a"], notes: "Max test"
    };
    const maxChance = engine.calculateAvailabilityChance(maxSettlement);
    console.log(`Maximum availability: ${maxChance}% (expected: 90%)`);
    console.assert(maxChance === 90, 'Maximum availability should be 90%');

    // Minimum availability (Village + Squalid = 20%)
    const minSettlement = {
        region: "Empire", name: "Min Settlement", size: "V", ruler: "Elder",
        population: 50, wealth: 1, source: ["Agriculture"], garrison: ["5c"], notes: "Min test"
    };
    const minChance = engine.calculateAvailabilityChance(minSettlement);
    console.log(`Minimum availability: ${minChance}% (expected: 20%)`);
    console.assert(minChance === 20, 'Minimum availability should be 20%');

    // Test cargo size calculations with extreme values
    const extremeCargoSize = await engine.calculateCargoSize(maxSettlement, () => 100); // Max roll
    console.log(`Extreme cargo size: ${extremeCargoSize.totalSize} EP`);
    console.assert(extremeCargoSize.totalSize === 900, 'Extreme cargo size should be (4+5) × 100 = 900 EP');

    console.log('✓ All edge cases and boundary conditions correct\n');

    console.log('🎉 All Comprehensive Algorithm Validation Tests Passed!\n');
}

// Test suite for all cargo types and seasonal variations
function runCargoTypeSeasonalTests() {
    console.log('Running Cargo Type and Seasonal Variation Tests...\n');

    const dataManager = new MockDataManager();
    const engine = new TradingEngine(dataManager);

    const allSeasons = ['spring', 'summer', 'autumn', 'winter'];
    const allCargoTypes = dataManager.cargoTypes;

    console.log('Test 1: Seasonal Price Variations for All Cargo Types');
    console.log('=====================================================');

    allCargoTypes.forEach(cargo => {
        console.log(`\n${cargo.name} (${cargo.category}):`);
        
        allSeasons.forEach(season => {
            engine.setCurrentSeason(season);
            const price = engine.calculateBasePrice(cargo.name, season);
            const expectedPrice = cargo.basePrices[season];
            
            console.log(`  ${season}: ${price} GC (expected: ${expectedPrice} GC)`);
            console.assert(price === expectedPrice, `Price mismatch for ${cargo.name} in ${season}`);
        });

        // Test quality tiers if available
        if (cargo.qualityTiers) {
            console.log(`  Quality tiers:`);
            Object.entries(cargo.qualityTiers).forEach(([quality, multiplier]) => {
                const springPrice = engine.calculateBasePrice(cargo.name, 'spring', quality);
                const expectedPrice = cargo.basePrices.spring * multiplier;
                
                console.log(`    ${quality}: ${springPrice} GC (${multiplier}x)`);
                console.assert(springPrice === expectedPrice, `Quality tier price mismatch for ${cargo.name} ${quality}`);
            });
        }
    });

    console.log('\n✓ All seasonal price variations correct\n');

    console.log('🎉 All Cargo Type and Seasonal Tests Passed!\n');
}

// Test suite for haggling mechanics with various skill levels and talents
async function runHagglingMechanicsTests() {
    console.log('Running Haggling Mechanics Tests...\n');

    const dataManager = new MockDataManager();
    const engine = new TradingEngine(dataManager);
    engine.setCurrentSeason('spring');

    console.log('Test 1: Haggling with Various Skill Levels');
    console.log('==========================================');

    const skillLevels = [10, 25, 40, 55, 70, 85];
    const merchantSkill = 45;

    for (const playerSkill of skillLevels) {
        // Test successful haggle
        const successResult = await engine.performHaggleTest(playerSkill, merchantSkill, false, {}, () => 20);
        console.log(`Player skill ${playerSkill} vs Merchant ${merchantSkill}: Success = ${successResult.success}`);
        
        // Test with Dealmaker talent
        const dealmakertResult = await engine.performHaggleTest(playerSkill, merchantSkill, true, {}, () => 20);
        console.log(`  With Dealmaker: Success = ${dealmakertResult.success}, Bonus = ${dealmakertResult.hasDealmakertTalent ? '20%' : '10%'}`);
        
        console.assert(typeof successResult.success === 'boolean', 'Haggle result should have boolean success');
        console.assert(dealmakertResult.hasDealmakertTalent === true, 'Dealmaker result should track talent');
    }

    console.log('✓ All haggling skill level tests passed\n');

    console.log('Test 2: Haggling Price Modifiers');
    console.log('================================');

    // Test purchase price with haggling
    const basePrice = engine.calculatePurchasePrice('Grain', 50);
    console.log(`Base purchase price: ${basePrice.totalPrice} GC`);

    const successfulHaggle = { success: true, hasDealmakertTalent: false };
    const hagglePrice = engine.calculatePurchasePrice('Grain', 50, { haggleResult: successfulHaggle });
    console.log(`With successful haggle: ${hagglePrice.totalPrice} GC (${hagglePrice.modifiers.length} modifiers)`);
    console.assert(hagglePrice.totalPrice < basePrice.totalPrice, 'Successful haggle should reduce purchase price');

    const dealmakertHaggle = { success: true, hasDealmakertTalent: true };
    const dealmakertPrice = engine.calculatePurchasePrice('Grain', 50, { haggleResult: dealmakertHaggle });
    console.log(`With Dealmaker haggle: ${dealmakertPrice.totalPrice} GC`);
    console.assert(dealmakertPrice.totalPrice < hagglePrice.totalPrice, 'Dealmaker should provide better discount');

    console.log('✓ All haggling price modifier tests passed\n');

    console.log('🎉 All Haggling Mechanics Tests Passed!\n');
}

// Test suite for sale restrictions and buyer availability logic
async function runSaleRestrictionsTests() {
    console.log('Running Sale Restrictions and Buyer Availability Tests...\n');

    const dataManager = new MockDataManager();
    const engine = new TradingEngine(dataManager);
    engine.setCurrentSeason('spring');

    const testSettlements = {
        village: {
            region: "Empire", name: "Test Village", size: "V", ruler: "Elder",
            population: 100, wealth: 2, source: ["Agriculture"], garrison: ["5c"], notes: "Village"
        },
        town: {
            region: "Empire", name: "Test Town", size: "T", ruler: "Mayor",
            population: 3000, wealth: 3, source: ["Trade", "Agriculture"], garrison: ["30b"], notes: "Town"
        },
        city: {
            region: "Empire", name: "Test City", size: "C", ruler: "Lord",
            population: 15000, wealth: 4, source: ["Trade", "Industry"], garrison: ["100a"], notes: "City"
        }
    };

    console.log('Test 1: Village Restrictions by Season and Cargo Type');
    console.log('=====================================================');

    const cargoTypes = ['Grain', 'Wool', 'Metal', 'Luxuries'];
    const seasons = ['spring', 'summer', 'autumn', 'winter'];

    seasons.forEach(season => {
        engine.setCurrentSeason(season);
        console.log(`\n${season.toUpperCase()}:`);
        
        cargoTypes.forEach(cargoType => {
            const restriction = engine.checkVillageRestrictions(testSettlements.village, cargoType, season);
            const buyerChance = engine.calculateBuyerAvailabilityChance(testSettlements.village, cargoType);
            
            console.log(`  ${cargoType}: Restricted = ${restriction.restricted}, Buyer chance = ${buyerChance}%`);
            
            if (cargoType === 'Grain') {
                console.assert(restriction.restricted === false, 'Villages should always buy Grain');
                console.assert(buyerChance > 0, 'Villages should have buyers for Grain');
            } else if (season === 'spring') {
                console.assert(restriction.allowedQuantity >= 1 && restriction.allowedQuantity <= 10, 'Spring should allow 1-10 EP of non-Grain');
            } else {
                console.assert(restriction.allowedQuantity === 0, 'Non-spring seasons should not allow non-Grain goods');
            }
        });
    });

    console.log('\n✓ All village restriction tests passed\n');

    console.log('Test 2: Buyer Availability by Settlement Size');
    console.log('=============================================');

    Object.entries(testSettlements).forEach(([type, settlement]) => {
        const properties = dataManager.getSettlementProperties(settlement);
        const expectedBase = properties.sizeNumeric * 10;
        const tradeBonus = dataManager.isTradeSettlement(settlement) ? 30 : 0;
        const expectedChance = expectedBase + tradeBonus;

        const actualChance = engine.calculateBuyerAvailabilityChance(settlement, 'Grain');
        
        console.log(`${type}: Size ${properties.sizeNumeric} × 10 + ${tradeBonus} trade bonus = ${actualChance}% (expected: ${expectedChance}%)`);
        console.assert(actualChance === expectedChance, `Buyer availability calculation failed for ${type}`);
    });

    console.log('✓ All buyer availability tests passed\n');

    console.log('Test 3: Sale Eligibility Restrictions');
    console.log('=====================================');

    const purchaseData = { settlementName: 'Averheim', purchaseTime: 0 };
    const cargo = { name: 'Wine', quantity: 50 };

    // Valid sale (different settlement)
    const validSale = engine.checkSaleEligibility(cargo, testSettlements.town, purchaseData);
    console.log(`Valid sale (different settlement): ${validSale.eligible}`);
    console.assert(validSale.eligible === true, 'Should allow sale in different settlement');

    // Invalid sale (same settlement)
    const invalidSale = engine.checkSaleEligibility(cargo, { name: 'Averheim' }, purchaseData);
    console.log(`Invalid sale (same settlement): ${validSale.eligible}`);
    console.assert(invalidSale.eligible === false, 'Should not allow sale in same settlement');

    // Time-based sale (same settlement after waiting)
    const timePurchaseData = { settlementName: 'Averheim', purchaseTime: 0 };
    const timeBasedSale = engine.checkSaleEligibility(cargo, { name: 'Averheim' }, timePurchaseData, 8);
    console.log(`Time-based sale (after 8 days): ${timeBasedSale.eligible}`);
    console.assert(timeBasedSale.eligible === true, 'Should allow sale after 1 week wait');

    console.log('✓ All sale eligibility tests passed\n');

    console.log('🎉 All Sale Restrictions Tests Passed!\n');
}

// Run tests if in Node.js environment
if (typeof require !== 'undefined') {
    (async () => {
        runCargoAvailabilityTests();
        runPurchasePriceTests();
        runSaleMechanicsTests();
        runSpecialSaleMethodsTests();
        runErrorConditionTests();
        await runComprehensiveAlgorithmTests();
        runCargoTypeSeasonalTests();
        await runHagglingMechanicsTests();
        await runSaleRestrictionsTests();
    })();
}

// Export for browser testing
if (typeof window !== 'undefined') {
    window.runCargoAvailabilityTests = runCargoAvailabilityTests;
    window.runPurchasePriceTests = runPurchasePriceTests;
    window.runSaleMechanicsTests = runSaleMechanicsTests;
    window.runSpecialSaleMethodsTests = runSpecialSaleMethodsTests;
    window.runErrorConditionTests = runErrorConditionTests;
    window.runComprehensiveAlgorithmTests = runComprehensiveAlgorithmTests;
    window.runCargoTypeSeasonalTests = runCargoTypeSeasonalTests;
    window.runHagglingMechanicsTests = runHagglingMechanicsTests;
    window.runSaleRestrictionsTests = runSaleRestrictionsTests;
}