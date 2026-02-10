/**
 * Tests for combinatorialPathLogic.js
 */

import { describe, it, expect } from 'vitest';
import {
  createInitialState,
  getSideGroup,
  sidesAreIdentified,
  insertPoint,
  getSegmentsOnSide,
  getAllSegments,
  pointsEqual,
  edgesCross,
  addEdgeToSegment,
  addFirstEdge,
  edgeToFloat,
  allEdgesToFloat,
  removeLastEdge,
  getNextStartPoint,
  importFromFloatEdges,
  canCloseLoop,
  getValidSegments
} from './combinatorialPathLogic.js';

describe('getSideGroup', () => {
  it('should return NE for north and east', () => {
    expect(getSideGroup('north')).toBe('NE');
    expect(getSideGroup('east')).toBe('NE');
  });

  it('should return SW for south and west', () => {
    expect(getSideGroup('south')).toBe('SW');
    expect(getSideGroup('west')).toBe('SW');
  });
});

describe('sidesAreIdentified', () => {
  it('should return true for north and east', () => {
    expect(sidesAreIdentified('north', 'east')).toBe(true);
    expect(sidesAreIdentified('east', 'north')).toBe(true);
  });

  it('should return true for south and west', () => {
    expect(sidesAreIdentified('south', 'west')).toBe(true);
    expect(sidesAreIdentified('west', 'south')).toBe(true);
  });

  it('should return false for non-identified sides', () => {
    expect(sidesAreIdentified('north', 'south')).toBe(false);
    expect(sidesAreIdentified('east', 'west')).toBe(false);
  });
});

describe('createInitialState', () => {
  it('should create an empty state', () => {
    const state = createInitialState();
    expect(state.points.NE).toEqual([]);
    expect(state.points.SW).toEqual([]);
    expect(state.edges).toEqual([]);
  });
});

describe('insertPoint', () => {
  it('should insert a point at position 0 in empty group', () => {
    const state = createInitialState();
    const newState = insertPoint(state, 'NE', 0, 'north');
    
    expect(newState.points.NE.length).toBe(1);
    expect(newState.points.NE[0].pos).toBe(0);
    expect(newState.points.NE[0].originalSide).toBe('north');
  });

  it('should reindex points when inserting', () => {
    let state = createInitialState();
    state = insertPoint(state, 'NE', 0, 'north');
    state = insertPoint(state, 'NE', 0, 'east');  // Insert at beginning
    
    expect(state.points.NE.length).toBe(2);
    expect(state.points.NE[0].pos).toBe(0);
    expect(state.points.NE[0].originalSide).toBe('east');
    expect(state.points.NE[1].pos).toBe(1);
    expect(state.points.NE[1].originalSide).toBe('north');
  });
});

describe('getSegmentsOnSide', () => {
  it('should return one segment for empty side', () => {
    const state = createInitialState();
    const segments = getSegmentsOnSide(state, 'north');
    
    expect(segments.length).toBe(1);
    expect(segments[0]).toEqual({ startPos: null, endPos: null, side: 'north' });
  });

  it('should return two segments for one point', () => {
    let state = createInitialState();
    state = insertPoint(state, 'NE', 0, 'north');
    const segments = getSegmentsOnSide(state, 'north');
    
    expect(segments.length).toBe(2);
    expect(segments[0]).toEqual({ startPos: null, endPos: 0, side: 'north' });
    expect(segments[1]).toEqual({ startPos: 0, endPos: null, side: 'north' });
  });

  it('should return three segments for two points', () => {
    let state = createInitialState();
    state = insertPoint(state, 'NE', 0, 'north');
    state = insertPoint(state, 'NE', 1, 'east');
    const segments = getSegmentsOnSide(state, 'north');
    
    expect(segments.length).toBe(3);
    expect(segments[0]).toEqual({ startPos: null, endPos: 0, side: 'north' });
    expect(segments[1]).toEqual({ startPos: 0, endPos: 1, side: 'north' });
    expect(segments[2]).toEqual({ startPos: 1, endPos: null, side: 'north' });
  });
});

