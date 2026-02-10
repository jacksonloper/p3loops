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
  SE_CORNER,
  SIDE
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
  // The rhombus has 60/120 degree angles
  // The diameter (longest diagonal) is: 2 * SIDE * sin(60°) ≈ 519.6 for SIDE=300
  // No edge should ever exceed this length
  const RHOMBUS_DIAMETER = 2 * SIDE * Math.sin(60 * Math.PI / 180);
  
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

  it('should produce short closing edge for same-side closed loop', () => {
    // The "Simple Loop" example that gets closed with a same-side edge
    const simpleLoopEdges = [
      { from: { side: 'north', t: 0.456 }, to: { side: 'west', t: 0.611 } },
      { from: { side: 'south', t: 0.611 }, to: { side: 'north', t: 0.72 } },
      { from: { side: 'east', t: 0.72 }, to: { side: 'south', t: 0.375 } },
      { from: { side: 'west', t: 0.375 }, to: { side: 'north', t: 0.207 } },
      { from: { side: 'east', t: 0.207 }, to: { interior: true, southward: 0.744567501122939, eastward: 0.8517552568425605 } },
      { from: { interior: true, southward: 0.744567501122939, eastward: 0.8517552568425605 }, to: { side: 'east', t: 0.573 } },
      { from: { side: 'north', t: 0.573 }, to: { side: 'south', t: 0.8 } },
      { from: { side: 'west', t: 0.8 }, to: { side: 'north', t: 0.493 } },
      // Same-side closing edge: north(0.493) → north(0.456)
      { from: { side: 'north', t: 0.493 }, to: { side: 'north', t: 0.456 } }
    ];
    
    const points = pathToWallpaperPath(simpleLoopEdges);
    
    // The closing edge (last edge) should be short - just walking along the north boundary
    // from t=0.493 to t=0.456, which is about 3.7% of a side length
    const closingEdgeLength = distance(points[points.length - 2], points[points.length - 1]);
    
    // The closing edge should be much shorter than the rhombus diameter.
    // The actual distance is about (0.493 - 0.456) * SIDE = 0.037 * 300 ≈ 11 units.
    // We use 10% of SIDE (30 units) as an upper bound to allow for floating point
    // tolerance while still catching the bug where the edge crossed a whole rhombus (~273 units).
    const SAME_SIDE_EDGE_MAX_RATIO = 0.1; // 10% of side length
    const expectedMaxLength = SAME_SIDE_EDGE_MAX_RATIO * SIDE;
    expect(closingEdgeLength).toBeLessThan(expectedMaxLength);
  });

  it('should treat edges between identified sides with SAME t value as same-side edges', () => {
    // An edge from north(0.7) to east(0.7) is essentially a zero-length edge (same point)
    // This should stay in the same rhombus
    const identifiedSameTPosEdges = [
      { from: { side: 'north', t: 0.3 }, to: { side: 'south', t: 0.5 } },
      { from: { side: 'west', t: 0.5 }, to: { side: 'north', t: 0.7 } },
      // This edge goes from east(0.7) to north(0.7) - same t value, so same point
      { from: { side: 'east', t: 0.7 }, to: { side: 'north', t: 0.7 } }
    ];
    
    const points = pathToWallpaperPath(identifiedSameTPosEdges);
    
    // The last edge is essentially zero-length (same point via identification)
    const lastEdgeLength = distance(points[points.length - 2], points[points.length - 1]);
    
    // The edge should be nearly zero length since it connects the same point
    expect(lastEdgeLength).toBeLessThan(1); // Very small, accounting for floating point
  });

  it('should treat edges between identified sides with DIFFERENT t values as crossing edges', () => {
    // An edge from east(0.7) to north(0.4) goes between identified sides but at different
    // t values, so it actually crosses the rhombus and enters a new rhombus
    const identifiedDiffTPosEdges = [
      { from: { side: 'north', t: 0.3 }, to: { side: 'south', t: 0.5 } },
      { from: { side: 'west', t: 0.5 }, to: { side: 'north', t: 0.7 } },
      // This edge goes from east(0.7) to north(0.4) - different t values
      { from: { side: 'east', t: 0.7 }, to: { side: 'north', t: 0.4 } }
    ];
    
    const points = pathToWallpaperPath(identifiedDiffTPosEdges);
    
    // With 3 edges where the last one crosses the rhombus, we should have 4 points
    expect(points.length).toBe(4);
    
    // The last edge should cross the rhombus, so it will be longer than a same-side edge
    const lastEdgeLength = distance(points[points.length - 2], points[points.length - 1]);
    // It should be a significant length (not nearly zero like a same-point edge)
    expect(lastEdgeLength).toBeGreaterThan(10);
  });

  it('should not create extra rhombus frames for same-point identified-side edges', () => {
    // Path that ends with an identified-side edge at the SAME t value
    const identifiedSameTPosEdges = [
      { from: { side: 'north', t: 0.3 }, to: { side: 'south', t: 0.5 } },
      { from: { side: 'west', t: 0.5 }, to: { side: 'east', t: 0.7 } },
      // This edge goes from north(0.7) to east(0.7) - same point via identification
      { from: { side: 'north', t: 0.7 }, to: { side: 'east', t: 0.7 } }
    ];
    
    const points = pathToWallpaperPath(identifiedSameTPosEdges);
    
    // With correct handling, we should have 4 points (start + 3 edge endpoints)
    expect(points.length).toBe(4);
  });

  it('should draw same-side edge along boundary, not across rhombus', () => {
    // This is the example from the issue:
    // The last edge is east(0.125) → east(0.625) which should stay along the east boundary
    const sameSideEdges = [
      { from: { side: 'north', t: 0.375 }, to: { side: 'west', t: 0.75 } },
      { from: { side: 'south', t: 0.75 }, to: { side: 'north', t: 0.875 } },
      { from: { side: 'east', t: 0.875 }, to: { side: 'south', t: 0.25 } },
      { from: { side: 'west', t: 0.25 }, to: { side: 'north', t: 0.125 } },
      // Same-side edge: east(0.125) → east(0.625)
      // This should walk along the east boundary, not cross the rhombus
      { from: { side: 'east', t: 0.125 }, to: { side: 'east', t: 0.625 } }
    ];
    
    const points = pathToWallpaperPath(sameSideEdges);
    
    // The last edge should be short - just walking along the east boundary
    // from t=0.125 to t=0.625, which is about 50% of a side length
    const lastEdgeLength = distance(points[points.length - 2], points[points.length - 1]);
    
    // The edge should be at most the side length (300 * 0.5 = 150 units)
    // but NOT crossing the entire rhombus (~519 units diameter)
    const expectedMaxLength = SIDE * 0.6; // 60% of side length with tolerance
    expect(lastEdgeLength).toBeLessThan(expectedMaxLength);
  });
});

