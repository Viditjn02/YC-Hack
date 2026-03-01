# Agentic Voice Interaction — Implementation Plan v2

## Overview

Add voice-based agent interaction to BossRoom: push-to-talk (hold T) with Deepgram STT, and agent voice output with Inworld TTS. The existing streaming chat UX is preserved — voice is an alternative input method, and TTS plays on top of the streamed text response.

This plan replaces `thoughts/shared/plans/2026-02-14-agentic-voice-interaction.md` with corrected file paths and architecture after the codebase was refactored into split Zustand stores and domain-driven server modules.

## Current State Analysis

### Frontend stores (split from former `gameStore.ts`)
- `apps/game-frontend/src/stores/chatStore.ts` — activeAgent, chatPanelOpen, sendMessage, openChat, closeChat, streaming
- `apps/game-frontend/src/stores/worldStore.ts` — agents, nearestAgent, updateAgentStatus
- `apps/game-frontend/src/stores/toolStore.ts` — tool execution tracking
- `apps/game-frontend/src/stores/authStore.ts` — Firebase auth
- `apps/game-frontend/src/stores/onboardingStore.ts` — onboarding

### Server architecture (domain-driven, former `AgentManager.ts` is gone)
- `apps/game-server/src/domains/agents/service.ts` — `createAgentService()` with `handleMessage()`, `handleInteraction()`, `stopInteraction()`
- `apps/game-server/src/domains/agents/repository.ts` — in-memory agent status
- `apps/game-server/src/domains/conversations/service.ts` — conversation management
- `apps/game-server/src/domains/players/service.ts` — WebSocket send/broadcast
- `apps/game-server/src/handlers/agentHandlers.ts` — WebSocket message routing
- `apps/game-server/src/main.ts` — HTTP server + WebSocket server + composition root

### Agent models
All 3 agents already use `gemini` in `libs/shared-utils/src/lib/agent-defs.ts`.

### Message handler
`apps/game-frontend/src/lib/messageHandler.ts` dispatches `ServerMessage` to stores.

### What exists for voice today
- `.env.example` has `INWORLD_API_KEY` and `INWORLD_VOICE_ID=Ashley`
- A compiled `tts.ts` artifact in NX cache (source deleted) — can be used as reference
- No Deepgram integration anywhere
- No voice-related frontend components or hooks
- No `agent:ttsAudio` message type in websocket schema
- No T key handler in Player.tsx
- InteractionPrompt only shows "Press E to talk to [Agent]"

## Desired End State

1. Player approaches an agent and sees:
   - `Press E to chat or Hold T to talk to <Agent>`

2. Player holds T:
   - Microphone starts recording
   - Live transcript appears in overlay
   - Releasing T sends final transcript as a normal `agent:message`

3. Agent responds:
   - Streams text response in chat panel (existing behavior, unchanged)
   - After full response, TTS audio plays back the response

4. Player can also use text chat (E key) — same as today, with TTS on agent responses.

## What We're NOT Doing

- Task delegation UX (ack → working → lightbulb → result)
- `agent:taskAck` / `agent:taskResult` message types
- Pending results state or `viewResult()` action
- Real-time duplex voice sessions
- Twilio / phone calls
- Multi-agent collaboration
- Changes to E key behavior

## Implementation Approach

Three phases, each independently testable:
1. **Protocol + environment** — add the `agent:ttsAudio` message type and env var scaffolding
2. **Push-to-talk STT** — Deepgram token endpoint, voice hook, overlay, T key wiring
3. **TTS playback** — Inworld TTS server client, integration in agent service, frontend audio player

---

## Phase 1: Protocol + Environment Foundation

### Overview
Add the `agent:ttsAudio` server message type and register new environment variables.

### Changes Required:

#### 1. WebSocket types
**File**: `libs/shared-types/src/lib/websocket.ts`
**Changes**: Add `agent:ttsAudio` to the server message discriminated union.

