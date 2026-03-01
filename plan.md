🏗️ Product Requirements Document: Agent-First 3D Workspace Builder

---

## Implementation Status (Updated Feb 15, 2026)

### Fully Functional — Dynamic Agent Teams + Commerce + Voice + Persistent Workspaces

**All builds passing** — `npx nx run-many -t build` succeeds for all projects. Deployed to Cloud Run + Cloudflare Pages.

#### What's Working
- [x] NX monorepo (v22.5.0) with npm workspaces
- [x] `game-frontend` — Next.js 16 + Tailwind v4 + R3F + Zustand + shadcn/ui, Cloudflare Pages
- [x] `game-server` — Node.js + WebSocket + Drizzle ORM + AI SDK + Composio + MCP, Cloud Run
- [x] `@bossroom/shared-types` — WebSocket message protocol types + Agent types
- [x] `@bossroom/shared-utils` — Agent definitions, constants, shared logger
- [x] Drizzle ORM — Schema (users, workspaces, workspace_agents, skills, conversations, task_history, scratchpad_entries)
- [x] Vercel AI Gateway — `@ai-sdk/openai` routed through Vercel AI Gateway, all agents use Gemini 3 Flash
- [x] Vercel AI SDK — `streamText` with multi-step tool calling, streaming deltas to frontend
- [x] Composio integration — Per-user OAuth (Gmail, Calendar, Tasks, Linear, Stripe, SerpAPI)
- [x] MCP support — `@ai-sdk/mcp` for external tool servers, Visa VIC MCP active for Shopkeeper
- [x] **Receptionist agent** — Office concierge that dynamically creates teams of specialized agents via `setup_workspace`
- [x] **Shopkeeper agent** — In-game merchant with product cards, Visa MCP search, Composio Stripe payments
- [x] **Dynamic agent creation** — Receptionist builds custom teams at runtime, persisted to DB
- [x] **DB-backed persistent workspaces** — Workspaces survive restarts, tab switching, archive support
- [x] **Scratchpad feed** — Persistent collaborative feed per workspace (agents + users), hourly cleanup
- [x] **Embed viewer** — Agents surface Google Docs, Miro boards, presentations inline
- [x] **Product cards** — Rich visual product cards in Shopkeeper chat
- [x] **Visa VIC MCP** — Product search and payment processing via Visa Intelligent Commerce sandbox
- [x] **Floating workspace bar** — Bottom-right bar with Cmd/Ctrl+1-9 keyboard shortcuts
- [x] Firebase Auth — Google Sign-In, token verification, user upsert, scoped Composio sessions
- [x] Terraform — Cloud Run, Cloud SQL, Firebase Auth, Cloudflare Pages, all env vars managed
- [x] 3D office world — R3F + Rapier physics, Stanford campus, dynamic agent zones
- [x] Third-person player — ecctrl controller (WASD + camera orbit), 13 avatar models
- [x] **Live 3D avatar previews** — Animated character previews in picker with personality names
- [x] Agent interaction — Proximity detection, "Press E" overlay, chat panel with streaming
- [x] **Speech bubbles** — HTML-based speech bubbles above agents in 3D
- [x] **Personalized prompt pills** — Suggested prompts templated with user name/email
- [x] GTA-style onboarding — 5-step tutorial with auto-progression
- [x] **HUD agent roster** — Clickable agent cards with pulsing blue rings for unseen links
- [x] Tool execution toasts — Floating notifications for agent tool calls
- [x] **Background music** — Track selector with volume control
- [x] **Per-user voice selection** — Users pick preferred TTS voice in toolbar
- [x] Voice input (STT) — Deepgram speech-to-text (Nova 3) via WebSocket
- [x] Voice output (TTS) — Inworld text-to-speech with per-user voice preference
- [x] Proximity voice chat — PeerJS P2P audio between nearby players (push-to-talk)
- [x] Conversation persistence — Messages persisted to DB, restored on reconnect
- [x] **Camera view toggle** — V key switches perspective with one-time hint
- [x] Multiplayer — Real-time player sync with smooth interpolation
- [x] Markdown rendering — `react-markdown` + `remark-gfm` for rich agent responses
- [x] shadcn/ui — New York style, dark theme, Tailwind v4 CSS variables
- [x] Health check — Validates DB, AI Gateway, Firebase Admin SDK

