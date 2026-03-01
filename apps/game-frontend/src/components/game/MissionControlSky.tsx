'use client';

import { useState, useMemo } from 'react';
import { Html } from '@react-three/drei';
import { useWorldStore } from '@/stores/worldStore';
import { useChatStore, type ChatMessage } from '@/stores/chatStore';
import { useWorkspaceStore, type WorkspacePhase } from '@/stores/workspaceStore';
import { statusColors, statusLabels, toDynamicAgentData } from '@/data/agents';
import type { AgentStatus } from '@bossroom/shared-types';

/* ── Helpers ─────────────────────────────────────────────────────────── */

function getLastMessagePreview(messages: ChatMessage[], stream: string): string {
  if (stream) {
    const trimmed = stream.slice(-70).replace(/\n/g, ' ');
    return trimmed.length < stream.length ? '...' + trimmed : trimmed;
  }
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role === 'agent') {
      const text = msg.content.replace(/\n/g, ' ').trim();
      const end = text.search(/[.!?]\s/);
      if (end > 0 && end < 70) return text.slice(0, end + 1);
      if (text.length > 60) return text.slice(0, 60) + '...';
      return text;
    }
  }
  return '';
}

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

/* ── Agent row ───────────────────────────────────────────────────────── */

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

/* ── Main component ──────────────────────────────────────────────────── */

export function MissionControlSky() {
  const [collapsed, setCollapsed] = useState(false);

  const agents = useWorldStore((s) => s.agents);
  const phase = useWorkspaceStore((s) => s.phase);
  const taskSummary = useWorkspaceStore((s) => s.taskSummary);
  const dynamicAgents = useWorkspaceStore((s) => s.dynamicAgents);
  const builtAgentIds = useWorkspaceStore((s) => s.builtAgentIds);
  const chatMessages = useChatStore((s) => s.chatMessages);
  const streamingText = useChatStore((s) => s.streamingText);

  const allAgents = useMemo(() => {
    const seen = new Set<string>();
    const result: { id: string; name: string; color: string; zone: string; status: AgentStatus }[] = [];
    for (const a of agents) {
      if (!seen.has(a.id)) {
        seen.add(a.id);
        result.push({ id: a.id, name: a.name, color: a.color, zone: a.zone, status: a.status });
      }
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

  // Hide when no workspace activity
  if (phase === 'reception' && dynamicAgents.length === 0) return null;

  const activeCount = allAgents.filter((a) => a.status !== 'idle').length;
  const phaseColor = phaseColors[phase];
  const showBuildingPlaceholder = phase === 'building' && allAgents.length === 0;

  return (
    <group position={[0, 6, -20]}>
      <Html
        transform
        center
        distanceFactor={10}
        zIndexRange={[1, 10]}
        className="pointer-events-auto"
        style={{ pointerEvents: 'auto' }}
      >
        <div
          style={{ width: '400px' }}
          className="bg-black/50 backdrop-blur-md rounded-xl border border-white/10 overflow-hidden"
        >
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
      </Html>
    </group>
  );
}
