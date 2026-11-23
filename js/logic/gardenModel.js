// Creation of garden documents (docs/concept.md §4.2). Pure module.

import { newId } from './ids.js';
import { CURRENT_SCHEMA_VERSION } from './migrate.js';

export const GARDEN_NAME_MAX_LENGTH = 80;

export const DEFAULT_CLIMATE = Object.freeze({ hemisphere: 'north', shiftWeeks: 0 });

/** Returns an error code for an invalid name, or null. */
export function checkGardenName(name) {
  const trimmed = typeof name === 'string' ? name.trim() : '';
  if (trimmed === '') return 'required';
  if (trimmed.length > GARDEN_NAME_MAX_LENGTH) return 'tooLong';
  return null;
}

export function createGarden({ name, now = new Date(), id = newId('g') }) {
  const timestamp = now.toISOString();
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    id,
    name: name.trim(),
    createdAt: timestamp,
    updatedAt: timestamp,
    location: null,
    climate: { ...DEFAULT_CLIMATE },
    elements: [],
    plantings: [],
    customPlants: [],
    plantOverrides: {},
    taskStates: {},
    journal: [],
    seedStock: [],
  };
}

/** Deep copy with a new id and name. Ids inside the garden stay, they are scoped to the garden. */
export function duplicateGarden(garden, { name, now = new Date(), id = newId('g') }) {
  // JSON, not structuredClone: callers may pass Vue proxies, which structuredClone rejects
  const copy = JSON.parse(JSON.stringify(garden));
  const timestamp = now.toISOString();
  copy.id = id;
  copy.name = name.trim().slice(0, GARDEN_NAME_MAX_LENGTH);
  copy.createdAt = timestamp;
  copy.updatedAt = timestamp;
  return copy;
}

/** Entry of the garden index */
export function gardenSummary(garden) {
  return { id: garden.id, name: garden.name, updatedAt: garden.updatedAt };
}
