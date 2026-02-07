import { useState, useCallback } from 'react';
import {
  getRhombusPath,
  getPointOnSide,
  getPointCoordinates,
  getInteriorPoint,
  getSize,
  getShear,
  findClosestPointOnBoundary,
  findInteriorPoint,
  pointsAreEqual,
  getIdentifiedSide,
  isInteriorPoint
} from '../utils/geometry.js';
import { getEdgeCoordinates, canAddEdge, getNextEdgeStartPoints, isSameSideEdge } from '../utils/pathLogic.js';
import './Rhombus.css';

// Snap radius for boundary detection (in SVG units)
const SNAP_RADIUS = 20;

/**
 * Check if an interior point is within valid bounds [0,1]^2.
 */
function isValidInteriorPoint(interior) {
  return interior.southward >= 0 && interior.southward <= 1 && 
         interior.eastward >= 0 && interior.eastward <= 1;
}

/**
 * Calculate direction arrow symbol and rotation for an edge.
 * Returns { symbol: '▶', rotation: degrees }
 */
function getEdgeArrow(edge) {
  const from = getPointCoordinates(edge.from);
  const to = getPointCoordinates(edge.to);
  
  // Calculate angle in degrees
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const angle = Math.atan2(dy, dx) * (180 / Math.PI);
  
  return { symbol: '▶', rotation: angle };
}

/**
 * Rhombus component - renders the rhombus visualization with edges and direction arrows.
 * @param {Object[]} edges - Array of edge objects defining the path
 * @param {function} onAddEdge - Callback when a new edge is added
 * @param {Object|null} selectedStartPoint - Currently selected start point for next edge
 * @param {function} onSelectStartPoint - Callback to set selected start point
 * @param {function} onError - Callback for error messages, receives (message, crossingEdgeIndex?)
 * @param {boolean} interiorMode - Whether to allow selecting interior points
 * @param {number|null} highlightedEdgeIndex - Index of edge to highlight (for crossing errors)
 */
