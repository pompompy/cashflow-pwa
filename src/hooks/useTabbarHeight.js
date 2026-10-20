import { useLayoutEffect } from 'react'

/** Publish the real rendered tab-bar height (incl. safe-area) as --tabbar-total. */
export function useTabbarHeight(ref) {
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return undefined

    const publish = () => {
      const height = el.getBoundingClientRect().height
      if (height > 0) {
        document.documentElement.style.setProperty('--tabbar-total', `${height}px`)
      }
    }

    publish()
    const ro = new ResizeObserver(publish)
    ro.observe(el)
    window.addEventListener('resize', publish)
    window.visualViewport?.addEventListener('resize', publish)

    return () => {
      ro.disconnect()
      window.removeEventListener('resize', publish)
      window.visualViewport?.removeEventListener('resize', publish)
    }
  }, [ref])
}
