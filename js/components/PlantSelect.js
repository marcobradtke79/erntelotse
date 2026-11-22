// Plant picker for a placement (bed, tree, shrub), grouped by category, sorted by name.

import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { plantsFor } from '../data/plants.js';

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
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    const { t, locale } = useI18n();
    const id = `plant-select-${++counter}`;
    const groups = computed(() => {
      const byCategory = new Map();
      for (const plant of plantsFor(props.placement)) {
        if (!byCategory.has(plant.category)) byCategory.set(plant.category, []);
        byCategory.get(plant.category).push({ id: plant.id, name: t(`plants.${plant.id}`) });
      }
      return [...byCategory.entries()].map(([category, plants]) => ({
        category,
        label: t(`plantCategories.${category}`),
        plants: plants.sort((a, b) => a.name.localeCompare(b.name, locale.value)),
      }));
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
        <optgroup v-for="group in groups" :key="group.category" :label="group.label">
          <option v-for="plant in group.plants" :key="plant.id" :value="plant.id">{{ plant.name }}</option>
        </optgroup>
      </select>
    </div>
  `,
};
