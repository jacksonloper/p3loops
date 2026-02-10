/**
 * Combinatorial path logic for edges on the rhombus.
 * 
 * In this approach:
 * - Edges are always side-to-side (including same-side)
 * - Points are identified by a side and an integer position in an ordering
 * - When a new edge is added to a segment, a new point is created in the middle
 * - The ordering is updated by relabeling all points
 * - Crossing detection is purely combinatorial (chord intersection)
 * 
 * The rhombus sides are: north, east, south, west
 * Identifications: north ≡ east, south ≡ west
 * This means a point at position k on north is the same as position k on east.
 * 
 * Points are stored as { side: string, pos: number }
 * Edges are stored as { from: point, to: point }
 * 
 * For visualization, we convert integer positions to floating-point t values
 * by distributing points evenly: t = (pos + 0.5) / numPoints on that side group.
 */

import { getIdentifiedSide } from './geometry.js';

/**
 * Side groups for identification.
 * north ≡ east (group "NE")
 * south ≡ west (group "SW")
 */
const SIDE_GROUPS = {
  north: 'NE',
  east: 'NE',
  south: 'SW',
  west: 'SW'
};

/**
 * Get the group for a side (NE or SW).
 */
export function getSideGroup(side) {
  return SIDE_GROUPS[side];
}

/**
 * Get the canonical side for a group.
 * We use 'north' for NE group, 'south' for SW group.
 */
export function getCanonicalSide(side) {
  const group = getSideGroup(side);
  return group === 'NE' ? 'north' : 'south';
}

/**
 * Check if two sides are in the same group (identified).
 */
export function sidesAreIdentified(side1, side2) {
  return getSideGroup(side1) === getSideGroup(side2);
}

/**
 * Create an initial combinatorial state with one point on each side group.
 * Returns { points: { NE: [...], SW: [...] }, edges: [] }
 * 
 * Each point has { pos: number, originalSide?: string }
 * The pos is used to determine ordering within the group.
 */
export function createInitialState() {
  return {
    points: {
      NE: [], // Points on north/east
      SW: []  // Points on south/west
    },
    edges: []
  };
}

/**
 * Get all points on a side group.
 */
export function getPointsInGroup(state, group) {
  return state.points[group] || [];
}

/**
 * Count the number of points on a side group.
 */
export function countPointsInGroup(state, group) {
  return getPointsInGroup(state, group).length;
}

/**
 * Add a point to a side group at a specific position.
 * Position is an index where the point will be inserted.
 * All subsequent points get their pos values incremented.
 * 
 * @param {Object} state - Current state
 * @param {string} group - 'NE' or 'SW'
 * @param {number} insertIndex - Where to insert (between existing points)
 * @param {string} originalSide - The side from which this point was created
 * @returns {Object} New state with the point added
 */
export function insertPoint(state, group, insertIndex, originalSide) {
  const points = [...state.points[group]];
  
  // Insert a new point at the given index
  const newPoint = { pos: insertIndex, originalSide };
  points.splice(insertIndex, 0, newPoint);
  
  // Reindex all points
  for (let i = 0; i < points.length; i++) {
    points[i] = { ...points[i], pos: i };
  }
  
  return {
    ...state,
    points: {
      ...state.points,
      [group]: points
    }
  };
}

/**
 * A combinatorial point is represented as { side: string, pos: number }.
 * The 'pos' is the integer index in the ordering of that side group.
 */

/**
 * Normalize a point to use the canonical side.
 * This allows comparing points across identified sides.
 */
export function normalizePoint(point) {
  const group = getSideGroup(point.side);
  const canonicalSide = group === 'NE' ? 'north' : 'south';
  return { side: canonicalSide, pos: point.pos };
}

/**
 * Check if two combinatorial points are equal.
 */
export function pointsEqual(p1, p2) {
  const n1 = normalizePoint(p1);
  const n2 = normalizePoint(p2);
  return n1.side === n2.side && n1.pos === n2.pos;
}

/**
 * Get all segments on a specific side.
 * A segment is between two adjacent points, or from "start" to first point,
 * or from last point to "end".
 * 
 * Returns array of { startPos: number | null, endPos: number | null, side: string }
 * where null represents the boundary (before first / after last).
 * 
 * @param {Object} state - Current state
 * @param {string} side - The specific side (north, east, south, west)
 */
