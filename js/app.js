import { login, logout, checkLogin } from './auth.js';
import { 
  getGroups, 
  getFacilitiesForGroup, 
  getFacilitiesForUser, 
  getFacilityInfo,
  getModels,
  getModelDetails,
  getElementCount,
  getFacilityThumbnail,
  getStreams,
  getLastSeenStreamValues,
  getSchema,
  getLevels,
  getRooms
} from './api.js';
import { convertLongKeysToShortKeys } from './utils.js';

// DOM Elements
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const userProfileImg = document.getElementById('userProfileImg');
const accountSelect = document.getElementById('accountSelect');
const facilitySelect = document.getElementById('facilitySelect');
const welcomeMessage = document.getElementById('welcomeMessage');
const dashboardContent = document.getElementById('dashboardContent');
const loadingOverlay = document.getElementById('loadingOverlay');
const facilityInfo = document.getElementById('facilityInfo');
const modelsList = document.getElementById('modelsList');
const streamsList = document.getElementById('streamsList');
const levelsList = document.getElementById('levelsList');
const roomsList = document.getElementById('roomsList');
const schemaList = document.getElementById('schemaList');

// State
let accounts = [];
let currentFacilityURN = null;

// Schema cache: modelURN -> { attributes: [...], lookup: Map(qualifiedProp -> attribute) }
const schemaCache = {};

/**
 * Check if a model is the default model for a facility
 * The default model URN is derived from the facility URN by swapping the prefix
 * @param {string} facilityURN - Facility URN (urn:adsk.dtt:...)
 * @param {string} modelURN - Model URN (urn:adsk.dtm:...)
 * @returns {boolean} True if this is the default model
 */
function isDefaultModel(facilityURN, modelURN) {
  if (!facilityURN || !modelURN) return false;
  
  // Strip prefixes and compare
  const facilityId = facilityURN.replace('urn:adsk.dtt:', '');
  const modelId = modelURN.replace('urn:adsk.dtm:', '');
  
  return facilityId === modelId;
}

/**
 * Load and cache schema for a model
 * @param {string} modelURN - Model URN
 * @returns {Promise<Object>} Schema object with attributes array and lookup map
 */
