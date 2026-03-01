import { z } from 'zod';
import { agentSkillSchema, agentStatusSchema, skillSummarySchema, dynamicAgentSchema } from './agents.js';

const positionSchema = z.tuple([z.number(), z.number(), z.number()]);

// --- Client → Server ---
export const clientMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('player:join'), payload: z.object({ username: z.string(), token: z.string() }) }),
  z.object({ type: z.literal('player:move'), payload: z.object({ position: positionSchema, rotation: z.number(), animation: z.string() }) }),
  z.object({ type: z.literal('agent:interact'), payload: z.object({ agentId: z.string() }) }),
  z.object({ type: z.literal('agent:message'), payload: z.object({ agentId: z.string(), conversationId: z.string(), content: z.string(), inputMode: z.enum(['voice', 'text']).default('text'), purchaseMode: z.enum(['approval', 'autonomous']).optional(), purchaseBudget: z.number().optional() }) }),
  z.object({ type: z.literal('agent:stopInteract'), payload: z.object({ agentId: z.string() }) }),
  z.object({ type: z.literal('player:updateSettings'), payload: z.object({ avatarId: z.string().optional(), voiceId: z.string().optional() }) }),
  z.object({ type: z.literal('voice:talking'), payload: z.object({ isTalking: z.boolean(), targetPlayerId: z.string().nullable() }) }),
  z.object({ type: z.literal('workspace:userNote'), payload: z.object({ workspaceId: z.string(), content: z.string() }) }),
  z.object({ type: z.literal('workspace:subscribe'), payload: z.object({ workspaceId: z.string() }) }),
  z.object({ type: z.literal('workspace:archive'), payload: z.object({ workspaceId: z.string() }) }),
  z.object({ type: z.literal('conversations:reset'), payload: z.object({ agentIds: z.array(z.string()) }) }),
  // Browser task control
  z.object({ type: z.literal('agent:stopBrowserTask'), payload: z.object({ agentId: z.string() }) }),
  // Direct purchase (bypasses LLM)
  z.object({ type: z.literal('shop:purchase'), payload: z.object({
    productName: z.string(),
    productUrl: z.string(),
    amount: z.number(),
    currency: z.string(),
    merchantName: z.string(),
    merchantUrl: z.string(),
  }) }),
]);
export type ClientMessage = z.infer<typeof clientMessageSchema>;

// --- Player & World state (used in server messages) ---
export const playerStateSchema = z.object({
  id: z.string(),
  username: z.string(),
  email: z.string(),
  photoURL: z.string().nullable(),
  position: positionSchema,
  rotation: z.number(),
  animation: z.string(),
  avatarId: z.string(),
  /** Raw user preference (e.g. 'random'). Only sent to the player themselves. */
  avatarPreference: z.string().optional(),
  /** User's voice preference for TTS. Only sent to the player themselves. */
  voiceId: z.string().optional(),
});
export type PlayerState = z.infer<typeof playerStateSchema>;

export const worldStateSchema = z.object({
  players: z.record(z.string(), playerStateSchema),
  agents: z.record(z.string(), agentSkillSchema.extend({ status: agentStatusSchema })),
});
export type WorldState = z.infer<typeof worldStateSchema>;