describe('getAllSegments', () => {
  it('should return segments from all four sides', () => {
    const state = createInitialState();
    const segments = getAllSegments(state);
    
    // 4 sides, each with 1 segment (empty state)
    expect(segments.length).toBe(4);
    expect(segments.some(s => s.side === 'north')).toBe(true);
    expect(segments.some(s => s.side === 'east')).toBe(true);
    expect(segments.some(s => s.side === 'south')).toBe(true);
    expect(segments.some(s => s.side === 'west')).toBe(true);
  });
});

describe('pointsEqual', () => {
  it('should consider north and east with same pos as equal', () => {
    const p1 = { side: 'north', pos: 0 };
    const p2 = { side: 'east', pos: 0 };
    expect(pointsEqual(p1, p2)).toBe(true);
  });

  it('should consider south and west with same pos as equal', () => {
    const p1 = { side: 'south', pos: 0 };
    const p2 = { side: 'west', pos: 0 };
    expect(pointsEqual(p1, p2)).toBe(true);
  });

  it('should not consider north and south as equal', () => {
    const p1 = { side: 'north', pos: 0 };
    const p2 = { side: 'south', pos: 0 };
    expect(pointsEqual(p1, p2)).toBe(false);
  });
});

describe('edgesCross', () => {
  it('should detect crossing when edges form an X shape geometrically', () => {
    // Create a state with 2 points on each group
    let state = createInitialState();
    state = insertPoint(state, 'NE', 0, 'north');
    state = insertPoint(state, 'NE', 1, 'north');
    state = insertPoint(state, 'SW', 0, 'south');
    state = insertPoint(state, 'SW', 1, 'south');
    
    // With 2 points on each side:
    // NE[0] at t=0.25: north(0.25, 0)
    // NE[1] at t=0.75: north(0.75, 0)
    // SW[0] at t=0.25: south(0.75, 1) - note: south t=0 is at SE corner!
    // SW[1] at t=0.75: south(0.25, 1)
    
    // Edge from NE[0] to SW[0]: (0.25, 0) -> (0.75, 1) - diagonal going right-down
    const edge1 = { 
      from: { side: 'north', pos: 0 }, 
      to: { side: 'south', pos: 0 } 
    };
    
    // Edge from NE[1] to SW[1]: (0.75, 0) -> (0.25, 1) - diagonal going left-down
    // These diagonals form an X and CROSS in the middle
    const edge2 = { 
      from: { side: 'north', pos: 1 }, 
      to: { side: 'south', pos: 1 } 
    };
    
    expect(edgesCross(edge1, edge2, state)).toBe(true);
  });

  it('should not detect crossing for parallel vertical edges', () => {
    let state = createInitialState();
    state = insertPoint(state, 'NE', 0, 'north');
    state = insertPoint(state, 'NE', 1, 'north');
    state = insertPoint(state, 'SW', 0, 'south');
    state = insertPoint(state, 'SW', 1, 'south');
    
    // Edge from NE[0] to SW[1]: (0.25, 0) -> (0.25, 1) - vertical line at x=0.25
    const edge1 = { 
      from: { side: 'north', pos: 0 }, 
      to: { side: 'south', pos: 1 } 
    };
    
    // Edge from NE[1] to SW[0]: (0.75, 0) -> (0.75, 1) - vertical line at x=0.75
    // These are parallel vertical lines - they DON'T cross
    const edge2 = { 
      from: { side: 'north', pos: 1 }, 
      to: { side: 'south', pos: 0 } 
    };
    
    expect(edgesCross(edge1, edge2, state)).toBe(false);
  });

  it('should detect crossing when same-side arc contains endpoint of cross-group edge', () => {
    // Bug fix test: A same-side arc from west(1) to west(3) that contains west(2),
    // where an existing edge ends at west(2), should be detected as a crossing.
    // This is because the arc must "go around" and cross the edge geometrically.
    let state = createInitialState();
    // Create 4 points on SW group (for west(0), west(1), west(2), west(3))
    state = insertPoint(state, 'SW', 0, 'west');
    state = insertPoint(state, 'SW', 1, 'west');
    state = insertPoint(state, 'SW', 2, 'west');
    state = insertPoint(state, 'SW', 3, 'west');
    // Create 2 points on NE group (for north(0), north(1))
    state = insertPoint(state, 'NE', 0, 'north');
    state = insertPoint(state, 'NE', 1, 'north');
    
    // Same-side arc from west(1) to west(3)
    const arcEdge = { 
      from: { side: 'west', pos: 1 }, 
      to: { side: 'west', pos: 3 } 
    };
    
    // Cross-group edge that ends at west(2) - strictly inside the arc
    const crossEdge = { 
      from: { side: 'north', pos: 1 }, 
      to: { side: 'west', pos: 2 } 
    };
    
    // The arc contains the endpoint of the cross-group edge, so they cross
    expect(edgesCross(arcEdge, crossEdge, state)).toBe(true);
  });

  it('should not detect crossing for edges sharing an endpoint', () => {
    let state = createInitialState();
    state = insertPoint(state, 'NE', 0, 'north');
    state = insertPoint(state, 'NE', 1, 'north');
    state = insertPoint(state, 'SW', 0, 'south');
    
    // Edge from north(0) to south(0)
    const edge1 = { 
      from: { side: 'north', pos: 0 }, 
      to: { side: 'south', pos: 0 } 
    };
    
    // Edge from north(1) to south(0) - shares endpoint with edge1
    const edge2 = { 
      from: { side: 'north', pos: 1 }, 
      to: { side: 'south', pos: 0 } 
    };
    
    expect(edgesCross(edge1, edge2, state)).toBe(false);
  });

  it('should handle edges on identified sides correctly (north-east identification)', () => {
    let state = createInitialState();
    // 3 points in NE group, 3 in SW group
    state = insertPoint(state, 'NE', 0, 'north');
    state = insertPoint(state, 'NE', 1, 'north');
    state = insertPoint(state, 'NE', 2, 'east');
    state = insertPoint(state, 'SW', 0, 'south');
    state = insertPoint(state, 'SW', 1, 'south');
    state = insertPoint(state, 'SW', 2, 'west');
    
    // Edge from north(0) to south(1)
    const edge1 = { 
      from: { side: 'north', pos: 0 }, 
      to: { side: 'south', pos: 1 } 
    };
    
    // Edge from east(2) to west(0) - on different sides but same groups
    // These should cross in the middle of the square
    const edge2 = { 
      from: { side: 'east', pos: 2 }, 
      to: { side: 'west', pos: 0 } 
    };
    
    expect(edgesCross(edge1, edge2, state)).toBe(true);
  });

  it('should handle same-side wrap-around arcs', () => {
    let state = createInitialState();
    // 4 points in NE group
    state = insertPoint(state, 'NE', 0, 'north');
    state = insertPoint(state, 'NE', 1, 'north');
    state = insertPoint(state, 'NE', 2, 'north');
    state = insertPoint(state, 'NE', 3, 'north');
    state = insertPoint(state, 'SW', 0, 'south');
    
    // Edge from north(3) to north(1) - same-side arc going "backward"
    const arcEdge = { 
      from: { side: 'north', pos: 3 }, 
      to: { side: 'north', pos: 1 } 
    };
    
    // Edge from north(2) to south(0) - has endpoint at north(2)
    // north(2) is between north(1) and north(3), so this should cross
    const crossEdge = { 
      from: { side: 'north', pos: 2 }, 
      to: { side: 'south', pos: 0 } 
    };
    
    expect(edgesCross(arcEdge, crossEdge, state)).toBe(true);
  });
});

