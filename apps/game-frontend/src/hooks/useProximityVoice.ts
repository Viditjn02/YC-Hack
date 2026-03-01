'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useWorldStore } from '@/stores/worldStore';
import { useVoiceChatStore } from '@/stores/voiceChatStore';
import { playerSpatialAudio } from '@/lib/playerSpatialAudio';
import { gameSocket } from '@/lib/websocket';
import type { MediaConnection } from 'peerjs';
import type Peer from 'peerjs';

export function useProximityVoice() {
  const peerRef = useRef<Peer | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const callsRef = useRef<Map<string, MediaConnection>>(new Map());

  // Initialize PeerJS when playerId becomes available
  useEffect(() => {
    let previousPlayerId: string | null = null;

    // Subscribe to state changes
    const unsub = useWorldStore.subscribe((state) => {
      const { playerId } = state;
      // Only init if playerId changed from null to a value and peer not already created
      if (playerId && playerId !== previousPlayerId && !peerRef.current) {
        initPeer(playerId);
      }
      previousPlayerId = playerId;
    });

    // Check if playerId is already available
    const currentPlayerId = useWorldStore.getState().playerId;
    if (currentPlayerId && !peerRef.current) {
      initPeer(currentPlayerId);
      previousPlayerId = currentPlayerId;
    }

    return () => {
      unsub();
      cleanup();
    };
  }, []);

  async function initPeer(playerId: string) {
    try {
      // CRITICAL: Dynamic import PeerJS to avoid SSR crash
      const { default: PeerClass } = await import('peerjs');

      // PeerJS Cloud is the default — no config needed
      // Firebase UIDs are alphanumeric, safe for PeerJS peer IDs
      const peer = new PeerClass(playerId);
      peerRef.current = peer;

      peer.on('open', () => {
        useVoiceChatStore.getState().setPeerReady(true);
      });

      peer.on('error', (err) => {
        console.warn('[voice] PeerJS error:', err.type, err.message);
      });

      // Get mic stream once with echo cancellation
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        });
        localStreamRef.current = stream;
        useVoiceChatStore.getState().setLocalStream(stream);

        // CRITICAL: Disable all audio tracks (push-to-talk default)
        stream.getAudioTracks().forEach((t) => { t.enabled = false; });
      } catch {
        useVoiceChatStore.getState().setMicPermissionDenied(true);
        return;
      }

      // Listen for incoming calls
      peer.on('call', (call) => {
        call.answer(localStreamRef.current!);
        callsRef.current.set(call.peer, call);

        call.on('stream', (remoteStream) => {
          playerSpatialAudio.addRemoteStream(call.peer, remoteStream);
        });

        call.on('close', () => {
          playerSpatialAudio.removeRemoteStream(call.peer);
          callsRef.current.delete(call.peer);
        });
      });
    } catch (err) {
      console.error('[voice] Failed to initialize PeerJS:', err);
    }
  }

  // Watch for target player disconnection — close orphaned calls
  useEffect(() => {
    const unsub = useWorldStore.subscribe((state) => {
      const { remotePlayers } = state;
      for (const [peerId, call] of callsRef.current) {
        if (!remotePlayers[peerId]) {
          call.close();
          playerSpatialAudio.removeRemoteStream(peerId);
          callsRef.current.delete(peerId);
        }
      }
    });
    return unsub;
  }, []);

  function ensureCall(targetId: string): MediaConnection | null {
    // Already have a call with this player
    if (callsRef.current.has(targetId)) return callsRef.current.get(targetId)!;

    const peer = peerRef.current;
    const stream = localStreamRef.current;
    if (!peer || !stream) return null;

    const myId = useWorldStore.getState().playerId;
    if (!myId) return null;

    // CRITICAL: Only lower UID initiates to prevent duplicate calls
    if (myId > targetId) return null; // The other player will call us

    const call = peer.call(targetId, stream);
    callsRef.current.set(targetId, call);
    useVoiceChatStore.getState().setActiveCallPeerId(targetId);

    call.on('stream', (remoteStream) => {
      playerSpatialAudio.addRemoteStream(targetId, remoteStream);
    });

    call.on('close', () => {
      playerSpatialAudio.removeRemoteStream(targetId);
      callsRef.current.delete(targetId);
      if (useVoiceChatStore.getState().activeCallPeerId === targetId) {
        useVoiceChatStore.getState().setActiveCallPeerId(null);
      }
    });

    return call;
  }

  const startPlayerVoice = useCallback((targetId: string) => {
    const stream = localStreamRef.current;
    if (!stream) return;

    // Ensure PeerJS call exists
    ensureCall(targetId);

    // Enable mic tracks
    stream.getAudioTracks().forEach((t) => { t.enabled = true; });

    // Notify server for speaker icon
    gameSocket.send({
      type: 'voice:talking',
      payload: { isTalking: true, targetPlayerId: targetId },
    });

    useVoiceChatStore.getState().setIsTalking(true);
    useVoiceChatStore.getState().setActiveCallPeerId(targetId);
  }, []);

  const stopPlayerVoice = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;

    // Disable mic tracks
    stream.getAudioTracks().forEach((t) => { t.enabled = false; });

    // Notify server
    gameSocket.send({
      type: 'voice:talking',
      payload: { isTalking: false, targetPlayerId: null },
    });

    useVoiceChatStore.getState().setIsTalking(false);
  }, []);

  function cleanup() {
    // Stop all media tracks
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;

    // Close all calls
    for (const call of callsRef.current.values()) {
      call.close();
    }
    callsRef.current.clear();

    // Destroy PeerJS
    peerRef.current?.destroy();
    peerRef.current = null;

    // Clean up spatial audio
    playerSpatialAudio.destroy();

    // Reset store
    const store = useVoiceChatStore.getState();
    store.setPeerReady(false);
    store.setLocalStream(null);
    store.setIsTalking(false);
    store.setActiveCallPeerId(null);
  }

  return { startPlayerVoice, stopPlayerVoice };
}
