/**
 * Utility functions for Tandem Stats
 */

const kElementIdSize = 20;
const kElementFlagsSize = 4;

/**
 * Make a base64 string web-safe
 * @param {string} str - Base64 string
 * @returns {string} Web-safe base64 string
 */
export function makeWebsafe(str) {
  return str.replace(/\+/g, '-')     // Convert '+' to '-' (dash)
    .replace(/\//g, '_')              // Convert '/' to '_' (underscore)
    .replace(/=+$/, '');              // Remove trailing '='
}

/**
 * Convert a long key (with flags) to a short key (without flags)
 * @param {string} fullKey - Long key with element flags
 * @returns {string} Short key without flags
 */
export function toShortKey(fullKey) {
  const tmp = fullKey.replace(/-/g, '+').replace(/_/g, '/');
  const binData = new Uint8Array(atob(tmp).split('').map(c => c.charCodeAt(0)));
  const shortKey = new Uint8Array(kElementIdSize);

  shortKey.set(binData.subarray(kElementFlagsSize));
  return makeWebsafe(btoa(String.fromCharCode.apply(null, shortKey)));
}

/**
 * Create a map of stream data indexed by short keys
 * The API returns data with long keys, but we need to map them back to short keys
 * @param {Object} lastSeenValues - Object with long keys
 * @returns {Object} Object with short keys
 */
export function convertLongKeysToShortKeys(lastSeenValues) {
  const result = {};
  
  for (const [longKey, value] of Object.entries(lastSeenValues)) {
    const shortKey = toShortKey(longKey);
    result[shortKey] = value;
  }
  
  return result;
}
