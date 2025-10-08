import { getDataTypeName } from '../utils.js';
import { getSchemaCache } from '../state/schemaCache.js';
import { createToggleFunction } from '../components/toggleHeader.js';

/**
 * Toggle schema detail view
 */
const toggleSchemaDetail = createToggleFunction({
  detailId: 'schema-detail',
  summaryId: 'schema-summary',
  toggleBtnId: 'toggle-schema-btn',
  iconDownId: 'toggle-schema-icon-down',
  iconUpId: 'toggle-schema-icon-up'
});

/**
 * Render a sortable schema table for a specific model
 * @param {string} modelId - Model ID
 * @param {Array} attributes - Array of attribute objects
 * @param {string} sortColumn - Column to sort by
 * @param {string} sortDirection - 'asc' or 'desc'
 * @param {boolean} showAll - Show all attributes or just first 20
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
  }

  tableHtml += `
      </tbody>
    </table>
  `;

  tableContainer.innerHTML = tableHtml;

  // Add click handlers for table headers
  const headers = tableContainer.querySelectorAll('th[data-column]');
  headers.forEach(header => {
    header.addEventListener('click', () => {
      const column = header.getAttribute('data-column');
      const direction = header.getAttribute('data-direction');
      const model = header.getAttribute('data-model');
      renderSchemaTable(model, attributes, column, direction, showAll);
    });
  });

  // Add click handler for "show all" button
  const showAllBtn = tableContainer.querySelector('button[data-show-all]');
  if (showAllBtn) {
    showAllBtn.addEventListener('click', () => {
      const model = showAllBtn.getAttribute('data-model');
      renderSchemaTable(model, attributes, sortColumn, sortDirection, true);
    });
  }
}

/**
 * Display schema for all models
 * @param {HTMLElement} container - DOM element to render into
 * @param {Array} models - Array of model objects
 */
export async function displaySchema(container, models) {
  if (!models || models.length === 0) {
    container.innerHTML = '<p class="text-dark-text-secondary">No models found.</p>';
    return;
  }

  // Get schema cache
  const schemaCache = getSchemaCache();

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
  
  container.innerHTML = headerHtml + summaryHtml + detailHtml;
  
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

