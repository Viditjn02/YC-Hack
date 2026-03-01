import type { DrizzleDB } from '../../db/client.js';
import { createUserRepository, type UserRepository } from './repository.js';

interface UserModuleDeps {
  db: DrizzleDB;
}

export function createUserModule(deps: UserModuleDeps): { repository: UserRepository } {
  const repository = createUserRepository(deps.db);
  return { repository };
}