export function getSegmentsOnSide(state, side) {
  const group = getSideGroup(side);
  const points = getPointsInGroup(state, group);
  const segments = [];
  
  // If no points, there's one segment spanning the whole side
  if (points.length === 0) {
    segments.push({ startPos: null, endPos: null, side });
  } else {
    // Segment from start to first point
    segments.push({ startPos: null, endPos: 0, side });
    
    // Segments between adjacent points
    for (let i = 0; i < points.length - 1; i++) {
      segments.push({ startPos: i, endPos: i + 1, side });
    }
    
    // Segment from last point to end
    segments.push({ startPos: points.length - 1, endPos: null, side });
  }
  
  return segments;
}

/**
 * Get all available segments on all four sides.
 * Each segment now includes its specific side, not just the group.
 */
export function getAllSegments(state) {
  return [
    ...getSegmentsOnSide(state, 'north'),
    ...getSegmentsOnSide(state, 'east'),
    ...getSegmentsOnSide(state, 'south'),
    ...getSegmentsOnSide(state, 'west')
  ];
}

/**
 * Check if adding an edge to a specific segment would cause a crossing.
 * This is used to filter out invalid segment options in the UI.
 * 
 * @param {Object} state - Current state
 * @param {Object} fromPoint - Starting point { side, pos }
 * @param {Object} segment - Target segment { startPos, endPos, side }
 * @returns {boolean} True if the edge would cause a crossing
 */
export function wouldSegmentCauseCrossing(state, fromPoint, segment) {
  const segmentGroup = getSideGroup(segment.side);
  
  // Calculate where the new point would be inserted
  let insertIndex;
  if (segment.startPos === null) {
    insertIndex = 0;
  } else {
    insertIndex = segment.startPos + 1;
  }
  
  // Adjust the fromPoint's position if it's in the same group and at or after the insert position
  let adjustedFromPoint = { ...fromPoint };
  if (getSideGroup(fromPoint.side) === segmentGroup && fromPoint.pos >= insertIndex) {
    adjustedFromPoint = { ...fromPoint, pos: fromPoint.pos + 1 };
  }
  
  // Create a temporary state with the new point inserted
  const tempState = insertPoint(state, segmentGroup, insertIndex, segment.side);
  
  // Adjust existing edge positions in temp state
  const adjustedEdges = tempState.edges.map(edge => {
    let newFrom = { ...edge.from };
    let newTo = { ...edge.to };
    
    if (getSideGroup(edge.from.side) === segmentGroup && edge.from.pos >= insertIndex) {
      newFrom = { ...edge.from, pos: edge.from.pos + 1 };
    }
    if (getSideGroup(edge.to.side) === segmentGroup && edge.to.pos >= insertIndex) {
      newTo = { ...edge.to, pos: edge.to.pos + 1 };
    }
    
    return { from: newFrom, to: newTo };
  });
  
  const tempStateWithAdjustedEdges = { ...tempState, edges: adjustedEdges };
  
  // Create the hypothetical new edge using the segment's specific side
  const newToPoint = { side: segment.side, pos: insertIndex };
  const newEdge = { from: adjustedFromPoint, to: newToPoint };
  
  // Check if it would cross
  const crossingResult = edgeCrossesPath(newEdge, tempStateWithAdjustedEdges);
  return crossingResult.crosses;
}

/**
 * Check if a segment on the same side as fromPoint touches the fromPoint's position.
 * This is forbidden: you cannot create an edge from a point to a segment on the SAME side
 * that touches that point. However, going to the IDENTIFIED side (e.g., east from north)
 * that touches the identified position IS allowed.
 * 
 * @param {Object} fromPoint - Starting point { side, pos }
 * @param {Object} segment - Target segment { startPos, endPos, side }
 * @returns {boolean} True if this is a forbidden same-side touching segment
 */
function isForbiddenSameSideTouchingSegment(fromPoint, segment) {
  // Only applies if segment is on the EXACT same side (not just same group)
  if (segment.side !== fromPoint.side) {
    return false;
  }
  
  // Check if the segment touches the fromPoint's position
  // A segment touches a position if startPos === pos or endPos === pos
  return segment.startPos === fromPoint.pos || segment.endPos === fromPoint.pos;
}

