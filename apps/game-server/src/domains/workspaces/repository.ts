import { eq, and, inArray } from 'drizzle-orm';
import type { DrizzleDB } from '../../db/client.js';
import { workspaces, workspaceAgents, skills, scratchpadEntries } from '../../db/schema.js';
import { log } from '../../logger.js';

export function createWorkspaceRepository(db: DrizzleDB) {
  return {
    async createWorkspace(id: string, userId: string, taskSummary: string) {
      await db.insert(workspaces).values({ id, userId, taskSummary });
    },

    async getWorkspace(workspaceId: string) {
      const [row] = await db.select().from(workspaces)
        .where(eq(workspaces.id, workspaceId))
        .limit(1);
      return row;
    },

    async getActiveWorkspaces(userId: string) {
      return db.select().from(workspaces)
        .where(and(
          eq(workspaces.userId, userId),
          eq(workspaces.isArchived, false),
        ))
        .orderBy(workspaces.createdAt);
    },

    async getWorkspaceAgents(workspaceId: string) {
      return db.select().from(workspaceAgents)
        .where(and(
          eq(workspaceAgents.workspaceId, workspaceId),
          eq(workspaceAgents.isArchived, false),
        ));
    },

    async upsertWorkspaceAgent(agent: {
      agentId: string;
      workspaceId: string;
      name: string;
      color: string;
      zoneName: string;
      personality: string;
      role: string;
      systemPrompt: string;
      status: string;
      position: [number, number, number];
      chatHistory: Array<{ role: 'user' | 'assistant'; content: string }>;
      initialTask: string | null;
      teamMembers: string[];
    }) {
      await db.insert(workspaceAgents).values({
        agentId: agent.agentId,
        workspaceId: agent.workspaceId,
        name: agent.name,
        color: agent.color,
        zoneName: agent.zoneName,
        personality: agent.personality,
        role: agent.role,
        systemPrompt: agent.systemPrompt,
        status: agent.status,
        position: agent.position,
        chatHistory: agent.chatHistory,
        initialTask: agent.initialTask,
        teamMembers: agent.teamMembers,
      }).onConflictDoUpdate({
        target: workspaceAgents.agentId,
        set: {
          status: agent.status,
          chatHistory: agent.chatHistory,
          systemPrompt: agent.systemPrompt,
        },
      });
    },

    async updateAgentStatus(agentId: string, status: string) {
      await db.update(workspaceAgents)
        .set({ status })
        .where(eq(workspaceAgents.agentId, agentId));
    },

    async updateAgentChatHistory(agentId: string, chatHistory: Array<{ role: 'user' | 'assistant'; content: string }>) {
      await db.update(workspaceAgents)
        .set({ chatHistory })
        .where(eq(workspaceAgents.agentId, agentId));
    },

    async updateWorkspaceStatus(workspaceId: string, status: string) {
      await db.update(workspaces)
        .set({ status })
        .where(eq(workspaces.id, workspaceId));
    },

    async archiveWorkspace(workspaceId: string) {
      // Get agent IDs first for skill archival
      const agents = await db.select({ agentId: workspaceAgents.agentId })
        .from(workspaceAgents)
        .where(eq(workspaceAgents.workspaceId, workspaceId));
      const agentIds = agents.map(a => a.agentId);

      // Archive workspace
      await db.update(workspaces)
        .set({ isArchived: true })
        .where(eq(workspaces.id, workspaceId));

      // Archive workspace agents
      await db.update(workspaceAgents)
        .set({ isArchived: true })
        .where(eq(workspaceAgents.workspaceId, workspaceId));

      // Archive skills for those agents
      if (agentIds.length > 0) {
        await db.update(skills)
          .set({ isArchived: true })
          .where(inArray(skills.agentId, agentIds));
      }

      // Hard-delete scratchpad entries
      await db.delete(scratchpadEntries)
        .where(eq(scratchpadEntries.workspaceId, workspaceId));

      log.info(`[workspace] Archived workspace ${workspaceId} (${agentIds.length} agents)`);
    },
  };
}

export type WorkspaceRepository = ReturnType<typeof createWorkspaceRepository>;
