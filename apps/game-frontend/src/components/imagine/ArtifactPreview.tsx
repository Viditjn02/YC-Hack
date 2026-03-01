'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useWorldStore } from '@/stores/worldStore';
import { useChatStore } from '@/stores/chatStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useActivityStore } from '@/stores/activityStore';
import { useEmbedStore } from '@/stores/embedStore';
import { statusColors } from '@/data/agents';
import { Markdown } from '@/components/ui/Markdown';

function formatToolName(raw: string): string {
  const parts = raw.split('_');
  if (parts.length > 1) return parts.slice(1).map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
  return raw.replace(/([A-Z])/g, ' $1').trim();
}

function AgentTab({ agentId, isActive, onClick }: { agentId: string; isActive: boolean; onClick: () => void }) {
  const agent = useWorldStore((s) => s.agents.find((a) => a.id === agentId));
  if (!agent) return null;

  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all cursor-pointer shrink-0 ${
        isActive
          ? 'bg-white/[0.1] text-white border border-white/[0.12]'
          : 'text-white/40 hover:text-white/60 hover:bg-white/[0.04]'
      }`}
    >
      <div
        className={`w-2 h-2 rounded-full shrink-0 ${agent.status === 'working' || agent.status === 'thinking' ? 'animate-pulse' : ''}`}
        style={{ backgroundColor: statusColors[agent.status] ?? '#888' }}
      />
      <span className="truncate max-w-[100px]">{agent.name}</span>
    </button>
  );
}

function ToolStatusBar({ agentId }: { agentId: string }) {
  const allEvents = useActivityStore((s) => s.events);
  const agentToolEvents = useMemo(
    () => allEvents.filter((e) => e.agentId === agentId && e.type === 'tool'),
    [allEvents, agentId],
  );

  const activeTool = agentToolEvents.filter((e) => e.toolStatus === 'started').at(-1);
  const completedCount = agentToolEvents.filter((e) => e.toolStatus === 'completed').length;

  if (agentToolEvents.length === 0) return null;

  return (
    <div className="flex items-center gap-3 px-4 py-2 border-b border-white/[0.06] bg-white/[0.02]">
      {activeTool && (
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
          <span className="text-[11px] text-yellow-300/70">{formatToolName(activeTool.toolName!)}</span>
        </div>
      )}
      {completedCount > 0 && (
        <span className="text-[10px] text-white/20">{completedCount} step{completedCount !== 1 ? 's' : ''} completed</span>
      )}
    </div>
  );
}

function ArtifactContent({ agentId }: { agentId: string }) {
  const agent = useWorldStore((s) => s.agents.find((a) => a.id === agentId));
  const chatMessages = useChatStore((s) => s.chatMessages);
  const streamingTextMap = useChatStore((s) => s.streamingText);
  const embeds = useEmbedStore((s) => s.embeds);
  const allEvents = useActivityStore((s) => s.events);
  const contentRef = useRef<HTMLDivElement>(null);

  const messages = chatMessages[agentId] ?? [];
  const streamingText = streamingTextMap[agentId] ?? '';

  const agentEmbeds = useMemo(
    () => embeds.filter((e) => e.agentId === agentId),
    [embeds, agentId],
  );

  const toolEvents = useMemo(
    () => allEvents.filter((e) => e.agentId === agentId && e.type === 'tool'),
    [allEvents, agentId],
  );

  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [messages.length, streamingText, toolEvents.length]);

  if (!agent) return null;

  const agentMessages = messages.filter((m) => m.role === 'agent');
  const latestOutput = agentMessages.at(-1);
  const hasEmbed = agentEmbeds.length > 0;
  const isWorking = agent.status === 'working' || agent.status === 'thinking';

  return (
    <div ref={contentRef} className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-thumb]:rounded-full">
      {/* Embedded content (iframes) — full preview */}
      {hasEmbed && (
        <div className="h-full min-h-[400px]">
          <iframe
            src={agentEmbeds[0].url}
            className="w-full h-full border-0"
            sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
            title={agentEmbeds[0].title}
          />
        </div>
      )}

      {/* Text content — rendered markdown */}
      {!hasEmbed && (
        <div className="p-6 max-w-3xl mx-auto">
          {/* Tool execution steps */}
          {toolEvents.length > 0 && (
            <div className="mb-6 space-y-1.5">
              {toolEvents.slice(-12).map((evt) => (
                <div key={evt.id} className="flex items-center gap-2.5">
                  <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    evt.toolStatus === 'started' ? 'bg-yellow-400 animate-pulse' :
                    evt.toolStatus === 'completed' ? 'bg-green-400' : 'bg-red-400'
                  }`} />
                  <span className={`text-[12px] ${
                    evt.toolStatus === 'started' ? 'text-white/50' :
                    evt.toolStatus === 'completed' ? 'text-white/30' : 'text-red-400/60'
                  }`}>
                    {formatToolName(evt.toolName!)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Streaming text — live output */}
          {streamingText && (
            <div className="prose prose-invert prose-sm max-w-none">
              <Markdown>{streamingText}</Markdown>
              <span className="inline-block w-0.5 h-4 bg-indigo-400 animate-pulse ml-0.5" />
            </div>
          )}

          {/* Latest completed output */}
          {!streamingText && latestOutput && latestOutput.role === 'agent' && (
            <div className="prose prose-invert prose-sm max-w-none">
              <Markdown>{latestOutput.content}</Markdown>
            </div>
          )}

          {/* Idle / waiting state */}
          {!streamingText && !latestOutput && toolEvents.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-white/15">
              {isWorking ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce [animation-delay:0ms]" />
                    <span className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce [animation-delay:150ms]" />
                    <span className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce [animation-delay:300ms]" />
                  </div>
                  <span className="text-sm text-white/30">{agent.name} is working...</span>
                </div>
              ) : (
                <span className="text-sm">Waiting for output...</span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function ArtifactPreview() {
  const agents = useWorldStore((s) => s.agents);
  const dynamicAgents = useWorkspaceStore((s) => s.dynamicAgents);
  const taskSummary = useWorkspaceStore((s) => s.taskSummary);
  const [activeTab, setActiveTab] = useState<string | null>(null);

  const workspaceAgentIds = useMemo(() => new Set(dynamicAgents.map((a) => a.agentId)), [dynamicAgents]);
  const workspaceAgents = useMemo(() => agents.filter((a) => workspaceAgentIds.has(a.id)), [agents, workspaceAgentIds]);

  // Auto-select first working/thinking agent, or first agent
  useEffect(() => {
    if (workspaceAgents.length === 0) { setActiveTab(null); return; }
    if (activeTab && workspaceAgents.some((a) => a.id === activeTab)) return;
    const busy = workspaceAgents.find((a) => a.status === 'working' || a.status === 'thinking');
    setActiveTab(busy?.id ?? workspaceAgents[0]?.id ?? null);
  }, [workspaceAgents, activeTab]);

  if (workspaceAgents.length === 0) return null;

  const activeAgent = workspaceAgents.find((a) => a.id === activeTab);

  return (
    <div className="flex flex-col h-full bg-[#0f0f1a] border-l border-white/[0.06]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.06] shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-[13px] font-semibold text-white truncate">{taskSummary || 'Output'}</span>
        </div>
        <div className="flex items-center gap-1.5">
          {workspaceAgents.length > 0 && (
            <span className="text-[10px] text-white/20 px-2 py-0.5 rounded-full bg-white/[0.04]">
              {workspaceAgents.filter((a) => a.status === 'done').length}/{workspaceAgents.length} done
            </span>
          )}
        </div>
      </div>

      {/* Agent tabs */}
      <div className="flex items-center gap-1 px-3 py-2 border-b border-white/[0.04] overflow-x-auto shrink-0 [&::-webkit-scrollbar]:h-0">
        {workspaceAgents.map((agent) => (
          <AgentTab
            key={agent.id}
            agentId={agent.id}
            isActive={activeTab === agent.id}
            onClick={() => setActiveTab(agent.id)}
          />
        ))}
      </div>

      {/* Tool status */}
      {activeTab && <ToolStatusBar agentId={activeTab} />}

      {/* Content */}
      {activeTab ? (
        <ArtifactContent agentId={activeTab} />
      ) : (
        <div className="flex-1 flex items-center justify-center text-white/15 text-sm">
          Select an agent to view output
        </div>
      )}
    </div>
  );
}
