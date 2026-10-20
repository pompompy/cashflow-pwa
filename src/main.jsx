import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'
import { installViewportLock, syncViewportVars } from './utils/viewport'

// iOS Add-to-Home-Screen sets navigator.standalone; Android/desktop use display-mode.
const isStandalone =
  (typeof navigator !== 'undefined' && navigator.standalone === true) ||
  (typeof window !== 'undefined' &&
    window.matchMedia?.('(display-mode: standalone)').matches)

if (isStandalone) {
  document.documentElement.classList.add('is-standalone')
}

// Apply before first React paint so --app-height is ready for the shell.
syncViewportVars()
installViewportLock()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter basename="/cashflow-pwa">
      <App />
    </BrowserRouter>
  </React.StrictMode>
)
