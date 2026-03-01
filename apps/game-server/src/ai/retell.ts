/**
 * Retell AI phone calling client.
 * Lets BossRoom agents make real-world phone calls autonomously.
 *
 * Gracefully disabled if RETELL_API_KEY is not set.
 */
import Retell from 'retell-sdk';
import { env } from '../env.js';
import { log } from '../logger.js';

let retellClient: Retell | null = null;

if (env.RETELL_API_KEY) {
  retellClient = new Retell({ apiKey: env.RETELL_API_KEY });
  log.info('Retell AI client initialized');
} else {
  log.warn('RETELL_API_KEY not set — phone calling disabled');
}

export interface ActiveCall {
  agentId: string;
  agentName: string;
  task: string;
  context: string;
  systemPrompt: string;
  transcript: Array<{ role: 'agent' | 'user'; content: string }>;
  resolve: (result: string) => void;
}

/** Active calls: callId → call info */
const activeCalls = new Map<string, ActiveCall>();

export function isRetellReady(): boolean {
  return retellClient !== null;
}

export function getActiveCall(callId: string): ActiveCall | undefined {
  return activeCalls.get(callId);
}

export function resolveCall(callId: string, summary: string): void {
  const entry = activeCalls.get(callId);
  if (entry) {
    activeCalls.delete(callId);
    entry.resolve(summary);
  }
}

/**
 * Initiate an outbound phone call via Retell.
 * Returns a Promise that resolves with the call transcript when the call ends.
 */
export async function makeCall(params: {
  fromNumber: string;
  toNumber: string;
  agentId: string;
  agentName: string;
  retellAgentId: string;
  task: string;
  context: string;
  systemPrompt: string;
}): Promise<string> {
  if (!retellClient) return 'Phone calling not configured (RETELL_API_KEY missing)';

  return new Promise(async (resolve) => {
    try {
      const call = await retellClient!.call.createPhoneCall({
        from_number: params.fromNumber,
        to_number: params.toNumber,
        override_agent_id: params.retellAgentId,
        retell_llm_dynamic_variables: {
          task: params.task,
          context: params.context,
          agent_name: params.agentName,
        },
      });

      log.info(`[retell] Call ${call.call_id} initiated: ${params.agentName} → ${params.toNumber}`);

      activeCalls.set(call.call_id, {
        agentId: params.agentId,
        agentName: params.agentName,
        task: params.task,
        context: params.context,
        systemPrompt: params.systemPrompt,
        transcript: [],
        resolve,
      });

      // Safety timeout — 5 minutes max
      setTimeout(() => {
        if (activeCalls.has(call.call_id)) {
          const entry = activeCalls.get(call.call_id)!;
          activeCalls.delete(call.call_id);
          const lines = entry.transcript.map(
            (t) => `${t.role === 'agent' ? params.agentName : 'Them'}: ${t.content}`,
          );
          entry.resolve(
            `Call timed out after 5 minutes. Partial transcript:\n${lines.join('\n')}`,
          );
        }
      }, 5 * 60 * 1000);
    } catch (err) {
      log.error('[retell] Failed to initiate call:', err);
      resolve(`Failed to initiate call: ${err}`);
    }
  });
}
