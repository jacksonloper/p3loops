import { useMemo } from 'react';
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
 * Get the rhombus path without bowing (straight sides).
 * This is the same as the regular rhombus.
 */
function getStraightRhombusPath() {
  return getRhombusPath();
}

/**
 * CombinatorialRhombus component - renders the combinatorial rhombus visualization.
 * Shows points equally spaced on sides and highlights the selected segment.
 * 
 * @param {Object[]} floatEdges - Array of float edge objects for visualization
 * @param {Object[]} allPoints - Array of point info { side, pos, group, t }
 * @param {Object|null} selectedSegment - Currently selected segment { startPos, endPos, group }
 * @param {Object|null} nextStartPoint - The starting point for the next edge
 * @param {number|null} highlightedEdgeIndex - Index of edge to highlight (for crossing errors)
 */
function CombinatorialRhombus({ 
  floatEdges, 
  allPoints, 
  selectedSegment, 
  nextStartPoint,
  highlightedEdgeIndex = null 
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
  
  const rhombusPath = getStraightRhombusPath();
  
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
  
  // Calculate highlighted segment line if a segment is selected
  const segmentHighlight = useMemo(() => {
    if (!selectedSegment) return null;
    
    const group = selectedSegment.group;
    const canonicalSide = group === 'NE' ? 'north' : 'south';
    const identifiedSide = getIdentifiedSide(canonicalSide);
    
    // Get the points in this group
    const groupPoints = allPoints.filter(p => 
      p.side === canonicalSide || p.side === identifiedSide
    ).sort((a, b) => a.t - b.t);
    
    // Determine t range for the segment
    let startT, endT;
    if (selectedSegment.startPos === null && selectedSegment.endPos === null) {
      startT = 0;
      endT = 1;
    } else if (selectedSegment.startPos === null) {
      startT = 0;
      endT = groupPoints[selectedSegment.endPos]?.t ?? 0;
    } else if (selectedSegment.endPos === null) {
      startT = groupPoints[selectedSegment.startPos]?.t ?? 1;
      endT = 1;
    } else {
      startT = groupPoints[selectedSegment.startPos]?.t ?? 0;
      endT = groupPoints[selectedSegment.endPos]?.t ?? 1;
    }
    
    // Calculate the midpoint (where the new point would go)
    const midT = (startT + endT) / 2;
    
    // Draw on both identified sides
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
        midY: midPt.y
      });
    }
    
    return lines;
  }, [selectedSegment, allPoints]);
  
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
        
        {/* Highlighted segment on both identified sides */}
        {segmentHighlight && segmentHighlight.map((line, idx) => (
          <g key={`segment-${idx}`}>
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
