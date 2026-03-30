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
  formatSpeed,
  formatEta,
} from '../utils/fileUtils'
import TransferProgress from '../components/TransferProgress'

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

    // Create room
    socket.emit('create-room')
    setStatus('creating')

    socket.on('room-created', ({ roomId: rid, shortCode: sc }) => {
      setRoomId(rid)
      setShortCode(sc)
      roomIdRef.current = rid
      setStatus('waiting')
      console.log('[Sender] Room created:', rid, sc)
    })

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
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4 animate-spin">⏳</div>
          <p className="text-slate-400">Creating room…</p>
        </div>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-4">
        <div className="text-5xl">❌</div>
        <h2 className="text-xl font-bold text-red-400">Transfer Failed</h2>
        <p className="text-slate-400 text-center">{error}</p>
        <button className="btn-primary" onClick={() => navigate('/')}>Go Home</button>
      </div>
    )
  }

  if (status === 'done') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-4">
        <div className="text-5xl">✅</div>
        <h2 className="text-xl font-bold text-emerald-400">Transfer Complete!</h2>
        <p className="text-slate-400 text-center">{file.name} sent successfully.</p>
        <button className="btn-primary" onClick={() => navigate('/')}>Send Another</button>
      </div>
    )
  }

  if (status === 'transferring') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 p-4">
        <div className="w-full max-w-md card">
          <h2 className="text-lg font-semibold text-sky-400 mb-4">📤 Sending {file.name}</h2>
          <TransferProgress
            progress={progress}
            speed={speed}
            eta={eta}
            fileName={file.name}
            fileSize={file.size}
          />
        </div>
      </div>
    )
  }

  // waiting | connecting
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 gap-6">
      <div className="text-center">
        <div className="text-4xl mb-2">📤</div>
        <h1 className="text-2xl font-bold text-white">Ready to Share</h1>
        <p className="text-slate-400 text-sm mt-1">
          {status === 'connecting' ? '🔗 Connecting to receiver…' : '⏳ Waiting for receiver…'}
        </p>
      </div>

      <div className="w-full max-w-md flex flex-col gap-5">
        {/* File info */}
        <div className="card flex gap-3 items-center">
          <span className="text-3xl">📄</span>
          <div>
            <p className="font-semibold text-white truncate max-w-xs">{file.name}</p>
            <p className="text-slate-400 text-sm">{formatBytes(file.size)}</p>
          </div>
        </div>

        {/* QR Code */}
        <div className="card flex flex-col items-center gap-4">
          <p className="text-slate-400 text-sm">Scan QR code or share the link below</p>
          <div className="bg-white p-3 rounded-xl">
            <QRCodeSVG value={shareLink} size={180} />
          </div>

          {/* Short code */}
          <div className="text-center">
            <p className="text-slate-400 text-xs mb-1">Short code</p>
            <p className="text-3xl font-mono font-bold text-sky-400 tracking-widest">{shortCode}</p>
          </div>

          {/* Share link */}
          <div className="w-full">
            <p className="text-slate-400 text-xs mb-1">Shareable link</p>
            <div className="flex gap-2">
              <input
                readOnly
                className="input-field text-sm truncate"
                value={shareLink}
              />
              <button
                className="btn-secondary shrink-0 px-4"
                onClick={() => copyToClipboard(shareLink)}
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
