/**
 * Tests for hexLoopIterator.js
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  HexLoopIterator,
  hexLoopToFloatEdges,
  describeHexLoop
} from './hexLoopIterator.js';

describe('HexLoopIterator', () => {
  let iterator;

  beforeEach(() => {
    iterator = new HexLoopIterator();
  });

  it('should initialize with no loops found', () => {
    expect(iterator.getLoopCount()).toBe(0);
  });

  it('should have open paths after initialization', () => {
    expect(iterator.hasOpenPaths()).toBe(true);
  });

  it('should start with max explored length of 0', () => {
    const stats = iterator.getStats();
    expect(stats.maxExploredLength).toBe(0);
  });

  it('should have one open path at length 1 initially (AX to BY)', () => {
    const stats = iterator.getStats();
    expect(stats.openByLength[1]).toBe(1);
  });

  it('should find loops when exploring', () => {
    iterator.exploreToLength(10);
    expect(iterator.getLoopCount()).toBeGreaterThan(0);
  }, 30000);

  it('should return loops sorted by length', () => {
    iterator.exploreToLength(10);
    const loops = iterator.getCurrentLoops();
    
    if (loops.length > 1) {
      for (let i = 1; i < loops.length; i++) {
        expect(loops[i].length).toBeGreaterThanOrEqual(loops[i - 1].length);
      }
    }
  }, 30000);

  it('should mark all returned loops as isLoop: true', () => {
    iterator.exploreToLength(10);
    const loops = iterator.getCurrentLoops();
    
    for (const loop of loops) {
      expect(loop.isLoop).toBe(true);
    }
  }, 30000);

  it('should return loops with valid states', () => {
    iterator.exploreToLength(10);
    const loops = iterator.getCurrentLoops();
    
    for (const loop of loops) {
      expect(loop.state).toBeDefined();
      expect(loop.state.edges).toBeDefined();
      expect(Array.isArray(loop.state.edges)).toBe(true);
      expect(loop.state.edges.length).toBe(loop.length);
    }
  }, 30000);

  it('should be able to get a specific count of loops', () => {
    const loops = iterator.getLoops(3, 20);
    
    // Should have at most 3 loops (might have fewer if not enough exist)
    expect(loops.length).toBeLessThanOrEqual(3);
    
    // If we got loops, they should be valid
    for (const loop of loops) {
      expect(loop.isLoop).toBe(true);
    }
  }, 30000);

  it('should reset properly', () => {
    iterator.exploreToLength(10);
    const countBefore = iterator.getLoopCount();
    expect(countBefore).toBeGreaterThan(0);
    
    iterator.reset();
    
    expect(iterator.getLoopCount()).toBe(0);
    expect(iterator.hasOpenPaths()).toBe(true);
    expect(iterator.getStats().maxExploredLength).toBe(0);
  }, 30000);

  it('should increase max explored length as we explore', () => {
    expect(iterator.getStats().maxExploredLength).toBe(0);
    
    iterator.exploreToLength(5);
    expect(iterator.getStats().maxExploredLength).toBeGreaterThanOrEqual(1);
  }, 30000);
});

describe('hexLoopToFloatEdges', () => {
  it('should convert a loop to float edges', () => {
    const iterator = new HexLoopIterator();
    iterator.exploreToLength(10);
    const loops = iterator.getCurrentLoops();
    
    if (loops.length > 0) {
      const floatEdges = hexLoopToFloatEdges(loops[0]);
      
      expect(Array.isArray(floatEdges)).toBe(true);
      expect(floatEdges.length).toBe(loops[0].length);
      
      // Each edge should have from and to with side and t values
      for (const edge of floatEdges) {
        expect(edge.from).toBeDefined();
        expect(edge.to).toBeDefined();
        expect(edge.from.side).toBeDefined();
        expect(edge.to.side).toBeDefined();
      }
    }
  }, 30000);
});

describe('describeHexLoop', () => {
  it('should generate a description for a loop', () => {
    const iterator = new HexLoopIterator();
    iterator.exploreToLength(10);
    const loops = iterator.getCurrentLoops();
    
    if (loops.length > 0) {
      const description = describeHexLoop(loops[0], 0);
      expect(description).toContain('Loop #1');
      expect(description).toContain('edges');
    }
  }, 30000);
});

describe('Hex Loop validity', () => {
  it('all discovered loops should start with AX to BY', () => {
    const iterator = new HexLoopIterator();
    iterator.exploreToLength(10);
    const loops = iterator.getCurrentLoops();
    
    for (const loop of loops) {
      const firstEdge = loop.state.edges[0];
      expect(firstEdge.from.side).toBe('AX');
      expect(firstEdge.to.side).toBe('BY');
    }
  }, 30000);

  it('all discovered loops should have edges that connect properly', () => {
    const iterator = new HexLoopIterator();
    iterator.exploreToLength(10);
    const loops = iterator.getCurrentLoops();
    
    for (const loop of loops) {
      const edges = loop.state.edges;
      
      // Last edge should connect back to first
      const firstEdge = edges[0];
      const lastEdge = edges[edges.length - 1];
      
      // The last edge's "to" should match the first edge's "from"
      expect(lastEdge.to.pos).toBe(firstEdge.from.pos);
    }
  }, 30000);
});
