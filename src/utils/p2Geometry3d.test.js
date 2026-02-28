/**
 * Tests for p2Geometry3d.js
 */

import { describe, it, expect } from 'vitest';
import {
  zoneToUnitSquare,
  getRegion,
  reflectToDiamond,
  unitSquareTo3D,
  interpolateEdge3D,
  getFlatDiamondVertices,
  getDirectionAtPoint
} from './p2Geometry3d.js';

describe('zoneToUnitSquare', () => {
  it('should map zone corners correctly', () => {
    // NNW t=0 is NW corner (0, 0)
    const nw = zoneToUnitSquare('NNW', 0);
    expect(nw.x).toBeCloseTo(0);
    expect(nw.y).toBeCloseTo(0);

    // NNW t=1 is N midpoint (0.5, 0)
    const nmid = zoneToUnitSquare('NNW', 1);
    expect(nmid.x).toBeCloseTo(0.5);
    expect(nmid.y).toBeCloseTo(0);

    // NNE t=0 is N midpoint (0.5, 0)
    const nmid2 = zoneToUnitSquare('NNE', 0);
    expect(nmid2.x).toBeCloseTo(0.5);
    expect(nmid2.y).toBeCloseTo(0);

    // NNE t=1 is NE corner (1, 0)
    const ne = zoneToUnitSquare('NNE', 1);
    expect(ne.x).toBeCloseTo(1);
    expect(ne.y).toBeCloseTo(0);
  });

  it('should map east zones correctly', () => {
    const ne = zoneToUnitSquare('ENE', 0);
    expect(ne.x).toBeCloseTo(1);
    expect(ne.y).toBeCloseTo(0);

    const emid = zoneToUnitSquare('ENE', 1);
    expect(emid.x).toBeCloseTo(1);
    expect(emid.y).toBeCloseTo(0.5);

    const se = zoneToUnitSquare('ESE', 1);
    expect(se.x).toBeCloseTo(1);
    expect(se.y).toBeCloseTo(1);
  });

  it('should map south zones correctly', () => {
    const se = zoneToUnitSquare('SSE', 0);
    expect(se.x).toBeCloseTo(1);
    expect(se.y).toBeCloseTo(1);

    const smid = zoneToUnitSquare('SSE', 1);
    expect(smid.x).toBeCloseTo(0.5);
    expect(smid.y).toBeCloseTo(1);
  });

  it('should map west zones correctly', () => {
    const sw = zoneToUnitSquare('WSW', 0);
    expect(sw.x).toBeCloseTo(0);
    expect(sw.y).toBeCloseTo(1);

    const wmid = zoneToUnitSquare('WSW', 1);
    expect(wmid.x).toBeCloseTo(0);
    expect(wmid.y).toBeCloseTo(0.5);
  });
});

describe('getRegion', () => {
  it('should identify the diamond center', () => {
    expect(getRegion(0.5, 0.5)).toBe('diamond');
  });

  it('should identify diamond boundary points', () => {
    // Midpoints of the unit square sides are diamond vertices
    expect(getRegion(0.5, 0)).toBe('diamond');
    expect(getRegion(1, 0.5)).toBe('diamond');
    expect(getRegion(0.5, 1)).toBe('diamond');
    expect(getRegion(0, 0.5)).toBe('diamond');
  });

  it('should identify corner triangles', () => {
    expect(getRegion(0.1, 0.1)).toBe('nw');
    expect(getRegion(0.9, 0.1)).toBe('ne');
    expect(getRegion(0.9, 0.9)).toBe('se');
    expect(getRegion(0.1, 0.9)).toBe('sw');
  });
});

