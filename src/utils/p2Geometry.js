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

/**
 * Get a curved edge path between two zone-parameterized points.
 * Uses a quadratic bezier that bows inward toward the center.
 */
export function getCurvedEdgePath(fromZone, fromT, toZone, toT) {
  const p0 = getPointInZone(fromZone, fromT);
  const p1 = getPointInZone(toZone, toT);

  const midX = (p0.x + p1.x) / 2;
  const midY = (p0.y + p1.y) / 2;

  // Pull control point toward center
  const cx = SIZE / 2;
  const cy = SIZE / 2;
  const pullFactor = 0.3;
  const ctrlX = midX + (cx - midX) * pullFactor;
  const ctrlY = midY + (cy - midY) * pullFactor;

  const pathD = `M ${p0.x} ${p0.y} Q ${ctrlX} ${ctrlY} ${p1.x} ${p1.y}`;

  // Midpoint of the quadratic bezier (at t=0.5)
  const bezMidX = 0.25 * p0.x + 0.5 * ctrlX + 0.25 * p1.x;
  const bezMidY = 0.25 * p0.y + 0.5 * ctrlY + 0.25 * p1.y;

  // Angle at midpoint
  const dx = p1.x - p0.x;
  const dy = p1.y - p0.y;
  const angle = Math.atan2(dy, dx) * 180 / Math.PI;

  return {
    pathD,
    midPoint: { x: bezMidX, y: bezMidY },
    angle
  };
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
