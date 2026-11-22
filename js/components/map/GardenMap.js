// The garden drawn on a Leaflet map (docs/concept.md §7.4, docs/design-rules.md §6).
//
// This is the only code that knows about Leaflet coordinates: it converts stored
// metre geometry to layers and edited layers back to metre geometry. All changes
// leave the component as events; the parent writes them to the store.

import { ref, watch, onMounted, onBeforeUnmount } from 'vue';
import { useI18n } from 'vue-i18n';
import { loadLeaflet } from '../../services/leaflet.js';
import { createProjection, PLAN_ORIGIN, distance, centroid, edgeLengths, midpoint, polylineLength } from '../../logic/geometry.js';
import { ELEMENT_TYPES, DRAW_ORDER, normaliseGeometry, isUsablePolygon, elementsBounds, measure } from '../../logic/elements.js';
import { formatArea, formatLength } from '../../logic/units.js';
import { elementStyle, selectedStyle, measureStyle } from './styles.js';
import { createGridLayer } from './gridLayer.js';

const OSM_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
const MAX_ZOOM = 24;
const EARTH_CIRCUMFERENCE = 40075016.686;
const GEOMAN_LANGUAGES = { en: 'en', de: 'de', fr: 'fr', es: 'es', pt: 'pt_pt' };
const DRAW_SHAPES = { rectangle: 'Rectangle', polygon: 'Polygon', line: 'Line', measure: 'Line' };
const MIN_LABEL_EDGE_PX = 48;

