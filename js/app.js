import { login, logout, checkLogin } from './auth.js';
import { 
  getGroups, 
  getFacilitiesForGroup, 
  getFacilitiesForUser, 
  getFacilityInfo,
  getModels 
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
 * @param {Array} accounts - List of accounts
 */
function populateAccountsDropdown(accounts) {
  accountSelect.innerHTML = '<option value="">Select Account...</option>';
  
  const lastAccount = window.localStorage.getItem('tandem-stats-last-account');
  let selectedAccount = accounts[0];

  accounts.forEach((account, index) => {
    const option = document.createElement('option');
    option.value = index;
    option.textContent = account.name;
    
    if (account.name === lastAccount) {
      option.selected = true;
      selectedAccount = account;
    }
    
    accountSelect.appendChild(option);
  });

  accountSelect.classList.remove('hidden');
  
  // Populate facilities for the selected account
  if (selectedAccount) {
    populateFacilitiesDropdown(selectedAccount);
  }
}

/**
 * Populate the facilities dropdown
 * @param {object} account - Selected account
 */
function populateFacilitiesDropdown(account) {
  facilitySelect.innerHTML = '<option value="">Select Facility...</option>';
  
  if (!account.facilities || account.facilities.size === 0) {
    facilitySelect.classList.add('hidden');
    return;
  }

  const lastFacilityURN = window.localStorage.getItem('tandem-stats-last-facility');
  let selectedFacilityURN = null;

  for (const [urn, facility] of account.facilities.entries()) {
    const option = document.createElement('option');
    option.value = urn;
    option.textContent = facility.props?.["Identity Data"]?.["Building Name"] || "Unknown Facility";
    
    if (urn === lastFacilityURN) {
      option.selected = true;
      selectedFacilityURN = urn;
    }
    
    facilitySelect.appendChild(option);
  }

  facilitySelect.classList.remove('hidden');

  // Load the selected facility
  if (selectedFacilityURN || account.facilities.size > 0) {
    const facilityToLoad = selectedFacilityURN || account.facilities.keys().next().value;
    loadFacility(facilityToLoad);
  }
}

/**
 * Load and display facility information
 * @param {string} facilityURN - Facility URN
 */
async function loadFacility(facilityURN) {
  if (!facilityURN) return;
  
  currentFacilityURN = facilityURN;
  window.localStorage.setItem('tandem-stats-last-facility', facilityURN);
  
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
 * Load and display facility statistics
 * @param {string} facilityURN - Facility URN
 */
async function loadStats(facilityURN) {
  try {
    // Get models
    const models = await getModels(facilityURN);
    
    // Update stats
    document.getElementById('stat1').textContent = '-';
    document.getElementById('stat2').textContent = models ? models.length : '0';
    document.getElementById('stat3').textContent = '-';
    
    // Update descriptions
    const statDescriptions = document.querySelectorAll('#dashboardContent .text-xs.text-gray-500');
    if (statDescriptions[0]) statDescriptions[0].textContent = 'Coming soon';
    if (statDescriptions[1]) statDescriptions[1].textContent = `Model${models?.length !== 1 ? 's' : ''} in facility`;
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
    const accountIndex = parseInt(e.target.value);
    if (!isNaN(accountIndex) && accounts[accountIndex]) {
      window.localStorage.setItem('tandem-stats-last-account', accounts[accountIndex].name);
      populateFacilitiesDropdown(accounts[accountIndex]);
    }
  });

  facilitySelect.addEventListener('change', (e) => {
    const facilityURN = e.target.value;
    if (facilityURN) {
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
