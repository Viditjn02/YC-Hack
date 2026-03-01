# Agent Interaction UX Improvements

## Goal

Improve agent interaction UX with 4 changes:
1. Auto-reopen chat when walking back to an agent (walk-away = "I'll be back", Escape = "I'm done")
2. TTS only fires on voice input, text chat gets text-only response
3. Implicit TTS stop: pressing T or sending a message kills active TTS
4. Explicit TTS stop button in chat panel header

## Why

- TTS fires on every response including typed chat — annoying
- No way to stop TTS mid-playback
- Walking away and returning forces re-pressing E, breaks conversational flow
- Voice and text interactions should feel distinct

## What

### Success Criteria

- [ ] Walking away (>SPATIAL_AUDIO.maxDistance) then returning (<INTERACTION.proximityRadius) auto-reopens chat with same agent
- [ ] Pressing Escape or close button does NOT auto-reopen on return
- [ ] Typing a message produces text-only response (no TTS audio sent)
- [ ] Holding T and speaking produces response WITH TTS audio
- [ ] Pressing T while TTS is playing immediately stops playback and starts recording
- [ ] Sending a text message while TTS is playing stops playback
- [ ] Stop button appears in chat header while TTS is playing, clicking it stops playback
- [ ] Stop button disappears when TTS finishes or is stopped

## All Needed Context

### Key Files

```yaml
- file: libs/shared-types/src/lib/websocket.ts
  why: Add inputMode to agent:message schema

- file: apps/game-frontend/src/stores/chatStore.ts
  why: Add closeReason tracking, modify sendMessage to accept inputMode

- file: apps/game-frontend/src/stores/voiceStore.ts
  why: Add isTTSPlaying state, stopTTS action

- file: apps/game-frontend/src/lib/spatialAudio.ts
  why: Track active AudioBufferSourceNode (setActiveSource/getActiveSource)

- file: apps/game-frontend/src/components/ui/TTSAudioPlayer.tsx
  why: Store source ref via spatialAudio, update isTTSPlaying state

- file: apps/game-frontend/src/components/ui/ChatPanel.tsx
  why: Add stop TTS button, call stopTTS on sendMessage

- file: apps/game-frontend/src/components/game/Player.tsx
  why: Auto-reopen logic, stop TTS on T press, pass inputMode 'voice'

- file: apps/game-server/src/handlers/agentHandlers.ts
  why: Pass inputMode through to service

- file: apps/game-server/src/domains/agents/service.ts
  why: Conditionally call synthesizeSpeech based on inputMode
```

NOTE: InteractionPrompt.tsx needs NO changes — it already hides when chatPanelOpen is true, so auto-reopen works automatically.

## Implementation Blueprint

### Data Models and Structure

**Shared types — add `inputMode` to `agent:message`:**

In `libs/shared-types/src/lib/websocket.ts`, the `agent:message` client message currently has:
```typescript
z.object({ type: z.literal('agent:message'), payload: z.object({ agentId: z.string(), conversationId: z.string(), content: z.string() }) }),
```
Add `inputMode: z.enum(['voice', 'text']).default('text')` to the payload.

### Tasks (in implementation order)

