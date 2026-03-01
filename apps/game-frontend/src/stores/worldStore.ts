import { create } from 'zustand';
import { agents as defaultAgents, type AgentData } from '@/data/agents';
import type { AgentStatus } from '@bossroom/shared-types';
import { PUNCH } from '@/data/gameConfig';

export interface RemotePlayer {
  id: string;
  username: string;
  position: [number, number, number];
  rotation: number;
  animation: string;
  avatarId: string;
}

export interface NearestTarget {
  type: 'agent' | 'player';
  id: string;
}

interface WorldState {
  connected: boolean;
  playerId: string | null;
  agents: AgentData[];
  nearestAgent: string | null;
  nearestTarget: NearestTarget | null;
  remotePlayers: Record<string, RemotePlayer>;
  talkingPlayers: Record<string, boolean>;

  setNearestAgent: (id: string | null) => void;
  setNearestTarget: (target: NearestTarget | null) => void;
  setPlayerTalking: (id: string, talking: boolean) => void;
  updateAgentStatus: (agentId: string, status: AgentStatus) => void;
  addAgents: (newAgents: AgentData[]) => void;
  removeAgents: (ids: string[]) => void;
  clearDynamicAgents: () => void;
  reset: () => void;

  // Internal (called by message handler)
  setConnected: (connected: boolean, playerId?: string) => void;
  setAgents: (agents: AgentData[]) => void;
  setRemotePlayers: (players: Record<string, RemotePlayer>) => void;
  addRemotePlayer: (player: RemotePlayer) => void;
  updateRemotePlayer: (id: string, position: [number, number, number], rotation: number, animation: string) => void;
  updateRemotePlayerAvatar: (id: string, avatarId: string) => void;
  removeRemotePlayer: (id: string) => void;
  punchedAgentId: string | null;
  punchReaction: string | null;
  punchAgent: (id: string, reaction: string) => void;
}

export const useWorldStore = create<WorldState>((set) => ({
  connected: false,
  playerId: null,
  agents: defaultAgents,
  nearestAgent: null,
  nearestTarget: null,
  remotePlayers: {},
  talkingPlayers: {},

  setNearestAgent: (id) => set({ nearestAgent: id }),

  setNearestTarget: (target) => set({ nearestTarget: target }),

  setPlayerTalking: (id, talking) =>
    set((state) => {
      if (!talking) {
        const next = { ...state.talkingPlayers };
        delete next[id];
        return { talkingPlayers: next };
      }
      return { talkingPlayers: { ...state.talkingPlayers, [id]: true } };
    }),

  updateAgentStatus: (agentId, status) =>
    set((state) => ({
      agents: state.agents.map((a) =>
        a.id === agentId ? { ...a, status } : a,
      ),
    })),

  addAgents: (newAgents) =>
    set((state) => ({
      agents: [...state.agents, ...newAgents],
    })),

  removeAgents: (ids) => {
    const idsToRemove = new Set(ids);
    set((state) => ({
      agents: state.agents.filter((a) => !idsToRemove.has(a.id)),
    }));
  },

  /** Clear all dynamic agents from the world (keeps static agents like Receptionist). */
  clearDynamicAgents: () => {
    const defaultIds = new Set(defaultAgents.map(a => a.id));
    set((state) => ({
      agents: state.agents.filter(a => defaultIds.has(a.id)),
    }));
  },

  reset: () =>
    set({
      connected: false,
      playerId: null,
      agents: defaultAgents,
      nearestAgent: null,
      nearestTarget: null,
      remotePlayers: {},
      talkingPlayers: {},
    }),

  setConnected: (connected, playerId) =>
    set(playerId ? { connected, playerId } : { connected }),

  setAgents: (agents) => set({ agents }),

  setRemotePlayers: (players) => set({ remotePlayers: players }),

  addRemotePlayer: (player) =>
    set((state) => ({
      remotePlayers: { ...state.remotePlayers, [player.id]: player },
    })),

  updateRemotePlayer: (id, position, rotation, animation) =>
    set((state) => {
      const existing = state.remotePlayers[id];
      if (!existing) return state;
      return {
        remotePlayers: {
          ...state.remotePlayers,
          [id]: { ...existing, position, rotation, animation },
        },
      };
    }),

  updateRemotePlayerAvatar: (id, avatarId) =>
    set((state) => {
      const existing = state.remotePlayers[id];
      if (!existing) return state;
      return {
        remotePlayers: { ...state.remotePlayers, [id]: { ...existing, avatarId } },
      };
    }),

  removeRemotePlayer: (id) =>
    set((state) => {
      const next = { ...state.remotePlayers };
      delete next[id];
      return { remotePlayers: next };
    }),

  punchedAgentId: null,
  punchReaction: null,
  punchAgent: (id, reaction) => {
    set({ punchedAgentId: id, punchReaction: reaction });
    setTimeout(() => set({ punchedAgentId: null, punchReaction: null }), PUNCH.reactionDuration);
  },
}));
