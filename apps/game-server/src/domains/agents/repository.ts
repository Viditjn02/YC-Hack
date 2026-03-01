import type { AgentStatus, DynamicAgent, Skill } from '@bossroom/shared-types';
import { AGENT_DEFS, type AgentDef } from '@bossroom/shared-utils';
import { compileSystemPrompt } from './promptCompiler.js';
import { log } from '../../logger.js';
import type { WorkspaceRepository } from '../workspaces/repository.js';
import type { SkillService } from '../skills/service.js';

/** Static agent with status tracking. */
type AgentWithStatus = AgentDef & { status: AgentStatus };

/** Dynamic agent registered at runtime by the Receptionist. */
export interface RegisteredDynamicAgent {
  agentId: string;
  workspaceId: string;
  name: string;
  color: string;
  zoneName: string;
  personality: string;
  role: 'lead' | 'worker';
  systemPrompt: string;      // compiled from promptCompiler
  model: 'gemini';           // all dynamic agents use gemini for now
  status: AgentStatus;
  position: [number, number, number];
  skills: Skill[];
  teamMembers: string[];     // names of other agents (for lead and workers)
  initialTask?: string;
  chatHistory: Array<{ role: 'user' | 'assistant'; content: string }>;
}

export function createAgentRepository(deps: { workspaceRepo: WorkspaceRepository; skillService: SkillService }) {
  const { workspaceRepo, skillService } = deps;
  const agents = new Map<string, AgentWithStatus>();
  const dynamicAgents = new Map<string, RegisteredDynamicAgent>();
  const activeBrowserTasks = new Map<string, string>(); // agentId → browser-use taskId

  // Initialize from AGENT_DEFS (only Receptionist now)
  for (const agent of AGENT_DEFS) {
    agents.set(agent.id, { ...agent, status: 'idle' });
  }

  return {
    /** Get all static agents with status (for world:state). */
    getAll(): Record<string, AgentWithStatus> {
      const result: Record<string, AgentWithStatus> = {};
      for (const [id, agent] of agents) {
        result[id] = agent;
      }
      return result;
    },

    /** Get a static agent by ID. */
    get(id: string): AgentWithStatus | undefined {
      return agents.get(id);
    },

    /** Set status for either static or dynamic agents. */
    setStatus(id: string, status: AgentStatus): void {
      const agent = agents.get(id);
      if (agent) {
        agent.status = status;
        return;
      }
      const dynamic = dynamicAgents.get(id);
      if (dynamic) {
        dynamic.status = status;
        // Write-through to DB (fire-and-forget)
        void workspaceRepo.updateAgentStatus(id, status).catch(err =>
          log.error(`[agent-repo] DB status update failed for ${id}:`, err)
        );
        // Flush chat history when agent finishes
        if (status === 'done') {
          void workspaceRepo.updateAgentChatHistory(id, dynamic.chatHistory).catch(err =>
            log.error(`[agent-repo] DB chat flush failed for ${id}:`, err)
          );
        }
      }
    },

    /** Get status of any agent. */
    getStatus(id: string): AgentStatus | undefined {
      const agent = agents.get(id);
      if (agent) return agent.status;
      const dynamic = dynamicAgents.get(id);
      return dynamic?.status;
    },

    // --- Dynamic agent support ---

    /** Register a dynamic agent created by the Receptionist LLM. */
    registerDynamic(
      agent: DynamicAgent,
      skills: Skill[],
      allTeamMembers: string[],
    ): RegisteredDynamicAgent {
      const teamMembers = allTeamMembers.filter((n) => n !== agent.name);
      const systemPrompt = compileSystemPrompt(
        { name: agent.name, personality: agent.personality, zoneName: agent.zoneName },
        skills,
        {
          isLead: agent.role === 'lead',
          teamMembers,
          hasWorkspace: true,
        },
      );

      const registered: RegisteredDynamicAgent = {
        agentId: agent.agentId,
        workspaceId: agent.workspaceId,
        name: agent.name,
        color: agent.color,
        zoneName: agent.zoneName,
        personality: agent.personality,
        role: agent.role,
        systemPrompt,
        model: 'gemini',
        status: 'idle',
        position: agent.position,
        skills,
        teamMembers,
        initialTask: agent.initialTask,
        chatHistory: [],
      };

      dynamicAgents.set(agent.agentId, registered);
      log.info(`[agent-repo] Registered dynamic agent: ${agent.name} (${agent.agentId}, ${agent.role})`);

      // Write-through to DB (fire-and-forget)
      void workspaceRepo.upsertWorkspaceAgent({
        agentId: registered.agentId,
        workspaceId: registered.workspaceId,
        name: registered.name,
        color: registered.color,
        zoneName: registered.zoneName,
        personality: registered.personality,
        role: registered.role,
        systemPrompt: registered.systemPrompt,
        status: registered.status,
        position: registered.position,
        chatHistory: registered.chatHistory,
        initialTask: registered.initialTask ?? null,
        teamMembers: registered.teamMembers,
      }).catch(err =>
        log.error(`[agent-repo] DB upsert failed for ${registered.agentId}:`, err)
      );

      return registered;
    },

    /** Get a dynamic agent by ID. */
    getDynamic(id: string): RegisteredDynamicAgent | undefined {
      return dynamicAgents.get(id);
    },

    /** Find a dynamic agent by name (case-insensitive). */
    findDynamicByName(name: string): RegisteredDynamicAgent | undefined {
      const lower = name.toLowerCase();
      for (const agent of dynamicAgents.values()) {
        if (agent.name.toLowerCase() === lower) return agent;
      }
      return undefined;
    },

    /** Get all dynamic agents. */
    getAllDynamic(): RegisteredDynamicAgent[] {
      return Array.from(dynamicAgents.values());
    },

    /** Remove a single dynamic agent by ID. */
    removeDynamic(agentId: string): void {
      dynamicAgents.delete(agentId);
    },

    /** Clear all dynamic agents (workspace reset). */
    clearDynamic(): void {
      dynamicAgents.clear();
    },

    /** Get all dynamic agents for a specific workspace. */
    getByWorkspace(workspaceId: string): RegisteredDynamicAgent[] {
      return [...dynamicAgents.values()].filter(a => a.workspaceId === workspaceId);
    },

    /** Append a chat message to an agent's history (keeps last 50). */
    appendChatHistory(agentId: string, role: 'user' | 'assistant', content: string): void {
      const agent = dynamicAgents.get(agentId);
      if (!agent) return;
      agent.chatHistory.push({ role, content });
      if (agent.chatHistory.length > 50) agent.chatHistory.shift();
      // Write-through to DB (fire-and-forget)
      void workspaceRepo.updateAgentChatHistory(agentId, agent.chatHistory).catch(err =>
        log.error(`[agent-repo] DB chat history update failed for ${agentId}:`, err)
      );
    },

    /** Get the last N messages from an agent's chat history. */
    getChatHistory(agentId: string, lastN = 5): Array<{ role: 'user' | 'assistant'; content: string }> {
      const agent = dynamicAgents.get(agentId);
      if (!agent) return [];
      return agent.chatHistory.slice(-lastN);
    },

    /** Load agents from DB for a workspace (rehydration). Idempotent — skips already-loaded agents. */
    async loadFromDb(workspaceId: string): Promise<RegisteredDynamicAgent[]> {
      const rows = await workspaceRepo.getWorkspaceAgents(workspaceId);
      const loaded: RegisteredDynamicAgent[] = [];
      for (const row of rows) {
        if (dynamicAgents.has(row.agentId)) {
          loaded.push(dynamicAgents.get(row.agentId)!);
          continue;
        }
        const skills = skillService.getSkillsForAgent(row.agentId);
        const registered: RegisteredDynamicAgent = {
          agentId: row.agentId,
          workspaceId: row.workspaceId,
          name: row.name,
          color: row.color,
          zoneName: row.zoneName,
          personality: row.personality,
          role: row.role as 'lead' | 'worker',
          systemPrompt: row.systemPrompt,
          model: 'gemini',
          status: 'idle', // Always start as idle on rehydration
          position: row.position as [number, number, number],
          skills,
          teamMembers: (row.teamMembers ?? []) as string[],
          initialTask: row.initialTask ?? undefined,
          chatHistory: (row.chatHistory ?? []) as Array<{ role: 'user' | 'assistant'; content: string }>,
        };
        dynamicAgents.set(row.agentId, registered);
        loaded.push(registered);
        log.info(`[agent-repo] Rehydrated agent: ${registered.name} (${registered.agentId})`);
      }
      return loaded;
    },

    // --- Browser task tracking ---

    setBrowserTask(agentId: string, taskId: string): void {
      activeBrowserTasks.set(agentId, taskId);
    },

    getBrowserTask(agentId: string): string | undefined {
      return activeBrowserTasks.get(agentId);
    },

    clearBrowserTask(agentId: string): void {
      activeBrowserTasks.delete(agentId);
    },

    /** Load all agents for all active workspaces of a user. */
    async loadAllForUser(userId: string): Promise<void> {
      const workspaceList = await workspaceRepo.getActiveWorkspaces(userId);
      for (const ws of workspaceList) {
        await this.loadFromDb(ws.id);
      }
    },
  };
}

export type AgentRepository = ReturnType<typeof createAgentRepository>;
