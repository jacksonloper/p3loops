/**
 * Tests for hexGeometry3d.js
 */

import { describe, it, expect } from 'vitest';
import {
  hexSideToBary,
  hexBaryTo3D,
  interpolateHexEdge3D,
  getHexFlatTriangleVertices,
  getDirectionAtPoint
} from './hexGeometry3d.js';

// Helper to check approximate equality
function expectClose(actual, expected, epsilon = 1e-10) {
  expect(Math.abs(actual - expected)).toBeLessThan(epsilon);
}

describe('hexSideToBary', () => {
  it('should give (1,0,0) at cone point A (AX t=0)', () => {
    const b = hexSideToBary('AX', 0);
    expectClose(b.a, 1);
    expectClose(b.b, 0);
    expectClose(b.c, 0);
  });

  it('should give (1,0,0) at cone point A (AZ t=0)', () => {
    const b = hexSideToBary('AZ', 0);
    expectClose(b.a, 1);
    expectClose(b.b, 0);
    expectClose(b.c, 0);
  });

  it('should give (0,1,0) at cone point B (BX t=0)', () => {
    const b = hexSideToBary('BX', 0);
    expectClose(b.a, 0);
    expectClose(b.b, 1);
    expectClose(b.c, 0);
  });

  it('should give (0,0,1) at cone point C (CY t=0)', () => {
    const b = hexSideToBary('CY', 0);
    expectClose(b.a, 0);
    expectClose(b.b, 0);
    expectClose(b.c, 1);
  });

  it('should give X=(2/3,2/3,-1/3) at AX t=1 and BX t=1', () => {
    const bAX = hexSideToBary('AX', 1);
    const bBX = hexSideToBary('BX', 1);
    for (const b of [bAX, bBX]) {
      expectClose(b.a, 2 / 3);
      expectClose(b.b, 2 / 3);
      expectClose(b.c, -1 / 3);
    }
  });

  it('should give Y=(-1/3,2/3,2/3) at BY t=1 and CY t=1', () => {
    const bBY = hexSideToBary('BY', 1);
    const bCY = hexSideToBary('CY', 1);
    for (const b of [bBY, bCY]) {
      expectClose(b.a, -1 / 3);
      expectClose(b.b, 2 / 3);
      expectClose(b.c, 2 / 3);
    }
  });

  it('should give Z=(2/3,-1/3,2/3) at CZ t=1 and AZ t=1', () => {
    const bCZ = hexSideToBary('CZ', 1);
    const bAZ = hexSideToBary('AZ', 1);
    for (const b of [bCZ, bAZ]) {
      expectClose(b.a, 2 / 3);
      expectClose(b.b, -1 / 3);
      expectClose(b.c, 2 / 3);
    }
  });

  it('barycentric coords should always sum to 1', () => {
    const sides = ['AX', 'AZ', 'BX', 'BY', 'CY', 'CZ'];
    for (const side of sides) {
      for (const t of [0, 0.25, 0.5, 0.75, 1]) {
        const b = hexSideToBary(side, t);
        expectClose(b.a + b.b + b.c, 1);
      }
    }
  });
});

