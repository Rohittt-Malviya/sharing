import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import AlertBanner from '../components/AlertBanner'

export default function Home() {
  const navigate = useNavigate()
  const [joinCode, setJoinCode] = useState('')
  const [dragActive, setDragActive] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef(null)

  const handleFileSelect = (file) => {
    if (!file) return
    const MAX = 500 * 1024 * 1024 // 500 MB
    if (file.size > MAX) {
      setError('File size exceeds 500 MB limit.')
      return
    }
    setError('')
    navigate('/send', { state: { file } })
  }

  const onFileInputChange = (e) => handleFileSelect(e.target.files[0])

  const onDrop = (e) => {
    e.preventDefault()
    setDragActive(false)
    handleFileSelect(e.dataTransfer.files[0])
  }

  const onDragOver = (e) => { e.preventDefault(); setDragActive(true) }
  const onDragLeave = () => setDragActive(false)

  const handleJoin = (e) => {
    e.preventDefault()
    const code = joinCode.trim().toUpperCase()
    if (!code) { setError('Enter a room code or paste a link.'); return }
    if (code.startsWith('HTTP')) {
      try {
        const url = new URL(joinCode.trim())
        const parts = url.pathname.split('/')
        const roomId = parts[parts.length - 1]
        navigate(`/join/${roomId}`)
        return
      } catch {
        setError('Invalid URL format.')
        return
      }
    }
    navigate(`/join/${code}`)
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 gap-8 animate-fade-in">
      {/* Hero */}
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-sky-500/30 to-violet-600/30 border border-white/20 shadow-glow-brand mb-5 animate-bounce-gentle">
          <span className="text-4xl">📡</span>
        </div>
        <h1 className="text-5xl font-bold text-white mb-3 text-glow">ShareDrop</h1>
        <p className="text-slate-400 text-lg max-w-sm mx-auto leading-relaxed">
          Instant, secure peer-to-peer file sharing — no sign-up, no storage.
        </p>
        <div className="flex items-center justify-center gap-4 mt-4 flex-wrap">
          <span className="badge-sky">🔒 End-to-End Encrypted</span>
          <span className="badge-emerald">⚡ WebRTC Direct</span>
          <span className="badge-amber">🌐 No Upload Limit*</span>
        </div>
      </div>

      <div className="w-full max-w-md flex flex-col gap-5">
        {/* Send File Card */}
        <div className="card animate-slide-up">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-7 h-7 rounded-lg bg-sky-500/20 border border-sky-500/30 flex items-center justify-center text-sm">📤</span>
            <h2 className="text-base font-semibold text-sky-300">Send a File</h2>
          </div>

          <div
            className={`drop-zone ${dragActive ? 'drop-zone-active' : ''}`}
            onClick={() => fileInputRef.current?.click()}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            role="button"
            tabIndex={0}
            aria-label="Drop a file here or click to browse"
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && fileInputRef.current?.click()}
          >
            <div className="text-4xl mb-3 transition-transform duration-200">
              {dragActive ? '🎯' : '📁'}
            </div>
            <p className="text-white font-medium">
              {dragActive ? 'Release to select' : 'Drop a file here'}
            </p>
            <p className="text-slate-400 text-sm mt-1">or click to browse · up to 500 MB</p>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={onFileInputChange}
            aria-hidden="true"
          />
        </div>

        {/* Receive File Card */}
        <div className="card animate-slide-up" style={{ animationDelay: '0.1s' }}>
          <div className="flex items-center gap-2 mb-4">
            <span className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-sm">📥</span>
            <h2 className="text-base font-semibold text-emerald-300">Receive a File</h2>
          </div>
          <form onSubmit={handleJoin} className="flex flex-col gap-3">
            <input
              type="text"
              className="input-field uppercase tracking-widest text-center"
              placeholder="Enter 6-char code or paste link"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              maxLength={200}
              aria-label="Room code or shareable link"
            />
            <button type="submit" className="btn-primary w-full">
              Join Room →
            </button>
          </form>
        </div>

        {error && (
          <AlertBanner
            type="error"
            message={error}
            onDismiss={() => setError('')}
          />
        )}
      </div>

      <p className="text-slate-600 text-xs text-center">
        *Up to 500 MB · Files never touch our servers · Open source
      </p>
    </div>
  )
}

