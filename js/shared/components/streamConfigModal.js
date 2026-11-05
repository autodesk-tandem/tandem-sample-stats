import { getPropertyDisplayName } from '../state/schemaCache.js';

/**
 * Format frequency in milliseconds to human-readable string
 * @param {number} frequencyMs - Frequency in milliseconds
 * @returns {string} Formatted frequency string
 */
function formatFrequency(frequencyMs) {
  if (!frequencyMs) return 'Default (1 minute)';
  
  const seconds = frequencyMs / 1000;
  const minutes = seconds / 60;
  const hours = minutes / 60;
  const days = hours / 24;
  
  if (days >= 1) return `${days} day${days !== 1 ? 's' : ''}`;
  if (hours >= 1) return `${hours} hour${hours !== 1 ? 's' : ''}`;
  if (minutes >= 1) return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
  return `${seconds} second${seconds !== 1 ? 's' : ''}`;
}

/**
 * Format offline timeout to human-readable string
 * @param {number} timeout - Timeout value (could be in seconds or minutes)
 * @returns {string} Formatted timeout string
 */
function formatOfflineTimeout(timeout) {
  if (!timeout) return 'Default (5 minutes)';
  
  // The API returns timeout in seconds, convert to minutes
  const minutes = Math.round(timeout / 60);
  
  if (minutes >= 60) {
    const hours = Math.round(minutes / 60);
    return `${hours} hour${hours !== 1 ? 's' : ''}`;
  }
  
  return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
}

/**
 * Format retention period in days to human-readable string
 * @param {number} days - Retention period in days
 * @returns {string} Formatted retention string
 */
function formatRetention(days) {
  if (!days || days === 0) return 'Default (90 days)';
  
  if (days >= 365) {
    const years = Math.floor(days / 365);
    return `${years} year${years !== 1 ? 's' : ''}`;
  }
  if (days >= 30) {
    const months = Math.floor(days / 30);
    return `${months} month${months !== 1 ? 's' : ''}`;
  }
  return `${days} day${days !== 1 ? 's' : ''}`;
}

/**
 * Calculate estimated storage capacity
 * @param {Object} settings - Stream settings object
 * @returns {string} Formatted capacity string
 */
function calculateCapacity(settings) {
  if (!settings) return 'N/A';
  
  const frequency = settings.frequency || 60000; // Default 1 minute
  const retention = settings.retentionPeriod || 90; // Default 90 days
  const paramCount = Object.keys(settings.sourceMapping || {}).length + 
                     Object.keys(settings.calculationSettings || {}).length;
  
  if (paramCount === 0) return '0 data points';
  
  const msPerDay = 24 * 60 * 60 * 1000;
  const pointsPerParam = (retention * msPerDay) / frequency;
  const totalPoints = pointsPerParam * paramCount;
  
  if (totalPoints >= 1000000) {
    return `~${(totalPoints / 1000000).toFixed(1)}M data points`;
  }
  if (totalPoints >= 1000) {
    return `~${(totalPoints / 1000).toFixed(1)}K data points`;
  }
  return `~${Math.floor(totalPoints)} data points`;
}

/**
 * Display stream configuration modal
 * @param {string} streamName - Name of the stream
 * @param {string} streamKey - Stream key
 * @param {Object} config - Stream configuration object
 * @param {string} defaultModelURN - Default model URN
 */
