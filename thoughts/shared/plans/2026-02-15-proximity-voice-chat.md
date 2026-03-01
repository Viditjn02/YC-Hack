# Proximity Voice Chat Between Players

## Goal

Add push-to-talk voice chat between players using PeerJS (WebRTC). When two players are within 3 units and facing each other, holding T streams real-time audio from one to the other with spatial audio (volume/panning based on distance and direction). No text chat, no DB changes, no persistence — voice is ephemeral.

## Why

- BossRoom is a multiplayer coworking space but players can't communicate with each other
- Voice is more natural than text for a 3D spatial environment
- Reuses the existing T key push-to-talk pattern already established for agents

## What

### User-Visible Behavior

1. Player walks near another player (within 3 units)
2. HUD shows: **"Hold T to talk to [username]"** (same style as agent interaction prompt)
3. Player holds T → mic audio streams to the targeted player only (1-to-1, not broadcast)
4. Target player hears spatial audio (quieter + panned based on distance/direction)
5. Speaker icon appears above the talking player's avatar
6. Release T → stream stops, indicator disappears
7. Walk away → connection tears down

### Targeting Logic

- Extend the existing `nearestAgent` system to also scan `remotePlayers`
- Introduce a unified `nearestTarget: { type: 'agent' | 'player', id: string } | null`
- When both an agent and player are within 3 units, **facing direction** disambiguates — the entity most in front of the player's forward vector wins
- T key behavior branches on target type:
  - `agent` → existing Deepgram STT → transcript → agent:message flow (unchanged)
  - `player` → PeerJS audio stream to that player

### Success Criteria

- [ ] Players within 3 units see interaction prompt with target player's name
- [ ] Holding T streams mic audio only to the targeted player
- [ ] Spatial audio: volume decreases and pans as distance increases
- [ ] Speaker icon visible above talking players
- [ ] Facing direction correctly disambiguates between nearby agents and players
- [ ] No audio when players are > 3 units apart
- [ ] Existing agent voice interaction (T key) still works unchanged
- [ ] No DB schema changes required
- [ ] `npm run build` and `npm run lint` pass

## All Needed Context

### Documentation & References

```yaml
- url: https://peerjs.com/docs/
  why: PeerJS API — Peer constructor, peer.call(), peer.on('call'), call.close()

- url: https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Web_audio_spatialization_basics
  why: PannerNode distance models, HRTF panning, listener positioning

- file: apps/game-frontend/src/components/game/Player.tsx
  why: Current nearestAgent detection (lines 166-178), T key handling (lines 72-107), facing angle (line 31, 144-149)

- file: apps/game-frontend/src/stores/worldStore.ts
  why: RemotePlayer interface (lines 5-12), nearestAgent state (line 18), all remote player CRUD methods

- file: apps/game-frontend/src/components/game/InteractionPrompt.tsx
  why: Current prompt pattern to extend for player targets

- file: apps/game-frontend/src/components/game/RemotePlayer.tsx
  why: Remote player rendering — where to add speaker icon

- file: libs/shared-types/src/lib/websocket.ts
  why: Message schemas — need to add voice:talking message

- file: apps/game-server/src/main.ts
  why: Message router — need to add voice:talking handler

- file: apps/game-frontend/src/lib/spatialAudio.ts
  why: Existing AudioContext singleton — reuse for player voice spatial audio

- file: apps/game-frontend/src/data/gameConfig.ts
  why: INTERACTION.proximityRadius (3 units) — reuse for player proximity
```

### Current Codebase Tree (relevant files)

```
libs/shared-types/src/lib/websocket.ts          # Message schemas
apps/game-server/src/main.ts                     # WS server + message router
apps/game-server/src/domains/players/service.ts  # Player state maps
apps/game-frontend/src/
  components/game/
    Player.tsx              # Local player: movement, proximity, T key
    RemotePlayer.tsx        # Remote player rendering
    InteractionPrompt.tsx   # "Press E / Hold T" overlay
    Game.tsx                # Canvas + overlay composition
    Scene.tsx               # Renders RemotePlayer components
  stores/
    worldStore.ts           # remotePlayers, nearestAgent
    voiceStore.ts           # isRecording, TTS queue
    chatStore.ts            # activeAgent, chatPanelOpen
  hooks/
    useVoiceInput.ts        # Deepgram STT (agent voice)
    useBroadcastPosition.ts # Position broadcast at 10Hz
  lib/
    spatialAudio.ts         # AudioContext singleton
    websocket.ts            # GameWebSocket client singleton
    messageHandler.ts       # Routes server messages to stores
  data/
    gameConfig.ts           # INTERACTION.proximityRadius = 3
```

