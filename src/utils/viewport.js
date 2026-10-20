/**
 * iOS Home Screen PWAs often launch with a mismatched layout vs visual
 * viewport: fixed bottom chrome sits above a phantom gap until the user
 * interacts (e.g. swipes the tab bar). Lock CSS vars to visualViewport and
 * re-sync until iOS settles.
 */

function readViewport() {
  const vv = window.visualViewport
  if (!vv) {
    return {
      height: window.innerHeight,
      top: 0,
      bottom: 0,
    }
  }
  // Gap between the visible bottom and the layout viewport bottom.
  const bottom = Math.max(0, window.innerHeight - vv.offsetTop - vv.height)
  return {
    height: vv.height,
    top: vv.offsetTop,
    bottom,
  }
}

export function syncViewportVars() {
  const { height, top, bottom } = readViewport()
  const root = document.documentElement
  root.style.setProperty('--app-height', `${height}px`)
  root.style.setProperty('--vv-top', `${top}px`)
  root.style.setProperty('--vv-bottom', `${bottom}px`)
}

export function installViewportLock() {
  const sync = () => syncViewportVars()

  sync()

  // Double-rAF: first paint on iOS standalone is often still wrong.
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
  vv?.addEventListener('scroll', sync)

  // Keep poking until the webview finishes settling after launch.
  const timers = [50, 100, 200, 400, 800, 1600].map((ms) => setTimeout(sync, ms))

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