/**
 * Get all valid segments that can be targeted without causing crossings.
 * Also filters out segments on the same side that touch the fromPoint's position
 * (but allows segments on the identified side that touch the identified position).
 * 
 * @param {Object} state - Current state
 * @param {Object} fromPoint - Starting point for the next edge (or null for first edge)
 * @returns {Array} Array of valid segments
 */
export function getValidSegments(state, fromPoint) {
  const allSegments = getAllSegments(state);
  
  // If no fromPoint (first edge), all segments are valid
  if (!fromPoint) {
    return allSegments;
  }
  
  // Filter out:
  // 1. Segments that would cause crossings
  // 2. Segments on the same side that touch the fromPoint's position
  return allSegments.filter(segment => {
    // Check for forbidden same-side touching segment
    if (isForbiddenSameSideTouchingSegment(fromPoint, segment)) {
      return false;
    }
    
    // Check for crossings
    return !wouldSegmentCauseCrossing(state, fromPoint, segment);
  });
}

/**
 * Get available target segments for the FIRST edge based on the starting segment.
 * 
 * For the first edge, the starting point doesn't exist yet, so we need to 
 * calculate target segments based on where the starting point will be placed.
 * 
 * The rhombus has side identifications: north ≡ east, south ≡ west.
 * 
 * Given a starting side S:
 * - Sides in a different group (other pair): entire side is one segment
 * - Same side (S → S): "before start" and "after start" (different winding)
 * - Other side in same group (S's identified partner): "before start" and "after start"
 * 
 * Example: Starting from North:
 * - South, West (different group): entire side available
 * - North (same side): before start, after start
 * - East (north's identified partner): before start, after start
 * 
 * @param {Object} fromSegment - The starting segment { startPos, endPos, side }
 * @returns {Array} Array of valid target segments
 */
export function getFirstEdgeToSegments(fromSegment) {
  const fromSide = fromSegment.side;
  const fromGroup = getSideGroup(fromSide);
  
  const allSides = ['north', 'east', 'south', 'west'];
  const segments = [];
  
  for (const side of allSides) {
    const sideGroup = getSideGroup(side);
    
    if (sideGroup !== fromGroup) {
      // Different group - entire side is available
      segments.push({ startPos: null, endPos: null, side });
    } else {
      // Same group - need "before start" and "after start"
      // The fromSegment defines where the start point will be
      // "before start" is the segment from boundary to start point
      // "after start" is the segment from start point to boundary
      
      // Note: since no points exist yet, we're defining segments relative
      // to the start point that will be created at position 0.
      // "before start" means pos 0 in the ordering
      // "after start" means pos 1 in the ordering (after start is inserted)
      
      // For same side (e.g., North → North):
      // - "before start" = going backward along the side
      // - "after start" = going forward along the side
      
      // For identified side (e.g., North → East):
      // - Same logic but on the identified side
      
      // We represent these as:
      // - "before start": { startPos: null, endPos: 0, side } - goes to position before the new point
      // - "after start": { startPos: 0, endPos: null, side } - goes to position after the new point
      
      // But we need special labels for these first-edge segments
      segments.push({ 
        startPos: null, 
        endPos: 0, 
        side, 
        firstEdgeLabel: 'before start' 
      });
      segments.push({ 
        startPos: 0, 
        endPos: null, 
        side, 
        firstEdgeLabel: 'after start' 
      });
    }
  }
  
  return segments;
}

/**
 * Convert a segment to a descriptive string for UI.
 * Shows the segment position description (identification is shown in the header).
 */
export function segmentToString(segment) {
  // For first-edge segments, use the special label
  if (segment.firstEdgeLabel) {
    return segment.firstEdgeLabel;
  }
  
  if (segment.startPos === null && segment.endPos === null) {
    return 'entire side';
  } else if (segment.startPos === null) {
    return `before pt ${segment.endPos + 1}`;
  } else if (segment.endPos === null) {
    return `after pt ${segment.startPos + 1}`;
  } else {
    return `pts ${segment.startPos + 1}–${segment.endPos + 1}`;
  }
}

