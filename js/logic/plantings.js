// Plantings: a plant in a bed for a period (docs/concept.md §4.3, §4.5). Pure module.
//
// shape: { kind: 'polygon', points } for an area, { kind: 'point', at } for one plant.
// start: ISO date. end: ISO date or null (perennial, still in place).
// count: number set by the user, or null = estimate from area and spacing.

import { newId, ID_PATTERN } from './ids.js';
import {
  polygonArea, roundPoints, polygonInsidePolygon, pointInOrOnPolygon, isConvex, clipPolygonConvex, applyRigid,
} from './geometry.js';
import { isIsoDate, yearOf, addDays, addYears } from './dates.js';

export const NOTE_MAX_LENGTH = 500;
export const MIN_AREA = 0.0025; // 5 cm × 5 cm

export function normaliseShape(shape) {
  if (shape.kind === 'point') return { kind: 'point', at: roundPoints([shape.at])[0] };
  return { kind: 'polygon', points: roundPoints(shape.points) };
}

export function createPlanting({ bedId, plantId, shape, start, end = null, count = null, note = '' }) {
  return { id: newId('p'), bedId, plantId, shape: normaliseShape(shape), start, end, count, note };
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

/** 'planned' | 'active' | 'past', derived from today's date */
export function plantingStatus(planting, today) {
  if (planting.start > today) return 'planned';
  if (planting.end !== null && planting.end < today) return 'past';
  return 'active';
}

/**
 * Plantings to show: on one day (`day` set) or during the whole `year` (`day` null).
 */
export function visiblePlantings(plantings, { year, day }) {
  return plantings.filter((planting) => (day ? isActiveOn(planting, day) : touchesYear(planting, year)));
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

export function shapeArea(shape) {
  return shape.kind === 'polygon' ? polygonArea(shape.points) : 0;
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
  if (planting.count !== null && (!Number.isInteger(planting.count) || planting.count < 0)) problems.push('count');
  if (typeof planting.note !== 'string' || planting.note.length > NOTE_MAX_LENGTH) problems.push('note');
  return problems;
}
