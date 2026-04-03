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
const MAX_ROOMS = parseInt(process.env.MAX_ROOMS || '10000', 10);

const rooms = new Map(); // roomId → { sender, receiver, shortCode, createdAt, timer }
const shortCodes = new Set(); // active short codes for O(1) collision detection

/** Generate a random alphanumeric string of given length */
function randomString(len) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < len; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

/** Generate a roomId that does not collide with any existing room */
function uniqueRoomId() {
  let id;
  do { id = randomString(12); } while (rooms.has(id));
  return id;
}

/** Generate a short code (always uppercase) that does not collide with any active room */
function uniqueShortCode() {
  let code;
  do { code = randomString(6).toUpperCase(); } while (shortCodes.has(code));
  return code;
}

function createRoom(senderSocketId) {
  if (!senderSocketId || typeof senderSocketId !== 'string') {
    throw new TypeError('senderSocketId must be a non-empty string');
  }
  if (rooms.size >= MAX_ROOMS) {
    throw new Error('Server is at room capacity. Please try again later.');
  }

  const roomId = uniqueRoomId();
  const shortCode = uniqueShortCode();

  const timer = setTimeout(() => {
    shortCodes.delete(shortCode);
    rooms.delete(roomId);
  }, ROOM_TIMEOUT_MS);

  // Allow the timer to be garbage-collected without blocking Node.js shutdown
  if (typeof timer.unref === 'function') timer.unref();

  rooms.set(roomId, {
    sender: senderSocketId,
    receiver: null,
    shortCode,
    createdAt: Date.now(),
    timer,
  });
  shortCodes.add(shortCode);

  return { roomId, shortCode };
}

function joinRoom(receiverSocketId, roomId) {
  if (!receiverSocketId || typeof receiverSocketId !== 'string') {
    return { error: 'invalid-input', message: 'receiverSocketId must be a non-empty string.' };
  }
  if (!roomId || typeof roomId !== 'string') {
    return { error: 'invalid-input', message: 'roomId must be a non-empty string.' };
  }

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

function getRoomByShortCode(shortCode) {
  if (!shortCode || typeof shortCode !== 'string') return null;
  const normalised = shortCode.trim().toUpperCase();
  for (const [roomId, room] of rooms.entries()) {
    if (room.shortCode === normalised) return { roomId, room };
  }
  return null;
}

function deleteRoom(roomId) {
  const room = rooms.get(roomId);
  if (room) {
    clearTimeout(room.timer);
    shortCodes.delete(room.shortCode);
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
  getRoomByShortCode,
  deleteRoom,
  removeSocketFromRoom,
};
