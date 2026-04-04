/**
 * WebRTC service.
 *
 * Provides factory helpers for creating RTCPeerConnections and handling SDP
 * negotiation. These are intentionally stateless functions (no React hooks)
 * so they can be called from both React components and plain JS modules.
 */

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
]

/**
 * Create a new RTCPeerConnection with standard ICE servers and optional
 * callbacks for common events.
 *
 * @param {object} [options]
 * @param {(candidate: RTCIceCandidate) => void} [options.onIceCandidate]
 * @param {(state: RTCPeerConnectionState) => void} [options.onConnectionStateChange]
 * @returns {RTCPeerConnection}
 */
export function createPeerConnection({ onIceCandidate, onConnectionStateChange } = {}) {
  const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })

  pc.onicecandidate = (event) => {
    if (event.candidate && onIceCandidate) {
      onIceCandidate(event.candidate)
    }
  }

  pc.onicecandidateerror = (event) => {
    if (import.meta.env.DEV) {
      console.warn('[WebRTC] ICE candidate error:', event.errorCode, event.errorText)
    }
  }

  pc.onconnectionstatechange = () => {
    if (import.meta.env.DEV) {
      console.log('[WebRTC] Connection state:', pc.connectionState)
    }
    if (onConnectionStateChange) {
      onConnectionStateChange(pc.connectionState)
    }
  }

  pc.oniceconnectionstatechange = () => {
    if (import.meta.env.DEV) {
      console.log('[WebRTC] ICE connection state:', pc.iceConnectionState)
    }
  }

  return pc
}

/**
 * Create an SDP offer and set it as the local description.
 * @param {RTCPeerConnection} pc
 * @returns {Promise<RTCSessionDescriptionInit>}
 */
export async function createOffer(pc) {
  const offer = await pc.createOffer()
  await pc.setLocalDescription(offer)
  return offer
}

/**
 * Set the remote offer and create a local SDP answer.
 * @param {RTCPeerConnection} pc
 * @param {RTCSessionDescriptionInit} offer
 * @returns {Promise<RTCSessionDescriptionInit>}
 */
export async function createAnswer(pc, offer) {
  await pc.setRemoteDescription(offer)
  const answer = await pc.createAnswer()
  await pc.setLocalDescription(answer)
  return answer
}

/**
 * Apply the remote SDP answer.
 * @param {RTCPeerConnection} pc
 * @param {RTCSessionDescriptionInit} answer
 */
export async function setRemoteAnswer(pc, answer) {
  await pc.setRemoteDescription(answer)
}

/**
 * Safely add a remote ICE candidate. Errors are non-fatal and only warned.
 * @param {RTCPeerConnection} pc
 * @param {RTCIceCandidateInit|null} candidate
 */
export async function addIceCandidate(pc, candidate) {
  if (!pc || !candidate) return
  try {
    await pc.addIceCandidate(candidate)
  } catch (err) {
    console.warn('[WebRTC] Failed to add ICE candidate:', err)
  }
}

export default { createPeerConnection, createOffer, createAnswer, setRemoteAnswer, addIceCandidate }
