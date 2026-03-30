import { useRef, useCallback } from 'react'

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
]

/**
 * useWebRTC – manages a single RTCPeerConnection instance.
 *
 * onDataChannel: called when a data channel opens (receiver side)
 * onIceCandidate: called with each new ICE candidate
 */
export function useWebRTC({ onDataChannel, onIceCandidate } = {}) {
  const pcRef = useRef(null)

  const createPeerConnection = useCallback(() => {
    if (pcRef.current) {
      pcRef.current.close()
    }

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })

    pc.onicecandidate = (event) => {
      if (event.candidate && onIceCandidate) {
        onIceCandidate(event.candidate)
      }
    }

    pc.ondatachannel = (event) => {
      if (onDataChannel) {
        onDataChannel(event.channel)
      }
    }

    pcRef.current = pc
    return pc
  }, [onDataChannel, onIceCandidate])

  const createOffer = useCallback(async () => {
    const pc = pcRef.current
    if (!pc) throw new Error('No peer connection')
    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)
    return offer
  }, [])

  const createAnswer = useCallback(async (offer) => {
    const pc = pcRef.current
    if (!pc) throw new Error('No peer connection')
    await pc.setRemoteDescription(new RTCSessionDescription(offer))
    const answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)
    return answer
  }, [])

  const setRemoteAnswer = useCallback(async (answer) => {
    const pc = pcRef.current
    if (!pc) throw new Error('No peer connection')
    await pc.setRemoteDescription(new RTCSessionDescription(answer))
  }, [])

  const addIceCandidate = useCallback(async (candidate) => {
    const pc = pcRef.current
    if (!pc) throw new Error('No peer connection')
    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate))
    } catch (err) {
      console.warn('Failed to add ICE candidate:', err)
    }
  }, [])

  const closePeerConnection = useCallback(() => {
    if (pcRef.current) {
      pcRef.current.close()
      pcRef.current = null
    }
  }, [])

  return {
    pcRef,
    createPeerConnection,
    createOffer,
    createAnswer,
    setRemoteAnswer,
    addIceCandidate,
    closePeerConnection,
  }
}
