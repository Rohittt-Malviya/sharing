import { useNavigate } from 'react-router-dom'

export default function Header() {
  const navigate = useNavigate()

  return (
    <header className="fixed top-0 left-0 right-0 z-50 px-4 py-3">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl px-4 py-2 shadow-glass">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 hover:opacity-80 transition-opacity focus:outline-none"
            aria-label="Go to home"
          >
            <span className="text-xl">📡</span>
            <span className="font-bold text-white text-sm">ShareDrop</span>
          </button>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse-slow" />
            <span className="text-xs text-slate-400">Encrypted</span>
          </div>
        </div>
      </div>
    </header>
  )
}
