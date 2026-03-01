/**
 * Geometry utilities for the p2 square.
 *
 * The fundamental domain is a square. Each side is divided at its midpoint
 * into two half-sides (zones). The two halves of each side are identified
 * with reversed parameterization.
 *
 * Zones and their parameterization (t goes from 0 to 1 within each half-side):
 *   NNW: NW corner → N midpoint
 *   NNE: N midpoint → NE corner
 *   ENE: NE corner → E midpoint
 *   ESE: E midpoint → SE corner
 *   SSE: SE corner → S midpoint
 *   SSW: S midpoint → SW corner
 *   WSW: SW corner → W midpoint
 *   WNW: W midpoint → NW corner
 *
 * Identifications (adjacent half-sides, reversed):
 *   NNW ≡ NNE, ENE ≡ ESE, SSE ≡ SSW, WSW ≡ WNW
 *
 * All four corners are identified as the same point.
 */

const SIZE = 300;
const HALF = SIZE / 2;

/**
 * Get the size of the square.
 */
export function getSize() {
  return SIZE;
}

/**
 * Get screen coordinates for a point in a zone at parameter t ∈ [0, 1].
 *
 * The square has corners:
 *   NW = (0, 0)       NE = (SIZE, 0)
 *   SW = (0, SIZE)    SE = (SIZE, SIZE)
 *
 * Midpoints:
 *   N mid = (HALF, 0)
 *   E mid = (SIZE, HALF)
 *   S mid = (HALF, SIZE)
 *   W mid = (0, HALF)
 */
export function getPointInZone(zone, t) {
  switch (zone) {
    case 'NNW': // NW corner (0,0) → N mid (HALF,0)
      return { x: t * HALF, y: 0 };
    case 'NNE': // N mid (HALF,0) → NE corner (SIZE,0)
      return { x: HALF + t * HALF, y: 0 };
    case 'ENE': // NE corner (SIZE,0) → E mid (SIZE,HALF)
      return { x: SIZE, y: t * HALF };
    case 'ESE': // E mid (SIZE,HALF) → SE corner (SIZE,SIZE)
      return { x: SIZE, y: HALF + t * HALF };
    case 'SSE': // SE corner (SIZE,SIZE) → S mid (HALF,SIZE)
      return { x: SIZE - t * HALF, y: SIZE };
    case 'SSW': // S mid (HALF,SIZE) → SW corner (0,SIZE)
      return { x: HALF - t * HALF, y: SIZE };
    case 'WSW': // SW corner (0,SIZE) → W mid (0,HALF)
      return { x: 0, y: SIZE - t * HALF };
    case 'WNW': // W mid (0,HALF) → NW corner (0,0)
      return { x: 0, y: HALF - t * HALF };
    default:
      throw new Error(`Unknown zone: ${zone}`);
  }
}

/**
 * Get the outline path for the square.
 */
export function getOutlinePath() {
  return `M 0 0 L ${SIZE} 0 L ${SIZE} ${SIZE} L 0 ${SIZE} Z`;
}

/**
 * Get an SVG path along a zone from parameter t0 to t1.
 */
export function getZoneSegmentPath(zone, t0, t1) {
  const p0 = getPointInZone(zone, t0);
  const p1 = getPointInZone(zone, t1);
  return `M ${p0.x} ${p0.y} L ${p1.x} ${p1.y}`;
}

// ============================================================================
// DIFFEOMORPHISM-BASED EDGE RENDERING
// ============================================================================
// This approach guarantees non-intersecting edges by construction:
// 1. Map boundary points to points on a unit circle (via square-to-disk mapping)
// 2. Draw straight chords in the disk (chords with non-overlapping endpoints don't intersect)
// 3. Map the chord back to the square using the inverse (disk-to-square) mapping
// ============================================================================

// Configuration for edge path generation
const EDGE_PATH_SAMPLES = 80;
const EDGE_PATH_KNOT_STEP = 8;
const ENDPOINT_EPSILON = 1e-6;

