import { WebSocket } from 'ws';
import { streamText, generateText, stepCountIs, type ToolSet } from 'ai';
import type { ServerMessage, DynamicAgent } from '@bossroom/shared-types';
import { TIMEOUTS } from '@bossroom/shared-utils';
import { getModel } from '../../ai/gateway.js';
import { getComposioTools } from '../../ai/composio.js';
import { mcpManager } from '../../ai/mcp.js';
import { synthesizeSpeech } from '../../ai/tts.js';
import { log } from '../../logger.js';
import type { AgentRepository } from './repository.js';
import type { ConversationService } from '../conversations/service.js';
import type { PlayerService } from '../players/service.js';
import type { SkillService } from '../skills/service.js';
import type { ScratchpadService } from '../scratchpad/service.js';
import type { UserRepository } from '../users/repository.js';
import type { WorkspaceRepository } from '../workspaces/repository.js';
import { createSetupWorkspaceTool, createAgentSkillTools, createDelegateTaskTool, createScratchpadTools, createEmbedTools, createFinishTaskTool, createPeekConversationTool } from './skillTools.js';
import { createPaymentTools } from './paymentTools.js';

interface AgentServiceDeps {
  agentRepo: AgentRepository;
  conversationService: ConversationService;
  playerService: PlayerService;
  skillService: SkillService;
  scratchpadService: ScratchpadService;
  userRepo: UserRepository;
  workspaceRepo: WorkspaceRepository;
}

