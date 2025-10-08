import { createToggleFunction } from '../components/toggleHeader.js';

/**
 * Toggle documents detail view
 */
const toggleDocumentsDetail = createToggleFunction({
  detailId: 'documents-detail',
  summaryId: 'documents-summary',
  toggleBtnId: 'toggle-documents-btn',
  iconDownId: 'toggle-documents-icon-down',
  iconUpId: 'toggle-documents-icon-up'
});

/**
 * Open a document in a new tab with authentication
 * @param {string} documentUrl - Document URL
 * @param {string} contentType - Document content type
 */
async function openDocument(documentUrl, contentType) {
  try {
    const response = await fetch(documentUrl, {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer ' + window.sessionStorage.token
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch document: ${response.statusText}`);
    }
    
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    window.open(blobUrl, '_blank');
    
    // Clean up the blob URL after a delay
    setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
  } catch (error) {
    console.error('Error opening document:', error);
    alert('Failed to open document. Please try again.');
  }
}

/**
 * Display documents list with details
 * @param {HTMLElement} container - DOM element to render into
 * @param {Array} documents - Array of document objects
 */
export async function displayDocuments(container, documents) {
  if (!documents || documents.length === 0) {
    container.innerHTML = '<p class="text-dark-text-secondary">No documents found in this facility.</p>';
    return;
  }

  // Build header with toggle button
  let headerHtml = `
    <div class="flex items-center justify-between mb-3">
      <div class="flex items-center space-x-2">
        <div class="text-xl font-bold text-tandem-blue">${documents.length}</div>
        <div class="text-sm text-dark-text-secondary">
          <div>Document${documents.length !== 1 ? 's' : ''}</div>
        </div>
      </div>
      <button id="toggle-documents-btn"
              class="p-2 hover:bg-dark-bg/50 rounded transition"
              title="Show more">
        <svg id="toggle-documents-icon-down" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
        </svg>
        <svg id="toggle-documents-icon-up" class="w-5 h-5 hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"></path>
        </svg>
      </button>
    </div>
  `;
  
  // Build summary view (collapsed state)
  let summaryHtml = `
    <div id="documents-summary"></div>
  `;

  // Build detailed view (initially hidden)
  let detailHtml = '<div id="documents-detail" class="hidden space-y-2">';
  
  for (let i = 0; i < documents.length; i++) {
    const doc = documents[i];
    
    // Format file size if available
    const fileSizeDisplay = doc.size ? `<span class="text-sm text-dark-text-secondary">Size: ${(doc.size / 1024 / 1024).toFixed(2)} MB</span>` : '';
    
    // Format last updated date
    const lastUpdated = doc.lastUpdated ? new Date(doc.lastUpdated).toLocaleString() : 'Unknown';
    
    // Determine file type icon color based on content type
    let iconColor = 'from-gray-500 to-gray-600';
    if (doc.contentType) {
      if (doc.contentType.includes('pdf')) iconColor = 'from-red-500 to-red-600';
      else if (doc.contentType.includes('image')) iconColor = 'from-green-500 to-green-600';
      else if (doc.contentType.includes('word') || doc.contentType.includes('document')) iconColor = 'from-blue-500 to-blue-600';
      else if (doc.contentType.includes('excel') || doc.contentType.includes('spreadsheet')) iconColor = 'from-green-600 to-green-700';
    }
    
    detailHtml += `
      <div class="border border-dark-border rounded p-4 hover:border-tandem-blue transition">
        <div class="flex items-start space-x-3">
          <div class="flex-shrink-0 w-10 h-10 bg-gradient-to-br ${iconColor} rounded flex items-center justify-center">
            <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path>
            </svg>
          </div>
          <div class="flex-grow min-w-0">
            <div class="flex items-center justify-between mb-2">
              <div class="flex-grow min-w-0">
                <h3 class="text-sm font-semibold text-dark-text truncate">${doc.name || 'Untitled Document'}</h3>
                ${doc.label ? `<p class="text-sm text-dark-text-secondary">${doc.label}</p>` : ''}
              </div>
              ${doc.signedLink ? `
              <button data-doc-url="${doc.signedLink}" 
                      data-doc-type="${doc.contentType || ''}"
                      class="doc-open-btn ml-3 flex-shrink-0 inline-flex items-center px-3 py-1.5 border border-tandem-blue text-tandem-blue rounded hover:bg-tandem-blue hover:text-white transition text-sm font-medium cursor-pointer">
                <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
                </svg>
                Open
              </button>
              ` : ''}
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
              ${doc.contentType ? `
              <div>
                <span class="font-medium text-dark-text">Type:</span>
                <span class="text-dark-text-secondary ml-2">${doc.contentType}</span>
              </div>
              ` : ''}
              <div>
                <span class="font-medium text-dark-text">Last Updated:</span>
                <span class="text-dark-text-secondary ml-2">${lastUpdated}</span>
              </div>
              ${fileSizeDisplay ? `<div>${fileSizeDisplay}</div>` : ''}
              ${doc.accProjectId ? `
              <div>
                <span class="font-medium text-dark-text">ACC Project:</span>
                <span class="text-dark-text-secondary ml-2 font-mono text-xs">${doc.accProjectId}</span>
              </div>
              ` : ''}
            </div>
            ${doc.id ? `<div class="mt-2 text-xs text-dark-text-secondary font-mono">${doc.id}</div>` : ''}
          </div>
        </div>
      </div>
    `;
  }
  
  detailHtml += '</div>';
  
  container.innerHTML = headerHtml + summaryHtml + detailHtml;
  
  const toggleBtn = document.getElementById('toggle-documents-btn');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', toggleDocumentsDetail);
  }
  
  // Add event listeners for document open buttons
  const openButtons = container.querySelectorAll('.doc-open-btn');
  openButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const url = btn.getAttribute('data-doc-url');
      const contentType = btn.getAttribute('data-doc-type');
      openDocument(url, contentType);
    });
  });
}

