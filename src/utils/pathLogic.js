/**
 * Path logic for edges on the rhombus.
 * 
 * An edge is defined by:
 *   { from: { side, t }, to: { side, t } }
 * for boundary points where t is the percentage (0-1) along the side.
 * 
 * Or for interior points:
 *   { from/to: { interior: true, southward, eastward } }
 * where southward and eastward are in [0,1].
 * 
 * A path is a list of edges that chain together (endpoint of one = startpoint of next).
 * Paths must be non-crossing and cannot form loops.
 * 
 * Same-side edges are forbidden (e.g., north to north).
 */

import { getIdentifiedSide, pointsAreEqual, getPointCoordinates, getPointPaperCoordinates, isInteriorPoint, SIDES, EPSILON } from './geometry.js';

/**
 * Check if an edge forms a valid chain with the previous edge.
 */
export function edgesChain(prevEdge, nextEdge) {
  return pointsAreEqual(prevEdge.to, nextEdge.from);
}

/**
 * Check if a list of edges forms a valid path (they chain together).
 */
export function isValidPath(edges) {
  if (edges.length === 0) return true;
  
  for (let i = 1; i < edges.length; i++) {
    if (!edgesChain(edges[i - 1], edges[i])) {
      return false;
    }
  }
  return true;
}

/**
 * Get all points in a path.
 */
export function getAllPointsInPath(edges) {
  const points = [];
  for (const edge of edges) {
    points.push(edge.from);
    points.push(edge.to);
  }
  return points;
}

/**
 * Check if a point already exists in the path (considering identifications).
 */
export function pointExistsInPath(point, edges) {
  const allPoints = getAllPointsInPath(edges);
  return allPoints.some(p => pointsAreEqual(p, point));
}

/**
 * Line segment intersection detection in paper coordinates.
 * Returns true if line segment (p1, p2) intersects (p3, p4)
 * where p1, p2, p3, p4 are {southward, eastward} coordinates.
 */
function segmentsIntersectPaper(p1, p2, p3, p4) {
  function ccw(A, B, C) {
    return (C.eastward - A.eastward) * (B.southward - A.southward) > 
           (B.eastward - A.eastward) * (C.southward - A.southward);
  }
  
  function pointsClose(a, b) {
    return Math.abs(a.southward - b.southward) < EPSILON && 
           Math.abs(a.eastward - b.eastward) < EPSILON;
  }
  
  // Segments sharing an endpoint are allowed to touch
  if (pointsClose(p1, p3) || pointsClose(p1, p4) || pointsClose(p2, p3) || pointsClose(p2, p4)) {
    return false;
  }
  
  return (ccw(p1, p3, p4) !== ccw(p2, p3, p4)) && (ccw(p1, p2, p3) !== ccw(p1, p2, p4));
}

/**
 * Get paper coordinates for an edge (as line segment in unit square).
 */
export function getEdgePaperCoordinates(edge) {
  return {
    from: getPointPaperCoordinates(edge.from),
    to: getPointPaperCoordinates(edge.to)
  };
}

/**
 * Get screen coordinates for an edge (as line segment).
 */
export function getEdgeCoordinates(edge) {
  return {
    from: getPointCoordinates(edge.from),
    to: getPointCoordinates(edge.to)
  };
}

/**
 * Check if two edges cross (using paper coordinates).
 */
export function edgesCross(edge1, edge2) {
  const coords1 = getEdgePaperCoordinates(edge1);
  const coords2 = getEdgePaperCoordinates(edge2);
  return segmentsIntersectPaper(coords1.from, coords1.to, coords2.from, coords2.to);
}

/**
 * Check if an edge crosses any existing edge in the path.
 * Returns { crosses: boolean, crossingEdgeIndex: number | null }
 */
export function edgeCrossesPath(newEdge, existingEdges) {
  for (let i = 0; i < existingEdges.length; i++) {
    if (edgesCross(newEdge, existingEdges[i])) {
      return { crosses: true, crossingEdgeIndex: i };
    }
  }
  return { crosses: false, crossingEdgeIndex: null };
}

/**
 * Check if a path is non-crossing.
 */
export function isNonCrossing(edges) {
  for (let i = 0; i < edges.length; i++) {
    for (let j = i + 1; j < edges.length; j++) {
      if (edgesCross(edges[i], edges[j])) {
        return false;
      }
    }
  }
  return true;
}

/**
 * Check if an edge is a same-side edge (both endpoints on literally the same side).
 * Only edges from a side to itself are forbidden (e.g., north→north, east→east).
 * Edges between identified sides are allowed (e.g., north→east, south→west).
 */
export function isSameSideEdge(edge) {
  if (isInteriorPoint(edge.from) || isInteriorPoint(edge.to)) {
    return false;
  }
  return edge.from.side === edge.to.side;
}

/**
 * Format a point for error messages.
 */
