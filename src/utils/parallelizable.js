/**
 * Parallelizable path logic for the p3 loops editor.
 *
 * A path is "parallelizable" if every node (point) on any side of the rhombus
 * has at most one edge associated with it. Here a point on N is considered
 * "different" from a point on E even if it is identified with it — we consider
 * points on the boundary of the rhombus, ignoring identifications.
 *
 * If a path is parallelizable we can:
 * 1. Remove all nodes with zero edges.
 * 2. Turn each edge into a region that partitions the rhombus.
 *
 * Algorithm (in the disk):
 * - Map boundary points to the unit circle.
 * - Draw chords for edges.
 * - Sort all endpoints by angle.
 * - Between each pair of consecutive endpoints belonging to different chords,
 *   construct an "interchord" (straight line connecting those two boundary points
 *   in the disk).
 * - The interchords divide the disk into regions; each region contains exactly
 *   one original chord.
 * - Endcap regions (where consecutive endpoints belong to the same chord)
 *   are merged with their chord's region.
 * - Map the region boundaries back to the rhombus for display.
 */

import {
  getBoundaryAngle,
  getBoundaryDiskPoint,
  diskPointToScreen,
  getPointOnSide
} from './geometry.js';
import { getSideGroup, countPointsInGroup, pointToFloat } from './combinatorialPathLogic.js';

/**
 * Check whether a path (combinatorial state) is parallelizable.
 *
 * Parallelizable means every (side, pos) pair appears as from or to in at most
 * one edge. We treat the four sides independently (ignoring identifications).
 *
 * @param {Object} state - Combinatorial state { points, edges }
 * @returns {{ parallelizable: boolean, reason?: string }}
 */
export function isParallelizable(state) {
  if (state.edges.length === 0) {
    return { parallelizable: false, reason: 'Path has no edges' };
  }

  // Count appearances of each (side, pos) pair across all edges
  const counts = new Map(); // key = "side:pos"

  for (let i = 0; i < state.edges.length; i++) {
    const edge = state.edges[i];
    for (const endpoint of [edge.from, edge.to]) {
      const key = `${endpoint.side}:${endpoint.pos}`;
      const prev = counts.get(key) || 0;
      if (prev >= 1) {
        return {
          parallelizable: false,
          reason: `Point (${endpoint.side}, ${endpoint.pos}) is used by more than one edge`
        };
      }
      counts.set(key, prev + 1);
    }
  }

  return { parallelizable: true };
}

/**
 * Generate parallel regions for a parallelizable path.
 *
 * Returns an array of region objects, one per edge. Each region is described as
 * an array of screen-coordinate points forming a closed polygon.
 *
 * @param {Object} state  - Combinatorial state { points, edges }
 * @param {number} numSamples - Samples per chord / interchord segment (default 40)
 * @returns {Array<{ edgeIndex: number, polygon: Array<{x,y}> }>}
 */
