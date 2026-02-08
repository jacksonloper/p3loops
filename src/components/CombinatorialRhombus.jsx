import { useState, useCallback, useMemo } from 'react';
import {
  getSize,
} from '../utils/geometry.js';
import {
  getAllSegments,
  getPointsOnSide,
  segmentToTRange,
  pointToT,
  createPointInSegment,
  canAddEdge,
  getNextEdgeStartPoint,
  getSegmentLabel,
  SIDES,
} from '../utils/combinatorialLogic.js';
import './CombinatorialRhombus.css';

/**
 * CombinatorialRhombus component - renders the rhombus for combinatorial path editing.
 * 
 * In combinatorial mode:
 * - Points are placed at integer positions and visualized equally spaced
 * - Users select a target segment from a radio form
 * - The selected segment is highlighted on the rhombus
 * - Clicking "Accept" adds the edge from the current start point to the new point
 * 
 * @param {Array} edges - Current combinatorial edges
 * @param {function} onAddEdge - Callback when edge is added
 * @param {function} onError - Callback for error messages
 * @param {number|null} highlightedEdgeIndex - Index of edge to highlight
 * @param {boolean} disabled - Whether editing is disabled
 */
function CombinatorialRhombus({ edges, onAddEdge, onError, highlightedEdgeIndex = null, disabled = false }) {
  const [selectedSegment, setSelectedSegment] = useState(null);
  // For the first edge, we need to select both start and end segments
  const [firstEdgeStartSegment, setFirstEdgeStartSegment] = useState(null);
  
  const size = getSize();
  // Use same geometry as regular rhombus but without shear for combinatorial view
  const padding = 80;
  const viewBox = `-${padding} -${padding} ${size + 2 * padding} ${size + 2 * padding}`;
  
  // Get the straight (non-sheared) rhombus path for combinatorial visualization
  const straightRhombusPath = useMemo(() => {
    // For combinatorial mode, use a square-like rhombus
    // This makes geometric and combinatorial crossings coincide
    const nw = { x: 0, y: 0 };
    const ne = { x: size, y: 0 };
    const se = { x: size, y: size };
    const sw = { x: 0, y: size };
    return `M ${nw.x} ${nw.y} L ${ne.x} ${ne.y} L ${se.x} ${se.y} L ${sw.x} ${sw.y} Z`;
  }, [size]);
  
  // Get straight rhombus point coordinates
  const getStraightPointOnSide = useCallback((side, t) => {
    switch (side) {
      case 'north': return { x: t * size, y: 0 };
      case 'east': return { x: size, y: (1 - t) * size };
      case 'south': return { x: (1 - t) * size, y: size };
      case 'west': return { x: 0, y: t * size };
      default: return { x: 0, y: 0 };
    }
  }, [size]);
  
  // Get all segments for the current state
  const allSegments = useMemo(() => getAllSegments(edges), [edges]);
  
  // Get the current start point (continuation from last edge)
  const startPoint = useMemo(() => getNextEdgeStartPoint(edges), [edges]);
  
  // Get point coordinates for visualization
  const getVisualPointCoords = useCallback((point) => {
    const t = pointToT(point, edges);
    return getStraightPointOnSide(point.side, t);
  }, [edges, getStraightPointOnSide]);
  
  // Get segment highlight coordinates
  const getSegmentCoords = useCallback((segment) => {
    const { t1, t2 } = segmentToTRange(segment, edges);
    const p1 = getStraightPointOnSide(segment.side, t1);
    const p2 = getStraightPointOnSide(segment.side, t2);
    return { p1, p2 };
  }, [edges, getStraightPointOnSide]);
  
  // Handle segment selection
  const handleSegmentSelect = useCallback((segment) => {
    if (disabled) return;
    setSelectedSegment(segment);
  }, [disabled]);
  
  // Handle accept - add the new edge
  const handleAccept = useCallback(() => {
    if (disabled || !selectedSegment) return;
    
    // Handle first edge specially - need both start and end segments
    if (edges.length === 0) {
      if (!firstEdgeStartSegment) {
        // First click: set the start segment
        setFirstEdgeStartSegment(selectedSegment);
        setSelectedSegment(null);
        return;
      }
      
      // Second click: create the first edge from start segment to selected segment
      const fromPoint = createPointInSegment(firstEdgeStartSegment, []);
      
      // Create the end point - for the first edge, we need to handle same-side specially
      let toPoint;
      if (selectedSegment.side === firstEdgeStartSegment.side) {
        // Same side - create a point after the start point
        // We need to use a temporary edge list that includes the from point
        const tempEdges = [{ from: fromPoint, to: fromPoint }];
        toPoint = createPointInSegment(selectedSegment, tempEdges);
      } else {
        toPoint = createPointInSegment(selectedSegment, [{ from: fromPoint, to: fromPoint }]);
      }
      
      const newEdge = { from: fromPoint, to: toPoint };
      
      onAddEdge(newEdge);
      setSelectedSegment(null);
      setFirstEdgeStartSegment(null);
      return;
    }
    
    // Subsequent edges - use the continuation point as start
    if (!startPoint) {
      onError('No starting point available');
      return;
    }
    
    // Create the new point in the selected segment
    const newPoint = createPointInSegment(selectedSegment, edges);
    const newEdge = { from: startPoint, to: newPoint };
    
    // Validate the edge
    const validation = canAddEdge(newEdge, edges);
    if (!validation.valid) {
      onError(validation.error, validation.crossingEdgeIndex);
      return;
    }
    
    onAddEdge(newEdge);
    setSelectedSegment(null);
  }, [disabled, selectedSegment, edges, startPoint, onAddEdge, onError, firstEdgeStartSegment]);
  
  // Get all points to render
  const allPoints = useMemo(() => {
    const points = [];
    for (const side of SIDES) {
      const sidePoints = getPointsOnSide(edges, side);
      for (const pt of sidePoints) {
        points.push({ ...pt, coords: getVisualPointCoords(pt) });
      }
    }
    return points;
  }, [edges, getVisualPointCoords]);
  
  // Side label positions
  const sideLabels = useMemo(() => [
    { side: 'north', x: size / 2, y: -30, label: 'North (W→E)' },
    { side: 'east', x: size + 40, y: size / 2, label: 'East (S→N)' },
    { side: 'south', x: size / 2, y: size + 40, label: 'South (E→W)' },
    { side: 'west', x: -50, y: size / 2, label: 'West (N→S)' },
  ], [size]);
  
  return (
    <div className="combinatorial-rhombus-container">
      <div className="combinatorial-rhombus-main">
        {/* SVG Visualization */}
        <div className="combinatorial-svg-container">
          <svg viewBox={viewBox} className="combinatorial-rhombus-svg">
            {/* Rhombus outline */}
            <path d={straightRhombusPath} className="combinatorial-rhombus-path" />
            
            {/* Side labels */}
            {sideLabels.map(({ side, x, y, label }) => (
              <text 
                key={side} 
                x={x} 
                y={y} 
                className="combinatorial-side-label" 
                textAnchor="middle" 
                dominantBaseline="middle"
              >
                {label}
              </text>
            ))}
            
            {/* Highlighted selected start segment for first edge */}
            {firstEdgeStartSegment && (() => {
              const { p1, p2 } = getSegmentCoords(firstEdgeStartSegment);
              return (
                <line
                  x1={p1.x}
                  y1={p1.y}
                  x2={p2.x}
                  y2={p2.y}
                  className="combinatorial-first-segment-selected"
                />
              );
            })()}
            
            {/* Highlighted segment */}
            {selectedSegment && (() => {
              const { p1, p2 } = getSegmentCoords(selectedSegment);
              return (
                <line
                  x1={p1.x}
                  y1={p1.y}
                  x2={p2.x}
                  y2={p2.y}
                  className="combinatorial-segment-highlight"
                />
              );
            })()}
            
            {/* Edges */}
            {edges.map((edge, index) => {
              const fromCoords = getVisualPointCoords(edge.from);
              const toCoords = getVisualPointCoords(edge.to);
              const isHighlighted = highlightedEdgeIndex === index;
              
              // Calculate midpoint and arrow rotation
              const midX = (fromCoords.x + toCoords.x) / 2;
              const midY = (fromCoords.y + toCoords.y) / 2;
              const dx = toCoords.x - fromCoords.x;
              const dy = toCoords.y - fromCoords.y;
              const angle = Math.atan2(dy, dx) * (180 / Math.PI);
              
              return (
                <g key={index}>
                  <line
                    x1={fromCoords.x}
                    y1={fromCoords.y}
                    x2={toCoords.x}
                    y2={toCoords.y}
                    className={`combinatorial-edge-line ${isHighlighted ? 'combinatorial-edge-problem' : ''}`}
                  />
                  <text
                    x={midX}
                    y={midY}
                    className="combinatorial-edge-arrow"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    transform={`rotate(${angle}, ${midX}, ${midY})`}
                  >
                    ▶
                  </text>
                </g>
              );
            })}
            
            {/* Points */}
            {allPoints.map((pt, index) => (
              <g key={`point-${index}`}>
                <circle
                  cx={pt.coords.x}
                  cy={pt.coords.y}
                  r={6}
                  className="combinatorial-point"
                />
                <text
                  x={pt.coords.x}
                  y={pt.coords.y - 12}
                  className="combinatorial-point-label"
                  textAnchor="middle"
                >
                  {pt.position}
                </text>
              </g>
            ))}
            
            {/* Current start point indicator */}
            {startPoint && (() => {
              const coords = getVisualPointCoords(startPoint);
              return (
                <circle
                  cx={coords.x}
                  cy={coords.y}
                  r={10}
                  className="combinatorial-start-point"
                />
              );
            })()}
          </svg>
        </div>
        
        {/* Segment Selection Panel */}
        <div className="combinatorial-segment-panel">
          <h3>Select Target Segment</h3>
          {edges.length === 0 && !firstEdgeStartSegment ? (
            <p className="combinatorial-instruction">
              Step 1: Select where to place the <strong>starting point</strong>.
            </p>
          ) : edges.length === 0 && firstEdgeStartSegment ? (
            <p className="combinatorial-instruction">
              Start point will be on <strong>{firstEdgeStartSegment.side}</strong>.
              <br />
              Step 2: Select where to place the <strong>endpoint</strong>.
            </p>
          ) : startPoint ? (
            <p className="combinatorial-instruction">
              Current position: <strong>{startPoint.side}</strong> point {startPoint.position}
              <br />
              Select a segment to place the next point.
            </p>
          ) : null}
          
          {disabled ? (
            <p className="combinatorial-instruction disabled">
              Loop is closed. Click "Open Loop" to continue editing.
            </p>
          ) : (
            <div className="combinatorial-segment-list">
              {SIDES.map(side => (
                <div key={side} className="combinatorial-side-group">
                  <h4>{side.charAt(0).toUpperCase() + side.slice(1)}</h4>
                  {allSegments[side].map((segment, idx) => {
                    const segmentId = `${side}-${idx}`;
                    const isSelected = selectedSegment && 
                      selectedSegment.side === segment.side && 
                      selectedSegment.afterPosition === segment.afterPosition;
                    
                    return (
                      <label key={segmentId} className="combinatorial-segment-option">
                        <input
                          type="radio"
                          name="segment"
                          checked={isSelected}
                          onChange={() => handleSegmentSelect(segment)}
                          disabled={disabled}
                        />
                        <span className="combinatorial-segment-label">
                          {getSegmentLabel(segment)}
                        </span>
                      </label>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
          
          {!disabled && (
            <button
              onClick={handleAccept}
              disabled={!selectedSegment}
              className="combinatorial-accept-btn"
            >
              Accept
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default CombinatorialRhombus;
