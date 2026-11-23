// The bed's plantings of one year as bars from January to December, so planned,
// growing and finished plantings are visible at once. A row selects its planting.

import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { plantById } from '../../stores/catalog.js';
import { timelineBars } from '../../logic/plantings.js';
import { addDays, daysBetween, daysInYear, toIsoDate, maxDate, minDate } from '../../logic/dates.js';
import PlantIcon from '../PlantIcon.js';
import { plantName, periodText, preText } from './plantingText.js';

export default {
  name: 'BedTimeline',
  components: { PlantIcon },
  props: {
    /** Plantings of the bed */
    plantings: { type: Array, required: true },
    year: { type: Number, required: true },
    /** First day (ISO) of the shown span of `days` days, or null for the whole year */
    day: { type: String, default: null },
    days: { type: Number, default: 1 },
  },
  emits: ['select'],
  setup(props) {
    const { t, locale } = useI18n();
    const percent = (fraction) => `${Math.round(fraction * 10000) / 100}%`;

    const months = computed(() => {
      const format = new Intl.DateTimeFormat(locale.value, { month: 'narrow', timeZone: 'UTC' });
      return Array.from({ length: 12 }, (_, month) => ({
        label: format.format(new Date(Date.UTC(props.year, month, 1))),
        days: new Date(Date.UTC(props.year, month + 1, 0)).getUTCDate(),
      }));
    });

    const rows = computed(() => {
      // Single plants of one kind with the same period share a row
      const groups = new Map();
      for (const planting of props.plantings) {
        const key = planting.shape.kind === 'point' ? `${planting.plantId}|${planting.start}|${planting.end}|${planting.preStart}` : planting.id;
        if (groups.has(key)) groups.get(key).count += 1;
        else groups.set(key, { planting, count: 1 });
      }
      const byId = new Map([...groups.values()].map((group) => [group.planting.id, group]));
      return timelineBars([...byId.values()].map((group) => group.planting), props.year).map((bar) => {
        const { planting, count } = byId.get(bar.id);
        const name = count > 1 ? `${plantName(planting.plantId, t)} × ${count}` : plantName(planting.plantId, t);
        return {
          ...bar,
          plantId: planting.plantId,
          name,
          label: [name, periodText(planting, locale.value, t, props.year), preText(planting, locale.value, t)].filter(Boolean).join(', '),
          style: { left: percent(bar.from), width: percent(bar.to - bar.from), background: plantById(planting.plantId).color },
          // pre-cultivation: hatched, because the plants are not in the bed yet
          preStyle: bar.preFrom === null ? null : { left: percent(bar.preFrom), width: percent(bar.from - bar.preFrom), '--bar': plantById(planting.plantId).color },
        };
      });
    });

    /** The shown week as a band, clipped to the year */
    const marker = computed(() => {
      if (!props.day) return null;
      const first = toIsoDate(props.year, 1, 1);
      const from = maxDate(props.day, first);
      const to = minDate(addDays(props.day, props.days - 1), toIsoDate(props.year, 12, 31));
      if (to < from) return null;
      const total = daysInYear(props.year);
      return { left: percent(daysBetween(first, from) / total), width: percent((daysBetween(from, to) + 1) / total) };
    });

    return { t, months, rows, marker };
  },
  template: `
    <section v-if="rows.length" class="bed-timeline" :aria-label="t('bed.timeline.title', { year })">
      <h3>{{ t('bed.timeline.title', { year }) }}</h3>
      <div class="timeline-months" aria-hidden="true">
        <span v-for="(month, index) in months" :key="index" :style="{ flexGrow: month.days }">{{ month.label }}</span>
      </div>
      <ul class="plain-list timeline-rows">
        <li v-for="row in rows" :key="row.id">
          <button type="button" class="timeline-row" :aria-label="row.label" :title="row.label" @click="$emit('select', row.id)">
            <span class="timeline-name">
              <PlantIcon :plant-id="row.plantId" :size="20" />
              <span>{{ row.name }}</span>
            </span>
            <span class="timeline-track">
              <span v-if="row.preStyle" class="timeline-pre" :style="row.preStyle"></span>
              <span class="timeline-bar" :class="{ 'starts-before': row.startsBefore, 'ends-after': row.endsAfter }" :style="row.style"></span>
              <span v-if="marker" class="timeline-marker" :style="marker"></span>
            </span>
          </button>
        </li>
      </ul>
    </section>
  `,
};
