/**
 * Combinatorial logic for p3 loops.
 * 
 * In the combinatorial approach:
 * - Points are at integer positions (1, 2, 3, ...) along each side
 * - Edges are always side-to-side (including same side)
 * - A new edge connects an existing point to a segment between two adjacent points
 * - Crossing detection is done combinatorially (chords on a circle)
 * - Visualization places points at equally spaced positions
 * 
 * Data structures:
 * - A point is { side: string, position: number } where position is an integer
 * - Sides are indexed: north=0, east=1, south=2, west=3
 * - Points around the perimeter are ordered: all north points, then east, then south, then west
 * - An edge is { from: point, to: point }
 * - A segment is { side: string, afterPosition: number } meaning the segment between
 *   position `afterPosition` and `afterPosition + 1` on that side
 */

import { getIdentifiedSide } from './geometry.js';

export const SIDES = ['north', 'east', 'south', 'west'];
export const SIDE_INDEX = { north: 0, east: 1, south: 2, west: 3 };

/**
 * Get the total number of points on a given side.
 * Initially each side starts with 0 points. Points are added as edges are created.
 * @param {Array} edges - Current edges in the path
 * @param {string} side - Side name
 * @returns {number} - Number of points on this side
 */
export function getPointCountOnSide(edges, side) {
  const positions = new Set();
  for (const edge of edges) {
    if (edge.from.side === side) positions.add(edge.from.position);
    if (edge.to.side === side) positions.add(edge.to.position);
  }
  return positions.size;
}

/**
 * Get all points on a given side, sorted by position.
 * @param {Array} edges - Current edges in the path
 * @param {string} side - Side name
 * @returns {Array<{side: string, position: number}>} - Sorted list of points
 */
export function getPointsOnSide(edges, side) {
  const positions = new Set();
  for (const edge of edges) {
    if (edge.from.side === side) positions.add(edge.from.position);
    if (edge.to.side === side) positions.add(edge.to.position);
  }
  return Array.from(positions)
    .sort((a, b) => a - b)
    .map(pos => ({ side, position: pos }));
}

/**
 * Get all segments on a given side. A segment is the gap between adjacent points.
 * For an empty side, there's one segment (the entire side).
 * For n points, there are n+1 segments.
 * @param {Array} edges - Current edges in the path
 * @param {string} side - Side name
 * @returns {Array<{side: string, afterPosition: number, beforePosition: number}>} 
 *   Each segment has afterPosition (0 means before first point) and beforePosition (null means after last point)
 */
export function getSegmentsOnSide(edges, side) {
  const points = getPointsOnSide(edges, side);
  const segments = [];
  
  if (points.length === 0) {
    // One segment spanning the entire side
    segments.push({ side, afterPosition: 0, beforePosition: null, isFirst: true, isLast: true });
  } else {
    // Segment before the first point
    segments.push({ side, afterPosition: 0, beforePosition: points[0].position, isFirst: true, isLast: false });
    
    // Segments between consecutive points
    for (let i = 0; i < points.length - 1; i++) {
      segments.push({ 
        side, 
        afterPosition: points[i].position, 
        beforePosition: points[i + 1].position,
        isFirst: false,
        isLast: false
      });
    }
    
    // Segment after the last point
    segments.push({ 
      side, 
      afterPosition: points[points.length - 1].position, 
      beforePosition: null,
      isFirst: false,
      isLast: true
    });
  }
  
  return segments;
}

/**
 * Get all available segments across all sides.
 * @param {Array} edges - Current edges in the path
 * @returns {Object} - Map of side -> segments
 */
export function getAllSegments(edges) {
  const result = {};
  for (const side of SIDES) {
    result[side] = getSegmentsOnSide(edges, side);
  }
  return result;
}

/**
 * Create a new point in a segment. The new point gets the next available integer position.
 * @param {Object} segment - The segment to place the point in
 * @param {Array} edges - Current edges for context
 * @returns {{side: string, position: number}} - The new point
 */
