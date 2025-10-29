# Dataset System - Complete Guide

## Overview

Trading Places uses a **file-to-database loading strategy** for datasets. File-based datasets (shipped with the module) are imported **only on first launch**. After that, all operations work from **Foundry game settings** (database storage). User-created datasets are stored directly in the database and never touch files.

**Important**: We use `game.settings` instead of deprecated `world.getFlag()` for Foundry VTT v11+ compatibility.

## Critical Concepts

### The First Launch System

**First Launch Flow:**
```
1. Module detects datasetsInitialized = false
2. Loads datasets from /datasets/ folder (file reading)
3. Stores all datasets in game.settings (database)
4. Sets datasetsInitialized = true
5. Loads active dataset into memory
```

**Subsequent Launches:**
```
1. Module detects datasetsInitialized = true
2. Loads datasets from game.settings (database)
3. Loads active dataset into memory
4. Ready to use (no file reading)
```

**Key Point**: The `/datasets/` folder files are **read-only** and **only used once**. The module never writes to these files.

### Dataset Types

1. **File-Based Datasets** (e.g., `wfrp4e`)
   - Shipped with the module in `/datasets/` folder
   - Imported on first launch only
   - Type: `'file-based'`
   - Examples: `wfrp4e` (14 settlements, 50+ cargo types)

2. **User-Created Datasets**
   - Created via Data Management UI
   - Stored directly in game settings (never in files)
   - Type: `'user-created'`
   - Include default templates (1 example settlement, 1 cargo type)

**Both types are stored and handled identically in the database after creation.**

## Dataset Structure

Every dataset has identical structure:

```javascript
{
  id: 'dataset-id',           // Unique identifier
  label: 'Dataset Name',      // Display name
  type: 'file-based' | 'user-created',
  settlements: [],            // Array of settlement objects
  cargoTypes: [],             // Array of cargo type objects
  config: {},                 // Currency, inventory, skills config
  tradingConfig: {},          // Trading rules config
  sourceFlags: {},            // Source metadata
  cargo: [],                  // Player cargo inventory
  history: []                 // Transaction history
}
```

### Dataset Components

1. **settlements** - Array of settlement objects with merchant slots
2. **cargoTypes** - Array of cargo type objects with pricing
3. **config** - System configuration (currency, inventory, skills, talents)
4. **tradingConfig** - Trading rules configuration (pricing formulas, availability)
5. **sourceFlags** - Source metadata (book references, page numbers)
6. **cargo** - Player cargo inventory (per dataset)
7. **history** - Transaction history (per dataset)

## Architecture

### Files Involved

- `scripts/dataset-persistence.js` - Handles all dataset loading and persistence
- `scripts/data-manager.js` - Main interface for dataset operations
- `scripts/module-settings.js` - Defines game settings for storage
- `scripts/main.js` - Initializes datasets on module startup

### DatasetPersistence Class

**Purpose**: Low-level persistence operations

**Key Features:**
- Loads file-based datasets from module files on first launch only
- Stores all datasets in Foundry game settings (world scope)
- Provides unified handling for both file-based and user-created datasets
- Manages dataset CRUD operations

**Methods:**
```javascript
// Initialize datasets (call once at module startup)
await persistence.initialize();

// Get a specific dataset
const dataset = await persistence.getDataset('wfrp4e');

// Update a dataset
await persistence.updateDataset('wfrp4e', modifiedDataset);

// Create a user dataset
const newDataset = await persistence.createUserDataset('my-dataset', 'My Dataset');

// Delete a dataset (only user-created)
await persistence.deleteDataset('my-dataset');

// List all datasets
const datasets = await persistence.listDatasets();

// Reset all datasets (WARNING: deletes user-created datasets)
await persistence.resetAllDatasets();
```

### DataManager Class

**Purpose**: High-level dataset interface for the application

**Key Features:**
- Maintains current dataset in memory
- Loads active dataset on initialization
- Saves changes back to game settings
- Provides dataset switching functionality

