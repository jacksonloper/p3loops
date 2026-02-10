/**
 * 3D geometry utilities for rendering the rhombus path on puffed triangles.
 * 
 * The rhombus (unit square before shearing) is divided into two triangles:
 * - Northwest triangle: corners NW(0,0), NE(0,1), SW(1,0)
 * - Southeast triangle: corners SE(1,1), NE(0,1), SW(1,0)
 * 
 * Points are transformed to 3D as follows:
 * 1. Convert to barycentric coordinates on the appropriate triangle
 * 2. Map to (X,Y) on a pointy-side-up equilateral triangle centered at origin
 * 3. Z = (a*b*c)^(1/3) for NW region, -(a*b*c)^(1/3) for SE region
 */

import { getEdgeSamplePointsPaper, isInteriorPoint } from './geometry.js';

// Vertices of the unit square in (southward, eastward) coordinates
// NW = (0, 0), NE = (0, 1), SW = (1, 0), SE = (1, 1)
const NW = { southward: 0, eastward: 0 };
const NE = { southward: 0, eastward: 1 };
const SW = { southward: 1, eastward: 0 };
const SE = { southward: 1, eastward: 1 };

// Vertices of the equilateral triangle (pointy-side-up, centered at origin)
// We use a unit equilateral triangle with vertices at:
// Top vertex, bottom-left, bottom-right
const SQRT3 = Math.sqrt(3);
const TRIANGLE_TOP = { x: 0, y: 2 / 3 };
const TRIANGLE_BL = { x: -0.5, y: -1 / 3 };
const TRIANGLE_BR = { x: 0.5, y: -1 / 3 };

/**
 * Determine which triangle region a point is in.
 * The diagonal goes from NW(0,0) to SE(1,1).
 * Points with southward + eastward <= 1 are in the NW triangle.
 * Points with southward + eastward > 1 are in the SE triangle.
 */
export function getTriangleRegion(southward, eastward) {
  return (southward + eastward <= 1) ? 'northwest' : 'southeast';
}

/**
 * Compute barycentric coordinates for a point in the NW triangle.
 * Triangle vertices: NW(0,0), NE(0,1), SW(1,0)
 * Returns {a, b, c} where a corresponds to NW, b to NE, c to SW.
 */
function barycentricNW(southward, eastward) {
  // For triangle with vertices (0,0), (0,1), (1,0) in (southward, eastward):
  // Point P = a*NW + b*NE + c*SW
  // (southward, eastward) = a*(0,0) + b*(0,1) + c*(1,0)
  // southward = c, eastward = b, a = 1 - b - c
  const c = southward;
  const b = eastward;
  const a = 1 - b - c;
  return { a, b, c };
}

/**
 * Compute barycentric coordinates for a point in the SE triangle.
 * Triangle vertices: SE(1,1), NE(0,1), SW(1,0)
 * Returns {a, b, c} where a corresponds to SE, b to NE, c to SW.
 */
function barycentricSE(southward, eastward) {
  // For triangle with vertices SE(1,1), NE(0,1), SW(1,0):
  // Point P = a*SE + b*NE + c*SW
  // (southward, eastward) = a*(1,1) + b*(0,1) + c*(1,0)
  // southward = a + c, eastward = a + b
  // From the SE triangle: a = southward + eastward - 1
  // b = 1 - southward, c = 1 - eastward
  const a = southward + eastward - 1;
  const b = 1 - southward;
  const c = 1 - eastward;
  return { a, b, c };
}

/**
 * Convert barycentric coordinates to 2D position on the equilateral triangle.
 * The triangle mapping is:
 * - NW region: a=NW->top, b=NE->bottom-right, c=SW->bottom-left
 * - SE region: a=SE->top, b=NE->bottom-right, c=SW->bottom-left
 * This ensures both triangles map to the same equilateral triangle.
 */
function barycentricTo2D(a, b, c) {
  const x = a * TRIANGLE_TOP.x + b * TRIANGLE_BR.x + c * TRIANGLE_BL.x;
  const y = a * TRIANGLE_TOP.y + b * TRIANGLE_BR.y + c * TRIANGLE_BL.y;
  return { x, y };
}

