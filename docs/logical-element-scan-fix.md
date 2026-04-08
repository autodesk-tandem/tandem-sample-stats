# Fixing Logical Element Lookups in the Tandem Scan Endpoint

## The Problem

When querying element properties via the `POST /modeldata/{modelURN}/scan` endpoint using **short keys** (20 bytes, no flag prefix), certain FamilyType elements returned incomplete or incorrect data — sometimes only 3 properties instead of the full set.

This affected two scenarios in the `tandem-sample-stats` app:

1. **Drilling down from Model History** — history entries reference elements by key. When the changed element was a FamilyType, the Asset Details page either showed 0 results or incomplete data.
2. **Viewing Type Properties via `l:t`** — expanding an element's details fetches its FamilyType via the `l:t` reference. Some Types returned only a handful of properties instead of the full set.

## Root Cause: The Scan Endpoint's Dual-Pass Key Resolution

The scan endpoint in `dt-server` stores elements using a **40-byte row key**: 16 bytes (model ID) + 4 bytes (key flags) + 20 bytes (element ID). Physical elements use flag `0x00000000`; logical elements (FamilyType, Level, Stream, etc.) use flag `0x01000000`.

When the caller provides a **20-byte short key** (no flags), the server doesn't know whether the element is physical or logical. It resolves this with a **dual-pass strategy**:

```
Pass 1: Assume physical (flags = 0x00000000), look up the row
         → If found, return it. Done.

Pass 2: Only if Pass 1 found nothing for that key,
         retry with logical (flags = 0x01000000).
```

The critical condition for the retry is:

```go
if len(guessedKeys) > 0 && err == nil && count != len(query.Keys) {
    // retry with logical flags
}
```

**The bug manifests when a physical element and a logical element share the same 20-byte element ID** (but have different 4-byte flag prefixes). In Tandem's storage model, this is a valid state — the flag bytes are part of the key, so `0x00000000|<20-byte-id>` and `0x01000000|<20-byte-id>` are distinct rows.

When this collision occurs:

1. Pass 1 finds the **physical** row → `count` matches `len(query.Keys)`
2. Pass 2 **never executes**
3. The caller receives the **physical element's data** instead of the intended **logical element's data**

The physical row often has very few properties (e.g., just `n:ia`, `z:xBA`, `z:wBA`), while the logical FamilyType row has the full set (name, category, classification, dozens of source properties, etc.).

## The Fix: Use Full Keys with Explicit Flags

When the caller **knows** they are looking for a logical element, they should provide a **24-byte full key** with the correct flag prefix. The scan endpoint handles 24-byte keys without any guessing:

```go
if len(eid) == 24 {
    key = string(modelID) + eid  // direct lookup, no dual-pass
}
```

### Where We Applied This

**1. `fetchTypeProperties` — looking up a FamilyType via `l:t`**

The `l:t` property stores a 20-byte short key referencing the element's FamilyType. Since we know this is always a logical element, we convert it before scanning:

```javascript
async function fetchTypeProperties(modelURN, typeKey) {
    const fullTypeKey = toFullKey(typeKey, true);  // true = logical flags
    const payload = JSON.stringify({
        families: ['n', 'l', 'x', 'r', 'z'],
        keys: [fullTypeKey],
        includeHistory: true
    });
    // ...
}
```

**2. `toggleElementDetails` — when the element itself IS a FamilyType**

When drilling down from Model History on a FamilyType element, the `n:a` (ElementFlags) property tells us it's logical. We convert the short key before fetching details:

```javascript
const scanKey = isType ? toFullKey(elementKey, true) : elementKey;
const elements = await fetchElementDetails(modelURN, [scanKey]);
```

**3. `ensureShortKey` — normalizing history keys for initial lookup**

The history API returns 24-byte full keys (because `useFullKeys: true`). The initial name/summary fetch (`fetchElementNames`) uses `qualifiedColumns`, which works with short keys via the dual-pass. We normalize to short keys at the entry point, then upgrade to full keys with correct flags when we need detailed data:

```javascript
function ensureShortKey(key) {
    let standardB64 = key.replace(/-/g, '+').replace(/_/g, '/');
    while (standardB64.length % 4) standardB64 += '=';
    const byteLength = atob(standardB64).length;
    if (byteLength === 24) {  // kElementIdWithFlagsSize
        return toShortKey(key);
    }
    return key;
}
```

## Key Conversion Functions

These utilities from `tandem/keys.js` handle the conversions:

| Function | Input | Output | Use When |
|----------|-------|--------|----------|
| `toShortKey(fullKey)` | 24-byte full key | 20-byte short key | Stripping flags for display or `qualifiedColumns` queries |
| `toFullKey(shortKey, isLogical)` | 20-byte short key + flag | 24-byte full key | Querying scan with explicit physical/logical targeting |

## Summary

| Scenario | Before (broken) | After (fixed) |
|----------|-----------------|---------------|
| Scan with short key for a FamilyType | Server guesses physical first; if a physical row exists with the same 20-byte ID, returns wrong data | Caller converts to full key with logical flags; server does direct lookup |
| History drill-down on a FamilyType | Full key from history passed directly; scan returns 0 results or wrong element | Normalized to short key, then upgraded to full key with logical flags |
| `l:t` Type Properties lookup | Short key passed directly; sometimes returns sparse physical row | Converted to full key with logical flags before scan |

**Rule of thumb:** Whenever you know you're looking for a logical element (FamilyType, Level, Stream, etc.), use `toFullKey(shortKey, true)` before calling the scan endpoint. This bypasses the dual-pass guessing entirely and guarantees the correct row is returned.
