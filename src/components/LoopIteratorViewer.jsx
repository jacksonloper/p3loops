import { useState, useMemo, useCallback } from 'react';
import { LoopIterator, loopToFloatEdges } from '../utils/loopIterator.js';
import { formatWallpaperIndex, computePathWallpaperIndex } from '../utils/moveTree.js';
import './LoopIteratorViewer.css';

// Configuration
const DEFAULT_LOOPS_TO_SHOW = 10;
const LOOPS_PER_LOAD = 10;
const MAX_SEARCH_LENGTH = 50;

/**
 * LoopIteratorViewer - Component to display all possible loops.
 * 
 * Shows a list of all valid loops, ordered by length (number of edges).
 * Loops are enumerated starting with "north to west" to break symmetry.
 * Users can load more loops incrementally.
 * 
 * @param {Function} onClose - Callback to close the viewer
 * @param {Function} onSelectLoop - Callback when a loop is selected (optional)
 */
function LoopIteratorViewer({ onClose, onSelectLoop }) {
  // Store the iterator and its results in state
  const [iteratorState, setIteratorState] = useState(() => {
    const iterator = new LoopIterator();
    const loops = iterator.getLoops(DEFAULT_LOOPS_TO_SHOW, MAX_SEARCH_LENGTH);
    const stats = iterator.getStats();
    const hasMore = iterator.hasOpenPaths() && stats.maxExploredLength < MAX_SEARCH_LENGTH;
    return { iterator, loops, stats, hasMore };
  });
  
  // Selected loop index for preview
  const [selectedIndex, setSelectedIndex] = useState(null);
  
  // Whether we're currently loading more loops
  const [isLoading, setIsLoading] = useState(false);
  
  // Extract values from state
  const { loops, stats, hasMore } = iteratorState;
  
  // Load more loops
  const handleLoadMore = useCallback(() => {
    setIsLoading(true);
    // Use setTimeout to allow UI to update before potentially long computation
    setTimeout(() => {
      setIteratorState(prev => {
        const newLoops = prev.iterator.getLoops(prev.loops.length + LOOPS_PER_LOAD, MAX_SEARCH_LENGTH);
        const newStats = prev.iterator.getStats();
        const newHasMore = prev.iterator.hasOpenPaths() && newStats.maxExploredLength < MAX_SEARCH_LENGTH;
        return { ...prev, loops: newLoops, stats: newStats, hasMore: newHasMore };
      });
      setIsLoading(false);
    }, 0);
  }, []);
  
  // Reset the iterator
  const handleReset = useCallback(() => {
    setIteratorState(prev => {
      prev.iterator.reset();
      const loops = prev.iterator.getLoops(DEFAULT_LOOPS_TO_SHOW, MAX_SEARCH_LENGTH);
      const stats = prev.iterator.getStats();
      const hasMore = prev.iterator.hasOpenPaths() && stats.maxExploredLength < MAX_SEARCH_LENGTH;
      return { ...prev, loops, stats, hasMore };
    });
    setSelectedIndex(null);
  }, []);
  
  // Handle selecting a loop
  const handleSelectLoop = useCallback((index) => {
    setSelectedIndex(prevIndex => prevIndex === index ? null : index);
  }, []);
  
  // Get the selected loop's details
  const selectedLoop = selectedIndex !== null ? loops[selectedIndex] : null;
  const selectedFloatEdges = selectedLoop ? loopToFloatEdges(selectedLoop) : null;
  const selectedWallpaperIndex = selectedLoop 
    ? computePathWallpaperIndex(selectedLoop.state.edges) 
    : null;
  
  // Group loops by length for summary
  const loopsByLength = useMemo(() => {
    const grouped = {};
    for (const loop of loops) {
      if (!grouped[loop.length]) {
        grouped[loop.length] = [];
      }
      grouped[loop.length].push(loop);
    }
    return grouped;
  }, [loops]);
  
  return (
    <div className="loop-iterator-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="loop-iterator-modal">
        <div className="loop-iterator-header">
          <h2>All Possible Loops</h2>
          <p className="loop-iterator-subtitle">
            Non-crossing loops starting with North → West, ordered by length
          </p>
          <button className="close-btn" onClick={onClose} aria-label="Close">×</button>
        </div>

        <div className="loop-iterator-controls">
          <div className="stats-bar">
            <span className="stat-item">
              <strong>{loops.length}</strong> loops found
            </span>
            <span className="stat-item">
              Explored to length <strong>{stats.maxExploredLength}</strong>
            </span>
            <span className="stat-item">
              <strong>{stats.totalOpenPaths}</strong> paths pending
            </span>
          </div>
          
          <div className="control-buttons">
            <button 
              onClick={handleLoadMore} 
              disabled={isLoading || !hasMore}
              className="control-btn primary"
            >
              {isLoading ? 'Loading...' : hasMore ? 'Load More Loops' : 'All Loops Found'}
            </button>
            <button onClick={handleReset} className="control-btn">
              Reset
            </button>
          </div>
        </div>

        <div className="loop-iterator-content">
          {loops.length === 0 ? (
            <div className="no-loops">
              {stats.maxExploredLength === 0 
                ? 'Searching for loops...'
                : 'No valid loops found in the explored range'
              }
            </div>
          ) : (
            <div className="loops-container">
              {/* Summary by length */}
              <div className="length-summary">
                <h4>Loops by Length:</h4>
                <div className="length-chips">
                  {Object.entries(loopsByLength)
                    .sort(([a], [b]) => Number(a) - Number(b))
                    .map(([length, loopsAtLength]) => (
                      <span key={length} className="length-chip">
                        {length} edges: <strong>{loopsAtLength.length}</strong>
                      </span>
                    ))
                  }
                </div>
              </div>
              
              {/* Loop list */}
              <div className="loops-list">
                {loops.map((loop, index) => (
                  <div 
                    key={index}
                    className={`loop-item ${selectedIndex === index ? 'selected' : ''}`}
                    onClick={() => handleSelectLoop(index)}
                  >
                    <span className="loop-number">#{index + 1}</span>
                    <span className="loop-length">{loop.length} edges</span>
                    <span className="loop-badge">🔄 Loop</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Selected loop details */}
          {selectedLoop && (
            <div className="loop-details">
              <h4>Loop #{selectedIndex + 1} Details</h4>
              <div className="detail-row">
                <span className="detail-label">Length:</span>
                <span className="detail-value">{selectedLoop.length} edges</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Final Rhombus:</span>
                <span className="detail-value wallpaper-index">
                  {formatWallpaperIndex(selectedWallpaperIndex)}
                </span>
              </div>
              
              <h5>Edge Sequence:</h5>
              <div className="edge-sequence">
                {selectedFloatEdges.map((edge, i) => (
                  <div key={i} className="edge-item">
                    <span className="edge-number">{i + 1}.</span>
                    <span className="edge-from">{edge.from.side}</span>
                    <span className="edge-arrow">→</span>
                    <span className="edge-to">{edge.to.side}</span>
                  </div>
                ))}
              </div>
              
              {onSelectLoop && (
                <button 
                  className="control-btn primary use-loop-btn"
                  onClick={() => onSelectLoop(selectedLoop)}
                >
                  Use This Loop
                </button>
              )}
            </div>
          )}
        </div>

        <div className="loop-iterator-footer">
          <p className="help-text">
            <strong>How it works:</strong> All loops start with an edge from North to West 
            (to break rotational symmetry). Loops are listed in order of increasing length.
          </p>
          <p className="help-text">
            Click on a loop to see its details. Click "Load More Loops" to discover additional loops.
          </p>
        </div>
      </div>
    </div>
  );
}

export default LoopIteratorViewer;
