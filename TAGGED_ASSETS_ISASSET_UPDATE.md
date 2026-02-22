# Tagged Assets: IsAsset Flag Update

## Summary

Updated the Tagged Assets card to use the explicit `IsAsset` flag instead of relying solely on the presence of custom properties (`z:` family).

## What Changed

### Before (Old Logic)
```javascript
// Scanned ONLY for z: family properties
families: ['z']

// Counted ANY element with z: properties
const zProperties = keys.filter(key => key.startsWith('z:'));
if (zProperties.length > 0) {
  totalTaggedAssets++;
}
```

**Problem:** This counted elements that had custom properties but weren't officially flagged as "assets" for billing/capacity tracking purposes.

### After (New Logic)
```javascript
// Scan for BOTH Standard (for IsAsset flag) and DtProperties
families: [
  ColumnFamilies.Standard,     // Need this for IsAsset flag
  ColumnFamilies.DtProperties  // Need this for z: properties
]

// ONLY count elements with explicit IsAsset flag
const isAsset = element[QC.IsAsset];
if (!isAsset) {
  return; // Skip elements that aren't flagged as assets
}

// Then check for z: properties
const zProperties = keys.filter(key => key.startsWith('z:'));
if (zProperties.length > 0) {
  totalTaggedAssets++;
}
```

**Solution:** Now correctly identifies "tagged assets" using the explicit flag that Tandem uses for billing and capacity tracking.

## Files Modified

1. **`tandem/constants.js`**
   - Added `IsAsset: 'ia'` to `ColumnNames`
   - Added `IsAsset: 'n:ia'` to `QC` (Qualified Columns)

2. **`js/api.js`**
   - Updated `getTaggedAssetsDetails()` to:
     - Request both Standard and DtProperties families in scan
     - Filter for `element[QC.IsAsset] === true`
     - Only count elements that pass the IsAsset check

## Why This Matters

1. **Accuracy**: Aligns with how Tandem actually identifies "tagged assets"
2. **Billing**: Matches the elements that count toward capacity limits
3. **Consistency**: Uses the same logic as `tutorial-rest` examples
4. **Future-proof**: As Tandem evolves, the IsAsset flag is the authoritative source

## Backward Compatibility

This change should be **transparent to users** because:
- Elements that were previously counted (had z: properties) should also have the IsAsset flag
- The UI remains unchanged
- The only difference is more accurate counting

## Testing

To verify the update:
1. Reload the application
2. Check the Tagged Assets card count
3. The count might be slightly different if there were elements with z: properties but without the IsAsset flag
4. Click "Details" to see the list of tagged assets - these should all be legitimately flagged assets

## Reference

See `tutorial-rest/samples/get-tagged-assets.js` for the reference implementation that uses `item[QC.IsAsset] === true`.
