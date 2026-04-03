import { io } from 'socket.io-client';

const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL ||
  import.meta.env.VITE_BACKEND_URL ||
  'http://localhost:4000';

let socket = null;

/**
 * Returns the singleton socket instance, creating and connecting it if needed.
 * Reuses the existing connection if already connected.
 */
export function getSocket() {
  if (socket && socket.connected) {
    return socket;
  }

  if (socket) {
    // Socket exists but not connected — reconnect
    socket.connect();
    return socket;
  }

  socket = io(SOCKET_URL, {
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 20000,
    transports: ['websocket', 'polling'],
  });

  socket.on('connect', () => {
    if (import.meta.env.DEV) console.log('[Socket] Connected:', socket.id);
  });

  socket.on('disconnect', (reason) => {
    if (import.meta.env.DEV) console.log('[Socket] Disconnected:', reason);
  });

  socket.on('connect_error', (err) => {
    console.error('[Socket] Connection error:', err.message);
  });

  return socket;
}

/**
 * Wait for the socket to be connected, with an optional timeout.
 * @param {number} timeoutMs - Timeout in milliseconds (default: 5000)
 * @returns {Promise<import('socket.io-client').Socket>}
 */
export function waitForSocketConnection(timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const sock = getSocket();

    if (sock.connected) {
      resolve(sock);
      return;
    }

    const timer = setTimeout(() => {
      sock.off('connect', onConnect);
      reject(new Error('Socket connection timeout'));
    }, timeoutMs);

    const onConnect = () => {
      clearTimeout(timer);
      resolve(sock);
    };

    sock.once('connect', onConnect);
  });
}

export default getSocket;