async function loadSchemaForModel(modelURN) {
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
async function getPropertyDisplayName(modelURN, qualifiedProp) {
  const schema = await loadSchemaForModel(modelURN);
  const attr = schema.lookup.get(qualifiedProp);
  
  if (attr && attr.category && attr.name) {
    return `${attr.category}.${attr.name}`;
  }
  
  return qualifiedProp; // Fallback to qualified prop if not found
}

/**
 * Show/hide loading overlay
 * @param {boolean} show - Whether to show the loading overlay
 */
function toggleLoading(show) {
  loadingOverlay.classList.toggle('hidden', !show);
}

/**
 * Update UI based on login state
 * @param {boolean} isLoggedIn - Whether user is logged in
 * @param {string} profileImgUrl - User profile image URL
 */
function updateUIForLoginState(isLoggedIn, profileImgUrl) {
  if (isLoggedIn) {
    loginBtn.classList.add('hidden');
    logoutBtn.classList.remove('hidden');
    userProfileImg.classList.remove('hidden');
    userProfileImg.src = profileImgUrl;
    welcomeMessage.classList.add('hidden');
    dashboardContent.classList.remove('hidden');
  } else {
    loginBtn.classList.remove('hidden');
    logoutBtn.classList.add('hidden');
    userProfileImg.classList.add('hidden');
    welcomeMessage.classList.remove('hidden');
    dashboardContent.classList.add('hidden');
    accountSelect.classList.add('hidden');
    facilitySelect.classList.add('hidden');
  }
}

/**
 * Sort facilities alphabetically by building name
 * @param {object} facilities - Facilities object
 * @returns {Map} Sorted facilities map
 */
function sortFacilities(facilities) {
  if (!facilities) return new Map();
  
  const entries = Object.entries(facilities);
  const sortedEntries = entries.sort((a, b) => {
    const nameA = (a[1].props?.["Identity Data"]?.["Building Name"] || "Unknown").toLowerCase();
    const nameB = (b[1].props?.["Identity Data"]?.["Building Name"] || "Unknown").toLowerCase();
    return nameA.localeCompare(nameB);
  });

  return new Map(sortedEntries);
}

/**
 * Build accounts and facilities structure
 * @returns {Promise<Array>} Array of accounts with their facilities
 */
async function buildAccountsAndFacilities() {
  try {
    // Get all groups/accounts
    let accounts = await getGroups();
    
    if (accounts) {
      // For each account, get its facilities
      for (let i = 0; i < accounts.length; i++) {
        const facilities = await getFacilitiesForGroup(accounts[i].urn);
        accounts[i].facilities = sortFacilities(facilities);
      }
      
      // Sort accounts alphabetically
      accounts.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
    }

    // Get facilities shared directly with user
    const sharedFacilities = await getFacilitiesForUser("@me");
    if (sharedFacilities && Object.keys(sharedFacilities).length > 0) {
      const fakeAccount = {
        name: "** SHARED WITH ME **",
        facilities: sortFacilities(sharedFacilities)
      };

      if (!accounts) accounts = [];
      accounts.push(fakeAccount);
    }

    return accounts;
  } catch (error) {
    console.error('Error building accounts and facilities:', error);
    return [];
  }
}

/**
 * Populate the accounts dropdown
 * @param {Array} accountsList - List of accounts
 */
function populateAccountsDropdown(accountsList) {
  accountSelect.innerHTML = '';
  
  const lastAccount = window.localStorage.getItem('tandem-stats-last-account');
  const safePreferredAccount = accountsList.find(a => a.name === lastAccount) || accountsList[0];

  // Add all account names to the dropdown
  for (let i = 0; i < accountsList.length; i++) {
    const option = document.createElement('option');
    option.text = accountsList[i].name;
    option.value = accountsList[i].name; // Use name as value
    option.selected = accountsList[i].name === safePreferredAccount.name;
    
    accountSelect.appendChild(option);
  }

  accountSelect.classList.remove('hidden');
  
  // Populate facilities for the initially selected account
  populateFacilitiesDropdown(accountsList, safePreferredAccount.name);
}

/**
 * Populate the facilities dropdown
 * @param {Array} accountsList - List of all accounts
 * @param {string} accountName - Name of selected account
 */
function populateFacilitiesDropdown(accountsList, accountName) {
  facilitySelect.innerHTML = ''; // Clear out any previous options
  
  // Find the current account
  const currentAccount = accountsList.find(obj => obj.name === accountName);
  
  if (!currentAccount || !currentAccount.facilities || currentAccount.facilities.size === 0) {
    facilitySelect.classList.add('hidden');
    return;
  }

  // Load preferred facility URN
  const preferredFacilityURN = window.localStorage.getItem('tandem-stats-last-facility');
  
  // See if we can find that one in our list of facilities
  let safeFacilityURN = currentAccount.facilities.keys().next().value; // Safe default
  for (const [key, value] of currentAccount.facilities.entries()) {
    if (key === preferredFacilityURN) {
      safeFacilityURN = key;
      break; // Exit the loop once the key is found
    }
  }

  // Now build the dropdown list
  for (const [key, value] of currentAccount.facilities.entries()) {
    const option = document.createElement('option');
    option.text = value.props?.["Identity Data"]?.["Building Name"] || "Unknown Facility";
    option.value = key;
    option.selected = key === safeFacilityURN;
    
    facilitySelect.appendChild(option);
  }

  facilitySelect.classList.remove('hidden');

  // Store and load the selected facility immediately
  window.localStorage.setItem('tandem-stats-last-facility', safeFacilityURN);
  loadFacility(safeFacilityURN);
}

/**
 * Load and display facility information
 * @param {string} facilityURN - Facility URN
 */
async function loadFacility(facilityURN) {
  if (!facilityURN) return;
  
  currentFacilityURN = facilityURN;
  
  try {
    toggleLoading(true);
    
    // Get facility info and thumbnail in parallel
    const [info, thumbnailUrl] = await Promise.all([
      getFacilityInfo(facilityURN),
      getFacilityThumbnail(facilityURN)
    ]);
    
    if (info) {
      const buildingName = info.props?.["Identity Data"]?.["Building Name"] || "Unknown";
      const location = info.props?.["Identity Data"]?.["Address"] || "No address available";
      
      facilityInfo.innerHTML = `
        <div class="flex flex-col md:flex-row gap-6">
          ${thumbnailUrl ? `
          <div class="flex-shrink-0">
            <img src="${thumbnailUrl}" 
                 alt="Facility Thumbnail" 
                 class="w-full md:w-64 h-48 object-cover rounded-lg border border-gray-200 shadow-sm">
          </div>
          ` : ''}
          <div class="flex-grow space-y-2">
            <div>
              <span class="font-medium text-gray-900">Building Name:</span>
              <span class="text-gray-600 ml-2">${buildingName}</span>
            </div>
            <div>
              <span class="font-medium text-gray-900">Location:</span>
              <span class="text-gray-600 ml-2">${location}</span>
            </div>
            <div>
              <span class="font-medium text-gray-900">Facility URN:</span>
              <span class="text-gray-600 ml-2 text-xs font-mono break-all">${facilityURN}</span>
            </div>
          </div>
        </div>
      `;
    }

    // Load stats
    await loadStats(facilityURN);
    
  } catch (error) {
    console.error('Error loading facility:', error);
    facilityInfo.innerHTML = `<p class="text-red-600">Error loading facility information</p>`;
  } finally {
    toggleLoading(false);
  }
}

/**
 * Toggle models detail view
 */
function toggleModelsDetail() {
  const detailSection = document.getElementById('models-detail');
  const summarySection = document.getElementById('models-summary');
  const toggleBtn = document.getElementById('toggle-models-btn');
  const iconDown = document.getElementById('toggle-icon-down');
  const iconUp = document.getElementById('toggle-icon-up');
  
  console.log('Toggle clicked', {
    detailHidden: detailSection?.classList.contains('hidden'),
    summaryHidden: summarySection?.classList.contains('hidden')
  });
  
  if (detailSection && summarySection && toggleBtn && iconDown && iconUp) {
    if (detailSection.classList.contains('hidden')) {
      // Show detail, hide summary
      detailSection.classList.remove('hidden');
      summarySection.classList.add('hidden');
      iconDown.classList.add('hidden');
      iconUp.classList.remove('hidden');
      toggleBtn.title = 'Show less';
    } else {
      // Show summary, hide detail
      detailSection.classList.add('hidden');
      summarySection.classList.remove('hidden');
      iconDown.classList.remove('hidden');
      iconUp.classList.add('hidden');
      toggleBtn.title = 'Show more';
    }
  }
}

/**
 * Display models list
 * @param {Array} models - Array of model objects
 * @param {string} facilityURN - Facility URN to determine default model
 */
async function displayModels(models, facilityURN) {
  if (!models || models.length === 0) {
    modelsList.innerHTML = '<p class="text-gray-500">No models found in this facility.</p>';
    return;
  }

  // Build header with toggle button (always visible)
  let headerHtml = `
    <div class="flex items-center justify-between mb-4">
      <div class="flex items-center space-x-2">
        <div class="text-3xl font-bold text-tandem-blue">${models.length}</div>
        <div class="text-sm text-gray-600">
          <div>Model${models.length !== 1 ? 's' : ''}</div>
          <div id="summary-total-elements" class="text-xs text-gray-500">Calculating...</div>
        </div>
      </div>
      <button id="toggle-models-btn"
              class="p-2 hover:bg-gray-100 rounded-lg transition"
              title="Show more">
        <svg id="toggle-icon-down" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
        </svg>
        <svg id="toggle-icon-up" class="w-5 h-5 hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"></path>
        </svg>
      </button>
    </div>
  `;
  
  // Build summary view (just shows it's collapsed, no detailed list)
  let summaryHtml = `
    <div id="models-summary" class="text-center py-4 text-gray-500 text-sm">
      Click to expand and view model details
    </div>
  `;

  // Build detailed view (initially hidden)
  let detailHtml = '<div id="models-detail" class="hidden space-y-4">';
  
  for (let i = 0; i < models.length; i++) {
    const model = models[i];
    // Check if it's the default model by comparing URN IDs
    const isDefault = isDefaultModel(facilityURN, model.modelId);
    const isMainModel = model.main === true;
    const isModelOn = model.on !== false; // Default to true if not specified
    
    detailHtml += `
      <div class="border border-gray-200 rounded-lg p-4 hover:border-tandem-blue transition" id="detail-model-${i}">
        <div class="flex items-start justify-between mb-3">
          <div class="flex items-center space-x-3">
            <div class="flex-shrink-0">
              <div class="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                <span class="text-white font-semibold text-sm">${i + 1}</span>
              </div>
            </div>
            <div class="flex-grow">
              <div class="flex items-center space-x-2 mb-1">
                <h3 class="text-lg font-semibold text-gray-900">${model.label || 'Untitled Model'}</h3>
              </div>
              <div class="flex items-center gap-2 flex-wrap">
                ${isDefault ? '<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">Default</span>' : ''}
                ${isMainModel ? '<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">Main</span>' : ''}
                ${isModelOn ? 
                  '<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800"><span class="mr-1">●</span>On</span>' : 
                  '<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800"><span class="mr-1">○</span>Off</span>'}
              </div>
            </div>
          </div>
          <div class="text-right flex-shrink-0">
            <div class="text-2xl font-bold text-tandem-blue" id="detail-element-count-${i}">
              <span class="inline-block animate-pulse">...</span>
            </div>
            <div class="text-xs text-gray-500">Elements</div>
          </div>
        </div>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <div>
            <span class="font-medium text-gray-700">Model ID:</span>
            <span class="text-gray-600 ml-2 font-mono text-xs break-all">${model.modelId}</span>
          </div>
          ${model.version ? `
          <div>
            <span class="font-medium text-gray-700">Version:</span>
            <span class="text-gray-600 ml-2">${model.version}</span>
          </div>
          ` : ''}
          ${model.createdAt ? `
          <div>
            <span class="font-medium text-gray-700">Created:</span>
            <span class="text-gray-600 ml-2">${new Date(model.createdAt).toLocaleDateString()}</span>
          </div>
          ` : ''}
          ${model.lastModified ? `
          <div>
            <span class="font-medium text-gray-700">Last Modified:</span>
            <span class="text-gray-600 ml-2">${new Date(model.lastModified).toLocaleDateString()}</span>
          </div>
          ` : ''}
        </div>
      </div>
    `;
  }
  
  detailHtml += '</div>';
  
  // Combine header, summary and detail views
  modelsList.innerHTML = headerHtml + summaryHtml + detailHtml;
  
  // Bind toggle button event listener
  const toggleBtn = document.getElementById('toggle-models-btn');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', toggleModelsDetail);
  }

  // Fetch element counts asynchronously for each model
  const countPromises = [];
  for (let i = 0; i < models.length; i++) {
    const model = models[i];
    const promise = getElementCount(model.modelId).then(count => {
      // Update detail view
      const detailCountElement = document.getElementById(`detail-element-count-${i}`);
      if (detailCountElement) {
        detailCountElement.innerHTML = count.toLocaleString();
      }
      return count;
    }).catch(error => {
      console.error(`Error getting element count for ${model.label}:`, error);
      // Update detail view
      const detailCountElement = document.getElementById(`detail-element-count-${i}`);
      if (detailCountElement) {
        detailCountElement.innerHTML = '-';
      }
      return 0;
    });
    countPromises.push(promise);
  }
  
  // Update total element count in summary
  Promise.all(countPromises).then(counts => {
    const total = counts.reduce((sum, count) => sum + count, 0);
    const totalElement = document.getElementById('summary-total-elements');
    if (totalElement) {
      totalElement.textContent = `${total.toLocaleString()} elements`;
    }
  });
}