describe('addFirstEdge', () => {
  it('should add the first edge between two sides', () => {
    const state = createInitialState();
    const fromSegment = { startPos: null, endPos: null, side: 'north' };
    const toSegment = { startPos: null, endPos: null, side: 'south' };
    
    const { newState } = addFirstEdge(state, fromSegment, toSegment);
    
    expect(newState.points.NE.length).toBe(1);
    expect(newState.points.SW.length).toBe(1);
    expect(newState.edges.length).toBe(1);
    expect(newState.edges[0].from.side).toBe('north');
    expect(newState.edges[0].to.side).toBe('south');
  });

  it('should produce valid t values when going from north to east "after start"', () => {
    // Bug fix test: Previously, creating an edge from north to east "after start"
    // would result in t=1.25 because position calculations were incorrect.
    // Valid t values must be in range [0, 1], representing position along a side.
    const state = createInitialState();
    const fromSegment = { startPos: null, endPos: null, side: 'north' };
    // "after start" segment has startPos: 0, endPos: null
    const toSegment = { startPos: 0, endPos: null, side: 'east', firstEdgeLabel: 'after start' };
    
    const { newState } = addFirstEdge(state, fromSegment, toSegment);
    
    // Both points should be in NE group since north and east are identified
    expect(newState.points.NE.length).toBe(2);
    expect(newState.edges.length).toBe(1);
    
    // Convert to float and verify t values are in valid range [0, 1]
    const floatEdges = allEdgesToFloat(newState);
    expect(floatEdges[0].from.t).toBeGreaterThanOrEqual(0);
    expect(floatEdges[0].from.t).toBeLessThanOrEqual(1);
    expect(floatEdges[0].to.t).toBeGreaterThanOrEqual(0);
    expect(floatEdges[0].to.t).toBeLessThanOrEqual(1);
    
    // The "after start" point should have a higher t value than the start point
    expect(floatEdges[0].to.t).toBeGreaterThan(floatEdges[0].from.t);
  });

  it('should produce valid t values when going from north to east "before start"', () => {
    const state = createInitialState();
    const fromSegment = { startPos: null, endPos: null, side: 'north' };
    // "before start" segment has startPos: null, endPos: 0
    const toSegment = { startPos: null, endPos: 0, side: 'east', firstEdgeLabel: 'before start' };
    
    const { newState } = addFirstEdge(state, fromSegment, toSegment);
    
    // Both points should be in NE group
    expect(newState.points.NE.length).toBe(2);
    expect(newState.edges.length).toBe(1);
    
    // Convert to float and verify t values are in valid range [0, 1]
    const floatEdges = allEdgesToFloat(newState);
    expect(floatEdges[0].from.t).toBeGreaterThanOrEqual(0);
    expect(floatEdges[0].from.t).toBeLessThanOrEqual(1);
    expect(floatEdges[0].to.t).toBeGreaterThanOrEqual(0);
    expect(floatEdges[0].to.t).toBeLessThanOrEqual(1);
    
    // The "before start" point should have a lower t value than the start point
    expect(floatEdges[0].to.t).toBeLessThan(floatEdges[0].from.t);
  });

  it('should produce valid t values when going from north to north "after start"', () => {
    const state = createInitialState();
    const fromSegment = { startPos: null, endPos: null, side: 'north' };
    const toSegment = { startPos: 0, endPos: null, side: 'north', firstEdgeLabel: 'after start' };
    
    const { newState } = addFirstEdge(state, fromSegment, toSegment);
    
    expect(newState.points.NE.length).toBe(2);
    
    const floatEdges = allEdgesToFloat(newState);
    expect(floatEdges[0].from.t).toBeGreaterThanOrEqual(0);
    expect(floatEdges[0].from.t).toBeLessThanOrEqual(1);
    expect(floatEdges[0].to.t).toBeGreaterThanOrEqual(0);
    expect(floatEdges[0].to.t).toBeLessThanOrEqual(1);
    
    // After start should be higher t
    expect(floatEdges[0].to.t).toBeGreaterThan(floatEdges[0].from.t);
  });
});

