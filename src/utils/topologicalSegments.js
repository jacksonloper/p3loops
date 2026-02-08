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

import { NavMesh } from 'nav2d/src/nav2d.js';
import { 
  getPointPaperCoordinates,
  isInteriorPoint,
  getIdentifiedSide,
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
 * Check if a segment on a side is reachable from a starting point.
 * Now uses pathfinding to determine reachability, not just direct line.
 * 
 * @param {Object} fromPoint - The starting point (boundary or interior)
 * @param {string} targetSide - The side to reach
 * @param {Object} segment - The segment { start, end, midpoint }
 * @param {Object[]} edges - Existing edges in the path
 * @returns {Object} { reachable: boolean, direct: boolean, reason?: string }
 */
export function isSegmentReachable(fromPoint, targetSide, segment, edges) {
  // Create a test edge from the starting point to the segment midpoint
  const toPoint = { side: targetSide, t: segment.midpoint };
  
  // Check same-side constraint
  const testEdge = { from: fromPoint, to: toPoint };
  if (isSameSideEdge(testEdge)) {
    return { reachable: false, direct: false, reason: 'same-side edge forbidden' };
  }
  
  // Check if destination already exists in path (would create loop)
  if (pointExistsInPath(toPoint, edges)) {
    return { reachable: false, direct: false, reason: 'destination already in path' };
  }
  
  // First check if the direct edge would work
  const crossResult = edgeCrossesPath(testEdge, edges);
  if (!crossResult.crosses) {
    return { reachable: true, direct: true };
  }
  
  // Direct path blocked - try to find a routed path
  const routeResult = findRoutedPath(fromPoint, toPoint, edges);
  if (routeResult.success) {
    return { reachable: true, direct: false, routeLength: routeResult.edges.length };
  }
  
  return { reachable: false, direct: false, reason: 'no path available' };
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
          type: 'continuation',
          direct: reachability.direct,
          routeLength: reachability.routeLength || 1
        });
      }
    }
  }
  
  return options;
}

/**
 * Format a human-readable description of a segment.
 */
export function formatSegmentDescription(side, segment) {
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
 * Grid resolution for nav2d mesh triangulation.
 * Higher values = more precise paths but slower computation.
 */
const GRID_RESOLUTION = 15;

/**
 * Generate a grid of triangles for nav2d NavMesh.
 * Creates triangles covering the unit square [0,1]×[0,1].
 * 
 * @returns {Array} Array of triangles (each triangle is [[x,y], [x,y], [x,y]])
 */
function createGridTriangles() {
  const triangles = [];
  const step = 1 / GRID_RESOLUTION;
  
  for (let i = 0; i < GRID_RESOLUTION; i++) {
    for (let j = 0; j < GRID_RESOLUTION; j++) {
      const x0 = i * step;
      const y0 = j * step;
      const x1 = (i + 1) * step;
      const y1 = (j + 1) * step;
      
      // Two triangles per grid cell
      // Note: nav2d uses [x, y] coordinates, we use [eastward, southward]
      // Our paper coords: eastward = x, southward = y
      triangles.push([[x0, y0], [x1, y0], [x0, y1]]);
      triangles.push([[x1, y0], [x1, y1], [x0, y1]]);
    }
  }
  return triangles;
}

/**
 * Check the sign of the cross product for three points.
 * Used for determining if segments intersect.
 */
function crossProductSign(p1, p2, p3) {
  return (p3[0] - p1[0]) * (p2[1] - p1[1]) - (p2[0] - p1[0]) * (p3[1] - p1[1]);
}

/**
 * Check if two line segments properly intersect (cross each other).
 * Does not count touching or collinear cases.
 */
function segmentsProperlyIntersect(a1, a2, b1, b2) {
  const d1 = crossProductSign(b1, b2, a1);
  const d2 = crossProductSign(b1, b2, a2);
  const d3 = crossProductSign(a1, a2, b1);
  const d4 = crossProductSign(a1, a2, b2);
  
  // Proper crossing: points on opposite sides
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
      ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
    return true;
  }
  return false;
}

/**
 * Check if a line segment intersects any edge of a triangle.
 */
function lineIntersectsTriangle(p1, p2, tri) {
  for (let i = 0; i < 3; i++) {
    if (segmentsProperlyIntersect(p1, p2, tri[i], tri[(i + 1) % 3])) {
      return true;
    }
  }
  return false;
}

