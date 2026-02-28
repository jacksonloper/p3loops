/**
 * Tests for p2WallpaperGeometry.js
 * 
 * The key sanity check is that when crossing a zone boundary, the screen-space
 * coordinate before the transformation matches the screen-space coordinate 
 * after the transformation.
 * 
 * For p2, each side is split into two half-zones identified with reversed
 * parameterization. Crossing any zone rotates 180° around the side's midpoint.
 * Exit point at zone z, parameter t maps to identified zone z' at parameter (1-t)
 * in the new frame.
 */

import { describe, it, expect } from 'vitest';
import {
  createIdentityFrame,
  applyReferenceFrame,
  updateReferenceFrameForZone,
  getPointInZoneWallpaper,
  pointToScreenSpace,
  createIdentityWallpaperIndex,
  updateWallpaperIndex,
  formatWallpaperIndex,
  indexToFrame,
  getZoneSide,
  NE_CORNER,
  NW_CORNER,
  SE_CORNER,
  SW_CORNER,
  SIDE,
  HALF,
  N_MID,
  E_MID,
  S_MID,
  W_MID
} from './p2WallpaperGeometry.js';

const TOLERANCE = 0.01;

function expectPointsClose(p1, p2, tolerance = TOLERANCE) {
  expect(Math.abs(p1.x - p2.x)).toBeLessThan(tolerance);
  expect(Math.abs(p1.y - p2.y)).toBeLessThan(tolerance);
}

function expectFramesClose(f1, f2, tolerance = TOLERANCE) {
  expect(Math.abs(f1.a - f2.a)).toBeLessThan(tolerance);
  expect(Math.abs(f1.b - f2.b)).toBeLessThan(tolerance);
  expect(Math.abs(f1.c - f2.c)).toBeLessThan(tolerance);
  expect(Math.abs(f1.d - f2.d)).toBeLessThan(tolerance);
  expect(Math.abs(f1.tx - f2.tx)).toBeLessThan(tolerance);
  expect(Math.abs(f1.ty - f2.ty)).toBeLessThan(tolerance);
}

describe('P2 Wallpaper - createIdentityFrame', () => {
  it('should create an identity transformation', () => {
    const frame = createIdentityFrame();
    expect(frame).toEqual({ a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 });
  });
});

describe('P2 Wallpaper - Square corners', () => {
  it('should have NE corner at origin', () => {
    expect(NE_CORNER).toEqual({ x: 0, y: 0 });
  });

  it('should have correct square shape with equal side lengths', () => {
    const dist = (a, b) => Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
    expect(dist(NW_CORNER, NE_CORNER)).toBeCloseTo(SIDE, 1);
    expect(dist(NE_CORNER, SE_CORNER)).toBeCloseTo(SIDE, 1);
    expect(dist(SE_CORNER, SW_CORNER)).toBeCloseTo(SIDE, 1);
    expect(dist(SW_CORNER, NW_CORNER)).toBeCloseTo(SIDE, 1);
  });

  it('should have midpoints at correct positions', () => {
    expect(N_MID).toEqual({ x: -HALF, y: 0 });
    expect(E_MID).toEqual({ x: 0, y: HALF });
    expect(S_MID).toEqual({ x: -HALF, y: SIDE });
    expect(W_MID).toEqual({ x: -SIDE, y: HALF });
  });
});

describe('P2 Wallpaper - getZoneSide', () => {
  it('should return correct sides for all zones', () => {
    expect(getZoneSide('NNW')).toBe('north');
    expect(getZoneSide('NNE')).toBe('north');
    expect(getZoneSide('ENE')).toBe('east');
    expect(getZoneSide('ESE')).toBe('east');
    expect(getZoneSide('SSE')).toBe('south');
    expect(getZoneSide('SSW')).toBe('south');
    expect(getZoneSide('WSW')).toBe('west');
    expect(getZoneSide('WNW')).toBe('west');
  });
});

describe('P2 Wallpaper - getPointInZoneWallpaper', () => {
  it('should map zone endpoints to correct corners/midpoints', () => {
    // NNW: NW corner → N midpoint
    expectPointsClose(getPointInZoneWallpaper('NNW', 0), NW_CORNER);
    expectPointsClose(getPointInZoneWallpaper('NNW', 1), N_MID);
    // NNE: N midpoint → NE corner
    expectPointsClose(getPointInZoneWallpaper('NNE', 0), N_MID);
    expectPointsClose(getPointInZoneWallpaper('NNE', 1), NE_CORNER);
    // ENE: NE corner → E midpoint
    expectPointsClose(getPointInZoneWallpaper('ENE', 0), NE_CORNER);
    expectPointsClose(getPointInZoneWallpaper('ENE', 1), E_MID);
    // ESE: E midpoint → SE corner
    expectPointsClose(getPointInZoneWallpaper('ESE', 0), E_MID);
    expectPointsClose(getPointInZoneWallpaper('ESE', 1), SE_CORNER);
    // SSE: SE corner → S midpoint
    expectPointsClose(getPointInZoneWallpaper('SSE', 0), SE_CORNER);
    expectPointsClose(getPointInZoneWallpaper('SSE', 1), S_MID);
    // SSW: S midpoint → SW corner
    expectPointsClose(getPointInZoneWallpaper('SSW', 0), S_MID);
    expectPointsClose(getPointInZoneWallpaper('SSW', 1), SW_CORNER);
    // WSW: SW corner → W midpoint
    expectPointsClose(getPointInZoneWallpaper('WSW', 0), SW_CORNER);
    expectPointsClose(getPointInZoneWallpaper('WSW', 1), W_MID);
    // WNW: W midpoint → NW corner
    expectPointsClose(getPointInZoneWallpaper('WNW', 0), W_MID);
    expectPointsClose(getPointInZoneWallpaper('WNW', 1), NW_CORNER);
  });
});