**Methods:**
```javascript
// Initialize data manager (call once at module startup)
await dataManager.initialize();

// Switch active dataset
await dataManager.switchDataset('my-dataset');

// Save current dataset
await dataManager.saveCurrentDataset();

// Create new user dataset
await dataManager.createUserDataset('my-dataset', 'My Dataset');

// Delete a dataset
await dataManager.deleteDataset('my-dataset');

// List available datasets
const datasets = await dataManager.listDatasets();

// Update operations (automatically save)
await dataManager.updateSettlement(modifiedSettlement);
await dataManager.addCargoType(newCargoType);
await dataManager.updateCargoType(modifiedCargoType);
await dataManager.deleteCargoType(cargoId);
```

## Data Persistence

### Game Settings Structure

All datasets are stored in game settings (world scope):

```javascript
// Access via:
game.settings.get('fvtt-trading-places', 'datasetsInitialized') // Boolean
game.settings.get('fvtt-trading-places', 'datasets')            // Object
game.settings.get('fvtt-trading-places', 'activeDataset')       // String

// Structure:
{
  datasetsInitialized: true,  // Boolean: Has first load completed?
  datasets: {                  // Object: All datasets (including file-based)
    'wfrp4e': { ...dataset... },
    'user-dataset-1': { ...dataset... },
    // ... more datasets
  },
  activeDataset: 'wfrp4e'     // String: Currently active dataset ID
}
```

### Data Modification Flow

```
1. User modifies settlement/cargo via Data Management UI
2. DataManager.updateSettlement() or updateCargoType()
3. Update in-memory arrays
4. DataManager.saveCurrentDataset()
5. DatasetPersistence.updateDataset()
6. Write to game settings
7. Changes persisted
```

**Important**: All CRUD operations automatically persist to the database:

- **Creating Data**: User creates new settlement/cargo → saved to `game.settings`
- **Updating Data**: User edits settlement/cargo → saved to `game.settings`
- **Deleting Data**: User deletes settlement/cargo → removed from `game.settings`
- **Creating Datasets**: New user dataset → stored in `game.settings`
- **Deleting Datasets**: Delete dataset → removed from `game.settings`

Changes are **persistent** and **world-specific**. Each Foundry world has its own independent datasets.

## User Dataset Defaults

When creating a new user dataset, it includes:

### Default Settlement
- Region: "Custom"
- Name: "Example Settlement"
- Size: 3 (Town)
- Population: 5000
- Wealth: 3 (Average)
- 5 merchant slots (3 buying, 2 selling)

### Default Cargo Type
- Name: "Example Cargo"
- Category: "Trade"
- Base Price: 100 BP
- Seasonal Modifiers: All 1.0 (no seasonal variation)

### Default Config
- Currency: Simple "Gold" (G) currency with no denominations
- Inventory: Standard Foundry item handling
- Skills: Empty (no skill mappings)
- Talents: Empty (no talent mappings)

### Default Trading Config
- Population thresholds for settlement sizes
- Cargo slots calculation based on population
- Basic pricing formula
- Standard haggling mechanics

## Implementation Changes (from Old System)

### What Changed

The old system used:
- File paths for datasets
- Separate settings for user datasets
- Manual file loading on every launch
- Different handling for file-based vs user datasets

The new system uses:
- Game settings exclusively (no file paths)
- Unified handling of all datasets
- File loading only on first launch
- Automatic persistence for all operations

### Breaking Changes

**Removed Properties:**
- `dataManager.dataPath` - No longer needed (was file path)
- `dataManager.datasetPointer` - Replaced by `listDatasets()`

**Deprecated Methods (kept with warnings):**
- `dataManager.loadDatasetPointer()` - Use `listDatasets()`
- `dataManager.resolveActiveDatasetName()` - Use `activeDatasetName` property
- `dataManager.ensureDatasetPath()` - No longer needed
- `dataManager.getDatasetPath()` - No longer needed
- `dataManager._persistUserDatasetChanges()` - Use `saveCurrentDataset()`

### Migration Notes

**For Users:**
- No action required - first launch automatically imports file-based datasets
- Old user datasets in settings are NOT automatically migrated
- Create new user datasets via Data Management UI if needed

**For Developers:**
- Update any code that used old dataset loading methods
- Use new `initialize()` method at startup
- Use `saveCurrentDataset()` after modifications
- Check console for deprecated method warnings

