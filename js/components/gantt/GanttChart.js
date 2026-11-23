// The plan as a Gantt chart (calendar → Season and Year). Three levels: beds with their
// plantings (overview), a row opened into lanes per activity, and one activity with its
// details. Activity types can be switched off. Columns are weeks (a season) or months
// (a year, where a month can be shown closer, three months wide).

import { ref, reactive, computed, watch, nextTick } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { catalog, plantById, plantLabel } from '../../stores/catalog.js';
import { period, setWeek } from '../../stores/period.js';
import { TASK_TYPES } from '../../logic/hints.js';
import { ganttGroups, position, monthRange, monthSpans, weekColumns } from '../../logic/gantt.js';
import { addDays, todayIso, mondayOf, maxDate, yearOf } from '../../logic/dates.js';
import AppIcon from '../AppIcon.js';
import HintItem from '../tasks/HintItem.js';
import { TASK_ICONS } from '../tasks/taskText.js';
import { TYPE_ICONS } from '../map/ToolPalette.js';
import { elementName } from '../map/elementText.js';
import GanttRow from './GanttRow.js';

const percent = (value) => `${Math.round(value * 100) / 100}%`;

export default {
  name: 'GanttChart',
  components: { AppIcon, HintItem, GanttRow },
  props: {
    garden: { type: Object, required: true },
    /** hintsFor() of the whole span */
    hints: { type: Array, required: true },
    /** The span shown: { from, to } – a year or a season */
    span: { type: Object, required: true },
    /** Columns: 'month' (a year) or 'week' (a season) */
    granularity: { type: String, default: 'month' },
    /** Only this bed (chart of one bed): its header line and collapsing are left out */
    bedId: { type: String, default: null },
  },
  setup(props) {
    const { t, locale } = useI18n();
    const router = useRouter();
    const today = todayIso();
    const collapsed = reactive({});
    const openRows = reactive({});
    const enabled = ref([...TASK_TYPES]);
    const zoomMonth = ref(null);
    const selectedKey = ref(null);
    const detail = ref(null);

    const byWeek = computed(() => props.granularity === 'week');
    const year = computed(() => yearOf(props.span.from));

    watch(() => [props.span.from, props.span.to, props.garden.id], () => {
      selectedKey.value = null;
    });
    watch(() => [year.value, props.granularity], () => {
      zoomMonth.value = null;
    });

    const groups = computed(() => ganttGroups(props.garden, catalog.value, props.hints, props.span, { bedId: props.bedId }).map((group) => {
      const bed = group.bedId ? props.garden.elements.find((element) => element.id === group.bedId) : null;
      return {
        ...group,
        name: bed ? elementName(bed, t) : t('calendar.gantt.trees'),
        icon: bed ? TYPE_ICONS.bed : TYPE_ICONS.tree,
        count: bed ? t('map.panel.plantings', { count: group.rows.length }, group.rows.length) : '',
        rows: group.rows.map((row) => ({
          ...row,
          name: row.sourceKind === 'planting'
            ? plantLabel(plantById(row.plantId), t)
            : elementName(props.garden.elements.find((element) => element.id === row.id), t),
        })),
      };
    }));

    const range = computed(() => (zoomMonth.value && !byWeek.value ? monthRange(year.value, zoomMonth.value) : props.span));
    const place = (start, end) => {
      const at = position(start, end, range.value);
      return at ? { left: percent(at.left), width: percent(at.width) } : null;
    };

    /** Header: the months of the shown span; by week their names stand over the week numbers */
    const months = computed(() => {
      const format = new Intl.DateTimeFormat(locale.value, { month: zoomMonth.value || byWeek.value ? 'long' : 'short', timeZone: 'UTC' });
      const long = new Intl.DateTimeFormat(locale.value, { month: 'long', timeZone: 'UTC' });
      return monthSpans(range.value).map((span, index) => {
        const first = new Date(Date.UTC(span.year, span.month - 1, 1));
        // a season can run into the next year: say so where the year begins
        const withYear = byWeek.value && (index === 0 || span.month === 1);
        return {
          key: `${span.year}-${span.month}`,
          month: span.month,
          label: withYear ? `${format.format(first)} ${span.year}` : format.format(first),
          title: t('calendar.gantt.zoomTo', { month: long.format(first) }),
          style: place(span.from, span.to),
        };
      });
    });

    const weeks = computed(() => {
      if (!byWeek.value) return [];
      const format = new Intl.DateTimeFormat(locale.value, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
      const date = (iso) => new Date(`${iso}T00:00:00Z`);
      return weekColumns(range.value).map((column) => ({
        key: column.monday,
        week: column.week,
        now: column.monday === mondayOf(today),
        title: t('period.week', { week: column.week, range: format.formatRange(date(column.monday), date(addDays(column.monday, 6))) }),
        style: place(column.monday, addDays(column.monday, 6)),
      })).filter((week) => week.style);
    });

    /** By month: month starts (closer up also the Mondays). By week: every week, stronger at month starts */
    const gridLines = computed(() => {
      const lines = [];
      const closeUp = Boolean(zoomMonth.value) || byWeek.value;
      for (const month of months.value) {
        if (month.style.left !== '0%') lines.push({ key: `m${month.key}`, left: month.style.left, strong: closeUp });
      }
      if (closeUp) {
        for (let day = addDays(mondayOf(range.value.from), 7); day <= range.value.to; day = addDays(day, 7)) {
          const at = place(day, day);
          if (at) lines.push({ key: day, left: at.left, strong: false });
        }
      }
      return lines;
    });

    const todayLine = computed(() => place(today, today)?.left ?? null);
    const weekBand = computed(() => (period.day ? place(period.day, addDays(period.day, 6)) : null));

    /** A collapsed bed: its plantings' time in the bed (trees: harvests) on one track */
    function summary(group) {
      const kind = group.kind === 'bed' ? 'grow' : 'harvest';
      return group.rows.flatMap((row) => row.phases
        .filter((phase) => phase.kind === kind)
        .map((phase, index) => ({ key: `${row.id}-${index}`, kind, style: place(phase.start, phase.end), color: plantById(row.plantId).color })))
        .filter((bar) => bar.style);
    }

    const allCollapsed = computed(() => groups.value.every((group) => collapsed[group.id]));
    function toggleAll() {
      const next = !allCollapsed.value;
      for (const group of groups.value) collapsed[group.id] = next;
    }

    function toggleType(type) {
      enabled.value = enabled.value.includes(type) ? enabled.value.filter((item) => item !== type) : TASK_TYPES.filter((item) => item === type || enabled.value.includes(item));
    }

    // The hint itself is derived anew when task states change, so keep only its key
    const selected = computed(() => props.hints.find((hint) => hint.key === selectedKey.value) ?? null);

    function select(hint) {
      selectedKey.value = hint.key === selectedKey.value ? null : hint.key;
      if (selectedKey.value) nextTick(() => detail.value?.scrollIntoView({ block: 'nearest' }));
    }

    function showWeek(hint) {
      setWeek(maxDate(hint.start, props.span.from));
      router.push('/map');
    }

    return {
      t, period, groups, collapsed, openRows, enabled, zoomMonth, selectedKey, selected, detail, range, months, weeks, byWeek, year, gridLines, todayLine, weekBand,
      allCollapsed, summary, toggleAll, toggleType, select, showWeek, TASK_TYPES, TASK_ICONS,
      openBed: (id) => router.push(`/map/bed/${id}`),
    };
  },
  template: `
    <section class="card gantt" :aria-label="t('calendar.gantt.label')">
      <div v-if="!groups.length" class="gantt-empty">
        <p class="muted">{{ byWeek ? t('calendar.gantt.nothingInRange') : t('calendar.nothingInYear', { year }) }}</p>
        <slot name="empty" />
      </div>
      <template v-else>
        <div class="gantt-toolbar">
          <div class="gantt-filter" role="group" :aria-label="t('calendar.gantt.filter')">
            <button v-for="type in TASK_TYPES" :key="type" type="button" class="gantt-chip" :class="'task-' + type"
              :aria-pressed="enabled.includes(type) ? 'true' : 'false'" @click="toggleType(type)">
              <AppIcon :name="TASK_ICONS[type]" />
              <span>{{ t('hints.types.' + type) }}</span>
            </button>
          </div>
          <div class="btn-row">
            <button v-if="zoomMonth && !byWeek" type="button" class="btn btn-secondary" @click="zoomMonth = null">
              <AppIcon name="fit" /><span>{{ t('calendar.gantt.wholeYear') }}</span>
            </button>
            <button v-if="!bedId" type="button" class="btn btn-text" @click="toggleAll">{{ allCollapsed ? t('calendar.gantt.expandAll') : t('calendar.gantt.collapseAll') }}</button>
          </div>
        </div>

        <div class="gantt-scroll">
          <div class="gantt-inner">
            <div class="gantt-line gantt-head">
              <span class="gantt-label gantt-head-label">{{ byWeek ? t('calendar.gantt.weekHead') : '' }}</span>
              <div v-if="byWeek" class="gantt-weekhead">
                <div class="gantt-months is-plain">
                  <span v-for="month in months" :key="month.key" class="gantt-month" :style="month.style">{{ month.label }}</span>
                </div>
                <div class="gantt-weeks">
                  <span v-for="week in weeks" :key="week.key" class="gantt-week-cell" :class="{ 'is-now': week.now }" :style="week.style" :title="week.title" :aria-label="week.title">{{ week.week }}</span>
                </div>
              </div>
              <div v-else class="gantt-months">
                <button v-for="month in months" :key="month.key" type="button" class="gantt-month" :style="month.style"
                  :title="month.title" :aria-label="month.title" :aria-pressed="zoomMonth === month.month ? 'true' : 'false'" @click="zoomMonth = month.month">
                  {{ month.label }}
                </button>
              </div>
            </div>

            <div class="gantt-body">
              <div class="gantt-grid" aria-hidden="true">
                <span v-for="line in gridLines" :key="line.key" class="gantt-gridline" :class="{ 'is-strong': line.strong }" :style="{ left: line.left }"></span>
                <span v-if="weekBand" class="gantt-week" :style="weekBand"></span>
                <span v-if="todayLine" class="gantt-today" :style="{ left: todayLine }"></span>
              </div>

              <section v-for="group in groups" :key="group.id" class="gantt-group" :aria-label="group.name">
                <div v-if="!bedId" class="gantt-line gantt-group-head">
                  <button type="button" class="gantt-label gantt-toggle" :aria-expanded="collapsed[group.id] ? 'false' : 'true'" @click="collapsed[group.id] = !collapsed[group.id]">
                    <AppIcon :name="collapsed[group.id] ? 'chevron-right' : 'chevron-down'" />
                    <AppIcon :name="group.icon" />
                    <span class="gantt-name"><strong>{{ group.name }}</strong> <span class="small muted">{{ group.count }}</span></span>
                  </button>
                  <div class="gantt-track is-summary" aria-hidden="true" @click="collapsed[group.id] = !collapsed[group.id]">
                    <template v-if="collapsed[group.id]">
                      <span v-for="bar in summary(group)" :key="bar.key" class="gantt-phase" :class="'phase-' + bar.kind" :style="{ ...bar.style, '--plant-color': bar.color }"></span>
                    </template>
                  </div>
                </div>
                <template v-if="bedId || !collapsed[group.id]">
                  <GanttRow
                    v-for="row in group.rows"
                    :key="row.id"
                    :row="row"
                    :name="row.name"
                    :range="range"
                    :enabled="enabled"
                    :open="Boolean(openRows[row.id])"
                    :selected-key="selectedKey"
                    :task-states="garden.taskStates"
                    @toggle="openRows[row.id] = !openRows[row.id]"
                    @select="select"
                  />
                </template>
              </section>
            </div>
          </div>
        </div>

        <ul class="plain-list task-legend gantt-legend">
          <li><span class="gantt-sample phase-pre"></span>{{ t('calendar.phases.pre') }}</li>
          <li><span class="gantt-sample phase-grow"></span>{{ t('calendar.phases.grow') }}</li>
          <li><span class="gantt-sample phase-harvest"></span>{{ t('calendar.phases.harvest') }}</li>
          <li><span class="gantt-sample is-today"></span>{{ t('calendar.gantt.today') }}</li>
          <li v-if="period.day"><span class="gantt-sample is-week"></span>{{ t('calendar.gantt.shownWeek') }}</li>
        </ul>
        <p class="small muted">{{ t('calendar.gantt.hint') }} <span v-if="!byWeek">{{ t('calendar.gantt.hintZoom') }}</span></p>

        <section v-if="selected" ref="detail" class="gantt-detail" :aria-label="t('calendar.gantt.detailTitle')">
          <div class="gantt-detail-head">
            <h2>{{ t('calendar.gantt.detailTitle') }}</h2>
            <button type="button" class="btn btn-icon" :title="t('common.close')" @click="selectedKey = null">
              <AppIcon name="close" :label="t('common.close')" />
            </button>
          </div>
          <HintItem :key="selected.key" :hint="selected" :garden="garden" />
          <div class="btn-row">
            <button v-if="selected.bedId" type="button" class="btn btn-secondary" @click="openBed(selected.bedId)">
              <AppIcon name="bed" /><span>{{ t('calendar.gantt.openBed') }}</span>
            </button>
            <button type="button" class="btn btn-text" @click="showWeek(selected)">
              <AppIcon name="map" /><span>{{ t('calendar.gantt.showWeek') }}</span>
            </button>
          </div>
        </section>
      </template>
    </section>
  `,
};