### Desired Codebase Tree (new/modified files)

```
libs/shared-types/src/lib/websocket.ts           # MODIFY: add voice:talking + voice:playerTalking messages
apps/game-server/src/main.ts                      # MODIFY: add voice:talking relay handler
apps/game-frontend/src/
  components/game/
    Player.tsx              # MODIFY: unified targeting, T key branching, spatial audio listener
    RemotePlayer.tsx        # MODIFY: add speaker icon when talking, spatial audio peer position
    InteractionPrompt.tsx   # MODIFY: show player name when target is player
  stores/
    worldStore.ts           # MODIFY: add nearestTarget, talkingPlayers state
    voiceChatStore.ts       # NEW: peer voice chat state (peerReady, localStream, isTalking, micPermissionDenied)
  hooks/
    useProximityVoice.ts    # NEW: PeerJS connection management + push-to-talk
  lib/
    playerSpatialAudio.ts   # NEW: PlayerSpatialAudioManager class for player voice streams
    messageHandler.ts       # MODIFY: add voice:playerTalking case
  data/
    gameConfig.ts           # MODIFY: add facingThreshold to INTERACTION, add VOICE_CHAT constants
```

### Known Gotchas & Library Quirks

```typescript
// CRITICAL: PeerJS uses browser APIs — must dynamic import to avoid SSR crash
// Use: const { default: Peer } = await import('peerjs');
// Do NOT: import Peer from 'peerjs'; at top level

// CRITICAL: AudioContext requires user gesture to create/resume (Chrome autoplay policy)
// The T keydown event IS a user gesture, so create AudioContext there

// CRITICAL: PeerJS peer IDs must be alphanumeric (with dashes/underscores allowed mid-string)
// Firebase UIDs are alphanumeric — use directly as peer IDs

// CRITICAL: When both players are within range, only ONE should initiate the call
// Use lexicographic comparison: lower UID calls higher UID
// This prevents duplicate crossed calls

// CRITICAL: Use track.enabled = false/true for push-to-talk, NOT getUserMedia/stopTracks
// track.enabled toggles instantly; getUserMedia takes 100-300ms and may re-prompt permissions

// CRITICAL: T key must track which target type was active on keydown (targetTypeRef)
// If user holds T while facing a player then turns to face an agent mid-hold,
// keyup must still execute the player-voice stop path, not the agent path

// CRITICAL: worldStore.playerId is null until world:state arrives from server
// Peer instance must NOT be created until playerId is available
// Use a useEffect that watches playerId transition from null to non-null

// CRITICAL: getUserMedia must specify echo cancellation and noise suppression
// Without this, two players in the same physical room will get audio feedback
// Use: { audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } }

// GOTCHA: PeerJS needs a signaling server. Use PeerJS Cloud (free, zero config)
// No need to self-host or route through our WebSocket for signaling
// Constructor: new Peer(uid) — PeerJS Cloud is the default, no config needed
// Our WebSocket is only used for the voice:talking indicator broadcast

// GOTCHA: Existing spatialAudio.ts is a module-level singleton for agent TTS
// Player voice spatial audio needs its own manager class to avoid conflicts
// Create playerSpatialAudio.ts with a class that internally calls getAudioContext()
// from the existing spatialAudio.ts module (shares the same AudioContext)

// GOTCHA: If target player disconnects mid-conversation, PeerJS call won't auto-close
// Must subscribe to worldStore.remotePlayers changes and close orphaned calls

// GOTCHA: If target player walks out of range while local player holds T,
// must auto-stop the voice flow (disable mic track + send voice:talking false)
```

## Implementation Blueprint

### Data Models and Structure

