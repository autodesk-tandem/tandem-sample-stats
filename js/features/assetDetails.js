import { tandemBaseURL, makeRequestOptionsPOST } from '../api.js';
import { QC, ColumnFamilies, KeyFlags, kElementFlagsSize, kElementIdWithFlagsSize } from '../../tandem/constants.js';
import { getSchemaCache } from '../state/schemaCache.js';
import { getCategoryName, compareQualifiedColumnIds } from '../utils.js';
import { makeXrefKey, toFullKey, toShortKey, decodeXref } from '../../tandem/keys.js';

/**
 * Generate HTML page for asset details
 * @param {Array<{modelURN: string, modelName: string, keys: Array<string>}>} elementsByModel - Elements grouped by model
 * @param {string} title - Page title
 * @param {string} facilityURN - Facility URN for link generation
 * @returns {string} HTML page content
 */
function generateAssetDetailsHTML(elementsByModel, title, facilityURN, region, showLinks = true) {
  // Embed all data as JSON for client-side processing
  const dataJSON = JSON.stringify(elementsByModel).replace(/</g, '\\u003c').replace(/>/g, '\\u003e');
  const tokenValue = window.sessionStorage.token || '';
  const regionValue = region || 'US';
  const showLinksValue = showLinks ? 'true' : 'false';
  const facilityURNValue = facilityURN || '';
  
  // Embed functions from tandem/keys.js
  const makeXrefKeySource = makeXrefKey.toString();
  const toFullKeySource = toFullKey.toString();
  const toShortKeySource = toShortKey.toString();
  const decodeXrefSource = decodeXref.toString();
  
  // Get and embed schema cache for property lookups
  // Convert Map to object for JSON serialization
  const schemaCache = getSchemaCache();
  const schemaCacheForJSON = {};
  
  for (const [modelURN, schema] of Object.entries(schemaCache)) {
    schemaCacheForJSON[modelURN] = {
      attributes: schema.attributes,
      lookup: schema.lookup ? Object.fromEntries(schema.lookup) : {}
    };
  }
  
  const schemaCacheJSON = JSON.stringify(schemaCacheForJSON).replace(/</g, '\\u003c').replace(/>/g, '\\u003e');
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Asset Details</title>
  <script src="https://unpkg.com/xlsx-js-style@1.2.0/dist/xlsx.bundle.js"></script>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background-color: #1a1a1a;
      color: #e0e0e0;
      padding: 20px;
    }
    .container {
      max-width: 1400px;
      margin: 0 auto;
    }
    .header {
      background: #2a2a2a;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 20px;
      border: 1px solid #404040;
    }
    .header-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
    }
    h1 {
      margin: 0;
      color: #0696D7;
      font-size: 24px;
      font-weight: 600;
    }
    .export-btn {
      background: #0696D7;
      color: white;
      border: none;
      padding: 0 16px;
      border-radius: 4px;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.2s;
      display: flex;
      align-items: center;
      gap: 6px;
      height: 36px;
      min-width: 160px;
    }
    .export-btn:hover {
      background: #0580b8;
    }
    .export-btn:disabled {
      background: #404040;
      cursor: not-allowed;
    }
    .info {
      font-size: 12px;
      color: #a0a0a0;
    }
    .stats {
      display: flex;
      gap: 30px;
      margin-top: 20px;
    }
    .stat-item {
      display: flex;
      flex-direction: column;
    }
    .stat-label {
      font-size: 11px;
      color: #808080;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .stat-value {
      font-size: 24px;
      font-weight: 600;
      color: #0696D7;
    }
    .loading {
      text-align: center;
      padding: 40px;
      color: #0696D7;
      font-size: 16px;
    }
    .model-section {
      background: #2a2a2a;
      border-radius: 8px;
      border: 1px solid #404040;
      overflow: hidden;
      margin-bottom: 20px;
    }
    .model-header {
      background: linear-gradient(to right, rgba(67, 56, 202, 0.3), rgba(67, 56, 202, 0.3));
      padding: 12px 20px;
      border-bottom: 1px solid #404040;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .model-header-left {
      flex: 1;
    }
    .model-name {
      font-size: 16px;
      font-weight: 600;
      color: #e0e0e0;
    }
    .model-urn {
      font-size: 12px;
      font-family: 'Courier New', monospace;
      color: #a0a0a0;
      margin-top: 4px;
    }
    .model-count {
      font-size: 12px;
      color: #a0a0a0;
      margin-top: 4px;
    }
    .view-keys-btn {
      background: #0696D7;
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 4px;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.2s;
      height: 36px;
      min-width: 110px;
    }
    .view-keys-btn:hover {
      background: #0580b8;
    }
    .elements-list {
      padding: 0;
    }
    .element-item {
      border-bottom: 1px solid #404040;
    }
    .element-item:last-child {
      border-bottom: none;
    }
    .element-header {
      padding: 12px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      cursor: pointer;
      transition: background 0.2s;
    }
    .element-header:hover {
      background: #333333;
    }
    .element-basic-info {
      flex: 1;
    }
    .element-name {
      font-size: 14px;
      font-weight: 600;
      color: #e0e0e0;
      margin-bottom: 4px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .category-badge {
      display: inline-block;
      padding: 2px 8px;
      font-size: 11px;
      font-weight: 500;
      background: linear-gradient(to right, rgba(6, 150, 215, 0.3), rgba(6, 150, 215, 0.4));
      color: #4fc3f7;
      border-radius: 4px;
    }
    .classification-badge {
      display: inline-block;
      padding: 2px 8px;
      font-size: 11px;
      font-weight: 500;
      background: linear-gradient(to right, rgba(34, 197, 94, 0.3), rgba(22, 163, 74, 0.3));
      color: #86efac;
      border-radius: 4px;
    }
    .element-key {
      font-size: 11px;
      font-family: 'Courier New', monospace;
      color: #808080;
    }
    .element-toggle {
      padding: 8px 16px;
      background: #0696D7;
      color: white;
      border: none;
      border-radius: 4px;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.2s;
      height: 36px;
      min-width: 110px;
    }
    .element-toggle:hover {
      background: #057ab5;
    }
    .element-toggle.loading {
      background: #666;
      cursor: wait;
    }
    .copy-link-btn {
      background: none;
      border: none;
      color: #808080;
      cursor: pointer;
      font-size: 14px;
      padding: 4px;
      transition: color 0.2s, transform 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      border-radius: 4px;
      margin-right: 8px;
    }
    .copy-link-btn:hover {
      background: #333333;
      color: #0696D7;
    }
    .copy-link-btn:active {
      transform: scale(0.95);
    }
    .copy-link-btn.copied {
      color: #22c55e;
    }
    .bbox-btn {
      background: none;
      border: none;
      color: #808080;
      cursor: pointer;
      font-size: 14px;
      padding: 4px;
      transition: color 0.2s, transform 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      border-radius: 4px;
      margin-right: 8px;
    }
    .bbox-btn:hover {
      background: #333333;
      color: #0696D7;
    }
    .bbox-btn:active { transform: scale(0.95); }
    .bbox-btn:disabled { cursor: wait; opacity: 0.5; }
    #bbox-popup {
      position: fixed;
      background: #2a2a2a;
      border: 1px solid #404040;
      border-radius: 6px;
      padding: 12px 16px;
      z-index: 9999;
      box-shadow: 0 4px 16px rgba(0,0,0,0.6);
      min-width: 270px;
    }
    .bbox-popup-title { font-size: 11px; font-weight: 600; color: #0696D7; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px; }
    .bbox-popup-table { border-collapse: collapse; font-size: 12px; width: 100%; }
    .bbox-popup-table th { text-align: center; padding: 3px 10px; color: #a0a0a0; font-size: 11px; border-bottom: 1px solid #404040; }
    .bbox-popup-table td { text-align: right; padding: 4px 10px; font-family: monospace; color: #e0e0e0; }
    .bbox-popup-table .bbox-axis-label { text-align: left; color: #a0a0a0; font-family: sans-serif; font-size: 11px; }
    .bbox-popup-none { font-size: 12px; color: #a0a0a0; }
    .bbox-popup-footer { margin-top: 10px; display: flex; justify-content: flex-end; }
    .bbox-copy-btn { background: none; border: 1px solid #404040; color: #a0a0a0; border-radius: 4px; padding: 3px 10px; font-size: 11px; cursor: pointer; transition: color 0.2s, border-color 0.2s; }
    .bbox-copy-btn:hover { color: #0696D7; border-color: #0696D7; }
    .bbox-copy-btn.copied { color: #22c55e; border-color: #22c55e; }
    .element-details {
      padding: 16px 20px;
      background: #1a1a1a;
      display: none;
    }
    .element-details.visible {
      display: block;
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
      content: ' ↑';
      color: #0696D7;
    }
    .properties-table th.sorted-desc::after {
      content: ' ↓';
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
    .prop-hint {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 11px;
      color: #808080;
      margin-left: 4px;
      white-space: nowrap;
    }
    .json-view-btn {
      background: none;
      border: 1px solid #404040;
      cursor: pointer;
      color: #a0a0a0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 11px;
      padding: 1px 7px;
      border-radius: 3px;
      transition: border-color 0.15s, color 0.15s;
    }
    .json-view-btn:hover {
      border-color: #808080;
      color: #e0e0e0;
    }
    .json-pre {
      background: #1a1a1a;
      border: 1px solid #333;
      border-radius: 4px;
      padding: 12px;
      font-family: 'Courier New', monospace;
      font-size: 12px;
      color: #e0e0e0;
      overflow-x: auto;
      white-space: pre;
      line-height: 1.5;
    }
    .json-key   { color: #9cdcfe; }
    .json-str   { color: #ce9178; }
    .json-num   { color: #b5cea8; }
    .json-bool  { color: #569cd6; }
    .json-null  { color: #569cd6; }
    .error-message {
      padding: 20px;
      text-align: center;
      color: #ff6b6b;
    }
    .props-section {
      margin-bottom: 4px;
    }
    .props-section-type {
      margin-top: 16px;
    }
    .props-section-label {
      font-size: 11px;
      font-weight: 600;
      color: #0696D7;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding: 6px 12px 6px 12px;
      background: rgba(6, 150, 215, 0.08);
      border-bottom: 1px solid rgba(6, 150, 215, 0.3);
    }
    .props-section-type .props-section-label {
      color: #a78bfa;
      background: rgba(167, 139, 250, 0.08);
      border-bottom-color: rgba(167, 139, 250, 0.25);
    }
    .properties-table th:nth-child(1),
    .properties-table td:nth-child(1) { width: 11%; }
    .properties-table th:nth-child(2),
    .properties-table td:nth-child(2) { width: 22%; }
    .properties-table th:nth-child(3),
    .properties-table td:nth-child(3) { width: 27%; }
    .properties-table th:nth-child(4),
    .properties-table td:nth-child(4) { width: 40%; }
    /* Modal styles */
    .keys-modal {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.8);
      z-index: 1000;
      padding: 20px;
      overflow-y: auto;
    }
    .keys-modal.active {
      display: flex;
      justify-content: center;
      align-items: flex-start;
      padding-top: 60px;
    }
    .keys-modal-content {
      background: #2a2a2a;
      border-radius: 8px;
      border: 1px solid #404040;
      max-width: 800px;
      width: 100%;
      max-height: 80vh;
      display: flex;
      flex-direction: column;
    }
    .keys-modal-header {
      padding: 20px;
      border-bottom: 1px solid #404040;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .keys-modal-title {
      font-size: 18px;
      font-weight: 600;
      color: #0696D7;
      margin: 0;
    }
    .keys-modal-close {
      background: none;
      border: none;
      color: #a0a0a0;
      font-size: 24px;
      cursor: pointer;
      padding: 0;
      width: 30px;
      height: 30px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: color 0.2s;
    }
    .keys-modal-close:hover {
      color: #e0e0e0;
    }
    .keys-modal-body {
      padding: 20px;
      overflow-y: auto;
    }
    .keys-modal-subtitle {
      margin-bottom: 15px;
    }
    .keys-modal-model-name {
      font-size: 14px;
      font-weight: 600;
      color: #e0e0e0;
      margin-bottom: 4px;
    }
    .keys-modal-model-urn {
      font-size: 11px;
      color: #a0a0a0;
      font-family: 'Courier New', monospace;
    }
    .keys-textarea {
      width: 100%;
      background: #1a1a1a;
      border: 1px solid #404040;
      border-radius: 4px;
      color: #e0e0e0;
      font-family: 'Courier New', monospace;
      font-size: 12px;
      padding: 10px;
      resize: vertical;
      min-height: 200px;
    }
    .keys-modal-footer {
      padding: 15px 20px;
      border-top: 1px solid #404040;
      display: flex;
      justify-content: flex-end;
      gap: 10px;
    }
    .keys-modal-btn {
      padding: 8px 16px;
      border-radius: 4px;
      font-size: 14px;
      cursor: pointer;
      border: none;
      transition: background 0.2s;
    }
    .keys-modal-btn-primary {
      background: #0696D7;
      color: white;
    }
    .keys-modal-btn-primary:hover {
      background: #0580b8;
    }
    /* Ref drill-down */
    .ref-drill-btn {
      background: none;
      border: none;
      cursor: pointer;
      color: #4fc3f7;
      font-family: 'Courier New', monospace;
      font-size: 12px;
      text-align: left;
      padding: 2px 6px;
      border-radius: 3px;
      border: 1px solid transparent;
      transition: background 0.15s, border-color 0.15s;
      word-break: break-all;
      display: inline-flex;
      align-items: baseline;
      gap: 4px;
    }
    .ref-drill-btn:hover {
      background: rgba(79, 195, 247, 0.12);
      border-color: rgba(79, 195, 247, 0.3);
      color: #81d4fa;
    }
    .ref-drill-btn .ref-arrow {
      font-size: 10px;
      opacity: 0.6;
      flex-shrink: 0;
    }
    /* Ref detail modal */
    #ref-modal {
      display: none;
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0,0,0,0.85);
      z-index: 2000;
      overflow: hidden;
      padding: 40px 20px;
      box-sizing: border-box;
    }
    #ref-modal.active {
      display: flex;
      justify-content: center;
      align-items: flex-start;
    }
    #ref-modal .ref-modal-content {
      background: #2a2a2a;
      border-radius: 8px;
      border: 1px solid #4fc3f7;
      max-width: 1000px;
      width: 100%;
      max-height: 100%;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    #ref-modal .ref-modal-header {
      padding: 16px 20px;
      border-bottom: 1px solid #404040;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      flex-shrink: 0;
      gap: 12px;
    }
    #ref-modal .ref-modal-header-left {
      flex: 1;
      min-width: 0;
    }
    #ref-modal .ref-modal-title {
      font-size: 16px;
      font-weight: 600;
      color: #4fc3f7;
      margin: 0 0 4px 0;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
    }
    #ref-modal .ref-modal-subtitle {
      font-size: 11px;
      font-family: 'Courier New', monospace;
      color: #808080;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    #ref-modal .ref-modal-close {
      background: none;
      border: none;
      color: #a0a0a0;
      font-size: 24px;
      cursor: pointer;
      padding: 0;
      width: 30px;
      height: 30px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    #ref-modal .ref-modal-close:hover { color: #e0e0e0; }
    #ref-modal .ref-modal-body {
      padding: 16px 20px;
      overflow-y: auto;
      flex: 1;
      min-height: 0;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="header-top">
        <h1>${title}</h1>
        <button id="export-btn" class="export-btn">
          <span>📊</span>
          <span>Export to Excel</span>
        </button>
      </div>
      <div class="stats">
        <div class="stat-item">
          <span class="stat-label">Total Models</span>
          <span class="stat-value" id="stat-models">0</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Total Elements</span>
          <span class="stat-value" id="stat-elements">0</span>
        </div>
      </div>
    </div>
    
    <div id="content-container">
      <div class="loading">Loading element details...</div>
    </div>
  </div>
  
  <!-- Modal for viewing element keys -->
  <div id="keys-modal" class="keys-modal">
    <div class="keys-modal-content">
      <div class="keys-modal-header">
        <h2 class="keys-modal-title" id="keys-modal-title">Element Keys</h2>
        <button class="keys-modal-close" id="keys-modal-close">&times;</button>
      </div>
      <div class="keys-modal-body">
        <div class="keys-modal-subtitle">
          <div class="keys-modal-model-name" id="keys-modal-model-name"></div>
          <div class="keys-modal-model-urn" id="keys-modal-model-urn"></div>
        </div>
        <textarea readonly class="keys-textarea" id="keys-textarea" rows="15"></textarea>
      </div>
      <div class="keys-modal-footer">
        <button class="keys-modal-btn keys-modal-btn-primary" id="keys-copy-btn">Copy All</button>
      </div>
    </div>
  </div>
  
  <!-- Modal for ref drill-down -->
  <div id="ref-modal">
    <div class="ref-modal-content">
      <div class="ref-modal-header">
        <div class="ref-modal-header-left">
          <h2 class="ref-modal-title" id="ref-modal-title">Referenced Element</h2>
          <div class="ref-modal-subtitle" id="ref-modal-subtitle"></div>
        </div>
        <button class="ref-modal-close" id="ref-modal-close">&times;</button>
      </div>
      <div class="ref-modal-body" id="ref-modal-body"></div>
    </div>
  </div>

  <script>
    const DATA = ${dataJSON};
    const API_BASE = '${tandemBaseURL}';
    const TOKEN = '${tokenValue}';
    const FACILITY_URN = '${facilityURNValue}';
    const REGION = '${regionValue}';
    const SHOW_LINKS = ${showLinksValue};
    const SCHEMA_CACHE = ${schemaCacheJSON};
    
    // Constants from tandem/constants.js
    const KeyFlags = {
      Physical: ${KeyFlags.Physical},
      Logical: ${KeyFlags.Logical}
    };
    const kElementFlagsSize = ${kElementFlagsSize};
    const kElementIdWithFlagsSize = ${kElementIdWithFlagsSize};
    const kModelIdSize = 16;
    const kElementIdSize = 20;
    
    // Track which elements have loaded details
    const loadedDetails = new Map();
    
    // Helper function for URL-safe base64 (required by makeXrefKey and toFullKey)
    function makeWebsafe(urn) {
      return urn.replace(/\\+/g, '-')
        .replace(/\\//g, '_')
        .replace(/=+$/g, '');
    }
    
    // Reuse functions from tandem/keys.js
    ${toFullKeySource}
    
    ${makeXrefKeySource}
    
    ${toShortKeySource}
    
    ${decodeXrefSource}
    
    // AttributeType constants (matches viewer/src/dt/schema/Attribute.js and dt-server attribute.go)
    const AttributeType = {
      DbKey: 11,       // single link to another element (same model)
      DbKeyList: 12,   // list of links to elements within the same model (l: family)
      ExDbKeyList: 13  // list of links to elements in external models (x: family)
    };

    // Helper function to look up property display name and dataType from schema
    function getPropertyDisplayInfo(modelURN, qualifiedProp) {
      if (!SCHEMA_CACHE[modelURN]) {
        return { category: '', name: qualifiedProp, dataType: null };
      }
      
      const schema = SCHEMA_CACHE[modelURN];
      const attr = schema.lookup?.[qualifiedProp];
      
      if (attr) {
        return {
          category: attr.category || '',
          name: attr.name || qualifiedProp,
          dataType: attr.dataType ?? null
        };
      }
      
      return { category: '', name: qualifiedProp, dataType: null };
    }
    
    async function fetchElementDetails(modelURN, elementKeys) {
      const payload = JSON.stringify({
        families: ['n', 'l', 'x', 'r', 'z'],
        keys: elementKeys,
        includeHistory: false
      });
      
      const response = await fetch(API_BASE + '/modeldata/' + modelURN + '/scan', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + TOKEN,
          'Content-Type': 'application/json',
          'Region': REGION
        },
        body: payload
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch details: ' + response.statusText);
      }
      
      const data = await response.json();
      // Filter out version string
      return data.filter(item => typeof item === 'object' && item !== null && item['k']);
    }
    
    async function fetchElementNames(modelURN, elementKeys) {
      const payload = JSON.stringify({
        qualifiedColumns: ['n:c', 'n:!n', 'n:n', 'n:!v', 'n:v'],
        keys: elementKeys,
        includeHistory: false
      });
      
      const response = await fetch(API_BASE + '/modeldata/' + modelURN + '/scan', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + TOKEN,
          'Content-Type': 'application/json',
          'Region': REGION
        },
        body: payload
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch names: ' + response.statusText);
      }
      
      const data = await response.json();
      // Filter out version string - 'k' (key) is always returned automatically
      return data.filter(item => typeof item === 'object' && item !== null && item['k']);
    }
    
    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }
    
    function formatPropertyValue(value) {
      if (value === null || value === undefined) return '-';
      if (Array.isArray(value)) {
        if (value.length === 0) return '-';
        if (value.length === 1) return escapeHtml(String(value[0]));
        return escapeHtml(value.join(', '));
      }
      return escapeHtml(String(value));
    }
    
    function organizeProperties(element, modelURN) {
      const allProperties = [];
      
      for (const [key, value] of Object.entries(element)) {
        if (key === 'k' || !key.includes(':')) continue;
        
        const [family, prop] = key.split(':');
        let familyName = 'Source';
        
        if (family === 'n') {
          familyName = 'Standard';
        } else if (family === 'z') {
          familyName = 'Custom';
        }
        
        // Get display info from schema
        const displayInfo = getPropertyDisplayInfo(modelURN, key);

        // Determine if this property is a drillable element reference.
        // Prefer schema dataType (authoritative) then fall back to column family.
        // AtDbKey=11: single same-model ref (l: family)
        // AtDbKeyList=12: list of same-model refs (l: family, blob of 20-byte short keys)
        // AtExDbKeyList=13: list of cross-model refs (x: family, blob of 40-byte xrefs)
        const dt = displayInfo.dataType;
        let isRef = false;
        let refFamily = null;
        if (dt === AttributeType.DbKey || dt === AttributeType.DbKeyList) {
          isRef = true;
          refFamily = 'l';
        } else if (dt === AttributeType.ExDbKeyList) {
          isRef = true;
          refFamily = 'x';
        } else if (dt === null) {
          // Schema not available — fall back to column family heuristic
          if (family === 'l' && prop !== 'd') { isRef = true; refFamily = 'l'; }
          else if (family === 'x') { isRef = true; refFamily = 'x'; }
        }

        const rawValue = isRef
          ? (Array.isArray(value) ? value[0] : value) || null
          : null;

        const hint = interpretPropertyHint(key, value);

        // n:s (Settings) is a base64-encoded JSON blob (StreamSettings) — offer a JSON viewer.
        // Match by qualified column id; also treat "Settings" display name as fallback (e.g. override column).
        const isJsonBlob = key === 'n:s' || key === 'n:!s' || (displayInfo.name === 'Settings' && family === 'n');
        const jsonBlobRawValue = isJsonBlob
          ? (Array.isArray(value) ? value[0] : value) || null
          : null;

        allProperties.push({
          id: key,
          family: familyName,
          category: displayInfo.category || familyName,
          name: displayInfo.name,
          value: formatPropertyValue(value),
          hint,
          isRef,
          refFamily,
          refModelURN: modelURN,
          rawValue,
          isJsonBlob,
          jsonBlobRawValue
        });
      }
      
      return allProperties;
    }
    
    function getCategoryName(categoryId) {
      if (categoryId === null || categoryId === undefined) {
        return 'Unknown Category';
      }
      const categories = {
        10: "Regeneration Failure",
        11: "Walls",
        14: "Windows",
        16: "Glass",
        18: "Frame/Mullion",
        20: "Sill/Head",
        22: "Opening",
        23: "Doors",
        25: "Panel",
        27: "Opening",
        29: "Frame/Mullion",
        31: "Glass",
        32: "Floors",
        35: "Roofs",
        38: "Ceilings",
        80: "Furniture",
        100: "Columns",
        120: "Stairs",
        126: "Railings",
        150: "Generic Annotations",
        151: "Generic Models",
        160: "Rooms",
        170: "Curtain Panels",
        171: "Curtain Wall Mullions",
        180: "Ramps",
        185: "Massing",
        240: "Levels",
        260: "Dimensions",
        280: "Title Blocks",
        300: "Text Notes",
        340: "Curtain Systems",
        400: "Section Marks",
        500: "Cameras",
        510: "Viewports",
        520: "Lights",
        530: "Reference Planes",
        573: "Schedules",
        700: "Materials",
        710: "Reference Points",
        800: "Tile pattern grids",
        1000: "Casework",
        1040: "Electrical Equipment",
        1060: "Electrical Fixtures",
        1100: "Furniture Systems",
        1120: "Lighting Fixtures",
        1140: "Mechanical Equipment",
        1160: "Plumbing Fixtures",
        1180: "Parking",
        1220: "Roads",
        1260: "Site",
        1300: "Structural Foundations",
        1320: "Structural Framing",
        1330: "Structural Columns",
        1336: "Structural Trusses",
        1340: "Topography",
        1350: "Specialty Equipment",
        1360: "Planting",
        1370: "Entourage",
        1390: "Fascias",
        1391: "Gutters",
        1392: "Slab Edges",
        1393: "Roof Soffits",
        2000: "Detail Items",
        3000: "Profiles",
        3100: "Sheets",
        3200: "Areas",
        3400: "Mass",
        3500: "Stacked Walls",
        3600: "Spaces",
        5200: "Structural Loads",
        6000: "Scope Boxes",
        6060: "Revision Clouds",
        8000: "Ducts",
        8010: "Duct Fittings",
        8013: "Air Terminals",
        8016: "Duct Accessories",
        8020: "Flex Ducts",
        8037: "Electrical Circuits",
        8039: "Wires",
        8044: "Pipes",
        8049: "Pipe Fittings",
        8050: "Flex Pipes",
        8055: "Pipe Accessories",
        8099: "Sprinklers",
        8126: "Cable Tray Fittings",
        8128: "Conduit Fittings",
        8130: "Cable Trays",
        8132: "Conduits",
        8193: "MEP Fabrication Ductwork",
        8203: "MEP Fabrication Hangers",
        8208: "MEP Fabrication Pipework",
        8212: "MEP Fabrication Containment",
        8232: "Mechanical Control Devices",
        8234: "Plumbing Equipment",
        9000: "Structural Rebar",
        9003: "Structural Area Reinforcement",
        9009: "Structural Path Reinforcement",
        9016: "Structural Fabric Reinforcement",
        9030: "Structural Connections",
        9060: "Structural Rebar Couplers",
        9630: "Analytical Beams",
        9633: "Analytical Braces",
        9636: "Analytical Columns",
        9639: "Analytical Floors",
        9640: "Analytical Walls",
        9641: "Analytical Isolated Foundations",
        9642: "Analytical Wall Foundations",
        9643: "Analytical Foundation Slabs",
        10001: "Point Clouds",
        [-2000011]: "Walls",
        [-2000014]: "Floors",
        [-2000023]: "Doors",
        [-2000024]: "Windows",
        [-2000032]: "Roofs",
        [-2000035]: "Structural Columns",
        [-2000038]: "Ceilings",
        [-2000080]: "Structural Framing",
        [-2000151]: "Air Terminals",
        [-2000160]: "Rooms",
        [-2000240]: "Levels",
        [-2001040]: "Lighting Fixtures",
        [-2001060]: "Casework",
        [-2001100]: "Entourage",
        [-2001140]: "Mechanical Equipment",
        [-2001150]: "Electrical Equipment",
        [-2001160]: "Plumbing Fixtures",
        [-2008000]: "Ducts",
        [-2008044]: "Duct Fittings",
        [-2008049]: "Duct Accessories",
        [-2008051]: "Mechanical Equipment",
        [-2008127]: "Pipes",
        [-2008128]: "Pipe Fittings",
        [-2008130]: "Pipe Accessories"
      };
      return categories[categoryId] || "Category " + categoryId;
    }
    
    // Full ElementFlags map (from viewer/src/dt/schema/dt-schema.js - superset of constants.js)
    // Format: "Name · type" to avoid nested parentheses in the UI hint
    const ElementFlagsMap = {
      0x00000000: 'SimpleElement · Physical',
      0x00000001: 'NestedChild · Physical, instanced/nested',
      0x00000002: 'NestedParent · Physical, host family',
      0x00000003: 'CompositeChild · Physical, e.g. curtain wall panel',
      0x00000004: 'CompositeParent · Physical, e.g. curtain wall',
      0x00000005: 'Room',
      0x01000000: 'FamilyType · Logical',
      0x01000001: 'Level · Logical',
      0x01000002: 'DocumentRoot · Logical',
      0x01000003: 'Stream · Logical, IoT',
      0x01000004: 'System · Logical, MEP',
      0x01000005: 'GenericAsset · Logical',
      0x01000006: 'Collection · Logical',
      0x01000007: 'Ticket · Logical',
      0x03000000: 'Virtual · Logical, placeholder',
      0xfffffffe: 'Deleted',
      0xffffffff: 'Unknown'
    };

    const SystemClassNames = [
      'Supply Air', 'Return Air', 'Exhaust Air', 'Hydronic Supply', 'Hydronic Return',
      'Domestic Hot Water', 'Domestic Cold Water', 'Sanitary', 'Power', 'Vent',
      'Controls', 'Fire Protection Wet', 'Fire Protection Dry', 'Fire Protection Pre-Action',
      'Other Air', 'Other', 'Fire Protection Other', 'Communication', 'Data Circuit',
      'Telephone', 'Security', 'Fire Alarm', 'Nurse Call', 'Switch Topology',
      'Cable Tray Conduit', 'Storm'
    ];

    // Return a human-readable hint string for well-known property values, or null.
    function interpretPropertyHint(qualifiedProp, rawValue) {
      if (rawValue === null || rawValue === undefined) return null;
      const val = Array.isArray(rawValue) ? rawValue[0] : rawValue;

      switch (qualifiedProp) {
        case 'n:a': { // ElementFlags
          const n = parseInt(val);
          if (!isNaN(n)) {
            const label = ElementFlagsMap[n >>> 0];
            return label ? label : '0x' + (n >>> 0).toString(16).toUpperCase().padStart(8, '0');
          }
          return null;
        }
        case 'n:c': { // CategoryId
          const n = parseInt(val);
          return !isNaN(n) ? getCategoryName(n) : null;
        }
        case 'n:ia': { // IsAsset
          const n = parseInt(val);
          if (!isNaN(n)) return n ? 'true · designated as asset' : 'false';
          return null;
        }
        case 'n:b':
        case 'n:!b': { // SystemClass / OSystemClass
          const n = parseInt(val);
          if (!isNaN(n) && n >= 0 && n < SystemClassNames.length) return SystemClassNames[n];
          return null;
        }
        default:
          return null;
      }
    }

    // Qualified column ID sort (family then property) - runs in the detached window, cannot use ES module imports
    function compareQualifiedColumnIds(aId, bId, ascending) {
      const aParts = (aId || '').toString().split(':');
      const bParts = (bId || '').toString().split(':');
      const aFamily = (aParts[0] || '').toLowerCase();
      const bFamily = (bParts[0] || '').toLowerCase();
      const familyCompare = aFamily.localeCompare(bFamily);
      if (familyCompare !== 0) return ascending ? familyCompare : -familyCompare;
      const aProp = (aParts[1] != null ? aParts[1] : (aId || '')).toString().toLowerCase();
      const bProp = (bParts[1] != null ? bParts[1] : (bId || '')).toString().toLowerCase();
      const propCompare = aProp.localeCompare(bProp);
      return ascending ? propCompare : -propCompare;
    }

    // Build a sortable properties table HTML string from an array of property objects
    function buildPropertiesTable(properties) {
      let html = '<table class="properties-table">';
      html += '<thead><tr>';
      html += '<th data-sort="id">ID</th>';
      html += '<th data-sort="category" class="sorted">Category</th>';
      html += '<th data-sort="name">Property Name</th>';
      html += '<th data-sort="value">Value</th>';
      html += '</tr></thead>';
      html += '<tbody class="properties-tbody">';

      properties.forEach(prop => {
        const idEscaped = escapeHtml(prop.id);
        const categoryEscaped = escapeHtml(prop.category);
        const nameEscaped = escapeHtml(prop.name);
        const valueEscaped = escapeHtml(prop.value);

        html += '<tr data-id="' + prop.id.replace(/"/g, '&quot;') + '" data-category="' + prop.category.replace(/"/g, '&quot;') + '" data-name="' + prop.name.replace(/"/g, '&quot;') + '" data-value="' + prop.value.replace(/"/g, '&quot;') + '">';
        html += '<td class="property-id">' + idEscaped + '</td>';
        html += '<td class="property-category">' + categoryEscaped + '</td>';
        html += '<td class="property-name">' + nameEscaped + '</td>';
        const hintSpan = prop.hint
          ? ' <span class="prop-hint">(' + escapeHtml(prop.hint) + ')</span>'
          : '';
        if (prop.isRef && prop.rawValue) {
          const rawEsc = prop.rawValue.replace(/"/g, '&quot;');
          html += '<td class="property-value">'
            + '<button class="ref-drill-btn"'
            + ' data-ref-family="' + prop.refFamily + '"'
            + ' data-model-urn="' + prop.refModelURN.replace(/"/g, '&quot;') + '"'
            + ' data-raw-value="' + rawEsc + '"'
            + ' title="View referenced element">'
            + valueEscaped
            + '<span class="ref-arrow">&#x2197;</span>'
            + '</button>'
            + hintSpan + '</td>';
        } else if (prop.isJsonBlob && prop.jsonBlobRawValue) {
          const rawEsc = String(prop.jsonBlobRawValue).replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
          html += '<td class="property-value">'
            + '<button class="json-view-btn" data-raw-value="' + rawEsc + '" title="View decoded JSON">'
            + 'View JSON'
            + '</button>'
            + hintSpan + '</td>';
        } else {
          html += '<td class="property-value">' + valueEscaped + hintSpan + '</td>';
        }
        html += '</tr>';
      });

      html += '</tbody></table>';
      return html;
    }

    // Attach column-header click sorting to a .properties-table element
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
            let aVal = a.getAttribute('data-' + sortBy) || '';
            let bVal = b.getAttribute('data-' + sortBy) || '';

            if (sortBy === 'id') {
              return compareQualifiedColumnIds(aVal, bVal, currentSort.direction === 'asc');
            }

            const comparison = aVal.toLowerCase().localeCompare(bVal.toLowerCase());
            if (sortBy === 'category' && comparison === 0) {
              const aName = a.getAttribute('data-name') || '';
              const bName = b.getAttribute('data-name') || '';
              const nameComparison = aName.toLowerCase().localeCompare(bName.toLowerCase());
              return currentSort.direction === 'asc' ? nameComparison : -nameComparison;
            }
            return currentSort.direction === 'asc' ? comparison : -comparison;
          });

          rows.forEach(row => tbody.appendChild(row));
        });
      });
    }

    // Attach click handlers to .ref-drill-btn elements inside a container
    function attachRefDrillHandlers(container) {
      container.querySelectorAll('.ref-drill-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
          e.stopPropagation();
          const refFamily = this.getAttribute('data-ref-family');
          const modelURN = this.getAttribute('data-model-urn');
          const rawValue = this.getAttribute('data-raw-value');
          openRefElement(refFamily, modelURN, rawValue);
        });
      });
    }

    // Attach click handlers to .json-view-btn elements inside a container
    function attachJsonViewHandlers(container) {
      container.querySelectorAll('.json-view-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
          e.stopPropagation();
          openJsonBlob(this.getAttribute('data-raw-value'));
        });
      });
    }

    // Syntax-highlight a JSON string for display in the modal
    function syntaxHighlightJson(json) {
      return json
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
          function(match) {
            let cls = 'json-num';
            if (/^"/.test(match)) {
              cls = /:$/.test(match) ? 'json-key' : 'json-str';
            } else if (/true|false/.test(match)) {
              cls = 'json-bool';
            } else if (/null/.test(match)) {
              cls = 'json-null';
            }
            return '<span class="' + cls + '">' + match + '</span>';
          });
    }

    function openJsonBlob(b64Value) {
      const titleEl = document.getElementById('ref-modal-title');
      const subtitleEl = document.getElementById('ref-modal-subtitle');
      const bodyEl = document.getElementById('ref-modal-body');

      try {
        // Decode base64 → UTF-8 string → parse JSON
        let s = b64Value.replace(/-/g, '+').replace(/_/g, '/');
        while (s.length % 4) s += '=';
        const jsonStr = decodeURIComponent(
          atob(s).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')
        );
        const parsed = JSON.parse(jsonStr);
        const pretty = JSON.stringify(parsed, null, 2);

        titleEl.innerHTML = '<span>Stream Settings</span>'
          + '<span class="category-badge">n:s</span>';
        subtitleEl.textContent = 'Decoded JSON blob (StreamSettings)';
        bodyEl.innerHTML = '<pre class="json-pre">' + syntaxHighlightJson(pretty) + '</pre>';
        showRefModal();
      } catch (err) {
        titleEl.innerHTML = '<span>Stream Settings</span>';
        subtitleEl.textContent = 'n:s';
        bodyEl.innerHTML = '<div style="color:#ff6b6b;padding:20px">Could not decode JSON: ' + escapeHtml(err.message) + '</div>';
        showRefModal();
      }
    }

    function showRefModal() {
      document.getElementById('ref-modal').classList.add('active');
      document.body.style.overflow = 'hidden';
    }

    function closeRefModal() {
      document.getElementById('ref-modal').classList.remove('active');
      document.body.style.overflow = '';
    }

    // Parse a base64 blob of concatenated 20-byte short keys (l: family, AtDbKeyList).
    // Returns an array of base64url short key strings.
    function parseShortKeyBlob(b64) {
      try {
        let s = b64.replace(/-/g, '+').replace(/_/g, '/');
        while (s.length % 4) s += '=';
        const bytes = new Uint8Array(atob(s).split('').map(c => c.charCodeAt(0)));
        const keys = [];
        for (let i = 0; i + kElementIdSize <= bytes.length; i += kElementIdSize) {
          const chunk = bytes.slice(i, i + kElementIdSize);
          keys.push(makeWebsafe(btoa(String.fromCharCode.apply(null, chunk))));
        }
        return keys;
      } catch (e) { return []; }
    }

    // Parse a base64 blob of concatenated 40-byte xrefs (x: family, AtExDbKeyList).
    // Each xref is [16 bytes modelId][4 bytes flags][20 bytes elementId].
    // Returns an array of base64url xref strings (one per referenced element).
    function parseXrefBlob(b64) {
      const xrefSize = kModelIdSize + kElementIdWithFlagsSize; // 16 + 24 = 40
      try {
        let s = b64.replace(/-/g, '+').replace(/_/g, '/');
        while (s.length % 4) s += '=';
        const bytes = new Uint8Array(atob(s).split('').map(c => c.charCodeAt(0)));
        const xrefs = [];
        for (let i = 0; i + xrefSize <= bytes.length; i += xrefSize) {
          const chunk = bytes.slice(i, i + xrefSize);
          xrefs.push(makeWebsafe(btoa(String.fromCharCode.apply(null, chunk))));
        }
        return xrefs;
      } catch (e) { return []; }
    }

    async function openRefElement(refFamily, modelURN, rawValue) {
      const titleEl = document.getElementById('ref-modal-title');
      const bodyEl = document.getElementById('ref-modal-body');

      titleEl.innerHTML = '<span>Loading\u2026</span>';
      document.getElementById('ref-modal-subtitle').textContent = '';
      bodyEl.innerHTML = '<div style="text-align:center;padding:30px;color:#4fc3f7">Loading referenced element\u2026</div>';
      showRefModal();

      try {
        let targetModelURN = modelURN;
        let elementKey;

        if (refFamily === 'x') {
          // AtExDbKeyList: base64 blob of concatenated 40-byte xrefs
          const xrefs = parseXrefBlob(rawValue);
          if (xrefs.length === 0) {
            bodyEl.innerHTML = '<div style="color:#ff6b6b;padding:20px">Could not parse cross-model reference.</div>';
            return;
          }
          const decoded = decodeXref(xrefs[0]);
          if (!decoded) {
            bodyEl.innerHTML = '<div style="color:#ff6b6b;padding:20px">Could not decode cross-model reference.</div>';
            return;
          }
          targetModelURN = decoded.modelURN;
          elementKey = toShortKey(decoded.elementKey);
        } else {
          // l: family — AtDbKey or AtDbKeyList: base64 blob of concatenated 20-byte short keys
          const shortKeys = parseShortKeyBlob(rawValue);
          if (shortKeys.length === 0) {
            bodyEl.innerHTML = '<div style="color:#ff6b6b;padding:20px">Could not parse reference key.</div>';
            return;
          }
          elementKey = shortKeys[0];
        }

        const elements = await fetchElementDetails(targetModelURN, [elementKey]);

        if (!elements || elements.length === 0) {
          bodyEl.innerHTML = '<div style="color:#ff6b6b;padding:20px">Referenced element not found in model.</div>';
          return;
        }

        const element = elements[0];
        const name = element['n:!n']?.[0] || element['n:n']?.[0] || 'Unnamed Element';
        const categoryId = element['n:c']?.[0];
        const categoryName = categoryId !== undefined ? getCategoryName(categoryId) : null;
        const classification = element['n:!v']?.[0] || element['n:v']?.[0];

        let titleHTML = '<span>' + escapeHtml(name) + '</span>';
        if (categoryName) {
          titleHTML += '<span class="category-badge">' + escapeHtml(categoryName) + '</span>';
        }
        if (classification) {
          titleHTML += '<span class="classification-badge">' + escapeHtml(classification) + '</span>';
        }
        titleEl.innerHTML = titleHTML;
        document.getElementById('ref-modal-subtitle').textContent =
          targetModelURN + '  ·  ' + elementKey;

        const properties = organizeProperties(element, targetModelURN);
        const tableHTML = buildPropertiesTable(properties);

        bodyEl.innerHTML = tableHTML;

        const table = bodyEl.querySelector('.properties-table');
        if (table) {
          attachTableSorting(table);
          attachRefDrillHandlers(table);
          attachJsonViewHandlers(table);
        }
      } catch (err) {
        console.error('Error fetching referenced element:', err);
        bodyEl.innerHTML = '<div style="color:#ff6b6b;padding:20px">Error: ' + escapeHtml(err.message) + '</div>';
      }
    }

    // Fetch type/family element properties by type key (l:t value)
    async function fetchTypeProperties(modelURN, typeKey) {
      const payload = JSON.stringify({
        families: ['n', 'l', 'x', 'r', 'z'],
        keys: [typeKey],
        includeHistory: false
      });

      const response = await fetch(API_BASE + '/modeldata/' + modelURN + '/scan', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + TOKEN,
          'Content-Type': 'application/json',
          'Region': REGION
        },
        body: payload
      });

      if (!response.ok) {
        throw new Error('Failed to fetch type properties: ' + response.statusText);
      }

      const data = await response.json();
      return data.filter(item => typeof item === 'object' && item !== null && item['k']);
    }


    async function toggleElementDetails(modelURN, elementKey, button, detailsDiv) {
      if (detailsDiv.classList.contains('visible')) {
        detailsDiv.classList.remove('visible');
        button.textContent = 'Show Details';
        return;
      }

      if (loadedDetails.has(elementKey)) {
        detailsDiv.classList.add('visible');
        button.textContent = 'Hide Details';
        return;
      }

      button.textContent = 'Loading...';
      button.classList.add('loading');
      button.disabled = true;

      try {
        const elements = await fetchElementDetails(modelURN, [elementKey]);
        if (elements.length === 0) {
          detailsDiv.innerHTML = '<div class="error-message">No details found</div>';
          detailsDiv.classList.add('visible');
          loadedDetails.set(elementKey, true);
          return;
        }

        const element = elements[0];
        const properties = organizeProperties(element, modelURN);

        properties.sort((a, b) => {
          const cc = a.category.toLowerCase().localeCompare(b.category.toLowerCase());
          if (cc !== 0) return cc;
          return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
        });

        // Check for a type reference: l:t (QC.FamilyType = Refs family + 't' column)
        const typeKey = element['l:t']?.[0];
        let typeProperties = [];
        let typeName = null;

        if (typeKey) {
          try {
            const typeElements = await fetchTypeProperties(modelURN, typeKey);
            if (typeElements.length > 0) {
              const typeElement = typeElements[0];
              typeName = typeElement['n:n']?.[0] || null;
              typeProperties = organizeProperties(typeElement, modelURN);
              typeProperties.sort((a, b) => {
                const cc = a.category.toLowerCase().localeCompare(b.category.toLowerCase());
                if (cc !== 0) return cc;
                return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
              });
            }
          } catch (typeError) {
            console.warn('Could not fetch type properties:', typeError);
          }
        }

        // Render Element Properties section
        let html = '<div class="props-section">';
        html += '<div class="props-section-label">Element Properties</div>';
        html += buildPropertiesTable(properties);
        html += '</div>';

        // Render Type Properties section (only when a type element was found)
        if (typeProperties.length > 0) {
          const typeLabel = typeName ? 'Type Properties \u2014 ' + escapeHtml(typeName) : 'Type Properties';
          html += '<div class="props-section props-section-type">';
          html += '<div class="props-section-label">' + typeLabel + '</div>';
          html += buildPropertiesTable(typeProperties);
          html += '</div>';
        }

        detailsDiv.innerHTML = html;

        // Wire up sorting, ref drill-down, and JSON viewer for every table rendered
        detailsDiv.querySelectorAll('.properties-table').forEach(table => {
          attachTableSorting(table);
          attachRefDrillHandlers(table);
          attachJsonViewHandlers(table);
        });

        detailsDiv.classList.add('visible');
        loadedDetails.set(elementKey, true);
      } catch (error) {
        console.error('Error loading details:', error);
        detailsDiv.innerHTML = '<div class="error-message">Failed to load details</div>';
        detailsDiv.classList.add('visible');
      } finally {
        button.textContent = 'Hide Details';
        button.classList.remove('loading');
        button.disabled = false;
      }
    }
    
    async function copyAssetLink(modelURN, elementKey, button) {
      try {
        if (!FACILITY_URN) {
          console.error('Facility URN not available');
          button.textContent = '✗';
          setTimeout(() => {
            button.textContent = '🔗';
          }, 2000);
          return;
        }
        
        // Convert short key to full key (with flags)
        // Most elements are physical; logical elements like rooms/spaces will still work
        const fullKey = toFullKey(elementKey, false);
        
        // Generate xref from model URN and full element key
        const xref = makeXrefKey(modelURN, fullKey);
        
        // Generate link to the asset in Tandem
        const link = 'https://tandem.autodesk.com/pages/facilities/' + FACILITY_URN + '?selection=' + xref;
        
        // Copy to clipboard
        await navigator.clipboard.writeText(link);
        
        // Visual feedback
        button.classList.add('copied');
        const originalContent = button.textContent;
        button.textContent = '✓';
        
        setTimeout(() => {
          button.textContent = originalContent;
          button.classList.remove('copied');
        }, 2000);
        
        console.log('Copied link:', link);
      } catch (error) {
        console.error('Failed to copy link:', error);
        button.textContent = '✗';
        setTimeout(() => {
          button.textContent = '🔗';
        }, 2000);
      }
    }
    
    // Cache of model metadata (fragmentTransformsOffset) keyed by modelURN
    const modelMetaCache = {};

    async function fetchModelMeta(modelURN) {
      if (modelMetaCache[modelURN]) return modelMetaCache[modelURN];
      const response = await fetch(API_BASE + '/modeldata/' + modelURN + '/model', {
        headers: { 'Authorization': 'Bearer ' + TOKEN, 'Region': REGION }
      });
      if (!response.ok) throw new Error('Failed to fetch model metadata: ' + response.statusText);
      const data = await response.json();
      modelMetaCache[modelURN] = data;
      return data;
    }

    // Decode bounding box binary blob (base64) into world-space min/max coordinates.
    // The blob is little-endian floats: [minx, miny, minz, maxx, maxy, maxz] per 28-byte record.
    // fragmentTransformsOffset is the world-space origin of the model.
    function decodeBBox(text, offset) {
      let b64 = (text || '').replace(/-/g, '+').replace(/_/g, '/');
      while (b64.length % 4) b64 += '=';
      const binary = atob(b64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const view = new DataView(bytes.buffer);
      const kRecordSize = 28;
      const ox = offset.x || 0, oy = offset.y || 0, oz = offset.z || 0;
      let minx = view.getFloat32(0, true) + ox;
      let miny = view.getFloat32(4, true) + oy;
      let minz = view.getFloat32(8, true) + oz;
      let maxx = view.getFloat32(12, true) + ox;
      let maxy = view.getFloat32(16, true) + oy;
      let maxz = view.getFloat32(20, true) + oz;
      for (let i = kRecordSize; i + 20 < bytes.length; i += kRecordSize) {
        minx = Math.min(minx, view.getFloat32(i,      true) + ox);
        miny = Math.min(miny, view.getFloat32(i +  4, true) + oy);
        minz = Math.min(minz, view.getFloat32(i +  8, true) + oz);
        maxx = Math.max(maxx, view.getFloat32(i + 12, true) + ox);
        maxy = Math.max(maxy, view.getFloat32(i + 16, true) + oy);
        maxz = Math.max(maxz, view.getFloat32(i + 20, true) + oz);
      }
      return { minx, miny, minz, maxx, maxy, maxz };
    }

    function showBBoxPopup(button, box) {
      // Remove any existing popup
      const existing = document.getElementById('bbox-popup');
      if (existing) existing.remove();

      const popup = document.createElement('div');
      popup.id = 'bbox-popup';
      popup.setAttribute('data-for-key', button.getAttribute('data-element-key'));

      if (!box) {
        popup.innerHTML = '<div class="bbox-popup-none">No bounding box data — element may be logical (no geometry)</div>';
      } else {
        const fmt = (v) => v.toFixed(3);
        const jsonObj = {
          min: { x: parseFloat(box.minx.toFixed(6)), y: parseFloat(box.miny.toFixed(6)), z: parseFloat(box.minz.toFixed(6)) },
          max: { x: parseFloat(box.maxx.toFixed(6)), y: parseFloat(box.maxy.toFixed(6)), z: parseFloat(box.maxz.toFixed(6)) }
        };
        const jsonStr = JSON.stringify(jsonObj, null, 2);
        popup.innerHTML =
          '<div class="bbox-popup-title">Bounding Box</div>' +
          '<table class="bbox-popup-table">' +
            '<thead><tr><th></th><th>X</th><th>Y</th><th>Z</th></tr></thead>' +
            '<tbody>' +
              '<tr><td class="bbox-axis-label">Min</td><td>' + fmt(box.minx) + '</td><td>' + fmt(box.miny) + '</td><td>' + fmt(box.minz) + '</td></tr>' +
              '<tr><td class="bbox-axis-label">Max</td><td>' + fmt(box.maxx) + '</td><td>' + fmt(box.maxy) + '</td><td>' + fmt(box.maxz) + '</td></tr>' +
            '</tbody>' +
          '</table>' +
          '<div class="bbox-popup-footer"><button class="bbox-copy-btn" data-json="' + jsonStr.replace(/"/g, '&quot;') + '">Copy JSON</button></div>';

        // Wire up copy button after inserting into DOM
        setTimeout(() => {
          const copyBtn = popup.querySelector('.bbox-copy-btn');
          if (copyBtn) {
            copyBtn.addEventListener('click', (e) => {
              e.stopPropagation();
              navigator.clipboard.writeText(jsonStr).then(() => {
                copyBtn.textContent = 'Copied!';
                copyBtn.classList.add('copied');
                setTimeout(() => { copyBtn.textContent = 'Copy JSON'; copyBtn.classList.remove('copied'); }, 2000);
              }).catch(() => {
                copyBtn.textContent = 'Failed';
                setTimeout(() => { copyBtn.textContent = 'Copy JSON'; }, 2000);
              });
            });
          }
        }, 0);
      }

      document.body.appendChild(popup);

      // Position: below the button, horizontally centered on it
      const rect = button.getBoundingClientRect();
      const popupW = popup.offsetWidth;
      let left = rect.left + rect.width / 2 - popupW / 2;
      left = Math.max(8, Math.min(left, window.innerWidth - popupW - 8));
      popup.style.top = (rect.bottom + 6) + 'px';
      popup.style.left = left + 'px';

      // Close when clicking outside
      const closeHandler = (e) => {
        if (!popup.contains(e.target) && e.target !== button) {
          popup.remove();
          document.removeEventListener('click', closeHandler, true);
        }
      };
      setTimeout(() => document.addEventListener('click', closeHandler, true), 0);
    }

    async function showBoundingBox(modelURN, elementKey, button) {
      // Toggle: clicking the same button again closes the popup
      const existing = document.getElementById('bbox-popup');
      if (existing && existing.getAttribute('data-for-key') === elementKey) {
        existing.remove();
        return;
      }

      const originalHTML = button.innerHTML;
      button.innerHTML = '⏳';
      button.disabled = true;

      try {
        const modelMeta = await fetchModelMeta(modelURN);
        const offset = modelMeta.fragmentTransformsOffset || { x: 0, y: 0, z: 0 };

        // Scan with LMV family ('0') to get the bounding box column (0:0)
        const payload = JSON.stringify({ families: ['0'], keys: [elementKey], includeHistory: false });
        const response = await fetch(API_BASE + '/modeldata/' + modelURN + '/scan', {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + TOKEN, 'Content-Type': 'application/json', 'Region': REGION },
          body: payload
        });
        if (!response.ok) throw new Error('Failed to fetch element LMV data');
        const data = await response.json();
        const elements = data.filter(item => typeof item === 'object' && item !== null && item['k']);
        const element = elements[0];
        const bboxVal = element && element['0:0']; // QC.BoundingBox — API returns an array
        const bboxRaw = Array.isArray(bboxVal) ? bboxVal[0] : bboxVal;

        const box = bboxRaw ? decodeBBox(bboxRaw, offset) : null;
        showBBoxPopup(button, box);
      } catch (error) {
        console.error('Failed to fetch bounding box:', error);
        button.innerHTML = '✗';
        setTimeout(() => { button.innerHTML = originalHTML; }, 2000);
        return;
      } finally {
        button.innerHTML = originalHTML;
        button.disabled = false;
      }
    }

    async function loadInitialData() {
      const container = document.getElementById('content-container');
      
      try {
        let totalElements = 0;
        const modelsData = [];
        
        // Fetch names for all models (skip models with no keys)
        for (const modelGroup of DATA) {
          // Skip if no keys provided
          if (!modelGroup.keys || modelGroup.keys.length === 0) {
            console.warn('Skipping model with no keys:', modelGroup.modelName);
            continue;
          }
          
          const elements = await fetchElementNames(modelGroup.modelURN, modelGroup.keys);
          totalElements += elements.length;
          
          modelsData.push({
            modelURN: modelGroup.modelURN,
            modelName: modelGroup.modelName,
            elements: elements
          });
        }
        
        // Update stats (only count models with elements)
        document.getElementById('stat-models').textContent = modelsData.length;
        document.getElementById('stat-elements').textContent = totalElements;
        
        // Render elements
        let html = '';
        
        for (const modelData of modelsData) {
          html += '<div class="model-section">';
          html += '<div class="model-header">';
          html += '<div class="model-header-left">';
          html += '<div class="model-name">' + escapeHtml(modelData.modelName) + '</div>';
          html += '<div class="model-urn">' + escapeHtml(modelData.modelURN) + '</div>';
          html += '<div class="model-count">' + modelData.elements.length + ' element' + (modelData.elements.length !== 1 ? 's' : '') + '</div>';
          html += '</div>';
          html += '<button class="view-keys-btn" data-model-urn="' + modelData.modelURN.replace(/"/g, '&quot;') + '" data-model-name="' + escapeHtml(modelData.modelName) + '">View Keys</button>';
          html += '</div>';
          html += '<div class="elements-list">';
          
          for (const element of modelData.elements) {
            const key = element['k'];
            const name = element['n:!n']?.[0] || element['n:n']?.[0] || 'Unnamed';
            const categoryId = element['n:c']?.[0];
            const categoryName = categoryId ? getCategoryName(categoryId) : 'Unknown';
            const classification = element['n:!v']?.[0] || element['n:v']?.[0];
            
            html += '<div class="element-item">';
            html += '<div class="element-header">';
            html += '<div class="element-basic-info">';
            html += '<div class="element-name">';
            html += '<span>' + escapeHtml(name) + '</span>';
            html += '<span class="category-badge">' + escapeHtml(categoryName) + '</span>';
            if (classification) {
              html += '<span class="classification-badge">' + escapeHtml(classification) + '</span>';
            }
            html += '</div>';
            html += '<div class="element-key">' + escapeHtml(key) + '</div>';
            html += '</div>';
            if (SHOW_LINKS) {
              html += '<button class="copy-link-btn" data-model-urn="' + modelData.modelURN.replace(/"/g, '&quot;') + '" data-element-key="' + key.replace(/"/g, '&quot;') + '" title="Copy link to asset">🔗</button>';
            }
            html += '<button class="bbox-btn" data-model-urn="' + modelData.modelURN.replace(/"/g, '&quot;') + '" data-element-key="' + key.replace(/"/g, '&quot;') + '" title="Show bounding box"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg></button>';
            html += '<button class="element-toggle" data-model-urn="' + modelData.modelURN.replace(/"/g, '&quot;') + '" data-element-key="' + key.replace(/"/g, '&quot;') + '">Show Details</button>';
            html += '</div>';
            html += '<div class="element-details"></div>';
            html += '</div>';
          }
          
          html += '</div>';
          html += '</div>';
        }
        
        container.innerHTML = html;
        
        // Add event listeners to all toggle buttons
        const toggleButtons = container.querySelectorAll('.element-toggle');
        toggleButtons.forEach(button => {
          button.addEventListener('click', async function() {
            const modelURN = this.getAttribute('data-model-urn');
            const elementKey = this.getAttribute('data-element-key');
            const detailsDiv = this.closest('.element-item').querySelector('.element-details');
            
            await toggleElementDetails(modelURN, elementKey, this, detailsDiv);
          });
        });
        
        // Add event listeners to all copy link buttons
        const copyLinkButtons = container.querySelectorAll('.copy-link-btn');
        copyLinkButtons.forEach(button => {
          button.addEventListener('click', async function() {
            const modelURN = this.getAttribute('data-model-urn');
            const elementKey = this.getAttribute('data-element-key');
            
            await copyAssetLink(modelURN, elementKey, this);
          });
        });
        
        // Add event listeners to all bounding box buttons
        const bboxButtons = container.querySelectorAll('.bbox-btn');
        bboxButtons.forEach(button => {
          button.addEventListener('click', async function(e) {
            e.stopPropagation();
            const modelURN = this.getAttribute('data-model-urn');
            const elementKey = this.getAttribute('data-element-key');
            await showBoundingBox(modelURN, elementKey, this);
          });
        });

        // Add event listeners to all View Keys buttons
        const viewKeysButtons = container.querySelectorAll('.view-keys-btn');
        viewKeysButtons.forEach(button => {
          button.addEventListener('click', function() {
            const modelURN = this.getAttribute('data-model-urn');
            const modelName = this.getAttribute('data-model-name');
            
            // Find the model data and extract keys
            const modelData = modelsData.find(m => m.modelURN === modelURN);
            if (modelData) {
              const keys = modelData.elements.map(el => el['k']);
              showKeysModal(modelURN, modelName, keys);
            }
          });
        });
      } catch (error) {
        console.error('Error loading data:', error);
        container.innerHTML = '<div class="error-message">Failed to load asset details</div>';
      }
    }
    
    // Modal handling
    function showKeysModal(modelURN, modelName, keys) {
      const modal = document.getElementById('keys-modal');
      const modelNameEl = document.getElementById('keys-modal-model-name');
      const modelUrnEl = document.getElementById('keys-modal-model-urn');
      const textarea = document.getElementById('keys-textarea');
      
      modelNameEl.textContent = modelName;
      modelUrnEl.textContent = modelURN;
      textarea.value = JSON.stringify(keys, null, 2);
      textarea.rows = Math.min(keys.length + 2, 20);
      
      modal.classList.add('active');
    }
    
    function closeKeysModal() {
      const modal = document.getElementById('keys-modal');
      modal.classList.remove('active');
    }
    
    function copyKeysToClipboard() {
      const textarea = document.getElementById('keys-textarea');
      textarea.select();
      document.execCommand('copy');
      
      const btn = document.getElementById('keys-copy-btn');
      const originalText = btn.textContent;
      btn.textContent = 'Copied!';
      setTimeout(() => {
        btn.textContent = originalText;
      }, 2000);
    }
    
    // Set up modal event listeners
    document.getElementById('keys-modal-close').addEventListener('click', closeKeysModal);
    document.getElementById('keys-copy-btn').addEventListener('click', copyKeysToClipboard);
    
    // Close modal when clicking outside
    document.getElementById('keys-modal').addEventListener('click', (e) => {
      if (e.target.id === 'keys-modal') {
        closeKeysModal();
      }
    });

    // Ref detail modal
    document.getElementById('ref-modal-close').addEventListener('click', closeRefModal);
    document.getElementById('ref-modal').addEventListener('click', (e) => {
      if (e.target.id === 'ref-modal') {
        closeRefModal();
      }
    });
    
    // Excel Export Utilities
    const ExcelUtils = {
      headerStyle: {
        font: { bold: true, color: { rgb: "000000" } },
        fill: { fgColor: { rgb: "D3D3D3" } },
        alignment: { vertical: "center", horizontal: "left" }
      },
      
      blankRowStyle: {
        fill: { 
          patternType: "gray125",
          fgColor: { rgb: "BFBFBF" },
          bgColor: { rgb: "FFFFFF" }
        },
        border: {
          top: { style: "thin", color: { rgb: "D0D0D0" } },
          bottom: { style: "thin", color: { rgb: "D0D0D0" } },
          left: { style: "thin", color: { rgb: "D0D0D0" } },
          right: { style: "thin", color: { rgb: "D0D0D0" } }
        }
      },
      
      sanitizeSheetName: function(name, fallback = 'Sheet') {
        if (!name) return fallback;
        let sanitized = name
          .split(':').join('_')
          .split('/').join('_')
          .split(String.fromCharCode(92)).join('_')
          .split('?').join('_')
          .split('*').join('_')
          .split('[').join('_')
          .split(']').join('_')
          .trim()
          .substring(0, 31);
        return sanitized || fallback;
      },
      
      makeUnique: function(baseName, usedNames) {
        let uniqueName = baseName;
        let counter = 1;
        while (usedNames.has(uniqueName)) {
          const suffix = '_' + counter;
          uniqueName = baseName.substring(0, 31 - suffix.length) + suffix;
          counter++;
        }
        return uniqueName;
      },
      
      styleHeaderRow: function(sheet, columns, style) {
        columns.forEach(cell => {
          if (sheet[cell]) {
            sheet[cell].s = style;
          }
        });
      },
      
      styleBlankRows: function(sheet, data, columns, style) {
        for (let rowNum = 2; rowNum <= data.length; rowNum++) {
          const rowData = data[rowNum - 1];
          if (rowData && rowData.every(cell => cell === '')) {
            columns.forEach(col => {
              const cellRef = col + rowNum;
              if (!sheet[cellRef]) {
                sheet[cellRef] = { t: 's', v: '', w: '' };
              }
              sheet[cellRef].s = style;
            });
          }
        }
      }
    };
    
    // Export to Excel functionality
    async function exportToExcel() {
      const exportBtn = document.getElementById('export-btn');
      const originalText = exportBtn.innerHTML;
      
      try {
        exportBtn.disabled = true;
        exportBtn.innerHTML = '<span>⏳</span><span>Exporting...</span>';
        
        const workbook = XLSX.utils.book_new();
        
        // Fetch ALL element details once per model (used for both summary and detail sheets)
        // Use Promise.all to fetch all models in parallel for maximum speed
        const fetchPromises = DATA
          .filter(modelData => modelData.keys && modelData.keys.length > 0)
          .map(async modelData => {
            const elements = await fetchElementDetails(modelData.modelURN, modelData.keys);
            return {
              modelData: modelData,
              elements: elements
            };
          });
        
        const modelElementsCache = await Promise.all(fetchPromises);
        
        // Sheet 1: Summary - one row per element
        const summaryData = [
          ['Model Name', 'Element Name', 'Category', 'Classification', 'Element Key']
        ];
        
        // Build summary from cached data
        for (const cached of modelElementsCache) {
          for (const element of cached.elements) {
            const key = element['k'];
            const name = element['n:!n']?.[0] || element['n:n']?.[0] || 'Unnamed';
            const categoryId = element['n:c']?.[0];
            const categoryName = categoryId ? getCategoryName(categoryId) : 'Unknown';
            const classification = element['n:!v']?.[0] || element['n:v']?.[0] || '';
            
            summaryData.push([
              cached.modelData.modelName,
              name,
              categoryName,
              classification,
              key
            ]);
          }
        }
        
        const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
        summarySheet['!cols'] = [
          { wch: 30 }, // Model Name
          { wch: 30 }, // Element Name
          { wch: 20 }, // Category
          { wch: 20 }, // Classification
          { wch: 35 }  // Element Key
        ];
        
        ExcelUtils.styleHeaderRow(summarySheet, ['A1', 'B1', 'C1', 'D1', 'E1'], ExcelUtils.headerStyle);
        XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');
        
        // Track sheet names to avoid duplicates
        const usedSheetNames = new Set(['Summary']);
        
        // Sheets 2+: Detailed properties per model (using cached data)
        for (const cached of modelElementsCache) {
          const modelData = cached.modelData;
          const elements = cached.elements;
          
          const detailData = [
            ['Element Key', 'Element Name', 'Property ID', 'Category', 'Property Name', 'Value']
          ];
          
          for (let i = 0; i < elements.length; i++) {
            const element = elements[i];
            const elementKey = element['k'];
            const elementName = element['n:!n']?.[0] || element['n:n']?.[0] || 'Unnamed';
            const properties = organizeProperties(element, modelData.modelURN);
            
            for (const prop of properties) {
              detailData.push([
                elementKey,
                elementName,
                prop.id,
                prop.category,
                prop.name,
                prop.value
              ]);
            }
            
            // Add blank row between elements (except after last element)
            if (i < elements.length - 1) {
              detailData.push(['', '', '', '', '', '']);
            }
          }
          
          if (detailData.length > 1) {
            const detailSheet = XLSX.utils.aoa_to_sheet(detailData);
            detailSheet['!cols'] = [
              { wch: 35 }, // Element Key
              { wch: 30 }, // Element Name
              { wch: 15 }, // Property ID
              { wch: 20 }, // Category
              { wch: 30 }, // Property Name
              { wch: 40 }  // Value
            ];
            
            const detailHeaderCols = ['A', 'B', 'C', 'D', 'E', 'F'];
            ExcelUtils.styleHeaderRow(detailSheet, ['A1', 'B1', 'C1', 'D1', 'E1', 'F1'], ExcelUtils.headerStyle);
            ExcelUtils.styleBlankRows(detailSheet, detailData, detailHeaderCols, ExcelUtils.blankRowStyle);
            
            // Sanitize and ensure unique sheet name
            const baseName = ExcelUtils.sanitizeSheetName(
              modelData.modelName, 
              'Model_' + DATA.indexOf(modelData)
            );
            const uniqueSheetName = ExcelUtils.makeUnique(baseName, usedSheetNames);
            usedSheetNames.add(uniqueSheetName);
            
            XLSX.utils.book_append_sheet(workbook, detailSheet, uniqueSheetName);
          }
        }
        
        // Download file
        const filename = 'asset-details-' + new Date().toISOString().slice(0, 10) + '.xlsx';
        XLSX.writeFile(workbook, filename);
        
        // Success feedback
        exportBtn.innerHTML = '<span>✓</span><span>Exported!</span>';
        setTimeout(() => {
          exportBtn.innerHTML = originalText;
          exportBtn.disabled = false;
        }, 2000);
        
      } catch (error) {
        console.error('Export error:', error);
        exportBtn.innerHTML = '<span>✗</span><span>Export Failed</span>';
        setTimeout(() => {
          exportBtn.innerHTML = originalText;
          exportBtn.disabled = false;
        }, 2000);
      }
    }
    
    // Set up export button
    document.getElementById('export-btn').addEventListener('click', exportToExcel);
    
    // Load data when page loads
    loadInitialData();
  </script>
</body>
</html>`;
}

// Store reference to the asset details window
let assetDetailsWindow = null;

/**
 * View asset details in a new tab
 * @param {Array<{modelURN: string, modelName: string, keys: Array<string>}>} elementsByModel - Elements grouped by model
 * @param {string} title - Page title
 * @param {string} facilityURN - Facility URN for link generation
 */
export function viewAssetDetails(elementsByModel, title = 'Asset Details', facilityURN = '', region = 'US', showLinks = true) {
  if (!elementsByModel || elementsByModel.length === 0) {
    alert('No elements to display');
    return;
  }
  
  // Generate HTML with all data embedded
  const htmlContent = generateAssetDetailsHTML(elementsByModel, title, facilityURN, region, showLinks);
  
  // Open in new window/tab
  assetDetailsWindow = window.open('', '_blank');
  
  if (!assetDetailsWindow) {
    alert('Failed to open asset details window. Please check popup blocker settings.');
    return;
  }
  
  assetDetailsWindow.document.write(htmlContent);
  assetDetailsWindow.document.close();
}

