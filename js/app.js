import { login, logout, checkLogin } from './auth.js';
import { 
  getGroups, 
  getFacilitiesForGroup, 
  getFacilitiesForUser, 
  getFacilityInfo,
  getFacilityThumbnail,
  cleanupThumbnailURLs,
  getModels,
  getStreams,
  getSystems,
  getLevels,
  getRooms,
  getDocuments
} from './api.js';
import { loadSchemaForModel, getSchemaCache, clearSchemaCache } from './state/schemaCache.js';
import { displayModels } from './features/models.js';
import { displayLevels } from './features/levels.js';
import { displayRooms } from './features/rooms.js';
import { displayDocuments } from './features/documents.js';
import { displayStreams } from './features/streams.js';
import { displaySystems } from './features/systems.js';
import { displaySchema } from './features/schema.js';
import { displayTaggedAssets } from './features/taggedAssets.js';
import { displayDiagnostics } from './features/diagnostics.js';
import { displaySearch } from './features/search.js';
import { SchemaVersion } from '../tandem/constants.js';

// DOM Elements
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const userProfileLink = document.getElementById('userProfileLink');
const userProfileImg = document.getElementById('userProfileImg');
const accountSelect = document.getElementById('accountSelect');
const facilitySelect = document.getElementById('facilitySelect');
const welcomeMessage = document.getElementById('welcomeMessage');
const dashboardContent = document.getElementById('dashboardContent');
const loadingOverlay = document.getElementById('loadingOverlay');
const facilityInfo = document.getElementById('facilityInfo');
const modelsList = document.getElementById('modelsList');
const streamsList = document.getElementById('streamsList');
const searchContainer = document.getElementById('searchContainer');
const systemsList = document.getElementById('systemsList');
const levelsList = document.getElementById('levelsList');
const roomsList = document.getElementById('roomsList');
const documentsList = document.getElementById('documentsList');
const schemaList = document.getElementById('schemaList');
const taggedAssetsList = document.getElementById('taggedAssetsList');
const diagnosticsList = document.getElementById('diagnosticsList');

// State
let accounts = [];
let currentFacilityURN = null;

/**
 * Toggle loading overlay
 * @param {boolean} show - Show or hide the loading overlay
 */
function toggleLoading(show) {
  if (show) {
    loadingOverlay.classList.remove('hidden');
  } else {
    loadingOverlay.classList.add('hidden');
  }
}

/**
 * Update UI based on login state
 * @param {boolean} loggedIn - Whether user is logged in
 * @param {string} profileImg - URL to user's profile image
 */
function updateUIForLoginState(loggedIn, profileImg) {
  if (loggedIn) {
    loginBtn.classList.add('hidden');
    logoutBtn.classList.remove('hidden');
    welcomeMessage.classList.add('hidden');
    dashboardContent.classList.remove('hidden');
    
    if (profileImg) {
      userProfileImg.src = profileImg;
      userProfileLink.classList.remove('hidden');
    }
    
    accountSelect.classList.remove('hidden');
    facilitySelect.classList.remove('hidden');
  } else {
    loginBtn.classList.remove('hidden');
    logoutBtn.classList.add('hidden');
    userProfileLink.classList.add('hidden');
    welcomeMessage.classList.remove('hidden');
    dashboardContent.classList.add('hidden');
    accountSelect.classList.add('hidden');
    facilitySelect.classList.add('hidden');
  }
}

/**
 * Build accounts and facilities data structure
 * @returns {Promise<Array>} Array of account objects with facilities
 */
