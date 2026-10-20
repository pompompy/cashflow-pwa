/**
 * iOS Home Screen (navigator.standalone): force --app-height to 100vh.
 * 100dvh is short by the bottom safe-area on installed PWAs and leaves a
 * permanent white band under an in-flow tab bar (swipe cannot fix it).
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
    root.style.setProperty('--app-height', '100vh')
  } else {
    root.classList.remove('is-standalone')
    root.style.removeProperty('--app-height')
  }
}

export function installViewportLock() {
  syncViewportVars()
  const mq = window.matchMedia?.('(display-mode: standalone)')
  const onChange = () => syncViewportVars()
  mq?.addEventListener?.('change', onChange)
  window.addEventListener('pageshow', onChange)
  return () => {
    mq?.removeEventListener?.('change', onChange)
    window.removeEventListener('pageshow', onChange)
  }
}