## Performance Considerations

- **Memory Efficiency**: Only the active dataset is loaded into memory (not all datasets)
- **Disk Storage**: All datasets stored in world database (acceptable for typical use)
- **First Launch**: Slightly slower (file reading), subsequent launches fast
- **Updates**: Instant (settings writes are fast)
- **Size Limits**: Game settings can handle large objects, but extremely large datasets (thousands of settlements) may need optimization
- **Network**: Settings are synchronized automatically in multiplayer
- **Multiplayer Safe**: Foundry handles settings synchronization

## Testing

### Console Testing

Check initialization status:
```javascript
// Check if datasets are initialized
game.settings.get('fvtt-trading-places', 'datasetsInitialized')

// View all datasets
game.settings.get('fvtt-trading-places', 'datasets')

// Check active dataset
game.settings.get('fvtt-trading-places', 'activeDataset')
```

### First Launch Testing

1. Fresh Foundry world or cleared settings
2. Launch module
3. Watch console for: "First launch detected - loading datasets from files..."
4. Verify wfrp4e dataset loads (should see settlement/cargo counts)
5. Check game settings for stored data

### Subsequent Launch Testing

1. Reload Foundry
2. Watch console for: "Loading datasets from world database..."
3. Verify data loads without file access
4. Confirm changes persist across reloads

## Troubleshooting

### Dataset Not Loading

**Symptoms**: Module fails to load, no settlements available

**Checks:**
- Check console for errors
- Verify module files are present in `/datasets/wfrp4e/`
- Check settings: `game.settings.get('fvtt-trading-places', 'datasets')`
- Verify you're a GM (world-scoped settings require GM access)

**Solution:**
```javascript
// Reset and re-import from files
const persistence = new window.TradingPlacesDatasetPersistence();
await persistence.resetAllDatasets();
// Then reload Foundry
```

### Changes Not Persisting

**Symptoms**: Edits to settlements/cargo don't save across reloads

**Checks:**
- Ensure `saveCurrentDataset()` is called after modifications
- Check console for save errors
- Verify you have GM permissions

**Solution:**
```javascript
// Manually save current dataset
await game.modules.get('fvtt-trading-places').api.dataManager.saveCurrentDataset();
```

### Multiple Datasets Issues

**Symptoms**: Wrong dataset loads, datasets missing

**Checks:**
- Check active dataset: `game.settings.get('fvtt-trading-places', 'activeDataset')`
- List all datasets: `await dataManager.listDatasets()`

**Solution:**
```javascript
// Switch to correct dataset
await game.modules.get('fvtt-trading-places').api.dataManager.switchDataset('wfrp4e');
```

### Reset to Defaults

**WARNING**: This deletes all user-created datasets!

```javascript
// Clear all datasets and reload from files
const persistence = new window.TradingPlacesDatasetPersistence();
await persistence.resetAllDatasets();
```

## Best Practices

1. **Always save after modifications**: DataManager methods save automatically, but manual changes need `saveCurrentDataset()`
2. **Don't modify dataset directly**: Use DataManager methods for validation
3. **Validate data**: All modifications go through validation
4. **Backup regularly**: Datasets are part of world database, include in backups
5. **Test user datasets**: Create test dataset before making production changes
6. **Memory management**: Switch datasets when not in use to free memory (automatic)
7. **Multiplayer**: Be aware settings synchronization may have slight delays

## Important Notes

- **Memory Efficiency**: Only the active dataset is loaded into memory
- **No File Writing**: Module never writes to `/datasets/` files
- **Multiplayer Safe**: Foundry handles settings synchronization automatically
- **Backup**: Datasets are part of world database backup
- **Testing**: Check console for "First launch detected" vs "Loading from world database" messages
- **Reset**: If needed, use `DatasetPersistence.resetAllDatasets()` to force re-import from files
- **World-Specific**: Each Foundry world has its own independent datasets

## Future Enhancements

Possible future improvements:
- Import/export datasets as JSON files
- Dataset templates for quick setup
- Bulk dataset operations
- Dataset versioning and rollback
- Dataset sharing between worlds
- Dataset compression for large datasets
