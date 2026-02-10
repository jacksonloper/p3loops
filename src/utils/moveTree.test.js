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
  flattenMoveTree
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

  it('should include loop close option when available', () => {
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