export async function showStreamConfigModal(streamName, streamKey, config, defaultModelURN) {
  const settings = config?.streamSettings || {};
  
  // Get display names for all properties in source mapping
  const sourceMappingRows = [];
  if (settings.sourceMapping) {
    for (const [propKey, mapping] of Object.entries(settings.sourceMapping)) {
      const displayName = await getPropertyDisplayName(defaultModelURN, propKey);
      sourceMappingRows.push({
        propKey,
        displayName,
        path: mapping.path,
        isShared: mapping.isShared
      });
    }
  }
  
  // Get display names for thresholds
  const thresholdRows = [];
  if (settings.thresholds) {
    for (const [propKey, threshold] of Object.entries(settings.thresholds)) {
      const displayName = await getPropertyDisplayName(defaultModelURN, propKey);
      thresholdRows.push({
        propKey,
        displayName,
        threshold
      });
    }
  }
  
  // Get calculation settings
  const calculationRows = [];
  if (settings.calculationSettings) {
    for (const [propKey, calc] of Object.entries(settings.calculationSettings)) {
      const displayName = await getPropertyDisplayName(defaultModelURN, propKey);
      calculationRows.push({
        propKey,
        displayName,
        calc
      });
    }
  }
  
  // Build source mapping HTML
  let sourceMappingHtml = '';
  if (sourceMappingRows.length > 0) {
    sourceMappingHtml = `
      <div class="overflow-x-auto">
        <table class="w-full text-xs">
          <thead class="text-xs text-dark-text-secondary border-b border-dark-border">
            <tr>
              <th class="px-2 py-1.5 text-left font-medium">Property</th>
              <th class="px-2 py-1.5 text-left font-medium">JSON Path</th>
              <th class="px-2 py-1.5 text-left font-medium">Source</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-dark-border/50">
            ${sourceMappingRows.map(row => `
              <tr class="hover:bg-dark-bg/50">
                <td class="px-2 py-1.5">
                  <div class="font-medium text-dark-text">${row.displayName}</div>
                  <div class="text-xs text-dark-text-secondary font-mono">${row.propKey}</div>
                </td>
                <td class="px-2 py-1.5">
                  <code class="text-tandem-blue font-mono text-xs">"${row.path}"</code>
                </td>
                <td class="px-2 py-1.5">
                  <span class="px-1.5 py-0.5 text-xs rounded ${row.isShared ? 'bg-green-500/20 text-green-300' : 'bg-blue-500/20 text-blue-300'}">
                    ${row.isShared ? 'Template' : 'Override'}
                  </span>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  } else {
    sourceMappingHtml = '<p class="text-dark-text-secondary text-xs">No source mapping configured</p>';
  }
  
  // Build thresholds HTML
  let thresholdsHtml = '';
  if (thresholdRows.length > 0) {
    thresholdsHtml = thresholdRows.map(row => {
      const t = row.threshold;
      let boundsHtml = '';
      
      // Upper bounds (High thresholds)
      if (t.upper) {
        if (t.upper.alert != null) {
          boundsHtml += `
            <div class="flex items-center gap-2 text-xs">
              <span class="text-red-400">🔴 Alert (High):</span>
              <span class="font-medium text-red-300">≥ ${t.upper.alert}</span>
            </div>
          `;
        }
        if (t.upper.warn != null) {
          boundsHtml += `
            <div class="flex items-center gap-2 text-xs">
              <span class="text-amber-400">⚠️ Warning (High):</span>
              <span class="font-medium text-amber-300">≥ ${t.upper.warn}</span>
            </div>
          `;
        }
      }
      
      // Lower bounds (Low thresholds)
      if (t.lower) {
        if (t.lower.warn != null) {
          boundsHtml += `
            <div class="flex items-center gap-2 text-xs">
              <span class="text-amber-400">⚠️ Warning (Low):</span>
              <span class="font-medium text-amber-300">≤ ${t.lower.warn}</span>
            </div>
          `;
        }
        if (t.lower.alert != null) {
          boundsHtml += `
            <div class="flex items-center gap-2 text-xs">
              <span class="text-red-400">🔴 Alert (Low):</span>
              <span class="font-medium text-red-300">≤ ${t.lower.alert}</span>
            </div>
          `;
        }
      }
      
      let alertHtml = '';
      if (t.alertDefinition) {
        let evalPeriod = 'Not set';
        if (t.alertDefinition.evaluationPeriodSec) {
          const seconds = t.alertDefinition.evaluationPeriodSec;
          const minutes = seconds / 60;
          const hours = minutes / 60;
          
          if (hours >= 1 && minutes % 60 === 0) {
            evalPeriod = `${hours} hour${hours !== 1 ? 's' : ''}`;
          } else if (minutes >= 1 && seconds % 60 === 0) {
            evalPeriod = `${minutes} minute${minutes !== 1 ? 's' : ''}`;
          } else {
            evalPeriod = `${seconds} second${seconds !== 1 ? 's' : ''}`;
          }
        }
        alertHtml = `
          <div class="mt-1.5 pt-1.5 border-t border-dark-border/50">
            <div class="flex items-center gap-1.5 text-xs">
              <svg class="w-3 h-3 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
              </svg>
              <span class="text-dark-text-secondary">Alert Evaluation:</span>
              <span class="font-medium text-dark-text">${evalPeriod}</span>
            </div>
          </div>
        `;
      }
      
      return `
        <div class="bg-dark-bg/50 rounded p-2 mb-2">
          <div class="font-medium text-dark-text text-xs mb-1">${row.displayName}</div>
          <div class="text-xs text-dark-text-secondary font-mono mb-1.5">${row.propKey}</div>
          ${boundsHtml}
          ${alertHtml}
        </div>
      `;
    }).join('');
  } else {
    thresholdsHtml = '<p class="text-dark-text-secondary text-xs">No thresholds configured</p>';
  }
  
  // Build calculations HTML
  let calculationsHtml = '';
  if (calculationRows.length > 0) {
    calculationsHtml = calculationRows.map(row => {
      const c = row.calc;
      const varCount = Object.keys(c.vars || {}).length;
      const statusBadge = c.enabled 
        ? '<span class="px-1.5 py-0.5 text-xs bg-green-500/20 text-green-300 rounded">Enabled</span>'
        : '<span class="px-1.5 py-0.5 text-xs bg-gray-500/20 text-gray-300 rounded">Disabled</span>';
      
      return `
        <div class="bg-dark-bg/50 rounded p-2 mb-2">
          <div class="flex items-center justify-between mb-1">
            <div class="font-medium text-dark-text text-xs">${row.displayName}</div>
            ${statusBadge}
          </div>
          <div class="text-xs text-dark-text-secondary font-mono mb-1.5">${row.propKey}</div>
          ${c.expression ? `
            <div class="mt-1.5">
              <div class="text-xs text-dark-text-secondary mb-1">Expression:</div>
              <code class="block bg-dark-bg/80 rounded p-1.5 text-xs font-mono text-tandem-blue">${c.expression}</code>
            </div>
          ` : ''}
          <div class="mt-1.5 flex items-center gap-3 text-xs">
            <span class="text-dark-text-secondary">Variables: <span class="text-dark-text font-medium">${varCount}</span></span>
            ${c.frequency ? `<span class="text-dark-text-secondary">Frequency: <span class="text-dark-text font-medium">${formatFrequency(c.frequency)}</span></span>` : ''}
          </div>
          ${c.statusCode ? `
            <div class="mt-1.5 text-xs text-amber-300">
              Status: ${c.statusCode}
            </div>
          ` : ''}
        </div>
      `;
    }).join('');
  } else {
    calculationsHtml = '<p class="text-dark-text-secondary text-xs">No calculated streams configured</p>';
  }
  
  // Build modal HTML
  const modalHtml = `
    <div id="stream-config-modal" class="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4">
      <div class="bg-dark-card border border-dark-border rounded shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <!-- Header -->
        <div class="flex items-center justify-between p-4 border-b border-dark-border">
          <div>
            <h2 class="text-base font-semibold text-dark-text">Stream Configuration</h2>
            <div class="mt-0.5">
              <div class="text-sm text-dark-text">${streamName}</div>
              <div class="text-xs text-dark-text-secondary font-mono">${streamKey}</div>
            </div>
          </div>
          <button id="close-stream-config-modal" class="p-1.5 hover:bg-dark-bg/50 rounded transition" title="Close">
            <svg class="w-5 h-5 text-dark-text" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>
        
        <!-- Content -->
        <div class="flex-1 overflow-y-auto p-4 space-y-4">
          <!-- Collection Settings -->
          <section>
            <h3 class="text-sm font-semibold text-dark-text mb-2 flex items-center gap-2">
              <svg class="w-4 h-4 text-tandem-blue" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clip-rule="evenodd"/>
              </svg>
              Collection Settings
            </h3>
            <div class="bg-dark-bg/30 rounded p-3 space-y-2 text-xs">
              <div class="flex items-center justify-between">
                <span class="text-dark-text-secondary">Sampling Frequency:</span>
                <span class="font-medium text-dark-text">${formatFrequency(settings.frequency)}</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-dark-text-secondary">Data Retention:</span>
                <span class="font-medium text-dark-text">${formatRetention(settings.retentionPeriod)}</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-dark-text-secondary">Offline Timeout:</span>
                <span class="font-medium text-dark-text">${formatOfflineTimeout(settings.offlineTimeout)}</span>
              </div>
              <div class="flex items-center justify-between border-t border-dark-border/50 pt-2 mt-2">
                <span class="text-dark-text-secondary">Storage Capacity:</span>
                <span class="font-medium text-tandem-blue">${calculateCapacity(settings)}</span>
              </div>
            </div>
          </section>
          
          <!-- Source Mapping -->
          <section>
            <h3 class="text-sm font-semibold text-dark-text mb-2 flex items-center gap-2">
              <svg class="w-4 h-4 text-tandem-blue" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M12.316 3.051a1 1 0 01.633 1.265l-4 12a1 1 0 11-1.898-.632l4-12a1 1 0 011.265-.633zM5.707 6.293a1 1 0 010 1.414L3.414 10l2.293 2.293a1 1 0 11-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0zm8.586 0a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 11-1.414-1.414L16.586 10l-2.293-2.293a1 1 0 010-1.414z" clip-rule="evenodd"/>
              </svg>
              Source Mapping (JSON Property Names)
            </h3>
            <div class="bg-dark-bg/30 rounded p-3">
              ${sourceMappingHtml}
            </div>
          </section>
          
          <!-- Thresholds -->
          <section>
            <h3 class="text-sm font-semibold text-dark-text mb-2 flex items-center gap-2">
              <svg class="w-4 h-4 text-tandem-blue" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
              </svg>
              Thresholds & Alerts
            </h3>
            <div class="bg-dark-bg/30 rounded p-3">
              ${thresholdsHtml}
            </div>
          </section>
          
          <!-- Calculated Streams -->
          <section>
            <h3 class="text-sm font-semibold text-dark-text mb-2 flex items-center gap-2">
              <svg class="w-4 h-4 text-tandem-blue" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM7 9a1 1 0 000 2h6a1 1 0 100-2H7z" clip-rule="evenodd"/>
              </svg>
              Calculated Streams
            </h3>
            <div class="bg-dark-bg/30 rounded p-3">
              ${calculationsHtml}
            </div>
          </section>
        </div>
        
        <!-- Footer -->
        <div class="p-3 border-t border-dark-border flex justify-end">
          <button id="close-stream-config-modal-btn" class="px-3 py-1.5 text-xs bg-tandem-blue text-white rounded hover:bg-tandem-blue/80 transition font-medium">
            Close
          </button>
        </div>
      </div>
    </div>
  `;
  
  // Add modal to DOM
  document.body.insertAdjacentHTML('beforeend', modalHtml);
  
  // Add event listeners
  const modal = document.getElementById('stream-config-modal');
  const closeBtn = document.getElementById('close-stream-config-modal');
  const closeFooterBtn = document.getElementById('close-stream-config-modal-btn');
  
  const closeModal = () => {
    modal.remove();
  };
  
  closeBtn.addEventListener('click', closeModal);
  closeFooterBtn.addEventListener('click', closeModal);
  
  // Close on backdrop click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeModal();
    }
  });
  
  // Close on Escape key
  const handleEscape = (e) => {
    if (e.key === 'Escape') {
      closeModal();
      document.removeEventListener('keydown', handleEscape);
    }
  };
  document.addEventListener('keydown', handleEscape);
}
