// src/components/Fab.jsx
// Portaled to document.body so iOS cannot clip position:fixed inside overflow main.
import { createPortal } from 'react-dom'

export default function Fab({ onClick, label = 'Add', children }) {
  if (typeof document === 'undefined') return null

  return createPortal(
    <button
      type="button"
      onClick={onClick}
      className="fab-add bg-navy-800 text-white rounded-full shadow-lg
                 flex items-center justify-center hover:bg-navy-700
                 active:scale-95 transition-all md:hidden"
      aria-label={label}
    >
      {children}
    </button>,
    document.body,
  )
}
