// A plant's year at a glance: sowing, planting out, harvest and care windows per month,
// adjusted to the garden's climate.

import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { windowInstances } from '../../logic/climate.js';
import { dayOfYear, daysInYear } from '../../logic/dates.js';
import AppIcon from '../AppIcon.js';
import { TASK_ICONS, shortDate } from '../tasks/taskText.js';

const ROWS = [
  { kind: 'sowIndoor', type: 'sow' },
  { kind: 'sowOutdoor', type: 'sow' },
  { kind: 'plantOut', type: 'plant' },
  { kind: 'harvest', type: 'harvest' },
];

export default {
  name: 'PlantCalendarStrip',
  components: { AppIcon },
  props: {
    plant: { type: Object, required: true },
    climate: { type: Object, default: () => ({ hemisphere: 'north', shiftWeeks: 0 }) },
    year: { type: Number, required: true },
  },
  setup(props) {
    const { t, te, locale } = useI18n();
    const months = computed(() => {
      const format = new Intl.DateTimeFormat(locale.value, { month: 'narrow', timeZone: 'UTC' });
      const long = new Intl.DateTimeFormat(locale.value, { month: 'long', timeZone: 'UTC' });
      return Array.from({ length: 12 }, (_, i) => {
        const date = new Date(Date.UTC(props.year, i, 1));
        return { short: format.format(date), long: long.format(date) };
      });
    });

    function bars(windows) {
      const first = `${props.year}-01-01`;
      const last = `${props.year}-12-31`;
      const days = daysInYear(props.year);
      const result = [];
      for (const window of windows) {
        for (const dates of windowInstances(window, props.climate, first, last)) {
          const start = dates.start < first ? first : dates.start;
          const end = dates.end > last ? last : dates.end;
          result.push({
            left: ((dayOfYear(start) - 1) / days) * 100,
            width: Math.max(1, ((dayOfYear(end) - dayOfYear(start) + 1) / days) * 100),
            label: `${shortDate(start, locale.value)} – ${shortDate(end, locale.value)}`,
          });
        }
      }
      return result;
    }

    const rows = computed(() => {
      const list = ROWS
        .filter((row) => props.plant.windows[row.kind]?.length)
        .map((row) => ({ ...row, label: t(`plantsView.windows.${row.kind}`), bars: bars(props.plant.windows[row.kind]) }));
      for (const rule of props.plant.care ?? []) {
        const key = `careHints.${props.plant.id}.${rule.hint}`;
        list.push({
          kind: `care-${rule.hint}`,
          type: rule.type,
          label: t(`hints.types.${rule.type}`),
          detail: te(key) ? t(key) : '',
          bars: bars([rule.weeks]),
        });
      }
      return list;
    });

    return { t, months, rows, TASK_ICONS };
  },
  template: `
    <div class="calendar-strip" role="table" :aria-label="t('plantsView.calendar')">
      <div class="calendar-strip-row calendar-strip-head" role="row">
        <span class="calendar-strip-label" role="columnheader"></span>
        <div class="calendar-strip-months">
          <span v-for="month in months" :key="month.long" role="columnheader" :title="month.long">{{ month.short }}</span>
        </div>
      </div>
      <div v-for="row in rows" :key="row.kind" class="calendar-strip-row" :class="'task-' + row.type" role="row">
        <span class="calendar-strip-label" role="rowheader" :title="row.detail || row.label">
          <span class="task-icon is-small"><AppIcon :name="TASK_ICONS[row.type]" /></span>
          <span>{{ row.label }}</span>
        </span>
        <div class="calendar-strip-track" role="cell">
          <span v-for="(bar, index) in row.bars" :key="index" class="calendar-strip-bar" :style="{ left: bar.left + '%', width: bar.width + '%' }" :title="bar.label">
            <span class="visually-hidden">{{ bar.label }}</span>
          </span>
        </div>
      </div>
    </div>
  `,
};
