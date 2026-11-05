# Migration to the V3 ("No-BIM") schema

This document records how `tandem-sample-stats` was migrated to support the V2 and V3 data schemas side by side, why each decision was made, and what we learned along the way. It is written for people who migrate other Tandem apps and samples.

Related documents:
- [`docs/tandem-v3-upgrade-plan.md`](docs/tandem-v3-upgrade-plan.md) - general plan and AI-assisted research on V3 (wiki draft).
- `MIGRATION.md` in `tutorial-rest` (Jan's notes) - the same migration for the Node.js REST samples. The constants and key utilities here are taken from that project.
- [`AGENTS.md`](AGENTS.md) - section "7. Schema Versions (V2 and V3)" is the short version of this document for AI assistants.

**Status:** work in progress on branch `jma-v3-migration`. Do not merge to `main` yet (see [Branch and deployment](#branch-and-deployment)).

---

## 1. Running the app against STG

V3 facilities currently exist only in staging, so testing V3 means running the app locally against STG.

1. **Get the branch**
   ```bash
   git clone -b jma-v3-migration https://github.com/autodesk-tandem/tandem-sample-stats.git
   cd tandem-sample-stats
   ```
   (or `git fetch && git checkout jma-v3-migration` in an existing clone).

2. **Serve it on port 8000.** The port matters, see below.
   ```bash
   python3 -m http.server 8000
   ```
   or `npx http-server -p 8000`. There is no build step.

3. **Open `http://localhost:8000/?env=stg`.** A yellow **STG** badge appears in the header. The choice is remembered in `localStorage`; use `?env=prod` to go back.

4. **Sign in** with an Autodesk **staging** account that has access to a V3 facility, then use the **V2 | V3** switch next to the Account and Facility selectors.

**Is the staging Client ID in the config?** Yes. `js/shared/config.js` contains an `apsKey` for staging and one for production. The app uses OAuth 3-legged with PKCE, so a Client ID is public by design (there is no secret), the same as the production one that was already committed. You do not need to create an APS app to try the app locally.

**The port must be 8000.** The OAuth callback is built from the port of the page (`http://localhost:<port>`) and the staging Client ID has `http://localhost:8000` registered. Any other port ends with an APS error such as `invalid redirect_uri`.

**Using your own Client ID instead:** create an APS app (Data Management + Tandem APIs, PKCE), register `http://localhost:8000` as callback, and replace `apsKey` of the `stg` environment in `js/shared/config.js`. Do not commit a secret; a PKCE app does not have one.

**Where V3 facilities show up:** the Facility dropdown only lists facilities of the selected version. An account with no facility of that version stays in the Account list and shows "No V3 facilities". If you do not see a V3 facility you expect, check that you are in STG and that the facility really has schema version 3 (shown under *Facility Information*).

### Staging specifics already handled in the code

| Topic | What staging does | What the app does |
|-------|-------------------|-------------------|
| API host | `https://tandem-stg.autodesk.com/api/v1` rejects the `Region` header in the CORS preflight, so every call from a browser fails | Uses the APS gateway `https://developer-stg.api.autodesk.com/tandem/v1`, like prod uses `developer.api.autodesk.com` |
| OAuth endpoints | Staging tokens come from `developer-stg.api.autodesk.com` | `auth.js` builds the authorize and token URLs from `env.apsHost` |
| Regions | Staging has no AUS region and answers 400 for it | `getFacilitiesForGroup` uses `Promise.allSettled` and skips regions that fail |
| User profile (avatar) | The production profile service rejects staging tokens (401) | `userProfileUrl` is `null` for staging, and a failed profile call never blocks login |
| Switching env | A token of one environment is not valid in the other | Switching with `?env=` clears the session tokens |

---

## 2. What we did and why

### Goals
- A **V2 | V3 switch** in the header. The Facility dropdown shows only facilities of the selected version, and toggling reloads the dropdown and the loaded facility.
- **No version if/else in feature code.** Everything that depends on how a version stores data lives in `js/v2/` or `js/v3/`. Duplication between the two is accepted where the schemas differ. Code that is identical lives in `js/shared/`.
- **Same UI for both versions.** The cards look the same, but are populated from the structure of each version's data.
- **Reuse Jan's constants and utilities** from `tutorial-rest`, so that all samples share the same names.

`tandem-sample-stats` is a user tool, so the code is optimized for UX and brevity. The testbed samples (`tandem-sample-rest-testbed`, `tandem-sample-portfolio`) are teaching tools: when they are migrated, the code must stay teachable and the UI must stay transparent about what the API calls do. That is why some patterns here (a module registry, delegates) are lighter than they would be in a teaching sample.

### Architecture

```
js/
├── app.js            App shell: login, account / facility / version selectors; loads the version module
├── shared/           Version-agnostic code (auth, config, generic API calls, all UI cards)
│   └── version.js    Registry of the active version module + delegates for shared UI
├── v2/               V2 loaders (streams, tickets, levels, rooms, systems, tagged assets) + asset details page
└── v3/               The same interface for V3
```

- **Version module interface.** Each of `v2/index.js` and `v3/index.js` exports `{ schemaVersion, label, minSchemaVersion, loaders, toRowKey, viewAssetDetails }`. `app.js` loads the module with a dynamic `import()` when the version is selected. It is documented at the top of `js/shared/version.js`.
- **Delegates.** Shared UI never imports from `v2/` or `v3/`. When it needs version-specific behaviour it calls a delegate exported by `shared/version.js`: `toRowKey`, `viewAssetDetails`, `getTaggedAssetsDetails`.
- **Loaders return the same shape in both versions**, so a card renders either one. When you add a feature that reads version-dependent data, add the loader to **both** `v2/api.js` and `v3/api.js`.
- **`toRowKey`** is the answer to the short key / long key difference (section 3): V2 converts a 24-byte key to the 20-byte short key that scan rows use, V3 returns the key unchanged. Shared code that matches data from different APIs calls it instead of converting keys itself.
- **`assetDetails.js` is a standalone page.** It is generated as an HTML string and embeds helper functions with `.toString()`. Each version therefore has its own copy, and the functions it embeds must stay self-contained (no imports). Fixes to this page usually have to be made in both copies.
- **Environments.** `js/shared/config.js` defines `prod` and `stg`. `?env=stg|prod` selects one, it is remembered in `localStorage`, and the STG badge is shown for anything other than prod.
- **Deep links.** A link from `tandem-sample-portfolio` opens the facility with the version of that facility (`ensureFacilitiesLoaded` + `switchVersion`).
- **Last selection is remembered per account and version** (`${accountName}#v${version}`).

### Constants and key utilities (`tandem/`)
- `tandem/constants.js` is Jan's `tutorial-rest/common/constants.js`. It adds `Location`, `FamilyTypeV2/V3`, `StreamV2/V3`, `BimElmOfAsset`, `HostOfAsset`, the Status family (`Deleted`, `ODeleted`), `TC` (Tandem categories), `RC` and `SchemaVersion`. The old `ElementFlags.Stream` is now `StreamV2` (V3: `StreamV3`).
- One addition on top of Jan's file: `AttributeContext.Facility: 'f'`, which this app uses and his file does not have. Please add it upstream so the files stay identical.
- `tandem/keys.js` gained `getKeyFlags(fullKey)`, which reads the 4 flag bytes of a 24-byte key. Because V3 keys carry the real `ElementFlags`, the type of a scan row can be read from its key alone.
- Jan's predicates (`isLevel`, `isRoom`, `isStream`, ...) check against a global `SchemaVersion` and expect scalar values (his client scans with `skipArrays`). This app's scans return arrays (`row[QC.X]?.[0]`) and must serve both versions at once, so the version-specific checks are inline in `v2/api.js` and `v3/api.js`.

---

## 3. What differs in V3 (and how the code handles it)

| Topic | V2 | V3 | Where handled |
|-------|----|----|---------------|
| Keys | Scan rows use 20-byte short keys, other APIs return 24-byte long keys | One key everywhere: 24 bytes, the first 4 are the `ElementFlags`. Never convert | `toRowKey` delegate |
| Xrefs | 16-byte model id + 24-byte key | Same | `decodeXref`, `makeXrefKey` |
| Logical elements | Per model (levels, rooms) and default model (streams, tickets, systems) | **All in the default model** | `v3/api.js` scans only the default model |
| Stream flag | `StreamV2` 0x01000003 | `StreamV3` 0x01000000 | `v2/api.js`, `v3/api.js` |
| Family type flag | `FamilyTypeV2` 0x01000000 | `FamilyTypeV3` 0x01000008 | per version |
| Levels and rooms | `ElementFlags.Level` / `Room`, one set per BIM model | `ElementFlags.Location` + `QC.TandemCategory` = `TC.Levels` / `TC.Rooms`. A room's `QC.Parent` is its level | `v3/api.js` |
| Room area, volume, room vs space | On the room element | Not on the Location. Read from the source BIM element through `QC.BimElmOfAsset` | `v3/api.js` `getRooms` |
| Assets | BIM elements with `z:` properties (`n:ia` decides) | `ElementFlags.GenericAsset` elements in the default model with their own id, linked to the BIM element | `v3/api.js` `getTaggedAssetsDetails` |
| Deleted | `n:a` flag handling as before | Status family: `s:e` (`QC.Deleted`), overridden by `s:!e` (`QC.ODeleted`); the override wins | `isDeleted` in `v3/api.js` |
| Systems | System id from the element key | `toSystemId(key)` directly; membership is scanned across all models | `v3/api.js` |

### Asset <-> BIM element links
- The asset in the default model holds the user-defined `z:` properties and points to the Revit element with **`x:be`** (`QC.BimElmOfAsset`).
- The BIM element points back with **`x:ha`** (`QC.HostOfAsset`).
- Both are 40-byte xrefs. The server only returns `x:ha` when the request asks for the `x` family (or that column).
- The asset details page shows both as links, so you can go from a BIM element to its asset and back.

### Soft-deleted source rooms and levels
When the LBS (Location Breakdown Structure) is created, every BIM room and level is mirrored as a `Location` in the default model, and the source rows are **soft-deleted** in their own model. This is expected behaviour. Consequences:
- A scan hides deleted rows unless the request sends `includeDeleted: true`. Following `x:be` from a Location to its source room needs it.
- The details page now shows a **Deleted** badge and a banner when it displays a soft-deleted element (it requests the Status family and reads `s:!e` before `s:e`).
- The room list reads area and volume from those deleted source rows, so that scan uses `includeDeleted: true` too.

---

## 4. Problems we hit and what fixed them

These cost the most time. Check for them first in your own migration.

1. **`x:be` and `x:ha` are typed as a single same-model key in the schema, but hold a 40-byte xref.** Following them as a 24-byte key produced "Referenced element not found". Decide how to follow a reference from the **column family** (`x:` = xref), not from the schema data type. Fixed in `v3/features/assetDetails.js`.
2. **Deleted rows are hidden by default.** See above. Add `includeDeleted: true` where you follow references to elements that may be deleted.
3. **Staging CORS.** The direct staging host rejects the `Region` header. Use the APS gateway URL (section 1).
4. **Unavailable regions.** One failing region (staging answers 400 for AUS) must not hide the others. Use `Promise.allSettled`.
5. **Production profile service rejects staging tokens.** Never make the avatar call fatal.
6. **Double HTML escaping in the asset details page** (V2 and V3). Property values were escaped when the list was built and again when it was drawn, so Revit values such as `<0' - 1 1/2">` showed as `&lt;0' - 1 1/2"&gt;` and landed in the Excel export that way. Values are now kept as plain text and escaped once, at render time.
7. **Flag values are reused between versions.** `0x01000000` is a family type in V2 and a stream in V3. Never compare against a flag without knowing the version. Keep version-specific flags in `v2/` or `v3/`.
8. **Redirect port.** The callback follows the page's port. Serve on the port that is registered (8000).
9. **`getModels` returns `facilityInfo.links`**, which can be `null`. Guard it (`models?.find`).

---

## 5. Status

**Seen working in a real STG V3 facility:** login, switch and facility filtering, facility information, models, levels, room list, asset details page, the asset <-> BIM element links (including soft-deleted source rooms), the deleted badge and banner.

**Not yet verified against real V3 data (assumptions):**
- Tagged assets count and details, streams, tickets, systems.
- The Rooms card: the room/space split and area and volume (read from the source BIM element, which is soft-deleted).
- History, Users, Views, Parameters buttons and the Excel exports on V3 (`getFacilityParameters` assumes the `DocumentRoot` flag is unchanged).
- Whether BIM elements in V3 still carry `m:` (systems) or `z:` columns, which would double count system membership.
- Stream hosts and ticket parents that point into a BIM model: they are followed without `includeDeleted`.
- The format of `l:` references (assumed 24-byte keys).
- The date shown in the deleted banner is the time the delete was written (history timestamp of the Status column).
- The V2 side was only regression-tested lightly after the restructure (module loading and the switch with mocked data, and a real PROD login and facility load).

**Open questions for the Tandem team:**
- Why a link to a soft-deleted source room needed `includeDeleted: true` in our setup: confirm this is the intended way to follow it.
- The staging user-profile endpoint (avatar), if there is one.

---

## 6. Checklist for migrating another app

1. Copy `tandem/constants.js` and `tandem/keys.js` from this project (they include Jan's constants plus `getKeyFlags`), and keep them identical across samples.
2. Decide how the app learns the schema version of a facility (the twin list returns `schemaVersion`) and whether it needs a switch like this one or only one version.
3. Move everything that touches element flags, key handling, or where logical elements live behind a small per-version module. Do not branch on the version inside feature code.
4. Replace key conversions with the single V3 key (`getKeyFlags` instead of `toShortKey`/`toFullKey`).
5. Read levels, rooms, streams, tickets and assets from the **default model** in V3. Take room area and volume from the source element.
6. Follow cross-model references by decoding the xref (`decodeXref`), choose the model, and scan with `includeDeleted: true` when the target may be soft-deleted.
7. Point staging at `developer-stg.api.autodesk.com`, make regions failure-tolerant, and make non-essential calls (profile) non-fatal.
8. Test with a V3 facility in STG, and with a V2 facility in prod to check for regressions.

For the testbed (teaching) samples, keep the version-specific code easy to read: prefer an explicit, commented V2 and V3 example next to each other over indirection, and keep the UI showing which API call produces what.

---

## Branch and deployment

Work lives on the branch **`jma-v3-migration`** and is deliberately **not merged to `main`**. A pull request into `main` triggers a deployment to the public GitHub Pages site, and V3 is not ready to go public. Run the app from this branch as described in section 1. The repository has no CI workflow, and GitHub Pages is set up to deploy from `main`, so pushing this branch does not deploy it.
