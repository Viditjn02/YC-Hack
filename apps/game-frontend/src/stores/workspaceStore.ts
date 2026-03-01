'use client';

import { create } from 'zustand';
import type { DynamicAgent } from '@bossroom/shared-types';

export type WorkspacePhase = 'reception' | 'building' | 'ready';

interface WorkspaceState {
  phase: WorkspacePhase;
  dynamicAgents: DynamicAgent[];
  buildQueue: string[];              // agent IDs in build order (current batch)
  currentlyBuilding: string | null;
  builtAgentIds: Set<string>;
  taskSummary: string;

  // Actions
  startBuild: (agents: DynamicAgent[], taskSummary: string) => void;
  markZoneBuilt: (agentId: string) => void;
  completeBuild: () => void;
  removeAgents: (agentIds: string[]) => void;
  setWorkspaceState: (agents: DynamicAgent[], taskSummary: string) => void;
  reset: () => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  phase: 'reception',
  dynamicAgents: [],
  buildQueue: [],
  currentlyBuilding: null,
  builtAgentIds: new Set(),
  taskSummary: '',

  startBuild: (agents, taskSummary) => {
    const state = get();
    const queue = agents.map((a) => a.agentId);
    set({
      phase: 'building',
      // Additive: keep existing agents, append new ones
      dynamicAgents: [...state.dynamicAgents, ...agents],
      buildQueue: queue,
      currentlyBuilding: queue[0] ?? null,
      builtAgentIds: new Set(state.builtAgentIds),
      taskSummary,
    });
  },

  markZoneBuilt: (agentId) => {
    const state = get();
    const newBuilt = new Set(state.builtAgentIds);
    newBuilt.add(agentId);

    // Find next in queue
    const idx = state.buildQueue.indexOf(agentId);
    const nextId = idx >= 0 ? state.buildQueue[idx + 1] ?? null : null;

    set({
      builtAgentIds: newBuilt,
      currentlyBuilding: nextId,
    });
  },

  completeBuild: () => {
    set({
      phase: 'ready',
      currentlyBuilding: null,
    });
  },

  /** Remove specific agents (e.g. when closing a task tab). */
  removeAgents: (agentIds) => {
    const idsToRemove = new Set(agentIds);
    set((state) => ({
      dynamicAgents: state.dynamicAgents.filter((a) => !idsToRemove.has(a.agentId)),
    }));
  },

  /** Set workspace state directly (no build animation — used for tab switching). */
  setWorkspaceState: (agents, taskSummary) => {
    set({
      phase: 'ready',
      dynamicAgents: agents,
      taskSummary,
      buildQueue: [],
      currentlyBuilding: null,
      builtAgentIds: new Set(agents.map(a => a.agentId)),
    });
  },

  reset: () =>
    set({
      phase: 'reception',
      dynamicAgents: [],
      buildQueue: [],
      currentlyBuilding: null,
      builtAgentIds: new Set(),
      taskSummary: '',
    }),
}));
