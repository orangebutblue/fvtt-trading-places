# Dataset Validation Fix - ConfigValidator Reading from Memory

## Problem Summary

The `ConfigValidator` was attempting to validate datasets by fetching files from the `/datasets/` folder via HTTP requests, even though **all datasets are stored in `game.settings` after first launch**.

### Error Symptoms
- Multiple 404 errors: `GET http://localhost:30013/modules/fvtt-trading-places/datasets/xxxx/config.json`
- Error: "Config currency.denominations must be a non-empty array"
- Validation failures for dataset "xxxx" (and any other user-created datasets)

## Root Cause

According to `docs/DATASET_SYSTEM.md`:
- **First Launch**: File-based datasets are imported from `/datasets/` folder into `game.settings`
- **After First Launch**: ALL datasets (both file-based like "wfrp4e" and user-created) exist ONLY in `game.settings`
- The module NEVER reads from files after initialization

**The ConfigValidator was incorrectly assuming:**
- "Built-in" datasets = read from files
- "User" datasets = read from settings

**The reality:**
- ALL datasets = read from `game.settings` (after initialization)
- Files are only used ONCE on first launch

## Solution Implemented

### Changed Files
**scripts/config-validator.js**

### Key Changes

#### 1. Removed File-Based Validation After Initialization

**Before:**
```javascript
if (this.isUserDataset(datasetId)) {
    validation = await this.validateUserDataset(datasetId);
} else {
    // WRONG: Tries to read from filesystem
    validation = await this.validateSingleDataset(datasetId, basePath);
}
```

**After:**
```javascript
// Check if datasets initialized
const datasetsInitialized = game.settings.get(this.moduleId, 'datasetsInitialized');

if (!datasetsInitialized) {
    // First launch - skip validation, files will be loaded soon
    return result;
}

// After initialization, read ALL datasets from game.settings
const allDatasets = game.settings.get(this.moduleId, 'datasets') || {};
const validation = await this.validateDatasetFromMemory(datasetId, allDatasets[datasetId]);
```

#### 2. Added `validateDatasetFromMemory()` Method

New method that validates datasets from `game.settings` instead of files:
- Reads dataset object from memory
- Validates structure (config, settlements, cargoTypes)
- Validates content using existing validation logic
- Returns same result format for compatibility

#### 3. Updated `validateRequiredConfigFiles()`

Changed from:
- Fetching files via HTTP
- Different logic for "user" vs "built-in" datasets

To:
- Check if datasets initialized
- Read from `game.settings` only
- Unified validation for all datasets

#### 4. Removed Deprecated Methods

Removed methods that assumed file-based validation:
- `isUserDataset()` - No longer needed, all datasets treated equally
- `validateUserDataset()` - Replaced by `validateDatasetFromMemory()`

## How It Works Now

### Validation Flow

```
1. performStartupValidation() called
2. Check: datasetsInitialized?
   - false → Skip validation (first launch, files loading soon)
   - true → Continue
3. Read: allDatasets = game.settings.get('datasets')
4. Validate active dataset from memory
5. Validate other datasets from memory (warnings only)
```

### Dataset Access

```javascript
// All datasets stored here after initialization
const allDatasets = game.settings.get('fvtt-trading-places', 'datasets');

// Example structure:
{
  "wfrp4e": {
    id: "wfrp4e",
    label: "Warhammer Fantasy Roleplay 4th Edition",
    type: "file-based",
    config: { ... },
    settlements: [ ... ],
    cargoTypes: [ ... ],
    ...
  },
  "xxxx": {
    id: "xxxx",
    label: "Custom Dataset",
    type: "user-created",
    config: { ... },
    settlements: [ ... ],
    cargoTypes: [ ... ],
    ...
  }
}
```

## Testing

After this fix:

### Expected Behavior
✅ No 404 errors trying to fetch files  
✅ Datasets validated from `game.settings`  
✅ Both "wfrp4e" and "xxxx" validated the same way  
✅ Validation errors show actual config issues, not file access issues  

### Console Output
```
ConfigValidator | Starting comprehensive startup validation
ConfigValidator | Startup validation completed successfully
```

Or if dataset has issues:
```
Active dataset 'xxxx' validation failed:
  - Config currency.denominations must be a non-empty array
```

### Validation Report
The validation report will now show:
- Dataset status based on actual data in memory
- No file access errors
- Clear config structure errors if any exist

## Important Notes

1. **First Launch Handling**: On first launch (before `datasetsInitialized` is true), validation is skipped because datasets haven't been loaded yet

2. **All Datasets Treated Equally**: No distinction between "file-based" and "user-created" for validation purposes - both are in memory

3. **No File Access**: After initialization, the validator NEVER attempts HTTP requests to `/datasets/` folder

4. **Backward Compatible**: The validation result structure remains the same, so other code depending on it continues to work

5. **Settings Key**: The main storage is `game.settings.get('fvtt-trading-places', 'datasets')`

## Related Documentation

- `docs/DATASET_SYSTEM.md` - Complete dataset system documentation
- `scripts/dataset-persistence.js` - Dataset loading and persistence
- `scripts/data-manager.js` - Dataset management API

## Migration Notes

This fix is fully backward compatible:
- No changes needed to other code
- Existing datasets continue to work
- Validation result format unchanged
- Tests should continue to pass
