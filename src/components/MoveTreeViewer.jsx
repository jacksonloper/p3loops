import { useState, useMemo } from 'react';
import { computeMoveTree, flattenMoveTree, formatWallpaperIndex } from '../utils/moveTree.js';
import './MoveTreeViewer.css';

// Depth configuration
const MIN_DEPTH = 1;
const MAX_DEPTH = 10;

/**
 * Check if a depth value is valid.
 * @param {string} value - The input value
 * @returns {boolean} - True if the value is a valid depth
 */
function isValidDepth(value) {
  const num = parseInt(value, 10);
  return !isNaN(num) && num >= MIN_DEPTH && num <= MAX_DEPTH;
}

/**
 * Format a summary for a long sequence of forced moves.
 * @param {Object[]} segments - Array of segments in the sequence
 * @returns {string} - Summary description
 */
function formatSequenceSummary(segments) {
  if (segments.length <= 1) {
    return null; // No need for summary
  }
  const first = segments[0];
  const last = segments[segments.length - 1];
  const firstSide = first.side.charAt(0).toUpperCase() + first.side.slice(1);
  const lastSide = last.side.charAt(0).toUpperCase() + last.side.slice(1);
  return `${segments.length} forced moves (${firstSide} → ... → ${lastSide})`;
}

/**
 * MoveTreeViewer - Component to display the tree of possible move sequences.
 * 
 * Shows the tree of possible next moves up to a user-specified depth.
 * Sequences with no decision points are collapsed into single segments.
 * Each leaf displays the wallpaper group coordinates of the final position.
 * 
 * @param {Object} state - Current combinatorial state
 * @param {Object} currentWallpaperIndex - Current wallpaper index from parent
 * @param {Function} onClose - Callback to close the viewer
 */
