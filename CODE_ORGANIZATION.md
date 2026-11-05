# Code Organization Guide

## Overview
This document explains how shared components and utilities are organized to avoid code duplication.

## Folder layout and schema versions

- `js/shared/` - everything that is the same for schema V2 and V3 (auth, config, generic API calls, UI cards, components, utilities).
- `js/v2/` and `js/v3/` - the code that depends on how a schema version stores data (loaders for streams, tickets, levels, rooms, systems and tagged assets, plus the asset details page). Both folders expose the same interface through their `index.js`.
- `js/shared/version.js` - the registry that `js/app.js` fills with the selected version module. Shared code reaches version-specific behaviour through its delegates, never by importing from `v2/` or `v3/`.

Duplicating code between `v2/` and `v3/` is intentional where the schemas differ. There must be no `if (version === ...)` in shared code.

## Shared Components

### 1. Asset Details Page (`js/v2/features/assetDetails.js` and `js/v3/features/assetDetails.js`)
**Purpose**: Reusable detail page for displaying element information across different features.

**Exported Function**: `viewAssetDetails(elementsByModel, title)`

**Used By**:
- Tagged Assets card (property-specific and overall details)
- Rooms & Spaces card (room details)
- Levels card (level details)
- Streams card (stream details)
- Systems card (system element details)
- Model History page (change details)

**Parameters**:
- `elementsByModel`: Array of objects with structure:
  ```js
  [{
    modelURN: 'urn:adsk.dtm:...',
    modelName: 'Model Name',
    keys: ['elementKey1', 'elementKey2', ...]
  }]
  ```
- `title`: Page title (e.g., "Stream Details", "Room Details")

**Features**:
- Displays elements grouped by model
- Expandable details showing all properties
- "View Keys" modal for copying element keys
- Excel export with summary and detail sheets
- Category name resolution

### 2. Toggle Header Component (`js/shared/components/toggleHeader.js`)
**Purpose**: Reusable expand/collapse functionality for card details.

**Used By**:
- Rooms & Spaces card
- Levels card
- Diagnostics card
- Documents card
- Schema card
- Streams card
- Systems card
- Tagged Assets card

## Shared Utilities

### 1. General Utilities (`js/shared/utils.js`)
**Functions**:
- `formatUnitName(forgeUnit)`: Converts unit names to display format (e.g., "squareFeet" → "ft²")
- `isDefaultModel(facilityURN, modelURN)`: Checks if a model is the default
- `convertLongKeysToShortKeys(lastSeenValues)`: Converts API long keys to short keys
- `getDataTypeName(typeCode)`: Human-readable data type names

### 2. Excel Export Utilities (`js/shared/utils/excelUtils.js`)
**Purpose**: Shared utilities for Excel export functionality (for future main app exports).

**Functions**:
- `sanitizeSheetName(name, fallback)`: Clean sheet names for Excel
- `makeUniqueSheetName(baseName, usedNames)`: Ensure unique sheet names
- `styleHeaderRow(sheet, rowNum, columns, style)`: Apply header styling
- `styleBlankRow(sheet, rowNum, columns, style)`: Apply separator row styling
- `styleAllBlankRows(sheet, data, columns)`: Find and style all blank rows
- `getColumnLetters(count)`: Generate column letters (A, B, C, ...)
- `createExportButtonManager(button, originalHtml)`: Manage button states
- `downloadWorkbook(workbook, filename)`: Download Excel file
- `createDateFilename(prefix, suffix)`: Generate filename with date

**Common Styles**:
- `ExcelStyles.header`: Bold, gray fill for headers
- `ExcelStyles.blankSeparator`: Gray hatch pattern for separators

### 3. Tandem Keys (`tandem/keys.js`)
**Purpose**: Handle Tandem element key conversions.

**Functions**:
- `toShortKey(fullKey)`: 24-byte → 20-byte
- `toFullKey(shortKey, isLogical)`: 20-byte → 24-byte
- `decodeXref(xref)`: Extract model URN and element key from xref
- `makeXrefKey(modelURN, elemKey)`: Create xref

### 4. Tandem Constants (`tandem/constants.js`)
**Purpose**: Standard Tandem property constants.

**Key Constants**:
- `QC.*`: Qualified column names (e.g., `QC.Name`, `QC.Key`)
- `ColumnFamilies.*`: Column family identifiers
- `ElementFlags.*`: Element type flags
- Key size constants

## Excel Export Pattern

### In Standalone Pages (Stream Chart, Asset Details)
These pages open in new windows and can't use ES6 imports, so they embed utility functions:

