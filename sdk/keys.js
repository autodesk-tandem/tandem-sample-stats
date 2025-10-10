/**
 * Utility functions for working with Tandem keys and xrefs
 * Adapted from tandem-sample-rest-testbed
 */

// Constants
const kModelIdSize = 16;
const kElementIdSize = 20;
const kElementFlagsSize = 4;
const kElementIdWithFlagsSize = kElementIdSize + kElementFlagsSize;

/**
 * Convert to websafe base64 (replace +/= with -_)
 * @param {string} urn 
 * @returns {string}
 */
function makeWebsafe(urn) {
  return urn.replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Convert long key (with flags) to short key (without flags)
 * Long key is 24 bytes (4 bytes flags + 20 bytes element ID)
 * Short key is 20 bytes (just the element ID)
 * @param {string} fullKey - Full element key with flags
 * @returns {string} Short element key without flags
 */
export function toShortKey(fullKey) {
  // Convert from URL-safe base64 to standard base64
  const tmp = fullKey.replace(/-/g, '+').replace(/_/g, '/');
  // Add padding if needed
  let standardB64 = tmp;
  while (standardB64.length % 4) {
    standardB64 += '=';
  }
  
  const binData = new Uint8Array(atob(standardB64).split('').map(c => c.charCodeAt(0)));
  const shortKey = new Uint8Array(kElementIdSize);
  
  // Skip first 4 bytes (flags) and copy the remaining 20 bytes (element ID)
  shortKey.set(binData.subarray(kElementFlagsSize));
  return makeWebsafe(btoa(String.fromCharCode.apply(null, shortKey)));
}

/**
 * Decode xref to extract model URN and element key
 * Xref format: base64 encoded binary [16 bytes modelId + 24 bytes elementKey with flags]
 * @param {string} xref - Base64 encoded xref (URL-safe format)
 * @returns {Object|null} Object with modelURN and elementKey, or null if invalid
 */
export function decodeXref(xref) {
  try {
    // Convert URL-safe base64 to standard base64
    let standardB64 = xref.replace(/-/g, '+').replace(/_/g, '/');
    // Add padding if needed
    while (standardB64.length % 4) {
      standardB64 += '=';
    }
    
    // Decode base64 to binary
    const decoded = atob(standardB64);
    const bytes = new Uint8Array(decoded.length);
    for (let i = 0; i < decoded.length; i++) {
      bytes[i] = decoded.charCodeAt(i);
    }
    
    // Xref should be 16 bytes (model) + 24 bytes (element with flags) = 40 bytes
    if (bytes.length < kModelIdSize + kElementIdWithFlagsSize) {
      console.error('Xref too short after decoding:', bytes.length, 'expected', kModelIdSize + kElementIdWithFlagsSize);
      return null;
    }
    
    // Extract model ID (first 16 bytes)
    const modelIdBytes = bytes.slice(0, kModelIdSize);
    const modelIdStr = String.fromCharCode.apply(null, Array.from(modelIdBytes));
    const modelIdB64 = makeWebsafe(btoa(modelIdStr));
    
    // Extract element key with flags (next 24 bytes)
    const elementKeyBytes = bytes.slice(kModelIdSize, kModelIdSize + kElementIdWithFlagsSize);
    const elementKeyStr = String.fromCharCode.apply(null, Array.from(elementKeyBytes));
    const elementKeyB64 = makeWebsafe(btoa(elementKeyStr));
    
    // Construct full model URN
    const modelURN = `urn:adsk.dtm:${modelIdB64}`;
    
    return {
      modelURN: modelURN,
      elementKey: elementKeyB64  // This is the long key (24 bytes with flags)
    };
  } catch (error) {
    console.error('Error decoding xref:', error, xref);
    return null;
  }
}

/**
 * Make an Xref key for the database that is the modelURN + the element Key.
 * @param {string} modelURN 
 * @param {string} elemKey 
 * @returns {string}
 */
export function makeXrefKey(modelURN, elemKey) {
  const modelId = modelURN.slice(13);   // strip off the "urn:adsk.dtm:" prefix

  // convert from websafe to regular so it works with atob()
  const modelId_enc = modelId.replace(/-/g, '+').replace(/_/g, '/');
  const modelId_dec = atob(modelId_enc);

  const elemKey_enc = elemKey.replace(/-/g, '+').replace(/_/g, '/');
  const elemKey_dec = atob(elemKey_enc);

  const concatStr = modelId_dec + elemKey_dec;  // concat them together

  return makeWebsafe(btoa(concatStr));    // re-encode and make web-safe to get our xrefKey
}

/**
 * Converts xref key to model and element keys.
 * Returns arrays of model keys and element keys extracted from the xref array
 * @param {string} text - Base64 encoded xref(s)
 * @returns {Array<Array<string>>} [modelKeys, elementKeys]
 */
export function fromXrefKeyArray(text) {
  const modelKeys = [];
  const elementKeys = [];

  if (!text) {
    return [modelKeys, elementKeys];
  }
  
  const tmp = text.replace(/-/g, '+').replace(/_/g, '/');
  const binData = new Uint8Array(atob(tmp).split('').map(c => c.charCodeAt(0)));
  const modelBuff = new Uint8Array(kModelIdSize);
  const keyBuff = new Uint8Array(kElementIdWithFlagsSize);
  let offset = 0;

  while (offset < binData.length) {
    const size = binData.length - offset;

    if (size < (kModelIdSize + kElementIdWithFlagsSize)) {
      break;
    }
    
    modelBuff.set(binData.subarray(offset, offset + kModelIdSize));
    const modelKey = makeWebsafe(btoa(String.fromCharCode.apply(null, modelBuff)));
    modelKeys.push(modelKey);
    
    // element key
    keyBuff.set(binData.subarray(offset + kModelIdSize, offset + kModelIdSize + kElementIdWithFlagsSize));
    const elementKey = makeWebsafe(btoa(String.fromCharCode.apply(null, keyBuff)));
    elementKeys.push(elementKey);
    
    offset += (kModelIdSize + kElementIdWithFlagsSize);
  }
  
  return [modelKeys, elementKeys];
}

