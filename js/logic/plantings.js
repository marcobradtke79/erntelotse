// Plantings: a plant in a bed for a period (docs/concept.md §4.3, §4.5). Pure module.
//
// shape: { kind: 'polygon', points } for an area, { kind: 'point', at } for one plant.
// start: ISO date. end: ISO date or null (perennial, still in place).
// preStart: ISO date before `start` from which the plants are pre-cultivated (raised
//           indoors or in pots), or null. That time is part of the plan but not of the
//           bed: the planting covers its place only from `start` on.
// count: number set by the user, or null = estimate from area and spacing.

import { newId, ID_PATTERN } from './ids.js';
import {
  polygonArea, roundPoints, polygonInsidePolygon, pointInOrOnPolygon, isConvex, clipPolygonConvex, applyRigid,
} from './geometry.js';
import { isIsoDate, yearOf, addDays, addYears, dayOfYear, daysInYear, toIsoDate } from './dates.js';

export const NOTE_MAX_LENGTH = 500;
export const MIN_AREA = 0.0025; // 5 cm × 5 cm

export function normaliseShape(shape) {
  if (shape.kind === 'point') return { kind: 'point', at: roundPoints([shape.at])[0] };
  return { kind: 'polygon', points: roundPoints(shape.points) };
}

export function createPlanting({ bedId, plantId, shape, start, end = null, preStart = null, count = null, note = '' }) {
  return { id: newId('p'), bedId, plantId, shape: normaliseShape(shape), start, end, preStart, count, note };
}

/** Weeks between the first indoor sowing and the first planting out in the catalog; 0 = none. */
export function indoorLeadWeeks(plant) {
  const sow = plant.windows?.sowIndoor?.[0];
  const out = plant.windows?.plantOut?.[0];
  return sow && out ? Math.max(1, out[0] - sow[0]) : 0;
}

/** Start of the pre-cultivation proposed for a planting that goes into the bed on `start`; null if the plant is not raised indoors. */
export function proposedPreStart(plant, start) {
  const lead = indoorLeadWeeks(plant);
  return lead ? addDays(start, -lead * 7) : null;
}

/** True while the plants are pre-cultivated on at least one day from `from` to `to` and not yet in the bed on `to`. */
export function isRaisedBetween(planting, from, to) {
  return Boolean(planting.preStart) && planting.preStart <= to && planting.start > to && planting.start > from;
}

/** End date proposed from the plant's growing time; null for perennials. */
export function defaultEnd(plant, start) {
  return plant.growDays ? addDays(start, plant.growDays) : null;
}

export function isActiveOn(planting, date) {
  return planting.start <= date && (planting.end === null || date <= planting.end);
}

export function touchesYear(planting, year) {
  return yearOf(planting.start) <= year && (planting.end === null || yearOf(planting.end) >= year);
}

/** 'planned' | 'raising' (being pre-cultivated) | 'active' | 'past', derived from today's date */
export function plantingStatus(planting, today) {
  if (planting.start > today) return planting.preStart && planting.preStart <= today ? 'raising' : 'planned';
  if (planting.end !== null && planting.end < today) return 'past';
  return 'active';
}

/** In the bed on at least one day from `from` to `to`. */
export function isActiveBetween(planting, from, to) {
  return planting.start <= to && (planting.end === null || planting.end >= from);
}

/**
 * Plantings to show: in the `days` days from `day` on (a week on the timeline, one day
 * by default), or during the whole `year` when `day` is null.
 */
export function visiblePlantings(plantings, { year, day, days = 1 }) {
  if (!day) return plantings.filter((planting) => touchesYear(planting, year));
  const last = addDays(day, days - 1);
  return plantings.filter((planting) => isActiveBetween(planting, day, last));
}

/** How many plantings are in the ground in each week; `mondays` are the weeks' first days. */
export function weekCounts(plantings, mondays) {
  return mondays.map((monday) => {
    const sunday = addDays(monday, 6);
    return plantings.filter((planting) => isActiveBetween(planting, monday, sunday)).length;
  });
}

/**
 * Which plants the garden uses: plantId → { current, planned, elements, usedThisYear, firstPlanned }.
 * current:  plantings of this year that have begun (pre-cultivation counts as begun)
 * planned:  plantings that go into the bed after today, by start date
 * elements: trees and shrubs with this plant (they count as used this year)
 */
