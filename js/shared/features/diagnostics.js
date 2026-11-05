import { createToggleFunction } from '../components/toggleHeader.js';
import { getSchemaCache } from '../state/schemaCache.js';
import { getDataTypeName, isDefaultModel } from '../utils.js';

/**
 * Toggle diagnostics detail view
 */
const toggleDiagnosticsDetail = createToggleFunction({
  detailId: 'diagnostics-detail',
  summaryId: 'diagnostics-summary',
  toggleBtnId: 'toggle-diagnostics-btn',
  iconDownId: 'toggle-diagnostics-icon-down',
  iconUpId: 'toggle-diagnostics-icon-up'
});

/**
 * Check if a property group has already been processed (to avoid duplicates in results)
 * @param {Array} duplicatePropsArray - Array of duplicate property groups
 * @param {string} categoryName - Category name
 * @param {string} propName - Property name
 * @returns {boolean}
 */
function processedPropertyAlready(duplicatePropsArray, categoryName, propName) {
  for (let j = 0; j < duplicatePropsArray.length; j++) {
    const tmpArr = duplicatePropsArray[j];
    if (tmpArr && tmpArr[0].category === categoryName && tmpArr[0].name === propName) {
      return true;
    }
  }
  return false;
}

/**
 * Check for duplicate properties in a single model's schema
 * Only checks user-defined properties (those with IDs starting with "z:")
 * @param {Array} attributes - Array of attribute objects from schema
 * @returns {Array} Array of duplicate property groups
 */
function checkForDuplicatePropertiesPerModel(attributes) {
  let duplicatePropsArray = [];
  
  // Filter to only user-defined properties (z: prefix)
  const userDefinedProps = attributes.filter(attr => attr.id && attr.id.startsWith('z:'));

  for (let i = 0; i < userDefinedProps.length; i++) {
    const categoryName = userDefinedProps[i].category;
    const propName = userDefinedProps[i].name;

    // Make sure we haven't already processed this one
    if (!processedPropertyAlready(duplicatePropsArray, categoryName, propName)) {
      // Exhaustively search the schema for the same category + name
      const duplicateProps = [];
      for (let k = 0; k < userDefinedProps.length; k++) {
        if (i !== k) { // Don't compare against ourselves
          if (userDefinedProps[k].category === categoryName && userDefinedProps[k].name === propName) {
            duplicateProps.push(userDefinedProps[k]);
          }
        }
      }
      if (duplicateProps.length) {
        duplicateProps.push(userDefinedProps[i]); // Add the original we were searching for
        duplicatePropsArray.push(duplicateProps);
      }
    }
  }

  return duplicatePropsArray;
}

/**
 * Check for properties with dots in category or name (TandemConnect issue)
 * Only checks user-defined properties (those with IDs starting with "z:")
 * @param {Array} attributes - Array of attribute objects from schema
 * @returns {Array} Array of properties with dots
 */
function checkForPropertiesWithDots(attributes) {
  const propsWithDots = [];
  
  // Filter to only user-defined properties (z: prefix)
  const userDefinedProps = attributes.filter(attr => attr.id && attr.id.startsWith('z:'));

  for (let i = 0; i < userDefinedProps.length; i++) {
    const attr = userDefinedProps[i];
    const hasDotInCategory = attr.category && attr.category.includes('.');
    const hasDotInName = attr.name && attr.name.includes('.');

    if (hasDotInCategory || hasDotInName) {
      propsWithDots.push({
        ...attr,
        issueType: hasDotInCategory && hasDotInName ? 'both' : (hasDotInCategory ? 'category' : 'name')
      });
    }
  }

  return propsWithDots;
}

/**
 * Display diagnostics for the facility
 * @param {HTMLElement} container - DOM element to render into
 * @param {string} facilityURN - Facility URN
 * @param {Array} models - Array of model objects
 */
