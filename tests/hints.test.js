import { describe, test, expect } from './harness.js';
import { hintsFor, hintsOn, suggestions, proposedStart, startOnOrAfter, proposedPeriod } from '../js/logic/hints.js';
import { buildCatalog } from '../js/logic/catalog.js';
import { createGarden } from '../js/logic/gardenModel.js';
import { createElementAt } from '../js/logic/elements.js';
import { createPlanting, proposedPreStart } from '../js/logic/plantings.js';
import { PLANTS } from '../js/data/plants.js';

const catalog = buildCatalog(PLANTS);

function gardenWith({ climate, plantings = [], trees = [] } = {}) {
  const garden = createGarden({ name: 'G', id: 'g_hints' });
  if (climate) garden.climate = climate;
  const bed = createElementAt('bed', [2, 0.6], { width: 4, depth: 1.2 });
  bed.id = 'e_bed';
  garden.elements.push(bed, ...trees);
  garden.plantings = plantings.map((p) => createPlanting({ bedId: 'e_bed', shape: { kind: 'point', at: [1, 1] }, ...p }));
  return garden;
}

const year2026 = { from: '2026-01-01', to: '2026-12-31' };
const types = (hints) => [...new Set(hints.map((hint) => hint.type))];

describe('tomato planting (acceptance)', () => {
  const garden = gardenWith({ plantings: [{ plantId: 'tomato', start: '2026-05-18', end: '2026-10-04', preStart: proposedPreStart(catalog.get('tomato'), '2026-05-18') }] });
  const hints = hintsFor(garden, catalog, year2026);
  test('sowing, planting out, fertilizing, side shoots and harvest', () => {
    expect(types(hints).sort()).toEqual(['fertilize', 'harvest', 'plant', 'prune', 'sow', 'water'].sort());
  });
  test('indoor sowing 10 weeks before planting out', () => {
    expect(hints.find((hint) => hint.hint === 'sowIndoor').start).toBe('2026-03-09');
  });
  test('pre-cultivation is a choice: its own date, or no indoor sowing at all', () => {
    const own = gardenWith({ plantings: [{ plantId: 'tomato', start: '2026-05-18', end: '2026-10-04', preStart: '2026-04-01' }] });
    expect(hintsFor(own, catalog, year2026).find((hint) => hint.hint === 'sowIndoor').start).toBe('2026-04-01');
    const bought = gardenWith({ plantings: [{ plantId: 'tomato', start: '2026-05-18', end: '2026-10-04' }] });
    expect(hintsFor(bought, catalog, year2026).some((hint) => hint.hint === 'sowIndoor')).toBeFalsy();
    // a short pre-cultivation ends before the plants go into the bed
    const short = gardenWith({ plantings: [{ plantId: 'tomato', start: '2026-05-18', end: '2026-10-04', preStart: '2026-05-11' }] });
    expect(hintsFor(short, catalog, year2026).find((hint) => hint.hint === 'sowIndoor').end).toBe('2026-05-17');
  });
  test('planting out on the planting date', () => {
    expect(hints.find((hint) => hint.type === 'plant').start).toBe('2026-05-18');
  });
  test('side shoots weekly within the planting period', () => {
    const shoots = hints.filter((hint) => hint.hint === 'sideShoots');
    expect(shoots.length > 10).toBeTruthy();
    expect(shoots.every((hint) => hint.start >= '2026-06-08' && hint.end <= '2026-10-04')).toBeTruthy();
    expect(shoots[0].everyWeeks).toBe(1);
  });
  test('harvest from the end of the planting backwards', () => {
    const harvest = hints.find((hint) => hint.type === 'harvest');
    expect(harvest.end).toBe('2026-10-04');
    expect(harvest.start).toBe('2026-07-27'); // 70 days
  });
  test('keys are stable and unique', () => {
    const again = hintsFor(garden, catalog, year2026).map((hint) => hint.key);
    expect(again).toEqual(hints.map((hint) => hint.key));
    expect(new Set(again).size).toBe(again.length);
  });
});

describe('climate', () => {
  test('southern hemisphere shifts care half a year', () => {
    const north = hintsFor(gardenWith({ plantings: [{ plantId: 'potato', start: '2026-04-06', end: '2026-08-31' }] }), catalog, year2026);
    expect(north.find((hint) => hint.hint === 'earthUp').start).toBe('2026-05-04');
    const south = gardenWith({ climate: { hemisphere: 'south', shiftWeeks: 0 }, plantings: [{ plantId: 'potato', start: '2026-10-05', end: '2027-02-28' }] });
    const southHints = hintsFor(south, catalog, { from: '2026-01-01', to: '2027-12-31' });
    expect(southHints.find((hint) => hint.hint === 'earthUp').start).toBe('2026-11-02');
  });
  test('a cold climate moves spring care later', () => {
    const cold = gardenWith({ climate: { hemisphere: 'north', shiftWeeks: 2 }, plantings: [{ plantId: 'potato', start: '2026-04-06', end: '2026-08-31' }] });
    expect(hintsFor(cold, catalog, year2026).find((hint) => hint.hint === 'earthUp').start).toBe('2026-05-18');
  });
});

