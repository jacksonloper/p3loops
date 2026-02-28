import { useState, useCallback, useEffect, useMemo } from 'react';
import P2Square from './P2Square.jsx';
import P2ThreeDViewer from './P2ThreeDViewer.jsx';
import P2LoopSelector from './P2LoopSelector.jsx';
import {
  createInitialState,
  getAllSegments,
  getValidSegments,
  getFirstEdgeToSegments,
  segmentToString,
  addEdgeToSegment,
  addFirstEdge,
  getNextStartPoint,
  allEdgesToFloat,
  getAllPointsForDisplay,
  removeLastEdge,
  canCloseLoop,
  closeLoop,
  pointToFloat,
  ZONES
} from '../utils/p2PathLogic.js';
import './CombinatorialApp.css'; // reuse existing styles

function getMessageStyleClass(message) {
  const errorIndicators = ['Error', 'Invalid', 'Failed', 'Cannot', 'forbidden', 'cross', 'would'];
  const isError = errorIndicators.some(indicator =>
    message.toLowerCase().includes(indicator.toLowerCase())
  );
  return isError ? 'error-message' : 'success-message';
}

/**
 * P2App - Main app component for the combinatorial p2 loops editor.
 */
function P2App() {
  const [state, setState] = useState(createInitialState());
  const [selectedSegment, setSelectedSegment] = useState(null);
  const [validationMessage, setValidationMessage] = useState('');
  const [highlightedEdgeIndex, setHighlightedEdgeIndex] = useState(null);
  const [isLoopClosed, setIsLoopClosed] = useState(false);
  const [firstEdgeMode, setFirstEdgeMode] = useState(false);
  const [firstEdgeFromSegment, setFirstEdgeFromSegment] = useState(null);
  const [show3DViewer, setShow3DViewer] = useState(false);
  const [showJsonPanel, setShowJsonPanel] = useState(false);
  const [jsonInputText, setJsonInputText] = useState('');

  useEffect(() => {
    if (highlightedEdgeIndex !== null) {
      const timeout = setTimeout(() => setHighlightedEdgeIndex(null), 2000);
      return () => clearTimeout(timeout);
    }
  }, [highlightedEdgeIndex]);

  const floatEdges = useMemo(() => allEdgesToFloat(state), [state]);
  const allPoints = useMemo(() => getAllPointsForDisplay(state), [state]);

  const nextStartPoint = useMemo(() => {
    if (isLoopClosed) return null;
    const startPt = getNextStartPoint(state);
    if (!startPt) return null;
    return pointToFloat(startPt, state);
  }, [state, isLoopClosed]);

  const nextStartPointCombinatorial = useMemo(() => {
    if (isLoopClosed) return null;
    return getNextStartPoint(state);
  }, [state, isLoopClosed]);

  const availableSegments = useMemo(() => {
    if (firstEdgeMode && firstEdgeFromSegment) {
      return getFirstEdgeToSegments(firstEdgeFromSegment);
    }
    if (state.edges.length === 0) {
      return getAllSegments(state);
    }
    const startPoint = nextStartPointCombinatorial;
    if (!startPoint) return [];
    return getValidSegments(state, startPoint);
  }, [state, firstEdgeMode, firstEdgeFromSegment, nextStartPointCombinatorial]);

  const handleSegmentChange = useCallback((segment) => {
    setSelectedSegment(segment);
    setValidationMessage('');
  }, []);

  const handleAcceptSegment = useCallback(() => {
    if (!selectedSegment) {
      setValidationMessage('Please select a segment first');
      return;
    }

    if (state.edges.length === 0) {
      setValidationMessage('First edge: select "from" segment and "to" segment');
      return;
    }

    const startPoint = nextStartPointCombinatorial;
    if (!startPoint) {
      setValidationMessage('No valid start point');
      return;
    }

    const result = addEdgeToSegment(state, startPoint, selectedSegment);

    if (result.error) {
      setValidationMessage(result.error);
      if (result.crossingEdgeIndex !== undefined) {
        setHighlightedEdgeIndex(result.crossingEdgeIndex);
      }
      return;
    }

    setState(result.newState);
    setSelectedSegment(null);
    setValidationMessage('Edge added!');
  }, [selectedSegment, state, nextStartPointCombinatorial]);

  const handleStartFirstEdge = useCallback(() => {
    if (!selectedSegment) {
      setValidationMessage('Please select a starting segment first');
      return;
    }
    setFirstEdgeFromSegment(selectedSegment);
    setFirstEdgeMode(true);
    setSelectedSegment(null);
    setValidationMessage('Now select the destination segment');
  }, [selectedSegment]);

  const handleCompleteFirstEdge = useCallback(() => {
    if (!firstEdgeFromSegment || !selectedSegment) {
      setValidationMessage('Please select both segments');
      return;
    }

    const result = addFirstEdge(state, firstEdgeFromSegment, selectedSegment);

    if (result.error) {
      setValidationMessage(result.error);
      return;
    }

    setState(result.newState);
    setFirstEdgeMode(false);
    setFirstEdgeFromSegment(null);
    setSelectedSegment(null);
    setValidationMessage('First edge added!');
  }, [state, firstEdgeFromSegment, selectedSegment]);

  const handleCancelFirstEdge = useCallback(() => {
    setFirstEdgeMode(false);
    setFirstEdgeFromSegment(null);
    setSelectedSegment(null);
    setValidationMessage('');
  }, []);

  const handleRemoveLastEdge = useCallback(() => {
    if (isLoopClosed) {
      setIsLoopClosed(false);
      setState(prev => removeLastEdge(prev));
      setValidationMessage('Loop opened');
      return;
    }
    setState(prev => removeLastEdge(prev));
    setValidationMessage('');
  }, [isLoopClosed]);

  const handleClearAll = useCallback(() => {
    setState(createInitialState());
    setSelectedSegment(null);
    setFirstEdgeMode(false);
    setFirstEdgeFromSegment(null);
    setIsLoopClosed(false);
    setValidationMessage('');
  }, []);

  const handleCloseLoop = useCallback(() => {
    const result = canCloseLoop(state);
    if (!result.canClose) {
      setValidationMessage(result.error);
      if (result.crossingEdgeIndex !== undefined) {
        setHighlightedEdgeIndex(result.crossingEdgeIndex);
      }
      return;
    }

    const closeResult = closeLoop(state);
    if (closeResult.error) {
      setValidationMessage(closeResult.error);
      return;
    }

    setState(closeResult.newState);
    setIsLoopClosed(true);
    setValidationMessage('Loop closed!');
  }, [state]);

  const handleCopyJson = useCallback(() => {
    const jsonOutput = JSON.stringify(floatEdges, null, 2);
    navigator.clipboard.writeText(jsonOutput).then(() => {
      setValidationMessage('Path JSON copied to clipboard!');
    }).catch(() => {
      setValidationMessage('Failed to copy to clipboard');
    });
  }, [floatEdges]);

  // Group segments by zone for display
  const segmentsByZone = useMemo(() => {
    const result = {};
    for (const zone of ZONES) {
      const segs = availableSegments.filter(s => s.zone === zone);
      if (segs.length > 0) result[zone] = segs;
    }
    return result;
  }, [availableSegments]);

  const noValidSegments = state.edges.length > 0 && !firstEdgeMode && availableSegments.length === 0;

  // Zone display info for the UI
  const zoneInfo = {
    NNW: { label: 'NNW', id: '≡NNE', color: 'side-north' },
    NNE: { label: 'NNE', id: '≡NNW', color: 'side-north' },
    ENE: { label: 'ENE', id: '≡ESE', color: 'side-east' },
    ESE: { label: 'ESE', id: '≡ENE', color: 'side-east' },
    SSE: { label: 'SSE', id: '≡SSW', color: 'side-south' },
    SSW: { label: 'SSW', id: '≡SSE', color: 'side-south' },
    WSW: { label: 'WSW', id: '≡WNW', color: 'side-west' },
    WNW: { label: 'WNW', id: '≡WSW', color: 'side-west' }
  };

  // Count points per group for info display
  const pointCounts = useMemo(() => {
    return Object.fromEntries(
      Object.entries(state.points).map(([g, pts]) => [g, pts.length])
    );
  }, [state.points]);

  return (
    <div className="combinatorial-app-container">
      <header className="app-header">
        <h1>P2 Loops Editor</h1>
        <p className="subtitle">
          Create non-crossing paths on a square with 180° rotation edge identifications
        </p>
        <p className="subtitle">
          <a href="/" style={{ color: '#667eea', textDecoration: 'none' }}>← Back to P3 Editor</a>
        </p>
      </header>

      <main className="editor-main">
        <div className="layout-row">
          <section className="visualization-section">
            <P2Square
              floatEdges={floatEdges}
              allPoints={allPoints}
              selectedSegment={selectedSegment}
              availableSegments={availableSegments}
              nextStartPoint={nextStartPoint}
              highlightedEdgeIndex={highlightedEdgeIndex}
              onSegmentClick={isLoopClosed ? null : handleSegmentChange}
              firstEdgeFromSegment={firstEdgeFromSegment}
            />

            {selectedSegment && !isLoopClosed && (
              <div className="quick-action-bar">
                {state.edges.length === 0 && !firstEdgeMode && (
                  <button onClick={handleStartFirstEdge} className="quick-action-btn primary">
                    Set as Start →
                  </button>
                )}
                {firstEdgeMode && (
                  <>
                    <button onClick={handleCompleteFirstEdge} className="quick-action-btn primary">
                      Complete First Edge ✓
                    </button>
                    <button onClick={handleCancelFirstEdge} className="quick-action-btn secondary">
                      Cancel
                    </button>
                  </>
                )}
                {state.edges.length > 0 && !firstEdgeMode && (
                  <button onClick={handleAcceptSegment} className="quick-action-btn primary">
                    Add Edge Here ✓
                  </button>
                )}
              </div>
            )}
          </section>

          <section className="segment-selection-section">
            <h3>
              {firstEdgeMode
                ? 'Select Destination'
                : state.edges.length === 0
                  ? 'Select Starting Segment'
                  : 'Select Next Segment'}
            </h3>
            <p className="segment-help">
              {isLoopClosed
                ? 'Loop is closed. Open it to continue editing.'
                : noValidSegments
                  ? 'No valid segments available. Try removing the last edge or closing the loop.'
                  : 'Click on the square or select from the list below:'}
            </p>

            <div className="sides-grid">
              {ZONES.map(zone => {
                const segs = segmentsByZone[zone];
                if (!segs) return null;
                const info = zoneInfo[zone];
                return (
                  <div key={zone} className={`segment-group ${info.color}`}>
                    <h4>
                      {info.label} <span className="side-id">({info.id})</span>
                    </h4>
                    {segs.map((segment, idx) => (
                      <label key={`${zone}-${idx}`}
                             className={`segment-radio ${selectedSegment === segment ? 'selected' : ''}`}>
                        <input
                          type="radio"
                          name="segment"
                          checked={selectedSegment === segment}
                          onChange={() => handleSegmentChange(segment)}
                          disabled={isLoopClosed}
                        />
                        {segmentToString(segment)}
                      </label>
                    ))}
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        <section className="controls-section">
          <div className="button-row">
            {!isLoopClosed && state.edges.length >= 2 && (
              <button onClick={handleCloseLoop} className="control-btn primary-btn">
                Close Loop
              </button>
            )}
            <button onClick={handleRemoveLastEdge}
                    disabled={state.edges.length === 0}
                    className="control-btn danger-btn">
              {isLoopClosed ? 'Open Loop' : 'Remove Last Edge'}
            </button>
            <button onClick={handleClearAll}
                    disabled={state.edges.length === 0}
                    className="control-btn warning-btn">
              Clear All
            </button>
            <button onClick={handleCopyJson}
                    disabled={state.edges.length === 0}
                    className="control-btn secondary-btn">
              Copy JSON
            </button>
            <button onClick={() => setShowJsonPanel(!showJsonPanel)}
                    className="control-btn secondary-btn">
              {showJsonPanel ? 'Hide JSON Panel' : 'Show JSON Panel'}
            </button>
            <button onClick={() => setShow3DViewer(true)}
                    disabled={state.edges.length === 0}
                    className="control-btn primary-btn">
              Render in 3D
            </button>

            <P2LoopSelector
              onSelectLoop={(loop) => {
                setState(loop.state);
                setIsLoopClosed(true);
                setFirstEdgeMode(false);
                setFirstEdgeFromSegment(null);
                setSelectedSegment(null);
                setValidationMessage(`Loaded loop with ${loop.length} edges`);
              }}
            />
          </div>

          {validationMessage && (
            <div className={`message-box ${getMessageStyleClass(validationMessage)}`}>
              {validationMessage}
            </div>
          )}

          <div className="path-info">
            <span className="edge-counter">Edges in path: {state.edges.length}</span>
            <span className="point-counter">
              Points: {Object.entries(pointCounts).map(([g, n]) => `${g}=${n}`).join(', ')}
            </span>
          </div>
        </section>

        {showJsonPanel && (
          <section className="json-section">
            <div className="json-output-area">
              <h3>Current Path JSON</h3>
              <pre className="json-display">{JSON.stringify(floatEdges, null, 2)}</pre>
            </div>
          </section>
        )}

        <section className="info-section">
          <h3>About the P2 Square</h3>
          <ul>
            <li><strong>Shape:</strong> Square fundamental domain with edge identifications</li>
            <li><strong>8 Zones:</strong> Each side is split at its midpoint into two half-sides</li>
            <li><strong>Identifications:</strong> NNW≡NNE, ENE≡ESE, SSE≡SSW, WSW≡WNW (adjacent half-sides identified with reversed order)</li>
            <li><strong>Corners:</strong> All four corners are identified as the same point</li>
          </ul>
          <h3>How to Use</h3>
          <ol>
            <li>Select a segment from the radio buttons or click on the square</li>
            <li>Click &quot;Set as Start&quot; to begin the first edge</li>
            <li>Select a destination segment and complete the first edge</li>
            <li>Continue adding edges — the path chains from edge to edge</li>
          </ol>
        </section>
      </main>

      {show3DViewer && (
        <P2ThreeDViewer
          edges={floatEdges}
          onClose={() => setShow3DViewer(false)}
        />
      )}
    </div>
  );
}

export default P2App;
