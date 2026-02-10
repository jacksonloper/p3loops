import { useState, useMemo } from 'react';
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
import { 
  createIdentityWallpaperIndex,
  updateWallpaperIndex,
  formatWallpaperIndex
} from '../utils/moveTree.js';
import { isInteriorPoint, getIdentifiedSide, EPSILON } from '../utils/geometry.js';
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
 * Check if an edge is a same-side edge (stays within the same rhombus).
 * An edge stays in the same rhombus if:
 * 1. Both endpoints are on the SAME side (e.g., north→north)
 * 2. Both endpoints are on IDENTIFIED sides AND at the SAME t value (within tolerance)
 *    (e.g., north(0.5)→east(0.5) represents the same point and doesn't cross)
 * 
 * If the endpoints are on identified sides but at DIFFERENT t values, the edge
 * actually crosses the rhombus interior and enters a new rhombus.
 * 
 * @param {Object} edge - Edge object with from/to points
 * @returns {boolean} - True if the edge stays within the same rhombus
 */
function isSameSideEdge(edge) {
  if (isInteriorPoint(edge.from) || isInteriorPoint(edge.to)) {
    return false;
  }
  
  const fromSide = edge.from.side;
  const toSide = edge.to.side;
  const fromT = edge.from.t;
  const toT = edge.to.t;
  
  // Same literal side - always stays in same rhombus
  if (fromSide === toSide) {
    return true;
  }
  
  // Check for identified sides (north↔east, south↔west)
  // Only treat as same-side if the t values are equal (same point via identification)
  if (getIdentifiedSide(fromSide) === toSide && Math.abs(fromT - toT) < EPSILON) {
    return true;
  }
  
  return false;
}

/**
 * Generate the wallpaper data: path points, rhombus frames visited, and their indices.
 * 
 * Handles identified sides correctly: when the path crosses a boundary,
 * the next edge's start point is at the same geometric position as the
 * previous edge's end point, even if they're on identified sides.
 * 
 * @param {Array} edges - Array of edge objects with from/to points
 * @param {number} repeats - Number of times to repeat the path (for closed loops)
 * @returns {{ pathPoints: Array, rhombusFrames: Array, rhombusIndices: Array }}
 */
function generateWallpaperData(edges, repeats = 1) {
  if (edges.length === 0) return { pathPoints: [], rhombusFrames: [], rhombusIndices: [] };
  
  const pathPoints = [];
  const rhombusFrames = []; // Each frame represents one rhombus instance
  const rhombusIndices = []; // Wallpaper indices for each rhombus
  let currentFrame = createIdentityFrame();
  let currentIndex = createIdentityWallpaperIndex();
  // Track the "continuation side" - when crossing boundaries, we may need to
  // draw the next edge's start point using the identified side's geometry
  let lastEndSide = null;
  let lastEndT = null;
  
  // Add the first rhombus
  rhombusFrames.push({ ...currentFrame });
  rhombusIndices.push({ ...currentIndex });
  
  // Repeat the path `repeats` times
  for (let rep = 0; rep < repeats; rep++) {
    for (let i = 0; i < edges.length; i++) {
      const edge = edges[i];
      
      // Add the starting point
      if (rep === 0 && i === 0) {
        // First edge of first repeat - use the from point directly
        pathPoints.push(pointToScreenSpace(edge.from, currentFrame));
      } else {
        // For subsequent edges, we already added the end point of the previous edge.
        // But if this edge starts on an identified side (different from the previous end),
        // we should NOT add a new point because it's geometrically the same position.
        // The path should be continuous.
        
        // Skip this logic for interior points or when we don't have previous side info
        if (isInteriorPoint(edge.from) || lastEndSide === null) {
          // Interior point or no previous side - add the from point
          pathPoints.push(pointToScreenSpace(edge.from, currentFrame));
        } else {
          const fromSide = edge.from.side;
          const fromT = edge.from.t;
          
          // Check if the from point is the same as the last end point (possibly via identification)
          const sameSide = fromSide === lastEndSide;
          const identifiedSide = getIdentifiedSide(lastEndSide) === fromSide;
          const sameT = lastEndT !== null && Math.abs(fromT - lastEndT) < EPSILON;
          
          // If they're not at the same position (even considering identification), 
          // we have a discontinuous path - add the from point
          if (!((sameSide || identifiedSide) && sameT)) {
            pathPoints.push(pointToScreenSpace(edge.from, currentFrame));
          }
          // Otherwise, skip adding the from point since it's the same as the last end point
        }
      }
      
      // Determine how to draw the endpoint
      // If this is a same-side edge AND we entered from the identified side,
      // we need to convert the to point to use the continuation side for proper visualization
      let toPointForDrawing = edge.to;
      
      // Check if this edge is same-side but the sides are identified
      // (e.g., edge.from.side is 'east' but we entered from 'north')
      // In this case, we should draw using the north geometry to stay consistent
      if (isSameSideEdge(edge) && lastEndSide !== null) {
        const edgeFromSide = edge.from.side;
        const expectedContinuationSide = getIdentifiedSide(lastEndSide);
        
        // If we entered from lastEndSide, and this edge is on the identified side,
        // convert the to point to use the lastEndSide for drawing
        if (edgeFromSide === expectedContinuationSide && edgeFromSide !== lastEndSide) {
          // The edge is on the identified side - convert to use lastEndSide
          // Since this is a same-side edge, to.side === from.side
          // We should draw it using lastEndSide instead
          toPointForDrawing = { side: lastEndSide, t: edge.to.t };
        }
      }
      
      // Add the end point
      pathPoints.push(pointToScreenSpace(toPointForDrawing, currentFrame));
      
      // Track the last endpoint (only for boundary points)
      if (!isInteriorPoint(toPointForDrawing)) {
        lastEndSide = toPointForDrawing.side;
        lastEndT = toPointForDrawing.t;
      } else {
        // Interior point - reset tracking since we can't continue via identification
        lastEndSide = null;
        lastEndT = null;
      }
      
      // If the endpoint is on a boundary AND this is not a same-side edge,
      // we might need to update the reference frame for the next edge.
      // Same-side edges walk along the boundary without crossing into a new rhombus.
      if (!isInteriorPoint(edge.to) && !isSameSideEdge(edge)) {
        // Check if the next edge is a same-side edge
        const isLastEdgeOfLastRepeat = (rep === repeats - 1 && i === edges.length - 1);
        const nextEdgeIndex = (i + 1) % edges.length;
        const nextEdge = edges[nextEdgeIndex];
        const nextEdgeIsSameSide = isSameSideEdge(nextEdge);
        
        // Only update the frame if the next edge is NOT a same-side edge.
        // If the next edge is same-side, it stays in the current rhombus.
        if (!nextEdgeIsSameSide) {
          currentFrame = updateReferenceFrameForSide(edge.to.side, currentFrame);
          currentIndex = updateWallpaperIndex(edge.to.side, currentIndex);
          
          // Add this new rhombus frame only if this is not the last edge
          if (!isLastEdgeOfLastRepeat) {
            rhombusFrames.push({ ...currentFrame });
            rhombusIndices.push({ ...currentIndex });
          }
        }
      }
    }
  }
  
  return { pathPoints, rhombusFrames, rhombusIndices };
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
 * Get the center point of a rhombus in a given reference frame.
 */
function getRhombusCenter(frame) {
  const corners = getRhombusCorners(frame);
  return {
    x: (corners.ne.x + corners.nw.x + corners.se.x + corners.sw.x) / 4,
    y: (corners.ne.y + corners.nw.y + corners.se.y + corners.sw.y) / 4
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

// Default number of repeats for closed loops
const DEFAULT_CLOSED_LOOP_REPEATS = 2;

/**
 * WallpaperViewer component - renders the path unfolded on R² with reference rhombi.
 * @param {Object[]} edges - Array of edge objects defining the path
 * @param {boolean} isLoopClosed - Whether the loop is closed
 * @param {function} onClose - Callback to close the viewer
 */
function WallpaperViewer({ edges, isLoopClosed = false, onClose }) {
  // State for number of repeats (only applies when loop is closed)
  // Note: The viewer is mounted fresh each time it's opened, so initial state
  // correctly reflects the isLoopClosed prop at mount time.
  const [repeats, setRepeats] = useState(isLoopClosed ? DEFAULT_CLOSED_LOOP_REPEATS : 1);
  
  // Effective repeats: must be 1 if loop is open
  const effectiveRepeats = isLoopClosed ? repeats : 1;
  
  // Generate wallpaper data
  const { pathPoints, rhombusFrames, rhombusIndices } = useMemo(() => 
    generateWallpaperData(edges, effectiveRepeats), 
    [edges, effectiveRepeats]
  );
  
  // Deduplicate rhombus frames (with indices) to avoid brightness stacking
  const uniqueRhombi = useMemo(() => {
    const seen = new Set();
    const unique = [];
    
    for (let i = 0; i < rhombusFrames.length; i++) {
      const frame = rhombusFrames[i];
      const index = rhombusIndices[i];
      const key = getFrameKey(frame);
      if (!seen.has(key)) {
        seen.add(key);
        unique.push({ frame, index });
      }
    }
    
    return unique;
  }, [rhombusFrames, rhombusIndices]);
  
  // Calculate bounding box with padding
  const viewBox = useMemo(() => {
    if (pathPoints.length === 0 && uniqueRhombi.length === 0) {
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
    for (const { frame } of uniqueRhombi) {
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
  }, [pathPoints, uniqueRhombi]);
  
  // Create path string for the trajectory
  const pathString = useMemo(() => {
    if (pathPoints.length < 2) return '';
    return pathPoints.map((pt, i) => 
      `${i === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`
    ).join(' ');
  }, [pathPoints]);
  
  return (
    <div className="wallpaper-viewer-overlay" onClick={onClose}>
      <div className="wallpaper-viewer-container" onClick={(e) => e.stopPropagation()}>
        <div className="wallpaper-viewer-header">
          <h2>P3 Wallpaper View</h2>
          <button onClick={onClose} className="wallpaper-close-btn">×</button>
        </div>
        
        <div className="wallpaper-canvas-container">
          <svg viewBox={viewBox} className="wallpaper-svg">
            {/* Draw rhombi first (subtle background) - deduplicated to avoid brightness stacking */}
            {uniqueRhombi.map(({ frame, index: rhombusIndex }, i) => {
              const markerInfo = getNorthMarkerInfo(frame);
              const center = getRhombusCenter(frame);
              const ghostPathString = generateAllEdgesPathString(edges, frame);
              const indexLabel = formatWallpaperIndex(rhombusIndex);
              return (
                <g key={i} className="rhombus-instance">
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
                  
                  {/* Rhombus index label at center */}
                  <text
                    x={center.x}
                    y={center.y}
                    className="rhombus-index-label"
                      textAnchor="middle"
                      dominantBaseline="central"
                    >
                      {indexLabel}
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
            Path unfolded onto R² • {pathPoints.length} points • {uniqueRhombi.length} unique {uniqueRhombi.length === 1 ? 'rhombus' : 'rhombi'}
            {isLoopClosed && ` • ${effectiveRepeats} repeat${effectiveRepeats === 1 ? '' : 's'}`}
          </p>
          
          {isLoopClosed && (
            <div className="repeats-control">
              <label htmlFor="repeats-slider">Loop Repeats:</label>
              <input
                id="repeats-slider"
                type="range"
                min="1"
                max="5"
                value={repeats}
                onChange={(e) => setRepeats(parseInt(e.target.value, 10))}
              />
              <span className="repeats-value">{repeats}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default WallpaperViewer;
