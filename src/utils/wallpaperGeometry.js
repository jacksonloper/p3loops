/**
 * Geometry utilities for rendering the p3 wallpaper visualization.
 * 
 * The p3 wallpaper is created by "unfolding" the path as it travels through
 * the rhombus boundaries. Each time the path crosses a boundary, the rhombus
 * is rotated around one of the 120° corners (NE or SW).
 * 
 * IMPORTANT: For proper p3 symmetry with 120° rotations, we need a TRUE rhombus 
 * with equal side lengths (not the sheared parallelogram used in the editor).
 * This module defines its own rhombus coordinate system.
 * 
 * The TRUE rhombus has:
 * - All four sides of equal length
 * - 120° angles at NE and SW corners
 * - 60° angles at NW and SE corners
 * 
 * Rotation rules:
 * - North wall: 120° clockwise around NE corner
 * - East wall: 120° counter-clockwise around NE corner  
 * - South wall: 120° clockwise around SW corner
 * - West wall: 120° counter-clockwise around SW corner
 * 
 * A reference frame is represented as a 2D affine transformation matrix:
 *   { a, b, c, d, tx, ty }
 * representing the transformation:
 *   x' = a*x + b*y + tx
 *   y' = c*x + d*y + ty
 */

import { getPointPaperCoordinates, getIdentifiedSide, isInteriorPoint, EPSILON } from './geometry.js';

// ============================================================================
// TRUE RHOMBUS GEOMETRY
// ============================================================================
// 
// For p3 symmetry, we need a rhombus where 120° rotation around corners maps
// identified edges onto each other. This requires all sides to have equal length.
//
// We define the rhombus with:
// - NE corner at origin (this is a 120° corner)
// - North edge going left along negative x-axis
// - East edge going at -60° (60° clockwise from positive x)
// - Side length = 300 (matching the editor's SIZE constant)

const SIDE = 300;

// NE corner at origin (120° angle)
const NE_CORNER = { x: 0, y: 0 };

// NW corner: north edge goes left from NE
const NW_CORNER = { x: -SIDE, y: 0 };

// East edge goes at -60° (creates 120° angle with north edge at NE)
const EAST_ANGLE = -60 * Math.PI / 180;
const SE_CORNER = {
  x: NE_CORNER.x + SIDE * Math.cos(EAST_ANGLE),
  y: NE_CORNER.y + SIDE * Math.sin(EAST_ANGLE)
};

// SW corner: complete the parallelogram
const SW_CORNER = {
  x: NW_CORNER.x + (SE_CORNER.x - NE_CORNER.x),
  y: NW_CORNER.y + (SE_CORNER.y - NE_CORNER.y)
};

/**
 * Create an identity reference frame (no transformation).
 * @returns {{ a: number, b: number, c: number, d: number, tx: number, ty: number }}
 */
export function createIdentityFrame() {
  return { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 };
}

/**
 * Apply a reference frame transformation to a screen-space point.
 * @param {number} x - X coordinate in local rhombus screen space
 * @param {number} y - Y coordinate in local rhombus screen space
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
 * @param {'north' | 'east' | 'south' | 'west'} side - The wall being crossed
 * @param {{ a: number, b: number, c: number, d: number, tx: number, ty: number }} currentFrame - Current reference frame
 * @returns {{ a: number, b: number, c: number, d: number, tx: number, ty: number }} - New reference frame
 */
