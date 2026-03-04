/**
 * Tests for parallelizable.js
 */

import { describe, it, expect } from 'vitest';
import {
  isParallelizable,
  generateParallelRegions
} from './parallelizable.js';
import {
  createInitialState,
  addFirstEdge,
  addEdgeToSegment,
  getNextStartPoint,
  getSegmentsOnSide,
  getAllSegments
} from './combinatorialPathLogic.js';

/**
 * Helper: build a state with a single edge from one segment to another.
 */
function buildOneEdgePath(fromSide, toSide) {
  let state = createInitialState();
  const fromSegment = { startPos: null, endPos: null, side: fromSide };

  // For first edge, we need a toSegment in a different group
  const toSegment = { startPos: null, endPos: null, side: toSide };
  const result = addFirstEdge(state, fromSegment, toSegment);
  return result.newState;
}

describe('isParallelizable', () => {
  it('should return false for an empty path', () => {
    const state = createInitialState();
    const result = isParallelizable(state);
    expect(result.parallelizable).toBe(false);
    expect(result.reason).toMatch(/no edges/i);
  });

  it('should return true for a single edge', () => {
    const state = buildOneEdgePath('north', 'south');
    const result = isParallelizable(state);
    expect(result.parallelizable).toBe(true);
  });

  it('should return true for a two-edge parallelizable path', () => {
    // Build a path: north→south, then west→(some valid segment)
    let state = buildOneEdgePath('north', 'south');

    // Next start is at (west, 0) — identified side of (south, 0)
    const nextStart = getNextStartPoint(state);
    expect(nextStart.side).toBe('west');

    // Add second edge to a segment on north or east side
    const segments = getAllSegments(state);
    const eastSegments = segments.filter(s => s.side === 'east');
    // Pick a segment on east that won't cause crossing
    if (eastSegments.length > 0) {
      const result = addEdgeToSegment(state, nextStart, eastSegments[0]);
      if (result.newState) {
        state = result.newState;
        const pResult = isParallelizable(state);
        expect(pResult.parallelizable).toBe(true);
      }
    }
  });

  it('should detect non-parallelizable paths (point used by multiple edges)', () => {
    // Build a path where a point appears in two edges on the SAME side
    // This happens when two edges share a node on the same side
    // We can simulate this with a manually constructed state
    const state = {
      points: {
        NE: [{ pos: 0, originalSide: 'north' }],
        SW: [{ pos: 0, originalSide: 'south' }]
      },
      edges: [
        { from: { side: 'north', pos: 0 }, to: { side: 'south', pos: 0 } },
        { from: { side: 'west', pos: 0 }, to: { side: 'north', pos: 0 } }
      ]
    };

    const result = isParallelizable(state);
    expect(result.parallelizable).toBe(false);
    expect(result.reason).toMatch(/more than one edge/);
  });
});

describe('generateParallelRegions', () => {
  it('should generate one region for a single edge', () => {
    const state = buildOneEdgePath('north', 'south');
    const regions = generateParallelRegions(state);

    expect(regions).toHaveLength(1);
    expect(regions[0].edgeIndex).toBe(0);
    expect(regions[0].polygon.length).toBeGreaterThan(0);
  });

  it('should generate regions with valid screen coordinates', () => {
    const state = buildOneEdgePath('north', 'south');
    const regions = generateParallelRegions(state);

    for (const region of regions) {
      for (const pt of region.polygon) {
        expect(typeof pt.x).toBe('number');
        expect(typeof pt.y).toBe('number');
        expect(Number.isFinite(pt.x)).toBe(true);
        expect(Number.isFinite(pt.y)).toBe(true);
      }
    }
  });

  it('should generate two regions for a two-edge parallelizable path', () => {
    let state = buildOneEdgePath('north', 'south');
    const nextStart = getNextStartPoint(state);

    const segments = getAllSegments(state);
    const eastSegments = segments.filter(s => s.side === 'east');
    if (eastSegments.length > 0) {
      const result = addEdgeToSegment(state, nextStart, eastSegments[0]);
      if (result.newState) {
        state = result.newState;

        const pCheck = isParallelizable(state);
        if (pCheck.parallelizable) {
          const regions = generateParallelRegions(state);
          expect(regions).toHaveLength(2);
          expect(regions[0].edgeIndex).toBe(0);
          expect(regions[1].edgeIndex).toBe(1);
        }
      }
    }
  });
});

// ---------- unionPolygons tests ----------

import {
  generateParallelRegionsPaper,
  unionPolygons,
  isSimplePolygon,
  simplifyPolygon
} from './parallelizable.js';
import { importFromFloatEdges, allEdgesToFloat } from './combinatorialPathLogic.js';
import {
  createIdentityFrame,
  applyReferenceFrame,
  updateReferenceFrameForSide,
  paperToTrueRhombus
} from './wallpaperGeometry.js';
import { isInteriorPoint, getIdentifiedSide, EPSILON } from './geometry.js';
import fs from 'fs';
import path from 'path';

/**
 * Replicate the computeEdgeFrames logic from ParallelRegionsViewer for tests.
 */
