import { getLastSeenStreamValues } from '../api.js';
import { convertLongKeysToShortKeys } from '../utils.js';
import { loadSchemaForModel, getPropertyDisplayName } from '../state/schemaCache.js';
import { createToggleFunction } from '../components/toggleHeader.js';

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
  const streamKeys = streams.map(s => s['k']);
  const lastSeenValuesRaw = await getLastSeenStreamValues(facilityURN, streamKeys);
  
  // Convert long keys to short keys so we can match them with our stream objects
  const lastSeenValues = convertLongKeysToShortKeys(lastSeenValuesRaw);

  // Build detailed view (initially hidden)
  let detailHtml = '<div id="streams-detail" class="hidden space-y-2">';
  
  for (let i = 0; i < streams.length; i++) {
    const stream = streams[i];
    
    // Name: Use override "n:!n" if present, otherwise "n:n"
    const streamName = stream['n:!n']?.[0] || stream['n:n']?.[0] || 'Unnamed Stream';
    const streamKey = stream['k']; // Stream key
    
    // Classification: Use override "n:!v" if present, otherwise "n:v"
    const classification = stream['n:!v']?.[0] || stream['n:v']?.[0];
    
    // Internal ID: Find first property starting with "z:"
    let internalId = null;
    for (const key in stream) {
      if (key.startsWith('z:')) {
        internalId = key;
        break;
      }
    }
    
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
        valuesHtml += `<div class="font-semibold text-dark-text">${displayName}</div>`;
        valuesHtml += `<div class="font-mono text-dark-text-secondary text-xs">${propKey}</div>`;
        valuesHtml += `</div>`;
        
        for (const [timestamp, value] of Object.entries(propValues)) {
          const date = new Date(parseInt(timestamp));
          valuesHtml += `
            <div class="flex justify-between items-center text-xs pl-2 mt-1">
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
              <p class="text-xs text-dark-text-secondary font-mono mt-1">Key: ${streamKey}</p>
              ${internalId ? `<p class="text-xs text-dark-text-secondary font-mono">Internal ID: ${internalId}</p>` : ''}
            </div>
          </div>
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
}

