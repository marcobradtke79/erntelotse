import { describe, test, expect } from './harness.js';
import {
  createProjection, metresPerDegree, polygonArea, edgeLengths, perimeter, polylineLength, centroid,
  rotate, rectangle, asRectangle, resizeRectangle, pointInPolygon, polygonsOverlap, selfIntersects,
  segmentsIntersect, signedArea, roundPoints,
} from '../js/logic/geometry.js';

const square = [[0, 0], [2, 0], [2, 2], [0, 2]];
const lShape = [[0, 0], [4, 0], [4, 1], [1, 1], [1, 3], [0, 3]];

describe('projection', () => {
  test('degree lengths use the Web Mercator sphere', () => {
    expect(metresPerDegree(0).lat).toBeCloseTo(111319.49, 1);
    expect(metresPerDegree(0).lng).toBeCloseTo(111319.49, 1);
    expect(metresPerDegree(60).lng).toBeCloseTo(111319.49 / 2, 1);
    // Within 0.3 % of the WGS84 ellipsoid in Central Europe (about 111 257 m and 67 900 m at 52.5°)
    expect(Math.abs(metresPerDegree(52.5).lat / 111257 - 1) < 0.003).toBeTruthy();
    expect(Math.abs(metresPerDegree(52.5).lng / 67900 - 1) < 0.003).toBeTruthy();
  });
  test('round trip within a millimetre', () => {
    const projection = createProjection({ lat: 52.52, lng: 13.405 });
    for (const point of [[0, 0], [25.5, -13.2], [-150, 300]]) {
      const back = projection.toPoint(projection.toLatLng(point));
      expect(back[0]).toBeCloseTo(point[0], 3);
      expect(back[1]).toBeCloseTo(point[1], 3);
    }
  });
  test('origin maps to 0,0 and north is +y', () => {
    const projection = createProjection({ lat: 48.1, lng: 11.5 });
    expect(projection.toPoint({ lat: 48.1, lng: 11.5 })).toEqual([0, 0]);
    expect(projection.toPoint({ lat: 48.1001, lng: 11.5 })[1] > 0).toBeTruthy();
  });
});

describe('measurements', () => {
  test('area', () => {
    expect(polygonArea(square)).toBe(4);
    expect(polygonArea([...square].reverse())).toBe(4);
    expect(polygonArea(lShape)).toBe(6);
    expect(polygonArea([[0, 0], [1, 1]])).toBe(0);
    expect(polygonArea(rectangle([5, 5], 4, 1.2, 33))).toBeCloseTo(4.8);
  });
  test('edges and perimeter', () => {
    expect(edgeLengths([[0, 0], [3, 0], [3, 4]])).toEqual([3, 4, 5]);
    expect(perimeter(square)).toBe(8);
    expect(polylineLength([[0, 0], [3, 4], [3, 10]])).toBe(11);
  });
  test('centroid', () => {
    expect(centroid(square)).toEqual([1, 1]);
    const c = centroid(lShape);
    // 4×1 bar (centre 2, 0.5) plus 1×2 bar (centre 0.5, 2)
    expect(c[0]).toBeCloseTo(1.5);
    expect(c[1]).toBeCloseTo(1);
  });
});

describe('rectangles', () => {
  test('rotation keeps area and moves corners', () => {
    const rotated = rotate([[1, 0]], 90, [0, 0])[0];
    expect(rotated[0]).toBeCloseTo(0);
    expect(rotated[1]).toBeCloseTo(1);
  });
  test('recognised with size and rotation', () => {
    const rect = asRectangle(rectangle([3, 4], 4, 1.2, 30));
    expect(rect.width).toBeCloseTo(4);
    expect(rect.depth).toBeCloseTo(1.2);
    expect(rect.rotation).toBeCloseTo(30);
    expect(rect.center[0]).toBeCloseTo(3);
  });
  test('width is the side closest to horizontal, whatever the point order', () => {
    // Drawn starting with a vertical edge, as Leaflet rectangles are
    const rect = asRectangle([[0, 0], [0, 1.2], [4, 1.2], [4, 0]]);
    expect(rect.width).toBeCloseTo(4);
    expect(rect.depth).toBeCloseTo(1.2);
    expect(rect.rotation).toBeCloseTo(0);
    const steep = asRectangle(rectangle([0, 0], 4, 1.2, 70));
    expect(steep.width).toBeCloseTo(1.2);
    expect(steep.rotation).toBeCloseTo(-20);
  });
  test('non-rectangles are not recognised', () => {
    expect(asRectangle([[0, 0], [2, 0], [3, 2], [0, 2]])).toBeNull();
    expect(asRectangle(lShape)).toBeNull();
    expect(asRectangle([[0, 0], [1, 0], [1, 1]])).toBeNull();
  });
  test('resize keeps centre, rotation and orientation', () => {
    const original = rectangle([10, 10], 2, 1, 45);
    const resized = resizeRectangle(original, 4, 1.2);
    const rect = asRectangle(resized);
    expect(rect.width).toBeCloseTo(4);
    expect(rect.depth).toBeCloseTo(1.2);
    expect(rect.rotation).toBeCloseTo(45);
    expect(rect.center[1]).toBeCloseTo(10);
    const clockwise = [...original].reverse();
    expect(signedArea(resizeRectangle(clockwise, 4, 1.2)) < 0).toBeTruthy();
    expect(resizeRectangle(lShape, 1, 1)).toBeNull();
  });
});

describe('intersection', () => {
  test('segments', () => {
    expect(segmentsIntersect([0, 0], [2, 2], [0, 2], [2, 0])).toBeTruthy();
    expect(segmentsIntersect([0, 0], [1, 0], [0, 1], [1, 1])).toBeFalsy();
    expect(segmentsIntersect([0, 0], [2, 0], [1, 0], [3, 0])).toBeTruthy();
  });
  test('point in polygon', () => {
    expect(pointInPolygon([0.5, 2], lShape)).toBeTruthy();
    expect(pointInPolygon([2, 2], lShape)).toBeFalsy();
  });
  test('polygon overlap', () => {
    expect(polygonsOverlap(square, rectangle([2, 2], 2, 2))).toBeTruthy();
    expect(polygonsOverlap(square, rectangle([10, 10], 2, 2))).toBeFalsy();
    expect(polygonsOverlap(rectangle([5, 5], 10, 10), square)).toBeTruthy();
    expect(polygonsOverlap(lShape, rectangle([3, 2.5], 1, 1))).toBeFalsy();
  });
  test('self intersection', () => {
    expect(selfIntersects(square)).toBeFalsy();
    expect(selfIntersects(lShape)).toBeFalsy();
    expect(selfIntersects([[0, 0], [2, 2], [2, 0], [0, 2]])).toBeTruthy();
  });
});

test('roundPoints to millimetres', () => {
  expect(roundPoints([[1.23456, -0.0004]])).toEqual([[1.235, -0]]);
});
