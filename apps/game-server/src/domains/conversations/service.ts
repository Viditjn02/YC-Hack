import { WebSocket } from 'ws';
import type { ModelMessage } from 'ai';
import type { AgentDef } from '@bossroom/shared-utils';
import { generateConversationId } from '@bossroom/shared-utils';
import { log } from '../../logger.js';
import type { ConversationRepository } from './repository.js';
import type { AgentRepository } from '../agents/repository.js';

export interface Conversation {
  id: string;
  playerId: string;
  agentId: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string; timestamp: string }>;
  aiMessages: ModelMessage[];
  ws: WebSocket;
}

type StartOrRestoreResult =
  | { isNew: false; conversation: Conversation; historyMessages: Array<{ role: string; content: string }> }
  | { isNew: true; conversation: Conversation; greeting: string };

export function createConversationService(deps: {
  conversationRepo: ConversationRepository;
  agentRepo: AgentRepository;
}) {
  const { conversationRepo, agentRepo } = deps;
  const conversations = new Map<string, Conversation>();
  const playerConversations = new Map<string, string>(); // "playerId:agentId:workspaceId" → convId

  function getGreeting(agent: AgentDef, displayName: string | null): string {
    const name = displayName ?? 'there';
    switch (agent.id) {
      case 'receptionist':
        return `Welcome to BossRoom, ${name}! I'm your office concierge. Tell me what you need — a product launch? Sprint planning? Content creation? — and I'll build you a custom team of AI agents right here in your workspace.`;
      default:
        return `Hi ${name}! I'm ${agent.name}. How can I help you today?`;
    }
  }

  return {
    async startOrRestore(
      playerId: string,
      agentId: string,
      ws: WebSocket,
      displayName: string | null,
      workspaceId: string = 'global',
    ): Promise<StartOrRestoreResult> {
      const convKey = `${playerId}:${agentId}:${workspaceId}`;
      const convId = playerConversations.get(convKey);
      let conv = convId ? conversations.get(convId) : undefined;

      if (conv) {
        // Already in memory — update WS ref
        conv.ws = ws;
        return {
          isNew: false,
          conversation: conv,
          historyMessages: conv.messages.map(m => ({ role: m.role, content: m.content })),
        };
      }

      // Try DB
      try {
        const existing = await conversationRepo.findByUserAndAgent(playerId, agentId, workspaceId);
        if (existing) {
          conv = {
            id: existing.id,
            playerId,
            agentId,
            messages: (existing.messages ?? []) as Conversation['messages'],
            aiMessages: (existing.aiMessages ?? []) as ModelMessage[],
            ws,
          };
          conversations.set(conv.id, conv);
          playerConversations.set(convKey, conv.id);
          return {
            isNew: false,
            conversation: conv,
            historyMessages: conv.messages.map(m => ({ role: m.role, content: m.content })),
          };
        }
      } catch (err) {
        log.error(`[conversation] DB load failed for ${agentId}:`, err);
        // Fall through to create new
      }

      // Brand new conversation
      const agent = agentRepo.get(agentId);
      const dynamicAgent = agent ? undefined : agentRepo.getDynamic(agentId);
      const greeting = agent
        ? getGreeting(agent, displayName)
        : `Hi ${displayName ?? 'there'}! I'm ${dynamicAgent?.name ?? 'an agent'}. How can I help you?`;
      const id = generateConversationId();
      conv = {
        id,
        playerId,
        agentId,
        messages: [{ role: 'assistant', content: greeting, timestamp: new Date().toISOString() }],
        aiMessages: [{ role: 'assistant' as const, content: greeting }],
        ws,
      };
      conversations.set(id, conv);
      playerConversations.set(convKey, id);

      // Persist (best-effort)
      try {
        await conversationRepo.create({
          id,
          userId: playerId,
          agentId,
          workspaceId,
          messages: conv.messages,
          aiMessages: conv.aiMessages,
        });
      } catch (err) {
        log.error(`[conversation] DB create failed for ${agentId}:`, err);
      }

      return { isNew: true, conversation: conv, greeting };
    },

    /** Create conversation in-memory only (for handleMessage when no prior interaction) */
    createInMemory(playerId: string, agentId: string, conversationId: string, ws: WebSocket, workspaceId: string = 'global'): Conversation {
      const convKey = `${playerId}:${agentId}:${workspaceId}`;
      const existing = playerConversations.get(convKey);
      if (existing) {
        const conv = conversations.get(existing);
        if (conv) return conv;
      }

      const id = conversationId || generateConversationId();
      const conv: Conversation = { id, playerId, agentId, messages: [], aiMessages: [], ws };
      conversations.set(id, conv);
      playerConversations.set(convKey, id);
      return conv;
    },

    addUserMessage(convId: string, content: string): void {
      const conv = conversations.get(convId);
      if (conv) {
        conv.messages.push({ role: 'user', content, timestamp: new Date().toISOString() });
      }
    },

    addAssistantMessage(convId: string, content: string): void {
      const conv = conversations.get(convId);
      if (conv) {
        conv.messages.push({ role: 'assistant', content, timestamp: new Date().toISOString() });
      }
    },

    updateAiMessages(convId: string, aiMessages: ModelMessage[]): void {
      const conv = conversations.get(convId);
      if (conv) {
        conv.aiMessages = aiMessages;
      }
    },

    async persistToDb(convId: string): Promise<void> {
      const conv = conversations.get(convId);
      if (!conv) return;
      await conversationRepo.updateMessages(conv.id, conv.messages, conv.aiMessages);
    },

    getConversation(convId: string): Conversation | undefined {
      return conversations.get(convId);
    },

    getConversationForPlayer(playerId: string, agentId: string, workspaceId: string = 'global'): Conversation | undefined {
      const convKey = `${playerId}:${agentId}:${workspaceId}`;
      const convId = playerConversations.get(convKey);
      return convId ? conversations.get(convId) : undefined;
    },

    cleanupPlayer(playerId: string): string[] {
      const agentIds: string[] = [];
      const keysToDelete: string[] = [];
      for (const [key, convId] of playerConversations) {
        if (key.startsWith(`${playerId}:`)) {
          const conv = conversations.get(convId);
          if (conv) {
            agentIds.push(conv.agentId);
          }
          keysToDelete.push(key);
        }
      }
      for (const key of keysToDelete) {
        const convId = playerConversations.get(key)!;
        conversations.delete(convId);
        playerConversations.delete(key);
      }
      return agentIds;
    },

    async resetConversations(playerId: string, agentIds: string[], workspaceId: string = 'global'): Promise<void> {
      for (const agentId of agentIds) {
        const convKey = `${playerId}:${agentId}:${workspaceId}`;
        const convId = playerConversations.get(convKey);
        if (convId) {
          conversations.delete(convId);
          playerConversations.delete(convKey);
        }
      }
      try {
        await conversationRepo.deleteByUserAndAgents(playerId, agentIds);
      } catch (err) {
        log.error(`[conversation] DB delete failed for reset:`, err);
      }
    },
  };
}

export type ConversationService = ReturnType<typeof createConversationService>;