```typescript
// === worldStore.ts additions ===

// Unified target for both agents and players
interface NearestTarget {
  type: 'agent' | 'player';
  id: string;
}
// Add to WorldState:
//   nearestTarget: NearestTarget | null
//   setNearestTarget: (target: NearestTarget | null) => void
//   talkingPlayers: Record<string, boolean>  // player IDs currently transmitting
//   setPlayerTalking: (id: string, talking: boolean) => void

// === voiceChatStore.ts (new) ===
interface VoiceChatState {
  peerReady: boolean;          // PeerJS connected to signaling server
  localStream: MediaStream | null;  // mic stream (acquired once)
  isTalking: boolean;          // local player is holding T
  micPermissionDenied: boolean; // true if getUserMedia was denied
  activeCallPeerId: string | null;  // who we have an active PeerJS call with
  setPeerReady: (ready: boolean) => void;
  setLocalStream: (stream: MediaStream | null) => void;
  setIsTalking: (talking: boolean) => void;
  setMicPermissionDenied: (denied: boolean) => void;
  setActiveCallPeerId: (peerId: string | null) => void;
}

// === shared-types websocket.ts additions ===

// Client -> Server: broadcast that this player is talking (includes target for extensibility)
// { type: 'voice:talking', payload: { isTalking: boolean, targetPlayerId: string | null } }

// Server -> Client: relay talking state to others (broadcast to ALL players for speaker icon visibility)
// { type: 'voice:playerTalking', payload: { playerId: string, isTalking: boolean } }
```

### Facing Direction Targeting (pseudocode)

```typescript
// In Player.tsx useFrame(), replace the nearestAgent-only scan:

// 1. Compute player's forward vector from facingAngle
const forwardX = Math.sin(facingAngle.current);
const forwardZ = Math.cos(facingAngle.current);

// 2. Score all candidates (agents + remote players) within proximityRadius
let bestTarget: NearestTarget | null = null;
let bestScore = -Infinity;

// Score agents
for (const agent of agents) {
  const dx = agent.position[0] - pos.x;
  const dz = agent.position[2] - pos.z;
  const dist = Math.sqrt(dx * dx + dz * dz);
  if (dist >= INTERACTION.proximityRadius) continue;

  // Dot product: how much is this target in front of us? (1 = directly ahead, -1 = behind)
  const dirX = dx / dist;
  const dirZ = dz / dist;
  const dot = forwardX * dirX + forwardZ * dirZ;

  // Score = facing alignment weighted higher + closeness
  // Only consider targets in front hemisphere (dot > 0 = within 90° of forward)
  // This threshold is configurable via INTERACTION.facingThreshold in gameConfig.ts
  if (dot < INTERACTION.facingThreshold) continue;
  const score = dot * 2 + (1 - dist / INTERACTION.proximityRadius);
  if (score > bestScore) {
    bestScore = score;
    bestTarget = { type: 'agent', id: agent.id };
  }
}

// Score remote players (same algorithm)
for (const player of Object.values(remotePlayers)) {
  const dx = player.position[0] - pos.x;
  const dz = player.position[2] - pos.z;
  const dist = Math.sqrt(dx * dx + dz * dz);
  if (dist >= INTERACTION.proximityRadius) continue;

  const dirX = dx / dist;
  const dirZ = dz / dist;
  const dot = forwardX * dirX + forwardZ * dirZ;
  if (dot < INTERACTION.facingThreshold) continue;
  const score = dot * 2 + (1 - dist / INTERACTION.proximityRadius);
  if (score > bestScore) {
    bestScore = score;
    bestTarget = { type: 'player', id: player.id };
  }
}

setNearestTarget(bestTarget);
// Keep setNearestAgent for backward compat with existing agent chat code
setNearestAgent(bestTarget?.type === 'agent' ? bestTarget.id : null);
```

### T Key Branching (pseudocode)