/**
 * Map a point in the square [-1,1]² to the unit disk.
 * Uses the elliptical grid mapping (Shirley-Chiu style).
 */
function squareToDisk(x, y) {
  const u = x * Math.sqrt(Math.max(1 - (y * y) / 2, 0));
  const v = y * Math.sqrt(Math.max(1 - (x * x) / 2, 0));
  return [u, v];
}

/**
 * Map a point in the unit disk to the square [-1,1]².
 * Inverse of squareToDisk using nested radicals.
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

/**
 * Get the point on the [-1,1]² boundary for a zone at parameter t.
 * Maps zone parameterization to the canonical square boundary.
 *
 * Screen coords: NW=(0,0), NE=(SIZE,0), SE=(SIZE,SIZE), SW=(0,SIZE)
 * Canonical square: NW=(-1,1), NE=(1,1), SE=(1,-1), SW=(-1,-1)
 */
function zoneToBoundaryPoint(zone, t) {
  switch (zone) {
    case 'NNW': return [-1 + t, 1];      // NW(-1,1) → N mid(0,1)
    case 'NNE': return [t, 1];            // N mid(0,1) → NE(1,1)
    case 'ENE': return [1, 1 - t];        // NE(1,1) → E mid(1,0)
    case 'ESE': return [1, -t];           // E mid(1,0) → SE(1,-1)
    case 'SSE': return [1 - t, -1];       // SE(1,-1) → S mid(0,-1)
    case 'SSW': return [-t, -1];          // S mid(0,-1) → SW(-1,-1)
    case 'WSW': return [-1, -1 + t];      // SW(-1,-1) → W mid(-1,0)
    case 'WNW': return [-1, t];           // W mid(-1,0) → NW(-1,1)
    default: throw new Error(`Unknown zone: ${zone}`);
  }
}

/**
 * Map a zone boundary point to the unit circle.
 */
function boundaryToDisk(zone, t) {
  const [x, y] = zoneToBoundaryPoint(zone, t);
  let [u, v] = squareToDisk(x, y);
  const r = Math.hypot(u, v) || 1;
  u /= r;
  v /= r;
  return [u, v];
}

/**
 * Convert a point from [-1,1]² to screen coordinates.
 */
function canonicalToScreen(x, y) {
  return {
    x: (x + 1) * HALF,
    y: (1 - y) * HALF
  };
}

/**
 * Convert a point from [-1,1]² to unit square coordinates [0,1]².
 * x_unit = eastward, y_unit = southward.
 */
function canonicalToUnitSquare(x, y) {
  return {
    x: (x + 1) / 2,
    y: (1 - y) / 2
  };
}

/**
 * Sample points along a chord in the disk and map them back to the square.
 * Returns points in [-1,1]² coordinates.
 */
function chordImagePoints(fromZone, fromT, toZone, toT, nSamples) {
  const [u1, v1] = boundaryToDisk(fromZone, fromT);
  const [u2, v2] = boundaryToDisk(toZone, toT);

  const pts = [];
  for (let i = 0; i < nSamples; i++) {
    let t = i / (nSamples - 1);
    if (i === 0) t = ENDPOINT_EPSILON;
    if (i === nSamples - 1) t = 1 - ENDPOINT_EPSILON;

    const u = (1 - t) * u1 + t * u2;
    const v = (1 - t) * v1 + t * v2;
    pts.push(diskToSquare(u, v));
  }
  return pts;
}

/**
 * Convert a sequence of points to cubic Bézier segments using Catmull-Rom interpolation.
 */
