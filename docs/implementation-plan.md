# Erntelotse – Implementation Plan

Six milestones. Each one ends with an app that works and is useful on its own, and each builds on the one before.

Related documents: [concept](concept.md) · [design rules](design-rules.md)

## Overview

| # | Milestone | Result for the user |
|---|---|---|
| 1 | Foundation | Create and manage gardens, switch language, units and theme, export and import data |
| 2 | Map and drawing | Draw the garden to scale on a real map or a plan grid |
| 3 | Beds and plantings | Plan what grows where and when; see history; plan next year |
| 4 | Catalog and hints | Built-in plants with icons; hints on dashboard and calendar |
| 5 | Planning aids | Crop rotation, companion planting, task tracking, journal |
| 6 | Weather and PWA | Weather notes, installable, offline, published |

## Rules for every milestone

A milestone is finished when:

- its acceptance criteria are met on a phone-sized and a desktop-sized window, in light and dark theme;
- every new text exists in all five languages;
- the test page shows no failures;
- a garden exported before the milestone can still be imported (a migration exists if the data format changed);
- the app runs from a plain static server without any install or build step;
- the [design rules](design-rules.md) are followed.

## Running and testing

```
python3 -m http.server 8000      # from the repository root
```

- App: `http://localhost:8000/`
- All tests: `http://localhost:8000/tests/`
- One test file or test: `http://localhost:8000/tests/?filter=<text>` (runs only tests whose file or name contains the text)
- Without a browser: `node tests/node.mjs [filter]` runs the same unit tests (Node 22 or newer, no npm)

---

## Milestone 1 – Foundation

**Status: done.**

**Scope**

- Repository skeleton as in the concept (section 7.2).
- Vendored libraries with their versions and licences listed in `vendor/README.md`: Vue 3 (browser ESM build with compiler), vue-router, vue-i18n, the UI font. Import map in `index.html`.
- App shell: header with garden switcher, responsive navigation (bottom bar / side rail / side navigation), routing in hash mode, placeholder views.
- Design tokens, base styles, light and dark theme, first components: button, card, dialog / bottom sheet, form fields, toast, empty state.
- i18n setup with five message modules, language detection from the browser, language switch.
- Units module (metric / imperial conversion and formatting).
- Storage service with the key layout, `schemaVersion`, migration runner, quota handling.
- Stores: settings, garden index, active garden with debounced auto-save.
- Gardens view: create, rename, duplicate, delete (with confirmation), select.
- Export and import of a single garden and of a full backup, with validation.
- Settings view: language, units, theme, storage use, backup, delete all data.
- Test harness and test page.

**Main modules**

`index.html`, `css/tokens.css`, `css/base.css`, `js/main.js`, `js/router.js`, `js/i18n/*`, `js/stores/*`, `js/services/storage.js`, `js/services/exportImport.js`, `js/logic/units.js`, `js/logic/migrate.js`, `js/logic/validate.js`, `js/views/GardensView.js`, `js/views/SettingsView.js`, `tests/index.html`, `tests/harness.js`

**Acceptance criteria**

- A new browser shows the app in the browser's language (or English), with an empty state that leads to creating a garden.
- Gardens survive a reload. Language, units and theme survive a reload.
- Export → delete → import restores the garden exactly. A broken or foreign file is rejected with an understandable message and changes nothing.
- The layout switches between phone, tablet and desktop navigation at the defined widths.
- The check of vendored builds is done: vue-router and vue-i18n load through the import map without further dependencies.

**Tests**

Units conversion and formatting; validation of good and bad documents; migration runner (including "newer than known" rejection); storage service against a fake storage, including a quota error.

---

## Milestone 2 – Map and drawing

**Status: done.** Deviations from the original scope:

- **No satellite background** (decision after checking provider terms, see concept §8). Backgrounds are street map (OpenStreetMap) and grid.
- **Place search** with OpenStreetMap Nominatim was added for placing the garden, besides the device position and panning under a cross.
- **Projection** uses the Web Mercator sphere instead of the WGS84 ellipsoid, so rotating shapes on the map keeps exact sizes (concept §4.4).
- Trees and shrubs are placed with one tap at a default crown size instead of being drawn as circles.
- Plant type of trees and shrubs stays in milestone 3/4; the planting year is already editable.

