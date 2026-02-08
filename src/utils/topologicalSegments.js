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
 * Grid resolution for pathfinding.
 * Higher values = more precise paths but slower computation.
 */
const GRID_RESOLUTION = 10;

/**
 * Generate waypoints for pathfinding.
 * Includes interior grid points AND boundary points to enable routing around edges.
 * 
 * @param {Object[]} existingEdges - Existing edges to consider for boundary waypoints
 * @returns {Object[]} Array of waypoints with paper coordinates and type info
 */
function generateWaypoints(existingEdges) {
  const waypoints = [];
  const step = 1 / (GRID_RESOLUTION + 1);
  
  // Interior grid waypoints
  for (let i = 1; i <= GRID_RESOLUTION; i++) {
    for (let j = 1; j <= GRID_RESOLUTION; j++) {
      waypoints.push({
        southward: i * step,
        eastward: j * step,
        type: 'interior'
      });
    }
  }
  
  // Boundary waypoints along each side
  const boundaryStep = 1 / 20;  // Finer resolution on boundary
  for (let t = boundaryStep; t < 1; t += boundaryStep) {
    // North boundary: southward=0
    waypoints.push({ southward: 0, eastward: t, type: 'boundary', side: 'north', t });
    // South boundary: southward=1
    waypoints.push({ southward: 1, eastward: 1 - t, type: 'boundary', side: 'south', t });
    // East boundary: eastward=1
    waypoints.push({ southward: 1 - t, eastward: 1, type: 'boundary', side: 'east', t });
    // West boundary: eastward=0
    waypoints.push({ southward: t, eastward: 0, type: 'boundary', side: 'west', t });
  }
  
  // Add waypoints at edge endpoints (and slightly offset from them)
  // This is crucial for routing around edge ends
  for (const edge of existingEdges) {
    const fromPaper = getPointPaperCoordinates(edge.from);
    const toPaper = getPointPaperCoordinates(edge.to);
    
    // Add offset points near edge endpoints (on both sides of the edge)
    // These help the pathfinder navigate around edge endpoints
    const offset = 0.02;
    const boundaryMargin = 0.01; // Stay away from boundary to remain interior
    
    // Perpendicular direction to the edge
    const dx = toPaper.eastward - fromPaper.eastward;
    const dy = toPaper.southward - fromPaper.southward;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len > EPSILON) {
      const perpX = -dy / len * offset;
      const perpY = dx / len * offset;
      
      // Helper to clamp to interior (not on boundary)
      const clampToInterior = (val) => Math.max(boundaryMargin, Math.min(1 - boundaryMargin, val));
      
      // Offset points near the 'from' endpoint
      const from1 = {
        southward: clampToInterior(fromPaper.southward + perpY),
        eastward: clampToInterior(fromPaper.eastward + perpX),
        type: 'interior'
      };
      const from2 = {
        southward: clampToInterior(fromPaper.southward - perpY),
        eastward: clampToInterior(fromPaper.eastward - perpX),
        type: 'interior'
      };
      
      // Offset points near the 'to' endpoint
      const to1 = {
        southward: clampToInterior(toPaper.southward + perpY),
        eastward: clampToInterior(toPaper.eastward + perpX),
        type: 'interior'
      };
      const to2 = {
        southward: clampToInterior(toPaper.southward - perpY),
        eastward: clampToInterior(toPaper.eastward - perpX),
        type: 'interior'
      };
      
      waypoints.push(from1, from2, to1, to2);
    }
  }
  
  return waypoints;
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
 * Calculate Euclidean distance between two paper-coordinate points.
 */
function distance(p1, p2) {
  const ds = p1.southward - p2.southward;
  const de = p1.eastward - p2.eastward;
  return Math.sqrt(ds * ds + de * de);
}