```typescript
// CRITICAL: Track which target type was active on keydown so keyup
// executes the correct flow even if the player turns mid-hold.
const targetTypeRef = useRef<'agent' | 'player' | null>(null);

// In Player.tsx handleKeyDown for KeyT:
if (e.code === 'KeyT' && !e.repeat) {
  const target = useWorldStore.getState().nearestTarget;
  if (!target) return;

  targetTypeRef.current = target.type;  // Lock in the target type

  if (target.type === 'agent') {
    // Existing agent voice flow (unchanged)
    if (recordingRef.current) return;
    if (!chatPanelOpen) openChat(target.id);
    useVoiceStore.getState().stopTTS();
    recordingRef.current = true;
    useVoiceStore.getState().setRecording(true);
    startPromiseRef.current = startRecording();
  } else {
    // Player voice flow (new)
    startPlayerVoice(target.id);  // enable mic track + notify server
  }
}

// In handleKeyUp for KeyT:
if (e.code === 'KeyT') {
  if (targetTypeRef.current === 'agent' && recordingRef.current) {
    // Existing agent flow (unchanged)
    // ... stopRecording, send transcript
  } else if (targetTypeRef.current === 'player') {
    // Player voice flow
    stopPlayerVoice();  // disable mic track + notify server
  }
  targetTypeRef.current = null;  // Reset for next press
}
```

### PeerJS Connection Lifecycle (pseudocode)

```typescript
// useProximityVoice.ts hook

// IMPORTANT: Peer creation must wait for worldStore.playerId to be non-null.
// Use a useEffect that watches playerId, not a mount effect.

// On playerId available (world:state received):
// 1. Dynamic import PeerJS: const { default: Peer } = await import('peerjs');
// 2. Create Peer: new Peer(playerId) — PeerJS Cloud is the default, no config needed
// 3. Get mic stream once with echo cancellation:
//    navigator.mediaDevices.getUserMedia({
//      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
//    })
//    If denied: set voiceChatStore.micPermissionDenied = true, return early (no voice available)
// 4. Set all audio tracks to enabled=false (push-to-talk default)
// 5. Listen for incoming calls:
//    peer.on('call', (call) => {
//      call.answer(localStream);  // answer with our (muted) stream
//      call.on('stream', (remoteStream) => {
//        playerSpatialAudio.addRemoteStream(call.peer, remoteStream);
//      });
//      call.on('close', () => {
//        playerSpatialAudio.removeRemoteStream(call.peer);
//      });
//    });

// On proximity change (nearestTarget changes to a player):
// 1. If we don't have a call with this player AND our UID < their UID:
//    -> peer.call(theirUid, localStream)
//    -> store MediaConnection in callsRef Map<string, MediaConnection>
// 2. If the higher UID doesn't receive a call within 500ms, initiate as fallback

// On proximity loss (nearestTarget changes away from a player):
// 1. Close the call: call.close()
// 2. Remove from spatial audio manager
// 3. If currently talking: auto-stop (disable mic track + send voice:talking false)

// On target player disconnect (remotePlayers changes):
// Subscribe to worldStore.remotePlayers. If an active call peer is no longer
// in remotePlayers, close that call and clean up spatial audio.

// Push-to-talk:
// startPlayerVoice(targetId):
//   - Ensure call exists with targetId (initiate if needed)
//   - Set localStream audio tracks enabled = true
//   - Send voice:talking { isTalking: true, targetPlayerId: targetId } via game WebSocket
//   - Update voiceChatStore.isTalking = true
//
// stopPlayerVoice():
//   - Set localStream audio tracks enabled = false
//   - Send voice:talking { isTalking: false, targetPlayerId: null } via game WebSocket
//   - Update voiceChatStore.isTalking = false

// On unmount:
// - peer.destroy()
// - Stop all media tracks (stream.getTracks().forEach(t => t.stop()))
// - Destroy spatial audio manager
```

### Tasks (in implementation order)

