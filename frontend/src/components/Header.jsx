import { useNavigate } from 'react-router-dom'

export default function Header() {
  const navigate = useNavigate()

  return (
    <header className="fixed top-0 left-0 right-0 z-50 px-4 py-3 glass-header">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2.5 hover:opacity-90 transition-opacity focus:outline-none"
            aria-label="Go to home"
          >
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #00D9FF, #9D4EDD)', boxShadow: '0 0 12px rgba(0,217,255,0.4)' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <span className="font-bold text-white text-base tracking-tight">
              Share<span style={{ color: '#00D9FF' }}>Drop</span>
            </span>
          </button>

          {/* Nav Links */}
          <nav className="hidden md:flex items-center gap-6">
            {['Features', 'Security', 'Pricing'].map((item) => (
              <button
                key={item}
                className="text-slate-400 hover:text-white text-sm font-medium transition-colors duration-200"
                onClick={() => {}}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') e.currentTarget.click() }}
                type="button"
              >
                {item}
              </button>
            ))}
          </nav>

          {/* Auth Buttons */}
          <div className="flex items-center gap-2">
            <button className="btn-outline-neon text-sm py-2 px-4 hidden sm:flex">
              Log in
            </button>
            <button className="btn-neon text-sm py-2 px-4">
              Sign Up
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}
