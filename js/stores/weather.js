// Forecast of the active garden (docs/concept.md §6.5). Loaded when weather is switched on
// and the garden has a location; refreshed when the browser comes back online.
// Failures are silent: without a forecast the dashboard simply shows no weather card.

import { reactive, watch, effectScope } from 'vue';
import { gardens } from './gardens.js';
import { settings } from './settings.js';
import { storage } from '../services/appStorage.js';
import { loadWeather } from '../services/weather.js';

export const weather = reactive({
  gardenId: null,
  days: [],
  fetchedAt: null,
  stale: false,
  loading: false,
});

let request = 0;

function clear() {
  Object.assign(weather, { gardenId: null, days: [], fetchedAt: null, stale: false, loading: false });
}

export async function refreshWeather() {
  const garden = gardens.active;
  if (!settings.weather || !garden?.location) {
    request++;
    clear();
    return;
  }
  const id = ++request;
  const { lat, lng } = garden.location;
  weather.loading = true;
  const result = await loadWeather(garden.id, { lat, lng }, storage);
  if (id !== request) return; // a newer request (other garden or setting) won
  if (!result) {
    clear();
    return;
  }
  Object.assign(weather, { gardenId: garden.id, days: result.days, fetchedAt: result.fetchedAt, stale: result.stale, loading: false });
}

let started = false;

/** Starts watching the active garden; called once by the views that show weather. */
export function useWeather() {
  if (!started) {
    started = true;
    // Detached scope: a watcher created in a component's setup would stop when it unmounts
    effectScope(true).run(() => {
      watch(() => [settings.weather, gardens.active?.id, gardens.active?.location?.lat, gardens.active?.location?.lng], refreshWeather, { immediate: true });
    });
    globalThis.addEventListener?.('online', refreshWeather);
  } else if (!weather.loading && weather.fetchedAt === null) {
    refreshWeather();
  }
  return weather;
}
