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

Milestone 1 (foundation) is done: app shell, navigation, themes, i18n, settings, storage layer, garden management, export/import, test harness. Map, beds, catalog and hints are placeholder views. The specification is in `docs/`; read the relevant document before implementing anything:

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
- New test files must be added to the `FILES` list in `tests/index.html`; tests use `describe/test/expect` from `tests/harness.js`
- `node --check <file>` is a quick syntax check; the modules themselves only run in the browser

The app must be served over http(s); ES modules and the service worker do not work from `file://`.

## Code map

- `index.html` – import map and CSS; `js/main.js` initialises settings, theme, language and gardens, then mounts `js/App.js` (shell) with `js/router.js`.
- `js/services/storage.js` – `createStorage(backend)`; `js/services/appStorage.js` creates the app instance (memory fallback when localStorage is blocked). Tests use `createMemoryBackend()`.
- `js/stores/gardens.js` – garden index plus the active garden document. Change the active garden only through `mutateActive(fn)` (sets `updatedAt`, debounced save). Documents handed to storage or `structuredClone` must be plain objects: use `toRaw`/the store's helpers, and keep imported documents out of deep `reactive` state.
- `js/stores/toast.js` – stores and services report problems as message keys; `ToastHost` translates them. Logic modules return error codes, never text.
- `js/i18n/` – one message module per language; `tests/i18n.test.js` fails if keys, placeholders or plural forms differ between languages. Avoid `@` and `|` (vue-i18n syntax) except `|` for plurals.
- `js/navigation.js` – nav entries (primary entries are the phone bottom bar, secondary ones move to `/more`).

## Fixed decisions

Do not change these without asking the user.

- **No build step.** Native ES modules; Vue 3 browser ESM build with template compiler; components are `.js` modules with template strings (no `.vue` files, no TypeScript, no npm).
- **Vendored libraries only** (`vendor/`, resolved through the import map in `index.html`): Vue, vue-router in hash mode, vue-i18n, Leaflet, Leaflet-Geoman, the UI font. No CDN requests at runtime. Do not add a dependency without asking.
- **State** in small stores built on Vue `reactive`; no Pinia.
- **Persistence** in `localStorage` only, through `js/services/storage.js`. Garden documents carry a `schemaVersion`; any change to the stored format needs a migration and must keep older exports importable.
- **Stored values are metric and language-neutral** (metres, kilograms, ISO dates). Unit conversion and formatting happen only at display and input.
- **Geometry is stored in local metres** relative to the garden origin, not as latitude/longitude. Only the map component converts to Leaflet coordinates.
- **Layering:** views/components → stores → `js/logic` and `js/services`. Modules in `js/logic` are pure (no Vue, DOM, storage or network) and are the unit-tested core: geometry, units, climate, hints, rotation, companions, migrations.
- **Hints are derived, never stored.** Only the user's decision per task (done/skipped) is stored, under a deterministic task key.
- **No hard-coded UI text.** Every string, including plant names and hint texts, comes from `js/i18n/` and is added to all five languages in the same change.
- **Colours and spacing only through the tokens** in `css/tokens.css`; every component must work in light and dark theme, on phone and desktop widths.
- **External requests** are limited to map tiles and the Open-Meteo forecast; everything else works offline.
- Hosted on GitHub Pages as static files, so all paths are relative.
