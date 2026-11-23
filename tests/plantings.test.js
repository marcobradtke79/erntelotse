import { describe, test, expect } from './harness.js';
import {
  createPlanting, defaultEnd, isActiveOn, touchesYear, plantingStatus, visiblePlantings, historyByYear,
  estimateCount, plantCount, copyForward, canCopyForward, fitShapeToBed, moveShape, validatePlanting, yearsOf, timelineBars, periodError, weekCounts, isRaisedBetween, proposedPreStart, plantUse, occupiedArea, freeArea,
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
  test('a week shows what is in the bed on any of its days', () => {
    const week = (day) => visiblePlantings(all, { year: 2026, day, days: 7 }).map((p) => p.plantId);
    expect(week('2026-03-23')).toEqual([]);
    expect(week('2026-03-30')).toEqual(['radish']); // starts on the Wednesday
    expect(week('2026-05-25')).toEqual(['radish']);
    expect(week('2026-06-01')).toEqual(['bushBean']);
    expect(week('2026-09-28')).toEqual(['bushBean']);
    expect(week('2026-10-05')).toEqual([]);
  });
  test('plantings in the ground per week', () => {
    expect(weekCounts(all, ['2026-03-23', '2026-03-30', '2026-06-01', '2026-10-05'])).toEqual([0, 1, 1, 0]);
    const overlap = plant({ start: '2026-05-28', end: '2026-06-03' });
    expect(weekCounts([...all, overlap], ['2026-05-25', '2026-06-01'])).toEqual([2, 2]);
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

describe('which plants the garden uses', () => {
  const today = '2026-11-22';
  const garden = {
    plantings: [
      plant({ plantId: 'carrot', start: '2026-04-01', end: '2026-08-01' }), // this year, over
      plant({ plantId: 'carrot', start: '2027-03-22', end: '2027-07-20' }), // planned
      plant({ plantId: 'carrot', start: '2027-06-01', end: '2027-09-01' }), // planned, later
      plant({ plantId: 'tomato', start: '2027-05-17', end: '2027-10-03', preStart: '2027-03-08' }), // only planned
      plant({ plantId: 'garlic', start: '2025-10-01', end: '2026-07-01' }), // from last year into this one
      plant({ plantId: 'radish', start: '2025-04-01', end: '2025-05-01' }), // last year only
      plant({ plantId: 'chili', start: '2026-12-10', end: '2027-06-01', preStart: '2026-11-10' }), // being pre-cultivated
      plant({ plantId: 'strawberry', start: '2024-08-01', end: null }), // perennial
    ],
    elements: [{ id: 'e_t', type: 'tree', plantId: 'apple' }, { id: 'e_u', type: 'tree', plantId: null }, { id: 'e_b', type: 'bed' }],
  };
  const use = plantUse(garden, today);
  test('used this year: begun plantings of this year, perennials, trees and shrubs', () => {
    const used = [...use].filter(([, value]) => value.usedThisYear).map(([id]) => id).sort();
    expect(used).toEqual(['apple', 'carrot', 'chili', 'garlic', 'strawberry']);
    expect(use.get('carrot').current).toHaveLength(1);
    expect(use.get('radish').usedThisYear).toBe(false);
    expect(use.get('apple').elements).toHaveLength(1);
  });
  test('planned: plantings that go into the bed after today, earliest first', () => {
    const planned = [...use].filter(([, value]) => value.firstPlanned).map(([id, value]) => [id, value.firstPlanned]).sort();
    expect(planned).toEqual([['carrot', '2027-03-22'], ['chili', '2026-12-10'], ['tomato', '2027-05-17']]);
    expect(use.get('carrot').planned).toHaveLength(2);
    expect(use.get('tomato').usedThisYear).toBe(false);
    expect(use.has('lettuce')).toBe(false);
  });
});

describe('pre-cultivation', () => {
  const tomato = plant({ plantId: 'tomato', start: '2026-05-18', end: '2026-10-04', preStart: '2026-03-09' });
  test('does not cover the bed', () => {
    expect(visiblePlantings([tomato], { year: 2026, day: '2026-04-06', days: 7 })).toEqual([]);
    expect(visiblePlantings([tomato], { year: 2026, day: '2026-05-18', days: 7 })).toHaveLength(1);
    expect(isActiveOn(tomato, '2026-04-06')).toBeFalsy();
  });
  test('is known per week and as a status', () => {
    expect(isRaisedBetween(tomato, '2026-03-02', '2026-03-08')).toBe(false);
    expect(isRaisedBetween(tomato, '2026-03-09', '2026-03-15')).toBe(true);
    expect(isRaisedBetween(tomato, '2026-05-11', '2026-05-17')).toBe(true);
    expect(isRaisedBetween(tomato, '2026-05-18', '2026-05-24')).toBe(false);
    expect(isRaisedBetween(plant({}), '2026-03-09', '2026-03-15')).toBe(false);
    expect(plantingStatus(tomato, '2026-03-01')).toBe('planned');
    expect(plantingStatus(tomato, '2026-04-01')).toBe('raising');
    expect(plantingStatus(tomato, '2026-06-01')).toBe('active');
  });
  test('is proposed from the catalog, copied forward and validated', () => {
    expect(proposedPreStart(getPlant('tomato'), '2026-05-18')).toBe('2026-03-09');
    expect(proposedPreStart(getPlant('carrot'), '2026-04-01')).toBe(null);
    expect(copyForward(tomato).preStart).toBe('2027-03-09');
    expect(copyForward(plant({})).preStart).toBe(null);
    expect(validatePlanting(tomato)).toEqual([]);
    expect(validatePlanting({ ...tomato, preStart: '2026-05-18' })).toEqual(['preStart']);
    expect(periodError('2026-05-18', '2026-10-04', '2026-05-18')).toBe('preAfterStart');
    expect(periodError('2026-05-18', '2026-10-04', '2026-03-09')).toBe(null);
  });
  test('shows on the timeline before the bar', () => {
    const [bar] = timelineBars([tomato], 2026);
    expect(Math.round(bar.preFrom * 365)).toBe(67);
    expect(bar.preFrom < bar.from).toBeTruthy();
    expect(timelineBars([plant({})], 2026)[0].preFrom).toBe(null);
  });
});

describe('timeline of a year', () => {
  const bars = (list, year = 2026) => timelineBars(list, year);
  test('a planting inside the year spans its days', () => {
    const [bar] = bars([plant({ start: '2026-01-01', end: '2026-12-31' })]);
    expect(bar.from).toBe(0);
    expect(bar.to).toBe(1);
    expect(bar.startsBefore || bar.endsAfter).toBeFalsy();
    const [july] = bars([plant({ start: '2026-07-01', end: '2026-07-01' })]);
    expect(Math.round(july.from * 365)).toBe(181);
    expect(Math.round((july.to - july.from) * 365)).toBe(1);
  });
  test('periods reaching outside the year are clipped and marked', () => {
    const [bar] = bars([plant({ start: '2025-10-01', end: '2027-03-01' })]);
    expect([bar.from, bar.to, bar.startsBefore, bar.endsAfter]).toEqual([0, 1, true, true]);
  });
  test('open-ended plantings run to the end of the year', () => {
    const [bar] = bars([plant({ start: '2026-04-01', end: null })]);
    expect(bar.to).toBe(1);
    expect(bar.endsAfter).toBe(true);
    expect(bar.startsBefore).toBe(false);
  });
  test('other years are left out, rows are ordered by start', () => {
    const late = plant({ start: '2026-08-01', end: '2026-10-01' });
    const early = plant({ start: '2026-03-01', end: '2026-05-01' });
    const other = plant({ start: '2025-03-01', end: '2025-05-01' });
    expect(bars([late, other, early]).map((bar) => bar.id)).toEqual([early.id, late.id]);
    expect(bars([late, early], 2027)).toEqual([]);
  });
  test('entered periods are checked', () => {
    expect(periodError('2026-04-01', '2026-08-01')).toBe(null);
    expect(periodError('2026-04-01', null)).toBe(null);
    expect(periodError('2026-04-01', '2026-03-31')).toBe('endBeforeStart');
    expect(periodError('', '2026-03-31')).toBe('date');
    expect(periodError('2026-04-01', '2026-02-30')).toBe('date');
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

describe('free space of a bed in a period', () => {
  const season = { start: '2026-05-01', end: '2026-09-01' };
  test('plantings in the bed during the period take their area', () => {
    expect(freeArea(4.8, [plant()], season)).toBe(2.4);
    expect(freeArea(4.8, [], season)).toBe(4.8);
  });
  test('plantings outside the period and pre-cultivation take nothing', () => {
    expect(freeArea(4.8, [plant({ start: '2026-03-01', end: '2026-04-30' })], season)).toBe(4.8);
    expect(freeArea(4.8, [plant({ start: '2026-09-02', end: '2026-10-01', preStart: '2026-08-01' })], season)).toBe(4.8);
  });
  test('plantings that follow each other count once, at the same time they add up', () => {
    const early = plant({ start: '2026-05-01', end: '2026-06-15' });
    const late = plant({ start: '2026-06-16', end: '2026-09-01' });
    expect(occupiedArea([early, late], season)).toBe(2.4);
    expect(freeArea(4.8, [early, plant({ start: '2026-06-01', end: '2026-07-01' })], season)).toBe(0);
    expect(freeArea(4.8, [early, late, plant(), plant()], season)).toBe(0);
  });
  test('an open period counts everything from its start on', () => {
    expect(freeArea(4.8, [plant({ start: '2027-04-01', end: null })], { start: '2026-05-01', end: null })).toBe(2.4);
    expect(freeArea(4.8, [plant({ start: '2025-04-01', end: '2026-04-30' })], { start: '2026-05-01', end: null })).toBe(4.8);
  });
  test('single plants count with their spacing', () => {
    const single = plant({ shape: { kind: 'point', at: [1, 1] } });
    expect(freeArea(4.8, [single, single], season, () => ({ row: 0.5, plant: 0.5 }))).toBe(4.3);
    expect(freeArea(4.8, [single], season)).toBe(4.8);
  });
});
