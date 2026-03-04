import { useState, useMemo, useCallback } from 'react';
import {
  getSize,
  getShear,
  getCurvedEdgePath,
  getStraightRhombusPath,
  isInteriorPoint,
  getIdentifiedSide,
  EPSILON
} from '../utils/geometry.js';
import { isParallelizable, generateParallelRegions, generateParallelRegionsPaper } from '../utils/parallelizable.js';
import { allEdgesToFloat } from '../utils/combinatorialPathLogic.js';
import {
  createIdentityFrame,
  applyReferenceFrame,
  updateReferenceFrameForSide,
  paperToTrueRhombus
} from '../utils/wallpaperGeometry.js';
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
 * Check if an edge stays within the same rhombus.
 */
function isSameSideEdge(edge) {
  if (isInteriorPoint(edge.from) || isInteriorPoint(edge.to)) return false;
  if (edge.from.side === edge.to.side) return true;
  if (getIdentifiedSide(edge.from.side) === edge.to.side &&
      Math.abs(edge.from.t - edge.to.t) < EPSILON) return true;
  return false;
}

/**
 * Compute the wallpaper reference frame for each edge by walking through
 * the path and tracking boundary crossings, mirroring the logic in
 * WallpaperViewer's generateWallpaperData / wallpaperGeometry's pathToWallpaperPath.
 *
 * @param {Array} floatEdges - Float edges with { from: {side, t}, to: {side, t} }
 * @returns {Array<Object>} - One frame per edge
 */
function computeEdgeFrames(floatEdges) {
  const frames = [];
  let currentFrame = createIdentityFrame();

  for (let i = 0; i < floatEdges.length; i++) {
    // Edge i uses the current frame
    frames.push({ ...currentFrame });

    const edge = floatEdges[i];

    // Determine if we need to update the frame after this edge
    if (!isInteriorPoint(edge.to)) {
      const nextEdge = floatEdges[i + 1];
      let shouldUpdateFrame = false;

      if (!isSameSideEdge(edge)) {
        // Edge crosses the rhombus
        if (nextEdge) {
          const nextStartsSamePhysicalSide = !isInteriorPoint(nextEdge.from) &&
            nextEdge.from.side === edge.to.side;
          const nextIsSameSide = isSameSideEdge(nextEdge);
          shouldUpdateFrame = !(nextIsSameSide && nextStartsSamePhysicalSide);
        } else {
          shouldUpdateFrame = true;
        }
      } else if (nextEdge) {
        // Same-side edge: check if next edge transitions via identification
        if (!isInteriorPoint(nextEdge.from)) {
          const endSide = edge.to.side;
          const nextStartSide = nextEdge.from.side;
          if (endSide !== nextStartSide &&
              getIdentifiedSide(endSide) === nextStartSide &&
              Math.abs(edge.to.t - nextEdge.from.t) < EPSILON) {
            shouldUpdateFrame = true;
          }
        }
      }

      if (shouldUpdateFrame) {
        currentFrame = updateReferenceFrameForSide(edge.to.side, currentFrame);
      }
    }
  }

  return frames;
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

  // Compute fundamental domain polygons (wallpaper-space point arrays),
  // one per region, lifted into wallpaper space via per-edge frames.
  const fundamentalDomainPolygons = useMemo(() => {
    if (regions.length === 0) return [];
    const paperRegions = generateParallelRegionsPaper(state, 60);
    if (paperRegions.length === 0) return [];
    const edgeFrames = computeEdgeFrames(floatEdges);
    return paperRegions.map(region => {
      const frame = edgeFrames[region.edgeIndex] || createIdentityFrame();
      return region.polygon.map(pt => {
        const local = paperToTrueRhombus(pt.southward, pt.eastward);
        return applyReferenceFrame(local.x, local.y, frame);
      });
    });
  }, [state, regions, floatEdges]);

  // Derive SVG paths and viewBox from the polygons.
  const fundamentalDomain = useMemo(() => {
    if (fundamentalDomainPolygons.length === 0) return { paths: [], viewBox: '0 0 1 1' };
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const paths = fundamentalDomainPolygons.map(pts => {
      for (const pt of pts) {
        minX = Math.min(minX, pt.x);
        minY = Math.min(minY, pt.y);
        maxX = Math.max(maxX, pt.x);
        maxY = Math.max(maxY, pt.y);
      }
      return polygonToPath(pts);
    });
    const pad = 30;
    const vb = `${minX - pad} ${minY - pad} ${maxX - minX + 2 * pad} ${maxY - minY + 2 * pad}`;
    return { paths, viewBox: vb };
  }, [fundamentalDomainPolygons]);

  // SVG export handler for the fundamental domain view
  const handleSaveSvg = useCallback(() => {
    let paths = '';
    for (let i = 0; i < fundamentalDomain.paths.length; i++) {
      const color = REGION_STROKE_COLORS[i % REGION_STROKE_COLORS.length];
      paths += `  <path d="${fundamentalDomain.paths[i]}" fill="none" stroke="${color}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round" />\n`;
    }
    const svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${fundamentalDomain.viewBox}" style="background: #12121e">
${paths}</svg>`;
    const blob = new Blob([svgContent], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'fundamental-domain.svg';
    a.click();
    URL.revokeObjectURL(url);
  }, [fundamentalDomain]);

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
                {/* Fundamental domain: show outlines (strokes) of each region
                    polygon instead of fills, to avoid Chrome's fill rule
                    occluding the actual shape. */}
                {fundamentalDomain.paths.map((pathD, idx) => (
                  <path
                    key={`fd-${idx}`}
                    d={pathD}
                    fill="none"
                    stroke={REGION_STROKE_COLORS[idx % REGION_STROKE_COLORS.length]}
                    strokeWidth="3"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                ))}
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
            {regions.length > 0 && viewMode === 'domain' && (
              <button
                className="pr-wallpaper-btn"
                onClick={handleSaveSvg}
              >
                Save SVG
              </button>
            )}
          </div>
        </div>
      </div>

      {showWallpaper && (
        <ParallelRegionsWallpaperViewer
          fundamentalDomainPolygons={fundamentalDomainPolygons}
          onClose={() => setShowWallpaper(false)}
        />
      )}
    </div>
  );
}

export default ParallelRegionsViewer;
