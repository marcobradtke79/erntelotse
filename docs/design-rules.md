# Erntelotse – Design Rules

Rules for the look, behaviour and wording of the app. They apply to every view and component.

Related documents: [concept](concept.md) · [implementation plan](implementation-plan.md)

## 1. Principles

1. **Playful and colourful, but calm to work in.** Colour and illustration make the app friendly; the garden drawing and the task lists stay easy to read.
2. **The garden comes first.** On the map and in the bed editor the drawing gets the space; tools and panels stay at the edges and can be collapsed.
3. **Phone and desktop are equal.** Every function is usable with touch on a narrow screen and with mouse and keyboard on a wide one.
4. **Always say what to do next.** Empty states, hints and warnings name a concrete action.
5. **Never lose work.** Changes are saved automatically; destructive actions ask for confirmation or offer undo.

## 2. Colour

Colours are defined once as CSS custom properties in `css/tokens.css` and used only through these tokens. Components never contain literal colour values.

The values below are the starting palette. Every text/background pair must reach a contrast ratio of at least 4.5:1 (3:1 for large text and for graphic elements); values are adjusted where a check fails.

### 2.1 Base tokens

| Token | Light | Dark | Use |
|---|---|---|---|
| `--color-bg` | `#FFF9EC` | `#1B1D22` | Page background |
| `--color-surface` | `#FFFFFF` | `#262A31` | Cards, panels, dialogs |
| `--color-surface-alt` | `#F4EEDD` | `#30353E` | Secondary areas, table stripes |
| `--color-border` | `#E2D9C3` | `#424956` | Decorative dividers |
| `--color-border-strong` | `#8C8471` | `#7D8696` | Input and choice outlines (≥ 3:1) |
| `--color-text` | `#2B2A33` | `#F3F1EA` | Main text |
| `--color-text-muted` | `#66636F` | `#B4B1A8` | Secondary text |
| `--color-primary` | `#187533` | `#5FD07C` | Primary buttons, active navigation, links |
| `--color-on-primary` | `#FFFFFF` | `#10210F` | Text on primary |
| `--color-accent` | `#D9531A` | `#FF9A66` | Highlights, badges, illustrations |
| `--color-success` | `#187533` | `#5FD07C` | Done, good neighbour |
| `--color-warning` | `#8F5500` | `#FFC04D` | Rotation note, overdue |
| `--color-danger` | `#C62F3B` | `#FF7D86` | Delete, bad neighbour, frost |
| `--color-on-danger` | `#FFFFFF` | `#2A0D10` | Text on danger buttons |
| `--color-info` | `#1B64B0` | `#74B6FF` | Weather, neutral information |

The values were checked in milestone 1: all text colours reach 4.5:1 on `bg`, `surface` and `surface-alt`; graphic colours reach 3:1 on `surface`. `css/tokens.css` is the source of truth.

### 2.2 Task type colours

Each task type has a fixed colour and a fixed icon. Colour is never the only signal.

| Task | Token | Light | Dark | Icon |
|---|---|---|---|---|
| Sow | `--task-sow` | `#A67C00` | `#FFD54A` | seed |
| Plant out | `--task-plant` | `#2E9E4F` | `#6FD98A` | seedling |
| Care (earthing up, mulching, thinning) | `--task-care` | `#0F7F7F` | `#5ED1D1` | spade |
| Fertilize | `--task-fertilize` | `#A8622A` | `#E3A06A` | bag |
| Prune | `--task-prune` | `#8A4FD3` | `#BE97F5` | shears |
| Water | `--task-water` | `#1F86D6` | `#74B6FF` | watering can |
| Harvest | `--task-harvest` | `#D93A4A` | `#FF7D86` | basket |

### 2.3 Map element colours

| Element | Fill | Outline |
|---|---|---|
| Parcel | none | dashed, `--color-text` |
| Bed | warm brown `#B98A5A` at 35 % | `#8A5F33` |
| Planting area | plant colour at 55 % | plant colour, darker |
| Tree / shrub canopy | green `#3FA75A` at 35 % | `#2A7A40` |
| Lawn | light green `#A8DB8C` at 40 % | none |
| Pond | blue `#6FB7E8` at 60 % | `#3B8BC4` |
| Path | sand `#D9C7A3` | none |
| Building, greenhouse, compost | grey `#9A9AA5` at 60 % | `#6B6B76` |
| Fence / hedge | line, brown / green | – |

