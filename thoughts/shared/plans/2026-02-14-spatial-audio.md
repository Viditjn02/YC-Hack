# Spatial Audio + Distance-Based Chat

## Goal

Replace flat TTS playback with Web Audio API spatial audio. Agent voices should be 3D-positioned relative to the player — volume fades with distance, pans left/right based on direction, and chat auto-closes when the player walks out of hearing range.

## Why

- Makes the 3D office feel real — you hear agents spatially, not as disembodied flat audio
- Distance-based falloff incentivizes physical proximity to agents
- Auto-close chat prevents stale conversations when the player walks away

## What

### User-Visible Behavior

1. When an agent speaks (TTS), the voice comes from the agent's position in 3D space
2. Full volume within ~2 units, gradual fade from 2–6 units, silent beyond 6
3. Voice pans left/right depending on where the agent is relative to the camera
4. Chat panel auto-closes + TTS queue clears when player moves beyond 6 units from the active agent
5. Walking back toward the agent lets you re-engage normally

### Success Criteria

- [ ] TTS audio volume decreases as player walks away from the speaking agent
- [ ] Audio pans left/right based on agent position relative to camera direction
- [ ] Audio is silent at 6+ units distance
- [ ] Chat panel auto-closes when active agent distance exceeds 6 units
- [ ] TTS queue is cleared on auto-close (no lingering audio)
- [ ] Manual chat close also clears TTS queue
- [ ] Switching agents (openChat) clears stale TTS queue
- [ ] `npm run build` passes
- [ ] `npm run lint` passes

## All Needed Context

### Key Files (read before implementing)

```yaml
- file: apps/game-frontend/src/components/ui/TTSAudioPlayer.tsx
  why: Current flat audio playback — will be rewritten with Web Audio API

- file: apps/game-frontend/src/stores/voiceStore.ts
  why: TTS queue state — needs agentId added to TTSItem

- file: apps/game-frontend/src/lib/messageHandler.ts
  why: Where agent:ttsAudio is received — agentId exists in payload but is not passed through to store

- file: apps/game-frontend/src/components/game/CameraRig.tsx
  why: Reference for camera access pattern (useThree + useFrame)

- file: apps/game-frontend/src/components/game/Player.tsx
  why: Has useFrame + distance calculation — will add auto-close logic

- file: apps/game-frontend/src/data/gameConfig.ts
  why: Constants — add SPATIAL_AUDIO config

- file: apps/game-frontend/src/stores/agentBehaviorStore.ts
  why: Agent runtime positions (runtimes[agentId].currentPosition)

- file: apps/game-frontend/src/stores/chatStore.ts
  why: closeChat() and openChat() — need TTS queue clearing on both

- file: apps/game-frontend/src/components/game/Scene.tsx
  why: Where new SpatialAudioListener component will be added
```

### Web Audio API Notes

- `AudioContext` must be created after a user gesture (browser autoplay policy). The player presses T or E before any TTS plays, so the context will already be "unlocked".
- `PannerNode` with `distanceModel: 'linear'` gives a clean linear fade: full volume at `refDistance`, zero at `maxDistance`. Formula: `gain = 1 - rolloffFactor * (distance - refDistance) / (maxDistance - refDistance)`.
- `AudioListener` position/orientation must be updated each frame to track the camera.
- Three.js and Web Audio API both use right-handed coordinate systems (Y-up) — no conversion needed.
- Use `listener.setPosition()` and `listener.setOrientation()` (legacy API — deprecated but universally supported, no functional advantage to AudioParam properties for this use case).
- `panningModel: 'HRTF'` gives realistic head-related transfer function panning. Falls back silently to `equalpower` on mono output devices.

### Known Gotchas

