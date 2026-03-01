import { create } from 'zustand';
import { getActiveSource, setActiveSource, setActivePanner } from '@/lib/spatialAudio';

interface TTSItem {
  agentId: string;
  audioBase64: string;
  mimeType: string;
}

interface VoiceState {
  isRecording: boolean;
  voiceTranscript: string;
  ttsQueue: TTSItem[];
  isTTSPlaying: boolean;

  setRecording: (recording: boolean) => void;
  setVoiceTranscript: (text: string) => void;
  enqueueTTS: (item: TTSItem) => void;
  dequeueTTS: () => void;
  clearTTSQueue: () => void;
  setTTSPlaying: (playing: boolean) => void;
  stopTTS: () => void;
  reset: () => void;
}

export const useVoiceStore = create<VoiceState>((set) => ({
  isRecording: false,
  voiceTranscript: '',
  ttsQueue: [],
  isTTSPlaying: false,

  setRecording: (recording) => set({ isRecording: recording }),
  setVoiceTranscript: (text) => set({ voiceTranscript: text }),
  enqueueTTS: (item) => set((s) => ({ ttsQueue: [...s.ttsQueue, item] })),
  dequeueTTS: () => set((s) => ({ ttsQueue: s.ttsQueue.slice(1) })),
  clearTTSQueue: () => set({ ttsQueue: [] }),
  setTTSPlaying: (playing) => set({ isTTSPlaying: playing }),
  stopTTS: () => {
    const source = getActiveSource();
    if (source) { try { source.stop(); } catch { /* already stopped */ } }
    setActiveSource(null);
    setActivePanner(null, null);
    set({ ttsQueue: [], isTTSPlaying: false });
  },
  reset: () => set({ isRecording: false, voiceTranscript: '', ttsQueue: [], isTTSPlaying: false }),
}));
