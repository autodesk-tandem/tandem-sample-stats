import { getUserResources, getFacilityInfo, getGroupHistory } from '../api.js';
import { Region, HC } from '../../tandem/constants.js';

/**
 * Get access level display name
 * @param {number|string} accessLevel - Access level numeric or string value
 * @returns {string} Human-readable access level
 */
function getAccessLevelName(accessLevel) {
  // Handle both numeric and string values
  const levels = {
    0: 'None',
    1: 'Read',
    2: 'Manage',
    3: 'Owner',
    '0': 'None',
    '1': 'Read',
    '2': 'Manage',
    '3': 'Owner',
    // Also handle if backend already returns string names
    'None': 'None',
    'Read': 'Read',
    'Manage': 'Manage',
    'Owner': 'Owner'
  };
  return levels[accessLevel] || accessLevel || 'Unknown';
}

/**
 * Get region display name and color
 * @param {string} region - Region code
 * @returns {object} Object with name and color
 */
function getRegionInfo(region) {
  const regionMap = {
    [Region.US]: { name: 'United States', color: 'bg-blue-600' },
    [Region.EMEA]: { name: 'Europe, Middle East & Africa', color: 'bg-green-600' },
    [Region.AUS]: { name: 'Australia', color: 'bg-orange-600' },
    'EU': { name: 'Europe', color: 'bg-purple-600' }
  };
  return regionMap[region] || { name: region, color: 'bg-gray-600' };
}

/**
 * View user resources in a new window
 */
