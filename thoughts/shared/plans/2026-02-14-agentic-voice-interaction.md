# Agentic Voice Interaction Implementation Plan (Corrected)

## Goal

Add voice-based agent interaction to BossBot using:
- Push-to-talk (hold `T`) with Deepgram STT
- Agent voice output with Inworld TTS
- Task delegation UX: acknowledge -> working -> result-ready indicator -> view result

This plan is scoped to the existing browser + WebSocket architecture.

## Explicit Scope

### In scope
- Voice input while near an agent
- Voice output for agent responses
- Gemini-only model switch for all 3 current agents
- Lightbulb/result-ready UX for delegated tasks

### Out of scope
- Twilio phone calls
- Phone booth world interaction
- Pipecat pipeline
- Realtime duplex voice sessions
- Multi-agent collaboration

## Current Code Reality (Confirmed)

- Interaction prompt is in `apps/game-frontend/src/components/game/InteractionPrompt.tsx` (not `components/ui`).
- Keyboard interaction currently supports only `E` in `apps/game-frontend/src/components/game/Player.tsx`.
- Agent chat uses `agent:message` and streaming responses in `apps/game-server/src/agents/AgentManager.ts`.
- Shared WebSocket protocol currently does not include TTS/task-result message types in `libs/shared-types/src/lib/websocket.ts`.

## Corrections Applied vs Prior Draft

1. No new `agent:voiceMessage` client message type.
- Reuse existing `agent:message` payload by sending STT transcript as normal text content.

2. Deepgram auth must avoid exposing long-lived API keys in frontend.
- Do not use `NEXT_PUBLIC_DEEPGRAM_API_KEY`.
- Use a server endpoint that mints short-lived Deepgram tokens via `/v1/auth/grant`.

3. STT capture implementation uses `MediaRecorder` with containerized audio.
- Do not use deprecated/brittle ScriptProcessor path.
- Do not send raw `linear16` unless implementing full PCM pipeline intentionally.

4. Inworld TTS endpoint/payload corrected.
- Use `POST https://api.inworld.ai/tts/v1/voice`.
- Use `Authorization: Basic <INWORLD base64 credential>`.
- Use `audioContent` from response.

5. Prompt/result behavior must update both UI text and key handler behavior.
- `InteractionPrompt` text alone is insufficient.
- `Player.tsx` `E` key path must call `viewResult` when a pending result exists.

6. Keyboard safety for hold-to-talk.
- Guard against firing while typing in input/textarea/contenteditable.
- Ignore repeated `keydown` events while key is held.

## Desired End State

1. Player approaches an agent and sees:
- `Press E to chat or Hold T to talk to <Agent>`

2. Player holds `T`:
- Microphone starts
- Live transcript appears in overlay
- Releasing `T` sends final transcript as a normal `agent:message`

3. Agent handling flow:
- Immediate acknowledgement message
- Agent status changes to `working`
- After completion, a result-ready lightbulb appears above that agent

4. Player views result:
- Click lightbulb or press `E` near that agent
- Chat panel opens with full result
- Optional TTS playback occurs
- Agent returns to `idle`

## Message Contract Changes

### Client -> Server
No new client message types required.
- Reuse:
  - `agent:message`
  - `agent:interact`
  - `agent:stopInteract`

### Server -> Client additions
Update `libs/shared-types/src/lib/websocket.ts`:

```ts
| { type: 'agent:ttsAudio'; payload: { agentId: string; audioBase64: string; mimeType: string } }
| { type: 'agent:taskAck'; payload: { agentId: string; message: string } }
| { type: 'agent:taskResult'; payload: { agentId: string; result: string } }
```

## Environment Changes

### `.env.example`
Add or confirm:

```env
# Deepgram (server only)
DEEPGRAM_API_KEY=

# Inworld TTS
INWORLD_API_KEY=
INWORLD_VOICE_ID=
INWORLD_TTS_MODEL_ID=inworld-tts-1.5-mini

# Optional frontend feature flag
NEXT_PUBLIC_VOICE_ENABLED=true
```

Notes:
- `DEEPGRAM_API_KEY` must remain server-only.
- `INWORLD_API_KEY` here is the Basic credential value expected by Inworld docs.

## Phase 1: Model + Protocol Foundation

### Changes

- [x] 1. Switch all agents to Gemini in `apps/game-server/src/agents/AgentManager.ts`.
- [x] `mailbot`: `gpt-4o` -> `gemini`
- [x] `taskmaster`: `claude` -> `gemini`
- [x] `clockwork`: already `gemini`