```javascript
// Excel Export Utilities
const ExcelUtils = {
  headerStyle: { /* ... */ },
  blankRowStyle: { /* ... */ },
  
  sanitizeSheetName: function(name, fallback) { /* ... */ },
  makeUnique: function(baseName, usedNames) { /* ... */ },
  styleHeaderRow: function(sheet, columns, style) { /* ... */ },
  styleBlankRows: function(sheet, data, columns, style) { /* ... */ }
};
```

**Used In**:
- `js/shared/features/streams.js` (Stream Chart page)
- `js/v2/features/assetDetails.js` (Asset Details page)

### Common Export Pattern
```javascript
async function exportToExcel() {
  const exportBtn = document.getElementById('export-btn');
  const originalText = exportBtn.innerHTML;
  
  try {
    // 1. Loading state
    exportBtn.disabled = true;
    exportBtn.innerHTML = '<span>⏳</span><span>Exporting...</span>';
    
    // 2. Create workbook
    const workbook = XLSX.utils.book_new();
    
    // 3. Create sheets with ExcelUtils
    const sheet = XLSX.utils.aoa_to_sheet(data);
    ExcelUtils.styleHeaderRow(sheet, columns, ExcelUtils.headerStyle);
    
    // 4. Sanitize sheet name
    const sheetName = ExcelUtils.sanitizeSheetName(name, fallback);
    XLSX.utils.book_append_sheet(workbook, sheet, sheetName);
    
    // 5. Download
    XLSX.writeFile(workbook, filename);
    
    // 6. Success feedback
    exportBtn.innerHTML = '<span>✓</span><span>Exported!</span>';
    setTimeout(() => {
      exportBtn.innerHTML = originalText;
      exportBtn.disabled = false;
    }, 2000);
    
  } catch (error) {
    // 7. Error feedback
    exportBtn.innerHTML = '<span>✗</span><span>Export Failed</span>';
    setTimeout(() => {
      exportBtn.innerHTML = originalText;
      exportBtn.disabled = false;
    }, 2000);
  }
}
```

## Visualization Components

### Room Bar Chart (`js/shared/features/roomBarChart.js`)
**Purpose**: Horizontal bar chart for room/space size visualization.

**Exported Function**: `viewRoomBarChart(rooms)`

**Used By**: Rooms & Spaces card

**Features**:
- Sortable by area, name, or type
- Click bar to open asset details for that room
- Color-coded (rooms = purple gradient, spaces = orange gradient)
- Statistics panel (total area, average, top 10%)

## API Organization (`js/shared/api.js`, `js/v2/api.js`, `js/v3/api.js`)

Version-agnostic API calls are centralized in `js/shared/api.js`. The loaders that depend on the schema version (`getStreams`, `getTickets`, `getLevels`, `getRooms`, `getSystems`, `getTaggedAssetsDetails`) live in `js/v2/api.js` and `js/v3/api.js` and return the same shapes:
- `getModels(facilityURN)`: Get all models
- `getRooms(facilityURN)`: Get rooms/spaces with area
- `getStreams(facilityURN)`: Get streams with metadata
- `getSystems(facilityURN)`: Get systems with elements grouped by model
- `getTaggedAssetsDetails(facilityURN, includeKeys)`: Optimized tagged assets scan
- `getElementsByKeys(modelURN, keys)`: Get elements by keys
- `getStreamValues(facilityURN, streamKeys, from, to)`: Get stream time-series data

## State Management

### Schema Cache (`js/shared/state/schemaCache.js`)
**Purpose**: Cache and lookup property display names.

**Functions**:
- `getSchemaCache()`: Get cached schema
- `setSchemaCache(schema)`: Set schema cache
- `getPropertyDisplayName(qualifiedProp, modelURN)`: Resolve property name

## Best Practices

### 1. Reuse Components
- ✅ Use `viewAssetDetails()` for all element detail pages
- ✅ Use `createToggleFunction()` for expand/collapse behavior
- ✅ Use `ExcelUtils` pattern for Excel exports

### 2. API Efficiency
- ✅ Batch API calls per model using `Promise.all()`
- ✅ Cache data when used multiple times (e.g., tagged assets)
- ✅ Minimize scan endpoint calls with targeted `qualifiedColumns`

### 3. Naming Consistency
- ✅ Use descriptive function names
- ✅ Follow established patterns (e.g., `viewXxxChart`, `displayXxx`)
- ✅ Use constants from `tandem/constants.js`

### 4. Error Handling
- ✅ Try-catch for all async operations
- ✅ User-friendly error messages
- ✅ Console logging for debugging

## Future Enhancements

When adding new features that need:
- **Element details**: Use `viewAssetDetails()`
- **Excel export**: Follow the `ExcelUtils` pattern
- **Expand/collapse**: Use `createToggleFunction()`
- **Key conversions**: Use functions from `tandem/keys.js`
- **Property display names**: Use `schemaCache.js`

