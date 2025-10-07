import { login, logout, checkLogin } from './auth.js';
import { 
  getGroups, 
  getFacilitiesForGroup, 
  getFacilitiesForUser, 
  getFacilityInfo,
  getModels,
  getModelDetails,
  getElementCount
} from './api.js';

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

// State
let accounts = [];
let currentFacilityURN = null;

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
    
    // Get facility info
    const info = await getFacilityInfo(facilityURN);
    
    if (info) {
      const buildingName = info.props?.["Identity Data"]?.["Building Name"] || "Unknown";
      const location = info.props?.["Identity Data"]?.["Address"] || "No address available";
      
      facilityInfo.innerHTML = `
        <div class="space-y-2">
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
            <span class="text-gray-600 ml-2 text-xs font-mono">${facilityURN}</span>
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
 * Display models list
 * @param {Array} models - Array of model objects
 */
async function displayModels(models) {
  if (!models || models.length === 0) {
    modelsList.innerHTML = '<p class="text-gray-500">No models found in this facility.</p>';
    return;
  }

  // Build initial HTML with loading state for element counts
  let html = '<div class="space-y-4">';
  
  for (let i = 0; i < models.length; i++) {
    const model = models[i];
    const isDefaultModel = model.label === 'Default Model';
    const isMainModel = model.main === true;
    const isModelOn = model.on !== false; // Default to true if not specified
    
    html += `
      <div class="border border-gray-200 rounded-lg p-4 hover:border-tandem-blue transition" id="model-${i}">
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
                ${isDefaultModel ? '<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">Default</span>' : ''}
                ${isMainModel ? '<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">Main</span>' : ''}
                ${isModelOn ? 
                  '<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800"><span class="mr-1">●</span>On</span>' : 
                  '<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800"><span class="mr-1">○</span>Off</span>'}
              </div>
            </div>
          </div>
          <div class="text-right flex-shrink-0">
            <div class="text-2xl font-bold text-tandem-blue" id="element-count-${i}">
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
  
  html += '</div>';
  modelsList.innerHTML = html;

  // Fetch element counts asynchronously for each model
  for (let i = 0; i < models.length; i++) {
    const model = models[i];
    getElementCount(model.modelId).then(count => {
      const countElement = document.getElementById(`element-count-${i}`);
      if (countElement) {
        countElement.innerHTML = count.toLocaleString();
      }
    }).catch(error => {
      console.error(`Error getting element count for ${model.label}:`, error);
      const countElement = document.getElementById(`element-count-${i}`);
      if (countElement) {
        countElement.innerHTML = '-';
      }
    });
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
    await displayModels(models);
    
    // Update stats - models count
    document.getElementById('stat2').textContent = models ? models.length : '0';
    
    // Update descriptions
    const statDescriptions = document.querySelectorAll('#dashboardContent .text-xs.text-gray-500');
    if (statDescriptions[1]) statDescriptions[1].textContent = `Model${models?.length !== 1 ? 's' : ''} in facility`;
    
    // Calculate total elements across all models
    if (models && models.length > 0) {
      // Show loading state
      document.getElementById('stat1').innerHTML = '<span class="animate-pulse">...</span>';
      if (statDescriptions[0]) statDescriptions[0].textContent = 'Calculating...';
      
      // Fetch all element counts
      const countPromises = models.map(model => getElementCount(model.modelId));
      const counts = await Promise.all(countPromises);
      const totalElements = counts.reduce((sum, count) => sum + count, 0);
      
      // Update total elements stat
      document.getElementById('stat1').textContent = totalElements.toLocaleString();
      if (statDescriptions[0]) statDescriptions[0].textContent = 'Total elements across all models';
    } else {
      document.getElementById('stat1').textContent = '0';
      if (statDescriptions[0]) statDescriptions[0].textContent = 'No models';
    }
    
    // Placeholder for future stat
    document.getElementById('stat3').textContent = '-';
    if (statDescriptions[2]) statDescriptions[2].textContent = 'Coming soon';
    
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