Add after the `agent:conversationHistory` entry (line 45):

```ts
z.object({ type: z.literal('agent:ttsAudio'), payload: z.object({ agentId: z.string(), audioBase64: z.string(), mimeType: z.string() }) }),
```

#### 2. Server environment schema
**File**: `apps/game-server/src/env.ts`
**Changes**: Add optional voice-related env vars to the Zod schema.

Add after `COMPOSIO_API_KEY` (line 22):

```ts
// Voice: Deepgram STT (server-only token minting)
DEEPGRAM_API_KEY: z.string().optional(),

// Voice: Inworld TTS
INWORLD_API_KEY: z.string().optional(),
INWORLD_VOICE_ID: z.string().default('Ashley'),
INWORLD_TTS_MODEL_ID: z.string().default('inworld-tts-1.5-mini'),
```

#### 3. Environment example
**File**: `.env.example`
**Changes**: Add missing env vars.

Add after the Inworld section (line 31):

```env
INWORLD_TTS_MODEL_ID=inworld-tts-1.5-mini

# Deepgram STT (server only — never expose to frontend)
DEEPGRAM_API_KEY=
```

### Success Criteria:

#### Automated Verification:
- [x] `npm run build` passes
- [x] `npm run lint` passes
- [ ] Existing text chat still works (no runtime regression)

---

## Phase 2: Push-to-Talk STT (Deepgram)

### Overview
Add hold-T push-to-talk that captures speech, transcribes it via Deepgram, and sends the transcript as a normal chat message.

### Changes Required:

#### 2.1 Deepgram token endpoint
**File**: `apps/game-server/src/main.ts`
**Changes**: Add `GET /api/deepgram/token` HTTP route.

In the `http.createServer` callback (line 35), add before the Composio route check:

```ts
if (req.method === 'GET' && req.url === '/api/deepgram/token') {
  const deepgramKey = env.DEEPGRAM_API_KEY;
  if (!deepgramKey) {
    res.writeHead(503, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify({ error: 'Deepgram not configured' }));
    return;
  }
  try {
    const upstream = await fetch('https://api.deepgram.com/v1/auth/grant', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${deepgramKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ time_to_live_in_seconds: 30 }),
    });
    if (!upstream.ok) {
      res.writeHead(502, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ error: 'Deepgram token grant failed' }));
      return;
    }
    const data = await upstream.json();
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify(data));
  } catch (err) {
    log.error('[deepgram] Token grant error:', err);
    res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify({ error: 'Internal error' }));
  }
  return;
}
```

Note: The `http.createServer` callback needs to become `async` for this `await fetch`. Change `(req, res) => {` to `async (req, res) => {`.

#### 2.2 Voice input hook
**File**: `apps/game-frontend/src/hooks/useVoiceInput.ts` (new)
**Changes**: Create hook that manages Deepgram WebSocket STT.