/**
 * Map a boundary point to a unique integer key in cyclic perimeter order.
 * 
 * The perimeter is walked in order: north → east → south → west (CCW around the unit square).
 * Each point on a side maps to a slot in this cyclic order.
 * 
 * For edge crossing purposes, all four sides are treated as distinct even though
 * north/east and south/west are identified (share the same point set).
 * 
 * @param {Object} point - { side: string, pos: number }
 * @param {number} nNE - Number of points in NE group
 * @param {number} nSW - Number of points in SW group
 * @returns {number} Integer key in range [0, 2*nNE + 2*nSW - 1]
 */
function perimeterKey(point, nNE, nSW) {
  const { side, pos } = point;
  
  // Walking CCW from NW corner: north (W→E) → east (N→S) → south (E→W) → west (S→N)
  // 
  // North: Walking W→E, positions increase in walk direction
  //   key = pos
  // East: Walking N→S, positions decrease in walk direction
  //   key = nNE + (nNE - 1 - pos)
  // South: Walking E→W, positions increase in walk direction
  //   key = 2*nNE + pos
  // West: Walking S→N, positions decrease in walk direction
  //   key = 2*nNE + nSW + (nSW - 1 - pos)
  
  switch (side) {
    case 'north':
      return pos;
    case 'east':
      return nNE + (nNE - 1 - pos);
    case 'south':
      return 2 * nNE + pos;
    case 'west':
      return 2 * nNE + nSW + (nSW - 1 - pos);
    default:
      throw new Error(`Unknown side: ${side}`);
  }
}

/**
 * Modular arithmetic helper.
 * @param {number} x - Value to compute modulo
 * @param {number} P - Modulus (perimeter length)
 * @returns {number} x mod P, always non-negative
 */
function mod(x, P) {
  return ((x % P) + P) % P;
}

/**
 * Check if x is strictly between a and b in CCW (increasing) direction on a circle of length P.
 * 
 * @param {number} a - Start of arc
 * @param {number} b - End of arc  
 * @param {number} x - Point to test
 * @param {number} P - Perimeter length (circle size)
 * @returns {boolean} True if x is strictly between a and b going CCW
 */
function betweenCCW(a, b, x, P) {
  const ab = mod(b - a, P);
  const ax = mod(x - a, P);
  return ax > 0 && ax < ab;
}

/**
 * Check if two chords (edges) cross on the perimeter.
 * 
 * Uses purely combinatorial integer arithmetic based on the cyclic perimeter order.
 * Two chords with endpoints (a,b) and (c,d) cross if and only if:
 * - They do NOT share an endpoint
 * - The endpoints alternate: exactly one of c or d is strictly between a and b
 * 
 * @param {Object} edge1 - First edge { from: point, to: point }
 * @param {Object} edge2 - Second edge { from: point, to: point }
 * @param {Object} state - Current state (for point counts)
 * @returns {boolean} True if edges cross
 */
export function edgesCross(edge1, edge2, state) {
  const nNE = countPointsInGroup(state, 'NE');
  const nSW = countPointsInGroup(state, 'SW');
  const P = 2 * nNE + 2 * nSW; // Total perimeter length
  
  // Edge case: if perimeter has fewer than 4 distinct positions, edges can't cross
  if (P < 4) {
    return false;
  }
  
  // Get integer keys for all four endpoints
  const a = perimeterKey(edge1.from, nNE, nSW);
  const b = perimeterKey(edge1.to, nNE, nSW);
  const c = perimeterKey(edge2.from, nNE, nSW);
  const d = perimeterKey(edge2.to, nNE, nSW);
  
  // Check for shared endpoints - edges that share an endpoint don't cross
  if (a === c || a === d || b === c || b === d) {
    return false;
  }
  
  // Alternation test: edges cross iff exactly one of c,d is between a and b (CCW)
  const cBetween = betweenCCW(a, b, c, P);
  const dBetween = betweenCCW(a, b, d, P);
  
  return cBetween !== dBetween; // XOR: exactly one is between
}

/**
 * Check if a new edge would cross any existing edge.
 * @returns { crosses: boolean, crossingEdgeIndex: number | null }
 */
