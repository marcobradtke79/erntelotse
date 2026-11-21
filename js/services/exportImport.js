// Export and import of gardens and full backups (docs/concept.md §4.6).
// parse/build functions are pure; downloadJson and readFileText use the DOM.

import { migrateGarden, MigrationError } from '../logic/migrate.js';
import { validateGarden, validateSettings } from '../logic/validate.js';
import { duplicateGarden } from '../logic/gardenModel.js';

export const APP_ID = 'erntelotse';
export const EXPORT_FORMAT = 1;

export class ImportError extends Error {
  /** code: invalidJson | notErntelotse | formatTooNew | gardenTooNew | invalidStructure | readFailed */
  constructor(code, details = {}) {
    super(`Import failed: ${code}`);
    this.name = 'ImportError';
    this.code = code;
    this.details = details;
  }
}

export function buildGardenExport(garden, now = new Date()) {
  return {
    app: APP_ID,
    format: EXPORT_FORMAT,
    kind: 'garden',
    exportedAt: now.toISOString(),
    garden,
  };
}

export function buildBackup(gardens, settings, now = new Date()) {
  return {
    app: APP_ID,
    format: EXPORT_FORMAT,
    kind: 'backup',
    exportedAt: now.toISOString(),
    gardens,
    settings,
  };
}

function slug(text) {
  const result = text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return result || 'garden';
}

function day(now) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function gardenFileName(gardenName, now = new Date()) {
  return `erntelotse-${slug(gardenName)}-${day(now)}.json`;
}

export function backupFileName(now = new Date()) {
  return `erntelotse-backup-${day(now)}.json`;
}

function importGarden(value) {
  let garden;
  try {
    garden = migrateGarden(value);
  } catch (error) {
    if (error instanceof MigrationError && error.code === 'tooNew') throw new ImportError('gardenTooNew');
    throw new ImportError('invalidStructure', { reason: error.code ?? error.message });
  }
  const problems = validateGarden(garden);
  if (problems.length > 0) throw new ImportError('invalidStructure', { problems });
  return garden;
}

/**
 * Parses an export file. Returns { kind: 'garden' | 'backup', gardens, settings }.
 * Throws ImportError; nothing is returned unless the whole file is valid.
 */
export function parseImport(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new ImportError('invalidJson');
  }
  if (!data || typeof data !== 'object' || data.app !== APP_ID) throw new ImportError('notErntelotse');
  if (!Number.isInteger(data.format) || data.format < 1) throw new ImportError('invalidStructure');
  if (data.format > EXPORT_FORMAT) throw new ImportError('formatTooNew');

  if (data.kind === 'garden') {
    return { kind: 'garden', gardens: [importGarden(data.garden)], settings: null };
  }
  if (data.kind === 'backup') {
    if (!Array.isArray(data.gardens)) throw new ImportError('invalidStructure');
    const gardens = data.gardens.map(importGarden);
    const ids = new Set(gardens.map((garden) => garden.id));
    if (ids.size !== gardens.length) throw new ImportError('invalidStructure', { reason: 'duplicateIds' });
    let settings = null;
    if (data.settings !== null && data.settings !== undefined) {
      if (validateSettings(data.settings).length > 0) throw new ImportError('invalidStructure', { reason: 'settings' });
      settings = data.settings;
    }
    return { kind: 'backup', gardens, settings };
  }
  throw new ImportError('invalidStructure', { reason: 'kind' });
}

/** Copy of an imported garden that does not collide with existing ids. */
export function copyForImport(garden, { name, now = new Date() }) {
  return duplicateGarden(garden, { name, now });
}

export function downloadJson(fileName, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function readFileText(file) {
  try {
    return await file.text();
  } catch {
    throw new ImportError('readFailed');
  }
}
