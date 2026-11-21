import { describe, test, expect } from './harness.js';
import {
  buildGardenExport, buildBackup, parseImport, copyForImport, gardenFileName, backupFileName,
  ImportError, EXPORT_FORMAT,
} from '../js/services/exportImport.js';
import { createGarden } from '../js/logic/gardenModel.js';
import { CURRENT_SCHEMA_VERSION } from '../js/logic/migrate.js';

const now = new Date('2026-11-21T10:00:00Z');
const garden = (name, id) => createGarden({ name, id, now });
const settings = { language: 'es', units: 'imperial', theme: 'system', activeGardenId: 'g_a' };

describe('garden export', () => {
  test('round trip', () => {
    const a = garden('Home garden', 'g_a');
    a.elements.push({ id: 'e_1', type: 'bed', name: 'Bed 1' });
    const text = JSON.stringify(buildGardenExport(a, now));
    expect(parseImport(text)).toEqual({ kind: 'garden', gardens: [a], settings: null });
  });
  test('envelope', () => {
    const data = buildGardenExport(garden('A', 'g_a'), now);
    expect(data.app).toBe('erntelotse');
    expect(data.format).toBe(EXPORT_FORMAT);
    expect(data.exportedAt).toBe(now.toISOString());
  });
});

describe('backup', () => {
  test('round trip', () => {
    const gardens = [garden('A', 'g_a'), garden('B', 'g_b')];
    const result = parseImport(JSON.stringify(buildBackup(gardens, settings, now)));
    expect(result).toEqual({ kind: 'backup', gardens, settings });
  });
  test('duplicate garden ids are rejected', () => {
    const text = JSON.stringify(buildBackup([garden('A', 'g_a'), garden('A', 'g_a')], settings, now));
    expect(() => parseImport(text)).toThrow('invalidStructure');
  });
  test('invalid settings are rejected', () => {
    const text = JSON.stringify(buildBackup([garden('A', 'g_a')], { language: 'xx' }, now));
    expect(() => parseImport(text)).toThrow('invalidStructure');
  });
});

describe('rejected files', () => {
  test('broken JSON', () => {
    const error = expect(() => parseImport('{"app": ')).toThrow('invalidJson');
    expect(error instanceof ImportError).toBeTruthy();
  });
  test('foreign JSON', () => {
    expect(() => parseImport('{"name": "something"}')).toThrow('notErntelotse');
    expect(() => parseImport('[1, 2]')).toThrow('notErntelotse');
    expect(() => parseImport('null')).toThrow('notErntelotse');
  });
  test('newer export format', () => {
    const data = { ...buildGardenExport(garden('A', 'g_a'), now), format: EXPORT_FORMAT + 1 };
    expect(() => parseImport(JSON.stringify(data))).toThrow('formatTooNew');
  });
  test('garden from a newer schema', () => {
    const data = buildGardenExport({ ...garden('A', 'g_a'), schemaVersion: CURRENT_SCHEMA_VERSION + 1 }, now);
    expect(() => parseImport(JSON.stringify(data))).toThrow('gardenTooNew');
  });
  test('invalid garden or unknown kind', () => {
    const data = buildGardenExport({ ...garden('A', 'g_a'), elements: 'none' }, now);
    expect(() => parseImport(JSON.stringify(data))).toThrow('invalidStructure');
    expect(() => parseImport(JSON.stringify({ ...data, kind: 'other' }))).toThrow('invalidStructure');
    expect(() => parseImport(JSON.stringify({ app: 'erntelotse', kind: 'garden' }))).toThrow('invalidStructure');
  });
});

describe('copyForImport', () => {
  test('gets a new id and name, keeps content', () => {
    const a = garden('A', 'g_a');
    a.elements.push({ id: 'e_1', type: 'bed' });
    const copy = copyForImport(a, { name: 'A (copy)', now });
    expect(copy.id === 'g_a').toBeFalsy();
    expect(copy.name).toBe('A (copy)');
    expect(copy.elements).toEqual(a.elements);
  });
  test('long names are shortened to the limit', () => {
    const copy = copyForImport(garden('A', 'g_a'), { name: 'x'.repeat(90), now });
    expect(copy.name).toHaveLength(80);
  });
});

describe('file names', () => {
  test('slug and date', () => {
    const date = new Date(2026, 10, 21);
    expect(gardenFileName('Hausgarten Süd!', date)).toBe('erntelotse-hausgarten-sud-2026-11-21.json');
    expect(gardenFileName('***', date)).toBe('erntelotse-garden-2026-11-21.json');
    expect(backupFileName(date)).toBe('erntelotse-backup-2026-11-21.json');
  });
});
