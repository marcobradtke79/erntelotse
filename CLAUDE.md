# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Erntelotse is a progressive web app for garden planning.

- Users create garden projects and draw the parcel, individual trees and shrubs, planting beds and other garden elements on a map.
- Inside planting beds they create areas associated with a type of plant, or place individual plants.
- The app stores the history of plants in a bed over the years and allows planning the next year.
- It gives hints on plant care: when to sow, plant, fertilize, prune, water and harvest.
- Besides the map view there is a calendar view and a dashboard with hints and suggestions for the current month.
- It is available in English, German, French, Spanish and Portuguese, chosen from the browser settings and changeable by the user.
- It is based on Vue and runs in the browser from a simple `index.html`. Data is stored as JSON in the browser and can be exported and imported.

## Status

Milestones 1–6 are implemented: foundation, map and drawing, beds and plantings, catalog of 62 plants with icons and hints (dashboard, calendar, plant pages, custom plants, climate), planning aids (crop rotation, neighbours, task states, journal, backup reminder), weather and PWA (Open-Meteo forecast, installable, offline, update notice). Publishing on GitHub Pages (deploy from `main`, repository root) is still open. There is no satellite background (decided; see `docs/concept.md` §8). The specification is in `docs/`; read the relevant document before implementing anything:

- `docs/concept.md` – features, data model, plant catalog format, hint and planning rules, architecture
- `docs/design-rules.md` – colours, typography, icons, layout, map interaction, text and accessibility rules
- `docs/implementation-plan.md` – six milestones with scope, modules, acceptance criteria and tests

Work proceeds milestone by milestone. The "Rules for every milestone" section of the implementation plan is the definition of done.

## Commands

There is no build step, package manager or linter.

```
python3 -m http.server 8000      # serve the repository root
```

- App: `http://localhost:8000/`
- All tests: `http://localhost:8000/tests/` – the page title shows `✓ n/n passed`; `window.__testResults` holds `{ total, failed, failures }` for scripted checks
- Single test file or test: `http://localhost:8000/tests/?filter=<text>` (matches file, group or test name)
- Same tests without a browser: `node tests/node.mjs [filter]` (Node 22+, no npm) – the quickest check for `js/logic`, storage and i18n
- New test files must be added to `tests/files.js`; tests use `describe/test/expect` from `tests/harness.js`
- `node --check <file>` is a quick syntax check for view and component modules, which only run in the browser
- `python3 -m http.server` sends no cache headers, so Chrome may keep serving old CSS/JS after edits; hard-reload, or use a server that sends `Cache-Control: no-store` while testing
- **After adding, removing or changing any app file, run `node tools/precache.mjs`**: it writes the precache list and a content-hash version into `sw.js`. `node tests/node.mjs` fails while it is out of date. Without a new version, installed apps never see the change.
- On localhost / 127.0.0.1 the service worker is not registered (and old registrations are removed), so edits show up directly. Add `?sw` before the hash (`http://localhost:8000/?sw#/dashboard`) to test offline start and updates.
- App icons: `python3 tools/app-icons.py assets/icons/app` renders the PNGs from the favicon design (needs Pillow).

The app must be served over http(s); ES modules and the service worker do not work from `file://`.

## Code map

- `index.html` – import map and CSS; `js/main.js` initialises settings, theme, language and gardens, then mounts `js/App.js` (shell) with `js/router.js`.
- `js/services/storage.js` – `createStorage(backend)`; `js/services/appStorage.js` creates the app instance (memory fallback when localStorage is blocked). Tests use `createMemoryBackend()`.
- `js/stores/gardens.js` – garden index plus the active garden document. Change the active garden only through `mutateActive(fn)` or the drawing functions below (sets `updatedAt`, debounced save). Keep imported documents out of deep `reactive` state (see the reactivity pitfalls).
- `js/stores/toast.js` – stores and services report problems as message keys; `ToastHost` translates them. Logic modules return error codes, never text.
- `js/i18n/` – one message module per language; `tests/i18n.test.js` fails if keys, placeholders or plural forms differ between languages. Avoid `@` and `|` (vue-i18n syntax) except `|` for plurals.
- `js/navigation.js` – nav entries (primary entries are the phone bottom bar, secondary ones move to `/more`).
- Map: `js/views/MapView.js` (garden) and `js/views/BedEditorView.js` (`/map/bed/:id`) hold UI state (tool, selection, edit mode) and write to the store; `js/components/map/GardenMap.js` is the only Leaflet code. It draws "items" (elements and the plantings of the shown period); in bed mode (`focusBedId`) only that bed's plantings are selectable/editable. It reports `create`/`change`/`select` events with metre geometry; `refresh(id)` redraws a shape whose change the parent rejected. Element types: `js/logic/elements.js`; plantings, periods, count estimate, keeping shapes in the bed, copy forward: `js/logic/plantings.js`; ISO date helpers: `js/logic/dates.js`; projection and shape maths: `js/logic/geometry.js`.
- Drawing changes go through the gardens store (`addElement`, `updateElementGeometry`, `deleteElement`/`restoreElement`, `addPlantings`, `updatePlanting`, `deletePlanting`); each records an undo snapshot of elements and plantings together.
- Plants: built-in data in `js/data/plants.js` (+ `families.js`); names `plants.<id>`, care texts `careHints.<id>.<hint>`. `js/logic/catalog.js` merges built-ins, per-garden `plantOverrides` and `customPlants`; components must read plants via `js/stores/catalog.js` (`plantById`, `plantLabel`), not `getPlant`, or custom plants break. Adding a plant: data entry, neighbour pairs, name and care texts in five languages, and a `plant-<id>` symbol in `assets/icons/plants/plants.svg`; `tests/catalog.test.js` and `tests/i18n.test.js` check all of these. Plant icons: `js/components/PlantIcon.js` (custom plants get their category icon in their colour).
- Hints: `js/logic/hints.js` (`hintsFor`, `suggestions`, `proposedStart`) on top of `js/logic/climate.js` (ISO weeks, climate shift). Hints are derived on the fly; views: `DashboardView`, `CalendarView`; display helpers in `js/components/tasks/`.
- Planning aids: `js/logic/rotation.js` (rotation check, neighbours, badges, picker advice) and `js/logic/tasks.js` (task states, overdue, journal helpers). Task states and journal change through `setTaskState`, `addJournalEntry`, `updateJournalEntry`, `deleteJournalEntry` in the gardens store; marking a task done writes its journal entry. Exports go through `js/services/backup.js` (records `exportedAt` for the reminder).
- Weather: `js/logic/weatherRules.js` (frost, watering, rain notes; pure) and `js/services/weather.js` (Open-Meteo, position rounded to ~1 km, cache `erntelotse:weather:<id>`, 3 h max age, offline fallback up to 24 h) → `js/stores/weather.js` → `js/components/WeatherCard.js` on the dashboard. Switch: `settings.weather`.
- PWA: `manifest.webmanifest`, `sw.js` (cache-first for same-origin files, never for OSM tiles or other hosts), `js/services/pwa.js` (registration, install prompt, update toast). `js/stores/network.js` tracks online/offline; offline the map uses the grid.
- `js/stores/period.js` – the shown year and day (or whole year), shared by map, bed editor and calendar; past years are read-only until unlocked per session.

