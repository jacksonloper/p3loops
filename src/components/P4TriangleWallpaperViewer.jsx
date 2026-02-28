import { useState, useMemo } from 'react';
import { 
  createIdentityFrame, 
  applyReferenceFrame,
  updateReferenceFrameForSide,
  pointToTriangleScreenSpace,
  paperToTriangle,
  createIdentityWallpaperIndex,
  updateWallpaperIndex,
  formatWallpaperIndex,
  indexToFrame,
  NW_CORNER,
  SW_CORNER,
  SE_CORNER
} from '../utils/p4WallpaperGeometry.js';
import { isInteriorPoint, getIdentifiedSide, EPSILON, getEdgeSamplePointsPaper } from '../utils/geometry.js';
import './WallpaperViewer.css';

// Number of sample points per edge for diffeomorphism-based curved rendering
const EDGE_SAMPLES = 20;

/**
 * Generate SVG path string for a single edge using diffeomorphism-based curved path,
 * mapped through the triangle diffeomorphism.
 */
function generateCurvedEdgePath(edge, frame) {
  if (!isInteriorPoint(edge.from) && !isInteriorPoint(edge.to)) {
    const samplePoints = getEdgeSamplePointsPaper(
      edge.from.side,
      edge.from.t,
      edge.to.side,
      edge.to.t,
      EDGE_SAMPLES
    );
    
    const screenPoints = samplePoints.map(pt => {
      const localScreen = paperToTriangle(pt.southward, pt.eastward);
      return applyReferenceFrame(localScreen.x, localScreen.y, frame);
    });
    
    if (screenPoints.length < 2) return '';
    
    let path = `M ${screenPoints[0].x} ${screenPoints[0].y}`;
    for (let i = 1; i < screenPoints.length; i++) {
      path += ` L ${screenPoints[i].x} ${screenPoints[i].y}`;
    }
    return path;
  } else {
    const fromPt = pointToTriangleScreenSpace(edge.from, frame);
    const toPt = pointToTriangleScreenSpace(edge.to, frame);
    return `M ${fromPt.x} ${fromPt.y} L ${toPt.x} ${toPt.y}`;
  }
}

/**
 * Generate SVG path string for all edges rendered in a given reference frame.
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
 */
function isSameSideEdge(edge) {
  if (isInteriorPoint(edge.from) || isInteriorPoint(edge.to)) {
    return false;
  }
  
  const fromSide = edge.from.side;
  const toSide = edge.to.side;
  const fromT = edge.from.t;
  const toT = edge.to.t;
  
  if (fromSide === toSide) {
    return true;
  }
  
  if (getIdentifiedSide(fromSide) === toSide && Math.abs(fromT - toT) < EPSILON) {
    return true;
  }
  
  return false;
}

/**
 * Generate the wallpaper data using triangle diffeomorphism.
 * Computes visited frames and bounding box. Path points use triangle mapping.
 */
