import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu, X, Upload, Download } from 'lucide-react'

const NAV_LINKS = [
  { label: 'Send File',    icon: Upload,   path: '/send'  },
  { label: 'Receive File', icon: Download, path: '/join'  },
]

export default function Header() {
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  const handleNav = (path) => {
    setMenuOpen(false)
    navigate(path)
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-50 px-4 py-3 glass-header">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <button
            onClick={() => handleNav('/')}
            className="flex items-center gap-2.5 hover:opacity-90 transition-opacity focus:outline-none"
            aria-label="Go to home"
          >
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #00D9FF, #9D4EDD)', boxShadow: '0 0 12px rgba(0,217,255,0.4)' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <span className="font-bold text-white text-base tracking-tight">
              Share<span style={{ color: '#00D9FF' }}>Drop</span>
            </span>
          </button>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-2" aria-label="Main navigation">
            {NAV_LINKS.map(({ label, icon: Icon, path }) => (
              <button
                key={label}
                onClick={() => handleNav(path)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-slate-300 hover:text-white transition-all duration-200"
                style={{ background: 'transparent' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0,217,255,0.08)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
              >
                <Icon size={15} />
                {label}
              </button>
            ))}
          </nav>

          {/* Mobile hamburger */}
          <button
            className="md:hidden flex items-center justify-center w-9 h-9 rounded-xl text-slate-300 hover:text-white transition-colors focus:outline-none"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
          >
            {menuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22, ease: 'easeInOut' }}
            className="md:hidden overflow-hidden"
          >
            <nav
              className="max-w-6xl mx-auto px-0 pt-3 pb-2 flex flex-col gap-1"
              aria-label="Mobile navigation"
            >
              {NAV_LINKS.map(({ label, icon: Icon, path }) => (
                <button
                  key={label}
                  onClick={() => handleNav(path)}
                  className="flex items-center gap-2.5 w-full px-4 py-3 rounded-xl text-sm font-medium text-slate-300 hover:text-white text-left transition-all duration-200"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
                >
                  <Icon size={16} />
                  {label}
                </button>
              ))}
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}
