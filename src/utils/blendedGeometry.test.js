/**
 * Tests for blended shape mapping functions in geometry.js.
 * 
 * The blended functions interpolate between rhombus, square, and triangle
 * diffeomorphisms for animated shape morphing.
 */

import { describe, it, expect } from 'vitest';
import {
  paperToScreenBlended,
  getPointOnSideBlended,
  getOutlinePathBlended,
  getSideSegmentPathBlended,
  getCurvedEdgePathBlended,
  getPointOnSide,
  getSize
} from './geometry.js';

const SIZE = getSize();

// Helper to check two points are close
function expectPointsClose(actual, expected) {
  expect(actual.x).toBeCloseTo(expected.x, 0);
  expect(actual.y).toBeCloseTo(expected.y, 0);
}

describe('paperToScreenBlended', () => {
  it('should return rhombus coords when rhombus weight is 1', () => {
    const weights = { rhombus: 1, square: 0, triangle: 0 };
    // (0, 0) = NW corner of rhombus
    const nw = paperToScreenBlended(0, 0, weights);
    const nwRhombus = getPointOnSide('north', 0);
    expectPointsClose(nw, nwRhombus);
  });

  it('should return square coords when square weight is 1', () => {
    const weights = { rhombus: 0, square: 1, triangle: 0 };
    // (0, 0) = NW → (0, 0) in square mapping
    const nw = paperToScreenBlended(0, 0, weights);
    expect(nw.x).toBeCloseTo(0, 5);
    expect(nw.y).toBeCloseTo(0, 5);
    
    // (0, 1) = NE → (SIZE, 0) in square mapping
    const ne = paperToScreenBlended(0, 1, weights);
    expect(ne.x).toBeCloseTo(SIZE, 5);
    expect(ne.y).toBeCloseTo(0, 5);
    
    // (1, 1) = SE → (SIZE, SIZE) in square mapping
    const se = paperToScreenBlended(1, 1, weights);
    expect(se.x).toBeCloseTo(SIZE, 5);
    expect(se.y).toBeCloseTo(SIZE, 5);
  });

  it('should return triangle coords when triangle weight is 1', () => {
    const weights = { rhombus: 0, square: 0, triangle: 1 };
    // (0, 0) = NW → (0, 0) in triangle mapping
    const nw = paperToScreenBlended(0, 0, weights);
    expect(nw.x).toBeCloseTo(0, 5);
    expect(nw.y).toBeCloseTo(0, 5);
    
    // (0, 1) = NE → (SIZE, 0) (u=1, v=0 → (1, 0)*SIZE)
    const ne = paperToScreenBlended(0, 1, weights);
    expect(ne.x).toBeCloseTo(SIZE, 5);
    expect(ne.y).toBeCloseTo(0, 5);
    
    // (1, 1) = SE → (0.5*SIZE, 0.5*SIZE) (hypotenuse midpoint)
    const se = paperToScreenBlended(1, 1, weights);
    expect(se.x).toBeCloseTo(SIZE / 2, 5);
    expect(se.y).toBeCloseTo(SIZE / 2, 5);
  });

  it('should interpolate between shapes at weight 0.5', () => {
    const weights = { rhombus: 0.5, square: 0.5, triangle: 0 };
    const center = paperToScreenBlended(0.5, 0.5, weights);
    
    // Should be average of rhombus and square centers
    const rhombusWeights = { rhombus: 1, square: 0, triangle: 0 };
    const squareWeights = { rhombus: 0, square: 1, triangle: 0 };
    const rCenter = paperToScreenBlended(0.5, 0.5, rhombusWeights);
    const sCenter = paperToScreenBlended(0.5, 0.5, squareWeights);
    
    expect(center.x).toBeCloseTo((rCenter.x + sCenter.x) / 2, 5);
    expect(center.y).toBeCloseTo((rCenter.y + sCenter.y) / 2, 5);
  });

  it('should handle three-way blending', () => {
    const weights = { rhombus: 1/3, square: 1/3, triangle: 1/3 };
    const result = paperToScreenBlended(0.5, 0.5, weights);
    // Just verify it returns a valid point
    expect(typeof result.x).toBe('number');
    expect(typeof result.y).toBe('number');
    expect(isNaN(result.x)).toBe(false);
    expect(isNaN(result.y)).toBe(false);
  });
});

describe('getPointOnSideBlended', () => {
  it('should match getPointOnSide for rhombus weights', () => {
    const weights = { rhombus: 1, square: 0, triangle: 0 };
    for (const side of ['north', 'east', 'south', 'west']) {
      for (const t of [0, 0.25, 0.5, 0.75, 1]) {
        const blended = getPointOnSideBlended(side, t, weights);
        const original = getPointOnSide(side, t);
        expectPointsClose(blended, original);
      }
    }
  });

  it('should place north edge at y=0 for square weights', () => {
    const weights = { rhombus: 0, square: 1, triangle: 0 };
    for (const t of [0, 0.5, 1]) {
      const pt = getPointOnSideBlended('north', t, weights);
      expect(pt.y).toBeCloseTo(0, 5);
      expect(pt.x).toBeCloseTo(t * SIZE, 5);
    }
  });
});

describe('getOutlinePathBlended', () => {
  it('should return a valid SVG path string for all shapes', () => {
    for (const shape of ['rhombus', 'square', 'triangle']) {
      const weights = { rhombus: 0, square: 0, triangle: 0, [shape]: 1 };
      const path = getOutlinePathBlended(weights);
      expect(path).toMatch(/^M /);
      expect(path).toContain(' L ');
      expect(path).toContain(' Z');
    }
  });
});

describe('getSideSegmentPathBlended', () => {
  it('should return a valid SVG path for segment', () => {
    const weights = { rhombus: 1, square: 0, triangle: 0 };
    const path = getSideSegmentPathBlended('north', 0.25, 0.75, weights);
    expect(path).toMatch(/^M /);
    expect(path).toContain(' L ');
  });
});

describe('getCurvedEdgePathBlended', () => {
  it('should return pathD, midPoint, and angle for all shapes', () => {
    for (const shape of ['rhombus', 'square', 'triangle']) {
      const weights = { rhombus: 0, square: 0, triangle: 0, [shape]: 1 };
      const result = getCurvedEdgePathBlended('north', 0.5, 'south', 0.5, weights);
      
      expect(result).toHaveProperty('pathD');
      expect(result).toHaveProperty('midPoint');
      expect(result).toHaveProperty('angle');
      expect(result.pathD).toMatch(/^M /);
      expect(typeof result.midPoint.x).toBe('number');
      expect(typeof result.midPoint.y).toBe('number');
      expect(typeof result.angle).toBe('number');
    }
  });

  it('should produce different paths for different shapes', () => {
    const rhombusResult = getCurvedEdgePathBlended('north', 0.3, 'south', 0.7, 
      { rhombus: 1, square: 0, triangle: 0 });
    const squareResult = getCurvedEdgePathBlended('north', 0.3, 'south', 0.7,
      { rhombus: 0, square: 1, triangle: 0 });
    
    // The paths should be different (different shape)
    expect(rhombusResult.pathD).not.toBe(squareResult.pathD);
  });
});
