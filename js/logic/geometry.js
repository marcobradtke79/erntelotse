// Garden geometry in local metres: x to the east, y to the north, relative to the
// garden origin (docs/concept.md §4.4). Pure module: no Leaflet, no DOM.
//
// Points are [x, y] arrays. Polygons are arrays of points without a repeated
// closing point.

const DEG = Math.PI / 180;

/** Sphere radius of Web Mercator (EPSG:3857), as used by Leaflet and the map tiles */
const EARTH_RADIUS = 6378137;

/**
 * Metres per degree at a latitude, on the same sphere as Web Mercator.
 * Using the map's own model keeps shapes undistorted on screen, so rotating
 * a rectangle on the map keeps it exactly rectangular. Compared with the
 * WGS84 ellipsoid, distances are off by at most about 0.3 % in Central
 * Europe (6 cm over 20 m), well below what tracing from a map achieves.
 */
export function metresPerDegree(latitude) {
  const perDegree = EARTH_RADIUS * DEG;
  return { lat: perDegree, lng: perDegree * Math.cos(latitude * DEG) };
}

/**
 * Local flat projection around an origin. Within the few hundred metres of a
 * garden it matches Web Mercator to far below a centimetre.
 */
export function createProjection(origin) {
  const scale = metresPerDegree(origin.lat);
  return {
    origin,
    toLatLng([x, y]) {
      return { lat: origin.lat + y / scale.lat, lng: origin.lng + x / scale.lng };
    },
    toPoint({ lat, lng }) {
      return [(lng - origin.lng) * scale.lng, (lat - origin.lat) * scale.lat];
    },
  };
}

/** Origin used for gardens without a real location (plan only). */
export const PLAN_ORIGIN = Object.freeze({ lat: 0, lng: 0 });

export function distance([x1, y1], [x2, y2]) {
  return Math.hypot(x2 - x1, y2 - y1);
}

export function midpoint([x1, y1], [x2, y2]) {
  return [(x1 + x2) / 2, (y1 + y2) / 2];
}

/** Signed area (positive when counter-clockwise). */
export function signedArea(points) {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % points.length];
    sum += x1 * y2 - x2 * y1;
  }
  return sum / 2;
}

export function polygonArea(points) {
  return points.length < 3 ? 0 : Math.abs(signedArea(points));
}

/** Lengths of all edges, including the closing edge. */
export function edgeLengths(points) {
  return points.map((point, i) => distance(point, points[(i + 1) % points.length]));
}

export function perimeter(points) {
  return edgeLengths(points).reduce((sum, length) => sum + length, 0);
}

export function polylineLength(points) {
  let length = 0;
  for (let i = 1; i < points.length; i++) length += distance(points[i - 1], points[i]);
  return length;
}

/** Area centroid; falls back to the vertex average for degenerate polygons. */
export function centroid(points) {
  const area = signedArea(points);
  if (Math.abs(area) < 1e-12) {
    const sum = points.reduce(([sx, sy], [x, y]) => [sx + x, sy + y], [0, 0]);
    return [sum[0] / points.length, sum[1] / points.length];
  }
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < points.length; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % points.length];
    const cross = x1 * y2 - x2 * y1;
    cx += (x1 + x2) * cross;
    cy += (y1 + y2) * cross;
  }
  return [cx / (6 * area), cy / (6 * area)];
}

export function bounds(points) {
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
}

export function translate(points, dx, dy) {
  return points.map(([x, y]) => [x + dx, y + dy]);
}

/** Rotates points counter-clockwise by `degrees` around `center`. */
export function rotate(points, degrees, [cx, cy]) {
  const angle = degrees * DEG;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return points.map(([x, y]) => {
    const dx = x - cx;
    const dy = y - cy;
    return [cx + dx * cos - dy * sin, cy + dx * sin + dy * cos];
  });
}

/**
 * Rectangle with its centre, width (along the rotated x axis), depth and
 * rotation in degrees (counter-clockwise). Points are counter-clockwise.
 */
export function rectangle([cx, cy], width, depth, degrees = 0) {
  const w = width / 2;
  const d = depth / 2;
  return rotate([[cx - w, cy - d], [cx + w, cy - d], [cx + w, cy + d], [cx - w, cy + d]], degrees, [cx, cy]);
}

/** Angle of a line direction in (-90, 90] degrees. */
function lineAngle(dx, dy) {
  let angle = ((Math.atan2(dy, dx) / DEG) % 180 + 180) % 180;
  if (angle > 90) angle -= 180;
  return angle;
}

