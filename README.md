# BossBot

**[Try it live →](https://bossbot.pages.dev)**

BossRoom is a 3D virtual office where AI agents are your coworkers. Walk around a physics-enabled world, talk to agents by voice or text, and watch them execute real work: sending emails via Gmail, booking meetings on Google Calendar, filing Linear tickets, and searching products. A Receptionist agent dynamically assembles specialized teams of 3–12 AI workers on the fly. Built in 20 hours at the **YC Browser Use Web Agents Hackathon**.

BossRoom offers two distinct interfaces:

1. **Imagine Mode** — A desktop OS-style UI inspired by Claude Imagine, where agents work inside virtual machine windows with artifact previews, workspace dashboards, and a familiar desktop metaphor.
2. **3D World** — A fully navigable third-person 3D office built with React Three Fiber and Rapier physics, where you walk up to AI agents at their desks, interact face-to-face, and watch teams materialize in real time.

<img width="1536" height="1024" alt="BossBot" src="https://github.com/user-attachments/assets/0b7f8e0b-9dea-4c15-b636-1c7d94516e6d" />

---

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| **Frontend** | Next.js 16, React 19, Tailwind v4, Three.js (React Three Fiber), Zustand, shadcn/ui |
| **Backend** | Node.js, WebSocket (ws), Vercel AI SDK, Composio, MCP, Drizzle ORM, Convex |
| **AI** | Vercel AI Gateway (unified proxy) → Gemini, Claude, GPT-4o per agent |
| **Voice** | Deepgram STT (Nova 3), MiniMax TTS, PeerJS (P2P proximity chat) |
| **Auth** | Firebase Authentication (Google Sign-In) |
| **Infra** | GCP Cloud Run, Cloud SQL, Cloudflare Pages, Terraform |

## Features

### Core

- **Dynamic agent teams** — Describe a task to the Receptionist and watch it assemble a custom team of 3–12 specialized AI agents
- **Dual UI modes** — Switch between a 3D game world and a desktop OS-style Imagine interface
- **Real tool execution** — Agents send real emails, create real calendar events, file real Linear tickets, and browse the web with Browser Use
- **Streaming AI chat** — Real-time streamed responses with inline tool execution display

### 3D World

- **Physics-enabled office** — Walk around a Rapier-powered 3D environment with procedurally generated terrain
- **Roblox-style camera** — Third-person follow cam with right-click orbit, scroll zoom, and V-key view toggle
- **Agent microinteractions** — Agents wander their zones and return to desks when you approach
- **Speech bubbles** — HTML-based thought bubbles positioned in 3D space above agents
- **13 avatar models** — Selectable characters with live 3D previews
- **Multiplayer** — See other players moving around the office in real time

### Imagine Mode

- **Virtual machine windows** — Each agent works inside its own VM-style window
- **Artifact previews** — Rich inline previews of agent outputs (documents, code, data)
- **Workspace dashboard** — Overview of all active agents and their statuses

### Voice

- **Voice input (STT)** — Talk to agents via microphone using Deepgram Nova-3
- **Voice output (TTS)** — Agents speak responses aloud via MiniMax TTS with HRTF spatial audio
- **Proximity voice chat** — P2P audio between nearby players via PeerJS (push-to-talk, distance-based fade)

### Workspace

- **Persistent workspaces** — DB-backed workspaces that survive sessions, with tab switching and archive
- **Scratchpad feed** — Collaborative feed where agents and users post updates
- **Embed viewer** — Agents can surface documents, boards, and presentations inline
- **Agent skills** — Agents learn and create reusable skills over time

## Architecture

```
BossBot/
├── apps/
│   ├── game-frontend/     # Next.js 16 + Tailwind v4 + Three.js (R3F) + shadcn/ui
│   └── game-server/       # Node.js + WebSocket + AI SDK + Composio + Drizzle ORM
├── libs/
│   ├── shared-types/      # @bossroom/shared-types (WS protocol + agent types)
│   └── shared-utils/      # @bossroom/shared-utils (agent defs, constants, logger)
├── convex/                # Convex backend (activity logging, schema)
├── terraform/             # GCP Cloud Run, Cloud SQL, Firebase Auth, Cloudflare Pages
└── scripts/
    ├── health-check.mjs   # Infrastructure health check
    └── generate-env.mjs   # Terraform outputs → .env files
```

NX monorepo with npm workspaces. TypeScript project references, not tsconfig paths.

## Agents

| Agent | Role |
|-------|------|
| **Receptionist** | Office concierge — builds custom teams of dynamic AI agents via `setup_workspace` |
| **Shopkeeper** | In-game merchant — product search and purchase |

All other agents are **created dynamically at runtime** by the Receptionist. When you describe a task, the Receptionist decides how many agents to create (3–12), what skills they need, and who leads — every workspace is different. Agents are persisted to the database and survive restarts.

Agents use the **Vercel AI SDK** (`streamText` with multi-step tool calling) routed through **Vercel AI Gateway**. **Composio** handles per-user OAuth tool integrations (Gmail, Calendar, Linear). Pre-built agent definitions live in `libs/shared-utils/src/lib/agent-defs.ts`.

## Quick Start

1. **Get the `.env` file** from the team lead
2. **Install dependencies:**

```bash
npm install
```

3. **Verify everything works:**

```bash
npm run health
```

4. **Start developing:**

```bash
npm run dev
```

- **App:** http://localhost:3000 — sign in with Google, walk around, press E near an agent

## Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start both frontend + server |
| `npm run dev:frontend` | Frontend only (Next.js, port 3000) |
| `npm run dev:server` | Server only (WebSocket, port 8080) |
| `npm run build` | Build all apps |
| `npm run lint` | Lint all apps |
| `npm run health` | Validate all connections (DB, AI Gateway, Firebase) |
| `npm run db:push` | Sync Drizzle schema to database (dev) |
| `npm run db:studio` | Open visual database browser |
| `npm run db:generate` | Generate migration files (prod) |
| `npm run db:migrate` | Run migrations (prod) |

## Environment Variables

Copy `.env.example` to `.env` and fill in values:

```bash
# Database
DATABASE_URL=                  # PostgreSQL (Cloud SQL)

# Firebase Auth (server)
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=

# Firebase Auth (frontend)
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# AI
AI_GATEWAY_API_KEY=            # Vercel AI Gateway
GOOGLE_AI_API_KEY=             # Google AI (Gemini)

# Voice
DEEPGRAM_API_KEY=              # Deepgram STT
MINIMAX_API_KEY=               # MiniMax TTS
MINIMAX_TTS_VOICE_ID=English_expressive_narrator
MINIMAX_TTS_MODEL=speech-2.8-hd
NEXT_PUBLIC_VOICE_ENABLED=true

# Composio (optional — agent tools won't work without it)
COMPOSIO_API_KEY=

# Convex
CONVEX_URL=
CONVEX_DEPLOY_KEY=

# Frontend
NEXT_PUBLIC_WS_URL=ws://localhost:8080
NEXT_PUBLIC_SERVER_HTTP_URL=http://localhost:8080
```

## How It Works

### Multi-Agent Orchestration

The Receptionist LLM calls a `setup_workspace` tool that creates 3–12 specialized agents — each with a compiled system prompt, conversation history, Composio OAuth tools scoped per-user, and the ability to create new skills at runtime. The lead agent delegates via `delegate_task`, workers post to a shared scratchpad, and the lead calls `finish_task` to compile a final summary.

AI calls use `streamText` with multi-step tool calling routed through **Vercel AI Gateway** — a unified proxy that lets us swap between Gemini, Claude, and GPT-4o per agent. Real-world actions (Gmail, Calendar, Linear, web browsing) flow through **Composio** OAuth integrations and **Browser Use** for web automation.

### Voice Pipeline

```
┌─ Frontend ─────────────────────────────────────┐
│  useVoiceInput.ts                              │
│    ↓ mic audio via WebSocket                   │
│    → wss://api.deepgram.com/v1/listen          │
│    ← transcript → sent as agent:message        │
│                                                │
│  voiceStore.ts                                 │
│    ← agent:ttsAudio (base64 MP3 from server)   │
│    → Audio() playback with HRTF spatial panning│
│                                                │
│  useProximityVoice.ts                          │
│    ↔ PeerJS P2P audio (nearby players)         │
└────────────────────────────────────────────────┘

┌─ Server ───────────────────────────────────────┐
│  GET /api/deepgram/token → returns API key     │
│  tts.ts → MiniMax TTS API                      │
│    → sends agent:ttsAudio to client            │
└────────────────────────────────────────────────┘
```

Two independent spatial audio pipelines (agent TTS + player P2P) share a single AudioContext with HRTF panners positioned at each source's 3D coordinates.

### Authentication

1. User signs in with Google via Firebase Auth
2. App gets Firebase ID token → opens WebSocket with token
3. Server verifies token via Admin SDK → upserts user in DB
4. Composio tools are scoped to the authenticated user's OAuth connections (keyed by Firebase UID)

### Deployment

Terraform manages the entire stack as infrastructure-as-code:

- **Google Cloud Run** — WebSocket game server with Cloud SQL proxy sidecar
- **Google Cloud SQL** — PostgreSQL 15 via Drizzle ORM
- **Cloudflare Pages** — Static-exported Next.js frontend
- **Firebase Auth** — Google Sign-In with Identity Platform
- **Convex** — Real-time activity logging and data sync

```bash
gcloud builds submit --config=cloudbuild.yaml .
cd terraform && terraform apply
```
