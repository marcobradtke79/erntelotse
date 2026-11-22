import { describe, test, expect } from './harness.js';
import {
  createElement, createElementAt, measure, validateElement, checkSize, elementsBounds,
  geometryCenter, isUsablePolygon, ELEMENT_TYPES, DRAW_ORDER, TYPE_NAMES,
} from '../js/logic/elements.js';
import { rectangle } from '../js/logic/geometry.js';

describe('types', () => {
  test('every type is drawn in a defined order', () => {
    expect([...DRAW_ORDER].sort()).toEqual([...TYPE_NAMES].sort());
  });
  test('only the parcel is single', () => {
    expect(TYPE_NAMES.filter((type) => ELEMENT_TYPES[type].single)).toEqual(['parcel']);
  });
});

describe('createElement', () => {
  test('rounds to millimetres and sets type fields', () => {
    const tree = createElement({ type: 'tree', geometry: { kind: 'circle', center: [1.23456, 2], radius: 2.00049 } });
    expect(tree.geometry).toEqual({ kind: 'circle', center: [1.235, 2], radius: 2 });
    expect(tree.plantedYear).toBeNull();
    expect(/^e_[a-z0-9]{10}$/.test(tree.id)).toBeTruthy();
    expect(validateElement(tree)).toEqual([]);
  });
  test('unknown type', () => {
    expect(() => createElement({ type: 'castle', geometry: { kind: 'polygon', points: [] } })).toThrow(Error);
  });
  test('created at a point with default and given sizes', () => {
    expect(createElementAt('tree', [0, 0]).geometry.radius).toBe(2);
    expect(createElementAt('shrub', [0, 0], { diameter: 3 }).geometry.radius).toBe(1.5);
    const bed = createElementAt('bed', [5, 5], { width: 4, depth: 1.2 });
    expect(measure(bed).area).toBeCloseTo(4.8);
    expect(geometryCenter(bed.geometry)[0]).toBeCloseTo(5);
    const path = createElementAt('path', [0, 0], { width: 3 });
    expect(measure(path).length).toBeCloseTo(3);
    expect(path.geometry.width).toBe(0.8);
  });
});

describe('measure', () => {
  test('polygon', () => {
    const result = measure(createElement({ type: 'bed', geometry: { kind: 'polygon', points: rectangle([2, 0.6], 4, 1.2) } }));
    expect(result.area).toBeCloseTo(4.8);
    expect(result.perimeter).toBeCloseTo(10.4);
    expect(result.edges.map((edge) => Math.round(edge * 10) / 10)).toEqual([4, 1.2, 4, 1.2]);
    expect(result.rectangle.width).toBeCloseTo(4);
  });
  test('circle and line', () => {
    expect(measure(createElementAt('tree', [0, 0], { diameter: 2 })).area).toBeCloseTo(Math.PI);
    const fence = createElement({ type: 'fence', geometry: { kind: 'line', points: [[0, 0], [3, 4]], width: 0.1 } });
    expect(measure(fence)).toEqual({ length: 5, width: 0.1, area: 0.5 });
  });
});

describe('bounds and checks', () => {
  test('bounds include circles', () => {
    expect(elementsBounds([])).toBeNull();
    const b = elementsBounds([createElementAt('tree', [10, 10], { diameter: 4 }), createElementAt('bed', [0, 0], { width: 2, depth: 2 })]);
    expect(b).toEqual({ minX: -1, minY: -1, maxX: 12, maxY: 12 });
  });
  test('checkSize', () => {
    expect(checkSize(1.2)).toBeNull();
    expect(checkSize(0)).toBe('tooSmall');
    expect(checkSize(NaN)).toBe('number');
    expect(checkSize(null)).toBe('number');
    expect(checkSize(20000)).toBe('tooLarge');
  });
  test('usable polygons', () => {
    expect(isUsablePolygon(rectangle([0, 0], 1, 1))).toBeTruthy();
    expect(isUsablePolygon([[0, 0], [2, 2], [2, 0], [0, 2]])).toBeFalsy();
    expect(isUsablePolygon([[0, 0], [1, 0], [2, 0]])).toBeFalsy();
  });
  test('validateElement', () => {
    const tree = createElementAt('tree', [0, 0]);
    expect(validateElement({ ...tree, plantedYear: 2015 })).toEqual([]);
    expect(validateElement({ ...tree, plantedYear: 'old' })).toEqual(['plantedYear']);
    expect(validateElement({ ...tree, name: 5 })).toEqual(['name']);
    expect(validateElement({ ...tree, geometry: { kind: 'circle', center: [0, 0], radius: -1 } })).toEqual(['circle']);
  });
});
