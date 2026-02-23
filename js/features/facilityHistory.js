import { getTwinHistory } from '../api.js';
import { HC } from '../../tandem/constants.js';

/**
 * View facility ACL history in a new window
 * @param {string} facilityURN - Facility URN
 * @param {string} region - Region identifier
 * @param {string} facilityName - Facility name for display
 */
export async function viewFacilityHistory(facilityURN, region, facilityName = 'Facility') {
  // Open new window
  const newWindow = window.open('', '_blank');
  if (!newWindow) {
    alert('Please allow pop-ups to view facility history');
    return;
  }

  // Set up the window with loading state
  newWindow.document.write(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Facility History - ${facilityName}</title>
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
        }
        ::-webkit-scrollbar-track {
          background: #1a1a1a;
        }
        ::-webkit-scrollbar-thumb {
          background: #404040;
          border-radius: 5px;
        }
        
        .sortable-header {
          cursor: pointer;
          user-select: none;
          transition: color 0.2s;
        }
        .sortable-header:hover {
          color: #0696D7;
        }
      </style>
    </head>
    <body class="bg-dark-bg">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div class="mb-6">
          <h1 class="text-2xl font-bold text-dark-text mb-2">Facility History</h1>
          <p class="text-sm text-dark-text-secondary">${facilityName}</p>
          <p class="text-xs text-dark-text-secondary font-mono mt-1">${facilityURN}</p>
        </div>

        <div id="loading" class="flex items-center justify-center py-12">
          <div class="flex items-center space-x-3">
            <svg class="animate-spin h-5 w-5 text-tandem-blue" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span class="text-dark-text text-sm">Loading history...</span>
          </div>
        </div>

        <div id="content" class="hidden"></div>
      </div>
    </body>
    </html>
  `);
  newWindow.document.close();

  try {
    // Fetch history from January 1, 2020
    const now = Date.now();
    const startDate = new Date('2020-01-01T00:00:00Z').getTime();
    
    const history = await getTwinHistory(facilityURN, region, {
      min: startDate,
      max: now,
      includeChanges: true
    });

    // Hide loading, show content
    const loadingDiv = newWindow.document.getElementById('loading');
    const contentDiv = newWindow.document.getElementById('content');
    
    if (loadingDiv && contentDiv) {
      loadingDiv.classList.add('hidden');
      contentDiv.classList.remove('hidden');
      
      if (!history || history.length === 0) {
        contentDiv.innerHTML = `
          <div class="bg-dark-card rounded border border-dark-border p-8 text-center">
            <svg class="w-12 h-12 text-dark-text-secondary mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            <p class="text-sm text-dark-text-secondary">No access history found for this facility</p>
          </div>
        `;
      } else {
        const { html, historyData } = buildHistoryHTML(history);
        contentDiv.innerHTML = html;
        setupSorting(newWindow, historyData);
      }
    }

  } catch (error) {
    console.error('Error displaying facility history:', error);
    
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
              <h3 class="text-sm font-semibold text-red-500 mb-1">Error Loading History</h3>
              <p class="text-xs text-red-200">${error.message}</p>
            </div>
          </div>
        </div>
      `;
    }
  }
}

/**
 * Build HTML for history display
 * @param {Array} history - Array of history records
 * @returns {Object} Object with html string and processed history data
 */
