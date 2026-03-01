import { env } from './env.js';
import http from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import { clientMessageSchema, type ClientMessage } from '@bossroom/shared-types';
import { handleComposioAuthRoutes } from './http/composio-auth.js';
import { log } from './logger.js';
import { db } from './db/client.js';
import { createPlayerModule } from './domains/players/module.js';
import { createUserModule } from './domains/users/module.js';
import { createAgentRepository } from './domains/agents/repository.js';
import { createConversationModule } from './domains/conversations/module.js';
import { createAgentModule } from './domains/agents/module.js';
import { createSkillModule } from './domains/skills/module.js';
import { createScratchpadService } from './domains/scratchpad/service.js';
import { createWorkspaceRepository } from './domains/workspaces/repository.js';
import { handlePlayerJoin } from './handlers/playerJoin.js';
import { handlePlayerMove } from './handlers/playerMove.js';
import { handlePlayerSettings } from './handlers/playerSettings.js';
import { handleAgentInteract, handleAgentMessage, handleAgentStopInteract, handleAgentStopBrowserTask } from './handlers/agentHandlers.js';

// --- Composition Root ---
const playerModule = createPlayerModule();
const userModule = createUserModule({ db });
const skillModule = createSkillModule(db);
const scratchpadService = createScratchpadService(db);
const workspaceRepo = createWorkspaceRepository(db);
const agentRepo = createAgentRepository({ workspaceRepo, skillService: skillModule.skillService });
const conversationModule = createConversationModule({ db, agentRepo });
const agentModule = createAgentModule({
  agentRepo,
  conversationService: conversationModule.service,
  playerService: playerModule.service,
  skillService: skillModule.skillService,
  scratchpadService,
  userRepo: userModule.repository,
  workspaceRepo,
});

const players = playerModule.service;
const agents = agentModule.service;
const userRepo = userModule.repository;

// --- Initialize skills (seed receptionist defaults) ---
skillModule.skillService.initialize().then(() => {
  log.info('[startup] Skill service initialized');
}).catch((err) => {
  log.error('[startup] Skill service init failed:', err);
});

// --- HTTP + WebSocket Server ---
const PORT = env.PORT;
const ALLOWED_ORIGIN = env.ALLOWED_ORIGIN || '*';
const PING_INTERVAL_MS = 30_000; // 30s keepalive for Cloud Run
const alive = new WeakSet<WebSocket>();

const server = http.createServer(async (req, res) => {
  // CORS headers for cross-origin requests from Vercel
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (handleComposioAuthRoutes(req, res)) return;

  if (req.method === 'GET' && req.url === '/api/deepgram/token') {
    const deepgramKey = env.DEEPGRAM_API_KEY;
    if (!deepgramKey) {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Deepgram not configured' }));
      return;
    }
    // Return the API key directly as the access_token (hackathon shortcut)
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ access_token: deepgramKey }));
    return;
  }

  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('BossRoom Game Server');
});

const wss = new WebSocketServer({ server });

// Keepalive: ping every 30s to prevent Cloud Run idle timeout (default 5min)
const pingTimer = setInterval(() => {
  for (const ws of wss.clients) {
    if (!alive.has(ws)) {
      ws.terminate();
      continue;
    }
    alive.delete(ws);
    ws.ping();
  }
}, PING_INTERVAL_MS);

// Scratchpad cleanup: prune entries older than 24h every hour
const SCRATCHPAD_PRUNE_INTERVAL_MS = 60 * 60 * 1000;
const SCRATCHPAD_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const pruneTimer = setInterval(() => {
  scratchpadService.pruneOld(SCRATCHPAD_MAX_AGE_MS).catch((err) => {
    log.error('[scratchpad] Prune interval failed:', err);
  });
}, SCRATCHPAD_PRUNE_INTERVAL_MS);

wss.on('close', () => {
  clearInterval(pingTimer);
  clearInterval(pruneTimer);
});

// Track per-connection workspace subscription
const wsSubscriptions = new Map<WebSocket, string>();

