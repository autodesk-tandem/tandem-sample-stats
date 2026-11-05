import { getFacilityParameters } from '../api.js';

/**
 * View facility parameters in a new window, using the same property table
 * format as Asset Details.
 *
 * Facility parameters are properties stored on the root element
 * (DocumentRoot) of the default model. They represent facility-level
 * metadata defined by the facility template.
 *
 * @param {string} facilityURN - Facility URN
 * @param {string} region - Region identifier
 * @param {string} facilityName - Facility name for display
 */
export async function viewFacilityParameters(facilityURN, region, facilityName = 'Facility') {
  const newWindow = window.open('', '_blank');
  if (!newWindow) {
    alert('Please allow pop-ups to view facility parameters');
    return;
  }

  newWindow.document.write(generatePageHTML(facilityURN, facilityName));
  newWindow.document.close();

  try {
    const parameters = await getFacilityParameters(facilityURN, region);

    const loadingDiv = newWindow.document.getElementById('loading');
    const contentDiv = newWindow.document.getElementById('content');

    if (!loadingDiv || !contentDiv) return;

    loadingDiv.classList.add('hidden');
    contentDiv.classList.remove('hidden');

    if (!parameters || parameters.length === 0) {
      contentDiv.innerHTML = `
        <div class="empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="margin: 0 auto 12px; display: block; color: #606060;">
            <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path>
          </svg>
          <p>No facility parameters found</p>
          <p style="font-size: 11px; margin-top: 4px; color: #606060;">This facility may not have a default model or applied template.</p>
        </div>`;
      return;
    }

    const properties = parameters.map(p => ({
      id: p.id,
      category: p.category,
      name: p.name,
      value: formatValue(p.value)
    }));

    contentDiv.innerHTML =
      '<div class="props-section">'
      + '<div class="props-section-label">Facility Parameters</div>'
      + buildPropertiesTable(properties)
      + '</div>';

    const table = contentDiv.querySelector('.properties-table');
    if (table) {
      attachTableSorting(table);
    }

  } catch (error) {
    console.error('Error displaying facility parameters:', error);
    const loadingDiv = newWindow.document.getElementById('loading');
    const contentDiv = newWindow.document.getElementById('content');
    if (loadingDiv && contentDiv) {
      loadingDiv.classList.add('hidden');
      contentDiv.classList.remove('hidden');
      contentDiv.innerHTML = `
        <div class="error-message">
          <p>Error loading facility parameters</p>
          <p style="font-size: 12px; margin-top: 4px;">${escapeHtml(error.message)}</p>
        </div>`;
    }
  }
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatValue(value) {
  if (value === null || value === undefined) return '';
  return String(value);
}

function buildPropertiesTable(properties) {
  let html = '<table class="properties-table">';
  html += '<thead><tr>';
  html += '<th data-sort="id">ID</th>';
  html += '<th data-sort="category" class="sorted">Category</th>';
  html += '<th data-sort="name">Property Name</th>';
  html += '<th data-sort="value">Value</th>';
  html += '</tr></thead>';
  html += '<tbody class="properties-tbody">';

  for (const prop of properties) {
    const idEsc = escapeHtml(prop.id);
    const catEsc = escapeHtml(prop.category);
    const nameEsc = escapeHtml(prop.name);
    const valEsc = escapeHtml(prop.value);

    html += '<tr data-id="' + prop.id.replace(/"/g, '&quot;') + '"'
      + ' data-category="' + prop.category.replace(/"/g, '&quot;') + '"'
      + ' data-name="' + prop.name.replace(/"/g, '&quot;') + '"'
      + ' data-value="' + prop.value.replace(/"/g, '&quot;') + '">';
    html += '<td class="property-id">' + idEsc + '</td>';
    html += '<td class="property-category">' + catEsc + '</td>';
    html += '<td class="property-name">' + nameEsc + '</td>';
    html += '<td class="property-value">' + (valEsc || '<span class="empty-val">empty</span>') + '</td>';
    html += '</tr>';
  }

  html += '</tbody></table>';
  return html;
}

function attachTableSorting(table) {
  const headers = table.querySelectorAll('th[data-sort]');
  const tbody = table.querySelector('.properties-tbody');
  let currentSort = { column: 'category', direction: 'asc' };

  headers.forEach(header => {
    header.addEventListener('click', () => {
      const sortBy = header.getAttribute('data-sort');
      const rows = Array.from(tbody.querySelectorAll('tr'));

      if (currentSort.column === sortBy) {
        currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
      } else {
        currentSort.column = sortBy;
        currentSort.direction = 'asc';
      }

      headers.forEach(h => h.classList.remove('sorted', 'sorted-desc'));
      header.classList.add(currentSort.direction === 'asc' ? 'sorted' : 'sorted-desc');

      rows.sort((a, b) => {
        const aVal = (a.getAttribute('data-' + sortBy) || '').toLowerCase();
        const bVal = (b.getAttribute('data-' + sortBy) || '').toLowerCase();

        const comparison = aVal.localeCompare(bVal);
        if (sortBy === 'category' && comparison === 0) {
          const aName = (a.getAttribute('data-name') || '').toLowerCase();
          const bName = (b.getAttribute('data-name') || '').toLowerCase();
          const nameComp = aName.localeCompare(bName);
          return currentSort.direction === 'asc' ? nameComp : -nameComp;
        }
        return currentSort.direction === 'asc' ? comparison : -comparison;
      });

      rows.forEach(row => tbody.appendChild(row));
    });
  });
}

function generatePageHTML(facilityURN, facilityName) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Facility Parameters - ${escapeHtml(facilityName)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #1a1a1a;
      color: #e0e0e0;
    }
    ::-webkit-scrollbar { width: 10px; }
    ::-webkit-scrollbar-track { background: #1a1a1a; }
    ::-webkit-scrollbar-thumb { background: #404040; border-radius: 5px; }

    .page-container {
      max-width: 1400px;
      margin: 0 auto;
    }
    .page-header {
      padding: 20px 24px;
      border-bottom: 1px solid #333;
      background: #222;
    }
    .page-header h1 {
      font-size: 18px;
      font-weight: 600;
      margin-bottom: 4px;
    }
    .page-header .subtitle {
      font-size: 13px;
      color: #a0a0a0;
    }
    .page-header .urn {
      font-size: 11px;
      color: #606060;
      font-family: 'Courier New', monospace;
      margin-top: 4px;
    }
    .page-body {
      padding: 20px 24px;
    }
    .summary-bar {
      display: flex;
      gap: 24px;
      margin-bottom: 16px;
      font-size: 13px;
      color: #a0a0a0;
    }
    .summary-bar .count {
      color: #0696D7;
      font-weight: 600;
    }

    .hidden { display: none !important; }

    .loading {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 60px 0;
      color: #a0a0a0;
      font-size: 13px;
    }
    .loading svg {
      animation: spin 1s linear infinite;
      margin-right: 8px;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    .empty-state {
      padding: 48px 20px;
      text-align: center;
      color: #808080;
      font-size: 13px;
    }
    .error-message {
      padding: 20px;
      text-align: center;
      color: #ff6b6b;
    }

    /* Property table — matches Asset Details */
    .props-section {
      margin-bottom: 4px;
    }
    .props-section-label {
      font-size: 11px;
      font-weight: 600;
      color: #0696D7;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding: 6px 12px;
      background: rgba(6, 150, 215, 0.08);
      border-bottom: 1px solid rgba(6, 150, 215, 0.3);
    }
    .properties-table {
      table-layout: fixed;
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }
    .properties-table th {
      text-align: left;
      padding: 8px 12px;
      background: #333333;
      border-bottom: 1px solid #404040;
      font-size: 11px;
      font-weight: 600;
      color: #a0a0a0;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      cursor: pointer;
      user-select: none;
      position: relative;
    }
    .properties-table th:hover {
      background: #3a3a3a;
      color: #0696D7;
    }
    .properties-table th.sorted::after {
      content: ' \\2191';
      color: #0696D7;
    }
    .properties-table th.sorted-desc::after {
      content: ' \\2193';
      color: #0696D7;
    }
    .properties-table td {
      padding: 8px 12px;
      border-bottom: 1px solid #333333;
    }
    .properties-table tr:hover {
      background: #2a2a2a;
    }
    .property-id {
      font-family: 'Courier New', monospace;
      color: #808080;
      font-size: 11px;
    }
    .property-category {
      color: #e0e0e0;
    }
    .property-name {
      color: #e0e0e0;
    }
    .property-value {
      color: #e0e0e0;
      font-family: 'Courier New', monospace;
      word-break: break-all;
    }
    .empty-val {
      color: #505050;
      font-style: italic;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }
    .properties-table th:nth-child(1),
    .properties-table td:nth-child(1) { width: 11%; }
    .properties-table th:nth-child(2),
    .properties-table td:nth-child(2) { width: 22%; }
    .properties-table th:nth-child(3),
    .properties-table td:nth-child(3) { width: 27%; }
    .properties-table th:nth-child(4),
    .properties-table td:nth-child(4) { width: 40%; }
  </style>
</head>
<body>
  <div class="page-container">
  <div class="page-header">
    <h1>Facility Parameters</h1>
    <div class="subtitle">${escapeHtml(facilityName)}</div>
    <div class="urn">${escapeHtml(facilityURN)}</div>
  </div>
  <div class="page-body">
    <div id="loading" class="loading">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke-opacity="0.25"></circle>
        <path d="M4 12a8 8 0 018-8" stroke-opacity="0.75"></path>
      </svg>
      Loading facility parameters\u2026
    </div>
    <div id="content" class="hidden"></div>
  </div>
  </div>
</body>
</html>`;
}