describe('perennials, trees and shrubs', () => {
  test('an apple tree gets pruning, fertilizing, thinning and harvest each year', () => {
    const apple = createElementAt('tree', [8, 8]);
    apple.plantId = 'apple';
    const hints = hintsFor(gardenWith({ trees: [apple] }), catalog, { from: '2026-01-01', to: '2027-12-31' });
    expect(hints.filter((hint) => hint.hint === 'winterPruning').length).toBe(2);
    expect(types(hints).sort()).toEqual(['care', 'fertilize', 'harvest', 'prune']);
    expect(hints.every((hint) => hint.sourceKind === 'element')).toBeTruthy();
  });
  test('trees without a plant give no hints', () => {
    expect(hintsFor(gardenWith({ trees: [createElementAt('tree', [8, 8])] }), catalog, year2026)).toEqual([]);
  });
  test('open-ended strawberries harvest every year from planting on', () => {
    const garden = gardenWith({ plantings: [{ plantId: 'strawberry', start: '2025-08-01', end: null }] });
    const harvests = hintsFor(garden, catalog, { from: '2025-01-01', to: '2027-12-31' }).filter((hint) => hint.type === 'harvest');
    expect(harvests.map((hint) => hint.start.slice(0, 4))).toEqual(['2026', '2027']);
  });
});

describe('range and day', () => {
  const garden = gardenWith({ plantings: [{ plantId: 'radish', start: '2026-04-01', end: '2026-05-01' }] });
  test('only hints overlapping the range', () => {
    expect(hintsFor(garden, catalog, { from: '2026-06-01', to: '2026-06-30' })).toEqual([]);
    expect(hintsFor(garden, catalog, { from: '2026-04-01', to: '2026-04-30' }).length > 0).toBeTruthy();
  });
  test('hints on a day', () => {
    const hints = hintsFor(garden, catalog, year2026);
    expect(hintsOn(hints, '2026-04-25').map((hint) => hint.type)).toContain('harvest');
  });
});

describe('suggestions and proposed start', () => {
  test('what can be sown or planted in May', () => {
    const may = suggestions(catalog, { hemisphere: 'north', shiftWeeks: 0 }, { from: '2026-05-01', to: '2026-05-31' });
    const ids = may.map((entry) => entry.plant.id);
    expect(ids).toContain('tomato');
    expect(ids).toContain('bushBean');
    expect(ids.includes('apple')).toBeFalsy();
    expect(may.find((entry) => entry.plant.id === 'tomato').kinds).toEqual(['plantOut']);
  });
  test('proposed start of a planting', () => {
    expect(proposedStart(catalog.get('tomato'), { hemisphere: 'north', shiftWeeks: 0 }, 2026)).toBe('2026-05-11');
    expect(proposedStart(catalog.get('carrot'), { hemisphere: 'north', shiftWeeks: 2 }, 2026)).toBe('2026-03-30');
  });
  test('proposed start from a given day on', () => {
    const climate = { hemisphere: 'north', shiftWeeks: 0 };
    const tomato = catalog.get('tomato');
    // before the window: its first day; inside: the day itself; after: next year's window
    expect(startOnOrAfter(tomato, climate, '2026-02-01')).toBe('2026-05-11');
    expect(startOnOrAfter(tomato, climate, '2026-05-20')).toBe('2026-05-20');
    expect(startOnOrAfter(tomato, climate, '2026-11-22')).toBe(proposedStart(tomato, climate, 2027));
    expect(startOnOrAfter({ windows: {} }, climate, '2026-05-20')).toBe(null);
  });
  test('proposed period for the current or the coming season', () => {
    const climate = { hemisphere: 'north', shiftWeeks: 0 };
    const tomato = catalog.get('tomato');
    const current = proposedPeriod(tomato, climate, '2026-05-20');
    expect(current.start).toBe('2026-05-20');
    expect(current.end > current.start).toBeTruthy();
    expect(proposedPeriod(tomato, climate, '2026-11-22').start.slice(0, 4)).toBe('2027');
    expect(proposedPeriod(catalog.get('strawberry'), climate, '2026-11-22').end).toBe(null);
    expect(proposedPeriod({ windows: {}, growDays: 10 }, climate, '2026-05-20')).toEqual({ start: '2026-05-20', end: '2026-05-30', preStart: null });
    expect(current.preStart).toBe(proposedPreStart(tomato, '2026-05-20'));
  });
});
