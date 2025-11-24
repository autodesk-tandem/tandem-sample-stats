import { tandemBaseURL, makeRequestOptionsPOST } from '../api.js';
import { QC, AttributeType } from '../../tandem/constants.js';
import { getSchemaCache } from '../state/schemaCache.js';
import { getDataTypeName } from '../utils.js';
import { viewAssetDetails } from './assetDetails.js';
import { createToggleFunction } from '../components/toggleHeader.js';

/**
 * Toggle search detail view
 */
const toggleSearchDetail = createToggleFunction({
  detailId: 'search-detail',
  summaryId: 'search-summary',
  toggleBtnId: 'toggle-search-btn',
  iconDownId: 'toggle-search-icon-down',
  iconUpId: 'toggle-search-icon-up'
});

/**
 * Display search interface
 * @param {HTMLElement} container - Container element
 * @param {string} facilityURN - Facility URN
 * @param {string} region - Region identifier
 * @param {Array} models - Array of model objects
 */
export async function displaySearch(container, facilityURN, region, models) {
  if (!facilityURN || !models || models.length === 0) {
    container.innerHTML = '<p class="text-dark-text-secondary text-xs">No models available for search.</p>';
    return;
  }

  // Build the header with toggle button
  const headerHtml = `
    <div class="flex items-center justify-between mb-3">
      <div class="text-xs text-dark-text-secondary">
        Search for elements by property value. Example: "Category.PropertyName = XYZ"
      </div>
      <button id="toggle-search-btn"
              class="p-2 hover:bg-dark-bg/50 rounded transition"
              title="Show more">
        <svg id="toggle-search-icon-down" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
        </svg>
        <svg id="toggle-search-icon-up" class="w-5 h-5 hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"></path>
        </svg>
      </button>
    </div>
  `;

  // Build the summary view (collapsed state)
  const summaryHtml = `<div id="search-summary"></div>`;

  // Build the detail view (initially hidden)
  const detailHtml = `
    <div id="search-detail" class="hidden space-y-4">
      
      <!-- Search Form -->
      <div class="space-y-3">
        <div>
          <label for="search-property-name" class="block text-xs font-medium text-dark-text mb-1">
            Property Name
          </label>
          <div class="relative">
            <input 
              type="text" 
              id="search-property-name" 
              list="property-suggestions"
              placeholder="Type to see suggestions..."
              autocomplete="off"
              class="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded text-xs text-dark-text placeholder-dark-text-secondary focus:outline-none focus:ring-2 focus:ring-tandem-blue focus:border-transparent"
            />
            <datalist id="property-suggestions"></datalist>
          </div>
          <p class="mt-3 text-xs text-dark-text-secondary">
            Format: <code class="px-1 py-0.5 bg-dark-bg rounded text-tandem-blue">Category.PropertyName</code>
            <br>
            Examples: <span class="text-dark-text">Common.Name</span>, <span class="text-dark-text">Identity Data.Mark</span>, <span class="text-dark-text">Dimensions.Area</span>
          </p>
        </div>
        
        <div>
          <label for="search-property-value" class="block text-xs font-medium text-dark-text mb-1">
            Property Value
          </label>
          <input 
            type="text" 
            id="search-property-value" 
            placeholder="e.g., 123, *floor*, or ^Concrete"
            class="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded text-xs text-dark-text placeholder-dark-text-secondary focus:outline-none focus:ring-2 focus:ring-tandem-blue focus:border-transparent"
          />
          <p class="mt-1 text-xs text-dark-text-secondary">
            Enter the value to search for. Use * for wildcards or regex patterns.
          </p>
        </div>
        
        <!-- Search Options -->
        <div class="grid grid-cols-2 gap-3" id="search-options-container">
          <!-- String Options -->
          <div id="string-match-options">
            <label class="block text-xs font-medium text-dark-text mb-2">Match Type</label>
            <div class="space-y-1.5">
              <label class="flex items-center cursor-pointer">
                <input 
                  type="radio" 
                  name="search-match-type" 
                  value="partial" 
                  checked
                  class="mr-2 text-tandem-blue focus:ring-tandem-blue"
                />
                <span class="text-xs text-dark-text">Partial Match</span>
              </label>
              <label class="flex items-center cursor-pointer">
                <input 
                  type="radio" 
                  name="search-match-type" 
                  value="exact"
                  class="mr-2 text-tandem-blue focus:ring-tandem-blue"
                />
                <span class="text-xs text-dark-text">Exact Match</span>
              </label>
              <label class="flex items-center cursor-pointer">
                <input 
                  type="radio" 
                  name="search-match-type" 
                  value="regex"
                  class="mr-2 text-tandem-blue focus:ring-tandem-blue"
                />
                <span class="text-xs text-dark-text">Regex / Wildcard</span>
              </label>
            </div>
          </div>
          
          <!-- Numeric Options -->
          <div id="numeric-operator-options" class="hidden">
            <label class="block text-xs font-medium text-dark-text mb-2">Comparison</label>
            <div class="space-y-1.5">
              <label class="flex items-center cursor-pointer">
                <input 
                  type="radio" 
                  name="search-numeric-operator" 
                  value="="
                  checked
                  class="mr-2 text-tandem-blue focus:ring-tandem-blue"
                />
                <span class="text-xs text-dark-text">Equal (=)</span>
              </label>
              <label class="flex items-center cursor-pointer">
                <input 
                  type="radio" 
                  name="search-numeric-operator" 
                  value="!="
                  class="mr-2 text-tandem-blue focus:ring-tandem-blue"
                />
                <span class="text-xs text-dark-text">Not Equal (≠)</span>
              </label>
              <label class="flex items-center cursor-pointer">
                <input 
                  type="radio" 
                  name="search-numeric-operator" 
                  value=">"
                  class="mr-2 text-tandem-blue focus:ring-tandem-blue"
                />
                <span class="text-xs text-dark-text">Greater Than (>)</span>
              </label>
              <label class="flex items-center cursor-pointer">
                <input 
                  type="radio" 
                  name="search-numeric-operator" 
                  value=">="
                  class="mr-2 text-tandem-blue focus:ring-tandem-blue"
                />
                <span class="text-xs text-dark-text">Greater or Equal (≥)</span>
              </label>
              <label class="flex items-center cursor-pointer">
                <input 
                  type="radio" 
                  name="search-numeric-operator" 
                  value="<"
                  class="mr-2 text-tandem-blue focus:ring-tandem-blue"
                />
                <span class="text-xs text-dark-text">Less Than (<)</span>
              </label>
              <label class="flex items-center cursor-pointer">
                <input 
                  type="radio" 
                  name="search-numeric-operator" 
                  value="<="
                  class="mr-2 text-tandem-blue focus:ring-tandem-blue"
                />
                <span class="text-xs text-dark-text">Less or Equal (≤)</span>
              </label>
            </div>
          </div>
          
          <!-- Boolean Options -->
          <div id="boolean-value-options" class="hidden col-span-2">
            <label class="block text-xs font-medium text-dark-text mb-2">Boolean Value</label>
            <div class="flex gap-4">
              <label class="flex items-center cursor-pointer">
                <input 
                  type="radio" 
                  name="search-boolean-value" 
                  value="true"
                  checked
                  class="mr-2 text-tandem-blue focus:ring-tandem-blue"
                />
                <span class="text-xs text-dark-text">True</span>
              </label>
              <label class="flex items-center cursor-pointer">
                <input 
                  type="radio" 
                  name="search-boolean-value" 
                  value="false"
                  class="mr-2 text-tandem-blue focus:ring-tandem-blue"
                />
                <span class="text-xs text-dark-text">False</span>
              </label>
            </div>
          </div>
          
          <div id="case-sensitive-options">
            <label class="block text-xs font-medium text-dark-text mb-2">Case Sensitivity</label>
            <label class="flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                id="search-case-sensitive"
                class="mr-2 text-tandem-blue focus:ring-tandem-blue rounded"
              />
              <span class="text-xs text-dark-text">Case Sensitive</span>
            </label>
            <p class="mt-1.5 text-xs text-dark-text-secondary">
              By default, search is case-insensitive
            </p>
          </div>
        </div>
        
        <div class="flex items-center space-x-2">
          <button 
            id="search-execute-btn"
            class="px-4 py-2 bg-tandem-blue hover:bg-blue-600 text-white text-xs font-medium rounded focus:outline-none focus:ring-2 focus:ring-tandem-blue focus:ring-offset-2 transition"
          >
            <svg class="w-4 h-4 inline-block mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
            </svg>
            Search
          </button>
          <button 
            id="search-clear-btn"
            class="px-4 py-2 bg-dark-border hover:bg-dark-bg text-dark-text text-xs font-medium rounded focus:outline-none focus:ring-2 focus:ring-dark-border transition"
          >
            Clear
          </button>
        </div>
      </div>
      
      <!-- Search Results -->
      <div id="search-results" class="hidden">
        <div class="border-t border-dark-border pt-4 mt-4">
          <h3 class="text-sm font-semibold text-dark-text mb-3">Search Results</h3>
          <div id="search-results-content"></div>
        </div>
      </div>
    </div>
  `;

  // Set the HTML
  container.innerHTML = headerHtml + summaryHtml + detailHtml;

  // Bind toggle button event listener
  const toggleBtn = document.getElementById('toggle-search-btn');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', toggleSearchDetail);
  }

  // Populate property suggestions from schema and build property metadata map
  const schemaCache = getSchemaCache();
  const propertyMap = new Map(); // propertyName -> { dataType, models }
  
  for (const modelURN in schemaCache) {
    const schema = schemaCache[modelURN];
    if (schema.attributes) {
      for (const attr of schema.attributes) {
        if (attr.category && attr.name) {
          const propName = `${attr.category}.${attr.name}`;
          if (!propertyMap.has(propName)) {
            propertyMap.set(propName, {
              dataType: attr.dataType,
              dataTypeName: getDataTypeName(attr.dataType),
              models: []
            });
          }
          propertyMap.get(propName).models.push(modelURN);
        }
      }
    }
  }
  
  // Sort and populate datalist
  const sortedProperties = Array.from(propertyMap.keys()).sort((a, b) => 
    a.toLowerCase().localeCompare(b.toLowerCase())
  );
  
  const datalist = container.querySelector('#property-suggestions');
  sortedProperties.forEach(prop => {
    const option = document.createElement('option');
    option.value = prop;
    datalist.appendChild(option);
  });
  
  console.log(`Loaded ${sortedProperties.length} unique properties for autocomplete`);

  // Set up event listeners (scoped to detail section)
  const detailSection = document.getElementById('search-detail');
  const searchBtn = detailSection.querySelector('#search-execute-btn');
  const clearBtn = detailSection.querySelector('#search-clear-btn');
  const propertyNameInput = detailSection.querySelector('#search-property-name');
  const propertyValueInput = detailSection.querySelector('#search-property-value');
  const resultsDiv = detailSection.querySelector('#search-results');
  const resultsContent = detailSection.querySelector('#search-results-content');
  
  const stringMatchOptions = detailSection.querySelector('#string-match-options');
  const numericOperatorOptions = detailSection.querySelector('#numeric-operator-options');
  const booleanValueOptions = detailSection.querySelector('#boolean-value-options');
  const caseSensitiveOptions = detailSection.querySelector('#case-sensitive-options');
  
  // Function to update UI based on property data type
  function updateSearchOptionsForDataType() {
    const propertyName = propertyNameInput.value.trim();
    const propMeta = propertyMap.get(propertyName);
    
    // Clear the value input when switching properties
    propertyValueInput.value = '';
    
    if (!propMeta) {
      // Unknown property - show string options by default
      stringMatchOptions.classList.remove('hidden');
      numericOperatorOptions.classList.add('hidden');
      booleanValueOptions.classList.add('hidden');
      caseSensitiveOptions.classList.remove('hidden');
      propertyValueInput.disabled = false;
      propertyValueInput.placeholder = 'e.g., 123, *floor*, or ^Concrete';
      return;
    }
    
    const dataType = propMeta.dataType;
    console.log(`Property "${propertyName}" has data type: ${propMeta.dataTypeName} (${dataType})`);
    
    // Check if numeric
    const isNumeric = (
      dataType === AttributeType.Integer ||
      dataType === AttributeType.Double ||
      dataType === AttributeType.Float
    );
    
    // Check if boolean
    const isBoolean = dataType === AttributeType.Boolean;
    
    if (isBoolean) {
      // Boolean: show boolean options, hide value input
      stringMatchOptions.classList.add('hidden');
      numericOperatorOptions.classList.add('hidden');
      booleanValueOptions.classList.remove('hidden');
      caseSensitiveOptions.classList.add('hidden');
      propertyValueInput.disabled = true;
      propertyValueInput.placeholder = 'Select True or False below';
    } else if (isNumeric) {
      // Numeric: show numeric operators, hide string options
      stringMatchOptions.classList.add('hidden');
      numericOperatorOptions.classList.remove('hidden');
      booleanValueOptions.classList.add('hidden');
      caseSensitiveOptions.classList.add('hidden');
      propertyValueInput.disabled = false;
      propertyValueInput.placeholder = 'e.g., 100 or 3.14';
    } else {
      // String or other: show string options
      stringMatchOptions.classList.remove('hidden');
      numericOperatorOptions.classList.add('hidden');
      booleanValueOptions.classList.add('hidden');
      caseSensitiveOptions.classList.remove('hidden');
      propertyValueInput.disabled = false;
      propertyValueInput.placeholder = 'e.g., 123, *floor*, or ^Concrete';
    }
  }
  
  // Update options when property name changes
  propertyNameInput.addEventListener('input', updateSearchOptionsForDataType);
  propertyNameInput.addEventListener('change', updateSearchOptionsForDataType);

  searchBtn.addEventListener('click', async () => {
    const propertyName = propertyNameInput.value.trim();
    if (!propertyName) {
      resultsContent.innerHTML = '<p class="text-yellow-500 text-xs">⚠️ Please enter a property name.</p>';
      resultsDiv.classList.remove('hidden');
      return;
    }
    
    const propMeta = propertyMap.get(propertyName);
    let searchOptions = {};
    
    if (propMeta) {
      const dataType = propMeta.dataType;
      const isNumeric = (
        dataType === AttributeType.Integer ||
        dataType === AttributeType.Double ||
        dataType === AttributeType.Float
      );
      const isBoolean = dataType === AttributeType.Boolean;
      
      if (isBoolean) {
        // Boolean search
        const boolValue = detailSection.querySelector('input[name="search-boolean-value"]:checked')?.value;
        searchOptions = {
          dataType: 'boolean',
          value: boolValue === 'true'
        };
      } else if (isNumeric) {
        // Numeric search
        const operator = detailSection.querySelector('input[name="search-numeric-operator"]:checked')?.value || '=';
        const value = propertyValueInput.value.trim();
        if (!value) {
          resultsContent.innerHTML = '<p class="text-yellow-500 text-xs">⚠️ Please enter a numeric value.</p>';
          resultsDiv.classList.remove('hidden');
          return;
        }
        const numValue = parseFloat(value);
        if (isNaN(numValue)) {
          resultsContent.innerHTML = '<p class="text-yellow-500 text-xs">⚠️ Please enter a valid number.</p>';
          resultsDiv.classList.remove('hidden');
          return;
        }
        searchOptions = {
          dataType: 'numeric',
          operator: operator,
          value: numValue
        };
      } else {
        // String search
        const matchType = detailSection.querySelector('input[name="search-match-type"]:checked')?.value || 'partial';
        const caseSensitive = detailSection.querySelector('#search-case-sensitive').checked;
        const value = propertyValueInput.value.trim();
        if (!value) {
          resultsContent.innerHTML = '<p class="text-yellow-500 text-xs">⚠️ Please enter a value to search for.</p>';
          resultsDiv.classList.remove('hidden');
          return;
        }
        searchOptions = {
          dataType: 'string',
          matchType: matchType,
          caseSensitive: caseSensitive,
          value: value
        };
      }
    } else {
      // Unknown property type - treat as string
      const matchType = detailSection.querySelector('input[name="search-match-type"]:checked')?.value || 'partial';
      const caseSensitive = detailSection.querySelector('#search-case-sensitive').checked;
      const value = propertyValueInput.value.trim();
      if (!value) {
        resultsContent.innerHTML = '<p class="text-yellow-500 text-xs">⚠️ Please enter a value to search for.</p>';
        resultsDiv.classList.remove('hidden');
        return;
      }
      searchOptions = {
        dataType: 'string',
        matchType: matchType,
        caseSensitive: caseSensitive,
        value: value
      };
    }

    await executeSearch(facilityURN, region, models, propertyName, searchOptions, resultsDiv, resultsContent);
  });

  clearBtn.addEventListener('click', () => {
    propertyNameInput.value = '';
    propertyValueInput.value = '';
    resultsDiv.classList.add('hidden');
    resultsContent.innerHTML = '';
  });

  // Allow Enter key to trigger search
  propertyNameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') searchBtn.click();
  });
  propertyValueInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') searchBtn.click();
  });
}

