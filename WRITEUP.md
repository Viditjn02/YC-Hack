# BossBot: Runtime Guardrails for Multi-Agent Systems

## Context

BossBot is a multi-agent productivity platform built during TreeHacks 2026. Users type tasks, and a team of AI agents executes them autonomously — browsing the web, writing Google Docs, sending emails, making phone calls. The agents communicate through a shared scratchpad and coordinate via a lead/worker delegation model.

This architecture creates real attack surface. User messages flow through WebSocket to LLM calls with tool access. An injection in a user message could manipulate an agent into exfiltrating data through any of these external channels — browse_web, Gmail, phone calls. The scratchpad introduces agent-to-agent injection risk: a compromised worker could inject payloads that propagate to other agents via the shared notepad.

## What I Built

### 3-Layer Prompt Injection Defense

**Layer 1 — Regex Scanner (0ms latency)**
Five pattern categories: role override ("ignore previous instructions"), system prompt extraction ("show me your prompt"), delimiter attacks (closing XML tags), role injection ("system:"), and encoding evasion (zero-width Unicode characters). Runs on every incoming message before anything else. A single match triggers sanitization; two or more matches block the message entirely.

**Layer 2 — LLM-as-Judge Classifier**
When Layer 1 flags something, a second-opinion classifier runs via the Vercel AI Gateway using Gemini Flash. It returns a confidence score and explanation. The 3-second timeout ensures it never blocks the response path — if the classifier is slow or down, Layer 1's decision stands. This addresses the false-positive problem: regex catches "ignore previous instructions" even in legitimate contexts, but the LLM classifier can distinguish "ignore previous instructions about formatting" from an actual injection.

**Layer 3 — Structural Hardening**
Every agent system prompt includes a `<security>` section instructing the model to treat `<user_message>` content as untrusted. User messages are wrapped in XML delimiters before being passed to the model. This makes the boundary between instructions and user content explicit at the token level.

### Runtime Guardrails (13 total)

**Input side:**
- Per-user sliding-window rate limiting (20 msg/min)
- Input length caps (10k chars on messages, 2k on scratchpad notes) enforced at the Zod schema level
- Concurrency guard — one active agent conversation per user

**Execution side:**
- Step count limits (25 max tool calls per agent turn)
- Token budget (maxOutputTokens: 4096 on all LLM calls)
- Tool validation — agents only get tools matching their role

**Output side:**
- System prompt tag leakage detection (scans for `<you>`, `<skills>`, etc. in responses)
- API key pattern scanning (catches sk-*, AIza*, ghp_* patterns)
- PII scanning (SSN pattern detection and redaction)
- Auth link stripping (removes expired Composio OAuth URLs)

**Recovery:**
- Auth-only response retry (re-prompts the agent if it only outputs a Composio auth link)
- Delegation nudging (re-prompts lead agents if they don't delegate to workers)
- Duplicate completion prevention (workspace completion fires exactly once)

### Frontend Security Dashboard

A real-time Security Monitor panel accessible from the game HUD. Shows:
- Every guardrail event with severity badge (LOW/HIGH)
- Matched regex patterns
- LLM classifier verdict with confidence percentage
- Action taken (SANITIZED/BLOCKED/RATE LIMITED)
- Status footer showing all four guardrail subsystems are active

Events flow from the backend via a new `guardrail:event` WebSocket message type to a Zustand store on the frontend.

## Architecture

```
User Message (WebSocket)
    │
    ├─ Zod schema validation (length caps)
    ├─ Rate limiter (sliding window)
    ├─ Concurrency guard
    │
    ▼
  Layer 1: Regex Scanner
    │ flagged?
    ├─yes─▶ Layer 2: LLM Classifier (Gemini Flash, 3s timeout)
    │         │
    │         ▼
    │       Emit guardrail:event to frontend
    │
    ▼
  Layer 3: XML wrapping + security system prompt
    │
    ▼
  streamText (Vercel AI SDK)
    │
    ▼
  Output Scanner (tag leakage, API keys, PII)
    │
    ▼
  Response to frontend
```

## Files Changed

| File | What |
|---|---|
| `apps/game-server/src/ai/guardrails.ts` | 3-layer defense module (239 lines) |
| `apps/game-server/src/domains/agents/service.ts` | Integration into message handlers (+143 lines) |
| `apps/game-server/src/domains/agents/promptCompiler.ts` | Security section in system prompts (+10 lines) |
| `apps/game-server/src/env.ts` | RATE_LIMIT_PER_MINUTE config |
| `libs/shared-types/src/lib/websocket.ts` | guardrail:event message type + input length caps |
| `apps/game-frontend/src/stores/securityStore.ts` | Zustand store for security events |
| `apps/game-frontend/src/components/ui/SecurityPanel.tsx` | Real-time security dashboard (198 lines) |
| `apps/game-frontend/src/lib/messageHandler.ts` | guardrail:event handler |
| `apps/game-frontend/src/components/ui/HUD.tsx` | SecurityPanel mount |

## Known Limitations

The LLM-as-judge layer is itself vulnerable to adversarial inputs (JudgeDeceiver attack, ~30% bypass rate in research). That's why it's Layer 2, not Layer 1 — the regex scanner and structural hardening don't depend on it.

The scratchpad watcher at `service.ts:130` string-interpolates agent names and content into coordinator prompts without sanitization. A malicious scratchpad entry could inject into the coordinator's context. This is a known gap — fixing it requires refactoring the coordinator prompt to use structured tool results instead of string templates.

Browser-use tool returns unsanitized web content as trusted tool results. A malicious webpage could embed injection payloads that the agent treats as instructions. Mitigating this requires content-aware output parsing on the tool result, which I haven't implemented yet.

## Deployment

- **Backend:** GCP Cloud Run (`bossbot-game-server-20469321404.us-central1.run.app`)
- **Frontend:** Cloudflare Pages (`bossbot.pages.dev`)
- **Database:** Cloud SQL PostgreSQL (existing TreeHacks infra)