function isSameSideEdgeTest(edge) {
  if (isInteriorPoint(edge.from) || isInteriorPoint(edge.to)) return false;
  if (edge.from.side === edge.to.side) return true;
  if (getIdentifiedSide(edge.from.side) === edge.to.side &&
      Math.abs(edge.from.t - edge.to.t) < EPSILON) return true;
  return false;
}

function computeEdgeFrames(floatEdges) {
  const frames = [];
  let currentFrame = createIdentityFrame();
  for (let i = 0; i < floatEdges.length; i++) {
    frames.push({ ...currentFrame });
    const edge = floatEdges[i];
    if (!isInteriorPoint(edge.to)) {
      const nextEdge = floatEdges[i + 1];
      let shouldUpdateFrame = false;
      if (!isSameSideEdgeTest(edge)) {
        if (nextEdge) {
          const nextStartsSamePhysicalSide = !isInteriorPoint(nextEdge.from) &&
            nextEdge.from.side === edge.to.side;
          const nextIsSameSide = isSameSideEdgeTest(nextEdge);
          shouldUpdateFrame = !(nextIsSameSide && nextStartsSamePhysicalSide);
        } else {
          shouldUpdateFrame = true;
        }
      } else if (nextEdge) {
        if (!isInteriorPoint(nextEdge.from)) {
          const endSide = edge.to.side;
          const nextStartSide = nextEdge.from.side;
          if (endSide !== nextStartSide &&
              getIdentifiedSide(endSide) === nextStartSide &&
              Math.abs(edge.to.t - nextEdge.from.t) < EPSILON) {
            shouldUpdateFrame = true;
          }
        }
      }
      if (shouldUpdateFrame) {
        currentFrame = updateReferenceFrameForSide(edge.to.side, currentFrame);
      }
    }
  }
  return frames;
}

describe('unionPolygons', () => {
  it('should union the simple loop example into a single polygon', () => {
    // Load the simple loop example
    const examplePath = path.resolve(__dirname, '../../public/examples/exampleedge.json');
    const exampleEdges = JSON.parse(fs.readFileSync(examplePath, 'utf-8'));
    const state = importFromFloatEdges(exampleEdges);

    // Verify it is parallelizable
    const check = isParallelizable(state);
    expect(check.parallelizable).toBe(true);

    // Generate paper regions and lift to wallpaper space (same as ParallelRegionsViewer)
    const paperRegions = generateParallelRegionsPaper(state, 60);
    expect(paperRegions.length).toBeGreaterThan(1);

    const floatEdges = allEdgesToFloat(state);
    const edgeFrames = computeEdgeFrames(floatEdges);

    const fundamentalDomainPolygons = paperRegions.map(region => {
      const frame = edgeFrames[region.edgeIndex] || createIdentityFrame();
      return region.polygon.map(pt => {
        const local = paperToTrueRhombus(pt.southward, pt.eastward);
        return applyReferenceFrame(local.x, local.y, frame);
      });
    });

    // Union should produce exactly one polygon
    const unioned = unionPolygons(fundamentalDomainPolygons);
    expect(unioned).toHaveLength(1);
    expect(unioned[0].length).toBeGreaterThan(0);

    // Every point should have finite coordinates
    for (const pt of unioned[0]) {
      expect(Number.isFinite(pt.x)).toBe(true);
      expect(Number.isFinite(pt.y)).toBe(true);
    }
  });

  it('each individual subregion should be non-self-intersecting', () => {
    // Load the simple loop example
    const examplePath = path.resolve(__dirname, '../../public/examples/exampleedge.json');
    const exampleEdges = JSON.parse(fs.readFileSync(examplePath, 'utf-8'));
    const state = importFromFloatEdges(exampleEdges);

    // Verify it is parallelizable
    const check = isParallelizable(state);
    expect(check.parallelizable).toBe(true);

    // Generate paper regions and lift to wallpaper space
    const paperRegions = generateParallelRegionsPaper(state, 60);
    expect(paperRegions.length).toBeGreaterThan(1);

    const floatEdges = allEdgesToFloat(state);
    const edgeFrames = computeEdgeFrames(floatEdges);

    const fundamentalDomainPolygons = paperRegions.map(region => {
      const frame = edgeFrames[region.edgeIndex] || createIdentityFrame();
      return region.polygon.map(pt => {
        const local = paperToTrueRhombus(pt.southward, pt.eastward);
        return applyReferenceFrame(local.x, local.y, frame);
      });
    });

    // Each individual polygon should be simple (non-self-intersecting)
    for (let i = 0; i < fundamentalDomainPolygons.length; i++) {
      const poly = fundamentalDomainPolygons[i];
      expect(poly.length).toBeGreaterThanOrEqual(3);

      const simple = isSimplePolygon(poly);
      expect(simple, `Subregion ${i} (edge ${paperRegions[i].edgeIndex}) is self-intersecting`).toBe(true);

      // simplifyPolygon should return exactly one polygon for a clean input
      const simplified = simplifyPolygon(poly);
      expect(simplified.length, `Subregion ${i} splits into ${simplified.length} parts after simplification`).toBe(1);
    }
  });
});
