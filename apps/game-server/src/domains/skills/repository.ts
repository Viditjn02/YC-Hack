import { eq, count } from 'drizzle-orm';
import { skills } from '../../db/schema.js';
import type { DrizzleDB } from '../../db/client.js';
import type { Skill } from '@bossroom/shared-types';

export interface NewSkill {
  agentId: string;
  name: string;
  description: string;
  instructions: string;
  requiredTools?: string[];
  creatorType?: 'system' | 'agent';
  sessionId?: string;
}

export function createSkillRepository(db: DrizzleDB) {
  return {
    async findByAgent(agentId: string): Promise<Skill[]> {
      const rows = await db
        .select()
        .from(skills)
        .where(eq(skills.agentId, agentId));
      return rows.map(toSkill);
    },

    async create(data: NewSkill): Promise<Skill> {
      const [row] = await db
        .insert(skills)
        .values({
          agentId: data.agentId,
          name: data.name,
          description: data.description,
          instructions: data.instructions,
          requiredTools: data.requiredTools ?? [],
          creatorType: data.creatorType ?? 'system',
          sessionId: data.sessionId ?? null,
        })
        .returning();
      return toSkill(row);
    },

    async createBulk(items: NewSkill[]): Promise<Skill[]> {
      if (items.length === 0) return [];
      const rows = await db
        .insert(skills)
        .values(
          items.map((d) => ({
            agentId: d.agentId,
            name: d.name,
            description: d.description,
            instructions: d.instructions,
            requiredTools: d.requiredTools ?? [],
            creatorType: d.creatorType ?? 'system',
            sessionId: d.sessionId ?? null,
          })),
        )
        .returning();
      return rows.map(toSkill);
    },

    async countByAgent(agentId: string): Promise<number> {
      const [result] = await db
        .select({ value: count() })
        .from(skills)
        .where(eq(skills.agentId, agentId));
      return result?.value ?? 0;
    },

    async countAll(): Promise<number> {
      const [result] = await db.select({ value: count() }).from(skills);
      return result?.value ?? 0;
    },
  };
}

function toSkill(row: typeof skills.$inferSelect): Skill {
  return {
    id: row.id,
    agentId: row.agentId,
    name: row.name,
    description: row.description,
    instructions: row.instructions,
    requiredTools: row.requiredTools as string[],
    creatorType: row.creatorType as 'system' | 'agent',
  };
}

export type SkillRepository = ReturnType<typeof createSkillRepository>;
