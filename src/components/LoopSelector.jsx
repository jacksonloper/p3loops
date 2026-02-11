import { useState, useMemo, useCallback } from 'react';
import { LoopIterator } from '../utils/loopIterator.js';
import { allEdgesToFloat } from '../utils/combinatorialPathLogic.js';
import { 
  createIdentityWallpaperIndex,
  updateWallpaperIndex,
  formatWallpaperIndex
} from '../utils/moveTree.js';
import { isInteriorPoint, getIdentifiedSide, EPSILON } from '../utils/geometry.js';
import './LoopSelector.css';

// Configuration
const INITIAL_LOOPS = 20;
const LOOPS_PER_LOAD = 20;
const MAX_SEARCH_LENGTH = 50;

/**
 * Check if an edge is a same-side edge.
 */
function isSameSideEdge(edge) {
  if (isInteriorPoint(edge.from) || isInteriorPoint(edge.to)) {
    return false;
  }
  
  const fromSide = edge.from.side;
  const toSide = edge.to.side;
  
  if (fromSide === toSide) {
    return true;
  }
  
  // Check for identified sides at same position
  if (getIdentifiedSide(fromSide) === toSide) {
    if (edge.from.t !== undefined && edge.to.t !== undefined) {
      if (Math.abs(edge.from.t - edge.to.t) < EPSILON) {
        return true;
      }
    }
  }
  
  return false;
}

/**
 * Compute the final rhombus index after tracing through all edges of a loop.
 * This uses the same logic as EdgeListViewer for consistency.
 * @param {Array} edges - Array of float edge objects with from/to points (with side and t)
 * @returns {Object} - The final rhombus index { x, y, rotation }
 */
function computeFinalRhombusIndex(edges) {
  if (!edges || edges.length === 0) return createIdentityWallpaperIndex();
  
  let currentIndex = createIdentityWallpaperIndex();
  
  for (let i = 0; i < edges.length; i++) {
    const edge = edges[i];
    
    // Skip if edge doesn't have proper structure
    if (!edge || !edge.from || !edge.to) continue;
    
    // Skip interior edges for now
    if (isInteriorPoint(edge.to) || isInteriorPoint(edge.from)) {
      continue;
    }
    
    const sameSide = isSameSideEdge(edge);
    
    if (!sameSide) {
      // Edge crosses to new rhombus
      currentIndex = updateWallpaperIndex(edge.to.side, currentIndex);
    } else if (i < edges.length - 1) {
      // Same-side edge - check if next edge starts on identified side
      const nextEdge = edges[i + 1];
      
      if (nextEdge && nextEdge.from && !isInteriorPoint(nextEdge.from)) {
        const edgeEndsSide = edge.to.side;
        const nextStartsSide = nextEdge.from.side;
        const edgeEndsT = edge.to.t;
        const nextStartsT = nextEdge.from.t;
        
        if (edgeEndsSide !== nextStartsSide && 
            getIdentifiedSide(edgeEndsSide) === nextStartsSide &&
            edgeEndsT !== undefined && nextStartsT !== undefined &&
            Math.abs(edgeEndsT - nextStartsT) < EPSILON) {
          currentIndex = updateWallpaperIndex(edge.to.side, currentIndex);
        }
      }
    }
  }
  
  return currentIndex;
}

/**
 * LoopSelector - A dropdown component for selecting and loading loops.
 * 
 * Works like the "Load Example" dropdown - user picks a loop and it loads directly.
 * Loops are discovered lazily and cached.
 * 
 * @param {Function} onSelectLoop - Callback when a loop is selected, receives the loop object
 * @param {boolean} disabled - Whether the selector is disabled
 */
function LoopSelector({ onSelectLoop, disabled = false }) {
  // Create iterator once
  const [iterator] = useState(() => new LoopIterator());
  
  // Track how many loops we've requested
  const [requestedCount, setRequestedCount] = useState(INITIAL_LOOPS);
  const [isLoading, setIsLoading] = useState(false);
  
  // Discover loops based on requested count
  const loops = useMemo(() => {
    return iterator.getLoops(requestedCount, MAX_SEARCH_LENGTH);
  }, [iterator, requestedCount]);
  
  const [selectedValue, setSelectedValue] = useState('');
  
  // Handle selection change
  const handleChange = useCallback((e) => {
    const value = e.target.value;
    setSelectedValue(value);
    
    if (value === '') return;
    
    const loopIndex = parseInt(value, 10);
    const selectedLoop = loops[loopIndex];
    
    if (selectedLoop && onSelectLoop) {
      onSelectLoop(selectedLoop);
      // Reset selection after loading
      setSelectedValue('');
    }
  }, [loops, onSelectLoop]);
  
  // Handle load more
  const handleLoadMore = useCallback(() => {
    setIsLoading(true);
    // Use setTimeout to allow UI to update before potentially slow computation
    setTimeout(() => {
      setRequestedCount(prev => prev + LOOPS_PER_LOAD);
      setIsLoading(false);
    }, 10);
  }, []);
  
  // Compute loop options with final rhombus
  // This is memoized by useMemo and only recomputes when loops array changes
  const loopOptions = useMemo(() => {
    return loops.map((loop, index) => {
      // Convert to float edges to compute final rhombus
      const floatEdges = allEdgesToFloat(loop.state);
      const finalIndex = computeFinalRhombusIndex(floatEdges);
      const finalRhombus = formatWallpaperIndex(finalIndex);
      return {
        index,
        length: loop.length,
        label: `Loop #${index + 1} (${loop.length} edges) → ${finalRhombus}`
      };
    });
  }, [loops]);

  return (
    <div className="loop-selector">
      <label htmlFor="loop-select">Load Loop:</label>
      <select
        id="loop-select"
        value={selectedValue}
        onChange={handleChange}
        disabled={disabled || isLoading}
      >
        <option value="">
          {isLoading ? 'Discovering loops...' : `Select a loop (${loops.length} available)...`}
        </option>
        {loopOptions.map(opt => (
          <option key={opt.index} value={opt.index}>
            {opt.label}
          </option>
        ))}
      </select>
      <button 
        onClick={handleLoadMore}
        disabled={disabled || isLoading}
        className="load-more-btn"
        title="Discover more loops"
      >
        {isLoading ? '...' : '+'}
      </button>
    </div>
  );
}

export default LoopSelector;