/**
 * Compute Z coordinate from barycentric coordinates.
 * Z = (a*b*c)^(1/3), with sign based on region.
 */
function computeZ(a, b, c, region) {
  // Clamp barycentric coords to avoid negative values due to floating point
  const aClamped = Math.max(0, a);
  const bClamped = Math.max(0, b);
  const cClamped = Math.max(0, c);
  
  const product = aClamped * bClamped * cClamped;
  const z = Math.cbrt(product);
  
  return region === 'northwest' ? z : -z;
}

/**
 * Convert a point in unit square coordinates to 3D.
 * @param {number} southward - Position in [0,1]
 * @param {number} eastward - Position in [0,1]
 * @returns {{x: number, y: number, z: number}}
 */
export function unitSquareTo3D(southward, eastward) {
  const region = getTriangleRegion(southward, eastward);
  
  let bary;
  if (region === 'northwest') {
    bary = barycentricNW(southward, eastward);
  } else {
    bary = barycentricSE(southward, eastward);
  }
  
  const { x, y } = barycentricTo2D(bary.a, bary.b, bary.c);
  const z = computeZ(bary.a, bary.b, bary.c, region);
  
  return { x, y, z };
}

/**
 * Interpolate between two points with a given number of subdivisions.
 * @param {Object} from - Start point {southward, eastward}
 * @param {Object} to - End point {southward, eastward}
 * @param {number} subdivisions - Number of segments (points = subdivisions + 1)
 * @returns {Array} Array of points with x, y, z coordinates
 */
export function interpolateEdge3D(from, to, subdivisions = 10) {
  const points = [];
  
  for (let i = 0; i <= subdivisions; i++) {
    const t = i / subdivisions;
    const southward = from.southward + t * (to.southward - from.southward);
    const eastward = from.eastward + t * (to.eastward - from.eastward);
    const point3D = unitSquareTo3D(southward, eastward);
    points.push(point3D);
  }
  
  return points;
}

/**
 * Interpolate edge using diffeomorphism-based sampling for guaranteed non-intersection.
 * This uses the same diffeomorphism as the 2D rhombus view to sample points along
 * the edge, then converts them to 3D coordinates.
 * 
 * @param {Object} edge - Edge object with from/to points (boundary points with side and t)
 * @param {number} numSamples - Number of sample points (default: 15)
 * @returns {Array} Array of points with x, y, z coordinates
 */
export function interpolateEdgeDiffeomorphism3D(edge, numSamples = 15) {
  // For edges involving interior points, fall back to linear interpolation
  if (isInteriorPoint(edge.from) || isInteriorPoint(edge.to)) {
    // Get paper coordinates and do linear interpolation
    const from = {
      southward: edge.from.southward ?? 0.5,
      eastward: edge.from.eastward ?? 0.5
    };
    const to = {
      southward: edge.to.southward ?? 0.5,
      eastward: edge.to.eastward ?? 0.5
    };
    return interpolateEdge3D(from, to, numSamples - 1);
  }
  
  // Use diffeomorphism-based sampling for boundary-to-boundary edges
  const paperPoints = getEdgeSamplePointsPaper(
    edge.from.side,
    edge.from.t,
    edge.to.side,
    edge.to.t,
    numSamples
  );
  
  // Convert each paper coordinate point to 3D
  const points = paperPoints.map(pt => unitSquareTo3D(pt.southward, pt.eastward));
  
  return points;
}

/**
 * Get the 3D coordinates for the flat equilateral triangle base.
 * Returns vertices for a triangle at z=0.
 */
export function getFlatTriangleVertices() {
  return [
    { x: TRIANGLE_TOP.x, y: TRIANGLE_TOP.y, z: 0 },
    { x: TRIANGLE_BL.x, y: TRIANGLE_BL.y, z: 0 },
    { x: TRIANGLE_BR.x, y: TRIANGLE_BR.y, z: 0 }
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
