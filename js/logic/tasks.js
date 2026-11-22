// Task states and the garden journal (docs/concept.md §4.3, §6.1). Pure module.
//
// taskStates[hint.key] = { state: 'done' | 'skipped', on: ISO date }
// journal entry: { id, date, type, plantId, sourceId, sourceKind, taskKey, amountKg, note }

import { newId, ID_PATTERN } from './ids.js';
import { addDays, isIsoDate, yearOf } from './dates.js';

export const JOURNAL_TYPES = ['sow', 'plant', 'care', 'fertilize', 'prune', 'water', 'harvest', 'note'];
export const OVERDUE_DAYS = 30;
export const NOTE_MAX_LENGTH = 500;

export function stateOf(hint, taskStates) {
  return taskStates?.[hint.key]?.state ?? 'open';
}

/** Open hints whose time has passed, but not longer ago than OVERDUE_DAYS. */
export function overdueHints(hints, taskStates, today) {
  const oldest = addDays(today, -OVERDUE_DAYS);
  return hints.filter((hint) => hint.end < today && hint.end >= oldest && stateOf(hint, taskStates) === 'open');
}

/** Journal entry for a task marked done. */
export function journalEntryForHint(hint, date) {
  return {
    id: newId('j'),
    date,
    type: hint.type,
    plantId: hint.plantId,
    sourceId: hint.sourceId,
    sourceKind: hint.sourceKind,
    taskKey: hint.key,
    amountKg: null,
    note: '',
  };
}

export function createJournalEntry({ date, type, plantId = null, sourceId = null, sourceKind = null, amountKg = null, note = '' }) {
  return { id: newId('j'), date, type, plantId, sourceId, sourceKind, taskKey: null, amountKg, note };
}

/** Harvest totals of a year: [{ plantId, kg, entries }] sorted by weight. */
export function harvestTotals(journal, year) {
  const totals = new Map();
  for (const entry of journal) {
    if (entry.type !== 'harvest' || yearOf(entry.date) !== year || !entry.plantId) continue;
    const total = totals.get(entry.plantId) ?? { plantId: entry.plantId, kg: 0, entries: 0 };
    total.kg += entry.amountKg ?? 0;
    total.entries += 1;
    totals.set(entry.plantId, total);
  }
  return [...totals.values()].sort((a, b) => b.kg - a.kg);
}

/** Journal filtered by year and optional type, plant and place; newest first. */
export function filterJournal(journal, { year = null, type = null, plantId = null, sourceId = null, bedOf = () => null } = {}) {
  return journal
    .filter((entry) => (year === null || yearOf(entry.date) === year) &&
      (!type || entry.type === type) &&
      (!plantId || entry.plantId === plantId) &&
      (!sourceId || entry.sourceId === sourceId || bedOf(entry) === sourceId))
    .sort((a, b) => b.date.localeCompare(a.date));
}

/** Structural check of a journal entry. Returns problem codes. */
export function validateJournalEntry(entry) {
  const problems = [];
  if (!isIsoDate(entry.date)) problems.push('date');
  if (!JOURNAL_TYPES.includes(entry.type)) problems.push('type');
  if (entry.plantId !== null && entry.plantId !== undefined && (typeof entry.plantId !== 'string' || entry.plantId === '')) problems.push('plantId');
  if (entry.sourceId !== null && entry.sourceId !== undefined && (typeof entry.sourceId !== 'string' || !ID_PATTERN.test(entry.sourceId))) problems.push('sourceId');
  if (entry.amountKg !== null && entry.amountKg !== undefined && (typeof entry.amountKg !== 'number' || !Number.isFinite(entry.amountKg) || entry.amountKg < 0)) problems.push('amountKg');
  if (entry.note !== undefined && (typeof entry.note !== 'string' || entry.note.length > NOTE_MAX_LENGTH)) problems.push('note');
  return problems;
}

/** Structural check of the task states object. Returns the keys with problems. */
export function validateTaskStates(taskStates) {
  return Object.entries(taskStates)
    .filter(([, value]) => !value || !['done', 'skipped'].includes(value.state) || !isIsoDate(value.on))
    .map(([key]) => key);
}