/**
 * Toggle streams detail view
 */
function toggleStreamsDetail() {
  const detailSection = document.getElementById('streams-detail');
  const summarySection = document.getElementById('streams-summary');
  const toggleBtn = document.getElementById('toggle-streams-btn');
  const iconDown = document.getElementById('toggle-streams-icon-down');
  const iconUp = document.getElementById('toggle-streams-icon-up');
  
  console.log('Streams toggle clicked', {
    detailHidden: detailSection?.classList.contains('hidden'),
    summaryHidden: summarySection?.classList.contains('hidden')
  });
  
  if (detailSection && summarySection && toggleBtn && iconDown && iconUp) {
    if (detailSection.classList.contains('hidden')) {
      // Show detail, hide summary
      detailSection.classList.remove('hidden');
      summarySection.classList.add('hidden');
      iconDown.classList.add('hidden');
      iconUp.classList.remove('hidden');
      toggleBtn.title = 'Show less';
    } else {
      // Show summary, hide detail
      detailSection.classList.add('hidden');
      summarySection.classList.remove('hidden');
      iconDown.classList.remove('hidden');
      iconUp.classList.add('hidden');
      toggleBtn.title = 'Show more';
    }
  }
}

/**
 * Toggle levels detail view
 */
function toggleLevelsDetail() {
  const detailSection = document.getElementById('levels-detail');
  const summarySection = document.getElementById('levels-summary');
  const toggleBtn = document.getElementById('toggle-levels-btn');
  const iconDown = document.getElementById('toggle-levels-icon-down');
  const iconUp = document.getElementById('toggle-levels-icon-up');
  
  if (detailSection && summarySection && toggleBtn && iconDown && iconUp) {
    if (detailSection.classList.contains('hidden')) {
      detailSection.classList.remove('hidden');
      summarySection.classList.add('hidden');
      iconDown.classList.add('hidden');
      iconUp.classList.remove('hidden');
      toggleBtn.title = 'Show less';
    } else {
      detailSection.classList.add('hidden');
      summarySection.classList.remove('hidden');
      iconDown.classList.remove('hidden');
      iconUp.classList.add('hidden');
      toggleBtn.title = 'Show more';
    }
  }
}

