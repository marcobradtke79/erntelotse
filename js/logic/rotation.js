// Crop rotation and companion planting (docs/concept.md §6.3, §6.4). Pure module.

import { polygonDistance, pointPolygonDistance, distance } from './geometry.js';
import { yearOf } from './dates.js';

/** Distance in metres between two planting shapes (0 = overlapping). */
export function shapeDistance(a, b) {
  if (a.kind === 'polygon' && b.kind === 'polygon') return polygonDistance(a.points, b.points);
  if (a.kind === 'point' && b.kind === 'point') return distance(a.at, b.at);
  const [point, polygon] = a.kind === 'point' ? [a.at, b.points] : [b.at, a.points];
  return pointPolygonDistance(point, polygon);
}

const SAME_SPOT = 0.05; // shapes closer than 5 cm share soil

function periodsOverlap(a, b) {
  const aEnd = a.end ?? '9999-12-31';
  const bEnd = b.end ?? '9999-12-31';
  return a.start <= bEnd && b.start <= aEnd;
}

/**
 * Rotation check for a planting (or a candidate { bedId, plantId, start, shape? })
 * against earlier plantings on the same soil. Without a shape the whole bed counts.
 *
 * Returns { level: 'warning' | 'note' | 'good' | null, issues: [...] }
 * issue: { kind: 'sameFamily', plantId, year, until } – same family within the rotation gap
 *        { kind: 'heavyAfterHeavy', plantId, year }  – heavy feeder after heavy feeder
 *        { kind: 'afterLegumes', plantId, year }     – after nitrogen-fixing legumes
 *        { kind: 'goodSequence', plantId, year }     – lighter feeder after a heavy one
 */
export function rotationCheck(candidate, plantings, catalog) {
  const plant = catalog.get(candidate.plantId);
  const year = yearOf(candidate.start);
  const earlier = plantings
    .filter((other) => other.id !== candidate.id && other.bedId === candidate.bedId)
    .filter((other) => other.end !== null && other.end < candidate.start)
    .filter((other) => !candidate.shape || shapeDistance(candidate.shape, other.shape) < SAME_SPOT)
    .sort((a, b) => b.end.localeCompare(a.end));

  const issues = [];
  const gap = plant.rotationGapYears ?? 0;
  if (plant.family && gap > 0 && plant.lifecycle !== 'perennial') {
    const conflict = earlier.find((other) => {
      const otherPlant = catalog.get(other.plantId);
      return otherPlant.family === plant.family && year - yearOf(other.end) < gap;
    });
    if (conflict) issues.push({ kind: 'sameFamily', plantId: conflict.plantId, year: yearOf(conflict.end), until: yearOf(conflict.end) + gap, family: plant.family });
  }

  // The crop directly before (ended within the last year)
  const previous = earlier.find((other) => year - yearOf(other.end) <= 1);
  if (previous) {
    const before = catalog.get(previous.plantId);
    const entry = { plantId: previous.plantId, year: yearOf(previous.end) };
    if (before.feeder === 'heavy' && plant.feeder === 'heavy') issues.push({ kind: 'heavyAfterHeavy', ...entry });
    else if (before.feeder === 'fixer' && plant.feeder !== 'fixer') issues.push({ kind: 'afterLegumes', ...entry });
    else if (before.feeder === 'heavy' && (plant.feeder === 'medium' || plant.feeder === 'light')) issues.push({ kind: 'goodSequence', ...entry });
  }

  const level = issues.some((issue) => issue.kind === 'sameFamily') ? 'warning'
    : issues.some((issue) => issue.kind === 'heavyAfterHeavy') ? 'note'
      : issues.length ? 'good' : null;
  return { level, issues };
}

export const NEIGHBOUR_DISTANCE = 1; // metres

/**
 * Good and bad neighbours of a planting: plantings in the same bed that overlap in
 * time and lie within NEIGHBOUR_DISTANCE. Returns [{ id, plantId, relation }].
 */
export function neighbourRelations(planting, plantings, catalog) {
  const plant = catalog.get(planting.plantId);
  const relations = [];
  for (const other of plantings) {
    if (other.id === planting.id || other.bedId !== planting.bedId || !periodsOverlap(planting, other)) continue;
    const relation = plant.companions.good.includes(other.plantId) ? 'good'
      : plant.companions.bad.includes(other.plantId) ? 'bad' : null;
    if (!relation) continue;
    if (planting.shape && other.shape && shapeDistance(planting.shape, other.shape) > NEIGHBOUR_DISTANCE) continue;
    relations.push({ id: other.id, plantId: other.plantId, relation });
  }
  return relations;
}

/** Badges for a planting: ['good'] / ['bad'] / ['rotation'] combined, for map and lists. */
export function plantingBadges(planting, plantings, catalog) {
  const badges = [];
  const rotation = rotationCheck(planting, plantings, catalog);
  if (rotation.level === 'warning') badges.push('rotation');
  const relations = neighbourRelations(planting, plantings, catalog);
  if (relations.some((relation) => relation.relation === 'bad')) badges.push('bad');
  if (relations.some((relation) => relation.relation === 'good')) badges.push('good');
  return badges;
}

/**
 * Advice for choosing a plant for a bed (picker): plantId → 'good' | 'bad' | 'rotation'.
 * Neighbours: plantings in the bed active in [start, end]; rotation: whole bed.
 */
export function pickerAdvice(bedId, period, plantings, catalog) {
  const active = plantings.filter((other) => other.bedId === bedId && periodsOverlap(period, other));
  const advice = {};
  for (const plant of catalog.all()) {
    if (plant.placement !== 'bed') continue;
    const rotation = rotationCheck({ bedId, plantId: plant.id, start: period.start }, plantings, catalog);
    if (rotation.level === 'warning') advice[plant.id] = 'rotation';
    else if (active.some((other) => plant.companions.bad.includes(other.plantId))) advice[plant.id] = 'bad';
    else if (active.some((other) => plant.companions.good.includes(other.plantId))) advice[plant.id] = 'good';
  }
  return advice;
}
