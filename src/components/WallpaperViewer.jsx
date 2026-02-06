import { useMemo } from 'react';
import { 
  createIdentityFrame, 
  applyReferenceFrame,
  updateReferenceFrameForSide,
  pointToScreenSpace,
  NE_CORNER,
  NW_CORNER,
  SE_CORNER,
  SW_CORNER
} from '../utils/wallpaperGeometry.js';
import { isInteriorPoint } from '../utils/geometry.js';
import './WallpaperViewer.css';

/**
 * Generate SVG path string for all edges rendered in a given reference frame.
 * This shows the full original path as it would appear in each rhombus copy.
 * @param {Array} edges - Array of edge objects with from/to points
 * @param {Object} frame - Reference frame to transform points into
 * @returns {string} - SVG path string
 */
function generateAllEdgesPathString(edges, frame) {
  if (edges.length === 0) return '';
  
  const pathParts = [];
  
  for (const edge of edges) {
    const fromPt = pointToScreenSpace(edge.from, frame);
    const toPt = pointToScreenSpace(edge.to, frame);
    pathParts.push(`M ${fromPt.x} ${fromPt.y} L ${toPt.x} ${toPt.y}`);
  }
  
  return pathParts.join(' ');
}

// Tolerance for comparing frame positions (to handle floating point errors)
const FRAME_TOLERANCE = 0.1;

/**
 * Create a unique key for a reference frame based on its transformation values.
 * Two frames are considered the same if their translation and rotation are equal
 * (within floating point tolerance).
 * @param {Object} frame - Reference frame { a, b, c, d, tx, ty }
 * @returns {string} - A string key representing the frame's position
 */
function getFrameKey(frame) {
  // Round to reasonable precision to handle floating point errors
  const round = (v) => Math.round(v / FRAME_TOLERANCE) * FRAME_TOLERANCE;
  return `${round(frame.a)},${round(frame.b)},${round(frame.c)},${round(frame.d)},${round(frame.tx)},${round(frame.ty)}`;
}

/**
 * Deduplicate rhombus frames to avoid rendering the same position multiple times.
 * This prevents brightness stacking from overlapping semi-transparent elements.
 * @param {Array} frames - Array of reference frame objects
 * @returns {Array} - Deduplicated array of frames
 */
function deduplicateFrames(frames) {
  const seen = new Set();
  const unique = [];
  
  for (const frame of frames) {
    const key = getFrameKey(frame);
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(frame);
    }
  }
  
  return unique;
}

/**
 * Generate the wallpaper data: path points and rhombus frames visited.
 * @param {Array} edges - Array of edge objects with from/to points
 * @returns {{ pathPoints: Array, rhombusFrames: Array }}
 */
function generateWallpaperData(edges) {
  if (edges.length === 0) return { pathPoints: [], rhombusFrames: [] };
  
  const pathPoints = [];
  const rhombusFrames = []; // Each frame represents one rhombus instance
  let currentFrame = createIdentityFrame();
  
  // Add the first rhombus
  rhombusFrames.push({ ...currentFrame });
  
  for (let i = 0; i < edges.length; i++) {
    const edge = edges[i];
    
    // Add the starting point (except for subsequent edges where it's the same as previous end)
    if (i === 0) {
      pathPoints.push(pointToScreenSpace(edge.from, currentFrame));
    }
    
    // Add the end point
    pathPoints.push(pointToScreenSpace(edge.to, currentFrame));
    
    // If the endpoint is on a boundary, update the reference frame for the next edge
    if (!isInteriorPoint(edge.to)) {
      currentFrame = updateReferenceFrameForSide(edge.to.side, currentFrame);
      // Add this new rhombus frame (but only if there's more path to come)
      if (i < edges.length - 1) {
        rhombusFrames.push({ ...currentFrame });
      }
    }
  }
  
  return { pathPoints, rhombusFrames };
}

/**
 * Transform the rhombus corners using a reference frame.
 */
function getRhombusCorners(frame) {
  return {
    ne: applyReferenceFrame(NE_CORNER.x, NE_CORNER.y, frame),
    nw: applyReferenceFrame(NW_CORNER.x, NW_CORNER.y, frame),
    se: applyReferenceFrame(SE_CORNER.x, SE_CORNER.y, frame),
    sw: applyReferenceFrame(SW_CORNER.x, SW_CORNER.y, frame)
  };
}

/**
 * Get the SVG path string for a rhombus in a given reference frame.
 */
function getRhombusPathString(frame) {
  const corners = getRhombusCorners(frame);
  return `M ${corners.nw.x} ${corners.nw.y} L ${corners.ne.x} ${corners.ne.y} L ${corners.se.x} ${corners.se.y} L ${corners.sw.x} ${corners.sw.y} Z`;
}

/**
 * Get the position and rotation for the "N" marker on the north edge.
 */
function getNorthMarkerInfo(frame) {
  const corners = getRhombusCorners(frame);
  
  // Position: midpoint of north edge
  const x = (corners.nw.x + corners.ne.x) / 2;
  const y = (corners.nw.y + corners.ne.y) / 2;
  
  // Calculate rotation angle based on the north edge direction
  const dx = corners.ne.x - corners.nw.x;
  const dy = corners.ne.y - corners.nw.y;
  const angle = Math.atan2(dy, dx) * 180 / Math.PI;
  
  return { x, y, angle };
}

