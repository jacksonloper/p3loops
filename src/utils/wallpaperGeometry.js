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

import { getPointPaperCoordinates, getIdentifiedSide, isInteriorPoint } from './geometry.js';

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
 * Get the rotation transform when passing through a wall.
 * @param {'north' | 'east' | 'south' | 'west'} side - The wall being crossed
 * @returns {{ a: number, b: number, c: number, d: number, tx: number, ty: number }}
 */
function getWallCrossingRotation(side) {
  const angle120CW = -2 * Math.PI / 3;   // 120° clockwise = -120° = -2π/3 radians
  const angle120CCW = 2 * Math.PI / 3;   // 120° counter-clockwise = +120° = 2π/3 radians
  
  switch (side) {
    case 'north':
      // 120° clockwise around NE corner
      return createRotationAroundPoint(angle120CW, NE_CORNER.x, NE_CORNER.y);
    case 'east':
      // 120° counter-clockwise around NE corner
      return createRotationAroundPoint(angle120CCW, NE_CORNER.x, NE_CORNER.y);
    case 'south':
      // 120° clockwise around SW corner
      return createRotationAroundPoint(angle120CW, SW_CORNER.x, SW_CORNER.y);
    case 'west':
      // 120° counter-clockwise around SW corner
      return createRotationAroundPoint(angle120CCW, SW_CORNER.x, SW_CORNER.y);
    default:
      throw new Error(`Unknown side: ${side}`);
  }
}

/**
 * Update the reference frame when the path crosses a wall.
 * The rotation is composed with the current reference frame.
 * 
 * @param {'north' | 'east' | 'south' | 'west'} side - The wall being crossed
 * @param {{ a: number, b: number, c: number, d: number, tx: number, ty: number }} currentFrame - Current reference frame
 * @returns {{ a: number, b: number, c: number, d: number, tx: number, ty: number }} - New reference frame
 */
export function updateReferenceFrameForSide(side, currentFrame) {
  const rotation = getWallCrossingRotation(side);
  // The rotation needs to be applied in "world" space, so we compose it after the current frame
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
 * Convert a path (array of edges) to a continuous path in screen space,
 * "unfolding" the path as it crosses boundaries.
 * 
 * @param {Array} edges - Array of edge objects with from/to points
 * @returns {Array<{ x: number, y: number }>} - Array of screen-space points
 */
export function pathToWallpaperPath(edges) {
  if (edges.length === 0) return [];
  
  const points = [];
  let currentFrame = createIdentityFrame();
  
  for (let i = 0; i < edges.length; i++) {
    const edge = edges[i];
    
    // Add the starting point (except for subsequent edges where it's the same as previous end)
    if (i === 0) {
      points.push(pointToScreenSpace(edge.from, currentFrame));
    }
    
    // Add the end point
    points.push(pointToScreenSpace(edge.to, currentFrame));
    
    // If the endpoint is on a boundary, update the reference frame for the next edge
    if (!isInteriorPoint(edge.to)) {
      currentFrame = updateReferenceFrameForSide(edge.to.side, currentFrame);
    }
  }
  
  return points;
}

// Export corner coordinates for testing (functions already exported with 'export function')
export { NE_CORNER, SW_CORNER, NW_CORNER, SE_CORNER };
