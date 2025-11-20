# User Resources Feature

## Overview

This feature adds a "View All Resources" button to the Facility Information card that displays all facilities and groups across all regions that the current user has access to.

## Implementation Details

### New API Endpoint

The feature uses the new Tandem API endpoint:

```
GET /users/@me/resources
```

**Response Format:**
```json
{
  "twins": [
    {
      "urn": "urn:adsk.dtt:...",
      "accessLevel": 1,
      "region": "US",
      "grantedViaGroup": "urn:adsk.dt:..."
    }
  ],
  "groups": [
    {
      "name": "Group Name",
      "urn": "urn:adsk.dt:..."
    }
  ]
}
```

**Access Levels:**
- `0` - None
- `1` - Read
- `2` - Manage
- `3` - Owner

**Regions:**
- `US` - United States
- `EMEA` - Europe, Middle East & Africa
- `AUS` - Australia
- `EU` - Europe (legacy)

### Files Modified

1. **`js/api.js`**
   - Added `getUserResources(userId)` function to fetch resources

2. **`js/features/userResources.js`** (NEW)
   - New feature module for displaying user resources
   - Opens in a new tab/window
   - Groups facilities by region
   - Shows access levels and group associations

3. **`js/app.js`**
   - Imported `viewUserResources` function
   - Added event listener for the "View All Resources" button
   - Shows/hides button based on facility load state

4. **`index.html`**
   - Added "View All Resources" button to Facility Information card header
   - Button is hidden by default and shown when a facility is loaded

### User Interface

**Button Location:** Facility Information card header (top-right)

**Button Appearance:**
- Icon: Globe icon
- Text: "View All Resources"
- Style: Outlined button with Tandem blue color
- Hover: Filled background

**Resource View (New Window):**
- Summary statistics (total facilities, groups, regions)
- Facilities grouped by region with color-coded badges
- Table showing:
  - Facility URN
  - Access Level (color-coded)
  - Granted Via Group (or "Direct access")
- Groups section showing group names and URNs

### Features

1. **Region Filtering**
   - Filter buttons for US, EMEA, and AUS regions at the top
   - Active region highlighted with color-coded badge
   - Green indicator dot shows regions with available facilities
   - Gray indicator dot shows regions with no facilities
   - Displays helpful message when no facilities exist in selected region

2. **Sortable Columns**
   - Click column headers to sort data
   - Sort by: Facility Name/URN, Access Level, or Group
   - Default sort: By group name (ascending)
   - Toggle between ascending/descending order
   - Visual indicators show active sort column and direction

3. **Facility Names**
   - Displays friendly facility names (e.g., "Main Building")
   - Shows URN below name in smaller monospace font
   - Falls back to URN only if name not available

4. **Group Names**
   - Displays group names (e.g., "Engineering Team")
   - Shows group URN below name in smaller monospace font
   - Shows "Direct access" for facilities shared directly

5. **Access Level Display**
   - Read: Blue
   - Manage: Green
   - Owner: Yellow
   - None: Gray

6. **Responsive Design**
   - Adapts to different screen sizes
   - Scrollable tables for large datasets
   - Dark theme consistent with main application

## Usage

1. Sign in to the application
2. Select an account and facility
3. Once facility information loads, the "View All Resources" button appears
4. Click the button to open a new tab showing all your resources
5. The view displays:
   - Summary statistics (total facilities, groups, regions)
   - Region filter buttons (US, EMEA, AUS)
   - Facilities in the selected region with sortable columns
   - Facility names and URNs
   - Access levels for each facility (color-coded)
   - Group names that granted access (or "Direct access")
   - All groups you are a member of

### Interacting with the View

**Region Filtering:**
- Click US, EMEA, or AUS buttons to filter facilities by region
- Active region is highlighted with colored background
- Green dot = region has facilities, Gray dot = no facilities
- If a region has no facilities, a message is displayed

**Sorting:**
- Click any column header to sort by that column
- Click again to reverse sort direction
- Arrow indicators show active sort column and direction (▲ ascending, ▼ descending)
- Default sort is by "Granted Via Group" (ascending)

**Information Display:**
- Facility names appear in bold with URNs below in monospace font
- Group names appear in normal text with URNs below in monospace font
- "Direct access" shown in italics for facilities shared directly
- Access levels color-coded for quick identification

## Technical Notes

### Error Handling

- If the API call fails, an error message is displayed in the new window
- The button is automatically hidden if facility loading fails
- Pop-up blockers may prevent the window from opening (user will see alert)

### Performance

- The endpoint returns all resources in a single API call
- No additional API calls are made for groups or facility details
- Data is processed client-side for grouping and sorting

### Security

- Uses the same OAuth token as other API calls
- Only returns resources the authenticated user has access to
- No sensitive data is cached

## Future Enhancements

Potential improvements for this feature:

1. **Filtering and Search**
   - Filter by region
   - Filter by access level
   - Search facilities by URN or name

2. **Export**
   - Add Excel export button
   - Export to CSV

3. **Sorting**
   - Sort by access level
   - Sort by region
   - Sort by URN

4. **Facility Details**
   - Click facility URN to view more details
   - Show facility names (requires additional API calls)

5. **Visual Enhancements**
   - Add charts/graphs showing distribution by region
   - Show facility thumbnails
   - Add map view showing facility locations

## Testing

To test this feature:

1. Start the application locally:
   ```bash
   cd tandem-sample-stats
   python3 -m http.server 8000
   ```

2. Open `http://localhost:8000` in your browser

3. Sign in with your Autodesk account

4. Select an account and facility

5. Click the "View All Resources" button in the Facility Information card

6. Verify:
   - New window/tab opens
   - Resources are displayed correctly
   - Facilities are grouped by region
   - Access levels are shown with correct colors
   - Groups are listed at the bottom

## Troubleshooting

### Button doesn't appear
- Ensure a facility is selected and loaded successfully
- Check browser console for errors

### New window is blocked
- Allow pop-ups for localhost:8000 in your browser settings

### "Failed to fetch user resources" error
- Verify your authentication token is valid
- Check browser console for detailed error messages
- Ensure the Tandem API endpoint is accessible

### No facilities shown
- This is expected if you don't have access to any facilities
- The view will show "No facilities found" message

## API Documentation

For more information about the Tandem API endpoint, see:
- Backend implementation: `dt-server/src/autodesk.com/double-trouble/model-server/handle-twin.go`
- Function: `handleGetUserResources`
- Route: `GET /users/:userID/resources`

