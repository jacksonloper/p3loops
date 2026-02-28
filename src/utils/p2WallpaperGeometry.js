/**
 * Geometry utilities for rendering the p2 wallpaper visualization.
 * 
 * The p2 wallpaper is created by "unfolding" the path as it travels through
 * the square boundaries. Each side is split at its midpoint into two half-sides
 * (zones). The two halves of each side are identified with reversed
 * parameterization, which is equivalent to a 180° rotation around the
 * side's midpoint.
 * 
 * When the path crosses any zone on a side, the square is rotated 180° around
 * the midpoint of that full side.
 * 
 * There are two copies of the fundamental domain per translation coordinate:
 * regular (r=0) and 180° flipped (r=1).
 * 
 * The TRUE square has:
 * - All four sides of equal length (SIDE = 300)
 * - NE corner at origin
 * - NW at (-SIDE, 0), SE at (0, SIDE), SW at (-SIDE, SIDE)
 * 
 * A reference frame is represented as a 2D affine transformation matrix:
 *   { a, b, c, d, tx, ty }
 * representing the transformation:
 *   x' = a*x + b*y + tx
 *   y' = c*x + d*y + ty
 */

const SIDE = 300;
const HALF = SIDE / 2;

// Square corners with NE at origin (matching p4WallpaperGeometry convention)
const NE_CORNER = { x: 0, y: 0 };
const NW_CORNER = { x: -SIDE, y: 0 };
const SE_CORNER = { x: 0, y: SIDE };
const SW_CORNER = { x: -SIDE, y: SIDE };

// Side midpoints
const N_MID = { x: -HALF, y: 0 };
const E_MID = { x: 0, y: HALF };
const S_MID = { x: -HALF, y: SIDE };
const W_MID = { x: -SIDE, y: HALF };

/**
 * Create an identity reference frame (no transformation).
 * @returns {{ a: number, b: number, c: number, d: number, tx: number, ty: number }}
 */
export function createIdentityFrame() {
  return { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 };
}

/**
 * Apply a reference frame transformation to a point.
 * @param {number} x - X coordinate in local screen space
 * @param {number} y - Y coordinate in local screen space
 * @param {{ a: number, b: number, c: number, d: number, tx: number, ty: number }} frame
 * @returns {{ x: number, y: number }}
 */
export function applyReferenceFrame(x, y, frame) {
  return {
    x: frame.a * x + frame.b * y + frame.tx,
    y: frame.c * x + frame.d * y + frame.ty
  };
}

/**
 * Compose two affine transformations: result = second ∘ first
 * @param {{ a: number, b: number, c: number, d: number, tx: number, ty: number }} first
 * @param {{ a: number, b: number, c: number, d: number, tx: number, ty: number }} second
 * @returns {{ a: number, b: number, c: number, d: number, tx: number, ty: number }}
 */
function composeTransformations(first, second) {
  return {
    a: second.a * first.a + second.b * first.c,
    b: second.a * first.b + second.b * first.d,
    c: second.c * first.a + second.d * first.c,
    d: second.c * first.b + second.d * first.d,
    tx: second.a * first.tx + second.b * first.ty + second.tx,
    ty: second.c * first.tx + second.d * first.ty + second.ty
  };
}

/**
 * Create a 180° rotation matrix around a center point.
 * @param {number} cx - Center X
 * @param {number} cy - Center Y
 * @returns {{ a: number, b: number, c: number, d: number, tx: number, ty: number }}
 */
function create180RotationAroundPoint(cx, cy) {
  // 180° rotation: cos(π) = -1, sin(π) = 0
  // x' = -x + 2*cx
  // y' = -y + 2*cy
  return {
    a: -1,
    b: 0,
    c: 0,
    d: -1,
    tx: 2 * cx,
    ty: 2 * cy
  };
}

/**
 * Get the full side name for a zone (which side the zone belongs to).
 * @param {string} zone - One of NNW, NNE, ENE, ESE, SSE, SSW, WSW, WNW
 * @returns {'north' | 'east' | 'south' | 'west'}
 */
export function getZoneSide(zone) {
  switch (zone) {
    case 'NNW': case 'NNE': return 'north';
    case 'ENE': case 'ESE': return 'east';
    case 'SSE': case 'SSW': return 'south';
    case 'WSW': case 'WNW': return 'west';
    default: throw new Error(`Unknown zone: ${zone}`);
  }
}

/**
 * Get the midpoint of a side in local square coordinates.
 * @param {'north' | 'east' | 'south' | 'west'} side
 * @returns {{ x: number, y: number }}
 */
