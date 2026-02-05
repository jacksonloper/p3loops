import { useState, useCallback, useEffect, useRef } from 'react';
import {
  getSquarePath,
  getPointOnSide,
  getSize,
  getBow,
  findClosestPointOnBoundary,
  pointsAreEqual,
  getIdentifiedSide
} from '../utils/geometry.js';
import { getEdgeCoordinates, canAddEdge, getNextEdgeStartPoints } from '../utils/pathLogic.js';
import './BowedSquare.css';

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
  const fromCoords = getPointOnSide(edge.from.side, edge.from.t);
  const toCoords = getPointOnSide(edge.to.side, edge.to.t);
  
  // Linear interpolation along the edge
  return {
    x: fromCoords.x + (toCoords.x - fromCoords.x) * withinEdgeProportion,
    y: fromCoords.y + (toCoords.y - fromCoords.y) * withinEdgeProportion
  };
}

/**
 * BowedSquare component - renders the bowed square visualization with edges and animated beads.
 * @param {Object[]} edges - Array of edge objects defining the path
 * @param {function} onAddEdge - Callback when a new edge is added
 * @param {Object|null} selectedStartPoint - Currently selected start point for next edge
 * @param {function} onSelectStartPoint - Callback to set selected start point
 * @param {function} onError - Callback for error messages
 * @param {number} beadCount - Number of animated beads to display (0-10)
 * @param {number} beadSpeed - Animation speed in cycles per second (how many times a bead completes the path per second)
 */
function BowedSquare({ edges, onAddEdge, selectedStartPoint, onSelectStartPoint, onError, beadCount = 3, beadSpeed = 0.5 }) {
  const [hoverPoint, setHoverPoint] = useState(null);
  const [beadPhase, setBeadPhase] = useState(0);
  const animationRef = useRef(null);
  const lastTimeRef = useRef(null);
  
  const size = getSize();
  const bow = getBow();
  const padding = bow + 30;
  const viewBox = `${-padding} ${-padding} ${size + 2 * padding} ${size + 2 * padding}`;
  
  const squarePath = getSquarePath();
  
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
  
  // Handle mouse move to track hover position on the boundary
  const handleMouseMove = useCallback((e) => {
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width * (size + 2 * padding) - padding;
    const y = (e.clientY - rect.top) / rect.height * (size + 2 * padding) - padding;
    
    const closest = findClosestPointOnBoundary(x, y);
    if (closest.distance < 30) {
      setHoverPoint(closest);
    } else {
      setHoverPoint(null);
    }
  }, [size, padding]);
  
  const handleMouseLeave = useCallback(() => {
    setHoverPoint(null);
  }, []);
  
  // Handle click on the boundary
  const handleClick = useCallback((e) => {
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width * (size + 2 * padding) - padding;
    const y = (e.clientY - rect.top) / rect.height * (size + 2 * padding) - padding;
    
    const closest = findClosestPointOnBoundary(x, y);
    if (closest.distance > 30) return;
    
    const clickedPoint = { side: closest.side, t: closest.t };
    
    // If no edges yet, we're starting fresh
    if (edges.length === 0) {
      // If no start point selected, select this as the start
      if (!selectedStartPoint) {
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
        
        onAddEdge(newEdge);
        onSelectStartPoint(null);
      }
      return;
    }
    
    // We have existing edges
    const startPoints = getNextEdgeStartPoints(edges);
    
    // Check if user clicked on one of the valid start points
    const clickedOnStart = startPoints.some(sp => {
      const spCoords = getPointOnSide(sp.side, sp.t);
      const dist = Math.sqrt((spCoords.x - x) ** 2 + (spCoords.y - y) ** 2);
      return dist < 20;
    });
    
    if (clickedOnStart && !selectedStartPoint) {
      // Find which start point was clicked
      for (const sp of startPoints) {
        const spCoords = getPointOnSide(sp.side, sp.t);
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
  }, [edges, selectedStartPoint, onAddEdge, onSelectStartPoint, onError, size, padding]);
  
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
    const fromCoords = getPointOnSide(edge.from.side, edge.from.t);
    const toCoords = getPointOnSide(edge.to.side, edge.to.t);
    
    pointElements.push(
      <circle
        key={`from-${edgeIndex}`}
        cx={fromCoords.x}
        cy={fromCoords.y}
        r="5"
        className="edge-point"
      />
    );
    pointElements.push(
      <circle
        key={`to-${edgeIndex}`}
        cx={toCoords.x}
        cy={toCoords.y}
        r="5"
        className="edge-point"
      />
    );
  });
  
  // Render the two possible start points for the next edge
  const startPointElements = [];
  if (edges.length > 0 && !selectedStartPoint) {
    const startPoints = getNextEdgeStartPoints(edges);
    startPoints.forEach((sp, index) => {
      const coords = getPointOnSide(sp.side, sp.t);
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
  
  // Render selected start point
  const selectedPointElement = selectedStartPoint ? (
    <circle
      cx={getPointOnSide(selectedStartPoint.side, selectedStartPoint.t).x}
      cy={getPointOnSide(selectedStartPoint.side, selectedStartPoint.t).y}
      r="8"
      className="selected-start-point"
    />
  ) : null;
  
  // Render hover point and its complementary version
  const hoverElements = [];
  if (hoverPoint) {
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
  
  // Preview line from selected start to hover
  const previewLine = selectedStartPoint && hoverPoint ? (
    <line
      x1={getPointOnSide(selectedStartPoint.side, selectedStartPoint.t).x}
      y1={getPointOnSide(selectedStartPoint.side, selectedStartPoint.t).y}
      x2={getPointOnSide(hoverPoint.side, hoverPoint.t).x}
      y2={getPointOnSide(hoverPoint.side, hoverPoint.t).y}
      className="preview-line"
      strokeWidth="2"
      strokeDasharray="5,5"
    />
  ) : null;
  
  // Side labels
  const labelOffset = 25;
  const labels = [
    { side: 'north', x: size / 2, y: -labelOffset, label: 'North (W→E)' },
    { side: 'east', x: size + labelOffset + 10, y: size / 2, label: 'East (S→N)' },
    { side: 'south', x: size / 2, y: size + labelOffset + 10, label: 'South (E→W)' },
    { side: 'west', x: -labelOffset - 10, y: size / 2, label: 'West (N→S)' }
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
    <div className="bowed-square-container">
      <svg
        viewBox={viewBox}
        className="bowed-square-svg"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
      >
        {/* The bowed square outline */}
        <path d={squarePath} className="square-path" />
        
        {/* Identification indicators */}
        <text x={size + 35} y={-10} className="identification-text" fontSize="10">
          N≡E
        </text>
        <text x={-45} y={size + 20} className="identification-text" fontSize="10">
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
        
        {/* Hover points (both primary and complementary) */}
        {hoverElements}
      </svg>
      
      <div className="square-instructions">
        {edges.length === 0 && !selectedStartPoint && (
          <p>Click on the boundary to select a starting point for your first edge.</p>
        )}
        {edges.length === 0 && selectedStartPoint && (
          <p>Now click on another point to create your first edge.</p>
        )}
        {edges.length > 0 && !selectedStartPoint && (
          <p>Click on the highlighted point to continue the path, or use the controls below.</p>
        )}
        {edges.length > 0 && selectedStartPoint && (
          <p>Click on a point to create the next edge. The edge must not cross existing edges.</p>
        )}
      </div>
    </div>
  );
}

export default BowedSquare;
