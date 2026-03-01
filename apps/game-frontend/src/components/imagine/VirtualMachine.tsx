'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useWorldStore } from '@/stores/worldStore';
import { useChatStore } from '@/stores/chatStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useActivityStore } from '@/stores/activityStore';
import { useScratchpadStore } from '@/stores/scratchpadStore';
import { useEmbedStore } from '@/stores/embedStore';
import { statusColors } from '@/data/agents';
import { Markdown } from '@/components/ui/Markdown';

function formatToolName(raw: string): string {
  const parts = raw.split('_');
  if (parts.length > 1) return parts.slice(1).map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
  return raw.replace(/([A-Z])/g, ' $1').trim();
}

function toolToAction(toolName: string, status: string): { icon: string; label: string; url?: string } {
  const name = toolName.toLowerCase();
  if (name.includes('gmail') || name.includes('email')) return { icon: '\u2709', label: status === 'started' ? 'Opening Gmail...' : 'Email sent', url: 'mail.google.com' };
  if (name.includes('calendar')) return { icon: '\u{1F4C5}', label: status === 'started' ? 'Opening Calendar...' : 'Event created', url: 'calendar.google.com' };
  if (name.includes('linear') || name.includes('ticket')) return { icon: '\u{1F4CB}', label: status === 'started' ? 'Opening Linear...' : 'Ticket created', url: 'linear.app' };
  if (name.includes('search') || name.includes('google')) return { icon: '\u{1F50D}', label: status === 'started' ? 'Searching...' : 'Search complete', url: 'google.com' };
  if (name.includes('scratchpad') || name.includes('write')) return { icon: '\u{270F}', label: status === 'started' ? 'Writing...' : 'Written to scratchpad' };
  if (name.includes('delegate')) return { icon: '\u{1F4E4}', label: status === 'started' ? 'Delegating task...' : 'Task delegated' };
  if (name.includes('skill')) return { icon: '\u{2B50}', label: status === 'started' ? 'Creating skill...' : 'Skill created' };
  if (name.includes('embed') || name.includes('show')) return { icon: '\u{1F4BB}', label: status === 'started' ? 'Loading document...' : 'Document opened' };
  if (name.includes('figma') || name.includes('design')) return { icon: '\u{1F3A8}', label: status === 'started' ? 'Opening Figma...' : 'Design ready', url: 'figma.com' };
  if (name.includes('stripe') || name.includes('payment') || name.includes('product')) return { icon: '\u{1F4B3}', label: status === 'started' ? 'Processing payment...' : 'Payment processed', url: 'stripe.com' };
  if (name.includes('peek') || name.includes('conversation')) return { icon: '\u{1F441}', label: status === 'started' ? 'Reading conversation...' : 'Conversation reviewed' };
  if (name.includes('finish') || name.includes('task')) return { icon: '\u2705', label: status === 'started' ? 'Finishing task...' : 'Task complete' };
  return { icon: '\u2699', label: status === 'started' ? `Running ${formatToolName(toolName)}...` : formatToolName(toolName) };
}