describe('P2 Wallpaper - Zone crossing continuity', () => {
  /**
   * When crossing zone NNW at parameter t, the exit point on NNW at t
   * should equal the entry point on NNE at (1-t) in the new frame.
   */
  const identifiedPairs = [
    ['NNW', 'NNE'],
    ['ENE', 'ESE'],
    ['SSE', 'SSW'],
    ['WSW', 'WNW']
  ];

  for (const [zone1, zone2] of identifiedPairs) {
    for (const t of [0.2, 0.5, 0.8]) {
      it(`should maintain continuity crossing ${zone1} at t=${t}`, () => {
        const frame = createIdentityFrame();
        
        // Exit point in current frame
        const exitLocal = getPointInZoneWallpaper(zone1, t);
        const exitWorld = applyReferenceFrame(exitLocal.x, exitLocal.y, frame);
        
        // New frame after crossing
        const newFrame = updateReferenceFrameForZone(zone1, frame);
        
        // Entry point: identified zone at reversed parameter
        const entryLocal = getPointInZoneWallpaper(zone2, 1 - t);
        const entryWorld = applyReferenceFrame(entryLocal.x, entryLocal.y, newFrame);
        
        expectPointsClose(exitWorld, entryWorld);
      });

      it(`should maintain continuity crossing ${zone2} at t=${t}`, () => {
        const frame = createIdentityFrame();
        
        const exitLocal = getPointInZoneWallpaper(zone2, t);
        const exitWorld = applyReferenceFrame(exitLocal.x, exitLocal.y, frame);
        
        const newFrame = updateReferenceFrameForZone(zone2, frame);
        
        const entryLocal = getPointInZoneWallpaper(zone1, 1 - t);
        const entryWorld = applyReferenceFrame(entryLocal.x, entryLocal.y, newFrame);
        
        expectPointsClose(exitWorld, entryWorld);
      });
    }
  }
});

describe('P2 Wallpaper - 180° rotation is involution', () => {
  it('should return to identity after crossing same zone twice', () => {
    const zones = ['NNW', 'NNE', 'ENE', 'ESE', 'SSE', 'SSW', 'WSW', 'WNW'];
    
    for (const zone of zones) {
      let frame = createIdentityFrame();
      frame = updateReferenceFrameForZone(zone, frame);
      frame = updateReferenceFrameForZone(zone, frame);
      
      // 180° + 180° = 360° = identity (but at a different translation)
      // The rotation part should be identity
      expect(frame.a).toBeCloseTo(1, 5);
      expect(frame.b).toBeCloseTo(0, 5);
      expect(frame.c).toBeCloseTo(0, 5);
      expect(frame.d).toBeCloseTo(1, 5);
    }
  });
});

describe('P2 Wallpaper - Midpoint fixed under rotation', () => {
  it('should keep N midpoint fixed when crossing NNW', () => {
    const frame = createIdentityFrame();
    const newFrame = updateReferenceFrameForZone('NNW', frame);
    
    const before = applyReferenceFrame(N_MID.x, N_MID.y, frame);
    const after = applyReferenceFrame(N_MID.x, N_MID.y, newFrame);
    
    expectPointsClose(before, after);
  });

  it('should keep E midpoint fixed when crossing ENE', () => {
    const frame = createIdentityFrame();
    const newFrame = updateReferenceFrameForZone('ENE', frame);
    
    const before = applyReferenceFrame(E_MID.x, E_MID.y, frame);
    const after = applyReferenceFrame(E_MID.x, E_MID.y, newFrame);
    
    expectPointsClose(before, after);
  });

  it('should keep S midpoint fixed when crossing SSE', () => {
    const frame = createIdentityFrame();
    const newFrame = updateReferenceFrameForZone('SSE', frame);
    
    const before = applyReferenceFrame(S_MID.x, S_MID.y, frame);
    const after = applyReferenceFrame(S_MID.x, S_MID.y, newFrame);
    
    expectPointsClose(before, after);
  });

  it('should keep W midpoint fixed when crossing WSW', () => {
    const frame = createIdentityFrame();
    const newFrame = updateReferenceFrameForZone('WSW', frame);
    
    const before = applyReferenceFrame(W_MID.x, W_MID.y, frame);
    const after = applyReferenceFrame(W_MID.x, W_MID.y, newFrame);
    
    expectPointsClose(before, after);
  });
});

