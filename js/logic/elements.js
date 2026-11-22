// Garden elements: parcel, beds, trees, shrubs and other objects (docs/concept.md §4.3).
// Pure module.

import { newId } from './ids.js';
import {
  polygonArea, perimeter, edgeLengths, polylineLength, asRectangle, centroid, bounds,
  rectangle, roundPoints, roundValue, selfIntersects,
} from './geometry.js';

/**
 * kind: geometry kind. draw: default drawing mode for polygon types.
 * single: at most one per garden. diameter/width: default sizes in metres.
 */
export const ELEMENT_TYPES = {
  parcel: { kind: 'polygon', draw: 'polygon', single: true },
  bed: { kind: 'polygon', draw: 'rectangle' },
  tree: { kind: 'circle', diameter: 4 },
  shrub: { kind: 'circle', diameter: 1.5 },
  building: { kind: 'polygon', draw: 'rectangle' },
  greenhouse: { kind: 'polygon', draw: 'rectangle' },
  compost: { kind: 'polygon', draw: 'rectangle' },
  pond: { kind: 'polygon', draw: 'polygon' },
  lawn: { kind: 'polygon', draw: 'polygon' },
  path: { kind: 'line', width: 0.8 },
  fence: { kind: 'line', width: 0.1 },
  hedge: { kind: 'line', width: 0.8 },
};

export const TYPE_NAMES = Object.keys(ELEMENT_TYPES);

/** Order in which types are drawn (later = on top) and listed. */
export const DRAW_ORDER = ['parcel', 'lawn', 'path', 'pond', 'bed', 'compost', 'greenhouse', 'building', 'fence', 'hedge', 'shrub', 'tree'];

export const MIN_SIZE = 0.01; // 1 cm
export const MAX_SIZE = 10000; // 10 km
export const NAME_MAX_LENGTH = 80;

export function kindOf(type) {
  return ELEMENT_TYPES[type]?.kind ?? null;
}

/** Normalises geometry: rounded to millimetres. */
export function normaliseGeometry(geometry) {
  switch (geometry.kind) {
    case 'polygon':
      return { kind: 'polygon', points: roundPoints(geometry.points) };
    case 'circle':
      return { kind: 'circle', center: roundPoints([geometry.center])[0], radius: roundValue(geometry.radius) };
    case 'line':
      return { kind: 'line', points: roundPoints(geometry.points), width: roundValue(geometry.width) };
    default:
      throw new Error(`Unknown geometry kind ${geometry.kind}`);
  }
}

export function createElement({ type, geometry, name = '' }) {
  if (!ELEMENT_TYPES[type]) throw new Error(`Unknown element type ${type}`);
  const element = { id: newId('e'), type, name, geometry: normaliseGeometry(geometry) };
  if (type === 'tree' || type === 'shrub') element.plantedYear = null;
  return element;
}

/** Element with default size, centred on a point (used for "add by size" and one-tap trees). */
export function createElementAt(type, center, { width, depth, diameter, name = '' } = {}) {
  const config = ELEMENT_TYPES[type];
  if (config.kind === 'circle') {
    return createElement({ type, name, geometry: { kind: 'circle', center, radius: (diameter ?? config.diameter) / 2 } });
  }
  if (config.kind === 'line') {
    const length = width ?? 2;
    return createElement({
      type,
      name,
      geometry: { kind: 'line', points: [[center[0] - length / 2, center[1]], [center[0] + length / 2, center[1]]], width: depth ?? config.width },
    });
  }
  return createElement({ type, name, geometry: { kind: 'polygon', points: rectangle(center, width ?? 2, depth ?? 1) } });
}

/** Measurements for display. */
export function measure(element) {
  const geometry = element.geometry;
  if (geometry.kind === 'polygon') {
    return {
      area: polygonArea(geometry.points),
      perimeter: perimeter(geometry.points),
      edges: edgeLengths(geometry.points),
      rectangle: asRectangle(geometry.points),
    };
  }
  if (geometry.kind === 'circle') {
    return { area: Math.PI * geometry.radius ** 2, diameter: geometry.radius * 2 };
  }
  const length = polylineLength(geometry.points);
  return { length, width: geometry.width, area: length * geometry.width };
}

export function geometryCenter(geometry) {
  if (geometry.kind === 'circle') return geometry.center;
  if (geometry.kind === 'polygon') return centroid(geometry.points);
  const b = bounds(geometry.points);
  return [(b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2];
}

/** Bounds of a list of elements, or null when empty. */
export function elementsBounds(elements) {
  const points = [];
  for (const { geometry } of elements) {
    if (geometry.kind === 'circle') {
      const [x, y] = geometry.center;
      points.push([x - geometry.radius, y - geometry.radius], [x + geometry.radius, y + geometry.radius]);
    } else {
      points.push(...geometry.points);
    }
  }
  return points.length ? bounds(points) : null;
}

/** Checks a size entered by the user. Returns an error code or null. */
export function checkSize(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'number';
  if (value < MIN_SIZE) return 'tooSmall';
  if (value > MAX_SIZE) return 'tooLarge';
  return null;
}

const isNumber = (value) => typeof value === 'number' && Number.isFinite(value);
const isPoint = (value) => Array.isArray(value) && value.length === 2 && isNumber(value[0]) && isNumber(value[1]);

/** Structural check of one element. Returns problem codes. */
export function validateElement(element) {
  const problems = [];
  const config = ELEMENT_TYPES[element.type];
  if (!config) return ['type'];
  if (typeof element.name !== 'string' || element.name.length > NAME_MAX_LENGTH) problems.push('name');
  const geometry = element.geometry;
  if (!geometry || geometry.kind !== config.kind) return [...problems, 'geometry'];
  if (geometry.kind === 'polygon') {
    if (!Array.isArray(geometry.points) || geometry.points.length < 3 || !geometry.points.every(isPoint)) problems.push('points');
  } else if (geometry.kind === 'circle') {
    if (!isPoint(geometry.center) || !isNumber(geometry.radius) || geometry.radius <= 0) problems.push('circle');
  } else if (geometry.kind === 'line') {
    if (!Array.isArray(geometry.points) || geometry.points.length < 2 || !geometry.points.every(isPoint)) problems.push('points');
    if (!isNumber(geometry.width) || geometry.width <= 0) problems.push('width');
  }
  if ('plantedYear' in element && element.plantedYear !== null && !Number.isInteger(element.plantedYear)) problems.push('plantedYear');
  return problems;
}

/** True when a polygon shape is acceptable (no crossing edges, some area). */
export function isUsablePolygon(points) {
  return points.length >= 3 && polygonArea(points) >= MIN_SIZE * MIN_SIZE && !selfIntersects(points);
}
