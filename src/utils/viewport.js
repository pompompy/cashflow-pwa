/**
 * Lock --app-height for the app shell.
 *
 * Important: in iOS Home Screen (standalone), do NOT offset chrome by the
 * visualViewport “bottom gap”. That gap is the bug — encoding it as
 * --vv-bottom parks the tab bar above empty space until a swipe relayouts.
 */

function isStandalone() {
  return (
    (typeof navigator !== 'undefined' && navigator.standalone === true) ||
    (typeof window !== 'undefined' &&
      window.matchMedia?.('(display-mode: standalone)').matches)
  )
}

function readViewport() {
  const vv = window.visualViewport

  if (isStandalone()) {
    // Use the largest reported height; always pin chrome to the true bottom.
    const height = Math.max(
      window.innerHeight || 0,
      vv?.height || 0,
      document.documentElement?.clientHeight || 0,
    )
    return { height, top: 0, bottom: 0 }
  }

  if (!vv) {
    return { height: window.innerHeight, top: 0, bottom: 0 }
  }

  return {
    height: vv.height,
    top: vv.offsetTop,
    bottom: Math.max(0, window.innerHeight - vv.offsetTop - vv.height),
  }
}

export function syncViewportVars() {
  const { height, top, bottom } = readViewport()
  const root = document.documentElement
  root.style.setProperty('--app-height', `${Math.round(height)}px`)
  root.style.setProperty('--vv-top', `${top}px`)
  root.style.setProperty('--vv-bottom', `${bottom}px`)
}

export function installViewportLock() {
  const sync = () => syncViewportVars()

  sync()
  requestAnimationFrame(() => {
    sync()
    requestAnimationFrame(sync)
  })

  window.addEventListener('resize', sync)
  window.addEventListener('orientationchange', sync)
  window.addEventListener('pageshow', sync)
  window.addEventListener('focus', sync)

  const vv = window.visualViewport
  vv?.addEventListener('resize', sync)
  // Ignore visualViewport scroll in standalone — it recreates the phantom gap.
  if (!isStandalone()) {
    vv?.addEventListener('scroll', sync)
  }

  const timers = [50, 100, 200, 500, 1000].map((ms) => setTimeout(sync, ms))

  return () => {
    window.removeEventListener('resize', sync)
    window.removeEventListener('orientationchange', sync)
    window.removeEventListener('pageshow', sync)
    window.removeEventListener('focus', sync)
    vv?.removeEventListener('resize', sync)
    vv?.removeEventListener('scroll', sync)
    timers.forEach(clearTimeout)
  }
}
