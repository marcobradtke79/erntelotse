// Seed stock and what the plan needs from it (docs/concept.md §4.6). Pure module.
//
// stock entry: { id, plantId, variety, seeds, useBy, note }
//   seeds: whole number of seeds in stock; useBy: year until which they should be used, or null
// need of a planting: { kind: 'seeds' | 'youngPlants', count, area, on, taskKey }
//   area: square metres the planting covers (0 for single plants)
//   pre-cultivated or sown directly → seeds; planted out without pre-cultivation → young plants

import { newId } from './ids.js';
import { addDays, yearOf } from './dates.js';
import { plantCount, shapeArea } from './plantings.js';
import { hintKey } from './hints.js';

/** Seeds sown per planned plant: a reserve for seeds that do not come up and for thinning */
export const SEEDS_PER_PLANT = 2;
/** A sowing counts as still ahead for this long after its date (the sowing task runs that long) */
export const SOWING_GRACE_DAYS = 14;
/** Above this many seeds the shopping list names the area to sow instead of a seed count */
export const SEED_COUNT_LIMIT = 10;
export const VARIETY_MAX_LENGTH = 80;
export const SEED_NOTE_MAX_LENGTH = 500;
export const MAX_SEEDS = 1000000;

export function createSeedEntry({ plantId, variety = '', seeds, useBy = null, note = '' }) {
  return { id: newId('s'), plantId, variety: variety.trim(), seeds, useBy, note };
}

/** Structural check of a stock entry. Returns problem codes. */
export function validateSeedEntry(entry) {
  const problems = [];
  if (typeof entry.plantId !== 'string' || entry.plantId === '') problems.push('plantId');
  if (typeof entry.variety !== 'string' || entry.variety.length > VARIETY_MAX_LENGTH) problems.push('variety');
  if (!Number.isInteger(entry.seeds) || entry.seeds < 0 || entry.seeds > MAX_SEEDS) problems.push('seeds');
  if (entry.useBy !== null && (!Number.isInteger(entry.useBy) || entry.useBy < 2000 || entry.useBy > 2100)) problems.push('useBy');
  if (typeof entry.note !== 'string' || entry.note.length > SEED_NOTE_MAX_LENGTH) problems.push('note');
  return problems;
}

/** What a planting needs to get started, and the key of the task that uses it up. */
export function seedNeed(planting, plant) {
  const plants = plantCount(planting, plant);
  const area = shapeArea(planting.shape);
  if (planting.preStart) {
    return { kind: 'seeds', count: plants * SEEDS_PER_PLANT, area, on: planting.preStart, taskKey: hintKey(planting.id, 'sow', 'sowIndoor', planting.preStart) };
  }
  if (plant.windows?.plantOut?.length) {
    return { kind: 'youngPlants', count: plants, area, on: planting.start, taskKey: hintKey(planting.id, 'plant', 'plantOut', planting.start) };
  }
  return { kind: 'seeds', count: plants * SEEDS_PER_PLANT, area, on: planting.start, taskKey: hintKey(planting.id, 'sow', 'sowOutdoor', planting.start) };
}

/**
 * Needs that are still ahead: the sowing or planting date is not longer ago than the
 * grace period and its task is neither done nor skipped.
 * @param catalog { get(id) }
 */
export function openNeeds(garden, catalog, today) {
  const earliest = addDays(today, -SOWING_GRACE_DAYS);
  return garden.plantings
    .map((planting) => ({ plantId: planting.plantId, plantingId: planting.id, ...seedNeed(planting, catalog.get(planting.plantId)) }))
    .filter((need) => need.on >= earliest && !garden.taskStates?.[need.taskKey]);
}

const round2 = (value) => Math.round(value * 100) / 100;

/** plantId → { total, entries } */
export function stockByPlant(seedStock) {
  const map = new Map();
  for (const entry of seedStock ?? []) {
    if (!map.has(entry.plantId)) map.set(entry.plantId, { total: 0, entries: [] });
    const group = map.get(entry.plantId);
    group.total += entry.seeds;
    group.entries.push(entry);
  }
  return map;
}

/**
 * The plan against the stock.
 * seeds:       [{ plantId, need, have, missing, area, missingArea, firstOn, expired }] – every plant with a seed need.
 *              Large needs are better read as an area: `area` is what is to be sown (m²) and `missingArea`
 *              the part of it the stock does not cover; both are null for small needs and for single plants.
 * youngPlants: [{ plantId, count, firstOn }]
 * both sorted by the date they are first needed. `expired`: some of the stock is past its use-by year.
 */
export function shoppingList(garden, catalog, today) {
  const stock = stockByPlant(garden.seedStock);
  const seeds = new Map();
  const young = new Map();
  for (const need of openNeeds(garden, catalog, today)) {
    const target = need.kind === 'seeds' ? seeds : young;
    if (!target.has(need.plantId)) target.set(need.plantId, { plantId: need.plantId, count: 0, area: 0, firstOn: need.on });
    const item = target.get(need.plantId);
    item.count += need.count;
    item.area += need.area;
    if (need.on < item.firstOn) item.firstOn = need.on;
  }
  const byDate = (a, b) => a.firstOn.localeCompare(b.firstOn) || a.plantId.localeCompare(b.plantId);
  return {
    seeds: [...seeds.values()].map((item) => {
      const group = stock.get(item.plantId);
      const have = group?.total ?? 0;
      const year = yearOf(item.firstOn);
      const missing = Math.max(0, item.count - have);
      const byArea = item.count > SEED_COUNT_LIMIT && item.area > 0;
      return {
        plantId: item.plantId,
        need: item.count,
        have,
        missing,
        area: byArea ? round2(item.area) : null,
        missingArea: byArea ? round2((item.area * missing) / item.count) : null,
        firstOn: item.firstOn,
        expired: Boolean(group?.entries.some((entry) => entry.seeds > 0 && entry.useBy !== null && entry.useBy < year)),
      };
    }).sort(byDate),
    youngPlants: [...young.values()].map(({ plantId, count, firstOn }) => ({ plantId, count, firstOn })).sort(byDate),
  };
}

/**
 * Takes up to `count` seeds of a plant out of the stock, from the entries that have to be
 * used first. Returns the new stock and what was taken: used = [{ id, count }].
 */
export function takeSeeds(seedStock, plantId, count) {
  const order = (seedStock ?? [])
    .filter((entry) => entry.plantId === plantId && entry.seeds > 0)
    .sort((a, b) => (a.useBy ?? Infinity) - (b.useBy ?? Infinity));
  const used = [];
  let left = count;
  for (const entry of order) {
    if (left <= 0) break;
    const taken = Math.min(entry.seeds, left);
    used.push({ id: entry.id, count: taken });
    left -= taken;
  }
  const byId = new Map(used.map((item) => [item.id, item.count]));
  return {
    seedStock: (seedStock ?? []).map((entry) => (byId.has(entry.id) ? { ...entry, seeds: entry.seeds - byId.get(entry.id) } : { ...entry })),
    used,
  };
}

/** Puts back what a sowing took; entries deleted in the meantime are skipped. */
export function returnSeeds(seedStock, used) {
  const byId = new Map((used ?? []).map((item) => [item.id, item.count]));
  return (seedStock ?? []).map((entry) => (byId.has(entry.id) ? { ...entry, seeds: Math.min(MAX_SEEDS, entry.seeds + byId.get(entry.id)) } : { ...entry }));
}
