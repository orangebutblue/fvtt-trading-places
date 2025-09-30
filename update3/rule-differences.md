This analysis compares your proposed sequential steps for trading mechanics against the official *Trading Rules* found in the sources. The source material relies on direct table lookups and simple arithmetic using predefined settlement ratings rather than complex weighted calculations.

The majority of your proposed steps **differ significantly** from the established trading rules, particularly in how availability, cargo size, and pricing modifiers are calculated.

***

## Comparison of Proposed Trading Pipeline vs. Source Rules

### Step 1: Initialize Pipeline (Load Config, Validate, Build Context)

This step aligns with setting up the contextual data required by the rules, such as the settlement's **Size Rating** and **Wealth Rating**, and its **Produces** categories.

*   **Conclusion:** **Correct in principle.** The source rules assume this contextual data is derived from the Gazetteer.

### Step 2: Merchant Slots (Availability)

This step calculates merchant "slots" based on numerous factors including population, size factors, and flag multipliers.

*   **Source Rule Difference:** The sources do not calculate "Merchant Slots" this way. Availability is determined by a single percentage chance derived solely from the settlement's predefined ratings: **(Size Rating + Wealth Rating) $\times$ 10**.
    *   *Example:* A Hamlet (Size 1) with Average Wealth (2) has a $(1 + 2) \times 10 = 30\%$ chance of a cargo being available.
*   **Trade Hubs:** Only if the settlement lists **Trade** in its production does the GM roll twice (once for local goods, once for a random cargo). No further multipliers or population factors are used in the availability calculation.

### Step 3: Cargo Candidate Table (Type Selection)

This step uses a weighted calculation based on production, demand, flags, and seasonal adjustments to create a probability table.

*   **Source Rule Difference:** The sources determine cargo type based on the strict hierarchy:
    1.  Goods listed in the **Produces** column (local production).
    2.  If none are listed, or if a second cargo is allowed (due to the **Trade** entry), the cargo is determined by a **d100 roll** on the **Random Cargo Table**, which inherently factors in **Seasonal** availability.
*   **The sources do not use a weighting system** involving arbitrary numerical bonuses (+8 if produced, +5 if demanded, +2 per supply-flag, etc.) to determine the probability of different cargo types appearing.

### Step 4c: Cargo Amount (EP Calculation)

Your proposed formula uses `ceil(roll/10) × 10 × size` for Base EP and then applies a supply modifier.

*   **Source Rule Difference:** The formula for cargo size in Encumbrance Points (**EP**) is explicitly defined and requires both the Size and Wealth ratings to determine the total multiplier:
    *   **Correct Formula:** **(Size Rating + Wealth Rating) $\times$ (1d100 rounded up to the nearest 10)**.
    *   Your base calculation is missing the **Wealth Rating** multiplier.
    *   **Trading Centres:** Only settlements listed as deriving Wealth from **Trade** have a special modifier, requiring the GM to reverse the d100 result and choose the larger of the two options before rounding. **No supply/demand ratio modifier is mentioned** in the calculation of cargo size (EP).

### Step 4d: Quality

This step applies modifiers to determine quality tiers for all cargo types.

*   **Source Rule Difference:** The sources implement explicit quality mechanics **only for Wine and Brandy**. Quality (Swill to Top Shelf) is determined by a separate d10 roll, which sets the price directly.
*   For all other cargo types (Grain, Metal, Wool, etc.), quality determination, tier conversion, or the use of quality multipliers is **not a feature of the general bulk trading rules**. Characters can make an **Evaluate Test** to spot poor quality or fraudulent claims, but this is a personal skill check, not a generalized market modifier.

### Step 4e: Contraband

This step determines the chance of contraband using a specific formula (5% + flags + size bonuses).

*   **Source Rule Difference:** While the existence of contraband (e.g., **Bretonnian brandy**, illicit magical supplies, "sleeping passengers" (dead bodies)) and the consequences of being caught (fines, confiscation) are covered, **the sources do not provide a mathematical formula** to generate this chance. Contraband typically enters the game based on adventure seeds or narrative context.

### Step 4f: Merchant (Haggling Skill)

This step calculates the merchant's haggling skill by formula.

*   **Source Rule Alignment:** The sources suggest a simple formula for the GM to generate an opposed Haggle skill score for small merchants, if a full NPC profile is not desired: **2d10 + 30** (resulting in 32–52).

### Step 4g: Pricing (Final Value)

This step uses seasonal base price multiplied by quality, contraband, and desperation modifiers.

*   **Source Rule Difference:** The pricing system is simpler, relying on the **Base Price Table** in conjunction with specific modifiers:
    1.  **Base Price:** Always derived from the table (GC/10 EP).
    2.  **Selling Price Modifier:** When *selling* the cargo, the Base Price is modified directly by the settlement's **Wealth Rating** (e.g., Prosperous adds 10% to the base price).
    3.  **Haggling:** Applied *after* base price determination, modifying the price by $\pm 10\%$ (or $\pm 20\%$ with the Dealmaker Talent).
    4.  **Local Production Bonus:** Armaments and Metal receive **+10%** if the settlement lists Metalworking in its production.
*   The use of **quality multipliers (0.85–1.25)**, **contraband multipliers ($\times 0.85$)**, or calculated **desperation penalties** is **not supported** by the official pricing rules for general cargo.