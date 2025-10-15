/**
 * Utility functions for Tandem Stats
 */

import { toShortKey } from '../tandem/keys.js';

/**
 * Attribute type enum mapping from Tandem
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
 * Create a map of stream data indexed by short keys
 * The API returns data with long keys, but we need to map them back to short keys
 * Uses toShortKey from keys.js for consistency
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

/**
 * Format unit name for display
 * Converts Forge unit names to user-friendly abbreviated forms with superscripts
 * @param {string} forgeUnit - Forge unit name (e.g., "squareFeet", "squareMeters")
 * @returns {string} Abbreviated unit name (e.g., "ft²", "m²") with HTML superscripts
 */
export function formatUnitName(forgeUnit) {
  if (!forgeUnit) return '';
  
  const unitMap = {
    // CamelCase format (as returned from schema)
    'squarefeet': 'ft<sup>2</sup>',
    'squaremeters': 'm<sup>2</sup>',
    'squaremillimeters': 'mm<sup>2</sup>',
    'squarecentimeters': 'cm<sup>2</sup>',
    'squareinches': 'in<sup>2</sup>',
    'squareyards': 'yd<sup>2</sup>',
    'cubicfeet': 'ft<sup>3</sup>',
    'cubicmeters': 'm<sup>3</sup>',
    'cubicmillimeters': 'mm<sup>3</sup>',
    'cubiccentimeters': 'cm<sup>3</sup>',
    'cubicinches': 'in<sup>3</sup>',
    'cubicyards': 'yd<sup>3</sup>',
    // Space-separated format (for compatibility)
    'square feet': 'ft<sup>2</sup>',
    'square meters': 'm<sup>2</sup>',
    'square millimeters': 'mm<sup>2</sup>',
    'square centimeters': 'cm<sup>2</sup>',
    'square inches': 'in<sup>2</sup>',
    'square yards': 'yd<sup>2</sup>',
    'cubic feet': 'ft<sup>3</sup>',
    'cubic meters': 'm<sup>3</sup>',
    'cubic millimeters': 'mm<sup>3</sup>',
    'cubic centimeters': 'cm<sup>3</sup>',
    'cubic inches': 'in<sup>3</sup>',
    'cubic yards': 'yd<sup>3</sup>',
    // Linear units
    'feet': 'ft',
    'meters': 'm',
    'millimeters': 'mm',
    'centimeters': 'cm',
    'inches': 'in',
    'yards': 'yd'
  };
  
  const lowerUnit = forgeUnit.toLowerCase();
  return unitMap[lowerUnit] || forgeUnit;
}

/**
 * Check if a model is the default model for a facility
 * The default model URN is derived from the facility URN by swapping the prefix
 * @param {string} facilityURN - Facility URN (urn:adsk.dtt:...)
 * @param {string} modelURN - Model URN (urn:adsk.dtm:...)
 * @returns {boolean} True if this is the default model
 */
export function isDefaultModel(facilityURN, modelURN) {
  if (!facilityURN || !modelURN) return false;
  
  // Strip prefixes and compare
  const facilityId = facilityURN.replace('urn:adsk.dtt:', '');
  const modelId = modelURN.replace('urn:adsk.dtm:', '');
  
  return facilityId === modelId;
}
