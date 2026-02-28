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
    expect(getZoneGroup('NW')).toBe('NW_SE');
    expect(getZoneGroup('SE')).toBe('NW_SE');
    expect(getZoneGroup('NE')).toBe('NE_SW');
    expect(getZoneGroup('SW')).toBe('NE_SW');
    expect(getZoneGroup('EN')).toBe('EN_WS');
    expect(getZoneGroup('WS')).toBe('EN_WS');
    expect(getZoneGroup('ES')).toBe('ES_WN');
    expect(getZoneGroup('WN')).toBe('ES_WN');
  });
});

describe('getIdentifiedZone', () => {
  it('should return identified partner for each zone', () => {
    expect(getIdentifiedZone('NW')).toBe('SE');
    expect(getIdentifiedZone('SE')).toBe('NW');
    expect(getIdentifiedZone('NE')).toBe('SW');
    expect(getIdentifiedZone('SW')).toBe('NE');
    expect(getIdentifiedZone('EN')).toBe('WS');
    expect(getIdentifiedZone('WS')).toBe('EN');
    expect(getIdentifiedZone('ES')).toBe('WN');
    expect(getIdentifiedZone('WN')).toBe('ES');
  });

  it('should be its own inverse', () => {
    for (const zone of ZONES) {
      expect(getIdentifiedZone(getIdentifiedZone(zone))).toBe(zone);
    }
  });
});

describe('zonesAreIdentified', () => {
  it('should return true for identified pairs', () => {
    expect(zonesAreIdentified('NW', 'SE')).toBe(true);
    expect(zonesAreIdentified('NE', 'SW')).toBe(true);
    expect(zonesAreIdentified('EN', 'WS')).toBe(true);
    expect(zonesAreIdentified('ES', 'WN')).toBe(true);
  });

  it('should return false for non-identified pairs', () => {
    expect(zonesAreIdentified('NW', 'NE')).toBe(false);
    expect(zonesAreIdentified('EN', 'ES')).toBe(false);
    expect(zonesAreIdentified('NW', 'EN')).toBe(false);
  });
});

describe('createInitialState', () => {
  it('should create empty state with 4 groups', () => {
    const state = createInitialState();
    expect(state.points.NW_SE).toEqual([]);
    expect(state.points.NE_SW).toEqual([]);
    expect(state.points.EN_WS).toEqual([]);
    expect(state.points.ES_WN).toEqual([]);
    expect(state.edges).toEqual([]);
  });
});

describe('insertPoint', () => {
  it('should insert first point', () => {
    const state = createInitialState();
    const newState = insertPoint(state, 'NW_SE', 0, 'NW');
    expect(newState.points.NW_SE).toHaveLength(1);
    expect(newState.points.NW_SE[0].pos).toBe(0);
    expect(newState.points.NW_SE[0].originalZone).toBe('NW');
  });

  it('should reindex on insert', () => {
    let state = createInitialState();
    state = insertPoint(state, 'NW_SE', 0, 'NW');
    state = insertPoint(state, 'NW_SE', 0, 'SE');
    expect(state.points.NW_SE).toHaveLength(2);
    expect(state.points.NW_SE[0].pos).toBe(0);
    expect(state.points.NW_SE[1].pos).toBe(1);
  });
});

