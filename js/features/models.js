import { getElementCount, getHistory, getModelProperties } from '../api.js';
import { isDefaultModel } from '../utils.js';
import { createToggleFunction } from '../components/toggleHeader.js';

/**
 * Toggle models detail view
 */
const toggleModelsDetail = createToggleFunction({
  detailId: 'models-detail',
  summaryId: 'models-summary',
  toggleBtnId: 'toggle-models-btn',
  iconDownId: 'toggle-icon-down',
  iconUpId: 'toggle-icon-up'
});

/**
 * Display models list with details
 * @param {HTMLElement} container - DOM element to render into
 * @param {Array} models - Array of model objects
 * @param {string} facilityURN - Facility URN for determining default model
 */
export async function displayModels(container, models, facilityURN) {
  if (!models || models.length === 0) {
    container.innerHTML = '<p class="text-dark-text-secondary">No models found in this facility.</p>';
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
      <div class="flex items-center gap-2">
        <button id="view-history-btn"
                class="inline-flex items-center px-3 py-2 border border-tandem-blue text-xs font-medium rounded text-tandem-blue hover:bg-tandem-blue hover:text-white transition"
                title="View change history for all models">
          <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          View History
        </button>
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
                <h3 class="text-base font-semibold text-dark-text">${model.label || (isDefault ? '** Default Model **' : 'Untitled Model')}</h3>
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
        
        <div class="space-y-2 text-sm">
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
          ${!isDefault ? `
          <div id="detail-phase-${i}">
            <span class="font-medium text-dark-text">Phase:</span>
            <span class="text-dark-text-secondary ml-2"><span class="inline-block animate-pulse">...</span></span>
          </div>
          <div id="detail-last-updated-${i}">
            <span class="font-medium text-dark-text">Last Updated:</span>
            <span class="text-dark-text-secondary ml-2"><span class="inline-block animate-pulse">...</span></span>
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
  container.innerHTML = headerHtml + summaryHtml + detailHtml;
  
  // Bind toggle button event listener
  const toggleBtn = document.getElementById('toggle-models-btn');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', toggleModelsDetail);
  }

  // Bind view history button event listener
  const viewHistoryBtn = document.getElementById('view-history-btn');
  if (viewHistoryBtn) {
    viewHistoryBtn.addEventListener('click', () => {
      viewModelsHistory(facilityURN, models, viewHistoryBtn);
    });
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
  
  // Fetch model properties asynchronously for each model (skip default models)
  for (let i = 0; i < models.length; i++) {
    const model = models[i];
    const isDefault = isDefaultModel(facilityURN, model.modelId);
    
    // Skip fetching properties for default model
    if (isDefault) {
      continue;
    }
    
    getModelProperties(model.modelId).then(props => {
      // Extract data from dataSource object
      const data = props?.dataSource;
      
      // Update Phase/View
      const phaseElement = document.getElementById(`detail-phase-${i}`);
      if (phaseElement && data?.phaseOrViewName) {
        const phaseOrView = data.phaseOrViewName;
        let label = 'Phase';
        let displayValue = phaseOrView;
        
        // Determine label and value based on prefix
        if (phaseOrView.startsWith('phase:')) {
          label = 'Phase';
          displayValue = phaseOrView.substring(6);
        } else if (phaseOrView.startsWith('view:')) {
          label = 'View';
          displayValue = phaseOrView.substring(5);
        }
        
        phaseElement.innerHTML = `
          <span class="font-medium text-dark-text">${label}:</span>
          <span class="text-dark-text-secondary ml-2">${displayValue}</span>
        `;
      } else if (phaseElement) {
        phaseElement.innerHTML = `
          <span class="font-medium text-dark-text">Phase:</span>
          <span class="text-dark-text-secondary ml-2">-</span>
        `;
      }
      
      // Update Last Updated
      const lastUpdatedElement = document.getElementById(`detail-last-updated-${i}`);
      if (lastUpdatedElement && data?.lastUpdated) {
        const date = new Date(data.lastUpdated);
        const formattedDate = date.toLocaleString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        });
        lastUpdatedElement.innerHTML = `
          <span class="font-medium text-dark-text">Last Updated:</span>
          <span class="text-dark-text-secondary ml-2">${formattedDate}</span>
        `;
      } else if (lastUpdatedElement) {
        lastUpdatedElement.innerHTML = `
          <span class="font-medium text-dark-text">Last Updated:</span>
          <span class="text-dark-text-secondary ml-2">-</span>
        `;
      }
    }).catch(error => {
      console.error(`Error getting model properties for ${model.label}:`, error);
      // Update with error state
      const phaseElement = document.getElementById(`detail-phase-${i}`);
      if (phaseElement) {
        phaseElement.innerHTML = `
          <span class="font-medium text-dark-text">Phase:</span>
          <span class="text-dark-text-secondary ml-2">-</span>
        `;
      }
      const lastUpdatedElement = document.getElementById(`detail-last-updated-${i}`);
      if (lastUpdatedElement) {
        lastUpdatedElement.innerHTML = `
          <span class="font-medium text-dark-text">Last Updated:</span>
          <span class="text-dark-text-secondary ml-2">-</span>
        `;
      }
    });
  }
}

/**
 * Generate HTML page for model history
 * @param {Array} allHistory - Array of {modelName, modelId, history} objects
 * @param {string} facilityURN - Facility URN
 * @returns {string} HTML page content
 */
function generateHistoryHTML(allHistory, facilityURN) {
  // Embed all history data as JSON for client-side filtering
  const allHistoryJSON = JSON.stringify(allHistory).replace(/</g, '\\u003c').replace(/>/g, '\\u003e');
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Model History</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background-color: #1a1a1a;
      color: #e0e0e0;
      padding: 20px;
    }
    .container {
      max-width: 1800px;
      margin: 0 auto;
    }
    .header {
      background: #2a2a2a;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 20px;
      border: 1px solid #404040;
    }
    .header-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 15px;
    }
    h1 {
      margin: 0 0 10px 0;
      color: #0696D7;
      font-size: 24px;
      font-weight: 600;
    }
    .time-range-controls {
      display: flex;
      gap: 8px;
      background: #1a1a1a;
      padding: 4px;
      border-radius: 6px;
      border: 1px solid #404040;
    }
    .time-range-btn {
      background: transparent;
      border: none;
      color: #a0a0a0;
      padding: 8px 16px;
      border-radius: 4px;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
      white-space: nowrap;
    }
    .time-range-btn:hover {
      background: #2a2a2a;
      color: #e0e0e0;
    }
    .time-range-btn.active {
      background: #0696D7;
      color: white;
    }
    .info {
      font-size: 12px;
      color: #a0a0a0;
      font-family: monospace;
      margin-bottom: 5px;
    }
    .stats {
      display: flex;
      gap: 30px;
      margin-top: 15px;
    }
    .stat-item {
      display: flex;
      flex-direction: column;
    }
    .stat-label {
      font-size: 11px;
      color: #808080;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .stat-value {
      font-size: 24px;
      font-weight: 600;
      color: #0696D7;
    }
    .model-section {
      background: #2a2a2a;
      border-radius: 8px;
      border: 1px solid #404040;
      overflow: hidden;
      margin-bottom: 20px;
    }
    .model-header {
      background: #333333;
      padding: 12px 20px;
      border-bottom: 1px solid #404040;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .model-name {
      font-size: 16px;
      font-weight: 600;
      color: #0696D7;
    }
    .model-change-count {
      font-size: 12px;
      color: #a0a0a0;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    thead {
      background: #333333;
    }
    th {
      padding: 12px 16px;
      text-align: left;
      font-size: 11px;
      font-weight: 600;
      color: #a0a0a0;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      border-bottom: 1px solid #404040;
      position: relative;
      cursor: pointer;
      user-select: none;
    }
    th.sortable:hover {
      background: #3a3a3a;
      color: #0696D7;
    }
    .sort-icon {
      margin-left: 4px;
      color: #808080;
    }
    th.sorted-asc .sort-icon::after,
    th.sorted-desc .sort-icon::after {
      color: #0696D7;
    }
    th.sorted-asc .sort-icon::after {
      content: ' ↑';
    }
    th.sorted-desc .sort-icon::after {
      content: ' ↓';
    }
    td {
      padding: 12px 16px;
      font-size: 13px;
    }
    tr:last-child {
      border-bottom: none;
    }
    .truncate {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .max-w-xs {
      max-width: 300px;
    }
    .max-w-md {
      max-width: 400px;
    }
    .empty-state {
      padding: 40px 20px;
      text-align: center;
      color: #808080;
      font-size: 14px;
    }
    
    /* Modal styles */
    .modal-overlay {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.8);
      z-index: 1000;
      justify-content: center;
      align-items: center;
    }
    
    .modal-overlay.active {
      display: flex;
    }
    
    .modal-content {
      background: #2a2a2a;
      border: 1px solid #404040;
      border-radius: 8px;
      max-width: 800px;
      max-height: 80vh;
      width: 90%;
      display: flex;
      flex-direction: column;
    }
    
    .modal-header {
      padding: 20px;
      border-bottom: 1px solid #404040;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    .modal-header h2 {
      margin: 0;
      color: #0696D7;
      font-size: 18px;
      font-weight: 600;
    }
    
    .modal-header-actions {
      display: flex;
      gap: 8px;
      align-items: center;
    }
    
    .copy-all-btn {
      background: #0696D7;
      border: none;
      color: white;
      padding: 6px 12px;
      border-radius: 4px;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.2s;
    }
    
    .copy-all-btn:hover {
      background: #057ab5;
    }
    
    .copy-all-btn.copied {
      background: #10b981;
    }
    
    .modal-close {
      background: none;
      border: none;
      color: #a0a0a0;
      font-size: 24px;
      cursor: pointer;
      padding: 0;
      width: 30px;
      height: 30px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 4px;
      transition: all 0.2s;
    }
    
    .modal-close:hover {
      background: #404040;
      color: #e0e0e0;
    }
    
    .modal-body {
      padding: 20px;
      overflow-y: auto;
      flex: 1;
    }
    
    .element-key {
      font-family: 'Courier New', monospace;
      font-size: 12px;
      padding: 8px 12px;
      background: #1a1a1a;
      border: 1px solid #404040;
      border-radius: 4px;
      margin-bottom: 8px;
      color: #e0e0e0;
      word-break: break-all;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    .element-key-text {
      flex: 1;
      margin-right: 10px;
    }
    
    .copy-btn {
      background: #0696D7;
      border: none;
      color: white;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 11px;
      cursor: pointer;
      white-space: nowrap;
      transition: background 0.2s;
    }
    
    .copy-btn:hover {
      background: #057ab5;
    }
    
    .copy-btn.copied {
      background: #10b981;
    }
    
    .element-count-btn {
      background: none;
      border: none;
      padding: 0;
      font-size: inherit;
      font-family: inherit;
      color: #0696D7;
      font-weight: 600;
    }
    
    .element-count-btn:hover {
      color: #057ab5;
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="header-row">
        <div>
          <h1>Model Change History</h1>
          <div class="info">Facility: ${facilityURN}</div>
        </div>
        <div class="time-range-controls">
          <button class="time-range-btn active" data-range="7days">7 Days</button>
          <button class="time-range-btn" data-range="30days">30 Days</button>
          <button class="time-range-btn" data-range="all">All Time</button>
        </div>
      </div>
      <div class="stats">
        <div class="stat-item">
          <span class="stat-label">Total Models</span>
          <span class="stat-value" id="stat-models">0</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Total Changes</span>
          <span class="stat-value" id="stat-changes">0</span>
        </div>
      </div>
    </div>
    
    <div id="tables-container"></div>
  </div>
  
  <!-- Element Keys Modal -->
  <div class="modal-overlay" id="element-modal">
    <div class="modal-content">
      <div class="modal-header">
        <h2>Element Keys</h2>
        <div class="modal-header-actions">
          <button class="copy-all-btn" id="copy-all-btn">Copy All</button>
          <button class="modal-close" id="modal-close">&times;</button>
        </div>
      </div>
      <div class="modal-body">
        <div id="element-keys-list"></div>
      </div>
    </div>
  </div>
  
  <script>
    // All history data embedded from server
    const ALL_HISTORY_DATA = ${allHistoryJSON};
    let currentTimeRange = '7days';
    
    // Filter and render history based on time range
    function filterAndRender(timeRange) {
      currentTimeRange = timeRange;
      const now = Date.now();
      let minTime;
      
      if (timeRange === '7days') {
        minTime = now - (7 * 24 * 60 * 60 * 1000);
      } else if (timeRange === '30days') {
        minTime = now - (30 * 24 * 60 * 60 * 1000);
      } else {
        minTime = 0; // All time
      }
      
      // Filter history for each model (handle both 'ts' and 't' timestamp fields)
      const filteredHistory = ALL_HISTORY_DATA.map(model => ({
        modelName: model.modelName,
        modelId: model.modelId,
        history: model.history.filter(entry => {
          const timestamp = entry.ts || entry.t || 0;
          return timestamp >= minTime;
        })
      }));
      
      // Render tables
      renderTables(filteredHistory);
      
      // Update active button
      document.querySelectorAll('.time-range-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.range === timeRange);
      });
    }
    
    // Render tables for filtered history
    function renderTables(filteredHistory) {
      const container = document.getElementById('tables-container');
      const modelsWithHistory = filteredHistory.filter(item => item.history && item.history.length > 0);
      const totalChanges = filteredHistory.reduce((sum, item) => sum + item.history.length, 0);
      
      // Update stats
      document.getElementById('stat-models').textContent = modelsWithHistory.length;
      document.getElementById('stat-changes').textContent = totalChanges;
      
      if (modelsWithHistory.length === 0) {
        container.innerHTML = '<div class="empty-state">No changes found in the selected time range</div>';
        return;
      }
      
      let tablesHtml = '';
      
      for (const item of modelsWithHistory) {
        let tableRows = '';
        
        for (let i = 0; i < item.history.length; i++) {
          const entry = item.history[i];
          const timestamp = new Date(entry.ts || entry.t);
          const timestampValue = timestamp.getTime();
          const timeStr = timestamp.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
          });
          
          const operation = entry.o || 'mutate';
          let changeClass = 'bg-blue-500/20 text-blue-300';
          if (operation === 'create') {
            changeClass = 'bg-green-500/20 text-green-300';
          } else if (operation === 'delete') {
            changeClass = 'bg-red-500/20 text-red-300';
          } else if (operation === 'mutate') {
            changeClass = 'bg-blue-500/20 text-blue-300';
          }
          
          const elementCount = entry.k ? entry.k.length : 0;
          const elementKeys = entry.k ? JSON.stringify(entry.k) : '[]';
          const description = entry.d || '-';
          const author = entry.n || '-';
          
          let detailsStr = '-';
          if (entry.details) {
            try {
              const details = typeof entry.details === 'string' ? JSON.parse(entry.details) : entry.details;
              if (details.attributes && Array.isArray(details.attributes)) {
                detailsStr = details.attributes.join(', ');
              } else {
                detailsStr = entry.details;
              }
            } catch (e) {
              detailsStr = entry.details;
            }
          }
          
          tableRows += \`
            <tr class="border-b border-dark-border hover:bg-dark-bg/30 transition" 
                data-timestamp="\${timestampValue}"
                data-operation="\${operation}"
                data-elements="\${elementCount}"
                data-author="\${author}"
                data-description="\${description}"
                data-element-keys='\${elementKeys}'>
              <td class="px-4 py-3 text-sm text-dark-text-secondary">\${i + 1}</td>
              <td class="px-4 py-3 text-sm text-dark-text-secondary">\${timeStr}</td>
              <td class="px-4 py-3">
                <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium \${changeClass}">
                  \${operation}
                </span>
              </td>
              <td class="px-4 py-3 text-sm text-dark-text text-center">
                \${elementCount > 0 ? \`<button class="element-count-btn" title="Click to view element keys">\${elementCount}</button>\` : elementCount}
              </td>
              <td class="px-4 py-3 text-sm text-dark-text">\${author}</td>
              <td class="px-4 py-3 text-sm text-dark-text-secondary truncate max-w-md" title="\${description}">\${description}</td>
              <td class="px-4 py-3 text-xs text-dark-text-secondary truncate max-w-xs" title="\${detailsStr}">\${detailsStr}</td>
            </tr>
          \`;
        }
        
        tablesHtml += \`
          <div class="model-section">
            <div class="model-header">
              <span class="model-name">\${item.modelName}</span>
              <span class="model-change-count">\${item.history.length} change\${item.history.length !== 1 ? 's' : ''}</span>
            </div>
            <table>
              <thead>
                <tr>
                  <th style="width: 60px;">#</th>
                  <th class="sortable" data-sort="timestamp" style="width: 230px;">
                    Timestamp
                    <span class="sort-icon">⇅</span>
                  </th>
                  <th class="sortable" data-sort="operation" style="width: 100px;">
                    Operation
                    <span class="sort-icon">⇅</span>
                  </th>
                  <th class="sortable" data-sort="elements" style="width: 80px; text-align: center;">
                    Elements
                    <span class="sort-icon">⇅</span>
                  </th>
                  <th class="sortable" data-sort="author" style="width: 150px;">
                    Author
                    <span class="sort-icon">⇅</span>
                  </th>
                  <th class="sortable" data-sort="description" style="width: 250px;">
                    Description
                    <span class="sort-icon">⇅</span>
                  </th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody class="table-body">
                \${tableRows}
              </tbody>
            </table>
          </div>
        \`;
      }
      
      container.innerHTML = tablesHtml;
      
      // Re-initialize sorting for new tables
      initSorting();
    }
    
    // Initialize sorting for all tables
    function initSorting() {
      document.querySelectorAll('.model-section').forEach(section => {
        const table = section.querySelector('table');
        const tbody = table.querySelector('.table-body');
        const headers = table.querySelectorAll('th.sortable');
        
        let currentSort = { column: null, direction: 'asc' };
        
        headers.forEach(header => {
          header.addEventListener('click', () => {
            const sortType = header.dataset.sort;
            
            if (currentSort.column === sortType) {
              currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
            } else {
              currentSort.column = sortType;
              currentSort.direction = 'asc';
            }
            
            headers.forEach(h => {
              h.classList.remove('sorted-asc', 'sorted-desc');
              h.querySelector('.sort-icon').textContent = '⇅';
            });
            header.classList.add('sorted-' + currentSort.direction);
            
            const rows = Array.from(tbody.querySelectorAll('tr'));
            
            rows.sort((a, b) => {
              let aVal, bVal;
              
              if (sortType === 'timestamp' || sortType === 'elements') {
                aVal = parseInt(a.dataset[sortType]);
                bVal = parseInt(b.dataset[sortType]);
              } else {
                aVal = a.dataset[sortType] || '';
                bVal = b.dataset[sortType] || '';
              }
              
              if (currentSort.direction === 'asc') {
                return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
              } else {
                return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
              }
            });
            
            rows.forEach(row => tbody.appendChild(row));
            
            rows.forEach((row, index) => {
              row.cells[0].textContent = index + 1;
            });
          });
        });
      });
    }
    
    // Time range button click handler
    document.querySelectorAll('.time-range-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        filterAndRender(btn.dataset.range);
      });
    });
    
    // Modal functionality
    const modal = document.getElementById('element-modal');
    const modalClose = document.getElementById('modal-close');
    const elementKeysList = document.getElementById('element-keys-list');
    const copyAllBtn = document.getElementById('copy-all-btn');
    let currentElementKeys = [];
    
    modalClose.addEventListener('click', () => {
      modal.classList.remove('active');
    });
    
    // Copy all element keys as JSON array
    copyAllBtn.addEventListener('click', () => {
      if (currentElementKeys.length === 0) {
        return;
      }
      
      const jsonArray = JSON.stringify(currentElementKeys, null, 2);
      navigator.clipboard.writeText(jsonArray).then(() => {
        const originalText = copyAllBtn.textContent;
        copyAllBtn.textContent = 'Copied!';
        copyAllBtn.classList.add('copied');
        
        setTimeout(() => {
          copyAllBtn.textContent = originalText;
          copyAllBtn.classList.remove('copied');
        }, 2000);
      }).catch(err => {
        console.error('Failed to copy:', err);
        alert('Failed to copy to clipboard');
      });
    });
    
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.remove('active');
      }
    });
    
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.classList.contains('active')) {
        modal.classList.remove('active');
      }
    });
    
    // Event delegation for dynamic content
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('element-count-btn')) {
        const row = e.target.closest('tr');
        const elementKeys = JSON.parse(row.dataset.elementKeys || '[]');
        
        if (elementKeys.length === 0) {
          return;
        }
        
        // Store element keys for copy all functionality
        currentElementKeys = elementKeys;
        
        elementKeysList.innerHTML = elementKeys.map((key, index) => \`
          <div class="element-key">
            <span class="element-key-text">\${index + 1}. \${key}</span>
            <button class="copy-btn" data-key="\${key}">Copy</button>
          </div>
        \`).join('');
        
        modal.classList.add('active');
      }
      
      if (e.target.classList.contains('copy-btn')) {
        const key = e.target.dataset.key;
        navigator.clipboard.writeText(key).then(() => {
          const originalText = e.target.textContent;
          e.target.textContent = 'Copied!';
          e.target.classList.add('copied');
          
          setTimeout(() => {
            e.target.textContent = originalText;
            e.target.classList.remove('copied');
          }, 2000);
        });
      }
    });
    
    // Initial render with 7 days
    filterAndRender('7days');
  </script>
</body>
</html>`;
}

// Store reference to the history window
let historyWindow = null;

/**
 * View history for all models in a new tab
 * @param {string} facilityURN - Facility URN
 * @param {Array} models - Array of model objects
 * @param {HTMLElement} button - Button element that triggered the action
 */
async function viewModelsHistory(facilityURN, models, button = null) {
  try {
    // Show loading state on button
    let originalText = null;
    if (button) {
      originalText = button.innerHTML;
      button.disabled = true;
      button.innerHTML = `
        <svg class="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      `;
    }
    
    // Fetch ALL history for all models (from January 1, 2020 - before Tandem existed)
    const now = Date.now();
    const tandemEpoch = new Date('2020-01-01T00:00:00Z').getTime();
    
    const historyPromises = models.map(async (model) => {
      try {
        const history = await getHistory(model.modelId, {
          min: tandemEpoch,
          max: now,
          includeChanges: true
        });
        
        // Use consistent naming with model detail pane
        const isDefault = isDefaultModel(facilityURN, model.modelId);
        const displayName = model.label || (isDefault ? '** Default Model **' : 'Untitled Model');
        
        return {
          modelName: displayName,
          modelId: model.modelId,
          history: history || []
        };
      } catch (error) {
        console.error(`Error fetching history for ${model.label}:`, error);
        
        // Use consistent naming with model detail pane
        const isDefault = isDefaultModel(facilityURN, model.modelId);
        const displayName = model.label || (isDefault ? '** Default Model **' : 'Untitled Model');
        
        return {
          modelName: displayName,
          modelId: model.modelId,
          history: []
        };
      }
    });
    
    const allHistory = await Promise.all(historyPromises);
    
    // Reset button
    if (button && originalText) {
      button.disabled = false;
      button.innerHTML = originalText;
    }
    
    // Check if any history exists
    const hasHistory = allHistory.some(item => item.history.length > 0);
    if (!hasHistory) {
      alert('No change history found for any models.');
      return;
    }
    
    // Generate HTML with all history data embedded
    const htmlContent = generateHistoryHTML(allHistory, facilityURN);
    
    // Open in new window/tab
    historyWindow = window.open('', '_blank');
    
    if (!historyWindow) {
      alert('Failed to open history window. Please check popup blocker settings.');
      return;
    }
    
    historyWindow.document.write(htmlContent);
    historyWindow.document.close();
  } catch (error) {
    console.error('Error viewing model history:', error);
    alert('Failed to load model history. See console for details.');
    
    // Reset button on error
    if (button && originalText) {
      button.disabled = false;
      button.innerHTML = originalText;
    }
  }
}
