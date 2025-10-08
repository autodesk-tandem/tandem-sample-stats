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
  getRooms,
  getDocuments,
  getTaggedAssetsCount
} from './api.js';
import { convertLongKeysToShortKeys, getDataTypeName, formatUnitName } from './utils.js';

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
const documentsList = document.getElementById('documentsList');
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
                 class="w-full md:w-64 h-48 object-cover rounded border border-dark-border">
          </div>
          ` : ''}
          <div class="flex-grow space-y-2">
            <div>
              <span class="font-medium text-dark-text text-xs">Building Name:</span>
              <span class="text-dark-text-secondary ml-2 text-xs">${buildingName}</span>
            </div>
            <div>
              <span class="font-medium text-dark-text text-xs">Location:</span>
              <span class="text-dark-text-secondary ml-2 text-xs">${location}</span>
            </div>
            <div>
              <span class="font-medium text-dark-text text-xs">Facility URN:</span>
              <span class="text-dark-text-secondary ml-2 text-xs font-mono break-all">${facilityURN}</span>
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
    modelsList.innerHTML = '<p class="text-dark-text-secondary">No models found in this facility.</p>';
    return;
  }

  // Build header with toggle button (always visible)
  let headerHtml = `
    <div class="flex items-center justify-between mb-3">
      <div class="flex items-center space-x-2">
        <div class="text-xl font-bold text-tandem-blue">${models.length}</div>
        <div class="text-sm text-dark-text-secondary">
          <div>Model${models.length !== 1 ? 's' : ''}</div>
          <div id="summary-total-elements" class="text-xs text-dark-text-secondary">Calculating...</div>
        </div>
      </div>
      <button id="toggle-models-btn"
              class="p-2 hover:bg-dark-bg/50 rounded transition"
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
  
  // Build summary view (collapsed state)
  let summaryHtml = `
    <div id="models-summary"></div>
  `;

  // Build detailed view (initially hidden)
  let detailHtml = '<div id="models-detail" class="hidden space-y-2">';
  
  for (let i = 0; i < models.length; i++) {
    const model = models[i];
    // Check if it's the default model by comparing URN IDs
    const isDefault = isDefaultModel(facilityURN, model.modelId);
    const isMainModel = model.main === true;
    const isModelOn = model.on !== false; // Default to true if not specified
    
    detailHtml += `
      <div class="border border-dark-border rounded p-4 hover:border-tandem-blue transition" id="detail-model-${i}">
        <div class="flex items-start justify-between mb-3">
          <div class="flex items-center space-x-3">
            <div class="flex-shrink-0">
              <div class="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded flex items-center justify-center">
                <span class="text-white font-semibold text-sm">${i + 1}</span>
              </div>
            </div>
            <div class="flex-grow">
              <div class="flex items-center space-x-2 mb-1">
                <h3 class="text-lg font-semibold text-dark-text">${model.label || 'Untitled Model'}</h3>
              </div>
              <div class="flex items-center gap-2 flex-wrap">
                ${isDefault ? '<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-500/20 text-purple-300">Default</span>' : ''}
                ${isMainModel ? '<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-500/20 text-blue-300">Main</span>' : ''}
                ${isModelOn ? 
                  '<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-500/20 text-green-300"><span class="mr-1">●</span>On</span>' : 
                  '<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-500/20 text-gray-300"><span class="mr-1">○</span>Off</span>'}
              </div>
            </div>
          </div>
          <div class="text-right flex-shrink-0">
            <div class="text-lg font-bold text-tandem-blue" id="detail-element-count-${i}">
              <span class="inline-block animate-pulse">...</span>
            </div>
            <div class="text-xs text-dark-text-secondary">Elements</div>
          </div>
        </div>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <div>
            <span class="font-medium text-dark-text">Model ID:</span>
            <span class="text-dark-text-secondary ml-2 font-mono text-xs break-all">${model.modelId}</span>
          </div>
          ${model.version ? `
          <div>
            <span class="font-medium text-dark-text">Version:</span>
            <span class="text-dark-text-secondary ml-2">${model.version}</span>
          </div>
          ` : ''}
          ${model.createdAt ? `
          <div>
            <span class="font-medium text-dark-text">Created:</span>
            <span class="text-dark-text-secondary ml-2">${new Date(model.createdAt).toLocaleDateString()}</span>
          </div>
          ` : ''}
          ${model.lastModified ? `
          <div>
            <span class="font-medium text-dark-text">Last Modified:</span>
            <span class="text-dark-text-secondary ml-2">${new Date(model.lastModified).toLocaleDateString()}</span>
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
 * Toggle documents detail view
 */
function toggleDocumentsDetail() {
  const detailSection = document.getElementById('documents-detail');
  const summarySection = document.getElementById('documents-summary');
  const toggleBtn = document.getElementById('toggle-documents-btn');
  const iconDown = document.getElementById('toggle-documents-icon-down');
  const iconUp = document.getElementById('toggle-documents-icon-up');
  
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
    levelsList.innerHTML = '<p class="text-dark-text-secondary">No levels found in this facility.</p>';
    return;
  }

  // Build header with toggle button
  let headerHtml = `
    <div class="flex items-center justify-between mb-3">
      <div class="flex items-center space-x-2">
        <div class="text-xl font-bold text-tandem-blue">${levels.length}</div>
        <div class="text-sm text-dark-text-secondary">
          <div>Level${levels.length !== 1 ? 's' : ''}</div>
        </div>
      </div>
      <button id="toggle-levels-btn"
              class="p-2 hover:bg-dark-bg/50 rounded transition"
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
  
  // Build summary view (collapsed state)
  let summaryHtml = `
    <div id="levels-summary"></div>
  `;

  // Group levels by model
  const levelsByModel = {};
  levels.forEach(level => {
    if (!levelsByModel[level.modelId]) {
      levelsByModel[level.modelId] = {
        modelName: level.modelName,
        modelId: level.modelId,
        levels: []
      };
    }
    levelsByModel[level.modelId].levels.push(level);
  });

  // Build detailed view grouped by model
  let detailHtml = '<div id="levels-detail" class="hidden space-y-2">';
  
  let levelCounter = 0;
  for (const modelId in levelsByModel) {
    const modelGroup = levelsByModel[modelId];
    
    detailHtml += `
      <div class="border border-dark-border rounded overflow-hidden">
        <!-- Model Header -->
        <div class="bg-gradient-to-r from-purple-900/30 to-purple-800/30 px-4 py-3 border-b border-dark-border">
          <div class="font-semibold text-dark-text">${modelGroup.modelName}</div>
          <div class="text-xs font-mono text-dark-text-secondary mt-1">${modelGroup.modelId}</div>
          <div class="text-xs text-dark-text-secondary mt-1">${modelGroup.levels.length} level${modelGroup.levels.length !== 1 ? 's' : ''}</div>
        </div>
        
        <!-- Levels in this model -->
        <div class="divide-y divide-dark-border">
    `;
    
    modelGroup.levels.forEach(level => {
      levelCounter++;
      
      // Format elevation if available
      const elevationDisplay = level.elevation !== undefined && level.elevation !== null
        ? `<span class="text-sm text-dark-text-secondary ml-3">• Elevation: ${level.elevation.toFixed(2)} ft</span>`
        : '';
      
      detailHtml += `
        <div class="p-3 hover:bg-dark-bg/30 transition bg-dark-card">
          <div class="flex items-start space-x-3">
            <div class="flex-shrink-0 w-7 h-7 bg-gradient-to-br from-purple-500 to-purple-600 rounded flex items-center justify-center">
              <span class="text-white font-semibold text-xs">${levelCounter}</span>
            </div>
            <div class="flex-grow min-w-0">
              <div class="flex items-baseline flex-wrap gap-2">
                <span class="font-semibold text-dark-text">${level.name}</span>
                <span class="text-xs font-mono text-dark-text-secondary">${level.key}</span>
              </div>
              ${elevationDisplay}
            </div>
          </div>
        </div>
      `;
    });
    
    detailHtml += `
        </div>
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
 * @param {string} sortBy - Sort by 'name' or 'area' (default: null for no sorting)
 * @param {string} sortDirection - 'asc' or 'desc' (default: 'asc')
 */
async function displayRooms(rooms, sortBy = null, sortDirection = 'asc') {
  if (!rooms || rooms.length === 0) {
    roomsList.innerHTML = '<p class="text-dark-text-secondary">No rooms or spaces found in this facility.</p>';
    return;
  }

  // Check if detail section is currently visible (to preserve state after re-render)
  const detailSection = document.getElementById('rooms-detail');
  const isDetailVisible = detailSection && !detailSection.classList.contains('hidden');

  // Build header with toggle button and sort controls
  let headerHtml = `
    <div class="flex items-center justify-between mb-3">
      <div class="flex items-center space-x-2">
        <div class="text-xl font-bold text-tandem-blue">${rooms.length}</div>
        <div class="text-sm text-dark-text-secondary">
          <div>Room${rooms.length !== 1 ? 's' : ''} & Space${rooms.length !== 1 ? 's' : ''}</div>
        </div>
      </div>
      <div class="flex items-center space-x-3">
        <div class="flex items-center space-x-2 text-sm border-r border-dark-border pr-3">
          <span class="text-dark-text-secondary">Sort:</span>
          <select id="rooms-sort-select" class="px-3 py-1.5 border border-dark-border rounded text-sm focus:outline-none focus:ring-2 focus:ring-tandem-blue bg-dark-card">
            <option value="">None</option>
            <option value="name" ${sortBy === 'name' ? 'selected' : ''}>Name ${sortBy === 'name' ? (sortDirection === 'asc' ? '(A→Z)' : '(Z→A)') : ''}</option>
            <option value="area" ${sortBy === 'area' ? 'selected' : ''}>Area ${sortBy === 'area' ? (sortDirection === 'asc' ? '(↑)' : '(↓)') : ''}</option>
          </select>
          <button id="rooms-sort-direction" 
                  class="px-2 py-1 text-xs font-medium rounded transition ${!sortBy ? 'bg-gray-500/20 text-gray-300-secondary cursor-not-allowed' : 'bg-tandem-blue text-white hover:bg-blue-700'}"
                  title="${sortDirection === 'asc' ? 'Switch to Descending' : 'Switch to Ascending'}"
                  ${!sortBy ? 'disabled' : ''}>
            ${sortDirection === 'asc' ? 'A→Z / ↑' : 'Z→A / ↓'}
          </button>
        </div>
        <button id="toggle-rooms-btn"
                class="p-2 hover:bg-dark-bg/50 rounded transition"
                title="${isDetailVisible ? 'Show less' : 'Show more'}">
          <svg id="toggle-rooms-icon-down" class="w-5 h-5 ${isDetailVisible ? 'hidden' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
          </svg>
          <svg id="toggle-rooms-icon-up" class="w-5 h-5 ${isDetailVisible ? '' : 'hidden'}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"></path>
          </svg>
        </button>
      </div>
    </div>
  `;
  
  // Build summary view (collapsed state, hide if detail is visible)
  let summaryHtml = `
    <div id="rooms-summary" class="${isDetailVisible ? 'hidden' : ''}"></div>
  `;

  // Group rooms by model
  const roomsByModel = {};
  rooms.forEach(room => {
    if (!roomsByModel[room.modelId]) {
      roomsByModel[room.modelId] = {
        modelName: room.modelName,
        modelId: room.modelId,
        rooms: []
      };
    }
    roomsByModel[room.modelId].rooms.push(room);
  });

  // Sort rooms within each model group if sortBy is specified
  if (sortBy) {
    for (const modelId in roomsByModel) {
      const modelGroup = roomsByModel[modelId];
      modelGroup.rooms.sort((a, b) => {
        let aVal, bVal;
        
        if (sortBy === 'name') {
          aVal = (a.name || '').toLowerCase();
          bVal = (b.name || '').toLowerCase();
        } else if (sortBy === 'area') {
          // Treat null/undefined as 0 for sorting
          aVal = a.area !== null && a.area !== undefined ? a.area : 0;
          bVal = b.area !== null && b.area !== undefined ? b.area : 0;
        }
        
        if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }
  }

  // Build detailed view grouped by model (show if it was visible before)
  let detailHtml = `<div id="rooms-detail" class="${isDetailVisible ? '' : 'hidden'} space-y-2">`;
  
  let roomCounter = 0;
  for (const modelId in roomsByModel) {
    const modelGroup = roomsByModel[modelId];
    
    // Count rooms vs spaces in this model
    const modelRoomCount = modelGroup.rooms.filter(r => r.type === 'Room').length;
    const modelSpaceCount = modelGroup.rooms.filter(r => r.type === 'Space').length;
    
    detailHtml += `
      <div class="border border-dark-border rounded overflow-hidden">
        <!-- Model Header -->
        <div class="bg-gradient-to-r from-indigo-900/30 to-indigo-800/30 px-4 py-3 border-b border-dark-border">
          <div class="font-semibold text-dark-text">${modelGroup.modelName}</div>
          <div class="text-xs font-mono text-dark-text-secondary mt-1">${modelGroup.modelId}</div>
          <div class="text-xs text-dark-text-secondary mt-1">${modelRoomCount} room${modelRoomCount !== 1 ? 's' : ''}, ${modelSpaceCount} space${modelSpaceCount !== 1 ? 's' : ''}</div>
        </div>
        
        <!-- Rooms/Spaces in this model -->
        <div class="divide-y divide-dark-border">
    `;
    
    modelGroup.rooms.forEach(room => {
      roomCounter++;
      const isSpace = room.type === 'Space';
      
      // Format additional properties inline
      const propsArray = [];
      if (room.area !== undefined && room.area !== null) {
        const areaUnitFormatted = formatUnitName(room.areaUnit);
        propsArray.push(`${room.area.toFixed(2)} ${areaUnitFormatted}`);
      }
      if (room.volume !== undefined && room.volume !== null) {
        const volumeUnitFormatted = formatUnitName(room.volumeUnit);
        propsArray.push(`${room.volume.toFixed(2)} ${volumeUnitFormatted}`);
      }
      
      const propsDisplay = propsArray.length > 0
        ? `<span class="text-sm text-dark-text-secondary ml-3">• ${propsArray.join(' • ')}</span>`
        : '';
      
      detailHtml += `
        <div class="p-3 hover:bg-dark-bg/30 transition bg-dark-card">
          <div class="flex items-start space-x-3">
            <div class="flex-shrink-0 w-7 h-7 bg-gradient-to-br ${isSpace ? 'from-orange-500 to-orange-600' : 'from-indigo-500 to-indigo-600'} rounded flex items-center justify-center">
              <span class="text-white font-semibold text-xs">${roomCounter}</span>
            </div>
            <div class="flex-grow min-w-0">
              <div class="flex items-baseline flex-wrap gap-2">
                <span class="font-semibold text-dark-text">${room.name}</span>
                <span class="px-2 py-0.5 text-xs font-medium ${isSpace ? 'bg-orange-500/20 text-orange-300' : 'bg-indigo-500/20 text-indigo-300'} rounded">${room.type}</span>
                <span class="text-xs font-mono text-dark-text-secondary">${room.key}</span>
              </div>
              ${propsDisplay}
            </div>
          </div>
        </div>
      `;
    });
    
    detailHtml += `
        </div>
      </div>
    `;
  }
  
  detailHtml += '</div>';
  
  roomsList.innerHTML = headerHtml + summaryHtml + detailHtml;
  
  // Store rooms data for re-sorting
  roomsList.dataset.roomsData = JSON.stringify(rooms);
  
  const toggleBtn = document.getElementById('toggle-rooms-btn');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', toggleRoomsDetail);
  }
  
  // Add sort controls event listeners
  const sortSelect = document.getElementById('rooms-sort-select');
  const sortDirectionBtn = document.getElementById('rooms-sort-direction');
  
  if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
      const newSortBy = e.target.value || null;
      displayRooms(rooms, newSortBy, sortDirection);
    });
  }
  
  if (sortDirectionBtn) {
    sortDirectionBtn.addEventListener('click', () => {
      if (sortBy) {
        const newDirection = sortDirection === 'asc' ? 'desc' : 'asc';
        displayRooms(rooms, sortBy, newDirection);
      }
    });
  }
}

