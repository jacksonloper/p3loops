/**
 * Tests for wallpaperGeometry.js
 * 
 * The key sanity check is that when passing through a wall, the screen-space 
 * coordinate before the transformation should be the same as the screen-space 
 * coordinate after the transformation.
 * 
 * For example:
 * - A point at 20% along north wall in the original frame
 * - Should equal a point at 20% along east wall in the transformed frame
 *   (since north→east when crossing through north)
 */

import { describe, it, expect } from 'vitest';
import {
  createIdentityFrame,
  applyReferenceFrame,
  updateReferenceFrameForSide,
  pointToScreenSpace,
  getEntrySide,
  getEntryPoint,
  pathToWallpaperPath,
  getPointOnSideTrueRhombus,
  paperToTrueRhombus,
  NE_CORNER,
  SW_CORNER,
  NW_CORNER,
  SE_CORNER
} from './wallpaperGeometry.js';

// Tolerance for floating-point comparisons in geometry tests
const TOLERANCE = 0.01;

function expectPointsClose(p1, p2, tolerance = TOLERANCE) {
  expect(Math.abs(p1.x - p2.x)).toBeLessThan(tolerance);
  expect(Math.abs(p1.y - p2.y)).toBeLessThan(tolerance);
}

describe('createIdentityFrame', () => {
  it('should create an identity transformation', () => {
    const frame = createIdentityFrame();
    expect(frame).toEqual({ a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 });
  });
});

describe('applyReferenceFrame', () => {
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

  it('should apply rotation', () => {
    // 90 degree counter-clockwise rotation around origin
    const frame = { a: 0, b: -1, c: 1, d: 0, tx: 0, ty: 0 };
    const result = applyReferenceFrame(100, 0, frame);
    expectPointsClose(result, { x: 0, y: 100 });
  });
});

describe('getEntrySide', () => {
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

describe('getEntryPoint', () => {
  it('should preserve t value with identified side', () => {
    const entry = getEntryPoint('north', 0.3);
    expect(entry).toEqual({ side: 'east', t: 0.3 });
  });
});

describe('Wall crossing continuity - North wall', () => {
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
    const northPoint = getPointOnSideTrueRhombus('north', t);
    const beforeCrossing = applyReferenceFrame(northPoint.x, northPoint.y, originalFrame);
    
    // After crossing, we're in a new frame and the entry point is on east wall
    const newFrame = updateReferenceFrameForSide('north', originalFrame);
    const entryPoint = getPointOnSideTrueRhombus('east', t); // Entry is on east side with same t
    const afterCrossing = applyReferenceFrame(entryPoint.x, entryPoint.y, newFrame);
    
    expectPointsClose(beforeCrossing, afterCrossing);
  });

  it('should maintain position continuity when crossing north wall at t=0.5', () => {
    const t = 0.5;
    const originalFrame = createIdentityFrame();
    
    const northPoint = getPointOnSideTrueRhombus('north', t);
    const beforeCrossing = applyReferenceFrame(northPoint.x, northPoint.y, originalFrame);
    
    const newFrame = updateReferenceFrameForSide('north', originalFrame);
    const entryPoint = getPointOnSideTrueRhombus('east', t);
    const afterCrossing = applyReferenceFrame(entryPoint.x, entryPoint.y, newFrame);
    
    expectPointsClose(beforeCrossing, afterCrossing);
  });

  it('should maintain position continuity when crossing north wall at t=0.8', () => {
    const t = 0.8;
    const originalFrame = createIdentityFrame();
    
    const northPoint = getPointOnSideTrueRhombus('north', t);
    const beforeCrossing = applyReferenceFrame(northPoint.x, northPoint.y, originalFrame);
    
    const newFrame = updateReferenceFrameForSide('north', originalFrame);
    const entryPoint = getPointOnSideTrueRhombus('east', t);
    const afterCrossing = applyReferenceFrame(entryPoint.x, entryPoint.y, newFrame);
    
    expectPointsClose(beforeCrossing, afterCrossing);
  });
});

