import { create } from 'zustand';

export interface SecurityEvent {
  id: string;
  timestamp: number;
  agentId: string;
  agentName: string;
  inputSnippet: string;
  patterns: string[];
  severity: 'low' | 'high';
  llmClassification?: {
    isInjection: boolean;
    confidence: number;
    reason: string;
  };
  action: 'sanitized' | 'blocked' | 'rate_limited';
}

interface SecurityState {
  events: SecurityEvent[];
  addEvent: (event: Omit<SecurityEvent, 'id' | 'timestamp'>) => void;
  clear: () => void;
}

let counter = 0;

export const useSecurityStore = create<SecurityState>((set) => ({
  events: [],

  addEvent: (event) => {
    const id = `sec-${++counter}-${Date.now()}`;
    set((state) => {
      const newEvents = [...state.events, { ...event, id, timestamp: Date.now() }];
      return { events: newEvents.length > 100 ? newEvents.slice(-100) : newEvents };
    });
  },

  clear: () => set({ events: [] }),
}));
