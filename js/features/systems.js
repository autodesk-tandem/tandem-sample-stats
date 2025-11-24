/**
 * Systems display feature
 * Displays systems and their subsystems from the default model
 */

import { createToggleFunction } from '../components/toggleHeader.js';
import { viewAssetDetails } from './assetDetails.js';

/**
 * Toggle systems detail view
 */
const toggleSystemsDetail = createToggleFunction({
  detailId: 'systems-detail',
  summaryId: 'systems-summary',
  toggleBtnId: 'toggle-systems-btn',
  iconDownId: 'toggle-systems-icon-down',
  iconUpId: 'toggle-systems-icon-up'
});

/**
 * Display systems information in the provided container
 * @param {HTMLElement} container - Container element to display systems in
 * @param {Array} systems - Array of system objects
 * @param {string} facilityURN - Facility URN for context
 */
export async function displaySystems(container, systems, facilityURN, region) {
  try {
    if (!systems || systems.length === 0) {
      container.innerHTML = `
        <div class="flex items-center space-x-2 mb-3">
          <div class="text-xl font-bold text-tandem-blue">0</div>
          <div class="text-sm text-dark-text-secondary">Systems</div>
        </div>
        <div class="text-dark-text-secondary text-xs">
          Systems are created when you define system classifications in Autodesk Tandem.
        </div>
      `;
      return;
    }

    // Sort systems alphabetically by name
    const sortedSystems = [...systems].sort((a, b) => 
      a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    );

    // Calculate total subsystems
    const totalSubsystems = systems.reduce((sum, system) => sum + (system.subsystems ? system.subsystems.length : 0), 0);

    // Build header with toggle button (always visible)
    let headerHtml = `
      <div class="flex items-center justify-between mb-3">
        <div class="flex items-center space-x-2">
          <div class="text-xl font-bold text-tandem-blue">${systems.length}</div>
          <div class="text-sm text-dark-text-secondary">
            <div>System${systems.length !== 1 ? 's' : ''}</div>
            <div class="text-xs text-dark-text-secondary">${totalSubsystems} subsystem${totalSubsystems !== 1 ? 's' : ''}</div>
          </div>
        </div>
        <button id="toggle-systems-btn"
                class="p-2 hover:bg-dark-bg/50 rounded transition"
                title="Show more">
          <svg id="toggle-systems-icon-down" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
          </svg>
          <svg id="toggle-systems-icon-up" class="w-5 h-5 hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"></path>
          </svg>
        </button>
      </div>
    `;
    
    // Build summary view (collapsed state)
    let summaryHtml = `
      <div id="systems-summary">
        <div class="text-dark-text-secondary text-sm">
          <p>Found <span class="font-medium text-dark-text">${systems.length}</span> system${systems.length !== 1 ? 's' : ''} with <span class="font-medium text-dark-text">${totalSubsystems}</span> subsystem${totalSubsystems !== 1 ? 's' : ''} in the default model.</p>
        </div>
      </div>
    `;

    // Build detailed view (initially hidden)
    let detailHtml = '<div id="systems-detail" class="hidden space-y-2">';
    
    for (let i = 0; i < sortedSystems.length; i++) {
      const system = sortedSystems[i];
      const subsystemCount = system.subsystems ? system.subsystems.length : 0;
      
      detailHtml += `
        <div class="border border-dark-border rounded p-4 hover:border-tandem-blue transition" id="detail-system-${i}">
          <div class="flex items-start justify-between mb-3">
            <div class="flex-grow">
              <div class="flex items-center space-x-2 mb-1">
                <h3 class="text-base font-semibold text-dark-text">${escapeHtml(system.name)}</h3>
              </div>
              <div class="flex items-center space-x-4 mt-2">
                <div class="text-xs text-dark-text-secondary">
                  <span class="font-medium text-dark-text">${system.elementCount}</span> element${system.elementCount !== 1 ? 's' : ''}
                </div>
                <div class="text-dark-text-secondary">•</div>
                <div class="text-xs text-dark-text-secondary">
                  <span class="font-medium text-dark-text">${subsystemCount}</span> subsystem${subsystemCount !== 1 ? 's' : ''}
                </div>
              </div>
            </div>
            ${system.elementCount > 0 ? `
              <button class="system-details-btn inline-flex items-center px-3 py-2 border border-tandem-blue text-xs font-medium rounded text-tandem-blue hover:bg-tandem-blue hover:text-white transition"
                      data-system-index="${i}"
                      title="View system elements">
                <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                </svg>
                Details
              </button>
            ` : ''}
          </div>
          
          <div class="text-xs text-dark-text-secondary">
            <span class="font-medium text-dark-text">System ID:</span>
            <span class="ml-2 font-mono">${escapeHtml(system.systemId)}</span>
          </div>
      `;

      // Display subsystems if any
      if (subsystemCount > 0) {
        detailHtml += `
          <div class="mt-4 pt-4 border-t border-dark-border">
            <h4 class="text-sm font-medium text-dark-text mb-3">Subsystems (${subsystemCount})</h4>
            <div class="space-y-2">
        `;

        // Sort subsystems alphabetically
        const sortedSubsystems = [...system.subsystems].sort((a, b) => 
          a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
        );

        for (const subsystem of sortedSubsystems) {
          detailHtml += `
            <div class="flex items-center justify-between py-2 px-3 bg-dark-card/50 rounded border border-dark-border/50">
              <div class="flex-1">
                <div class="text-sm text-dark-text font-medium">${escapeHtml(subsystem.name)}</div>
              </div>
            </div>
          `;
        }

        detailHtml += `
            </div>
          </div>
        `;
      }

      detailHtml += `
        </div>
      `;
    }
    
    detailHtml += '</div>';
    
    // Combine header, summary and detail views
    container.innerHTML = headerHtml + summaryHtml + detailHtml;
    
    // Bind toggle button event listener
    const toggleBtn = document.getElementById('toggle-systems-btn');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', toggleSystemsDetail);
    }

    // Bind Details button event listeners
    const detailButtons = container.querySelectorAll('.system-details-btn');
    detailButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const systemIndex = parseInt(btn.dataset.systemIndex);
        const system = sortedSystems[systemIndex];
        
        if (system && system.elementsByModel && system.elementsByModel.length > 0) {
          // Pass the grouped element data directly to viewAssetDetails
          viewAssetDetails(system.elementsByModel, `${system.name} System Details`, facilityURN, region);
        }
      });
    });

  } catch (error) {
    console.error('Error displaying systems:', error);
    container.innerHTML = `
      <div class="text-red-500 text-sm">
        <p>Error loading systems information.</p>
        <p class="text-xs mt-1 text-red-400">${escapeHtml(error.message)}</p>
      </div>
    `;
  }
}

/**
 * Escape HTML to prevent XSS
 * @param {string} text - Text to escape
 * @returns {string} Escaped HTML
 */
function escapeHtml(text) {
  if (typeof text !== 'string') {
    return String(text);
  }
  
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
