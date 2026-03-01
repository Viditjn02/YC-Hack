'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useWorldStore } from '@/stores/worldStore';
import { useChatStore } from '@/stores/chatStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useActivityStore } from '@/stores/activityStore';
import { useScratchpadStore } from '@/stores/scratchpadStore';
import { useEmbedStore } from '@/stores/embedStore';
import { statusColors } from '@/data/agents';
import { Markdown } from '@/components/ui/Markdown';
import { gameSocket } from '@/lib/websocket';

function formatToolName(raw: string): string {
  const parts = raw.split('_');
  if (parts.length > 1) {
    return parts.slice(1).map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
  }
  return raw.replace(/([A-Z])/g, ' $1').trim();
}

function timeAgo(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 5) return 'now';
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

function StatusDot({ status, size = 'sm' }: { status: string; size?: 'sm' | 'md' }) {
  const s = size === 'md' ? 'w-3 h-3' : 'w-2 h-2';
  const pulse = status === 'working' || status === 'thinking' ? 'animate-pulse' : '';
  return (
    <div className={`${s} rounded-full ${pulse}`} style={{ backgroundColor: statusColors[status as keyof typeof statusColors] ?? '#888' }} />
  );
}

const EMPTY_MESSAGES: never[] = [];

function AgentCard({ agentId, onSelect }: { agentId: string; onSelect: () => void }) {
  const agent = useWorldStore((s) => s.agents.find((a) => a.id === agentId));
  const chatMessages = useChatStore((s) => s.chatMessages);
  const streamingTextMap = useChatStore((s) => s.streamingText);
  const allEvents = useActivityStore((s) => s.events);

  const messages = chatMessages[agentId] ?? EMPTY_MESSAGES;
  const streamingText = streamingTextMap[agentId] ?? '';

  const agentEvents = useMemo(
    () => allEvents.filter((e) => e.agentId === agentId),
    [allEvents, agentId],
  );

  if (!agent) return null;

  const lastAgentMsg = [...messages].reverse().find((m) => m.role === 'agent');
  const activeTool = agentEvents.filter((e) => e.type === 'tool' && e.toolStatus === 'started').at(-1);
  const completedTools = agentEvents.filter((e) => e.type === 'tool' && e.toolStatus === 'completed');
  const statusText = agent.status === 'working' ? 'Working' : agent.status === 'thinking' ? 'Thinking' : agent.status === 'done' ? 'Done' : agent.status === 'error' ? 'Error' : agent.status === 'listening' ? 'Listening' : 'Idle';
  const preview = streamingText || (lastAgentMsg?.role === 'agent' ? lastAgentMsg.content : '');

  return (
    <div
      onClick={onSelect}
      className="rounded-xl border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/[0.15] transition-all cursor-pointer overflow-hidden"
    >
      {/* Header */}
      <div className="px-4 py-3 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold" style={{ backgroundColor: agent.color + '30', color: agent.color }}>
          {agent.name.charAt(0)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-white truncate">{agent.name}</span>
            <StatusDot status={agent.status} />
            <span className="text-[10px] text-white/40 ml-auto shrink-0">{statusText}</span>
          </div>
          {activeTool && (
            <div className="flex items-center gap-1.5 mt-0.5">
              <div className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
              <span className="text-[11px] text-yellow-400/80 truncate">{formatToolName(activeTool.toolName!)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Progress bar for tools */}
      {completedTools.length > 0 && (
        <div className="px-4 pb-2">
          <div className="flex items-center gap-1">
            {completedTools.slice(-6).map((t) => (
              <div key={t.id} className="h-1 flex-1 rounded-full bg-green-500/40" title={formatToolName(t.toolName!)} />
            ))}
            {activeTool && <div className="h-1 flex-1 rounded-full bg-yellow-400/40 animate-pulse" />}
          </div>
          <span className="text-[9px] text-white/25 mt-1 block">{completedTools.length} tool{completedTools.length !== 1 ? 's' : ''} completed</span>
        </div>
      )}

      {/* Preview */}
      {preview && (
        <div className="px-4 pb-3 border-t border-white/[0.05]">
          <p className="text-[11px] text-white/40 mt-2 line-clamp-3 leading-relaxed">
            {streamingText ? (
              <>{streamingText.slice(-200)}<span className="animate-pulse">|</span></>
            ) : (
              preview.slice(-200)
            )}
          </p>
        </div>
      )}
    </div>
  );
}

function AgentDetailPanel({ agentId, onClose }: { agentId: string; onClose: () => void }) {
  const agent = useWorldStore((s) => s.agents.find((a) => a.id === agentId));
  const chatMessages = useChatStore((s) => s.chatMessages);
  const streamingTextMap = useChatStore((s) => s.streamingText);
  const allEvents = useActivityStore((s) => s.events);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState('');
  const sendMessage = useChatStore((s) => s.sendMessage);

  const messages = chatMessages[agentId] ?? EMPTY_MESSAGES;
  const streamingText = streamingTextMap[agentId] ?? '';

  const toolEvents = useMemo(
    () => allEvents.filter((e) => e.agentId === agentId && e.type === 'tool'),
    [allEvents, agentId],
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, streamingText]);

  useEffect(() => {
    gameSocket.send({ type: 'agent:interact', payload: { agentId } });
    return () => {
      gameSocket.send({ type: 'agent:stopInteract', payload: { agentId } });
    };
  }, [agentId]);

  if (!agent) return null;

  const statusText = agent.status === 'working' ? 'Working' : agent.status === 'thinking' ? 'Thinking' : agent.status === 'done' ? 'Done' : agent.status === 'error' ? 'Error' : 'Idle';

  const handleSend = () => {
    if (!input.trim()) return;
    sendMessage(agentId, input.trim());
    setInput('');
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-5 py-4 border-b border-white/[0.08] flex items-center gap-3 shrink-0">
        <button onClick={onClose} className="text-white/40 hover:text-white cursor-pointer">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
        </button>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-base font-bold" style={{ backgroundColor: agent.color + '30', color: agent.color }}>
          {agent.name.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-white">{agent.name}</h3>
          <div className="flex items-center gap-2 mt-0.5">
            <StatusDot status={agent.status} size="sm" />
            <span className="text-[11px] text-white/40">{statusText}</span>
          </div>
        </div>
      </div>

      {/* Tool progress */}
      {toolEvents.length > 0 && (
        <div className="px-5 py-3 border-b border-white/[0.05] shrink-0">
          <div className="text-[10px] text-white/30 uppercase tracking-wider mb-2">Tools Executed</div>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {toolEvents.slice(-10).map((t) => (
              <div key={t.id} className="flex items-center gap-2">
                <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${t.toolStatus === 'started' ? 'bg-yellow-400 animate-pulse' : t.toolStatus === 'completed' ? 'bg-green-400' : 'bg-red-400'}`} />
                <span className="text-[11px] text-white/60 truncate flex-1">{formatToolName(t.toolName!)}</span>
                <span className="text-[9px] text-white/20 shrink-0">{timeAgo(t.timestamp)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-3 space-y-3 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-thumb]:rounded-full">
        {messages.length === 0 && !streamingText && (
          <div className="flex items-center justify-center h-full text-white/20 text-xs">
            No messages yet
          </div>
        )}
        {messages.map((msg, i) => {
          if (msg.role === 'tool') {
            return (
              <div key={i} className="flex items-center gap-2 py-1">
                <div className={`w-1.5 h-1.5 rounded-full ${msg.status === 'started' ? 'bg-yellow-400 animate-pulse' : msg.status === 'completed' ? 'bg-green-400' : 'bg-red-400'}`} />
                <span className="text-[11px] text-white/40">
                  {msg.status === 'started' ? 'Running' : msg.status === 'completed' ? 'Completed' : 'Failed'}: {formatToolName(msg.toolName)}
                </span>
              </div>
            );
          }
          return (
            <div key={i} className={`${msg.role === 'user' ? 'ml-8' : 'mr-4'}`}>
              <div className={`rounded-xl px-4 py-3 ${msg.role === 'user' ? 'bg-indigo-600/30 text-white' : 'bg-white/[0.05] text-white/80'}`}>
                <div className="text-[12px] leading-relaxed">
                  <Markdown>{msg.content}</Markdown>
                </div>
              </div>
            </div>
          );
        })}
        {streamingText && (
          <div className="mr-4">
            <div className="rounded-xl px-4 py-3 bg-white/[0.05] text-white/80">
              <div className="text-[12px] leading-relaxed">
                <Markdown>{streamingText}</Markdown>
                <span className="animate-pulse text-indigo-400">|</span>
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-5 py-3 border-t border-white/[0.08] shrink-0">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={`Message ${agent.name}...`}
            className="flex-1 px-3 py-2 rounded-lg bg-white/[0.05] border border-white/[0.08] text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-indigo-500/50"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim()}
            className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 text-white text-sm font-medium cursor-pointer"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

function ActivityTimeline() {
  const events = useActivityStore((s) => s.events);
  const [, setTick] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [events.length]);

  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 5000);
    return () => clearInterval(interval);
  }, []);

  const recent = useMemo(() => events.slice(-30), [events]);

  return (
    <div className="flex-1 overflow-y-auto space-y-1 px-1 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-thumb]:rounded-full">
      {recent.length === 0 ? (
        <div className="text-white/20 text-[11px] text-center py-8">Waiting for activity...</div>
      ) : (
        recent.map((event) => (
          <div key={event.id} className="flex items-start gap-2 px-2 py-1.5 rounded-lg hover:bg-white/[0.03]">
            <div className="w-2 h-2 rounded-full shrink-0 mt-1" style={{ backgroundColor: event.agentColor }} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-semibold text-white/70">{event.agentName}</span>
                <span className="text-[9px] text-white/15 ml-auto">{timeAgo(event.timestamp)}</span>
              </div>
              <span className="text-[10px] text-white/35 block truncate">
                {event.type === 'tool' ? `${event.toolStatus === 'started' ? 'Running' : event.toolStatus === 'completed' ? 'Done' : 'Failed'}: ${formatToolName(event.toolName!)}` :
                 event.type === 'delegation' ? `Delegated to ${event.delegateToName}` :
                 event.type === 'status' ? event.status :
                 event.type === 'skill' ? `Skill: ${event.skillName}` : 'Activity'}
              </span>
            </div>
          </div>
        ))
      )}
      <div ref={bottomRef} />
    </div>
  );
}

function ScratchpadMini() {
  const entries = useScratchpadStore((s) => s.entries);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [entries.length]);

  if (entries.length === 0) return null;

  const recent = entries.slice(-5);

  return (
    <div className="border-t border-white/[0.06] pt-3 shrink-0">
      <div className="text-[10px] text-white/30 uppercase tracking-wider mb-2 px-2">Team Feed</div>
      <div className="space-y-1.5 max-h-48 overflow-y-auto px-1">
        {recent.map((entry) => (
          <div key={entry.id} className="px-2 py-1.5 rounded-lg bg-white/[0.02]">
            <div className="flex items-center gap-1.5 mb-0.5">
              <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: entry.authorColor }} />
              <span className="text-[10px] font-semibold text-white/60">{entry.authorType === 'user' ? 'You' : entry.authorName}</span>
            </div>
            <p className="text-[10px] text-white/35 line-clamp-2">{entry.content}</p>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

function EmbedPreview() {
  const embeds = useEmbedStore((s) => s.embeds);
  const activeEmbedId = useEmbedStore((s) => s.activeEmbedId);
  const setActiveEmbed = useEmbedStore((s) => s.setActiveEmbed);

  if (embeds.length === 0) return null;

  const active = embeds.find((e) => e.id === activeEmbedId) ?? embeds[0];

  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] overflow-hidden">
      {embeds.length > 1 && (
        <div className="flex gap-1 px-2 py-1.5 border-b border-white/[0.06] overflow-x-auto">
          {embeds.map((embed) => (
            <button
              key={embed.id}
              onClick={() => setActiveEmbed(embed.id)}
              className={`px-2 py-0.5 rounded text-[10px] whitespace-nowrap cursor-pointer ${
                embed.id === active.id ? 'bg-indigo-600/30 text-indigo-300' : 'text-white/40 hover:text-white/60'
              }`}
            >
              {embed.title}
            </button>
          ))}
        </div>
      )}
      <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
        <iframe
          src={active.url}
          className="absolute inset-0 w-full h-full border-0"
          sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
          title={active.title}
        />
      </div>
    </div>
  );
}

export function WorkspaceDashboard() {
  const agents = useWorldStore((s) => s.agents);
  const dynamicAgents = useWorkspaceStore((s) => s.dynamicAgents);
  const taskSummary = useWorkspaceStore((s) => s.taskSummary);
  const phase = useWorkspaceStore((s) => s.phase);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);

  const workspaceAgentIds = useMemo(
    () => new Set(dynamicAgents.map((a) => a.agentId)),
    [dynamicAgents],
  );

  const workspaceAgents = useMemo(
    () => agents.filter((a) => workspaceAgentIds.has(a.id)),
    [agents, workspaceAgentIds],
  );

  const staticAgents = useMemo(
    () => agents.filter((a) => !workspaceAgentIds.has(a.id)),
    [agents, workspaceAgentIds],
  );

  const hasWorkspace = phase !== 'reception' && workspaceAgents.length > 0;
  const workingCount = workspaceAgents.filter((a) => a.status === 'working' || a.status === 'thinking').length;
  const doneCount = workspaceAgents.filter((a) => a.status === 'done' || a.status === 'idle').length;

  return (
    <div className="absolute inset-0 top-11 z-10 flex">
      {/* Left: Main dashboard area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {hasWorkspace ? (
          <>
            {/* Task header */}
            <div className="px-6 py-4 border-b border-white/[0.06] shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse" />
                <h2 className="text-lg font-semibold text-white">{taskSummary || 'Workspace'}</h2>
              </div>
              <div className="flex items-center gap-4 mt-2">
                <span className="text-xs text-white/40">{workspaceAgents.length} agents</span>
                {workingCount > 0 && <span className="text-xs text-yellow-400/70">{workingCount} working</span>}
                {doneCount > 0 && <span className="text-xs text-green-400/70">{doneCount} completed</span>}
                <div className="flex-1 max-w-xs">
                  <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-indigo-500 to-green-500 rounded-full transition-all duration-500"
                      style={{ width: workspaceAgents.length > 0 ? `${(doneCount / workspaceAgents.length) * 100}%` : '0%' }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Main content */}
            <div className="flex-1 overflow-hidden flex">
              <div className="flex-1 overflow-y-auto p-6 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-thumb]:rounded-full">
                {selectedAgent ? (
                  <div className="h-full rounded-xl border border-white/[0.08] bg-white/[0.02] overflow-hidden">
                    <AgentDetailPanel agentId={selectedAgent} onClose={() => setSelectedAgent(null)} />
                  </div>
                ) : (
                  <div className="space-y-4">
                    <EmbedPreview />
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                      {workspaceAgents.map((agent) => (
                        <AgentCard
                          key={agent.id}
                          agentId={agent.id}
                          onSelect={() => setSelectedAgent(agent.id)}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center space-y-3">
              <div className="text-white/20 text-sm">No active workspace yet</div>
              <div className="text-white/10 text-xs">Chat with Reception to start a task</div>
              <div className="flex gap-2 justify-center mt-4">
                {staticAgents.map((agent) => (
                  <button
                    key={agent.id}
                    onClick={() => useChatStore.getState().openChat(agent.id)}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] transition-colors cursor-pointer"
                  >
                    <StatusDot status={agent.status} />
                    <span className="text-sm text-white/70">{agent.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Right sidebar: Activity timeline */}
      <div className="w-72 border-l border-white/[0.06] flex flex-col shrink-0 bg-white/[0.01]">
        <div className="px-4 py-3 border-b border-white/[0.06] shrink-0">
          <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider">Live Activity</h3>
        </div>
        <ActivityTimeline />
        <ScratchpadMini />
      </div>
    </div>
  );
}
