import { useMemo } from 'react';
import {
  getSize,
  getShear,
  getCurvedEdgePath,
  getStraightRhombusPath
} from '../utils/geometry.js';
import { isParallelizable, generateParallelRegions } from '../utils/parallelizable.js';
import { allEdgesToFloat } from '../utils/combinatorialPathLogic.js';
import './ParallelRegionsViewer.css';

// Distinct colors for regions
const REGION_COLORS = [
  'rgba(255, 99, 132, 0.45)',
  'rgba(54, 162, 235, 0.45)',
  'rgba(255, 206, 86, 0.45)',
  'rgba(75, 192, 192, 0.45)',
  'rgba(153, 102, 255, 0.45)',
  'rgba(255, 159, 64, 0.45)',
  'rgba(199, 199, 199, 0.45)',
  'rgba(83, 102, 255, 0.45)',
  'rgba(255, 99, 255, 0.45)',
  'rgba(99, 255, 132, 0.45)',
  'rgba(255, 180, 120, 0.45)',
  'rgba(120, 220, 255, 0.45)'
];

const REGION_STROKE_COLORS = [
  'rgba(255, 99, 132, 0.8)',
  'rgba(54, 162, 235, 0.8)',
  'rgba(255, 206, 86, 0.8)',
  'rgba(75, 192, 192, 0.8)',
  'rgba(153, 102, 255, 0.8)',
  'rgba(255, 159, 64, 0.8)',
  'rgba(199, 199, 199, 0.8)',
  'rgba(83, 102, 255, 0.8)',
  'rgba(255, 99, 255, 0.8)',
  'rgba(99, 255, 132, 0.8)',
  'rgba(255, 180, 120, 0.8)',
  'rgba(120, 220, 255, 0.8)'
];

/**
 * Convert a polygon (array of {x, y} points) to an SVG path string.
 */
function polygonToPath(polygon) {
  if (polygon.length === 0) return '';
  const first = polygon[0];
  let d = `M ${first.x} ${first.y}`;
  for (let i = 1; i < polygon.length; i++) {
    d += ` L ${polygon[i].x} ${polygon[i].y}`;
  }
  d += ' Z';
  return d;
}

/**
 * ParallelRegionsViewer - modal overlay displaying the parallelizable regions
 * of the rhombus partitioned by the path's edges.
 */
function ParallelRegionsViewer({ state, onClose }) {
  const SIZE = getSize();
  const SHEAR = getShear();
  const HALF_SHEAR = SHEAR / 2;

  // Compute float edges for drawing the edge curves
  const floatEdges = useMemo(() => allEdgesToFloat(state), [state]);

  // Generate the parallel regions
  const regions = useMemo(() => {
    const check = isParallelizable(state);
    if (!check.parallelizable) return [];
    return generateParallelRegions(state);
  }, [state]);

  // SVG viewBox with padding
  const padding = 40;
  const viewBox = `${-HALF_SHEAR - padding} ${-padding} ${SIZE + SHEAR + 2 * padding} ${SIZE + 2 * padding}`;

  return (
    <div className="parallel-regions-overlay" onClick={onClose}>
      <div className="parallel-regions-container" onClick={(e) => e.stopPropagation()}>
        <div className="parallel-regions-header">
          <h2>Parallel Regions</h2>
          <button onClick={onClose} className="parallel-regions-close-btn">×</button>
        </div>

        <div className="parallel-regions-content">
          <svg viewBox={viewBox} className="parallel-regions-svg">
            {/* Rhombus outline */}
            <path
              d={getStraightRhombusPath()}
              fill="rgba(30, 30, 50, 0.8)"
              stroke="#555"
              strokeWidth="1"
            />

            {/* Filled regions */}
            {regions.map((region, idx) => (
              <path
                key={`region-${idx}`}
                d={polygonToPath(region.polygon)}
                fill={REGION_COLORS[idx % REGION_COLORS.length]}
                stroke={REGION_STROKE_COLORS[idx % REGION_STROKE_COLORS.length]}
                strokeWidth="1.5"
              />
            ))}

            {/* Edge curves drawn on top */}
            {floatEdges.map((edge, idx) => {
              const edgeData = getCurvedEdgePath(
                edge.from.side, edge.from.t,
                edge.to.side, edge.to.t
              );
              return (
                <path
                  key={`edge-${idx}`}
                  d={edgeData.pathD}
                  fill="none"
                  stroke="#fff"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              );
            })}
          </svg>

          <div className="parallel-regions-legend">
            <p>{regions.length} region{regions.length !== 1 ? 's' : ''} ({floatEdges.length} edge{floatEdges.length !== 1 ? 's' : ''})</p>
            <div className="legend-items">
              {regions.map((region, idx) => (
                <span key={idx} className="legend-item">
                  <span
                    className="legend-swatch"
                    style={{ background: REGION_COLORS[idx % REGION_COLORS.length] }}
                  />
                  Edge {region.edgeIndex + 1}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ParallelRegionsViewer;