export function createPointInSegment(segment, edges) {
  const points = getPointsOnSide(edges, segment.side);
  
  // Find the next available position (max position + 1)
  let maxPosition = 0;
  for (const pt of points) {
    maxPosition = Math.max(maxPosition, pt.position);
  }
  
  return { side: segment.side, position: maxPosition + 1 };
}

/**
 * Get the continuation point after crossing to an identified side.
 * (north ↔ east, south ↔ west)
 * @param {Object} point - Current point
 * @returns {Object} - Continuation point on identified side
 */
export function getContinuationPoint(point) {
  return {
    side: getIdentifiedSide(point.side),
    position: point.position
  };
}

/**
 * Convert combinatorial point to t-parameter (0-1) for visualization.
 * Points are equally spaced within the unit interval.
 * @param {Object} point - { side, position }
 * @param {Array} edges - Current edges
 * @returns {number} - t value in [0, 1]
 */
export function pointToT(point, edges) {
  const points = getPointsOnSide(edges, point.side);
  if (points.length === 0) return 0.5; // Should not happen
  
  // Find the index of this point
  const index = points.findIndex(p => p.position === point.position);
  if (index === -1) return 0.5; // Should not happen
  
  // Equally space n points: at positions 1/(n+1), 2/(n+1), ..., n/(n+1)
  const n = points.length;
  return (index + 1) / (n + 1);
}

/**
 * Convert a segment to t-parameter range for highlighting.
 * @param {Object} segment - The segment
 * @param {Array} edges - Current edges
 * @returns {{ t1: number, t2: number }} - Range of t values for this segment
 */
export function segmentToTRange(segment, edges) {
  const points = getPointsOnSide(edges, segment.side);
  const n = points.length;
  
  if (n === 0) {
    // Entire side
    return { t1: 0, t2: 1 };
  }
  
  // Points are at positions 1/(n+1), 2/(n+1), ..., n/(n+1)
  // Segments are: [0, 1/(n+1)], [1/(n+1), 2/(n+1)], ..., [(n)/(n+1), 1]
  
  if (segment.isFirst) {
    return { t1: 0, t2: 1 / (n + 1) };
  }
  
  if (segment.isLast) {
    return { t1: n / (n + 1), t2: 1 };
  }
  
  // Find the indices of the bounding points
  const afterIndex = points.findIndex(p => p.position === segment.afterPosition);
  return { t1: (afterIndex + 1) / (n + 1), t2: (afterIndex + 2) / (n + 1) };
}

/**
 * Get all points ordered around the perimeter (for chord crossing detection).
 * Points are ordered as they would appear walking around the boundary:
 * North (low t → high t), East (low t → high t), South (low t → high t), West (low t → high t)
 * 
 * For combinatorial crossing detection, we convert positions to t-values (0-1)
 * and then compute a single perimeter position in [0, 4).
 * 
 * @param {Array} edges - Current edges
 * @returns {Array<{side: string, position: number, perimeterPosition: number}>}
 */
export function getOrderedPerimeterPoints(edges) {
  const allPoints = [];
  
  for (const side of SIDES) {
    const sidePoints = getPointsOnSide(edges, side);
    for (const pt of sidePoints) {
      // Compute t-value for this point
      const t = pointToT(pt, edges);
      // Compute perimeter position in [0, 4)
      // north: 0-1, east: 1-2, south: 2-3, west: 3-4
      const sideOffset = SIDE_INDEX[side];
      const perimeterPosition = sideOffset + t;
      allPoints.push({ ...pt, perimeterPosition });
    }
  }
  
  // Sort by perimeter position and assign indices
  allPoints.sort((a, b) => a.perimeterPosition - b.perimeterPosition);
  allPoints.forEach((pt, idx) => {
    pt.perimeterIndex = idx;
  });
  
  return allPoints;
}

/**
 * Find the perimeter index of a point.
 * @param {Object} point - { side, position }
 * @param {Array} edges - Current edges
 * @returns {number} - Index around perimeter
 */
export function getPerimeterIndex(point, edges) {
  const allPoints = getOrderedPerimeterPoints(edges);
  const found = allPoints.find(p => p.side === point.side && p.position === point.position);
  return found ? found.perimeterIndex : -1;
}

