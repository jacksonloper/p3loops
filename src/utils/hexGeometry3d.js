/**
 * 3D geometry utilities for rendering hex orbifold paths on a puffed surface.
 *
 * The hexagon has 3 cone points A, B, C and 3 identified vertices X ≡ Y ≡ Z.
 * Points are converted to barycentric coordinates w.r.t. triangle ABC.
 *
 * The hexagon is divided into:
 *   - Central triangle ABC (all barycentric coords ≥ 0): front face, Z > 0
 *   - Three "ears":
 *     - AXB (c < 0): between edge AB and hexagon sides AX, BX
 *     - BYC (a < 0): between edge BC and hexagon sides BY, CY
 *     - CZA (b < 0): between edge CA and hexagon sides CZ, AZ
 *
 * Each ear is mapped back onto the equilateral triangle using local barycentric
 * coordinates, with X ≡ Y ≡ Z all mapping to the centroid (0, 0).
 * This ensures identified sides coincide in 3D.
 *
 * Barycentric coords of hexagon vertices w.r.t. ABC (regular hexagon):
 *   A = (1, 0, 0)    B = (0, 1, 0)    C = (0, 0, 1)
 *   X = (2/3, 2/3, -1/3)   Y = (-1/3, 2/3, 2/3)   Z = (2/3, -1/3, 2/3)
 */

// Equilateral triangle vertices (same as P3 for consistency)
const V_A = { x: 0, y: 2 / 3 };       // top (cone point A)
const V_B = { x: 0.5, y: -1 / 3 };    // bottom-right (cone point B)
const V_C = { x: -0.5, y: -1 / 3 };   // bottom-left (cone point C)

// Barycentric coordinates of hexagon vertices w.r.t. triangle ABC
const HEX_BARY = {
  A: { a: 1, b: 0, c: 0 },
  X: { a: 2 / 3, b: 2 / 3, c: -1 / 3 },
  B: { a: 0, b: 1, c: 0 },
  Y: { a: -1 / 3, b: 2 / 3, c: 2 / 3 },
  C: { a: 0, b: 0, c: 1 },
  Z: { a: 2 / 3, b: -1 / 3, c: 2 / 3 }
};

/**
 * Convert a hex side + parameter to barycentric coordinates w.r.t. A, B, C.
 * Each side is parameterized from cone point (t=0) to identified vertex (t=1).
 *
 * @param {string} side - One of 'AX', 'AZ', 'BX', 'BY', 'CY', 'CZ'
 * @param {number} t - Parameter in [0, 1]
 * @returns {{a: number, b: number, c: number}} Barycentric coordinates
 */
export function hexSideToBary(side, t) {
  let from, to;
  switch (side) {
    case 'AX': from = HEX_BARY.A; to = HEX_BARY.X; break;
    case 'AZ': from = HEX_BARY.A; to = HEX_BARY.Z; break;
    case 'BX': from = HEX_BARY.B; to = HEX_BARY.X; break;
    case 'BY': from = HEX_BARY.B; to = HEX_BARY.Y; break;
    case 'CY': from = HEX_BARY.C; to = HEX_BARY.Y; break;
    case 'CZ': from = HEX_BARY.C; to = HEX_BARY.Z; break;
    default: throw new Error(`Unknown hex side: ${side}`);
  }

  return {
    a: from.a + t * (to.a - from.a),
    b: from.b + t * (to.b - from.b),
    c: from.c + t * (to.c - from.c)
  };
}

/**
 * Convert barycentric coordinates (w.r.t. A, B, C) to 3D coordinates.
 *
 * For the central triangle (all bary ≥ 0):
 *   (x, y) = a·V_A + b·V_B + c·V_C
 *   z = +(a·b·c)^(1/3)
 *
 * For each ear, we compute local barycentric coords where the identified
 * vertex (X, Y, or Z) maps to the centroid of the equilateral triangle.
 * This ensures that X ≡ Y ≡ Z all map to the same 3D point.
 *
 * The z formula uses "projected" barycentric coordinates so that z = 0 only
 * on the triangle edges (where front and back faces meet), NOT on the hexagon
 * boundary sides (which become interior edges of the back face after
 * identification).
 *
 * Ear AXB (c < 0): local coords α = a+2c, β = b+2c
 *   (x,y) = α·V_A + β·V_B
 *   projected bary: (a+c, b+c, -c), z = -((a+c)·(b+c)·(-c))^(1/3)
 *
 * Ear BYC (a < 0): local coords β = b+2a, γ = c+2a
 *   (x,y) = β·V_B + γ·V_C
 *   projected bary: (-a, b+a, c+a), z = -((-a)·(b+a)·(c+a))^(1/3)
 *
 * Ear CZA (b < 0): local coords γ = c+2b, α = a+2b
 *   (x,y) = γ·V_C + α·V_A
 *   projected bary: (a+b, -b, c+b), z = -((a+b)·(-b)·(c+b))^(1/3)
 *
 * @param {number} a - Barycentric coord for A
 * @param {number} b - Barycentric coord for B
 * @param {number} c - Barycentric coord for C
 * @returns {{x: number, y: number, z: number}}
 */