// --- Server → Client ---
export const serverMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('world:state'), payload: worldStateSchema }),
  z.object({ type: z.literal('player:joined'), payload: playerStateSchema }),
  z.object({ type: z.literal('player:left'), payload: z.object({ playerId: z.string() }) }),
  z.object({ type: z.literal('player:moved'), payload: z.object({ playerId: z.string(), position: positionSchema, rotation: z.number(), animation: z.string() }) }),
  z.object({ type: z.literal('agent:statusChanged'), payload: z.object({ agentId: z.string(), status: agentStatusSchema }) }),
  z.object({ type: z.literal('agent:chatMessage'), payload: z.object({ agentId: z.string(), role: z.enum(['assistant', 'user']), content: z.string() }) }),
  z.object({ type: z.literal('agent:chatStream'), payload: z.object({ agentId: z.string(), delta: z.string() }) }),
  z.object({ type: z.literal('agent:toolExecution'), payload: z.object({ agentId: z.string(), toolName: z.string(), status: z.enum(['started', 'completed', 'failed']), result: z.string().optional() }) }),
  z.object({ type: z.literal('auth:error'), payload: z.object({ message: z.string() }) }),
  z.object({ type: z.literal('agent:conversationHistory'), payload: z.object({ agentId: z.string(), messages: z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string() })) }) }),
  z.object({ type: z.literal('agent:ttsAudio'), payload: z.object({ agentId: z.string(), audioBase64: z.string(), mimeType: z.string() }) }),
  z.object({ type: z.literal('player:avatarChanged'), payload: z.object({ playerId: z.string(), avatarId: z.string() }) }),
  // Dynamic workspace + skills
  z.object({ type: z.literal('workspace:build'), payload: z.object({ agents: z.array(dynamicAgentSchema), taskSummary: z.string() }) }),
  z.object({ type: z.literal('agent:skills'), payload: z.object({ agentId: z.string(), skills: z.array(skillSummarySchema) }) }),
  z.object({ type: z.literal('agent:skillCreated'), payload: z.object({ agentId: z.string(), skill: skillSummarySchema }) }),
  z.object({ type: z.literal('agent:delegatedTask'), payload: z.object({ fromAgentId: z.string(), toAgentId: z.string(), toAgentName: z.string(), task: z.string() }) }),
  z.object({ type: z.literal('voice:playerTalking'), payload: z.object({ playerId: z.string(), isTalking: z.boolean() }) }),
  z.object({ type: z.literal('workspace:scratchpadEntry'), payload: z.object({
    workspaceId: z.string(),
    entry: z.object({
      id: z.string(),
      authorType: z.enum(['agent', 'user']),
      authorName: z.string(),
      authorColor: z.string(),
      content: z.string(),
      timestamp: z.number(),
    }),
  }) }),
  z.object({ type: z.literal('workspace:scratchpadHistory'), payload: z.object({
    workspaceId: z.string(),
    entries: z.array(z.object({
      id: z.string(),
      authorType: z.enum(['agent', 'user']),
      authorName: z.string(),
      authorColor: z.string(),
      content: z.string(),
      timestamp: z.number(),
    })),
  }) }),
  z.object({ type: z.literal('agent:actionRequired'), payload: z.object({
    agentId: z.string(),
    agentName: z.string(),
    content: z.string(),
    kind: z.enum(['auth', 'question']),
  }) }),
  z.object({ type: z.literal('workspace:embedPanel'), payload: z.object({
    workspaceId: z.string(),
    embed: z.object({
      id: z.string(),
      url: z.string(),
      title: z.string(),
      type: z.enum(['document', 'board', 'spreadsheet', 'presentation', 'other']),
      agentId: z.string(),
      agentName: z.string(),
    }),
  }) }),
  // Shopping product cards
  z.object({ type: z.literal('agent:productCards'), payload: z.object({
    agentId: z.string(),
    products: z.array(z.object({
      name: z.string(),
      price: z.number(),
      currency: z.string(),
      rating: z.number().optional(),
      retailer: z.string(),
      url: z.string(),
      imageUrl: z.string().optional(),
      description: z.string(),
      freeShipping: z.boolean().optional(),
      recommended: z.boolean().optional(),
    })),
  }) }),
  // Browser-use live status
  z.object({ type: z.literal('agent:browserUseStatus'), payload: z.object({
    agentId: z.string(),
    agentName: z.string(),
    active: z.boolean(),
    liveUrl: z.string().optional(),
  }) }),
  // Direct purchase result
  z.object({ type: z.literal('shop:purchaseResult'), payload: z.object({
    success: z.boolean(),
    orderId: z.string().optional(),
    productName: z.string(),
    amount: z.number(),
    currency: z.string().optional(),
    merchantName: z.string().optional(),
    error: z.string().optional(),
  }) }),
  z.object({ type: z.literal('workspace:snapshot'), payload: z.object({
    workspaceId: z.string(),
    taskSummary: z.string(),
    status: z.string(),
    agents: z.array(z.object({
      agentId: z.string(), workspaceId: z.string(), name: z.string(), color: z.string(),
      zoneName: z.string(), personality: z.string(), role: z.string(), status: z.string(),
      position: z.tuple([z.number(), z.number(), z.number()]),
      chatHistory: z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string() })),
      skills: z.array(skillSummarySchema),
    })),
    scratchpadEntries: z.array(z.object({
      id: z.string(), authorType: z.enum(['agent', 'user']),
      authorName: z.string(), authorColor: z.string(),
      content: z.string(), timestamp: z.number(),
    })),
  }) }),
  z.object({ type: z.literal('workspace:list'), payload: z.object({
    workspaces: z.array(z.object({
      id: z.string(), taskSummary: z.string(), status: z.string(),
      createdAt: z.string(), agentNames: z.array(z.string()),
    })),
  }) }),
]);
export type ServerMessage = z.infer<typeof serverMessageSchema>;
