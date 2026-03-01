/**
 * Tests for p4WallpaperGeometry.js
 * 
 * The key sanity check is that when passing through a wall, the screen-space 
 * coordinate before the transformation should be the same as the screen-space 
 * coordinate after the transformation.
 * 
 * For p4, the same edge identifications apply (north↔east, south↔west),
 * but with 90° rotations instead of 120°.
 */

import { describe, it, expect } from 'vitest';
import {
  createIdentityFrame,
  applyReferenceFrame,
  updateReferenceFrameForSide,
  updateReferenceFrameForSideTriangle,
  pointToScreenSpace,
  getEntrySide,
  getEntryPoint,
  pathToWallpaperPath,
  getPointOnSideTrueSquare,
  paperToTrueSquare,
  paperToTriangle,
  pointToTriangleScreenSpace,
  createIdentityWallpaperIndex,
  updateWallpaperIndex,
  formatWallpaperIndex,
  indexToFrame,
  NE_CORNER,
  SW_CORNER,
  NW_CORNER,
  SE_CORNER,
  SIDE
} from './p4WallpaperGeometry.js';

// Tolerance for floating-point comparisons in geometry tests
const TOLERANCE = 0.01;

function expectPointsClose(p1, p2, tolerance = TOLERANCE) {
  expect(Math.abs(p1.x - p2.x)).toBeLessThan(tolerance);
  expect(Math.abs(p1.y - p2.y)).toBeLessThan(tolerance);
}

describe('P4 Square Geometry - createIdentityFrame', () => {
  it('should create an identity transformation', () => {
    const frame = createIdentityFrame();
    expect(frame).toEqual({ a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 });
  });
});

describe('P4 Square Geometry - applyReferenceFrame', () => {
  it('should not change coordinates with identity frame', () => {
    const frame = createIdentityFrame();
    const result = applyReferenceFrame(100, 200, frame);
    expectPointsClose(result, { x: 100, y: 200 });
  });

  it('should apply translation', () => {
    const frame = { a: 1, b: 0, c: 0, d: 1, tx: 50, ty: -30 };
    const result = applyReferenceFrame(100, 200, frame);
    expectPointsClose(result, { x: 150, y: 170 });
  });

  it('should apply 90 degree rotation', () => {
    // 90 degree counter-clockwise rotation around origin
    const frame = { a: 0, b: -1, c: 1, d: 0, tx: 0, ty: 0 };
    const result = applyReferenceFrame(100, 0, frame);
    expectPointsClose(result, { x: 0, y: 100 });
  });
});

describe('P4 Square Geometry - getEntrySide', () => {
  it('should return east for north', () => {
    expect(getEntrySide('north')).toBe('east');
  });

  it('should return north for east', () => {
    expect(getEntrySide('east')).toBe('north');
  });

  it('should return west for south', () => {
    expect(getEntrySide('south')).toBe('west');
  });

  it('should return south for west', () => {
    expect(getEntrySide('west')).toBe('south');
  });
});

describe('P4 Square Geometry - getEntryPoint', () => {
  it('should preserve t value with identified side', () => {
    const entry = getEntryPoint('north', 0.3);
    expect(entry).toEqual({ side: 'east', t: 0.3 });
  });
});

describe('P4 Square Geometry - Square corners', () => {
  it('should have NE corner at origin', () => {
    expect(NE_CORNER).toEqual({ x: 0, y: 0 });
  });

  it('should have correct square shape', () => {
    // All sides should have equal length
    const northLength = Math.sqrt(
      (NE_CORNER.x - NW_CORNER.x) ** 2 + (NE_CORNER.y - NW_CORNER.y) ** 2
    );
    const eastLength = Math.sqrt(
      (NE_CORNER.x - SE_CORNER.x) ** 2 + (NE_CORNER.y - SE_CORNER.y) ** 2
    );
    const southLength = Math.sqrt(
      (SE_CORNER.x - SW_CORNER.x) ** 2 + (SE_CORNER.y - SW_CORNER.y) ** 2
    );
    const westLength = Math.sqrt(
      (SW_CORNER.x - NW_CORNER.x) ** 2 + (SW_CORNER.y - NW_CORNER.y) ** 2
    );

    expect(northLength).toBeCloseTo(SIDE, 1);
    expect(eastLength).toBeCloseTo(SIDE, 1);
    expect(southLength).toBeCloseTo(SIDE, 1);
    expect(westLength).toBeCloseTo(SIDE, 1);
  });

  it('should have 90 degree angles at all corners', () => {
    // Check NE corner (angle between north edge and east edge)
    // North edge direction: NW - NE
    const northDir = { x: NW_CORNER.x - NE_CORNER.x, y: NW_CORNER.y - NE_CORNER.y };
    // East edge direction: SE - NE
    const eastDir = { x: SE_CORNER.x - NE_CORNER.x, y: SE_CORNER.y - NE_CORNER.y };
    
    // Dot product should be 0 for 90 degree angle
    const dotProduct = northDir.x * eastDir.x + northDir.y * eastDir.y;
    expect(dotProduct).toBeCloseTo(0, 5);
  });
});