describe('P2 Wallpaper Index', () => {
  it('should create identity index at origin', () => {
    const index = createIdentityWallpaperIndex();
    expect(index).toEqual({ tx: 0, ty: 0, r: 0 });
  });

  it('should format index correctly', () => {
    expect(formatWallpaperIndex({ tx: 0, ty: 0, r: 0 })).toBe('(0, 0, 0°)');
    expect(formatWallpaperIndex({ tx: 1, ty: -1, r: 1 })).toBe('(1, -1, 180°)');
  });

  it('should flip r when crossing any zone', () => {
    const zones = ['NNW', 'NNE', 'ENE', 'ESE', 'SSE', 'SSW', 'WSW', 'WNW'];
    
    for (const zone of zones) {
      const index0 = { tx: 0, ty: 0, r: 0 };
      const result0 = updateWallpaperIndex(zone, index0);
      expect(result0.r).toBe(1);
      
      const index1 = { tx: 0, ty: 0, r: 1 };
      const result1 = updateWallpaperIndex(zone, index1);
      expect(result1.r).toBe(0);
    }
  });

  it('should be consistent with indexToFrame for all zones and r values', () => {
    const zones = ['NNW', 'NNE', 'ENE', 'ESE', 'SSE', 'SSW', 'WSW', 'WNW'];
    
    for (const r of [0, 1]) {
      const startIndex = { tx: 0, ty: 0, r };
      const startFrame = indexToFrame(startIndex);
      
      for (const zone of zones) {
        const newIndex = updateWallpaperIndex(zone, startIndex);
        const frameFromIndex = indexToFrame(newIndex);
        
        const frameFromZone = updateReferenceFrameForZone(zone, startFrame);
        
        expectFramesClose(frameFromIndex, frameFromZone);
      }
    }
  });

  it('should be consistent with indexToFrame at non-zero translations', () => {
    const zones = ['NNW', 'ENE', 'SSW', 'WNW'];
    const testIndices = [
      { tx: 1, ty: 0, r: 0 },
      { tx: 0, ty: 1, r: 0 },
      { tx: -1, ty: 1, r: 1 },
      { tx: 2, ty: -1, r: 1 }
    ];
    
    for (const startIndex of testIndices) {
      const startFrame = indexToFrame(startIndex);
      
      for (const zone of zones) {
        const newIndex = updateWallpaperIndex(zone, startIndex);
        const frameFromIndex = indexToFrame(newIndex);
        const frameFromZone = updateReferenceFrameForZone(zone, startFrame);
        
        expectFramesClose(frameFromIndex, frameFromZone);
      }
    }
  });
});

describe('P2 indexToFrame', () => {
  it('should return identity frame for identity index', () => {
    const frame = indexToFrame({ tx: 0, ty: 0, r: 0 });
    expectFramesClose(frame, { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 });
  });

  it('should return 180° rotation for r=1 at origin', () => {
    const frame = indexToFrame({ tx: 0, ty: 0, r: 1 });
    // r=1: {a:-1, b:0, c:0, d:-1, tx:0, ty:SIDE}
    expectFramesClose(frame, { a: -1, b: 0, c: 0, d: -1, tx: 0, ty: SIDE });
  });

  it('should apply correct translations', () => {
    // T1 = (SIDE, SIDE), T2 = (SIDE, -SIDE)
    const frame10 = indexToFrame({ tx: 1, ty: 0, r: 0 });
    expectFramesClose(frame10, { a: 1, b: 0, c: 0, d: 1, tx: SIDE, ty: SIDE });

    const frame01 = indexToFrame({ tx: 0, ty: 1, r: 0 });
    expectFramesClose(frame01, { a: 1, b: 0, c: 0, d: 1, tx: SIDE, ty: -SIDE });
  });
});

describe('P2 pointToScreenSpace', () => {
  it('should correctly convert zone/t point with identity frame', () => {
    const frame = createIdentityFrame();
    const point = { zone: 'NNW', t: 0.5 };
    const result = pointToScreenSpace(point, frame);
    const expected = getPointInZoneWallpaper('NNW', 0.5);
    expectPointsClose(result, expected);
  });

  it('should apply frame transformation', () => {
    const frame = { a: 1, b: 0, c: 0, d: 1, tx: 100, ty: 200 };
    const point = { zone: 'NNE', t: 0 };
    const result = pointToScreenSpace(point, frame);
    const local = getPointInZoneWallpaper('NNE', 0);
    expectPointsClose(result, { x: local.x + 100, y: local.y + 200 });
  });
});
