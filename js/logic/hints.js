// Hint engine (docs/concept.md §6.1). Pure module.
//
// hintsFor(garden, catalog, { from, to }) projects plantings, trees and shrubs onto a
// date range and returns what is to do. Hints are never stored; only the user's
// decision per hint (task state) is, under the hint's deterministic key.
//
// Hint: { key, type, plantId, sourceId, sourceKind: 'planting' | 'element', bedId,
//         start, end, hint, everyWeeks }
// type: sow | plant | care | fertilize | prune | water | harvest
// hint: text id – a catalog care hint (careHints.<plant>.<hint>) or a general one
//       (sowIndoor, sowOutdoor, plantOut, harvest)

import { addDays, maxDate, minDate } from './dates.js';
import { windowInstances } from './climate.js';

export const TASK_TYPES = ['sow', 'plant', 'care', 'fertilize', 'prune', 'water', 'harvest'];
const SPAN_DAYS = 6; // a dated task (e.g. planting out) is shown for a week

function overlaps(start, end, from, to) {
  return end >= from && start <= to;
}

function hintKey(sourceId, type, hint, start) {
  return `${sourceId}|${type}|${hint}|${start}`;
}

/** A dated task for one source. */
function make(source, type, hint, start, end, extra = {}) {
  return {
    key: hintKey(source.id, type, hint, start),
    type,
    plantId: source.plantId,
    sourceId: source.id,
    sourceKind: source.kind,
    bedId: source.bedId ?? null,
    start,
    end,
    hint,
    everyWeeks: null,
    ...extra,
  };
}

/**
 * Care rules of a plant within [periodStart, periodEnd] (periodEnd may be null = open),
 * limited to the range. Repeating rules give one hint per repetition.
 */
function careHints(source, plant, climate, periodStart, periodEnd, from, to) {
  const hints = [];
  const lastDay = periodEnd ?? to;
  for (const rule of plant.care ?? []) {
    for (const window of windowInstances(rule.weeks, climate, maxDate(from, periodStart), minDate(to, lastDay))) {
      const start = maxDate(window.start, periodStart);
      const end = minDate(window.end, lastDay);
      if (start > end) continue;
      if (rule.everyWeeks) {
        for (let day = start; day <= end; day = addDays(day, rule.everyWeeks * 7)) {
          const spanEnd = minDate(addDays(day, SPAN_DAYS), end);
          if (overlaps(day, spanEnd, from, to)) hints.push(make(source, rule.type, rule.hint, day, spanEnd, { everyWeeks: rule.everyWeeks }));
        }
      } else if (overlaps(start, end, from, to)) {
        hints.push(make(source, rule.type, rule.hint, start, end));
      }
    }
  }
  return hints;
}

/** Catalog harvest windows from `since` on (perennials, trees, shrubs). */
function seasonalHarvests(source, plant, climate, since, from, to) {
  const hints = [];
  for (const window of plant.windows.harvest ?? []) {
    for (const dates of windowInstances(window, climate, maxDate(from, since), to)) {
      const start = maxDate(dates.start, since);
      if (start <= dates.end && overlaps(start, dates.end, from, to)) hints.push(make(source, 'harvest', 'harvest', start, dates.end));
    }
  }
  return hints;
}

/** Weeks between the first indoor sowing and the first planting out in the catalog. */
function indoorLeadWeeks(plant) {
  const sow = plant.windows.sowIndoor?.[0];
  const out = plant.windows.plantOut?.[0];
  return sow && out ? Math.max(1, out[0] - sow[0]) : 0;
}

function plantingHints(planting, plant, climate, from, to) {
  const source = { id: planting.id, kind: 'planting', plantId: planting.plantId, bedId: planting.bedId };
  const hints = [];

  // Indoor sowing before planting out
  const lead = indoorLeadWeeks(plant);
  if (lead) {
    const start = addDays(planting.start, -lead * 7);
    const end = addDays(start, 13);
    if (overlaps(start, end, from, to)) hints.push(make(source, 'sow', 'sowIndoor', start, end));
  }

  // Into the bed: planting out, or sowing directly
  const startEnd = addDays(planting.start, SPAN_DAYS);
  if (overlaps(planting.start, startEnd, from, to)) {
    const direct = !plant.windows.plantOut?.length;
    hints.push(make(source, direct ? 'sow' : 'plant', direct ? 'sowOutdoor' : 'plantOut', planting.start, startEnd));
  }

  hints.push(...careHints(source, plant, climate, planting.start, planting.end, from, to));

  // Harvest: the planting's own dates take precedence over the catalog
  if (planting.end !== null) {
    const harvestStart = maxDate(planting.start, addDays(planting.end, -(plant.harvestDays ?? 14) + 1));
    if (overlaps(harvestStart, planting.end, from, to)) hints.push(make(source, 'harvest', 'harvest', harvestStart, planting.end));
  } else {
    hints.push(...seasonalHarvests(source, plant, climate, planting.start, from, to));
  }
  return hints;
}

function elementHints(element, plant, climate, from, to) {
  const source = { id: element.id, kind: 'element', plantId: element.plantId, bedId: null };
  const since = element.plantedYear ? `${element.plantedYear}-01-01` : from;
  return [
    ...careHints(source, plant, climate, since, null, from, to),
    ...seasonalHarvests(source, plant, climate, since, from, to),
  ];
}

/**
 * All hints of a garden that overlap [from, to], sorted by start date.
 * @param catalog { get(id) } from js/logic/catalog.js
 */
export function hintsFor(garden, catalog, { from, to }) {
  const climate = garden.climate;
  const hints = [];
  for (const planting of garden.plantings) {
    if (planting.start > to || (planting.end !== null && planting.end < addDays(from, -120))) continue;
    hints.push(...plantingHints(planting, catalog.get(planting.plantId), climate, from, to));
  }
  for (const element of garden.elements) {
    if ((element.type === 'tree' || element.type === 'shrub') && element.plantId && catalog.has(element.plantId)) {
      hints.push(...elementHints(element, catalog.get(element.plantId), climate, from, to));
    }
  }
  return hints.sort((a, b) => a.start.localeCompare(b.start) || TASK_TYPES.indexOf(a.type) - TASK_TYPES.indexOf(b.type));
}

/** Hints active on one day. */
export function hintsOn(hints, day) {
  return hints.filter((hint) => hint.start <= day && day <= hint.end);
}

/**
 * Catalog plants for beds that can be sown or planted in [from, to]:
 * [{ plant, kinds: ['sowIndoor' | 'sowOutdoor' | 'plantOut'] }]
 */
export function suggestions(catalog, climate, { from, to }) {
  const result = [];
  for (const plant of catalog.all()) {
    if (plant.placement !== 'bed') continue;
    const kinds = ['sowIndoor', 'sowOutdoor', 'plantOut']
      .filter((kind) => (plant.windows[kind] ?? []).some((window) => windowInstances(window, climate, from, to).length > 0));
    if (kinds.length) result.push({ plant, kinds });
  }
  return result;
}

/** First date of a plant's planting-out or direct-sowing window in a year (for proposing a start). */
export function proposedStart(plant, climate, year) {
  const window = plant.windows.plantOut?.[0] ?? plant.windows.sowOutdoor?.[0];
  if (!window) return null;
  const instance = windowInstances(window, climate, `${year}-01-01`, `${year}-12-31`).find((dates) => dates.start.startsWith(String(year)));
  return instance?.start ?? null;
}
