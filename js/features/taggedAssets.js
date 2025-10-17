import { createToggleFunction } from '../components/toggleHeader.js';
import { getTaggedAssetsDetails, getElementsByProperty } from '../api.js';
import { getSchemaCache } from '../state/schemaCache.js';
import { showElementListModal } from '../components/elementListModal.js';

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
 * Render sortable tagged assets table
 * @param {Array} propertyDetails - Array of property detail objects
 * @param {string} sortColumn - Column to sort by
 * @param {string} sortDirection - 'asc' or 'desc'
 * @param {string} facilityURN - Facility URN for fetching element keys
 */
function renderTaggedAssetsTable(propertyDetails, sortColumn = 'count', sortDirection = 'desc', facilityURN = null) {
  const tableContainer = document.getElementById('taggedAssets-table');
  if (!tableContainer) return;

  // Sort property details
  let sortedProperties = [...propertyDetails];
  sortedProperties.sort((a, b) => {
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
    } else {
      // String sort for category, name, id
      aVal = (a[sortColumn] || '').toString().toLowerCase();
      bVal = (b[sortColumn] || '').toString().toLowerCase();
      
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    }
  });

  // Build table HTML
  let tableHtml = `
    <table class="min-w-full text-xs">
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
  
  sortedProperties.forEach(prop => {
    tableHtml += `
      <tr class="hover:bg-dark-bg/30" data-property-id="${prop.id}">
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
  `;

  tableContainer.innerHTML = tableHtml;

  // Add click handlers for table headers
  const headers = tableContainer.querySelectorAll('th[data-column]');
  headers.forEach(header => {
    header.addEventListener('click', () => {
      const column = header.getAttribute('data-column');
      const direction = header.getAttribute('data-direction');
      renderTaggedAssetsTable(propertyDetails, column, direction, facilityURN);
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
        const elementsByModel = await getElementsByProperty(facilityURN, propertyId);
        
        if (elementsByModel.length === 0) {
          alert('No elements found with this property');
          return;
        }
        
        // Calculate total count
        const totalCount = elementsByModel.reduce((sum, model) => sum + model.keys.length, 0);
        
        // Show modal with grouped element keys
        showElementListModal(elementsByModel, `Elements with ${propertyName} (${totalCount} total)`);
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
 */
export async function displayTaggedAssets(container, facilityURN, models) {
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
    // Fetch tagged assets details
    const details = await getTaggedAssetsDetails(facilityURN);
    const schemaCache = getSchemaCache();
    
    // Build header with toggle button
    let headerHtml = `
      <div class="flex items-center justify-between mb-3">
        <div class="flex items-center space-x-2">
          <div class="text-xl font-bold text-tandem-blue">${details.totalCount.toLocaleString()}</div>
          <div class="text-sm text-dark-text-secondary">
            <div>Element${details.totalCount !== 1 ? 's' : ''} with user-defined properties</div>
          </div>
        </div>
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
    `;
    
    // Build summary view (collapsed state)
    let summaryHtml = `
      <div id="taggedAssets-summary"></div>
    `;
    
    // Build detailed view
    let detailHtml = '<div id="taggedAssets-detail" class="hidden">';
    
    // If we have property details, show a table
    const propertyKeys = Object.keys(details.propertyUsage);
    let propertyDetails = [];
    
    if (propertyKeys.length > 0) {
      // Build array of property info with schema lookups
      propertyDetails = propertyKeys.map(propId => {
        let category = '';
        let name = '';
        
        // Look up in schema cache across all models
        for (const modelId in schemaCache) {
          const schema = schemaCache[modelId];
          const attr = schema.lookup.get(propId);
          if (attr) {
            category = attr.category || '';
            name = attr.name || '';
            break;
          }
        }
        
        return {
          id: propId,
          category: category || 'Unknown',
          name: name || 'Unknown',
          count: details.propertyUsage[propId]
        };
      });
      
      detailHtml += `
        <div class="mt-3 overflow-x-auto">
          <div id="taggedAssets-table"></div>
        </div>
      `;
    } else {
      detailHtml += '<p class="text-dark-text-secondary mt-3">No user-defined properties found.</p>';
    }
    
    detailHtml += '</div>';
    
    container.innerHTML = headerHtml + summaryHtml + detailHtml;
    
    // Render the sortable table (default sort by count descending)
    if (propertyKeys.length > 0) {
      renderTaggedAssetsTable(propertyDetails, 'count', 'desc', facilityURN);
    }
    
    // Attach toggle event listener
    const toggleBtn = document.getElementById('toggle-taggedAssets-btn');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', toggleTaggedAssetsDetail);
    }
  } catch (error) {
    console.error('Error fetching tagged assets:', error);
    container.innerHTML = '<p class="text-dark-text-secondary">Error loading tagged assets.</p>';
  }
}

