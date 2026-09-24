import { getEnv } from './config.js';
import { ColumnFamilies, ElementFlags, QC, Region, SystemClassNames } from './../tandem/constants.js';
import { toFullKey, toSystemId } from './../tandem/keys.js';
import { isDefaultModel } from './utils.js';

const env = getEnv();
export const tandemBaseURL = env.tandemDbBaseURL;

/**
 * API Error Contract
 * ------------------
 * Functions in this module catch errors internally and return sentinel values
 * rather than throwing. This keeps the dashboard resilient (one failed card
 * doesn't crash the page), but callers cannot distinguish "no data" from
 * "API error" without checking the console.
 *
 * Return conventions on failure:
 *  - Functions returning a single object  -> return null
 *  - Functions returning an array         -> return []
 *  - Functions returning a count/number   -> return 0
 *  - Functions returning a map/object     -> return {}
 *
 * All failures are logged via console.error before returning the sentinel.
 */

/**
 * Create request options for GET requests
 * @param {string} [region] - Optional region header
 * @returns {object} Request options
 */
export function makeRequestOptionsGET(region) {
  const headers = new Headers();
  headers.append('Authorization', `Bearer ${window.sessionStorage.token}`);

  if (region) {
    headers.append('Region', region);
  }
  return {
    method: 'GET',
    headers: headers,
    redirect: 'follow'
  };
}

/**
 * Create request options for POST requests
 * @param {string} bodyPayload - JSON string payload
 * @param {string} [region] - Optional region header
 * @returns {object} Request options
 */
export function makeRequestOptionsPOST(bodyPayload, region) {
  const headers = new Headers();
  headers.append("Authorization", "Bearer " + window.sessionStorage.token);
  headers.append("Content-Type", "application/json");

  if (region) {
    headers.append('Region', region);
  }
  return {
    method: 'POST',
    headers: headers,
    body: bodyPayload,
    redirect: 'follow'
  };
}

/**
 * Get list of groups (accounts/teams)
 * @returns {Promise<Array>} List of groups
 */