export async function viewUserResources() {
  // Open new window
  const newWindow = window.open('', '_blank');
  if (!newWindow) {
    alert('Please allow pop-ups to view user resources');
    return;
  }

  // Set up the window with loading state
  newWindow.document.write(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>User Resources - Tandem Stats</title>
      <script src="https://cdn.tailwindcss.com"></script>
      <script>
        tailwind.config = {
          theme: {
            extend: {
              colors: {
                'tandem-blue': '#0696D7',
                'tandem-dark': '#0D2C54',
                'dark-bg': '#1a1a1a',
                'dark-card': '#2a2a2a',
                'dark-border': '#404040',
                'dark-text': '#e0e0e0',
                'dark-text-secondary': '#a0a0a0',
              }
            }
          }
        }
      </script>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
          background-color: #1a1a1a;
          color: #e0e0e0;
        }
        
        ::-webkit-scrollbar {
          width: 10px;
          height: 10px;
        }
        ::-webkit-scrollbar-track {
          background: #1a1a1a;
        }
        ::-webkit-scrollbar-thumb {
          background: #404040;
          border-radius: 5px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: #505050;
        }
        
        .sortable {
          cursor: pointer;
          user-select: none;
        }
        
        .sortable:hover {
          background: rgba(6, 150, 215, 0.1);
        }
        
        .sort-icon {
          display: inline-block;
          margin-left: 4px;
          opacity: 0.3;
        }
        
        .sort-icon.active {
          opacity: 1;
        }
      </style>
    </head>
    <body class="bg-dark-bg">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <!-- Header -->
        <div class="mb-6">
          <h1 class="text-2xl font-bold text-dark-text mb-2">User Resources</h1>
          <p class="text-sm text-dark-text-secondary">All facilities and groups across all regions</p>
        </div>

        <!-- Loading -->
        <div id="loading" class="flex items-center justify-center py-12">
          <div class="flex items-center space-x-3">
            <svg class="animate-spin h-5 w-5 text-tandem-blue" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span class="text-dark-text text-sm">Loading resources...</span>
          </div>
        </div>

        <!-- Content -->
        <div id="content" class="hidden"></div>
      </div>
    </body>
    </html>
  `);
  newWindow.document.close();

  try {
    // Fetch user resources
    const data = await getUserResources('@me');
    
    if (!data) {
      throw new Error('Failed to fetch user resources');
    }

    const { twins = [], groups = [] } = data;

    // Create group URN to name map (groups already include names - no API calls needed!)
    const groupNames = {};
    groups.forEach(group => {
      if (group.urn && group.name) {
        groupNames[group.urn] = group.name;
      }
    });

    // Normalize region names (handle case variations)
    const normalizeRegion = (region) => {
      if (!region) return 'Unknown';
      const upper = region.toUpperCase();
      // Map variations to standard names
      if (upper === 'US' || upper === 'USA') return Region.US;
      if (upper === 'EMEA' || upper === 'EU') return Region.EMEA;
      if (upper === 'AUS' || upper === 'AUSTRALIA') return Region.AUS;
      return upper;
    };

    // Enrich twins with group names and normalize regions (no facility names yet - loaded progressively!)
    const enrichedTwins = twins.map(twin => ({
      ...twin,
      region: normalizeRegion(twin.region),
      facilityName: null, // Will be loaded progressively in background
      facilityNameLoading: false,
      groupName: twin.grantedViaGroup ? groupNames[twin.grantedViaGroup] : null
    }));

    // Group twins by region
    const twinsByRegion = {};
    enrichedTwins.forEach(twin => {
      const region = twin.region;
      if (!twinsByRegion[region]) {
        twinsByRegion[region] = [];
      }
      twinsByRegion[region].push(twin);
    });

    // Sort regions (US, EMEA, AUS, others alphabetically)
    const allRegions = [Region.US, Region.EMEA, Region.AUS];
    const availableRegions = Object.keys(twinsByRegion);
    
    // Debug: Log region distribution
    console.log('Region distribution:', Object.keys(twinsByRegion).map(r => `${r}: ${twinsByRegion[r].length}`).join(', '));

    // Build the content with region filter and interactive sorting
    const contentHTML = buildResourcesHTML(enrichedTwins, twinsByRegion, groups, allRegions, availableRegions);

    // Update the window content
    const loadingDiv = newWindow.document.getElementById('loading');
    const contentDiv = newWindow.document.getElementById('content');
    
    if (loadingDiv && contentDiv) {
      loadingDiv.classList.add('hidden');
      contentDiv.classList.remove('hidden');
      contentDiv.innerHTML = contentHTML;

      // Add sorting and filtering functionality
      addInteractivity(newWindow, enrichedTwins, twinsByRegion, groups, allRegions);
      
      // Add group history button handlers
      addGroupHistoryHandlers(newWindow);
      
      // Start loading facility names progressively in the background
      loadFacilityNamesProgressively(newWindow, enrichedTwins, twinsByRegion);
    }

  } catch (error) {
    console.error('Error displaying user resources:', error);
    
    const loadingDiv = newWindow.document.getElementById('loading');
    const contentDiv = newWindow.document.getElementById('content');
    
    if (loadingDiv && contentDiv) {
      loadingDiv.classList.add('hidden');
      contentDiv.classList.remove('hidden');
      contentDiv.innerHTML = `
        <div class="bg-red-900/30 border border-red-700 rounded p-4">
          <div class="flex items-start space-x-3">
            <svg class="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            <div>
              <h3 class="text-sm font-semibold text-red-500 mb-1">Error Loading Resources</h3>
              <p class="text-xs text-red-200">${error.message}</p>
            </div>
          </div>
        </div>
      `;
    }
  }
}

/**
 * Load facility names progressively in the background
 * This prevents blocking the UI while fetching 90+ facility names
 * 
 * WHY CAN'T WE SHARE THE CACHE WITH THE MAIN WINDOW?
 * The User Resources drill-down opens in a new browser window (window.open), which has
 * a completely separate JavaScript context and memory space. Variables in the main window
 * and popup window don't share memory by design (browser security model).
 * 
 * Could we share via localStorage/sessionStorage/IndexedDB? Technically yes, but:
 * - Adds significant complexity
 * - The drill-down is already fast enough with progressive loading
 * - This is an edge case (most users don't switch between main window and drill-down frequently)
 * 
 * Trade-off decision: Keep it simple rather than over-optimize an uncommon use case.
 */
async function loadFacilityNamesProgressively(newWindow, enrichedTwins, twinsByRegion) {
  console.log(`⏳ Loading facility names for ${enrichedTwins.length} facilities in background...`);
  const startTime = Date.now();
  
  // Larger batch size for faster parallel loading (but not too large to avoid rate limits)
  const batchSize = 20;
  let loadedCount = 0;
  
  for (let i = 0; i < enrichedTwins.length; i += batchSize) {
    const batch = enrichedTwins.slice(i, i + batchSize);
    
    // Fetch names for this batch in parallel
    await Promise.all(
      batch.map(async (twin) => {
        try {
          // Pass the region parameter to ensure correct API endpoint is used
          const info = await getFacilityInfo(twin.urn, twin.region);
          const name = info?.props?.["Identity Data"]?.["Building Name"];
          if (name) {
            twin.facilityName = name;
            loadedCount++;
          }
        } catch (error) {
          console.warn(`Failed to fetch name for ${twin.urn} in ${twin.region}:`, error);
        }
      })
    );
    
    // Update display once per batch (more efficient than per-facility)
    const region = newWindow.appData?.currentRegion;
    if (region && batch.some(t => t.region === region && t.facilityName)) {
      newWindow.renderFacilities(region);
    }
    
    // Small delay between batches to avoid overwhelming the API
    if (i + batchSize < enrichedTwins.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`✅ Loaded ${loadedCount} facility names in ${duration}s`);
  
  // Hide loading status indicator
  const loadingStatus = newWindow.document.getElementById('loading-status');
  if (loadingStatus) {
    loadingStatus.style.display = 'none';
  }
  
  // Final refresh to ensure all names are displayed
  const region = newWindow.appData?.currentRegion;
  if (region) {
    newWindow.renderFacilities(region);
  }
}

/**
 * Build the HTML content for resources
 */
function buildResourcesHTML(enrichedTwins, twinsByRegion, groups, allRegions, availableRegions) {
  const totalFacilities = enrichedTwins.length;
  const totalGroups = groups.length;
  const totalRegions = availableRegions.length;

  let html = '';

  // Summary statistics
  html += `
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      <div class="bg-dark-card rounded border border-dark-border p-4">
        <div class="text-3xl font-bold text-tandem-blue mb-1">${totalFacilities}</div>
        <div class="text-xs text-dark-text-secondary">Total Facilities</div>
      </div>
      <div class="bg-dark-card rounded border border-dark-border p-4">
        <div class="text-3xl font-bold text-tandem-blue mb-1">${totalGroups}</div>
        <div class="text-xs text-dark-text-secondary">Total Groups</div>
      </div>
      <div class="bg-dark-card rounded border border-dark-border p-4">
        <div class="text-3xl font-bold text-tandem-blue mb-1">${totalRegions}</div>
        <div class="text-xs text-dark-text-secondary">Regions</div>
      </div>
    </div>
  `;

  // Loading status indicator
  html += `
    <div id="loading-status" class="mb-4 bg-dark-card rounded border border-dark-border p-3 flex items-center space-x-3">
      <svg class="animate-spin h-4 w-4 text-tandem-blue" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      <span class="text-xs text-dark-text-secondary">Loading facility names in background...</span>
    </div>
  `;

  // Region filter buttons
  html += `
    <div class="mb-6">
      <h2 class="text-lg font-semibold text-dark-text mb-4">Filter by Region</h2>
      <div class="flex flex-wrap gap-2">
  `;

  allRegions.forEach(region => {
    const regionInfo = getRegionInfo(region);
    const hasData = availableRegions.includes(region);
    const isActive = region === Region.US; // Default to US
    html += `
      <button 
        class="region-filter-btn px-4 py-2 rounded text-sm font-medium transition ${
          isActive 
            ? regionInfo.color + ' text-white' 
            : 'bg-dark-card border border-dark-border text-dark-text hover:border-tandem-blue'
        }" 
        data-region="${region}"
        data-has-data="${hasData}">
        <span class="inline-flex items-center">
          <span class="inline-block w-2 h-2 rounded-full mr-2 ${hasData ? 'bg-green-400' : 'bg-gray-600'}"></span>
          ${region}
        </span>
      </button>
    `;
  });

  html += `
      </div>
    </div>
  `;

  // Facilities container (will be populated by JS)
  html += `
    <div id="facilities-container" class="mb-6">
      <!-- Content populated by JavaScript -->
    </div>
  `;

  // Groups section
  if (groups.length > 0) {
    html += `
      <div class="mb-6">
        <h2 class="text-lg font-semibold text-dark-text mb-4">Groups</h2>
        <div class="bg-dark-card rounded border border-dark-border">
          <div class="p-4">
            <div class="overflow-x-auto">
              <table class="min-w-full">
                <thead>
                  <tr class="border-b border-dark-border">
                    <th class="text-left text-xs font-medium text-dark-text-secondary py-2 px-3">Group Name</th>
                    <th class="text-left text-xs font-medium text-dark-text-secondary py-2 px-3">Group URN</th>
                    <th class="text-right text-xs font-medium text-dark-text-secondary py-2 px-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
    `;

    groups.forEach((group, index) => {
      const groupName = group.name || 'Unnamed Group';
      const groupUrn = group.urn || 'N/A';

      html += `
        <tr class="${index > 0 ? 'border-t border-dark-border/50' : ''}">
          <td class="py-2 px-3 text-xs text-dark-text">${groupName}</td>
          <td class="py-2 px-3 text-xs font-mono text-dark-text-secondary">${groupUrn}</td>
          <td class="py-2 px-3 text-right">
            <button 
              class="view-group-history-btn inline-flex items-center px-2 py-1 text-xs font-medium text-tandem-blue hover:text-white hover:bg-tandem-blue border border-tandem-blue rounded transition"
              data-group-urn="${groupUrn}"
              data-group-name="${groupName}">
              <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              History
            </button>
          </td>
        </tr>
      `;
    });

    html += `
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  return html;
}

