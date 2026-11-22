// Exports a garden or a full backup as a file and remembers when (for the reminder).

import { buildGardenExport, buildBackup, downloadJson, gardenFileName, backupFileName } from './exportImport.js';
import { gardens, getGardenDocument, getAllGardenDocuments, markExported } from '../stores/gardens.js';
import { settings } from '../stores/settings.js';

export const REMINDER_DAYS = 30;

/** Throws StorageReadError when the garden cannot be read. */
export function exportGardenFile(id) {
  const garden = getGardenDocument(id);
  downloadJson(gardenFileName(garden.name), buildGardenExport(garden));
  markExported([id]);
}

export function exportBackupFile() {
  downloadJson(backupFileName(), buildBackup(getAllGardenDocuments(), { ...settings }));
  markExported(gardens.index.map((entry) => entry.id));
}

/** True when a garden with content has not been exported for REMINDER_DAYS. */
export function needsBackup(garden, now = new Date()) {
  if (!garden.elements.length && !garden.plantings.length) return false;
  const since = garden.exportedAt ?? garden.createdAt;
  return now - new Date(since) > REMINDER_DAYS * 24 * 60 * 60 * 1000;
}
