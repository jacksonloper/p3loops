import { useState, useMemo } from 'react';
import {
  getSize,
  getShear,
  getCurvedEdgePath,
  getStraightRhombusPath
} from '../utils/geometry.js';
import { isParallelizable, generateParallelRegions, generateMergedRegionsPaper } from '../utils/parallelizable.js';
import { allEdgesToFloat } from '../utils/combinatorialPathLogic.js';
import { paperToTrueRhombus } from '../utils/wallpaperGeometry.js';
import ParallelRegionsWallpaperViewer from './ParallelRegionsWallpaperViewer.jsx';
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
  const [showWallpaper, setShowWallpaper] = useState(false);
  const [viewMode, setViewMode] = useState('regions'); // 'regions' | 'domain'
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

  // Generate the merged fundamental-domain polygon (all regions stitched)
  const fundamentalDomain = useMemo(() => {
    if (regions.length === 0) return { path: '', viewBox: '0 0 1 1' };
    const merged = generateMergedRegionsPaper(state, [{ start: 0, end: regions.length - 1 }], 60);
    if (merged.length === 0 || merged[0].polygon.length === 0) return { path: '', viewBox: '0 0 1 1' };
    const polygon = merged[0].polygon;
    const screenPts = polygon.map(pt => paperToTrueRhombus(pt.southward, pt.eastward));
    // Build path
    let d = `M ${screenPts[0].x} ${screenPts[0].y}`;
    for (let i = 1; i < screenPts.length; i++) {
      d += ` L ${screenPts[i].x} ${screenPts[i].y}`;
    }
    d += ' Z';
    // Compute bounding box
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const pt of screenPts) {
      minX = Math.min(minX, pt.x);
      minY = Math.min(minY, pt.y);
      maxX = Math.max(maxX, pt.x);
      maxY = Math.max(maxY, pt.y);
    }
    const pad = 20;
    const vb = `${minX - pad} ${minY - pad} ${maxX - minX + 2 * pad} ${maxY - minY + 2 * pad}`;
    return { path: d, viewBox: vb };
  }, [state, regions]);

  // SVG viewBox: use computed bounds in domain mode, sheared editor in regions mode
  const padding = 40;
  const regionsViewBox = `${-HALF_SHEAR - padding} ${-padding} ${SIZE + SHEAR + 2 * padding} ${SIZE + 2 * padding}`;
  const activeViewBox = viewMode === 'domain' ? fundamentalDomain.viewBox : regionsViewBox;

  return (
    <div className="parallel-regions-overlay" onClick={onClose}>
      <div className="parallel-regions-container" onClick={(e) => e.stopPropagation()}>
        <div className="parallel-regions-header">
          <h2>Parallel Regions</h2>
          <button onClick={onClose} className="parallel-regions-close-btn">×</button>
        </div>

        <div className="parallel-regions-content">
          {regions.length > 0 && (
            <div className="pr-view-toggle">
              <button
                className={`pr-toggle-btn ${viewMode === 'regions' ? 'active' : ''}`}
                onClick={() => setViewMode('regions')}
              >
                Regions
              </button>
              <button
                className={`pr-toggle-btn ${viewMode === 'domain' ? 'active' : ''}`}
                onClick={() => setViewMode('domain')}
              >
                Fundamental Domain
              </button>
            </div>
          )}

          <svg viewBox={activeViewBox} className="parallel-regions-svg">
            {viewMode === 'regions' ? (
              <>
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
              </>
            ) : (
              <>
                {/* Fundamental domain: single merged polygon, thick white border */}
                {fundamentalDomain.path && (
                  <path
                    d={fundamentalDomain.path}
                    fill="rgba(100, 120, 220, 0.35)"
                    stroke="white"
                    strokeWidth="3"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                )}
              </>
            )}
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
            {regions.length > 0 && (
              <button
                className="pr-wallpaper-btn"
                onClick={() => setShowWallpaper(true)}
              >
                View as Wallpaper
              </button>
            )}
          </div>
        </div>
      </div>

      {showWallpaper && (
        <ParallelRegionsWallpaperViewer
          state={state}
          onClose={() => setShowWallpaper(false)}
        />
      )}
    </div>
  );
}

export default ParallelRegionsViewer;
