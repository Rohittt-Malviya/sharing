/**
 * RoomController – handles room lifecycle socket events.
 *
 * Extracted from socketHandler so the handler file stays thin and each
 * concern lives in its own module.
 *
 * @param {import('socket.io').Server} io
 * @param {typeof import('../utils/roomManager')} roomManager
 * @param {typeof import('../utils/logger')} logger
 */

/**
 * Handle 'create-room' socket event.
 *
 * @param {import('socket.io').Socket} socket
 * @param {import('socket.io').Server} io
 * @param {typeof import('../utils/roomManager')} roomManager
 * @param {typeof import('../utils/logger')} logger
 */
function handleCreateRoom(socket, io, roomManager, logger) {
  try {
    const { roomId, shortCode } = roomManager.createRoom(socket.id);
    socket.join(roomId);
    socket.emit('room-created', { roomId, shortCode });
    logger.debug(`[Room] Created: ${roomId} (${shortCode}) by ${socket.id}`);
  } catch (err) {
    logger.error(`[Room] create-room error for ${socket.id}: ${err.message}`);
    socket.emit('error', { message: err.message });
  }
}

/**
 * Handle 'join-room' socket event.
 *
 * @param {import('socket.io').Socket} socket
 * @param {{ roomId?: string }} payload
 * @param {import('socket.io').Server} io
 * @param {typeof import('../utils/roomManager')} roomManager
 * @param {typeof import('../utils/logger')} logger
 */
function handleJoinRoom(socket, payload, io, roomManager, logger) {
  const { roomId } = payload || {};

  if (!roomId || typeof roomId !== 'string' || !roomId.trim()) {
    socket.emit('error', { message: 'roomId is required.' });
    return;
  }

  const normalised = roomId.trim();

  // Support 6-char short codes: resolve to full roomId
  let resolvedRoomId = normalised;
  if (normalised.length === 6) {
    const found = roomManager.getRoomByShortCode(normalised.toUpperCase());
    if (!found) {
      socket.emit('room-not-found', { message: 'Room not found or has expired.' });
      return;
    }
    resolvedRoomId = found.roomId;
  } else if (normalised.length !== 12) {
    socket.emit('room-not-found', { message: 'Room not found or has expired.' });
    return;
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
  if (result.error) {
    socket.emit('error', { message: result.message });
    return;
  }

  socket.join(resolvedRoomId);
  logger.debug(`[Room] ${socket.id} joined room ${resolvedRoomId}`);

  // Notify sender that receiver has joined — sender should now create the offer
  io.to(result.room.sender).emit('peer-joined', { roomId: resolvedRoomId });
}

module.exports = { handleCreateRoom, handleJoinRoom };
