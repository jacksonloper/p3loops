import { useState, useCallback, useEffect, useRef } from 'react';
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

// Pastel colors for beads
const PASTEL_COLORS = [
  '#FFB3BA', // pastel pink
  '#BAFFC9', // pastel green
  '#BAE1FF', // pastel blue
  '#FFFFBA', // pastel yellow
  '#FFDFBA', // pastel orange
  '#E0BBE4', // pastel purple
  '#D4F0F0', // pastel cyan
  '#FCE1E4', // pastel rose
];

// Calculate position along the path given a proportion (0-1)
function getPositionOnPath(edges, proportion) {
  if (edges.length === 0) return null;
  
  // Each edge takes equal time to traverse (regardless of length)
  const edgeCount = edges.length;
  const scaledProportion = proportion * edgeCount;
  const edgeIndex = Math.min(Math.floor(scaledProportion), edgeCount - 1);
  const withinEdgeProportion = scaledProportion - edgeIndex;
  
  const edge = edges[edgeIndex];
  const fromCoords = getPointCoordinates(edge.from);
  const toCoords = getPointCoordinates(edge.to);
  
  // Linear interpolation along the edge
  return {
    x: fromCoords.x + (toCoords.x - fromCoords.x) * withinEdgeProportion,
    y: fromCoords.y + (toCoords.y - fromCoords.y) * withinEdgeProportion
  };
}

/**
 * Rhombus component - renders the rhombus visualization with edges and animated beads.
 * @param {Object[]} edges - Array of edge objects defining the path
 * @param {function} onAddEdge - Callback when a new edge is added
 * @param {Object|null} selectedStartPoint - Currently selected start point for next edge
 * @param {function} onSelectStartPoint - Callback to set selected start point
 * @param {function} onError - Callback for error messages
 * @param {number} beadCount - Number of animated beads to display (0-10)
 * @param {number} beadSpeed - Animation speed in cycles per second (how many times a bead completes the path per second)
 * @param {boolean} interiorMode - Whether to allow selecting interior points
 */
