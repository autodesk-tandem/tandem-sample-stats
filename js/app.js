import { login, logout, checkLogin } from './shared/auth.js';
import { getEnv } from './shared/config.js';
import { 
  getGroups, 
  getFacilitiesForGroup, 
  getFacilitiesForUser, 
  getFacilityInfo,
  getFacilityThumbnail,
  cleanupThumbnailURLs,
  getModels,
  getDocuments,
  getUserResources,
  tandemBaseURL,
  makeRequestOptionsGET
} from './shared/api.js';
import { loadSchemaForModel, getSchemaCache, clearSchemaCache } from './shared/state/schemaCache.js';
import { displayModels } from './shared/features/models.js';
import { displayLevels } from './shared/features/levels.js';
import { displayRooms } from './shared/features/rooms.js';
import { displayDocuments } from './shared/features/documents.js';
import { displayStreams } from './shared/features/streams.js';
import { displayTickets } from './shared/features/tickets.js';
import { displaySystems } from './shared/features/systems.js';
import { displaySchema } from './shared/features/schema.js';
import { displayTaggedAssets } from './shared/features/taggedAssets.js';
import { displayDiagnostics } from './shared/features/diagnostics.js';
import { displaySearch } from './shared/features/search.js';
import { viewUserResources } from './shared/features/userResources.js';
import { viewFacilityHistory } from './shared/features/facilityHistory.js';
import { viewFacilityUsers } from './shared/features/facilityUsers.js';
import { viewFacilityViews } from './shared/features/facilityViews.js';
import { viewFacilityParameters } from './shared/features/facilityParameters.js';
import { setActiveVersion, getActiveVersion } from './shared/version.js';
import { RegionLabelMap } from '../tandem/constants.js';

/**
 * Schema version modules. Each folder implements the same interface (see shared/version.js);
 * only the selected one is downloaded. Add a new version here and nowhere else in the shell.
 */
const versionLoaders = {
  2: () => import('./v2/index.js'),
  3: () => import('./v3/index.js')
};
const DEFAULT_SCHEMA_VERSION = 2;
const VERSION_STORAGE_KEY = 'tandem-sample-stats-schema-version';

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
const viewUserResourcesBtn = document.getElementById('viewUserResourcesBtn');
const viewFacilityHistoryBtn = document.getElementById('viewFacilityHistoryBtn');
const viewFacilityUsersBtn = document.getElementById('viewFacilityUsersBtn');
const viewFacilityViewsBtn = document.getElementById('viewFacilityViewsBtn');
const viewFacilityParametersBtn = document.getElementById('viewFacilityParametersBtn');
const modelsList = document.getElementById('modelsList');
const streamsList = document.getElementById('streamsList');
const ticketsList = document.getElementById('ticketsList');
const searchContainer = document.getElementById('searchContainer');
const systemsList = document.getElementById('systemsList');
const levelsList = document.getElementById('levelsList');
const roomsList = document.getElementById('roomsList');
const documentsList = document.getElementById('documentsList');
const schemaList = document.getElementById('schemaList');
const taggedAssetsList = document.getElementById('taggedAssetsList');
const diagnosticsList = document.getElementById('diagnosticsList');
const versionSwitchWrap = document.getElementById('versionSwitchWrap');
const versionRadios = document.querySelectorAll('#versionSwitch input[name="schemaVersion"]');
const envBadge = document.getElementById('envBadge');

// State
let accounts = [];
let currentFacilityURN = null;
let currentFacilityRegion = null;
let currentVersion = DEFAULT_SCHEMA_VERSION; // schema version selected in the header switch
let versionSwitchSeq = 0; // guards against overlapping version switches

