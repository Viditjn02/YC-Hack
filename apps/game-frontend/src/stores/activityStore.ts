import { create } from 'zustand';

export type ActivityType = 'tool' | 'status' | 'delegation' | 'skill' | 'scratchpad';

export interface ActivityEvent {
  id: string;
  type: ActivityType;
  agentId: string;
  agentName: string;
  agentColor: string;
  timestamp: number;

  toolName?: string;
  toolStatus?: 'started' | 'completed' | 'failed';
  toolResult?: string;

  status?: string;
  previousStatus?: string;

  delegateToName?: string;
  delegateTask?: string;

  skillName?: string;

  scratchpadContent?: string;
}

interface ActivityState {
  events: ActivityEvent[];
  maxEvents: number;

  addEvent: (event: Omit<ActivityEvent, 'id' | 'timestamp'>) => void;
  clear: () => void;
}

let eventCounter = 0;

export const useActivityStore = create<ActivityState>((set) => ({
  events: [],
  maxEvents: 200,

  addEvent: (event) => {
    const id = `activity-${++eventCounter}-${Date.now()}`;
    set((state) => {
      const newEvents = [...state.events, { ...event, id, timestamp: Date.now() }];
      if (newEvents.length > state.maxEvents) {
        return { events: newEvents.slice(-state.maxEvents) };
      }
      return { events: newEvents };
    });
  },

  clear: () => set({ events: [] }),
}));
