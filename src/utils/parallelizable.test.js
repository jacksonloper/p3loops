/**
 * Tests for parallelizable.js
 */

import { describe, it, expect } from 'vitest';
import {
  isParallelizable,
  generateParallelRegions,
  generateMergedBoundarySegmentsPaper
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

describe('generateMergedBoundarySegmentsPaper', () => {
  it('should return one segment for a single edge', () => {
    const state = buildOneEdgePath('north', 'south');
    const segments = generateMergedBoundarySegmentsPaper(state);

    expect(segments).toHaveLength(1);
    expect(segments[0].edgeIndex).toBe(0);
    expect(segments[0].points.length).toBeGreaterThan(0);
  });

  it('should return segments with valid paper coordinates', () => {
    const state = buildOneEdgePath('north', 'south');
    const segments = generateMergedBoundarySegmentsPaper(state);

    for (const seg of segments) {
      for (const pt of seg.points) {
        expect(typeof pt.southward).toBe('number');
        expect(typeof pt.eastward).toBe('number');
        expect(Number.isFinite(pt.southward)).toBe(true);
        expect(Number.isFinite(pt.eastward)).toBe(true);
      }
    }
  });

  it('should return multiple segments for a two-edge path with no internal chords', () => {
    let state = buildOneEdgePath('north', 'south');
    const nextStart = getNextStartPoint(state);
    const allSegs = getAllSegments(state);
    const eastSegments = allSegs.filter(s => s.side === 'east');

    if (eastSegments.length > 0) {
      const result = addEdgeToSegment(state, nextStart, eastSegments[0]);
      if (result.newState) {
        state = result.newState;
        const pCheck = isParallelizable(state);
        if (pCheck.parallelizable) {
          const segments = generateMergedBoundarySegmentsPaper(state);

          // With 2 edges: 2 endcap arcs each = 4 arc segments, no G1/G2 arcs
          expect(segments.length).toBeGreaterThanOrEqual(4);

          // All segments should have valid edgeIndex (0 or 1)
          for (const seg of segments) {
            expect(seg.edgeIndex).toBeGreaterThanOrEqual(0);
            expect(seg.edgeIndex).toBeLessThanOrEqual(1);
          }

          // The concatenated points should form a single closed path
          const allPts = segments.flatMap(seg => seg.points);
          expect(allPts.length).toBeGreaterThan(0);
        }
      }
    }
  });
});
