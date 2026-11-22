// One hint: task type (icon and colour), plant, place, period and the catalog's advice.

import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { plantById } from '../../stores/catalog.js';
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
  },
  setup(props) {
    const { t, te, locale } = useI18n();
    const text = computed(() => ({
      title: hintTitle(props.hint, t),
      advice: hintAdvice(props.hint, t, te),
      plant: hintPlantName(props.hint, t),
      place: hintPlace(props.hint, props.garden, t),
      period: hintPeriod(props.hint, locale.value),
      color: plantById(props.hint.plantId).color,
    }));
    return { t, text, TASK_ICONS };
  },
  template: `
    <div class="hint-item" :class="'task-' + hint.type">
      <span class="task-icon" :title="t('hints.types.' + hint.type)">
        <AppIcon :name="TASK_ICONS[hint.type]" :label="t('hints.types.' + hint.type)" />
      </span>
      <div class="hint-item-body">
        <p class="hint-item-title">
          <strong>{{ text.title }}</strong>
          <span class="hint-item-plant"><PlantIcon :plant-id="hint.plantId" :size="20" />{{ text.plant }}</span>
        </p>
        <p v-if="text.advice" class="small">{{ text.advice }}</p>
        <p class="small muted">
          <span v-if="text.place">{{ text.place }}</span>
          <span v-if="text.place && showPeriod"> · </span>
          <span v-if="showPeriod">{{ text.period }}</span>
          <span v-if="hint.everyWeeks"> · {{ t('hints.every', { count: hint.everyWeeks }, hint.everyWeeks) }}</span>
        </p>
      </div>
    </div>
  `,
};