```ts
'use client';

import { useRef, useState, useCallback } from 'react';

const DEEPGRAM_WS_URL =
  'wss://api.deepgram.com/v1/listen?model=nova-3&language=en-US&interim_results=true&smart_format=true&punctuate=true';

interface UseVoiceInputReturn {
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<string>;
  isRecording: boolean;
  transcript: string;
  error: string | null;
}

export function useVoiceInput(): UseVoiceInputReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const finalTranscriptRef = useRef('');
  const resolveStopRef = useRef<((transcript: string) => void) | null>(null);

  const startRecording = useCallback(async () => {
    setError(null);
    setTranscript('');
    finalTranscriptRef.current = '';

    try {
      // 1. Get short-lived token from server
      const tokenRes = await fetch(
        `${process.env.NEXT_PUBLIC_WS_URL?.replace('ws', 'http')}/api/deepgram/token`
      );
      if (!tokenRes.ok) throw new Error('Failed to get Deepgram token');
      const { access_token } = await tokenRes.json();

      // 2. Open Deepgram WebSocket with token subprotocol
      const ws = new WebSocket(DEEPGRAM_WS_URL, ['token', access_token]);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'Results') {
          const alt = data.channel?.alternatives?.[0];
          if (!alt) return;
          if (data.is_final && alt.transcript) {
            finalTranscriptRef.current += (finalTranscriptRef.current ? ' ' : '') + alt.transcript;
            setTranscript(finalTranscriptRef.current);
          } else if (!data.is_final && alt.transcript) {
            // Show interim: final so far + current interim
            setTranscript(
              finalTranscriptRef.current +
                (finalTranscriptRef.current ? ' ' : '') +
                alt.transcript
            );
          }
        }
      };

      ws.onerror = () => setError('Voice connection error');

      ws.onclose = () => {
        // Resolve the stop promise with final transcript
        if (resolveStopRef.current) {
          resolveStopRef.current(finalTranscriptRef.current);
          resolveStopRef.current = null;
        }
      };

      // 3. Wait for WS to open, then start mic
      await new Promise<void>((resolve, reject) => {
        ws.onopen = () => resolve();
        ws.onerror = () => reject(new Error('WebSocket connection failed'));
      });

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const recorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
      });
      recorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0 && ws.readyState === WebSocket.OPEN) {
          ws.send(e.data);
        }
      };

      recorder.start(250); // Send chunks every 250ms
      setIsRecording(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start recording');
      setIsRecording(false);
    }
  }, []);

  const stopRecording = useCallback((): Promise<string> => {
    return new Promise((resolve) => {
      resolveStopRef.current = resolve;

      // Stop MediaRecorder
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        recorderRef.current.stop();
      }
      recorderRef.current = null;

      // Stop mic tracks
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      streamRef.current = null;

      // Tell Deepgram to finalize and close
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'CloseStream' }));
        // Give Deepgram a moment to send final results before closing
        setTimeout(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.close();
          }
        }, 500);
      } else {
        // WS already closed, resolve immediately
        resolve(finalTranscriptRef.current);
        resolveStopRef.current = null;
      }

      setIsRecording(false);
    });
  }, []);

  return { startRecording, stopRecording, isRecording, transcript, error };
}
```

#### 2.3 Voice store
**File**: `apps/game-frontend/src/stores/voiceStore.ts` (new)
**Changes**: Create minimal Zustand store for voice UI state.

```ts
import { create } from 'zustand';

interface VoiceState {
  isRecording: boolean;
  voiceTranscript: string;
  setRecording: (recording: boolean) => void;
  setVoiceTranscript: (text: string) => void;
  reset: () => void;
}

export const useVoiceStore = create<VoiceState>((set) => ({
  isRecording: false,
  voiceTranscript: '',
  setRecording: (recording) => set({ isRecording: recording }),
  setVoiceTranscript: (text) => set({ voiceTranscript: text }),
  reset: () => set({ isRecording: false, voiceTranscript: '' }),
}));
```

#### 2.4 Push-to-talk overlay
**File**: `apps/game-frontend/src/components/ui/PushToTalkOverlay.tsx` (new)
**Changes**: Create recording indicator overlay.

```tsx
'use client';

import { useVoiceStore } from '@/stores/voiceStore';

export function PushToTalkOverlay() {
  const isRecording = useVoiceStore((s) => s.isRecording);
  const transcript = useVoiceStore((s) => s.voiceTranscript);

  if (!isRecording) return null;

  return (
    <div
      className="fixed top-8 left-1/2 -translate-x-1/2 z-50
        px-6 py-4 rounded-xl bg-red-900/80 backdrop-blur-sm border border-red-500/30
        text-white text-sm font-medium pointer-events-none
        animate-[fadeIn_0.15s_ease-out]"
    >
      <div className="flex items-center gap-3 mb-2">
        <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
        <span className="text-red-200 text-xs uppercase tracking-wider">Recording</span>
        <span className="text-white/50 text-xs">Release T to send</span>
      </div>
      {transcript && (
        <p className="text-white/90 text-base max-w-md">{transcript}</p>
      )}
    </div>
  );
}
```