/**
 * Check if two chords intersect on a circle.
 * Chords are given as pairs of perimeter indices (a1, a2) and (b1, b2).
 * Two chords intersect if and only if exactly one endpoint of each chord
 * is between the endpoints of the other chord.
 * @param {number} a1 - First endpoint of chord A
 * @param {number} a2 - Second endpoint of chord A  
 * @param {number} b1 - First endpoint of chord B
 * @param {number} b2 - Second endpoint of chord B
 * @returns {boolean} - True if chords intersect
 */
export function chordsIntersect(a1, a2, b1, b2) {
  // Normalize so a1 < a2 and b1 < b2
  if (a1 > a2) [a1, a2] = [a2, a1];
  if (b1 > b2) [b1, b2] = [b2, b1];
  
  // Same chord - no intersection
  if ((a1 === b1 && a2 === b2)) return false;
  
  // Shared endpoint - no intersection (they meet, not cross)
  if (a1 === b1 || a1 === b2 || a2 === b1 || a2 === b2) return false;
  
  // Check if exactly one of b1, b2 is between a1 and a2
  const b1InA = a1 < b1 && b1 < a2;
  const b2InA = a1 < b2 && b2 < a2;
  
  // Chords intersect iff exactly one endpoint of B is between endpoints of A
  return b1InA !== b2InA;
}

/**
 * Check if a new edge would cross any existing edge.
 * Uses combinatorial chord intersection test.
 * @param {Object} newEdge - { from, to }
 * @param {Array} existingEdges - Current edges
 * @returns {{ crosses: boolean, crossingEdgeIndex: number | null }}
 */
export function edgeCrossesPath(newEdge, existingEdges) {
  // Get all points including the new edge's endpoints
  const tempEdges = [...existingEdges, newEdge];
  
  // Get perimeter indices for the new edge
  const newFrom = getPerimeterIndex(newEdge.from, tempEdges);
  const newTo = getPerimeterIndex(newEdge.to, tempEdges);
  
  // Check against each existing edge
  for (let i = 0; i < existingEdges.length; i++) {
    const edge = existingEdges[i];
    const edgeFrom = getPerimeterIndex(edge.from, tempEdges);
    const edgeTo = getPerimeterIndex(edge.to, tempEdges);
    
    if (chordsIntersect(newFrom, newTo, edgeFrom, edgeTo)) {
      return { crosses: true, crossingEdgeIndex: i };
    }
  }
  
  return { crosses: false, crossingEdgeIndex: null };
}

/**
 * Check if two combinatorial points are equal (same side and position).
 * @param {Object} p1 - First point
 * @param {Object} p2 - Second point
 * @returns {boolean}
 */
export function pointsEqual(p1, p2) {
  return p1.side === p2.side && p1.position === p2.position;
}

/**
 * Check if adding a new edge is valid.
 * @param {Object} newEdge - { from, to }
 * @param {Array} existingEdges - Current edges
 * @returns {{ valid: boolean, error?: string, crossingEdgeIndex?: number }}
 */
export function canAddEdge(newEdge, existingEdges) {
  // Check for self-edge (same point)
  if (pointsEqual(newEdge.from, newEdge.to)) {
    return { valid: false, error: 'Cannot create an edge from a point to itself' };
  }
  
  // Check chaining - the start must be the continuation of the last edge's endpoint
  if (existingEdges.length > 0) {
    const lastEdge = existingEdges[existingEdges.length - 1];
    const expectedStart = getContinuationPoint(lastEdge.to);
    if (!pointsEqual(newEdge.from, expectedStart)) {
      return { valid: false, error: 'Edge must continue from the identified point of the last edge endpoint' };
    }
  }
  
  // Check for crossing
  const crossResult = edgeCrossesPath(newEdge, existingEdges);
  if (crossResult.crosses) {
    return { 
      valid: false, 
      error: `Edge would cross existing edge #${crossResult.crossingEdgeIndex + 1}`,
      crossingEdgeIndex: crossResult.crossingEdgeIndex
    };
  }
  
  // Check if destination point already exists in path (would create loop)
  for (const edge of existingEdges) {
    if (pointsEqual(edge.from, newEdge.to) || pointsEqual(edge.to, newEdge.to)) {
      // Check if it's the very first point (allowed for closing)
      const isFirstPoint = existingEdges.length > 0 && pointsEqual(existingEdges[0].from, newEdge.to);
      if (!isFirstPoint) {
        return { valid: false, error: 'Destination point already exists in path' };
      }
    }
  }
  
  return { valid: true };
}