describe('P4 Wall crossing continuity - North wall', () => {
  /**
   * When crossing north wall at t=0.2:
   * - Exit point: north wall at t=0.2 in original frame
   * - Entry point: east wall at t=0.2 in transformed frame
   * - Both should map to the same screen-space coordinates
   */
  it('should maintain position continuity when crossing north wall at t=0.2', () => {
    const t = 0.2;
    const originalFrame = createIdentityFrame();
    
    // Point on north wall before crossing
    const northPoint = getPointOnSideTrueSquare('north', t);
    const beforeCrossing = applyReferenceFrame(northPoint.x, northPoint.y, originalFrame);
    
    // After crossing, we're in a new frame and the entry point is on east wall
    const newFrame = updateReferenceFrameForSide('north', originalFrame);
    const entryPoint = getPointOnSideTrueSquare('east', t); // Entry is on east side with same t
    const afterCrossing = applyReferenceFrame(entryPoint.x, entryPoint.y, newFrame);
    
    expectPointsClose(beforeCrossing, afterCrossing);
  });

  it('should maintain position continuity when crossing north wall at t=0.5', () => {
    const t = 0.5;
    const originalFrame = createIdentityFrame();
    
    const northPoint = getPointOnSideTrueSquare('north', t);
    const beforeCrossing = applyReferenceFrame(northPoint.x, northPoint.y, originalFrame);
    
    const newFrame = updateReferenceFrameForSide('north', originalFrame);
    const entryPoint = getPointOnSideTrueSquare('east', t);
    const afterCrossing = applyReferenceFrame(entryPoint.x, entryPoint.y, newFrame);
    
    expectPointsClose(beforeCrossing, afterCrossing);
  });

  it('should maintain position continuity when crossing north wall at t=0.8', () => {
    const t = 0.8;
    const originalFrame = createIdentityFrame();
    
    const northPoint = getPointOnSideTrueSquare('north', t);
    const beforeCrossing = applyReferenceFrame(northPoint.x, northPoint.y, originalFrame);
    
    const newFrame = updateReferenceFrameForSide('north', originalFrame);
    const entryPoint = getPointOnSideTrueSquare('east', t);
    const afterCrossing = applyReferenceFrame(entryPoint.x, entryPoint.y, newFrame);
    
    expectPointsClose(beforeCrossing, afterCrossing);
  });
});

describe('P4 Wall crossing continuity - East wall', () => {
  it('should maintain position continuity when crossing east wall at t=0.2', () => {
    const t = 0.2;
    const originalFrame = createIdentityFrame();
    
    const eastPoint = getPointOnSideTrueSquare('east', t);
    const beforeCrossing = applyReferenceFrame(eastPoint.x, eastPoint.y, originalFrame);
    
    const newFrame = updateReferenceFrameForSide('east', originalFrame);
    const entryPoint = getPointOnSideTrueSquare('north', t); // Entry is on north side
    const afterCrossing = applyReferenceFrame(entryPoint.x, entryPoint.y, newFrame);
    
    expectPointsClose(beforeCrossing, afterCrossing);
  });

  it('should maintain position continuity when crossing east wall at t=0.5', () => {
    const t = 0.5;
    const originalFrame = createIdentityFrame();
    
    const eastPoint = getPointOnSideTrueSquare('east', t);
    const beforeCrossing = applyReferenceFrame(eastPoint.x, eastPoint.y, originalFrame);
    
    const newFrame = updateReferenceFrameForSide('east', originalFrame);
    const entryPoint = getPointOnSideTrueSquare('north', t);
    const afterCrossing = applyReferenceFrame(entryPoint.x, entryPoint.y, newFrame);
    
    expectPointsClose(beforeCrossing, afterCrossing);
  });
});

