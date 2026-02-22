# Stream Configuration Badge Reference

## Badge Types

### 1. Frequency Badge (Blue)
**When shown:** Stream has a configured sampling frequency
**Format:** Time unit abbreviation (m=minutes, h=hours, d=days)
**Examples:**
- `1m` = Every 1 minute
- `5m` = Every 5 minutes  
- `15m` = Every 15 minutes
- `1h` = Every 1 hour
- `6h` = Every 6 hours
- `1d` = Every 1 day

**Styling:**
```css
bg-blue-500/20 text-blue-300 rounded
```

**Tooltip:** "Sampling frequency: {time}"

---

### 2. Threshold Badge (Amber/Orange)
**When shown:** Stream has one or more thresholds configured
**Format:** Warning icon + number
**Examples:**
- `⚠ 1` = 1 threshold configured
- `⚠ 2` = 2 thresholds configured
- `⚠ 5` = 5 thresholds configured

**Styling:**
```css
bg-amber-500/20 text-amber-300 rounded
```

**Icon:** Warning triangle SVG
**Tooltip:** "{count} threshold(s) configured"

---

### 3. Calculated Stream Badge (Purple)
**When shown:** Stream has calculated parameters (CEL expressions)
**Format:** Function symbol
**Display:** `ƒ`

**Styling:**
```css
bg-purple-500/20 text-purple-300 rounded
```

**Tooltip:** "Calculated stream"

---

## Badge Layout in UI

Badges appear in a horizontal row next to the stream name and classification:

```
┌────────────────────────────────────────────────────┐
│ [Stream Name] [Classification] [Freq] [Thresh] [Calc] │
└────────────────────────────────────────────────────┘

Example:
┌────────────────────────────────────────────────────┐
│ Test 1   Pr_80_51   1m   ⚠2   ƒ                  │
│          └─green    └blue └amber └purple           │
└────────────────────────────────────────────────────┘
```

## Badge Combination Scenarios

### Scenario 1: Simple Sensor Stream
**Configuration:**
- Frequency: 1 minute
- No thresholds
- Not calculated

**Badges:**
```
[1m]
```

### Scenario 2: Monitored Stream with Alerts
**Configuration:**
- Frequency: 5 minutes
- 2 thresholds (temperature high/low)
- Not calculated

**Badges:**
```
[5m] [⚠2]
```

### Scenario 3: Calculated Stream
**Configuration:**
- Frequency: 15 minutes (calculation frequency)
- No direct thresholds
- Has CEL expression

**Badges:**
```
[15m] [ƒ]
```

### Scenario 4: Complex Stream
**Configuration:**
- Frequency: 1 minute
- 3 thresholds across multiple parameters
- Some parameters calculated

**Badges:**
```
[1m] [⚠3] [ƒ]
```

### Scenario 5: Default Configuration
**Configuration:**
- No explicit frequency set (uses default)
- No thresholds
- Not calculated

**Badges:**
```
(no badges - using all defaults)
```

## Implementation Details

### Badge Rendering Logic
Location: `js/features/streams.js` → `renderConfigBadges(streamConfig)`

The function checks:
1. `streamSettings.frequency` exists → Show frequency badge
2. `streamSettings.thresholds` has keys → Show threshold badge with count
3. `streamSettings.calculationSettings` has keys → Show calculated badge

### Data Source
Badges are rendered from configuration fetched via:
```javascript
const streamConfigs = await getStreamConfigs(facilityURN, region);
```

API endpoint:
```
GET /models/{modelURN}/stream-configs
```

### Badge Click Behavior
Badges themselves are **not clickable**. They are informational indicators.

To see full details, users click the **"Config" button** which opens the modal.

## Accessibility

- All badges have `title` attributes for tooltips
- Color is supplemented with icons/text (not color-only)
- Badges are inline-flex for proper alignment
- Text is high contrast on dark background

## Color Consistency

These badge colors are consistent with the rest of the app:
- **Blue** = Info/metadata (same as Tandem blue #0696D7)
- **Amber** = Warnings/alerts (standard warning color)
- **Purple** = Computed/derived data
- **Green** = Classifications (existing pattern)

## Badge Priority Order

When all badges are present, they appear in this order:
1. Classification (green) - Most important identifier
2. Frequency (blue) - Core operational parameter
3. Thresholds (amber) - Monitoring/alerts
4. Calculated (purple) - Advanced feature indicator

This matches the logical flow from "what it is" → "how it works" → "what it monitors" → "special features".
