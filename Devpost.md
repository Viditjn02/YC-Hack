# BossBot — Devpost Submission

> A multiplayer 3D virtual office where AI agents are your coworkers. Walk up, speak, and watch them send real emails, book meetings, search products, and process payments — all in a living game world. Built in 36 hours. 100M+ tokens burned.

---

## Inspiration

Using AI agents today feels like using a computer before GUIs existed. You type prompts into chat boxes, configure API keys, manage tools through dashboards. It's powerful, but it's the command line era of AI. It locks out most people and strips away any sense of collaboration or fun.

We asked ourselves: what if we built the graphical interface for AI agents? Not another chat wrapper. Not another dashboard. A living 3D world where you walk up to an AI character the way you'd walk up to a coworker and just tell it what you need. It figures out the team, assigns the work, and you watch it happen.

We drew inspiration from Astro Bot's CPU Plaza for spatial exploration as discovery, Papa's Pizzeria for microinteractions that make mundane tasks feel alive, and GTA's onboarding for progressive disclosure through gameplay. We wanted that same feeling, but for getting real work done with AI.

The result is something we honestly didn't think was possible in 36 hours: a full game engine, a multi-agent AI orchestration system, real-time voice pipelines, a commerce platform, multiplayer networking, and production cloud infrastructure — all working together in one cohesive experience.

## What it does

BossBot is a multiplayer 3D virtual office where AI agents are your coworkers. You navigate a third-person character through a physics-enabled world, walk up to agents at their desks, and delegate real tasks by typing or by holding a push-to-talk key and speaking naturally.

These agents don't just chat. They execute. They send actual emails through Gmail, create real tickets in Linear, book real meetings on Google Calendar, search real products across retailers, and process real payments through Visa.

The Receptionist is your office concierge. Describe any task — "research my company's competitors and write a report" — and it dynamically creates an entire team of specialized AI agents on the fly. A Research Lead, a Deep Researcher, a Report Writer, a Fact Checker — each with a unique name, personality, color, skill set, and zone in the office. The lead agent immediately starts delegating subtasks to workers. All agents post updates to a shared scratchpad feed. The entire team is persisted to a PostgreSQL database and survives server restarts. We didn't hardcode agents. The LLM decides how many agents to create (3-12), what skills they need, and who leads. Every workspace is different.

The Shopkeeper is an in-game merchant. Walk up and say "find me wireless headphones under $50." It searches real products via Visa Intelligent Commerce MCP, renders interactive product cards with real images, prices, and ratings, and you can click Buy to process a payment through Visa, all without leaving the 3D world.

Voice works both ways. Talk to agents using push-to-talk and your voice is transcribed in real-time by Deepgram Nova-3 via streaming WebSocket. Agents respond with synthesized voice from Inworld TTS played through HRTF spatial audio — their voice gets louder as you walk closer and pans left/right based on their 3D position. Players can also voice chat with each other using proximity-based P2P spatial audio over WebRTC. Hold T near another player and their voice fades in with distance, just like real life. Two completely independent spatial audio pipelines sharing a single AudioContext.

The office sits on procedurally generated terrain using simplex noise with Minecraft-style quantized heights, vertex-colored grass and earth, flowers and decorations, chunk-loaded around the player with LOD falloff. Walk far enough past the office walls and you'll discover a hidden Stanford campus model surrounding the building. 13 selectable avatar models with live 3D previews. A Roblox-style third-person camera with right-click orbit and scroll zoom. Background music with a track selector. A GTA-style onboarding tutorial. Bloom and vignette post-processing. It's a game.

## How we built it

This is not a simple stack. We built a real-time game engine, a multi-agent AI orchestration system, dual spatial voice pipelines, a commerce platform, and production cloud infrastructure — and wired them all together over WebSocket in 36 hours.

The 3D game engine runs on React Three Fiber with drei and Rapier physics inside a Next.js 16 app with React 19, TypeScript, and Tailwind v4. We built a Roblox-style third-person camera with physics-based character controls using ecctrl. There are 13 Kenney.nl character models with idle, walk, sprint, and jump animations. The terrain is procedurally generated in chunks using simplex noise with Minecraft-style quantized heights, vertex colors, two LOD levels, and small decorations like flowers and grass tufts. Agent visual states (idle, listening, thinking, working, done, error) are driven by 14 Zustand stores synchronized with the server over WebSocket. HTML speech bubbles are positioned in 3D space above agents. Bloom and vignette post-processing make status orbs and neon strips glow. We used shadcn/ui for chat panels, product cards, scratchpad feed, and workspace management. The WebSocket protocol has 46 distinct message types, all fully typed with Zod validation on both ends.

