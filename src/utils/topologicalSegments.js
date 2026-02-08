/**
 * Topological path entry mode utilities.
 * 
 * This module computes the discrete topological choices for where to go next
 * in a path. For each side (including the one you just came from), we determine
 * all the possible segments that you could get to. The segments are formed by
 * dividing each side by the points already in the path.
 * 
 * For each segment we check whether it is possible to get there without crossing
 * existing edges.
 */

import { NavMesh } from 'nav2d';
import { 
  getPointCoordinates, 
  isInteriorPoint,
  getIdentifiedSide,
  rhombusToUnitSquare,
  SIDES,
  EPSILON
} from './geometry.js';
import { 
  getAllPointsInPath,
  edgeCrossesPath,
  pointExistsInPath,
  isSameSideEdge
} from './pathLogic.js';

/**
 * Get the paper coordinates of the four corners of the unit square.
 */
const CORNERS = {
  nw: { southward: 0, eastward: 0 },
  ne: { southward: 0, eastward: 1 },
  se: { southward: 1, eastward: 1 },
  sw: { southward: 1, eastward: 0 }
};

/**
 * Get all boundary points on a specific side from the path.
 * Returns an array of t values sorted in increasing order.
 */
export function getPathPointsOnSide(side, edges) {
  const points = getAllPointsInPath(edges);
  const tValues = [];
  
  for (const point of points) {
    if (isInteriorPoint(point)) continue;
    
    // Check if this point is on the specified side or its identified pair
    const identifiedSide = getIdentifiedSide(side);
    if (point.side === side || point.side === identifiedSide) {
      // Add the t value if not already present
      if (!tValues.some(t => Math.abs(t - point.t) < EPSILON)) {
        tValues.push(point.t);
      }
    }
  }
  
  return tValues.sort((a, b) => a - b);
}

/**
 * Get the segments on a side, divided by the path points.
 * Returns an array of { start: t, end: t, midpoint: t } objects.
 * Segments are in the "natural" direction of the side:
 * - north: 0 (west) to 1 (east)
 * - east: 0 (south) to 1 (north)
 * - south: 0 (east) to 1 (west)
 * - west: 0 (north) to 1 (south)
 */
export function getSegmentsOnSide(side, edges) {
  const tValues = getPathPointsOnSide(side, edges);
  const segments = [];
  
  // Always include 0 and 1 as boundaries
  const boundaries = [0, ...tValues, 1].filter((t, i, arr) => 
    i === 0 || Math.abs(t - arr[i - 1]) > EPSILON
  );
  
  // Create segments between consecutive boundaries
  for (let i = 0; i < boundaries.length - 1; i++) {
    if (boundaries[i + 1] - boundaries[i] > EPSILON) {
      segments.push({
        start: boundaries[i],
        end: boundaries[i + 1],
        midpoint: (boundaries[i] + boundaries[i + 1]) / 2
      });
    }
  }
  
  return segments;
}

/**
 * Get all segments on all sides.
 * Returns a Map of side -> segments array.
 */
export function getAllSegments(edges) {
  const allSegments = new Map();
  
  for (const side of SIDES) {
    allSegments.set(side, getSegmentsOnSide(side, edges));
  }
  
  return allSegments;
}

/**
 * Check if a segment on a side is reachable from a starting point
 * without crossing any existing edges.
 * 
 * @param {Object} fromPoint - The starting point (boundary or interior)
 * @param {string} targetSide - The side to reach
 * @param {Object} segment - The segment { start, end, midpoint }
 * @param {Object[]} edges - Existing edges in the path
 * @returns {Object} { reachable: boolean, reason?: string }
 */
export function isSegmentReachable(fromPoint, targetSide, segment, edges) {
  // Create a test edge from the starting point to the segment midpoint
  const toPoint = { side: targetSide, t: segment.midpoint };
  
  // Check same-side constraint
  const testEdge = { from: fromPoint, to: toPoint };
  if (isSameSideEdge(testEdge)) {
    return { reachable: false, reason: 'same-side edge forbidden' };
  }
  
  // Check if destination already exists in path (would create loop)
  if (pointExistsInPath(toPoint, edges)) {
    return { reachable: false, reason: 'destination already in path' };
  }
  
  // Check if the direct edge would cross any existing edge
  const crossResult = edgeCrossesPath(testEdge, edges);
  if (crossResult.crosses) {
    return { reachable: false, reason: 'crosses existing edge', crossingIndex: crossResult.crossingEdgeIndex };
  }
  
  return { reachable: true };
}

