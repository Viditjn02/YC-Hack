# Hybrid 3D Todo Board — Html transform MissionControlSky

## Goal

Replace the current 2D fixed-position `TodoPanel` overlay with a hybrid 3D board that renders pixel-perfect DOM content inside the R3F scene using `<Html transform>` from `@react-three/drei`. The board floats at z=-30 in 3D space (same position as the old MissionControlSky) but uses DOM rendering for perfect text readability.

## Why

- User prefers the in-world 3D feel of the old MissionControlSky floating board
- Old pure-3D `<Text>` rendering was blurry, had badge misalignment, and jittery bobbing
- `<Html transform>` gives pixel-perfect DOM typography while keeping the board positioned in 3D space
- Pattern already proven in the codebase: `EmbedScreen.tsx` and `SpeechBubble.tsx`

## What

A floating glassmorphic panel at position `[0, 10, -30]` in the 3D scene that shows agent status, task progress, and message previews. Uses `<Html transform>` to render DOM content inside the R3F canvas. No bobbing animation. Collapsible via chevron button.

### Design Decisions

- **No bobbing animation** — the old sine-wave bob caused text jitter; the board is static in position
- **`distanceFactor={8}`** — starting value, may need tuning for readability at z=-30 distance
- **`pointerEvents: 'auto'`** on the `<Html>` wrapper (same as EmbedScreen pattern) — needed so the collapse button is clickable. Agent rows have no hover states or click handlers (purely informational).
- **`zIndexRange={[1, 10]}`** on the `<Html>` component to layer below DOM overlays (ChatPanel z-50, HUD) but above the 3D scene
- **Board does not cast or receive shadows** — Html-rendered DOM content doesn't interact with Three.js lighting/shadows
- **Same glassmorphic styling** as the existing 2D TodoPanel we built
- **Same data logic** — store selectors, agent merging, message previews all stay identical
- **Width: 400px** — deliberately wider than TodoPanel's 320px for better readability at distance

### Success Criteria

- [ ] MissionControlSky.tsx created in `components/game/` using `<Html transform>`
- [ ] Board renders at position `[0, 10, -30]` in the 3D scene (same as old MissionControlSky)
- [ ] Text is pixel-perfect (DOM rendering, not 3D `<Text>`)
- [ ] No bobbing/jitter animation
- [ ] Collapse toggle button works (pointer events enabled on it)
- [ ] TodoPanel removed from Game.tsx DOM overlay list
- [ ] Old `components/ui/TodoPanel.tsx` file deleted
- [ ] MissionControlSky added back to Scene.tsx
- [ ] Shows all static + dynamic agents with real-time status
- [ ] `npm run lint` passes
- [ ] `npm run build` passes (or `npx nx build game-frontend`)

## All Needed Context

### Documentation & References

```yaml
- file: apps/game-frontend/src/components/game/EmbedScreen.tsx
  why: Primary pattern to follow — uses <Html transform distanceFactor={6}> to render interactive DOM content in 3D space. Shows pointer-events handling, group positioning, and Html props.

- file: apps/game-frontend/src/components/game/SpeechBubble.tsx
  why: Non-interactive Html pattern — uses <Html center distanceFactor={8}> with pointerEvents none. Shows the distanceFactor we should use.

- file: apps/game-frontend/src/components/ui/TodoPanel.tsx
  why: The 2D overlay we just built — port ALL the inner content (AgentRow, header, collapse, store selectors, agent merging) into the new 3D wrapper. This file gets deleted after porting.

- file: apps/game-frontend/src/components/game/Scene.tsx
  why: Add MissionControlSky import + render here (between Terrain and StanfordCampus Suspense)

- file: apps/game-frontend/src/components/game/Game.tsx
  why: Remove TodoPanel import + render from the DOM overlay list

- file: apps/game-frontend/src/data/agents.ts
  why: statusColors, statusLabels, toDynamicAgentData — used by the component

- file: apps/game-frontend/src/stores/workspaceStore.ts
  why: phase, taskSummary, dynamicAgents, builtAgentIds

- file: apps/game-frontend/src/stores/chatStore.ts
  why: chatMessages, streamingText — for message previews
```

### Current Codebase Tree

```bash
apps/game-frontend/src/components/
├── game/
│   ├── Game.tsx              # Renders <TodoPanel /> in DOM overlay list
│   ├── Scene.tsx             # No MissionControlSky currently
│   ├── EmbedScreen.tsx       # Html transform pattern reference
│   └── SpeechBubble.tsx      # Html center pattern reference
└── ui/
    ├── TodoPanel.tsx          # 2D fixed overlay — TO BE DELETED (content moves to MissionControlSky)
    ├── ScratchpadFeed.tsx     # Unchanged
    └── ...
```

### Desired Codebase Tree

```bash
apps/game-frontend/src/components/
├── game/
│   ├── Game.tsx              # MODIFIED — remove TodoPanel import + render
│   ├── Scene.tsx             # MODIFIED — add MissionControlSky import + render
│   ├── MissionControlSky.tsx # NEW — hybrid 3D board with Html transform
│   ├── EmbedScreen.tsx       # Unchanged
│   └── SpeechBubble.tsx      # Unchanged
└── ui/
    ├── (TodoPanel.tsx DELETED)
    ├── ScratchpadFeed.tsx     # Unchanged
    └── ...
```

### Known Gotchas

