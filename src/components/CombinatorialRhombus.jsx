import { useMemo, useCallback, useState, useRef, useEffect } from 'react';
import {
  getOutlinePathBlended,
  getSideSegmentPathBlended,
  getCurvedEdgePathBlended,
  getSize,
  getShear,
  getPointOnSideBlended
} from '../utils/geometry.js';
import { getSideGroup } from '../utils/combinatorialPathLogic.js';
import './CombinatorialRhombus.css';

// Zoom configuration
const MIN_ZOOM = 1;
const MAX_ZOOM = 20;
const WHEEL_ZOOM_FACTOR = 1.1;

// Touch configuration
const TAP_MAX_DURATION_MS = 300;  // Maximum duration for a tap (vs pan)
const TAP_MAX_DISTANCE = 10;      // Maximum movement for a tap (in screen pixels)

// Shape morphing configuration
const SHAPE_WEIGHTS = {
  rhombus:  { rhombus: 1, square: 0, triangle: 0 },
  square:   { rhombus: 0, square: 1, triangle: 0 },
  triangle: { rhombus: 0, square: 0, triangle: 1 }
};
const ANIMATION_DURATION_MS = 600;

// Shape-specific angle info for corner labels
const SHAPE_ANGLES = {
  rhombus:  { nw: '60°', ne: '120°', se: '60°', sw: '120°' },
  square:   { nw: '90°', ne: '90°', se: '90°', sw: '90°' },
  triangle: { nw: '45°', ne: '', se: '45°', sw: '90°' }
};

/**
 * Calculate segment coordinates for display/interaction using blended shape mapping.
 * Returns coordinates for a specific side, including an SVG path.
 */
function getSegmentCoords(segment, allPoints, shapeWeights) {
  const side = segment.side;
  const group = getSideGroup(side);
  
  const groupPoints = allPoints.filter(p => p.group === group);
  
  let startT, endT;
  if (segment.startPos === null && segment.endPos === null) {
    startT = 0;
    endT = 1;
  } else if (segment.startPos === null) {
    const endPoint = groupPoints.find(p => p.pos === segment.endPos);
    startT = 0;
    endT = endPoint?.t ?? 0;
  } else if (segment.endPos === null) {
    const startPoint = groupPoints.find(p => p.pos === segment.startPos);
    startT = startPoint?.t ?? 1;
    endT = 1;
  } else {
    const startPoint = groupPoints.find(p => p.pos === segment.startPos);
    const endPoint = groupPoints.find(p => p.pos === segment.endPos);
    startT = startPoint?.t ?? 0;
    endT = endPoint?.t ?? 1;
  }
  
  const midT = (startT + endT) / 2;
  const pathD = getSideSegmentPathBlended(side, startT, endT, shapeWeights);
  const midPt = getPointOnSideBlended(side, midT, shapeWeights);
  
  return [{
    side,
    pathD,
    midX: midPt.x,
    midY: midPt.y,
    startT,
    endT,
    midT
  }];
}

/**
 * Get curved edge path data for a float edge using the blended shape mapping.
 * @param {Object} edge - Float edge with { from: { side, t }, to: { side, t } }
 * @param {{ rhombus: number, square: number, triangle: number }} shapeWeights
 */
function getCurvedEdgeData(edge, shapeWeights) {
  return getCurvedEdgePathBlended(
    edge.from.side, 
    edge.from.t, 
    edge.to.side, 
    edge.to.t,
    shapeWeights
  );
}

/**
 * CombinatorialRhombus component - renders the combinatorial rhombus visualization.
 * Shows points equally spaced on sides and highlights the selected segment.
 * Supports clicking on segments to select them.
 * 
 * @param {Object[]} floatEdges - Array of float edge objects for visualization
 * @param {Object[]} allPoints - Array of point info { side, pos, group, t }
 * @param {Object|null} selectedSegment - Currently selected segment { startPos, endPos, side }
 * @param {Object[]} availableSegments - Array of valid segments that can be clicked
 * @param {Object|null} nextStartPoint - The starting point for the next edge
 * @param {number|null} highlightedEdgeIndex - Index of edge to highlight (for crossing errors)
 * @param {Function|null} onSegmentClick - Callback when a segment is clicked
 * @param {Object|null} firstEdgeFromSegment - The "from" segment when creating first edge
 */
