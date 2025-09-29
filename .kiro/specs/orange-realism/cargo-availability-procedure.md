# Cargo Availability Procedure - Buyer Tab

## Overview
This document outlines the step-by-step procedure executed when a GM clicks "Check for Cargo Availability" in the Buyer Tab. This generates Producers (merchants selling goods) available for players to buy from. Availability is not affected by wealth; instead, wealth influences prices and merchant quality. All rolls use d100 unless specified.

## Step-by-Step Procedure

0. **Lay Out All Stats and Default Values**:
   - Initialize default values for availability, prices, quality, contraband chance, etc. (defined in trading-config.json).

1. **Determine Number of Potential Producers**:
   - Base number = settlement size (1-5).
   - If settlement has "Trade" flag, double the number.
   - Example: Size 3 settlement without Trade = 3 Producers; with Trade = 6 Producers.

2. **Apply Settlement Flags**:
   - Process settlement flags (e.g., Trade, Mine, Smuggling) to modify probabilities for availability, prices, quality, and contraband.
   - This sets up modifiers for later steps; no actual values are generated yet.

3. **Apply Seasonal Modifiers**:
   - Apply modifiers from Season x Goods matrix to adjust probabilities for cargo types, amounts, quality, and prices based on current season.

4. **Generate Cargo Types**:
   - Determine cargo types available, affected by: settlement's native products, season (e.g., grain in spring), settlement size (larger = more variety), flags (e.g., Mine adds ores).

5. **Generate Available Amounts**:
   - Determine cargo amounts, affected by: roll results, settlement size, flags (e.g., Mine increases bulk), season (e.g., lower in off-season).

6. **Roll Cargo Quality**:
   - Determine quality levels, affected by: settlement wealth, flags (e.g., Metalworking improves quality).

7. **Roll Contraband**:
   - Determine contraband chance, affected by: default value, flags (e.g., Smuggling increases chance), settlement size (larger = higher chance), other factors.

8. **Roll Actual Merchants**:
   - For each potential Producer, make success rolls to determine if "good" or "bad" (normal vs. small amounts/unfair prices).
   - Assign skill levels and desperation based on formulas in trading-config.json.

9. **Calculate Prices**:
   - Compute final prices based on: base prices, quality, desperation, wealth, availability, skill, contraband risk, and all modifiers from previous steps.