/**
 * Loop Iterator for enumerating all valid loops on the rhombus.
 * 
 * This module provides a system for iterating through all possible closed loops
 * on the rhombus, starting with "north to west" to break symmetry.
 * Loops are enumerated in order of increasing length (number of edges).
 * 
 * Only non-crossing (valid) loops are considered, using the same crossing
 * detection logic as the existing combinatorial path logic.
 * 
 * The iterator maintains state in RAM, building up paths incrementally:
 * - "Open paths" are paths that might still become loops
 * - "Closed loops" are complete valid loops
 * 
 * Paths are extended lazily - we only extend paths when the user requests
 * more loops beyond what we've found so far.
 */

import {
  createInitialState,
  addFirstEdge,
  addEdgeToSegment,
  getNextStartPoint,
  getValidSegments,
  canCloseLoop,
  closeLoop,
  allEdgesToFloat
} from './combinatorialPathLogic.js';

/**
 * @typedef {Object} PathEntry
 * @property {Object} state - The combinatorial state of this path
 * @property {number} length - Number of edges in this path
 * @property {boolean} isLoop - True if this is a complete closed loop
 * @property {boolean} canBecomeLoop - True if this path could potentially become a loop
 */

/**
 * The fixed first edge: north to west.
 * This breaks the symmetry of the rhombus and provides a consistent starting point.
 */
const FIRST_EDGE_FROM = { startPos: null, endPos: null, side: 'north' };
const FIRST_EDGE_TO = { startPos: null, endPos: null, side: 'west' };

/**
 * Create the initial path with the first edge (north to west).
 * @returns {PathEntry|null} The initial path entry, or null if creation fails
 */
function createInitialPath() {
  const state = createInitialState();
  const result = addFirstEdge(state, FIRST_EDGE_FROM, FIRST_EDGE_TO);
  
  if (result.error) {
    console.error('Failed to create initial path:', result.error);
    return null;
  }
  
  return {
    state: result.newState,
    length: 1,
    isLoop: false,
    canBecomeLoop: true
  };
}

/**
 * Check if a path can potentially become a loop.
 * A path cannot become a loop if:
 * - It has no valid segments to extend to
 * - It's already a closed loop (handled separately)
 * 
 * @param {Object} state - The combinatorial state
 * @returns {boolean} True if the path can potentially become a loop
 */
function pathCanBecomeLoop(state) {
  const startPoint = getNextStartPoint(state);
  if (!startPoint) return false;
  
  const validSegments = getValidSegments(state, startPoint);
  const closeResult = canCloseLoop(state);
  
  // Path can potentially become a loop if there are valid moves
  // (either extending or closing)
  return validSegments.length > 0 || closeResult.canClose;
}

/**
 * Extend a path by adding all possible next edges.
 * Returns an array of new path entries (extended paths and/or closed loops).
 * 
 * @param {PathEntry} pathEntry - The path to extend
 * @returns {PathEntry[]} Array of new path entries
 */
function extendPath(pathEntry) {
  const { state, length } = pathEntry;
  const results = [];
  
  const startPoint = getNextStartPoint(state);
  if (!startPoint) return results;
  
  // Check if we can close the loop
  const closeResult = canCloseLoop(state);
  if (closeResult.canClose) {
    const closedResult = closeLoop(state);
    if (!closedResult.error) {
      results.push({
        state: closedResult.newState,
        length: length + 1,
        isLoop: true,
        canBecomeLoop: false
      });
    }
  }
  
  // Get all valid segments and extend to each
  const validSegments = getValidSegments(state, startPoint);
  
  for (const segment of validSegments) {
    const extendResult = addEdgeToSegment(state, startPoint, segment);
    
    if (!extendResult.error && extendResult.newState) {
      const newEntry = {
        state: extendResult.newState,
        length: length + 1,
        isLoop: false,
        canBecomeLoop: pathCanBecomeLoop(extendResult.newState)
      };
      
      // Only add if the path can potentially become a loop
      if (newEntry.canBecomeLoop) {
        results.push(newEntry);
      }
    }
  }
  
  return results;
}

/**
 * LoopIterator - A class for iterating through all valid loops.
 * 
 * Loops are enumerated in order of increasing length.
 * The iterator maintains internal state and builds up paths lazily.
 */
export class LoopIterator {
  constructor() {
    // All discovered loops, sorted by length
    this.loops = [];
    
    // Open paths that might still become loops, organized by length
    // Map: length -> PathEntry[]
    this.openPathsByLength = new Map();
    
    // The maximum length we've fully explored
    this.maxExploredLength = 0;
    
    // Initialize with the first path
    this._initialize();
  }
  
  /**
   * Initialize the iterator with the first edge (north to west).
   */
  _initialize() {
    const initialPath = createInitialPath();
    if (initialPath) {
      this.openPathsByLength.set(1, [initialPath]);
      this.maxExploredLength = 0;
    }
  }
  