function generateWallpaperData(edges, repeats = 1) {
  if (edges.length === 0) return { pathPoints: [], squareFrames: [], squareIndices: [] };
  
  const pathPoints = [];
  const squareFrames = [];
  const squareIndices = [];
  let currentFrame = createIdentityFrame();
  let currentIndex = createIdentityWallpaperIndex();
  let lastEndSide = null;
  let lastEndT = null;
  
  squareFrames.push({ ...currentFrame });
  squareIndices.push({ ...currentIndex });
  
  for (let rep = 0; rep < repeats; rep++) {
    for (let i = 0; i < edges.length; i++) {
      const edge = edges[i];
      
      // Add the starting point
      if (rep === 0 && i === 0) {
        pathPoints.push(pointToTriangleScreenSpace(edge.from, currentFrame));
      } else {
        if (isInteriorPoint(edge.from) || lastEndSide === null) {
          pathPoints.push(pointToTriangleScreenSpace(edge.from, currentFrame));
        } else {
          const fromSide = edge.from.side;
          const fromT = edge.from.t;
          const sameSide = fromSide === lastEndSide;
          const identifiedSide = getIdentifiedSide(lastEndSide) === fromSide;
          const sameT = lastEndT !== null && Math.abs(fromT - lastEndT) < EPSILON;
          
          if (!((sameSide || identifiedSide) && sameT)) {
            pathPoints.push(pointToTriangleScreenSpace(edge.from, currentFrame));
          }
        }
      }
      
      let toPointForDrawing = edge.to;
      
      if (!isInteriorPoint(edge.from) && !isInteriorPoint(edge.to)) {
        if (getIdentifiedSide(edge.from.side) === edge.to.side) {
          if (Math.abs(edge.from.t - edge.to.t) < EPSILON) {
            toPointForDrawing = { side: edge.from.side, t: edge.to.t };
          }
        }
      }
      
      // Add intermediate sample points using triangle mapping
      if (!isInteriorPoint(edge.from) && !isInteriorPoint(toPointForDrawing)) {
        const samplePoints = getEdgeSamplePointsPaper(
          edge.from.side,
          edge.from.t,
          toPointForDrawing.side,
          toPointForDrawing.t,
          EDGE_SAMPLES
        );
        
        for (let j = 1; j < samplePoints.length - 1; j++) {
          const pt = samplePoints[j];
          const localScreen = paperToTriangle(pt.southward, pt.eastward);
          pathPoints.push(applyReferenceFrame(localScreen.x, localScreen.y, currentFrame));
        }
      }
      
      pathPoints.push(pointToTriangleScreenSpace(toPointForDrawing, currentFrame));
      
      if (!isInteriorPoint(toPointForDrawing)) {
        lastEndSide = toPointForDrawing.side;
        lastEndT = toPointForDrawing.t;
      } else {
        lastEndSide = null;
        lastEndT = null;
      }
      
      // Update reference frame (same logic as square viewer)
      if (!isInteriorPoint(edge.to)) {
        const isLastEdgeOfLastRepeat = (rep === repeats - 1 && i === edges.length - 1);
        const nextEdgeIndex = (i + 1) % edges.length;
        const nextEdge = edges[nextEdgeIndex];
        
        let shouldUpdateFrame = false;
        
        if (!isSameSideEdge(edge)) {
          const nextEdgeStartsSamePhysicalSide = !isInteriorPoint(nextEdge.from) && 
                                                  nextEdge.from.side === edge.to.side;
          const nextEdgeIsSameSide = isSameSideEdge(nextEdge);
          
          shouldUpdateFrame = !(nextEdgeIsSameSide && nextEdgeStartsSamePhysicalSide);
        } else {
          if (!isInteriorPoint(nextEdge.from) && !isInteriorPoint(edge.to)) {
            const edgeEndsSide = edge.to.side;
            const nextStartsSide = nextEdge.from.side;
            const edgeEndsT = edge.to.t;
            const nextStartsT = nextEdge.from.t;
            
            if (edgeEndsSide !== nextStartsSide && 
                getIdentifiedSide(edgeEndsSide) === nextStartsSide &&
                Math.abs(edgeEndsT - nextStartsT) < EPSILON) {
              shouldUpdateFrame = true;
            }
          }
        }
        
        if (shouldUpdateFrame) {
          currentFrame = updateReferenceFrameForSide(edge.to.side, currentFrame);
          currentIndex = updateWallpaperIndex(edge.to.side, currentIndex);
          
          if (!isLastEdgeOfLastRepeat) {
            squareFrames.push({ ...currentFrame });
            squareIndices.push({ ...currentIndex });
          }
        }
      }
    }
  }
  
  return { pathPoints, squareFrames, squareIndices };
}

/**
 * Get the three corners of the triangle in a given reference frame.
 * The diffeomorphism maps NE to the hypotenuse midpoint,
 * so the triangle vertices are NW, SW, SE.
 */
function getTriangleCorners(frame) {
  return {
    nw: applyReferenceFrame(NW_CORNER.x, NW_CORNER.y, frame),
    sw: applyReferenceFrame(SW_CORNER.x, SW_CORNER.y, frame),
    se: applyReferenceFrame(SE_CORNER.x, SE_CORNER.y, frame)
  };
}

/**
 * Get the centroid of the triangle in a given reference frame.
 */
function getTriangleCenter(frame) {
  const corners = getTriangleCorners(frame);
  return {
    x: (corners.nw.x + corners.sw.x + corners.se.x) / 3,
    y: (corners.nw.y + corners.sw.y + corners.se.y) / 3
  };
}

/**
 * Get the SVG path string for the triangle outline in a given reference frame.
 */
function getTrianglePathString(frame) {
  const corners = getTriangleCorners(frame);
  return `M ${corners.nw.x} ${corners.nw.y} L ${corners.sw.x} ${corners.sw.y} L ${corners.se.x} ${corners.se.y} Z`;
}

/**
 * Get the position and rotation for the "N" marker on the north edge.
 * North maps to the hypotenuse (NW→SE direction), so place the marker there.
 */
function getNorthMarkerInfo(frame) {
  const corners = getTriangleCorners(frame);
  
  const x = (corners.nw.x + corners.se.x) / 2;
  const y = (corners.nw.y + corners.se.y) / 2;
  
  const dx = corners.se.x - corners.nw.x;
  const dy = corners.se.y - corners.nw.y;
  const angle = Math.atan2(dy, dx) * 180 / Math.PI;
  
  return { x, y, angle };
}

// Constants for grid generation (same as square viewer)
const SIDE = 300;
const LATTICE_SPACING = 2 * SIDE;
const RANGE_SAFETY_MARGIN = 2;

/**
 * Generate all triangles (i, j, k) that intersect a given bounding box.
 */
