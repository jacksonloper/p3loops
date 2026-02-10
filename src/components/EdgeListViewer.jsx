import { useMemo } from 'react';
import { 
  createIdentityWallpaperIndex,
  updateWallpaperIndex,
  formatWallpaperIndex
} from '../utils/moveTree.js';
import { isInteriorPoint, getIdentifiedSide, EPSILON } from '../utils/geometry.js';
import './EdgeListViewer.css';

/**
 * Check if an edge is a same-side edge (stays within the same rhombus).
 * Works with both float edges { side, t } and combinatorial edges { side, pos }.
 * Edges with crossedInterior: true are NOT same-side (they trigger a crossing).
 */
function isSameSideEdge(edge) {
  // Interior points are not same-side
  if (isInteriorPoint(edge.from) || isInteriorPoint(edge.to)) {
    return false;
  }
  
  // crossedInterior means this edge went through interior and triggers a crossing
  if (edge.crossedInterior) {
    return false;
  }
  
  const fromSide = edge.from.side;
  const toSide = edge.to.side;
  
  // Same side = stays in same rhombus
  if (fromSide === toSide) {
    return true;
  }
  
  // Check for identified sides at same position
  if (getIdentifiedSide(fromSide) === toSide) {
    // Float format
    if (edge.from.t !== undefined && edge.to.t !== undefined) {
      if (Math.abs(edge.from.t - edge.to.t) < EPSILON) {
        return true;
      }
    }
    // Combinatorial format  
    if (edge.from.pos !== undefined && edge.to.pos !== undefined) {
      if (edge.from.pos === edge.to.pos) {
        return true;
      }
    }
  }
  
  return false;
}

/**
 * Format a point for display in the edge list.
 * Works with both float edges { side, t } and combinatorial edges { side, pos }.
 */
function formatPoint(point) {
  if (point.interior) {
    return 'interior';
  }
  if (point.t !== undefined) {
    return `${point.side} (${point.t.toFixed(2)})`;
  }
  if (point.pos !== undefined) {
    return `${point.side} [${point.pos}]`;
  }
  return point.side || 'unknown';
}

/**
 * Compute edge list data with rhombus indices for each edge.
 * Uses algebraic index tracking for consistency with wallpaper grid.
 * @param {Array} edges - Array of edge objects with from/to points
 * @returns {Array} - Array of { edge, edgeIndex, rhombusIndex, isSameSide, conceptualIndex }
 */
function computeEdgeListData(edges) {
  if (edges.length === 0) return [];
  
  const result = [];
  let currentIndex = createIdentityWallpaperIndex();
  
  for (let i = 0; i < edges.length; i++) {
    const edge = edges[i];
    
    // Check for interior points
    const toInterior = isInteriorPoint(edge.to);
    const fromInterior = isInteriorPoint(edge.from);
    
    if (toInterior) {
      // Edge going to interior - stays in current rhombus, no crossing
      result.push({
        edge,
        edgeIndex: i,
        rhombusIndex: { ...currentIndex },
        isSameSide: true,
        conceptualIndex: null,
        isInterior: true
      });
      continue;
    }
    
    if (fromInterior) {
      // Edge coming from interior to boundary - this DOES cross
      const nextIndex = updateWallpaperIndex(edge.to.side, currentIndex);
      
      // Edge is drawn in current rhombus, but triggers a crossing
      result.push({
        edge,
        edgeIndex: i,
        rhombusIndex: { ...currentIndex },
        isSameSide: false,
        conceptualIndex: null,
        isInterior: true
      });
      
      currentIndex = nextIndex;
      continue;
    }
    
    const sameSide = isSameSideEdge(edge);
    
    if (sameSide) {
      // For same-side edges, compute conceptual index (what it would enter)
      const conceptualIndex = updateWallpaperIndex(edge.to.side, currentIndex);
      
      result.push({
        edge,
        edgeIndex: i,
        rhombusIndex: { ...currentIndex },
        isSameSide: true,
        conceptualIndex
      });
    } else {
      // Edge crosses to new rhombus - shown in current rhombus, then update for next edge
      const nextIndex = updateWallpaperIndex(edge.to.side, currentIndex);
      
      result.push({
        edge,
        edgeIndex: i,
        rhombusIndex: { ...currentIndex },
        isSameSide: false,
        conceptualIndex: null
      });
      
      currentIndex = nextIndex;
    }
  }
  
  return result;
}

/**
 * EdgeListViewer component - shows a table of edges with their rhombus indices.
 * @param {Object[]} edges - Array of edge objects defining the path
 * @param {function} onClose - Callback to close the viewer
 */
function EdgeListViewer({ edges, onClose }) {
  const edgeListData = useMemo(() => 
    computeEdgeListData(edges),
    [edges]
  );

  return (
    <div className="edge-list-viewer-overlay" onClick={onClose}>
      <div className="edge-list-viewer-container" onClick={(e) => e.stopPropagation()}>
        <div className="edge-list-viewer-header">
          <h2>Edge List</h2>
          <button onClick={onClose} className="edge-list-close-btn">×</button>
        </div>
        
        <div className="edge-list-viewer-content">
          {edges.length === 0 ? (
            <p className="edge-list-empty">No edges in path</p>
          ) : (
            <>
              <table className="edge-list-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>From</th>
                    <th>To</th>
                    <th>Rhombus Index</th>
                  </tr>
                </thead>
                <tbody>
                  {edgeListData.map(({ edge, edgeIndex, rhombusIndex, isSameSide, conceptualIndex }) => (
                    <tr key={edgeIndex} className={isSameSide ? 'same-side-edge' : ''}>
                      <td>{edgeIndex + 1}</td>
                      <td>{formatPoint(edge.from)}</td>
                      <td>{formatPoint(edge.to)}</td>
                      <td>
                        {isSameSide ? (
                          <span className="same-side-info">
                            {formatWallpaperIndex(rhombusIndex)}
                            <span className="conceptual-index" title="Conceptual rhombus (would enter if not same-side)">
                              → {formatWallpaperIndex(conceptualIndex)}*
                            </span>
                          </span>
                        ) : (
                          formatWallpaperIndex(rhombusIndex)
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {edgeListData.some(e => e.isSameSide) && (
                <p className="edge-list-footnote">
                  * Same-side edges stay in current rhombus. Index shown is conceptual (what it would enter).
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default EdgeListViewer;
