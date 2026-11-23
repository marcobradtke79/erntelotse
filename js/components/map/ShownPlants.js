// What is planted in the garden in the shown week (or year): one row per plant and bed.
// A row opens its bed. Together with the timeline it shows how the garden changes over time.

import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { visiblePlantings } from '../../logic/plantings.js';
import PlantIcon from '../PlantIcon.js';
import { plantName } from '../bed/plantingText.js';
import { elementName } from './elementText.js';

export default {
  name: 'ShownPlants',
  components: { PlantIcon },
  props: {
    garden: { type: Object, required: true },
    period: { type: Object, required: true },
  },
  emits: ['open-bed'],
  setup(props) {
    const { t, locale } = useI18n();
    const rows = computed(() => {
      const beds = new Map(props.garden.elements.map((element) => [element.id, element]));
      const seen = new Map();
      for (const planting of visiblePlantings(props.garden.plantings, props.period)) {
        const bed = beds.get(planting.bedId);
        if (!bed) continue;
        const key = `${planting.plantId}|${bed.id}`;
        if (!seen.has(key)) seen.set(key, { key, plantId: planting.plantId, bedId: bed.id, name: plantName(planting.plantId, t), bed: elementName(bed, t) });
      }
      return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name, locale.value) || a.bed.localeCompare(b.bed, locale.value, { numeric: true }));
    });
    const heading = computed(() => (props.period.day ? t('map.shown.week') : t('map.shown.year', { year: props.period.year })));
    return { t, rows, heading };
  },
  template: `
    <section class="shown-plants" aria-labelledby="shown-plants-title">
      <h2 id="shown-plants-title">{{ heading }}</h2>
      <p v-if="!rows.length" class="muted small">{{ t('map.shown.empty') }}</p>
      <ul v-else class="plain-list">
        <li v-for="row in rows" :key="row.key">
          <button type="button" class="menu-item element-row" @click="$emit('open-bed', row.bedId)">
            <PlantIcon :plant-id="row.plantId" :size="24" />
            <span class="element-row-name">{{ row.name }}</span>
            <span class="muted small">{{ row.bed }}</span>
          </button>
        </li>
      </ul>
    </section>
  `,
};
