/**
 * Tests for p2PathLogic.js
 */

import { describe, it, expect } from 'vitest';
import {
  createInitialState,
  getZoneGroup,
  getIdentifiedZone,
  zonesAreIdentified,
  insertPoint,
  getSegmentsOnZone,
  getAllSegments,
  pointsEqual,
  edgesCross,
  addEdgeToSegment,
  addFirstEdge,
  edgeToFloat,
  allEdgesToFloat,
  removeLastEdge,
  getNextStartPoint,
  canCloseLoop,
  getValidSegments,
  ZONES,
  GROUPS
} from './p2PathLogic.js';

describe('getZoneGroup', () => {
  it('should return correct groups for each zone', () => {
    expect(getZoneGroup('NNW')).toBe('NNW_NNE');
    expect(getZoneGroup('NNE')).toBe('NNW_NNE');
    expect(getZoneGroup('ENE')).toBe('ENE_ESE');
    expect(getZoneGroup('ESE')).toBe('ENE_ESE');
    expect(getZoneGroup('SSE')).toBe('SSE_SSW');
    expect(getZoneGroup('SSW')).toBe('SSE_SSW');
    expect(getZoneGroup('WSW')).toBe('WSW_WNW');
    expect(getZoneGroup('WNW')).toBe('WSW_WNW');
  });
});

describe('getIdentifiedZone', () => {
  it('should return identified partner for each zone', () => {
    expect(getIdentifiedZone('NNW')).toBe('NNE');
    expect(getIdentifiedZone('NNE')).toBe('NNW');
    expect(getIdentifiedZone('ENE')).toBe('ESE');
    expect(getIdentifiedZone('ESE')).toBe('ENE');
    expect(getIdentifiedZone('SSE')).toBe('SSW');
    expect(getIdentifiedZone('SSW')).toBe('SSE');
    expect(getIdentifiedZone('WSW')).toBe('WNW');
    expect(getIdentifiedZone('WNW')).toBe('WSW');
  });

  it('should be its own inverse', () => {
    for (const zone of ZONES) {
      expect(getIdentifiedZone(getIdentifiedZone(zone))).toBe(zone);
    }
  });
});

describe('zonesAreIdentified', () => {
  it('should return true for identified pairs', () => {
    expect(zonesAreIdentified('NNW', 'NNE')).toBe(true);
    expect(zonesAreIdentified('ENE', 'ESE')).toBe(true);
    expect(zonesAreIdentified('SSE', 'SSW')).toBe(true);
    expect(zonesAreIdentified('WSW', 'WNW')).toBe(true);
  });

  it('should return false for non-identified pairs', () => {
    expect(zonesAreIdentified('NNW', 'ENE')).toBe(false);
    expect(zonesAreIdentified('NNE', 'ESE')).toBe(false);
    expect(zonesAreIdentified('NNW', 'SSE')).toBe(false);
  });
});

describe('createInitialState', () => {
  it('should create empty state with 4 groups', () => {
    const state = createInitialState();
    expect(state.points.NNW_NNE).toEqual([]);
    expect(state.points.ENE_ESE).toEqual([]);
    expect(state.points.SSE_SSW).toEqual([]);
    expect(state.points.WSW_WNW).toEqual([]);
    expect(state.edges).toEqual([]);
  });
});

describe('insertPoint', () => {
  it('should insert first point', () => {
    const state = createInitialState();
    const newState = insertPoint(state, 'NNW_NNE', 0, 'NNW');
    expect(newState.points.NNW_NNE).toHaveLength(1);
    expect(newState.points.NNW_NNE[0].pos).toBe(0);
    expect(newState.points.NNW_NNE[0].originalZone).toBe('NNW');
  });

  it('should reindex on insert', () => {
    let state = createInitialState();
    state = insertPoint(state, 'NNW_NNE', 0, 'NNW');
    state = insertPoint(state, 'NNW_NNE', 0, 'NNE');
    expect(state.points.NNW_NNE).toHaveLength(2);
    expect(state.points.NNW_NNE[0].pos).toBe(0);
    expect(state.points.NNW_NNE[1].pos).toBe(1);
  });
});

