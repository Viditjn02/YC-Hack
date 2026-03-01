import { create } from 'zustand';
import { MUSIC } from '@/data/gameConfig';

const LS_TRACK_KEY = 'bossroom-music-track';
const LS_VOLUME_KEY = 'bossroom-music-volume';

function readLS(key: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  return localStorage.getItem(key) ?? fallback;
}

interface MusicState {
  trackId: string;
  volume: number;
  isPlaying: boolean;
  setTrack: (id: string) => void;
  setVolume: (vol: number) => void;
  togglePlay: () => void;
  setPlaying: (playing: boolean) => void;
}

export const useMusicStore = create<MusicState>((set) => ({
  trackId: readLS(LS_TRACK_KEY, 'nature'),
  volume:
    Number(readLS(LS_VOLUME_KEY, String(MUSIC.defaultVolume))) ||
    MUSIC.defaultVolume,
  isPlaying: true,

  setTrack: (id) => {
    localStorage.setItem(LS_TRACK_KEY, id);
    set({ trackId: id });
  },
  setVolume: (vol) => {
    localStorage.setItem(LS_VOLUME_KEY, String(vol));
    set({ volume: vol });
  },
  togglePlay: () => set((s) => ({ isPlaying: !s.isPlaying })),
  setPlaying: (playing) => set({ isPlaying: playing }),
}));
