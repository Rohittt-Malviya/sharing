import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import AlertBanner from '../components/AlertBanner'
import HeroSection from '../components/blocks/HeroSection'
import { validateFile } from '../utils/fileValidation'

const FEATURES = [
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" stroke="#00D9FF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    title: 'Instant Share',
    desc: 'Transfer files in real-time directly between browsers with WebRTC — zero waiting.',
    color: '#00D9FF',
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="11" width="18" height="11" rx="2" stroke="#9D4EDD" strokeWidth="2"/>
        <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="#9D4EDD" strokeWidth="2" strokeLinecap="round"/>
      </svg>
    ),
    title: 'Secure Link',
    desc: 'End-to-end AES-256 encryption with unique room codes — your data stays private.',
    color: '#9D4EDD',
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke="#FF2D78" strokeWidth="2" strokeLinecap="round"/>
        <circle cx="12" cy="7" r="4" stroke="#FF2D78" strokeWidth="2"/>
        <path d="M16 3.13a4 4 0 0 1 0 7.75" stroke="#FF2D78" strokeWidth="2" strokeLinecap="round"/>
      </svg>
    ),
    title: 'Anonymous',
    desc: 'No sign-up, no tracking, no logs. Files never touch our servers — completely private.',
    color: '#FF2D78',
  },
]

const FILE_TRANSFERS = [
  { name: 'design-assets.zip', size: '128 MB', speed: '48 MB/s', progress: 73, icon: '🗜️' },
  { name: 'project-video.mp4', size: '512 MB', speed: '62 MB/s', progress: 41, icon: '🎬' },
  { name: 'database-backup.sql', size: '24 MB', speed: '38 MB/s', progress: 91, icon: '🗄️' },
]


