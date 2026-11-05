/**
 * Schema V3 data loaders.
 *
 * What V3 changes compared with js/v2/api.js:
 *  - All logical elements (assets, levels, rooms, streams, tickets, systems) live in the
 *    default model. BIM models only hold the BIM elements.
 *  - Levels and rooms are `Location` elements, told apart by their Tandem category
 *    (TC.Levels / TC.Rooms). A room points to its level through QC.Parent.
 *  - Assets are `GenericAsset` elements with their own random element id. They point to
 *    the BIM element they came from with QC.BimElmOfAsset.
 *  - Every key is a 24-byte key whose first 4 bytes are the ElementFlags value. There is no
 *    short key, so keys are used exactly as they come back from the server.
 *
 * Each function returns the same shape as its V2 counterpart so the shared UI can render
 * either one.
 */
import {
  getModels,
  getDefaultModelURN,
  getSchema,
  tandemBaseURL,
  makeRequestOptionsPOST
} from '../shared/api.js';
import { ColumnFamilies, ElementFlags, QC, SystemClassNames, TC } from '../../tandem/constants.js';
import { decodeXref, getElementFlags, toSystemId } from '../../tandem/keys.js';

// ── Scan helpers ───────────────────────────────────────────────────────────────

/**
 * Concurrent loaders often need the same default-model scan (levels and rooms, for
 * example) or the same model list, so identical requests made within a few seconds share
 * one network call.
 */
const SHARE_MS = 10000;
const sharedRequests = new Map();

/**
 * Run `request` unless an identical one started within SHARE_MS, in which case reuse its promise.
 * Failed requests are not kept.
 */
function shareRequest(cacheKey, request) {
  const cached = sharedRequests.get(cacheKey);

  if (cached && Date.now() - cached.time < SHARE_MS) {
    return cached.promise;
  }
  const promise = request().catch(error => {
    sharedRequests.delete(cacheKey);
    throw error;
  });

  sharedRequests.set(cacheKey, { time: Date.now(), promise });
  return promise;
}

/**
 * Value of a column that may or may not come wrapped in an array.
 */
