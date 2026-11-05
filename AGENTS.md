# AI Development Guide for Tandem Applications

**Target Audience:** Large Language Models assisting developers in building Tandem applications.

This guide provides essential context about the Autodesk Tandem REST API, common pitfalls, and reusable patterns from this codebase.

---

## Table of Contents

1. [Tandem API Overview](#tandem-api-overview)
2. [Critical Concepts](#critical-concepts)
3. [Common Pitfalls & Solutions](#common-pitfalls--solutions)
4. [Reusable Patterns](#reusable-patterns)
5. [Tandem API Reference](#tandem-api-reference)
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

This is the #1 source of confusion when working with Tandem. **It applies to schema V2 only**: schema V3 has a single 24-byte key (see section 7 below).

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
import { getLastSeenStreamValues } from '../api.js';
import { toShortKey } from '../tandem/keys.js';

...
const streamKeys = streams.map(s => s[QC.Key]);
const lastSeenValues = await getLastSeenStreamValues(facilityURN, streamKeys);
const result = {};

// API returns long key, but you need short key to query
for (const [longKey, value] of Object.entries(lastSeenValues)) {
  const shortKey = toShortKey(longKey);

  result[shortKey] = value;
}  
```

**When to convert:**
- ✅ Convert short → long when matching stream data (i.e. returned by `POST timeseries/models/{urn}/streams`)
- ✅ Convert long → xref when creating cross-model references
- ❌ Don't convert xrefs to short keys directly. Extract model + element key first, then element key → short

### 2. Xrefs (Cross-References)

**Xrefs** link elements across models. Format: `[16 bytes modelId][24 bytes elementKey]` (40 bytes total)
- Example: `mV4WfNj2TGK5posd80KtjQAAAAAFTj9PwGNI1aKw8A9xKDWoABmOdA`

**Use Cases:**
- Linking streams to their host rooms/spaces
- Linking elements to parent elements
- Cross-model relationships

**Column Names:**
- `x:p` (`QC.Parent`) - Parent xref (primary host reference)
- `x:r` (`QC.XRooms`) - Room xref (legacy)
- `x:!r` (`QC.OXRooms`) - Room xref override

**Decoding Xrefs:**
```javascript
import { QC } from '../tandem/constants.js';
import { decodeXref, toShortKey } from '../tandem/keys.js';

const hostXref = stream[QC.XParent]?.[0];  // Get parent xref
const decoded = decodeXref(hostXref);
// Returns: { modelURN: "urn:adsk.dtm:...", elementKey: "..." }

// Query element for details
const elements = await getElementsByKeys(decoded.modelURN, [decoded.elementKey]);
```

**Priority Order:** When looking for a stream's host, check in this order:
1. `QC.XParent` (Parent) - **Use this first** (matches Tandem UI behavior)
2. `QC.OXRooms` (Room override)
3. `QC.XRooms` (Room)

### 3. Column Families and Names

Tandem uses a **column-family database** structure. Properties are namespaced with `family:name` format.

**Column Families:**
- `n:` (`ColumnFamilies.Standard`) - Standard properties (name, category, flags, etc.)
- `z:` (`ColumnFamilies.DtProperties`) - DtProperties (user-defined custom properties)
- `x:` (`ColumnFamilies.XRefs`) - Xrefs (cross-model references)
- `l:` (`ColumnFamilies.Refs`) - Refs (same-model references)
- `m:` (`ColumnFamilies.Systems`) - Systems
- `r:` (`ColumnFamilies.Source`) - Source properties (extracted from model file)

**Common Columns:**
- `n:n` (`QC.Name`) - Name
- `n:!n` (`QC.OName`) - Name override (use this first if present)
- `n:c` (`QC.CategoryId`) - Category ID
- `n:a` (`QC.ElementFlags`) - Element flags
- `x:p` (`QC.XParent`) - Parent xref
- `l:p` (`QC.Parent`) - Parent ref (same model)
- `l:l` (`QC.Level`) - Level ref
- `k` (`QC.Key`) - Row key (the element's key)

**ALWAYS use pre-defined constants instead of hardcoding strings:**
```javascript
import { QC } from '../tandem/constants.js';

// ❌ BAD - hardcoded strings
const name = element['n:n'];
const override = element['n:!n'];

// ✅ GOOD - use pre-defined constants
const name = element[QC.OName] ?? element[QC.Name];
```

### 4. Element Flags

Elements have type flags in their keys, i.e.:
- `0x00000000` - Simple physical element
- `0x01000000` - Logical element (Level, FamilyType, etc.) in V2; Stream in V3
- `0x01000003` - Stream in V2 (`ElementFlags.StreamV2`), `ElementFlags.StreamV3` is 0x01000000
- `0x00000005` - Room (V2)
- `0x00000006` - Location: level or room in V3 (`ElementFlags.Location`)
- `0x01000005` - GenericAsset (V3)

See `tandem/constants.js` for full `ElementFlags` enum.

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

### 7. Schema Versions (V2 and V3)

Facilities exist in two schema versions that live side by side, and the app has a **V2 | V3 switch** in the header.
The Facility dropdown only lists facilities of the selected version (`schemaVersion` comes from the twin list).

**Rule: no version if/else in feature code.** Anything that depends on how a version stores data lives in `js/v2/` or `js/v3/`,
behind the interface documented in `js/shared/version.js`. The shared UI renders the normalized result, and reaches
version-specific behaviour through the delegates exported by `js/shared/version.js` (`toRowKey`, `viewAssetDetails`, `getTaggedAssetsDetails`).
Duplicated code between `v2/` and `v3/` is fine when the schemas differ; code that is identical belongs in `js/shared/`.

| Topic | V2 | V3 |
|-------|----|----|
| Keys | Scan rows use 20-byte short keys, other APIs return 24-byte long keys (`toShortKey` / `toFullKey` convert) | One kind of key: the 24-byte key, first 4 bytes are the `ElementFlags`. Never convert (`getKeyFlags` reads the flags) |
| Xrefs | 16-byte model id + 24-byte key | Same |
| Where logical elements live | Per model (levels, rooms) and default model (streams, tickets, systems) | All in the default model |
| Stream flag | `ElementFlags.StreamV2` (0x01000003) | `ElementFlags.StreamV3` (0x01000000) |
| Family type flag | `FamilyTypeV2` (0x01000000) | `FamilyTypeV3` (0x01000008) |
| Levels / rooms | `ElementFlags.Level` / `ElementFlags.Room`, one set per BIM model | `ElementFlags.Location` with `QC.TandemCategory` = `TC.Levels` / `TC.Rooms`; `QC.Parent` of a room is its level |
| Assets | BIM elements with `z:` properties (`n:ia` decides) | `ElementFlags.GenericAsset` elements with their own id, linked by `QC.HostOfAsset` / `QC.BimElmOfAsset` |

When you add a feature that reads these things, add the loader to **both** `v2/api.js` and `v3/api.js`, return the same shape, and expose it on the version module.

**Environments:** production is the default. Add `?env=stg` to the URL to use staging (remembered in localStorage, `?env=prod` goes back).
V3 facilities currently only exist in staging.

---

## Common Pitfalls & Solutions

### Pitfall 1: Using Long Keys to Query

**Problem:** API returns long keys, you try to use them directly in queries.

**Solution:** Convert to short keys first:
```javascript
const lastSeenValues = await getLastSeenStreamValues(facilityURN, streamKeys);
// elements has long keys as object keys

for (const [key, value] of Object.entries(lastSeenValues)) {
  const shortKey = toShortKey(key);

  result[shortKey] = value;
} 
```

### Pitfall 2: Forgetting URL-Safe Base64

**Problem:** Xrefs and keys are URL-safe base64 (use `-` and `_`, not `+` and `/`).

**Solution:** Always convert before using `atob()`:
```javascript
// In tandem/keys.js - already handled for you
let standardB64 = urlSafeB64.replace(/-/g, '+').replace(/_/g, '/');
while (standardB64.length % 4) standardB64 += '=';  // Add padding
const decoded = atob(standardB64);
```

### Pitfall 3: Hardcoding Column Names

**Problem:** Using magic strings like `'n:n'`, `'x:p'`.

**Solution:** Use pre-defined constants from `tandem/constants.js`:
```javascript
import { QC } from '../tandem/constants.js';

const nameCol = QC.Name;
const oNameCol = QC.OName;
```

### Pitfall 4: Not Prioritizing Overrides

**Problem:** Only checking standard properties, missing overrides.

**Solution:** Always check override columns first:
```javascript
const name = element[QC.OName]?.[0] ?? element[QC.Name]?.[0] ?? 'Unnamed';
//                      ↑ override first          ↑ standard second
```

### Pitfall 5: Wrong Host Reference Priority

**Problem:** Streams show wrong host room because you only checked `x:r`.

**Solution:** Check in this order:
```javascript
const hostRef = stream[QC.XParent]?.[0] ?? stream[QC.OXRooms]?.[0] ?? stream[QC.XRooms]?.[0];
//                        ↑ Parent first             ↑ Override second          ↑ Legacy last
```

### Pitfall 6: Fetching Schema Repeatedly

**Problem:** Fetching schema on every property lookup (slow, wasteful).

**Solution:** Cache schemas per model (see `js/shared/state/schemaCache.js`).

### Pitfall 7: Forgetting to Filter API Response

**Problem:** `/scan` endpoint returns `['v1', element1, element2, ...]` where first element is version string.

**Solution:** Filter it out:
```javascript
const data = await response.json();
const elements = data.filter(item => typeof item === 'object' && item !== null && item[QC.Key]);
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
import { SchemaVersion } from '../tandem/constants.js';

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
  if (info.schemaVersion < SchemaVersion) {
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
   import { SchemaVersion } from '../tandem/constants.js';

   // Always check before loading facility data
   if (info.schemaVersion < SchemaVersion) {
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

**Location:** `js/shared/auth.js`

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

### Pattern 3: API Wrapper with Headers

**Location:** `js/shared/api.js`

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

### Pattern 4: Batch Element Queries

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

### Pattern 5: Schema Caching

**Location:** `js/shared/state/schemaCache.js`

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

### Pattern 6: Converting Stream Data

**Location:** `js/shared/utils.js`

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

## Tandem API Reference

### `tandem/constants.js`

**Purpose:** Constants for Tandem database schema.

**Exports:**
- `ColumnFamilies` - e.g., `{ Standard: 'n', Xrefs: 'x', DtProperties: 'z' }`
- `ColumnNames` - e.g., `{ Name: 'n', OName: '!n', Parent: 'p' }`
- `ElementFlags` - e.g., `{ Stream: 0x01000003, Room: 0x00000005 }`
- `QC` - Pre-built qualified columns, e.g., `QC.Name = 'n:n'`, `QC.OName = 'n:!n'`

**Usage:**
```javascript
import { ColumnFamilies, ColumnNames, ElementFlags, QC } from '../tandem/constants.js';

// Method 1: Build dynamically
const nameCol = `${ColumnFamilies.Standard}:${ColumnNames.Name}`;

// Method 2: Use pre-built (cleaner!)
const name = element[QC.Name];
const overrideName = element[QC.OName];
```

### `tandem/keys.js`

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
tandem-sample-stats/
├── index.html                  # Main HTML entry point
├── tandem/                     # Reusable utilities (COPY THIS TO NEW PROJECTS)
│   ├── constants.js            # Column families, names, element flags
│   ├── keys.js                 # Key/xref conversion utilities
│   └── README.md               # Tandem utilities guide
├── js/
│   ├── app.js                  # ⭐ App shell: login, account/facility/version selectors, loads the version module
│   ├── shared/                 # Version-agnostic code (same for V2 and V3)
│   │   ├── config.js           # Environment configuration (prod/stg, ?env=stg)
│   │   ├── auth.js             # OAuth 3-legged PKCE flow
│   │   ├── api.js              # Tandem API wrappers that do not depend on the schema version
│   │   ├── version.js          # Registry of the active version module + delegates for shared UI code
│   │   ├── utils.js            # General utilities (unit formatting, type names)
│   │   ├── utils/
│   │   │   └── excelUtils.js   # Excel export helpers (xlsx-js-style)
│   │   ├── state/
│   │   │   └── schemaCache.js  # Schema caching pattern
│   │   ├── components/         # Toggle header, element list modal, stream config modal
│   │   └── features/           # The cards of the UI (models, levels, rooms, streams, tickets, systems, ...)
│   ├── v2/                     # Everything that depends on the V2 schema
│   │   ├── index.js            # Version module: loaders, toRowKey, viewAssetDetails
│   │   ├── api.js              # V2 loaders (streams, tickets, levels, rooms, systems, tagged assets)
│   │   └── features/
│   │       └── assetDetails.js # Asset details drilldown (standalone page, short/long keys)
│   └── v3/                     # Same interface, implemented for the V3 ("No-BIM") schema
│       ├── index.js
│       ├── api.js
│       └── features/
│           └── assetDetails.js
├── docs/
│   └── logical-element-scan-fix.md  # Deep dive: physical vs logical key scanning
├── AGENTS.md                   # This file (AI agent guide)
├── MIGRATION.md                # V2/V3 migration notes: what we did and why, running against STG
├── README.md                   # User documentation
├── QUICKSTART.md               # Quick setup guide
├── CODE_ORGANIZATION.md        # Shared components and patterns
├── BADGE_REFERENCE.md          # Stream config badge guide
├── TROUBLESHOOTING.md          # Troubleshooting guide
└── THIRD_PARTY_LICENSES.md     # Third-party library licenses
```

### What to Reuse in New Projects

**Always Copy:**
- ✅ `tandem/` directory - Core utilities
- ✅ `js/shared/auth.js` - OAuth implementation
- ✅ `js/shared/api.js` - API wrapper pattern
- ✅ `js/shared/config.js` - Environment config pattern

**Study & Adapt (Most Apps Need This):**
- ⭐ **Account/Facility Switching** from `js/app.js` - The logic is reusable, customize the UI
  - Functions: `populateAccountsDropdown()`, `populateFacilitiesDropdown()`, `loadFacility()`
  - Keep the data flow, change the presentation (dropdowns → cards, list, sidebar, etc.)

**Consider Copying:**
- `js/shared/state/schemaCache.js` - If you need property names
- `js/shared/utils.js` - General utilities (type names, unit formatting)
- Feature files as examples

**Customize:**
- `js/app.js` - Application-specific logic (beyond account/facility switching)
- `index.html` - UI layout and styling

---

## Development Workflow

### Starting a New Tandem Project

1. **Copy the utilities:**
   ```bash
   cp -r tandem-sample-stats/tandem/ my-new-project/tandem/
   ```

2. **Copy Auth & API:**
   ```bash
   cp tandem-sample-stats/js/shared/auth.js my-new-project/js/
   cp tandem-sample-stats/js/shared/api.js my-new-project/js/
   cp tandem-sample-stats/js/shared/config.js my-new-project/js/
   ```

3. **Update config.js:**
   - Replace `apsKey` with new client ID
   - Set `loginRedirect` to your redirect URI

4. **Import utilities:**
   ```javascript
   import { ColumnFamilies, ColumnNames, ElementFlags } from '../tandem/constants.js';
   import { decodeXref, toShortKey } from '../tandem/keys.js';
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
| Get user's groups (accounts) | `getGroups()` | `js/shared/api.js` |
| Get group's facilities | `getFacilitiesForGroup(groupURN)` | `js/shared/api.js` |
| Get facility info | `getFacilityInfo(facilityURN)` | `js/shared/api.js` |
| OAuth login | `login()` | `js/shared/auth.js` |
| Get access token | `getAccessToken()` | `js/shared/auth.js` |
| Convert long key → short key | `toShortKey(longKey)` | `tandem/keys.js` |
| Decode xref | `decodeXref(xref)` | `tandem/keys.js` |
| Get column name constants | Import from `tandem/constants.js` | `tandem/constants.js` |
| Query elements | `getElementsByKeys(modelURN, shortKeys)` | `js/shared/api.js` |
| Fetch schema | `loadSchemaForModel(modelURN)` | `js/shared/state/schemaCache.js` |
| Get property display name | `getPropertyDisplayName(modelURN, qualifiedProp)` | `js/shared/state/schemaCache.js` |
| Clear schema cache | `clearSchemaCache()` | `js/shared/state/schemaCache.js` |
| Check if default model | `isDefaultModel(facilityURN, modelURN)` | `js/shared/utils.js` |
| Get stream values | `getStreamValues(facilityURN, streamKey, daysBack)` | `js/shared/api.js` |

---

## Additional Resources

- [Tandem REST API Docs](https://aps.autodesk.com/en/docs/tandem/v1/developers_guide/overview/)
- [tandem-sample-rest-testbed](https://github.com/autodesk-tandem/tandem-sample-rest-testbed) - Reference implementation
- [tandem-sample-rest](https://github.com/autodesk-tandem/tandem-sample-rest) - Node.js examples

---

**Good luck with your Tandem development! If you encounter issues, consult this guide and the reference implementations. The patterns here have been battle-tested through real development.**
