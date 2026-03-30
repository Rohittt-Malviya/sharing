import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getSocket, disconnectSocket } from '../utils/socket'
import { useWebRTC } from '../hooks/useWebRTC'
import { importKey, decryptData, hashBuffer } from '../utils/crypto'
import { chunksToBlob, formatBytes, formatSpeed, formatEta } from '../utils/fileUtils'
import TransferProgress from '../components/TransferProgress'

// AES-GCM adds a small overhead (IV + auth tag) so encrypted size > original
const ENCRYPTION_OVERHEAD_FACTOR = 1.01

export default function ReceiverPage() {
  const { roomId } = useParams()
  const navigate = useNavigate()

  const [status, setStatus] = useState('joining') // joining | waiting | receiving | done | error
  const setStatusBoth = (s) => { statusRef.current = s; setStatus(s) }
  const [progress, setProgress] = useState(0)
  const [speed, setSpeed] = useState(0)
  const [eta, setEta] = useState(0)
  const [error, setError] = useState('')
  const [fileInfo, setFileInfo] = useState(null)
  const [downloadUrl, setDownloadUrl] = useState(null)
  const [downloadName, setDownloadName] = useState('')
  const [joinCode, setJoinCode] = useState(roomId || '')

  const encKeyRef = useRef(null)
  const chunksRef = useRef([])
  const totalBytesRef = useRef(0)
  const receivedBytesRef = useRef(0)
  const startTimeRef = useRef(null)
  const fileInfoRef = useRef(null)
  const roomIdRef = useRef(roomId || null)
  const statusRef = useRef('joining')

  const onIceCandidate = useCallback((candidate) => {
    const socket = getSocket()
    socket.emit('ice-candidate', { candidate, roomId: roomIdRef.current })
  }, [])

  const onDataChannel = useCallback((channel) => {
    console.log('[Receiver] DataChannel received')
    setupDataChannel(channel)
  }, [])

  const { createPeerConnection, createAnswer, addIceCandidate, closePeerConnection } =
    useWebRTC({ onDataChannel, onIceCandidate })

  const setupDataChannel = (dc) => {
    dc.binaryType = 'arraybuffer'

    dc.onmessage = async (event) => {
      const data = event.data

      // Text messages are JSON control messages
      if (typeof data === 'string') {
        const msg = JSON.parse(data)

        if (msg.type === 'meta') {
          // Received file metadata + encryption key
          const key = await importKey(msg.encKey)
          encKeyRef.current = key
          fileInfoRef.current = { name: msg.name, size: msg.size, mimeType: msg.mimeType }
          setFileInfo({ name: msg.name, size: msg.size, mimeType: msg.mimeType })
          setStatusBoth('receiving')
          startTimeRef.current = Date.now()
          console.log('[Receiver] Meta received:', msg.name, msg.size)
          return
        }

        if (msg.type === 'done') {
          // File transfer complete – reassemble and decrypt
          await finalizeTransfer(msg.hash)
          return
        }
      }

      // Binary chunk
      if (data instanceof ArrayBuffer) {
        chunksRef.current.push(data)
        receivedBytesRef.current += data.byteLength

        // Use file.size as total (approximate – encrypted size is slightly larger)
        const totalApprox = fileInfoRef.current?.size || 1
        const elapsed = (Date.now() - (startTimeRef.current || Date.now())) / 1000
        const bps = receivedBytesRef.current / Math.max(elapsed, 0.1)
        const pct = Math.min(Math.round((receivedBytesRef.current / (totalApprox * ENCRYPTION_OVERHEAD_FACTOR)) * 100), 99)
        const remaining = (totalApprox - receivedBytesRef.current) / bps

        setProgress(pct)
        setSpeed(bps)
        setEta(remaining)
      }
    }

    dc.onclose = () => console.log('[Receiver] DataChannel closed')
    dc.onerror = (e) => {
      console.error('[Receiver] DataChannel error:', e)
      setError('Data channel error.')
      setStatusBoth('error')
    }
  }

  const finalizeTransfer = async (expectedHash) => {
    try {
      setProgress(99)
      const key = encKeyRef.current
      if (!key) throw new Error('No decryption key')

      // Concatenate all encrypted chunks
      const totalEncSize = chunksRef.current.reduce((s, c) => s + c.byteLength, 0)
      const encBuffer = new Uint8Array(totalEncSize)
      let offset = 0
      for (const chunk of chunksRef.current) {
        encBuffer.set(new Uint8Array(chunk), offset)
        offset += chunk.byteLength
      }

      // Decrypt
      const decryptedBuffer = await decryptData(key, encBuffer.buffer)

      // Verify hash
      const actualHash = await hashBuffer(decryptedBuffer)
      if (expectedHash && actualHash !== expectedHash) {
        throw new Error('File integrity check failed – hashes do not match.')
      }

      // Create download URL
      const blob = chunksToBlob([decryptedBuffer], fileInfoRef.current?.mimeType)
      const url = URL.createObjectURL(blob)
      setDownloadUrl(url)
      setDownloadName(fileInfoRef.current?.name || 'download')
      setProgress(100)
      setStatusBoth('done')
      console.log('[Receiver] Transfer complete:', fileInfoRef.current?.name)
    } catch (err) {
      console.error('[Receiver] Finalization error:', err)
      setError(err.message || 'Failed to decrypt or verify file.')
      setStatusBoth('error')
    }
  }

  const joinRoom = useCallback((rid) => {
    const socket = getSocket()
    roomIdRef.current = rid

    socket.emit('join-room', { roomId: rid })
    console.log('[Receiver] Joining room:', rid)

    socket.on('room-not-found', ({ message }) => {
      setError(message)
      setStatusBoth('error')
    })

    socket.on('room-full', ({ message }) => {
      setError(message)
      setStatusBoth('error')
    })

    socket.on('webrtc-offer', async ({ offer }) => {
      console.log('[Receiver] Offer received')
      setStatusBoth('waiting')
      try {
        const pc = createPeerConnection()
        const answer = await createAnswer(offer)
        socket.emit('webrtc-answer', { answer, roomId: rid })
        console.log('[Receiver] Answer sent')
      } catch (err) {
        console.error('[Receiver] Offer handling error:', err)
        setError('WebRTC connection failed.')
        setStatusBoth('error')
      }
    })

    socket.on('ice-candidate', async ({ candidate }) => {
      await addIceCandidate(candidate)
    })

    socket.on('peer-disconnected', () => {
      if (statusRef.current !== 'done') {
        setError('Sender disconnected.')
        setStatusBoth('error')
      }
    })

    socket.on('error', ({ message }) => {
      setError(message)
      setStatusBoth('error')
    })
  }, [createPeerConnection, createAnswer, addIceCandidate])

  useEffect(() => {
    if (roomId) {
      setStatusBoth('joining')
      joinRoom(roomId)
    }

    return () => {
      const socket = getSocket()
      socket.off('room-not-found')
      socket.off('room-full')
      socket.off('webrtc-offer')
      socket.off('ice-candidate')
      socket.off('peer-disconnected')
      socket.off('error')
      closePeerConnection()
      disconnectSocket()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId])

  const handleManualJoin = (e) => {
    e.preventDefault()
    const code = joinCode.trim().toUpperCase()
    if (!code) return
    setStatusBoth('joining')
    joinRoom(code)
  }

  // Manual join form (no roomId in URL)
  if (!roomId && status === 'joining' && !roomIdRef.current) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 p-4">
        <div className="text-center">
          <div className="text-5xl mb-3">📥</div>
          <h1 className="text-2xl font-bold text-white">Join a Room</h1>
        </div>
        <div className="w-full max-w-md card">
          <form onSubmit={handleManualJoin} className="flex flex-col gap-3">
            <input
              type="text"
              className="input-field uppercase tracking-widest text-center text-xl"
              placeholder="Enter room code"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              maxLength={12}
              autoFocus
            />
            <button type="submit" className="btn-primary">Join</button>
          </form>
        </div>
      </div>
    )
  }

  if (status === 'joining' || status === 'waiting') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-4">
        <div className="text-5xl animate-pulse">🔗</div>
        <h2 className="text-xl font-bold text-white">
          {status === 'joining' ? 'Joining room…' : 'Waiting for sender…'}
        </h2>
        <p className="text-slate-400 text-sm">Room: {roomIdRef.current}</p>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-4">
        <div className="text-5xl">❌</div>
        <h2 className="text-xl font-bold text-red-400">Connection Failed</h2>
        <p className="text-slate-400 text-center">{error}</p>
        <button className="btn-primary" onClick={() => navigate('/')}>Go Home</button>
      </div>
    )
  }

  if (status === 'receiving') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 p-4">
        <div className="w-full max-w-md card">
          <h2 className="text-lg font-semibold text-sky-400 mb-4">
            📥 Receiving {fileInfo?.name}
          </h2>
          <TransferProgress
            progress={progress}
            speed={speed}
            eta={eta}
            fileName={fileInfo?.name}
            fileSize={fileInfo?.size}
          />
        </div>
      </div>
    )
  }

  if (status === 'done') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 p-4">
        <div className="text-5xl">✅</div>
        <h2 className="text-xl font-bold text-emerald-400">File Received!</h2>
        <div className="w-full max-w-md card text-center">
          <p className="text-white font-semibold mb-1">{downloadName}</p>
          <p className="text-slate-400 text-sm mb-4">{formatBytes(fileInfo?.size || 0)}</p>
          <a
            href={downloadUrl}
            download={downloadName}
            className="btn-primary inline-block"
          >
            ⬇️ Download File
          </a>
        </div>
        <button className="btn-secondary" onClick={() => navigate('/')}>Receive Another</button>
      </div>
    )
  }

  return null
}
