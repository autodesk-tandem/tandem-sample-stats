import { getEnv } from './config.js';
import { ColumnFamilies, ElementFlags, QC, Region, SystemClassNames } from './../tandem/constants.js';
import { toFullKey, toSystemId } from './../tandem/keys.js';
import { isDefaultModel } from './utils.js';

const env = getEnv();
export const tandemBaseURL = env.tandemDbBaseURL;

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
 * Get detailed information about a specific model
 * @param {string} modelURN - Model URN
 * @param {string} region - Region identifier
 * @returns {Promise<object>} Model details
 */
export async function getModelDetails(modelURN, region) {
  try {
    const requestPath = `${tandemBaseURL}/modeldata/${modelURN}`;
    const response = await fetch(requestPath, makeRequestOptionsGET(region));
    
    if (!response.ok) {
      throw new Error(`Failed to fetch model details: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching model details:', error);
    return null;
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
 * @returns {Promise<Object>} Object with stream keys as keys and their last seen values
 */
export async function getLastSeenStreamValues(facilityURN, region, streamKeys) {
  try {
    const defaultModelURN = getDefaultModelURN(facilityURN);
    
    const payload = JSON.stringify({
      keys: streamKeys
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
 * Get levels from all models in a facility
 * Levels have CategoryId === 240
 * @param {string} facilityURN - Facility URN
 * @param {string} region - Region identifier
 * @returns {Promise<Array>} Array of level objects with modelId, key, name, and elevation
 */
export async function getLevels(facilityURN, region) {
  try {
    const models = await getModels(facilityURN, region);
    const allLevels = [];
    
    for (const model of models) {
      const payload = JSON.stringify({
        qualifiedColumns: [QC.CategoryId, QC.Name, QC.Elevation], // CategoryId, Name, Elevation
        includeHistory: false
      });
      
      const requestPath = `${tandemBaseURL}/modeldata/${model.modelId}/scan`;
      const response = await fetch(requestPath, makeRequestOptionsPOST(payload, region));
      
      if (!response.ok) {
        console.error(`Failed to fetch elements for model ${model.modelId}`);
        continue;
      }
      
      const elements = await response.json();
      
      // Filter for levels (CategoryId === 240)
      const levels = elements.filter(row => row[QC.CategoryId]?.[0] === 240);
      
      // Add model info to each level
      levels.forEach(level => {
        allLevels.push({
          modelId: model.modelId,
          modelName: model.label,
          key: level[QC.Key],
          name: level[QC.Name]?.[0] || 'Unnamed Level',
          elevation: level[QC.Elevation]?.[0] // Elevation value
        });
      });
    }
    
    return allLevels;
  } catch (error) {
    console.error('Error fetching levels:', error);
    return [];
  }
}

/**
 * Get rooms from all models in a facility
 * Rooms have CategoryId === 160, Spaces have CategoryId === 3600
 * @param {string} facilityURN - Facility URN
 * @param {string} region - Region identifier
 * @param {Object} schemaCache - Optional pre-loaded schema cache to avoid duplicate API calls
 * @returns {Promise<Array>} Array of room objects with modelId, key, name, type, number, area, and volume
 */
export async function getRooms(facilityURN, region, schemaCache = null) {
  try {
    const models = await getModels(facilityURN, region);
    const allRooms = [];
    
    for (const model of models) {
      // Get schema from cache if available, otherwise fetch it
      const schema = schemaCache && schemaCache[model.modelId] 
        ? schemaCache[model.modelId] 
        : await getSchema(model.modelId);
      
      // Find the Area property (Category="Dimensions", Name="Area")
      const areaAttr = schema.attributes?.find(attr => 
        attr.category === 'Dimensions' && attr.name === 'Area'
      );
      
      // Find the Volume property (Category="Dimensions", Name="Volume")
      const volumeAttr = schema.attributes?.find(attr => 
        attr.category === 'Dimensions' && attr.name === 'Volume'
      );
      
      const areaQualifiedProp = areaAttr?.id;
      const areaUnit = areaAttr?.forgeUnit || 'square feet'; // Default to square feet if not specified
      const volumeQualifiedProp = volumeAttr?.id;
      const volumeUnit = volumeAttr?.forgeUnit || 'cubic feet'; // Default to cubic feet if not specified
      
      // Build the list of qualified columns to fetch
      const qualifiedColumns = [QC.CategoryId, QC.Name]; // CategoryId, Name
      if (areaQualifiedProp) {
        qualifiedColumns.push(areaQualifiedProp); // Add the Area qualified property
      }
      if (volumeQualifiedProp) {
        qualifiedColumns.push(volumeQualifiedProp); // Add the Volume qualified property
      }
      
      const payload = JSON.stringify({
        qualifiedColumns: qualifiedColumns,
        includeHistory: false
      });
      
      const requestPath = `${tandemBaseURL}/modeldata/${model.modelId}/scan`;
      const response = await fetch(requestPath, makeRequestOptionsPOST(payload, region));
      
      if (!response.ok) {
        console.error(`Failed to fetch elements for model ${model.modelId}`);
        continue;
      }
      
      const elements = await response.json();
      
      // Filter for rooms (CategoryId === 160)
      const rooms = elements.filter(row => row[QC.CategoryId]?.[0] === 160);
      rooms.forEach(room => {
        allRooms.push({
          modelId: model.modelId,
          modelName: model.label,
          key: room[QC.Key],
          name: room[QC.Name]?.[0] || 'Unnamed Room',
          area: areaQualifiedProp ? room[areaQualifiedProp]?.[0] : null,
          areaUnit: areaUnit,
          volume: volumeQualifiedProp ? room[volumeQualifiedProp]?.[0] : null,
          volumeUnit: volumeUnit,
          type: 'Room'
        });
      });
      
      // Filter for spaces (CategoryId === 3600)
      const spaces = elements.filter(row => row[QC.CategoryId]?.[0] === 3600);
      spaces.forEach(space => {
        allRooms.push({
          modelId: model.modelId,
          modelName: model.label,
          key: space[QC.Key],
          name: space[QC.Name]?.[0] || 'Unnamed Space',
          area: areaQualifiedProp ? space[areaQualifiedProp]?.[0] : null,
          areaUnit: areaUnit,
          volume: volumeQualifiedProp ? space[volumeQualifiedProp]?.[0] : null,
          volumeUnit: volumeUnit,
          type: 'Space'
        });
      });
    }
    
    return allRooms;
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

    for (const model of models) {
      const payload = JSON.stringify({
        families: [
          ColumnFamilies.Standard,
          ColumnFamilies.Systems
        ],
        includeHistory: false
      });
      const requestPath = `${tandemBaseURL}/modeldata/${model.modelId}/scan`;
      const response = await fetch(requestPath, makeRequestOptionsPOST(payload, region));

      if (!response.ok) {
        console.error(`Failed to fetch elements for model ${model.modelId}`);
        continue;
      }
      const data = await response.json();

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
 * Get count of tagged assets (elements with user-defined properties) from all models in a facility
 * Tagged assets are elements that have at least one property in the 'z' (DtProperties) family
 * @param {string} facilityURN - Facility URN
 * @returns {Promise<number>} Count of tagged assets
 */
export async function getTaggedAssetsCount(facilityURN) {
  try {
    const details = await getTaggedAssetsDetails(facilityURN);
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
    let totalTaggedAssets = 0;
    const propertyUsage = {}; // Map of qualifiedProp -> count
    const elementsByModel = []; // Array of {modelURN, modelName, keys}
    
    for (const model of models) {
      // Scan for elements with user-defined properties (z family = DtProperties)
      const payload = JSON.stringify({
        families: ['z'], // DtProperties column family
        includeHistory: false,
        skipArrays: true
      });
      
      const requestPath = `${tandemBaseURL}/modeldata/${model.modelId}/scan`;
      const response = await fetch(requestPath, makeRequestOptionsPOST(payload, region));
      
      if (!response.ok) {
        console.error(`Failed to fetch tagged assets for model ${model.modelId}`);
        continue;
      }
      
      const elements = await response.json();
      const modelKeys = [];
      
      // Process each element
      elements.forEach(element => {
        const keys = Object.keys(element);
        const zProperties = keys.filter(key => key.startsWith(`${ColumnFamilies.DtProperties}:`));
        
        if (zProperties.length > 0) {
          totalTaggedAssets++;
          
          // Collect element key if requested
          if (includeKeys && element[QC.Key]) {
            modelKeys.push(element[QC.Key]);
          }
          
          // Count usage of each z: property
          zProperties.forEach(prop => {
            if (!propertyUsage[prop]) {
              propertyUsage[prop] = 0;
            }
            propertyUsage[prop]++;
          });
        }
      });
      
      // Add model to results if it has tagged assets
      if (includeKeys && modelKeys.length > 0) {
        elementsByModel.push({
          modelURN: model.modelId,
          modelName: model.label || 'Unknown Model',
          keys: modelKeys
        });
      }
    }
    
    const result = {
      totalCount: totalTaggedAssets,
      propertyUsage: propertyUsage
    };
    
    if (includeKeys) {
      result.elementsByModel = elementsByModel;
    }
    
    return result;
  } catch (error) {
    console.error('Error fetching tagged assets details:', error);
    return {
      totalCount: 0,
      propertyUsage: {},
      elementsByModel: includeKeys ? [] : undefined
    };
  }
}

/**
 * Get element keys for elements that have a specific property, grouped by model
 * @param {string} facilityURN - Facility URN
 * @param {string} region - Region identifier
 * @param {string} qualifiedProp - Qualified property (e.g., 'z:LQ')
 * @returns {Promise<Array<{modelURN: string, modelName: string, keys: Array<string>}>>} Array of models with their element keys
 */
export async function getElementsByProperty(facilityURN, region, qualifiedProp) {
  try {
    const models = await getModels(facilityURN, region);
    const resultsByModel = [];
    
    // Extract family from qualified property (e.g., 'z' from 'z:LQ')
    const [family] = qualifiedProp.split(':');
    
    for (const model of models) {
      // Scan for elements with the specific property
      const payload = JSON.stringify({
        families: [family],
        qualifiedColumns: [qualifiedProp],
        includeHistory: false,
        skipArrays: true
      });
      
      const requestPath = `${tandemBaseURL}/modeldata/${model.modelId}/scan`;
      const response = await fetch(requestPath, makeRequestOptionsPOST(payload, region));
      
      if (!response.ok) {
        console.error(`Failed to fetch elements for model ${model.modelId}`);
        continue;
      }
      
      const elements = await response.json();
      const elementKeys = [];
      
      // Process each element - filter out version string
      elements.forEach(element => {
        if (typeof element === 'object' && element !== null && element[QC.Key]) {
          // Check if the element has the property
          if (element[qualifiedProp]) {
            elementKeys.push(element[QC.Key]);
          }
        }
      });
      
      // Only include models that have elements with this property
      if (elementKeys.length > 0) {
        // Determine model name
        const isDefault = isDefaultModel(facilityURN, model.modelId);
        const modelName = model.label || (isDefault ? '** Default Model **' : 'Untitled Model');
        
        resultsByModel.push({
          modelURN: model.modelId,
          modelName: modelName,
          keys: elementKeys
        });
      }
    }
    
    return resultsByModel;
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
export async function getModelProperties(modelURN, region) {
  try {
    const requestPath = `${tandemBaseURL}/models/${modelURN}/props`;
    const response = await fetch(requestPath, makeRequestOptionsGET(region, region));
    
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