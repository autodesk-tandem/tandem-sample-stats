import { tandemBaseURL, makeRequestOptionsPOST } from '../api.js';
import { QC, ColumnFamilies } from '../../tandem/constants.js';
import { getSchemaCache } from '../state/schemaCache.js';

/**
 * Generate HTML page for asset details
 * @param {Array<{modelURN: string, modelName: string, keys: Array<string>}>} elementsByModel - Elements grouped by model
 * @param {string} title - Page title
 * @returns {string} HTML page content
 */
function generateAssetDetailsHTML(elementsByModel, title) {
  // Embed all data as JSON for client-side processing
  const dataJSON = JSON.stringify(elementsByModel).replace(/</g, '\\u003c').replace(/>/g, '\\u003e');
  const tokenValue = window.sessionStorage.token || '';
  
  // Get and embed schema cache for property lookups
  // Convert Map to object for JSON serialization
  const schemaCache = getSchemaCache();
  const schemaCacheForJSON = {};
  
  for (const [modelURN, schema] of Object.entries(schemaCache)) {
    schemaCacheForJSON[modelURN] = {
      attributes: schema.attributes,
      lookup: schema.lookup ? Object.fromEntries(schema.lookup) : {}
    };
  }
  
  const schemaCacheJSON = JSON.stringify(schemaCacheForJSON).replace(/</g, '\\u003c').replace(/>/g, '\\u003e');
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Asset Details</title>
  <script src="https://unpkg.com/xlsx-js-style@1.2.0/dist/xlsx.bundle.js"></script>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background-color: #1a1a1a;
      color: #e0e0e0;
      padding: 20px;
    }
    .container {
      max-width: 1400px;
      margin: 0 auto;
    }
    .header {
      background: #2a2a2a;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 20px;
      border: 1px solid #404040;
    }
    .header-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
    }
    h1 {
      margin: 0;
      color: #0696D7;
      font-size: 24px;
      font-weight: 600;
    }
    .export-btn {
      background: #0696D7;
      color: white;
      border: none;
      padding: 0 16px;
      border-radius: 4px;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.2s;
      display: flex;
      align-items: center;
      gap: 6px;
      height: 36px;
      min-width: 160px;
    }
    .export-btn:hover {
      background: #0580b8;
    }
    .export-btn:disabled {
      background: #404040;
      cursor: not-allowed;
    }
    .info {
      font-size: 12px;
      color: #a0a0a0;
    }
    .stats {
      display: flex;
      gap: 30px;
      margin-top: 20px;
    }
    .stat-item {
      display: flex;
      flex-direction: column;
    }
    .stat-label {
      font-size: 11px;
      color: #808080;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .stat-value {
      font-size: 24px;
      font-weight: 600;
      color: #0696D7;
    }
    .loading {
      text-align: center;
      padding: 40px;
      color: #0696D7;
      font-size: 16px;
    }
    .model-section {
      background: #2a2a2a;
      border-radius: 8px;
      border: 1px solid #404040;
      overflow: hidden;
      margin-bottom: 20px;
    }
    .model-header {
      background: linear-gradient(to right, rgba(67, 56, 202, 0.3), rgba(67, 56, 202, 0.3));
      padding: 12px 20px;
      border-bottom: 1px solid #404040;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .model-header-left {
      flex: 1;
    }
    .model-name {
      font-size: 16px;
      font-weight: 600;
      color: #e0e0e0;
    }
    .model-urn {
      font-size: 12px;
      font-family: 'Courier New', monospace;
      color: #a0a0a0;
      margin-top: 4px;
    }
    .model-count {
      font-size: 12px;
      color: #a0a0a0;
      margin-top: 4px;
    }
    .view-keys-btn {
      background: #0696D7;
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 4px;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.2s;
      height: 36px;
      min-width: 110px;
    }
    .view-keys-btn:hover {
      background: #0580b8;
    }
    .elements-list {
      padding: 0;
    }
    .element-item {
      border-bottom: 1px solid #404040;
    }
    .element-item:last-child {
      border-bottom: none;
    }
    .element-header {
      padding: 12px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      cursor: pointer;
      transition: background 0.2s;
    }
    .element-header:hover {
      background: #333333;
    }
    .element-basic-info {
      flex: 1;
    }
    .element-name {
      font-size: 14px;
      font-weight: 600;
      color: #e0e0e0;
      margin-bottom: 4px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .category-badge {
      display: inline-block;
      padding: 2px 8px;
      font-size: 11px;
      font-weight: 500;
      background: linear-gradient(to right, rgba(6, 150, 215, 0.3), rgba(6, 150, 215, 0.4));
      color: #4fc3f7;
      border-radius: 4px;
    }
    .classification-badge {
      display: inline-block;
      padding: 2px 8px;
      font-size: 11px;
      font-weight: 500;
      background: linear-gradient(to right, rgba(34, 197, 94, 0.3), rgba(22, 163, 74, 0.3));
      color: #86efac;
      border-radius: 4px;
    }
    .element-key {
      font-size: 11px;
      font-family: 'Courier New', monospace;
      color: #808080;
    }
    .element-toggle {
      padding: 8px 16px;
      background: #0696D7;
      color: white;
      border: none;
      border-radius: 4px;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.2s;
      height: 36px;
      min-width: 110px;
    }
    .element-toggle:hover {
      background: #057ab5;
    }
    .element-toggle.loading {
      background: #666;
      cursor: wait;
    }
    .element-details {
      padding: 16px 20px;
      background: #1a1a1a;
      display: none;
    }
    .element-details.visible {
      display: block;
    }
    .properties-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }
    .properties-table th {
      text-align: left;
      padding: 8px 12px;
      background: #333333;
      border-bottom: 1px solid #404040;
      font-size: 11px;
      font-weight: 600;
      color: #a0a0a0;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      cursor: pointer;
      user-select: none;
      position: relative;
    }
    .properties-table th:hover {
      background: #3a3a3a;
      color: #0696D7;
    }
    .properties-table th.sorted::after {
      content: ' ↑';
      color: #0696D7;
    }
    .properties-table th.sorted-desc::after {
      content: ' ↓';
      color: #0696D7;
    }
    .properties-table td {
      padding: 8px 12px;
      border-bottom: 1px solid #333333;
    }
    .properties-table tr:hover {
      background: #2a2a2a;
    }
    .property-id {
      font-family: 'Courier New', monospace;
      color: #808080;
      font-size: 11px;
    }
    .property-category {
      color: #e0e0e0;
    }
    .property-name {
      color: #e0e0e0;
    }
    .property-value {
      color: #e0e0e0;
      font-family: 'Courier New', monospace;
      word-break: break-all;
    }
    .error-message {
      padding: 20px;
      text-align: center;
      color: #ff6b6b;
    }
    /* Modal styles */
    .keys-modal {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.8);
      z-index: 1000;
      padding: 20px;
      overflow-y: auto;
    }
    .keys-modal.active {
      display: flex;
      justify-content: center;
      align-items: flex-start;
      padding-top: 60px;
    }
    .keys-modal-content {
      background: #2a2a2a;
      border-radius: 8px;
      border: 1px solid #404040;
      max-width: 800px;
      width: 100%;
      max-height: 80vh;
      display: flex;
      flex-direction: column;
    }
    .keys-modal-header {
      padding: 20px;
      border-bottom: 1px solid #404040;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .keys-modal-title {
      font-size: 18px;
      font-weight: 600;
      color: #0696D7;
      margin: 0;
    }
    .keys-modal-close {
      background: none;
      border: none;
      color: #a0a0a0;
      font-size: 24px;
      cursor: pointer;
      padding: 0;
      width: 30px;
      height: 30px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: color 0.2s;
    }
    .keys-modal-close:hover {
      color: #e0e0e0;
    }
    .keys-modal-body {
      padding: 20px;
      overflow-y: auto;
    }
    .keys-modal-subtitle {
      margin-bottom: 15px;
    }
    .keys-modal-model-name {
      font-size: 14px;
      font-weight: 600;
      color: #e0e0e0;
      margin-bottom: 4px;
    }
    .keys-modal-model-urn {
      font-size: 11px;
      color: #a0a0a0;
      font-family: 'Courier New', monospace;
    }
    .keys-textarea {
      width: 100%;
      background: #1a1a1a;
      border: 1px solid #404040;
      border-radius: 4px;
      color: #e0e0e0;
      font-family: 'Courier New', monospace;
      font-size: 12px;
      padding: 10px;
      resize: vertical;
      min-height: 200px;
    }
    .keys-modal-footer {
      padding: 15px 20px;
      border-top: 1px solid #404040;
      display: flex;
      justify-content: flex-end;
      gap: 10px;
    }
    .keys-modal-btn {
      padding: 8px 16px;
      border-radius: 4px;
      font-size: 14px;
      cursor: pointer;
      border: none;
      transition: background 0.2s;
    }
    .keys-modal-btn-primary {
      background: #0696D7;
      color: white;
    }
    .keys-modal-btn-primary:hover {
      background: #0580b8;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="header-top">
        <h1>${title}</h1>
        <button id="export-btn" class="export-btn">
          <span>📊</span>
          <span>Export to Excel</span>
        </button>
      </div>
      <div class="stats">
        <div class="stat-item">
          <span class="stat-label">Total Models</span>
          <span class="stat-value" id="stat-models">0</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Total Elements</span>
          <span class="stat-value" id="stat-elements">0</span>
        </div>
      </div>
    </div>
    
    <div id="content-container">
      <div class="loading">Loading element details...</div>
    </div>
  </div>
  
  <!-- Modal for viewing element keys -->
  <div id="keys-modal" class="keys-modal">
    <div class="keys-modal-content">
      <div class="keys-modal-header">
        <h2 class="keys-modal-title" id="keys-modal-title">Element Keys</h2>
        <button class="keys-modal-close" id="keys-modal-close">&times;</button>
      </div>
      <div class="keys-modal-body">
        <div class="keys-modal-subtitle">
          <div class="keys-modal-model-name" id="keys-modal-model-name"></div>
          <div class="keys-modal-model-urn" id="keys-modal-model-urn"></div>
        </div>
        <textarea readonly class="keys-textarea" id="keys-textarea" rows="15"></textarea>
      </div>
      <div class="keys-modal-footer">
        <button class="keys-modal-btn keys-modal-btn-primary" id="keys-copy-btn">Copy All</button>
      </div>
    </div>
  </div>
  
  <script>
    const DATA = ${dataJSON};
    const API_BASE = '${tandemBaseURL}';
    const TOKEN = '${tokenValue}';
    const SCHEMA_CACHE = ${schemaCacheJSON};
    
    // Track which elements have loaded details
    const loadedDetails = new Map();
    
    // Helper function to look up property display name from schema
    function getPropertyDisplayInfo(modelURN, qualifiedProp) {
      if (!SCHEMA_CACHE[modelURN]) {
        return { category: '', name: qualifiedProp };
      }
      
      const schema = SCHEMA_CACHE[modelURN];
      const attr = schema.lookup?.[qualifiedProp];
      
      if (attr) {
        return {
          category: attr.category || '',
          name: attr.name || qualifiedProp
        };
      }
      
      return { category: '', name: qualifiedProp };
    }
    
    async function fetchElementDetails(modelURN, elementKeys) {
      const payload = JSON.stringify({
        families: ['n', 'r', 'z'],
        keys: elementKeys,
        includeHistory: false
      });
      
      const response = await fetch(API_BASE + '/modeldata/' + modelURN + '/scan', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + TOKEN,
          'Content-Type': 'application/json'
        },
        body: payload
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch details: ' + response.statusText);
      }
      
      const data = await response.json();
      // Filter out version string
      return data.filter(item => typeof item === 'object' && item !== null && item['k']);
    }
    
    async function fetchElementNames(modelURN, elementKeys) {
      const payload = JSON.stringify({
        qualifiedColumns: ['n:c', 'n:!n', 'n:n', 'n:!v', 'n:v'],
        keys: elementKeys,
        includeHistory: false
      });
      
      const response = await fetch(API_BASE + '/modeldata/' + modelURN + '/scan', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + TOKEN,
          'Content-Type': 'application/json'
        },
        body: payload
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch names: ' + response.statusText);
      }
      
      const data = await response.json();
      // Filter out version string - 'k' (key) is always returned automatically
      return data.filter(item => typeof item === 'object' && item !== null && item['k']);
    }
    
    function getCategoryName(categoryId) {
      const categories = {
        10: "Regeneration Failure",
        11: "Walls",
        14: "Windows",
        16: "Glass",
        18: "Frame/Mullion",
        20: "Sill/Head",
        22: "Opening",
        23: "Doors",
        25: "Panel",
        27: "Opening",
        29: "Frame/Mullion",
        31: "Glass",
        32: "Floors",
        35: "Roofs",
        38: "Ceilings",
        80: "Furniture",
        100: "Columns",
        120: "Stairs",
        126: "Railings",
        150: "Generic Annotations",
        151: "Generic Models",
        160: "Rooms",
        170: "Curtain Panels",
        171: "Curtain Wall Mullions",
        180: "Ramps",
        185: "Massing",
        240: "Levels",
        260: "Dimensions",
        280: "Title Blocks",
        300: "Text Notes",
        340: "Curtain Systems",
        400: "Section Marks",
        500: "Cameras",
        510: "Viewports",
        520: "Lights",
        530: "Reference Planes",
        573: "Schedules",
        700: "Materials",
        710: "Reference Points",
        800: "Tile pattern grids",
        1000: "Casework",
        1040: "Electrical Equipment",
        1060: "Electrical Fixtures",
        1100: "Furniture Systems",
        1120: "Lighting Fixtures",
        1140: "Mechanical Equipment",
        1160: "Plumbing Fixtures",
        1180: "Parking",
        1220: "Roads",
        1260: "Site",
        1300: "Structural Foundations",
        1320: "Structural Framing",
        1330: "Structural Columns",
        1336: "Structural Trusses",
        1340: "Topography",
        1350: "Specialty Equipment",
        1360: "Planting",
        1370: "Entourage",
        1390: "Fascias",
        1391: "Gutters",
        1392: "Slab Edges",
        1393: "Roof Soffits",
        2000: "Detail Items",
        3000: "Profiles",
        3100: "Sheets",
        3200: "Areas",
        3400: "Mass",
        3500: "Stacked Walls",
        3600: "Spaces",
        5200: "Structural Loads",
        6000: "Scope Boxes",
        6060: "Revision Clouds",
        8000: "Ducts",
        8010: "Duct Fittings",
        8013: "Air Terminals",
        8016: "Duct Accessories",
        8020: "Flex Ducts",
        8037: "Electrical Circuits",
        8039: "Wires",
        8044: "Pipes",
        8049: "Pipe Fittings",
        8050: "Flex Pipes",
        8055: "Pipe Accessories",
        8099: "Sprinklers",
        8126: "Cable Tray Fittings",
        8128: "Conduit Fittings",
        8130: "Cable Trays",
        8132: "Conduits",
        8193: "MEP Fabrication Ductwork",
        8203: "MEP Fabrication Hangers",
        8208: "MEP Fabrication Pipework",
        8212: "MEP Fabrication Containment",
        8232: "Mechanical Control Devices",
        8234: "Plumbing Equipment",
        9000: "Structural Rebar",
        9003: "Structural Area Reinforcement",
        9009: "Structural Path Reinforcement",
        9016: "Structural Fabric Reinforcement",
        9030: "Structural Connections",
        9060: "Structural Rebar Couplers",
        9630: "Analytical Beams",
        9633: "Analytical Braces",
        9636: "Analytical Columns",
        9639: "Analytical Floors",
        9640: "Analytical Walls",
        9641: "Analytical Isolated Foundations",
        9642: "Analytical Wall Foundations",
        9643: "Analytical Foundation Slabs",
        10001: "Point Clouds",
        [-2000011]: "Walls",
        [-2000014]: "Floors",
        [-2000023]: "Doors",
        [-2000024]: "Windows",
        [-2000032]: "Roofs",
        [-2000035]: "Structural Columns",
        [-2000038]: "Ceilings",
        [-2000080]: "Structural Framing",
        [-2000151]: "Air Terminals",
        [-2000160]: "Rooms",
        [-2000240]: "Levels",
        [-2001040]: "Lighting Fixtures",
        [-2001060]: "Casework",
        [-2001100]: "Entourage",
        [-2001140]: "Mechanical Equipment",
        [-2001150]: "Electrical Equipment",
        [-2001160]: "Plumbing Fixtures",
        [-2008000]: "Ducts",
        [-2008044]: "Duct Fittings",
        [-2008049]: "Duct Accessories",
        [-2008051]: "Mechanical Equipment",
        [-2008127]: "Pipes",
        [-2008128]: "Pipe Fittings",
        [-2008130]: "Pipe Accessories"
      };
      return categories[categoryId] || "Category " + categoryId;
    }
    
    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }
    
    function formatPropertyValue(value) {
      if (value === null || value === undefined) return '-';
      if (Array.isArray(value)) {
        if (value.length === 0) return '-';
        if (value.length === 1) return escapeHtml(String(value[0]));
        return escapeHtml(value.join(', '));
      }
      return escapeHtml(String(value));
    }
    
    function organizeProperties(element, modelURN) {
      const allProperties = [];
      
      for (const [key, value] of Object.entries(element)) {
        if (key === 'k' || !key.includes(':')) continue;
        
        const [family, prop] = key.split(':');
        let familyName = 'Source';
        
        if (family === 'n') {
          familyName = 'Standard';
        } else if (family === 'z') {
          familyName = 'Custom';
        }
        
        // Get display info from schema
        const displayInfo = getPropertyDisplayInfo(modelURN, key);
        
        allProperties.push({
          id: key,
          family: familyName,
          category: displayInfo.category || familyName,
          name: displayInfo.name,
          value: formatPropertyValue(value)
        });
      }
      
      return allProperties;
    }
    
    async function toggleElementDetails(modelURN, elementKey, button, detailsDiv) {
      if (detailsDiv.classList.contains('visible')) {
        // Collapse
        detailsDiv.classList.remove('visible');
        button.textContent = 'Show Details';
        return;
      }
      
      // Check if already loaded
      if (loadedDetails.has(elementKey)) {
        detailsDiv.classList.add('visible');
        button.textContent = 'Hide Details';
        return;
      }
      
      // Load details
      button.textContent = 'Loading...';
      button.classList.add('loading');
      button.disabled = true;
      
      try {
        const elements = await fetchElementDetails(modelURN, [elementKey]);
        if (elements.length === 0) {
          detailsDiv.innerHTML = '<div class="error-message">No details found</div>';
          detailsDiv.classList.add('visible');
          loadedDetails.set(elementKey, true);
          return;
        }
        
        const element = elements[0];
        const properties = organizeProperties(element, modelURN);
        
        // Sort properties by ID by default (with override grouping logic)
        properties.sort((a, b) => {
          const aClean = a.id.replace(/:/g, '').replace(/!/g, '');
          const bClean = b.id.replace(/:/g, '').replace(/!/g, '');
          
          const cleanComparison = aClean.toLowerCase().localeCompare(bClean.toLowerCase());
          if (cleanComparison !== 0) return cleanComparison;
          
          // Non-override before override
          const aHasBang = a.id.includes('!');
          const bHasBang = b.id.includes('!');
          
          if (aHasBang && !bHasBang) return 1;
          if (!aHasBang && bHasBang) return -1;
          return 0;
        });
        
        // Create sortable table
        let html = '<table class="properties-table">';
        html += '<thead><tr>';
        html += '<th data-sort="id" class="sorted">ID</th>';
        html += '<th data-sort="category">Category</th>';
        html += '<th data-sort="name">Property Name</th>';
        html += '<th data-sort="value">Value</th>';
        html += '</tr></thead>';
        html += '<tbody class="properties-tbody">';
        
        properties.forEach(prop => {
          // Escape HTML for display (but not for data attributes - they're safe)
          const idEscaped = escapeHtml(prop.id);
          const categoryEscaped = escapeHtml(prop.category);
          const nameEscaped = escapeHtml(prop.name);
          const valueEscaped = escapeHtml(prop.value);
          
          // Use original values for data attributes (not displayed, used for sorting)
          // Use escaped values for display content
          html += '<tr data-id="' + prop.id.replace(/"/g, '&quot;') + '" data-category="' + prop.category.replace(/"/g, '&quot;') + '" data-name="' + prop.name.replace(/"/g, '&quot;') + '" data-value="' + prop.value.replace(/"/g, '&quot;') + '">';
          html += '<td class="property-id">' + idEscaped + '</td>';
          html += '<td class="property-category">' + categoryEscaped + '</td>';
          html += '<td class="property-name">' + nameEscaped + '</td>';
          html += '<td class="property-value">' + valueEscaped + '</td>';
          html += '</tr>';
        });
        
        html += '</tbody></table>';
        
        detailsDiv.innerHTML = html;
        
        // Add sorting functionality
        const headers = detailsDiv.querySelectorAll('th[data-sort]');
        let currentSort = { column: 'id', direction: 'asc' }; // Start with ID sorted ascending
        
        headers.forEach(header => {
          header.addEventListener('click', () => {
            const sortBy = header.getAttribute('data-sort');
            const tbody = detailsDiv.querySelector('.properties-tbody');
            const rows = Array.from(tbody.querySelectorAll('tr'));
            
            // Toggle direction if same column
            if (currentSort.column === sortBy) {
              currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
            } else {
              currentSort.column = sortBy;
              currentSort.direction = 'asc';
            }
            
            // Update header classes
            headers.forEach(h => {
              h.classList.remove('sorted', 'sorted-desc');
            });
            header.classList.add(currentSort.direction === 'asc' ? 'sorted' : 'sorted-desc');
            
            // Sort rows
            rows.sort((a, b) => {
              let aVal = a.getAttribute('data-' + sortBy) || '';
              let bVal = b.getAttribute('data-' + sortBy) || '';
              
              // Special handling for ID column - ignore "!" for grouping overrides
              if (sortBy === 'id') {
                // Remove "!" from comparison but keep original values for secondary sort
                const aClean = aVal.replace(/:/g, '').replace(/!/g, '');
                const bClean = bVal.replace(/:/g, '').replace(/!/g, '');
                
                // First compare without "!" to group overrides together
                const cleanComparison = aClean.toLowerCase().localeCompare(bClean.toLowerCase());
                
                if (cleanComparison !== 0) {
                  return currentSort.direction === 'asc' ? cleanComparison : -cleanComparison;
                }
                
                // If they're the same after removing "!", sort non-override first
                // This puts "n:v" before "n:!v"
                const aHasBang = aVal.includes('!');
                const bHasBang = bVal.includes('!');
                
                if (aHasBang && !bHasBang) {
                  return currentSort.direction === 'asc' ? 1 : -1;
                } else if (!aHasBang && bHasBang) {
                  return currentSort.direction === 'asc' ? -1 : 1;
                }
                
                return 0;
              }
              
              // Normal string comparison for other columns
              const comparison = aVal.toLowerCase().localeCompare(bVal.toLowerCase());
              return currentSort.direction === 'asc' ? comparison : -comparison;
            });
            
            // Re-append rows
            rows.forEach(row => tbody.appendChild(row));
          });
        });
        detailsDiv.classList.add('visible');
        loadedDetails.set(elementKey, true);
      } catch (error) {
        console.error('Error loading details:', error);
        detailsDiv.innerHTML = '<div class="error-message">Failed to load details</div>';
        detailsDiv.classList.add('visible');
      } finally {
        button.textContent = 'Hide Details';
        button.classList.remove('loading');
        button.disabled = false;
      }
    }
    
    async function loadInitialData() {
      const container = document.getElementById('content-container');
      
      try {
        let totalElements = 0;
        const modelsData = [];
        
        // Fetch names for all models (skip models with no keys)
        for (const modelGroup of DATA) {
          // Skip if no keys provided
          if (!modelGroup.keys || modelGroup.keys.length === 0) {
            console.warn('Skipping model with no keys:', modelGroup.modelName);
            continue;
          }
          
          const elements = await fetchElementNames(modelGroup.modelURN, modelGroup.keys);
          totalElements += elements.length;
          
          modelsData.push({
            modelURN: modelGroup.modelURN,
            modelName: modelGroup.modelName,
            elements: elements
          });
        }
        
        // Update stats (only count models with elements)
        document.getElementById('stat-models').textContent = modelsData.length;
        document.getElementById('stat-elements').textContent = totalElements;
        
        // Render elements
        let html = '';
        
        for (const modelData of modelsData) {
          html += '<div class="model-section">';
          html += '<div class="model-header">';
          html += '<div class="model-header-left">';
          html += '<div class="model-name">' + escapeHtml(modelData.modelName) + '</div>';
          html += '<div class="model-urn">' + escapeHtml(modelData.modelURN) + '</div>';
          html += '<div class="model-count">' + modelData.elements.length + ' element' + (modelData.elements.length !== 1 ? 's' : '') + '</div>';
          html += '</div>';
          html += '<button class="view-keys-btn" data-model-urn="' + modelData.modelURN.replace(/"/g, '&quot;') + '" data-model-name="' + escapeHtml(modelData.modelName) + '">View Keys</button>';
          html += '</div>';
          html += '<div class="elements-list">';
          
          for (const element of modelData.elements) {
            const key = element['k'];
            const name = element['n:!n']?.[0] || element['n:n']?.[0] || 'Unnamed';
            const categoryId = element['n:c']?.[0];
            const categoryName = categoryId ? getCategoryName(categoryId) : 'Unknown';
            const classification = element['n:!v']?.[0] || element['n:v']?.[0];
            
            html += '<div class="element-item">';
            html += '<div class="element-header">';
            html += '<div class="element-basic-info">';
            html += '<div class="element-name">';
            html += '<span>' + escapeHtml(name) + '</span>';
            html += '<span class="category-badge">' + escapeHtml(categoryName) + '</span>';
            if (classification) {
              html += '<span class="classification-badge">' + escapeHtml(classification) + '</span>';
            }
            html += '</div>';
            html += '<div class="element-key">' + escapeHtml(key) + '</div>';
            html += '</div>';
            html += '<button class="element-toggle" data-model-urn="' + modelData.modelURN.replace(/"/g, '&quot;') + '" data-element-key="' + key.replace(/"/g, '&quot;') + '">Show Details</button>';
            html += '</div>';
            html += '<div class="element-details"></div>';
            html += '</div>';
          }
          
          html += '</div>';
          html += '</div>';
        }
        
        container.innerHTML = html;
        
        // Add event listeners to all toggle buttons
        const toggleButtons = container.querySelectorAll('.element-toggle');
        toggleButtons.forEach(button => {
          button.addEventListener('click', async function() {
            const modelURN = this.getAttribute('data-model-urn');
            const elementKey = this.getAttribute('data-element-key');
            const detailsDiv = this.closest('.element-item').querySelector('.element-details');
            
            await toggleElementDetails(modelURN, elementKey, this, detailsDiv);
          });
        });
        
        // Add event listeners to all View Keys buttons
        const viewKeysButtons = container.querySelectorAll('.view-keys-btn');
        viewKeysButtons.forEach(button => {
          button.addEventListener('click', function() {
            const modelURN = this.getAttribute('data-model-urn');
            const modelName = this.getAttribute('data-model-name');
            
            // Find the model data and extract keys
            const modelData = modelsData.find(m => m.modelURN === modelURN);
            if (modelData) {
              const keys = modelData.elements.map(el => el['k']);
              showKeysModal(modelURN, modelName, keys);
            }
          });
        });
      } catch (error) {
        console.error('Error loading data:', error);
        container.innerHTML = '<div class="error-message">Failed to load asset details</div>';
      }
    }
    
    // Modal handling
    function showKeysModal(modelURN, modelName, keys) {
      const modal = document.getElementById('keys-modal');
      const modelNameEl = document.getElementById('keys-modal-model-name');
      const modelUrnEl = document.getElementById('keys-modal-model-urn');
      const textarea = document.getElementById('keys-textarea');
      
      modelNameEl.textContent = modelName;
      modelUrnEl.textContent = modelURN;
      textarea.value = JSON.stringify(keys, null, 2);
      textarea.rows = Math.min(keys.length + 2, 20);
      
      modal.classList.add('active');
    }
    
    function closeKeysModal() {
      const modal = document.getElementById('keys-modal');
      modal.classList.remove('active');
    }
    
    function copyKeysToClipboard() {
      const textarea = document.getElementById('keys-textarea');
      textarea.select();
      document.execCommand('copy');
      
      const btn = document.getElementById('keys-copy-btn');
      const originalText = btn.textContent;
      btn.textContent = 'Copied!';
      setTimeout(() => {
        btn.textContent = originalText;
      }, 2000);
    }
    
    // Set up modal event listeners
    document.getElementById('keys-modal-close').addEventListener('click', closeKeysModal);
    document.getElementById('keys-copy-btn').addEventListener('click', copyKeysToClipboard);
    
    // Close modal when clicking outside
    document.getElementById('keys-modal').addEventListener('click', (e) => {
      if (e.target.id === 'keys-modal') {
        closeKeysModal();
      }
    });
    
    // Excel Export Utilities
    const ExcelUtils = {
      headerStyle: {
        font: { bold: true, color: { rgb: "000000" } },
        fill: { fgColor: { rgb: "D3D3D3" } },
        alignment: { vertical: "center", horizontal: "left" }
      },
      
      blankRowStyle: {
        fill: { 
          patternType: "gray125",
          fgColor: { rgb: "BFBFBF" },
          bgColor: { rgb: "FFFFFF" }
        },
        border: {
          top: { style: "thin", color: { rgb: "D0D0D0" } },
          bottom: { style: "thin", color: { rgb: "D0D0D0" } },
          left: { style: "thin", color: { rgb: "D0D0D0" } },
          right: { style: "thin", color: { rgb: "D0D0D0" } }
        }
      },
      
      sanitizeSheetName: function(name, fallback = 'Sheet') {
        if (!name) return fallback;
        let sanitized = name
          .split(':').join('_')
          .split('/').join('_')
          .split(String.fromCharCode(92)).join('_')
          .split('?').join('_')
          .split('*').join('_')
          .split('[').join('_')
          .split(']').join('_')
          .trim()
          .substring(0, 31);
        return sanitized || fallback;
      },
      
      makeUnique: function(baseName, usedNames) {
        let uniqueName = baseName;
        let counter = 1;
        while (usedNames.has(uniqueName)) {
          const suffix = '_' + counter;
          uniqueName = baseName.substring(0, 31 - suffix.length) + suffix;
          counter++;
        }
        return uniqueName;
      },
      
      styleHeaderRow: function(sheet, columns, style) {
        columns.forEach(cell => {
          if (sheet[cell]) {
            sheet[cell].s = style;
          }
        });
      },
      
      styleBlankRows: function(sheet, data, columns, style) {
        for (let rowNum = 2; rowNum <= data.length; rowNum++) {
          const rowData = data[rowNum - 1];
          if (rowData && rowData.every(cell => cell === '')) {
            columns.forEach(col => {
              const cellRef = col + rowNum;
              if (!sheet[cellRef]) {
                sheet[cellRef] = { t: 's', v: '', w: '' };
              }
              sheet[cellRef].s = style;
            });
          }
        }
      }
    };
    
    // Export to Excel functionality
    async function exportToExcel() {
      const exportBtn = document.getElementById('export-btn');
      const originalText = exportBtn.innerHTML;
      
      try {
        exportBtn.disabled = true;
        exportBtn.innerHTML = '<span>⏳</span><span>Exporting...</span>';
        
        const workbook = XLSX.utils.book_new();
        
        // Fetch ALL element details once per model (used for both summary and detail sheets)
        // Use Promise.all to fetch all models in parallel for maximum speed
        const fetchPromises = DATA
          .filter(modelData => modelData.keys && modelData.keys.length > 0)
          .map(async modelData => {
            const elements = await fetchElementDetails(modelData.modelURN, modelData.keys);
            return {
              modelData: modelData,
              elements: elements
            };
          });
        
        const modelElementsCache = await Promise.all(fetchPromises);
        
        // Sheet 1: Summary - one row per element
        const summaryData = [
          ['Model Name', 'Element Name', 'Category', 'Classification', 'Element Key']
        ];
        
        // Build summary from cached data
        for (const cached of modelElementsCache) {
          for (const element of cached.elements) {
            const key = element['k'];
            const name = element['n:!n']?.[0] || element['n:n']?.[0] || 'Unnamed';
            const categoryId = element['n:c']?.[0];
            const categoryName = categoryId ? getCategoryName(categoryId) : 'Unknown';
            const classification = element['n:!v']?.[0] || element['n:v']?.[0] || '';
            
            summaryData.push([
              cached.modelData.modelName,
              name,
              categoryName,
              classification,
              key
            ]);
          }
        }
        
        const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
        summarySheet['!cols'] = [
          { wch: 30 }, // Model Name
          { wch: 30 }, // Element Name
          { wch: 20 }, // Category
          { wch: 20 }, // Classification
          { wch: 35 }  // Element Key
        ];
        
        ExcelUtils.styleHeaderRow(summarySheet, ['A1', 'B1', 'C1', 'D1', 'E1'], ExcelUtils.headerStyle);
        XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');
        
        // Track sheet names to avoid duplicates
        const usedSheetNames = new Set(['Summary']);
        
        // Sheets 2+: Detailed properties per model (using cached data)
        for (const cached of modelElementsCache) {
          const modelData = cached.modelData;
          const elements = cached.elements;
          
          const detailData = [
            ['Element Key', 'Element Name', 'Property ID', 'Category', 'Property Name', 'Value']
          ];
          
          for (let i = 0; i < elements.length; i++) {
            const element = elements[i];
            const elementKey = element['k'];
            const elementName = element['n:!n']?.[0] || element['n:n']?.[0] || 'Unnamed';
            const properties = organizeProperties(element, modelData.modelURN);
            
            for (const prop of properties) {
              detailData.push([
                elementKey,
                elementName,
                prop.id,
                prop.category,
                prop.name,
                prop.value
              ]);
            }
            
            // Add blank row between elements (except after last element)
            if (i < elements.length - 1) {
              detailData.push(['', '', '', '', '', '']);
            }
          }
          
          if (detailData.length > 1) {
            const detailSheet = XLSX.utils.aoa_to_sheet(detailData);
            detailSheet['!cols'] = [
              { wch: 35 }, // Element Key
              { wch: 30 }, // Element Name
              { wch: 15 }, // Property ID
              { wch: 20 }, // Category
              { wch: 30 }, // Property Name
              { wch: 40 }  // Value
            ];
            
            const detailHeaderCols = ['A', 'B', 'C', 'D', 'E', 'F'];
            ExcelUtils.styleHeaderRow(detailSheet, ['A1', 'B1', 'C1', 'D1', 'E1', 'F1'], ExcelUtils.headerStyle);
            ExcelUtils.styleBlankRows(detailSheet, detailData, detailHeaderCols, ExcelUtils.blankRowStyle);
            
            // Sanitize and ensure unique sheet name
            const baseName = ExcelUtils.sanitizeSheetName(
              modelData.modelName, 
              'Model_' + DATA.indexOf(modelData)
            );
            const uniqueSheetName = ExcelUtils.makeUnique(baseName, usedSheetNames);
            usedSheetNames.add(uniqueSheetName);
            
            XLSX.utils.book_append_sheet(workbook, detailSheet, uniqueSheetName);
          }
        }
        
        // Download file
        const filename = 'asset-details-' + new Date().toISOString().slice(0, 10) + '.xlsx';
        XLSX.writeFile(workbook, filename);
        
        // Success feedback
        exportBtn.innerHTML = '<span>✓</span><span>Exported!</span>';
        setTimeout(() => {
          exportBtn.innerHTML = originalText;
          exportBtn.disabled = false;
        }, 2000);
        
      } catch (error) {
        console.error('Export error:', error);
        exportBtn.innerHTML = '<span>✗</span><span>Export Failed</span>';
        setTimeout(() => {
          exportBtn.innerHTML = originalText;
          exportBtn.disabled = false;
        }, 2000);
      }
    }
    
    // Set up export button
    document.getElementById('export-btn').addEventListener('click', exportToExcel);
    
    // Load data when page loads
    loadInitialData();
  </script>
</body>
</html>`;
}

// Store reference to the asset details window
let assetDetailsWindow = null;

/**
 * View asset details in a new tab
 * @param {Array<{modelURN: string, modelName: string, keys: Array<string>}>} elementsByModel - Elements grouped by model
 * @param {string} title - Page title
 */
export function viewAssetDetails(elementsByModel, title = 'Asset Details') {
  if (!elementsByModel || elementsByModel.length === 0) {
    alert('No elements to display');
    return;
  }
  
  // Generate HTML with all data embedded
  const htmlContent = generateAssetDetailsHTML(elementsByModel, title);
  
  // Open in new window/tab
  assetDetailsWindow = window.open('', '_blank');
  
  if (!assetDetailsWindow) {
    alert('Failed to open asset details window. Please check popup blocker settings.');
    return;
  }
  
  assetDetailsWindow.document.write(htmlContent);
  assetDetailsWindow.document.close();
}