/**
 * Execute the property search
 * @param {string} facilityURN - Facility URN
 * @param {string} region - Region identifier
 * @param {Array} models - Array of model objects
 * @param {string} propertyName - Property name in "Category.PropertyName" format
 * @param {Object} searchOptions - Search options object with dataType, value, and type-specific options
 * @param {HTMLElement} resultsDiv - Results container div
 * @param {HTMLElement} resultsContent - Results content div
 */
async function executeSearch(facilityURN, region, models, propertyName, searchOptions, resultsDiv, resultsContent) {
  // Show loading state
  resultsContent.innerHTML = `
    <div class="flex items-center space-x-2 text-tandem-blue text-xs">
      <svg class="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      <span>Searching across ${models.length} model${models.length !== 1 ? 's' : ''}...</span>
    </div>
  `;
  resultsDiv.classList.remove('hidden');

  try {
    // Get schema cache to map property names to qualified columns
    const schemaCache = getSchemaCache();
    
    // Track which models have the property and which don't
    const modelsWithProperty = [];
    const modelsWithoutProperty = [];
    const allResults = [];
    
    for (const model of models) {
      const schema = schemaCache[model.modelId];
      if (!schema) {
        modelsWithoutProperty.push(model.label || model.modelId);
        continue;
      }
      
      // Try to find the qualified column for this property name
      let qualifiedColumn = null;
      
      // Search through attributes array
      if (schema.attributes) {
        for (const attr of schema.attributes) {
          const displayName = `${attr.category || 'Unknown'}.${attr.name || attr.id}`;
          if (displayName.toLowerCase() === propertyName.toLowerCase()) {
            qualifiedColumn = attr.id;
            break;
          }
        }
      }
      
      if (!qualifiedColumn) {
        // Try exact match with QC format (e.g., "z:LQ")
        if (propertyName.includes(':')) {
          qualifiedColumn = propertyName;
        }
      }
      
      if (!qualifiedColumn) {
        console.log(`Property "${propertyName}" not found in model ${model.label || model.modelId}`);
        modelsWithoutProperty.push(model.label || model.modelId);
        continue;
      }
      
      modelsWithProperty.push(model.label || model.modelId);
      console.log(`Searching model ${model.label || model.modelId} for property ${qualifiedColumn}`, searchOptions);
      
      // Fetch elements with this property
      const elements = await searchElementsByProperty(model.modelId, region, qualifiedColumn, searchOptions);
      
      if (elements.length > 0) {
        allResults.push({
          modelURN: model.modelId,
          modelName: model.label || 'Untitled Model',
          elements: elements,
          qualifiedColumn: qualifiedColumn
        });
      }
    }
    
    // Display results with context about property availability
    displaySearchResults(facilityURN, allResults, propertyName, searchOptions, modelsWithProperty, modelsWithoutProperty, resultsContent);
    
  } catch (error) {
    console.error('Error executing search:', error);
    resultsContent.innerHTML = `
      <p class="text-red-500 text-xs">❌ Error executing search: ${error.message}</p>
    `;
  }
}

