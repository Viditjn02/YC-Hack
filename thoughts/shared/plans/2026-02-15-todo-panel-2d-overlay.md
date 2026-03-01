# Replace 3D MissionControlSky with 2D Glassmorphic Todo Panel

## Goal

Replace the 3D floating `MissionControlSky` board (rendered inside the R3F Canvas at z=-30) with a polished 2D HTML overlay panel that shows agent status, task progress, and message previews. The new component renders as a DOM element in `Game.tsx`, not inside the 3D scene.

## Why

- 3D text (`@react-three/drei` `<Text>`) renders at low fidelity — blurry at distance, no subpixel antialiasing
- Status badge positioning uses `name.length * 0.28` character-width estimation — causes misalignment
- Fixed board height (`PH = 16`) doesn't adapt to agent count — rows overflow off the bottom
- The bobbing animation makes text jitter and feel glitchy
- DOM rendering gives pixel-perfect typography, CSS animations, and proper scrolling for free

## What

A fixed-position glassmorphic panel in the **top-left** area of the screen (below the HUD) that shows:
- Header with "Todo List" title + phase badge (Lobby/Building/Ready) + active count
- Task summary line below header (subtle, muted text)
- Scrollable list of agent rows with: status indicator, agent name, status badge, message preview
- Collapsible via a small chevron button (collapses to header-only)
- Smooth CSS transitions for status changes
- "Building workspace..." placeholder when workspace is building but no agents are built yet

### Design Decisions

- **Rows are NOT clickable** — purely informational display
- **Checkmark only for `done` status** — idle agents show a neutral green dot, not a checkmark
- **Task summary included** — shown as a subtle muted line below the header
- **Building placeholder** — show "Building workspace..." text during building phase when no agents are built yet

### Success Criteria

- [ ] MissionControlSky removed from Scene.tsx and its file deleted
- [ ] New `TodoPanel` component renders in Game.tsx as a DOM overlay
- [ ] Shows all static + dynamic (built) agents with real-time status
- [ ] Shows "Building workspace..." placeholder during early build phase
- [ ] Matches existing codebase glass styling patterns
- [ ] Collapsible to header-only (rows hidden, header stays visible)
- [ ] No layout conflicts with existing overlays (HUD, ScratchpadFeed, ChatPanel, etc.)
- [ ] `npm run lint` passes
- [ ] `npm run build` passes (or at minimum `npx nx build game-frontend`)

## All Needed Context

### Documentation & References

```yaml
- file: apps/game-frontend/src/components/game/MissionControlSky.tsx
  why: Current 3D implementation to replace — port the data logic (agent merging, message previews, status icons)

- file: apps/game-frontend/src/components/ui/ScratchpadFeed.tsx
  why: Best pattern to follow — same positioning style, glass styling, scrollable content, pointer-events pattern, custom scrollbar styling

- file: apps/game-frontend/src/components/ui/MissionControl.tsx
  why: Existing 2D agent badges — inline SVG patterns for checkmark (lines 37-39) and chevron (lines 73-78)

- file: apps/game-frontend/src/components/game/Scene.tsx
  why: Remove MissionControlSky import (line 15) + rendering (lines 81-83)

- file: apps/game-frontend/src/components/game/Game.tsx
  why: Add new TodoPanel component to the DOM overlay list

- file: apps/game-frontend/src/data/agents.ts
  why: statusColors, statusLabels, toDynamicAgentData — reuse these

- file: apps/game-frontend/src/stores/worldStore.ts
  why: agents array (static agents from server)

- file: apps/game-frontend/src/stores/workspaceStore.ts
  why: phase, taskSummary, dynamicAgents, builtAgentIds

- file: apps/game-frontend/src/stores/chatStore.ts
  why: chatMessages, streamingText — for message previews
```

### Current Codebase Tree

```bash
apps/game-frontend/src/components/
├── game/
│   ├── Game.tsx              # Canvas root + DOM overlays
│   ├── Scene.tsx             # 3D scene — currently renders MissionControlSky
│   └── MissionControlSky.tsx # 3D floating board — TO BE DELETED
└── ui/
    ├── MissionControl.tsx    # 2D agent badges at top center
    ├── ScratchpadFeed.tsx    # 2D team feed at bottom-left
    ├── ChatPanel.tsx         # Slide-in chat panel from right
    ├── HUD.tsx               # Top bar HUD
    └── ...
```