export function plantUse(garden, today) {
  const year = yearOf(today);
  const map = new Map();
  const of = (plantId) => {
    if (!map.has(plantId)) map.set(plantId, { current: [], planned: [], elements: [], usedThisYear: false, firstPlanned: null });
    return map.get(plantId);
  };
  for (const planting of garden.plantings) {
    const use = of(planting.plantId);
    if (planting.start > today) use.planned.push(planting);
    if ((planting.preStart ?? planting.start) <= today && touchesYear({ ...planting, start: planting.preStart ?? planting.start }, year)) use.current.push(planting);
  }
  for (const element of garden.elements) {
    if ((element.type === 'tree' || element.type === 'shrub') && element.plantId) of(element.plantId).elements.push(element);
  }
  for (const use of map.values()) {
    use.current.sort((a, b) => a.start.localeCompare(b.start));
    use.planned.sort((a, b) => a.start.localeCompare(b.start));
    use.usedThisYear = use.current.length > 0 || use.elements.length > 0;
    use.firstPlanned = use.planned[0]?.start ?? null;
  }
  return map;
}

export function plantingsOfBed(plantings, bedId) {
  return plantings.filter((planting) => planting.bedId === bedId);
}

/** Years a planting touches; open-ended plantings run until `untilYear`. */
export function yearsOf(planting, untilYear) {
  const first = yearOf(planting.start);
  const last = planting.end === null ? Math.max(first, untilYear) : yearOf(planting.end);
  const years = [];
  for (let year = first; year <= last; year++) years.push(year);
  return years;
}

/** History of a bed: [{ year, plantings }], newest year first, plantings by start date. */
export function historyByYear(plantings, bedId, untilYear) {
  const years = new Map();
  for (const planting of plantingsOfBed(plantings, bedId)) {
    for (const year of yearsOf(planting, untilYear)) {
      if (!years.has(year)) years.set(year, []);
      years.get(year).push(planting);
    }
  }
  return [...years.entries()]
    .sort(([a], [b]) => b - a)
    .map(([year, list]) => ({ year, plantings: list.sort((a, b) => a.start.localeCompare(b.start)) }));
}

/** Checks a period entered by the user. Returns null or 'date' | 'endBeforeStart' | 'preAfterStart'. */
export function periodError(start, end, preStart = null) {
  if (!isIsoDate(start) || (end !== null && !isIsoDate(end)) || (preStart !== null && !isIsoDate(preStart))) return 'date';
  if (end !== null && end < start) return 'endBeforeStart';
  if (preStart !== null && preStart >= start) return 'preAfterStart';
  return null;
}

/**
 * Bars for the timeline of one year: every planting that touches `year`, by start date.
 * `from` and `to` are fractions of the year (0 = 1 January, 1 = end of 31 December),
 * clipped to the year; `startsBefore` / `endsAfter` tell that the period goes on outside.
 */
export function timelineBars(plantings, year) {
  const days = daysInYear(year);
  const first = toIsoDate(year, 1, 1);
  const last = toIsoDate(year, 12, 31);
  return plantings
    .filter((planting) => touchesYear(planting, year))
    .sort((a, b) => a.start.localeCompare(b.start))
    .map((planting) => {
      const startsBefore = planting.start < first;
      const endsAfter = planting.end === null || planting.end > last;
      // Pre-cultivation: the stretch before the bar, as far as it lies in the year
      const preFrom = planting.preStart && !startsBefore
        ? (planting.preStart < first ? 0 : (dayOfYear(planting.preStart) - 1) / days)
        : null;
      return {
        id: planting.id,
        preFrom,
        from: startsBefore ? 0 : (dayOfYear(planting.start) - 1) / days,
        to: endsAfter ? 1 : dayOfYear(planting.end) / days,
        startsBefore,
        endsAfter,
      };
    });
}

export function shapeArea(shape) {
  return shape.kind === 'polygon' ? polygonArea(shape.points) : 0;
}

/**
 * Largest area (m²) that the plantings cover at the same time between `start` and `end`
 * (end null = open). Single plants count with their spacing (`spacingOf(plantId)` →
 * { row, plant } or null). Pre-cultivation covers nothing.
 */