function catmullRomToBeziers(P) {
  if (P.length < 2) return [];

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

/**
 * Get a curved edge path between two zone-parameterized points.
 * Uses the diffeomorphism approach: chord in disk mapped to square via
 * the elliptical grid inverse, guaranteeing non-intersection.
 */
export function getCurvedEdgePath(fromZone, fromT, toZone, toT) {
  const pts = chordImagePoints(fromZone, fromT, toZone, toT, EDGE_PATH_SAMPLES);

  // Select knots for the spline
  const knots = [];
  for (let i = 0; i < pts.length; i += EDGE_PATH_KNOT_STEP) {
    knots.push(pts[i]);
  }
  const lastPt = pts[pts.length - 1];
  const lastKnot = knots[knots.length - 1];
  if (!lastKnot || lastKnot[0] !== lastPt[0] || lastKnot[1] !== lastPt[1]) {
    knots.push(lastPt);
  }

  const segs = catmullRomToBeziers(knots);

  if (segs.length === 0) {
    const from = getPointInZone(fromZone, fromT);
    const to = getPointInZone(toZone, toT);
    const midX = (from.x + to.x) / 2;
    const midY = (from.y + to.y) / 2;
    const angle = Math.atan2(to.y - from.y, to.x - from.x) * (180 / Math.PI);
    return {
      pathD: `M ${from.x} ${from.y} L ${to.x} ${to.y}`,
      midPoint: { x: midX, y: midY },
      angle
    };
  }

  // Build SVG path in screen coordinates
  const firstScreen = canonicalToScreen(segs[0].p1[0], segs[0].p1[1]);
  let d = `M ${firstScreen.x} ${firstScreen.y}`;

  for (const seg of segs) {
    const c1 = canonicalToScreen(seg.c1[0], seg.c1[1]);
    const c2 = canonicalToScreen(seg.c2[0], seg.c2[1]);
    const p2 = canonicalToScreen(seg.p2[0], seg.p2[1]);
    d += ` C ${c1.x} ${c1.y} ${c2.x} ${c2.y} ${p2.x} ${p2.y}`;
  }

  // Calculate midpoint
  const midIdx = Math.floor(pts.length / 2);
  const midScreen = canonicalToScreen(pts[midIdx][0], pts[midIdx][1]);

  // Calculate angle at midpoint
  const prevIdx = Math.max(0, midIdx - 1);
  const nextIdx = Math.min(pts.length - 1, midIdx + 1);
  const prev = canonicalToScreen(pts[prevIdx][0], pts[prevIdx][1]);
  const next = canonicalToScreen(pts[nextIdx][0], pts[nextIdx][1]);
  const angle = Math.atan2(next.y - prev.y, next.x - prev.x) * (180 / Math.PI);

  return {
    pathD: d,
    midPoint: { x: midScreen.x, y: midScreen.y },
    angle
  };
}

/**
 * Get sampled points along an edge using the diffeomorphism approach.
 * Returns points in unit square coordinates (x=eastward, y=southward)
 * for use in wallpaper and 3D visualization.
 */
export function getEdgeSamplePoints(fromZone, fromT, toZone, toT, numSamples = 20) {
  const [u1, v1] = boundaryToDisk(fromZone, fromT);
  const [u2, v2] = boundaryToDisk(toZone, toT);

  const points = [];
  for (let i = 0; i < numSamples; i++) {
    let t = i / (numSamples - 1);
    if (i === 0) t = ENDPOINT_EPSILON;
    if (i === numSamples - 1) t = 1 - ENDPOINT_EPSILON;

    const u = (1 - t) * u1 + t * u2;
    const v = (1 - t) * v1 + t * v2;

    const [x, y] = diskToSquare(u, v);
    points.push(canonicalToUnitSquare(x, y));
  }
  return points;
}

/**
 * Get corner positions.
 */
export function getCorners() {
  return {
    nw: { x: 0, y: 0 },
    ne: { x: SIZE, y: 0 },
    se: { x: SIZE, y: SIZE },
    sw: { x: 0, y: SIZE }
  };
}

/**
 * Get midpoint positions.
 */
export function getMidpoints() {
  return {
    n: { x: HALF, y: 0 },
    e: { x: SIZE, y: HALF },
    s: { x: HALF, y: SIZE },
    w: { x: 0, y: HALF }
  };
}