/**
 * Toggle rooms detail view
 */
function toggleRoomsDetail() {
  const detailSection = document.getElementById('rooms-detail');
  const summarySection = document.getElementById('rooms-summary');
  const toggleBtn = document.getElementById('toggle-rooms-btn');
  const iconDown = document.getElementById('toggle-rooms-icon-down');
  const iconUp = document.getElementById('toggle-rooms-icon-up');
  
  if (detailSection && summarySection && toggleBtn && iconDown && iconUp) {
    if (detailSection.classList.contains('hidden')) {
      detailSection.classList.remove('hidden');
      summarySection.classList.add('hidden');
      iconDown.classList.add('hidden');
      iconUp.classList.remove('hidden');
      toggleBtn.title = 'Show less';
    } else {
      detailSection.classList.add('hidden');
      summarySection.classList.remove('hidden');
      iconDown.classList.remove('hidden');
      iconUp.classList.add('hidden');
      toggleBtn.title = 'Show more';
    }
  }
}

/**
 * Toggle schema detail view
 */
function toggleSchemaDetail() {
  const detailSection = document.getElementById('schema-detail');
  const summarySection = document.getElementById('schema-summary');
  const toggleBtn = document.getElementById('toggle-schema-btn');
  const iconDown = document.getElementById('toggle-schema-icon-down');
  const iconUp = document.getElementById('toggle-schema-icon-up');
  
  if (detailSection && summarySection && toggleBtn && iconDown && iconUp) {
    if (detailSection.classList.contains('hidden')) {
      detailSection.classList.remove('hidden');
      summarySection.classList.add('hidden');
      iconDown.classList.add('hidden');
      iconUp.classList.remove('hidden');
      toggleBtn.title = 'Show less';
    } else {
      detailSection.classList.add('hidden');
      summarySection.classList.remove('hidden');
      iconDown.classList.remove('hidden');
      iconUp.classList.add('hidden');
      toggleBtn.title = 'Show more';
    }
  }
}

/**
 * Display levels list
 * @param {Array} levels - Array of level objects
 */