/**
 * Add interactivity to the window (sorting and filtering)
 */
function addInteractivity(newWindow, enrichedTwins, twinsByRegion, groups, allRegions) {
  // Store data in window for access by event handlers
  newWindow.appData = {
    enrichedTwins,
    twinsByRegion,
    groups,
    allRegions,
    currentRegion: Region.US,
    sortColumn: 'group', // Default sort by group
    sortDirection: 'asc'
  };

  // Store Region constants in window (pass by value since window is different context)
  newWindow.Region = {
    US: Region.US,
    EMEA: Region.EMEA,
    AUS: Region.AUS
  };

  // Helper functions in window context
  newWindow.normalizeRegion = function(region) {
    if (!region) return 'Unknown';
    const upper = region.toUpperCase();
    // Map variations to standard names
    if (upper === 'US' || upper === 'USA') return newWindow.Region.US;
    if (upper === 'EMEA' || upper === 'EU') return newWindow.Region.EMEA;
    if (upper === 'AUS' || upper === 'AUSTRALIA') return newWindow.Region.AUS;
    return upper;
  };

  newWindow.getAccessLevelName = function(accessLevel) {
    // Handle both numeric and string values
    const levels = {
      0: 'None',
      1: 'Read',
      2: 'Manage',
      3: 'Owner',
      '0': 'None',
      '1': 'Read',
      '2': 'Manage',
      '3': 'Owner',
      // Also handle if backend already returns string names
      'None': 'None',
      'Read': 'Read',
      'Manage': 'Manage',
      'Owner': 'Owner'
    };
    return levels[accessLevel] || accessLevel || 'Unknown';
  };

  newWindow.getRegionInfo = function(region) {
    const regionMap = {};
    regionMap[newWindow.Region.US] = { name: 'United States', color: 'bg-blue-600' };
    regionMap[newWindow.Region.EMEA] = { name: 'Europe, Middle East & Africa', color: 'bg-green-600' };
    regionMap[newWindow.Region.AUS] = { name: 'Australia', color: 'bg-orange-600' };
    regionMap['EU'] = { name: 'Europe', color: 'bg-purple-600' };
    return regionMap[region] || { name: region, color: 'bg-gray-600' };
  };

  // Render facilities for a specific region
  newWindow.renderFacilities = function(region) {
    const container = newWindow.document.getElementById('facilities-container');
    const data = newWindow.appData;
    const twins = data.twinsByRegion[region] || [];
    
    // Debug logging
    console.log(`Rendering facilities for region: ${region}`);
    console.log(`Available regions:`, Object.keys(data.twinsByRegion));
    console.log(`Facilities in ${region}:`, twins.length);

    if (twins.length === 0) {
      const regionInfo = newWindow.getRegionInfo(region);
      container.innerHTML = `
        <div class="bg-dark-card rounded border border-dark-border p-8 text-center">
          <svg class="w-12 h-12 text-dark-text-secondary mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"></path>
          </svg>
          <p class="text-sm text-dark-text mb-1">No facilities in ${regionInfo.name}</p>
          <p class="text-xs text-dark-text-secondary">You don't have access to any facilities in the ${region} region.</p>
        </div>
      `;
      return;
    }

    // Sort twins
    const sortedTwins = [...twins].sort((a, b) => {
      let aVal, bVal;
      
      switch (data.sortColumn) {
        case 'facility':
          aVal = (a.facilityName || a.urn).toLowerCase();
          bVal = (b.facilityName || b.urn).toLowerCase();
          break;
        case 'access':
          aVal = a.accessLevel;
          bVal = b.accessLevel;
          break;
        case 'group':
        default:
          aVal = (a.groupName || a.grantedViaGroup || 'Direct access').toLowerCase();
          bVal = (b.groupName || b.grantedViaGroup || 'Direct access').toLowerCase();
          break;
      }

      if (aVal < bVal) return data.sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return data.sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    const regionInfo = newWindow.getRegionInfo(region);
    
    let html = `
      <div>
        <h2 class="text-lg font-semibold text-dark-text mb-4">Facilities in ${regionInfo.name}</h2>
        <div class="bg-dark-card rounded border border-dark-border">
          <div class="px-4 py-3 border-b border-dark-border flex items-center justify-between">
            <div class="flex items-center space-x-3">
              <span class="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium text-white ${regionInfo.color}">
                ${region}
              </span>
              <h3 class="text-sm font-semibold text-dark-text">${regionInfo.name}</h3>
            </div>
            <span class="text-xs text-dark-text-secondary">${twins.length} facilities</span>
          </div>
          <div class="p-4">
            <div class="overflow-x-auto">
              <table class="min-w-full">
                <thead>
                  <tr class="border-b border-dark-border">
                    <th class="sortable text-left text-xs font-medium text-dark-text-secondary py-2 px-3" data-column="facility">
                      Facility Name / URN
                      <span class="sort-icon ${data.sortColumn === 'facility' ? 'active' : ''}">
                        ${data.sortColumn === 'facility' && data.sortDirection === 'asc' ? '▲' : '▼'}
                      </span>
                    </th>
                    <th class="sortable text-left text-xs font-medium text-dark-text-secondary py-2 px-3" data-column="access">
                      Access Level
                      <span class="sort-icon ${data.sortColumn === 'access' ? 'active' : ''}">
                        ${data.sortColumn === 'access' && data.sortDirection === 'asc' ? '▲' : '▼'}
                      </span>
                    </th>
                    <th class="sortable text-left text-xs font-medium text-dark-text-secondary py-2 px-3" data-column="group">
                      Granted Via Group
                      <span class="sort-icon ${data.sortColumn === 'group' ? 'active' : ''}">
                        ${data.sortColumn === 'group' && data.sortDirection === 'asc' ? '▲' : '▼'}
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody>
    `;

    sortedTwins.forEach((twin, index) => {
      const accessLevelName = newWindow.getAccessLevelName(twin.accessLevel);
      const accessLevelColors = {
        'Read': 'text-blue-400',
        'Manage': 'text-green-400',
        'Owner': 'text-yellow-400',
        'None': 'text-gray-400'
      };
      const accessLevelColor = accessLevelColors[accessLevelName] || 'text-gray-400';
      
      const facilityDisplay = twin.facilityName 
        ? `<div class="text-dark-text">${twin.facilityName}</div><div class="text-xs font-mono text-dark-text-secondary mt-0.5">${twin.urn}</div>`
        : `<div class="font-mono text-dark-text">${twin.urn}</div>`;
      
      const groupDisplay = twin.grantedViaGroup
        ? (twin.groupName 
            ? `<div class="text-dark-text">${twin.groupName}</div><div class="text-xs font-mono text-dark-text-secondary mt-0.5">${twin.grantedViaGroup}</div>`
            : `<div class="font-mono text-dark-text">${twin.grantedViaGroup}</div>`)
        : `<div class="italic text-dark-text-secondary">Direct access</div>`;

      html += `
        <tr class="${index > 0 ? 'border-t border-dark-border/50' : ''}">
          <td class="py-2 px-3 text-xs">${facilityDisplay}</td>
          <td class="py-2 px-3 text-xs font-medium ${accessLevelColor}">${accessLevelName}</td>
          <td class="py-2 px-3 text-xs">${groupDisplay}</td>
        </tr>
      `;
    });

    html += `
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    `;

    container.innerHTML = html;

    // Add sort handlers
    const sortHeaders = container.querySelectorAll('.sortable');
    sortHeaders.forEach(header => {
      header.addEventListener('click', function() {
        const column = this.getAttribute('data-column');
        if (data.sortColumn === column) {
          data.sortDirection = data.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
          data.sortColumn = column;
          data.sortDirection = 'asc';
        }
        newWindow.renderFacilities(data.currentRegion);
      });
    });
  };

  // Add region filter handlers
  const regionButtons = newWindow.document.querySelectorAll('.region-filter-btn');
  regionButtons.forEach(btn => {
    btn.addEventListener('click', function() {
      const region = this.getAttribute('data-region');
      const hasData = this.getAttribute('data-has-data') === 'true';
      
      // Update active state
      regionButtons.forEach(b => {
        const r = b.getAttribute('data-region');
        const regionInfo = newWindow.getRegionInfo(r);
        b.className = `region-filter-btn px-4 py-2 rounded text-sm font-medium transition ${
          r === region
            ? regionInfo.color + ' text-white'
            : 'bg-dark-card border border-dark-border text-dark-text hover:border-tandem-blue'
        }`;
      });

      newWindow.appData.currentRegion = region;
      newWindow.renderFacilities(region);
    });
  });

  // Initial render (US region)
  newWindow.renderFacilities(Region.US);
}

/**
 * Add event handlers for group history buttons
 * @param {Window} newWindow - The new window context
 */
function addGroupHistoryHandlers(newWindow) {
  const historyButtons = newWindow.document.querySelectorAll('.view-group-history-btn');
  
  historyButtons.forEach(btn => {
    btn.addEventListener('click', async function() {
      const groupUrn = this.getAttribute('data-group-urn');
      const groupName = this.getAttribute('data-group-name');
      
      // Show loading state
      const originalHTML = this.innerHTML;
      this.disabled = true;
      this.innerHTML = `
        <svg class="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      `;
      
      try {
        // Fetch and display history
        await viewGroupHistoryInline(groupUrn, groupName);
      } catch (error) {
        console.error('Error viewing group history:', error);
        alert('Failed to load group history. See console for details.');
      } finally {
        // Reset button
        this.disabled = false;
        this.innerHTML = originalHTML;
      }
    });
  });
}

/**
 * View group history in a new window
 * @param {string} groupURN - Group URN
 * @param {string} groupName - Group name
 */
async function viewGroupHistoryInline(groupURN, groupName) {
  // Open new window
  const historyWindow = window.open('', '_blank');
  if (!historyWindow) {
    alert('Please allow pop-ups to view group history');
    return;
  }

  // Set up loading page
  historyWindow.document.write(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Group History - ${groupName}</title>
      <script src="https://cdn.tailwindcss.com"></script>
      <script>
        tailwind.config = {
          theme: {
            extend: {
              colors: {
                'tandem-blue': '#0696D7',
                'dark-bg': '#1a1a1a',
                'dark-card': '#2a2a2a',
                'dark-border': '#404040',
                'dark-text': '#e0e0e0',
                'dark-text-secondary': '#a0a0a0',
              }
            }
          }
        }
      </script>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background-color: #1a1a1a;
          color: #e0e0e0;
        }
        ::-webkit-scrollbar { width: 10px; }
        ::-webkit-scrollbar-track { background: #1a1a1a; }
        ::-webkit-scrollbar-thumb { background: #404040; border-radius: 5px; }
      </style>
    </head>
    <body class="bg-dark-bg">
      <div class="max-w-7xl mx-auto px-4 py-6">
        <div class="mb-6">
          <h1 class="text-2xl font-bold text-dark-text mb-2">Group History</h1>
          <p class="text-sm text-dark-text-secondary">${groupName}</p>
          <p class="text-xs text-dark-text-secondary font-mono mt-1">${groupURN}</p>
        </div>
        <div class="flex items-center justify-center py-12">
          <div class="flex items-center space-x-3">
            <svg class="animate-spin h-5 w-5 text-tandem-blue" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span class="text-dark-text text-sm">Loading history...</span>
          </div>
        </div>
      </div>
    </body>
    </html>
  `);
  historyWindow.document.close();

  try {
    // Fetch history
    const now = Date.now();
    const startDate = new Date('2020-01-01T00:00:00Z').getTime();
    
    const history = await getGroupHistory(groupURN, {
      min: startDate,
      max: now,
      includeChanges: true
    });

    // Build history HTML
    let contentHTML = '';
    
    if (!history || history.length === 0) {
      contentHTML = `
        <div class="bg-dark-card rounded border border-dark-border p-8 text-center">
          <svg class="w-12 h-12 text-dark-text-secondary mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          <p class="text-sm text-dark-text-secondary">No access history found for this group</p>
        </div>
      `;
    } else {
      contentHTML = buildGroupHistoryTable(history);
    }

    // Update window with content
    historyWindow.document.body.innerHTML = `
      <div class="max-w-7xl mx-auto px-4 py-6">
        <div class="mb-6">
          <h1 class="text-2xl font-bold text-dark-text mb-2">Group History</h1>
          <p class="text-sm text-dark-text-secondary">${groupName}</p>
          <p class="text-xs text-dark-text-secondary font-mono mt-1">${groupURN}</p>
        </div>
        ${contentHTML}
      </div>
    `;

  } catch (error) {
    console.error('Error loading group history:', error);
    historyWindow.document.body.innerHTML = `
      <div class="max-w-7xl mx-auto px-4 py-6">
        <div class="bg-red-900/30 border border-red-700 rounded p-4">
          <h3 class="text-sm font-semibold text-red-500 mb-1">Error Loading History</h3>
          <p class="text-xs text-red-200">${error.message}</p>
        </div>
      </div>
    `;
  }
}

/**
 * Build history table HTML
 * @param {Array} history - History records
 * @returns {string} HTML string
 */
function buildGroupHistoryTable(history) {
  const sortedHistory = [...history].sort((a, b) => (b[HC.Timestamp] || 0) - (a[HC.Timestamp] || 0));
  
  let html = `
    <div class="bg-dark-card rounded border border-dark-border">
      <div class="px-4 py-3 border-b border-dark-border">
        <h2 class="text-sm font-semibold text-dark-text">Change Log (${sortedHistory.length} events)</h2>
      </div>
      <div class="p-4">
        <div class="overflow-x-auto">
          <table class="min-w-full text-xs">
            <thead>
              <tr class="border-b border-dark-border">
                <th class="text-left py-2 px-3 font-medium text-dark-text-secondary">Timestamp</th>
                <th class="text-left py-2 px-3 font-medium text-dark-text-secondary">User</th>
                <th class="text-left py-2 px-3 font-medium text-dark-text-secondary">Operation</th>
                <th class="text-left py-2 px-3 font-medium text-dark-text-secondary">Details</th>
              </tr>
            </thead>
            <tbody>
  `;

  sortedHistory.forEach((record, index) => {
    const timestamp = record[HC.Timestamp];
    const username = record[HC.Username] || 'Unknown';
    const operation = record[HC.Operation] || 'unknown';
    const detailsStr = record.details || '{}';
    
    let details = {};
    try {
      details = JSON.parse(detailsStr);
    } catch (e) {
      console.warn('Failed to parse details:', detailsStr);
    }
    
    const date = timestamp ? new Date(timestamp).toLocaleString() : 'Unknown';
    const operationDisplay = formatGroupOperation(operation);
    const detailsDisplay = formatHistoryDetails(details, operation);

    html += `
      <tr class="${index > 0 ? 'border-t border-dark-border/50' : ''}">
        <td class="py-2 px-3 text-dark-text-secondary whitespace-nowrap">${date}</td>
        <td class="py-2 px-3 text-dark-text whitespace-nowrap">${username}</td>
        <td class="py-2 px-3 whitespace-nowrap">
          <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getHistoryOperationColor(operation)}">
            ${operationDisplay}
          </span>
        </td>
        <td class="py-2 px-3 text-dark-text-secondary">${detailsDisplay}</td>
      </tr>
    `;
  });

  html += `
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  return html;
}

/**
 * Format operation for display
 */
function formatGroupOperation(operation) {
  const operationNames = {
    'acl_update_group': 'Access Updated',
    'acl_delete_group': 'Access Removed',
    'acl_create_group': 'Access Granted',
    'create_group': 'Group Created',
    'delete_group': 'Group Deleted',
    'update_group': 'Group Updated'
  };
  return operationNames[operation] || operation;
}

/**
 * Get operation color
 */
function getHistoryOperationColor(operation) {
  if (operation.includes('create') || operation.includes('grant')) return 'bg-green-600 text-white';
  if (operation.includes('delete') || operation.includes('remove')) return 'bg-red-600 text-white';
  if (operation.includes('update')) return 'bg-blue-600 text-white';
  return 'bg-gray-600 text-white';
}

/**
 * Format history details
 */
function formatHistoryDetails(details, operation) {
  if (!details || Object.keys(details).length === 0) return '<span class="italic">No details</span>';

  if (operation.includes('acl')) {
    const level = details.level || '';
    const name = details.name || '';
    
    if (level && name) {
      const levelColorMap = {
        'Owner': '#fbbf24',
        'Manage': '#4ade80',
        'ReadWrite': '#c084fc',
        'Read': '#60a5fa',
        'None': '#9ca3af'
      };
      const color = levelColorMap[level] || '#e0e0e0';
      
      return `<span style="color: ${color}; font-weight: 500;">${level}</span> → ${name}`;
    }
    if (level) return `Level: ${level}`;
    if (name) return `User: ${name}`;
  }

  return `<code class="text-xs">${JSON.stringify(details)}</code>`;
}
