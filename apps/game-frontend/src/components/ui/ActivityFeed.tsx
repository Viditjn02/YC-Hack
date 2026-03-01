'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { useActivityStore, type ActivityEvent } from '@/stores/activityStore';

function formatToolName(raw: string): string {
  const parts = raw.split('_');
  if (parts.length > 1) {
    return parts
      .slice(1)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
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

function ActivityIcon({ type, toolStatus }: { type: ActivityEvent['type']; toolStatus?: string }) {
  switch (type) {
    case 'tool':
      if (toolStatus === 'started') return <span className="text-yellow-400 text-[10px]">&#9881;</span>;
      if (toolStatus === 'failed') return <span className="text-red-400 text-[10px]">&#10007;</span>;
      return <span className="text-green-400 text-[10px]">&#10003;</span>;
    case 'status':
      return <span className="text-blue-400 text-[10px]">&#9679;</span>;
    case 'delegation':
      return <span className="text-purple-400 text-[10px]">&#10132;</span>;
    case 'skill':
      return <span className="text-teal-400 text-[10px]">&#9733;</span>;
    case 'scratchpad':
      return <span className="text-orange-400 text-[10px]">&#9998;</span>;
    default:
      return null;
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case 'thinking': return 'is thinking...';
    case 'working': return 'is working...';
    case 'listening': return 'is listening';
    case 'done': return 'finished the task';
    case 'error': return 'encountered an error';
    case 'idle': return 'is now idle';
    default: return status;
  }
}

function EventDescription({ event }: { event: ActivityEvent }) {
  switch (event.type) {
    case 'tool':
      if (event.toolStatus === 'started') {
        return <span>Running <strong className="text-white/80">{formatToolName(event.toolName!)}</strong></span>;
      }
      if (event.toolStatus === 'failed') {
        return <span>Failed: <strong className="text-white/80">{formatToolName(event.toolName!)}</strong></span>;
      }
      return <span>Completed <strong className="text-white/80">{formatToolName(event.toolName!)}</strong></span>;
    case 'status':
      return <span>{statusLabel(event.status!)}</span>;
    case 'delegation':
      return (
        <span>
          Delegated to <strong className="text-white/80">{event.delegateToName}</strong>
          {event.delegateTask && (
            <span className="text-white/30">: {event.delegateTask.slice(0, 60)}{event.delegateTask.length > 60 ? '...' : ''}</span>
          )}
        </span>
      );
    case 'skill':
      return <span>Created skill <strong className="text-white/80">{event.skillName}</strong></span>;
    case 'scratchpad':
      return <span>Posted to scratchpad</span>;
    default:
      return <span>Activity</span>;
  }
}

export function ActivityFeed() {
  const events = useActivityStore((s) => s.events);
  const [open, setOpen] = useState(false);
  const [, setTick] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [events.length]);

  useEffect(() => {
    if (!open) return;
    const interval = setInterval(() => setTick((t) => t + 1), 5000);
    return () => clearInterval(interval);
  }, [open]);

  const recentEvents = useMemo(() => events.slice(-50), [events]);

  return (
    <>
      {/* Toggle button — bottom-left above ScratchpadFeed */}
      <button
        onClick={() => setOpen((prev) => !prev)}
        className={`fixed bottom-4 left-4 z-50 flex items-center gap-2 px-3 py-2 rounded-xl transition-all cursor-pointer ${
          open
            ? 'bg-indigo-600/90 text-white'
            : 'bg-black/60 hover:bg-black/80 text-white/60 hover:text-white'
        } backdrop-blur-sm border border-white/10`}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.2" />
          <path d="M7 4v3.5l2.5 1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
        <span className="text-xs font-medium">Activity</span>
        {events.length > 0 && !open && (
          <span className="flex items-center justify-center w-4 h-4 rounded-full bg-indigo-500 text-[9px] text-white font-bold">
            {events.length > 99 ? '99+' : events.length}
          </span>
        )}
      </button>

      {/* Feed panel */}
      {open && (
        <div className="fixed left-4 bottom-16 w-96 z-50 bg-gray-950/95 backdrop-blur-md rounded-xl border border-white/10 overflow-hidden max-h-[70vh] flex flex-col animate-[fadeIn_0.2s_ease-out]">
          {/* Header */}
          <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-sm font-semibold text-white">Live Agent Activity</span>
            </div>
            <span className="text-[10px] text-white/30">{events.length} events</span>
          </div>

          {/* Events */}
          <div className="flex-1 overflow-y-auto p-2 space-y-0.5 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/15 [&::-webkit-scrollbar-thumb]:rounded-full">
            {recentEvents.length === 0 ? (
              <div className="flex items-center justify-center py-12 text-white/25 text-xs">
                No agent activity yet. Start a conversation to see agents in action.
              </div>
            ) : (
              recentEvents.map((event) => (
                <div
                  key={event.id}
                  className="flex items-start gap-2.5 px-3 py-2 rounded-lg hover:bg-white/[0.03] transition-colors"
                >
                  <div className="mt-0.5 shrink-0">
                    <ActivityIcon type={event.type} toolStatus={event.toolStatus} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <div
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: event.agentColor }}
                      />
                      <span className="text-[11px] font-semibold text-white truncate">
                        {event.agentName}
                      </span>
                      <span className="text-[9px] text-white/20 shrink-0 ml-auto">
                        {timeAgo(event.timestamp)}
                      </span>
                    </div>
                    <div className="text-[11px] text-white/50 mt-0.5 leading-snug">
                      <EventDescription event={event} />
                    </div>
                  </div>
                </div>
              ))
            )}
            <div ref={bottomRef} />
          </div>
        </div>
      )}
    </>
  );
}
