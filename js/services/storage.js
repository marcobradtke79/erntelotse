// The only module that touches localStorage (docs/concept.md §4.1).
// createStorage takes any Storage-like backend so tests can use a memory backend.

import { migrateGarden, MigrationError } from '../logic/migrate.js';
import { validateGarden, validateIndex, validateSettings } from '../logic/validate.js';
import { gardenSummary } from '../logic/gardenModel.js';
import { ID_PATTERN } from '../logic/ids.js';

export const PREFIX = 'erntelotse:';
export const KEYS = {
  settings: `${PREFIX}settings`,
  gardens: `${PREFIX}gardens`,
  garden: (id) => `${PREFIX}garden:${id}`,
  weather: (id) => `${PREFIX}weather:${id}`,
};
const GARDEN_KEY_PREFIX = `${PREFIX}garden:`;

/** Rough capacity of localStorage per origin, for display only */
export const ESTIMATED_CAPACITY_BYTES = 5 * 1000 * 1000;

export class StorageQuotaError extends Error {
  constructor() {
    super('Storage quota exceeded');
    this.name = 'StorageQuotaError';
    this.code = 'quota';
  }
}

export class StorageReadError extends Error {
  /** code: corrupt | tooNew | invalid | missing */
  constructor(code, key, cause) {
    super(`Cannot read ${key}: ${code}`);
    this.name = 'StorageReadError';
    this.code = code;
    this.key = key;
    this.cause = cause;
  }
}

export function isQuotaError(error) {
  return Boolean(error) && (
    error.name === 'QuotaExceededError' ||
    error.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    error.code === 22 ||
    error.code === 1014
  );
}

/** In-memory Storage replacement: used in tests and when localStorage is unavailable. */
export function createMemoryBackend({ quotaBytes = Infinity } = {}) {
  const map = new Map();
  const size = () => {
    let total = 0;
    for (const [key, value] of map) total += (key.length + value.length) * 2;
    return total;
  };
  return {
    get length() {
      return map.size;
    },
    key(index) {
      return [...map.keys()][index] ?? null;
    },
    getItem(key) {
      return map.has(key) ? map.get(key) : null;
    },
    setItem(key, value) {
      const text = String(value);
      const previous = map.get(key);
      map.set(key, text);
      if (size() > quotaBytes) {
        if (previous === undefined) map.delete(key);
        else map.set(key, previous);
        const error = new Error('Quota exceeded');
        error.name = 'QuotaExceededError';
        throw error;
      }
    },
    removeItem(key) {
      map.delete(key);
    },
    clear() {
      map.clear();
    },
  };
}