function MoveTreeViewer({ state, currentWallpaperIndex, onClose }) {
  // Separate state for input text (allows temporary invalid values)
  const [depthInput, setDepthInput] = useState('3');
  // The actual valid depth used for computation
  const [depth, setDepth] = useState(3);
  const [expandedNodes, setExpandedNodes] = useState(new Set());
  const [expandedSequences, setExpandedSequences] = useState(new Set());
  
  // Check if the current input is valid
  const isInputValid = isValidDepth(depthInput);
  
  // Handle depth input change - allow any input but only update tree for valid values
  const handleDepthChange = (e) => {
    const value = e.target.value;
    setDepthInput(value);
    
    // Only update the actual depth if the value is valid
    if (isValidDepth(value)) {
      setDepth(parseInt(value, 10));
    }
  };

  // Toggle expansion of a forced move sequence
  const toggleSequence = (sequenceKey) => {
    setExpandedSequences(prev => {
      const next = new Set(prev);
      if (next.has(sequenceKey)) {
        next.delete(sequenceKey);
      } else {
        next.add(sequenceKey);
      }
      return next;
    });
  };

  // Compute the move tree
  const tree = useMemo(() => {
    if (state.edges.length === 0) {
      return [];
    }
    return computeMoveTree(state, depth, currentWallpaperIndex);
  }, [state, depth, currentWallpaperIndex]);

  // Toggle expansion of a node
  const toggleNode = (nodeKey) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(nodeKey)) {
        next.delete(nodeKey);
      } else {
        next.add(nodeKey);
      }
      return next;
    });
  };

  // Expand all nodes
  const expandAll = () => {
    const allKeys = new Set();
    const addAllKeys = (nodes, prefix = '') => {
      nodes.forEach((node, idx) => {
        const key = `${prefix}-${idx}`;
        if (node.children && node.children.length > 0) {
          allKeys.add(key);
          addAllKeys(node.children, key);
        }
      });
    };
    addAllKeys(tree);
    setExpandedNodes(allKeys);
  };

  // Collapse all nodes
  const collapseAll = () => {
    setExpandedNodes(new Set());
    setExpandedSequences(new Set());
  };

  // Render a node and its children recursively
  const renderNode = (node, nodeKey, indentLevel) => {
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expandedNodes.has(nodeKey);
    const indent = indentLevel * 20;
    
    // Check if this node has a long forced sequence
    const hasLongSequence = node.segments && node.segments.length > 1;
    const sequenceKey = `seq-${nodeKey}`;
    const isSequenceExpanded = expandedSequences.has(sequenceKey);
    const sequenceSummary = hasLongSequence ? formatSequenceSummary(node.segments) : null;
    
    // Decide what description to show
    let displayDescription = node.description;
    if (hasLongSequence && !isSequenceExpanded) {
      displayDescription = sequenceSummary;
    }

    return (
      <div key={nodeKey} className="tree-node">
        <div 
          className={`tree-node-content ${node.isLeaf ? 'leaf' : ''} ${node.isCloseLoop ? 'close-loop' : ''}`}
          style={{ marginLeft: `${indent}px` }}
          onClick={() => hasChildren && toggleNode(nodeKey)}
        >
          {hasChildren && (
            <span className="expand-icon">{isExpanded ? '▼' : '▶'}</span>
          )}
          {!hasChildren && <span className="expand-icon-placeholder">•</span>}
          
          <span className="node-description">
            {displayDescription}
            {hasLongSequence && (
              <button 
                className="sequence-toggle-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleSequence(sequenceKey);
                }}
                title={isSequenceExpanded ? 'Collapse sequence details' : 'Expand sequence details'}
              >
                {isSequenceExpanded ? '(collapse)' : '(expand)'}
              </button>
            )}
          </span>
          
          {node.isLeaf && (
            <span className="wallpaper-index" title="Wallpaper group coordinates (tx, ty, rotation)">
              {formatWallpaperIndex(node.wallpaperIndex)}
            </span>
          )}
          
          {node.isCloseLoop && (
            <span className="loop-badge">🔄 Loop</span>
          )}
        </div>

        {hasChildren && isExpanded && (
          <div className="tree-children">
            {node.children.map((child, idx) => 
              renderNode(child, `${nodeKey}-${idx}`, indentLevel + 1)
            )}
          </div>
        )}
      </div>
    );
  };

  const totalNodes = useMemo(() => {
    const flat = flattenMoveTree(tree);
    return flat.length;
  }, [tree]);

  const leafCount = useMemo(() => {
    const flat = flattenMoveTree(tree);
    return flat.filter(item => item.node.isLeaf).length;
  }, [tree]);

  return (
    <div className="move-tree-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="move-tree-modal">
        <div className="move-tree-header">
          <h2>Move Tree</h2>
          <p className="move-tree-subtitle">
            Possible sequences of moves up to {depth} decision point{depth !== 1 ? 's' : ''} deep
          </p>
          <button className="close-btn" onClick={onClose} aria-label="Close">×</button>
        </div>

        <div className="move-tree-controls">
          <div className="depth-control">
            <label htmlFor="depth-input">Depth:</label>
            <input
              id="depth-input"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={depthInput}
              onChange={handleDepthChange}
              className={!isInputValid ? 'invalid' : ''}
              aria-invalid={!isInputValid}
            />
            {!isInputValid && (
              <span className="depth-error">Enter {MIN_DEPTH}-{MAX_DEPTH}</span>
            )}
          </div>
          
          <div className="expand-controls">
            <button onClick={expandAll} className="control-btn">Expand All</button>
            <button onClick={collapseAll} className="control-btn">Collapse All</button>
          </div>
          
          <div className="stats">
            <span>Total options: {totalNodes}</span>
            <span>Leaf nodes: {leafCount}</span>
          </div>
        </div>

        <div className="move-tree-content">
          {tree.length === 0 ? (
            <div className="no-moves">
              {state.edges.length === 0 
                ? 'Add an edge first to see possible moves'
                : 'No valid moves available from current position'
              }
            </div>
          ) : (
            <div className="tree-container">
              {tree.map((node, idx) => renderNode(node, `root-${idx}`, 0))}
            </div>
          )}
        </div>

        <div className="move-tree-footer">
          <p className="help-text">
            <strong>Wallpaper coordinates:</strong> (tx, ty, rotation) where tx, ty are lattice translations and rotation is 0°, 120°, or 240°.
          </p>
          <p className="help-text">
            <strong>Note:</strong> Sequences with only one valid move are collapsed. Click (expand) to see details.
          </p>
        </div>
      </div>
    </div>
  );
}

export default MoveTreeViewer;
