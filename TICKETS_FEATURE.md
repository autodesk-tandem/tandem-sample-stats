# Tickets Feature - Implementation Summary

## Overview
Added a new Tickets card to the dashboard that displays all tickets in a facility with status breakdown, priority levels, and asset associations.

## What Was Added

### 1. New API Method (`js/api.js`)
Added `getTickets(facilityURN, region)` - Fetches all tickets from the default model

**How it works:**
- Calls `POST /modeldata/{modelID}/scan` with Standard, Refs, and Xrefs families
- Filters results by `ElementFlags.Ticket` (0x01000007)
- Returns array of ticket objects

### 2. Constants (`tandem/constants.js`)
Added ticket date fields to QC object:
- `QC.OpenDate` - When ticket was opened
- `QC.CloseDate` - When ticket was closed (null if still open)

### 3. Tickets Feature (`js/features/tickets.js`)
New feature module that displays tickets with:

**Summary View (Collapsed):**
- Total ticket count
- Open vs Closed count badges
- Priority breakdown (Critical, High, Medium, Low, Trivial)

**Detailed View (Expanded):**
- Individual ticket cards showing:
  - Ticket name
  - Priority badge (color-coded)
  - Status badge (Open/Closed)
  - Associated asset name and type
  - Ticket key
  - Open date and close date
  - Days open/duration

**Priority Color Coding:**
- 🔴 Critical (red)
- 🟠 High (orange)
- 🟡 Medium (yellow)
- 🔵 Low (blue)
- ⚪ Trivial (gray)

### 4. UI Integration

**HTML (`index.html`):**
Added Tickets card section between Streams and Search:
```html
<div class="bg-dark-card rounded border border-dark-border p-4 mb-4">
    <h2 class="text-sm font-semibold text-dark-text mb-3">Tickets</h2>
    <div id="ticketsList">...</div>
</div>
```

**App Logic (`js/app.js`):**
- Imported `getTickets` and `displayTickets`
- Added `ticketsList` DOM element reference
- Fetches and displays tickets after streams

## Visual Structure

### Collapsed View:
```
┌─────────────────────────────────────────────────┐
│ Tickets                                         │
├─────────────────────────────────────────────────┤
│ [5] Tickets      [3 Open] [2 Closed]           │
│                          [Details] [▼]          │
│                                                 │
│ 🔴 Critical: 1  🟠 High: 2  🟡 Medium: 2      │
└─────────────────────────────────────────────────┘
```

### Expanded View:
```
┌─────────────────────────────────────────────────┐
│ HVAC System Issue  🟠 High  ● Open             │
│ Asset: Air Handler Unit 01 (Asset)             │
│ Key: WaTJG-E1RCW403tbL68LJwAAAAA               │
│ Opened: Feb 1, 2026  ⏱ 11 days open           │
└─────────────────────────────────────────────────┘
```

## Ticket Status Logic

**Open Ticket:**
- `CloseDate` is not set or null
- Shows green "Open" badge
- Displays "X days open" in amber
- Includes timer icon (⏱)

**Closed Ticket:**
- `CloseDate` is set
- Shows gray "Closed" badge
- Displays "X days duration" in gray
- No timer icon

## Data Flow

```
User selects facility
       ↓
loadStats() in app.js
       ↓
getTickets(facilityURN, region)
       ↓
POST /modeldata/{defaultModelURN}/scan
       ↓
Filter by ElementFlags.Ticket
       ↓
displayTickets(container, tickets, ...)
       ↓
Decode parent asset xrefs
       ↓
Fetch parent asset info
       ↓
Render ticket cards
```

## Key Features

1. **Asset Association** - Shows which asset each ticket is linked to
2. **Status Tracking** - Visual indicators for open/closed status
3. **Priority Management** - Color-coded priority levels
4. **Time Tracking** - Shows how long tickets have been open
5. **Details Integration** - "Details" button shows all ticket properties

## Files Created/Modified

**New Files:**
- ✅ `js/features/tickets.js` - Tickets card implementation (~265 lines)
- ✅ `TICKETS_FEATURE.md` - This documentation

**Modified Files:**
- ✅ `js/api.js` - Added `getTickets()` function
- ✅ `js/app.js` - Added tickets display to loadStats()
- ✅ `index.html` - Added Tickets card section
- ✅ `tandem/constants.js` - Added QC.OpenDate and QC.CloseDate

## Ticket Properties Available

From the API response, each ticket includes:

| Property | QC Key | Description |
|----------|--------|-------------|
| Name | `n:n` or `n:!n` | Ticket title |
| Priority | `n:pr` | Critical, High, Medium, Low, Trivial |
| OpenDate | `n:od` | Date opened (YYYY-MM-DD) |
| CloseDate | `n:cd` | Date closed (YYYY-MM-DD) or null |
| Parent | `x:p` | Xref to parent asset |
| Level | `l:l` | Level reference |
| Rooms | `x:r` | Room xrefs |
| Key | `k` | Ticket element key |
| ElementFlags | `n:a` | Type identifier (0x01000007) |

## Testing

**What to check:**
1. ✅ Tickets card appears between Streams and Search
2. ✅ Count shows total tickets
3. ✅ Open/Closed badges show correct counts
4. ✅ Priority breakdown shows all priority levels
5. ✅ Expanding shows individual ticket cards
6. ✅ Each ticket shows name, priority, status
7. ✅ Parent asset information resolves correctly
8. ✅ Dates format properly
9. ✅ "Days open" calculation is correct
10. ✅ Details button opens asset details modal

**Edge cases:**
- Facility with no tickets → Shows "No tickets found"
- Tickets without parent assets → Asset field omitted
- Tickets without dates → Shows "N/A"
- Missing priority → Shows "Unknown"

## Comparison with Tandem UI

Your Tickets card shows similar information to Tandem's ticket management:
- Priority levels (matches 5-level system)
- Open/Closed status
- Dates
- Asset associations

Additional features you could add later:
- Filter by status (Open/Closed/All)
- Sort by date, priority, or asset
- Search/filter tickets
- Edit ticket properties inline
- Create new tickets from UI

## API Limitations

Unlike stream-configs which has dedicated endpoints, tickets use the generic model data API:
- No dedicated `/tickets` endpoint
- Must filter by ElementFlags on client side
- Same permissions as model data (data:read, data:write)

This is consistent with how Tandem treats tickets as logical elements rather than a separate resource type.
