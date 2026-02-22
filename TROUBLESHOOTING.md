# Troubleshooting: Stream Config Feature Not Showing

## Quick Diagnostic Checklist

### 1. Hard Refresh Browser
- **Chrome/Edge**: `Cmd + Shift + R`
- **Safari**: `Cmd + Option + E`, then `Cmd + R`
- **Firefox**: `Cmd + Shift + R`

### 2. Open Browser Console (F12)

Look for errors. Common issues:

**✅ What you SHOULD see:**
```
(no errors related to streams, api, or modal)
```

**❌ What indicates a problem:**
```javascript
// Import error - file not found
Failed to load resource: js/components/streamConfigModal.js

// Function error - code didn't update
getStreamConfigs is not a function

// API error - endpoint might not exist
Failed to fetch stream configurations: 404
```

### 3. Run These Browser Console Commands

Open the browser console and paste these **one at a time**:

#### Test 1: Check if new functions exist
```javascript
console.log('Checking imports...');
import('../js/api.js').then(api => {
  console.log('✅ getStreamConfigs exists:', typeof api.getStreamConfigs === 'function');
  console.log('✅ getStreamConfig exists:', typeof api.getStreamConfig === 'function');
});
```

**Expected output:**
```
✅ getStreamConfigs exists: true
✅ getStreamConfig exists: true
```

#### Test 2: Check if modal component loads
```javascript
import('../js/components/streamConfigModal.js').then(modal => {
  console.log('✅ Modal component loaded:', typeof modal.showStreamConfigModal === 'function');
});
```

**Expected output:**
```
✅ Modal component loaded: true
```

#### Test 3: Check if streams module has new code
```javascript
import('../js/features/streams.js').then(module => {
  console.log('✅ Streams module loaded successfully');
  console.log('Module exports:', Object.keys(module));
});
```

### 4. Check Network Tab

1. Open DevTools → Network tab
2. Reload page
3. Filter by "JS"
4. Look for these files - all should be **200 OK**:
   - `api.js` 
   - `streams.js`
   - `streamConfigModal.js`

### 5. Test API Call Manually

In the browser console, after logging into the app:

```javascript
// Get facility URN from the page
const facilityURN = /* paste your facility URN */;

// Test the API call
const defaultModelURN = facilityURN.replace('urn:adsk.dtt:', 'urn:adsk.dtm:');
const url = `https://developer.api.autodesk.com/tandem/v1/models/${defaultModelURN}/stream-configs`;

fetch(url, {
  headers: {
    'Authorization': 'Bearer ' + window.sessionStorage.token
  }
})
.then(r => r.json())
.then(data => {
  console.log('✅ Stream configs:', data);
  console.log('Number of configs:', data.length);
});
```

**If successful, you should see:**
```javascript
✅ Stream configs: Array(3)
Number of configs: 3
```

**If it fails with 404:**
```
Your streams might not have configurations yet
```

### 6. Possible Issues & Solutions

#### Issue: Files are cached
**Solution:** 
- Hard refresh (Cmd+Shift+R)
- Or clear all cache (Cmd+Shift+Delete)
- Or open in Incognito mode

#### Issue: "getStreamConfigs is not a function"
**Solution:**
```bash
# Verify file was saved correctly
cd /Users/awej/dev/tandem/tandem-sample-stats
cat js/api.js | grep -A 5 "getStreamConfigs"
```

#### Issue: Modal doesn't open
**Solution:** Check browser console for:
```
Uncaught Error: Cannot find module 'streamConfigModal'
```
This means the import path might be wrong or file wasn't saved.

#### Issue: Badges don't show
**Possible reasons:**
1. Stream configs API returns empty array (no configs set up)
2. JavaScript error preventing badge rendering
3. CSS not loading (check if other badges like classification show)

#### Issue: 404 on stream-configs endpoint
**This is actually OK!** It means:
- Your streams don't have configurations yet
- The feature will work once configs are added
- The rest of the UI should still work

### 7. Verify Your Test Facility

**Important:** Not all streams have configurations!

To test properly, you need a facility where:
- Streams exist (you can see them in the Streams Card)
- Streams have been configured with:
  - Frequency settings
  - Thresholds
  - Or source mappings

If your test facility doesn't have stream configs, the badges won't show (which is correct behavior).

### 8. Force Reload Specific Files

If hard refresh doesn't work, try:

```javascript
// In browser console
location.reload(true); // Force reload
```

Or disable cache:
1. DevTools → Network tab
2. Check "Disable cache"
3. Keep DevTools open
4. Reload

### 9. Check Git Status

Make sure all files are saved:

```bash
cd /Users/awej/dev/tandem/tandem-sample-stats
git status
git diff js/api.js
git diff js/features/streams.js
```

### 10. Nuclear Option: Clear Everything

If nothing else works:

```bash
# Close browser completely
# Clear all browser cache
# Restart browser
# Navigate back to http://localhost:8000
```

---

## What To Report

If still not working, please share:

1. **Browser console errors** (screenshot or copy/paste)
2. **Network tab** showing status of JS files
3. **Results of Test 1, 2, 3** from above
4. **Any error messages**

This will help diagnose the exact issue!