#### 2.5 Wire T key in Player
**File**: `apps/game-frontend/src/components/game/Player.tsx`
**Changes**: Add T key hold-to-talk handler alongside existing E key handler.

Replace the existing `useEffect` for keyboard handling (lines 35-43) with:

```tsx
const voiceInput = useVoiceInput();
const sendMessage = useChatStore((s) => s.sendMessage);
const activeAgent = useChatStore((s) => s.activeAgent);

useEffect(() => {
  function handleKeyDown(e: KeyboardEvent) {
    // Ignore if typing in an input
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable) return;

    if (e.code === 'KeyE' && nearestAgent && !chatPanelOpen) {
      openChat(nearestAgent);
    }

    if (e.code === 'KeyT' && !e.repeat && nearestAgent) {
      // Open chat if not already open
      if (!chatPanelOpen) openChat(nearestAgent);
      voiceInput.startRecording();
      useVoiceStore.getState().setRecording(true);
    }
  }

  function handleKeyUp(e: KeyboardEvent) {
    if (e.code === 'KeyT' && voiceInput.isRecording) {
      voiceInput.stopRecording().then((transcript) => {
        useVoiceStore.getState().setRecording(false);
        useVoiceStore.getState().setVoiceTranscript('');
        const agent = useChatStore.getState().activeAgent;
        if (transcript.trim() && agent) {
          useChatStore.getState().sendMessage(agent, transcript.trim());
        }
      });
    }
  }

  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('keyup', handleKeyUp);
  return () => {
    window.removeEventListener('keydown', handleKeyDown);
    window.removeEventListener('keyup', handleKeyUp);
  };
}, [nearestAgent, chatPanelOpen, openChat, voiceInput]);
```

Add imports at top of file:

```ts
import { useVoiceInput } from '@/hooks/useVoiceInput';
import { useVoiceStore } from '@/stores/voiceStore';
```

Also add an effect to sync voice transcript to the store:

```tsx
useEffect(() => {
  useVoiceStore.getState().setVoiceTranscript(voiceInput.transcript);
}, [voiceInput.transcript]);
```

#### 2.6 Update InteractionPrompt
**File**: `apps/game-frontend/src/components/game/InteractionPrompt.tsx`
**Changes**: Update prompt text to include voice option.

Replace the return JSX (lines 17-31) with:

```tsx
return (
  <div
    className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50
      px-6 py-3 rounded-xl bg-black/70 backdrop-blur-sm border border-white/10
      text-white text-sm font-medium pointer-events-none
      animate-[fadeIn_0.2s_ease-out]"
  >
    Press{' '}
    <kbd className="px-2 py-0.5 mx-1 rounded bg-white/15 border border-white/20 text-xs font-mono">
      E
    </kbd>{' '}
    to chat or hold{' '}
    <kbd className="px-2 py-0.5 mx-1 rounded bg-white/15 border border-white/20 text-xs font-mono">
      T
    </kbd>{' '}
    to talk to{' '}
    <span style={{ color: agent.color }}>{agent.name}</span>
  </div>
);
```

#### 2.7 Render PushToTalkOverlay in Game
**File**: `apps/game-frontend/src/components/game/Game.tsx`
**Changes**: Add PushToTalkOverlay to the HTML overlay section.

Add import:

```ts
import { PushToTalkOverlay } from '../ui/PushToTalkOverlay';
```

Add `<PushToTalkOverlay />` after `<InteractionPrompt />` in the JSX (line 66):

```tsx
<InteractionPrompt />
<PushToTalkOverlay />
```

### Success Criteria:

#### Automated Verification:
- [x] `npm run build` passes
- [x] `npm run lint` passes

