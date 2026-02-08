import { useState, useCallback, useEffect } from 'react';
import CombinatorialRhombus from './CombinatorialRhombus.jsx';
import ThreeDViewer from './ThreeDViewer.jsx';
import WallpaperViewer from './WallpaperViewer.jsx';
import { combinatorialToStandardEdges } from '../utils/combinatorialLogic.js';
import './CombinatorialEditor.css';

/**
 * Determine message style class based on content.
 */
function getMessageStyleClass(message) {
  const errorIndicators = ['Error', 'Invalid', 'Failed', 'Cannot', 'forbidden', 'cross', 'loop'];
  const isError = errorIndicators.some(indicator => 
    message.toLowerCase().includes(indicator.toLowerCase())
  );
  return isError ? 'error-message' : 'success-message';
}

/**
 * CombinatorialEditor - Main editor component for the combinatorial approach to p3 loops.
 * 
 * In this mode:
 * - Edges are always side-to-side (including same side)
 * - Points are at integer positions, visualized equally spaced
 * - Crossing detection is combinatorial (chord-based)
 * - Users select segments from a radio form to place points
 */
function CombinatorialEditor({ onSwitchToOriginal }) {
  const [pathEdges, setPathEdges] = useState([]);
  const [validationMessage, setValidationMessage] = useState('');
  const [show3DViewer, setShow3DViewer] = useState(false);
  const [showWallpaperViewer, setShowWallpaperViewer] = useState(false);
  const [highlightedEdgeIndex, setHighlightedEdgeIndex] = useState(null);
  const [isLoopClosed, setIsLoopClosed] = useState(false);

  // Clear highlighted edge after timeout
  useEffect(() => {
    if (highlightedEdgeIndex !== null) {
      const timeout = setTimeout(() => setHighlightedEdgeIndex(null), 2000);
      return () => clearTimeout(timeout);
    }
  }, [highlightedEdgeIndex]);

  const appendEdgeToPath = useCallback((newEdge) => {
    setPathEdges(current => [...current, newEdge]);
    setValidationMessage('');
  }, []);

  const removeLastEdge = useCallback(() => {
    if (isLoopClosed) {
      setIsLoopClosed(false);
      setPathEdges(current => current.slice(0, -1));
      setValidationMessage('Loop opened');
      return;
    }
    
    setPathEdges(current => current.slice(0, -1));
    setValidationMessage('');
  }, [isLoopClosed]);

  const clearEntirePath = useCallback(() => {
    setPathEdges([]);
    setIsLoopClosed(false);
    setValidationMessage('');
  }, []);

  const handleEdgeError = useCallback((errorMessage, crossingEdgeIndex = null) => {
    setValidationMessage(errorMessage);
    if (crossingEdgeIndex !== null) {
      setHighlightedEdgeIndex(crossingEdgeIndex);
    }
  }, []);

  // Convert combinatorial edges to standard format for viewers
  const standardEdges = combinatorialToStandardEdges(pathEdges);

  const copyPathToClipboard = useCallback(() => {
    const jsonOutput = JSON.stringify(pathEdges, null, 2);
    navigator.clipboard.writeText(jsonOutput).then(() => {
      setValidationMessage('Path JSON copied to clipboard!');
    }).catch(() => {
      setValidationMessage('Failed to copy to clipboard');
    });
  }, [pathEdges]);

  return (
    <div className="combinatorial-editor-container">
      <header className="app-header">
        <h1>P3 Loops - Combinatorial Mode</h1>
        <p className="subtitle">Create paths using integer positions and combinatorial crossing detection</p>
        <button onClick={onSwitchToOriginal} className="mode-switch-btn">
          Switch to Original Editor →
        </button>
      </header>

      <main className="editor-main">
        <section className="visualization-section">
          <CombinatorialRhombus
            edges={pathEdges}
            onAddEdge={appendEdgeToPath}
            onError={handleEdgeError}
            highlightedEdgeIndex={highlightedEdgeIndex}
            disabled={isLoopClosed}
          />
        </section>

        <section className="controls-section">
          <div className="button-row">
            <button 
              onClick={removeLastEdge} 
              disabled={pathEdges.length === 0}
              className="control-btn danger-btn"
            >
              {isLoopClosed ? 'Open Loop' : 'Remove Last Edge'}
            </button>
            {!isLoopClosed && (
              <button 
                onClick={clearEntirePath}
                disabled={pathEdges.length === 0}
                className="control-btn warning-btn"
              >
                Clear All
              </button>
            )}
            <button 
              onClick={copyPathToClipboard}
              disabled={pathEdges.length === 0}
              className="control-btn primary-btn"
            >
              Copy JSON
            </button>
            <button 
              onClick={() => setShow3DViewer(true)}
              disabled={pathEdges.length === 0}
              className="control-btn primary-btn"
            >
              Render in 3D
            </button>
            <button 
              onClick={() => setShowWallpaperViewer(true)}
              disabled={pathEdges.length === 0}
              className="control-btn primary-btn"
            >
              View as P3 Wallpaper
            </button>
          </div>

          {validationMessage && (
            <div className={`message-box ${getMessageStyleClass(validationMessage)}`}>
              {validationMessage}
            </div>
          )}

          <div className="path-info">
            <span className="edge-counter">Edges in path: {pathEdges.length}</span>
          </div>
        </section>

        <section className="info-section">
          <h3>About Combinatorial Mode</h3>
          <ul>
            <li><strong>Integer Positions:</strong> Points are at integer positions (1, 2, 3, ...) along each side</li>
            <li><strong>Equal Spacing:</strong> Points are visualized equally spaced on each side</li>
            <li><strong>Segment Selection:</strong> Select where to place points from the segment list</li>
            <li><strong>Same-Side Edges:</strong> Edges can go from one side to the same side</li>
            <li><strong>Combinatorial Crossing:</strong> Crossings are detected using chord intersection (like on a circle)</li>
          </ul>
          <h3>How to Use</h3>
          <ul>
            <li>For the first edge, select the start segment, then the end segment</li>
            <li>For subsequent edges, the start point is automatically set to the continuation</li>
            <li>North ↔ East and South ↔ West edges are identified</li>
            <li>Use 3D and Wallpaper views to visualize your path</li>
          </ul>
        </section>
      </main>

      {show3DViewer && (
        <ThreeDViewer 
          edges={standardEdges}
          onClose={() => setShow3DViewer(false)}
        />
      )}

      {showWallpaperViewer && (
        <WallpaperViewer 
          edges={standardEdges}
          isLoopClosed={isLoopClosed}
          onClose={() => setShowWallpaperViewer(false)}
        />
      )}
    </div>
  );
}

export default CombinatorialEditor;