/**
 * Get all reachable segments from the current position.
 * 
 * @param {Object[]} edges - Current path edges
 * @returns {Object[]} Array of { side, segment, description }
 */
export function getReachableSegments(edges) {
  if (edges.length === 0) {
    // No edges yet - all sides are reachable, return all segments
    const allSegments = getAllSegments(edges);
    const options = [];
    
    for (const side of SIDES) {
      const segments = allSegments.get(side);
      for (const segment of segments) {
        options.push({
          side,
          segment,
          description: formatSegmentDescription(side, segment),
          type: 'initial'
        });
      }
    }
    
    return options;
  }
  
  // Get the continuation point (where we're coming from)
  const lastPoint = edges[edges.length - 1].to;
  
  // For interior points, the continuation is the same point
  // For boundary points, the continuation is on the identified side
  let fromPoint;
  if (isInteriorPoint(lastPoint)) {
    fromPoint = { interior: true, southward: lastPoint.southward, eastward: lastPoint.eastward };
  } else {
    fromPoint = { side: getIdentifiedSide(lastPoint.side), t: lastPoint.t };
  }
  
  const allSegments = getAllSegments(edges);
  const options = [];
  
  for (const side of SIDES) {
    const segments = allSegments.get(side);
    for (const segment of segments) {
      const reachability = isSegmentReachable(fromPoint, side, segment, edges);
      if (reachability.reachable) {
        options.push({
          side,
          segment,
          description: formatSegmentDescription(side, segment),
          fromPoint,
          type: 'continuation'
        });
      }
    }
  }
  
  return options;
}

/**
 * Format a human-readable description of a segment.
 */
function formatSegmentDescription(side, segment) {
  const startPct = Math.round(segment.start * 100);
  const endPct = Math.round(segment.end * 100);
  
  // Get the identifying bounds for the segment
  const bounds = [];
  if (segment.start === 0) {
    bounds.push(getCornerName(side, 'start'));
  } else {
    bounds.push(`${startPct}%`);
  }
  
  if (segment.end === 1) {
    bounds.push(getCornerName(side, 'end'));
  } else {
    bounds.push(`${endPct}%`);
  }
  
  const sideName = side.charAt(0).toUpperCase() + side.slice(1);
  return `${sideName}: ${bounds[0]} to ${bounds[1]}`;
}

/**
 * Get the corner name for a side at start (t=0) or end (t=1).
 */
function getCornerName(side, position) {
  const corners = {
    north: { start: 'NW', end: 'NE' },
    east: { start: 'SE', end: 'NE' },
    south: { start: 'SE', end: 'SW' },
    west: { start: 'NW', end: 'SW' }
  };
  return corners[side][position];
}

/**
 * Create a navigation mesh from the current path.
 * The mesh represents the walkable area (interior of the rhombus)
 * with obstacles created by the existing edges.
 * 
 * @returns {NavMesh} The navigation mesh
 */
export function createNavMesh() {
  // For now, we create a simple triangulated mesh of the rhombus
  // TODO: Add support for obstacles based on existing edges
  
  // The rhombus in paper coordinates is the unit square
  // We'll use screen coordinates for the nav mesh
  const nw = getPointCoordinates({ side: 'north', t: 0 });
  const ne = getPointCoordinates({ side: 'north', t: 1 });
  const se = getPointCoordinates({ side: 'south', t: 0 });
  const sw = getPointCoordinates({ side: 'south', t: 1 });
  
  // Simple triangle mesh of the rhombus (two triangles)
  const polygons = [
    [[nw.x, nw.y], [ne.x, ne.y], [se.x, se.y]],
    [[nw.x, nw.y], [se.x, se.y], [sw.x, sw.y]]
  ];
  
  return new NavMesh(polygons);
}