- [x] 2. Add server message unions in `libs/shared-types/src/lib/websocket.ts`.

- [x] 3. Keep backward-compatible text chat flow during this phase.

### Success criteria

- [x] `npm run build` passes
- [x] `npm run lint` passes
- Existing text chat still works with all agents on Gemini

## Phase 2: Deepgram Token Endpoint + Push-to-Talk STT (DONE)

### 2.1 Add token mint endpoint on game server

File: `apps/game-server/src/main.ts`

Add `GET /api/deepgram/token` route to existing HTTP server:
- Calls Deepgram token grant API: `POST https://api.deepgram.com/v1/auth/grant`
- Header: `Authorization: Token ${DEEPGRAM_API_KEY}`
- Returns `{ access_token, expires_in }`

Behavior:
- 500 on upstream failure
- Never logs secret values
- Keep CORS header for frontend (`http://localhost:3000` in dev)

### 2.2 Add voice hook

File: `apps/game-frontend/src/hooks/useVoiceInput.ts` (new)

Responsibilities:
- Fetch short-lived token from `/api/deepgram/token`
- Open Deepgram websocket:

```ts
const ws = new WebSocket(
  'wss://api.deepgram.com/v1/listen?model=nova-3&language=en-US&interim_results=true&smart_format=true&punctuate=true',
  ['token', deepgramAccessToken]
);
```

- Capture mic via `getUserMedia({ audio: true })`
- Use `MediaRecorder` with `audio/webm;codecs=opus` chunks
- Send chunk bytes to Deepgram websocket
- Parse transcript from `channel.alternatives[0].transcript`
- Track interim + final segments
- On stop, send `{"type":"CloseStream"}` and return final transcript

Exposed API:

```ts
{
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<string>;
  isRecording: boolean;
  transcript: string;
  error: string | null;
}
```

### 2.3 Add push-to-talk overlay

File: `apps/game-frontend/src/components/ui/PushToTalkOverlay.tsx` (new)

Displays:
- Recording indicator
- Live transcript
- `Release T to send`

### 2.4 Wire keyboard controls in player

File: `apps/game-frontend/src/components/game/Player.tsx`

Rules:
- `KeyT down`
  - Ignore if focused element is input/textarea/contenteditable
  - Ignore if `e.repeat`
  - If near agent and chat is closed, call `openChat(nearestAgent)` first
  - Start recording
- `KeyT up`
  - Stop recording
  - If transcript non-empty and `activeAgent` exists, call `sendMessage(activeAgent, transcript)`

### 2.5 Store state for voice UI

File: `apps/game-frontend/src/stores/gameStore.ts`

Add state/actions:

```ts
isRecording: boolean;
voiceTranscript: string;
setRecording(recording: boolean): void;
setVoiceTranscript(text: string): void;
```

### 2.6 Update prompt + game wiring

- Update text in `apps/game-frontend/src/components/game/InteractionPrompt.tsx`
- Render `PushToTalkOverlay` in `apps/game-frontend/src/components/game/Game.tsx`

### Success criteria

- Hold `T` near agent starts recording
- Live transcript updates during speech
- Releasing `T` sends transcript as normal chat message
- No accidental recording while typing in chat input
- Existing `E` chat interaction still works

## Phase 3: Inworld TTS Playback (DONE)

### 3.1 Add server TTS client

File: `apps/game-server/src/ai/tts.ts` (new)

Use Inworld REST TTS:

```ts
POST https://api.inworld.ai/tts/v1/voice
Authorization: Basic ${process.env.INWORLD_API_KEY}
Content-Type: application/json

{
  "text": "...",
  "voiceId": process.env.INWORLD_VOICE_ID,
  "modelId": process.env.INWORLD_TTS_MODEL_ID ?? "inworld-tts-1.5-mini"
}
```

Response handling:
- Read `audioContent` (base64)
- Return `{ audioBase64: audioContent, mimeType: 'audio/wav' }` for initial implementation
- Fail soft (text result still delivered if TTS fails)

### 3.2 Integrate TTS emission in agent flow

File: `apps/game-server/src/agents/AgentManager.ts`

After generating full LLM response:
- Keep normal text output behavior
- Try TTS generation
- Send:

```ts
{ type: 'agent:ttsAudio', payload: { agentId, audioBase64, mimeType } }
```

### 3.3 Add frontend playback queue

