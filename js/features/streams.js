import { getLastSeenStreamValues, getStreamValues, getElementsByKeys } from '../api.js';
import { convertLongKeysToShortKeys } from '../utils.js';
import { loadSchemaForModel, getPropertyDisplayName } from '../state/schemaCache.js';
import { createToggleFunction } from '../components/toggleHeader.js';
import { QC } from '../../sdk/dt-schema.js';
import { decodeXref, toShortKey } from '../../sdk/keys.js';

/**
 * Category ID to type name mapping
 */
const CATEGORY_NAMES = {
  160: 'Room',
  3600: 'Space',
  240: 'Level',
  // Add more as needed
};

/**
 * Toggle streams detail view
 */
const toggleStreamsDetail = createToggleFunction({
  detailId: 'streams-detail',
  summaryId: 'streams-summary',
  toggleBtnId: 'toggle-streams-btn',
  iconDownId: 'toggle-streams-icon-down',
  iconUpId: 'toggle-streams-icon-up'
});

/**
 * Generate chart HTML page for stream data
 * @param {string} streamName - Name of the stream
 * @param {string} streamKey - Stream key
 * @param {Object} streamData - Stream data with timestamps and values
 * @param {Object} defaultModelURN - Default model URN
 * @param {Object} propertyDisplayNames - Map of property keys to display names
 * @returns {string} HTML page content
 */