### Desired Codebase Tree

```bash
apps/game-frontend/src/components/
├── game/
│   ├── Game.tsx              # MODIFIED — add <TodoPanel /> import + render
│   ├── Scene.tsx             # MODIFIED — remove MissionControlSky import + render
│   └── (MissionControlSky.tsx DELETED)
└── ui/
    ├── TodoPanel.tsx         # NEW — 2D glassmorphic todo list overlay
    ├── MissionControl.tsx    # Unchanged
    ├── ScratchpadFeed.tsx    # Unchanged
    └── ...
```

### Known Gotchas

- All frontend components need `'use client'` directive
- Zustand store selectors: use individual `(s) => s.field` selectors, not destructuring, to avoid unnecessary re-renders
- `pointer-events-none` on outer wrapper, `pointer-events-auto` on inner panel — matches ScratchpadFeed pattern
- Phase `'reception'` with no dynamic agents should hide the panel entirely
- During `'building'` phase with zero built agents, show a placeholder instead of hiding (prevents flicker)
- `toDynamicAgentData()` converts `DynamicAgent` to the agent display format — use it for dynamic agents
- Use inline SVGs for checkmark and chevron icons (same pattern as MissionControl.tsx lines 37-39, 73-78)
- Custom scrollbar styling must match ScratchpadFeed: `[&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/20 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-white/30`
- `statusColors[status] + '20'` appends hex opacity for badge backgrounds — this works because statusColors are 6-char hex strings

## Implementation Blueprint

### Data Model

No new data models needed. The component reads from existing stores:

```typescript
// From worldStore
const agents = useWorldStore((s) => s.agents);
// → { id, name, color, zone, status }[]

// From workspaceStore
const phase = useWorkspaceStore((s) => s.phase);
const taskSummary = useWorkspaceStore((s) => s.taskSummary);
const dynamicAgents = useWorkspaceStore((s) => s.dynamicAgents);
const builtAgentIds = useWorkspaceStore((s) => s.builtAgentIds);

// From chatStore
const chatMessages = useChatStore((s) => s.chatMessages);
const streamingText = useChatStore((s) => s.streamingText);
```

Agent merging logic (port from MissionControlSky lines 220-237):
```typescript
const allAgents = useMemo(() => {
  const seen = new Set<string>();
  const result: { id: string; name: string; color: string; zone: string; status: AgentStatus }[] = [];
  for (const a of agents) {
    if (!seen.has(a.id)) { seen.add(a.id); result.push({ id: a.id, name: a.name, color: a.color, zone: a.zone, status: a.status }); }
  }
  for (const a of dynamicAgents) {
    if (builtAgentIds.has(a.agentId) && !seen.has(a.agentId)) {
      seen.add(a.agentId);
      const data = toDynamicAgentData(a);
      result.push({ id: data.id, name: data.name, color: data.color, zone: data.zone, status: data.status });
    }
  }
  return result;
}, [agents, dynamicAgents, builtAgentIds]);
```

Phase constants (port from MissionControlSky lines 194-203):
```typescript
const phaseLabels: Record<WorkspacePhase, string> = {
  reception: 'Lobby',
  building: 'Building...',
  ready: 'Ready',
};
const phaseColors: Record<WorkspacePhase, string> = {
  reception: '#64748b',
  building: '#f59e0b',
  ready: '#22c55e',
};
```

### Tasks (in implementation order)

```yaml
Task 1:
CREATE apps/game-frontend/src/components/ui/TodoPanel.tsx:
  - 'use client' directive
  - Import stores: useWorldStore, useWorkspaceStore, useChatStore
  - Import helpers: statusColors, statusLabels, toDynamicAgentData from @/data/agents
  - Import types: AgentStatus from @bossroom/shared-types, WorkspacePhase from @/stores/workspaceStore
  - Port getLastMessagePreview helper from MissionControlSky (lines 40-56)
  - Port agent merging logic (allAgents useMemo)
  - Port phase label/color constants
  - AgentRow sub-component (NOT clickable, purely informational)
  - Collapsible state via useState (collapsed hides rows, header stays)
  - Visibility logic:
    - Return null when phase === 'reception' && dynamicAgents.length === 0
    - Show "Building workspace..." placeholder when phase === 'building' && allAgents.length === 0
    - Show agent rows when allAgents.length > 0
  - Inline SVGs for checkmark (done status only) and chevron (collapse toggle)
  - Custom scrollbar styling matching ScratchpadFeed

Task 2:
MODIFY apps/game-frontend/src/components/game/Game.tsx:
  - ADD import: import { TodoPanel } from '../ui/TodoPanel';
  - ADD <TodoPanel /> after <ScratchpadFeed /> in the JSX

Task 3:
MODIFY apps/game-frontend/src/components/game/Scene.tsx:
  - REMOVE import: import { MissionControlSky } from './MissionControlSky';
  - REMOVE JSX: <Suspense fallback={null}><MissionControlSky /></Suspense>

Task 4:
DELETE apps/game-frontend/src/components/game/MissionControlSky.tsx
```

