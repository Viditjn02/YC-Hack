# CLAUDE.md

## Project Overview

BossRoom is an agent-first 3D workspace. Users walk around a virtual office and interact with AI agents that manage comms, calendar, and projects. NX monorepo with npm workspaces.

## Architecture

```
apps/game-frontend/   Next.js 16 + React 19 + Tailwind v4 + Three.js (R3F) + Zustand
apps/game-server/     Node.js + WebSocket (ws) + Drizzle ORM + PostgreSQL
libs/shared-types/    @bossroom/shared-types — shared TS types for messages, agents
libs/shared-utils/    @bossroom/shared-utils — agent definitions, constants, shared logger
terraform/            GCP Cloud Run, Cloud SQL, Firebase Auth, Cloudflare Pages
scripts/              health-check.mjs, generate-env.mjs
```

## Key Technical Decisions

- **NX v22** uses TypeScript project references + `customConditions: ["@org/source"]` — NOT tsconfig paths
- **Shared types** imported via npm workspaces (`@bossroom/shared-types`), not path aliases
- **`module: "nodenext"`** requires `.js` extensions in all relative imports on the server
- **Tailwind v4** uses CSS-first config (`@import "tailwindcss"`), PostCSS plugin is `@tailwindcss/postcss`
- **AI Gateway**: Vercel AI Gateway at `https://ai-gateway.vercel.sh/v1`. Single `AI_GATEWAY_API_KEY` env var. Provider API keys configured as BYOK in Vercel dashboard (not in code). Uses `@ai-sdk/openai` (`createOpenAI`) with model strings like `google/gemini-3-flash`, `anthropic/claude-sonnet-4-5`, `openai/gpt-4o`.
- **Voice — Deepgram STT**: Client opens WebSocket to `wss://api.deepgram.com/v1/listen` (model `nova-3`). Token minted server-side via `GET /api/deepgram/token` (returns `DEEPGRAM_API_KEY` directly). Frontend hook: `useVoiceInput.ts`.
- **Voice — Inworld TTS**: Server POSTs to `https://api.inworld.ai/tts/v1/voice` with Basic auth. Returns base64 MP3 audio. Sent to client via `agent:ttsAudio` WebSocket message. Config: `INWORLD_VOICE_ID=Dominus`, `INWORLD_TTS_MODEL_ID=inworld-tts-1.5-mini`. Implementation: `apps/game-server/src/ai/tts.ts`.
- **Voice — PeerJS proximity chat**: P2P audio between players via `peerjs` SDK. Uses Firebase UID as peer ID, default PeerJS Cloud server (no config needed). Push-to-talk with echo cancellation. Frontend hook: `useProximityVoice.ts`.
- **Frontend hosting**: Cloudflare Pages with static export (`output: 'export'` in next.config.js). No API routes allowed.
- **Single source of truth for types**: `AgentStatus`, `AgentSkill`, `ClientMessage`, `ServerMessage` all live in `libs/shared-types/`. Frontend and server import from `@bossroom/shared-types`.
- **Agent definitions**: Pre-built agents (Receptionist + Shopkeeper) are defined in `libs/shared-utils/src/lib/agent-defs.ts`. All other agents are created dynamically at runtime by the Receptionist's `setup_workspace` tool and persisted to DB.
- **MCP**: `@ai-sdk/mcp` client framework in `apps/game-server/src/ai/mcp.ts`. Visa Intelligent Commerce (VIC) MCP configured for the Shopkeeper agent.
- **Visa MCP**: Optional Visa VIC integration in `apps/game-server/src/ai/visa.ts` for product search and payments. Env vars: `VISA_VIC_API_KEY`, `VISA_EXTERNAL_CLIENT_ID`, etc.

## External Services

