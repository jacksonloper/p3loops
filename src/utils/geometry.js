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

// Get the identified side (north↔east, south↔west)
export function getIdentifiedSide(side) {
  switch (side) {
    case 'north': return 'east';
    case 'east': return 'north';
    case 'south': return 'west';
    case 'west': return 'south';
    default: throw new Error(`Unknown side: ${side}`);
  }
}

// Check if a point is an interior point
export function isInteriorPoint(point) {
  return point.interior === true;
}

// Check if two points are the same (considering identifications)
export function pointsAreEqual(p1, p2) {
  // Interior points - direct equality check
  if (isInteriorPoint(p1) && isInteriorPoint(p2)) {
    return Math.abs(p1.southward - p2.southward) < 0.0001 &&
           Math.abs(p1.eastward - p2.eastward) < 0.0001;
  }
  
  // One interior, one boundary - never equal
  if (isInteriorPoint(p1) !== isInteriorPoint(p2)) {
    return false;
  }
  
  // Both boundary points
  // Direct equality
  if (p1.side === p2.side && Math.abs(p1.t - p2.t) < 0.0001) {
    return true;
  }
  // Check identified side
  if (p1.side === getIdentifiedSide(p2.side) && Math.abs(p1.t - p2.t) < 0.0001) {
    return true;
  }
  return false;
}

// Configuration for the rhombus
const SIZE = 300;
// Shear amount for 60/120 degree angles.
// For a 30° shear angle: tan(30°) = 1/√3 ≈ 0.577
// SHEAR = SIZE * tan(30°) = SIZE / √3, which gives the horizontal offset
// This creates a rhombus where NW/SE corners are 60° and NE/SW corners are 120°
const SHEAR = SIZE / Math.sqrt(3);

// Corner positions of the rhombus (after shearing)
// Starting from unit square corners and applying shear transformation.
// The shear moves points leftward at the top, rightward at the bottom.
// NW corner: (0, 0) -> sheared to (-SHEAR/2, 0)
// NE corner: (SIZE, 0) -> sheared to (SIZE - SHEAR/2, 0)
// SE corner: (SIZE, SIZE) -> sheared to (SIZE + SHEAR/2, SIZE)
// SW corner: (0, SIZE) -> sheared to (SHEAR/2, SIZE)
// This creates: NE and SW corners at 120°, NW and SE corners at 60°
const HALF_SHEAR = SHEAR / 2;

// Transform from unit square coordinates to rhombus coordinates
// (southward, eastward) in [0,1]^2 -> (x, y) in screen coordinates
export function unitSquareToRhombus(southward, eastward) {
  // Y position is straightforward
  const y = southward * SIZE;
  // X position: start at eastward * SIZE, then apply shear based on vertical position
  // Shear shifts left at top, right at bottom (to create the 120° angles at NE/SW)
  // At southward=0 (top), shearOffset = -HALF_SHEAR (shift left)
  // At southward=1 (bottom), shearOffset = +HALF_SHEAR (shift right)
  const shearOffset = -HALF_SHEAR + southward * SHEAR;
  const x = eastward * SIZE + shearOffset;
  return { x, y };
}

// Get the (x, y) coordinates for a point on a side at percentage t
export function getPointOnSide(side, t) {
  // t is from 0 to 1 (percentage/100)
  switch (side) {
    case 'north': {
      // West to east at top (southward = 0)
      return unitSquareToRhombus(0, t);
    }
    case 'east': {
      // South to north at right (eastward = 1)
      return unitSquareToRhombus(1 - t, 1);
    }
    case 'south': {
      // East to west at bottom (southward = 1)
      return unitSquareToRhombus(1, 1 - t);
    }
    case 'west': {
      // North to south at left (eastward = 0)
      return unitSquareToRhombus(t, 0);
    }
    default:
      throw new Error(`Unknown side: ${side}`);
  }
}

// Get the (x, y) coordinates for an interior point
export function getInteriorPoint(southward, eastward) {
  return unitSquareToRhombus(southward, eastward);
}

// Get coordinates for any point (boundary or interior)
export function getPointCoordinates(point) {
  if (isInteriorPoint(point)) {
    return getInteriorPoint(point.southward, point.eastward);
  }
  return getPointOnSide(point.side, point.t);
}

