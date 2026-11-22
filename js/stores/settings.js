// App settings: language, units, theme, weather on/off, active garden. Persisted on every change.

import { reactive } from 'vue';
import { detectLanguage } from '../i18n/languages.js';
import { validateSettings } from '../logic/validate.js';
import { isQuotaError, StorageQuotaError } from '../services/storage.js';
import { showError } from './toast.js';

export const settings = reactive({
  language: 'en',
  units: 'metric',
  theme: 'system',
  weather: true,
  activeGardenId: null,
});

let storage = null;

export function defaultSettings() {
  return {
    language: detectLanguage(globalThis.navigator?.languages ?? [globalThis.navigator?.language]),
    units: 'metric',
    theme: 'system',
    weather: true,
    activeGardenId: null,
  };
}

export function initSettings(storageService) {
  storage = storageService;
  Object.assign(settings, defaultSettings(), storage.readSettings() ?? {});
}

function save() {
  try {
    storage.writeSettings({ ...settings });
  } catch (error) {
    showError(error instanceof StorageQuotaError || isQuotaError(error) ? 'errors.quota' : 'errors.saveFailed');
  }
}

function update(changes) {
  const next = { ...settings, ...changes };
  if (validateSettings(next).length > 0) return false;
  Object.assign(settings, changes);
  save();
  return true;
}

export const setLanguage = (language) => update({ language });
export const setUnits = (units) => update({ units });
export const setTheme = (theme) => update({ theme });
export const setWeather = (weather) => update({ weather });
export const setActiveGardenId = (activeGardenId) => update({ activeGardenId });

/** Replaces all settings, e.g. from a backup. */
export function replaceSettings(values) {
  update({ ...defaultSettings(), ...values });
}

export function resetSettings() {
  Object.assign(settings, defaultSettings());
}
