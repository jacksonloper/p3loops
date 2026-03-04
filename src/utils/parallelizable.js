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
 * Algorithm:
 * - Walk CCW on the rhombus boundary (West→South→East→North), collecting
 *   boundary nodes involved in edges and their associated edge indices.
 * - Stop when hitting a node whose edge has already been seen → G1.
 * - Remaining nodes form G2. Reverse G2 for edge correspondence.
 * - Lift all points to the unit disk.
 * - Create IC1 midpoints between consecutive G1 nodes on the boundary.
 * - Create IC2 midpoints between consecutive G2 (reversed) nodes.
 * - Create END endcap points at midpoints between first/last G1 nodes
 *   and their closest G2 neighbors.
 * - Build rectangular regions (2 straight lines + 2 arcs) and
 *   triangular endcap regions (1 straight + 2 arcs).
 * - Map back to the rhombus for display.
 */

import {
  getBoundaryAngle,
  getBoundaryDiskPoint,
  diskPointToScreen,
  diskPointToPaper
} from './geometry.js';
import { pointToFloat } from './combinatorialPathLogic.js';
import ClipperLib from 'clipper-lib';

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

// ---------- CCW Boundary Walk ----------

/**
 * Compute a "walk position" for CCW traversal of the rhombus boundary.
 * CCW on the rhombus: West (t↑, NW→SW) → South (t↓, SW→SE) →
 *                     East (t↑, SE→NE) → North (t↓, NE→NW).
 * Returns a value in [0, 4) that increases CCW.
 */
function getWalkPos(side, t) {
  switch (side) {
    case 'west':  return t;          // 0 at NW, 1 at SW
    case 'south': return 2 - t;      // 1 at SW, 2 at SE
    case 'east':  return 2 + t;      // 2 at SE, 3 at NE
    case 'north': return 4 - t;      // 3 at NE, 4 at NW
    default: return 0;
  }
}

/**
 * Build the list of boundary nodes in CCW order on the rhombus.
 * Each node records its side, t parameter, and which edge it belongs to.
 */
function buildCCWBoundaryNodes(floatEdges) {
  const nodes = [];
  for (let i = 0; i < floatEdges.length; i++) {
    const fe = floatEdges[i];
    nodes.push({
      side: fe.from.side, t: fe.from.t,
      edgeIndex: i, walkPos: getWalkPos(fe.from.side, fe.from.t)
    });
    nodes.push({
      side: fe.to.side, t: fe.to.t,
      edgeIndex: i, walkPos: getWalkPos(fe.to.side, fe.to.t)
    });
  }
  nodes.sort((a, b) => a.walkPos - b.walkPos);
  return nodes;
}

/**
 * Walk CCW collecting nodes until we hit a repeated edge.
 * Returns { g1, g2 } where g1 is the first half of the nodes and
 * g2 is the remainder in reversed order (for edge correspondence).
 */
function splitIntoGroups(nodes) {
  const seenEdges = new Set();
  const g1 = [];
  for (const node of nodes) {
    if (seenEdges.has(node.edgeIndex)) break;
    seenEdges.add(node.edgeIndex);
    g1.push(node);
  }

  // G2: remaining nodes in CCW order, then reversed for edge correspondence.
  // In the CCW walk, G2 nodes come after G1 and before the wrap-around.
  const g1WalkSet = new Set(g1.map(n => n.walkPos));
  const g2ccw = nodes.filter(n => !g1WalkSet.has(n.walkPos));
  const g2 = [...g2ccw].reverse();

  return { g1, g2 };
}

// ---------- Disk Midpoint Helpers ----------

/**
 * Compute the midpoint on the unit circle between two boundary nodes.
 * Uses the normalized average of their disk coordinates (short-arc midpoint).
 * If points are diametrically opposite (average is zero), returns the
 * perpendicular point on the circle as a reasonable fallback.
 */
function circleMidpoint(nodeA, nodeB) {
  const [u1, v1] = getBoundaryDiskPoint(nodeA.side, nodeA.t);
  const [u2, v2] = getBoundaryDiskPoint(nodeB.side, nodeB.t);
  const mu = (u1 + u2) / 2;
  const mv = (v1 + v2) / 2;
  const r = Math.hypot(mu, mv);
  if (r < 1e-12) {
    // Diametrically opposite: return perpendicular direction on the circle
    return { u: -v1, v: u1 };
  }
  return { u: mu / r, v: mv / r };
}

/**
 * Compute midpoints on the unit circle between consecutive nodes in a group.
 * Returns k-1 midpoints for k nodes.
 */
