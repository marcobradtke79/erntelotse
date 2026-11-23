// Assigns a part of the bed to a plant for a period (docs/concept.md §3 step 4):
// plant, from – until, optional pre-cultivation before that, and where (drawn area,
// whole bed or single plants).
// The dialog only collects the choice; the bed editor creates the planting or starts drawing.

import { ref, computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { plantById } from '../../stores/catalog.js';
import { periodError, proposedPreStart } from '../../logic/plantings.js';
import { yearOf, addDays, isIsoDate, todayIso } from '../../logic/dates.js';
import AppDialog from '../AppDialog.js';
import AppIcon from '../AppIcon.js';
import PlantSelect from '../PlantSelect.js';

export const PLANTING_KINDS = ['area', 'whole', 'plant'];
const KIND_ICONS = { area: 'area', whole: 'bed', plant: 'seedling' };

export default {
  name: 'AddPlantingDialog',
  components: { AppDialog, AppIcon, PlantSelect },
  props: {
    open: { type: Boolean, default: false },
    bedName: { type: String, required: true },
    /** Values when the dialog opens: { plantId, kind, start?, end?, preStart?, keepPre? }; with a start the
     *  dates count as chosen, with keepPre also the pre-cultivation (preStart or null) */
    initial: { type: Object, default: null },
    /** (plantId) → { start, end }: the period proposed for a plant */
    propose: { type: Function, required: true },
    /** (year) → true when that year is read-only */
    isLocked: { type: Function, default: () => false },
    advice: { type: Object, default: () => ({}) },
  },
  emits: ['update:open', 'submit'],
  setup(props, { emit }) {
    const { t } = useI18n();
    const plantId = ref('carrot');
    const kind = ref('area');
    const start = ref('');
    const end = ref('');
    const openEnd = ref(false);
    const error = ref('');
    // Once the user has set a date, choosing another plant keeps the period
    let datesChosen = false;
    // Pre-cultivation: proposed for plants that are raised indoors, as long as it is not chosen
    const pre = ref(false);
    const preStart = ref('');
    let preChosen = false;

    function proposePre() {
      if (preChosen) return;
      const valid = isIsoDate(start.value);
      const proposed = valid ? proposedPreStart(plantById(plantId.value), start.value) : null;
      // a pre-cultivation that should have begun already is not assumed: the plants are probably bought
      pre.value = proposed !== null && proposed >= todayIso();
      preStart.value = proposed ?? (valid ? addDays(start.value, -28) : '');
    }

    const perennial = computed(() => plantById(plantId.value).growDays === null);

    function applyProposal() {
      const proposed = props.propose(plantId.value);
      start.value = proposed.start;
      end.value = proposed.end ?? '';
      openEnd.value = proposed.end === null;
    }

    watch(() => props.open, (open) => {
      if (!open) return;
      error.value = '';
      const initial = props.initial ?? {};
      if (initial.plantId) plantId.value = initial.plantId;
      kind.value = PLANTING_KINDS.includes(initial.kind) ? initial.kind : 'area';
      datesChosen = Boolean(initial.start);
      if (datesChosen) {
        start.value = initial.start;
        end.value = initial.end ?? '';
        openEnd.value = initial.end === null;
      } else {
        applyProposal();
      }
      preChosen = Boolean(initial.keepPre);
      if (preChosen) {
        pre.value = Boolean(initial.preStart);
        preStart.value = initial.preStart ?? (isIsoDate(start.value) ? addDays(start.value, -28) : '');
      } else {
        proposePre();
      }
    }, { immediate: true }); // the bed editor may open with the dialog already shown

    function setPlant(id) {
      if (!id || id === plantId.value) return;
      plantId.value = id;
      error.value = '';
      if (!datesChosen) {
        applyProposal();
      } else if (perennial.value) {
        openEnd.value = true;
      } else if (openEnd.value || !end.value) {
        // an annual after a perennial: propose an end for the chosen start
        openEnd.value = false;
        end.value = props.propose(id, start.value).end ?? '';
      }
      proposePre();
    }

    function onDate() {
      datesChosen = true;
      error.value = '';
      proposePre();
    }

    function onPre() {
      preChosen = true;
      error.value = '';
    }

    function setOpenEnd(event) {
      openEnd.value = event.target.checked;
      datesChosen = true;
      error.value = '';
      if (!openEnd.value && !end.value) end.value = props.propose(plantId.value, start.value).end ?? '';
    }

    function submit() {
      const until = openEnd.value ? null : end.value;
      const before = pre.value ? preStart.value : null;
      const problem = periodError(start.value, until, before);
      if (problem) {
        error.value = t(`planting.errors.${problem}`);
        return;
      }
      const year = yearOf(start.value);
      if (props.isLocked(year)) {
        error.value = t('bed.locked', { year });
        return;
      }
      emit('submit', { plantId: plantId.value, kind: kind.value, start: start.value, end: until, preStart: before });
      emit('update:open', false);
    }

    return { t, plantId, kind, start, end, openEnd, error, pre, preStart, onPre, PLANTING_KINDS, KIND_ICONS, setPlant, onDate, setOpenEnd, submit };
  },
  template: `
    <AppDialog :open="open" :title="t('bed.add.title', { bed: bedName })" @update:open="$emit('update:open', $event)">
      <form id="add-planting-form" class="settings-list" novalidate @submit.prevent="submit">
        <PlantSelect :model-value="plantId" placement="bed" :label="t('planting.plant')" :advice="advice" @update:model-value="setPlant" />

        <fieldset class="field">
          <legend>{{ t('bed.add.period') }}</legend>
          <div class="size-grid">
            <div class="field">
              <label for="add-planting-start">{{ t('planting.start') }}</label>
              <input id="add-planting-start" v-model="start" class="input" type="date" required @change="onDate" />
            </div>
            <div class="field">
              <label for="add-planting-end">{{ t('planting.end') }}</label>
              <input id="add-planting-end" v-model="end" class="input" type="date" :min="start" :disabled="openEnd" @change="onDate" />
            </div>
          </div>
          <label class="checkbox-row">
            <input type="checkbox" :checked="openEnd" @change="setOpenEnd" />
            <span>{{ t('planting.openEnd') }}</span>
          </label>
          <p class="field-hint">{{ t('bed.add.periodHint') }}</p>
          <label class="checkbox-row">
            <input type="checkbox" v-model="pre" @change="onPre" />
            <span>{{ t('planting.pre') }}</span>
          </label>
          <div v-if="pre" class="field">
            <label for="add-planting-pre">{{ t('planting.preStart') }}</label>
            <input id="add-planting-pre" v-model="preStart" class="input" type="date" :max="start" @change="onPre" />
            <p class="field-hint">{{ t('planting.preHint') }}</p>
          </div>
          <p v-if="error" class="field-error" role="alert">{{ error }}</p>
        </fieldset>

        <fieldset class="field">
          <legend>{{ t('bed.add.where') }}</legend>
          <div class="choice-group">
            <label class="choice" v-for="name in PLANTING_KINDS" :key="name">
              <input type="radio" name="add-planting-kind" :value="name" v-model="kind" />
              <span><AppIcon :name="KIND_ICONS[name]" />{{ t('bed.add.kinds.' + name) }}</span>
            </label>
          </div>
          <p class="field-hint">{{ t('bed.add.kindHint.' + kind) }}</p>
        </fieldset>
      </form>
      <template #actions>
        <button type="button" class="btn btn-text" @click="$emit('update:open', false)">{{ t('common.cancel') }}</button>
        <button type="submit" form="add-planting-form" class="btn btn-primary">{{ t('bed.add.submit.' + kind) }}</button>
      </template>
    </AppDialog>
  `,
};
