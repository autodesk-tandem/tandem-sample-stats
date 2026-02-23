import { createToggleFunction } from '../components/toggleHeader.js';
import { getTaggedAssetsDetails, getElementsByProperty } from '../api.js';
import { getSchemaCache } from '../state/schemaCache.js';
import { compareQualifiedColumnIds, isDefaultModel } from '../utils.js';
import { viewAssetDetails } from './assetDetails.js';

/**
 * Toggle tagged assets detail view
 */
const toggleTaggedAssetsDetail = createToggleFunction({
  detailId: 'taggedAssets-detail',
  summaryId: 'taggedAssets-summary',
  toggleBtnId: 'toggle-taggedAssets-btn',
  iconDownId: 'toggle-taggedAssets-icon-down',
  iconUpId: 'toggle-taggedAssets-icon-up'
});

/**
 * Render sortable tagged assets table grouped by model
 * @param {Array} propertyDetails - Array of property detail objects
 * @param {string} sortColumn - Column to sort by
 * @param {string} sortDirection - 'asc' or 'desc'
 * @param {string} facilityURN - Facility URN for fetching element keys
 * @param {string} region - Region identifier for API calls
 */
function renderTaggedAssetsTable(propertyDetails, sortColumn = 'count', sortDirection = 'desc', facilityURN = null, region = null) {
  const tableContainer = document.getElementById('taggedAssets-table');
  if (!tableContainer) return;

  // Group properties by model
  const propertiesByModel = {};
  propertyDetails.forEach(prop => {
    if (!propertiesByModel[prop.modelId]) {
      propertiesByModel[prop.modelId] = {
        modelName: prop.modelName,
        modelId: prop.modelId,
        properties: []
      };
    }
    propertiesByModel[prop.modelId].properties.push(prop);
  });

  // Sort properties within each model group
  for (const modelId in propertiesByModel) {
    const modelGroup = propertiesByModel[modelId];
    modelGroup.properties.sort((a, b) => {
      let aVal, bVal;
      
      if (sortColumn === 'count') {
        aVal = a.count;
        bVal = b.count;
        // Numeric sort
        if (sortDirection === 'asc') {
          return aVal - bVal;
        } else {
          return bVal - aVal;
        }
      } else if (sortColumn === 'id') {
        // Sort by column family then property name (qualified ID format)
        return compareQualifiedColumnIds(a.id, b.id, sortDirection === 'asc');
      } else {
        // String sort for category, name
        aVal = (a[sortColumn] || '').toString().toLowerCase();
        bVal = (b[sortColumn] || '').toString().toLowerCase();
        
        if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      }
    });
  }

  // Build grouped table HTML
  let tableHtml = '<div class="space-y-2">';
  
  for (const modelId in propertiesByModel) {
    const modelGroup = propertiesByModel[modelId];
    
    tableHtml += `
      <div class="border border-dark-border rounded overflow-hidden">
        <!-- Model Header -->
        <div class="bg-gradient-to-r from-indigo-900/30 to-indigo-800/30 px-4 py-3 border-b border-dark-border">
          <div class="font-semibold text-dark-text">${modelGroup.modelName}</div>
          <div class="text-xs font-mono text-dark-text-secondary mt-1">${modelGroup.modelId}</div>
          <div class="text-xs text-dark-text-secondary mt-1">${modelGroup.properties.length} propert${modelGroup.properties.length !== 1 ? 'ies' : 'y'}</div>
        </div>
        
        <!-- Properties table -->
        <table class="min-w-full text-xs table-fixed">
          <colgroup>
            <col style="width: 25%">
            <col style="width: 35%">
            <col style="width: 20%">
            <col style="width: 20%">
          </colgroup>
          <thead class="bg-dark-bg/50">
            <tr>
              <th class="px-3 py-2 text-left font-semibold text-dark-text cursor-pointer hover:bg-dark-bg/50 select-none" 
                  data-column="category" data-direction="${sortColumn === 'category' ? (sortDirection === 'asc' ? 'desc' : 'asc') : 'asc'}">
                <div class="flex items-center gap-1">
                  <span>Category</span>
                  ${sortColumn === 'category' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                </div>
              </th>
              <th class="px-3 py-2 text-left font-semibold text-dark-text cursor-pointer hover:bg-dark-bg/50 select-none" 
                  data-column="name" data-direction="${sortColumn === 'name' ? (sortDirection === 'asc' ? 'desc' : 'asc') : 'asc'}">
                <div class="flex items-center gap-1">
                  <span>Name</span>
                  ${sortColumn === 'name' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                </div>
              </th>
              <th class="px-3 py-2 text-left font-semibold text-dark-text font-mono cursor-pointer hover:bg-dark-bg/50 select-none" 
                  data-column="id" data-direction="${sortColumn === 'id' ? (sortDirection === 'asc' ? 'desc' : 'asc') : 'asc'}">
                <div class="flex items-center gap-1">
                  <span>ID</span>
                  ${sortColumn === 'id' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                </div>
              </th>
              <th class="px-3 py-2 text-right font-semibold text-dark-text cursor-pointer hover:bg-dark-bg/50 select-none" 
                  data-column="count" data-direction="${sortColumn === 'count' ? (sortDirection === 'asc' ? 'desc' : 'asc') : 'desc'}">
                <div class="flex items-center justify-end gap-1">
                  <span>Count</span>
                  ${sortColumn === 'count' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                </div>
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-dark-border">
    `;
    
    modelGroup.properties.forEach(prop => {
      tableHtml += `
        <tr class="hover:bg-dark-bg/30 bg-dark-card" data-property-id="${prop.id}">
          <td class="px-3 py-2 text-dark-text">${prop.category}</td>
          <td class="px-3 py-2 text-dark-text">${prop.name}</td>
          <td class="px-3 py-2 text-dark-text-secondary font-mono">${prop.id}</td>
          <td class="px-3 py-2 text-right text-dark-text font-semibold">
            <button class="tagged-asset-count-btn text-tandem-blue hover:text-blue-600 hover:underline cursor-pointer" 
                    data-property-id="${prop.id}"
                    data-property-name="${prop.category}.${prop.name}"
                    title="Click to view ${prop.count} element${prop.count !== 1 ? 's' : ''}">
              ${prop.count.toLocaleString()}
            </button>
          </td>
        </tr>
      `;
    });
    
    tableHtml += `
          </tbody>
        </table>
      </div>
    `;
  }
  
  tableHtml += '</div>';

  tableContainer.innerHTML = tableHtml;

  // Add click handlers for table headers
  const headers = tableContainer.querySelectorAll('th[data-column]');
  headers.forEach(header => {
    header.addEventListener('click', () => {
      const column = header.getAttribute('data-column');
      const direction = header.getAttribute('data-direction');
      renderTaggedAssetsTable(propertyDetails, column, direction, facilityURN, region);
    });
  });

  // Add click handlers for count buttons
  const countButtons = tableContainer.querySelectorAll('.tagged-asset-count-btn');
  countButtons.forEach(button => {
    button.addEventListener('click', async () => {
      const propertyId = button.getAttribute('data-property-id');
      const propertyName = button.getAttribute('data-property-name');
      
      if (!facilityURN || !propertyId) {
        console.error('Missing facilityURN or propertyId');
        return;
      }
      
      // Show loading state
      const originalText = button.textContent;
      button.textContent = '...';
      button.disabled = true;
      
      try {
        // Fetch element keys grouped by model
        const elementsByModel = await getElementsByProperty(facilityURN, region, propertyId);
        
        if (elementsByModel.length === 0) {
          alert('No elements found with this property');
          return;
        }
        
        // Open details page directly
        viewAssetDetails(elementsByModel, `Asset Details: ${propertyName}`, facilityURN, region);
      } catch (error) {
        console.error('Error fetching elements:', error);
        alert('Failed to fetch element keys. See console for details.');
      } finally {
        // Restore button state
        button.textContent = originalText;
        button.disabled = false;
      }
    });
  });
}