/**
 * Plan a path from the current position to a target segment.
 * Returns either a direct edge or a sequence of edges with internal nodes.
 * 
 * @param {Object} fromPoint - Starting point
 * @param {string} targetSide - Target side
 * @param {Object} segment - Target segment
 * @param {Object[]} existingEdges - Existing path edges
 * @returns {Object} { edges: Edge[], success: boolean, error?: string }
 */
export function planPathToSegment(fromPoint, targetSide, segment, existingEdges) {
  const toPoint = { side: targetSide, t: segment.midpoint };
  
  // First, try a direct edge
  const directEdge = { from: fromPoint, to: toPoint };
  const crossResult = edgeCrossesPath(directEdge, existingEdges);
  
  if (!crossResult.crosses) {
    // Direct path is possible
    return { edges: [directEdge], success: true };
  }
  
  // Need to route around obstacles using nav2d
  const fromCoords = getPointCoordinates(fromPoint);
  const toCoords = getPointCoordinates(toPoint);
  
  try {
    const navmesh = createNavMesh(existingEdges);
    const path = navmesh.findPath([fromCoords.x, fromCoords.y], [toCoords.x, toCoords.y]);
    
    if (!path || path.length < 2) {
      return { edges: [], success: false, error: 'No path found' };
    }
    
    // Convert path points to edges
    // Note: nav2d returns path as array of [x, y] points
    // We need to convert intermediate points to interior points
    const resultEdges = [];
    let currentFrom = fromPoint;
    
    for (let i = 1; i < path.length; i++) {
      const point = path[i];
      const isLast = i === path.length - 1;
      
      let to;
      if (isLast) {
        to = toPoint;
      } else {
        // This is an intermediate point, make it an interior point
        // Convert screen coordinates back to paper coordinates
        const { southward, eastward } = screenToPaper(point[0], point[1]);
        to = { interior: true, southward, eastward };
      }
      
      resultEdges.push({ from: currentFrom, to });
      currentFrom = to;
    }
    
    // Verify the routed path doesn't cross any existing edges
    for (const edge of resultEdges) {
      const cross = edgeCrossesPath(edge, existingEdges);
      if (cross.crosses) {
        return { edges: [], success: false, error: 'Routed path crosses existing edge' };
      }
    }
    
    return { edges: resultEdges, success: true };
    
  } catch (error) {
    return { edges: [], success: false, error: error.message };
  }
}

/**
 * Convert screen coordinates back to paper coordinates (southward, eastward).
 * This is a simplified version that works for points inside the rhombus.
 */
function screenToPaper(x, y) {
  const result = rhombusToUnitSquare(x, y);
  return {
    southward: Math.max(0, Math.min(1, result.southward)),
    eastward: Math.max(0, Math.min(1, result.eastward))
  };
}

/**
 * Get all topological options for the current state.
 * Groups segments by side and indicates if they're reachable.
 * 
 * @param {Object[]} edges - Current path edges
 * @returns {Object} { options: OptionGroup[], currentPoint: Point }
 */
export function getTopologicalOptions(edges) {
  const reachableSegments = getReachableSegments(edges);
  
  // Group by side
  const bySide = new Map();
  for (const side of SIDES) {
    bySide.set(side, []);
  }
  
  for (const option of reachableSegments) {
    bySide.get(option.side).push(option);
  }
  
  // Convert to array format
  const optionGroups = [];
  for (const side of SIDES) {
    const segments = bySide.get(side);
    const identifiedWith = getIdentifiedSide(side);
    
    optionGroups.push({
      side,
      identifiedWith,
      segments,
      hasOptions: segments.length > 0
    });
  }
  
  // Get current point
  let currentPoint = null;
  if (edges.length > 0) {
    const lastTo = edges[edges.length - 1].to;
    if (isInteriorPoint(lastTo)) {
      currentPoint = lastTo;
    } else {
      currentPoint = { side: getIdentifiedSide(lastTo.side), t: lastTo.t };
    }
  }
  
  return { 
    optionGroups,
    currentPoint,
    hasPath: edges.length > 0
  };
}
