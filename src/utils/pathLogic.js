/**
 * Path logic for edges on the bowed square.
 * 
 * An edge is defined by:
 *   { from: { side, t }, to: { side, t } }
 * where t is the percentage (0-1) along the side.
 * 
 * A path is a list of edges that chain together (endpoint of one = startpoint of next).
 * Paths must be non-crossing and cannot form loops.
 */

import { getIdentifiedSide, pointsAreEqual, getPointOnSide, SIDES } from './geometry.js';

// Normalize a point to its canonical representation
// We'll use the first alphabetically between the side and its identified side
export function normalizePoint(point) {
  const identified = getIdentifiedSide(point.side);
  if (point.side < identified) {
    return { side: point.side, t: point.t };
  }
  return { side: identified, t: point.t };
}

// Check if an edge forms a valid chain with the previous edge
export function edgesChain(prevEdge, nextEdge) {
  return pointsAreEqual(prevEdge.to, nextEdge.from);
}

// Check if a list of edges forms a valid path (they chain together)
export function isValidPath(edges) {
  if (edges.length === 0) return true;
  
  for (let i = 1; i < edges.length; i++) {
    if (!edgesChain(edges[i - 1], edges[i])) {
      return false;
    }
  }
  return true;
}

// Get all points in a path
export function getAllPointsInPath(edges) {
  const points = [];
  for (const edge of edges) {
    points.push(edge.from);
    points.push(edge.to);
  }
  return points;
}

// Check if a point already exists in the path (considering identifications)
export function pointExistsInPath(point, edges) {
  const allPoints = getAllPointsInPath(edges);
  return allPoints.some(p => pointsAreEqual(p, point));
}

// Line segment intersection detection
// Returns true if line segment (p1, p2) intersects (p3, p4)
function segmentsIntersect(p1, p2, p3, p4) {
  function ccw(A, B, C) {
    return (C.y - A.y) * (B.x - A.x) > (B.y - A.y) * (C.x - A.x);
  }
  
  // Check if segments share an endpoint (they're allowed to touch at endpoints)
  const eps = 0.0001;
  function pointsClose(a, b) {
    return Math.abs(a.x - b.x) < eps && Math.abs(a.y - b.y) < eps;
  }
  
  if (pointsClose(p1, p3) || pointsClose(p1, p4) || pointsClose(p2, p3) || pointsClose(p2, p4)) {
    return false; // Sharing endpoint is OK
  }
  
  return (ccw(p1, p3, p4) !== ccw(p2, p3, p4)) && (ccw(p1, p2, p3) !== ccw(p1, p2, p4));
}

// Get screen coordinates for an edge (as line segment)
export function getEdgeCoordinates(edge) {
  const from = getPointOnSide(edge.from.side, edge.from.t);
  const to = getPointOnSide(edge.to.side, edge.to.t);
  return { from, to };
}

// Check if two edges cross
export function edgesCross(edge1, edge2) {
  const coords1 = getEdgeCoordinates(edge1);
  const coords2 = getEdgeCoordinates(edge2);
  return segmentsIntersect(coords1.from, coords1.to, coords2.from, coords2.to);
}

// Check if an edge crosses any existing edge in the path
export function edgeCrossesPath(newEdge, existingEdges) {
  for (const edge of existingEdges) {
    if (edgesCross(newEdge, edge)) {
      return true;
    }
  }
  return false;
}

// Check if a path is non-crossing
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

// Validate a complete path
export function validatePath(edges) {
  if (edges.length === 0) return { valid: true };
  
  // Check that each edge has valid structure
  for (let i = 0; i < edges.length; i++) {
    const edge = edges[i];
    if (!edge.from || !edge.to) {
      return { valid: false, error: `Edge ${i} missing from or to` };
    }
    if (!SIDES.includes(edge.from.side) || !SIDES.includes(edge.to.side)) {
      return { valid: false, error: `Edge ${i} has invalid side` };
    }
    if (typeof edge.from.t !== 'number' || typeof edge.to.t !== 'number') {
      return { valid: false, error: `Edge ${i} has invalid t value` };
    }
    if (edge.from.t < 0 || edge.from.t > 1 || edge.to.t < 0 || edge.to.t > 1) {
      return { valid: false, error: `Edge ${i} t values must be between 0 and 1` };
    }
  }
  
  // Check that edges chain together
  if (!isValidPath(edges)) {
    return { valid: false, error: 'Edges do not chain together properly' };
  }
  
  // Check for non-crossing
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
        return { valid: false, error: `Loop detected: point at ${edge.from.side} ${(edge.from.t * 100).toFixed(1)}% already exists in path` };
      }
    }
    
    // Check if 'to' point already exists anywhere
    for (const p of seenPoints) {
      if (pointsAreEqual(edge.to, p)) {
        return { valid: false, error: `Loop detected: point at ${edge.to.side} ${(edge.to.t * 100).toFixed(1)}% already exists in path` };
      }
    }
    
    seenPoints.push(edge.from);
    seenPoints.push(edge.to);
  }
  
  return { valid: true };
}

// Check if adding a new edge would be valid
export function canAddEdge(newEdge, existingEdges) {
  // Check that it chains with the last edge
  if (existingEdges.length > 0) {
    const lastEdge = existingEdges[existingEdges.length - 1];
    if (!pointsAreEqual(lastEdge.to, newEdge.from)) {
      return { valid: false, error: 'New edge does not chain with the last edge' };
    }
  }
  
  // Check that the destination point doesn't already exist
  if (pointExistsInPath(newEdge.to, existingEdges)) {
    return { valid: false, error: 'Destination point already exists in path (would create loop)' };
  }
  
  // Check for crossings
  if (edgeCrossesPath(newEdge, existingEdges)) {
    return { valid: false, error: 'New edge would cross an existing edge' };
  }
  
  return { valid: true };
}

// Get the starting point for a new edge (the complementary/identified version of the last endpoint)
// If the last edge ended on north, the next edge must start from east (and vice versa)
// If the last edge ended on south, the next edge must start from west (and vice versa)
export function getNextEdgeStartPoints(edges) {
  if (edges.length === 0) return null;
  
  const lastEdge = edges[edges.length - 1];
  const endPoint = lastEdge.to;
  const identifiedSide = getIdentifiedSide(endPoint.side);
  
  // Only return the complementary point (not the same side)
  return [
    { side: identifiedSide, t: endPoint.t }
  ];
}
