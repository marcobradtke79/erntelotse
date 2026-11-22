// Create or edit a custom plant, or adjust a built-in plant (spacing, times, windows).
// Windows are edited in months; unchanged windows keep their exact catalog weeks.

import { reactive, ref, computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { PLANTS } from '../../data/plants.js';
import { FAMILY_IDS } from '../../data/families.js';
import {
  CATEGORIES, PLACEMENTS, LIFECYCLES, WINDOW_KINDS, CUSTOM_NAME_MAX_LENGTH,
  monthsToWeeks, weeksToMonths, diffOverride, validateCustomPlant,
} from '../../logic/catalog.js';
import { newId } from '../../logic/ids.js';
import { saveCustomPlant, setOverride } from '../../stores/gardens.js';
import { settings } from '../../stores/settings.js';
import { plantLabel } from '../../stores/catalog.js';
import { showToast } from '../../stores/toast.js';
import AppDialog from '../AppDialog.js';
import AppIcon from '../AppIcon.js';
import LengthInput from '../LengthInput.js';

const DEFAULT_COLOR = '#6FAE4F';

function emptyDraft() {
  return {
    name: '', category: 'vegetable', placement: 'bed', lifecycle: 'annual', family: '', color: DEFAULT_COLOR,
    row: 0.3, plant: 0.3, growDays: 90, harvestDays: 21,
    windows: Object.fromEntries(WINDOW_KINDS.map((kind) => [kind, []])),
  };
}

export default {
  name: 'PlantFormDialog',
  components: { AppDialog, AppIcon, LengthInput },
  props: {
    open: { type: Boolean, default: false },
    /** null: new custom plant; otherwise the catalog entry to edit */
    plant: { type: Object, default: null },
  },
  emits: ['update:open', 'saved'],
  setup(props, { emit }) {
    const { t, locale } = useI18n();
    const draft = reactive(emptyDraft());
    const errors = ref([]);
    const builtIn = computed(() => (props.plant && !props.plant.custom ? props.plant : null));
    const title = computed(() => {
      if (!props.plant) return t('plantsView.form.newTitle');
      return t('plantsView.form.editTitle', { name: plantLabel(props.plant, t) });
    });
    const monthNames = computed(() => {
      const format = new Intl.DateTimeFormat(locale.value, { month: 'long', timeZone: 'UTC' });
      return Array.from({ length: 12 }, (_, i) => format.format(new Date(Date.UTC(2025, i, 1))));
    });
    const families = computed(() => FAMILY_IDS.map((id) => ({ id, name: t(`families.${id}`) })).sort((a, b) => a.name.localeCompare(b.name, locale.value)));

    function load() {
      Object.assign(draft, emptyDraft());
      errors.value = [];
      const plant = props.plant;
      if (!plant) return;
      Object.assign(draft, {
        name: plant.custom ? plant.name : '',
        category: plant.category,
        placement: plant.placement,
        lifecycle: plant.lifecycle,
        family: plant.family ?? '',
        color: plant.color,
        row: plant.spacing.row,
        plant: plant.spacing.plant,
        growDays: plant.growDays,
        harvestDays: plant.harvestDays,
        windows: Object.fromEntries(WINDOW_KINDS.map((kind) => [kind, (plant.windows[kind] ?? []).map((weeks) => {
          const [from, to] = weeksToMonths(weeks);
          return { from, to, weeks };
        })])),
      });
    }

    watch(() => props.open, (open) => {
      if (open) load();
    });

    function addWindow(kind) {
      draft.windows[kind].push({ from: 4, to: 5, weeks: null });
    }

    function removeWindow(kind, index) {
      draft.windows[kind].splice(index, 1);
    }

    /** Month rows back to week windows; untouched rows keep their exact weeks. */
    function weekWindows() {
      return Object.fromEntries(WINDOW_KINDS.map((kind) => [kind, draft.windows[kind].map((row) => {
        const from = Number(row.from);
        const to = Number(row.to);
        if (row.weeks) {
          const [oldFrom, oldTo] = weeksToMonths(row.weeks);
          if (oldFrom === from && oldTo === to) return row.weeks;
        }
        return monthsToWeeks(from, to);
      })]));
    }

    function check() {
      const problems = [];
      if (!builtIn.value && draft.name.trim() === '') problems.push('name');
      if (WINDOW_KINDS.some((kind) => draft.windows[kind].some((row) => Number(row.from) > Number(row.to)))) problems.push('windowOrder');
      const perennial = (builtIn.value?.lifecycle ?? draft.lifecycle) === 'perennial';
      if (!perennial && (!Number.isInteger(Number(draft.growDays)) || Number(draft.growDays) <= 0)) problems.push('growDays');
      if (!Number.isInteger(Number(draft.harvestDays)) || Number(draft.harvestDays) <= 0) problems.push('harvestDays');
      return problems;
    }

    function save() {
      errors.value = check();
      if (errors.value.length) return;
      const spacing = { row: draft.row, plant: draft.plant };
      const windows = weekWindows();
      if (builtIn.value) {
        const original = PLANTS.find((plant) => plant.id === builtIn.value.id);
        const edited = { ...original, spacing, growDays: original.growDays === null ? null : Number(draft.growDays), harvestDays: Number(draft.harvestDays), windows };
        setOverride(original.id, diffOverride(original, edited));
        showToast('plantsView.form.saved');
        emit('saved', builtIn.value);
        emit('update:open', false);
        return;
      }
      const plant = {
        id: props.plant?.id ?? newId('c'),
        name: draft.name.trim().slice(0, CUSTOM_NAME_MAX_LENGTH),
        category: draft.category,
        placement: draft.placement,
        lifecycle: draft.lifecycle,
        family: draft.family || null,
        feeder: 'medium',
        color: draft.color.toUpperCase(),
        spacing,
        growDays: draft.lifecycle === 'perennial' ? null : Number(draft.growDays),
        harvestDays: Number(draft.harvestDays),
        windows,
        care: [],
      };
      const problems = validateCustomPlant(plant);
      if (problems.length) {
        console.error('Invalid custom plant', problems);
        errors.value = ['invalid'];
        return;
      }
      saveCustomPlant(plant);
      showToast('plantsView.form.saved');
      emit('saved', plant);
      emit('update:open', false);
    }

    return {
      t, settings, draft, errors, builtIn, title, monthNames, families, CATEGORIES, PLACEMENTS, LIFECYCLES, WINDOW_KINDS,
      CUSTOM_NAME_MAX_LENGTH, addWindow, removeWindow, save,
    };
  },
  template: `
    <AppDialog :open="open" :title="title" @update:open="$emit('update:open', $event)">
      <form id="plant-form" class="settings-list plant-form" novalidate @submit.prevent="save">
        <template v-if="!builtIn">
          <div class="field">
            <label for="plant-name">{{ t('common.name') }}</label>
            <input id="plant-name" v-model="draft.name" class="input" type="text" :maxlength="CUSTOM_NAME_MAX_LENGTH" autocomplete="off" autofocus
              :aria-invalid="errors.includes('name') ? 'true' : 'false'" />
            <p v-if="errors.includes('name')" class="field-error">{{ t('common.required') }}</p>
          </div>
          <div class="size-grid">
            <div class="field">
              <label for="plant-placement">{{ t('plantsView.form.placement') }}</label>
              <select id="plant-placement" v-model="draft.placement" class="select">
                <option v-for="item in PLACEMENTS" :key="item" :value="item">{{ t('plantsView.placement.' + item) }}</option>
              </select>
            </div>
            <div class="field">
              <label for="plant-category">{{ t('plantsView.category') }}</label>
              <select id="plant-category" v-model="draft.category" class="select">
                <option v-for="item in CATEGORIES" :key="item" :value="item">{{ t('plantCategories.' + item) }}</option>
              </select>
            </div>
            <div class="field">
              <label for="plant-lifecycle">{{ t('plantsView.form.lifecycle') }}</label>
              <select id="plant-lifecycle" v-model="draft.lifecycle" class="select">
                <option v-for="item in LIFECYCLES" :key="item" :value="item">{{ t('plantsView.lifecycle.' + item) }}</option>
              </select>
            </div>
            <div class="field">
              <label for="plant-family">{{ t('plantsView.family') }}</label>
              <select id="plant-family" v-model="draft.family" class="select">
                <option value="">{{ t('plantsView.form.unknownFamily') }}</option>
                <option v-for="item in families" :key="item.id" :value="item.id">{{ item.name }}</option>
              </select>
            </div>
            <div class="field">
              <label for="plant-color">{{ t('plantsView.form.color') }}</label>
              <input id="plant-color" v-model="draft.color" class="input input-color" type="color" />
            </div>
          </div>
        </template>

        <div class="size-grid">
          <LengthInput v-model="draft.row" :label="t('plantsView.rowSpacing')" :units="settings.units" quantity="short" />
          <LengthInput v-model="draft.plant" :label="t('plantsView.plantSpacing')" :units="settings.units" quantity="short" />
          <div class="field" v-if="(builtIn ? builtIn.lifecycle : draft.lifecycle) !== 'perennial'">
            <label for="plant-grow-days">{{ t('plantsView.growDays') }}</label>
            <input id="plant-grow-days" v-model="draft.growDays" class="input" type="number" min="1" step="1" inputmode="numeric"
              :aria-invalid="errors.includes('growDays') ? 'true' : 'false'" />
            <p v-if="errors.includes('growDays')" class="field-error">{{ t('plantsView.form.positiveDays') }}</p>
          </div>
          <div class="field">
            <label for="plant-harvest-days">{{ t('plantsView.harvestDays') }}</label>
            <input id="plant-harvest-days" v-model="draft.harvestDays" class="input" type="number" min="1" step="1" inputmode="numeric"
              :aria-invalid="errors.includes('harvestDays') ? 'true' : 'false'" />
            <p v-if="errors.includes('harvestDays')" class="field-error">{{ t('plantsView.form.positiveDays') }}</p>
          </div>
        </div>

        <fieldset v-for="kind in WINDOW_KINDS" :key="kind" class="field window-field">
          <legend>{{ t('plantsView.windows.' + kind) }}</legend>
          <div v-for="(row, index) in draft.windows[kind]" :key="index" class="window-row">
            <label class="visually-hidden" :for="kind + '-from-' + index">{{ t('plantsView.form.from') }}</label>
            <select :id="kind + '-from-' + index" v-model.number="row.from" class="select">
              <option v-for="(name, m) in monthNames" :key="m" :value="m + 1">{{ name }}</option>
            </select>
            <span aria-hidden="true">–</span>
            <label class="visually-hidden" :for="kind + '-to-' + index">{{ t('plantsView.form.to') }}</label>
            <select :id="kind + '-to-' + index" v-model.number="row.to" class="select">
              <option v-for="(name, m) in monthNames" :key="m" :value="m + 1">{{ name }}</option>
            </select>
            <button type="button" class="btn btn-icon" :title="t('common.delete')" @click="removeWindow(kind, index)">
              <AppIcon name="close" :label="t('common.delete')" />
            </button>
          </div>
          <button type="button" class="btn btn-text window-add" @click="addWindow(kind)">
            <AppIcon name="plus" />
            <span>{{ t('plantsView.form.addWindow') }}</span>
          </button>
        </fieldset>
        <p v-if="errors.includes('windowOrder')" class="field-error">{{ t('plantsView.form.windowOrder') }}</p>
        <p v-if="errors.includes('invalid')" class="field-error">{{ t('plantsView.form.invalid') }}</p>
        <p v-if="builtIn" class="field-hint">{{ t('plantsView.form.overrideHint') }}</p>
      </form>
      <template #actions>
        <button type="button" class="btn btn-text" @click="$emit('update:open', false)">{{ t('common.cancel') }}</button>
        <button type="submit" form="plant-form" class="btn btn-primary">{{ t('common.save') }}</button>
      </template>
    </AppDialog>
  `,
};