#### Manual Verification:
- [ ] Walk up to agent, see "Press E to chat or hold T to talk to [Agent]"
- [ ] Hold T → recording overlay appears with red pulse
- [ ] Speak while holding T → live transcript updates
- [ ] Release T → transcript sent as normal chat message, agent responds with streaming text
- [ ] Type 't' in chat input → does NOT trigger recording
- [ ] Press E → normal text chat still works
- [ ] Deny mic permission → clean error, no crash
- [ ] DEEPGRAM_API_KEY not set → 503 from token endpoint, graceful frontend error

---

## Phase 3: Inworld TTS Playback

### Overview
After the agent finishes streaming a response, synthesize speech via Inworld TTS and play it back to the user.

### Changes Required:

#### 3.1 Server TTS client
**File**: `apps/game-server/src/ai/tts.ts` (new)
**Changes**: Create Inworld TTS REST client.

```ts
import { env } from '../env.js';
import { log } from '../logger.js';

interface TTSResult {
  audioBase64: string;
  mimeType: string;
}

export async function synthesizeSpeech(text: string): Promise<TTSResult | null> {
  const apiKey = env.INWORLD_API_KEY;
  if (!apiKey) {
    log.warn('[tts] INWORLD_API_KEY not configured, skipping TTS');
    return null;
  }

  try {
    const res = await fetch('https://api.inworld.ai/tts/v1/voice', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        voiceId: env.INWORLD_VOICE_ID,
        modelId: env.INWORLD_TTS_MODEL_ID,
      }),
    });

    if (!res.ok) {
      log.error(`[tts] Inworld TTS failed: ${res.status} ${res.statusText}`);
      return null;
    }

    const data = await res.json();
    if (!data.audioContent) {
      log.error('[tts] No audioContent in Inworld response');
      return null;
    }

    return { audioBase64: data.audioContent, mimeType: 'audio/wav' };
  } catch (err) {
    log.error('[tts] TTS synthesis error:', err);
    return null;
  }
}
```

#### 3.2 Integrate TTS in agent service
**File**: `apps/game-server/src/domains/agents/service.ts`
**Changes**: After streaming completes and the final `agent:chatMessage` is sent, try TTS and send audio.

Add import at top:

```ts
import { synthesizeSpeech } from '../../ai/tts.js';
```

After the `agent:chatMessage` send (after line 170 in current code), add:

```ts
// TTS: synthesize and send audio (non-blocking, fail-soft)
synthesizeSpeech(fullResponse).then((tts) => {
  if (tts) {
    playerService.send(ws, {
      type: 'agent:ttsAudio',
      payload: { agentId, audioBase64: tts.audioBase64, mimeType: tts.mimeType },
    });
  }
}).catch((err) => {
  log.error(`[tts] Failed for agent ${agentId}:`, err);
});
```

Note: TTS runs as a fire-and-forget promise. The agent status reset to `idle` happens immediately — TTS does not block the flow. This means the audio arrives slightly after the text response is complete, which is the desired UX.

#### 3.3 Frontend TTS audio player
**File**: `apps/game-frontend/src/components/ui/TTSAudioPlayer.tsx` (new)
**Changes**: Create a component that plays TTS audio from a queue, preventing overlap.

```tsx
'use client';

import { useEffect, useRef } from 'react';
import { useVoiceStore } from '@/stores/voiceStore';

export function TTSAudioPlayer() {
  const queue = useVoiceStore((s) => s.ttsQueue);
  const dequeue = useVoiceStore((s) => s.dequeueTTS);
  const playingRef = useRef(false);

  useEffect(() => {
    if (playingRef.current || queue.length === 0) return;

    const item = queue[0];
    playingRef.current = true;

    const byteChars = atob(item.audioBase64);
    const byteArray = new Uint8Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) {
      byteArray[i] = byteChars.charCodeAt(i);
    }
    const blob = new Blob([byteArray], { type: item.mimeType });
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);

    audio.onended = () => {
      URL.revokeObjectURL(url);
      playingRef.current = false;
      dequeue();
    };

    audio.onerror = () => {
      URL.revokeObjectURL(url);
      playingRef.current = false;
      dequeue();
    };

    audio.play().catch(() => {
      // Autoplay blocked — dequeue and move on
      URL.revokeObjectURL(url);
      playingRef.current = false;
      dequeue();
    });
  }, [queue, dequeue]);

  return null; // No visual output
}
```

