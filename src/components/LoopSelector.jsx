import { useState, useMemo, useCallback } from 'react';
import { LoopIterator } from '../utils/loopIterator.js';
import './LoopSelector.css';

// Configuration
const INITIAL_LOOPS = 20;
const MAX_SEARCH_LENGTH = 30;

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
  // Create iterator and discover loops once at initialization
  const [loopsData] = useState(() => {
    const iterator = new LoopIterator();
    const discoveredLoops = iterator.getLoops(INITIAL_LOOPS, MAX_SEARCH_LENGTH);
    return { loops: discoveredLoops, isLoading: false };
  });
  
  const [selectedValue, setSelectedValue] = useState('');
  
  const { loops, isLoading } = loopsData;
  
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
  
  // Group loops by length for display
  const loopOptions = useMemo(() => {
    return loops.map((loop, index) => ({
      index,
      length: loop.length,
      label: `Loop #${index + 1} (${loop.length} edges)`
    }));
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
    </div>
  );
}

export default LoopSelector;
