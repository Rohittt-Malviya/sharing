/**
 * Socket.IO event handler registration.
 *
 * Separates real-time signaling concerns from the Express server setup so that
 * `server.js` stays thin and focused on HTTP/infrastructure configuration.
 *
 * Business logic is delegated to the dedicated controllers:
 *  - RoomController   – room lifecycle (create / join)
 *  - SignalingController – WebRTC signaling relay (offer / answer / ICE)
 *
 * @param {import('socket.io').Server} io
 * @param {typeof import('../utils/roomManager')} roomManager
 */

const logger = require('../utils/logger');
const { handleCreateRoom, handleJoinRoom } = require('../controllers/RoomController');
const { handleOffer, handleAnswer, handleIceCandidate } = require('../controllers/SignalingController');

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

// ── Handler registration ──────────────────────────────────────────────────────

function registerSocketHandlers(io, roomManager) {
  io.on('connection', (socket) => {
    logger.debug(`[+] Connected: ${socket.id}`);

    // ─────────────────────────────────────────────
    // Sender creates a room
    // ─────────────────────────────────────────────
    socket.on('create-room', () => {
      if (!checkRateLimit(socket.id, 'create-room')) {
        socket.emit('error', { message: 'Too many requests. Please slow down.' });
        return;
      }
      handleCreateRoom(socket, io, roomManager, logger);
    });

    // ─────────────────────────────────────────────
    // Receiver joins a room
    // ─────────────────────────────────────────────
    socket.on('join-room', (payload = {}) => {
      if (!checkRateLimit(socket.id, 'join-room')) {
        socket.emit('error', { message: 'Too many requests. Please slow down.' });
        return;
      }
      handleJoinRoom(socket, payload, io, roomManager, logger);
    });

    // ─────────────────────────────────────────────
    // WebRTC Signaling relay
    // ─────────────────────────────────────────────
    socket.on('webrtc-offer', (payload = {}) => {
      if (!checkRateLimit(socket.id, 'webrtc-offer')) {
        socket.emit('error', { message: 'Too many requests. Please slow down.' });
        return;
      }
      handleOffer(socket, payload, io, roomManager, logger);
    });

    socket.on('webrtc-answer', (payload = {}) => {
      if (!checkRateLimit(socket.id, 'webrtc-answer')) {
        socket.emit('error', { message: 'Too many requests. Please slow down.' });
        return;
      }
      handleAnswer(socket, payload, io, roomManager, logger);
    });

    socket.on('ice-candidate', (payload = {}) => {
      if (!checkRateLimit(socket.id, 'ice-candidate')) return; // silently drop
      handleIceCandidate(socket, payload, io, roomManager);
    });

    // ─────────────────────────────────────────────
    // Disconnect / cleanup
    // ─────────────────────────────────────────────
    socket.on('disconnect', () => {
      logger.debug(`[-] Disconnected: ${socket.id}`);
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