describe('P4 Wall crossing continuity - South wall', () => {
  it('should maintain position continuity when crossing south wall at t=0.2', () => {
    const t = 0.2;
    const originalFrame = createIdentityFrame();
    
    const southPoint = getPointOnSideTrueSquare('south', t);
    const beforeCrossing = applyReferenceFrame(southPoint.x, southPoint.y, originalFrame);
    
    const newFrame = updateReferenceFrameForSide('south', originalFrame);
    const entryPoint = getPointOnSideTrueSquare('west', t); // Entry is on west side
    const afterCrossing = applyReferenceFrame(entryPoint.x, entryPoint.y, newFrame);
    
    expectPointsClose(beforeCrossing, afterCrossing);
  });

  it('should maintain position continuity when crossing south wall at t=0.5', () => {
    const t = 0.5;
    const originalFrame = createIdentityFrame();
    
    const southPoint = getPointOnSideTrueSquare('south', t);
    const beforeCrossing = applyReferenceFrame(southPoint.x, southPoint.y, originalFrame);
    
    const newFrame = updateReferenceFrameForSide('south', originalFrame);
    const entryPoint = getPointOnSideTrueSquare('west', t);
    const afterCrossing = applyReferenceFrame(entryPoint.x, entryPoint.y, newFrame);
    
    expectPointsClose(beforeCrossing, afterCrossing);
  });
});

describe('P4 Wall crossing continuity - West wall', () => {
  it('should maintain position continuity when crossing west wall at t=0.2', () => {
    const t = 0.2;
    const originalFrame = createIdentityFrame();
    
    const westPoint = getPointOnSideTrueSquare('west', t);
    const beforeCrossing = applyReferenceFrame(westPoint.x, westPoint.y, originalFrame);
    
    const newFrame = updateReferenceFrameForSide('west', originalFrame);
    const entryPoint = getPointOnSideTrueSquare('south', t); // Entry is on south side
    const afterCrossing = applyReferenceFrame(entryPoint.x, entryPoint.y, newFrame);
    
    expectPointsClose(beforeCrossing, afterCrossing);
  });

  it('should maintain position continuity when crossing west wall at t=0.5', () => {
    const t = 0.5;
    const originalFrame = createIdentityFrame();
    
    const westPoint = getPointOnSideTrueSquare('west', t);
    const beforeCrossing = applyReferenceFrame(westPoint.x, westPoint.y, originalFrame);
    
    const newFrame = updateReferenceFrameForSide('west', originalFrame);
    const entryPoint = getPointOnSideTrueSquare('south', t);
    const afterCrossing = applyReferenceFrame(entryPoint.x, entryPoint.y, newFrame);
    
    expectPointsClose(beforeCrossing, afterCrossing);
  });
});

describe('P4 NE corner fixed point for north/east rotations', () => {
  it('should keep NE corner fixed when rotating around NE (north crossing)', () => {
    const frame = createIdentityFrame();
    const newFrame = updateReferenceFrameForSide('north', frame);
    
    const beforeNE = applyReferenceFrame(NE_CORNER.x, NE_CORNER.y, frame);
    const afterNE = applyReferenceFrame(NE_CORNER.x, NE_CORNER.y, newFrame);
    
    expectPointsClose(beforeNE, afterNE);
  });

  it('should keep NE corner fixed when rotating around NE (east crossing)', () => {
    const frame = createIdentityFrame();
    const newFrame = updateReferenceFrameForSide('east', frame);
    
    const beforeNE = applyReferenceFrame(NE_CORNER.x, NE_CORNER.y, frame);
    const afterNE = applyReferenceFrame(NE_CORNER.x, NE_CORNER.y, newFrame);
    
    expectPointsClose(beforeNE, afterNE);
  });
});

describe('P4 SW corner fixed point for south/west rotations', () => {
  it('should keep SW corner fixed when rotating around SW (south crossing)', () => {
    const frame = createIdentityFrame();
    const newFrame = updateReferenceFrameForSide('south', frame);
    
    const beforeSW = applyReferenceFrame(SW_CORNER.x, SW_CORNER.y, frame);
    const afterSW = applyReferenceFrame(SW_CORNER.x, SW_CORNER.y, newFrame);
    
    expectPointsClose(beforeSW, afterSW);
  });

  it('should keep SW corner fixed when rotating around SW (west crossing)', () => {
    const frame = createIdentityFrame();
    const newFrame = updateReferenceFrameForSide('west', frame);
    
    const beforeSW = applyReferenceFrame(SW_CORNER.x, SW_CORNER.y, frame);
    const afterSW = applyReferenceFrame(SW_CORNER.x, SW_CORNER.y, newFrame);
    
    expectPointsClose(beforeSW, afterSW);
  });
});