/**
 * A* pathfinding implementation for finding routes around obstacles.
 * Uses a grid of waypoints (interior and boundary) to navigate around existing edges.
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
  
  // Generate waypoints (including boundary points for routing around edges)
  const waypoints = generateWaypoints(existingEdges);
  
  // Add start and end to the graph
  const startNode = { ...fromCoords, type: 'start', original: fromPoint };
  const endNode = { ...toCoords, type: 'end', original: toPoint };
  
  // Build list of all nodes
  const allNodes = [
    startNode,
    ...waypoints.map((wp, i) => ({ ...wp, index: i })),
    endNode
  ];
  
  // Build adjacency: which nodes can see each other without crossing edges
  // Also exclude same-side edges (forbidden by path rules)
  // And exclude edges that would create loops (go to an existing path point)
  const adjacency = new Map();
  
  // Helper to check if an edge between two nodes would be a same-side edge
  const wouldBeSameSideEdge = (nodeA, nodeB) => {
    // Both must be boundary points on the same side (not identified sides)
    if (nodeA.type === 'boundary' && nodeB.type === 'boundary') {
      return nodeA.side === nodeB.side;
    }
    if (nodeA.type === 'start' && nodeA.original && !nodeA.original.interior && 
        nodeB.type === 'boundary') {
      return nodeA.original.side === nodeB.side;
    }
    if (nodeB.type === 'end' && nodeB.original && !nodeB.original.interior && 
        nodeA.type === 'boundary') {
      return nodeA.side === nodeB.original.side;
    }
    if (nodeA.type === 'start' && nodeA.original && !nodeA.original.interior && 
        nodeB.type === 'end' && nodeB.original && !nodeB.original.interior) {
      return nodeA.original.side === nodeB.original.side;
    }
    return false;
  };
  
  // Helper to check if going to a waypoint would create a loop
  // (i.e., if the waypoint already exists in the path)
  // We allow going TO the start node (idx 0) since it's just our current position
  // and not a "new" node we're adding to the path
  const wouldCreateLoop = (targetIdx, targetNode) => {
    // The start node is our current position - going "to" it is fine during A* traversal
    // (though the simplified path won't include it as an intermediate step)
    if (targetIdx === 0) return false;
    
    // End node is checked separately (toPoint shouldn't exist in path)
    if (targetNode.type === 'end') return false;
    
    // For boundary waypoints, check if this point exists in the path
    if (targetNode.type === 'boundary') {
      const waypointPoint = { side: targetNode.side, t: targetNode.t };
      if (pointExistsInPath(waypointPoint, existingEdges)) {
        return true;
      }
    }
    
    return false;
  };
  
  for (let i = 0; i < allNodes.length; i++) {
    adjacency.set(i, []);
    for (let j = 0; j < allNodes.length; j++) {
      if (i === j) continue;
      
      const nodeI = allNodes[i];
      const nodeJ = allNodes[j];
      
      // Skip same-side edges (forbidden)
      if (wouldBeSameSideEdge(nodeI, nodeJ)) {
        continue;
      }
      
      // Skip edges that would create a loop (go to existing path point)
      if (wouldCreateLoop(j, nodeJ)) {
        continue;
      }
      
      // Check if these two nodes can see each other (line doesn't cross any edge)
      if (!lineSegmentCrossesEdges(nodeI, nodeJ, existingEdges)) {
        adjacency.get(i).push(j);
      }
    }
  }
  
  // A* search
  const startIdx = 0;
  const endIdx = allNodes.length - 1;
  
  // Priority queue (using array sorted by f-score) and Set for O(1) membership check
  const openSet = [{ idx: startIdx, g: 0, f: distance(startNode, endNode) }];
  const openSetIndices = new Set([startIdx]);
  const cameFrom = new Map();
  const gScore = new Map();
  gScore.set(startIdx, 0);
  
  while (openSet.length > 0) {
    // Get node with lowest f-score
    openSet.sort((a, b) => a.f - b.f);
    const current = openSet.shift();
    openSetIndices.delete(current.idx);
    
    if (current.idx === endIdx) {
      // Reconstruct path
      const path = [endIdx];
      let curr = endIdx;
      while (cameFrom.has(curr)) {
        curr = cameFrom.get(curr);
        path.unshift(curr);
      }
      
      // Convert path to edges
      const edges = [];
      for (let i = 0; i < path.length - 1; i++) {
        const fromNode = allNodes[path[i]];
        const toNode = allNodes[path[i + 1]];
        
        let edgeFrom, edgeTo;
        
        // Determine 'from' point - handle boundary waypoints
        if (fromNode.type === 'start') {
          edgeFrom = fromNode.original;
        } else if (fromNode.type === 'boundary') {
          edgeFrom = { side: fromNode.side, t: fromNode.t };
        } else {
          // Interior point or edge-offset (both are interior)
          edgeFrom = { interior: true, southward: fromNode.southward, eastward: fromNode.eastward };
        }
        
        // Determine 'to' point - handle boundary waypoints
        if (toNode.type === 'end') {
          edgeTo = toNode.original;
        } else if (toNode.type === 'boundary') {
          edgeTo = { side: toNode.side, t: toNode.t };
        } else {
          // Interior point or edge-offset (both are interior)
          edgeTo = { interior: true, southward: toNode.southward, eastward: toNode.eastward };
        }
        
        edges.push({ from: edgeFrom, to: edgeTo });
      }
      
      return { success: true, edges };
    }
    
    // Explore neighbors
    const neighbors = adjacency.get(current.idx) || [];
    for (const neighborIdx of neighbors) {
      const neighborNode = allNodes[neighborIdx];
      const currentNode = allNodes[current.idx];
      
      const tentativeG = gScore.get(current.idx) + distance(currentNode, neighborNode);
      
      if (!gScore.has(neighborIdx) || tentativeG < gScore.get(neighborIdx)) {
        cameFrom.set(neighborIdx, current.idx);
        gScore.set(neighborIdx, tentativeG);
        
        const f = tentativeG + distance(neighborNode, endNode);
        
        // Add to open set if not already there (O(1) check with Set)
        if (!openSetIndices.has(neighborIdx)) {
          openSet.push({ idx: neighborIdx, g: tentativeG, f });
          openSetIndices.add(neighborIdx);
        }
      }
    }
  }
  
  // No path found
  return { success: false, error: 'No path found through waypoint grid' };
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
 * Uses grid-based A* pathfinding to route around obstacles.
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
