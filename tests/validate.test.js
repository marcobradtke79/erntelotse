import { describe, test, expect } from './harness.js';
import { validateGarden, validateSettings, validateIndex } from '../js/logic/validate.js';
import { createGarden } from '../js/logic/gardenModel.js';
import { createElementAt } from '../js/logic/elements.js';
import { createPlanting } from '../js/logic/plantings.js';

const valid = () => createGarden({ name: 'Garden', now: new Date('2026-11-21T10:00:00Z'), id: 'g_valid' });
const codes = (problems) => problems.map((p) => `${p.path}:${p.code}`);

describe('validateGarden', () => {
  test('a new garden is valid', () => {
    expect(validateGarden(valid())).toEqual([]);
  });
  test('a garden with location and items is valid', () => {
    const garden = valid();
    garden.location = { lat: 52.52, lng: 13.4 };
    garden.elements.push(createElementAt('bed', [2, 2], { width: 4, depth: 1.2 }));
    garden.elements.push(createElementAt('tree', [10, 5]));
    garden.elements.push(createElementAt('path', [5, 0]));
    garden.journal.push({ id: 'j_1', date: '2026-08-15', type: 'harvest' });
    expect(validateGarden(garden)).toEqual([]);
  });
  test('not an object', () => {
    expect(codes(validateGarden(null))).toEqual([':type']);
    expect(codes(validateGarden([]))).toEqual([':type']);
  });
  test('missing and wrong fields', () => {
    const garden = valid();
    delete garden.name;
    garden.elements = {};
    garden.createdAt = '21.11.2026';
    const result = codes(validateGarden(garden));
    expect(result).toContain('name:type');
    expect(result).toContain('elements:type');
    expect(result).toContain('createdAt:format');
  });
  test('empty name and unsafe id', () => {
    const garden = valid();
    garden.name = '  ';
    garden.id = 'a/b';
    const result = codes(validateGarden(garden));
    expect(result).toContain('name:required');
    expect(result).toContain('id:format');
  });
  test('location out of range', () => {
    const garden = valid();
    garden.location = { lat: 95, lng: 13 };
    expect(codes(validateGarden(garden))).toEqual(['location.lat:range']);
  });
  test('climate', () => {
    const garden = valid();
    garden.climate = { hemisphere: 'east', shiftWeeks: 30 };
    const result = codes(validateGarden(garden));
    expect(result).toContain('climate.hemisphere:unknown');
    expect(result).toContain('climate.shiftWeeks:range');
  });
  test('element geometry is checked', () => {
    const garden = valid();
    const bed = createElementAt('bed', [0, 0]);
    garden.elements = [
      { ...bed, id: 'e_a', geometry: { kind: 'polygon', points: [[0, 0], [1, 1]] } },
      { ...bed, id: 'e_b', type: 'tree' },
      { ...bed, id: 'e_c', type: 'unknown' },
      { ...createElementAt('path', [0, 0]), id: 'e_d', geometry: { kind: 'line', points: [[0, 0], [1, 0]], width: 0 } },
    ];
    expect(codes(validateGarden(garden))).toEqual([
      'elements[0]:element.points', 'elements[1]:element.geometry', 'elements[2]:element.type', 'elements[3]:element.width',
    ]);
  });
  test('only one parcel', () => {
    const garden = valid();
    garden.elements = [createElementAt('parcel', [0, 0]), createElementAt('parcel', [5, 5])];
    expect(codes(validateGarden(garden))).toEqual(['elements:element.parcelCount']);
  });
  test('plantings are checked and must belong to a bed', () => {
    const garden = valid();
    const bed = createElementAt('bed', [2, 0.6], { width: 4, depth: 1.2 });
    const tree = createElementAt('tree', [10, 10]);
    garden.elements = [bed, tree];
    garden.plantings = [
      createPlanting({ bedId: bed.id, plantId: 'carrot', shape: { kind: 'point', at: [1, 1] }, start: '2026-04-01', end: null }),
      createPlanting({ bedId: tree.id, plantId: 'carrot', shape: { kind: 'point', at: [1, 1] }, start: '2026-04-01', end: '2026-03-01' }),
    ];
    expect(codes(validateGarden(garden))).toEqual(['plantings[1]:planting.end', 'plantings[1]:planting.unknownBed']);
  });
  test('items need unique ids', () => {
    const garden = valid();
    garden.journal = [{ id: 'j_1' }, { id: 'j_1' }, { name: 'x' }, 'text'];
    garden.journal = [
      { id: 'j_1', date: '2026-05-01', type: 'note' }, { id: 'j_1', date: '2026-05-02', type: 'note' },
      { name: 'x', date: '2026-05-03', type: 'note' }, 'text',
    ];
    expect(codes(validateGarden(garden))).toEqual(['journal[1].id:duplicate', 'journal[2].id:format', 'journal[3]:type']);
  });
});

describe('validateSettings', () => {
  const good = { language: 'de', units: 'imperial', theme: 'dark', activeGardenId: null };
  test('valid', () => {
    expect(validateSettings(good)).toEqual([]);
    expect(validateSettings({ ...good, activeGardenId: 'g_1' })).toEqual([]);
  });
  test('invalid values', () => {
    expect(codes(validateSettings({ language: 'it', units: 'si', theme: 'blue', activeGardenId: 5 })))
      .toEqual(['language:unknown', 'units:unknown', 'theme:unknown', 'activeGardenId:format']);
  });
});

describe('validateIndex', () => {
  test('valid and invalid', () => {
    expect(validateIndex([{ id: 'g_1', name: 'A', updatedAt: null }])).toEqual([]);
    expect(validateIndex({})).toHaveLength(1);
    expect(validateIndex([{ id: 'g_1' }])).toHaveLength(1);
  });
});
