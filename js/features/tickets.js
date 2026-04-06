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
 * Priority level colors and display — ordered from most to least severe
 */
const PRIORITY_ORDER = ['Critical', 'High', 'Medium', 'Low', 'Trivial', 'Unknown'];

const PRIORITY_CONFIG = {
  'Critical': { color: 'bg-red-500/20 text-red-300',    activeRing: 'ring-red-400',    icon: '🔴' },
  'High':     { color: 'bg-orange-500/20 text-orange-300', activeRing: 'ring-orange-400', icon: '🟠' },
  'Medium':   { color: 'bg-yellow-500/20 text-yellow-300', activeRing: 'ring-yellow-400', icon: '🟡' },
  'Low':      { color: 'bg-blue-500/20 text-blue-300',   activeRing: 'ring-blue-400',   icon: '🔵' },
  'Trivial':  { color: 'bg-gray-500/20 text-gray-300',   activeRing: 'ring-gray-400',   icon: '⚪' },
  'Unknown':  { color: 'bg-gray-500/20 text-gray-300',   activeRing: 'ring-gray-400',   icon: '⚪' },
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
 * Fetch parent asset info for all tickets. Returns a Map of xref → {name, type}.
 * @param {Array} tickets
 * @param {string} region
 * @returns {Promise<Map>}
 */
async function buildParentInfoMap(tickets, region) {
  const parentInfoMap = new Map();
  const xrefsByModel = new Map();

  for (const ticket of tickets) {
    const parentRef = ticket[QC.XParent]?.[0];
    if (parentRef) {
      const decoded = decodeXref(parentRef);
      if (decoded) {
        const shortKey = toShortKey(decoded.elementKey);
        if (!xrefsByModel.has(decoded.modelURN)) {
          xrefsByModel.set(decoded.modelURN, []);
        }
        xrefsByModel.get(decoded.modelURN).push({ xref: parentRef, shortKey });
      }
    }
  }

  for (const [modelURN, items] of xrefsByModel.entries()) {
    const shortKeys = items.map(item => item.shortKey);
    try {
      const elements = await getElementsByKeys(modelURN, region, shortKeys);
      for (const item of items) {
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

  return parentInfoMap;
}

/**
 * Render the filtered ticket list into #tickets-list and update the count label.
 * @param {Array} filtered - Already-filtered ticket objects
 * @param {number} total - Total (unfiltered) ticket count
 * @param {Map} parentInfoMap
 */
function renderTicketList(filtered, total, parentInfoMap) {
  const listEl = document.getElementById('tickets-list');
  const countEl = document.getElementById('tickets-filtered-count');
  if (!listEl) return;

  if (countEl) {
    if (filtered.length === total) {
      countEl.textContent = '';
    } else {
      countEl.textContent = `Showing ${filtered.length} of ${total} tickets`;
    }
  }

  if (filtered.length === 0) {
    listEl.innerHTML = '<p class="text-dark-text-secondary text-sm">No tickets match the current filters.</p>';
    return;
  }

  let html = '';
  for (const ticket of filtered) {
    const ticketName = ticket[QC.OName]?.[0] || ticket[QC.Name]?.[0] || 'Unnamed Ticket';
    const ticketKey = ticket[QC.Key];
    const priority = ticket[QC.Priority]?.[0] || 'Unknown';
    const openDate = ticket[QC.OpenDate]?.[0];
    const closeDate = ticket[QC.CloseDate]?.[0];
    const isOpen = !closeDate;

    const priorityConfig = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG['Unknown'];

    const parentRef = ticket[QC.XParent]?.[0];
    const parentInfo = parentRef ? parentInfoMap.get(parentRef) : null;

    html += `
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
  listEl.innerHTML = html;
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

  const openTickets = tickets.filter(t => !t[QC.CloseDate]?.[0]).length;
  const closedTickets = tickets.length - openTickets;

  const priorityCounts = {};
  tickets.forEach(t => {
    const priority = t[QC.Priority]?.[0] || 'Unknown';
    priorityCounts[priority] = (priorityCounts[priority] || 0) + 1;
  });

  // Header
  const headerHtml = `
    <div class="flex items-center justify-between mb-3">
      <div class="flex items-center space-x-4">
        <div class="flex items-center space-x-2">
          <div class="text-xl font-bold text-tandem-blue">${tickets.length}</div>
          <div class="text-sm text-dark-text-secondary">
            <div>Ticket${tickets.length !== 1 ? 's' : ''}</div>
          </div>
        </div>
        <div class="flex items-center gap-3 text-xs">
          <span class="px-2 py-1 rounded bg-green-500/20 text-green-300">${openTickets} Open</span>
          <span class="px-2 py-1 rounded bg-gray-500/20 text-gray-300">${closedTickets} Closed</span>
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

  // Collapsed summary — priority breakdown pills
  const summaryHtml = `
    <div id="tickets-summary" class="flex flex-wrap gap-2">
      ${PRIORITY_ORDER.filter(p => priorityCounts[p]).map(p => {
        const config = PRIORITY_CONFIG[p];
        return `<span class="px-2 py-1 text-xs rounded ${config.color}">${config.icon} ${p}: ${priorityCounts[p]}</span>`;
      }).join('')}
    </div>
  `;

  // Priority filter pills (all active by default)
  const priorityPillsHtml = PRIORITY_ORDER.filter(p => priorityCounts[p]).map(p => {
    const config = PRIORITY_CONFIG[p];
    return `
      <button class="priority-pill px-2 py-0.5 text-xs rounded font-medium ring-2 transition ${config.color} ${config.activeRing}"
              data-priority="${p}" data-active="true">
        ${config.icon} ${p} (${priorityCounts[p]})
      </button>`;
  }).join('');

  // Detail section with filter bar
  const detailHtml = `
    <div id="tickets-detail" class="hidden space-y-3">
      <div class="flex flex-wrap items-center gap-3 pb-3 border-b border-dark-border">
        <div class="radio-button-group">
          <label>
            <input type="radio" name="ticket-status" value="all" checked>
            <span>All (${tickets.length})</span>
          </label>
          <label>
            <input type="radio" name="ticket-status" value="open">
            <span>Open (${openTickets})</span>
          </label>
          <label>
            <input type="radio" name="ticket-status" value="closed">
            <span>Closed (${closedTickets})</span>
          </label>
        </div>
        <div class="flex flex-wrap gap-1">${priorityPillsHtml}</div>
      </div>
      <div id="tickets-filtered-count" class="text-xs text-dark-text-secondary"></div>
      <div id="tickets-list" class="space-y-2"></div>
    </div>
  `;

  container.innerHTML = headerHtml + summaryHtml + detailHtml;

  // Fetch parent info once (async, after HTML is in place)
  const parentInfoMap = await buildParentInfoMap(tickets, region);

  // Filter state
  let currentStatus = 'all';
  const activePriorities = new Set(Object.keys(priorityCounts));

  function applyFilters() {
    const filtered = tickets.filter(t => {
      const isOpen = !t[QC.CloseDate]?.[0];
      if (currentStatus === 'open' && !isOpen) return false;
      if (currentStatus === 'closed' && isOpen) return false;
      const priority = t[QC.Priority]?.[0] || 'Unknown';
      return activePriorities.has(priority);
    });
    renderTicketList(filtered, tickets.length, parentInfoMap);
  }

  // Initial render (no filter applied)
  renderTicketList(tickets, tickets.length, parentInfoMap);

  // Toggle expand/collapse
  const toggleBtn = document.getElementById('toggle-tickets-btn');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', toggleTicketsDetail);
  }

  // Status radio buttons
  container.querySelectorAll('input[name="ticket-status"]').forEach(radio => {
    radio.addEventListener('change', () => {
      currentStatus = radio.value;
      applyFilters();
    });
  });

  // Priority pills — click to toggle inclusion
  container.querySelectorAll('.priority-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      const priority = pill.dataset.priority;
      const isActive = pill.dataset.active === 'true';
      const config = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG['Unknown'];

      if (isActive) {
        activePriorities.delete(priority);
        pill.dataset.active = 'false';
        pill.classList.remove(config.activeRing);
        pill.classList.add('ring-transparent', 'opacity-40');
      } else {
        activePriorities.add(priority);
        pill.dataset.active = 'true';
        pill.classList.add(config.activeRing);
        pill.classList.remove('ring-transparent', 'opacity-40');
      }
      applyFilters();
    });
  });

  // Details button — passes only the currently-filtered keys
  const assetDetailsBtn = document.getElementById('tickets-asset-details-btn');
  if (assetDetailsBtn) {
    assetDetailsBtn.addEventListener('click', () => {
      const defaultModelURN = facilityURN.replace('urn:adsk.dtt:', 'urn:adsk.dtm:');

      const filtered = tickets.filter(t => {
        const isOpen = !t[QC.CloseDate]?.[0];
        if (currentStatus === 'open' && !isOpen) return false;
        if (currentStatus === 'closed' && isOpen) return false;
        const priority = t[QC.Priority]?.[0] || 'Unknown';
        return activePriorities.has(priority);
      });

      const elementsByModel = [{
        modelURN: defaultModelURN,
        modelName: '** Default Model **',
        keys: filtered.map(t => t[QC.Key])
      }];

      viewAssetDetails(elementsByModel, `Ticket Details`, facilityURN, region, false);
    });
  }
}
