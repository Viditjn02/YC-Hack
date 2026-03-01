'use client';

import { create } from 'zustand';

/** Domains that block iframes via X-Frame-Options / CSP frame-ancestors. */
const IFRAME_BLOCKED_DOMAINS = [
  'linkedin.com',
  'twitter.com',
  'x.com',
  'facebook.com',
  'instagram.com',
  'github.com',
  'mail.google.com',
  'accounts.google.com',
  'connect.composio.dev',
  'notion.so',
  'slack.com',
  'discord.com',
  'linear.app',
];

function isIframeBlocked(url: string): boolean {
  try {
    const hostname = new URL(url).hostname;
    return IFRAME_BLOCKED_DOMAINS.some(
      (d) => hostname === d || hostname.endsWith('.' + d),
    );
  } catch {
    return false;
  }
}

interface EmbedTab {
  id: string;
  url: string;
  title: string;
  type: 'document' | 'board' | 'spreadsheet' | 'presentation' | 'other';
  agentId: string;
  agentName: string;
}

interface EmbedState {
  embeds: EmbedTab[];
  activeEmbedId: string | null;
  panelOpen: boolean;
  addEmbed: (embed: EmbedTab) => void;
  removeEmbed: (id: string) => void;
  setActiveEmbed: (id: string) => void;
  togglePanel: () => void;
  openPanel: () => void;
  closePanel: () => void;
  removeEmbedsByAgentIds: (agentIds: string[]) => void;
  clearAll: () => void;
}

export const useEmbedStore = create<EmbedState>((set, get) => ({
  embeds: [],
  activeEmbedId: null,
  panelOpen: false,

  addEmbed: (embed) => {
    // Sites that block iframes — open in a new tab instead
    if (isIframeBlocked(embed.url)) {
      window.open(embed.url, '_blank', 'noopener');
      return;
    }

    const state = get();
    // Deduplicate by URL: if same URL exists, just focus that tab
    const existing = state.embeds.find((e) => e.url === embed.url);
    if (existing) {
      set({ activeEmbedId: existing.id });
      return;
    }
    // Don't auto-open sidebar — the 3D screen shows the embed first.
    // User expands to sidebar manually.
    set({
      embeds: [...state.embeds, embed],
      activeEmbedId: embed.id,
    });
  },

  removeEmbed: (id) => {
    const state = get();
    const filtered = state.embeds.filter((e) => e.id !== id);
    const wasActive = state.activeEmbedId === id;
    set({
      embeds: filtered,
      activeEmbedId: wasActive
        ? (filtered[filtered.length - 1]?.id ?? null)
        : state.activeEmbedId,
      panelOpen: filtered.length > 0 ? state.panelOpen : false,
    });
  },

  setActiveEmbed: (id) => set({ activeEmbedId: id }),

  togglePanel: () => set((state) => ({ panelOpen: !state.panelOpen })),

  openPanel: () => set({ panelOpen: true }),

  closePanel: () => set({ panelOpen: false }),

  removeEmbedsByAgentIds: (agentIds) => {
    const idsSet = new Set(agentIds);
    set((state) => {
      const filtered = state.embeds.filter((e) => !idsSet.has(e.agentId));
      return {
        embeds: filtered,
        activeEmbedId: filtered.find((e) => e.id === state.activeEmbedId)
          ? state.activeEmbedId
          : (filtered[filtered.length - 1]?.id ?? null),
        panelOpen: filtered.length > 0 ? state.panelOpen : false,
      };
    });
  },

  clearAll: () => set({ embeds: [], activeEmbedId: null, panelOpen: false }),
}));
