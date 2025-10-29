# Wine & Brandy Quality System Implementation

## Overview

This document describes the implementation of the Wine and Brandy quality determination system for Trading Places, based on the official WFRP4e rules.

## Features Implemented

### 1. Quality Determination Table

Wine and Brandy now use a d10-based quality system with fixed prices:

| d10 Roll | Quality    | Price (GC) | Price (BP) |
|----------|------------|------------|------------|
| 1        | Swill      | 0.5        | 120        |
| 2-3      | Passable   | 1          | 240        |
| 4-5      | Average    | 1.5        | 360        |
| 6-7      | Good       | 3          | 720        |
| 8-9      | Excellent  | 6          | 1440       |
| 10+      | Top Shelf  | 12         | 2880       |

### 2. Settlement Quality Bonuses

- **wine_quality flag**: Provides +2 to quality rolls for Wine and Brandy
- **Kemperbad**: Added as example settlement with wine_quality flag
- Bonuses can push quality above 10 for Top Shelf results

### 3. Merchant Dishonesty System

#### Global Setting
- **Merchant Dishonesty Chance**: 0-100% (default: 50%)
- Configurable in Foundry module settings

#### Dishonesty Mechanics
- **Wine/Brandy**: Dishonest merchants inflate quality by 2-4 tiers
- **Regular Cargo**: Dishonest merchants inflate quality by 2-4 tiers
- Price calculated based on claimed quality, not actual quality

#### UI Display
```
Quality: Excellent (Good) [?]
```
- First tier = what merchant claims (price basis)
- Parentheses = actual quality
- Question mark = tooltip for Evaluate test

### 4. Evaluate Test Integration

#### Tooltip Content
When hovering over the [?] icon:

**For Wine/Brandy:**
> Ask players to make an Evaluate Test (Challenging +0, or Average +20 if Consume Alcohol ≥50). Success reveals true quality: [actual]. Failure gives false impression based on degrees of failure.

**For Regular Cargo:**
> Ask players to make an Evaluate Test (Challenging +0) to detect merchant dishonesty. True quality tier: [actual]. Merchant claims: [inflated].

## File Changes

### New Files
- `scripts/quality-system.js` - Core quality determination logic
- `docs/WINE_BRANDY_QUALITY_SYSTEM.md` - This documentation

### Modified Files
- `datasets/wfrp4e/source-flags.json` - Added wine_quality flag
- `datasets/wfrp4e/cargo-types.json` - Updated Wine/Brandy entries
- `datasets/wfrp4e/settlements/Reikland.json` - Added Kemperbad
- `scripts/module-settings.js` - Added dishonesty chance setting
- `scripts/cargo-availability-pipeline.js` - Integrated quality system
- `module.json` - Added quality-system.js to esmodules

## Usage

### For Game Masters
1. **Configure Dishonesty**: Set merchant dishonesty percentage in module settings
2. **Settlement Setup**: Assign wine_quality flag to wine-producing regions
3. **Manual Evaluation**: Use tooltips to guide player Evaluate tests

### For Players
1. **Examine Cargo**: Look for quality information in trading interface
2. **Evaluate Test**: Make tests when suspicious of merchant claims
3. **Consume Alcohol Skill**: ≥50 provides +20 bonus to Evaluate tests

## Technical Details

### Quality System Class
```javascript
const qualitySystem = new QualitySystem(dataManager);

// Roll quality with settlement bonuses
const result = qualitySystem.rollWineBrandyQuality(['wine_quality'], 'Wine');

// Check merchant honesty
const honesty = qualitySystem.rollMerchantHonesty(0.5);

// Apply inflation if dishonest
const final = qualitySystem.applyQualityInflation(result, honesty.qualityInflation, true);
```

### Integration Points
- **Cargo Pipeline**: Quality determination during merchant generation
- **Pricing**: Wine/Brandy uses quality table, regular cargo uses multipliers
- **UI Display**: Shows actual vs claimed quality with tooltips

## Future Enhancements

1. **Automated Evaluate Tests**: Integration with character skills
2. **Additional Settlements**: More wine-producing regions
3. **Reputation System**: Merchant trustworthiness tracking
4. **Quality Aging**: Time-based quality improvements

## Testing

The system has been tested with:
- ✅ Basic d10 quality rolls
- ✅ Settlement bonus application
- ✅ Merchant dishonesty mechanics
- ✅ Tooltip generation
- ✅ Price calculation integration

All tests show expected behavior matching WFRP4e rules.