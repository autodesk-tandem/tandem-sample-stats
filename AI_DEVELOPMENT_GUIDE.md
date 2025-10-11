# AI Development Guide for Tandem Applications

**Target Audience:** Large Language Models assisting developers in building Tandem applications.

This guide provides essential context about the Autodesk Tandem REST API, common pitfalls, and reusable patterns from this codebase.

---

## Table of Contents

1. [Tandem API Overview](#tandem-api-overview)
2. [Critical Concepts](#critical-concepts)
3. [Common Pitfalls & Solutions](#common-pitfalls--solutions)
4. [Reusable Patterns](#reusable-patterns)
5. [SDK Reference](#sdk-reference)
6. [File Organization](#file-organization)
7. [Development Workflow](#development-workflow)

---

## Tandem API Overview

### What is Tandem?

Autodesk Tandem is a digital twin platform for facility management. It stores:
- **Groups** - User accounts/teams (the UI calls these "Accounts")
- **Facilities/Twins** (`urn:adsk.dtt:...`) - Buildings/campuses within a group
- **Models** (`urn:adsk.dtm:...`) - 3D models within facilities
- **Elements** - Individual building components (walls, doors, equipment, etc.)
- **Streams** - IoT sensor data tied to elements
- **Properties** - Metadata and attributes on elements

**Terminology Note:** The API uses "groups" and "twins", but the Tandem UI calls them "accounts" and "facilities". This guide uses both terms interchangeably.

### API Architecture

```
Base URL: https://developer.api.autodesk.com/tandem/v1

Key Endpoints:
├── /groups                       # List user's groups (accounts/teams)
├── /groups/{groupURN}/twins      # List facilities (twins) in a group
├── /twins/{urn}                  # Facility information
├── /modeldata/{urn}/scan         # Query elements in a model
├── /modeldata/{urn}/schema       # Get property schema for a model
└── /timeseries/...               # Stream data
```

### Authentication

- **3-legged OAuth** with PKCE (not 2-legged!)
- Required scopes: `data:read data:write user-profile:read`
- Uses standard OAuth 2.0 authorization code flow
- Access tokens expire; use refresh tokens to renew

---

## Critical Concepts

### 1. Short Keys vs. Long Keys ⚠️ IMPORTANT

This is the #1 source of confusion when working with Tandem.

**Short Keys (20 bytes):**
- Just the element ID
- Used when **querying** elements (e.g., in `/scan` requests)
- Example: `7b5gM3RGD3FJCYUQppO6XEc`

**Long Keys (24 bytes):**
- Element ID + 4 bytes of flags (element type)
- Returned by the API in many responses
- Used in xrefs (cross-references)
- Example: `AAAAAF57M0gPcUkJhRCmk7pcRw` (4 flag bytes + 20 element bytes)

**Conversion:**
```javascript
import { toShortKey } from '../sdk/keys.js';

// API returns long key, but you need short key to query
const longKey = elementData.k;  // 24 bytes
const shortKey = toShortKey(longKey);  // 20 bytes

// Now you can query with the short key
const elements = await getElementsByKeys(modelURN, [shortKey]);
```

**When to convert:**
- ✅ Convert short → long when matching stream data (i.e. returned by `POST timeseries/models/{urn}/streams`)
- ✅ Convert long → xref when creating cross-model references
- ❌ Don't convert xrefs to short keys until you extract the element key portion

### 2. Xrefs (Cross-References)

**Xrefs** link elements across models. Format: `[16 bytes modelId][24 bytes elementKey]` (40 bytes total)
- Example: `mV4WfNj2TGK5posd80KtjQAAAAAFTj9PwGNI1aKw8A9xKDWoABmOdA`

**Use Cases:**
- Linking streams to their host rooms/spaces
- Linking elements to parent elements
- Cross-model relationships

**Column Names:**
- `x:p` - Parent xref (primary host reference)
- `x:r` - Room xref (legacy)
- `x:!r` - Room xref override

**Decoding Xrefs:**
```javascript
import { decodeXref, toShortKey } from '../sdk/keys.js';

const hostXref = stream['x:p']?.[0];  // Get parent xref
const decoded = decodeXref(hostXref);
// Returns: { modelURN: "urn:adsk.dtm:...", elementKey: "..." }

// Query element for details
const elements = await getElementsByKeys(decoded.modelURN, [decoded.elementKey]);
```

**Priority Order:** When looking for a stream's host, check in this order:
1. `x:p` (Parent) - **Use this first** (matches Tandem UI behavior)
2. `x:!r` (Room override)
3. `x:r` (Room)

### 3. Column Families and Names

Tandem uses a **column-family database** structure. Properties are namespaced with `family:name` format.

**Column Families:**
- `n:` - Standard properties (name, category, flags, etc.)
- `z:` - DtProperties (user-defined custom properties)
- `x:` - Xrefs (cross-model references)
- `l:` - Refs (same-model references)
- `m:` - Systems
- `s:` - Status
- `t:` - Tags

**Common Columns:**
- `n:n` - Name
- `n:!n` - Name override (use this first if present)
- `n:c` - Category ID
- `n:a` - Element flags
- `x:p` - Parent xref
- `l:p` - Parent ref (same model)
- `l:l` - Level ref
- `k` - Row key (the element's key)

**ALWAYS use SDK constants instead of hardcoding strings:**
```javascript
import { QC } from '../sdk/dt-schema.js';

// ❌ BAD - hardcoded strings
const name = element['n:n'];
const override = element['n:!n'];

// ✅ GOOD - use SDK constants
const name = element[QC.OName] ?? element[QC.Name];
```

### 4. Element Flags

Elements have type flags in their keys:
- `0x00000000` - Simple physical element
- `0x01000000` - Logical element (Level, FamilyType, etc.)
- `0x01000003` - Stream
- `0x00000005` - Room

See `sdk/dt-schema.js` for full `ElementFlags` enum.

### 5. Property Schemas

Properties are **model-specific**. To get human-readable names:

1. Fetch schema: `GET /modeldata/{modelURN}/schema`
2. Build lookup map: `qualifiedProp (e.g., "z:LQ") → { category, name, dataType, unit }`
3. Cache per model (schemas don't change often)

**Example:**
```javascript
import { loadSchemaForModel, getPropertyDisplayName } from './state/schemaCache.js';

// Load and cache schema for model
await loadSchemaForModel(modelURN);

// Convert z:LQ → "Streams.Temperature"
const displayName = await getPropertyDisplayName(modelURN, 'z:LQ');
```

### 6. Default Model

Each facility has a **default model** where the facility's base data lives. Its URN is the facility URN with a different prefix:
- Facility: `urn:adsk.dtt:xxxxx`
- Default Model: `urn:adsk.dtm:xxxxx` (same ID, different prefix)

```javascript
import { isDefaultModel } from './utils.js';

if (isDefaultModel(facilityURN, modelURN)) {
  // This is the main facility model
}
```
**Note** Always check if facility has default model. It is created by Tandem UI when needed i.e. when stream is created.

---

## Common Pitfalls & Solutions

### Pitfall 1: Using Long Keys to Query

**Problem:** API returns long keys, you try to use them directly in queries.

**Solution:** Convert to short keys first:
```javascript
const elements = await getLastSeenStreamValues(facilityURN, streamKeys);
// elements has long keys as object keys

// Convert to short keys
import { convertLongKeysToShortKeys } from './utils.js';
const elementsWithShortKeys = convertLongKeysToShortKeys(elements);
```

### Pitfall 2: Forgetting URL-Safe Base64

**Problem:** Xrefs and keys are URL-safe base64 (use `-` and `_`, not `+` and `/`).

**Solution:** Always convert before using `atob()`:
```javascript
// In sdk/keys.js - already handled for you
let standardB64 = urlSafeB64.replace(/-/g, '+').replace(/_/g, '/');
while (standardB64.length % 4) standardB64 += '=';  // Add padding
const decoded = atob(standardB64);
```

### Pitfall 3: Hardcoding Column Names

**Problem:** Using magic strings like `'n:n'`, `'x:p'`.

**Solution:** Use SDK constants from `sdk/dt-schema.js`:
```javascript
import { ColumnFamilies, ColumnNames } from '../sdk/dt-schema.js';

const nameCol = `${ColumnFamilies.Standard}:${ColumnNames.Name}`;
const oNameCol = `${ColumnFamilies.Standard}:${ColumnNames.OName}`;
```

### Pitfall 4: Not Prioritizing Overrides

**Problem:** Only checking standard properties, missing overrides.

**Solution:** Always check override columns first:
```javascript
const name = element['n:!n']?.[0] || element['n:n']?.[0] || 'Unnamed';
//                 ↑ override first    ↑ standard second
```

### Pitfall 5: Wrong Host Reference Priority

**Problem:** Streams show wrong host room because you only checked `x:r`.

**Solution:** Check in this order:
```javascript
const hostRef = stream['x:p']?.[0] || stream['x:!r']?.[0] || stream['x:r']?.[0];
//              ↑ Parent first      ↑ Override second   ↑ Legacy last
```

### Pitfall 6: Fetching Schema Repeatedly

**Problem:** Fetching schema on every property lookup (slow, wasteful).

**Solution:** Cache schemas per model (see `js/state/schemaCache.js`).

### Pitfall 7: Forgetting to Filter API Response

**Problem:** `/scan` endpoint returns `['v1', element1, element2, ...]` where first element is version string.

**Solution:** Filter it out:
```javascript
const data = await response.json();
const elements = data.filter(item => typeof item === 'object' && item !== null && item.k);
```

---

## Reusable Patterns

### Pattern 1: Account & Facility Switching ⭐ ESSENTIAL

**Location:** `js/app.js` (functions: `populateAccountsDropdown`, `populateFacilitiesDropdown`, `loadFacility`)

**Why This Matters:** Almost every Tandem application needs to:
1. Let users access their accounts/teams
2. Select which facility (building/campus) to work with
3. Load the facility's data once selected

This is the **gateway to all Tandem data**. Without it, your app can only work with hardcoded facilities.

**The Logic (Reusable):**

```javascript
// Step 1: Fetch user's groups (called "accounts" or "teams" in the UI)
const groups = await getGroups();

// Step 2: Fetch facilities (twins) for each group
const groupsWithFacilities = await Promise.all(
  groups.map(async (group) => {
    const facilities = await getFacilitiesForGroup(group.urn);
    return {
      ...group,
      facilities: facilities
    };
  })
);

// Step 3: Let user select account, then facility
// (UI can be dropdown, list, cards, whatever you want)

// Step 4: When facility selected, load its data
async function loadFacility(facilityURN) {
  // Get facility info (name, schema version, etc.)
  const info = await getFacilityInfo(facilityURN);
  
  // Check schema version compatibility
  if (info.schemaVersion !== 2) {
    showError('This facility needs to be upgraded in Tandem first');
    return;
  }
  
  // Get default model URN (facility URN with 'dtm' prefix)
  const defaultModelURN = facilityURN.replace('urn:adsk.dtt:', 'urn:adsk.dtm:');
  
  // Store in app state
  currentFacility = { urn: facilityURN, info, defaultModelURN };
  
  // Now fetch facility-specific data (rooms, streams, etc.)
  await loadRooms(facilityURN);
  await loadStreams(facilityURN);
  // ... etc
}
```

**Key Features to Preserve:**

1. **Alphabetical Sorting:**
   ```javascript
   const sortedAccounts = [...accounts].sort((a, b) => 
     a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
   );
   ```

2. **Handle "SHARED DIRECTLY" account:**
   ```javascript
   // This special account should appear at the bottom
   const sortedAccounts = [...accounts].sort((a, b) => {
     const sharedDirectlyName = '** SHARED DIRECTLY **';
     if (a.name === sharedDirectlyName) return 1;
     if (b.name === sharedDirectlyName) return -1;
     return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
   });
   ```

3. **Remember Last Selection:**
   ```javascript
   // Save to localStorage
   localStorage.setItem('lastAccount', accountId);
   localStorage.setItem('lastFacility', facilityURN);
   
   // Restore on page load
   const lastAccount = localStorage.getItem('lastAccount');
   const lastFacility = localStorage.getItem('lastFacility');
   ```

4. **Schema Version Check:**
   ```javascript
   // Always check before loading facility data
   if (info.schemaVersion !== 2) {
     // Don't try to load - will fail or return invalid data
     showIncompatibilityWarning();
     return;
   }
   ```

**UI Flexibility:**

The core logic is separate from UI. This project uses dropdowns, but you could easily adapt to:
- **Side panel with searchable lists**
- **Modal dialogs**
- **Breadcrumb navigation**
- **Card-based selection**

Just keep the same data flow:
```
Fetch Accounts → Group Facilities → User Selection → Load Facility → Clear Cache → Fetch Data
```

**Don't Forget:**
- Clear schema cache when switching facilities: `clearSchemaCache()`
- Update UI state (show/hide sections based on facility loaded)
- Handle errors gracefully (facility might be deleted, permissions changed)

**Common Customizations:**
- Filter facilities (e.g., only show certain types)
- Add search/filter UI for large facility lists
- Show facility thumbnail images
- Display facility metadata (location, size, etc.)
- Add "recent facilities" quick access

This pattern is production-tested and handles edge cases like shared facilities, missing permissions, and schema compatibility.

### Pattern 2: OAuth Authentication

**Location:** `js/auth.js`

**Key Functions:**
- `login()` - Initiates PKCE flow
- `checkAuthentication()` - Handles callback with authorization code
- `getAccessToken()` - Returns current token, refreshes if expired
- `logout()` - Clears session

**Usage:**
```javascript
import { isLoggedIn, login, getAccessToken } from './auth.js';

if (!isLoggedIn()) {
  await login();
}

const token = await getAccessToken();
// Use token in API calls
```

### Pattern 2: API Wrapper with Headers

**Location:** `js/api.js`

**Pattern:** All API calls use consistent headers with retry logic.

```javascript
async function makeAuthenticatedRequest(url, options = {}) {
  const token = await getAccessToken();
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    ...options.headers
  };
  
  const response = await fetch(url, { ...options, headers });
  
  if (response.status === 401) {
    // Token expired, try to refresh
    await getAccessToken(true); // Force refresh
    return makeAuthenticatedRequest(url, options); // Retry
  }
  
  return response;
}
```

### Pattern 3: Batch Element Queries

**Problem:** Need to fetch many elements efficiently.

**Pattern:**
```javascript
// Group by model URN first
const elementsByModel = new Map();
for (const item of items) {
  const decoded = decodeXref(item.xref);
  if (!elementsByModel.has(decoded.modelURN)) {
    elementsByModel.set(decoded.modelURN, []);
  }
  elementsByModel.get(decoded.modelURN).push({
    xref: item.xref,
    shortKey: toShortKey(decoded.elementKey)
  });
}

// Fetch elements in batches per model
for (const [modelURN, items] of elementsByModel.entries()) {
  const shortKeys = items.map(item => item.shortKey);
  const elements = await getElementsByKeys(modelURN, shortKeys);
  // Process elements...
}
```

### Pattern 4: Schema Caching

**Location:** `js/state/schemaCache.js`

**Pattern:**
```javascript
const schemaCache = {};  // Global cache

export async function loadSchemaForModel(modelURN) {
  if (schemaCache[modelURN]) {
    return schemaCache[modelURN];  // Cache hit
  }
  
  const schema = await getSchema(modelURN);
  
  // Build lookup map
  const lookup = new Map();
  schema.attributes.forEach(attr => {
    lookup.set(attr.id, attr);  // e.g., "z:LQ" → { category, name, ... }
  });
  
  schemaCache[modelURN] = { attributes: schema.attributes, lookup };
  return schemaCache[modelURN];
}

// Clear cache when switching facilities
export function clearSchemaCache() {
  for (const key in schemaCache) delete schemaCache[key];
}
```

### Pattern 5: Converting Stream Data

**Location:** `js/utils.js`

**Pattern:** API returns stream last-seen values with long keys, but elements use short keys.

```javascript
export function convertLongKeysToShortKeys(data) {
  const result = {};
  for (const [longKey, value] of Object.entries(data)) {
    const shortKey = toShortKey(longKey);
    result[shortKey] = value;
  }
  return result;
}
```

---

## SDK Reference

### `sdk/dt-schema.js`

**Purpose:** Constants for Tandem database schema.

**Exports:**
- `ColumnFamilies` - e.g., `{ Standard: 'n', Xrefs: 'x', DtProperties: 'z' }`
- `ColumnNames` - e.g., `{ Name: 'n', OName: '!n', Parent: 'p' }`
- `ElementFlags` - e.g., `{ Stream: 0x01000003, Room: 0x00000005 }`
- `QC` - Pre-built qualified columns, e.g., `QC.Name = 'n:n'`, `QC.OName = 'n:!n'`

**Usage:**
```javascript
import { ColumnFamilies, ColumnNames, ElementFlags, QC } from '../sdk/dt-schema.js';

// Method 1: Build dynamically
const nameCol = `${ColumnFamilies.Standard}:${ColumnNames.Name}`;

// Method 2: Use pre-built (cleaner!)
const name = element[QC.Name];
const overrideName = element[QC.OName];
```

### `sdk/keys.js`

**Purpose:** Utilities for key and xref manipulation.

**Exports:**

#### `toShortKey(fullKey)`
Converts 24-byte long key to 20-byte short key.
```javascript
const shortKey = toShortKey(longKey);
```

#### `decodeXref(xref)`
Extracts model URN and element key from xref.
```javascript
const { modelURN, elementKey } = decodeXref(xref);
const shortKey = toShortKey(elementKey);  // Convert to short for querying
```

#### `makeXrefKey(modelURN, elemKey)`
Creates an xref from components (inverse of decodeXref).
```javascript
const xref = makeXrefKey(modelURN, elementKey);
```

#### `fromXrefKeyArray(text)`
Parses multiple xrefs from base64 string.
```javascript
const [modelKeys, elementKeys] = fromXrefKeyArray(xrefsB64);
```

---

## File Organization

```
tandem-stats/
├── index.html                   # Main HTML entry point
├── sdk/                         # Reusable SDK utilities (COPY THIS TO NEW PROJECTS)
│   ├── dt-schema.js            # Column families, names, element flags
│   └── keys.js                 # Key/xref conversion utilities
├── js/
│   ├── config.js               # Environment configuration (prod/stg)
│   ├── auth.js                 # OAuth 3-legged PKCE flow
│   ├── api.js                  # Tandem API wrappers
│   ├── app.js                  # ⭐ Main app logic - includes account/facility switching pattern
│   ├── utils.js                # General utilities (unit formatting, type names)
│   ├── state/
│   │   └── schemaCache.js      # Schema caching pattern
│   ├── components/
│   │   └── toggleHeader.js     # Reusable toggle component
│   └── features/               # Feature-specific code
│       ├── diagnostics.js      # Schema diagnostics
│       ├── documents.js        # Document listing
│       ├── levels.js           # Level listing
│       ├── models.js           # Model listing
│       ├── rooms.js            # Room statistics
│       ├── schema.js           # Schema viewer
│       ├── streams.js          # Stream monitoring with charts
│       └── taggedAssets.js     # Tagged assets
├── AI_DEVELOPMENT_GUIDE.md     # This file
├── README.md                   # User documentation
└── QUICKSTART.md               # Quick setup guide
```

### What to Reuse in New Projects

**Always Copy:**
- ✅ `sdk/` directory - Core utilities
- ✅ `js/auth.js` - OAuth implementation
- ✅ `js/api.js` - API wrapper pattern
- ✅ `js/config.js` - Environment config pattern

**Study & Adapt (Most Apps Need This):**
- ⭐ **Account/Facility Switching** from `js/app.js` - The logic is reusable, customize the UI
  - Functions: `populateAccountsDropdown()`, `populateFacilitiesDropdown()`, `loadFacility()`
  - Keep the data flow, change the presentation (dropdowns → cards, list, sidebar, etc.)

**Consider Copying:**
- `js/state/schemaCache.js` - If you need property names
- `js/utils.js` - General utilities (type names, unit formatting)
- Feature files as examples

**Customize:**
- `js/app.js` - Application-specific logic (beyond account/facility switching)
- `index.html` - UI layout and styling

---

## Development Workflow

### Starting a New Tandem Project

1. **Copy the SDK:**
   ```bash
   cp -r tandem-stats/sdk/ my-new-project/sdk/
   ```

2. **Copy Auth & API:**
   ```bash
   cp tandem-stats/js/auth.js my-new-project/js/
   cp tandem-stats/js/api.js my-new-project/js/
   cp tandem-stats/js/config.js my-new-project/js/
   ```

3. **Update config.js:**
   - Replace `apsKey` with new client ID
   - Set `loginRedirect` to your redirect URI

4. **Import SDK utilities:**
   ```javascript
   import { ColumnFamilies, ColumnNames, ElementFlags } from '../sdk/dt-schema.js';
   import { decodeXref, toShortKey } from '../sdk/keys.js';
   ```

5. **Follow the patterns above for common tasks.**

### Testing Tips

- Use `http://localhost:8000` for consistency (match redirect URI)
- Check browser DevTools Network tab for API responses
- Look for 401 errors (token expired)
- Verify element keys match expected format (20 or 24 bytes in base64)

### Debugging Element Keys

```javascript
// Check if it's a short key or long key
const keyBytes = atob(key.replace(/-/g, '+').replace(/_/g, '/')).length;
console.log(`Key length: ${keyBytes} bytes (${keyBytes === 20 ? 'short' : keyBytes === 24 ? 'long' : 'unexpected'})`);

// Decode a long key to see the flags
const bytes = new Uint8Array(atob(key.replace(/-/g, '+').replace(/_/g, '/')).split('').map(c => c.charCodeAt(0)));
const flags = (bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3];
console.log(`Flags: 0x${flags.toString(16).padStart(8, '0')}`);
```

---

## Quick Reference Card

| Task | Solution | File |
|------|----------|------|
| **Account/Facility switching** ⭐ | See Pattern 1 in Reusable Patterns | `js/app.js` |
| Get user's groups (accounts) | `getGroups()` | `js/api.js` |
| Get group's facilities | `getFacilitiesForGroup(groupURN)` | `js/api.js` |
| Get facility info | `getFacilityInfo(facilityURN)` | `js/api.js` |
| OAuth login | `login()` | `js/auth.js` |
| Get access token | `getAccessToken()` | `js/auth.js` |
| Convert long key → short key | `toShortKey(longKey)` | `sdk/keys.js` |
| Decode xref | `decodeXref(xref)` | `sdk/keys.js` |
| Get column name constants | Import from `sdk/dt-schema.js` | `sdk/dt-schema.js` |
| Query elements | `getElementsByKeys(modelURN, shortKeys)` | `js/api.js` |
| Fetch schema | `loadSchemaForModel(modelURN)` | `js/state/schemaCache.js` |
| Get property display name | `getPropertyDisplayName(modelURN, qualifiedProp)` | `js/state/schemaCache.js` |
| Clear schema cache | `clearSchemaCache()` | `js/state/schemaCache.js` |
| Check if default model | `isDefaultModel(facilityURN, modelURN)` | `js/utils.js` |
| Get stream values | `getStreamValues(facilityURN, streamKey, daysBack)` | `js/api.js` |

---

## Additional Resources

- [Tandem REST API Docs](https://aps.autodesk.com/en/docs/tandem/v1/developers_guide/overview/)
- [tandem-sample-rest-testbed](https://github.com/autodesk-tandem/tandem-sample-rest-testbed) - Reference implementation
- [tandem-sample-rest](https://github.com/autodesk-tandem/tandem-sample-rest) - Node.js examples

---

**Good luck with your Tandem development! If you encounter issues, consult this guide and the reference implementations. The patterns here have been battle-tested through real development.**

