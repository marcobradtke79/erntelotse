// The Gantt chart of one bed in a wide dialog, opened from the bed selected on the garden
// map or from the bed editor: the season (13 weeks, by week) or the year (by month).

import { ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { catalog } from '../../stores/catalog.js';
import { period, showThisWeek } from '../../stores/period.js';
import { hintsFor } from '../../logic/hints.js';
import { yearRange } from '../../logic/gantt.js';
import { useSeason } from '../../composables/useSeason.js';
import AppDialog from '../AppDialog.js';
import AppIcon from '../AppIcon.js';
import { elementName } from '../map/elementText.js';
import GanttChart from './GanttChart.js';

export default {
  name: 'BedGanttDialog',
  components: { AppDialog, AppIcon, GanttChart },
  props: {
    open: { type: Boolean, default: false },
    garden: { type: Object, required: true },
    bed: { type: Object, required: true },
  },
  emits: ['update:open', 'assign'],
  setup(props) {
    const { t } = useI18n();
    const mode = ref('season');
    const { season, seasonTitle, moveSeason, isThisWeek } = useSeason();
    const span = computed(() => (mode.value === 'season' ? season.value : yearRange(period.year)));
    // only while the dialog is open: hints of the whole garden are not needed otherwise
    const hints = computed(() => (props.open ? hintsFor(props.garden, catalog.value, span.value) : []));
    const title = computed(() => t('calendar.gantt.bedTitle', { bed: elementName(props.bed, t) }));
    return { t, mode, span, hints, title, seasonTitle, moveSeason, isThisWeek, showThisWeek, period };
  },
  template: `
    <AppDialog :open="open" :title="title" wide @update:open="$emit('update:open', $event)">
      <div class="bed-gantt-bar">
        <div class="segmented" role="group" :aria-label="t('calendar.view')">
          <button type="button" :aria-pressed="mode === 'season' ? 'true' : 'false'" autofocus @click="mode = 'season'">{{ t('calendar.season') }}</button>
          <button type="button" :aria-pressed="mode === 'year' ? 'true' : 'false'" @click="mode = 'year'">{{ t('calendar.year') }}</button>
        </div>
        <div v-if="mode === 'season'" class="calendar-month-header season-header">
          <button type="button" class="btn btn-icon" :title="t('calendar.earlier')" @click="moveSeason(-4)">
            <AppIcon name="chevron-left" :label="t('calendar.earlier')" />
          </button>
          <h2 aria-live="polite">{{ seasonTitle }}</h2>
          <button type="button" class="btn btn-icon" :title="t('calendar.later')" @click="moveSeason(4)">
            <AppIcon name="chevron-right" :label="t('calendar.later')" />
          </button>
          <button v-if="!isThisWeek" type="button" class="btn btn-text" @click="showThisWeek">{{ t('period.today') }}</button>
        </div>
        <strong v-else>{{ period.year }}</strong>
      </div>
      <GanttChart :garden="garden" :hints="hints" :span="span" :granularity="mode === 'season' ? 'week' : 'month'" :bed-id="bed.id">
        <template #empty>
          <button type="button" class="btn btn-primary" @click="$emit('assign')">
            <AppIcon name="seedling" />
            <span>{{ t('map.panel.openBed') }}</span>
          </button>
        </template>
      </GanttChart>
    </AppDialog>
  `,
};
