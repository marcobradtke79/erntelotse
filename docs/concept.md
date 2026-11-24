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
| **About** | What the app is and what it is good for: benefits, three steps to start, notes on languages, external services and the limits of the hints. First navigation entry (on phones under "More"); the start page while there is no garden. |
| **Legal notice, Privacy** | Impressum (§ 5 DDG, § 18 (2) MStV) with the provider's name, address and contact, and the privacy notice (what stays on the device, hosting, the three external services, rights). Linked at the bottom of About and of "More". |
| **Dashboard** | The current month for the active garden: tasks due now, overdue tasks, weather notes, what can be sown or planted this month, warnings (rotation, frost). |
| **Map / Plan** | The garden drawn to scale. Two backgrounds: street map (OpenStreetMap) for tracing, and grid (clean metre or foot grid). Year switcher shows the plantings of any year. A satellite/aerial background is postponed (see §8). |
| **Bed editor** | Zoomed view of one bed. Draw planting areas, place individual plants, set dates, see rotation and companion feedback, browse the bed's history. |
| **Calendar** | Three views. **Season** (default): the next 13 weeks from the week shown on the map timeline as a Gantt chart with one column per week, moved in steps of 4 weeks, also across the turn of the year; the shown week is one position in time for map, bed and calendar. **Month**: grid with tasks per day. **Year**: the same Gantt chart with one column per month. The Gantt chart: groups per bed (and one for trees and shrubs), one row per planting with pre-cultivation, time in the bed, harvest and a mark per activity. A row opens into one lane per activity type; an activity opens its details with done/skip and links to the bed and to its week on the map. Activity types can be switched off, beds collapsed to one summary track, and in the Year view a month shown closer (three months wide). A bed selected on the map, and the bed editor, open the same chart for that bed alone in a dialog ("Gantt chart", Season or Year). |
| **Plants** | The catalog: built-in plants and custom plants, with care data, calendar, companions. The list marks plants that are grown in the current year and plants that are planned (with the date they go into the bed) and can be filtered by both; a plant's page lists where it grows and where it is planned. Create and edit custom plants, override values of built-in ones. |
| **Journal** | Chronological log of done tasks and free entries (sown, fertilized, pruned, harvested with amount, note). |
| **Seeds** | The seed stock (plant, variety, number of seeds, use-by year, note) and a shopping list from the plan: seeds that are missing, and young plants to buy for plantings without pre-cultivation. |
| **Settings** | Language, units (metric/imperial), theme (system/light/dark), climate setting of the garden, weather on/off, full backup export/import, delete all data. |

## 3. Core workflows

1. **Create a garden.** Name it. The map then opens with a guided setup (every step can be skipped, revisited or finished later):
   1. **Place** – search for the address, use the device position or pan the street map until the cross is on the garden. Without a connection, or when skipped, the garden is planned on the grid. A position south of the equator switches the climate to the southern hemisphere.
   2. **Boundary** – trace the parcel on the street map (rectangle or free shape), or enter its size.
   3. **Structures** – add what helps with orientation: paths, buildings, greenhouse, pond, large trees (tree circles without a plant), fences, hedges, lawn, compost.
   4. **Beds** – draw the planting beds (rectangle, free shape or by size). Plants are assigned inside each bed afterwards.
   5. **Climate** – confirm the climate setting.

   The setup is the map view with `?setup=1`; its progress is not stored, the first step follows from what the garden already has. Gardens without a boundary offer "Set up step by step" in the map panel.
2. **Change the outline** at any time on the map: move or reshape the parcel and structures, or place the garden elsewhere.
3. **Add elements.** Beds (polygon or quick rectangle), trees and shrubs (circle with canopy diameter, plant type, planting year), and other elements such as house, path, lawn, pond, compost, greenhouse, fence or hedge.
4. **Plan plantings.** Open a bed and choose "Add planting": pick the plant, the period (from – until, or open-ended for perennials) and where it goes – a drawn area, the whole bed or single plants. The period is proposed from the plant's planting or sowing window (the next one from the shown day on) and its growing time, and can be changed before and after drawing. The app estimates the number of plants from the area and the plant spacing. A bed plant's page offers the same from the other side: "Plan planting" shows the period suggested for the current or coming season, asks for the bed – each bed is listed with its size and the area that stays free during the whole suggested period (bed area minus the largest area planted at the same time; single plants count with their spacing) – and opens that bed with the dialog filled in and the timeline moved to the suggested start. The map panel leads there: it offers to draw beds while there are none and to open the first bed while nothing is planted; a selected bed lists its plantings of the shown year.
5. **Follow hints.** The dashboard and calendar show what is due. A hint is marked done or skipped; done tasks appear in the journal.
6. **Review history.** Switch the year on the map or open a bed's history to see what grew where.
7. **Plan next year.** Switch to next year, optionally copy perennial plantings forward, place new plantings and let rotation and companion checks guide the layout.