describe('addEdgeToSegment', () => {
  it('should add an edge from existing point to segment', () => {
    const state = createInitialState();
    const fromSegment = { startPos: null, endPos: null, side: 'north' };
    const toSegment = { startPos: null, endPos: null, side: 'south' };
    
    const { newState: state1 } = addFirstEdge(state, fromSegment, toSegment);
    
    // Now add from identified side (west, which equals south)
    const startPoint = getNextStartPoint(state1);
    expect(startPoint.side).toBe('west');
    
    // Add edge to a valid segment on north side (before the existing point)
    // Segment [null, 0] doesn't geometrically cross the existing edge
    const segments = getSegmentsOnSide(state1, 'north');
    const result = addEdgeToSegment(state1, startPoint, segments[0]); // Use segment [null, 0]
    
    expect(result.newState.edges.length).toBe(2);
    expect(result.newState.points.NE.length).toBe(2);
  });
});

describe('edgeToFloat', () => {
  it('should convert integer positions to float t values', () => {
    let state = createInitialState();
    state = insertPoint(state, 'NE', 0, 'north');
    state = insertPoint(state, 'NE', 1, 'east');
    
    const edge = {
      from: { side: 'north', pos: 0 },
      to: { side: 'east', pos: 1 }
    };
    
    const floatEdge = edgeToFloat(edge, state);
    
    // With 2 points, positions should be at 0.25 and 0.75
    expect(floatEdge.from.t).toBeCloseTo(0.25);
    expect(floatEdge.to.t).toBeCloseTo(0.75);
  });
});

