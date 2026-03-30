/**
 * Room Manager – in-memory room state.
 *
 * A room holds exactly 2 peers:
 *  { sender: socketId, receiver: socketId | null, shortCode, createdAt }
 *
 * Event contract (must match frontend exactly):
 *  create-room          → sender creates room          payload: {}
 *  room-created         → backend → sender             payload: { roomId, shortCode }
 *  join-room            → receiver joins               payload: { roomId }
 *  room-not-found       → backend → receiver           payload: { message }
 *  room-full            → backend → receiver           payload: { message }
 *  peer-joined          → backend → sender             payload: { roomId }
 *  webrtc-offer         → sender → backend → receiver  payload: { offer, roomId }
 *  webrtc-answer        → receiver → backend → sender  payload: { answer, roomId }
 *  ice-candidate        → both → backend → other peer  payload: { candidate, roomId }
 *  peer-disconnected    → backend → remaining peer     payload: { message }
 *  error                → backend → requester          payload: { message }
 */

const ROOM_TIMEOUT_MS = parseInt(process.env.ROOM_TIMEOUT_MS || '300000', 10); // 5 min

const rooms = new Map(); // roomId → { sender, receiver, shortCode, createdAt, timer }

/** Generate a random alphanumeric string of given length */
function randomString(len) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < len; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

function createRoom(senderSocketId) {
  const roomId = randomString(12);
  const shortCode = randomString(6);

  const timer = setTimeout(() => {
    rooms.delete(roomId);
  }, ROOM_TIMEOUT_MS);

  rooms.set(roomId, {
    sender: senderSocketId,
    receiver: null,
    shortCode,
    createdAt: Date.now(),
    timer,
  });

  return { roomId, shortCode };
}

function joinRoom(receiverSocketId, roomId) {
  const room = rooms.get(roomId);
  if (!room) return { error: 'room-not-found', message: 'Room not found or has expired.' };
  if (room.receiver) return { error: 'room-full', message: 'Room already has two peers.' };
  if (room.sender === receiverSocketId) return { error: 'room-full', message: 'You cannot join your own room as a receiver.' };

  room.receiver = receiverSocketId;
  return { room };
}

function getRoom(roomId) {
  return rooms.get(roomId) || null;
}

function getRoomBySender(socketId) {
  for (const [roomId, room] of rooms.entries()) {
    if (room.sender === socketId) return { roomId, room };
  }
  return null;
}

function getRoomBySocket(socketId) {
  for (const [roomId, room] of rooms.entries()) {
    if (room.sender === socketId || room.receiver === socketId) return { roomId, room };
  }
  return null;
}

function deleteRoom(roomId) {
  const room = rooms.get(roomId);
  if (room) {
    clearTimeout(room.timer);
    rooms.delete(roomId);
  }
}

function removeSocketFromRoom(socketId) {
  const entry = getRoomBySocket(socketId);
  if (!entry) return null;
  const { roomId, room } = entry;
  const otherSocketId = room.sender === socketId ? room.receiver : room.sender;
  deleteRoom(roomId);
  return { roomId, otherSocketId };
}

module.exports = {
  createRoom,
  joinRoom,
  getRoom,
  getRoomBySender,
  getRoomBySocket,
  deleteRoom,
  removeSocketFromRoom,
};