export function edgeCrossesPath(newEdge, state) {
  for (let i = 0; i < state.edges.length; i++) {
    if (edgesCross(newEdge, state.edges[i], state)) {
      return { crosses: true, crossingEdgeIndex: i };
    }
  }
  return { crosses: false, crossingEdgeIndex: null };
}

/**
 * Get the starting point for the next edge (the endpoint of the last edge,
 * translated to the identified side).
 */
export function getNextStartPoint(state) {
  if (state.edges.length === 0) return null;
  
  const lastEdge = state.edges[state.edges.length - 1];
  const lastTo = lastEdge.to;
  
  // Return the identified side version
  return {
    side: getIdentifiedSide(lastTo.side),
    pos: lastTo.pos
  };
}

/**
 * Add a new edge to a segment.
 * This creates a new point in the segment and adds the edge.
 * Now the segment already contains the specific side (not just group).
 * 
 * @param {Object} state - Current state
 * @param {Object} fromPoint - Starting point { side, pos }
 * @param {Object} segment - Target segment { startPos, endPos, side }
 * @returns {{ newState: Object, error?: string }}
 */
export function addEdgeToSegment(state, fromPoint, segment) {
  const segmentGroup = getSideGroup(segment.side);
  
  // Calculate where to insert the new point
  // If segment is { startPos: null, endPos: 0 }, insert at position 0
  // If segment is { startPos: 0, endPos: 1 }, insert at position 1
  // If segment is { startPos: n, endPos: null }, insert at position n + 1
  let insertIndex;
  if (segment.startPos === null) {
    insertIndex = 0;
  } else {
    insertIndex = segment.startPos + 1;
  }
  
  // Insert the new point
  let newState = insertPoint(state, segmentGroup, insertIndex, segment.side);
  
  // The fromPoint's position might need adjustment if it's in the same group
  // and at or after the insert position
  let adjustedFromPoint = { ...fromPoint };
  if (getSideGroup(fromPoint.side) === segmentGroup && fromPoint.pos >= insertIndex) {
    adjustedFromPoint = { ...fromPoint, pos: fromPoint.pos + 1 };
  }
  
  // Also adjust all existing edges that reference points in this group
  const adjustedEdges = newState.edges.map(edge => {
    let newFrom = { ...edge.from };
    let newTo = { ...edge.to };
    
    if (getSideGroup(edge.from.side) === segmentGroup && edge.from.pos >= insertIndex) {
      newFrom = { ...edge.from, pos: edge.from.pos + 1 };
    }
    if (getSideGroup(edge.to.side) === segmentGroup && edge.to.pos >= insertIndex) {
      newTo = { ...edge.to, pos: edge.to.pos + 1 };
    }
    
    return { from: newFrom, to: newTo };
  });
  
  newState = { ...newState, edges: adjustedEdges };
  
  // Create the new edge using the segment's specific side
  const newToPoint = { side: segment.side, pos: insertIndex };
  const newEdge = { from: adjustedFromPoint, to: newToPoint };
  
  // Check for crossing (need to temporarily add the new point to state for crossing check)
  // Actually, we already added the point, so we can check now
  const crossingResult = edgeCrossesPath(newEdge, newState);
  if (crossingResult.crosses) {
    return { 
      newState: null, 
      error: `Edge would cross existing edge #${crossingResult.crossingEdgeIndex + 1}`,
      crossingEdgeIndex: crossingResult.crossingEdgeIndex
    };
  }
  
  // Check for loop (destination already exists in path, excluding the new point we just added)
  // Actually, since we're adding to a segment (not an existing point), this shouldn't happen
  // unless the fromPoint is the same as toPoint
  if (pointsEqual(adjustedFromPoint, newToPoint)) {
    return { newState: null, error: 'Cannot create edge to the same point' };
  }
  
  // Add the edge
  newState = {
    ...newState,
    edges: [...newState.edges, newEdge]
  };
  
  return { newState };
}

/**
 * Add the first edge (no previous edge to chain from).
 * Now segments already contain their specific side (not just group).
 * 
 * @param {Object} state - Current state
 * @param {Object} fromSegment - Starting segment { startPos, endPos, side }
 * @param {Object} toSegment - Target segment { startPos, endPos, side }
 */