Every catalog plant has its own colour, used for planting areas and calendar bars. The map colours are tokens (`--map-*` in `css/tokens.css`) with light and dark values; `js/components/map/styles.js` reads them, and the map restyles when the theme changes. Line elements (path, fence, hedge) are drawn at their real width in metres.

### 2.4 Themes

Light and dark theme. The default follows the system setting; the user can force either in the settings. The theme is switched by a `data-theme` attribute on the root element that selects the token set. Both themes are checked for every new component.

## 3. Typography, spacing and shape

- **Font**: a rounded, friendly sans-serif (Nunito), vendored as a variable font file, with the system font stack as fallback. No fonts are loaded from external servers.
- **Sizes**: 14 px small, 16 px body, 20 px section heading, 26 px view title. Body text is never smaller than 14 px. Line height 1.5 for text, 1.2 for headings.
- **Weights**: 400 for text, 700 for headings and buttons, 800 for the view title.
- **Spacing scale**: 4, 8, 12, 16, 24, 32, 48 px, as tokens (`--space-1` … `--space-7`). No other spacing values.
- **Corners**: 8 px for inputs and chips, 16 px for cards and dialogs, fully round for icon buttons and the main action button.
- **Elevation**: two shadow levels – cards (soft) and floating elements such as dialogs and the tool palette (stronger). In the dark theme, elevation is shown with a lighter surface instead of a shadow.
- **Motion**: short and purposeful, 150–250 ms. Small rewards are welcome (a task chip that pops when ticked off). With `prefers-reduced-motion`, all motion is reduced to simple fades.

## 4. Icons and illustration

### 4.1 Plant icons

One SVG icon per catalog plant, in `assets/icons/plants/<plant-id>.svg`.

- Canvas 48 × 48, drawn on a 2 px grid, with 4 px clear space to the edge.
- Flat shapes with a 2 px rounded outline in a darker tone of the fill; at most four colours per icon; no gradients, no text.
- Slightly rounded, friendly proportions; the harvested part is shown (the carrot, not the leaves alone).
- Recognisable at 24 px; details that disappear at that size are left out.
- Each plant icon defines the plant's colour (section 2.3).
- Generic icons per category (leaf vegetable, root vegetable, fruit vegetable, herb, berry, tree, shrub, flower) are used for custom plants, tinted with a colour the user chooses.

### 4.2 UI icons

One consistent set of line icons (2 px stroke, round caps, 24 × 24), stored as SVG in `assets/icons/ui/` and coloured with `currentColor`. An icon without a visible text label needs an accessible name and a tooltip.

### 4.3 Illustration

Empty states and onboarding use simple illustrations built from the plant icons. Illustrations never carry information that is not also in the text.

## 5. Layout and navigation

| Width | Layout |
|---|---|
| below 720 px (phone) | Bottom navigation bar with Dashboard, Map, Calendar, Plants, More. Panels open as bottom sheets. One column. |
| 720–1100 px (tablet) | Narrow side rail with icons. Panels open as a side panel over the content. |
| above 1100 px (desktop) | Side navigation with icons and labels. Map with a permanent detail panel on the right. Dashboard in two or three columns. |

- The active garden and a garden switcher are always reachable from the header.
- The year switcher is part of the header in Map, Bed editor and Calendar and keeps its value when moving between these views.
- Content width in text views is limited to about 1100 px; the map always uses the full area.
- Touch targets are at least 44 × 44 px. Interactive elements are at least 8 px apart.
- The layout respects safe areas of phones (notch, home indicator) when installed.

## 6. Map and bed editor