async function displayLevels(levels) {
  if (!levels || levels.length === 0) {
    levelsList.innerHTML = '<p class="text-gray-500">No levels found in this facility.</p>';
    return;
  }

  // Build header with toggle button
  let headerHtml = `
    <div class="flex items-center justify-between mb-4">
      <div class="flex items-center space-x-2">
        <div class="text-3xl font-bold text-tandem-blue">${levels.length}</div>
        <div class="text-sm text-gray-600">
          <div>Level${levels.length !== 1 ? 's' : ''}</div>
        </div>
      </div>
      <button id="toggle-levels-btn"
              class="p-2 hover:bg-gray-100 rounded-lg transition"
              title="Show more">
        <svg id="toggle-levels-icon-down" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
        </svg>
        <svg id="toggle-levels-icon-up" class="w-5 h-5 hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"></path>
        </svg>
      </button>
    </div>
  `;
  
  // Build summary view
  let summaryHtml = `
    <div id="levels-summary" class="text-center py-4 text-gray-500 text-sm">
      Click to expand and view level details
    </div>
  `;

  // Build detailed view
  let detailHtml = '<div id="levels-detail" class="hidden space-y-2">';
  
  for (let i = 0; i < levels.length; i++) {
    const level = levels[i];
    
    detailHtml += `
      <div class="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:border-tandem-blue transition">
        <div class="flex items-center space-x-3">
          <div class="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-purple-500 to-purple-600 rounded flex items-center justify-center">
            <span class="text-white font-semibold text-xs">${i + 1}</span>
          </div>
          <div>
            <div class="font-semibold text-gray-900">${level.name}</div>
            <div class="text-xs text-gray-500">${level.modelName}</div>
          </div>
        </div>
        <div class="text-xs font-mono text-gray-400">${level.key.substring(0, 12)}...</div>
      </div>
    `;
  }
  
  detailHtml += '</div>';
  
  levelsList.innerHTML = headerHtml + summaryHtml + detailHtml;
  
  const toggleBtn = document.getElementById('toggle-levels-btn');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', toggleLevelsDetail);
  }
}

/**
 * Display rooms list
 * @param {Array} rooms - Array of room objects
 */
async function displayRooms(rooms) {
  if (!rooms || rooms.length === 0) {
    roomsList.innerHTML = '<p class="text-gray-500">No rooms or spaces found in this facility.</p>';
    return;
  }

  // Build header with toggle button
  let headerHtml = `
    <div class="flex items-center justify-between mb-4">
      <div class="flex items-center space-x-2">
        <div class="text-3xl font-bold text-tandem-blue">${rooms.length}</div>
        <div class="text-sm text-gray-600">
          <div>Room${rooms.length !== 1 ? 's' : ''} & Space${rooms.length !== 1 ? 's' : ''}</div>
        </div>
      </div>
      <button id="toggle-rooms-btn"
              class="p-2 hover:bg-gray-100 rounded-lg transition"
              title="Show more">
        <svg id="toggle-rooms-icon-down" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
        </svg>
        <svg id="toggle-rooms-icon-up" class="w-5 h-5 hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"></path>
        </svg>
      </button>
    </div>
  `;
  
  // Build summary view
  let summaryHtml = `
    <div id="rooms-summary" class="text-center py-4 text-gray-500 text-sm">
      Click to expand and view room details
    </div>
  `;

  // Build detailed view
  let detailHtml = '<div id="rooms-detail" class="hidden space-y-2">';
  
  for (let i = 0; i < rooms.length; i++) {
    const room = rooms[i];
    const isSpace = room.type === 'Space';
    
    detailHtml += `
      <div class="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:border-tandem-blue transition">
        <div class="flex items-center space-x-3">
          <div class="flex-shrink-0 w-8 h-8 bg-gradient-to-br ${isSpace ? 'from-orange-500 to-orange-600' : 'from-indigo-500 to-indigo-600'} rounded flex items-center justify-center">
            <span class="text-white font-semibold text-xs">${i + 1}</span>
          </div>
          <div>
            <div class="flex items-center gap-2">
              <span class="font-semibold text-gray-900">${room.name}</span>
              <span class="px-2 py-0.5 text-xs font-medium ${isSpace ? 'bg-orange-100 text-orange-800' : 'bg-indigo-100 text-indigo-800'} rounded">${room.type}</span>
            </div>
            <div class="text-xs text-gray-500">${room.modelName}</div>
          </div>
        </div>
        <div class="text-xs font-mono text-gray-400">${room.key.substring(0, 12)}...</div>
      </div>
    `;
  }
  
  detailHtml += '</div>';
  
  roomsList.innerHTML = headerHtml + summaryHtml + detailHtml;
  
  const toggleBtn = document.getElementById('toggle-rooms-btn');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', toggleRoomsDetail);
  }
}

/**
 * Render a schema table for a model
 * @param {string} modelId - Model ID
 * @param {Array} attributes - Array of attribute objects
 * @param {string} sortColumn - Column to sort by
 * @param {string} sortDirection - 'asc' or 'desc'
 */
