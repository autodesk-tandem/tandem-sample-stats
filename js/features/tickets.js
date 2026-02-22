import { getElementsByKeys } from '../api.js';
import { createToggleFunction } from '../components/toggleHeader.js';
import { viewAssetDetails } from './assetDetails.js';
import { QC } from '../../tandem/constants.js';
import { decodeXref, toShortKey } from '../../tandem/keys.js';

/**
 * Category ID to type name mapping
 */
const CATEGORY_NAMES = {
  160: 'Room',
  3600: 'Space',
  240: 'Level',
};

/**
 * Priority level colors and display
 */
const PRIORITY_CONFIG = {
  'Critical': { color: 'bg-red-500/20 text-red-300', icon: '🔴' },
  'High': { color: 'bg-orange-500/20 text-orange-300', icon: '🟠' },
  'Medium': { color: 'bg-yellow-500/20 text-yellow-300', icon: '🟡' },
  'Low': { color: 'bg-blue-500/20 text-blue-300', icon: '🔵' },
  'Trivial': { color: 'bg-gray-500/20 text-gray-300', icon: '⚪' }
};

/**
 * Toggle tickets detail view
 */
const toggleTicketsDetail = createToggleFunction({
  detailId: 'tickets-detail',
  summaryId: 'tickets-summary',
  toggleBtnId: 'toggle-tickets-btn',
  iconDownId: 'toggle-tickets-icon-down',
  iconUpId: 'toggle-tickets-icon-up'
});

/**
 * Format date string to human-readable format
 * @param {string} dateStr - Date string (YYYY-MM-DD)
 * @returns {string} Formatted date
 */
function formatDate(dateStr) {
  if (!dateStr) return 'N/A';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric', 
    year: 'numeric'
  });
}

/**
 * Calculate days open for a ticket
 * @param {string} openDate - Open date string
 * @param {string} closeDate - Close date string (optional)
 * @returns {string} Days open text
 */
function getDaysOpen(openDate, closeDate) {
  if (!openDate) return 'Unknown';
  
  const start = new Date(openDate);
  const end = closeDate ? new Date(closeDate) : new Date();
  const days = Math.floor((end - start) / (1000 * 60 * 60 * 24));
  
  return `${days} day${days !== 1 ? 's' : ''}`;
}

/**
 * Display tickets list with details
 * @param {HTMLElement} container - DOM element to render into
 * @param {Array} tickets - Array of ticket objects
 * @param {string} facilityURN - Facility URN
 * @param {string} region - Region identifier
 */