## Vue reactivity pitfalls (hit five times)

- `structuredClone` throws on Vue proxies. Copy data with `JSON.parse(JSON.stringify(...))` (all stored data is JSON) – the store's save copy and the pure logic modules already do.
- `reactive.list = reactive.list.filter(...)` stores proxies inside the raw document, which then breaks saving. Filter the raw array: `toRaw(reactive.list).filter(...)`.
- A `watch` created while a component's `setup` runs stops when that component unmounts. Store-level watchers started lazily from a component need `effectScope(true).run(...)` (see `js/stores/weather.js`).

## Map pitfalls (each one cost a debugging round)

- Never bind `:class` (or anything Vue patches) on the element Leaflet is mounted on; Vue rewrites `class` and erases Leaflet's own classes. Bind on the wrapper.
- Build the map view (`setView`/`fitBounds`) before creating layers; line widths depend on the current scale.
- Jumps to far places use `setView(..., { animate: false })`, not `flyTo`: after long animated jumps Leaflet keeps tile levels with huge pixel offsets and tiles end up misplaced.
- Geoman keeps options passed to `layer.pm.enable()` on the layer: after `draggable: false`, `enableLayerDrag()` silently does nothing unless `setOptions({ draggable: true })` comes first.
- Element layers must let clicks bubble to the map, otherwise drawing on top of existing shapes cannot place points.
- Element names go into map labels as text nodes, never as HTML strings (names can come from imported files).
- In a hidden browser tab (automation) `requestAnimationFrame` does not run, so Leaflet fade/zoom animations never finish, and `setTimeout` is throttled to about 1 s; that is not an app bug. For timings, yield with a `MessageChannel` and look at long tasks.

## Fixed decisions

Do not change these without asking the user.

- **No build step.** Native ES modules; Vue 3 browser ESM build with template compiler; components are `.js` modules with template strings (no `.vue` files, no TypeScript, no npm).
- **Vendored libraries only** (`vendor/`, see `vendor/README.md`): Vue, vue-router in hash mode, vue-i18n (via the import map in `index.html`), Leaflet 1.9 and Leaflet-Geoman (classic scripts, loaded on first map use), the UI font. No CDN requests at runtime. Do not add a dependency without asking.
- **State** in small stores built on Vue `reactive`; no Pinia.
- **Persistence** in `localStorage` only, through `js/services/storage.js`. Garden documents carry a `schemaVersion`; any change to the stored format needs a migration and must keep older exports importable.
- **Stored values are metric and language-neutral** (metres, kilograms, ISO dates). Unit conversion and formatting happen only at display and input.
- **Geometry is stored in local metres** relative to the garden origin, not as latitude/longitude. Only the map component converts to Leaflet coordinates.
- **Layering:** views/components → stores → `js/logic` and `js/services`. Modules in `js/logic` are pure (no Vue, DOM, storage or network) and are the unit-tested core: geometry, units, climate, hints, rotation, companions, migrations.
- **Hints are derived, never stored.** Only the user's decision per task (done/skipped) is stored, under a deterministic task key.
- **No hard-coded UI text.** Every string, including plant names and hint texts, comes from `js/i18n/` and is added to all five languages in the same change.
- **Colours and spacing only through the tokens** in `css/tokens.css`; every component must work in light and dark theme, on phone and desktop widths.
- **External requests** are limited to OpenStreetMap tiles, Nominatim place search (on submit only, max one per second) and the Open-Meteo forecast; everything else works offline. OSM tiles must not be stored for offline use (tile policy).
- Hosted on GitHub Pages as static files, so all paths are relative.
