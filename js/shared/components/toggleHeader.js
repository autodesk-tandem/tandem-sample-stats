/**
 * Create a toggle header for collapsible sections
 * @param {Object} options - Configuration options
 * @param {number} options.count - Count to display
 * @param {string} options.label - Label text (will be pluralized)
 * @param {string} options.toggleId - ID for the toggle button
 * @param {string} options.iconDownId - ID for the down icon
 * @param {string} options.iconUpId - ID for the up icon
 * @param {string} options.subtitle - Optional subtitle text
 * @param {string} options.additionalControls - Optional HTML for additional controls (e.g., sort)
 * @returns {string} HTML string for the header
 */
export function createToggleHeader({
  count,
  label,
  toggleId,
  iconDownId,
  iconUpId,
  subtitle = '',
  additionalControls = ''
}) {
  const pluralLabel = count !== 1 ? label + 's' : label;
  
  return `
    <div class="flex items-center justify-between mb-3">
      <div class="flex items-center space-x-2">
        <div class="text-xl font-bold text-tandem-blue">${count}</div>
        <div class="text-sm text-dark-text-secondary">
          <div>${pluralLabel}</div>
          ${subtitle ? `<div class="text-xs text-dark-text-secondary">${subtitle}</div>` : ''}
        </div>
      </div>
      <div class="flex items-center space-x-3">
        ${additionalControls}
        <button id="${toggleId}"
                class="p-2 hover:bg-dark-bg/50 rounded transition"
                title="Show more">
          <svg id="${iconDownId}" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
          </svg>
          <svg id="${iconUpId}" class="w-5 h-5 hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"></path>
          </svg>
        </button>
      </div>
    </div>
  `;
}

/**
 * Create a toggle function for collapsible sections
 * @param {Object} options - Configuration options
 * @param {string} options.detailId - ID of the detail section
 * @param {string} options.summaryId - ID of the summary section
 * @param {string} options.toggleBtnId - ID of the toggle button
 * @param {string} options.iconDownId - ID of the down icon
 * @param {string} options.iconUpId - ID of the up icon
 * @returns {Function} Toggle function
 */
export function createToggleFunction({
  detailId,
  summaryId,
  toggleBtnId,
  iconDownId,
  iconUpId
}) {
  return function() {
    const detailSection = document.getElementById(detailId);
    const summarySection = document.getElementById(summaryId);
    const toggleBtn = document.getElementById(toggleBtnId);
    const iconDown = document.getElementById(iconDownId);
    const iconUp = document.getElementById(iconUpId);
    
    if (detailSection && summarySection && toggleBtn && iconDown && iconUp) {
      if (detailSection.classList.contains('hidden')) {
        // Show detail, hide summary
        detailSection.classList.remove('hidden');
        summarySection.classList.add('hidden');
        iconDown.classList.add('hidden');
        iconUp.classList.remove('hidden');
        toggleBtn.title = 'Show less';
      } else {
        // Show summary, hide detail
        detailSection.classList.add('hidden');
        summarySection.classList.remove('hidden');
        iconDown.classList.remove('hidden');
        iconUp.classList.add('hidden');
        toggleBtn.title = 'Show more';
      }
    }
  };
}

