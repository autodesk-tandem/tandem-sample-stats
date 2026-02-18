import { getDataTypeName, isDefaultModel, compareQualifiedColumnIds } from '../utils.js';
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

/** Per-model expand state: modelId -> true if "show all" is active (so we can collapse again and preserve state on sort). */
let schemaModelExpandState = {};

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

  // Sort attributes
  let sortedAttributes = [...attributes];
  sortedAttributes.sort((a, b) => {
    // ID: sort by column family (before ":") then by property name (after ":")
    if (sortColumn === 'id') {
      return compareQualifiedColumnIds(a.id, b.id, sortDirection === 'asc');
    }

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
    const attrIdEscaped = (attr.id || '').replace(/"/g, '&quot;');
    tableHtml += `
      <tr class="hover:bg-dark-bg/30" data-attr-id="${attrIdEscaped}">
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

  if (sortedAttributes.length > 20 && showAll) {
    tableHtml += `
      <tr>
        <td colspan="4" class="px-3 py-2 text-center border-t border-dark-border">
          <button class="text-tandem-blue hover:text-blue-700 font-medium text-sm cursor-pointer"
                  data-model="${modelId}" data-show-less="true">
            Show first 20 only
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
      const expanded = schemaModelExpandState[model] ?? false;
      renderSchemaTable(model, attributes, column, direction, expanded);
    });
  });

  // Add click handler for "show all" button
  const showAllBtn = tableContainer.querySelector('button[data-show-all]');
  if (showAllBtn) {
    showAllBtn.addEventListener('click', () => {
      const model = showAllBtn.getAttribute('data-model');
      schemaModelExpandState[model] = true;
      renderSchemaTable(model, attributes, sortColumn, sortDirection, true);
    });
  }

  // Add click handler for "show less" button
  const showLessBtn = tableContainer.querySelector('button[data-show-less]');
  if (showLessBtn) {
    showLessBtn.addEventListener('click', () => {
      const model = showLessBtn.getAttribute('data-model');
      schemaModelExpandState[model] = false;
      renderSchemaTable(model, attributes, sortColumn, sortDirection, false);
    });
  }

  // Double-click anywhere in the table to collapse back to first 20 (when expanded)
  if (showAll && attributes.length > 20) {
    const table = tableContainer.querySelector('table');
    if (table) {
      table.addEventListener('dblclick', () => {
        schemaModelExpandState[modelId] = false;
        renderSchemaTable(modelId, attributes, sortColumn, sortDirection, false);
      });
    }
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

  // Reset per-model expand state so all tables start collapsed when (re)loading the card
  schemaModelExpandState = {};

  // Get schema cache
  const schemaCache = getSchemaCache();

  // Count total attributes across all models
  let totalAttributes = 0;
  for (const modelURN in schemaCache) {
    totalAttributes += schemaCache[modelURN].attributes.length;
  }

  // Build header with search, toggle and export buttons
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
    <div class="flex items-center gap-2 mb-3 flex-wrap">
      <label for="schema-search-input" class="text-sm text-dark-text-secondary whitespace-nowrap">Find property</label>
      <input id="schema-search-input" type="text" placeholder="ID or name (e.g. n:n, Temperature)" 
             class="flex-1 min-w-[120px] max-w-[240px] px-2 py-1.5 text-sm bg-dark-bg border border-dark-border rounded text-dark-text placeholder-dark-text-secondary focus:outline-none focus:ring-1 focus:ring-tandem-blue"
             aria-label="Find property by ID or name">
      <button id="schema-search-btn" type="button"
              class="px-3 py-1.5 text-xs font-medium rounded border border-tandem-blue text-tandem-blue hover:bg-tandem-blue hover:text-white transition">
        Find
      </button>
      <span id="schema-search-message" class="text-sm text-red-400 hidden" role="status"></span>
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

  // Schema search: find all matches across models, open results in a new tab grouped by model
  const searchInput = document.getElementById('schema-search-input');
  const searchBtn = document.getElementById('schema-search-btn');
  const searchMessage = document.getElementById('schema-search-message');
  if (searchInput && searchBtn && searchMessage) {
    const runSearch = () => {
      const q = (searchInput.value || '').trim().toLowerCase();
      searchMessage.classList.add('hidden');
      searchMessage.textContent = '';
      if (!q) return;

      const resultsByModel = [];
      for (const model of models) {
        const schema = schemaCache[model.modelId];
        if (!schema?.attributes?.length) continue;
        const matches = schema.attributes.filter(
          (attr) =>
            (attr.id && attr.id.toLowerCase().includes(q)) ||
            ((attr.name || '').toString().toLowerCase().includes(q))
        );
        if (matches.length === 0) continue;
        const isDefault = isDefaultModel(facilityURN, model.modelId);
        const modelName = model.label || (isDefault ? '** Default Model **' : 'Untitled Model');
        resultsByModel.push({
          model,
          modelName,
          modelId: model.modelId,
          matches
        });
      }

      if (resultsByModel.length === 0) {
        searchMessage.textContent = 'No property found';
        searchMessage.classList.remove('hidden');
        return;
      }

      const htmlContent = generateSchemaSearchResultsHTML(q, resultsByModel);
      const newWindow = window.open('', '_blank');
      if (!newWindow) {
        searchMessage.textContent = 'Please allow pop-ups to open search results';
        searchMessage.classList.remove('hidden');
        return;
      }
      newWindow.document.write(htmlContent);
      newWindow.document.close();
    };
    searchBtn.addEventListener('click', runSearch);
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') runSearch();
    });
  }

  // Render initial tables (unsorted, collapsed unless state says otherwise)
  for (let i = 0; i < models.length; i++) {
    const model = models[i];
    const schema = schemaCache[model.modelId];
    
    if (schema && schema.attributes && schema.attributes.length > 0) {
      const showAll = schemaModelExpandState[model.modelId] ?? false;
      renderSchemaTable(model.modelId, schema.attributes, 'category', 'asc', showAll);
    }
  }
}

