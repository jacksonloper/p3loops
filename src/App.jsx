import { useState, useCallback, useEffect } from 'react'
import './App.css'
import Rhombus from './components/Rhombus.jsx'
import ThreeDViewer from './components/ThreeDViewer.jsx'
import WallpaperViewer from './components/WallpaperViewer.jsx'
import { validatePath } from './utils/pathLogic.js'

// Example path from public/exampleedge.json - pre-loaded so users see something interesting
const EXAMPLE_PATH = [
  { from: { side: 'north', t: 0.368 }, to: { side: 'west', t: 0.473 } },
  { from: { side: 'south', t: 0.473 }, to: { side: 'north', t: 0.67 } },
  { from: { side: 'east', t: 0.67 }, to: { side: 'south', t: 0.313 } },
  { from: { side: 'west', t: 0.313 }, to: { side: 'north', t: 0.185 } },
  { from: { side: 'east', t: 0.185 }, to: { side: 'east', t: 0.603 } },
  { from: { side: 'north', t: 0.603 }, to: { side: 'south', t: 0.861 } },
  { from: { side: 'west', t: 0.861 }, to: { side: 'north', t: 0.487 } },
  { from: { side: 'east', t: 0.487 }, to: { side: 'east', t: 0.273 } },
  { from: { side: 'north', t: 0.273 }, to: { side: 'west', t: 0.397 } },
  { from: { side: 'south', t: 0.397 }, to: { side: 'north', t: 0.804 } },
  { from: { side: 'east', t: 0.804 }, to: { side: 'south', t: 0.36 } },
  { from: { side: 'west', t: 0.36 }, to: { side: 'north', t: 0.216 } },
  { from: { side: 'east', t: 0.216 }, to: { side: 'east', t: 0.548 } }
];

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

function PathEditorApp() {
  const [pathEdges, setPathEdges] = useState(EXAMPLE_PATH)
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

  // Fetch examples manifest on mount
  useEffect(() => {
    fetch('/examples/manifest.json')
      .then(res => res.json())
      .then(setExamplesList)
      .catch(err => {
        console.warn('Failed to load examples manifest:', err)
        setExamplesList([])
      })
  }, [])

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
      setActiveStartPoint(null)
      setValidationMessage(`Loaded example: ${example.name}`)
    } catch (err) {
      const errorMsg = err instanceof SyntaxError 
        ? 'Invalid example format' 
        : 'Network error loading example'
      setValidationMessage(errorMsg)
    } finally {
      setLoadingExample(false)
    }
  }, [examplesList])

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
    setPathEdges(current => current.slice(0, -1))
    setActiveStartPoint(null)
    setValidationMessage('')
  }, [])

  const clearEntirePath = useCallback(() => {
    setPathEdges([])
    setActiveStartPoint(null)
    setValidationMessage('')
  }, [])

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
      setActiveStartPoint(null)
      setValidationMessage('Path imported successfully!')
      setJsonInputText('')
    } catch (parseError) {
      setValidationMessage(`JSON parse error: ${parseError.message}`)
    }
  }, [jsonInputText])

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
          />
        </section>

        <section className="controls-section">
          <div className="button-row">
            <button 
              onClick={removeLastEdge} 
              disabled={pathEdges.length === 0}
              className="control-btn danger-btn"
            >
              Remove Last Edge
            </button>
            <button 
              onClick={clearEntirePath}
              disabled={pathEdges.length === 0}
              className="control-btn warning-btn"
            >
              Clear All
            </button>
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
              <label htmlFor="interior-mode">Interior points:</label>
              <input
                id="interior-mode"
                type="checkbox"
                checked={interiorMode}
                onChange={(e) => setInteriorMode(e.target.checked)}
              />
              <span className="setting-value">{interiorMode ? 'Enabled' : 'Disabled'}</span>
            </div>
          </div>
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
          onClose={() => setShowWallpaperViewer(false)}
        />
      )}
    </div>
  )
}

export default PathEditorApp
