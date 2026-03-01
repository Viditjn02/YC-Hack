/** Runtime agent positions updated by wander hooks, read by proximity detection. */
import { create } from 'zustand';

interface AgentRuntime {
  currentPosition: [number, number, number];
}

interface AgentBehaviorState {
  runtimes: Record<string, AgentRuntime>;
  playerPosition: [number, number, number];
  setPosition: (agentId: string, pos: [number, number, number]) => void;
  setPlayerPosition: (pos: [number, number, number]) => void;
}

export const useAgentBehaviorStore = create<AgentBehaviorState>((set) => ({
  runtimes: {},
  playerPosition: [0, 0, 0],
  setPosition: (agentId, pos) =>
    set((state) => ({
      runtimes: {
        ...state.runtimes,
        [agentId]: { currentPosition: pos },
      },
    })),
  setPlayerPosition: (pos) => set({ playerPosition: pos }),
}));
