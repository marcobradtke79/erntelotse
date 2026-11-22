// The plant catalog of the active garden: built-in plants with overrides and custom plants.
// Components use plantById/plantLabel instead of the built-in getPlant so custom plants work.

import { computed } from 'vue';
import { PLANTS } from '../data/plants.js';
import { buildCatalog } from '../logic/catalog.js';
import { gardens } from './gardens.js';

export const catalog = computed(() => buildCatalog(PLANTS, gardens.active?.plantOverrides, gardens.active?.customPlants));

export function plantById(id) {
  return catalog.value.get(id);
}

/** Display name: the user's name for custom plants, the translation for built-ins. */
export function plantLabel(plant, t) {
  if (plant.custom) return plant.name;
  if (plant.id === 'unknown') return t('planting.unknownPlant');
  return t(`plants.${plant.id}`);
}

export function plantNameById(id, t) {
  return plantLabel(plantById(id), t);
}
