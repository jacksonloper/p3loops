import { useState, useCallback } from 'react'
import './App.css'
import BowedSquare from './components/BowedSquare.jsx'
import { validatePath, autospaceEdges, findValidRandomEdge, getNextEdgeStartPoints } from './utils/pathLogic.js'

function getMessageStyleClass(message) {
  const errorIndicators = ['Error', 'Invalid', 'Failed', 'Cannot']
  const isError = errorIndicators.some(indicator => message.includes(indicator))
  return isError ? 'error-message' : 'success-message'
}

function PathEditorApp() {
  const [pathEdges, setPathEdges] = useState([])
  const [activeStartPoint, setActiveStartPoint] = useState(null)
  const [jsonInputText, setJsonInputText] = useState('')
  const [validationMessage, setValidationMessage] = useState('')
  const [showJsonPanel, setShowJsonPanel] = useState(false)
  const [beadCount, setBeadCount] = useState(3)
  const [beadSpeed, setBeadSpeed] = useState(0.3)

  const appendEdgeToPath = useCallback((newEdge) => {
    setPathEdges(currentEdges => [...currentEdges, newEdge])
    setValidationMessage('')
  }, [])

  const removeLastEdge = useCallback(() => {
    setPathEdges(currentEdges => currentEdges.slice(0, -1))
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

  const handleEdgeError = useCallback((errorMessage) => {
    setValidationMessage(errorMessage)
  }, [])

  const handleAutospace = useCallback(() => {
    if (pathEdges.length === 0) return
    const newEdges = autospaceEdges(pathEdges)
    setPathEdges(newEdges)
    setActiveStartPoint(null)
    setValidationMessage('Points redistributed evenly!')
  }, [pathEdges])

  const handleAutoplace = useCallback(() => {
    if (pathEdges.length === 0) {
      setValidationMessage('Cannot autoplace: add at least one edge first')
      return
    }
    
    // Get the start point for the next edge (complementary of last endpoint)
    const startPoints = getNextEdgeStartPoints(pathEdges)
    if (!startPoints || startPoints.length === 0) {
      setValidationMessage('Cannot autoplace: no valid start point')
      return
    }
    
    const startPoint = startPoints[0]
    const newEdge = findValidRandomEdge(pathEdges, startPoint)
    
    if (newEdge) {
      setPathEdges(currentEdges => [...currentEdges, newEdge])
      setActiveStartPoint(null)
      setValidationMessage('Edge placed randomly!')
    } else {
      setValidationMessage('Cannot autoplace: no valid position found')
    }
  }, [pathEdges])

  const currentPathJson = JSON.stringify(pathEdges, null, 2)

  return (
    <div className="path-editor-container">
      <header className="app-header">
        <h1>P3 Loops Path Editor</h1>
        <p className="subtitle">Create non-crossing paths on a bowed square with edge identifications</p>
      </header>

      <main className="editor-main">
        <section className="visualization-section">
          <BowedSquare
            edges={pathEdges}
            onAddEdge={appendEdgeToPath}
            selectedStartPoint={activeStartPoint}
            onSelectStartPoint={setActiveStartPoint}
            onError={handleEdgeError}
            beadCount={beadCount}
            beadSpeed={beadSpeed}
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
          </div>

          <div className="button-row">
            <button 
              onClick={handleAutospace}
              disabled={pathEdges.length === 0}
              className="control-btn primary-btn"
            >
              Autospace
            </button>
            <button 
              onClick={handleAutoplace}
              disabled={pathEdges.length === 0}
              className="control-btn primary-btn"
            >
              Autoplace Next
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

          <div className="bead-settings">
            <h4>Direction Beads</h4>
            <div className="setting-row">
              <label htmlFor="bead-count">Number of beads:</label>
              <input
                id="bead-count"
                type="range"
                min="0"
                max="10"
                value={beadCount}
                onChange={(e) => setBeadCount(parseInt(e.target.value, 10))}
              />
              <span className="setting-value">{beadCount}</span>
            </div>
            <div className="setting-row">
              <label htmlFor="bead-speed">Speed:</label>
              <input
                id="bead-speed"
                type="range"
                min="0.05"
                max="2"
                step="0.05"
                value={beadSpeed}
                onChange={(e) => setBeadSpeed(parseFloat(e.target.value))}
              />
              <span className="setting-value">{beadSpeed.toFixed(2)}</span>
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
              <pre className="json-display">{currentPathJson}</pre>
            </div>
          </section>
        )}

        <section className="info-section">
          <h3>About Edge Identifications</h3>
          <ul>
            <li><strong>North ≡ East:</strong> A point at t% along North is the same as t% along East</li>
            <li><strong>South ≡ West:</strong> A point at t% along South is the same as t% along West</li>
          </ul>
          <h3>Rules</h3>
          <ul>
            <li>Edges must chain together (endpoint of one = startpoint of next)</li>
            <li>Edges cannot cross each other</li>
            <li>No loops allowed (cannot return to a point already in the path)</li>
          </ul>
        </section>
      </main>
    </div>
  )
}

export default PathEditorApp
