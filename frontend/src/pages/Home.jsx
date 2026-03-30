import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'

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
    // If it looks like a full URL, extract the roomId
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
    <div className="min-h-screen flex flex-col items-center justify-center p-4 gap-8">
      {/* Header */}
      <div className="text-center">
        <div className="text-5xl mb-3">📡</div>
        <h1 className="text-4xl font-bold text-white mb-2">ShareDrop</h1>
        <p className="text-slate-400">Secure peer-to-peer file sharing via WebRTC</p>
      </div>

      <div className="w-full max-w-md flex flex-col gap-6">
        {/* Send File Card */}
        <div className="card">
          <h2 className="text-lg font-semibold mb-4 text-sky-400">📤 Send a File</h2>

          <div
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors duration-200 ${
              dragActive
                ? 'border-sky-400 bg-sky-400/10'
                : 'border-slate-600 hover:border-sky-500 hover:bg-slate-700/50'
            }`}
            onClick={() => fileInputRef.current?.click()}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
          >
            <div className="text-4xl mb-2">📁</div>
            <p className="text-slate-300 font-medium">Drop a file here</p>
            <p className="text-slate-500 text-sm mt-1">or click to browse (up to 500 MB)</p>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={onFileInputChange}
          />
        </div>

        {/* Receive File Card */}
        <div className="card">
          <h2 className="text-lg font-semibold mb-4 text-emerald-400">📥 Receive a File</h2>
          <form onSubmit={handleJoin} className="flex flex-col gap-3">
            <input
              type="text"
              className="input-field uppercase tracking-widest"
              placeholder="Enter 6-char code or paste link"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              maxLength={200}
            />
            <button type="submit" className="btn-secondary">
              Join Room
            </button>
          </form>
        </div>

        {error && (
          <div className="bg-red-900/50 border border-red-500 rounded-xl p-3 text-red-300 text-sm text-center">
            {error}
          </div>
        )}
      </div>

      <p className="text-slate-600 text-xs text-center">
        End-to-end encrypted · No files stored on server · Open source
      </p>
    </div>
  )
}
