import type { Skill, SkillSummary } from '@bossroom/shared-types';
import { log } from '../../logger.js';
import type { SkillRepository, NewSkill } from './repository.js';
import { RECEPTIONIST_SEED_SKILLS } from './seedData.js';

const MAX_SKILLS_PER_AGENT = 10;
const MAX_INSTRUCTION_LENGTH = 2000;
const MAX_NAME_LENGTH = 50;

export function createSkillService(skillRepo: SkillRepository) {
  /** In-memory cache: agentId → skills */
  const cache = new Map<string, Skill[]>();

  return {
    /** Load all skills into memory cache on startup. */
    async initialize(): Promise<void> {
      // Seed receptionist skills if DB is empty
      const totalCount = await skillRepo.countAll();
      if (totalCount === 0) {
        log.info('[skills] Seeding default receptionist skills');
        await skillRepo.createBulk(RECEPTIONIST_SEED_SKILLS);
      }

      // Load receptionist skills into cache
      const receptionistSkills = await skillRepo.findByAgent('receptionist');
      if (receptionistSkills.length > 0) {
        cache.set('receptionist', receptionistSkills);
      }

      log.info(`[skills] Initialized with ${receptionistSkills.length} receptionist skills`);
    },

    /** Get skills for an agent (cache-first). */
    getSkillsForAgent(agentId: string): Skill[] {
      return cache.get(agentId) ?? [];
    },

    /** Get skill summaries for sending to frontend. */
    getSkillSummaries(agentId: string): SkillSummary[] {
      return this.getSkillsForAgent(agentId).map(toSummary);
    },

    /** Create a single skill (used by agents at runtime via create_skill tool). */
    async createSkill(
      agentId: string,
      name: string,
      description: string,
      instructions: string,
    ): Promise<{ skill: Skill; error?: string }> {
      // Guardrails
      if (name.length > MAX_NAME_LENGTH) {
        return { skill: null as any, error: `Name too long (max ${MAX_NAME_LENGTH} chars)` };
      }
      if (instructions.length > MAX_INSTRUCTION_LENGTH) {
        return { skill: null as any, error: `Instructions too long (max ${MAX_INSTRUCTION_LENGTH} chars)` };
      }

      const existing = cache.get(agentId) ?? [];
      if (existing.length >= MAX_SKILLS_PER_AGENT) {
        return { skill: null as any, error: `Max ${MAX_SKILLS_PER_AGENT} skills per agent reached` };
      }
      if (existing.some((s) => s.name.toLowerCase() === name.toLowerCase())) {
        return { skill: null as any, error: `Skill "${name}" already exists` };
      }

      const skill = await skillRepo.create({
        agentId,
        name,
        description,
        instructions,
        creatorType: 'agent',
      });

      // Update cache
      existing.push(skill);
      cache.set(agentId, existing);

      log.info(`[skills] Agent ${agentId} created skill: ${name}`);
      return { skill };
    },

    /** Bulk create skills for a workspace setup (called by setup_workspace tool). */
    async createBulkForWorkspace(
      agentSkills: Array<{ agentId: string; skills: Array<{ name: string; description: string; instructions: string }> }>,
      sessionId?: string,
    ): Promise<Map<string, Skill[]>> {
      const result = new Map<string, Skill[]>();
      const allNewSkills: NewSkill[] = [];

      for (const agent of agentSkills) {
        for (const skill of agent.skills) {
          allNewSkills.push({
            agentId: agent.agentId,
            name: skill.name,
            description: skill.description,
            instructions: skill.instructions.slice(0, MAX_INSTRUCTION_LENGTH),
            creatorType: 'system',
            sessionId,
          });
        }
      }

      const created = await skillRepo.createBulk(allNewSkills);

      // Group by agent and update cache
      for (const skill of created) {
        const list = result.get(skill.agentId) ?? [];
        list.push(skill);
        result.set(skill.agentId, list);

        const cached = cache.get(skill.agentId) ?? [];
        cached.push(skill);
        cache.set(skill.agentId, cached);
      }

      log.info(`[skills] Created ${created.length} skills for workspace setup`);
      return result;
    },
  };
}

function toSummary(s: Skill): SkillSummary {
  return {
    id: s.id,
    agentId: s.agentId,
    name: s.name,
    description: s.description,
    creatorType: s.creatorType,
  };
}

export type SkillService = ReturnType<typeof createSkillService>;
