/**
 * Reusable modal dialog for displaying and copying element keys
 */

import { viewAssetDetails } from '../features/assetDetails.js';

let currentElementsByModel = [];
let currentModalTitle = '';
let currentFacilityURN = '';

/**
 * Initialize the modal event listeners
 * Call this once when the app loads
 */
export function initElementListModal() {
  const modal = document.getElementById('element-list-modal');
  const modalClose = document.getElementById('element-modal-close');
  const copyAllBtn = document.getElementById('element-modal-copy-all');
  const assetDetailsBtn = document.getElementById('element-modal-asset-details');
  
  if (!modal || !modalClose || !copyAllBtn || !assetDetailsBtn) {
    console.warn('Element list modal not found in DOM');
    return;
  }

  // Close button
  modalClose.addEventListener('click', () => {
    closeElementListModal();
  });

  // Copy all button
  copyAllBtn.addEventListener('click', () => {
    copyAllElementKeys();
  });

  // Asset details button
  assetDetailsBtn.addEventListener('click', () => {
    openAssetDetails();
  });

  // Click outside modal to close
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeElementListModal();
    }
  });

  // Escape key to close
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('active')) {
      closeElementListModal();
    }
  });

}

/**
 * Show the modal with a list of element keys, optionally grouped by model
 * @param {Array<string>|Array<{modelURN: string, modelName: string, keys: Array<string>}>} elementKeysOrGroups - Array of element keys or array of model groups
 * @param {string} title - Modal title (optional)
 * @param {string} facilityURN - Facility URN for link generation (optional)
 */
export function showElementListModal(elementKeysOrGroups, title = 'Element Keys', facilityURN = '') {
  if (!elementKeysOrGroups || elementKeysOrGroups.length === 0) {
    return;
  }

  const modal = document.getElementById('element-list-modal');
  const modalTitle = document.getElementById('element-modal-title');
  const elementKeysList = document.getElementById('element-modal-keys-list');

  if (!modal || !modalTitle || !elementKeysList) {
    console.error('Modal elements not found');
    return;
  }

  // Detect if we have grouped data or plain array
  const isGrouped = elementKeysOrGroups[0] && typeof elementKeysOrGroups[0] === 'object' && 'modelURN' in elementKeysOrGroups[0];

  // Store title and facilityURN for asset details
  currentModalTitle = title;
  currentFacilityURN = facilityURN;
  
  // Update title
  modalTitle.textContent = title;

  let htmlContent = '';
  
  if (isGrouped) {
    // Store grouped data for copy all functionality
    currentElementsByModel = elementKeysOrGroups;

    // Render grouped by model
    elementKeysOrGroups.forEach(modelGroup => {
      const totalKeys = modelGroup.keys.length;
      
      // Format keys as JSON array for display
      const keysArrayText = JSON.stringify(modelGroup.keys, null, 2);
      
      htmlContent += `
        <div class="model-group">
          <div class="model-group-header">
            <div>
              <h3 class="model-group-title">${modelGroup.modelName}</h3>
              <div class="model-group-subtitle">${modelGroup.modelURN}</div>
            </div>
            <div class="model-group-count">${totalKeys} element${totalKeys !== 1 ? 's' : ''}</div>
          </div>
          <div class="model-group-keys">
            <textarea readonly class="element-keys-textarea" rows="${Math.min(totalKeys + 2, 15)}">${keysArrayText}</textarea>
          </div>
        </div>
      `;
    });
  } else {
    // Store flat array for copy all functionality (backward compatibility)
    currentElementsByModel = [{
      modelURN: 'unknown',
      modelName: 'Unknown Model',
      keys: elementKeysOrGroups
    }];

    // Render flat list (backward compatibility)
    const keysArrayText = JSON.stringify(elementKeysOrGroups, null, 2);
    htmlContent = `<textarea readonly class="element-keys-textarea" rows="${Math.min(elementKeysOrGroups.length + 2, 15)}">${keysArrayText}</textarea>`;
  }

  elementKeysList.innerHTML = htmlContent;

  // Show modal
  modal.classList.add('active');
}

/**
 * Close the modal
 */
export function closeElementListModal() {
  const modal = document.getElementById('element-list-modal');
  if (modal) {
    modal.classList.remove('active');
  }
  currentElementsByModel = [];
  currentModalTitle = '';
  currentFacilityURN = '';
}

/**
 * Open asset details page in new tab
 */
function openAssetDetails() {
  if (currentElementsByModel.length === 0) {
    return;
  }
  
  viewAssetDetails(currentElementsByModel, currentModalTitle, currentFacilityURN);
}

/**
 * Copy all element keys as JSON, grouped by model
 */
function copyAllElementKeys() {
  if (currentElementsByModel.length === 0) {
    return;
  }

  const copyAllBtn = document.getElementById('element-modal-copy-all');
  
  // Format as grouped by model
  const formattedData = currentElementsByModel.map(modelGroup => ({
    modelURN: modelGroup.modelURN,
    modelName: modelGroup.modelName,
    elementCount: modelGroup.keys.length,
    elementKeys: modelGroup.keys
  }));
  
  const jsonOutput = JSON.stringify(formattedData, null, 2);
  
  navigator.clipboard.writeText(jsonOutput).then(() => {
    const originalText = copyAllBtn.textContent;
    copyAllBtn.textContent = 'Copied!';
    copyAllBtn.classList.add('copied');

    setTimeout(() => {
      copyAllBtn.textContent = originalText;
      copyAllBtn.classList.remove('copied');
    }, 2000);
  }).catch(err => {
    console.error('Failed to copy:', err);
    alert('Failed to copy to clipboard');
  });
}