describe('getSegmentsOnZone', () => {
  it('should return one segment for empty zone', () => {
    const state = createInitialState();
    const segs = getSegmentsOnZone(state, 'NW');
    expect(segs).toHaveLength(1);
    expect(segs[0]).toEqual({ startPos: null, endPos: null, zone: 'NW' });
  });

  it('should return correct segments for zone with one point', () => {
    let state = createInitialState();
    state = insertPoint(state, 'NW_SE', 0, 'NW');
    const segs = getSegmentsOnZone(state, 'NW');
    expect(segs).toHaveLength(2);
    expect(segs[0]).toEqual({ startPos: null, endPos: 0, zone: 'NW' });
    expect(segs[1]).toEqual({ startPos: 0, endPos: null, zone: 'NW' });
  });

  it('should show same segments on identified zone', () => {
    let state = createInitialState();
    state = insertPoint(state, 'NW_SE', 0, 'NW');
    const segsNW = getSegmentsOnZone(state, 'NW');
    const segsSE = getSegmentsOnZone(state, 'SE');
    expect(segsNW).toHaveLength(2);
    expect(segsSE).toHaveLength(2);
    // Same structure but different zone label
    expect(segsSE[0].zone).toBe('SE');
    expect(segsSE[1].zone).toBe('SE');
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
    expect(pointsEqual({ zone: 'NW', pos: 0 }, { zone: 'NW', pos: 0 })).toBe(true);
  });

  it('should be true for identified zones same pos', () => {
    expect(pointsEqual({ zone: 'NW', pos: 0 }, { zone: 'SE', pos: 0 })).toBe(true);
    expect(pointsEqual({ zone: 'EN', pos: 1 }, { zone: 'WS', pos: 1 })).toBe(true);
  });

  it('should be false for different pos', () => {
    expect(pointsEqual({ zone: 'NW', pos: 0 }, { zone: 'NW', pos: 1 })).toBe(false);
  });

  it('should be false for different group', () => {
    expect(pointsEqual({ zone: 'NW', pos: 0 }, { zone: 'EN', pos: 0 })).toBe(false);
  });
});

describe('addFirstEdge', () => {
  it('should add first edge between different groups', () => {
    const state = createInitialState();
    const fromSeg = { startPos: null, endPos: null, zone: 'NW' };
    const toSeg = { startPos: null, endPos: null, zone: 'EN' };

    const result = addFirstEdge(state, fromSeg, toSeg);
    expect(result.newState).toBeTruthy();
    expect(result.newState.edges).toHaveLength(1);
    expect(result.newState.edges[0].from.zone).toBe('NW');
    expect(result.newState.edges[0].to.zone).toBe('EN');
    expect(result.newState.points.NW_SE).toHaveLength(1);
    expect(result.newState.points.EN_WS).toHaveLength(1);
  });

  it('should add first edge within same group (after start)', () => {
    const state = createInitialState();
    const fromSeg = { startPos: null, endPos: null, zone: 'NW' };
    const toSeg = { startPos: 0, endPos: null, zone: 'SE', firstEdgeLabel: 'after start' };

    const result = addFirstEdge(state, fromSeg, toSeg);
    expect(result.newState).toBeTruthy();
    expect(result.newState.edges).toHaveLength(1);
    expect(result.newState.points.NW_SE).toHaveLength(2);
  });
});

describe('addEdgeToSegment', () => {
  it('should chain edges correctly', () => {
    const state = createInitialState();
    const first = addFirstEdge(state,
      { startPos: null, endPos: null, zone: 'NW' },
      { startPos: null, endPos: null, zone: 'EN' }
    );

    const startPt = getNextStartPoint(first.newState);
    expect(startPt.zone).toBe('WS'); // EN identified with WS

    // WS→ES does not cross NW→EN (nested chords on perimeter)
    const result = addEdgeToSegment(first.newState, startPt,
      { startPos: null, endPos: null, zone: 'ES' }
    );
    expect(result.newState).toBeTruthy();
    expect(result.newState.edges).toHaveLength(2);
  });
});

