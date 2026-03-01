import { VOICE_CHAT } from '@/data/gameConfig';
import { getAudioContext } from '@/lib/spatialAudio';

interface PeerAudioNodes {
  source: MediaStreamAudioSourceNode;
  panner: PannerNode;
  gain: GainNode;
}

class PlayerSpatialAudioManager {
  private audioCtx: AudioContext | null = null;
  private peers: Map<string, PeerAudioNodes> = new Map();

  initialize(): void {
    // Call getAudioContext() from existing spatialAudio.ts (shares singleton)
    this.audioCtx = getAudioContext();
  }

  addRemoteStream(peerId: string, stream: MediaStream): void {
    if (!this.audioCtx) this.initialize();
    const ctx = this.audioCtx!;

    // Remove existing stream if any
    this.removeRemoteStream(peerId);

    // Create audio source from MediaStream
    const source = ctx.createMediaStreamSource(stream);

    // Create panner node for spatial audio
    const panner = ctx.createPanner();
    panner.panningModel = 'HRTF';
    panner.distanceModel = 'inverse';
    panner.refDistance = VOICE_CHAT.spatialRefDistance;
    panner.maxDistance = VOICE_CHAT.spatialMaxDistance;
    panner.rolloffFactor = VOICE_CHAT.spatialRolloff;

    // Create gain node for volume control
    const gain = ctx.createGain();
    gain.gain.value = 1;

    // Connect: source -> panner -> gain -> destination
    source.connect(panner);
    panner.connect(gain);
    gain.connect(ctx.destination);

    // Store nodes
    this.peers.set(peerId, { source, panner, gain });
  }

  updatePeerPosition(peerId: string, x: number, y: number, z: number): void {
    const peer = this.peers.get(peerId);
    if (!peer) return;

    const { panner } = peer;
    // Use AudioParam value setters
    panner.positionX.value = x;
    panner.positionY.value = y;
    panner.positionZ.value = z;
  }

  updateListenerPosition(x: number, y: number, z: number): void {
    if (!this.audioCtx) return;
    const listener = this.audioCtx.listener;

    // Use .value setter if available, fallback to setPosition
    if (listener.positionX) {
      listener.positionX.value = x;
      listener.positionY.value = y;
      listener.positionZ.value = z;
    } else {
      listener.setPosition(x, y, z);
    }
  }

  updateListenerOrientation(
    forwardX: number,
    forwardY: number,
    forwardZ: number
  ): void {
    if (!this.audioCtx) return;
    const listener = this.audioCtx.listener;

    if (listener.forwardX) {
      listener.forwardX.value = forwardX;
      listener.forwardY.value = forwardY;
      listener.forwardZ.value = forwardZ;
      listener.upX.value = 0;
      listener.upY.value = 1;
      listener.upZ.value = 0;
    } else {
      listener.setOrientation(forwardX, forwardY, forwardZ, 0, 1, 0);
    }
  }

  removeRemoteStream(peerId: string): void {
    const peer = this.peers.get(peerId);
    if (!peer) return;

    // Disconnect all nodes
    peer.source.disconnect();
    peer.panner.disconnect();
    peer.gain.disconnect();

    // Remove from map
    this.peers.delete(peerId);
  }

  destroy(): void {
    // Remove all streams
    for (const peerId of Array.from(this.peers.keys())) {
      this.removeRemoteStream(peerId);
    }

    // Nullify audioCtx ref (don't close it, as it's a shared singleton)
    this.audioCtx = null;
  }
}

export const playerSpatialAudio = new PlayerSpatialAudioManager();
