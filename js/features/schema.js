import { getDataTypeName, isDefaultModel } from '../utils.js';
import { getSchemaCache } from '../state/schemaCache.js';
import { createToggleFunction } from '../components/toggleHeader.js';
import { 
  sanitizeSheetName, 
  makeUniqueSheetName,
  styleHeaderRow,
  getColumnLetters,
  createExportButtonManager,
  downloadWorkbook,
  createDateFilename,
  ExcelStyles
} from '../utils/excelUtils.js';

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
function renderSchemaTable(modelId, attributes, sortColumn = 'category', sortDirection = 'asc', showAll = false) {
  const tableContainer = document.getElementById(`schema-table-${modelId}`);
  if (!tableContainer) return;

  // Sort attributes - always sort by category first, then by the selected column (or name as secondary)
  let sortedAttributes = [...attributes];
  sortedAttributes.sort((a, b) => {
    // If sorting by category, use name as secondary sort
    if (sortColumn === 'category') {
      const categoryComparison = (a.category || '').toString().toLowerCase().localeCompare((b.category || '').toString().toLowerCase());
      if (categoryComparison !== 0) {
        return sortDirection === 'asc' ? categoryComparison : -categoryComparison;
      }
      // Secondary sort by name
      return (a.name || '').toString().toLowerCase().localeCompare((b.name || '').toString().toLowerCase());
    }
    
    // For other columns, still use category as primary sort, then the selected column
    const categoryComparison = (a.category || '').toString().toLowerCase().localeCompare((b.category || '').toString().toLowerCase());
    if (categoryComparison !== 0) {
      return categoryComparison; // Always sort category ascending for grouping
    }
    
    // Within same category, sort by the selected column
    const aVal = (a[sortColumn] || '').toString().toLowerCase();
    const bVal = (b[sortColumn] || '').toString().toLowerCase();
    
    if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  // Build table HTML with fixed column widths
  let tableHtml = `
    <table class="min-w-full text-xs table-fixed">
      <colgroup>
        <col style="width: 20%;">
        <col style="width: 25%;">
        <col style="width: 35%;">
        <col style="width: 20%;">
      </colgroup>
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
 * @param {string} facilityURN - Facility URN for determining default model
 */
export async function displaySchema(container, models, facilityURN) {
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

  // Build header with toggle and export buttons
  let headerHtml = `
    <div class="flex items-center justify-between mb-3">
      <div class="flex items-center space-x-2">
        <div class="text-xl font-bold text-tandem-blue">${totalAttributes}</div>
        <div class="text-sm text-dark-text-secondary">
          <div>Attribute${totalAttributes !== 1 ? 's' : ''} across ${models.length} model${models.length !== 1 ? 's' : ''}</div>
        </div>
      </div>
      <div class="flex items-center space-x-2">
        <button id="export-schema-btn"
                class="inline-flex items-center px-3 py-2 border border-tandem-blue text-xs font-medium rounded text-tandem-blue hover:bg-tandem-blue hover:text-white transition"
                title="Export to Excel">
          <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
          </svg>
          Export
        </button>
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

    const isDefault = isDefaultModel(facilityURN, model.modelId);
    const displayName = model.label || (isDefault ? '** Default Model **' : 'Untitled Model');

    detailHtml += `
      <div class="border border-dark-border rounded overflow-hidden">
        <!-- Model Header -->
        <div class="bg-gradient-to-r from-indigo-900/30 to-indigo-800/30 px-4 py-3 border-b border-dark-border">
          <div class="flex items-start justify-between">
            <div class="flex-1 min-w-0">
              <h3 class="font-semibold text-dark-text">${displayName}</h3>
              <div class="text-xs font-mono text-dark-text-secondary mt-1">${model.modelId}</div>
            </div>
            <div class="text-right flex-shrink-0 ml-4">
              <div class="text-xs text-dark-text-secondary">${schema.attributes.length} attributes</div>
            </div>
          </div>
        </div>
        
        <!-- Schema Table -->
        <div class="p-4">
          <div class="overflow-x-auto">
            <div id="schema-table-${model.modelId}"></div>
          </div>
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

  // Attach export button event listener
  const exportBtn = document.getElementById('export-schema-btn');
  if (exportBtn) {
    exportBtn.addEventListener('click', () => exportSchemaToExcel(models, schemaCache, facilityURN));
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

/**
 * Export schema to Excel with one sheet per model
 * @param {Array} models - Array of model objects
 * @param {Object} schemaCache - Schema cache object
 * @param {string} facilityURN - Facility URN for determining default model
 */
async function exportSchemaToExcel(models, schemaCache, facilityURN) {
  const exportBtn = document.getElementById('export-schema-btn');
  const originalHtml = exportBtn.innerHTML;
  const buttonManager = createExportButtonManager(exportBtn, originalHtml);

  try {
    buttonManager.setLoading();

    // Create a new workbook
    const wb = XLSX.utils.book_new();
    const usedSheetNames = new Set();

    // Create a sheet for each model
    for (const model of models) {
      const schema = schemaCache[model.modelId];
      
      if (!schema || !schema.attributes || schema.attributes.length === 0) {
        continue;
      }

      // Prepare sheet data
      const sheetData = [
        ['ID', 'Category', 'Name', 'Data Type'] // Header row
      ];

      // Add all attributes
      schema.attributes.forEach(attr => {
        sheetData.push([
          attr.id || '',
          attr.category || '',
          attr.name || '',
          getDataTypeName(attr.dataType)
        ]);
      });

      // Create worksheet
      const ws = XLSX.utils.aoa_to_sheet(sheetData);

      // Style the header row
      const columns = getColumnLetters(4); // 4 columns: ID, Category, Name, Data Type
      styleHeaderRow(ws, 1, columns);

      // Set column widths
      ws['!cols'] = [
        { wch: 35 }, // ID
        { wch: 20 }, // Category
        { wch: 30 }, // Name
        { wch: 15 }  // Data Type
      ];

      // Sanitize and make unique sheet name
      // Use same naming logic as display
      const isDefault = isDefaultModel(facilityURN, model.modelId);
      const displayName = model.label || (isDefault ? 'Default_Model' : 'Untitled_Model');
      const baseSheetName = sanitizeSheetName(displayName, `Model_${models.indexOf(model) + 1}`);
      const sheetName = makeUniqueSheetName(baseSheetName, usedSheetNames);
      usedSheetNames.add(sheetName);

      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    }

    // Check if we have any sheets
    if (wb.SheetNames.length === 0) {
      throw new Error('No schema data to export');
    }

    // Generate filename and download
    const filename = createDateFilename('schema-export');
    downloadWorkbook(wb, filename);

    buttonManager.setSuccess();
  } catch (error) {
    console.error('Error exporting schema to Excel:', error);
    buttonManager.setError();
    alert('Failed to export schema to Excel. See console for details.');
  }
}

