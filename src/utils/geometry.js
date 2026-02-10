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
 * @private
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
 * Get SVG path for the rhombus outline with straight sides (true rhombus).
 * @returns {string} SVG path string
 */
export function getStraightRhombusPath() {
  const nw = unitSquareToRhombus(0, 0);
  const ne = unitSquareToRhombus(0, 1);
  const se = unitSquareToRhombus(1, 1);
  const sw = unitSquareToRhombus(1, 0);
  
  return `M ${nw.x} ${nw.y} L ${ne.x} ${ne.y} L ${se.x} ${se.y} L ${sw.x} ${sw.y} Z`;
}

/**
 * Get an SVG path string for a portion of a straight side.
 * @param {string} side - The side ('north', 'east', 'south', 'west')
 * @param {number} t1 - Start parameter (0 to 1)
 * @param {number} t2 - End parameter (0 to 1)
 * @returns {string} SVG path string (M ... L ...)
 */
export function getStraightSideSegmentPath(side, t1, t2) {
  const start = getPointOnSide(side, t1);
  const end = getPointOnSide(side, t2);
  return `M ${start.x} ${start.y} L ${end.x} ${end.y}`;
}

// ============================================================================
// DIFFEOMORPHISM-BASED EDGE RENDERING
// ============================================================================
// This approach guarantees non-intersecting edges by construction:
// 1. Map boundary points to points on a unit circle
// 2. Draw straight chords in the disk (chords with non-overlapping endpoints don't intersect)
// 3. Map the chord back to the rhombus using a diffeomorphism
// ============================================================================

const SQRT3 = Math.sqrt(3);

// Rhombus vertices in normalized coordinates (will be scaled to screen coords)
// This is a left-slanted 60/120 degree rhombus
const RHOMBUS_VERTICES = [
  [-3/4,  SQRT3/4],  // vertex 0 (NW-ish)
  [-1/4, -SQRT3/4],  // vertex 1 (SW-ish)
  [ 3/4, -SQRT3/4],  // vertex 2 (SE-ish)
  [ 1/4,  SQRT3/4],  // vertex 3 (NE-ish)
];

// Configuration for edge path generation
const EDGE_PATH_SAMPLES = 80;     // Number of points to sample along the chord
const EDGE_PATH_KNOT_STEP = 8;    // Keep every Nth point as a spline knot
const ENDPOINT_EPSILON = 1e-6;    // Small offset to avoid exact endpoints for numerical stability

/**
 * Linear interpolation helper.
 */
function lerp(a, b, t) {
  return a + (b - a) * t;
}

/**
 * Get a point on the rhombus boundary in normalized coordinates.
 * Side 0: vertex 0 → vertex 1 (west side, maps to 'west')
 * Side 1: vertex 1 → vertex 2 (south side, maps to 'south')
 * Side 2: vertex 2 → vertex 3 (east side, maps to 'east')
 * Side 3: vertex 3 → vertex 0 (north side, maps to 'north')
 * @param {number} sideIndex - Side index (0-3)
 * @param {number} s - Parameter from 0 to 1 along the side
 * @returns {number[]} [x, y] in normalized coordinates
 */
function pointOnRhombusSide(sideIndex, s) {
  const i = ((sideIndex % 4) + 4) % 4;
  const a = RHOMBUS_VERTICES[i];
  const b = RHOMBUS_VERTICES[(i + 1) % 4];
  return [lerp(a[0], b[0], s), lerp(a[1], b[1], s)];
}

/**
 * Convert side name to side index for the diffeomorphism.
 * The mapping accounts for direction differences:
 * - north: goes west→east (t=0 at NW, t=1 at NE) → side 3 reversed
 * - east: goes south→north (t=0 at SE, t=1 at NE) → side 2 reversed
 * - south: goes east→west (t=0 at SE, t=1 at SW) → side 1 reversed
 * - west: goes north→south (t=0 at NW, t=1 at SW) → side 0
 */
