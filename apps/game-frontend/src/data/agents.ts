import type { AgentStatus, AgentZone, DynamicAgent } from '@bossroom/shared-types';
import { AGENT_DEFS } from '@bossroom/shared-utils';

export interface AgentData {
  id: string;
  name: string;
  description: string;
  personality: string;
  color: string;
  position: [number, number, number];
  zone: AgentZone;
  modelUrl: string;
  suggestedPrompts: string[];
  status: AgentStatus;
}

export const statusColors: Record<AgentStatus, string> = {
  idle: '#4AD97A',
  listening: '#4A90D9',
  thinking: '#D9D94A',
  working: '#FF8C00',
  error: '#D94A4A',
  done: '#14B8A6',
};

export const statusLabels: Record<AgentStatus, string> = {
  idle: '',
  listening: 'Listening',
  thinking: 'Thinking...',
  working: 'Working...',
  error: 'Error!',
  done: 'Done',
};

export const zoneColors: Record<string, string> = {
  communications: '#4A90D9',
  'project-ops': '#D94A4A',
  calendar: '#4AD97A',
  command: '#FFD700',
  shop: '#9B59B6',
};

export const zoneDisplayNames: Record<string, string> = {
  communications: 'COMMS',
  'project-ops': 'PROJECT OPS',
  calendar: 'CALENDAR',
  command: 'RECEPTION',
  shop: 'SHOP',
};

/** Map AGENT_DEFS (Receptionist + Shopkeeper) to frontend AgentData. */
export const agents: AgentData[] = AGENT_DEFS.map((def) => ({
  id: def.id,
  name: def.name,
  description: def.description,
  personality: def.personality,
  color: def.color,
  position: def.avatarConfig.position,
  zone: def.zone,
  modelUrl: def.modelUrl,
  suggestedPrompts: def.suggestedPrompts,
  status: 'idle' as AgentStatus,
}));

/** Agent model pool — dynamic agents pick one deterministically based on their ID. */
const AGENT_MODELS = [
  '/models/characters/agent-taskmaster.glb',
  '/models/characters/agent-mailbot.glb',
  '/models/characters/agent-clockwork.glb',
];

/** Simple hash of a string to a stable index. */
function hashToIndex(str: string, len: number): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) | 0;
  }
  return ((h % len) + len) % len;
}

/**
 * Convert a DynamicAgent (from workspace:build) to frontend AgentData.
 * Picks a model deterministically from the pool based on the agent ID.
 */
export function toDynamicAgentData(agent: DynamicAgent): AgentData {
  return {
    id: agent.agentId,
    name: agent.name,
    description: `${agent.zoneName} agent`,
    personality: agent.personality,
    color: agent.color,
    position: agent.position,
    zone: 'command' as AgentZone, // dynamic agents don't have a fixed zone
    modelUrl: AGENT_MODELS[hashToIndex(agent.agentId, AGENT_MODELS.length)],
    suggestedPrompts: [],
    status: 'idle' as AgentStatus,
  };
}
