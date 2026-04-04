/**
 * Room model.
 *
 * Encapsulates the state and business rules for a single signaling room.
 * A room holds exactly two peers: a sender and (optionally) a receiver.
 */
class Room {
  /**
   * @param {object} params
   * @param {string} params.roomId   - Unique 12-character room identifier
   * @param {string} params.shortCode - Human-friendly 6-character code
   * @param {string} params.sender   - Socket ID of the sender (room creator)
   */
  constructor({ roomId, shortCode, sender }) {
    if (!roomId || !shortCode || !sender) {
      throw new TypeError('Room requires roomId, shortCode, and sender');
    }
    /** @type {string} */
    this.roomId = roomId;
    /** @type {string} */
    this.shortCode = shortCode;
    /** @type {string} */
    this.sender = sender;
    /** @type {string|null} */
    this.receiver = null;
    /** @type {number} */
    this.createdAt = Date.now();
    /** @type {ReturnType<typeof setTimeout>|null} */
    this.timer = null;
  }

  /** True when both sender and receiver are present. */
  isFull() {
    return this.receiver !== null;
  }

  /**
   * Assign a receiver to this room.
   * @param {string} receiverSocketId
   * @throws {Error} if the room is already full or the socket is the sender
   */
  addReceiver(receiverSocketId) {
    if (this.isFull()) {
      throw new Error('Room already has two peers.');
    }
    if (this.sender === receiverSocketId) {
      throw new Error('You cannot join your own room as a receiver.');
    }
    this.receiver = receiverSocketId;
  }

  /**
   * Returns true if the given socketId is a member of this room.
   * @param {string} socketId
   * @returns {boolean}
   */
  hasSocket(socketId) {
    return this.sender === socketId || this.receiver === socketId;
  }

  /**
   * Returns the socket ID of the *other* peer (or null if not present).
   * @param {string} socketId
   * @returns {string|null}
   */
  getOtherPeer(socketId) {
    if (this.sender === socketId) return this.receiver;
    if (this.receiver === socketId) return this.sender;
    return null;
  }

  /** Plain object representation (safe to serialise / log). */
  toJSON() {
    return {
      roomId: this.roomId,
      shortCode: this.shortCode,
      sender: this.sender,
      receiver: this.receiver,
      createdAt: this.createdAt,
    };
  }
}

module.exports = Room;
