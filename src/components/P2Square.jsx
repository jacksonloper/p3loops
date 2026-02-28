import { useMemo, useCallback, useState, useRef, useEffect } from 'react';
import {
  getOutlinePath,
  getZoneSegmentPath,
  getCurvedEdgePath,
  getSize,
  getPointInZone,
  getCorners,
  getMidpoints
} from '../utils/p2Geometry.js';
import { getZoneGroup } from '../utils/p2PathLogic.js';
import './CombinatorialRhombus.css'; // reuse existing styles

const MIN_ZOOM = 1;
const MAX_ZOOM = 20;
const WHEEL_ZOOM_FACTOR = 1.1;
const TAP_MAX_DISTANCE = 10;

/**
 * Calculate segment coordinates for display/interaction.
 */
function getSegmentCoords(segment, allPoints) {
  const zone = segment.zone;
  const group = getZoneGroup(zone);

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
  const pathD = getZoneSegmentPath(zone, startT, endT);
  const midPt = getPointInZone(zone, midT);

  return [{
    zone,
    pathD,
    midX: midPt.x,
    midY: midPt.y,
    startT,
    endT,
    midT
  }];
}

/**
 * Get curved edge path data for a float edge.
 */
function getCurvedEdgeData(edge) {
  return getCurvedEdgePath(
    edge.from.zone,
    edge.from.t,
    edge.to.zone,
    edge.to.t
  );
}

/**
 * P2Square component - renders the p2 square visualization.
 */
function P2Square({
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
  const baseSquareStrokeWidth = 2;
  const baseLabelDist = 15;

  const outlinePath = getOutlinePath();
  const corners = getCorners();
  const midpoints = getMidpoints();

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
    return segment.zone === selectedSegment.zone &&
           segment.startPos === selectedSegment.startPos &&
           segment.endPos === selectedSegment.endPos;
  }, [selectedSegment]);

  // Group color for points
  const groupClass = (group) => {
    switch (group) {
      case 'NW_SE': return 'boundary-point-ne';
      case 'NE_SW': return 'boundary-point-sw';
      case 'EN_WS': return 'boundary-point-ne';
      case 'ES_WN': return 'boundary-point-sw';
      default: return '';
    }
  };

  // Get label offset for a zone (push label outward from the square)
  const labelOffset = (zone) => {
    const d = baseLabelDist * strokeScale;
    if (zone.startsWith('N') && zone.length === 2 && ['NW', 'NE'].includes(zone)) return { x: 0, y: -d };
    if (['EN', 'ES'].includes(zone)) return { x: d, y: 0 };
    if (['SE', 'SW'].includes(zone)) return { x: 0, y: d };
    if (['WS', 'WN'].includes(zone)) return { x: -d, y: 0 };
    return { x: 0, y: 0 };
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
        {/* Square outline */}
        <path d={outlinePath} className="rhombus-path" strokeWidth={baseSquareStrokeWidth * strokeScale} />

        {/* Midpoint dividers (dashed lines showing zone boundaries) */}
        <line x1={midpoints.n.x} y1={midpoints.n.y} x2={midpoints.n.x} y2={midpoints.n.y + 8 * strokeScale}
              stroke="#666" strokeWidth={strokeScale} strokeDasharray={`${3*strokeScale} ${3*strokeScale}`} />
        <line x1={midpoints.e.x} y1={midpoints.e.y} x2={midpoints.e.x - 8 * strokeScale} y2={midpoints.e.y}
              stroke="#666" strokeWidth={strokeScale} strokeDasharray={`${3*strokeScale} ${3*strokeScale}`} />
        <line x1={midpoints.s.x} y1={midpoints.s.y} x2={midpoints.s.x} y2={midpoints.s.y - 8 * strokeScale}
              stroke="#666" strokeWidth={strokeScale} strokeDasharray={`${3*strokeScale} ${3*strokeScale}`} />
        <line x1={midpoints.w.x} y1={midpoints.w.y} x2={midpoints.w.x + 8 * strokeScale} y2={midpoints.w.y}
              stroke="#666" strokeWidth={strokeScale} strokeDasharray={`${3*strokeScale} ${3*strokeScale}`} />

        {/* Corner labels */}
        <text x={corners.nw.x - 15 * strokeScale} y={corners.nw.y - 8 * strokeScale} className="angle-text" fontSize={baseSmallFontSize * strokeScale}>NW</text>
        <text x={corners.ne.x + 5 * strokeScale} y={corners.ne.y - 8 * strokeScale} className="angle-text" fontSize={baseSmallFontSize * strokeScale}>NE</text>
        <text x={corners.se.x + 5 * strokeScale} y={corners.se.y + 15 * strokeScale} className="angle-text" fontSize={baseSmallFontSize * strokeScale}>SE</text>
        <text x={corners.sw.x - 15 * strokeScale} y={corners.sw.y + 15 * strokeScale} className="angle-text" fontSize={baseSmallFontSize * strokeScale}>SW</text>

        {/* Identification labels near midpoints */}
        <text x={midpoints.n.x} y={midpoints.n.y - 12 * strokeScale} className="identification-text" fontSize={baseSmallFontSize * strokeScale} textAnchor="middle">
          NW≡SE | NE≡SW
        </text>
        <text x={midpoints.s.x} y={midpoints.s.y + 20 * strokeScale} className="identification-text" fontSize={baseSmallFontSize * strokeScale} textAnchor="middle">
          SE≡NW | SW≡NE
        </text>
        <text x={midpoints.e.x + 15 * strokeScale} y={midpoints.e.y} className="identification-text" fontSize={baseSmallFontSize * strokeScale} textAnchor="start" dominantBaseline="middle">
          EN≡WS | ES≡WN
        </text>
        <text x={midpoints.w.x - 15 * strokeScale} y={midpoints.w.y} className="identification-text" fontSize={baseSmallFontSize * strokeScale} textAnchor="end" dominantBaseline="middle">
          WN≡ES | WS≡EN
        </text>

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
          const edgeData = getCurvedEdgeData(edge);
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
          const coords = getPointInZone(point.zone, point.t);
          const offset = labelOffset(point.zone);
          const gc = groupClass(point.group);
          return (
            <g key={`point-${index}`}>
              <circle cx={coords.x} cy={coords.y} r={basePointRadius * strokeScale}
                      className={`boundary-point ${gc}`} strokeWidth={strokeScale} />
              <text x={coords.x + offset.x} y={coords.y + offset.y}
                    className="point-label" textAnchor="middle" dominantBaseline="middle"
                    fontSize={baseFontSize * strokeScale}>
                {point.pos + 1}
              </text>
            </g>
          );
        })}

        {/* Next start point indicator */}
        {nextStartPoint && (() => {
          const startPtCoords = getPointInZone(nextStartPoint.zone, nextStartPoint.t);
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

export default P2Square;
