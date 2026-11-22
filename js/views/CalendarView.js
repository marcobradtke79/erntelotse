// Calendar (docs/concept.md §2): month grid with the tasks of each day, and a year
// overview with one row per planting, tree and shrub.

import { ref, computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { gardens } from '../stores/gardens.js';
import { catalog, plantLabel } from '../stores/catalog.js';
import { period, setYear } from '../stores/period.js';
import { hintsFor, hintsOn, TASK_TYPES } from '../logic/hints.js';
import { todayIso, toIsoDate, addDays, yearOf, dayOfYear, daysInYear, maxDate, minDate } from '../logic/dates.js';
import { touchesYear } from '../logic/plantings.js';
import AppIcon from '../components/AppIcon.js';
import PlantIcon from '../components/PlantIcon.js';
import EmptyState from '../components/EmptyState.js';
import HintItem from '../components/tasks/HintItem.js';
import { TASK_ICONS } from '../components/tasks/taskText.js';
import { elementName } from '../components/map/elementText.js';

const MAX_MARKERS = 3;

export default {
  name: 'CalendarView',
  components: { PlantIcon, AppIcon, EmptyState, HintItem },
  setup() {
    const { t, locale } = useI18n();
    const garden = computed(() => gardens.active);
    const today = todayIso();
    const mode = ref('month');
    const month = ref(period.day ? Number(period.day.slice(5, 7)) : Number(today.slice(5, 7)));
    const selectedDay = ref(today);

    watch(() => period.year, (year) => {
      selectedDay.value = toIsoDate(year, month.value, 1);
    });

    const yearRange = computed(() => ({ from: `${period.year}-01-01`, to: `${period.year}-12-31` }));
    const hints = computed(() => (garden.value ? hintsFor(garden.value, catalog.value, yearRange.value) : []));

    // --- Month grid (weeks start on Monday) ---
    const monthTitle = computed(() => new Intl.DateTimeFormat(locale.value, { month: 'long', year: 'numeric', timeZone: 'UTC' })
      .format(new Date(Date.UTC(period.year, month.value - 1, 1))));
    const weekdays = computed(() => {
      const format = new Intl.DateTimeFormat(locale.value, { weekday: 'short', timeZone: 'UTC' });
      return Array.from({ length: 7 }, (_, i) => format.format(new Date(Date.UTC(2024, 0, 1 + i)))); // 1 Jan 2024 is a Monday
    });
    const weeks = computed(() => {
      const first = toIsoDate(period.year, month.value, 1);
      const offset = (new Date(`${first}T00:00:00Z`).getUTCDay() + 6) % 7;
      let day = addDays(first, -offset);
      const result = [];
      do {
        const week = [];
        for (let i = 0; i < 7; i++) {
          const starting = hints.value.filter((hint) => hint.start === day);
          week.push({
            day,
            number: Number(day.slice(8, 10)),
            inMonth: Number(day.slice(5, 7)) === month.value,
            markers: starting.slice(0, MAX_MARKERS).map((hint) => hint.type),
            more: Math.max(0, starting.length - MAX_MARKERS),
            count: starting.length,
          });
          day = addDays(day, 1);
        }
        result.push(week);
      } while (Number(day.slice(5, 7)) === month.value);
      return result;
    });
    const dayHints = computed(() => hintsOn(hints.value, selectedDay.value));
    const dayTitle = computed(() => new Intl.DateTimeFormat(locale.value, { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })
      .format(new Date(`${selectedDay.value}T00:00:00Z`)));

    function moveMonth(step) {
      let next = month.value + step;
      if (next < 1 || next > 12) {
        setYear(period.year + step);
        next = next < 1 ? 12 : 1;
      }
      month.value = next;
      selectedDay.value = toIsoDate(period.year, next, 1);
    }

    function dayLabel(cell) {
      const date = new Intl.DateTimeFormat(locale.value, { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${cell.day}T00:00:00Z`));
      return cell.count ? `${date}: ${t('calendar.tasksStarting', { count: cell.count }, cell.count)}` : date;
    }

    // --- Year overview ---
    const yearRows = computed(() => {
      const g = garden.value;
      if (!g) return [];
      const year = period.year;
      const first = `${year}-01-01`;
      const last = `${year}-12-31`;
      const days = daysInYear(year);
      const position = (start, end) => {
        const from = maxDate(start, first);
        const to = minDate(end, last);
        return { left: ((dayOfYear(from) - 1) / days) * 100, width: Math.max(0.6, ((dayOfYear(to) - dayOfYear(from) + 1) / days) * 100) };
      };
      const rows = [];
      for (const planting of g.plantings.filter((p) => touchesYear(p, year)).sort((a, b) => a.start.localeCompare(b.start))) {
        const plant = catalog.value.get(planting.plantId);
        const bed = g.elements.find((element) => element.id === planting.bedId);
        const own = hints.value.filter((hint) => hint.sourceId === planting.id);
        const segments = [{ phase: 'grow', ...position(planting.start, planting.end ?? last), color: plant.color }];
        for (const hint of own.filter((h) => h.type === 'sow' || h.type === 'harvest')) {
          segments.push({ phase: hint.type, ...position(hint.start, hint.end) });
        }
        rows.push({ id: planting.id, plantId: planting.plantId, name: plantLabel(plant, t), place: bed ? elementName(bed, t) : '', color: plant.color, segments });
      }
      for (const element of g.elements.filter((e) => (e.type === 'tree' || e.type === 'shrub') && e.plantId && catalog.value.has(e.plantId))) {
        const plant = catalog.value.get(element.plantId);
        const own = hints.value.filter((hint) => hint.sourceId === element.id);
        const segments = own.filter((h) => h.type === 'harvest' || h.type === 'prune').map((hint) => ({ phase: hint.type, ...position(hint.start, hint.end) }));
        rows.push({ id: element.id, plantId: element.plantId, name: elementName(element, t), place: t(`elements.types.${element.type}`), color: plant.color, segments });
      }
      return rows;
    });
    const monthMarks = computed(() => {
      const format = new Intl.DateTimeFormat(locale.value, { month: 'narrow', timeZone: 'UTC' });
      return Array.from({ length: 12 }, (_, i) => format.format(new Date(Date.UTC(period.year, i, 1))));
    });
    const todayLine = computed(() => (yearOf(today) === period.year ? ((dayOfYear(today) - 0.5) / daysInYear(period.year)) * 100 : null));

    return {
      t, garden, mode, month, monthTitle, weekdays, weeks, selectedDay, dayHints, dayTitle, today, period,
      moveMonth, dayLabel, yearRows, monthMarks, todayLine, TASK_ICONS, TASK_TYPES,
    };
  },
  template: `
    <div class="page">
      <div class="page-header">
        <h1>{{ t('nav.calendar') }}</h1>
        <div class="segmented" role="group" :aria-label="t('calendar.view')" v-if="garden">
          <button type="button" :aria-pressed="mode === 'month' ? 'true' : 'false'" @click="mode = 'month'">{{ t('calendar.month') }}</button>
          <button type="button" :aria-pressed="mode === 'year' ? 'true' : 'false'" @click="mode = 'year'">{{ t('calendar.year') }}</button>
        </div>
      </div>

      <EmptyState v-if="!garden" :title="t('placeholder.noGardenTitle')" :text="t('placeholder.noGardenText')">
        <router-link to="/gardens" class="btn btn-primary">
          <AppIcon name="garden" />
          <span>{{ t('placeholder.toGardens') }}</span>
        </router-link>
      </EmptyState>

      <div v-else-if="mode === 'month'" class="calendar-layout">
        <section class="card">
          <div class="calendar-month-header">
            <button type="button" class="btn btn-icon" :title="t('calendar.previousMonth')" @click="moveMonth(-1)">
              <AppIcon name="chevron-left" :label="t('calendar.previousMonth')" />
            </button>
            <h2>{{ monthTitle }}</h2>
            <button type="button" class="btn btn-icon" :title="t('calendar.nextMonth')" @click="moveMonth(1)">
              <AppIcon name="chevron-right" :label="t('calendar.nextMonth')" />
            </button>
          </div>
          <table class="month-grid">
            <thead><tr><th v-for="day in weekdays" :key="day" scope="col">{{ day }}</th></tr></thead>
            <tbody>
              <tr v-for="(week, w) in weeks" :key="w">
                <td v-for="cell in week" :key="cell.day">
                  <button
                    type="button"
                    class="month-cell"
                    :class="{ 'is-other': !cell.inMonth, 'is-today': cell.day === today, 'is-selected': cell.day === selectedDay }"
                    :aria-pressed="cell.day === selectedDay ? 'true' : 'false'"
                    :aria-label="dayLabel(cell)"
                    @click="selectedDay = cell.day"
                  >
                    <span class="month-cell-number">{{ cell.number }}</span>
                    <span class="month-cell-markers" aria-hidden="true">
                      <span v-for="(type, i) in cell.markers" :key="i" class="task-dot" :class="'task-' + type"></span>
                      <span v-if="cell.more" class="month-cell-more">+{{ cell.more }}</span>
                    </span>
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
          <ul class="plain-list task-legend" :aria-label="t('calendar.legend')">
            <li v-for="type in TASK_TYPES" :key="type" :class="'task-' + type"><span class="task-dot"></span>{{ t('hints.types.' + type) }}</li>
          </ul>
        </section>

        <section class="card" aria-live="polite">
          <h2>{{ dayTitle }}</h2>
          <p v-if="!dayHints.length" class="muted">{{ t('calendar.nothingOnDay') }}</p>
          <ul v-else class="plain-list hint-list">
            <li v-for="hint in dayHints" :key="hint.key"><HintItem :hint="hint" :garden="garden" /></li>
          </ul>
        </section>
      </div>

      <section v-else class="card year-overview" :aria-label="t('calendar.year')">
        <p v-if="!yearRows.length" class="muted">{{ t('calendar.nothingInYear', { year: period.year }) }}</p>
        <template v-else>
          <div class="year-row year-head" aria-hidden="true">
            <span class="year-row-label"></span>
            <div class="year-months"><span v-for="(m, i) in monthMarks" :key="i">{{ m }}</span></div>
          </div>
          <ul class="plain-list">
            <li v-for="row in yearRows" :key="row.id" class="year-row">
              <span class="year-row-label">
                <PlantIcon :plant-id="row.plantId" :size="24" />
                <span><strong>{{ row.name }}</strong><span class="small muted"> {{ row.place }}</span></span>
              </span>
              <div class="year-track">
                <span v-if="todayLine !== null" class="year-today" :style="{ left: todayLine + '%' }" aria-hidden="true"></span>
                <span
                  v-for="(segment, i) in row.segments"
                  :key="i"
                  class="year-segment"
                  :class="'phase-' + segment.phase + (segment.phase !== 'grow' ? ' task-' + segment.phase : '')"
                  :style="{ left: segment.left + '%', width: segment.width + '%', '--plant-color': segment.color }"
                  :title="t('calendar.phases.' + segment.phase)"
                ></span>
              </div>
            </li>
          </ul>
          <ul class="plain-list task-legend">
            <li class="phase-legend-grow"><span class="year-segment-sample phase-grow"></span>{{ t('calendar.phases.grow') }}</li>
            <li class="task-sow"><span class="year-segment-sample phase-sow"></span>{{ t('calendar.phases.sow') }}</li>
            <li class="task-harvest"><span class="year-segment-sample phase-harvest"></span>{{ t('calendar.phases.harvest') }}</li>
            <li class="task-prune"><span class="year-segment-sample phase-prune"></span>{{ t('calendar.phases.prune') }}</li>
          </ul>
        </template>
      </section>
    </div>
  `,
};
