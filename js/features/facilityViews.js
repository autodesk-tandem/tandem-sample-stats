import { getFacilityViews } from '../api.js';

/**
 * View facility saved views in a new window
 * @param {string} facilityURN - Facility URN
 * @param {string} region - Region identifier
 * @param {string} facilityName - Facility name for display
 */
export async function viewFacilityViews(facilityURN, region, facilityName = 'Facility') {
  const newWindow = window.open('', '_blank');
  if (!newWindow) {
    alert('Please allow pop-ups to view facility views');
    return;
  }

  newWindow.document.write(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Facility Views - ${facilityName}</title>
      <script src="https://cdn.tailwindcss.com"></script>
      <script>
        tailwind.config = {
          theme: {
            extend: {
              colors: {
                'tandem-blue': '#0696D7',
                'dark-bg': '#1a1a1a',
                'dark-card': '#2a2a2a',
                'dark-border': '#404040',
                'dark-text': '#e0e0e0',
                'dark-text-secondary': '#a0a0a0',
              }
            }
          }
        }
      </script>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #1a1a1a; color: #e0e0e0; }
        ::-webkit-scrollbar { width: 10px; }
        ::-webkit-scrollbar-track { background: #1a1a1a; }
        ::-webkit-scrollbar-thumb { background: #404040; border-radius: 5px; }
        .sortable-header { cursor: pointer; user-select: none; transition: color 0.2s; }
        .sortable-header:hover { color: #0696D7; }
      </style>
    </head>
    <body class="bg-dark-bg">
      <div class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div class="mb-6">
          <h1 class="text-2xl font-bold text-dark-text mb-2">Facility Views</h1>
          <p class="text-sm text-dark-text-secondary">${facilityName}</p>
          <p class="text-xs text-dark-text-secondary font-mono mt-1">${facilityURN}</p>
        </div>
        <div id="loading" class="flex items-center justify-center py-12">
          <div class="flex items-center space-x-3">
            <svg class="animate-spin h-5 w-5 text-tandem-blue" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span class="text-dark-text text-sm">Loading views...</span>
          </div>
        </div>
        <div id="content" class="hidden"></div>
      </div>
    </body>
    </html>
  `);
  newWindow.document.close();

  try {
    const views = await getFacilityViews(facilityURN, region);

    const loadingDiv = newWindow.document.getElementById('loading');
    const contentDiv = newWindow.document.getElementById('content');

    if (!loadingDiv || !contentDiv) return;

    loadingDiv.classList.add('hidden');
    contentDiv.classList.remove('hidden');

    if (!views || views.length === 0) {
      contentDiv.innerHTML = `
        <div class="bg-dark-card rounded border border-dark-border p-8 text-center">
          <svg class="w-12 h-12 text-dark-text-secondary mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 10h16M4 14h16M4 18h16"></path>
          </svg>
          <p class="text-sm text-dark-text-secondary">No saved views found for this facility</p>
        </div>`;
      return;
    }

    const { html, viewData } = buildViewsHTML(views);
    contentDiv.innerHTML = html;
    setupSorting(newWindow, viewData);

  } catch (error) {
    console.error('Error displaying facility views:', error);
    const loadingDiv = newWindow.document.getElementById('loading');
    const contentDiv = newWindow.document.getElementById('content');
    if (loadingDiv && contentDiv) {
      loadingDiv.classList.add('hidden');
      contentDiv.classList.remove('hidden');
      contentDiv.innerHTML = `
        <div class="bg-red-900/30 border border-red-700 rounded p-4">
          <div class="flex items-start space-x-3">
            <svg class="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            <div>
              <h3 class="text-sm font-semibold text-red-500 mb-1">Error Loading Views</h3>
              <p class="text-xs text-red-200">${error.message}</p>
            </div>
          </div>
        </div>`;
    }
  }
}

/**
 * @param {Array} views
 * @returns {{ html: string, viewData: Array }}
 */
function buildViewsHTML(views) {
  const sorted = [...views].sort((a, b) =>
    (a.viewName || '').localeCompare(b.viewName || '')
  );

  // Extract any level groupings from view data
  const withLevel = sorted.filter(v => v.levelName);
  const withoutLevel = sorted.filter(v => !v.levelName);

  let html = `
    <div class="mb-6 grid grid-cols-2 gap-4">
      <div class="bg-dark-card rounded border border-dark-border p-4">
        <div class="text-3xl font-bold text-tandem-blue mb-1">${sorted.length}</div>
        <div class="text-xs text-dark-text-secondary">Saved Views</div>
      </div>
      ${withLevel.length > 0 ? `
      <div class="bg-dark-card rounded border border-dark-border p-4">
        <div class="text-3xl font-bold text-tandem-blue mb-1">${withLevel.length}</div>
        <div class="text-xs text-dark-text-secondary">Level Views</div>
      </div>` : ''}
    </div>

    <div class="bg-dark-card rounded border border-dark-border">
      <div class="px-4 py-3 border-b border-dark-border">
        <h2 class="text-sm font-semibold text-dark-text">Views</h2>
      </div>
      <div class="p-4 overflow-x-auto">
        <table class="min-w-full text-xs">
          <thead>
            <tr class="border-b border-dark-border">
              <th class="sortable-header text-left py-2 px-3 font-medium text-dark-text-secondary" data-column="viewName">
                Name <span class="sort-indicator">▲</span>
              </th>
              <th class="sortable-header text-left py-2 px-3 font-medium text-dark-text-secondary" data-column="levelName">
                Level <span class="sort-indicator"></span>
              </th>
              <th class="text-left py-2 px-3 font-medium text-dark-text-secondary">
                ID
              </th>
            </tr>
          </thead>
          <tbody id="viewsTableBody">
  `;

  sorted.forEach((view, index) => {
    html += `
      <tr class="${index > 0 ? 'border-t border-dark-border/50' : ''}">
        <td class="py-2 px-3 text-dark-text">${view.viewName || '—'}</td>
        <td class="py-2 px-3 text-dark-text-secondary">${view.levelName || '—'}</td>
        <td class="py-2 px-3 text-dark-text-secondary font-mono">${view.id || '—'}</td>
      </tr>`;
  });

  html += `</tbody></table></div></div>`;
  return { html, viewData: sorted };
}

function setupSorting(newWindow, viewData) {
  let sortColumn = 'viewName';
  let sortDirection = 'asc';

  const headers = newWindow.document.querySelectorAll('.sortable-header');
  const tbody = newWindow.document.getElementById('viewsTableBody');
  if (!tbody) return;

  function sortAndRender() {
    const sorted = [...viewData].sort((a, b) => {
      const aVal = (a[sortColumn] || '').toString().toLowerCase();
      const bVal = (b[sortColumn] || '').toString().toLowerCase();
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    tbody.innerHTML = sorted.map((view, index) => `
      <tr class="${index > 0 ? 'border-t border-dark-border/50' : ''}">
        <td class="py-2 px-3 text-dark-text">${view.viewName || '—'}</td>
        <td class="py-2 px-3 text-dark-text-secondary">${view.levelName || '—'}</td>
        <td class="py-2 px-3 text-dark-text-secondary font-mono">${view.id || '—'}</td>
      </tr>`).join('');

    headers.forEach(header => {
      const indicator = header.querySelector('.sort-indicator');
      if (!indicator) return;
      if (header.dataset.column === sortColumn) {
        indicator.textContent = sortDirection === 'asc' ? '▲' : '▼';
        header.style.color = '#0696D7';
      } else {
        indicator.textContent = '';
        header.style.color = '';
      }
    });
  }

  headers.forEach(header => {
    header.addEventListener('click', () => {
      const col = header.dataset.column;
      if (sortColumn === col) {
        sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
      } else {
        sortColumn = col;
        sortDirection = 'asc';
      }
      sortAndRender();
    });
  });
}
