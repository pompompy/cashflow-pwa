// src/components/Fab.jsx
// Mounts into #fab-root, which Layout places just above the in-flow tab bar.
import { createPortal } from 'react-dom'
import { useEffect, useState } from 'react'

export default function Fab({ onClick, label = 'Add', children }) {
  const [mount, setMount] = useState(null)

  useEffect(() => {
    setMount(document.getElementById('fab-root'))
  }, [])

  if (!mount) return null

  return createPortal(
    <button
      type="button"
      onClick={onClick}
      className="fab-add bg-navy-800 text-white rounded-full shadow-lg
                 flex items-center justify-center hover:bg-navy-700
                 active:scale-95 transition-all pointer-events-auto"
      aria-label={label}
    >
      {children}
    </button>,
    mount,
  )
}
