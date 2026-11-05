/**
 * Schema V2 module.
 *
 * V2 facts that make this folder different from js/v3:
 *  - Streams, tickets, levels, rooms and systems are separate element types (ElementFlags).
 *  - Levels and rooms are found by scanning every model, not only the default model.
 *  - Scan rows (`k`) carry 20-byte short keys, while stream data and stream configs use
 *    24-byte long keys, so keys have to be converted before they can be matched.
 *  - Assets are BIM elements that carry user-defined (z:) properties.
 */
import { getStreams, getTickets, getLevels, getRooms, getSystems, getTaggedAssetsDetails } from './api.js';
import { viewAssetDetails } from './features/assetDetails.js';
import { toShortKey } from '../../tandem/keys.js';

export default {
  schemaVersion: 2,
  label: 'V2',
  minSchemaVersion: 2,
  loaders: {
    getStreams,
    getTickets,
    getLevels,
    getRooms,
    getSystems,
    getTaggedAssetsDetails
  },
  toRowKey: toShortKey,
  viewAssetDetails
};
