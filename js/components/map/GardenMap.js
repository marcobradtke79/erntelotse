// The garden drawn on a Leaflet map (docs/concept.md §7.4, docs/design-rules.md §6).
//
// This is the only code that knows about Leaflet coordinates: it converts stored
// metre geometry to layers and edited layers back to metre geometry. All changes
// leave the component as events; the parent writes them to the store.
//
// Two modes:
// - garden mode (focusBedId null): elements are selectable and editable; the
//   plantings of the shown period are drawn on the beds, not interactive.
// - bed mode (focusBedId set): the plantings of that bed are selectable and, unless
//   readOnly, editable; everything else is dimmed and not interactive.

import { ref, watch, onMounted, onBeforeUnmount } from 'vue';
import { useI18n } from 'vue-i18n';
import { loadLeaflet } from '../../services/leaflet.js';
import { createProjection, PLAN_ORIGIN, distance, centroid, edgeLengths, midpoint, polylineLength, bounds } from '../../logic/geometry.js';
import { ELEMENT_TYPES, DRAW_ORDER, normaliseGeometry, isUsablePolygon, elementsBounds, measure } from '../../logic/elements.js';
import { visiblePlantings, normaliseShape } from '../../logic/plantings.js';
import { plantById as getPlant, plantLabel } from '../../stores/catalog.js';
import { isKnownPlant } from '../../data/plants.js';
import { formatArea, formatLength } from '../../logic/units.js';
import { elementStyle, plantingStyle, selectedStyle, measureStyle } from './styles.js';
import { createGridLayer } from './gridLayer.js';

const OSM_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
const MAX_ZOOM = 24;
const EARTH_CIRCUMFERENCE = 40075016.686;
const GEOMAN_LANGUAGES = { en: 'en', de: 'de', fr: 'fr', es: 'es', pt: 'pt_pt' };
const DRAW_SHAPES = { rectangle: 'Rectangle', polygon: 'Polygon', line: 'Line', measure: 'Line' };
const MIN_LABEL_EDGE_PX = 48;
const MIN_PLANT_RADIUS = 0.05;
const PLANT_SPRITE = new URL('../../../assets/icons/plants/plants.svg', import.meta.url).href;
const SVG_NS = 'http://www.w3.org/2000/svg';

const UI_SPRITE = new URL('../../../assets/icons/ui/sprite.svg', import.meta.url).href;
const BADGE_ICONS = { good: 'check', bad: 'close', rotation: 'alert' };

/** Small round badge with an icon (colour is never the only signal). */
function badgeElement(kind) {
  const badge = document.createElement('span');
  badge.className = `map-badge is-${kind}`;
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'icon');
  svg.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS(SVG_NS, 'use');
  use.setAttribute('href', `${UI_SPRITE}#${BADGE_ICONS[kind]}`);
  svg.append(use);
  badge.append(svg);
  return badge;
}

/** Plant icon as an SVG element (map labels are built outside Vue). */
function plantIconElement(plantId) {
  const plant = getPlant(plantId);
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 48 48');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', 'map-plant-icon');
  const use = document.createElementNS(SVG_NS, 'use');
  if (isKnownPlant(plantId)) {
    use.setAttribute('href', `${PLANT_SPRITE}#plant-${plantId}`);
  } else {
    use.setAttribute('href', `${PLANT_SPRITE}#category-${plant.category ?? 'vegetable'}`);
    svg.style.color = plant.color;
  }
  svg.append(use);
  return svg;
}

