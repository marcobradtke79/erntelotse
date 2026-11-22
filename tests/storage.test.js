import { describe, test, expect } from './harness.js';
import {
  createStorage, createMemoryBackend, KEYS, StorageQuotaError, StorageReadError,
} from '../js/services/storage.js';
import { createGarden } from '../js/logic/gardenModel.js';
import { CURRENT_SCHEMA_VERSION } from '../js/logic/migrate.js';

// Valid but large: twenty journal entries with long notes
const filler = (count) => Array.from({ length: count }, (_, i) => ({ id: `j_${i}`, date: '2026-01-01', type: 'note', note: 'x'.repeat(400) }));
const garden = (name, id) => createGarden({ name, id, now: new Date('2026-11-21T10:00:00Z') });

describe('settings', () => {
  test('round trip', () => {
    const storage = createStorage(createMemoryBackend());
    expect(storage.readSettings()).toBeNull();
    const settings = { language: 'fr', units: 'metric', theme: 'light', activeGardenId: null };
    storage.writeSettings(settings);
    expect(storage.readSettings()).toEqual(settings);
  });
  test('invalid or corrupt settings read as null', () => {
    const backend = createMemoryBackend();
    const storage = createStorage(backend);
    backend.setItem(KEYS.settings, '{broken');
    expect(storage.readSettings()).toBeNull();
    backend.setItem(KEYS.settings, JSON.stringify({ language: 'xx' }));
    expect(storage.readSettings()).toBeNull();
  });
});

describe('gardens', () => {
  test('write, read and index', () => {
    const storage = createStorage(createMemoryBackend());
    const a = garden('A', 'g_a');
    storage.writeGarden(a);
    storage.writeGarden(garden('B', 'g_b'));
    expect(storage.readGarden('g_a')).toEqual(a);
    expect(storage.readIndex().map((entry) => entry.name)).toEqual(['A', 'B']);
  });
  test('updating keeps one index entry', () => {
    const storage = createStorage(createMemoryBackend());
    const a = garden('A', 'g_a');
    storage.writeGarden(a);
    storage.writeGarden({ ...a, name: 'A2' });
    expect(storage.readIndex()).toEqual([{ id: 'g_a', name: 'A2', updatedAt: a.updatedAt }]);
  });
  test('delete removes document and index entry', () => {
    const storage = createStorage(createMemoryBackend());
    storage.writeGarden(garden('A', 'g_a'));
    storage.writeGarden(garden('B', 'g_b'));
    storage.deleteGarden('g_a');
    expect(storage.readIndex().map((entry) => entry.id)).toEqual(['g_b']);
    expect(() => storage.readGarden('g_a')).toThrow('missing');
  });
  test('refuses to store an invalid garden', () => {
    const storage = createStorage(createMemoryBackend());
    expect(() => storage.writeGarden({ ...garden('A', 'g_a'), name: '' })).toThrow(Error);
    expect(storage.readIndex()).toEqual([]);
  });
  test('corrupt, invalid and too new documents', () => {
    const backend = createMemoryBackend();
    const storage = createStorage(backend);
    backend.setItem(KEYS.garden('g_x'), '{not json');
    expect(() => storage.readGarden('g_x')).toThrow('corrupt');
    backend.setItem(KEYS.garden('g_y'), JSON.stringify({ schemaVersion: 1, id: 'g_y' }));
    expect(() => storage.readGarden('g_y')).toThrow('invalid');
    backend.setItem(KEYS.garden('g_z'), JSON.stringify({ ...garden('Z', 'g_z'), schemaVersion: CURRENT_SCHEMA_VERSION + 1 }));
    const error = expect(() => storage.readGarden('g_z')).toThrow('tooNew');
    expect(error instanceof StorageReadError).toBeTruthy();
  });
});