/**
 * Display tagged assets count and property details
 * @param {HTMLElement} container - DOM element to render into
 * @param {string} facilityURN - Facility URN
 * @param {Array} models - Array of model objects
 * @param {string} region - Region identifier
 */
export async function displayTaggedAssets(container, facilityURN, models, region) {
  if (!models || models.length === 0) {
    container.innerHTML = '<p class="text-dark-text-secondary">No models found in this facility.</p>';
    return;
  }

  // Show loading state
  container.innerHTML = `
    <div class="flex items-center space-x-2">
      <div class="text-xl font-bold text-tandem-blue">
        <span class="inline-block animate-pulse">...</span>
      </div>
      <div class="text-sm text-dark-text-secondary">
        <div>Calculating tagged assets...</div>
      </div>
    </div>
  `;

  try {
    // Fetch tagged assets details AND collect element keys in one pass
    const details = await getTaggedAssetsDetails(facilityURN, region, true);
    const schemaCache = getSchemaCache();
    
    // Build header with Asset Details button and toggle button
    let headerHtml = `
      <div class="flex items-center justify-between mb-3">
        <div class="flex items-center space-x-2">
          <div class="text-xl font-bold text-tandem-blue">${details.totalCount.toLocaleString()}</div>
          <div class="text-sm text-dark-text-secondary">
            <div>Element${details.totalCount !== 1 ? 's' : ''} designated as assets</div>
          </div>
        </div>
        <div class="flex items-center space-x-3">
          <button id="taggedAssets-asset-details-btn"
                  class="inline-flex items-center px-3 py-2 border border-tandem-blue text-xs font-medium rounded text-tandem-blue hover:bg-tandem-blue hover:text-white transition"
                  title="View detailed information">
            <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
            </svg>
            Details
          </button>
          <button id="toggle-taggedAssets-btn"
                  class="p-2 hover:bg-dark-bg/50 rounded transition"
                  title="Show more">
            <svg id="toggle-taggedAssets-icon-down" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
            </svg>
            <svg id="toggle-taggedAssets-icon-up" class="w-5 h-5 hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"></path>
            </svg>
          </button>
        </div>
      </div>
    `;
    
    // Build summary view (collapsed state)
    let summaryHtml = `
      <div id="taggedAssets-summary"></div>
    `;
    
    // Build detailed view
    let detailHtml = '<div id="taggedAssets-detail" class="hidden">';
    
    // If we have property details, show a table
    const hasPropertyData = details.propertyUsageByModel &&
      Object.keys(details.propertyUsageByModel).length > 0;
    let propertyDetails = [];

    if (hasPropertyData) {
      // Build property details using each model's own schema — this avoids
      // cross-model mismatches and filters out internal system columns (e.g. z:z)
      // that don't appear in any schema.
      for (const modelId in details.propertyUsageByModel) {
        const { modelName: rawModelName, props } = details.propertyUsageByModel[modelId];
        const schema = schemaCache[modelId];
        const modelRecord = models.find(m => m.modelId === modelId);
        const modelName = modelRecord?.label || rawModelName ||
          (isDefaultModel(facilityURN, modelId) ? 'Default Model' : 'Unknown Model');

        for (const propId in props) {
          if (!schema) continue; // schema not loaded — skip rather than show Unknown
          const attr = schema.lookup.get(propId);
          if (!attr) continue; // not a user-defined schema property — skip system columns

          propertyDetails.push({
            id: propId,
            category: attr.category || 'Unknown',
            name: attr.name || propId,
            count: props[propId],
            modelId,
            modelName
          });
        }
      }

      detailHtml += `
        <div class="mt-3 overflow-x-auto">
          <p class="text-xs text-dark-text-secondary mb-2">
            Count shows how many tagged assets have each property.
            Assets with multiple properties are counted once per property.
          </p>
          <div id="taggedAssets-table"></div>
        </div>
      `;
    } else {
      detailHtml += '<p class="text-dark-text-secondary mt-3">No asset-designated elements found.</p>';
    }
    
    detailHtml += '</div>';
    
    container.innerHTML = headerHtml + summaryHtml + detailHtml;
    
    // Render the sortable table (default sort by count descending)
    if (propertyDetails.length > 0) {
      renderTaggedAssetsTable(propertyDetails, 'count', 'desc', facilityURN, region);
    }
    
    // Attach toggle event listener
    const toggleBtn = document.getElementById('toggle-taggedAssets-btn');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', toggleTaggedAssetsDetail);
    }
    
    // Attach Asset Details button event listener
    const assetDetailsBtn = document.getElementById('taggedAssets-asset-details-btn');
    if (assetDetailsBtn) {
      assetDetailsBtn.addEventListener('click', () => {
        // Use the cached elementsByModel data from initial load
        if (!details.elementsByModel || details.elementsByModel.length === 0) {
          alert('No tagged assets found');
          return;
        }
        
        // Open Details page with cached data (no additional API calls!)
        viewAssetDetails(details.elementsByModel, `Tagged Asset Details`, facilityURN, region);
      });
    }
  } catch (error) {
    console.error('Error fetching tagged assets:', error);
    container.innerHTML = '<p class="text-dark-text-secondary">Error loading tagged assets.</p>';
  }
}

