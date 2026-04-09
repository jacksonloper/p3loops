/**
 * Geometry utilities for the hexagonal fundamental domain.
 *
 * The hexagon has vertices A, X, B, Y, C, Z (clockwise).
 * It is a regular hexagon centered at the origin.
 *
 * Vertex positions (regular hexagon with "flat top"):
 *   A at top-left, X at top-right, B at right,
 *   Y at bottom-right, C at bottom-left, Z at left
 *
 * Sides in clockwise perimeter order: AX, BX, BY, CY, CZ, AZ
 *
 * Each side is parameterized from the cone point (t=0) to the
 * identified vertex (t=1):
 *   AX: A→X,  AZ: A→Z
 *   BX: B→X,  BY: B→Y
 *   CY: C→Y,  CZ: C→Z
 */

const SIZE = 300;
const CENTER_X = SIZE / 2;
const CENTER_Y = SIZE / 2;
const RADIUS = SIZE / 2 - 10; // slight inset for padding

/**
 * Get the size of the hexagon bounding box.
 */
export function getSize() {
  return SIZE;
}

/**
 * Compute vertex positions for a regular hexagon.
 * Flat-top orientation: first vertex at top-left.
 *
 * For a regular hexagon with flat top, vertices at angles:
 *   150°, 90°, 30°, -30°(=330°), -90°(=270°), -150°(=210°)
 * This gives: A(top-left), X(top-right), B(right), Y(bottom-right), C(bottom-left), Z(left)
 *
 * Actually let's use pointy-top to get a nicer layout:
 * Vertices at angles 90°, 30°, -30°, -90°, -150°, 150° (= 210°)
 * A at top, going clockwise: X(top-right), B(bottom-right), Y(bottom),
 * C(bottom-left), Z(top-left)
 *
 * Let's use flat-top: vertices at 0°, 60°, 120°, 180°, 240°, 300°
 * Clockwise from top: We want A at top.
 *
 * Let's place vertices explicitly to match AXBYCZ clockwise:
 *   A = 90° (top)
 *   X = 30° (upper-right)
 *   B = -30° = 330° (lower-right)
 *   Y = -90° = 270° (bottom)
 *   C = -150° = 210° (lower-left)
 *   Z = 150° (upper-left)
 */
function vertexAngle(index) {
  // 6 vertices, starting at 90° (top), going clockwise (decreasing angle)
  return (90 - index * 60) * Math.PI / 180;
}

function vertexPosition(index) {
  const angle = vertexAngle(index);
  return {
    x: CENTER_X + RADIUS * Math.cos(angle),
    y: CENTER_Y - RADIUS * Math.sin(angle) // SVG y is flipped
  };
}

/**
 * Get all vertex positions.
 * Returns { A, X, B, Y, C, Z }
 */
export function getVertices() {
  return {
    A: vertexPosition(0), // top
    X: vertexPosition(1), // upper-right
    B: vertexPosition(2), // lower-right
    Y: vertexPosition(3), // bottom
    C: vertexPosition(4), // lower-left
    Z: vertexPosition(5)  // upper-left
  };
}

/**
 * Get the outline SVG path for the hexagon.
 */
export function getOutlinePath() {
  const v = getVertices();
  return `M ${v.A.x} ${v.A.y} L ${v.X.x} ${v.X.y} L ${v.B.x} ${v.B.y} L ${v.Y.x} ${v.Y.y} L ${v.C.x} ${v.C.y} L ${v.Z.x} ${v.Z.y} Z`;
}

/**
 * Get screen coordinates for a point on a side at parameter t ∈ [0, 1].
 * Each side goes from cone point (t=0) to identified vertex (t=1).
 */
export function getPointOnSide(side, t) {
  const v = getVertices();
  let from, to;

  switch (side) {
    case 'AX': from = v.A; to = v.X; break;
    case 'BX': from = v.B; to = v.X; break;
    case 'BY': from = v.B; to = v.Y; break;
    case 'CY': from = v.C; to = v.Y; break;
    case 'CZ': from = v.C; to = v.Z; break;
    case 'AZ': from = v.A; to = v.Z; break;
    default: throw new Error(`Unknown side: ${side}`);
  }

  return {
    x: from.x + t * (to.x - from.x),
    y: from.y + t * (to.y - from.y)
  };
}

/**
 * Get an SVG path along a side from parameter t0 to t1.
 */
export function getSideSegmentPath(side, t0, t1) {
  const p0 = getPointOnSide(side, t0);
  const p1 = getPointOnSide(side, t1);
  return `M ${p0.x} ${p0.y} L ${p1.x} ${p1.y}`;
}

// ============================================================================
// DIFFEOMORPHISM-BASED EDGE RENDERING
// ============================================================================
// Uses hex-to-disk mapping for guaranteed non-intersection.
// 1. Map boundary points to unit circle
// 2. Draw straight chords in disk
// 3. Map back to hexagon
// ============================================================================