export function addFirstEdge(state, fromSegment, toSegment) {
  // Insert both points
  let newState = state;
  
  const fromGroup = getSideGroup(fromSegment.side);
  const toGroup = getSideGroup(toSegment.side);
  
  // For first edge, fromInsertIndex is always 0 (we insert the first point)
  const fromInsertIndex = 0;
  
  // If both are in the same group, we need to handle "before start" vs "after start"
  if (fromGroup === toGroup) {
    // For same-group first edge, the toSegment's firstEdgeLabel tells us the relative position
    // "before start" means toPoint should be at position 0, fromPoint at position 1
    // "after start" means fromPoint should be at position 0, toPoint at position 1
    
    let fromPos, toPos;
    
    if (toSegment.firstEdgeLabel === 'before start') {
      // Insert toPoint first (at 0), then fromPoint (at 1)
      newState = insertPoint(newState, toGroup, 0, toSegment.side);
      newState = insertPoint(newState, fromGroup, 1, fromSegment.side);
      fromPos = 1;
      toPos = 0;
    } else {
      // "after start" or default: insert fromPoint first (at 0), then toPoint (at 1)
      newState = insertPoint(newState, fromGroup, 0, fromSegment.side);
      newState = insertPoint(newState, toGroup, 1, toSegment.side);
      fromPos = 0;
      toPos = 1;
    }
    
    const newEdge = {
      from: { side: fromSegment.side, pos: fromPos },
      to: { side: toSegment.side, pos: toPos }
    };
    
    newState = { ...newState, edges: [newEdge] };
  } else {
    // Different groups, simpler - each point goes at position 0 in its group
    newState = insertPoint(newState, fromGroup, fromInsertIndex, fromSegment.side);
    newState = insertPoint(newState, toGroup, 0, toSegment.side);
    
    const newEdge = {
      from: { side: fromSegment.side, pos: fromInsertIndex },
      to: { side: toSegment.side, pos: 0 }
    };
    
    newState = { ...newState, edges: [newEdge] };
  }
  
  return { newState };
}

/**
 * Convert a combinatorial edge to a floating-point edge for visualization.
 * 
 * @param {Object} edge - Combinatorial edge { from: { side, pos }, to: { side, pos } }
 * @param {Object} state - Current state (for point counts)
 * @returns {Object} Float edge { from: { side, t }, to: { side, t } }
 */
export function edgeToFloat(edge, state) {
  return {
    from: pointToFloat(edge.from, state),
    to: pointToFloat(edge.to, state)
  };
}

/**
 * Convert a combinatorial point to a floating-point point.
 */
export function pointToFloat(point, state) {
  const group = getSideGroup(point.side);
  const numPoints = countPointsInGroup(state, group);
  
  // Distribute points evenly: t = (pos + 0.5) / numPoints
  const t = numPoints > 0 ? (point.pos + 0.5) / numPoints : 0.5;
  
  return { side: point.side, t };
}

/**
 * Convert all edges to floating-point format for visualization.
 */
export function allEdgesToFloat(state) {
  return state.edges.map(edge => edgeToFloat(edge, state));
}

/**
 * Remove the last edge from the state.
 * This removes the point that was created by that edge.
 * 
 * IMPORTANT: If this is the first (and only) edge, we remove BOTH points
 * since neither point exists without any edges. After removal, the state
 * should contain exactly the points that are referenced by existing edges.
 */
export function removeLastEdge(state) {
  if (state.edges.length === 0) {
    return state;
  }
  
  // If this is the only edge (first edge), removing it should clear all points
  if (state.edges.length === 1) {
    return createInitialState();
  }
  
  // Get the last edge
  const lastEdge = state.edges[state.edges.length - 1];
  const toPoint = lastEdge.to;
  const group = getSideGroup(toPoint.side);
  
  // Remove the point at toPoint.pos
  const points = [...state.points[group]];
  points.splice(toPoint.pos, 1);
  
  // Reindex remaining points
  for (let i = 0; i < points.length; i++) {
    points[i] = { ...points[i], pos: i };
  }
  
  // Adjust all edges' positions that reference this group
  const adjustedEdges = state.edges.slice(0, -1).map(edge => {
    let newFrom = { ...edge.from };
    let newTo = { ...edge.to };
    
    if (getSideGroup(edge.from.side) === group && edge.from.pos > toPoint.pos) {
      newFrom = { ...edge.from, pos: edge.from.pos - 1 };
    }
    if (getSideGroup(edge.to.side) === group && edge.to.pos > toPoint.pos) {
      newTo = { ...edge.to, pos: edge.to.pos - 1 };
    }
    
    return { from: newFrom, to: newTo };
  });
  
  return {
    ...state,
    points: {
      ...state.points,
      [group]: points
    },
    edges: adjustedEdges
  };
}

