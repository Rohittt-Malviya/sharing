/**
 * Socket.IO event handler registration.
 *
 * Separates real-time signaling concerns from the Express server setup so that
 * `server.js` stays thin and focused on HTTP/infrastructure configuration.
 *
 * @param {import('socket.io').Server} io
 * @param {typeof import('../utils/roomManager')} roomManager
 */

const isDev = process.env.NODE_ENV !== 'production';

// ── Simple per-socket rate limiter ───────────────────────────────────────────

const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMITS = {
  'create-room': 10,
  'join-room': 20,
  'webrtc-offer': 20,
  'webrtc-answer': 20,
  'ice-candidate': 200,
};

/** @type {Map<string, Record<string, { count: number; resetAt: number }>>} */
const socketRateLimits = new Map();

/**
 * Returns true if the event is within the allowed rate, false if it should be rejected.
 * @param {string} socketId
 * @param {string} eventName
 * @returns {boolean}
 */
function checkRateLimit(socketId, eventName) {
  const max = RATE_LIMITS[eventName];
  if (!max) return true; // no limit defined for this event

  const now = Date.now();
  if (!socketRateLimits.has(socketId)) {
    socketRateLimits.set(socketId, {});
  }
  const limits = socketRateLimits.get(socketId);

  if (!limits[eventName] || now > limits[eventName].resetAt) {
    limits[eventName] = { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS };
    return true;
  }

  limits[eventName].count += 1;
  return limits[eventName].count <= max;
}

// ── SDP / ICE validation helpers ─────────────────────────────────────────────

function isValidSdp(sdp) {
  return (
    sdp !== null &&
    typeof sdp === 'object' &&
    typeof sdp.type === 'string' &&
    typeof sdp.sdp === 'string'
  );
}

function registerSocketHandlers(io, roomManager) {
  io.on('connection', (socket) => {
    if (isDev) console.log(`[+] Connected: ${socket.id}`);

    // ─────────────────────────────────────────────
    // Sender creates a room
    // ─────────────────────────────────────────────
    socket.on('create-room', () => {
      if (!checkRateLimit(socket.id, 'create-room')) {
        socket.emit('error', { message: 'Too many requests. Please slow down.' });
        return;
      }
      try {
        const { roomId, shortCode } = roomManager.createRoom(socket.id);
        socket.join(roomId);
        socket.emit('room-created', { roomId, shortCode });
        if (isDev) console.log(`[Room] Created: ${roomId} (${shortCode}) by ${socket.id}`);
      } catch (err) {
        socket.emit('error', { message: err.message });
      }
    });

    // ─────────────────────────────────────────────
    // Receiver joins a room
    // ─────────────────────────────────────────────
    socket.on('join-room', ({ roomId } = {}) => {
      if (!checkRateLimit(socket.id, 'join-room')) {
        socket.emit('error', { message: 'Too many requests. Please slow down.' });
        return;
      }
      if (!roomId || typeof roomId !== 'string' || !roomId.trim()) {
        socket.emit('error', { message: 'roomId is required.' });
        return;
      }

      const normalised = roomId.trim();

      // Support 6-char short codes: resolve to full roomId
      let resolvedRoomId = normalised;
      if (normalised.length !== 12) {
        const found = roomManager.getRoomByShortCode(normalised.toUpperCase());
        if (!found) {
          socket.emit('room-not-found', { message: 'Room not found or has expired.' });
          return;
        }
        resolvedRoomId = found.roomId;
      }

      const result = roomManager.joinRoom(socket.id, resolvedRoomId);

      if (result.error === 'room-not-found') {
        socket.emit('room-not-found', { message: result.message });
        return;
      }
      if (result.error === 'room-full') {
        socket.emit('room-full', { message: result.message });
        return;
      }

      socket.join(resolvedRoomId);
      if (isDev) console.log(`[Room] ${socket.id} joined room ${resolvedRoomId}`);

      // Notify sender that receiver has joined — sender should now create the offer
      const room = result.room;
      io.to(room.sender).emit('peer-joined', { roomId: resolvedRoomId });
    });

    // ─────────────────────────────────────────────
    // WebRTC Signaling relay
    // ─────────────────────────────────────────────
    socket.on('webrtc-offer', ({ offer, roomId } = {}) => {
      if (!checkRateLimit(socket.id, 'webrtc-offer')) {
        socket.emit('error', { message: 'Too many requests. Please slow down.' });
        return;
      }
      if (!roomId || typeof roomId !== 'string') {
        socket.emit('error', { message: 'offer and roomId are required.' });
        return;
      }
      if (!isValidSdp(offer)) {
        socket.emit('error', { message: 'Invalid offer format.' });
        return;
      }
      const room = roomManager.getRoom(roomId);
      if (!room || !room.receiver) {
        socket.emit('error', { message: 'Room not ready for offer.' });
        return;
      }
      io.to(room.receiver).emit('webrtc-offer', { offer, roomId });
    });

    socket.on('webrtc-answer', ({ answer, roomId } = {}) => {
      if (!checkRateLimit(socket.id, 'webrtc-answer')) {
        socket.emit('error', { message: 'Too many requests. Please slow down.' });
        return;
      }
      if (!roomId || typeof roomId !== 'string') {
        socket.emit('error', { message: 'answer and roomId are required.' });
        return;
      }
      if (!isValidSdp(answer)) {
        socket.emit('error', { message: 'Invalid answer format.' });
        return;
      }
      const room = roomManager.getRoom(roomId);
      if (!room) {
        socket.emit('error', { message: 'Room not found.' });
        return;
      }
      io.to(room.sender).emit('webrtc-answer', { answer, roomId });
    });

    socket.on('ice-candidate', ({ candidate, roomId } = {}) => {
      if (!checkRateLimit(socket.id, 'ice-candidate')) return; // silently drop
      if (!roomId) return;
      const room = roomManager.getRoom(roomId);
      if (!room) return;
      const targetId = room.sender === socket.id ? room.receiver : room.sender;
      if (targetId) io.to(targetId).emit('ice-candidate', { candidate, roomId });
    });

    // ─────────────────────────────────────────────
    // Disconnect / cleanup
    // ─────────────────────────────────────────────
    socket.on('disconnect', () => {
      if (isDev) console.log(`[-] Disconnected: ${socket.id}`);
      socketRateLimits.delete(socket.id);
      const removed = roomManager.removeSocketFromRoom(socket.id);
      if (removed && removed.otherSocketId) {
        io.to(removed.otherSocketId).emit('peer-disconnected', {
          message: 'The other peer has disconnected.',
        });
      }
    });
  });
}

module.exports = { registerSocketHandlers };