export async function displayDiagnostics(container, facilityURN, models) {
  if (!models || models.length === 0) {
    container.innerHTML = '<p class="text-dark-text-secondary">No models found in this facility.</p>';
    return;
  }

  // Get schema cache
  const schemaCache = getSchemaCache();

  // Run diagnostics across all models
  let totalIssues = 0;
  let allDuplicates = [];
  let allDotsIssues = [];

  for (const modelURN in schemaCache) {
    const schema = schemaCache[modelURN];
    if (!schema || !schema.attributes) continue;

    const duplicates = checkForDuplicatePropertiesPerModel(schema.attributes);
    const dotsIssues = checkForPropertiesWithDots(schema.attributes);
    
    // Determine model name - check if it's the default model first
    let modelName;
    if (isDefaultModel(facilityURN, modelURN)) {
      // Default model - use special label
      modelName = '** Default Model **';
    } else {
      // Try to find model in the models array
      const foundModel = models.find(m => m.modelId === modelURN);
      if (foundModel && foundModel.label) {
        modelName = foundModel.label;
      } else {
        modelName = 'Untitled Model';
      }
    }

    if (duplicates.length > 0) {
      allDuplicates.push({
        modelURN,
        modelName,
        duplicates
      });
      totalIssues += duplicates.length;
    }

    if (dotsIssues.length > 0) {
      allDotsIssues.push({
        modelURN,
        modelName,
        dotsIssues
      });
      totalIssues += dotsIssues.length;
    }
  }

  // Build header with toggle button
  let headerHtml = `
    <div class="flex items-center justify-between mb-3">
      <div class="flex items-center space-x-2">
        <div class="text-xl font-bold ${totalIssues > 0 ? 'text-orange-400' : 'text-green-400'}">${totalIssues}</div>
        <div class="text-sm text-dark-text-secondary">
          <div>${totalIssues === 0 ? 'No issues detected' : `Issue${totalIssues !== 1 ? 's' : ''} detected`}</div>
        </div>
      </div>
      <button id="toggle-diagnostics-btn"
              class="p-2 hover:bg-dark-bg/50 rounded transition"
              title="Show more">
        <svg id="toggle-diagnostics-icon-down" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
        </svg>
        <svg id="toggle-diagnostics-icon-up" class="w-5 h-5 hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"></path>
        </svg>
      </button>
    </div>
  `;

  // Build summary view (collapsed state)
  let summaryHtml = `
    <div id="diagnostics-summary"></div>
  `;

  // Build detailed view
  let detailHtml = '<div id="diagnostics-detail" class="hidden space-y-4">';

  if (totalIssues === 0) {
    detailHtml += `
      <div class="text-center py-6">
        <svg class="w-16 h-16 mx-auto text-green-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
        <p class="text-dark-text font-semibold">All Clear!</p>
        <p class="text-dark-text-secondary text-sm mt-1">No duplicate properties or naming issues detected.</p>
      </div>
    `;
  } else {
    // Show duplicate properties issues
    if (allDuplicates.length > 0) {
      detailHtml += `
        <div class="border border-orange-500/30 rounded p-4 bg-orange-500/10">
          <div class="flex items-center gap-2 mb-3">
            <svg class="w-5 h-5 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
            </svg>
            <h3 class="text-sm font-semibold text-orange-400">Duplicate User-Defined Properties</h3>
          </div>
          <p class="text-xs text-dark-text-secondary mb-3">These user-defined properties have the same Category and Name, which can cause confusion:</p>
      `;

      allDuplicates.forEach(modelData => {
        detailHtml += `
          <div class="mb-4">
            <h4 class="text-xs font-semibold text-dark-text mb-2">Model: ${modelData.modelName}</h4>
        `;

        modelData.duplicates.forEach((duplicateGroup, groupIndex) => {
          if (groupIndex > 0) {
            detailHtml += '<div class="border-t border-dark-border my-2"></div>';
          }
          
          detailHtml += `
            <div class="bg-dark-bg/50 rounded p-2 mb-2">
              <div class="text-xs font-semibold text-orange-300 mb-1">
                ${duplicateGroup[0].category} | ${duplicateGroup[0].name}
              </div>
              <table class="w-full text-xs">
                <thead class="bg-dark-bg/30">
                  <tr>
                    <th class="px-2 py-1 text-left font-semibold text-dark-text-secondary w-1/2">ID</th>
                    <th class="px-2 py-1 text-left font-semibold text-dark-text-secondary w-1/2">Data Type</th>
                  </tr>
                </thead>
                <tbody>
          `;

          duplicateGroup.forEach(prop => {
            const dataTypeName = getDataTypeName(prop.dataType);
            detailHtml += `
              <tr class="border-t border-dark-border/50">
                <td class="px-2 py-1 font-mono text-dark-text-secondary">${prop.id}</td>
                <td class="px-2 py-1 text-dark-text">${dataTypeName}</td>
              </tr>
            `;
          });

          detailHtml += `
                </tbody>
              </table>
            </div>
          `;
        });

        detailHtml += '</div>';
      });

      detailHtml += '</div>';
    }

    // Show properties with dots issues
    if (allDotsIssues.length > 0) {
      detailHtml += `
        <div class="border border-yellow-500/30 rounded p-4 bg-yellow-500/10">
          <div class="flex items-center gap-2 mb-3">
            <svg class="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
            </svg>
            <h3 class="text-sm font-semibold text-yellow-400">User-Defined Properties with Dots in Names</h3>
          </div>
          <p class="text-xs text-dark-text-secondary mb-3">Dots (.) in category or property names of user-defined properties can cause issues with TandemConnect:</p>
      `;

      allDotsIssues.forEach(modelData => {
        detailHtml += `
          <div class="mb-4">
            <h4 class="text-xs font-semibold text-dark-text mb-2">Model: ${modelData.modelName}</h4>
            <div class="overflow-x-auto">
              <table class="w-full text-xs">
                <thead class="bg-dark-bg/50">
                  <tr>
                    <th class="px-2 py-1 text-left font-semibold text-dark-text w-1/4">Category</th>
                    <th class="px-2 py-1 text-left font-semibold text-dark-text w-1/4">Name</th>
                    <th class="px-2 py-1 text-left font-semibold text-dark-text font-mono w-1/4">ID</th>
                    <th class="px-2 py-1 text-left font-semibold text-dark-text w-1/4">Issue</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-dark-border">
        `;

        modelData.dotsIssues.forEach(prop => {
          const issueText = prop.issueType === 'both' ? 'Category & Name' : 
                           prop.issueType === 'category' ? 'Category' : 'Name';
          detailHtml += `
            <tr class="hover:bg-dark-bg/30">
              <td class="px-2 py-1 text-dark-text ${prop.issueType === 'category' || prop.issueType === 'both' ? 'text-yellow-400 font-semibold' : ''}">${prop.category}</td>
              <td class="px-2 py-1 text-dark-text ${prop.issueType === 'name' || prop.issueType === 'both' ? 'text-yellow-400 font-semibold' : ''}">${prop.name}</td>
              <td class="px-2 py-1 text-dark-text-secondary font-mono">${prop.id}</td>
              <td class="px-2 py-1 text-yellow-400 text-xs">${issueText}</td>
            </tr>
          `;
        });

        detailHtml += `
                </tbody>
              </table>
            </div>
          </div>
        `;
      });

      detailHtml += '</div>';
    }
  }

  detailHtml += '</div>';

  container.innerHTML = headerHtml + summaryHtml + detailHtml;

  // Attach toggle event listener
  const toggleBtn = document.getElementById('toggle-diagnostics-btn');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', toggleDiagnosticsDetail);
  }
}

