import { create } from 'zustand';
import { gameSocket } from '@/lib/websocket';
import { generateConversationId } from '@bossroom/shared-utils';
import { useVoiceStore } from '@/stores/voiceStore';
import { useEmbedStore } from '@/stores/embedStore';
import { useScratchpadStore } from '@/stores/scratchpadStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useWorldStore } from '@/stores/worldStore';

export interface ProductCard {
  name: string;
  price: number;
  currency: string;
  rating?: number;
  retailer: string;
  url: string;
  imageUrl?: string;
  description: string;
  freeShipping?: boolean;
  recommended?: boolean;
}

export type ChatMessage =
  | { role: 'user'; content: string }
  | { role: 'agent'; content: string }
  | { role: 'tool'; toolName: string; status: 'started' | 'completed' | 'failed'; result?: string }
  | { role: 'products'; products: ProductCard[] };

/** Detect markdown links or raw URLs in agent text. */
const LINK_REGEX = /https?:\/\/[^\s)]+|\[.+?\]\(.+?\)/;

/** Workspace tab backed by server DB. */
export interface WorkspaceTab {
  id: string;           // workspaceId ('ws-XXXXXXXX')
  taskSummary: string;
  status: string;       // 'active' | 'completed'
  agentIds: string[];
}

interface ChatState {
  activeAgent: string | null;
  chatPanelOpen: boolean;
  chatMessages: Record<string, ChatMessage[]>;
  streamingText: Record<string, string>;
  conversationIds: Record<string, string>;
  lastWalkAwayAgent: string | null;

  /** Agent IDs whose latest turn contains a link the user hasn't seen yet. */
  agentsWithLinks: Set<string>;

  /** Workspace tabs (DB-backed) */
  workspaceTabs: WorkspaceTab[];
  activeWorkspaceId: string | null;  // null = receptionist new-conversation mode
  isLoadingWorkspace: boolean;

  openChat: (agentId: string) => void;
  interactAgent: (agentId: string) => void;
  closeChat: (reason?: 'explicit' | 'walkAway') => void;
  sendMessage: (agentId: string, content: string, inputMode?: 'voice' | 'text', purchaseOpts?: { purchaseMode?: 'approval' | 'autonomous'; purchaseBudget?: number }) => void;
  addMessage: (agentId: string, msg: ChatMessage) => void;
  addToolExecution: (agentId: string, toolName: string, status: 'started' | 'completed' | 'failed', result?: string) => void;
  appendStream: (agentId: string, delta: string) => void;
  finalizeStream: (agentId: string) => void;

  /** Workspace management (receptionist only) */
  registerTaskAgents: (agentIds: string[]) => void;
  setWorkspaceTabs: (tabs: WorkspaceTab[]) => void;
  switchWorkspace: (workspaceId: string | null) => void;
  newConversation: () => void;
  archiveWorkspace: (workspaceId: string) => void;
  setLoadingWorkspace: (loading: boolean) => void;

  reset: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  activeAgent: null,
  chatPanelOpen: false,
  chatMessages: {},
  streamingText: {},
  conversationIds: {},
  lastWalkAwayAgent: null,
  agentsWithLinks: new Set<string>(),

  workspaceTabs: [],
  activeWorkspaceId: null,
  isLoadingWorkspace: false,

  openChat: (agentId) => {
    useVoiceStore.getState().stopTTS();
    const next = new Set(get().agentsWithLinks);
    next.delete(agentId);
    set({ activeAgent: agentId, chatPanelOpen: true, lastWalkAwayAgent: null, agentsWithLinks: next });
    gameSocket.send({
      type: 'agent:interact',
      payload: { agentId },
    });
  },

  interactAgent: (agentId) => {
    useVoiceStore.getState().stopTTS();
    set({ activeAgent: agentId, lastWalkAwayAgent: null });
    gameSocket.send({
      type: 'agent:interact',
      payload: { agentId },
    });
  },

  closeChat: (reason?: 'explicit' | 'walkAway') => {
    useVoiceStore.getState().stopTTS();
    const { activeAgent } = get();
    if (activeAgent) {
      set((state) => ({
        streamingText: { ...state.streamingText, [activeAgent]: '' },
      }));
      gameSocket.send({
        type: 'agent:stopInteract',
        payload: { agentId: activeAgent },
      });
    }
    set({
      activeAgent: null,
      chatPanelOpen: false,
      lastWalkAwayAgent: reason === 'walkAway' ? activeAgent : null,
    });
  },

  sendMessage: (agentId, content, inputMode?: 'voice' | 'text', purchaseOpts?) => {
    useVoiceStore.getState().stopTTS();
    const state = get();
    const convId = state.conversationIds[agentId] ?? generateConversationId();

    const prev = state.chatMessages[agentId] ?? [];
    set({
      chatMessages: {
        ...state.chatMessages,
        [agentId]: [...prev, { role: 'user', content }],
      },
      streamingText: { ...state.streamingText, [agentId]: '' },
      conversationIds: {
        ...state.conversationIds,
        [agentId]: convId,
      },
    });

    gameSocket.send({
      type: 'agent:message',
      payload: {
        agentId,
        conversationId: convId,
        content,
        inputMode: inputMode ?? 'text',
        ...(purchaseOpts?.purchaseMode ? { purchaseMode: purchaseOpts.purchaseMode } : {}),
        ...(purchaseOpts?.purchaseBudget !== undefined ? { purchaseBudget: purchaseOpts.purchaseBudget } : {}),
      },
    });
  },

