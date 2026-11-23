// Schema migrations for garden documents (docs/concept.md §4.1).
// A migration for version n takes a document of version n and returns version n + 1.
// Pure module.

import { PLANTS } from '../data/plants.js';
import { buildCatalog } from './catalog.js';
import { proposedPreStart } from './plantings.js';

export const CURRENT_SCHEMA_VERSION = 3;

/** @type {Record<number, (doc: object) => object>} */
export const MIGRATIONS = {
  // 1 → 2: plantings store their pre-cultivation (`preStart`). Until now every plant with
  // an indoor sowing window was assumed to be raised indoors, so those plantings keep
  // that date (and with it their "sow indoors" task); all others get null.
  1: (doc) => {
    if (!Array.isArray(doc.plantings)) return doc;
    let catalog = null;
    try {
      catalog = buildCatalog(PLANTS, doc.plantOverrides, doc.customPlants);
    } catch {
      catalog = null; // a broken document is reported by validation, not here
    }
    for (const planting of doc.plantings) {
      if (!planting || typeof planting !== 'object' || 'preStart' in planting) continue;
      const plant = catalog?.has(planting.plantId) ? catalog.get(planting.plantId) : null;
      planting.preStart = plant && typeof planting.start === 'string' ? safePreStart(plant, planting.start) : null;
    }
    return doc;
  },
  // 2 → 3: the garden has a seed stock
  2: (doc) => {
    if (!Array.isArray(doc.seedStock)) doc.seedStock = [];
    return doc;
  },
};

function safePreStart(plant, start) {
  try {
    return proposedPreStart(plant, start);
  } catch {
    return null;
  }
}

export class MigrationError extends Error {
  constructor(code, details = {}) {
    super(`Migration failed: ${code}`);
    this.name = 'MigrationError';
    this.code = code; // notAnObject | missingVersion | tooNew | missingStep
    this.details = details;
  }
}

/**
 * Brings a garden document to the current schema version.
 * Never modifies the input; returns the input itself when it is already current.
 */
export function migrateGarden(doc, { migrations = MIGRATIONS, current = CURRENT_SCHEMA_VERSION } = {}) {
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) {
    throw new MigrationError('notAnObject');
  }
  const version = doc.schemaVersion;
  if (!Number.isInteger(version) || version < 1) {
    throw new MigrationError('missingVersion');
  }
  if (version > current) {
    throw new MigrationError('tooNew', { version, current });
  }
  let result = doc;
  for (let v = version; v < current; v++) {
    const step = migrations[v];
    if (typeof step !== 'function') throw new MigrationError('missingStep', { version: v });
    result = step(structuredClone(result));
    result.schemaVersion = v + 1;
  }
  return result;
}
