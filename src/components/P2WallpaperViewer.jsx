import { useState, useMemo } from 'react';
import {
  createIdentityFrame,
  applyReferenceFrame,
  updateReferenceFrameForZone,
  getPointInZoneWallpaper,
  getCurvedEdgePathWallpaper,
  createIdentityWallpaperIndex,
  updateWallpaperIndex,
  formatWallpaperIndex,
  indexToFrame,
  getZoneSide,
  NE_CORNER,
  NW_CORNER,
  SE_CORNER,
  SW_CORNER,
  SIDE,
  HALF
} from '../utils/p2WallpaperGeometry.js';
import { getEdgeSamplePoints } from '../utils/p2Geometry.js';
import { getIdentifiedZone } from '../utils/p2PathLogic.js';
import './WallpaperViewer.css';

/**
 * Generate SVG path string for all edges rendered in a given reference frame.
 * Uses the diffeomorphism-based curved paths.
 * @param {Array} edges - Array of float edge objects with from/to {zone, t}
 * @param {Object} frame - Reference frame
 * @returns {string} SVG path string
 */
function generateAllEdgesPathString(edges, frame) {
  if (edges.length === 0) return '';
  
  const pathParts = [];
  for (const edge of edges) {
    pathParts.push(getCurvedEdgePathWallpaper(edge.from, edge.to, frame));
  }
  return pathParts.join(' ');
}

/**
 * Check if an edge stays within the same square (same-zone edge).
 * An edge stays in the same square if both endpoints are on the same zone,
 * or if they are on identified zones at positions that map to the same point.
 * @param {Object} edge - Float edge with from/to {zone, t}
 * @returns {boolean}
 */
function isSameSquareEdge(edge) {
  const fromSide = getZoneSide(edge.from.zone);
  const toSide = getZoneSide(edge.to.zone);
  
  // Same zone - stays in same square
  if (edge.from.zone === edge.to.zone) return true;
  
  // Identified zones at same point (t and 1-t match up)
  // When from.zone and to.zone are an identified pair, the edge crosses
  // the boundary unless they represent the same geometric point
  const identifiedFrom = getIdentifiedZone(edge.from.zone);
  if (identifiedFrom === edge.to.zone) {
    // Identified pair: NNW↔NNE etc. Same point when t_from and (1-t_to) match
    // But actually in the P2 zone system, identified zones have reversed param,
    // so the "same point" is when they both map to the midpoint.
    // For crossing detection: if on same side but different zones, it's a crossing
    // UNLESS they are at the shared endpoint (t=1 for zone1 = t=0 for zone2 = midpoint)
    if (fromSide === toSide) {
      // Check if both are at the shared midpoint
      const EPSILON = 1e-6;
      if (Math.abs(edge.from.t - 1) < EPSILON && Math.abs(edge.to.t - 0) < EPSILON) return true;
      if (Math.abs(edge.from.t - 0) < EPSILON && Math.abs(edge.to.t - 1) < EPSILON) return true;
    }
  }
  
  // Different sides or different zones on same side (but not at shared midpoint)
  return false;
}

// Number of sample points per edge for curved rendering
const EDGE_SAMPLES = 20;

/**
 * Sample points along a curved edge using the diffeomorphism approach, in screen space.
 * @param {Object} from - {zone, t}
 * @param {Object} to - {zone, t}
 * @param {Object} frame - Reference frame
 * @returns {Array<{x: number, y: number}>} Sampled screen-space points
 */
function sampleEdgePoints(from, to, frame) {
  const samplePts = getEdgeSamplePoints(
    from.zone, from.t,
    to.zone, to.t,
    EDGE_SAMPLES + 1
  );

  // Convert unit-square points to local wallpaper-square screen coords,
  // then apply the reference frame.
  return samplePts.map(p => {
    // unit square: x=eastward [0,1], y=southward [0,1]
    // wallpaper square: NW=(-SIDE,0), NE=(0,0), SE=(0,SIDE), SW=(-SIDE,SIDE)
    const localX = -SIDE + p.x * SIDE;
    const localY = p.y * SIDE;
    return applyReferenceFrame(localX, localY, frame);
  });
}

/**
 * Generate wallpaper data: square frames, indices, path points, and vertex indices
 * for the main trajectory as it crosses boundaries.
 * 
 * @param {Array} edges - Array of float edge objects
 * @param {number} repeats - Number of times to repeat the path
 * @returns {{ squareFrames: Array, squareIndices: Array, pathPoints: Array, vertexIndices: Array }}
 */
