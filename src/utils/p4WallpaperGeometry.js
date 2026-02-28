/**
 * Geometry utilities for rendering the p4 wallpaper visualization.
 * 
 * The p4 wallpaper is created by "unfolding" the path as it travels through
 * the square boundaries. Each time the path crosses a boundary, the square
 * is rotated around one of the 90° corners (NE or SW).
 * 
 * IMPORTANT: For proper p4 symmetry with 90° rotations, we need a TRUE square 
 * with equal side lengths and 90° angles at all corners.
 * 
 * The TRUE square has:
 * - All four sides of equal length
 * - 90° angles at all corners
 * 
 * Rotation rules (to match north↔east and south↔west identifications):
 * - North wall: 90° clockwise around NE corner
 * - East wall: 90° counter-clockwise around NE corner  
 * - South wall: 90° clockwise around SW corner
 * - West wall: 90° counter-clockwise around SW corner
 * 
 * A reference frame is represented as a 2D affine transformation matrix:
 *   { a, b, c, d, tx, ty }
 * representing the transformation:
 *   x' = a*x + b*y + tx
 *   y' = c*x + d*y + ty
 */

import { getPointPaperCoordinates, getIdentifiedSide, isInteriorPoint, EPSILON } from './geometry.js';

// ============================================================================
// TRUE SQUARE GEOMETRY
// ============================================================================
// 
// For p4 symmetry, we need a square where 90° rotation around corners maps
// identified edges onto each other.
//
// We define the square with:
// - NE corner at origin (this is a 90° corner)
// - North edge going left along negative x-axis
// - East edge going down along positive y-axis
// - Side length = 300 (matching the editor's SIZE constant)

const SIDE = 300;

// NE corner at origin (90° angle)
const NE_CORNER = { x: 0, y: 0 };

// NW corner: north edge goes left from NE
const NW_CORNER = { x: -SIDE, y: 0 };

// SE corner: east edge goes down from NE
const SE_CORNER = { x: 0, y: SIDE };

// SW corner: complete the square
const SW_CORNER = { x: -SIDE, y: SIDE };

/**
 * Create an identity reference frame (no transformation).
 * @returns {{ a: number, b: number, c: number, d: number, tx: number, ty: number }}
 */
export function createIdentityFrame() {
  return { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 };
}

/**
 * Apply a reference frame transformation to a screen-space point.
 * @param {number} x - X coordinate in local square screen space
 * @param {number} y - Y coordinate in local square screen space
 * @param {{ a: number, b: number, c: number, d: number, tx: number, ty: number }} frame - Reference frame
 * @returns {{ x: number, y: number }} - Transformed point in global screen space
 */
export function applyReferenceFrame(x, y, frame) {
  return {
    x: frame.a * x + frame.b * y + frame.tx,
    y: frame.c * x + frame.d * y + frame.ty
  };
}

/**
 * Create a rotation matrix around a center point.
 * @param {number} angle - Rotation angle in radians (positive = counter-clockwise)
 * @param {number} cx - Center X
 * @param {number} cy - Center Y
 * @returns {{ a: number, b: number, c: number, d: number, tx: number, ty: number }}
 */
function createRotationAroundPoint(angle, cx, cy) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  
  // Rotation around (cx, cy):
  // 1. Translate to origin: (x - cx, y - cy)
  // 2. Rotate: (cos*x - sin*y, sin*x + cos*y)
  // 3. Translate back: add (cx, cy)
  // Combined: x' = cos*(x-cx) - sin*(y-cy) + cx = cos*x - sin*y + (cx - cos*cx + sin*cy)
  //           y' = sin*(x-cx) + cos*(y-cy) + cy = sin*x + cos*y + (cy - sin*cx - cos*cy)
  return {
    a: cos,
    b: -sin,
    c: sin,
    d: cos,
    tx: cx - cos * cx + sin * cy,
    ty: cy - sin * cx - cos * cy
  };
}

