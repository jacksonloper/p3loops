/**
 * Approximate Minimum Enclosing Circle (MEC) for a set of 2D points.
 *
 * Algorithm:
 *   1. Find the point farthest from the first point.
 *   2. Find the point farthest from that point.
 *   3. Start with the circle whose diameter is those two points.
 *   4. For each point outside the circle, expand the circle just enough
 *      to include it (move the center toward the outlier and grow the radius).
 *
 * @param {Array<{x: number, y: number}>} pts - Array of points
 * @returns {{c: {x: number, y: number}, r: number}} - Center and radius
 */

const hyp = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);

export const mecApprox = (pts) => {
  let a = pts[0], b = a, c, r;
  for (const p of pts) if (hyp(p, a) > hyp(a, a)) a = p;
  for (const p of pts) if (hyp(p, a) > hyp(b, a)) b = p;
  c = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  r = hyp(a, b) / 2;
  for (const p of pts) {
    const d = hyp(p, c);
    if (d > r) {
      const k = (d - r) / (2 * d);
      c = { x: c.x + (p.x - c.x) * k, y: c.y + (p.y - c.y) * k };
      r = (r + d) / 2;
    }
  }
  return { c, r };
};