const EDGE_PATH_SAMPLES = 80;
const EDGE_PATH_KNOT_STEP = 8;
const ENDPOINT_EPSILON = 1e-6;

/**
 * Get the angle on the unit circle for a point on a side at parameter t.
 * Maps the hexagon perimeter to a circle, maintaining clockwise order.
 *
 * Perimeter order: A(top) → X(upper-right) → B(lower-right) → Y(bottom) → C(lower-left) → Z(upper-left) → A
 * Each side spans 60° of the perimeter (since it's regular).
 * Starting angle: A is at angle 90° (top), going clockwise (decreasing angle).
 *
 * Side parameterization:
 *   AX: A→X, same as perimeter → angle goes from 90° to 30°
 *   BX: B→X, reversed from perimeter (perimeter is X→B) → t=0 at B(330°), t=1 at X(30°)
 *   BY: B→Y, same as perimeter → angle goes from 330° to 270°
 *   CY: C→Y, reversed from perimeter (perimeter is Y→C) → t=0 at C(210°), t=1 at Y(270°)
 *   CZ: C→Z, same as perimeter → angle goes from 210° to 150°
 *   AZ: A→Z, reversed from perimeter (perimeter is Z→A) → t=0 at A(90°), t=1 at Z(150°)
 */
function sideToCircleAngle(side, t) {
  const deg = Math.PI / 180;
  // Each side is parameterized from cone point (t=0) to identified vertex (t=1).
  // We map to angles on a circle where the perimeter goes clockwise from A at 90°.
  //
  // Perimeter (clockwise): A(90°) → X(30°) → B(-30°) → Y(-90°) → C(-150°) → Z(150°) → A
  //
  // AX: A→X, same as perimeter direction → angle = 90° - t*60°
  // BX: B→X, reverse of perimeter (X→B) → perimeter fraction (1-t) from X
  //     angle = 30° - (1-t)*60° = -30° + t*60°
  // BY: B→Y, same as perimeter direction → angle = -30° - t*60°
  // CY: C→Y, reverse of perimeter (Y→C) → perimeter fraction (1-t) from Y
  //     angle = -90° - (1-t)*60° = -150° + t*60°
  // CZ: C→Z, same as perimeter direction → angle = -150° - t*60°
  // AZ: A→Z, reverse of perimeter (Z→A) → perimeter fraction (1-t) from Z
  //     angle = 150° - (1-t)*60° = 90° + t*60°
  switch (side) {
    case 'AX': return (90 - t * 60) * deg;
    case 'BX': return (-30 + t * 60) * deg;
    case 'BY': return (-30 - t * 60) * deg;
    case 'CY': return (-150 + t * 60) * deg;
    case 'CZ': return (-150 - t * 60) * deg;
    case 'AZ': return (90 + t * 60) * deg;
    default: throw new Error(`Unknown side: ${side}`);
  }
}

/**
 * Map a point on a hexagon side to a unit circle point.
 */
function sideToDisk(side, t) {
  const angle = sideToCircleAngle(side, t);
  return [Math.cos(angle), Math.sin(angle)];
}

/**
 * Map a point from hexagon local coordinates to screen coordinates.
 * Local coords: origin at center, unit radius.
 */
function localToScreen(x, y) {
  return {
    x: CENTER_X + x * RADIUS,
    y: CENTER_Y - y * RADIUS
  };
}

/**
 * Map a point from the unit disk back to the hexagon interior.
 * Uses a simple radial mapping: for a point at angle θ and radius r in the disk,
 * find the hexagon boundary point at angle θ, then scale by r.
 */
function diskToHex(u, v) {
  const r = Math.hypot(u, v);
  if (r < 1e-10) return [0, 0];

  const angle = Math.atan2(v, u);

  // Find which edge of the hexagon this angle intersects.
  // Vertices in decreasing angle order (clockwise):
  // 150° → 90° → 30° → -30° → -90° → -150°
  const sortedAngles = [150, 90, 30, -30, -90, -150].map(d => d * Math.PI / 180);

  let boundaryR = 1; // fallback

  for (let i = 0; i < 6; i++) {
    const a1 = sortedAngles[i];
    const a2 = sortedAngles[(i + 1) % 6];

    // Check if angle is between a2 and a1 (a1 > a2 except for wrap)
    let inSector;
    if (i < 5) {
      inSector = angle <= a1 && angle >= a2;
    } else {
      // Wrap-around: the sector from -150° to 150° crosses the ±180° boundary,
      // so we use OR instead of AND (angle is in sector if it's beyond either edge)
      inSector = angle <= a2 || angle >= a1;
    }

    if (inSector) {
      // Hex vertex positions (unit radius)
      const v1x = Math.cos(a1), v1y = Math.sin(a1);
      const v2x = Math.cos(a2), v2y = Math.sin(a2);

      // Find where the ray from origin at `angle` intersects the line segment v1→v2
      const dx = Math.cos(angle), dy = Math.sin(angle);
      // Parametric: origin + t*(dx,dy) = v1 + s*(v2-v1)
      // t*dx = v1x + s*(v2x-v1x)
      // t*dy = v1y + s*(v2y-v1y)
      const denom = dx * (v2y - v1y) - dy * (v2x - v1x);
      if (Math.abs(denom) > 1e-12) {
        const t = (v1x * (v2y - v1y) - v1y * (v2x - v1x)) / denom;
        boundaryR = Math.max(t, 0);
      }
      break;
    }
  }

  // Scale the disk point to hex coordinates
  const scale = boundaryR; // at the boundary, r=1 maps to boundaryR
  return [u * scale, v * scale];
}

