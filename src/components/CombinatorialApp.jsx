import { useState, useCallback, useEffect, useMemo } from 'react';
import CombinatorialRhombus from './CombinatorialRhombus.jsx';
import ThreeDViewer from './ThreeDViewer.jsx';
import WallpaperViewer from './WallpaperViewer.jsx';
import {
  createInitialState,
  getAllSegments,
  segmentToString,
  addEdgeToSegment,
  addFirstEdge,
  getNextStartPoint,
  allEdgesToFloat,
  getAllPointsForDisplay,
  removeLastEdge,
  importFromFloatEdges,
  canCloseLoop,
  closeLoop,
  pointToFloat,
  getSideGroup
} from '../utils/combinatorialPathLogic.js';
import './CombinatorialApp.css';

/**
 * Determine message style class based on content.
 */
function getMessageStyleClass(message) {
  const errorIndicators = ['Error', 'Invalid', 'Failed', 'Cannot', 'forbidden', 'cross', 'would'];
  const isError = errorIndicators.some(indicator => 
    message.toLowerCase().includes(indicator.toLowerCase())
  );
  return isError ? 'error-message' : 'success-message';
}

/**
 * CombinatorialApp - Main app component for the combinatorial p3 loops editor.
 */
function CombinatorialApp() {
  const [state, setState] = useState(createInitialState());
  const [selectedSegment, setSelectedSegment] = useState(null);
  const [selectedTargetSide, setSelectedTargetSide] = useState('north');
  const [validationMessage, setValidationMessage] = useState('');
  const [show3DViewer, setShow3DViewer] = useState(false);
  const [showWallpaperViewer, setShowWallpaperViewer] = useState(false);
  const [highlightedEdgeIndex, setHighlightedEdgeIndex] = useState(null);
  const [isLoopClosed, setIsLoopClosed] = useState(false);
  const [examplesList, setExamplesList] = useState([]);
  const [selectedExample, setSelectedExample] = useState('');
  const [loadingExample, setLoadingExample] = useState(false);

  // Load examples manifest on mount
  useEffect(() => {
    fetch('/examples/manifest.json')
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch manifest');
        return res.json();
      })
      .then(setExamplesList)
      .catch(err => {
        console.warn('Failed to load examples manifest:', err);
        setExamplesList([]);
      });
  }, []);

  // Clear highlighted edge after timeout
  useEffect(() => {
    if (highlightedEdgeIndex !== null) {
      const timeout = setTimeout(() => setHighlightedEdgeIndex(null), 2000);
      return () => clearTimeout(timeout);
    }
  }, [highlightedEdgeIndex]);

  // Get the current float edges for visualization
  const floatEdges = useMemo(() => allEdgesToFloat(state), [state]);
  
  // Get all points for display
  const allPoints = useMemo(() => getAllPointsForDisplay(state), [state]);
  
  // Get the next start point (for chaining)
  const nextStartPoint = useMemo(() => {
    if (isLoopClosed) return null;
    const startPt = getNextStartPoint(state);
    if (!startPt) return null;
    return pointToFloat(startPt, state);
  }, [state, isLoopClosed]);
  
  // Get the start point in combinatorial form
  const nextStartPointCombinatorial = useMemo(() => {
    if (isLoopClosed) return null;
    return getNextStartPoint(state);
  }, [state, isLoopClosed]);

  // Get available segments
  const availableSegments = useMemo(() => {
    return getAllSegments(state);
  }, [state]);

  // Handle segment selection from radio
  const handleSegmentChange = useCallback((segment) => {
    setSelectedSegment(segment);
    // Auto-select appropriate target side based on segment group
    if (segment.group === 'NE') {
      setSelectedTargetSide('north');
    } else {
      setSelectedTargetSide('south');
    }
    setValidationMessage('');
  }, []);

  // Handle accepting the selected segment (adding an edge)
  const handleAcceptSegment = useCallback(() => {
    if (!selectedSegment) {
      setValidationMessage('Please select a segment first');
      return;
    }
    
    // Validate target side matches segment group
    if (getSideGroup(selectedTargetSide) !== selectedSegment.group) {
      setValidationMessage(`Target side "${selectedTargetSide}" does not match segment group "${selectedSegment.group}"`);
      return;
    }
    
    if (state.edges.length === 0) {
      // First edge - need to select both from and to segments
      // For now, we'll add a simple first edge
      // User should select two segments for the first edge
      setValidationMessage('First edge: select "from" segment and "to" segment');
      return;
    }
    
    // Add edge from current end point to selected segment
    const startPoint = nextStartPointCombinatorial;
    if (!startPoint) {
      setValidationMessage('No valid start point');
      return;
    }
    
    const result = addEdgeToSegment(state, startPoint, selectedSegment, selectedTargetSide);
    
    if (result.error) {
      setValidationMessage(result.error);
      if (result.crossingEdgeIndex !== undefined) {
        setHighlightedEdgeIndex(result.crossingEdgeIndex);
      }
      return;
    }
    
    setState(result.newState);
    setSelectedSegment(null);
    setValidationMessage('Edge added successfully!');
  }, [selectedSegment, selectedTargetSide, state, nextStartPointCombinatorial]);

  // State for first edge selection
  const [firstEdgeMode, setFirstEdgeMode] = useState(false);
  const [firstEdgeFromSegment, setFirstEdgeFromSegment] = useState(null);
  const [firstEdgeFromSide, setFirstEdgeFromSide] = useState('north');

  // Handle starting first edge mode
  const handleStartFirstEdge = useCallback(() => {
    if (!selectedSegment) {
      setValidationMessage('Please select a starting segment first');
      return;
    }
    setFirstEdgeFromSegment(selectedSegment);
    setFirstEdgeFromSide(selectedTargetSide);
    setFirstEdgeMode(true);
    setSelectedSegment(null);
    setValidationMessage('Now select the destination segment');
  }, [selectedSegment, selectedTargetSide]);

  // Handle completing first edge
  const handleCompleteFirstEdge = useCallback(() => {
    if (!firstEdgeFromSegment || !selectedSegment) {
      setValidationMessage('Please select both segments');
      return;
    }
    
    const result = addFirstEdge(
      state, 
      firstEdgeFromSegment, 
      firstEdgeFromSide, 
      selectedSegment, 
      selectedTargetSide
    );
    
    if (result.error) {
      setValidationMessage(result.error);
      return;
    }
    
    setState(result.newState);
    setFirstEdgeMode(false);
    setFirstEdgeFromSegment(null);
    setSelectedSegment(null);
    setValidationMessage('First edge added!');
  }, [state, firstEdgeFromSegment, firstEdgeFromSide, selectedSegment, selectedTargetSide]);

  // Handle cancel first edge mode
  const handleCancelFirstEdge = useCallback(() => {
    setFirstEdgeMode(false);
    setFirstEdgeFromSegment(null);
    setSelectedSegment(null);
    setValidationMessage('');
  }, []);

  // Handle removing last edge
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

  // Handle clearing all
  const handleClearAll = useCallback(() => {
    setState(createInitialState());
    setSelectedSegment(null);
    setFirstEdgeMode(false);
    setFirstEdgeFromSegment(null);
    setIsLoopClosed(false);
    setValidationMessage('');
  }, []);

  // Handle closing the loop
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

  // Handle loading an example
  const loadExample = useCallback(async (exampleId) => {
    if (!exampleId) return;
    
    const example = examplesList.find(e => e.id === exampleId);
    if (!example) return;
    
    setLoadingExample(true);
    try {
      const res = await fetch(`/examples/${example.filename}`);
      const data = await res.json();
      
      // Import into combinatorial format
      const newState = importFromFloatEdges(data);
      
      setState(newState);
      setIsLoopClosed(false);
      setFirstEdgeMode(false);
      setFirstEdgeFromSegment(null);
      setSelectedSegment(null);
      setValidationMessage(`Loaded example: ${example.name}`);
    } catch (err) {
      const errorMsg = err instanceof SyntaxError 
        ? 'Invalid example format' 
        : 'Network error loading example';
      setValidationMessage(errorMsg);
    } finally {
      setLoadingExample(false);
    }
  }, [examplesList]);

  // Handle copying JSON
  const handleCopyJson = useCallback(() => {
    const jsonOutput = JSON.stringify(floatEdges, null, 2);
    navigator.clipboard.writeText(jsonOutput).then(() => {
      setValidationMessage('Path JSON copied to clipboard!');
    }).catch(() => {
      setValidationMessage('Failed to copy to clipboard');
    });
  }, [floatEdges]);

  // Group segments by group for display
  const neSegments = useMemo(() => 
    availableSegments.filter(s => s.group === 'NE'),
    [availableSegments]
  );
  const swSegments = useMemo(() => 
    availableSegments.filter(s => s.group === 'SW'),
    [availableSegments]
  );

  return (
    <div className="combinatorial-app-container">
      <header className="app-header">
        <h1>Combinatorial P3 Loops Editor</h1>
        <p className="subtitle">
          Side-to-side edges with integer positions (no interior points)
        </p>
        <a href="#" className="nav-link">← Back to Geometric Editor</a>
      </header>

      <main className="editor-main">
        <div className="layout-row">
          <section className="visualization-section">
            <CombinatorialRhombus
              floatEdges={floatEdges}
              allPoints={allPoints}
              selectedSegment={selectedSegment}
              nextStartPoint={nextStartPoint}
              highlightedEdgeIndex={highlightedEdgeIndex}
            />
          </section>

          <section className="segment-selection-section">
            <h3>Select Segment</h3>
            
            <div className="segment-group">
              <h4>North/East Side</h4>
              {neSegments.map((segment, idx) => (
                <label key={`ne-${idx}`} className="segment-radio">
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

            <div className="segment-group">
              <h4>South/West Side</h4>
              {swSegments.map((segment, idx) => (
                <label key={`sw-${idx}`} className="segment-radio">
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

            {selectedSegment && (
              <div className="target-side-selection">
                <h4>Target Side</h4>
                <label className="side-radio">
                  <input
                    type="radio"
                    name="targetSide"
                    value="north"
                    checked={selectedTargetSide === 'north'}
                    onChange={(e) => setSelectedTargetSide(e.target.value)}
                    disabled={selectedSegment.group !== 'NE'}
                  />
                  North
                </label>
                <label className="side-radio">
                  <input
                    type="radio"
                    name="targetSide"
                    value="east"
                    checked={selectedTargetSide === 'east'}
                    onChange={(e) => setSelectedTargetSide(e.target.value)}
                    disabled={selectedSegment.group !== 'NE'}
                  />
                  East
                </label>
                <label className="side-radio">
                  <input
                    type="radio"
                    name="targetSide"
                    value="south"
                    checked={selectedTargetSide === 'south'}
                    onChange={(e) => setSelectedTargetSide(e.target.value)}
                    disabled={selectedSegment.group !== 'SW'}
                  />
                  South
                </label>
                <label className="side-radio">
                  <input
                    type="radio"
                    name="targetSide"
                    value="west"
                    checked={selectedTargetSide === 'west'}
                    onChange={(e) => setSelectedTargetSide(e.target.value)}
                    disabled={selectedSegment.group !== 'SW'}
                  />
                  West
                </label>
              </div>
            )}
          </section>
        </div>

        <section className="controls-section">
          <div className="button-row">
            {state.edges.length === 0 && !firstEdgeMode && (
              <button
                onClick={handleStartFirstEdge}
                disabled={!selectedSegment || isLoopClosed}
                className="control-btn primary-btn"
              >
                Start First Edge Here
              </button>
            )}
            
            {firstEdgeMode && (
              <>
                <button
                  onClick={handleCompleteFirstEdge}
                  disabled={!selectedSegment}
                  className="control-btn primary-btn"
                >
                  Complete First Edge Here
                </button>
                <button
                  onClick={handleCancelFirstEdge}
                  className="control-btn secondary-btn"
                >
                  Cancel
                </button>
              </>
            )}
            
            {state.edges.length > 0 && !firstEdgeMode && !isLoopClosed && (
              <button
                onClick={handleAcceptSegment}
                disabled={!selectedSegment}
                className="control-btn primary-btn"
              >
                Add Edge to Selected Segment
              </button>
            )}
            
            <button 
              onClick={handleRemoveLastEdge} 
              disabled={state.edges.length === 0}
              className="control-btn danger-btn"
            >
              {isLoopClosed ? 'Open Loop' : 'Remove Last Edge'}
            </button>
            
            {!isLoopClosed && state.edges.length >= 2 && (
              <button
                onClick={handleCloseLoop}
                className="control-btn primary-btn"
              >
                Close Loop
              </button>
            )}
            
            <button 
              onClick={handleClearAll}
              disabled={state.edges.length === 0}
              className="control-btn warning-btn"
            >
              Clear All
            </button>
            
            <button 
              onClick={handleCopyJson}
              disabled={state.edges.length === 0}
              className="control-btn secondary-btn"
            >
              Copy JSON
            </button>
            
            <button 
              onClick={() => setShow3DViewer(true)}
              disabled={state.edges.length === 0}
              className="control-btn primary-btn"
            >
              Render in 3D
            </button>
            
            <button 
              onClick={() => setShowWallpaperViewer(true)}
              disabled={state.edges.length === 0}
              className="control-btn primary-btn"
            >
              View as P3 Wallpaper
            </button>
          </div>

          {examplesList.length > 0 && (
            <div className="example-selector">
              <label htmlFor="example-select">Load Example:</label>
              <select
                id="example-select"
                value={selectedExample}
                onChange={(e) => {
                  setSelectedExample(e.target.value);
                  loadExample(e.target.value);
                }}
                disabled={loadingExample}
              >
                <option value="">Select an example...</option>
                {examplesList.map(example => (
                  <option key={example.id} value={example.id}>
                    {example.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {validationMessage && (
            <div className={`message-box ${getMessageStyleClass(validationMessage)}`}>
              {validationMessage}
            </div>
          )}

          <div className="path-info">
            <span className="edge-counter">Edges in path: {state.edges.length}</span>
            <span className="point-counter">Points: NE={state.points.NE.length}, SW={state.points.SW.length}</span>
          </div>
        </section>

        <section className="info-section">
          <h3>About Combinatorial Mode</h3>
          <ul>
            <li><strong>No Interior Points:</strong> All edges go from side to side</li>
            <li><strong>Integer Positions:</strong> Points are ordered, not positioned by floating-point coordinates</li>
            <li><strong>Same-Side Edges:</strong> Edges can go from a side back to the same side</li>
            <li><strong>Segment Selection:</strong> New edges join to segments between existing points</li>
          </ul>
          <h3>How to Use</h3>
          <ol>
            <li>Select a segment from the radio buttons</li>
            <li>Choose which specific side (north/east or south/west) for the new point</li>
            <li>Click "Add Edge" to extend the path to the selected segment</li>
            <li>The highlighted line shows where the new point will be created</li>
          </ol>
        </section>
      </main>

      {show3DViewer && (
        <ThreeDViewer 
          edges={floatEdges}
          onClose={() => setShow3DViewer(false)}
        />
      )}

      {showWallpaperViewer && (
        <WallpaperViewer 
          edges={floatEdges}
          isLoopClosed={isLoopClosed}
          onClose={() => setShowWallpaperViewer(false)}
        />
      )}
    </div>
  );
}

export default CombinatorialApp;