describe('hexBaryTo3D', () => {
  it('cone points should map to equilateral triangle vertices at z=0', () => {
    // A → top (0, 2/3)
    const pA = hexBaryTo3D(1, 0, 0);
    expectClose(pA.x, 0);
    expectClose(pA.y, 2 / 3);
    expectClose(pA.z, 0);

    // B → bottom-right (0.5, -1/3)
    const pB = hexBaryTo3D(0, 1, 0);
    expectClose(pB.x, 0.5);
    expectClose(pB.y, -1 / 3);
    expectClose(pB.z, 0);

    // C → bottom-left (-0.5, -1/3)
    const pC = hexBaryTo3D(0, 0, 1);
    expectClose(pC.x, -0.5);
    expectClose(pC.y, -1 / 3);
    expectClose(pC.z, 0);
  });

  it('centroid of ABC should have positive z', () => {
    const p = hexBaryTo3D(1 / 3, 1 / 3, 1 / 3);
    expectClose(p.x, 0);
    expectClose(p.y, 0);
    expect(p.z).toBeGreaterThan(0);
    expectClose(p.z, Math.cbrt(1 / 27));
  });

  it('identified vertex X ≡ Y ≡ Z should all map to the centroid at z=0', () => {
    // X = (2/3, 2/3, -1/3)
    const pX = hexBaryTo3D(2 / 3, 2 / 3, -1 / 3);
    // Y = (-1/3, 2/3, 2/3)
    const pY = hexBaryTo3D(-1 / 3, 2 / 3, 2 / 3);
    // Z = (2/3, -1/3, 2/3)
    const pZ = hexBaryTo3D(2 / 3, -1 / 3, 2 / 3);

    for (const p of [pX, pY, pZ]) {
      expectClose(p.x, 0);
      expectClose(p.y, 0);
      expectClose(p.z, 0);
    }
  });

  it('identified sides AX and AZ should map to the same 3D curve', () => {
    for (const t of [0, 0.25, 0.5, 0.75, 1]) {
      const bAX = hexSideToBary('AX', t);
      const bAZ = hexSideToBary('AZ', t);
      const pAX = hexBaryTo3D(bAX.a, bAX.b, bAX.c);
      const pAZ = hexBaryTo3D(bAZ.a, bAZ.b, bAZ.c);
      expectClose(pAX.x, pAZ.x, 1e-9);
      expectClose(pAX.y, pAZ.y, 1e-9);
      expectClose(pAX.z, pAZ.z, 1e-9);
    }
  });

  it('identified sides BX and BY should map to the same 3D curve', () => {
    for (const t of [0, 0.25, 0.5, 0.75, 1]) {
      const bBX = hexSideToBary('BX', t);
      const bBY = hexSideToBary('BY', t);
      const pBX = hexBaryTo3D(bBX.a, bBX.b, bBX.c);
      const pBY = hexBaryTo3D(bBY.a, bBY.b, bBY.c);
      expectClose(pBX.x, pBY.x, 1e-9);
      expectClose(pBX.y, pBY.y, 1e-9);
      expectClose(pBX.z, pBY.z, 1e-9);
    }
  });

  it('identified sides CY and CZ should map to the same 3D curve', () => {
    for (const t of [0, 0.25, 0.5, 0.75, 1]) {
      const bCY = hexSideToBary('CY', t);
      const bCZ = hexSideToBary('CZ', t);
      const pCY = hexBaryTo3D(bCY.a, bCY.b, bCY.c);
      const pCZ = hexBaryTo3D(bCZ.a, bCZ.b, bCZ.c);
      expectClose(pCY.x, pCZ.x, 1e-9);
      expectClose(pCY.y, pCZ.y, 1e-9);
      expectClose(pCY.z, pCZ.z, 1e-9);
    }
  });

  it('points on triangle edges (one bary = 0) should have z = 0', () => {
    // Edge AB: c = 0
    const pAB = hexBaryTo3D(0.6, 0.4, 0);
    expectClose(pAB.z, 0);

    // Edge BC: a = 0
    const pBC = hexBaryTo3D(0, 0.3, 0.7);
    expectClose(pBC.z, 0);

    // Edge CA: b = 0
    const pCA = hexBaryTo3D(0.5, 0, 0.5);
    expectClose(pCA.z, 0);
  });

  it('interior points should have positive z', () => {
    const p = hexBaryTo3D(0.4, 0.3, 0.3);
    expect(p.z).toBeGreaterThan(0);
  });

  it('ear points should have z ≤ 0', () => {
    // Ear AXB (c < 0)
    const bAX = hexSideToBary('AX', 0.5);
    const pAX = hexBaryTo3D(bAX.a, bAX.b, bAX.c);
    expect(pAX.z).toBeLessThanOrEqual(0);

    // Ear BYC (a < 0)
    const bBY = hexSideToBary('BY', 0.5);
    const pBY = hexBaryTo3D(bBY.a, bBY.b, bBY.c);
    expect(pBY.z).toBeLessThanOrEqual(0);

    // Ear CZA (b < 0)
    const bCZ = hexSideToBary('CZ', 0.5);
    const pCZ = hexBaryTo3D(bCZ.a, bCZ.b, bCZ.c);
    expect(pCZ.z).toBeLessThanOrEqual(0);
  });
});

describe('interpolateHexEdge3D', () => {
  it('should return correct number of samples', () => {
    const edge = { from: { side: 'AX', t: 0.3 }, to: { side: 'BY', t: 0.7 } };
    const points = interpolateHexEdge3D(edge, 10);
    expect(points.length).toBe(10);
  });

  it('should start and end at boundary points', () => {
    const edge = { from: { side: 'AX', t: 0.5 }, to: { side: 'CY', t: 0.5 } };
    const points = interpolateHexEdge3D(edge, 15);

    // First point should match AX t=0.5
    const bFrom = hexSideToBary('AX', 0.5);
    const pFrom = hexBaryTo3D(bFrom.a, bFrom.b, bFrom.c);
    expectClose(points[0].x, pFrom.x, 1e-9);
    expectClose(points[0].y, pFrom.y, 1e-9);
    expectClose(points[0].z, pFrom.z, 1e-9);

    // Last point should match CY t=0.5
    const bTo = hexSideToBary('CY', 0.5);
    const pTo = hexBaryTo3D(bTo.a, bTo.b, bTo.c);
    expectClose(points[14].x, pTo.x, 1e-5);
    expectClose(points[14].y, pTo.y, 1e-5);
    expectClose(points[14].z, pTo.z, 1e-5);
  });

  it('consecutive points should be close together', () => {
    const edge = { from: { side: 'BX', t: 0.3 }, to: { side: 'CZ', t: 0.8 } };
    const points = interpolateHexEdge3D(edge, 20);

    for (let i = 1; i < points.length; i++) {
      const dx = points[i].x - points[i - 1].x;
      const dy = points[i].y - points[i - 1].y;
      const dz = points[i].z - points[i - 1].z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      expect(dist).toBeLessThan(0.5); // reasonable max distance between samples
    }
  });
});

describe('getHexFlatTriangleVertices', () => {
  it('should return 3 vertices at z=0', () => {
    const verts = getHexFlatTriangleVertices();
    expect(verts.length).toBe(3);
    for (const v of verts) {
      expectClose(v.z, 0);
    }
  });
});

describe('getDirectionAtPoint', () => {
  it('should return normalized direction', () => {
    const points = [
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 0, z: 0 },
      { x: 1, y: 1, z: 0 }
    ];
    const dir = getDirectionAtPoint(points, 0);
    expectClose(dir.x, 1);
    expectClose(dir.y, 0);
    expectClose(dir.z, 0);
  });

  it('should use backward difference at last point', () => {
    const points = [
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 1, z: 0 }
    ];
    const dir = getDirectionAtPoint(points, 1);
    expectClose(dir.x, 0);
    expectClose(dir.y, 1);
    expectClose(dir.z, 0);
  });
});