function CombinatorialRhombus({ 
  floatEdges, 
  allPoints, 
  selectedSegment, 
  availableSegments = [],
  nextStartPoint,
  highlightedEdgeIndex = null,
  onSegmentClick = null,
  firstEdgeFromSegment = null
}) {
  // Zoom and pan state
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  
  // Shape morphing state
  const [targetShape, setTargetShape] = useState('rhombus');
  const [shapeWeights, setShapeWeights] = useState(SHAPE_WEIGHTS.rhombus);
  const animationRef = useRef(null);
  const startWeightsRef = useRef(SHAPE_WEIGHTS.rhombus);
  const startTimeRef = useRef(null);
  
  // Ref for SVG element
  const svgRef = useRef(null);
  
  // Track touch/drag state for distinguishing taps from pans
  const touchState = useRef({
    startTime: 0,
    startPos: null,
    startPan: null,
    isPanning: false,
    pinchStartDistance: null,
    pinchStartZoom: null,
    pinchCenter: null,        // Screen coordinates of pinch center
    pinchCenterSvg: null      // SVG coordinates of pinch center (for zoom anchoring)
  });
  
  // Handle shape change with animated transition
  const handleShapeChange = useCallback((newShape) => {
    if (newShape === targetShape) return;
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    startWeightsRef.current = { ...shapeWeights };
    startTimeRef.current = performance.now();
    setTargetShape(newShape);
    
    const target = SHAPE_WEIGHTS[newShape];
    function animate(now) {
      const elapsed = now - startTimeRef.current;
      const progress = Math.min(elapsed / ANIMATION_DURATION_MS, 1);
      // Ease in-out cubic
      const eased = progress < 0.5
        ? 4 * progress * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 3) / 2;
      
      const start = startWeightsRef.current;
      setShapeWeights({
        rhombus:  start.rhombus  + (target.rhombus  - start.rhombus)  * eased,
        square:   start.square   + (target.square   - start.square)   * eased,
        triangle: start.triangle + (target.triangle - start.triangle) * eased
      });
      
      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        animationRef.current = null;
      }
    }
    animationRef.current = requestAnimationFrame(animate);
  }, [targetShape, shapeWeights]);
  
  // Cleanup animation on unmount
  useEffect(() => {
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, []);
  
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
  
  // Convert screen coordinates (clientX, clientY) to SVG coordinates
  const screenToSvg = useCallback((clientX, clientY, currentZoom, currentPan) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    
    // Calculate viewBox parameters for the given zoom/pan
    const vWidth = fullWidth / currentZoom;
    const vHeight = fullHeight / currentZoom;
    const vX = centerX - vWidth / 2 - currentPan.x / currentZoom;
    const vY = centerY - vHeight / 2 - currentPan.y / currentZoom;
    
    const x = (clientX - rect.left) / rect.width * vWidth + vX;
    const y = (clientY - rect.top) / rect.height * vHeight + vY;
    return { x, y };
  }, [fullWidth, fullHeight, centerX, centerY]);
  
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
  
  const handleMouseUp = useCallback(() => {
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
      const pinchCenterScreen = getTouchCenter(e.touches);
      // Convert pinch center to SVG coordinates for zoom anchoring
      const pinchCenterSvgCoords = screenToSvg(pinchCenterScreen.x, pinchCenterScreen.y, zoom, pan);
      touchState.current = {
        ...touchState.current,
        pinchStartDistance: getTouchDistance(e.touches),
        pinchStartZoom: zoom,
        pinchCenter: pinchCenterScreen,
        pinchCenterSvg: pinchCenterSvgCoords,
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
  }, [getTouchDistance, getTouchCenter, zoom, pan, screenToSvg]);
  
  const handleTouchMove = useCallback((e) => {
    if (e.touches.length === 2 && touchState.current.pinchStartDistance) {
      // Pinch gesture
      e.preventDefault();
      const currentDistance = getTouchDistance(e.touches);
      const scale = currentDistance / touchState.current.pinchStartDistance;
      const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, touchState.current.pinchStartZoom * scale));
      
      // Get current pinch center in screen coordinates
      const currentCenter = getTouchCenter(e.touches);
      const svg = svgRef.current;
      
      if (svg && touchState.current.pinchCenterSvg) {
        const rect = svg.getBoundingClientRect();
        const svgPoint = touchState.current.pinchCenterSvg;
        
        // Normalized position of currentCenter in SVG element (0-1)
        const normX = (currentCenter.x - rect.left) / rect.width;
        const normY = (currentCenter.y - rect.top) / rect.height;
        
        // viewWidth and viewHeight at new zoom
        const newViewWidth = fullWidth / newZoom;
        const newViewHeight = fullHeight / newZoom;
        
        // Calculate pan needed to keep svgPoint at currentCenter screen position
        const newPanX = newZoom * (centerX - newViewWidth / 2 + normX * newViewWidth - svgPoint.x);
        const newPanY = newZoom * (centerY - newViewHeight / 2 + normY * newViewHeight - svgPoint.y);
        
        setZoom(newZoom);
        setPan({ x: newPanX, y: newPanY });
      } else {
        setZoom(newZoom);
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
  }, [getTouchDistance, getTouchCenter, fullWidth, fullHeight, centerX, centerY]);
  
  const handleTouchEnd = useCallback((e) => {
    const state = touchState.current;
    
    if (e.touches.length === 0) {
      // All fingers lifted
      touchState.current = {
        startTime: 0,
        startPos: null,
        startPan: null,
        isPanning: false,
        pinchStartDistance: null,
        pinchStartZoom: null,
        pinchCenter: null,
        pinchCenterSvg: null
      };
    } else if (e.touches.length === 1 && state.pinchStartDistance) {
      // Went from 2 fingers to 1 - reset to single finger pan
      touchState.current = {
        ...touchState.current,
        startPos: { x: e.touches[0].clientX, y: e.touches[0].clientY },
        startPan: { ...pan },
        pinchStartDistance: null,
        pinchStartZoom: null,
        pinchCenter: null,
        pinchCenterSvg: null
      };
    }
  }, [pan]);
  
  // Reset zoom and pan
  const handleResetView = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);
  
  // Scale factors for visual elements to maintain screen size when zooming
  // All sizes divided by zoom to appear constant on screen
  const strokeScale = 1 / zoom;
  const baseEdgeStrokeWidth = 3;
  const baseSegmentStrokeWidth = 4;
  const baseSegmentHitareaWidth = 20;
  const basePointRadius = 6;
  const baseStartPointRadius = 10;
  const baseMidpointRadius = 8;
  const baseFontSize = 12;
  const baseSmallFontSize = 10;
  const baseRhombusStrokeWidth = 2;
  const baseLabelDist = 15;
  
  // Use the blended outline path (morphs between rhombus, square, triangle)
  const outlinePath = getOutlinePathBlended(shapeWeights);
  
  // Get corner positions for labels using blended mapping
  const nw = getPointOnSideBlended('north', 0, shapeWeights);
  const ne = getPointOnSideBlended('north', 1, shapeWeights);
  const se = getPointOnSideBlended('south', 0, shapeWeights);
  const sw = getPointOnSideBlended('south', 1, shapeWeights);
  
  // Shape-specific angle labels
  const angles = SHAPE_ANGLES[targetShape];
  
  // Side labels
  const labelOffset = 25;
  const sideLabels = [
    { key: 'north', x: (nw.x + ne.x) / 2, y: (nw.y + ne.y) / 2 - labelOffset, label: 'North (≡ East)' },
    { key: 'east', x: (ne.x + se.x) / 2 + labelOffset + 15, y: (ne.y + se.y) / 2, label: 'East' },
    { key: 'south', x: (se.x + sw.x) / 2, y: (se.y + sw.y) / 2 + labelOffset + 10, label: 'South (≡ West)' },
    { key: 'west', x: (sw.x + nw.x) / 2 - labelOffset - 35, y: (sw.y + nw.y) / 2, label: 'West' }
  ];
  
  // Calculate coordinates for all available segments (for clicking)
  const availableSegmentCoords = useMemo(() => {
    return availableSegments.map((segment, index) => ({
      segment,
      index,
      coords: getSegmentCoords(segment, allPoints, shapeWeights)
    }));
  }, [availableSegments, allPoints, shapeWeights]);
  
  // Calculate highlighted segment line if a segment is selected
  const selectedSegmentCoords = useMemo(() => {
    if (!selectedSegment) return null;
    return getSegmentCoords(selectedSegment, allPoints, shapeWeights);
  }, [selectedSegment, allPoints, shapeWeights]);
  
  // Calculate "from" segment highlight for first edge creation
  const fromSegmentCoords = useMemo(() => {
    if (!firstEdgeFromSegment) return null;
    return getSegmentCoords(firstEdgeFromSegment, allPoints, shapeWeights);
  }, [firstEdgeFromSegment, allPoints, shapeWeights]);
  
  // Handle segment click
  const handleSegmentClick = useCallback((segment) => {
    if (onSegmentClick) {
      onSegmentClick(segment);
    }
  }, [onSegmentClick]);
  
  // Check if a segment is the selected one
  const isSegmentSelected = useCallback((segment) => {
    if (!selectedSegment) return false;
    return segment.side === selectedSegment.side && 
           segment.startPos === selectedSegment.startPos && 
           segment.endPos === selectedSegment.endPos;
  }, [selectedSegment]);
  
  return (
    <div className="combinatorial-rhombus-container">
      <div className="zoom-controls">
        <div className="shape-controls">
          <button onClick={() => handleShapeChange('rhombus')} className={`shape-btn ${targetShape === 'rhombus' ? 'shape-btn-active' : ''}`}>◇ Rhombus</button>
          <button onClick={() => handleShapeChange('square')} className={`shape-btn ${targetShape === 'square' ? 'shape-btn-active' : ''}`}>□ Square</button>
          <button onClick={() => handleShapeChange('triangle')} className={`shape-btn ${targetShape === 'triangle' ? 'shape-btn-active' : ''}`}>△ Triangle</button>
        </div>
        <span className="zoom-level">Zoom: {zoom.toFixed(1)}x</span>
        <button onClick={handleResetView} className="reset-view-btn" title="Reset View">
          Reset View
        </button>
      </div>
      <svg
        ref={svgRef}
        viewBox={viewBox}
        className="combinatorial-rhombus-svg"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMoveForPan}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Shape outline (morphs between rhombus/square/triangle) */}
        <path d={outlinePath} className="rhombus-path" strokeWidth={baseRhombusStrokeWidth * strokeScale} />
        
        {/* Corner angle indicators (follow corners during animation) */}
        {angles.ne && <text x={ne.x + 10 * strokeScale} y={ne.y - 10 * strokeScale} className="angle-text" fontSize={baseSmallFontSize * strokeScale}>{angles.ne}</text>}
        {angles.sw && <text x={sw.x - 25 * strokeScale} y={sw.y + 15 * strokeScale} className="angle-text" fontSize={baseSmallFontSize * strokeScale}>{angles.sw}</text>}
        {angles.nw && <text x={nw.x - 25 * strokeScale} y={nw.y - 5 * strokeScale} className="angle-text" fontSize={baseSmallFontSize * strokeScale}>{angles.nw}</text>}
        {angles.se && <text x={se.x + 10 * strokeScale} y={se.y + 15 * strokeScale} className="angle-text" fontSize={baseSmallFontSize * strokeScale}>{angles.se}</text>}
        
        {/* Identification indicators */}
        <text x={ne.x + 35 * strokeScale} y={ne.y - 25 * strokeScale} className="identification-text" fontSize={baseSmallFontSize * strokeScale}>N≡E</text>
        <text x={sw.x - 45 * strokeScale} y={sw.y + 30 * strokeScale} className="identification-text" fontSize={baseSmallFontSize * strokeScale}>S≡W</text>
        
        {/* Side labels */}
        {sideLabels.map(({ key, x, y, label }) => (
          <text key={key} x={x} y={y} className="side-label" textAnchor="middle" dominantBaseline="middle" fontSize={baseFontSize * strokeScale}>
            {label}
          </text>
        ))}
        
        {/* Clickable segment regions (for each available segment) */}
        {onSegmentClick && availableSegmentCoords.map(({ segment, index, coords }) => {
          const isSelected = isSegmentSelected(segment);
          return coords.map((segmentData, lineIdx) => (
            <g key={`clickable-${index}-${lineIdx}`}>
              {/* Invisible wider hit area for easier clicking */}
              <path
                d={segmentData.pathD}
                className="segment-hitarea"
                strokeWidth={baseSegmentHitareaWidth * strokeScale}
                fill="none"
                onClick={() => handleSegmentClick(segment)}
              />
              {/* Visible segment indicator */}
              <path
                d={segmentData.pathD}
                className={`segment-available ${isSelected ? 'segment-selected' : ''}`}
                strokeWidth={baseSegmentStrokeWidth * strokeScale}
                fill="none"
                onClick={() => handleSegmentClick(segment)}
              />
            </g>
          ));
        })}
        
        {/* "From" segment highlight for first edge creation (green) */}
        {fromSegmentCoords && fromSegmentCoords.map((segmentData, idx) => (
          <g key={`from-${idx}`}>
            <path
              d={segmentData.pathD}
              className="segment-from"
              strokeWidth={6 * strokeScale}
              fill="none"
            />
            <circle
              cx={segmentData.midX}
              cy={segmentData.midY}
              r={baseMidpointRadius * strokeScale}
              className="segment-from-midpoint"
              strokeWidth={2 * strokeScale}
            />
          </g>
        ))}
        
        {/* Selected segment highlight on both identified sides */}
        {selectedSegmentCoords && selectedSegmentCoords.map((segmentData, idx) => (
          <g key={`selected-${idx}`}>
            <path
              d={segmentData.pathD}
              className="segment-highlight"
              strokeWidth={6 * strokeScale}
              fill="none"
            />
            <circle
              cx={segmentData.midX}
              cy={segmentData.midY}
              r={baseMidpointRadius * strokeScale}
              className="segment-midpoint"
              strokeWidth={2 * strokeScale}
            />
          </g>
        ))}
        
        {/* Edges - rendered using diffeomorphism for guaranteed non-intersection */}
        {floatEdges.map((edge, index) => {
          const edgeData = getCurvedEdgeData(edge, shapeWeights);
          const isHighlighted = highlightedEdgeIndex === index;
          
          return (
            <g key={index}>
              <path
                d={edgeData.pathD}
                className={`edge-line ${isHighlighted ? 'edge-line-problem' : ''}`}
                strokeWidth={(isHighlighted ? 5 : baseEdgeStrokeWidth) * strokeScale}
                fill="none"
              />
              <text
                x={edgeData.midPoint.x}
                y={edgeData.midPoint.y}
                className="edge-arrow"
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={baseFontSize * strokeScale}
                transform={`rotate(${edgeData.angle}, ${edgeData.midPoint.x}, ${edgeData.midPoint.y})`}
              >
                ▶
              </text>
            </g>
          );
        })}
        
        {/* All points - using blended side positions with integer labels */}
        {allPoints.map((point, index) => {
          const coords = getPointOnSideBlended(point.side, point.t, shapeWeights);
          let labelOffsetX = 0;
          let labelOffsetY = 0;
          const scaledLabelDist = baseLabelDist * strokeScale;
          switch (point.side) {
            case 'north':
              labelOffsetY = -scaledLabelDist;
              break;
            case 'east':
              labelOffsetX = scaledLabelDist;
              break;
            case 'south':
              labelOffsetY = scaledLabelDist;
              break;
            case 'west':
              labelOffsetX = -scaledLabelDist;
              break;
          }
          const groupClass = point.group === 'NE' ? 'boundary-point-ne' : 'boundary-point-sw';
          return (
            <g key={`point-${index}`}>
              <circle
                cx={coords.x}
                cy={coords.y}
                r={basePointRadius * strokeScale}
                className={`boundary-point ${groupClass}`}
                strokeWidth={strokeScale}
              />
              <text
                x={coords.x + labelOffsetX}
                y={coords.y + labelOffsetY}
                className="point-label"
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={baseFontSize * strokeScale}
              >
                {point.pos + 1}
              </text>
            </g>
          );
        })}
        
        {/* Next start point indicator - using blended side position */}
        {nextStartPoint && (() => {
          const startPtCoords = getPointOnSideBlended(nextStartPoint.side, nextStartPoint.t, shapeWeights);
          return (
            <circle
              cx={startPtCoords.x}
              cy={startPtCoords.y}
              r={baseStartPointRadius * strokeScale}
              className="start-point"
              strokeWidth={2 * strokeScale}
            />
          );
        })()}
      </svg>
    </div>
  );
}

export default CombinatorialRhombus;
