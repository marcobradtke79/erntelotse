# Erntelotse – Concept

Erntelotse ("harvest pilot") is a progressive web app for planning a private garden: draw the garden, plan what grows where and when, keep the history of every bed, and get timely hints on what to do this month.

Related documents: [design rules](design-rules.md) · [implementation plan](implementation-plan.md)

## 1. Vision, users and non-goals

**Users** are hobby gardeners with a home garden or allotment. They plan at a desk (drawing, next year's layout) and look things up in the garden on a phone (what is due, tick off a task, note a harvest). Both situations are equally important.

**What the app does**

- Draw a garden to scale: parcel, beds, trees, shrubs and other elements.
- Plan plantings inside beds as areas of one plant type or as individual plants.
- Keep the history of each bed over the years and plan the next year.
- Give hints on sowing, planting out, fertilizing, pruning, watering and harvesting.
- Warn about poor crop rotation and bad neighbours, suggest good ones.
- Show everything in a map view, a calendar view and a dashboard for the current month.

**Non-goals**

- No user accounts, no server, no sync between devices. Data moves by export/import.
- No push notifications or reminders outside the app.
- No professional or commercial growing features (yields per hectare, cost tracking).
- No photo storage (browser storage is too small for it).

## 2. Views

| View | Purpose |
|---|---|
| **Gardens** | List of garden projects; create, rename, duplicate, delete, export, import. |
| **Dashboard** | The current month for the active garden: tasks due now, overdue tasks, weather notes, what can be sown or planted this month, warnings (rotation, frost). |
| **Map / Plan** | The garden drawn to scale. Two backgrounds: street map (OpenStreetMap) for tracing, and grid (clean metre or foot grid). Year switcher shows the plantings of any year. A satellite/aerial background is postponed (see §8). |
| **Bed editor** | Zoomed view of one bed. Draw planting areas, place individual plants, set dates, see rotation and companion feedback, browse the bed's history. |
| **Calendar** | Month grid with tasks per day/week, plus a year overview with one row per planting showing its sowing, growing and harvest windows. |
| **Plants** | The catalog: built-in plants and custom plants, with care data, calendar, companions. Create and edit custom plants, override values of built-in ones. |
| **Journal** | Chronological log of done tasks and free entries (sown, fertilized, pruned, harvested with amount, note). |
| **Settings** | Language, units (metric/imperial), theme (system/light/dark), climate setting of the garden, weather on/off, full backup export/import, delete all data. |

## 3. Core workflows

1. **Create a garden.** Name it, optionally search for or pan to its location, choose the climate setting.
2. **Trace the parcel** on the street map, or skip the map and draw it on the grid, or add it by entering dimensions.
3. **Add elements.** Beds (polygon or quick rectangle), trees and shrubs (circle with canopy diameter, plant type, planting year), and other elements such as house, path, lawn, pond, compost, greenhouse, fence or hedge.
4. **Plan plantings.** Open a bed, draw an area and pick a plant, or place single plants. Start and end dates are proposed from the catalog and can be changed. The app estimates the number of plants from the area and the plant spacing.
5. **Follow hints.** The dashboard and calendar show what is due. A hint is marked done or skipped; done tasks appear in the journal.
6. **Review history.** Switch the year on the map or open a bed's history to see what grew where.
7. **Plan next year.** Switch to next year, optionally copy perennial plantings forward, place new plantings and let rotation and companion checks guide the layout.

## 4. Data model

All data is plain JSON. Lengths are stored in metres, weights in kilograms, dates as ISO strings (`YYYY-MM-DD`) regardless of the display units and language.

### 4.1 Storage keys (localStorage)

| Key | Content |
|---|---|
| `erntelotse:settings` | App settings: language, units, theme, active garden id |
| `erntelotse:gardens` | Index of gardens: id, name, updatedAt |
| `erntelotse:garden:<id>` | One garden document (see below) |
| `erntelotse:weather:<id>` | Cached forecast for a garden with fetch time |

Each garden document carries a `schemaVersion`. On load and on import, documents with an older version are migrated step by step (`v1 → v2 → …`); documents with a newer version than the app knows are rejected with a clear message. A write that fails because the storage quota is exceeded is reported to the user and never leaves a half-written document.

### 4.2 Garden document

```json
{
  "schemaVersion": 1,
  "id": "g_8f3k2a",
  "name": "Home garden",
  "createdAt": "2026-11-21T10:00:00Z",
  "updatedAt": "2026-11-21T10:30:00Z",
  "location": { "lat": 52.52, "lng": 13.4 },
  "climate": { "hemisphere": "north", "shiftWeeks": 0 },
  "elements": [
    {
      "id": "e_1", "type": "parcel", "name": "",
      "geometry": { "kind": "polygon", "points": [[0, 0], [20, 0], [20, 30], [0, 30]] }
    },
    {
      "id": "e_2", "type": "bed", "name": "Bed 1",
      "geometry": { "kind": "polygon", "points": [[2, 2], [6, 2], [6, 3.2], [2, 3.2]] }
    },
    {
      "id": "e_3", "type": "tree", "name": "Old apple tree", "plantId": "apple",
      "plantedYear": 2015,
      "geometry": { "kind": "circle", "center": [15, 22], "radius": 2.5 }
    }
  ],
  "plantings": [
    {
      "id": "p_1", "bedId": "e_2", "plantId": "carrot",
      "shape": { "kind": "polygon", "points": [[2, 2], [4, 2], [4, 3.2], [2, 3.2]] },
      "start": "2026-04-10", "end": "2026-08-15",
      "count": 120, "note": ""
    },
    {
      "id": "p_2", "bedId": "e_2", "plantId": "tomato",
      "shape": { "kind": "point", "at": [5, 2.6] },
      "start": "2026-05-20", "end": "2026-10-05",
      "count": 1, "note": "Variety: Black Krim"
    }
  ],
  "customPlants": [],
  "plantOverrides": {},
  "taskStates": {
    "p_2|fertilize|2026-06-15": { "state": "done", "on": "2026-06-16" }
  },
  "journal": [
    {
      "id": "j_1", "date": "2026-08-15", "type": "harvest",
      "plantingId": "p_1", "amountKg": 4.5, "note": ""
    }
  ]
}
```

### 4.3 Entities

- **Element** – anything drawn on the garden. `type` is one of `parcel`, `bed`, `tree`, `shrub`, `building`, `path`, `lawn`, `pond`, `compost`, `greenhouse`, `fence`, `hedge`. Geometry kinds: `polygon`, `circle` (trees, shrubs), `line` with a width (paths, fences, hedges). Trees and shrubs reference a plant and have a planting year; the circle is the current canopy.
- **Planting** – a plant type in a bed for a period. Its shape is an area (`polygon`) or a single plant (`point`). `end` may be `null` for perennials still in place. A planting is *planned* if it starts in the future, *active* if today lies within its period and *past* otherwise – this is derived, not stored.
- **Custom plant** – same structure as a catalog entry (section 5), with the name entered by the user instead of translation keys.
- **Plant override** – partial catalog entry keyed by plant id, merged over the built-in entry (for example other sowing weeks that fit the user's experience).
- **Task state** – the user's decision on a generated hint, keyed by a deterministic task key (`<source id>|<task type>|<period start>`). Hints are always regenerated from the data; only the decision is stored.
- **Journal entry** – what was actually done: type (`sow`, `plant`, `fertilize`, `prune`, `water`, `harvest`, `note`), date, optional link to a planting or element, optional amount, free note.

### 4.4 Coordinates

Geometry is stored in **local metres**: `x` to the east, `y` to the north, relative to the garden origin. If the garden has a `location`, the origin sits at that latitude/longitude and the app converts between metres and map coordinates with a local flat projection. A garden without a location uses the same model around 0°/0° and simply has no street map. This keeps area and length calculation simple and independent of the map library.

The projection uses the same sphere as Web Mercator (the model of Leaflet and the map tiles), not the WGS84 ellipsoid. Shapes are therefore undistorted on screen, and editing on the map (rotating a rectangle, for example) keeps exact sizes. Compared with the ellipsoid, absolute distances are off by at most about 0.3 % in Central Europe (6 cm over 20 m), which is below what tracing from a map can achieve.

Moving the garden on the map changes only the origin; all coordinates stay as they are.

### 4.5 Years and history

There is no stored "year plan". Each view filters plantings by date:

- The **year switcher** shows all plantings whose period touches the selected year; a date slider within the year shows the bed on a given day.
- **History** of a bed is the list of its plantings grouped by year.
- **Planning next year** is creating plantings with future dates. "Copy forward" duplicates selected plantings into the next year with shifted dates; open-ended perennials need no copy.

### 4.6 Export and import

- **Garden export**: one `.json` file with the garden document plus the app name and export format version.
- **Full backup**: all gardens and settings in one file.
- **Import** validates structure and types before anything is stored, migrates old versions, and asks whether to replace or add as a copy when the garden id already exists.

## 5. Plant catalog

About 60 built-in plants: common vegetables, herbs, berries, fruit trees and a few ornamental shrubs. The catalog is a static JavaScript data module; names and hint texts live in the translation files, keyed by plant id.

```js
{
  id: 'tomato',
  category: 'vegetable',        // vegetable | herb | berry | fruitTree | shrub | flower
  family: 'solanaceae',         // botanical family, used for crop rotation
  feeder: 'heavy',              // heavy | medium | light | fixer (legumes)
  lifecycle: 'annual',          // annual | biennial | perennial
  frostTender: true,
  water: 'high',                // low | medium | high
  spacing: { row: 0.8, plant: 0.6 },   // metres
  rotationGapYears: 4,
  windows: {                    // calendar weeks, Central Europe reference
    sowIndoor: [[8, 14]],
    sowOutdoor: [],
    plantOut: [[20, 24]],
    harvest: [[28, 42]]
  },
  care: [
    { type: 'fertilize', weeks: [[22, 34]], everyWeeks: 2, hint: 'tomato.fertilize' },
    { type: 'prune', weeks: [[23, 36]], everyWeeks: 1, hint: 'tomato.sideShoots' }
  ],
  companions: { good: ['basil', 'carrot', 'parsley'], bad: ['potato', 'fennel'] },
  icon: 'tomato'
}
```

Catalog content (dates, companions, rotation gaps) is horticultural knowledge with regional variation. It is written from established gardening references, and the user can override any value per plant.

## 6. Hints, climate and planning rules

These rules are implemented as pure functions without access to the DOM, storage or network, so they can be unit tested.

### 6.1 Hint engine

`hints(garden, catalog, range, weather?) → Hint[]`

- For every planting and every tree or shrub, the plant's activity windows and care rules are projected onto the requested date range, shifted by the garden's climate setting.
- A window becomes a hint with a start, an end, a task type, the plant, the place (bed or element) and a text key. Repeating care rules (`everyWeeks`) produce one hint per repetition.
- Planting dates take precedence over catalog windows: a planting that starts on 20 May produces its "plant out" hint for that date, and its harvest hint from the catalog's growing duration.
- Each hint has a deterministic key; the stored task state decides whether it shows as open, done or skipped. Open hints whose window has passed are shown as overdue for a limited time and then dropped.
- **Suggestions**: independent of plantings, the dashboard lists catalog plants that can be sown or planted out in the current month.

### 6.2 Climate setting

Catalog weeks describe Central Europe (last frost around mid May). Each garden has:

- `hemisphere`: `north` or `south`. South shifts all windows by 26 weeks.
- `shiftWeeks`: from about −6 (mild, earlier spring) to +6 (cold, later spring). The user chooses a preset (mild / average / cold) or enters the typical last frost date, from which the shift is calculated.

Spring windows move by the full shift; autumn windows move in the opposite direction (a colder climate has a later spring and an earlier autumn), so the season stretches or shrinks rather than slides.

### 6.3 Crop rotation

When a planting is placed or moved, the bed's earlier plantings that overlap its area are checked:

- **Warning** if a plant of the same family grew there within the plant's `rotationGapYears`.
- **Note** if a heavy feeder follows a heavy feeder; **positive note** for good sequences (heavy → medium → light, or after a nitrogen fixer).

Where areas cannot be compared, the check falls back to the whole bed.

### 6.4 Companion planting

For plantings in the same bed that overlap in time and lie within about one metre of each other, the catalog's `good` and `bad` lists produce a badge on both plantings. While choosing a plant for a new area, the plant picker ranks good neighbours of the surrounding plantings first and marks bad ones.

### 6.5 Weather

For gardens with a location and weather enabled, a forecast of a few days is fetched from Open-Meteo and cached. It adds:

- a **frost warning** when the minimum temperature falls near or below 0 °C while frost-tender plantings are out or about to be planted,
- a **watering hint** during dry, warm spells, and a note that watering can be skipped after rain.

Without network the app works unchanged and simply shows no weather notes.

## 7. Architecture

### 7.1 Principles

- **No build step.** The repository is the app. `index.html` loads native ES modules; nothing has to be installed to run or test it. It must be served over `http(s)` (any static server), because ES modules and service workers do not work from `file://`.
- **Vue 3** in the browser ESM build that includes the template compiler. Components are plain `.js` modules exporting a component object with a template string.
- **Vendored libraries** in `vendor/`, no CDN at runtime: Vue, vue-router (hash mode), vue-i18n, Leaflet, Leaflet-Geoman (drawing and editing) and the UI font. An import map in `index.html` maps bare names such as `vue` to the vendored files. Leaflet and Leaflet-Geoman are loaded as classic scripts because the plugin expects the global `L`.
- **Layers**: views and components → stores → pure logic and services. Logic modules never import Vue or touch the DOM.

### 7.2 Folder layout

```
index.html              entry point, import map
manifest.webmanifest    PWA manifest
sw.js                   service worker
css/                    tokens, base styles, component styles
js/
  main.js               app start
  router.js             routes (hash mode)
  views/                one module per view
  components/           reusable components, map and bed editor parts
  stores/               reactive state: settings, gardens, active garden
  logic/                pure functions: geometry, units, climate, hints,
                        rotation, companions, migrations, validation
  services/             storage, export/import, weather
  data/                 plant catalog, plant families
  i18n/                 setup and one message module per language
assets/icons/           plant icons and UI icons (SVG)
vendor/                 third-party libraries and font
tests/                  browser test page and test modules
docs/                   concept, design rules, implementation plan
```

### 7.3 State and persistence

Stores are small modules built on Vue's `reactive`. The active garden store holds one garden document; every change goes through store functions, which update `updatedAt` and schedule a debounced save through the storage service. The storage service is the only code that touches `localStorage`. An undo stack for drawing operations lives in the store, in memory only.

### 7.4 Map

One Leaflet map component (`js/components/map/GardenMap.js`) serves the map view and, from milestone 3, the bed editor.

- Leaflet and Leaflet-Geoman are classic scripts (global `L`); they are loaded on first use of the map (`js/services/leaflet.js`), so the rest of the app starts without them.
- **Backgrounds**: street tiles (OpenStreetMap) and grid (no tiles, metre or foot grid drawn on canvas). Tiles are enlarged beyond their native zoom 19 so that single beds can be worked on. A garden without a location shows only the grid.
- **Placing the garden**: place search with OpenStreetMap Nominatim (on submit only, at most one request per second), the device position, or panning the map under a cross.
- **Drawing and editing** with Leaflet-Geoman: rectangles, polygons and lines are drawn with Geoman; trees and shrubs are placed with one tap at a default crown size. Selected shapes can be reshaped, moved or rotated; snapping to vertices and edges can be switched off. Exact sizes can be typed in the detail panel; elements can also be added by size.
- The component translates between stored metre geometry and Leaflet layers and reports changes as events; all other code only sees metre geometry. Undo and redo keep snapshots of the element list in memory.
- The **bed editor** (milestone 3) is the same component restricted to one bed, with the rest of the garden dimmed.

### 7.5 Internationalisation and units

- Languages: English, German, French, Spanish, Portuguese. The start language comes from the browser settings; the user can change it, and the choice is stored. English is the fallback.
- All visible text, including plant names and hint texts, comes from the message modules.
- Dates and numbers are formatted with the browser's `Intl` functions for the chosen language.
- Units are switchable between metric and imperial. Conversion happens only at display and input; stored values are always metric.

### 7.6 PWA and offline

- Web app manifest for installation on phone and desktop.
- The service worker precaches the app shell (HTML, CSS, JS, vendor files, icons) under a versioned cache name; a new version is announced in the app and activated on reload.
- OpenStreetMap's tile usage policy does not permit offline use of `tile.openstreetmap.org` (no prefetching, no "save for offline"); re-visits served from the browser's normal HTTP cache are allowed. The service worker therefore does not store these tiles. Offline, the map view falls back to the grid, which shows the whole garden.
- Everything except the street map, place search and weather works offline.

### 7.7 External services and privacy

| Service | Used for | Data sent |
|---|---|---|
| OpenStreetMap tile server | Street map background | Requested map tiles, i.e. roughly where the garden is |
| OpenStreetMap Nominatim | Place search when placing the garden | The search text and the UI language |
| Open-Meteo | Weather forecast | Garden coordinates |

Nothing else leaves the browser. All services are optional: a garden without a location uses none of them. The app states this in the settings.

### 7.8 Testing

A browser test page (`tests/index.html`) runs unit tests for the pure logic modules and the storage migrations with a small built-in harness – no test framework to install. Views are tested manually against the acceptance criteria in the implementation plan.

## 8. Risks and limits

| Risk | Handling |
|---|---|
| `localStorage` holds roughly 5 MB per origin | Garden documents are small (text only, no images). Storage use is shown in settings; quota errors are caught and reported; regular export is recommended in the app. |
| Browser data can be cleared by the user or the browser | Export reminder when a garden has not been exported for a long time. |
| Tile providers have usage terms | OpenStreetMap tiles are used as their policy requires: attribution, the browser's default Referer, no offline storage. The grid background works without tiles. |
| No free, sharp, worldwide aerial imagery with clear terms (checked in milestone 2: Esri World Imagery terms for keyless use could not be confirmed; Spain (PNOA, CC BY 4.0), France (IGN) and several German states publish open aerial photos; commercial providers need an API key) | Satellite background postponed by decision. Options for later: open national aerial photos chosen by location, and/or a user-supplied tile URL or API key. |
| Template compilation in the browser needs `unsafe-eval` if a content security policy is set | GitHub Pages sets none; documented for other hosts. |
| Catalog content for 60 plants in 5 languages is a large part of the work | Catalog format is fixed early; content is filled in batches and can be overridden by the user. |
| Climate shift is a rough model | Presented as guidance; all dates of a planting and all catalog windows can be edited. |
