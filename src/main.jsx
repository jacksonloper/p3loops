import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './components/CombinatorialApp.jsx'
import P2App from './components/P2App.jsx'

function Root() {
  const path = window.location.pathname;
  if (path === '/p2') {
    return <P2App />;
  }
  return <App />;
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
