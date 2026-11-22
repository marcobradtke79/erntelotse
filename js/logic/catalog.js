// The plant catalog of a garden: built-in plants with the user's overrides,
// plus the garden's custom plants (docs/concept.md §4.3, §5). Pure module.

import { UNKNOWN_PLANT } from '../data/plants.js';
import { FAMILY_IDS } from '../data/families.js';
import { ID_PATTERN } from './ids.js';
import { isoWeekMonday } from './climate.js';
import { addDays } from './dates.js';

export const CATEGORIES = ['vegetable', 'herb', 'berry', 'fruitTree', 'shrub'];
export const PLACEMENTS = ['bed', 'tree', 'shrub'];
export const LIFECYCLES = ['annual', 'biennial', 'perennial'];
export const FEEDERS = ['heavy', 'medium', 'light', 'fixer'];
export const WINDOW_KINDS = ['sowIndoor', 'sowOutdoor', 'plantOut', 'harvest'];
export const CARE_TYPES = ['care', 'fertilize', 'prune', 'water'];
export const CUSTOM_NAME_MAX_LENGTH = 60;

/** Fields of a built-in plant that a user may override. */
export const OVERRIDABLE = ['spacing', 'growDays', 'harvestDays', 'windows'];

function merge(plant, override) {
  if (!override) return plant;
  const merged = { ...plant };
  for (const key of OVERRIDABLE) {
    if (!(key in override)) continue;
    merged[key] = key === 'spacing' || key === 'windows' ? { ...plant[key], ...override[key] } : override[key];
  }
  merged.overridden = true;
  return merged;
}

/** Fills in fields a custom plant may lack, so the rest of the app can rely on them. */
function completeCustom(plant) {
  return {
    ...UNKNOWN_PLANT,
    ...plant,
    windows: { ...UNKNOWN_PLANT.windows, ...plant.windows },
    companions: { good: [], bad: [] },
    custom: true,
  };
}

/**
 * @returns {{ get(id): object, has(id): boolean, all(): object[] }}
 */
export function buildCatalog(builtIns, overrides = {}, customPlants = []) {
  const map = new Map();
  for (const plant of builtIns) map.set(plant.id, merge(plant, overrides?.[plant.id]));
  for (const plant of customPlants ?? []) map.set(plant.id, completeCustom(plant));
  return {
    get: (id) => map.get(id) ?? UNKNOWN_PLANT,
    has: (id) => map.has(id),
    all: () => [...map.values()],
  };
}

/** Only the fields that differ from the built-in plant; null when nothing differs. */
export function diffOverride(builtIn, edited) {
  const override = {};
  for (const key of OVERRIDABLE) {
    if (JSON.stringify(builtIn[key]) !== JSON.stringify(edited[key])) override[key] = edited[key];
  }
  return Object.keys(override).length ? override : null;
}

// A week belongs to the month of its Thursday, in a reference year with 52 weeks.
const REFERENCE_YEAR = 2025;
const monthOfWeek = (week) => Number(addDays(isoWeekMonday(REFERENCE_YEAR, week), 3).slice(5, 7));
const WEEK_MONTHS = Array.from({ length: 52 }, (_, i) => monthOfWeek(i + 1));

/** Months (1–12) to a week window: [first week of `from`, last week of `to`]. */
export function monthsToWeeks(from, to) {
  return [WEEK_MONTHS.indexOf(from) + 1, WEEK_MONTHS.lastIndexOf(to) + 1];
}

/** Week window to months (1–12), the inverse of monthsToWeeks for display and editing. */
export function weeksToMonths([from, to]) {
  const month = (week) => WEEK_MONTHS[Math.min(52, Math.max(1, week)) - 1];
  return [month(from), month(to)];
}

const isNumber = (value) => typeof value === 'number' && Number.isFinite(value);
const isWindow = (value) => Array.isArray(value) && value.length === 2 && value.every((week) => Number.isInteger(week) && week >= 1 && week <= 53) && value[0] <= value[1];

function checkWindows(windows, problems) {
  if (windows === undefined) return;
  if (!windows || typeof windows !== 'object') {
    problems.push('windows');
    return;
  }
  for (const [kind, list] of Object.entries(windows)) {
    if (!WINDOW_KINDS.includes(kind) || !Array.isArray(list) || !list.every(isWindow)) problems.push('windows');
  }
}

function checkSpacing(spacing, problems) {
  if (spacing === undefined) return;
  if (!spacing || !isNumber(spacing.row) || !isNumber(spacing.plant) || spacing.row <= 0 || spacing.plant <= 0) problems.push('spacing');
}

/** Structural check of a custom plant. Returns problem codes. */
export function validateCustomPlant(plant) {
  const problems = [];
  if (typeof plant.id !== 'string' || !ID_PATTERN.test(plant.id)) problems.push('id');
  if (typeof plant.name !== 'string' || plant.name.trim() === '' || plant.name.length > CUSTOM_NAME_MAX_LENGTH) problems.push('name');
  if (!CATEGORIES.includes(plant.category)) problems.push('category');
  if (!PLACEMENTS.includes(plant.placement)) problems.push('placement');
  if (!LIFECYCLES.includes(plant.lifecycle)) problems.push('lifecycle');
  if (plant.family !== null && !FAMILY_IDS.includes(plant.family)) problems.push('family');
  if (plant.feeder !== undefined && !FEEDERS.includes(plant.feeder)) problems.push('feeder');
  if (typeof plant.color !== 'string' || !/^#[0-9A-Fa-f]{6}$/.test(plant.color)) problems.push('color');
  checkSpacing(plant.spacing, problems);
  if (plant.spacing === undefined) problems.push('spacing');
  if (plant.growDays !== null && (!Number.isInteger(plant.growDays) || plant.growDays <= 0)) problems.push('growDays');
  checkWindows(plant.windows, problems);
  return problems;
}

/** Structural check of the overrides object { plantId: { spacing?, growDays?, harvestDays?, windows? } }. */
export function validateOverrides(overrides) {
  const problems = [];
  for (const [id, override] of Object.entries(overrides)) {
    if (!override || typeof override !== 'object') {
      problems.push(id);
      continue;
    }
    const local = [];
    for (const key of Object.keys(override)) if (!OVERRIDABLE.includes(key)) local.push(key);
    checkSpacing(override.spacing, local);
    checkWindows(override.windows, local);
    if ('growDays' in override && override.growDays !== null && (!Number.isInteger(override.growDays) || override.growDays <= 0)) local.push('growDays');
    if ('harvestDays' in override && (!Number.isInteger(override.harvestDays) || override.harvestDays <= 0)) local.push('harvestDays');
    if (local.length) problems.push(id);
  }
  return problems;
}
