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
 * Compute edge list data with rhombus indices for each edge.
 * @param {Array} edges - Array of edge objects with from/to points
 * @returns {Array} - Array of { edge, edgeIndex, rhombusIndex, isSameSide, conceptualIndex }
 */
function computeEdgeListData(edges) {
  if (edges.length === 0) return [];
  
  const result = [];
  let currentIndex = createIdentityWallpaperIndex();
  
  for (let i = 0; i < edges.length; i++) {
    const edge = edges[i];
    const sameSide = isSameSideEdge(edge);
    
    if (sameSide) {
      const conceptualIndex = updateWallpaperIndex(edge.to.side, currentIndex);
      
      result.push({
        edge,
        edgeIndex: i,
        rhombusIndex: { ...currentIndex },
        isSameSide: true,
        conceptualIndex
      });
    } else {
      const nextIndex = updateWallpaperIndex(edge.to.side, currentIndex);
      
      result.push({
        edge,
        edgeIndex: i,
        rhombusIndex: { ...nextIndex },
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
                      <td>{edge.from.side} ({edge.from.t.toFixed(2)})</td>
                      <td>{edge.to.side} ({edge.to.t.toFixed(2)})</td>
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
