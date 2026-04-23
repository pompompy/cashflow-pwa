// src/context/ThemeContext.jsx
// Manages the light/dark theme preference, persists it to IndexedDB,
// and applies/removes the 'dark' class on <html>.

import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { getSetting, setSetting } from '../db/index'

const ThemeContext = createContext({ theme: 'light', toggleTheme: () => {} })

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState('light')

  // On mount: read persisted preference
  useEffect(() => {
    getSetting('theme', 'light').then(saved => {
      const t = saved === 'dark' ? 'dark' : 'light'
      applyTheme(t)
      setThemeState(t)
    })
  }, [])

  const toggleTheme = useCallback(async () => {
    setThemeState(prev => {
      const next = prev === 'dark' ? 'light' : 'dark'
      applyTheme(next)
      setSetting('theme', next)   // async, fire-and-forget is fine
      return next
    })
  }, [])

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}

function applyTheme(theme) {
  if (theme === 'dark') {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }
}
