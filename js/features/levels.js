import { createToggleFunction } from '../components/toggleHeader.js';
import { viewAssetDetails } from './assetDetails.js';

/**
 * Toggle levels detail view
 */
const toggleLevelsDetail = createToggleFunction({
  detailId: 'levels-detail',
  summaryId: 'levels-summary',
  toggleBtnId: 'toggle-levels-btn',
  iconDownId: 'toggle-levels-icon-down',
  iconUpId: 'toggle-levels-icon-up'
});

/**
 * Display levels list with details and sorting
 * @param {HTMLElement} container - DOM element to render into
 * @param {Array} levels - Array of level objects
 * @param {string} sortColumn - Sort by 'name' or 'elevation' (default: null for no sorting)
 * @param {string} sortDirection - 'asc' or 'desc' (default: 'asc')
 */
export async function displayLevels(container, levels, sortColumn = null, sortDirection = 'asc') {
  if (!levels || levels.length === 0) {
    container.innerHTML = '<p class="text-dark-text-secondary">No levels found in this facility.</p>';
    return;
  }

  // Calculate overall statistics
  const levelsWithElevation = levels.filter(l => l.elevation !== null && l.elevation !== undefined);
  const minElevation = levelsWithElevation.length > 0 
    ? Math.min(...levelsWithElevation.map(l => l.elevation))
    : null;
  const maxElevation = levelsWithElevation.length > 0 
    ? Math.max(...levelsWithElevation.map(l => l.elevation))
    : null;
  
  // Check if detail section is currently visible (to preserve state after re-render)
  const detailSection = document.getElementById('levels-detail');
  const isDetailVisible = detailSection && !detailSection.classList.contains('hidden');

  // Build header with stats and action buttons
  let headerHtml = `
    <div class="flex items-center justify-between mb-3">
      <div class="flex items-center space-x-6">
        <div>
          <div class="text-xs text-dark-text-secondary uppercase tracking-wide">Total</div>
          <div class="text-xl font-bold text-tandem-blue">${levels.length}</div>
        </div>
        ${levelsWithElevation.length > 0 ? `
          <div class="text-dark-text-secondary text-xl">|</div>
          <div>
            <div class="text-xs text-dark-text-secondary uppercase tracking-wide">Min Elevation</div>
            <div class="text-base font-bold text-purple-400">${minElevation.toFixed(2)} ft</div>
          </div>
          <div>
            <div class="text-xs text-dark-text-secondary uppercase tracking-wide">Max Elevation</div>
            <div class="text-base font-bold text-purple-400">${maxElevation.toFixed(2)} ft</div>
          </div>
        ` : ''}
      </div>
      <div class="flex items-center space-x-3">
        <button id="levels-details-btn"
                class="inline-flex items-center px-3 py-2 border border-tandem-blue text-xs font-medium rounded text-tandem-blue hover:bg-tandem-blue hover:text-white transition"
                title="View detailed information">
          <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
          </svg>
          Details
        </button>
        <button id="toggle-levels-btn"
                class="p-2 hover:bg-dark-bg/50 rounded transition"
                title="${isDetailVisible ? 'Show less' : 'Show more'}">
          <svg id="toggle-levels-icon-down" class="w-5 h-5 ${isDetailVisible ? 'hidden' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
          </svg>
          <svg id="toggle-levels-icon-up" class="w-5 h-5 ${isDetailVisible ? '' : 'hidden'}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"></path>
          </svg>
        </button>
      </div>
    </div>
  `;
  
  // Build summary view (collapsed state, hide if detail is visible)
  let summaryHtml = `
    <div id="levels-summary" class="${isDetailVisible ? 'hidden' : ''}"></div>
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

  // Sort levels within each model group if sortColumn is specified
  if (sortColumn) {
    for (const modelId in levelsByModel) {
      const modelGroup = levelsByModel[modelId];
      modelGroup.levels.sort((a, b) => {
        let aVal, bVal;
        
        if (sortColumn === 'name') {
          aVal = (a.name || '').toLowerCase();
          bVal = (b.name || '').toLowerCase();
        } else if (sortColumn === 'elevation') {
          // Treat null/undefined as -Infinity for sorting (push to bottom)
          aVal = a.elevation !== null && a.elevation !== undefined ? a.elevation : -Infinity;
          bVal = b.elevation !== null && b.elevation !== undefined ? b.elevation : -Infinity;
        }
        
        if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }
  }

  // Build detailed view grouped by model (show if it was visible before)
  let detailHtml = `<div id="levels-detail" class="${isDetailVisible ? '' : 'hidden'} space-y-2">`;
  
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
        
        <!-- Levels table -->
        <table class="min-w-full text-xs">
          <thead class="bg-dark-bg/50">
            <tr>
              <th class="px-3 py-2 text-left font-semibold text-dark-text">#</th>
              <th class="px-3 py-2 text-left font-semibold text-dark-text cursor-pointer hover:bg-dark-bg/50 select-none" 
                  data-column="name" data-direction="${sortColumn === 'name' ? (sortDirection === 'asc' ? 'desc' : 'asc') : 'asc'}" data-model="${modelId}">
                <div class="flex items-center gap-1">
                  <span>Name</span>
                  ${sortColumn === 'name' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                </div>
              </th>
              <th class="px-3 py-2 text-right font-semibold text-dark-text cursor-pointer hover:bg-dark-bg/50 select-none" 
                  data-column="elevation" data-direction="${sortColumn === 'elevation' ? (sortDirection === 'asc' ? 'desc' : 'asc') : 'desc'}" data-model="${modelId}">
                <div class="flex items-center justify-end gap-1">
                  <span>Elevation</span>
                  ${sortColumn === 'elevation' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                </div>
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-dark-border">
    `;
    
    modelGroup.levels.forEach(level => {
      levelCounter++;
      
      // Format elevation if available
      const elevationDisplay = level.elevation !== null && level.elevation !== undefined 
        ? `${level.elevation.toFixed(2)} ft` 
        : '-';
      
      detailHtml += `
        <tr class="hover:bg-dark-bg/30 bg-dark-card">
          <td class="px-3 py-2 text-dark-text-secondary">${levelCounter}</td>
          <td class="px-3 py-2 text-dark-text">${level.name}</td>
          <td class="px-3 py-2 text-right text-dark-text font-mono">${elevationDisplay}</td>
        </tr>
      `;
    });
    
    detailHtml += `
          </tbody>
        </table>
      </div>
    `;
  }
  
  detailHtml += '</div>';
  
  container.innerHTML = headerHtml + summaryHtml + detailHtml;
  
  // Store levels data for re-sorting
  container.dataset.levelsData = JSON.stringify(levels);
  
  const toggleBtn = document.getElementById('toggle-levels-btn');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', toggleLevelsDetail);
  }
  
  // Add table header sorting event listeners
  const headers = container.querySelectorAll('th[data-column]');
  headers.forEach(header => {
    header.addEventListener('click', () => {
      const column = header.getAttribute('data-column');
      const direction = header.getAttribute('data-direction');
      displayLevels(container, levels, column, direction);
    });
  });
  
  // Add Details button event listener
  const detailsBtn = document.getElementById('levels-details-btn');
  if (detailsBtn) {
    detailsBtn.addEventListener('click', () => {
      // Group levels by model for Asset Details view
      const elementsByModel = [];
      const modelMap = new Map();
      
      levels.forEach(level => {
        if (!modelMap.has(level.modelId)) {
          modelMap.set(level.modelId, {
            modelURN: level.modelId,
            modelName: level.modelName || 'Unknown Model',
            keys: []
          });
        }
        modelMap.get(level.modelId).keys.push(level.key);
      });
      
      // Convert map to array
      modelMap.forEach(model => elementsByModel.push(model));
      
      // Open Details page
      viewAssetDetails(elementsByModel, `Level Details`);
    });
  }
}