| Service | Purpose | SDK/Protocol | Auth | Env Var(s) |
|---------|---------|-------------|------|------------|
| **Vercel AI Gateway** | LLM unified proxy | `@ai-sdk/openai` (createOpenAI) | Bearer token | `AI_GATEWAY_API_KEY` |
| **Firebase** | Auth (Google Sign-In) | `firebase` (client), `firebase-admin` (server) | ID tokens / service account | `NEXT_PUBLIC_FIREBASE_*`, `FIREBASE_*` |
| **Composio** | OAuth tool integrations (Gmail, Calendar, Tasks, Linear) | `@composio/core`, `@composio/vercel` | API key | `COMPOSIO_API_KEY` |
| **Deepgram** | Speech-to-text (STT) | WebSocket (`wss://api.deepgram.com/v1/listen`) | Token subprotocol | `DEEPGRAM_API_KEY` |
| **Inworld** | Text-to-speech (TTS) | REST POST (`https://api.inworld.ai/tts/v1/voice`) | Basic auth | `INWORLD_API_KEY`, `INWORLD_VOICE_ID`, `INWORLD_TTS_MODEL_ID` |
| **PeerJS** | P2P proximity voice chat | `peerjs` | Peer ID (Firebase UID) | None (uses PeerJS Cloud) |
| **Visa VIC** | Intelligent Commerce (product search, payments) | MCP (`@visa/mcp-client`) | API key + client ID | `VISA_VIC_API_KEY`, `VISA_EXTERNAL_CLIENT_ID`, etc. |
| **Cloud SQL** | PostgreSQL database | `pg` + Drizzle ORM | Connection string | `DATABASE_URL` |
| **Google AI** | Direct Gemini access (fallback) | — | API key | `GOOGLE_AI_API_KEY` |

## NPM Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Start frontend (port 3000) + server (port 8080) in parallel |
| `npm run build` | Build all apps via NX |
| `npm run lint` | ESLint across all apps |
| `npm run health` | Validate DB, AI Gateway, Firebase, WebSocket connections |
| `npm run db:push` | Push schema to DB directly (dev only, no migration history) |
| `npm run db:generate` | Generate SQL migration from schema diff (production workflow) |
| `npm run db:migrate` | Apply pending migrations to DB (production workflow) |
| `npm run db:studio` | Open Drizzle visual DB browser |

## HTTP Routes (Game Server)

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/deepgram/token` | Mint Deepgram access token for client STT |
| `GET` | `/auth/composio/url?app=...&userId=...` | Initiate Composio OAuth flow, returns `redirectUrl` |
| `GET` | `/auth/composio/status?userId=...` | List user's active Composio connections |

## Deployment

### Backend (Cloud Run)

The game server runs as a Docker container on GCP Cloud Run.

- **Dockerfile**: `apps/game-server/Dockerfile` — multi-stage build (build with NX, then slim production image)
- **Registry**: Google Artifact Registry at `us-central1-docker.pkg.dev/treehacks-2026-487500/bossroom/game-server`
- **Cloud Build config**: `cloudbuild.yaml` — builds amd64 image on GCP

**Deploy workflow:**
```bash
# Build & push via Cloud Build (builds on GCP, always amd64)
gcloud builds submit --config=cloudbuild.yaml --project=treehacks-2026-487500 --substitutions=SHORT_SHA=$(git rev-parse --short HEAD) .

# Deploy to Cloud Run (Terraform manages env vars, Cloud SQL proxy, etc.)
cd terraform && terraform apply
```

**Cloud Run env vars** (managed by Terraform in `cloud-run.tf`):
- `DATABASE_URL` — Cloud SQL proxy Unix socket connection string
- `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` — from Terraform service account
- `AI_GATEWAY_API_KEY` — Vercel AI Gateway key
- `ALLOWED_ORIGIN` — Cloudflare Pages URL for CORS
- `COMPOSIO_API_KEY` — Composio agent tools
- `DEEPGRAM_API_KEY` — Deepgram speech-to-text
- `INWORLD_API_KEY`, `INWORLD_VOICE_ID`, `INWORLD_TTS_MODEL_ID` — Inworld TTS
- `GOOGLE_AI_API_KEY` — Google AI API key
- `VISA_VIC_API_KEY`, `VISA_VIC_API_KEY_SS`, `VISA_EXTERNAL_CLIENT_ID`, `VISA_EXTERNAL_APP_ID` — Visa VIC MCP (optional)

### Frontend (Cloudflare Pages)

- Auto-deploys on git push via Cloudflare Pages GitHub integration
- `NEXT_PUBLIC_*` env vars managed by Terraform in `cloudflare.tf` — do NOT manually set in Cloudflare dashboard
- `NEXT_PUBLIC_WS_URL` is auto-derived from Cloud Run URL (`https://` → `wss://`)
- `NEXT_PUBLIC_SERVER_HTTP_URL` is the Cloud Run URL (for Deepgram token endpoint)
- `NEXT_PUBLIC_VOICE_ENABLED` toggles voice features on the frontend

## Database / Drizzle

- Schema: `apps/game-server/src/db/schema.ts`
- Config: `apps/game-server/src/db/drizzle.config.ts`
- Migrations output: `apps/game-server/drizzle/`
- Client: `apps/game-server/src/db/client.ts`
- Tables: `users` (with jsonb `settings`), `workspaces`, `workspaceAgents`, `skills`, `conversations` (unique per user+agent, with `workspaceId`), `taskHistory`, `scratchpadEntries`