The backend is a Node.js WebSocket game server with a domain-driven architecture spanning 7 modules: agents, conversations, players, scratchpad, skills, users, and workspaces. The Receptionist agent dynamically creates 3-12 specialized agents per workspace using a setup_workspace tool — the LLM decides the team composition, skill definitions, and leadership structure. Each agent gets a compiled system prompt, its own conversation history, access to Composio OAuth tools scoped per-user, and the ability to create new skills for itself at runtime. AI calls use the Vercel AI SDK with streamText and multi-step tool calling (up to 25 steps per turn) routed through Vercel AI Gateway, a unified proxy that lets us swap between Gemini, Claude, and GPT-4o per agent with a single API key. Real-world actions like Gmail, Calendar, Linear, Stripe, and SerpAPI flow through Composio OAuth integrations giving each user scoped access to their own accounts. The lead agent delegates tasks to workers via delegate_task, workers post to a shared scratchpad, and when the lead calls finish_task the Receptionist compiles a final summary from all agent outputs. We also built MCP (Model Context Protocol) support so the Shopkeeper connects to Visa's Intelligent Commerce MCP server for product search and payment processing. Any external tool server can be plugged in.

For voice, we built two independent spatial audio pipelines. Pipeline one handles agent voice: the client records mic audio and streams it over WebSocket to Deepgram Nova-3 for real-time transcription. The transcript goes to the server as an agent message. The server generates a voice response via Inworld TTS API and sends base64 MP3 back over WebSocket. The client decodes it and plays it through an HRTF PannerNode positioned at the agent's 3D coordinates, so the voice literally comes from where the agent is standing. Pipeline two handles player-to-player proximity voice over WebRTC: PeerJS establishes P2P audio connections between nearby players, and each remote player's MediaStream is routed through its own HRTF PannerNode positioned at their real-time 3D location, so voice fades naturally with distance using an inverse rolloff model and pans spatially. Both pipelines share a single AudioContext singleton to avoid browser limitations.

The Shopkeeper connects to Visa's Intelligent Commerce (VIC) MCP server for product search and discovery. Products are rendered as interactive cards with real images, prices, ratings, and retailer info via a custom display_products tool. The purchase flow is: user clicks Buy, payment processed through Visa VIC with Composio Stripe as a backup payment rail. Full purchase mode controls including approval vs autonomous mode and budget limits are built into the WebSocket protocol.

Everything is deployed and hosted on real infrastructure — this isn't localhost. Terraform manages the entire stack as infrastructure-as-code: Google Cloud Run for the WebSocket game server with Cloud SQL proxy sidecar and 3600-second connection timeout, Google Cloud SQL with PostgreSQL 15 and 7 tables via Drizzle ORM, Cloudflare Pages for the static-exported Next.js frontend with Terraform-managed environment variables, Firebase Auth with Google Sign-In and Admin SDK token verification, and Vercel AI Gateway as the unified LLM proxy. The build pipeline is gcloud builds submit to Cloud Build, which produces an amd64 Docker image pushed to Artifact Registry and deployed to Cloud Run. One terraform apply provisions everything.

## Challenges we ran into

The unholy trinity of game dev, agentic AI, and real-time voice. Any one of these is a significant project on its own. We built all three and wired them together over WebSocket in 36 hours.

Getting the 3D interaction loop to feel right was brutal. Tuning click detection, camera angles, and chat panel overlays to not fight with physics-based 3D controls took dozens of iterations. The camera system alone went through three rewrites.

WebSocket state synchronization between the game server and multiple clients required careful architecture. 46 message types, typed with Zod, validated on both ends. Agent status changes, workspace snapshots, scratchpad entries, product cards, voice state, player positions — all flowing through a single multiplexed connection with 30-second keepalive pings to survive Cloud Run's idle timeout.

Dynamic agent creation was architecturally wild. The Receptionist LLM calls a tool that creates 3-12 new agents, each with system prompts, skills, positions, and colors, persists them all to PostgreSQL, registers them in memory, broadcasts a workspace:build message to the frontend which animates them materializing in the 3D world, and the lead agent immediately starts streaming its first response. Getting that entire pipeline reliable and race-condition-free under real-time streaming was hard.

Running dual spatial audio pipelines that share a single AudioContext without interfering with each other was tricky. Agent TTS decodes base64 MP3 into AudioBuffers routed through HRTF panners. Player voice uses MediaStream sources through separate HRTF panners. Both update panner positions every frame from the 3D render loop. Getting this to work across browsers without clicks, pops, or audio context suspensions was painful.

Composio OAuth flows for multiple services (Gmail, Calendar, Linear, Stripe, SerpAPI) had to be set up and scoped per-user per-service. Each user's Firebase UID is the Composio entity key, so agent tool calls are isolated to that user's connected accounts.

Deploying to Cloud Run with WebSockets required careful Terraform configuration: HTTP/1.1 (not gRPC), 3600-second timeout, Cloud SQL proxy as a sidecar volume mount, TCP startup probes. Docker builds had to target linux/amd64 via Cloud Build because our dev machines are ARM.

