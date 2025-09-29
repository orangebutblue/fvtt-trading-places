# Settlement Flags

## Overview
Settlement flags are attributes that modify trading behavior. Each flag is implemented as its own function that affects parameters like availability, prices, etc. Settlements with multiple flags process them sequentially, allowing cumulative effects.

## Flag Definitions

- **Trade**: Indicates the settlement is a local trade hub. Requires rolling twice for cargo availability (local goods + random cargo). Also affects availability of Seekers and Producers (+30% chance) and calculating cargo size.
- **Government**: to be determined
- **Metalworking**: higher demand for metals and tools, produces higher quality goods
- **Boatbuilding**: Implies facilities for construction and repair. Does not serve as a mass tradable commodity in the cargo tables. higher demand for wood/timber and tools
- **Subsistence**: Indicates no marketable goods are produced - reduction penalty for availablity
- **Mine**: higher availability for certain minerals/ores, lower prices for them, more bulk goods
- **fort**: increases demand for armaments
- **smuggling**: Introduction of a "Contraband" chance for every good. This is a secret attribute (unbeknownst to the players). Normal settlements have a very low chance of higher chance for smuggled goods, while settlements with the "smuggling" flag has a high chance. This only affects Sellers (when Buyers buy goods). This also affects the price. it reduces the asking price
- **Piracy**: Also high contraband value, but also something else, have any ideas?