export default {
  name: 'GardenMap',
  props: {
    garden: { type: Object, required: true },
    /** 'street' | 'plan' */
    background: { type: String, default: 'plan' },
    /** null or { type, draw: 'rectangle' | 'polygon' | 'line' | 'point' | 'measure' } */
    tool: { type: Object, default: null },
    selectedId: { type: String, default: null },
    /** 'shape' | 'move' | 'rotate' */
    editMode: { type: String, default: 'shape' },
    snapping: { type: Boolean, default: true },
    units: { type: String, default: 'metric' },
    locating: { type: Boolean, default: false },
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
    let elementGroup = null;
    let labelGroup = null;
    let measureGroup = null;
    let drawLabel = null;
    let projection = createProjection(props.garden.location ?? PLAN_ORIGIN);
    let projectionKey = JSON.stringify(props.garden.location);
    /** id → { layer, key, element } */
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

    function geometryFromLayer(layer, kind, width) {
      if (kind === 'circle') return { kind, center: toPoint(layer.getLatLng()), radius: layer.getRadius() };
      if (kind === 'line') return { kind, points: layer.getLatLngs().map(toPoint), width };
      const rings = layer.getLatLngs();
      const ring = Array.isArray(rings[0]) ? rings[0] : rings;
      return { kind: 'polygon', points: ring.map(toPoint) };
    }

    const keyOf = (element) => JSON.stringify([element.type, element.name, element.geometry]);

    // --- Layers --------------------------------------------------------------

    function lineWeight(width) {
      return Math.max(2, width / metresPerPixel());
    }

    function styleFor(element) {
      const style = elementStyle(element.type);
      if (element.geometry.kind === 'line') style.weight = lineWeight(element.geometry.width);
      return element.id === props.selectedId ? { ...style, ...selectedStyle(), weight: Math.max(style.weight ?? 2, 3) } : style;
    }

    function createLayer(element) {
      const { geometry } = element;
      // Clicks bubble to the map so that drawing on top of existing shapes works;
      // the click handler below stops them only when selecting.
      const options = { ...styleFor(element) };
      let layer;
      if (geometry.kind === 'circle') layer = L.circle(toLatLng(geometry.center), { ...options, radius: geometry.radius });
      else if (geometry.kind === 'line') layer = L.polyline(toLatLngs(geometry.points), options);
      else layer = L.polygon(toLatLngs(geometry.points), options);

      layer.on('click', (event) => {
        if (props.tool || props.locating) return;
        L.DomEvent.stopPropagation(event);
        emit('select', element.id);
      });
      // The name label is placed once; keep it on the shape while it changes
      const moveTooltip = () => {
        const tooltip = layer.getTooltip();
        if (tooltip && layer._map) tooltip.setLatLng(layer.getCenter ? layer.getCenter() : layer.getLatLng());
      };
      const live = () => {
        moveTooltip();
        updateMeasureLabels(layer, element);
      };
      layer.on('pm:change pm:markerdrag pm:drag pm:rotate', live);
      layer.on('pm:edit pm:dragend pm:rotateend', () => {
        moveTooltip();
        commit(element.id);
      });
      if (element.name && element.type !== 'parcel' && geometry.kind !== 'line') {
        // A text node, never an HTML string: names may come from imported files
        const content = document.createElement('span');
        content.textContent = element.name;
        layer.bindTooltip(content, { permanent: true, direction: 'center', className: 'map-name-label', interactive: false });
      }
      return layer;
    }

    function syncElements() {
      if (!map) return;
      const elements = [...props.garden.elements].sort((a, b) => DRAW_ORDER.indexOf(a.type) - DRAW_ORDER.indexOf(b.type));
      const seen = new Set();
      for (const element of elements) {
        seen.add(element.id);
        const key = keyOf(element);
        const entry = entries.get(element.id);
        if (entry && entry.key === key) {
          entry.element = element;
          continue;
        }
        if (entry) removeEntry(element.id);
        const layer = createLayer(element);
        elementGroup.addLayer(layer);
        entries.set(element.id, { layer, key, element });
      }
      for (const id of [...entries.keys()]) if (!seen.has(id)) removeEntry(id);
      // z-order follows the draw order
      for (const element of elements) entries.get(element.id)?.layer.bringToFront();
      applySelection(true);
    }

    function removeEntry(id) {
      const entry = entries.get(id);
      if (!entry) return;
      if (editedId === id) stopEditing();
      elementGroup.removeLayer(entry.layer);
      entries.delete(id);
    }

    function rebuildAll() {
      for (const id of [...entries.keys()]) removeEntry(id);
      syncElements();
    }

    function restyleAll() {
      for (const entry of entries.values()) entry.layer.setStyle(styleFor(entry.element));
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

    function applySelection(force = false) {
      if (!map) return;
      const id = props.tool || props.locating ? null : props.selectedId;
      if (!force && id === editedId) return;
      stopEditing();
      restyleAll();
      labelGroup.clearLayers();
      const entry = entries.get(id);
      if (!entry) return;
      const { layer, element } = entry;
      layer.bringToFront();
      const kind = element.geometry.kind;
      if (props.editMode === 'move') {
        // Shape mode stores draggable: false on the layer; enableLayerDrag checks it
        layer.pm.setOptions({ draggable: true, snappable: props.snapping });
        layer.pm.enableLayerDrag();
      } else if (props.editMode === 'rotate' && kind !== 'circle') {
        layer.pm.enableRotate();
      } else {
        layer.pm.enable({ allowSelfIntersection: false, snappable: props.snapping, draggable: false });
      }
      editedId = id;
      updateMeasureLabels(layer, element);
    }

    function commit(id) {
      const entry = entries.get(id);
      if (!entry) return;
      const { layer, element } = entry;
      const geometry = normaliseGeometry(geometryFromLayer(layer, element.geometry.kind, element.geometry.width));
      if (geometry.kind === 'polygon' && !isUsablePolygon(geometry.points)) {
        emit('invalid', 'polygon');
        entry.key = null; // forces a rebuild from the stored geometry
        syncElements();
        return;
      }
      const updated = { ...element, geometry };
      const key = keyOf(updated);
      if (key === entry.key) return;
      entry.key = key;
      entry.element = updated;
      emit('change', { id, geometry });
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

    function updateMeasureLabels(layer, element) {
      if (!map || element.id !== editedId) return;
      labelGroup.clearLayers();
      const kind = element.geometry.kind;
      const geometry = geometryFromLayer(layer, kind, element.geometry.width);
      const fmtLength = (value) => formatLength(value, props.units, locale.value);
      const pxPerMetre = 1 / metresPerPixel();
      if (kind === 'polygon') {
        const points = geometry.points;
        edgeLengths(points).forEach((length, i) => {
          if (length * pxPerMetre < MIN_LABEL_EDGE_PX) return;
          labelGroup.addLayer(label(toLatLng(midpoint(points[i], points[(i + 1) % points.length])), fmtLength(length)));
        });
        const area = measure({ geometry }).area;
        labelGroup.addLayer(label(toLatLng(centroid(points)), formatArea(area, props.units, locale.value), 'map-measure-label is-area'));
      } else if (kind === 'circle') {
        labelGroup.addLayer(label(toLatLng(geometry.center), `Ø ${fmtLength(geometry.radius * 2)}`, 'map-measure-label is-area'));
      } else {
        const points = geometry.points;
        const middle = points[Math.floor((points.length - 1) / 2)];
        const next = points[Math.floor((points.length - 1) / 2) + 1];
        labelGroup.addLayer(label(toLatLng(midpoint(middle, next)), fmtLength(polylineLength(points))));
      }
    }

    // --- Drawing ------------------------------------------------------------

    function drawOptions(tool) {
      const style = tool.draw === 'measure' ? measureStyle() : elementStyle(tool.type);
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
      applySelection(true);
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
      if (!tool) {
        map.removeLayer(layer);
        return;
      }
      if (tool.draw === 'measure') {
        map.removeLayer(layer);
        measureGroup.clearLayers();
        const points = layer.getLatLngs().map(toPoint);
        const length = polylineLength(points);
        const line = L.polyline(layer.getLatLngs(), { ...measureStyle(), interactive: false, pmIgnore: true, snapIgnore: true });
        measureGroup.addLayer(line);
        measureGroup.addLayer(label(layer.getLatLngs().at(-1), formatLength(length, props.units, locale.value), 'map-measure-label is-measure'));
        emit('measure', length);
        return;
      }
      const kind = ELEMENT_TYPES[tool.type].kind;
      const geometry = normaliseGeometry(geometryFromLayer(layer, kind, ELEMENT_TYPES[tool.type].width));
      map.removeLayer(layer);
      if (kind === 'polygon' && !isUsablePolygon(geometry.points)) {
        emit('invalid', 'polygon');
        return;
      }
      emit('create', { type: tool.type, geometry });
    }

    function onMapClick(event) {
      if (props.locating) return;
      const tool = props.tool;
      if (tool?.draw === 'point') {
        const radius = ELEMENT_TYPES[tool.type].diameter / 2;
        emit('create', { type: tool.type, geometry: normaliseGeometry({ kind: 'circle', center: toPoint(event.latlng), radius }) });
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
      let at = cursor ?? draw._hintMarker?.getLatLng();
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

    function fitGarden() {
      if (!map) return;
      const box = elementsBounds(props.garden.elements);
      if (!box) {
        map.setView(toLatLng([0, 0]), props.garden.location ? 19 : 21, { animate: false });
        return;
      }
      const bounds = L.latLngBounds([toLatLng([box.minX, box.minY]), toLatLng([box.maxX, box.maxY])]);
      map.fitBounds(bounds, { padding: [48, 48], maxZoom: 23, animate: false });
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
      elementGroup = L.featureGroup().addTo(map);
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
        const entry = entries.get(editedId);
        if (entry) updateMeasureLabels(entry.layer, entry.element);
      });

      applyControls();
      applyBackground();
      // The view must exist before layers are built: line widths depend on the scale
      fitGarden();
      syncElements();
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

    watch(() => props.garden.elements, () => syncElements(), { deep: true });
    watch(() => props.garden.location, () => {
      if (reproject() && props.garden.location) fitGarden();
    }, { deep: true });
    watch(() => props.garden.id, () => {
      reproject();
      rebuildAll();
      fitGarden();
    });
    watch(() => props.background, applyBackground);
    watch(() => props.tool, (tool) => startTool(tool));
    watch(() => [props.selectedId, props.editMode, props.locating], () => applySelection(true));
    watch(() => props.snapping, (snapping) => {
      if (!map) return;
      map.pm.setGlobalOptions({ snappable: snapping, snapDistance: 16 });
      if (props.tool) startTool(props.tool);
      applySelection(true);
    });
    watch(() => props.units, () => {
      applyControls();
      gridLayer?.redraw();
      applySelection(true);
    });
    watch(locale, applyControls);

    // --- API for the parent -------------------------------------------------

    return {
      t,
      container,
      failed,
      finishDraw: () => map?.pm.finishDraw(),
      fitGarden,
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