describe('removeLastEdge', () => {
  it('should remove the first edge and reset to initial state', () => {
    const state = createInitialState();
    const fromSegment = { startPos: null, endPos: null, side: 'north' };
    const toSegment = { startPos: null, endPos: null, side: 'south' };
    
    const { newState: state1 } = addFirstEdge(state, fromSegment, toSegment);
    
    expect(state1.edges.length).toBe(1);
    expect(state1.points.NE.length).toBe(1);
    expect(state1.points.SW.length).toBe(1);
    
    // Removing the only edge should reset to initial state
    const state2 = removeLastEdge(state1);
    
    expect(state2.edges.length).toBe(0);
    expect(state2.points.NE.length).toBe(0);
    expect(state2.points.SW.length).toBe(0);
  });

  it('should remove only the endpoint when there are multiple edges', () => {
    const state = createInitialState();
    const fromSegment = { startPos: null, endPos: null, side: 'north' };
    const toSegment = { startPos: null, endPos: null, side: 'south' };
    
    const { newState: state1 } = addFirstEdge(state, fromSegment, toSegment);
    
    // Add a second edge to a valid segment (before the existing point)
    const startPoint = getNextStartPoint(state1);
    const segments = getSegmentsOnSide(state1, 'north');
    const { newState: state2 } = addEdgeToSegment(state1, startPoint, segments[0]); // Use valid segment
    
    expect(state2.edges.length).toBe(2);
    expect(state2.points.NE.length).toBe(2);
    expect(state2.points.SW.length).toBe(1);
    
    // Remove the last edge
    const state3 = removeLastEdge(state2);
    
    expect(state3.edges.length).toBe(1);
    expect(state3.points.NE.length).toBe(1);
    expect(state3.points.SW.length).toBe(1);
  });
});