function renderSchemaTable(modelId, attributes, sortColumn = null, sortDirection = 'asc') {
  const tableContainer = document.getElementById(`schema-table-${modelId}`);
  if (!tableContainer) return;

  // Sort attributes if sortColumn is specified
  let sortedAttributes = [...attributes];
  if (sortColumn) {
    sortedAttributes.sort((a, b) => {
      const aVal = (a[sortColumn] || '').toString().toLowerCase();
      const bVal = (b[sortColumn] || '').toString().toLowerCase();
      
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }

  // Build table HTML
  let tableHtml = `
    <table class="min-w-full text-xs">
      <thead class="bg-gray-50">
        <tr>
          <th class="px-3 py-2 text-left font-semibold text-gray-700 cursor-pointer hover:bg-gray-100 select-none" 
              data-model="${modelId}" data-column="id" data-direction="${sortColumn === 'id' ? (sortDirection === 'asc' ? 'desc' : 'asc') : 'asc'}">
            <div class="flex items-center gap-1">
              <span>ID</span>
              ${sortColumn === 'id' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
            </div>
          </th>
          <th class="px-3 py-2 text-left font-semibold text-gray-700 cursor-pointer hover:bg-gray-100 select-none" 
              data-model="${modelId}" data-column="category" data-direction="${sortColumn === 'category' ? (sortDirection === 'asc' ? 'desc' : 'asc') : 'asc'}">
            <div class="flex items-center gap-1">
              <span>Category</span>
              ${sortColumn === 'category' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
            </div>
          </th>
          <th class="px-3 py-2 text-left font-semibold text-gray-700 cursor-pointer hover:bg-gray-100 select-none" 
              data-model="${modelId}" data-column="name" data-direction="${sortColumn === 'name' ? (sortDirection === 'asc' ? 'desc' : 'asc') : 'asc'}">
            <div class="flex items-center gap-1">
              <span>Name</span>
              ${sortColumn === 'name' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
            </div>
          </th>
          <th class="px-3 py-2 text-left font-semibold text-gray-700 cursor-pointer hover:bg-gray-100 select-none" 
              data-model="${modelId}" data-column="dataType" data-direction="${sortColumn === 'dataType' ? (sortDirection === 'asc' ? 'desc' : 'asc') : 'asc'}">
            <div class="flex items-center gap-1">
              <span>Data Type</span>
              ${sortColumn === 'dataType' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
            </div>
          </th>
          <th class="px-3 py-2 text-left font-semibold text-gray-700 cursor-pointer hover:bg-gray-100 select-none" 
              data-model="${modelId}" data-column="spec" data-direction="${sortColumn === 'spec' ? (sortDirection === 'asc' ? 'desc' : 'asc') : 'asc'}">
            <div class="flex items-center gap-1">
              <span>Spec</span>
              ${sortColumn === 'spec' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
            </div>
          </th>
        </tr>
      </thead>
      <tbody class="divide-y divide-gray-200">
  `;

  // Show first 50 attributes
  const displayCount = Math.min(50, sortedAttributes.length);
  
  for (let j = 0; j < displayCount; j++) {
    const attr = sortedAttributes[j];
    tableHtml += `
      <tr class="hover:bg-gray-50">
        <td class="px-3 py-2 font-mono text-gray-600">${attr.id || ''}</td>
        <td class="px-3 py-2 text-gray-900">${attr.category || ''}</td>
        <td class="px-3 py-2 text-gray-900">${attr.name || ''}</td>
        <td class="px-3 py-2 text-gray-600">${attr.dataType || ''}</td>
        <td class="px-3 py-2 text-gray-600">${attr.spec || ''}</td>
      </tr>
    `;
  }

  if (sortedAttributes.length > 50) {
    tableHtml += `
      <tr>
        <td colspan="5" class="px-3 py-2 text-center text-gray-500 italic">
          ... and ${sortedAttributes.length - 50} more attributes
        </td>
      </tr>
    `;
  }

  tableHtml += `
      </tbody>
    </table>
  `;

  tableContainer.innerHTML = tableHtml;

  // Add click handlers to table headers
  const headers = tableContainer.querySelectorAll('th[data-column]');
  headers.forEach(header => {
    header.addEventListener('click', () => {
      const column = header.getAttribute('data-column');
      const direction = header.getAttribute('data-direction');
      renderSchemaTable(modelId, attributes, column, direction);
    });
  });
}

/**
 * Display schema for all models
 * @param {Array} models - Array of model objects
 */
async function displaySchema(models) {
  if (!models || models.length === 0) {
    schemaList.innerHTML = '<p class="text-gray-500">No models found.</p>';
    return;
  }

  // Count total attributes across all models
  let totalAttributes = 0;
  for (const modelURN in schemaCache) {
    totalAttributes += schemaCache[modelURN].attributes.length;
  }

  // Build header with toggle button
  let headerHtml = `
    <div class="flex items-center justify-between mb-4">
      <div class="flex items-center space-x-2">
        <div class="text-3xl font-bold text-tandem-blue">${totalAttributes}</div>
        <div class="text-sm text-gray-600">
          <div>Attribute${totalAttributes !== 1 ? 's' : ''} across ${models.length} model${models.length !== 1 ? 's' : ''}</div>
        </div>
      </div>
      <button id="toggle-schema-btn"
              class="p-2 hover:bg-gray-100 rounded-lg transition"
              title="Show more">
        <svg id="toggle-schema-icon-down" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
        </svg>
        <svg id="toggle-schema-icon-up" class="w-5 h-5 hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"></path>
        </svg>
      </button>
    </div>
  `;
  
  // Build summary view
  let summaryHtml = `
    <div id="schema-summary" class="text-center py-4 text-gray-500 text-sm">
      Click to expand and view schema details
    </div>
  `;

  // Build detailed view
  let detailHtml = '<div id="schema-detail" class="hidden space-y-6">';
  
  for (let i = 0; i < models.length; i++) {
    const model = models[i];
    const schema = schemaCache[model.modelId];
    
    if (!schema || !schema.attributes || schema.attributes.length === 0) {
      continue;
    }

    detailHtml += `
      <div class="border border-gray-200 rounded-lg p-4">
        <h3 class="font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <span class="flex-shrink-0 w-6 h-6 bg-gradient-to-br from-teal-500 to-teal-600 rounded flex items-center justify-center">
            <span class="text-white font-semibold text-xs">${i + 1}</span>
          </span>
          ${model.label}
          <span class="text-sm font-normal text-gray-500">(${schema.attributes.length} attributes)</span>
        </h3>
        <div class="overflow-x-auto">
          <div id="schema-table-${model.modelId}"></div>
        </div>
      </div>
    `;
  }
  
  detailHtml += '</div>';
  
  schemaList.innerHTML = headerHtml + summaryHtml + detailHtml;
  
  const toggleBtn = document.getElementById('toggle-schema-btn');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', toggleSchemaDetail);
  }

  // Render initial tables (unsorted)
  for (let i = 0; i < models.length; i++) {
    const model = models[i];
    const schema = schemaCache[model.modelId];
    
    if (schema && schema.attributes && schema.attributes.length > 0) {
      renderSchemaTable(model.modelId, schema.attributes);
    }
  }
}

/**
 * Display streams list
 * @param {Array} streams - Array of stream objects
 * @param {string} facilityURN - Facility URN to fetch last seen values
 */
async function displayStreams(streams, facilityURN) {
  if (!streams || streams.length === 0) {
    streamsList.innerHTML = '<p class="text-gray-500">No streams found in this facility.</p>';
    return;
  }

  // Build header with toggle button (always visible)
  let headerHtml = `
    <div class="flex items-center justify-between mb-4">
      <div class="flex items-center space-x-2">
        <div class="text-3xl font-bold text-tandem-blue">${streams.length}</div>
        <div class="text-sm text-gray-600">
          <div>Stream${streams.length !== 1 ? 's' : ''}</div>
        </div>
      </div>
      <button id="toggle-streams-btn"
              class="p-2 hover:bg-gray-100 rounded-lg transition"
              title="Show more">
        <svg id="toggle-streams-icon-down" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
        </svg>
        <svg id="toggle-streams-icon-up" class="w-5 h-5 hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"></path>
        </svg>
      </button>
    </div>
  `;
  
  // Build summary view (just shows it's collapsed, no detailed list)
  let summaryHtml = `
    <div id="streams-summary" class="text-center py-4 text-gray-500 text-sm">
      Click to expand and view stream details
    </div>
  `;

  // Get the default model URN (streams only exist in the default model)
  const defaultModelURN = facilityURN.replace('urn:adsk.dtt:', 'urn:adsk.dtm:');
  
  // Load schema for the default model (cached)
  await loadSchemaForModel(defaultModelURN);
  
  // Fetch last seen values for all streams
  const streamKeys = streams.map(s => s['k']);
  console.log('Fetching last seen values for stream keys:', streamKeys);
  const lastSeenValuesRaw = await getLastSeenStreamValues(facilityURN, streamKeys);
  console.log('Last seen values received (with long keys):', lastSeenValuesRaw);
  
  // Convert long keys to short keys so we can match them with our stream objects
  const lastSeenValues = convertLongKeysToShortKeys(lastSeenValuesRaw);
  console.log('Last seen values converted (with short keys):', lastSeenValues);

  // Build detailed view (initially hidden)
  let detailHtml = '<div id="streams-detail" class="hidden space-y-4">';
  
  for (let i = 0; i < streams.length; i++) {
    const stream = streams[i];
    console.log(`Stream ${i} data:`, stream);
    
    // Name: Use override "n:!n" if present, otherwise "n:n"
    const streamName = stream['n:!n']?.[0] || stream['n:n']?.[0] || 'Unnamed Stream';
    const streamKey = stream['k']; // Stream key
    
    // Classification: Use override "n:!v" if present, otherwise "n:v"
    const classification = stream['n:!v']?.[0] || stream['n:v']?.[0];
    
    // Internal ID: Find first property starting with "z:"
    let internalId = null;
    for (const key in stream) {
      if (key.startsWith('z:')) {
        internalId = key;
        break;
      }
    }
    console.log(`Stream ${i} - Internal ID:`, internalId);
    
    // Get last seen values for this stream
    const streamValues = lastSeenValues[streamKey];
    console.log(`Stream ${i} - Last seen values:`, streamValues);
    let valuesHtml = '';
    
    if (streamValues && Object.keys(streamValues).length > 0) {
      valuesHtml = '<div class="mt-3 pt-3 border-t border-gray-200"><div class="text-xs font-semibold text-gray-700 mb-2">Last Seen Values:</div><div class="space-y-2">';
      
      for (const [propKey, propValues] of Object.entries(streamValues)) {
        // propKey is like "z:LQ" which is the internal property ID
        // Get human-readable display name
        const displayName = await getPropertyDisplayName(defaultModelURN, propKey);
        
        valuesHtml += `<div class="bg-gray-50 rounded p-2">`;
        valuesHtml += `<div class="text-xs mb-1">`;
        valuesHtml += `<div class="font-semibold text-gray-900">${displayName}</div>`;
        valuesHtml += `<div class="font-mono text-gray-500 text-xs">${propKey}</div>`;
        valuesHtml += `</div>`;
        
        for (const [timestamp, value] of Object.entries(propValues)) {
          const date = new Date(parseInt(timestamp));
          valuesHtml += `
            <div class="flex justify-between items-center text-xs pl-2 mt-1">
              <span class="text-gray-600">${date.toLocaleString()}</span>
              <span class="font-semibold text-gray-900">${value}</span>
            </div>
          `;
        }
        valuesHtml += '</div>';
      }
      
      valuesHtml += '</div></div>';
    } else {
      console.log(`Stream ${i} - No last seen values`);
    }
    
    detailHtml += `
      <div class="border border-gray-200 rounded-lg p-4 hover:border-tandem-blue transition">
        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-3 flex-grow">
            <div class="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-green-500 to-green-600 rounded-lg flex items-center justify-center">
              <span class="text-white font-semibold text-sm">${i + 1}</span>
            </div>
            <div class="flex-grow">
              <div class="flex items-center gap-2 mb-1">
                <h3 class="text-lg font-semibold text-gray-900">${streamName}</h3>
                ${classification ? `<span class="px-2 py-0.5 text-xs font-medium bg-gradient-to-r from-green-100 to-green-200 text-green-800 rounded">${classification}</span>` : ''}
              </div>
              <p class="text-xs text-gray-500 font-mono mt-1">Key: ${streamKey}</p>
              ${internalId ? `<p class="text-xs text-gray-500 font-mono">Internal ID: ${internalId}</p>` : ''}
            </div>
          </div>
        </div>
        ${valuesHtml}
      </div>
    `;
  }
  
  detailHtml += '</div>';
  
  // Combine header, summary and detail views
  streamsList.innerHTML = headerHtml + summaryHtml + detailHtml;
  
  // Bind toggle button event listener
  const toggleBtn = document.getElementById('toggle-streams-btn');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', toggleStreamsDetail);
  }
}

