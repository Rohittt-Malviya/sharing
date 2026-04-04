/**
 * SignalingController – handles WebRTC offer/answer/ICE socket events.
 *
 * Each handler is a pure function that receives the socket, validated payload,
 * and shared dependencies, making them easy to test in isolation.
 */
const { isValidSdp, isValidIceCandidate } = require('../utils/validators');

/**
 * Handle 'webrtc-offer' event.
 *
 * @param {import('socket.io').Socket} socket
 * @param {{ offer?: object; roomId?: string }} payload
 * @param {import('socket.io').Server} io
 * @param {typeof import('../utils/roomManager')} roomManager
 * @param {typeof import('../utils/logger')} logger
 */
function handleOffer(socket, payload, io, roomManager, logger) {
  const { offer, roomId } = payload || {};

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

  logger.debug(`[Signaling] Relaying offer from ${socket.id} to ${room.receiver}`);
  io.to(room.receiver).emit('webrtc-offer', { offer, roomId });
}

/**
 * Handle 'webrtc-answer' event.
 *
 * @param {import('socket.io').Socket} socket
 * @param {{ answer?: object; roomId?: string }} payload
 * @param {import('socket.io').Server} io
 * @param {typeof import('../utils/roomManager')} roomManager
 * @param {typeof import('../utils/logger')} logger
 */
function handleAnswer(socket, payload, io, roomManager, logger) {
  const { answer, roomId } = payload || {};

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

  logger.debug(`[Signaling] Relaying answer from ${socket.id} to ${room.sender}`);
  io.to(room.sender).emit('webrtc-answer', { answer, roomId });
}

/**
 * Handle 'ice-candidate' event.
 * Errors are intentionally silenced — a dropped candidate is non-fatal.
 *
 * @param {import('socket.io').Socket} socket
 * @param {{ candidate?: object|null; roomId?: string }} payload
 * @param {import('socket.io').Server} io
 * @param {typeof import('../utils/roomManager')} roomManager
 */
function handleIceCandidate(socket, payload, io, roomManager) {
  const { candidate, roomId } = payload || {};
  if (!roomId) return;
  if (!isValidIceCandidate(candidate)) return; // silently drop invalid

  const room = roomManager.getRoom(roomId);
  if (!room) return;

  const targetId = room.sender === socket.id ? room.receiver : room.sender;
  if (targetId) {
    io.to(targetId).emit('ice-candidate', { candidate, roomId });
  }
}

module.exports = { handleOffer, handleAnswer, handleIceCandidate };