- `TTSItem` currently has NO `agentId` — the `agent:ttsAudio` server message includes `agentId` in its payload (confirmed in `libs/shared-types/src/lib/websocket.ts` line 48), but `messageHandler.ts` drops it when enqueueing. Must extract and pass it through.
- `TTSAudioPlayer` is rendered **outside** the R3F Canvas (in `Game.tsx`), so it cannot use `useFrame` or `useThree()`. Listener/panner updates must happen in a component **inside** the Canvas.
- `decodeAudioData()` takes an `ArrayBuffer` and returns a `Promise<AudioBuffer>`. The buffer from `atob()` must be converted: `new Uint8Array(...).buffer`. Use `.slice(0)` to avoid ArrayBuffer detachment issues.
- Current TTS sends MP3 from Inworld (`mimeType: 'audio/mpeg'`). `decodeAudioData` handles MP3 natively in all modern browsers.
- `closeChat()` already sends `agent:stopInteract` to the server — no extra server changes needed.
- Distance for auto-close uses XZ-plane distance (matches existing proximity detection in Player.tsx). This is intentional — proximity is floor-based, not 3D, since agents are on the same floor.

## Implementation Blueprint

### New Constants

```typescript
// In gameConfig.ts
export const SPATIAL_AUDIO = {
  /** Distance at which volume starts to decrease. */
  refDistance: 2,
  /** Distance at which volume reaches zero + chat auto-closes. */
  maxDistance: 6,
  /** Rolloff factor for linear distance model (1 = full linear fade). */
  rolloffFactor: 1,
} as const;
```

### Data Model Changes

```typescript
// In voiceStore.ts — add agentId to TTSItem
interface TTSItem {
  agentId: string;      // NEW
  audioBase64: string;
  mimeType: string;
}

// Add clearTTSQueue action
clearTTSQueue: () => void;
```

### Tasks (in implementation order)

```yaml
Task 1: Add SPATIAL_AUDIO constants to gameConfig.ts
MODIFY apps/game-frontend/src/data/gameConfig.ts:
  - ADD SPATIAL_AUDIO export after INTERACTION
  - Values: refDistance=2, maxDistance=6, rolloffFactor=1

Task 2: Add agentId to TTS queue + clearTTSQueue action
MODIFY apps/game-frontend/src/stores/voiceStore.ts:
  - ADD agentId: string to TTSItem interface
  - ADD clearTTSQueue action: () => set({ ttsQueue: [] })

Task 3: Pass agentId when enqueueing TTS audio
MODIFY apps/game-frontend/src/lib/messageHandler.ts:
  - In the 'agent:ttsAudio' case, extract msg.payload.agentId and include it in the enqueueTTS call

Task 4: Create AudioContext singleton module
CREATE apps/game-frontend/src/lib/spatialAudio.ts:
  - Does NOT need 'use client' (plain TS module, not a React component)
  - Module-level AudioContext (created lazily on first getAudioContext() call)
  - getAudioContext(): creates or returns singleton, resumes if suspended
  - peekAudioContext(): returns ctx or null WITHOUT creating — safe for per-frame checks
  - Mutable module-level refs for active PannerNode + active agentId
  - setActivePanner(panner, agentId) / getActivePanner() / getActiveAgentId()

Task 5: Rewrite TTSAudioPlayer with Web Audio API
MODIFY apps/game-frontend/src/components/ui/TTSAudioPlayer.tsx:
  - Replace new Audio() with:
    1. getAudioContext()
    2. decodeAudioData(arrayBuffer)
    3. createBufferSource -> createPannerNode -> destination
  - PannerNode config: panningModel='HRTF', distanceModel='linear',
    refDistance/maxDistance/rolloffFactor from SPATIAL_AUDIO
  - Do NOT set initial panner position here — Task 6 handles all position
    updates per-frame (avoids stale position if agent wandered before TTS arrived)
  - Call setActivePanner(panner, item.agentId) after connecting nodes
  - On ended: call setActivePanner(null, null) FIRST, then dequeue
    (prevents race where next TTS starts with stale panner ref)
  - Wrap decodeAudioData + playback in try-catch — on any error, call
    setActivePanner(null, null), then dequeue (same pattern as current error handling)

Task 6: Create SpatialAudioListener component (inside Canvas)
CREATE apps/game-frontend/src/components/game/SpatialAudioListener.tsx:
  - 'use client' directive
  - useFrame + useThree to access camera each frame
  - Guard: call peekAudioContext() — if null, return early (context not created yet)
  - Update AudioContext.listener position = camera.position
  - Update AudioContext.listener orientation = camera.getWorldDirection() forward + (0,1,0) up
  - Update active PannerNode position = speaking agent's current position:
    agentBehaviorStore.runtimes[agentId]?.currentPosition ?? worldStore.agents.find(...)?.position ?? [0,0,0]
  - Only update panner when getActivePanner() and getActiveAgentId() are non-null

Task 7: Wire SpatialAudioListener into Scene
MODIFY apps/game-frontend/src/components/game/Scene.tsx:
  - Import SpatialAudioListener
  - Render <SpatialAudioListener /> alongside <CameraRig /> (outside Physics)

Task 8: Add auto-close chat on distance exceed
MODIFY apps/game-frontend/src/components/game/Player.tsx:
  - In the useFrame callback, after the existing nearest-agent loop:
    1. Get activeAgent from useChatStore.getState()
    2. If activeAgent exists, calculate XZ distance to that agent
    3. If distance > SPATIAL_AUDIO.maxDistance:
       - Call useChatStore.getState().closeChat()
       - Call useVoiceStore.getState().clearTTSQueue()
  - Import SPATIAL_AUDIO from gameConfig

Task 9: Clear TTS queue on manual chat close and agent switch
MODIFY apps/game-frontend/src/stores/chatStore.ts:
  - In closeChat(): add useVoiceStore.getState().clearTTSQueue() before the existing logic
  - In openChat(): add useVoiceStore.getState().clearTTSQueue() at the start
    (ensures stale TTS from a previous agent is cleared when switching)
  - Add import for useVoiceStore at top of file
```

