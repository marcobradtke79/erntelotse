import { describe, test, expect } from './harness.js';
import {
  seedNeed, openNeeds, shoppingList, stockByPlant, takeSeeds, returnSeeds, createSeedEntry, validateSeedEntry, SEEDS_PER_PLANT,
} from '../js/logic/seeds.js';
import { hintsFor } from '../js/logic/hints.js';
import { validateTaskStates } from '../js/logic/tasks.js';
import { buildCatalog } from '../js/logic/catalog.js';
import { createGarden } from '../js/logic/gardenModel.js';
import { validateGarden } from '../js/logic/validate.js';
import { createElementAt } from '../js/logic/elements.js';
import { createPlanting } from '../js/logic/plantings.js';
import { PLANTS } from '../js/data/plants.js';

const catalog = buildCatalog(PLANTS);
const TODAY = '2026-11-22';
const point = { kind: 'point', at: [1, 1] };
const stock = (id, plantId, seeds, useBy = null) => ({ id, plantId, variety: '', seeds, useBy, note: '' });

function garden(plantings, seedStock = []) {
  const g = createGarden({ name: 'G', id: 'g_seeds' });
  g.elements.push(Object.assign(createElementAt('bed', [2, 0.6], { width: 4, depth: 1.2 }), { id: 'e_bed' }));
  g.plantings = plantings.map((p) => createPlanting({ bedId: 'e_bed', shape: point, end: null, ...p }));
  g.seedStock = seedStock;
  return g;
}

describe('what a planting needs', () => {
  test('pre-cultivated: seeds on the pre-cultivation date, with a reserve', () => {
    const [planting] = garden([{ plantId: 'tomato', start: '2027-05-17', preStart: '2027-03-08', count: 6 }]).plantings;
    const need = seedNeed(planting, catalog.get('tomato'));
    expect([need.kind, need.count, need.on]).toEqual(['seeds', 6 * SEEDS_PER_PLANT, '2027-03-08']);
  });
  test('sown directly: seeds on the bed date', () => {
    const [planting] = garden([{ plantId: 'carrot', start: '2027-03-22', count: 100 }]).plantings;
    const need = seedNeed(planting, catalog.get('carrot'));
    expect([need.kind, need.count, need.on]).toEqual(['seeds', 200, '2027-03-22']);
  });
  test('planted out without pre-cultivation: young plants, not seeds', () => {
    const [planting] = garden([{ plantId: 'tomato', start: '2027-05-17', count: 6 }]).plantings;
    const need = seedNeed(planting, catalog.get('tomato'));
    expect([need.kind, need.count, need.on]).toEqual(['youngPlants', 6, '2027-05-17']);
  });
  test('the task key is the key of the planting\'s sowing task', () => {
    const g = garden([{ plantId: 'tomato', start: '2027-05-17', preStart: '2027-03-08' }, { plantId: 'carrot', start: '2027-03-22' }]);
    const hints = hintsFor(g, catalog, { from: '2027-01-01', to: '2027-12-31' });
    for (const planting of g.plantings) {
      const need = seedNeed(planting, catalog.get(planting.plantId));
      const hint = hints.find((item) => item.key === need.taskKey);
      expect(hint.type).toBe('sow');
      expect(hint.sourceId).toBe(planting.id);
    }
  });
});

