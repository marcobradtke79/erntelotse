import { describe, test, expect } from './harness.js';
import { migrateGarden, MigrationError, CURRENT_SCHEMA_VERSION } from '../js/logic/migrate.js';
import { createGarden } from '../js/logic/gardenModel.js';

describe('migrateGarden', () => {
  test('current version passes unchanged', () => {
    const garden = createGarden({ name: 'A' });
    expect(migrateGarden(garden)).toBe(garden);
  });
  test('rejects non-objects and missing versions', () => {
    expect(() => migrateGarden(null)).toThrow('notAnObject');
    expect(() => migrateGarden([])).toThrow('notAnObject');
    expect(() => migrateGarden({ name: 'x' })).toThrow('missingVersion');
    expect(() => migrateGarden({ schemaVersion: 0 })).toThrow('missingVersion');
    expect(() => migrateGarden({ schemaVersion: '1' })).toThrow('missingVersion');
  });
  test('rejects documents newer than the app', () => {
    const error = expect(() => migrateGarden({ schemaVersion: CURRENT_SCHEMA_VERSION + 1 })).toThrow('tooNew');
    expect(error instanceof MigrationError).toBeTruthy();
  });
  test('version 1 plantings get their pre-cultivation (kept for plants raised indoors)', () => {
    const planting = (plantId) => ({ id: 'p_1', bedId: 'e_1', plantId, shape: { kind: 'point', at: [1, 1] }, start: '2026-05-18', end: '2026-10-04', count: null, note: '' });
    const input = { schemaVersion: 1, name: 'A', plantings: [planting('tomato'), planting('carrot'), planting('gone')] };
    const result = migrateGarden(input);
    expect(result.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(result.plantings.map((p) => p.preStart)).toEqual(['2026-03-09', null, null]);
    expect('preStart' in input.plantings[0]).toBe(false);
  });
  test('version 2 gardens get an empty seed stock', () => {
    const result = migrateGarden({ schemaVersion: 2, name: 'A', plantings: [] });
    expect(result.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(result.seedStock).toEqual([]);
    expect(migrateGarden({ schemaVersion: 1, name: 'A', plantings: [] }).seedStock).toEqual([]);
  });
  test('applies steps in order without changing the input', () => {
    const migrations = {
      1: (doc) => ({ ...doc, steps: ['1→2'] }),
      2: (doc) => ({ ...doc, steps: [...doc.steps, '2→3'] }),
    };
    const input = { schemaVersion: 1, name: 'A' };
    const result = migrateGarden(input, { migrations, current: 3 });
    expect(result).toEqual({ schemaVersion: 3, name: 'A', steps: ['1→2', '2→3'] });
    expect(input).toEqual({ schemaVersion: 1, name: 'A' });
  });
  test('starts at the document version', () => {
    const migrations = {
      1: () => { throw new Error('must not run'); },
      2: (doc) => ({ ...doc, done: true }),
    };
    expect(migrateGarden({ schemaVersion: 2 }, { migrations, current: 3 })).toEqual({ schemaVersion: 3, done: true });
  });
  test('missing step is reported', () => {
    expect(() => migrateGarden({ schemaVersion: 1 }, { migrations: {}, current: 2 })).toThrow('missingStep');
  });
});
