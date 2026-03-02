import { useState, useMemo } from 'react';
import {
  applyReferenceFrame,
  paperToTrueRhombus,
  NE_CORNER,
  NW_CORNER,
  SE_CORNER,
  SW_CORNER
} from '../utils/wallpaperGeometry.js';
import { indexToFrame } from '../utils/moveTree.js';
import { generateParallelRegionsPaper } from '../utils/parallelizable.js';
import { allEdgesToFloat } from '../utils/combinatorialPathLogic.js';
import { getEdgeSamplePointsPaper } from '../utils/geometry.js';
import './ParallelRegionsWallpaperViewer.css';

// Number of sample points per edge for curved rendering
const EDGE_SAMPLES = 20;

/**
 * Generate a color for a given (i, j, k) index.
 * Uses a hash-based approach for distinct colors per copy.
 */
function indexToColor(tx, ty, r, alpha = 0.45) {
  // Simple hash for color generation
  const h = ((tx * 73 + ty * 137 + r * 53) % 360 + 360) % 360;
  const s = 55 + (((tx * 31 + ty * 97 + r * 17) % 30) + 30) % 30;
  const l = 45 + (((tx * 43 + ty * 61 + r * 29) % 20) + 20) % 20;
  return `hsla(${h}, ${s}%, ${l}%, ${alpha})`;
}

/**
 * Convert a paper-coordinate polygon to a screen-space SVG path string
 * by transforming each point through paperToTrueRhombus and applyReferenceFrame.
 */
function paperPolygonToPath(polygon, frame) {
  if (polygon.length === 0) return '';
  const screenPts = polygon.map(pt => {
    const local = paperToTrueRhombus(pt.southward, pt.eastward);
    return applyReferenceFrame(local.x, local.y, frame);
  });
  let d = `M ${screenPts[0].x} ${screenPts[0].y}`;
  for (let i = 1; i < screenPts.length; i++) {
    d += ` L ${screenPts[i].x} ${screenPts[i].y}`;
  }
  d += ' Z';
  return d;
}

/**
 * Generate SVG path for a single edge in a given reference frame.
 */
function generateEdgePath(edge, frame) {
  const samplePoints = getEdgeSamplePointsPaper(
    edge.from.side, edge.from.t,
    edge.to.side, edge.to.t,
    EDGE_SAMPLES
  );
  
  const screenPoints = samplePoints.map(pt => {
    const localScreen = paperToTrueRhombus(pt.southward, pt.eastward);
    return applyReferenceFrame(localScreen.x, localScreen.y, frame);
  });
  
  if (screenPoints.length < 2) return '';
  
  let path = `M ${screenPoints[0].x} ${screenPoints[0].y}`;
  for (let i = 1; i < screenPoints.length; i++) {
    path += ` L ${screenPoints[i].x} ${screenPoints[i].y}`;
  }
  return path;
}

/**
 * Get the rhombus outline path for a given reference frame.
 */
function getRhombusPathString(frame) {
  const corners = {
    ne: applyReferenceFrame(NE_CORNER.x, NE_CORNER.y, frame),
    nw: applyReferenceFrame(NW_CORNER.x, NW_CORNER.y, frame),
    se: applyReferenceFrame(SE_CORNER.x, SE_CORNER.y, frame),
    sw: applyReferenceFrame(SW_CORNER.x, SW_CORNER.y, frame)
  };
  return `M ${corners.nw.x} ${corners.nw.y} L ${corners.ne.x} ${corners.ne.y} L ${corners.se.x} ${corners.se.y} L ${corners.sw.x} ${corners.sw.y} Z`;
}

/**
 * Get the center of a rhombus in a given frame.
 */
function getRhombusCenter(frame) {
  const corners = [
    applyReferenceFrame(NE_CORNER.x, NE_CORNER.y, frame),
    applyReferenceFrame(NW_CORNER.x, NW_CORNER.y, frame),
    applyReferenceFrame(SE_CORNER.x, SE_CORNER.y, frame),
    applyReferenceFrame(SW_CORNER.x, SW_CORNER.y, frame)
  ];
  return {
    x: (corners[0].x + corners[1].x + corners[2].x + corners[3].x) / 4,
    y: (corners[0].y + corners[1].y + corners[2].y + corners[3].y) / 4
  };
}

