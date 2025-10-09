import { getElementCount } from '../api.js';
import { isDefaultModel } from '../state/schemaCache.js';
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
                <h3 class="text-lg font-semibold text-dark-text">${model.label || (isDefault ? '** Default Model **' : 'Untitled Model')}</h3>
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
  container.innerHTML = headerHtml + summaryHtml + detailHtml;
  
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