// Performance Optimization: Cache for user resources
// 
// The /users/@me/resources endpoint returns ALL facilities and groups across ALL regions
// in a SINGLE API call. This is much more efficient than the old approach which made
// 3 API calls per account (one per region: US, EMEA, AUS).
//
// What the cache contains:
// - userResourcesCache: Full response with twins[] and groups[]
//   - twins[]: facility URNs, regions, access levels, group associations
//   - groups[]: account URNs and names
// 
// What the cache does NOT contain:
// - Facility names (must be fetched separately via region-specific endpoints)
//
// Trade-off: We must still fetch facility names when populating dropdowns, but we can
// target only the specific regions where facilities exist (smart region targeting).
//
let userResourcesCache = null;
let facilityRegionMap = new Map(); // Map of facilityURN -> region for instant lookups

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
 * Pick the version module that displays a facility with the given schema version:
 * the highest registered version that is not newer than the facility.
 * Facilities that do not report a schema version are treated as the default version.
 * @param {number} [schemaVersion]
 * @returns {number} Key of versionLoaders
 */
function versionForSchema(schemaVersion = DEFAULT_SCHEMA_VERSION) {
  const registered = Object.keys(versionLoaders).map(Number).sort((a, b) => a - b);
  return registered.filter(v => v <= schemaVersion).pop() ?? registered[0];
}

/**
 * Load the module for a schema version and make it the active one for shared UI code.
 * @param {number} version
 */
async function activateVersion(version) {
  const versionModule = (await versionLoaders[version]()).default;
  setActiveVersion(versionModule);
}

/**
 * Reflect the current version in the header switch.
 */
function syncVersionSwitch() {
  versionRadios.forEach(radio => {
    radio.checked = Number(radio.value) === currentVersion;
  });
}

/**
 * Clear everything that belongs to the facility currently on screen.
 * Used when the schema version changes, because the loaded facility may not exist in it.
 * @param {string} message - Hint shown in the facility panel
 */
function clearFacilityDisplay(message = '') {
  currentFacilityURN = null;
  currentFacilityRegion = null;
  clearSchemaCache();

  facilityInfo.innerHTML = message ? `<p class="text-xs text-dark-text-secondary">${message}</p>` : '';
  [
    viewUserResourcesBtn, viewFacilityHistoryBtn, viewFacilityUsersBtn,
    viewFacilityViewsBtn, viewFacilityParametersBtn
  ].forEach(btn => btn.classList.add('hidden'));
  [
    modelsList, streamsList, ticketsList, searchContainer, systemsList, levelsList,
    roomsList, documentsList, schemaList, taggedAssetsList, diagnosticsList
  ].forEach(el => { el.innerHTML = ''; });
}

/**
 * Convert the facilities object returned by the twins endpoints into dropdown entries.
 * @param {object|null} facilitiesObj - Map of facility URN -> twin settings
 * @returns {Array<{urn: string, name: string, region: string, schemaVersion: number}>}
 */
function toFacilityEntries(facilitiesObj) {
  if (!facilitiesObj) {
    return [];
  }
  return Object.entries(facilitiesObj).map(([urn, settings]) => ({
    urn,
    name: settings?.props?.['Identity Data']?.['Building Name'] || 'Unnamed Facility',
    region: settings?.region || 'us',
    schemaVersion: settings?.schemaVersion ?? DEFAULT_SCHEMA_VERSION
  }));
}

/**
 * Load the facility list (with names and schema versions) for an account, once per session.
 * @param {object} account
 * @returns {Promise<Array>} All facilities of the account, whatever their schema version
 */
async function ensureFacilitiesLoaded(account) {
  if (account.facilities) {
    return account.facilities;
  }
  // Facility URNs for this account come from the cache (no API call)
  const { twins = [] } = userResourcesCache;
  const accountFacilities = account.id === '@me'
    ? twins.filter(t => !t.grantedViaGroup)
    : twins.filter(t => t.grantedViaGroup === account.id);

  if (accountFacilities.length === 0) {
    account.facilities = [];
  } else {
    // getFacilitiesForGroup handles multi-region fetching for both @me and group accounts
    console.log(`📍 Fetching facilities for ${account.name}`);
    account.facilities = toFacilityEntries(await getFacilitiesForGroup(account.id));
  }
  return account.facilities;
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
    
    versionSwitchWrap.classList.remove('hidden');
    accountSelect.classList.remove('hidden');
    facilitySelect.classList.remove('hidden');
  } else {
    loginBtn.classList.remove('hidden');
    logoutBtn.classList.add('hidden');
    userProfileLink.classList.add('hidden');
    welcomeMessage.classList.remove('hidden');
    dashboardContent.classList.add('hidden');
    versionSwitchWrap.classList.add('hidden');
    accountSelect.classList.add('hidden');
    facilitySelect.classList.add('hidden');
  }
}

