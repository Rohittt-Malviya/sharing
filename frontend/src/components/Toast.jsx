import { useEffect, useRef, useContext } from 'react'
import { ToastContext } from '../contexts/ToastContext'

const VARIANTS = {
  success: {
    bar: 'bg-emerald-500',
    icon: '✅',
    border: 'border-emerald-500/30',
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-300',
  },
  error: {
    bar: 'bg-red-500',
    icon: '⚠️',
    border: 'border-red-500/30',
    bg: 'bg-red-500/10',
    text: 'text-red-300',
  },
  info: {
    bar: 'bg-sky-500',
    icon: 'ℹ️',
    border: 'border-sky-500/30',
    bg: 'bg-sky-500/10',
    text: 'text-sky-300',
  },
  warning: {
    bar: 'bg-amber-500',
    icon: '⚡',
    border: 'border-amber-500/30',
    bg: 'bg-amber-500/10',
    text: 'text-amber-300',
  },
}

/**
 * A single toast notification item with an animated progress bar.
 */
function ToastItem({ toast, onDismiss }) {
  const variant = VARIANTS[toast.type] ?? VARIANTS.info
  const barRef = useRef(null)

  useEffect(() => {
    if (toast.duration <= 0 || !barRef.current) return
    // Animate the progress bar from 100% → 0% over the toast duration
    barRef.current.style.transition = `width ${toast.duration}ms linear`
    requestAnimationFrame(() => {
      if (barRef.current) barRef.current.style.width = '0%'
    })
  }, [toast.duration])

  return (
    <div
      className={`
        relative flex items-start gap-3 rounded-xl border p-3 pr-10 text-sm shadow-lg
        backdrop-blur-sm overflow-hidden animate-slide-up
        ${variant.bg} ${variant.border}
      `}
      role="alert"
      aria-live="polite"
    >
      <span className="shrink-0 mt-0.5 text-base">{variant.icon}</span>
      <p className={`flex-1 leading-snug ${variant.text}`}>{toast.message}</p>
      <button
        onClick={() => onDismiss(toast.id)}
        className="absolute top-2.5 right-2.5 opacity-50 hover:opacity-100 transition-opacity text-white text-lg leading-none"
        aria-label="Dismiss notification"
      >
        ×
      </button>
      {/* Progress bar */}
      {toast.duration > 0 && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/10">
          <div
            ref={barRef}
            className={`h-full ${variant.bar}`}
            style={{ width: '100%' }}
          />
        </div>
      )}
    </div>
  )
}

/**
 * Renders all active toasts in a fixed bottom-right stack.
 * Mount this once at the app root level (alongside <ToastProvider>).
 */
export default function Toast() {
  const ctx = useContext(ToastContext)
  const toasts = ctx?.toasts ?? []
  const removeToast = ctx?.removeToast ?? (() => {})

  if (toasts.length === 0) return null

  return (
    <div
      className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 w-80 max-w-[calc(100vw-2rem)]"
      aria-label="Notifications"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={removeToast} />
      ))}
    </div>
  )
}