### TodoPanel Component Design

**Positioning**: `fixed top-20 left-4 z-40` — safely below HUD (which may expand with agent roster), same left margin as ScratchpadFeed.

**Structure**:
```
┌─────────────────────────────────┐
│ Todo List          Ready  3/5 ▾ │  ← Header (always visible, even when collapsed)
│ Build a website prototype...    │  ← Task summary (muted, below header)
├─────────────────────────────────┤
│ ● Agent Name       Working...  │  ← Agent row (status dot + name + badge)
│   Last message preview text... │  ← Message preview (truncated, muted)
├╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┤
│ ✓ Agent Name       Done        │  ← Done agent (checkmark icon)
│   Completed the analysis...    │
├╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┤
│ ● Agent Name       Thinking... │
│   Processing request...        │
└─────────────────────────────────┘
```

**Styling** (follow ScratchpadFeed pattern):
```
Outer:    fixed top-20 left-4 w-80 z-40 pointer-events-none
Panel:    pointer-events-auto bg-black/50 backdrop-blur-md rounded-xl border border-white/10
Header:   px-3 py-2 flex items-center justify-between
Summary:  px-3 pb-2 text-[11px] text-white/35 truncate (only when taskSummary exists)
Divider:  border-b border-white/10 (below header/summary section)
Rows:     px-3 py-2 border-b border-white/5 last:border-b-0
Scroll:   overflow-y-auto max-h-[400px] with custom scrollbar matching ScratchpadFeed
```

**Width**: `w-80` (320px) — same as ScratchpadFeed for consistency. Handles long dynamic agent names.

**AgentRow sub-component**:
```tsx
function AgentRow({ name, color, status, preview, isStreaming }: {
  name: string;
  color: string;
  status: AgentStatus;
  preview: string;
  isStreaming: boolean;
}) {
  const isActive = status === 'working' || status === 'thinking';

  return (
    <div className="px-3 py-2 border-b border-white/5 last:border-b-0">
      <div className="flex items-center gap-2">
        {/* Status indicator — checkmark ONLY for 'done', dot for everything else */}
        {status === 'done' ? (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="#14B8A6" className="w-3 h-3 shrink-0">
            <path fillRule="evenodd" d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z" clipRule="evenodd" />
          </svg>
        ) : (
          <div
            className={`w-2 h-2 rounded-full shrink-0 ${isActive ? 'animate-pulse' : ''}`}
            style={{ backgroundColor: statusColors[status] }}
          />
        )}

        {/* Agent name in their color */}
        <span className="text-xs font-medium truncate" style={{ color }}>
          {name}
        </span>

        {/* Status badge pill — only show when there's a label */}
        {statusLabels[status] && (
          <span
            className="text-[10px] px-1.5 py-0.5 rounded-full whitespace-nowrap shrink-0"
            style={{ backgroundColor: statusColors[status] + '20', color: statusColors[status] }}
          >
            {statusLabels[status]}
          </span>
        )}
      </div>

      {/* Message preview — truncated single line */}
      {preview && (
        <p className={`text-[11px] mt-0.5 ml-4 truncate ${isStreaming ? 'text-white/50' : 'text-white/35'}`}>
          {preview}
        </p>
      )}
    </div>
  );
}
```