// Test consistency between wallpaperGeometry and moveTree rotation directions
import { updateWallpaperIndex, createIdentityWallpaperIndex } from './moveTree.js';

describe('Consistency between wallpaperGeometry and moveTree', () => {
  // The key test: both modules should agree on rotation direction for each side
  // - wallpaperGeometry: uses updateReferenceFrameForSide
  // - moveTree: uses updateWallpaperIndex
  // 
  // They should produce consistent results: 
  // - north: CW around NE → rotation decreases (mod 3) → r goes 0→2
  // - east: CCW around NE → rotation increases (mod 3) → r goes 0→1
  // - south: CW around SW → rotation decreases (mod 3) → r goes 0→2
  // - west: CCW around SW → rotation increases (mod 3) → r goes 0→1

  it('should agree on rotation direction for north crossing', () => {
    // wallpaperGeometry does CW rotation for north (angle120CW = -2π/3)
    // moveTree should have r go from 0 to 2 (CW = -1 mod 3 = +2 mod 3)
    const index = createIdentityWallpaperIndex();
    const newIndex = updateWallpaperIndex('north', index);
    expect(newIndex.r).toBe(2); // CW: 0 → 2
  });

  it('should agree on rotation direction for east crossing', () => {
    // wallpaperGeometry does CCW rotation for east (angle120CCW = +2π/3)
    // moveTree should have r go from 0 to 1 (CCW = +1 mod 3)
    const index = createIdentityWallpaperIndex();
    const newIndex = updateWallpaperIndex('east', index);
    expect(newIndex.r).toBe(1); // CCW: 0 → 1
  });

  it('should agree on rotation direction for south crossing', () => {
    // wallpaperGeometry does CW rotation for south (angle120CW = -2π/3)
    // moveTree should have r go from 0 to 2 (CW = -1 mod 3 = +2 mod 3)
    const index = createIdentityWallpaperIndex();
    const newIndex = updateWallpaperIndex('south', index);
    expect(newIndex.r).toBe(2); // CW: 0 → 2
  });

  it('should agree on rotation direction for west crossing', () => {
    // wallpaperGeometry does CCW rotation for west (angle120CCW = +2π/3)
    // moveTree should have r go from 0 to 1 (CCW = +1 mod 3)
    const index = createIdentityWallpaperIndex();
    const newIndex = updateWallpaperIndex('west', index);
    expect(newIndex.r).toBe(1); // CCW: 0 → 1
  });

  it('should have matching fixed-point corners for rotations', () => {
    // Verify that moveTree and wallpaperGeometry use the same corner convention:
    // - north/east rotations are around NE corner
    // - south/west rotations are around SW corner
    
    // We verify this by checking that after 3 rotations around the same corner,
    // we return to the original state
    
    // Three east crossings (all around NE) should cycle back to r=0
    let index = createIdentityWallpaperIndex();
    index = updateWallpaperIndex('east', index);
    expect(index.r).toBe(1);
    index = updateWallpaperIndex('east', index);
    expect(index.r).toBe(2);
    index = updateWallpaperIndex('east', index);
    expect(index.r).toBe(0);
    
    // Three west crossings (all around SW) should cycle back to r=0
    index = createIdentityWallpaperIndex();
    index = updateWallpaperIndex('west', index);
    expect(index.r).toBe(1);
    index = updateWallpaperIndex('west', index);
    expect(index.r).toBe(2);
    index = updateWallpaperIndex('west', index);
    expect(index.r).toBe(0);
  });
});