/**
 * Build a NavMesh for pathfinding, excluding triangles crossed by blocking edges.
 * 
 * @param {Object[]} existingEdges - Edges that act as barriers
 * @returns {NavMesh|null} NavMesh instance or null if mesh is empty
 */
function buildNavMesh(existingEdges) {
  const allTriangles = createGridTriangles();
  
  // Convert existing edges to [x, y] format for intersection testing
  // Our paper coords: eastward = x, southward = y
  const blockingLines = existingEdges.map(edge => {
    const from = getPointPaperCoordinates(edge.from);
    const to = getPointPaperCoordinates(edge.to);
    return [[from.eastward, from.southward], [to.eastward, to.southward]];
  });
  
  // Filter out triangles that any blocking edge passes through
  const validTriangles = allTriangles.filter(tri => {
    for (const [p1, p2] of blockingLines) {
      if (lineIntersectsTriangle(p1, p2, tri)) {
        return false;
      }
    }
    return true;
  });
  
  if (validTriangles.length === 0) {
    return null;
  }
  
  return new NavMesh(validTriangles, { triangulate: false });
}

/**
 * Check if a line segment between two paper-coordinate points
 * crosses any of the existing edges.
 */
function lineSegmentCrossesEdges(p1, p2, existingEdges) {
  // Create a temporary edge to check
  const tempEdge = {
    from: { interior: true, southward: p1.southward, eastward: p1.eastward },
    to: { interior: true, southward: p2.southward, eastward: p2.eastward }
  };
  
  return edgeCrossesPath(tempEdge, existingEdges).crosses;
}

/**
 * Convert a point (boundary or interior) to paper coordinates.
 */
function pointToPaperCoords(point) {
  if (isInteriorPoint(point)) {
    return { southward: point.southward, eastward: point.eastward };
  }
  // For boundary points, use the geometry function
  return getPointPaperCoordinates(point);
}

/**
 * Convert nav2d path waypoints to our edge format.
 * Nav2d returns points in [x, y] format, we need our point objects.
 * 
 * @param {Array} nav2dPath - Path from nav2d findPath (array of Vector objects)
 * @param {Object} fromPoint - Original starting point
 * @param {Object} toPoint - Original destination point
 * @returns {Object[]} Array of edges in our format
 */
function convertNav2dPathToEdges(nav2dPath, fromPoint, toPoint) {
  if (!nav2dPath || nav2dPath.length < 2) {
    return [];
  }
  
  const edges = [];
  
  for (let i = 0; i < nav2dPath.length - 1; i++) {
    const currentWp = nav2dPath[i];
    const nextWp = nav2dPath[i + 1];
    
    // Determine edge 'from' point
    let edgeFrom;
    if (i === 0) {
      edgeFrom = fromPoint;
    } else {
      // Interior point from nav2d (x = eastward, y = southward)
      edgeFrom = { interior: true, southward: currentWp.y, eastward: currentWp.x };
    }
    
    // Determine edge 'to' point
    let edgeTo;
    if (i === nav2dPath.length - 2) {
      edgeTo = toPoint;
    } else {
      // Interior point from nav2d
      edgeTo = { interior: true, southward: nextWp.y, eastward: nextWp.x };
    }
    
    edges.push({ from: edgeFrom, to: edgeTo });
  }
  
  return edges;
}

/**
 * Pathfinding using nav2d NavMesh to route around obstacles.
 * Falls back to direct path check and validates that nav2d paths don't cross edges.
 * 
 * @param {Object} fromPoint - Starting point (boundary or interior)
 * @param {Object} toPoint - Destination point (boundary or interior)  
 * @param {Object[]} existingEdges - Existing edges to avoid crossing
 * @returns {Object} { success: boolean, edges?: Edge[], error?: string }
 */