/**
 * Convert combinatorial edges to the standard floating-point edge format
 * used by the 3D and wallpaper viewers.
 * @param {Array} combEdges - Combinatorial edges
 * @returns {Array} - Standard format edges with { from: {side, t}, to: {side, t} }
 */
export function combinatorialToStandardEdges(combEdges) {
  if (combEdges.length === 0) return [];
  
  return combEdges.map(edge => ({
    from: {
      side: edge.from.side,
      t: pointToT(edge.from, combEdges)
    },
    to: {
      side: edge.to.side,
      t: pointToT(edge.to, combEdges)
    }
  }));
}

/**
 * Get the starting point for a new edge (continuation from last edge).
 * @param {Array} edges - Current edges
 * @returns {Object|null} - Starting point or null if no edges
 */
export function getNextEdgeStartPoint(edges) {
  if (edges.length === 0) return null;
  return getContinuationPoint(edges[edges.length - 1].to);
}

/**
 * Validate a complete combinatorial path.
 * @param {Array} edges - Path edges
 * @returns {{ valid: boolean, error?: string }}
 */
export function validatePath(edges) {
  if (edges.length === 0) return { valid: true };
  
  // Check each edge has valid structure
  for (let i = 0; i < edges.length; i++) {
    const edge = edges[i];
    if (!edge.from || !edge.to) {
      return { valid: false, error: `Edge ${i} missing from or to` };
    }
    if (!SIDES.includes(edge.from.side)) {
      return { valid: false, error: `Edge ${i} has invalid 'from' side` };
    }
    if (!SIDES.includes(edge.to.side)) {
      return { valid: false, error: `Edge ${i} has invalid 'to' side` };
    }
    if (typeof edge.from.position !== 'number' || !Number.isInteger(edge.from.position) || edge.from.position < 1) {
      return { valid: false, error: `Edge ${i} has invalid 'from' position (must be positive integer)` };
    }
    if (typeof edge.to.position !== 'number' || !Number.isInteger(edge.to.position) || edge.to.position < 1) {
      return { valid: false, error: `Edge ${i} has invalid 'to' position (must be positive integer)` };
    }
  }
  
  // Check chaining
  for (let i = 1; i < edges.length; i++) {
    const prevEnd = getContinuationPoint(edges[i - 1].to);
    if (!pointsEqual(prevEnd, edges[i].from)) {
      return { valid: false, error: `Edge ${i} does not chain properly from edge ${i - 1}` };
    }
  }
  
  // Check for crossings
  for (let i = 0; i < edges.length; i++) {
    for (let j = i + 2; j < edges.length; j++) {
      // Get perimeter indices using all edges
      const fromI = getPerimeterIndex(edges[i].from, edges);
      const toI = getPerimeterIndex(edges[i].to, edges);
      const fromJ = getPerimeterIndex(edges[j].from, edges);
      const toJ = getPerimeterIndex(edges[j].to, edges);
      
      if (chordsIntersect(fromI, toI, fromJ, toJ)) {
        return { valid: false, error: `Edges ${i + 1} and ${j + 1} cross` };
      }
    }
  }
  
  return { valid: true };
}

/**
 * Get a label for a segment (for UI display).
 * @param {Object} segment - The segment
 * @returns {string}
 */
export function getSegmentLabel(segment) {
  const sideName = segment.side.charAt(0).toUpperCase() + segment.side.slice(1);
  if (segment.isFirst && segment.isLast) {
    return `${sideName} (entire side)`;
  }
  if (segment.isFirst) {
    return `${sideName} (before point ${segment.beforePosition})`;
  }
  if (segment.isLast) {
    return `${sideName} (after point ${segment.afterPosition})`;
  }
  return `${sideName} (${segment.afterPosition} to ${segment.beforePosition})`;
}