/** Checks whether the browser lets us use localStorage (it throws in some private modes). */
export function localStorageAvailable() {
  try {
    const probe = `${PREFIX}probe`;
    globalThis.localStorage.setItem(probe, '1');
    globalThis.localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

export function createStorage(backend) {
  function keys() {
    const result = [];
    for (let i = 0; i < backend.length; i++) {
      const key = backend.key(i);
      if (key !== null && key.startsWith(PREFIX)) result.push(key);
    }
    return result;
  }

  function readRaw(key) {
    return backend.getItem(key);
  }

  function readJson(key) {
    const raw = readRaw(key);
    if (raw === null) return null;
    try {
      return JSON.parse(raw);
    } catch (error) {
      throw new StorageReadError('corrupt', key, error);
    }
  }

  function writeRaw(key, raw) {
    try {
      backend.setItem(key, raw);
    } catch (error) {
      if (isQuotaError(error)) throw new StorageQuotaError();
      throw error;
    }
  }

  function writeJson(key, value) {
    writeRaw(key, JSON.stringify(value));
  }

  function gardenIdsInStorage() {
    return keys()
      .filter((key) => key.startsWith(GARDEN_KEY_PREFIX))
      .map((key) => key.slice(GARDEN_KEY_PREFIX.length))
      .filter((id) => ID_PATTERN.test(id));
  }

  function parseGarden(key, value) {
    let garden;
    try {
      garden = migrateGarden(value);
    } catch (error) {
      if (error instanceof MigrationError && error.code === 'tooNew') throw new StorageReadError('tooNew', key, error);
      throw new StorageReadError('invalid', key, error);
    }
    if (validateGarden(garden).length > 0) throw new StorageReadError('invalid', key);
    return garden;
  }

  function readIndexRaw() {
    try {
      const index = readJson(KEYS.gardens);
      if (index !== null && validateIndex(index).length === 0) return index;
    } catch {
      // corrupt index: rebuilt below
    }
    return null;
  }

  function writeIndex(index) {
    writeJson(KEYS.gardens, index);
  }

  return {
    /** Settings object or null when missing or invalid (caller falls back to defaults). */
    readSettings() {
      try {
        const settings = readJson(KEYS.settings);
        if (settings && validateSettings(settings).length === 0) return settings;
      } catch {
        // fall through
      }
      return null;
    },

    writeSettings(settings) {
      writeJson(KEYS.settings, settings);
    },

    /**
     * Garden index [{ id, name, updatedAt }], reconciled with the garden keys:
     * entries without a document are dropped, documents missing from the index are added.
     */
    readIndex() {
      const stored = readIndexRaw() ?? [];
      const ids = new Set(gardenIdsInStorage());
      const index = stored.filter((entry) => ids.has(entry.id));
      const known = new Set(index.map((entry) => entry.id));
      let changed = index.length !== stored.length;
      for (const id of ids) {
        if (known.has(id)) continue;
        changed = true;
        let name = id;
        let updatedAt = null;
        try {
          const raw = readJson(KEYS.garden(id));
          if (raw && typeof raw.name === 'string') name = raw.name;
          if (raw && typeof raw.updatedAt === 'string') updatedAt = raw.updatedAt;
        } catch {
          // keep id as name; loading it later reports the problem
        }
        index.push({ id, name, updatedAt });
      }
      if (changed) {
        try {
          writeIndex(index);
        } catch {
          // index is derived data; a failed repair is not fatal
        }
      }
      return index;
    },

    /** Migrated and validated garden. Throws StorageReadError. */
    readGarden(id) {
      const key = KEYS.garden(id);
      const value = readJson(key);
      if (value === null) throw new StorageReadError('missing', key);
      return parseGarden(key, value);
    },

    /**
     * Writes the garden and its index entry. If the index cannot be written,
     * the previous garden value is restored, so both stay consistent.
     */
    writeGarden(garden) {
      const problems = validateGarden(garden);
      if (problems.length > 0) {
        throw new Error(`Refusing to store invalid garden: ${JSON.stringify(problems.slice(0, 3))}`);
      }
      const key = KEYS.garden(garden.id);
      const raw = JSON.stringify(garden);
      const previous = readRaw(key);
      writeRaw(key, raw);
      try {
        const index = readIndexRaw() ?? [];
        const summary = gardenSummary(garden);
        const position = index.findIndex((entry) => entry.id === garden.id);
        if (position === -1) index.push(summary);
        else index[position] = summary;
        writeIndex(index);
      } catch (error) {
        if (previous === null) backend.removeItem(key);
        else backend.setItem(key, previous);
        throw error;
      }
    },

    /** Cached forecast of a garden, or null (corrupt entries count as missing). */
    readWeather(id) {
      try {
        const value = readJson(KEYS.weather(id));
        return value && Array.isArray(value.days) && typeof value.fetchedAt === 'number' ? value : null;
      } catch {
        return null;
      }
    },

    writeWeather(id, value) {
      writeJson(KEYS.weather(id), value);
    },

    deleteGarden(id) {
      backend.removeItem(KEYS.garden(id));
      backend.removeItem(KEYS.weather(id));
      const index = (readIndexRaw() ?? []).filter((entry) => entry.id !== id);
      writeIndex(index);
    },

    /** Approximate bytes used by this app (UTF-16, as browsers count). */
    usage() {
      let total = 0;
      for (const key of keys()) total += (key.length + (readRaw(key) ?? '').length) * 2;
      return total;
    },

    /** Removes all keys of this app and nothing else. */
    clearAll() {
      for (const key of keys()) backend.removeItem(key);
    },

    /**
     * Replaces all gardens (and settings, if given) in one step, e.g. from a backup.
     * If any write fails, the previous state is restored and the error is rethrown.
     */
    replaceAll(gardens, settings) {
      for (const garden of gardens) {
        const problems = validateGarden(garden);
        if (problems.length > 0) throw new Error(`Refusing to store invalid garden ${garden?.id}`);
      }
      const snapshot = keys().map((key) => [key, readRaw(key)]);
      try {
        for (const key of keys()) backend.removeItem(key);
        for (const garden of gardens) writeJson(KEYS.garden(garden.id), garden);
        writeIndex(gardens.map(gardenSummary));
        if (settings) writeJson(KEYS.settings, settings);
      } catch (error) {
        for (const key of keys()) backend.removeItem(key);
        for (const [key, raw] of snapshot) backend.setItem(key, raw);
        throw error;
      }
    },
  };
}
