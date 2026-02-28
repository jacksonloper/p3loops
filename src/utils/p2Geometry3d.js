/**
 * 3D geometry utilities for rendering the p2 square path on a puffed surface.
 *
 * The unit square is divided into:
 * - A central diamond (square rotated 45°) connecting the midpoints of the sides
 * - Four right triangles at the corners
 *
 * The central diamond is "side 1" with a positive cupola (highest at center).
 * The four corner triangles are "side 2": each triangle is reflected over its
 * hypotenuse (the diamond edge) into the diamond area, giving negative cupola.
 *
 * Diamond vertices (midpoints of the unit square sides):
 *   N mid = (0.5, 0)
 *   E mid = (1, 0.5)
 *   S mid = (0.5, 1)
 *   W mid = (0, 0.5)
 *
 * Diamond interior coordinates (u, v) ∈ [0,1]²:
 *   u = x + y - 0.5
 *   v = x - y + 0.5
 *
 * Cupola height: z = (u * (1-u) * v * (1-v))^(1/3)
 */

/**
 * Convert zone + t coordinates to unit square (x, y) ∈ [0,1]².
 * x = eastward, y = southward.
 */
export function zoneToUnitSquare(zone, t) {
  switch (zone) {
    case 'NNW': return { x: t * 0.5, y: 0 };
    case 'NNE': return { x: 0.5 + t * 0.5, y: 0 };
    case 'ENE': return { x: 1, y: t * 0.5 };
    case 'ESE': return { x: 1, y: 0.5 + t * 0.5 };
    case 'SSE': return { x: 1 - t * 0.5, y: 1 };
    case 'SSW': return { x: 0.5 - t * 0.5, y: 1 };
    case 'WSW': return { x: 0, y: 1 - t * 0.5 };
    case 'WNW': return { x: 0, y: 0.5 - t * 0.5 };
    default: throw new Error(`Unknown zone: ${zone}`);
  }
}

/**
 * Determine which region a point (x, y) in the unit square belongs to.
 * Returns 'diamond' for the central diamond, or the corner name.
 */
export function getRegion(x, y) {
  const sum = x + y;
  const diff = x - y;

  if (sum < 0.5) return 'nw';
  if (sum > 1.5) return 'se';
  if (diff > 0.5) return 'ne';
  if (diff < -0.5) return 'sw';
  return 'diamond';
}

/**
 * Reflect a corner-triangle point over the corresponding hypotenuse
 * into the central diamond.
 *
 * NW triangle: reflect over x + y = 0.5
 * NE triangle: reflect over x - y = 0.5
 * SE triangle: reflect over x + y = 1.5
 * SW triangle: reflect over y - x = 0.5 (i.e. x - y = -0.5)
 */
export function reflectToDiamond(x, y, region) {
  switch (region) {
    case 'nw': return { x: 0.5 - y, y: 0.5 - x };
    case 'ne': return { x: y + 0.5, y: x - 0.5 };
    case 'se': return { x: 1.5 - y, y: 1.5 - x };
    case 'sw': return { x: y - 0.5, y: x + 0.5 };
    default: return { x, y };
  }
}

/**
 * Convert unit square (x, y) to diamond interior coordinates (u, v) ∈ [0,1]².
 * The point must already be inside the diamond.
 */
function toDiamondCoords(x, y) {
  const u = x + y - 0.5;
  const v = x - y + 0.5;
  return { u, v };
}

/**
 * Compute cupola height from diamond coordinates.
 * z = (u * (1-u) * v * (1-v))^(1/3)
 */
function cupolaHeight(u, v) {
  const uClamped = Math.max(0, Math.min(1, u));
  const vClamped = Math.max(0, Math.min(1, v));
  const product = uClamped * (1 - uClamped) * vClamped * (1 - vClamped);
  return Math.cbrt(product);
}

// Scale factor for z-height to get a visually pleasing result
const Z_SCALE = 1.5;

