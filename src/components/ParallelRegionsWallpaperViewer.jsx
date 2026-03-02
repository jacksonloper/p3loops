import { useState, useMemo } from 'react';
import {
  applyReferenceFrame,
  paperToTrueRhombus,
  NE_CORNER,
  NW_CORNER,
  SE_CORNER,
  SW_CORNER
} from '../utils/wallpaperGeometry.js';
import { indexToFrame, updateWallpaperIndex } from '../utils/moveTree.js';
import { generateParallelRegionsPaper } from '../utils/parallelizable.js';
import { allEdgesToFloat } from '../utils/combinatorialPathLogic.js';
import { getEdgeSamplePointsPaper, getIdentifiedSide } from '../utils/geometry.js';
import './ParallelRegionsWallpaperViewer.css';

// Number of sample points per edge for curved rendering
const EDGE_SAMPLES = 20;

/**
 * Generate a color for a connected component index.
 * Uses golden angle (≈137.508°) spacing for visually distinct colors.
 */
function componentToColor(componentId, alpha = 0.45) {
  const GOLDEN_ANGLE = 137.508;
  const h = (componentId * GOLDEN_ANGLE) % 360;
  const s = 55 + (componentId * 17) % 25;
  const l = 40 + (componentId * 13) % 20;
  return `hsla(${h}, ${s}%, ${l}%, ${alpha})`;
}

// ---------- Union-Find ----------

function makeUnionFind() {
  const parent = {};
  const rank = {};

  function makeSet(key) {
    parent[key] = key;
    rank[key] = 0;
  }

  function find(key) {
    if (parent[key] !== key) parent[key] = find(parent[key]);
    return parent[key];
  }

  function union(a, b) {
    const rootA = find(a);
    const rootB = find(b);
    if (rootA === rootB) return;
    if (rank[rootA] < rank[rootB]) parent[rootA] = rootB;
    else if (rank[rootA] > rank[rootB]) parent[rootB] = rootA;
    else { parent[rootB] = rootA; rank[rootA]++; }
  }

  return { makeSet, find, union };
}

/**
 * Compute connected components for all (copy, region) pairs.
 *
 * Two regions (possibly in different copies) are connected if they are
 * adjacent at a rhombus boundary around a boundary node that is NOT the
 * beginning or ending of the path.
 *
 * Each boundary node is an edge endpoint on some side at position t.
 * The identified side (north↔east, south↔west) in the adjacent copy
 * has a corresponding boundary node at the same t if an edge touches
 * that side there.  When both exist and neither is start/end, the two
 * regions are connected.
 */