/**
 * WallpaperViewer component - renders the path unfolded on R² with reference rhombi.
 * @param {Object[]} edges - Array of edge objects defining the path
 * @param {function} onClose - Callback to close the viewer
 */
function WallpaperViewer({ edges, onClose }) {
  // Generate wallpaper data
  const { pathPoints, rhombusFrames } = useMemo(() => 
    generateWallpaperData(edges), 
    [edges]
  );
  
  // Deduplicate rhombus frames to avoid brightness stacking from overlapping elements
  const uniqueRhombusFrames = useMemo(() => 
    deduplicateFrames(rhombusFrames),
    [rhombusFrames]
  );
  
  // Calculate bounding box with padding
  const viewBox = useMemo(() => {
    if (pathPoints.length === 0 && uniqueRhombusFrames.length === 0) {
      return '-400 -400 800 800';
    }
    
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    
    // Include all path points
    for (const pt of pathPoints) {
      minX = Math.min(minX, pt.x);
      minY = Math.min(minY, pt.y);
      maxX = Math.max(maxX, pt.x);
      maxY = Math.max(maxY, pt.y);
    }
    
    // Include all rhombus corners
    for (const frame of uniqueRhombusFrames) {
      const corners = getRhombusCorners(frame);
      for (const corner of [corners.ne, corners.nw, corners.se, corners.sw]) {
        minX = Math.min(minX, corner.x);
        minY = Math.min(minY, corner.y);
        maxX = Math.max(maxX, corner.x);
        maxY = Math.max(maxY, corner.y);
      }
    }
    
    // Add padding
    const padding = 60;
    minX -= padding;
    minY -= padding;
    maxX += padding;
    maxY += padding;
    
    const width = maxX - minX;
    const height = maxY - minY;
    
    return `${minX} ${minY} ${width} ${height}`;
  }, [pathPoints, uniqueRhombusFrames]);
  
  // Create path string for the trajectory
  const pathString = useMemo(() => {
    if (pathPoints.length < 2) return '';
    return pathPoints.map((pt, i) => 
      `${i === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`
    ).join(' ');
  }, [pathPoints]);
  
  return (
    <div className="wallpaper-viewer-overlay">
      <div className="wallpaper-viewer-container">
        <div className="wallpaper-viewer-header">
          <h2>P3 Wallpaper View</h2>
          <button onClick={onClose} className="wallpaper-close-btn">×</button>
        </div>
        
        <div className="wallpaper-canvas-container">
          <svg viewBox={viewBox} className="wallpaper-svg">
            {/* Draw rhombi first (subtle background) - deduplicated to avoid brightness stacking */}
            {uniqueRhombusFrames.map((frame, index) => {
              const markerInfo = getNorthMarkerInfo(frame);
              const ghostPathString = generateAllEdgesPathString(edges, frame);
              return (
                <g key={index} className="rhombus-instance">
                  {/* Rhombus outline */}
                  <path 
                    d={getRhombusPathString(frame)} 
                    className="rhombus-outline"
                  />
                  
                  {/* Ghost paths - all edges shown in subtle gray */}
                  {ghostPathString && (
                    <path 
                      d={ghostPathString}
                      className="ghost-path"
                      fill="none"
                    />
                  )}
                  
                  {/* North marker "N" */}
                  <text
                    x={markerInfo.x}
                    y={markerInfo.y}
                    transform={`rotate(${markerInfo.angle}, ${markerInfo.x}, ${markerInfo.y})`}
                    className="north-marker"
                    textAnchor="middle"
                    dominantBaseline="central"
                  >
                    N
                  </text>
                </g>
              );
            })}
            
            {/* Draw the path trajectory */}
            {pathString && (
              <path 
                d={pathString}
                className="trajectory-line"
                fill="none"
              />
            )}
            
            {/* Draw path vertices */}
            {pathPoints.map((pt, index) => {
              const isStart = index === 0;
              const isEnd = index === pathPoints.length - 1;
              const radius = (isStart || isEnd) ? 8 : 5;
              const className = isStart ? 'trajectory-start' : 
                               isEnd ? 'trajectory-end' : 
                               'trajectory-point';
              return (
                <circle
                  key={index}
                  cx={pt.x}
                  cy={pt.y}
                  r={radius}
                  className={className}
                />
              );
            })}
            
            {/* Draw direction arrows along the path */}
            {pathPoints.length >= 2 && pathPoints.slice(0, -1).map((pt, index) => {
              const nextPt = pathPoints[index + 1];
              const midX = (pt.x + nextPt.x) / 2;
              const midY = (pt.y + nextPt.y) / 2;
              const dx = nextPt.x - pt.x;
              const dy = nextPt.y - pt.y;
              const angle = Math.atan2(dy, dx) * 180 / Math.PI;
              
              // Only draw arrows for every other segment to avoid clutter
              if (index % 2 !== 0) return null;
              
              return (
                <polygon
                  key={`arrow-${index}`}
                  points="0,-4 8,0 0,4"
                  transform={`translate(${midX}, ${midY}) rotate(${angle})`}
                  className="trajectory-arrow"
                />
              );
            })}
          </svg>
        </div>
        
        <div className="wallpaper-info">
          <p>
            Path unfolded onto R² • {pathPoints.length} points • {uniqueRhombusFrames.length} unique {uniqueRhombusFrames.length === 1 ? 'rhombus' : 'rhombi'}
          </p>
        </div>
      </div>
    </div>
  );
}

export default WallpaperViewer;