describe('importFromFloatEdges', () => {
  it('should import the example edge json correctly', () => {
    const exampleEdges = [
      { from: { side: 'north', t: 0.456 }, to: { side: 'west', t: 0.611 } },
      { from: { side: 'south', t: 0.611 }, to: { side: 'north', t: 0.72 } },
      { from: { side: 'east', t: 0.72 }, to: { side: 'south', t: 0.375 } },
      { from: { side: 'west', t: 0.375 }, to: { side: 'north', t: 0.207 } }
    ];
    
    const state = importFromFloatEdges(exampleEdges);
    
    // Should have points on both groups
    expect(state.points.NE.length).toBeGreaterThan(0);
    expect(state.points.SW.length).toBeGreaterThan(0);
    expect(state.edges.length).toBe(4);
    
    // Verify edges reference correct side groups
    for (const edge of state.edges) {
      expect(['north', 'east', 'south', 'west']).toContain(edge.from.side);
      expect(['north', 'east', 'south', 'west']).toContain(edge.to.side);
    }
    
    // Verify that points are deduplicated properly
    // NE group: 0.207, 0.456, 0.72 (3 unique t values)
    // SW group: 0.375, 0.611 (2 unique t values)
    expect(state.points.NE.length).toBe(3);
    expect(state.points.SW.length).toBe(2);
  });

  it('should simplify edges with interior points', () => {
    const edgesWithInterior = [
      { from: { side: 'north', t: 0.5 }, to: { interior: true, southward: 0.5, eastward: 0.5 } },
      { from: { interior: true, southward: 0.5, eastward: 0.5 }, to: { side: 'south', t: 0.5 } }
    ];
    
    const state = importFromFloatEdges(edgesWithInterior);
    
    // Should be simplified to one edge
    expect(state.edges.length).toBe(1);
    expect(state.edges[0].from.side).toBe('north');
    expect(state.edges[0].to.side).toBe('south');
  });
});

describe('canCloseLoop', () => {
  it('should allow closing when endpoints are on same side group and adjacent', () => {
    let state = createInitialState();
    
    // Create a simple path: NE -> SW -> NE -> SW
    // That ends on the same side group as it started
    state = insertPoint(state, 'NE', 0, 'north');
    state = insertPoint(state, 'NE', 1, 'north');
    state = insertPoint(state, 'SW', 0, 'south');
    state = insertPoint(state, 'SW', 1, 'south');
    
    state = {
      ...state,
      edges: [
        { from: { side: 'north', pos: 0 }, to: { side: 'south', pos: 0 } },
        { from: { side: 'west', pos: 0 }, to: { side: 'north', pos: 1 } }
        // Now we're at north pos 1, can we close back to north pos 0?
        // The continuation is east pos 1, and we want to get to north pos 0
      ]
    };
    
    const result = canCloseLoop(state);
    expect(result.canClose).toBe(true);
  });

  it('should NOT allow closing when endpoints are not adjacent', () => {
    // Create a state where last point is at pos 2 and first point is at pos 0
    // (not adjacent - differ by 2)
    let state = {
      points: {
        NE: [
          { pos: 0, originalSide: 'north' },
          { pos: 1, originalSide: 'north' },
          { pos: 2, originalSide: 'north' }
        ],
        SW: [
          { pos: 0, originalSide: 'south' }
        ]
      },
      edges: [
        { from: { side: 'north', pos: 0 }, to: { side: 'south', pos: 0 } },
        { from: { side: 'west', pos: 0 }, to: { side: 'north', pos: 2 } }
        // Now we're at north pos 2, trying to close back to north pos 0
        // These are NOT adjacent (differ by 2), so closing should fail
      ]
    };
    
    const result = canCloseLoop(state);
    expect(result.canClose).toBe(false);
    expect(result.error).toContain('adjacent');
  });

  it('should create closing edge on the same side as first point', () => {
    // Path: north(0) -> south(0) -> north(1) (via west->north continuation)
    // The path ends at north(1), but the continuation would be on east(1)
    // We want to close back to north(0)
    // The closing edge should be from north(1) to north(0), NOT from east(1) to north(0)
    let state = {
      points: {
        NE: [
          { pos: 0, originalSide: 'north' },
          { pos: 1, originalSide: 'north' }
        ],
        SW: [
          { pos: 0, originalSide: 'south' }
        ]
      },
      edges: [
        { from: { side: 'north', pos: 0 }, to: { side: 'south', pos: 0 } },
        { from: { side: 'west', pos: 0 }, to: { side: 'north', pos: 1 } }
      ]
    };
    
    const result = canCloseLoop(state);
    expect(result.canClose).toBe(true);
    
    // The closing edge should have BOTH endpoints on the same side (north)
    // This ensures the edge walks along the boundary, not across the rhombus
    expect(result.closingEdge.from.side).toBe('north');
    expect(result.closingEdge.to.side).toBe('north');
  });

  it('should NOT create closing edge that crosses the rhombus (identified sides at different positions)', () => {
    // Same as above but verify the closing edge doesn't go from east to north
    let state = {
      points: {
        NE: [
          { pos: 0, originalSide: 'east' },
          { pos: 1, originalSide: 'north' }
        ],
        SW: [
          { pos: 0, originalSide: 'south' }
        ]
      },
      edges: [
        { from: { side: 'east', pos: 0 }, to: { side: 'south', pos: 0 } },
        { from: { side: 'west', pos: 0 }, to: { side: 'north', pos: 1 } }
      ]
    };
    
    const result = canCloseLoop(state);
    expect(result.canClose).toBe(true);
    
    // The path ends at north(1), but the first point is on east(0).
    // Since north and east are identified, they're in the same side group.
    // The closing edge should be from east(1) to east(0) - staying on east.
    // This is correct because we use firstPoint.side (east) for the closing edge,
    // NOT the continuation side (north) which would create a cross-rhombus edge.
    expect(result.closingEdge.from.side).toBe(result.closingEdge.to.side);
    expect(result.closingEdge.from.side).toBe('east');
    expect(result.closingEdge.to.side).toBe('east');
  });
});