/**
 * Compose two affine transformations: result = second ∘ first
 * (i.e., first is applied first, then second)
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
 * Update the reference frame when the path crosses a wall.
 * The rotation must be around the TRANSFORMED corner position (where the corner is in world space).
 * 
 * For p4: 90° rotations instead of 120°
 * 
 * For the identifications north↔east and south↔west to work properly:
 * - When crossing north, we rotate 90° CCW around NE so that east(t) in the new frame
 *   lands at the same world position as north(t) in the old frame
 * - When crossing east, we rotate 90° CW around NE for the inverse
 * - Similarly for south/west with SW corner
 * 
 * @param {'north' | 'east' | 'south' | 'west'} side - The wall being crossed
 * @param {{ a: number, b: number, c: number, d: number, tx: number, ty: number }} currentFrame - Current reference frame
 * @returns {{ a: number, b: number, c: number, d: number, tx: number, ty: number }} - New reference frame
 */
export function updateReferenceFrameForSide(side, currentFrame) {
  const angle90CW = -Math.PI / 2;   // 90° clockwise = -90° = -π/2 radians
  const angle90CCW = Math.PI / 2;   // 90° counter-clockwise = +90° = π/2 radians
  
  // Determine which corner to rotate around and the rotation angle
  // Note: The rotation direction is chosen so that after the rotation,
  // the entry side (identified with the exit side) aligns properly.
  let localCorner;
  let angle;
  
  switch (side) {
    case 'north':
      // Crossing north: rotate CCW around NE so east(t) lands where north(t) was
      localCorner = NE_CORNER;
      angle = angle90CCW;
      break;
    case 'east':
      // Crossing east: rotate CW around NE (inverse of north)
      localCorner = NE_CORNER;
      angle = angle90CW;
      break;
    case 'south':
      // Crossing south: rotate CCW around SW so west(t) lands where south(t) was
      localCorner = SW_CORNER;
      angle = angle90CCW;
      break;
    case 'west':
      // Crossing west: rotate CW around SW (inverse of south)
      localCorner = SW_CORNER;
      angle = angle90CW;
      break;
    default:
      throw new Error(`Unknown side: ${side}`);
  }
  
  // Transform the corner to world space using the current frame
  const worldCorner = applyReferenceFrame(localCorner.x, localCorner.y, currentFrame);
  
  // Create the rotation around the world-space corner position
  const rotation = createRotationAroundPoint(angle, worldCorner.x, worldCorner.y);
  
  // Compose: first apply currentFrame, then the rotation
  return composeTransformations(currentFrame, rotation);
}

/**
 * Convert paper coordinates (unit square) to TRUE square screen coordinates.
 * 
 * Paper coordinates: (southward, eastward) in [0,1]^2
 * - (0, 0) = NW corner
 * - (0, 1) = NE corner
 * - (1, 0) = SW corner
 * - (1, 1) = SE corner
 * 
 * @param {number} southward - Southward position [0, 1]
 * @param {number} eastward - Eastward position [0, 1]
 * @returns {{ x: number, y: number }} - Screen coordinates in TRUE square
 */
export function paperToTrueSquare(southward, eastward) {
  // Bilinear interpolation: P = NW + eastward*(NE-NW) + southward*(SW-NW)
  const x = NW_CORNER.x + eastward * (NE_CORNER.x - NW_CORNER.x) + southward * (SW_CORNER.x - NW_CORNER.x);
  const y = NW_CORNER.y + eastward * (NE_CORNER.y - NW_CORNER.y) + southward * (SW_CORNER.y - NW_CORNER.y);
  
  return { x, y };
}

/**
 * Get screen coordinates for a point on a side at percentage t in TRUE square.
 * 
 * Side directions (matching geometry.js):
 * - north: west → east (t=0 at NW, t=1 at NE)
 * - east: south → north (t=0 at SE, t=1 at NE)
 * - south: east → west (t=0 at SE, t=1 at SW)
 * - west: north → south (t=0 at NW, t=1 at SW)
 * 
 * @param {'north' | 'east' | 'south' | 'west'} side - Side of the square
 * @param {number} t - Position along the side [0, 1]
 * @returns {{ x: number, y: number }} - Screen coordinates
 */
export function getPointOnSideTrueSquare(side, t) {
  switch (side) {
    case 'north':
      // NW to NE: southward=0, eastward goes from 0 to 1
      return paperToTrueSquare(0, t);
    case 'east':
      // SE to NE: eastward=1, southward goes from 1 to 0
      return paperToTrueSquare(1 - t, 1);
    case 'south':
      // SE to SW: southward=1, eastward goes from 1 to 0
      return paperToTrueSquare(1, 1 - t);
    case 'west':
      // NW to SW: eastward=0, southward goes from 0 to 1
      return paperToTrueSquare(t, 0);
    default:
      throw new Error(`Unknown side: ${side}`);
  }
}