describe('P4 Multiple crossings - 4 rotations return to original', () => {
  it('should return to identity after 4 north crossings', () => {
    let frame = createIdentityFrame();
    
    // 4 x 90° CW rotations = 360° = identity
    frame = updateReferenceFrameForSide('north', frame);
    frame = updateReferenceFrameForSide('north', frame);
    frame = updateReferenceFrameForSide('north', frame);
    frame = updateReferenceFrameForSide('north', frame);
    
    // Check that the frame is essentially identity
    expect(frame.a).toBeCloseTo(1, 5);
    expect(frame.b).toBeCloseTo(0, 5);
    expect(frame.c).toBeCloseTo(0, 5);
    expect(frame.d).toBeCloseTo(1, 5);
  });

  it('should return to identity after 4 east crossings', () => {
    let frame = createIdentityFrame();
    
    // 4 x 90° CCW rotations = 360° = identity
    frame = updateReferenceFrameForSide('east', frame);
    frame = updateReferenceFrameForSide('east', frame);
    frame = updateReferenceFrameForSide('east', frame);
    frame = updateReferenceFrameForSide('east', frame);
    
    expect(frame.a).toBeCloseTo(1, 5);
    expect(frame.b).toBeCloseTo(0, 5);
    expect(frame.c).toBeCloseTo(0, 5);
    expect(frame.d).toBeCloseTo(1, 5);
  });
});

describe('P4 pathToWallpaperPath', () => {
  it('should return empty array for empty path', () => {
    const result = pathToWallpaperPath([]);
    expect(result).toEqual([]);
  });

  it('should return two points for single edge', () => {
    const edges = [
      { from: { side: 'north', t: 0.2 }, to: { side: 'south', t: 0.8 } }
    ];
    const result = pathToWallpaperPath(edges);
    expect(result.length).toBe(2);
  });

  it('should correctly compute path through single edge', () => {
    const edges = [
      { from: { side: 'north', t: 0.25 }, to: { side: 'south', t: 0.75 } }
    ];
    const result = pathToWallpaperPath(edges);
    
    // First point should be at north, t=0.25 in identity frame
    const expectedStart = getPointOnSideTrueSquare('north', 0.25);
    expectPointsClose(result[0], expectedStart);
    
    // Second point should be at south, t=0.75 in identity frame
    const expectedEnd = getPointOnSideTrueSquare('south', 0.75);
    expectPointsClose(result[1], expectedEnd);
  });

  it('should handle interior points', () => {
    const edges = [
      { 
        from: { side: 'north', t: 0.5 }, 
        to: { interior: true, southward: 0.5, eastward: 0.5 } 
      }
    ];
    const result = pathToWallpaperPath(edges);
    expect(result.length).toBe(2);
    
    // Interior point should map to center of square
    const expectedInterior = paperToTrueSquare(0.5, 0.5);
    expectPointsClose(result[1], expectedInterior);
  });
});

describe('P4 pointToScreenSpace', () => {
  it('should correctly convert boundary point with identity frame', () => {
    const frame = createIdentityFrame();
    const point = { side: 'north', t: 0.5 };
    const result = pointToScreenSpace(point, frame);
    const expected = getPointOnSideTrueSquare('north', 0.5);
    expectPointsClose(result, expected);
  });

  it('should correctly convert interior point with identity frame', () => {
    const frame = createIdentityFrame();
    const point = { interior: true, southward: 0.5, eastward: 0.5 };
    const result = pointToScreenSpace(point, frame);
    const expected = paperToTrueSquare(0.5, 0.5);
    expectPointsClose(result, expected);
  });
});