function computeGroupMidpoints(group) {
  const mids = [];
  for (let i = 0; i < group.length - 1; i++) {
    mids.push(circleMidpoint(group[i], group[i + 1]));
  }
  return mids;
}

// ---------- Arc / Line Sampling ----------

/**
 * Sample the short arc on the unit circle between two disk points.
 * Returns an array of screen-coordinate {x, y} points.
 */
function sampleShortArc(diskPtA, diskPtB, numSteps) {
  const angleA = Math.atan2(diskPtA.v, diskPtA.u);
  let angleB = Math.atan2(diskPtB.v, diskPtB.u);

  // Choose the short arc (less than π)
  let delta = angleB - angleA;
  if (delta > Math.PI) delta -= 2 * Math.PI;
  if (delta < -Math.PI) delta += 2 * Math.PI;

  const steps = Math.max(2, numSteps);
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const angle = angleA + delta * (i / steps);
    pts.push(diskPointToScreen(Math.cos(angle), Math.sin(angle)));
  }
  return pts;
}

/**
 * Sample a straight line (chord) in the disk between two boundary nodes.
 * Returns an array of screen-coordinate {x, y} points.
 */
function sampleStraightLine(diskPtA, diskPtB, numSteps) {
  const steps = Math.max(2, numSteps);
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const frac = i / steps;
    // Small offset at endpoints avoids placing points exactly on the unit
    // circle boundary where the disk→rhombus mapping can produce numerical
    // artifacts (the Jacobian is singular at the boundary).
    const t = Math.max(1e-6, Math.min(1 - 1e-6, frac));
    const u = (1 - t) * diskPtA.u + t * diskPtB.u;
    const v = (1 - t) * diskPtA.v + t * diskPtB.v;
    pts.push(diskPointToScreen(u, v));
  }
  return pts;
}

/**
 * Get a disk point {u, v} for a boundary node.
 */
function nodeToDisk(node) {
  const [u, v] = getBoundaryDiskPoint(node.side, node.t);
  return { u, v };
}

// ---------- Region Construction ----------

/**
 * Generate parallel regions for a parallelizable path.
 *
 * Returns an array of region objects, one per edge. Each region is described as
 * an array of screen-coordinate points forming a closed polygon.
 *
 * @param {Object} state  - Combinatorial state { points, edges }
 * @param {number} numSamples - Samples per segment (default 40)
 * @returns {Array<{ edgeIndex: number, polygon: Array<{x,y}> }>}
 */
export function generateParallelRegions(state, numSamples = 40) {
  const floatEdges = state.edges.map(edge => ({
    from: pointToFloat(edge.from, state),
    to: pointToFloat(edge.to, state)
  }));

  // 1. Build CCW-ordered boundary nodes
  const nodes = buildCCWBoundaryNodes(floatEdges);

  // 2. Split into G1 and G2 (G2 reversed for edge correspondence)
  const { g1, g2 } = splitIntoGroups(nodes);
  const k = g1.length; // = number of edges

  // 3. Special case: single edge → region is the entire boundary
  if (k === 1) {
    return [{ edgeIndex: g1[0].edgeIndex, polygon: sampleFullBoundary(numSamples) }];
  }

  // 4. Compute interchord midpoints on the unit circle
  const ic1 = computeGroupMidpoints(g1);     // k-1 midpoints
  const ic2 = computeGroupMidpoints(g2);     // k-1 midpoints

  // 5. Compute endcap points.
  //    G1 and G2 each occupy one contiguous arc of the circle boundary.
  //    The two gaps between these arcs are where the END points go:
  //    END1: midpoint between first G1 node and first G2 node
  //          (in the gap at the "start" of both groups)
  //    END2: midpoint between last G1 node and last G2 node
  //          (in the gap at the "end" of both groups)
  const end1 = circleMidpoint(g1[0], g2[0]);
  const end2 = circleMidpoint(g1[g1.length - 1], g2[g2.length - 1]);

  const arcSteps = Math.max(2, Math.floor(numSamples / 3));
  const lineSteps = Math.max(2, Math.floor(numSamples / 2));

  // 6. Build regions
  const regions = [];

  // Endcap 1 (first edge): bounded by IC1[0]→IC2[0] straight,
  //   IC2[0]→END1 arc (short arc through G2 side),
  //   END1→IC1[0] arc (short arc through G1[0])
  regions.push({
    edgeIndex: g1[0].edgeIndex,
    polygon: buildEndcapPolygon(ic1[0], ic2[0], end1, arcSteps, lineSteps)
  });

  // Rectangular regions (for edges G1[1] through G1[k-2])
  for (let i = 0; i < k - 2; i++) {
    regions.push({
      edgeIndex: g1[i + 1].edgeIndex,
      polygon: buildRectPolygon(ic1[i], ic2[i], ic2[i + 1], ic1[i + 1], arcSteps, lineSteps)
    });
  }

  // Endcap 2 (last edge): bounded by IC1[k-2]→IC2[k-2] straight,
  //   IC2[k-2]→END2 arc, END2→IC1[k-2] arc
  regions.push({
    edgeIndex: g1[k - 1].edgeIndex,
    polygon: buildEndcapPolygon(ic1[k - 2], ic2[k - 2], end2, arcSteps, lineSteps)
  });

  return regions;
}

