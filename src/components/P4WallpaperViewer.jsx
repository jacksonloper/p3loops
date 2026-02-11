import { useState, useMemo } from 'react';
import { 
  createIdentityFrame, 
  applyReferenceFrame,
  updateReferenceFrameForSide,
  pointToScreenSpace,
  paperToTrueSquare,
  createIdentityWallpaperIndex,
  updateWallpaperIndex,
  formatWallpaperIndex,
  indexToFrame,
  NE_CORNER,
  NW_CORNER,
  SE_CORNER,
  SW_CORNER
} from '../utils/p4WallpaperGeometry.js';
import { isInteriorPoint, getIdentifiedSide, EPSILON, getEdgeSamplePointsPaper } from '../utils/geometry.js';
import './WallpaperViewer.css';

// Number of sample points per edge for diffeomorphism-based curved rendering
const EDGE_SAMPLES = 20;

/**
 * Generate SVG path string for a single edge using diffeomorphism-based curved path.
 * @param {Object} edge - Edge object with from/to points
 * @param {Object} frame - Reference frame to transform points into
 * @returns {string} - SVG path string (M followed by L commands for sampled points)
 */
function generateCurvedEdgePath(edge, frame) {
  // For boundary-to-boundary edges, use the diffeomorphism
  if (!isInteriorPoint(edge.from) && !isInteriorPoint(edge.to)) {
    const samplePoints = getEdgeSamplePointsPaper(
      edge.from.side,
      edge.from.t,
      edge.to.side,
      edge.to.t,
      EDGE_SAMPLES
    );
    
    // Convert paper coords to screen space using the frame
    const screenPoints = samplePoints.map(pt => {
      const localScreen = paperToTrueSquare(pt.southward, pt.eastward);
      return applyReferenceFrame(localScreen.x, localScreen.y, frame);
    });
    
    if (screenPoints.length < 2) return '';
    
    // Build path: M for first point, L for subsequent points
    let path = `M ${screenPoints[0].x} ${screenPoints[0].y}`;
    for (let i = 1; i < screenPoints.length; i++) {
      path += ` L ${screenPoints[i].x} ${screenPoints[i].y}`;
    }
    return path;
  } else {
    // For edges involving interior points, use straight line
    const fromPt = pointToScreenSpace(edge.from, frame);
    const toPt = pointToScreenSpace(edge.to, frame);
    return `M ${fromPt.x} ${fromPt.y} L ${toPt.x} ${toPt.y}`;
  }
}

/**
 * Generate SVG path string for all edges rendered in a given reference frame.
 * This shows the full original path as it would appear in each square copy.
 * Uses diffeomorphism-based curved paths for non-intersecting visualization.
 * @param {Array} edges - Array of edge objects with from/to points
 * @param {Object} frame - Reference frame to transform points into
 * @returns {string} - SVG path string
 */
function generateAllEdgesPathString(edges, frame) {
  if (edges.length === 0) return '';
  
  const pathParts = [];
  
  for (const edge of edges) {
    pathParts.push(generateCurvedEdgePath(edge, frame));
  }
  
  return pathParts.join(' ');
}

/**
 * Check if an edge is a same-side edge (stays within the same square).
 * An edge stays in the same square if:
 * 1. Both endpoints are on the SAME side (e.g., north→north)
 * 2. Both endpoints are on IDENTIFIED sides AND at the SAME t value (within tolerance)
 *    (e.g., north(0.5)→east(0.5) represents the same point and doesn't cross)
 * 
 * If the endpoints are on identified sides but at DIFFERENT t values, the edge
 * actually crosses the square interior and enters a new square.
 * 
 * @param {Object} edge - Edge object with from/to points
 * @returns {boolean} - True if the edge stays within the same square
 */
