
## Step 1: Initialize Pipeline
- Load the trading configuration from trading-config.json
- Validate settlement data and load cargo types
- Build settlement context (name, size, wealth, production categories, etc.)

## Step 2: Calculate Merchant Slots
- Determine base merchant slots based on settlement size (Hamlet=1, Village=2, Town=3, City=4, Metropolis=5)
- Apply population multiplier (0.0001 × population)
- Apply size multiplier (1.5 × settlement size)
- Apply flag multipliers (e.g., Trade settlements get ×1.5)
- Cap at hard limit (15 merchants max)
- Round to get final producer slots
--> All of these numbers and formulas must be in `datasets/active/trading-config.json`. Never hardcode these anywhere in the code! If these values are not in the config file, stop immediately and ask

## Step 3: Build Cargo Candidate Table
- For each cargo type, calculate selection weight:
  - +8 if settlement produces this cargo
  - +5 if settlement demands this cargo
  - +2 per flag favoring supply
  - +1 per flag increasing demand (if demanded)
  - Seasonal adjustments (±2 based on season)
  - Minimum weight of 1 for baseline chance
- Convert weights to probabilities
--> All of these numbers and formulas must be in `datasets/active/trading-config.json`. Never hardcode these anywhere in the code! If these values are not in the config file, stop immediately and ask

## Step 4: Process Each Merchant Slot
For each available merchant slot:

### 4a: Select Cargo Type
- Weighted random selection from candidate table
- Returns cargo name, category, selection probability, reason it was selected and all other possible candidates and their probabilities
--> All cargo-types need to be taken from `datasets/active/cargo-types.json`

### 4b: Calculate Supply/Demand Balance
- Start with baseline supply/demand (100 each)
- Apply production shift (+50% supply if settlement produces this cargo)
- Apply demand shift (+35% demand if settlement demands this cargo) --> "demand" unclear. how does it work? how does it come to be?
- Apply flag transfers (supply/demand shifts from settlement flags) Taken from `datasets/source-flags.json`
- Apply seasonal shifts (e.g., agriculture +20% in spring) (taken from `datasets/active/cargo-types.json`)
- Apply wealth modifiers (-10% to +10% based on settlement wealth)
- Classify balance state: blocked, desperate, glut, scarce, or balanced
--> All of these numbers and formulas must be in `datasets/active/trading-config.json`. Never hardcode these anywhere in the code! If these values are not in the config file, stop immediately and ask

### 4c: Roll Cargo Amount
- Roll percentile die (1-100)
- Calculate base EP: ceil(roll/10) × 10 × settlement size
- Apply supply modifier: max(0.5, supply/demand ratio)
--> All of these numbers and formulas must be in `datasets/active/trading-config.json`. Never hardcode these anywhere in the code! If these values are not in the config file, stop immediately and ask

### 4d: Evaluate Quality
- Base score = settlement wealth rating
- Add flag quality bonuses
- Add market pressure bonus/penalty
- Convert score to tier: Poor/Common/Average/High/Exceptional
--> All of these numbers and formulas must be in `datasets/active/trading-config.json`. Never hardcode these anywhere in the code! If these values are not in the config file, stop immediately and ask

### 4e: Check Contraband
- Base chance 5% + flag bonuses + size bonuses
- Roll percentile vs chance
--> All of these numbers and formulas must be in `datasets/active/trading-config.json`. Never hardcode these anywhere in the code! If these values are not in the config file, stop immediately and ask

### 4f: Generate Merchant
- Calculate haggling skill using formula

### 4g: Calculate Pricing
- Get seasonal base price for cargo
- Apply quality multiplier (0.85-1.25)
- Apply contraband discount (×0.85 if contraband)
- Apply desperation penalties if applicable
- Calculate total value
--> All of these numbers and formulas must be in `datasets/active/trading-config.json`. Never hardcode these anywhere in the code! If these values are not in the config file, stop immediately and ask

## Step 5: Return Results
- Settlement context and slot plan
- Candidate table with probabilities
- Array of slot results (one per merchant)
- Each slot includes: cargo, balance, amount, quality, contraband status, merchant details, and pricing
