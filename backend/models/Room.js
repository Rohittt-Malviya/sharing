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

const crypto = require('crypto');

const ROOM_TIMEOUT_MS = parseInt(process.env.ROOM_TIMEOUT_MS || '300000', 10); // 5 min
const MAX_ROOMS = parseInt(process.env.MAX_ROOMS || '10000', 10);

const rooms = new Map(); // roomId → { sender, receiver, shortCode, createdAt, timer }

// Reverse-index maps for O(1) lookups — kept in sync with `rooms` at all times.
const shortCodeToRoomId = new Map(); // shortCode → roomId  (replaces the old shortCodes Set)
const socketToRoomId = new Map();    // socketId  → roomId  (covers both sender and receiver)

/**
 * Generate a cryptographically random alphanumeric string of given length.
 * Uses only unambiguous characters (no 0/O, 1/I/L).
 *
 * All 32 characters means a single byte masked with 0x1f (31) covers the
 * full alphabet with no modulo bias (256 / 32 = 8 exactly).  One call to
 * crypto.randomBytes() is used for the whole string instead of `len`
 * separate crypto.randomInt() calls.
 */
function randomString(len) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // exactly 32 chars
  const bytes = crypto.randomBytes(len);
  let out = '';
  for (let i = 0; i < len; i++) {
    out += chars[bytes[i] & 0x1f]; // 0x1f = 31 → maps [0,255] to [0,31], unbiased
  }
  return out;
}

/** Generate a roomId that does not collide with any existing room */
function uniqueRoomId() {
  let id;
  do { id = randomString(12); } while (rooms.has(id));
  return id;
}

/** Generate a short code that does not collide with any active room */
function uniqueShortCode() {
  let code;
  do { code = randomString(6); } while (shortCodeToRoomId.has(code));
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
    // Clean up all three maps on expiry.
    shortCodeToRoomId.delete(shortCode);
    const r = rooms.get(roomId);
    if (r) {
      socketToRoomId.delete(r.sender);
      if (r.receiver) socketToRoomId.delete(r.receiver);
    }
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

  // Maintain reverse indices
  shortCodeToRoomId.set(shortCode, roomId);
  socketToRoomId.set(senderSocketId, roomId);

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
  socketToRoomId.set(receiverSocketId, roomId); // maintain reverse index
  return { room };
}

function getRoom(roomId) {
  return rooms.get(roomId) || null;
}

/**
 * O(1) lookup via the socketToRoomId index, then verify sender role.
 */
function getRoomBySender(socketId) {
  const roomId = socketToRoomId.get(socketId);
  if (!roomId) return null;
  const room = rooms.get(roomId);
  if (!room || room.sender !== socketId) return null;
  return { roomId, room };
}

/**
 * O(1) lookup via the socketToRoomId index (covers both sender and receiver).
 */
function getRoomBySocket(socketId) {
  const roomId = socketToRoomId.get(socketId);
  if (!roomId) return null;
  const room = rooms.get(roomId);
  if (!room) return null;
  return { roomId, room };
}

/**
 * O(1) lookup via the shortCodeToRoomId index.
 */
function getRoomByShortCode(shortCode) {
  if (!shortCode || typeof shortCode !== 'string') return null;
  const normalised = shortCode.trim().toUpperCase();
  const roomId = shortCodeToRoomId.get(normalised);
  if (!roomId) return null;
  const room = rooms.get(roomId);
  if (!room) return null;
  return { roomId, room };
}

function deleteRoom(roomId) {
  const room = rooms.get(roomId);
  if (room) {
    clearTimeout(room.timer);
    // Clean up all three maps atomically
    shortCodeToRoomId.delete(room.shortCode);
    socketToRoomId.delete(room.sender);
    if (room.receiver) socketToRoomId.delete(room.receiver);
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
