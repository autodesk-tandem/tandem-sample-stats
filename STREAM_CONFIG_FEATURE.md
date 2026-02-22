# Stream Configuration Feature - Implementation Summary

## Overview
This feature adds stream configuration information display to the Streams Card with a two-tier approach:
1. **Lightweight badges** - Always visible indicators for frequency, thresholds, and calculated streams
2. **Detailed modal** - Comprehensive configuration view accessible via a "Config" button

## What Was Added

### 1. New API Methods (`js/api.js`)
Added two new functions to fetch stream configuration data from the Tandem API:

- `getStreamConfigs(facilityURN, region)` - Fetch all stream configurations for a facility
- `getStreamConfig(facilityURN, region, streamKey)` - Fetch a single stream configuration

Both methods use the new REST endpoints:
- `GET /models/{modelID}/stream-configs`
- `GET /models/{modelID}/stream-configs/{elementID}`

### 2. Modal Component (`js/components/streamConfigModal.js`)
New reusable modal component that displays comprehensive stream configuration details:

**Collection Settings:**
- Sampling frequency (e.g., "1 minute", "5 minutes")
- Data retention period (e.g., "90 days")
- Offline timeout
- Storage capacity calculation

**Source Mapping:**
- Table showing property names mapped to JSON paths
- Indicates if mapping is from template or override
- Example: `Sensors.Value 1` → `"z:hw"` (Template)

**Thresholds & Alerts:**
- Upper and lower bounds for each property
- Alert evaluation intervals
- Visual indicators (amber for upper, blue for lower)

**Calculated Streams:**
- CEL expressions for computed values
- Variable count and frequency
- Enabled/disabled status

### 3. Enhanced Streams Display (`js/features/streams.js`)

#### Added Badge Function
`renderConfigBadges(streamConfig)` - Creates inline badges showing:
- **Frequency badge** (blue) - Shows sampling rate (e.g., "1m", "5m", "1h")
- **Threshold badge** (amber) - Shows count of configured thresholds with warning icon
- **Calculated badge** (purple) - Shows "ƒ" symbol for calculated streams

#### Updated Display Function
Modified `displayStreams()` to:
1. Fetch stream configurations on load
2. Create a config lookup map for quick access
3. Render badges next to stream names
4. Add "Config" button next to "View Chart" button
5. Wire up click handlers for the config modal

## Visual Changes

### Before:
```
┌─────────────────────────────────────────┐
│ Test 1   Pr_80_51                      │
│ Host: West Meeting Room (Room)        │
│ Key: WaTJG-E1RCW403tbL68LJwAAAAA      │
│                       [View Chart]     │
└─────────────────────────────────────────┘
```

### After:
```
┌─────────────────────────────────────────┐
│ Test 1   Pr_80_51   [1m] [⚠2]         │ ← Badges
│ Host: West Meeting Room (Room)        │
│ Key: WaTJG-E1RCW403tbL68LJwAAAAA      │
│              [⚙ Config] [View Chart]   │ ← New button
└─────────────────────────────────────────┘
```

## Configuration Modal Structure

When clicking "Config" button, a modal appears with:

```
┌──────── Stream Configuration ────────┐
│ Test 1 (Pr_80_51)           [Close] │
├──────────────────────────────────────┤
│ 🕐 Collection Settings               │
│   Sampling Frequency: 1 minute       │
│   Data Retention: 90 days            │
│   Offline Timeout: 5 minutes         │
│   Storage Capacity: ~130K data points│
│                                       │
│ </> Source Mapping                   │
│   Property          JSON Path Source │
│   Sensors.Value 1   "z:hw"   Template│
│   Sensors.Value 2   "z:Hg"   Override│
│                                       │
│ ⚠ Thresholds & Alerts                │
│   Sensors.Value 1                    │
│     Upper: 70   Lower: 20            │
│     Alert Evaluation: 300 seconds    │
│                                       │
│ ƒ Calculated Streams                 │
│   None configured                    │
└──────────────────────────────────────┘
```

## Files Modified

1. **`js/api.js`** - Added 2 new API functions (~40 lines)
2. **`js/features/streams.js`** - Added badge rendering and config integration (~80 lines)
3. **`js/components/streamConfigModal.js`** - New file (~450 lines)

## Badge Color Scheme

- **Blue** (`bg-blue-500/20 text-blue-300`) - Frequency
- **Amber** (`bg-amber-500/20 text-amber-300`) - Thresholds
- **Purple** (`bg-purple-500/20 text-purple-300`) - Calculated
- **Green** (`bg-green-500/20 text-green-300`) - Classification

## Data Sources

All configuration data comes from the Tandem REST API:
- Endpoint: `https://developer.api.autodesk.com/tandem/v1/models/{modelURN}/stream-configs`
- Authentication: Bearer token (same as other API calls)
- Region header: Passed through for multi-region support

## Testing Checklist

- [ ] Load a facility with streams
- [ ] Verify badges appear on streams with configurations
- [ ] Click "Config" button opens modal
- [ ] Modal displays all configuration sections correctly
- [ ] Property display names are resolved from schema
- [ ] Source mapping shows correct JSON paths
- [ ] Thresholds display upper/lower bounds
- [ ] Calculated streams show expressions (if any)
- [ ] Modal closes via X button, footer button, backdrop click, or Escape key
- [ ] Streams without configurations don't show Config button

## Edge Cases Handled

1. **No configuration** - Config button only appears if configuration exists
2. **Missing schema** - Falls back to property ID if display name not found
3. **Empty sections** - Shows "None configured" message
4. **API errors** - Returns empty array, no crash
5. **Modal interactions** - Multiple close methods, keyboard support

## Future Enhancements

Potential additions if needed:
- Edit configuration inline
- Configuration history/diff viewer
- Bulk configuration operations
- Export configuration as JSON
- Configuration templates

## Related Documentation

See initial research document for stream configuration API details and examples from:
- `dt-server/src/autodesk.com/double-trouble/btstore/op-stream-config.go`
- `dt-server/src/autodesk.com/double-trouble/model-server/handle-stream-configs.go`
- `tutorial-rest/streams/*.js` (sample implementations)

## Questions or Issues?

Since you're on a git branch, you can easily:
- Test the changes
- Make adjustments
- Roll back if needed

The implementation follows the existing patterns in the codebase:
- Same authentication flow
- Same API request structure
- Same UI component patterns (modal similar to elementListModal)
- Same styling (Tailwind classes matching the theme)