function generateChartHTML(streamName, streamKey, streamData, defaultModelURN, propertyDisplayNames) {
  // Process the data to extract chart data - one chart per property
  const propertyCharts = [];
  const allTimestamps = new Set();
  
  // Tandem blue color
  const tandemBlue = '#0696D7';
  
  // Stream data format: { "propertyKey": { "timestamp": value, ... }, ... }
  for (const [propKey, propData] of Object.entries(streamData)) {
    if (propKey === 'k') continue; // Skip the key field
    
    const data = [];
    const timestamps = Object.keys(propData).map(Number).sort((a, b) => a - b);
    
    timestamps.forEach(ts => {
      allTimestamps.add(ts);
      data.push({
        x: new Date(ts),
        y: propData[ts]
      });
    });
    
    // Store last seen value (last timestamp)
    let lastSeenValue = null;
    let lastSeenTimestamp = null;
    if (timestamps.length > 0) {
      const lastTimestamp = timestamps[timestamps.length - 1];
      lastSeenValue = propData[lastTimestamp];
      lastSeenTimestamp = lastTimestamp;
    }
    
    // Get display name
    const displayName = propertyDisplayNames[propKey] || propKey;
    
    propertyCharts.push({
      propKey: propKey,
      displayName: displayName,
      data: data,
      lastSeenValue: lastSeenValue,
      lastSeenTimestamp: lastSeenTimestamp,
      dataPointCount: data.length
    });
  }

  // Build HTML for each property chart
  let chartsHtml = '';
  propertyCharts.forEach((chart, index) => {
    const date = new Date(chart.lastSeenTimestamp);
    const timeStr = date.toLocaleString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
    
    chartsHtml += `
    <div class="chart-section">
      <div class="chart-header">
        <div class="chart-title">${chart.displayName} <span class="prop-key">(${chart.propKey})</span></div>
        <div class="chart-stats">
          <div class="last-seen-value">${chart.lastSeenValue}</div>
          <div class="last-seen-time">Last seen: ${timeStr}</div>
          <div class="data-points">${chart.dataPointCount} data points</div>
        </div>
      </div>
      <div class="chart-container">
        <canvas id="chart${index}"></canvas>
      </div>
    </div>
    `;
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Stream Chart: ${streamName}</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/chartjs-adapter-date-fns@3.0.0/dist/chartjs-adapter-date-fns.bundle.min.js"></script>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background-color: #1a1a1a;
      color: #e0e0e0;
      margin: 0;
      padding: 20px;
    }
    .container {
      max-width: 1600px;
      margin: 0 auto;
    }
    .main-header {
      background: #2a2a2a;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 20px;
      border: 1px solid #404040;
    }
    h1 {
      margin: 0 0 10px 0;
      color: #0696D7;
      font-size: 24px;
      font-weight: 600;
    }
    .info {
      font-size: 12px;
      color: #a0a0a0;
      font-family: monospace;
      margin-bottom: 5px;
    }
    .chart-section {
      background: #2a2a2a;
      padding: 20px;
      border-radius: 8px;
      border: 1px solid #404040;
      margin-bottom: 20px;
    }
    .chart-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
      padding-bottom: 15px;
      border-bottom: 1px solid #404040;
    }
    .chart-title {
      font-size: 18px;
      font-weight: 600;
      color: #e0e0e0;
    }
    .prop-key {
      font-size: 14px;
      font-weight: 400;
      color: #808080;
      font-family: monospace;
    }
    .chart-stats {
      text-align: right;
    }
    .last-seen-value {
      font-size: 32px;
      font-weight: 600;
      color: #0696D7;
      line-height: 1;
      margin-bottom: 4px;
    }
    .last-seen-time {
      font-size: 11px;
      color: #808080;
      margin-bottom: 2px;
    }
    .data-points {
      font-size: 10px;
      color: #606060;
    }
    .chart-container {
      position: relative;
      height: 400px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="main-header">
      <h1>${streamName}</h1>
      <div class="info">Stream Key: ${streamKey}</div>
      <div class="info">Model: ${defaultModelURN}</div>
      <div class="info">Time Range: Last 30 days</div>
    </div>
    ${chartsHtml}
  </div>
  
  <script>
    const tandemBlue = '#0696D7';
    const chartData = ${JSON.stringify(propertyCharts)};
    
    // Create a chart for each property
    chartData.forEach((chartInfo, index) => {
      const ctx = document.getElementById('chart' + index).getContext('2d');
      
      const chart = new Chart(ctx, {
        type: 'line',
        data: {
          datasets: [{
            data: chartInfo.data,
            borderColor: tandemBlue,
            backgroundColor: 'transparent',
            borderWidth: 2,
            pointRadius: 0,
            pointHoverRadius: 4,
            pointHoverBackgroundColor: tandemBlue,
            tension: 0.1
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: false
            },
            title: {
              display: false
            },
            tooltip: {
              mode: 'index',
              intersect: false,
              backgroundColor: 'rgba(42, 42, 42, 0.95)',
              titleColor: '#e0e0e0',
              bodyColor: '#a0a0a0',
              borderColor: '#404040',
              borderWidth: 1,
              padding: 12,
              displayColors: false,
              callbacks: {
                title: function(context) {
                  // Show date
                  return new Date(context[0].parsed.x).toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true
                  });
                },
                label: function(context) {
                  // Show only the value
                  return context.parsed.y.toFixed(2);
                }
              }
            }
          },
          scales: {
            x: {
              type: 'time',
              time: {
                unit: 'day',
                displayFormats: {
                  day: 'MMM d',
                  hour: 'MMM d ha'
                }
              },
              ticks: {
                color: '#808080',
                font: {
                  size: 11
                },
                maxRotation: 0,
                autoSkip: true,
                maxTicksLimit: 12
              },
              grid: {
                color: '#353535',
                drawBorder: false
              },
              border: {
                display: false
              }
            },
            y: {
              ticks: {
                color: '#808080',
                font: {
                  size: 11
                },
                padding: 10
              },
              grid: {
                color: '#353535',
                drawBorder: false
              },
              border: {
                display: false
              }
            }
          },
          interaction: {
            mode: 'index',
            axis: 'x',
            intersect: false
          },
          elements: {
            line: {
              borderWidth: 2
            },
            point: {
              radius: 0,
              hitRadius: 8,
              hoverRadius: 4
            }
          }
        }
      });
    });
  </script>
</body>
</html>`;
}

/**
 * View stream chart in a new tab
 * @param {string} facilityURN - Facility URN
 * @param {string} streamKey - Stream key
 * @param {string} streamName - Stream name
 * @param {HTMLElement} button - Button element that triggered the action
 */
async function viewStreamChart(facilityURN, streamKey, streamName, button = null) {
  try {
    // Show loading state on button if provided
    let originalText = null;
    if (button) {
      originalText = button.innerHTML;
      button.disabled = true;
      button.innerHTML = `
        <svg class="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      `;
    }
    
    // Fetch stream data
    const streamData = await getStreamValues(facilityURN, streamKey, 30);
    
    // Reset button if provided
    if (button && originalText) {
      button.disabled = false;
      button.innerHTML = originalText;
    }
    
    if (!streamData || Object.keys(streamData).length === 0) {
      alert('No data available for this stream in the last 30 days.');
      return;
    }
    
    // Get default model URN
    const defaultModelURN = facilityURN.replace('urn:adsk.dtt:', 'urn:adsk.dtm:');
    
    // Load schema to get display names
    await loadSchemaForModel(defaultModelURN);
    
    // Get display names for all properties
    const propertyDisplayNames = {};
    for (const propKey of Object.keys(streamData)) {
      if (propKey !== 'k') {
        propertyDisplayNames[propKey] = await getPropertyDisplayName(defaultModelURN, propKey);
      }
    }
    
    // Generate HTML
    const htmlContent = generateChartHTML(streamName, streamKey, streamData, defaultModelURN, propertyDisplayNames);
    
    // Open in new tab
    const newWindow = window.open('', '_blank');
    newWindow.document.write(htmlContent);
    newWindow.document.close();
  } catch (error) {
    console.error('Error viewing stream chart:', error);
    alert('Failed to load stream chart. See console for details.');
  }
}