  /**
   * Explore all paths of the next unexplored length.
   * This extends all open paths of the current max explored length
   * and categorizes the results.
   * 
   * @returns {boolean} True if new paths/loops were found, false if exploration is complete
   */
  _exploreNextLength() {
    const lengthToExplore = this.maxExploredLength + 1;
    const pathsAtLength = this.openPathsByLength.get(lengthToExplore) || [];
    
    // Clear paths at this length since we're about to process them
    this.openPathsByLength.delete(lengthToExplore);
    
    let foundNew = false;
    
    for (const pathEntry of pathsAtLength) {
      const extended = extendPath(pathEntry);
      
      for (const newEntry of extended) {
        foundNew = true;
        
        if (newEntry.isLoop) {
          // Add to loops list
          this.loops.push(newEntry);
        } else if (newEntry.canBecomeLoop) {
          // Add to open paths at the new length
          const newLength = newEntry.length;
          if (!this.openPathsByLength.has(newLength)) {
            this.openPathsByLength.set(newLength, []);
          }
          this.openPathsByLength.get(newLength).push(newEntry);
        }
      }
    }
    
    this.maxExploredLength = lengthToExplore;
    
    // Return true if there are still open paths to explore
    return foundNew || this.hasOpenPaths();
  }
  
  /**
   * Check if there are any open paths remaining.
   * @returns {boolean}
   */
  hasOpenPaths() {
    for (const paths of this.openPathsByLength.values()) {
      if (paths.length > 0) return true;
    }
    return false;
  }
  
  /**
   * Get the current count of discovered loops.
   * @returns {number}
   */
  getLoopCount() {
    return this.loops.length;
  }
  
  /**
   * Get loops up to a certain count, exploring more if needed.
   * 
   * @param {number} count - Number of loops to retrieve
   * @param {number} maxLength - Maximum path length to explore (safety limit)
   * @returns {PathEntry[]} Array of loop entries
   */
  getLoops(count, maxLength = 50) {
    // Explore until we have enough loops or hit the limit
    while (this.loops.length < count && this.maxExploredLength < maxLength) {
      const hasMore = this._exploreNextLength();
      if (!hasMore && this.loops.length === 0) {
        // No paths left to explore and no loops found yet
        break;
      }
      if (!this.hasOpenPaths()) {
        // No more paths to explore
        break;
      }
    }
    
    // Sort loops by length
    this.loops.sort((a, b) => a.length - b.length);
    
    return this.loops.slice(0, count);
  }
  
  /**
   * Get all loops discovered so far (without exploring further).
   * @returns {PathEntry[]}
   */
  getCurrentLoops() {
    // Sort by length
    this.loops.sort((a, b) => a.length - b.length);
    return [...this.loops];
  }
  
  /**
   * Explore to a specific length (find all loops up to that length).
   * 
   * @param {number} targetLength - The target length to explore to
   */
  exploreToLength(targetLength) {
    while (this.maxExploredLength < targetLength && this.hasOpenPaths()) {
      this._exploreNextLength();
    }
    
    // Sort loops by length
    this.loops.sort((a, b) => a.length - b.length);
  }
  
  /**
   * Get statistics about the current state of exploration.
   * @returns {Object} Statistics object
   */
  getStats() {
    let totalOpenPaths = 0;
    const openByLength = {};
    
    for (const [length, paths] of this.openPathsByLength.entries()) {
      totalOpenPaths += paths.length;
      openByLength[length] = paths.length;
    }
    
    // Count loops by length
    const loopsByLength = {};
    for (const loop of this.loops) {
      loopsByLength[loop.length] = (loopsByLength[loop.length] || 0) + 1;
    }
    
    return {
      totalLoops: this.loops.length,
      totalOpenPaths,
      maxExploredLength: this.maxExploredLength,
      loopsByLength,
      openByLength
    };
  }
  
  /**
   * Reset the iterator to start fresh.
   */
  reset() {
    this.loops = [];
    this.openPathsByLength = new Map();
    this.maxExploredLength = 0;
    this._initialize();
  }
}

/**
 * Convert a loop's state to float edges for visualization.
 * @param {PathEntry} loopEntry - A loop entry
 * @returns {Object[]} Array of float edges
 */
export function loopToFloatEdges(loopEntry) {
  return allEdgesToFloat(loopEntry.state);
}

/**
 * Get a description of a loop for display.
 * @param {PathEntry} loopEntry - A loop entry
 * @param {number} index - The index of this loop in the list
 * @returns {string} A description string
 */
export function describeLoop(loopEntry, index) {
  return `Loop #${index + 1}: ${loopEntry.length} edges`;
}

// Export a singleton iterator for convenience (can also create new instances)
let defaultIterator = null;

/**
 * Get the default loop iterator instance.
 * Creates one if it doesn't exist.
 * @returns {LoopIterator}
 */
export function getDefaultIterator() {
  if (!defaultIterator) {
    defaultIterator = new LoopIterator();
  }
  return defaultIterator;
}

/**
 * Reset the default iterator.
 */
export function resetDefaultIterator() {
  if (defaultIterator) {
    defaultIterator.reset();
  }
}
