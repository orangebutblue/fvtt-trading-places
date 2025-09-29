# Settlement Flags

## Overview
Settlement flags are attributes that modify trading behavior. Each flag's modifiers live in `datasets/source-flags.json`, and a shared processor applies those modifiers sequentially so cumulative effects emerge without bespoke code per flag. Common modifier types include supply/demand transfers (percentage shifts within the 200-point equilibrium), availability multipliers, price adjustments, and UI tags.

## Flag Definitions

- **Trade**: Indicates the settlement is a local trade hub. Applies availability and supply-side transfers as defined in the flags dataset (default: +30% merchant availability for both Seekers and Producers, plus any category adjustments).
- **Government**: to be determined
- **Metalworking**: higher demand for metals and tools, produces higher quality goods
- **Boatbuilding**: Implies facilities for construction and repair. Does not serve as a mass tradable commodity in the cargo tables. higher demand for wood/timber and tools
- **Subsistence**: Indicates no marketable goods are produced - reduction penalty for availablity
- **Mine**: pushes raw materials toward supply surplus, increases bulk producer slots, and reduces local willingness to buy matching resources (handled by the supply/demand balance).
- **agriculture**: Produces farm goods like grain; replaces the old "Agriculture" cargo type entry
- **fort**: increases demand for armaments
- **smuggling**: Introduction of a "Contraband" chance for every good. This is a secret attribute (unbeknownst to the players). Normal settlements have a very low chance of higher chance for smuggled goods, while settlements with the "smuggling" flag has a high chance. This only affects Sellers (when Buyers buy goods). This also affects the price. it reduces the asking price
- **Piracy**: Also high contraband value, but also something else, have any ideas?