export async function getGroups() {
  try {
    const requestPath = `${tandemBaseURL}/groups`;
    const response = await fetch(requestPath, makeRequestOptionsGET());
    
    if (!response.ok) {
      throw new Error(`Failed to fetch groups: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching groups:', error);
    return null;
  }
}

/**
 * Get detailed information about a specific group (account/team).
 * Returns the group definition including name, settings, and user list.
 * @param {string} groupURN - Group URN
 * @returns {Promise<object|null>} Group details object, or null on error
 */
export async function getGroupDetails(groupURN) {
  try {
    const requestPath = `${tandemBaseURL}/groups/${groupURN}`;
    const response = await fetch(requestPath, makeRequestOptionsGET());

    if (!response.ok) {
      throw new Error(`Failed to fetch group details: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching group details:', error);
    return null;
  }
}

/**
 * Get list of facilities for a specific group
 * @param {string} groupURN - Group URN
 * @returns {Promise<object>} Facilities object
 */
export async function getFacilitiesForGroup(groupURN) {
  try {
    const promises = Object.keys(Region).map(async (region) => {
      const requestPath = groupURN === '@me' ? `${tandemBaseURL}/users/@me/twins` : `${tandemBaseURL}/groups/${groupURN}/twins`;
      const response = await fetch(requestPath, makeRequestOptionsGET(region));
    
      if (!response.ok) {
        throw new Error(`Failed to fetch facilities: ${response.statusText}`);
      }
      return await response.json();
    });
    const allTwins = await Promise.all(promises);
    const results = Object.assign({}, ...allTwins);

    return results;
  } catch (error) {
    console.error('Error fetching facilities for group:', error);
    return null;
  }
}

/**
 * Get facilities shared directly with the user
 * @param {string} userId - User ID (use "@me" for current user)
 * @param {string} region - Region identifier
 * @returns {Promise<object>} Facilities object
 */
export async function getFacilitiesForUser(userId, region) {
  try {
    const requestPath = `${tandemBaseURL}/users/${userId}/twins`;
    const response = await fetch(requestPath, makeRequestOptionsGET(region));
    
    if (!response.ok) {
      throw new Error(`Failed to fetch user facilities: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching facilities for user:', error);
    return null;
  }
}

/**
 * Get all resources (twins and groups) across all regions for a user
 * @param {string} userId - User ID (use "@me" for current user)
 * @returns {Promise<object>} Object with twins and groups arrays
 */
export async function getUserResources(userId) {
  try {
    const requestPath = `${tandemBaseURL}/users/${userId}/resources`;
    const response = await fetch(requestPath, makeRequestOptionsGET());
    
    if (!response.ok) {
      throw new Error(`Failed to fetch user resources: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching user resources:', error);
    return null;
  }
}

/**
 * Get facility information
 * @param {string} facilityURN - Facility URN
 * @param {string} region - Region identifier
 * @returns {Promise<object>} Facility information
 */
export async function getFacilityInfo(facilityURN, region) {
  try {
    const requestPath = `${tandemBaseURL}/twins/${facilityURN}`;
    const response = await fetch(requestPath, makeRequestOptionsGET(region));
    
    if (!response.ok) {
      throw new Error(`Failed to fetch facility info: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching facility info:', error);
    return null;
  }
}

/**
 * Get list of models for a facility
 * @param {string} facilityURN - Facility URN
 * @param {string} region - Region identifier
 * @returns {Promise<Array>} List of models
 */
export async function getModels(facilityURN, region) {
  try {
    const facilityInfo = await getFacilityInfo(facilityURN, region);
    return facilityInfo ? facilityInfo.links : null;
  } catch (error) {
    console.error('Error fetching models:', error);
    return null;
  }
}

/**
 * Get documents for a facility
 * Documents are included in the facility info response
 * @param {string} facilityURN - Facility URN
 * @param {string} region - Region identifier
 * @returns {Promise<Array>} List of documents
 */
export async function getDocuments(facilityURN, region) {
  try {
    const facilityInfo = await getFacilityInfo(facilityURN, region);
    return facilityInfo ? facilityInfo.docs || [] : [];
  } catch (error) {
    console.error('Error fetching documents:', error);
    return [];
  }
}


/**
 * Get element count for a model
 * @param {string} modelURN - Model URN
 * @param {string} region - Region identifier
 * @returns {Promise<number>} Number of elements in the model
 */
export async function getElementCount(modelURN, region) {
  try {
    // Scan with minimal data to count elements
    const payload = JSON.stringify({
      families: [ColumnFamilies.Standard], // Standard column family
      includeHistory: false
    });
    
    const requestPath = `${tandemBaseURL}/modeldata/${modelURN}/scan`;
    const response = await fetch(requestPath, makeRequestOptionsPOST(payload, region));
    
    if (!response.ok) {
      throw new Error(`Failed to fetch elements: ${response.statusText}`);
    }
    
    const data = await response.json();
    // First element is version info, rest are elements
    return data ? data.length - 1 : 0;
  } catch (error) {
    console.error('Error fetching element count:', error);
    return 0;
  }
}

/**
 * Get element count breakdown by category, classification, tandem category, and overrides for a model
 * Fetches all in a single API call for efficiency
 * @param {string} modelURN - Model URN
 * @param {string} region - Region identifier
 * @returns {Promise<{total: number, categories: Array<{id: number|null, count: number}>, tandemCategories: Array<{id: string|null, count: number}>, classifications: Array<{id: string|null, count: number}>, nameOverrides: number, classificationOverrides: number}>}
 */
export async function getElementCountByCategoryAndClassification(modelURN, region) {
  try {
    // Fetch elements with CategoryId, TandemCategory, Classification, Name, and OName in ONE call
    const payload = JSON.stringify({
      qualifiedColumns: [QC.CategoryId, QC.TandemCategory, QC.OTandemCategory, QC.Classification, QC.OClassification, QC.Name, QC.OName],
      includeHistory: false
    });
    
    const requestPath = `${tandemBaseURL}/modeldata/${modelURN}/scan`;
    const response = await fetch(requestPath, makeRequestOptionsPOST(payload, region));
    
    if (!response.ok) {
      throw new Error(`Failed to fetch elements: ${response.statusText}`);
    }
    
    const data = await response.json();
    // Filter out version string
    const elements = data.filter(item => typeof item === 'object' && item !== null && item[QC.Key]);
    
    // Count by category
    const categoryCounts = {};
    elements.forEach(element => {
      const categoryId = element[QC.CategoryId]?.[0];
      if (categoryId !== undefined && categoryId !== null) {
        categoryCounts[categoryId] = (categoryCounts[categoryId] || 0) + 1;
      } else {
        // Elements without a category
        categoryCounts['unknown'] = (categoryCounts['unknown'] || 0) + 1;
      }
    });
    
    // Count by tandem category (prefer override, fall back to standard)
    const tandemCategoryCounts = {};
    elements.forEach(element => {
      const tandemCategory = element[QC.OTandemCategory]?.[0] || element[QC.TandemCategory]?.[0];
      if (tandemCategory !== undefined && tandemCategory !== null && tandemCategory !== '') {
        tandemCategoryCounts[tandemCategory] = (tandemCategoryCounts[tandemCategory] || 0) + 1;
      } else {
        // Elements without a tandem category
        tandemCategoryCounts['unknown'] = (tandemCategoryCounts['unknown'] || 0) + 1;
      }
    });
    
    // Count by classification (prefer override, fall back to standard)
    const classificationCounts = {};
    elements.forEach(element => {
      const classification = element[QC.OClassification]?.[0] || element[QC.Classification]?.[0];
      if (classification !== undefined && classification !== null && classification !== '') {
        classificationCounts[classification] = (classificationCounts[classification] || 0) + 1;
      } else {
        // Elements without a classification
        classificationCounts['unknown'] = (classificationCounts['unknown'] || 0) + 1;
      }
    });
    
    // Count elements with overrides
    let nameOverrideCount = 0;
    let classificationOverrideCount = 0;
    
    elements.forEach(element => {
      // Count elements that have name override (OName exists and is different from Name)
      if (element[QC.OName] && element[QC.OName][0]) {
        nameOverrideCount++;
      }
      
      // Count elements that have classification override (OClassification exists)
      if (element[QC.OClassification] && element[QC.OClassification][0]) {
        classificationOverrideCount++;
      }
    });
    
    // Convert to arrays and sort by count descending
    const categories = Object.entries(categoryCounts).map(([id, count]) => ({
      id: id === 'unknown' ? null : parseInt(id),
      count: count
    })).sort((a, b) => b.count - a.count);
    
    const tandemCategories = Object.entries(tandemCategoryCounts).map(([id, count]) => ({
      id: id === 'unknown' ? null : id,
      count: count
    })).sort((a, b) => b.count - a.count);
    
    const classifications = Object.entries(classificationCounts).map(([id, count]) => ({
      id: id === 'unknown' ? null : id,
      count: count
    })).sort((a, b) => b.count - a.count);
    
    return {
      total: elements.length,
      categories: categories,
      tandemCategories: tandemCategories,
      classifications: classifications,
      nameOverrides: nameOverrideCount,
      classificationOverrides: classificationOverrideCount
    };
  } catch (error) {
    console.error('Error fetching element count by category and classification:', error);
    return { total: 0, categories: [], tandemCategories: [], classifications: [], nameOverrides: 0, classificationOverrides: 0 };
  }
}

/**
 * Get element keys for a specific category in a model
 * @param {string} modelURN - Model URN
 * @param {string} region - Region identifier
 * @param {number|null} categoryId - Category ID (null for unknown category)
 * @returns {Promise<Array<string>>} Array of element keys
 */
export async function getElementsByCategory(modelURN, region, categoryId) {
  try {
    // Fetch elements with CategoryId
    const payload = JSON.stringify({
      qualifiedColumns: [QC.CategoryId],
      includeHistory: false
    });
    
    const requestPath = `${tandemBaseURL}/modeldata/${modelURN}/scan`;
    const response = await fetch(requestPath, makeRequestOptionsPOST(payload, region));
    
    if (!response.ok) {
      throw new Error(`Failed to fetch elements: ${response.statusText}`);
    }
    
    const data = await response.json();
    // Filter out version string
    const elements = data.filter(item => typeof item === 'object' && item !== null && item[QC.Key]);
    
    // Filter by category and extract keys
    const keys = elements
      .filter(element => {
        const elemCategoryId = element[QC.CategoryId]?.[0];
        if (categoryId === null) {
          // Match elements without a category
          return elemCategoryId === undefined || elemCategoryId === null;
        } else {
          return elemCategoryId === categoryId;
        }
      })
      .map(element => element[QC.Key]);
    
    return keys;
  } catch (error) {
    console.error('Error fetching elements by category:', error);
    return [];
  }
}

/**
 * Get element keys for a specific classification in a model
 * @param {string} modelURN - Model URN
 * @param {string} region - Region identifier
 * @param {string|null} classificationId - Classification code (null for unknown classification)
 * @returns {Promise<Array<string>>} Array of element keys
 */
export async function getElementsByClassification(modelURN, region, classificationId) {
  try {
    // Fetch elements with Classification
    const payload = JSON.stringify({
      qualifiedColumns: [QC.Classification, QC.OClassification],
      includeHistory: false
    });
    
    const requestPath = `${tandemBaseURL}/modeldata/${modelURN}/scan`;
    const response = await fetch(requestPath, makeRequestOptionsPOST(payload, region));
    
    if (!response.ok) {
      throw new Error(`Failed to fetch elements: ${response.statusText}`);
    }
    
    const data = await response.json();
    // Filter out version string
    const elements = data.filter(item => typeof item === 'object' && item !== null && item[QC.Key]);
    
    // Filter by classification and extract keys
    const keys = elements
      .filter(element => {
        const classification = element[QC.OClassification]?.[0] || element[QC.Classification]?.[0];
        if (classificationId === null) {
          // Match elements without a classification
          return !classification || classification === '';
        } else {
          return classification === classificationId;
        }
      })
      .map(element => element[QC.Key]);
    
    return keys;
  } catch (error) {
    console.error('Error fetching elements by classification:', error);
    return [];
  }
}

/**
 * Get element keys for a specific tandem category in a model
 * @param {string} modelURN - Model URN
 * @param {string} region - Region identifier
 * @param {string|null} tandemCategoryId - Tandem Category code (null for unknown category)
 * @returns {Promise<Array<string>>} Array of element keys
 */
export async function getElementsByTandemCategory(modelURN, region, tandemCategoryId) {
  try {
    // Fetch elements with TandemCategory
    const payload = JSON.stringify({
      qualifiedColumns: [QC.TandemCategory, QC.OTandemCategory],
      includeHistory: false
    });
    
    const requestPath = `${tandemBaseURL}/modeldata/${modelURN}/scan`;
    const response = await fetch(requestPath, makeRequestOptionsPOST(payload, region));
    
    if (!response.ok) {
      throw new Error(`Failed to fetch elements: ${response.statusText}`);
    }
    
    const data = await response.json();
    // Filter out version string
    const elements = data.filter(item => typeof item === 'object' && item !== null && item[QC.Key]);
    
    // Filter by tandem category and extract keys
    const keys = elements
      .filter(element => {
        const tandemCategory = element[QC.OTandemCategory]?.[0] || element[QC.TandemCategory]?.[0];
        if (tandemCategoryId === null) {
          // Match elements without a tandem category
          return !tandemCategory || tandemCategory === '';
        } else {
          return tandemCategory === tandemCategoryId;
        }
      })
      .map(element => element[QC.Key]);
    
    return keys;
  } catch (error) {
    console.error('Error fetching elements by tandem category:', error);
    return [];
  }
}

/**
 * Get element keys for elements with name overrides in a model
 * @param {string} modelURN - Model URN
 * @param {string} region - Region identifier
 * @returns {Promise<Array<string>>} Array of element keys
 */
export async function getElementsByNameOverride(modelURN, region) {
  try {
    // Fetch elements with Name and OName
    const payload = JSON.stringify({
      qualifiedColumns: [QC.Name, QC.OName],
      includeHistory: false
    });
    
    const requestPath = `${tandemBaseURL}/modeldata/${modelURN}/scan`;
    const response = await fetch(requestPath, makeRequestOptionsPOST(payload, region));
    
    if (!response.ok) {
      throw new Error(`Failed to fetch elements: ${response.statusText}`);
    }
    
    const data = await response.json();
    // Filter out version string
    const elements = data.filter(item => typeof item === 'object' && item !== null && item[QC.Key]);
    
    // Filter elements that have name override and extract keys
    const keys = elements
      .filter(element => {
        // Has name override if OName exists and has a value
        return element[QC.OName] && element[QC.OName][0];
      })
      .map(element => element[QC.Key]);
    
    return keys;
  } catch (error) {
    console.error('Error fetching elements by name override:', error);
    return [];
  }
}

/**
 * Get element keys for elements with classification overrides in a model
 * @param {string} modelURN - Model URN
 * @param {string} region - Region identifier
 * @returns {Promise<Array<string>>} Array of element keys
 */
export async function getElementsByClassificationOverride(modelURN, region) {
  try {
    // Fetch elements with Classification and OClassification
    const payload = JSON.stringify({
      qualifiedColumns: [QC.Classification, QC.OClassification],
      includeHistory: false
    });
    
    const requestPath = `${tandemBaseURL}/modeldata/${modelURN}/scan`;
    const response = await fetch(requestPath, makeRequestOptionsPOST(payload, region));
    
    if (!response.ok) {
      throw new Error(`Failed to fetch elements: ${response.statusText}`);
    }
    
    const data = await response.json();
    // Filter out version string
    const elements = data.filter(item => typeof item === 'object' && item !== null && item[QC.Key]);
    
    // Filter elements that have classification override and extract keys
    const keys = elements
      .filter(element => {
        // Has classification override if OClassification exists and has a value
        return element[QC.OClassification] && element[QC.OClassification][0];
      })
      .map(element => element[QC.Key]);
    
    return keys;
  } catch (error) {
    console.error('Error fetching elements by classification override:', error);
    return [];
  }
}

// Track blob URLs for cleanup
const thumbnailBlobURLs = new Set();

/**
 * Get facility thumbnail as a blob URL
 * @param {string} facilityURN - Facility URN
 * @param {string} region - Region identifier
 * @returns {Promise<string|null>} Blob URL for the thumbnail image, or null if not available
 */
export async function getFacilityThumbnail(facilityURN, region) {
  try {
    const requestPath = `${tandemBaseURL}/twins/${facilityURN}/thumbnail`;
    const response = await fetch(requestPath, makeRequestOptionsGET(region));
    
    if (!response.ok) {
      return null; // No thumbnail available
    }
    
    const blob = await response.blob();
    // Convert blob to blob URL for display
    const blobURL = URL.createObjectURL(blob);
    thumbnailBlobURLs.add(blobURL);
    return blobURL;
  } catch (error) {
    console.error('Error fetching facility thumbnail:', error);
    return null;
  }
}

/**
 * Clean up all thumbnail blob URLs to prevent memory leaks
 * Should be called when switching facilities or on page unload
 */
export function cleanupThumbnailURLs() {
  thumbnailBlobURLs.forEach(url => URL.revokeObjectURL(url));
  thumbnailBlobURLs.clear();
  console.log('Cleaned up thumbnail blob URLs');
}

/**
 * Get the default model URN from a facility URN
 * The default model URN is derived by swapping the prefix
 * @param {string} facilityURN - Facility URN (urn:adsk.dtt:...)
 * @returns {string} Default model URN (urn:adsk.dtm:...)
 */
export function getDefaultModelURN(facilityURN) {
  return facilityURN.replace('urn:adsk.dtt:', 'urn:adsk.dtm:');
}

/**
 * Get facility parameters from the root element of the default model.
 *
 * Facility parameters are DtProperties stored on the DocumentRoot element
 * (ElementFlags 0x01000002) of the default model. The root element is
 * created automatically when a default model exists.
 *
 * @param {string} facilityURN - Facility URN
 * @param {string} region - Region identifier
 * @returns {Promise<Array>} Array of { id, category, name, value, dataType, forgeUnit }
 */
export async function getFacilityParameters(facilityURN, region) {
  try {
    const defaultModelURN = getDefaultModelURN(facilityURN);

    const payload = JSON.stringify({
      families: [ColumnFamilies.Standard, ColumnFamilies.DtProperties],
      includeHistory: false
    });

    const requestPath = `${tandemBaseURL}/modeldata/${defaultModelURN}/scan`;
    const response = await fetch(requestPath, makeRequestOptionsPOST(payload, region));

    if (!response.ok) {
      if (response.status === 403) {
        console.log('No default model found — facility parameters not available');
        return [];
      }
      throw new Error(`Failed to fetch default model elements: ${response.statusText}`);
    }

    const data = await response.json();
    const rootElement = data.find(
      row => row[QC.ElementFlags]?.[0] === ElementFlags.DocumentRoot
    );

    if (!rootElement) {
      return [];
    }

    const schemaPath = `${tandemBaseURL}/modeldata/${defaultModelURN}/schema`;
    const schemaResp = await fetch(schemaPath, makeRequestOptionsGET(region));

    if (!schemaResp.ok) {
      throw new Error(`Failed to fetch schema: ${schemaResp.statusText}`);
    }

    const schema = await schemaResp.json();
    const attrLookup = new Map();
    for (const attr of (schema.attributes || [])) {
      attrLookup.set(attr.id, attr);
    }

    const parameters = [];
    for (const [id, value] of Object.entries(rootElement)) {
      if (!id.startsWith(`${ColumnFamilies.DtProperties}:`)) {
        continue;
      }
      const attr = attrLookup.get(id);
      if (!attr) {
        continue;
      }
      parameters.push({
        id,
        category: attr.category || '',
        name: attr.name || '',
        value: Array.isArray(value) ? value[0] : value,
        dataType: attr.dataType,
        forgeUnit: attr.forgeUnit || '',
        context: attr.context || ''
      });
    }

    parameters.sort((a, b) => {
      const cat = a.category.localeCompare(b.category);
      return cat !== 0 ? cat : a.name.localeCompare(b.name);
    });

    return parameters;
  } catch (error) {
    console.error('Error fetching facility parameters:', error);
    return [];
  }
}

/**
 * Get streams from the default model
 * Streams only exist in the default model
 * @param {string} facilityURN - Facility URN
 * @param {string} region - Region identifier
 * @returns {Promise<Array>} Array of stream objects
 */
export async function getStreams(facilityURN, region) {
  try {
    const defaultModelURN = getDefaultModelURN(facilityURN);
    
    const payload = JSON.stringify({
      families: [
        ColumnFamilies.Standard,
        ColumnFamilies.DtProperties,
        ColumnFamilies.Xrefs
      ], // Standard, DtProperties, and Xrefs column families
      includeHistory: false
    });
    
    const requestPath = `${tandemBaseURL}/modeldata/${defaultModelURN}/scan`;
    const response = await fetch(requestPath, makeRequestOptionsPOST(payload, region));
    
    if (!response.ok) {
      // 403 Forbidden typically means no default model exists yet
      if (response.status === 403) {
        console.log('No default model found - streams not available');
        return [];
      }
      throw new Error(`Failed to fetch streams: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Filter for elements that are streams (ElementFlags.Stream)
    const streams = data.filter(row => {
      const flags = row[QC.ElementFlags];
      return flags && flags[0] === ElementFlags.Stream;
    });
    
    return streams;
  } catch (error) {
    console.error('Error fetching streams:', error);
    return [];
  }
}

/**
 * Get all stream configurations for the default model
 * @param {string} facilityURN - Facility URN
 * @param {string} region - Region identifier
 * @returns {Promise<Array>} Array of stream configuration objects
 */
export async function getStreamConfigs(facilityURN, region) {
  try {
    const defaultModelURN = getDefaultModelURN(facilityURN);
    const requestPath = `${tandemBaseURL}/models/${defaultModelURN}/stream-configs`;
    const response = await fetch(requestPath, makeRequestOptionsGET(region));
    
    if (!response.ok) {
      if (response.status === 403 || response.status === 404) {
        console.log('Stream configurations not available');
        return [];
      }
      throw new Error(`Failed to fetch stream configurations: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching stream configurations:', error);
    return [];
  }
}

/**
 * Get tickets from the default model
 * Tickets only exist in the default model
 * @param {string} facilityURN - Facility URN
 * @param {string} region - Region identifier
 * @returns {Promise<Array>} Array of ticket objects
 */
export async function getTickets(facilityURN, region) {
  try {
    const defaultModelURN = getDefaultModelURN(facilityURN);
    
    const payload = JSON.stringify({
      families: [
        ColumnFamilies.Standard,
        ColumnFamilies.Refs,
        ColumnFamilies.Xrefs
      ],
      includeHistory: false
    });
    
    const requestPath = `${tandemBaseURL}/modeldata/${defaultModelURN}/scan`;
    const response = await fetch(requestPath, makeRequestOptionsPOST(payload, region));
    
    if (!response.ok) {
      if (response.status === 403) {
        console.log('No default model found - tickets not available');
        return [];
      }
      throw new Error(`Failed to fetch tickets: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Filter for elements that are tickets (ElementFlags.Ticket)
    const tickets = data.filter(row => {
      const flags = row[QC.ElementFlags];
      return flags && flags[0] === ElementFlags.Ticket;
    });
    
    return tickets;
  } catch (error) {
    console.error('Error fetching tickets:', error);
    return [];
  }
}

/**
 * Get a single stream configuration
 * @param {string} facilityURN - Facility URN
 * @param {string} region - Region identifier
 * @param {string} streamKey - Stream key
 * @returns {Promise<Object|null>} Stream configuration object or null
 */
export async function getStreamConfig(facilityURN, region, streamKey) {
  try {
    const defaultModelURN = getDefaultModelURN(facilityURN);
    const requestPath = `${tandemBaseURL}/models/${defaultModelURN}/stream-configs/${streamKey}`;
    const response = await fetch(requestPath, makeRequestOptionsGET(region));
    
    if (!response.ok) {
      if (response.status === 404) {
        console.log(`Stream configuration not found for ${streamKey}`);
        return null;
      }
      throw new Error(`Failed to fetch stream configuration: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching stream configuration:', error);
    return null;
  }
}

/**
 * Get element details by keys
 * @param {string} modelURN - Model URN
 * @param {string} region - Region identifier
 * @param {Array<string>} keys - Array of element keys
 * @returns {Promise<Array>} Array of element objects
 */
export async function getElementsByKeys(modelURN, region, keys) {
  try {
    const payload = JSON.stringify({
      keys: keys,
      families: [ColumnFamilies.Standard], // Standard column family for name
      includeHistory: false
    });
    
    const requestPath = `${tandemBaseURL}/modeldata/${modelURN}/scan`;
    const response = await fetch(requestPath, makeRequestOptionsPOST(payload, region));
    
    if (!response.ok) {
      throw new Error(`Failed to fetch elements: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Filter out version string (first element) and only return objects with a 'k' property
    const elements = data.filter(item => typeof item === 'object' && item !== null && item.k);
    
    return elements;
  } catch (error) {
    console.error('Error fetching elements by keys:', error);
    return [];
  }
}

/**
 * Get last seen values for streams
 * @param {string} facilityURN - Facility URN
 * @param {string} region - Region identifier
 * @param {Array<string>} streamKeys - Array of stream keys
 * @param {boolean} [roundToSeconds=false] - If true, timestamps in the response are in seconds
 *   (instead of the default milliseconds). Useful when displaying human-readable times.
 * @returns {Promise<Object>} Object with stream keys as keys and their last seen values
 */
export async function getLastSeenStreamValues(facilityURN, region, streamKeys, roundToSeconds = false) {
  try {
    const defaultModelURN = getDefaultModelURN(facilityURN);
    
    const payload = JSON.stringify({
      keys: streamKeys,
      roundToSeconds: roundToSeconds
    });
    
    const requestPath = `${tandemBaseURL}/timeseries/models/${defaultModelURN}/streams`;
    const response = await fetch(requestPath, makeRequestOptionsPOST(payload, region));
    
    if (!response.ok) {
      throw new Error(`Failed to fetch last seen stream values: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching last seen stream values:', error);
    return {};
  }
}

/**
 * Get stream values for a given time range
 * @param {string} facilityURN - Facility URN
 * @param {string} region - Region identifier
 * @param {string} streamKey - Stream key
 * @param {number} daysBack - Number of days back to fetch (default 30)
 * @returns {Promise<Object>} Object with stream values
 */
export async function getStreamValues(facilityURN, region, streamKey, daysBack = 30) {
  try {
    const defaultModelURN = getDefaultModelURN(facilityURN);
    
    const dateNow = new Date();
    const timestampEnd = dateNow.getTime();
    
    const dateMinus = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);
    const timestampStart = dateMinus.getTime();
    
    const requestPath = `${tandemBaseURL}/timeseries/models/${defaultModelURN}/streams/${streamKey}?start=${timestampStart}&end=${timestampEnd}`;
    const response = await fetch(requestPath, makeRequestOptionsGET(region));
    
    if (!response.ok) {
      throw new Error(`Failed to fetch stream values: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching stream values:', error);
    return null;
  }
}

/**
 * Get schema for a model
 * Schema contains attribute definitions with id (qualified property), category, name, dataType, etc.
 * @param {string} modelURN - Model URN
 * @param {string} region - Region identifier
 * @returns {Promise<Object>} Schema object with attributes array
 */
export async function getSchema(modelURN, region) {
  try {
    const requestPath = `${tandemBaseURL}/modeldata/${modelURN}/schema`;
    const response = await fetch(requestPath, makeRequestOptionsGET(region));
    
    if (!response.ok) {
      throw new Error(`Failed to fetch schema: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching schema:', error);
    return { attributes: [] };
  }
}

/**
 * Get levels from all models in a facility.
 * Uses ElementFlags.Level (0x01000001) to identify levels.
 * Fetches all models in parallel with Promise.all() for maximum speed.
 * @param {string} facilityURN - Facility URN
 * @param {string} region - Region identifier
 * @returns {Promise<Array>} Array of level objects with modelId, key, name, and elevation
 */
export async function getLevels(facilityURN, region) {
  try {
    const models = await getModels(facilityURN, region);

    const perModelResults = await Promise.all(
      models.map(async (model) => {
        const payload = JSON.stringify({
          qualifiedColumns: [QC.ElementFlags, QC.Name, QC.Elevation],
          includeHistory: false
        });

        const requestPath = `${tandemBaseURL}/modeldata/${model.modelId}/scan`;
        const response = await fetch(requestPath, makeRequestOptionsPOST(payload, region));

        if (!response.ok) {
          console.error(`getLevels: failed to fetch model ${model.modelId}`);
          return []; // return empty array so Promise.all can still complete
        }

        const elements = await response.json();

        // Filter for levels and map to a clean output shape
        return elements
          .filter(row => row[QC.ElementFlags]?.[0] === ElementFlags.Level)
          .map(level => ({
            modelId:   model.modelId,
            modelName: model.label,
            key:       level[QC.Key],
            name:      level[QC.Name]?.[0] || 'Unnamed Level',
            elevation: level[QC.Elevation]?.[0]
          }));
      })
    );

    return perModelResults.flat();
  } catch (error) {
    console.error('Error fetching levels:', error);
    return [];
  }
}

/**
 * Get rooms and spaces from all models in a facility
 * Uses ElementFlags.Room (0x00000005) to identify both Rooms and Spaces
 * Then uses CategoryId to differentiate: 160 = Room, 3600 = Space
 * @param {string} facilityURN - Facility URN
 * @param {string} region - Region identifier
 * @param {Object} schemaCache - Optional pre-loaded schema cache to avoid duplicate API calls
 * @returns {Promise<Array>} Array of room objects with modelId, key, name, type, number, area, and volume
 */
export async function getRooms(facilityURN, region, schemaCache = null) {
  try {
    const models = await getModels(facilityURN, region);

    // Each model independently resolves its schema (cache hit if pre-loaded)
    // then fires its scan. All models run their schema→scan pipeline concurrently.
    const perModelResults = await Promise.all(
      models.map(async (model) => {
        const schema = schemaCache && schemaCache[model.modelId]
          ? schemaCache[model.modelId]
          : await getSchema(model.modelId);

        const areaAttr   = schema.attributes?.find(a => a.category === 'Dimensions' && a.name === 'Area');
        const volumeAttr = schema.attributes?.find(a => a.category === 'Dimensions' && a.name === 'Volume');
        const areaQualifiedProp   = areaAttr?.id;
        const areaUnit            = areaAttr?.forgeUnit   || 'square feet';
        const volumeQualifiedProp = volumeAttr?.id;
        const volumeUnit          = volumeAttr?.forgeUnit || 'cubic feet';

        // ElementFlags.Room matches both rooms (CategoryId 160) and spaces (CategoryId 3600)
        const qualifiedColumns = [QC.ElementFlags, QC.CategoryId, QC.Name];
        if (areaQualifiedProp)   qualifiedColumns.push(areaQualifiedProp);
        if (volumeQualifiedProp) qualifiedColumns.push(volumeQualifiedProp);

        const payload = JSON.stringify({ qualifiedColumns, includeHistory: false });
        const requestPath = `${tandemBaseURL}/modeldata/${model.modelId}/scan`;
        const response = await fetch(requestPath, makeRequestOptionsPOST(payload, region));

        if (!response.ok) {
          console.error(`getRooms: failed to fetch model ${model.modelId}`);
          return [];
        }

        const elements = await response.json();
        return elements
          .filter(row => row[QC.ElementFlags]?.[0] === ElementFlags.Room)
          .map(element => {
            const categoryId  = element[QC.CategoryId]?.[0];
            const type        = categoryId === 3600 ? 'Space' : 'Room';
            const defaultName = categoryId === 3600 ? 'Unnamed Space' : 'Unnamed Room';
            return {
              modelId:   model.modelId,
              modelName: model.label,
              key:       element[QC.Key],
              name:      element[QC.Name]?.[0] || defaultName,
              area:      areaQualifiedProp   ? element[areaQualifiedProp]?.[0]   : null,
              areaUnit,
              volume:    volumeQualifiedProp ? element[volumeQualifiedProp]?.[0] : null,
              volumeUnit,
              type
            };
          });
      })
    );

    return perModelResults.flat();
  } catch (error) {
    console.error('Error fetching rooms:', error);
    return [];
  }
}

/**
 * Get systems from the default model
 * Systems are elements with ElementFlags.Systems flag
 * @param {string} facilityURN - Facility URN
 * @param {string} region - Region identifier
 * @param {Array} models - Array of model objects
 * @returns {Promise<Array>} Array of system objects with name, key, systemId, and subsystems
 */
export async function getSystems(facilityURN, region, models) {
  try {
    const defaultModelURN = getDefaultModelURN(facilityURN);
    
    const payload = JSON.stringify({
      families: [
        ColumnFamilies.Standard,
        ColumnFamilies.Systems,
        ColumnFamilies.Refs
      ],
      includeHistory: false
    });
    
    const requestPath = `${tandemBaseURL}/modeldata/${defaultModelURN}/scan`;
    const response = await fetch(requestPath, makeRequestOptionsPOST(payload, region));
    
    if (!response.ok) {
      // 403 Forbidden typically means no default model exists yet
      if (response.status === 403) {
        console.log('No default model found - systems not available');
        return [];
      }
      throw new Error(`Failed to fetch systems: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Filter for elements that are systems (ElementFlags.System)
    const systemElements = data.filter(row => {
      const flags = row[QC.ElementFlags];
      return flags && flags[0] === ElementFlags.System;
    });
    
    // Process systems and build hierarchy
    const systems = [];
    const subsystems = [];
    
    for (const item of systemElements) {
      const name = item[QC.OName]?.[0] ?? item[QC.Name]?.[0];
      const key = item[QC.Key];
      const parent = item[QC.Parent]?.[0];
      
      if (parent) {
        // This is a subsystem
        subsystems.push({
          name: name || 'Unnamed Subsystem',
          key: key,
          parent: parent,
          systemClass: item[QC.OSystemClass]?.[0] ?? item[QC.SystemClass]?.[0]
        });
      } else {
        // This is a main system
        const fullKey = toFullKey(key, true);
        const systemId = toSystemId(fullKey);
        
        systems.push({
          name: name || 'Unnamed System',
          key: key,
          systemId: systemId,
          systemClass: item[QC.OSystemClass]?.[0] ?? item[QC.SystemClass]?.[0],
          elementCount: 0 // will be calculated later
        });
      }
    }
    
    // Attach subsystems to their parent systems
    systems.forEach(system => {
      system.subsystems = subsystems.filter(sub => sub.parent === system.key);
    });
    // calculate element count for each system and track by model
    const systemMap = {};

    for (const system of systems) {
      systemMap[system.systemId] = system;
      // Initialize elementsByModel as an object to group keys by model
      system.elementsByModel = {};
    }
    const systemElementsMap = {};
    const systemClassMap = {};

    // ── Fetch all model element data in parallel ──────────────────────────
    // All model scans fire simultaneously; processing of shared state
    // (systemMap, systemElementsMap) happens sequentially after all fetches
    // complete, so there are no shared-accumulator race conditions.
    const modelDataList = await Promise.all(
      models.map(async (model) => {
        const payload = JSON.stringify({
          families: [ColumnFamilies.Standard, ColumnFamilies.Systems],
          includeHistory: false
        });
        const requestPath = `${tandemBaseURL}/modeldata/${model.modelId}/scan`;
        const response    = await fetch(requestPath, makeRequestOptionsPOST(payload, region));

        if (!response.ok) {
          console.error(`getSystems: failed to fetch model ${model.modelId}`);
          return { model, data: [] };
        }
        return { model, data: await response.json() };
      })
    );

    // ── Process fetched data (sequential — pure CPU, no network) ─────────
    for (const { model, data } of modelDataList) {
      for (const element of data) {
        const key = element[QC.Key];

        if (!key) {
          continue;
        }
        const elementFlags = element[QC.ElementFlags]?.[0];

        if (elementFlags === ElementFlags.Deleted || elementFlags === ElementFlags.System) {
          continue;
        }
        const elementClass = element[QC.OSystemClass] ?? element[QC.SystemClass];

        if (!elementClass) {
          continue;
        }
        let elementClassNames = systemClassMap[elementClass];

        if (!elementClassNames) {
          elementClassNames = systemClassToList(elementClass);
          systemClassMap[elementClass] = elementClassNames;
        }
        for (const item in element) {
          // we need to handle both fam:col and fam:!col formats
          const [, family, systemId] = item.match(/^([^:]+):!?(.+)$/) ?? [];

          if (family !== ColumnFamilies.Systems) {
            continue;
          }
          const system = systemMap[systemId];

          if (!system) {
            continue;
          }
          let classNames = systemClassMap[system.systemClass];

          if (!classNames) {
            classNames = systemClassToList(system.systemClass);
            systemClassMap[system.systemClass] = classNames;
          }
          const matches = elementClassNames.some(name => classNames.includes(name));

          if (matches) {
            // Track total count
            const elementList = systemElementsMap[systemId] || new Set();
            elementList.add(key);
            systemElementsMap[systemId] = elementList;
            
            // Track by model
            if (!system.elementsByModel[model.modelId]) {
              system.elementsByModel[model.modelId] = {
                modelURN: model.modelId,
                modelName: model.label || 'Unknown Model',
                keys: new Set()
              };
            }
            system.elementsByModel[model.modelId].keys.add(key);
          }
        }
      }
    }
    // update element count and convert Sets to Arrays
    for (const system of systems) {
      const elementSet = systemElementsMap[system.systemId];
      system.elementCount = elementSet ? elementSet.size : 0;
      
      // Convert elementsByModel Sets to Arrays
      system.elementsByModel = Object.values(system.elementsByModel).map(model => ({
        modelURN: model.modelURN,
        modelName: model.modelName,
        keys: Array.from(model.keys)
      }));
    }
    return systems;
  } catch (error) {
    console.error('Error fetching systems:', error);
    return [];
  }
}

/**
 * Returns true when an element type is eligible to be a tagged asset.
 * Physical elements (flags 0x00–0x04) and GenericAsset (0x01000005) are eligible.
 * Rooms, Levels, Streams, Tickets, Systems, etc. are not.
 * @param {number|undefined} flags - Element flags value from QC.ElementFlags
 * @returns {boolean}
 */
function isAssetCandidate(flags) {
  if (flags === undefined || flags === null) return false;
  return flags <= 0x00000004 || flags === ElementFlags.GenericAsset;
}

/**
 * Get count of tagged assets from all models in a facility.
 * An element is a tagged asset when the n:ia (IsAsset) field is present and truthy.
 * For older elements that predate this field, the fallback is: eligible element type
 * AND has at least one z: (user-defined) property.
 * @param {string} facilityURN - Facility URN
 * @param {string} [region] - Optional region identifier
 * @returns {Promise<number>} Count of tagged assets
 */
export async function getTaggedAssetsCount(facilityURN, region) {
  try {
    const details = await getTaggedAssetsDetails(facilityURN, region);
    return details.totalCount;
  } catch (error) {
    console.error('Error fetching tagged assets count:', error);
    return 0;
  }
}

/**
 * Get detailed information about tagged assets and their user-defined properties
 * @param {string} facilityURN - Facility URN
 * @param {string} region - Region identifier
 * @param {boolean} includeKeys - If true, also collect element keys grouped by model
 * @returns {Promise<Object>} Object with totalCount, propertyUsage, and optionally elementsByModel
 */
export async function getTaggedAssetsDetails(facilityURN, region, includeKeys = false) {
  try {
    const models = await getModels(facilityURN, region);
    const t0 = performance.now();

    // ── Helper: classify a single element as tagged asset or not ──────────
    // Extracted so both implementations share the same logic.
    function classifyElement(element) {
      const isAssetFlag    = element[QC.IsAsset];
      const hasIsAssetField = isAssetFlag !== undefined && isAssetFlag !== null;
      if (hasIsAssetField) {
        // n:ia present: its value is the authoritative answer. The field is set
        // automatically when a z: property is first written and persists even if
        // those properties are later removed.
        return !!isAssetFlag;
      }
      // n:ia absent (older elements): fall back to eligible element type AND has z: properties.
      const flags     = element[QC.ElementFlags];
      const hasZProps = Object.keys(element).some(k => k.startsWith(`${ColumnFamilies.DtProperties}:`));
      return isAssetCandidate(flags) && hasZProps;
    }

    // ── Helper: build a per-model result object from raw scan data ────────
    function processModelElements(model, rawData) {
      const elements  = rawData.filter(item => typeof item === 'object' && item !== null && item[QC.Key]);
      const modelKeys = [];
      let   count     = 0;
      const props     = {}; // propId -> count

      elements.forEach(element => {
        if (!classifyElement(element)) return;
        count++;
        if (includeKeys && element[QC.Key]) modelKeys.push(element[QC.Key]);

        // Track z: property usage (separate from asset counting)
        Object.keys(element)
          .filter(k => k.startsWith(`${ColumnFamilies.DtProperties}:`))
          .forEach(prop => { props[prop] = (props[prop] || 0) + 1; });
      });

      return { model, count, modelKeys, props };
    }

    // ── Fetch all models in parallel ─────────────────────────────────────
    // Each model scan returns a plain result object via processModelElements.
    // Shared accumulators are only written after all fetches complete, so
    // there are no race conditions when merging results below.
    // IMPORTANT: Must include Standard family to get the IsAsset flag.
    const perModelResults = await Promise.all(
      models.map(async (model) => {
        const payload = JSON.stringify({
          families: [ColumnFamilies.Standard, ColumnFamilies.DtProperties],
          includeHistory: false,
          skipArrays: true
        });
        const requestPath = `${tandemBaseURL}/modeldata/${model.modelId}/scan`;
        const response    = await fetch(requestPath, makeRequestOptionsPOST(payload, region));

        if (!response.ok) {
          console.error(`getTaggedAssetsDetails: failed to fetch model ${model.modelId}`);
          return { model, count: 0, modelKeys: [], props: {} };
        }

        const rawData = await response.json();
        return processModelElements(model, rawData);
      })
    );

    // ── Merge results ─────────────────────────────────────────────────────
    let totalTaggedAssets    = 0;
    const propertyUsageByModel = {};
    const elementsByModel      = [];

    for (const { model, count, modelKeys, props } of perModelResults) {
      totalTaggedAssets += count;

      if (Object.keys(props).length > 0) {
        propertyUsageByModel[model.modelId] = { modelName: model.label || '', props };
      }

      if (includeKeys && modelKeys.length > 0) {
        elementsByModel.push({
          modelURN:  model.modelId,
          modelName: model.label || 'Unknown Model',
          keys:      modelKeys
        });
      }
    }

    const result = { totalCount: totalTaggedAssets, propertyUsageByModel };
    if (includeKeys) result.elementsByModel = elementsByModel;
    return result;

  } catch (error) {
    console.error('Error fetching tagged assets details:', error);
    return { totalCount: 0, propertyUsage: {}, elementsByModel: includeKeys ? [] : undefined };
  }
}

/**
 * Get element keys for elements that have a specific property, grouped by model
 * @param {string} facilityURN - Facility URN
 * @param {string} region - Region identifier
 * @param {string} qualifiedProp - Qualified property (e.g., 'z:LQ')
 * @param {string} [modelIdFilter] - If set, only scan this model (e.g. from Tagged Assets row); avoids scanning all models and ensures correct model
 * @returns {Promise<Array<{modelURN: string, modelName: string, keys: Array<string>}>>} Array of models with their element keys
 */
export async function getElementsByProperty(facilityURN, region, qualifiedProp, modelIdFilter = null) {
  try {
    const models       = await getModels(facilityURN, region);
    const modelsToScan = modelIdFilter
      ? models.filter(m => m.modelId === modelIdFilter)
      : models;

    // Use same scan shape as getTaggedAssetsDetails (no qualifiedColumns) so the server
    // returns all columns in the requested families; we filter client-side for the property.
    // This avoids server omitting or normalizing the column id when requested explicitly.
    const [family] = qualifiedProp.split(':');
    const families  = family === ColumnFamilies.DtProperties
      ? [ColumnFamilies.Standard, ColumnFamilies.DtProperties]
      : [family];

    const perModelResults = await Promise.all(
      modelsToScan.map(async (model) => {
        const payload     = JSON.stringify({ families, includeHistory: false, skipArrays: true });
        const requestPath = `${tandemBaseURL}/modeldata/${model.modelId}/scan`;
        const response    = await fetch(requestPath, makeRequestOptionsPOST(payload, region));

        if (!response.ok) {
          console.error(`getElementsByProperty: failed to fetch model ${model.modelId}`);
          return null;
        }

        const rawData     = await response.json();
        const elementKeys = rawData
          .filter(item => typeof item === 'object' && item !== null && item[QC.Key])
          .filter(element => Object.prototype.hasOwnProperty.call(element, qualifiedProp))
          .map(element => element[QC.Key]);

        if (elementKeys.length === 0) return null;

        const isDefault = isDefaultModel(facilityURN, model.modelId);
        const modelName = model.label || (isDefault ? '** Default Model **' : 'Untitled Model');
        return { modelURN: model.modelId, modelName, keys: elementKeys };
      })
    );

    // Filter out nulls (models with no matching elements)
    return perModelResults.filter(Boolean);
  } catch (error) {
    console.error('Error fetching elements by property:', error);
    return [];
  }
}

function systemClassToList(flags) {
  if (!flags) {
    return [];
  }
  const result = [];

	for (let i = 0; i < SystemClassNames.length; i++) {
		if (flags & (1 << i)) {
			result.push(SystemClassNames[i]);
		}
	}
	return result;
}

/**
 * Get change history for a model
 * @param {string} modelURN - Model URN
 * @param {string} region - Region identifier
 * @param {Object} options - History query options
 * @param {Array<number>} options.timestamps - Specific timestamps to query (milliseconds)
 * @param {number} options.min - Minimum timestamp for range query (milliseconds)
 * @param {number} options.max - Maximum timestamp for range query (milliseconds)
 * @param {number} options.limit - Limit number of results
 * @param {boolean} options.includeChanges - Include detailed change information (default: true)
 * @returns {Promise<Array>} Array of history entries
 */
export async function getHistory(modelURN, region, options = {}) {
  try {
    // Build payload object, only including defined properties
    const payloadObj = {
      includeChanges: options.includeChanges !== false,
      useFullKeys: true
    };
    
    // Only add optional parameters if they are explicitly provided
    if (options.timestamps !== undefined) {
      payloadObj.timestamps = options.timestamps;
    }
    if (options.min !== undefined) {
      payloadObj.min = options.min;
    }
    if (options.max !== undefined) {
      payloadObj.max = options.max;
    }
    if (options.limit !== undefined) {
      payloadObj.limit = options.limit;
    }
    
    const payload = JSON.stringify(payloadObj);
    
    const requestPath = `${tandemBaseURL}/modeldata/${modelURN}/history`;
    const response = await fetch(requestPath, makeRequestOptionsPOST(payload, region));
    
    if (!response.ok) {
      throw new Error(`Failed to fetch history: ${response.statusText}`);
    }
    
    const history = await response.json();
    return history;
  } catch (error) {
    console.error('Error fetching history:', error);
    return [];
  }
}

/**
 * Get facility/twin history (ACL changes)
 * @param {string} facilityURN - Facility URN
 * @param {string} region - Region identifier
 * @param {Object} options - History query options
 * @param {number} options.min - Minimum timestamp for range query (milliseconds)
 * @param {number} options.max - Maximum timestamp for range query (milliseconds)
 * @param {boolean} options.includeChanges - Include detailed change information (default: true)
 * @returns {Promise<Array>} Array of history entries
 */
export async function getTwinHistory(facilityURN, region, options = {}) {
  try {
    const payloadObj = {
      includeChanges: options.includeChanges !== false
    };
    
    if (options.min !== undefined) {
      payloadObj.min = options.min;
    }
    if (options.max !== undefined) {
      payloadObj.max = options.max;
    }
    
    const payload = JSON.stringify(payloadObj);
    const requestPath = `${tandemBaseURL}/twins/${facilityURN}/history`;
    const response = await fetch(requestPath, makeRequestOptionsPOST(payload, region));
    
    if (!response.ok) {
      throw new Error(`Failed to fetch twin history: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching twin history:', error);
    return [];
  }
}

/**
 * Get group history (ACL changes)
 * @param {string} groupURN - Group URN
 * @param {Object} options - History query options
 * @param {number} options.min - Minimum timestamp for range query (milliseconds)
 * @param {number} options.max - Maximum timestamp for range query (milliseconds)
 * @param {boolean} options.includeChanges - Include detailed change information (default: true)
 * @returns {Promise<Array>} Array of history entries
 */
export async function getGroupHistory(groupURN, options = {}) {
  try {
    const payloadObj = {
      includeChanges: options.includeChanges !== false
    };
    
    if (options.min !== undefined) {
      payloadObj.min = options.min;
    }
    if (options.max !== undefined) {
      payloadObj.max = options.max;
    }
    
    const payload = JSON.stringify(payloadObj);
    const requestPath = `${tandemBaseURL}/groups/${groupURN}/history`;
    const response = await fetch(requestPath, makeRequestOptionsPOST(payload));
    
    if (!response.ok) {
      throw new Error(`Failed to fetch group history: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching group history:', error);
    return [];
  }
}

/**
 * Get model properties (phase, last updated, etc.)
 * @param {string} modelURN - Model URN
 * @param {string} region - Region identifier
 * @returns {Promise<Object|null>} Model properties object or null if error
 */
/**
 * Get the list of users who have access to a facility.
 * @param {string} facilityURN - Facility URN
 * @param {string} region - Region identifier
 * @returns {Promise<Object>} Dictionary of userId -> { name, email, accessLevel }
 */
export async function getFacilityUsers(facilityURN, region) {
  try {
    const requestPath = `${tandemBaseURL}/twins/${facilityURN}/users`;
    const response = await fetch(requestPath, makeRequestOptionsGET(region));

    if (!response.ok) {
      throw new Error(`Failed to fetch facility users: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching facility users:', error);
    return {};
  }
}

/**
 * Get the saved views for a facility.
 * @param {string} facilityURN - Facility URN
 * @param {string} region - Region identifier
 * @returns {Promise<Array>} Array of view objects with viewName, id, etc.
 */
export async function getFacilityViews(facilityURN, region) {
  try {
    const requestPath = `${tandemBaseURL}/twins/${facilityURN}/views`;
    const response = await fetch(requestPath, makeRequestOptionsGET(region));

    if (!response.ok) {
      throw new Error(`Failed to fetch facility views: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching facility views:', error);
    return [];
  }
}

export async function getModelProperties(modelURN, region) {
  try {
    const requestPath = `${tandemBaseURL}/models/${modelURN}/props`;
    const response = await fetch(requestPath, makeRequestOptionsGET(region));
    
    if (!response.ok) {
      throw new Error(`Failed to fetch model properties: ${response.statusText}`);
    }
    
    const props = await response.json();
    return props;
  } catch (error) {
    console.error('Error fetching model properties:', error);
    return null;
  }
}