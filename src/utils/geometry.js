/**
 * Geometry utilities for the rhombus with edge identifications.
 * 
 * The rhombus has 4 sides: north, east, south, west
 * It is a 120/60/120/60 degree rhombus:
 *   - NE and SW corners have 120° angles (wider)
 *   - NW and SE corners have 60° angles (narrower)
 * 
 * Each side is directed:
 *   - north: west → east (left to right at top)
 *   - east: south → north (bottom to top at right)
 *   - south: east → west (right to left at bottom)
 *   - west: north → south (top to bottom at left)
 * 
 * Identifications:
 *   - north ↔ east (a point at t% through north = t% through east)
 *   - south ↔ west (a point at t% through south = t% through west)
 * 
 * Interior points are specified by (southward, eastward) in [0,1]^2.
 * These are positions in the unit square before shearing into the rhombus.
 */

export const SIDES = ['north', 'east', 'south', 'west'];

// Configuration constants
const SIZE = 300;
// Shear amount for 60/120 degree angles.
// For a 30° shear angle: tan(30°) = 1/√3 ≈ 0.577
// SHEAR = SIZE * tan(30°) = SIZE / √3
const SHEAR = SIZE / Math.sqrt(3);
const HALF_SHEAR = SHEAR / 2;

// Epsilon for floating-point comparisons
export const EPSILON = 0.0001;

/**
 * Get the identified side (north↔east, south↔west).
 */
export function getIdentifiedSide(side) {
  switch (side) {
    case 'north': return 'east';
    case 'east': return 'north';
    case 'south': return 'west';
    case 'west': return 'south';
    default: throw new Error(`Unknown side: ${side}`);
  }
}

/**
 * Check if a point is an interior point.
 */
export function isInteriorPoint(point) {
  return point.interior === true;
}

/**
 * Check if two points are the same (considering identifications).
 */
export function pointsAreEqual(p1, p2) {
  // Interior points - direct equality check
  if (isInteriorPoint(p1) && isInteriorPoint(p2)) {
    return Math.abs(p1.southward - p2.southward) < EPSILON &&
           Math.abs(p1.eastward - p2.eastward) < EPSILON;
  }
  
  // One interior, one boundary - never equal
  if (isInteriorPoint(p1) !== isInteriorPoint(p2)) {
    return false;
  }
  
  // Both boundary points - check direct or identified equality
  if (Math.abs(p1.t - p2.t) >= EPSILON) {
    return false;
  }
  return p1.side === p2.side || p1.side === getIdentifiedSide(p2.side);
}

/**
 * Transform from unit square coordinates to rhombus screen coordinates.
 * (southward, eastward) in [0,1]^2 -> (x, y) in screen coordinates
 */
export function unitSquareToRhombus(southward, eastward) {
  const y = southward * SIZE;
  // Shear: left at top, right at bottom (creates 120° at NE/SW)
  const shearOffset = -HALF_SHEAR + southward * SHEAR;
  const x = eastward * SIZE + shearOffset;
  return { x, y };
}

/**
 * Transform from rhombus screen coordinates back to unit square.
 */
export function rhombusToUnitSquare(x, y) {
  const southward = y / SIZE;
  const shearOffset = -HALF_SHEAR + southward * SHEAR;
  const eastward = (x - shearOffset) / SIZE;
  return { southward, eastward };
}

/**
 * Get screen coordinates for a point on a side at percentage t.
 */
export function getPointOnSide(side, t) {
  switch (side) {
    case 'north': return unitSquareToRhombus(0, t);
    case 'east': return unitSquareToRhombus(1 - t, 1);
    case 'south': return unitSquareToRhombus(1, 1 - t);
    case 'west': return unitSquareToRhombus(t, 0);
    default: throw new Error(`Unknown side: ${side}`);
  }
}

/**
 * Get screen coordinates for an interior point.
 */
export function getInteriorPoint(southward, eastward) {
  return unitSquareToRhombus(southward, eastward);
}

/**
 * Get screen coordinates for any point (boundary or interior).
 */
export function getPointCoordinates(point) {
  if (isInteriorPoint(point)) {
    return getInteriorPoint(point.southward, point.eastward);
  }
  return getPointOnSide(point.side, point.t);
}

/**
 * Get paper coordinates (unit square before shearing) for a point on a side.
 */
function getPointOnSidePaperCoords(side, t) {
  switch (side) {
    case 'north': return { southward: 0, eastward: t };
    case 'east': return { southward: 1 - t, eastward: 1 };
    case 'south': return { southward: 1, eastward: 1 - t };
    case 'west': return { southward: t, eastward: 0 };
    default: throw new Error(`Unknown side: ${side}`);
  }
}

/**
 * Get paper coordinates (unit square) for any point.
 */
export function getPointPaperCoordinates(point) {
  if (isInteriorPoint(point)) {
    return { southward: point.southward, eastward: point.eastward };
  }
  return getPointOnSidePaperCoords(point.side, point.t);
}

/**
 * Get SVG path for the rhombus outline.
 */
export function getRhombusPath() {
  const nw = unitSquareToRhombus(0, 0);
  const ne = unitSquareToRhombus(0, 1);
  const se = unitSquareToRhombus(1, 1);
  const sw = unitSquareToRhombus(1, 0);
  return `M ${nw.x} ${nw.y} L ${ne.x} ${ne.y} L ${se.x} ${se.y} L ${sw.x} ${sw.y} Z`;
}

/**
 * Get the SIZE constant for external use.
 */
export function getSize() {
  return SIZE;
}

/**
 * Get the SHEAR constant for external use.
 */
export function getShear() {
  return SHEAR;
}

/**
 * Find the closest point on the boundary to a given screen position.
 * Returns { side, t, distance }
 */
export function findClosestPointOnBoundary(x, y) {
  let bestSide = null;
  let bestT = null;
  let bestDist = Infinity;
  
  // Coarse search
  for (const side of SIDES) {
    for (let i = 0; i <= 100; i++) {
      const t = i / 100;
      const pt = getPointOnSide(side, t);
      const dist = Math.sqrt((pt.x - x) ** 2 + (pt.y - y) ** 2);
      if (dist < bestDist) {
        bestDist = dist;
        bestSide = side;
        bestT = t;
      }
    }
  }
  
  // Fine refinement
  if (bestSide !== null) {
    for (let i = -10; i <= 10; i++) {
      const t = Math.max(0, Math.min(1, bestT + i / 1000));
      const pt = getPointOnSide(bestSide, t);
      const dist = Math.sqrt((pt.x - x) ** 2 + (pt.y - y) ** 2);
      if (dist < bestDist) {
        bestDist = dist;
        bestT = t;
      }
    }
  }
  
  return { side: bestSide, t: bestT, distance: bestDist };
}

/**
 * Get the interior point for a given screen coordinate.
 * Returns { interior: true, southward, eastward, distance }
 */
export function findInteriorPoint(x, y) {
  const unitCoords = rhombusToUnitSquare(x, y);
  const southward = Math.max(0, Math.min(1, unitCoords.southward));
  const eastward = Math.max(0, Math.min(1, unitCoords.eastward));
  
  const pt = getInteriorPoint(southward, eastward);
  const dist = Math.sqrt((pt.x - x) ** 2 + (pt.y - y) ** 2);
  
  return { interior: true, southward, eastward, distance: dist };
}
