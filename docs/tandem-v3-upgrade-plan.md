# Tandem Data Schema V3 ("No-BIM"): Upgrade Plan for API Consumers

*Status: DRAFT for review. Prepared 2026-10-29.*

*Part 1 to Part 4 are the plan. Appendix A holds the detailed findings, and it is AI-assisted research that needs verification by the owning teams (see the banner there).*

---

## Table of contents

1. [Problem statement and executive summary](#part-1-problem-statement-and-executive-summary)
2. [General plan for any Tandem Data API user](#part-2-general-plan-for-any-tandem-data-api-user)
3. [Details for specific apps](#part-3-details-for-specific-apps)
4. [Open questions](#part-4-open-questions)
5. [Appendix A: AI-assisted research](#appendix-a-ai-assisted-research)

---

## Part 1. Problem statement and executive summary

### The problem

Tandem is changing its data schema from V2 to **V3** (also called **No-BIM** in code and comments). When V3 is released, customers will be prompted to upgrade their existing facilities. The upgrade is **one-way**, runs **one facility at a time**, and locks the facility for a few minutes.

Anything that reads or writes facility data through the Tandem Data API, and has not been updated first, can break or quietly return wrong data once a facility moves to V3. That includes:

- The sample apps (`tandem-sample-stats`, `tandem-sample-portfolio`, `tandem-sample-rest-testbed`, `tandem-sample-emb-viewer`) and the `tutorial-rest` examples that customers copy from.
- **Tandem Connect**, and every customer integration built on it. Each of those integrations is effectively a separate product that can break.
- Any customer script or tool that calls the API.

### What V3 does, in brief

1. **Assets become their own records.** Today, the custom properties a customer adds to an asset are stored on the BIM element inside the model. In V3 they move to a new asset record in the facility's default model. The asset and the BIM element are linked to each other.
2. **A Location Breakdown Structure (LBS) replaces level and room references.** Levels and rooms are rebuilt as facility-level locations.
3. **Facilities no longer need a BIM model.** This is what "No-BIM" means. A facility can have assets and locations without any model.

### What is at stake for an unmodified app

- **Missing, miscounted or mis-attributed assets.** The asset is a separate record with its own new key in the default model. The BIM element no longer holds the customer's properties, and its `n:ia` flag is set to false. The new asset does not get `n:ia` set at all. Code that finds assets through `n:ia`, or only scans BIM models, can return nothing or the wrong rows.
- **Corrupted keys.** V3 scan returns 24-byte keys. Code that assumes 20-byte keys, such as `toFullKey(item.k, ...)`, can throw or silently build a wrong key.
- **Empty or wrong level and room views.** Apps that find levels and rooms by element flag or category will not see the LBS.
- **Rejected writes.** Mixing BIM and asset keys in one mutate is rejected, as is writing custom properties to a non-asset element.
- **Wrong keys and flags.** V3 keys carry full element flags in the 4 flag bytes. Some flag values differ between V2 and V3.
- **Silent failure.** The sample apps' schema-version gate only blocks versions below 2, so V3 facilities load without any error. The failure is wrong data, not an error message.

### Release timeline and what it means for integrators

| Phase | Where | What happens | What it means for integrators |
|---|---|---|---|
| 1 | Staging, after Autodesk University | The migration dialog goes live. **Every new facility is created on V3 from this moment.** | Apps must handle V3 facilities before this point. |
| 2 | Staging | Soak testing, until results are good. No fixed date. | Test all apps against V2, V3 and migrated facilities. |
| 3 | Production | Same flow. A non-dismissable dialog is shown per facility when it is opened. New production facilities are V3. | Updated apps and customer docs must already be out. |
| 4 | Production | No-BIM ships (assets, properties and locations with no BIM model). | Apps must handle facilities with zero models. |
| 5 | Production | After a period, the remaining facilities are migrated automatically and V2 is retired. | V2 code paths can be removed after this. |

Source: `dt-server/docs/schema-v3-rollout.html`. No dates have been set after Autodesk University.

### Bottom line

- **V2 and V3 facilities will coexist for a long time.** Every app needs to support both, not switch from one to the other.
- **Dual support must ship before the Phase 1 staging dialog goes live,** because new facilities are V3 from that moment.
- **V3 can only be tested in staging today.** The production environment disables the V3 data model.
- **Do not simply bump a minimum-version constant to 3.** That would block every V2 facility.
- Some fixes are version-independent bugs that can be done right now (see Part 3).

---

## Part 2. General plan for any Tandem Data API user

This part is for anyone calling the Tandem Data API: Tandem Connect integration builders, customers with scripts, and our own samples.

### 2.1 What changes for you

| Area | V2 behavior | V3 behavior |
|---|---|---|
| Twin info | `schemaVersion` is 2 | `schemaVersion` is 3 |
| Assets | A BIM element with `n:ia = true` holds both geometry and the customer's `z:` properties | Two records. The BIM element keeps geometry and source data, and `n:ia` becomes false. A new `GenericAsset` in the default model, with its own new element ID, holds the `z:` properties. `n:ia` is not set on it: the asset is identified by its key flag. They are linked by `x:ha`, `x:be` and `x:sf` |
| Reads | One row per asset | **Reads are not redirected.** Assets appear as their own rows, so listings and counts change |
| Element keys | 4 flag bytes only separate physical from logical | 4 flag bytes hold the **full element flag** (24-byte long key). V3 scan always returns 24-byte keys in the `k` column, where V2 returns 20-byte keys. Helpers that add flags to a 20-byte key must not be applied to a 24-byte key |
| Element flag values | Stream is `0x01000003`, family type is `0x01000000` | Stream is `0x01000000`, family type is `0x01000008`. New or newly used flags: `Location` (`0x06`), and `GenericAsset` (`0x01000005`) for the split assets. **Compare using the version, not one fixed value** |
| Location | Level (`l:l`) and room (`x:r`) references into a model | Location Breakdown Structure of `Location` elements in the default model. Old references are replaced as the way location is expressed |
| Writes | Write to the BIM element | `/api/v1` mutate redirects `z:` writes from a BIM element to its asset. **Mixed BIM and asset keys in one write are rejected.** `z:` writes to a non-asset element are rejected |
| New API routes | n/a | `POST /api/v3/modeldata/{modelID}/mutate` and `.../makeAssets` (stricter, 24-byte keys only) |
| Models | At least one model | A facility may have **zero models** |

### 2.2 Self-assessment: will my integration break?

- [ ] Does it gate on `schemaVersion`? Does the gate allow 3, and is the message accurate?
- [ ] Does it build, compare or convert keys or flags (short vs long keys, `0x01000003`, "logical" vs "physical")?
- [ ] Does it list or count assets by `n:ia` or by the presence of `z:` properties? (In V3, `n:ia` is false on BIM elements and unset on assets.)
- [ ] Does it pass scan `k` values into code that assumes a 20-byte key (adding flags, parsing key lists)?
- [ ] Does it find levels or rooms through `l:l`, `x:r`, element flags or Revit categories?
- [ ] Does it resolve the host of a stream, ticket or system through room or parent xrefs?
- [ ] Does it write properties? To which keys (BIM or asset)? Does it batch BIM and asset keys together?
- [ ] Does it assume at least one model exists, or that the default model holds only logical elements?
- [ ] Does it store or deep-link element keys that must keep working after migration?

### 2.3 How to test

- V3 cannot be exercised in production today. Use **staging** (non-production).
- Options in staging: create a twin at schema 3, or add `?v3=true` to a request to force V3 handling of a not-yet-migrated model (`?v3=false` forces V2 handling of a migrated one).
- Keep three test facilities: a V2 facility, a new V3 facility, and a V2 facility that has been **migrated** to V3 (it has BIM elements, split assets and an LBS).
- Compare results before and after migration of the same facility.

### 2.4 Sequenced checklist

#### Prep now (before Autodesk University, safe on V2)

- [ ] Inventory the integration using the self-assessment in 2.2.
- [ ] Create the three staging test facilities described in 2.3.
- [ ] Fix version-independent bugs (see Part 3).
- [ ] Centralize constants, and add the V3 flags and column names (`Location`, `x:ha`, `x:be`, `x:sf`, and the Location xref).
- [ ] Get answers to the open questions in Part 4 that affect the design.

#### Before the staging dialog goes live (new facilities are V3 from then)

- [ ] **Support V2 and V3 together.** Replace any minimum-version gate with a supported range (2 to 3). Fix any wording that says only V2 is supported.
- [ ] Make key and flag handling use the facility's `schemaVersion` instead of one fixed value.
- [ ] Make asset logic dedupe BIM and asset rows, using the `x:ha`, `x:be` and `x:sf` links.
- [ ] Make location logic prefer the LBS and fall back to V2 level and room logic.
- [ ] Make write logic target asset keys, or deliberately rely on the redirect, and never mix BIM and asset keys in one write.

#### During the staging soak

- [ ] Run the full integration against the V2, V3 and migrated facilities.
- [ ] Record results and open issues for the platform teams (dt-server, viewer, dt-client).
- [ ] Re-test as the platform changes.

#### Before the production go-live

- [ ] Release the updated apps and samples with release notes.
- [ ] Publish the customer-facing page that explains the change (support needs it ready before the rollout starts).
- [ ] Notify owners of Tandem Connect and other integrations, with this checklist.

#### When No-BIM ships

- [ ] Handle facilities with zero models, and with assets and locations only in the default model.

#### After Phase 5 (remaining facilities auto-migrated)

- [ ] Remove the V2 fallbacks.
- [ ] Update the guides, specs and READMEs.

### 2.5 Sequencing rules of thumb

1. Dual support must ship **before** the staging dialog goes live.
2. Get answers to the platform questions (upgrade trigger, LBS read API, mutate route) before finalizing app designs. See Part 4.
3. Never bump a minimum-version constant to 3.
4. Do the version-independent bug fixes first. They reduce risk and are safe on V2.
5. Do not remove V2 code until Phase 5 is done.

---

## Part 3. Details for specific apps

Effort numbers are rough estimates from the research (see Appendix A) and need review by each app's owner.

### 3.1 Shared prerequisites (all four sample repos)

Each repo has its own copy of `tandem/constants.js` and `tandem/keys.js`, and the copies have drifted. The stats and portfolio copies match each other. The testbed and emb-viewer copies lack `IsAsset` and `DocumentRoot`, and have the `writeInt32BE` bug.

- [ ] Sync `tandem/constants.js` and `tandem/keys.js` across the four repos.
- [ ] Add the `Location` element flag (`0x06`) and the qualified columns for `x:ha`, `x:be`, `x:sf` and the Location xref. `GenericAsset` (`0x01000005`) already exists in all four copies.
- [ ] Add version-specific stream and family-type flags, and a helper that picks the right one from the facility's `schemaVersion`.
- [ ] Change `toFullKey(short, isLogical)` in `tandem/keys.js` to accept explicit `ElementFlags`, not only a physical or logical boolean.
- [ ] Replace the `schemaVersion < SchemaVersion` gate (constant is 2) with a supported range of 2 to 3, and fix the UI text that says only v2 is supported.
- [ ] Guard `toFullKey` and key-list parsing against 24-byte input. V3 scan `k` values are already full keys, and in the stats copy `toFullKey` would throw on them.
- [ ] Add a short note to each repo's docs describing V2 and V3 support.

The separate `tutorial-rest` repo has the same needs in its own `common/constants.js` and `common/utils.js` (see 3.6).

### 3.2 tandem-sample-stats (most exposed, about 3 to 5 days)

Risk: tagged-asset logic, long-key reconstruction, and level and room discovery.

- [ ] `js/api.js` (`isAssetCandidate`, `classifyElement`, `getTaggedAssetsDetails`): `classifyElement` treats `n:ia` as authoritative when it is present. In V3 the BIM element has `n:ia = false` after the split, and the new `GenericAsset` has no `n:ia` (its flag carries the asset nature). So V3 assets probably fall through to the fallback (eligible flag plus `z:` properties). That may give the right count, but only by accident, and the per-model property counts and drill-downs change. Make the V3 path explicit: scan the default model, identify assets by the `GenericAsset` flag, and verify counts and property histograms against a migrated facility in staging. This was read from code, not run.
- [ ] `js/api.js` (`getLevels`, `getRooms`): add LBS-aware traversal (`Location` elements), with the V2 flag and category logic as the fallback.
- [ ] `js/features/taggedAssets.js` and `js/features/assetDetails.js`: drill-down and deep links currently use BIM keys and physical or logical flags. Make them use full flags and point to the asset record.
- [ ] `js/api.js` strict comparisons such as `flags[0] === ElementFlags.*`: check they handle the full V3 flag bytes and `Location`.
- [ ] `js/features/streams.js` and `js/features/tickets.js`: host resolution goes `XParent`, then `OXRooms`, then `XRooms`. Confirm hosts that are `Location` nodes display correctly.
- [ ] `js/features/rooms.js` and `js/features/roomBarChart.js`: depend on `getRooms()`. Verify after the API fix.
- [ ] `js/app.js` (`hasDefaultModel` guards, schema gate): fix the gate and wording. Tagged assets already scan all models, but the default model now also holds assets.
- [ ] `docs/logical-element-scan-fix.md`: update. The dual-pass scan idea is V2-centric. In V3 the key's flag bytes carry the exact element type, scan `k` values are already 24 bytes, and a split asset has its own new element ID (it does not reuse the BIM element's ID).
- [ ] `AGENTS.md` and `tandem/README.md`: update the statements about logical flag `0x01000000`, the schema-version pattern, and stream and room hosts.

### 3.3 tandem-sample-portfolio (about 2 to 4 days)

Risk: it copies the stats API layer, plus chat tools. Per the project's own rule, specs lead the code.

- [ ] Update `specs/overview.md` and `specs/architecture.md` first (V2 data model descriptions of tagged assets, levels and rooms).
- [ ] Port the stats `js/api.js` fixes (tagged assets, levels, rooms, systems, streams).
- [ ] Implement the schema gate that `specs/architecture.md` requires but `js/app.js` does not have. Use the 2 to 3 supported range.
- [ ] `js/chat/tools.js` (`get_levels`, `get_rooms`): make LBS-aware.
- [ ] `js/chat/tools.js` (`get_models`) and `js/views/activityView.js`: handle facilities with no models in a friendly way.
- [ ] `js/views/detailsView.js`: check stream host display with `QC.XParent` when hosts are Locations.
- [ ] Update the portfolio `AGENTS.md` role and spec status table when done.

### 3.4 tandem-sample-rest-testbed (branch `jma-optimizations`, about 2 to 4 days)

Risk: a key-writing bug that exists today, default-model blind spots, and mutate stubs.

- [ ] **`tandem/keys.js` `writeInt32BE`:** the last byte is written as `(value >> 8) & 0xff` and should be `value & 0xff` (around line 233). This is a bug today. It corrupts the last flag byte in keys built by `makeXrefKey`, and it matters more with full V3 flags. The stats copy is correct.
- [ ] **`QC.RowKey`** is used in `js/stubs/sdkStubs.js` but not defined. Use `QC.Key`.
- [ ] `js/stubs/sdkStubs.js` `getFacilityStructure`: skips the default model, so V3 assets are missed. Include the default model.
- [ ] `js/api.js` `getTaggedAssets`: treats any row with a `z:` value as tagged. In V3 the `z:` values live on the default-model assets, so the default model must be included (see the previous item).
- [ ] `js/stubs/sdkStubs.js` (rooms and levels by Revit `CategoryId`, `l:l` and `QC.Rooms` / `QC.XRooms` placement): add LBS awareness.
- [ ] `js/stubs/propertyStubs.js` (mutate stubs): add examples that target asset keys, and demonstrate the redirect and the mixed-write error.
- [ ] `js/stubs/streamStubs.js`: confirm host xref handling for Location hosts.
- [ ] Guard stub loops that assume `models.length > 0`.
- [ ] `js/app.js` gate: supported range and wording.

### 3.5 tandem-sample-emb-viewer (branch `jma-viewer-stubs`, about 1 to 3 days, depends on the viewer SDK)

Risk: behavior depends heavily on the `@adsk/tandem-viewer` version. The sample's own exposure is mostly in stubs and Lab recipes.

- [ ] **`tandem/keys.js` `writeInt32BE`:** same bug as the testbed. Fix it.
- [ ] **`js/lab/recipes/hud.js`** uses `QC.IsAsset` but the local `tandem/constants.js` does not define it. Add it. Also check that tagged-asset HUD logic works when `z:` is on the asset, not the BIM element (`getPropertiesDt` on a BIM dbId may omit `z:`).
- [ ] Branch on `facility.getSchemaVersion()`, not on `Autodesk.Tandem.DtConstants.SchemaVersion`. The SDK constant stays at 2 and is a classification baseline, not a "latest twin version".
- [ ] `js/stubs/propertyStubs.js` (around the `model.mutate(dbIds, ...)` call on selection): handle BIM and asset dbIds and the mixed-write rejection. Consider resolving to the asset first.
- [ ] `js/stubs/modelStubs.js` (`getLevels`, `getRooms`, `getElementsForLevel`) and `js/lab/recipes/explore.js`: confirm what the SDK returns once the LBS is on, then document it.
- [ ] `js/lab/recipes/*.js` and stubs that use `facility.getModels()`: handle zero-model facilities.
- [ ] Consider listening for the SDK event that fires when assets are created, since selection can move to asset dbIds.
- [ ] `js/app.js` gate: supported range and wording.
- [ ] `AGENTS.md`: add the V3 notes (asset split, LBS, key length).

### 3.6 tutorial-rest (branch `master`, about 2 to 4 days)

Repo: `tutorial-rest`, a Node.js collection of about 60 small, single-purpose REST examples (folders `assets`, `classification`, `documents`, `elements`, `facility`, `groups`, `history`, `streams`, `systems`, `tickets`, `views`). Customers copy these examples, so a V2-only pattern here spreads into customer code. Every example is built on three shared files: `common/tandemClient.js` (REST wrapper), `common/constants.js` and `common/utils.js` (`Encoding` key helpers). That makes the fix mostly a matter of **a few shared changes, then a retest of the examples**. The repo has no V3 preparation in its git history, and no example checks `schemaVersion`, so V3 facilities run without any warning.

Risk: silent empty results (streams and assets), and key-building code that assumes 20-byte keys.

**Shared client and helper changes (do first, they fix many examples at once):**

- [ ] **Streams:** `getStreams` in `common/tandemClient.js` keeps rows where `n:a === ElementFlags.Stream` (`0x01000003`). The V3 stream flag is `0x01000000`, so on a V3 facility this probably returns an empty list. Twelve examples read streams this way and would print nothing (`streams/list-streams.js`, `list-stream-host.js`, `list-stream-settings.js`, `update-stream-settings.js`, `list-stream-secrets.js`, `list-stream-configs.js`, `list-stream-last-reading.js`, `list-stream-data.js`, `delete-stream-data.js`, `delete-stream-parameter-data.js`, `reset-stream-secrets.js`, `apply-stream-config-override.js`). Use a version-aware stream test, with the version taken from the facility's twin settings.
- [ ] **Stream creation:** `createStream` writes `ElementFlags.Stream` (V2 value) into `n:a`. On a V3 facility it should write the V3 value. What the server does with the V2 value on a V3 twin was not checked.
- [ ] **Assets:** `getTaggedAssets` keeps rows where `n:ia` is truthy. In V3 the BIM element has `n:ia = false` and the new `GenericAsset` has no `n:ia`, so on a migrated facility this probably returns no assets. Nine examples depend on it (`assets/list-asset-boxes.js`, `list-asset-links.js`, `read-asset-properties.js`, `read-asset-type-properties.js`, `read-asset-tags.js`, `write-asset-properties.js`, `history/list-asset-history.js`, `facility/list-facility-structure.js`, `facility/list-level-assets.js`). Also accept rows whose `n:a` is `GenericAsset`, and keep the `n:ia` test for V2.
- [ ] **Keys:** `Encoding.toFullKey(shortKey, isLogical)` assumes a 20-byte input and only writes a physical (`0x0`) or logical (`0x01000000`) flag. Ten examples call it as `toFullKey(item[QC.Key], isLogicalElement(item[QC.ElementFlags]))` (`assets/list-asset-links.js`, `systems/list-systems.js`, `systems/list-system-elements.js`, `tickets/create-ticket.js`, `tickets/list-asset-tickets.js`, `streams/create-stream.js`, `list-stream-host.js`, `list-stream-configs.js`, `list-stream-last-reading.js`, `delete-stream-parameter-data.js`). On V3 the scan `k` is already 24 bytes. In this implementation `Buffer.copy` truncates the input, so the result is a silently corrupted key, not an error. For a 20-byte V2 key the helper is also wrong for V3 flags (system, ticket, generic asset and room keys need their exact flags). Return the key unchanged when it is already a full key (`isFullKey`), and otherwise build it from the element's actual flag value.
- [ ] **Key lists:** `Encoding.fromShortKeyArray` splits a list into 20-byte entries. V3 `l:` reference lists use 24-byte entries. It is used by `facility/list-element-rooms.js` and `facility/list-facility-structure.js`. Add a 24-byte mode that is chosen from the facility version.
- [ ] **Short keys for queries:** `streams/list-streams.js` converts keys with `toShortKey` and then passes 20-byte keys to `getElements`. Check on staging whether a V3 scan accepts 20-byte keys, and if not, pass the full key.
- [ ] **Constants:** in `common/constants.js` add `Location` (`0x06`), the V3 stream and family-type flags, and the columns `x:ha`, `x:be`, `x:sf` and the Location xref. The existing comment on `SchemaVersion = 2` ("current version of classification schema") should say it is not the twin schema version, because no example uses it.

**Example-level checks:**

- [ ] `assets/write-asset-properties.js`: loops over every model, reads that model's schema and writes to the keys it finds. After the `getTaggedAssets` fix it should work on V3, because the properties and the `Device ID` key property live on the default-model assets. Retest on a migrated facility, and add a comment that BIM and asset keys must not be mixed in one write.
- [ ] `assets/create-generic-asset.js`: creates a `GenericAsset` in the default model through `/create`. This should still be valid on V3, and it is also the No-BIM way to create an asset. Retest on a V3 facility, and add a note that no BIM model is needed.
- [ ] `elements/delete-element.js`: find out what happens to the linked asset (or BIM element) when one side of an `x:ha` / `x:be` pair is deleted, then document it.
- [ ] `tickets/create-ticket.js` and `streams/create-stream.js`: they copy the room, level or parent of a selected element. In V3 the location comes from the LBS and the host may be an asset or a Location. Decide which element a ticket or stream should point at (the BIM element or its asset) and update the example.
- [ ] Level and room examples (`facility/list-levels.js`, `list-rooms.js`, `list-level-rooms.js`, `list-level-assets.js`, `list-facility-structure.js`, `views/create-level-views.js`): the helpers keep working on the BIM levels and rooms (flags `0x01000001` and `0x05` do not change), but they do not show the LBS `Location` elements. `facility/list-facility-structure.js` already falls back from `l:r` to `x:r`, which is where migrated assets keep their rooms. Add a new example that lists the LBS once the API for it is decided (see Part 4).
- [ ] Loops over `facility.links` assume at least one model. Check that they handle a facility with only the default model.

**Docs and retest:**

- [ ] `AGENTS.md` recommends `Encoding.toFullKey` for key handling. Change it, otherwise AI-generated examples will repeat the bug. Add V3 notes (key length, version-specific flags, asset identification).
- [ ] `README.md`: add a short V2 and V3 note, and the staging test method from Part 2.
- [ ] Run the examples against a V2 facility, a new V3 facility and a migrated facility in staging. Record a pass, fail or "needs change" for each example in the wiki.

### 3.7 Tandem Connect and customer integrations

No Tandem Connect source was reviewed. It uses the same APIs as the samples, so the effect is the same as described in Part 2. It appears as an app with a client ID and no email address. Each integration built with it is effectively its own product that can break.

- [ ] Name an owner for the Tandem Connect inventory (use the self-assessment in 2.2).
- [ ] Run Tandem Connect against the V2, V3 and migrated staging facilities during the staging soak.
- [ ] Plan the communication to integration builders before the production go-live (what changes, dates, how to test, who to ask).
- [ ] Decide whether there will be a deprecation window or version signal for third parties (see Part 4).

---

## Part 4. Open questions

For dt-server, viewer, dt-client and product owners. These affect the app designs, so they should be answered before the apps are finalized.

1. **How and when does the V2 to V3 upgrade get triggered?** The `POST /twins/{id}/upgrade-schema` endpoint increments the version by one, and it returns "no upgrade needed" when the twin is at `ModelSchemaVersion_Current` (still 2) unless forced.
2. **Where is the non-dismissable upgrade dialog being built?** The shipped dt-client modal only handles twins below schema 2.
3. **Is a public API for reading the LBS / Locations planned?** No `/locations` endpoint exists today.
4. **Will stream and ticket hosts become Locations?** (This is inferred from the code, not confirmed.)
5. **Will `/api/v1` mutate keep its BIM-to-asset redirect long term,** or should integrators move to `/api/v3`?
6. **Will the viewer SDK expose the version-aware flag helpers publicly** (`streamFlag`, `familyTypeFlag`, `isStream`, `isFamilyType`)? They are internal today.
7. **Will the API signal the data model version** (a response header, for example) or offer a deprecation window for integrators? No version header exists today.
8. **What is the date, or the trigger, for auto-migrating the remaining facilities (Phase 5)?**
9. **Are staging test facilities and a staging App/client ID available** for each of the five sample repos and for Tandem Connect?
10. **How should an API consumer identify an asset in V3?** The server sets `n:ia` to false on the BIM element and does not set it on the new asset ("the asset nature is carried by the key flags"). Is checking for the `GenericAsset` flag the supported method? If so, it should be documented.
11. **What happens to the linked record when one side of an `x:ha` / `x:be` pair is deleted?**
12. **Do V3 scan, stream-config and timeseries endpoints accept 20-byte keys?** Several examples pass short keys to them.

---

## Appendix A. AI-assisted research

> **AI-assisted research. Verify before acting.**
> This appendix was generated on 2026-10-29 by an AI coding assistant that scanned the `dt-server`, `viewer` and `dt-client` source and git history, and the five sample repos (including `tutorial-rest`). Several findings were produced by AI exploration agents. Two claims were re-checked by hand: the production gate for the V3 data model, and the `writeInt32BE` bug in all four `keys.js` copies. Items marked **FACT** were read from code or docs. Items marked **INFERENCE** are conclusions drawn from the code and need confirmation from the owning teams. Line numbers, commit lists and effort estimates are approximate.

### A1. Release plan (from the rollout deck)

Source: `dt-server/docs/schema-v3-rollout.html` (added in commit `389b39ad`, last edited in `0cd06318` on 2026-10-19). This is the same material as the timeline in Part 1.

**FACT:**

- **Phase 1, staging, after Autodesk University.** The migration is enabled and the update dialog starts appearing, one facility at a time. Every new facility is created on V3 from the moment the dialog goes live.
- **Phase 2, staging.** Testing across facility sizes and setups. Exit when results are good, not on a fixed date. Exit criteria: migrations complete cleanly, the LBS is correct, assets land in the right locations, no data is lost.
- **Phase 3, production.** Same mechanism: a non-dismissable dialog, one facility at a time, triggered when a customer opens the facility.
- **Phase 4.** No-BIM ships once production is on V3.
- **Phase 5.** After a period in production, the remaining facilities are migrated automatically so that two data models no longer need to be supported.
- **Customer-facing statements in the deck:** the upgrade is one-way, the facility is locked for a few minutes (one facility at a time), nothing is deleted, and "integrations mostly keep working, but anything that reads data should be checked."
- **Support needs a page to link to** before the rollout starts.

### A2. What changes for API consumers

Sources: `dt-server/docs/schema-v3-migration.html`, and `dt-server` `btstore/*`, `model-server/*` and `lmv-importer/*`.

**FACT:**

- **Migration function.** `UpgradeSchemaVersion3` (`lmv-importer/taskbase/schemaUpgrade.go`), and `UpgradeSchemaVersion3WithLBS` in `taskdispatcher/dispatcher.go`, which also builds the LBS and converts the twin's saved views.
- **Four structural changes in the migration:**
  1. **Element ID flag injection.** Row keys are 40 bytes: 16 bytes of model ID, 4 bytes of flags, 20 bytes of element ID. In V2 the flags only separated physical from logical. In V3 the full `ElementFlags` value is written into the key.
  2. **Reference rewriting.** Attributes of type `DbKey`, `DbKeyList` and `ExDbKeyList` in the refs (`l:`), xrefs (`x:`) and systems (`m:`) families are rewritten to carry the right flags. Cross-model xrefs are also retargeted to the new asset where a BIM element was split. The same rewrite is applied to history entries.
  3. **Asset decoupling.** Elements with `n:ia = true` get a new asset entity (`GenericAsset`) in the default model that owns the `z:` custom properties. The BIM element keeps geometry and source data, and `n:ia` becomes false on it. Bidirectional xrefs link the pair. History on the asset starts fresh at the split time. The asset gets a **new element ID** (the migration step is "Generate new asset ID", and `newAssetElementID` in `btstore/op-make-assets-v3.go` uses a random UUID), so it does not share the BIM element's 20-byte ID. The asset's own key flag (`GenericAsset`) is what identifies it, and `n:ia` is **not** copied onto it ("the asset nature is carried by the key flags in v3").
  4. **History and CDN alignment.** The change-log key arrays are rewritten, and geometry and material resources used by the split assets are copied from the source model into the default model.
- **Element flag values embedded in keys:** `0x00` SimpleElement, `0x01` NestedChild, `0x02` NestedParent, `0x05` Room, `0x06` Location, `0x01000001` Level, `0x01000003` Stream (V2 value, see below; the deck's table is stale here, because commit `dc96b0de` of 2026-07-06 moved the V3 stream flag to `0x01000000` after the deck was written), `0x01000004` System, `0x01000005` GenericAsset, `0x01000007` Ticket, `0xFFFFFFFF` Unknown.
- **Version-specific flags** (`btstore/dt-schema.go` and the viewer's `src/dt/schema/dt-schema.js`): stream is `0x01000003` in V2 and `0x01000000` in V3. Family type is `0x01000000` in V2 and `0x01000008` in V3. The V3 stream value is the same number as the V2 family-type value, so a static compare is wrong on one version. The server and the viewer use version-aware helpers (`StreamFlag(ctx)`, `IsStream`, `FamilyTypeFlagForVersion`, and in the viewer `streamFlag`, `familyTypeFlag`, `isStream`, `isFamilyType`).
- **New qualified columns:** `x:ha` (host of asset, `QC.XHostOfAsset`), `x:be` (BIM element of asset, `QC.BimElmOfAsset`), `x:sf` (asset split from BIM element, immutable), and a Location xref plus override (`QC.Location`, `QC.OLocation`). The legacy `l:l` and `x:r` columns remain in the schema. The LBS migration adds `Location` elements and back-references to the source level or room.
- **Scan behavior.**
  - `POST|GET /modeldata/{urn}/scan` on a V3 twin always returns the `k` column as a 24-byte qualified, websafe ID (`btstore/op-scan.go`). On V2 twins, `k` is a 20-byte ID unless the `/api/v2/.../scan` route sets long keys.
  - Split assets appear as separate rows in the default model.
  - `x:ha` may be fetched internally but is omitted from scan output unless requested.
  - `n:ia` is read-only in the schema. The V2 mutate path can synthesize `IsAsset`. The V3 path does not. In V3 the migration sets `n:ia` to false on the split BIM element (`demoteSplitBimElement` in `lmv-importer/taskbase/schemaUpgrade.go`), and `makeAssets` and the migration skip `n:ia` when copying columns to the new asset (`op-make-assets-v3.go`). `IsAssetCandidate` is `flags <= EFCompositeParent || flags == EFGenericAsset` (`btstore/asset-check.go`).
- **Mutate behavior.**
  - `POST /api/v1/modeldata/{modelID}/mutate` on a V3 twin accepts 20-, 24- or 40-byte encoded keys, probes flags to find the real V3 row key, and **retargets `z:` writes** from a BIM element that has `x:ha` to its default-model asset. `z:` IDs are remapped between the source model and the facility.
  - Errors: "cannot write both raw bim elements and asset elements in the same write", "cannot write DtProperties to a non-asset element", and "assets-split: cross model references not allowed".
  - `POST /api/v3/modeldata/{modelID}/mutate` is stricter: keys must decode to exactly 24 bytes, there is no BIM-to-asset retarget, `z:` is only allowed on the default model and on stream, location, room, generic asset and ticket elements, and stream `n:s` settings are rejected. Direct writes to `n:ia` are rejected everywhere.
  - `POST /api/v3/modeldata/{modelID}/makeAssets` creates `GenericAsset` records in the default model from 24-byte BIM keys.
  - **Reads are not redirected.** The retarget exists only for mutate (there is no scan equivalent in the code).
- **Twin info and upgrade endpoint.**
  - `GET /twins/{urn}` returns `schemaVersion` (and optionally `schemaVersionUpgradeTriggered`). Constants: `ModelSchemaVersion2 = 2`, `ModelSchemaVersion3 = 3`, `ModelSchemaVersion_Current = 2`.
  - Patching `schemaVersion` directly through twin settings is rejected.
  - `POST /api/v1/twins/{twinID}/upgrade-schema` needs manage access, has an optional `?force`, enqueues an upgrade to `settings.SchemaVersion + 1`, and returns 400 "no upgrade needed" when the twin is already at `ModelSchemaVersion_Current` unless forced.
  - New twins are created at V2 by default. With V3 request context (or, outside prod, a payload `schemaVersion >= 3`), creation forces schema version 3 (commit `bbc304a7`).
- **Schema endpoint.** `GET /modeldata/{modelID}/schema` is unchanged. Attribute definitions are per model, so `z:` IDs differ between a source model and the facility.
- **Streams.** The stream element ID must be a 24-byte ID on V3. Use `StreamFlag(ctx)` and not `0x01000003`. The streams connectivity state uses V3 tables for V3 twins.
- **Levels and rooms.** On V3 import or upgrade, source levels and rooms are mirrored as `Location` elements in the default model, and parent references use flagged 24-byte IDs (`lmv-importer/locations/locations.go`).
- **Systems, tickets, documents.** No REST route changes were found. V3 flag handling applies, and tickets can hold `z:` properties on V3.
- **Compatibility controls.** `?v3=true` and `?v3=false` query parameters (non-production only), the stored twin `schemaVersion` (cached for 24 hours in the server), and `/api/v2/.../scan` for long keys on V2. There is **no** response version header and no `@deprecated` marking on v1 scan or mutate.
- **Storage.** V3 data is stored in separate collections with a transcoding layer from V2 binary row keys to a readable V3 `_id` form (commits `5e024f1b`, `dc96b0de`). This is internal.

**INFERENCE:**

- Apps on V3 should prefer asset keys for `z:` writes when using `/api/v3/mutate`, while `/api/v1/mutate` keeps BIM-key ergonomics through the redirect.
- Spatial assignment for streams and assets is probably moving toward the Location xref after the LBS. The stream-config read paths were not fully traced.
- Apps that assume one dbId per real-world asset must resolve the xrefs.

### A3. The production gate and the timing constraint

**FACT** (verified by reading the code):

- `withV3DataModel` in `model-server/model-server.go` returns immediately and uses V2 when `_config.Name == "prod"`. In non-prod, it uses the `v3` query parameter if present and otherwise the stored twin version (V3 when `>= ModelSchemaVersion3`). The comment on the function says "Disabled in prod, where the data model is always v2."
- `UpgradeSchemaVersion3WithLBS` in `taskdispatcher/dispatcher.go` logs "not supported in production" and returns when `ENV_NAME == prod`.
- `ModelSchemaVersion_Current` is still `ModelSchemaVersion2`.
- The dt-client schema upgrade modal (`src/components/ViewerPage/SchemaUpgrade.js`) treats a facility as needing an upgrade when `facility.settings.schemaVersion < dt.DtConstants.SchemaVersion` (2). It calls `facility.triggerUpgrade()`, which posts to `upgrade-schema`. The V2 to V3 dialog in the rollout deck is not in this code.
- No LaunchDarkly gating for schema V3 was found in the dt-server upgrade or model-server paths.

**INFERENCE:**

- Today, only non-production environments show the V3 REST behavior. Production consumers see V2 until that gate is removed.
- The V3 trigger will probably involve changing `ModelSchemaVersion_Current` and the client constant, or a forced upgrade call. This needs confirmation.

### A4. Viewer SDK and dt-client findings

**FACT:**

- **Two meanings of "version".** `facility.getSchemaVersion()` (the per-twin value, 1, 2 or 3) versus `Autodesk.Tandem.DtConstants.SchemaVersion` (exported, still 2, a classification baseline). The internal constant `ModelSchemaVersionV3` (3) is not re-exported on `DtConstants`.
- **Long keys.** `IdMapper` has a long-keys mode (24-byte IDs: 4 flag bytes plus the 20-byte ID), returning 32-character encoded IDs on V3 vs 27 on V2. It is enabled when the load query contains `v3=true`. `DtModelLMV.getQueryParams()` adds `v3=true` when the load context has `noBim` and the facility schema version is 3 (the code carries a `V3_TODO` to move this to the server). `DtTeam._createFacility` adds `v3=true` on creation when `loadContext.createV3Twins` is set.
- **dt-client asset import** (`src/components/AssetImport/createAssets.js`, commits `a4d1eed52` and `0a2e0d827`): on V3, the key uses the full `ElementFlags.GenericAsset`. Older twins use `GenericAsset & AllLogicalMask`.
- **Feature flags** (app-level, from LaunchDarkly via `src/appInit.js`, with a local override in `localStorage` key `Autodesk.Tandem.FlagOverrides`):
  - `noBim`: 1D, 2D and 3D modes, the schematic start page, hiding the 3D viewer when there are no plans, `ViewerCapabilities.js` presets, asset labels in 1D, and `FloorPlanManager`.
  - `enableLbs`: LBS facets, location editors in the property panel, heatmaps by location (when schema version is 3 or more).
  - `createV3Twins`: creates new twins at V3.
  - These flags are **not stored on the twin**, so an embedded-SDK app has to build its own capability checks.
- **New SDK surface:** `facility.getFloorPlanManager()` and 2D plan mode (viewer `b48711ef`, `c7641a9e`), `facility.triggerUpgrade()`.
- **Host selection in No-BIM:** default-model hosts can be locations or assets (`useHandleHostSelection.js`).
- **makeAssets on V3** uses `QC.XHostOfAsset` rather than `QC.IsAsset` to find assets, loads new assets into the default model, and may move the selection to the new asset dbIds. `DT_ASSETS_CREATED_EVENT` is fired.
- **Public vs internal.** `getPropertiesDt` and `model.mutate` keep the same surface, and the behavior changes under them (property worker, schema matching by version).
- **Key commits, viewer:** `6ba7e0bf` (long keys), `32154a3a`, `1fc367a3` (LBS refs and location row keys), `b48711ef` (`FloorPlanManager`), `c7641a9e`, `eeadad54` (LBS and No-BIM heatmaps), `17061602` (No-BIM asset labels), `4829536d`.
- **Key commits, dt-client:** `a4d1eed52`, `0a2e0d827` (V3 asset key flags), `318251f40` and `dc988c05c` (systems in No-BIM), `e3b746cda` (skip model upload after creation when No-BIM), `42c99d44c` (viewer-less start page), `e2d9c2067`, `d25f1f8e7`, `c5a64ca4c`.
- **Key commits, dt-server:** `cac42fde`, `59e41a29`, `cdd96b25` (migration), `5e024f1b` (key transcoding in the storage stack), `dc96b0de` (V3 flag encodings), `bbc304a7` (new twins in V3), `e5e6571a` (LBS on upgrade), `0cd06318` (V3 fixes, 2026-10-19).

**INFERENCE:**

- An external SDK app should branch on `facility.getSchemaVersion() >= 3`, and build keys with the full flags on V3. It should compare the facility's version, not `DtConstants.SchemaVersion`.
- Embedded apps without the dt-client flags need their own capability matrix.
- The shipped dt-client modal does not look like a V2 to V3 gate. V3 twins are probably created at V3 through `createV3Twins`, and V2 to V3 for existing twins is probably a future change.

### A5. Sample app exposure

None of the five repos (the four with a `tandem/` folder, plus `tutorial-rest`) has any V3 preparation in its git history (searched for `v3`, `schema`, `generic asset` and `LBS`). The findings in this subsection that are labeled FACT for "all four apps" do not apply to `tutorial-rest`, which has no schema gate. Its findings are listed separately below.

**FACT (all four apps):**

- Each app gates with `schemaVersion < SchemaVersion` where `SchemaVersion = 2` in `tandem/constants.js`. V3 facilities therefore pass and load, and the UI text implies only V2 is supported. If the constant is bumped to 3 without a range check, V2 facilities would be blocked.
- Portfolio's `specs/architecture.md` requires a schema check, but `js/app.js` has none.
- No copy of `tandem/constants.js` defines the `Location` flag or the `x:ha`, `x:be`, `x:sf` or Location columns. All copies define `GenericAsset` (`0x01000005`).
- The `tandem/constants.js` and `tandem/keys.js` copies are not identical. Stats and portfolio match each other and include `IsAsset` and `DocumentRoot`. The testbed and emb-viewer copies add a `normalizeRegion()` helper and lack `IsAsset` and `DocumentRoot`.
- `writeInt32BE` in the testbed copy (`tandem/keys.js`, around line 233) writes `(value >> 8) & 0xff` for the last byte. The stats and portfolio copies write `value & 0xff` and are correct. The emb-viewer copy has the same bug as the testbed (line 233). Verified by reading all four files.

| Repo | Severity | Where | Why it matters in V3 |
|---|---|---|---|
| stats | Degraded (verify) | `js/api.js` (`isAssetCandidate`, `classifyElement`, `getTaggedAssetsDetails`) | `n:ia` is authoritative when present. V3 sets it false on BIM elements and leaves it unset on assets, so assets likely count through the fallback (flag plus `z:`), by accident. Per-model property counts and drill-downs change. Revised after reading the V3 `n:ia` handling |
| stats | Breaking | `tandem/keys.js` `toFullKey`, `js/features/assetDetails.js` | Long keys rebuilt as physical or logical only from a 20-byte input. V3 scan `k` is 24 bytes, so in this implementation the call can throw. A short-key scan can return the BIM row without `z:` |
| stats | Breaking | `js/api.js` `getLevels`, `getRooms` | Flag and category scans, no LBS awareness |
| stats | Degraded | `js/features/streams.js`, `js/features/tickets.js` | Host priority `XParent`, `OXRooms`, `XRooms`. Hosts may become Locations |
| stats | Degraded | `docs/logical-element-scan-fix.md` | V2-centric dual-pass scan guidance |
| stats | Cosmetic | `AGENTS.md`, `tandem/README.md`, `js/app.js` text | Statements about the logical flag, schema pattern, and "v2 only" copy |
| testbed | Breaking | `tandem/keys.js` `writeInt32BE` | Wrong last flag byte in `makeXrefKey` |
| testbed | Breaking | `js/stubs/sdkStubs.js` `getFacilityStructure`, `js/api.js` `getTaggedAssets` | Skips the default model, where V3 assets live |
| testbed | Breaking | `js/stubs/sdkStubs.js` rooms and levels | Revit `CategoryId` and `l:l` / `x:r` logic, no LBS |
| testbed | Breaking | `js/stubs/propertyStubs.js` mutate stubs | BIM-key writes. V3 redirects or rejects them |
| testbed | Degraded | `js/stubs/sdkStubs.js` | `QC.RowKey` is undefined. Loops assume at least one model |
| emb-viewer | Breaking | `js/lab/recipes/hud.js` | `QC.IsAsset` used but undefined locally. `z:` may be on the asset, not the BIM dbId |
| emb-viewer | Breaking | `js/stubs/propertyStubs.js` | `model.mutate` on viewer selection can hit the redirect or mixed-write rejection |
| emb-viewer | Degraded | `js/stubs/modelStubs.js`, `js/lab/recipes/explore.js`, `js/lab/recipes/*.js` | Level and room APIs not documented for the LBS. Assumes at least one model |
| portfolio | Breaking | `js/api.js` (large copy of the stats API layer) | Same asset, level, room and system issues as stats |
| portfolio | Breaking | `js/chat/tools.js` `get_levels`, `get_rooms` | AI answers use flag and category scans, blind to the LBS |
| portfolio | Degraded | `js/views/detailsView.js`, `js/views/activityView.js`, `get_models` | Stream host display. "No models" for No-BIM |
| portfolio | Cosmetic | `specs/overview.md`, `specs/architecture.md` | Describe the V2 data model. Schema gate not implemented |

**tutorial-rest (FACT unless marked):** repo `tutorial-rest`, branch `master`, last commit `64a1a5b` on 2026-06-11. Found by reading the shared files `common/tandemClient.js`, `common/constants.js`, `common/utils.js` and `AGENTS.md` in full, reading `assets/create-generic-asset.js`, `assets/write-asset-properties.js` and `streams/list-streams.js`, and searching all examples for V3-sensitive patterns. The other examples were not read line by line. Nothing was run.

- No V3 preparation in git history. No example checks `schemaVersion`. `SchemaVersion = 2` in `common/constants.js` is unused by the examples.
- Commit `b523839` (2026-04-09, "Update examples to get full key") moved examples to `toFullKey(...)`, which is what now needs fixing for V3.
- `getStreams`, `getTickets`, `getSystems`, `getLevels` and `getRooms` filter on `item[QC.ElementFlags] === ElementFlags.X`. Level (`0x01000001`), Room (`0x05`), System (`0x01000004`) and Ticket (`0x01000007`) keep their values in V3. Stream does not (`0x01000003` in V2, `0x01000000` in V3, `EFStreamV3` in `btstore/dt-schema.go`).
- **INFERENCE:** the stream filter returns no rows on V3, because it assumes `n:a` is reported with the V3 value like the key. This was not run.
- `getTaggedAssets` keeps rows where `n:ia` is truthy. Combined with the V3 `n:ia` handling above, it likely finds no assets on a migrated facility.
- `Encoding.toFullKey` is called with scan `k` values in 10 examples, `fromShortKeyArray` in 2, and `getTaggedAssets` in 9. `toFullKey` uses `Buffer.copy`, which silently truncates a 24-byte input.
- For V2 20-byte keys, `toFullKey` writes `0x0` or `0x01000000` only. That coincides with the V3 flag only for streams (`0x01000000`).
- `facility/list-facility-structure.js` already reads room references from `x:r` when `l:r` is empty. This matches how the migration re-expresses asset room references (`promoteAssetRoomRefs`, as full row keys in the xrefs family).

| Repo | Severity | Where | Why it matters in V3 |
|---|---|---|---|
| tutorial-rest | Breaking (likely) | `common/tandemClient.js` `getStreams` (12 stream examples) | Stream flag changes to `0x01000000` in V3, so the filter probably returns nothing |
| tutorial-rest | Breaking (likely) | `common/tandemClient.js` `getTaggedAssets` (9 examples) | Relies on `n:ia`, which V3 does not set on assets |
| tutorial-rest | Breaking | `common/utils.js` `Encoding.toFullKey` (10 examples) | Assumes a 20-byte key and logical or physical flags. V3 `k` is 24 bytes, so keys are silently corrupted |
| tutorial-rest | Degraded | `common/utils.js` `Encoding.fromShortKeyArray` (2 examples) | V3 reference lists use 24-byte entries |
| tutorial-rest | Degraded | `common/tandemClient.js` `createStream` | Writes the V2 stream flag |
| tutorial-rest | Degraded | level, room, ticket and stream-host examples | Work on BIM levels and rooms, but do not use the LBS |
| tutorial-rest | Cosmetic | `AGENTS.md`, `README.md`, `common/constants.js` comment | Recommends `toFullKey`. No V3 notes. `SchemaVersion` comment is ambiguous |

**Estimated effort (rough, from the research):** stats about 3 to 5 days, portfolio about 2 to 4 days, testbed about 2 to 4 days, emb-viewer about 1 to 3 days, tutorial-rest about 2 to 4 days (a few shared changes plus a retest of about 60 examples). These cover app changes only, not retesting during the staging soak.

**Tandem Connect (FACT):**

- No Tandem Connect source is in the workspace.
- The mentions found: a subscription product name ("Tandem Connect", "Tandem Connect Free") in `dt-server/docs/account/create-test-user.md`, and a comment in `tandem-sample-portfolio/js/views/accessView.js` saying apps such as "Tandem Connect" appear with a client ID and a name but no email.
- Per the requester: it uses the same APIs as the samples, so the effect is the same. Each integration made with it is the equivalent of a product that could break.
- No special handling for Tandem Connect or integrations was found in the schema upgrade or No-BIM code paths.

### A6. Method, scope and caveats

- **Sources:** `dt-server/docs/schema-v3-*.html`; `dt-server` packages `btstore`, `model-server`, `lmv-importer` (including `taskbase`, `taskdispatcher`, `locations`); `viewer` `src/dt/*`; `dt-client` `src/*`; and the five sample repos (stats, portfolio, rest-testbed, emb-viewer, tutorial-rest). Git history was searched for V3, No-BIM, schema, asset, LBS and long-key commits.
- **Branches when the research was done:** `main` (stats, portfolio), `master` (dt-server, dt-client, viewer), `jma-optimizations` (rest-testbed), `jma-viewer-stubs` (emb-viewer), `master` (tutorial-rest). The testbed and emb-viewer findings apply to those branches and should be re-checked against their release branches.
- **Not run:** V3 behavior was read from code and docs. It was not exercised, because production disables it, and no staging V3 facility was used.
- **Out of scope by decision:** other repos next to the samples (`tandem-sample-rest`, `tandem-sample-viewer-react`, `tandem-sample-chrome-ext`, `tandem-mcp`, `tandem-odata`, `tandem-client-net`, and others). They can be assessed later with the Part 2 checklist.
- **Known uncertainties:** how the V2 to V3 trigger will work, whether stream hosts move to Locations, LBS read access for apps, the exact Location xref column name and behavior, and the dates for Phases 2 to 5.