wss.on('connection', (ws: WebSocket, req) => {
  const url = req.url ?? '';

  // Retell LLM callback — separate from game WebSocket
  if (url.startsWith('/retell-llm/')) {
    const callId = url.split('/retell-llm/')[1];
    log.info(`[ws] Retell LLM connection for call ${callId}`);
    handleRetellWebSocket(ws, callId);
    return;
  }

  log.debug('[ws] new connection');
  alive.add(ws);
  ws.on('pong', () => alive.add(ws));

  ws.on('message', async (data: Buffer) => {
    try {
      const raw = JSON.parse(data.toString());
      const parsed = clientMessageSchema.safeParse(raw);
      if (!parsed.success) {
        log.warn('[ws] invalid client message:', parsed.error.issues);
        return;
      }
      if (parsed.data.type !== 'player:move') log.debug(`[ws] recv ${parsed.data.type}`);
      await handleMessage(ws, parsed.data);
    } catch (err) {
      log.error('[ws] unparseable message:', err);
    }
  });

  ws.on('close', () => {
    const uid = players.removeByWs(ws);
    if (uid) {
      players.broadcast({ type: 'player:left', payload: { playerId: uid } });
      agents.handleDisconnect(uid);
      wsSubscriptions.delete(ws);
      log.info(`[ws] closed ${uid}`);
    } else {
      log.debug('[ws] closed (unauthenticated)');
    }
  });

  ws.on('error', (err) => {
    const uid = players.getUidByWs(ws);
    log.error(`[ws] error ${uid ?? 'unknown'}:`, err);
  });
});

