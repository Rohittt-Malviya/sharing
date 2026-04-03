import { useState, useRef, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getSocket, waitForSocketConnection } from '../utils/socket'
import { useWebRTC } from '../hooks/useWebRTC'
import { chunksToBlob } from '../utils/fileUtils'
import { importKey, decryptData } from '../utils/crypto'
import AlertBanner from '../components/AlertBanner'
import TransferProgress from '../components/TransferProgress'

export default function ReceiverPage() {
  const { roomId: paramRoomId } = useParams()
  const navigate = useNavigate()

  const [step, setStep] = useState(paramRoomId ? 'connecting' : 'join')
  const [manualCode, setManualCode] = useState('')
  const [progress, setProgress] = useState(0)
  const [speed, setSpeed] = useState(0)
  const [eta, setEta] = useState(Infinity)
  const [error, setError] = useState(null)
  const [fileName, setFileName] = useState(null)
  const [fileSize, setFileSize] = useState(null)
  const [downloadUrl, setDownloadUrl] = useState(null)

  const pcRef = useRef(null)
  const dcRef = useRef(null)
  const messageQueueRef = useRef([])
  const chunksRef = useRef([])
  const metadataRef = useRef(null)
  const receivedBytesRef = useRef(0)
  const startTimeRef = useRef(null)

  const { createPeerConnection, createAnswer, addIceCandidate } = useWebRTC()

  // ── Data channel helpers ────────────────────────────────────────────────

  const handleDataChannelMessage = async (event) => {
    const data = event.data

    if (typeof data === 'string') {
      try {
        const msg = JSON.parse(data)

        if (msg.type === 'metadata') {
          metadataRef.current = msg
          setFileName(msg.name)
          setFileSize(msg.size)
          chunksRef.current = []
          receivedBytesRef.current = 0
          startTimeRef.current = Date.now()
          setStep('receiving')
        } else if (msg.type === 'done') {
          await finalizeTransfer()
        }
      } catch (err) {
        console.error('[Receiver] Failed to parse message:', err)
      }
    } else {
      // Binary chunk
      if (!metadataRef.current) {
        console.warn('[Receiver] Received binary data before metadata — ignoring')
        return
      }

      try {
        const meta = metadataRef.current
        const key = await importKey(meta.encryptionKey)
        const decrypted = await decryptData(key, data)
        chunksRef.current.push(decrypted)
        receivedBytesRef.current += decrypted.byteLength

        const elapsed = (Date.now() - startTimeRef.current) / 1000
        const currentSpeed = receivedBytesRef.current / elapsed
        const remaining = (meta.size - receivedBytesRef.current) / currentSpeed

        setProgress(Math.round((receivedBytesRef.current / meta.size) * 100))
        setSpeed(currentSpeed)
        setEta(remaining)
      } catch (err) {
        console.error('[Receiver] Failed to decrypt chunk:', err)
        setError('Failed to decrypt received data')
        setStep('error')
      }
    }
  }

  const processMessageQueue = () => {
    const dc = dcRef.current
    if (!dc || dc.readyState !== 'open') return
    while (messageQueueRef.current.length > 0) {
      const msg = messageQueueRef.current.shift()
      handleDataChannelMessage(msg)
    }
  }

  const setupDataChannel = (dc) => {
    dc.binaryType = 'arraybuffer'

    dc.onopen = () => {
      if (import.meta.env.DEV) console.log('[DC] Data channel opened')
      processMessageQueue()
    }

    dc.onmessage = (event) => {
      if (dc.readyState !== 'open') {
        // Buffer messages that arrive before the channel is fully open
        messageQueueRef.current.push(event)
        return
      }
      handleDataChannelMessage(event)
    }

    dc.onerror = (err) => {
      console.error('[DC] Data channel error:', err)
      setError('Data channel error during transfer')
      setStep('error')
    }

    dc.onclose = () => {
      if (import.meta.env.DEV) console.log('[DC] Data channel closed')
    }
  }

  const finalizeTransfer = async () => {
    try {
      const meta = metadataRef.current
      const blob = chunksToBlob(chunksRef.current, meta.mimeType)
      const url = URL.createObjectURL(blob)
      setDownloadUrl(url)
      setProgress(100)
      setStep('done')
    } catch (err) {
      console.error('[Receiver] Failed to finalize transfer:', err)
      setError('Failed to save file')
      setStep('error')
    }
  }

  // ── Peer connection factory ─────────────────────────────────────────────

  const initPeerConnection = (rid, socket) => {
    const pc = createPeerConnection(rid, (candidate) => {
      socket.emit('ice-candidate', { candidate, roomId: rid })
    })
    pcRef.current = pc

    pc.ondatachannel = (event) => {
      const dc = event.channel
      dcRef.current = dc
      setupDataChannel(dc)
    }

    return pc
  }

  // ── Socket event handlers ───────────────────────────────────────────────

  useEffect(() => {
    const socket = getSocket()

    // Create peer connection immediately if we already have a roomId (URL param)
    if (paramRoomId) {
      initPeerConnection(paramRoomId, socket)
      socket.emit('join-room', { roomId: paramRoomId })
    }

    const onOffer = async ({ offer, roomId: rid }) => {
      try {
        let pc = pcRef.current
        if (!pc) {
          // Fallback: create PC if not already created (e.g. late arrival)
          pc = initPeerConnection(rid, socket)
        }
        const answer = await createAnswer(pc, offer)
        socket.emit('webrtc-answer', { answer, roomId: rid })
      } catch (err) {
        console.error('[Receiver] Error handling offer:', err)
        setError('Failed to establish connection: ' + err.message)
        setStep('error')
      }
    }

    const onIceCandidate = async ({ candidate }) => {
      const pc = pcRef.current
      if (pc) await addIceCandidate(pc, candidate)
    }

    const onRoomNotFound = ({ message }) => {
      setError(message || 'Room not found')
      setStep('error')
    }

    const onRoomFull = ({ message }) => {
      setError(message || 'Room is full')
      setStep('error')
    }

    const onPeerDisconnected = () => {
      setError('Sender disconnected')
      setStep((s) => (s !== 'done' ? 'error' : s))
    }

    const onError = ({ message }) => {
      setError(message)
      setStep('error')
    }

    socket.on('webrtc-offer', onOffer)
    socket.on('ice-candidate', onIceCandidate)
    socket.on('room-not-found', onRoomNotFound)
    socket.on('room-full', onRoomFull)
    socket.on('peer-disconnected', onPeerDisconnected)
    socket.on('error', onError)

    return () => {
      socket.off('webrtc-offer', onOffer)
      socket.off('ice-candidate', onIceCandidate)
      socket.off('room-not-found', onRoomNotFound)
      socket.off('room-full', onRoomFull)
      socket.off('peer-disconnected', onPeerDisconnected)
      socket.off('error', onError)
    }
  // createAnswer and addIceCandidate are stable useCallback refs; paramRoomId is
  // fixed for the component's lifetime (React Router won't remount on same route).
  // initPeerConnection is defined inline and intentionally captured at mount time.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createAnswer, addIceCandidate, paramRoomId])

  const handleManualJoin = async () => {
    if (!manualCode.trim()) return
    setError(null)
    const rid = manualCode.trim()

    try {
      const socket = await waitForSocketConnection()

      // Create peer connection BEFORE joining the room (fixes signaling race)
      initPeerConnection(rid, socket)

      socket.emit('join-room', { roomId: rid })
      setStep('connecting')
    } catch (err) {
      setError('Failed to connect: ' + err.message)
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="card max-w-md w-full">
        {step === 'join' && (
          <div className="flex flex-col gap-6">
            <h1 className="text-2xl font-bold text-white">Receive a File</h1>
            <p className="text-slate-400">Enter the 6-character code or full room ID from the sender</p>
            <input
              type="text"
              className="input-field uppercase tracking-widest text-center font-mono text-base"
              placeholder="XXXXXX"
              maxLength={12}
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && handleManualJoin()}
            />
            {error && <AlertBanner type="error" message={error} onDismiss={() => setError(null)} />}
            <button className="btn-primary w-full" onClick={handleManualJoin} disabled={!manualCode.trim()}>
              Join
            </button>
            <button className="btn-secondary w-full" onClick={() => navigate('/')}>
              Cancel
            </button>
          </div>
        )}

        {step === 'connecting' && (
          <div className="flex flex-col items-center gap-6">
            <div className="w-16 h-16 rounded-full bg-sky-500/20 flex items-center justify-center">
              <div className="animate-spin w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full" />
            </div>
            <h2 className="text-xl font-bold text-white">Connecting…</h2>
            <p className="text-slate-400 text-center">Waiting for sender to initiate transfer</p>
          </div>
        )}

        {step === 'receiving' && (
          <div className="flex flex-col gap-6">
            <h2 className="text-xl font-bold text-white">Receiving…</h2>
            <TransferProgress
              progress={progress}
              speed={speed}
              eta={eta}
              fileName={fileName}
              fileSize={fileSize}
            />
          </div>
        )}

        {step === 'done' && (
          <div className="flex flex-col items-center gap-6">
            <span className="text-6xl">✅</span>
            <h2 className="text-2xl font-bold text-white">Transfer Complete!</h2>
            {downloadUrl && (
              <a href={downloadUrl} download={fileName} className="btn-primary w-full text-center">
                Download {fileName}
              </a>
            )}
            <button className="btn-secondary w-full" onClick={() => navigate('/')}>
              Done
            </button>
          </div>
        )}

        {step === 'error' && (
          <div className="flex flex-col items-center gap-6">
            <span className="text-6xl">❌</span>
            <h2 className="text-2xl font-bold text-white">Connection Failed</h2>
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