async function buildAccountsAndFacilities() {
  try {
    const groups = await getGroups();
    const accounts = [];

    // For each group, get its facilities
    for (const group of groups) {
      const facilitiesObj = await getFacilitiesForGroup(group.urn);
      // Convert object to array: { "urn": {settings}, ... } -> [{urn, settings}, ...]
      const facilities = facilitiesObj ? Object.entries(facilitiesObj).map(([urn, settings]) => ({
        urn,
        settings
      })) : [];
      
      accounts.push({
        id: group.urn,
        name: group.name || 'Unnamed Account',
        facilities: facilities.map(f => ({
          urn: f.urn,
          name: f.settings?.props?.["Identity Data"]?.["Building Name"] || 'Unnamed Facility'
        }))
      });
    }

    // Also get facilities for user (not associated with a group)
    const userFacilitiesObj = await getFacilitiesForUser('@me');
    if (userFacilitiesObj) {
      // Convert object to array
      const userFacilities = Object.entries(userFacilitiesObj).map(([urn, settings]) => ({
        urn,
        settings
      }));
      
      if (userFacilities.length > 0) {
        accounts.push({
          id: 'user',
          name: '** SHARED DIRECTLY **',
          facilities: userFacilities.map(f => ({
            urn: f.urn,
            name: f.settings?.props?.["Identity Data"]?.["Building Name"] || 'Unnamed Facility'
          }))
        });
      }
    }

    return accounts;
  } catch (error) {
    console.error('Error building accounts and facilities:', error);
    return [];
  }
}

/**
 * Populate accounts dropdown
 * @param {Array} accounts - Array of account objects
 */
function populateAccountsDropdown(accounts) {
  accountSelect.innerHTML = '<option value="">Select Account...</option>';
  
  // Sort accounts alphabetically by name, but put "** SHARED DIRECTLY **" at the end
  const sortedAccounts = [...accounts].sort((a, b) => {
    const sharedDirectlyName = '** SHARED DIRECTLY **';
    
    // If 'a' is the shared account, it should come after 'b'
    if (a.name === sharedDirectlyName) return 1;
    // If 'b' is the shared account, it should come after 'a'
    if (b.name === sharedDirectlyName) return -1;
    
    // Otherwise, sort alphabetically
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  });
  
  sortedAccounts.forEach(account => {
    const option = document.createElement('option');
    option.value = account.name;
    option.textContent = account.name;
    accountSelect.appendChild(option);
  });

  // Try to restore last selected account, or select the first one
  const lastAccount = window.localStorage.getItem('tandem-sample-stats-last-account');
  let selectedAccount = null;
  
  if (lastAccount && accounts.some(a => a.name === lastAccount)) {
    // Restore previously selected account if it exists
    selectedAccount = lastAccount;
  } else if (sortedAccounts.length > 0) {
    // Otherwise, select the first account in the list
    selectedAccount = sortedAccounts[0].name;
  }
  
  if (selectedAccount) {
    accountSelect.value = selectedAccount;
    populateFacilitiesDropdown(accounts, selectedAccount);
    
    // Remove placeholder after selection
    const placeholder = accountSelect.querySelector('option[value=""]');
    if (placeholder) placeholder.remove();
  }
}

/**
 * Get the last used facility for a specific account
 * @param {string} accountName - Name of the account
 * @returns {string|null} - Facility URN or null
 */
function getLastFacilityForAccount(accountName) {
  try {
    const facilitiesJson = window.localStorage.getItem('tandem-sample-stats-last-facilities');
    if (!facilitiesJson) return null;
    
    const facilitiesMap = JSON.parse(facilitiesJson);
    return facilitiesMap[accountName] || null;
  } catch (error) {
    console.error('Error reading last facilities from localStorage:', error);
    return null;
  }
}

/**
 * Set the last used facility for a specific account
 * @param {string} accountName - Name of the account
 * @param {string} facilityURN - Facility URN
 */
function setLastFacilityForAccount(accountName, facilityURN) {
  try {
    const facilitiesJson = window.localStorage.getItem('tandem-sample-stats-last-facilities');
    const facilitiesMap = facilitiesJson ? JSON.parse(facilitiesJson) : {};
    
    facilitiesMap[accountName] = facilityURN;
    window.localStorage.setItem('tandem-sample-stats-last-facilities', JSON.stringify(facilitiesMap));
  } catch (error) {
    console.error('Error saving last facilities to localStorage:', error);
  }
}

