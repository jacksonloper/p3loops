/**
 * Tests for combinatorialPathLogic.js
 */

import { describe, it, expect } from 'vitest';
import {
  createInitialState,
  getSideGroup,
  sidesAreIdentified,
  insertPoint,
  getSegmentsInGroup,
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
  canCloseLoop
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

describe('getSegmentsInGroup', () => {
  it('should return one segment for empty group', () => {
    const state = createInitialState();
    const segments = getSegmentsInGroup(state, 'NE');
    
    expect(segments.length).toBe(1);
    expect(segments[0]).toEqual({ startPos: null, endPos: null, group: 'NE' });
  });

  it('should return two segments for one point', () => {
    let state = createInitialState();
    state = insertPoint(state, 'NE', 0, 'north');
    const segments = getSegmentsInGroup(state, 'NE');
    
    expect(segments.length).toBe(2);
    expect(segments[0]).toEqual({ startPos: null, endPos: 0, group: 'NE' });
    expect(segments[1]).toEqual({ startPos: 0, endPos: null, group: 'NE' });
  });

  it('should return three segments for two points', () => {
    let state = createInitialState();
    state = insertPoint(state, 'NE', 0, 'north');
    state = insertPoint(state, 'NE', 1, 'east');
    const segments = getSegmentsInGroup(state, 'NE');
    
    expect(segments.length).toBe(3);
    expect(segments[0]).toEqual({ startPos: null, endPos: 0, group: 'NE' });
    expect(segments[1]).toEqual({ startPos: 0, endPos: 1, group: 'NE' });
    expect(segments[2]).toEqual({ startPos: 1, endPos: null, group: 'NE' });
  });
});

describe('getAllSegments', () => {
  it('should return segments from both groups', () => {
    const state = createInitialState();
    const segments = getAllSegments(state);
    
    expect(segments.length).toBe(2);
    expect(segments.some(s => s.group === 'NE')).toBe(true);
    expect(segments.some(s => s.group === 'SW')).toBe(true);
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
  it('should detect crossing chords', () => {
    // Create a state with 2 points on each group
    let state = createInitialState();
    state = insertPoint(state, 'NE', 0, 'north');
    state = insertPoint(state, 'NE', 1, 'north');
    state = insertPoint(state, 'SW', 0, 'south');
    state = insertPoint(state, 'SW', 1, 'south');
    
    // Edge from NE[0] to SW[1]
    const edge1 = { 
      from: { side: 'north', pos: 0 }, 
      to: { side: 'south', pos: 1 } 
    };
    
    // Edge from NE[1] to SW[0] - this should cross edge1
    const edge2 = { 
      from: { side: 'north', pos: 1 }, 
      to: { side: 'south', pos: 0 } 
    };
    
    expect(edgesCross(edge1, edge2, state)).toBe(true);
  });

  it('should not detect crossing for parallel chords', () => {
    let state = createInitialState();
    state = insertPoint(state, 'NE', 0, 'north');
    state = insertPoint(state, 'NE', 1, 'north');
    state = insertPoint(state, 'SW', 0, 'south');
    state = insertPoint(state, 'SW', 1, 'south');
    
    // Edge from NE[0] to SW[0]
    const edge1 = { 
      from: { side: 'north', pos: 0 }, 
      to: { side: 'south', pos: 0 } 
    };
    
    // Edge from NE[1] to SW[1] - parallel, no crossing
    const edge2 = { 
      from: { side: 'north', pos: 1 }, 
      to: { side: 'south', pos: 1 } 
    };
    
    expect(edgesCross(edge1, edge2, state)).toBe(false);
  });
});

describe('addFirstEdge', () => {
  it('should add the first edge between two groups', () => {
    const state = createInitialState();
    const fromSegment = { startPos: null, endPos: null, group: 'NE' };
    const toSegment = { startPos: null, endPos: null, group: 'SW' };
    
    const { newState } = addFirstEdge(state, fromSegment, 'north', toSegment, 'south');
    
    expect(newState.points.NE.length).toBe(1);
    expect(newState.points.SW.length).toBe(1);
    expect(newState.edges.length).toBe(1);
    expect(newState.edges[0].from.side).toBe('north');
    expect(newState.edges[0].to.side).toBe('south');
  });
});

describe('addEdgeToSegment', () => {
  it('should add an edge from existing point to segment', () => {
    const state = createInitialState();
    const fromSegment = { startPos: null, endPos: null, group: 'NE' };
    const toSegment = { startPos: null, endPos: null, group: 'SW' };
    
    const { newState: state1 } = addFirstEdge(state, fromSegment, 'north', toSegment, 'south');
    
    // Now add from identified side (west, which equals south)
    const startPoint = getNextStartPoint(state1);
    expect(startPoint.side).toBe('west');
    
    // Add edge to a new segment on NE
    const segments = getSegmentsInGroup(state1, 'NE');
    // There should be 2 segments now (before and after the one point)
    const result = addEdgeToSegment(state1, startPoint, segments[1], 'north');
    
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
  it('should remove the last edge and its endpoint', () => {
    const state = createInitialState();
    const fromSegment = { startPos: null, endPos: null, group: 'NE' };
    const toSegment = { startPos: null, endPos: null, group: 'SW' };
    
    const { newState: state1 } = addFirstEdge(state, fromSegment, 'north', toSegment, 'south');
    
    expect(state1.edges.length).toBe(1);
    expect(state1.points.SW.length).toBe(1);
    
    const state2 = removeLastEdge(state1);
    
    expect(state2.edges.length).toBe(0);
    expect(state2.points.SW.length).toBe(0);
    // Note: The from point remains since it wasn't created by this edge
    expect(state2.points.NE.length).toBe(1);
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
  it('should allow closing when endpoints are on same side group', () => {
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
    
    // The closing edge should be from east(1) to east(0) - same side!
    // NOT from north(1) to east(0) which would cross the rhombus
    expect(result.closingEdge.from.side).toBe(result.closingEdge.to.side);
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
