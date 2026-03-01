import type { DrizzleDB } from '../../db/client.js';
import { createSkillRepository } from './repository.js';
import { createSkillService } from './service.js';

export function createSkillModule(db: DrizzleDB) {
  const skillRepo = createSkillRepository(db);
  const skillService = createSkillService(skillRepo);

  return { skillRepo, skillService };
}
