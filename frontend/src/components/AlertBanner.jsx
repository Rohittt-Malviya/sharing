export default function AlertBanner({ type = 'error', message, onDismiss }) {
  if (!message) return null

  const variants = {
    error: {
      wrapper: 'bg-red-500/10 border-red-500/40 text-red-300',
      icon: '⚠️',
    },
    success: {
      wrapper: 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300',
      icon: '✅',
    },
    info: {
      wrapper: 'bg-sky-500/10 border-sky-500/40 text-sky-300',
      icon: 'ℹ️',
    },
    warning: {
      wrapper: 'bg-amber-500/10 border-amber-500/40 text-amber-300',
      icon: '⚡',
    },
  }

  const { wrapper, icon } = variants[type] ?? variants.error

  return (
    <div
      className={`flex items-start gap-3 border rounded-xl p-3 text-sm animate-slide-up ${wrapper}`}
      role="alert"
    >
      <span className="text-base shrink-0 mt-0.5">{icon}</span>
      <p className="flex-1">{message}</p>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="shrink-0 opacity-60 hover:opacity-100 transition-opacity text-lg leading-none"
          aria-label="Dismiss"
        >
          ×
        </button>
      )}
    </div>
  )
}
