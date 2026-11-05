/**
 * Schema V3 ("No-BIM") module.
 *
 * V3 facts that make this folder different from js/v2:
 *  - Assets are split from BIM elements and live in the default model, together with levels,
 *    rooms, streams, tickets and systems.
 *  - Levels and rooms are Location elements (a Location Breakdown Structure).
 *  - There is only one kind of key: the 24-byte key, whose first 4 bytes are the element flags.
 *    Scan rows, history, stream data, stream configs and xrefs all use it unchanged.
 */
import { getStreams, getTickets, getLevels, getRooms, getSystems, getTaggedAssetsDetails } from './api.js';
import { viewAssetDetails } from './features/assetDetails.js';

export default {
  schemaVersion: 3,
  label: 'V3',
  minSchemaVersion: 3,
  loaders: {
    getStreams,
    getTickets,
    getLevels,
    getRooms,
    getSystems,
    getTaggedAssetsDetails
  },
  // Rows are keyed by the 24-byte key already, so there is nothing to convert
  toRowKey: (key) => key,
  viewAssetDetails
};
