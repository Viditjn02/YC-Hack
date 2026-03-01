'use client';

import { create } from 'zustand';

export interface ScratchpadFeedEntry {
  id: string;
  authorName: string;
  authorColor: string;
  authorType: 'agent' | 'user';
  content: string;
  timestamp: number;
}

interface ScratchpadState {
  entries: ScratchpadFeedEntry[];
  activeWorkspaceId: string | null;

  addEntry: (entry: ScratchpadFeedEntry) => void;
  setEntries: (workspaceId: string, entries: ScratchpadFeedEntry[]) => void;
  setActiveWorkspace: (workspaceId: string) => void;
  clearWorkspace: () => void;
}

export const useScratchpadStore = create<ScratchpadState>((set) => ({
  entries: [],
  activeWorkspaceId: null,

  addEntry: (entry) =>
    set((state) => {
      const updated = [...state.entries, entry];
      if (updated.length > 100) updated.shift();
      return { entries: updated };
    }),

  setEntries: (workspaceId, entries) =>
    set({ activeWorkspaceId: workspaceId, entries }),

  setActiveWorkspace: (workspaceId) =>
    set({ activeWorkspaceId: workspaceId }),

  clearWorkspace: () =>
    set({ entries: [], activeWorkspaceId: null }),
}));