/**
 * If the polygon is a rectangle (4 corners, right angles within `toleranceDeg`),
 * returns { center, width, depth, rotation }. Width is the side closest to the
 * x axis, so rotation lies in (-45, 45]. Otherwise null.
 */
export function asRectangle(points, toleranceDeg = 0.5) {
  if (points.length !== 4) return null;
  const edges = points.map((point, i) => {
    const next = points[(i + 1) % 4];
    return [next[0] - point[0], next[1] - point[1]];
  });
  const lengths = edges.map(([dx, dy]) => Math.hypot(dx, dy));
  if (lengths.some((length) => length < 1e-9)) return null;
  const limit = Math.sin(toleranceDeg * DEG);
  for (let i = 0; i < 4; i++) {
    const [ax, ay] = edges[i];
    const [bx, by] = edges[(i + 1) % 4];
    const cosine = (ax * bx + ay * by) / (lengths[i] * lengths[(i + 1) % 4]);
    if (Math.abs(cosine) > limit) return null;
  }
  let rotation = lineAngle(...edges[0]);
  let width = (lengths[0] + lengths[2]) / 2;
  let depth = (lengths[1] + lengths[3]) / 2;
  if (rotation <= -45 || rotation > 45) {
    rotation = lineAngle(...edges[1]);
    [width, depth] = [depth, width];
  }
  return { center: centroid(points), width, depth, rotation };
}

/** Resizes a rectangle, keeping its centre and rotation; keeps the point order of `rectangle()`. */
export function resizeRectangle(points, width, depth) {
  const rect = asRectangle(points);
  if (!rect) return null;
  const ccw = signedArea(points) > 0;
  const result = rectangle(rect.center, width, depth, rect.rotation);
  return ccw ? result : [result[0], result[3], result[2], result[1]];
}

function orientation(a, b, c) {
  const value = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  if (Math.abs(value) < 1e-12) return 0;
  return value > 0 ? 1 : -1;
}

function onSegment(a, b, p) {
  return Math.min(a[0], b[0]) - 1e-12 <= p[0] && p[0] <= Math.max(a[0], b[0]) + 1e-12 &&
    Math.min(a[1], b[1]) - 1e-12 <= p[1] && p[1] <= Math.max(a[1], b[1]) + 1e-12;
}

export function segmentsIntersect(a, b, c, d) {
  const o1 = orientation(a, b, c);
  const o2 = orientation(a, b, d);
  const o3 = orientation(c, d, a);
  const o4 = orientation(c, d, b);
  if (o1 !== o2 && o3 !== o4) return true;
  if (o1 === 0 && onSegment(a, b, c)) return true;
  if (o2 === 0 && onSegment(a, b, d)) return true;
  if (o3 === 0 && onSegment(c, d, a)) return true;
  if (o4 === 0 && onSegment(c, d, b)) return true;
  return false;
}

/** Ray casting; points on the boundary may count either way. */
export function pointInPolygon([x, y], points) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, yi] = points[i];
    const [xj, yj] = points[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** True if two polygons share any area or touch (works for concave polygons). */
export function polygonsOverlap(a, b) {
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < b.length; j++) {
      if (segmentsIntersect(a[i], a[(i + 1) % a.length], b[j], b[(j + 1) % b.length])) return true;
    }
  }
  return pointInPolygon(a[0], b) || pointInPolygon(b[0], a);
}

/** True if the polygon's edges cross each other (not counting adjacent edges). */
export function selfIntersects(points) {
  const n = points.length;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (j === i + 1 || (i === 0 && j === n - 1)) continue;
      if (segmentsIntersect(points[i], points[(i + 1) % n], points[j], points[(j + 1) % n])) return true;
    }
  }
  return false;
}

export function distanceToSegment([px, py], [ax, ay], [bx, by]) {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSquared));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function onBoundary(point, polygon, tolerance) {
  return polygon.some((a, i) => distanceToSegment(point, a, polygon[(i + 1) % polygon.length]) <= tolerance);
}

/** Inside or within `tolerance` metres of the boundary (shapes snapped to edges count as inside). */
export function pointInOrOnPolygon(point, polygon, tolerance = 0.002) {
  return onBoundary(point, polygon, tolerance) || pointInPolygon(point, polygon);
}

/**
 * True if `inner` lies completely within `outer` (touching the boundary is allowed).
 * Works for concave outer polygons.
 */
