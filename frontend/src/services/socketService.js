/**
 * Higher-level socket service.
 *
 * Wraps the low-level `socket.js` utility with domain-specific helpers that
 * components and pages can import directly, keeping socket management concerns
 * out of UI code.
 */
import { getSocket, waitForSocketConnection } from '../utils/socket'

/**
 * Emit 'create-room' and return a Promise that resolves with { roomId, shortCode }.
 * @param {number} [timeoutMs=10000]
 * @returns {Promise<{ roomId: string; shortCode: string }>}
 */
export function createRoom(timeoutMs = 10000) {
  return waitForSocketConnection().then((socket) => {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        cleanup()
        reject(new Error('Timed out waiting for room creation.'))
      }, timeoutMs)

      function onRoomCreated(data) {
        cleanup()
        resolve(data)
      }

      function onError({ message }) {
        cleanup()
        reject(new Error(message))
      }

      function cleanup() {
        clearTimeout(timer)
        socket.off('room-created', onRoomCreated)
        socket.off('error', onError)
      }

      socket.once('room-created', onRoomCreated)
      socket.once('error', onError)
      socket.emit('create-room')
    })
  }).catch((err) => {
    throw new Error('Failed to connect to server: ' + err.message)
  })
}

/**
 * Emit 'join-room' for the given roomId/shortCode.
 * Resolves after a short wait for immediate error responses from the server.
 * If the server responds with room-not-found or room-full, the promise is rejected.
 * Note: successful join is confirmed later via the webrtc-offer event on the page.
 *
 * @param {string} roomId
 * @param {number} [timeoutMs=10000]
 * @returns {Promise<void>}
 */
export function joinRoom(roomId, timeoutMs = 10000) {
  return waitForSocketConnection().then((socket) => {
    return new Promise((resolve, reject) => {
      let successTimer

      const joinTimer = setTimeout(() => {
        cleanup()
        reject(new Error('Timed out while trying to join room.'))
      }, timeoutMs)

      function onNotFound({ message }) {
        cleanup()
        reject(Object.assign(new Error(message || 'Room not found.'), { code: 'ROOM_NOT_FOUND' }))
      }

      function onFull({ message }) {
        cleanup()
        reject(Object.assign(new Error(message || 'Room is full.'), { code: 'ROOM_FULL' }))
      }

      function onError({ message }) {
        cleanup()
        reject(new Error(message))
      }

      function cleanup() {
        clearTimeout(joinTimer)
        clearTimeout(successTimer)
        socket.off('room-not-found', onNotFound)
        socket.off('room-full', onFull)
        socket.off('error', onError)
      }

      socket.once('room-not-found', onNotFound)
      socket.once('room-full', onFull)
      socket.once('error', onError)
      socket.emit('join-room', { roomId })

      // Wait briefly for immediate error responses before assuming success.
      // The server processes the join synchronously, so a round-trip error
      // will arrive well within this window under normal network conditions.
      successTimer = setTimeout(() => {
        cleanup()
        resolve()
      }, 300)
    })
  }).catch((err) => {
    throw new Error('Failed to connect to server: ' + err.message)
  })
}

/**
 * Send a WebRTC offer to the signaling server.
 * @param {RTCSessionDescriptionInit} offer
 * @param {string} roomId
 */
export function sendOffer(offer, roomId) {
  getSocket().emit('webrtc-offer', { offer, roomId })
}

/**
 * Send a WebRTC answer to the signaling server.
 * @param {RTCSessionDescriptionInit} answer
 * @param {string} roomId
 */
export function sendAnswer(answer, roomId) {
  getSocket().emit('webrtc-answer', { answer, roomId })
}

/**
 * Send an ICE candidate to the signaling server.
 * @param {RTCIceCandidateInit} candidate
 * @param {string} roomId
 */
export function sendIceCandidate(candidate, roomId) {
  getSocket().emit('ice-candidate', { candidate, roomId })
}

export default { createRoom, joinRoom, sendOffer, sendAnswer, sendIceCandidate }