/**
 * Load and cache user resources (facilities and groups)
 * 
 * PERFORMANCE OPTIMIZATION:
 * This function makes a SINGLE API call to /users/@me/resources which returns:
 * - All facility URNs across all regions (US, EMEA, AUS)
 * - Region for each facility
 * - Access levels and group associations
 * 
 * This replaces the old approach which made:
 * - 1 call to /groups (list accounts)
 * - N accounts × 3 regions = 3N calls to fetch facilities per region
 * - Example: 5 accounts = 1 + 15 = 16 API calls
 * 
 * New approach: Just 1 API call total!
 * 
 * Note: Facility names are NOT included and must be fetched separately when needed.
 * This is a limitation of the API design, not our implementation.
 * 
 * @returns {Promise<void>}
 */
async function loadUserResourcesCache() {
  try {
    console.log('📊 Loading user resources (1 API call)...');
    const startTime = Date.now();
    
    userResourcesCache = await getUserResources('@me');
    
    // Build facility region map for quick lookups (avoids redundant API calls later)
    facilityRegionMap.clear();
    if (userResourcesCache?.twins) {
      userResourcesCache.twins.forEach(twin => {
        facilityRegionMap.set(twin.urn, twin.region || 'us');
      });
    }
    
    const duration = Date.now() - startTime;
    console.log(`✅ User resources loaded in ${duration}ms`);
  } catch (error) {
    console.error('Error loading user resources:', error);
    userResourcesCache = { twins: [], groups: [] };
  }
}

/**
 * Build accounts list from cached user resources
 * @returns {Promise<Array>} Array of account objects
 */
async function buildAccounts() {
  try {
    // Ensure cache is loaded
    if (!userResourcesCache) {
      await loadUserResourcesCache();
    }
    
    const accounts = [];
    const { groups = [] } = userResourcesCache;

    // Add accounts from groups
    for (const group of groups) {
      accounts.push({
        id: group.urn,
        name: group.name || 'Unnamed Account'
      });
    }

    // Check if there are any facilities shared directly (not via a group)
    const { twins = [] } = userResourcesCache;
    const directlySharedFacilities = twins.filter(twin => !twin.grantedViaGroup);
    
    if (directlySharedFacilities.length > 0) {
      accounts.push({
        id: '@me',
        name: '** SHARED DIRECTLY **'
      });
    }
    
    return accounts;
  } catch (error) {
    console.error('Error building accounts:', error);
    return [];
  }
}

/**
 * Build accounts and facilities data structure from cached user resources
 * 
 * LAZY LOADING OPTIMIZATION:
 * We intentionally set facilities: null to defer loading facility names until needed.
 * This is because:
 * 
 * 1. The getUserResources cache contains facility URNs but NOT facility names
 * 2. To get facility names, we must call /groups/{urn}/twins or /users/@me/twins
 * 3. These endpoints require a Region header and only return facilities in that region
 * 4. We can't avoid this limitation - it's how the API is designed
 * 
 * By lazy loading, we only fetch names when the user actually opens a dropdown,
 * rather than pre-fetching for all accounts at startup (which would be slower).
 * 
 * @returns {Promise<Array>} Array of account objects with facilities=null (lazy loaded)
 */
