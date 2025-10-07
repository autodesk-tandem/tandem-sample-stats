/**
 * Utility functions for Tandem Stats
 */

const kElementIdSize = 20;
const kElementFlagsSize = 4;

/**
 * Attribute type enum mapping from Tandem SDK
 * Maps numeric type codes to human-readable names
 */
export const AttributeType = {
  0: 'Unknown',
  1: 'Boolean',
  2: 'Integer',
  3: 'Double',
  4: 'Float',
  10: 'BLOB',
  11: 'DbKey',
  20: 'String',
  21: 'LocalizableString',
  22: 'DateTime',
  23: 'GeoLocation',
  24: 'Position',
  25: 'Url'
};

/**
 * Get human-readable name for attribute data type
 * @param {number} typeCode - Numeric type code
 * @returns {string} Human-readable type name
 */
export function getDataTypeName(typeCode) {
  return AttributeType[typeCode] || `Type ${typeCode}`;
}

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