export function generateParallelRegions(state, numSamples = 40) {
  const floatEdges = state.edges.map(edge => ({
    from: pointToFloat(edge.from, state),
    to: pointToFloat(edge.to, state)
  }));

  // 1. Build the list of boundary points with their disk angles and chord index
  const endpoints = [];
  for (let i = 0; i < floatEdges.length; i++) {
    const fe = floatEdges[i];
    endpoints.push({
      side: fe.from.side,
      t: fe.from.t,
      angle: getBoundaryAngle(fe.from.side, fe.from.t),
      chordIndex: i,
      which: 'from'
    });
    endpoints.push({
      side: fe.to.side,
      t: fe.to.t,
      angle: getBoundaryAngle(fe.to.side, fe.to.t),
      chordIndex: i,
      which: 'to'
    });
  }

  // 2. Sort by angle (CCW)
  endpoints.sort((a, b) => a.angle - b.angle);

  // 3. Walk around the circle and classify each arc between consecutive endpoints
  const n = endpoints.length;
  const arcs = []; // { from: endpoint, to: endpoint, type: 'same'|'inter' }
  for (let i = 0; i < n; i++) {
    const cur = endpoints[i];
    const next = endpoints[(i + 1) % n];
    arcs.push({
      fromEp: cur,
      toEp: next,
      sameChord: cur.chordIndex === next.chordIndex
    });
  }

  // 4. Assign each arc to a chord region.
  //    - Arcs where both endpoints belong to the same chord are assigned to that chord.
  //    - Arcs between different chords (interchord boundaries) are split: we assign
  //      the arc to neither chord directly; instead they become boundaries between regions.

  // Build region for each chord.  We walk around the circle and accumulate
  // boundary segments for each region.  A region's boundary consists of:
  //   • arcs along the disk boundary that "belong" to this chord
  //   • interchord segments that border this chord
  //   • the chord itself (optional — we just need the polygon for filling)
  //
  // The polygon for chord k is built by walking the boundary:
  //   Start at chord k's "first" endpoint in CCW order
  //   Follow the boundary arc if it belongs to chord k
  //   When hitting an interchord boundary, follow the interchord (straight line in disk)
  //     to the other side, then continue to chord k's other endpoint
  //   The chord itself closes the polygon.

  // Find for each chord which arcs it owns and which interchords border it
  const chordArcIndices = new Map(); // chordIndex -> [arc indices that belong to it]
  for (let i = 0; i < arcs.length; i++) {
    if (arcs[i].sameChord) {
      const ci = arcs[i].fromEp.chordIndex;
      if (!chordArcIndices.has(ci)) chordArcIndices.set(ci, []);
      chordArcIndices.get(ci).push(i);
    }
  }

  // For each chord, build the closed polygon
  const regions = [];
  for (let ci = 0; ci < floatEdges.length; ci++) {
    const polygon = buildChordRegionPolygon(
      ci, endpoints, arcs, floatEdges[ci], numSamples
    );
    regions.push({ edgeIndex: ci, polygon });
  }

  return regions;
}

/**
 * Build the polygon for a single chord's region.
 *
 * Strategy: find the two endpoints of this chord in the sorted endpoint list.
 * Between the two endpoints (going one way around the circle) there are arcs.
 * For each direction:
 *   - If arcs belong to the same chord → follow the boundary arc
 *   - If arcs cross to a different chord → follow the interchord (straight line)
 *
 * One of the two "halves" will contain only same-chord arcs or interchord
 * boundaries; the other half is the complement. The chord itself connects
 * the two endpoints and closes the polygon.
 *
 * For non-nested chords the polygon looks like:
 *   boundary arc (endcap) → interchord → chord (back to start)
 *
 * We trace the region by going from endpoint A of the chord around the
 * boundary (following arcs and interchords) to endpoint B, then back along
 * the chord.
 */