function computeConnectedComponents(floatEdges, paperRegions, copies) {
  if (paperRegions.length === 0 || floatEdges.length === 0) return {};

  // edgeIndex → regionIndex
  const edgeToRegion = new Map();
  for (let r = 0; r < paperRegions.length; r++) {
    edgeToRegion.set(paperRegions[r].edgeIndex, r);
  }

  // (side, t) → regionIndex
  const boundaryToRegion = new Map();
  for (let eIdx = 0; eIdx < floatEdges.length; eIdx++) {
    const rIdx = edgeToRegion.get(eIdx);
    if (rIdx === undefined) continue;
    const edge = floatEdges[eIdx];
    boundaryToRegion.set(`${edge.from.side}:${edge.from.t}`, rIdx);
    boundaryToRegion.set(`${edge.to.side}:${edge.to.t}`, rIdx);
  }

  // Start and end of path
  const startSide = floatEdges[0].from.side;
  const startT = floatEdges[0].from.t;
  const endSide = floatEdges[floatEdges.length - 1].to.side;
  const endT = floatEdges[floatEdges.length - 1].to.t;

  // Tolerance for floating-point position comparison
  const POSITION_TOLERANCE = 1e-9;

  function isStartOrEnd(side, t) {
    if (Math.abs(t - startT) < POSITION_TOLERANCE &&
        (side === startSide || side === getIdentifiedSide(startSide))) return true;
    if (Math.abs(t - endT) < POSITION_TOLERANCE &&
        (side === endSide || side === getIdentifiedSide(endSide))) return true;
    return false;
  }

  // Copy lookup set
  const copySet = new Set(copies.map(c => `${c.index.tx},${c.index.ty},${c.index.r}`));

  // Union-Find
  const uf = makeUnionFind();
  for (const { index } of copies) {
    for (let r = 0; r < paperRegions.length; r++) {
      uf.makeSet(`${index.tx},${index.ty},${index.r}:${r}`);
    }
  }

  // Create connections across copies
  for (const { index } of copies) {
    for (let eIdx = 0; eIdx < floatEdges.length; eIdx++) {
      const edge = floatEdges[eIdx];

      for (const endpoint of [edge.from, edge.to]) {
        const { side, t } = endpoint;

        // Skip start/end of path — they block connectivity
        if (isStartOrEnd(side, t)) continue;

        // Region in current copy owning this boundary node
        const currentRegion = boundaryToRegion.get(`${side}:${t}`);
        if (currentRegion === undefined) continue;

        // Region in adjacent copy owning the identified node
        const identifiedSide = getIdentifiedSide(side);
        const adjacentRegion = boundaryToRegion.get(`${identifiedSide}:${t}`);
        if (adjacentRegion === undefined) continue;

        // Adjacent copy via wallpaper index update
        const adjacentIndex = updateWallpaperIndex(side, index);
        const adjacentKey = `${adjacentIndex.tx},${adjacentIndex.ty},${adjacentIndex.r}`;
        if (!copySet.has(adjacentKey)) continue;

        uf.union(
          `${index.tx},${index.ty},${index.r}:${currentRegion}`,
          `${adjacentKey}:${adjacentRegion}`
        );
      }
    }
  }

  // Assign a color index to each connected component
  const componentIds = {};
  let nextId = 0;
  const result = {};

  for (const { index } of copies) {
    for (let r = 0; r < paperRegions.length; r++) {
      const key = `${index.tx},${index.ty},${index.r}:${r}`;
      const root = uf.find(key);
      if (!(root in componentIds)) {
        componentIds[root] = nextId++;
      }
      result[key] = componentIds[root];
    }
  }

  return result;
}

/**
 * Convert a paper-coordinate polygon to a screen-space SVG path string
 * by transforming each point through paperToTrueRhombus and applyReferenceFrame.
 */
function paperPolygonToPath(polygon, frame) {
  if (polygon.length === 0) return '';
  const screenPts = polygon.map(pt => {
    const local = paperToTrueRhombus(pt.southward, pt.eastward);
    return applyReferenceFrame(local.x, local.y, frame);
  });
  let d = `M ${screenPts[0].x} ${screenPts[0].y}`;
  for (let i = 1; i < screenPts.length; i++) {
    d += ` L ${screenPts[i].x} ${screenPts[i].y}`;
  }
  d += ' Z';
  return d;
}

/**
 * Generate SVG path for a single edge in a given reference frame.
 */
function generateEdgePath(edge, frame) {
  const samplePoints = getEdgeSamplePointsPaper(
    edge.from.side, edge.from.t,
    edge.to.side, edge.to.t,
    EDGE_SAMPLES
  );
  
  const screenPoints = samplePoints.map(pt => {
    const localScreen = paperToTrueRhombus(pt.southward, pt.eastward);
    return applyReferenceFrame(localScreen.x, localScreen.y, frame);
  });
  
  if (screenPoints.length < 2) return '';
  
  let path = `M ${screenPoints[0].x} ${screenPoints[0].y}`;
  for (let i = 1; i < screenPoints.length; i++) {
    path += ` L ${screenPoints[i].x} ${screenPoints[i].y}`;
  }
  return path;
}

/**
 * Get the rhombus outline path for a given reference frame.
 */
function getRhombusPathString(frame) {
  const corners = {
    ne: applyReferenceFrame(NE_CORNER.x, NE_CORNER.y, frame),
    nw: applyReferenceFrame(NW_CORNER.x, NW_CORNER.y, frame),
    se: applyReferenceFrame(SE_CORNER.x, SE_CORNER.y, frame),
    sw: applyReferenceFrame(SW_CORNER.x, SW_CORNER.y, frame)
  };
  return `M ${corners.nw.x} ${corners.nw.y} L ${corners.ne.x} ${corners.ne.y} L ${corners.se.x} ${corners.se.y} L ${corners.sw.x} ${corners.sw.y} Z`;
}

/**
 * Get the center of a rhombus in a given frame.
 */