async function handleMessage(ws: WebSocket, msg: ClientMessage) {
  switch (msg.type) {
    case 'player:join': {
      await handlePlayerJoin(ws, msg.payload, { players, agents, userRepo });
      // Load user's active workspaces from DB and send workspace list
      const uid = players.getUidByWs(ws);
      if (uid) {
        try {
          const userWorkspaces = await workspaceRepo.getActiveWorkspaces(uid);
          // Rehydrate agents for all active workspaces
          for (const workspace of userWorkspaces) {
            if (agentRepo.getByWorkspace(workspace.id).length === 0) {
              await agentRepo.loadFromDb(workspace.id);
            }
          }
          // Send workspace list to frontend
          const workspaceList = userWorkspaces.map(workspace => {
            const wsAgents = agentRepo.getByWorkspace(workspace.id);
            return {
              id: workspace.id,
              taskSummary: workspace.taskSummary,
              status: workspace.status,
              createdAt: workspace.createdAt.toISOString(),
              agentNames: wsAgents.map(a => a.name),
            };
          });
          players.send(ws, { type: 'workspace:list', payload: { workspaces: workspaceList } });
        } catch (err) {
          log.error(`[player:join] Failed to load workspaces for ${uid}:`, err);
        }
      }
      return;
    }
    case 'player:move':
      return handlePlayerMove(ws, msg.payload, players);
    case 'player:updateSettings':
      return handlePlayerSettings(ws, msg.payload, { players, userRepo });
    case 'agent:interact':
      return handleAgentInteract(ws, msg.payload, { players, agents });
    case 'agent:message':
      log.info('[DEBUG-FIX] agent:message received:', JSON.stringify(msg.payload));
      return handleAgentMessage(ws, msg.payload, { players, agents });
    case 'agent:stopInteract':
      return handleAgentStopInteract(ws, msg.payload, { players, agents });
    case 'agent:stopBrowserTask':
      return handleAgentStopBrowserTask(ws, msg.payload, { players, agents });
    case 'voice:talking': {
      const uid = players.getUidByWs(ws);
      if (!uid) return;
      players.broadcast(
        { type: 'voice:playerTalking', payload: { playerId: uid, isTalking: msg.payload.isTalking } },
        uid,
      );
      return;
    }
    case 'workspace:userNote': {
      const uid = players.getUidByWs(ws);
      if (!uid) return;
      const player = players.getPlayer(uid);
      const entry = scratchpadService.write(msg.payload.workspaceId, {
        authorType: 'user',
        authorId: uid,
        authorName: player?.username ?? 'Unknown',
        authorColor: '#818CF8',
        content: msg.payload.content,
      });
      players.send(ws, {
        type: 'workspace:scratchpadEntry',
        payload: {
          workspaceId: msg.payload.workspaceId,
          entry: {
            id: entry.id,
            authorType: entry.authorType,
            authorName: entry.authorName,
            authorColor: entry.authorColor,
            content: entry.content,
            timestamp: entry.timestamp,
          },
        },
      });
      // Trigger scratchpad watcher for user notes too
      agents.onScratchpadWrite(
        msg.payload.workspaceId,
        player?.username ?? 'Unknown',
        msg.payload.content,
        uid,
        ws,
        (m) => players.send(ws, m),
      );
      return;
    }
    case 'workspace:subscribe': {
      const uid = players.getUidByWs(ws);
      if (!uid) return;
      const { workspaceId } = msg.payload;

      // SECURITY: validate ownership
      const workspace = await workspaceRepo.getWorkspace(workspaceId);
      if (!workspace || workspace.userId !== uid) {
        log.warn(`[ws] workspace:subscribe denied — ${uid} does not own ${workspaceId}`);
        return;
      }

      // Ensure agents loaded in memory (idempotent)
      if (agentRepo.getByWorkspace(workspaceId).length === 0) {
        await agentRepo.loadFromDb(workspaceId);
      }

      // Track subscription
      wsSubscriptions.set(ws, workspaceId);

      // Load scratchpad
      const entries = await scratchpadService.loadWorkspace(workspaceId);

      // Build snapshot
      const wsAgents = agentRepo.getByWorkspace(workspaceId);
      const snapshotAgents = wsAgents.map(a => ({
        agentId: a.agentId, workspaceId: a.workspaceId,
        name: a.name, color: a.color, zoneName: a.zoneName,
        personality: a.personality, role: a.role, status: a.status,
        position: a.position, chatHistory: a.chatHistory,
        skills: a.skills.map(s => ({
          id: s.id, agentId: s.agentId, name: s.name,
          description: s.description, creatorType: s.creatorType,
        })),
      }));

      players.send(ws, {
        type: 'workspace:snapshot',
        payload: {
          workspaceId,
          taskSummary: workspace.taskSummary,
          status: workspace.status,
          agents: snapshotAgents,
          scratchpadEntries: entries.map(e => ({
            id: e.id, authorType: e.authorType as 'agent' | 'user', authorName: e.authorName,
            authorColor: e.authorColor, content: e.content, timestamp: e.timestamp,
          })),
        },
      });
      return;
    }
    case 'workspace:archive': {
      const uid = players.getUidByWs(ws);
      if (!uid) return;
      const { workspaceId } = msg.payload;

      // Validate ownership
      const workspace = await workspaceRepo.getWorkspace(workspaceId);
      if (!workspace || workspace.userId !== uid) return;

      // Get agent IDs BEFORE removing from memory
      const workspaceAgentList = agentRepo.getByWorkspace(workspaceId);
      const agentIds = workspaceAgentList.map(a => a.agentId);

      // Archive in DB (workspace, agents, skills archived; scratchpad deleted)
      await workspaceRepo.archiveWorkspace(workspaceId);

      // Clean up in-memory state
      for (const a of workspaceAgentList) {
        agentRepo.removeDynamic(a.agentId);
      }
      scratchpadService.clear(workspaceId);

      // Clean up subscription
      if (wsSubscriptions.get(ws) === workspaceId) {
        wsSubscriptions.delete(ws);
      }

      // Clean up conversations for this workspace
      await conversationModule.service.resetConversations(uid, agentIds, workspaceId);

      log.info(`[workspace] Archived ${workspaceId} for ${uid}`);
      return;
    }
    case 'conversations:reset': {
      // Legacy handler — kept for backward compatibility with old frontends
      const uid = players.getUidByWs(ws);
      if (!uid) return;
      await conversationModule.service.resetConversations(uid, msg.payload.agentIds);
      const workspaceIds = new Set<string>();
      for (const agentId of msg.payload.agentIds) {
        const dynAgent = agentRepo.getDynamic(agentId);
        if (dynAgent) workspaceIds.add(dynAgent.workspaceId);
      }
      for (const wsId of workspaceIds) {
        scratchpadService.clear(wsId);
        for (const a of agentRepo.getByWorkspace(wsId)) {
          agentRepo.removeDynamic(a.agentId);
        }
      }
      log.info(`[conversations] reset ${msg.payload.agentIds.length} conversations for ${uid} (legacy)`);
      return;
    }
    // shop:purchase is no longer used — Buy button sends agent:message through LLM
  }
}

server.listen(PORT, () => {
  log.info(`BossRoom game server on ws://localhost:${PORT}`);
});