/**
 * Populate facilities dropdown based on selected account
 * @param {Array} accounts - Array of account objects
 * @param {string} accountName - Selected account name
 */
function populateFacilitiesDropdown(accounts, accountName) {
  facilitySelect.innerHTML = '<option value="">Select Facility...</option>';
  
  const account = accounts.find(a => a.name === accountName);
  if (!account) return;
  
  // Sort facilities alphabetically by name
  const sortedFacilities = [...account.facilities].sort((a, b) => 
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  );
  
  sortedFacilities.forEach(facility => {
    const option = document.createElement('option');
    option.value = facility.urn;
    option.textContent = facility.name;
    facilitySelect.appendChild(option);
  });

  // Try to restore last selected facility for THIS account, or select the first one
  const lastFacility = getLastFacilityForAccount(accountName);
  let selectedFacilityURN = null;
  
  if (lastFacility && account.facilities.some(f => f.urn === lastFacility)) {
    // Restore previously selected facility if it exists in this account
    selectedFacilityURN = lastFacility;
  } else if (sortedFacilities.length > 0) {
    // Otherwise, select the first facility in the list
    selectedFacilityURN = sortedFacilities[0].urn;
  }
  
  if (selectedFacilityURN) {
    facilitySelect.value = selectedFacilityURN;
    loadFacility(selectedFacilityURN);
    
    // Remove placeholder after selection
    const placeholder = facilitySelect.querySelector('option[value=""]');
    if (placeholder) placeholder.remove();
  }
}

/**
 * Load facility information and statistics
 * @param {string} facilityURN - Facility URN
 */