export function polygonInsidePolygon(inner, outer, tolerance = 0.002) {
  for (let i = 0; i < inner.length; i++) {
    if (!pointInOrOnPolygon(inner[i], outer, tolerance)) return false;
    if (!pointInOrOnPolygon(midpoint(inner[i], inner[(i + 1) % inner.length]), outer, tolerance)) return false;
  }
  // A notch of a concave outer polygon reaching into the inner one
  return !outer.some((point) => pointInPolygon(point, inner) && !onBoundary(point, inner, tolerance));
}

export function isConvex(points) {
  if (points.length < 3) return false;
  let sign = 0;
  for (let i = 0; i < points.length; i++) {
    const [ax, ay] = points[i];
    const [bx, by] = points[(i + 1) % points.length];
    const [cx, cy] = points[(i + 2) % points.length];
    const cross = (bx - ax) * (cy - by) - (by - ay) * (cx - bx);
    if (Math.abs(cross) < 1e-12) continue;
    const current = Math.sign(cross);
    if (sign !== 0 && current !== sign) return false;
    sign = current;
  }
  return sign !== 0;
}

/**
 * Sutherland–Hodgman: the part of `subject` inside the convex polygon `clip`.
 * Returns [] when nothing is left.
 */
export function clipPolygonConvex(subject, clip) {
  const ccwClip = signedArea(clip) < 0 ? [...clip].reverse() : clip;
  let output = subject;
  for (let i = 0; i < ccwClip.length && output.length > 0; i++) {
    const a = ccwClip[i];
    const b = ccwClip[(i + 1) % ccwClip.length];
    const inside = ([x, y]) => (b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]) >= -1e-9;
    const intersection = (p, q) => {
      const [x1, y1] = p;
      const [x2, y2] = q;
      const denominator = (x1 - x2) * (a[1] - b[1]) - (y1 - y2) * (a[0] - b[0]);
      const t = ((x1 - a[0]) * (a[1] - b[1]) - (y1 - a[1]) * (a[0] - b[0])) / denominator;
      return [x1 + t * (x2 - x1), y1 + t * (y2 - y1)];
    };
    const input = output;
    output = [];
    for (let j = 0; j < input.length; j++) {
      const current = input[j];
      const previous = input[(j + input.length - 1) % input.length];
      if (inside(current)) {
        if (!inside(previous)) output.push(intersection(previous, current));
        output.push(current);
      } else if (inside(previous)) {
        output.push(intersection(previous, current));
      }
    }
  }
  // Drop points that collapsed onto their neighbour
  return output.filter((point, i) => distance(point, output[(i + 1) % output.length]) > 1e-6);
}

/**
 * If `after` is `before` moved and/or rotated (same shape, same point order),
 * returns that transform, otherwise null.
 */
export function rigidTransform(before, after, tolerance = 0.005) {
  if (before.length !== after.length || before.length < 2) return null;
  const angleOf = (points) => Math.atan2(points[1][1] - points[0][1], points[1][0] - points[0][0]);
  const transform = { from: before[0], to: after[0], rotation: (angleOf(after) - angleOf(before)) / DEG };
  const moved = applyRigid(before, transform);
  return moved.every((point, i) => distance(point, after[i]) <= tolerance) ? transform : null;
}

export function applyRigid(points, { from, to, rotation }) {
  return translate(rotate(points, rotation, from), to[0] - from[0], to[1] - from[1]);
}

/** Shortest distance between two polygons; 0 when they overlap or touch. */
export function polygonDistance(a, b) {
  if (polygonsOverlap(a, b)) return 0;
  let best = Infinity;
  for (const point of a) for (let j = 0; j < b.length; j++) best = Math.min(best, distanceToSegment(point, b[j], b[(j + 1) % b.length]));
  for (const point of b) for (let i = 0; i < a.length; i++) best = Math.min(best, distanceToSegment(point, a[i], a[(i + 1) % a.length]));
  return best;
}

/** Distance from a point to a polygon; 0 inside. */
export function pointPolygonDistance(point, polygon) {
  if (pointInPolygon(point, polygon)) return 0;
  return Math.min(...polygon.map((a, i) => distanceToSegment(point, a, polygon[(i + 1) % polygon.length])));
}

/** Rounds coordinates to millimetres to keep stored data small and stable. */
export function roundPoints(points) {
  return points.map(([x, y]) => [Math.round(x * 1000) / 1000, Math.round(y * 1000) / 1000]);
}

export function roundValue(value) {
  return Math.round(value * 1000) / 1000;
}