/**
 * Get all points with their positions for display.
 * Returns array of { side, pos, group, t } for each point.
 * Each point appears on BOTH identified sides (north + east, or south + west)
 * to make the identification visual.
 */
export function getAllPointsForDisplay(state) {
  const result = [];
  
  for (const group of ['NE', 'SW']) {
    const points = getPointsInGroup(state, group);
    const numPoints = points.length;
    
    // Get both sides in this group
    const sides = group === 'NE' ? ['north', 'east'] : ['south', 'west'];
    
    for (const point of points) {
      const t = numPoints > 0 ? (point.pos + 0.5) / numPoints : 0.5;
      
      // Add the point to BOTH identified sides with the same position
      for (const side of sides) {
        result.push({
          side,
          pos: point.pos,
          group,
          t
        });
      }
    }
  }
  
  return result;
}

/**
 * Import a floating-point path into the combinatorial system.
 * This analyzes the ordering of points along each side group and
 * creates integer positions that preserve the ordering.
 * 
 * Interior points are ignored (collapsed into direct side-to-side edges).
 * 
 * In a chained path, edge[i].to and edge[i+1].from refer to the same point
 * (on identified sides). We need to deduplicate these.
 * 
 * @param {Array} floatEdges - Array of float edges with interior points
 * @returns {Object} Combinatorial state
 */
export function importFromFloatEdges(floatEdges) {
  if (floatEdges.length === 0) {
    return createInitialState();
  }
  
  // First, simplify edges to remove interior points
  const simplifiedEdges = simplifyEdges(floatEdges);
  
  if (simplifiedEdges.length === 0) {
    return createInitialState();
  }
  
  // Collect unique boundary points with their t values
  // Points are identified by their t value and side group
  // We use t as the key for deduplication within a group
  const nePointsMap = new Map(); // t -> { t, sides: Set<side> }
  const swPointsMap = new Map();
  
  const EPSILON = 0.001;
  
  // Helper to find or add a point
  function addPoint(side, t) {
    const group = getSideGroup(side);
    const map = group === 'NE' ? nePointsMap : swPointsMap;
    
    // Find existing point with close t value
    for (const [existingT, point] of map) {
      if (Math.abs(existingT - t) < EPSILON) {
        point.sides.add(side);
        return existingT;
      }
    }
    
    // Add new point
    map.set(t, { t, sides: new Set([side]) });
    return t;
  }
  
  // Collect all points
  for (const edge of simplifiedEdges) {
    addPoint(edge.from.side, edge.from.t);
    addPoint(edge.to.side, edge.to.t);
  }
  
  // Sort by t value to get the ordering
  const nePoints = Array.from(nePointsMap.values()).sort((a, b) => a.t - b.t);
  const swPoints = Array.from(swPointsMap.values()).sort((a, b) => a.t - b.t);
  
  // Create t -> pos mapping
  const nePositions = new Map();
  for (let i = 0; i < nePoints.length; i++) {
    nePositions.set(nePoints[i].t, i);
  }
  
  const swPositions = new Map();
  for (let i = 0; i < swPoints.length; i++) {
    swPositions.set(swPoints[i].t, i);
  }
  
  // Helper to get position for a point
  function getPos(side, t) {
    const group = getSideGroup(side);
    const map = group === 'NE' ? nePositions : swPositions;
    
    // Find position for this t value
    for (const [existingT, pos] of map) {
      if (Math.abs(existingT - t) < EPSILON) {
        return pos;
      }
    }
    
    throw new Error(`Point not found for side "${side}" at t=${t}`);
  }
  
  // Build the state
  const state = {
    points: {
      NE: nePoints.map((p, i) => ({ 
        pos: i, 
        originalSide: Array.from(p.sides)[0] // Pick first side
      })),
      SW: swPoints.map((p, i) => ({ 
        pos: i, 
        originalSide: Array.from(p.sides)[0] 
      }))
    },
    edges: []
  };
  
  // Convert edges
  for (const edge of simplifiedEdges) {
    const fromPos = getPos(edge.from.side, edge.from.t);
    const toPos = getPos(edge.to.side, edge.to.t);
    
    state.edges.push({
      from: { side: edge.from.side, pos: fromPos },
      to: { side: edge.to.side, pos: toPos }
    });
  }
  
  return state;
}