**Scope (as planned)**

- Vendor Leaflet and Leaflet-Geoman.
- Geometry module: metre ↔ lat/lng conversion around the garden origin, polygon area, edge lengths, circle and line helpers, point-in-polygon, polygon overlap.
- Map component with three backgrounds: street tiles, satellite tiles, plan grid. Zoom beyond native tile zoom. Attribution.
- Choice of the satellite tile provider after checking its usage terms; if no suitable free provider is found, the milestone ships with street tiles and plan grid, and the gap is recorded here.
- Garden location: pan/zoom to the place, optional "use my location", or "no location" (plan only).
- Tool palette and drawing of parcel, beds (rectangle and polygon), trees and shrubs (circle with canopy diameter), buildings, paths, lawn, pond, compost, greenhouse, fences and hedges.
- Selecting, moving, reshaping, rotating, deleting; snapping; undo and redo.
- Live measurements in the user's units; exact size entry in the detail panel.
- Element list in the side panel as the keyboard-accessible alternative to the map.

**Main modules**

`js/logic/geometry.js`, `js/components/map/GardenMap.js`, `js/components/map/ToolPalette.js`, `js/components/map/ElementPanel.js`, `js/components/map/ElementList.js`, `js/views/MapView.js`, store functions for elements and undo

**Acceptance criteria**

- A garden can be traced on the map and equally be drawn on the plan grid without any location.
- A rectangle drawn as 4 m × 1.2 m shows 4.8 m² and the correct edge lengths; in imperial units the same shape shows feet and square feet.
- Everything drawn is still in place after reload and after export/import.
- Switching the background does not move any shape.
- All drawing and editing works with touch on a phone and with the mouse; every step can be undone.
- Elements can be selected, resized by typed values and deleted from the element list with the keyboard only.

**Tests**

Geometry: conversion round trip, area of known polygons, lengths, overlap cases, point-in-polygon.

---

## Milestone 3 – Beds and plantings

**Status: done.** Deviations from the original scope:

- **No temporary plant list.** `js/data/plants.js` starts the real catalog with final ids and the fields milestone 3 needs (15 plants: vegetables, herbs, strawberries for beds; apple and cherry for trees; redcurrant and raspberry for shrubs). Milestone 4 extends these entries, so no migration is needed.
- **Count** is stored as `null` while the user has not entered one; the estimate is computed when shown, so it follows reshaping.
- **Shapes stay in the bed**: areas sticking out of a convex bed are clipped to it; otherwise (and for single plants) shapes outside the bed are rejected with a message.
- **Moving or rotating a bed moves its plantings**; resizing leaves them in place. Deleting a bed deletes its plantings (undo restores both).
- The bed editor lives at `/map/bed/:id`; the date slider and "whole year" switch are in the side panel, the year switcher in the header.

**Scope (as planned)**

- Bed editor: the map component focused on one bed, rest dimmed.
- Planting areas (polygon / rectangle inside the bed) and single plant points; shapes are kept inside the bed.
- Planting form: plant, start and end date, count, note. Until the catalog exists (milestone 4), a small temporary plant list of about ten plants with name, colour and spacing is used.
- Plant count estimate from area and spacing; manual override.
- Year switcher in the header, shared by Map, Bed editor and Calendar; date slider within the year.
- Derived status of plantings (planned / active / past); past years read-only until unlocked.
- Bed history: plantings grouped by year, with a small picture of the bed per year.
- "Copy forward" of selected plantings into the next year.
- Trees and shrubs get plant type and planting year.

**Main modules**

`js/views/BedEditorView.js`, `js/components/bed/PlantingPanel.js`, `js/components/bed/BedHistory.js`, `js/components/YearSwitcher.js`, `js/logic/plantings.js` (filtering by date, status, count estimate, copy forward), store functions for plantings

**Acceptance criteria**

