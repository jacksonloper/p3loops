import { useState, useCallback } from 'react'
import './App.css'
import BowedSquare from './components/BowedSquare.jsx'
import { validatePath } from './utils/pathLogic.js'

function getMessageStyleClass(message) {
  const errorIndicators = ['Error', 'Invalid', 'Failed']
  const isError = errorIndicators.some(indicator => message.includes(indicator))
  return isError ? 'error-message' : 'success-message'
}

function PathEditorApp() {
  const [pathEdges, setPathEdges] = useState([])
  const [activeStartPoint, setActiveStartPoint] = useState(null)
  const [jsonInputText, setJsonInputText] = useState('')
  const [validationMessage, setValidationMessage] = useState('')
  const [showJsonPanel, setShowJsonPanel] = useState(false)

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
            onDeleteLastEdge={removeLastEdge}
            selectedStartPoint={activeStartPoint}
            onSelectStartPoint={setActiveStartPoint}
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

          {validationMessage && (
            <div className={`message-box ${getMessageStyleClass(validationMessage)}`}>
              {validationMessage}
            </div>
          )}

          <div className="path-info">
            <span className="edge-counter">Edges in path: {pathEdges.length}</span>
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
