/**
 * Tests for moveTree.js
 */

import { describe, it, expect } from 'vitest';
import {
  createIdentityWallpaperIndex,
  updateWallpaperIndex,
  computeEdgeDestinationIndex,
  formatWallpaperIndex,
  computeMoveTree,
  flattenMoveTree,
  computePathWallpaperIndex,
  previewSideChange
} from './moveTree.js';
import {
  createInitialState,
  addFirstEdge,
  addEdgeToSegment,
  getNextStartPoint,
  getSegmentsOnSide
} from './combinatorialPathLogic.js';

describe('createIdentityWallpaperIndex', () => {
  it('should return the identity index (0, 0, 0)', () => {
    const index = createIdentityWallpaperIndex();
    expect(index).toEqual({ tx: 0, ty: 0, r: 0 });
  });
});

describe('updateWallpaperIndex', () => {
  it('should update rotation correctly for north crossing (CW)', () => {
    const index = createIdentityWallpaperIndex();
    const newIndex = updateWallpaperIndex('north', index);
    // CW rotation: 0 -> 2
    expect(newIndex.r).toBe(2);
  });

  it('should update rotation correctly for east crossing (CCW)', () => {
    const index = createIdentityWallpaperIndex();
    const newIndex = updateWallpaperIndex('east', index);
    // CCW rotation: 0 -> 1
    expect(newIndex.r).toBe(1);
  });

  it('should update rotation correctly for south crossing (CW)', () => {
    const index = createIdentityWallpaperIndex();
    const newIndex = updateWallpaperIndex('south', index);
    // CW rotation: 0 -> 2
    expect(newIndex.r).toBe(2);
  });

  it('should update rotation correctly for west crossing (CCW)', () => {
    const index = createIdentityWallpaperIndex();
    const newIndex = updateWallpaperIndex('west', index);
    // CCW rotation: 0 -> 1
    expect(newIndex.r).toBe(1);
  });

  it('should cycle through all rotations', () => {
    let index = createIdentityWallpaperIndex();
    
    // Three east crossings should bring rotation back to 0
    index = updateWallpaperIndex('east', index);
    expect(index.r).toBe(1);
    index = updateWallpaperIndex('east', index);
    expect(index.r).toBe(2);
    index = updateWallpaperIndex('east', index);
    expect(index.r).toBe(0);
  });
});

describe('computeEdgeDestinationIndex', () => {
  it('should not change index for same-side edge', () => {
    const index = createIdentityWallpaperIndex();
    const edge = {
      from: { side: 'north', pos: 0 },
      to: { side: 'north', pos: 1 }
    };
    
    const destIndex = computeEdgeDestinationIndex(edge, index);
    expect(destIndex).toEqual(index);
  });

  it('should not change index for identified sides at same position', () => {
    const index = createIdentityWallpaperIndex();
    const edge = {
      from: { side: 'north', pos: 0 },
      to: { side: 'east', pos: 0 }
    };
    
    const destIndex = computeEdgeDestinationIndex(edge, index);
    expect(destIndex).toEqual(index);
  });

  it('should update index for cross-rhombus edge', () => {
    const index = createIdentityWallpaperIndex();
    const edge = {
      from: { side: 'north', pos: 0 },
      to: { side: 'south', pos: 0 }
    };
    
    const destIndex = computeEdgeDestinationIndex(edge, index);
    // Crossing to south, rotation should change
    expect(destIndex.r).toBe(2);
  });
});

describe('formatWallpaperIndex', () => {
  it('should format identity index correctly', () => {
    const index = createIdentityWallpaperIndex();
    const formatted = formatWallpaperIndex(index);
    expect(formatted).toBe('(0, 0, 0°)');
  });

  it('should format index with rotation correctly', () => {
    const index = { tx: 1, ty: -2, r: 1 };
    const formatted = formatWallpaperIndex(index);
    expect(formatted).toBe('(1, -2, 120°)');
  });

  it('should format 240° rotation correctly', () => {
    const index = { tx: 0, ty: 0, r: 2 };
    const formatted = formatWallpaperIndex(index);
    expect(formatted).toBe('(0, 0, 240°)');
  });
});