export function hexBaryTo3D(a, b, c) {
  if (a >= 0 && b >= 0 && c >= 0) {
    // Central triangle ABC — front face
    const x = a * V_A.x + b * V_B.x + c * V_C.x;
    const y = a * V_A.y + b * V_B.y + c * V_C.y;
    const z = Math.cbrt(Math.max(0, a) * Math.max(0, b) * Math.max(0, c));
    return { x, y, z };
  } else if (c < 0) {
    // Ear AXB — X is at centroid on back face
    const alpha = a + 2 * c;
    const beta = b + 2 * c;
    const x = Math.max(0, alpha) * V_A.x + Math.max(0, beta) * V_B.x;
    const y = Math.max(0, alpha) * V_A.y + Math.max(0, beta) * V_B.y;
    const z = -Math.cbrt(Math.max(0, a + c) * Math.max(0, b + c) * Math.max(0, -c));
    return { x, y, z };
  } else if (a < 0) {
    // Ear BYC — Y is at centroid on back face
    const beta = b + 2 * a;
    const gamma = c + 2 * a;
    const x = Math.max(0, beta) * V_B.x + Math.max(0, gamma) * V_C.x;
    const y = Math.max(0, beta) * V_B.y + Math.max(0, gamma) * V_C.y;
    const z = -Math.cbrt(Math.max(0, -a) * Math.max(0, b + a) * Math.max(0, c + a));
    return { x, y, z };
  } else {
    // Ear CZA (b < 0) — Z is at centroid on back face
    const gamma = c + 2 * b;
    const alpha = a + 2 * b;
    const x = Math.max(0, gamma) * V_C.x + Math.max(0, alpha) * V_A.x;
    const y = Math.max(0, gamma) * V_C.y + Math.max(0, alpha) * V_A.y;
    const z = -Math.cbrt(Math.max(0, a + b) * Math.max(0, -b) * Math.max(0, c + b));
    return { x, y, z };
  }
}

/**
 * Interpolate a hex edge in 3D by subdividing in barycentric space.
 *
 * @param {Object} edge - Edge with from: {side, t} and to: {side, t}
 * @param {number} numSamples - Number of sample points (default: 15)
 * @returns {Array<{x: number, y: number, z: number}>}
 */
export function interpolateHexEdge3D(edge, numSamples = 15) {
  const fromBary = hexSideToBary(edge.from.side, edge.from.t);
  const toBary = hexSideToBary(edge.to.side, edge.to.t);

  const points = [];
  for (let i = 0; i < numSamples; i++) {
    const s = (numSamples === 1) ? 0 : i / (numSamples - 1);
    const a = fromBary.a + s * (toBary.a - fromBary.a);
    const b = fromBary.b + s * (toBary.b - fromBary.b);
    const c = fromBary.c + s * (toBary.c - fromBary.c);
    points.push(hexBaryTo3D(a, b, c));
  }

  return points;
}

/**
 * Get the 3D vertices for the flat equilateral triangle base at z=0.
 * Returns [top, bottom-left, bottom-right] matching V_A, V_C, V_B.
 */
export function getHexFlatTriangleVertices() {
  return [
    { x: V_A.x, y: V_A.y, z: 0 },
    { x: V_C.x, y: V_C.y, z: 0 },
    { x: V_B.x, y: V_B.y, z: 0 }
  ];
}

/**
 * Compute direction vector for a cone at a given position along the path.
 * @param {Array} points - Array of 3D points
 * @param {number} index - Index of the point to compute direction at
 * @returns {{x: number, y: number, z: number}} Normalized direction vector
 */
export function getDirectionAtPoint(points, index) {
  let dx, dy, dz;

  if (index < points.length - 1) {
    dx = points[index + 1].x - points[index].x;
    dy = points[index + 1].y - points[index].y;
    dz = points[index + 1].z - points[index].z;
  } else {
    dx = points[index].x - points[index - 1].x;
    dy = points[index].y - points[index - 1].y;
    dz = points[index].z - points[index - 1].z;
  }

  const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
  if (len < 0.0001) {
    return { x: 1, y: 0, z: 0 };
  }

  return { x: dx / len, y: dy / len, z: dz / len };
}