function firstValue(value) {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Scan a model and return its rows (the leading version string is dropped).
 * @param {string} modelURN
 * @param {string} region
 * @param {object} scanOptions - families / qualifiedColumns / keys
 * @returns {Promise<Array<object>>}
 */
async function scanModel(modelURN, region, scanOptions) {
  const payload = JSON.stringify({ includeHistory: false, ...scanOptions });
  const response = await fetch(`${tandemBaseURL}/modeldata/${modelURN}/scan`, makeRequestOptionsPOST(payload, region));

  if (!response.ok) {
    const error = new Error(`Scan of ${modelURN} failed: ${response.statusText}`);

    error.status = response.status;
    throw error;
  }
  const data = await response.json();

  return data.filter(item => typeof item === 'object' && item !== null && item[QC.Key]);
}

/**
 * Scan the default model. A facility without a default model answers 403, which means
 * "nothing to show" rather than an error.
 * @returns {Promise<Array<object>>} Live (not deleted) rows
 */
function scanDefaultModel(facilityURN, region, scanOptions) {
  const defaultModelURN = getDefaultModelURN(facilityURN);

  return shareRequest(`scan|${defaultModelURN}|${JSON.stringify(scanOptions)}`, async () => {
    try {
      const rows = await scanModel(defaultModelURN, region, scanOptions);

      return rows.filter(isLive);
    } catch (error) {
      if (error.status === 403) {
        console.log('No default model found - nothing to load');
        return [];
      }
      throw error;
    }
  });
}

/**
 * Element flags of a row, read from its key.
 * @param {object} row
 * @returns {number|undefined}
 */
function flagsOf(row) {
  return getElementFlags(row[QC.Key]);
}

/**
 * A row is deleted when its Status/Deleted timestamp is set. The override column wins,
 * regardless of its value, so an element can be un-deleted by clearing the override.
 * @param {object} row
 * @returns {boolean}
 */
function isDeleted(row) {
  const override = firstValue(row[QC.ODeleted]);

  if (override !== undefined && override !== null) {
    return Number(override) > 0;
  }
  const value = firstValue(row[QC.Deleted]);

  return value !== undefined && value !== null && Number(value) !== 0;
}

function isLive(row) {
  return !isDeleted(row);
}

/**
 * Tandem category of a location row (override first).
 */
function tandemCategoryOf(row) {
  return row[QC.OTandemCategory]?.[0] ?? row[QC.TandemCategory]?.[0];
}

/**
 * Decoded reference (modelURN + element key) from a location to the BIM element it came from.
 */
function sourceOf(location) {
  const xref = firstValue(location[QC.BimElmOfAsset]);

  return xref ? decodeXref(xref) : null;
}

function isLocationOfCategory(row, category) {
  return flagsOf(row) === ElementFlags.Location && tandemCategoryOf(row) === category;
}

async function getDefaultModelLabel(facilityURN, region) {
  const defaultModelURN = getDefaultModelURN(facilityURN);
  const models = await shareRequest(`models|${facilityURN}`, () => getModels(facilityURN, region));
  const defaultModel = models?.find(model => model.modelId === defaultModelURN);

  return defaultModel?.label || '** Default Model **';
}

// ── Streams and tickets ────────────────────────────────────────────────────────

/**
 * Get streams (connections) from the default model.
 * @param {string} facilityURN - Facility URN
 * @param {string} region - Region identifier
 * @returns {Promise<Array>} Array of stream rows
 */
export async function getStreams(facilityURN, region) {
  try {
    const rows = await scanDefaultModel(facilityURN, region, {
      families: [
        ColumnFamilies.Standard,
        ColumnFamilies.DtProperties,
        ColumnFamilies.Xrefs,
        ColumnFamilies.Status
      ]
    });

    return rows.filter(row => flagsOf(row) === ElementFlags.StreamV3);
  } catch (error) {
    console.error('Error fetching streams:', error);
    return [];
  }
}

/**
 * Get tickets from the default model.
 * @param {string} facilityURN - Facility URN
 * @param {string} region - Region identifier
 * @returns {Promise<Array>} Array of ticket rows
 */
export async function getTickets(facilityURN, region) {
  try {
    const rows = await scanDefaultModel(facilityURN, region, {
      families: [
        ColumnFamilies.Standard,
        ColumnFamilies.Refs,
        ColumnFamilies.Xrefs,
        ColumnFamilies.Status
      ]
    });

    return rows.filter(row => flagsOf(row) === ElementFlags.Ticket);
  } catch (error) {
    console.error('Error fetching tickets:', error);
    return [];
  }
}

// ── Levels and rooms (Location Breakdown Structure) ────────────────────────────

/**
 * Columns needed to read both levels and rooms, so one scan serves both loaders.
 */
const locationScan = {
  qualifiedColumns: [
    QC.TandemCategory,
    QC.OTandemCategory,
    QC.Name,
    QC.OName,
    QC.Elevation,
    QC.OElevation,
    QC.BimElmOfAsset,
    QC.Deleted,
    QC.ODeleted
  ]
};

/**
 * Get levels. In V3 they are Location elements of the default model.
 * @param {string} facilityURN - Facility URN
 * @param {string} region - Region identifier
 * @returns {Promise<Array>} Array of level objects with modelId, modelName, key, name, and elevation
 */
export async function getLevels(facilityURN, region) {
  try {
    const [rows, modelName] = await Promise.all([
      scanDefaultModel(facilityURN, region, locationScan),
      getDefaultModelLabel(facilityURN, region)
    ]);
    const modelId = getDefaultModelURN(facilityURN);

    return rows
      .filter(row => isLocationOfCategory(row, TC.Levels))
      .map(level => ({
        modelId,
        modelName,
        key: level[QC.Key],
        name: level[QC.OName]?.[0] ?? level[QC.Name]?.[0] ?? 'Unnamed Level',
        elevation: level[QC.OElevation]?.[0] ?? level[QC.Elevation]?.[0]
      }));
  } catch (error) {
    console.error('Error fetching levels:', error);
    return [];
  }
}

/**
 * Get rooms and spaces. In V3 they are Location elements of the default model. Area, volume
 * and the Room/Space distinction are properties of the BIM element a location was created
 * from, so they are read from the model its QC.BimElmOfAsset reference points to.
 * @param {string} facilityURN - Facility URN
 * @param {string} region - Region identifier
 * @param {Object} schemaCache - Optional pre-loaded schema cache to avoid duplicate API calls
 * @returns {Promise<Array>} Array of room objects with modelId, key, name, type, area, and volume
 */
export async function getRooms(facilityURN, region, schemaCache = null) {
  try {
    const [rows, modelName] = await Promise.all([
      scanDefaultModel(facilityURN, region, locationScan),
      getDefaultModelLabel(facilityURN, region)
    ]);
    const modelId = getDefaultModelURN(facilityURN);
    const roomRows = rows.filter(row => isLocationOfCategory(row, TC.Rooms));

    // Group the source references by model so each BIM model is read once
    const sourcesByModel = new Map();

    for (const room of roomRows) {
      const decoded = sourceOf(room);

      if (!decoded) {
        continue;
      }
      const sourceKeys = sourcesByModel.get(decoded.modelURN) ?? [];

      sourceKeys.push(decoded.elementKey);
      sourcesByModel.set(decoded.modelURN, sourceKeys);
    }
    const sourceDetails = await loadRoomSourceDetails(sourcesByModel, region, schemaCache);

    return roomRows.map(room => {
      const decoded = sourceOf(room);
      const source = decoded ? sourceDetails.get(decoded.elementKey) : null;
      const type = source?.categoryId === 3600 ? 'Space' : 'Room';

      return {
        modelId,
        modelName,
        key: room[QC.Key],
        name: room[QC.OName]?.[0] ?? room[QC.Name]?.[0] ?? (type === 'Space' ? 'Unnamed Space' : 'Unnamed Room'),
        area: source?.area ?? null,
        areaUnit: source?.areaUnit ?? 'square feet',
        volume: source?.volume ?? null,
        volumeUnit: source?.volumeUnit ?? 'cubic feet',
        type
      };
    });
  } catch (error) {
    console.error('Error fetching rooms:', error);
    return [];
  }
}

/**
 * Read category, area and volume of the BIM elements that rooms were created from.
 * @param {Map<string, Array<string>>} sourcesByModel - modelURN -> element keys
 * @returns {Promise<Map<string, object>>} element key -> details
 */
async function loadRoomSourceDetails(sourcesByModel, region, schemaCache) {
  const details = new Map();

  await Promise.all(
    Array.from(sourcesByModel.entries()).map(async ([modelURN, keys]) => {
      try {
        const schema = schemaCache?.[modelURN] ?? await getSchema(modelURN, region);
        const areaAttr = schema.attributes?.find(a => a.category === 'Dimensions' && a.name === 'Area');
        const volumeAttr = schema.attributes?.find(a => a.category === 'Dimensions' && a.name === 'Volume');
        const qualifiedColumns = [QC.CategoryId];

        if (areaAttr) qualifiedColumns.push(areaAttr.id);
        if (volumeAttr) qualifiedColumns.push(volumeAttr.id);

        // The source rooms were soft-deleted when they were mirrored as Locations, and a scan hides deleted rows by default
        const elements = await scanModel(modelURN, region, { keys, qualifiedColumns, includeDeleted: true });

        for (const element of elements) {
          details.set(element[QC.Key], {
            categoryId: element[QC.CategoryId]?.[0],
            area: areaAttr ? element[areaAttr.id]?.[0] : null,
            areaUnit: areaAttr?.forgeUnit || 'square feet',
            volume: volumeAttr ? element[volumeAttr.id]?.[0] : null,
            volumeUnit: volumeAttr?.forgeUnit || 'cubic feet'
          });
        }
      } catch (error) {
        console.error(`getRooms: failed to read source elements of model ${modelURN}:`, error);
      }
    })
  );
  return details;
}

// ── Systems ────────────────────────────────────────────────────────────────────

function systemClassToList(flags) {
  if (!flags) {
    return [];
  }
  const result = [];

  for (let i = 0; i < SystemClassNames.length; i++) {
    if (flags & (1 << i)) {
      result.push(SystemClassNames[i]);
    }
  }
  return result;
}

/**
 * Get systems from the default model, with the number of elements (in all models) that belong
 * to each of them.
 * @param {string} facilityURN - Facility URN
 * @param {string} region - Region identifier
 * @param {Array} models - Array of model objects
 * @returns {Promise<Array>} Array of system objects with name, key, systemId, and subsystems
 */
export async function getSystems(facilityURN, region, models) {
  try {
    const rows = await scanDefaultModel(facilityURN, region, {
      families: [
        ColumnFamilies.Standard,
        ColumnFamilies.Systems,
        ColumnFamilies.Refs,
        ColumnFamilies.Status
      ]
    });
    const systemElements = rows.filter(row => flagsOf(row) === ElementFlags.System);
    const systems = [];
    const subsystems = [];

    for (const item of systemElements) {
      const name = item[QC.OName]?.[0] ?? item[QC.Name]?.[0];
      const key = item[QC.Key];
      const parent = item[QC.Parent]?.[0];
      const systemClass = item[QC.OSystemClass]?.[0] ?? item[QC.SystemClass]?.[0];

      if (parent) {
        subsystems.push({ name: name || 'Unnamed Subsystem', key, parent, systemClass });
      } else {
        systems.push({
          name: name || 'Unnamed System',
          key,
          // The system id is derived from the last 4 bytes of the (full) key
          systemId: toSystemId(key),
          systemClass,
          elementCount: 0 // calculated below
        });
      }
    }
    systems.forEach(system => {
      system.subsystems = subsystems.filter(sub => sub.parent === system.key);
    });

    const systemMap = {};

    for (const system of systems) {
      systemMap[system.systemId] = system;
      system.elementsByModel = {};
    }
    const systemElementsMap = {};
    const systemClassMap = {};

    // Elements of every model can belong to a system: fetch all models in parallel, then
    // process the results sequentially (pure CPU, no shared-accumulator races)
    const modelDataList = await Promise.all(
      models.map(async (model) => {
        try {
          const data = await scanModel(model.modelId, region, {
            families: [ColumnFamilies.Standard, ColumnFamilies.Systems, ColumnFamilies.Status]
          });

          return { model, data };
        } catch (error) {
          console.error(`getSystems: failed to fetch model ${model.modelId}`, error);
          return { model, data: [] };
        }
      })
    );

    for (const { model, data } of modelDataList) {
      for (const element of data) {
        const key = element[QC.Key];

        if (isDeleted(element) || flagsOf(element) === ElementFlags.System) {
          continue;
        }
        const elementClass = element[QC.OSystemClass] ?? element[QC.SystemClass];

        if (!elementClass) {
          continue;
        }
        let elementClassNames = systemClassMap[elementClass];

        if (!elementClassNames) {
          elementClassNames = systemClassToList(elementClass);
          systemClassMap[elementClass] = elementClassNames;
        }
        for (const item in element) {
          // we need to handle both fam:col and fam:!col formats
          const [, family, systemId] = item.match(/^([^:]+):!?(.+)$/) ?? [];

          if (family !== ColumnFamilies.Systems) {
            continue;
          }
          const system = systemMap[systemId];

          if (!system) {
            continue;
          }
          let classNames = systemClassMap[system.systemClass];

          if (!classNames) {
            classNames = systemClassToList(system.systemClass);
            systemClassMap[system.systemClass] = classNames;
          }
          if (!elementClassNames.some(name => classNames.includes(name))) {
            continue;
          }
          const elementList = systemElementsMap[systemId] || new Set();

          elementList.add(key);
          systemElementsMap[systemId] = elementList;

          if (!system.elementsByModel[model.modelId]) {
            system.elementsByModel[model.modelId] = {
              modelURN: model.modelId,
              modelName: model.label || 'Unknown Model',
              keys: new Set()
            };
          }
          system.elementsByModel[model.modelId].keys.add(key);
        }
      }
    }
    for (const system of systems) {
      const elementSet = systemElementsMap[system.systemId];

      system.elementCount = elementSet ? elementSet.size : 0;
      system.elementsByModel = Object.values(system.elementsByModel).map(model => ({
        modelURN: model.modelURN,
        modelName: model.modelName,
        keys: Array.from(model.keys)
      }));
    }
    return systems;
  } catch (error) {
    console.error('Error fetching systems:', error);
    return [];
  }
}

// ── Tagged assets ──────────────────────────────────────────────────────────────

/**
 * Get detailed information about assets and their user-defined properties.
 * In V3 an asset is a GenericAsset element of the default model, so no per-element
 * guessing (n:ia, z: properties) is needed and only that one model is scanned.
 * @param {string} facilityURN - Facility URN
 * @param {string} region - Region identifier
 * @param {boolean} includeKeys - If true, also collect element keys grouped by model
 * @returns {Promise<Object>} Object with totalCount, propertyUsageByModel, and optionally elementsByModel
 */
export async function getTaggedAssetsDetails(facilityURN, region, includeKeys = false) {
  try {
    const [rows, modelName] = await Promise.all([
      scanDefaultModel(facilityURN, region, {
        // A scan only returns rows that have data in the requested families. An asset can have no name and
        // no custom properties and still be an asset (it only links to its BIM element and location), so the
        // reference families are needed too. Same list as tutorial-rest getTaggedAssets.
        families: [
          ColumnFamilies.Standard,
          ColumnFamilies.DtProperties,
          ColumnFamilies.Refs,
          ColumnFamilies.Xrefs,
          ColumnFamilies.Status
        ]
      }),
      getDefaultModelLabel(facilityURN, region)
    ]);
    const modelId = getDefaultModelURN(facilityURN);
    const assets = rows.filter(row => flagsOf(row) === ElementFlags.GenericAsset);
    const props = {}; // propId -> count
    const keys = [];

    for (const asset of assets) {
      if (includeKeys) {
        keys.push(asset[QC.Key]);
      }
      for (const column of Object.keys(asset)) {
        if (column.startsWith(`${ColumnFamilies.DtProperties}:`)) {
          props[column] = (props[column] || 0) + 1;
        }
      }
    }
    const result = {
      totalCount: assets.length,
      propertyUsageByModel: Object.keys(props).length > 0 ? { [modelId]: { modelName, props } } : {}
    };

    if (includeKeys) {
      result.elementsByModel = keys.length > 0 ? [{ modelURN: modelId, modelName, keys }] : [];
    }
    return result;
  } catch (error) {
    console.error('Error fetching tagged assets details:', error);
    return { totalCount: 0, propertyUsageByModel: {}, elementsByModel: includeKeys ? [] : undefined };
  }
}