/**
 * Generate HTML for schema search results (new tab): matches grouped by model with section headers.
 * @param {string} query - Search query used
 * @param {Array<{ model: { modelId: string, label?: string }, modelName: string, matches: Array<{ id: string, category: string, name: string, dataType: number }> }>} resultsByModel - Matches per model
 * @returns {string} Full HTML document
 */
function generateSchemaSearchResultsHTML(query, resultsByModel) {
  const escape = (s) => (s == null ? '' : String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'));
  let sectionsHtml = '';
  for (const { modelName, modelId, matches } of resultsByModel) {
    let rowsHtml = '';
    for (const attr of matches) {
      const dataTypeName = getDataTypeName(attr.dataType);
      rowsHtml += `
        <tr>
          <td class="cell-id">${escape(attr.id)}</td>
          <td class="cell-cat">${escape(attr.category)}</td>
          <td class="cell-name">${escape(attr.name)}</td>
          <td class="cell-type">${escape(dataTypeName)}</td>
        </tr>`;
    }
    sectionsHtml += `
      <div class="model-section">
        <div class="model-header">
          <div class="model-name">${escape(modelName)}</div>
          <div class="model-urn">${escape(modelId)}</div>
          <div class="model-count">${matches.length} match${matches.length !== 1 ? 'es' : ''}</div>
        </div>
        <table class="schema-results-table">
          <colgroup>
            <col style="width: 20%;">
            <col style="width: 25%;">
            <col style="width: 35%;">
            <col style="width: 20%;">
          </colgroup>
          <thead>
            <tr>
              <th class="sortable" data-column="id">ID <span class="sort-icon"></span></th>
              <th class="sortable" data-column="category">Category <span class="sort-icon"></span></th>
              <th class="sortable" data-column="name">Name <span class="sort-icon"></span></th>
              <th class="sortable" data-column="dataType">Data Type <span class="sort-icon"></span></th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>`;
  }
  const totalMatches = resultsByModel.reduce((sum, r) => sum + r.matches.length, 0);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Schema search: ${escape(query)} - Tandem Stats</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background-color: #1a1a1a;
      color: #e0e0e0;
      padding: 20px;
    }
    .container { max-width: 1200px; margin: 0 auto; }
    .page-header {
      background: #2a2a2a;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 20px;
      border: 1px solid #404040;
    }
    .page-header h1 { font-size: 22px; font-weight: 600; color: #0696D7; margin-bottom: 8px; }
    .page-header .query { font-family: monospace; color: #a0a0a0; font-size: 14px; }
    .page-header .total { font-size: 13px; color: #a0a0a0; margin-top: 8px; }
    .model-section {
      background: #2a2a2a;
      border-radius: 8px;
      border: 1px solid #404040;
      overflow: hidden;
      margin-bottom: 20px;
    }
    .model-header {
      background: linear-gradient(to right, rgba(67, 56, 202, 0.3), rgba(67, 56, 202, 0.2));
      padding: 12px 20px;
      border-bottom: 1px solid #404040;
    }
    .model-name { font-size: 16px; font-weight: 600; color: #e0e0e0; }
    .model-urn { font-size: 12px; font-family: monospace; color: #a0a0a0; margin-top: 4px; }
    .model-count { font-size: 12px; color: #a0a0a0; margin-top: 4px; }
    table.schema-results-table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }
    thead { background: #333; }
    th {
      padding: 10px 14px;
      text-align: left;
      font-size: 11px;
      font-weight: 600;
      color: #a0a0a0;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      border-bottom: 1px solid #404040;
    }
    th.sortable { cursor: pointer; user-select: none; }
    th.sortable:hover { color: #0696D7; }
    .sort-icon { opacity: 0.4; margin-left: 2px; }
    th.sorted-asc .sort-icon, th.sorted-desc .sort-icon { opacity: 1; color: #0696D7; }
    th.sorted-asc .sort-icon::after { content: ' ▲'; }
    th.sorted-desc .sort-icon::after { content: ' ▼'; }
    td { padding: 10px 14px; font-size: 13px; border-bottom: 1px solid #404040; overflow: hidden; text-overflow: ellipsis; }
    .cell-id { font-family: monospace; color: #a0a0a0; }
    .cell-type { color: #a0a0a0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="page-header">
      <h1>Schema search results</h1>
      <div class="query">Query: "${escape(query)}"</div>
      <div class="total">${totalMatches} match${totalMatches !== 1 ? 'es' : ''} across ${resultsByModel.length} model${resultsByModel.length !== 1 ? 's' : ''}</div>
    </div>
    ${sectionsHtml}
  </div>
  <script>
    (function() {
      function compareQualifiedIds(a, b) {
        var pa = (a || '').split(':');
        var pb = (b || '').split(':');
        var fa = (pa[0] || '').toLowerCase();
        var fb = (pb[0] || '').toLowerCase();
        var cf = fa.localeCompare(fb);
        if (cf !== 0) return cf;
        return (pa[1] || '').toLowerCase().localeCompare((pb[1] || '').toLowerCase());
      }
      function getCellText(row, colIndex) {
        var cell = row.cells[colIndex];
        return cell ? (cell.textContent || '').trim() : '';
      }
      document.querySelectorAll('.schema-results-table').forEach(function(table) {
        var tbody = table.querySelector('tbody');
        var headers = table.querySelectorAll('th.sortable');
        var state = { column: null, direction: 'asc' };
        headers.forEach(function(th, colIndex) {
          th.addEventListener('click', function() {
            var col = th.getAttribute('data-column');
            if (state.column === col) state.direction = state.direction === 'asc' ? 'desc' : 'asc';
            else { state.column = col; state.direction = 'asc'; }
            headers.forEach(function(h) {
              h.classList.remove('sorted-asc', 'sorted-desc');
              h.querySelector('.sort-icon').textContent = '';
            });
            th.classList.add(state.direction === 'asc' ? 'sorted-asc' : 'sorted-desc');
            var rows = Array.from(tbody.querySelectorAll('tr'));
            var idx = ['id','category','name','dataType'].indexOf(col);
            if (idx === -1) return;
            rows.sort(function(ra, rb) {
              var a = getCellText(ra, idx);
              var b = getCellText(rb, idx);
              var cmp = col === 'id' ? compareQualifiedIds(a, b) : a.localeCompare(b, undefined, { sensitivity: 'base' });
              return state.direction === 'asc' ? cmp : -cmp;
            });
            rows.forEach(function(r) { tbody.appendChild(r); });
          });
        });
      });
    })();
  </script>
</body>
</html>`;
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

