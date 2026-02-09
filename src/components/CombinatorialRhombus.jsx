import { useMemo, useCallback } from 'react';
import {
  getPointOnSide,
  getRhombusPath,
  getSize,
  getShear,
  getIdentifiedSide
} from '../utils/geometry.js';
import { getEdgeCoordinates } from '../utils/pathLogic.js';
import './CombinatorialRhombus.css';

/**
 * Calculate segment coordinates for display/interaction.
 */
function getSegmentCoords(segment, allPoints) {
  const group = segment.group;
  const canonicalSide = group === 'NE' ? 'north' : 'south';
  const identifiedSide = getIdentifiedSide(canonicalSide);
  
  // Get the points in this group
  const groupPoints = allPoints.filter(p => 
    p.side === canonicalSide || p.side === identifiedSide
  ).sort((a, b) => a.t - b.t);
  
  // Determine t range for the segment
  let startT, endT;
  if (segment.startPos === null && segment.endPos === null) {
    startT = 0;
    endT = 1;
  } else if (segment.startPos === null) {
    startT = 0;
    endT = groupPoints[segment.endPos]?.t ?? 0;
  } else if (segment.endPos === null) {
    startT = groupPoints[segment.startPos]?.t ?? 1;
    endT = 1;
  } else {
    startT = groupPoints[segment.startPos]?.t ?? 0;
    endT = groupPoints[segment.endPos]?.t ?? 1;
  }
  
  // Calculate the midpoint (where the new point would go)
  const midT = (startT + endT) / 2;
  
  // Get coordinates on both identified sides
  const lines = [];
  for (const side of [canonicalSide, identifiedSide]) {
    const startPt = getPointOnSide(side, startT);
    const endPt = getPointOnSide(side, endT);
    const midPt = getPointOnSide(side, midT);
    
    lines.push({
      side,
      x1: startPt.x,
      y1: startPt.y,
      x2: endPt.x,
      y2: endPt.y,
      midX: midPt.x,
      midY: midPt.y,
      startT,
      endT,
      midT
    });
  }
  
  return lines;
}

