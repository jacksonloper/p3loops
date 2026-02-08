import { useState, useCallback, useMemo } from 'react';
import { getTopologicalOptions, planPathToSegment, getAllSegments, formatSegmentDescription } from '../utils/topologicalSegments.js';
import { isInteriorPoint, getIdentifiedSide, SIDES } from '../utils/geometry.js';
import { canAddEdge } from '../utils/pathLogic.js';
import './TopologicalPathSelector.css';

/**
 * TopologicalPathSelector - Mobile-friendly radio form for discrete path entry mode.
 * 
 * Allows users to select from topological segment options instead of clicking
 * on the rhombus directly. Shows a preview of the proposed path and confirms
 * with an Accept button.
 * 
 * @param {Object[]} edges - Current path edges
 * @param {Object|null} activeStartPoint - Currently selected starting point (when no edges yet)
 * @param {function} onAddEdges - Callback to add one or more edges (for routed paths)
 * @param {function} onError - Callback for error messages
 * @param {boolean} disabled - Whether path editing is disabled
 */
function TopologicalPathSelector({ edges, activeStartPoint, onAddEdges, onError, disabled }) {
  const [selectedOption, setSelectedOption] = useState(null);
  const [expandedSide, setExpandedSide] = useState(null);
  
  // Determine the current state
  const hasEdges = edges.length > 0;
  const hasStartPoint = activeStartPoint !== null;
  
  // Get all topological options based on current path
  const { optionGroups, currentPoint } = useMemo(() => {
    return getTopologicalOptions(edges);
  }, [edges]);
  
  // Get options for the second selection (after start point chosen but before first edge)
  const secondSelectionOptions = useMemo(() => {
    if (!hasStartPoint || hasEdges) return null;
    
    // Get all segments on all sides
    const allSegments = getAllSegments([]);
    const options = [];
    
    for (const side of SIDES) {
      const segments = allSegments.get(side);
      
      // Filter out segments on the same side as the start point
      for (const segment of segments) {
        // Same-side edges are forbidden
        if (side === activeStartPoint.side) continue;
        
        // Add as an option
        options.push({
          side,
          segment,
          description: formatSegmentDescription(side, segment),
          fromPoint: activeStartPoint,
          type: 'first-edge'
        });
      }
    }
    
    // Group by side
    const bySide = new Map();
    for (const side of SIDES) {
      bySide.set(side, []);
    }
    for (const option of options) {
      bySide.get(option.side).push(option);
    }
    
    return SIDES.map(side => ({
      side,
      identifiedWith: getIdentifiedSide(side),
      segments: bySide.get(side),
      hasOptions: bySide.get(side).length > 0
    }));
  }, [hasStartPoint, hasEdges, activeStartPoint]);
  
  // Get the proposed edge(s) for the selected option
  const proposedEdges = useMemo(() => {
    if (!selectedOption) return null;
    
    // For first edge (after start point selected)
    if (hasStartPoint && !hasEdges) {
      const toPoint = { side: selectedOption.side, t: selectedOption.segment.midpoint };
      return [{ from: activeStartPoint, to: toPoint }];
    }
    
    // For subsequent edges
    if (hasEdges) {
      const { side, segment, fromPoint } = selectedOption;
      const result = planPathToSegment(fromPoint, side, segment, edges);
      return result.success ? result.edges : null;
    }
    
    return null;
  }, [selectedOption, edges, hasEdges, hasStartPoint, activeStartPoint]);
  
  // Handle selecting an option
  const handleSelect = useCallback((option) => {
    setSelectedOption(option);
  }, []);
  
  // Handle accepting the selected option
  const handleAccept = useCallback(() => {
    if (!selectedOption) return;
    
    if (!hasStartPoint && !hasEdges) {
      // First selection: set the starting point
      const startPoint = { side: selectedOption.side, t: selectedOption.segment.midpoint };
      onAddEdges([], startPoint);
      setSelectedOption(null);
      return;
    }
    
    if (proposedEdges && proposedEdges.length > 0) {
      // Validate all edges can be added
      let allEdges = [...edges];
      for (const edge of proposedEdges) {
        const validation = canAddEdge(edge, allEdges);
        if (!validation.valid) {
          onError(validation.error, validation.crossingEdgeIndex);
          return;
        }
        allEdges = [...allEdges, edge];
      }
      
      // Add all edges
      onAddEdges(proposedEdges);
      setSelectedOption(null);
    }
  }, [selectedOption, proposedEdges, edges, hasEdges, hasStartPoint, onAddEdges, onError]);
  
  // Toggle expanded/collapsed state for a side
  const toggleSide = useCallback((side) => {
    setExpandedSide(current => current === side ? null : side);
  }, []);
  
  if (disabled) {
    return (
      <div className="topological-selector disabled">
        <p className="disabled-message">Loop is closed. Open the loop to continue editing.</p>
      </div>
    );
  }
  
  // State 1: No start point selected - pick where to start
  if (!hasStartPoint && !hasEdges) {
    return (
      <div className="topological-selector">
        <h3 className="selector-title">Select Starting Point</h3>
        <p className="selector-subtitle">Choose a side and segment to start your path</p>
        
        <div className="side-groups">
          {optionGroups.map(group => (
            <div key={group.side} className="side-group">
              <button 
                className={`side-header ${expandedSide === group.side ? 'expanded' : ''}`}
                onClick={() => toggleSide(group.side)}
              >
                <span className="side-name">{group.side.toUpperCase()}</span>
                <span className="side-id">(≡ {group.identifiedWith})</span>
                <span className="segment-count">{group.segments.length} segments</span>
                <span className="expand-icon">{expandedSide === group.side ? '▼' : '▶'}</span>
              </button>
              
              {expandedSide === group.side && (
                <div className="segment-options">
                  {group.segments.map((option, idx) => (
                    <label 
                      key={idx} 
                      className={`segment-option ${selectedOption === option ? 'selected' : ''}`}
                    >
                      <input
                        type="radio"
                        name="segment"
                        checked={selectedOption === option}
                        onChange={() => handleSelect(option)}
                      />
                      <span className="segment-description">{option.description}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
        
        {selectedOption && (
          <button 
            className="accept-button"
            onClick={handleAccept}
          >
            Start Here
          </button>
        )}
      </div>
    );
  }
  
  // State 2: Start point selected but no edges yet - pick destination for first edge
  if (hasStartPoint && !hasEdges) {
    const startPointDesc = isInteriorPoint(activeStartPoint)
      ? `Interior (${(activeStartPoint.southward * 100).toFixed(0)}%, ${(activeStartPoint.eastward * 100).toFixed(0)}%)`
      : `${activeStartPoint.side.toUpperCase()} ${(activeStartPoint.t * 100).toFixed(0)}%`;
    
    return (
      <div className="topological-selector">
        <h3 className="selector-title">Select First Destination</h3>
        <p className="selector-subtitle">
          Starting from: <strong>{startPointDesc}</strong>
        </p>
        
        <div className="side-groups">
          {secondSelectionOptions && secondSelectionOptions.map(group => (
            <div key={group.side} className={`side-group ${!group.hasOptions ? 'no-options' : ''}`}>
              <button 
                className={`side-header ${expandedSide === group.side ? 'expanded' : ''} ${!group.hasOptions ? 'disabled' : ''}`}
                onClick={() => group.hasOptions && toggleSide(group.side)}
                disabled={!group.hasOptions}
              >
                <span className="side-name">{group.side.toUpperCase()}</span>
                <span className="side-id">(≡ {group.identifiedWith})</span>
                <span className="segment-count">
                  {group.hasOptions ? `${group.segments.length} reachable` : 'same side'}
                </span>
                {group.hasOptions && (
                  <span className="expand-icon">{expandedSide === group.side ? '▼' : '▶'}</span>
                )}
              </button>
              
              {expandedSide === group.side && group.hasOptions && (
                <div className="segment-options">
                  {group.segments.map((option, idx) => (
                    <label 
                      key={idx} 
                      className={`segment-option ${selectedOption === option ? 'selected' : ''}`}
                    >
                      <input
                        type="radio"
                        name="segment"
                        checked={selectedOption === option}
                        onChange={() => handleSelect(option)}
                      />
                      <span className="segment-description">{option.description}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
        
        {selectedOption && proposedEdges && (
          <div className="preview-section">
            <h4>Preview</h4>
            <p className="preview-info">
              Will add first edge to {selectedOption.description}
            </p>
            <button 
              className="accept-button"
              onClick={handleAccept}
            >
              Add First Edge
            </button>
          </div>
        )}
        
        {!selectedOption && (
          <p className="helper-text">
            Tap a side to see available destinations for your first edge.
          </p>
        )}
      </div>
    );
  }
  
  // State 3: Has edges - continue the path
  const currentPointDesc = currentPoint 
    ? (isInteriorPoint(currentPoint) 
        ? `Interior (${(currentPoint.southward * 100).toFixed(0)}%, ${(currentPoint.eastward * 100).toFixed(0)}%)`
        : `${currentPoint.side.toUpperCase()} ${(currentPoint.t * 100).toFixed(0)}%`)
    : 'Unknown';
  
  return (
    <div className="topological-selector">
      <h3 className="selector-title">Select Next Segment</h3>
      <p className="selector-subtitle">
        Current position: <strong>{currentPointDesc}</strong>
      </p>
      
      <div className="side-groups">
        {optionGroups.map(group => (
          <div key={group.side} className={`side-group ${!group.hasOptions ? 'no-options' : ''}`}>
            <button 
              className={`side-header ${expandedSide === group.side ? 'expanded' : ''} ${!group.hasOptions ? 'disabled' : ''}`}
              onClick={() => group.hasOptions && toggleSide(group.side)}
              disabled={!group.hasOptions}
            >
              <span className="side-name">{group.side.toUpperCase()}</span>
              <span className="side-id">(≡ {group.identifiedWith})</span>
              <span className="segment-count">
                {group.hasOptions ? `${group.segments.length} reachable` : 'blocked'}
              </span>
              {group.hasOptions && (
                <span className="expand-icon">{expandedSide === group.side ? '▼' : '▶'}</span>
              )}
            </button>
            
            {expandedSide === group.side && group.hasOptions && (
              <div className="segment-options">
                {group.segments.map((option, idx) => (
                  <label 
                    key={idx} 
                    className={`segment-option ${selectedOption === option ? 'selected' : ''}`}
                  >
                    <input
                      type="radio"
                      name="segment"
                      checked={selectedOption === option}
                      onChange={() => handleSelect(option)}
                    />
                    <span className="segment-description">{option.description}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      
      {selectedOption && (
        <div className="preview-section">
          <h4>Preview</h4>
          <p className="preview-info">
            {proposedEdges 
              ? `Will add ${proposedEdges.length} edge${proposedEdges.length > 1 ? 's' : ''}`
              : 'Calculating route...'
            }
          </p>
          <button 
            className="accept-button"
            onClick={handleAccept}
            disabled={!proposedEdges}
          >
            Accept & Add Edge{proposedEdges && proposedEdges.length > 1 ? 's' : ''}
          </button>
        </div>
      )}
      
      {!selectedOption && (
        <p className="helper-text">
          Tap a side to see available segments, then select one to preview the path.
        </p>
      )}
    </div>
  );
}

export default TopologicalPathSelector;