function isSameSideEdge(edge) {
  if (isInteriorPoint(edge.from) || isInteriorPoint(edge.to)) {
    return false;
  }
  
  const fromSide = edge.from.side;
  const toSide = edge.to.side;
  const fromT = edge.from.t;
  const toT = edge.to.t;
  
  // Same literal side - always stays in same square
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
 * Generate the wallpaper data: path points, square frames visited, and their indices.
 * 
 * Handles identified sides correctly: when the path crosses a boundary,
 * the next edge's start point is at the same geometric position as the
 * previous edge's end point, even if they're on identified sides.
 * 
 * @param {Array} edges - Array of edge objects with from/to points
 * @param {number} repeats - Number of times to repeat the path (for closed loops)
 * @returns {{ pathPoints: Array, squareFrames: Array, squareIndices: Array, vertexIndices: Array }}
 */
function generateWallpaperData(edges, repeats = 1) {
  if (edges.length === 0) return { pathPoints: [], squareFrames: [], squareIndices: [], vertexIndices: [] };
  
  const pathPoints = [];
  const vertexIndices = []; // Indices in pathPoints that are actual edge vertices (not intermediate samples)
  const squareFrames = []; // Each frame represents one square instance
  const squareIndices = []; // Wallpaper indices for each square
  let currentFrame = createIdentityFrame();
  let currentIndex = createIdentityWallpaperIndex();
  // Track the "continuation side" - when crossing boundaries, we may need to
  // draw the next edge's start point using the identified side's geometry
  let lastEndSide = null;
  let lastEndT = null;
  
  // Add the first square
  squareFrames.push({ ...currentFrame });
  squareIndices.push({ ...currentIndex });
  
  // Repeat the path `repeats` times
  for (let rep = 0; rep < repeats; rep++) {
    for (let i = 0; i < edges.length; i++) {
      const edge = edges[i];
      
      // Add the starting point (and track as vertex)
      if (rep === 0 && i === 0) {
        // First edge of first repeat - use the from point directly
        vertexIndices.push(pathPoints.length);
        pathPoints.push(pointToScreenSpace(edge.from, currentFrame));
      } else {
        // For subsequent edges, we already added the end point of the previous edge.
        // But if this edge starts on an identified side (different from the previous end),
        // we should NOT add a new point because it's geometrically the same position.
        // The path should be continuous.
        
        // Skip this logic for interior points or when we don't have previous side info
        if (isInteriorPoint(edge.from) || lastEndSide === null) {
          // Interior point or no previous side - add the from point
          vertexIndices.push(pathPoints.length);
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
            vertexIndices.push(pathPoints.length);
            pathPoints.push(pointToScreenSpace(edge.from, currentFrame));
          }
          // Otherwise, skip adding the from point since it's the same as the last end point
        }
      }
      
      // Draw the endpoint
      // Note: We draw the edge using the original edge coordinates UNLESS
      // the edge connects two identified points at the same t value.
      // In that case, we convert to use the same physical side to avoid
      // drawing a line across the square (which would be wrong since
      // the two points are geometrically the same).
      let toPointForDrawing = edge.to;
      let fromSideForCurve = edge.from.side;
      
      // Check if this is a same-point edge (identified sides at same t)
      if (!isInteriorPoint(edge.from) && !isInteriorPoint(edge.to)) {
        if (getIdentifiedSide(edge.from.side) === edge.to.side) {
          if (Math.abs(edge.from.t - edge.to.t) < EPSILON) {
            // This is a zero-length edge connecting the same geometric point.
            // Convert both sides to use the from.side so the edge appears as a point.
            toPointForDrawing = { side: edge.from.side, t: edge.to.t };
            // fromSideForCurve is already edge.from.side, so no change needed
          }
        }
      }
      
      // Add intermediate sample points along the edge using diffeomorphism
      // (only for boundary-to-boundary edges)
      if (!isInteriorPoint(edge.from) && !isInteriorPoint(toPointForDrawing)) {
        const samplePoints = getEdgeSamplePointsPaper(
          fromSideForCurve,
          edge.from.t,
          toPointForDrawing.side,
          toPointForDrawing.t,
          EDGE_SAMPLES
        );
        
        // Add intermediate points (skip first and last - they're the endpoints)
        for (let j = 1; j < samplePoints.length - 1; j++) {
          const pt = samplePoints[j];
          const localScreen = paperToTrueSquare(pt.southward, pt.eastward);
          pathPoints.push(applyReferenceFrame(localScreen.x, localScreen.y, currentFrame));
        }
      }
      
      // Add the end point (and track as vertex)
      vertexIndices.push(pathPoints.length);
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
      
      // Determine if we need to update the reference frame for the next edge.
      // We update the frame when:
      // 1. Crossing a boundary (non-same-side edge) to a new square, OR
      // 2. A same-side edge ends at a point where the NEXT edge starts on the
      //    identified side (transitioning from east to north at same t, etc.)
      if (!isInteriorPoint(edge.to)) {
        const isLastEdgeOfLastRepeat = (rep === repeats - 1 && i === edges.length - 1);
        const nextEdgeIndex = (i + 1) % edges.length;
        const nextEdge = edges[nextEdgeIndex];
        
        let shouldUpdateFrame = false;
        
        if (!isSameSideEdge(edge)) {
          // Current edge crosses the square (not same-side)
          // We update the frame UNLESS the next edge is same-side AND starts on 
          // the same PHYSICAL side as where we ended
          const nextEdgeStartsSamePhysicalSide = !isInteriorPoint(nextEdge.from) && 
                                                  nextEdge.from.side === edge.to.side;
          const nextEdgeIsSameSide = isSameSideEdge(nextEdge);
          
          shouldUpdateFrame = !(nextEdgeIsSameSide && nextEdgeStartsSamePhysicalSide);
        } else {
          // Current edge is same-side (walks along boundary)
          // We still need to update the frame if the NEXT edge starts on the
          // IDENTIFIED side at the same t value (transitioning from east to north, etc.)
          if (!isInteriorPoint(nextEdge.from) && !isInteriorPoint(edge.to)) {
            const edgeEndsSide = edge.to.side;
            const nextStartsSide = nextEdge.from.side;
            const edgeEndsT = edge.to.t;
            const nextStartsT = nextEdge.from.t;
            
            // Check if transitioning from one side to its identified counterpart at same t
            if (edgeEndsSide !== nextStartsSide && 
                getIdentifiedSide(edgeEndsSide) === nextStartsSide &&
                Math.abs(edgeEndsT - nextStartsT) < EPSILON) {
              // Transitioning from edge.to.side to its identified side
              // This requires a frame update
              shouldUpdateFrame = true;
            }
          }
        }
        
        if (shouldUpdateFrame) {
          currentFrame = updateReferenceFrameForSide(edge.to.side, currentFrame);
          // Use algebraic index update for consistency with the grid
          currentIndex = updateWallpaperIndex(edge.to.side, currentIndex);
          
          // Add this new square frame only if this is not the last edge
          if (!isLastEdgeOfLastRepeat) {
            squareFrames.push({ ...currentFrame });
            squareIndices.push({ ...currentIndex });
          }
        }
      }
    }
  }
  
  return { pathPoints, squareFrames, squareIndices, vertexIndices };
}

