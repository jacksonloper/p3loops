import { useMemo } from 'react';
import { computeFundamentalDomains, getCurvedEdgePath, getStraightRhombusPath } from '../utils/geometry.js';
import './FundamentalDomainViewer.css';

// Colors for the fundamental domain regions (distinct, accessible palette)
const REGION_COLORS = [
  'rgba(102, 126, 234, 0.4)',
  'rgba(234, 102, 126, 0.4)',
  'rgba(102, 234, 166, 0.4)',
  'rgba(234, 198, 102, 0.4)',
  'rgba(198, 102, 234, 0.4)',
  'rgba(102, 198, 234, 0.4)',
  'rgba(234, 150, 102, 0.4)',
  'rgba(150, 234, 102, 0.4)',
  'rgba(102, 150, 234, 0.4)',
  'rgba(234, 102, 198, 0.4)',
  'rgba(150, 102, 234, 0.4)',
  'rgba(102, 234, 234, 0.4)'
];

/**
 * Build an SVG path string from an array of {x, y} points (closed).
 */
function pointsToPathD(points) {
  if (points.length === 0) return '';
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    d += ` L ${points[i].x} ${points[i].y}`;
  }
  d += ' Z';
  return d;
}

/**
 * Compute bounding box of a set of points with padding.
 */
function computeBounds(points, padding = 20) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return {
    minX: minX - padding,
    minY: minY - padding,
    maxX: maxX + padding,
    maxY: maxY + padding
  };
}

/**
 * FundamentalDomainViewer - Shows each edge as a region (fundamental domain)
 * that partitions the rhombus. Displays the regions as colored SVG shapes
 * both composited in the rhombus and as individual cut-out pieces.
 *
 * @param {Object[]} edges - Array of float edge objects with from/to points
 * @param {function} onClose - Callback to close the viewer
 */
function FundamentalDomainViewer({ edges, onClose }) {
  // Compute the fundamental domain regions
  const regions = useMemo(() => computeFundamentalDomains(edges), [edges]);

  // Compute the rhombus outline
  const rhombusPath = useMemo(() => getStraightRhombusPath(), []);

  // Compute edge curves for overlay
  const edgeCurves = useMemo(() =>
    edges.map(edge =>
      getCurvedEdgePath(edge.from.side, edge.from.t, edge.to.side, edge.to.t)
    ), [edges]);

  // Compute viewBox from all region points
  const viewBox = useMemo(() => {
    const allPts = regions.flatMap(r => r.points);
    if (allPts.length === 0) return '-50 -50 400 400';
    const bounds = computeBounds(allPts, 30);
    const w = bounds.maxX - bounds.minX;
    const h = bounds.maxY - bounds.minY;
    return `${bounds.minX} ${bounds.minY} ${w} ${h}`;
  }, [regions]);

  // Compute individual cut viewboxes for each region
  const cutViewBoxes = useMemo(() =>
    regions.map(r => {
      const bounds = computeBounds(r.points, 10);
      const w = bounds.maxX - bounds.minX;
      const h = bounds.maxY - bounds.minY;
      return `${bounds.minX} ${bounds.minY} ${w} ${h}`;
    }), [regions]);

  return (
    <div className="fd-viewer-overlay" onClick={onClose}>
      <div className="fd-viewer-container" onClick={(e) => e.stopPropagation()}>
        <div className="fd-viewer-header">
          <h2>Fundamental Domains</h2>
          <button onClick={onClose} className="fd-close-btn">×</button>
        </div>

        <div className="fd-canvas-container">
          <svg viewBox={viewBox} className="fd-svg">
            {/* Rhombus outline */}
            <path d={rhombusPath} className="fd-rhombus-outline" />

            {/* Filled fundamental domain regions */}
            {regions.map((region, i) => (
              <path
                key={`region-${i}`}
                d={pointsToPathD(region.points)}
                fill={REGION_COLORS[i % REGION_COLORS.length]}
                className="fd-region"
              />
            ))}

            {/* Edge curves overlaid */}
            {edgeCurves.map((curve, i) => (
              <g key={`edge-${i}`}>
                <path d={curve.pathD} className="fd-edge-line" />
                <text
                  x={curve.midPoint.x}
                  y={curve.midPoint.y}
                  className="fd-edge-label"
                  textAnchor="middle"
                  dominantBaseline="central"
                >
                  {i + 1}
                </text>
              </g>
            ))}
          </svg>
        </div>

        {/* Individual cut-out pieces */}
        <div className="fd-cuts-container">
          {regions.map((region, i) => (
            <div key={`cut-${i}`} className="fd-cut-item">
              <svg viewBox={cutViewBoxes[i]} className="fd-cut-svg">
                <path
                  d={pointsToPathD(region.points)}
                  fill={REGION_COLORS[i % REGION_COLORS.length]}
                  stroke="rgba(255,255,255,0.6)"
                  strokeWidth="1"
                />
              </svg>
              <span className="fd-cut-label">Edge {i + 1}</span>
            </div>
          ))}
        </div>

        <div className="fd-info">
          <p>
            {regions.length} fundamental domain{regions.length !== 1 ? 's' : ''} partitioning the rhombus •
            Each region corresponds to one edge
          </p>
        </div>
      </div>
    </div>
  );
}

export default FundamentalDomainViewer;