/**
 * Search for elements by property value
 * @param {string} modelURN - Model URN
 * @param {string} region - Region identifier
 * @param {string} qualifiedColumn - Qualified column (e.g., "z:LQ")
 * @param {Object} searchOptions - Search options object with dataType, value, and type-specific options
 * @returns {Promise<Array>} Array of matching element objects
 */
async function searchElementsByProperty(modelURN, region, qualifiedColumn, searchOptions) {
  try {
    const payload = JSON.stringify({
      qualifiedColumns: [qualifiedColumn],
      includeHistory: false
    });

    const response = await fetch(`${tandemBaseURL}/modeldata/${modelURN}/scan`, makeRequestOptionsPOST(payload, region));

    if (!response.ok) {
      throw new Error(`Failed to fetch elements: ${response.statusText}`);
    }

    const data = await response.json();
    const elements = data.filter(item => typeof item === 'object' && item !== null && item[QC.Key]);

    console.log(`Found ${elements.length} elements in model ${modelURN}`);
    
    // Create matcher function based on data type
    let matcher;
    
    if (searchOptions.dataType === 'boolean') {
      // Boolean matching
      matcher = (val) => {
        if (typeof val === 'boolean') {
          return val === searchOptions.value;
        }
        // Handle string representations
        const valStr = String(val).toLowerCase();
        const targetStr = searchOptions.value ? 'true' : 'false';
        return valStr === targetStr || valStr === (searchOptions.value ? '1' : '0');
      };
    } else if (searchOptions.dataType === 'numeric') {
      // Numeric matching with operators
      const targetValue = searchOptions.value;
      const operator = searchOptions.operator;
      
      matcher = (val) => {
        const numVal = typeof val === 'number' ? val : parseFloat(val);
        if (isNaN(numVal)) return false;
        
        switch (operator) {
          case '=': return numVal === targetValue;
          case '!=': return numVal !== targetValue;
          case '>': return numVal > targetValue;
          case '>=': return numVal >= targetValue;
          case '<': return numVal < targetValue;
          case '<=': return numVal <= targetValue;
          default: return numVal === targetValue;
        }
      };
    } else {
      // String matching
      const matchType = searchOptions.matchType || 'partial';
      const caseSensitive = searchOptions.caseSensitive || false;
      const searchValue = searchOptions.value;
      
      if (matchType === 'regex') {
        // Convert wildcard patterns to regex, or use as-is if already a regex
        let pattern = searchValue;
        
        // Simple wildcard conversion: * -> .*, ? -> .
        if (!pattern.startsWith('^') && !pattern.includes('[') && !pattern.includes('(')) {
          pattern = pattern.replace(/\*/g, '.*').replace(/\?/g, '.');
        }
        
        try {
          const regex = new RegExp(pattern, caseSensitive ? '' : 'i');
          matcher = (val) => regex.test(String(val));
        } catch (e) {
          console.error('Invalid regex pattern:', e);
          // Fall back to partial match
          matcher = (val) => {
            const valStr = String(val);
            return caseSensitive 
              ? valStr.includes(searchValue)
              : valStr.toLowerCase().includes(searchValue.toLowerCase());
          };
        }
      } else if (matchType === 'exact') {
        matcher = (val) => {
          const valStr = String(val);
          return caseSensitive 
            ? valStr === searchValue
            : valStr.toLowerCase() === searchValue.toLowerCase();
        };
      } else {
        // Partial match (default)
        matcher = (val) => {
          const valStr = String(val);
          return caseSensitive 
            ? valStr.includes(searchValue)
            : valStr.toLowerCase().includes(searchValue.toLowerCase());
        };
      }
    }
    
    // Filter elements that have the matching property value
    const matchingElements = elements.filter(element => {
      const value = element[qualifiedColumn];
      if (!value) return false;
      
      // Handle array values
      if (Array.isArray(value)) {
        return value.some(v => matcher(v));
      }
      
      // Handle single values
      return matcher(value);
    });

    console.log(`Found ${matchingElements.length} matching elements`);
    return matchingElements;
  } catch (error) {
    console.error(`Error searching in model ${modelURN}:`, error);
    return [];
  }
}