#### 3.4 Add TTS queue to voice store
**File**: `apps/game-frontend/src/stores/voiceStore.ts`
**Changes**: Add TTS queue state and actions.

Update the store to include:

```ts
import { create } from 'zustand';

interface TTSItem {
  audioBase64: string;
  mimeType: string;
}

interface VoiceState {
  isRecording: boolean;
  voiceTranscript: string;
  ttsQueue: TTSItem[];

  setRecording: (recording: boolean) => void;
  setVoiceTranscript: (text: string) => void;
  enqueueTTS: (item: TTSItem) => void;
  dequeueTTS: () => void;
  reset: () => void;
}

export const useVoiceStore = create<VoiceState>((set) => ({
  isRecording: false,
  voiceTranscript: '',
  ttsQueue: [],

  setRecording: (recording) => set({ isRecording: recording }),
  setVoiceTranscript: (text) => set({ voiceTranscript: text }),
  enqueueTTS: (item) => set((s) => ({ ttsQueue: [...s.ttsQueue, item] })),
  dequeueTTS: () => set((s) => ({ ttsQueue: s.ttsQueue.slice(1) })),
  reset: () => set({ isRecording: false, voiceTranscript: '', ttsQueue: [] }),
}));
```

Note: Write the full version of this store in Phase 2 (with the TTS fields included from the start) to avoid rewriting it.

#### 3.5 Handle agent:ttsAudio in message handler
**File**: `apps/game-frontend/src/lib/messageHandler.ts`
**Changes**: Add handler for `agent:ttsAudio` messages.

Add import:

```ts
import { useVoiceStore } from '@/stores/voiceStore';
```

Add a new case in the `switch` block (after `agent:toolExecution` handler, ~line 77):

```ts
case 'agent:ttsAudio':
  useVoiceStore.getState().enqueueTTS({
    audioBase64: msg.payload.audioBase64,
    mimeType: msg.payload.mimeType,
  });
  break;
```

#### 3.6 Wire TTSAudioPlayer in Game
**File**: `apps/game-frontend/src/components/game/Game.tsx`
**Changes**: Add TTSAudioPlayer to the HTML overlay section.

Add import:

```ts
import { TTSAudioPlayer } from '../ui/TTSAudioPlayer';
```

Add `<TTSAudioPlayer />` in the JSX:

```tsx
<PushToTalkOverlay />
<TTSAudioPlayer />
```

### Success Criteria:

#### Automated Verification:
- [x] `npm run build` passes
- [x] `npm run lint` passes

#### Manual Verification:
- [ ] Send text message to agent → hear TTS audio play after response completes
- [ ] Hold T, speak, release T → agent streams text + plays TTS audio after
- [ ] Send two rapid messages → audio plays sequentially, no overlap
- [ ] Set invalid INWORLD_API_KEY → text chat still works, no audio, no crash
- [ ] Remove INWORLD_API_KEY entirely → agent responds normally, TTS silently skipped

---

## Testing Strategy

### Automated
Run after each phase:

```bash
npm run build
npm run lint
```

### Manual Test Matrix

1. **Text baseline**:
   - Press E near agent, send text, verify streaming response still works

2. **Push-to-talk**:
   - Hold T, speak, release T, verify transcript sent and agent responds

3. **Input safety**:
   - Open chat, type 't' in chat input, verify it does NOT start recording

