'use client';

import { create } from 'zustand';

interface VoiceChatState {
  peerReady: boolean;
  localStream: MediaStream | null;
  isTalking: boolean;
  micPermissionDenied: boolean;
  activeCallPeerId: string | null;

  setPeerReady: (ready: boolean) => void;
  setLocalStream: (stream: MediaStream | null) => void;
  setIsTalking: (talking: boolean) => void;
  setMicPermissionDenied: (denied: boolean) => void;
  setActiveCallPeerId: (peerId: string | null) => void;
}

export const useVoiceChatStore = create<VoiceChatState>((set) => ({
  peerReady: false,
  localStream: null,
  isTalking: false,
  micPermissionDenied: false,
  activeCallPeerId: null,

  setPeerReady: (ready) => set({ peerReady: ready }),
  setLocalStream: (stream) => set({ localStream: stream }),
  setIsTalking: (talking) => set({ isTalking: talking }),
  setMicPermissionDenied: (denied) => set({ micPermissionDenied: denied }),
  setActiveCallPeerId: (peerId) => set({ activeCallPeerId: peerId }),
}));
