import { describe, test, expect } from './harness.js';
import {
  buildCatalog, diffOverride, monthsToWeeks, weeksToMonths, validateCustomPlant, validateOverrides,
  CATEGORIES, PLACEMENTS, LIFECYCLES, FEEDERS, WINDOW_KINDS, CARE_TYPES,
} from '../js/logic/catalog.js';
import { PLANTS } from '../js/data/plants.js';
import { FAMILY_IDS } from '../js/data/families.js';

const custom = {
  id: 'c_garlic01', name: 'Garlic', category: 'vegetable', placement: 'bed', lifecycle: 'annual', family: 'amaryllidaceae',
  feeder: 'light', color: '#DDDDAA', spacing: { row: 0.25, plant: 0.12 }, growDays: 270,
  windows: { sowOutdoor: [[40, 44]], harvest: [[27, 30]] },
};

describe('built-in catalog data', () => {
  test('every plant has complete, consistent data', () => {
    for (const plant of PLANTS) {
      const where = plant.id;
      expect([where, CATEGORIES.includes(plant.category)]).toEqual([where, true]);
      expect([where, PLACEMENTS.includes(plant.placement)]).toEqual([where, true]);
      expect([where, LIFECYCLES.includes(plant.lifecycle)]).toEqual([where, true]);
      expect([where, FEEDERS.includes(plant.feeder)]).toEqual([where, true]);
      expect([where, FAMILY_IDS.includes(plant.family)]).toEqual([where, true]);
      expect([where, Object.keys(plant.windows).sort()]).toEqual([where, [...WINDOW_KINDS].sort()]);
      const windows = Object.values(plant.windows).flat();
      expect([where, windows.every(([a, b]) => a >= 1 && b <= 52 && a <= b)]).toEqual([where, true]);
      expect([where, plant.windows.harvest.length > 0]).toEqual([where, true]);
      expect([where, plant.harvestDays > 0]).toEqual([where, true]);
      expect([where, plant.care.every((rule) => CARE_TYPES.includes(rule.type) && rule.hint && rule.weeks[0] <= rule.weeks[1])]).toEqual([where, true]);
    }
  });
  test('companions exist and are symmetric', () => {
    const ids = new Set(PLANTS.map((plant) => plant.id));
    for (const plant of PLANTS) {
      for (const kind of ['good', 'bad']) {
        for (const other of plant.companions[kind]) {
          expect([plant.id, other, ids.has(other)]).toEqual([plant.id, other, true]);
          const back = PLANTS.find((p) => p.id === other).companions[kind];
          expect([plant.id, kind, other, back.includes(plant.id)]).toEqual([plant.id, kind, other, true]);
        }
      }
      expect(plant.companions.good.some((id) => plant.companions.bad.includes(id))).toBeFalsy();
    }
  });
});

describe('buildCatalog', () => {
  test('built-ins, overrides and custom plants', () => {
    const catalog = buildCatalog(PLANTS, { carrot: { growDays: 100, spacing: { row: 0.3 } } }, [custom]);
    expect(catalog.get('carrot').growDays).toBe(100);
    expect(catalog.get('carrot').spacing).toEqual({ row: 0.3, plant: 0.05 });
    expect(catalog.get('carrot').overridden).toBeTruthy();
    expect(catalog.get('tomato').overridden).toBeFalsy();
    expect(catalog.get('c_garlic01').custom).toBeTruthy();
    expect(catalog.get('c_garlic01').windows.plantOut).toEqual([]);
    expect(catalog.get('nothing').id).toBe('unknown');
    expect(catalog.has('c_garlic01')).toBeTruthy();
    expect(catalog.all().length).toBe(PLANTS.length + 1);
  });
  test('override diff', () => {
    const carrot = PLANTS.find((plant) => plant.id === 'carrot');
    expect(diffOverride(carrot, { ...carrot })).toBeNull();
    expect(diffOverride(carrot, { ...carrot, growDays: 90 })).toEqual({ growDays: 90 });
  });
});

describe('months and weeks', () => {
  test('round trip for whole months', () => {
    expect(monthsToWeeks(4, 5)).toEqual([14, 22]);
    expect(weeksToMonths(monthsToWeeks(4, 5))).toEqual([4, 5]);
    expect(monthsToWeeks(1, 12)).toEqual([1, 52]);
    expect(weeksToMonths([20, 23])).toEqual([5, 6]);
    for (let month = 1; month <= 12; month++) expect(weeksToMonths(monthsToWeeks(month, month))).toEqual([month, month]);
  });
});

describe('validation', () => {
  test('custom plants', () => {
    expect(validateCustomPlant(custom)).toEqual([]);
    expect(validateCustomPlant({ ...custom, name: ' ', color: 'red', windows: { harvest: [[30, 20]] } })).toEqual(['name', 'color', 'windows']);
    expect(validateCustomPlant({ ...custom, spacing: { row: 0, plant: 1 }, family: 'unknownaceae' })).toEqual(['family', 'spacing']);
  });
  test('overrides', () => {
    expect(validateOverrides({ carrot: { growDays: 90 } })).toEqual([]);
    expect(validateOverrides({ carrot: { colour: 'red' }, tomato: { windows: { harvest: [[50, 2]] } } })).toEqual(['carrot', 'tomato']);
  });
});