describe('P4 Wallpaper Index', () => {
  it('should create identity index at origin', () => {
    const index = createIdentityWallpaperIndex();
    expect(index).toEqual({ tx: 0, ty: 0, r: 0 });
  });

  it('should format index correctly', () => {
    expect(formatWallpaperIndex({ tx: 0, ty: 0, r: 0 })).toBe('(0, 0, 0°)');
    expect(formatWallpaperIndex({ tx: 1, ty: -1, r: 1 })).toBe('(1, -1, 90°)');
    expect(formatWallpaperIndex({ tx: 2, ty: 3, r: 2 })).toBe('(2, 3, 180°)');
    expect(formatWallpaperIndex({ tx: -1, ty: 0, r: 3 })).toBe('(-1, 0, 270°)');
  });

  it('should cycle rotation correctly for north crossings (CCW)', () => {
    let index = createIdentityWallpaperIndex();
    // CCW: 0→1→2→3→0
    index = updateWallpaperIndex('north', index);
    expect(index.r).toBe(1);
    index = updateWallpaperIndex('north', index);
    expect(index.r).toBe(2);
    index = updateWallpaperIndex('north', index);
    expect(index.r).toBe(3);
    index = updateWallpaperIndex('north', index);
    expect(index.r).toBe(0);
  });

  it('should cycle rotation correctly for east crossings (CW)', () => {
    let index = createIdentityWallpaperIndex();
    // CW: 0→3→2→1→0
    index = updateWallpaperIndex('east', index);
    expect(index.r).toBe(3);
    index = updateWallpaperIndex('east', index);
    expect(index.r).toBe(2);
    index = updateWallpaperIndex('east', index);
    expect(index.r).toBe(1);
    index = updateWallpaperIndex('east', index);
    expect(index.r).toBe(0);
  });

  it('should be consistent with indexToFrame after all crossings', () => {
    // Test that updateWallpaperIndex produces indices that, when converted to frames
    // via indexToFrame, match the frames produced by updateReferenceFrameForSide
    const TOLERANCE = 0.01;
    
    const sides = ['north', 'east', 'south', 'west'];
    
    for (let startK = 0; startK < 4; startK++) {
      const startIndex = { tx: 0, ty: 0, r: startK };
      const startFrame = indexToFrame(startIndex);
      
      for (const side of sides) {
        // Update using updateWallpaperIndex
        const newIndex = updateWallpaperIndex(side, startIndex);
        const frameFromIndex = indexToFrame(newIndex);
        
        // Update using updateReferenceFrameForSide
        const frameFromSide = updateReferenceFrameForSide(side, startFrame);
        
        // They should match
        expect(Math.abs(frameFromIndex.a - frameFromSide.a)).toBeLessThan(TOLERANCE);
        expect(Math.abs(frameFromIndex.b - frameFromSide.b)).toBeLessThan(TOLERANCE);
        expect(Math.abs(frameFromIndex.c - frameFromSide.c)).toBeLessThan(TOLERANCE);
        expect(Math.abs(frameFromIndex.d - frameFromSide.d)).toBeLessThan(TOLERANCE);
        expect(Math.abs(frameFromIndex.tx - frameFromSide.tx)).toBeLessThan(TOLERANCE);
        expect(Math.abs(frameFromIndex.ty - frameFromSide.ty)).toBeLessThan(TOLERANCE);
      }
    }
  });
});

describe('P4 edge length sanity check', () => {
  // The square has 90 degree angles
  // The diagonal (longest distance) is: SIDE * sqrt(2) ≈ 424.3 for SIDE=300
  const SQUARE_DIAGONAL = SIDE * Math.SQRT2;
  
  function distance(p1, p2) {
    return Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
  }
  
  it('should not produce edges longer than square diagonal with multi-crossing path', () => {
    // A path that crosses multiple boundaries
    const edges = [
      { from: { side: 'north', t: 0.3 }, to: { side: 'south', t: 0.7 } },
      { from: { side: 'west', t: 0.7 }, to: { side: 'north', t: 0.5 } },
      { from: { side: 'east', t: 0.5 }, to: { side: 'south', t: 0.4 } },
      { from: { side: 'west', t: 0.4 }, to: { side: 'east', t: 0.6 } }
    ];
    
    const points = pathToWallpaperPath(edges);
    
    for (let i = 0; i < points.length - 1; i++) {
      const edgeLength = distance(points[i], points[i + 1]);
      expect(edgeLength).toBeLessThanOrEqual(SQUARE_DIAGONAL + TOLERANCE);
    }
  });

  it('should draw same-side edge along boundary, not across square', () => {
    const sameSideEdges = [
      { from: { side: 'north', t: 0.375 }, to: { side: 'west', t: 0.75 } },
      { from: { side: 'south', t: 0.75 }, to: { side: 'north', t: 0.875 } },
      { from: { side: 'east', t: 0.875 }, to: { side: 'south', t: 0.25 } },
      { from: { side: 'west', t: 0.25 }, to: { side: 'north', t: 0.125 } },
      // Same-side edge: east(0.125) → east(0.625)
      { from: { side: 'east', t: 0.125 }, to: { side: 'east', t: 0.625 } }
    ];
    
    const points = pathToWallpaperPath(sameSideEdges);
    
    // The last edge should be short - just walking along the east boundary
    const lastEdgeLength = distance(points[points.length - 2], points[points.length - 1]);
    
    // The edge should be at most the side length (300 * 0.5 = 150 units)
    const expectedMaxLength = SIDE * 0.6; // 60% of side length with tolerance
    expect(lastEdgeLength).toBeLessThan(expectedMaxLength);
  });
});