function generateAllTrianglesInBounds(bounds, margin = 100) {
  const triangles = [];
  
  const expandedBounds = {
    minX: bounds.minX - margin,
    minY: bounds.minY - margin,
    maxX: bounds.maxX + margin,
    maxY: bounds.maxY + margin
  };
  
  const boundingBoxMaxExtent = Math.max(
    (expandedBounds.maxX - expandedBounds.minX),
    (expandedBounds.maxY - expandedBounds.minY)
  );
  
  const iRange = Math.ceil(boundingBoxMaxExtent / LATTICE_SPACING) + RANGE_SAFETY_MARGIN;
  const jRange = Math.ceil(boundingBoxMaxExtent / LATTICE_SPACING) + RANGE_SAFETY_MARGIN;
  
  for (let i = -iRange; i <= iRange; i++) {
    for (let j = -jRange; j <= jRange; j++) {
      for (let k = 0; k < 8; k++) {
        const index = { tx: i, ty: j, r: k };
        const frame = indexToFrame(index);
        const center = getTriangleCenter(frame);
        
        if (center.x >= expandedBounds.minX && center.x <= expandedBounds.maxX &&
            center.y >= expandedBounds.minY && center.y <= expandedBounds.maxY) {
          triangles.push({ index, frame });
        }
      }
    }
  }
  
  return triangles;
}

const DEFAULT_CLOSED_LOOP_REPEATS = 2;

/**
 * P4TriangleWallpaperViewer component - renders the path unfolded on R² using
 * 45-45-90 triangle fundamental domains with the square-to-triangle diffeomorphism.
 * Shows ghost paths in each triangle copy (no main trajectory tracing).
 */
function P4TriangleWallpaperViewer({ edges, isLoopClosed = false, onClose }) {
  const [repeats, setRepeats] = useState(isLoopClosed ? DEFAULT_CLOSED_LOOP_REPEATS : 1);
  
  const effectiveRepeats = isLoopClosed ? repeats : 1;
  
  // Generate wallpaper data using triangle mapping
  const { pathPoints, squareFrames, squareIndices } = useMemo(() => 
    generateWallpaperData(edges, effectiveRepeats), 
    [edges, effectiveRepeats]
  );
  
  const visitedTriangleKeys = useMemo(() => {
    const keys = new Set();
    for (const index of squareIndices) {
      keys.add(`${index.tx},${index.ty},${index.r}`);
      // Inner triangle (r+4) is visited when its outer counterpart (r<4) is visited
      if (index.r < 4) {
        keys.add(`${index.tx},${index.ty},${index.r + 4}`);
      }
    }
    return keys;
  }, [squareIndices]);
  
  // Calculate bounding box
  const bounds = useMemo(() => {
    let minX = -300, minY = -300, maxX = 300, maxY = 300;
    
    for (const pt of pathPoints) {
      minX = Math.min(minX, pt.x);
      minY = Math.min(minY, pt.y);
      maxX = Math.max(maxX, pt.x);
      maxY = Math.max(maxY, pt.y);
    }
    
    for (const frame of squareFrames) {
      const corners = getTriangleCorners(frame);
      for (const corner of [corners.nw, corners.sw, corners.se]) {
        minX = Math.min(minX, corner.x);
        minY = Math.min(minY, corner.y);
        maxX = Math.max(maxX, corner.x);
        maxY = Math.max(maxY, corner.y);
      }
    }
    
    return { minX, minY, maxX, maxY };
  }, [pathPoints, squareFrames]);
  
  // Generate ALL triangles that appear within the viewable area
  const allTriangles = useMemo(() => {
    return generateAllTrianglesInBounds(bounds);
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
  
  return (
    <div className="wallpaper-viewer-overlay" onClick={onClose}>
      <div className="wallpaper-viewer-container" onClick={(e) => e.stopPropagation()}>
        <div className="wallpaper-viewer-header">
          <h2>P4 Triangle Wallpaper View</h2>
          <button onClick={onClose} className="wallpaper-close-btn">×</button>
        </div>
        
        <div className="wallpaper-canvas-container">
          <svg viewBox={viewBox} className="wallpaper-svg">
            {/* Draw ALL triangles in the viewable area */}
            {allTriangles.map(({ frame, index: triIndex }) => {
              const markerInfo = getNorthMarkerInfo(frame);
              const center = getTriangleCenter(frame);
              const ghostPathString = generateAllEdgesPathString(edges, frame);
              const indexLabel = formatWallpaperIndex(triIndex);
              const isVisited = visitedTriangleKeys.has(`${triIndex.tx},${triIndex.ty},${triIndex.r}`);
              
              return (
                <g key={`${triIndex.tx},${triIndex.ty},${triIndex.r}`} className={`rhombus-instance ${isVisited ? 'visited' : ''}`}>
                  {/* Triangle outline */}
                  <path 
                    d={getTrianglePathString(frame)} 
                    className={`rhombus-outline ${isVisited ? 'visited' : ''}`}
                  />
                  
                  {/* Ghost paths - all edges shown in subtle gray (only for visited triangles) */}
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
                  
                  {/* Triangle index label at centroid */}
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
          </svg>
        </div>
        
        <div className="wallpaper-info">
          <p>
            Path unfolded onto R² (P4 triangle mode) • {visitedTriangleKeys.size} visited triangles • {allTriangles.length} total displayed
            {isLoopClosed && ` • ${effectiveRepeats} repeat${effectiveRepeats === 1 ? '' : 's'}`}
          </p>
          
          {isLoopClosed && (
            <div className="repeats-control">
              <label htmlFor="triangle-repeats-slider">Loop Repeats:</label>
              <input
                id="triangle-repeats-slider"
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

export default P4TriangleWallpaperViewer;