- In one bed, radishes from April to May and beans from June to September can occupy the same area; the date slider shows the right one on any day.
- Switching to last year shows last year's plantings; switching to next year shows an empty bed that can be planned.
- The count estimate for a 2 m × 1.2 m carrot area matches the spacing calculation and changes when the area is reshaped.
- Bed history lists all years with plantings; the data survives export/import.

**Tests**

Planting filters by year and date (including periods crossing New Year and open-ended perennials); status derivation; count estimate; copy forward.

---

## Milestone 4 – Catalog and hints

**Split into 4a (engine) and 4b (content), decided with the user.** The plant list (62 plants) is agreed:

- Vegetables (35): carrot, tomato, lettuce, radish, bush bean, runner bean, pea, potato, zucchini, cucumber, pumpkin, onion, garlic, leek, beetroot, spinach, Swiss chard, kale, white cabbage, cauliflower, broccoli, kohlrabi, Brussels sprouts, bell pepper, chili, eggplant, sweet corn, celeriac, fennel, parsnip, lamb's lettuce, rocket, spring onion, asparagus (perennial), rhubarb (perennial)
- Herbs (10): basil, parsley, chives, dill, thyme, rosemary, sage, mint, oregano, coriander (chives to oregano perennial)
- Berries (7): strawberry (bed, perennial), raspberry, blackberry, redcurrant, blackcurrant, gooseberry, blueberry (shrubs)
- Fruit trees (6): apple, pear, sweet cherry (`cherry`), sour cherry, plum, peach
- Shrubs (4): lavender, rose, hydrangea, elder

**4a – status: done.** Catalog format and families; climate module (ISO weeks, presets, last frost); catalog with user overrides and custom plants; hint engine with suggestions and proposed start dates; dashboard; calendar (month and year); plants list and detail with calendar strip, care, companions; custom plants and adjusting built-in plants; climate settings per garden; the bed editor proposes dates from the catalog and climate. Content for the 15 plants of milestone 3. Deviations:

