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
 */

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
 * Transform from unit square coordinates to rhombus screen coordinates.
 * (southward, eastward) in [0,1]^2 -> (x, y) in screen coordinates
 */
function unitSquareToRhombus(southward, eastward) {
  const y = southward * SIZE;
  // Shear: left at top, right at bottom (creates 120° at NE/SW)
  const shearOffset = -HALF_SHEAR + southward * SHEAR;
  const x = eastward * SIZE + shearOffset;
  return { x, y };
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

// Default bow amount for the bowed rhombus (in SVG units, same coordinate system as SIZE=300)
const DEFAULT_BOW_AMOUNT = 60;

/**
 * Get the control points for the bowed rhombus sides.
 * Returns { nw, ne, se, sw, northMid, eastMid, southMid, westMid }
 * @param {number} bowAmount - How much to bow the sides outward in SVG units.
 */
function getBowedRhombusControlPoints(bowAmount = DEFAULT_BOW_AMOUNT) {
  const nw = unitSquareToRhombus(0, 0);
  const ne = unitSquareToRhombus(0, 1);
  const se = unitSquareToRhombus(1, 1);
  const sw = unitSquareToRhombus(1, 0);
  
  // Calculate control points for quadratic bezier curves
  // Each control point is the midpoint of the side, pushed outward
  
  // North side (nw -> ne): push upward (negative y)
  const northMid = { x: (nw.x + ne.x) / 2, y: (nw.y + ne.y) / 2 - bowAmount };
  
  // East side (ne -> se): push rightward (positive x)
  const eastMid = { x: (ne.x + se.x) / 2 + bowAmount, y: (ne.y + se.y) / 2 };
  
  // South side (se -> sw): push downward (positive y)
  const southMid = { x: (se.x + sw.x) / 2, y: (se.y + sw.y) / 2 + bowAmount };
  
  // West side (sw -> nw): push leftward (negative x)
  const westMid = { x: (sw.x + nw.x) / 2 - bowAmount, y: (sw.y + nw.y) / 2 };
  
  return { nw, ne, se, sw, northMid, eastMid, southMid, westMid };
}

/**
 * Evaluate a quadratic bezier curve at parameter t.
 * B(t) = (1-t)²P0 + 2(1-t)tP1 + t²P2
 * @param {Object} p0 - Start point { x, y }
 * @param {Object} p1 - Control point { x, y }
 * @param {Object} p2 - End point { x, y }
 * @param {number} t - Parameter from 0 to 1
 */
function evaluateQuadraticBezier(p0, p1, p2, t) {
  const oneMinusT = 1 - t;
  const oneMinusT2 = oneMinusT * oneMinusT;
  const t2 = t * t;
  
  return {
    x: oneMinusT2 * p0.x + 2 * oneMinusT * t * p1.x + t2 * p2.x,
    y: oneMinusT2 * p0.y + 2 * oneMinusT * t * p1.y + t2 * p2.y
  };
}

/**
 * Get screen coordinates for a point on a bowed side at percentage t.
 * This is used in combinatorial mode where edges should start/end on the curved boundary.
 * @param {string} side - The side ('north', 'east', 'south', 'west')
 * @param {number} t - Parameter from 0 to 1 along the side
 * @param {number} bowAmount - How much the sides are bowed outward (default: DEFAULT_BOW_AMOUNT)
 */
export function getPointOnBowedSide(side, t, bowAmount = DEFAULT_BOW_AMOUNT) {
  const cp = getBowedRhombusControlPoints(bowAmount);
  
  switch (side) {
    case 'north':
      // North side: nw -> ne, control point is northMid
      return evaluateQuadraticBezier(cp.nw, cp.northMid, cp.ne, t);
    case 'east':
      // East side: se -> ne (south to north), control point is eastMid
      return evaluateQuadraticBezier(cp.se, cp.eastMid, cp.ne, t);
    case 'south':
      // South side: se -> sw, control point is southMid
      return evaluateQuadraticBezier(cp.se, cp.southMid, cp.sw, t);
    case 'west':
      // West side: nw -> sw (north to south), control point is westMid
      return evaluateQuadraticBezier(cp.nw, cp.westMid, cp.sw, t);
    default:
      throw new Error(`Unknown side: ${side}`);
  }
}

/**
 * Split a quadratic Bézier curve at parameter t using de Casteljau's algorithm.
 * Returns two sets of control points: one for the curve from 0 to t, and one for t to 1.
 * @param {Object} p0 - Start point { x, y }
 * @param {Object} p1 - Control point { x, y }
 * @param {Object} p2 - End point { x, y }
 * @param {number} t - Parameter at which to split (0 to 1)
 * @returns {Object} { left: { p0, p1, p2 }, right: { p0, p1, p2 } }
 */
function splitQuadraticBezier(p0, p1, p2, t) {
  // Linear interpolation helper
  const lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  
  // First level: points along p0-p1 and p1-p2
  const q0 = lerp(p0, p1, t);
  const q1 = lerp(p1, p2, t);
  
  // Second level: point on the curve at t
  const r = lerp(q0, q1, t);
  
  return {
    left: { p0: p0, p1: q0, p2: r },
    right: { p0: r, p1: q1, p2: p2 }
  };
}

/**
 * Extract a portion of a quadratic Bézier curve from t1 to t2.
 * @param {Object} p0 - Start point { x, y }
 * @param {Object} p1 - Control point { x, y }
 * @param {Object} p2 - End point { x, y }
 * @param {number} t1 - Start parameter (0 to 1)
 * @param {number} t2 - End parameter (0 to 1)
 * @returns {Object} { p0, p1, p2 } - Control points for the sub-curve
 */
function extractQuadraticBezierSegment(p0, p1, p2, t1, t2) {
  if (t1 >= t2) {
    // Degenerate case: return a point
    const pt = evaluateQuadraticBezier(p0, p1, p2, t1);
    return { p0: pt, p1: pt, p2: pt };
  }
  
  // First, split at t1 to get the right portion (t1 to 1)
  const split1 = splitQuadraticBezier(p0, p1, p2, t1);
  
  // Now we have a curve from t1 to 1
  // We need to extract from 0 to (t2-t1)/(1-t1) of this new curve
  const newT2 = (t2 - t1) / (1 - t1);
  
  // Split the right portion at newT2 to get the left portion (which is our segment)
  const split2 = splitQuadraticBezier(split1.right.p0, split1.right.p1, split1.right.p2, newT2);
  
  return split2.left;
}

/**
 * Get the control points (p0, p1, p2) for a bowed side.
 * @param {string} side - The side ('north', 'east', 'south', 'west')
 * @param {number} bowAmount - How much the sides are bowed outward
 * @returns {Object} { p0, p1, p2 } - Start, control, and end points
 */
function getBowedSideControlPoints(side, bowAmount = DEFAULT_BOW_AMOUNT) {
  const cp = getBowedRhombusControlPoints(bowAmount);
  
  switch (side) {
    case 'north':
      return { p0: cp.nw, p1: cp.northMid, p2: cp.ne };
    case 'east':
      return { p0: cp.se, p1: cp.eastMid, p2: cp.ne };
    case 'south':
      return { p0: cp.se, p1: cp.southMid, p2: cp.sw };
    case 'west':
      return { p0: cp.nw, p1: cp.westMid, p2: cp.sw };
    default:
      throw new Error(`Unknown side: ${side}`);
  }
}

/**
 * Get an SVG path string for a portion of a bowed side.
 * @param {string} side - The side ('north', 'east', 'south', 'west')
 * @param {number} t1 - Start parameter (0 to 1)
 * @param {number} t2 - End parameter (0 to 1)
 * @param {number} bowAmount - How much the sides are bowed outward
 * @returns {string} SVG path string (M ... Q ...)
 */
export function getBowedSideSegmentPath(side, t1, t2, bowAmount = DEFAULT_BOW_AMOUNT) {
  const sideCP = getBowedSideControlPoints(side, bowAmount);
  const segment = extractQuadraticBezierSegment(sideCP.p0, sideCP.p1, sideCP.p2, t1, t2);
  
  return `M ${segment.p0.x} ${segment.p0.y} Q ${segment.p1.x} ${segment.p1.y} ${segment.p2.x} ${segment.p2.y}`;
}

/**
 * Get SVG path for the rhombus outline with bowed (curved outward) sides.
 * This is used in combinatorial mode to better visualize edges from a side 
 * to the same side by creating visual space between the path and the boundary.
 * @param {number} bowAmount - How much to bow the sides outward in SVG units (default: 60).
 *                             This is in the same coordinate system as the rhombus SIZE (300 units).
 */
export function getBowedRhombusPath(bowAmount = DEFAULT_BOW_AMOUNT) {
  const cp = getBowedRhombusControlPoints(bowAmount);
  
  // Build path using quadratic bezier curves (Q command)
  const pathSegments = [
    `M ${cp.nw.x} ${cp.nw.y}`,
    `Q ${cp.northMid.x} ${cp.northMid.y} ${cp.ne.x} ${cp.ne.y}`,
    `Q ${cp.eastMid.x} ${cp.eastMid.y} ${cp.se.x} ${cp.se.y}`,
    `Q ${cp.southMid.x} ${cp.southMid.y} ${cp.sw.x} ${cp.sw.y}`,
    `Q ${cp.westMid.x} ${cp.westMid.y} ${cp.nw.x} ${cp.nw.y} Z`
  ];
  return pathSegments.join(' ');
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
