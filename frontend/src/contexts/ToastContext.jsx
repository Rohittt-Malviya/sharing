import { createContext, useCallback, useReducer } from 'react'

/**
 * @typedef {{ id: number; type: 'success'|'error'|'info'|'warning'; message: string; duration: number }} Toast
 */

/** @type {React.Context<{ toasts: Toast[]; addToast: (type: Toast['type'], message: string, duration?: number) => void; removeToast: (id: number) => void }>} */
// eslint-disable-next-line react-refresh/only-export-components
export const ToastContext = createContext(null)

let nextId = 1

function toastReducer(state, action) {
  switch (action.type) {
    case 'ADD':
      return [...state, action.toast]
    case 'REMOVE':
      return state.filter((t) => t.id !== action.id)
    default:
      return state
  }
}

/**
 * Provides toast notification state and helpers to the component tree.
 * Wrap your app root with this provider.
 */
export function ToastProvider({ children }) {
  const [toasts, dispatch] = useReducer(toastReducer, [])

  const addToast = useCallback((type, message, duration = 4000) => {
    const id = nextId++
    dispatch({ type: 'ADD', toast: { id, type, message, duration } })

    if (duration > 0) {
      setTimeout(() => dispatch({ type: 'REMOVE', id }), duration)
    }
  }, [])

  const removeToast = useCallback((id) => {
    dispatch({ type: 'REMOVE', id })
  }, [])

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
    </ToastContext.Provider>
  )
}