- A seventh task type **care** (earthing up, mulching, thinning fruit) with its own colour and icon; the design rules list it.
- Catalog plants have `harvestDays` (how long one planting's harvest lasts); the harvest hint of a planting runs from its end date backwards.
- Custom plants have no care rules and no companions; adjusting a built-in plant covers spacing, times and windows.
- Plant icons are colour swatches until 4b.

**4b – status: done.** All 62 plants with windows, care rules (66 new care texts) and names in five languages. Neighbours are declared as pairs (`GOOD_NEIGHBOURS`, `BAD_NEIGHBOURS` in `js/data/plants.js`), so they are symmetric by construction. Plant icons: one sprite `assets/icons/plants/plants.svg` with a symbol per plant and five category icons in the plant's colour for custom plants; icons replace the colour dots in lists and appear in the bed editor's map labels. Ornamental shrubs (rose, hydrangea) have no harvest window. Tests check the 62 plants, neighbour pairs, texts and icons.

**Scope (as planned)**

- Final catalog format; plant families module.
- Catalog content for about 60 plants, filled in batches by category (vegetables, herbs, berries, fruit trees, shrubs), each batch with names and hint texts in five languages. The plant list is agreed before content work starts.
- Plant icon set: one SVG per plant and the generic category icons, following the icon rules. Plant colours.
- The temporary plant list from milestone 3 is replaced; a migration maps its ids to catalog ids.
- Plants view: browse, search, filter by category; plant detail with calendar strip, care, spacing, companions.
- Custom plants (create, edit, delete) and overrides of built-in plants.
- Climate setting per garden: hemisphere and shift with presets or last frost date.
- Climate module and hint engine.
- Planting form proposes dates from the catalog and climate.
- Calendar view: month grid with tasks, year overview with bars per planting.
- Dashboard: tasks due this month grouped by task type, "can be sown / planted now" suggestions, short summary of the garden.

**Main modules**

`js/data/plants.js`, `js/data/families.js`, `assets/icons/plants/*`, `js/logic/climate.js`, `js/logic/hints.js`, `js/logic/catalog.js` (merging built-in, overrides, custom), `js/views/PlantsView.js`, `js/views/CalendarView.js`, `js/views/DashboardView.js`

**Acceptance criteria**

- Every catalog plant has a name in all five languages, an icon, a colour, a family, spacing and at least one activity window. A test checks this for the whole catalog.
- A tomato planting produces sowing, planting-out, fertilizing, side-shoot and harvest hints at plausible times; the same garden set to the southern hemisphere shows them half a year shifted; a cold setting shows spring tasks later.
- An apple tree produces pruning and harvest hints.
- The dashboard for the current month and the calendar show the same tasks.
- A custom plant can be created and used in a planting and produces hints from its own data.

**Tests**

Climate shift (hemisphere, positive and negative shift, year boundaries); hint engine for annuals, perennials, repeating care rules and planting dates that differ from catalog windows; catalog completeness and reference checks (companions and families point to existing ids; every message key exists in every language).

---

## Milestone 5 – Planning aids

**Scope**

- Rotation module: same-family check within the rotation gap on overlapping areas, feeder sequence notes, fallback to bed level.
- Companion module: good and bad neighbours for plantings close in space and overlapping in time.
- Badges on plantings and explanations in the planting panel; plant picker ranks good neighbours and marks bad ones and rotation conflicts.
- Task tracking: done / skipped state on hints, overdue handling, deterministic task keys.
- Journal: entries from done tasks, free entries, harvest amounts in the user's units, filter by type, plant and bed. Harvest totals per plant and year.
- Dashboard gains overdue tasks and warnings.
- Export reminder when a garden has not been exported for a long time.

**Main modules**

`js/logic/rotation.js`, `js/logic/companions.js`, `js/logic/tasks.js`, `js/views/JournalView.js`, `js/components/TaskChip.js`, extensions of the planting panel and dashboard

**Acceptance criteria**

- Planning tomatoes where potatoes grew last year shows a rotation warning naming the year and the family; a different bed shows none.
- Tomato next to basil shows a good-neighbour badge on both; tomato next to fennel a bad one; plantings that do not overlap in time show nothing.
- A task ticked off on the dashboard is also done in the calendar, stays done after reload, and appears in the journal.
- A harvest entry of 4.5 kg shows as pounds and ounces when units are switched to imperial.

**Tests**

Rotation (same family inside and outside the gap, overlapping and separate areas, feeder sequences); companions (distance and time overlap); task keys stable across regeneration; overdue rules; journal totals.

---

## Milestone 6 – Weather and PWA

**Scope**

- Weather service: Open-Meteo forecast for gardens with a location, cached with a maximum age, switchable off, silent when offline.
- Weather rules: frost warning for frost-tender plantings, watering hint in dry warm spells, "no watering needed" after rain. Weather card on the dashboard.
- Web app manifest, app icons, install hint.
- Service worker: precache of the app shell with versioning, update notice. No service-worker cache for OpenStreetMap tiles: its tile policy forbids offline use (concept §7.6); offline, the map view shows the grid.
- Privacy note in the settings about tile and weather requests.
- Publication on GitHub Pages from the repository; all paths relative.
- Final pass: accessibility check against the design rules (keyboard, contrast, screen reader announcements, text zoom), performance with a large garden, review of all translations.

**Main modules**

`js/services/weather.js`, `js/logic/weatherRules.js`, `manifest.webmanifest`, `sw.js`, `assets/icons/app/*`

**Acceptance criteria**

- With a forecast below 0 °C and tomatoes planted out, the dashboard shows a frost warning; without network the dashboard works and shows no weather card.
- The app can be installed on a phone and on a desktop browser and starts without network after the first visit; offline, the map view shows the garden on the grid.
- After publishing a new version, the app announces the update and uses it after reload.
- The published app on GitHub Pages passes the acceptance criteria of all earlier milestones.

**Tests**

Weather rules against prepared forecast data; cache age handling of the weather service against a fake fetch.

---

## Later ideas (not planned)

- Satellite/aerial background: open national aerial photos chosen by location (e.g. Spain PNOA, France IGN, German states) and/or a user-supplied tile URL or API key
- Notifications or calendar file export for reminders
- Own background image (sketch or drone photo) for the plan
- Photos in the journal
- Sync between devices
- Seed stock and shopping list
- Larger catalog with varieties
