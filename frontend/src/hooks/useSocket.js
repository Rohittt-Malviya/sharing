/**
 * useSocket – React hook for socket lifecycle management.
 *
 * Provides a stable socket reference and tracks connection state so components
 * can respond to connect/disconnect events without managing socket listeners
 * directly.
 */
import { useEffect, useRef, useState } from 'react'
import { getSocket } from '../utils/socket'

/**
 * @typedef {'connecting'|'connected'|'disconnected'|'error'} SocketStatus
 */

/**
 * Returns the shared socket instance and its current connection status.
 *
 * @returns {{ socket: import('socket.io-client').Socket; status: SocketStatus }}
 */
export function useSocket() {
  const socketRef = useRef(getSocket())
  const [status, setStatus] = useState(
    socketRef.current.connected ? 'connected' : 'connecting',
  )

  useEffect(() => {
    const socket = socketRef.current

    const onConnect = () => setStatus('connected')
    const onDisconnect = () => setStatus('disconnected')
    const onConnectError = () => setStatus('error')

    socket.on('connect', onConnect)
    socket.on('disconnect', onDisconnect)
    socket.on('connect_error', onConnectError)

    // Sync initial state (socket may have connected between render and effect)
    if (socket.connected) setStatus('connected')

    return () => {
      socket.off('connect', onConnect)
      socket.off('disconnect', onDisconnect)
      socket.off('connect_error', onConnectError)
    }
  }, [])

  return { socket: socketRef.current, status }
}

export default useSocket