### Per-Task Pseudocode

#### Task 4: spatialAudio.ts

```typescript
let ctx: AudioContext | null = null;
let activePanner: PannerNode | null = null;
let activeAgentId: string | null = null;

/** Returns the singleton AudioContext, creating it if needed. Resumes if suspended. */
export function getAudioContext(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

/** Returns the AudioContext if it already exists, null otherwise. Safe for per-frame checks. */
export function peekAudioContext(): AudioContext | null {
  return ctx;
}

export function setActivePanner(panner: PannerNode | null, agentId: string | null) {
  activePanner = panner;
  activeAgentId = agentId;
}

export function getActivePanner() { return activePanner; }
export function getActiveAgentId() { return activeAgentId; }
```

#### Task 5: TTSAudioPlayer rewrite (core logic)

```typescript
useEffect(() => {
  if (playingRef.current || queue.length === 0) return;

  const item = queue[0];
  playingRef.current = true;

  const ctx = getAudioContext();
  const byteChars = atob(item.audioBase64);
  const bytes = new Uint8Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i);

  ctx.decodeAudioData(bytes.buffer.slice(0))
    .then((audioBuffer) => {
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;

      const panner = ctx.createPannerNode();
      panner.panningModel = 'HRTF';
      panner.distanceModel = 'linear';
      panner.refDistance = SPATIAL_AUDIO.refDistance;
      panner.maxDistance = SPATIAL_AUDIO.maxDistance;
      panner.rolloffFactor = SPATIAL_AUDIO.rolloffFactor;
      // Do NOT set panner position here — SpatialAudioListener handles it per-frame

      source.connect(panner);
      panner.connect(ctx.destination);
      setActivePanner(panner, item.agentId);

      source.onended = () => {
        setActivePanner(null, null);  // Clear FIRST to prevent race
        playingRef.current = false;
        dequeue();
      };

      source.start();
    })
    .catch((err) => {
      console.error('[TTS] decodeAudioData failed:', err);
      setActivePanner(null, null);
      playingRef.current = false;
      dequeue();
    });
}, [queue, dequeue]);
```

