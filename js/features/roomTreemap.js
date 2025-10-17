import { formatUnitName } from '../utils.js';
import { viewAssetDetails } from './assetDetails.js';

/**
 * Generate and open the Room Bar Chart visualization page
 * @param {Array} rooms - Array of room objects with area data
 */
export function viewRoomTreemap(rooms) {
  if (!rooms || rooms.length === 0) {
    alert('No rooms or spaces with area data found.');
    return;
  }

  // Filter rooms that have area data
  const roomsWithArea = rooms.filter(r => r.area !== null && r.area !== undefined && r.area > 0);
  
  if (roomsWithArea.length === 0) {
    alert('No rooms or spaces have area data to visualize.');
    return;
  }

  // Group by model for hierarchical treemap
  const dataByModel = {};
  roomsWithArea.forEach(room => {
    if (!dataByModel[room.modelId]) {
      dataByModel[room.modelId] = {
        modelName: room.modelName || 'Unknown Model',
        modelId: room.modelId,
        rooms: []
      };
    }
    dataByModel[room.modelId].rooms.push(room);
  });

  const html = generateBarChartHTML(roomsWithArea);
  
  // Create a blob URL instead of using document.write
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
}

/**
 * Generate the complete HTML for the bar chart page
 * @param {Array} rooms - Array of room objects with area data
 * @returns {string} Complete HTML document
 */
