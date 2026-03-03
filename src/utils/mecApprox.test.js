import { describe, it, expect } from 'vitest';
import { mecApprox } from './mecApprox.js';

describe('mecApprox', () => {
  it('returns the single point as center with radius 0 for one point', () => {
    const { c, r } = mecApprox([{ x: 5, y: 3 }]);
    expect(c.x).toBeCloseTo(5);
    expect(c.y).toBeCloseTo(3);
    expect(r).toBeCloseTo(0);
  });

  it('returns the midpoint and half-distance for two points', () => {
    const { c, r } = mecApprox([{ x: 0, y: 0 }, { x: 10, y: 0 }]);
    expect(c.x).toBeCloseTo(5);
    expect(c.y).toBeCloseTo(0);
    expect(r).toBeCloseTo(5);
  });

  it('encloses all points of an equilateral triangle', () => {
    const pts = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 5, y: 5 * Math.sqrt(3) },
    ];
    const { c, r } = mecApprox(pts);
    for (const p of pts) {
      const d = Math.hypot(p.x - c.x, p.y - c.y);
      expect(d).toBeLessThanOrEqual(r + 1e-9);
    }
  });

  it('encloses all points of a square', () => {
    const pts = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ];
    const { c, r } = mecApprox(pts);
    for (const p of pts) {
      const d = Math.hypot(p.x - c.x, p.y - c.y);
      expect(d).toBeLessThanOrEqual(r + 1e-9);
    }
  });

  it('encloses scattered points', () => {
    const pts = [
      { x: 1, y: 2 },
      { x: -3, y: 4 },
      { x: 5, y: -1 },
      { x: 0, y: 7 },
      { x: -2, y: -3 },
    ];
    const { c, r } = mecApprox(pts);
    for (const p of pts) {
      const d = Math.hypot(p.x - c.x, p.y - c.y);
      expect(d).toBeLessThanOrEqual(r + 1e-9);
    }
  });
});
