import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { getSocket, waitForSocketConnection } from '../utils/socket'
import { useWebRTC } from '../hooks/useWebRTC'
import { fileToChunks } from '../utils/fileUtils'
import { generateKey, exportKey, encryptData } from '../utils/crypto'
import AlertBanner from '../components/AlertBanner'
import TransferProgress from '../components/TransferProgress'

const SEND_TIMEOUT_MS = 30000
const HIGH_WATER_MARK = 1024 * 1024 // 1 MB
const LOW_WATER_MARK = 256 * 1024   // 256 KB
const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024 // 2 GB

export default function SenderPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState('select') // select | waiting | sending | done | error
  const [file, setFile] = useState(null)
  const [roomId, setRoomId] = useState(null)
  const [shortCode, setShortCode] = useState(null)
  const [progress, setProgress] = useState(0)
  const [speed, setSpeed] = useState(0)
  const [eta, setEta] = useState(Infinity)
  const [error, setError] = useState(null)

  const pcRef = useRef(null)
  const dcRef = useRef(null)
  const sendTimeoutRef = useRef(null)
  const fileRef = useRef(null)

  const { createPeerConnection, createOffer, setRemoteAnswer, addIceCandidate } = useWebRTC()

  const handleFileSelect = (e) => {
    const f = e.target.files?.[0]
    if (f) {
      if (f.size > MAX_FILE_SIZE) {
        setError(`File is too large. Maximum allowed size is ${(MAX_FILE_SIZE / (1024 * 1024 * 1024)).toFixed(0)} GB.`)
        e.target.value = ''
        return
      }
      setFile(f)
      fileRef.current = f
    }
  }

  const handleStart = async () => {
    if (!file) return
    setError(null)
    try {
      const socket = await waitForSocketConnection()
      socket.emit('create-room')
    } catch (err) {
      setError('Failed to connect to server: ' + err.message)
    }
  }

  const startFileTransfer = async (dc) => {
    const currentFile = fileRef.current
    if (!currentFile) return

    try {
      if (dc.readyState !== 'open') {
        throw new Error(`Data channel not open (state: ${dc.readyState})`)
      }

      const key = await generateKey()
      const exportedKey = await exportKey(key)

      // Send file metadata
      dc.send(JSON.stringify({
        type: 'metadata',
        name: currentFile.name,
        size: currentFile.size,
        mimeType: currentFile.type || 'application/octet-stream',
        encryptionKey: exportedKey,
      }))

      const chunks = await fileToChunks(currentFile)
      const totalChunks = chunks.length
      let bytesSent = 0
      const startTime = Date.now()

      for (let i = 0; i < totalChunks; i++) {
        if (dc.readyState !== 'open') {
          throw new Error('Data channel closed during transfer')
        }

        const encrypted = await encryptData(key, chunks[i])

        // Backpressure: wait for buffer to drain before sending next chunk
        await waitForBufferDrain(dc)

        dc.send(encrypted)
        bytesSent += chunks[i].byteLength

        const elapsed = (Date.now() - startTime) / 1000
        const currentSpeed = bytesSent / elapsed
        const remaining = (currentFile.size - bytesSent) / currentSpeed

        setProgress(Math.round((bytesSent / currentFile.size) * 100))
        setSpeed(currentSpeed)
        setEta(remaining)
      }

      // Signal transfer complete
      dc.send(JSON.stringify({ type: 'done' }))
      setProgress(100)
      setStep('done')
    } catch (err) {
      console.error('[Sender] Transfer error:', err)
      setError('File transfer failed: ' + err.message)
      setStep('error')
    }
  }

  const waitForBufferDrain = (dc) => {
    return new Promise((resolve) => {
      if (dc.bufferedAmount < HIGH_WATER_MARK) {
        resolve()
        return
      }

      if ('bufferedAmountLowThreshold' in dc) {
        // Preferred path: event-driven drain notification
        dc.bufferedAmountLowThreshold = LOW_WATER_MARK
        const onLow = () => {
          dc.removeEventListener('bufferedamountlow', onLow)
          resolve()
        }
        dc.addEventListener('bufferedamountlow', onLow)
      } else {
        // Fallback: polling with setTimeout
        const poll = () => {
          if (dc.bufferedAmount < HIGH_WATER_MARK) {
            resolve()
          } else {
            setTimeout(poll, 50)
          }
        }
        setTimeout(poll, 50)
      }
    })
  }

  useEffect(() => {
    const socket = getSocket()

    const onRoomCreated = ({ roomId: rid, shortCode: sc }) => {
      setRoomId(rid)
      setShortCode(sc)
      setStep('waiting')
    }

    const onPeerJoined = async ({ roomId: rid }) => {
      setStep('sending')

      try {
        const pc = createPeerConnection(rid, (candidate) => {
          socket.emit('ice-candidate', { candidate, roomId: rid })
        })
        pcRef.current = pc

        // Create data channel BEFORE creating the offer
        const dc = pc.createDataChannel('file-transfer', { ordered: true })
        dcRef.current = dc

        dc.onopen = () => {
          if (import.meta.env.DEV) console.log('[DC] Data channel opened')
          clearTimeout(sendTimeoutRef.current)
          startFileTransfer(dc)
        }

        dc.onerror = (err) => {
          console.error('[DC] Data channel error:', err)
          setError('Data channel error: transfer failed')
          setStep('error')
        }

        dc.onclose = () => {
          if (import.meta.env.DEV) console.log('[DC] Data channel closed')
        }

        // Timeout if data channel never opens
        sendTimeoutRef.current = setTimeout(() => {
          console.error('[DC] Data channel open timeout')
          setError('Connection timed out. Please try again.')
          setStep('error')
          pc.close()
        }, SEND_TIMEOUT_MS)

        const offer = await createOffer(pc)
        socket.emit('webrtc-offer', { offer, roomId: rid })
      } catch (err) {
        console.error('[Sender] Error creating offer:', err)
        setError('Failed to initiate connection: ' + err.message)
        setStep('error')
      }
    }

    const onAnswer = async ({ answer }) => {
      try {
        const pc = pcRef.current
        if (!pc) throw new Error('No peer connection')
        await setRemoteAnswer(pc, answer)
      } catch (err) {
        console.error('[Sender] Error setting remote answer:', err)
        setError('Connection negotiation failed: ' + err.message)
        setStep('error')
      }
    }

    const onIceCandidate = async ({ candidate }) => {
      const pc = pcRef.current
      if (pc) await addIceCandidate(pc, candidate)
    }

    const onError = ({ message }) => {
      setError(message)
      setStep('error')
    }

    const onPeerDisconnected = () => {
      setError('The receiver has disconnected.')
      setStep((s) => (s !== 'done' ? 'error' : s))
    }

    const onRoomFull = ({ message }) => {
      setError(message || 'Room is already full.')
      setStep('error')
    }

    socket.on('room-created', onRoomCreated)
    socket.on('peer-joined', onPeerJoined)
    socket.on('webrtc-answer', onAnswer)
    socket.on('ice-candidate', onIceCandidate)
    socket.on('error', onError)
    socket.on('peer-disconnected', onPeerDisconnected)
    socket.on('room-full', onRoomFull)

    return () => {
      socket.off('room-created', onRoomCreated)
      socket.off('peer-joined', onPeerJoined)
      socket.off('webrtc-answer', onAnswer)
      socket.off('ice-candidate', onIceCandidate)
      socket.off('error', onError)
      socket.off('peer-disconnected', onPeerDisconnected)
      socket.off('room-full', onRoomFull)
      clearTimeout(sendTimeoutRef.current)
    }
  // createPeerConnection, createOffer, setRemoteAnswer, addIceCandidate are stable
  // useCallback refs; startFileTransfer is intentionally captured at mount time.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createPeerConnection, createOffer, setRemoteAnswer, addIceCandidate])

  const joinUrl = roomId ? `${window.location.origin}/join/${roomId}` : ''

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="card max-w-md w-full">
        {step === 'select' && (
          <div className="flex flex-col gap-6">
            <h1 className="text-2xl font-bold text-white">Send a File</h1>
            <label className="cursor-pointer flex flex-col items-center justify-center border-2 border-dashed border-white/20 rounded-2xl p-10 hover:border-sky-500/50 transition-colors">
              <span className="text-4xl mb-3">📁</span>
              <span className="text-slate-300">{file ? file.name : 'Click to select a file'}</span>
              {file && <span className="text-slate-500 text-sm mt-1">{(file.size / 1024).toFixed(1)} KB</span>}
              <input type="file" className="hidden" onChange={handleFileSelect} />
            </label>
            {error && <AlertBanner type="error" message={error} onDismiss={() => setError(null)} />}
            <button className="btn-primary w-full" disabled={!file} onClick={handleStart}>
              Start Sharing
            </button>
            <button className="btn-secondary w-full" onClick={() => navigate('/')}>
              Cancel
            </button>
          </div>
        )}

        {step === 'waiting' && (
          <div className="flex flex-col items-center gap-6">
            <h2 className="text-xl font-bold text-white">Waiting for receiver…</h2>
            {joinUrl && (
              <div className="bg-white p-4 rounded-2xl">
                <QRCodeSVG value={joinUrl} size={200} />
              </div>
            )}
            <div className="text-center">
              <p className="text-slate-400 text-sm mb-2">Or share this code</p>
              <p className="text-4xl font-mono font-bold text-sky-400 tracking-widest">{shortCode}</p>
            </div>
            <p className="text-slate-400 text-sm text-center break-all">{joinUrl}</p>
          </div>
        )}

        {step === 'sending' && (
          <div className="flex flex-col gap-6">
            <h2 className="text-xl font-bold text-white">Sending…</h2>
            <TransferProgress
              progress={progress}
              speed={speed}
              eta={eta}
              fileName={file?.name}
              fileSize={file?.size}
            />
          </div>
        )}

        {step === 'done' && (
          <div className="flex flex-col items-center gap-6">
            <span className="text-6xl">✅</span>
            <h2 className="text-2xl font-bold text-white">Transfer Complete!</h2>
            <button className="btn-primary w-full" onClick={() => navigate('/')}>
              Send Another
            </button>
          </div>
        )}

        {step === 'error' && (
          <div className="flex flex-col items-center gap-6">
            <span className="text-6xl">❌</span>
            <h2 className="text-2xl font-bold text-white">Transfer Failed</h2>
            {error && <AlertBanner type="error" message={error} />}
            <button className="btn-primary w-full" onClick={() => navigate('/')}>
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
