import type { AgentRepository } from './repository.js';
import { createAgentService, type AgentService } from './service.js';
import type { ConversationService } from '../conversations/service.js';
import type { PlayerService } from '../players/service.js';
import type { SkillService } from '../skills/service.js';
import type { ScratchpadService } from '../scratchpad/service.js';
import type { UserRepository } from '../users/repository.js';
import type { WorkspaceRepository } from '../workspaces/repository.js';

interface AgentModuleDeps {
  agentRepo: AgentRepository;
  conversationService: ConversationService;
  playerService: PlayerService;
  skillService: SkillService;
  scratchpadService: ScratchpadService;
  userRepo: UserRepository;
  workspaceRepo: WorkspaceRepository;
}

export function createAgentModule(deps: AgentModuleDeps): { service: AgentService } {
  const service = createAgentService({
    agentRepo: deps.agentRepo,
    conversationService: deps.conversationService,
    playerService: deps.playerService,
    skillService: deps.skillService,
    scratchpadService: deps.scratchpadService,
    userRepo: deps.userRepo,
    workspaceRepo: deps.workspaceRepo,
  });
  return { service };
}
