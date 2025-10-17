import { formatUnitName } from '../utils.js';
import { createToggleFunction } from '../components/toggleHeader.js';
import { viewAssetDetails } from './assetDetails.js';

/**
 * Toggle rooms detail view
 */
const toggleRoomsDetail = createToggleFunction({
  detailId: 'rooms-detail',
  summaryId: 'rooms-summary',
  toggleBtnId: 'toggle-rooms-btn',
  iconDownId: 'toggle-rooms-icon-down',
  iconUpId: 'toggle-rooms-icon-up'
});

/**
 * Display rooms list with details and sorting
 * @param {HTMLElement} container - DOM element to render into
 * @param {Array} rooms - Array of room objects
 * @param {string} sortBy - Sort by 'name' or 'area' (default: null for no sorting)
 * @param {string} sortDirection - 'asc' or 'desc' (default: 'asc')
 */
export async function displayRooms(container, rooms, sortBy = null, sortDirection = 'asc') {
  if (!rooms || rooms.length === 0) {
    container.innerHTML = '<p class="text-dark-text-secondary">No rooms or spaces found in this facility.</p>';
    return;
  }

  // Check if detail section is currently visible (to preserve state after re-render)
  const detailSection = document.getElementById('rooms-detail');
  const isDetailVisible = detailSection && !detailSection.classList.contains('hidden');

  // Build header with toggle button and sort controls
  let headerHtml = `
    <div class="flex items-center justify-between mb-3">
      <div class="flex items-center space-x-2">
        <div class="text-xl font-bold text-tandem-blue">${rooms.length}</div>
        <div class="text-sm text-dark-text-secondary">
          <div>Room${rooms.length !== 1 ? 's' : ''} & Space${rooms.length !== 1 ? 's' : ''}</div>
        </div>
      </div>
      <div class="flex items-center space-x-3">
        <div class="flex items-center space-x-2 text-sm border-r border-dark-border pr-3">
          <span class="text-dark-text-secondary">Sort:</span>
          <select id="rooms-sort-select" class="px-3 py-1.5 border border-dark-border rounded text-sm focus:outline-none focus:ring-2 focus:ring-tandem-blue bg-dark-card">
            <option value="">None</option>
            <option value="name" ${sortBy === 'name' ? 'selected' : ''}>Name ${sortBy === 'name' ? (sortDirection === 'asc' ? '(A→Z)' : '(Z→A)') : ''}</option>
            <option value="area" ${sortBy === 'area' ? 'selected' : ''}>Area ${sortBy === 'area' ? (sortDirection === 'asc' ? '(↑)' : '(↓)') : ''}</option>
          </select>
          <button id="rooms-sort-direction" 
                  class="px-2 py-1 text-xs font-medium rounded transition ${!sortBy ? 'bg-gray-500/20 text-gray-300-secondary cursor-not-allowed' : 'bg-tandem-blue text-white hover:bg-blue-700'}"
                  title="${sortDirection === 'asc' ? 'Switch to Descending' : 'Switch to Ascending'}"
                  ${!sortBy ? 'disabled' : ''}>
            ${sortDirection === 'asc' ? 'A→Z / ↑' : 'Z→A / ↓'}
          </button>
        </div>
        <button id="rooms-asset-details-btn"
                class="inline-flex items-center px-3 py-2 border border-tandem-blue text-xs font-medium rounded text-tandem-blue hover:bg-tandem-blue hover:text-white transition"
                title="View detailed information">
          <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
          </svg>
          Details
        </button>
        <button id="toggle-rooms-btn"
                class="p-2 hover:bg-dark-bg/50 rounded transition"
                title="${isDetailVisible ? 'Show less' : 'Show more'}">
          <svg id="toggle-rooms-icon-down" class="w-5 h-5 ${isDetailVisible ? 'hidden' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
          </svg>
          <svg id="toggle-rooms-icon-up" class="w-5 h-5 ${isDetailVisible ? '' : 'hidden'}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"></path>
          </svg>
        </button>
      </div>
    </div>
  `;
  
  // Build summary view (collapsed state, hide if detail is visible)
  let summaryHtml = `
    <div id="rooms-summary" class="${isDetailVisible ? 'hidden' : ''}"></div>
  `;

  // Group rooms by model
  const roomsByModel = {};
  rooms.forEach(room => {
    if (!roomsByModel[room.modelId]) {
      roomsByModel[room.modelId] = {
        modelName: room.modelName,
        modelId: room.modelId,
        rooms: []
      };
    }
    roomsByModel[room.modelId].rooms.push(room);
  });

  // Sort rooms within each model group if sortBy is specified
  if (sortBy) {
    for (const modelId in roomsByModel) {
      const modelGroup = roomsByModel[modelId];
      modelGroup.rooms.sort((a, b) => {
        let aVal, bVal;
        
        if (sortBy === 'name') {
          aVal = (a.name || '').toLowerCase();
          bVal = (b.name || '').toLowerCase();
        } else if (sortBy === 'area') {
          // Treat null/undefined as 0 for sorting
          aVal = a.area !== null && a.area !== undefined ? a.area : 0;
          bVal = b.area !== null && b.area !== undefined ? b.area : 0;
        }
        
        if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }
  }

  // Build detailed view grouped by model (show if it was visible before)
  let detailHtml = `<div id="rooms-detail" class="${isDetailVisible ? '' : 'hidden'} space-y-2">`;
  
  let roomCounter = 0;
  for (const modelId in roomsByModel) {
    const modelGroup = roomsByModel[modelId];
    
    // Count rooms vs spaces in this model
    const modelRoomCount = modelGroup.rooms.filter(r => r.type === 'Room').length;
    const modelSpaceCount = modelGroup.rooms.filter(r => r.type === 'Space').length;
    
    detailHtml += `
      <div class="border border-dark-border rounded overflow-hidden">
        <!-- Model Header -->
        <div class="bg-gradient-to-r from-indigo-900/30 to-indigo-800/30 px-4 py-3 border-b border-dark-border">
          <div class="font-semibold text-dark-text">${modelGroup.modelName}</div>
          <div class="text-xs font-mono text-dark-text-secondary mt-1">${modelGroup.modelId}</div>
          <div class="text-xs text-dark-text-secondary mt-1">${modelRoomCount} room${modelRoomCount !== 1 ? 's' : ''}, ${modelSpaceCount} space${modelSpaceCount !== 1 ? 's' : ''}</div>
        </div>
        
        <!-- Rooms/Spaces in this model -->
        <div class="divide-y divide-dark-border">
    `;
    
    modelGroup.rooms.forEach(room => {
      roomCounter++;
      const isSpace = room.type === 'Space';
      
      // Format additional properties inline
      const propsArray = [];
      if (room.area !== undefined && room.area !== null) {
        const areaUnitFormatted = formatUnitName(room.areaUnit);
        propsArray.push(`${room.area.toFixed(2)} ${areaUnitFormatted}`);
      }
      if (room.volume !== undefined && room.volume !== null) {
        const volumeUnitFormatted = formatUnitName(room.volumeUnit);
        propsArray.push(`${room.volume.toFixed(2)} ${volumeUnitFormatted}`);
      }
      
      const propsDisplay = propsArray.length > 0
        ? `<span class="text-sm text-dark-text-secondary ml-3">• ${propsArray.join(' • ')}</span>`
        : '';
      
      detailHtml += `
        <div class="p-3 hover:bg-dark-bg/30 transition bg-dark-card">
          <div class="flex items-start space-x-3">
            <div class="flex-shrink-0 w-7 h-7 bg-gradient-to-br ${isSpace ? 'from-orange-500 to-orange-600' : 'from-indigo-500 to-indigo-600'} rounded flex items-center justify-center">
              <span class="text-white font-semibold text-xs">${roomCounter}</span>
            </div>
            <div class="flex-grow min-w-0">
              <div class="flex items-baseline flex-wrap gap-2">
                <span class="font-semibold text-dark-text">${room.name}</span>
                <span class="px-2 py-0.5 text-xs font-medium ${isSpace ? 'bg-orange-500/20 text-orange-300' : 'bg-indigo-500/20 text-indigo-300'} rounded">${room.type}</span>
                <span class="text-xs font-mono text-dark-text-secondary">${room.key}</span>
              </div>
              ${propsDisplay}
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
  
  // Store rooms data for re-sorting
  container.dataset.roomsData = JSON.stringify(rooms);
  
  const toggleBtn = document.getElementById('toggle-rooms-btn');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', toggleRoomsDetail);
  }
  
  // Add sort controls event listeners
  const sortSelect = document.getElementById('rooms-sort-select');
  const sortDirectionBtn = document.getElementById('rooms-sort-direction');
  
  if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
      const newSortBy = e.target.value || null;
      displayRooms(container, rooms, newSortBy, sortDirection);
    });
  }
  
  if (sortDirectionBtn) {
    sortDirectionBtn.addEventListener('click', () => {
      if (sortBy) {
        const newDirection = sortDirection === 'asc' ? 'desc' : 'asc';
        displayRooms(container, rooms, sortBy, newDirection);
      }
    });
  }
  
  // Add Asset Details button event listener
  const assetDetailsBtn = document.getElementById('rooms-asset-details-btn');
  if (assetDetailsBtn) {
    assetDetailsBtn.addEventListener('click', () => {
      // Group rooms by model for Asset Details view
      const elementsByModel = [];
      const modelMap = new Map();
      
      rooms.forEach(room => {
        if (!modelMap.has(room.modelId)) {
          modelMap.set(room.modelId, {
            modelURN: room.modelId,
            modelName: room.modelName || 'Unknown Model',
            keys: []
          });
        }
        modelMap.get(room.modelId).keys.push(room.key);
      });
      
      // Convert map to array
      modelMap.forEach(model => elementsByModel.push(model));
      
      // Open Details page
      viewAssetDetails(elementsByModel, `Room & Space Details`);
    });
  }
}