export function occupiedArea(plantings, { start, end }, spacingOf = () => null) {
  const inPeriod = plantings.filter((planting) => planting.start <= (end ?? planting.start) && (planting.end === null || planting.end >= start));
  const areaOf = (planting) => {
    if (planting.shape.kind === 'polygon') return shapeArea(planting.shape);
    const spacing = spacingOf(planting.plantId);
    return spacing ? spacing.row * spacing.plant : 0;
  };
  // the covered area only grows on a day a planting starts
  const days = [start, ...inPeriod.map((planting) => planting.start).filter((day) => day > start)];
  let peak = 0;
  for (const day of days) {
    const sum = inPeriod.filter((planting) => isActiveOn(planting, day)).reduce((total, planting) => total + areaOf(planting), 0);
    peak = Math.max(peak, sum);
  }
  return peak;
}

/** Area (m²) of a bed that stays free during the whole period, never below 0. */
export function freeArea(bedArea, plantings, period, spacingOf) {
  return Math.max(0, Math.round((bedArea - occupiedArea(plantings, period, spacingOf)) * 100) / 100);
}

/** Plants that fit an area with the plant's row and in-row spacing. */
export function estimateCount(shape, spacing) {
  if (shape.kind === 'point') return 1;
  const perPlant = spacing.row * spacing.plant;
  return Math.max(1, Math.floor(shapeArea(shape) / perPlant + 1e-9));
}

export function plantCount(planting, plant) {
  return planting.count ?? estimateCount(planting.shape, plant.spacing);
}

/** Copies plantings into a later year with new ids. Open-ended plantings need no copy. */
export function copyForward(planting, years = 1) {
  return {
    // JSON, not structuredClone: callers may pass Vue proxies, which structuredClone rejects
    ...JSON.parse(JSON.stringify(planting)),
    id: newId('p'),
    start: addYears(planting.start, years),
    preStart: planting.preStart ? addYears(planting.preStart, years) : null,
    end: planting.end === null ? null : addYears(planting.end, years),
  };
}

export function canCopyForward(planting) {
  return planting.end !== null;
}

/**
 * Keeps a new or changed shape inside its bed.
 * Areas that stick out of a convex bed are clipped to it; otherwise the shape must
 * lie inside. Returns { shape } or { error: 'outside' | 'tooSmall' }.
 */
export function fitShapeToBed(shape, bedPoints) {
  if (shape.kind === 'point') {
    return pointInOrOnPolygon(shape.at, bedPoints) ? { shape } : { error: 'outside' };
  }
  if (polygonInsidePolygon(shape.points, bedPoints)) return { shape };
  if (!isConvex(bedPoints)) return { error: 'outside' };
  const clipped = clipPolygonConvex(shape.points, bedPoints);
  if (clipped.length < 3 || polygonArea(clipped) < MIN_AREA) return { error: clipped.length ? 'tooSmall' : 'outside' };
  return { shape: normaliseShape({ kind: 'polygon', points: clipped }) };
}

/** Applies a bed's move/rotation to its plantings. */
export function moveShape(shape, transform) {
  if (shape.kind === 'point') return normaliseShape({ kind: 'point', at: applyRigid([shape.at], transform)[0] });
  return normaliseShape({ kind: 'polygon', points: applyRigid(shape.points, transform) });
}

const isNumber = (value) => typeof value === 'number' && Number.isFinite(value);
const isPoint = (value) => Array.isArray(value) && value.length === 2 && isNumber(value[0]) && isNumber(value[1]);

/** Structural check of one planting. Returns problem codes. */
export function validatePlanting(planting) {
  const problems = [];
  if (typeof planting.bedId !== 'string' || !ID_PATTERN.test(planting.bedId)) problems.push('bedId');
  if (typeof planting.plantId !== 'string' || planting.plantId === '') problems.push('plantId');
  const shape = planting.shape;
  if (!shape || (shape.kind !== 'polygon' && shape.kind !== 'point')) problems.push('shape');
  else if (shape.kind === 'polygon' && (!Array.isArray(shape.points) || shape.points.length < 3 || !shape.points.every(isPoint))) problems.push('shape');
  else if (shape.kind === 'point' && !isPoint(shape.at)) problems.push('shape');
  if (!isIsoDate(planting.start)) problems.push('start');
  if (planting.end !== null && (!isIsoDate(planting.end) || (isIsoDate(planting.start) && planting.end < planting.start))) problems.push('end');
  const pre = planting.preStart;
  if (pre !== null && (!isIsoDate(pre) || (isIsoDate(planting.start) && pre >= planting.start))) problems.push('preStart');
  if (planting.count !== null && (!Number.isInteger(planting.count) || planting.count < 0)) problems.push('count');
  if (typeof planting.note !== 'string' || planting.note.length > NOTE_MAX_LENGTH) problems.push('note');
  return problems;
}
