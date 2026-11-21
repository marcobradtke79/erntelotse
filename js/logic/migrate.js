// Schema migrations for garden documents (docs/concept.md §4.1).
// A migration for version n takes a document of version n and returns version n + 1.
// Pure module.

export const CURRENT_SCHEMA_VERSION = 1;

/** @type {Record<number, (doc: object) => object>} */
export const MIGRATIONS = {
  // 1: (doc) => ({ ...doc, newField: [] }),
};

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
