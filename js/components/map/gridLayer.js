// Metre (or foot) grid aligned with the garden's local coordinates, drawn per tile on canvas.

import { M_PER_FT } from '../../logic/units.js';
import { gridColors } from './styles.js';

const METRIC_STEPS = [0.1, 0.25, 0.5, 1, 2, 5, 10, 25, 50, 100, 250, 500, 1000];
const IMPERIAL_STEPS = [0.5, 1, 2, 5, 10, 25, 50, 100, 250, 500, 1000, 2500].map((ft) => ft * M_PER_FT);
const MIN_SPACING_PX = 18;

/** Grid step in metres for a scale; major lines every 5 or 4 steps. */
export function gridStep(metresPerPixel, units) {
  const steps = units === 'imperial' ? IMPERIAL_STEPS : METRIC_STEPS;
  const step = steps.find((candidate) => candidate / metresPerPixel >= MIN_SPACING_PX) ?? steps[steps.length - 1];
  const index = steps.indexOf(step);
  const majorEvery = units === 'imperial' && index <= 1 ? 4 : 5;
  return { step, majorEvery };
}

/**
 * @param L         Leaflet namespace
 * @param getProjection () => projection from js/logic/geometry.js
 * @param getUnits  () => 'metric' | 'imperial'
 */
export function createGridLayer(L, getProjection, getUnits) {
  const GridLayer = L.GridLayer.extend({
    createTile(coords) {
      const tile = document.createElement('canvas');
      const size = this.getTileSize();
      const ratio = window.devicePixelRatio || 1;
      tile.width = size.x * ratio;
      tile.height = size.y * ratio;
      const context = tile.getContext('2d');
      context.scale(ratio, ratio);

      const map = this._map;
      const projection = getProjection();
      const zoom = coords.z;
      const nwPixel = coords.scaleBy(size);
      const toPoint = (pixel) => projection.toPoint(map.unproject(pixel, zoom));
      // Local coordinates are linear within a tile
      const origin = toPoint(nwPixel);
      const right = toPoint(nwPixel.add([size.x, 0]));
      const down = toPoint(nwPixel.add([0, size.y]));
      const metresPerPixelX = (right[0] - origin[0]) / size.x;
      const metresPerPixelY = (down[1] - origin[1]) / size.y; // negative: y grows north
      if (!Number.isFinite(metresPerPixelX) || metresPerPixelX <= 0) return tile;

      const { step, majorEvery } = gridStep(metresPerPixelX, getUnits());
      const colors = gridColors();
      const drawLines = (start, end, toPixel, drawLine) => {
        const first = Math.ceil(Math.min(start, end) / step);
        const last = Math.floor(Math.max(start, end) / step);
        for (let k = first; k <= last; k++) {
          const major = k % majorEvery === 0;
          context.strokeStyle = major ? colors.major : colors.minor;
          context.lineWidth = major ? 1.5 : 1;
          const pixel = Math.round(toPixel(k * step)) + 0.5;
          context.beginPath();
          drawLine(pixel);
          context.stroke();
        }
      };
      // Vertical lines (constant x)
      drawLines(origin[0], right[0], (x) => (x - origin[0]) / metresPerPixelX, (px) => {
        context.moveTo(px, 0);
        context.lineTo(px, size.y);
      });
      // Horizontal lines (constant y)
      drawLines(origin[1], down[1], (y) => (y - origin[1]) / metresPerPixelY, (py) => {
        context.moveTo(0, py);
        context.lineTo(size.x, py);
      });
      return tile;
    },
  });
  return new GridLayer({ maxZoom: 26, zIndex: 1, updateWhenZooming: false });
}