export function findRoutedPath(fromPoint, toPoint, existingEdges) {
  const fromCoords = pointToPaperCoords(fromPoint);
  const toCoords = pointToPaperCoords(toPoint);
  
  // First, check if direct path is possible
  if (!lineSegmentCrossesEdges(fromCoords, toCoords, existingEdges)) {
    return {
      success: true,
      edges: [{ from: fromPoint, to: toPoint }]
    };
  }
  
  // Build nav2d mesh with blocking edges
  const mesh = buildNavMesh(existingEdges);
  
  if (!mesh) {
    return { success: false, error: 'Could not build navigation mesh' };
  }
  
  // Nav2d uses [x, y] format: x = eastward, y = southward
  const startPoint = [fromCoords.eastward, fromCoords.southward];
  const endPoint = [toCoords.eastward, toCoords.southward];
  
  // Find path using nav2d
  const nav2dPath = mesh.findPath(startPoint, endPoint);
  
  if (!nav2dPath) {
    return { success: false, error: 'No path found through navigation mesh' };
  }
  
  // Convert nav2d path to our edge format
  const edges = convertNav2dPathToEdges(nav2dPath, fromPoint, toPoint);
  
  if (edges.length === 0) {
    return { success: false, error: 'Path conversion failed' };
  }
  
  // Validate that the path doesn't cross any blocking edges
  // and try to simplify path segments that do cross
  const validEdges = [];
  let currentFrom = fromPoint;
  
  for (let i = 0; i < edges.length; i++) {
    const edge = edges[i];
    const edgeToCheck = { from: currentFrom, to: edge.to };
    
    if (!edgeCrossesPath(edgeToCheck, existingEdges).crosses) {
      // Direct path to this waypoint is valid
      validEdges.push(edgeToCheck);
      currentFrom = edge.to;
    } else if (i < edges.length - 1) {
      // Try skipping waypoints to find a valid path
      let foundValid = false;
      for (let j = i + 1; j < edges.length; j++) {
        const skipEdge = { from: currentFrom, to: edges[j].to };
        if (!edgeCrossesPath(skipEdge, existingEdges).crosses) {
          validEdges.push(skipEdge);
          currentFrom = edges[j].to;
          i = j; // Skip intermediate waypoints
          foundValid = true;
          break;
        }
      }
      if (!foundValid) {
        return { success: false, error: 'Could not validate path segment' };
      }
    } else {
      return { success: false, error: 'Final path segment crosses blocking edge' };
    }
  }
  
  return { success: true, edges: validEdges };
}

/**
 * Simplify a routed path by removing unnecessary waypoints.
 * If we can go directly from A to C without crossing edges, remove B.
 */
function simplifyPath(edges, existingEdges) {
  if (edges.length <= 1) return edges;
  
  const simplified = [edges[0]];
  
  for (let i = 1; i < edges.length; i++) {
    const lastSimplified = simplified[simplified.length - 1];
    const current = edges[i];
    
    // Try to merge: can we go directly from lastSimplified.from to current.to?
    const fromCoords = pointToPaperCoords(lastSimplified.from);
    const toCoords = pointToPaperCoords(current.to);
    
    if (!lineSegmentCrossesEdges(fromCoords, toCoords, existingEdges)) {
      // We can merge - update the last simplified edge
      simplified[simplified.length - 1] = {
        from: lastSimplified.from,
        to: current.to
      };
    } else {
      // Can't merge - add current edge
      simplified.push(current);
    }
  }
  
  return simplified;
}

/**
 * Plan a path from the current position to a target segment.
 * Returns either a direct edge or a sequence of edges with internal nodes.
 * Uses nav2d NavMesh for pathfinding around obstacles.
 * 
 * @param {Object} fromPoint - Starting point
 * @param {string} targetSide - Target side
 * @param {Object} segment - Target segment
 * @param {Object[]} existingEdges - Existing path edges
 * @returns {Object} { edges: Edge[], success: boolean, error?: string }
 */
export function planPathToSegment(fromPoint, targetSide, segment, existingEdges) {
  const toPoint = { side: targetSide, t: segment.midpoint };
  
  // Use the grid-based routing
  const result = findRoutedPath(fromPoint, toPoint, existingEdges);
  
  if (!result.success) {
    return result;
  }
  
  // Simplify the path to remove unnecessary waypoints
  const simplifiedEdges = simplifyPath(result.edges, existingEdges);
  
  // Verify the final path doesn't cross any existing edges
  for (const edge of simplifiedEdges) {
    const cross = edgeCrossesPath(edge, existingEdges);
    if (cross.crosses) {
      return { edges: [], success: false, error: 'Routed path crosses existing edge' };
    }
  }
  
  return { edges: simplifiedEdges, success: true };
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
