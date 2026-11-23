// One row of the year plan: a planting, tree or shrub. Closed, it shows the phases
// (pre-cultivation, time in the bed, harvest) and a mark per activity; opened, one lane
// per activity type with a button for every occurrence.

import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { plantById } from '../../stores/catalog.js';
import { lanes, position } from '../../logic/gantt.js';
import { stateOf } from '../../logic/tasks.js';
import AppIcon from '../AppIcon.js';
import PlantIcon from '../PlantIcon.js';
import { TASK_ICONS, hintTitle, hintPeriod } from '../tasks/taskText.js';

const percent = (value) => `${Math.round(value * 100) / 100}%`;

export default {
  name: 'GanttRow',
  components: { AppIcon, PlantIcon },
  props: {
    row: { type: Object, required: true },
    name: { type: String, required: true },
    /** Shown time span { from, to } */
    range: { type: Object, required: true },
    /** Activity types that are switched on */
    enabled: { type: Array, required: true },
    open: { type: Boolean, default: false },
    selectedKey: { type: String, default: null },
    taskStates: { type: Object, default: () => ({}) },
  },
  emits: ['toggle', 'select'],
  setup(props) {
    const { t, locale } = useI18n();
    const place = (start, end) => {
      const at = position(start, end, props.range);
      return at ? { style: { left: percent(at.left), width: percent(at.width) }, cutStart: at.cutStart, cutEnd: at.cutEnd } : null;
    };
    const color = computed(() => plantById(props.row.plantId).color);

    const phases = computed(() => props.row.phases
      .map((phase) => ({ kind: phase.kind, at: place(phase.start, phase.end) }))
      .filter((phase) => phase.at));

    /** Closed row: everything but the harvest (a phase already) as small marks */
    const marks = computed(() => props.row.activities
      .filter((hint) => hint.type !== 'harvest' && props.enabled.includes(hint.type))
      .map((hint) => ({ key: hint.key, type: hint.type, at: place(hint.start, hint.end) }))
      .filter((mark) => mark.at));

    const laneRows = computed(() => lanes(props.row, props.enabled).map((lane) => ({
      type: lane.type,
      items: lane.items.map((hint) => {
        const state = stateOf(hint, props.taskStates);
        const label = [props.name, hintTitle(hint, t), hintPeriod(hint, locale.value), state === 'open' ? '' : t(`tasks.state.${state}`)].filter(Boolean).join(', ');
        return { hint, state, label, at: place(hint.start, hint.end) };
      }).filter((item) => item.at),
    })));

    return { t, color, phases, marks, laneRows, TASK_ICONS };
  },
  template: `
    <div class="gantt-row" :class="{ 'is-open': open }">
      <div class="gantt-line">
        <button type="button" class="gantt-label gantt-toggle" :aria-expanded="open ? 'true' : 'false'" @click="$emit('toggle')">
          <AppIcon :name="open ? 'chevron-down' : 'chevron-right'" />
          <PlantIcon :plant-id="row.plantId" :size="22" />
          <span class="gantt-name">{{ name }}</span>
        </button>
        <div class="gantt-track is-overview" aria-hidden="true" @click="$emit('toggle')">
          <span
            v-for="(phase, index) in phases"
            :key="index"
            class="gantt-phase"
            :class="['phase-' + phase.kind, { 'cut-start': phase.at.cutStart, 'cut-end': phase.at.cutEnd }]"
            :style="{ ...phase.at.style, '--plant-color': color }"
            :title="t('calendar.phases.' + phase.kind)"
          ></span>
          <span v-for="mark in marks" :key="mark.key" class="gantt-mark" :class="'task-' + mark.type" :style="mark.at.style" :title="t('hints.types.' + mark.type)"></span>
        </div>
      </div>
      <template v-if="open">
        <div v-for="lane in laneRows" :key="lane.type" class="gantt-line is-lane" :class="'task-' + lane.type">
          <span class="gantt-label gantt-lane-label">
            <AppIcon :name="TASK_ICONS[lane.type]" />
            <span class="gantt-name">{{ t('hints.types.' + lane.type) }}</span>
          </span>
          <div class="gantt-track">
            <button
              v-for="item in lane.items"
              :key="item.hint.key"
              type="button"
              class="gantt-bar"
              :class="['is-' + item.state, { 'is-selected': item.hint.key === selectedKey }]"
              :style="item.at.style"
              :aria-label="item.label"
              :aria-pressed="item.hint.key === selectedKey ? 'true' : 'false'"
              :title="item.label"
              @click="$emit('select', item.hint)"
            >
              <AppIcon v-if="item.state === 'done'" name="check" />
            </button>
          </div>
        </div>
        <div v-if="!laneRows.length" class="gantt-line is-lane">
          <span class="gantt-label"></span>
          <p class="small muted gantt-none">{{ t('calendar.gantt.noActivities') }}</p>
        </div>
      </template>
    </div>
  `,
};