async function buildAccountsAndFacilities() {
  try {
    // Ensure cache is loaded
    if (!userResourcesCache) {
      await loadUserResourcesCache();
    }
    
    const accounts = [];
    const { twins = [], groups = [] } = userResourcesCache;
    
    // Group facility URNs by their grantedViaGroup
    const facilityUrnsByGroup = new Map();
    const directlySharedUrns = [];
    
    twins.forEach(twin => {
      if (twin.grantedViaGroup) {
        if (!facilityUrnsByGroup.has(twin.grantedViaGroup)) {
          facilityUrnsByGroup.set(twin.grantedViaGroup, []);
        }
        facilityUrnsByGroup.get(twin.grantedViaGroup).push(twin.urn);
      } else {
        directlySharedUrns.push(twin.urn);
      }
    });

    // Build accounts from groups
    // facilities: null indicates names need to be loaded on-demand
    for (const group of groups) {
      const urns = facilityUrnsByGroup.get(group.urn) || [];
      
      accounts.push({
        id: group.urn,
        name: group.name || 'Unnamed Account',
        facilityCount: urns.length,
        facilities: null // Lazy loaded when dropdown is populated
      });
    }

    // Add directly shared facilities account if any exist
    if (directlySharedUrns.length > 0) {
      accounts.push({
        id: '@me',
        name: '** SHARED DIRECTLY **',
        facilityCount: directlySharedUrns.length,
        facilities: null // Lazy loaded when dropdown is populated
      });
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
async function populateAccountsDropdown(accounts) {
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
    await populateFacilitiesDropdown(accounts, selectedAccount);
    
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
  const mapKey = `${accountName}#v${currentVersion}`;
  try {
    const facilitiesJson = window.localStorage.getItem('tandem-sample-stats-last-facilities');
    if (!facilitiesJson) return null;
    
    const facilitiesMap = JSON.parse(facilitiesJson);
    return facilitiesMap[mapKey] || null;
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
  const mapKey = `${accountName}#v${currentVersion}`;
  try {
    const facilitiesJson = window.localStorage.getItem('tandem-sample-stats-last-facilities');
    const facilitiesMap = facilitiesJson ? JSON.parse(facilitiesJson) : {};
    
    facilitiesMap[mapKey] = facilityURN;
    window.localStorage.setItem('tandem-sample-stats-last-facilities', JSON.stringify(facilitiesMap));
  } catch (error) {
    console.error('Error saving last facilities to localStorage:', error);
  }
}

/**
 * Populate facilities dropdown based on selected account
 * 
 * Uses the existing getFacilitiesForGroup() API function which handles multi-region
 * fetching reliably for both SHARED DIRECTLY (@me) and group accounts.
 * 
 * APPROACH:
 * - Queries all 3 regions (US, EMEA, AUS) in parallel and merges results
 * - 3 API calls per account when facilities are first loaded
 * - Works reliably for both @me and group accounts
 * 
 * CACHING:
 * After first load, account.facilities is cached so subsequent selections are instant.
 * This means the 3 API calls only happen once per account per session.
 * 
 * NOTE: We previously attempted "smart region targeting" (only query regions where
 * facilities exist based on cache), but the /users/@me/twins endpoint returns 400
 * errors when using region headers. The getFacilitiesForGroup() function uses a
 * reliable approach that works for all cases.
 * 
 * @param {Array} accounts - Array of account objects
 * @param {string} accountName - Selected account name
 */
async function populateFacilitiesDropdown(accounts, accountName) {
  facilitySelect.innerHTML = '<option value="">Select Facility...</option>';
  
  const account = accounts.find(a => a.name === accountName);
  if (!account) return;

  const allFacilities = await ensureFacilitiesLoaded(account);

  // Only facilities that the selected schema version can display
  const versionFacilities = allFacilities.filter(f => versionForSchema(f.schemaVersion) === currentVersion);

  if (versionFacilities.length === 0) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = allFacilities.length === 0
      ? 'No facilities available'
      : `No ${getActiveVersion().label} facilities`;
    option.disabled = true;
    facilitySelect.appendChild(option);
    clearFacilityDisplay();
    return;
  }
  
  // Sort facilities alphabetically by name
  const sortedFacilities = [...versionFacilities].sort((a, b) => 
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  );
  
  sortedFacilities.forEach(facility => {
    const option = document.createElement('option');
    option.value = facility.urn;
    option.textContent = facility.name;
    facilitySelect.appendChild(option);
  });

  // Try to restore last selected facility for THIS account and version, or select the first one
  const lastFacility = getLastFacilityForAccount(accountName);
  let selectedFacilityURN = null;
  
  if (lastFacility && versionFacilities.some(f => f.urn === lastFacility)) {
    selectedFacilityURN = lastFacility;
  } else if (sortedFacilities.length > 0) {
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
 * Switch the schema version shown by the app.
 * Loads the version's module, refreshes the Facility dropdown so it only lists facilities of
 * that version, and replaces the facility that was on screen.
 * @param {number} version - Key of versionLoaders
 */
async function switchVersion(version) {
  const seq = ++versionSwitchSeq;

  currentVersion = version;
  window.localStorage.setItem(VERSION_STORAGE_KEY, String(version));
  syncVersionSwitch();
  toggleLoading(true);

  try {
    await activateVersion(version);
    if (seq !== versionSwitchSeq) return; // a newer switch took over

    clearFacilityDisplay();
    if (accountSelect.value) {
      await populateFacilitiesDropdown(accounts, accountSelect.value);
    } else {
      facilitySelect.innerHTML = '<option value="">Select Facility...</option>';
    }
  } catch (error) {
    console.error(`Error switching to schema version ${version}:`, error);
    facilityInfo.innerHTML = `<p class="text-red-600">Error loading schema version ${version} support</p>`;
  } finally {
    if (seq === versionSwitchSeq) toggleLoading(false);
  }
}

/**
 * Replace the facility's data cards with a "not loaded" notice and show the reason.
 * @param {string} title - Notice heading
 * @param {string} bodyHtml - Explanation (HTML)
 */
function showFacilityNotLoaded(title, bodyHtml) {
  const notice = '<p class="text-yellow-500 text-xs">⚠️ Facility data not loaded: schema version not supported by this view.</p>';
  [
    modelsList, streamsList, searchContainer, taggedAssetsList, levelsList, roomsList,
    documentsList, systemsList, schemaList, diagnosticsList
  ].forEach(el => { el.innerHTML = notice; });
  ticketsList.innerHTML = '';

  facilityInfo.innerHTML += `
    <div class="mt-4 p-4 bg-yellow-900/30 border border-yellow-700 rounded">
      <div class="flex items-start space-x-3">
        <svg class="w-6 h-6 text-yellow-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
        </svg>
        <div>
          <h3 class="text-sm font-semibold text-yellow-500 mb-1">${title}</h3>
          <p class="text-xs text-yellow-200">${bodyHtml}</p>
        </div>
      </div>
    </div>
  `;
}

/**
 * Load facility information and statistics
 * 
 * CACHED REGION LOOKUP OPTIMIZATION:
 * Previously, this function called getUserResources() every time to determine the
 * facility's region. This added 1 redundant API call per facility switch.
 * 
 * Now we use the facilityRegionMap cache populated during initial load.
 * Result: 0 API calls for region lookup (instant from cache).
 * 
 * @param {string} facilityURN - Facility URN
 */
async function loadFacility(facilityURN) {
  if (currentFacilityURN === facilityURN) {
    return; // Already loaded
  }
  currentFacilityURN = facilityURN;
  
  // Get region from cache (instant lookup, no API call needed!)
  // The facilityRegionMap was populated during loadUserResourcesCache()
  const region = facilityRegionMap.get(facilityURN) || 'us';
  currentFacilityRegion = RegionLabelMap[region] || 'US';
  // Hide the buttons initially while loading
  viewUserResourcesBtn.classList.add('hidden');
  viewFacilityHistoryBtn.classList.add('hidden');
  viewFacilityUsersBtn.classList.add('hidden');
  viewFacilityViewsBtn.classList.add('hidden');
  viewFacilityParametersBtn.classList.add('hidden');
  
  toggleLoading(true);
  
  try {
    // Get facility info and thumbnail in parallel
    const [info, thumbnailUrl] = await Promise.all([
      getFacilityInfo(facilityURN, currentFacilityRegion),
      getFacilityThumbnail(facilityURN, currentFacilityRegion)
    ]);

    // The user may have switched facility or schema version while we were waiting
    if (currentFacilityURN !== facilityURN) {
      return;
    }
    
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
      
      // Show the buttons
      viewUserResourcesBtn.classList.remove('hidden');
      viewFacilityHistoryBtn.classList.remove('hidden');
      viewFacilityUsersBtn.classList.remove('hidden');
      viewFacilityViewsBtn.classList.remove('hidden');
      viewFacilityParametersBtn.classList.remove('hidden');

      // Set up per-facility button handlers (need facilityURN, region, and name)
      viewFacilityHistoryBtn.onclick = () => viewFacilityHistory(facilityURN, region, buildingName);
      viewFacilityUsersBtn.onclick = () => viewFacilityUsers(facilityURN, region, buildingName);
      viewFacilityViewsBtn.onclick = () => viewFacilityViews(facilityURN, region, buildingName);
      viewFacilityParametersBtn.onclick = () => viewFacilityParameters(facilityURN, currentFacilityRegion, buildingName);
      
      // The facility must be displayable by the active version module
      const versionModule = getActiveVersion();
      if (schemaVersion !== undefined && versionForSchema(schemaVersion) !== currentVersion) {
        showFacilityNotLoaded(
          'Schema Version Mismatch',
          `This facility uses schema version <strong>${schemaVersion}</strong>, but the <strong>${versionModule.label}</strong> view is selected. ` +
          `Switch the Schema selector at the top to <strong>V${versionForSchema(schemaVersion)}</strong> to view it.`
        );
        return;
      }
      if (schemaVersion < versionModule.minSchemaVersion) {
        showFacilityNotLoaded(
          'Incompatible Schema Version',
          `This facility is using schema version <strong>${schemaVersion}</strong>. ` +
          `The ${versionModule.label} view supports <strong>schema version ${versionModule.minSchemaVersion}</strong> and newer. ` +
          'To view detailed statistics for this facility, please upgrade it by opening it in Autodesk Tandem first.'
        );
        return;
      }
    }

    // Load stats (only for a supported schema version)
    await loadStats(facilityURN, currentFacilityRegion);
    
  } catch (error) {
    console.error('Error loading facility:', error);
    facilityInfo.innerHTML = `<p class="text-red-600">Error loading facility information</p>`;
    // Keep buttons hidden on error
    viewUserResourcesBtn.classList.add('hidden');
    viewFacilityHistoryBtn.classList.add('hidden');
    viewFacilityUsersBtn.classList.add('hidden');
    viewFacilityViewsBtn.classList.add('hidden');
    viewFacilityParametersBtn.classList.add('hidden');
  } finally {
    toggleLoading(false);
  }
}


/**
 * Load and display facility statistics
 * @param {string} facilityURN - Facility URN
 */
async function loadStats(facilityURN, region) {
  try {
    // Clear schema cache from previous facility
    clearSchemaCache();
    
    // Note: Don't cleanup thumbnail URLs here - they're still being displayed!
    // Cleanup happens only on page unload via beforeunload event
    
    // Get models
    const models = await getModels(facilityURN, region);
    
    // Pre-load and cache schemas for all models FIRST.
    // This ensures we only call /schema once per model per session.
    // All fetches fire simultaneously so total time ≈ the slowest single model.
    await Promise.all(models.map(model => loadSchemaForModel(model.modelId, region)));
    
    // Get schema cache for passing to downstream functions
    const schemaCache = getSchemaCache();
    
    const { loaders } = getActiveVersion();

    // Check if default model exists before fetching streams/tickets.
    // Streams and tickets only exist in the default model.
    const defaultModelURN = facilityURN.replace('urn:adsk.dtt:', 'urn:adsk.dtm:');
    const hasDefaultModel = models.some(m => m.modelId === defaultModelURN);

    // Display all cards concurrently — each is fully independent and only
    // needs facilityURN, region, models, and the already-cached schemaCache.
    // Total load time ≈ max(individual card times) rather than their sum.
    await Promise.all([
      // Models card (data already in hand — no additional fetch needed)
      displayModels(modelsList, models, facilityURN, region),

      // Streams card (default model only)
      (async () => {
        const streams = hasDefaultModel ? await loaders.getStreams(facilityURN, region) : [];
        await displayStreams(streamsList, streams, facilityURN, region);
      })(),

      // Tickets card (default model only)
      (async () => {
        const tickets = hasDefaultModel ? await loaders.getTickets(facilityURN, region) : [];
        await displayTickets(ticketsList, tickets, facilityURN, region);
      })(),

      // Search interface
      displaySearch(searchContainer, facilityURN, region, models),

      // Systems card (default model only)
      (async () => {
        const systems = hasDefaultModel ? await loaders.getSystems(facilityURN, region, models) : [];
        await displaySystems(systemsList, systems, facilityURN, region);
      })(),

      // Tagged assets card
      displayTaggedAssets(taggedAssetsList, facilityURN, models, region),

      // Levels card
      (async () => {
        const levels = await loaders.getLevels(facilityURN, region);
        await displayLevels(levelsList, levels, facilityURN, region);
      })(),

      // Rooms card
      (async () => {
        const rooms = await loaders.getRooms(facilityURN, region, schemaCache);
        await displayRooms(roomsList, rooms, facilityURN, region);
      })(),

      // Documents card
      (async () => {
        const documents = await getDocuments(facilityURN, region);
        await displayDocuments(documentsList, documents);
      })(),

      // Schema card (CPU-only — reads cached schemas, no network)
      displaySchema(schemaList, models, facilityURN),

      // Diagnostics card (CPU-only — reads cached schemas, no network)
      displayDiagnostics(diagnosticsList, facilityURN, models),
    ]);
    
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
  viewUserResourcesBtn.addEventListener('click', viewUserResources);
  // History, Users, and Views button handlers are set dynamically in loadFacility
  // because they need the current facilityURN, region, and facility name.

  // Schema version: restore the last choice and wire up the switch
  const savedVersion = Number(window.localStorage.getItem(VERSION_STORAGE_KEY));
  currentVersion = Object.hasOwn(versionLoaders, savedVersion) ? savedVersion : DEFAULT_SCHEMA_VERSION;
  syncVersionSwitch();
  versionRadios.forEach(radio => {
    radio.addEventListener('change', () => {
      if (radio.checked && Number(radio.value) !== currentVersion) {
        switchVersion(Number(radio.value));
      }
    });
  });

  // Make it obvious when we are not talking to production
  const envName = getEnv().name;
  if (envName !== 'prod') {
    envBadge.textContent = envName.toUpperCase();
    envBadge.classList.remove('hidden');
  }

  accountSelect.addEventListener('change', async (e) => {
    const accountName = e.target.value;
    if (accountName) {
      window.localStorage.setItem('tandem-sample-stats-last-account', accountName);
      await populateFacilitiesDropdown(accounts, accountName);
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
    
    // The shared UI needs an active version module before any facility can load
    await activateVersion(currentVersion);

    // Load user resources cache first (single API call for all data)
    await loadUserResourcesCache();
    
    // Build accounts and facilities from cached data
    // Facility names will be loaded on-demand when dropdown is populated
    accounts = await buildAccountsAndFacilities();
    
    if (accounts && accounts.length > 0) {
      await populateAccountsDropdown(accounts);

      // ── DEEP-LINK: pre-select account + facility ─────────────────────────
      // Cookies (written by tandem-sample-portfolio) take priority; URL params
      // work as a fallback when stats is already logged in and no redirect occurs.
      {
        function _readCookie(name) {
          const m = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
          return m ? decodeURIComponent(m[1]) : null;
        }
        function _clearCookie(name) {
          document.cookie = `${name}=; path=/; max-age=0`;
        }

        // Priority: cookie (localhost) → sessionStorage (cross-origin, saved by auth.js
        // before OAuth redirect) → hash direct (already logged in, no redirect needed).
        const urlHash      = new URLSearchParams(window.location.hash.slice(1));
        const paramAccount = _readCookie('tandem_deeplink_account')
            || sessionStorage.getItem('tandem_deeplink_account')
            || urlHash.get('account');
        const paramFacility = _readCookie('tandem_deeplink_facility')
            || sessionStorage.getItem('tandem_deeplink_facility')
            || urlHash.get('facility');
        _clearCookie('tandem_deeplink_account');
        _clearCookie('tandem_deeplink_facility');
        sessionStorage.removeItem('tandem_deeplink_account');
        sessionStorage.removeItem('tandem_deeplink_facility');

        if (paramAccount && paramFacility) {
          const matchedAccount = accounts.find(a => a.name === paramAccount);
          if (matchedAccount) {
            accountSelect.value = paramAccount;
            window.localStorage.setItem('tandem-sample-stats-last-account', paramAccount);

            const facilities = await ensureFacilitiesLoaded(matchedAccount);
            const target = facilities.find(f => f.urn === paramFacility);

            if (target) {
              // Show the facility under the schema version that can display it
              const targetVersion = versionForSchema(target.schemaVersion);
              if (targetVersion !== currentVersion) {
                await switchVersion(targetVersion);
              } else {
                await populateFacilitiesDropdown(accounts, paramAccount);
              }
              facilitySelect.value = paramFacility;
              loadFacility(paramFacility);
            } else {
              await populateFacilitiesDropdown(accounts, paramAccount);
            }
          }
          // Clean up URL so Back/Reload doesn't re-trigger
          window.history.replaceState({}, '', window.location.pathname);
        }
      }

      // ── BACKGROUND PRE-FETCH: facilities for all remaining accounts ─────
      // populateAccountsDropdown already loaded the initially selected account's
      // facilities. Here we fire off fetches for every OTHER account in parallel
      // so that subsequent account switches in the dropdown are instant.
      //
      // This is fire-and-forget (no await) so it never blocks the UI.
      // Sort order is NOT affected — populateFacilitiesDropdown always sorts
      // at render time, independent of when the data was fetched.
      // "** SHARED DIRECTLY **" (id: '@me') follows the normal code path via
      // getFacilitiesForGroup('@me'), same as if the user had clicked it.
      //
      // Race condition note: if the user switches accounts before the pre-fetch
      // for that account completes, populateFacilitiesDropdown will start its
      // own fetch (because account.facilities is still null). Both fetches return
      // the same data; the last write wins. This is benign.
      // Background pre-fetch: fire facility lookups for all accounts not yet
      // loaded. This is fire-and-forget (no await) so it never blocks the UI.
      // When the user switches accounts the data is already cached → instant.
      // Sort order is unaffected: populateFacilitiesDropdown always sorts at
      // render time, independent of when the data was fetched.
      const unfetched = accounts.filter(a => a.facilities === null);
      if (unfetched.length > 0) {
        Promise.all(
          unfetched.map(async (account) => {
            try {
              account.facilities = toFacilityEntries(await getFacilitiesForGroup(account.id));
            } catch (err) {
              console.warn(`Background pre-fetch failed for account "${account.name}":`, err);
              account.facilities = []; // populateFacilitiesDropdown will retry on selection
            }
          })
        );
      }

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