describe('Wall crossing continuity - East wall', () => {
  it('should maintain position continuity when crossing east wall at t=0.2', () => {
    const t = 0.2;
    const originalFrame = createIdentityFrame();
    
    const eastPoint = getPointOnSideTrueRhombus('east', t);
    const beforeCrossing = applyReferenceFrame(eastPoint.x, eastPoint.y, originalFrame);
    
    const newFrame = updateReferenceFrameForSide('east', originalFrame);
    const entryPoint = getPointOnSideTrueRhombus('north', t); // Entry is on north side
    const afterCrossing = applyReferenceFrame(entryPoint.x, entryPoint.y, newFrame);
    
    expectPointsClose(beforeCrossing, afterCrossing);
  });

  it('should maintain position continuity when crossing east wall at t=0.5', () => {
    const t = 0.5;
    const originalFrame = createIdentityFrame();
    
    const eastPoint = getPointOnSideTrueRhombus('east', t);
    const beforeCrossing = applyReferenceFrame(eastPoint.x, eastPoint.y, originalFrame);
    
    const newFrame = updateReferenceFrameForSide('east', originalFrame);
    const entryPoint = getPointOnSideTrueRhombus('north', t);
    const afterCrossing = applyReferenceFrame(entryPoint.x, entryPoint.y, newFrame);
    
    expectPointsClose(beforeCrossing, afterCrossing);
  });
});

describe('Wall crossing continuity - South wall', () => {
  it('should maintain position continuity when crossing south wall at t=0.2', () => {
    const t = 0.2;
    const originalFrame = createIdentityFrame();
    
    const southPoint = getPointOnSideTrueRhombus('south', t);
    const beforeCrossing = applyReferenceFrame(southPoint.x, southPoint.y, originalFrame);
    
    const newFrame = updateReferenceFrameForSide('south', originalFrame);
    const entryPoint = getPointOnSideTrueRhombus('west', t); // Entry is on west side
    const afterCrossing = applyReferenceFrame(entryPoint.x, entryPoint.y, newFrame);
    
    expectPointsClose(beforeCrossing, afterCrossing);
  });

  it('should maintain position continuity when crossing south wall at t=0.5', () => {
    const t = 0.5;
    const originalFrame = createIdentityFrame();
    
    const southPoint = getPointOnSideTrueRhombus('south', t);
    const beforeCrossing = applyReferenceFrame(southPoint.x, southPoint.y, originalFrame);
    
    const newFrame = updateReferenceFrameForSide('south', originalFrame);
    const entryPoint = getPointOnSideTrueRhombus('west', t);
    const afterCrossing = applyReferenceFrame(entryPoint.x, entryPoint.y, newFrame);
    
    expectPointsClose(beforeCrossing, afterCrossing);
  });
});

describe('Wall crossing continuity - West wall', () => {
  it('should maintain position continuity when crossing west wall at t=0.2', () => {
    const t = 0.2;
    const originalFrame = createIdentityFrame();
    
    const westPoint = getPointOnSideTrueRhombus('west', t);
    const beforeCrossing = applyReferenceFrame(westPoint.x, westPoint.y, originalFrame);
    
    const newFrame = updateReferenceFrameForSide('west', originalFrame);
    const entryPoint = getPointOnSideTrueRhombus('south', t); // Entry is on south side
    const afterCrossing = applyReferenceFrame(entryPoint.x, entryPoint.y, newFrame);
    
    expectPointsClose(beforeCrossing, afterCrossing);
  });

  it('should maintain position continuity when crossing west wall at t=0.5', () => {
    const t = 0.5;
    const originalFrame = createIdentityFrame();
    
    const westPoint = getPointOnSideTrueRhombus('west', t);
    const beforeCrossing = applyReferenceFrame(westPoint.x, westPoint.y, originalFrame);
    
    const newFrame = updateReferenceFrameForSide('west', originalFrame);
    const entryPoint = getPointOnSideTrueRhombus('south', t);
    const afterCrossing = applyReferenceFrame(entryPoint.x, entryPoint.y, newFrame);
    
    expectPointsClose(beforeCrossing, afterCrossing);
  });
});