/**
 * Simplify edges by removing interior waypoints.
 * E.g., if we have edge1: A -> interior, edge2: interior -> B,
 * we simplify to just A -> B.
 */
function simplifyEdges(floatEdges) {
  const simplified = [];
  let pendingFrom = null;
  
  for (const edge of floatEdges) {
    const fromIsInterior = edge.from.interior === true;
    const toIsInterior = edge.to.interior === true;
    
    if (!fromIsInterior && !toIsInterior) {
      // Direct side-to-side edge
      simplified.push(edge);
    } else if (!fromIsInterior && toIsInterior) {
      // Starting at boundary, going to interior
      pendingFrom = edge.from;
    } else if (fromIsInterior && !toIsInterior) {
      // Coming from interior to boundary
      if (pendingFrom) {
        // Complete the simplified edge
        simplified.push({ from: pendingFrom, to: edge.to });
        pendingFrom = null;
      }
    }
    // If both are interior, we just skip (continue accumulating)
  }
  
  return simplified;
}

/**
 * Check if a loop can be closed.
 * The loop can be closed if:
 * 1. The last point and first point are on the same side group
 * 2. The last point is ADJACENT to the first point (positions differ by exactly 1)
 * 3. The closing edge would not cross any existing edge
 * 
 * The closing edge goes from the continuation point (via side identification) to the first point.
 * IMPORTANTLY: to stay along the boundary (not cross the rhombus), the closing edge must
 * have both endpoints on the SAME side. So we use firstPoint.side for the "from" point.
 */
export function canCloseLoop(state) {
  if (state.edges.length < 2) {
    return { canClose: false, error: 'Need at least 2 edges to close a loop' };
  }
  
  const firstEdge = state.edges[0];
  const lastEdge = state.edges[state.edges.length - 1];
  
  const firstPoint = firstEdge.from;
  const lastPoint = lastEdge.to;
  
  // Check if they're on the same side group
  if (getSideGroup(lastPoint.side) !== getSideGroup(firstPoint.side)) {
    return { 
      canClose: false, 
      error: `Cannot close: current position is on ${lastPoint.side}, but start is on ${firstPoint.side} (different side groups)` 
    };
  }
  
  // Check if the last point is adjacent to the first point (positions differ by exactly 1)
  const posDiff = Math.abs(lastPoint.pos - firstPoint.pos);
  if (posDiff !== 1) {
    return {
      canClose: false,
      error: `Cannot close: must be adjacent to start point (current position is ${lastPoint.pos}, start is ${firstPoint.pos})`
    };
  }
  
  // Create the closing edge
  // The edge should stay on the SAME side as firstPoint to walk along the boundary.
  // The "from" point has the same position as lastPoint but on firstPoint's side.
  const closingEdge = { 
    from: { side: firstPoint.side, pos: lastPoint.pos }, 
    to: firstPoint 
  };
  
  // Check for crossing
  const crossingResult = edgeCrossesPath(closingEdge, state);
  if (crossingResult.crosses) {
    return {
      canClose: false,
      error: `Closing edge would cross existing edge #${crossingResult.crossingEdgeIndex + 1}`,
      crossingEdgeIndex: crossingResult.crossingEdgeIndex
    };
  }
  
  return { canClose: true, closingEdge };
}

/**
 * Close the loop by adding the closing edge.
 */
export function closeLoop(state) {
  const result = canCloseLoop(state);
  if (!result.canClose) {
    return { newState: null, error: result.error };
  }
  
  return {
    newState: {
      ...state,
      edges: [...state.edges, result.closingEdge]
    }
  };
}
