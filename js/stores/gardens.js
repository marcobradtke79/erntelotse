// Garden index and the active garden document.
// All changes go through these functions; the active garden is auto-saved (debounced).

import { reactive, toRaw } from 'vue';
import { createGarden as buildGarden, duplicateGarden } from '../logic/gardenModel.js';
import { createHistory } from '../logic/history.js';
import { normaliseGeometry } from '../logic/elements.js';
import { normaliseShape, moveShape } from '../logic/plantings.js';
import { journalEntryForHint } from '../logic/tasks.js';
import { seedNeed, takeSeeds, returnSeeds } from '../logic/seeds.js';
import { buildCatalog } from '../logic/catalog.js';
import { PLANTS } from '../data/plants.js';
import { rigidTransform } from '../logic/geometry.js';
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
  // JSON, not structuredClone: a reactive document can contain proxies even in its
  // raw form (e.g. after assigning a filtered reactive array), and structuredClone
  // rejects them. Stored data is JSON anyway.
  return JSON.parse(JSON.stringify(toRaw(garden)));
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

// --- Elements and plantings of the active garden (with undo) ----------------

/** Undo covers the drawing: elements and plantings together. */
function snapshot() {
  const { elements, plantings } = toRaw(gardens.active);
  return JSON.stringify({ elements, plantings });
}

function restoreSnapshot(json) {
  const { elements, plantings } = JSON.parse(json);
  mutateActive((garden) => {
    garden.elements = elements;
    garden.plantings = plantings;
  });
}

/** Records the current state for undo, then applies the change. */
function changeDrawing(change) {
  if (!gardens.active) return;
  history.record(snapshot());
  mutateActive(change);
  syncHistory();
}

export function addElement(element) {
  changeDrawing((garden) => garden.elements.push(element));
}

/**
 * New geometry for an element. When a bed is only moved or rotated, its
 * plantings move along; when it is resized they stay where they are.
 */
export function updateElementGeometry(id, geometry) {
  changeDrawing((garden) => {
    const element = garden.elements.find((item) => item.id === id);
    if (!element) return;
    const before = element.geometry;
    element.geometry = normaliseGeometry(geometry);
    if (element.type !== 'bed') return;
    const transform = rigidTransform(before.points, element.geometry.points);
    if (!transform) return;
    for (const planting of garden.plantings) {
      if (planting.bedId === id) planting.shape = moveShape(planting.shape, transform);
    }
  });
}

/** Changes plain fields such as name, plantId or plantedYear. */
export function updateElement(id, fields) {
  changeDrawing((garden) => {
    const element = garden.elements.find((item) => item.id === id);
    if (element) Object.assign(element, fields);
  });
}

/** Deletes an element (a bed together with its plantings). Returns what was removed, for restoring. */
export function deleteElement(id) {
  const garden = gardens.active;
  if (!garden) return null;
  const element = garden.elements.find((item) => item.id === id);
  if (!element) return null;
  // JSON, not structuredClone: element and plantings are Vue proxies here
  const removed = JSON.parse(JSON.stringify({ element, plantings: garden.plantings.filter((planting) => planting.bedId === id) }));
  // Filter the raw arrays: filtering the reactive ones would put proxies into the document
  changeDrawing((target) => {
    target.elements = toRaw(target.elements).filter((item) => item.id !== id);
    target.plantings = toRaw(target.plantings).filter((planting) => planting.bedId !== id);
  });
  return removed;
}

export function restoreElement({ element, plantings }) {
  changeDrawing((garden) => {
    garden.elements.push(element);
    garden.plantings.push(...plantings);
  });
}

export function addPlantings(plantings) {
  changeDrawing((garden) => garden.plantings.push(...plantings));
}

/** Changes fields of a planting; a new shape is normalised. */
export function updatePlanting(id, fields) {
  changeDrawing((garden) => {
    const planting = garden.plantings.find((item) => item.id === id);
    if (!planting) return;
    Object.assign(planting, fields);
    if (fields.shape) planting.shape = normaliseShape(fields.shape);
  });
}

/** Deletes a planting. Returns its copy, for restoring. */
export function deletePlanting(id) {
  const planting = gardens.active?.plantings.find((item) => item.id === id);
  if (!planting) return null;
  const copy = JSON.parse(JSON.stringify(planting));
  changeDrawing((garden) => {
    garden.plantings = toRaw(garden.plantings).filter((item) => item.id !== id);
  });
  return copy;
}

export function undo() {
  if (!gardens.active) return;
  const previous = history.undo(snapshot());
  if (previous === null) return;
  restoreSnapshot(previous);
  syncHistory();
}

export function redo() {
  if (!gardens.active) return;
  const next = history.redo(snapshot());
  if (next === null) return;
  restoreSnapshot(next);
  syncHistory();
}

// --- Task states and journal (no undo; done tasks write the journal) ------

/** 'done' writes a journal entry for the task; 'skipped' or 'open' removes it. */
const SOWING_HINTS = ['sowIndoor', 'sowOutdoor'];

/**
 * Sets a task's state. A sowing marked done takes its seeds out of the seed stock; leaving
 * "done" puts back exactly what was taken. Returns { plantId, count } when seeds were taken.
 */