  addMessage: (agentId, msg) =>
    set((state) => {
      const prev = state.chatMessages[agentId] ?? [];
      const next: Partial<ChatState> = {
        chatMessages: {
          ...state.chatMessages,
          [agentId]: [...prev, msg],
        },
      };
      // Track links in agent messages (skip if user is already viewing this agent)
      if (msg.role === 'agent' && LINK_REGEX.test(msg.content) && state.activeAgent !== agentId) {
        const updated = new Set(state.agentsWithLinks);
        updated.add(agentId);
        next.agentsWithLinks = updated;
      }
      return next;
    }),

  addToolExecution: (agentId, toolName, status, result) =>
    set((state) => {
      const prev = state.chatMessages[agentId] ?? [];
      if (status === 'started') {
        return {
          chatMessages: {
            ...state.chatMessages,
            [agentId]: [...prev, { role: 'tool' as const, toolName, status }],
          },
        };
      }
      // For completed/failed: update the last matching tool message in-place
      const updated = [...prev];
      for (let i = updated.length - 1; i >= 0; i--) {
        const msg = updated[i];
        if (msg.role === 'tool' && msg.toolName === toolName && msg.status === 'started') {
          updated[i] = { ...msg, status, result };
          break;
        }
      }
      return {
        chatMessages: { ...state.chatMessages, [agentId]: updated },
      };
    }),

  appendStream: (agentId, delta) =>
    set((state) => ({
      streamingText: {
        ...state.streamingText,
        [agentId]: (state.streamingText[agentId] ?? '') + delta,
      },
    })),

  finalizeStream: (agentId) =>
    set((state) => {
      const content = state.streamingText[agentId] ?? '';
      const prev = state.chatMessages[agentId] ?? [];
      const next: Partial<ChatState> = {
        chatMessages: {
          ...state.chatMessages,
          [agentId]: [...prev, { role: 'agent' as const, content }],
        },
        streamingText: { ...state.streamingText, [agentId]: '' },
      };
      if (LINK_REGEX.test(content) && state.activeAgent !== agentId) {
        const updated = new Set(state.agentsWithLinks);
        updated.add(agentId);
        next.agentsWithLinks = updated;
      }
      return next;
    }),

  /** Called when workspace:build fires — associates agent IDs with the active workspace. */
  registerTaskAgents: (agentIds) => {
    set((state) => {
      const activeId = state.activeWorkspaceId;
      if (!activeId) return {};
      return {
        workspaceTabs: state.workspaceTabs.map(tab =>
          tab.id === activeId
            ? { ...tab, agentIds: [...new Set([...tab.agentIds, ...agentIds])] }
            : tab,
        ),
      };
    });
  },

  setWorkspaceTabs: (tabs) => {
    set({ workspaceTabs: tabs });
  },

  switchWorkspace: (workspaceId) => {
    if (workspaceId === null) {
      // Switch to receptionist new-conversation mode
      set({ activeWorkspaceId: null, isLoadingWorkspace: false, activeAgent: 'receptionist' });
      return;
    }
    set({ activeWorkspaceId: workspaceId, isLoadingWorkspace: true });
    // Request full workspace snapshot from server
    gameSocket.send({
      type: 'workspace:subscribe',
      payload: { workspaceId },
    });
  },

  newConversation: () => {
    const state = get();
    // Reset receptionist conversation on server so old AI context is cleared
    gameSocket.send({
      type: 'conversations:reset',
      payload: { agentIds: ['receptionist'] },
    });
    set({
      activeWorkspaceId: null,
      activeAgent: 'receptionist',
      chatMessages: {
        ...state.chatMessages,
        receptionist: [],
      },
      streamingText: { ...state.streamingText, receptionist: '' },
      conversationIds: {
        ...state.conversationIds,
        receptionist: generateConversationId(),
      },
    });
  },

  archiveWorkspace: (workspaceId) => {
    const state = get();
    const tab = state.workspaceTabs.find(t => t.id === workspaceId);
    const agentIds = tab?.agentIds ?? [];

    // Send archive request to server
    gameSocket.send({
      type: 'workspace:archive',
      payload: { workspaceId },
    });

    // Clean up related stores
    useEmbedStore.getState().removeEmbedsByAgentIds(agentIds);
    if (state.activeWorkspaceId === workspaceId) {
      useScratchpadStore.getState().clearWorkspace();
    }
    useWorkspaceStore.getState().removeAgents(agentIds);
    useWorldStore.getState().removeAgents(agentIds);

    // Remove from tabs
    const remaining = state.workspaceTabs.filter(t => t.id !== workspaceId);

    // Clear chat messages for archived workspace's agents
    const cleaned = { ...state.chatMessages };
    const cleanedStreaming = { ...state.streamingText };
    for (const id of agentIds) {
      delete cleaned[id];
      delete cleanedStreaming[id];
    }

    // If this was the active workspace, switch to most recent or null
    const nextActive = state.activeWorkspaceId === workspaceId
      ? (remaining.length > 0 ? remaining[0].id : null)
      : state.activeWorkspaceId;

    set({
      workspaceTabs: remaining,
      activeWorkspaceId: nextActive,
      chatMessages: cleaned,
      streamingText: cleanedStreaming,
    });

    // If switching to another workspace, subscribe to it
    if (nextActive && state.activeWorkspaceId === workspaceId) {
      get().switchWorkspace(nextActive);
    }
  },

  setLoadingWorkspace: (loading) => {
    set({ isLoadingWorkspace: loading });
  },

  reset: () =>
    set({
      activeAgent: null,
      chatPanelOpen: false,
      chatMessages: {},
      streamingText: {},
      conversationIds: {},
      lastWalkAwayAgent: null,
      agentsWithLinks: new Set<string>(),
      workspaceTabs: [],
      activeWorkspaceId: null,
      isLoadingWorkspace: false,
    }),
}));
