import { createOpenAI } from '@ai-sdk/openai';
import type { LanguageModel } from 'ai';
import type { AgentModel } from '@bossroom/shared-types';
import { env } from '../env.js';

/** Vercel AI Gateway model IDs — format: provider/model */
const GATEWAY_MODEL_MAP: Record<AgentModel, string> = {
  claude: 'anthropic/claude-sonnet-4-5',
  'gpt-4o': 'openai/gpt-4o',
  gemini: 'google/gemini-3-flash',
};

const gateway = createOpenAI({
  apiKey: env.AI_GATEWAY_API_KEY,
  baseURL: 'https://ai-gateway.vercel.sh/v1',
});

export function getModel(agentModel: AgentModel): LanguageModel {
  return gateway.chat(GATEWAY_MODEL_MAP[agentModel]);
}
