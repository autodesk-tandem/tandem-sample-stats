import { getSchema } from '../api.js';

// Schema cache: modelURN -> { attributes: [...], lookup: Map(qualifiedProp -> attribute) }
const schemaCache = {};

/**
 * Load and cache schema for a model
 * @param {string} modelURN - Model URN
 * @returns {Promise<Object>} Schema object with attributes array and lookup map
 */
export async function loadSchemaForModel(modelURN) {
  if (schemaCache[modelURN]) {
    return schemaCache[modelURN];
  }
  
  const schema = await getSchema(modelURN);
  
  // Create a lookup map for quick property lookups
  const lookup = new Map();
  if (schema.attributes) {
    schema.attributes.forEach(attr => {
      lookup.set(attr.id, attr);
    });
  }
  
  schemaCache[modelURN] = {
    attributes: schema.attributes || [],
    lookup: lookup
  };
  
  return schemaCache[modelURN];
}

/**
 * Get human-readable display name for a qualified property
 * @param {string} modelURN - Model URN
 * @param {string} qualifiedProp - Qualified property ID (e.g., "z:LQ")
 * @returns {Promise<string>} Display name (e.g., "Category.PropertyName") or the qualified prop if not found
 */
export async function getPropertyDisplayName(modelURN, qualifiedProp) {
  const schema = await loadSchemaForModel(modelURN);
  const attr = schema.lookup.get(qualifiedProp);
  
  if (attr && attr.category && attr.name) {
    return `${attr.category}.${attr.name}`;
  }
  
  return qualifiedProp;
}

/**
 * Get the schema cache object
 * @returns {Object} Schema cache
 */
export function getSchemaCache() {
  return schemaCache;
}

/**
 * Clear the schema cache
 * Should be called when switching facilities to prevent data from accumulating
 */
export function clearSchemaCache() {
  for (const key in schemaCache) {
    delete schemaCache[key];
  }
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