```yaml
Task 1: Add inputMode to shared types
MODIFY libs/shared-types/src/lib/websocket.ts:
  - ADD inputMode field to agent:message payload: z.enum(['voice', 'text']).default('text')
  - Backward compatible — old clients that don't send inputMode get 'text' (no TTS)

Task 2: Add active source tracking to spatialAudio
MODIFY apps/game-frontend/src/lib/spatialAudio.ts:
  - ADD module-level: let activeSource: AudioBufferSourceNode | null = null
  - ADD export function setActiveSource(source: AudioBufferSourceNode | null)
  - ADD export function getActiveSource(): AudioBufferSourceNode | null
  - spatialAudio stays a pure audio module — no store imports

Task 3: Add isTTSPlaying state and stopTTS to voiceStore
MODIFY apps/game-frontend/src/stores/voiceStore.ts:
  - ADD to state: isTTSPlaying: boolean (default false)
  - ADD action: setTTSPlaying: (playing: boolean) => void
  - ADD action: stopTTS: () => void
    - Calls getActiveSource()?.stop() (synchronous per Web Audio API spec)
    - Calls setActiveSource(null), setActivePanner(null, null)
    - Sets ttsQueue to [] and isTTSPlaying to false
  - Import getActiveSource, setActiveSource, setActivePanner from @/lib/spatialAudio
  - NOTE: When source.stop() fires, TTSAudioPlayer's onended callback also runs.
    That callback calls dequeue() on an already-empty queue — harmless (.slice(1) on [] = []).

Task 4: Wire TTSAudioPlayer to store active source and isTTSPlaying
MODIFY apps/game-frontend/src/components/ui/TTSAudioPlayer.tsx:
  - Import setActiveSource from @/lib/spatialAudio
  - Subscribe to setTTSPlaying from voiceStore
  - Before source.start(): call setActiveSource(source)
  - After source.start(): call useVoiceStore.getState().setTTSPlaying(true)
  - In source.onended callback: call setActiveSource(null), setTTSPlaying(false)
    KEEP existing dequeue() call in onended
  - In catch block: call setActiveSource(null), setTTSPlaying(false)
    KEEP existing dequeue() call in catch

Task 5: Add close reason tracking to chatStore (auto-reopen support)
MODIFY apps/game-frontend/src/stores/chatStore.ts:
  - ADD to state: lastWalkAwayAgent: string | null (default null)
  - MODIFY closeChat signature: closeChat(reason?: 'explicit' | 'walkAway')
    - Existing callers pass no arg → defaults to 'explicit' behavior (clears lastWalkAwayAgent)
    - If reason === 'walkAway': set lastWalkAwayAgent to activeAgent before clearing
    - Replace clearTTSQueue() with stopTTS()
    - Rest of closeChat logic unchanged
  - MODIFY openChat: set lastWalkAwayAgent to null (reset stale state)
    - Replace clearTTSQueue() with stopTTS()
  - MODIFY sendMessage signature: sendMessage(agentId, content, inputMode?: 'voice' | 'text')
    - Pass inputMode (default 'text') in the websocket payload
    - Call stopTTS() before sending to kill any playing audio
  - NOTE: conversationIds are NOT cleared on walk-away — conversation resumes naturally

Task 6: Auto-reopen chat on proximity return + voice improvements
MODIFY apps/game-frontend/src/components/game/Player.tsx:
  - In useFrame, after setNearestAgent(closest):
    ADD auto-reopen check: if closest === lastWalkAwayAgent AND !chatPanelOpen,
    call openChat(closest). openChat clears lastWalkAwayAgent (from Task 5),
    preventing re-triggering on subsequent frames.
  - MODIFY auto-close block: change closeChat() to closeChat('walkAway')
  - In handleKeyDown T handler, AFTER opening chat but BEFORE startRecording:
    call useVoiceStore.getState().stopTTS()
  - In handleKeyUp T release, sendMessage call passes inputMode 'voice':
    useChatStore.getState().sendMessage(agent, transcript.trim(), 'voice')

Task 7: Add explicit stop TTS button to ChatPanel
MODIFY apps/game-frontend/src/components/ui/ChatPanel.tsx:
  - Import useVoiceStore (isTTSPlaying, stopTTS)
  - In header div, between AgentStatusBadge and close button:
    Add stop button, visible only when isTTSPlaying is true
    onClick calls stopTTS()
    Style: matches close button pattern
  - In handleSend(): call useVoiceStore.getState().stopTTS() before sendMessage

Task 8: Pass inputMode through server handler to service
MODIFY apps/game-server/src/handlers/agentHandlers.ts:
  - Update handleAgentMessage payload type:
    { agentId: string; conversationId: string; content: string; inputMode?: 'voice' | 'text' }
  - Pass payload.inputMode ?? 'text' to agents.handleMessage()

MODIFY apps/game-server/src/domains/agents/service.ts:
  - Add inputMode parameter to handleMessage signature (after content, before ws):
    handleMessage(playerId, agentId, conversationId, content, inputMode, ws, broadcastFn)
  - Wrap TTS block (lines 479-493) in: if (inputMode === 'voice') { ... }
  - Dynamic agent messages (handleDynamicAgentMessage) don't have TTS, no change needed
```