/**
 * Sample the full unit-circle boundary mapped to screen coords.
 * Used for the single-edge case where the region is the entire rhombus.
 */
function sampleFullBoundary(numSamples) {
  const pts = [];
  const steps = Math.max(4, numSamples * 2);
  for (let i = 0; i < steps; i++) {
    const angle = -Math.PI + (2 * Math.PI * i) / steps;
    pts.push(diskPointToScreen(Math.cos(angle), Math.sin(angle)));
  }
  return pts;
}

/**
 * Build a triangular endcap polygon.
 * Boundary: icPt → icPt2 (straight), icPt2 → endPt (arc), endPt → icPt (arc).
 * "Straight, arc, arc."
 */
function buildEndcapPolygon(icPt1, icPt2, endPt, arcSteps, lineSteps) {
  const pts = [];

  // 1. Straight line: IC1 → IC2
  pts.push(...sampleStraightLine(icPt1, icPt2, lineSteps));

  // 2. Arc: IC2 → END (short arc on circle boundary)
  pts.push(...sampleShortArc(icPt2, endPt, arcSteps));

  // 3. Arc: END → IC1 (short arc on circle boundary)
  pts.push(...sampleShortArc(endPt, icPt1, arcSteps));

  return pts;
}

/**
 * Build a rectangular-ish polygon.
 * Boundary: ic1a → ic2a (straight), ic2a → ic2b (arc),
 *           ic2b → ic1b (straight), ic1b → ic1a (arc).
 * "Two straight lines and two arcs."
 */
function buildRectPolygon(ic1a, ic2a, ic2b, ic1b, arcSteps, lineSteps) {
  const pts = [];

  // 1. Straight: IC1[i] → IC2[i]
  pts.push(...sampleStraightLine(ic1a, ic2a, lineSteps));

  // 2. Arc: IC2[i] → IC2[i+1] (along G2 boundary)
  pts.push(...sampleShortArc(ic2a, ic2b, arcSteps));

  // 3. Straight: IC2[i+1] → IC1[i+1]
  pts.push(...sampleStraightLine(ic2b, ic1b, lineSteps));

  // 4. Arc: IC1[i+1] → IC1[i] (along G1 boundary)
  pts.push(...sampleShortArc(ic1b, ic1a, arcSteps));

  return pts;
}

// ---------- Paper-Coordinate Region Generation ----------

/**
 * Sample the short arc on the unit circle between two disk points.
 * Returns an array of paper-coordinate {southward, eastward} points.
 */
function sampleShortArcPaper(diskPtA, diskPtB, numSteps) {
  const angleA = Math.atan2(diskPtA.v, diskPtA.u);
  let delta = Math.atan2(diskPtB.v, diskPtB.u) - angleA;
  if (delta > Math.PI) delta -= 2 * Math.PI;
  if (delta < -Math.PI) delta += 2 * Math.PI;

  const steps = Math.max(2, numSteps);
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const angle = angleA + delta * (i / steps);
    pts.push(diskPointToPaper(Math.cos(angle), Math.sin(angle)));
  }
  return pts;
}

/**
 * Sample a straight line (chord) in the disk between two disk points.
 * Returns an array of paper-coordinate {southward, eastward} points.
 */
function sampleStraightLinePaper(diskPtA, diskPtB, numSteps) {
  const steps = Math.max(2, numSteps);
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const frac = i / steps;
    const t = Math.max(1e-6, Math.min(1 - 1e-6, frac));
    const u = (1 - t) * diskPtA.u + t * diskPtB.u;
    const v = (1 - t) * diskPtA.v + t * diskPtB.v;
    pts.push(diskPointToPaper(u, v));
  }
  return pts;
}