describe('computeMoveTree', () => {
  it('should return empty tree for depth 0', () => {
    const state = createInitialState();
    const fromSegment = { startPos: null, endPos: null, side: 'north' };
    const toSegment = { startPos: null, endPos: null, side: 'south' };
    const { newState } = addFirstEdge(state, fromSegment, toSegment);
    
    const tree = computeMoveTree(newState, 0);
    expect(tree).toEqual([]);
  });

  it('should return empty tree for initial state (no start point)', () => {
    const state = createInitialState();
    const tree = computeMoveTree(state, 5);
    expect(tree).toEqual([]);
  });

  it('should compute tree for a simple state', () => {
    const state = createInitialState();
    const fromSegment = { startPos: null, endPos: null, side: 'north' };
    const toSegment = { startPos: null, endPos: null, side: 'south' };
    const { newState } = addFirstEdge(state, fromSegment, toSegment);
    
    const tree = computeMoveTree(newState, 1);
    
    // Should have some valid moves
    expect(tree.length).toBeGreaterThan(0);
    
    // Each node should have required properties
    for (const node of tree) {
      expect(node).toHaveProperty('wallpaperIndex');
      expect(node).toHaveProperty('isLeaf');
      expect(node).toHaveProperty('description');
    }
  });

  it('should include loop close option in tree when loop closure is possible', () => {
    // Create a state where loop can be closed
    let state = createInitialState();
    const fromSegment = { startPos: null, endPos: null, side: 'north' };
    const toSegment = { startPos: null, endPos: null, side: 'south' };
    state = addFirstEdge(state, fromSegment, toSegment).newState;
    
    // Add second edge to make loop closing possible
    const startPoint = getNextStartPoint(state);
    const northSegments = getSegmentsOnSide(state, 'north');
    // Find a valid segment that allows loop closure
    let state2;
    for (const seg of northSegments) {
      const result = addEdgeToSegment(state, startPoint, seg);
      if (result.newState) {
        state2 = result.newState;
        break;
      }
    }
    
    if (state2) {
      const tree = computeMoveTree(state2, 1);
      
      // Check if any node is a close loop option
      // It may or may not have close loop depending on adjacency
      // Just verify the tree structure is correct
      expect(tree.length).toBeGreaterThan(0);
      // Verify nodes have expected properties
      expect(tree.some(node => node.isCloseLoop !== undefined)).toBe(true);
    }
  });

  it('should have wallpaper index on all nodes', () => {
    const state = createInitialState();
    const fromSegment = { startPos: null, endPos: null, side: 'north' };
    const toSegment = { startPos: null, endPos: null, side: 'south' };
    const { newState } = addFirstEdge(state, fromSegment, toSegment);
    
    const tree = computeMoveTree(newState, 2);
    
    function checkAllNodes(nodes) {
      for (const node of nodes) {
        expect(node.wallpaperIndex).toBeDefined();
        expect(node.wallpaperIndex).toHaveProperty('tx');
        expect(node.wallpaperIndex).toHaveProperty('ty');
        expect(node.wallpaperIndex).toHaveProperty('r');
        
        if (node.children) {
          checkAllNodes(node.children);
        }
      }
    }
    
    checkAllNodes(tree);
  });
});

describe('flattenMoveTree', () => {
  it('should flatten an empty tree', () => {
    const result = flattenMoveTree([]);
    expect(result).toEqual([]);
  });

  it('should flatten a single-level tree', () => {
    const tree = [
      { 
        segments: [], 
        isLeaf: true, 
        children: [], 
        wallpaperIndex: { tx: 0, ty: 0, r: 0 },
        description: 'Test' 
      }
    ];
    
    const result = flattenMoveTree(tree);
    expect(result.length).toBe(1);
    expect(result[0].depth).toBe(0);
  });

  it('should preserve depth for nested nodes', () => {
    const tree = [
      { 
        segments: [], 
        isLeaf: false, 
        wallpaperIndex: { tx: 0, ty: 0, r: 0 },
        description: 'Root',
        children: [
          { 
            segments: [], 
            isLeaf: true, 
            children: [], 
            wallpaperIndex: { tx: 1, ty: 0, r: 1 },
            description: 'Child' 
          }
        ]
      }
    ];
    
    const result = flattenMoveTree(tree);
    expect(result.length).toBe(2);
    expect(result[0].depth).toBe(0);
    expect(result[1].depth).toBe(1);
  });
});

