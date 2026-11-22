// Garden index and the active garden document.
// All changes go through these functions; the active garden is auto-saved (debounced).

import { reactive, toRaw } from 'vue';
import { createGarden as buildGarden, duplicateGarden } from '../logic/gardenModel.js';
import { createHistory } from '../logic/history.js';
import { normaliseGeometry } from '../logic/elements.js';
import { StorageQuotaError, StorageReadError } from '../services/storage.js';
import { settings, setActiveGardenId, replaceSettings, resetSettings } from './settings.js';
import { showError } from './toast.js';

const SAVE_DELAY_MS = 500;

export const gardens = reactive({
  /** [{ id, name, updatedAt }] */
  index: [],
  /** The full document of the active garden, or null */
  active: null,
  /** id → error code for gardens that could not be loaded */
  loadErrors: {},
});

/** Undo/redo state of the drawing of the active garden (in memory only) */
export const editor = reactive({ canUndo: false, canRedo: false });

let storage = null;
let saveTimer = null;
let dirty = false;
const history = createHistory(100);

function syncHistory() {
  editor.canUndo = history.canUndo();
  editor.canRedo = history.canRedo();
}

function resetHistory() {
  history.clear();
  syncHistory();
}

function reportWriteError(error) {
  console.error(error);
  showError(error instanceof StorageQuotaError ? 'errors.quota' : 'errors.saveFailed');
}

function refreshIndex() {
  gardens.index = storage.readIndex();
}

function plain(garden) {
  return structuredClone(toRaw(garden));
}

function write(garden) {
  try {
    storage.writeGarden(plain(garden));
    refreshIndex();
    return true;
  } catch (error) {
    reportWriteError(error);
    return false;
  }
}

function nameOf(id) {
  return gardens.index.find((entry) => entry.id === id)?.name ?? id;
}

function loadActive(id) {
  resetHistory();
  gardens.active = null;
  if (!id) return;
  try {
    gardens.active = storage.readGarden(id);
    delete gardens.loadErrors[id];
  } catch (error) {
    if (!(error instanceof StorageReadError)) throw error;
    gardens.loadErrors[id] = error.code;
    showError(error.code === 'tooNew' ? 'gardens.loadErrorTooNew' : 'gardens.loadError', { name: nameOf(id) });
  }
}

function readDocument(id) {
  if (gardens.active?.id === id) {
    flush();
    return plain(gardens.active);
  }
  return storage.readGarden(id);
}

export function initGardens(storageService) {
  storage = storageService;
  refreshIndex();
  const preferred = settings.activeGardenId;
  const exists = gardens.index.some((entry) => entry.id === preferred);
  const id = exists ? preferred : gardens.index[0]?.id ?? null;
  if (id !== settings.activeGardenId) setActiveGardenId(id);
  loadActive(id);

  addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });
}

export function hasGarden(id) {
  return gardens.index.some((entry) => entry.id === id);
}

/** Writes pending changes of the active garden immediately. */
export function flush() {
  clearTimeout(saveTimer);
  saveTimer = null;
  if (dirty && gardens.active) {
    dirty = false;
    write(gardens.active);
  }
}

function scheduleSave() {
  dirty = true;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flush, SAVE_DELAY_MS);
}

/** Changes the active garden through a callback and schedules saving. */
export function mutateActive(change) {
  if (!gardens.active) return;
  change(gardens.active);
  gardens.active.updatedAt = new Date().toISOString();
  scheduleSave();
}

// --- Elements of the active garden (with undo) -------------------------------

function snapshot() {
  return JSON.stringify(toRaw(gardens.active.elements));
}

/** Records the current elements for undo, then applies the change. */
function changeElements(change) {
  if (!gardens.active) return;
  history.record(snapshot());
  mutateActive((garden) => change(garden.elements));
  syncHistory();
}

export function addElement(element) {
  changeElements((elements) => elements.push(element));
}

export function updateElementGeometry(id, geometry) {
  changeElements((elements) => {
    const element = elements.find((item) => item.id === id);
    if (element) element.geometry = normaliseGeometry(geometry);
  });
}

/** Changes plain fields such as name or plantedYear. */
export function updateElement(id, fields) {
  changeElements((elements) => {
    const element = elements.find((item) => item.id === id);
    if (element) Object.assign(element, fields);
  });
}

export function deleteElement(id) {
  changeElements((elements) => {
    const index = elements.findIndex((item) => item.id === id);
    if (index !== -1) elements.splice(index, 1);
  });
}