/**
 * Transform the square corners using a reference frame.
 */
function getSquareCorners(frame) {
  return {
    ne: applyReferenceFrame(NE_CORNER.x, NE_CORNER.y, frame),
    nw: applyReferenceFrame(NW_CORNER.x, NW_CORNER.y, frame),
    se: applyReferenceFrame(SE_CORNER.x, SE_CORNER.y, frame),
    sw: applyReferenceFrame(SW_CORNER.x, SW_CORNER.y, frame)
  };
}

/**
 * Get the center point of a square in a given reference frame.
 */
function getSquareCenter(frame) {
  const corners = getSquareCorners(frame);
  return {
    x: (corners.ne.x + corners.nw.x + corners.se.x + corners.sw.x) / 4,
    y: (corners.ne.y + corners.nw.y + corners.se.y + corners.sw.y) / 4
  };
}

/**
 * Get the SVG path string for a square in a given reference frame.
 */
function getSquarePathString(frame) {
  const corners = getSquareCorners(frame);
  return `M ${corners.nw.x} ${corners.nw.y} L ${corners.ne.x} ${corners.ne.y} L ${corners.se.x} ${corners.se.y} L ${corners.sw.x} ${corners.sw.y} Z`;
}

/**
 * Get the position and rotation for the "N" marker on the north edge.
 */
function getNorthMarkerInfo(frame) {
  const corners = getSquareCorners(frame);
  
  // Position: midpoint of north edge
  const x = (corners.nw.x + corners.ne.x) / 2;
  const y = (corners.nw.y + corners.ne.y) / 2;
  
  // Calculate rotation angle based on the north edge direction
  const dx = corners.ne.x - corners.nw.x;
  const dy = corners.ne.y - corners.nw.y;
  const angle = Math.atan2(dy, dx) * 180 / Math.PI;
  
  return { x, y, angle };
}

// Constants for square grid generation
// Translation vectors for p4: (2*SIDE, 0) and (0, 2*SIDE)
const SIDE = 300;
const LATTICE_SPACING = 2 * SIDE; // 600 units between hexagon centers
// Safety margin to ensure we don't miss edge squares
const RANGE_SAFETY_MARGIN = 2;