export default function Home() {
  const navigate = useNavigate()
  const [joinCode, setJoinCode] = useState('')
  const [dragActive, setDragActive] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef(null)

  const handleFileSelect = (file) => {
    if (!file) return
    const { valid, error: validationError } = validateFile(file)
    if (!valid) {
      setError(validationError)
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

  // Room IDs are 6-char short codes or 12-char full IDs using the
  // unambiguous alphabet: A-Z (minus I, L, O) + 2-9 (minus 0, 1).
  const ROOM_ID_RE = /^[A-HJ-KM-NP-Z2-9]{6}$|^[A-HJ-KM-NP-Z2-9]{12}$/i

  const handleJoin = (e) => {
    e.preventDefault()
    const code = joinCode.trim().toUpperCase()
    if (!code) { setError('Enter a room code or paste a link.'); return }
    if (code.startsWith('HTTP')) {
      try {
        const url = new URL(joinCode.trim())
        const parts = url.pathname.split('/')
        const roomId = parts[parts.length - 1].toUpperCase()
        if (!ROOM_ID_RE.test(roomId)) {
          setError('Invalid room code in URL. Expected a 6 or 12 character room code.')
          return
        }
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
    <div className="min-h-screen animate-fade-in">

      {/* ── Hero Section (merged with animated BackgroundPaths) ── */}
      <HeroSection onSendFile={(file) => { navigate('/send', { state: { file } }) }} onError={setError} />

      {/* ── Main Upload Area ── */}
      <section className="px-4 pb-20">
        <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-6">

          {/* Send File Card */}
          <div className="card-neon animate-slide-up">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 icon-neon flex items-center justify-center rounded-xl">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke="#00D9FF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <polyline points="17 8 12 3 7 8" stroke="#00D9FF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <line x1="12" y1="3" x2="12" y2="15" stroke="#00D9FF" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </div>
              <div>
                <h2 className="text-base font-semibold text-white">Send a File</h2>
                <p className="text-xs text-slate-500">Up to 2 GB · Direct P2P</p>
              </div>
            </div>

            <div
              className={`drop-zone-neon${dragActive ? ' active' : ''}`}
              onClick={() => fileInputRef.current?.click()}
              onDrop={onDrop}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              role="button"
              tabIndex={0}
              aria-label="Drop a file here or click to browse"
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && fileInputRef.current?.click()}
            >
              <div className="flex flex-col items-center gap-3">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-1 transition-transform duration-200" style={{ background: dragActive ? 'rgba(0,217,255,0.12)' : 'rgba(0,217,255,0.06)', border: '1px solid rgba(0,217,255,0.2)' }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                    <path d="M7 16a4 4 0 0 1-.88-7.903A5 5 0 1 1 15.9 6L16 6a5 5 0 0 1 1 9.9M15 13l-3-3m0 0l-3 3m3-3v12" stroke="#00D9FF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <div>
                  <p className="text-white font-semibold text-base">
                    {dragActive ? 'Release to upload' : 'Drop your file here'}
                  </p>
                  <p className="text-slate-500 text-sm mt-1">or click to browse files</p>
                </div>
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={onFileInputChange}
              aria-hidden="true"
            />

            <button
              className="btn-neon w-full mt-4 py-3 text-sm font-semibold"
              onClick={() => fileInputRef.current?.click()}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="mr-1">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                <polyline points="17 8 12 3 7 8" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                <line x1="12" y1="3" x2="12" y2="15" stroke="white" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              Choose File to Send
            </button>
          </div>

          {/* Receive File Card */}
          <div className="card-purple animate-slide-up" style={{ animationDelay: '0.1s' }}>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 icon-purple flex items-center justify-center rounded-xl">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke="#9D4EDD" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <polyline points="7 10 12 15 17 10" stroke="#9D4EDD" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <line x1="12" y1="15" x2="12" y2="3" stroke="#9D4EDD" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </div>
              <div>
                <h2 className="text-base font-semibold text-white">Receive a File</h2>
                <p className="text-xs text-slate-500">Enter code or paste link</p>
              </div>
            </div>

            <form onSubmit={handleJoin} className="flex flex-col gap-3 mt-2">
              <div className="relative">
                <input
                  type="text"
                  className="input-field uppercase tracking-widest text-center font-mono text-base py-4"
                  placeholder="ABC123"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  maxLength={200}
                  aria-label="Room code or shareable link"
                  style={{ borderColor: joinCode ? 'rgba(157,78,221,0.5)' : undefined }}
                />
              </div>
              <button
                type="submit"
                className="relative inline-flex items-center justify-center gap-2 text-white font-semibold py-3.5 px-6 rounded-xl transition-all duration-300 w-full text-sm"
                style={{ background: 'linear-gradient(135deg, #9D4EDD, #FF2D78)', boxShadow: '0 0 20px rgba(157,78,221,0.3)' }}
              >
                Join Room &rarr;
              </button>
            </form>

            {/* Quick info */}
            <div className="mt-6 flex flex-col gap-2.5">
              {[
                { label: 'Instant connection', icon: '⚡' },
                { label: 'No file size limit*', icon: '♾️' },
                { label: 'Disappears after transfer', icon: '👻' },
              ].map(({ label, icon }) => (
                <div key={label} className="flex items-center gap-2 text-sm text-slate-400">
                  <span>{icon}</span>
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {error && (
          <div className="max-w-4xl mx-auto mt-4">
            <AlertBanner
              type="error"
              message={error}
              onDismiss={() => setError('')}
            />
          </div>
        )}
      </section>

      {/* ── Neon Divider ── */}
      <div className="max-w-5xl mx-auto px-4">
        <div className="neon-divider" />
      </div>

      {/* ── Live File Transfer Showcase ── */}
      <section className="px-4 py-20">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">
              Blazing Fast <span className="text-gradient-cyan">Transfers</span>
            </h2>
            <p className="text-slate-400 text-base">Real-time peer-to-peer speeds you can count on</p>
          </div>

          <div className="card-neon">
            {/* Speed indicator header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#00D9FF' }} />
                <span className="text-sm text-slate-400 font-medium">Live Transfers</span>
              </div>
              <span className="text-xs text-slate-600 font-mono">WebRTC P2P</span>
            </div>

            <div className="flex flex-col gap-5">
              {FILE_TRANSFERS.map((file) => (
                <div key={file.name} className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="text-xl">{file.icon}</span>
                      <div>
                        <p className="text-sm font-medium text-white">{file.name}</p>
                        <p className="text-xs text-slate-500">{file.size}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold" style={{ color: '#00D9FF' }}>{file.speed}</p>
                      <p className="text-xs text-slate-600">{file.progress}%</p>
                    </div>
                  </div>
                  <div className="transfer-bar">
                    <div
                      className="transfer-bar-fill"
                      style={{ width: `${file.progress}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-4 mt-8 pt-6 border-t border-white/5">
              {[
                { label: 'Avg Speed', value: '49 MB/s', color: '#00D9FF' },
                { label: 'Active Sessions', value: '3', color: '#9D4EDD' },
                { label: 'Encryption', value: 'AES-256', color: '#10b981' },
              ].map(({ label, value, color }) => (
                <div key={label} className="text-center">
                  <p className="text-lg font-bold" style={{ color }}>{value}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Neon Divider ── */}
      <div className="max-w-5xl mx-auto px-4">
        <div className="neon-divider" />
      </div>

      {/* ── Security Features ── */}
      <section className="px-4 py-20">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">
              Bank-Grade <span className="text-gradient-purple">Security</span>
            </h2>
            <p className="text-slate-400 text-base max-w-xl mx-auto">
              Every transfer is protected by military-grade encryption. Your files are yours alone.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {[
              {
                icon: '🔐',
                title: 'AES-256-GCM Encryption',
                desc: 'Your files are encrypted before transmission using the gold standard of symmetric encryption.',
                badge: 'Military-grade',
                color: '#00D9FF',
              },
              {
                icon: '🛡️',
                title: 'End-to-End Protected',
                desc: 'Data flows directly between peers. Our servers never see, store, or process your files.',
                badge: 'Zero-knowledge',
                color: '#9D4EDD',
              },
              {
                icon: '🔑',
                title: 'Ephemeral Keys',
                desc: 'Unique cryptographic keys are generated per session and discarded immediately after transfer.',
                badge: 'Per-session',
                color: '#FF2D78',
              },
              {
                icon: '🌐',
                title: 'Direct WebRTC',
                desc: 'DTLS 1.3 and SRTP protect your WebRTC connection at the transport layer automatically.',
                badge: 'DTLS 1.3',
                color: '#10b981',
              },
            ].map(({ icon, title, desc, badge, color }) => (
              <div
                key={title}
                className="flex gap-4 p-5 rounded-2xl transition-all duration-300"
                style={{ background: 'rgba(255,255,255,0.025)', border: `1px solid ${color}22` }}
              >
                <div className="w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-xl text-xl" style={{ background: `${color}12`, border: `1px solid ${color}25` }}>
                  {icon}
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <h3 className="text-sm font-semibold text-white">{title}</h3>
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: `${color}15`, color, border: `1px solid ${color}30` }}>{badge}</span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Neon Divider ── */}
      <div className="max-w-5xl mx-auto px-4">
        <div className="neon-divider" />
      </div>

      {/* ── Feature Highlights (3-col) ── */}
      <section className="px-4 py-20">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">
              Why <span className="text-gradient-cyan">Driftshare</span>?
            </h2>
            <p className="text-slate-400 text-base">Everything you need, nothing you don&apos;t</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {FEATURES.map(({ icon, title, desc, color }, idx) => (
              <div
                key={title}
                className="card-neon flex flex-col items-center text-center p-7 animate-slide-up"
                style={{ animationDelay: `${idx * 0.1}s` }}
              >
                <div
                  className="w-14 h-14 flex items-center justify-center rounded-2xl mb-4"
                  style={{ background: `${color}10`, border: `1px solid ${color}25`, boxShadow: `0 0 20px ${color}18` }}
                >
                  {icon}
                </div>
                <h3 className="text-base font-bold text-white mb-2">{title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="px-4 py-12 mt-8" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="max-w-4xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            {/* Brand */}
            <div className="flex flex-col items-center md:items-start gap-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #00D9FF, #9D4EDD)' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <span className="font-bold text-white text-sm">Share<span style={{ color: '#00D9FF' }}>Drop</span></span>
              </div>
              <p className="text-xs text-slate-600 max-w-xs text-center md:text-left">
                Secure, instant peer-to-peer file sharing. No sign-up required.
              </p>
            </div>

            {/* Links */}
            <div className="flex items-center gap-6 flex-wrap justify-center">
              {['Privacy', 'Security', 'Open Source', 'Contact'].map((link) => (
                <a
                  key={link}
                  href="#"
                  className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {link}
                </a>
              ))}
            </div>
          </div>

          <div className="mt-8 flex flex-col md:flex-row items-center justify-between gap-3">
            <p className="text-xs text-slate-700">
              © 2024 Driftshare. Open source under MIT License.
            </p>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#10b981' }} />
              <span className="text-xs text-slate-600">All systems operational</span>
            </div>
          </div>
        </div>
      </footer>

    </div>
  )
}

