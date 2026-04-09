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
// STRAIGHT LINE EDGE RENDERING
// ============================================================================
// Since the path always starts at X and no edge goes from a side to itself,
// straight lines between boundary points suffice for non-crossing rendering.
// ============================================================================

/**
 * Get a straight edge path between two side-parameterized points.
 * Returns the SVG path, midpoint, and angle for the direction arrow.
 */
export function getStraightEdgePath(fromSide, fromT, toSide, toT) {
  const from = getPointOnSide(fromSide, fromT);
  const to = getPointOnSide(toSide, toT);

  const midX = (from.x + to.x) / 2;
  const midY = (from.y + to.y) / 2;
  const angle = Math.atan2(to.y - from.y, to.x - from.x) * (180 / Math.PI);

  return {
    pathD: `M ${from.x} ${from.y} L ${to.x} ${to.y}`,
    midPoint: { x: midX, y: midY },
    angle
  };
}
