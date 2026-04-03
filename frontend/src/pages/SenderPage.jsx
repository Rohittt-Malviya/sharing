import { useEffect, useState, useRef, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { getSocket, disconnectSocket } from '../utils/socket'
import { useWebRTC } from '../hooks/useWebRTC'
import {
  generateKey,
  exportKey,
  encryptData,
  hashBuffer,
} from '../utils/crypto'
import {
  CHUNK_SIZE,
  formatBytes,
} from '../utils/fileUtils'
import TransferProgress from '../components/TransferProgress'
import LoadingSpinner from '../components/LoadingSpinner'

// eslint-disable-next-line no-unused-vars
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000'

// Backpressure thresholds for the data channel send buffer
const BACKPRESSURE_HIGH_THRESHOLD = 16 * CHUNK_SIZE  // pause sending above this
const BACKPRESSURE_LOW_THRESHOLD = 4 * CHUNK_SIZE    // resume sending below this

export default function SenderPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const file = location.state?.file

  const [roomId, setRoomId] = useState(null)
  const [shortCode, setShortCode] = useState(null)
  const [status, setStatus] = useState('creating') // creating | waiting | connecting | transferring | done | error
  const [progress, setProgress] = useState(0)
  const [speed, setSpeed] = useState(0)
  const [eta, setEta] = useState(0)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  const dataChannelRef = useRef(null)
  const encKeyRef = useRef(null)
  const roomIdRef = useRef(null)

  const onIceCandidate = useCallback((candidate) => {
    const socket = getSocket()
    socket.emit('ice-candidate', { candidate, roomId: roomIdRef.current })
  }, [])

  const { createPeerConnection, createOffer, setRemoteAnswer, addIceCandidate, closePeerConnection } =
    useWebRTC({ onIceCandidate })

  // Navigate home if no file was passed
  useEffect(() => {
    if (!file) navigate('/')
  }, [file, navigate])

  useEffect(() => {
    if (!file) return
    const socket = getSocket()

    // Register room-created listener BEFORE emitting, to avoid any race condition
    socket.on('room-created', ({ roomId: rid, shortCode: sc }) => {
      setRoomId(rid)
      setShortCode(sc)
      roomIdRef.current = rid
      setStatus('waiting')
      console.log('[Sender] Room created:', rid, sc)
    })

    // Create room
    socket.emit('create-room')
    setStatus('creating')

    socket.on('peer-joined', async ({ roomId: rid }) => {
      console.log('[Sender] Peer joined room:', rid)
      setStatus('connecting')

      try {
        // Generate encryption key
        const key = await generateKey()
        encKeyRef.current = key
        const exportedKey = await exportKey(key)

        // Create RTCPeerConnection and data channel
        const pc = createPeerConnection()

        // Create the data channel BEFORE creating offer
        const dc = pc.createDataChannel('file-transfer', { ordered: true })
        dataChannelRef.current = dc

        dc.onopen = () => {
          console.log('[Sender] DataChannel open')
          // Send file metadata including encryption key
          const meta = JSON.stringify({
            type: 'meta',
            name: file.name,
            size: file.size,
            mimeType: file.type,
            encKey: exportedKey,
          })
          dc.send(meta)
          // Start sending file
          sendFile()
        }

        dc.onerror = (e) => {
          console.error('[Sender] DataChannel error:', e)
          setError('Data channel error. Please try again.')
          setStatus('error')
        }

        // Create and send offer
        const offer = await createOffer()
        socket.emit('webrtc-offer', { offer, roomId: rid })
        console.log('[Sender] Offer sent')
      } catch (err) {
        console.error('[Sender] Connection setup failed:', err)
        setError('Failed to establish connection.')
        setStatus('error')
      }
    })

    socket.on('webrtc-answer', async ({ answer }) => {
      console.log('[Sender] Answer received')
      await setRemoteAnswer(answer)
    })

    socket.on('ice-candidate', async ({ candidate }) => {
      await addIceCandidate(candidate)
    })

    socket.on('peer-disconnected', () => {
      setError('Receiver disconnected.')
      setStatus('error')
      closePeerConnection()
    })

    socket.on('error', ({ message }) => {
      setError(message)
      setStatus('error')
    })

    return () => {
      socket.off('room-created')
      socket.off('peer-joined')
      socket.off('webrtc-answer')
      socket.off('ice-candidate')
      socket.off('peer-disconnected')
      socket.off('error')
      disconnectSocket()
      closePeerConnection()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file])

  const sendFile = useCallback(async () => {
    const dc = dataChannelRef.current
    const key = encKeyRef.current
    if (!dc || !key || !file) return

    setStatus('transferring')
    const startTime = Date.now()
    let bytesSent = 0

    try {
      // Hash original file for integrity check
      const fileBuffer = await file.arrayBuffer()
      const fileHash = await hashBuffer(fileBuffer)

      // Encrypt the entire file
      const encryptedBuffer = await encryptData(key, fileBuffer)
      const encryptedBytes = new Uint8Array(encryptedBuffer)
      const totalEncSize = encryptedBytes.byteLength

      let offset = 0
      const sendNextChunk = () => {
        return new Promise((resolve) => {
          const flush = () => {
            while (offset < totalEncSize) {
              if (dc.bufferedAmount > BACKPRESSURE_HIGH_THRESHOLD) {
                // Backpressure – wait for buffer to drain
                dc.onbufferedamountlow = () => {
                  dc.onbufferedamountlow = null
                  flush()
                }
                dc.bufferedAmountLowThreshold = BACKPRESSURE_LOW_THRESHOLD
                return
              }
              const end = Math.min(offset + CHUNK_SIZE, totalEncSize)
              const chunk = encryptedBytes.slice(offset, end)
              dc.send(chunk)
              bytesSent += chunk.byteLength
              offset = end

              // Update progress
              const pct = Math.round((bytesSent / totalEncSize) * 100)
              const elapsed = (Date.now() - startTime) / 1000
              const bps = bytesSent / elapsed
              const remaining = (totalEncSize - bytesSent) / bps
              setProgress(pct)
              setSpeed(bps)
              setEta(remaining)
            }
            // All chunks sent – send done message
            dc.send(JSON.stringify({ type: 'done', hash: fileHash }))
            resolve()
          }
          flush()
        })
      }

      await sendNextChunk()
      setStatus('done')
      setProgress(100)
    } catch (err) {
      console.error('[Sender] File send error:', err)
      setError('File transfer failed.')
      setStatus('error')
    }
  }, [file])

  const shareLink = roomId ? `${window.location.origin}/join/${roomId}` : ''

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  if (!file) return null

  if (status === 'creating') {
    return (
      <div className="page-container">
        <LoadingSpinner size="lg" label="Creating secure room…" />
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="page-container gap-5">
        <div className="w-16 h-16 rounded-2xl bg-red-500/20 border border-red-500/40 flex items-center justify-center text-3xl shadow-glow-danger">
          ❌
        </div>
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white mb-2">Transfer Failed</h2>
          <p className="text-slate-400 max-w-sm">{error}</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <button className="btn-primary" onClick={() => navigate('/')}>Go Home</button>
        </div>
      </div>
    )
  }

  if (status === 'done') {
    return (
      <div className="page-container gap-5">
        <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-3xl shadow-glow-success animate-bounce-gentle">
          ✅
        </div>
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white mb-2">Transfer Complete!</h2>
          <p className="text-slate-400">{file.name} was sent successfully.</p>
        </div>
        <button className="btn-primary" onClick={() => navigate('/')}>Send Another File</button>
      </div>
    )
  }

  if (status === 'transferring') {
    return (
      <div className="page-container gap-6">
        <div className="w-full max-w-md">
          <div className="flex items-center gap-2 mb-3">
            <span className="badge-sky">📤 Sending</span>
          </div>
          <div className="card">
            <TransferProgress
              progress={progress}
              speed={speed}
              eta={eta}
              fileName={file.name}
              fileSize={file.size}
            />
          </div>
        </div>
      </div>
    )
  }

  // waiting | connecting
  return (
    <div className="page-container gap-6">
      {/* Status header */}
      <div className="text-center animate-slide-up">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-sky-500/20 border border-sky-500/30 text-3xl mb-4 shadow-glow-brand">
          📤
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Ready to Share</h1>
        <div className="flex items-center justify-center gap-2">
          {status === 'connecting' ? (
            <span className="badge-amber">🔗 Connecting to receiver…</span>
          ) : (
            <span className="badge-sky">⏳ Waiting for receiver…</span>
          )}
        </div>
      </div>

      <div className="w-full max-w-md flex flex-col gap-4">
        {/* File info */}
        <div className="card flex gap-3 items-center animate-slide-up">
          <div className="w-11 h-11 rounded-xl bg-sky-500/20 border border-sky-500/30 flex items-center justify-center text-2xl shrink-0">
            📄
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-white truncate">{file.name}</p>
            <p className="text-slate-400 text-sm">{formatBytes(file.size)}</p>
          </div>
        </div>

        {/* QR + Share */}
        <div className="card flex flex-col items-center gap-5 animate-slide-up" style={{ animationDelay: '0.1s' }}>
          <p className="text-slate-400 text-sm">Scan QR code or share the link below</p>

          <div className="bg-white p-3 rounded-2xl shadow-lg">
            <QRCodeSVG value={shareLink} size={180} />
          </div>

          {/* Short code */}
          <div className="text-center">
            <p className="text-slate-500 text-xs uppercase tracking-widest mb-1">Short Code</p>
            <p className="text-4xl font-mono font-bold text-sky-300 tracking-[0.3em] text-glow">{shortCode}</p>
          </div>

          <div className="divider w-full" />

          {/* Share link */}
          <div className="w-full">
            <p className="text-slate-500 text-xs uppercase tracking-widest mb-2">Shareable Link</p>
            <div className="flex gap-2">
              <input
                readOnly
                className="input-field text-sm truncate"
                value={shareLink}
                aria-label="Shareable link"
              />
              <button
                className="btn-secondary shrink-0 px-4"
                onClick={() => copyToClipboard(shareLink)}
                aria-label="Copy link"
                title="Copy link"
              >
                {copied ? '✅' : '📋'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