#### Task 6: SpatialAudioListener (core logic)

```typescript
'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { Vector3 } from 'three';
import { peekAudioContext, getActivePanner, getActiveAgentId } from '@/lib/spatialAudio';
import { useAgentBehaviorStore } from '@/stores/agentBehaviorStore';
import { useWorldStore } from '@/stores/worldStore';

const _forward = new Vector3(); // reuse to avoid GC pressure

export function SpatialAudioListener() {
  const { camera } = useThree();

  useFrame(() => {
    const ctx = peekAudioContext();
    if (!ctx || ctx.state !== 'running') return;

    const listener = ctx.listener;
    listener.setPosition(camera.position.x, camera.position.y, camera.position.z);

    camera.getWorldDirection(_forward);
    listener.setOrientation(_forward.x, _forward.y, _forward.z, 0, 1, 0);

    // Update panner position for active speaking agent
    const panner = getActivePanner();
    const agentId = getActiveAgentId();
    if (panner && agentId) {
      const runtime = useAgentBehaviorStore.getState().runtimes[agentId];
      const agent = useWorldStore.getState().agents.find((a) => a.id === agentId);
      const pos = runtime?.currentPosition ?? agent?.position ?? [0, 0, 0];
      panner.setPosition(pos[0], pos[1], pos[2]);
    }
  });

  return null;
}
```

#### Task 8: Auto-close in Player.tsx (inside useFrame)

```typescript
// After existing nearest-agent loop (after setNearestAgent(closest)):
const activeAgent = useChatStore.getState().activeAgent;
if (activeAgent) {
  const agent = agents.find((a) => a.id === activeAgent);
  if (agent) {
    const dx = pos.x - agent.position[0];
    const dz = pos.z - agent.position[2];
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist > SPATIAL_AUDIO.maxDistance) {
      useChatStore.getState().closeChat();
      // closeChat now handles clearTTSQueue internally (Task 9)
    }
  }
}
```

#### Task 9: chatStore.ts changes

```typescript
import { useVoiceStore } from '@/stores/voiceStore';

// In openChat:
openChat: (agentId) => {
  useVoiceStore.getState().clearTTSQueue();  // Clear stale TTS from previous agent
  set({ activeAgent: agentId, chatPanelOpen: true });
  gameSocket.send({ type: 'agent:interact', payload: { agentId } });
},

// In closeChat:
closeChat: () => {
  useVoiceStore.getState().clearTTSQueue();  // Stop any playing/queued TTS
  const { activeAgent } = get();
  if (activeAgent) {
    set((state) => ({
      streamingText: { ...state.streamingText, [activeAgent]: '' },
    }));
    gameSocket.send({ type: 'agent:stopInteract', payload: { agentId: activeAgent } });
  }
  set({ activeAgent: null, chatPanelOpen: false });
},
```

## Deprecated Code to Remove

- The `new Audio(url)` playback path in TTSAudioPlayer.tsx is fully replaced by Web Audio API pipeline.
- The blob URL creation (`URL.createObjectURL`) is replaced by `decodeAudioData` operating directly on the ArrayBuffer.

## Validation Loop

```bash
npm run build
npm run lint
```

## Anti-Patterns to Avoid

- Don't create AudioContext at module load time — it must be after user gesture. Use `peekAudioContext()` for read-only checks.
- Don't use `useFrame` outside the R3F Canvas — it won't work. TTSAudioPlayer is outside the Canvas.
- Don't subscribe to Zustand stores with hooks inside useFrame — use `getState()` for per-frame reads.
- Don't forget to disconnect PannerNode and clean up BufferSource on end/error.
- Don't call `decodeAudioData` with the same ArrayBuffer twice — it detaches. Use `buffer.slice(0)`.
- Don't set initial panner position in TTSAudioPlayer — let SpatialAudioListener handle all position updates to avoid stale positions.
- Don't create Vector3 inside useFrame on every call — reuse a module-level instance to avoid GC pressure.