describe('edgesCross', () => {
  it('should detect crossing edges', () => {
    // Set up state with 4 points in different groups
    let state = createInitialState();
    state = insertPoint(state, 'NW_SE', 0, 'NW');
    state = insertPoint(state, 'EN_WS', 0, 'EN');
    state = insertPoint(state, 'NE_SW', 0, 'NE');
    state = insertPoint(state, 'ES_WN', 0, 'ES');

    // Edge NW→NE and EN→ES should cross (X shape across the square)
    const edge1 = { from: { zone: 'NW', pos: 0 }, to: { zone: 'NE', pos: 0 } };
    const edge2 = { from: { zone: 'EN', pos: 0 }, to: { zone: 'ES', pos: 0 } };

    // These should not cross because NW, NE, EN, ES are consecutive on perimeter
    // Actually let's think: perimeter order is NW, NE, EN, ES, SE, SW, WS, WN
    // edge1 endpoints: NW(0) and NE(0) -> keys 0 and 1
    // edge2 endpoints: EN(0) and ES(0) -> keys 2 and 3
    // Neither 2 nor 3 is between 0 and 1 -> no cross
    expect(edgesCross(edge1, edge2, state)).toBe(false);
  });

  it('should detect non-adjacent crossing', () => {
    // NW→ES (crossing the square diagonally)
    // EN→SW (also crossing diagonally, the other way)
    let state = createInitialState();
    state = insertPoint(state, 'NW_SE', 0, 'NW');
    state = insertPoint(state, 'ES_WN', 0, 'ES');
    state = insertPoint(state, 'EN_WS', 0, 'EN');
    state = insertPoint(state, 'NE_SW', 0, 'SW');

    const edge1 = { from: { zone: 'NW', pos: 0 }, to: { zone: 'ES', pos: 0 } };
    const edge2 = { from: { zone: 'EN', pos: 0 }, to: { zone: 'SW', pos: 0 } };

    // perimeter keys: NW=0, NE(empty)=offset1, EN=offset2, ES=offset3
    // With 1 point per group:
    // NW: key=0, NE: empty (offset=1, nothing), EN: key=1+0=1(wait...)
    // Let me recalculate. With NW_SE=1, NE_SW=1, EN_WS=1, ES_WN=1:
    // offsets: o0=0, o1=1, o2=2, o3=3, o4=4, o5=5, o6=6, o7=7
    // NW(0) -> 0
    // ES(0) -> 3
    // EN(0) -> 2
    // SW(0) -> o5 + (1-1-0) = 5
    // edge1: 0 to 3
    // edge2: 2 to 5
    // Is 2 between 0 and 3? Yes (0 < 2 < 3)
    // Is 5 between 0 and 3? No (5 is not between 0 and 3 in CCW on circle of 8)
    // XOR: true -> crosses!
    expect(edgesCross(edge1, edge2, state)).toBe(true);
  });

  it('should not detect crossing for nested (non-crossing) edges', () => {
    // Use nested chords: NW(0)→ES(1) and NW(1)→ES(0) are nested, not crossing
    let state = createInitialState();
    state = insertPoint(state, 'NW_SE', 0, 'NW');
    state = insertPoint(state, 'NW_SE', 1, 'NW');
    state = insertPoint(state, 'ES_WN', 0, 'ES');
    state = insertPoint(state, 'ES_WN', 1, 'ES');

    const edge1 = { from: { zone: 'NW', pos: 0 }, to: { zone: 'ES', pos: 1 } };
    const edge2 = { from: { zone: 'NW', pos: 1 }, to: { zone: 'ES', pos: 0 } };

    expect(edgesCross(edge1, edge2, state)).toBe(false);
  });
});

describe('removeLastEdge', () => {
  it('should return to initial state when removing only edge', () => {
    const state = createInitialState();
    const first = addFirstEdge(state,
      { startPos: null, endPos: null, zone: 'NW' },
      { startPos: null, endPos: null, zone: 'EN' }
    );

    const result = removeLastEdge(first.newState);
    expect(result.edges).toHaveLength(0);
    expect(result.points.NW_SE).toHaveLength(0);
    expect(result.points.EN_WS).toHaveLength(0);
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
  it('should convert edge to float format', () => {
    let state = createInitialState();
    state = insertPoint(state, 'NW_SE', 0, 'NW');
    state = insertPoint(state, 'EN_WS', 0, 'EN');

    const edge = { from: { zone: 'NW', pos: 0 }, to: { zone: 'EN', pos: 0 } };
    const floatEdge = edgeToFloat(edge, state);
    expect(floatEdge.from.zone).toBe('NW');
    expect(floatEdge.from.t).toBe(0.5);
    expect(floatEdge.to.zone).toBe('EN');
    expect(floatEdge.to.t).toBe(0.5);
  });
});
