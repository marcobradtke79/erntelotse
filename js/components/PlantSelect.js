// Plant picker for a placement (bed, tree, shrub or all), grouped by category, sorted by name.
// With `advice` (plantId → 'good' | 'bad' | 'rotation'), good neighbours come first in their
// own group and bad neighbours / rotation conflicts are marked in words.

import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { catalog, plantLabel } from '../stores/catalog.js';

let counter = 0;

export default {
  name: 'PlantSelect',
  props: {
    modelValue: { type: String, default: null },
    placement: { type: String, default: 'bed' },
    label: { type: String, required: true },
    allowNone: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
    hideLabel: { type: Boolean, default: false },
    advice: { type: Object, default: () => ({}) },
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    const { t, locale } = useI18n();
    const id = `plant-select-${++counter}`;
    const byName = (a, b) => a.name.localeCompare(b.name, locale.value);

    function option(plant) {
      const advice = props.advice[plant.id];
      const name = plantLabel(plant, t);
      const suffix = advice === 'bad' ? t('rotation.picker.bad') : advice === 'rotation' ? t('rotation.picker.rotation') : '';
      return { id: plant.id, name, text: suffix ? `${name} – ${suffix}` : name };
    }

    const groups = computed(() => {
      const plants = catalog.value.all().filter((item) => props.placement === 'all' || item.placement === props.placement);
      const result = [];
      const good = plants.filter((plant) => props.advice[plant.id] === 'good');
      if (good.length) result.push({ key: 'good', label: t('rotation.picker.goodGroup'), plants: good.map(option).sort(byName) });
      const byCategory = new Map();
      for (const plant of plants) {
        if (props.advice[plant.id] === 'good') continue;
        if (!byCategory.has(plant.category)) byCategory.set(plant.category, []);
        byCategory.get(plant.category).push(option(plant));
      }
      for (const [category, list] of byCategory) {
        result.push({ key: category, label: t(`plantCategories.${category}`), plants: list.sort(byName) });
      }
      return result;
    });

    function onChange(event) {
      emit('update:modelValue', event.target.value === '' ? null : event.target.value);
    }
    return { t, id, groups, onChange };
  },
  template: `
    <div class="field">
      <label :for="id" :class="{ 'visually-hidden': hideLabel }">{{ label }}</label>
      <select :id="id" class="select" :value="modelValue ?? ''" :disabled="disabled" @change="onChange">
        <option v-if="allowNone" value="">{{ t('planting.noPlant') }}</option>
        <optgroup v-for="group in groups" :key="group.key" :label="group.label">
          <option v-for="plant in group.plants" :key="plant.id" :value="plant.id">{{ plant.text }}</option>
        </optgroup>
      </select>
    </div>
  `,
};
