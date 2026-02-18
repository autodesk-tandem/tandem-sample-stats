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
 * Parse qualified column ID into family and property (e.g. "n:n" -> { family: "n", property: "n" }).
 * @param {string} id - Qualified column ID (family:property)
 * @returns {{ family: string, property: string }}
 */
export function parseQualifiedId(id) {
  const s = (id || '').toString();
  const colon = s.indexOf(':');
  if (colon === -1) return { family: '', property: s };
  return { family: s.slice(0, colon), property: s.slice(colon + 1) };
}

/**
 * Compare two qualified column IDs for sorting: first by column family, then by property name.
 * @param {string} aId - First qualified ID
 * @param {string} bId - Second qualified ID
 * @param {boolean} ascending - True for asc, false for desc
 * @returns {number} Negative if a < b, 0 if equal, positive if a > b
 */
export function compareQualifiedColumnIds(aId, bId, ascending) {
  const aParts = parseQualifiedId(aId);
  const bParts = parseQualifiedId(bId);
  const familyCompare = aParts.family.toLowerCase().localeCompare(bParts.family.toLowerCase());
  if (familyCompare !== 0) return ascending ? familyCompare : -familyCompare;
  const propCompare = aParts.property.toLowerCase().localeCompare(bParts.property.toLowerCase());
  return ascending ? propCompare : -propCompare;
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

/**
 * Get human-readable category name from Revit category ID
 * @param {number|null} categoryId - Revit category ID
 * @returns {string} Category name
 */
export function getCategoryName(categoryId) {
  if (categoryId === null || categoryId === undefined) {
    return 'Unknown Category';
  }
  
  const categories = {
    10: "Regeneration Failure",
    11: "Walls",
    14: "Windows",
    16: "Glass",
    18: "Frame/Mullion",
    20: "Sill/Head",
    22: "Opening",
    23: "Doors",
    25: "Panel",
    27: "Opening",
    29: "Frame/Mullion",
    31: "Glass",
    32: "Floors",
    35: "Roofs",
    38: "Ceilings",
    80: "Furniture",
    100: "Columns",
    120: "Stairs",
    126: "Railings",
    150: "Generic Annotations",
    151: "Generic Models",
    160: "Rooms",
    170: "Curtain Panels",
    171: "Curtain Wall Mullions",
    180: "Ramps",
    185: "Massing",
    240: "Levels",
    260: "Dimensions",
    280: "Title Blocks",
    300: "Text Notes",
    340: "Curtain Systems",
    400: "Section Marks",
    500: "Cameras",
    510: "Viewports",
    520: "Lights",
    530: "Reference Planes",
    573: "Schedules",
    700: "Materials",
    710: "Reference Points",
    800: "Tile Pattern Grids",
    1000: "Casework",
    1040: "Electrical Equipment",
    1060: "Electrical Fixtures",
    1100: "Furniture Systems",
    1120: "Lighting Fixtures",
    1140: "Mechanical Equipment",
    1160: "Plumbing Fixtures",
    1180: "Parking",
    1220: "Roads",
    1260: "Site",
    1300: "Structural Foundations",
    1320: "Structural Framing",
    1330: "Structural Columns",
    1336: "Structural Trusses",
    1340: "Topography",
    1350: "Specialty Equipment",
    1360: "Planting",
    1370: "Entourage",
    1390: "Fascias",
    1391: "Gutters",
    1392: "Slab Edges",
    1393: "Roof Soffits",
    2000: "Detail Items",
    3000: "Profiles",
    3100: "Sheets",
    3200: "Areas",
    3400: "Mass",
    3500: "Stacked Walls",
    3600: "Spaces",
    5200: "Structural Loads",
    6000: "Scope Boxes",
    6060: "Revision Clouds",
    8000: "Ducts",
    8010: "Duct Fittings",
    8013: "Air Terminals",
    8016: "Duct Accessories",
    8020: "Flex Ducts",
    8037: "Electrical Circuits",
    8039: "Wires",
    8044: "Pipes",
    8049: "Pipe Fittings",
    8050: "Flex Pipes",
    8055: "Pipe Accessories",
    8099: "Sprinklers",
    8126: "Cable Tray Fittings",
    8128: "Conduit Fittings",
    8130: "Cable Trays",
    8132: "Conduits",
    8193: "MEP Fabrication Ductwork",
    8203: "MEP Fabrication Hangers",
    8208: "MEP Fabrication Pipework",
    8212: "MEP Fabrication Containment",
    8232: "Mechanical Control Devices",
    8234: "Plumbing Equipment",
    9000: "Structural Rebar",
    9003: "Structural Area Reinforcement",
    9009: "Structural Path Reinforcement",
    9016: "Structural Fabric Reinforcement",
    9030: "Structural Connections",
    9060: "Structural Rebar Couplers",
    9630: "Analytical Beams",
    9633: "Analytical Braces",
    9636: "Analytical Columns",
    9639: "Analytical Floors",
    9640: "Analytical Walls",
    9641: "Analytical Isolated Foundations",
    9642: "Analytical Wall Foundations",
    9643: "Analytical Foundation Slabs",
    10001: "Point Clouds",
    [-2000011]: "Walls",
    [-2000014]: "Floors",
    [-2000023]: "Doors",
    [-2000024]: "Windows",
    [-2000032]: "Roofs",
    [-2000035]: "Structural Columns",
    [-2000038]: "Ceilings",
    [-2000080]: "Structural Framing",
    [-2000151]: "Air Terminals",
    [-2000160]: "Rooms",
    [-2000240]: "Levels",
    [-2001040]: "Lighting Fixtures",
    [-2001060]: "Casework",
    [-2001100]: "Entourage",
    [-2001140]: "Mechanical Equipment",
    [-2001150]: "Electrical Equipment",
    [-2001160]: "Plumbing Fixtures",
    [-2008000]: "Ducts",
    [-2008044]: "Duct Fittings",
    [-2008049]: "Duct Accessories",
    [-2008051]: "Mechanical Equipment",
    [-2008127]: "Pipes",
    [-2008128]: "Pipe Fittings",
    [-2008130]: "Pipe Accessories"
  };
  
  return categories[categoryId] || `Category ${categoryId}`;
}
