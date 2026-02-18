# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added
- **Schema card – Property search**: Find properties by ID or name across all models
  - "Find property" input and Find button in Schema card header (Enter or click)
  - Results open in a new tab with all matches grouped by model
  - Each model section shows ID, Category, Name, Data Type with fixed column alignment
  - Sortable columns in the search results tab (ID sorts by family then property)
  - No-match message when nothing matches

- **Schema card – Expand/collapse**: Easier navigation when viewing many attributes
  - Per-model expand state: "Show all" and "Show first 20 only" per table
  - Double-click anywhere in an expanded table to collapse back to first 20
  - State preserved when sorting; reset when switching facility or reloading the card

- **Consistent ID column sorting**: Qualified column IDs (e.g. `n:n`, `z:LQ`) now sort by column family then property name everywhere
  - Schema card table, Tagged Assets table, and Asset Details properties table use shared `compareQualifiedColumnIds` from `utils.js`
  - Schema search results tab and Asset Details drill-down page include the same logic for sortable ID columns

- **Facility Access History**: View audit trail of permission changes for facilities
  - "Access History" button in Facility Information card
  - Shows who was granted/revoked access and when
  - Displays operation types and access levels
  - Opens in new tab with chronological event list
  
- **Group Access History**: View audit trail of permission changes for groups
  - "History" button for each group in User Resources view
  - Shows membership changes over time
  - Tracks role changes (Owner, Manage, Read, None)
  - Helps with security audits and compliance

- **Global Resources View**: New feature to view all facilities and groups across all regions
  - Added "View All Resources" button to Facility Information card
  - Opens in new tab showing all accessible facilities grouped by region
  - Displays access levels (Read, Manage, Owner) with color coding
  - Shows which group granted access to each facility
  - Includes summary statistics (total facilities, groups, regions)
  - Added new API function `getUserResources()` to fetch resources
  - Created new feature module `js/features/userResources.js`
  - See `FEATURE_USER_RESOURCES.md` for detailed documentation

### Changed
- **Schema card**: ID column now sorts by column family then property name (was raw string sort)
- Updated `README.md` to include new Global Resources View feature
- Enhanced Facility Information card with drill-down button

### Fixed
- **Asset Details drill-down**: Sorting by ID in the properties table now works (comparison function was missing in the generated page)

### Technical Details
- Integrated with new Tandem API endpoints:
  - `GET /users/@me/resources` - Global resources view
  - `POST /twins/{twinID}/history` - Facility ACL history
  - `POST /groups/{groupID}/history` - Group ACL history
- Added HC (History Constants) for parsing history records
- Supports region filtering (US, EMEA, AUS, EU)
- Access level mapping (0=None, 1=Read, 2=Manage, 3=Owner)
- Maintains consistent dark theme styling
- History fetched from January 1, 2020 to present

## Previous Versions

See git history for changes prior to this version.

