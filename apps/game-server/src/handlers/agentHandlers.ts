import { WebSocket } from 'ws';
import type { ServerMessage } from '@bossroom/shared-types';
import type { PlayerService } from '../domains/players/service.js';
import type { AgentService } from '../domains/agents/service.js';

interface AgentHandlerDeps {
  players: PlayerService;
  agents: AgentService;
}

export async function handleAgentInteract(
  ws: WebSocket,
  payload: { agentId: string },
  deps: AgentHandlerDeps,
) {
  const { players, agents } = deps;
  const uid = players.getUidByWs(ws);
  if (!uid) return;
  const user = players.getPlayer(uid);
  await agents.handleInteraction(uid, payload.agentId, ws, user?.username ?? null);
}

export function handleAgentMessage(
  ws: WebSocket,
  payload: { agentId: string; conversationId: string; content: string; inputMode?: 'voice' | 'text' },
  deps: AgentHandlerDeps,
) {
  const { players, agents } = deps;
  const uid = players.getUidByWs(ws);
  if (!uid) return;

  // Dynamic agents: scope messages to the owning player only
  // Static agents (receptionist): broadcast to all players
  const isDynamic = agents.isDynamicAgent(payload.agentId);
  const broadcastFn = isDynamic
    ? (msg: ServerMessage) => players.send(ws, msg)
    : (msg: ServerMessage) => players.broadcast(msg);

  agents.handleMessage(
    uid,
    payload.agentId,
    payload.conversationId,
    payload.content,
    payload.inputMode ?? 'text',
    ws,
    broadcastFn,
  );
}

export function handleAgentStopInteract(
  ws: WebSocket,
  payload: { agentId: string },
  deps: AgentHandlerDeps,
) {
  const { players, agents } = deps;
  const uid = players.getUidByWs(ws);
  if (!uid) return;
  agents.stopInteraction(uid, payload.agentId);

  // Dynamic agents: scope status change to the owning player
  const isDynamic = agents.isDynamicAgent(payload.agentId);
  if (isDynamic) {
    players.send(ws, {
      type: 'agent:statusChanged',
      payload: { agentId: payload.agentId, status: 'idle' },
    });
  } else {
    players.broadcast({
      type: 'agent:statusChanged',
      payload: { agentId: payload.agentId, status: 'idle' },
    });
  }
}
