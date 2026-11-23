// Calendar (docs/concept.md §2). Three views: Season (default) – the next 13 weeks from
// the shown week as a Gantt chart with a column per week; Month – grid with the tasks of
// each day; Year – the Gantt chart with a column per month (js/components/gantt/).

import { ref, computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { gardens } from '../stores/gardens.js';
import { catalog } from '../stores/catalog.js';
import { period, setYear, showThisWeek } from '../stores/period.js';
import { yearRange as yearSpanOf } from '../logic/gantt.js';
import { useSeason } from '../composables/useSeason.js';
import { hintsFor, hintsOn, TASK_TYPES } from '../logic/hints.js';
import { todayIso, toIsoDate, addDays } from '../logic/dates.js';
import AppIcon from '../components/AppIcon.js';
import EmptyState from '../components/EmptyState.js';
import HintItem from '../components/tasks/HintItem.js';
import { TASK_ICONS } from '../components/tasks/taskText.js';
import GanttChart from '../components/gantt/GanttChart.js';

const MAX_MARKERS = 3;

export default {
  name: 'CalendarView',
  components: { AppIcon, EmptyState, HintItem, GanttChart },
  setup() {
    const { t, locale } = useI18n();
    const garden = computed(() => gardens.active);
    const today = todayIso();
    const mode = ref('season');
    const month = ref(period.day ? Number(period.day.slice(5, 7)) : Number(today.slice(5, 7)));
    const selectedDay = ref(today);

    watch(() => period.year, (year) => {
      selectedDay.value = toIsoDate(year, month.value, 1);
    });

    const yearRange = computed(() => ({ from: `${period.year}-01-01`, to: `${period.year}-12-31` }));
    const hints = computed(() => (garden.value ? hintsFor(garden.value, catalog.value, yearRange.value) : []));

    // --- Season: 13 weeks from the shown week (shared with the bed's Gantt dialog) ---
    const { season, seasonTitle, moveSeason, isThisWeek } = useSeason();
    const seasonHints = computed(() => (garden.value ? hintsFor(garden.value, catalog.value, season.value) : []));
    const yearSpan = computed(() => yearSpanOf(period.year));

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

    return {
      t, garden, mode, month, monthTitle, weekdays, weeks, selectedDay, dayHints, dayTitle, today, period,
      moveMonth, dayLabel, hints, TASK_ICONS, TASK_TYPES,
      season, seasonHints, seasonTitle, moveSeason, yearSpan, showThisWeek, isThisWeek,
    };
  },
  template: `
    <div class="page">
      <div class="page-header">
        <h1>{{ t('nav.calendar') }}</h1>
        <div class="segmented" role="group" :aria-label="t('calendar.view')" v-if="garden">
          <button type="button" :aria-pressed="mode === 'season' ? 'true' : 'false'" @click="mode = 'season'">{{ t('calendar.season') }}</button>
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

      <template v-else-if="mode === 'season'">
        <div class="calendar-month-header season-header">
          <button type="button" class="btn btn-icon" :title="t('calendar.earlier')" @click="moveSeason(-4)">
            <AppIcon name="chevron-left" :label="t('calendar.earlier')" />
          </button>
          <h2 aria-live="polite">{{ seasonTitle }}</h2>
          <button type="button" class="btn btn-icon" :title="t('calendar.later')" @click="moveSeason(4)">
            <AppIcon name="chevron-right" :label="t('calendar.later')" />
          </button>
          <button v-if="!isThisWeek" type="button" class="btn btn-text" @click="showThisWeek">{{ t('period.today') }}</button>
        </div>
        <GanttChart :garden="garden" :hints="seasonHints" :span="season" granularity="week" />
      </template>

      <GanttChart v-else :garden="garden" :hints="hints" :span="yearSpan" granularity="month" />
    </div>
  `,
};