/**
 * Convert a point in the unit square to 3D coordinates.
 * Points in the central diamond get positive cupola height.
 * Points in corner triangles are reflected and get negative cupola height.
 *
 * @param {number} x - Eastward position in [0,1]
 * @param {number} y - Southward position in [0,1]
 * @returns {{x: number, y: number, z: number}}
 */
export function unitSquareTo3D(x, y) {
  const region = getRegion(x, y);

  let dx, dy;
  if (region === 'diamond') {
    dx = x;
    dy = y;
  } else {
    const reflected = reflectToDiamond(x, y, region);
    dx = reflected.x;
    dy = reflected.y;
  }

  const { u, v } = toDiamondCoords(dx, dy);
  const z = cupolaHeight(u, v) * Z_SCALE;

  // Map diamond coords to centered 3D XY position
  // u, v ∈ [0,1] → centered at origin
  const outX = u - 0.5;
  const outY = v - 0.5;

  return {
    x: outX,
    y: outY,
    z: region === 'diamond' ? z : -z
  };
}

/**
 * Sample points along a quadratic bezier edge between two zone-parameterized
 * boundary points, then convert each to 3D.
 *
 * @param {Object} edge - Edge with from: {zone, t} and to: {zone, t}
 * @param {number} numSamples - Number of sample points
 * @returns {Array<{x: number, y: number, z: number}>}
 */
export function interpolateEdge3D(edge, numSamples = 15) {
  const p0 = zoneToUnitSquare(edge.from.zone, edge.from.t);
  const p1 = zoneToUnitSquare(edge.to.zone, edge.to.t);

  // Control point: pull midpoint toward center of square
  const midX = (p0.x + p1.x) / 2;
  const midY = (p0.y + p1.y) / 2;
  const pullFactor = 0.3;
  const ctrlX = midX + (0.5 - midX) * pullFactor;
  const ctrlY = midY + (0.5 - midY) * pullFactor;

  const points = [];
  for (let i = 0; i < numSamples; i++) {
    const t = i / (numSamples - 1);
    // Quadratic bezier
    const bx = (1 - t) * (1 - t) * p0.x + 2 * (1 - t) * t * ctrlX + t * t * p1.x;
    const by = (1 - t) * (1 - t) * p0.y + 2 * (1 - t) * t * ctrlY + t * t * p1.y;
    points.push(unitSquareTo3D(bx, by));
  }

  return points;
}

/**
 * Get the 3D vertices of the flat diamond base (at z=0).
 * The diamond connects the midpoints of the unit square sides.
 * Returns 4 vertices in order: N, E, S, W.
 */
export function getFlatDiamondVertices() {
  // Diamond midpoints in unit square: N(0.5,0), E(1,0.5), S(0.5,1), W(0,0.5)
  // In diamond coords (u,v): N→(0,1), E→(1,1), S→(1,0), W→(0,0)
  // Centered: N→(-0.5,0.5), E→(0.5,0.5), S→(0.5,-0.5), W→(-0.5,-0.5)
  return [
    { x: -0.5, y: 0.5, z: 0 },  // N mid
    { x: 0.5, y: 0.5, z: 0 },   // E mid
    { x: 0.5, y: -0.5, z: 0 },  // S mid
    { x: -0.5, y: -0.5, z: 0 }  // W mid
  ];
}

/**
 * Compute direction vector for a cone at a given position along the edge.
 * @param {Array} points - Array of 3D points
 * @param {number} index - Index of the point to compute direction at
 * @returns {{x: number, y: number, z: number}} Normalized direction vector
 */
export function getDirectionAtPoint(points, index) {
  let dx, dy, dz;

  if (index < points.length - 1) {
    dx = points[index + 1].x - points[index].x;
    dy = points[index + 1].y - points[index].y;
    dz = points[index + 1].z - points[index].z;
  } else {
    dx = points[index].x - points[index - 1].x;
    dy = points[index].y - points[index - 1].y;
    dz = points[index].z - points[index - 1].z;
  }

  const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
  if (len < 0.0001) {
    return { x: 1, y: 0, z: 0 };
  }

  return { x: dx / len, y: dy / len, z: dz / len };
}
