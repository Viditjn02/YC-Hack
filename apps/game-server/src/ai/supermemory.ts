/**
 * Supermemory — persistent long-term memory for BossRoom agents.
 * Agents remember user preferences, past tasks, and facts across sessions.
 * Gracefully disabled if SUPERMEMORY_API_KEY is not set.
 */
import { searchMemoriesTool, addMemoryTool } from '@supermemory/tools/ai-sdk';
import type { ToolSet } from 'ai';
import { env } from '../env.js';
import { log } from '../logger.js';

const apiKey = env.SUPERMEMORY_API_KEY;

if (apiKey) {
  log.info('Supermemory initialized — agents have long-term memory');
} else {
  log.warn('SUPERMEMORY_API_KEY not set — agent memory disabled');
}

/**
 * Returns memory tools (searchMemories + addMemory) scoped to a specific user.
 * Returns {} if Supermemory is not configured.
 */
export function getMemoryTools(userId: string): ToolSet {
  if (!apiKey) return {};

  return {
    searchMemories: searchMemoriesTool(apiKey, {
      containerTags: [userId],
    }),
    addMemory: addMemoryTool(apiKey, {
      containerTags: [userId],
    }),
  } as ToolSet;
}
