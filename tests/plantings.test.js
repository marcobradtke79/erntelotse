import { describe, test, expect } from './harness.js';
import {
  createPlanting, defaultEnd, isActiveOn, touchesYear, plantingStatus, visiblePlantings, historyByYear,
  estimateCount, plantCount, copyForward, canCopyForward, fitShapeToBed, moveShape, validatePlanting, yearsOf,
} from '../js/logic/plantings.js';
import { rectangle, polygonArea } from '../js/logic/geometry.js';
import { getPlant, PLANTS, isKnownPlant } from '../js/data/plants.js';

const bed = rectangle([2, 0.6], 4, 1.2); // 4 m × 1.2 m from (0,0) to (4,1.2)
const area = (points) => ({ kind: 'polygon', points });
const plant = (overrides) => createPlanting({ bedId: 'e_bed', plantId: 'carrot', shape: area(rectangle([1, 0.6], 2, 1.2)), start: '2026-04-01', end: '2026-08-01', ...overrides });

describe('periods', () => {
  test('active on a day', () => {
    const p = plant({});
    expect(isActiveOn(p, '2026-04-01')).toBeTruthy();
    expect(isActiveOn(p, '2026-08-01')).toBeTruthy();
    expect(isActiveOn(p, '2026-08-02')).toBeFalsy();
    expect(isActiveOn(p, '2026-03-31')).toBeFalsy();
  });
  test('crossing New Year', () => {
    const garlic = plant({ start: '2026-10-01', end: '2027-07-15' });
    expect(touchesYear(garlic, 2026)).toBeTruthy();
    expect(touchesYear(garlic, 2027)).toBeTruthy();
    expect(touchesYear(garlic, 2028)).toBeFalsy();
    expect(isActiveOn(garlic, '2027-01-15')).toBeTruthy();
    expect(yearsOf(garlic, 2030)).toEqual([2026, 2027]);
  });
  test('open-ended perennials stay', () => {
    const strawberries = plant({ plantId: 'strawberry', start: '2024-05-01', end: null });
    expect(isActiveOn(strawberries, '2030-01-01')).toBeTruthy();
    expect(touchesYear(strawberries, 2023)).toBeFalsy();
    expect(yearsOf(strawberries, 2026)).toEqual([2024, 2025, 2026]);
  });
  test('status', () => {
    const p = plant({});
    expect(plantingStatus(p, '2026-03-01')).toBe('planned');
    expect(plantingStatus(p, '2026-05-01')).toBe('active');
    expect(plantingStatus(p, '2026-09-01')).toBe('past');
    expect(plantingStatus(plant({ end: null }), '2040-01-01')).toBe('active');
  });
  test('default end from growing time', () => {
    expect(defaultEnd(getPlant('radish'), '2026-04-01')).toBe('2026-05-01');
    expect(defaultEnd(getPlant('strawberry'), '2026-04-01')).toBeNull();
  });
});

describe('succession in one area (acceptance)', () => {
  const shape = area(rectangle([1, 0.6], 2, 1.2));
  const radish = plant({ plantId: 'radish', shape, start: '2026-04-01', end: '2026-05-31' });
  const beans = plant({ plantId: 'bushBean', shape, start: '2026-06-01', end: '2026-09-30' });
  const all = [radish, beans];
  test('the date shows the right one', () => {
    expect(visiblePlantings(all, { year: 2026, day: '2026-04-20' }).map((p) => p.plantId)).toEqual(['radish']);
    expect(visiblePlantings(all, { year: 2026, day: '2026-07-01' }).map((p) => p.plantId)).toEqual(['bushBean']);
    expect(visiblePlantings(all, { year: 2026, day: '2026-11-01' })).toEqual([]);
  });
  test('the whole year shows both, other years none', () => {
    expect(visiblePlantings(all, { year: 2026, day: null })).toHaveLength(2);
    expect(visiblePlantings(all, { year: 2027, day: null })).toEqual([]);
  });
});

describe('history', () => {
  test('grouped by year, newest first, sorted by start', () => {
    const plantings = [
      plant({ start: '2025-06-01', end: '2025-09-01' }),
      plant({ plantId: 'radish', start: '2026-04-01', end: '2026-05-01' }),
      plant({ plantId: 'lettuce', start: '2026-03-01', end: '2026-05-01' }),
      plant({ bedId: 'e_other', start: '2026-03-01', end: '2026-05-01' }),
    ];
    const history = historyByYear(plantings, 'e_bed', 2026);
    expect(history.map((entry) => entry.year)).toEqual([2026, 2025]);
    expect(history[0].plantings.map((p) => p.plantId)).toEqual(['lettuce', 'radish']);
  });
});