/**
 * Load and display facility statistics
 * @param {string} facilityURN - Facility URN
 */
async function loadStats(facilityURN) {
  try {
    // Get models
    const models = await getModels(facilityURN);
    
    // Display models (this will load element counts asynchronously)
    await displayModels(models, facilityURN);
    
    // Get and display streams (only from default model)
    const streams = await getStreams(facilityURN);
    await displayStreams(streams, facilityURN);
    
    // Get and display levels
    const levels = await getLevels(facilityURN);
    await displayLevels(levels);
    
    // Get and display rooms
    const rooms = await getRooms(facilityURN);
    await displayRooms(rooms);
    
    // Load schemas for all models (they're already being cached from streams display)
    // but make sure all are loaded
    for (const model of models) {
      await loadSchemaForModel(model.modelId);
    }
    
    // Display schema information
    await displaySchema(models);
    
    // Update stats - models count
    document.getElementById('stat2').textContent = models ? models.length : '0';
    document.getElementById('stat2-desc').textContent = `Model${models?.length !== 1 ? 's' : ''} in facility`;
    
    // Calculate total elements across all models
    if (models && models.length > 0) {
      // Show loading state
      document.getElementById('stat1').innerHTML = '<span class="animate-pulse">...</span>';
      document.getElementById('stat1-desc').textContent = 'Calculating...';
      
      // Fetch all element counts
      const countPromises = models.map(model => getElementCount(model.modelId));
      const counts = await Promise.all(countPromises);
      const totalElements = counts.reduce((sum, count) => sum + count, 0);
      
      // Update total elements stat
      document.getElementById('stat1').textContent = totalElements.toLocaleString();
      document.getElementById('stat1-desc').textContent = 'Total elements across all models';
    } else {
      document.getElementById('stat1').textContent = '0';
      document.getElementById('stat1-desc').textContent = 'No models';
    }
    
    // Placeholder for future stat
    document.getElementById('stat3').textContent = '-';
    document.getElementById('stat3-desc').textContent = 'Coming soon';
    
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
  userProfileImg.addEventListener('click', () => {
    window.open('https://accounts.autodesk.com/users/@me/view', '_blank');
  });

  accountSelect.addEventListener('change', (e) => {
    const accountName = e.target.value;
    window.localStorage.setItem('tandem-stats-last-account', accountName);
    populateFacilitiesDropdown(accounts, accountName);
  });

  facilitySelect.addEventListener('change', (e) => {
    const facilityURN = e.target.value;
    if (facilityURN) {
      window.localStorage.setItem('tandem-stats-last-facility', facilityURN);
      loadFacility(facilityURN);
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

// Start the application when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}
