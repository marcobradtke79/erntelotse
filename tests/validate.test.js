import { describe, test, expect } from './harness.js';
import { validateGarden, validateSettings, validateIndex } from '../js/logic/validate.js';
import { createGarden } from '../js/logic/gardenModel.js';

const valid = () => createGarden({ name: 'Garden', now: new Date('2026-11-21T10:00:00Z'), id: 'g_valid' });
const codes = (problems) => problems.map((p) => `${p.path}:${p.code}`);

describe('validateGarden', () => {
  test('a new garden is valid', () => {
    expect(validateGarden(valid())).toEqual([]);
  });
  test('a garden with location and items is valid', () => {
    const garden = valid();
    garden.location = { lat: 52.52, lng: 13.4 };
    garden.elements.push({ id: 'e_1', type: 'bed' });
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
  test('items need unique ids', () => {
    const garden = valid();
    garden.plantings = [{ id: 'p_1' }, { id: 'p_1' }, { name: 'x' }, 'text'];
    expect(codes(validateGarden(garden))).toEqual(['plantings[1].id:duplicate', 'plantings[2].id:format', 'plantings[3]:type']);
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
