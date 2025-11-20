# History Features Documentation

## Overview

Added support for viewing ACL (Access Control List) history for both facilities and groups. These features provide audit trails showing who was granted/revoked access and when.

## New Features

### 1. Facility Access History

**Location**: Facility Information card → "Access History" button

**What it shows**:
- All permission changes for the current facility
- Who granted/revoked access
- When changes occurred
- What access level was assigned (Owner, Manage, Read, None)

**Use Cases**:
- Security audit - see who has had access over time
- Compliance - track permission changes
- Troubleshooting - identify when access was removed
- Historical review - understand facility access patterns

### 2. Group Access History

**Location**: User Resources view → Groups section → "History" button (per group)

**What it shows**:
- All permission changes for a specific group/account
- Members added/removed over time
- Role changes (Owner → Read, etc.)
- Who made the changes and when

**Use Cases**:
- Team management - track membership changes
- Audit trail - see group permission history
- Compliance - document access control changes
- Investigation - identify unauthorized changes

## API Endpoints Used

### POST /twins/{twinID}/history
- **Purpose**: Fetch facility ACL history
- **Response**: Array of history records with timestamps, users, operations, and details

### POST /groups/{groupID}/history  
- **Purpose**: Fetch group ACL history
- **Response**: Array of history records showing membership/permission changes

## Implementation Details

### Files Created

1. **`js/features/facilityHistory.js`**
   - Main module for viewing facility access history
   - Opens history in new window
   - Displays chronological list of access changes

2. **Group History (in `js/features/userResources.js`)**
   - Embedded in User Resources module
   - Displays group access history in a new window
   - Shows membership and permission changes

### Files Modified

1. **`js/api.js`**
   - Added `getTwinHistory(facilityURN, options)`
   - Added `getGroupHistory(groupURN, options)`

2. **`js/app.js`**
   - Imported `viewFacilityHistory`
   - Added "Access History" button to Facility Info card
   - Wired up button click handler

3. **`js/features/userResources.js`**
   - Added "History" buttons to each group in Groups table
   - Implemented inline group history viewer
   - Added helper functions for formatting history data

4. **`index.html`**
   - Added "Access History" button to Facility Information card header
   - Positioned next to "All Resources" button

5. **`tandem/constants.js`**
   - Already had `HC` (History Constants) for property names

## History Record Format

```javascript
{
  c: "client_id",           // HC.ClientID - Application/service that made change
  i: "correlation_id",      // HC.CorrelationID - Request correlation ID
  d: "description",         // HC.Description - Human-readable description
  k: "keys",               // HC.Keys - Affected element keys
  o: "operation",          // HC.Operation - Type of operation
  t: 1234567890,          // HC.Timestamp - When change occurred (ms)
  n: "username",          // HC.Username - Who made the change
  details: "{json}"       // Additional details (JSON string)
}
```

## Operation Types

### Facility Operations
- `acl_update_twin` - Access level updated
- `acl_delete_twin` - Access removed
- `acl_create_twin` - Access granted
- `create_twin` - Facility created
- `delete_twin` - Facility deleted
- `update_twin` - Facility updated

### Group Operations
- `acl_update_group` - Member access updated
- `acl_delete_group` - Member removed
- `acl_create_group` - Member added
- `create_group` - Group created
- `delete_group` - Group deleted
- `update_group` - Group updated

## Access Levels

- **Owner** (3) - Full control, can manage members
- **Manage** (2) - Can edit data and settings
- **Read** (1) - View-only access
- **None** (0) - No access (used when removing access)

## UI Features

### Facility History View
- **Summary Cards**: Total changes, operation types, unique users
- **Chronological Table**: Shows all changes with timestamps
- **Color-Coded Operations**:
  - 🟢 Green: Create/Grant operations
  - 🔴 Red: Delete/Remove operations
  - 🔵 Blue: Update operations
- **Detailed Information**: User, timestamp, operation, access level

### Group History View
- **Event Count**: Shows total number of access changes
- **Sortable by Time**: Newest changes first
- **User Details**: Shows who was affected and what level
- **Operation Context**: Explains what happened in plain language

## Query Options

Both history endpoints support the same query options:

```javascript
{
  min: 1234567890,          // Optional: Start timestamp (ms)
  max: 1234567890,          // Optional: End timestamp (ms)
  includeChanges: true,     // Include detailed change info
  timestamps: [123, 456],   // Optional: Specific timestamps
  limit: 100                // Optional: Limit number of results
}
```

**Default Behavior**: Fetches all history from January 1, 2020 to present

## Usage Examples

### Viewing Facility History

1. Sign in and select a facility
2. Look for "Access History" button in Facility Information card (top-right)
3. Click to open history in new tab
4. Review chronological list of all access changes

### Viewing Group History

1. Sign in and select a facility
2. Click "All Resources" button in Facility Information card
3. Scroll to "Groups" section at bottom
4. Click "History" button next to any group
5. Review group membership and permission changes

## Performance Notes

- History is fetched on-demand (not preloaded)
- Loading indicator shows while fetching data
- History window opens immediately, data streams in
- No pagination currently - fetches all history at once
- For groups with many changes, may take a few seconds to load

## Future Enhancements

Potential improvements:

1. **Filtering**
   - Filter by date range
   - Filter by user
   - Filter by operation type

2. **Export**
   - Export to Excel
   - Export to CSV
   - Generate PDF reports

3. **Search**
   - Search by username
   - Search by details
   - Full-text search across history

4. **Visualization**
   - Timeline view
   - Activity heatmap
   - User activity graphs

5. **Pagination**
   - Load history in chunks
   - Infinite scroll
   - Date-based pagination

6. **Notifications**
   - Alert on suspicious changes
   - Email reports of access changes
   - Scheduled audit reports

## Testing

To test these features:

1. **Start the application**:
   ```bash
   cd /Users/jamesawe/dev/tandem/tandem-sample-stats
   python3 -m http.server 8000
   ```

2. **Open** `http://localhost:8000`

3. **Test Facility History**:
   - Sign in
   - Select an account and facility
   - Click "Access History" button
   - Verify history loads and displays correctly

4. **Test Group History**:
   - Click "All Resources" button
   - Scroll to Groups section
   - Click "History" on any group
   - Verify group history loads in new window

## Troubleshooting

### No History Shown
- This is normal for new facilities/groups
- History only exists if access changes have been made
- Try a facility/group that's been around longer

### Pop-up Blocked
- Allow pop-ups for localhost:8000 in browser settings
- Look for pop-up blocker icon in address bar

### API Errors
- Check browser console for detailed error messages
- Verify you have permissions to view the facility/group
- Ensure network connectivity

## Security & Privacy

- Only shows history you have permission to view
- Requires Read access or higher to view history
- No PII is displayed beyond usernames
- History cannot be deleted or modified via UI

## Compliance Benefits

These features help with:

- **SOC 2** - Access control audit trails
- **ISO 27001** - Information security management
- **GDPR** - Data access logging
- **HIPAA** - Healthcare data access audit (if applicable)
- **Internal Audits** - Reviewing access patterns

---

**Added**: November 19, 2025  
**Release**: Corresponds to dt-server history endpoints release

