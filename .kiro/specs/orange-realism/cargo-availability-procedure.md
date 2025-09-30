# Cargo Availability Procedure - Buyer Tab

## Overview
This document outlines the step-by-step procedure executed when a GM clicks "Check for Cargo Availability" in the Buyer Tab. This generates Producers (merchants selling goods) available for players to buy from. Availability is not affected by wealth; instead, wealth influences prices and merchant quality. All rolls use d100 unless specified.

## Step-by-Step Procedure

0. **Lay Out All Stats and Default Values**:
   - Initialize default values for availability, prices, quality, contraband chance, etc. (defined in trading-config.json).

1. **Determine Merchant Slots**:
   - Derive settlement size from population (see population thresholds in the trading config).
   - Look up the merchant-count formula in the config to translate population/size into a number of producer slots.
   - Apply flat or percentage modifiers contributed by active flags (e.g., the `trade` flag) after the base count is calculated.

2. **Apply Settlement Flags**:
   - Process settlement flags (e.g., Trade, Mine, Smuggling) to queue up modifiers for availability, supply/demand balance, quality, and contraband.
   - This sets up percentage-based transfers and other adjustments for later steps; no actual values are generated yet.

3. **Apply Seasonal Modifiers**:
   - Apply modifiers from Season x Goods matrix to adjust probabilities for cargo types, amounts, quality, and prices based on current season.

4. **Compute Supply/Demand Balance**:
   - Initialize each cargo type at 100 supply / 100 demand (total 200).
   - Apply multiplicative transfers in sequence: settlement `produces` (supply-side), settlement `demands` (demand-side), flag modifiers, seasonal effects, wealth tiers, etc. Each modifier transfers a percentage of the current opposing pool toward its own side (e.g., +50% supply turns 100/100 into 150/50, then another +50% becomes 175/25).
   - Clamp results per config to avoid absolute zero supply/demand and store the final balance for downstream steps.

5. **Generate Cargo Types**:
   - Start from the settlement's `produces` list (if present); otherwise use flag/category pools.
   - Filter or weight cargo types using the final supply/demand balance (higher supply bias = more producer candidates, higher demand bias = more seeker candidates).
   - Reference `garrison` counts when category logic cares about military demand (future integration once garrison data is populated).

6. **Generate Available Amounts**:
   - Determine cargo amounts using roll results, the population-derived size, supply-side balance (higher supply = larger lots), flags (e.g., Mine increases bulk), and season (e.g., lower in off-season).

7. **Roll Cargo Quality**:
   - Determine quality levels, affected by: settlement wealth, flags (e.g., Metalworking improves quality).

8. **Roll Contraband**:
   - Determine contraband chance, affected by: default value, flags (e.g., Smuggling increases chance), settlement size (larger = higher chance), other factors.

9. **Generate Merchant**: 
   - Every successful cargo generation automatically gets a merchant
   - Generate merchant name and haggle-skill for flavor (no availability roll needed)
   - Merchant generation is purely cosmetic - all cargo slots produce merchants

10. **Calculate Prices**:
   - Compute final prices based on: base prices, quality, contraband risk, and all prior adjustments.