function buildHistoryHTML(history) {
  // Sort by timestamp (newest first) - this is the default
  const sortedHistory = [...history].sort((a, b) => (b[HC.Timestamp] || 0) - (a[HC.Timestamp] || 0));
  
  // Process history records into display-friendly format
  const processedHistory = sortedHistory.map(record => {
    const timestamp = record[HC.Timestamp];
    const rawUsername = record[HC.Username] || '';
    const clientId = record[HC.ClientID] || '';
    const operation = record[HC.Operation] || 'unknown';
    const description = record[HC.Description] || '';
    const detailsStr = record.details || '{}';

    let details = {};
    try {
      details = JSON.parse(detailsStr);
    } catch (e) {
      // details may already be an object when the server embeds it inline
      if (record.details && typeof record.details === 'object') {
        details = record.details;
      }
    }

    return {
      timestamp,
      username: rawUsername,
      clientId,
      operation,
      description,
      details,
      date: timestamp ? new Date(timestamp).toLocaleString() : 'Unknown',
      usernameDisplay: formatUsername(rawUsername, clientId),
      operationDisplay: formatOperation(operation),
      operationColor: getOperationColor(operation),
      detailsDisplay: formatDetails(details, description, operation)
    };
  });
  
  // Group by operation type for stats
  const operations = {};
  sortedHistory.forEach(record => {
    const op = record[HC.Operation] || 'unknown';
    if (!operations[op]) {
      operations[op] = [];
    }
    operations[op].push(record);
  });

  let html = `
    <div class="mb-6">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div class="bg-dark-card rounded border border-dark-border p-4">
          <div class="text-3xl font-bold text-tandem-blue mb-1">${sortedHistory.length}</div>
          <div class="text-xs text-dark-text-secondary">Total Changes</div>
        </div>
        <div class="bg-dark-card rounded border border-dark-border p-4">
          <div class="text-3xl font-bold text-tandem-blue mb-1">${Object.keys(operations).length}</div>
          <div class="text-xs text-dark-text-secondary">Operation Types</div>
        </div>
        <div class="bg-dark-card rounded border border-dark-border p-4">
          <div class="text-3xl font-bold text-tandem-blue mb-1">${getUniqueUserCount(sortedHistory)}</div>
          <div class="text-xs text-dark-text-secondary">Unique Users</div>
        </div>
      </div>
    </div>

    <div class="bg-dark-card rounded border border-dark-border">
      <div class="px-4 py-3 border-b border-dark-border">
        <h2 class="text-sm font-semibold text-dark-text">Change Log</h2>
      </div>
      <div class="p-4">
        <div class="overflow-x-auto">
          <table class="min-w-full text-xs">
            <thead>
              <tr class="border-b border-dark-border">
                <th class="sortable-header text-left py-2 px-3 font-medium text-dark-text-secondary" data-column="timestamp">
                  Timestamp <span class="sort-indicator">▼</span>
                </th>
                <th class="sortable-header text-left py-2 px-3 font-medium text-dark-text-secondary" data-column="username">
                  User <span class="sort-indicator"></span>
                </th>
                <th class="sortable-header text-left py-2 px-3 font-medium text-dark-text-secondary" data-column="operation">
                  Operation <span class="sort-indicator"></span>
                </th>
                <th class="text-left py-2 px-3 font-medium text-dark-text-secondary">
                  Details
                </th>
              </tr>
            </thead>
            <tbody id="historyTableBody">
  `;

  processedHistory.forEach((record, index) => {
    html += `
      <tr class="${index > 0 ? 'border-t border-dark-border/50' : ''}">
        <td class="py-2 px-3 text-dark-text-secondary whitespace-nowrap">${record.date}</td>
        <td class="py-2 px-3 whitespace-nowrap">${record.usernameDisplay}</td>
        <td class="py-2 px-3 whitespace-nowrap">
          <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${record.operationColor}">
            ${record.operationDisplay}
          </span>
        </td>
        <td class="py-2 px-3 text-dark-text-secondary">${record.detailsDisplay}</td>
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

  return { html, historyData: processedHistory };
}

/**
 * Get unique user count from history
 * @param {Array} history - History records
 * @returns {number} Count of unique users
 */
function getUniqueUserCount(history) {
  const users = new Set();
  history.forEach(record => {
    const username = record[HC.Username];
    if (username) {
      users.add(username);
    }
  });
  return users.size;
}

/**
 * Escape HTML special characters to prevent XSS
 * @param {string} str - Raw string
 * @returns {string} Escaped string
 */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Format username for display, substituting "System" for automated entries
 * @param {string} username - Raw username (may be empty for system operations)
 * @param {string} clientId - Client ID of the actor
 * @returns {string} HTML string for the user cell
 */
function formatUsername(username, clientId) {
  if (username) {
    return `<span class="text-dark-text">${escapeHtml(username)}</span>`;
  }
  // Automated server operation — no human actor
  const tooltip = clientId ? ` title="Client: ${escapeHtml(clientId)}"` : '';
  return `<span class="italic text-dark-text-secondary/60"${tooltip}>System</span>`;
}

/**
 * Format operation name for display
 * @param {string} operation - Operation code from server
 * @returns {string} Human-readable operation name
 */
function formatOperation(operation) {
  const operationNames = {
    // ACL / access control
    'acl_update_twin':  'Access Updated',
    'acl_update_group': 'Group Access Updated',
    'acl_delete_twin':  'Access Removed',
    'acl_create_twin':  'Access Granted',
    // Facility lifecycle
    'create_twin':          'Facility Created',
    'delete_twin':          'Facility Deleted',
    'update_twin':          'Facility Updated',
    'move_twin':            'Facility Moved',
    'update_twin_settings': 'Settings Updated',
    'account_merged_in':    'Account Merged',
    'update_group_twins':   'Account Facilities Updated',
    // Element data
    'mutate':                  'Property Changed',
    'bulk_import':             'Bulk Import',
    'bulk_update':             'Bulk Update',
    'bulk_fail':               'Bulk Import Failed',
    'apply_pset':              'Parameter Set Applied',
    'delete_pset':             'Parameter Set Deleted',
    'update_classification':   'Classification Updated',
    'state_change':            'State Changed',
    // Templates
    'apply_template':  'Template Applied',
    'remove_template': 'Template Removed',
    // Documents
    'add_document':    'Document Added',
    'delete_document': 'Document Deleted',
    'update_document': 'Document Updated',
    // Views & systems
    'update_view':              'View Updated',
    'update_systems':           'Systems Updated',
    'update_system_connections':'System Connections Updated',
    // Streams / IoT
    'delete_stream_data':   'Stream Data Deleted',
    'update_iot':           'IoT Updated',
    'stream_alert':         'Stream Alert',
    'stream_connectivity':  'Stream Connectivity',
    // System
    'metrics_update': 'Metrics Update',
    'db_maintenance': 'Maintenance',
  };
  return operationNames[operation] || operation;
}

/**
 * Get badge color class for an operation type
 * @param {string} operation - Operation code
 * @returns {string} Tailwind color classes
 */
function getOperationColor(operation) {
  const colorMap = {
    // Green — creations / additions
    'acl_create_twin': 'bg-green-600 text-white',
    'create_twin':     'bg-green-600 text-white',
    'add_document':    'bg-green-600 text-white',
    'bulk_import':     'bg-green-700 text-white',
    'apply_template':  'bg-green-700 text-white',
    'apply_pset':      'bg-green-700 text-white',
    // Red — deletions / failures
    'acl_delete_twin':    'bg-red-600 text-white',
    'delete_twin':        'bg-red-600 text-white',
    'delete_document':    'bg-red-600 text-white',
    'delete_pset':        'bg-red-600 text-white',
    'delete_stream_data': 'bg-red-600 text-white',
    'remove_template':    'bg-red-600 text-white',
    'bulk_fail':          'bg-red-600 text-white',
    // Purple — account / facility moves
    'move_twin':            'bg-purple-600 text-white',
    'update_group_twins':   'bg-purple-600 text-white',
    'account_merged_in':    'bg-purple-600 text-white',
    // Gray — automated / system operations
    'metrics_update':     'bg-gray-500 text-white',
    'db_maintenance':     'bg-gray-500 text-white',
    'stream_alert':       'bg-gray-500 text-white',
    'stream_connectivity':'bg-gray-500 text-white',
    'update_iot':         'bg-gray-500 text-white',
  };
  if (colorMap[operation]) return colorMap[operation];
  if (operation.includes('delete') || operation.includes('remove') || operation.includes('fail')) {
    return 'bg-red-600 text-white';
  }
  if (operation.includes('create') || operation.includes('add') || operation.includes('import')) {
    return 'bg-green-600 text-white';
  }
  if (operation.includes('update') || operation.includes('mutate') || operation.includes('apply') || operation.includes('change')) {
    return 'bg-blue-600 text-white';
  }
  return 'bg-gray-600 text-white';
}

/**
 * Format details for display in the table.
 * Priority: ACL formatting → move_twin account summary → description text → raw details JSON → dash.
 * @param {Object} details - Parsed details object (may be empty)
 * @param {string} description - Change description from the 'd' field
 * @param {string} operation - Operation type
 * @returns {string} HTML string
 */
function formatDetails(details, description, operation) {
  const hasDetails = details && Object.keys(details).length > 0;

  // ACL operations — show access level and grantee name
  if (operation.includes('acl')) {
    const level = details.level || '';
    const name = details.name || '';
    if (level && name) {
      const levelColorMap = {
        'Owner':     '#fbbf24',
        'Manage':    '#4ade80',
        'ReadWrite': '#c084fc',
        'Read':      '#60a5fa',
        'None':      '#9ca3af'
      };
      const color = levelColorMap[level] || '#e0e0e0';
      return `<span style="color:${color};font-weight:500">${escapeHtml(level)}</span> → ${escapeHtml(name)}`;
    }
    if (level) return `Level: ${escapeHtml(level)}`;
    if (name)  return `User: ${escapeHtml(name)}`;
  }

  // move_twin — extract human-readable from/to account names
  if (operation === 'move_twin' && hasDetails) {
    const twinName  = details.twin?.name  || '';
    const srcName   = details.sourceAccount?.name  || '';
    const destName  = details.destinationAccount?.name || '';
    if (srcName && destName) {
      const label = twinName ? `<span class="text-dark-text font-medium">${escapeHtml(twinName)}</span> ` : '';
      return `${label}${escapeHtml(srcName)} → ${escapeHtml(destName)}`;
    }
  }

  // Description text (the 'd' field) when there are no details to show
  if (!hasDetails && description) {
    return `<span>${escapeHtml(description)}</span>`;
  }

  // Generic details JSON
  if (hasDetails) {
    // If description is also present, prepend it
    const prefix = description
      ? `<span class="text-dark-text">${escapeHtml(description)}</span> `
      : '';
    return `${prefix}<code class="text-xs break-all">${escapeHtml(JSON.stringify(details))}</code>`;
  }

  return '<span class="text-dark-text-secondary/40">—</span>';
}

/**
 * Setup sorting functionality in the new window
 * @param {Window} newWindow - The new window reference
 * @param {Array} historyData - Processed history data
 */
function setupSorting(newWindow, historyData) {
  let sortColumn = 'timestamp';
  let sortDirection = 'desc'; // Start with newest first
  
  // Get references to elements in the new window
  const headers = newWindow.document.querySelectorAll('.sortable-header');
  const tbody = newWindow.document.getElementById('historyTableBody');
  
  if (!tbody) return;
  
  /**
   * Sort the data and update the table
   */
  function sortAndRender() {
    // Sort the data
    const sorted = [...historyData].sort((a, b) => {
      let aVal, bVal;
      
      switch (sortColumn) {
        case 'timestamp':
          aVal = a.timestamp || 0;
          bVal = b.timestamp || 0;
          break;
        case 'username':
          aVal = (a.username || a.clientId || 'zzz').toLowerCase();
          bVal = (b.username || b.clientId || 'zzz').toLowerCase();
          break;
        case 'operation':
          aVal = (a.operationDisplay || '').toLowerCase();
          bVal = (b.operationDisplay || '').toLowerCase();
          break;
        default:
          return 0;
      }
      
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    
    // Update the table body
    tbody.innerHTML = sorted.map((record, index) => `
      <tr class="${index > 0 ? 'border-t border-dark-border/50' : ''}">
        <td class="py-2 px-3 text-dark-text-secondary whitespace-nowrap">${record.date}</td>
        <td class="py-2 px-3 whitespace-nowrap">${record.usernameDisplay}</td>
        <td class="py-2 px-3 whitespace-nowrap">
          <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${record.operationColor}">
            ${record.operationDisplay}
          </span>
        </td>
        <td class="py-2 px-3 text-dark-text-secondary">${record.detailsDisplay}</td>
      </tr>
    `).join('');
    
    // Update sort indicators
    headers.forEach(header => {
      const indicator = header.querySelector('.sort-indicator');
      if (!indicator) return;
      
      const column = header.dataset.column;
      if (column === sortColumn) {
        indicator.textContent = sortDirection === 'asc' ? '▲' : '▼';
        header.style.color = '#0696D7';
      } else {
        indicator.textContent = '';
        header.style.color = '';
      }
    });
  }
  
  // Add click handlers to sortable headers
  headers.forEach(header => {
    header.addEventListener('click', () => {
      const column = header.dataset.column;
      
      if (sortColumn === column) {
        // Toggle direction if same column
        sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
      } else {
        // New column - start with descending for timestamp, ascending for others
        sortColumn = column;
        sortDirection = column === 'timestamp' ? 'desc' : 'asc';
      }
      
      sortAndRender();
    });
  });
}