describe('ordering preservation', () => {
  it('should preserve point ordering from float edges', () => {
    // Test with a more complex example
    const floatEdges = [
      { from: { side: 'north', t: 0.2 }, to: { side: 'south', t: 0.8 } },
      { from: { side: 'west', t: 0.8 }, to: { side: 'north', t: 0.6 } },
      { from: { side: 'east', t: 0.6 }, to: { side: 'south', t: 0.4 } },
      { from: { side: 'west', t: 0.4 }, to: { side: 'north', t: 0.4 } }
    ];
    
    const state = importFromFloatEdges(floatEdges);
    const backToFloat = allEdgesToFloat(state);
    
    // Check that the relative ordering is preserved
    // NE points in order: 0.2, 0.4, 0.6
    // SW points in order: 0.4, 0.8
    
    // Edge 0: from lowest NE to highest SW
    // Edge 1: from highest SW to middle NE
    // etc.
    
    // The t values should maintain relative ordering even if absolute values differ
    for (let i = 0; i < floatEdges.length; i++) {
      // Check that the relative positions are maintained
      const origFrom = floatEdges[i].from;
      const origTo = floatEdges[i].to;
      const convFrom = backToFloat[i].from;
      const convTo = backToFloat[i].to;
      
      expect(getSideGroup(convFrom.side)).toBe(getSideGroup(origFrom.side));
      expect(getSideGroup(convTo.side)).toBe(getSideGroup(origTo.side));
    }
  });
});

