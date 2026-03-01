/**
 * Retell WebSocket LLM handler.
 *
 * When Retell connects to /retell-llm/:call_id, this handler receives live
 * transcripts and feeds them through the agent's LLM to generate responses.
 * The agent's full system prompt + personality drives the conversation —
 * no hardcoded greetings, the LLM handles everything naturally.
 */
import type { WebSocket } from 'ws';
import { generateText } from 'ai';
import { getModel } from '../ai/gateway.js';
import { getActiveCall, resolveCall } from '../ai/retell.js';
import { log } from '../logger.js';

export function handleRetellWebSocket(ws: WebSocket, callId: string): void {
  const callInfo = getActiveCall(callId);
  if (!callInfo) {
    log.warn(`[retell] No active call found for ${callId}`);
    ws.close();
    return;
  }

  log.info(`[retell] Call ${callId} connected — agent ${callInfo.agentName} on task: ${callInfo.task}`);

  // Build the phone-call system prompt from the agent's existing prompt
  const phoneSystemPrompt = `${callInfo.systemPrompt}

<phone_call>
You are currently on a LIVE PHONE CALL. You are speaking out loud to a real person.
Your task for this call: ${callInfo.task}
Additional context: ${callInfo.context}

Phone call rules:
- speak naturally and conversationally, like a real person on the phone
- keep responses SHORT — 1-2 sentences max. this is a phone call, not a text chat
- listen carefully and respond to what they actually said
- if they ask if you're an AI, be honest
- when the task is complete or they want to end the call, wrap up naturally with a goodbye
- NEVER use markdown, links, or formatting — this is spoken audio
</phone_call>`;

  ws.on('message', async (data: Buffer | string) => {
    try {
      const msg = JSON.parse(data.toString());

      // Call just connected — Retell sends call details
      if (msg.interaction_type === 'call_details') {
        // Let the LLM generate the opening line naturally
        const { text } = await generateText({
          model: getModel('gemini'),
          system: phoneSystemPrompt,
          messages: [
            { role: 'user' as const, content: '[Phone call just connected. Introduce yourself and state your purpose.]' },
          ],
        });

        callInfo.transcript.push({ role: 'agent', content: text });

        ws.send(JSON.stringify({
          response_id: 0,
          content: text,
          content_complete: true,
          end_call: false,
        }));
        return;
      }

      // Person said something — generate response via LLM
      if (msg.interaction_type === 'response_required') {
        const retellTranscript = msg.transcript ?? [];

        // Sync Retell's transcript into our format
        callInfo.transcript = retellTranscript.map((t: { role: string; content: string }) => ({
          role: t.role === 'agent' ? 'agent' as const : 'user' as const,
          content: t.content,
        }));

        // Convert to AI SDK message format
        const messages = callInfo.transcript.map((t) => ({
          role: (t.role === 'agent' ? 'assistant' : 'user') as 'assistant' | 'user',
          content: t.content,
        }));

        const { text } = await generateText({
          model: getModel('gemini'),
          system: phoneSystemPrompt,
          messages,
        });

        callInfo.transcript.push({ role: 'agent', content: text });

        // Check if the agent is wrapping up
        const lower = text.toLowerCase();
        const isGoodbye = lower.includes('goodbye') ||
          lower.includes('bye now') ||
          lower.includes('have a great') ||
          lower.includes('take care');

        ws.send(JSON.stringify({
          response_id: msg.response_id,
          content: text,
          content_complete: true,
          end_call: isGoodbye,
        }));
        return;
      }

      // Keepalive ping
      if (msg.interaction_type === 'ping_pong') {
        ws.send(JSON.stringify({
          response_type: 'ping_pong',
          timestamp: msg.timestamp,
        }));
        return;
      }
    } catch (err) {
      log.error(`[retell] Error handling message for call ${callId}:`, err);
    }
  });

  ws.on('close', () => {
    log.info(`[retell] Call ${callId} ended`);
    const lines = callInfo.transcript.map(
      (t) => `${t.role === 'agent' ? callInfo.agentName : 'Them'}: ${t.content}`,
    );
    const summary = lines.length > 0
      ? `Call completed. Here's what happened:\n\n${lines.join('\n')}`
      : 'Call ended — no conversation took place (the other party may not have answered).';
    resolveCall(callId, summary);
  });

  ws.on('error', (err) => {
    log.error(`[retell] WebSocket error for call ${callId}:`, err);
  });
}