function buildEndcapPolygonPaper(icPt1, icPt2, endPt, arcSteps, lineSteps) {
  const pts = [];
  pts.push(...sampleStraightLinePaper(icPt1, icPt2, lineSteps));
  pts.push(...sampleShortArcPaper(icPt2, endPt, arcSteps));
  pts.push(...sampleShortArcPaper(endPt, icPt1, arcSteps));
  return pts;
}

function buildRectPolygonPaper(ic1a, ic2a, ic2b, ic1b, arcSteps, lineSteps) {
  const pts = [];
  pts.push(...sampleStraightLinePaper(ic1a, ic2a, lineSteps));
  pts.push(...sampleShortArcPaper(ic2a, ic2b, arcSteps));
  pts.push(...sampleStraightLinePaper(ic2b, ic1b, lineSteps));
  pts.push(...sampleShortArcPaper(ic1b, ic1a, arcSteps));
  return pts;
}

function sampleFullBoundaryPaper(numSamples) {
  const pts = [];
  const steps = Math.max(4, numSamples * 2);
  for (let i = 0; i < steps; i++) {
    const angle = -Math.PI + (2 * Math.PI * i) / steps;
    pts.push(diskPointToPaper(Math.cos(angle), Math.sin(angle)));
  }
  return pts;
}

/**
 * Generate parallel regions in paper coordinates (southward, eastward).
 * Same algorithm as generateParallelRegions but outputs paper coords
 * suitable for wallpaper rendering via paperToTrueRhombus + applyReferenceFrame.
 *
 * @param {Object} state  - Combinatorial state { points, edges }
 * @param {number} numSamples - Samples per segment (default 40)
 * @returns {Array<{ edgeIndex: number, polygon: Array<{southward,eastward}> }>}
 */
export function generateParallelRegionsPaper(state, numSamples = 40) {
  const floatEdges = state.edges.map(edge => ({
    from: pointToFloat(edge.from, state),
    to: pointToFloat(edge.to, state)
  }));

  const nodes = buildCCWBoundaryNodes(floatEdges);
  const { g1, g2 } = splitIntoGroups(nodes);
  const k = g1.length;

  if (k === 1) {
    return [{ edgeIndex: g1[0].edgeIndex, polygon: sampleFullBoundaryPaper(numSamples) }];
  }

  const ic1 = computeGroupMidpoints(g1);
  const ic2 = computeGroupMidpoints(g2);

  const end1 = circleMidpoint(g1[0], g2[0]);
  const end2 = circleMidpoint(g1[g1.length - 1], g2[g2.length - 1]);

  const arcSteps = Math.max(2, Math.floor(numSamples / 3));
  const lineSteps = Math.max(2, Math.floor(numSamples / 2));

  const regions = [];

  regions.push({
    edgeIndex: g1[0].edgeIndex,
    polygon: buildEndcapPolygonPaper(ic1[0], ic2[0], end1, arcSteps, lineSteps)
  });

  for (let i = 0; i < k - 2; i++) {
    regions.push({
      edgeIndex: g1[i + 1].edgeIndex,
      polygon: buildRectPolygonPaper(ic1[i], ic2[i], ic2[i + 1], ic1[i + 1], arcSteps, lineSteps)
    });
  }

  regions.push({
    edgeIndex: g1[k - 1].edgeIndex,
    polygon: buildEndcapPolygonPaper(ic1[k - 2], ic2[k - 2], end2, arcSteps, lineSteps)
  });

  return regions;
}

/**
 * Generate merged polygons in paper coordinates for groups of consecutive regions.
 *
 * Given a list of region groups (each group is a contiguous range of region
 * indices to merge), this builds one polygon per group by removing the internal
 * chords and stitching the boundary arcs together.
 *
 * @param {Object} state - Combinatorial state { points, edges }
 * @param {Array<{ start: number, end: number }>} groups - Ranges of region indices to merge
 * @param {number} numSamples - Samples per segment (default 40)
 * @returns {Array<{ polygon: Array<{southward,eastward}> }>}
 */