function formatPoint(point) {
  if (isInteriorPoint(point)) {
    return `interior (${(point.southward * 100).toFixed(1)}%, ${(point.eastward * 100).toFixed(1)}%)`;
  }
  return `${point.side} ${(point.t * 100).toFixed(1)}%`;
}

/**
 * Validate a single point (boundary or interior).
 */
function isValidPoint(point) {
  if (isInteriorPoint(point)) {
    return typeof point.southward === 'number' && 
           typeof point.eastward === 'number' &&
           point.southward >= 0 && point.southward <= 1 && 
           point.eastward >= 0 && point.eastward <= 1;
  }
  
  // Boundary point
  return SIDES.includes(point.side) && 
         typeof point.t === 'number' && 
         point.t >= 0 && point.t <= 1;
}

/**
 * Validate a complete path.
 * Returns { valid: boolean, error?: string }
 */
export function validatePath(edges) {
  if (edges.length === 0) return { valid: true };
  
  // Check that each edge has valid structure
  for (let i = 0; i < edges.length; i++) {
    const edge = edges[i];
    if (!edge.from || !edge.to) {
      return { valid: false, error: `Edge ${i} missing from or to` };
    }
    if (!isValidPoint(edge.from)) {
      return { valid: false, error: `Edge ${i} has invalid 'from' point` };
    }
    if (!isValidPoint(edge.to)) {
      return { valid: false, error: `Edge ${i} has invalid 'to' point` };
    }
    if (isSameSideEdge(edge)) {
      return { valid: false, error: `Edge ${i} is a same-side edge (from ${edge.from.side} to ${edge.to.side}), which is forbidden` };
    }
  }
  
  if (!isValidPath(edges)) {
    return { valid: false, error: 'Edges do not chain together properly' };
  }
  
  if (!isNonCrossing(edges)) {
    return { valid: false, error: 'Edges cross each other' };
  }
  
  // Check for loops (no repeated points except consecutive endpoints)
  const seenPoints = [];
  for (let i = 0; i < edges.length; i++) {
    const edge = edges[i];
    
    // Check if 'from' point was already seen (except for the immediate previous 'to')
    for (let j = 0; j < seenPoints.length - 1; j++) {
      if (pointsAreEqual(edge.from, seenPoints[j])) {
        return { valid: false, error: `Loop detected: point at ${formatPoint(edge.from)} already exists in path` };
      }
    }
    
    // Check if 'to' point already exists anywhere
    for (const p of seenPoints) {
      if (pointsAreEqual(edge.to, p)) {
        return { valid: false, error: `Loop detected: point at ${formatPoint(edge.to)} already exists in path` };
      }
    }
    
    seenPoints.push(edge.from);
    seenPoints.push(edge.to);
  }
  
  return { valid: true };
}

/**
 * Check if adding a new edge would be valid.
 * Returns { valid: boolean, error?: string, crossingEdgeIndex?: number }
 */
export function canAddEdge(newEdge, existingEdges) {
  if (isSameSideEdge(newEdge)) {
    const fromSide = isInteriorPoint(newEdge.from) ? 'interior' : newEdge.from.side;
    const toSide = isInteriorPoint(newEdge.to) ? 'interior' : newEdge.to.side;
    return { valid: false, error: `Same-side edges are forbidden (from ${fromSide} to ${toSide})` };
  }
  
  if (existingEdges.length > 0) {
    const lastEdge = existingEdges[existingEdges.length - 1];
    if (!pointsAreEqual(lastEdge.to, newEdge.from)) {
      return { valid: false, error: 'New edge does not chain with the last edge' };
    }
  }
  
  if (pointExistsInPath(newEdge.to, existingEdges)) {
    return { valid: false, error: 'Destination point already exists in path (would create loop)' };
  }
  
  const crossingResult = edgeCrossesPath(newEdge, existingEdges);
  if (crossingResult.crosses) {
    return { 
      valid: false, 
      error: `New edge would cross existing edge #${crossingResult.crossingEdgeIndex + 1}`,
      crossingEdgeIndex: crossingResult.crossingEdgeIndex
    };
  }
  
  return { valid: true };
}

/**
 * Get the starting point for a new edge (the complementary/identified version of the last endpoint).
 * - If last edge ended on north, next starts from east (and vice versa)
 * - If last edge ended on south, next starts from west (and vice versa)
 * - If last edge ended on interior, next starts from the same interior point
 */
export function getNextEdgeStartPoints(edges) {
  if (edges.length === 0) return null;
  
  const endPoint = edges[edges.length - 1].to;
  
  if (isInteriorPoint(endPoint)) {
    return [{ interior: true, southward: endPoint.southward, eastward: endPoint.eastward }];
  }
  
  const identifiedSide = getIdentifiedSide(endPoint.side);
  return [{ side: identifiedSide, t: endPoint.t }];
}