**Dev workflow:** Edit `schema.ts` then `npm run db:push` (syncs directly, no migration files).

**Production workflow:** Edit `schema.ts` then `npm run db:generate` (creates migration SQL) then commit then `npm run db:migrate` (applies it). Always use this for production so migration history is tracked.

## Server Domain Modules

The server is organized into domain modules under `apps/game-server/src/domains/`:

| Module | Purpose |
|--------|---------|
| `agents/` | Agent lifecycle, AI streaming, tool execution, TTS integration |
| `conversations/` | Per-user per-agent conversation persistence |
| `players/` | Player state, position tracking, WebSocket management |
| `scratchpad/` | Workspace scratchpad entries — persistent collaborative feed |
| `skills/` | Dynamic agent skill creation and management |
| `users/` | User DB operations (upsert on join, settings) |
| `workspaces/` | DB-backed workspace CRUD (create, load, archive, agents) |

## File Conventions

- All frontend components use `'use client'` directive
- Server files use `.js` extensions in imports (`./agents/AgentManager.js`)
- Status types (`AgentStatus`) come from `@bossroom/shared-types`, not redefined locally
- Status display maps (`statusColors`, `statusLabels`) live in `apps/game-frontend/src/data/agents.ts`
- Game constants live in `apps/game-frontend/src/data/gameConfig.ts`
- Avatar data (model URLs, labels) live in `apps/game-frontend/src/data/avatars.ts`
- Agent thought bubble text lives in `apps/game-frontend/src/data/agentThoughts.ts`
- Server logging uses `log` from `apps/game-server/src/logger.ts` (not raw `console.log`)
- Server env validation: `apps/game-server/src/env.ts` — Zod schema, crashes at startup if invalid

### Frontend Stores (Zustand)

| Store | File | Purpose |
|-------|------|---------|
| Auth | `authStore.ts` | Firebase auth state + `onAuthStateChanged` listener |
| Settings | `settingsStore.ts` | Avatar selection + settings panel visibility |
| Agent Behavior | `agentBehaviorStore.ts` | Runtime agent positions for proximity detection |
| World | `worldStore.ts` | Remote players state |
| Chat | `chatStore.ts` | Chat message history per agent |
| Voice | `voiceStore.ts` | TTS queue management (enqueue/dequeue/play) |
| Voice Chat | `voiceChatStore.ts` | P2P proximity voice state (mic, peer, talking) |
| Tool | `toolStore.ts` | Tool execution status display |
| Workspace | `workspaceStore.ts` | Dynamic workspace/task orchestration |
| Onboarding | `onboardingStore.ts` | Onboarding UI state |
| Scratchpad | `scratchpadStore.ts` | Workspace scratchpad entries and feed |
| Music | `musicStore.ts` | Background music track selection and volume |
| Embed | `embedStore.ts` | Embedded document/board panel state |
| Product | `productStore.ts` | Shopkeeper product cards display |

### Frontend Hooks

| Hook | File | Purpose |
|------|------|---------|
| `useVoiceInput` | `useVoiceInput.ts` | Deepgram STT — mic recording → WebSocket → transcript |
| `useProximityVoice` | `useProximityVoice.ts` | PeerJS P2P audio — proximity-based voice chat |
| `useAgentWander` | `useAgentWander.ts` | Agent idle wandering animation |
| `useBroadcastPosition` | `useBroadcastPosition.ts` | Send player position to server |
| `useBuildSequence` | `useBuildSequence.ts` | Dynamic workspace build animation |
| `useNearestAgent` | `useNearestAgent.ts` | Find closest agent for interaction |
| `useOnboardingSteps` | `useOnboardingSteps.ts` | Onboarding flow step logic |

### Key Frontend Files

- Firebase client SDK: `apps/game-frontend/src/lib/firebase.ts` — singleton init with HMR guard
- Login page: `apps/game-frontend/src/components/auth/LoginPage.tsx` — Google Sign-In gate
- Auth gating lives in `page.tsx` (client component), not `layout.tsx` (server component)
- Camera: `apps/game-frontend/src/components/game/CameraRig.tsx` — Roblox-style third-person follow cam

### Key Server Files