function Rhombus({ edges, onAddEdge, selectedStartPoint, onSelectStartPoint, onError, interiorMode = false, highlightedEdgeIndex = null }) {
  const [hoverPoint, setHoverPoint] = useState(null);
  
  const size = getSize();
  const shear = getShear();
  const padding = shear / 2 + 50;
  const viewBox = `${-padding} ${-padding} ${size + 2 * padding} ${size + 2 * padding}`;
  const rhombusPath = getRhombusPath();
  
  // Convert screen coordinates from mouse event
  const getMouseCoords = useCallback((e) => {
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width * (size + 2 * padding) - padding;
    const y = (e.clientY - rect.top) / rect.height * (size + 2 * padding) - padding;
    return { x, y };
  }, [size, padding]);
  
  // Handle mouse move for hover feedback
  const handleMouseMove = useCallback((e) => {
    const { x, y } = getMouseCoords(e);
    const forceInterior = e.shiftKey && interiorMode && selectedStartPoint;
    
    // If shift is held and interior mode is on, show interior point directly
    if (forceInterior) {
      const interior = findInteriorPoint(x, y);
      if (isValidInteriorPoint(interior)) {
        setHoverPoint(interior);
        return;
      }
    }
    
    // Always show nearest boundary point (interior only with Shift)
    const closest = findClosestPointOnBoundary(x, y);
    setHoverPoint(closest);
  }, [getMouseCoords, interiorMode, selectedStartPoint]);
  
  const handleMouseLeave = useCallback(() => {
    setHoverPoint(null);
  }, []);
  
  // Helper to auto-select the next continuation point after adding an edge
  const autoSelectNextStartPoint = useCallback((newEdges) => {
    const startPoints = getNextEdgeStartPoints(newEdges);
    if (startPoints && startPoints.length > 0) {
      onSelectStartPoint(startPoints[0]);
    } else {
      onSelectStartPoint(null);
    }
  }, [onSelectStartPoint]);

  // Handle click to add edges
  const handleClick = useCallback((e) => {
    const { x, y } = getMouseCoords(e);
    const forceInterior = e.shiftKey && interiorMode && selectedStartPoint;
    
    // Determine clicked point
    const closestBoundary = findClosestPointOnBoundary(x, y);
    let clickedPoint = null;
    
    // If shift is held and interior mode on, force interior point
    if (forceInterior) {
      const interior = findInteriorPoint(x, y);
      if (isValidInteriorPoint(interior)) {
        clickedPoint = { interior: true, southward: interior.southward, eastward: interior.eastward };
      }
    } else {
      // Always snap to nearest boundary point (makes mobile/touch interaction easier)
      // Interior points only happen with explicit Shift+click
      clickedPoint = { side: closestBoundary.side, t: closestBoundary.t };
    }
    
    if (!clickedPoint) return;
    
    // First edge case
    if (edges.length === 0) {
      if (!selectedStartPoint) {
        if (isInteriorPoint(clickedPoint)) {
          onError('First point must be on the boundary');
          return;
        }
        onSelectStartPoint(clickedPoint);
      } else {
        if (pointsAreEqual(selectedStartPoint, clickedPoint)) {
          onError('Cannot create an edge to the same point');
          onSelectStartPoint(null);
          return;
        }
        
        const newEdge = { from: selectedStartPoint, to: clickedPoint };
        if (isSameSideEdge(newEdge)) {
          onError('Same-side edges are forbidden');
          onSelectStartPoint(null);
          return;
        }
        
        onAddEdge(newEdge);
        // Auto-chain: automatically select the next start point
        autoSelectNextStartPoint([newEdge]);
      }
      return;
    }
    
    // Subsequent edges - auto-chain mode: always have a start point selected
    if (selectedStartPoint) {
      const newEdge = { from: selectedStartPoint, to: clickedPoint };
      const validation = canAddEdge(newEdge, edges);
      
      if (!validation.valid) {
        onError(validation.error, validation.crossingEdgeIndex);
        // Keep the current start point selected for retry
        return;
      }
      
      onAddEdge(newEdge);
      // Auto-chain: automatically select the next start point
      autoSelectNextStartPoint([...edges, newEdge]);
    }
  }, [edges, selectedStartPoint, onAddEdge, onSelectStartPoint, onError, getMouseCoords, interiorMode, autoSelectNextStartPoint]);
  
  // Corner positions for labels
  const nw = getPointOnSide('north', 0);
  const ne = getPointOnSide('north', 1);
  const se = getPointOnSide('south', 0);
  const sw = getPointOnSide('south', 1);
  
  const labelOffset = 25;
  const sideLabels = [
    { key: 'north', x: (nw.x + ne.x) / 2, y: (nw.y + ne.y) / 2 - labelOffset, label: 'North (W→E)' },
    { key: 'east', x: (ne.x + se.x) / 2 + labelOffset + 10, y: (ne.y + se.y) / 2, label: 'East (S→N)' },
    { key: 'south', x: (se.x + sw.x) / 2, y: (se.y + sw.y) / 2 + labelOffset + 10, label: 'South (E→W)' },
    { key: 'west', x: (sw.x + nw.x) / 2 - labelOffset - 40, y: (sw.y + nw.y) / 2, label: 'West (N→S)' }
  ];
  
  return (
    <div className="rhombus-container">
      <svg
        viewBox={viewBox}
        className="rhombus-svg"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
      >
        {/* Rhombus outline */}
        <path d={rhombusPath} className="rhombus-path" />
        
        {/* Corner angle indicators */}
        <text x={ne.x + 10} y={ne.y - 10} className="angle-text" fontSize="10">120°</text>
        <text x={sw.x - 25} y={sw.y + 15} className="angle-text" fontSize="10">120°</text>
        <text x={nw.x - 25} y={nw.y - 5} className="angle-text" fontSize="10">60°</text>
        <text x={se.x + 10} y={se.y + 15} className="angle-text" fontSize="10">60°</text>
        
        {/* Identification indicators */}
        <text x={ne.x + 35} y={ne.y - 25} className="identification-text" fontSize="10">N≡E</text>
        <text x={sw.x - 45} y={sw.y + 30} className="identification-text" fontSize="10">S≡W</text>
        
        {/* Side labels */}
        {sideLabels.map(({ key, x, y, label }) => (
          <text key={key} x={x} y={y} className="side-label" textAnchor="middle" dominantBaseline="middle" fontSize="12">
            {label}
          </text>
        ))}
        
        {/* Edges with direction arrows */}
        {edges.map((edge, index) => {
          const coords = getEdgeCoordinates(edge);
          const isHighlighted = highlightedEdgeIndex === index;
          const midX = (coords.from.x + coords.to.x) / 2;
          const midY = (coords.from.y + coords.to.y) / 2;
          const arrow = getEdgeArrow(edge);
          
          return (
            <g key={index}>
              <line
                x1={coords.from.x}
                y1={coords.from.y}
                x2={coords.to.x}
                y2={coords.to.y}
                className={`edge-line ${isHighlighted ? 'edge-line-problem' : ''}`}
                strokeWidth={isHighlighted ? 5 : 3}
              />
              <text
                x={midX}
                y={midY}
                className="edge-arrow"
                fontSize="12"
                textAnchor="middle"
                dominantBaseline="middle"
                transform={`rotate(${arrow.rotation}, ${midX}, ${midY})`}
              >
                {arrow.symbol}
              </text>
            </g>
          );
        })}
        
        {/* Edge endpoints */}
        {edges.map((edge, edgeIndex) => {
          const fromCoords = getPointCoordinates(edge.from);
          const toCoords = getPointCoordinates(edge.to);
          return (
            <g key={`points-${edgeIndex}`}>
              <circle
                cx={fromCoords.x}
                cy={fromCoords.y}
                r="5"
                className={isInteriorPoint(edge.from) ? 'interior-point' : 'edge-point'}
              />
              <circle
                cx={toCoords.x}
                cy={toCoords.y}
                r="5"
                className={isInteriorPoint(edge.to) ? 'interior-point' : 'edge-point'}
              />
            </g>
          );
        })}
        
        {/* Next start points */}
        {edges.length > 0 && !selectedStartPoint && getNextEdgeStartPoints(edges)?.map((sp, index) => {
          const coords = getPointCoordinates(sp);
          return (
            <circle
              key={`start-${index}`}
              cx={coords.x}
              cy={coords.y}
              r="8"
              className="next-start-point"
            />
          );
        })}
        
        {/* Selected start point */}
        {selectedStartPoint && (
          <circle
            cx={getPointCoordinates(selectedStartPoint).x}
            cy={getPointCoordinates(selectedStartPoint).y}
            r="8"
            className="selected-start-point"
          />
        )}
        
        {/* Preview line */}
        {selectedStartPoint && hoverPoint && (() => {
          const startCoords = getPointCoordinates(selectedStartPoint);
          const endCoords = isInteriorPoint(hoverPoint)
            ? getInteriorPoint(hoverPoint.southward, hoverPoint.eastward)
            : getPointOnSide(hoverPoint.side, hoverPoint.t);
          return (
            <line
              x1={startCoords.x}
              y1={startCoords.y}
              x2={endCoords.x}
              y2={endCoords.y}
              className="preview-line"
              strokeWidth="2"
              strokeDasharray="5,5"
            />
          );
        })()}
        
        {/* Hover points */}
        {hoverPoint && (isInteriorPoint(hoverPoint) ? (
          <circle
            cx={getInteriorPoint(hoverPoint.southward, hoverPoint.eastward).x}
            cy={getInteriorPoint(hoverPoint.southward, hoverPoint.eastward).y}
            r="6"
            className="hover-point-interior"
          />
        ) : (
          <>
            <circle
              cx={getPointOnSide(hoverPoint.side, hoverPoint.t).x}
              cy={getPointOnSide(hoverPoint.side, hoverPoint.t).y}
              r="6"
              className="hover-point"
            />
            <circle
              cx={getPointOnSide(getIdentifiedSide(hoverPoint.side), hoverPoint.t).x}
              cy={getPointOnSide(getIdentifiedSide(hoverPoint.side), hoverPoint.t).y}
              r="6"
              className="hover-point-complementary"
            />
          </>
        ))}
      </svg>
      
      <div className="rhombus-instructions">
        {edges.length === 0 && !selectedStartPoint && (
          <p>Click anywhere to select a starting point on the boundary.</p>
        )}
        {selectedStartPoint && (
          <p>Click to add the next point.{interiorMode ? ' Hold Shift for interior.' : ''}</p>
        )}
      </div>
    </div>
  );
}

export default Rhombus;
