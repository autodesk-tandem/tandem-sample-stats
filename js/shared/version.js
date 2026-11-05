/**
 * Version registry.
 *
 * The app shell loads exactly one schema-version module (js/v2/index.js or js/v3/index.js)
 * and registers it here. Shared UI code calls the delegates below instead of importing
 * from a version folder, so it never needs to know which schema is active and there is no
 * version if/else anywhere in feature code.
 *
 * A version module is an object with this shape:
 *
 *   {
 *     schemaVersion,        number    - schema version this module implements (2 or 3)
 *     label,                string    - label shown in the UI ('V2' / 'V3')
 *     minSchemaVersion,     number    - lowest facility schema version the module can display
 *     loaders: {
 *       getStreams(facilityURN, region)
 *       getTickets(facilityURN, region)
 *       getLevels(facilityURN, region)
 *       getRooms(facilityURN, region, schemaCache)
 *       getSystems(facilityURN, region, models)
 *       getTaggedAssetsDetails(facilityURN, region, includeKeys)
 *     },
 *     toRowKey(key),        converts any key (long key, xref element key) to the form used
 *                           by scan rows and key queries in this version
 *     viewAssetDetails(elementsByModel, title, facilityURN, region, ...)
 *   }
 */

let activeVersion = null;

/**
 * Register the version module that shared code should use.
 * @param {object} versionModule
 */
export function setActiveVersion(versionModule) {
  activeVersion = versionModule;
}

/**
 * @returns {object} The active version module
 */
export function getActiveVersion() {
  if (!activeVersion) {
    throw new Error('No schema version module is active');
  }
  return activeVersion;
}

// ── Delegates used by shared UI code ───────────────────────────────────────────

export function toRowKey(key) {
  return getActiveVersion().toRowKey(key);
}

export function viewAssetDetails(...args) {
  return getActiveVersion().viewAssetDetails(...args);
}

export function getTaggedAssetsDetails(...args) {
  return getActiveVersion().loaders.getTaggedAssetsDetails(...args);
}
