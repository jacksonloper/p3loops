/**
 * Combinatorial path logic for edges on the hexagonal fundamental domain.
 *
 * The hexagon has vertices A, X, B, Y, C, Z (going clockwise).
 * Cone points: A, B, C.
 * Identified points: X ≡ Y ≡ Z.
 *
 * The 6 sides are: AX, XB, BY, YC, CZ, ZA.
 *
 * Identifications (sides sharing a cone point, same parameterization direction):
 *   AX ≡ AZ  (both radiate from cone point A toward identified vertex)
 *   BX ≡ BY  (both radiate from cone point B toward identified vertex)
 *   CY ≡ CZ  (both radiate from cone point C toward identified vertex)
 *
 * Each side is parameterized from the cone point (t=0) to the identified vertex (t=1):
 *   AX: A → X       AZ: A → Z
 *   BX: B → X       BY: B → Y
 *   CY: C → Y       CZ: C → Z
 *
 * BUT WAIT — AZ goes from A to Z, which is "backwards" on the perimeter
 * (perimeter order is Z → A). So AZ's parameterization is reversed relative
 * to the perimeter. Same for BX (perimeter goes X → B but param goes B → X),
 * and CY (perimeter goes Y → C but param goes C → Y).
 *
 * Key simplification: The path ALWAYS starts at X (≡ Y ≡ Z), and no edge
 * goes from a side to itself. This means we don't need diffeomorphisms for
 * rendering — straight lines suffice for non-crossing.
 *
 * Groups store points with integer positions. Both sides in a group share
 * the same position indices. Position 0 is nearest the cone point on both sides.
 * Parameterization for ALL sides: t = (pos + 0.5) / numPoints
 * This ensures the identification (same pos = same physical point) is correct,
 * since both sides go from cone point (t=0) to identified vertex (t=1).
 *
 * Points are stored as { side: string, pos: number }
 * Edges are stored as { from: point, to: point }
 */

/**
 * All 6 sides of the hexagon (clockwise from A).
 * Named with cone point first, identified vertex second.
 * Perimeter order: AX, BX, BY, CY, CZ, AZ.
 */
export const SIDES = ['AX', 'BX', 'BY', 'CY', 'CZ', 'AZ'];

/**
 * Side groups — identified pairs sharing a cone point.
 */
const SIDE_GROUPS = {
  AX: 'AX_AZ',
  AZ: 'AX_AZ',
  BX: 'BX_BY',
  BY: 'BX_BY',
  CY: 'CY_CZ',
  CZ: 'CY_CZ'
};

/**
 * All group names.
 */
export const GROUPS = ['AX_AZ', 'BX_BY', 'CY_CZ'];

/**
 * Sides with reversed parameterization relative to the "first" side.
 * For these sides, pos i maps to t = (numPoints - 1 - i + 0.5) / numPoints.
 *
 * Within each group the two sides share the same positions, but they run in
 * opposite directions around the perimeter. We call the first side "forward"
 * and the second "reversed."
 */
export const REVERSED_SIDES = new Set(['AZ', 'BX', 'CY']);

/**
 * Get the group for a side.
 */
export function getSideGroup(side) {
  return SIDE_GROUPS[side];
}

/**
 * Get the identified (partner) side for a given side.
 */
export function getIdentifiedSide(side) {
  switch (side) {
    case 'AX': return 'AZ';
    case 'AZ': return 'AX';
    case 'BX': return 'BY';
    case 'BY': return 'BX';
    case 'CY': return 'CZ';
    case 'CZ': return 'CY';
    default: throw new Error(`Unknown side: ${side}`);
  }
}

/**
 * Check if two sides are in the same group (identified).
 */
export function sidesAreIdentified(side1, side2) {
  return getSideGroup(side1) === getSideGroup(side2);
}

/**
 * Create an initial empty state.
 */
export function createInitialState() {
  return {
    points: {
      AX_AZ: [],
      BX_BY: [],
      CY_CZ: []
    },
    edges: []
  };
}

/**
 * Get points in a group.
 */
export function getPointsInGroup(state, group) {
  return state.points[group] || [];
}

/**
 * Count points in a group.
 */
export function countPointsInGroup(state, group) {
  return getPointsInGroup(state, group).length;
}

/**
 * Insert a point into a group at a specific index.
 * Reindexes all points in the group.
 */