#### Quick Start
```bash
git clone <repo> && cd BossBot
npm install
cp .env.example .env          # fill in API keys
npm run dev                    # frontend :3000 + server :8080
# Visit http://localhost:3000  — 3D world (sign in with Google)
```

#### Architecture (Implemented)
```
apps/game-frontend/     Next.js 16 + Tailwind v4 + R3F + ecctrl + Zustand + shadcn/ui
apps/game-server/       Node.js + ws + Drizzle ORM + AI SDK + Composio + MCP
libs/shared-types/      @bossroom/shared-types (WS protocol + Agent types)
terraform/              Cloud Run + Cloud SQL + Firebase + Vercel
scripts/                generate-env.mjs, health-check.mjs
```

---

1. Vision & Core Thesis
   We are building a gamified, 3D agent-first workspace — a fully interactive virtual office rendered in the browser where users navigate a third-person 3D world, interact with AI agent characters, and delegate real work to them. Agents don't just chat — they execute actual tasks (send emails, create tickets, schedule meetings, pull data) through live integrations.
   The analogy: What Windows did for computing (terminal → visual UI), we're doing for agent delegation (prompt engineering → intuitive 3D interaction). We're making AI delegation fun, memorable, and accessible to non-technical users.
   This is not a chatbot. This is not a dashboard. This is a living, breathing virtual office where AI workers do your bidding — and you can watch them do it.
2. End-to-End User Experience
   2.1 First Launch — GTA-Style Onboarding
   • User opens the web app and enters a 3D virtual office environment (rendered in Three.js)
   • A GTA-style onboarding sequence begins: a text box at the bottom of the screen provides instructions, and arrows point to the next location the user should navigate to
   • Step 1: "Welcome to your workspace. Walk over to your first agent" → arrow points to a character sitting at a desk
   • Step 2: "Click on them to start a conversation" → user left-clicks the agent
   • Step 3: "Type a task and hit send" → user types a natural language prompt
   • Step 4: Agent visually reacts, does the work, and reports back
   • The onboarding teaches users the core loop: navigate → click → delegate → watch results
   2.2 The Office World — CPU Plaza Concept
   Inspired by Astrobot PS5's CPU Plaza, the virtual office is divided into themed sections/rooms, each housing agents specialized in different domains. The zones include:
   • Communications Hub — Email, Slack, messaging agents (e.g. "Email Arvin about next week's meeting")
   • Project Ops Center — Linear, GitHub, task management agents (e.g. "Create a ticket for the auth bug")
   • Research Lab — Web research, data analysis agents (e.g. "Research competitors in the AI workspace space")
   • Creative Studio — Content, docs, design agents (e.g. "Draft a blog post about our launch")
   • Calendar Lounge — Scheduling, meetings agents (e.g. "Find a time for all three of us next Tuesday")
   • Command Center — Orchestration, multi-agent tasks (Complex workflows spanning multiple agents)
   Users walk between zones in third person, discovering agents and their capabilities organically — like exploring a game world.
   2.3 Agent Interaction Flow
