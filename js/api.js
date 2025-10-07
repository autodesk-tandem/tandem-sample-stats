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