/**
 * Sample points along a chord in the disk and map back to hex.
 */
function chordImagePoints(fromSide, fromT, toSide, toT, nSamples) {
  const [u1, v1] = sideToDisk(fromSide, fromT);
  const [u2, v2] = sideToDisk(toSide, toT);

  const pts = [];
  for (let i = 0; i < nSamples; i++) {
    let t = i / (nSamples - 1);
    if (i === 0) t = ENDPOINT_EPSILON;
    if (i === nSamples - 1) t = 1 - ENDPOINT_EPSILON;

    const u = (1 - t) * u1 + t * u2;
    const v = (1 - t) * v1 + t * v2;
    pts.push(diskToHex(u, v));
  }
  return pts;
}

/**
 * Convert a sequence of points to cubic Bézier segments using Catmull-Rom.
 */
function catmullRomToBeziers(P) {
  if (P.length < 2) return [];

  const Pm1 = [2 * P[0][0] - P[1][0], 2 * P[0][1] - P[1][1]];
  const Pp1 = [2 * P[P.length - 1][0] - P[P.length - 2][0], 2 * P[P.length - 1][1] - P[P.length - 2][1]];
  const Q = [Pm1, ...P, Pp1];

  const segs = [];
  for (let i = 1; i < P.length; i++) {
    const p0 = Q[i - 1], p1 = Q[i], p2 = Q[i + 1], p3 = Q[i + 2];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    segs.push({ p1, c1, c2, p2 });
  }
  return segs;
}

/**
 * Get a curved edge path between two side-parameterized points.
 */
export function getCurvedEdgePath(fromSide, fromT, toSide, toT) {
  const pts = chordImagePoints(fromSide, fromT, toSide, toT, EDGE_PATH_SAMPLES);

  // Select knots for spline
  const knots = [];
  for (let i = 0; i < pts.length; i += EDGE_PATH_KNOT_STEP) {
    knots.push(pts[i]);
  }
  const lastPt = pts[pts.length - 1];
  const lastKnot = knots[knots.length - 1];
  if (!lastKnot || lastKnot[0] !== lastPt[0] || lastKnot[1] !== lastPt[1]) {
    knots.push(lastPt);
  }

  const segs = catmullRomToBeziers(knots);

  if (segs.length === 0) {
    const from = localToScreen(pts[0][0], pts[0][1]);
    const to = localToScreen(pts[pts.length - 1][0], pts[pts.length - 1][1]);
    const midX = (from.x + to.x) / 2;
    const midY = (from.y + to.y) / 2;
    const angle = Math.atan2(to.y - from.y, to.x - from.x) * (180 / Math.PI);
    return {
      pathD: `M ${from.x} ${from.y} L ${to.x} ${to.y}`,
      midPoint: { x: midX, y: midY },
      angle
    };
  }

  // Build SVG path in screen coordinates
  const firstScreen = localToScreen(segs[0].p1[0], segs[0].p1[1]);
  let d = `M ${firstScreen.x} ${firstScreen.y}`;

  for (const seg of segs) {
    const c1 = localToScreen(seg.c1[0], seg.c1[1]);
    const c2 = localToScreen(seg.c2[0], seg.c2[1]);
    const p2 = localToScreen(seg.p2[0], seg.p2[1]);
    d += ` C ${c1.x} ${c1.y} ${c2.x} ${c2.y} ${p2.x} ${p2.y}`;
  }

  // Calculate midpoint
  const midIdx = Math.floor(pts.length / 2);
  const midScreen = localToScreen(pts[midIdx][0], pts[midIdx][1]);

  // Calculate angle at midpoint
  const prevIdx = Math.max(0, midIdx - 1);
  const nextIdx = Math.min(pts.length - 1, midIdx + 1);
  const prev = localToScreen(pts[prevIdx][0], pts[prevIdx][1]);
  const next = localToScreen(pts[nextIdx][0], pts[nextIdx][1]);
  const angle = Math.atan2(next.y - prev.y, next.x - prev.x) * (180 / Math.PI);

  return {
    pathD: d,
    midPoint: { x: midScreen.x, y: midScreen.y },
    angle
  };
}