describe('P4 indexToFrame', () => {
  it('should return identity frame for identity index', () => {
    const index = createIdentityWallpaperIndex();
    const frame = indexToFrame(index);
    
    expect(frame.a).toBeCloseTo(1, 5);
    expect(frame.b).toBeCloseTo(0, 5);
    expect(frame.c).toBeCloseTo(0, 5);
    expect(frame.d).toBeCloseTo(1, 5);
    expect(frame.tx).toBeCloseTo(0, 5);
    expect(frame.ty).toBeCloseTo(0, 5);
  });

  it('should apply translation for non-zero tx/ty', () => {
    const index = { tx: 1, ty: 1, r: 0 };
    const frame = indexToFrame(index);
    
    // Translation should be (2*SIDE, 2*SIDE) = (600, 600)
    expect(frame.tx).toBeCloseTo(2 * SIDE, 1);
    expect(frame.ty).toBeCloseTo(2 * SIDE, 1);
  });

  it('should apply 90 degree rotation for r=1', () => {
    const index = { tx: 0, ty: 0, r: 1 };
    const frame = indexToFrame(index);
    
    // 90° CCW rotation: cos(90°)=0, sin(90°)=1
    expect(frame.a).toBeCloseTo(0, 5);
    expect(frame.b).toBeCloseTo(-1, 5);
    expect(frame.c).toBeCloseTo(1, 5);
    expect(frame.d).toBeCloseTo(0, 5);
  });

  it('should apply 180 degree rotation for r=2', () => {
    const index = { tx: 0, ty: 0, r: 2 };
    const frame = indexToFrame(index);
    
    // 180° rotation: cos(180°)=-1, sin(180°)=0
    expect(frame.a).toBeCloseTo(-1, 5);
    expect(frame.b).toBeCloseTo(0, 5);
    expect(frame.c).toBeCloseTo(0, 5);
    expect(frame.d).toBeCloseTo(-1, 5);
  });

  it('should produce 180° rotation frame for inner triangle r=4', () => {
    // Inner triangle k=4 is the 180° rotation of outer k=0 around hypotenuse midpoint
    // 180° rotation swaps: NW↔SE, SW→NE (fills the other half of the square)
    const frame = indexToFrame({ tx: 0, ty: 0, r: 4 });
    
    // a=-cos(0)=-1, b=sin(0)=0, c=-sin(0)=0, d=-cos(0)=-1
    expect(frame.a).toBeCloseTo(-1, 5);
    expect(frame.b).toBeCloseTo(0, 5);
    expect(frame.c).toBeCloseTo(0, 5);
    expect(frame.d).toBeCloseTo(-1, 5);
    // tx = -SIDE*(1+0) = -SIDE, ty = SIDE*(1-0) = SIDE
    expect(frame.tx).toBeCloseTo(-SIDE, 1);
    expect(frame.ty).toBeCloseTo(SIDE, 1);
  });

  it('should swap NW and SE for inner triangle r=4', () => {
    const frame = indexToFrame({ tx: 0, ty: 0, r: 4 });
    
    // NW(-SIDE, 0) should map to SE(0, SIDE) — 180° rotation swaps them
    const nwResult = applyReferenceFrame(NW_CORNER.x, NW_CORNER.y, frame);
    expect(nwResult.x).toBeCloseTo(SE_CORNER.x, 1);
    expect(nwResult.y).toBeCloseTo(SE_CORNER.y, 1);
    
    // SE(0, SIDE) should map to NW(-SIDE, 0) — 180° rotation swaps them
    const seResult = applyReferenceFrame(SE_CORNER.x, SE_CORNER.y, frame);
    expect(seResult.x).toBeCloseTo(NW_CORNER.x, 1);
    expect(seResult.y).toBeCloseTo(NW_CORNER.y, 1);
    
    // SW(-SIDE, SIDE) should map to NE(0, 0)
    const swResult = applyReferenceFrame(SW_CORNER.x, SW_CORNER.y, frame);
    expect(swResult.x).toBeCloseTo(NE_CORNER.x, 1);
    expect(swResult.y).toBeCloseTo(NE_CORNER.y, 1);
  });

  it('should produce correct frames for all inner triangles r=4..7', () => {
    // Inner triangles should have determinant +1 (orientation-preserving, p4 rotations only)
    for (let k = 4; k < 8; k++) {
      const frame = indexToFrame({ tx: 0, ty: 0, r: k });
      const det = frame.a * frame.d - frame.b * frame.c;
      expect(det).toBeCloseTo(1, 5);
    }
  });
});

