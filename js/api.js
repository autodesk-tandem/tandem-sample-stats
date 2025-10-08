import { getEnv } from './config.js';

const env = getEnv();
export const tandemBaseURL = env.tandemDbBaseURL;

/**
 * Create request options for GET requests
 * @returns {object} Request options
 */
export function makeRequestOptionsGET() {
  const headers = new Headers();
  headers.append("Authorization", "Bearer " + window.sessionStorage.token);

  return {
    method: 'GET',
    headers: headers,
    redirect: 'follow'
  };
}

/**
 * Create request options for POST requests
 * @param {string} bodyPayload - JSON string payload
 * @returns {object} Request options
 */
export function makeRequestOptionsPOST(bodyPayload) {
  const headers = new Headers();
  headers.append("Authorization", "Bearer " + window.sessionStorage.token);
  headers.append("Content-Type", "application/json");

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
    const requestPath = `${tandemBaseURL}/groups/${groupURN}/twins`;
    const response = await fetch(requestPath, makeRequestOptionsGET());
    
    if (!response.ok) {
      throw new Error(`Failed to fetch facilities: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching facilities for group:', error);
    return null;
  }
}

/**
 * Get facilities shared directly with the user
 * @param {string} userId - User ID (use "@me" for current user)
 * @returns {Promise<object>} Facilities object
 */
export async function getFacilitiesForUser(userId) {
  try {
    const requestPath = `${tandemBaseURL}/users/${userId}/twins`;
    const response = await fetch(requestPath, makeRequestOptionsGET());
    
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
 * Get facility information
 * @param {string} facilityURN - Facility URN
 * @returns {Promise<object>} Facility information
 */
export async function getFacilityInfo(facilityURN) {
  try {
    const requestPath = `${tandemBaseURL}/twins/${facilityURN}`;
    const response = await fetch(requestPath, makeRequestOptionsGET());
    
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
 * @returns {Promise<Array>} List of models
 */
export async function getModels(facilityURN) {
  try {
    const facilityInfo = await getFacilityInfo(facilityURN);
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
 * @returns {Promise<Array>} List of documents
 */
export async function getDocuments(facilityURN) {
  try {
    const facilityInfo = await getFacilityInfo(facilityURN);
    return facilityInfo ? facilityInfo.docs || [] : [];
  } catch (error) {
    console.error('Error fetching documents:', error);
    return [];
  }
}

/**
 * Get detailed information about a specific model
 * @param {string} modelURN - Model URN
 * @returns {Promise<object>} Model details
 */
export async function getModelDetails(modelURN) {
  try {
    const requestPath = `${tandemBaseURL}/modeldata/${modelURN}`;
    const response = await fetch(requestPath, makeRequestOptionsGET());
    
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
 * @returns {Promise<number>} Number of elements in the model
 */
export async function getElementCount(modelURN) {
  try {
    // Scan with minimal data to count elements
    const payload = JSON.stringify({
      families: ['n'], // Standard column family
      includeHistory: false
    });
    
    const requestPath = `${tandemBaseURL}/modeldata/${modelURN}/scan`;
    const response = await fetch(requestPath, makeRequestOptionsPOST(payload));
    
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
 * Get facility thumbnail as a blob URL
 * @param {string} facilityURN - Facility URN
 * @returns {Promise<string|null>} Blob URL for the thumbnail image, or null if not available
 */
export async function getFacilityThumbnail(facilityURN) {
  try {
    const requestPath = `${tandemBaseURL}/twins/${facilityURN}/thumbnail`;
    const response = await fetch(requestPath, makeRequestOptionsGET());
    
    if (!response.ok) {
      return null; // No thumbnail available
    }
    
    const blob = await response.blob();
    // Convert blob to blob URL for display
    return URL.createObjectURL(blob);
  } catch (error) {
    console.error('Error fetching facility thumbnail:', error);
    return null;
  }
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
 * @returns {Promise<Array>} Array of stream objects
 */
export async function getStreams(facilityURN) {
  try {
    const defaultModelURN = getDefaultModelURN(facilityURN);
    
    const payload = JSON.stringify({
      families: ['n', 'z'], // Standard and DtProperties column families
      includeHistory: false
    });
    
    const requestPath = `${tandemBaseURL}/modeldata/${defaultModelURN}/scan`;
    const response = await fetch(requestPath, makeRequestOptionsPOST(payload));
    
    if (!response.ok) {
      throw new Error(`Failed to fetch streams: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Filter for elements that are streams (ElementFlags.Stream === 0x01000003 = 16777219)
    // Stream flag value from dt-schema.js ElementFlags.Stream
    const STREAM_FLAG = 0x01000003; // 16777219 in decimal
    const streams = data.filter(row => {
      const flags = row['n:a']; // Element flags (n:a = Standard:ElementFlags)
      return flags && flags[0] === STREAM_FLAG;
    });
    
    return streams;
  } catch (error) {
    console.error('Error fetching streams:', error);
    return [];
  }
}

/**
 * Get last seen values for streams
 * @param {string} facilityURN - Facility URN
 * @param {Array<string>} streamKeys - Array of stream keys
 * @returns {Promise<Object>} Object with stream keys as keys and their last seen values
 */
export async function getLastSeenStreamValues(facilityURN, streamKeys) {
  try {
    const defaultModelURN = getDefaultModelURN(facilityURN);
    
    const payload = JSON.stringify({
      keys: streamKeys
    });
    
    const requestPath = `${tandemBaseURL}/timeseries/models/${defaultModelURN}/streams`;
    const response = await fetch(requestPath, makeRequestOptionsPOST(payload));
    
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
 * Get schema for a model
 * Schema contains attribute definitions with id (qualified property), category, name, dataType, etc.
 * @param {string} modelURN - Model URN
 * @returns {Promise<Object>} Schema object with attributes array
 */
export async function getSchema(modelURN) {
  try {
    const requestPath = `${tandemBaseURL}/modeldata/${modelURN}/schema`;
    const response = await fetch(requestPath, makeRequestOptionsGET());
    
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
 * @returns {Promise<Array>} Array of level objects with modelId, key, name, and elevation
 */
export async function getLevels(facilityURN) {
  try {
    const models = await getModels(facilityURN);
    const allLevels = [];
    
    for (const model of models) {
      const payload = JSON.stringify({
        qualifiedColumns: ['n:c', 'n:n', 'n:e'], // CategoryId, Name, Elevation
        includeHistory: false
      });
      
      const requestPath = `${tandemBaseURL}/modeldata/${model.modelId}/scan`;
      const response = await fetch(requestPath, makeRequestOptionsPOST(payload));
      
      if (!response.ok) {
        console.error(`Failed to fetch elements for model ${model.modelId}`);
        continue;
      }
      
      const elements = await response.json();
      
      // Filter for levels (CategoryId === 240)
      const levels = elements.filter(row => row['n:c']?.[0] === 240);
      
      // Add model info to each level
      levels.forEach(level => {
        allLevels.push({
          modelId: model.modelId,
          modelName: model.label,
          key: level.k,
          name: level['n:n']?.[0] || 'Unnamed Level',
          elevation: level['n:e']?.[0] // Elevation value
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
 * @param {Object} schemaCache - Optional pre-loaded schema cache to avoid duplicate API calls
 * @returns {Promise<Array>} Array of room objects with modelId, key, name, type, number, area, and volume
 */
export async function getRooms(facilityURN, schemaCache = null) {
  try {
    const models = await getModels(facilityURN);
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
      const qualifiedColumns = ['n:c', 'n:n']; // CategoryId, Name
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
      const response = await fetch(requestPath, makeRequestOptionsPOST(payload));
      
      if (!response.ok) {
        console.error(`Failed to fetch elements for model ${model.modelId}`);
        continue;
      }
      
      const elements = await response.json();
      
      // Filter for rooms (CategoryId === 160)
      const rooms = elements.filter(row => row['n:c']?.[0] === 160);
      rooms.forEach(room => {
        allRooms.push({
          modelId: model.modelId,
          modelName: model.label,
          key: room.k,
          name: room['n:n']?.[0] || 'Unnamed Room',
          area: areaQualifiedProp ? room[areaQualifiedProp]?.[0] : null,
          areaUnit: areaUnit,
          volume: volumeQualifiedProp ? room[volumeQualifiedProp]?.[0] : null,
          volumeUnit: volumeUnit,
          type: 'Room'
        });
      });
      
      // Filter for spaces (CategoryId === 3600)
      const spaces = elements.filter(row => row['n:c']?.[0] === 3600);
      spaces.forEach(space => {
        allRooms.push({
          modelId: model.modelId,
          modelName: model.label,
          key: space.k,
          name: space['n:n']?.[0] || 'Unnamed Space',
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
 * Get count of tagged assets (elements with user-defined properties) from all models in a facility
 * Tagged assets are elements that have at least one property in the 'z' (DtProperties) family
 * @param {string} facilityURN - Facility URN
 * @returns {Promise<number>} Count of tagged assets
 */
export async function getTaggedAssetsCount(facilityURN) {
  try {
    const models = await getModels(facilityURN);
    let totalTaggedAssets = 0;
    
    for (const model of models) {
      // Scan for elements with user-defined properties (z family = DtProperties)
      const payload = JSON.stringify({
        families: ['z'], // DtProperties column family
        includeHistory: false,
        skipArrays: true
      });
      
      const requestPath = `${tandemBaseURL}/modeldata/${model.modelId}/scan`;
      const response = await fetch(requestPath, makeRequestOptionsPOST(payload));
      
      if (!response.ok) {
        console.error(`Failed to fetch tagged assets for model ${model.modelId}`);
        continue;
      }
      
      const elements = await response.json();
      
      // Filter for elements that have at least one z: property (user-defined property)
      const taggedElements = elements.filter(element => {
        const keys = Object.keys(element);
        // Check if any key starts with 'z:' (excluding the 'k' key which is the element key)
        return keys.some(key => key.startsWith('z:'));
      });
      
      totalTaggedAssets += taggedElements.length;
    }
    
    return totalTaggedAssets;
  } catch (error) {
    console.error('Error fetching tagged assets:', error);
    return 0;
  }
}