/**
 * Convert a point to screen coordinates using a reference frame.
 * Uses the TRUE square geometry for proper p4 symmetry.
 * 
 * @param {Object} point - Point in square (boundary or interior)
 * @param {{ a: number, b: number, c: number, d: number, tx: number, ty: number }} frame - Reference frame
 * @returns {{ x: number, y: number }} - Screen coordinates
 */
export function pointToScreenSpace(point, frame) {
  // First convert to local screen coordinates in the TRUE square
  const paperCoords = getPointPaperCoordinates(point);
  const localScreen = paperToTrueSquare(paperCoords.southward, paperCoords.eastward);
  
  // Then apply the reference frame transformation
  return applyReferenceFrame(localScreen.x, localScreen.y, frame);
}

/**
 * Get the side that the path enters after crossing a boundary.
 * This is the identified side (north↔east, south↔west).
 * @param {'north' | 'east' | 'south' | 'west'} exitSide - The side being exited
 * @returns {'north' | 'east' | 'south' | 'west'} - The side being entered
 */
export function getEntrySide(exitSide) {
  return getIdentifiedSide(exitSide);
}

/**
 * Get the position on the entry side (same t value due to identification).
 * @param {'north' | 'east' | 'south' | 'west'} exitSide - The side being exited
 * @param {number} t - Position along the exit side [0, 1]
 * @returns {{ side: 'north' | 'east' | 'south' | 'west', t: number }} - Entry point
 */
export function getEntryPoint(exitSide, t) {
  return { side: getIdentifiedSide(exitSide), t };
}

/**
 * Check if an edge is a same-side edge (stays within the same square).
 * An edge stays in the same square if:
 * 1. Both endpoints are on the SAME side (e.g., north→north)
 * 2. Both endpoints are on IDENTIFIED sides AND at the SAME t value (within tolerance)
 *    (e.g., north(0.5)→east(0.5) represents the same point and doesn't cross)
 * 
 * If the endpoints are on identified sides but at DIFFERENT t values, the edge
 * actually crosses the square interior and enters a new square.
 * 
 * @param {Object} edge - Edge object with from/to points
 * @returns {boolean} - True if the edge stays within the same square
 */
function isSameSideEdge(edge) {
  if (isInteriorPoint(edge.from) || isInteriorPoint(edge.to)) {
    return false;
  }
  
  const fromSide = edge.from.side;
  const toSide = edge.to.side;
  const fromT = edge.from.t;
  const toT = edge.to.t;
  
  // Same literal side - always stays in same square
  if (fromSide === toSide) {
    return true;
  }
  
  // Check for identified sides (north↔east, south↔west)
  // Only treat as same-side if the t values are equal (same point via identification)
  if (getIdentifiedSide(fromSide) === toSide && Math.abs(fromT - toT) < EPSILON) {
    return true;
  }
  
  return false;
}

/**
 * Convert a path (array of edges) to a continuous path in screen space,
 * "unfolding" the path as it crosses boundaries.
 * 
 * Handles identified sides correctly: when the path crosses a boundary,
 * the next edge's start point is at the same geometric position as the
 * previous edge's end point, even if they're on identified sides.
 * 
 * @param {Array} edges - Array of edge objects with from/to points
 * @returns {Array<{ x: number, y: number }>} - Array of screen-space points
 */