async function loadFacility(facilityURN) {
  if (currentFacilityURN === facilityURN) {
    return; // Already loaded
  }
  
  currentFacilityURN = facilityURN;
  toggleLoading(true);
  
  try {
    // Get facility info and thumbnail in parallel
    const [info, thumbnailUrl] = await Promise.all([
      getFacilityInfo(facilityURN),
      getFacilityThumbnail(facilityURN)
    ]);
    
    if (info) {
      const buildingName = info.props?.["Identity Data"]?.["Building Name"] || "Unknown";
      const location = info.props?.["Identity Data"]?.["Address"] || null;
      const owner = info.props?.["Identity Data"]?.["Owner"] || null;
      const projectName = info.props?.["Identity Data"]?.["Project Name"] || null;
      const timeZone = info.props?.["Identity Data"]?.["timeZone"] || null;
      const templateName = info.template?.name || null;
      const schemaVersion = info.schemaVersion;
      const region = info.region || null;
      
      facilityInfo.innerHTML = `
        <div class="flex flex-col md:flex-row gap-6">
          ${thumbnailUrl ? `
          <div class="flex-shrink-0">
            <img src="${thumbnailUrl}" 
                 alt="Facility Thumbnail" 
                 class="w-full md:w-64 h-48 object-cover rounded border border-dark-border">
          </div>
          ` : ''}
          <div class="flex-grow space-y-2">
            <div>
              <span class="font-medium text-dark-text text-xs">Building Name:</span>
              <span class="text-dark-text-secondary ml-2 text-xs">${buildingName}</span>
            </div>
            ${location ? `
            <div>
              <span class="font-medium text-dark-text text-xs">Location:</span>
              <span class="text-dark-text-secondary ml-2 text-xs">${location}</span>
            </div>
            ` : ''}
            ${owner ? `
            <div>
              <span class="font-medium text-dark-text text-xs">Owner:</span>
              <span class="text-dark-text-secondary ml-2 text-xs">${owner}</span>
            </div>
            ` : ''}
            ${projectName ? `
            <div>
              <span class="font-medium text-dark-text text-xs">Project Name:</span>
              <span class="text-dark-text-secondary ml-2 text-xs">${projectName}</span>
            </div>
            ` : ''}
            ${timeZone ? `
            <div>
              <span class="font-medium text-dark-text text-xs">Time Zone:</span>
              <span class="text-dark-text-secondary ml-2 text-xs">${timeZone}</span>
            </div>
            ` : ''}
            ${templateName ? `
            <div>
              <span class="font-medium text-dark-text text-xs">Facility Template:</span>
              <span class="text-dark-text-secondary ml-2 text-xs">${templateName}</span>
            </div>
            ` : ''}
            <div>
              <span class="font-medium text-dark-text text-xs">Schema Version:</span>
              <span class="text-dark-text-secondary ml-2 text-xs">${schemaVersion !== undefined ? schemaVersion : 'Unknown'}</span>
            </div>
            ${region ? `
            <div>
              <span class="font-medium text-dark-text text-xs">Primary Storage Region:</span>
              <span class="text-dark-text-secondary ml-2 text-xs">${region}</span>
            </div>
            ` : ''}
            <div>
              <span class="font-medium text-dark-text text-xs">Facility URN:</span>
              <span class="text-dark-text-secondary ml-2 text-xs font-mono break-all">${facilityURN}</span>
            </div>
          </div>
        </div>
      `;
      
      // Check schema version - API only supports version 2
      if (schemaVersion < SchemaVersion) {
        // Clear all data sections
        modelsList.innerHTML = `<p class="text-yellow-500 text-xs">⚠️ Facility data not loaded due to incompatible schema version.</p>`;
        streamsList.innerHTML = `<p class="text-yellow-500 text-xs">⚠️ Facility data not loaded due to incompatible schema version.</p>`;
        searchContainer.innerHTML = `<p class="text-yellow-500 text-xs">⚠️ Facility data not loaded due to incompatible schema version.</p>`;
        taggedAssetsList.innerHTML = `<p class="text-yellow-500 text-xs">⚠️ Facility data not loaded due to incompatible schema version.</p>`;
        levelsList.innerHTML = `<p class="text-yellow-500 text-xs">⚠️ Facility data not loaded due to incompatible schema version.</p>`;
        roomsList.innerHTML = `<p class="text-yellow-500 text-xs">⚠️ Facility data not loaded due to incompatible schema version.</p>`;
        documentsList.innerHTML = `<p class="text-yellow-500 text-xs">⚠️ Facility data not loaded due to incompatible schema version.</p>`;
        systemsList.innerHTML = `<p class="text-yellow-500 text-xs">⚠️ Facility data not loaded due to incompatible schema version.</p>`;
        schemaList.innerHTML = `<p class="text-yellow-500 text-xs">⚠️ Facility data not loaded due to incompatible schema version.</p>`;
        diagnosticsList.innerHTML = `<p class="text-yellow-500 text-xs">⚠️ Facility data not loaded due to incompatible schema version.</p>`;
        
        // Show prominent error message
        facilityInfo.innerHTML += `
          <div class="mt-4 p-4 bg-yellow-900/30 border border-yellow-700 rounded">
            <div class="flex items-start space-x-3">
              <svg class="w-6 h-6 text-yellow-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
              </svg>
              <div>
                <h3 class="text-sm font-semibold text-yellow-500 mb-1">Incompatible Schema Version</h3>
                <p class="text-xs text-yellow-200 mb-2">
                  This facility is using schema version <strong>${schemaVersion !== undefined ? schemaVersion : 'Unknown'}</strong>. 
                  The API currently only supports <strong>schema version 2</strong>.
                </p>
                <p class="text-xs text-yellow-200">
                  To view detailed statistics for this facility, please upgrade it by opening it in Autodesk Tandem first.
                </p>
              </div>
            </div>
          </div>
        `;
        
        return; // Skip loading stats
      }
    }

    // Load stats (only if schema version is 2)
    await loadStats(facilityURN);
    
  } catch (error) {
    console.error('Error loading facility:', error);
    facilityInfo.innerHTML = `<p class="text-red-600">Error loading facility information</p>`;
  } finally {
    toggleLoading(false);
  }
}


/**
 * Load and display facility statistics
 * @param {string} facilityURN - Facility URN
 */