function VMBrowserWindow({ agentId, isActive, onFocus }: { agentId: string; isActive: boolean; onFocus: () => void }) {
  const agent = useWorldStore((s) => s.agents.find((a) => a.id === agentId));
  const chatMessages = useChatStore((s) => s.chatMessages);
  const streamingTextMap = useChatStore((s) => s.streamingText);
  const allEvents = useActivityStore((s) => s.events);
  const embeds = useEmbedStore((s) => s.embeds);
  const bottomRef = useRef<HTMLDivElement>(null);

  const messages = chatMessages[agentId] ?? [];
  const streamingText = streamingTextMap[agentId] ?? '';

  const agentEvents = useMemo(
    () => allEvents.filter((e) => e.agentId === agentId),
    [allEvents, agentId],
  );

  const toolEvents = useMemo(
    () => agentEvents.filter((e) => e.type === 'tool'),
    [agentEvents],
  );

  const latestTool = toolEvents.at(-1);
  const activeTool = toolEvents.filter((e) => e.toolStatus === 'started').at(-1);
  const agentEmbeds = useMemo(
    () => embeds.filter((e) => e.agentId === agentId),
    [embeds, agentId],
  );

  const currentAction = activeTool ? toolToAction(activeTool.toolName!, activeTool.toolStatus!) : null;
  const browserUrl = currentAction?.url ?? (agentEmbeds[0]?.url ? new URL(agentEmbeds[0].url).hostname : 'workspace://agent');

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [toolEvents.length, streamingText]);

  if (!agent) return null;

  const statusText = agent.status === 'working' ? 'Working' : agent.status === 'thinking' ? 'Thinking' : agent.status === 'done' ? 'Done' : agent.status === 'error' ? 'Error' : 'Idle';

  return (
    <div
      onClick={onFocus}
      className={`flex flex-col rounded-lg overflow-hidden border transition-all ${
        isActive
          ? 'border-indigo-500/40 shadow-lg shadow-indigo-500/10 ring-1 ring-indigo-500/20'
          : 'border-white/[0.1] hover:border-white/[0.2]'
      }`}
      style={{ minHeight: '280px' }}
    >
      {/* Title bar — macOS style */}
      <div className="flex items-center gap-2 px-3 py-2 bg-[#2b2b3d] border-b border-white/[0.06] shrink-0">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-[#ff5f56]" />
          <div className="w-3 h-3 rounded-full bg-[#ffbd2e]" />
          <div className="w-3 h-3 rounded-full bg-[#27c93f]" />
        </div>
        <div className="flex-1 flex items-center gap-2 ml-2">
          <div className="w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold" style={{ backgroundColor: agent.color + '40', color: agent.color }}>
            {agent.name.charAt(0)}
          </div>
          <span className="text-[11px] text-white/70 font-medium truncate">{agent.name}</span>
          <div className={`w-1.5 h-1.5 rounded-full ${agent.status === 'working' || agent.status === 'thinking' ? 'animate-pulse' : ''}`} style={{ backgroundColor: statusColors[agent.status] ?? '#888' }} />
          <span className="text-[9px] text-white/30">{statusText}</span>
        </div>
      </div>

      {/* Address bar */}
      <div className="flex items-center gap-2 px-3 py-1.5 bg-[#232336] border-b border-white/[0.04] shrink-0">
        <div className="flex gap-1">
          <div className="w-5 h-5 rounded flex items-center justify-center text-white/20 text-[10px] bg-white/[0.04]">&larr;</div>
          <div className="w-5 h-5 rounded flex items-center justify-center text-white/20 text-[10px] bg-white/[0.04]">&rarr;</div>
          {(agent.status === 'working' || agent.status === 'thinking') && (
            <div className="w-5 h-5 rounded flex items-center justify-center text-white/40 text-[10px] bg-white/[0.04] animate-spin">&#8635;</div>
          )}
        </div>
        <div className="flex-1 flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/[0.06] border border-white/[0.06]">
          <span className="text-[10px] text-green-400/60">&#128274;</span>
          <span className="text-[11px] text-white/50 truncate font-mono">{browserUrl}</span>
        </div>
      </div>

      {/* Content area — "browser viewport" */}
      <div className="flex-1 bg-[#1a1a2e] overflow-y-auto [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-thumb]:rounded-full">
        {/* Embedded iframe if available */}
        {agentEmbeds.length > 0 ? (
          <iframe
            src={agentEmbeds[0].url}
            className="w-full h-full min-h-[200px] border-0"
            sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
            title={agentEmbeds[0].title}
          />
        ) : (
          <div className="p-3 space-y-2">
            {/* Tool execution visualization */}
            {toolEvents.length > 0 && (
              <div className="space-y-1">
                {toolEvents.slice(-8).map((evt) => {
                  const action = toolToAction(evt.toolName!, evt.toolStatus!);
                  return (
                    <div key={evt.id} className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all ${
                      evt.toolStatus === 'started' ? 'bg-yellow-500/[0.08] border border-yellow-500/20' :
                      evt.toolStatus === 'completed' ? 'bg-green-500/[0.06] border border-green-500/10' :
                      'bg-red-500/[0.06] border border-red-500/10'
                    }`}>
                      <span className="text-sm">{action.icon}</span>
                      <span className={`text-[11px] flex-1 ${
                        evt.toolStatus === 'started' ? 'text-yellow-300/80' :
                        evt.toolStatus === 'completed' ? 'text-green-300/60' :
                        'text-red-300/60'
                      }`}>
                        {action.label}
                      </span>
                      {evt.toolStatus === 'started' && (
                        <div className="flex gap-0.5">
                          <span className="w-1 h-1 rounded-full bg-yellow-400 animate-bounce [animation-delay:0ms]" />
                          <span className="w-1 h-1 rounded-full bg-yellow-400 animate-bounce [animation-delay:150ms]" />
                          <span className="w-1 h-1 rounded-full bg-yellow-400 animate-bounce [animation-delay:300ms]" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Streaming output */}
            {streamingText && (
              <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] px-3 py-2">
                <div className="text-[11px] text-white/60 leading-relaxed">
                  <Markdown>{streamingText}</Markdown>
                  <span className="animate-pulse text-indigo-400">|</span>
                </div>
              </div>
            )}

            {/* Latest agent message */}
            {!streamingText && messages.length > 0 && (() => {
              const lastMsg = [...messages].reverse().find((m) => m.role === 'agent');
              if (!lastMsg || lastMsg.role !== 'agent') return null;
              return (
                <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] px-3 py-2">
                  <div className="text-[11px] text-white/50 leading-relaxed line-clamp-6">
                    <Markdown>{lastMsg.content}</Markdown>
                  </div>
                </div>
              );
            })()}

            {/* Empty state */}
            {toolEvents.length === 0 && !streamingText && messages.length === 0 && (
              <div className="flex items-center justify-center py-8 text-white/15 text-xs">
                {agent.status === 'idle' ? 'Waiting for instructions...' : 'Starting up...'}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function VMTaskbar({ agents, activeAgentId, onSelectAgent }: {
  agents: { id: string; name: string; color: string; status: string }[];
  activeAgentId: string | null;
  onSelectAgent: (id: string) => void;
}) {
  return (
    <div className="flex items-center gap-1 px-3 py-1.5 bg-[#1e1e30] border-t border-white/[0.06] shrink-0 overflow-x-auto [&::-webkit-scrollbar]:h-0">
      {agents.map((agent) => (
        <button
          key={agent.id}
          onClick={() => onSelectAgent(agent.id)}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] whitespace-nowrap transition-all cursor-pointer shrink-0 ${
            activeAgentId === agent.id
              ? 'bg-white/[0.12] text-white border border-white/[0.1]'
              : 'text-white/40 hover:bg-white/[0.06] hover:text-white/60'
          }`}
        >
          <div className="w-4 h-4 rounded flex items-center justify-center text-[8px] font-bold" style={{ backgroundColor: agent.color + '40', color: agent.color }}>
            {agent.name.charAt(0)}
          </div>
          <span className="max-w-[80px] truncate">{agent.name}</span>
          <div className={`w-1.5 h-1.5 rounded-full ${agent.status === 'working' || agent.status === 'thinking' ? 'animate-pulse' : ''}`} style={{ backgroundColor: statusColors[agent.status as keyof typeof statusColors] ?? '#888' }} />
        </button>
      ))}
    </div>
  );
}

function VMActivitySidebar() {
  const allEvents = useActivityStore((s) => s.events);
  const entries = useScratchpadStore((s) => s.entries);
  const [, setTick] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);

  const recent = useMemo(() => allEvents.slice(-25), [allEvents]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [allEvents.length]);

  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-white/[0.06] shrink-0">
        <span className="text-[10px] text-white/30 uppercase tracking-wider font-semibold">System Log</span>
      </div>
      <div className="flex-1 overflow-y-auto px-2 py-1 space-y-0.5 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-thumb]:rounded-full">
        {recent.map((evt) => {
          const action = evt.type === 'tool' ? toolToAction(evt.toolName!, evt.toolStatus!) : null;
          return (
            <div key={evt.id} className="flex items-start gap-1.5 px-1.5 py-1 rounded hover:bg-white/[0.02]">
              <span className="text-[10px] mt-px">{action?.icon ?? (evt.type === 'status' ? '\u{25CF}' : '\u{2192}')}</span>
              <div className="min-w-0 flex-1">
                <span className="text-[10px] font-medium" style={{ color: evt.agentColor }}>{evt.agentName}</span>
                <span className="text-[10px] text-white/30 block truncate">
                  {action?.label ?? (evt.type === 'status' ? evt.status : evt.type === 'delegation' ? `\u2192 ${evt.delegateToName}` : 'Activity')}
                </span>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Mini scratchpad */}
      {entries.length > 0 && (
        <div className="border-t border-white/[0.06] px-2 py-2 shrink-0 max-h-36 overflow-y-auto">
          <span className="text-[9px] text-white/20 uppercase tracking-wider block mb-1">Team Feed</span>
          {entries.slice(-3).map((e) => (
            <div key={e.id} className="mb-1">
              <span className="text-[9px] font-medium" style={{ color: e.authorColor }}>{e.authorName}: </span>
              <span className="text-[9px] text-white/30">{e.content.slice(0, 80)}{e.content.length > 80 ? '...' : ''}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function VirtualMachine() {
  const agents = useWorldStore((s) => s.agents);
  const dynamicAgents = useWorkspaceStore((s) => s.dynamicAgents);
  const taskSummary = useWorkspaceStore((s) => s.taskSummary);
  const phase = useWorkspaceStore((s) => s.phase);
  const [focusedAgent, setFocusedAgent] = useState<string | null>(null);
  const [showSidebar, setShowSidebar] = useState(true);

  const workspaceAgentIds = useMemo(() => new Set(dynamicAgents.map((a) => a.agentId)), [dynamicAgents]);
  const workspaceAgents = useMemo(() => agents.filter((a) => workspaceAgentIds.has(a.id)), [agents, workspaceAgentIds]);
  const staticAgents = useMemo(() => agents.filter((a) => !workspaceAgentIds.has(a.id)), [agents, workspaceAgentIds]);
  const hasWorkspace = phase !== 'reception' && workspaceAgents.length > 0;

  const workingCount = workspaceAgents.filter((a) => a.status === 'working' || a.status === 'thinking').length;
  const doneCount = workspaceAgents.filter((a) => a.status === 'done').length;

  const handleSelectAgent = useCallback((id: string) => setFocusedAgent(id), []);

  if (!hasWorkspace) {
    return (
      <div className="absolute inset-0 top-11 z-10 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="text-white/20 text-sm">No active workspace</div>
          <div className="text-white/10 text-xs">Chat with Reception to start a project</div>
          <div className="flex gap-2 justify-center mt-4">
            {staticAgents.map((agent) => (
              <button
                key={agent.id}
                onClick={() => useChatStore.getState().openChat(agent.id)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] transition-colors cursor-pointer"
              >
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: statusColors[agent.status] ?? '#888' }} />
                <span className="text-sm text-white/70">{agent.name}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 top-11 z-10 flex flex-col bg-[#12121e]">
      {/* VM top bar — like a monitor bezel */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#161628] border-b border-white/[0.06] shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-sm font-semibold text-white">{taskSummary || 'Workspace'}</span>
          <span className="text-[10px] text-white/25 bg-white/[0.04] px-2 py-0.5 rounded-full">
            {workspaceAgents.length} agents
          </span>
          {workingCount > 0 && <span className="text-[10px] text-yellow-400/60">{workingCount} active</span>}
          {doneCount > 0 && <span className="text-[10px] text-green-400/60">{doneCount} done</span>}
        </div>
        <div className="flex items-center gap-2">
          {/* Progress */}
          <div className="w-32 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 to-green-400 rounded-full transition-all duration-700"
              style={{ width: workspaceAgents.length > 0 ? `${(doneCount / workspaceAgents.length) * 100}%` : '0%' }}
            />
          </div>
          <button
            onClick={() => setShowSidebar((p) => !p)}
            className={`px-2 py-1 rounded text-[10px] cursor-pointer transition-colors ${showSidebar ? 'bg-indigo-500/20 text-indigo-300' : 'text-white/30 hover:text-white/50'}`}
          >
            Log
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* VM screens area */}
        <div className="flex-1 overflow-y-auto p-4 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-thumb]:rounded-full">
          {focusedAgent ? (
            /* Focused single agent view */
            <div className="h-full">
              <button
                onClick={() => setFocusedAgent(null)}
                className="flex items-center gap-1.5 mb-3 text-[11px] text-white/40 hover:text-white/60 cursor-pointer"
              >
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
                All agents
              </button>
              <div className="h-[calc(100%-2rem)]">
                <VMBrowserWindow agentId={focusedAgent} isActive={true} onFocus={() => {}} />
              </div>
            </div>
          ) : (
            /* Grid of all agents */
            <div className={`grid gap-3 ${
              workspaceAgents.length <= 2 ? 'grid-cols-1 md:grid-cols-2' :
              workspaceAgents.length <= 4 ? 'grid-cols-1 md:grid-cols-2' :
              'grid-cols-1 md:grid-cols-2 xl:grid-cols-3'
            }`}>
              {workspaceAgents.map((agent) => (
                <VMBrowserWindow
                  key={agent.id}
                  agentId={agent.id}
                  isActive={false}
                  onFocus={() => setFocusedAgent(agent.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Right sidebar — system log */}
        {showSidebar && (
          <div className="w-64 border-l border-white/[0.06] bg-[#161628] shrink-0">
            <VMActivitySidebar />
          </div>
        )}
      </div>

      {/* Taskbar */}
      <VMTaskbar
        agents={workspaceAgents.map((a) => ({ id: a.id, name: a.name, color: a.color, status: a.status }))}
        activeAgentId={focusedAgent}
        onSelectAgent={handleSelectAgent}
      />
    </div>
  );
}