export function pathToWallpaperPath(edges) {
  if (edges.length === 0) return [];
  
  const points = [];
  let currentFrame = createIdentityFrame();
  // Track the "continuation side" - when crossing boundaries, we may need to
  // draw the next edge's start point using the identified side's geometry
  let lastEndSide = null;
  let lastEndT = null;
  
  for (let i = 0; i < edges.length; i++) {
    const edge = edges[i];
    
    // Add the starting point
    if (i === 0) {
      // First edge - use the from point directly
      points.push(pointToScreenSpace(edge.from, currentFrame));
    } else {
      // For subsequent edges, we already added the end point of the previous edge.
      // But if this edge starts on an identified side (different from the previous end),
      // we should NOT add a new point because it's geometrically the same position.
      // The path should be continuous.
      // 
      // However, we need to check if the edge.from matches the expected continuation.
      // If edge.from.side differs from lastEndSide but they're identified, it's the same point.
      // If they're not identified, there's a gap (which shouldn't happen in valid paths).
      
      // Skip this logic for interior points or when we don't have previous side info
      if (isInteriorPoint(edge.from) || lastEndSide === null) {
        // Interior point or no previous side - add the from point
        points.push(pointToScreenSpace(edge.from, currentFrame));
      } else {
        const fromSide = edge.from.side;
        const fromT = edge.from.t;
        
        // Check if the from point is the same as the last end point (possibly via identification)
        const sameSide = fromSide === lastEndSide;
        const identifiedSide = getIdentifiedSide(lastEndSide) === fromSide;
        const sameT = lastEndT !== null && Math.abs(fromT - lastEndT) < EPSILON;
        
        // If they're not at the same position (even considering identification), 
        // we have a discontinuous path - add the from point
        if (!((sameSide || identifiedSide) && sameT)) {
          points.push(pointToScreenSpace(edge.from, currentFrame));
        }
        // Otherwise, skip adding the from point since it's the same as the last end point
      }
    }
    
    // Draw the endpoint
    // Note: We draw the edge using the original edge coordinates UNLESS
    // the edge connects two identified points at the same t value.
    // In that case, we convert to use the same physical side to avoid
    // drawing a line across the square (which would be wrong since
    // the two points are geometrically the same).
    let toPointForDrawing = edge.to;
    
    // Check if this is a same-point edge (identified sides at same t)
    if (!isInteriorPoint(edge.from) && !isInteriorPoint(edge.to)) {
      if (getIdentifiedSide(edge.from.side) === edge.to.side) {
        if (Math.abs(edge.from.t - edge.to.t) < EPSILON) {
          // This is a zero-length edge connecting the same geometric point.
          // Convert to use the same physical side so the edge appears as a point.
          toPointForDrawing = { side: edge.from.side, t: edge.to.t };
        }
      }
    }
    
    // Add the end point
    points.push(pointToScreenSpace(toPointForDrawing, currentFrame));
    
    // Track the last endpoint (only for boundary points)
    if (!isInteriorPoint(toPointForDrawing)) {
      lastEndSide = toPointForDrawing.side;
      lastEndT = toPointForDrawing.t;
    } else {
      // Interior point - reset tracking since we can't continue via identification
      lastEndSide = null;
      lastEndT = null;
    }
    
    // Determine if we need to update the reference frame for the next edge.
    // We update the frame when:
    // 1. Crossing a boundary (non-same-side edge) to a new square, OR
    // 2. A same-side edge ends at a point where the NEXT edge starts on the
    //    identified side (transitioning from east to north at same t, etc.)
    if (!isInteriorPoint(edge.to)) {
      const nextEdge = edges[i + 1];
      
      let shouldUpdateFrame = false;
      
      if (!isSameSideEdge(edge)) {
        // Current edge crosses the square (not same-side)
        if (nextEdge) {
          const nextEdgeStartsSamePhysicalSide = !isInteriorPoint(nextEdge.from) && 
                                                  nextEdge.from.side === edge.to.side;
          const nextEdgeIsSameSide = isSameSideEdge(nextEdge);
          
          shouldUpdateFrame = !(nextEdgeIsSameSide && nextEdgeStartsSamePhysicalSide);
        } else {
          // No next edge - update the frame anyway (though it won't be used)
          shouldUpdateFrame = true;
        }
      } else if (nextEdge) {
        // Current edge is same-side (walks along boundary)
        // Check if the NEXT edge starts on the identified side at the same t value
        if (!isInteriorPoint(nextEdge.from)) {
          const edgeEndsSide = edge.to.side;
          const nextStartsSide = nextEdge.from.side;
          const edgeEndsT = edge.to.t;
          const nextStartsT = nextEdge.from.t;
          
          // Check if transitioning from one side to its identified counterpart at same t
          if (edgeEndsSide !== nextStartsSide && 
              getIdentifiedSide(edgeEndsSide) === nextStartsSide &&
              Math.abs(edgeEndsT - nextStartsT) < EPSILON) {
            shouldUpdateFrame = true;
          }
        }
      }
      
      if (shouldUpdateFrame) {
        currentFrame = updateReferenceFrameForSide(edge.to.side, currentFrame);
      }
    }
  }
  
  return points;
}