async function loadStats(facilityURN) {
  try {
    // Clear schema cache from previous facility
    clearSchemaCache();
    
    // Note: Don't cleanup thumbnail URLs here - they're still being displayed!
    // Cleanup happens only on page unload via beforeunload event
    
    // Get models
    const models = await getModels(facilityURN);
    
    // Pre-load and cache schemas for all models FIRST
    // This ensures we only call /schema once per model
    for (const model of models) {
      await loadSchemaForModel(model.modelId);
    }
    
    // Get schema cache for passing to downstream functions
    const schemaCache = getSchemaCache();
    
    // Display all sections using feature modules
    await displayModels(modelsList, models, facilityURN);
    
    // Check if default model exists before fetching streams
    // Streams only exist in the default model
    const defaultModelURN = facilityURN.replace('urn:adsk.dtt:', 'urn:adsk.dtm:');
    const hasDefaultModel = models.some(m => m.modelId === defaultModelURN);
    
    const streams = hasDefaultModel ? await getStreams(facilityURN) : [];
    await displayStreams(streamsList, streams, facilityURN);
    
    // Display search interface
    await displaySearch(searchContainer, facilityURN, models);
    
    // Get and display systems (only if default model exists)
    const systems = hasDefaultModel ? await getSystems(facilityURN, models) : [];
    await displaySystems(systemsList, systems, facilityURN);
    
    // Display tagged assets
    await displayTaggedAssets(taggedAssetsList, facilityURN, models);
    
    const levels = await getLevels(facilityURN);
    await displayLevels(levelsList, levels, facilityURN);
    
    const rooms = await getRooms(facilityURN, schemaCache);
    await displayRooms(roomsList, rooms, facilityURN);
    
    const documents = await getDocuments(facilityURN);
    await displayDocuments(documentsList, documents);
    
    await displaySchema(schemaList, models, facilityURN);
    
    // Display diagnostics (must be after schema is loaded)
    await displayDiagnostics(diagnosticsList, facilityURN, models);
    
  } catch (error) {
    console.error('Error loading stats:', error);
  }
}

/**
 * Initialize the application
 */
async function initialize() {
  // Set up event listeners
  loginBtn.addEventListener('click', login);
  logoutBtn.addEventListener('click', logout);

  accountSelect.addEventListener('change', (e) => {
    const accountName = e.target.value;
    if (accountName) {
      window.localStorage.setItem('tandem-sample-stats-last-account', accountName);
      populateFacilitiesDropdown(accounts, accountName);
      // Remove placeholder after selection
      const placeholder = accountSelect.querySelector('option[value=""]');
      if (placeholder) placeholder.remove();
    }
  });

  facilitySelect.addEventListener('change', (e) => {
    const facilityURN = e.target.value;
    if (facilityURN) {
      // Save last facility per account
      const accountName = accountSelect.value;
      if (accountName) {
        setLastFacilityForAccount(accountName, facilityURN);
      }
      loadFacility(facilityURN);
      // Remove placeholder after selection
      const placeholder = facilitySelect.querySelector('option[value=""]');
      if (placeholder) placeholder.remove();
    }
  });

  // Check login status
  toggleLoading(true);
  const { loggedIn, profileImg } = await checkLogin();
  
  if (loggedIn) {
    updateUIForLoginState(true, profileImg);
    
    // Load accounts and facilities
    accounts = await buildAccountsAndFacilities();
    
    if (accounts && accounts.length > 0) {
      populateAccountsDropdown(accounts);
    } else {
      facilityInfo.innerHTML = '<p class="text-red-600">No accounts or facilities found. Please ensure you have access to at least one Tandem facility.</p>';
    }
  } else {
    updateUIForLoginState(false, null);
  }
  
  toggleLoading(false);
}

// Clean up blob URLs when page is unloaded to prevent memory leaks
window.addEventListener('beforeunload', () => {
  cleanupThumbnailURLs();
});

// Start the application when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}