### Per-Task Pseudocode

**Task 2 — spatialAudio.ts additions:**
```typescript
let activeSource: AudioBufferSourceNode | null = null;

export function setActiveSource(source: AudioBufferSourceNode | null) {
  activeSource = source;
}

export function getActiveSource(): AudioBufferSourceNode | null {
  return activeSource;
}
```

**Task 3 — voiceStore stopTTS:**
```typescript
import { getActiveSource, setActiveSource, setActivePanner } from '@/lib/spatialAudio';

// Add to VoiceState interface:
isTTSPlaying: boolean;
setTTSPlaying: (playing: boolean) => void;
stopTTS: () => void;

// Add to create():
isTTSPlaying: false,
setTTSPlaying: (playing) => set({ isTTSPlaying: playing }),
stopTTS: () => {
  const source = getActiveSource();
  if (source) { try { source.stop(); } catch {} }
  setActiveSource(null);
  setActivePanner(null, null);
  set({ ttsQueue: [], isTTSPlaying: false });
},
```

**Task 4 — TTSAudioPlayer wiring:**
```typescript
import { setActiveSource } from '@/lib/spatialAudio';

// In the .then() after creating source and panner:
setActiveSource(source);

source.onended = () => {
  setActiveSource(null);
  setActivePanner(null, null);
  useVoiceStore.getState().setTTSPlaying(false);
  playingRef.current = false;
  dequeue();
};

source.start();
useVoiceStore.getState().setTTSPlaying(true);

// In .catch():
setActiveSource(null);
useVoiceStore.getState().setTTSPlaying(false);
// keep existing: setActivePanner(null, null), playingRef.current = false, dequeue()
```

**Task 5 — chatStore changes:**
```typescript
// Add to state:
lastWalkAwayAgent: null as string | null,

// Updated openChat:
openChat: (agentId) => {
  useVoiceStore.getState().stopTTS();
  set({ activeAgent: agentId, chatPanelOpen: true, lastWalkAwayAgent: null });
  gameSocket.send({
    type: 'agent:interact',
    payload: { agentId },
  });
},

// Updated closeChat:
closeChat: (reason?: 'explicit' | 'walkAway') => {
  useVoiceStore.getState().stopTTS();
  const { activeAgent } = get();
  if (activeAgent) {
    set((state) => ({
      streamingText: { ...state.streamingText, [activeAgent]: '' },
    }));
    gameSocket.send({
      type: 'agent:stopInteract',
      payload: { agentId: activeAgent },
    });
  }
  set({
    activeAgent: null,
    chatPanelOpen: false,
    lastWalkAwayAgent: reason === 'walkAway' ? activeAgent : null,
  });
},

// Updated sendMessage:
sendMessage: (agentId, content, inputMode?: 'voice' | 'text') => {
  useVoiceStore.getState().stopTTS();
  const state = get();
  const convId = state.conversationIds[agentId] ?? generateConversationId();

  const prev = state.chatMessages[agentId] ?? [];
  set({
    chatMessages: {
      ...state.chatMessages,
      [agentId]: [...prev, { role: 'user', content }],
    },
    streamingText: { ...state.streamingText, [agentId]: '' },
    conversationIds: {
      ...state.conversationIds,
      [agentId]: convId,
    },
  });

  gameSocket.send({
    type: 'agent:message',
    payload: { agentId, conversationId: convId, content, inputMode: inputMode ?? 'text' },
  });
},
```

