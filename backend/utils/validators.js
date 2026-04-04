/**
 * Reusable input validation helpers for socket events and HTTP requests.
 *
 * All functions are pure and throw no exceptions — they simply return booleans
 * so callers decide how to handle invalid input.
 */

/**
 * Returns true if `value` is a non-empty string (after trimming).
 * @param {unknown} value
 * @returns {boolean}
 */
function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Returns true if `sdp` has the shape expected by WebRTC (type + sdp strings).
 * @param {unknown} sdp
 * @returns {boolean}
 */
function isValidSdp(sdp) {
  return (
    sdp !== null &&
    typeof sdp === 'object' &&
    typeof sdp.type === 'string' &&
    typeof sdp.sdp === 'string' &&
    sdp.sdp.length > 0
  );
}

/**
 * Returns true if `roomId` could be a valid room identifier.
 * Accepts both 12-char full IDs and 6-char short codes.
 * @param {unknown} roomId
 * @returns {boolean}
 */
function isValidRoomId(roomId) {
  if (!isNonEmptyString(roomId)) return false;
  const len = roomId.trim().length;
  return len >= 6 && len <= 12;
}

/**
 * Returns true if `candidate` looks like a valid ICE candidate object.
 * A null candidate is valid (end-of-candidates signal).
 * @param {unknown} candidate
 * @returns {boolean}
 */
function isValidIceCandidate(candidate) {
  if (candidate === null) return true; // null === end-of-candidates
  return (
    candidate !== null &&
    typeof candidate === 'object' &&
    typeof candidate.candidate === 'string'
  );
}

module.exports = { isNonEmptyString, isValidSdp, isValidRoomId, isValidIceCandidate };