describe('index reconciliation', () => {
  test('rebuilds a lost index from garden documents', () => {
    const backend = createMemoryBackend();
    const storage = createStorage(backend);
    storage.writeGarden(garden('A', 'g_a'));
    backend.removeItem(KEYS.gardens);
    expect(storage.readIndex().map((entry) => entry.name)).toEqual(['A']);
    expect(JSON.parse(backend.getItem(KEYS.gardens))).toHaveLength(1);
  });
  test('drops entries without document and repairs a corrupt index', () => {
    const backend = createMemoryBackend();
    const storage = createStorage(backend);
    storage.writeGarden(garden('A', 'g_a'));
    backend.setItem(KEYS.gardens, JSON.stringify([{ id: 'g_a', name: 'A', updatedAt: null }, { id: 'g_gone', name: 'Gone', updatedAt: null }]));
    expect(storage.readIndex().map((entry) => entry.id)).toEqual(['g_a']);
    backend.setItem(KEYS.gardens, '[[[');
    expect(storage.readIndex().map((entry) => entry.id)).toEqual(['g_a']);
  });
  test('a damaged document still appears in the index', () => {
    const backend = createMemoryBackend();
    const storage = createStorage(backend);
    backend.setItem(KEYS.garden('g_bad'), '{oops');
    expect(storage.readIndex()).toEqual([{ id: 'g_bad', name: 'g_bad', updatedAt: null }]);
  });
});

describe('quota', () => {
  test('quota error is reported and previous data stays intact', () => {
    const backend = createMemoryBackend({ quotaBytes: 4000 });
    const storage = createStorage(backend);
    const a = garden('A', 'g_a');
    storage.writeGarden(a);
    const big = { ...a, journal: filler(20) };
    expect(() => storage.writeGarden(big)).toThrow(StorageQuotaError);
    expect(storage.readGarden('g_a')).toEqual(a);
    expect(storage.readIndex()).toHaveLength(1);
  });
  test('failed index write restores the garden', () => {
    const backend = createMemoryBackend();
    let failIndex = false;
    const flaky = Object.create(backend, {
      length: { get: () => backend.length },
      setItem: {
        value(key, value) {
          if (failIndex && key === KEYS.gardens) {
            const error = new Error('full');
            error.name = 'QuotaExceededError';
            throw error;
          }
          backend.setItem(key, value);
        },
      },
    });
    const storage = createStorage(flaky);
    const a = garden('A', 'g_a');
    storage.writeGarden(a);
    failIndex = true;
    expect(() => storage.writeGarden({ ...a, name: 'Renamed' })).toThrow(StorageQuotaError);
    failIndex = false;
    expect(storage.readGarden('g_a')).toEqual(a);
    expect(storage.readIndex()[0].name).toBe('A');
    // A new garden whose index entry fails is removed again
    failIndex = true;
    expect(() => storage.writeGarden(garden('B', 'g_b'))).toThrow(StorageQuotaError);
    failIndex = false;
    expect(backend.getItem(KEYS.garden('g_b'))).toBeNull();
  });
});

describe('usage, clearAll and replaceAll', () => {
  test('usage counts only app keys', () => {
    const backend = createMemoryBackend();
    const storage = createStorage(backend);
    expect(storage.usage()).toBe(0);
    backend.setItem('other', 'x'.repeat(100));
    expect(storage.usage()).toBe(0);
    storage.writeGarden(garden('A', 'g_a'));
    expect(storage.usage() > 0).toBeTruthy();
  });
  test('clearAll keeps keys of other apps', () => {
    const backend = createMemoryBackend();
    const storage = createStorage(backend);
    backend.setItem('other', 'keep');
    storage.writeGarden(garden('A', 'g_a'));
    storage.writeSettings({ language: 'en', units: 'metric', theme: 'system', activeGardenId: 'g_a' });
    storage.clearAll();
    expect(backend.length).toBe(1);
    expect(backend.getItem('other')).toBe('keep');
  });
  test('replaceAll swaps all data', () => {
    const storage = createStorage(createMemoryBackend());
    storage.writeGarden(garden('Old', 'g_old'));
    const settings = { language: 'pt', units: 'metric', theme: 'dark', activeGardenId: 'g_new' };
    storage.replaceAll([garden('New', 'g_new')], settings);
    expect(storage.readIndex().map((entry) => entry.id)).toEqual(['g_new']);
    expect(storage.readSettings()).toEqual(settings);
  });
  test('replaceAll restores the previous state on failure', () => {
    const backend = createMemoryBackend({ quotaBytes: 6000 });
    const storage = createStorage(backend);
    const old = garden('Old', 'g_old');
    storage.writeGarden(old);
    const huge = { ...garden('Huge', 'g_huge'), journal: filler(20) };
    expect(() => storage.replaceAll([huge], null)).toThrow(StorageQuotaError);
    expect(storage.readGarden('g_old')).toEqual(old);
    expect(storage.readIndex().map((entry) => entry.id)).toEqual(['g_old']);
  });
});