// ============================================================================
// P4 WALLPAPER INDEX (for tracking position in the pattern)
// ============================================================================

const ANGLE_90 = Math.PI / 2;

/**
 * @typedef {Object} P4WallpaperIndex
 * @property {number} tx - Translation in first direction
 * @property {number} ty - Translation in second direction
 * @property {number} r - Rotation index: 0, 1, 2, or 3 (for 0°, 90°, 180°, 270°)
 */

/**
 * Create the identity p4 wallpaper index (starting position).
 * @returns {P4WallpaperIndex}
 */
export function createIdentityWallpaperIndex() {
  return { tx: 0, ty: 0, r: 0 };
}

/**
 * Update the p4 wallpaper index when crossing through a side.
 * Uses pure algebraic rules derived from the P4 group geometry.
 * 
 * For p4 with 90° rotations:
 * - r is 0, 1, 2, or 3 representing 0°, 90°, 180°, 270°
 * 
 * These rules are derived to be consistent with indexToFrame:
 * indexToFrame(updateWallpaperIndex(side, index)) should equal
 * updateReferenceFrameForSide(side, indexToFrame(index))
 * 
 * Rotation directions (matching updateReferenceFrameForSide):
 * - north: CCW rotation around NE → r increases
 * - east: CW rotation around NE → r decreases
 * - south: CCW rotation around SW → r increases, translation changes based on k
 * - west: CW rotation around SW → r decreases, translation changes based on k
 * 
 * @param {'north' | 'east' | 'south' | 'west'} side - Side being crossed
 * @param {P4WallpaperIndex} current - Current wallpaper index
 * @returns {P4WallpaperIndex} - New wallpaper index
 */
export function updateWallpaperIndex(side, current) {
  const { tx: i, ty: j, r: k } = current;
  
  switch (side) {
    case 'north':
      // CCW rotation around NE
      // k: 0→1, 1→2, 2→3, 3→0 (add 1 mod 4)
      return { tx: i, ty: j, r: (k + 1) % 4 };
    
    case 'east':
      // CW rotation around NE
      // k: 0→3, 1→0, 2→1, 3→2 (subtract 1 mod 4)
      return { tx: i, ty: j, r: (k + 3) % 4 };
    
    case 'south':
      // CCW rotation around SW (position depends on k)
      // Rules derived from updateReferenceFrameForSide consistency:
      // k=0: (i,j,0) → (i, j+1, 1)
      // k=1: (i,j,1) → (i-1, j, 2)
      // k=2: (i,j,2) → (i, j-1, 3)
      // k=3: (i,j,3) → (i+1, j, 0)
      switch (k) {
        case 0: return { tx: i, ty: j + 1, r: 1 };
        case 1: return { tx: i - 1, ty: j, r: 2 };
        case 2: return { tx: i, ty: j - 1, r: 3 };
        case 3: return { tx: i + 1, ty: j, r: 0 };
        default: throw new Error(`Invalid rotation k: ${k}`);
      }
    
    case 'west':
      // CW rotation around SW (position depends on k)
      // Rules derived from updateReferenceFrameForSide consistency:
      // k=0: (i,j,0) → (i-1, j, 3)
      // k=1: (i,j,1) → (i, j-1, 0)
      // k=2: (i,j,2) → (i+1, j, 1)
      // k=3: (i,j,3) → (i, j+1, 2)
      switch (k) {
        case 0: return { tx: i - 1, ty: j, r: 3 };
        case 1: return { tx: i, ty: j - 1, r: 0 };
        case 2: return { tx: i + 1, ty: j, r: 1 };
        case 3: return { tx: i, ty: j + 1, r: 2 };
        default: throw new Error(`Invalid rotation k: ${k}`);
      }
    
    default:
      throw new Error(`Unknown side: ${side}`);
  }
}

/**
 * Format a p4 wallpaper index as a string.
 * @param {P4WallpaperIndex} index
 * @returns {string}
 */