- Firebase Admin SDK: `apps/game-server/src/auth/firebase-admin.ts` — `verifyToken()` helper
- AI Gateway client: `apps/game-server/src/ai/gateway.ts` — `createOpenAI` with Vercel AI Gateway
- TTS synthesis: `apps/game-server/src/ai/tts.ts` — Inworld API integration
- Composio client: `apps/game-server/src/ai/composio.ts` — tool integration
- Composio OAuth routes: `apps/game-server/src/http/composio-auth.ts`
- MCP manager: `apps/game-server/src/ai/mcp.ts` — external tool server connections
- Visa VIC MCP: `apps/game-server/src/ai/visa.ts` — Visa Intelligent Commerce integration
- Scratchpad service: `apps/game-server/src/domains/scratchpad/service.ts` — workspace scratchpad persistence
- Workspace repository: `apps/game-server/src/domains/workspaces/repository.ts` — workspace DB CRUD

## WebSocket Protocol

Messages are typed in `libs/shared-types/src/lib/websocket.ts`:

**Client → Server:**
- `player:join` — join with username + Firebase token
- `player:move` — position, rotation, animation update
- `player:updateSettings` — avatar / voice preference change
- `agent:interact` — start interaction with agent
- `agent:message` — send message to agent (with `inputMode`, optional `purchaseMode`/`purchaseBudget`)
- `agent:stopInteract` — end interaction with agent
- `voice:talking` — broadcast talking state for proximity voice
- `workspace:userNote` — add user note to workspace scratchpad
- `workspace:subscribe` — subscribe to workspace snapshot + scratchpad
- `workspace:archive` — archive a workspace (soft-delete)
- `conversations:reset` — reset conversations for given agent IDs (legacy)
- `shop:purchase` — direct product purchase (bypasses LLM)

**Server → Client:**
- `world:state` — full world snapshot on join
- `player:joined` — new player entered
- `player:left` — player disconnected
- `player:moved` — player position update
- `player:avatarChanged` — player changed avatar
- `agent:statusChanged` — agent status update
- `agent:chatMessage` — complete agent message
- `agent:chatStream` — streaming text delta
- `agent:toolExecution` — tool call started/completed/failed
- `agent:conversationHistory` — replay past messages on reconnect
- `agent:ttsAudio` — base64 MP3 audio from Inworld TTS
- `workspace:build` — dynamic agent workspace created
- `workspace:snapshot` — full workspace state (agents, scratchpad, status)
- `workspace:list` — list of user's active workspaces
- `workspace:scratchpadEntry` — new scratchpad entry
- `workspace:scratchpadHistory` — batch scratchpad entries
- `workspace:embedPanel` — embedded document/board panel
- `agent:skills` — list of agent skills
- `agent:skillCreated` — new skill created
- `agent:delegatedTask` — agent-to-agent task delegation
- `agent:productCards` — shopkeeper product card display
- `shop:purchaseResult` — purchase outcome
- `voice:playerTalking` — broadcast player talking state for proximity voice

## Common Gotchas

- Use `npx nx` (not `nx`) in npm scripts for cross-platform compatibility
- Run `npx nx sync` if builds fail with TS project reference errors
- `drizzle-kit` auto-loads `.env` — no need for dotenv wrapper in npm scripts
- The frontend WebSocket client (`lib/websocket.ts`) is a singleton; `initWebSocket` guards against double-init
- Frontend on HTTPS requires `wss://` WebSocket URL — `ws://` will be rejected and the client goes offline
- `NEXT_PUBLIC_WS_URL` is baked in at build time (static export) — Terraform manages it for prod, do NOT manually set in Cloudflare dashboard
- Zustand store actions that modify state inside async callbacks must use `get()` (not captured references) to avoid stale closures
- Firebase Identity Platform `authorized_domains` must include `localhost` for local dev
- Google IDP config needs explicit `enabled = true` in Terraform — updates to Identity Platform config can reset it
- Firebase Admin credentials come from Terraform-managed service account (env vars: `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`)
- Vercel AI Gateway is OpenAI-compatible ONLY — must use `@ai-sdk/openai` (`createOpenAI`), NOT native provider packages (`@ai-sdk/google`, `@ai-sdk/anthropic`). Native packages send provider-specific API formats that the gateway rejects.
- Next.js static export (`output: 'export'`) cannot have API routes — delete any `app/api/` routes before building
- Docker builds must target `linux/amd64` for Cloud Run — use Cloud Build (`gcloud builds submit`) instead of local `docker build` on ARM machines
- Cloud Run requires `volume_mounts` for Cloud SQL proxy socket — without it the DB connection fails silently
- Deepgram token endpoint (`/api/deepgram/token`) currently returns the raw API key — fine for hackathon, not production
- Inworld TTS uses Basic auth (`Authorization: Basic <INWORLD_API_KEY>`)
- PeerJS uses default cloud server — no self-hosted config needed
- `NEXT_PUBLIC_VOICE_ENABLED` must be `true` at build time for voice features to appear
