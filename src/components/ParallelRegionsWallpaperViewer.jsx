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

// P3 lattice vectors (must match moveTree.js)
const SIDE = 300;
const SQRT3 = Math.sqrt(3);
const T1 = { x: 1.5 * SIDE, y: (SQRT3 / 2) * SIDE };
const T2 = { x: 0, y: SQRT3 * SIDE };
const T_DET = T1.x * T2.y - T2.x * T1.y;
const ANGLE_120 = 2 * Math.PI / 3;

/**
 * For rotation index k, find the integer translate (tx,ty) that brings
 * the rotated region center closest to the r=0 region center.
 */
function bestTranslateForRotation(center, k) {
  const angle = k * ANGLE_120;
  const cosK = Math.cos(angle);
  const sinK = Math.sin(angle);
  // rotated center
  const rx = cosK * center.x - sinK * center.y;
  const ry = sinK * center.x + cosK * center.y;
  // solve: tx*T1 + ty*T2 ≈ center - rotatedCenter
  const dx = center.x - rx;
  const dy = center.y - ry;
  const tx = Math.round((dx * T2.y - dy * T2.x) / T_DET);
  const ty = Math.round((T1.x * dy - T1.y * dx) / T_DET);
  return { tx, ty };
}

/**
 * ParallelRegionsWallpaperViewer - tiles the stitched fundamental domain
 * across a P3 wallpaper pattern using 3n² copies (3 rotations around the
 * NE cone point × n² lattice translations).
 */
function ParallelRegionsWallpaperViewer({ fundamentalDomainPolygons, onClose }) {
  const [n, setN] = useState(2);

  // Build 3 base frames whose centers are close together, then tile n² times
  const copies = useMemo(() => {
    // Find center of the fundamental domain region
    const allPts = fundamentalDomainPolygons.flat();
    const center = allPts.length > 0 ? mecApprox(allPts).c : { x: 0, y: 0 };

    // For each rotation k, pick the integer translate that keeps it near r=0
    const baseFrames = [0, 1, 2].map(k => {
      const { tx, ty } = bestTranslateForRotation(center, k);
      return indexToFrame({ tx, ty, r: k });
    });

    // Tile the trio n² times with pure lattice translations
    const result = [];
    const half = Math.floor(n / 2);
    for (let i = -half; i < -half + n; i++) {
      for (let j = -half; j < -half + n; j++) {
        const offX = i * T1.x + j * T2.x;
        const offY = i * T1.y + j * T2.y;
        for (const base of baseFrames) {
          result.push({
            ...base,
            tx: base.tx + offX,
            ty: base.ty + offY
          });
        }
      }
    }
    return result;
  }, [n, fundamentalDomainPolygons]);

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
