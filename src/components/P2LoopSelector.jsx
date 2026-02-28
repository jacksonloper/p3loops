import { useState, useMemo, useCallback } from 'react';
import { P2LoopIterator } from '../utils/p2LoopIterator.js';
import './LoopSelector.css';

// Configuration
const INITIAL_LOOPS = 20;
const LOOPS_PER_LOAD = 20;
const MAX_SEARCH_LENGTH = 50;

/**
 * P2LoopSelector - A dropdown component for selecting and loading P2 loops.
 * 
 * Works like the P3 LoopSelector - user picks a loop and it loads directly.
 * Loops are discovered lazily and cached.
 * 
 * @param {Function} onSelectLoop - Callback when a loop is selected, receives the loop object
 * @param {boolean} disabled - Whether the selector is disabled
 */
function P2LoopSelector({ onSelectLoop, disabled = false }) {
  // Create iterator once
  const [iterator] = useState(() => new P2LoopIterator());
  
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
  
  // Compute loop options
  const loopOptions = useMemo(() => {
    return loops.map((loop, index) => ({
      index,
      length: loop.length,
      label: `Loop #${index + 1} (${loop.length} edges)`
    }));
  }, [loops]);

  return (
    <div className="loop-selector">
      <label htmlFor="p2-loop-select">Load Loop:</label>
      <select
        id="p2-loop-select"
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

export default P2LoopSelector;
