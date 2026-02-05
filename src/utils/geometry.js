/**
 * Geometry utilities for the bowed square with edge identifications.
 * 
 * The square has 4 sides: north, east, south, west
 * Each side is directed:
 *   - north: west → east (left to right at top)
 *   - east: south → north (bottom to top at right)
 *   - south: east → west (right to left at bottom)
 *   - west: north → south (top to bottom at left)
 * 
 * Identifications:
 *   - north ↔ east (a point at t% through north = t% through east)
 *   - south ↔ west (a point at t% through south = t% through west)
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

// Check if two points are the same (considering identifications)
export function pointsAreEqual(p1, p2) {
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

// Configuration for the bowed square
const SIZE = 300;
const CENTER = SIZE / 2;
const BOW = 20; // How much the sides bow out

// Get the (x, y) coordinates for a point on a side at percentage t
export function getPointOnSide(side, t) {
  // t is from 0 to 1 (percentage/100)
  const fraction = t;
  
  // Calculate bow offset (maximum in middle, zero at ends)
  const bowOffset = BOW * Math.sin(Math.PI * fraction);
  
  switch (side) {
    case 'north': {
      // West to east at top (y near 0)
      const x = fraction * SIZE;
      const y = -bowOffset; // Bow outward (negative y)
      return { x, y };
    }
    case 'east': {
      // South to north at right (x near SIZE)
      const x = SIZE + bowOffset; // Bow outward (positive x)
      const y = SIZE - fraction * SIZE; // From bottom to top
      return { x, y };
    }
    case 'south': {
      // East to west at bottom (y near SIZE)
      const x = SIZE - fraction * SIZE; // Right to left
      const y = SIZE + bowOffset; // Bow outward (positive y)
      return { x, y };
    }
    case 'west': {
      // North to south at left (x near 0)
      const x = -bowOffset; // Bow outward (negative x)
      const y = fraction * SIZE; // Top to bottom
      return { x, y };
    }
    default:
      throw new Error(`Unknown side: ${side}`);
  }
}

// Generate path data for a side (for SVG)
export function getSidePath(side, numPoints = 50) {
  const points = [];
  for (let i = 0; i <= numPoints; i++) {
    const t = i / numPoints;
    points.push(getPointOnSide(side, t));
  }
  return points;
}

// Get SVG path for the entire bowed square
export function getSquarePath() {
  // Draw in order: starting from NW corner going around
  // North (W→E), then east (S→N), then south (E→W), then west (N→S)
  let d = '';
  
  // North side
  const northPoints = getSidePath('north');
  d += `M ${northPoints[0].x} ${northPoints[0].y}`;
  for (let i = 1; i < northPoints.length; i++) {
    d += ` L ${northPoints[i].x} ${northPoints[i].y}`;
  }
  
  // East side (continues from NE corner)
  const eastPoints = getSidePath('east');
  for (let i = 0; i < eastPoints.length; i++) {
    d += ` L ${eastPoints[i].x} ${eastPoints[i].y}`;
  }
  
  // South side (continues from SE corner)
  const southPoints = getSidePath('south');
  for (let i = 0; i < southPoints.length; i++) {
    d += ` L ${southPoints[i].x} ${southPoints[i].y}`;
  }
  
  // West side (continues from SW corner back to NW)
  const westPoints = getSidePath('west');
  for (let i = 0; i < westPoints.length; i++) {
    d += ` L ${westPoints[i].x} ${westPoints[i].y}`;
  }
  
  d += ' Z';
  return d;
}

// Get the SIZE constant for external use
export function getSize() {
  return SIZE;
}

// Get the BOW constant for external use
export function getBow() {
  return BOW;
}

// Find the closest point on the boundary to a given (x, y)
export function findClosestPointOnBoundary(x, y) {
  let bestSide = null;
  let bestT = null;
  let bestDist = Infinity;
  
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
      }
    }
  }
  
  // Refine the search
  for (let i = -10; i <= 10; i++) {
    const t = Math.max(0, Math.min(1, bestT + i / 1000));
    const pt = getPointOnSide(bestSide, t);
    const dist = Math.sqrt((pt.x - x) ** 2 + (pt.y - y) ** 2);
    if (dist < bestDist) {
      bestDist = dist;
      bestT = t;
    }
  }
  
  return { side: bestSide, t: bestT, distance: bestDist };
}