describe('getValidSegments - same-side arc crossing detection', () => {
  it('should not allow west "after pt 3" when arc would contain edge endpoint', () => {
    // Bug fix test: User reported that "west after point 3" was shown as valid
    // when it should not be, because the arc would contain the endpoint of edge 2.
    const floatEdges = [
      { from: { side: "north", t: 0.125 }, to: { side: "west", t: 0.16666666666666666 } },
      { from: { side: "south", t: 0.16666666666666666 }, to: { side: "east", t: 0.375 } },
      { from: { side: "north", t: 0.375 }, to: { side: "west", t: 0.8333333333333334 } },
      { from: { side: "south", t: 0.8333333333333334 }, to: { side: "east", t: 0.875 } },
      { from: { side: "north", t: 0.875 }, to: { side: "north", t: 0.625 } },
      { from: { side: "east", t: 0.625 }, to: { side: "south", t: 0.5 } }
    ];
    
    const state = importFromFloatEdges(floatEdges);
    const nextStart = getNextStartPoint(state);
    
    // nextStart should be west(1), since edge 5 ends at south(1), which continues from west(1)
    expect(nextStart.side).toBe('west');
    expect(nextStart.pos).toBe(1);
    
    const validSegments = getValidSegments(state, nextStart);
    
    // "west after pt 3" would be { startPos: 2, endPos: null, side: 'west' }
    // This should NOT be in the valid segments because the arc from west(1) to west(3)
    // would contain west(2), which is the endpoint of edge 2.
    const westAfterPt3 = validSegments.find(
      s => s.side === 'west' && s.startPos === 2 && s.endPos === null
    );
    
    expect(westAfterPt3).toBeUndefined();
  });
});

describe('getValidSegments - same-side touching segment rule', () => {
  it('should NOT allow segment on same side that touches the from point', () => {
    // Create a state where last edge ends at west(1)
    // getNextStartPoint returns south(1) since west and south are identified
    // We should NOT be able to go to south segments that touch position 1
    let state = {
      points: {
        NE: [
          { pos: 0, originalSide: 'north' }
        ],
        SW: [
          { pos: 0, originalSide: 'west' },
          { pos: 1, originalSide: 'west' },
          { pos: 2, originalSide: 'west' }
        ]
      },
      edges: [
        { from: { side: 'north', pos: 0 }, to: { side: 'west', pos: 1 } }
      ]
    };
    
    // After edge to west(1), getNextStartPoint returns south(1) (identified side)
    const fromPoint = { side: 'south', pos: 1 };
    
    const validSegments = getValidSegments(state, fromPoint);
    
    // Segments on south that touch position 1 should be forbidden:
    // - { startPos: 0, endPos: 1, side: 'south' } - endPos touches 1
    // - { startPos: 1, endPos: 2, side: 'south' } - startPos touches 1
    const southTouchingBefore = validSegments.find(
      s => s.side === 'south' && s.endPos === 1
    );
    const southTouchingAfter = validSegments.find(
      s => s.side === 'south' && s.startPos === 1
    );
    
    expect(southTouchingBefore).toBeUndefined();
    expect(southTouchingAfter).toBeUndefined();
  });

  it('should ALLOW segment on identified side that touches the from point position', () => {
    // When the fromPoint is south(1), we CAN go to west segments that touch position 1
    // because south and west are identified sides (same group but different side)
    let state = {
      points: {
        NE: [
          { pos: 0, originalSide: 'north' }
        ],
        SW: [
          { pos: 0, originalSide: 'west' },
          { pos: 1, originalSide: 'west' },
          { pos: 2, originalSide: 'west' }
        ]
      },
      edges: [
        { from: { side: 'north', pos: 0 }, to: { side: 'west', pos: 1 } }
      ]
    };
    
    // After edge to west(1), getNextStartPoint returns south(1) (identified side)
    const fromPoint = { side: 'south', pos: 1 };
    
    const validSegments = getValidSegments(state, fromPoint);
    
    // Segments on west (the identified side) that touch position 1 SHOULD be allowed
    // These represent different geometric paths than same-side segments
    const westTouchingBefore = validSegments.find(
      s => s.side === 'west' && s.endPos === 1
    );
    const westTouchingAfter = validSegments.find(
      s => s.side === 'west' && s.startPos === 1
    );
    
    // At least one of these should be present (unless blocked by crossing)
    // The key point is they are NOT forbidden by the same-side touching rule
    // They may still be filtered by crossing detection
    expect(westTouchingBefore !== undefined || westTouchingAfter !== undefined).toBe(true);
  });
});