describe('getSegmentsOnZone', () => {
  it('should return one segment for empty zone', () => {
    const state = createInitialState();
    const segs = getSegmentsOnZone(state, 'NNW');
    expect(segs).toHaveLength(1);
    expect(segs[0]).toEqual({ startPos: null, endPos: null, zone: 'NNW' });
  });

  it('should return correct segments for zone with one point', () => {
    let state = createInitialState();
    state = insertPoint(state, 'NNW_NNE', 0, 'NNW');
    const segs = getSegmentsOnZone(state, 'NNW');
    expect(segs).toHaveLength(2);
    expect(segs[0]).toEqual({ startPos: null, endPos: 0, zone: 'NNW' });
    expect(segs[1]).toEqual({ startPos: 0, endPos: null, zone: 'NNW' });
  });

  it('should show same segments on identified zone', () => {
    let state = createInitialState();
    state = insertPoint(state, 'NNW_NNE', 0, 'NNW');
    const segsNNW = getSegmentsOnZone(state, 'NNW');
    const segsNNE = getSegmentsOnZone(state, 'NNE');
    expect(segsNNW).toHaveLength(2);
    expect(segsNNE).toHaveLength(2);
    // Same structure but different zone label
    expect(segsNNE[0].zone).toBe('NNE');
    expect(segsNNE[1].zone).toBe('NNE');
  });
});

describe('getAllSegments', () => {
  it('should return 8 segments for empty state (one per zone)', () => {
    const state = createInitialState();
    const segs = getAllSegments(state);
    expect(segs).toHaveLength(8);
  });
});

describe('pointsEqual', () => {
  it('should be true for same zone same pos', () => {
    expect(pointsEqual({ zone: 'NNW', pos: 0 }, { zone: 'NNW', pos: 0 })).toBe(true);
  });

  it('should be true for identified zones same pos', () => {
    expect(pointsEqual({ zone: 'NNW', pos: 0 }, { zone: 'NNE', pos: 0 })).toBe(true);
    expect(pointsEqual({ zone: 'ENE', pos: 1 }, { zone: 'ESE', pos: 1 })).toBe(true);
  });

  it('should be false for different pos', () => {
    expect(pointsEqual({ zone: 'NNW', pos: 0 }, { zone: 'NNW', pos: 1 })).toBe(false);
  });

  it('should be false for different group', () => {
    expect(pointsEqual({ zone: 'NNW', pos: 0 }, { zone: 'ENE', pos: 0 })).toBe(false);
  });
});

describe('addFirstEdge', () => {
  it('should add first edge between different groups', () => {
    const state = createInitialState();
    const fromSeg = { startPos: null, endPos: null, zone: 'NNW' };
    const toSeg = { startPos: null, endPos: null, zone: 'ENE' };

    const result = addFirstEdge(state, fromSeg, toSeg);
    expect(result.newState).toBeTruthy();
    expect(result.newState.edges).toHaveLength(1);
    expect(result.newState.edges[0].from.zone).toBe('NNW');
    expect(result.newState.edges[0].to.zone).toBe('ENE');
    expect(result.newState.points.NNW_NNE).toHaveLength(1);
    expect(result.newState.points.ENE_ESE).toHaveLength(1);
  });

  it('should add first edge within same group (after start)', () => {
    const state = createInitialState();
    const fromSeg = { startPos: null, endPos: null, zone: 'NNW' };
    const toSeg = { startPos: 0, endPos: null, zone: 'NNE', firstEdgeLabel: 'after start' };

    const result = addFirstEdge(state, fromSeg, toSeg);
    expect(result.newState).toBeTruthy();
    expect(result.newState.edges).toHaveLength(1);
    expect(result.newState.points.NNW_NNE).toHaveLength(2);
  });
});

describe('addEdgeToSegment', () => {
  it('should chain edges correctly', () => {
    const state = createInitialState();
    const first = addFirstEdge(state,
      { startPos: null, endPos: null, zone: 'NNW' },
      { startPos: null, endPos: null, zone: 'ENE' }
    );

    const startPt = getNextStartPoint(first.newState);
    expect(startPt.zone).toBe('ESE'); // ENE identified with ESE

    // ESE→SSE does not cross NNW→ENE (adjacent chords on perimeter)
    const result = addEdgeToSegment(first.newState, startPt,
      { startPos: null, endPos: null, zone: 'SSE' }
    );
    expect(result.newState).toBeTruthy();
    expect(result.newState.edges).toHaveLength(2);
  });
});