export function insertPoint(state, group, insertIndex, originalSide) {
  const points = [...state.points[group]];
  const newPoint = { pos: insertIndex, originalSide };
  points.splice(insertIndex, 0, newPoint);

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
 * Normalize a point to use the canonical side (first in the group name).
 */
export function normalizePoint(point) {
  const group = getSideGroup(point.side);
  const canonical = group.split('_')[0];
  return { side: canonical, pos: point.pos };
}

/**
 * Check if two points are equal (considering identification).
 */
export function pointsEqual(p1, p2) {
  const n1 = normalizePoint(p1);
  const n2 = normalizePoint(p2);
  return n1.side === n2.side && n1.pos === n2.pos;
}

/**
 * Get segments on a specific side.
 * A segment represents a gap between adjacent points (or boundary).
 */
export function getSegmentsOnSide(state, side) {
  const group = getSideGroup(side);
  const points = getPointsInGroup(state, group);
  const segments = [];

  if (points.length === 0) {
    segments.push({ startPos: null, endPos: null, side });
  } else {
    segments.push({ startPos: null, endPos: 0, side });
    for (let i = 0; i < points.length - 1; i++) {
      segments.push({ startPos: i, endPos: i + 1, side });
    }
    segments.push({ startPos: points.length - 1, endPos: null, side });
  }

  return segments;
}

/**
 * Get all segments on all 6 sides.
 */
export function getAllSegments(state) {
  return SIDES.flatMap(side => getSegmentsOnSide(state, side));
}

/**
 * Convert a segment to a descriptive string for UI.
 */
export function segmentToString(segment) {
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
    return `pts ${segment.startPos + 1}\u2013${segment.endPos + 1}`;
  }
}

// ============================================================================
// GEOMETRIC CROSSING DETECTION
// ============================================================================
// Uses actual line segment intersection in the hexagon coordinate space.
// Each edge is a straight line from its "from" point to its "to" point.
// We convert combinatorial points to screen coordinates and check if
// segments intersect. This correctly handles the identified sides.
// ============================================================================

import { getPointOnSide } from './hexGeometry.js';

/**
 * Convert a combinatorial point to screen coordinates for crossing detection.
 */
function pointToXY(point, state) {
  const floatPt = pointToFloatInternal(point, state);
  return getPointOnSide(floatPt.side, floatPt.t);
}

/**
 * Internal float conversion (same as pointToFloat but avoids circular dep).
 */
function pointToFloatInternal(point, state) {
  const group = getSideGroup(point.side);
  const numPoints = countPointsInGroup(state, group);
  const t = numPoints === 0 ? 0.5 : (point.pos + 0.5) / numPoints;
  return { side: point.side, t };
}

/**
 * Check if two line segments (p1→p2) and (p3→p4) intersect.
 * Returns true if they cross (not just touch at endpoints).
 */
function segmentsIntersect(p1, p2, p3, p4) {
  const d1x = p2.x - p1.x, d1y = p2.y - p1.y;
  const d2x = p4.x - p3.x, d2y = p4.y - p3.y;
  const det = d1x * d2y - d1y * d2x;

  if (Math.abs(det) < 1e-10) return false; // parallel

  const t = ((p3.x - p1.x) * d2y - (p3.y - p1.y) * d2x) / det;
  const u = ((p3.x - p1.x) * d1y - (p3.y - p1.y) * d1x) / det;

  // Strict interior intersection (not at endpoints)
  const eps = 1e-9;
  return t > eps && t < 1 - eps && u > eps && u < 1 - eps;
}

/**
 * Check if two edges cross geometrically (straight lines in the hexagon).
 */
export function edgesCross(edge1, edge2, state) {
  const p1 = pointToXY(edge1.from, state);
  const p2 = pointToXY(edge1.to, state);
  const p3 = pointToXY(edge2.from, state);
  const p4 = pointToXY(edge2.to, state);

  return segmentsIntersect(p1, p2, p3, p4);
}

/**
 * Check if a new edge crosses any existing edge.
 */
export function edgeCrossesPath(newEdge, state) {
  for (let i = 0; i < state.edges.length; i++) {
    if (edgesCross(newEdge, state.edges[i], state)) {
      return { crosses: true, crossingEdgeIndex: i };
    }
  }
  return { crosses: false, crossingEdgeIndex: null };
}

// ============================================================================
// PATH BUILDING
// ============================================================================

/**
 * Get the starting point for the next edge.
 * The last edge's "to" is translated to its identified side.
 */
export function getNextStartPoint(state) {
  if (state.edges.length === 0) return null;

  const lastEdge = state.edges[state.edges.length - 1];
  const lastTo = lastEdge.to;

  return {
    side: getIdentifiedSide(lastTo.side),
    pos: lastTo.pos
  };
}

/**
 * Check if a segment on the same side as fromPoint touches that point's position.
 * Forbidden: cannot go to a touching segment on the SAME side.
 */
function isForbiddenSameSideTouchingSegment(fromPoint, segment) {
  if (segment.side !== fromPoint.side) return false;
  return segment.startPos === fromPoint.pos || segment.endPos === fromPoint.pos;
}