export function generateMergedRegionsPaper(state, groups, numSamples = 40) {
  const floatEdges = state.edges.map(edge => ({
    from: pointToFloat(edge.from, state),
    to: pointToFloat(edge.to, state)
  }));

  const nodes = buildCCWBoundaryNodes(floatEdges);
  const { g1, g2 } = splitIntoGroups(nodes);
  const k = g1.length;

  if (k === 1) {
    return [{ polygon: sampleFullBoundaryPaper(numSamples) }];
  }

  const ic1 = computeGroupMidpoints(g1);
  const ic2 = computeGroupMidpoints(g2);

  const end1 = circleMidpoint(g1[0], g2[0]);
  const end2 = circleMidpoint(g1[g1.length - 1], g2[g2.length - 1]);

  const arcSteps = Math.max(2, Math.floor(numSamples / 3));
  const lineSteps = Math.max(2, Math.floor(numSamples / 2));

  const result = [];

  for (const { start: s, end: e } of groups) {
    const pts = [];

    // Part 1: Start crossing (G2 side → G1 side)
    if (s === 0) {
      // Endcap 1: arcs from IC2[0] through END1 to IC1[0]
      pts.push(...sampleShortArcPaper(ic2[0], end1, arcSteps));
      pts.push(...sampleShortArcPaper(end1, ic1[0], arcSteps));
    } else {
      // Chord from IC2[s-1] to IC1[s-1]
      pts.push(...sampleStraightLinePaper(ic2[s - 1], ic1[s - 1], lineSteps));
    }

    // Part 2: G1 boundary arcs
    const g1Start = (s > 0) ? s - 1 : 0;
    const g1End = (e < k - 1) ? e : k - 2;
    for (let j = g1Start; j < g1End; j++) {
      pts.push(...sampleShortArcPaper(ic1[j], ic1[j + 1], arcSteps));
    }

    // Part 3: End crossing (G1 side → G2 side)
    if (e === k - 1) {
      // Endcap 2: arcs from IC1[k-2] through END2 to IC2[k-2]
      pts.push(...sampleShortArcPaper(ic1[k - 2], end2, arcSteps));
      pts.push(...sampleShortArcPaper(end2, ic2[k - 2], arcSteps));
    } else {
      // Chord from IC1[e] to IC2[e]
      pts.push(...sampleStraightLinePaper(ic1[e], ic2[e], lineSteps));
    }

    // Part 4: G2 boundary arcs (going backward)
    for (let j = g1End; j > g1Start; j--) {
      pts.push(...sampleShortArcPaper(ic2[j], ic2[j - 1], arcSteps));
    }

    result.push({ polygon: pts });
  }

  return result;
}

// ---------- Polygon Union ----------

// clipper-lib works with integer coordinates; we scale floating-point values
// up before clipping and back down afterwards to preserve precision.
const CLIPPER_SCALE = 1e8;

/**
 * Convert an {x,y} polygon to clipper-lib scaled integer format.
 * @param {Array<{x: number, y: number}>} poly
 * @returns {Array<{X: number, Y: number}>}
 */
function toClipperPath(poly) {
  return poly.map(pt => ({
    X: Math.round(pt.x * CLIPPER_SCALE),
    Y: Math.round(pt.y * CLIPPER_SCALE)
  }));
}

/**
 * Convert a clipper-lib path back to {x,y} floating-point format.
 * @param {Array<{X: number, Y: number}>} path
 * @returns {Array<{x: number, y: number}>}
 */
function fromClipperPath(path) {
  return path.map(pt => ({ x: pt.X / CLIPPER_SCALE, y: pt.Y / CLIPPER_SCALE }));
}

/**
 * Use clipper-lib to simplify a single polygon, resolving any
 * self-intersections. Returns an array of simple (non-self-intersecting)
 * polygons whose union equals the original.
 *
 * @param {Array<{x: number, y: number}>} polygon
 * @returns {Array<Array<{x: number, y: number}>>}
 */
export function simplifyPolygon(polygon) {
  const cp = toClipperPath(polygon);
  const simplified = ClipperLib.Clipper.SimplifyPolygon(cp, ClipperLib.PolyFillType.pftNonZero);

  // Merge vertices closer than 1e-6 real-coord units (numerical noise)
  const cleanDist = CLIPPER_SCALE * 1e-6;
  // Discard polygons < 1e-4 real-coord area units (degenerate slivers)
  const minArea = CLIPPER_SCALE * CLIPPER_SCALE * 1e-4;
  ClipperLib.Clipper.CleanPolygons(simplified, cleanDist);

  return simplified
    .filter(p => p.length >= 3 && Math.abs(ClipperLib.Clipper.Area(p)) > minArea)
    .map(fromClipperPath);
}

/**
 * Check whether a polygon is strictly simple (no self-intersections and no
 * self-tangencies) by running it through Clipper's union with StrictlySimple
 * enabled and verifying the result is a single polygon.
 *
 * @param {Array<{x: number, y: number}>} polygon
 * @returns {boolean}
 */
