import { z } from 'zod';

export const agentModelSchema = z.enum(['claude', 'gpt-4o', 'gemini']);
export type AgentModel = z.infer<typeof agentModelSchema>;


export const agentZoneSchema = z.enum(['communications', 'project-ops', 'calendar', 'research', 'creative', 'command', 'shop']);
export type AgentZone = z.infer<typeof agentZoneSchema>;

export const agentStatusSchema = z.enum(['idle', 'listening', 'thinking', 'working', 'error', 'done']);
export type AgentStatus = z.infer<typeof agentStatusSchema>;

export const agentSkillSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  systemPrompt: z.string(),
  model: agentModelSchema,
  zone: agentZoneSchema,
  personality: z.string(),
  avatarConfig: z.object({
    color: z.string(),
    position: z.tuple([z.number(), z.number(), z.number()]),
  }),
});
export type AgentSkill = z.infer<typeof agentSkillSchema>;

// --- Skills (OpenClaw-style executable documentation) ---

export const skillSchema = z.object({
  id: z.string(),
  agentId: z.string(),
  name: z.string(),
  description: z.string(),
  instructions: z.string(),
  requiredTools: z.array(z.string()),
  creatorType: z.enum(['system', 'agent']),
});
export type Skill = z.infer<typeof skillSchema>;

export const skillSummarySchema = skillSchema.pick({
  id: true,
  agentId: true,
  name: true,
  description: true,
  creatorType: true,
});
export type SkillSummary = z.infer<typeof skillSummarySchema>;

// --- Dynamic agents (generated at runtime by Receptionist LLM) ---

export const dynamicAgentSchema = z.object({
  agentId: z.string(),
  workspaceId: z.string(),
  name: z.string(),
  color: z.string(),
  zoneName: z.string(),
  personality: z.string(),
  role: z.enum(['lead', 'worker']),
  skills: z.array(skillSummarySchema),
  position: z.tuple([z.number(), z.number(), z.number()]),
  initialTask: z.string().optional(),
});
export type DynamicAgent = z.infer<typeof dynamicAgentSchema>;
