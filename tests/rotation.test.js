import { describe, test, expect } from './harness.js';
import { rotationCheck, neighbourRelations, plantingBadges, pickerAdvice, shapeDistance } from '../js/logic/rotation.js';
import { createPlanting } from '../js/logic/plantings.js';
import { buildCatalog } from '../js/logic/catalog.js';
import { rectangle } from '../js/logic/geometry.js';
import { PLANTS } from '../js/data/plants.js';

const catalog = buildCatalog(PLANTS);
const area = (cx, cy = 0.6, width = 1, depth = 1.2) => ({ kind: 'polygon', points: rectangle([cx, cy], width, depth) });
const plant = (plantId, start, end, shape = area(1), bedId = 'e_bed1') => createPlanting({ bedId, plantId, shape, start, end });

describe('crop rotation (acceptance)', () => {
  const potatoes = plant('potato', '2025-04-10', '2025-08-20');
  test('tomatoes where potatoes grew last year: warning with year and family', () => {
    const tomatoes = plant('tomato', '2026-05-18', '2026-10-01');
    const result = rotationCheck(tomatoes, [potatoes, tomatoes], catalog);
    expect(result.level).toBe('warning');
    expect(result.issues[0]).toEqual({ kind: 'sameFamily', plantId: 'potato', year: 2025, until: 2028, family: 'solanaceae' });
  });
  test('the same tomatoes in another bed: no warning', () => {
    const tomatoes = plant('tomato', '2026-05-18', '2026-10-01', area(1), 'e_bed2');
    expect(rotationCheck(tomatoes, [potatoes], catalog).level).toBeNull();
  });
  test('another spot in the same bed does not count', () => {
    const tomatoes = plant('tomato', '2026-05-18', '2026-10-01', area(3));
    expect(rotationCheck(tomatoes, [potatoes], catalog).level).toBeNull();
  });
  test('after the rotation gap it is fine again', () => {
    const tomatoes = plant('tomato', '2028-05-18', '2028-10-01');
    expect(rotationCheck(tomatoes, [potatoes], catalog).issues.some((issue) => issue.kind === 'sameFamily')).toBeFalsy();
  });
  test('without a shape the whole bed counts (plant picker)', () => {
    const result = rotationCheck({ bedId: 'e_bed1', plantId: 'tomato', start: '2026-05-18' }, [plant('potato', '2025-04-10', '2025-08-20', area(3))], catalog);
    expect(result.level).toBe('warning');
  });
});

describe('feeder sequences', () => {
  test('heavy after heavy is a note', () => {
    const before = plant('cabbage', '2025-04-20', '2025-10-01');
    const after = plant('zucchini', '2026-05-20', '2026-09-30');
    const result = rotationCheck(after, [before], catalog);
    expect(result.level).toBe('note');
    expect(result.issues[0].kind).toBe('heavyAfterHeavy');
  });
  test('after legumes and lighter after heavy are good', () => {
    expect(rotationCheck(plant('cabbage', '2026-05-01', '2026-09-01'), [plant('pea', '2025-03-20', '2025-07-20')], catalog).issues[0].kind).toBe('afterLegumes');
    expect(rotationCheck(plant('carrot', '2026-04-01', '2026-08-01'), [plant('zucchini', '2025-05-20', '2025-09-30')], catalog).level).toBe('good');
  });
  test('plantings still in the ground do not count as earlier crops', () => {
    expect(rotationCheck(plant('tomato', '2026-05-18', '2026-10-01'), [plant('potato', '2026-04-01', '2026-08-01')], catalog).level).toBeNull();
  });
});

describe('neighbours (acceptance)', () => {
  const tomato = plant('tomato', '2026-05-18', '2026-10-01', area(1));
  test('tomato next to basil: good on both', () => {
    const basil = plant('basil', '2026-05-25', '2026-09-15', area(2.2));
    expect(neighbourRelations(tomato, [tomato, basil], catalog)).toEqual([{ id: basil.id, plantId: 'basil', relation: 'good' }]);
    expect(neighbourRelations(basil, [tomato, basil], catalog)[0].relation).toBe('good');
    expect(plantingBadges(basil, [tomato, basil], catalog)).toEqual(['good']);
  });
  test('tomato next to fennel: bad', () => {
    const fennel = plant('fennel', '2026-05-20', '2026-09-01', area(2.2));
    expect(neighbourRelations(tomato, [fennel], catalog)[0].relation).toBe('bad');
  });
  test('no overlap in time: nothing', () => {
    const basil = plant('basil', '2026-10-05', '2026-11-01', area(2.2));
    expect(neighbourRelations(tomato, [basil], catalog)).toEqual([]);
  });
  test('more than a metre apart: nothing', () => {
    const basil = plant('basil', '2026-05-25', '2026-09-15', area(4, 0.6, 1));
    expect(neighbourRelations(tomato, [basil], catalog)).toEqual([]);
  });
  test('other beds do not count', () => {
    const basil = plant('basil', '2026-05-25', '2026-09-15', area(2.2), 'e_bed2');
    expect(neighbourRelations(tomato, [basil], catalog)).toEqual([]);
  });
});

describe('shape distance and picker', () => {
  test('distances between areas and single plants', () => {
    expect(shapeDistance(area(1), area(1.5))).toBe(0);
    expect(shapeDistance(area(1), area(3))).toBeCloseTo(1);
    expect(shapeDistance({ kind: 'point', at: [0, 0] }, { kind: 'point', at: [3, 4] })).toBe(5);
    expect(shapeDistance({ kind: 'point', at: [1, 0.6] }, area(1))).toBe(0);
  });
  test('picker advice for a bed', () => {
    const plantings = [plant('potato', '2025-04-10', '2025-08-20', area(3)), plant('carrot', '2026-04-01', '2026-08-01', area(1))];
    const advice = pickerAdvice('e_bed1', { start: '2026-05-01', end: '2026-09-30' }, plantings, catalog);
    expect(advice.tomato).toBe('rotation');
    expect(advice.onion).toBe('good');
    expect(advice.apple).toBeFalsy();
  });
});