```yaml
Task 1: Install PeerJS dependency
RUN: npm install peerjs --workspace=apps/game-frontend

Task 2: Add voice chat constants to gameConfig.ts
MODIFY apps/game-frontend/src/data/gameConfig.ts:
  - ADD facingThreshold to INTERACTION object:
    - facingThreshold: 0 (dot product threshold — 0 means front hemisphere only, ~90° arc)
  - ADD VOICE_CHAT constant object:
    - spatialRefDistance: 1
    - spatialMaxDistance: 8
    - spatialRolloff: 2

Task 3: Add WebSocket message types for voice talking indicator
MODIFY libs/shared-types/src/lib/websocket.ts:
  - ADD to clientMessageSchema:
    - { type: 'voice:talking', payload: { isTalking: boolean, targetPlayerId: z.string().nullable() } }
  - ADD to serverMessageSchema:
    - { type: 'voice:playerTalking', payload: { playerId: string, isTalking: boolean } }
THEN RUN: npm run build (to propagate shared-types changes to frontend and server)

Task 4: Add voice:talking relay handler to server
MODIFY apps/game-server/src/main.ts:
  - ADD import for handleVoiceTalking or inline handler
  - ADD case 'voice:talking' to handleMessage switch
  - Handler: look up sender UID via players.getUidByWs(ws), return early if no UID
  - Broadcast { type: 'voice:playerTalking', payload: { playerId: uid, isTalking: msg.payload.isTalking } }
    to all other players via players.broadcast(msg, uid)
  - NOTE: broadcast to ALL players is intentional — speaker icon should be visible to everyone,
    even though PeerJS audio only goes to the targeted player

Task 5: Add nearestTarget and talkingPlayers to worldStore
MODIFY apps/game-frontend/src/stores/worldStore.ts:
  - ADD NearestTarget interface: { type: 'agent' | 'player'; id: string }
  - EXPORT NearestTarget type
  - ADD state: nearestTarget: NearestTarget | null (initial: null)
  - ADD state: talkingPlayers: Record<string, boolean> (initial: {})
  - ADD action: setNearestTarget(target: NearestTarget | null)
  - ADD action: setPlayerTalking(id: string, talking: boolean)
    - If talking is false, delete the key (don't set to false)
  - KEEP nearestAgent and setNearestAgent unchanged for backward compat

Task 6: Create voiceChatStore
CREATE apps/game-frontend/src/stores/voiceChatStore.ts:
  - Zustand store with:
    - peerReady: boolean (initial: false)
    - localStream: MediaStream | null (initial: null)
    - isTalking: boolean (initial: false)
    - micPermissionDenied: boolean (initial: false)
    - activeCallPeerId: string | null (initial: null)
    - setPeerReady, setLocalStream, setIsTalking, setMicPermissionDenied, setActiveCallPeerId
  - FOLLOW pattern from voiceStore.ts (Zustand create())

Task 7: Create playerSpatialAudio manager [x]
CREATE apps/game-frontend/src/lib/playerSpatialAudio.ts:
  - Class PlayerSpatialAudioManager with:
    - private audioCtx: AudioContext | null
    - private peers: Map<string, { source, panner, gain }>
    - initialize(): call getAudioContext() from existing spatialAudio.ts (shares singleton)
    - addRemoteStream(peerId: string, stream: MediaStream):
      - createMediaStreamSource -> PannerNode -> GainNode -> ctx.destination
      - PannerNode config: panningModel 'HRTF', distanceModel 'inverse',
        refDistance/maxDistance/rolloffFactor from VOICE_CHAT constants
    - updatePeerPosition(peerId: string, x: number, y: number, z: number):
      - Set panner.positionX/Y/Z.value (or fallback to setPosition for legacy)
    - updateListenerPosition(x: number, y: number, z: number):
      - Set audioCtx.listener.positionX/Y/Z.value
    - updateListenerOrientation(forwardX: number, forwardY: number, forwardZ: number):
      - Set audioCtx.listener.forwardX/Y/Z.value, up = (0, 1, 0)
    - removeRemoteStream(peerId: string): disconnect all nodes, delete from map
    - destroy(): remove all streams, nullify audioCtx ref
  - Export singleton instance: export const playerSpatialAudio = new PlayerSpatialAudioManager()

Task 8: Create useProximityVoice hook
CREATE apps/game-frontend/src/hooks/useProximityVoice.ts:
  - useEffect that watches worldStore.playerId (NOT on mount — playerId is null until world:state)
  - When playerId becomes non-null:
    1. Dynamic import PeerJS: const { default: Peer } = await import('peerjs')
    2. Create Peer: new Peer(playerId) — PeerJS Cloud is default, no config needed
    3. Get mic stream: getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } })
       - On DENY: set voiceChatStore.micPermissionDenied = true, return (no voice)
    4. Disable all audio tracks (push-to-talk default)
    5. peer.on('call', (call) => { call.answer(localStream); call.on('stream', ...) })
  - Subscribe to worldStore.remotePlayers:
    - If an active call peer is no longer in remotePlayers, close call + cleanup spatial audio
  - On proximity loss while talking: auto-call stopPlayerVoice()
  - startPlayerVoice(targetId):
    - Ensure PeerJS call exists (initiate if needed, lower UID initiates)
    - localStream.getAudioTracks().forEach(t => t.enabled = true)
    - gameSocket.send({ type: 'voice:talking', payload: { isTalking: true, targetPlayerId: targetId } })
    - voiceChatStore.setIsTalking(true)
  - stopPlayerVoice():
    - localStream.getAudioTracks().forEach(t => t.enabled = false)
    - gameSocket.send({ type: 'voice:talking', payload: { isTalking: false, targetPlayerId: null } })
    - voiceChatStore.setIsTalking(false)
  - Cleanup on unmount: peer.destroy(), stop all tracks, playerSpatialAudio.destroy()
  - Return { peerReady, startPlayerVoice, stopPlayerVoice }

Task 9: Update Player.tsx — unified targeting + T key branching
MODIFY apps/game-frontend/src/components/game/Player.tsx:
  - ADD subscription: const remotePlayers = useWorldStore((s) => s.remotePlayers)
  - ADD subscription: const setNearestTarget = useWorldStore((s) => s.setNearestTarget)
  - ADD ref: const targetTypeRef = useRef<'agent' | 'player' | null>(null)
  - IMPORT and CALL useProximityVoice hook: const { startPlayerVoice, stopPlayerVoice } = useProximityVoice()
  - REPLACE nearestAgent-only scan (lines 166-178) with unified scan:
    - Compute forwardX/forwardZ from facingAngle.current
    - Iterate agents: compute distance + dot product, score with facing threshold
    - Iterate Object.values(remotePlayers): same scoring algorithm
    - Call setNearestTarget(bestTarget)
    - Call setNearestAgent(bestTarget?.type === 'agent' ? bestTarget.id : null) for backward compat
  - MODIFY T keydown handler (lines 72-80):
    - Read target from useWorldStore.getState().nearestTarget
    - Set targetTypeRef.current = target.type (lock in target type for keyup)
    - If target.type === 'agent': existing Deepgram flow (unchanged)
    - If target.type === 'player': call startPlayerVoice(target.id)
  - MODIFY T keyup handler (lines 91-107):
    - Check targetTypeRef.current (NOT current nearestTarget — user may have turned)
    - If targetTypeRef.current === 'agent' && recordingRef.current: existing agent stop flow
    - If targetTypeRef.current === 'player': call stopPlayerVoice()
    - Reset targetTypeRef.current = null
  - ADD in useFrame: update spatial audio listener position and orientation
    - playerSpatialAudio.updateListenerPosition(pos.x, pos.y, pos.z)
    - playerSpatialAudio.updateListenerOrientation(Math.sin(facingAngle.current), 0, Math.cos(facingAngle.current))

Task 10: Update InteractionPrompt for player targets
MODIFY apps/game-frontend/src/components/game/InteractionPrompt.tsx:
  - Read nearestTarget from worldStore (in addition to or replacing nearestAgent)
  - Read remotePlayers from worldStore
  - If nearestTarget is null OR chatPanelOpen: return null (existing behavior)
  - If nearestTarget.type === 'agent': show existing text "Press E to chat or hold T to talk to [Agent]"
  - If nearestTarget.type === 'player':
    - Look up player name: remotePlayers[nearestTarget.id]?.username
    - Show: "Hold T to talk to [PlayerName]" (no E option — voice only for players)

Task 11: Update RemotePlayer with speaker icon + spatial audio position
MODIFY apps/game-frontend/src/components/game/RemotePlayer.tsx:
  - Read talkingPlayers from worldStore
  - Check: const isTalking = talkingPlayers[player.id] === true
  - If isTalking: render a Billboard speaker icon above avatar at y=2.6 (above username at y=2.2)
    - Use a Text element with speaker emoji or a simple animated circle
    - Apply pulsing animation via CSS or useFrame opacity cycling
  - Speaker icon is for REMOTE players only (local player sees HUD state, not icon)
  - In useFrame callback, add spatial audio position update:
    - playerSpatialAudio.updatePeerPosition(player.id, groupRef.current.position.x, groupRef.current.position.y, groupRef.current.position.z)

Task 12: Wire voice:playerTalking in messageHandler
MODIFY apps/game-frontend/src/lib/messageHandler.ts:
  - ADD case for 'voice:playerTalking' in the message switch:
    - const { playerId, isTalking } = msg.payload
    - useWorldStore.getState().setPlayerTalking(playerId, isTalking)
```

