import { getElementCount, getElementCountByCategoryAndClassification, getElementsByCategory, getElementsByClassification, getHistory, getModelProperties } from '../api.js';
import { isDefaultModel, getCategoryName } from '../utils.js';
import { createToggleFunction } from '../components/toggleHeader.js';
import { viewAssetDetails } from './assetDetails.js';

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
 * Cache for category element keys to avoid redundant API calls
 * Key: `${modelId}:${categoryId}`
 * Value: Array of element keys
 */
const categoryKeysCache = new Map();

/**
 * Render breakdown table (category or classification) with sortable headers and clickable counts
 * @param {HTMLElement} container - Container to render into
 * @param {Object} breakdown - Breakdown data with total and items array
 * @param {Array} items - Array of {id, count} objects (categories or classifications)
 * @param {Object} model - Model object
 * @param {string} facilityURN - Facility URN
 * @param {string} viewType - 'category' or 'classification'
 * @param {string} sortColumn - Column to sort by ('type', 'count', 'percentage')
 * @param {string} sortDirection - Sort direction ('asc' or 'desc')
 */
function renderBreakdownTable(container, breakdown, items, model, facilityURN, viewType = 'category', sortColumn = 'count', sortDirection = 'desc') {
  // Sort items
  const sortedItems = [...items].sort((a, b) => {
    let aVal, bVal;
    
    if (sortColumn === 'type') {
      // Get display name based on view type
      if (viewType === 'category') {
        aVal = getCategoryName(a.id).toLowerCase();
        bVal = getCategoryName(b.id).toLowerCase();
      } else {
        aVal = (a.id || 'Unknown').toString().toLowerCase();
        bVal = (b.id || 'Unknown').toString().toLowerCase();
      }
    } else if (sortColumn === 'count') {
      aVal = a.count;
      bVal = b.count;
    } else if (sortColumn === 'percentage') {
      aVal = breakdown.total > 0 ? (a.count / breakdown.total) * 100 : 0;
      bVal = breakdown.total > 0 ? (b.count / breakdown.total) * 100 : 0;
    }
    
    if (sortColumn === 'count' || sortColumn === 'percentage') {
      // Numeric sort
      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
    } else {
      // String sort
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    }
  });
  
  // Build table HTML
  const typeLabel = viewType === 'category' ? 'Category' : 'Classification';
  let tableHtml = `
    <div class="overflow-x-auto">
      <table class="min-w-full text-xs">
        <thead class="bg-dark-bg/50">
          <tr>
            <th class="px-3 py-2 text-left font-semibold text-dark-text cursor-pointer hover:bg-dark-bg/50 select-none" 
                data-column="type" data-direction="${sortColumn === 'type' ? (sortDirection === 'asc' ? 'desc' : 'asc') : 'asc'}">
              <div class="flex items-center gap-1">
                <span>${typeLabel}</span>
                ${sortColumn === 'type' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
              </div>
            </th>
            <th class="px-3 py-2 text-right font-semibold text-dark-text cursor-pointer hover:bg-dark-bg/50 select-none" 
                data-column="count" data-direction="${sortColumn === 'count' ? (sortDirection === 'asc' ? 'desc' : 'asc') : 'desc'}">
              <div class="flex items-center justify-end gap-1">
                <span>Count</span>
                ${sortColumn === 'count' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
              </div>
            </th>
            <th class="px-3 py-2 text-right font-semibold text-dark-text cursor-pointer hover:bg-dark-bg/50 select-none" 
                data-column="percentage" data-direction="${sortColumn === 'percentage' ? (sortDirection === 'asc' ? 'desc' : 'asc') : 'desc'}">
              <div class="flex items-center justify-end gap-1">
                <span>%</span>
                ${sortColumn === 'percentage' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
              </div>
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-dark-border">
  `;
  
  sortedItems.forEach(item => {
    // Get display name based on view type
    const itemName = viewType === 'category' 
      ? getCategoryName(item.id) 
      : (item.id || 'Unknown Classification');
    const percentage = breakdown.total > 0 ? ((item.count / breakdown.total) * 100).toFixed(1) : 0;
    
    tableHtml += `
      <tr class="hover:bg-dark-bg/30">
        <td class="px-3 py-2 text-dark-text">${itemName}</td>
        <td class="px-3 py-2 text-right text-dark-text font-semibold">
          <button class="breakdown-count-btn text-tandem-blue hover:text-blue-600 hover:underline cursor-pointer" 
                  data-item-id="${item.id}"
                  data-item-name="${itemName}"
                  data-model-id="${model.modelId}"
                  data-model-name="${model.label || 'Untitled Model'}"
                  data-view-type="${viewType}"
                  title="Click to view ${item.count} element${item.count !== 1 ? 's' : ''}">
            ${item.count.toLocaleString()}
          </button>
        </td>
        <td class="px-3 py-2 text-right text-dark-text-secondary">${percentage}%</td>
      </tr>
    `;
  });
  
  tableHtml += `
        </tbody>
      </table>
    </div>
  `;
  
  container.innerHTML = tableHtml;
  
  // Add click handlers for table headers (sorting)
  const headers = container.querySelectorAll('th[data-column]');
  headers.forEach(header => {
    header.addEventListener('click', () => {
      const column = header.getAttribute('data-column');
      const direction = header.getAttribute('data-direction');
      renderBreakdownTable(container, breakdown, items, model, facilityURN, viewType, column, direction);
    });
  });
  
  // Add click handlers for count buttons (view details)
  const countButtons = container.querySelectorAll('.breakdown-count-btn');
  countButtons.forEach(button => {
    button.addEventListener('click', async () => {
      const itemId = button.getAttribute('data-item-id');
      const itemName = button.getAttribute('data-item-name');
      const modelId = button.getAttribute('data-model-id');
      const modelName = button.getAttribute('data-model-name');
      const currentViewType = button.getAttribute('data-view-type');
      
      // Parse item ID based on view type
      const parsedItemId = itemId === 'null' ? null : (currentViewType === 'category' ? parseInt(itemId) : itemId);
      const cacheKey = `${modelId}:${currentViewType}:${itemId}`;
      
      // Check cache first
      let keys = categoryKeysCache.get(cacheKey);
      
      if (!keys) {
        // Show loading state
        const originalText = button.textContent;
        button.textContent = '...';
        button.disabled = true;
        
        try {
          console.log(`[Models] Loading elements for ${itemName} (${currentViewType}) - first time`);
          // Fetch element keys based on view type
          if (currentViewType === 'category') {
            keys = await getElementsByCategory(modelId, parsedItemId);
          } else {
            keys = await getElementsByClassification(modelId, parsedItemId);
          }
          
          // Cache the result
          categoryKeysCache.set(cacheKey, keys);
          console.log(`[Models] Cached ${keys.length} element keys for ${itemName}`);
          
          if (keys.length === 0) {
            alert(`No elements found for this ${currentViewType}`);
            button.textContent = originalText;
            button.disabled = false;
            return;
          }
        } catch (error) {
          console.error(`Error fetching ${currentViewType} elements:`, error);
          alert('Failed to fetch elements. See console for details.');
          button.textContent = originalText;
          button.disabled = false;
          return;
        }
        
        // Restore button state
        button.textContent = originalText;
        button.disabled = false;
      } else {
        console.log(`[Models] Using cached elements for ${itemName} (${currentViewType}) - ${keys.length} keys, no API call`);
      }
      
      // Open Asset Details page
      const elementsByModel = [{
        modelURN: modelId,
        modelName: modelName,
        keys: keys
      }];
      
      viewAssetDetails(elementsByModel, `${itemName} in ${modelName}`);
    });
  });
}

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
      <div class="border border-dark-border rounded overflow-hidden" id="detail-model-${i}">
        <!-- Model Header -->
        <div class="bg-gradient-to-r from-indigo-900/30 to-indigo-800/30 px-4 py-3 border-b border-dark-border">
          <div class="flex items-start justify-between">
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 flex-wrap mb-1">
                <h3 class="font-semibold text-dark-text">${model.label || (isDefault ? '** Default Model **' : 'Untitled Model')}</h3>
                ${isDefault ? '<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-500/20 text-purple-300">Default</span>' : ''}
                ${isMainModel ? '<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-500/20 text-blue-300">Main</span>' : ''}
                ${isModelOn ? 
                  '<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-500/20 text-green-300"><span class="mr-1">●</span>On</span>' : 
                  '<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-500/20 text-gray-300"><span class="mr-1">○</span>Off</span>'}
              </div>
              <div class="text-xs font-mono text-dark-text-secondary mt-1">${model.modelId}</div>
              <div class="text-xs text-dark-text-secondary mt-1 flex items-center gap-4 flex-wrap">
                ${!isDefault ? `<span id="detail-phase-${i}"><span class="inline-block animate-pulse">Loading phase...</span></span>` : ''}
                ${!isDefault ? `<span id="detail-last-updated-${i}"><span class="inline-block animate-pulse">Loading date...</span></span>` : ''}
              </div>
            </div>
            <div class="text-right flex-shrink-0 ml-4">
              <div class="text-lg font-bold text-dark-text" id="detail-element-count-${i}">
                <span class="inline-block animate-pulse">...</span>
              </div>
              <div class="text-xs text-dark-text-secondary">Elements</div>
            </div>
          </div>
        </div>
        
        <!-- Model Details -->
        <div class="px-4 py-3 bg-dark-card">
          ${model.version || model.createdAt || model.lastModified ? '<div class="space-y-2 text-sm mb-3">' : ''}
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
          ${model.version || model.createdAt || model.lastModified ? '</div>' : ''}
          
          <!-- Element Breakdown (Category/Classification) -->
          <div class="${model.version || model.createdAt || model.lastModified ? 'border-t border-dark-border pt-3' : ''}">
            <button id="toggle-breakdown-${i}" class="flex items-center gap-2 text-sm font-medium text-dark-text hover:text-tandem-blue transition">
              <svg class="w-4 h-4 transition-transform" id="breakdown-icon-${i}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
              </svg>
              <span>Element Breakdown</span>
            </button>
            <div id="breakdown-container-${i}" class="hidden mt-3">
              <!-- Radio buttons for view selection -->
              <div class="flex gap-4 mb-3 text-sm">
                <label class="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="breakdown-view-${i}" value="category" 
                         class="breakdown-view-radio text-tandem-blue focus:ring-tandem-blue" 
                         data-model-index="${i}" checked>
                  <span class="text-dark-text">Category</span>
                </label>
                <label class="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="breakdown-view-${i}" value="classification" 
                         class="breakdown-view-radio text-tandem-blue focus:ring-tandem-blue" 
                         data-model-index="${i}">
                  <span class="text-dark-text">Classification</span>
                </label>
              </div>
              <!-- Table will be rendered here -->
              <div id="breakdown-table-${i}"></div>
            </div>
          </div>
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
  
  // Set up element breakdown toggle buttons for each model
  // Cache breakdown data to avoid redundant API calls
  const breakdownCache = new Map();
  // Track current view type for each model (default to 'category')
  const currentViewTypes = new Map();
  
  for (let i = 0; i < models.length; i++) {
    const model = models[i];
    const toggleBtn = document.getElementById(`toggle-breakdown-${i}`);
    const breakdownContainer = document.getElementById(`breakdown-container-${i}`);
    const breakdownTable = document.getElementById(`breakdown-table-${i}`);
    const icon = document.getElementById(`breakdown-icon-${i}`);
    
    // Initialize with 'category' view
    currentViewTypes.set(i, 'category');
    
    if (toggleBtn && breakdownContainer && breakdownTable) {
      // Toggle button handler
      toggleBtn.addEventListener('click', async () => {
        const isHidden = breakdownContainer.classList.contains('hidden');
        
        if (isHidden) {
          // Show breakdown
          breakdownContainer.classList.remove('hidden');
          icon?.classList.add('rotate-180');
          
          // Check cache first to avoid redundant API calls
          if (!breakdownCache.has(model.modelId)) {
            console.log(`[Models] Loading breakdown (category + classification) for ${model.label} (first time)`);
            breakdownTable.innerHTML = '<div class="text-sm text-dark-text-secondary animate-pulse">Loading breakdown...</div>';
            
            try {
              // Fetch BOTH category and classification in ONE API call
              const breakdown = await getElementCountByCategoryAndClassification(model.modelId);
              
              if (breakdown.total === 0) {
                breakdownTable.innerHTML = '<div class="text-sm text-dark-text-secondary">No elements found.</div>';
                breakdownCache.set(model.modelId, null); // Cache empty result
              } else {
                // Cache the full breakdown data
                breakdownCache.set(model.modelId, breakdown);
                console.log(`[Models] Cached breakdown for ${model.label} (${breakdown.total} elements, ${breakdown.categories.length} categories, ${breakdown.classifications.length} classifications)`);
                
                // Render the initial view (category by default)
                const viewType = currentViewTypes.get(i);
                const items = viewType === 'category' ? breakdown.categories : breakdown.classifications;
                renderBreakdownTable(breakdownTable, breakdown, items, model, facilityURN, viewType);
              }
            } catch (error) {
              console.error('Error loading breakdown:', error);
              breakdownTable.innerHTML = '<div class="text-sm text-red-400">Failed to load breakdown.</div>';
            }
          } else {
            console.log(`[Models] Using cached breakdown for ${model.label} (no API call)`);
            
            // Re-render from cache
            const breakdown = breakdownCache.get(model.modelId);
            if (breakdown) {
              const viewType = currentViewTypes.get(i);
              const items = viewType === 'category' ? breakdown.categories : breakdown.classifications;
              renderBreakdownTable(breakdownTable, breakdown, items, model, facilityURN, viewType);
            }
          }
        } else {
          // Hide breakdown
          breakdownContainer.classList.add('hidden');
          icon?.classList.remove('rotate-180');
        }
      });
      
      // Radio button change handlers
      const radioButtons = breakdownContainer.querySelectorAll('.breakdown-view-radio');
      radioButtons.forEach(radio => {
        radio.addEventListener('change', () => {
          if (radio.checked) {
            const viewType = radio.value; // 'category' or 'classification'
            currentViewTypes.set(i, viewType);
            
            // Re-render table with new view type
            const breakdown = breakdownCache.get(model.modelId);
            if (breakdown) {
              const items = viewType === 'category' ? breakdown.categories : breakdown.classifications;
              renderBreakdownTable(breakdownTable, breakdown, items, model, facilityURN, viewType);
              console.log(`[Models] Switched to ${viewType} view for ${model.label} (using cached data)`);
            }
          }
        });
      });
    }
  }
  
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
        
        phaseElement.textContent = `${label}: ${displayValue}`;
      } else if (phaseElement) {
        phaseElement.textContent = 'Phase: -';
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
        lastUpdatedElement.textContent = `Updated: ${formattedDate}`;
      } else if (lastUpdatedElement) {
        lastUpdatedElement.textContent = 'Updated: -';
      }
    }).catch(error => {
      console.error(`Error getting model properties for ${model.label}:`, error);
      // Update with error state
      const phaseElement = document.getElementById(`detail-phase-${i}`);
      if (phaseElement) {
        phaseElement.textContent = 'Phase: -';
      }
      const lastUpdatedElement = document.getElementById(`detail-last-updated-${i}`);
      if (lastUpdatedElement) {
        lastUpdatedElement.textContent = 'Updated: -';
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
      background: linear-gradient(to right, rgba(67, 56, 202, 0.3), rgba(67, 56, 202, 0.3));
      padding: 12px 20px;
      border-bottom: 1px solid #404040;
    }
    .model-name {
      font-size: 16px;
      font-weight: 600;
      color: #e0e0e0;
    }
    .model-urn {
      font-size: 12px;
      font-family: 'Courier New', monospace;
      color: #a0a0a0;
      margin-top: 4px;
    }
    .model-change-count {
      font-size: 12px;
      color: #a0a0a0;
      margin-top: 4px;
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
      margin: 0 0 4px 0;
      color: #0696D7;
      font-size: 18px;
      font-weight: 600;
    }
    
    .modal-model-info {
      font-size: 12px;
      color: #a0a0a0;
    }
    
    .modal-model-name {
      font-weight: 600;
      color: #0696D7;
      margin-bottom: 2px;
    }
    
    .modal-model-urn {
      font-family: 'Courier New', monospace;
      font-size: 11px;
      color: #808080;
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
    
    .element-keys-textarea {
      width: 100%;
      font-family: 'Courier New', monospace;
      font-size: 12px;
      padding: 12px;
      background: #1a1a1a;
      border: 1px solid #404040;
      border-radius: 4px;
      color: #e0e0e0;
      resize: vertical;
      min-height: 200px;
      max-height: 500px;
      line-height: 1.5;
    }
    
    .element-keys-textarea:focus {
      outline: none;
      border-color: #0696D7;
      box-shadow: 0 0 0 2px rgba(6, 150, 215, 0.2);
    }
    
    .element-keys-textarea::selection {
      background: #0696D7;
      color: white;
    }
    
    .element-count-btn {
      background: none;
      border: none;
      padding: 0;
      font-size: inherit;
      font-family: inherit;
      color: #0696D7;
      font-weight: 600;
      cursor: pointer;
    }
    
    .element-count-btn:hover {
      color: #057ab5;
      text-decoration: underline;
    }
    
    .view-details-btn {
      display: inline-flex;
      align-items: center;
      padding: 8px 12px;
      border: 1px solid #0696D7;
      font-size: 12px;
      font-weight: 500;
      border-radius: 4px;
      color: #0696D7;
      background: transparent;
      cursor: pointer;
      transition: all 0.2s;
    }
    
    .view-details-btn:hover {
      background: #0696D7;
      color: white;
    }
    
    .view-details-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
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
        <div style="display: flex; align-items: center; gap: 12px;">
          <button id="view-all-details-btn" class="view-details-btn">
            <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="width: 16px; height: 16px; display: inline-block; vertical-align: middle; margin-right: 6px;">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
            </svg>
            Details
          </button>
          <div class="time-range-controls">
            <button class="time-range-btn active" data-range="7days">7 Days</button>
            <button class="time-range-btn" data-range="30days">30 Days</button>
            <button class="time-range-btn" data-range="all">All Time</button>
          </div>
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
        <div class="stat-item">
          <span class="stat-label">Unique Elements</span>
          <span class="stat-value" id="stat-elements">0</span>
        </div>
      </div>
    </div>
    
    <div id="tables-container"></div>
  </div>
  
  <!-- Element Keys Modal -->
  <div class="modal-overlay" id="element-modal">
    <div class="modal-content">
      <div class="modal-header">
        <div>
          <h2>Element Keys</h2>
          <div id="modal-model-info" class="modal-model-info"></div>
        </div>
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
      
      // Calculate unique elements across all changes
      const uniqueElementsSet = new Set();
      filteredHistory.forEach(model => {
        model.history.forEach(entry => {
          if (entry.k && Array.isArray(entry.k)) {
            entry.k.forEach(key => uniqueElementsSet.add(key));
          }
        });
      });
      const uniqueElements = uniqueElementsSet.size;
      
      // Update stats
      document.getElementById('stat-models').textContent = modelsWithHistory.length;
      document.getElementById('stat-changes').textContent = totalChanges;
      document.getElementById('stat-elements').textContent = uniqueElements;
      
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
                data-model-name="\${item.modelName}"
                data-model-id="\${item.modelId}"
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
              <div class="model-name">\${item.modelName}</div>
              <div class="model-urn">\${item.modelId}</div>
              <div class="model-change-count">\${item.history.length} change\${item.history.length !== 1 ? 's' : ''}</div>
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
    const modalModelInfo = document.getElementById('modal-model-info');
    const elementKeysList = document.getElementById('element-keys-list');
    const copyAllBtn = document.getElementById('copy-all-btn');
    let currentElementData = null;
    
    modalClose.addEventListener('click', () => {
      modal.classList.remove('active');
    });
    
    // Copy all element keys in structured format
    copyAllBtn.addEventListener('click', () => {
      if (!currentElementData || currentElementData.keys.length === 0) {
        return;
      }
      
      // Format as structured JSON (same as Tagged Assets)
      const structuredData = [{
        modelURN: currentElementData.modelURN,
        modelName: currentElementData.modelName,
        elementCount: currentElementData.keys.length,
        elementKeys: currentElementData.keys
      }];
      
      const jsonOutput = JSON.stringify(structuredData, null, 2);
      navigator.clipboard.writeText(jsonOutput).then(() => {
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
    
    // View all details button handler
    document.getElementById('view-all-details-btn').addEventListener('click', () => {
      // Collect all unique element keys from the currently displayed (filtered) history
      const allRows = document.querySelectorAll('#tables-container tr[data-element-keys]');
      
      if (allRows.length === 0) {
        alert('No changes found in the selected time range');
        return;
      }
      
      // Group elements by model
      const modelMap = new Map();
      
      allRows.forEach(row => {
        const modelId = row.dataset.modelId;
        const modelName = row.dataset.modelName;
        const elementKeys = JSON.parse(row.dataset.elementKeys || '[]');
        
        if (!modelMap.has(modelId)) {
          modelMap.set(modelId, {
            modelURN: modelId,
            modelName: modelName,
            keys: new Set()
          });
        }
        
        // Add all keys (Set automatically deduplicates)
        elementKeys.forEach(key => modelMap.get(modelId).keys.add(key));
      });
      
      // Convert sets to arrays and filter out models with no keys
      const elementsByModel = Array.from(modelMap.values())
        .map(model => ({
          modelURN: model.modelURN,
          modelName: model.modelName,
          keys: Array.from(model.keys)
        }))
        .filter(model => model.keys.length > 0); // Only include models with keys
      
      // Check if we have any valid models
      if (elementsByModel.length === 0) {
        alert('No elements found in the selected changes');
        return;
      }
      
      // Calculate total
      const totalElements = elementsByModel.reduce((sum, model) => sum + model.keys.length, 0);
      
      // Create title based on current filter
      let timeRangeText = '';
      if (currentTimeRange === '7days') {
        timeRangeText = '7 Days';
      } else if (currentTimeRange === '30days') {
        timeRangeText = '30 Days';
      } else {
        timeRangeText = 'All Time';
      }
      
      const title = \`History Details: \${timeRangeText}\`;
      
      if (window.viewAssetDetails) {
        window.viewAssetDetails(elementsByModel, title);
      } else {
        alert('Asset details functionality is not available');
      }
    });
    
    // Event delegation for dynamic content
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('element-count-btn')) {
        const row = e.target.closest('tr');
        const elementKeys = JSON.parse(row.dataset.elementKeys || '[]');
        const modelName = row.dataset.modelName;
        const modelId = row.dataset.modelId;
        const operation = row.dataset.operation;
        const timestamp = row.dataset.timestamp;
        
        if (elementKeys.length === 0) {
          return;
        }
        
        // Format timestamp for title
        const date = new Date(parseInt(timestamp));
        const dateStr = date.toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        });
        
        // Open Asset Details page
        const elementsByModel = [{
          modelURN: modelId,
          modelName: modelName,
          keys: elementKeys
        }];
        
        const title = \`Change Details: \${dateStr}\`;
        
        if (window.viewAssetDetails) {
          window.viewAssetDetails(elementsByModel, title);
        } else {
          alert('Asset details functionality is not available');
        }
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
    
    // Expose viewAssetDetails to the child window
    historyWindow.viewAssetDetails = viewAssetDetails;
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