export function undo() {
  if (!gardens.active) return;
  const previous = history.undo(snapshot());
  if (previous === null) return;
  mutateActive((garden) => {
    garden.elements = JSON.parse(previous);
  });
  syncHistory();
}

export function redo() {
  if (!gardens.active) return;
  const next = history.redo(snapshot());
  if (next === null) return;
  mutateActive((garden) => {
    garden.elements = JSON.parse(next);
  });
  syncHistory();
}

/** Places the garden on the map. Element coordinates are relative, so they move along. */
export function setLocation(location) {
  mutateActive((garden) => {
    garden.location = location ? { lat: location.lat, lng: location.lng } : null;
  });
}

export function selectGarden(id) {
  flush();
  setActiveGardenId(id);
  loadActive(id);
}

export function createGarden(name) {
  flush();
  const garden = buildGarden({ name });
  if (!write(garden)) return null;
  setActiveGardenId(garden.id);
  resetHistory();
  gardens.active = garden;
  return garden;
}

export function renameGarden(id, name) {
  try {
    const garden = readDocument(id);
    garden.name = name.trim();
    garden.updatedAt = new Date().toISOString();
    if (!write(garden)) return false;
    if (gardens.active?.id === id) {
      gardens.active.name = garden.name;
      gardens.active.updatedAt = garden.updatedAt;
    }
    return true;
  } catch (error) {
    if (error instanceof StorageReadError) showError('gardens.loadError', { name: nameOf(id) });
    else reportWriteError(error);
    return false;
  }
}

export function duplicateGardenById(id, name) {
  try {
    const copy = duplicateGarden(readDocument(id), { name });
    return write(copy) ? copy : null;
  } catch (error) {
    if (error instanceof StorageReadError) showError('gardens.loadError', { name: nameOf(id) });
    else reportWriteError(error);
    return null;
  }
}

/** Plain document of a garden, e.g. for export. Throws StorageReadError. */
export function getGardenDocument(id) {
  return readDocument(id);
}

export function getAllGardenDocuments() {
  flush();
  return gardens.index.map((entry) => storage.readGarden(entry.id));
}

/**
 * Deletes a garden. Returns its last document for undo (null if it could not be read).
 */
export function deleteGarden(id) {
  let snapshot = null;
  try {
    snapshot = readDocument(id);
  } catch {
    snapshot = null;
  }
  if (gardens.active?.id === id) {
    clearTimeout(saveTimer);
    dirty = false;
  }
  try {
    storage.deleteGarden(id);
  } catch (error) {
    reportWriteError(error);
    return null;
  }
  delete gardens.loadErrors[id];
  refreshIndex();
  if (settings.activeGardenId === id) {
    const next = gardens.index[0]?.id ?? null;
    setActiveGardenId(next);
    loadActive(next);
  }
  return snapshot;
}

/** Stores a complete document (undo of delete, import). Reloads it if it is the active garden. */
export function putGarden(garden, { select = false } = {}) {
  if (gardens.active?.id === garden.id) {
    clearTimeout(saveTimer);
    dirty = false;
  }
  if (!write(garden)) return false;
  if (select || gardens.active?.id === garden.id) {
    setActiveGardenId(garden.id);
    resetHistory();
    gardens.active = plain(garden);
    delete gardens.loadErrors[garden.id];
  } else if (!gardens.active && !settings.activeGardenId) {
    selectGarden(garden.id);
  }
  return true;
}

/** Replaces all data with the content of a backup. */
export function replaceAllData(backupGardens, backupSettings) {
  clearTimeout(saveTimer);
  dirty = false;
  try {
    storage.replaceAll(backupGardens, backupSettings);
  } catch (error) {
    reportWriteError(error);
    return false;
  }
  if (backupSettings) replaceSettings(backupSettings);
  gardens.loadErrors = {};
  refreshIndex();
  const id = hasGarden(settings.activeGardenId) ? settings.activeGardenId : gardens.index[0]?.id ?? null;
  setActiveGardenId(id);
  loadActive(id);
  return true;
}

/** Deletes everything this app stored in the browser. */
export function clearAllData() {
  clearTimeout(saveTimer);
  dirty = false;
  storage.clearAll();
  resetHistory();
  resetSettings();
  gardens.index = [];
  gardens.active = null;
  gardens.loadErrors = {};
}
