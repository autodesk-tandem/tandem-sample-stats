/**
 * Schema V2 data loaders.
 *
 * Everything here depends on how V2 stores and flags elements: streams, tickets, levels,
 * rooms and systems are identified by their own ElementFlags values, assets are BIM
 * elements with user-defined (z:) properties, and scan rows carry 20-byte short keys.
 *
 * Each function returns the same shape as its V3 counterpart in js/v3/api.js so the
 * shared UI does not need to know which schema version it is displaying.
 */
import {
  getModels,
  getDefaultModelURN,
  getSchema,
  tandemBaseURL,
  makeRequestOptionsPOST
} from '../shared/api.js';
import { ColumnFamilies, ElementFlags, QC, SystemClassNames } from '../../tandem/constants.js';
import { toFullKey, toSystemId } from '../../tandem/keys.js';

/**
 * Get streams from the default model
 * Streams only exist in the default model
 * @param {string} facilityURN - Facility URN
 * @param {string} region - Region identifier
 * @returns {Promise<Array>} Array of stream objects
 */
export async function getStreams(facilityURN, region) {
  try {
    const defaultModelURN = getDefaultModelURN(facilityURN);
    
    const payload = JSON.stringify({
      families: [
        ColumnFamilies.Standard,
        ColumnFamilies.DtProperties,
        ColumnFamilies.Xrefs
      ], // Standard, DtProperties, and Xrefs column families
      includeHistory: false
    });
    
    const requestPath = `${tandemBaseURL}/modeldata/${defaultModelURN}/scan`;
    const response = await fetch(requestPath, makeRequestOptionsPOST(payload, region));
    
    if (!response.ok) {
      // 403 Forbidden typically means no default model exists yet
      if (response.status === 403) {
        console.log('No default model found - streams not available');
        return [];
      }
      throw new Error(`Failed to fetch streams: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Filter for elements that are streams (ElementFlags.StreamV2)
    const streams = data.filter(row => {
      const flags = row[QC.ElementFlags];
      return flags && flags[0] === ElementFlags.StreamV2;
    });
    
    return streams;
  } catch (error) {
    console.error('Error fetching streams:', error);
    return [];
  }
}

/**
 * Get tickets from the default model
 * Tickets only exist in the default model
 * @param {string} facilityURN - Facility URN
 * @param {string} region - Region identifier
 * @returns {Promise<Array>} Array of ticket objects
 */
export async function getTickets(facilityURN, region) {
  try {
    const defaultModelURN = getDefaultModelURN(facilityURN);
    
    const payload = JSON.stringify({
      families: [
        ColumnFamilies.Standard,
        ColumnFamilies.Refs,
        ColumnFamilies.Xrefs
      ],
      includeHistory: false
    });
    
    const requestPath = `${tandemBaseURL}/modeldata/${defaultModelURN}/scan`;
    const response = await fetch(requestPath, makeRequestOptionsPOST(payload, region));
    
    if (!response.ok) {
      if (response.status === 403) {
        console.log('No default model found - tickets not available');
        return [];
      }
      throw new Error(`Failed to fetch tickets: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Filter for elements that are tickets (ElementFlags.Ticket)
    const tickets = data.filter(row => {
      const flags = row[QC.ElementFlags];
      return flags && flags[0] === ElementFlags.Ticket;
    });
    
    return tickets;
  } catch (error) {
    console.error('Error fetching tickets:', error);
    return [];
  }
}

/**
 * Get levels from all models in a facility.
 * Uses ElementFlags.Level (0x01000001) to identify levels.
 * Fetches all models in parallel with Promise.all() for maximum speed.
 * @param {string} facilityURN - Facility URN
 * @param {string} region - Region identifier
 * @returns {Promise<Array>} Array of level objects with modelId, key, name, and elevation
 */
export async function getLevels(facilityURN, region) {
  try {
    const models = await getModels(facilityURN, region);

    const perModelResults = await Promise.all(
      models.map(async (model) => {
        const payload = JSON.stringify({
          qualifiedColumns: [QC.ElementFlags, QC.Name, QC.Elevation],
          includeHistory: false
        });

        const requestPath = `${tandemBaseURL}/modeldata/${model.modelId}/scan`;
        const response = await fetch(requestPath, makeRequestOptionsPOST(payload, region));

        if (!response.ok) {
          console.error(`getLevels: failed to fetch model ${model.modelId}`);
          return []; // return empty array so Promise.all can still complete
        }

        const elements = await response.json();

        // Filter for levels and map to a clean output shape
        return elements
          .filter(row => row[QC.ElementFlags]?.[0] === ElementFlags.Level)
          .map(level => ({
            modelId:   model.modelId,
            modelName: model.label,
            key:       level[QC.Key],
            name:      level[QC.Name]?.[0] || 'Unnamed Level',
            elevation: level[QC.Elevation]?.[0]
          }));
      })
    );

    return perModelResults.flat();
  } catch (error) {
    console.error('Error fetching levels:', error);
    return [];
  }
}

/**
 * Get rooms and spaces from all models in a facility
 * Uses ElementFlags.Room (0x00000005) to identify both Rooms and Spaces
 * Then uses CategoryId to differentiate: 160 = Room, 3600 = Space
 * @param {string} facilityURN - Facility URN
 * @param {string} region - Region identifier
 * @param {Object} schemaCache - Optional pre-loaded schema cache to avoid duplicate API calls
 * @returns {Promise<Array>} Array of room objects with modelId, key, name, type, number, area, and volume
 */
export async function getRooms(facilityURN, region, schemaCache = null) {
  try {
    const models = await getModels(facilityURN, region);

    // Each model independently resolves its schema (cache hit if pre-loaded)
    // then fires its scan. All models run their schema→scan pipeline concurrently.
    const perModelResults = await Promise.all(
      models.map(async (model) => {
        const schema = schemaCache && schemaCache[model.modelId]
          ? schemaCache[model.modelId]
          : await getSchema(model.modelId);

        const areaAttr   = schema.attributes?.find(a => a.category === 'Dimensions' && a.name === 'Area');
        const volumeAttr = schema.attributes?.find(a => a.category === 'Dimensions' && a.name === 'Volume');
        const areaQualifiedProp   = areaAttr?.id;
        const areaUnit            = areaAttr?.forgeUnit   || 'square feet';
        const volumeQualifiedProp = volumeAttr?.id;
        const volumeUnit          = volumeAttr?.forgeUnit || 'cubic feet';

        // ElementFlags.Room matches both rooms (CategoryId 160) and spaces (CategoryId 3600)
        const qualifiedColumns = [QC.ElementFlags, QC.CategoryId, QC.Name];
        if (areaQualifiedProp)   qualifiedColumns.push(areaQualifiedProp);
        if (volumeQualifiedProp) qualifiedColumns.push(volumeQualifiedProp);

        const payload = JSON.stringify({ qualifiedColumns, includeHistory: false });
        const requestPath = `${tandemBaseURL}/modeldata/${model.modelId}/scan`;
        const response = await fetch(requestPath, makeRequestOptionsPOST(payload, region));

        if (!response.ok) {
          console.error(`getRooms: failed to fetch model ${model.modelId}`);
          return [];
        }

        const elements = await response.json();
        return elements
          .filter(row => row[QC.ElementFlags]?.[0] === ElementFlags.Room)
          .map(element => {
            const categoryId  = element[QC.CategoryId]?.[0];
            const type        = categoryId === 3600 ? 'Space' : 'Room';
            const defaultName = categoryId === 3600 ? 'Unnamed Space' : 'Unnamed Room';
            return {
              modelId:   model.modelId,
              modelName: model.label,
              key:       element[QC.Key],
              name:      element[QC.Name]?.[0] || defaultName,
              area:      areaQualifiedProp   ? element[areaQualifiedProp]?.[0]   : null,
              areaUnit,
              volume:    volumeQualifiedProp ? element[volumeQualifiedProp]?.[0] : null,
              volumeUnit,
              type
            };
          });
      })
    );

    return perModelResults.flat();
  } catch (error) {
    console.error('Error fetching rooms:', error);
    return [];
  }
}

/**
 * Get systems from the default model
 * Systems are elements with ElementFlags.Systems flag
 * @param {string} facilityURN - Facility URN
 * @param {string} region - Region identifier
 * @param {Array} models - Array of model objects
 * @returns {Promise<Array>} Array of system objects with name, key, systemId, and subsystems
 */
export async function getSystems(facilityURN, region, models) {
  try {
    const defaultModelURN = getDefaultModelURN(facilityURN);
    
    const payload = JSON.stringify({
      families: [
        ColumnFamilies.Standard,
        ColumnFamilies.Systems,
        ColumnFamilies.Refs
      ],
      includeHistory: false
    });
    
    const requestPath = `${tandemBaseURL}/modeldata/${defaultModelURN}/scan`;
    const response = await fetch(requestPath, makeRequestOptionsPOST(payload, region));
    
    if (!response.ok) {
      // 403 Forbidden typically means no default model exists yet
      if (response.status === 403) {
        console.log('No default model found - systems not available');
        return [];
      }
      throw new Error(`Failed to fetch systems: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Filter for elements that are systems (ElementFlags.System)
    const systemElements = data.filter(row => {
      const flags = row[QC.ElementFlags];
      return flags && flags[0] === ElementFlags.System;
    });
    
    // Process systems and build hierarchy
    const systems = [];
    const subsystems = [];
    
    for (const item of systemElements) {
      const name = item[QC.OName]?.[0] ?? item[QC.Name]?.[0];
      const key = item[QC.Key];
      const parent = item[QC.Parent]?.[0];
      
      if (parent) {
        // This is a subsystem
        subsystems.push({
          name: name || 'Unnamed Subsystem',
          key: key,
          parent: parent,
          systemClass: item[QC.OSystemClass]?.[0] ?? item[QC.SystemClass]?.[0]
        });
      } else {
        // This is a main system
        const fullKey = toFullKey(key, true);
        const systemId = toSystemId(fullKey);
        
        systems.push({
          name: name || 'Unnamed System',
          key: key,
          systemId: systemId,
          systemClass: item[QC.OSystemClass]?.[0] ?? item[QC.SystemClass]?.[0],
          elementCount: 0 // will be calculated later
        });
      }
    }
    
    // Attach subsystems to their parent systems
    systems.forEach(system => {
      system.subsystems = subsystems.filter(sub => sub.parent === system.key);
    });
    // calculate element count for each system and track by model
    const systemMap = {};

    for (const system of systems) {
      systemMap[system.systemId] = system;
      // Initialize elementsByModel as an object to group keys by model
      system.elementsByModel = {};
    }
    const systemElementsMap = {};
    const systemClassMap = {};

    // ── Fetch all model element data in parallel ──────────────────────────
    // All model scans fire simultaneously; processing of shared state
    // (systemMap, systemElementsMap) happens sequentially after all fetches
    // complete, so there are no shared-accumulator race conditions.
    const modelDataList = await Promise.all(
      models.map(async (model) => {
        const payload = JSON.stringify({
          families: [ColumnFamilies.Standard, ColumnFamilies.Systems],
          includeHistory: false
        });
        const requestPath = `${tandemBaseURL}/modeldata/${model.modelId}/scan`;
        const response    = await fetch(requestPath, makeRequestOptionsPOST(payload, region));

        if (!response.ok) {
          console.error(`getSystems: failed to fetch model ${model.modelId}`);
          return { model, data: [] };
        }
        return { model, data: await response.json() };
      })
    );

    // ── Process fetched data (sequential — pure CPU, no network) ─────────
    for (const { model, data } of modelDataList) {
      for (const element of data) {
        const key = element[QC.Key];

        if (!key) {
          continue;
        }
        const elementFlags = element[QC.ElementFlags]?.[0];

        if (elementFlags === ElementFlags.Deleted || elementFlags === ElementFlags.System) {
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
          const matches = elementClassNames.some(name => classNames.includes(name));

          if (matches) {
            // Track total count
            const elementList = systemElementsMap[systemId] || new Set();
            elementList.add(key);
            systemElementsMap[systemId] = elementList;
            
            // Track by model
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
    }
    // update element count and convert Sets to Arrays
    for (const system of systems) {
      const elementSet = systemElementsMap[system.systemId];
      system.elementCount = elementSet ? elementSet.size : 0;
      
      // Convert elementsByModel Sets to Arrays
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

/**
 * Returns true when an element type is eligible to be a tagged asset.
 * Physical elements (flags 0x00–0x04) and GenericAsset (0x01000005) are eligible.
 * Rooms, Levels, Streams, Tickets, Systems, etc. are not.
 * @param {number|undefined} flags - Element flags value from QC.ElementFlags
 * @returns {boolean}
 */
function isAssetCandidate(flags) {
  if (flags === undefined || flags === null) return false;
  return flags <= 0x00000004 || flags === ElementFlags.GenericAsset;
}

/**
 * Get count of tagged assets from all models in a facility.
 * An element is a tagged asset when the n:ia (IsAsset) field is present and truthy.
 * For older elements that predate this field, the fallback is: eligible element type
 * AND has at least one z: (user-defined) property.
 * @param {string} facilityURN - Facility URN
 * @param {string} [region] - Optional region identifier
 * @returns {Promise<number>} Count of tagged assets
 */
export async function getTaggedAssetsCount(facilityURN, region) {
  try {
    const details = await getTaggedAssetsDetails(facilityURN, region);
    return details.totalCount;
  } catch (error) {
    console.error('Error fetching tagged assets count:', error);
    return 0;
  }
}

/**
 * Get detailed information about tagged assets and their user-defined properties
 * @param {string} facilityURN - Facility URN
 * @param {string} region - Region identifier
 * @param {boolean} includeKeys - If true, also collect element keys grouped by model
 * @returns {Promise<Object>} Object with totalCount, propertyUsage, and optionally elementsByModel
 */
export async function getTaggedAssetsDetails(facilityURN, region, includeKeys = false) {
  try {
    const models = await getModels(facilityURN, region);
    const t0 = performance.now();

    // ── Helper: classify a single element as tagged asset or not ──────────
    // Extracted so both implementations share the same logic.
    function classifyElement(element) {
      const isAssetFlag    = element[QC.IsAsset];
      const hasIsAssetField = isAssetFlag !== undefined && isAssetFlag !== null;
      if (hasIsAssetField) {
        // n:ia present: its value is the authoritative answer. The field is set
        // automatically when a z: property is first written and persists even if
        // those properties are later removed.
        return !!isAssetFlag;
      }
      // n:ia absent (older elements): fall back to eligible element type AND has z: properties.
      const flags     = element[QC.ElementFlags];
      const hasZProps = Object.keys(element).some(k => k.startsWith(`${ColumnFamilies.DtProperties}:`));
      return isAssetCandidate(flags) && hasZProps;
    }

    // ── Helper: build a per-model result object from raw scan data ────────
    function processModelElements(model, rawData) {
      const elements  = rawData.filter(item => typeof item === 'object' && item !== null && item[QC.Key]);
      const modelKeys = [];
      let   count     = 0;
      const props     = {}; // propId -> count

      elements.forEach(element => {
        if (!classifyElement(element)) return;
        count++;
        if (includeKeys && element[QC.Key]) modelKeys.push(element[QC.Key]);

        // Track z: property usage (separate from asset counting)
        Object.keys(element)
          .filter(k => k.startsWith(`${ColumnFamilies.DtProperties}:`))
          .forEach(prop => { props[prop] = (props[prop] || 0) + 1; });
      });

      return { model, count, modelKeys, props };
    }

    // ── Fetch all models in parallel ─────────────────────────────────────
    // Each model scan returns a plain result object via processModelElements.
    // Shared accumulators are only written after all fetches complete, so
    // there are no race conditions when merging results below.
    // IMPORTANT: Must include Standard family to get the IsAsset flag.
    const perModelResults = await Promise.all(
      models.map(async (model) => {
        const payload = JSON.stringify({
          families: [ColumnFamilies.Standard, ColumnFamilies.DtProperties],
          includeHistory: false,
          skipArrays: true
        });
        const requestPath = `${tandemBaseURL}/modeldata/${model.modelId}/scan`;
        const response    = await fetch(requestPath, makeRequestOptionsPOST(payload, region));

        if (!response.ok) {
          console.error(`getTaggedAssetsDetails: failed to fetch model ${model.modelId}`);
          return { model, count: 0, modelKeys: [], props: {} };
        }

        const rawData = await response.json();
        return processModelElements(model, rawData);
      })
    );

    // ── Merge results ─────────────────────────────────────────────────────
    let totalTaggedAssets    = 0;
    const propertyUsageByModel = {};
    const elementsByModel      = [];

    for (const { model, count, modelKeys, props } of perModelResults) {
      totalTaggedAssets += count;

      if (Object.keys(props).length > 0) {
        propertyUsageByModel[model.modelId] = { modelName: model.label || '', props };
      }

      if (includeKeys && modelKeys.length > 0) {
        elementsByModel.push({
          modelURN:  model.modelId,
          modelName: model.label || 'Unknown Model',
          keys:      modelKeys
        });
      }
    }

    const result = { totalCount: totalTaggedAssets, propertyUsageByModel };
    if (includeKeys) result.elementsByModel = elementsByModel;
    return result;

  } catch (error) {
    console.error('Error fetching tagged assets details:', error);
    return { totalCount: 0, propertyUsage: {}, elementsByModel: includeKeys ? [] : undefined };
  }
}

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