4. **TTS playback**:
   - Receive response, verify audio plays after stream completes
   - Rapidly send two prompts, verify audio queue plays sequentially

5. **Error handling**:
   - Deny mic permission → clean error state in overlay
   - Remove DEEPGRAM_API_KEY → token endpoint returns 503, graceful error
   - Remove INWORLD_API_KEY → text chat works, no audio, no crash

---

## Risks and Mitigations

1. **Browser autoplay restrictions can block TTS audio.**
   - Mitigation: user interaction (holding T or pressing E) satisfies the autoplay policy requirement.

2. **Deepgram token expiry race.**
   - Mitigation: fetch token immediately before opening WebSocket. Token only needs to live long enough for the WS handshake (~1-2 seconds). Set TTL to 30 seconds for safety margin.

3. **STT finalization race at stop.**
   - Mitigation: send `CloseStream`, wait 500ms for final transcript event, then close WebSocket.

4. **Safari doesn't support `audio/webm;codecs=opus` in MediaRecorder.**
   - Mitigation: For hackathon scope, Chrome/Edge are the target browsers. Safari support can be added later with an `audio/mp4` fallback.

5. **TTS latency adds delay after text response.**
   - Mitigation: TTS runs as fire-and-forget after the response is complete. The text is already visible — audio is additive. For long responses, consider truncating TTS input to first ~500 characters.

---

## API Reference

### Deepgram Token Grant
```
POST https://api.deepgram.com/v1/auth/grant
Authorization: Token ${DEEPGRAM_API_KEY}
Content-Type: application/json

{ "time_to_live_in_seconds": 30 }

Response: { "access_token": "...", "expires_in": 30 }
```

### Deepgram WebSocket STT
```
wss://api.deepgram.com/v1/listen?model=nova-3&language=en-US&interim_results=true&smart_format=true&punctuate=true
Auth: WebSocket subprotocol ['token', accessToken]
Input: Binary audio chunks (webm/opus via MediaRecorder)
Output: JSON with channel.alternatives[0].transcript
Close: Send {"type":"CloseStream"}
```

### Inworld TTS
```
POST https://api.inworld.ai/tts/v1/voice
Authorization: Basic ${INWORLD_API_KEY}
Content-Type: application/json

{ "text": "...", "voiceId": "Ashley", "modelId": "inworld-tts-1.5-mini" }

Response: { "audioContent": "<base64 WAV>" }
```

---

## File Change Summary

| File | Action | Phase |
|---|---|---|
| `libs/shared-types/src/lib/websocket.ts` | Edit: add `agent:ttsAudio` | 1 |
| `apps/game-server/src/env.ts` | Edit: add voice env vars | 1 |
| `.env.example` | Edit: add DEEPGRAM_API_KEY, INWORLD_TTS_MODEL_ID | 1 |
| `apps/game-server/src/main.ts` | Edit: add `/api/deepgram/token` route | 2 |
| `apps/game-frontend/src/hooks/useVoiceInput.ts` | New | 2 |
| `apps/game-frontend/src/stores/voiceStore.ts` | New | 2 |
| `apps/game-frontend/src/components/ui/PushToTalkOverlay.tsx` | New | 2 |
| `apps/game-frontend/src/components/game/Player.tsx` | Edit: add T key handler | 2 |
| `apps/game-frontend/src/components/game/InteractionPrompt.tsx` | Edit: update prompt text | 2 |
| `apps/game-frontend/src/components/game/Game.tsx` | Edit: add PushToTalkOverlay + TTSAudioPlayer | 2+3 |
| `apps/game-server/src/ai/tts.ts` | New | 3 |
| `apps/game-server/src/domains/agents/service.ts` | Edit: add TTS after response | 3 |
| `apps/game-frontend/src/components/ui/TTSAudioPlayer.tsx` | New | 3 |
| `apps/game-frontend/src/lib/messageHandler.ts` | Edit: handle `agent:ttsAudio` | 3 |
