/**
 * Standalone Home Screen sizing is handled in CSS (html.is-standalone body
 * { position:fixed; inset:0 }). We intentionally do NOT set --app-height from
 * innerHeight / visualViewport — those are wrong on first paint on iOS and
 * recreate the phantom bottom gap.
 *
 * This module only marks standalone and keeps --vv-* at zero.
 */

function isStandalone() {
  return (
    (typeof navigator !== 'undefined' && navigator.standalone === true) ||
    (typeof window !== 'undefined' &&
      window.matchMedia?.('(display-mode: standalone)').matches)
  )
}

export function syncViewportVars() {
  const root = document.documentElement
  if (isStandalone()) {
    root.classList.add('is-standalone')
  }
  root.style.setProperty('--vv-top', '0px')
  root.style.setProperty('--vv-bottom', '0px')
  // Clear any leftover height lock from older builds / cached SW.
  root.style.removeProperty('--app-height')
}

export function installViewportLock() {
  syncViewportVars()
  window.addEventListener('pageshow', syncViewportVars)
  return () => window.removeEventListener('pageshow', syncViewportVars)
}