/**
 * Check if adding an edge to a segment would cause a crossing.
 */
export function wouldSegmentCauseCrossing(state, fromPoint, segment) {
  const segmentGroup = getSideGroup(segment.side);

  let insertIndex;
  if (segment.startPos === null) {
    insertIndex = 0;
  } else {
    insertIndex = segment.startPos + 1;
  }

  let adjustedFromPoint = { ...fromPoint };
  if (getSideGroup(fromPoint.side) === segmentGroup && fromPoint.pos >= insertIndex) {
    adjustedFromPoint = { ...fromPoint, pos: fromPoint.pos + 1 };
  }

  const tempState = insertPoint(state, segmentGroup, insertIndex, segment.side);

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

  const newToPoint = { side: segment.side, pos: insertIndex };
  const newEdge = { from: adjustedFromPoint, to: newToPoint };

  const crossingResult = edgeCrossesPath(newEdge, tempStateWithAdjustedEdges);
  return crossingResult.crosses;
}

/**
 * Get all valid segments (no crossings, no forbidden same-side touching).
 * Also excludes segments on the same side as the fromPoint (since no
 * same-side edges are allowed in this setting).
 */
export function getValidSegments(state, fromPoint) {
  const allSegments = getAllSegments(state);

  if (!fromPoint) return allSegments;

  return allSegments.filter(segment => {
    // No same-side edges allowed
    if (segment.side === fromPoint.side) return false;
    // No edges to the identified side either (since from and to must differ)
    if (sidesAreIdentified(segment.side, fromPoint.side)) return false;
    if (isForbiddenSameSideTouchingSegment(fromPoint, segment)) return false;
    return !wouldSegmentCauseCrossing(state, fromPoint, segment);
  });
}

/**
 * Get target segments for the first edge.
 * Since path always starts at X, the first edge starts at X.
 * X is at the boundary of AX and XB (which are in groups AX_AZ and BX_BY).
 * The first "from" will be on AX or BX (the sides adjacent to X).
 * For the first edge, since no same-side edges are allowed,
 * from and to must be on different groups.
 */
