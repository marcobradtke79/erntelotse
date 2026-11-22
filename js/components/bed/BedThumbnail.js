// Small picture of a bed with its plantings (bed history).

import { computed } from 'vue';
import { bounds } from '../../logic/geometry.js';
import { plantById as getPlant } from '../../stores/catalog.js';

const WIDTH = 96;
const HEIGHT = 64;
const PADDING = 4;

export default {
  name: 'BedThumbnail',
  props: {
    bedPoints: { type: Array, required: true },
    plantings: { type: Array, required: true },
  },
  setup(props) {
    const view = computed(() => {
      const box = bounds(props.bedPoints);
      const scale = Math.min((WIDTH - 2 * PADDING) / Math.max(box.maxX - box.minX, 0.01), (HEIGHT - 2 * PADDING) / Math.max(box.maxY - box.minY, 0.01));
      const offsetX = (WIDTH - (box.maxX - box.minX) * scale) / 2;
      const offsetY = (HEIGHT - (box.maxY - box.minY) * scale) / 2;
      // SVG y grows downwards, garden y grows north
      const project = ([x, y]) => [offsetX + (x - box.minX) * scale, HEIGHT - offsetY - (y - box.minY) * scale];
      const path = (points) => `M${points.map((point) => project(point).map((value) => value.toFixed(1)).join(' ')).join('L')}Z`;
      return {
        bed: path(props.bedPoints),
        areas: props.plantings.filter((p) => p.shape.kind === 'polygon').map((p) => ({ id: p.id, d: path(p.shape.points), color: getPlant(p.plantId).color })),
        points: props.plantings.filter((p) => p.shape.kind === 'point').map((p) => {
          const [cx, cy] = project(p.shape.at);
          return { id: p.id, cx, cy, r: Math.max(1.5, (getPlant(p.plantId).spacing.plant / 2) * scale), color: getPlant(p.plantId).color };
        }),
      };
    });
    return { view, WIDTH, HEIGHT };
  },
  template: `
    <svg class="bed-thumbnail" :viewBox="'0 0 ' + WIDTH + ' ' + HEIGHT" :width="WIDTH" :height="HEIGHT" aria-hidden="true" focusable="false">
      <path :d="view.bed" class="bed-thumbnail-bed" />
      <path v-for="area in view.areas" :key="area.id" :d="area.d" :style="{ fill: area.color, stroke: area.color }" class="bed-thumbnail-area" />
      <circle v-for="point in view.points" :key="point.id" :cx="point.cx" :cy="point.cy" :r="point.r" :style="{ fill: point.color }" />
    </svg>
  `,
};