export function setTaskState(hint, state, today) {
  let taken = null;
  mutateActive((garden) => {
    const states = { ...toRaw(garden.taskStates) };
    let stock = toRaw(garden.seedStock);
    const before = states[hint.key];
    if (before?.seeds?.length) stock = returnSeeds(stock, before.seeds);
    if (state === 'open') delete states[hint.key];
    else states[hint.key] = { state, on: today };
    if (state === 'done' && hint.sourceKind === 'planting' && SOWING_HINTS.includes(hint.hint)) {
      const planting = garden.plantings.find((item) => item.id === hint.sourceId);
      const catalog = buildCatalog(PLANTS, toRaw(garden.plantOverrides), toRaw(garden.customPlants));
      const need = planting ? seedNeed(planting, catalog.get(planting.plantId)) : null;
      if (need?.kind === 'seeds') {
        const result = takeSeeds(stock, planting.plantId, need.count);
        if (result.used.length) {
          stock = result.seedStock;
          states[hint.key].seeds = result.used;
          taken = { plantId: planting.plantId, count: result.used.reduce((sum, item) => sum + item.count, 0) };
        }
      }
    }
    garden.taskStates = states;
    if (stock !== toRaw(garden.seedStock)) garden.seedStock = stock;
    const journal = toRaw(garden.journal).filter((entry) => entry.taskKey !== hint.key);
    if (state === 'done') journal.push(journalEntryForHint(hint, today));
    garden.journal = journal;
  });
  return taken;
}

// --- Seed stock ---------------------------------------------------------------

export function addSeedEntry(entry) {
  mutateActive((garden) => {
    garden.seedStock = [...toRaw(garden.seedStock), JSON.parse(JSON.stringify(entry))];
  });
}

export function updateSeedEntry(id, fields) {
  mutateActive((garden) => {
    garden.seedStock = toRaw(garden.seedStock).map((entry) => (entry.id === id ? { ...entry, ...JSON.parse(JSON.stringify(fields)) } : entry));
  });
}

/** Deletes a stock entry. Returns its copy for undo. */
export function deleteSeedEntry(id) {
  const entry = gardens.active?.seedStock.find((item) => item.id === id);
  if (!entry) return null;
  const copy = JSON.parse(JSON.stringify(entry));
  mutateActive((garden) => {
    garden.seedStock = toRaw(garden.seedStock).filter((item) => item.id !== id);
  });
  return copy;
}

export function addJournalEntry(entry) {
  mutateActive((garden) => {
    garden.journal = [...toRaw(garden.journal), JSON.parse(JSON.stringify(entry))];
  });
}

export function updateJournalEntry(id, fields) {
  mutateActive((garden) => {
    const entry = garden.journal.find((item) => item.id === id);
    if (entry) Object.assign(entry, JSON.parse(JSON.stringify(fields)));
  });
}

/** Deletes a journal entry (and the done state of its task). Returns its copy for undo. */
export function deleteJournalEntry(id) {
  const entry = gardens.active?.journal.find((item) => item.id === id);
  if (!entry) return null;
  const copy = JSON.parse(JSON.stringify(entry));
  mutateActive((garden) => {
    garden.journal = toRaw(garden.journal).filter((item) => item.id !== id);
    if (copy.taskKey) {
      const states = { ...toRaw(garden.taskStates) };
      // the sowing is no longer done: its seeds go back into the stock
      if (states[copy.taskKey]?.seeds?.length) garden.seedStock = returnSeeds(toRaw(garden.seedStock), states[copy.taskKey].seeds);
      delete states[copy.taskKey];
      garden.taskStates = states;
    }
  });
  return copy;
}

export function restoreJournalEntry(entry, today) {
  mutateActive((garden) => {
    garden.journal = [...toRaw(garden.journal), entry];
    if (entry.taskKey) garden.taskStates = { ...toRaw(garden.taskStates), [entry.taskKey]: { state: 'done', on: today } };
  });
}

/** Remembers an export (for the backup reminder) without counting as a change. */
export function markExported(ids) {
  const now = new Date().toISOString();
  for (const id of ids) {
    if (gardens.active?.id === id) {
      gardens.active.exportedAt = now;
      scheduleSave();
      continue;
    }
    try {
      const garden = storage.readGarden(id);
      garden.exportedAt = now;
      storage.writeGarden(garden);
    } catch (error) {
      console.error(error);
    }
  }
}

// --- Climate, custom plants and catalog overrides (no undo) ---------------

export function setClimate(climate) {
  mutateActive((garden) => {
    garden.climate = { hemisphere: climate.hemisphere, shiftWeeks: climate.shiftWeeks };
  });
}

/** Adds or replaces a custom plant. */
export function saveCustomPlant(plant) {
  mutateActive((garden) => {
    const plain = JSON.parse(JSON.stringify(plant));
    const index = garden.customPlants.findIndex((item) => item.id === plant.id);
    if (index === -1) garden.customPlants.push(plain);
    else garden.customPlants.splice(index, 1, plain);
  });
}

/** Number of plantings, trees, shrubs and seed stock entries that use a plant. */
export function plantUsage(plantId) {
  const garden = gardens.active;
  if (!garden) return 0;
  return garden.plantings.filter((planting) => planting.plantId === plantId).length +
    garden.elements.filter((element) => element.plantId === plantId).length +
    garden.seedStock.filter((entry) => entry.plantId === plantId).length;
}

export function deleteCustomPlant(id) {
  mutateActive((garden) => {
    garden.customPlants = toRaw(garden.customPlants).filter((plant) => plant.id !== id);
  });
}

/** Stores the user's changes to a built-in plant; null removes them. */
export function setOverride(plantId, override) {
  mutateActive((garden) => {
    const overrides = { ...toRaw(garden.plantOverrides) };
    if (override) overrides[plantId] = JSON.parse(JSON.stringify(override));
    else delete overrides[plantId];
    garden.plantOverrides = overrides;
  });
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
