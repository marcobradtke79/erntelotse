// One hint: task type (icon and colour), plant, place, period, the catalog's advice,
// and – when actions are shown – done / skip / undo. Done tasks go into the journal.

import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { stateOf } from '../../logic/tasks.js';
import { todayIso } from '../../logic/dates.js';
import { setTaskState } from '../../stores/gardens.js';
import AppIcon from '../AppIcon.js';
import PlantIcon from '../PlantIcon.js';
import { TASK_ICONS, hintTitle, hintAdvice, hintPlantName, hintPlace, hintPeriod } from './taskText.js';

export default {
  name: 'HintItem',
  components: { PlantIcon, AppIcon },
  props: {
    hint: { type: Object, required: true },
    garden: { type: Object, required: true },
    showPeriod: { type: Boolean, default: true },
    actions: { type: Boolean, default: true },
    overdue: { type: Boolean, default: false },
  },
  setup(props) {
    const { t, te, locale } = useI18n();
    const text = computed(() => ({
      title: hintTitle(props.hint, t),
      advice: hintAdvice(props.hint, t, te),
      plant: hintPlantName(props.hint, t),
      place: hintPlace(props.hint, props.garden, t),
      period: hintPeriod(props.hint, locale.value),
    }));
    const state = computed(() => stateOf(props.hint, props.garden.taskStates));
    const set = (value) => setTaskState(props.hint, value, todayIso());
    return { t, text, state, set, TASK_ICONS };
  },
  template: `
    <div class="hint-item" :class="['task-' + hint.type, 'is-' + state, { 'is-overdue': overdue && state === 'open' }]">
      <span class="task-icon" :title="t('hints.types.' + hint.type)">
        <AppIcon :name="TASK_ICONS[hint.type]" :label="t('hints.types.' + hint.type)" />
      </span>
      <div class="hint-item-body">
        <p class="hint-item-title">
          <strong>{{ text.title }}</strong>
          <span class="hint-item-plant"><PlantIcon :plant-id="hint.plantId" :size="20" />{{ text.plant }}</span>
          <span v-if="state !== 'open'" class="status-chip" :class="state === 'done' ? 'is-active' : 'is-past'">{{ t('tasks.state.' + state) }}</span>
          <span v-else-if="overdue" class="status-chip is-overdue">{{ t('tasks.overdue') }}</span>
        </p>
        <p v-if="text.advice && state === 'open'" class="small">{{ text.advice }}</p>
        <p class="small muted">
          <span v-if="text.place">{{ text.place }}</span>
          <span v-if="text.place && showPeriod"> · </span>
          <span v-if="showPeriod">{{ text.period }}</span>
          <span v-if="hint.everyWeeks"> · {{ t('hints.every', { count: hint.everyWeeks }, hint.everyWeeks) }}</span>
        </p>
      </div>
      <div v-if="actions" class="hint-actions">
        <template v-if="state === 'open'">
          <button type="button" class="btn btn-icon task-done" :title="t('tasks.markDone')" @click="set('done')">
            <AppIcon name="check" :label="t('tasks.markDone')" />
          </button>
          <button type="button" class="btn btn-text task-skip" @click="set('skipped')">{{ t('tasks.skip') }}</button>
        </template>
        <button v-else type="button" class="btn btn-text" @click="set('open')">{{ t('common.undo') }}</button>
      </div>
    </div>
  `,
};