describe('P4 Triangle Diffeo - paperToTriangle', () => {
  it('should map NW corner (0,0) to NW screen position', () => {
    const result = paperToTriangle(0, 0);
    expectPointsClose(result, { x: NW_CORNER.x, y: NW_CORNER.y });
  });

  it('should map NE corner (0,1) to hypotenuse midpoint', () => {
    const result = paperToTriangle(0, 1);
    // paperToTriangle(southward=0, eastward=1) → G(u=1, v=0) = (0.5, 0.5) → midpoint of NW and SE
    const expected = {
      x: (NW_CORNER.x + SE_CORNER.x) / 2,
      y: (NW_CORNER.y + SE_CORNER.y) / 2
    };
    expectPointsClose(result, expected);
  });

  it('should map SW corner (1,0) to SW screen position', () => {
    const result = paperToTriangle(1, 0);
    expectPointsClose(result, { x: SW_CORNER.x, y: SW_CORNER.y });
  });

  it('should map SE corner (1,1) to SE screen position', () => {
    const result = paperToTriangle(1, 1);
    expectPointsClose(result, { x: SE_CORNER.x, y: SE_CORNER.y });
  });

  it('should map south edge (v=1) along bottom leg', () => {
    // South edge: southward=1, eastward=t → G(u=t, v=1) = (t, 1) → same as square south edge
    for (const t of [0.25, 0.5, 0.75]) {
      const triangle = paperToTriangle(1, t);
      const square = paperToTrueSquare(1, t);
      expectPointsClose(triangle, square);
    }
  });

  it('should map west edge (u=0) along left leg', () => {
    // West edge: eastward=0, southward varies
    // G(0, v) = (0, v) → same as square west edge
    for (const t of [0.25, 0.5, 0.75]) {
      const triangle = paperToTriangle(t, 0);
      const square = paperToTrueSquare(t, 0);
      expectPointsClose(triangle, square);
    }
  });

  it('should map north edge to hypotenuse (x=y line)', () => {
    // North edge: southward=0, eastward=t → G(u=t, v=0) = (t/2, t/2) → on the x=y line (hypotenuse)
    for (const t of [0.25, 0.5, 0.75]) {
      const result = paperToTriangle(0, t);
      // In normalized coords, x should equal y
      // screenX = NW.x + x*(NE.x-NW.x) + y*(SW.x-NW.x)
      // For x=y=t/2: screenX = NW.x + (t/2)*SIDE + (t/2)*0 = NW.x + t*SIDE/2
      //              screenY = NW.y + 0 + (t/2)*SIDE = t*SIDE/2
      const expectedX = NW_CORNER.x + (t / 2) * (NE_CORNER.x - NW_CORNER.x) + (t / 2) * (SW_CORNER.x - NW_CORNER.x);
      const expectedY = NW_CORNER.y + (t / 2) * (NE_CORNER.y - NW_CORNER.y) + (t / 2) * (SW_CORNER.y - NW_CORNER.y);
      expectPointsClose(result, { x: expectedX, y: expectedY });
    }
  });

  it('should map interior points inside the triangle', () => {
    const result = paperToTriangle(0.5, 0.5);
    // Should be different from square mapping
    const squareResult = paperToTrueSquare(0.5, 0.5);
    expect(result.x).not.toBeCloseTo(squareResult.x, 1);
  });
});