export function createAgentService(deps: AgentServiceDeps) {
  const { agentRepo, conversationService, playerService, skillService, scratchpadService, userRepo, workspaceRepo } = deps;

  /** Guard against duplicate workspace completion triggers. */
  const completedWorkspaces = new Set<string>();

  /**
   * Check if all agents in a workspace are done. If so, trigger the receptionist
   * to compile and deliver a final summary to the user.
   */
  async function checkWorkspaceCompletion(
    workspaceId: string,
    playerId: string,
    ws: WebSocket,
    broadcastFn: (msg: ServerMessage) => void,
  ) {
    if (completedWorkspaces.has(workspaceId)) return;

    const agents = agentRepo.getByWorkspace(workspaceId);
    if (agents.length === 0) return;

    // Completion is lead-driven: trigger when the lead agent calls finish_task.
    // Workers stay idle (available for re-delegation) — we don't wait for them.
    const leadAgent = agents.find(a => a.role === 'lead');
    if (!leadAgent || leadAgent.status !== 'done') {
      const statusMap = agents.map(a => `${a.name}(${a.role})=${a.status}`).join(', ');
      log.debug(`[workspace-completion] ${workspaceId}: waiting for lead — ${statusMap}`);
      return;
    }

    completedWorkspaces.add(workspaceId);
    // Persist workspace status to DB
    void workspaceRepo.updateWorkspaceStatus(workspaceId, 'completed').catch(err =>
      log.error(`[workspace] DB status update failed for ${workspaceId}:`, err)
    );
    log.info(`[workspace] Lead "${leadAgent.name}" done in ${workspaceId}, triggering receptionist summary`);

    // Gather scratchpad (strip auth links to avoid expired URLs in summary)
    const authUrlRe = /https:\/\/connect\.composio\.dev\/\S+/gi;
    const mdAuthLinkRe = /\[([^\]]*)\]\(https:\/\/connect\.composio\.dev\/[^)]+\)/gi;
    const stripAuth = (text: string) => text.replace(mdAuthLinkRe, '').replace(authUrlRe, '').replace(/\n{3,}/g, '\n').trim();

    const entries = scratchpadService.read(workspaceId);
    const feed = entries.map(e => `[${e.authorName}] ${stripAuth(e.content)}`).filter(e => e.length > 20).join('\n');

    // Gather each agent's last assistant message (strip auth links)
    const agentOutputs = agents.filter(a => a.chatHistory.length > 0).map(a => {
      const lastMsg = a.chatHistory.filter(m => m.role === 'assistant').pop();
      const snippet = lastMsg ? stripAuth(lastMsg.content).slice(0, 500) : '(no output)';
      return `[${a.name}] ${snippet}`;
    }).filter(o => !o.endsWith('(no output)')).join('\n\n');

    // Build summary request for receptionist — explicitly tell it NOT to include auth links
    const summaryRequest = `[System] All agents in the workspace have completed their tasks.\n\nTeam feed:\n${feed}\n\nAgent final outputs:\n${agentOutputs}\n\nCompile a final summary for the user. Highlight the key findings from each team member and present the results clearly. If any agent created a document or embed, reference it.\n\nIMPORTANT: Do NOT include any connect.composio.dev links in your response. Do NOT ask the user to connect any services. Just summarize the actual work that was done.`;

    // Trigger receptionist via handleStaticAgentMessage (hidden = don't show system prompt in chat)
    try {
      const summaryText = await handleStaticAgentMessage(playerId, 'receptionist', summaryRequest, 'text', ws, broadcastFn, { hidden: true });

      // Also post the receptionist's summary to the team feed
      if (summaryText) {
        const entry = scratchpadService.write(workspaceId, {
          authorType: 'agent',
          authorId: 'receptionist',
          authorName: 'Reception',
          authorColor: '#FFD700',
          content: summaryText,
        });
        broadcastFn({
          type: 'workspace:scratchpadEntry',
          payload: {
            workspaceId,
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
      }
    } catch (err) {
      log.error(`[workspace] Receptionist summary failed:`, err);
    }
  }

  /**
   * Scratchpad watcher: when an agent (or user) writes to the scratchpad,
   * a cheap classifier decides which idle agent should continue working.
   * Fire-and-forget — never blocks the caller.
   */
  async function routeScratchpadEntry(
    workspaceId: string,
    authorName: string,
    content: string,
    playerId: string,
    ws: WebSocket,
    broadcastFn: (msg: ServerMessage) => void,
  ) {
    try {
      // --- @ mention detection (short-circuits LLM classifier) ---
      const mentionRegex = /@([\w][\w\s]*?[\w]|[\w]+)(?=[\s,.:!?]|$)/g;
      const mentions: string[] = [];
      let mentionMatch: RegExpExecArray | null;
      while ((mentionMatch = mentionRegex.exec(content)) !== null) {
        mentions.push(mentionMatch[1]);
      }

      if (mentions.length > 0) {
        const entries = scratchpadService.read(workspaceId);
        const recentEntries = entries.slice(-15).map(e => `[${e.authorName}] ${e.content}`).join('\n');

        for (const mentionName of mentions) {
          const target = agentRepo.findDynamicByName(mentionName);
          if (!target || target.workspaceId !== workspaceId) continue;
          // Wake agent if idle or done (done agents can be re-engaged for follow-up)
          if (target.status !== 'idle' && target.status !== 'done') continue;

          const injectedMessage = `[Team Chat] @${target.name} was mentioned by ${authorName}:\n"${content}"\n\nRecent team conversation:\n${recentEntries}\n\nIMPORTANT: Start by calling peek_conversation for "${authorName}" to see their recent findings. Then respond with your own work. Post your reply to the scratchpad using write_scratchpad, and @ mention anyone you need input from.`;

          // Fire and forget — don't await, don't block
          handleDynamicAgentMessage(playerId, target.agentId, injectedMessage, ws, broadcastFn)
            .catch(err => log.error(`[mention] Failed to wake ${target.name}:`, err));
        }
        return; // Skip LLM classifier — explicit mentions don't need it
      }

      // --- LLM classifier (fallback when no @ mentions) ---

      // Find idle agents in this workspace (excluding the author)
      const allDynamic = agentRepo.getAllDynamic();
      const idleAgents = allDynamic.filter(
        (a) => a.workspaceId === workspaceId && a.status === 'idle' && a.name !== authorName,
      );

      if (idleAgents.length === 0) return;

      // Get recent scratchpad for context
      const entries = scratchpadService.read(workspaceId);
      const recentEntries = entries.slice(-10).map((e) => `[${e.authorName}] ${e.content}`).join('\n');

      const agentList = idleAgents
        .map((a) => `- ${a.name} (${a.role}): ${a.personality}`)
        .join('\n');

      const model = getModel('gemini');
      const result = await generateText({
        model,
        prompt: `You are a workspace coordinator. An entry was just posted to the team scratchpad.

LATEST ENTRY:
[${authorName}] ${content}

RECENT SCRATCHPAD:
${recentEntries}

IDLE AGENTS AVAILABLE:
${agentList}

Based on the latest entry, should any idle agent continue working? Only wake an agent if:
- The entry contains output or results that another agent needs to act on
- The entry is a handoff (e.g. "done with X, passing to Y")
- The entry is a user directive asking for action

Do NOT wake an agent if:
- The entry is just a status update with no actionable content
- The work described is not relevant to any idle agent
- All necessary work appears to be complete

Respond with EXACTLY one line in this format:
WAKE AgentName: brief instruction of what they should do based on the scratchpad
or:
NONE

No other text.`,
      });

      const response = result.text.trim();

      if (response === 'NONE' || !response.startsWith('WAKE ')) return;

      // Parse: "WAKE AgentName: instruction"
      const match = response.match(/^WAKE\s+(.+?):\s+(.+)$/);
      if (!match) return;

      const [, targetName, instruction] = match;
      const targetAgent = idleAgents.find(
        (a) => a.name.toLowerCase() === targetName.trim().toLowerCase(),
      );
      if (!targetAgent) {
        log.warn(`[scratchpad-watcher] Classifier suggested "${targetName}" but agent not found or not idle`);
        return;
      }

      log.info(`[scratchpad-watcher] Waking ${targetAgent.name}: ${instruction.slice(0, 80)}...`);

      // Inject the latest scratchpad context + instruction into the agent
      const injectedMessage = `[Coordinator] Based on team progress, here's your task:\n\n${instruction}\n\nRecent team updates:\n${recentEntries}`;

      await handleDynamicAgentMessage(playerId, targetAgent.agentId, injectedMessage, ws, broadcastFn);
    } catch (err) {
      log.error('[scratchpad-watcher] Routing failed:', err);
    }
  }

  /**
   * Handle delegation: lead agent sends a task to a worker agent.
   * Runs the worker's LLM with streaming and returns the response.
   */
  // Track pending fire-and-forget delegations per workspace
  const pendingDelegations = new Map<string, number>();

  function incrementPending(workspaceId: string) {
    pendingDelegations.set(workspaceId, (pendingDelegations.get(workspaceId) ?? 0) + 1);
  }
  function decrementPending(workspaceId: string) {
    const n = (pendingDelegations.get(workspaceId) ?? 1) - 1;
    pendingDelegations.set(workspaceId, Math.max(0, n));
  }
  function hasPendingDelegations(workspaceId: string): boolean {
    return (pendingDelegations.get(workspaceId) ?? 0) > 0;
  }

  // Track whether the lead has been nudged to delegate (prevent infinite loops)
  const delegateNudged = new Set<string>();

  async function handleDelegation(
    fromAgentId: string,
    targetName: string,
    taskDescription: string,
    playerId: string,
    ws: WebSocket,
    broadcastFn: (msg: ServerMessage) => void,
  ): Promise<string> {
    const targetAgent = agentRepo.findDynamicByName(targetName);
    if (!targetAgent) {
      // Decrement counter since delegation won't proceed
      const fromAgent = agentRepo.getDynamic(fromAgentId);
      if (fromAgent) decrementPending(fromAgent.workspaceId);
      throw new Error(`Agent "${targetName}" not found in workspace`);
    }

    // Broadcast delegation event to frontend
    broadcastFn({
      type: 'agent:delegatedTask',
      payload: {
        fromAgentId,
        toAgentId: targetAgent.agentId,
        toAgentName: targetAgent.name,
        task: taskDescription,
      },
    });

    // Set target agent to thinking
    agentRepo.setStatus(targetAgent.agentId, 'thinking');
    broadcastFn({
      type: 'agent:statusChanged',
      payload: { agentId: targetAgent.agentId, status: 'thinking' },
    });

    try {
      let calledFinishTask = false;

      const model = getModel(targetAgent.model);

      // Build tools for the worker agent
      const workerSkillTools = createAgentSkillTools({
        skillService,
        agentId: targetAgent.agentId,
        broadcastFn,
      });
      const workerComposioTools = await getComposioTools(playerId);
      const workerMcpTools = await mcpManager.getAllTools();
      const workerTools = { ...workerComposioTools, ...workerMcpTools, ...workerSkillTools };

      const workerScratchpadTools = createScratchpadTools({
        scratchpadService,
        workspaceId: targetAgent.workspaceId,
        agentId: targetAgent.agentId,
        agentName: targetAgent.name,
        agentColor: targetAgent.color,
        broadcastFn: (msg) => playerService.send(ws, msg),
        onEntryWritten: (author, text) => {
          routeScratchpadEntry(targetAgent.workspaceId, author, text, playerId, ws, broadcastFn);
        },
      });
      const workerEmbedTools = createEmbedTools({
        workspaceId: targetAgent.workspaceId,
        agentId: targetAgent.agentId,
        agentName: targetAgent.name,
        broadcastFn: (msg) => playerService.send(ws, msg),
      });
      const workerFinishTaskTools = createFinishTaskTool({
        scratchpadService,
        workspaceId: targetAgent.workspaceId,
        agentId: targetAgent.agentId,
        agentName: targetAgent.name,
        agentColor: targetAgent.color,
        broadcastFn: (msg) => playerService.send(ws, msg),
        onFinished: () => {
          calledFinishTask = true;
          agentRepo.setStatus(targetAgent.agentId, 'done');
          broadcastFn({ type: 'agent:statusChanged', payload: { agentId: targetAgent.agentId, status: 'done' } });
          checkWorkspaceCompletion(targetAgent.workspaceId, playerId, ws, broadcastFn);
        },
      });
      const workerPeekTools = createPeekConversationTool({
        agentRepo,
        workspaceId: targetAgent.workspaceId,
      });
      const workerToolsFinal = { ...workerTools, ...workerScratchpadTools, ...workerEmbedTools, ...workerFinishTaskTools, ...workerPeekTools };

      // Set to working
      agentRepo.setStatus(targetAgent.agentId, 'working');
      broadcastFn({
        type: 'agent:statusChanged',
        payload: { agentId: targetAgent.agentId, status: 'working' },
      });

      // Track user message in chat history
      agentRepo.appendChatHistory(targetAgent.agentId, 'user', taskDescription);

      // Stream the worker's response to the frontend (with tool execution events)
      const result = streamText({
        model,
        system: targetAgent.systemPrompt,
        messages: [{ role: 'user' as const, content: taskDescription }],
        tools: workerToolsFinal,
        stopWhen: stepCountIs(25),
        onChunk: ({ chunk }) => {
          if (chunk.type === 'tool-call') {
            playerService.send(ws, {
              type: 'agent:toolExecution',
              payload: { agentId: targetAgent.agentId, toolName: chunk.toolName, status: 'started' },
            });
          }
        },
        onStepFinish: ({ toolCalls, toolResults }) => {
          for (let i = 0; i < toolCalls.length; i++) {
            const tc = toolCalls[i];
            const tr = toolResults[i];
            const failed = tr && typeof tr === 'object' && 'error' in tr;
            const resultStr = tr != null
              ? (typeof tr === 'string' ? tr : JSON.stringify(tr)).slice(0, 2000)
              : undefined;
            playerService.send(ws, {
              type: 'agent:toolExecution',
              payload: {
                agentId: targetAgent.agentId,
                toolName: tc.toolName,
                status: failed ? 'failed' : 'completed',
                result: resultStr,
              },
            });
          }
        },
      });

      let fullResponse = '';
      for await (const delta of result.textStream) {
        fullResponse += delta;
        playerService.send(ws, {
          type: 'agent:chatStream',
          payload: { agentId: targetAgent.agentId, delta },
        });
      }

      // Log response
      if (fullResponse) {
        log.info(`[delegate] ${targetAgent.name} response (${fullResponse.length} chars): ${fullResponse.slice(0, 200)}${fullResponse.length > 200 ? '...' : ''}`);
        agentRepo.appendChatHistory(targetAgent.agentId, 'assistant', fullResponse);
      } else {
        log.warn(`[delegate] ${targetAgent.name} produced empty text response (tool-only turn)`);
      }

      // Detect auth-only responses and auto-retry WITHOUT showing expired links to user
      const isAuthOnly = /connect\.composio\.dev/i.test(fullResponse) && fullResponse.length < 800 && !calledFinishTask;

      if (isAuthOnly) {
        // Don't send the auth-only message to the user — suppress it entirely
        log.info(`[delegate] Worker ${targetAgent.name} only produced auth links — suppressing and retrying with actual work`);

        // Show a brief status update instead of auth links
        playerService.send(ws, {
          type: 'agent:chatMessage',
          payload: { agentId: targetAgent.agentId, role: 'assistant', content: `working on it without external tools...` },
        });

        agentRepo.appendChatHistory(targetAgent.agentId, 'user',
          '[System] The tools are not connected right now. That is OK. Do NOT ask the user to connect anything. Instead, do your work WITHOUT those tools. Write your complete deliverable (code, analysis, plan, design) directly to the scratchpad using write_scratchpad. Then call finish_task. GO.'
        );

        try {
          const retryResult = streamText({
            model,
            system: targetAgent.systemPrompt,
            messages: [
              { role: 'user' as const, content: taskDescription },
              { role: 'assistant' as const, content: fullResponse },
              { role: 'user' as const, content: '[System] The tools are not connected right now. That is OK. Do NOT ask the user to connect anything. Instead, do your work WITHOUT those tools. Write your complete deliverable (code, analysis, plan, design) directly to the scratchpad using write_scratchpad. Then call finish_task. GO.' },
            ],
            tools: workerToolsFinal,
            stopWhen: stepCountIs(25),
            onChunk: ({ chunk }) => {
              if (chunk.type === 'tool-call') {
                playerService.send(ws, {
                  type: 'agent:toolExecution',
                  payload: { agentId: targetAgent.agentId, toolName: chunk.toolName, status: 'started' },
                });
              }
            },
            onStepFinish: ({ toolCalls, toolResults }) => {
              for (let i = 0; i < toolCalls.length; i++) {
                const tc = toolCalls[i];
                const tr = toolResults[i];
                const failed = tr && typeof tr === 'object' && 'error' in tr;
                const resultStr = tr != null
                  ? (typeof tr === 'string' ? tr : JSON.stringify(tr)).slice(0, 2000)
                  : undefined;
                playerService.send(ws, {
                  type: 'agent:toolExecution',
                  payload: {
                    agentId: targetAgent.agentId,
                    toolName: tc.toolName,
                    status: failed ? 'failed' : 'completed',
                    result: resultStr,
                  },
                });
              }
            },
          });

          let retryResponse = '';
          for await (const delta of retryResult.textStream) {
            retryResponse += delta;
            playerService.send(ws, {
              type: 'agent:chatStream',
              payload: { agentId: targetAgent.agentId, delta },
            });
          }

          if (retryResponse) {
            log.info(`[delegate] ${targetAgent.name} retry response (${retryResponse.length} chars): ${retryResponse.slice(0, 200)}...`);
            agentRepo.appendChatHistory(targetAgent.agentId, 'assistant', retryResponse);
            playerService.send(ws, {
              type: 'agent:chatMessage',
              payload: { agentId: targetAgent.agentId, role: 'assistant', content: retryResponse },
            });
          }
        } catch (retryErr) {
          log.error(`[delegate] Worker ${targetAgent.name} retry failed:`, retryErr);
        }
      } else if (fullResponse) {
        // Normal response (no auth issues) — send to frontend
        playerService.send(ws, {
          type: 'agent:chatMessage',
          payload: { agentId: targetAgent.agentId, role: 'assistant', content: fullResponse },
        });
      }

      // Workers go back to idle after delegation — they can be re-delegated to.
      if (!calledFinishTask) {
        agentRepo.setStatus(targetAgent.agentId, 'idle');
        broadcastFn({
          type: 'agent:statusChanged',
          payload: { agentId: targetAgent.agentId, status: 'idle' },
        });
      }

      decrementPending(targetAgent.workspaceId);
      log.info(`[delegate] Worker ${targetAgent.name} finished (pending: ${pendingDelegations.get(targetAgent.workspaceId) ?? 0})`);

      // If all delegations done and lead is idle/done, trigger completion check
      if (!hasPendingDelegations(targetAgent.workspaceId)) {
        const leadAgent = agentRepo.getByWorkspace(targetAgent.workspaceId).find(a => a.role === 'lead');
        if (leadAgent && (leadAgent.status === 'idle' || leadAgent.status === 'done')) {
          if (leadAgent.status !== 'done') {
            log.info(`[delegate] All workers done — nudging lead ${leadAgent.name} to finish_task`);
            handleDynamicAgentMessage(
              playerId, leadAgent.agentId,
              '[System] All workers have finished their tasks. Call finish_task now with a summary of what the team accomplished.',
              ws, broadcastFn, true,
            ).catch(err => log.error(`[delegate] Nudge failed:`, err));
          }
        }
      }

      return fullResponse;
    } catch (err) {
      log.error(`[delegate] Worker ${targetAgent.name} error:`, err);
      decrementPending(targetAgent.workspaceId);
      agentRepo.setStatus(targetAgent.agentId, 'error');
      broadcastFn({
        type: 'agent:statusChanged',
        payload: { agentId: targetAgent.agentId, status: 'error' },
      });

      setTimeout(() => {
        agentRepo.setStatus(targetAgent.agentId, 'idle');
        broadcastFn({
          type: 'agent:statusChanged',
          payload: { agentId: targetAgent.agentId, status: 'idle' },
        });
      }, TIMEOUTS.AGENT_ERROR_RECOVERY_MS);

      throw err;
    }
  }

  /**
   * Handle workspace build: register dynamic agents and kick off lead agent.
   */
  function handleWorkspaceBuilt(
    dynamicAgents: DynamicAgent[],
    taskSummary: string,
    playerId: string,
    ws: WebSocket,
    broadcastFn: (msg: ServerMessage) => void,
  ) {
    const allTeamNames = dynamicAgents.map((a) => a.name);

    // Register each dynamic agent
    for (const agent of dynamicAgents) {
      const agentSkills = skillService.getSkillsForAgent(agent.agentId);
      agentRepo.registerDynamic(agent, agentSkills, allTeamNames);
    }

    // Auto-kickoff: after a delay (for build animation), send the lead's initial task
    const leadAgent = dynamicAgents.find((a) => a.role === 'lead');
    if (leadAgent?.initialTask) {
      setTimeout(async () => {
        try {
          log.info(`[workspace] Auto-kickoff: ${leadAgent.name} starting on task`);
          await handleDynamicAgentMessage(
            playerId,
            leadAgent.agentId,
            leadAgent.initialTask!,
            ws,
            broadcastFn,
          );
        } catch (err) {
          log.error(`[workspace] Auto-kickoff failed for ${leadAgent.name}:`, err);
        }
      }, 1000); // 1s delay for build animation
    }
  }

  /**
   * Handle a message sent to a dynamic agent.
   */
  async function handleDynamicAgentMessage(
    playerId: string,
    agentId: string,
    content: string,
    ws: WebSocket,
    broadcastFn: (msg: ServerMessage) => void,
    isNudge = false,
    inputMode: 'voice' | 'text' = 'text',
  ) {
    const dynamicAgent = agentRepo.getDynamic(agentId);
    if (!dynamicAgent) {
      log.warn(`[agent] Dynamic agent ${agentId} not found`);
      return;
    }

    // Track user message in chat history
    agentRepo.appendChatHistory(agentId, 'user', content);

    // Status -> thinking
    agentRepo.setStatus(agentId, 'thinking');
    broadcastFn({ type: 'agent:statusChanged', payload: { agentId, status: 'thinking' } });

    try {
      const model = getModel(dynamicAgent.model);

      // --- Tracking flags ---
      let calledFinishTask = false;
      let calledWriteScratchpad = false;

      // Build tools based on role
      const agentSkillToolSet = createAgentSkillTools({
        skillService,
        agentId,
        broadcastFn,
      });

      const composioTools = await getComposioTools(playerId);
      const mcpTools = await mcpManager.getAllTools();

      let tools = { ...composioTools, ...mcpTools, ...agentSkillToolSet };

      const scratchpadTools = createScratchpadTools({
        scratchpadService,
        workspaceId: dynamicAgent.workspaceId,
        agentId,
        agentName: dynamicAgent.name,
        agentColor: dynamicAgent.color,
        broadcastFn: (msg) => playerService.send(ws, msg),
        onEntryWritten: (author, text) => {
          calledWriteScratchpad = true;
          routeScratchpadEntry(dynamicAgent.workspaceId, author, text, playerId, ws, broadcastFn);
        },
      });
      tools = { ...tools, ...scratchpadTools };

      const embedTools = createEmbedTools({
        workspaceId: dynamicAgent.workspaceId,
        agentId,
        agentName: dynamicAgent.name,
        broadcastFn: (msg) => playerService.send(ws, msg),
      });
      tools = { ...tools, ...embedTools };

      // Finish task tool
      const finishTaskTools = createFinishTaskTool({
        scratchpadService,
        workspaceId: dynamicAgent.workspaceId,
        agentId,
        agentName: dynamicAgent.name,
        agentColor: dynamicAgent.color,
        broadcastFn: (msg) => playerService.send(ws, msg),
        onFinished: () => {
          calledFinishTask = true;
          agentRepo.setStatus(agentId, 'done');
          broadcastFn({ type: 'agent:statusChanged', payload: { agentId, status: 'done' } });
          checkWorkspaceCompletion(dynamicAgent.workspaceId, playerId, ws, broadcastFn);
        },
      });
      tools = { ...tools, ...finishTaskTools };

      // Peek conversation tool (all workspace agents)
      const peekTools = createPeekConversationTool({
        agentRepo,
        workspaceId: dynamicAgent.workspaceId,
      });
      tools = { ...tools, ...peekTools };

      // Lead agents get delegate_task tool
      if (dynamicAgent.role === 'lead') {
        const delegateTools = createDelegateTaskTool({
          agentId,
          onDelegate: (targetName, task) =>
            handleDelegation(agentId, targetName, task, playerId, ws, broadcastFn),
          onDelegateStarted: () => incrementPending(dynamicAgent.workspaceId),
          broadcastFn,
        });
        tools = { ...tools, ...delegateTools };
      }

      const hasTools = Object.keys(tools).length > 0;

      const result = streamText({
        model,
        system: dynamicAgent.systemPrompt,
        messages: [{ role: 'user' as const, content }],
        ...(hasTools ? { tools, stopWhen: stepCountIs(25) } : {}),
        onChunk: ({ chunk }) => {
          if (chunk.type === 'tool-call') {
            playerService.send(ws, {
              type: 'agent:toolExecution',
              payload: { agentId, toolName: chunk.toolName, status: 'started' },
            });
          }
        },
        onStepFinish: ({ toolCalls, toolResults }) => {
          for (let i = 0; i < toolCalls.length; i++) {
            const tc = toolCalls[i];
            // Belt-and-suspenders: track tool calls via onStepFinish
            if (tc.toolName === 'finish_task') calledFinishTask = true;
            if (tc.toolName === 'write_scratchpad') calledWriteScratchpad = true;
            const tr = toolResults[i];
            const failed = tr && typeof tr === 'object' && 'error' in tr;
            const resultStr = tr != null
              ? (typeof tr === 'string' ? tr : JSON.stringify(tr))
              : undefined;
            playerService.send(ws, {
              type: 'agent:toolExecution',
              payload: {
                agentId,
                toolName: tc.toolName,
                status: failed ? 'failed' : 'completed',
                result: resultStr,
              },
            });
          }
          if (fullResponse.length > 0) {
            needsStepSeparator = true;
          }
        },
      });

      // Status -> working
      agentRepo.setStatus(agentId, 'working');
      broadcastFn({ type: 'agent:statusChanged', payload: { agentId, status: 'working' } });

      // Stream text deltas to frontend
      let fullResponse = '';
      let needsStepSeparator = false;
      for await (const delta of result.textStream) {
        if (needsStepSeparator) {
          fullResponse += '\n\n';
          playerService.send(ws, {
            type: 'agent:chatStream',
            payload: { agentId, delta: '\n\n' },
          });
          needsStepSeparator = false;
        }
        fullResponse += delta;
        playerService.send(ws, {
          type: 'agent:chatStream',
          payload: { agentId, delta },
        });
      }

      // Log first 200 chars of response for debugging
      if (fullResponse) {
        log.info(`[agent] ${dynamicAgent.name} response (${fullResponse.length} chars): ${fullResponse.slice(0, 200)}${fullResponse.length > 200 ? '...' : ''}`);
      } else {
        log.warn(`[agent] ${dynamicAgent.name} produced empty text response (tool-only turn)`);
      }

      // Track assistant response in chat history
      if (fullResponse) {
        agentRepo.appendChatHistory(agentId, 'assistant', fullResponse);
      }

      // Send complete message — skip if empty (tool-only turns)
      if (fullResponse) {
        playerService.send(ws, {
          type: 'agent:chatMessage',
          payload: { agentId, role: 'assistant', content: fullResponse },
        });

      }

      // TTS: synthesize with hardcoded "Dominus" voice (non-blocking, fail-soft) — voice input only
      if (inputMode === 'voice' && fullResponse) {
        synthesizeSpeech(fullResponse, 'Dominus').then((tts) => {
          if (tts) {
            playerService.send(ws, {
              type: 'agent:ttsAudio',
              payload: { agentId, audioBase64: tts.audioBase64, mimeType: tts.mimeType },
            });
          }
        }).catch((err) => {
          log.error(`[TTS] failed for dynamic agent ${agentId}:`, err);
        });
      }

      // --- POST-STREAM: Nudge check ---
      if (calledFinishTask) {
        // Status already 'done' from callback — nothing to do
      } else if (dynamicAgent.role === 'lead') {
        // Lead owns workspace completion. Check both agent status AND pending delegation counter.
        agentRepo.setStatus(agentId, 'idle');
        broadcastFn({ type: 'agent:statusChanged', payload: { agentId, status: 'idle' } });

        const workspaceAgents = agentRepo.getByWorkspace(dynamicAgent.workspaceId);
        const anyBusy = workspaceAgents.some(
          a => a.agentId !== agentId && (a.status === 'working' || a.status === 'thinking'),
        );
        const pending = hasPendingDelegations(dynamicAgent.workspaceId);

        const workersExist = workspaceAgents.some(a => a.agentId !== agentId && a.role === 'worker');
        const neverDelegated = !anyBusy && !pending && workersExist && !delegateNudged.has(dynamicAgent.workspaceId);

        if (neverDelegated) {
          delegateNudged.add(dynamicAgent.workspaceId);
          log.info(`[nudge] Lead ${dynamicAgent.name} never delegated — nudging to delegate tasks`);
          await handleDynamicAgentMessage(
            playerId, agentId,
            '[System] You MUST delegate tasks to your team NOW using delegate_task. You have not delegated anything yet. Call delegate_task for each team member immediately. Do NOT do anything else first.',
            ws, broadcastFn, true,
          );
        } else if (!anyBusy && !pending) {
          log.info(`[nudge] Lead ${dynamicAgent.name} done, all workers settled — nudging to finish_task`);
          await handleDynamicAgentMessage(
            playerId, agentId,
            '[System] All workers have finished. Call finish_task now with a summary of what the team accomplished.',
            ws, broadcastFn, true,
          );
        } else {
          log.info(`[nudge] Lead ${dynamicAgent.name} idle, workers busy=${anyBusy} pending=${pending} — workers will trigger finish when done`);
        }
        return;
      } else if (!calledWriteScratchpad && !isNudge) {
        // Worker agents: nudge only if they didn't signal at all
        log.info(`[nudge] ${dynamicAgent.name} stopped without finish_task or write_scratchpad, nudging...`);
        agentRepo.setStatus(agentId, 'idle');
        broadcastFn({ type: 'agent:statusChanged', payload: { agentId, status: 'idle' } });
        await handleDynamicAgentMessage(
          playerId, agentId,
          '[System] Please call finish_task with a summary of what you accomplished.',
          ws, broadcastFn, true,
        );
        return;
      } else {
        agentRepo.setStatus(agentId, 'idle');
        broadcastFn({ type: 'agent:statusChanged', payload: { agentId, status: 'idle' } });
      }

    } catch (err) {
      log.error(`Dynamic Agent ${agentId} error:`, err);

      agentRepo.setStatus(agentId, 'error');
      broadcastFn({ type: 'agent:statusChanged', payload: { agentId, status: 'error' } });

      playerService.send(ws, {
        type: 'agent:chatMessage',
        payload: {
          agentId,
          role: 'assistant',
          content: "Oops, I hit a snag! My circuits got a bit tangled. Could you try again?",
        },
      });

      setTimeout(() => {
        agentRepo.setStatus(agentId, 'idle');
        broadcastFn({ type: 'agent:statusChanged', payload: { agentId, status: 'idle' } });
      }, TIMEOUTS.AGENT_ERROR_RECOVERY_MS);
    }
  }

  /**
   * Handle a message sent to a static agent (e.g. receptionist).
   * Extracted so checkWorkspaceCompletion can reuse it.
   */
  async function handleStaticAgentMessage(
    playerId: string,
    agentId: string,
    content: string,
    inputMode: 'voice' | 'text',
    ws: WebSocket,
    broadcastFn: (msg: ServerMessage) => void,
    options?: { hidden?: boolean },
  ) {
    const agent = agentRepo.get(agentId);
    if (!agent) return;

    // Find or create conversation
    let conv = conversationService.getConversationForPlayer(playerId, agentId);

    if (!conv) {
      conv = conversationService.createInMemory(playerId, agentId, '', ws);
    }

    // Add user message to display history (skip for system-triggered messages)
    if (!options?.hidden) {
      conversationService.addUserMessage(conv.id, content);
    }

    // Status -> thinking
    agentRepo.setStatus(agentId, 'thinking');
    broadcastFn({ type: 'agent:statusChanged', payload: { agentId, status: 'thinking' } });

    try {
      const model = getModel(agent.model);
      const composioTools = await getComposioTools(playerId);
      const mcpTools = await mcpManager.getAllTools();

      // Receptionist gets setup_workspace tool
      const setupTool = agentId === 'receptionist'
        ? createSetupWorkspaceTool({
            skillService,
            playerId,
            broadcastFn,
            onWorkspaceBuilt: (agents, taskSummary) =>
              handleWorkspaceBuilt(agents, taskSummary, playerId, ws, broadcastFn),
            getDynamicAgentCount: () => agentRepo.getAllDynamic().length,
            workspaceRepo,
          })
        : {};

      // Shopkeeper gets display_products (search & payment via Composio tools)
      const shopkeeperTools: ToolSet = agentId === 'shopkeeper'
        ? createPaymentTools({
            playerId,
            broadcastFn: (msg) => playerService.send(ws, msg),
          })
        : {};

      const tools = { ...composioTools, ...mcpTools, ...setupTool, ...shopkeeperTools };
      const hasTools = Object.keys(tools).length > 0;

      // Build AI SDK messages
      const aiMessages = [
        ...conv.aiMessages,
        { role: 'user' as const, content },
      ];

      const result = streamText({
        model,
        system: agent.systemPrompt,
        messages: aiMessages,
        ...(hasTools ? { tools, stopWhen: stepCountIs(25) } : {}),
        onChunk: ({ chunk }) => {
          if (chunk.type === 'tool-call') {
            playerService.send(ws, {
              type: 'agent:toolExecution',
              payload: { agentId, toolName: chunk.toolName, status: 'started' },
            });
          }
        },
        onStepFinish: ({ toolCalls, toolResults }) => {
          for (let i = 0; i < toolCalls.length; i++) {
            const tc = toolCalls[i];
            const tr = toolResults[i];
            const failed = tr && typeof tr === 'object' && 'error' in tr;
            const resultStr = tr != null
              ? (typeof tr === 'string' ? tr : JSON.stringify(tr))
              : undefined;
            playerService.send(ws, {
              type: 'agent:toolExecution',
              payload: {
                agentId,
                toolName: tc.toolName,
                status: failed ? 'failed' : 'completed',
                result: resultStr,
              },
            });
          }
          if (fullResponse.length > 0) {
            needsStepSeparator = true;
          }
        },
      });

      // Status -> working
      agentRepo.setStatus(agentId, 'working');
      broadcastFn({ type: 'agent:statusChanged', payload: { agentId, status: 'working' } });

      // Stream text deltas to frontend
      let fullResponse = '';
      let needsStepSeparator = false;
      for await (const delta of result.textStream) {
        if (needsStepSeparator) {
          fullResponse += '\n\n';
          playerService.send(ws, {
            type: 'agent:chatStream',
            payload: { agentId, delta: '\n\n' },
          });
          needsStepSeparator = false;
        }
        fullResponse += delta;
        playerService.send(ws, {
          type: 'agent:chatStream',
          payload: { agentId, delta },
        });
      }

      // Store AI SDK response messages for multi-turn tool context
      const response = await result.response;
      conversationService.addAssistantMessage(conv.id, fullResponse);
      conversationService.updateAiMessages(conv.id, [
        ...conv.aiMessages,
        { role: 'user' as const, content },
        ...response.messages,
      ]);

      // Persist to DB (best-effort)
      try {
        await conversationService.persistToDb(conv.id);
      } catch (err) {
        log.error(`[agent] DB save failed for conversation ${conv.id}:`, err);
      }

      // Log first 200 chars of response for debugging
      if (fullResponse) {
        log.info(`[agent] ${agentId} response (${fullResponse.length} chars): ${fullResponse.slice(0, 200)}${fullResponse.length > 200 ? '...' : ''}`);
      } else {
        log.warn(`[agent] ${agentId} produced empty text response (tool-only turn)`);
      }

      // Send complete message (signals end of stream to frontend) — skip if empty
      if (fullResponse) {
        playerService.send(ws, {
          type: 'agent:chatMessage',
          payload: { agentId, role: 'assistant', content: fullResponse },
        });

      }

      // TTS: synthesize and send audio (non-blocking, fail-soft) — voice input only
      if (inputMode === 'voice' && fullResponse) {
        const userSettings = await userRepo.getSettings(playerId);
        synthesizeSpeech(fullResponse, userSettings.voiceId).then((tts) => {
          if (tts) {
            playerService.send(ws, {
              type: 'agent:ttsAudio',
              payload: { agentId, audioBase64: tts.audioBase64, mimeType: tts.mimeType },
            });
          }
        }).catch((err) => {
          log.error(`[TTS] failed for agent ${agentId}:`, err);
        });
      }

      // Reset status
      agentRepo.setStatus(agentId, 'idle');
      broadcastFn({ type: 'agent:statusChanged', payload: { agentId, status: 'idle' } });

      return fullResponse;

    } catch (err) {
      log.error(`Agent ${agentId} error:`, err);

      agentRepo.setStatus(agentId, 'error');
      broadcastFn({ type: 'agent:statusChanged', payload: { agentId, status: 'error' } });

      playerService.send(ws, {
        type: 'agent:chatMessage',
        payload: {
          agentId,
          role: 'assistant',
          content: "Oops, I hit a snag! My circuits got a bit tangled. Could you try again?",
        },
      });

      setTimeout(() => {
        agentRepo.setStatus(agentId, 'idle');
        broadcastFn({ type: 'agent:statusChanged', payload: { agentId, status: 'idle' } });
      }, TIMEOUTS.AGENT_ERROR_RECOVERY_MS);

      return '';
    }
  }

  return {
    getAgentStates() {
      return agentRepo.getAll();
    },

    /** Check if an agent is a dynamic (workspace) agent. */
    isDynamicAgent(agentId: string): boolean {
      return !!agentRepo.getDynamic(agentId);
    },

    async handleInteraction(playerId: string, agentId: string, ws: WebSocket, displayName: string | null) {
      // Check static agents first, then dynamic
      const agent = agentRepo.get(agentId);
      const dynamicAgent = agent ? undefined : agentRepo.getDynamic(agentId);

      if (!agent && !dynamicAgent) return;

      // Dynamic agents: send their in-memory chatHistory so the frontend is up to date.
      if (dynamicAgent) {
        // Only set to listening if the agent isn't busy (delegation may be in progress)
        const currentStatus = agentRepo.getStatus(agentId);
        if (currentStatus === 'idle') {
          agentRepo.setStatus(agentId, 'listening');
        }

        // Send chat history so switching workspaces always shows the latest state
        const chatHistory = dynamicAgent.chatHistory;
        if (chatHistory.length > 0) {
          playerService.send(ws, {
            type: 'agent:conversationHistory',
            payload: {
              agentId,
              messages: chatHistory as Array<{ role: 'user' | 'assistant'; content: string }>,
            },
          });
        }
        return;
      }

      // Static agents: restore or create conversation
      const result = await conversationService.startOrRestore(playerId, agentId, ws, displayName);

      if (result.isNew) {
        playerService.send(ws, {
          type: 'agent:chatMessage',
          payload: { agentId, role: 'assistant', content: result.greeting },
        });
      } else {
        playerService.send(ws, {
          type: 'agent:conversationHistory',
          payload: {
            agentId,
            messages: result.historyMessages as Array<{ role: 'user' | 'assistant'; content: string }>,
          },
        });
      }

      agentRepo.setStatus(agentId, 'listening');
    },

    async handleMessage(
      playerId: string,
      agentId: string,
      conversationId: string,
      content: string,
      inputMode: 'voice' | 'text',
      ws: WebSocket,
      broadcastFn: (msg: ServerMessage) => void,
    ) {
      // Check if this is a dynamic agent
      const dynamicAgent = agentRepo.getDynamic(agentId);
      if (dynamicAgent) {
        return handleDynamicAgentMessage(playerId, agentId, content, ws, broadcastFn, false, inputMode);
      }

      // Static agent (Receptionist/Shopkeeper) — delegate to extracted helper
      return handleStaticAgentMessage(playerId, agentId, content, inputMode, ws, broadcastFn);
    },

    stopInteraction(playerId: string, agentId: string) {
      // Don't reset to idle if the agent is actively working (e.g. delegation in progress)
      const currentStatus = agentRepo.getStatus(agentId);
      if (currentStatus === 'working' || currentStatus === 'thinking') return;
      agentRepo.setStatus(agentId, 'idle');
    },

    handleDisconnect(playerId: string) {
      const agentIds = conversationService.cleanupPlayer(playerId);
      for (const agentId of agentIds) {
        agentRepo.setStatus(agentId, 'idle');
      }
    },

    /** Trigger scratchpad watcher from external callers (e.g. user notes). */
    onScratchpadWrite(
      workspaceId: string,
      authorName: string,
      content: string,
      playerId: string,
      ws: WebSocket,
      broadcastFn: (msg: ServerMessage) => void,
    ) {
      routeScratchpadEntry(workspaceId, authorName, content, playerId, ws, broadcastFn);
    },
  };
}

export type AgentService = ReturnType<typeof createAgentService>;
