// Structural validation of stored and imported data. Pure module.
// Each function returns a list of problems: [{ path, code }]; empty means valid.
// Codes: required | type | format | range | unknown

import { ID_PATTERN } from './ids.js';
import { GARDEN_NAME_MAX_LENGTH } from './gardenModel.js';
import { UNIT_SYSTEMS } from './units.js';
import { LANGUAGE_CODES } from '../i18n/languages.js';
import { validateElement } from './elements.js';
import { validatePlanting } from './plantings.js';
import { validateSeedEntry } from './seeds.js';
import { validateCustomPlant, validateOverrides } from './catalog.js';
import { validateJournalEntry, validateTaskStates } from './tasks.js';

export const THEMES = ['system', 'light', 'dark'];

const ISO_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const isNumber = (value) => typeof value === 'number' && Number.isFinite(value);

function checkDateTime(problems, path, value) {
  if (typeof value !== 'string') problems.push({ path, code: 'type' });
  else if (!ISO_DATETIME.test(value) || Number.isNaN(Date.parse(value))) problems.push({ path, code: 'format' });
}

function checkItemsWithId(problems, path, value) {
  if (!Array.isArray(value)) {
    problems.push({ path, code: 'type' });
    return;
  }
  const seen = new Set();
  value.forEach((item, index) => {
    if (!isObject(item)) problems.push({ path: `${path}[${index}]`, code: 'type' });
    else if (typeof item.id !== 'string' || !ID_PATTERN.test(item.id)) problems.push({ path: `${path}[${index}].id`, code: 'format' });
    else if (seen.has(item.id)) problems.push({ path: `${path}[${index}].id`, code: 'duplicate' });
    else seen.add(item.id);
  });
}

export function validateGarden(doc) {
  const problems = [];
  if (!isObject(doc)) return [{ path: '', code: 'type' }];

  if (!Number.isInteger(doc.schemaVersion) || doc.schemaVersion < 1) problems.push({ path: 'schemaVersion', code: 'format' });

  if (typeof doc.id !== 'string') problems.push({ path: 'id', code: 'type' });
  else if (!ID_PATTERN.test(doc.id)) problems.push({ path: 'id', code: 'format' });

  if (typeof doc.name !== 'string') problems.push({ path: 'name', code: 'type' });
  else if (doc.name.trim() === '') problems.push({ path: 'name', code: 'required' });
  else if (doc.name.length > GARDEN_NAME_MAX_LENGTH) problems.push({ path: 'name', code: 'range' });

  checkDateTime(problems, 'createdAt', doc.createdAt);
  checkDateTime(problems, 'updatedAt', doc.updatedAt);

  if (doc.location !== null) {
    if (!isObject(doc.location)) problems.push({ path: 'location', code: 'type' });
    else {
      const { lat, lng } = doc.location;
      if (!isNumber(lat) || lat < -90 || lat > 90) problems.push({ path: 'location.lat', code: 'range' });
      if (!isNumber(lng) || lng < -180 || lng > 180) problems.push({ path: 'location.lng', code: 'range' });
    }
  }

  if (!isObject(doc.climate)) problems.push({ path: 'climate', code: 'type' });
  else {
    if (!['north', 'south'].includes(doc.climate.hemisphere)) problems.push({ path: 'climate.hemisphere', code: 'unknown' });
    if (!isNumber(doc.climate.shiftWeeks) || Math.abs(doc.climate.shiftWeeks) > 12) problems.push({ path: 'climate.shiftWeeks', code: 'range' });
  }

  for (const key of ['elements', 'plantings', 'customPlants', 'journal', 'seedStock']) {
    checkItemsWithId(problems, key, doc[key]);
  }
  if (Array.isArray(doc.elements)) {
    doc.elements.forEach((element, index) => {
      if (!isObject(element)) return;
      for (const code of validateElement(element)) problems.push({ path: `elements[${index}]`, code: `element.${code}` });
    });
    if (doc.elements.filter((element) => element?.type === 'parcel').length > 1) problems.push({ path: 'elements', code: 'element.parcelCount' });
  }
  if (Array.isArray(doc.plantings)) {
    const bedIds = new Set((Array.isArray(doc.elements) ? doc.elements : []).filter((element) => element?.type === 'bed').map((element) => element.id));
    doc.plantings.forEach((planting, index) => {
      if (!isObject(planting)) return;
      for (const code of validatePlanting(planting)) problems.push({ path: `plantings[${index}]`, code: `planting.${code}` });
      if (typeof planting.bedId === 'string' && !bedIds.has(planting.bedId)) problems.push({ path: `plantings[${index}]`, code: 'planting.unknownBed' });
    });
  }
  for (const key of ['plantOverrides', 'taskStates']) {
    if (!isObject(doc[key])) problems.push({ path: key, code: 'type' });
  }
  if (Array.isArray(doc.customPlants)) {
    doc.customPlants.forEach((plant, index) => {
      if (!isObject(plant)) return;
      for (const code of validateCustomPlant(plant)) problems.push({ path: `customPlants[${index}]`, code: `customPlant.${code}` });
    });
  }
  if (Array.isArray(doc.journal)) {
    doc.journal.forEach((entry, index) => {
      if (!isObject(entry)) return;
      for (const code of validateJournalEntry(entry)) problems.push({ path: `journal[${index}]`, code: `journal.${code}` });
    });
  }
  if (Array.isArray(doc.seedStock)) {
    doc.seedStock.forEach((entry, index) => {
      if (!isObject(entry)) return;
      for (const code of validateSeedEntry(entry)) problems.push({ path: `seedStock[${index}]`, code: `seed.${code}` });
    });
  }
  if (isObject(doc.taskStates)) {
    for (const key of validateTaskStates(doc.taskStates)) problems.push({ path: `taskStates.${key}`, code: 'taskState' });
  }
  if (doc.exportedAt !== undefined && doc.exportedAt !== null) checkDateTime(problems, 'exportedAt', doc.exportedAt);
  if (isObject(doc.plantOverrides)) {
    for (const id of validateOverrides(doc.plantOverrides)) problems.push({ path: `plantOverrides.${id}`, code: 'override' });
  }
  return problems;
}

export function validateSettings(settings) {
  if (!isObject(settings)) return [{ path: '', code: 'type' }];
  const problems = [];
  if (!LANGUAGE_CODES.includes(settings.language)) problems.push({ path: 'language', code: 'unknown' });
  if (!UNIT_SYSTEMS.includes(settings.units)) problems.push({ path: 'units', code: 'unknown' });
  if (!THEMES.includes(settings.theme)) problems.push({ path: 'theme', code: 'unknown' });
  // added in milestone 6; older settings have no value and get the default
  if (settings.weather !== undefined && typeof settings.weather !== 'boolean') problems.push({ path: 'weather', code: 'type' });
  if (settings.activeGardenId !== null && (typeof settings.activeGardenId !== 'string' || !ID_PATTERN.test(settings.activeGardenId))) {
    problems.push({ path: 'activeGardenId', code: 'format' });
  }
  return problems;
}

export function validateIndex(index) {
  if (!Array.isArray(index)) return [{ path: '', code: 'type' }];
  const problems = [];
  index.forEach((entry, i) => {
    if (!isObject(entry) || typeof entry.id !== 'string' || !ID_PATTERN.test(entry.id) || typeof entry.name !== 'string') {
      problems.push({ path: `[${i}]`, code: 'format' });
    }
  });
  return problems;
}
