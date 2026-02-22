# Stream Configuration Feature - Testing Guide

## Quick Start

1. **Start the dev server:**
   ```bash
   cd /Users/awej/dev/tandem/tandem-sample-stats
   # If using Python:
   python -m http.server 8000
   # Or if using Node:
   npx serve
   ```

2. **Open in browser:**
   ```
   http://localhost:8000
   ```

3. **Login and select a facility** that has streams with configurations

## What to Look For

### 1. Streams Card - Visual Inspection

**Before scrolling (collapsed view):**
- Header shows stream count
- "Details" and toggle buttons present

**After expanding (detailed view):**
- Each stream card displays:
  - ✅ Stream name
  - ✅ Classification badge (if present)
  - ✅ **NEW: Configuration badges** (frequency, thresholds, calculated)
  - ✅ Host information (room/space)
  - ✅ Stream key
  - ✅ **NEW: "Config" button** (only if configuration exists)
  - ✅ "View Chart" button
  - ✅ Last seen values section

### 2. Configuration Badges

Look for these colored badges next to stream names:

**Frequency Badge (Blue):**
- Format: `1m`, `5m`, `15m`, `1h`, etc.
- Hover to see full description
- Should appear on streams with explicit frequency settings

**Threshold Badge (Amber):**
- Format: Warning icon + number (⚠ 2)
- Number indicates count of configured thresholds
- Should appear on streams with threshold monitoring

**Calculated Badge (Purple):**
- Format: `ƒ` symbol
- Should appear on streams with CEL calculation expressions

### 3. Config Button Functionality

**Test the Config button:**

1. Click "Config" button on a stream with configuration
2. Modal should appear with:
   - Stream name in header
   - Close button (X) in top-right
   - Four sections:
     - 🕐 Collection Settings
     - </> Source Mapping
     - ⚠ Thresholds & Alerts
     - ƒ Calculated Streams

**Modal Content Verification:**

**Collection Settings:**
- [ ] Sampling Frequency displays in readable format (e.g., "1 minute")
- [ ] Data Retention shows days/months/years
- [ ] Offline Timeout shows minutes
- [ ] Storage Capacity shows approximate data point count

**Source Mapping:**
- [ ] Table shows property names (e.g., "Sensors.Value 1")
- [ ] JSON paths are displayed in quotes (e.g., `"z:hw"`)
- [ ] Source column shows "Template" or "Override" badge
- [ ] Property IDs shown below display names

**Thresholds:**
- [ ] Each threshold shows property name
- [ ] Upper/Lower bounds displayed with values
- [ ] Alert evaluation period shown (if configured)
- [ ] Visual styling (amber for upper, blue for lower)

**Calculated Streams:**
- [ ] Shows "None configured" if no calculations
- [ ] If present, shows CEL expression in code block
- [ ] Shows enabled/disabled status
- [ ] Shows variable count and frequency

### 4. Modal Interactions

**Test all close methods:**
- [ ] Click X button in top-right → Modal closes
- [ ] Click "Close" button in footer → Modal closes
- [ ] Click outside modal (on backdrop) → Modal closes
- [ ] Press Escape key → Modal closes

**Other interactions:**
- [ ] Modal is scrollable if content is long
- [ ] Text is readable on dark background
- [ ] Tables display correctly on different screen sizes

### 5. Error Handling

**Test with edge cases:**

**Streams without configuration:**
- [ ] No badges appear
- [ ] No "Config" button appears
- [ ] "View Chart" button still works

**Streams with partial configuration:**
- [ ] Only relevant badges appear
- [ ] Modal shows "None configured" for empty sections

**Network issues:**
- [ ] If config API fails, streams still display
- [ ] No JavaScript errors in console

## Browser Console Checks

Open DevTools (F12) and check:

**Console tab:**
- [ ] No red errors during page load
- [ ] No errors when opening modal
- [ ] Successful API responses for `/stream-configs`

**Network tab:**
- [ ] Filter by "stream-configs"
- [ ] Should see GET request to `/models/{modelURN}/stream-configs`
- [ ] Response should be 200 OK with JSON array
- [ ] Each config object has `elementId` and `streamSettings`

**Example successful response:**
```json
[
  {
    "elementId": "WaTJG-E1RCW403tbL68LJwAAAAA",
    "streamSettings": {
      "sourceMapping": {
        "z:hw": { "path": "temp", "isShared": true }
      },
      "frequency": 60000,
      "retentionPeriod": 90,
      "thresholds": {
        "z:hw": {
          "upper": { "value": 70 },
          "lower": { "value": 20 },
          "alertDefinition": { "evaluationPeriodSec": 300 }
        }
      }
    }
  }
]
```

## Test Scenarios

### Scenario 1: Basic Stream with Config
**Expected:**
- Stream displays with frequency badge
- Config button present
- Modal opens with collection settings populated

### Scenario 2: Stream with Thresholds
**Expected:**
- Amber threshold badge shows count
- Modal shows threshold section with bounds
- Alert interval displayed

### Scenario 3: Calculated Stream
**Expected:**
- Purple ƒ badge appears
- Modal shows CEL expression
- Variables and frequency listed

### Scenario 4: Stream Without Config
**Expected:**
- No badges (except classification)
- No Config button
- View Chart still works

### Scenario 5: Multiple Streams
**Expected:**
- Each stream has independent badges
- Config button opens correct modal for each
- No cross-stream data mixing

## Performance Checks

- [ ] Page loads in reasonable time (< 3 seconds)
- [ ] Config API request completes quickly (< 1 second)
- [ ] Modal opens instantly (no lag)
- [ ] Badges render without flash/flicker
- [ ] No memory leaks (close/reopen modal multiple times)

## Visual Regression Checks

Compare with your screenshot:

**Header section:**
- [ ] Count, Details button, toggle button all present
- [ ] Styling matches existing design

**Stream cards:**
- [ ] Borders and hover effects work
- [ ] Spacing is consistent
- [ ] Badges don't break layout
- [ ] New Config button aligns with View Chart button

**Modal:**
- [ ] Dark theme matches app (dark-card, dark-bg, dark-border)
- [ ] Tandem blue (#0696D7) used for accents
- [ ] Text contrast is readable
- [ ] Sections are visually separated

## Rollback Plan

If something doesn't work:

```bash
# See what changed
git status

# View the changes
git diff

# Revert all changes
git checkout -- js/api.js js/features/streams.js
git clean -f js/components/streamConfigModal.js
git checkout -- *.md
```

## Reporting Issues

If you find issues, note:
1. Which section/feature isn't working
2. Browser console errors (if any)
3. Network tab showing API responses
4. Screenshot of unexpected behavior

## Success Criteria

The feature is working correctly if:
- ✅ Badges display correctly based on configuration
- ✅ Config button appears only for configured streams
- ✅ Modal opens and displays all sections
- ✅ All data is properly formatted and readable
- ✅ Modal closes via all methods
- ✅ No errors in console
- ✅ Performance is acceptable
- ✅ Existing functionality (View Chart) still works

## Next Steps After Testing

If everything looks good:
1. Commit the changes to your branch
2. Test with multiple facilities
3. Consider any UI refinements
4. Merge to main when ready

If changes are needed:
1. Note the issues
2. We can make adjustments
3. Retest

The code is modular, so changes are easy to make!