/**
 * Generate all squares (i, j, k) that intersect a given bounding box.
 * Uses the indexToFrame function to convert indices to frames.
 * 
 * @param {Object} bounds - { minX, minY, maxX, maxY }
 * @param {number} margin - Extra margin around bounds for safety
 * @returns {Array} - Array of { index, frame } objects
 */
function generateAllSquaresInBounds(bounds, margin = 100) {
  const squares = [];
  
  // Expand bounds
  const expandedBounds = {
    minX: bounds.minX - margin,
    minY: bounds.minY - margin,
    maxX: bounds.maxX + margin,
    maxY: bounds.maxY + margin
  };
  
  // Calculate the maximum dimension of the bounding box
  // Used to estimate how many lattice cells we need to check
  const boundingBoxMaxExtent = Math.max(
    (expandedBounds.maxX - expandedBounds.minX),
    (expandedBounds.maxY - expandedBounds.minY)
  );
  
  // Estimate range of i, j values needed based on lattice spacing
  const iRange = Math.ceil(boundingBoxMaxExtent / LATTICE_SPACING) + RANGE_SAFETY_MARGIN;
  const jRange = Math.ceil(boundingBoxMaxExtent / LATTICE_SPACING) + RANGE_SAFETY_MARGIN;
  
  // Generate all combinations of (i, j, k)
  for (let i = -iRange; i <= iRange; i++) {
    for (let j = -jRange; j <= jRange; j++) {
      for (let k = 0; k < 4; k++) {
        const index = { tx: i, ty: j, r: k };
        const frame = indexToFrame(index);
        const center = getSquareCenter(frame);
        
        // Check if the square center is within the expanded bounds
        // (we use center as a quick filter; some edge squares might be missed)
        if (center.x >= expandedBounds.minX && center.x <= expandedBounds.maxX &&
            center.y >= expandedBounds.minY && center.y <= expandedBounds.maxY) {
          squares.push({ index, frame });
        }
      }
    }
  }
  
  return squares;
}

// Default number of repeats for closed loops
const DEFAULT_CLOSED_LOOP_REPEATS = 2;

/**
 * P4WallpaperViewer component - renders the path unfolded on R² with reference squares.
 * Uses 90° rotations and square fundamental domains (p4 wallpaper group).
 * @param {Object[]} edges - Array of edge objects defining the path
 * @param {boolean} isLoopClosed - Whether the loop is closed
 * @param {function} onClose - Callback to close the viewer
 */