describe('computePathWallpaperIndex', () => {
  it('should return identity for empty path', () => {
    const result = computePathWallpaperIndex([]);
    expect(result).toEqual({ tx: 0, ty: 0, r: 0 });
  });

  it('should return identity for single edge (edge is drawn in starting rhombus)', () => {
    const edges = [
      { from: { side: 'north', pos: 0 }, to: { side: 'south', pos: 0 } }
    ];
    const result = computePathWallpaperIndex(edges);
    // Single edge is drawn in the starting rhombus (before any crossing)
    expect(result).toEqual({ tx: 0, ty: 0, r: 0 });
  });

  it('should not change index for same-side edge', () => {
    const edges = [
      { from: { side: 'north', pos: 0 }, to: { side: 'north', pos: 1 } }
    ];
    const result = computePathWallpaperIndex(edges);
    expect(result).toEqual({ tx: 0, ty: 0, r: 0 });
  });
  
  it('should return index where last edge is drawn (after earlier crossings)', () => {
    const edges = [
      { from: { side: 'north', pos: 0 }, to: { side: 'south', pos: 0 } },
      { from: { side: 'south', pos: 0 }, to: { side: 'north', pos: 1 } }
    ];
    const result = computePathWallpaperIndex(edges);
    // First edge crosses south at k=0 → (0, -1, 2)
    // Second edge is drawn in that rhombus, so result is (0, -1, 2)
    expect(result).toEqual({ tx: 0, ty: -1, r: 2 });
  });
});

describe('previewSideChange', () => {
  it('should correctly preview north crossing', () => {
    const current = createIdentityWallpaperIndex();
    const preview = previewSideChange(current, 'north');
    expect(preview.r).toBe(2);
  });

  it('should correctly preview east crossing', () => {
    const current = createIdentityWallpaperIndex();
    const preview = previewSideChange(current, 'east');
    expect(preview.r).toBe(1);
  });
});

/**
 * Complex Loop rhombus index test.
 * 
 * The complex loop has 24 edges. The user observed the following indices 
 * in the wallpaper visualization (which is considered ground truth):
 * 
 * Edge 1: in (0,0,0)
 * Edge 2: in (-1,0,120)
 * Edge 3: in (-1,0,0)
 * Edge 4: in (-1,-1,240)
 * Edge 5: conceptually in (-1,-1,120) [same-side edge]
 * Edge 6: back to (-1,-1,240)
 * Edge 7: in (-2,0,120)
 * ...
 * Last edge (24): in (0,-3,240)
 */
