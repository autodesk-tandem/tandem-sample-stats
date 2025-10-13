# Tandem SDK Utilities

This directory contains reusable utilities for working with the Autodesk Tandem REST API. These are adapted from the official [tandem-sample-rest-testbed](https://github.com/autodesk-tandem/tandem-sample-rest-testbed) project.

## Files

### `dt-schema.js`

**Purpose:** Constants and definitions for Tandem's database schema.

**What it contains:**
- **ColumnFamilies** - Database column family prefixes (`n`, `x`, `z`, etc.)
- **ColumnNames** - Column names within families (`n`, `!n`, `p`, `r`, etc.)
- **ElementFlags** - Element type flags (Stream, Room, Level, etc.)
- **QC** - Pre-built qualified column names for convenience

**When to use:** Whenever you need to reference Tandem properties. **Always prefer these constants over hardcoded strings.**

**Example:**
```javascript
import { ColumnFamilies, ColumnNames, ElementFlags, QC } from './sdk/dt-schema.js';

// Method 1: Build column names dynamically
const nameCol = `${ColumnFamilies.Standard}:${ColumnNames.Name}`;  // "n:n"
const categoryCol = `${ColumnFamilies.Standard}:${ColumnNames.CategoryId}`;  // "n:c"

// Method 2: Use pre-built qualified columns (cleaner!)
const name = element[QC.Name];  // element['n:n']
const overrideName = element[QC.OName];  // element['n:!n']

// Check element type using flags
if (element[QC.ElementFlags]?.[0] === ElementFlags.Stream) {
  console.log('This is a stream element');
}
```

### `keys.js`

**Purpose:** Utilities for working with element keys and xrefs (cross-references).

**What it contains:**
- `toShortKey(fullKey)` - Convert 24-byte long key to 20-byte short key
- `decodeXref(xref)` - Extract model URN and element key from xref
- `makeXrefKey(modelURN, elemKey)` - Create xref from components
- `fromXrefKeyArray(text)` - Parse array of xrefs

**When to use:** 
- Converting between key formats (always needed!)
- Decoding cross-model references
- Working with stream hosts, parent elements, etc.

**Example:**
```javascript
import { decodeXref } from './sdk/keys.js';

// Problem: API returns long keys, but you need short keys to query
const longKey = streamData[QC.Key];  // 24 bytes

// Problem: Stream has a host room reference, need to fetch that room
const hostXref = stream[QC.XParent]?.[0];  // Xref is 40 bytes (16 model + 24 element)
const { modelURN, elementKey } = decodeXref(hostXref);  // Extract components

const rooms = await getElementsByKeys(modelURN, [elementKey]);  // Query the room
```

## Key Concepts

### Short Keys vs Long Keys

The most important concept when working with Tandem:

| Type | Size | Contains | Used For |
|------|------|----------|----------|
| Short Key | 20 bytes | Element ID only | **Querying** elements |
| Long Key | 24 bytes | Element ID + type flags | **Identifying** elements (returned by API) |

**Rule of Thumb:** 
- API returns long keys → convert to short keys → query with short keys

### Xrefs (Cross-References)

Xrefs link elements across different models:

| Component | Size | Description |
|-----------|------|-------------|
| Model ID | 16 bytes | Which model the element is in |
| Element Key | 24 bytes | The element (long key with flags) |
| **Total** | **40 bytes** | Complete xref |

**Common xref columns:**
- `x:p` = `QC.XParent` - Parent (use this first!)
- `x:r` = `QC.XRooms` - Room
- `x:!r` = `QC.XORooms` - Room override

### Column Families

Tandem properties use `family:name` format:

| Family | Prefix | Contains |
|--------|--------|----------|
| Standard | `n:` | Built-in properties (name, category, flags) |
| DtProperties | `z:` | User-defined custom properties |
| Xrefs | `x:` | Cross-model references |
| Refs | `l:` | Same-model references |
| Tags | `t:` | Tags |

## Usage Patterns

### Pattern 1: Get Element Name (with override support)

```javascript
import { QC } from './sdk/dt-schema.js';

// Always check override first, then standard
const name = element[QC.OName]?.[0] || element[QC.Name]?.[0] || 'Unnamed';
```

### Pattern 2: Decode Stream Host

```javascript
import { ColumnFamilies, ColumnNames, QC } from './sdk/dt-schema.js';
import { decodeXref } from './sdk/keys.js';

// Get host reference (priority: parent > room)
const hostXref = stream[QC.XParent]?.[0] || stream[QC.XRooms]?.[0];

if (hostXref) {
  // Decode xref to get model and element
  const { modelURN, elementKey } = decodeXref(hostXref);
  
  // Fetch the host element
  const hosts = await getElementsByKeys(modelURN, [elementKey]);
  const host = hosts[0];
  
  // Get host name
  const hostName = host[QC.OName]?.[0] || host[QC.Name]?.[0];
}
```

### Pattern 3: Batch Process Elements by Model

```javascript
import { QC } from './sdk/dt-schema.js';
import { decodeXref } from './sdk/keys.js';

// Group xrefs by model URN
const xrefsByModel = new Map();

for (const stream of streams) {
  const hostXref = stream[QC.XParent]?.[0];
  if (hostXref) {
    const { modelURN, elementKey } = decodeXref(hostXref);
    
    if (!xrefsByModel.has(modelURN)) {
      xrefsByModel.set(modelURN, []);
    }
    xrefsByModel.get(modelURN).push({ xref: hostXref, elementKey });
  }
}

// Batch fetch per model (efficient!)
for (const [modelURN, items] of xrefsByModel.entries()) {
  const keys = items.map(item => item.elementKey);
  const elements = await getElementsByKeys(modelURN, keys);
  // Process elements...
}
```

## Integration with Your Project

### Quick Start

1. **Copy this entire `sdk/` directory to your project:**
   ```bash
   cp -r tandem-stats/sdk/ my-project/sdk/
   ```

2. **Import what you need:**
   ```javascript
   // In your JavaScript files
   import { ColumnFamilies, ColumnNames, ElementFlags, QC } from '../sdk/dt-schema.js';
   import { toShortKey, decodeXref } from '../sdk/keys.js';
   ```

3. **Use constants instead of magic strings:**
   ```javascript
   // ❌ BAD - hardcoded strings
   const name = element['n:n'];
   const category = element['n:c'];
   
   // ✅ GOOD - SDK constants
   const name = element[QC.Name];
   const category = element[QC.CategoryId];
   ```

### Best Practices

1. **Always use SDK constants** - Prevents typos, makes refactoring easier
2. **Cache decoded xrefs** - Decoding is expensive, reuse results when possible
3. **Batch queries by model** - Don't query elements one-by-one
4. **Check overrides first** - Many properties have override versions (e.g., `n:!n` before `n:n`)
5. **Convert keys at the right time** - Long → short when querying, not before

## Troubleshooting

### "Element not found" when querying

**Cause:** You're using a long key instead of a short key.

**Fix:**
```javascript
const shortKey = toShortKey(longKey);
const elements = await getElementsByKeys(modelURN, [shortKey]);
```

### "Invalid base64" errors

**Cause:** Keys/xrefs use URL-safe base64 (`-` and `_` instead of `+` and `/`).

**Fix:** This is handled internally by the SDK. Just use the functions as-is.

### Xref decode returns wrong model

**Cause:** You might be looking at a ref (`l:`) instead of an xref (`x:`).

**Fix:** 
- Refs are same-model, don't use `decodeXref()` on them
- Xrefs are cross-model, use `decodeXref()`

---

## Reference

For more details, see:
- [`AI_DEVELOPMENT_GUIDE.md`](../AI_DEVELOPMENT_GUIDE.md) - Comprehensive development guide
- [Official Tandem API Docs](https://aps.autodesk.com/en/docs/tandem/v1/developers_guide/overview/)
- [tandem-sample-rest-testbed](https://github.com/autodesk-tandem/tandem-sample-rest-testbed) - Reference implementation

**This SDK is the foundation for any Tandem application. Master these utilities, and the rest becomes much easier!**