/**
 * Display streams list with details
 * @param {HTMLElement} container - DOM element to render into
 * @param {Array} streams - Array of stream objects
 * @param {string} facilityURN - Facility URN to fetch last seen values
 */
export async function displayStreams(container, streams, facilityURN) {
  if (!streams || streams.length === 0) {
    container.innerHTML = '<p class="text-dark-text-secondary">No streams found in this facility.</p>';
    return;
  }

  // Build header with toggle button (always visible)
  let headerHtml = `
    <div class="flex items-center justify-between mb-3">
      <div class="flex items-center space-x-2">
        <div class="text-xl font-bold text-tandem-blue">${streams.length}</div>
        <div class="text-sm text-dark-text-secondary">
          <div>Stream${streams.length !== 1 ? 's' : ''}</div>
        </div>
      </div>
      <button id="toggle-streams-btn"
              class="p-2 hover:bg-dark-bg/50 rounded transition"
              title="Show more">
        <svg id="toggle-streams-icon-down" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
        </svg>
        <svg id="toggle-streams-icon-up" class="w-5 h-5 hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"></path>
        </svg>
      </button>
    </div>
  `;
  
  // Build summary view (collapsed state)
  let summaryHtml = `
    <div id="streams-summary"></div>
  `;

  // Get the default model URN (streams only exist in the default model)
  const defaultModelURN = facilityURN.replace('urn:adsk.dtt:', 'urn:adsk.dtm:');
  
  // Load schema for the default model (cached)
  await loadSchemaForModel(defaultModelURN);
  
  // Fetch last seen values for all streams
  const streamKeys = streams.map(s => s[QC.Key]);
  const lastSeenValuesRaw = await getLastSeenStreamValues(facilityURN, streamKeys);
  
  // Convert long keys to short keys so we can match them with our stream objects
  const lastSeenValues = convertLongKeysToShortKeys(lastSeenValuesRaw);

  // Decode xrefs and fetch host information
  const hostInfoMap = new Map(); // Map xref -> {name, type}
  const xrefsByModel = new Map(); // Map modelURN -> array of {xref, shortKey}
  
  // Decode all xrefs and group by model
  
  for (const stream of streams) {
    // Host reference priority: x:p (parent) > x:r (room)
    // Tandem UI uses x:p as the primary host reference
    const hostRef = stream[QC.XParent]?.[0] || stream[QC.XRooms]?.[0];
    if (hostRef) {
      const decoded = decodeXref(hostRef);
      if (decoded) {
        // Convert long key (from xref) to short key (for querying)
        const shortKey = toShortKey(decoded.elementKey);
        
        if (!xrefsByModel.has(decoded.modelURN)) {
          xrefsByModel.set(decoded.modelURN, []);
        }
        xrefsByModel.get(decoded.modelURN).push({
          xref: hostRef,
          shortKey: shortKey
        });
      }
    }
  }
  
  // Fetch host elements using short keys from source models
  for (const [modelURN, items] of xrefsByModel.entries()) {
    const shortKeys = items.map(item => item.shortKey);
    
    try {
      const elements = await getElementsByKeys(modelURN, shortKeys);
      
      // Map elements back to xrefs using short key matching
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const element = elements.find(e => e[QC.Key] === item.shortKey);
        
        if (element) {
          // Name: Use override if present, otherwise standard
          const name = element[QC.OName]?.[0] || element[QC.Name]?.[0] || 'Unnamed';
          const categoryId = element[QC.CategoryId]?.[0];
          const type = CATEGORY_NAMES[categoryId] || `Category ${categoryId}`;
          
          hostInfoMap.set(item.xref, { name, type });
        }
      }
    } catch (error) {
      console.error(`Error fetching host elements from model ${modelURN}:`, error);
    }
  }

  // Build detailed view (initially hidden)
  let detailHtml = '<div id="streams-detail" class="hidden space-y-2">';
  
  for (let i = 0; i < streams.length; i++) {
    const stream = streams[i];
    
    // Name: Use override if present, otherwise standard
    const streamName = stream[QC.OName]?.[0] || stream[QC.Name]?.[0] || 'Unnamed Stream';
    const streamKey = stream[QC.Key]; // Stream key
    
    // Classification: Use override if present, otherwise standard
    const classification = stream[QC.OClassification]?.[0] || stream[QC.Classification]?.[0];

    // Host information: Priority x:p (parent) > x:r (room)
    const hostRef = stream[QC.XParent]?.[0] || stream[QC.XRooms]?.[0];
    const hostInfo = hostRef ? hostInfoMap.get(hostRef) : null;
    
    // Get last seen values for this stream
    const streamValues = lastSeenValues[streamKey];
    let valuesHtml = '';
    
    if (streamValues && Object.keys(streamValues).length > 0) {
      valuesHtml = '<div class="mt-3 pt-3 border-t border-dark-border"><div class="text-xs font-semibold text-dark-text mb-2">Last Seen Values:</div><div class="space-y-2">';
      
      for (const [propKey, propValues] of Object.entries(streamValues)) {
        // propKey is like "z:LQ" which is the internal property ID
        // Get human-readable display name
        const displayName = await getPropertyDisplayName(defaultModelURN, propKey);
        
        valuesHtml += `<div class="bg-dark-bg/50 rounded p-2">`;
        valuesHtml += `<div class="text-xs mb-1">`;
        valuesHtml += `<div class="font-semibold text-dark-text">${displayName} <span class="font-mono text-dark-text-secondary font-normal">(${propKey})</span></div>`;
        valuesHtml += `</div>`;
        
        for (const [timestamp, value] of Object.entries(propValues)) {
          const date = new Date(parseInt(timestamp));
          valuesHtml += `
            <div class="flex items-center gap-3 text-xs pl-2 mt-1">
              <span class="text-dark-text-secondary">${date.toLocaleString()}</span>
              <span class="font-semibold text-dark-text">${value}</span>
            </div>
          `;
        }
        valuesHtml += '</div>';
      }
      
      valuesHtml += '</div></div>';
    }
    
    detailHtml += `
      <div class="border border-dark-border rounded p-4 hover:border-tandem-blue transition">
        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-3 flex-grow">
            <div class="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-green-500 to-green-600 rounded flex items-center justify-center">
              <span class="text-white font-semibold text-sm">${i + 1}</span>
            </div>
            <div class="flex-grow">
              <div class="flex items-center gap-2 mb-1">
                <h3 class="text-lg font-semibold text-dark-text">${streamName}</h3>
                ${classification ? `<span class="px-2 py-0.5 text-xs font-medium bg-gradient-to-r from-green-500/30 to-green-600/30 text-green-300 rounded">${classification}</span>` : ''}
              </div>
              ${hostInfo ? `<p class="text-xs text-dark-text-secondary mt-1">Host: ${hostInfo.name} (${hostInfo.type})</p>` : ''}
              <p class="text-xs text-dark-text-secondary mt-1">Key: <span class="font-mono">${streamKey}</span></p>
            </div>
          </div>
          <button 
            class="view-stream-chart-btn flex-shrink-0 inline-flex items-center px-3 py-2 border border-tandem-blue text-xs font-medium rounded text-tandem-blue hover:bg-tandem-blue hover:text-white transition"
            data-stream-key="${streamKey}"
            data-stream-name="${streamName}"
            title="View 30-day chart">
            <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
            </svg>
            View Chart
          </button>
        </div>
        ${valuesHtml}
      </div>
    `;
  }
  
  detailHtml += '</div>';
  
  // Combine header, summary and detail views
  container.innerHTML = headerHtml + summaryHtml + detailHtml;
  
  // Bind toggle button event listener
  const toggleBtn = document.getElementById('toggle-streams-btn');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', toggleStreamsDetail);
  }
  
  // Bind view chart button event listeners
  const chartButtons = container.querySelectorAll('.view-stream-chart-btn');
  chartButtons.forEach(button => {
    button.addEventListener('click', () => {
      const streamKey = button.dataset.streamKey;
      const streamName = button.dataset.streamName;
      viewStreamChart(facilityURN, streamKey, streamName, button);
    });
  });
}

