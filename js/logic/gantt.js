// Plan as a Gantt chart (calendar → Season and Year): rows by bed, then planting; trees
// and shrubs in their own group. The shown span is a range { from, to } of ISO dates. Pure module: it only arranges plantings and derived hints.
//
// group: { id, kind: 'bed' | 'trees', bedId, rows }
// row:   { id, sourceKind: 'planting' | 'element', plantId, bedId, start,
//          phases: [{ kind: 'pre' | 'grow' | 'harvest', start, end }],   clipped to the range
//          activities: [hint] }                                          hints of hintsFor()

import { TASK_TYPES } from './hints.js';
import { addDays, daysBetween, maxDate, minDate, toIsoDate, mondayOf, yearOf } from './dates.js';
import { isoWeekOf } from './climate.js';

export function yearRange(year) {
  return { from: toIsoDate(year, 1, 1), to: toIsoDate(year, 12, 31) };
}

/** A season on the calendar: `weeks` whole weeks from the Monday of `date`'s week on. */
export function seasonRange(date, weeks = 13) {
  const from = mondayOf(date);
  return { from, to: addDays(from, weeks * 7 - 1) };
}

/** The weeks that touch the range: [{ monday, week, year }] (ISO week numbers). */
export function weekColumns(range) {
  const columns = [];
  for (let monday = mondayOf(range.from); monday <= range.to; monday = addDays(monday, 7)) {
    columns.push({ monday, ...isoWeekOf(monday) });
  }
  return columns;
}

/** The months that touch the range, each clipped to it: [{ year, month, from, to }]. */
export function monthSpans(range) {
  const spans = [];
  let year = yearOf(range.from);
  let month = Number(range.from.slice(5, 7));
  for (;;) {
    const first = toIsoDate(year, month, 1);
    if (first > range.to) break;
    spans.push({ year, month, from: maxDate(first, range.from), to: minDate(toIsoDate(year, month + 1, 0), range.to) });
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return spans;
}

/** Three months around `month` (1–12) for a closer look, kept inside the year. */
export function monthRange(year, month) {
  const first = Math.max(1, Math.min(10, month - 1));
  return { from: toIsoDate(year, first, 1), to: toIsoDate(year, first + 3, 0) };
}

/**
 * Where [start, end] lies in the range, in percent of its width; null when outside.
 * `cutStart` / `cutEnd` tell that the period goes on outside the range.
 */
export function position(start, end, range) {
  if (end < range.from || start > range.to) return null;
  const from = maxDate(start, range.from);
  const to = minDate(end, range.to);
  const total = daysBetween(range.from, range.to) + 1;
  return {
    left: (daysBetween(range.from, from) / total) * 100,
    width: ((daysBetween(from, to) + 1) / total) * 100,
    cutStart: start < range.from,
    cutEnd: end > range.to,
  };
}

function clip(kind, start, end, range) {
  if (end < range.from || start > range.to) return null;
  return { kind, start: maxDate(start, range.from), end: minDate(end, range.to) };
}

const byName = (a, b) => (a.name || '').localeCompare(b.name || '', undefined, { numeric: true }) || a.id.localeCompare(b.id);

/**
 * @param hints   hintsFor(garden, catalog, range)
 * @param catalog { has(id) }
 * @param range   { from, to }: a year (yearRange) or a season (seasonRange)
 * @param bedId   only this bed's group (and no trees and shrubs)
 */
export function ganttGroups(garden, catalog, hints, range, { bedId = null } = {}) {
  const bySource = new Map();
  for (const hint of hints) {
    if (!bySource.has(hint.sourceId)) bySource.set(hint.sourceId, []);
    bySource.get(hint.sourceId).push(hint);
  }
  const harvests = (activities) => activities
    .filter((hint) => hint.type === 'harvest')
    .map((hint) => clip('harvest', hint.start, hint.end, range))
    .filter(Boolean);

  const groups = [];
  for (const bed of garden.elements.filter((element) => element.type === 'bed' && (!bedId || element.id === bedId)).sort(byName)) {
    const rows = [];
    const plantings = garden.plantings
      .filter((planting) => planting.bedId === bed.id)
      .sort((a, b) => a.start.localeCompare(b.start) || a.id.localeCompare(b.id));
    for (const planting of plantings) {
      const activities = bySource.get(planting.id) ?? [];
      const phases = [
        planting.preStart ? clip('pre', planting.preStart, addDays(planting.start, -1), range) : null,
        clip('grow', planting.start, planting.end ?? range.to, range),
        ...harvests(activities),
      ].filter(Boolean);
      if (!phases.length) continue; // nothing of this planting lies in the range
      rows.push({ id: planting.id, sourceKind: 'planting', plantId: planting.plantId, bedId: bed.id, start: planting.start, phases, activities });
    }
    if (rows.length) groups.push({ id: bed.id, kind: 'bed', bedId: bed.id, rows });
  }

  if (bedId) return groups;

  const trees = garden.elements
    .filter((element) => (element.type === 'tree' || element.type === 'shrub') && element.plantId && catalog.has(element.plantId))
    .sort(byName)
    .map((element) => {
      const activities = bySource.get(element.id) ?? [];
      return { id: element.id, sourceKind: 'element', plantId: element.plantId, bedId: null, start: null, phases: harvests(activities), activities };
    });
  if (trees.length) groups.push({ id: 'trees', kind: 'trees', bedId: null, rows: trees });
  return groups;
}

/** Activities of a row by type, in the usual order; only the enabled types that occur. */
export function lanes(row, enabledTypes = TASK_TYPES) {
  return TASK_TYPES
    .filter((type) => enabledTypes.includes(type))
    .map((type) => ({ type, items: row.activities.filter((hint) => hint.type === type) }))
    .filter((lane) => lane.items.length > 0);
}
