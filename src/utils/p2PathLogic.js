/**
 * Combinatorial path logic for edges on the p2 square.
 *
 * The p2 orbifold has a square fundamental domain where each side is
 * split at its midpoint into two half-sides. The two halves of each side
 * are identified with reversed parameterization (180° rotation about the
 * midpoint of the side).
 *
 * The 8 half-sides (zones), clockwise from NW corner:
 *   NNW - north side, west half (NW corner → N midpoint)
 *   NNE - north side, east half (N midpoint → NE corner)
 *   ENE - east side, north half (NE corner → E midpoint)
 *   ESE - east side, south half (E midpoint → SE corner)
 *   SSE - south side, east half (SE corner → S midpoint)
 *   SSW - south side, west half (S midpoint → SW corner)
 *   WSW - west side, south half (SW corner → W midpoint)
 *   WNW - west side, north half (W midpoint → NW corner)
 *
 * Identifications (adjacent half-sides sharing a midpoint, reversed):
 *   NNW ≡ NNE  (both halves of north side, reversed)
 *   ENE ≡ ESE  (both halves of east side, reversed)
 *   SSE ≡ SSW  (both halves of south side, reversed)
 *   WSW ≡ WNW  (both halves of west side, reversed)
 *
 * All four corners of the square are identified as the same point.
 *
 * Points within an identified pair share the same integer position index.
 * The first zone in each pair uses forward parameterization (pos 0 near
 * the corner, pos k-1 near the midpoint). The second zone uses reversed
 * parameterization (pos 0 maps to t near the far corner, pos k-1 near
 * the midpoint).
 *
 * Points are stored as { zone: string, pos: number }
 * Edges are stored as { from: point, to: point }
 */

/**
 * All 8 half-side zones (clockwise from NW corner).
 */
export const ZONES = ['NNW', 'NNE', 'ENE', 'ESE', 'SSE', 'SSW', 'WSW', 'WNW'];

/**
 * Zone groups - identified pairs (adjacent half-sides of the same full side).
 */
const ZONE_GROUPS = {
  NNW: 'NNW_NNE',
  NNE: 'NNW_NNE',
  ENE: 'ENE_ESE',
  ESE: 'ENE_ESE',
  SSE: 'SSE_SSW',
  SSW: 'SSE_SSW',
  WSW: 'WSW_WNW',
  WNW: 'WSW_WNW'
};

/**
 * All group names.
 */
export const GROUPS = ['NNW_NNE', 'ENE_ESE', 'SSE_SSW', 'WSW_WNW'];

/**
 * Zones with reversed parameterization (second zone in each pair).
 * For these zones, pos i maps to float parameter (k-1-i+0.5)/k instead of (i+0.5)/k.
 */
export const REVERSED_ZONES = new Set(['NNE', 'ESE', 'SSW', 'WNW']);

/**
 * Get the group for a zone.
 */
export function getZoneGroup(zone) {
  return ZONE_GROUPS[zone];
}

/**
 * Get the identified (partner) zone for a given zone.
 */
export function getIdentifiedZone(zone) {
  switch (zone) {
    case 'NNW': return 'NNE';
    case 'NNE': return 'NNW';
    case 'ENE': return 'ESE';
    case 'ESE': return 'ENE';
    case 'SSE': return 'SSW';
    case 'SSW': return 'SSE';
    case 'WSW': return 'WNW';
    case 'WNW': return 'WSW';
    default: throw new Error(`Unknown zone: ${zone}`);
  }
}

/**
 * Check if two zones are in the same group (identified).
 */
export function zonesAreIdentified(zone1, zone2) {
  return getZoneGroup(zone1) === getZoneGroup(zone2);
}

/**
 * Create an initial empty state.
 */