/**
 * Open a document in a new tab with authentication
 * @param {string} documentUrl - Document URL
 * @param {string} contentType - Document content type
 */
async function openDocument(documentUrl, contentType) {
  try {
    const response = await fetch(documentUrl, {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer ' + window.sessionStorage.token
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch document: ${response.statusText}`);
    }
    
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    window.open(blobUrl, '_blank');
    
    // Clean up the blob URL after a delay
    setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
  } catch (error) {
    console.error('Error opening document:', error);
    alert('Failed to open document. Please try again.');
  }
}

/**
 * Display documents list
 * @param {Array} documents - Array of document objects
 */
async function displayDocuments(documents) {
  if (!documents || documents.length === 0) {
    documentsList.innerHTML = '<p class="text-dark-text-secondary">No documents found in this facility.</p>';
    return;
  }

  // Build header with toggle button
  let headerHtml = `
    <div class="flex items-center justify-between mb-3">
      <div class="flex items-center space-x-2">
        <div class="text-xl font-bold text-tandem-blue">${documents.length}</div>
        <div class="text-sm text-dark-text-secondary">
          <div>Document${documents.length !== 1 ? 's' : ''}</div>
        </div>
      </div>
      <button id="toggle-documents-btn"
              class="p-2 hover:bg-dark-bg/50 rounded transition"
              title="Show more">
        <svg id="toggle-documents-icon-down" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
        </svg>
        <svg id="toggle-documents-icon-up" class="w-5 h-5 hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"></path>
        </svg>
      </button>
    </div>
  `;
  
  // Build summary view (collapsed state)
  let summaryHtml = `
    <div id="documents-summary"></div>
  `;

  // Build detailed view (initially hidden)
  let detailHtml = '<div id="documents-detail" class="hidden space-y-2">';
  
  for (let i = 0; i < documents.length; i++) {
    const doc = documents[i];
    
    // Format file size if available
    const fileSizeDisplay = doc.size ? `<span class="text-sm text-dark-text-secondary">Size: ${(doc.size / 1024 / 1024).toFixed(2)} MB</span>` : '';
    
    // Format last updated date
    const lastUpdated = doc.lastUpdated ? new Date(doc.lastUpdated).toLocaleString() : 'Unknown';
    
    // Determine file type icon color based on content type
    let iconColor = 'from-gray-500 to-gray-600';
    if (doc.contentType) {
      if (doc.contentType.includes('pdf')) iconColor = 'from-red-500 to-red-600';
      else if (doc.contentType.includes('image')) iconColor = 'from-green-500 to-green-600';
      else if (doc.contentType.includes('word') || doc.contentType.includes('document')) iconColor = 'from-blue-500 to-blue-600';
      else if (doc.contentType.includes('excel') || doc.contentType.includes('spreadsheet')) iconColor = 'from-green-600 to-green-700';
    }
    
    detailHtml += `
      <div class="border border-dark-border rounded p-4 hover:border-tandem-blue transition">
        <div class="flex items-start space-x-3">
          <div class="flex-shrink-0 w-10 h-10 bg-gradient-to-br ${iconColor} rounded flex items-center justify-center">
            <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path>
            </svg>
          </div>
          <div class="flex-grow min-w-0">
            <div class="flex items-center justify-between mb-2">
              <div class="flex-grow min-w-0">
                <h3 class="text-sm font-semibold text-dark-text truncate">${doc.name || 'Untitled Document'}</h3>
                ${doc.label ? `<p class="text-sm text-dark-text-secondary">${doc.label}</p>` : ''}
              </div>
              ${doc.signedLink ? `
              <button data-doc-url="${doc.signedLink}" 
                      data-doc-type="${doc.contentType || ''}"
                      class="doc-open-btn ml-3 flex-shrink-0 inline-flex items-center px-3 py-1.5 border border-tandem-blue text-tandem-blue rounded hover:bg-tandem-blue hover:text-white transition text-sm font-medium cursor-pointer">
                <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
                </svg>
                Open
              </button>
              ` : ''}
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
              ${doc.contentType ? `
              <div>
                <span class="font-medium text-dark-text">Type:</span>
                <span class="text-dark-text-secondary ml-2">${doc.contentType}</span>
              </div>
              ` : ''}
              <div>
                <span class="font-medium text-dark-text">Last Updated:</span>
                <span class="text-dark-text-secondary ml-2">${lastUpdated}</span>
              </div>
              ${fileSizeDisplay ? `<div>${fileSizeDisplay}</div>` : ''}
              ${doc.accProjectId ? `
              <div>
                <span class="font-medium text-dark-text">ACC Project:</span>
                <span class="text-dark-text-secondary ml-2 font-mono text-xs">${doc.accProjectId}</span>
              </div>
              ` : ''}
            </div>
            ${doc.id ? `<div class="mt-2 text-xs text-dark-text-secondary font-mono">${doc.id}</div>` : ''}
          </div>
        </div>
      </div>
    `;
  }
  
  detailHtml += '</div>';
  
  documentsList.innerHTML = headerHtml + summaryHtml + detailHtml;
  
  const toggleBtn = document.getElementById('toggle-documents-btn');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', toggleDocumentsDetail);
  }
  
  // Add event listeners for document open buttons
  const openButtons = documentsList.querySelectorAll('.doc-open-btn');
  openButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const url = btn.getAttribute('data-doc-url');
      const contentType = btn.getAttribute('data-doc-type');
      openDocument(url, contentType);
    });
  });
}

/**
 * Render a schema table for a model
 * @param {string} modelId - Model ID
 * @param {Array} attributes - Array of attribute objects
 * @param {string} sortColumn - Column to sort by
 * @param {string} sortDirection - 'asc' or 'desc'
 * @param {boolean} showAll - Whether to show all attributes or just the first 20
 */
function renderSchemaTable(modelId, attributes, sortColumn = null, sortDirection = 'asc', showAll = false) {
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
      <thead class="bg-dark-bg/50">
        <tr>
          <th class="px-3 py-2 text-left font-semibold text-dark-text cursor-pointer hover:bg-dark-bg/50 select-none" 
              data-model="${modelId}" data-column="id" data-direction="${sortColumn === 'id' ? (sortDirection === 'asc' ? 'desc' : 'asc') : 'asc'}">
            <div class="flex items-center gap-1">
              <span>ID</span>
              ${sortColumn === 'id' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
            </div>
          </th>
          <th class="px-3 py-2 text-left font-semibold text-dark-text cursor-pointer hover:bg-dark-bg/50 select-none" 
              data-model="${modelId}" data-column="category" data-direction="${sortColumn === 'category' ? (sortDirection === 'asc' ? 'desc' : 'asc') : 'asc'}">
            <div class="flex items-center gap-1">
              <span>Category</span>
              ${sortColumn === 'category' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
            </div>
          </th>
          <th class="px-3 py-2 text-left font-semibold text-dark-text cursor-pointer hover:bg-dark-bg/50 select-none" 
              data-model="${modelId}" data-column="name" data-direction="${sortColumn === 'name' ? (sortDirection === 'asc' ? 'desc' : 'asc') : 'asc'}">
            <div class="flex items-center gap-1">
              <span>Name</span>
              ${sortColumn === 'name' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
            </div>
          </th>
          <th class="px-3 py-2 text-left font-semibold text-dark-text cursor-pointer hover:bg-dark-bg/50 select-none" 
              data-model="${modelId}" data-column="dataType" data-direction="${sortColumn === 'dataType' ? (sortDirection === 'asc' ? 'desc' : 'asc') : 'asc'}">
            <div class="flex items-center gap-1">
              <span>Data Type</span>
              ${sortColumn === 'dataType' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
            </div>
          </th>
        </tr>
      </thead>
      <tbody class="divide-y divide-dark-border">
  `;

  // Show first 20 attributes by default, or all if showAll is true
  const displayCount = showAll ? sortedAttributes.length : Math.min(20, sortedAttributes.length);
  
  for (let j = 0; j < displayCount; j++) {
    const attr = sortedAttributes[j];
    const dataTypeName = getDataTypeName(attr.dataType);
    tableHtml += `
      <tr class="hover:bg-dark-bg/30">
        <td class="px-3 py-2 font-mono text-dark-text-secondary">${attr.id || ''}</td>
        <td class="px-3 py-2 text-dark-text">${attr.category || ''}</td>
        <td class="px-3 py-2 text-dark-text">${attr.name || ''}</td>
        <td class="px-3 py-2 text-dark-text-secondary">${dataTypeName}</td>
      </tr>
    `;
  }

  if (sortedAttributes.length > 20 && !showAll) {
    tableHtml += `
      <tr>
        <td colspan="4" class="px-3 py-2 text-center">
          <button class="text-tandem-blue hover:text-blue-700 font-medium text-sm cursor-pointer"
                  data-model="${modelId}" data-show-all="true">
            ... and ${sortedAttributes.length - 20} more attributes (click to show all)
          </button>
        </td>
      </tr>
    `;
  } else if (showAll && sortedAttributes.length > 20) {
    tableHtml += `
      <tr>
        <td colspan="4" class="px-3 py-2 text-center">
          <button class="text-tandem-blue hover:text-blue-700 font-medium text-sm cursor-pointer"
                  data-model="${modelId}" data-show-all="false">
            Show less
          </button>
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
      renderSchemaTable(modelId, attributes, column, direction, showAll);
    });
  });

  // Add click handler to "show more/less" button
  const showMoreBtn = tableContainer.querySelector('button[data-show-all]');
  if (showMoreBtn) {
    showMoreBtn.addEventListener('click', () => {
      const shouldShowAll = showMoreBtn.getAttribute('data-show-all') === 'true';
      renderSchemaTable(modelId, attributes, sortColumn, sortDirection, shouldShowAll);
    });
  }
}

/**
 * Display schema for all models
 * @param {Array} models - Array of model objects
 */
async function displaySchema(models) {
  if (!models || models.length === 0) {
    schemaList.innerHTML = '<p class="text-dark-text-secondary">No models found.</p>';
    return;
  }

  // Count total attributes across all models
  let totalAttributes = 0;
  for (const modelURN in schemaCache) {
    totalAttributes += schemaCache[modelURN].attributes.length;
  }

  // Build header with toggle button
  let headerHtml = `
    <div class="flex items-center justify-between mb-3">
      <div class="flex items-center space-x-2">
        <div class="text-xl font-bold text-tandem-blue">${totalAttributes}</div>
        <div class="text-sm text-dark-text-secondary">
          <div>Attribute${totalAttributes !== 1 ? 's' : ''} across ${models.length} model${models.length !== 1 ? 's' : ''}</div>
        </div>
      </div>
      <button id="toggle-schema-btn"
              class="p-2 hover:bg-dark-bg/50 rounded transition"
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
  
  // Build summary view (collapsed state)
  let summaryHtml = `
    <div id="schema-summary"></div>
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
      <div class="border border-dark-border rounded p-4">
        <h3 class="font-semibold text-dark-text mb-3 flex items-center gap-2">
          <span class="flex-shrink-0 w-6 h-6 bg-gradient-to-br from-teal-500 to-teal-600 rounded flex items-center justify-center">
            <span class="text-white font-semibold text-xs">${i + 1}</span>
          </span>
          ${model.label}
          <span class="text-sm font-normal text-dark-text-secondary">(${schema.attributes.length} attributes)</span>
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
    streamsList.innerHTML = '<p class="text-dark-text-secondary">No streams found in this facility.</p>';
    return;
  }

  // Build header with toggle button (always visible)
  let headerHtml = `
    <div class="flex items-center justify-between mb-3">
      <div class="flex items-center space-x-2">
        <div class="text-xl font-bold text-tandem-blue">${streams.length}</div>
        <div class="text-sm text-dark-text-secondary">
          <div>Stream${streams.length !== 1 ? 's' : ''}</div>
        </div>
      </div>
      <button id="toggle-streams-btn"
              class="p-2 hover:bg-dark-bg/50 rounded transition"
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
  
  // Build summary view (collapsed state)
  let summaryHtml = `
    <div id="streams-summary"></div>
  `;

  // Get the default model URN (streams only exist in the default model)
  const defaultModelURN = facilityURN.replace('urn:adsk.dtt:', 'urn:adsk.dtm:');
  
  // Load schema for the default model (cached)
  await loadSchemaForModel(defaultModelURN);
  
  // Fetch last seen values for all streams
  const streamKeys = streams.map(s => s['k']);
  const lastSeenValuesRaw = await getLastSeenStreamValues(facilityURN, streamKeys);
  
  // Convert long keys to short keys so we can match them with our stream objects
  const lastSeenValues = convertLongKeysToShortKeys(lastSeenValuesRaw);

  // Build detailed view (initially hidden)
  let detailHtml = '<div id="streams-detail" class="hidden space-y-2">';
  
  for (let i = 0; i < streams.length; i++) {
    const stream = streams[i];
    
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
    
    // Get last seen values for this stream
    const streamValues = lastSeenValues[streamKey];
    let valuesHtml = '';
    
    if (streamValues && Object.keys(streamValues).length > 0) {
      valuesHtml = '<div class="mt-3 pt-3 border-t border-dark-border"><div class="text-xs font-semibold text-dark-text mb-2">Last Seen Values:</div><div class="space-y-2">';
      
      for (const [propKey, propValues] of Object.entries(streamValues)) {
        // propKey is like "z:LQ" which is the internal property ID
        // Get human-readable display name
        const displayName = await getPropertyDisplayName(defaultModelURN, propKey);
        
        valuesHtml += `<div class="bg-dark-bg/50 rounded p-2">`;
        valuesHtml += `<div class="text-xs mb-1">`;
        valuesHtml += `<div class="font-semibold text-dark-text">${displayName}</div>`;
        valuesHtml += `<div class="font-mono text-dark-text-secondary text-xs">${propKey}</div>`;
        valuesHtml += `</div>`;
        
        for (const [timestamp, value] of Object.entries(propValues)) {
          const date = new Date(parseInt(timestamp));
          valuesHtml += `
            <div class="flex justify-between items-center text-xs pl-2 mt-1">
              <span class="text-dark-text-secondary">${date.toLocaleString()}</span>
              <span class="font-semibold text-dark-text">${value}</span>
            </div>
          `;
        }
        valuesHtml += '</div>';
      }
      
      valuesHtml += '</div></div>';
    }
    
    detailHtml += `
      <div class="border border-dark-border rounded p-4 hover:border-tandem-blue transition">
        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-3 flex-grow">
            <div class="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-green-500 to-green-600 rounded flex items-center justify-center">
              <span class="text-white font-semibold text-sm">${i + 1}</span>
            </div>
            <div class="flex-grow">
              <div class="flex items-center gap-2 mb-1">
                <h3 class="text-lg font-semibold text-dark-text">${streamName}</h3>
                ${classification ? `<span class="px-2 py-0.5 text-xs font-medium bg-gradient-to-r from-green-500/30 to-green-600/30 text-green-300 rounded">${classification}</span>` : ''}
              </div>
              <p class="text-xs text-dark-text-secondary font-mono mt-1">Key: ${streamKey}</p>
              ${internalId ? `<p class="text-xs text-dark-text-secondary font-mono">Internal ID: ${internalId}</p>` : ''}
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
    
    // Pre-load and cache schemas for all models FIRST
    // This ensures we only call /schema once per model
    for (const model of models) {
      await loadSchemaForModel(model.modelId);
    }
    
    // Display models (this will load element counts asynchronously)
    await displayModels(models, facilityURN);
    
    // Get and display streams (only from default model)
    const streams = await getStreams(facilityURN);
    await displayStreams(streams, facilityURN);
    
    // Get and display levels
    const levels = await getLevels(facilityURN);
    await displayLevels(levels);
    
    // Get and display rooms (pass schema cache to avoid duplicate calls)
    const rooms = await getRooms(facilityURN, schemaCache);
    await displayRooms(rooms);
    
    // Get and display documents
    const documents = await getDocuments(facilityURN);
    await displayDocuments(documents);
    
    // Display schema information
    await displaySchema(models);
    
    // Update stats - models count
    document.getElementById('stat2').textContent = models ? models.length : '0';
    document.getElementById('stat2-desc').textContent = `Model${models?.length !== 1 ? 's' : ''} in facility`;
    
    // Calculate tagged assets (elements with user-defined properties)
    if (models && models.length > 0) {
      // Show loading state
      document.getElementById('stat1').innerHTML = '<span class="animate-pulse">...</span>';
      document.getElementById('stat1-desc').textContent = 'Calculating...';
      
      // Fetch tagged assets count
      const taggedAssetsCount = await getTaggedAssetsCount(facilityURN);
      
      // Update tagged assets stat
      document.getElementById('stat1').textContent = taggedAssetsCount.toLocaleString();
      document.getElementById('stat1-desc').textContent = 'Elements with user-defined properties';
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

