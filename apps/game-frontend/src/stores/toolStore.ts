import { create } from 'zustand';
import { TIMEOUTS } from '@bossroom/shared-utils';

export interface ToolExecution {
  id: string;
  agentId: string;
  toolName: string;
  status: 'started' | 'completed' | 'failed';
  result?: string;
}

interface ToolState {
  toolExecutions: ToolExecution[];
  addToolExecution: (exec: ToolExecution) => void;
  dismissToolExecution: (id: string) => void;
}

export const useToolStore = create<ToolState>((set, get) => ({
  toolExecutions: [],

  addToolExecution: (exec) => {
    set((state) => ({
      toolExecutions: [...state.toolExecutions, exec],
    }));
    setTimeout(() => {
      get().dismissToolExecution(exec.id);
    }, TIMEOUTS.TOOL_EXECUTION_DISMISS_MS);
  },

  dismissToolExecution: (id) =>
    set((state) => ({
      toolExecutions: state.toolExecutions.filter((t) => t.id !== id),
    })),
}));
