import { useState, useMemo, useCallback } from 'react';
import { applyReferenceFrame } from '../utils/wallpaperGeometry.js';
import { indexToFrame } from '../utils/moveTree.js';
import { mecApprox } from '../utils/mecApprox.js';
import './ParallelRegionsWallpaperViewer.css';

/**
 * Convert a polygon (array of {x, y} points) to an SVG path string.
 */
function polygonToPath(polygon) {
  if (polygon.length === 0) return '';
  let d = `M ${polygon[0].x} ${polygon[0].y}`;
  for (let i = 1; i < polygon.length; i++) {
    d += ` L ${polygon[i].x} ${polygon[i].y}`;
  }
  d += ' Z';
  return d;
}

/**
 * ParallelRegionsWallpaperViewer - tiles the stitched fundamental domain
 * across a P3 wallpaper pattern using 3n² copies (3 rotations around the
 * NE cone point × n² lattice translations).
 */
function ParallelRegionsWallpaperViewer({ fundamentalDomainPolygons, onClose }) {
  const [n, setN] = useState(2);

  // Generate 3n² copies (3 rotations × n² translations)
  const copies = useMemo(() => {
    const result = [];
    const half = Math.floor(n / 2);
    for (let i = -half; i < -half + n; i++) {
      for (let j = -half; j < -half + n; j++) {
        for (let k = 0; k < 3; k++) {
          result.push(indexToFrame({ tx: i, ty: j, r: k }));
        }
      }
    }
    return result;
  }, [n]);

  // Transform fundamental domain polygons for each copy
  const { viewBox, copyPaths } = useMemo(() => {
    if (fundamentalDomainPolygons.length === 0) {
      return { viewBox: '0 0 1 1', copyPaths: [] };
    }

    const allPoints = [];

    const copyPaths = copies.map(frame => {
      const pathParts = fundamentalDomainPolygons.map(poly => {
        const transformed = poly.map(pt => {
          const tp = applyReferenceFrame(pt.x, pt.y, frame);
          allPoints.push(tp);
          return tp;
        });
        return polygonToPath(transformed);
      });
      return pathParts.join(' ');
    });

    const { c, r } = mecApprox(allPoints);
    const pad = 40;
    const side = r + pad;
    const vb = `${c.x - side} ${c.y - side} ${2 * side} ${2 * side}`;
    return { viewBox: vb, copyPaths };
  }, [copies, fundamentalDomainPolygons]);

  // SVG export handler
  const handleSaveSvg = useCallback(() => {
    let paths = '';
    for (const pathD of copyPaths) {
      paths += `  <path d="${pathD}" fill="rgb(100, 120, 220)" stroke="white" stroke-width="3" stroke-linejoin="round" stroke-linecap="round" paint-order="stroke" opacity="0.55" />\n`;
    }
    const svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" style="background: #1a1a2e">
${paths}</svg>`;
    const blob = new Blob([svgContent], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'parallel-regions-wallpaper.svg';
    a.click();
    URL.revokeObjectURL(url);
  }, [copyPaths, viewBox]);

  return (
    <div className="pr-wallpaper-overlay" onClick={onClose}>
      <div className="pr-wallpaper-container" onClick={(e) => e.stopPropagation()}>
        <div className="pr-wallpaper-header">
          <h2>Parallel Regions Wallpaper</h2>
          <button onClick={onClose} className="pr-wallpaper-close-btn">×</button>
        </div>

        <div className="pr-wallpaper-canvas">
          <svg viewBox={viewBox} className="pr-wallpaper-svg">
            {copyPaths.map((pathD, idx) => (
              <g key={idx} opacity="0.55">
                <path
                  d={pathD}
                  fill="rgb(100, 120, 220)"
                  stroke="white"
                  strokeWidth="3"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  paintOrder="stroke"
                />
              </g>
            ))}
          </svg>
        </div>

        <div className="pr-wallpaper-controls">
          <p>{copies.length} copies (3×{n}² = {copies.length})</p>
          <div className="pr-wallpaper-slider">
            <label htmlFor="n-slider">Grid size (n):</label>
            <input
              id="n-slider"
              type="range"
              min="1"
              max="5"
              value={n}
              onChange={(e) => setN(parseInt(e.target.value, 10))}
            />
            <span className="pr-wallpaper-n-value">{n}</span>
          </div>
          <button onClick={handleSaveSvg} className="pr-wallpaper-save-btn">
            Save SVG
          </button>
        </div>
      </div>
    </div>
  );
}

export default ParallelRegionsWallpaperViewer;
