'use client';

import { useState, useEffect, useRef, useMemo, useCallback, type ReactNode } from 'react';
import { useWorldStore } from '@/stores/worldStore';
import { useChatStore } from '@/stores/chatStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useActivityStore } from '@/stores/activityStore';
import { useScratchpadStore } from '@/stores/scratchpadStore';
import { useEmbedStore } from '@/stores/embedStore';
import { Markdown } from '@/components/ui/Markdown';

function formatToolName(raw: string): string {
  const parts = raw.split('_');
  if (parts.length > 1) return parts.slice(1).map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
  return raw.replace(/([A-Z])/g, ' $1').trim();
}

const TOOL_TECH_MAP: Record<string, { label: string; color: string }> = {
  web_search: { label: 'Web', color: '#4285f4' },
  search_web: { label: 'Web', color: '#4285f4' },
  browse: { label: 'Browser', color: '#FF6D00' },
  read_file: { label: 'FS', color: '#66bb6a' },
  write_file: { label: 'FS', color: '#66bb6a' },
  execute_code: { label: 'Code', color: '#ab47bc' },
  gmail: { label: 'Gmail', color: '#ea4335' },
  GMAIL: { label: 'Gmail', color: '#ea4335' },
  calendar: { label: 'Cal', color: '#4285f4' },
  google_docs: { label: 'Docs', color: '#4285f4' },
  google_sheets: { label: 'Sheets', color: '#0f9d58' },
  slack: { label: 'Slack', color: '#4a154b' },
  delegate_task: { label: 'Delegate', color: '#ff7043' },
  write_scratchpad: { label: 'Notes', color: '#ffa726' },
  read_scratchpad: { label: 'Notes', color: '#ffa726' },
  open_embed: { label: 'Embed', color: '#26a69a' },
  finish_task: { label: 'Done', color: '#66bb6a' },
};

function getTechForTool(toolName: string): { label: string; color: string } | null {
  for (const [key, val] of Object.entries(TOOL_TECH_MAP)) {
    if (toolName.toLowerCase().includes(key.toLowerCase())) return val;
  }
  return null;
}

/* ─── Floating Window ─── */

interface WindowProps {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
  style: React.CSSProperties;
  onFocus: () => void;
  onClose: () => void;
  statusColor?: string;
  statusText?: string;
  techStack?: { label: string; color: string }[];
  animDelay?: number;
}