function sideNameToIndexAndT(side, t) {
  switch (side) {
    case 'north':
      // North: NW (vertex 0) to NE (vertex 3) = side 3 reversed
      return { sideIndex: 3, s: 1 - t };
    case 'east':
      // East: SE (vertex 2) to NE (vertex 3) = side 2
      return { sideIndex: 2, s: t };
    case 'south':
      // South: SE (vertex 2) to SW (vertex 1) = side 1 reversed  
      return { sideIndex: 1, s: 1 - t };
    case 'west':
      // West: NW (vertex 0) to SW (vertex 1) = side 0
      return { sideIndex: 0, s: t };
    default:
      throw new Error(`Unknown side: ${side}`);
  }
}

// ---------- Square ↔ Disk (Elliptical Grid) Transformations ----------

/**
 * Map a point in the square [-1,1]² to the unit disk.
 * Uses the elliptical grid mapping (Shirley-Chiu style).
 * @param {number} x - x coordinate in [-1, 1]
 * @param {number} y - y coordinate in [-1, 1]
 * @returns {number[]} [u, v] in unit disk
 */
function squareToDisk(x, y) {
  const u = x * Math.sqrt(Math.max(1 - (y * y) / 2, 0));
  const v = y * Math.sqrt(Math.max(1 - (x * x) / 2, 0));
  return [u, v];
}

/**
 * Map a point in the unit disk to the square [-1,1]².
 * Inverse of squareToDisk using nested radicals.
 * @param {number} u - u coordinate in unit disk
 * @param {number} v - v coordinate in unit disk
 * @returns {number[]} [x, y] in [-1, 1]²
 */
function diskToSquare(u, v) {
  const A = 2 - v * v + u * u;
  const B = 2 - u * u + v * v;

  const discA = Math.max(A * A - 8 * u * u, 0);
  const discB = Math.max(B * B - 8 * v * v, 0);

  const x2 = Math.max((A - Math.sqrt(discA)) / 2, 0);
  const y2 = Math.max((B - Math.sqrt(discB)) / 2, 0);

  const x = Math.sign(u) * Math.sqrt(x2);
  const y = Math.sign(v) * Math.sqrt(y2);
  return [x, y];
}

// ---------- Linear Square ↔ Rhombus Transformations ----------

/**
 * Map a point from the square (-1,1)² to the rhombus interior.
 * Uses the left-slanted rhombus geometry.
 * @param {number} x - x coordinate in (-1, 1)
 * @param {number} y - y coordinate in (-1, 1)
 * @returns {number[]} [X, Y] in normalized rhombus coordinates
 */
function squareToRhombus(x, y) {
  // Left-slanted rhombus transformation
  const X = -(0.5 * x + 0.25 * y);
  const Y = (SQRT3 / 4) * y;
  return [X, Y];
}

/**
 * Map a point from the rhombus to the square (-1,1)².
 * Inverse of squareToRhombus.
 * @param {number} X - X coordinate in rhombus
 * @param {number} Y - Y coordinate in rhombus
 * @returns {number[]} [x, y] in (-1, 1)²
 */
function rhombusToSquare(X, Y) {
  const y = (4 / SQRT3) * Y;
  const x = -2 * X - 0.5 * y;
  return [x, y];
}

// ---------- Boundary ↔ Disk Mapping ----------

/**
 * Map a point on the rhombus boundary to a point on the unit circle.
 * @param {number} sideIndex - Side index (0-3)
 * @param {number} s - Parameter from 0 to 1 along the side
 * @returns {number[]} [u, v] on unit circle
 */
function boundaryToDisk(sideIndex, s) {
  const [X, Y] = pointOnRhombusSide(sideIndex, s);
  const [x, y] = rhombusToSquare(X, Y);
  let [u, v] = squareToDisk(x, y);

  // Normalize to unit circle to reduce numeric drift
  const r = Math.hypot(u, v) || 1;
  u /= r;
  v /= r;
  return [u, v];
}