export default {
  name: 'GardenMap',
  props: {
    garden: { type: Object, required: true },
    /** 'street' | 'plan' */
    background: { type: String, default: 'plan' },
    /** null or { type, draw: 'rectangle' | 'polygon' | 'line' | 'point' | 'measure', plantId? } */
    tool: { type: Object, default: null },
    selectedId: { type: String, default: null },
    /** 'shape' | 'move' | 'rotate' */
    editMode: { type: String, default: 'shape' },
    snapping: { type: Boolean, default: true },
    units: { type: String, default: 'metric' },
    locating: { type: Boolean, default: false },
    /** { year, day } – which plantings are drawn */
    period: { type: Object, required: true },
    /** Bed mode: the bed whose plantings are edited */
    focusBedId: { type: String, default: null },
    /** Bed mode: plantings can be selected but not changed */
    readOnly: { type: Boolean, default: false },
    /** Bed mode: plantingId → ['good' | 'bad' | 'rotation'] shown on the labels */
    badges: { type: Object, default: () => ({}) },
  },
  emits: ['create', 'change', 'select', 'draw-end', 'measure', 'invalid', 'ready'],
  setup(props, { emit }) {
    const { t, locale } = useI18n();
    const container = ref(null);
    const failed = ref(false);

    let L = null;
    let map = null;
    let tileLayer = null;
    let gridLayer = null;
    let scaleControl = null;
    let zoomControl = null;
    let itemGroup = null;
    let labelGroup = null;
    let measureGroup = null;
    let drawLabel = null;
    let projection = createProjection(props.garden.location ?? PLAN_ORIGIN);
    let projectionKey = JSON.stringify(props.garden.location);
    /** id → { layer, key, item } */
    const entries = new Map();
    let editedId = null;
    let stoppingDraw = false;
    let themeObserver = null;
    let resizeObserver = null;
    let destroyed = false;

    // --- Coordinates ---------------------------------------------------------

    const toLatLng = (point) => projection.toLatLng(point);
    const toLatLngs = (points) => points.map(toLatLng);
    const toPoint = (latLng) => projection.toPoint(latLng);

    function metresPerPixel() {
      const center = map.getCenter();
      return (EARTH_CIRCUMFERENCE * Math.cos((center.lat * Math.PI) / 180)) / (256 * 2 ** map.getZoom());
    }

    function geometryFromLayer(layer, geometry) {
      if (geometry.kind === 'point') return { kind: 'point', at: toPoint(layer.getLatLng()) };
      if (geometry.kind === 'circle') return { kind: 'circle', center: toPoint(layer.getLatLng()), radius: layer.getRadius() };
      if (geometry.kind === 'line') return { kind: 'line', points: layer.getLatLngs().map(toPoint), width: geometry.width };
      const rings = layer.getLatLngs();
      const ring = Array.isArray(rings[0]) ? rings[0] : rings;
      return { kind: 'polygon', points: ring.map(toPoint) };
    }

    // --- Items: everything drawn, with what may be done with it ---------------

    function buildItems() {
      const focus = props.focusBedId;
      const items = [];
      const elements = [...props.garden.elements].sort((a, b) => DRAW_ORDER.indexOf(a.type) - DRAW_ORDER.indexOf(b.type));
      for (const element of elements) {
        items.push({
          id: element.id,
          source: 'element',
          type: element.type,
          // The focused bed's name is in the panel; on the map it would cover its plantings
          name: element.name && element.type !== 'parcel' && element.geometry.kind !== 'line' && element.id !== focus ? element.name : '',
          geometry: element.geometry,
          selectable: !focus,
          editable: !focus,
          dimmed: Boolean(focus) && element.id !== focus,
          focused: element.id === focus,
        });
      }
      const plantings = visiblePlantings(props.garden.plantings, props.period)
        .sort((a, b) => (a.shape.kind === b.shape.kind ? a.start.localeCompare(b.start) : a.shape.kind === 'point' ? 1 : -1));
      for (const planting of plantings) {
        const plant = getPlant(planting.plantId);
        const own = Boolean(focus) && planting.bedId === focus;
        items.push({
          id: planting.id,
          source: 'planting',
          type: 'planting',
          plantId: planting.plantId,
          color: plant.color,
          name: own && planting.shape.kind === 'polygon' ? plantLabel(plant, t) : '',
          // Single plants get an icon-only label in the bed editor
          icon: own,
          badges: own ? props.badges[planting.id] ?? [] : [],
          geometry: planting.shape.kind === 'point'
            ? { kind: 'point', at: planting.shape.at, radius: Math.max(MIN_PLANT_RADIUS, plant.spacing.plant / 2) }
            : planting.shape,
          selectable: own,
          editable: own && !props.readOnly,
          dimmed: Boolean(focus) && !own,
          focused: false,
        });
      }
      return items;
    }

    const keyOf = (item) => JSON.stringify([
      item.source, item.type, item.plantId, item.color, item.name, item.icon, item.badges, item.geometry, item.selectable, item.editable, item.dimmed, item.focused,
    ]);

    // --- Layers --------------------------------------------------------------

    function lineWeight(width) {
      return Math.max(2, width / metresPerPixel());
    }

    function styleFor(item) {
      let style = item.source === 'planting' ? plantingStyle(item.color, item.geometry.kind) : elementStyle(item.type);
      if (item.geometry.kind === 'line') style.weight = lineWeight(item.geometry.width);
      if (item.focused) style = { ...style, weight: 3 };
      if (item.dimmed) style = { ...style, opacity: (style.opacity ?? 1) * 0.35, fillOpacity: (style.fillOpacity ?? 1) * 0.35 };
      if (item.id === props.selectedId && item.selectable) {
        style = { ...style, ...selectedStyle(), weight: Math.max(style.weight ?? 2, 3) };
      }
      return { ...style, interactive: item.selectable };
    }

    function createLayer(item) {
      const { geometry } = item;
      // Clicks bubble to the map so that drawing on top of existing shapes works;
      // the click handler below stops them only when selecting.
      const options = styleFor(item);
      let layer;
      if (geometry.kind === 'circle') layer = L.circle(toLatLng(geometry.center), { ...options, radius: geometry.radius });
      else if (geometry.kind === 'point') layer = L.circle(toLatLng(geometry.at), { ...options, radius: geometry.radius });
      else if (geometry.kind === 'line') layer = L.polyline(toLatLngs(geometry.points), options);
      else layer = L.polygon(toLatLngs(geometry.points), options);
      // Shapes that cannot be edited must not be snap targets for Geoman either way they are drawn
      if (!item.selectable && item.source === 'planting') layer.options.snapIgnore = true;

      layer.on('click', (event) => {
        if (props.tool || props.locating || !item.selectable) return;
        L.DomEvent.stopPropagation(event);
        emit('select', item.id);
      });
      // The name label is placed once; keep it on the shape while it changes
      const moveTooltip = () => {
        const tooltip = layer.getTooltip();
        if (tooltip && layer._map) tooltip.setLatLng(layer.getCenter ? layer.getCenter() : layer.getLatLng());
      };
      layer.on('pm:change pm:markerdrag pm:drag pm:rotate', () => {
        moveTooltip();
        updateMeasureLabels(item.id);
      });
      layer.on('pm:edit pm:dragend pm:rotateend', () => {
        moveTooltip();
        commit(item.id);
      });
      if (item.name || item.icon) {
        // A text node, never an HTML string: names may come from imported files
        const content = document.createElement('span');
        if (item.icon) content.append(plantIconElement(item.plantId));
        if (item.name) content.append(document.createTextNode(item.name));
        for (const badge of item.badges ?? []) content.append(badgeElement(badge));
        layer.bindTooltip(content, {
          permanent: true,
          direction: 'center',
          className: item.source === 'planting' ? 'map-name-label is-planting' : 'map-name-label',
          interactive: false,
          opacity: item.dimmed ? 0.4 : 0.95,
        });
      }
      return layer;
    }

    function sync() {
      if (!map) return;
      const items = buildItems();
      const seen = new Set();
      for (const item of items) {
        seen.add(item.id);
        const key = keyOf(item);
        const entry = entries.get(item.id);
        if (entry && entry.key === key) {
          entry.item = item;
          continue;
        }
        if (entry) removeEntry(item.id);
        const layer = createLayer(item);
        itemGroup.addLayer(layer);
        entries.set(item.id, { layer, key, item });
      }
      for (const id of [...entries.keys()]) if (!seen.has(id)) removeEntry(id);
      // z-order: elements by draw order, then plantings on top, the focused bed below its plantings
      for (const item of items) entries.get(item.id)?.layer.bringToFront();
      applySelection(true);
    }

    function removeEntry(id) {
      const entry = entries.get(id);
      if (!entry) return;
      if (editedId === id) stopEditing();
      itemGroup.removeLayer(entry.layer);
      entries.delete(id);
    }

    function rebuildAll() {
      for (const id of [...entries.keys()]) removeEntry(id);
      sync();
    }

    function restyleAll() {
      for (const entry of entries.values()) entry.layer.setStyle(styleFor(entry.item));
    }

    // --- Selection and editing ----------------------------------------------

    function stopEditing() {
      const entry = entries.get(editedId);
      if (entry) {
        const { layer } = entry;
        layer.pm?.disable();
        layer.pm?.disableLayerDrag?.();
        if (layer.pm?.rotateEnabled?.()) layer.pm.disableRotate();
      }
      editedId = null;
    }

    function applySelection() {
      if (!map) return;
      stopEditing();
      restyleAll();
      labelGroup.clearLayers();
      const id = props.tool || props.locating ? null : props.selectedId;
      const entry = entries.get(id);
      if (!entry || !entry.item.selectable) return;
      const { layer, item } = entry;
      layer.bringToFront();
      editedId = id;
      if (item.editable) {
        const kind = item.geometry.kind;
        if (props.editMode === 'move' || kind === 'point') {
          // Shape mode stores draggable: false on the layer; enableLayerDrag checks it
          layer.pm.setOptions({ draggable: true, snappable: props.snapping });
          layer.pm.enableLayerDrag();
        } else if (props.editMode === 'rotate' && kind !== 'circle') {
          layer.pm.enableRotate();
        } else {
          layer.pm.enable({ allowSelfIntersection: false, snappable: props.snapping, draggable: false });
        }
      }
      updateMeasureLabels(id);
    }

    function commit(id) {
      const entry = entries.get(id);
      if (!entry) return;
      const { layer, item } = entry;
      const raw = geometryFromLayer(layer, item.geometry);
      if (raw.kind === 'polygon' && !isUsablePolygon(raw.points)) {
        emit('invalid', 'polygon');
        refresh(id);
        return;
      }
      if (item.source === 'planting') {
        const shape = normaliseShape(raw);
        if (JSON.stringify(shape) === JSON.stringify(item.geometry.kind === 'point' ? { kind: 'point', at: item.geometry.at } : item.geometry)) return;
        emit('change', { id, source: 'planting', shape });
        return;
      }
      const geometry = normaliseGeometry(raw);
      if (JSON.stringify(geometry) === JSON.stringify(item.geometry)) return;
      emit('change', { id, source: 'element', geometry });
    }

    /** Rebuilds a layer from the stored data, e.g. after the parent rejected a change. */
    function refresh(id) {
      const entry = entries.get(id);
      if (entry) entry.key = null;
      sync();
    }

    // --- Measurement labels --------------------------------------------------

    function labelIcon(text, className) {
      const html = document.createElement('span');
      html.textContent = text;
      return L.divIcon({ className, html, iconSize: null });
    }

    function label(latLng, text, className = 'map-measure-label') {
      return L.marker(latLng, {
        icon: labelIcon(text, className),
        interactive: false,
        keyboard: false,
        pmIgnore: true,
        snapIgnore: true,
      });
    }

    function updateMeasureLabels(id) {
      if (!map || id !== editedId) return;
      const entry = entries.get(id);
      if (!entry) return;
      labelGroup.clearLayers();
      const geometry = geometryFromLayer(entry.layer, entry.item.geometry);
      const fmtLength = (value) => formatLength(value, props.units, locale.value);
      const pxPerMetre = 1 / metresPerPixel();
      if (geometry.kind === 'polygon') {
        const points = geometry.points;
        edgeLengths(points).forEach((length, i) => {
          if (length * pxPerMetre < MIN_LABEL_EDGE_PX) return;
          labelGroup.addLayer(label(toLatLng(midpoint(points[i], points[(i + 1) % points.length])), fmtLength(length)));
        });
        const area = measure({ geometry }).area;
        labelGroup.addLayer(label(toLatLng(centroid(points)), formatArea(area, props.units, locale.value), 'map-measure-label is-area'));
      } else if (geometry.kind === 'circle') {
        labelGroup.addLayer(label(toLatLng(geometry.center), `Ø ${fmtLength(geometry.radius * 2)}`, 'map-measure-label is-area'));
      } else if (geometry.kind === 'line') {
        const points = geometry.points;
        const middle = points[Math.floor((points.length - 1) / 2)];
        const next = points[Math.floor((points.length - 1) / 2) + 1];
        labelGroup.addLayer(label(toLatLng(midpoint(middle, next)), fmtLength(polylineLength(points))));
      }
    }

    // --- Drawing ------------------------------------------------------------

    function toolStyle(tool) {
      if (tool.draw === 'measure') return measureStyle();
      if (ELEMENT_TYPES[tool.type]) return elementStyle(tool.type);
      return plantingStyle(getPlant(tool.plantId).color, 'polygon');
    }

    function drawOptions(tool) {
      const style = toolStyle(tool);
      if (tool.draw === 'line' || tool.draw === 'measure') style.weight = Math.max(3, style.weight ?? 3);
      return {
        snappable: props.snapping,
        snapDistance: 16,
        allowSelfIntersection: false,
        continueDrawing: tool.draw === 'measure',
        pathOptions: style,
        templineStyle: style,
        hintlineStyle: { ...style, dashArray: '5 5' },
        markerStyle: { draggable: false },
      };
    }

    function stopDrawing() {
      if (!map) return;
      if (map.pm.Draw.getActiveShape()) {
        // Not a user action: the parent must not treat this as the end of its tool
        stoppingDraw = true;
        map.pm.disableDraw();
        stoppingDraw = false;
      }
      measureGroup.clearLayers();
      removeDrawLabel();
      container.value?.classList.remove('is-placing');
    }

    function startTool(tool) {
      stopDrawing();
      applySelection();
      if (!tool || !map) return;
      if (tool.draw === 'point') {
        container.value.classList.add('is-placing');
        return;
      }
      map.pm.enableDraw(DRAW_SHAPES[tool.draw], drawOptions(tool));
    }

    function onCreate(event) {
      const tool = props.tool;
      const layer = event.layer;
      map.removeLayer(layer);
      if (!tool) return;
      if (tool.draw === 'measure') {
        measureGroup.clearLayers();
        const points = layer.getLatLngs().map(toPoint);
        const length = polylineLength(points);
        const line = L.polyline(layer.getLatLngs(), { ...measureStyle(), interactive: false, pmIgnore: true, snapIgnore: true });
        measureGroup.addLayer(line);
        measureGroup.addLayer(label(layer.getLatLngs().at(-1), formatLength(length, props.units, locale.value), 'map-measure-label is-measure'));
        emit('measure', length);
        return;
      }
      const config = ELEMENT_TYPES[tool.type];
      const kind = config?.kind ?? 'polygon';
      const raw = geometryFromLayer(layer, { kind, width: config?.width });
      if (kind === 'polygon' && !isUsablePolygon(raw.points)) {
        emit('invalid', 'polygon');
        return;
      }
      emit('create', { type: tool.type, geometry: config ? normaliseGeometry(raw) : normaliseShape(raw) });
    }

    function onMapClick(event) {
      if (props.locating) return;
      const tool = props.tool;
      if (tool?.draw === 'point') {
        const config = ELEMENT_TYPES[tool.type];
        const at = toPoint(event.latlng);
        const geometry = config
          ? normaliseGeometry({ kind: 'circle', center: at, radius: config.diameter / 2 })
          : normaliseShape({ kind: 'point', at });
        emit('create', { type: tool.type, geometry });
        return;
      }
      if (!tool) emit('select', null);
    }

    function removeDrawLabel() {
      if (drawLabel) {
        map.removeLayer(drawLabel);
        drawLabel = null;
      }
    }

    /** Length of the segment being drawn, next to the cursor. */
    function updateDrawLabel(cursor) {
      const shape = map.pm.Draw.getActiveShape();
      if (!shape) return removeDrawLabel();
      const draw = map.pm.Draw[shape];
      let text = null;
      const at = cursor ?? draw._hintMarker?.getLatLng();
      try {
        if (shape === 'Rectangle' && draw._startMarker && draw._map?.hasLayer(draw._startMarker) && at) {
          const a = toPoint(draw._startMarker.getLatLng());
          const b = toPoint(at);
          text = `${formatLength(Math.abs(b[0] - a[0]), props.units, locale.value)} × ${formatLength(Math.abs(b[1] - a[1]), props.units, locale.value)}`;
        } else if (draw._layer?.getLatLngs) {
          const latLngs = draw._layer.getLatLngs();
          if (latLngs.length > 0 && at) {
            const points = latLngs.map(toPoint);
            const segment = distance(points.at(-1), toPoint(at));
            const total = polylineLength(points) + segment;
            text = formatLength(segment, props.units, locale.value);
            if (props.tool?.draw === 'measure' && points.length > 1) text += ` · Σ ${formatLength(total, props.units, locale.value)}`;
          }
        }
      } catch {
        text = null;
      }
      if (!text || !at) return removeDrawLabel();
      if (!drawLabel) {
        drawLabel = label(at, text, 'map-measure-label is-drawing').addTo(map);
      } else {
        drawLabel.setLatLng(at);
        drawLabel.setIcon(labelIcon(text, 'map-measure-label is-drawing'));
      }
    }

    // --- Background, controls, view --------------------------------------

    function applyBackground() {
      if (!map) return;
      const street = props.background === 'street';
      if (street) {
        if (gridLayer && map.hasLayer(gridLayer)) map.removeLayer(gridLayer);
        if (!map.hasLayer(tileLayer)) tileLayer.addTo(map);
      } else {
        if (map.hasLayer(tileLayer)) map.removeLayer(tileLayer);
        if (!map.hasLayer(gridLayer)) gridLayer.addTo(map);
      }
      container.value?.classList.toggle('is-plan', !street);
    }

    function applyControls() {
      if (!map) return;
      scaleControl?.remove();
      zoomControl?.remove();
      zoomControl = L.control.zoom({ position: 'bottomright', zoomInTitle: t('map.zoomIn'), zoomOutTitle: t('map.zoomOut') }).addTo(map);
      scaleControl = L.control.scale({ position: 'bottomleft', metric: props.units !== 'imperial', imperial: props.units === 'imperial' }).addTo(map);
      map.pm.setLang(GEOMAN_LANGUAGES[locale.value] ?? 'en');
    }

    /** Shows the whole garden, or in bed mode the bed. */
    function fitGarden() {
      if (!map) return;
      const focus = props.garden.elements.find((element) => element.id === props.focusBedId);
      const box = focus ? bounds(focus.geometry.points) : elementsBounds(props.garden.elements);
      if (!box) {
        map.setView(toLatLng([0, 0]), props.garden.location ? 19 : 21, { animate: false });
        return;
      }
      const latLngBounds = L.latLngBounds([toLatLng([box.minX, box.minY]), toLatLng([box.maxX, box.maxY])]);
      map.fitBounds(latLngBounds, { padding: [48, 48], maxZoom: focus ? MAX_ZOOM : 23, animate: false });
    }

    function reproject() {
      const key = JSON.stringify(props.garden.location);
      if (key === projectionKey) return false;
      projectionKey = key;
      projection = createProjection(props.garden.location ?? PLAN_ORIGIN);
      rebuildAll();
      gridLayer?.redraw();
      return true;
    }

    // --- Lifecycle ------------------------------------------------------------

    onMounted(async () => {
      try {
        L = await loadLeaflet();
      } catch (error) {
        console.error(error);
        failed.value = true;
        return;
      }
      if (destroyed) return;
      map = L.map(container.value, {
        zoomControl: false,
        maxZoom: MAX_ZOOM,
        minZoom: 3,
        zoomSnap: 0.5,
        doubleClickZoom: false,
        boxZoom: false,
      });
      map.attributionControl.setPrefix('<a href="https://leafletjs.com">Leaflet</a>');
      tileLayer = L.tileLayer(OSM_URL, { maxNativeZoom: 19, maxZoom: MAX_ZOOM, attribution: OSM_ATTRIBUTION });
      gridLayer = createGridLayer(L, () => projection, () => props.units);
      itemGroup = L.featureGroup().addTo(map);
      measureGroup = L.layerGroup().addTo(map);
      labelGroup = L.layerGroup().addTo(map);
      map.pm.setGlobalOptions({ snappable: props.snapping, snapDistance: 16 });

      map.on('pm:create', onCreate);
      map.on('pm:drawend', () => {
        removeDrawLabel();
        if (!stoppingDraw) emit('draw-end');
      });
      map.on('pm:drawstart', ({ workingLayer }) => {
        workingLayer?.on?.('pm:vertexadded', () => updateDrawLabel());
      });
      map.on('mousemove', (event) => {
        if (map.pm.Draw.getActiveShape()) updateDrawLabel(event.latlng);
      });
      map.on('click', onMapClick);
      map.on('zoomend', () => {
        restyleAll();
        updateMeasureLabels(editedId);
      });

      applyControls();
      applyBackground();
      // The view must exist before layers are built: line widths depend on the scale
      fitGarden();
      sync();
      startTool(props.tool);

      resizeObserver = new ResizeObserver(() => map?.invalidateSize());
      resizeObserver.observe(container.value);
      themeObserver = new MutationObserver(() => {
        restyleAll();
        gridLayer.redraw();
      });
      themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
      emit('ready');
    });

    onBeforeUnmount(() => {
      destroyed = true;
      resizeObserver?.disconnect();
      themeObserver?.disconnect();
      if (map) {
        stopEditing();
        map.remove();
        map = null;
      }
    });

    watch(() => [props.garden.elements, props.garden.plantings, props.garden.customPlants, props.garden.plantOverrides], () => sync(), { deep: true });
    watch(() => [props.period.year, props.period.day, props.focusBedId, props.readOnly], () => sync());
    watch(() => props.badges, () => sync(), { deep: true });
    watch(() => props.garden.location, () => {
      if (reproject() && props.garden.location) fitGarden();
    }, { deep: true });
    watch(() => props.garden.id, () => {
      reproject();
      rebuildAll();
      fitGarden();
    });
    watch(() => props.focusBedId, () => fitGarden());
    watch(() => props.background, applyBackground);
    watch(() => props.tool, (tool) => startTool(tool), { deep: true });
    watch(() => [props.selectedId, props.editMode, props.locating], () => applySelection());
    watch(() => props.snapping, (snapping) => {
      if (!map) return;
      map.pm.setGlobalOptions({ snappable: snapping, snapDistance: 16 });
      if (props.tool) startTool(props.tool);
      applySelection();
    });
    watch(() => props.units, () => {
      applyControls();
      gridLayer?.redraw();
      applySelection();
    });
    watch(locale, () => {
      applyControls();
      sync();
    });

    // --- API for the parent -------------------------------------------------

    return {
      t,
      container,
      failed,
      finishDraw: () => map?.pm.finishDraw(),
      fitGarden,
      refresh,
      /** Centre of the view in garden metres */
      centerPoint: () => (map ? toPoint(map.getCenter()) : [0, 0]),
      /** Centre of the view as latitude/longitude */
      centerLatLng: () => map?.getCenter() ?? null,
      // A hard view reset, not flyTo: after long animated jumps (e.g. from the plan
      // origin at 0°/0° to a real place) Leaflet keeps tile levels with huge pixel
      // offsets, which breaks tile positioning. A reset discards them.
      flyTo: (lat, lng, zoom = 19) => map?.setView([lat, lng], zoom, { animate: false }),
      zoom: () => map?.getZoom() ?? 0,
    };
  },
  template: `
    <div class="garden-map" :class="{ 'is-locating': locating }">
      <!-- No class bindings here: Leaflet owns this element's classes and Vue would overwrite them -->
      <div ref="container" class="garden-map-canvas"></div>
      <div v-if="locating" class="map-crosshair" aria-hidden="true"></div>
      <p v-if="failed" class="map-error" role="alert">{{ t('map.loadFailed') }}</p>
    </div>
  `,
};
