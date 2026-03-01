import type { DrizzleDB } from '../../db/client.js';
import { createConversationRepository } from './repository.js';
import { createConversationService, type ConversationService } from './service.js';
import type { AgentRepository } from '../agents/repository.js';

interface ConversationModuleDeps {
  db: DrizzleDB;
  agentRepo: AgentRepository;
}

export function createConversationModule(deps: ConversationModuleDeps): { service: ConversationService } {
  const conversationRepo = createConversationRepository(deps.db);
  const service = createConversationService({
    conversationRepo,
    agentRepo: deps.agentRepo,
  });
  return { service };
}