describe('reflectToDiamond', () => {
  it('should reflect corners to center', () => {
    // NW corner (0, 0) → center (0.5, 0.5)
    const nw = reflectToDiamond(0, 0, 'nw');
    expect(nw.x).toBeCloseTo(0.5);
    expect(nw.y).toBeCloseTo(0.5);

    // NE corner (1, 0) → center (0.5, 0.5)
    const ne = reflectToDiamond(1, 0, 'ne');
    expect(ne.x).toBeCloseTo(0.5);
    expect(ne.y).toBeCloseTo(0.5);

    // SE corner (1, 1) → center (0.5, 0.5)
    const se = reflectToDiamond(1, 1, 'se');
    expect(se.x).toBeCloseTo(0.5);
    expect(se.y).toBeCloseTo(0.5);

    // SW corner (0, 1) → center (0.5, 0.5)
    const sw = reflectToDiamond(0, 1, 'sw');
    expect(sw.x).toBeCloseTo(0.5);
    expect(sw.y).toBeCloseTo(0.5);
  });

  it('should reflect points on the hypotenuse to themselves', () => {
    // Point on NW hypotenuse: x + y = 0.5, e.g. (0.25, 0.25)
    const p = reflectToDiamond(0.25, 0.25, 'nw');
    expect(p.x).toBeCloseTo(0.25);
    expect(p.y).toBeCloseTo(0.25);
  });
});

describe('unitSquareTo3D', () => {
  it('should give positive z for diamond center', () => {
    const p = unitSquareTo3D(0.5, 0.5);
    expect(p.z).toBeGreaterThan(0);
  });

  it('should give negative z for corner points', () => {
    const p = unitSquareTo3D(0.1, 0.1);
    expect(p.z).toBeLessThan(0);
  });

  it('should give z ≈ 0 at diamond boundary', () => {
    // Midpoints are on the diamond boundary
    const n = unitSquareTo3D(0.5, 0);
    expect(Math.abs(n.z)).toBeLessThan(0.01);
  });

  it('should map diamond center to (0, 0) in XY', () => {
    const p = unitSquareTo3D(0.5, 0.5);
    expect(p.x).toBeCloseTo(0);
    expect(p.y).toBeCloseTo(0);
  });

  it('should be continuous across the diamond boundary', () => {
    // Two points very close on opposite sides of NW hypotenuse
    const inside = unitSquareTo3D(0.3, 0.25);  // just inside diamond
    const outside = unitSquareTo3D(0.2, 0.25); // just inside NW triangle
    // XY coordinates should be close
    const dist = Math.sqrt(
      (inside.x - outside.x) ** 2 +
      (inside.y - outside.y) ** 2
    );
    expect(dist).toBeLessThan(0.3);
  });
});

describe('interpolateEdge3D', () => {
  it('should return the requested number of samples', () => {
    const edge = {
      from: { zone: 'NNW', t: 0.5 },
      to: { zone: 'SSE', t: 0.5 }
    };
    const points = interpolateEdge3D(edge, 10);
    expect(points).toHaveLength(10);
  });

  it('should return points with x, y, z properties', () => {
    const edge = {
      from: { zone: 'NNW', t: 0.5 },
      to: { zone: 'ESE', t: 0.5 }
    };
    const points = interpolateEdge3D(edge, 5);
    for (const p of points) {
      expect(typeof p.x).toBe('number');
      expect(typeof p.y).toBe('number');
      expect(typeof p.z).toBe('number');
      expect(Number.isFinite(p.x)).toBe(true);
      expect(Number.isFinite(p.y)).toBe(true);
      expect(Number.isFinite(p.z)).toBe(true);
    }
  });
});

describe('getFlatDiamondVertices', () => {
  it('should return 4 vertices at z=0', () => {
    const verts = getFlatDiamondVertices();
    expect(verts).toHaveLength(4);
    for (const v of verts) {
      expect(v.z).toBe(0);
    }
  });
});

describe('getDirectionAtPoint', () => {
  it('should return a normalized direction vector', () => {
    const points = [
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 0, z: 0 },
      { x: 2, y: 0, z: 0 }
    ];
    const dir = getDirectionAtPoint(points, 1);
    const len = Math.sqrt(dir.x ** 2 + dir.y ** 2 + dir.z ** 2);
    expect(len).toBeCloseTo(1);
    expect(dir.x).toBeCloseTo(1);
    expect(dir.y).toBeCloseTo(0);
    expect(dir.z).toBeCloseTo(0);
  });
});