/**
 * ParallelRegionsWallpaperViewer - renders parallel regions tiled across
 * a P3 wallpaper pattern with 3n² copies, colored by connected component.
 */
function ParallelRegionsWallpaperViewer({ state, onClose }) {
  const [n, setN] = useState(2);

  // Compute float edges for drawing edge curves
  const floatEdges = useMemo(() => allEdgesToFloat(state), [state]);

  // Generate paper-coordinate parallel regions (once, shared across all copies)
  const paperRegions = useMemo(() => {
    return generateParallelRegionsPaper(state, 30);
  }, [state]);

  // Generate all 3n² rhombus copies (n × n grid × 3 rotations)
  const copies = useMemo(() => {
    const result = [];
    const half = Math.floor(n / 2);
    for (let i = -half; i < -half + n; i++) {
      for (let j = -half; j < -half + n; j++) {
        for (let k = 0; k < 3; k++) {
          const index = { tx: i, ty: j, r: k };
          const frame = indexToFrame(index);
          result.push({ index, frame });
        }
      }
    }
    return result;
  }, [n]);

  // Compute bounding box from all rhombus corners
  const viewBox = useMemo(() => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const { frame } of copies) {
      const center = getRhombusCenter(frame);
      // Use a generous estimate per rhombus
      minX = Math.min(minX, center.x - 350);
      minY = Math.min(minY, center.y - 350);
      maxX = Math.max(maxX, center.x + 350);
      maxY = Math.max(maxY, center.y + 350);
    }
    const padding = 40;
    return `${minX - padding} ${minY - padding} ${maxX - minX + 2 * padding} ${maxY - minY + 2 * padding}`;
  }, [copies]);

  return (
    <div className="pr-wallpaper-overlay" onClick={onClose}>
      <div className="pr-wallpaper-container" onClick={(e) => e.stopPropagation()}>
        <div className="pr-wallpaper-header">
          <h2>Parallel Regions Wallpaper</h2>
          <button onClick={onClose} className="pr-wallpaper-close-btn">×</button>
        </div>

        <div className="pr-wallpaper-canvas">
          <svg viewBox={viewBox} className="pr-wallpaper-svg">
            {/* For each copy, render rhombus outline + filled regions + edges */}
            {copies.map(({ index, frame }) => {
              const key = `${index.tx},${index.ty},${index.r}`;
              const fillColor = indexToColor(index.tx, index.ty, index.r, 0.45);
              const strokeColor = indexToColor(index.tx, index.ty, index.r, 0.7);

              return (
                <g key={key}>
                  {/* Rhombus outline */}
                  <path
                    d={getRhombusPathString(frame)}
                    fill="none"
                    stroke="rgba(255,255,255,0.08)"
                    strokeWidth="0.5"
                  />

                  {/* Filled regions colored by copy */}
                  {paperRegions.map((region, rIdx) => (
                    <path
                      key={`${key}-r${rIdx}`}
                      d={paperPolygonToPath(region.polygon, frame)}
                      fill={fillColor}
                      stroke={strokeColor}
                      strokeWidth="0.5"
                    />
                  ))}

                  {/* Edge curves drawn on top */}
                  {floatEdges.map((edge, eIdx) => (
                    <path
                      key={`${key}-e${eIdx}`}
                      d={generateEdgePath(edge, frame)}
                      fill="none"
                      stroke="rgba(255,255,255,0.6)"
                      strokeWidth="1"
                      strokeLinecap="round"
                    />
                  ))}
                </g>
              );
            })}
          </svg>
        </div>

        <div className="pr-wallpaper-controls">
          <p>{copies.length} copies (3n², n={n})</p>
          <div className="pr-wallpaper-slider">
            <label htmlFor="n-slider">Grid size (n):</label>
            <input
              id="n-slider"
              type="range"
              min="1"
              max="5"
              value={n}
              onChange={(e) => setN(parseInt(e.target.value, 10))}
            />
            <span className="pr-wallpaper-n-value">{n}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ParallelRegionsWallpaperViewer;