/**
 * Display search results
 * @param {string} facilityURN - Facility URN
 * @param {Array} results - Search results grouped by model
 * @param {string} propertyName - Property name searched
 * @param {Object} searchOptions - Search options object
 * @param {Array} modelsWithProperty - List of model names that have this property
 * @param {Array} modelsWithoutProperty - List of model names that don't have this property
 * @param {HTMLElement} container - Container element
 */
function displaySearchResults(facilityURN, results, propertyName, searchOptions, modelsWithProperty, modelsWithoutProperty, container) {
  // Format search criteria for display
  let searchCriteria = '';
  if (searchOptions.dataType === 'boolean') {
    searchCriteria = searchOptions.value ? 'true' : 'false';
  } else if (searchOptions.dataType === 'numeric') {
    searchCriteria = `${searchOptions.operator} ${searchOptions.value}`;
  } else {
    searchCriteria = searchOptions.value;
  }
  // Show property availability info
  let html = '';
  
  if (modelsWithoutProperty.length > 0) {
    html += `
      <div class="mb-4 p-3 bg-yellow-900/20 border border-yellow-700/50 rounded">
        <div class="text-xs text-yellow-300">
          ℹ️ Property <strong>${propertyName}</strong> not found in ${modelsWithoutProperty.length} model${modelsWithoutProperty.length !== 1 ? 's' : ''}: 
          ${modelsWithoutProperty.map(m => `<span class="italic">${m}</span>`).join(', ')}
        </div>
      </div>
    `;
  }
  
  if (results.length === 0) {
    if (modelsWithProperty.length === 0) {
      container.innerHTML = html + `
        <div class="p-3 bg-red-900/20 border border-red-700/50 rounded">
          <p class="text-red-300 text-xs">
            ❌ Property <strong class="text-red-200">${propertyName}</strong> was not found in any model.
          </p>
          <p class="text-red-300 text-xs mt-2">
            Please check the property name format: <code class="px-1 py-0.5 bg-dark-bg rounded">Category.PropertyName</code>
          </p>
        </div>
      `;
    } else {
      container.innerHTML = html + `
        <p class="text-dark-text-secondary text-xs">
          No elements found with property <strong class="text-dark-text">${propertyName}</strong> 
          matching <strong class="text-dark-text">${searchCriteria}</strong>.
          <br>
          <span class="text-xs text-dark-text-secondary mt-1 inline-block">
            Searched ${modelsWithProperty.length} model${modelsWithProperty.length !== 1 ? 's' : ''} that have this property.
          </span>
        </p>
      `;
    }
    return;
  }

  // Calculate total matches
  const totalMatches = results.reduce((sum, r) => sum + r.elements.length, 0);

  html += `
    <div class="p-4 bg-dark-bg border border-dark-border rounded cursor-pointer hover:border-tandem-blue transition" 
         id="view-all-search-results"
         title="Click to view details of all ${totalMatches} matching element${totalMatches !== 1 ? 's' : ''}">
      <div class="text-sm text-dark-text">
        Found <strong class="text-tandem-blue">${totalMatches}</strong> element${totalMatches !== 1 ? 's' : ''} 
        across <strong class="text-tandem-blue">${results.length}</strong> model${results.length !== 1 ? 's' : ''}
      </div>
      <div class="text-xs text-dark-text-secondary mt-1">
        Click to view details of ${totalMatches} matching element${totalMatches !== 1 ? 's' : ''}
      </div>
    </div>
  `;

  container.innerHTML = html;

  // Add click event listener to view all results
  const viewAllBtn = container.querySelector('#view-all-search-results');
  if (viewAllBtn) {
    viewAllBtn.addEventListener('click', () => {
      // Collect all element keys grouped by model
      const elementsByModel = results.map(result => ({
        modelURN: result.modelURN,
        modelName: result.modelName,
        keys: result.elements.map(el => el[QC.Key])
      }));

      const title = `Search Results: ${propertyName} = ${searchCriteria}`;
      viewAssetDetails(elementsByModel, title, facilityURN, region);
    });
  }
}

