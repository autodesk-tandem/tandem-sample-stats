import { createToggleFunction } from '../components/toggleHeader.js';

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
 * Display levels list with details
 * @param {HTMLElement} container - DOM element to render into
 * @param {Array} levels - Array of level objects
 */
export async function displayLevels(container, levels) {
  if (!levels || levels.length === 0) {
    container.innerHTML = '<p class="text-dark-text-secondary">No levels found in this facility.</p>';
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
  
  container.innerHTML = headerHtml + summaryHtml + detailHtml;
  
  const toggleBtn = document.getElementById('toggle-levels-btn');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', toggleLevelsDetail);
  }
}