export function updateReferenceFrameForSide(side, currentFrame) {
  const angle120CW = -2 * Math.PI / 3;   // 120° clockwise = -120° = -2π/3 radians
  const angle120CCW = 2 * Math.PI / 3;   // 120° counter-clockwise = +120° = 2π/3 radians
  
  // Determine which corner to rotate around and the rotation angle
  let localCorner;
  let angle;
  
  switch (side) {
    case 'north':
      localCorner = NE_CORNER;
      angle = angle120CW;
      break;
    case 'east':
      localCorner = NE_CORNER;
      angle = angle120CCW;
      break;
    case 'south':
      localCorner = SW_CORNER;
      angle = angle120CW;
      break;
    case 'west':
      localCorner = SW_CORNER;
      angle = angle120CCW;
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
 * Convert paper coordinates (unit square) to TRUE rhombus screen coordinates.
 * 
 * Paper coordinates: (southward, eastward) in [0,1]^2
 * - (0, 0) = NW corner
 * - (0, 1) = NE corner
 * - (1, 0) = SW corner
 * - (1, 1) = SE corner
 * 
 * @param {number} southward - Southward position [0, 1]
 * @param {number} eastward - Eastward position [0, 1]
 * @returns {{ x: number, y: number }} - Screen coordinates in TRUE rhombus
 */
export function paperToTrueRhombus(southward, eastward) {
  // Bilinear interpolation: P = NW + eastward*(NE-NW) + southward*(SW-NW)
  const x = NW_CORNER.x + eastward * (NE_CORNER.x - NW_CORNER.x) + southward * (SW_CORNER.x - NW_CORNER.x);
  const y = NW_CORNER.y + eastward * (NE_CORNER.y - NW_CORNER.y) + southward * (SW_CORNER.y - NW_CORNER.y);
  
  return { x, y };
}

/**
 * Get screen coordinates for a point on a side at percentage t in TRUE rhombus.
 * 
 * Side directions (matching geometry.js):
 * - north: west → east (t=0 at NW, t=1 at NE)
 * - east: south → north (t=0 at SE, t=1 at NE)
 * - south: east → west (t=0 at SE, t=1 at SW)
 * - west: north → south (t=0 at NW, t=1 at SW)
 * 
 * @param {'north' | 'east' | 'south' | 'west'} side - Side of the rhombus
 * @param {number} t - Position along the side [0, 1]
 * @returns {{ x: number, y: number }} - Screen coordinates
 */
export function getPointOnSideTrueRhombus(side, t) {
  switch (side) {
    case 'north':
      // NW to NE: southward=0, eastward goes from 0 to 1
      return paperToTrueRhombus(0, t);
    case 'east':
      // SE to NE: eastward=1, southward goes from 1 to 0
      return paperToTrueRhombus(1 - t, 1);
    case 'south':
      // SE to SW: southward=1, eastward goes from 1 to 0
      return paperToTrueRhombus(1, 1 - t);
    case 'west':
      // NW to SW: eastward=0, southward goes from 0 to 1
      return paperToTrueRhombus(t, 0);
    default:
      throw new Error(`Unknown side: ${side}`);
  }
}

/**
 * Convert a point to screen coordinates using a reference frame.
 * Uses the TRUE rhombus geometry for proper p3 symmetry.
 * 
 * @param {Object} point - Point in rhombus (boundary or interior)
 * @param {{ a: number, b: number, c: number, d: number, tx: number, ty: number }} frame - Reference frame
 * @returns {{ x: number, y: number }} - Screen coordinates
 */
export function pointToScreenSpace(point, frame) {
  // First convert to local screen coordinates in the TRUE rhombus
  const paperCoords = getPointPaperCoordinates(point);
  const localScreen = paperToTrueRhombus(paperCoords.southward, paperCoords.eastward);
  
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
 * Check if an edge is a same-side edge (stays within the same rhombus).
 * An edge stays in the same rhombus if:
 * 1. Both endpoints are on the SAME side (e.g., north→north)
 * 2. Both endpoints are on IDENTIFIED sides AND at the SAME t value (within tolerance)
 *    (e.g., north(0.5)→east(0.5) represents the same point and doesn't cross)
 * 
 * If the endpoints are on identified sides but at DIFFERENT t values, the edge
 * actually crosses the rhombus interior and enters a new rhombus.
 * 
 * @param {Object} edge - Edge object with from/to points
 * @returns {boolean} - True if the edge stays within the same rhombus
 */
function isSameSideEdge(edge) {
  if (isInteriorPoint(edge.from) || isInteriorPoint(edge.to)) {
    return false;
  }
  
  const fromSide = edge.from.side;
  const toSide = edge.to.side;
  const fromT = edge.from.t;
  const toT = edge.to.t;
  
  // Same literal side - always stays in same rhombus
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
    
    // Determine how to draw the endpoint
    // If this is a same-side edge AND we entered from the identified side,
    // we need to convert the to point to use the continuation side for proper visualization
    let toPointForDrawing = edge.to;
    
    // Check if this edge is same-side but the sides are identified
    // (e.g., edge.from.side is 'east' but we entered from 'north')
    // In this case, we should draw using the north geometry to stay consistent
    if (isSameSideEdge(edge) && lastEndSide !== null) {
      const edgeFromSide = edge.from.side;
      const expectedContinuationSide = getIdentifiedSide(lastEndSide);
      
      // If we entered from lastEndSide, and this edge is on the identified side,
      // convert the to point to use the lastEndSide for drawing
      if (edgeFromSide === expectedContinuationSide && edgeFromSide !== lastEndSide) {
        // The edge is on the identified side - convert to use lastEndSide
        // Since this is a same-side edge, to.side === from.side
        // We should draw it using lastEndSide instead
        toPointForDrawing = { side: lastEndSide, t: edge.to.t };
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
    
    // If the endpoint is on a boundary AND this is not a same-side edge,
    // we might need to update the reference frame for the next edge.
    // Same-side edges walk along the boundary without crossing it.
    if (!isInteriorPoint(edge.to) && !isSameSideEdge(edge)) {
      const nextEdge = edges[i + 1];
      
      // Determine if we need to update the frame.
      // We update the frame if the next edge starts at a GEOMETRICALLY DIFFERENT point.
      // 
      // The next edge starts at the SAME geometric point if:
      // - It starts on the same physical side at the same t, OR
      // - It starts on an identified side at the same t (north↔east, south↔west)
      //
      // If the next edge starts at the same point AND is a same-side edge,
      // it just walks along the boundary in the same rhombus.
      if (nextEdge) {
        let nextEdgeStartsAtSamePoint = false;
        if (!isInteriorPoint(nextEdge.from)) {
          const sameSide = nextEdge.from.side === edge.to.side;
          const identifiedSide = getIdentifiedSide(edge.to.side) === nextEdge.from.side;
          const sameT = Math.abs(nextEdge.from.t - edge.to.t) < EPSILON;
          nextEdgeStartsAtSamePoint = (sameSide || identifiedSide) && sameT;
        }
        
        const nextEdgeIsSameSide = isSameSideEdge(nextEdge);
        
        // Only skip the frame update if the next edge starts at the same geometric point
        // AND is a same-side edge (meaning it stays in the current rhombus)
        const skipFrameUpdate = nextEdgeIsSameSide && nextEdgeStartsAtSamePoint;
        
        if (!skipFrameUpdate) {
          currentFrame = updateReferenceFrameForSide(edge.to.side, currentFrame);
        }
      } else {
        // No next edge - update the frame anyway (though it won't be used)
        currentFrame = updateReferenceFrameForSide(edge.to.side, currentFrame);
      }
    }
  }
  
  return points;
}

// Export corner coordinates and rhombus dimensions for testing
export { NE_CORNER, SW_CORNER, NW_CORNER, SE_CORNER, SIDE };