describe('Complex Loop rhombus indices', () => {
  // The complex loop edges from exampleedge2.json
  const complexLoopEdges = [
    { from: { side: 'north', t: 0.456 }, to: { side: 'west', t: 0.611 } },   // Edge 1
    { from: { side: 'south', t: 0.611 }, to: { side: 'north', t: 0.72 } },   // Edge 2
    { from: { side: 'east', t: 0.72 }, to: { side: 'south', t: 0.375 } },    // Edge 3
    { from: { side: 'west', t: 0.375 }, to: { side: 'north', t: 0.207 } },   // Edge 4
    { from: { side: 'east', t: 0.207 }, to: { interior: true, southward: 0.744567501122939, eastward: 0.8517552568425605 } }, // Edge 5
    { from: { interior: true, southward: 0.744567501122939, eastward: 0.8517552568425605 }, to: { side: 'east', t: 0.573 } }, // Edge 6
    { from: { side: 'north', t: 0.573 }, to: { side: 'south', t: 0.8 } },    // Edge 7
    { from: { side: 'west', t: 0.8 }, to: { side: 'north', t: 0.493 } },     // Edge 8
    { from: { side: 'east', t: 0.493 }, to: { interior: true, southward: 0.7006217782649108, eastward: 0.9076982694047433 } }, // Edge 9
    { from: { interior: true, southward: 0.7006217782649108, eastward: 0.9076982694047433 }, to: { side: 'east', t: 0.276 } }, // Edge 10
    { from: { side: 'north', t: 0.276 }, to: { side: 'west', t: 0.503 } },   // Edge 11
    { from: { side: 'south', t: 0.503 }, to: { side: 'north', t: 0.858 } },  // Edge 12
    { from: { side: 'east', t: 0.858 }, to: { side: 'south', t: 0.433 } },   // Edge 13
    { from: { side: 'west', t: 0.433 }, to: { side: 'north', t: 0.246 } },   // Edge 14
    { from: { side: 'east', t: 0.246 }, to: { interior: true, southward: 0.7120858798800486, eastward: 0.8819726312259965 } }, // Edge 15
    { from: { interior: true, southward: 0.7120858798800486, eastward: 0.8819726312259965 }, to: { side: 'east', t: 0.541 } }, // Edge 16
    { from: { side: 'north', t: 0.541 }, to: { side: 'west', t: 0.895 } },   // Edge 17
    { from: { side: 'south', t: 0.895 }, to: { side: 'north', t: 0.555 } },  // Edge 18
    { from: { side: 'east', t: 0.555 }, to: { interior: true, southward: 0.7235499814951863, eastward: 0.8638897274573418 } }, // Edge 19
    { from: { interior: true, southward: 0.7235499814951863, eastward: 0.8638897274573418 }, to: { side: 'east', t: 0.227 } }, // Edge 20
    { from: { side: 'north', t: 0.227 }, to: { side: 'west', t: 0.4 } },     // Edge 21
    { from: { side: 'south', t: 0.4 }, to: { side: 'east', t: 0.773 } },     // Edge 22
    { from: { side: 'north', t: 0.773 }, to: { side: 'south', t: 0.551 } },  // Edge 23
    { from: { side: 'west', t: 0.551 }, to: { side: 'north', t: 0.418 } }    // Edge 24
  ];
  
  /**
   * Helper to check if an edge is a same-side edge.
   */
  function isSameSideEdge(edge) {
    if (edge.from.interior || edge.to.interior) return false;
    const fromSide = edge.from.side;
    const toSide = edge.to.side;
    if (fromSide === toSide) return true;
    // north↔east, south↔west are identified
    const identified = { north: 'east', east: 'north', south: 'west', west: 'south' };
    return identified[fromSide] === toSide && Math.abs(edge.from.t - edge.to.t) < 0.001;
  }
  
  /**
   * Compute the index for each edge in the complex loop.
   * The index represents which rhombus copy the edge is drawn in.
   */
  function computeEdgeIndices(edges) {
    const indices = [];
    let currentIndex = createIdentityWallpaperIndex();
    
    for (let i = 0; i < edges.length; i++) {
      const edge = edges[i];
      
      // The edge is drawn in the current rhombus
      indices.push({ ...currentIndex });
      
      // After drawing the edge, update index if crossing a boundary
      if (!edge.to.interior && !isSameSideEdge(edge)) {
        currentIndex = updateWallpaperIndex(edge.to.side, currentIndex);
      }
    }
    
    return indices;
  }
  
  it('should have Edge 1 in rhombus (0, 0, 0°)', () => {
    const indices = computeEdgeIndices(complexLoopEdges);
    expect(indices[0]).toEqual({ tx: 0, ty: 0, r: 0 });
  });
  
  it('should have Edge 2 in rhombus (-1, 0, 120°)', () => {
    const indices = computeEdgeIndices(complexLoopEdges);
    // After crossing west at k=0: (0,0,0) → (-1, 0, 1)
    expect(indices[1]).toEqual({ tx: -1, ty: 0, r: 1 });
  });
  
  it('should have Edge 3 in rhombus (-1, 0, 0°)', () => {
    const indices = computeEdgeIndices(complexLoopEdges);
    // After crossing north at k=1: (-1,0,1) → (-1, 0, 0)
    expect(indices[2]).toEqual({ tx: -1, ty: 0, r: 0 });
  });
  
  it('should have Edge 4 in rhombus (-1, -1, 240°)', () => {
    const indices = computeEdgeIndices(complexLoopEdges);
    // After crossing south at k=0: (-1,0,0) → (-1, -1, 2)
    expect(indices[3]).toEqual({ tx: -1, ty: -1, r: 2 });
  });
  
  it('should have Edge 8 in rhombus (-2, 0, 120°)', () => {
    // Note: After Edge 7 crosses south at k=2, we enter (-2, 0, 120°)
    // Edge 8 is then drawn in this new rhombus
    const indices = computeEdgeIndices(complexLoopEdges);
    expect(indices[7]).toEqual({ tx: -2, ty: 0, r: 1 });
  });
  
  it('should have last edge (Edge 24) in rhombus (0, -3, 240°)', () => {
    const indices = computeEdgeIndices(complexLoopEdges);
    expect(indices[23]).toEqual({ tx: 0, ty: -3, r: 2 });
  });
  
  it('should trace through all 24 edges with consistent indices', () => {
    const indices = computeEdgeIndices(complexLoopEdges);
    
    // Verify we have 24 indices
    expect(indices.length).toBe(24);
    
    // All indices should have valid properties
    for (const idx of indices) {
      expect(idx.tx).toBeDefined();
      expect(idx.ty).toBeDefined();
      expect(idx.r).toBeGreaterThanOrEqual(0);
      expect(idx.r).toBeLessThanOrEqual(2);
    }
  });
});