### Integration Points

```yaml
SHARED_TYPES:
  - schema: "Add voice:talking + voice:playerTalking to websocket.ts discriminated unions"
  - build: "MUST run npm run build after Task 3 to propagate types before frontend/server tasks"

SERVER:
  - handler: "Add voice:talking case to main.ts handleMessage switch"
  - broadcast: "Use existing players.broadcast(msg, uid) with excludeUid — broadcast to ALL for speaker icon visibility"

FRONTEND_STORES:
  - worldStore: "Add NearestTarget type, nearestTarget state, talkingPlayers state"
  - voiceChatStore: "New store for PeerJS connection state + micPermissionDenied"

FRONTEND_HOOKS:
  - useProximityVoice: "New hook managing PeerJS lifecycle, mic stream, call management, push-to-talk"

FRONTEND_UI:
  - InteractionPrompt: "Extend for player targets (voice-only, no E key for players)"
  - RemotePlayer: "Add speaker icon (remote only) + spatial audio peer position updates"
  - Player: "Unified targeting with facing direction + T key branching with targetTypeRef + spatial audio listener"

FRONTEND_LIB:
  - playerSpatialAudio: "New PlayerSpatialAudioManager class (reuses AudioContext from spatialAudio.ts)"
  - messageHandler: "Add voice:playerTalking case"

NPM:
  - install: "peerjs in game-frontend workspace (Task 1, before all other tasks)"

NO CHANGES:
  - Database schema (no DB involvement)
  - Agent voice flow (Deepgram STT path unchanged)
  - ChatPanel, ChatStore (agent chat unchanged)
  - Game.tsx (hook lives in Player.tsx)
  - Server player service (no new maps — talking state relayed via WS broadcast)
```