function P4WallpaperViewer({ edges, isLoopClosed = false, onClose }) {
  // State for number of repeats (only applies when loop is closed)
  // Note: The viewer is mounted fresh each time it's opened, so initial state
  // correctly reflects the isLoopClosed prop at mount time.
  const [repeats, setRepeats] = useState(isLoopClosed ? DEFAULT_CLOSED_LOOP_REPEATS : 1);
  
  // Effective repeats: must be 1 if loop is open
  const effectiveRepeats = isLoopClosed ? repeats : 1;
  
  // Generate wallpaper data (path points and visited squares)
  const { pathPoints, squareFrames, squareIndices, vertexIndices } = useMemo(() => 
    generateWallpaperData(edges, effectiveRepeats), 
    [edges, effectiveRepeats]
  );
  
  // Get set of visited square keys for highlighting
  const visitedSquareKeys = useMemo(() => {
    const keys = new Set();
    for (const index of squareIndices) {
      keys.add(`${index.tx},${index.ty},${index.r}`);
    }
    return keys;
  }, [squareIndices]);
  
  // Calculate bounding box from path points first
  const bounds = useMemo(() => {
    let minX = -300, minY = -300, maxX = 300, maxY = 300;
    
    // Include all path points
    for (const pt of pathPoints) {
      minX = Math.min(minX, pt.x);
      minY = Math.min(minY, pt.y);
      maxX = Math.max(maxX, pt.x);
      maxY = Math.max(maxY, pt.y);
    }
    
    // Include visited square corners
    for (const frame of squareFrames) {
      const corners = getSquareCorners(frame);
      for (const corner of [corners.ne, corners.nw, corners.se, corners.sw]) {
        minX = Math.min(minX, corner.x);
        minY = Math.min(minY, corner.y);
        maxX = Math.max(maxX, corner.x);
        maxY = Math.max(maxY, corner.y);
      }
    }
    
    return { minX, minY, maxX, maxY };
  }, [pathPoints, squareFrames]);
  
  // Generate ALL squares that appear within the viewable area
  const allSquares = useMemo(() => {
    return generateAllSquaresInBounds(bounds);
  }, [bounds]);
  
  // Calculate view box with padding
  const viewBox = useMemo(() => {
    const padding = 60;
    const minX = bounds.minX - padding;
    const minY = bounds.minY - padding;
    const width = bounds.maxX - bounds.minX + 2 * padding;
    const height = bounds.maxY - bounds.minY + 2 * padding;
    return `${minX} ${minY} ${width} ${height}`;
  }, [bounds]);
  
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
          <h2>P4 Wallpaper View</h2>
          <button onClick={onClose} className="wallpaper-close-btn">×</button>
        </div>
        
        <div className="wallpaper-canvas-container">
          <svg viewBox={viewBox} className="wallpaper-svg">
            {/* Draw ALL squares in the viewable area */}
            {allSquares.map(({ frame, index: squareIndex }) => {
              const markerInfo = getNorthMarkerInfo(frame);
              const center = getSquareCenter(frame);
              const ghostPathString = generateAllEdgesPathString(edges, frame);
              const indexLabel = formatWallpaperIndex(squareIndex);
              const isVisited = visitedSquareKeys.has(`${squareIndex.tx},${squareIndex.ty},${squareIndex.r}`);
              
              return (
                <g key={`${squareIndex.tx},${squareIndex.ty},${squareIndex.r}`} className={`rhombus-instance ${isVisited ? 'visited' : ''}`}>
                  {/* Square outline */}
                  <path 
                    d={getSquarePathString(frame)} 
                    className={`rhombus-outline ${isVisited ? 'visited' : ''}`}
                  />
                  
                  {/* Ghost paths - all edges shown in subtle gray (only for visited squares) */}
                  {isVisited && ghostPathString && (
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
                  
                  {/* Square index label at center */}
                  <text
                    x={center.x}
                    y={center.y}
                    className={`rhombus-index-label ${isVisited ? 'visited' : ''}`}
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
            
            {/* Draw path vertices (only at actual edge endpoints, not intermediate samples) */}
            {vertexIndices.map((vertexIdx, i) => {
              const pt = pathPoints[vertexIdx];
              if (!pt) return null;
              const isStart = i === 0;
              const isEnd = i === vertexIndices.length - 1;
              const radius = (isStart || isEnd) ? 8 : 5;
              const className = isStart ? 'trajectory-start' : 
                               isEnd ? 'trajectory-end' : 
                               'trajectory-point';
              return (
                <circle
                  key={`vertex-${i}`}
                  cx={pt.x}
                  cy={pt.y}
                  r={radius}
                  className={className}
                />
              );
            })}
            
            {/* Draw direction arrows along the path (one per edge, at vertex midpoints) */}
            {vertexIndices.length >= 2 && vertexIndices.slice(0, -1).map((vertexIdx, i) => {
              const pt = pathPoints[vertexIdx];
              const nextVertexIdx = vertexIndices[i + 1];
              const nextPt = pathPoints[nextVertexIdx];
              if (!pt || !nextPt) return null;
              
              // Find the midpoint of the curve (use middle sample point between vertices)
              const midIdx = Math.floor((vertexIdx + nextVertexIdx) / 2);
              const midPt = pathPoints[midIdx];
              
              // Calculate direction at midpoint
              const prevIdx = Math.max(0, midIdx - 1);
              const nextIdx = Math.min(pathPoints.length - 1, midIdx + 1);
              const dx = pathPoints[nextIdx].x - pathPoints[prevIdx].x;
              const dy = pathPoints[nextIdx].y - pathPoints[prevIdx].y;
              const angle = Math.atan2(dy, dx) * 180 / Math.PI;
              
              // Only draw arrows for every other edge to further reduce clutter
              if (i % 2 !== 0) return null;
              
              return (
                <polygon
                  key={`arrow-${i}`}
                  points="0,-4 8,0 0,4"
                  transform={`translate(${midPt.x}, ${midPt.y}) rotate(${angle})`}
                  className="trajectory-arrow"
                />
              );
            })}
          </svg>
        </div>
        
        <div className="wallpaper-info">
          <p>
            Path unfolded onto R² (P4 symmetry) • {pathPoints.length} points • {visitedSquareKeys.size} visited squares • {allSquares.length} total displayed
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

export default P4WallpaperViewer;