// Get SVG path for the entire rhombus
export function getRhombusPath() {
  // Get the four corners
  const nw = unitSquareToRhombus(0, 0); // NW corner (60°)
  const ne = unitSquareToRhombus(0, 1); // NE corner (120°)
  const se = unitSquareToRhombus(1, 1); // SE corner (60°)
  const sw = unitSquareToRhombus(1, 0); // SW corner (120°)
  
  return `M ${nw.x} ${nw.y} L ${ne.x} ${ne.y} L ${se.x} ${se.y} L ${sw.x} ${sw.y} Z`;
}

// Alias for backward compatibility
export function getSquarePath() {
  return getRhombusPath();
}

// Get the SIZE constant for external use
export function getSize() {
  return SIZE;
}

// Get the SHEAR constant for external use (replacing BOW)
export function getShear() {
  return SHEAR;
}

// Backward compatibility alias
export function getBow() {
  return SHEAR;
}

// Transform from rhombus screen coordinates back to unit square
export function rhombusToUnitSquare(x, y) {
  const southward = y / SIZE;
  const shearOffset = -HALF_SHEAR + southward * SHEAR;
  const eastward = (x - shearOffset) / SIZE;
  return { southward, eastward };
}

// Check if a unit square point is inside the unit square [0,1]^2
function isInsideUnitSquare(southward, eastward) {
  return southward >= 0 && southward <= 1 && eastward >= 0 && eastward <= 1;
}

// Find the closest point on the boundary or interior to a given (x, y)
// If interiorMode is true, it will also consider interior points
export function findClosestPointOnBoundary(x, y, interiorMode = false) {
  let bestSide = null;
  let bestT = null;
  let bestDist = Infinity;
  let bestInterior = null;
  
  // Check boundary points
  for (const side of SIDES) {
    // Search along this side
    for (let i = 0; i <= 100; i++) {
      const t = i / 100;
      const pt = getPointOnSide(side, t);
      const dist = Math.sqrt((pt.x - x) ** 2 + (pt.y - y) ** 2);
      if (dist < bestDist) {
        bestDist = dist;
        bestSide = side;
        bestT = t;
        bestInterior = null;
      }
    }
  }
  
  // Refine the boundary search
  if (bestSide !== null) {
    for (let i = -10; i <= 10; i++) {
      const t = Math.max(0, Math.min(1, bestT + i / 1000));
      const pt = getPointOnSide(bestSide, t);
      const dist = Math.sqrt((pt.x - x) ** 2 + (pt.y - y) ** 2);
      if (dist < bestDist) {
        bestDist = dist;
        bestT = t;
        bestInterior = null;
      }
    }
  }
  
  // If interior mode, also check if the point is inside the rhombus
  if (interiorMode) {
    const unitCoords = rhombusToUnitSquare(x, y);
    if (isInsideUnitSquare(unitCoords.southward, unitCoords.eastward)) {
      // The cursor is inside the rhombus, check if interior is closer
      const interiorPt = getInteriorPoint(unitCoords.southward, unitCoords.eastward);
      const interiorDist = Math.sqrt((interiorPt.x - x) ** 2 + (interiorPt.y - y) ** 2);
      if (interiorDist < bestDist) {
        bestDist = interiorDist;
        bestInterior = { southward: unitCoords.southward, eastward: unitCoords.eastward };
        bestSide = null;
        bestT = null;
      }
    }
  }
  
  if (bestInterior) {
    return {
      interior: true,
      southward: bestInterior.southward,
      eastward: bestInterior.eastward,
      distance: bestDist
    };
  }
  
  return { side: bestSide, t: bestT, distance: bestDist };
}

// Get the closest interior point for a given screen coordinate
export function findInteriorPoint(x, y) {
  const unitCoords = rhombusToUnitSquare(x, y);
  // Clamp to valid range
  const southward = Math.max(0, Math.min(1, unitCoords.southward));
  const eastward = Math.max(0, Math.min(1, unitCoords.eastward));
  
  const pt = getInteriorPoint(southward, eastward);
  const dist = Math.sqrt((pt.x - x) ** 2 + (pt.y - y) ** 2);
  
  return {
    interior: true,
    southward,
    eastward,
    distance: dist
  };
}