## Validation Loop

```bash
# Run after each task group:
npm run build          # Full NX build
npm run lint           # ESLint across all apps

# Manual testing:
# 1. Open two browser tabs, sign in as different users
# 2. Walk both players close together (within 3 units)
# 3. Verify interaction prompt shows player name
# 4. Hold T in one tab, verify audio plays in the other
# 5. Walk apart, verify prompt disappears and audio stops
# 6. Walk near an agent, verify T still does agent voice
# 7. Stand between an agent and player, turn to face each — verify correct targeting
```

## Final Validation Checklist

- [ ] No linting errors: `npm run lint`
- [ ] No type errors: `npm run build`
- [ ] PeerJS dynamically imported (no SSR crash)
- [ ] AudioContext created inside user gesture (T keydown)
- [ ] Mic acquired once with echoCancellation + noiseSuppression, toggled via track.enabled
- [ ] Mic permission denial handled gracefully (micPermissionDenied state set, no crash)
- [ ] Only lower UID initiates PeerJS call (no duplicate calls)
- [ ] targetTypeRef correctly locks T key behavior on keydown (no race on target change mid-hold)
- [ ] Spatial audio listener position + orientation updated every frame
- [ ] Spatial audio peer positions updated every frame in RemotePlayer
- [ ] Existing agent E/T interactions unchanged
- [ ] Speaker icon visible on talking remote players (not on local player)
- [ ] Connections cleaned up on: player leave, tab close, walk out of range, target disconnect
- [ ] Auto-stop talking if target walks out of range mid-sentence

## Anti-Patterns to Avoid

- Don't import PeerJS at top level — must dynamic import for SSR safety
- Don't call getUserMedia on every T press — acquire once, toggle track.enabled
- Don't broadcast audio to all players — this is 1-to-1 targeted voice
- Don't add PeerJS signaling to our WebSocket server — use PeerJS Cloud (zero config)
- Don't create a new AudioContext — reuse via getAudioContext() from spatialAudio.ts
- Don't modify the existing agent voice flow — branch on target type, keep paths independent
- Don't store voice data in DB — voice is entirely ephemeral
- Don't add 'use client' to files that already have it
- Don't create Peer instance before worldStore.playerId is available
- Don't check nearestTarget on keyup — use targetTypeRef captured on keydown
- Don't show speaker icon on the local player — only on remote players