// ---------- Disk → Rhombus Diffeomorphism ----------

/**
 * Map a point from the unit disk to the rhombus interior.
 * This is the key diffeomorphism that preserves non-intersection of chords.
 * @param {number} u - u coordinate in unit disk
 * @param {number} v - v coordinate in unit disk
 * @returns {number[]} [X, Y] in normalized rhombus coordinates
 */
function diskToRhombus(u, v) {
  const [x, y] = diskToSquare(u, v);
  return squareToRhombus(x, y);
}

// ---------- Chord Sampling ----------

/**
 * Sample points along a chord in the disk and map them to the rhombus.
 * @param {Object} start - Start point { sideIndex, s }
 * @param {Object} end - End point { sideIndex, s }
 * @param {number} nSamples - Number of samples along the chord
 * @returns {number[][]} Array of [X, Y] points in normalized rhombus coords
 */
function chordImagePoints(start, end, nSamples) {
  const [u1, v1] = boundaryToDisk(start.sideIndex, start.s);
  const [u2, v2] = boundaryToDisk(end.sideIndex, end.s);

  const pts = [];
  for (let i = 0; i < nSamples; i++) {
    let t = i / (nSamples - 1);

    // Avoid exact endpoints (on unit circle) for stability in nested radicals
    if (i === 0) t = ENDPOINT_EPSILON;
    if (i === nSamples - 1) t = 1 - ENDPOINT_EPSILON;

    const u = (1 - t) * u1 + t * u2;
    const v = (1 - t) * v1 + t * v2;

    pts.push(diskToRhombus(u, v));
  }
  return pts;
}

// ---------- Catmull-Rom → Cubic Bézier Conversion ----------

/**
 * Convert a sequence of points to cubic Bézier segments using Catmull-Rom interpolation.
 * @param {number[][]} P - Array of [x, y] points
 * @returns {Object[]} Array of { p1, c1, c2, p2 } Bézier segment control points
 */
function catmullRomToBeziers(P) {
  if (P.length < 2) return [];

  // Pad endpoints for tangent estimation
  const Pm1 = [2 * P[0][0] - P[1][0], 2 * P[0][1] - P[1][1]];
  const Pp1 = [2 * P[P.length - 1][0] - P[P.length - 2][0], 2 * P[P.length - 1][1] - P[P.length - 2][1]];
  const Q = [Pm1, ...P, Pp1];

  const segs = [];
  for (let i = 1; i < P.length; i++) {
    const p0 = Q[i - 1], p1 = Q[i], p2 = Q[i + 1], p3 = Q[i + 2];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    segs.push({ p1, c1, c2, p2 });
  }
  return segs;
}

// ---------- Coordinate Transformation ----------

// Transformation constants to convert normalized rhombus coords to screen coords
// These were computed analytically to match the existing unitSquareToRhombus mapping
const NORM_TO_SCREEN_A = SIZE;  // X coefficient for normalized X
const NORM_TO_SCREEN_B = (-HALF_SHEAR + SIZE / 4) * 4 / SQRT3;  // X coefficient for normalized Y
const NORM_TO_SCREEN_C = SIZE / 2;  // X offset
const NORM_TO_SCREEN_E = -SIZE / 2 * 4 / SQRT3;  // Y coefficient for normalized Y
const NORM_TO_SCREEN_F = SIZE / 2;  // Y offset

/**
 * Convert normalized rhombus coordinates to screen coordinates.
 * The transformation is computed to exactly match the existing coordinate system.
 * @param {number} X - X in normalized coords
 * @param {number} Y - Y in normalized coords
 * @returns {Object} { x, y } screen coordinates
 */
function normalizedToScreen(X, Y) {
  return {
    x: NORM_TO_SCREEN_A * X + NORM_TO_SCREEN_B * Y + NORM_TO_SCREEN_C,
    y: NORM_TO_SCREEN_E * Y + NORM_TO_SCREEN_F
  };
}