describe('P4 Triangle - pointToTriangleScreenSpace', () => {
  it('should correctly convert boundary point with identity frame', () => {
    const frame = createIdentityFrame();
    const point = { side: 'north', t: 0.5 };
    const result = pointToTriangleScreenSpace(point, frame);
    const expected = paperToTriangle(0, 0.5);
    expectPointsClose(result, expected);
  });

  it('should correctly convert interior point with identity frame', () => {
    const frame = createIdentityFrame();
    const point = { interior: true, southward: 0.5, eastward: 0.5 };
    const result = pointToTriangleScreenSpace(point, frame);
    const expected = paperToTriangle(0.5, 0.5);
    expectPointsClose(result, expected);
  });
});

describe('P4 Triangle Wall crossing continuity - updateReferenceFrameForSideTriangle', () => {
  const sides = ['north', 'east', 'south', 'west'];
  const tValues = [0.1, 0.25, 0.5, 0.75, 0.9];

  function getIdentifiedSide(side) {
    switch (side) {
      case 'north': return 'east';
      case 'east': return 'north';
      case 'south': return 'west';
      case 'west': return 'south';
      default: throw new Error(`Unknown side: ${side}`);
    }
  }

  for (const side of sides) {
    for (const t of tValues) {
      it(`should maintain triangle continuity when crossing ${side} wall at t=${t}`, () => {
        const frame = createIdentityFrame();

        // Exit point in triangle screen space
        const exitPt = pointToTriangleScreenSpace({ side, t }, frame);

        // New frame using triangle-specific update
        const newFrame = updateReferenceFrameForSideTriangle(side, frame);

        // Entry point on identified side in new frame
        const entrySide = getIdentifiedSide(side);
        const entryPt = pointToTriangleScreenSpace({ side: entrySide, t }, newFrame);

        expectPointsClose(exitPt, entryPt);
      });
    }
  }

  it('should maintain continuity across multiple crossings (north then south)', () => {
    let frame = createIdentityFrame();

    // Cross north at t=0.5
    const exitNorth = pointToTriangleScreenSpace({ side: 'north', t: 0.5 }, frame);
    frame = updateReferenceFrameForSideTriangle('north', frame);
    const entryEast = pointToTriangleScreenSpace({ side: 'east', t: 0.5 }, frame);
    expectPointsClose(exitNorth, entryEast);

    // Cross south at t=0.3
    const exitSouth = pointToTriangleScreenSpace({ side: 'south', t: 0.3 }, frame);
    frame = updateReferenceFrameForSideTriangle('south', frame);
    const entryWest = pointToTriangleScreenSpace({ side: 'west', t: 0.3 }, frame);
    expectPointsClose(exitSouth, entryWest);
  });
});

describe('P4 Triangle no-teleport test for reported bug example', () => {
  const SQUARE_DIAGONAL = SIDE * Math.SQRT2;

  function distance(p1, p2) {
    return Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
  }

  function getIdentifiedSide(side) {
    switch (side) {
      case 'north': return 'east';
      case 'east': return 'north';
      case 'south': return 'west';
      case 'west': return 'south';
      default: throw new Error(`Unknown side: ${side}`);
    }
  }

  it('should not teleport when lifting the reported example path to the triangle wallpaper', () => {
    // This is the exact path from the bug report
    const edges = [
      { from: { side: 'north', t: 0.5 }, to: { side: 'west', t: 0.5 } },
      { from: { side: 'south', t: 0.5 }, to: { side: 'north', t: 0.8333333333333334 } },
      { from: { side: 'east', t: 0.8333333333333334 }, to: { side: 'east', t: 0.16666666666666666 } },
      { from: { side: 'north', t: 0.16666666666666666 }, to: { side: 'north', t: 0.5 } },
    ];

    let frame = createIdentityFrame();

    for (let i = 0; i < edges.length; i++) {
      const edge = edges[i];
      const exitSide = edge.to.side;
      const exitT = edge.to.t;

      // Check that exit and entry points match across the boundary
      const exitPt = pointToTriangleScreenSpace(edge.to, frame);
      const newFrame = updateReferenceFrameForSideTriangle(exitSide, frame);
      const entrySide = getIdentifiedSide(exitSide);
      const entryPt = pointToTriangleScreenSpace({ side: entrySide, t: exitT }, newFrame);

      const gap = distance(exitPt, entryPt);
      expect(gap).toBeLessThan(TOLERANCE);

      frame = newFrame;
    }
  });
});
