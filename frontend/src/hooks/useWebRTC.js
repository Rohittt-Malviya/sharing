import { useCallback } from 'react';

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
];

export function useWebRTC() {

  /**
   * Create a new RTCPeerConnection and attach standard handlers.
   * @param {string} roomId - Used for logging context
   * @param {(candidate: RTCIceCandidate) => void} onIceCandidate
   * @returns {RTCPeerConnection}
   */
  const createPeerConnection = useCallback((roomId, onIceCandidate) => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        onIceCandidate(event.candidate);
      }
    };

    pc.onicecandidateerror = (event) => {
      console.warn(
        '[WebRTC] ICE candidate error:',
        event.errorCode,
        event.errorText,
        event.url,
      );
    };

    pc.onconnectionstatechange = () => {
      console.log('[WebRTC] Connection state:', pc.connectionState);
    };

    pc.oniceconnectionstatechange = () => {
      console.log('[WebRTC] ICE connection state:', pc.iceConnectionState);
    };

    return pc;
  }, []);

  /**
   * Create an SDP offer and set it as the local description.
   * @param {RTCPeerConnection} pc
   * @returns {Promise<RTCSessionDescriptionInit>}
   */
  const createOffer = useCallback(async (pc) => {
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      return offer;
    } catch (err) {
      console.error('[WebRTC] Failed to create offer:', err);
      throw err;
    }
  }, []);

  /**
   * Set the remote offer and create an SDP answer.
   * @param {RTCPeerConnection} pc
   * @param {RTCSessionDescriptionInit} offer
   * @returns {Promise<RTCSessionDescriptionInit>}
   */
  const createAnswer = useCallback(async (pc, offer) => {
    try {
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      return answer;
    } catch (err) {
      console.error('[WebRTC] Failed to create answer:', err);
      throw err;
    }
  }, []);

  /**
   * Apply the remote answer to the peer connection.
   * @param {RTCPeerConnection} pc
   * @param {RTCSessionDescriptionInit} answer
   */
  const setRemoteAnswer = useCallback(async (pc, answer) => {
    try {
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
    } catch (err) {
      console.error('[WebRTC] Failed to set remote answer:', err);
      throw err;
    }
  }, []);

  /**
   * Add a remote ICE candidate. Errors are non-fatal and only logged.
   * @param {RTCPeerConnection} pc
   * @param {RTCIceCandidateInit} candidate
   */
  const addIceCandidate = useCallback(async (pc, candidate) => {
    if (!pc || !candidate) return;
    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      // Non-fatal: log and continue
      console.warn('[WebRTC] Failed to add ICE candidate:', err);
    }
  }, []);

  return { createPeerConnection, createOffer, createAnswer, setRemoteAnswer, addIceCandidate };
}