export function getFirstEdgeToSegments(fromSegment) {
  const fromSide = fromSegment.side;
  const fromGroup = getSideGroup(fromSide);

  const segments = [];

  for (const side of SIDES) {
    const sideGroup = getSideGroup(side);

    if (sideGroup !== fromGroup) {
      segments.push({ startPos: null, endPos: null, side });
    } else if (side !== fromSide) {
      // Same group, different side — offer before/after start
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
    // Skip fromSide itself — no same-side edges
  }

  return segments;
}

/**
 * Add edge from a point to a segment.
 */
export function addEdgeToSegment(state, fromPoint, segment) {
  const segmentGroup = getSideGroup(segment.side);

  let insertIndex;
  if (segment.startPos === null) {
    insertIndex = 0;
  } else {
    insertIndex = segment.startPos + 1;
  }

  let newState = insertPoint(state, segmentGroup, insertIndex, segment.side);

  let adjustedFromPoint = { ...fromPoint };
  if (getSideGroup(fromPoint.side) === segmentGroup && fromPoint.pos >= insertIndex) {
    adjustedFromPoint = { ...fromPoint, pos: fromPoint.pos + 1 };
  }

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

  const newToPoint = { side: segment.side, pos: insertIndex };
  const newEdge = { from: adjustedFromPoint, to: newToPoint };

  const crossingResult = edgeCrossesPath(newEdge, newState);
  if (crossingResult.crosses) {
    return {
      newState: null,
      error: `Edge would cross existing edge #${crossingResult.crossingEdgeIndex + 1}`,
      crossingEdgeIndex: crossingResult.crossingEdgeIndex
    };
  }

  if (pointsEqual(adjustedFromPoint, newToPoint)) {
    return { newState: null, error: 'Cannot create edge to the same point' };
  }

  newState = {
    ...newState,
    edges: [...newState.edges, newEdge]
  };

  return { newState };
}

/**
 * Add the first edge (no previous edge).
 * Since path always starts at X, the user selects a "from" segment
 * adjacent to X and a "to" segment.
 */
export function addFirstEdge(state, fromSegment, toSegment) {
  let newState = state;

  const fromGroup = getSideGroup(fromSegment.side);
  const toGroup = getSideGroup(toSegment.side);

  if (fromGroup === toGroup) {
    let fromPos, toPos;

    if (toSegment.firstEdgeLabel === 'before start') {
      newState = insertPoint(newState, toGroup, 0, toSegment.side);
      newState = insertPoint(newState, fromGroup, 1, fromSegment.side);
      fromPos = 1;
      toPos = 0;
    } else {
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
    newState = insertPoint(newState, fromGroup, 0, fromSegment.side);
    newState = insertPoint(newState, toGroup, 0, toSegment.side);

    const newEdge = {
      from: { side: fromSegment.side, pos: 0 },
      to: { side: toSegment.side, pos: 0 }
    };

    newState = { ...newState, edges: [newEdge] };
  }

  return { newState };
}

// ============================================================================
// FLOAT CONVERSION (for visualization)
// ============================================================================

/**
 * Convert a point to float for visualization.
 * Both sides in a group use the same formula: t = (pos + 0.5) / numPoints.
 * This ensures the identification (same pos on identified sides) maps to
 * the same distance from the shared cone point.
 */
export function pointToFloat(point, state) {
  const group = getSideGroup(point.side);
  const numPoints = countPointsInGroup(state, group);
  const t = numPoints === 0 ? 0.5 : (point.pos + 0.5) / numPoints;
  return { side: point.side, t };
}

/**
 * Convert a combinatorial edge to a float edge.
 */
export function edgeToFloat(edge, state) {
  return {
    from: pointToFloat(edge.from, state),
    to: pointToFloat(edge.to, state)
  };
}

/**
 * Convert all edges to float format.
 */
export function allEdgesToFloat(state) {
  return state.edges.map(edge => edgeToFloat(edge, state));
}

// ============================================================================
// UNDO / REMOVE
// ============================================================================

/**
 * Remove the last edge from state.
 */
export function removeLastEdge(state) {
  if (state.edges.length === 0) return state;

  if (state.edges.length === 1) return createInitialState();

  const lastEdge = state.edges[state.edges.length - 1];
  const toPoint = lastEdge.to;
  const group = getSideGroup(toPoint.side);

  const points = [...state.points[group]];
  points.splice(toPoint.pos, 1);

  for (let i = 0; i < points.length; i++) {
    points[i] = { ...points[i], pos: i };
  }

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

// ============================================================================
// LOOP CLOSING
// ============================================================================

/**
 * Check if the loop can be closed.
 * The first edge's from and last edge's to must be in the same group
 * and adjacent (positions differ by 1).
 */
export function canCloseLoop(state) {
  if (state.edges.length < 2) {
    return { canClose: false, error: 'Need at least 2 edges to close a loop' };
  }

  const firstFrom = state.edges[0].from;
  const lastTo = state.edges[state.edges.length - 1].to;

  const identifiedLastTo = {
    side: getIdentifiedSide(lastTo.side),
    pos: lastTo.pos
  };

  if (getSideGroup(firstFrom.side) !== getSideGroup(identifiedLastTo.side)) {
    return { canClose: false, error: 'Start and end are not on the same group' };
  }

  const posDiff = Math.abs(firstFrom.pos - identifiedLastTo.pos);
  if (posDiff !== 1) {
    return { canClose: false, error: `Start and end positions differ by ${posDiff}, need exactly 1` };
  }

  // Check that closing edge wouldn't cross existing edges
  const closingEdge = { from: identifiedLastTo, to: firstFrom };
  const crossingResult = edgeCrossesPath(closingEdge, state);
  if (crossingResult.crosses) {
    return {
      canClose: false,
      error: `Closing edge would cross edge #${crossingResult.crossingEdgeIndex + 1}`,
      crossingEdgeIndex: crossingResult.crossingEdgeIndex
    };
  }

  return { canClose: true };
}

/**
 * Close the loop by adding a closing edge.
 */
export function closeLoop(state) {
  const result = canCloseLoop(state);
  if (!result.canClose) {
    return { error: result.error };
  }

  const firstFrom = state.edges[0].from;
  const lastTo = state.edges[state.edges.length - 1].to;
  const identifiedLastTo = {
    side: getIdentifiedSide(lastTo.side),
    pos: lastTo.pos
  };

  const closingEdge = { from: identifiedLastTo, to: firstFrom };

  return {
    newState: {
      ...state,
      edges: [...state.edges, closingEdge]
    }
  };
}

// ============================================================================
// DISPLAY HELPERS
// ============================================================================

/**
 * Get all points for display.
 * Each point appears on both identified sides at the same t value
 * (same distance from their shared cone point).
 */
export function getAllPointsForDisplay(state) {
  const result = [];

  for (const group of GROUPS) {
    const points = getPointsInGroup(state, group);
    const numPoints = points.length;
    const [side1, side2] = group.split('_');

    for (const point of points) {
      const t = numPoints > 0 ? (point.pos + 0.5) / numPoints : 0.5;

      result.push({ side: side1, pos: point.pos, group, t });
      result.push({ side: side2, pos: point.pos, group, t });
    }
  }

  return result;
}