function generateWallpaperData(edges, repeats = 1) {
  if (edges.length === 0) return { squareFrames: [], squareIndices: [], pathPoints: [], vertexIndices: [] };
  
  const squareFrames = [];
  const squareIndices = [];
  const pathPoints = [];
  const vertexIndices = [];
  let currentFrame = createIdentityFrame();
  let currentIndex = createIdentityWallpaperIndex();
  
  // Add the first square
  squareFrames.push({ ...currentFrame });
  squareIndices.push({ ...currentIndex });
  
  for (let rep = 0; rep < repeats; rep++) {
    for (let i = 0; i < edges.length; i++) {
      const edge = edges[i];
      const isLastEdgeOfLastRepeat = (rep === repeats - 1 && i === edges.length - 1);
      
      // Record the start vertex for the first edge of the first repeat
      if (rep === 0 && i === 0) {
        vertexIndices.push(pathPoints.length);
        const fromLocal = getPointInZoneWallpaper(edge.from.zone, edge.from.t);
        pathPoints.push(applyReferenceFrame(fromLocal.x, fromLocal.y, currentFrame));
      }
      
      // Add intermediate sample points along the curved edge (skip first and last - they're the endpoint vertices)
      const samples = sampleEdgePoints(edge.from, edge.to, currentFrame);
      for (let j = 1; j < samples.length - 1; j++) {
        pathPoints.push(samples[j]);
      }
      
      // Record the end vertex
      vertexIndices.push(pathPoints.length);
      const toLocal = getPointInZoneWallpaper(edge.to.zone, edge.to.t);
      pathPoints.push(applyReferenceFrame(toLocal.x, toLocal.y, currentFrame));
      
      if (!isSameSquareEdge(edge)) {
        // Edge crosses the boundary - update frame based on the destination zone
        currentFrame = updateReferenceFrameForZone(edge.to.zone, currentFrame);
        currentIndex = updateWallpaperIndex(edge.to.zone, currentIndex);
        
        if (!isLastEdgeOfLastRepeat) {
          squareFrames.push({ ...currentFrame });
          squareIndices.push({ ...currentIndex });
        }
      } else {
        // Same-square edge - check if next edge starts on identified zone
        const nextEdgeIndex = (i + 1) % edges.length;
        const nextEdge = edges[nextEdgeIndex];
        
        // If the next edge starts on the identified zone of where we ended,
        // we need to cross the boundary
        if (nextEdge && edge.to.zone !== nextEdge.from.zone) {
          const identifiedTo = getIdentifiedZone(edge.to.zone);
          if (identifiedTo === nextEdge.from.zone) {
            currentFrame = updateReferenceFrameForZone(edge.to.zone, currentFrame);
            currentIndex = updateWallpaperIndex(edge.to.zone, currentIndex);
            
            if (!isLastEdgeOfLastRepeat) {
              squareFrames.push({ ...currentFrame });
              squareIndices.push({ ...currentIndex });
            }
          }
        }
      }
    }
  }
  
  return { squareFrames, squareIndices, pathPoints, vertexIndices };
}

/**
 * Get the SVG path string for a square in a given reference frame.
 */
function getSquarePathString(frame) {
  const nw = applyReferenceFrame(NW_CORNER.x, NW_CORNER.y, frame);
  const ne = applyReferenceFrame(NE_CORNER.x, NE_CORNER.y, frame);
  const se = applyReferenceFrame(SE_CORNER.x, SE_CORNER.y, frame);
  const sw = applyReferenceFrame(SW_CORNER.x, SW_CORNER.y, frame);
  return `M ${nw.x} ${nw.y} L ${ne.x} ${ne.y} L ${se.x} ${se.y} L ${sw.x} ${sw.y} Z`;
}

/**
 * Get the center point of a square in a given reference frame.
 */
function getSquareCenter(frame) {
  const nw = applyReferenceFrame(NW_CORNER.x, NW_CORNER.y, frame);
  const ne = applyReferenceFrame(NE_CORNER.x, NE_CORNER.y, frame);
  const se = applyReferenceFrame(SE_CORNER.x, SE_CORNER.y, frame);
  const sw = applyReferenceFrame(SW_CORNER.x, SW_CORNER.y, frame);
  return {
    x: (nw.x + ne.x + se.x + sw.x) / 4,
    y: (nw.y + ne.y + se.y + sw.y) / 4
  };
}

/**
 * Get the position and rotation for the "N" marker on the north edge.
 */
function getNorthMarkerInfo(frame) {
  const nw = applyReferenceFrame(NW_CORNER.x, NW_CORNER.y, frame);
  const ne = applyReferenceFrame(NE_CORNER.x, NE_CORNER.y, frame);
  const x = (nw.x + ne.x) / 2;
  const y = (nw.y + ne.y) / 2;
  const dx = ne.x - nw.x;
  const dy = ne.y - nw.y;
  const angle = Math.atan2(dy, dx) * 180 / Math.PI;
  return { x, y, angle };
}

// For P2 wallpaper, the lattice vectors are T1=(SIDE,SIDE) and T2=(SIDE,-SIDE)
// The lattice spacing in each direction is SIDE
const LATTICE_SPACING = SIDE;
const RANGE_SAFETY_MARGIN = 2;