export function createInitialState() {
  return {
    points: {
      NNW_NNE: [],
      ENE_ESE: [],
      SSE_SSW: [],
      WSW_WNW: []
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
export function insertPoint(state, group, insertIndex, originalZone) {
  const points = [...state.points[group]];
  const newPoint = { pos: insertIndex, originalZone };
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
 * Normalize a point to use the canonical zone (first in the group name).
 */
export function normalizePoint(point) {
  const group = getZoneGroup(point.zone);
  const canonical = group.split('_')[0];
  return { zone: canonical, pos: point.pos };
}

/**
 * Check if two points are equal (considering identification).
 */
export function pointsEqual(p1, p2) {
  const n1 = normalizePoint(p1);
  const n2 = normalizePoint(p2);
  return n1.zone === n2.zone && n1.pos === n2.pos;
}

/**
 * Get segments on a specific zone.
 * A segment represents a gap between adjacent points (or boundary).
 */
export function getSegmentsOnZone(state, zone) {
  const group = getZoneGroup(zone);
  const points = getPointsInGroup(state, group);
  const segments = [];

  if (points.length === 0) {
    segments.push({ startPos: null, endPos: null, zone });
  } else {
    segments.push({ startPos: null, endPos: 0, zone });
    for (let i = 0; i < points.length - 1; i++) {
      segments.push({ startPos: i, endPos: i + 1, zone });
    }
    segments.push({ startPos: points.length - 1, endPos: null, zone });
  }

  return segments;
}

/**
 * Get all segments on all 8 zones.
 */
export function getAllSegments(state) {
  return ZONES.flatMap(zone => getSegmentsOnZone(state, zone));
}

/**
 * Convert a segment to a descriptive string for UI.
 */
export function segmentToString(segment) {
  if (segment.firstEdgeLabel) {
    return segment.firstEdgeLabel;
  }

  if (segment.startPos === null && segment.endPos === null) {
    return 'entire zone';
  } else if (segment.startPos === null) {
    return `before pt ${segment.endPos + 1}`;
  } else if (segment.endPos === null) {
    return `after pt ${segment.startPos + 1}`;
  } else {
    return `pts ${segment.startPos + 1}–${segment.endPos + 1}`;
  }
}

/**
 * Perimeter key: map each point to a unique integer in cyclic perimeter order.
 *
 * The perimeter walk (clockwise from NW corner):
 *   NNW (NW corner→N mid), NNE (N mid→NE corner),
 *   ENE (NE corner→E mid), ESE (E mid→SE corner),
 *   SSE (SE corner→S mid), SSW (S mid→SW corner),
 *   WSW (SW corner→W mid), WNW (W mid→NW corner)
 *
 * Each group contributes its points twice on the perimeter (once per zone).
 * The first zone in each pair uses forward order, the second uses reversed
 * order (because the identification reverses parameterization).
 *
 * For NNW zone (group NNW_NNE), points go pos 0,1,...,k-1 (forward)
 * For NNE zone (same group), points go pos k-1,...,1,0 (reversed)
 */
function perimeterKey(point, groupCounts) {
  const { zone, pos } = point;
  const nN = groupCounts.NNW_NNE;
  const nE = groupCounts.ENE_ESE;
  const nS = groupCounts.SSE_SSW;
  const nW = groupCounts.WSW_WNW;

  const o0 = 0;
  const o1 = nN;
  const o2 = 2 * nN;
  const o3 = 2 * nN + nE;
  const o4 = 2 * nN + 2 * nE;
  const o5 = 2 * nN + 2 * nE + nS;
  const o6 = 2 * nN + 2 * nE + 2 * nS;
  const o7 = 2 * nN + 2 * nE + 2 * nS + nW;

  switch (zone) {
    case 'NNW': return o0 + pos;                  // forward
    case 'NNE': return o1 + (nN - 1 - pos);       // reversed
    case 'ENE': return o2 + pos;                   // forward
    case 'ESE': return o3 + (nE - 1 - pos);       // reversed
    case 'SSE': return o4 + pos;                   // forward
    case 'SSW': return o5 + (nS - 1 - pos);       // reversed
    case 'WSW': return o6 + pos;                   // forward
    case 'WNW': return o7 + (nW - 1 - pos);       // reversed
    default: throw new Error(`Unknown zone: ${zone}`);
  }
}

/**
 * Get the group counts object.
 */
function getGroupCounts(state) {
  return {
    NNW_NNE: countPointsInGroup(state, 'NNW_NNE'),
    ENE_ESE: countPointsInGroup(state, 'ENE_ESE'),
    SSE_SSW: countPointsInGroup(state, 'SSE_SSW'),
    WSW_WNW: countPointsInGroup(state, 'WSW_WNW')
  };
}

function mod(x, P) {
  return ((x % P) + P) % P;
}

function betweenCCW(a, b, x, P) {
  const ab = mod(b - a, P);
  const ax = mod(x - a, P);
  return ax > 0 && ax < ab;
}

/**
 * Check if two edges cross on the perimeter.
 */
export function edgesCross(edge1, edge2, state) {
  const gc = getGroupCounts(state);
  const P = 2 * (gc.NNW_NNE + gc.ENE_ESE + gc.SSE_SSW + gc.WSW_WNW);

  if (P < 4) return false;

  const a = perimeterKey(edge1.from, gc);
  const b = perimeterKey(edge1.to, gc);
  const c = perimeterKey(edge2.from, gc);
  const d = perimeterKey(edge2.to, gc);

  if (a === c || a === d || b === c || b === d) return false;

  const cBetween = betweenCCW(a, b, c, P);
  const dBetween = betweenCCW(a, b, d, P);

  return cBetween !== dBetween;
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

/**
 * Get the starting point for the next edge.
 * The last edge's "to" is translated to its identified zone.
 */
export function getNextStartPoint(state) {
  if (state.edges.length === 0) return null;

  const lastEdge = state.edges[state.edges.length - 1];
  const lastTo = lastEdge.to;

  return {
    zone: getIdentifiedZone(lastTo.zone),
    pos: lastTo.pos
  };
}

/**
 * Check if a segment on the same zone as fromPoint touches that point's position.
 * Forbidden: cannot go to a touching segment on the SAME zone.
 * But going to the IDENTIFIED zone that touches is allowed.
 */
function isForbiddenSameZoneTouchingSegment(fromPoint, segment) {
  if (segment.zone !== fromPoint.zone) return false;
  return segment.startPos === fromPoint.pos || segment.endPos === fromPoint.pos;
}

/**
 * Check if adding an edge to a segment would cause a crossing.
 */
export function wouldSegmentCauseCrossing(state, fromPoint, segment) {
  const segmentGroup = getZoneGroup(segment.zone);

  let insertIndex;
  if (segment.startPos === null) {
    insertIndex = 0;
  } else {
    insertIndex = segment.startPos + 1;
  }

  let adjustedFromPoint = { ...fromPoint };
  if (getZoneGroup(fromPoint.zone) === segmentGroup && fromPoint.pos >= insertIndex) {
    adjustedFromPoint = { ...fromPoint, pos: fromPoint.pos + 1 };
  }

  const tempState = insertPoint(state, segmentGroup, insertIndex, segment.zone);

  const adjustedEdges = tempState.edges.map(edge => {
    let newFrom = { ...edge.from };
    let newTo = { ...edge.to };

    if (getZoneGroup(edge.from.zone) === segmentGroup && edge.from.pos >= insertIndex) {
      newFrom = { ...edge.from, pos: edge.from.pos + 1 };
    }
    if (getZoneGroup(edge.to.zone) === segmentGroup && edge.to.pos >= insertIndex) {
      newTo = { ...edge.to, pos: edge.to.pos + 1 };
    }

    return { from: newFrom, to: newTo };
  });

  const tempStateWithAdjustedEdges = { ...tempState, edges: adjustedEdges };

  const newToPoint = { zone: segment.zone, pos: insertIndex };
  const newEdge = { from: adjustedFromPoint, to: newToPoint };

  const crossingResult = edgeCrossesPath(newEdge, tempStateWithAdjustedEdges);
  return crossingResult.crosses;
}

/**
 * Get all valid segments (no crossings, no forbidden same-zone touching).
 */
export function getValidSegments(state, fromPoint) {
  const allSegments = getAllSegments(state);

  if (!fromPoint) return allSegments;

  return allSegments.filter(segment => {
    if (isForbiddenSameZoneTouchingSegment(fromPoint, segment)) return false;
    return !wouldSegmentCauseCrossing(state, fromPoint, segment);
  });
}

/**
 * Get target segments for the first edge.
 */
export function getFirstEdgeToSegments(fromSegment) {
  const fromZone = fromSegment.zone;
  const fromGroup = getZoneGroup(fromZone);

  const segments = [];

  for (const zone of ZONES) {
    const zoneGroup = getZoneGroup(zone);

    if (zoneGroup !== fromGroup) {
      segments.push({ startPos: null, endPos: null, zone });
    } else {
      segments.push({
        startPos: null,
        endPos: 0,
        zone,
        firstEdgeLabel: 'before start'
      });
      segments.push({
        startPos: 0,
        endPos: null,
        zone,
        firstEdgeLabel: 'after start'
      });
    }
  }

  return segments;
}

/**
 * Add edge from a point to a segment.
 */
export function addEdgeToSegment(state, fromPoint, segment) {
  const segmentGroup = getZoneGroup(segment.zone);

  let insertIndex;
  if (segment.startPos === null) {
    insertIndex = 0;
  } else {
    insertIndex = segment.startPos + 1;
  }

  let newState = insertPoint(state, segmentGroup, insertIndex, segment.zone);

  let adjustedFromPoint = { ...fromPoint };
  if (getZoneGroup(fromPoint.zone) === segmentGroup && fromPoint.pos >= insertIndex) {
    adjustedFromPoint = { ...fromPoint, pos: fromPoint.pos + 1 };
  }

  const adjustedEdges = newState.edges.map(edge => {
    let newFrom = { ...edge.from };
    let newTo = { ...edge.to };

    if (getZoneGroup(edge.from.zone) === segmentGroup && edge.from.pos >= insertIndex) {
      newFrom = { ...edge.from, pos: edge.from.pos + 1 };
    }
    if (getZoneGroup(edge.to.zone) === segmentGroup && edge.to.pos >= insertIndex) {
      newTo = { ...edge.to, pos: edge.to.pos + 1 };
    }

    return { from: newFrom, to: newTo };
  });

  newState = { ...newState, edges: adjustedEdges };

  const newToPoint = { zone: segment.zone, pos: insertIndex };
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
 */
export function addFirstEdge(state, fromSegment, toSegment) {
  let newState = state;

  const fromGroup = getZoneGroup(fromSegment.zone);
  const toGroup = getZoneGroup(toSegment.zone);

  if (fromGroup === toGroup) {
    let fromPos, toPos;

    if (toSegment.firstEdgeLabel === 'before start') {
      newState = insertPoint(newState, toGroup, 0, toSegment.zone);
      newState = insertPoint(newState, fromGroup, 1, fromSegment.zone);
      fromPos = 1;
      toPos = 0;
    } else {
      newState = insertPoint(newState, fromGroup, 0, fromSegment.zone);
      newState = insertPoint(newState, toGroup, 1, toSegment.zone);
      fromPos = 0;
      toPos = 1;
    }

    const newEdge = {
      from: { zone: fromSegment.zone, pos: fromPos },
      to: { zone: toSegment.zone, pos: toPos }
    };

    newState = { ...newState, edges: [newEdge] };
  } else {
    newState = insertPoint(newState, fromGroup, 0, fromSegment.zone);
    newState = insertPoint(newState, toGroup, 0, toSegment.zone);

    const newEdge = {
      from: { zone: fromSegment.zone, pos: 0 },
      to: { zone: toSegment.zone, pos: 0 }
    };

    newState = { ...newState, edges: [newEdge] };
  }

  return { newState };
}

/**
 * Convert a point to float for visualization.
 * For "forward" zones (first in each pair): t = (pos + 0.5) / numPoints
 * For "reversed" zones (second in each pair): t = (numPoints - 1 - pos + 0.5) / numPoints
 */
export function pointToFloat(point, state) {
  const group = getZoneGroup(point.zone);
  const numPoints = countPointsInGroup(state, group);
  let t;
  if (numPoints === 0) {
    t = 0.5;
  } else if (REVERSED_ZONES.has(point.zone)) {
    t = (numPoints - 1 - point.pos + 0.5) / numPoints;
  } else {
    t = (point.pos + 0.5) / numPoints;
  }
  return { zone: point.zone, t };
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

/**
 * Remove the last edge from state.
 */
export function removeLastEdge(state) {
  if (state.edges.length === 0) return state;

  if (state.edges.length === 1) return createInitialState();

  const lastEdge = state.edges[state.edges.length - 1];
  const toPoint = lastEdge.to;
  const group = getZoneGroup(toPoint.zone);

  const points = [...state.points[group]];
  points.splice(toPoint.pos, 1);

  for (let i = 0; i < points.length; i++) {
    points[i] = { ...points[i], pos: i };
  }

  const adjustedEdges = state.edges.slice(0, -1).map(edge => {
    let newFrom = { ...edge.from };
    let newTo = { ...edge.to };

    if (getZoneGroup(edge.from.zone) === group && edge.from.pos > toPoint.pos) {
      newFrom = { ...edge.from, pos: edge.from.pos - 1 };
    }
    if (getZoneGroup(edge.to.zone) === group && edge.to.pos > toPoint.pos) {
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
    zone: getIdentifiedZone(lastTo.zone),
    pos: lastTo.pos
  };

  if (getZoneGroup(firstFrom.zone) !== getZoneGroup(identifiedLastTo.zone)) {
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
    zone: getIdentifiedZone(lastTo.zone),
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

/**
 * Get all points for display.
 * Each point appears on both identified zones.
 * The first zone uses forward parameterization, the second uses reversed.
 */
export function getAllPointsForDisplay(state) {
  const result = [];

  for (const group of GROUPS) {
    const points = getPointsInGroup(state, group);
    const numPoints = points.length;
    const [zone1, zone2] = group.split('_');

    for (const point of points) {
      const t1 = numPoints > 0 ? (point.pos + 0.5) / numPoints : 0.5;
      const t2 = numPoints > 0 ? (numPoints - 1 - point.pos + 0.5) / numPoints : 0.5;

      result.push({ zone: zone1, pos: point.pos, group, t: t1 });
      result.push({ zone: zone2, pos: point.pos, group, t: t2 });
    }
  }

  return result;
}