describe('shopping list from the plan', () => {
  const plantings = [
    { plantId: 'carrot', start: '2027-03-22', count: 100 },
    { plantId: 'carrot', start: '2027-06-01', count: 20 },
    { plantId: 'tomato', start: '2027-05-17', preStart: '2027-03-08', count: 6 },
    { plantId: 'bellPepper', start: '2027-05-24', count: 4 },
    { plantId: 'lettuce', start: '2026-10-01', count: 10 }, // sown long ago
    { plantId: 'radish', start: '2026-11-12', count: 30 }, // within the grace period
  ];
  test('only sowings still ahead count; done and skipped ones do not', () => {
    const g = garden(plantings);
    expect(openNeeds(g, catalog, TODAY).map((need) => need.plantId).sort()).toEqual(['bellPepper', 'carrot', 'carrot', 'radish', 'tomato']);
    const radish = openNeeds(g, catalog, TODAY).find((need) => need.plantId === 'radish');
    g.taskStates[radish.taskKey] = { state: 'done', on: TODAY };
    expect(openNeeds(g, catalog, TODAY).some((need) => need.plantId === 'radish')).toBeFalsy();
  });
  test('need against stock, per plant, by the date first needed', () => {
    const g = garden(plantings, [stock('s_1', 'carrot', 60), stock('s_2', 'carrot', 40, 2026), stock('s_3', 'tomato', 50), stock('s_4', 'basil', 10)]);
    const list = shoppingList(g, catalog, TODAY);
    expect(list.seeds.map((item) => item.plantId)).toEqual(['radish', 'tomato', 'carrot']);
    expect(list.seeds.find((item) => item.plantId === 'carrot')).toEqual({ plantId: 'carrot', need: 240, have: 100, missing: 140, area: null, missingArea: null, firstOn: '2027-03-22', expired: true });
    expect(list.seeds.find((item) => item.plantId === 'tomato')).toEqual({ plantId: 'tomato', need: 12, have: 50, missing: 0, area: null, missingArea: null, firstOn: '2027-03-08', expired: false });
    expect(list.seeds.find((item) => item.plantId === 'radish').missing).toBe(60);
    expect(list.youngPlants).toEqual([{ plantId: 'bellPepper', count: 4, firstOn: '2027-05-24' }]);
  });
  test('large needs are given as the area to sow, small ones and single plants as seeds', () => {
    const area = (width) => ({ kind: 'polygon', points: [[0, 0], [width, 0], [width, 1], [0, 1]] });
    const g = garden([
      { plantId: 'carrot', start: '2027-03-22', count: 100, shape: area(2) },
      { plantId: 'carrot', start: '2027-06-01', count: 100, shape: area(2) },
      { plantId: 'radish', start: '2027-04-01', count: 5, shape: area(1) }, // 10 seeds: still a number
      { plantId: 'lettuce', start: '2027-04-01', preStart: '2027-03-01', count: 40 }, // single plants: no area
    ], [stock('s_1', 'carrot', 100)]);
    const list = shoppingList(g, catalog, TODAY);
    const carrot = list.seeds.find((item) => item.plantId === 'carrot');
    expect([carrot.need, carrot.missing, carrot.area, carrot.missingArea]).toEqual([400, 300, 4, 3]);
    const radish = list.seeds.find((item) => item.plantId === 'radish');
    expect([radish.need, radish.area, radish.missingArea]).toEqual([10, null, null]);
    expect(list.seeds.find((item) => item.plantId === 'lettuce').area).toBe(null);
  });
  test('nothing planned, nothing to buy', () => {
    expect(shoppingList(garden([]), catalog, TODAY)).toEqual({ seeds: [], youngPlants: [] });
  });
});

describe('seed stock', () => {
  const entries = [stock('s_a', 'carrot', 30, 2028), stock('s_b', 'carrot', 50, 2026), stock('s_c', 'carrot', 20), stock('s_d', 'tomato', 5)];
  test('totals per plant', () => {
    const map = stockByPlant(entries);
    expect(map.get('carrot').total).toBe(100);
    expect(map.get('carrot').entries).toHaveLength(3);
    expect(map.has('bellPepper')).toBe(false);
  });
  test('seeds are taken from what has to be used first, and put back exactly', () => {
    const taken = takeSeeds(entries, 'carrot', 70);
    expect(taken.used).toEqual([{ id: 's_b', count: 50 }, { id: 's_a', count: 20 }]);
    expect(taken.seedStock.map((entry) => entry.seeds)).toEqual([10, 0, 20, 5]);
    expect(entries.map((entry) => entry.seeds)).toEqual([30, 50, 20, 5]); // input untouched
    expect(returnSeeds(taken.seedStock, taken.used).map((entry) => entry.seeds)).toEqual([30, 50, 20, 5]);
  });
  test('never below zero; a deleted entry is skipped when putting back', () => {
    const taken = takeSeeds(entries, 'tomato', 40);
    expect(taken.used).toEqual([{ id: 's_d', count: 5 }]);
    expect(takeSeeds(entries, 'bellPepper', 10).used).toEqual([]);
    const without = taken.seedStock.filter((entry) => entry.id !== 's_d');
    expect(returnSeeds(without, taken.used).map((entry) => entry.seeds)).toEqual([30, 50, 20]);
  });
  test('entries and task states with used seeds are validated', () => {
    const entry = createSeedEntry({ plantId: 'carrot', variety: ' Nantes 2 ', seeds: 200, useBy: 2028 });
    expect(entry.variety).toBe('Nantes 2');
    expect(validateSeedEntry(entry)).toEqual([]);
    expect(validateSeedEntry({ ...entry, seeds: 1.5, useBy: 28, plantId: '' })).toEqual(['plantId', 'seeds', 'useBy']);
    expect(validateTaskStates({ a: { state: 'done', on: TODAY, seeds: [{ id: 's_a', count: 20 }] } })).toEqual([]);
    expect(validateTaskStates({ a: { state: 'done', on: TODAY, seeds: [{ id: 's_a', count: 0 }] } })).toEqual(['a']);
    const g = garden([], [entry, { ...entry, id: 's_bad', seeds: -1 }]);
    expect(validateGarden(g).map((problem) => `${problem.path}:${problem.code}`)).toEqual(['seedStock[1]:seed.seeds']);
  });
});
