'use client';

import { useState, useEffect, useMemo } from 'react';
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
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  return `${Math.floor(diff / 3600)}h`;
}

function EventRow({ event }: { event: ActivityEvent }) {
  let description: string;
  let statusClass: string;

  switch (event.type) {
    case 'tool':
      description = formatToolName(event.toolName!);
      statusClass =
        event.toolStatus === 'started'
          ? 'bg-yellow-400 animate-pulse'
          : event.toolStatus === 'completed'
            ? 'bg-green-400'
            : 'bg-red-400';
      break;
    case 'status':
      description = event.status === 'thinking' ? 'Thinking...'
        : event.status === 'working' ? 'Working...'
        : event.status === 'done' ? 'Task complete'
        : event.status === 'error' ? 'Error'
        : event.status === 'listening' ? 'Listening'
        : 'Idle';
      statusClass = event.status === 'error' ? 'bg-red-400'
        : event.status === 'done' ? 'bg-teal-400'
        : 'bg-blue-400';
      break;
    case 'delegation':
      description = `Delegated to ${event.delegateToName}`;
      statusClass = 'bg-purple-400';
      break;
    case 'skill':
      description = `Skill: ${event.skillName}`;
      statusClass = 'bg-teal-400';
      break;
    default:
      description = 'Activity';
      statusClass = 'bg-white/30';
  }

  return (
    <div className="flex items-start gap-2 px-2.5 py-2 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] transition-colors">
      <div className={`w-1.5 h-1.5 rounded-full shrink-0 mt-1.5 ${statusClass}`} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <div
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: event.agentColor }}
          />
          <span className="text-[11px] font-semibold text-white/80 truncate">
            {event.agentName}
          </span>
          <span className="text-[9px] text-white/20 shrink-0 ml-auto">
            {timeAgo(event.timestamp)}
          </span>
        </div>
        <p className="text-[11px] text-white/50 mt-0.5 truncate">{description}</p>
      </div>
    </div>
  );
}

export function ImagineActivitySidebar() {
  const [open, setOpen] = useState(false);
  const events = useActivityStore((s) => s.events);
  const [, setTick] = useState(0);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === '.') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    if (!open) return;
    const interval = setInterval(() => setTick((t) => t + 1), 5000);
    return () => clearInterval(interval);
  }, [open]);

  const recentEvents = useMemo(() => events.slice(-80), [events]);

  return (
    <>
      {/* Toggle button */}
      <button
        onClick={() => setOpen((prev) => !prev)}
        className={`fixed top-16 right-4 z-30 w-8 h-8 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
          open
            ? 'bg-[#89b4fa]/20 text-[#89b4fa]'
            : 'bg-white/[0.06] text-white/40 hover:text-white/60 hover:bg-white/10'
        }`}
        title="Activity (Ctrl+.)"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M2 4h10M2 7h7M2 10h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        {events.length > 0 && !open && (
          <span className="absolute -top-1 -right-1 flex items-center justify-center w-3.5 h-3.5 rounded-full bg-indigo-500 text-[8px] text-white font-bold">
            {events.length > 99 ? '!' : events.length}
          </span>
        )}
      </button>

      {/* Sidebar panel */}
      <div
        className={`fixed top-11 right-0 bottom-0 w-[300px] z-20 bg-[#181825]/95 backdrop-blur-sm border-l border-white/[0.06] transition-transform duration-300 flex flex-col ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="px-4 py-3 border-b border-white/[0.06]">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-white/60 uppercase tracking-wider">
              Live Activity
            </h3>
            <span className="text-[10px] text-white/20">{events.length} events</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/15 [&::-webkit-scrollbar-thumb]:rounded-full">
          {recentEvents.length === 0 ? (
            <p className="text-xs text-white/25 italic text-center py-8">No activity yet</p>
          ) : (
            recentEvents.map((event) => (
              <EventRow key={event.id} event={event} />
            ))
          )}
        </div>
      </div>
    </>
  );
}
