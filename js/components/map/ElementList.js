// All elements of the garden as a list: the keyboard-accessible way to reach every shape.

import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import AppIcon from '../AppIcon.js';
import { TYPE_ICONS } from './ToolPalette.js';
import { elementName, elementSummary } from './elementText.js';
import { touchesYear } from '../../logic/plantings.js';

const LIST_ORDER = ['parcel', 'bed', 'tree', 'shrub', 'greenhouse', 'building', 'compost', 'pond', 'lawn', 'path', 'hedge', 'fence'];

export default {
  name: 'ElementList',
  components: { AppIcon },
  props: {
    elements: { type: Array, required: true },
    units: { type: String, default: 'metric' },
    /** Plantings of the garden and the shown year: bed rows tell how many they hold */
    plantings: { type: Array, default: () => [] },
    year: { type: Number, default: null },
  },
  emits: ['select', 'add'],
  setup(props) {
    const { t, locale } = useI18n();
    const sorted = computed(() => [...props.elements].sort((a, b) =>
      LIST_ORDER.indexOf(a.type) - LIST_ORDER.indexOf(b.type) ||
      elementName(a, t).localeCompare(elementName(b, t), locale.value, { numeric: true })));
    const counts = computed(() => {
      const map = new Map();
      for (const planting of props.plantings) {
        if (props.year === null || touchesYear(planting, props.year)) map.set(planting.bedId, (map.get(planting.bedId) ?? 0) + 1);
      }
      return map;
    });
    function summary(element) {
      const size = elementSummary(element, props.units, locale.value);
      const count = counts.value.get(element.id) ?? 0;
      return count ? `${size} · ${t('map.panel.plantings', { count }, count)}` : size;
    }
    const name = (element) => elementName(element, t);
    return { t, sorted, summary, name, TYPE_ICONS };
  },
  template: `
    <section class="element-list" aria-labelledby="element-list-title">
      <div class="panel-header">
        <h2 id="element-list-title">{{ t('map.panel.list') }}</h2>
        <button type="button" class="btn btn-secondary" @click="$emit('add')">
          <AppIcon name="plus" />
          <span>{{ t('map.panel.addBySize') }}</span>
        </button>
      </div>
      <p v-if="elements.length === 0" class="muted">{{ t('map.panel.listEmpty') }}</p>
      <ul v-else class="plain-list">
        <li v-for="element in sorted" :key="element.id">
          <button type="button" class="menu-item element-row" @click="$emit('select', element.id)">
            <AppIcon :name="TYPE_ICONS[element.type]" />
            <span class="element-row-name">{{ name(element) }}</span>
            <span class="muted small">{{ summary(element) }}</span>
          </button>
        </li>
      </ul>
    </section>
  `,
};