function generateBarChartHTML(rooms) {
  // Sort by area descending
  const sortedRooms = [...rooms].sort((a, b) => b.area - a.area);
  const roomsJson = JSON.stringify(sortedRooms);
  
  // Calculate statistics
  const totalRooms = rooms.length;
  const totalArea = rooms.reduce((sum, r) => sum + r.area, 0);
  const avgArea = totalArea / rooms.length;
  const top10Area = sortedRooms.slice(0, 10).reduce((sum, r) => sum + r.area, 0);
  const top10Percent = ((top10Area / totalArea) * 100).toFixed(1);
  
  const areaUnit = rooms[0]?.areaUnit || 'm^2';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Room Size Bar Chart</title>
<style>
body { background: #0f172a; color: #e2e8f0; font-family: system-ui, -apple-system, sans-serif; margin: 0; padding: 0; }
.container { max-width: 1400px; margin: 0 auto; padding: 24px; }
.header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; }
.title { font-size: 30px; font-weight: bold; color: #60a5fa; }
.subtitle { color: #9ca3af; margin-top: 8px; font-size: 14px; }
.stat { font-size: 30px; font-weight: bold; color: #60a5fa; text-align: right; }
.stat-label { font-size: 14px; color: #9ca3af; }
.stats-panel { background: #1f2937; border-radius: 8px; padding: 16px; border: 1px solid #374151; margin-bottom: 16px; display: flex; align-items: center; gap: 24px; font-size: 14px; }
.legend { background: #1f2937; border-radius: 8px; padding: 16px; border: 1px solid #374151; margin-bottom: 16px; display: flex; align-items: center; gap: 24px; font-size: 14px; }
.legend-item { display: flex; align-items: center; }
.legend-color { width: 16px; height: 16px; border-radius: 4px; margin-right: 8px; }
.room-color { background: linear-gradient(to bottom right, #6366f1, #8b5cf6); }
.space-color { background: linear-gradient(to bottom right, #f97316, #ea580c); }
.controls { background: #1f2937; border-radius: 8px; padding: 12px 16px; border: 1px solid #374151; margin-bottom: 16px; display: flex; align-items: center; gap: 16px; font-size: 14px; }
.sort-btn { padding: 6px 12px; border-radius: 6px; border: 1px solid #374151; background: #1e293b; color: #e2e8f0; cursor: pointer; transition: all 0.2s; font-size: 12px; }
.sort-btn:hover { background: #3b82f6; border-color: #3b82f6; }
.sort-btn.active { background: #3b82f6; border-color: #3b82f6; font-weight: 600; }
#chart-container { background: #1f2937; border-radius: 8px; border: 1px solid #374151; padding: 16px; max-height: 70vh; overflow-y: auto; padding-left: 50px; }
.bar-row { margin-bottom: 4px; cursor: pointer; position: relative; }
.bar-row:hover .bar-wrapper { opacity: 0.9; }
.bar-wrapper { position: relative; height: 24px; background: #0f172a; border-radius: 4px; display: flex; align-items: center; }
.bar { height: 100%; border-radius: 4px; transition: width 0.3s ease; position: absolute; left: 0; top: 0; }
.bar-room { background: linear-gradient(to right, #6366f1, #8b5cf6); }
.bar-space { background: linear-gradient(to right, #f97316, #ea580c); }
.bar-labels { position: absolute; left: 8px; top: 0; height: 100%; display: flex; align-items: center; justify-content: space-between; width: calc(100% - 16px); pointer-events: none; z-index: 2; }
.bar-name { font-weight: 500; font-size: 12px; color: white; text-shadow: 1px 1px 2px rgba(0,0,0,0.8); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 60%; }
.bar-area { font-weight: 600; font-size: 12px; color: white; text-shadow: 1px 1px 2px rgba(0,0,0,0.8); white-space: nowrap; }
.bar-index { position: absolute; left: -42px; top: 50%; transform: translateY(-50%); color: #64748b; font-size: 11px; font-weight: 600; width: 35px; text-align: right; }
</style>
</head>
<body>
<div class="container">
<div class="header">
<div>
<div class="title">Room & Space Size Visualization</div>
<div class="subtitle">Each bar represents a room/space sized proportionally to its area</div>
</div>
<div>
<div class="stat">${totalRooms}</div>
<div class="stat-label">Rooms/Spaces with Area Data</div>
</div>
</div>
<div class="legend">
<div class="legend-item">
<div class="legend-color room-color"></div>
<span>Rooms</span>
</div>
<div class="legend-item">
<div class="legend-color space-color"></div>
<span>Spaces</span>
</div>
<div style="margin-left: auto; color: #9ca3af;">Click any bar to view details</div>
</div>
<div class="stats-panel">
<div>
<div style="color: #94a3b8; font-size: 12px;">Total Area</div>
<div style="color: #e2e8f0; font-weight: 600; margin-top: 4px;">${totalArea.toFixed(1)} ${areaUnit.replace(/\^2/, '²')}</div>
</div>
<div>
<div style="color: #94a3b8; font-size: 12px;">Average Area</div>
<div style="color: #e2e8f0; font-weight: 600; margin-top: 4px;">${avgArea.toFixed(1)} ${areaUnit.replace(/\^2/, '²')}</div>
</div>
<div>
<div style="color: #94a3b8; font-size: 12px;">Top 10 Rooms</div>
<div style="color: #e2e8f0; font-weight: 600; margin-top: 4px;">${top10Percent}% of total area</div>
</div>
</div>
<div class="controls">
<span style="color: #94a3b8;">Sort by:</span>
<button class="sort-btn active" onclick="sortRooms('area')">Largest First</button>
<button class="sort-btn" onclick="sortRooms('area-asc')">Smallest First</button>
<button class="sort-btn" onclick="sortRooms('name')">Name (A-Z)</button>
<button class="sort-btn" onclick="sortRooms('type')">Type (Room/Space)</button>
</div>
<div id="chart-container"></div>
</div>
<script>
const ROOMS = ${roomsJson};
let currentSort = 'area';
let currentRooms = [...ROOMS];

// Find max area for scaling
const maxArea = Math.max(...ROOMS.map(r => r.area));

function renderBars(rooms) {
  const container = document.getElementById('chart-container');
  container.innerHTML = '';
  
  rooms.forEach((room, index) => {
    const barRow = document.createElement('div');
    barRow.className = 'bar-row';
    
    const barWrapper = document.createElement('div');
    barWrapper.className = 'bar-wrapper';
    
    // Background bar (colored)
    const bar = document.createElement('div');
    bar.className = \`bar bar-\${room.type === 'Space' ? 'space' : 'room'}\`;
    
    // Calculate width percentage (minimum 3% for visibility)
    const widthPercent = Math.max(3, (room.area / maxArea) * 100);
    bar.style.width = widthPercent + '%';
    
    // Labels container (always visible, on top of bar)
    const barLabels = document.createElement('div');
    barLabels.className = 'bar-labels';
    
    const barName = document.createElement('div');
    barName.className = 'bar-name';
    barName.textContent = room.name;
    barName.title = room.name; // Tooltip for full name
    
    const barArea = document.createElement('div');
    barArea.className = 'bar-area';
    const areaUnit = room.areaUnit ? room.areaUnit.replace(/\\^2/, '²') : '';
    barArea.textContent = \`\${room.area.toFixed(1)} \${areaUnit}\`;
    
    const barIndex = document.createElement('div');
    barIndex.className = 'bar-index';
    barIndex.textContent = (index + 1).toString();
    
    barLabels.appendChild(barName);
    barLabels.appendChild(barArea);
    barWrapper.appendChild(bar);
    barWrapper.appendChild(barLabels);
    barRow.appendChild(barIndex);
    barRow.appendChild(barWrapper);
    
    // Click handler to open details
    barRow.addEventListener('click', () => {
      openRoomDetails(room);
    });
    
    container.appendChild(barRow);
  });
}

function sortRooms(sortType) {
  currentSort = sortType;
  
  // Update button states
  document.querySelectorAll('.sort-btn').forEach(btn => btn.classList.remove('active'));
  event.target.classList.add('active');
  
  let sorted = [...ROOMS];
  
  switch(sortType) {
    case 'area':
      sorted.sort((a, b) => b.area - a.area);
      break;
    case 'area-asc':
      sorted.sort((a, b) => a.area - b.area);
      break;
    case 'name':
      sorted.sort((a, b) => a.name.localeCompare(b.name));
      break;
    case 'type':
      sorted.sort((a, b) => {
        if (a.type === b.type) return a.name.localeCompare(b.name);
        return a.type === 'Room' ? -1 : 1;
      });
      break;
  }
  
  currentRooms = sorted;
  renderBars(sorted);
}

function openRoomDetails(room) {
  // Send message to opener window to open details
  if (window.opener && !window.opener.closed) {
    window.opener.postMessage({
      type: 'openRoomDetails',
      room: room
    }, '*');
  }
}

// Initial render
renderBars(currentRooms);
console.log(\`Rendered \${ROOMS.length} rooms/spaces\`);
</script>
</body>
</html>`;
}