function getSideMidpoint(side) {
  switch (side) {
    case 'north': return N_MID;
    case 'east': return E_MID;
    case 'south': return S_MID;
    case 'west': return W_MID;
    default: throw new Error(`Unknown side: ${side}`);
  }
}

/**
 * Update the reference frame when the path crosses a zone boundary.
 * For p2, crossing any zone on a side means rotating 180° around
 * the midpoint of that full side.
 * 
 * @param {string} zone - The zone being crossed (NNW, NNE, ENE, ESE, SSE, SSW, WSW, WNW)
 * @param {{ a: number, b: number, c: number, d: number, tx: number, ty: number }} currentFrame
 * @returns {{ a: number, b: number, c: number, d: number, tx: number, ty: number }}
 */
export function updateReferenceFrameForZone(zone, currentFrame) {
  const side = getZoneSide(zone);
  const localMid = getSideMidpoint(side);
  
  // Transform the midpoint to world space
  const worldMid = applyReferenceFrame(localMid.x, localMid.y, currentFrame);
  
  // Create 180° rotation around the world-space midpoint
  const rotation = create180RotationAroundPoint(worldMid.x, worldMid.y);
  
  // Compose: first apply currentFrame, then the rotation
  return composeTransformations(currentFrame, rotation);
}

/**
 * Get screen coordinates for a point specified as zone + t in the wallpaper square.
 * The wallpaper square has NE at origin: NW=(-300,0), NE=(0,0), SE=(0,300), SW=(-300,300).
 * 
 * @param {string} zone - Zone name (NNW, NNE, etc.)
 * @param {number} t - Parameter along the zone [0, 1]
 * @returns {{ x: number, y: number }}
 */
export function getPointInZoneWallpaper(zone, t) {
  switch (zone) {
    case 'NNW': // NW corner (-SIDE,0) → N midpoint (-HALF,0)
      return { x: -SIDE + t * HALF, y: 0 };
    case 'NNE': // N midpoint (-HALF,0) → NE corner (0,0)
      return { x: -HALF + t * HALF, y: 0 };
    case 'ENE': // NE corner (0,0) → E midpoint (0,HALF)
      return { x: 0, y: t * HALF };
    case 'ESE': // E midpoint (0,HALF) → SE corner (0,SIDE)
      return { x: 0, y: HALF + t * HALF };
    case 'SSE': // SE corner (0,SIDE) → S midpoint (-HALF,SIDE)
      return { x: -t * HALF, y: SIDE };
    case 'SSW': // S midpoint (-HALF,SIDE) → SW corner (-SIDE,SIDE)
      return { x: -HALF - t * HALF, y: SIDE };
    case 'WSW': // SW corner (-SIDE,SIDE) → W midpoint (-SIDE,HALF)
      return { x: -SIDE, y: SIDE - t * HALF };
    case 'WNW': // W midpoint (-SIDE,HALF) → NW corner (-SIDE,0)
      return { x: -SIDE, y: HALF - t * HALF };
    default:
      throw new Error(`Unknown zone: ${zone}`);
  }
}

/**
 * Convert a zone/t point to screen coordinates using a reference frame.
 * 
 * @param {{ zone: string, t: number }} point - Point with zone and t
 * @param {{ a: number, b: number, c: number, d: number, tx: number, ty: number }} frame
 * @returns {{ x: number, y: number }}
 */
export function pointToScreenSpace(point, frame) {
  const local = getPointInZoneWallpaper(point.zone, point.t);
  return applyReferenceFrame(local.x, local.y, frame);
}

/**
 * Get a curved edge path (quadratic Bézier) between two zone/t points.
 * The control point is pulled toward the center of the square.
 * 
 * @param {{ zone: string, t: number }} from
 * @param {{ zone: string, t: number }} to
 * @param {{ a: number, b: number, c: number, d: number, tx: number, ty: number }} frame
 * @returns {string} SVG path string
 */
export function getCurvedEdgePathWallpaper(from, to, frame) {
  const p0Local = getPointInZoneWallpaper(from.zone, from.t);
  const p1Local = getPointInZoneWallpaper(to.zone, to.t);
  
  // Control point: midpoint pulled toward center
  const cx = -HALF; // center of wallpaper square
  const cy = HALF;
  const midX = (p0Local.x + p1Local.x) / 2;
  const midY = (p0Local.y + p1Local.y) / 2;
  const pullFactor = 0.3;
  const ctrlX = midX + (cx - midX) * pullFactor;
  const ctrlY = midY + (cy - midY) * pullFactor;
  
  // Sample points along the quadratic Bézier for transformation
  const numSamples = 20;
  const points = [];
  for (let i = 0; i <= numSamples; i++) {
    const s = i / numSamples;
    const x = (1 - s) * (1 - s) * p0Local.x + 2 * (1 - s) * s * ctrlX + s * s * p1Local.x;
    const y = (1 - s) * (1 - s) * p0Local.y + 2 * (1 - s) * s * ctrlY + s * s * p1Local.y;
    points.push(applyReferenceFrame(x, y, frame));
  }
  
  if (points.length < 2) return '';
  
  let path = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    path += ` L ${points[i].x} ${points[i].y}`;
  }
  return path;
}

