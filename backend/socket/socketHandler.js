/**
 * Socket.IO event handler registration.
 *
 * Separates real-time signaling concerns from the Express server setup so that
 * `server.js` stays thin and focused on HTTP/infrastructure configuration.
 *
 * @param {import('socket.io').Server} io
 * @param {typeof import('../utils/roomManager')} roomManager
 */
function registerSocketHandlers(io, roomManager) {
  io.on('connection', (socket) => {
    console.log(`[+] Connected: ${socket.id}`);

    // ─────────────────────────────────────────────
    // Sender creates a room
    // ─────────────────────────────────────────────
    socket.on('create-room', () => {
      const { roomId, shortCode } = roomManager.createRoom(socket.id);
      socket.join(roomId);
      socket.emit('room-created', { roomId, shortCode });
      console.log(`[Room] Created: ${roomId} (${shortCode}) by ${socket.id}`);
    });

    // ─────────────────────────────────────────────
    // Receiver joins a room
    // ─────────────────────────────────────────────
    socket.on('join-room', ({ roomId } = {}) => {
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
      console.log(`[Room] ${socket.id} joined room ${resolvedRoomId}`);

      // Notify sender that receiver has joined — sender should now create the offer
      const room = result.room;
      io.to(room.sender).emit('peer-joined', { roomId: resolvedRoomId });
    });

    // ─────────────────────────────────────────────
    // WebRTC Signaling relay
    // ─────────────────────────────────────────────
    socket.on('webrtc-offer', ({ offer, roomId } = {}) => {
      if (!offer || !roomId) {
        socket.emit('error', { message: 'offer and roomId are required.' });
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
      if (!answer || !roomId) {
        socket.emit('error', { message: 'answer and roomId are required.' });
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
      console.log(`[-] Disconnected: ${socket.id}`);
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
