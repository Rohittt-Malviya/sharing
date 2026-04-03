require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const roomManager = require('./utils/roomManager');

const PORT = process.env.PORT || 4000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

const app = express();
app.use(cors({ origin: FRONTEND_URL, methods: ['GET', 'POST'] }));
app.use(express.json());

// Health check endpoint
app.get('/health', (_req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: FRONTEND_URL, methods: ['GET', 'POST'] },
  maxHttpBufferSize: 1e8, // 100 MB (not used for file data, just signaling)
});

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
    if (!roomId) {
      socket.emit('error', { message: 'roomId is required.' });
      return;
    }

    // Support 6-char short codes: resolve to full roomId
    let resolvedRoomId = roomId;
    if (typeof roomId === 'string' && roomId.length !== 12) {
      const found = roomManager.getRoomByShortCode(roomId.toUpperCase());
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

    // Notify sender that receiver has joined – sender should now create offer
    const room = result.room;
    io.to(room.sender).emit('peer-joined', { roomId: resolvedRoomId });
  });

  // ─────────────────────────────────────────────
  // WebRTC Signaling relay
  // ─────────────────────────────────────────────
  socket.on('webrtc-offer', ({ offer, roomId } = {}) => {
    const room = roomManager.getRoom(roomId);
    if (!room || !room.receiver) {
      socket.emit('error', { message: 'Room not ready for offer.' });
      return;
    }
    io.to(room.receiver).emit('webrtc-offer', { offer, roomId });
  });

  socket.on('webrtc-answer', ({ answer, roomId } = {}) => {
    const room = roomManager.getRoom(roomId);
    if (!room) {
      socket.emit('error', { message: 'Room not found.' });
      return;
    }
    io.to(room.sender).emit('webrtc-answer', { answer, roomId });
  });

  socket.on('ice-candidate', ({ candidate, roomId } = {}) => {
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

server.listen(PORT, () => {
  console.log(`\n🚀 Server running on http://localhost:${PORT}`);
  console.log(`   Accepting connections from: ${FRONTEND_URL}\n`);
});
