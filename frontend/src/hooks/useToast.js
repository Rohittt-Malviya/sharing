import { useContext } from 'react'
import { ToastContext } from '../contexts/ToastContext'

/**
 * Consume the ToastContext. Must be called inside a <ToastProvider>.
 * @returns {{ toasts: import('../contexts/ToastContext').Toast[]; addToast: Function; removeToast: Function }}
 */
function useToastContext() {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    throw new Error('useToast must be used inside a <ToastProvider>')
  }
  return ctx
}

/**
 * Convenience hook that exposes only the `addToast` helper with typed shortcuts.
 *
 * @example
 * const toast = useToast()
 * toast.success('File transferred!')
 * toast.error('Connection failed.')
 */
export function useToast() {
  const { addToast } = useToastContext()

  return {
    /** Show a success toast. */
    success: (message, duration) => addToast('success', message, duration),
    /** Show an error toast. */
    error: (message, duration) => addToast('error', message, duration),
    /** Show an info toast. */
    info: (message, duration) => addToast('info', message, duration),
    /** Show a warning toast. */
    warning: (message, duration) => addToast('warning', message, duration),
    /** Low-level method: show a toast with an explicit type. */
    show: (type, message, duration) => addToast(type, message, duration),
  }
}