/**
 * CombinatorialRhombus component - renders the combinatorial rhombus visualization.
 * Shows points equally spaced on sides and highlights the selected segment.
 * Supports clicking on segments to select them.
 * 
 * @param {Object[]} floatEdges - Array of float edge objects for visualization
 * @param {Object[]} allPoints - Array of point info { side, pos, group, t }
 * @param {Object|null} selectedSegment - Currently selected segment { startPos, endPos, group }
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
  const size = getSize();
  const shear = getShear();
  const padding = shear / 2 + 50;
  
  const viewBox = useMemo(() => {
    const fullWidth = size + 2 * padding;
    const fullHeight = size + 2 * padding;
    const centerX = size / 2;
    const centerY = size / 2;
    const viewX = centerX - fullWidth / 2;
    const viewY = centerY - fullHeight / 2;
    return `${viewX} ${viewY} ${fullWidth} ${fullHeight}`;
  }, [size, padding]);
  
  // Use the standard rhombus path (straight sides, not bowed)
  const rhombusPath = getRhombusPath();
  
  // Get corner positions for labels
  const nw = getPointOnSide('north', 0);
  const ne = getPointOnSide('north', 1);
  const se = getPointOnSide('south', 0);
  const sw = getPointOnSide('south', 1);
  
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
      coords: getSegmentCoords(segment, allPoints)
    }));
  }, [availableSegments, allPoints]);
  
  // Calculate highlighted segment line if a segment is selected
  const selectedSegmentCoords = useMemo(() => {
    if (!selectedSegment) return null;
    return getSegmentCoords(selectedSegment, allPoints);
  }, [selectedSegment, allPoints]);
  
  // Calculate "from" segment highlight for first edge creation
  const fromSegmentCoords = useMemo(() => {
    if (!firstEdgeFromSegment) return null;
    return getSegmentCoords(firstEdgeFromSegment, allPoints);
  }, [firstEdgeFromSegment, allPoints]);
  
  // Handle segment click
  const handleSegmentClick = useCallback((segment) => {
    if (onSegmentClick) {
      onSegmentClick(segment);
    }
  }, [onSegmentClick]);
  
  // Check if a segment is the selected one
  const isSegmentSelected = useCallback((segment) => {
    if (!selectedSegment) return false;
    return segment.group === selectedSegment.group && 
           segment.startPos === selectedSegment.startPos && 
           segment.endPos === selectedSegment.endPos;
  }, [selectedSegment]);
  
  return (
    <div className="combinatorial-rhombus-container">
      <svg viewBox={viewBox} className="combinatorial-rhombus-svg">
        {/* Rhombus outline */}
        <path d={rhombusPath} className="rhombus-path" />
        
        {/* Corner angle indicators */}
        <text x={ne.x + 10} y={ne.y - 10} className="angle-text">120°</text>
        <text x={sw.x - 25} y={sw.y + 15} className="angle-text">120°</text>
        <text x={nw.x - 25} y={nw.y - 5} className="angle-text">60°</text>
        <text x={se.x + 10} y={se.y + 15} className="angle-text">60°</text>
        
        {/* Identification indicators */}
        <text x={ne.x + 35} y={ne.y - 25} className="identification-text">N≡E</text>
        <text x={sw.x - 45} y={sw.y + 30} className="identification-text">S≡W</text>
        
        {/* Side labels */}
        {sideLabels.map(({ key, x, y, label }) => (
          <text key={key} x={x} y={y} className="side-label" textAnchor="middle" dominantBaseline="middle">
            {label}
          </text>
        ))}
        
        {/* Clickable segment regions (for each available segment) */}
        {onSegmentClick && availableSegmentCoords.map(({ segment, index, coords }) => {
          const isSelected = isSegmentSelected(segment);
          return coords.map((line, lineIdx) => (
            <g key={`clickable-${index}-${lineIdx}`}>
              {/* Invisible wider hit area for easier clicking */}
              <line
                x1={line.x1}
                y1={line.y1}
                x2={line.x2}
                y2={line.y2}
                className="segment-hitarea"
                onClick={() => handleSegmentClick(segment)}
              />
              {/* Visible segment indicator */}
              <line
                x1={line.x1}
                y1={line.y1}
                x2={line.x2}
                y2={line.y2}
                className={`segment-available ${isSelected ? 'segment-selected' : ''}`}
                onClick={() => handleSegmentClick(segment)}
              />
            </g>
          ));
        })}
        
        {/* "From" segment highlight for first edge creation (green) */}
        {fromSegmentCoords && fromSegmentCoords.map((line, idx) => (
          <g key={`from-${idx}`}>
            <line
              x1={line.x1}
              y1={line.y1}
              x2={line.x2}
              y2={line.y2}
              className="segment-from"
            />
            <circle
              cx={line.midX}
              cy={line.midY}
              r={8}
              className="segment-from-midpoint"
            />
          </g>
        ))}
        
        {/* Selected segment highlight on both identified sides */}
        {selectedSegmentCoords && selectedSegmentCoords.map((line, idx) => (
          <g key={`selected-${idx}`}>
            <line
              x1={line.x1}
              y1={line.y1}
              x2={line.x2}
              y2={line.y2}
              className="segment-highlight"
            />
            <circle
              cx={line.midX}
              cy={line.midY}
              r={8}
              className="segment-midpoint"
            />
          </g>
        ))}
        
        {/* Edges */}
        {floatEdges.map((edge, index) => {
          const coords = getEdgeCoordinates(edge);
          const isHighlighted = highlightedEdgeIndex === index;
          const midX = (coords.from.x + coords.to.x) / 2;
          const midY = (coords.from.y + coords.to.y) / 2;
          const dx = coords.to.x - coords.from.x;
          const dy = coords.to.y - coords.from.y;
          const angle = Math.atan2(dy, dx) * (180 / Math.PI);
          
          return (
            <g key={index}>
              <line
                x1={coords.from.x}
                y1={coords.from.y}
                x2={coords.to.x}
                y2={coords.to.y}
                className={`edge-line ${isHighlighted ? 'edge-line-problem' : ''}`}
              />
              <text
                x={midX}
                y={midY}
                className="edge-arrow"
                textAnchor="middle"
                dominantBaseline="middle"
                transform={`rotate(${angle}, ${midX}, ${midY})`}
              >
                ▶
              </text>
            </g>
          );
        })}
        
        {/* All points (equally spaced) */}
        {allPoints.map((point, index) => {
          const coords = getPointOnSide(point.side, point.t);
          return (
            <circle
              key={`point-${index}`}
              cx={coords.x}
              cy={coords.y}
              r={6}
              className="boundary-point"
            />
          );
        })}
        
        {/* Next start point indicator */}
        {nextStartPoint && (
          <circle
            cx={getPointOnSide(nextStartPoint.side, nextStartPoint.t).x}
            cy={getPointOnSide(nextStartPoint.side, nextStartPoint.t).y}
            r={10}
            className="start-point"
          />
        )}
      </svg>
    </div>
  );
}

export default CombinatorialRhombus;
