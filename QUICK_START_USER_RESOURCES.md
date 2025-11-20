# Quick Start: User Resources Feature

## What's New?

A new **"View All Resources"** button has been added to the Facility Information card that shows all your facilities and groups across all regions.

## How to Use

### Step 1: Sign In and Select a Facility

```
┌─────────────────────────────────────────────────┐
│  Tandem Stats                    [Sign In]      │
└─────────────────────────────────────────────────┘
```

↓ After signing in and selecting a facility ↓

```
┌─────────────────────────────────────────────────┐
│  Facility Information    [🌐 View All Resources]│ ← NEW BUTTON!
├─────────────────────────────────────────────────┤
│  Building Name: My Building                     │
│  Location: San Francisco, CA                    │
│  Owner: John Doe                                │
│  Schema Version: 2                              │
│  Primary Storage Region: US                     │
│  Facility URN: urn:adsk.dtt:...                 │
└─────────────────────────────────────────────────┘
```

### Step 2: Click "View All Resources"

A new tab opens showing:

```
┌─────────────────────────────────────────────────────────┐
│  User Resources                                         │
│  All facilities and groups across all regions           │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │      25      │  │      3       │  │      2       │ │
│  │  Facilities  │  │    Groups    │  │   Regions    │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
│                                                         │
│  Facilities by Region                                   │
│                                                         │
│  ┌─ [US] United States ──────── 15 facilities ───────┐ │
│  │                                                     │ │
│  │  Facility URN          Access Level  Group         │ │
│  │  ─────────────────────────────────────────────     │ │
│  │  urn:adsk.dtt:abc...   Read ●       My Team       │ │
│  │  urn:adsk.dtt:def...   Manage ●     Direct        │ │
│  │  urn:adsk.dtt:ghi...   Owner ●      Engineering   │ │
│  │  ...                                                │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                         │
│  ┌─ [EMEA] Europe, Middle East... ─ 10 facilities ───┐ │
│  │                                                     │ │
│  │  Facility URN          Access Level  Group         │ │
│  │  ─────────────────────────────────────────────     │ │
│  │  urn:adsk.dtt:jkl...   Read ●       London Team   │ │
│  │  urn:adsk.dtt:mno...   Owner ●      Direct        │ │
│  │  ...                                                │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                         │
│  Groups                                                 │
│  ┌─────────────────────────────────────────────────────┐ │
│  │  Group Name          Group URN                      │ │
│  │  ──────────────────────────────────────────────     │ │
│  │  My Team             urn:adsk.dt:...                │ │
│  │  Engineering         urn:adsk.dt:...                │ │
│  │  London Team         urn:adsk.dt:...                │ │
│  └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

## Color Guide

### Access Levels:
- 🔵 **Read** (Blue) - Can view facility data
- 🟢 **Manage** (Green) - Can edit and manage facility
- 🟡 **Owner** (Yellow) - Full control over facility
- ⚫ **None** (Gray) - No access

### Regions:
- 🔵 **US** (Blue badge) - United States
- 🟢 **EMEA** (Green badge) - Europe, Middle East & Africa
- 🟠 **AUS** (Orange badge) - Australia
- 🟣 **EU** (Purple badge) - Europe (legacy)

## What You'll See

### For Each Facility:
1. **URN** - Unique identifier (monospace font for easy copying)
2. **Access Level** - Your permission level (color-coded)
3. **Granted Via Group** - Which team gave you access, or "Direct access" if shared directly

### For Each Group:
1. **Group Name** - Team/account name
2. **Group URN** - Unique identifier

## Tips

### 💡 Pro Tips:
- **Facility URNs**: Click and drag to select, easy to copy
- **Access Levels**: Quickly identify your permission level by color
- **Direct Access**: Facilities showing "Direct access" were shared with you specifically
- **Group Access**: Facilities showing a group name were shared via team membership

### 🔍 Use Cases:
- **Audit**: See all facilities you have access to across all regions
- **Permissions**: Check your access level for each facility
- **Organization**: See which facilities belong to which teams
- **Discovery**: Find facilities you might have forgotten about

### ⚠️ Troubleshooting:
- **Pop-up blocked?** Allow pop-ups for localhost:8000 in browser settings
- **Button not appearing?** Make sure you've selected a facility first
- **No facilities shown?** This means you don't have access to any facilities yet

## Technical Details

### API Endpoint Used:
```
GET /users/@me/resources
```

### Data Returned:
- All facilities (twins) across all regions
- All groups you're a member of
- Access level for each facility
- Which group granted each facility access

### Performance:
- Single API call - fast loading
- No pagination needed
- Data sorted by region automatically

## Need Help?

See `FEATURE_USER_RESOURCES.md` for detailed technical documentation.

---

**Enjoy exploring your Tandem resources! 🚀**

