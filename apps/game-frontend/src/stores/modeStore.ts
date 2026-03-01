import { create } from 'zustand';

export type AppMode = 'imagine' | 'game';

interface ModeState {
  mode: AppMode;
  transitioning: boolean;
  targetMode: AppMode | null;
  setMode: (mode: AppMode) => void;
  startTransition: (target: AppMode) => void;
  completeTransition: () => void;
}

export const useModeStore = create<ModeState>((set) => ({
  mode: 'imagine',
  transitioning: false,
  targetMode: null,

  setMode: (mode) => set({ mode }),

  startTransition: (target) =>
    set({ transitioning: true, targetMode: target }),

  completeTransition: () =>
    set((s) => ({
      mode: s.targetMode ?? s.mode,
      transitioning: false,
      targetMode: null,
    })),
}));
