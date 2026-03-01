/**
 * Phone call tool — lets agents make real outbound phone calls via Retell AI.
 * Returns {} (empty ToolSet) if Retell is not configured, so it gracefully degrades.
 */
import { tool } from 'ai';
import type { ToolSet } from 'ai';
import { z } from 'zod';
import { isRetellReady, makeCall } from '../../ai/retell.js';
import { log } from '../../logger.js';

const makePhoneCallParams = z.object({
  phone_number: z
    .string()
    .describe('The phone number to call in E.164 format (e.g. +14155551234)'),
  task: z
    .string()
    .describe(
      'What you need to accomplish on this call (e.g. "Book a table for 2 at 7pm tonight")',
    ),
  context: z
    .string()
    .describe(
      'Additional context for the conversation (e.g. restaurant name, user preferences, background info)',
    ),
});

export function createPhoneCallTool(deps: {
  agentId: string;
  agentName: string;
  systemPrompt: string;
  fromNumber: string;
  retellAgentId: string;
}): ToolSet {
  if (!isRetellReady()) return {};

  const make_phone_call = tool({
    description:
      'Make a real phone call to any phone number. You will speak with the person on the other end autonomously to accomplish the given task. The call uses your personality and knowledge. Returns a full transcript when the call ends. Confirm the number and task with the user before calling.',
    inputSchema: makePhoneCallParams,
    execute: async (args: z.infer<typeof makePhoneCallParams>) => {
      log.info(
        `[phone] ${deps.agentName} calling ${args.phone_number}: ${args.task}`,
      );

      const result = await makeCall({
        fromNumber: deps.fromNumber,
        toNumber: args.phone_number,
        agentId: deps.agentId,
        agentName: deps.agentName,
        retellAgentId: deps.retellAgentId,
        task: args.task,
        context: args.context,
        systemPrompt: deps.systemPrompt,
      });

      return result;
    },
  });

  return { make_phone_call } as ToolSet;
}