describe('counts', () => {
  test('2 m × 1.2 m of carrots (acceptance)', () => {
    // 2.4 m² / (0.25 m × 0.05 m) = 192
    expect(estimateCount(area(rectangle([1, 0.6], 2, 1.2)), getPlant('carrot').spacing)).toBe(192);
    expect(estimateCount(area(rectangle([1, 0.6], 1, 1.2)), getPlant('carrot').spacing)).toBe(96);
  });
  test('single plants and manual override', () => {
    expect(estimateCount({ kind: 'point', at: [1, 1] }, getPlant('tomato').spacing)).toBe(1);
    expect(estimateCount(area(rectangle([0, 0], 0.1, 0.1)), getPlant('zucchini').spacing)).toBe(1);
    expect(plantCount(plant({ count: 50 }), getPlant('carrot'))).toBe(50);
    expect(plantCount(plant({ count: null }), getPlant('carrot'))).toBe(192);
  });
});

describe('copy forward', () => {
  test('dates move by a year, new id, same shape', () => {
    const p = plant({ start: '2024-02-29', end: '2024-06-30' });
    const copy = copyForward(p);
    expect(copy.start).toBe('2025-02-28');
    expect(copy.end).toBe('2025-06-30');
    expect(copy.id === p.id).toBeFalsy();
    expect(copy.shape).toEqual(p.shape);
  });
  test('open-ended plantings are not copied', () => {
    expect(canCopyForward(plant({ end: null }))).toBeFalsy();
    expect(canCopyForward(plant({}))).toBeTruthy();
  });
});

describe('keeping shapes in the bed', () => {
  test('inside, also when touching the edges', () => {
    const shape = area(rectangle([1, 0.6], 2, 1.2));
    expect(fitShapeToBed(shape, bed)).toEqual({ shape });
  });
  test('sticking out of a convex bed is clipped', () => {
    const result = fitShapeToBed(area(rectangle([3.5, 0.6], 2, 2)), bed);
    // x 2.5…4.5 and y −0.4…1.6, of which x 2.5…4 and y 0…1.2 lie in the bed
    expect(polygonArea(result.shape.points)).toBeCloseTo(1.8, 3);
  });
  test('completely outside', () => {
    expect(fitShapeToBed(area(rectangle([10, 10], 1, 1)), bed)).toEqual({ error: 'outside' });
  });
  test('concave bed: no clipping, must be inside', () => {
    const lBed = [[0, 0], [4, 0], [4, 1], [1, 1], [1, 3], [0, 3]];
    expect(fitShapeToBed(area(rectangle([0.5, 2], 0.8, 1)), lBed).shape).toBeTruthy();
    expect(fitShapeToBed(area(rectangle([1, 1], 1.5, 1.5)), lBed)).toEqual({ error: 'outside' });
  });
  test('single plants', () => {
    expect(fitShapeToBed({ kind: 'point', at: [1, 1] }, bed).shape).toBeTruthy();
    expect(fitShapeToBed({ kind: 'point', at: [5, 1] }, bed)).toEqual({ error: 'outside' });
  });
  test('moving with the bed', () => {
    const moved = moveShape({ kind: 'point', at: [1, 0] }, { from: [0, 0], to: [10, 0], rotation: 90 });
    expect(moved.at[0]).toBeCloseTo(10);
    expect(moved.at[1]).toBeCloseTo(1);
  });
});

describe('validatePlanting', () => {
  test('valid', () => {
    expect(validatePlanting(plant({}))).toEqual([]);
    expect(validatePlanting(plant({ end: null, shape: { kind: 'point', at: [1, 1] } }))).toEqual([]);
  });
  test('problems', () => {
    expect(validatePlanting(plant({ start: '2026-02-30' }))).toEqual(['start']);
    expect(validatePlanting(plant({ start: '2026-05-01', end: '2026-04-01' }))).toEqual(['end']);
    expect(validatePlanting(plant({ count: -1 }))).toEqual(['count']);
    expect(validatePlanting(plant({ shape: { kind: 'point', at: [1] } }))).toEqual(['shape']);
    expect(validatePlanting({ ...plant({}), bedId: 5, plantId: '' })).toEqual(['bedId', 'plantId']);
  });
});

describe('plant data', () => {
  test('every plant is complete', () => {
    for (const p of PLANTS) {
      expect(/^#[0-9A-F]{6}$/.test(p.color)).toBeTruthy();
      expect(p.spacing.row > 0 && p.spacing.plant > 0).toBeTruthy();
      expect(['bed', 'tree', 'shrub']).toContain(p.placement);
      expect(p.lifecycle === 'perennial' ? p.growDays === null : p.growDays > 0).toBeTruthy();
    }
  });
  test('unknown ids fall back', () => {
    expect(isKnownPlant('carrot')).toBeTruthy();
    expect(getPlant('mandrake').id).toBe('unknown');
  });
});