export function isSimplePolygon(polygon) {
  const cp = toClipperPath(polygon);

  const cpr = new ClipperLib.Clipper();
  cpr.StrictlySimple = true;
  cpr.AddPath(cp, ClipperLib.PolyType.ptSubject, true);
  const solution = new ClipperLib.Paths();
  cpr.Execute(
    ClipperLib.ClipType.ctUnion,
    solution,
    ClipperLib.PolyFillType.pftNonZero,
    ClipperLib.PolyFillType.pftNonZero
  );

  const minArea = CLIPPER_SCALE * CLIPPER_SCALE * 1e-4;
  const significant = solution.filter(
    p => p.length >= 3 && Math.abs(ClipperLib.Clipper.Area(p)) > minArea
  );
  return significant.length === 1;
}

// Offset delta in real-coord units.  A small dilation before union ensures
// that polygons sharing an edge overlap slightly, preventing the union from
// producing self-touching (non-strictly-simple) output.  The deflation
// afterwards restores the original geometry.
const OFFSET_DELTA = 0.5;

/**
 * Union an array of polygons (each an array of {x, y} points) into a single
 * connected polygon using clipper-lib.
 *
 * Uses the "offset trick": dilate each polygon by a small delta, union, then
 * deflate by the same delta.  This avoids self-touching boundaries that the
 * plain union can produce when input polygons share edges.  The Clipper
 * instance is run with StrictlySimple = true so the result is guaranteed to
 * have no self-intersections or self-tangencies.
 *
 * @param {Array<Array<{x: number, y: number}>>} polygons - Input polygons
 * @returns {Array<Array<{x: number, y: number}>>} - Array of result polygons
 *   (typically length 1 when input polygons are adjacent/overlapping)
 */
export function unionPolygons(polygons) {
  if (polygons.length === 0) return [];
  if (polygons.length === 1) return [polygons[0]];

  const delta = OFFSET_DELTA * CLIPPER_SCALE;

  // 1. Convert & simplify each input polygon, then dilate by +delta so that
  //    adjacent polygons overlap slightly.
  const co = new ClipperLib.ClipperOffset();
  for (const poly of polygons) {
    const cp = toClipperPath(poly);
    const parts = ClipperLib.Clipper.SimplifyPolygon(cp, ClipperLib.PolyFillType.pftNonZero);
    for (const part of parts) {
      if (part.length >= 3) {
        if (!ClipperLib.Clipper.Orientation(part)) part.reverse();
        co.AddPath(part, ClipperLib.JoinType.jtMiter, ClipperLib.EndType.etClosedPolygon);
      }
    }
  }
  const dilated = new ClipperLib.Paths();
  co.Execute(dilated, delta);

  // 2. Union the dilated paths with StrictlySimple enabled.
  const cpr = new ClipperLib.Clipper();
  cpr.StrictlySimple = true;
  cpr.AddPaths(dilated, ClipperLib.PolyType.ptSubject, true);

  const unionResult = new ClipperLib.Paths();
  cpr.Execute(
    ClipperLib.ClipType.ctUnion,
    unionResult,
    ClipperLib.PolyFillType.pftNonZero,
    ClipperLib.PolyFillType.pftNonZero
  );

  // 3. Deflate by -delta to restore the original geometry.
  const co2 = new ClipperLib.ClipperOffset();
  co2.AddPaths(unionResult, ClipperLib.JoinType.jtMiter, ClipperLib.EndType.etClosedPolygon);
  const deflated = new ClipperLib.Paths();
  co2.Execute(deflated, -delta);

  // Clean near-degenerate vertices and filter out sliver polygons that can
  // appear at shared edges due to floating-point→integer rounding.
  // Cleaning distance: merge vertices closer than 1e-6 real-coord units.
  const cleanDist = CLIPPER_SCALE * 1e-6;
  // Minimum polygon area: discard polygons smaller than 1e-4 real-coord
  // square units (negligible compared to actual region areas of ~10³).
  const minArea = CLIPPER_SCALE * CLIPPER_SCALE * 1e-4;
  ClipperLib.Clipper.CleanPolygons(deflated, cleanDist);
  const filtered = deflated.filter(
    path => path.length >= 3 && Math.abs(ClipperLib.Clipper.Area(path)) > minArea
  );

  // Convert back to {x,y} floating-point arrays
  return filtered.map(fromClipperPath);
}
