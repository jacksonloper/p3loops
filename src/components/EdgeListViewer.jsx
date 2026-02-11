import { useMemo } from 'react';
import { 
  createIdentityWallpaperIndex,
  updateWallpaperIndex,
  formatWallpaperIndex
} from '../utils/moveTree.js';
import { isInteriorPoint, getIdentifiedSide, EPSILON } from '../utils/geometry.js';
import './EdgeListViewer.css';

/**
 * Get the parameter value (t or pos) from a point.
 * Returns the t value for float edges or pos for combinatorial edges.
 * @param {Object} point - Point object with either t or pos property
 * @returns {{ value: number|null, isFloat: boolean }}
 */
function getParameterValue(point) {
  if (point.t !== undefined) {
    return { value: point.t, isFloat: true };
  }
  if (point.pos !== undefined) {
    return { value: point.pos, isFloat: false };
  }
  return { value: null, isFloat: false };
}

/**
 * Check if two parameter values are equal.
 * Uses epsilon comparison for float values, exact comparison for integers.
 * @param {Object} param1 - First parameter { value, isFloat }
 * @param {Object} param2 - Second parameter { value, isFloat }
 * @returns {boolean}
 */
function parametersAreEqual(param1, param2) {
  if (param1.value === null || param2.value === null) {
    return false;
  }
  // Use epsilon comparison if either is a float value
  if (param1.isFloat || param2.isFloat) {
    return Math.abs(param1.value - param2.value) < EPSILON;
  }
  // Otherwise use exact comparison (for integer pos values)
  return param1.value === param2.value;
}

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
 * @param {Object} point - Point object with side and t/pos
 * @returns {string} Formatted point string
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
  // For edge cases where side is known but no position info (shouldn't happen in normal use)
  if (point.side) {
    console.warn('Point missing position info (t or pos):', point);
    return point.side;
  }
  // Unknown format - log for debugging
  console.warn('Unknown point format:', point);
  return 'unknown';
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
    
    // Every edge is IN some rhombus - add it with the current index
    result.push({
      edge,
      edgeIndex: i,
      rhombusIndex: { ...currentIndex },
      isSameSide: sameSide,
      conceptualIndex: null
    });
    
    // Determine if we need to update the index for the next edge
    if (!sameSide) {
      // Edge crosses to new rhombus - update the index
      currentIndex = updateWallpaperIndex(edge.to.side, currentIndex);
    } else if (i < edges.length - 1) {
      // Same-side edge - check if the NEXT edge starts on the identified side
      // at the same position (transitioning from east to north, etc.)
      const nextEdge = edges[i + 1];
      
      if (!isInteriorPoint(edge.to) && !isInteriorPoint(nextEdge.from)) {
        const edgeEndsSide = edge.to.side;
        const nextStartsSide = nextEdge.from.side;
        const edgeEndsParam = getParameterValue(edge.to);
        const nextStartsParam = getParameterValue(nextEdge.from);
        
        // Check if transitioning from one side to its identified counterpart at same position
        if (edgeEndsSide !== nextStartsSide && 
            getIdentifiedSide(edgeEndsSide) === nextStartsSide &&
            parametersAreEqual(edgeEndsParam, nextStartsParam)) {
          // Transitioning from edge.to.side to its identified side
          // This requires an index update
          currentIndex = updateWallpaperIndex(edge.to.side, currentIndex);
        }
      }
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
                  {edgeListData.map(({ edge, edgeIndex, rhombusIndex, isSameSide }) => (
                    <tr key={edgeIndex} className={isSameSide ? 'same-side-edge' : ''}>
                      <td>{edgeIndex + 1}</td>
                      <td>{formatPoint(edge.from)}</td>
                      <td>{formatPoint(edge.to)}</td>
                      <td>{formatWallpaperIndex(rhombusIndex)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default EdgeListViewer;
