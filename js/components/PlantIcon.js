// Plant icon from the sprite (docs/design-rules.md §4.1). Built-in plants have their
// own icon; custom and unknown plants show their category icon in the plant's colour.
// Decorative: the plant's name is always shown next to it.

import { computed } from 'vue';
import { plantById } from '../stores/catalog.js';
import { isKnownPlant } from '../data/plants.js';

const SPRITE = new URL('../../assets/icons/plants/plants.svg', import.meta.url).href;

export default {
  name: 'PlantIcon',
  props: {
    plantId: { type: String, required: true },
    size: { type: Number, default: 24 },
  },
  setup(props) {
    const icon = computed(() => {
      const plant = plantById(props.plantId);
      if (isKnownPlant(props.plantId)) return { href: `${SPRITE}#plant-${props.plantId}`, color: null };
      return { href: `${SPRITE}#category-${plant.category ?? 'vegetable'}`, color: plant.color };
    });
    return { icon };
  },
  template: `
    <svg class="plant-icon" :width="size" :height="size" viewBox="0 0 48 48" aria-hidden="true" focusable="false" :style="icon.color ? { color: icon.color } : null">
      <use :href="icon.href" />
    </svg>
  `,
};