function getRhombusCenter(frame) {
  const corners = [
    applyReferenceFrame(NE_CORNER.x, NE_CORNER.y, frame),
    applyReferenceFrame(NW_CORNER.x, NW_CORNER.y, frame),
    applyReferenceFrame(SE_CORNER.x, SE_CORNER.y, frame),
    applyReferenceFrame(SW_CORNER.x, SW_CORNER.y, frame)
  ];
  return {
    x: (corners[0].x + corners[1].x + corners[2].x + corners[3].x) / 4,
    y: (corners[0].y + corners[1].y + corners[2].y + corners[3].y) / 4
  };
}

/**
 * ParallelRegionsWallpaperViewer - renders parallel regions tiled across
 * a P3 wallpaper pattern with 3n² copies, colored by connected component.
 */
function ParallelRegionsWallpaperViewer({ state, onClose }) {
  const [n, setN] = useState(2);

  // Compute float edges for drawing edge curves
  const floatEdges = useMemo(() => allEdgesToFloat(state), [state]);

  // Generate paper-coordinate parallel regions (once, shared across all copies)
  const paperRegions = useMemo(() => {
    return generateParallelRegionsPaper(state, 30);
  }, [state]);

  // Generate all 3n² rhombus copies (n × n grid × 3 rotations)
  const copies = useMemo(() => {
    const result = [];
    const half = Math.floor(n / 2);
    for (let i = -half; i < -half + n; i++) {
      for (let j = -half; j < -half + n; j++) {
        for (let k = 0; k < 3; k++) {
          const index = { tx: i, ty: j, r: k };
          const frame = indexToFrame(index);
          result.push({ index, frame });
        }
      }
    }
    return result;
  }, [n]);

  // Compute connected components for coloring
  const componentColorMap = useMemo(() => {
    return computeConnectedComponents(floatEdges, paperRegions, copies);
  }, [floatEdges, paperRegions, copies]);

  // Compute bounding box from all rhombus corners
  const viewBox = useMemo(() => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const { frame } of copies) {
      const center = getRhombusCenter(frame);
      // Use a generous estimate per rhombus
      minX = Math.min(minX, center.x - 350);
      minY = Math.min(minY, center.y - 350);
      maxX = Math.max(maxX, center.x + 350);
      maxY = Math.max(maxY, center.y + 350);
    }
    const padding = 40;
    return `${minX - padding} ${minY - padding} ${maxX - minX + 2 * padding} ${maxY - minY + 2 * padding}`;
  }, [copies]);

  return (
    <div className="pr-wallpaper-overlay" onClick={onClose}>
      <div className="pr-wallpaper-container" onClick={(e) => e.stopPropagation()}>
        <div className="pr-wallpaper-header">
          <h2>Parallel Regions Wallpaper</h2>
          <button onClick={onClose} className="pr-wallpaper-close-btn">×</button>
        </div>

        <div className="pr-wallpaper-canvas">
          <svg viewBox={viewBox} className="pr-wallpaper-svg">
            {/* For each copy, render rhombus outline + filled regions + edges */}
            {copies.map(({ index, frame }) => {
              const copyKey = `${index.tx},${index.ty},${index.r}`;

              return (
                <g key={copyKey}>
                  {/* Rhombus outline */}
                  <path
                    d={getRhombusPathString(frame)}
                    fill="none"
                    stroke="rgba(255,255,255,0.08)"
                    strokeWidth="0.5"
                  />

                  {/* Filled regions colored by connected component */}
                  {paperRegions.map((region, rIdx) => {
                    const compId = componentColorMap[`${copyKey}:${rIdx}`] ?? 0;
                    return (
                      <path
                        key={`${copyKey}-r${rIdx}`}
                        d={paperPolygonToPath(region.polygon, frame)}
                        fill={componentToColor(compId, 0.45)}
                        stroke={componentToColor(compId, 0.7)}
                        strokeWidth="0.5"
                      />
                    );
                  })}

                  {/* Edge curves drawn on top */}
                  {floatEdges.map((edge, eIdx) => (
                    <path
                      key={`${copyKey}-e${eIdx}`}
                      d={generateEdgePath(edge, frame)}
                      fill="none"
                      stroke="rgba(255,255,255,0.6)"
                      strokeWidth="1"
                      strokeLinecap="round"
                    />
                  ))}
                </g>
              );
            })}
          </svg>
        </div>

        <div className="pr-wallpaper-controls">
          <p>{copies.length} copies (3n², n={n})</p>
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
        </div>
      </div>
    </div>
  );
}

export default ParallelRegionsWallpaperViewer;
