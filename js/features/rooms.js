import { formatUnitName } from '../utils.js';
import { createToggleFunction } from '../components/toggleHeader.js';
import { viewAssetDetails } from './assetDetails.js';
import { viewRoomTreemap } from './roomTreemap.js';

// Listen for messages from bar chart window to open room details
window.addEventListener('message', (event) => {
  if (event.data.type === 'openRoomDetails') {
    const room = event.data.room;
    // Open Asset Details for this single room
    const elementsByModel = [{
      modelURN: room.modelId,
      modelName: room.modelName || 'Unknown Model',
      keys: [room.key]
    }];
    viewAssetDetails(elementsByModel, `Details: ${room.name}`);
  }
});

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
 * @param {string} sortColumn - Sort by 'name', 'type', 'area', or 'volume' (default: null for no sorting)
 * @param {string} sortDirection - 'asc' or 'desc' (default: 'asc')
 */
export async function displayRooms(container, rooms, sortColumn = null, sortDirection = 'asc') {
  if (!rooms || rooms.length === 0) {
    container.innerHTML = '<p class="text-dark-text-secondary">No rooms or spaces found in this facility.</p>';
    return;
  }

  // Calculate overall statistics
  const totalRooms = rooms.filter(r => r.type === 'Room').length;
  const totalSpaces = rooms.filter(r => r.type === 'Space').length;
  
  // Calculate area stats (only for rooms/spaces with area)
  const roomsWithArea = rooms.filter(r => r.area !== null && r.area !== undefined);
  const totalArea = roomsWithArea.length > 0 
    ? roomsWithArea.reduce((sum, r) => sum + r.area, 0) 
    : 0;
  const avgArea = roomsWithArea.length > 0 ? totalArea / roomsWithArea.length : 0;
  const areaUnit = roomsWithArea[0]?.areaUnit || 'm²';
  
  // Check if detail section is currently visible (to preserve state after re-render)
  const detailSection = document.getElementById('rooms-detail');
  const isDetailVisible = detailSection && !detailSection.classList.contains('hidden');

  // Build header with stats and action buttons
  let headerHtml = `
    <div class="flex items-center justify-between mb-3">
      <div class="flex items-center space-x-6">
        <div>
          <div class="text-xs text-dark-text-secondary uppercase tracking-wide">Total</div>
          <div class="text-xl font-bold text-tandem-blue">${rooms.length}</div>
        </div>
        <div class="text-dark-text-secondary text-xl">|</div>
        <div>
          <div class="text-xs text-dark-text-secondary uppercase tracking-wide">Rooms</div>
          <div class="text-xl font-bold text-indigo-400">${totalRooms}</div>
        </div>
        <div>
          <div class="text-xs text-dark-text-secondary uppercase tracking-wide">Spaces</div>
          <div class="text-xl font-bold text-orange-400">${totalSpaces}</div>
        </div>
        ${roomsWithArea.length > 0 ? `
          <div class="text-dark-text-secondary text-xl">|</div>
          <div>
            <div class="text-xs text-dark-text-secondary uppercase tracking-wide">Total Area</div>
            <div class="text-base font-bold text-tandem-blue">${totalArea.toFixed(2)} ${formatUnitName(areaUnit)}</div>
          </div>
          <div>
            <div class="text-xs text-dark-text-secondary uppercase tracking-wide">Avg Area</div>
            <div class="text-base font-bold text-tandem-blue">${avgArea.toFixed(2)} ${formatUnitName(areaUnit)}</div>
          </div>
        ` : ''}
      </div>
      <div class="flex items-center space-x-3">
        <button id="rooms-visualize-btn"
                class="inline-flex items-center px-3 py-2 border border-tandem-blue text-xs font-medium rounded text-tandem-blue hover:bg-tandem-blue hover:text-white transition"
                title="View size bar chart visualization">
          <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
          </svg>
          Visualize
        </button>
        <button id="rooms-details-btn"
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

  // Sort rooms within each model group if sortColumn is specified
  if (sortColumn) {
    for (const modelId in roomsByModel) {
      const modelGroup = roomsByModel[modelId];
      modelGroup.rooms.sort((a, b) => {
        let aVal, bVal;
        
        if (sortColumn === 'name') {
          aVal = (a.name || '').toLowerCase();
          bVal = (b.name || '').toLowerCase();
        } else if (sortColumn === 'type') {
          aVal = a.type || '';
          bVal = b.type || '';
        } else if (sortColumn === 'area') {
          // Treat null/undefined as -Infinity for sorting (push to bottom)
          aVal = a.area !== null && a.area !== undefined ? a.area : -Infinity;
          bVal = b.area !== null && b.area !== undefined ? b.area : -Infinity;
        } else if (sortColumn === 'volume') {
          // Treat null/undefined as -Infinity for sorting (push to bottom)
          aVal = a.volume !== null && a.volume !== undefined ? a.volume : -Infinity;
          bVal = b.volume !== null && b.volume !== undefined ? b.volume : -Infinity;
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
        
        <!-- Rooms/Spaces table -->
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
              <th class="px-3 py-2 text-left font-semibold text-dark-text cursor-pointer hover:bg-dark-bg/50 select-none" 
                  data-column="type" data-direction="${sortColumn === 'type' ? (sortDirection === 'asc' ? 'desc' : 'asc') : 'asc'}" data-model="${modelId}">
                <div class="flex items-center gap-1">
                  <span>Type</span>
                  ${sortColumn === 'type' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                </div>
              </th>
              <th class="px-3 py-2 text-right font-semibold text-dark-text cursor-pointer hover:bg-dark-bg/50 select-none" 
                  data-column="area" data-direction="${sortColumn === 'area' ? (sortDirection === 'asc' ? 'desc' : 'asc') : 'desc'}" data-model="${modelId}">
                <div class="flex items-center justify-end gap-1">
                  <span>Area</span>
                  ${sortColumn === 'area' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                </div>
              </th>
              <th class="px-3 py-2 text-right font-semibold text-dark-text cursor-pointer hover:bg-dark-bg/50 select-none" 
                  data-column="volume" data-direction="${sortColumn === 'volume' ? (sortDirection === 'asc' ? 'desc' : 'asc') : 'desc'}" data-model="${modelId}">
                <div class="flex items-center justify-end gap-1">
                  <span>Volume</span>
                  ${sortColumn === 'volume' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                </div>
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-dark-border">
    `;
    
    modelGroup.rooms.forEach(room => {
      roomCounter++;
      const isSpace = room.type === 'Space';
      
      // Format area and volume
      const areaDisplay = room.area !== null && room.area !== undefined 
        ? `${room.area.toFixed(2)} ${formatUnitName(room.areaUnit)}` 
        : '-';
      const volumeDisplay = room.volume !== null && room.volume !== undefined 
        ? `${room.volume.toFixed(2)} ${formatUnitName(room.volumeUnit)}` 
        : '-';
      
      detailHtml += `
        <tr class="hover:bg-dark-bg/30 bg-dark-card">
          <td class="px-3 py-2 text-dark-text-secondary">${roomCounter}</td>
          <td class="px-3 py-2 text-dark-text">${room.name}</td>
          <td class="px-3 py-2">
            <span class="px-2 py-0.5 text-xs font-medium ${isSpace ? 'bg-orange-500/20 text-orange-300' : 'bg-indigo-500/20 text-indigo-300'} rounded">${room.type}</span>
          </td>
          <td class="px-3 py-2 text-right text-dark-text font-mono">${areaDisplay}</td>
          <td class="px-3 py-2 text-right text-dark-text font-mono">${volumeDisplay}</td>
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
  
  // Store rooms data for re-sorting
  container.dataset.roomsData = JSON.stringify(rooms);
  
  const toggleBtn = document.getElementById('toggle-rooms-btn');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', toggleRoomsDetail);
  }
  
  // Add table header sorting event listeners
  const headers = container.querySelectorAll('th[data-column]');
  headers.forEach(header => {
    header.addEventListener('click', () => {
      const column = header.getAttribute('data-column');
      const direction = header.getAttribute('data-direction');
      displayRooms(container, rooms, column, direction);
    });
  });
  
  // Add Visualize button event listener
  const visualizeBtn = document.getElementById('rooms-visualize-btn');
  if (visualizeBtn) {
    visualizeBtn.addEventListener('click', () => {
      viewRoomTreemap(rooms);
    });
  }
  
  // Add Details button event listener
  const detailsBtn = document.getElementById('rooms-details-btn');
  if (detailsBtn) {
    detailsBtn.addEventListener('click', () => {
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