/**
 * Create a curved edge path using the diffeomorphism approach.
 * This guarantees non-intersection by construction: chords in the disk
 * that share no interior points won't intersect, and the diffeomorphism
 * preserves this property.
 * 
 * @param {string} fromSide - Starting side ('north', 'east', 'south', 'west')
 * @param {number} fromT - Parameter (0 to 1) along the starting side
 * @param {string} toSide - Ending side ('north', 'east', 'south', 'west')
 * @param {number} toT - Parameter (0 to 1) along the ending side
 * @returns {Object} { pathD: string, midPoint: { x, y }, angle: number }
 */
export function getCurvedEdgePath(fromSide, fromT, toSide, toT) {
  // Convert side names to side indices
  const start = sideNameToIndexAndT(fromSide, fromT);
  const end = sideNameToIndexAndT(toSide, toT);
  
  // Sample points along the chord in the disk, mapped to the rhombus
  const pts = chordImagePoints(start, end, EDGE_PATH_SAMPLES);
  
  // Select knots for the spline (reduce to manageable number of Bézier segments)
  // We take every EDGE_PATH_KNOT_STEP-th point, plus always include the last point
  // to ensure the curve reaches the endpoint. Having slightly uneven spacing
  // near the end is acceptable as Catmull-Rom handles it smoothly.
  const knots = [];
  for (let i = 0; i < pts.length; i += EDGE_PATH_KNOT_STEP) {
    knots.push(pts[i]);
  }
  // Always include the last point to ensure we reach the endpoint
  const lastPt = pts[pts.length - 1];
  const lastKnot = knots[knots.length - 1];
  if (!lastKnot || lastKnot[0] !== lastPt[0] || lastKnot[1] !== lastPt[1]) {
    knots.push(lastPt);
  }
  
  // Convert to Bézier segments
  const segs = catmullRomToBeziers(knots);
  
  if (segs.length === 0) {
    // Degenerate case: just return a straight line
    const from = getPointOnSide(fromSide, fromT);
    const to = getPointOnSide(toSide, toT);
    const midX = (from.x + to.x) / 2;
    const midY = (from.y + to.y) / 2;
    const angle = Math.atan2(to.y - from.y, to.x - from.x) * (180 / Math.PI);
    return {
      pathD: `M ${from.x} ${from.y} L ${to.x} ${to.y}`,
      midPoint: { x: midX, y: midY },
      angle
    };
  }
  
  // Build SVG path string with cubic Bézier curves
  const firstScreen = normalizedToScreen(segs[0].p1[0], segs[0].p1[1]);
  let d = `M ${firstScreen.x} ${firstScreen.y}`;
  
  for (const seg of segs) {
    const c1 = normalizedToScreen(seg.c1[0], seg.c1[1]);
    const c2 = normalizedToScreen(seg.c2[0], seg.c2[1]);
    const p2 = normalizedToScreen(seg.p2[0], seg.p2[1]);
    d += ` C ${c1.x} ${c1.y} ${c2.x} ${c2.y} ${p2.x} ${p2.y}`;
  }
  
  // Calculate midpoint (approximately at the middle of the path)
  const midIdx = Math.floor(pts.length / 2);
  const midNorm = pts[midIdx];
  const midScreen = normalizedToScreen(midNorm[0], midNorm[1]);
  
  // Calculate angle at midpoint (using neighboring points for tangent)
  const prevIdx = Math.max(0, midIdx - 1);
  const nextIdx = Math.min(pts.length - 1, midIdx + 1);
  const prev = normalizedToScreen(pts[prevIdx][0], pts[prevIdx][1]);
  const next = normalizedToScreen(pts[nextIdx][0], pts[nextIdx][1]);
  const angle = Math.atan2(next.y - prev.y, next.x - prev.x) * (180 / Math.PI);
  
  return {
    pathD: d,
    midPoint: { x: midScreen.x, y: midScreen.y },
    angle
  };
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