// ============================================================================
// P2 WALLPAPER INDEX
// ============================================================================

/**
 * @typedef {Object} P2WallpaperIndex
 * @property {number} tx - Translation in first direction
 * @property {number} ty - Translation in second direction
 * @property {number} r - Rotation index: 0 or 1 (for 0° and 180°)
 */

/**
 * Create the identity wallpaper index.
 * @returns {P2WallpaperIndex}
 */
export function createIdentityWallpaperIndex() {
  return { tx: 0, ty: 0, r: 0 };
}

/**
 * Update the wallpaper index when crossing through a zone.
 * 
 * Translation lattice vectors: T1 = (SIDE, SIDE), T2 = (SIDE, -SIDE)
 * Two copies per lattice point: r=0 (identity) and r=1 (180° rotated)
 * 
 * From r=0:
 *   north: (i,j,0) → (i-1, j, 1)
 *   east:  (i,j,0) → (i, j, 1)
 *   south: (i,j,0) → (i, j-1, 1)
 *   west:  (i,j,0) → (i-1, j-1, 1)
 * 
 * From r=1:
 *   north: (i,j,1) → (i+1, j, 0)
 *   east:  (i,j,1) → (i, j, 0)
 *   south: (i,j,1) → (i, j+1, 0)
 *   west:  (i,j,1) → (i+1, j+1, 0)
 * 
 * @param {string} zone - Zone being crossed
 * @param {P2WallpaperIndex} current - Current index
 * @returns {P2WallpaperIndex}
 */
export function updateWallpaperIndex(zone, current) {
  const { tx: i, ty: j, r: k } = current;
  const side = getZoneSide(zone);
  
  if (k === 0) {
    switch (side) {
      case 'north': return { tx: i - 1, ty: j, r: 1 };
      case 'east':  return { tx: i, ty: j, r: 1 };
      case 'south': return { tx: i, ty: j - 1, r: 1 };
      case 'west':  return { tx: i - 1, ty: j - 1, r: 1 };
      default: throw new Error(`Unknown side: ${side}`);
    }
  } else {
    switch (side) {
      case 'north': return { tx: i + 1, ty: j, r: 0 };
      case 'east':  return { tx: i, ty: j, r: 0 };
      case 'south': return { tx: i, ty: j + 1, r: 0 };
      case 'west':  return { tx: i + 1, ty: j + 1, r: 0 };
      default: throw new Error(`Unknown side: ${side}`);
    }
  }
}

/**
 * Format a wallpaper index as a string.
 * @param {P2WallpaperIndex} index
 * @returns {string}
 */
export function formatWallpaperIndex(index) {
  const rotLabel = index.r === 0 ? '0°' : '180°';
  return `(${index.tx}, ${index.ty}, ${rotLabel})`;
}

/**
 * Convert a wallpaper index to an affine frame.
 * 
 * r=0: {a:1, b:0, c:0, d:1, tx: (i+j)*SIDE, ty: (i-j)*SIDE}
 * r=1: {a:-1, b:0, c:0, d:-1, tx: (i+j)*SIDE, ty: (1+i-j)*SIDE}
 * 
 * @param {P2WallpaperIndex} index
 * @returns {{ a: number, b: number, c: number, d: number, tx: number, ty: number }}
 */
export function indexToFrame(index) {
  const { tx: i, ty: j, r: k } = index;
  
  if (k === 0) {
    return {
      a: 1,
      b: 0,
      c: 0,
      d: 1,
      tx: (i + j) * SIDE,
      ty: (i - j) * SIDE
    };
  } else {
    return {
      a: -1,
      b: 0,
      c: 0,
      d: -1,
      tx: (i + j) * SIDE,
      ty: (1 + i - j) * SIDE
    };
  }
}

// Export constants for testing and external use
export { NE_CORNER, NW_CORNER, SE_CORNER, SW_CORNER, SIDE, HALF, N_MID, E_MID, S_MID, W_MID };
