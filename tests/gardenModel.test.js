import { describe, test, expect } from './harness.js';
import { createGarden, duplicateGarden, checkGardenName, gardenSummary } from '../js/logic/gardenModel.js';
import { validateGarden } from '../js/logic/validate.js';
import { CURRENT_SCHEMA_VERSION } from '../js/logic/migrate.js';

const now = new Date('2026-11-21T10:00:00Z');

describe('createGarden', () => {
  test('creates a valid, empty document', () => {
    const garden = createGarden({ name: '  Home garden ', now });
    expect(garden.name).toBe('Home garden');
    expect(garden.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(garden.createdAt).toBe('2026-11-21T10:00:00.000Z');
    expect(garden.elements).toEqual([]);
    expect(garden.location).toBeNull();
    expect(validateGarden(garden)).toEqual([]);
  });
  test('ids are unique and storage-safe', () => {
    const a = createGarden({ name: 'A' });
    const b = createGarden({ name: 'B' });
    expect(a.id === b.id).toBeFalsy();
    expect(/^g_[a-z0-9]{10}$/.test(a.id)).toBeTruthy();
  });
});

describe('duplicateGarden', () => {
  test('deep copy with new id, name and dates', () => {
    const original = createGarden({ name: 'A', now });
    original.elements.push({ id: 'e_1', type: 'bed' });
    const later = new Date('2026-12-01T08:00:00Z');
    const copy = duplicateGarden(original, { name: 'A (copy)', now: later });
    expect(copy.id === original.id).toBeFalsy();
    expect(copy.name).toBe('A (copy)');
    expect(copy.createdAt).toBe(later.toISOString());
    expect(copy.elements).toEqual(original.elements);
    copy.elements[0].type = 'tree';
    expect(original.elements[0].type).toBe('bed');
  });
});

describe('checkGardenName', () => {
  test('codes', () => {
    expect(checkGardenName('Garden')).toBeNull();
    expect(checkGardenName('   ')).toBe('required');
    expect(checkGardenName('x'.repeat(81))).toBe('tooLong');
    expect(checkGardenName(` ${'x'.repeat(80)} `)).toBeNull();
  });
});

test('gardenSummary', () => {
  const garden = createGarden({ name: 'A', now, id: 'g_test' });
  expect(gardenSummary(garden)).toEqual({ id: 'g_test', name: 'A', updatedAt: '2026-11-21T10:00:00.000Z' });
});
