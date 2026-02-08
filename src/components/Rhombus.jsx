import { useState, useCallback, useRef, useEffect } from 'react';
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
  isInteriorPoint,
  EPSILON
} from '../utils/geometry.js';
import { getEdgeCoordinates, canAddEdge, getNextEdgeStartPoints, isSameSideEdge } from '../utils/pathLogic.js';
import './Rhombus.css';

// Snap radius for boundary detection (in SVG units, at zoom level 1)
const BASE_SNAP_RADIUS = 20;

// Zoom configuration
const MIN_ZOOM = 1;
const MAX_ZOOM = 20;
const WHEEL_ZOOM_FACTOR = 1.1;

// Touch configuration
const TAP_MAX_DURATION_MS = 300;  // Maximum duration for a tap (vs pan)
const TAP_MAX_DISTANCE = 10;      // Maximum movement for a tap (in screen pixels)

/**
 * Check if an interior point is truly inside the rhombus (not on boundary).
 * Points with coordinates at 0 or 1 are ON the boundary, not interior.
 */
function isValidInteriorPoint(interior) {
  // Must be strictly inside the unit square, not on any edge
  return interior.southward > EPSILON && interior.southward < 1 - EPSILON && 
         interior.eastward > EPSILON && interior.eastward < 1 - EPSILON;
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
 * @param {boolean} disabled - Whether edge adding is disabled (e.g., when loop is closed)
 */
function Rhombus({ edges, onAddEdge, selectedStartPoint, onSelectStartPoint, onError, interiorMode = false, highlightedEdgeIndex = null, disabled = false }) {
  const [hoverPoint, setHoverPoint] = useState(null);
  
  // Zoom and pan state
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  
  // Track touch/drag state for distinguishing taps from pans
  const svgRef = useRef(null);
  const touchState = useRef({
    startTime: 0,
    startPos: null,
    startPan: null,
    isPanning: false,
    pinchStartDistance: null,
    pinchStartZoom: null,
    pinchCenter: null
  });
  
  const size = getSize();
  const shear = getShear();
  const padding = shear / 2 + 50;
  
  // Calculate dynamic viewBox based on zoom and pan
  const fullWidth = size + 2 * padding;
  const fullHeight = size + 2 * padding;
  const viewWidth = fullWidth / zoom;
  const viewHeight = fullHeight / zoom;
  const centerX = size / 2;
  const centerY = size / 2;
  // Pan is in screen pixels, convert to SVG units
  const viewX = centerX - viewWidth / 2 - pan.x / zoom;
  const viewY = centerY - viewHeight / 2 - pan.y / zoom;
  const viewBox = `${viewX} ${viewY} ${viewWidth} ${viewHeight}`;
  
  // Snap radius scales inversely with zoom (smaller in original space as we zoom in)
  const snapRadius = BASE_SNAP_RADIUS / zoom;
  const rhombusPath = getRhombusPath();
  
  // Scale factors for visual elements to maintain screen size when zooming
  // All sizes divided by zoom to appear constant on screen
  const strokeScale = 1 / zoom;
  const baseEdgeStrokeWidth = 3;
  const baseHighlightedStrokeWidth = 5;
  const basePointRadius = 5;
  const baseStartPointRadius = 8;
  const baseHoverRadius = 6;
  const baseFontSize = 12;
  const baseSmallFontSize = 10;
  const baseRhombusStrokeWidth = 2;
  
  // Convert screen coordinates from mouse/touch event to SVG coordinates
  const getMouseCoords = useCallback((e) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width * viewWidth + viewX;
    const y = (e.clientY - rect.top) / rect.height * viewHeight + viewY;
    return { x, y };
  }, [viewWidth, viewHeight, viewX, viewY]);
  
  // Handle mouse move for hover feedback
  const handleMouseMove = useCallback((e) => {
    // Don't show hover feedback when disabled
    if (disabled) {
      setHoverPoint(null);
      return;
    }
    
    const { x, y } = getMouseCoords(e);
    
    const closest = findClosestPointOnBoundary(x, y);
    const interior = findInteriorPoint(x, y);
    const isInsideRhombus = isValidInteriorPoint(interior);
    
    // If interior mode is enabled and we have a start point selected,
    // and cursor is inside the rhombus but not near boundary, show interior point
    if (interiorMode && selectedStartPoint && isInsideRhombus && closest.distance >= snapRadius) {
      setHoverPoint(interior);
    } else {
      // Near boundary or outside rhombus - show boundary point
      setHoverPoint(closest);
    }
  }, [getMouseCoords, interiorMode, selectedStartPoint, disabled, snapRadius]);
  
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
    // Don't allow adding edges when disabled
    if (disabled) return;
    
    const { x, y } = getMouseCoords(e);
    
    // Determine clicked point
    const closestBoundary = findClosestPointOnBoundary(x, y);
    const interior = findInteriorPoint(x, y);
    let clickedPoint = null;
    
    // Check if click is inside the rhombus (valid interior point)
    const isInsideRhombus = isValidInteriorPoint(interior);
    
    // If interior mode is enabled and we have a start point selected,
    // and click is inside the rhombus but not near boundary, use interior point
    if (interiorMode && selectedStartPoint && isInsideRhombus && closestBoundary.distance >= snapRadius) {
      clickedPoint = { interior: true, southward: interior.southward, eastward: interior.eastward };
    } else {
      // Near boundary or outside rhombus - snap to boundary
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
  }, [edges, selectedStartPoint, onAddEdge, onSelectStartPoint, onError, getMouseCoords, interiorMode, autoSelectNextStartPoint, disabled, snapRadius]);
  
  // Handle mouse wheel for zooming
  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? (1 / WHEEL_ZOOM_FACTOR) : WHEEL_ZOOM_FACTOR;
    setZoom(z => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z * delta)));
  }, []);
  
  // Add wheel listener with passive: false to allow preventDefault
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    svg.addEventListener('wheel', handleWheel, { passive: false });
    return () => svg.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);
  
  // Mouse drag handlers for panning
  const handleMouseDown = useCallback((e) => {
    // Only pan with left mouse button
    if (e.button !== 0) return;
    touchState.current = {
      ...touchState.current,
      startTime: Date.now(),
      startPos: { x: e.clientX, y: e.clientY },
      startPan: { ...pan },
      isPanning: false
    };
  }, [pan]);
  
  const handleMouseMoveForPan = useCallback((e) => {
    if (!touchState.current.startPos) return;
    
    const dx = e.clientX - touchState.current.startPos.x;
    const dy = e.clientY - touchState.current.startPos.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // If moved beyond tap threshold, it's a pan operation
    if (distance > TAP_MAX_DISTANCE) {
      touchState.current.isPanning = true;
      setPan({
        x: touchState.current.startPan.x + dx,
        y: touchState.current.startPan.y + dy
      });
    }
  }, []);
  
  const handleMouseUp = useCallback((e) => {
    const state = touchState.current;
    const duration = Date.now() - state.startTime;
    const dx = e.clientX - (state.startPos?.x || 0);
    const dy = e.clientY - (state.startPos?.y || 0);
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // If it was a short tap without much movement, trigger click
    const wasTap = duration < TAP_MAX_DURATION_MS && distance < TAP_MAX_DISTANCE;
    
    if (!state.isPanning && wasTap) {
      // The onClick handler will be called naturally
    }
    
    touchState.current = {
      ...touchState.current,
      startPos: null,
      startPan: null,
      isPanning: false
    };
  }, []);
  
  // Touch handlers for mobile (pinch-to-zoom and pan)
  const getTouchDistance = useCallback((touches) => {
    if (touches.length < 2) return 0;
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }, []);
  
  const getTouchCenter = useCallback((touches) => {
    if (touches.length < 2) return { x: touches[0].clientX, y: touches[0].clientY };
    return {
      x: (touches[0].clientX + touches[1].clientX) / 2,
      y: (touches[0].clientY + touches[1].clientY) / 2
    };
  }, []);
  
  const handleTouchStart = useCallback((e) => {
    if (e.touches.length === 2) {
      // Pinch gesture starting
      touchState.current = {
        ...touchState.current,
        pinchStartDistance: getTouchDistance(e.touches),
        pinchStartZoom: zoom,
        pinchCenter: getTouchCenter(e.touches),
        startPan: { ...pan },
        isPanning: true
      };
    } else if (e.touches.length === 1) {
      // Single finger - could be tap or pan
      touchState.current = {
        ...touchState.current,
        startTime: Date.now(),
        startPos: { x: e.touches[0].clientX, y: e.touches[0].clientY },
        startPan: { ...pan },
        isPanning: false,
        pinchStartDistance: null
      };
    }
  }, [getTouchDistance, getTouchCenter, zoom, pan]);
  
  const handleTouchMove = useCallback((e) => {
    if (e.touches.length === 2 && touchState.current.pinchStartDistance) {
      // Pinch gesture
      e.preventDefault();
      const currentDistance = getTouchDistance(e.touches);
      const scale = currentDistance / touchState.current.pinchStartDistance;
      const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, touchState.current.pinchStartZoom * scale));
      setZoom(newZoom);
      
      // Also pan with pinch center
      const center = getTouchCenter(e.touches);
      const startCenter = touchState.current.pinchCenter;
      if (startCenter) {
        setPan({
          x: touchState.current.startPan.x + (center.x - startCenter.x),
          y: touchState.current.startPan.y + (center.y - startCenter.y)
        });
      }
    } else if (e.touches.length === 1 && touchState.current.startPos) {
      // Single finger move - check if it's a pan
      const dx = e.touches[0].clientX - touchState.current.startPos.x;
      const dy = e.touches[0].clientY - touchState.current.startPos.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance > TAP_MAX_DISTANCE) {
        e.preventDefault();
        touchState.current.isPanning = true;
        setPan({
          x: touchState.current.startPan.x + dx,
          y: touchState.current.startPan.y + dy
        });
      }
    }
  }, [getTouchDistance, getTouchCenter]);
  
  const handleTouchEnd = useCallback((e) => {
    const state = touchState.current;
    
    if (e.touches.length === 0) {
      // All fingers lifted
      // If it was a quick tap without pinching or panning, the onClick will be triggered naturally
      // since we haven't prevented the default behavior for taps
      
      touchState.current = {
        startTime: 0,
        startPos: null,
        startPan: null,
        isPanning: false,
        pinchStartDistance: null,
        pinchStartZoom: null,
        pinchCenter: null
      };
    } else if (e.touches.length === 1 && state.pinchStartDistance) {
      // Went from 2 fingers to 1 - reset to single finger pan
      touchState.current = {
        ...touchState.current,
        startPos: { x: e.touches[0].clientX, y: e.touches[0].clientY },
        startPan: { ...pan },
        pinchStartDistance: null,
        pinchStartZoom: null,
        pinchCenter: null
      };
    }
  }, [pan]);
  
  // Reset zoom and pan
  const handleResetView = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);
  
  // Combined mouse move handler for both hover feedback and panning
  const handleCombinedMouseMove = useCallback((e) => {
    handleMouseMove(e);
    handleMouseMoveForPan(e);
  }, [handleMouseMove, handleMouseMoveForPan]);
  
  // Click handler that only triggers if not panning
  const handleClickIfNotPanning = useCallback((e) => {
    if (!touchState.current.isPanning) {
      handleClick(e);
    }
  }, [handleClick]);
  
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
      <div className="zoom-controls">
        <span className="zoom-level">Zoom: {zoom.toFixed(1)}x</span>
        <button onClick={handleResetView} className="reset-view-btn" title="Reset View">
          Reset View
        </button>
      </div>
      <svg
        ref={svgRef}
        viewBox={viewBox}
        className="rhombus-svg"
        onMouseMove={handleCombinedMouseMove}
        onMouseLeave={handleMouseLeave}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onClick={handleClickIfNotPanning}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Rhombus outline */}
        <path d={rhombusPath} className="rhombus-path" strokeWidth={baseRhombusStrokeWidth * strokeScale} />
        
        {/* Corner angle indicators */}
        <text x={ne.x + 10 * strokeScale} y={ne.y - 10 * strokeScale} className="angle-text" fontSize={baseSmallFontSize * strokeScale}>120°</text>
        <text x={sw.x - 25 * strokeScale} y={sw.y + 15 * strokeScale} className="angle-text" fontSize={baseSmallFontSize * strokeScale}>120°</text>
        <text x={nw.x - 25 * strokeScale} y={nw.y - 5 * strokeScale} className="angle-text" fontSize={baseSmallFontSize * strokeScale}>60°</text>
        <text x={se.x + 10 * strokeScale} y={se.y + 15 * strokeScale} className="angle-text" fontSize={baseSmallFontSize * strokeScale}>60°</text>
        
        {/* Identification indicators */}
        <text x={ne.x + 35 * strokeScale} y={ne.y - 25 * strokeScale} className="identification-text" fontSize={baseSmallFontSize * strokeScale}>N≡E</text>
        <text x={sw.x - 45 * strokeScale} y={sw.y + 30 * strokeScale} className="identification-text" fontSize={baseSmallFontSize * strokeScale}>S≡W</text>
        
        {/* Side labels */}
        {sideLabels.map(({ key, x, y, label }) => (
          <text key={key} x={x} y={y} className="side-label" textAnchor="middle" dominantBaseline="middle" fontSize={baseFontSize * strokeScale}>
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
                strokeWidth={(isHighlighted ? baseHighlightedStrokeWidth : baseEdgeStrokeWidth) * strokeScale}
              />
              <text
                x={midX}
                y={midY}
                className="edge-arrow"
                fontSize={baseFontSize * strokeScale}
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
                r={basePointRadius * strokeScale}
                className={isInteriorPoint(edge.from) ? 'interior-point' : 'edge-point'}
                strokeWidth={strokeScale}
              />
              <circle
                cx={toCoords.x}
                cy={toCoords.y}
                r={basePointRadius * strokeScale}
                className={isInteriorPoint(edge.to) ? 'interior-point' : 'edge-point'}
                strokeWidth={strokeScale}
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
              r={baseStartPointRadius * strokeScale}
              className="next-start-point"
              strokeWidth={2 * strokeScale}
            />
          );
        })}
        
        {/* Selected start point */}
        {selectedStartPoint && (
          <circle
            cx={getPointCoordinates(selectedStartPoint).x}
            cy={getPointCoordinates(selectedStartPoint).y}
            r={baseStartPointRadius * strokeScale}
            className="selected-start-point"
            strokeWidth={2 * strokeScale}
          />
        )}
        
        {/* Hover points */}
        {hoverPoint && (isInteriorPoint(hoverPoint) ? (
          <circle
            cx={getInteriorPoint(hoverPoint.southward, hoverPoint.eastward).x}
            cy={getInteriorPoint(hoverPoint.southward, hoverPoint.eastward).y}
            r={baseHoverRadius * strokeScale}
            className="hover-point-interior"
            strokeWidth={strokeScale}
          />
        ) : (
          <>
            <circle
              cx={getPointOnSide(hoverPoint.side, hoverPoint.t).x}
              cy={getPointOnSide(hoverPoint.side, hoverPoint.t).y}
              r={baseHoverRadius * strokeScale}
              className="hover-point"
            />
            <circle
              cx={getPointOnSide(getIdentifiedSide(hoverPoint.side), hoverPoint.t).x}
              cy={getPointOnSide(getIdentifiedSide(hoverPoint.side), hoverPoint.t).y}
              r={baseHoverRadius * strokeScale}
              className="hover-point-complementary"
              strokeWidth={strokeScale}
              strokeDasharray={`${2 * strokeScale},${2 * strokeScale}`}
            />
          </>
        ))}
      </svg>
      
      <div className="rhombus-instructions">
        {disabled && (
          <p>Loop is closed. Click "Open Loop" to continue editing.</p>
        )}
        {!disabled && edges.length === 0 && !selectedStartPoint && (
          <p>Click anywhere to select a starting point on the boundary.</p>
        )}
        {!disabled && selectedStartPoint && (
          <p>Click to add the next point.{interiorMode ? ' (Click inside for interior point)' : ''}</p>
        )}
      </div>
    </div>
  );
}

export default Rhombus;