## 4. Data model

All data is plain JSON. Lengths are stored in metres, weights in kilograms, dates as ISO strings (`YYYY-MM-DD`) regardless of the display units and language.

### 4.1 Storage keys (localStorage)

| Key | Content |
|---|---|
| `erntelotse:settings` | App settings: language, units, theme, weather on/off (`weather`, optional, default on), active garden id |
| `erntelotse:gardens` | Index of gardens: id, name, updatedAt |
| `erntelotse:garden:<id>` | One garden document (see below) |
| `erntelotse:weather:<id>` | Cached forecast for a garden with fetch time |

Each garden document carries a `schemaVersion`. On load and on import, documents with an older version are migrated step by step (`v1 → v2 → …`); documents with a newer version than the app knows are rejected with a clear message. A write that fails because the storage quota is exceeded is reported to the user and never leaves a half-written document.

### 4.2 Garden document

```json
{
  "schemaVersion": 3,
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
      "start": "2026-04-10", "end": "2026-08-15", "preStart": null,
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
- **Planting** – a plant type in a bed for a period. Its shape is an area (`polygon`) or a single plant (`point`), always inside its bed. `end` may be `null` for perennials still in place. `preStart` is the optional start of a **pre-cultivation** (raising the plants indoors or in pots before `start`): it is saved with the planting and shown on the bed's timeline and in the week's list, but the planting covers its place in the bed only from `start` on, so another planting can use the area until then. Schema version 2 added it; version 1 documents get the date the app assumed until then (plants with an indoor sowing window) or `null`. `count` is `null` until the user enters a number; until then the app estimates it from area and spacing. A planting is *planned* if it starts in the future (*pre-cultivation* while today lies between `preStart` and `start`), *active* if today lies within its period and *past* otherwise – this is derived, not stored. Moving or rotating a bed moves its plantings along; deleting a bed deletes them.
- **Tree / shrub** – besides the crown circle they have `plantId` (a catalog plant with placement `tree` or `shrub`, or `null`) and `plantedYear`.
- **Custom plant** – same structure as a catalog entry (section 5), with the name entered by the user instead of translation keys.
- **Plant override** – partial catalog entry keyed by plant id, merged over the built-in entry (for example other sowing weeks that fit the user's experience).
- **Task state** – the user's decision on a generated hint (`{ state: 'done' | 'skipped', on }`), keyed by a deterministic task key (`<source id>|<task type>|<hint>|<start>`). Hints are always regenerated from the data; only the decision is stored.
- **Journal entry** – what was actually done: `{ id, date, type, plantId, sourceId, sourceKind, taskKey, amountKg, note }`, type one of `sow`, `plant`, `care`, `fertilize`, `prune`, `water`, `harvest`, `note`. Entries written when a task is ticked off carry its `taskKey`.
- **exportedAt** (optional, on the garden) – time of the last export, for the backup reminder.

### 4.4 Coordinates

Geometry is stored in **local metres**: `x` to the east, `y` to the north, relative to the garden origin. If the garden has a `location`, the origin sits at that latitude/longitude and the app converts between metres and map coordinates with a local flat projection. A garden without a location uses the same model around 0°/0° and simply has no street map. This keeps area and length calculation simple and independent of the map library.

The projection uses the same sphere as Web Mercator (the model of Leaflet and the map tiles), not the WGS84 ellipsoid. Shapes are therefore undistorted on screen, and editing on the map (rotating a rectangle, for example) keeps exact sizes. Compared with the ellipsoid, absolute distances are off by at most about 0.3 % in Central Europe (6 cm over 20 m), which is below what tracing from a map can achieve.

Moving the garden on the map changes only the origin; all coordinates stay as they are.

### 4.5 Years and history

There is no stored "year plan". Each view filters plantings by date:

- The **timeline** of the map and the bed editor shows one week of the selected year (ISO weeks, Monday to Sunday) and moves week by week with buttons, slider or arrow keys, also across the turn of the year. Map and lists show every planting that is in the ground on at least one day of that week. On the garden map the timeline also shows how many plantings are in the ground in each week, planted areas carry their plant's icon, and the panel lists the week's plants with their beds.
- "Show the whole year" and the **year switcher** show all plantings whose period touches the selected year.
- The bed's **year timeline** shows every planting that touches the selected year as a bar from January to December (planned, growing and finished ones), with a marker for the shown week; single plants of one kind with the same period share a row.
- **History** of a bed is the list of its plantings grouped by year.
- **Planning next year** is creating plantings with future dates. "Copy forward" duplicates selected plantings into the next year with shifted dates; open-ended perennials need no copy.

### 4.6 Export and import

- **Garden export**: one `.json` file with the garden document plus the app name and export format version.
- **Full backup**: all gardens and settings in one file.
- **Import** validates structure and types before anything is stored, migrates old versions, and asks whether to replace or add as a copy when the garden id already exists.

### 4.6 Seed stock

The garden document has `seedStock: [{ id, plantId, variety, seeds, useBy, note }]` (schema version 3; `seeds` is a whole number, `useBy` a year or `null`). It belongs to the garden and travels with export and import.

- **Need** is derived, never stored: for every planting whose sowing is still ahead (its date is at most 14 days in the past and its task is neither done nor skipped), number of plants × 2 seeds (a reserve). Pre-cultivated plantings need seeds on `preStart`, directly sown ones on `start`; plantings that are planted out without pre-cultivation need young plants instead and are listed separately.
- **Shopping list** = need per plant minus the stock of that plant, sorted by the date first needed. A need of more than 10 seeds is shown as the area to sow (the part of the planned area the stock does not cover) instead of a seed count; small needs and single plants keep the count. Seeds past their use-by year still count but are flagged.
- **Using up:** marking a sowing task done takes that planting's seeds out of the stock (entries with the earliest use-by year first, never below zero) and records what was taken in the task state (`taskStates[key].seeds`), so undoing the task returns exactly that.

Implemented in `js/logic/seeds.js`.

## 5. Plant catalog

About 60 built-in plants: common vegetables, herbs, berries, fruit trees and a few ornamental shrubs. The catalog is a static JavaScript data module (`js/data/plants.js`); names and hint texts live in the translation files, keyed by plant id (`plants.<id>`). Milestone 3 started it with 15 plants and the fields beds need – `placement` (`bed`, `tree`, `shrub`), `color`, `spacing`, `lifecycle`, `growDays` (proposed time in the bed; `null` for perennials). Milestone 4 adds the remaining fields and plants.

```js
{
  id: 'tomato',
  category: 'vegetable',        // vegetable | herb | berry | fruitTree | shrub
  family: 'solanaceae',         // js/data/families.js, used for crop rotation
  placement: 'bed',             // bed | tree | shrub
  lifecycle: 'annual',          // annual | biennial | perennial
  color: '#E5483A',
  feeder: 'heavy',              // heavy | medium | light | fixer (legumes)
  frostTender: true,
  water: 'high',                // low | medium | high
  rotationGapYears: 3,
  spacing: { row: 0.8, plant: 0.6 },   // metres
  growDays: 140,                // proposed time in the bed; null for perennials
  harvestDays: 70,              // how long the harvest of one planting lasts
  windows: {                    // ISO calendar weeks, Central Europe reference
    sowIndoor: [[10, 14]],
    sowOutdoor: [],
    plantOut: [[20, 23]],
    harvest: [[29, 41]]
  },
  care: [                       // type: care | fertilize | prune | water; text: careHints.<id>.<hint>
    { type: 'prune', weeks: [24, 36], everyWeeks: 1, hint: 'sideShoots' },
    { type: 'fertilize', weeks: [24, 34], everyWeeks: 2, hint: 'fertilize' },
    { type: 'water', weeks: [22, 38], hint: 'water' }
  ],
  companions: { good: ['basil', 'carrot', 'parsley', 'lettuce', 'onion', 'radish'], bad: ['potato'] }
}
```

Catalog content (dates, companions, rotation gaps) is horticultural knowledge with regional variation. It is written from established gardening references. Per garden, the user can adjust spacing, times and windows of a built-in plant (stored as `plantOverrides[id]`, only the changed fields) and add custom plants (`customPlants`, ids `c_…`, without care rules and companions). `js/logic/catalog.js` merges these; components read plants through `js/stores/catalog.js`. Tests check that every plant is complete, companions are symmetric, and every name and care text exists in the messages.

## 6. Hints, climate and planning rules

These rules are implemented as pure functions without access to the DOM, storage or network, so they can be unit tested.

### 6.1 Hint engine

`hintsFor(garden, catalog, { from, to }) → Hint[]` in `js/logic/hints.js` (weather follows in milestone 6)

- Task types: sow, plant (out), care, fertilize, prune, water, harvest.
- For every planting and every tree or shrub with a plant, the plant's care rules (catalog weeks, shifted by the garden's climate) are projected onto the requested date range, limited to the planting's period. Repeating care rules (`everyWeeks`) produce one hint per repetition.
- Planting dates take precedence over catalog windows: a planting that starts on 20 May produces its "plant out" (or "sow outdoors") hint for that date; a planting with a pre-cultivation gets its "sow indoors" hint on `preStart` (proposed as many weeks before `start` as the catalog's sowing and planting-out windows are apart; not proposed when that date has already passed), a planting without one gets none; the harvest runs from the planting's end date back by the plant's `harvestDays`. Open-ended plantings, trees and shrubs get the catalog's harvest window every year.
- Each hint has a deterministic key; the stored task state decides whether it shows as open, done or skipped. Open hints whose window has passed are shown as overdue for a limited time and then dropped.
- **Suggestions**: independent of plantings, the dashboard lists catalog plants that can be sown or planted out in the current month.

### 6.2 Climate setting

Catalog weeks describe Central Europe (last frost around mid May). Each garden has:

- `hemisphere`: `north` or `south`. South shifts all windows by 26 weeks.
- `shiftWeeks`: from −8 (mild, earlier spring) to +8 (cold, later spring). The user chooses a preset (mild −2 / like Central Europe 0 / cold +2) or enters the typical last frost date, from which the shift is calculated (weeks from 15 May). Implemented in `js/logic/climate.js`; window boundaries up to week 26 count as spring, later ones as autumn.

Spring windows move by the full shift; autumn windows move in the opposite direction (a colder climate has a later spring and an earlier autumn), so the season stretches or shrinks rather than slides.

### 6.3 Crop rotation

When a planting is placed or moved, the bed's earlier plantings that overlap its area are checked:

- **Warning** if a plant of the same family grew there within the plant's `rotationGapYears`.
- **Note** if a heavy feeder follows a heavy feeder; **positive note** for good sequences (heavy → medium → light, or after a nitrogen fixer).

Where no area is known yet (the plant picker), the check uses the whole bed. Implemented in `js/logic/rotation.js`; shown as badges and explained in the planting panel.

### 6.4 Companion planting

For plantings in the same bed that overlap in time and lie within about one metre of each other, the catalog's `good` and `bad` lists produce a badge on both plantings. While choosing a plant for a new area, the plant picker ranks good neighbours of the surrounding plantings first and marks bad ones.

### 6.5 Weather

For gardens with a location and weather enabled, a forecast of a few days is fetched from Open-Meteo and cached. It adds:

- a **frost warning** when the minimum temperature falls near or below 0 °C while frost-tender plantings are out or about to be planted,
- a **watering hint** during dry, warm spells, and a note that watering can be skipped after rain.

Without network the app works unchanged. A forecast fetched within the last 24 hours is still shown offline (marked as older); otherwise there is no weather card. The forecast is requested for the garden position rounded to two decimals (about 1 km), cached for 3 hours per garden, and Open-Meteo is credited in the card. Rules (`js/logic/weatherRules.js`): frost when a minimum of 1 °C or less is forecast for the next seven days while frost-tender plants are in the ground or planned within 14 days after that day; watering when at least two of the next three days reach 25 °C with less than 2 mm of rain in the last three and next three days; no watering needed after 10 mm or more in the last three days. Watering notes only appear while something grows.

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
- Implementation: `sw.js` holds the list of app files and a version that is a hash of their contents, both written by `node tools/precache.mjs` (no build step; the result is committed). Same-origin requests are answered from the cache (navigations with `index.html`); requests to other hosts are not touched. A new worker waits until the user chooses "Update" in the notice, then every open tab reloads. On a local development server the worker is only registered with `?sw` in the address.

### 7.7 External services and privacy

| Service | Used for | Data sent |
|---|---|---|
| OpenStreetMap tile server | Street map background | Requested map tiles, i.e. roughly where the garden is |
| OpenStreetMap Nominatim | Place search when placing the garden | The search text and the UI language |
| Open-Meteo | Weather forecast | Garden coordinates |

Nothing else leaves the browser. All services are optional: a garden without a location uses none of them. The app states this in the settings.

### 7.8 Testing

A browser test page (`tests/index.html`) runs unit tests for the pure logic modules and the storage migrations with a small built-in harness – no test framework to install. Views are tested manually against the acceptance criteria in the implementation plan.

### 7.9 Search engines

Because all pages live behind `#` in one address, search engines index one page: the start page, in English. `index.html` carries what describes it – title, description, canonical address, preview data for shared links (with `assets/social/preview.png`), structured data (`WebApplication`) and a short static text that the app replaces on start. `sitemap.xml` lists the one address; `.nojekyll` keeps the Markdown files of the repository from being published as pages. Not covered: other languages in search results and a page per plant (both would need addresses of their own).

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