/**
 * Generate all squares (i, j, k) that intersect a given bounding box.
 */
function generateAllSquaresInBounds(bounds, margin = 100) {
  const squares = [];
  
  const expandedBounds = {
    minX: bounds.minX - margin,
    minY: bounds.minY - margin,
    maxX: bounds.maxX + margin,
    maxY: bounds.maxY + margin
  };
  
  const boundingBoxMaxExtent = Math.max(
    expandedBounds.maxX - expandedBounds.minX,
    expandedBounds.maxY - expandedBounds.minY
  );
  
  const iRange = Math.ceil(boundingBoxMaxExtent / LATTICE_SPACING) + RANGE_SAFETY_MARGIN;
  const jRange = Math.ceil(boundingBoxMaxExtent / LATTICE_SPACING) + RANGE_SAFETY_MARGIN;
  
  for (let i = -iRange; i <= iRange; i++) {
    for (let j = -jRange; j <= jRange; j++) {
      for (let k = 0; k < 2; k++) {
        const index = { tx: i, ty: j, r: k };
        const frame = indexToFrame(index);
        const center = getSquareCenter(frame);
        
        if (center.x >= expandedBounds.minX && center.x <= expandedBounds.maxX &&
            center.y >= expandedBounds.minY && center.y <= expandedBounds.maxY) {
          squares.push({ index, frame });
        }
      }
    }
  }
  
  return squares;
}

/**
 * P2WallpaperViewer component - renders the p2 wallpaper pattern.
 * Shows copies of the fundamental domain at different translations
 * with the path drawn as ghost paths in each copy.
 * 
 * @param {Object[]} edges - Array of float edge objects {from: {zone, t}, to: {zone, t}}
 * @param {boolean} isLoopClosed - Whether the loop is closed
 * @param {function} onClose - Callback to close the viewer
 */
function P2WallpaperViewer({ edges, isLoopClosed = false, onClose }) {
  const [repeats, setRepeats] = useState(isLoopClosed ? 2 : 1);
  const effectiveRepeats = isLoopClosed ? repeats : 1;
  
  // Generate wallpaper data
  const { squareFrames, squareIndices, pathPoints, vertexIndices } = useMemo(() =>
    generateWallpaperData(edges, effectiveRepeats),
    [edges, effectiveRepeats]
  );
  
  // Get set of visited square keys
  const visitedSquareKeys = useMemo(() => {
    const keys = new Set();
    for (const index of squareIndices) {
      keys.add(`${index.tx},${index.ty},${index.r}`);
    }
    return keys;
  }, [squareIndices]);
  
  // Calculate bounding box from visited squares and path points
  const bounds = useMemo(() => {
    let minX = -SIDE, minY = -SIDE / 2, maxX = SIDE, maxY = SIDE * 1.5;
    
    // Include all path points
    for (const pt of pathPoints) {
      minX = Math.min(minX, pt.x);
      minY = Math.min(minY, pt.y);
      maxX = Math.max(maxX, pt.x);
      maxY = Math.max(maxY, pt.y);
    }
    
    for (const frame of squareFrames) {
      for (const corner of [NW_CORNER, NE_CORNER, SE_CORNER, SW_CORNER]) {
        const pt = applyReferenceFrame(corner.x, corner.y, frame);
        minX = Math.min(minX, pt.x);
        minY = Math.min(minY, pt.y);
        maxX = Math.max(maxX, pt.x);
        maxY = Math.max(maxY, pt.y);
      }
    }
    
    return { minX, minY, maxX, maxY };
  }, [squareFrames, pathPoints]);
  
  // Generate all squares in the viewable area
  const allSquares = useMemo(() => {
    return generateAllSquaresInBounds(bounds);
  }, [bounds]);
  
  // Calculate SVG viewBox
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
          <h2>P2 Wallpaper View</h2>
          <button onClick={onClose} className="wallpaper-close-btn">×</button>
        </div>
        
        <div className="wallpaper-canvas-container">
          <svg viewBox={viewBox} className="wallpaper-svg">
            {/* Draw all squares in the viewable area */}
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
                  
                  {/* Index label at center */}
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
            
            {/* Draw direction arrows along the path */}
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
              
              // Only draw arrows for every other edge to reduce clutter
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
            P2 wallpaper pattern • {pathPoints.length} points • {visitedSquareKeys.size} visited squares • {allSquares.length} total displayed
            {isLoopClosed && ` • ${effectiveRepeats} repeat${effectiveRepeats === 1 ? '' : 's'}`}
          </p>
          
          {isLoopClosed && (
            <div className="repeats-control">
              <label htmlFor="p2-repeats-slider">Loop Repeats:</label>
              <input
                id="p2-repeats-slider"
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

export default P2WallpaperViewer;