function Rhombus({ edges, onAddEdge, selectedStartPoint, onSelectStartPoint, onError, beadCount = 3, beadSpeed = 0.5, interiorMode = false }) {
  const [hoverPoint, setHoverPoint] = useState(null);
  const [beadPhase, setBeadPhase] = useState(0);
  const animationRef = useRef(null);
  const lastTimeRef = useRef(null);
  
  const size = getSize();
  const shear = getShear();
  const padding = shear / 2 + 50;
  const viewBox = `${-padding} ${-padding} ${size + 2 * padding} ${size + 2 * padding}`;
  
  const rhombusPath = getRhombusPath();
  
  // Animate beads - only run animation when there are edges and beads
  const shouldAnimate = edges.length > 0 && beadCount > 0;
  
  useEffect(() => {
    if (!shouldAnimate) {
      // Cancel any existing animation when path is empty or no beads
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      lastTimeRef.current = null;
      return;
    }
    
    const animate = (timestamp) => {
      if (lastTimeRef.current === null) {
        lastTimeRef.current = timestamp;
      }
      
      const deltaTime = timestamp - lastTimeRef.current;
      lastTimeRef.current = timestamp;
      
      const phaseIncrement = (beadSpeed * deltaTime) / 1000;
      
      setBeadPhase(prev => (prev + phaseIncrement) % 1);
      
      animationRef.current = requestAnimationFrame(animate);
    };
    
    animationRef.current = requestAnimationFrame(animate);
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      lastTimeRef.current = null;
    };
  }, [shouldAnimate, beadSpeed]);
  
  // Handle mouse move to track hover position on the boundary or interior
  const handleMouseMove = useCallback((e) => {
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width * (size + 2 * padding) - padding;
    const y = (e.clientY - rect.top) / rect.height * (size + 2 * padding) - padding;
    
    // If in interior mode when a start point is selected, find interior point
    if (interiorMode && selectedStartPoint) {
      const interior = findInteriorPoint(x, y);
      // Only show interior point if it's actually inside
      if (interior.southward >= 0 && interior.southward <= 1 && 
          interior.eastward >= 0 && interior.eastward <= 1) {
        setHoverPoint(interior);
        return;
      }
    }
    
    // Otherwise, find closest boundary point
    const closest = findClosestPointOnBoundary(x, y, false);
    if (closest.distance < 30) {
      setHoverPoint(closest);
    } else if (interiorMode && selectedStartPoint) {
      // If in interior mode, also check interior
      const interior = findInteriorPoint(x, y);
      if (interior.southward >= 0 && interior.southward <= 1 && 
          interior.eastward >= 0 && interior.eastward <= 1) {
        setHoverPoint(interior);
      } else {
        setHoverPoint(null);
      }
    } else {
      setHoverPoint(null);
    }
  }, [size, padding, interiorMode, selectedStartPoint]);
  
  const handleMouseLeave = useCallback(() => {
    setHoverPoint(null);
  }, []);
  
  // Handle click on the boundary or interior
  const handleClick = useCallback((e) => {
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width * (size + 2 * padding) - padding;
    const y = (e.clientY - rect.top) / rect.height * (size + 2 * padding) - padding;
    
    // Find the closest point (boundary or interior based on mode)
    const closestBoundary = findClosestPointOnBoundary(x, y, false);
    let clickedPoint = null;
    
    // Check if clicking on a boundary point
    if (closestBoundary.distance < 30) {
      clickedPoint = { side: closestBoundary.side, t: closestBoundary.t };
    } else if (interiorMode && selectedStartPoint) {
      // If in interior mode with start point selected, allow interior points
      const interior = findInteriorPoint(x, y);
      if (interior.southward >= 0 && interior.southward <= 1 && 
          interior.eastward >= 0 && interior.eastward <= 1) {
        clickedPoint = { interior: true, southward: interior.southward, eastward: interior.eastward };
      }
    }
    
    if (!clickedPoint) return;
    
    // If no edges yet, we're starting fresh
    if (edges.length === 0) {
      // If no start point selected, select this as the start (only boundary points for first)
      if (!selectedStartPoint) {
        if (isInteriorPoint(clickedPoint)) {
          onError('First point must be on the boundary (interior points are only allowed after the first edge)');
          return;
        }
        onSelectStartPoint(clickedPoint);
      } else {
        // We have a start point, create the first edge
        const newEdge = {
          from: selectedStartPoint,
          to: clickedPoint
        };
        
        // Check if it's a valid edge (not going to the same point)
        if (pointsAreEqual(selectedStartPoint, clickedPoint)) {
          onError('Cannot create an edge to the same point');
          onSelectStartPoint(null);
          return;
        }
        
        // Check for same-side edges
        if (isSameSideEdge(newEdge)) {
          onError('Same-side edges are forbidden');
          onSelectStartPoint(null);
          return;
        }
        
        onAddEdge(newEdge);
        onSelectStartPoint(null);
      }
      return;
    }
    
    // We have existing edges
    const startPoints = getNextEdgeStartPoints(edges);
    
    // Check if user clicked on one of the valid start points
    const clickedOnStart = startPoints && startPoints.some(sp => {
      const spCoords = getPointCoordinates(sp);
      const dist = Math.sqrt((spCoords.x - x) ** 2 + (spCoords.y - y) ** 2);
      return dist < 20;
    });
    
    if (clickedOnStart && !selectedStartPoint) {
      // Find which start point was clicked
      for (const sp of startPoints) {
        const spCoords = getPointCoordinates(sp);
        const dist = Math.sqrt((spCoords.x - x) ** 2 + (spCoords.y - y) ** 2);
        if (dist < 20) {
          onSelectStartPoint(sp);
          return;
        }
      }
    }
    
    // If we have a start point selected, create an edge
    if (selectedStartPoint) {
      const newEdge = {
        from: selectedStartPoint,
        to: clickedPoint
      };
      
      // Check if valid
      const validation = canAddEdge(newEdge, edges);
      if (!validation.valid) {
        onError(validation.error);
        onSelectStartPoint(null);
        return;
      }
      
      onAddEdge(newEdge);
      onSelectStartPoint(null);
    }
  }, [edges, selectedStartPoint, onAddEdge, onSelectStartPoint, onError, size, padding, interiorMode]);
  
  // Render the edges
  const edgeElements = edges.map((edge, index) => {
    const coords = getEdgeCoordinates(edge);
    return (
      <line
        key={index}
        x1={coords.from.x}
        y1={coords.from.y}
        x2={coords.to.x}
        y2={coords.to.y}
        className="edge-line"
        strokeWidth="3"
      />
    );
  });
  
  // Render edge endpoints
  const pointElements = [];
  edges.forEach((edge, edgeIndex) => {
    const fromCoords = getPointCoordinates(edge.from);
    const toCoords = getPointCoordinates(edge.to);
    
    pointElements.push(
      <circle
        key={`from-${edgeIndex}`}
        cx={fromCoords.x}
        cy={fromCoords.y}
        r="5"
        className={isInteriorPoint(edge.from) ? "interior-point" : "edge-point"}
      />
    );
    pointElements.push(
      <circle
        key={`to-${edgeIndex}`}
        cx={toCoords.x}
        cy={toCoords.y}
        r="5"
        className={isInteriorPoint(edge.to) ? "interior-point" : "edge-point"}
      />
    );
  });
  
  // Render the possible start points for the next edge
  const startPointElements = [];
  if (edges.length > 0 && !selectedStartPoint) {
    const startPoints = getNextEdgeStartPoints(edges);
    if (startPoints) {
      startPoints.forEach((sp, index) => {
        const coords = getPointCoordinates(sp);
        startPointElements.push(
          <circle
            key={`start-${index}`}
            cx={coords.x}
            cy={coords.y}
            r="8"
            className="next-start-point"
          />
        );
      });
    }
  }
  
  // Render selected start point
  let selectedPointElement = null;
  if (selectedStartPoint) {
    const coords = getPointCoordinates(selectedStartPoint);
    selectedPointElement = (
      <circle
        cx={coords.x}
        cy={coords.y}
        r="8"
        className="selected-start-point"
      />
    );
  }
  
  // Render hover point and its complementary version (only for boundary points)
  const hoverElements = [];
  if (hoverPoint) {
    if (isInteriorPoint(hoverPoint)) {
      // Interior hover point
      const hoverCoords = getInteriorPoint(hoverPoint.southward, hoverPoint.eastward);
      hoverElements.push(
        <circle
          key="hover-interior"
          cx={hoverCoords.x}
          cy={hoverCoords.y}
          r="6"
          className="hover-point-interior"
        />
      );
    } else {
      // Boundary hover point
      const hoverCoords = getPointOnSide(hoverPoint.side, hoverPoint.t);
      const complementarySide = getIdentifiedSide(hoverPoint.side);
      const complementaryCoords = getPointOnSide(complementarySide, hoverPoint.t);
      
      // Primary hover point
      hoverElements.push(
        <circle
          key="hover-primary"
          cx={hoverCoords.x}
          cy={hoverCoords.y}
          r="6"
          className="hover-point"
        />
      );
      
      // Complementary hover point (on the identified side)
      hoverElements.push(
        <circle
          key="hover-complementary"
          cx={complementaryCoords.x}
          cy={complementaryCoords.y}
          r="6"
          className="hover-point-complementary"
        />
      );
    }
  }
  
  // Preview line from selected start to hover
  let previewLine = null;
  if (selectedStartPoint && hoverPoint) {
    const startCoords = getPointCoordinates(selectedStartPoint);
    const endCoords = isInteriorPoint(hoverPoint) 
      ? getInteriorPoint(hoverPoint.southward, hoverPoint.eastward)
      : getPointOnSide(hoverPoint.side, hoverPoint.t);
    
    previewLine = (
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
  }
  
  // Side labels - adjust positions for rhombus
  const nw = getPointOnSide('north', 0);
  const ne = getPointOnSide('north', 1);
  const se = getPointOnSide('south', 0);
  const sw = getPointOnSide('south', 1);
  
  const labelOffset = 25;
  const labels = [
    { side: 'north', x: (nw.x + ne.x) / 2, y: (nw.y + ne.y) / 2 - labelOffset, label: 'North (W→E)' },
    { side: 'east', x: (ne.x + se.x) / 2 + labelOffset + 10, y: (ne.y + se.y) / 2, label: 'East (S→N)' },
    { side: 'south', x: (se.x + sw.x) / 2, y: (se.y + sw.y) / 2 + labelOffset + 10, label: 'South (E→W)' },
    { side: 'west', x: (sw.x + nw.x) / 2 - labelOffset - 40, y: (sw.y + nw.y) / 2, label: 'West (N→S)' }
  ];
  
  // Render animated beads
  const beadElements = [];
  if (edges.length > 0 && beadCount > 0) {
    for (let i = 0; i < beadCount; i++) {
      // Distribute beads evenly along the path, offset by beadPhase
      const beadProportion = ((i / beadCount) + beadPhase) % 1;
      const pos = getPositionOnPath(edges, beadProportion);
      if (pos) {
        beadElements.push(
          <circle
            key={`bead-${i}`}
            cx={pos.x}
            cy={pos.y}
            r="6"
            fill={PASTEL_COLORS[i % PASTEL_COLORS.length]}
            className="path-bead"
          />
        );
      }
    }
  }
  
  return (
    <div className="rhombus-container">
      <svg
        viewBox={viewBox}
        className="rhombus-svg"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
      >
        {/* The rhombus outline */}
        <path d={rhombusPath} className="rhombus-path" />
        
        {/* Corner angle indicators */}
        <text x={ne.x + 10} y={ne.y - 10} className="angle-text" fontSize="10">
          120°
        </text>
        <text x={sw.x - 25} y={sw.y + 15} className="angle-text" fontSize="10">
          120°
        </text>
        <text x={nw.x - 25} y={nw.y - 5} className="angle-text" fontSize="10">
          60°
        </text>
        <text x={se.x + 10} y={se.y + 15} className="angle-text" fontSize="10">
          60°
        </text>
        
        {/* Identification indicators */}
        <text x={ne.x + 35} y={ne.y - 25} className="identification-text" fontSize="10">
          N≡E
        </text>
        <text x={sw.x - 45} y={sw.y + 30} className="identification-text" fontSize="10">
          S≡W
        </text>
        
        {/* Side labels */}
        {labels.map(({ side, x, y, label }) => (
          <text
            key={side}
            x={x}
            y={y}
            className="side-label"
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize="12"
          >
            {label}
          </text>
        ))}
        
        {/* Edges */}
        {edgeElements}
        
        {/* Animated beads on path */}
        {beadElements}
        
        {/* Edge endpoints */}
        {pointElements}
        
        {/* Possible next start points */}
        {startPointElements}
        
        {/* Selected start point */}
        {selectedPointElement}
        
        {/* Preview line */}
        {previewLine}
        
        {/* Hover points (both primary and complementary for boundary, single for interior) */}
        {hoverElements}
      </svg>
      
      <div className="rhombus-instructions">
        {edges.length === 0 && !selectedStartPoint && (
          <p>Click on the boundary to select a starting point for your first edge.</p>
        )}
        {edges.length === 0 && selectedStartPoint && (
          <p>Now click on another point to create your first edge. {interiorMode ? 'Interior points are enabled.' : ''}</p>
        )}
        {edges.length > 0 && !selectedStartPoint && (
          <p>Click on the highlighted point to continue the path, or use the controls below.</p>
        )}
        {edges.length > 0 && selectedStartPoint && (
          <p>Click on a point to create the next edge. {interiorMode ? 'Click inside for interior points.' : ''} Same-side edges are forbidden.</p>
        )}
      </div>
    </div>
  );
}

export default Rhombus;
