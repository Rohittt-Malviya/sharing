export default function LoadingSpinner({ size = 'md', label = 'Loading…' }) {
  const sizes = {
    sm: 'w-5 h-5 border-2',
    md: 'w-10 h-10 border-[3px]',
    lg: 'w-16 h-16 border-4',
  }

  return (
    <div className="flex flex-col items-center gap-3" aria-live="polite">
      <div
        className={`${sizes[size]} rounded-full border-white/20 border-t-sky-400 animate-spin`}
        role="status"
        aria-label={label}
      />
      {label && <p className="text-slate-400 text-sm">{label}</p>}
    </div>
  )
}
