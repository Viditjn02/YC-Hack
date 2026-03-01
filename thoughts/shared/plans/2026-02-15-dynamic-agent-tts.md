# Plan: Add TTS to Dynamic (Sub) Agents

## Goal

Dynamic agents (sub-agents created by the Receptionist via `setup_workspace`) should respond with TTS audio when the user talks to them via voice input (hold T). Currently, TTS only works for static agents (Receptionist). Sub-agents should always use the "Dominus" voice — only the Receptionist's voice is user-configurable.

## Why

- Users hold T to talk to sub-agents but hear nothing back — broken voice interaction loop
- Sub-agents should feel like consistent worker bots with a fixed voice identity
- The Receptionist is the only agent whose voice the user can customize

## What

When a user sends a voice message to a dynamic agent:
1. The agent responds with text (already works)
2. TTS audio is synthesized using hardcoded "Dominus" voice
3. Audio is sent back to the client via `agent:ttsAudio` WebSocket message
4. Client plays it back with spatial audio (already works — same `agent:ttsAudio` handler)

### Success Criteria

- [ ] Dynamic agents produce TTS audio when user sends voice input
- [ ] Dynamic agents always use "Dominus" voice (not user-configurable)
- [ ] Receptionist TTS continues to use user's chosen voice setting
- [ ] No TTS when user types text (same behavior as Receptionist)

## All Needed Context

### Key Files

```yaml
- file: apps/game-server/src/domains/agents/service.ts
  why: Main change location. handleMessage() at line 913 drops inputMode before calling handleDynamicAgentMessage(). handleDynamicAgentMessage() at line 429 needs inputMode param + TTS synthesis.

- file: apps/game-server/src/ai/tts.ts
  why: synthesizeSpeech(text, voiceId?) — already supports optional voiceId param. We'll pass "Dominus" explicitly.

- file: apps/game-frontend/src/lib/messageHandler.ts:114-120
  why: Frontend already handles agent:ttsAudio for any agentId — no frontend changes needed.

- file: apps/game-frontend/src/stores/voiceStore.ts
  why: TTS playback queue — already works for any agent. No changes needed.
```

### Known Gotchas

- `synthesizeSpeech` is async and fail-soft — same pattern as static agents (fire-and-forget with `.catch()`)
- The Inworld TTS API has a text length limit — long agent responses may need truncation (existing behavior, not new)
- `handleDynamicAgentMessage` is called from many places (delegation, scratchpad watcher, nudge system) — only user-initiated messages should trigger TTS, not system/nudge messages

## Implementation Blueprint

### Tasks (in implementation order)

```yaml
Task 1:
MODIFY apps/game-server/src/domains/agents/service.ts:
  - FIND: handleDynamicAgentMessage signature (line 429)
  - ADD: inputMode parameter (optional, defaults to 'text')
  - Signature becomes: handleDynamicAgentMessage(playerId, agentId, content, ws, broadcastFn, isNudge = false, inputMode: 'voice' | 'text' = 'text')

Task 2:
MODIFY apps/game-server/src/domains/agents/service.ts:
  - FIND: After the complete message is sent in handleDynamicAgentMessage (after line 608, the agent:chatMessage send)
  - ADD: TTS synthesis block, same pattern as static agents (lines 823-836) but with hardcoded 'Dominus' voice:

    if (inputMode === 'voice' && fullResponse) {
      synthesizeSpeech(fullResponse, 'Dominus').then((tts) => {
        if (tts) {
          playerService.send(ws, {
            type: 'agent:ttsAudio',
            payload: { agentId, audioBase64: tts.audioBase64, mimeType: tts.mimeType },
          });
        }
      }).catch((err) => {
        log.error(`[TTS] failed for dynamic agent ${agentId}:`, err);
      });
    }

Task 3:
MODIFY apps/game-server/src/domains/agents/service.ts:
  - FIND: handleMessage() call to handleDynamicAgentMessage (line 925)
  - CHANGE: Pass inputMode through:
    return handleDynamicAgentMessage(playerId, agentId, content, ws, broadcastFn, false, inputMode);
```

### What NOT to Change

- **No frontend changes needed** — `agent:ttsAudio` handler and voice store already work for any agentId
- **No changes to delegation/scratchpad/nudge callers** — they continue to call `handleDynamicAgentMessage` without inputMode, defaulting to `'text'` (no TTS for system-triggered messages)
- **No changes to user settings or voice selection UI** — sub-agent voice is hardcoded, not configurable

## Validation Loop

```bash
npm run lint
npm run build
```

## Final Validation Checklist

- [ ] No linting errors
- [ ] No type errors
- [ ] Dynamic agents produce TTS when voice input is used
- [ ] Delegation, scratchpad watcher, and nudge calls don't trigger TTS
- [ ] Receptionist TTS unchanged (still uses user voice setting)
