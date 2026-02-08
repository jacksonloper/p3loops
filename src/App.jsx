import { useState, useCallback, useEffect } from 'react'
import './App.css'
import Rhombus from './components/Rhombus.jsx'
import ThreeDViewer from './components/ThreeDViewer.jsx'
import WallpaperViewer from './components/WallpaperViewer.jsx'
import TopologicalPathSelector from './components/TopologicalPathSelector.jsx'
import { validatePath, getNextEdgeStartPoints, canCloseLoop } from './utils/pathLogic.js'

/**
 * Determine message style class based on content.
 */
function getMessageStyleClass(message) {
  const errorIndicators = ['Error', 'Invalid', 'Failed', 'Cannot', 'forbidden', 'cross', 'loop']
  const isError = errorIndicators.some(indicator => 
    message.toLowerCase().includes(indicator.toLowerCase())
  )
  return isError ? 'error-message' : 'success-message'
}

// Path entry mode constants
const PATH_ENTRY_MODES = {
  CLICK: 'click',
  TOPOLOGICAL: 'topological'
}

function PathEditorApp() {
  const [pathEdges, setPathEdges] = useState([])
  const [activeStartPoint, setActiveStartPoint] = useState(null)
  const [jsonInputText, setJsonInputText] = useState('')
  const [validationMessage, setValidationMessage] = useState('')
  const [showJsonPanel, setShowJsonPanel] = useState(false)
  const [show3DViewer, setShow3DViewer] = useState(false)
  const [showWallpaperViewer, setShowWallpaperViewer] = useState(false)
  const [interiorMode, setInteriorMode] = useState(true)
  const [highlightedEdgeIndex, setHighlightedEdgeIndex] = useState(null)
  const [examplesList, setExamplesList] = useState([])
  const [loadingExample, setLoadingExample] = useState(false)
  const [selectedExample, setSelectedExample] = useState('')
  const [isLoopClosed, setIsLoopClosed] = useState(false)
  const [pathEntryMode, setPathEntryMode] = useState(PATH_ENTRY_MODES.CLICK)

  // Helper to auto-select the next start point based on edges
  const autoSelectStartPoint = useCallback((edges) => {
    if (edges.length === 0) {
      setActiveStartPoint(null)
      return
    }
    const startPoints = getNextEdgeStartPoints(edges)
    if (startPoints && startPoints.length > 0) {
      setActiveStartPoint(startPoints[0])
    } else {
      setActiveStartPoint(null)
    }
  }, [])

  // Load simple loop example and manifest on mount
  useEffect(() => {
    // Load the simple loop example as initial path
    fetch('/examples/exampleedge.json')
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch example')
        return res.json()
      })
      .then(data => {
        setPathEdges(data)
        setSelectedExample('simple')
        // Auto-select start point for the loaded example
        autoSelectStartPoint(data)
      })
      .catch(err => {
        console.warn('Failed to load initial example:', err)
        setValidationMessage('Failed to load initial example')
      })

    // Load examples manifest
    fetch('/examples/manifest.json')
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch manifest')
        return res.json()
      })
      .then(setExamplesList)
      .catch(err => {
        console.warn('Failed to load examples manifest:', err)
        setExamplesList([])
      })
  }, [autoSelectStartPoint])

  const loadExample = useCallback(async (exampleId) => {
    if (!exampleId) return
    
    const example = examplesList.find(e => e.id === exampleId)
    if (!example) return
    
    setLoadingExample(true)
    try {
      const res = await fetch(`/examples/${example.filename}`)
      const data = await res.json()
      
      const validationResult = validatePath(data)
      if (!validationResult.valid) {
        setValidationMessage(`Invalid example: ${validationResult.error}`)
        return
      }
      
      setPathEdges(data)
      setIsLoopClosed(false)
      // Auto-select start point for the loaded example
      autoSelectStartPoint(data)
      setValidationMessage(`Loaded example: ${example.name}`)
    } catch (err) {
      const errorMsg = err instanceof SyntaxError 
        ? 'Invalid example format' 
        : 'Network error loading example'
      setValidationMessage(errorMsg)
    } finally {
      setLoadingExample(false)
    }
  }, [examplesList, autoSelectStartPoint])

  // Clear highlighted edge after timeout
  useEffect(() => {
    if (highlightedEdgeIndex !== null) {
      const timeout = setTimeout(() => setHighlightedEdgeIndex(null), 2000)
      return () => clearTimeout(timeout)
    }
  }, [highlightedEdgeIndex])

  const appendEdgeToPath = useCallback((newEdge) => {
    setPathEdges(current => [...current, newEdge])
    setValidationMessage('')
  }, [])

  const removeLastEdge = useCallback(() => {
    // If loop is closed, removing last edge opens the loop
    if (isLoopClosed) {
      setIsLoopClosed(false)
      setPathEdges(current => {
        const newEdges = current.slice(0, -1)
        // Auto-select start point for the remaining edges
        autoSelectStartPoint(newEdges)
        return newEdges
      })
      setValidationMessage('Loop opened')
      return
    }
    
    setPathEdges(current => {
      const newEdges = current.slice(0, -1)
      // Auto-select start point for the remaining edges
      autoSelectStartPoint(newEdges)
      return newEdges
    })
    setValidationMessage('')
  }, [autoSelectStartPoint, isLoopClosed])

  const clearEntirePath = useCallback(() => {
    setPathEdges([])
    setActiveStartPoint(null)
    setIsLoopClosed(false)
    setValidationMessage('')
  }, [])

  const closeLoop = useCallback(() => {
    const result = canCloseLoop(pathEdges)
    if (!result.canClose) {
      setValidationMessage(result.error)
      if (result.crossingEdgeIndex !== undefined) {
        setHighlightedEdgeIndex(result.crossingEdgeIndex)
      }
      return
    }
    
    // Add the closing edge and mark loop as closed
    setPathEdges(current => [...current, result.closingEdge])
    setIsLoopClosed(true)
    setActiveStartPoint(null)
    setValidationMessage('Loop closed!')
  }, [pathEdges])

  const handleJsonImport = useCallback(() => {
    try {
      const parsedData = JSON.parse(jsonInputText)
      
      if (!Array.isArray(parsedData)) {
        setValidationMessage('Error: Input must be a JSON array of edges')
        return
      }

      const validationResult = validatePath(parsedData)
      if (!validationResult.valid) {
        setValidationMessage(`Invalid path: ${validationResult.error}`)
        return
      }

      setPathEdges(parsedData)
      setIsLoopClosed(false)
      // Auto-select start point for the imported data
      autoSelectStartPoint(parsedData)
      setValidationMessage('Path imported successfully!')
      setJsonInputText('')
    } catch (parseError) {
      setValidationMessage(`JSON parse error: ${parseError.message}`)
    }
  }, [jsonInputText, autoSelectStartPoint])

  const copyPathToClipboard = useCallback(() => {
    const jsonOutput = JSON.stringify(pathEdges, null, 2)
    navigator.clipboard.writeText(jsonOutput).then(() => {
      setValidationMessage('Path JSON copied to clipboard!')
    }).catch(() => {
      setValidationMessage('Failed to copy to clipboard')
    })
  }, [pathEdges])

  const handleEdgeError = useCallback((errorMessage, crossingEdgeIndex = null) => {
    setValidationMessage(errorMessage)
    if (crossingEdgeIndex !== null) {
      setHighlightedEdgeIndex(crossingEdgeIndex)
    }
  }, [])

  // Handler for topological mode adding edges
  const handleTopologicalAddEdges = useCallback((newEdges, startPoint = null) => {
    if (startPoint && newEdges.length === 0) {
      // Just setting the starting point
      setActiveStartPoint(startPoint)
      setValidationMessage('Starting point selected')
      return
    }
    
    if (newEdges.length > 0) {
      setPathEdges(current => {
        const updated = [...current, ...newEdges]
        autoSelectStartPoint(updated)
        return updated
      })
      setValidationMessage(`Added ${newEdges.length} edge${newEdges.length > 1 ? 's' : ''}`)
    }
  }, [autoSelectStartPoint])

  return (
    <div className="path-editor-container">
      <header className="app-header">
        <h1>P3 Loops Path Editor</h1>
        <p className="subtitle">Create non-crossing paths on a 120/60/120/60 rhombus with edge identifications</p>
      </header>

      <main className="editor-main">
        <section className="visualization-section">
          <Rhombus
            edges={pathEdges}
            onAddEdge={appendEdgeToPath}
            selectedStartPoint={activeStartPoint}
            onSelectStartPoint={setActiveStartPoint}
            onError={handleEdgeError}
            interiorMode={interiorMode}
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
              <>
                <button 
                  onClick={closeLoop}
                  disabled={pathEdges.length < 2}
                  className="control-btn primary-btn"
                >
                  Close Loop
                </button>
                <button 
                  onClick={clearEntirePath}
                  disabled={pathEdges.length === 0}
                  className="control-btn warning-btn"
                >
                  Clear All
                </button>
              </>
            )}
            <button 
              onClick={copyPathToClipboard}
              disabled={pathEdges.length === 0}
              className="control-btn primary-btn"
            >
              Copy JSON
            </button>
            <button 
              onClick={() => setShowJsonPanel(!showJsonPanel)}
              className="control-btn secondary-btn"
            >
              {showJsonPanel ? 'Hide JSON Panel' : 'Show JSON Panel'}
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

          {examplesList.length > 0 && (
            <div className="example-selector">
              <label htmlFor="example-select">Load Example:</label>
              <select
                id="example-select"
                value={selectedExample}
                onChange={(e) => {
                  setSelectedExample(e.target.value)
                  loadExample(e.target.value)
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
            <span className="edge-counter">Edges in path: {pathEdges.length}</span>
          </div>

          <div className="settings-panel">
            <div className="setting-row">
              <label htmlFor="path-entry-mode">Entry mode:</label>
              <select
                id="path-entry-mode"
                value={pathEntryMode}
                onChange={(e) => setPathEntryMode(e.target.value)}
                className="mode-selector"
              >
                <option value={PATH_ENTRY_MODES.CLICK}>Click to place</option>
                <option value={PATH_ENTRY_MODES.TOPOLOGICAL}>Topological (discrete)</option>
              </select>
            </div>
            {pathEntryMode === PATH_ENTRY_MODES.CLICK && (
              <div className="setting-row">
                <label htmlFor="interior-mode">Interior points:</label>
                <input
                  id="interior-mode"
                  type="checkbox"
                  checked={interiorMode}
                  onChange={(e) => setInteriorMode(e.target.checked)}
                />
                <span className="setting-value">{interiorMode ? 'Enabled' : 'Disabled'}</span>
              </div>
            )}
          </div>

          {pathEntryMode === PATH_ENTRY_MODES.TOPOLOGICAL && (
            <TopologicalPathSelector
              edges={pathEdges}
              activeStartPoint={activeStartPoint}
              onAddEdges={handleTopologicalAddEdges}
              onError={handleEdgeError}
              disabled={isLoopClosed}
            />
          )}
        </section>

        {showJsonPanel && (
          <section className="json-section">
            <div className="json-input-area">
              <h3>Import Path from JSON</h3>
              <textarea
                value={jsonInputText}
                onChange={(e) => setJsonInputText(e.target.value)}
                placeholder='[{"from": {"side": "north", "t": 0.25}, "to": {"side": "south", "t": 0.75}}]'
                rows={6}
              />
              <button onClick={handleJsonImport} className="control-btn primary-btn">
                Import Path
              </button>
            </div>

            <div className="json-output-area">
              <h3>Current Path JSON</h3>
              <pre className="json-display">{JSON.stringify(pathEdges, null, 2)}</pre>
            </div>
          </section>
        )}

        <section className="info-section">
          <h3>About the Rhombus</h3>
          <ul>
            <li><strong>Shape:</strong> 120/60/120/60 degree rhombus (NE/SW corners are 120°, NW/SE corners are 60°)</li>
            <li><strong>North ≡ East:</strong> A point at t% along North is the same as t% along East</li>
            <li><strong>South ≡ West:</strong> A point at t% along South is the same as t% along West</li>
          </ul>
          <h3>Rules</h3>
          <ul>
            <li>Edges must chain together (endpoint of one = startpoint of next)</li>
            <li>Edges cannot cross each other</li>
            <li><strong>Same-side edges are forbidden</strong> (e.g., north to north, but north to east is allowed)</li>
            <li>Interior points are allowed when enabled</li>
            <li>No loops allowed (cannot return to a point already in the path)</li>
          </ul>
        </section>
      </main>

      {show3DViewer && (
        <ThreeDViewer 
          edges={pathEdges}
          onClose={() => setShow3DViewer(false)}
        />
      )}

      {showWallpaperViewer && (
        <WallpaperViewer 
          edges={pathEdges}
          isLoopClosed={isLoopClosed}
          onClose={() => setShowWallpaperViewer(false)}
        />
      )}
    </div>
  )
}

export default PathEditorApp
