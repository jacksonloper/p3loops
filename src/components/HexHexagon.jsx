import { useMemo, useCallback, useState, useRef, useEffect } from 'react';
import {
  getOutlinePath,
  getSideSegmentPath,
  getStraightEdgePath,
  getSize,
  getPointOnSide,
  getVertices
} from '../utils/hexGeometry.js';
import { getSideGroup } from '../utils/hexPathLogic.js';
import './CombinatorialRhombus.css'; // reuse existing styles

const MIN_ZOOM = 1;
const MAX_ZOOM = 20;
const WHEEL_ZOOM_FACTOR = 1.1;
const TAP_MAX_DISTANCE = 10;

/**
 * Calculate segment coordinates for display/interaction.
 * Both sides use the same parameterization (t increases from cone point),
 * so no reversed-side special casing is needed.
 */
function getSegmentCoords(segment, allPoints) {
  const side = segment.side;
  const group = getSideGroup(side);

  const sidePoints = allPoints.filter(p => p.group === group && p.side === side);

  let startT, endT;
  if (segment.startPos === null && segment.endPos === null) {
    startT = 0;
    endT = 1;
  } else if (segment.startPos === null) {
    const endPoint = sidePoints.find(p => p.pos === segment.endPos);
    startT = 0;
    endT = endPoint?.t ?? 0;
  } else if (segment.endPos === null) {
    const startPoint = sidePoints.find(p => p.pos === segment.startPos);
    startT = startPoint?.t ?? 1;
    endT = 1;
  } else {
    const startPoint = sidePoints.find(p => p.pos === segment.startPos);
    const endPoint = sidePoints.find(p => p.pos === segment.endPos);
    const t1 = startPoint?.t ?? 0;
    const t2 = endPoint?.t ?? 1;
    startT = Math.min(t1, t2);
    endT = Math.max(t1, t2);
  }

  const midT = (startT + endT) / 2;
  const pathD = getSideSegmentPath(side, startT, endT);
  const midPt = getPointOnSide(side, midT);

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
 * Get straight edge path data for a float edge.
 */
function getStraightEdgeData(edge) {
  return getStraightEdgePath(
    edge.from.side,
    edge.from.t,
    edge.to.side,
    edge.to.t
  );
}

/**
 * HexHexagon component — renders the hexagonal fundamental domain.
 */
function HexHexagon({
  floatEdges,
  allPoints,
  selectedSegment,
  availableSegments = [],
  nextStartPoint,
  highlightedEdgeIndex = null,
  onSegmentClick = null,
  firstEdgeFromSegment = null
}) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const svgRef = useRef(null);

  const touchState = useRef({
    startTime: 0,
    startPos: null,
    startPan: null,
    isPanning: false
  });

  const size = getSize();
  const padding = 80;

  const fullWidth = size + 2 * padding;
  const fullHeight = size + 2 * padding;
  const viewWidth = fullWidth / zoom;
  const viewHeight = fullHeight / zoom;
  const centerX = size / 2;
  const centerY = size / 2;
  const viewX = centerX - viewWidth / 2 - pan.x / zoom;
  const viewY = centerY - viewHeight / 2 - pan.y / zoom;
  const viewBox = `${viewX} ${viewY} ${viewWidth} ${viewHeight}`;

  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? (1 / WHEEL_ZOOM_FACTOR) : WHEEL_ZOOM_FACTOR;
    setZoom(z => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z * delta)));
  }, []);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    svg.addEventListener('wheel', handleWheel, { passive: false });
    return () => svg.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  const handleMouseDown = useCallback((e) => {
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

  const handleResetView = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  const strokeScale = 1 / zoom;
  const baseEdgeStrokeWidth = 3;
  const baseSegmentStrokeWidth = 4;
  const baseSegmentHitareaWidth = 20;
  const basePointRadius = 6;
  const baseStartPointRadius = 10;
  const baseMidpointRadius = 8;
  const baseFontSize = 12;
  const baseSmallFontSize = 10;
  const baseHexStrokeWidth = 2;
  const baseLabelDist = 18;

  const outlinePath = getOutlinePath();
  const vertices = getVertices();

  const availableSegmentCoords = useMemo(() => {
    return availableSegments.map((segment, index) => ({
      segment,
      index,
      coords: getSegmentCoords(segment, allPoints)
    }));
  }, [availableSegments, allPoints]);

  const selectedSegmentCoords = useMemo(() => {
    if (!selectedSegment) return null;
    return getSegmentCoords(selectedSegment, allPoints);
  }, [selectedSegment, allPoints]);

  const fromSegmentCoords = useMemo(() => {
    if (!firstEdgeFromSegment) return null;
    return getSegmentCoords(firstEdgeFromSegment, allPoints);
  }, [firstEdgeFromSegment, allPoints]);

  const handleSegmentClick = useCallback((segment) => {
    if (onSegmentClick) onSegmentClick(segment);
  }, [onSegmentClick]);

  const isSegmentSelected = useCallback((segment) => {
    if (!selectedSegment) return false;
    return segment.side === selectedSegment.side &&
           segment.startPos === selectedSegment.startPos &&
           segment.endPos === selectedSegment.endPos;
  }, [selectedSegment]);

  // Group color for points
  const groupClass = (group) => {
    switch (group) {
      case 'AX_AZ': return 'boundary-point-ne';
      case 'BX_BY': return 'boundary-point-sw';
      case 'CY_CZ': return 'boundary-point-ne';
      default: return '';
    }
  };

  // Get label offset for a side (push label outward from the hexagon)
  const labelOffset = (side) => {
    const d = baseLabelDist * strokeScale;
    // Get the midpoint of the side and push outward from center
    const mid = getPointOnSide(side, 0.5);
    const dx = mid.x - centerX;
    const dy = mid.y - centerY;
    const len = Math.hypot(dx, dy) || 1;
    return { x: (dx / len) * d, y: (dy / len) * d };
  };

  // Vertex label positions (offset outward from center)
  const vertexLabel = (name, pos) => {
    const dx = pos.x - centerX;
    const dy = pos.y - centerY;
    const len = Math.hypot(dx, dy) || 1;
    const d = 15 * strokeScale;
    return {
      x: pos.x + (dx / len) * d,
      y: pos.y + (dy / len) * d
    };
  };

  return (
    <div className="combinatorial-rhombus-container">
      <div className="zoom-controls">
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
      >
        {/* Hexagon outline */}
        <path d={outlinePath} className="rhombus-path" strokeWidth={baseHexStrokeWidth * strokeScale} />

        {/* Vertex labels */}
        {Object.entries(vertices).map(([name, pos]) => {
          const lbl = vertexLabel(name, pos);
          const isCone = ['A', 'B', 'C'].includes(name);
          return (
            <text key={name}
                  x={lbl.x} y={lbl.y}
                  className="angle-text"
                  fontSize={baseFontSize * strokeScale}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontWeight={isCone ? 'bold' : 'normal'}
                  fill={isCone ? '#e74c3c' : '#333'}>
              {name}{isCone ? ' •' : ''}
            </text>
          );
        })}

        {/* Side identification labels */}
        {[
          { side: 'AX', label: 'AX≡AZ', color: '#e74c3c' },
          { side: 'AZ', label: 'AZ≡AX', color: '#e74c3c' },
          { side: 'BX', label: 'BX≡BY', color: '#2980b9' },
          { side: 'BY', label: 'BY≡BX', color: '#2980b9' },
          { side: 'CY', label: 'CY≡CZ', color: '#27ae60' },
          { side: 'CZ', label: 'CZ≡CY', color: '#27ae60' },
        ].map(({ side, label, color }) => {
          const mid = getPointOnSide(side, 0.5);
          const off = labelOffset(side);
          return (
            <text key={`id-${side}`}
                  x={mid.x + off.x} y={mid.y + off.y}
                  className="identification-text"
                  fontSize={baseSmallFontSize * strokeScale}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill={color}>
              {label}
            </text>
          );
        })}

        {/* Clickable segment regions */}
        {onSegmentClick && availableSegmentCoords.map(({ segment, index, coords }) => {
          const isSelected = isSegmentSelected(segment);
          return coords.map((segmentData, lineIdx) => (
            <g key={`clickable-${index}-${lineIdx}`}>
              <path
                d={segmentData.pathD}
                className="segment-hitarea"
                strokeWidth={baseSegmentHitareaWidth * strokeScale}
                fill="none"
                onClick={() => handleSegmentClick(segment)}
              />
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

        {/* "From" segment highlight (green) */}
        {fromSegmentCoords && fromSegmentCoords.map((segmentData, idx) => (
          <g key={`from-${idx}`}>
            <path d={segmentData.pathD} className="segment-from" strokeWidth={6 * strokeScale} fill="none" />
            <circle cx={segmentData.midX} cy={segmentData.midY} r={baseMidpointRadius * strokeScale}
                    className="segment-from-midpoint" strokeWidth={2 * strokeScale} />
          </g>
        ))}

        {/* Selected segment highlight */}
        {selectedSegmentCoords && selectedSegmentCoords.map((segmentData, idx) => (
          <g key={`selected-${idx}`}>
            <path d={segmentData.pathD} className="segment-highlight" strokeWidth={6 * strokeScale} fill="none" />
            <circle cx={segmentData.midX} cy={segmentData.midY} r={baseMidpointRadius * strokeScale}
                    className="segment-midpoint" strokeWidth={2 * strokeScale} />
          </g>
        ))}

        {/* Edges */}
        {floatEdges.map((edge, index) => {
          const edgeData = getStraightEdgeData(edge);
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
                x={edgeData.midPoint.x} y={edgeData.midPoint.y}
                className="edge-arrow" textAnchor="middle" dominantBaseline="middle"
                fontSize={baseFontSize * strokeScale}
                transform={`rotate(${edgeData.angle}, ${edgeData.midPoint.x}, ${edgeData.midPoint.y})`}
              >
                ▶
              </text>
            </g>
          );
        })}

        {/* Points */}
        {allPoints.map((point, index) => {
          const coords = getPointOnSide(point.side, point.t);
          const offset = labelOffset(point.side);
          const gc = groupClass(point.group);
          return (
            <g key={`point-${index}`}>
              <circle cx={coords.x} cy={coords.y} r={basePointRadius * strokeScale}
                      className={`boundary-point ${gc}`} strokeWidth={strokeScale} />
              <text x={coords.x + offset.x * 0.7} y={coords.y + offset.y * 0.7}
                    className="point-label" textAnchor="middle" dominantBaseline="middle"
                    fontSize={baseFontSize * strokeScale}>
                {point.pos + 1}
              </text>
            </g>
          );
        })}

        {/* Next start point indicator */}
        {nextStartPoint && (() => {
          const startPtCoords = getPointOnSide(nextStartPoint.side, nextStartPoint.t);
          return (
            <circle cx={startPtCoords.x} cy={startPtCoords.y}
                    r={baseStartPointRadius * strokeScale}
                    className="start-point" strokeWidth={2 * strokeScale} />
          );
        })()}
      </svg>
    </div>
  );
}

export default HexHexagon;