Preferred approach:
- In `apps/game-frontend/src/stores/gameStore.ts`, add `ttsQueue` + enqueue/dequeue actions.
- On `agent:ttsAudio`, enqueue audio payload.
- Add `apps/game-frontend/src/components/ui/TTSAudioPlayer.tsx` (new) that:
  - Plays queue items one-at-a-time
  - Revokes object URLs on end
  - Prevents overlap chaos from multiple rapid replies

Wire `TTSAudioPlayer` in `apps/game-frontend/src/components/game/Game.tsx`.

### Success criteria

- Text message reply triggers audible voice playback
- Voice message reply also triggers playback
- Multiple responses do not overlap uncontrollably
- TTS failures do not break text chat

## Phase 4: Task Delegation UX (Ack -> Work -> Lightbulb -> Result) (DONE)

### 4.1 Server behavior update

File: `apps/game-server/src/agents/AgentManager.ts`

Change per-message flow:
1. Receive `agent:message`
2. Send immediate ack:

```ts
{ type: 'agent:taskAck', payload: { agentId, message: ack } }
```

3. Broadcast `agent:statusChanged` to `working`
4. Run LLM completion in background
5. Send result as:

```ts
{ type: 'agent:taskResult', payload: { agentId, result: fullResponse } }
```

6. Optionally send `agent:ttsAudio`
7. Keep status as `working` until user views the result

### 4.2 Frontend pending-result state

File: `apps/game-frontend/src/stores/gameStore.ts`

Add:

```ts
pendingResults: Record<string, string>;
setPendingResult(agentId: string, result: string): void;
clearPendingResult(agentId: string): void;
viewResult(agentId: string): void;
```

WebSocket handling additions:
- `agent:taskAck`: append short ack chat bubble and optionally auto-close panel
- `agent:taskResult`: store in `pendingResults[agentId]`

### 4.3 Agent indicator

File: `apps/game-frontend/src/components/game/Agent.tsx`

If `pendingResults[agent.id]` exists:
- Render gold lightbulb indicator above agent
- Make indicator clickable -> `viewResult(agent.id)`

### 4.4 Interaction behavior must match prompt

Files:
- `apps/game-frontend/src/components/game/InteractionPrompt.tsx`
- `apps/game-frontend/src/components/game/Player.tsx`

Behavior:
- If nearest agent has pending result:
  - Prompt: `Press E to see <Agent>'s result`
  - `E` key calls `viewResult(agentId)`
- Otherwise:
  - Prompt: `Press E to chat or Hold T to talk to <Agent>`
  - `E` key calls `openChat(agentId)`

### 4.5 View result action

`viewResult(agentId)` should:
- Open chat panel
- Append stored result as agent message
- Clear pending result key (remove key, do not set `undefined`)
- Set agent status to `idle`
- Send `agent:stopInteract` to server to keep state consistent

### Success criteria

- Send message -> immediate ack appears
- Agent enters `working`
- Result-ready indicator appears when complete
- `E` or click opens result and clears indicator
- Agent returns to `idle`
- Multiple agents can hold independent pending results

## Testing Strategy

## Automated

Run after each phase:

```bash
npm run build
npm run lint
```

## Manual test matrix

1. Text baseline:
- Press `E` near agent, send text, verify response still works

2. Push-to-talk:
- Hold `T`, speak, release `T`, verify transcript sent

3. Input safety:
- Type letter `t` in chat input, verify it does not start recording

4. TTS:
- Receive response, verify audio plays
- Rapidly send two prompts, verify queue behavior

5. Task UX:
- Verify ack -> working -> lightbulb -> result open path
- Verify `Press E to see result` appears for pending agent

6. Error handling:
- Deny mic permission, verify clean error state
- Break TTS credentials, verify text still works

## Risks and Mitigations

1. Browser autoplay restrictions can block audio.
- Mitigation: playback only after explicit user interaction (keyboard/mouse already satisfies this).

2. Deepgram token expiry races.
- Mitigation: fetch token immediately before opening websocket; reconnect with fresh token.

3. STT finalization race at stop.
- Mitigation: send `CloseStream` and wait briefly for final transcript event before resolving.

4. Task UX regression vs current streaming UI.
- Mitigation: behind a feature flag if needed (`NEXT_PUBLIC_VOICE_ENABLED` and optional task-flow flag).

## References (Official)

- Deepgram token-based auth:
  - https://developers.deepgram.com/guides/fundamentals/token-based-authentication
- Deepgram WebSocket auth via subprotocol:
  - https://developers.deepgram.com/docs/using-the-sec-websocket-protocol
- Inworld TTS REST synthesize:
  - https://docs.inworld.ai/api-reference/ttsAPI/texttospeech/synthesize-speech