function DesktopWindow({ title, icon, children, style, onFocus, onClose, statusColor, statusText, techStack, animDelay = 0 }: WindowProps) {
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [visible, setVisible] = useState(false);
  const dragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), animDelay);
    return () => clearTimeout(t);
  }, [animDelay]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    onFocus();
    dragging.current = true;
    dragStart.current = { x: e.clientX - offset.x, y: e.clientY - offset.y };

    const handleMouseMove = (ev: MouseEvent) => {
      if (!dragging.current) return;
      setOffset({ x: ev.clientX - dragStart.current.x, y: ev.clientY - dragStart.current.y });
    };
    const handleMouseUp = () => {
      dragging.current = false;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [onFocus, offset.x, offset.y]);

  return (
    <div
      className="absolute rounded-xl overflow-hidden flex flex-col transition-[opacity,transform] duration-500 ease-out"
      style={{
        ...style,
        transform: `translate(${offset.x}px, ${offset.y}px) ${visible ? 'scale(1)' : 'scale(0.92)'}`,
        opacity: visible ? 1 : 0,
        boxShadow: '0 8px 40px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.10)',
      }}
      onMouseDown={() => onFocus()}
    >
      {/* Title bar */}
      <div
        onMouseDown={handleMouseDown}
        className="flex items-center gap-2.5 px-3 h-9 bg-gradient-to-b from-[#f8f6f2] to-[#efece6] border-b border-black/[0.08] cursor-grab active:cursor-grabbing select-none shrink-0"
      >
        <div className="flex gap-[6px]">
          <button onClick={(e) => { e.stopPropagation(); onClose(); }} className="w-3 h-3 rounded-full bg-[#ff5f56] hover:brightness-90 transition-all cursor-pointer shadow-[inset_0_-0.5px_0.5px_rgba(0,0,0,0.12)]" />
          <div className="w-3 h-3 rounded-full bg-[#ffbd2e] shadow-[inset_0_-0.5px_0.5px_rgba(0,0,0,0.12)]" />
          <div className="w-3 h-3 rounded-full bg-[#27c93f] shadow-[inset_0_-0.5px_0.5px_rgba(0,0,0,0.12)]" />
        </div>
        <div className="flex items-center gap-1.5 flex-1 min-w-0 ml-1">
          {icon}
          <span className="text-[12px] font-medium text-[#3d3d3d] truncate">{title}</span>
        </div>
        {statusText && (
          <span className="text-[9px] px-1.5 py-[2px] rounded-full font-semibold shrink-0 uppercase tracking-wide"
            style={{ backgroundColor: (statusColor ?? '#888') + '18', color: statusColor ?? '#888' }}>
            {statusText}
          </span>
        )}
        {techStack && techStack.length > 0 && (
          <div className="flex items-center gap-0.5 shrink-0">
            {techStack.slice(0, 4).map((t, i) => (
              <span key={i} className="text-[8px] px-1 py-[1px] rounded font-semibold"
                style={{ backgroundColor: t.color + '14', color: t.color }}>
                {t.label}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-hidden bg-white">
        {children}
      </div>
    </div>
  );
}

/* ─── Thinking Bubble ─── */

function ThinkingBubble() {
  const allEvents = useActivityStore((s) => s.events);
  const agents = useWorldStore((s) => s.agents);

  const busyAgents = useMemo(
    () => agents.filter((a) => a.status === 'working' || a.status === 'thinking'),
    [agents],
  );

  const latestToolEvent = useMemo(
    () => allEvents.filter((e) => e.type === 'tool' && e.toolStatus === 'started').at(-1),
    [allEvents],
  );

  if (busyAgents.length === 0 && !latestToolEvent) return null;

  const lines: string[] = [];
  if (latestToolEvent) {
    lines.push(`${latestToolEvent.agentName}: ${formatToolName(latestToolEvent.toolName!)}`);
  }
  for (const a of busyAgents.slice(0, 3)) {
    if (!latestToolEvent || latestToolEvent.agentId !== a.id) {
      lines.push(`${a.name} is ${a.status}...`);
    }
  }

  return (
    <div className="fixed top-16 right-5 z-40 max-w-[260px]"
      style={{ animation: 'desktopBubbleIn 0.4s cubic-bezier(0.34,1.56,0.64,1)' }}>
      <div className="bg-white/95 backdrop-blur-md rounded-2xl px-4 py-3 shadow-xl border border-black/[0.06]">
        {lines.map((line, i) => (
          <p key={i} className="text-[12px] text-[#555] leading-relaxed">{line}</p>
        ))}
        <div className="flex gap-1 mt-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#bbb] animate-bounce [animation-delay:0ms]" />
          <span className="w-1.5 h-1.5 rounded-full bg-[#bbb] animate-bounce [animation-delay:150ms]" />
          <span className="w-1.5 h-1.5 rounded-full bg-[#bbb] animate-bounce [animation-delay:300ms]" />
        </div>
      </div>
      <div className="flex gap-1 mt-1 ml-6">
        <div className="w-3 h-3 rounded-full bg-white/90 shadow-sm border border-black/[0.05]" />
        <div className="w-2 h-2 rounded-full bg-white/80 shadow-sm border border-black/[0.05] mt-1" />
      </div>
    </div>
  );
}

/* ─── Agent Output Window Content — shows ALL messages, tool results, scratchpad ─── */

function ToolResultBlock({ toolName, result }: { toolName: string; result?: string }) {
  if (!result || result.length < 5) return null;

  const isUrl = result.startsWith('http://') || result.startsWith('https://');
  const isCode = result.includes('```') || result.includes('function ') || result.includes('const ') || result.includes('<div') || result.includes('import ');
  const isJson = result.startsWith('{') || result.startsWith('[');
  const name = formatToolName(toolName);

  if (isUrl) {
    const isImage = /\.(jpg|jpeg|png|gif|webp|svg)/i.test(result);
    if (isImage) {
      return (
        <div className="my-1.5" style={{ animation: 'desktopFadeIn 0.3s ease-out' }}>
          <img src={result.trim()} alt={name} className="max-w-full max-h-[140px] rounded-md border border-black/[0.06] object-contain" />
        </div>
      );
    }
    return (
      <a href={result.trim()} target="_blank" rel="noopener noreferrer"
        className="text-[11px] text-blue-600 hover:underline break-all block my-0.5">
        {result.trim().slice(0, 80)}{result.length > 80 ? '...' : ''}
      </a>
    );
  }

  if (isCode) {
    return (
      <pre className="my-1.5 p-2.5 rounded-md bg-[#1e1e2e] text-[#cdd6f4] text-[11px] leading-relaxed overflow-x-auto max-h-[200px] overflow-y-auto"
        style={{ animation: 'desktopFadeIn 0.3s ease-out' }}>
        <code>{result.slice(0, 1500)}</code>
      </pre>
    );
  }

  if (isJson) {
    try {
      const parsed = JSON.parse(result);
      const pretty = JSON.stringify(parsed, null, 2).slice(0, 800);
      return (
        <pre className="my-1.5 p-2 rounded-md bg-[#f7f6f3] text-[#555] text-[10px] leading-relaxed overflow-x-auto max-h-[120px] overflow-y-auto border border-black/[0.04]">
          <code>{pretty}</code>
        </pre>
      );
    } catch {
      // fall through
    }
  }

  if (result.length > 100) {
    return (
      <div className="my-1 p-2 rounded-md bg-[#f9f8f5] text-[11px] text-[#555] leading-relaxed border border-black/[0.04] max-h-[140px] overflow-y-auto"
        style={{ animation: 'desktopFadeIn 0.3s ease-out' }}>
        {result.slice(0, 800)}{result.length > 800 ? '...' : ''}
      </div>
    );
  }

  return null;
}

const COMPOSIO_MD_RE = /\[([^\]]*)\]\(https:\/\/connect\.composio\.dev\/[^)]+\)/g;
const COMPOSIO_RAW_RE = /https:\/\/connect\.composio\.dev\/\S+/g;
function stripComposioLinks(text: string): string {
  return text.replace(COMPOSIO_MD_RE, '').replace(COMPOSIO_RAW_RE, '').replace(/\n{3,}/g, '\n').trim();
}

function AgentWindowContent({ agentId, agentName }: { agentId: string; agentName: string }) {
  const chatMessages = useChatStore((s) => s.chatMessages);
  const streamingTextMap = useChatStore((s) => s.streamingText);
  const scratchpadEntries = useScratchpadStore((s) => s.entries);
  const contentRef = useRef<HTMLDivElement>(null);

  const messages = useMemo(() => chatMessages[agentId] ?? [], [chatMessages, agentId]);
  const streamingText = streamingTextMap[agentId] ?? '';

  const agentScratchpad = useMemo(
    () => scratchpadEntries.filter((e) => {
      const entryName = e.authorName.toLowerCase().replace(/[\s_-]/g, '');
      const targetName = agentName.toLowerCase().replace(/[\s_-]/g, '');
      return entryName === targetName || entryName.includes(targetName) || targetName.includes(entryName);
    }),
    [scratchpadEntries, agentName],
  );

  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [messages.length, streamingText, agentScratchpad.length]);

  // Render ALL message types in order — agent text, tool results, etc.
  const hasMessages = messages.length > 0;
  const hasContent = hasMessages || streamingText || agentScratchpad.length > 0;

  return (
    <div ref={contentRef} className="p-3 h-full overflow-y-auto space-y-2">
      {/* Render messages in order */}
      {messages.map((msg, i) => {
        if (msg.role === 'agent') {
          const cleaned = stripComposioLinks(msg.content);
          if (!cleaned) return null;
          return (
            <div key={`m-${i}`} className="prose prose-sm max-w-none text-[#333] text-[12px] leading-relaxed"
              style={{ animation: 'desktopFadeIn 0.3s ease-out' }}>
              <Markdown>{cleaned}</Markdown>
            </div>
          );
        }

        if (msg.role === 'tool') {
          return (
            <div key={`m-${i}`} style={{ animation: 'desktopSlideIn 0.25s ease-out' }}>
              <div className="flex items-center gap-1.5 mb-0.5">
                <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                  msg.status === 'started' ? 'bg-amber-400 animate-pulse' :
                  msg.status === 'completed' ? 'bg-emerald-500' : 'bg-red-400'
                }`} />
                <span className={`text-[10px] font-medium ${
                  msg.status === 'started' ? 'text-amber-700' : 'text-[#888]'
                }`}>
                  {formatToolName(msg.toolName)}
                </span>
                {msg.status === 'completed' && (
                  <svg className="w-2.5 h-2.5 text-emerald-500 shrink-0" viewBox="0 0 16 16" fill="none">
                    <path d="M3 8.5L6.5 12L13 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
              {msg.status === 'completed' && msg.result && (
                <ToolResultBlock toolName={msg.toolName} result={msg.result} />
              )}
            </div>
          );
        }

        return null;
      })}

      {/* Scratchpad entries from this agent (always show — this is their work output) */}
      {agentScratchpad.map((entry) => {
        const cleaned = stripComposioLinks(entry.content);
        if (!cleaned) return null;
        return (
          <div key={entry.id} className="p-2 rounded-md bg-amber-50/60 border border-amber-200/30"
            style={{ animation: 'desktopFadeIn 0.3s ease-out' }}>
            <div className="prose prose-sm max-w-none text-[#444] text-[12px] leading-relaxed">
              <Markdown>{cleaned}</Markdown>
            </div>
          </div>
        );
      })}

      {/* Live streaming */}
      {streamingText && (
        <div className="prose prose-sm max-w-none text-[#333] text-[12px] leading-relaxed">
          <Markdown>{streamingText}</Markdown>
          <span className="inline-block w-0.5 h-4 bg-amber-500 animate-pulse ml-0.5" />
        </div>
      )}

      {/* Empty working state */}
      {!hasContent && !streamingText && (
        <div className="flex flex-col items-center justify-center h-full gap-3">
          <div className="flex gap-1.5">
            <div className="w-2 h-2 rounded-full bg-[#ccc] animate-bounce [animation-delay:0ms]" />
            <div className="w-2 h-2 rounded-full bg-[#ccc] animate-bounce [animation-delay:100ms]" />
            <div className="w-2 h-2 rounded-full bg-[#ccc] animate-bounce [animation-delay:200ms]" />
          </div>
          <span className="text-[#bbb] text-xs">Working...</span>
        </div>
      )}
    </div>
  );
}

/* ─── Desktop Prompt Bar ─── */

function DesktopPromptBar() {
  const [input, setInput] = useState('');
  const openChat = useChatStore((s) => s.openChat);
  const sendMessage = useChatStore((s) => s.sendMessage);
  const activeAgent = useChatStore((s) => s.activeAgent);

  const handleSend = () => {
    if (!input.trim()) return;
    const target = activeAgent ?? 'receptionist';
    if (!activeAgent) openChat(target);
    sendMessage(target, input.trim());
    setInput('');
  };

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-30 w-full max-w-[540px] px-4">
      <div className="flex items-center bg-white/95 backdrop-blur-xl rounded-[24px] h-[48px] px-4 border border-black/[0.08] transition-shadow focus-within:shadow-2xl"
        style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.10)' }}>
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
          placeholder="What do you want to build?"
          className="flex-1 bg-transparent text-sm text-[#333] placeholder:text-[#aaa] focus:outline-none"
        />
        <button
          onClick={handleSend}
          disabled={!input.trim()}
          className={`w-7 h-7 rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer ${
            input.trim()
              ? 'bg-imagine-terracotta text-white hover:brightness-110 scale-100'
              : 'bg-black/[0.06] text-[#bbb] opacity-40 scale-90'
          }`}
        >
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
            <path d="M7 12V2M7 2L2 7M7 2L12 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}

/* ─── Status Toast — shows workspace progress, no auth links ─── */

function StatusToast() {
  const dynamicAgents = useWorkspaceStore((s) => s.dynamicAgents);
  const agents = useWorldStore((s) => s.agents);

  const workspaceAgentIds = useMemo(() => new Set(dynamicAgents.map((a) => a.agentId)), [dynamicAgents]);
  const workspaceAgents = useMemo(() => agents.filter((a) => workspaceAgentIds.has(a.id)), [agents, workspaceAgentIds]);

  if (workspaceAgents.length === 0) return null;

  const working = workspaceAgents.filter(a => a.status === 'working' || a.status === 'thinking');
  const done = workspaceAgents.filter(a => a.status === 'done');
  const allDone = done.length === workspaceAgents.length;

  if (allDone) return null;

  return (
    <div
      className="fixed top-14 left-1/2 -translate-x-1/2 z-[9999] pointer-events-auto"
      style={{ animation: 'desktopBubbleIn 0.4s cubic-bezier(0.34,1.56,0.64,1)' }}
    >
      <div className="bg-white/90 backdrop-blur-md rounded-full px-4 py-2 shadow-lg border border-black/[0.06] flex items-center gap-3">
        {working.length > 0 && (
          <>
            <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
            <span className="text-[12px] text-[#555] font-medium">
              {working.length} agent{working.length > 1 ? 's' : ''} working
            </span>
          </>
        )}
        {done.length > 0 && (
          <span className="text-[12px] text-emerald-600 font-medium">
            {done.length}/{workspaceAgents.length} done
          </span>
        )}
      </div>
    </div>
  );
}

/* ─── Desktop OS ─── */

interface OpenWindow {
  id: string;
  agentId: string;
  zIndex: number;
}

const STATUS_MAP: Record<string, { text: string; color: string }> = {
  thinking: { text: 'Thinking', color: '#ffa726' },
  working: { text: 'Working', color: '#42a5f5' },
  idle: { text: 'Idle', color: '#bdbdbd' },
  done: { text: 'Done', color: '#66bb6a' },
  error: { text: 'Error', color: '#ef5350' },
};

export function DesktopOS() {
  const agents = useWorldStore((s) => s.agents);
  const dynamicAgents = useWorkspaceStore((s) => s.dynamicAgents);
  const embeds = useEmbedStore((s) => s.embeds);
  const entries = useScratchpadStore((s) => s.entries);
  const allEvents = useActivityStore((s) => s.events);

  const workspaceAgentIds = useMemo(() => new Set(dynamicAgents.map((a) => a.agentId)), [dynamicAgents]);
  const workspaceAgents = useMemo(() => agents.filter((a) => workspaceAgentIds.has(a.id)), [agents, workspaceAgentIds]);

  const chatMessages = useChatStore((s) => s.chatMessages);
  const receptionistMsgs = useMemo(() => chatMessages['receptionist'] ?? [], [chatMessages]);

  const [windows, setWindows] = useState<OpenWindow[]>([]);
  const [topZ, setTopZ] = useState(10);

  // Auto-open windows for new agents (dedup inside updater to avoid React strict-mode doubles)
  useEffect(() => {
    if (workspaceAgents.length === 0) return;

    setWindows((prev) => {
      const existingIds = new Set(prev.map((w) => w.agentId));
      const toAdd = workspaceAgents.filter((a) => !existingIds.has(a.id));
      if (toAdd.length === 0) return prev;

      const baseZ = prev.reduce((max, w) => Math.max(max, w.zIndex), 10);
      return [
        ...prev,
        ...toAdd.map((agent, i) => ({
          id: `win-${agent.id}`,
          agentId: agent.id,
          zIndex: baseZ + i + 1,
        })),
      ];
    });
  }, [workspaceAgents.length]);

  // Auto-open a "Final Results" window when the receptionist posts a summary
  const lastReceptionistMsg = receptionistMsgs.filter(m => m.role === 'agent').pop();
  const [resultsShown, setResultsShown] = useState(false);
  useEffect(() => {
    if (!lastReceptionistMsg || resultsShown) return;
    const allDone = workspaceAgents.length > 0 && workspaceAgents.every(a => a.status === 'done' || a.status === 'idle');
    if (!allDone) return;

    setResultsShown(true);
    setWindows((prev) => {
      if (prev.some(w => w.agentId === '__results__')) return prev;
      const baseZ = prev.reduce((max, w) => Math.max(max, w.zIndex), 10);
      return [...prev, { id: 'win-results', agentId: '__results__', zIndex: baseZ + 1 }];
    });
  }, [lastReceptionistMsg, workspaceAgents, resultsShown]);

  const focusWindow = useCallback((id: string) => {
    setTopZ((z) => {
      const next = z + 1;
      setWindows((prev) => prev.map((w) => w.id === id ? { ...w, zIndex: next } : w));
      return next;
    });
  }, []);

  const closeWindow = useCallback((id: string) => {
    setWindows((prev) => prev.filter((w) => w.id !== id));
  }, []);

  // Auto-tile layout — grid that fills the available space
  const tileLayout = useMemo(() => {
    const count = windows.length;
    if (count === 0) return [];

    const topBarH = 44;
    const promptBarH = 72;
    const iconColW = 80;
    const padding = 10;
    const screenW = typeof window !== 'undefined' ? window.innerWidth : 1280;
    const screenH = typeof window !== 'undefined' ? window.innerHeight : 800;

    const availW = screenW - iconColW - padding * 2;
    const availH = screenH - topBarH - promptBarH - padding * 2;

    let cols: number, rows: number;
    if (count <= 2) { cols = count; rows = 1; }
    else if (count <= 4) { cols = 2; rows = Math.ceil(count / 2); }
    else if (count <= 6) { cols = 3; rows = Math.ceil(count / 3); }
    else { cols = Math.min(4, Math.ceil(Math.sqrt(count))); rows = Math.ceil(count / cols); }

    const gap = 8;
    const cellW = (availW - gap * (cols - 1)) / cols;
    const cellH = (availH - gap * (rows - 1)) / rows;

    return windows.map((_, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      return {
        left: iconColW + padding + col * (cellW + gap),
        top: topBarH + padding + row * (cellH + gap),
        width: cellW,
        height: cellH,
      };
    });
  }, [windows.length]);

  // Per-agent tech stack from tool events
  const agentTechMap = useMemo(() => {
    const map = new Map<string, Map<string, { label: string; color: string }>>();
    for (const evt of allEvents) {
      if (evt.type === 'tool' && evt.toolName && evt.agentId) {
        const tech = getTechForTool(evt.toolName);
        if (tech) {
          if (!map.has(evt.agentId)) map.set(evt.agentId, new Map());
          map.get(evt.agentId)!.set(tech.label, tech);
        }
      }
    }
    return map;
  }, [allEvents]);

  const handleIconClick = useCallback((agentId: string) => {
    const existing = windows.find((w) => w.agentId === agentId);
    if (existing) {
      focusWindow(existing.id);
    } else {
      setWindows((prev) => [...prev, { id: `win-${agentId}`, agentId, zIndex: topZ + 1 }]);
      setTopZ((z) => z + 1);
    }
  }, [windows, topZ, focusWindow]);

  return (
    <div className="absolute inset-0 top-11 z-10">
      <style>{`
        @keyframes desktopSlideIn {
          from { opacity: 0; transform: translateX(-6px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes desktopFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes desktopBubbleIn {
          from { opacity: 0; transform: scale(0.8) translateY(8px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes desktopIconPop {
          from { opacity: 0; transform: scale(0.5); }
          60% { transform: scale(1.1); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>

      {/* Desktop icons (left column) */}
      <div className="absolute top-4 left-3 z-20 flex flex-col gap-3 w-[72px]">
        {workspaceAgents.map((agent, i) => {
          const isBusy = agent.status === 'working' || agent.status === 'thinking';
          const isDone = agent.status === 'done';
          return (
            <button
              key={agent.id}
              onClick={() => handleIconClick(agent.id)}
              className="flex flex-col items-center gap-0.5 group cursor-pointer"
              style={{ animation: `desktopIconPop 0.4s cubic-bezier(0.34,1.56,0.64,1) ${i * 60}ms both` }}
            >
              <div className="relative">
                <div
                  className="w-11 h-11 rounded-[11px] flex items-center justify-center text-sm font-bold transition-transform duration-200 group-hover:scale-110"
                  style={{
                    backgroundColor: agent.color + '20',
                    color: agent.color,
                    border: `1.5px solid ${agent.color}35`,
                    boxShadow: isBusy ? `0 0 12px ${agent.color}25` : '0 1px 4px rgba(0,0,0,0.06)',
                  }}
                >
                  {agent.name.charAt(0)}
                </div>
                {isBusy && (
                  <div className="absolute inset-[-2px] rounded-[13px] border-2 border-transparent animate-spin pointer-events-none"
                    style={{ borderTopColor: agent.color, animationDuration: '1.8s' }} />
                )}
                {isDone && (
                  <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 border-[1.5px] border-white flex items-center justify-center">
                    <svg className="w-2 h-2 text-white" viewBox="0 0 16 16" fill="none">
                      <path d="M3 8.5L6.5 12L13 4" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                )}
              </div>
              <span className="text-[9px] text-[#4a4a4a] font-medium max-w-[68px] text-center leading-tight truncate drop-shadow-[0_1px_1px_rgba(255,255,255,0.5)]">
                {agent.name}
              </span>
            </button>
          );
        })}

        {resultsShown && (
          <button
            onClick={() => handleIconClick('__results__')}
            className="flex flex-col items-center gap-0.5 group cursor-pointer mt-1"
            style={{ animation: 'desktopIconPop 0.4s cubic-bezier(0.34,1.56,0.64,1) 0.25s both' }}
          >
            <div className="w-11 h-11 rounded-[11px] bg-emerald-50 border border-emerald-200/60 flex items-center justify-center text-base shadow-sm transition-transform duration-200 group-hover:scale-110">
              <span>&#127942;</span>
            </div>
            <span className="text-[9px] text-[#4a4a4a] font-medium">Results</span>
          </button>
        )}

        {entries.length > 0 && (
          <button
            onClick={() => handleIconClick('__scratchpad__')}
            className="flex flex-col items-center gap-0.5 group cursor-pointer mt-1"
            style={{ animation: 'desktopIconPop 0.4s cubic-bezier(0.34,1.56,0.64,1) 0.3s both' }}
          >
            <div className="w-11 h-11 rounded-[11px] bg-amber-50 border border-amber-200/60 flex items-center justify-center text-base shadow-sm transition-transform duration-200 group-hover:scale-110">
              <span>&#128221;</span>
            </div>
            <span className="text-[9px] text-[#4a4a4a] font-medium">Notes</span>
          </button>
        )}
      </div>

      {/* Tiled agent windows */}
      {windows.map((win, i) => {
        const layout = tileLayout[i];
        if (!layout) return null;

        // Results window — final receptionist summary
        if (win.agentId === '__results__') {
          const summaryMsgs = receptionistMsgs.filter(m => m.role === 'agent');
          const summaryContent = summaryMsgs.length > 0 ? summaryMsgs[summaryMsgs.length - 1].content : '';
          return (
            <DesktopWindow
              key={win.id}
              title="Final Results"
              icon={<span className="text-xs">&#127942;</span>}
              style={{ left: layout.left, top: layout.top, width: layout.width, height: layout.height, zIndex: win.zIndex }}
              onFocus={() => focusWindow(win.id)}
              onClose={() => closeWindow(win.id)}
              statusColor="#66bb6a"
              statusText="Complete"
              animDelay={0}
            >
              <div className="p-4 overflow-y-auto h-full">
                <div className="mb-3 pb-2 border-b border-emerald-100">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center">
                      <svg className="w-3.5 h-3.5 text-emerald-600" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <span className="text-[13px] font-semibold text-emerald-900">Workspace Complete</span>
                  </div>
                </div>
                <Markdown>{summaryContent}</Markdown>
              </div>
            </DesktopWindow>
          );
        }

        // Scratchpad window
        if (win.agentId === '__scratchpad__') {
          return (
            <DesktopWindow
              key={win.id}
              title="Team Notes"
              icon={<span className="text-xs">&#128221;</span>}
              style={{ left: layout.left, top: layout.top, width: layout.width, height: layout.height, zIndex: win.zIndex }}
              onFocus={() => focusWindow(win.id)}
              onClose={() => closeWindow(win.id)}
              animDelay={i * 80}
            >
              <div className="p-3 space-y-2.5 overflow-y-auto h-full">
                {entries.map((entry, ei) => (
                  <div key={entry.id} style={{ animation: `desktopSlideIn 0.25s ease-out ${ei * 30}ms both` }}>
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: entry.authorColor }} />
                      <span className="text-[11px] font-semibold text-[#444]">{entry.authorType === 'user' ? 'You' : entry.authorName}</span>
                    </div>
                    <p className="text-[11px] text-[#666] leading-relaxed ml-3.5">{entry.content}</p>
                  </div>
                ))}
              </div>
            </DesktopWindow>
          );
        }

        const agent = agents.find((a) => a.id === win.agentId);
        if (!agent) return null;
        const agentEmbed = embeds.find((e) => e.agentId === win.agentId);
        const status = STATUS_MAP[agent.status] ?? STATUS_MAP.idle;
        const tech = agentTechMap.get(win.agentId);
        const techArray = tech ? Array.from(tech.values()) : [];

        return (
          <DesktopWindow
            key={win.id}
            title={agent.name}
            icon={
              <div className="w-4 h-4 rounded flex items-center justify-center text-[9px] font-bold"
                style={{ backgroundColor: agent.color + '25', color: agent.color }}>
                {agent.name.charAt(0)}
              </div>
            }
            style={{ left: layout.left, top: layout.top, width: layout.width, height: layout.height, zIndex: win.zIndex }}
            onFocus={() => focusWindow(win.id)}
            onClose={() => closeWindow(win.id)}
            statusColor={status.color}
            statusText={status.text}
            techStack={techArray}
            animDelay={i * 100}
          >
            {agentEmbed ? (
              <iframe
                src={agentEmbed.url}
                className="w-full h-full border-0"
                sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
                title={agentEmbed.title}
              />
            ) : (
              <AgentWindowContent agentId={win.agentId} agentName={agent.name} />
            )}
          </DesktopWindow>
        );
      })}

      {/* Status toast — shows workspace progress */}
      <StatusToast />

      {/* Thinking bubble */}
      <ThinkingBubble />

      {/* Prompt bar */}
      <DesktopPromptBar />
    </div>
  );
}
