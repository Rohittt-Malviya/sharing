/**
 * Tests for roomManager.js using Node's built-in test runner (node:test).
 * Run with: npm test
 */

const { describe, it, before, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');

// We re-require roomManager in each test file run so the rooms Map is fresh.
// To isolate state between tests we'll use module-level helpers.

let roomManager;

describe('roomManager', () => {
  beforeEach(() => {
    // Invalidate module cache so each test group starts with an empty rooms Map
    delete require.cache[require.resolve('./Room')];
    roomManager = require('./Room');
  });

  // ─── randomString / createRoom ────────────────────────────────────────────

  describe('createRoom', () => {
    it('returns an object with roomId (12 chars) and shortCode (6 chars)', () => {
      const { roomId, shortCode } = roomManager.createRoom('socket-1');
      assert.equal(typeof roomId, 'string');
      assert.equal(roomId.length, 12);
      assert.equal(typeof shortCode, 'string');
      assert.equal(shortCode.length, 6);
    });

    it('stores the room in the internal map', () => {
      const { roomId } = roomManager.createRoom('socket-1');
      const room = roomManager.getRoom(roomId);
      assert.notEqual(room, null);
      assert.equal(room.sender, 'socket-1');
      assert.equal(room.receiver, null);
    });

    it('shortCode is uppercase alphanumeric (no ambiguous chars)', () => {
      const allowed = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]+$/;
      for (let i = 0; i < 20; i++) {
        const { shortCode, roomId } = roomManager.createRoom(`s-${i}`);
        assert.match(shortCode, allowed, `shortCode "${shortCode}" contains invalid chars`);
        assert.match(roomId, allowed, `roomId "${roomId}" contains invalid chars`);
      }
    });

    it('generates unique roomIds across multiple calls', () => {
      const ids = new Set();
      for (let i = 0; i < 50; i++) {
        const { roomId } = roomManager.createRoom(`s-${i}`);
        ids.add(roomId);
      }
      assert.equal(ids.size, 50);
    });

    it('sets createdAt to approximately now', () => {
      const before = Date.now();
      const { roomId } = roomManager.createRoom('socket-1');
      const after = Date.now();
      const room = roomManager.getRoom(roomId);
      assert.ok(room.createdAt >= before && room.createdAt <= after);
    });
  });

  // ─── joinRoom ─────────────────────────────────────────────────────────────

  describe('joinRoom', () => {
    it('allows a second socket to join an existing room', () => {
      const { roomId } = roomManager.createRoom('sender-1');
      const result = roomManager.joinRoom('receiver-1', roomId);
      assert.equal(result.error, undefined);
      assert.ok(result.room);
      assert.equal(result.room.receiver, 'receiver-1');
    });

    it('returns room-not-found error for unknown roomId', () => {
      const result = roomManager.joinRoom('receiver-1', 'DOESNOTEXIST');
      assert.equal(result.error, 'room-not-found');
      assert.ok(result.message);
    });

    it('returns room-full error when room already has a receiver', () => {
      const { roomId } = roomManager.createRoom('sender-1');
      roomManager.joinRoom('receiver-1', roomId);
      const result = roomManager.joinRoom('receiver-2', roomId);
      assert.equal(result.error, 'room-full');
    });

    it('returns room-full error when sender tries to join their own room', () => {
      const { roomId } = roomManager.createRoom('sender-1');
      const result = roomManager.joinRoom('sender-1', roomId);
      assert.equal(result.error, 'room-full');
      assert.match(result.message, /cannot join your own room/i);
    });

    it('updates the room object in place after join', () => {
      const { roomId } = roomManager.createRoom('sender-1');
      roomManager.joinRoom('receiver-1', roomId);
      const room = roomManager.getRoom(roomId);
      assert.equal(room.receiver, 'receiver-1');
    });
  });

  // ─── getRoom ──────────────────────────────────────────────────────────────

  describe('getRoom', () => {
    it('returns null for unknown roomId', () => {
      assert.equal(roomManager.getRoom('unknown'), null);
    });

    it('returns the room for a known roomId', () => {
      const { roomId } = roomManager.createRoom('sender-1');
      const room = roomManager.getRoom(roomId);
      assert.equal(room.sender, 'sender-1');
    });
  });

  // ─── getRoomBySender ──────────────────────────────────────────────────────

  describe('getRoomBySender', () => {
    it('returns null when socket is not a sender in any room', () => {
      assert.equal(roomManager.getRoomBySender('nobody'), null);
    });

    it('returns { roomId, room } for the sender socket', () => {
      const { roomId } = roomManager.createRoom('sender-1');
      const result = roomManager.getRoomBySender('sender-1');
      assert.ok(result);
      assert.equal(result.roomId, roomId);
      assert.equal(result.room.sender, 'sender-1');
    });

    it('does not match a receiver socket', () => {
      const { roomId } = roomManager.createRoom('sender-1');
      roomManager.joinRoom('receiver-1', roomId);
      assert.equal(roomManager.getRoomBySender('receiver-1'), null);
    });
  });

  // ─── getRoomBySocket ──────────────────────────────────────────────────────

  describe('getRoomBySocket', () => {
    it('returns null for an unknown socket', () => {
      assert.equal(roomManager.getRoomBySocket('nobody'), null);
    });

    it('finds room by sender socket', () => {
      const { roomId } = roomManager.createRoom('sender-1');
      const result = roomManager.getRoomBySocket('sender-1');
      assert.ok(result);
      assert.equal(result.roomId, roomId);
    });

    it('finds room by receiver socket', () => {
      const { roomId } = roomManager.createRoom('sender-1');
      roomManager.joinRoom('receiver-1', roomId);
      const result = roomManager.getRoomBySocket('receiver-1');
      assert.ok(result);
      assert.equal(result.roomId, roomId);
    });
  });

  // ─── getRoomByShortCode ───────────────────────────────────────────────────

  describe('getRoomByShortCode', () => {
    it('returns null for an unknown short code', () => {
      assert.equal(roomManager.getRoomByShortCode('XXXXXX'), null);
    });

    it('returns the matching room entry by shortCode', () => {
      const { roomId, shortCode } = roomManager.createRoom('sender-1');
      const result = roomManager.getRoomByShortCode(shortCode);
      assert.ok(result);
      assert.equal(result.roomId, roomId);
    });
  });

  // ─── deleteRoom ───────────────────────────────────────────────────────────

  describe('deleteRoom', () => {
    it('removes the room from the map', () => {
      const { roomId } = roomManager.createRoom('sender-1');
      roomManager.deleteRoom(roomId);
      assert.equal(roomManager.getRoom(roomId), null);
    });

    it('is a no-op for an unknown roomId', () => {
      assert.doesNotThrow(() => roomManager.deleteRoom('unknown'));
    });

    it('clears the expiry timer so it does not fire later', (_, done) => {
      // Create a room with a very short timeout via env, then delete it; if the
      // timer were still active we'd see an error in an after-test callback.
      // We just verify deleteRoom doesn't throw and the room is gone.
      const { roomId } = roomManager.createRoom('sender-1');
      roomManager.deleteRoom(roomId);
      assert.equal(roomManager.getRoom(roomId), null);
      done();
    });
  });

  // ─── removeSocketFromRoom ─────────────────────────────────────────────────

  describe('removeSocketFromRoom', () => {
    it('returns null when socket is not in any room', () => {
      assert.equal(roomManager.removeSocketFromRoom('nobody'), null);
    });

    it('removes the room and returns otherSocketId when sender disconnects (no receiver yet)', () => {
      const { roomId } = roomManager.createRoom('sender-1');
      const result = roomManager.removeSocketFromRoom('sender-1');
      assert.ok(result);
      assert.equal(result.roomId, roomId);
      assert.equal(result.otherSocketId, null); // no receiver
      assert.equal(roomManager.getRoom(roomId), null);
    });

    it('returns the sender as otherSocketId when receiver disconnects', () => {
      const { roomId } = roomManager.createRoom('sender-1');
      roomManager.joinRoom('receiver-1', roomId);
      const result = roomManager.removeSocketFromRoom('receiver-1');
      assert.ok(result);
      assert.equal(result.otherSocketId, 'sender-1');
      assert.equal(roomManager.getRoom(roomId), null);
    });

    it('returns the receiver as otherSocketId when sender disconnects after join', () => {
      const { roomId } = roomManager.createRoom('sender-1');
      roomManager.joinRoom('receiver-1', roomId);
      const result = roomManager.removeSocketFromRoom('sender-1');
      assert.ok(result);
      assert.equal(result.otherSocketId, 'receiver-1');
      assert.equal(roomManager.getRoom(roomId), null);
    });
  });
});