function buildChordRegionPolygon(chordIndex, endpoints, arcs, floatEdge, numSamples) {
  const n = endpoints.length;

  // Find the two positions of this chord in the sorted endpoint array
  const positions = [];
  for (let i = 0; i < n; i++) {
    if (endpoints[i].chordIndex === chordIndex) {
      positions.push(i);
    }
  }

  // There should be exactly 2 endpoints for each chord
  const [posA, posB] = positions;

  // We have two paths around the circle from posA to posB:
  //   path1: posA → posA+1 → ... → posB  (forward / CCW)
  //   path2: posB → posB+1 → ... → posA  (the rest of the circle)
  //
  // One of these paths will be "owned" by this chord's region. Specifically,
  // the path that does NOT start with the chord's own arc (since the chord
  // arc is on the OTHER side of the chord from the region interior).
  //
  // Actually, for a convex chord in a disk, both directions define a region.
  // We want the "outer" region — the one that includes the boundary arcs
  // closest to this chord's endpoints and the interchords to neighboring chords.
  //
  // Heuristic: choose the shorter path (fewer arcs) from posA to posB.
  // If both are equal, pick the one that starts with a same-chord arc (endcap).

  const path1Len = ((posB - posA) % n + n) % n;
  const path2Len = n - path1Len;

  // Check which path starts with a same-chord arc
  const arc1Start = arcs[posA];
  const arc2Start = arcs[posB];

  // Choose the path that has the chord's own arcs (endcaps).
  // If neither or both, pick the shorter one.
  let chosenStart, chosenLen;
  if (arc1Start.sameChord && arc1Start.fromEp.chordIndex === chordIndex) {
    chosenStart = posA;
    chosenLen = path1Len;
  } else if (arc2Start.sameChord && arc2Start.fromEp.chordIndex === chordIndex) {
    chosenStart = posB;
    chosenLen = path2Len;
  } else {
    // Pick the shorter path
    if (path1Len <= path2Len) {
      chosenStart = posA;
      chosenLen = path1Len;
    } else {
      chosenStart = posB;
      chosenLen = path2Len;
    }
  }

  // Trace the boundary from chosenStart going forward chosenLen arcs
  const points = [];
  let cur = chosenStart;
  for (let step = 0; step < chosenLen; step++) {
    const arcIdx = cur % n;
    const arc = arcs[arcIdx];

    if (arc.sameChord) {
      // Follow the boundary arc (sample points along the unit circle)
      sampleBoundaryArc(arc.fromEp, arc.toEp, numSamples, points);
    } else {
      // Interchord: straight line in the disk from arc.fromEp to arc.toEp
      sampleInterchord(arc.fromEp, arc.toEp, numSamples, points);
    }

    cur = (cur + 1) % n;
  }

  // Close with the chord (straight line in disk from the last point back to the first)
  // The chord goes from the endpoint at the end of the walk back to the start
  const chordStart = endpoints[cur]; // where we ended up
  const chordEnd = endpoints[chosenStart]; // where we started
  sampleChord(chordStart, chordEnd, numSamples, points);

  return points;
}

/**
 * Sample points along a boundary arc (on the unit circle) between two endpoints.
 * The arc goes CCW from ep1 to ep2 (short arc in the sorted direction).
 */
function sampleBoundaryArc(ep1, ep2, numSamples, outPoints) {
  const angle1 = ep1.angle;
  let angle2 = ep2.angle;

  // Ensure we go CCW (increasing angle)
  if (angle2 < angle1) {
    angle2 += 2 * Math.PI;
  }

  // If the arc is very small, just add the endpoints
  const arcLen = angle2 - angle1;
  const steps = Math.max(2, Math.ceil(numSamples * arcLen / (2 * Math.PI)));

  for (let i = 0; i <= steps; i++) {
    const angle = angle1 + (arcLen * i) / steps;
    const u = Math.cos(angle);
    const v = Math.sin(angle);
    // Points on the unit circle map to the boundary, but we use diskPointToScreen
    // which handles the full disk→rhombus→screen mapping
    outPoints.push(diskPointToScreen(u, v));
  }
}

/**
 * Sample points along an interchord (straight line in the disk)
 * between two boundary endpoints.
 */
function sampleInterchord(ep1, ep2, numSamples, outPoints) {
  const [u1, v1] = getBoundaryDiskPoint(ep1.side, ep1.t);
  const [u2, v2] = getBoundaryDiskPoint(ep2.side, ep2.t);

  // For interchords between consecutive endpoints, a moderate sample count suffices
  const steps = Math.max(2, Math.floor(numSamples / 2));
  for (let i = 0; i <= steps; i++) {
    const frac = i / steps;
    const u = (1 - frac) * u1 + frac * u2;
    const v = (1 - frac) * v1 + frac * v2;
    outPoints.push(diskPointToScreen(u, v));
  }
}

/**
 * Sample points along a chord (straight line in the disk)
 * between two boundary endpoints. This is the edge's chord itself.
 */
function sampleChord(ep1, ep2, numSamples, outPoints) {
  const [u1, v1] = getBoundaryDiskPoint(ep1.side, ep1.t);
  const [u2, v2] = getBoundaryDiskPoint(ep2.side, ep2.t);

  for (let i = 0; i <= numSamples; i++) {
    const frac = i / numSamples;
    // Small epsilon at endpoints for numerical stability
    const t = Math.max(1e-6, Math.min(1 - 1e-6, frac));
    const u = (1 - t) * u1 + t * u2;
    const v = (1 - t) * v1 + t * v2;
    outPoints.push(diskPointToScreen(u, v));
  }
}