describe('edgesCross', () => {
  it('should not cross for adjacent zones', () => {
    let state = createInitialState();
    state = insertPoint(state, 'NNW_NNE', 0, 'NNW');
    state = insertPoint(state, 'ENE_ESE', 0, 'ENE');
    state = insertPoint(state, 'SSE_SSW', 0, 'SSE');
    state = insertPoint(state, 'WSW_WNW', 0, 'WSW');

    const edge1 = { from: { zone: 'NNW', pos: 0 }, to: { zone: 'NNE', pos: 0 } };
    const edge2 = { from: { zone: 'ENE', pos: 0 }, to: { zone: 'ESE', pos: 0 } };

    expect(edgesCross(edge1, edge2, state)).toBe(false);
  });

  it('should detect crossing for interleaved chords', () => {
    let state = createInitialState();
    state = insertPoint(state, 'NNW_NNE', 0, 'NNW');
    state = insertPoint(state, 'ENE_ESE', 0, 'ENE');
    state = insertPoint(state, 'SSE_SSW', 0, 'SSE');
    state = insertPoint(state, 'WSW_WNW', 0, 'WSW');

    // NNW→SSE crosses ENE→WSW (diagonal chords)
    const edge1 = { from: { zone: 'NNW', pos: 0 }, to: { zone: 'SSE', pos: 0 } };
    const edge2 = { from: { zone: 'ENE', pos: 0 }, to: { zone: 'WSW', pos: 0 } };

    expect(edgesCross(edge1, edge2, state)).toBe(true);
  });

  it('should not detect crossing for nested (non-crossing) edges', () => {
    let state = createInitialState();
    state = insertPoint(state, 'NNW_NNE', 0, 'NNW');
    state = insertPoint(state, 'NNW_NNE', 1, 'NNW');
    state = insertPoint(state, 'SSE_SSW', 0, 'SSE');
    state = insertPoint(state, 'SSE_SSW', 1, 'SSE');

    const edge1 = { from: { zone: 'NNW', pos: 0 }, to: { zone: 'SSE', pos: 1 } };
    const edge2 = { from: { zone: 'NNW', pos: 1 }, to: { zone: 'SSE', pos: 0 } };

    expect(edgesCross(edge1, edge2, state)).toBe(false);
  });
});

describe('removeLastEdge', () => {
  it('should return to initial state when removing only edge', () => {
    const state = createInitialState();
    const first = addFirstEdge(state,
      { startPos: null, endPos: null, zone: 'NNW' },
      { startPos: null, endPos: null, zone: 'ENE' }
    );

    const result = removeLastEdge(first.newState);
    expect(result.edges).toHaveLength(0);
    expect(result.points.NNW_NNE).toHaveLength(0);
    expect(result.points.ENE_ESE).toHaveLength(0);
  });
});

describe('canCloseLoop', () => {
  it('should require at least 2 edges', () => {
    const state = createInitialState();
    const result = canCloseLoop(state);
    expect(result.canClose).toBe(false);
  });
});

describe('edgeToFloat', () => {
  it('should convert edge to float format with forward parameterization', () => {
    let state = createInitialState();
    state = insertPoint(state, 'NNW_NNE', 0, 'NNW');
    state = insertPoint(state, 'ENE_ESE', 0, 'ENE');

    const edge = { from: { zone: 'NNW', pos: 0 }, to: { zone: 'ENE', pos: 0 } };
    const floatEdge = edgeToFloat(edge, state);
    expect(floatEdge.from.zone).toBe('NNW');
    expect(floatEdge.from.t).toBe(0.5);
    expect(floatEdge.to.zone).toBe('ENE');
    expect(floatEdge.to.t).toBe(0.5);
  });

  it('should use reversed parameterization for second zone in pair', () => {
    let state = createInitialState();
    state = insertPoint(state, 'NNW_NNE', 0, 'NNW');
    state = insertPoint(state, 'NNW_NNE', 1, 'NNW');

    // NNW pos 0 should be at t=0.25 (forward), NNE pos 0 should be at t=0.75 (reversed)
    const floatNNW = edgeToFloat(
      { from: { zone: 'NNW', pos: 0 }, to: { zone: 'NNW', pos: 1 } }, state
    );
    expect(floatNNW.from.t).toBeCloseTo(0.25);
    expect(floatNNW.to.t).toBeCloseTo(0.75);

    const floatNNE = edgeToFloat(
      { from: { zone: 'NNE', pos: 0 }, to: { zone: 'NNE', pos: 1 } }, state
    );
    expect(floatNNE.from.t).toBeCloseTo(0.75); // reversed: pos 0 → far end
    expect(floatNNE.to.t).toBeCloseTo(0.25);   // reversed: pos 1 → near midpoint
  });
});