export function formatWallpaperIndex(index) {
  const rotLabel = ['0°', '90°', '180°', '270°'][index.r];
  return `(${index.tx}, ${index.ty}, ${rotLabel})`;
}

/**
 * Convert a p4 wallpaper index to an affine frame.
 * Computes the transformation for the square at position (i, j) with rotation k.
 * @param {P4WallpaperIndex} index
 * @returns {{ a: number, b: number, c: number, d: number, tx: number, ty: number }}
 */
export function indexToFrame(index) {
  const { tx: i, ty: j, r: k } = index;
  
  // Rotation by k * 90°
  const angle = k * ANGLE_90;
  const cosK = Math.cos(angle);
  const sinK = Math.sin(angle);
  
  // Translation vectors for p4 square lattice
  // T1 = (2*SIDE, 0) - horizontal translation
  // T2 = (0, 2*SIDE) - vertical translation
  const T1 = { x: 2 * SIDE, y: 0 };
  const T2 = { x: 0, y: 2 * SIDE };
  
  // Translation by i*T1 + j*T2
  const translateX = i * T1.x + j * T2.x;
  const translateY = i * T1.y + j * T2.y;
  
  return {
    a: cosK,
    b: -sinK,
    c: sinK,
    d: cosK,
    tx: translateX,
    ty: translateY
  };
}

// ============================================================================
// TRIANGLE DIFFEO: Square → 45-45-90 Triangle
// ============================================================================
// 
// The diffeomorphism G(u,v) = (u*(1+v)/2, v + u*(1-v)/2) maps the unit square
// [0,1]² to the triangle with vertices (0,0), (0,1), (1,0):
//   - (0,0) → (0,0)  [NW corner → 45° vertex]
//   - (1,0) → (0.5, 0.5) [NE corner → hypotenuse midpoint, 180° cone]
//   - (0,1) → (0,1)  [SW corner → 90° vertex]
//   - (1,1) → (1,1)  [SE corner → 45° vertex]
//
// The south and west edges map to the triangle legs.
// Both north and east edges map to the hypotenuse (x=y line).
// This correctly collapses the identified pair (north↔east) onto
// the hypotenuse, with the NE corner becoming the 180° cone point.
// The 4-way cone points are at SW (90°) and NW≡SE (45°+45°).

/**
 * Convert paper coordinates to screen coordinates via the triangle diffeomorphism.
 * Applies G(u,v) = (u*(1+v)/2, v + u*(1-v)/2) then maps to screen space.
 * 
 * @param {number} southward - Southward position [0, 1]
 * @param {number} eastward - Eastward position [0, 1]
 * @returns {{ x: number, y: number }} - Screen coordinates in triangle
 */
export function paperToTriangle(southward, eastward) {
  const u = eastward;
  const v = southward;
  // Apply diffeo: square → triangle (north+east collapse to hypotenuse)
  const x = u * (1.0 + v) / 2.0;
  const y = v + u * (1.0 - v) / 2.0;
  
  // Map to screen coordinates using same linear mapping as paperToTrueSquare
  const screenX = NW_CORNER.x + x * (NE_CORNER.x - NW_CORNER.x) + y * (SW_CORNER.x - NW_CORNER.x);
  const screenY = NW_CORNER.y + x * (NE_CORNER.y - NW_CORNER.y) + y * (SW_CORNER.y - NW_CORNER.y);
  
  return { x: screenX, y: screenY };
}

/**
 * Convert a point to triangle screen coordinates using a reference frame.
 * Uses the triangle diffeomorphism mapping.
 * 
 * @param {Object} point - Point in square (boundary or interior)
 * @param {{ a: number, b: number, c: number, d: number, tx: number, ty: number }} frame - Reference frame
 * @returns {{ x: number, y: number }} - Screen coordinates
 */
export function pointToTriangleScreenSpace(point, frame) {
  const paperCoords = getPointPaperCoordinates(point);
  const localScreen = paperToTriangle(paperCoords.southward, paperCoords.eastward);
  return applyReferenceFrame(localScreen.x, localScreen.y, frame);
}

// Export corner coordinates and square dimensions for testing
export { NE_CORNER, SW_CORNER, NW_CORNER, SE_CORNER, SIDE };
