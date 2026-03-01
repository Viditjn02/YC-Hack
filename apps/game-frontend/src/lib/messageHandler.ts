import { useWorldStore } from '@/stores/worldStore';
import { useChatStore } from '@/stores/chatStore';
import { useVoiceStore } from '@/stores/voiceStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useScratchpadStore } from '@/stores/scratchpadStore';
import { useEmbedStore } from '@/stores/embedStore';
import { useProductStore } from '@/stores/productStore';
import { gameSocket } from './websocket';
import type { ServerMessage } from '@bossroom/shared-types';
import { RANDOM_AVATAR_ID } from '@bossroom/shared-types';
import { agents as defaultAgents, toDynamicAgentData } from '@/data/agents';
import type { AgentData } from '@/data/agents';

export function initWebSocket(username: string, token: string, tokenRefresher: () => Promise<string>, uid: string) {
  if (gameSocket.connected) return;

  gameSocket.onMessage((msg: ServerMessage) => {
    switch (msg.type) {
      case 'world:state': {
        const worldStore = useWorldStore.getState();
        worldStore.setConnected(true, uid);

        // Map agents from world state, merging with default frontend data
        const agentStates = msg.payload.agents;
        const mapped: AgentData[] = defaultAgents.map((def) => {
          const serverAgent = agentStates[def.id];
          return serverAgent
            ? { ...def, status: serverAgent.status }
            : def;
        });
        worldStore.setAgents(mapped);

        // Extract remote players (filter out self)
        const players = msg.payload.players;
        const remotePlayers: Record<string, { id: string; username: string; position: [number, number, number]; rotation: number; animation: string; avatarId: string }> = {};
        for (const [id, p] of Object.entries(players)) {
          if (id === uid) continue;
          remotePlayers[id] = {
            id: p.id,
            username: p.username,
            position: p.position,
            rotation: p.rotation,
            animation: p.animation,
            avatarId: p.avatarId,
          };
        }
        worldStore.setRemotePlayers(remotePlayers);

        // Initialize local user's avatar and voice from server
        const selfPlayer = players[uid];
        if (selfPlayer) {
          useSettingsStore.getState().setAvatarFromServer(
            selfPlayer.avatarPreference ?? selfPlayer.avatarId ?? RANDOM_AVATAR_ID,
            selfPlayer.avatarId,
          );
          if (selfPlayer.voiceId) {
            useSettingsStore.getState().setVoiceFromServer(selfPlayer.voiceId);
          }
        }
        break;
      }

      case 'agent:statusChanged': {
        const { agentId, status } = msg.payload;
        useWorldStore.getState().updateAgentStatus(agentId, status);
        break;
      }

      case 'agent:conversationHistory': {
        const { agentId, messages: history } = msg.payload;

        // Set full history, replacing any existing messages
        useChatStore.setState((state) => ({
          chatMessages: {
            ...state.chatMessages,
            [agentId]: history.map((m) => ({
              role: m.role === 'assistant' ? 'agent' as const : 'user' as const,
              content: m.content,
            })),
          },
          streamingText: { ...state.streamingText, [agentId]: '' },
        }));
        break;
      }

      case 'agent:chatMessage': {
        const { agentId, role, content } = msg.payload;
        const chatStore = useChatStore.getState();
        const streamText = chatStore.streamingText[agentId] ?? '';
        if (role === 'assistant' && streamText && content === streamText) {
          chatStore.finalizeStream(agentId);
        } else {
          chatStore.addMessage(agentId, {
            role: role === 'assistant' ? 'agent' : 'user',
            content,
          });
        }
        break;
      }

      case 'agent:chatStream':
        useChatStore.getState().appendStream(msg.payload.agentId, msg.payload.delta);
        break;

      case 'agent:toolExecution':
        useChatStore.getState().addToolExecution(
          msg.payload.agentId,
          msg.payload.toolName,
          msg.payload.status,
          msg.payload.result,
        );
        break;

      case 'agent:ttsAudio':
        useVoiceStore.getState().enqueueTTS({
          agentId: msg.payload.agentId,
          audioBase64: msg.payload.audioBase64,
          mimeType: msg.payload.mimeType,
        });
        break;

      // --- Dynamic workspace events ---

      case 'workspace:build': {
        const { agents: dynamicAgents, taskSummary } = msg.payload;
        // Start the build sequence
        useWorkspaceStore.getState().startBuild(dynamicAgents, taskSummary);

        // Add dynamic agents to worldStore so ChatPanel and status updates work
        useWorldStore.getState().addAgents(dynamicAgents.map(toDynamicAgentData));

        // Track which agents belong to the current task
        const newAgentIds = dynamicAgents.map((a) => a.agentId);

        // Set active workspace for scratchpad
        const workspaceId = dynamicAgents[0]?.workspaceId;
        if (workspaceId) {
          useScratchpadStore.getState().setActiveWorkspace(workspaceId);
          // Add/update workspace tab
          useChatStore.setState((state) => {
            const existing = state.workspaceTabs.find(t => t.id === workspaceId);
            if (existing) return {};
            return {
              workspaceTabs: [...state.workspaceTabs, {
                id: workspaceId,
                taskSummary,
                status: 'active',
                agentIds: newAgentIds,
              }],
              activeWorkspaceId: workspaceId,
            };
          });
        }

        useChatStore.getState().registerTaskAgents(newAgentIds);
        break;
      }

      case 'workspace:list': {
        const { workspaces } = msg.payload;
        const tabs = workspaces.map(w => ({
          id: w.id,
          taskSummary: w.taskSummary,
          status: w.status,
          agentIds: [] as string[],  // will be populated when subscribing
        }));
        useChatStore.getState().setWorkspaceTabs(tabs);
        // Auto-subscribe to most recent active workspace
        const activeWs = workspaces.find(w => w.status === 'active');
        if (activeWs) {
          useChatStore.getState().switchWorkspace(activeWs.id);
        }
        break;
      }

      case 'workspace:snapshot': {
        const { workspaceId, taskSummary, status, agents: snapshotAgents, scratchpadEntries } = msg.payload;

        // Build DynamicAgent array for workspaceStore
        const dynamicAgentsFromSnapshot = snapshotAgents.map(a => ({
          agentId: a.agentId, workspaceId, name: a.name, color: a.color,
          zoneName: a.zoneName, personality: a.personality, role: a.role as 'lead' | 'worker',
          skills: a.skills ?? [], position: a.position as [number, number, number],
        }));

        // Clear embeds from previous workspace
        useEmbedStore.getState().clearAll();

        // Set workspace directly (no build animation for existing workspaces)
        useWorkspaceStore.getState().setWorkspaceState(dynamicAgentsFromSnapshot, taskSummary);

        // Clear old dynamic agents from world, then add new ones
        useWorldStore.getState().clearDynamicAgents();
        useWorldStore.getState().addAgents(dynamicAgentsFromSnapshot.map(toDynamicAgentData));

        // Set agent statuses
        for (const a of snapshotAgents) {
          useWorldStore.getState().updateAgentStatus(a.agentId, a.status as 'idle' | 'listening' | 'thinking' | 'working' | 'done' | 'error');
        }

        // Update workspace tab's agentIds
        const snapAgentIds = snapshotAgents.map(a => a.agentId);
        useChatStore.setState((state) => ({
          workspaceTabs: state.workspaceTabs.map(tab =>
            tab.id === workspaceId
              ? { ...tab, agentIds: snapAgentIds, taskSummary, status }
              : tab,
          ),
        }));

        // Clear stale chat messages from previous workspace, then populate from snapshot
        const chatState = useChatStore.getState();
        const staleAgentIds = Object.keys(chatState.chatMessages).filter(
          id => id !== 'receptionist' && !snapshotAgents.some(a => a.agentId === id)
        );
        if (staleAgentIds.length > 0) {
          const cleaned = { ...chatState.chatMessages };
          for (const id of staleAgentIds) delete cleaned[id];
          useChatStore.setState({ chatMessages: cleaned });
        }

        // Populate chat histories from snapshot
        for (const a of snapshotAgents) {
          if (a.chatHistory?.length > 0) {
            useChatStore.setState((state) => ({
              chatMessages: {
                ...state.chatMessages,
                [a.agentId]: a.chatHistory.map(m => ({
                  role: m.role === 'assistant' ? 'agent' as const : 'user' as const,
                  content: m.content,
                })),
              },
            }));
          }
        }

        // Set scratchpad
        useScratchpadStore.getState().setEntries(workspaceId, scratchpadEntries);

        // Auto-switch to lead agent and refetch its conversation
        if (snapshotAgents.length > 0) {
          const leadAgent = snapshotAgents.find(a => a.role === 'lead') ?? snapshotAgents[0];
          useChatStore.setState({ activeAgent: leadAgent.agentId });
          // Trigger agent:interact to get fresh conversation history from server
          gameSocket.send({ type: 'agent:interact', payload: { agentId: leadAgent.agentId } });
        }

        // Clear loading state
        useChatStore.getState().setLoadingWorkspace(false);
        break;
      }

      case 'agent:delegatedTask': {
        const { fromAgentId, toAgentName, task } = msg.payload;
        // Show delegation in lead agent's chat as a special message
        useChatStore.getState().addMessage(fromAgentId, {
          role: 'agent',
          content: `*Delegating to ${toAgentName}:* ${task}`,
        });
        break;
      }

      case 'agent:skills':
        // Skills loaded for an agent — could be stored if needed
        break;

      case 'agent:skillCreated': {
        const { agentId, skill } = msg.payload;
        // Show skill creation in chat
        useChatStore.getState().addMessage(agentId, {
          role: 'agent',
          content: `*New skill created:* ${skill.name} — ${skill.description}`,
        });
        break;
      }

      case 'workspace:scratchpadEntry': {
        const scratchpadState = useScratchpadStore.getState();
        if (msg.payload.workspaceId !== scratchpadState.activeWorkspaceId) break;
        scratchpadState.addEntry(msg.payload.entry);
        break;
      }

      case 'workspace:scratchpadHistory': {
        const { workspaceId, entries } = msg.payload;
        useScratchpadStore.getState().setEntries(workspaceId, entries);
        break;
      }

      case 'workspace:embedPanel': {
        useEmbedStore.getState().addEmbed(msg.payload.embed);
        break;
      }

      case 'agent:productCards': {
        const { agentId, products } = msg.payload;
        // Show in floating product canvas
        useProductStore.getState().showProducts(agentId, products);
        // Minimal chat history reference
        useChatStore.getState().addMessage(agentId, {
          role: 'agent',
          content: `Showing ${products.length} products`,
        });
        break;
      }

      case 'shop:purchaseResult': {
        const { success, orderId, productName, amount, error } = msg.payload;
        const productStore = useProductStore.getState();
        productStore.setPurchaseStatus(
          success ? 'success' : 'error',
          success
            ? `${productName} for $${amount}${orderId ? ` — Order ${orderId}` : ''}`
            : (error ?? 'Purchase failed'),
        );
        // Log in chat history
        useChatStore.getState().addMessage('shopkeeper', {
          role: 'agent',
          content: success
            ? `done! grabbed ${productName} for $${amount} — order ${orderId ?? 'confirmed'}`
            : `purchase failed: ${error ?? 'unknown error'}`,
        });
        break;
      }

      // --- Player events ---

      case 'player:joined': {
        const jp = msg.payload;
        useWorldStore.getState().addRemotePlayer({
          id: jp.id,
          username: jp.username,
          position: jp.position,
          rotation: jp.rotation,
          animation: jp.animation,
          avatarId: jp.avatarId,
        });
        break;
      }

      case 'player:moved':
        useWorldStore.getState().updateRemotePlayer(
          msg.payload.playerId,
          msg.payload.position,
          msg.payload.rotation,
          msg.payload.animation,
        );
        break;

      case 'player:left':
        useWorldStore.getState().removeRemotePlayer(msg.payload.playerId);
        if (msg.payload.playerId === '__self__') {
          useWorldStore.getState().setConnected(false);
        }
        break;

      case 'player:avatarChanged':
        useWorldStore.getState().updateRemotePlayerAvatar(
          msg.payload.playerId,
          msg.payload.avatarId,
        );
        break;

      case 'voice:playerTalking': {
        const { playerId, isTalking } = msg.payload;
        useWorldStore.getState().setPlayerTalking(playerId, isTalking);
        break;
      }
    }
  });

  gameSocket.setTokenRefresher(tokenRefresher);
  gameSocket.connect(username, token);
}