And honestly, scoping a 36-hour vision down to what we could actually ship was the hardest challenge. We had to ruthlessly prioritize the demo-critical path while keeping the architecture clean enough that everything we added actually worked together.

## Accomplishments that we're proud of

The magic moment: you walk up to the Receptionist, hold T, and say "research my competitors and write a report." The Receptionist thinks for two seconds, then six agents materialize in the world, each at their own desk, each with a unique name and personality. The lead agent starts delegating. Workers start posting to the scratchpad feed. You can walk up to any of them and chat. Ten minutes later, the lead compiles everything and the Receptionist delivers a summary. The whole thing assembled itself from a single sentence.

It's not a mock. Real emails get sent. Real calendar events get created. Real Linear tickets get filed. Real products show up from real retailers. Real payments process through Visa. We burned through over 100 million tokens of our own money testing this.

The commerce integration actually works. Walk up to the Shopkeeper, ask for headphones, and real product cards render with real images, real prices, real ratings. Click Buy and a payment goes through Visa Intelligent Commerce. Shopping inside a game world.

Two independent spatial audio pipelines running simultaneously. Agent TTS comes from the agent's 3D position. Player voice chat fades with distance. Both use HRTF for realistic directionality. Both share one AudioContext. It sounds like you're actually in a room with people and AI characters.

179 commits in 36 hours. Over 6,000 lines of TypeScript across 180 files. 7 database tables. 46 WebSocket message types. 14 Zustand stores. 7 server domain modules. 13 avatar models. Procedurally generated infinite terrain. Full Terraform infrastructure-as-code. Production deployment on Cloud Run and Cloudflare Pages. We shipped a product, not a prototype.

## What we learned

The interface layer for AI agents matters as much as the models themselves. A frontier model behind a chat box still feels like a chat box. Put that same model behind a character that walks, glows, speaks, and assembles a team, and suddenly delegation feels natural. The metaphor is the product.

Dynamic agent creation is the right abstraction. We started with three hardcoded agents (Mailbot, Taskmaster, Clockwork). Then we realized: why limit it? Let the LLM decide what team to build. That single architectural pivot from static to dynamic agents was the best decision we made. Every workspace is unique.

Real-time systems multiply complexity exponentially. Game rendering, WebSocket sync, AI streaming, voice transcription, TTS playback, spatial audio, multiplayer networking — each works fine in isolation. Wiring them together so they don't race, glitch, or drop state required constant architectural discipline. Domain-driven design on the server and Zustand stores on the client were essential for keeping our sanity.

Terraform saves hackathons. Provisioning Cloud Run, Cloud SQL, Firebase Auth, Cloudflare Pages, and all environment variables with a single terraform apply meant we could redeploy confidently at 4am. No clicking through dashboards. No "it works on my machine."

We also learned a ton about WebRTC peer-to-peer audio, HRTF spatial panning, chunk-based terrain generation, Vercel AI SDK multi-step tool calling, Composio OAuth scoping, Visa MCP integration, and how to wire up multi-model LLM systems with live tool integrations under extreme time pressure.

## What's next for BossBot

Smarter model routing. All agents currently use Gemini 3 Flash. We want automatic model selection that routes research tasks to Claude, fast lookups to GPT-4o, and creative work to the best model for the job. The Vercel AI Gateway already supports this; we just need the routing logic.

Deeper agent collaboration. Agents already delegate tasks and post to shared scratchpads. Next we want agents physically walking to each other in 3D to brainstorm, shared whiteboards rendered as 3D objects, and real-time pair-working animations.

A skill marketplace. Agents can already create reusable skills for themselves. We want a marketplace where skills are shared across workspaces, creating a network effect where every workspace makes every future workspace smarter.

More commerce. The Visa MCP integration opens the door to full in-world shopping experiences — wishlists, price tracking, recurring purchases, team procurement.

More integrations. With MCP support built in and Composio already providing Gmail, Calendar, Linear, Stripe, and SerpAPI, we want to connect to every tool ecosystem out there. Slack, Notion, GitHub, Figma, Jira.

Long term, we believe every company will have fleets of AI agents. Current interfaces are chat boxes and dashboards. BossBot is the operating system for working with them — and it's fun.

## Built With

Next.js 16, React 19, TypeScript, Tailwind CSS v4, Three.js (React Three Fiber), Rapier (physics), Zustand, shadcn/ui, Node.js, WebSocket (ws), Vercel AI SDK, Vercel AI Gateway, Gemini 3 Flash, Composio, MCP (Model Context Protocol), Visa Intelligent Commerce MCP, Drizzle ORM, PostgreSQL, Firebase Authentication, Deepgram (Nova-3 STT), Inworld (TTS), PeerJS (WebRTC), Google Cloud Run, Google Cloud SQL, Cloudflare Pages, Terraform, NX Monorepo, Docker