**Header with collapse**:
```tsx
function TodoPanel() {
  const [collapsed, setCollapsed] = useState(false);
  // ... store selectors, allAgents memo, etc.

  // Visibility: hide when no workspace activity
  if (phase === 'reception' && dynamicAgents.length === 0) return null;

  const summary = taskSummary || 'No active task';
  const activeCount = allAgents.filter((a) => a.status !== 'idle').length;
  const phaseColor = phaseColors[phase];
  const showBuildingPlaceholder = phase === 'building' && allAgents.length === 0;

  return (
    <div className="fixed top-20 left-4 w-80 z-40 pointer-events-none">
      <div className="pointer-events-auto bg-black/50 backdrop-blur-md rounded-xl border border-white/10 overflow-hidden">
        {/* Header — always visible */}
        <div className="flex items-center justify-between px-3 py-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-white/90">Todo List</span>
            <span
              className="text-[10px] px-1.5 py-0.5 rounded-full"
              style={{ backgroundColor: phaseColor + '25', color: phaseColor }}
            >
              {phaseLabels[phase]}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-white/40">
              {activeCount}/{allAgents.length}
            </span>
            <button
              onClick={() => setCollapsed((c) => !c)}
              className="text-white/40 hover:text-white/60 transition-colors"
            >
              {/* Inline chevron SVG — same pattern as MissionControl.tsx */}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 16 16"
                fill="currentColor"
                className={`w-3 h-3 transition-transform ${collapsed ? '-rotate-90' : ''}`}
              >
                <path fillRule="evenodd" d="M4.22 6.22a.75.75 0 0 1 1.06 0L8 8.94l2.72-2.72a.75.75 0 1 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0L4.22 7.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>

        {/* Task summary — only when not collapsed and summary exists */}
        {!collapsed && taskSummary && (
          <p className="px-3 pb-2 text-[11px] text-white/35 truncate">{taskSummary}</p>
        )}

        {/* Divider */}
        {!collapsed && <div className="border-b border-white/10" />}

        {/* Agent rows or building placeholder */}
        {!collapsed && (
          showBuildingPlaceholder ? (
            <div className="px-3 py-4 text-center">
              <span className="text-[11px] text-white/30">Building workspace...</span>
            </div>
          ) : (
            <div className="overflow-y-auto max-h-[400px]
              [&::-webkit-scrollbar]:w-1.5
              [&::-webkit-scrollbar-track]:bg-transparent
              [&::-webkit-scrollbar-thumb]:bg-white/20
              [&::-webkit-scrollbar-thumb]:rounded-full
              hover:[&::-webkit-scrollbar-thumb]:bg-white/30"
            >
              {allAgents.map((agent) => {
                const msgs = chatMessages[agent.id] ?? [];
                const stream = streamingText[agent.id] ?? '';
                return (
                  <AgentRow
                    key={agent.id}
                    name={agent.name}
                    color={agent.color}
                    status={agent.status}
                    preview={getLastMessagePreview(msgs, stream)}
                    isStreaming={!!stream}
                  />
                );
              })}
            </div>
          )
        )}
      </div>
    </div>
  );
}
```

### Integration Points

```yaml
STORES:
  - Read-only access to worldStore, workspaceStore, chatStore
  - No new store actions needed

UI LAYOUT:
  - Position: top-20 left-4 (safely below HUD even when agent roster expands)
  - Z-index: z-40 (same layer as ScratchpadFeed, below ChatPanel z-50)
  - Width: w-80 (320px) — matches ScratchpadFeed for consistency
  - No overlap with ScratchpadFeed (bottom-24) since TodoPanel is at top-20
  - No overlap with HUD (top-0) since TodoPanel is at top-20

REMOVED:
  - MissionControlSky.tsx (entire file)
  - MissionControlSky import + render in Scene.tsx
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
| `apps/game-frontend/src/components/game/MissionControlSky.tsx` | **Entire file** | Replaced by TodoPanel |
| `apps/game-frontend/src/components/game/Scene.tsx` line 15 | `import { MissionControlSky }` | No longer used |
| `apps/game-frontend/src/components/game/Scene.tsx` lines 81-83 | `<Suspense><MissionControlSky /></Suspense>` | No longer used |

## Confidence Score: 9/10

High confidence because:
- All data sources are well-understood and already working
- Styling follows established patterns (ScratchpadFeed, MissionControl)
- Simple DOM rendering with no complex library integration
- Clear removal path for the old component
- All reviewer feedback incorporated

Minor risk: positioning might need tweaking if HUD height varies, but easy to adjust.