- **Tools** sit in one palette: select, parcel, bed (rectangle / polygon), tree, shrub, other elements, measure. The palette is at the left edge on desktop and above the bottom navigation on phones. Exactly one tool is active; its button is clearly highlighted. After finishing a shape the tool returns to *select*.
- **Drawing**: tap or click to set points; finishing works by tapping the first point or a visible "Done" button, never only by double-click. A visible "Cancel" button and `Esc` abort.
- **Editing**: selecting a shape shows handles for vertices, move and rotate. Handles are at least 28 px on screen, with a 44 px touch area. Details and delete are in the panel for the selected shape.
- **Measurements**: while drawing and editing, edge lengths and the area are shown at the shape, in the user's units. Exact sizes can be typed into the detail panel.
- **Snapping** to vertices and edges of other shapes is on by default and can be switched off in the palette.
- **Undo and redo** are available for all drawing and editing steps, as buttons and as `Ctrl/Cmd+Z` and `Shift+Ctrl/Cmd+Z`.
- **Backgrounds**: a single switch for street map and grid (only shown when the garden has a location). Tile attribution is always visible on the street map.
- **Overlays never cover the middle of the map**: the place search lives in the side panel / bottom sheet, because the cross for placing the garden sits in the centre.
- **Labels**: beds show their name; planting areas show the plant icon, and the plant name when there is room. Labels never cover handles of the selected shape.
- **Year and date**: shapes of plantings outside the selected date are hidden; elements such as beds and trees are always visible. Past years are read-only until the user explicitly unlocks editing, to protect the history.
- **Feedback on rules**: rotation and companion results appear as badges on the planting (check, warning, cross with icon) and in words in the detail panel.
- **Gestures**: one finger pans, two fingers zoom; drawing never starts by accident while panning. On desktop the wheel zooms and dragging the background pans.

## 7. Components

- **Buttons**: one primary action per screen or dialog, filled with `--color-primary`. Secondary actions are outlined, tertiary ones are text only. Destructive actions use `--color-danger` and are never the default.
- **Cards** group one topic (a task group, the weather note, a bed summary) with a title, optional icon and at most one primary action.
- **Task chips** show the task icon in its colour, the plant icon, the plant name and the place. They have three states: open, done (checked, muted), skipped (struck through). Tapping the check marks it done; other options are in a menu.
- **Hint cards** on the dashboard contain: what, where, until when, and a short "why" text from the catalog.
- **Calendar cells** show up to three task markers and "+n" beyond that; today is outlined; tapping a day opens its task list. The year overview uses horizontal bars per planting, coloured by phase (sow, grow, harvest) with a pattern or icon in addition to colour.
- **Dialogs** are used for decisions and short forms only. On phones they are bottom sheets. They close with `Esc`, the close button and a tap on the backdrop, unless unsaved input would be lost.
- **Forms**: label above the field, units inside the field at the right, validation message below the field in words. Required fields are marked. Inputs save on change where possible instead of a separate save button.
- **Toasts** confirm completed actions and offer undo for deletions; they disappear after a few seconds and never contain the only copy of important information.
- **Empty states** have an illustration, one sentence and one action ("No beds yet – draw your first bed").
- **Warnings** state the problem and the remedy ("Tomatoes grew here in 2025. Wait until 2029 or choose another bed.").

## 8. Text and internationalisation

- No visible text is written in component code. Every string comes from the message modules through a key. This includes plant names, hint texts, error messages, tooltips and accessible names.
- Keys are English, lower camel case, grouped by area: `map.tools.bed`, `plants.tomato.name`, `hints.tomato.sideShoots`.
- A new key is added to all five languages (en, de, fr, es, pt) in the same change. English is the fallback and the reference.
- Texts are short, friendly and direct, addressing the user informally where the language distinguishes it (German "du", French "tu", Spanish "tú", Portuguese "você"). No exclamation marks in errors.
- Sentences are never assembled from fragments. Variables are inserted with placeholders, and plural forms use the plural support of the i18n library.
- Layouts tolerate text that is 40 % longer than English without clipping; text wraps rather than truncates, except in chips and navigation where a tooltip shows the full text.
- Dates, numbers and month names are formatted with `Intl` for the chosen language. Week numbers follow ISO weeks.
- Units follow the units setting: m / cm / m² / kg / °C / mm, or ft / in / sq ft / lb / oz / °F / in. Values are rounded sensibly for display (lengths to 1 cm or ½ in) and stored unrounded in metric.
- Botanical family names are shown in Latin with a translated common name.

## 9. Accessibility

- All functions outside free drawing can be used with the keyboard; focus order follows the visual order; the focused element has a clearly visible outline in both themes.
- For the map, every element and planting is also reachable through a list in the side panel, where it can be selected, edited by typing sizes and positions, and deleted.
- Semantic HTML first (`button`, `nav`, `main`, headings in order, lists, `label` for every input); ARIA only where HTML has no fitting element.
- Colour contrast as stated in section 2. Information is never conveyed by colour alone – task types, rule results and calendar phases always have an icon, pattern or text as well.
- Text can be enlarged to 200 % without loss of content or function.
- Status changes (saved, task done, import finished, errors) are announced to screen readers through a live region.
- Motion respects `prefers-reduced-motion`.
- The `lang` attribute of the document follows the chosen language.