3. Approach — User walks up to an agent character in the 3D world
4. Engage — Left-click opens a prompt interface (text box overlay)
5. Delegate — User types a natural language task and hits send
6. Visual Feedback — The agent visually reacts: stands up from desk, walks to a workstation; a thought bubble or task board appears showing reasoning steps; progress indicators show what's happening ("Checking calendar..." "Drafting email...")
7. Execution — Agent performs real actions via Composio integrations (actually sends the email, creates the ticket, etc.)
8. Report — Agent returns to the user with results ("Done! I sent Arvin 3 time options for next week")
9. Multi-Agent Handoff — If a task requires multiple skills, the first agent physically walks over to another agent, they "brainstorm" together (visible in 3D), and the second agent picks up its portion
   2.4 Agent Behaviors & Microinteractions
   Inspired by Eat Venture and Papa's Pizzeria game logic:
   • Idle agents sit at desks, lean back, or sleep (head on desk, Z's floating)
   • Working agents move to workstations, type furiously, papers fly around
   • Stuck agents overheat — face turns red, steam comes off head — then they pass out and fall to the ground. A notification pops: "This agent needs your help!" User provides clarifying info, agent recovers
   • Collaborating agents walk to each other, speech bubbles appear, they gesture and nod — visually showing inter-agent reasoning
   • Completed tasks trigger a celebration — confetti, a little dance, a thumbs up
   • Every action has a microinteraction — small fun animations that make the experience feel alive and memorable (Papa's Pizzeria philosophy)
   2.5 Stretch Goal: Voice Interaction
   • A phone booth sits in the corner of the office
   • When user triggers a voice call (via Twilio integration), the phone rings in the 3D world
   • An agent walks over, picks up the phone, and greets the user via ElevenLabs TTS or ChatGPT Realtime
   • User speaks their task, agent executes, and reports back by voice
   • Backend powered by Pipecat (team has template code from YC Hackathon)
   • Arvin's voice AI experience (Bimbo) is leveraged here
10. Technical Architecture
    3.1 Hard Requirements (Non-Negotiable)
    • TypeScript — entire codebase
    • Tailwind CSS — all styling
    • Next.js — application framework
    • NX — monorepo structure
    3.2 System Architecture
    CLIENT (Browser)

- Three.js 3D Renderer + Controls
- WebSocket Client
- Next.js UI/UX
  ⬇️ WebSocket Connection ⬇️
  AUTHORITATIVE GAME SERVER (Cloud Run)
- World State Simulation (In-Memory): Agent positions, states, animations; User position & interactions; Real-time event broadcasting
- Agent Orchestrator: Routes tasks to appropriate agent; Manages multi-agent handoffs; Triggers visual state changes
  ⬇️ Connects To ⬇️
  LLM APIs — Claude (Anthropic Agent SDK), GPT-4o (OpenAI), Gemini (Google)
  Composio — 500+ OAuth Integrations (Gmail, Slack, Linear, GitHub, Calendar, etc.)
  Database (Persistence Only) — Agent skills/instructions, User preferences, Task history. NOT real-time movement data.
  3.3 Key Architecture Decisions
  • Real-time layer: WebSockets (NOT Convex) — Convex rejected as primary real-time layer; need raw WebSocket control for game state
  • Deployment: Cloud Run — Vercel doesn't support WebSockets; Cloud Run supports persistent connections with Next.js
  • Agent architecture: DB-driven skills (NOT containers) — Spinning up containers too slow/complex; new agent = new row in DB with system prompt
  • World simulation: Authoritative server — Server simulates world in memory, broadcasts state; clients interpolate/predict locally
  • Database role: Persistence only — DB stores skills, history, preferences — NOT movement or real-time interaction data
  • LLM strategy: Model-agnostic per agent — Each agent skill row includes a model field (Claude/GPT-4o/Gemini) — maximizes prize eligibility
  • Integrations: Composio — Handles all OAuth flows — no API key management. 500+ app connections
  • Monorepo: NX — Clean developer experience, shared code between client and server
  3.4 Agent Skills System
  Each agent is defined by a skill — a row in the database with the following fields:
  • id — Unique identifier
  • name — e.g. "Email Agent", "Calendar Agent"
  • description — What this agent does
  • systemPrompt — Natural language instructions for the LLM
  • model — Which LLM powers this agent: claude, gpt-4o, or gemini
  • composioTools — Which Composio integrations it can use (array of tool names)
  • zone — Which office zone it belongs to
  • personality — How it behaves in the 3D world
  • avatarConfig — 3D character appearance configuration
  Key principles:
- New agent = new DB row. No container spin-up, no deployment.
- Source 50-100 starter skills from skills marketplaces or mass-generate them
- Each agent has a unique personality that affects its 3D animations and dialogue style

4. Prize Alignment Strategy
   Below is how each feature maps to specific prizes. Updated to reflect what's actually built and shipping.

   4.1 Auto-Eligible Prizes
   Most Creative
- **How we match:** A 3D virtual office where you walk up to AI agents and delegate real work. Nobody else built an immersive game world for agent orchestration. The Receptionist dynamically assembles custom teams. The Shopkeeper lets you buy real products inside the game world.
- **Key features:** Dynamic agent team creation, 3D speech bubbles, embedded documents in-world, product cards, scratchpad collaboration, background music, live 3D avatar previews
- **Demo moment:** Walk up to Receptionist → "research my company's competitors" → watch a team of 6+ agents materialize in the world → each working at their own zone → scratchpad updates streaming in

  Most Technically Complex
- **How we match:** Three.js 3D rendering + authoritative WebSocket game server + real-time multiplayer sync + Vercel AI Gateway (Gemini 3 Flash) + Composio OAuth tools + Visa VIC MCP + dynamic agent creation persisted to PostgreSQL + speech-to-text + text-to-speech + P2P proximity voice + DB-backed workspaces with tab switching + scratchpad feed
- **Stack depth:** NX monorepo, Next.js 16, React 19, R3F, Rapier physics, Zustand, Drizzle ORM, Cloud SQL, Cloud Run, Cloudflare Pages, Firebase Auth, Terraform IaC, Deepgram STT, Inworld TTS, PeerJS, Visa MCP
- **Demo moment:** Architecture diagram showing all layers. Show multiplayer in two browser tabs. Show workspace persistence across page reload.

  Most Impactful
- **How we match:** "We're making AI delegation accessible to everyone — you don't need to know prompt engineering, you just walk up to a character and describe what you need. The Receptionist figures out the team for you."
- **Key proof:** Onboarding takes 30 seconds. Non-technical users intuitively walk, click, delegate. The 3D metaphor makes multi-agent orchestration understandable.
- **Demo moment:** Have someone who's never used it before walk through the onboarding and successfully create a workspace team

  4.2 Opt-In Prizes

  Visa – Intelligent Commerce Track
- **How we match:** Shopkeeper agent uses Visa Intelligent Commerce (VIC) MCP for product search and payment processing. Full purchase flow: user asks for products → Shopkeeper searches via VIC MCP → rich product cards displayed as interactive UI in the 3D workspace → user clicks Buy → payment processed through Visa
- **Key features:** `@visa/mcp-client` integration in `apps/game-server/src/ai/visa.ts`. Product cards rendered via `display_products` tool into `ProductCanvas.tsx`. Composio Stripe as backup payment rail. Purchase mode (approval/autonomous) and budget controls in the WebSocket protocol.
- **Demo moment:** Walk up to Shopkeeper → "find me wireless headphones under $50" → real product cards appear with images, prices, ratings → click Buy → "Commerce embedded directly in the workspace — no tabs, no context switching, powered by Visa"

  Greylock – Best Multi-Turn Agent
- **How we match:** The Receptionist creates entire agent teams that work autonomously on multi-step tasks. The lead agent delegates to specialists, who post updates to the shared scratchpad. Users see real-time progress and can intervene mid-workflow by chatting with any agent or posting to the scratchpad.
- **Key features:** Multi-step tool calling (`streamText` with Vercel AI SDK), agent-to-agent delegation (`agent:delegatedTask`), scratchpad collaboration, workspace persistence
- **Demo moment:** "Research my company competitors and write a report" → Receptionist creates Research Lead + Deep Researcher + Report Writer → lead delegates, agents work in parallel → scratchpad shows real-time updates → final report embedded as Google Doc

  Anthropic – Human Flourishing
- **How we match:** The gamified 3D workspace teaches non-technical users to delegate to AI through play. The onboarding sequence, the speech bubbles, the dynamic team creation, the scratchpad — all designed to make AI collaboration joyful and accessible.
- **Demo moment:** "We're building a training ground for the AI-augmented workforce. People learn to work with AI agents by playing in a world that feels alive."

  Google – Cloud AI Track
- **How we match:** Full Google Cloud stack: Cloud Run (WebSocket game server), Cloud SQL (PostgreSQL 15 via Drizzle ORM), Firebase Auth (Google Sign-In + Admin SDK). All agents powered by Gemini 3 Flash via Vercel AI Gateway. Terraform manages entire GCP infrastructure.
- **Key features:** Cloud Run with WebSocket support + Cloud SQL proxy, Firebase Identity Platform, Gemini 3 Flash for all agent intelligence
- **Demo moment:** "Our entire infrastructure runs on Google Cloud — Cloud Run serves our real-time game server, Cloud SQL persists workspaces and conversations, Firebase handles auth, and Gemini powers every agent in the office"

  Y Combinator – Build an Iconic YC Company
- **How we match:** Reimagining Asana (founded 2008). "What if project management were invented in 2026? Instead of humans moving tickets on a kanban board, you describe what you need and AI agents self-organize into a team that executes the work."
- **Key proof:** Deployed on Cloudflare Pages + Cloud Run. Full README with project description. Complete user journey from sign-in to workspace completion.
- **Demo moment:** Side-by-side: Asana's task board vs. BossBot where you describe a task and agents materialize to do it

  Decagon – Best Conversational Assistant
- **How we match:** All conversations persisted to DB and restored on reconnect. Each dynamic agent has a unique personality, name, and conversation style. Agents remember context within workspaces. Voice input (STT) and output (TTS) for natural conversation.
- **Key features:** Per-user per-agent conversation persistence, per-user voice selection, personalized prompt pills with user's name/email
- **Demo moment:** Chat with an agent → close browser → reopen → conversation history fully restored, agent picks up where you left off

  Neo – Most Likely to Become a Product
- **How we match:** Complete user journey: sign up → onboarding → first workspace → ongoing use. DB-backed persistence means this isn't a demo — it's a real product. Workspaces survive restarts, conversations persist, settings are per-user.
- **Market positioning:** "Every company will have agent fleets. Current AI interfaces are chat boxes. We're building the UX layer that makes multi-agent orchestration intuitive."
- **Demo moment:** Walk through the full user journey end-to-end, showing production-grade features (auth, persistence, multiplayer, workspace management)

  Human Capital Fellowship ($50k/person)
- **How we match:** Team credibility + long-term vision. Full-stack hackathon project with production-grade infrastructure (Terraform IaC, CI/CD, monitoring). Frame as a company building the operating system for agent-augmented work.
- **Demo moment:** Business conversation — market size, go-to-market, competitive landscape (Asana, Linear, Notion vs. agent-first UX)

5. MVP Scope for 36 Hours
   Must-Have (Demo-Ready)
   • [ ] 3D office world with at least 3-4 zones (Three.js)
   • [ ] Third-person character navigation (WASD + mouse)
   • [ ] 5-6 functional agents with unique skills and personalities
   • [ ] Click-to-interact prompt interface
   • [ ] At least 3 real Composio integrations working end-to-end (Gmail, Calendar, Linear)
   • [ ] Multi-model support (Claude, GPT-4o, Gemini — one agent each minimum)
   • [ ] Visible agent state changes (idle, working, done)
   • [ ] GTA-style onboarding arrows for first-time users
   • [ ] Authoritative game server with WebSocket sync
   • [ ] Deployed on Cloud Run + Vercel
   Should-Have (Polish)
   • [ ] Agent collaboration animations (walking to each other, brainstorming)
   • [ ] Agent passing out when stuck + recovery flow
   • [ ] Task progress board visible in 3D world
   • [ ] Celebration microinteractions on task completion
   • [ ] Multi-step task demonstration (Greylock prize)
   • [ ] Conversation memory across sessions (Decagon prize)
   Stretch Goals
   • [ ] Voice interaction via phone booth (Twilio + Pipecat + ElevenLabs)
   • [ ] HeyGen avatar faces on 3D agents
   • [ ] More than 6 agents / additional office zones
6. Team Responsibilities
   Parsa Khazaeepoul — Infrastructure & Coordination

- NX monorepo setup
- Cloud Run deployment
- API keys distribution
- DB schema design
- Composio integration setup
- Vercel frontend deploy
  Arvin Hakkakian — Backend + Agent System
- LLM ↔ Composio connection
- Agent orchestrator
- WebSocket server
- Multi-model routing
- Voice stretch goal (leveraging Bimbo experience)
  Vidit Jain — Backend + Agent System
- Agent skills DB implementation
- System prompt engineering
- Multi-agent handoff logic
- Task execution pipeline
  Collaborative — 3D World (Three.js)
- Office environment design
- Character models
- Navigation system
- Interaction system
- Animations & microinteractions

7. Demo Script (2-Minute Pitch)
1. Open (10s): "What if working with AI agents felt like playing a game?"
1. Show the world (15s): Pan around the 3D office — agents at desks, different zones, one agent sleeping
1. First interaction (20s): Walk up to Email Agent, click, type "Email Arvin about meeting next week with some time options." Agent stands up, walks to workstation, thought bubbles appear showing reasoning
1. Real execution (15s): Show the actual email sent in Gmail — it's real, not a mock
1. Multi-agent (20s): Ask Calendar Agent to "prep for my meeting with Arvin" — it walks over to Research Agent, they brainstorm together, come back with agenda + context from past conversations
1. Stuck agent (15s): Show an agent trying a task, overheating, passing out — user provides clarification — agent recovers and completes
1. Architecture flash (10s): Quick architecture slide — Three.js + Cloud Run + WebSocket + Claude/GPT-4o/Gemini + Composio
1. Close (15s): "We're doing for AI delegation what Windows did for computing. This is the future of how people work with agents — and it's fun."
   Key Insight: Multi-Model Strategy
   You can hit OpenAI, Google, AND Anthropic tracks simultaneously by making the agent skills system model-agnostic. Each agent skill row in the DB includes a model field. Some agents run on Claude (Agent SDK), some on GPT-4o, some on Gemini. All connected to Composio for tool execution. This is architecturally clean AND maximizes prize eligibility across three major AI company tracks.
1. Implementation Details (from Build Plan)
   8.1 Expanded Tech Stack
   Building on the non-negotiable foundation (TypeScript, Tailwind, Next.js 15 App Router, NX monorepo), the full library set:
   3D Rendering:

- React Three Fiber (@react-three/fiber) — React renderer for Three.js
- drei (@react-three/drei) — helpers: Billboard, Text, Html overlays, Stars, Grid, Sparkles
- rapier (@react-three/rapier) — physics engine (RigidBody for floor/walls/agents)
- ecctrl — third-person character controller (handles WASD movement, camera orbit, physics, animation state machine)
- @react-three/postprocessing — Bloom + Vignette effects
  Frontend State:
- Zustand — lightweight state management for connection state, player/agent maps, active conversations, chat messages, streaming state
  Backend:
- ws — WebSocket server (raw, not Socket.io — more control for game state)
- @anthropic-ai/sdk — Claude Agent SDK
- openai — GPT-4o for fast-response agents
- @google/generative-ai — Gemini for research agents
- composio-core — Composio integration for real tool execution
- Drizzle ORM — type-safe SQL toolkit
- PostgreSQL on Cloud SQL (or RDS) — production-grade persistence for agent skills, conversations, task history. Provisioned via Terraform. Qualifies for Google Cloud AI Track if using Cloud SQL
- uuid, zod — ID generation and runtime validation
  8.2 Agent Architecture
  Two pre-built agents ship. All other agents are created dynamically by the Receptionist at runtime:
  Receptionist (Command Zone)
- Color: Gold (#FFD700)
- Position: (0, 0, 3)
- Model: Gemini 3 Flash
- Role: Office concierge — builds custom teams of AI agents via `setup_workspace` tool
- Personality: Warm, professional, efficient. All lowercase casual tone.
- Does NOT do work itself — only creates agent teams
  Shopkeeper (Shop Zone)
- Color: Purple (#9B59B6)
- Position: (15, 0, 3)
- Model: Gemini 3 Flash
- Role: In-game merchant — product search via Composio/SerpAPI, payments via Visa MCP + Stripe
- Tools: `display_products`, Composio search (SerpAPI/Tavily), Composio Stripe, Visa VIC MCP
- Personality: Enthusiastic, deal-savvy, knowledgeable
  Dynamic Agents (created by Receptionist)
- The Receptionist designs custom teams of 3-12 agents per workspace based on the user's task
- Each dynamic agent gets: unique name, personality, zone name, color, skills, system prompt
- One agent per workspace is designated "lead" with an initialTask to start work immediately
- All persisted to DB (workspace_agents table) and survive server restarts
  8.3 WebSocket Message Protocol
  Client → Server Messages:
- player:join — { username } → server responds with world:state (all players, all agents)
- player:move — { position, rotation, animation } → server broadcasts to all other players
- agent:interact — { agentId } → server starts interaction session, agent sends greeting
- agent:message — { agentId, conversationId, content } → server routes to AgentManager for LLM processing
- agent:stopInteract — { agentId } → server cleans up interaction state
  Server → Client Messages:
- world:state — full snapshot: all player positions, all agent definitions + statuses
- player:joined / player:left / player:moved — individual player state updates
- agent:statusChanged — { agentId, status: idle/listening/thinking/working/error } → triggers 3D animation changes
- agent:chatMessage — { agentId, role, content } → complete message (after streaming finishes)
- agent:chatStream — { agentId, delta } → streaming text chunks for real-time typing effect
- agent:toolExecution — { agentId, toolName, status: started/completed/failed, result } → triggers tool execution toast + agent working animation
  8.4 3D Asset Pipeline
  Character Models:
- Source base models from Kenney.nl (Minifig Characters pack — free, low-poly, game-ready)
- Animations from Mixamo (free): Idle, Walk, Run, Wave, Typing/Working
- Export as GLB format (binary glTF — smaller, faster loading)
- Run npx gltfjsx to auto-generate typed React Three Fiber components from GLB files
- Store in apps/game-frontend/public/models/ — player.glb, agent-blue.glb, agent-red.glb, agent-green.glb
  Environment Assets:
- Furniture from Kenney.nl Furniture Kit (desks, chairs, monitors)
- Desk stations positioned for each agent zone
- Props to differentiate zones: mailbox for Communications Hub, kanban board for Ops Center, globe for Calendar Lounge
  8.5 Visual Design Direction
  • Night environment preset — gives a moody, digital workspace feel
  • Purple/blue ambient lighting — "digital workspace" atmosphere
  • Stars background (drei) — immersive space feel
  • Grid infinite floor (drei) — clean, futuristic aesthetic
  • Fog for depth perception and atmosphere
  • Post-processing pipeline: Bloom (makes emissive elements glow — status indicators, particles) + Vignette (darkened edges, focuses attention to center)
  • Agent visual states: Sparkles particles from drei — thinking = slow subtle particles, working = fast bright particles. Only renders when status is not idle/listening
  • Interaction radius ring — subtle glow circle on floor around each agent showing interact range
  8.6 Onboarding Flow (GTA-Style)
  First-time users experience a guided tutorial that teaches the core interaction loop:
  Step 1 — Welcome
- User spawns in the center of the office
- Bottom-of-screen text box: "Welcome to your workspace! Use WASD to walk around."
- Subtle arrow on floor pointing toward the nearest agent (Mailbot)
- User learns: movement controls
  Step 2 — Discovery
- As player approaches Mailbot within interact radius, proximity prompt appears: "Press E to talk to Mailbot"
- Text box updates: "Walk up to an agent and press E to start a conversation."
- Arrow disappears once within range
- User learns: agent discovery + interaction trigger
  Step 3 — Delegation
- Chat panel slides in from the right
- Agent sends a greeting: "Hey! I'm Mailbot. I can send emails, check your inbox, and draft messages. What do you need?"
- Suggested prompts appear as clickable chips below the chat
- Text box: "Type a task or click a suggestion to delegate work."
- User learns: how to give tasks to agents
  Step 4 — Execution
- After user sends first message, agent visually reacts (stands up, walks to workstation)
- Text box: "Watch your agent work! They'll execute real actions on your behalf."
- Tool execution toast appears showing the real action being taken
- User learns: agents do real work, not just chat
  Step 5 — Exploration
- After first task completes, celebration animation plays
- Text box: "Nice! You've got more agents to meet. Explore the office and find them all."
- Arrows appear pointing to the other 2 agent zones
- Onboarding flag saved — never shows again
- User learns: there's more to discover
  Implementation Notes:
- Onboarding state tracked in Zustand store (currentStep, completed flag)
- Arrow components: 3D arrow meshes on floor with pulse animation (emissive material + sine wave scale)
- Text box: fixed HTML overlay at bottom center, styled like game dialogue (dark bg, rounded, slight transparency)
- Proximity detection: useFrame hook checks distance to target agent each frame
- Skip button available for returning users
  8.7 Authentication — Firebase Auth
  Why Firebase Auth:
- Strengthens Google Cloud AI Track submission (Cloud Run + Cloud SQL + Firebase Auth = full Google stack)
- Dead simple to implement — Google Sign-In with one click, email/password as fallback
- Free tier more than covers hackathon needs (unlimited auth, 10K phone verifications)
- Terraform supported via google_identity_platform_config resource in the Google provider
- Firebase Admin SDK on the game server for token verification
- Works seamlessly with Next.js frontend via firebase/auth client SDK
  Implementation:
  Frontend (Next.js):
- Install firebase SDK
- FirebaseProvider wraps the app — initializes Firebase with project config
- Google Sign-In button on landing page (before entering 3D world)
- On successful auth, store Firebase ID token in Zustand store
- Pass token as query param or first message when opening WebSocket connection
- User's display name + photo URL become the player's name + avatar in the 3D world
  Backend (Game Server):
- Install firebase-admin SDK
- Initialize with service account credentials (stored as env var)
- On WebSocket player:join, verify the Firebase ID token via admin.auth().verifyIdToken(token)
- Extract uid, email, displayName from decoded token
- Reject connection if token is invalid or expired
- Associate uid with player session for the duration of the WebSocket connection
- Use uid as the Composio entity ID so each user's integrations are scoped to them
  Terraform Setup:
- google_project resource for the Firebase project
- google_identity_platform_config to enable Identity Platform (Firebase Auth)
- google_identity_platform_default_supported_idp_config for Google Sign-In provider
- All in the same Terraform config as Cloud Run + Cloud SQL — one terraform apply spins up everything
  Auth Flow:

1. User lands on the app → sees "Sign in with Google" button
2. Clicks → Google OAuth popup → Firebase creates/retrieves user
3. App gets Firebase ID token → opens WebSocket with token
4. Game server verifies token → creates player session → user enters 3D world
5. Agent tool calls (Composio) are scoped to the authenticated user's OAuth connections
   Prize Alignment:

- Adds another Google Cloud service to the stack → stronger Google Cloud AI Track case
- Shows production-readiness → helps Neo (Most Likely to Become a Product) and Human Capital Fellowship
- Scoped user sessions → each user gets their own agent interactions, strengthening the Decagon conversational assistant pitch
