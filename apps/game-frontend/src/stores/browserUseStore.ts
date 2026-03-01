'use client';

import { create } from 'zustand';

export interface BrowserUseSession {
  agentId: string;
  agentName: string;
  liveUrl?: string;
}

interface BrowserUseState {
  activeSessions: Map<string, BrowserUseSession>;
  setActive: (agentId: string, agentName: string, liveUrl?: string) => void;
  setInactive: (agentId: string) => void;
  clearAll: () => void;
}

export const useBrowserUseStore = create<BrowserUseState>((set) => ({
  activeSessions: new Map(),

  setActive: (agentId, agentName, liveUrl) =>
    set((state) => {
      const next = new Map(state.activeSessions);
      next.set(agentId, { agentId, agentName, liveUrl });
      return { activeSessions: next };
    }),

  setInactive: (agentId) =>
    set((state) => {
      const next = new Map(state.activeSessions);
      next.delete(agentId);
      return { activeSessions: next };
    }),

  clearAll: () => set({ activeSessions: new Map() }),
}));