- All frontend components need `'use client'` directive
- Zustand store selectors: use individual `(s) => s.field` selectors, not destructuring
- `<Html transform>` renders DOM inside the R3F canvas — it needs to be inside a `<group>` positioned in 3D space
- `<Html>` with `transform` prop makes the element behave like a 3D object (parallax with camera)
- `distanceFactor` controls how the DOM content scales relative to camera distance — `8` is a starting value (may need tuning)
- The `center` prop on `<Html>` centers the DOM content at the group's position
- `style={{ pointerEvents: 'auto' }}` on `<Html>` (same as EmbedScreen) — needed so the collapse button is clickable. Child `pointerEvents: 'none'` on inner elements would NOT work if the parent Html has `pointerEvents: 'none'`
- `zIndexRange={[1, 10]}` on the `<Html>` component ensures it layers below DOM overlays but above the 3D scene
- `statusColors[status] + '20'` appends hex opacity for badge backgrounds — works because statusColors are 6-char hex strings
- The component must NOT be wrapped in `<Suspense>` — `<Html>` doesn't need it (it's not a lazy-loaded 3D asset)
- `toDynamicAgentData()` converts `DynamicAgent` to the agent display format — use it for dynamic agents
- The panel width should be set via inline style `width: '400px'` (not Tailwind `w-80`) since it's inside Html transform where Tailwind responsive utilities don't apply the same way

## Implementation Blueprint

### Data Model

No new data models needed. Same store selectors as TodoPanel:

```typescript
const agents = useWorldStore((s) => s.agents);
const phase = useWorkspaceStore((s) => s.phase);
const taskSummary = useWorkspaceStore((s) => s.taskSummary);
const dynamicAgents = useWorkspaceStore((s) => s.dynamicAgents);
const builtAgentIds = useWorkspaceStore((s) => s.builtAgentIds);
const chatMessages = useChatStore((s) => s.chatMessages);
const streamingText = useChatStore((s) => s.streamingText);
```

### Tasks (in implementation order)

```yaml
Task 1:
CREATE apps/game-frontend/src/components/game/MissionControlSky.tsx:
  - 'use client' directive
  - Import Html from '@react-three/drei'
  - Port EVERYTHING from TodoPanel.tsx (helpers, constants, AgentRow, store selectors, agent merging logic)
  - Replace the outer fixed-position wrapper with:
    <group position={[0, 10, -30]}>
      <Html transform center distanceFactor={8} zIndexRange={[1, 10]}
            className="pointer-events-auto" style={{ pointerEvents: 'auto' }}>
        <div style={{ width: '400px' }} className="bg-black/50 backdrop-blur-md rounded-xl border border-white/10 overflow-hidden">
          {/* Same header, summary, divider, agent rows as TodoPanel */}
        </div>
      </Html>
    </group>
  - pointerEvents 'auto' on Html (same as EmbedScreen) — collapse button is clickable, rows are non-interactive
  - NO bobbing animation (no useFrame, no useRef for group)
  - Export as MissionControlSky (not TodoPanel)
  - Visibility: return null when phase === 'reception' && dynamicAgents.length === 0

Task 2:
MODIFY apps/game-frontend/src/components/game/Scene.tsx:
  - ADD import: import { MissionControlSky } from './MissionControlSky';
  - ADD render between <Terrain /> and the Stanford campus Suspense (NO Suspense wrapper — Html doesn't need lazy loading):
    <Terrain />
    <MissionControlSky />
    {/* Easter egg: Stanford campus... */}

Task 3:
MODIFY apps/game-frontend/src/components/game/Game.tsx:
  - REMOVE import: import { TodoPanel } from '../ui/TodoPanel';
  - REMOVE JSX: <TodoPanel />

Task 4:
DELETE apps/game-frontend/src/components/ui/TodoPanel.tsx
```

### MissionControlSky Component Structure

```tsx
// Pseudocode — key structural decisions only

export function MissionControlSky() {
  const [collapsed, setCollapsed] = useState(false);
  // ... same store selectors as TodoPanel ...
  // ... same allAgents useMemo ...

  if (phase === 'reception' && dynamicAgents.length === 0) return null;

  return (
    <group position={[0, 10, -30]}>
      <Html transform center distanceFactor={8} zIndexRange={[1, 10]}
            className="pointer-events-auto" style={{ pointerEvents: 'auto' }}>
        <div style={{ width: '400px' }} className="bg-black/50 backdrop-blur-md rounded-xl border border-white/10 overflow-hidden">
          {/* Header with collapse button */}
          {/* Task summary (when not collapsed) */}
          {/* Divider (when not collapsed) */}
          {/* Agent rows or building placeholder (when not collapsed) */}
        </div>
      </Html>
    </group>
  );
}
```

### Integration Points

```yaml
STORES:
  - Read-only access to worldStore, workspaceStore, chatStore
  - No new store actions needed

3D SCENE:
  - Position: [0, 10, -30] — same as old MissionControlSky
  - Rendered in Scene.tsx between Terrain and StanfordCampus
  - Outside Physics (purely visual, no collision)

REMOVED:
  - TodoPanel.tsx (entire file — content moved to MissionControlSky)
  - TodoPanel import + render in Game.tsx
```

## Validation Loop

```bash
# Run after implementation
npx nx lint game-frontend     # ESLint
npx nx build game-frontend    # TypeScript + Next.js build
```

## Deprecated Code to Remove

| File | What to Remove | Why |
|------|---------------|-----|
| `apps/game-frontend/src/components/ui/TodoPanel.tsx` | **Entire file** | Content moved to MissionControlSky |
| `apps/game-frontend/src/components/game/Game.tsx` | `import { TodoPanel }` + `<TodoPanel />` | No longer a DOM overlay |

## Confidence Score: 9/10

High confidence because:
- `<Html transform>` pattern is proven in the codebase (EmbedScreen, SpeechBubble)
- All DOM content is already built and working in TodoPanel.tsx — just moving it
- Simple structural change: wrap existing DOM content in a 3D group + Html
- No new dependencies or complex integrations
- Clear removal path for the old component

Minor risk: `distanceFactor` value might need tweaking for optimal readability at z=-30, but easy to adjust.