describe('Multiple crossings continuity', () => {
  it('should maintain continuity through multiple crossings', () => {
    // Cross north at t=0.3, then cross east at t=0.5
    const t1 = 0.3;
    const t2 = 0.5;
    
    let frame = createIdentityFrame();
    
    // First crossing: north wall at t=0.3
    const northPoint = getPointOnSideTrueRhombus('north', t1);
    const point1_before = applyReferenceFrame(northPoint.x, northPoint.y, frame);
    
    frame = updateReferenceFrameForSide('north', frame);
    const eastEntry = getPointOnSideTrueRhombus('east', t1);
    const point1_after = applyReferenceFrame(eastEntry.x, eastEntry.y, frame);
    
    expectPointsClose(point1_before, point1_after);
    
    // Second crossing: now in new frame, cross through north (entry side was east)
    // Let's say the path goes from east entry to north at t=0.5
    const northPoint2 = getPointOnSideTrueRhombus('north', t2);
    const point2_before = applyReferenceFrame(northPoint2.x, northPoint2.y, frame);
    
    frame = updateReferenceFrameForSide('north', frame);
    const eastEntry2 = getPointOnSideTrueRhombus('east', t2);
    const point2_after = applyReferenceFrame(eastEntry2.x, eastEntry2.y, frame);
    
    expectPointsClose(point2_before, point2_after);
  });
});

describe('NE corner fixed point for north/east rotations', () => {
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

describe('SW corner fixed point for south/west rotations', () => {
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

describe('pathToWallpaperPath', () => {
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
    const expectedStart = getPointOnSideTrueRhombus('north', 0.25);
    expectPointsClose(result[0], expectedStart);
    
    // Second point should be at south, t=0.75 in identity frame
    const expectedEnd = getPointOnSideTrueRhombus('south', 0.75);
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
    
    // Interior point should map to center of rhombus
    const expectedInterior = paperToTrueRhombus(0.5, 0.5);
    expectPointsClose(result[1], expectedInterior);
  });
});

describe('pointToScreenSpace', () => {
  it('should correctly convert boundary point with identity frame', () => {
    const frame = createIdentityFrame();
    const point = { side: 'north', t: 0.5 };
    const result = pointToScreenSpace(point, frame);
    const expected = getPointOnSideTrueRhombus('north', 0.5);
    expectPointsClose(result, expected);
  });

  it('should correctly convert interior point with identity frame', () => {
    const frame = createIdentityFrame();
    const point = { interior: true, southward: 0.5, eastward: 0.5 };
    const result = pointToScreenSpace(point, frame);
    const expected = paperToTrueRhombus(0.5, 0.5);
    expectPointsClose(result, expected);
  });
});

describe('edge length sanity check', () => {
  // The rhombus has side length 300 and 60/120 degree angles
  // The diameter (longest diagonal) is: 2 * 300 * sin(60°) ≈ 519.6
  // No edge should ever exceed this length
  const RHOMBUS_DIAMETER = 2 * 300 * Math.sin(60 * Math.PI / 180);
  
  function distance(p1, p2) {
    return Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
  }
  
  it('should not produce edges longer than rhombus diameter with multi-crossing path', () => {
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
      expect(edgeLength).toBeLessThanOrEqual(RHOMBUS_DIAMETER + TOLERANCE);
    }
  });
  
  it('should produce edges within rhombus bounds for example path', () => {
    // The example from public/exampleedge.json
    const exampleEdges = [
      { from: { side: 'north', t: 0.368 }, to: { side: 'west', t: 0.473 } },
      { from: { side: 'south', t: 0.473 }, to: { side: 'north', t: 0.67 } },
      { from: { side: 'east', t: 0.67 }, to: { side: 'south', t: 0.313 } },
      { from: { side: 'west', t: 0.313 }, to: { side: 'north', t: 0.185 } },
      { from: { side: 'east', t: 0.185 }, to: { side: 'east', t: 0.603 } },
      { from: { side: 'north', t: 0.603 }, to: { side: 'south', t: 0.861 } },
      { from: { side: 'west', t: 0.861 }, to: { side: 'north', t: 0.487 } },
      { from: { side: 'east', t: 0.487 }, to: { side: 'east', t: 0.273 } },
      { from: { side: 'north', t: 0.273 }, to: { side: 'west', t: 0.397 } },
      { from: { side: 'south', t: 0.397 }, to: { side: 'north', t: 0.804 } },
      { from: { side: 'east', t: 0.804 }, to: { side: 'south', t: 0.36 } },
      { from: { side: 'west', t: 0.36 }, to: { side: 'north', t: 0.216 } },
      { from: { side: 'east', t: 0.216 }, to: { side: 'east', t: 0.548 } }
    ];
    
    const points = pathToWallpaperPath(exampleEdges);
    
    for (let i = 0; i < points.length - 1; i++) {
      const edgeLength = distance(points[i], points[i + 1]);
      expect(edgeLength).toBeLessThanOrEqual(RHOMBUS_DIAMETER + TOLERANCE);
    }
  });
});