export async function displayTickets(container, tickets, facilityURN, region) {
  if (!tickets || tickets.length === 0) {
    container.innerHTML = '<p class="text-dark-text-secondary">No tickets found in this facility.</p>';
    return;
  }

  // Count open vs closed tickets
  const openTickets = tickets.filter(t => !t[QC.CloseDate] || t[QC.CloseDate][0] === null).length;
  const closedTickets = tickets.length - openTickets;
  
  // Count by priority
  const priorityCounts = {};
  tickets.forEach(t => {
    const priority = t[QC.Priority]?.[0] || 'Unknown';
    priorityCounts[priority] = (priorityCounts[priority] || 0) + 1;
  });

  // Build header with summary stats
  let headerHtml = `
    <div class="flex items-center justify-between mb-3">
      <div class="flex items-center space-x-4">
        <div class="flex items-center space-x-2">
          <div class="text-xl font-bold text-tandem-blue">${tickets.length}</div>
          <div class="text-sm text-dark-text-secondary">
            <div>Ticket${tickets.length !== 1 ? 's' : ''}</div>
          </div>
        </div>
        <div class="flex items-center gap-3 text-xs">
          <span class="px-2 py-1 rounded bg-green-500/20 text-green-300">
            ${openTickets} Open
          </span>
          <span class="px-2 py-1 rounded bg-gray-500/20 text-gray-300">
            ${closedTickets} Closed
          </span>
        </div>
      </div>
      <div class="flex items-center space-x-3">
        <button id="tickets-asset-details-btn"
                class="inline-flex items-center px-3 py-2 border border-tandem-blue text-xs font-medium rounded text-tandem-blue hover:bg-tandem-blue hover:text-white transition"
                title="View detailed information">
          <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
          </svg>
          Details
        </button>
        <button id="toggle-tickets-btn"
                class="p-2 hover:bg-dark-bg/50 rounded transition"
                title="Show more">
          <svg id="toggle-tickets-icon-down" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
          </svg>
          <svg id="toggle-tickets-icon-up" class="w-5 h-5 hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"></path>
          </svg>
        </button>
      </div>
    </div>
  `;
  
  // Build summary view (collapsed state) - just show the priority breakdown
  let summaryHtml = `
    <div id="tickets-summary" class="flex flex-wrap gap-2">
      ${Object.entries(priorityCounts).map(([priority, count]) => {
        const config = PRIORITY_CONFIG[priority] || { color: 'bg-gray-500/20 text-gray-300', icon: '⚪' };
        return `
          <span class="px-2 py-1 text-xs rounded ${config.color}">
            ${config.icon} ${priority}: ${count}
          </span>
        `;
      }).join('')}
    </div>
  `;

  // Decode xrefs and fetch parent asset information
  const parentInfoMap = new Map(); // Map xref -> {name, type}
  const xrefsByModel = new Map(); // Map modelURN -> array of {xref, shortKey}
  
  for (const ticket of tickets) {
    const parentRef = ticket[QC.XParent]?.[0];
    if (parentRef) {
      const decoded = decodeXref(parentRef);
      if (decoded) {
        const shortKey = toShortKey(decoded.elementKey);
        
        if (!xrefsByModel.has(decoded.modelURN)) {
          xrefsByModel.set(decoded.modelURN, []);
        }
        xrefsByModel.get(decoded.modelURN).push({
          xref: parentRef,
          shortKey: shortKey
        });
      }
    }
  }
  
  // Fetch parent asset elements using short keys from source models
  for (const [modelURN, items] of xrefsByModel.entries()) {
    const shortKeys = items.map(item => item.shortKey);
    
    try {
      const elements = await getElementsByKeys(modelURN, region, shortKeys);
      
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const element = elements.find(e => e[QC.Key] === item.shortKey);
        
        if (element) {
          const name = element[QC.OName]?.[0] || element[QC.Name]?.[0] || 'Unnamed';
          const categoryId = element[QC.CategoryId]?.[0];
          const type = CATEGORY_NAMES[categoryId] || 'Asset';
          
          parentInfoMap.set(item.xref, { name, type });
        }
      }
    } catch (error) {
      console.error(`Error fetching parent assets from model ${modelURN}:`, error);
    }
  }

  // Build detailed view (initially hidden)
  let detailHtml = '<div id="tickets-detail" class="hidden space-y-2">';
  
  for (let i = 0; i < tickets.length; i++) {
    const ticket = tickets[i];
    
    const ticketName = ticket[QC.OName]?.[0] || ticket[QC.Name]?.[0] || 'Unnamed Ticket';
    const ticketKey = ticket[QC.Key];
    const priority = ticket[QC.Priority]?.[0] || 'Unknown';
    const openDate = ticket[QC.OpenDate]?.[0];
    const closeDate = ticket[QC.CloseDate]?.[0];
    const isOpen = !closeDate;
    
    const priorityConfig = PRIORITY_CONFIG[priority] || { color: 'bg-gray-500/20 text-gray-300', icon: '⚪' };
    
    // Parent asset information
    const parentRef = ticket[QC.XParent]?.[0];
    const parentInfo = parentRef ? parentInfoMap.get(parentRef) : null;
    
    detailHtml += `
      <div class="border border-dark-border rounded p-4 hover:border-tandem-blue transition">
        <div class="flex items-start justify-between">
          <div class="flex-grow">
            <div class="flex items-center gap-2 mb-2 flex-wrap">
              <h3 class="font-semibold text-dark-text">${ticketName}</h3>
              <span class="px-2 py-0.5 text-xs rounded font-medium ${priorityConfig.color}">
                ${priorityConfig.icon} ${priority}
              </span>
              <span class="px-2 py-0.5 text-xs rounded font-medium ${isOpen ? 'bg-green-500/20 text-green-300' : 'bg-gray-500/20 text-gray-300'}">
                ${isOpen ? 'Open' : 'Closed'}
              </span>
            </div>
            ${parentInfo ? `
              <p class="text-xs text-dark-text-secondary mt-1">
                Asset: ${parentInfo.name} (${parentInfo.type})
              </p>
            ` : ''}
            <p class="text-xs text-dark-text-secondary mt-1">Key: <span class="font-mono">${ticketKey}</span></p>
            <div class="flex items-center gap-4 mt-2 text-xs text-dark-text-secondary">
              <span>Opened: ${formatDate(openDate)}</span>
              ${closeDate ? `<span>Closed: ${formatDate(closeDate)}</span>` : ''}
              <span class="${isOpen ? 'text-amber-300' : 'text-gray-400'}">
                ${isOpen ? '⏱ ' : ''}${getDaysOpen(openDate, closeDate)}${isOpen ? ' open' : ' duration'}
              </span>
            </div>
          </div>
        </div>
      </div>
    `;
  }
  
  detailHtml += '</div>';
  
  // Combine all HTML
  container.innerHTML = headerHtml + summaryHtml + detailHtml;
  
  // Bind toggle button event listener
  const toggleBtn = document.getElementById('toggle-tickets-btn');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', toggleTicketsDetail);
  }
  
  // Add Asset Details button event listener
  const assetDetailsBtn = document.getElementById('tickets-asset-details-btn');
  if (assetDetailsBtn) {
    assetDetailsBtn.addEventListener('click', () => {
      const defaultModelURN = facilityURN.replace('urn:adsk.dtt:', 'urn:adsk.dtm:');
      const defaultModelName = '** Default Model **';
      
      const ticketKeys = tickets.map(t => t[QC.Key]);
      
      const elementsByModel = [{
        modelURN: defaultModelURN,
        modelName: defaultModelName,
        keys: ticketKeys
      }];
      
      viewAssetDetails(elementsByModel, `Ticket Details`, facilityURN, region, false);
    });
  }
}
