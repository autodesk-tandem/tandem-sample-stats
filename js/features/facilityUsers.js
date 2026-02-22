import { getFacilityUsers } from '../api.js';

/**
 * View facility users in a new window
 * @param {string} facilityURN - Facility URN
 * @param {string} region - Region identifier
 * @param {string} facilityName - Facility name for display
 */
export async function viewFacilityUsers(facilityURN, region, facilityName = 'Facility') {
  const newWindow = window.open('', '_blank');
  if (!newWindow) {
    alert('Please allow pop-ups to view facility users');
    return;
  }

  newWindow.document.write(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Facility Users - ${facilityName}</title>
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
          <h1 class="text-2xl font-bold text-dark-text mb-2">Facility Users</h1>
          <p class="text-sm text-dark-text-secondary">${facilityName}</p>
          <p class="text-xs text-dark-text-secondary font-mono mt-1">${facilityURN}</p>
        </div>
        <div id="loading" class="flex items-center justify-center py-12">
          <div class="flex items-center space-x-3">
            <svg class="animate-spin h-5 w-5 text-tandem-blue" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span class="text-dark-text text-sm">Loading users...</span>
          </div>
        </div>
        <div id="content" class="hidden"></div>
      </div>
    </body>
    </html>
  `);
  newWindow.document.close();

  try {
    const usersData = await getFacilityUsers(facilityURN, region);

    const loadingDiv = newWindow.document.getElementById('loading');
    const contentDiv = newWindow.document.getElementById('content');

    if (!loadingDiv || !contentDiv) return;

    loadingDiv.classList.add('hidden');
    contentDiv.classList.remove('hidden');

    const users = Object.entries(usersData).map(([id, u]) => ({
      id,
      name: u.name || '',
      email: u.email || '',
      accessLevel: u.accessLevel || '—'
    }));

    if (users.length === 0) {
      contentDiv.innerHTML = `
        <div class="bg-dark-card rounded border border-dark-border p-8 text-center">
          <svg class="w-12 h-12 text-dark-text-secondary mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"></path>
          </svg>
          <p class="text-sm text-dark-text-secondary">No users found for this facility</p>
        </div>`;
      return;
    }

    const { html, userData } = buildUsersHTML(users);
    contentDiv.innerHTML = html;
    setupSorting(newWindow, userData);

  } catch (error) {
    console.error('Error displaying facility users:', error);
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
              <h3 class="text-sm font-semibold text-red-500 mb-1">Error Loading Users</h3>
              <p class="text-xs text-red-200">${error.message}</p>
            </div>
          </div>
        </div>`;
    }
  }
}

/**
 * @param {Array} users
 * @returns {{ html: string, userData: Array }}
 */
function buildUsersHTML(users) {
  const sorted = [...users].sort((a, b) => a.name.localeCompare(b.name));

  // Count by access level for the summary row
  const levelCounts = {};
  sorted.forEach(u => {
    levelCounts[u.accessLevel] = (levelCounts[u.accessLevel] || 0) + 1;
  });

  let html = `
    <div class="mb-6 grid grid-cols-2 md:grid-cols-4 gap-4">
      <div class="bg-dark-card rounded border border-dark-border p-4">
        <div class="text-3xl font-bold text-tandem-blue mb-1">${sorted.length}</div>
        <div class="text-xs text-dark-text-secondary">Total Users</div>
      </div>
      ${Object.entries(levelCounts).sort().map(([level, count]) => `
      <div class="bg-dark-card rounded border border-dark-border p-4">
        <div class="text-3xl font-bold mb-1" style="color: ${accessLevelColor(level)}">${count}</div>
        <div class="text-xs text-dark-text-secondary">${level}</div>
      </div>`).join('')}
    </div>

    <div class="bg-dark-card rounded border border-dark-border">
      <div class="px-4 py-3 border-b border-dark-border">
        <h2 class="text-sm font-semibold text-dark-text">Users</h2>
      </div>
      <div class="p-4 overflow-x-auto">
        <table class="min-w-full text-xs">
          <thead>
            <tr class="border-b border-dark-border">
              <th class="sortable-header text-left py-2 px-3 font-medium text-dark-text-secondary" data-column="name">
                Name <span class="sort-indicator">▲</span>
              </th>
              <th class="sortable-header text-left py-2 px-3 font-medium text-dark-text-secondary" data-column="email">
                Email <span class="sort-indicator"></span>
              </th>
              <th class="sortable-header text-left py-2 px-3 font-medium text-dark-text-secondary" data-column="accessLevel">
                Access Level <span class="sort-indicator"></span>
              </th>
            </tr>
          </thead>
          <tbody id="usersTableBody">
  `;

  sorted.forEach((user, index) => {
    const nameCell = user.name
      ? `<span class="text-dark-text">${user.name}</span>`
      : `<span class="font-mono text-dark-text-secondary text-xs">${user.id}</span>`;
    const emailCell = user.email
      ? `<span>${user.email}</span>`
      : `<span class="italic text-dark-text-secondary/60">not available</span>`;
    html += `
      <tr class="${index > 0 ? 'border-t border-dark-border/50' : ''}">
        <td class="py-2 px-3">${nameCell}</td>
        <td class="py-2 px-3 text-dark-text-secondary">${emailCell}</td>
        <td class="py-2 px-3">
          <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                style="background-color: ${accessLevelColor(user.accessLevel)}22; color: ${accessLevelColor(user.accessLevel)}; border: 1px solid ${accessLevelColor(user.accessLevel)}44">
            ${user.accessLevel}
          </span>
        </td>
      </tr>`;
  });

  html += `</tbody></table></div></div>`;
  return { html, userData: sorted };
}

function accessLevelColor(level) {
  const map = { Owner: '#fbbf24', Manage: '#4ade80', ReadWrite: '#c084fc', Read: '#60a5fa', None: '#9ca3af' };
  return map[level] || '#e0e0e0';
}

function setupSorting(newWindow, userData) {
  let sortColumn = 'name';
  let sortDirection = 'asc';

  const headers = newWindow.document.querySelectorAll('.sortable-header');
  const tbody = newWindow.document.getElementById('usersTableBody');
  if (!tbody) return;

  function sortAndRender() {
    const sorted = [...userData].sort((a, b) => {
      // For the name column, fall back to the ID when name is absent so entries sort consistently
      let aVal = sortColumn === 'name' ? (a.name || a.id) : (a[sortColumn] || '');
      let bVal = sortColumn === 'name' ? (b.name || b.id) : (b[sortColumn] || '');
      aVal = aVal.toString().toLowerCase();
      bVal = bVal.toString().toLowerCase();
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    tbody.innerHTML = sorted.map((user, index) => {
      const nameCell = user.name
        ? `<span class="text-dark-text">${user.name}</span>`
        : `<span class="font-mono text-dark-text-secondary text-xs">${user.id}</span>`;
      const emailCell = user.email
        ? `<span>${user.email}</span>`
        : `<span class="italic text-dark-text-secondary/60">not available</span>`;
      return `
        <tr class="${index > 0 ? 'border-t border-dark-border/50' : ''}">
          <td class="py-2 px-3">${nameCell}</td>
          <td class="py-2 px-3 text-dark-text-secondary">${emailCell}</td>
          <td class="py-2 px-3">
            <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                  style="background-color: ${accessLevelColor(user.accessLevel)}22; color: ${accessLevelColor(user.accessLevel)}; border: 1px solid ${accessLevelColor(user.accessLevel)}44">
              ${user.accessLevel}
            </span>
          </td>
        </tr>`;
    }).join('');

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