**Task 6 — Player.tsx auto-reopen in useFrame:**
```typescript
// After setNearestAgent(closest), BEFORE the auto-close block:
const lastWalkAway = useChatStore.getState().lastWalkAwayAgent;
if (closest && closest === lastWalkAway && !useChatStore.getState().chatPanelOpen) {
  useChatStore.getState().openChat(closest);
  // openChat sets lastWalkAwayAgent = null, preventing re-trigger on next frame
}

// Auto-close block changes closeChat() to closeChat('walkAway'):
if (dist > SPATIAL_AUDIO.maxDistance) {
  useChatStore.getState().closeChat('walkAway');
}

// T key handleKeyDown — add stopTTS before startRecording:
if (e.code === 'KeyT' && !e.repeat) {
  if (!nearestAgent) return;
  if (recordingRef.current) return;
  if (!chatPanelOpen) openChat(nearestAgent);
  useVoiceStore.getState().stopTTS();  // <-- NEW: kill active TTS
  recordingRef.current = true;
  useVoiceStore.getState().setRecording(true);
  startPromiseRef.current = startRecording();
}

// T key handleKeyUp — pass 'voice' inputMode:
const agent = useChatStore.getState().activeAgent;
if (transcript.trim() && agent) {
  useChatStore.getState().sendMessage(agent, transcript.trim(), 'voice');
}
```

**Task 7 — ChatPanel stop button:**
```typescript
const isTTSPlaying = useVoiceStore((s) => s.isTTSPlaying);
const stopTTS = useVoiceStore((s) => s.stopTTS);

// In header, before close button:
{isTTSPlaying && (
  <button
    onClick={stopTTS}
    className="text-white/50 hover:text-red-400 p-1 transition-colors"
    title="Stop speaking"
  >
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
      <rect x="3" y="3" width="10" height="10" rx="1" />
    </svg>
  </button>
)}

// handleSend updated:
function handleSend() {
  if (!input.trim() || !activeAgent) return;
  sendMessage(activeAgent, input.trim());  // inputMode defaults to 'text'
  setInput('');
}
```

**Task 8 — server changes:**
```typescript
// agentHandlers.ts — updated handleAgentMessage:
export function handleAgentMessage(
  ws: WebSocket,
  payload: { agentId: string; conversationId: string; content: string; inputMode?: 'voice' | 'text' },
  deps: AgentHandlerDeps,
) {
  const { players, agents } = deps;
  const uid = players.getUidByWs(ws);
  if (!uid) return;
  agents.handleMessage(
    uid,
    payload.agentId,
    payload.conversationId,
    payload.content,
    payload.inputMode ?? 'text',
    ws,
    (statusMsg) => players.broadcast(statusMsg),
  );
}

// service.ts — updated handleMessage signature:
async handleMessage(
  playerId: string,
  agentId: string,
  conversationId: string,
  content: string,
  inputMode: 'voice' | 'text',
  ws: WebSocket,
  broadcastFn: (msg: ServerMessage) => void,
) {
  // ... existing code ...

  // Wrap TTS block:
  if (inputMode === 'voice') {
    synthesizeSpeech(fullResponse).then((tts) => {
      if (tts) {
        playerService.send(ws, {
          type: 'agent:ttsAudio',
          payload: { agentId, audioBase64: tts.audioBase64, mimeType: tts.mimeType },
        });
      }
    }).catch((err) => {
      log.error(`[TTS] failed for agent ${agentId}:`, err);
    });
  }
}
```

## Validation Loop

```bash
# Run after implementation
npm run lint
npm run build
```

## Deprecated Code to Remove

- Remove direct `clearTTSQueue()` calls from `chatStore.openChat` and `chatStore.closeChat` — replaced by `stopTTS()` which calls clearTTSQueue internally
- Remove debug `console.log` in `apps/game-frontend/src/lib/messageHandler.ts:114` (`[DEBUG-FIX] TTS audio received...`)
- Remove debug `log.info` calls in `apps/game-server/src/domains/agents/service.ts:480,483,489` (`[DEBUG-FIX] Starting TTS...`, `[DEBUG-FIX] TTS success...`, `[DEBUG-FIX] TTS returned null...`)

## Confidence Score: 9/10

All changes are well-scoped, no new libraries needed, follows existing patterns. The auto-reopen race condition is addressed by clearing lastWalkAwayAgent inside openChat. The stopTTS/onended double-cleanup is harmless (dequeue on empty array is a no-op).
